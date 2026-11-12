/**
 * Elite Dangerous - Mapa 3D do Sistema Estelar (Orrery 3D)
 * Simulação Kepleriana Estática e Condizente com a Orientação Real do Jogo
 */

const tr = (key, ...args) => (window.t ? window.t(key, ...args) : key);

let scene, camera, renderer, controls;
let systemData = null;
let celestialBodies = [];
let celestialObjectsGroup = null;
let orbitsGroup = null;
let selectedBodyData = null;
let focusedObject = null;
let lastKnownPlayerSystem = null;
let lastOrrerySurfaceNear = null;
let lastOrrerySurfaceData = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function startOrrery() {
    if (window.i18n) {
        document.title = tr('orrery.title');
    }

    initThreeScene();
    setupEventListeners();

    window.addEventListener('elite:languageChanged', () => {
        document.title = tr('orrery.title');
        if (lastOrrerySurfaceData) {
            handleOrrerySurfaceEvent(lastOrrerySurfaceData);
        }
        if (systemData) {
            updateOrreryHeaderBadges(systemData);
            const bodies = systemData.bodies || [];
            if (bodies.length === 0) {
                const loadingText = document.getElementById('loadingStatusText');
                if (loadingText) {
                    loadingText.innerHTML = tr('orrery.unmapped_msg', systemData.systemName || tr('galaxy.system_label'));
                }
            }
        }
        if (selectedBodyData) {
            showBodyDetails(selectedBodyData);
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const systemParam = urlParams.get('system');

    loadSystemOrrery(systemParam);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startOrrery);
} else {
    startOrrery();
}

function initThreeScene() {
    const container = document.getElementById('orrery-viewport');
    const canvas = document.getElementById('orrery-canvas');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020712);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 60000);
    camera.position.set(0, 320, 550);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 25000;
    controls.minDistance = 3;

    celestialObjectsGroup = new THREE.Group();
    orbitsGroup = new THREE.Group();
    scene.add(orbitsGroup);
    scene.add(celestialObjectsGroup);

    // Iluminação Ambiente
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    createStarfield();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onCanvasClick);

    checkSurfaceAvailability();
    setInterval(checkSurfaceAvailability, 5000);

    checkPlayerSystemChange();
    setInterval(checkPlayerSystemChange, 3000);

    setupSseEventListener();

    animate();
}

