// surface-navigator.js - HUD de Navegação Planetária 2.5D (Columbus View)
// Elite Dangerous Explorer HUD

const surfaceTr = (key, ...args) => (window.t ? window.t(key, ...args) : key);

let surfaceScene, surfaceCamera, surfaceRenderer, surfaceControls;
let surfaceVehicleMarker = null;
let surfaceDropStalk = null;
let surfaceShadowDisc = null;
let surfaceLandingBeacon = null;
let surfaceRingsGroup = null;
let surfaceTetherLine = null;
let surfaceBioGroup = null;
let surfaceBioTetherLine = null;

// Grupos para alternância entre Navegação Tática Local (1.200m) e Mapa Planetário Global (-180° a +180°)
let surfaceTacticalGroup = null;
let surfaceTacticalGridHelper = null;
let surfaceTacticalHorizonGroup = null;
let surfaceGlobalGroup = null;
let surfaceFeaturesMarkersGroup = null;
let globalShipMarker = null;

let currentViewMode = 'AUTO'; // 'AUTO', 'GLOBAL', 'TACTICAL'
let activeViewScale = 'TACTICAL'; // estado efetivo atual exibido
let lastReportedAltitude = 0.0;

let isSurfaceViewActive = false;
let autoSwitchedToSurface = false;
let userManuallyClosedSurface = false;
let userHasManuallyPannedCamera = false;
let isUserInteractingWithCamera = false;

// Estado de telemetria local
let lastSurfaceData = {
    onPlanetSurface: false,
    inPlanetaryOrbit: false,
    landed: false,
    inSrv: false,
    onFoot: false,
    currentSystem: '',
    bodyName: '',
    latitude: null,
    longitude: null,
    altitude: 0.0,
    heading: 0.0,
    surfaceGravity: null,
    atmosphereType: '',
    planetRadius: 2100000.0,
    touchdownLat: null,
    touchdownLong: null,
    distanceToTouchdown: 0.0
};

// Inicialização da cena 2.5D Columbus View
function initSurface3D() {
    const container = document.getElementById('surface-viewport-container');
    const canvas = document.getElementById('surface-three-canvas');
    if (!container || !canvas) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Cena e Névoa Atmosférica Planetária
    surfaceScene = new THREE.Scene();
    surfaceScene.background = new THREE.Color(0x020813);
    surfaceScene.fog = new THREE.FogExp2(0x020813, 0.00035);

    // Câmera em Perspectiva Inclinada 2.5D (Columbus View)
    surfaceCamera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    // Posição panorâmica ampla enquadrando toda a grade de 1200m e o anel dos 500m
    surfaceCamera.position.set(0, 480, 680);

    // Renderer
    surfaceRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    surfaceRenderer.setSize(width, height);
    surfaceRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // OrbitControls suaves
    surfaceControls = new THREE.OrbitControls(surfaceCamera, surfaceRenderer.domElement);
    surfaceControls.enableDamping = true;
    surfaceControls.dampingFactor = 0.08;
    surfaceControls.maxPolarAngle = Math.PI * 0.48; // Não deixa a câmera passar para debaixo do solo
    surfaceControls.minDistance = 20;
    surfaceControls.maxDistance = 2500;
    surfaceControls.target.set(0, 0, 0);

    surfaceControls.addEventListener('start', () => {
        isUserInteractingWithCamera = true;
        userHasManuallyPannedCamera = true;
    });
    surfaceControls.addEventListener('end', () => {
        isUserInteractingWithCamera = false;
    });

    // Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    surfaceScene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x99ddff, 0.8);
    dirLight.position.set(100, 200, 150);
    surfaceScene.add(dirLight);

    // GRUPO 1: MODO TÁTICO LOCAL (1.200m x 1.200m com anéis concêntricos e bio-amostras)
    surfaceTacticalGroup = new THREE.Group();
    surfaceScene.add(surfaceTacticalGroup);

    // 1. Grade Holográfica de Terreno (2.5D Columbus View: 1200m x 1200m, células de 50m)
    const gridSize = 1200;
    const gridDivisions = 24; // 1200 / 24 = 50m por quadrado
    surfaceTacticalGridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x00d4ff, 0x092e4a);
    surfaceTacticalGridHelper.position.y = 0;
    surfaceTacticalGroup.add(surfaceTacticalGridHelper);

    // 2. Anéis Concêntricos de Distância a partir do Local de Pouso (100m, 200m, 500m)
    surfaceRingsGroup = new THREE.Group();
    surfaceTacticalGroup.add(surfaceRingsGroup);
    createConcentricRangeRings();

    // 3. Baliza do Local de Pouso (Touchdown Landing Site)
    createLandingBeacon();
    surfaceTacticalGroup.add(surfaceLandingBeacon);

    // 4. Marcador Vetorial da Nave / SRV
    createVehicleMarker();
    surfaceTacticalGroup.add(surfaceVehicleMarker);
    surfaceTacticalGroup.add(surfaceDropStalk);
    surfaceTacticalGroup.add(surfaceShadowDisc);

    // 5. Linha Guia Holográfica de Retorno até a Nave (Tether Line)
    const tetherGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.05, 0),
        new THREE.Vector3(0, 0.05, 0)
    ]);
    const tetherMat = new THREE.LineDashedMaterial({
        color: 0xffaa00,
        dashSize: 4,
        gapSize: 2,
        transparent: true,
        opacity: 0.75
    });
    surfaceTetherLine = new THREE.Line(tetherGeo, tetherMat);
    surfaceTetherLine.computeLineDistances();
    surfaceTetherLine.visible = false;
    surfaceTacticalGroup.add(surfaceTetherLine);

    // 6. Grupo de Balizas de Amostras Biológicas e Círculos de Colônia
    surfaceBioGroup = new THREE.Group();
    surfaceTacticalGroup.add(surfaceBioGroup);

    // 7. Linha Holográfica do Hodômetro de Diversidade Genética (Bio Tether Line)
    const bioTetherGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.05, 0),
        new THREE.Vector3(0, 0.05, 0)
    ]);
    const bioTetherMat = new THREE.LineDashedMaterial({
        color: 0x00ffaa,
        dashSize: 3,
        gapSize: 2,
        transparent: true,
        opacity: 0.85
    });
    surfaceBioTetherLine = new THREE.Line(bioTetherGeo, bioTetherMat);
    surfaceBioTetherLine.computeLineDistances();
    surfaceBioTetherLine.visible = false;
    surfaceTacticalGroup.add(surfaceBioTetherLine);

    // 8. Radar de Horizonte Tático (Balizas de Elementos em Solo na Borda de 1200m)
    surfaceTacticalHorizonGroup = new THREE.Group();
    surfaceTacticalGroup.add(surfaceTacticalHorizonGroup);

    // GRUPO 2: MAPA PLANETÁRIO GLOBAL COLUMBUS VIEW (-180° a +180° e -90° a +90°)
    surfaceGlobalGroup = new THREE.Group();
    surfaceGlobalGroup.visible = false;
    surfaceScene.add(surfaceGlobalGroup);

    // Monta a Projeção Cilíndrica Equirretangular Global
    createGlobalPlanetGrid();

    // Grupo de Marcadores de Elementos em Solo (Colônias, Portos, Geo, POIs)
    surfaceFeaturesMarkersGroup = new THREE.Group();
    surfaceGlobalGroup.add(surfaceFeaturesMarkersGroup);

    // Marcador da Nave no Mapa Global
    createGlobalShipMarker();

    // Redimensionamento
    window.addEventListener('resize', onSurfaceResize);

    // Monta a fita da bússola
    buildCompassTape();

    // Loop de renderização 2.5D
    animateSurface();
}

function onSurfaceResize() {
    if (!surfaceCamera || !surfaceRenderer) return;
    const container = document.getElementById('surface-viewport-container');
    if (!container) return;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    surfaceCamera.aspect = width / height;
    surfaceCamera.updateProjectionMatrix();
    surfaceRenderer.setSize(width, height);
}

// Cria os anéis concêntricos holográficos no chão indicando distâncias
function createConcentricRangeRings() {
    const distances = [
        { r: 100, color: 0x00d4ff, opacity: 0.25, label: '100m' },
        { r: 200, color: 0x00d4ff, opacity: 0.35, label: '200m' },
        { r: 500, color: 0xffaa00, opacity: 0.55, label: '500m (Mínimo Stratum)' },
        { r: 560, color: 0x00e5ff, opacity: 0.70, label: '560m (Borda do Radar)' }
    ];

    distances.forEach(d => {
        const ringGeo = new THREE.RingGeometry(d.r - 0.4, d.r + 0.4, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: d.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: d.opacity
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = 0.05;
        surfaceRingsGroup.add(ringMesh);
    });
}

// Baliza holográfica cravada no ponto onde a nave pousou (exibida apenas quando desembarcado a pé ou de SRV)
function createLandingBeacon() {
    const beaconGroup = new THREE.Group();

    // Octaedro dourado flutuante sobre o ponto de pouso
    const beaconGeo = new THREE.OctahedronGeometry(2.5, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        wireframe: true,
        transparent: true,
        opacity: 0.85
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.y = 4.0;
    beaconGroup.add(beaconMesh);

    // Núcleo luminoso
    const coreGeo = new THREE.SphereGeometry(1.0, 12, 8);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 4.0;
    beaconGroup.add(coreMesh);

    // Haste de fixação no solo
    const postGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 4.0, 0)
    ]);
    const postMat = new THREE.LineBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
    beaconGroup.add(new THREE.Line(postGeo, postMat));

    // Disco de aterissagem no chão
    const padGeo = new THREE.RingGeometry(4.0, 5.0, 32);
    const padMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.rotation.x = Math.PI / 2;
    beaconGroup.add(padMesh);

    // Rótulo textual 2D flutuante identificando a nave estacionada
    beaconGroup.visible = false;
    surfaceLandingBeacon = beaconGroup;
    updateLandingBeaconLabel();
}