// Conexão reativa via Server-Sent Events (SSE) para receber eventos instantâneos do Journal
function setupSseEventListener() {
    if (!window.EventSource) return;
    try {
        const evtSource = new EventSource('/api/events/stream');

        // Salto FSD / Mudança de sistema estelar empurrado pelo backend
        evtSource.addEventListener('system_jump', (e) => {
            try {
                const data = JSON.parse(e.data);
                const newSys = data.system;
                if (newSys && (!lastKnownPlayerSystem || newSys.toLowerCase() !== lastKnownPlayerSystem.toLowerCase())) {
                    console.log(`🚀 [SSE EVENT] Salto FSD recebido via Push: ${newSys}! Atualizando Orrery imediatamente...`);
                    lastKnownPlayerSystem = newSys;
                    loadSystemOrrery(newSys);
                }
            } catch (err) {
                console.error("Erro ao processar system_jump via SSE:", err);
            }
        });

        // Novo corpo celeste escaneado no sistema (FSS / DSS / Scan)
        evtSource.addEventListener('system_body_scanned', (e) => {
            try {
                const data = JSON.parse(e.data);
                console.log(`🪐 [ORRERY SSE] Novo corpo escaneado em ${data.system}: ${data.body} (${data.total} corpos). Atualizando mapa 3D...`);
                if (data.system && (!lastKnownPlayerSystem || data.system.toLowerCase() === lastKnownPlayerSystem.toLowerCase())) {
                    loadSystemOrrery(data.system);
                }
            } catch (err) {
                console.error("Erro ao processar system_body_scanned via SSE:", err);
            }
        });

        // Transição de aproximação / saída planetária empurrada pelo backend
        evtSource.addEventListener('surface_status', (e) => {
            try {
                const data = JSON.parse(e.data);
                handleOrrerySurfaceEvent(data);
            } catch (err) {
                console.error("Erro ao processar surface_status via SSE:", err);
            }
        });

        evtSource.onerror = () => {
            // Reconexão automática em caso de desconexão momentânea
        };
    } catch (err) {
        console.warn("SSE não suportado ou falhou na inicialização:", err);
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

function handleOrrerySurfaceEvent(data) {
    if (!data) return;
    lastOrrerySurfaceData = data;
    const surfaceBtn = document.getElementById('btnOrrerySurfaceLink');
    const surfaceText = document.getElementById('btnOrrerySurfaceText');
    const isNearSurface = checkIsNearSurface(data);

    if (surfaceBtn) {
        if (isNearSurface) {
            surfaceBtn.classList.remove('disabled');
            surfaceBtn.style.pointerEvents = 'auto';
            surfaceBtn.style.opacity = '1.0';
            surfaceBtn.style.cursor = 'pointer';
            surfaceBtn.title = tr('nav.orrery_surface_title', data.bodyName || data.planetName || tr('nav.surface').toLowerCase());
            if (surfaceText) surfaceText.textContent = tr('nav.surface');
        } else {
            surfaceBtn.classList.add('disabled');
            surfaceBtn.style.pointerEvents = 'none';
            surfaceBtn.style.opacity = '0.35';
            surfaceBtn.style.cursor = 'not-allowed';
            surfaceBtn.title = tr('nav.surface_disabled_title');
            if (surfaceText) surfaceText.textContent = tr('nav.surface');
        }
    }

    // Se estava no espaço e acabou de ingressar em um planeta enquanto estava na tela do Orrery:
    if (lastOrrerySurfaceNear === false && isNearSurface === true) {
        console.log("🪐 [SSE EVENT] Ingresso em planeta detectado via Push. Abrindo Tela de Superfície...");
        window.location.href = '/index.html?view=surface';
        return;
    }

    lastOrrerySurfaceNear = isNearSurface;
}

// Monitora saltos de hiperespaço (FSDJump) para carregar o novo sistema automaticamente
async function checkPlayerSystemChange() {
    try {
        const res = await fetch('/api/player/status');
        if (!res.ok) return;
        const player = await res.json();
        if (!player || !player.currentSystem) return;

        const sysName = player.currentSystem.trim();

        // Se o comandante acabou de saltar para um novo sistema estelar:
        if (lastKnownPlayerSystem !== null && lastKnownPlayerSystem.toLowerCase() !== sysName.toLowerCase()) {
            console.log(`🚀 [ORRERY] Salto FSD detectado: de ${lastKnownPlayerSystem} para ${sysName}! Atualizando mapa 3D automaticamente...`);
            lastKnownPlayerSystem = sysName;
            loadSystemOrrery(sysName);
            return;
        }

        lastKnownPlayerSystem = sysName;
    } catch (e) {
        // Silencioso
    }
}

// Verifica se o jogador está em um planeta para habilitar o botão de Superfície Planetária
async function checkSurfaceAvailability() {
    try {
        const res = await fetch('/api/player/surface-status');
        if (!res.ok) return;
        const data = await res.json();
        lastOrrerySurfaceData = data;
        const surfaceBtn = document.getElementById('btnOrrerySurfaceLink');
        const surfaceText = document.getElementById('btnOrrerySurfaceText');
        const isNearSurface = checkIsNearSurface(data);

        if (surfaceBtn) {
            if (isNearSurface) {
                surfaceBtn.classList.remove('disabled');
                surfaceBtn.style.pointerEvents = 'auto';
                surfaceBtn.style.opacity = '1.0';
                surfaceBtn.style.cursor = 'pointer';
                surfaceBtn.title = tr('nav.orrery_surface_title', data.bodyName || data.planetName || tr('nav.surface').toLowerCase());
                if (surfaceText) surfaceText.textContent = tr('nav.surface');
            } else {
                surfaceBtn.classList.add('disabled');
                surfaceBtn.style.pointerEvents = 'none';
                surfaceBtn.style.opacity = '0.35';
                surfaceBtn.style.cursor = 'not-allowed';
                surfaceBtn.title = tr('nav.surface_disabled_title');
                if (surfaceText) surfaceText.textContent = tr('nav.surface');
            }
        }

        // Se estava no espaço e acabou de ingressar em um planeta enquanto estava na tela do Orrery:
        if (lastOrrerySurfaceNear === false && isNearSurface === true) {
            console.log("🪐 [ORRERY] Ingresso em planeta detectado. Abrindo Tela de Superfície...");
            window.location.href = '/index.html?view=surface';
            return;
        }

        lastOrrerySurfaceNear = isNearSurface;
    } catch (e) {
        // Silencioso
    }
}

function createStarfield() {
    const starsGeo = new THREE.BufferGeometry();
    const count = 4000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const radius = 12000 + Math.random() * 8000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);

        const colType = Math.random();
        if (colType < 0.6) {
            colors[i3] = 0.85; colors[i3 + 1] = 0.92; colors[i3 + 2] = 1.0;
        } else if (colType < 0.85) {
            colors[i3] = 1.0; colors[i3 + 1] = 0.88; colors[i3 + 2] = 0.65;
        } else {
            colors[i3] = 0.65; colors[i3 + 1] = 0.85; colors[i3 + 2] = 1.0;
        }
    }

    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starsMat = new THREE.PointsMaterial({
        size: 2.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.85
    });

    const starPoints = new THREE.Points(starsGeo, starsMat);
    scene.add(starPoints);
}