// Atualiza o rótulo 3D da baliza de pouso conforme o idioma selecionado
function updateLandingBeaconLabel() {
    if (!surfaceLandingBeacon) return;
    const oldSprite = surfaceLandingBeacon.getObjectByName('landingBeaconLabel');
    if (oldSprite) {
        if (oldSprite.material && oldSprite.material.map) oldSprite.material.map.dispose();
        if (oldSprite.material) oldSprite.material.dispose();
        surfaceLandingBeacon.remove(oldSprite);
    }
    const labelSprite = createTextSprite(surfaceTr('surface.ship_parked'), '#ffaa00', 11);
    labelSprite.name = 'landingBeaconLabel';
    labelSprite.position.set(0, 8.0, 0);
    labelSprite.scale.set(40, 10, 1);
    surfaceLandingBeacon.add(labelSprite);
}

// Cria o modelo da nave / SRV do jogador com vetor de rumo e haste de sombra
function createVehicleMarker() {
    const vehicleGroup = new THREE.Group();

    // Modelo de seta/delta estilizada da nave
    const shipGeo = new THREE.ConeGeometry(2.2, 5.5, 4);
    shipGeo.rotateX(Math.PI / 2); // Ponta da nave para frente (+Z)
    const shipMat = new THREE.MeshBasicMaterial({
        color: 0x2bfca8,
        wireframe: false
    });
    const shipMesh = new THREE.Mesh(shipGeo, shipMat);
    shipMesh.position.y = 0;
    vehicleGroup.add(shipMesh);

    // Contorno aramado neon
    const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    vehicleGroup.add(new THREE.Mesh(shipGeo, wireMat));

    // Halo circular ao redor do veículo
    const haloGeo = new THREE.RingGeometry(3.5, 4.0, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x2bfca8, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    vehicleGroup.add(haloMesh);

    // Haste vertical de altitude (Drop Stalk) até o solo
    const stalkGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)
    ]);
    const stalkMat = new THREE.LineDashedMaterial({
        color: 0x00d4ff,
        dashSize: 2,
        gapSize: 1,
        transparent: true,
        opacity: 0.75
    });
    surfaceDropStalk = new THREE.Line(stalkGeo, stalkMat);
    surfaceDropStalk.computeLineDistances();

    // Sombra projetada no solo
    const shadowGeo = new THREE.RingGeometry(2.0, 2.6, 24);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    surfaceShadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    surfaceShadowDisc.rotation.x = Math.PI / 2;
    surfaceShadowDisc.position.y = 0.02;

    surfaceVehicleMarker = vehicleGroup;
}

// Cria a projeção cilíndrica equirretangular global (-180° a +180° Longitude, -90° a +90° Latitude)
function createGlobalPlanetGrid() {
    const group = new THREE.Group();

    // 1. Superfície de Fundo do Mapa (Plano 1800 x 900: 5 unidades por grau)
    const width = 1800;
    const height = 900;
    const planeGeo = new THREE.PlaneGeometry(width, height, 36, 18);
    const planeMat = new THREE.MeshBasicMaterial({
        color: 0x020f1e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
    });
    const bgPlane = new THREE.Mesh(planeGeo, planeMat);
    bgPlane.rotation.x = Math.PI / 2;
    bgPlane.position.y = -0.2;
    group.add(bgPlane);

    // 2. Grade de Meridianos e Paralelos a cada 30 graus (150 unidades)
    const gridHelper = new THREE.GridHelper(width, 12, 0x00d4ff, 0x093355);
    gridHelper.scale.set(1, 1, 0.5); // Comprime o eixo Z de 1800 para 900
    gridHelper.position.y = 0;
    group.add(gridHelper);

    // 3. Equador Destacado (Lat 0°)
    const eqGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-900, 0.2, 0),
        new THREE.Vector3(900, 0.2, 0)
    ]);
    const eqMat = new THREE.LineBasicMaterial({ color: 0x00d4ff });
    group.add(new THREE.Line(eqGeo, eqMat));

    // 4. Meridiano de Greenwich Destacado (Lon 0°)
    const primeGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.2, -450),
        new THREE.Vector3(0, 0.2, 450)
    ]);
    const primeMat = new THREE.LineBasicMaterial({ color: 0x00d4ff });
    group.add(new THREE.Line(primeGeo, primeMat));

    // 5. Trópicos (±23.5° = ±117.5 unidades em Z)
    [-117.5, 117.5].forEach(z => {
        const tropGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-900, 0.1, z),
            new THREE.Vector3(900, 0.1, z)
        ]);
        const tropMat = new THREE.LineDashedMaterial({ color: 0x2bfca8, dashSize: 8, gapSize: 6, transparent: true, opacity: 0.45 });
        const tropLine = new THREE.Line(tropGeo, tropMat);
        tropLine.computeLineDistances();
        group.add(tropLine);
    });

    // 6. Borda Externa do Mapa Global
    const borderPoints = [
        new THREE.Vector3(-900, 0.2, -450),
        new THREE.Vector3(900, 0.2, -450),
        new THREE.Vector3(900, 0.2, 450),
        new THREE.Vector3(-900, 0.2, 450),
        new THREE.Vector3(-900, 0.2, -450)
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.8 });
    group.add(new THREE.Line(borderGeo, borderMat));

    // 7. Rótulos Holográficos nos Eixos
    const labels = [
        { text: "POLO NORTE (+90°)", x: 0, z: -465, color: "#00d4ff" },
        { text: "EQUADOR (0°)", x: -940, z: 0, color: "#2bfca8" },
        { text: "POLO SUL (-90°)", x: 0, z: 465, color: "#00d4ff" },
        { text: "-180° O", x: -900, z: -465, color: "#8da4be" },
        { text: "-90° O", x: -450, z: -465, color: "#8da4be" },
        { text: "0° MERIDIANO", x: 0, z: -480, color: "#00d4ff" },
        { text: "+90° L", x: 450, z: -465, color: "#8da4be" },
        { text: "+180° L", x: 900, z: -465, color: "#8da4be" }
    ];

    labels.forEach(l => {
        const sprite = createTextSprite(l.text, l.color, 12);
        sprite.position.set(l.x, 1, l.z);
        group.add(sprite);
    });

    surfaceGlobalGroup.add(group);
}

// Cria o marcador luminoso da nave no mapa global
function createGlobalShipMarker() {
    const group = new THREE.Group();

    // Cone indicador da nave apontando para o rumo
    const coneGeo = new THREE.ConeGeometry(8, 20, 4);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x2bfca8 });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    group.add(coneMesh);

    // Contorno aramado branco brilhante
    const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    group.add(new THREE.Mesh(coneGeo, wireMat));

    // Halo circular pulsante no solo
    const haloGeo = new THREE.RingGeometry(12, 16, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x2bfca8, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.y = 0.5;
    group.add(haloMesh);

    // Haste de altitude global
    const stalkGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)
    ]);
    const stalkMat = new THREE.LineDashedMaterial({ color: 0x2bfca8, dashSize: 4, gapSize: 2, transparent: true, opacity: 0.8 });
    const stalk = new THREE.Line(stalkGeo, stalkMat);
    stalk.name = 'globalStalk';
    group.add(stalk);

    globalShipMarker = group;
    surfaceGlobalGroup.add(globalShipMarker);
}

// Cria um Sprite 2D nítido com texto renderizado em canvas
function createTextSprite(text, color, fontSize) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    ctx.font = `Bold ${fontSize * 2}px monospace`;
    ctx.fillStyle = color || '#00d4ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(60, 15, 1);
    return sprite;
}

// Cria o marcador 3D de um elemento de solo no mapa global (-180° a +180°)
function createSurfaceFeatureMarker(feature) {
    const group = new THREE.Group();

    // Mapeamento de Coordenadas:
    // Longitude (-180 a +180) -> X (-900 a +900)
    // Latitude (-90 a +90) -> Z (+450 a -450: Norte é -Z)
    const x = (feature.longitude / 180.0) * 900.0;
    const z = - (feature.latitude / 90.0) * 450.0;
    group.position.set(x, 0, z);

    let mainColor = 0x00d4ff; // Padrão: Ciano (Colônia)
    let iconChar = '🏢';

    if (feature.type === 'EXTRACTION') {
        mainColor = 0xffaa00; // Dourado / Âmbar (Extração Mineral)
        iconChar = '⛏️';
    } else if (feature.type === 'CRASH_SITE') {
        mainColor = 0xff3311; // Vermelho Alaranjado (Destroços / Queda)
        iconChar = '💥';
    } else if (feature.type === 'DISTRESS_BEACON') {
        mainColor = 0xffea00; // Amarelo (Sinalizador de Emergência)
        iconChar = '📡';
    } else if (feature.type === 'RESEARCH') {
        mainColor = 0x00e5ff; // Ciano Neon (Pesquisa / Bio-Lab)
        iconChar = '🔬';
    } else if (feature.type === 'AGRICULTURE') {
        mainColor = 0x76ff03; // Verde Lima (Complexo Agrícola)
        iconChar = '🌾';
    } else if (feature.type === 'MILITARY') {
        mainColor = 0xff1744; // Carmesim (Base Militar)
        iconChar = '🎖️';
    } else if (feature.type === 'PORT') {
        mainColor = 0x00b0ff; // Azul / Dourado (Porto Planetário)
        iconChar = '🚀';
    } else if (feature.type === 'GEO_SITE') {
        mainColor = 0xff6d00; // Laranja Magma (Geológico / Fumarolas)
        iconChar = '🌋';
    } else if (feature.type === 'GUARDIAN' || feature.type === 'EXPLORATION_POI') {
        mainColor = 0xd500f9; // Magenta (Lore / Ruínas Guardiãs)
        iconChar = '🏛️';
    }

    // Geometria 3D específica por tipo de elemento
    if (feature.type === 'EXTRACTION') {
        // Torre de mineração com broca cônica invertida e anel de minérios
        const derrickGeo = new THREE.CylinderGeometry(2, 5, 14, 6);
        const derrickMat = new THREE.MeshBasicMaterial({ color: mainColor, wireframe: true });
        const derrickMesh = new THREE.Mesh(derrickGeo, derrickMat);
        derrickMesh.position.y = 7;
        group.add(derrickMesh);

        const oreRingGeo = new THREE.RingGeometry(6, 9, 16);
        const oreRingMat = new THREE.MeshBasicMaterial({ color: mainColor, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
        const oreRingMesh = new THREE.Mesh(oreRingGeo, oreRingMat);
        oreRingMesh.rotation.x = Math.PI / 2;
        oreRingMesh.position.y = 0.2;
        group.add(oreRingMesh);
    } else if (feature.type === 'CRASH_SITE') {
        // Destroços de nave: fragmentos angulares caídos e sinalizador vermelho
        const wreck1 = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 11), new THREE.MeshBasicMaterial({ color: 0x882211, wireframe: true }));
        wreck1.rotation.set(0.2, 0.4, 0.1);
        wreck1.position.set(0, 1.5, 0);
        group.add(wreck1);

        const wreck2 = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 4), new THREE.MeshBasicMaterial({ color: mainColor, wireframe: true }));
        wreck2.rotation.set(Math.PI / 3, 0.2, 0.5);
        wreck2.position.set(4, 2, -3);
        group.add(wreck2);

        // Sinalizador luminoso de socorro
        const flareGeo = new THREE.SphereGeometry(1.2, 8, 8);
        const flareMesh = new THREE.Mesh(flareGeo, new THREE.MeshBasicMaterial({ color: 0xff3311 }));
        flareMesh.position.set(0, 5, 0);
        flareMesh.name = 'relicDiamond';
        group.add(flareMesh);
    } else if (feature.type === 'DISTRESS_BEACON') {
        // Torre com antena e anéis concêntricos pulsantes de transmissão de rádio
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.5, 18, 6), new THREE.MeshBasicMaterial({ color: mainColor, wireframe: true }));
        mast.position.y = 9;
        group.add(mast);

        const waveGeo = new THREE.RingGeometry(5, 8, 24);
        const waveMesh = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: mainColor, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
        waveMesh.rotation.x = Math.PI / 2;
        waveMesh.position.y = 0.2;
        group.add(waveMesh);
    } else if (feature.type === 'RESEARCH') {
        // Domo de laboratório bio com torre de sensores
        const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: mainColor, wireframe: true }));
        dome.position.y = 0.1;
        group.add(dome);

        const labRing = new THREE.Mesh(new THREE.RingGeometry(6, 8, 24), new THREE.MeshBasicMaterial({ color: mainColor, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
        labRing.rotation.x = Math.PI / 2;
        labRing.position.y = 0.2;
        group.add(labRing);
    } else if (feature.type === 'PORT') {
        // Heliporto hexagonal com torre
        const padGeo = new THREE.RingGeometry(8, 12, 6);
        const padMat = new THREE.MeshBasicMaterial({ color: mainColor, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.rotation.x = Math.PI / 2;
        padMesh.position.y = 0.2;
        group.add(padMesh);

        const towerGeo = new THREE.CylinderGeometry(2, 3, 14, 6);
        const towerMat = new THREE.MeshBasicMaterial({ color: mainColor, wireframe: true });
        const towerMesh = new THREE.Mesh(towerGeo, towerMat);
        towerMesh.position.y = 7;
        group.add(towerMesh);
    } else if (feature.type === 'GEO_SITE') {
        // Vulcão / Fumarola cônica
        const coneGeo = new THREE.ConeGeometry(5, 10, 8);
        const coneMat = new THREE.MeshBasicMaterial({ color: mainColor, wireframe: true });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        coneMesh.position.y = 5;
        group.add(coneMesh);

        const thermalGeo = new THREE.RingGeometry(6, 9, 24);
        const thermalMat = new THREE.MeshBasicMaterial({ color: mainColor, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
        const thermalMesh = new THREE.Mesh(thermalGeo, thermalMat);
        thermalMesh.rotation.x = Math.PI / 2;
        group.add(thermalMesh);
    } else if (feature.type === 'GUARDIAN' || feature.type === 'EXPLORATION_POI') {
        // Cristal relíquia octaédrico flutuante
        const octaGeo = new THREE.OctahedronGeometry(6, 0);
        const octaMat = new THREE.MeshBasicMaterial({ color: mainColor, wireframe: true });
        const octaMesh = new THREE.Mesh(octaGeo, octaMat);
        octaMesh.position.y = 12;
        octaMesh.name = 'relicDiamond';
        group.add(octaMesh);

        const haloGeo = new THREE.RingGeometry(7, 10, 24);
        const haloMat = new THREE.MeshBasicMaterial({ color: mainColor, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        haloMesh.rotation.x = Math.PI / 2;
        group.add(haloMesh);
    } else {
        // Assentamento / Colônia padrão: Torre com anel duplo
        const towerGeo = new THREE.BoxGeometry(6, 12, 6);
        const towerMat = new THREE.MeshBasicMaterial({ color: mainColor, wireframe: true });
        const towerMesh = new THREE.Mesh(towerGeo, towerMat);
        towerMesh.position.y = 6;
        group.add(towerMesh);

        const ringGeo = new THREE.RingGeometry(6, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: mainColor, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        group.add(ringMesh);
    }

    // Rótulo Flutuante com Nome da Colônia / POI
    const labelSprite = createTextSprite(feature.name, '#' + mainColor.toString(16).padStart(6, '0'), 11);
    labelSprite.position.set(0, 22, 0);
    group.add(labelSprite);

    group.userData = { feature: feature };
    return group;
}

// Monta a fita graduada da bússola de 0° a 360° no topo da tela
function buildCompassTape() {
    const tapeEl = document.getElementById('surfaceCompassTape');
    if (!tapeEl) return;

    const cardinals = { 0: 'N', 45: 'NE', 90: 'L', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO', 360: 'N' };
    let html = '';

    // Repete a fita de -360 a +720 para scrolling infinito suave sem quebras
    for (let deg = -180; deg <= 540; deg += 15) {
        const normDeg = (deg + 360) % 360;
        const isMajor = (deg % 45 === 0);
        const label = cardinals[normDeg] || normDeg.toString().padStart(3, '0');
        const color = (label === 'N') ? '#2bfca8' : (isMajor ? '#ffffff' : '#6a88a8');

        html += `
            <div style="width: 50px; flex-shrink: 0; text-align: center; position: relative;">
                <div style="font-size: ${isMajor ? '12px' : '9px'}; font-weight: ${isMajor ? 'bold' : 'normal'}; color: ${color};">
                    ${label}
                </div>
                <div style="width: 1px; height: ${isMajor ? '8px' : '4px'}; background: ${color}; margin: 2px auto 0;"></div>
            </div>
        `;
    }
    tapeEl.innerHTML = html;
}

// Atualiza a fita da bússola conforme o rumo (Heading) em graus
function updateCompassTape(heading) {
    const tapeEl = document.getElementById('surfaceCompassTape');
    const readoutEl = document.getElementById('surfaceHeadingReadout');
    if (!tapeEl) return;

    // Normaliza heading entre 0 e 360 (Elite Dangerous pode emitir valores negativos, ex: -91° = 269°)
    const h = ((heading % 360) + 360) % 360;

    // A cada 15 graus temos 50 pixels -> 3.333 pixels por grau
    const pxPerDegree = 50 / 15;

    // Container visível onde a agulha central verde está fixada em left: 50%
    const container = tapeEl.parentElement;
    const containerWidth = container ? container.clientWidth : 330;

    // A fita foi construída no buildCompassTape() de -180° a +540° em passos de 15°.
    // O tick correspondente a 0° (Norte) é o 12º elemento (12 * 50 = 600px).
    // O traço vertical fica no centro do elemento (+25px).
    // Portanto, o centro exato de 0° (Norte) fica a 625px do início da fita.
    const zeroCenterPx = 625;
    const targetPx = zeroCenterPx + (h * pxPerDegree);

    // Deslocamento para alinhar perfeitamente o grau h sob a agulha central:
    const shift = (containerWidth / 2) - targetPx;
    tapeEl.style.transform = `translateX(${shift}px)`;

    if (readoutEl) {
        let card = 'N';
        if (h >= 22.5 && h < 67.5) card = 'NE';
        else if (h >= 67.5 && h < 112.5) card = 'L';
        else if (h >= 112.5 && h < 157.5) card = 'SE';
        else if (h >= 157.5 && h < 202.5) card = 'S';
        else if (h >= 202.5 && h < 247.5) card = 'SO';
        else if (h >= 247.5 && h < 292.5) card = 'O';
        else if (h >= 292.5 && h < 337.5) card = 'NO';
        readoutEl.textContent = `${Math.round(h).toString().padStart(3, '0')}° (${card})`;
    }
}

// Loop de animação Three.js 2.5D
function animateSurface() {
    requestAnimationFrame(animateSurface);
    if (!isSurfaceViewActive) return;

    if (surfaceLandingBeacon) {
        // Gira suavemente a baliza do local de pouso
        surfaceLandingBeacon.children[0].rotation.y += 0.015;
    }

    if (surfaceBioGroup) {
        // Gira suavemente os diamantes das bio-amostras
        surfaceBioGroup.children.forEach(b => {
            const diamond = b.getObjectByName('bioDiamond');
            if (diamond) diamond.rotation.y += 0.02;
        });
    }

    if (surfaceFeaturesMarkersGroup) {
        // Gira suavemente os cristais e antenas de elementos de solo
        surfaceFeaturesMarkersGroup.children.forEach(b => {
            const diamond = b.getObjectByName('relicDiamond');
            if (diamond) diamond.rotation.y += 0.015;
        });
    }

    if (surfaceControls) {
        surfaceControls.update();
    }

    if (surfaceRenderer && surfaceScene && surfaceCamera) {
        surfaceRenderer.render(surfaceScene, surfaceCamera);
    }
}

// Converte coordenadas GPS em vetor cartesiano relativo (X, Z) e distância em metros
function getRelativeCoordsMeters(targetLat, targetLon, originLat, originLon, planetRadius) {
    const R = (planetRadius && planetRadius > 0) ? planetRadius : 2100000.0;
    const originLatRad = (originLat || 0) * Math.PI / 180;
    const targetLatRad = (targetLat || 0) * Math.PI / 180;
    const dLat = ((targetLat || 0) - (originLat || 0)) * Math.PI / 180;
    const dLon = ((targetLon || 0) - (originLon || 0)) * Math.PI / 180;

    // Deslocamento Norte-Sul (eixo Z: Norte é -Z, Sul é +Z)
    const z = - (dLat * R);
    // Deslocamento Leste-Oeste (eixo X: Leste é +X, Oeste é -X)
    const x = dLon * R * Math.cos((originLatRad + targetLatRad) / 2);
    const dist = Math.sqrt(x * x + z * z);

    return { x: x, z: z, dist: dist };
}

// Compatibilidade legada
function gpsToLocalMeters(lat, lon, tdLat, tdLon, planetRadius) {
    return getRelativeCoordsMeters(lat, lon, tdLat, tdLon, planetRadius);
}

let lastRenderedPos = null;
let lastRenderedBioCount = -1;
let lastRenderedFeaturesKey = '';
let lastRenderedTacticalFeaturesKey = '';

// Função para re-alinhar a câmera na nave / jogador sob demanda
function recenterCameraOnShip() {
    userHasManuallyPannedCamera = false;
    if (!surfaceControls || !surfaceCamera) return;
    const alt = Math.max(0, lastSurfaceData.altitude || 0.0);

    if (activeViewScale === 'GLOBAL') {
        const gx = ((lastSurfaceData.longitude || 0) / 180.0) * 900.0;
        const gz = - ((lastSurfaceData.latitude || 0) / 90.0) * 450.0;
        surfaceControls.target.set(gx, 0, gz);
        surfaceCamera.position.set(gx, 350, gz + 400);
    } else {
        surfaceControls.target.set(0, Math.min(alt * 0.3, 40), 0);
        surfaceCamera.position.set(0, Math.max(alt + 480, 480), 680);
    }
    surfaceControls.update();
}

// Atualiza a posição da nave e os dados do HUD
function updateSurfaceTelemetry(data) {
    if (!data) return;
    lastSurfaceData = Object.assign(lastSurfaceData, data);

    const isAboardLandedShip = data.landed && !data.inSrv && !data.onFoot;
    const isOutsideShip = (data.onFoot || data.inSrv);
    const tdLat = isAboardLandedShip ? data.latitude : ((data.touchdownLat !== null && data.touchdownLat !== undefined) ? data.touchdownLat : data.latitude);
    const tdLon = isAboardLandedShip ? data.longitude : ((data.touchdownLong !== null && data.touchdownLong !== undefined) ? data.touchdownLong : data.longitude);

    const alt = Math.max(0, data.altitude || 0.0);
    const heading = data.heading || 0.0;

    // Detecta se houve movimentação real do veículo/jogador
    const moved = !lastRenderedPos ||
        Math.abs((data.latitude || 0) - lastRenderedPos.latitude) > 0.000005 ||
        Math.abs((data.longitude || 0) - lastRenderedPos.longitude) > 0.000005 ||
        Math.abs(alt - lastRenderedPos.altitude) > 0.5 ||
        Math.abs(heading - lastRenderedPos.heading) > 0.3 ||
        data.landed !== lastRenderedPos.landed ||
        data.inSrv !== lastRenderedPos.inSrv ||
        data.onFoot !== lastRenderedPos.onFoot ||
        data.inPlanetaryOrbit !== lastRenderedPos.inPlanetaryOrbit;

    if (moved) {
        // 1. Terreno em movimento: a grade holográfica de 1200m rola sob a nave conforme ela se desloca
        const R = (data.planetRadius && data.planetRadius > 0) ? data.planetRadius : 2100000.0;
        const worldLatRad = (data.latitude || 0) * Math.PI / 180;
        const worldZ = - (worldLatRad * R);
        const worldX = (data.longitude || 0) * Math.PI / 180 * R * Math.cos(worldLatRad);

        if (surfaceTacticalGridHelper) {
            surfaceTacticalGridHelper.position.set(- (worldX % 50), 0, - (worldZ % 50));
        }
        if (surfaceRingsGroup) {
            surfaceRingsGroup.position.set(0, 0.05, 0);
        }
        if (surfaceTacticalHorizonGroup) {
            surfaceTacticalHorizonGroup.position.set(0, 0.1, 0);
        }

        // 2. O jogador (nave ou piloto) é SEMPRE o centro exato do radar tático (0, alt, 0)
        if (surfaceVehicleMarker) {
            surfaceVehicleMarker.position.set(0, alt, 0);
            surfaceVehicleMarker.rotation.y = - (heading * Math.PI / 180);
        }

        // 3. Atualiza a haste vertical de altitude e a sombra no solo sob o centro
        if (surfaceDropStalk) {
            const positions = new Float32Array([
                0, alt, 0,
                0, 0, 0
            ]);
            surfaceDropStalk.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            surfaceDropStalk.visible = (alt > 1.0);
        }

        if (surfaceShadowDisc) {
            surfaceShadowDisc.position.set(0, 0.02, 0);
            surfaceShadowDisc.visible = (alt > 1.0);
        }

        // 4. Baliza da Nave Estacionada:
        // Exibida apenas se o comandante estiver FORA da nave (a pé ou de SRV),
        // identificando onde a nave pousada ficou enquanto o jogador explora a pé.
        // A bordo da nave (em voo ou pousado), a baliza e linha de retorno ficam ocultas.
        if (surfaceLandingBeacon) {
            if (isOutsideShip) {
                const shipRel = getRelativeCoordsMeters(tdLat, tdLon, data.latitude, data.longitude, data.planetRadius);
                if (shipRel.dist <= 560.0) {
                    surfaceLandingBeacon.position.set(shipRel.x, 0, shipRel.z);
                } else {
                    const angle = Math.atan2(shipRel.x, -shipRel.z);
                    surfaceLandingBeacon.position.set(Math.sin(angle) * 560.0, 0, - Math.cos(angle) * 560.0);
                }
                surfaceLandingBeacon.visible = true;

                if (surfaceTetherLine) {
                    const bPos = surfaceLandingBeacon.position;
                    if (shipRel.dist > 4.0) {
                        const points = [
                            new THREE.Vector3(0, 0.05, 0),
                            new THREE.Vector3(bPos.x, 0.05, bPos.z)
                        ];
                        surfaceTetherLine.geometry.setFromPoints(points);
                        surfaceTetherLine.computeLineDistances();
                        surfaceTetherLine.visible = true;
                    } else {
                        surfaceTetherLine.visible = false;
                    }
                }
            } else {
                surfaceLandingBeacon.visible = false;
                if (surfaceTetherLine) surfaceTetherLine.visible = false;
            }
        }

        // 5. Câmera centralizada no jogador no modo tático
        if (surfaceControls && surfaceCamera && !userHasManuallyPannedCamera && !isUserInteractingWithCamera) {
            if (activeViewScale === 'TACTICAL') {
                surfaceControls.target.set(0, Math.min(alt * 0.3, 40), 0);
                surfaceCamera.position.set(0, Math.max(alt + 480, 480), 680);
                surfaceControls.update();
            }
        }

        // 9. Atualiza Modo de Escala e Zoom Dinâmico por Altitude apenas quando se mover
        updateViewScaleTransition(alt, data.inPlanetaryOrbit, data.landed, data.latitude, data.longitude, heading, { x: 0, z: 0 });

        lastRenderedPos = {
            x: 0,
            z: 0,
            latitude: data.latitude || 0,
            longitude: data.longitude || 0,
            altitude: alt,
            heading: heading,
            landed: data.landed,
            inSrv: data.inSrv,
            onFoot: data.onFoot,
            inPlanetaryOrbit: data.inPlanetaryOrbit
        };
    }

    // 6. Atualiza Elementos do HUD (Bússola e textos sempre atualizam conforme telemetria)
    updateCompassTape(heading);

    const locale = window.i18n ? window.i18n.getLocale() : 'en-US';
    const altEl = document.getElementById('surfaceAltitudeText');
    const stateEl = document.getElementById('surfaceFlightStateBadge');
    if (altEl) {
        altEl.textContent = `${Math.round(alt).toLocaleString(locale)} m`;
    }
    if (stateEl) {
        if (data.landed) {
            stateEl.textContent = data.inSrv ? surfaceTr('surface.state_landed_srv') : (data.onFoot ? surfaceTr('surface.state_landed_foot') : surfaceTr('surface.state_landed_ship'));
            stateEl.style.color = '#2bfca8';
            stateEl.style.background = 'rgba(43,252,168,0.2)';
        } else if (data.glideMode) {
            stateEl.textContent = surfaceTr('surface.state_glide');
            stateEl.style.color = '#ffaa00';
            stateEl.style.background = 'rgba(255,170,0,0.2)';
        } else {
            stateEl.textContent = surfaceTr('surface.state_flight');
            stateEl.style.color = '#00d4ff';
            stateEl.style.background = 'rgba(0,212,255,0.2)';
        }
    }

    // GPS
    const latEl = document.getElementById('surfaceLatText');
    const lonEl = document.getElementById('surfaceLonText');
    if (latEl) latEl.textContent = (data.latitude !== null && data.latitude !== undefined) ? `${data.latitude >= 0 ? '+' : ''}${data.latitude.toFixed(4)}°` : '---';
    if (lonEl) lonEl.textContent = (data.longitude !== null && data.longitude !== undefined) ? `${data.longitude >= 0 ? '+' : ''}${data.longitude.toFixed(4)}°` : '---';

    // Local de Pouso (se a bordo da nave pousada, distância é exatamente 0 metros)
    const tdCoordsEl = document.getElementById('surfaceTouchdownCoordsText');
    const distTdEl = document.getElementById('surfaceDistTouchdownText');
    if (tdCoordsEl) {
        tdCoordsEl.textContent = (tdLat !== null && tdLat !== undefined && tdLon !== null && tdLon !== undefined)
            ? `${tdLat >= 0 ? '+' : ''}${tdLat.toFixed(4)}°, ${tdLon >= 0 ? '+' : ''}${tdLon.toFixed(4)}°`
            : '---';
    }
    if (distTdEl) {
        const distMeters = isAboardLandedShip ? 0 : Math.round(data.distanceToTouchdown || 0);
        distTdEl.textContent = `${distMeters.toLocaleString(locale)} m`;
        if (distMeters >= 500) {
            distTdEl.style.color = '#2bfca8'; // Verde: seguro para amostra Stratum!
        } else {
            distTdEl.style.color = '#ffaa00'; // Âmbar: ainda dentro do raio da colônia
        }
    }

    // Telemetria do Topo (Ladeando a Bússola)
    const planetEl = document.getElementById('surfacePlanetName');
    const gravEl = document.getElementById('surfaceGravityText');
    const atmEl = document.getElementById('surfaceAtmosphereText');
    const pressEl = document.getElementById('surfacePressureText');

    if (planetEl) planetEl.textContent = data.bodyName || surfaceTr('surface.waiting_body');
    if (gravEl) gravEl.textContent = (data.surfaceGravity !== null && data.surfaceGravity !== undefined && data.surfaceGravity > 0)
        ? `${data.surfaceGravity.toFixed(2)} G`
        : '---';
    if (atmEl) {
        let atm = data.atmosphereType || surfaceTr('surface.no_atmosphere');
        if (atm.includes('(') && atm.includes('atm')) {
            const match = atm.match(/\(([^)]+)\)/);
            if (match && pressEl) {
                pressEl.textContent = match[1];
            }
            atm = atm.replace(/\s*\([^)]+\)/, '').trim();
        } else if (pressEl) {
            const lowerAtm = atm.toLowerCase();
            pressEl.textContent = (lowerAtm === 'none' || lowerAtm === 'no atmosphere' || lowerAtm.includes('sem atmosfera') || lowerAtm.includes('sin atmósfera') || lowerAtm.includes('vácuo'))
                ? '0.00 atm'
                : '---';
        }
        atmEl.textContent = atm;
    }

    // 7. Atualiza Exobiologia (Balizas, Círculos de Colônia e Hodômetro)
    updateBioTelemetry(data, moved);

    // 8. Atualiza Elementos de Solo (Colônias, Portos, Geo, POIs)
    updateSurfaceFeatures(data, moved);
}

// Cria a baliza 3D de uma amostra biológica e seu anel de exclusão de colônia
function createBioSampleBeacon(sample, pos) {
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);

    // 1. Octaedro / Diamante Esmeralda Flutuante a 3.5m de altura
    const diamondGeo = new THREE.OctahedronGeometry(1.8, 0);
    const diamondMat = new THREE.MeshBasicMaterial({
        color: 0x00ffaa,
        wireframe: true,
        transparent: true,
        opacity: 0.95
    });
    const diamondMesh = new THREE.Mesh(diamondGeo, diamondMat);
    diamondMesh.position.y = 3.5;
    diamondMesh.name = 'bioDiamond';
    group.add(diamondMesh);

    // Núcleo luminoso esférico interno
    const coreGeo = new THREE.SphereGeometry(0.7, 12, 8);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x2bfca8 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 3.5;
    group.add(coreMesh);

    // 2. Haste luminosa vertical de ancoragem no solo
    const postGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 3.5, 0)
    ]);
    const postMat = new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.75 });
    group.add(new THREE.Line(postGeo, postMat));

    // 3. Disco no solo indicando o epicentro do escaneamento
    const baseRingGeo = new THREE.RingGeometry(2.2, 3.0, 24);
    const baseRingMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const baseRingMesh = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRingMesh.rotation.x = Math.PI / 2;
    baseRingMesh.position.y = 0.03;
    group.add(baseRingMesh);

    // 4. Anel Holográfico de Exclusão de Colônia (raio mínimo genético, ex: 500m)
    const colonyRadius = sample.minColonyDistance || 500.0;
    const ringGeo = new THREE.RingGeometry(colonyRadius - 0.6, colonyRadius + 0.6, 96);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ffaa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45
    });
    const colonyRing = new THREE.Mesh(ringGeo, ringMat);
    colonyRing.name = 'colonyRing';
    colonyRing.rotation.x = Math.PI / 2;
    colonyRing.position.y = 0.04;
    group.add(colonyRing);

    // Disco translúcido sutil para visualização da área de exclusão no solo
    const discGeo = new THREE.CircleGeometry(colonyRadius, 48);
    const discMat = new THREE.MeshBasicMaterial({
        color: 0x00ffaa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.04
    });
    const colonyDisc = new THREE.Mesh(discGeo, discMat);
    colonyDisc.name = 'colonyDisc';
    colonyDisc.rotation.x = Math.PI / 2;
    colonyDisc.position.y = 0.02;
    group.add(colonyDisc);

    // Rótulo da espécie
    const label = createTextSprite(`🌿 ${sample.species || surfaceTr('surface.bio_sample_default')}`, '#00ffaa', 10);
    label.name = 'bioLabel';
    label.position.set(0, 7.0, 0);
    group.add(label);

    group.userData = { sample: sample, colonyRadius: colonyRadius };
    return group;
}