// Carrega os corpos celestes do backend
async function loadSystemOrrery(systemName) {
    const loadingEl = document.getElementById('orrery-loading');
    const loadingText = document.getElementById('loadingStatusText');
    if (loadingEl) loadingEl.style.display = 'flex';
    if (loadingText) loadingText.textContent = tr('orrery.loading_system', systemName || tr('galaxy.current_system'));

    try {
        let url = '/api/system/orrery';
        if (systemName && systemName.trim()) {
            url += `?system=${encodeURIComponent(systemName.trim())}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        systemData = data;
        renderSystemOrrery(data);
    } catch (err) {
        console.error('Erro ao carregar sistema:', err);
        if (loadingText) loadingText.textContent = tr('orrery.load_failed', err.message);
    } finally {
        if (loadingEl) {
            setTimeout(() => { loadingEl.style.display = 'none'; }, 400);
        }
    }
}

// Identifica a Estrela Principal do Sistema com precisão astronômica
function findMainStar(bodies) {
    if (!bodies || bodies.length === 0) return null;
    const stars = bodies.filter(b => 'Star'.equalsIgnoreCase(b.type));
    if (stars.length > 0) {
        const arrivalStar = stars.find(s => s.distanceToArrival !== null && s.distanceToArrival !== undefined && s.distanceToArrival <= 1.0);
        if (arrivalStar) return arrivalStar;

        const explicitMain = stars.find(s => s.isMainStar === true);
        if (explicitMain) return explicitMain;

        const starA = stars.find(s => s.name && (s.name.endsWith(' A') || s.name.endsWith(' a') || s.name.includes(' A ')));
        if (starA) return starA;

        const sorted = [...stars].sort((a, b) => (a.distanceToArrival || 0) - (b.distanceToArrival || 0));
        return sorted[0];
    }

    // Se nenhum corpo tiver tipo 'Star', sintetiza estrela central virtual para que os planetas orbitem o centro
    const starClass = (systemData && systemData.primaryStarClass) ? systemData.primaryStarClass : 'K';
    return {
        bodyId: 0,
        name: systemData ? systemData.systemName : 'Estrela Central',
        type: 'Star',
        subType: starClass + ' (Orange) Star',
        spectralClass: starClass,
        isMainStar: true,
        solarRadius: 1.0,
        distanceToArrival: 0.0
    };
}

// Verifica se um corpo é um Belt Cluster (Aglomerado de Asteroides)
function isBeltCluster(b) {
    if (!b) return false;
    const type = (b.type || '').toLowerCase();
    const subType = (b.subType || '').toLowerCase();
    const name = (b.name || '').toLowerCase();
    return type === 'asteroidcluster' || type === 'belt' ||
           subType.includes('cluster') || subType.includes('belt cluster') ||
           name.includes('belt cluster') || name.includes('cluster');
}

function updateOrreryHeaderBadges(data) {
    const bodies = [...(data.bodies || [])];
    const mainStar = findMainStar(bodies);

    const nameEl = document.getElementById('currentSystemName');
    const badgeEl = document.getElementById('primaryStarBadge');
    const countEl = document.getElementById('bodyCountBadge');

    if (nameEl) nameEl.textContent = data.systemName || tr('galaxy.cmdr_unknown');
    if (badgeEl) badgeEl.textContent = tr('orrery.star_class', mainStar ? (mainStar.spectralClass || mainStar.subType || data.primaryStarClass || 'K') : 'K');
    if (countEl) {
        countEl.textContent = bodies.length === 0
            ? tr('orrery.bodies_unmapped')
            : tr('orrery.bodies_count', bodies.length);
    }
    return mainStar;
}

// Renderiza a cena do Orrery
function renderSystemOrrery(data) {
    celestialBodies = [];
    while (celestialObjectsGroup.children.length > 0) {
        celestialObjectsGroup.remove(celestialObjectsGroup.children[0]);
    }
    while (orbitsGroup.children.length > 0) {
        orbitsGroup.remove(orbitsGroup.children[0]);
    }

    const bodies = [...(data.bodies || [])];
    const mainStar = updateOrreryHeaderBadges(data);

    if (bodies.length === 0) {
        const loadingText = document.getElementById('loadingStatusText');
        const loadingEl = document.getElementById('orrery-loading');
        if (loadingText) {
            loadingText.innerHTML = tr('orrery.unmapped_msg', data.systemName || tr('galaxy.system_label'));
        }
        if (loadingEl) loadingEl.style.display = 'flex';
        return;
    }

    const bodyMap = new Map();
    bodies.forEach(b => {
        bodyMap.set(b.bodyId !== null && b.bodyId !== undefined ? b.bodyId : b.name, b);
    });

    // Luz pontual emitida pela estrela principal (fixada no centro 0,0,0)
    const starColorHex = getStarColor(mainStar.spectralClass || mainStar.subType);
    const starLight = new THREE.PointLight(starColorHex, 2.8, 12000, 0.35);
    starLight.position.set(0, 0, 0);
    celestialObjectsGroup.add(starLight);

    // Renderiza Cinturões de Asteroides Estelares contínuos (Star Belts)
    bodies.forEach(b => {
        if ('Star'.equalsIgnoreCase(b.type) && b.belts && b.belts.length > 0) {
            b.belts.forEach(belt => {
                const beltDisk = createStarBeltDisk(belt, b);
                if (beltDisk) celestialObjectsGroup.add(beltDisk);
            });
        }
    });

    // 1. Criação dos Objetos Visuais
    bodies.forEach(b => {
        const isStar = 'Star'.equalsIgnoreCase(b.type);
        const isMain = mainStar && (b.name === mainStar.name || b.bodyId === mainStar.bodyId);

        let bodyObj;
        if (isBeltCluster(b)) {
            bodyObj = createAsteroidClusterObject(b, mainStar, bodyMap);
        } else {
            bodyObj = createCelestialBodyObject(b, isStar, isMain, mainStar, bodyMap);
        }

        celestialBodies.push(bodyObj);
        celestialObjectsGroup.add(bodyObj.meshGroup);

        if (bodyObj.orbitLine) {
            orbitsGroup.add(bodyObj.orbitLine);
        }
    });

    // 2. Posicionamento Kepleriano Fiel e Condizente com a Orientação Relativa Real
    updateAllBodyPositions();

    resetCameraView();
}

/**
 * Atualiza a posição de todos os corpos celestes com base na órbita kepleriana e relógio de parede
 */
function updateAllBodyPositions() {
    celestialBodies.forEach(bodyObj => {
        const b = bodyObj.data;
        if (bodyObj.isPrimaryStar) {
            bodyObj.meshGroup.position.set(0, 0, 0);
            return;
        }

        const pos = computeKeplerianPosition(b, bodyObj.scaledSemiMajor);

        // Se for lua de um planeta, posiciona relativo ao planeta pai
        if (bodyObj.isMoon && bodyObj.parentId !== null) {
            const parentObj = celestialBodies.find(p => p.data.bodyId === bodyObj.parentId);
            if (parentObj) {
                bodyObj.meshGroup.position.copy(parentObj.meshGroup.position).add(pos);
                if (bodyObj.orbitLine) {
                    bodyObj.orbitLine.position.copy(parentObj.meshGroup.position);
                }
                return;
            }
        }

        bodyObj.meshGroup.position.copy(pos);
    });
}

/**
 * Calcula a posição espacial precisa (X, Y, Z) na elipse orbital kepleriana
 * Utiliza Anomalia Média propagada em tempo real com o relógio de parede
 */
function computeKeplerianPosition(b, a) {
    if (!a || a <= 0) return new THREE.Vector3(0, 0, 0);

    const e = Math.min(Math.max(b.orbitalEccentricity || 0.0, 0.0), 0.95);
    const inc = (b.orbitalInclination || 0.0) * Math.PI / 180;
    const peri = (b.argOfPeriapsis || 0.0) * Math.PI / 180;
    const node = (b.ascendingNode || 0.0) * Math.PI / 180;

    let nu; // Anomalia verdadeira (ângulo polar na elipse)

    if (b.meanAnomaly !== null && b.meanAnomaly !== undefined) {
        let M_deg = b.meanAnomaly;

        // Propagação orbital em tempo real caso tenhamos timestamp do scan e período orbital
        if (b.scanTimeMs && b.orbitalPeriod && b.orbitalPeriod > 0) {
            const elapsedDays = (Date.now() - b.scanTimeMs) / (1000.0 * 86400.0);
            const deltaAnomalyDeg = (360.0 / b.orbitalPeriod) * elapsedDays;
            M_deg = (M_deg + deltaAnomalyDeg) % 360.0;
            if (M_deg < 0) M_deg += 360.0;
        }

        // Resolver Equação de Kepler: M = E - e*sin(E)
        let M = (M_deg * Math.PI / 180) % (Math.PI * 2);
        if (M < 0) M += Math.PI * 2;

        let E = M;
        for (let iter = 0; iter < 8; iter++) {
            const f = E - e * Math.sin(E) - M;
            const fPrime = 1 - e * Math.cos(E);
            E = E - f / fPrime;
        }
        nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    } else {
        // Orientação física baseada no periastro e na assinatura astronômica do corpo
        const seedAngle = (peri !== 0) ? peri : ((b.bodyId || 1) * 0.6180339887 * Math.PI * 2);
        nu = seedAngle;
    }

    // Raio focal na elipse
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
    const xOrb = r * Math.cos(nu);
    const zOrb = r * Math.sin(nu);

    // 1. Rotação pelo argumento do periastro
    const xPeri = xOrb * Math.cos(peri) - zOrb * Math.sin(peri);
    const zPeri = xOrb * Math.sin(peri) + zOrb * Math.cos(peri);

    // 2. Inclinação orbital
    const yInc = zPeri * Math.sin(inc);
    const zInc = zPeri * Math.cos(inc);

    // 3. Rotação pela longitude do nó ascendente
    const xFinal = xPeri * Math.cos(node) - zInc * Math.sin(node);
    const yFinal = yInc;
    const zFinal = xPeri * Math.sin(node) + zInc * Math.cos(node);

    return new THREE.Vector3(xFinal, yFinal, zFinal);
}

/**
 * Cria o disco contínuo de partículas do cinturão de asteroides ao redor da estrela
 */
function createStarBeltDisk(belt, parentStar) {
    const innerAu = belt.innerRadius ? (belt.innerRadius / 149597870.7) : 1.8;
    const outerAu = belt.outerRadius ? (belt.outerRadius / 149597870.7) : 2.8;
    const rIn = 22.0 + Math.pow(Math.max(innerAu, 0.1), 0.52) * 55.0;
    const rOut = 22.0 + Math.pow(Math.max(outerAu, 0.2), 0.52) * 55.0;

    const particleCount = 1200;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const rad = rIn + Math.random() * (rOut - rIn);
        const ySpread = (Math.random() - 0.5) * 1.5;

        pos[i * 3] = Math.cos(angle) * rad;
        pos[i * 3 + 1] = ySpread;
        pos[i * 3 + 2] = Math.sin(angle) * rad;

        col[i * 3] = 0.65 + Math.random() * 0.2;
        col[i * 3 + 1] = 0.55 + Math.random() * 0.2;
        col[i * 3 + 2] = 0.45 + Math.random() * 0.2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 1.6,
        vertexColors: true,
        transparent: true,
        opacity: 0.55
    });

    return new THREE.Points(geo, mat);
}

/**
 * Cria o AMONTOADO DE ROCHAS (Asteroid Cluster)
 */
function createAsteroidClusterObject(b, mainStar, bodyMap) {
    const group = new THREE.Group();
    const clusterColor = getBeltClusterColor(b);

    const hitGeo = new THREE.SphereGeometry(6.5, 16, 16);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.userData = { body: b };
    group.add(hitMesh);

    const rocksGroup = new THREE.Group();
    const rockCount = 12;
    const rockMeshes = [];

    const isMetallic = (b.subType || '').toLowerCase().includes('metal');
    const rockMat = new THREE.MeshStandardMaterial({
        color: clusterColor,
        roughness: isMetallic ? 0.45 : 0.92,
        metalness: isMetallic ? 0.75 : 0.12,
        flatShading: true
    });

    for (let i = 0; i < rockCount; i++) {
        const size = 0.6 + Math.random() * 1.3;
        const rockGeo = (i % 2 === 0)
            ? new THREE.DodecahedronGeometry(size, 0)
            : new THREE.IcosahedronGeometry(size, 0);

        const rockMesh = new THREE.Mesh(rockGeo, rockMat);

        rockMesh.scale.set(
            0.7 + Math.random() * 0.7,
            0.6 + Math.random() * 0.8,
            0.7 + Math.random() * 0.7
        );

        const dist = 0.8 + Math.random() * 4.2;
        const angle = Math.random() * Math.PI * 2;
        const yOffset = (Math.random() - 0.5) * 1.2;

        rockMesh.position.set(
            Math.cos(angle) * dist,
            yOffset,
            Math.sin(angle) * dist
        );

        rockMesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        rockMesh.userData = {
            rotSpeed: {
                x: (Math.random() - 0.5) * 0.008,
                y: (Math.random() - 0.5) * 0.008,
                z: (Math.random() - 0.5) * 0.008
            }
        };

        rockMeshes.push(rockMesh);
        rocksGroup.add(rockMesh);
    }
    group.add(rocksGroup);

    const dustCount = 45;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
        const dAngle = Math.random() * Math.PI * 2;
        const dDist = 0.5 + Math.random() * 5.5;
        dustPos[i * 3] = Math.cos(dAngle) * dDist;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 1.8;
        dustPos[i * 3 + 2] = Math.sin(dAngle) * dDist;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
        color: clusterColor,
        size: 1.3,
        transparent: true,
        opacity: 0.65
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    group.add(dustPoints);

    const labelSprite = createTextSprite(b.name, '#' + clusterColor.toString(16).padStart(6, '0'), 9);
    labelSprite.position.y = 5.5;
    group.add(labelSprite);

    let orbitLine = null;
    let scaledSemiMajor = 0;

    let effSmaAu = b.semiMajorAxisAu;
    if ((!effSmaAu || effSmaAu <= 0) && b.distanceToArrival && b.distanceToArrival > 0) {
        effSmaAu = b.distanceToArrival / 499.0;
    }

    if (effSmaAu && effSmaAu > 0) {
        const ecc = Math.min(Math.max(b.orbitalEccentricity || 0.02, 0.0), 0.95);
        const inc = (b.orbitalInclination || 0.5) * Math.PI / 180;
        const peri = (b.argOfPeriapsis || 0.0) * Math.PI / 180;
        const node = (b.ascendingNode || 0.0) * Math.PI / 180;
        scaledSemiMajor = 18.0 + Math.pow(effSmaAu, 0.52) * 55.0;
        orbitLine = createOrbitalEllipse(scaledSemiMajor, ecc, inc, peri, node, clusterColor, false);
    } else if (b.distanceToArrival && b.distanceToArrival > 0) {
        scaledSemiMajor = 18.0 + Math.pow(b.distanceToArrival / 30.0, 0.48) * 20.0;
        orbitLine = createOrbitalEllipse(scaledSemiMajor, 0.01, 0.01, 0, 0, clusterColor, false);
    }

    return {
        data: b,
        meshGroup: group,
        sphereMesh: hitMesh,
        rocksGroup: rocksGroup,
        rockMeshes: rockMeshes,
        orbitLine: orbitLine,
        scaledSemiMajor: scaledSemiMajor,
        isMoon: false,
        isBeltCluster: true,
        isPrimaryStar: false,
        parentId: b.parentId
    };
}

function createCelestialBodyObject(b, isStar, isMainStar, mainStar, bodyMap) {
    const group = new THREE.Group();

    let visualRadius = 2.0;
    let mainColor = 0xa4bedc;

    if (isStar) {
        visualRadius = Math.max(8.0, Math.min((b.solarRadius || 1.0) * 10.0, 28.0));
        mainColor = getStarColor(b.spectralClass || b.subType);
    } else {
        const rKm = b.radius || 3000;
        if (b.subType && b.subType.toLowerCase().includes('gas giant')) {
            visualRadius = Math.max(4.5, Math.min((rKm / 70000) * 8.0, 10.0));
        } else {
            visualRadius = Math.max(1.4, Math.min((rKm / 6371) * 3.0, 4.8));
        }
        mainColor = getPlanetColor(b.subType);
    }

    const sphereGeo = new THREE.SphereGeometry(visualRadius, 32, 24);
    let sphereMat;

    if (isStar) {
        sphereMat = new THREE.MeshBasicMaterial({
            color: mainColor
        });

        const glowGeo = new THREE.SphereGeometry(visualRadius * 1.45, 24, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: mainColor,
            transparent: true,
            opacity: 0.35,
            side: THREE.BackSide
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        group.add(glowMesh);

        if (isMainStar) {
            group.position.set(0, 0, 0);
        }
    } else {
        sphereMat = new THREE.MeshStandardMaterial({
            color: mainColor,
            roughness: 0.72,
            metalness: 0.18
        });

        if (b.isLandable) {
            const haloGeo = new THREE.RingGeometry(visualRadius * 1.15, visualRadius * 1.25, 32);
            const haloMat = new THREE.MeshBasicMaterial({
                color: 0x2bfca8,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.65
            });
            const haloMesh = new THREE.Mesh(haloGeo, haloMat);
            haloMesh.rotation.x = Math.PI / 2;
            group.add(haloMesh);
        }

        if (b.rings && b.rings.length > 0) {
            const inner = visualRadius * 1.5;
            const outer = visualRadius * 2.8;
            const ringGeo = new THREE.RingGeometry(inner, outer, 48);
            const ringMat = new THREE.MeshStandardMaterial({
                color: 0xd8c8b0,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.65
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            group.add(ringMesh);
        }
    }

    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.userData = { body: b };
    group.add(sphereMesh);

    const labelSprite = createTextSprite(b.name, '#' + mainColor.toString(16).padStart(6, '0'), 10);
    labelSprite.position.y = visualRadius + 3.0;
    group.add(labelSprite);

    let orbitLine = null;
    let scaledSemiMajor = 0;
    const isMoon = (b.parentType && b.parentType.toLowerCase() === 'planet');

    if (isMainStar) {
        scaledSemiMajor = 0;
        orbitLine = null;
    } else {
        let effSmaAu = b.semiMajorAxisAu;

        // Planetas binários em torno de baricentro Null
        if (b.parentType === 'Null' && b.distanceToArrival && b.distanceToArrival > 100 && (!effSmaAu || effSmaAu < 0.05)) {
            effSmaAu = b.distanceToArrival / 499.0;
        }

        if (effSmaAu && effSmaAu > 0) {
            const ecc = Math.min(Math.max(b.orbitalEccentricity || 0.0, 0.0), 0.95);
            const inc = (b.orbitalInclination || 0.0) * Math.PI / 180;
            const peri = (b.argOfPeriapsis || 0.0) * Math.PI / 180;
            const node = (b.ascendingNode || 0.0) * Math.PI / 180;

            if (isMoon) {
                scaledSemiMajor = 6.0 + Math.pow(effSmaAu * 1000, 0.45) * 8.0;
            } else if (isStar) {
                scaledSemiMajor = 60.0 + Math.pow(effSmaAu, 0.52) * 65.0;
            } else {
                scaledSemiMajor = 22.0 + Math.pow(effSmaAu, 0.52) * 55.0;
            }

            orbitLine = createOrbitalEllipse(scaledSemiMajor, ecc, inc, peri, node, mainColor, isMoon);
        } else if (b.distanceToArrival && b.distanceToArrival > 0) {
            const distLs = b.distanceToArrival;
            const effAu = distLs / 499.0;
            scaledSemiMajor = 22.0 + Math.pow(effAu, 0.52) * 55.0;
            orbitLine = createOrbitalEllipse(scaledSemiMajor, 0.02, 0.02, 0, 0, mainColor, false);
        }
    }

    return {
        data: b,
        meshGroup: group,
        sphereMesh: sphereMesh,
        orbitLine: orbitLine,
        scaledSemiMajor: scaledSemiMajor,
        isMoon: isMoon,
        isBeltCluster: false,
        isPrimaryStar: isMainStar,
        parentId: b.parentId
    };
}

// Cria a linha elíptica da órbita no espaço tridimensional
function createOrbitalEllipse(a, e, inc, peri, node, colorHex, isMoon) {
    const points = [];
    const segments = isMoon ? 64 : 128;

    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(theta));
        const xOrb = r * Math.cos(theta);
        const zOrb = r * Math.sin(theta);

        const xPeri = xOrb * Math.cos(peri) - zOrb * Math.sin(peri);
        const zPeri = xOrb * Math.sin(peri) + zOrb * Math.cos(peri);

        const yInc = zPeri * Math.sin(inc);
        const zInc = zPeri * Math.cos(inc);

        const xFinal = xPeri * Math.cos(node) - zInc * Math.sin(node);
        const yFinal = yInc;
        const zFinal = xPeri * Math.sin(node) + zInc * Math.cos(node);

        points.push(new THREE.Vector3(xFinal, yFinal, zFinal));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: isMoon ? 0.25 : 0.45
    });

    return new THREE.Line(geo, mat);
}

// Animação: Sem movimentação artificial acelerada! Posições estáticas e sincronização em tempo real
let realTimeSyncTimer = 0;
function updateOrbitalPositions(delta) {
    // Leve rotação axial dos fragmentos do cluster para profundidade visual sem alterar a coordenada
    celestialBodies.forEach(b => {
        if (b.isBeltCluster && b.rockMeshes) {
            b.rockMeshes.forEach(rock => {
                rock.rotation.x += rock.userData.rotSpeed.x;
                rock.rotation.y += rock.userData.rotSpeed.y;
                rock.rotation.z += rock.userData.rotSpeed.z;
            });
        }
    });

    // Sincronização periódica sutil com o relógio do mundo real a cada 10 segundos
    realTimeSyncTimer += delta;
    if (realTimeSyncTimer >= 10.0) {
        realTimeSyncTimer = 0;
        updateAllBodyPositions();
    }

    if (focusedObject && controls) {
        controls.target.lerp(focusedObject.meshGroup.position, 0.08);
    }
}

// Loop Principal de Renderização
let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const delta = (now - lastTime) / 1000.0;
    lastTime = now;

    TWEEN.update();
    updateOrbitalPositions(delta);
    controls.update();

    renderer.render(scene, camera);
}

// Raycasting e Interatividade
function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshes = celestialBodies.map(b => b.sphereMesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    const tooltip = document.getElementById('body-tooltip');

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const body = hit.userData.body;
        if (body && tooltip) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${e.clientX}px`;
            tooltip.style.top = `${e.clientY}px`;

            if (isBeltCluster(body)) {
                tooltip.innerHTML = `<b>🪨 ${body.name}</b><br><span style="color:#c2a68c;">${tr('orrery.legend_belt')}</span> • <span style="color:#ffaa00;">${tr('orrery.mining_tooltip')}</span>`;
            } else {
                const landText = body.isLandable ? tr('orrery.landable_tooltip') : '';
                tooltip.innerHTML = `<b>${body.name}</b><br><span style="color:#ffaa00;">${body.subType || body.type}</span>${landText}`;
            }
            document.body.style.cursor = 'pointer';
        }
    } else {
        if (tooltip) tooltip.style.display = 'none';
        document.body.style.cursor = 'default';
    }
}