let lastAnnouncedSampleKey = null;
let wasOutsideSampleArea = null;

function isSurfaceAudioEnabled() {
    try {
        return localStorage.getItem('elite_explorer_traffic_audio') !== '0';
    } catch (_) {
        return true;
    }
}

function speakSurfaceAlert(text) {
    if (!text || !isSurfaceAudioEnabled() || !('speechSynthesis' in window)) return;
    try {
        const locale = window.i18n ? window.i18n.getLocale() : 'en-US';
        window.speechSynthesis.cancel();
        if (typeof window.speechSynthesis.resume === 'function') {
            window.speechSynthesis.resume();
        }
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = locale;
        const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
        const langPrefix = locale.split('-')[0].toLowerCase();
        const matchVoice = voices.find(v => v.lang && v.lang.toLowerCase() === locale.toLowerCase())
            || voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
        if (matchVoice) utter.voice = matchVoice;
        utter.rate = 1.05;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        window.speechSynthesis.speak(utter);
    } catch (e) {
        console.warn('Erro na síntese de voz:', e);
    }
}

// Atualiza marcadores 3D das bio-amostras, raio de colônia e hodômetro de diversidade
function updateBioTelemetry(data, moved) {
    const samples = data.activeBioSamples || [];
    const count = samples.length;
    const lastSample = data.lastBioSample;
    const distToLast = data.distanceToLastBioSample;
    const diversityReached = data.geneticDiversityReached;

    if (surfaceBioGroup) {
        // 1. Reconstruir balizas 3D e anéis de colônia apenas se a contagem mudou
        if (count !== lastRenderedBioCount) {
            lastRenderedBioCount = count;
            surfaceBioGroup.clear();

            samples.forEach(sample => {
                const rel = getRelativeCoordsMeters(sample.latitude, sample.longitude, data.latitude, data.longitude, data.planetRadius);
                const beacon = createBioSampleBeacon(sample, rel);
                surfaceBioGroup.add(beacon);
            });
        }

        // 2. Atualiza a posição no chão de cada baliza de amostra relativa à nave/jogador
        // Se estiver além do horizonte de 560m, projeta a baliza na borda do radar para manter visível a direção
        surfaceBioGroup.children.forEach(beacon => {
            const sample = beacon.userData.sample;
            if (!sample) return;
            const rel = getRelativeCoordsMeters(sample.latitude, sample.longitude, data.latitude, data.longitude, data.planetRadius);
            const isBeyondHorizon = rel.dist > 560.0;
            if (!isBeyondHorizon) {
                beacon.position.set(rel.x, 0, rel.z);
            } else {
                const angle = Math.atan2(rel.x, -rel.z);
                beacon.position.set(Math.sin(angle) * 560.0, 0, -Math.cos(angle) * 560.0);
            }

            const colonyRadius = beacon.userData.colonyRadius || 500.0;
            const insideColony = rel.dist < colonyRadius;
            const ringColor = insideColony ? 0xffaa00 : 0x00ffaa;

            const colonyRing = beacon.getObjectByName('colonyRing');
            if (colonyRing && colonyRing.material) colonyRing.material.color.setHex(ringColor);

            const colonyDisc = beacon.getObjectByName('colonyDisc');
            if (colonyDisc && colonyDisc.material) colonyDisc.material.color.setHex(ringColor);
        });
    }

    // 3. Linha Guia Dinâmica do Hodômetro (Player no centro -> Última Amostra)
    if (surfaceBioTetherLine) {
        if (lastSample && count < 3) {
            const lastRel = getRelativeCoordsMeters(lastSample.latitude, lastSample.longitude, data.latitude, data.longitude, data.planetRadius);
            let targetX = lastRel.x;
            let targetZ = lastRel.z;

            // Se a amostra estiver além do horizonte de 560m do radar, projeta a linha até a borda
            if (lastRel.dist > 560.0) {
                const angle = Math.atan2(lastRel.x, -lastRel.z);
                targetX = Math.sin(angle) * 560.0;
                targetZ = - Math.cos(angle) * 560.0;
            }

            const points = [
                new THREE.Vector3(0, 0.05, 0),
                new THREE.Vector3(targetX, 0.05, targetZ)
            ];
            surfaceBioTetherLine.geometry.setFromPoints(points);
            surfaceBioTetherLine.computeLineDistances();

            // Cor e opacidade dinâmica: Verde se diversidade alcançada, âmbar se dentro da colônia
            const isDiversity = (diversityReached || lastRel.dist >= (lastSample.minColonyDistance || 500.0));
            surfaceBioTetherLine.material.color.setHex(isDiversity ? 0x00ffaa : 0xffaa00);
            surfaceBioTetherLine.material.opacity = 0.85;
            surfaceBioTetherLine.visible = true;
        } else {
            surfaceBioTetherLine.visible = false;
        }
    }

    // 3. Atualizar Elementos do HUD de Exobiologia
    const pillEl = document.getElementById('bioSamplePill');
    if (pillEl) {
        pillEl.textContent = `${count} / 3`;
        if (count === 3) {
            pillEl.style.color = '#00ffaa';
            pillEl.style.borderColor = '#00ffaa';
            pillEl.style.background = 'rgba(0,255,170,0.25)';
        } else if (count > 0) {
            pillEl.style.color = '#2bfca8';
            pillEl.style.borderColor = 'rgba(43,252,168,0.5)';
            pillEl.style.background = 'rgba(43,252,168,0.15)';
        } else {
            pillEl.style.color = '#8da4be';
            pillEl.style.borderColor = 'rgba(255,255,255,0.15)';
            pillEl.style.background = 'rgba(255,255,255,0.05)';
        }
    }

    // Slots 1, 2, 3
    for (let i = 1; i <= 3; i++) {
        const slotEl = document.getElementById(`bioSlot${i}`);
        const statusEl = document.getElementById(`bioSlot${i}Status`);
        if (slotEl && statusEl) {
            if (i <= count) {
                statusEl.textContent = surfaceTr('surface.bio_collected');
                statusEl.style.color = '#00ffaa';
                slotEl.style.borderColor = 'rgba(0,255,170,0.6)';
                slotEl.style.background = 'rgba(0,255,170,0.15)';
            } else {
                statusEl.textContent = surfaceTr('surface.bio_pending');
                statusEl.style.color = '#557088';
                slotEl.style.borderColor = 'rgba(255,255,255,0.08)';
                slotEl.style.background = 'rgba(255,255,255,0.03)';
            }
        }
    }

    // Nome da Espécie e Gênero
    const speciesEl = document.getElementById('bioSpeciesText');
    if (speciesEl) {
        if (lastSample && lastSample.species) {
            speciesEl.textContent = lastSample.species;
            speciesEl.style.color = '#00ffaa';
        } else {
            speciesEl.textContent = surfaceTr('surface.bio_waiting_sample');
            speciesEl.style.color = '#8da4be';
        }
    }

    // Distância da Colônia e Hodômetro
    const distEl = document.getElementById('bioDistanceText');
    const barEl = document.getElementById('bioDiversityProgressBar');
    const bannerEl = document.getElementById('bioStatusBanner');

    if (distEl && barEl && bannerEl) {
        const locale = window.i18n ? window.i18n.getLocale() : 'en-US';
        if (count === 0) {
            distEl.textContent = '---';
            barEl.style.width = '0%';
            bannerEl.textContent = surfaceTr('surface.bio_waiting_scan');
            bannerEl.style.color = '#8da4be';
            bannerEl.style.background = 'rgba(255,255,255,0.05)';
            lastAnnouncedSampleKey = null;
            wasOutsideSampleArea = null;
        } else if (count >= 3) {
            distEl.textContent = surfaceTr('surface.bio_completed');
            distEl.style.color = '#00ffaa';
            barEl.style.width = '100%';
            barEl.style.background = '#00ffaa';
            bannerEl.textContent = surfaceTr('surface.bio_success_banner');
            bannerEl.style.color = '#00ffaa';
            bannerEl.style.background = 'rgba(0,255,170,0.2)';
            lastAnnouncedSampleKey = null;
            wasOutsideSampleArea = null;
        } else if (lastSample) {
            const minColony = lastSample.minColonyDistance || 500.0;
            const currentDist = (distToLast !== null && distToLast !== undefined) ? distToLast : 0;
            const distMeters = Math.round(currentDist);
            const reqMeters = Math.round(minColony);

            distEl.textContent = `${distMeters.toLocaleString(locale)} m / ${reqMeters} m`;

            const pct = Math.min(100, Math.max(0, Math.round((currentDist / minColony) * 100)));
            barEl.style.width = `${pct}%`;

            const isOutsideArea = !!(diversityReached || currentDist >= minColony);
            const sampleKey = `${lastSample.sampleNumber}_${lastSample.timestamp || ''}`;
            if (lastAnnouncedSampleKey !== sampleKey) {
                lastAnnouncedSampleKey = sampleKey;
                wasOutsideSampleArea = isOutsideArea;
            } else {
                if (!wasOutsideSampleArea && isOutsideArea) {
                    speakSurfaceAlert(surfaceTr('surface.bio_leaving_area_voice'));
                }
                wasOutsideSampleArea = isOutsideArea;
            }

            if (isOutsideArea) {
                distEl.style.color = '#00ffaa';
                barEl.style.background = '#00ffaa';
                bannerEl.textContent = surfaceTr('surface.bio_ready_banner', distMeters, count + 1);
                bannerEl.style.color = '#00ffaa';
                bannerEl.style.background = 'rgba(0,255,170,0.2)';
            } else {
                distEl.style.color = '#ffaa00';
                barEl.style.background = '#ffaa00';
                const remaining = Math.max(0, reqMeters - distMeters);
                bannerEl.textContent = surfaceTr('surface.bio_inside_banner', distMeters, remaining);
                bannerEl.style.color = '#ffaa00';
                bannerEl.style.background = 'rgba(255,170,0,0.15)';
            }
        }
    }

}

// Atualiza os marcadores de elementos em solo na grade global, radar tático e lista no HUD
function updateSurfaceFeatures(data, moved) {
    if (!surfaceFeaturesMarkersGroup) return;

    const features = data.surfaceFeatures || [];
    const locatedFeatures = features.filter(f =>
        f.gpsConfirmed !== false &&
        f.latitude !== null && f.latitude !== undefined &&
        f.longitude !== null && f.longitude !== undefined
    );
    const featuresKey = locatedFeatures.map(f => `${f.id || f.name}:${f.latitude}:${f.longitude}`).join('|');

    // 1. Atualiza os Marcadores 3D na Grade Global (-180° a +180°) apenas para elementos com GPS confirmado
    if (featuresKey !== lastRenderedFeaturesKey) {
        lastRenderedFeaturesKey = featuresKey;
        surfaceFeaturesMarkersGroup.clear();
        locatedFeatures.forEach(f => {
            const marker = createSurfaceFeatureMarker(f);
            surfaceFeaturesMarkersGroup.add(marker);
        });
    }

    // 1b. Atualiza elementos no Modo Tático de Solo (apenas elementos com GPS confirmado: no solo se <= 560m, ou na borda se > 560m)
    if (surfaceTacticalHorizonGroup && (moved || featuresKey !== lastRenderedTacticalFeaturesKey || surfaceTacticalHorizonGroup.children.length === 0)) {
        lastRenderedTacticalFeaturesKey = featuresKey;
        surfaceTacticalHorizonGroup.clear();

        locatedFeatures.forEach(f => {
            const rel = getRelativeCoordsMeters(f.latitude, f.longitude, data.latitude, data.longitude, data.planetRadius);
            const distKm = (rel.dist / 1000).toFixed(1);

            let col = 0x00d4ff;
            let icon = '🏢';
            if (f.type === 'EXTRACTION') { col = 0xffaa00; icon = '⛏️'; }
            else if (f.type === 'CRASH_SITE') { col = 0xff3311; icon = '💥'; }
            else if (f.type === 'DISTRESS_BEACON') { col = 0xffee22; icon = '📡'; }
            else if (f.type === 'RESEARCH') { col = 0x00e5ff; icon = '🔬'; }
            else if (f.type === 'AGRICULTURE') { col = 0x76ff03; icon = '🌾'; }
            else if (f.type === 'MILITARY') { col = 0xff1744; icon = '🎖️'; }
            else if (f.type === 'PORT') { col = 0x00b0ff; icon = '🚀'; }
            else if (f.type === 'GEO_SITE') { col = 0xff6d00; icon = '🌋'; }
            else if (f.type === 'GUARDIAN' || f.type === 'EXPLORATION_POI') { col = 0xd500f9; icon = '🏛️'; }

            const bGroup = new THREE.Group();

            if (rel.dist <= 560.0) {
                // ELEMENTO DENTRO DO ALCANCE DO RADAR (0 a 560m):
                // Posicionado no chão no local real relativo à nave
                bGroup.position.set(rel.x, 0, rel.z);

                // Marcador 3D no solo (torre / estrutura miniatura)
                const baseGeo = new THREE.CylinderGeometry(2, 4, 8, 6);
                const baseMat = new THREE.MeshBasicMaterial({ color: col, wireframe: true });
                const baseMesh = new THREE.Mesh(baseGeo, baseMat);
                baseMesh.position.y = 4;
                bGroup.add(baseMesh);

                const ringGeo = new THREE.RingGeometry(4, 6, 16);
                const ringMat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
                const ringMesh = new THREE.Mesh(ringGeo, ringMat);
                ringMesh.rotation.x = Math.PI / 2;
                ringMesh.position.y = 0.1;
                bGroup.add(ringMesh);

                const label = createTextSprite(`${icon} ${f.name} (${Math.round(rel.dist)}m)`, '#' + col.toString(16).padStart(6, '0'), 10);
                label.position.set(0, 14, 0);
                bGroup.add(label);
            } else {
                // ELEMENTO FORA DO ALCANCE (> 560m):
                // Projetado na borda/perímetro do radar (raio 560 metros)
                const angle = Math.atan2(rel.x, -rel.z);
                const hx = Math.sin(angle) * 560.0;
                const hz = - Math.cos(angle) * 560.0;

                bGroup.position.set(hx, 0, hz);

                // Haste vertical de horizonte
                const hGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0, 20, 0)
                ]);
                const hMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.65 });
                bGroup.add(new THREE.Line(hGeo, hMat));

                // Indicador em cone/seta apontando na direção do elemento
                const ptrGeo = new THREE.ConeGeometry(2.5, 6, 4);
                const ptrMesh = new THREE.Mesh(ptrGeo, new THREE.MeshBasicMaterial({ color: col }));
                ptrMesh.position.y = 20;
                ptrMesh.rotation.y = - angle;
                bGroup.add(ptrMesh);

                // Sprite com nome e distância em km
                const label = createTextSprite(`${icon} ${f.name} (${distKm}km)`, '#' + col.toString(16).padStart(6, '0'), 10);
                label.position.set(0, 28, 0);
                bGroup.add(label);
            }

            surfaceTacticalHorizonGroup.add(bGroup);
        });

        // Se temos última amostra biológica ativa e ela está a mais de 560m, adiciona indicador na borda também!
        if (data.lastBioSample && (data.activeBioSamples || []).length < 3) {
            const lastBio = data.lastBioSample;
            const bRel = getRelativeCoordsMeters(lastBio.latitude, lastBio.longitude, data.latitude, data.longitude, data.planetRadius);
            if (bRel.dist > 560.0) {
                const angle = Math.atan2(bRel.x, -bRel.z);
                const hx = Math.sin(angle) * 560.0;
                const hz = - Math.cos(angle) * 560.0;
                const distKm = (bRel.dist / 1000).toFixed(1);

                const bioPGroup = new THREE.Group();
                bioPGroup.position.set(hx, 0, hz);

                const hGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0, 22, 0)
                ]);
                const isDiv = data.geneticDiversityReached || bRel.dist >= (lastBio.minColonyDistance || 500.0);
                const bCol = isDiv ? 0x00ffaa : 0xffaa00;

                bioPGroup.add(new THREE.Line(hGeo, new THREE.LineBasicMaterial({ color: bCol, transparent: true, opacity: 0.8 })));

                const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(2.5, 0), new THREE.MeshBasicMaterial({ color: bCol, wireframe: true }));
                diamond.position.y = 22;
                diamond.name = 'bioDiamond';
                bioPGroup.add(diamond);

                const label = createTextSprite(`🌿 ${lastBio.species || 'Amostra Bio'} (${distKm}km)`, isDiv ? '#00ffaa' : '#ffaa00', 10);
                label.position.set(0, 30, 0);
                bioPGroup.add(label);

                surfaceTacticalHorizonGroup.add(bioPGroup);
            }
        }
    }
}