function onCanvasClick(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshes = celestialBodies.map(b => b.sphereMesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const bodyObj = celestialBodies.find(b => b.sphereMesh === hit);
        if (bodyObj) {
            selectAndFocusBody(bodyObj);
        }
    }
}

// Foco Suave na Câmera (TWEEN orbital)
function selectAndFocusBody(bodyObj) {
    selectedBodyData = bodyObj.data;
    focusedObject = bodyObj;

    showBodyDetails(bodyObj.data);

    const targetPos = bodyObj.meshGroup.position;
    const distanceOffset = bodyObj.data.type === 'Star' ? 45.0 : (bodyObj.isBeltCluster ? 14.0 : 18.0);

    new TWEEN.Tween(controls.target)
        .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 800)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

    const newCamPos = {
        x: targetPos.x + distanceOffset,
        y: targetPos.y + (distanceOffset * 0.7),
        z: targetPos.z + distanceOffset
    };

    new TWEEN.Tween(camera.position)
        .to(newCamPos, 900)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
}

// Exibe Telemetria no Card Lateral Direito
function showBodyDetails(b) {
    const panel = document.getElementById('bodyDetailsPanel');
    if (!panel) return;

    panel.style.display = 'block';

    const isCluster = isBeltCluster(b);
    const locale = window.i18n ? window.i18n.getLocale() : 'en-US';

    document.getElementById('detailBodyName').textContent = b.name;
    document.getElementById('detailBodyClass').textContent = b.subType || b.type;

    const badgeTypeEl = document.getElementById('detailBadgeType');
    const landEl = document.getElementById('detailLandableBadge');

    if (isCluster) {
        badgeTypeEl.textContent = tr('orrery.badge_belt');
        badgeTypeEl.style.color = '#c2a68c';
        badgeTypeEl.style.borderColor = 'rgba(194,166,140,0.5)';
        badgeTypeEl.style.background = 'rgba(194,166,140,0.18)';

        landEl.style.display = 'inline-block';
        landEl.textContent = tr('orrery.landable_belt');
        landEl.style.borderColor = 'rgba(255,170,0,0.5)';
        landEl.style.color = '#ffaa00';

        document.getElementById('detailGravity').textContent = tr('orrery.microgravity');
        document.getElementById('detailAtmosphere').textContent = tr('orrery.vacuum');
        document.getElementById('detailPressure').textContent = '0.00 atm';
        document.getElementById('detailRadius').textContent = 'Cluster (~500m)';
        document.getElementById('detailMass').textContent = tr('orrery.rocky_cluster');
    } else {
        badgeTypeEl.textContent = (b.type || tr('orrery.badge_planet')).toUpperCase();
        badgeTypeEl.style.color = '#00d4ff';
        badgeTypeEl.style.borderColor = 'rgba(0,212,255,0.4)';
        badgeTypeEl.style.background = 'rgba(0,212,255,0.2)';

        if (b.isLandable) {
            landEl.style.display = 'inline-block';
            landEl.textContent = tr('orrery.landable_yes');
            landEl.style.borderColor = 'rgba(43,252,168,0.5)';
            landEl.style.color = '#2bfca8';
        } else {
            landEl.style.display = 'inline-block';
            landEl.textContent = tr('orrery.landable_no');
            landEl.style.borderColor = 'rgba(255,80,80,0.5)';
            landEl.style.color = '#ff6666';
        }

        document.getElementById('detailRadius').textContent = b.radius ? `${Math.round(b.radius).toLocaleString(locale)} km` : (b.solarRadius ? `${b.solarRadius.toFixed(2)} R☉` : '---');
        document.getElementById('detailGravity').textContent = b.gravity !== null && b.gravity !== undefined ? `${b.gravity.toFixed(2)} G` : '---';
        document.getElementById('detailMass').textContent = b.earthMasses ? `${b.earthMasses.toFixed(3)} M⊕` : (b.solarMasses ? `${b.solarMasses.toFixed(2)} M☉` : '---');
        document.getElementById('detailAtmosphere').textContent = b.atmosphereType || tr('orrery.no_atmo');
        document.getElementById('detailPressure').textContent = b.surfacePressure ? `${b.surfacePressure.toFixed(2)} atm` : '0.00 atm';
    }

    // Mecânica Orbital
    document.getElementById('detailDistArrival').textContent = b.distanceToArrival ? `${Math.round(b.distanceToArrival).toLocaleString(locale)} Ls` : '0 Ls';
    document.getElementById('detailSemiMajorAxis').textContent = b.semiMajorAxisAu ? `${b.semiMajorAxisAu.toFixed(3)} AU` : '---';
    document.getElementById('detailOrbitalPeriod').textContent = b.orbitalPeriod ? tr('orrery.days_unit', b.orbitalPeriod.toFixed(1)) : '---';
    document.getElementById('detailEccentricity').textContent = b.orbitalEccentricity !== null && b.orbitalEccentricity !== undefined ? b.orbitalEccentricity.toFixed(4) : '0.0000';
    document.getElementById('detailInclination').textContent = b.orbitalInclination !== null && b.orbitalInclination !== undefined ? `${b.orbitalInclination.toFixed(2)}°` : '0.00°';

    document.getElementById('detailTemperature').textContent = b.surfaceTemperature ? `${Math.round(b.surfaceTemperature)} K` : (isCluster ? '45 K' : '---');

    // Sinais DSS
    const sigRow = document.getElementById('detailSignalsRow');
    if (b.bioSignalsCount || b.geoSignalsCount) {
        sigRow.style.display = 'block';
        document.getElementById('detailBioCount').textContent = b.bioSignalsCount || 0;
        document.getElementById('detailGeoCount').textContent = b.geoSignalsCount || 0;
    } else {
        sigRow.style.display = 'none';
    }

    // Materiais
    const matsBlock = document.getElementById('detailMaterialsBlock');
    const matsList = document.getElementById('detailMaterialsList');
    if (b.materials && Object.keys(b.materials).length > 0) {
        matsBlock.style.display = 'block';
        let html = '';
        for (const [mat, pct] of Object.entries(b.materials)) {
            html += `<span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); padding: 2px 6px; border-radius: 3px; font-size: 10px; color: #a4bedc;">${mat} <b style="color:#ffaa00;">${pct}%</b></span>`;
        }
        matsList.innerHTML = html;
    } else {
        matsBlock.style.display = 'none';
    }
}