// Transição dinâmica de escala por altitude (Órbita -> Descida -> Solo Tático)
function updateViewScaleTransition(alt, inPlanetaryOrbit, landed, lat, lon, heading, currentPos) {
    lastReportedAltitude = alt;

    // Atualiza o Marcador da Nave no Mapa Global
    if (globalShipMarker) {
        const gx = (lon / 180.0) * 900.0;
        const gz = - (lat / 90.0) * 450.0;
        // Altura no mapa global proporcional à altitude orbital
        const gy = Math.min(Math.max(alt * 0.005, 2.0), 120.0);
        globalShipMarker.position.set(gx, gy, gz);
        globalShipMarker.rotation.y = - (heading * Math.PI / 180);

        const stalk = globalShipMarker.getObjectByName('globalStalk');
        if (stalk) {
            const positions = new Float32Array([
                0, 0, 0,
                0, -gy, 0
            ]);
            stalk.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        }
    }

    // Determina a escala alvo
    let targetScale = 'TACTICAL';

    if (currentViewMode === 'GLOBAL') {
        targetScale = 'GLOBAL';
    } else if (currentViewMode === 'TACTICAL') {
        targetScale = 'TACTICAL';
    } else {
        // MODO AUTO:
        // Se altitude >= 8.000m ou em órbita planetária sem estar pousado:
        if (alt >= 8000 || (inPlanetaryOrbit && !landed && alt > 3000)) {
            targetScale = 'GLOBAL';
        } else {
            targetScale = 'TACTICAL';
        }
    }

    // Se mudou de escala:
    if (targetScale !== activeViewScale) {
        activeViewScale = targetScale;

        if (activeViewScale === 'GLOBAL') {
            if (surfaceGlobalGroup) surfaceGlobalGroup.visible = true;
            if (surfaceTacticalGroup) surfaceTacticalGroup.visible = false;

            // Transiciona a câmera para a visão panorâmica do mapa mundi planetário
            if (surfaceCamera && surfaceControls) {
                surfaceCamera.position.set(0, 1150, 750);
                surfaceControls.target.set(0, 0, 0);
                surfaceControls.update();
            }
        } else {
            // TACTICAL
            if (surfaceGlobalGroup) surfaceGlobalGroup.visible = false;
            if (surfaceTacticalGroup) surfaceTacticalGroup.visible = true;

            // Retorna o enquadramento tático local centrado no jogador/nave no centro (0, 0)
            if (surfaceCamera && surfaceControls) {
                const a = Math.max(0, lastSurfaceData.altitude || 0.0);
                surfaceControls.target.set(0, Math.min(a * 0.3, 40), 0);
                surfaceCamera.position.set(0, Math.max(a + 480, 480), 680);
                surfaceControls.update();
            }
        }
    }
}

// Alternância manual de modo de zoom / escala
function setViewMode(mode) {
    currentViewMode = mode;

    const btnGlobal = document.getElementById('btnZoomGlobal');
    const btnTactical = document.getElementById('btnZoomTactical');
    const btnAuto = document.getElementById('btnZoomAuto');

    if (btnGlobal) {
        btnGlobal.style.borderColor = mode === 'GLOBAL' ? '#00d4ff' : 'rgba(255,255,255,0.2)';
        btnGlobal.style.color = mode === 'GLOBAL' ? '#00d4ff' : '#8da4be';
        btnGlobal.style.background = mode === 'GLOBAL' ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.05)';
    }
    if (btnTactical) {
        btnTactical.style.borderColor = mode === 'TACTICAL' ? '#2bfca8' : 'rgba(255,255,255,0.2)';
        btnTactical.style.color = mode === 'TACTICAL' ? '#2bfca8' : '#8da4be';
        btnTactical.style.background = mode === 'TACTICAL' ? 'rgba(43,252,168,0.25)' : 'rgba(255,255,255,0.05)';
    }
    if (btnAuto) {
        btnAuto.style.borderColor = mode === 'AUTO' ? '#2bfca8' : 'rgba(255,255,255,0.2)';
        btnAuto.style.color = mode === 'AUTO' ? '#2bfca8' : '#8da4be';
        btnAuto.style.background = mode === 'AUTO' ? 'rgba(43,252,168,0.25)' : 'rgba(255,255,255,0.05)';
    }

    // Força atualização imediata
    activeViewScale = ''; // reseta para forçar a transição
    updateViewScaleTransition(lastReportedAltitude, lastSurfaceData.inPlanetaryOrbit, lastSurfaceData.landed, lastSurfaceData.latitude, lastSurfaceData.longitude, lastSurfaceData.heading, { x: 0, z: 0 });
}