// Reseta Câmera para Visão Geral
function resetCameraView() {
    focusedObject = null;
    new TWEEN.Tween(controls.target)
        .to({ x: 0, y: 0, z: 0 }, 900)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

    new TWEEN.Tween(camera.position)
        .to({ x: 0, y: 320, z: 550 }, 900)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
}

// Foca na Estrela Principal
function focusPrimaryStar() {
    const starObj = celestialBodies.find(b => b.isPrimaryStar) || celestialBodies.find(b => b.data.type === 'Star');
    if (starObj) {
        selectAndFocusBody(starObj);
    }
}

// Event Listeners
function setupEventListeners() {
    const btnReset = document.getElementById('btnResetView');
    if (btnReset) btnReset.addEventListener('click', resetCameraView);

    const btnStar = document.getElementById('btnFocusStar');
    if (btnStar) btnStar.addEventListener('click', focusPrimaryStar);

    const btnCloseDet = document.getElementById('btnCloseDetails');
    if (btnCloseDet) {
        btnCloseDet.addEventListener('click', () => {
            document.getElementById('bodyDetailsPanel').style.display = 'none';
        });
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Utilitários de Cor
function getStarColor(spec) {
    if (!spec) return 0xffffff;
    const s = spec.toUpperCase();
    if (s.startsWith('O')) return 0x6699ff;
    if (s.startsWith('B')) return 0x99ccff;
    if (s.startsWith('A')) return 0xeeffff;
    if (s.startsWith('F')) return 0xffffff;
    if (s.startsWith('G')) return 0xffdd44;
    if (s.startsWith('K')) return 0xff9922;
    if (s.startsWith('M')) return 0xff4411;
    if (s.startsWith('L') || s.startsWith('T') || s.startsWith('Y')) return 0x882211;
    if (s.startsWith('D')) return 0xddeeff;
    if (s.startsWith('N')) return 0x00e5ff;
    if (s.startsWith('H')) return 0x110022;
    return 0xffffff;
}

function getPlanetColor(subType) {
    if (!subType) return 0x8da4be;
    const t = subType.toLowerCase();
    if (t.includes('high metal content')) return 0xe89b38;
    if (t.includes('metal-rich')) return 0xcc3322;
    if (t.includes('water world')) return 0x00b4d8;
    if (t.includes('earth-like')) return 0x2ec4b6;
    if (t.includes('ammonia')) return 0x70e000;
    if (t.includes('icy body')) return 0xade8f4;
    if (t.includes('rocky ice')) return 0x90e0ef;
    if (t.includes('rocky body')) return 0x9a8c98;
    if (t.includes('gas giant')) {
        if (t.includes('water based')) return 0x0077b6;
        if (t.includes('ammonia')) return 0x588157;
        return 0xe09f3e;
    }
    return 0xa4bedc;
}

function getBeltClusterColor(b) {
    const sub = ((b.subType || '') + ' ' + (b.name || '')).toLowerCase();
    if (sub.includes('icy') || sub.includes('ice')) return 0x90e0ef;
    if (sub.includes('metallic')) return 0x8a9bb0;
    if (sub.includes('metal rich') || sub.includes('metal-rich')) return 0xb87333;
    return 0x998877;
}

// Cria Sprite de Texto Flutuante
function createTextSprite(text, colorHex, fontSize) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');

    ctx.font = `bold ${fontSize * 2.2}px 'Segoe UI', Tahoma, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillText(text, 192 + 2, 36 + 2);

    ctx.fillStyle = colorHex || '#ffffff';
    ctx.fillText(text, 192, 36);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.9 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(fontSize * 1.5, fontSize * 0.32, 1.0);
    return sprite;
}

String.prototype.equalsIgnoreCase = function(other) {
    return this.toLowerCase() === (other || '').toLowerCase();
};