// Foca a câmera em um elemento de solo específico
function focusOnFeatureCoords(lat, lon, name) {
    setViewMode('GLOBAL');

    const gx = (lon / 180.0) * 900.0;
    const gz = - (lat / 90.0) * 450.0;

    if (surfaceCamera && surfaceControls) {
        surfaceControls.target.set(gx, 0, gz);
        surfaceCamera.position.set(gx, 350, gz + 400);
        surfaceControls.update();
    }
    console.log(`🎯 [HUD] Focando câmera no elemento de solo: ${name} [Lat: ${lat}, Lon: ${lon}]`);
}

// Alterna entre a visão do Cubo Galáctico 3D e o HUD 2.5D Columbus View
function showSurfaceView() {
    const cubeView = document.getElementById('viewport-container');
    const surfaceView = document.getElementById('surface-navigator-view');
    const btnSwitch = document.getElementById('btnSwitchToSurface');

    if (cubeView) cubeView.style.display = 'none';
    if (surfaceView) surfaceView.style.display = 'block';
    if (btnSwitch) {
        btnSwitch.innerHTML = `🪐 ${surfaceTr('nav.surface')}`;
        btnSwitch.style.borderColor = '#2bfca8';
        btnSwitch.style.background = 'rgba(43,252,168,0.25)';
    }

    isSurfaceViewActive = true;
    userManuallyClosedSurface = false;

    // Inicializa Three.js da superfície no primeiro acionamento
    if (!surfaceScene) {
        initSurface3D();
    } else {
        onSurfaceResize();
        recenterCameraOnShip();
    }

    updateSurfaceTelemetry(lastSurfaceData);
}

function hideSurfaceView() {
    const cubeView = document.getElementById('viewport-container');
    const surfaceView = document.getElementById('surface-navigator-view');
    const btnSwitch = document.getElementById('btnSwitchToSurface');

    if (surfaceView) surfaceView.style.display = 'none';
    if (cubeView) cubeView.style.display = 'block';

    if (window.location.search.includes('view=surface')) {
        try { history.replaceState(null, '', '/index.html'); } catch (e) {}
    }

    isSurfaceViewActive = false;
    userManuallyClosedSurface = true;

    if (btnSwitch && lastSurfaceData) {
        const isNearSurface = checkIsNearSurface(lastSurfaceData);
        if (isNearSurface) {
            btnSwitch.disabled = false;
            btnSwitch.style.opacity = '1.0';
            btnSwitch.style.cursor = 'pointer';
            btnSwitch.style.pointerEvents = 'auto';
            btnSwitch.innerHTML = `🪐 ${surfaceTr('nav.surface')}`;
            btnSwitch.style.borderColor = 'rgba(43,252,168,0.5)';
            btnSwitch.style.background = 'rgba(43,252,168,0.12)';
        }
    }
}

function checkIsNearSurface(data) {
    if (!data) return false;
    if (data.docked && !data.landed) return false;
    return !!(
        data.onPlanetSurface || 
        data.landed || 
        data.glideMode || 
        data.inPlanetaryOrbit || 
        data.onFoot ||
        data.inSrv
    );
}

let wasNearSurfaceState = false;
let nearSurfaceFalseCounter = 0;

function handleSurfaceDataUpdate(data) {
    if (!data) return;
    updateSurfaceTelemetry(data);

    // Controle de Acesso ao Botão de Superfície: Apenas liberado se estiver em planeta
    const btnSwitch = document.getElementById('btnSwitchToSurface');
    const isNearSurface = checkIsNearSurface(data);

    if (btnSwitch) {
        btnSwitch.innerHTML = `🪐 ${surfaceTr('nav.surface')}`;
        if (isNearSurface) {
            btnSwitch.disabled = false;
            btnSwitch.style.opacity = '1.0';
            btnSwitch.style.cursor = 'pointer';
            btnSwitch.style.pointerEvents = 'auto';
            btnSwitch.title = surfaceTr('nav.surface_active_title', data.bodyName || data.planetName || surfaceTr('nav.surface').toLowerCase());
            if (isSurfaceViewActive) {
                btnSwitch.style.borderColor = '#2bfca8';
                btnSwitch.style.background = 'rgba(43,252,168,0.25)';
            } else {
                btnSwitch.style.borderColor = 'rgba(43,252,168,0.5)';
                btnSwitch.style.background = 'rgba(43,252,168,0.12)';
            }
        } else {
            btnSwitch.disabled = true;
            btnSwitch.style.opacity = '0.35';
            btnSwitch.style.cursor = 'not-allowed';
            btnSwitch.style.pointerEvents = 'none';
            btnSwitch.title = surfaceTr('nav.surface_disabled_title');
        }
    }

    // ATIVAÇÃO COMPULSÓRIA AUTOMÁTICA:
    // Se o jogador ingressar no planeta (superfície/órbita/glide) e ainda não fechou manualmente:
    if (isNearSurface && !isSurfaceViewActive && !userManuallyClosedSurface) {
        console.log("🪐 [HUD] Ativação compulsória do Modo Superfície 2.5D Columbus View detectada.");
        showSurfaceView();
        autoSwitchedToSurface = true;
    }

    // RETORNO AO ORRERY AO SAIR DO PLANETA:
    // Debounce de 3 ciclos consecutivos longe do planeta para evitar trocas falsas no drop do glide
    if (!isNearSurface) {
        nearSurfaceFalseCounter++;
        if (nearSurfaceFalseCounter >= 3 && (isSurfaceViewActive || wasNearSurfaceState)) {
            console.log("🪐 [HUD] Nave saiu do planeta e retornou ao espaço livre. Redirecionando para o Sistema 3D (Orrery)...");
            wasNearSurfaceState = false;
            isSurfaceViewActive = false;
            autoSwitchedToSurface = false;
            userManuallyClosedSurface = false;
            nearSurfaceFalseCounter = 0;
            window.location.href = '/system-orrery.html';
            return;
        }
    } else {
        nearSurfaceFalseCounter = 0;
    }

    wasNearSurfaceState = isNearSurface;
}

// Polling suave como heartbeat/fallback
async function pollSurfaceTelemetry() {
    try {
        const res = await fetch('/api/player/surface-status');
        if (!res.ok) return;
        const data = await res.json();
        handleSurfaceDataUpdate(data);
    } catch (e) {
        // Silencioso
    }
}

// Conexão SSE reativa em tempo real para a tela de superfície
function setupSurfaceSseListener() {
    if (!window.EventSource) return;
    try {
        const evtSource = new EventSource('/api/events/stream');

        evtSource.addEventListener('surface_status', (e) => {
            try {
                const data = JSON.parse(e.data);
                handleSurfaceDataUpdate(data);
            } catch (err) {
                console.error("Erro ao processar SSE surface_status:", err);
            }
        });

        evtSource.addEventListener('system_jump', (e) => {
            try {
                const data = JSON.parse(e.data);
                console.log("🚀 [SSE EVENT] Salto de sistema detectado:", data.system);
                if (isSurfaceViewActive || wasNearSurfaceState) {
                    window.location.href = '/system-orrery.html';
                }
            } catch (err) {}
        });
    } catch (err) {
        console.warn("Falha ao iniciar SSE em surface:", err);
    }
}

// Event Listeners dos botões de controle e inicialização
function initSurfaceNavigator() {
    const btnSwitch = document.getElementById('btnSwitchToSurface');
    const btnBack = document.getElementById('btnBackToGalaxy');

    if (btnSwitch) {
        btnSwitch.addEventListener('click', () => {
            if (isSurfaceViewActive) {
                hideSurfaceView();
            } else {
                showSurfaceView();
            }
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            hideSurfaceView();
        });
    }

    // Botões de Escala / Zoom
    const btnGlobal = document.getElementById('btnZoomGlobal');
    const btnTactical = document.getElementById('btnZoomTactical');
    const btnAuto = document.getElementById('btnZoomAuto');

    if (btnGlobal) {
        btnGlobal.addEventListener('click', () => setViewMode('GLOBAL'));
    }
    if (btnTactical) {
        btnTactical.addEventListener('click', () => setViewMode('TACTICAL'));
    }
    if (btnAuto) {
        btnAuto.addEventListener('click', () => setViewMode('AUTO'));
    }

    const btnRecenter = document.getElementById('btnRecenterShip');
    if (btnRecenter) {
        btnRecenter.addEventListener('click', recenterCameraOnShip);
    }

    // Inicia stream SSE reativo instantâneo e polling de suporte
    setupSurfaceSseListener();
    setInterval(pollSurfaceTelemetry, 2500);
    pollSurfaceTelemetry();

    window.addEventListener('elite:languageChanged', () => {
        updateLandingBeaconLabel();
        if (lastSurfaceData) {
            handleSurfaceDataUpdate(lastSurfaceData);
        }
    });

    // Se a página foi aberta com ?view=surface, abre a visão de superfície
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'surface') {
        showSurfaceView();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSurfaceNavigator);
} else {
    initSurfaceNavigator();
}
