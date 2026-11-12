/**
 * Elite Dangerous 3D Galaxy Explorer & Void Scanner
 * Renderizador Three.js interativo de cubos galácticos e caçador de vazios.
 */

const tr = (key, ...args) => (window.t ? window.t(key, ...args) : key);
const getLocale = () => (window.i18n ? window.i18n.getLocale() : 'pt-BR');

// Paleta de Cores Estelares (KGBFOAM + Especiais + Outras)
const STAR_COLORS = {
    // KGBFOAM (Combustível / Scoopable)
    'O': new THREE.Color(0x3377ff), // Azul Intenso / Muito Quente
    'B': new THREE.Color(0x66bbff), // Azul Claro
    'A': new THREE.Color(0xccf0ff), // Azul-Branco
    'F': new THREE.Color(0xffffee), // Branco-Amarelado
    'G': new THREE.Color(0xffe066), // Amarela (Tipo Sol)
    'K': new THREE.Color(0xff9933), // Laranja
    'M': new THREE.Color(0xff4422), // Vermelha (Anã Vermelha)
    // Não-Scoopable / Exóticas
    'N': new THREE.Color(0x00ffff), // Estrela de Nêutrons (Ciano Elétrico)
    'H': new THREE.Color(0xaa00ff), // Buraco Negro (Violeta/Negro)
    'D': new THREE.Color(0xddffff), // Anã Branca (Branco Puro / Alta Energia)
    'L': new THREE.Color(0x992200), // Anã Marrom Escura
    'T': new THREE.Color(0x661133), // Anã Marrom Fria
    'Y': new THREE.Color(0x441122), // Anã Marrom Ultrafria
    'DEFAULT': new THREE.Color(0x8da4be) // Cor padrão neutra (Outras/Desconhecidas)
};

function getStarColor(starType) {
    if (!starType || typeof starType !== 'string') {
        return STAR_COLORS['DEFAULT'];
    }
    const clean = starType.trim().toUpperCase();
    const firstChar = clean.charAt(0);
    if (STAR_COLORS[firstChar]) {
        return STAR_COLORS[firstChar];
    }
    return STAR_COLORS['DEFAULT'];
}
let starPointsMesh = null;
let starDataList = [];
let allReceivedStars = [];
let currentVoidSectors = [];
let filterInhabitedOnly = false;
let voidBoxesGroup = new THREE.Group();
let boundaryCubeMesh = null;
let galacticGridMesh = null;
let playerMarker = null;
let selectedTargetMarker = null;
let activeRouteLine = null;
let stratumRingsGroup = new THREE.Group();
let activeBeams = [];
let lastTrafficCheckTime = 0;

// Objeto atualmente sob o cursor do mouse (garante sincronia perfeita com o hint!)
let currentHoveredStar = null;
let currentHoveredVoid = null;
let pointerDownPos = { x: 0, y: 0 };

let currentCenter = { x: 0, y: 0, z: 0, system: 'Sol' };
let currentCubeCenter = { x: 0, y: 0, z: 0 };
let currentCommanderName = '';
let lastScannedSystem = '';
let lastRouteTimestamp = 0;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

const DEFAULT_CUBE_SIZE = 90;
const DEFAULT_VOXEL_SIZE = 10;

const tooltipEl = document.getElementById('system-tooltip');
const statsEl = document.getElementById('statsSummary');
const coordsDisplayEl = document.getElementById('playerCoordsDisplay');
const edsmSyncDisplayEl = document.getElementById('edsmSyncDisplay');
const cubeLoadingIndicatorEl = document.getElementById('cubeLoadingIndicator');
const cubeLoadingTextEl = document.getElementById('cubeLoadingText');

function showCubeLoading(text) {
    if (cubeLoadingIndicatorEl) {
        if (cubeLoadingTextEl) cubeLoadingTextEl.textContent = text || tr('galaxy.loading_default');
        cubeLoadingIndicatorEl.style.display = 'flex';
        requestAnimationFrame(() => {
            cubeLoadingIndicatorEl.style.opacity = '1';
        });
    }
}

function hideCubeLoading() {
    if (cubeLoadingIndicatorEl) {
        cubeLoadingIndicatorEl.style.opacity = '0';
        setTimeout(() => {
            if (cubeLoadingIndicatorEl.style.opacity === '0') {
                cubeLoadingIndicatorEl.style.display = 'none';
            }
        }, 300);
    }
}

const btnCloseCard = document.getElementById('btnCloseCard');
const targetCardEl = document.getElementById('selected-target-card');
const targetCardBadge = document.getElementById('targetCardBadge');
const targetCardContent = document.getElementById('targetCardContent');
const btnToggleHabited = document.getElementById('btnToggleHabited');

function updateToggleHabitedButton() {
    if (!btnToggleHabited) return;
    if (filterInhabitedOnly) {
        btnToggleHabited.innerHTML = tr('galaxy.filter_inhabited');
        btnToggleHabited.style.background = 'rgba(0, 212, 255, 0.25)';
        btnToggleHabited.style.borderColor = '#00d4ff';
        btnToggleHabited.style.color = '#ffffff';
        btnToggleHabited.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.5)';
    } else {
        btnToggleHabited.innerHTML = tr('galaxy.filter_all');
        btnToggleHabited.style.background = 'rgba(12, 25, 45, 0.85)';
        btnToggleHabited.style.borderColor = 'rgba(0, 212, 255, 0.35)';
        btnToggleHabited.style.color = '#8da4be';
        btnToggleHabited.style.boxShadow = 'none';
    }
}

if (btnToggleHabited) {
    btnToggleHabited.addEventListener('click', () => {
        filterInhabitedOnly = !filterInhabitedOnly;
        updateToggleHabitedButton();
        updateVisibleStars();
    });
}

function deselectTarget() {
    if (targetCardEl) targetCardEl.style.display = 'none';
    currentPinnedStarName = null;
    currentPinnedVoidId = null;
    if (selectedTargetMarker) {
        selectedTargetMarker.visible = false;
    }
    // Retorna o eixo de apoio/rotação do cubo para a posição da nave do jogador (0, 0, 0 local)
    if (controls) {
        controls.target.set(0, 0, 0);
    }
}

if (btnCloseCard) {
    btnCloseCard.addEventListener('click', () => {
        deselectTarget();
    });
}

// Inicialização da cena Three.js
function init3D() {
    const container = document.getElementById('viewport-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Cena e Fundo Espacial
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020509);
    scene.fog = new THREE.FogExp2(0x020509, 0.003);

    // Câmera Perspectiva
    camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 3000);
    // Posição inicial afastada em ângulo isométrico agradável para ver o cubo inteiro de 100 ly
    camera.position.set(0, 110, 190);

    // Renderizador WebGL
    const canvas = document.getElementById('three-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Controles Orbitais (como no jogo)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 1200;
    controls.minDistance = 5;

    // Luz Ambiente e Pontual
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // Grupo de Caixas de Vazios e Anéis de Stratum
    scene.add(voidBoxesGroup);
    scene.add(stratumRingsGroup);

    // Marcador da Nave do Jogador no Centro (0, 0, 0 local)
    const playerGeo = new THREE.OctahedronGeometry(1.2, 0);
    const playerMat = new THREE.MeshBasicMaterial({ color: 0x2bfca8, wireframe: false });
    playerMarker = new THREE.Mesh(playerGeo, playerMat);
    
    const playerHaloGeo = new THREE.RingGeometry(1.6, 2.0, 32);
    const playerHaloMat = new THREE.MeshBasicMaterial({ color: 0x2bfca8, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const halo = new THREE.Mesh(playerHaloGeo, playerHaloMat);
    halo.rotation.x = Math.PI / 2;
    playerMarker.add(halo);
    scene.add(playerMarker);

    // Marcador de Seleção: esfera tênue azulada em volta da estrela clicada
    selectedTargetMarker = new THREE.Group();

    // Esfera tênue azulada com glow suave (raio reduzido para envolver perfeitamente a estrela)
    const selSphereGeo = new THREE.SphereGeometry(1.4, 24, 20);
    const selSphereMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const selSphere = new THREE.Mesh(selSphereGeo, selSphereMat);
    selectedTargetMarker.add(selSphere);

    selectedTargetMarker.visible = false;
    scene.add(selectedTargetMarker);

    // Eventos de redimensionamento e mouse
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);

    // Suporte robusto a clique: registra onde o mouse desceu
    window.addEventListener('pointerdown', (e) => {
        pointerDownPos.x = e.clientX;
        pointerDownPos.y = e.clientY;
    });

    // Se soltou o mouse sem arrastar mais de 5 pixels (ou seja, foi um clique intencional e não um drag de câmera)
    window.addEventListener('pointerup', onPointerUp);

    animate();
}

function onWindowResize() {
    const container = document.getElementById('viewport-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

const tempStarVec = new THREE.Vector3();
const tempCameraDir = new THREE.Vector3();

// Busca precisa no espaço de tela 2D: projeta as estrelas para pixels no monitor
// 1. Ignora estrelas que ficaram atrás da câmera (ao dar zoom)
// 2. Não sofre com distorções de threshold em unidades 3D
// 3. Garante que o clique seja exato na estrela visualizada
function findStarAtScreenPos(clientX, clientY, maxPixelDist = 14) {
    if (!starDataList || starDataList.length === 0 || !camera) return null;

    const container = document.getElementById('viewport-container');
    const rect = container.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) {
        return null;
    }

    const cx = currentCubeCenter.x;
    const cy = currentCubeCenter.y;
    const cz = currentCubeCenter.z;

    camera.getWorldDirection(tempCameraDir);

    let bestStar = null;
    let minPixelDist = maxPixelDist;
    let bestDistFromCamera = Infinity;

    for (let i = 0; i < starDataList.length; i++) {
        const star = starDataList[i];

        // Posição local 3D da estrela na cena
        const sx = star.x - cx;
        const sy = star.y - cy;
        const sz = star.z - cz;
        tempStarVec.set(sx, sy, sz);

        // Vetor da câmera até a estrela
        const dx = sx - camera.position.x;
        const dy = sy - camera.position.y;
        const dz = sz - camera.position.z;

        // Projeção ao longo da direção da câmera (distância à frente do observador)
        const forwardDist = dx * tempCameraDir.x + dy * tempCameraDir.y + dz * tempCameraDir.z;

        // Se a estrela está atrás da câmera ou na mesma linha do near plane, descarta 100%!
        if (forwardDist <= (camera.near || 0.1)) {
            continue;
        }

        const distFromCamera = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Projeta para coordenadas normalizadas de tela [-1, 1]
        tempStarVec.project(camera);

        // Se fora do frustum de visualização em profundidade
        if (tempStarVec.z < -1 || tempStarVec.z > 1) {
            continue;
        }

        // Converte para coordenadas reais de pixels na viewport do canvas
        const screenX = (tempStarVec.x * 0.5 + 0.5) * rect.width;
        const screenY = (-(tempStarVec.y * 0.5) + 0.5) * rect.height;

        const pDist = Math.hypot(screenX - mouseX, screenY - mouseY);

        if (pDist <= minPixelDist) {
            // Se o cursor estiver visivelmente mais próximo desta estrela em pixels, ou se empatar,
            // escolhe a que estiver fisicamente mais à frente na linha de visão
            if (pDist < minPixelDist - 2.5) {
                minPixelDist = pDist;
                bestStar = star;
                bestDistFromCamera = distFromCamera;
            } else if (Math.abs(pDist - minPixelDist) <= 2.5) {
                if (distFromCamera < bestDistFromCamera) {
                    minPixelDist = pDist;
                    bestStar = star;
                    bestDistFromCamera = distFromCamera;
                }
            }
        }
    }

    return bestStar;
}

function onMouseMove(event) {
    const container = document.getElementById('viewport-container');
    mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;

    // Prioridade 1: Estrelas! (Usa detecção exata em pixels na tela)
    const foundStar = findStarAtScreenPos(event.clientX, event.clientY, 12);
    if (foundStar) {
        currentHoveredStar = foundStar;
        currentHoveredVoid = null;
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = `${event.clientX}px`;
        tooltipEl.style.top = `${event.clientY}px`;
        
        const typeText = foundStar.starType ? `<div style="color: #ffaa33; font-size: 11px;">${tr('orrery.star_class', `<b>${foundStar.starType}</b>`)} ${foundStar.isScoopable ? '⛽ (Scoopable)' : ''}</div>` : '';
        const popNote = (foundStar.population && foundStar.population > 0) ? `<div style="color: #00d4ff; font-size: 11px; margin-top: 1px;">${tr('galaxy.population_label')}: <b>${foundStar.population.toLocaleString(getLocale())}</b></div>` : '';
        let stratumNote = '';
        if (foundStar.hasStratumConfirmed) {
            stratumNote = `<div style="color: #2bfca8; font-size: 11px; margin-top: 2px; font-weight: bold;">${tr('galaxy.confirmed_presence')}</div>`;
        } else if (foundStar.hasStratumCandidate) {
            stratumNote = `<div style="color: #ffcc44; font-size: 11px; margin-top: 2px;">${tr('galaxy.potential_first')}</div>`;
        }

        tooltipEl.innerHTML = `
            <div style="color: #00d4ff; font-weight: bold; font-size: 13px;">${foundStar.name}</div>
            ${typeText}
            ${popNote}
            ${stratumNote}
            <div style="color: #a4bedc;">${tr('galaxy.distance')}: <b>${foundStar.distance.toFixed(1)} ly</b></div>
            <div style="color: #6a88a8; font-size: 11px;">[X: ${foundStar.x.toFixed(1)}, Y: ${foundStar.y.toFixed(1)}, Z: ${foundStar.z.toFixed(1)}]</div>
            ${foundStar.bodyCount ? `<div style="color: #2bfca8; font-size: 11px;">${tr('galaxy.bodies_label')}: ${foundStar.bodyCount}</div>` : ''}
        `;
        return;
    }
    currentHoveredStar = null;

    // Prioridade 2: Cubos de Vazio (apenas quando o cursor não estiver em cima de estrela)
    if (voidBoxesGroup && voidBoxesGroup.children.length > 0) {
        raycaster.setFromCamera(mouse, camera);
        const voidIntersects = raycaster.intersectObjects(voidBoxesGroup.children, true);
        if (voidIntersects.length > 0) {
            let hit = voidIntersects[0].object;
            while (hit && (!hit.userData || !hit.userData.isVoid) && hit.parent) {
                hit = hit.parent;
            }
            if (hit && hit.userData && hit.userData.isVoid) {
                const foundVoid = hit.userData.voidData;
                currentHoveredVoid = foundVoid;

                const v = foundVoid;
                tooltipEl.style.display = 'block';
                tooltipEl.style.left = `${event.clientX}px`;
                tooltipEl.style.top = `${event.clientY}px`;

                const titleName = v.systemName || v.id;
                const massLabel = v.massCode ? tr('galaxy.void_mass', v.massCode, v.accuracyLy) : `±${v.size} ly`;
                const sibText = v.siblingsSample ? `<div style="color: #8da4be; font-size: 11px; margin-top: 2px;">${tr('galaxy.void_known_siblings')}: <b style="color: #a4bedc;">${v.siblingsSample}</b></div>` : '';

                const wpHtml = v.waypointSystemName ? `
                    <hr style="border: 0; border-top: 1px solid rgba(0,212,255,0.2); margin: 6px 0;">
                    <div style="color: #2bfca8; font-weight: bold; font-size: 11px;">${tr('galaxy.void_suggested_jump')}</div>
                    <div style="color: #fff; font-size: 13px; font-weight: bold; background: rgba(0,212,255,0.15); padding: 2px 6px; border-radius: 3px; display: inline-block; margin-top: 2px;">
                        ${v.waypointSystemName}
                    </div>
                    <div style="color: #a4bedc; font-size: 11px; margin-top: 2px;">
                        ${tr('galaxy.distance_your_ship')}: <b>${v.waypointDistanceToPlayer.toFixed(1)} ly</b>
                    </div>
                ` : `<div style="color: #8da4be; font-size: 11px;">${tr('galaxy.void_no_nearby_star')}</div>`;

                tooltipEl.innerHTML = `
                    <div style="color: #ffaa00; font-weight: bold; font-size: 13px;">${tr('galaxy.void_tooltip_title')}</div>
                    <div style="color: #fff; font-size: 14px; font-weight: bold; margin-top: 2px;">${titleName}</div>
                    <div style="color: #2bfca8; font-size: 11px; margin-top: 2px;">${tr('galaxy.void_certainty')}: <b>${tr('galaxy.void_certainty_val')}</b></div>
                    <div style="color: #a4bedc; font-size: 11px;">${tr('galaxy.void_subblock')}: <b>${massLabel}</b></div>
                    <div style="color: #6a88a8; font-size: 11px;">${tr('galaxy.void_est_dist')}: <b>${v.distanceToPlayer.toFixed(1)} ly</b></div>
                    ${sibText}
                    ${wpHtml}
                `;
                return;
            }
        }
    }
    currentHoveredVoid = null;
    tooltipEl.style.display = 'none';
}

// Ao soltar o clique: se não foi arraste de câmera, fixa o alvo imediatamente!
function onPointerUp(event) {
    if (event.target.closest('.hud-interactive') || event.target.closest('#selected-target-card')) {
        return;
    }

    // Calcula a distância do arraste
    const dx = event.clientX - pointerDownPos.x;
    const dy = event.clientY - pointerDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Se moveu mais de 6 pixels, foi uma rotação/movimento de câmera, ignora seleção
    if (dist > 6) {
        return;
    }

    // Prioridade 1: Verifica estrela diretamente na tela no exato ponto do clique (tolerância de 16 pixels)
    const star = findStarAtScreenPos(event.clientX, event.clientY, 16);
    if (star) {
        pinStarCard(star);
        return;
    }

    // Prioridade 2: Objeto sob o cursor validado pelo hover
    if (currentHoveredStar) {
        pinStarCard(currentHoveredStar);
        return;
    }
    if (currentHoveredVoid) {
        pinVoidCard(currentHoveredVoid);
        return;
    }

    // Prioridade 3: Cubo de Vazio clicado diretamente
    if (voidBoxesGroup && voidBoxesGroup.children.length > 0) {
        const container = document.getElementById('viewport-container');
        mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const voidIntersects = raycaster.intersectObjects(voidBoxesGroup.children, true);
        if (voidIntersects.length > 0) {
            let hit = voidIntersects[0].object;
            while (hit && (!hit.userData || !hit.userData.isVoid) && hit.parent) {
                hit = hit.parent;
            }
            if (hit && hit.userData && hit.userData.isVoid) {
                pinVoidCard(hit.userData.voidData);
                return;
            }
        }
    }

    // Se clicou no espaço vazio (sem arrastar) e havia um alvo selecionado, desmarca e volta o eixo para a nave
    if (currentPinnedStarName || currentPinnedVoidId || (targetCardEl && targetCardEl.style.display !== 'none')) {
        deselectTarget();
    }
}

let currentPinnedStarName = null;
let currentPinnedVoidId = null;

function pinStarCard(star) {
    currentPinnedStarName = star.name;
    currentPinnedVoidId = null;

    // Posiciona e exibe a esfera tênue azulada de seleção em volta da estrela clicada
    if (selectedTargetMarker && currentCubeCenter) {
        const rx = star.x - currentCubeCenter.x;
        const ry = star.y - currentCubeCenter.y;
        const rz = star.z - currentCubeCenter.z;
        selectedTargetMarker.position.set(rx, ry, rz);
        selectedTargetMarker.visible = true;
        if (controls) {
            controls.target.set(rx, ry, rz);
        }
    }

    targetCardBadge.textContent = tr('galaxy.system_selected');
    targetCardBadge.style.color = "#00d4ff";
    targetCardBadge.style.background = "rgba(0,212,255,0.2)";

    const typeText = star.starType ? `
        <div style="color: #ffaa33; font-size: 13px; margin-top: 4px;">
            ${tr('orrery.star_class', `<b>${star.starType}</b>`)} ${star.isScoopable ? '⛽ <span style="color: #2bfca8;">(Scoopable)</span>' : ''}
        </div>` : '';

    let stratumHtml = '';
    if (star.stratumCandidates && star.stratumCandidates.length > 0) {
        const confirmed = star.stratumCandidates.filter(p => p.confirmed || p.isConfirmed);
        const potential = star.stratumCandidates.filter(p => !(p.confirmed || p.isConfirmed));

        let confirmedHtml = '';
        if (confirmed.length > 0) {
            const list = confirmed.map(p => {
                let statusBadge = '';
                if (p.alreadyCollected) {
                    const dt = p.collectedDate ? tr('galaxy.on_date', formatShortDate(p.collectedDate)) : '';
                    statusBadge = `<div style="color: #ff4466; font-size: 11px; font-weight: bold; margin-top: 4px; background: rgba(255,68,102,0.15); border: 1px solid rgba(255,68,102,0.4); padding: 2px 6px; border-radius: 3px;">${tr('galaxy.already_collected')}${dt}</div>`;
                } else if (p.alreadyLanded) {
                    const dt = p.landedDate ? tr('galaxy.on_date', formatShortDate(p.landedDate)) : '';
                    statusBadge = `<div style="color: #ffaa33; font-size: 10px; margin-top: 3px;">${tr('galaxy.already_landed_card')}${dt}</div>`;
                }

                return `
                    <div style="margin-top: 6px; padding: 5px 6px; background: rgba(0,0,0,0.3); border-radius: 3px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="color: #fff; font-weight: bold;">${p.planetName}</span>
                                <div style="color: #2bfca8; font-size: 11px; font-weight: 600; margin-top: 2px;">
                                    ✔ ${p.species || 'Stratum Tectonicas'}
                                </div>
                            </div>
                            <div style="color: #a4bedc; font-size: 10px; font-family: monospace;">
                                ${p.distanceLs ? Math.round(p.distanceLs).toLocaleString(getLocale()) + ' ls' : ''}
                            </div>
                        </div>
                        ${statusBadge}
                    </div>
                `;
            }).join('');

            confirmedHtml = `
                <div style="margin-top: 10px; padding: 8px; background: rgba(43, 252, 168, 0.08); border-left: 2px solid #2bfca8; border-radius: 3px;">
                    <div style="color: #2bfca8; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;">
                        ${tr('galaxy.confirmed_presence')}
                    </div>
                    ${list}
                </div>
            `;
        }

        let potentialHtml = '';
        if (potential.length > 0) {
            const list = potential.map(p => {
                const isFirst = p.firstDiscovery || p.isFirstDiscovery;
                const firstBadge = isFirst ? `<span title="${tr('galaxy.first_badge_title')}" style="background: rgba(43,252,168,0.15); color: #2bfca8; border: 1px solid #2bfca8; border-radius: 3px; font-size: 9px; padding: 1px 4px; margin-left: 6px; font-weight: bold;">⭐ 1st</span>` : '';
                const mapBadge = `<span title="${tr('galaxy.never_mapped_title')}" style="background: rgba(0,212,255,0.15); color: #00d4ff; border: 1px solid rgba(0,212,255,0.4); border-radius: 3px; font-size: 9px; padding: 1px 4px; margin-left: 4px; font-weight: bold;">${tr('galaxy.never_mapped')}</span>`;

                let statusBadge = '';
                if (p.alreadyCollected) {
                    const dt = p.collectedDate ? tr('galaxy.on_date', formatShortDate(p.collectedDate)) : '';
                    statusBadge = `<div style="color: #ff4466; font-size: 11px; font-weight: bold; margin-top: 4px; background: rgba(255,68,102,0.15); border: 1px solid rgba(255,68,102,0.4); padding: 2px 6px; border-radius: 3px;">${tr('galaxy.already_collected')}${dt}</div>`;
                } else if (p.alreadyLanded) {
                    const dt = p.landedDate ? tr('galaxy.on_date', formatShortDate(p.landedDate)) : '';
                    statusBadge = `<div style="color: #ffaa33; font-size: 10px; margin-top: 3px;">${tr('galaxy.already_landed_card')}${dt}</div>`;
                }

                return `
                    <div style="margin-top: 6px; padding: 4px 6px; background: rgba(0,0,0,0.25); border-radius: 3px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="color: #fff; font-weight: bold;">${p.planetName}</span>${firstBadge}${mapBadge}
                                <div style="color: #8da4be; font-size: 10px; margin-top: 2px;">
                                    ${p.atmosphere || tr('galaxy.thin_atmosphere')} • ${p.gravity ? p.gravity.toFixed(2) + 'G' : '<0.7G'}${p.surfaceTemperature ? ` • <span style="color: #ffcc44;">${Math.round(p.surfaceTemperature)} K</span>` : ''}
                                </div>
                            </div>
                            <div style="color: #a4bedc; font-size: 10px; font-family: monospace;">
                                ${p.distanceLs ? Math.round(p.distanceLs).toLocaleString(getLocale()) + ' ls' : ''}
                            </div>
                        </div>
                        ${statusBadge}
                    </div>
                `;
            }).join('');

            potentialHtml = `
                <div style="margin-top: 10px; padding: 8px; background: rgba(255, 204, 68, 0.08); border-left: 2px solid #ffcc44; border-radius: 3px;">
                    <div style="color: #ffcc44; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;">
                        ${tr('galaxy.potential_first')}
                    </div>
                    ${list}
                </div>
            `;
        }

        stratumHtml = confirmedHtml + potentialHtml;
    }

    const popHtml = (star.population && star.population > 0) ?
        `<div style="color: #00d4ff; font-size: 12px; margin-top: 4px;">${tr('galaxy.population_label')}: <b>${star.population.toLocaleString(getLocale())} ${tr('galaxy.inhabitants')}</b></div>` : '';

    targetCardContent.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; color: #fff; margin-top: 4px;">
            ${star.name}
        </div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
            <button class="copy-btn" style="flex: 1; margin-top: 0;" onclick="navigator.clipboard.writeText('${star.name}')">
                ${tr('galaxy.copy')}
            </button>
            <a href="/system-orrery.html?system=${encodeURIComponent(star.name)}" style="flex: 1; text-decoration: none; background: rgba(255,170,0,0.15); border: 1px solid rgba(255,170,0,0.45); color: #ffaa00; font-size: 11px; font-weight: bold; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,170,0,0.28)'" onmouseout="this.style.background='rgba(255,170,0,0.15)'">
                ${tr('galaxy.system_3d')}
            </a>
        </div>
        ${typeText}
        <div style="margin-top: 8px; font-size: 13px; color: #a4bedc;">
            ${tr('galaxy.distance_ship')}: <b style="color: #fff;">${star.distance.toFixed(1)} ly</b>
        </div>
        ${popHtml}
        ${star.bodyCount ? `<div style="color: #2bfca8; font-size: 12px; margin-top: 4px;">${tr('galaxy.celestial_bodies_label')}: <b>${star.bodyCount}</b></div>` : ''}
        ${stratumHtml}
    `;
    targetCardEl.style.display = 'block';
}

function pinVoidCard(v) {
    currentPinnedStarName = null;
    currentPinnedVoidId = v.systemName || v.id;
    if (selectedTargetMarker) {
        selectedTargetMarker.visible = false;
    }
    if (controls && currentCubeCenter) {
        controls.target.set(v.centerX - currentCubeCenter.x, v.centerY - currentCubeCenter.y, v.centerZ - currentCubeCenter.z);
    }
    const titleName = v.systemName || v.id;

    targetCardBadge.textContent = tr('galaxy.void_badge');
    targetCardBadge.style.color = "#ffaa00";
    targetCardBadge.style.background = "rgba(255,170,0,0.18)";

    const wpHtml = v.waypointSystemName ? `
        <div style="margin-top: 10px; padding: 8px; background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); border-radius: 4px;">
            <div style="color: #2bfca8; font-weight: bold; font-size: 11px;">${tr('galaxy.void_suggested_jump')}</div>
            <div style="color: #fff; font-size: 14px; font-weight: bold; margin: 4px 0;">
                ${v.waypointSystemName}
            </div>
            <div style="color: #a4bedc; font-size: 11px; margin-top: 4px;">
                ${tr('galaxy.distance_ship')}: <b style="color: #fff;">${v.waypointDistanceToPlayer.toFixed(1)} ly</b>
            </div>
            <div style="color: #6a88a8; font-size: 11px;">
                ${tr('galaxy.void_to_target')}: <b>~${v.waypointDistanceToVoid.toFixed(1)} ly</b>
            </div>
        </div>
    ` : `<div style="color: #8da4be; font-size: 12px; margin-top: 6px;">${tr('galaxy.void_no_edge_system')}</div>`;

    targetCardContent.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; color: #fff; margin-top: 4px;">
            ${titleName}
        </div>
        <div style="font-size: 12px; color: #a4bedc; margin-top: 8px;">
            ${tr('galaxy.void_mass_class')}: <b style="color: #fff;">${v.massCode || 'C'}</b> (${tr('galaxy.void_spatial_acc', v.accuracyLy || 40)})
        </div>
        <div style="font-size: 12px; color: #8da4be; margin-top: 2px;">
            ${tr('galaxy.distance_ship')}: <b style="color: #fff;">${v.distanceToPlayer.toFixed(1)} ly</b>
        </div>
        ${wpHtml}
    `;
    targetCardEl.style.display = 'block';
}

function animate() {
    requestAnimationFrame(animate);

    // Animação sutil do marcador do jogador
    if (playerMarker) {
        playerMarker.rotation.y += 0.01;
    }

    // Animação viva dos anéis estilo Saturno (girando rápido transversalmente como moeda, criando efeito pulsante de estrela cintilante)
    if (stratumRingsGroup && stratumRingsGroup.children.length > 0) {
        const count = stratumRingsGroup.children.length;
        for (let i = 0; i < count; i++) {
            stratumRingsGroup.children[i].rotation.y += 0.045;
        }
    }

    // Animação da esfera tênue e retículo da estrela selecionada
    if (selectedTargetMarker && selectedTargetMarker.visible) {
        selectedTargetMarker.rotation.y += 0.015;
        const pulse = 1.0 + 0.07 * Math.sin(Date.now() * 0.004);
        selectedTargetMarker.scale.set(pulse, pulse, pulse);
    }

    // Animação das balizas holográficas de Sistemas Não Catalogados (gaps procedurais)
    if (voidBoxesGroup && voidBoxesGroup.children.length > 0) {
        for (let i = 0; i < voidBoxesGroup.children.length; i++) {
            const beacon = voidBoxesGroup.children[i];
            beacon.rotation.y += 0.018;
            beacon.rotation.x += 0.009;
        }
    }

    // Animação dos feixes quânticos de saltos de Comandantes (EDDN / Saltos)
    if (activeBeams.length > 0) {
        const now = performance.now();
        for (let i = activeBeams.length - 1; i >= 0; i--) {
            const b = activeBeams[i];
            const elapsed = (now - b.startTime) / 1000;
            const progress = elapsed / b.duration;
            if (progress >= 1.0) {
                b.dispose();
                activeBeams.splice(i, 1);
            } else {
                b.update(progress);
            }
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

// Carrega os dados do cubo galáctico da API
let lastGalaxyCubeData = null;
let lastStationsCache = { system: '', list: null };
let lastEdsmData = null;
let lastPlayerInfo = null;

async function loadGalaxyCube(size, voxelSize) {
    showCubeLoading(tr('galaxy.loading_mapping'));
    try {
        const queryParams = new URLSearchParams({
            size: size || DEFAULT_CUBE_SIZE,
            voxelSize: voxelSize || DEFAULT_VOXEL_SIZE
        });

        // Adiciona coordenadas se disponíveis
        if (currentCenter.x !== undefined) {
            queryParams.append('x', currentCenter.x);
            queryParams.append('y', currentCenter.y);
            queryParams.append('z', currentCenter.z);
            queryParams.append('system', currentCenter.system);
        }

        const res = await fetch(`/api/galaxy/cube?${queryParams.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        renderGalaxyData(data);
    } catch (err) {
        console.error('Erro ao carregar cubo galáctico:', err);
        if (statsEl) {
            statsEl.innerHTML = `<span style="color: #ff6666;">${tr('galaxy.edsm_error')}</span>`;
        }
    } finally {
        hideCubeLoading();
    }
}

let isFirstLoad = true;

// Cria anel estilo Saturno com raio rente ao tamanho da estrela e rotação tridimensional
function createStratumRing(star, rx, ry, rz) {
    const isConfirmed = star.hasStratumConfirmed;
    // Verde Neon para Confirmados no Spansh; Âmbar para Potenciais Inéditos
    const ringColor = isConfirmed ? 0x2bfca8 : 0xffcc44;
    const ringOpacity = isConfirmed ? 0.95 : 0.85;

    // Raio rente à estrela estilo Saturno: raio interno 0.60, externo 0.76 (espessura fina e proporcional)
    const ringGeo = new THREE.RingGeometry(0.60, 0.76, 48);
    const ringMat = new THREE.MeshBasicMaterial({
        color: ringColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: ringOpacity,
        depthWrite: false
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(rx, ry, rz);

    // Inclinação física permanente no espaço 3D (~55° em relação ao plano galáctico)
    ringMesh.rotation.x = Math.PI * 0.30;
    // Fase inicial levemente defasada por coordenadas para não girarem todos idênticos
    ringMesh.rotation.y = Math.abs((star.x * 7.1 + star.z * 13.3)) % (Math.PI * 2);

    ringMesh.userData = { systemName: star.name, isStratumRing: true };
    return ringMesh;
}

let starSharedTexture = null;

function getStarTexture() {
    if (starSharedTexture) return starSharedTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1.0)');       // Núcleo estelar nítido e definido
    grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');   // Disco estelar sólido
    grad.addColorStop(0.6, 'rgba(160,220,255,0.18)');    // Glow delicado e muito contido
    grad.addColorStop(0.85, 'rgba(0,180,230,0.03)');     // Atenuação rápida
    grad.addColorStop(1, 'rgba(0,0,0,0)');               // Borda 100% limpa
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    starSharedTexture = new THREE.CanvasTexture(canvas);
    return starSharedTexture;
}

// Filtra e atualiza os sistemas visíveis conforme o botão Liga/Desliga ("Apenas Habitados" vs "Todos")
function updateVisibleStars() {
    if (!allReceivedStars) return;

    if (filterInhabitedOnly) {
        starDataList = allReceivedStars.filter(star => {
            // Sistemas com Stratum aparecem de qualquer forma
            const hasStratum = star.hasStratumConfirmed || star.hasStratumCandidate || (star.stratumCandidates && star.stratumCandidates.length > 0);
            const isHabited = star.inhabited || (star.population && star.population > 0);
            return hasStratum || isHabited;
        });
    } else {
        starDataList = allReceivedStars;
    }

    renderStarPointsAndRings();
    updateStratumRadar();
}

function renderStarPointsAndRings() {
    if (!currentCubeCenter) return;
    const cx = currentCubeCenter.x;
    const cy = currentCubeCenter.y;
    const cz = currentCubeCenter.z;

    if (starPointsMesh) {
        scene.remove(starPointsMesh);
    }

    const positions = [];
    const colors = [];

    starDataList.forEach(star => {
        const rx = star.x - cx;
        const ry = star.y - cy;
        const rz = star.z - cz;
        positions.push(rx, ry, rz);

        const starColor = getStarColor(star.starType);
        colors.push(starColor.r, starColor.g, starColor.b);
    });

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
        size: 1.8,
        vertexColors: true,
        map: getStarTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    starPointsMesh = new THREE.Points(starGeo, starMat);
    scene.add(starPointsMesh);

    // 2.1. Renderiza anéis de Stratum (sempre preservados)
    while (stratumRingsGroup.children.length > 0) {
        stratumRingsGroup.remove(stratumRingsGroup.children[0]);
    }

    starDataList.forEach(star => {
        if (star.stratumCandidates && star.stratumCandidates.length > 0) {
            const rx = star.x - cx;
            const ry = star.y - cy;
            const rz = star.z - cz;
            const ringMesh = createStratumRing(star, rx, ry, rz);
            stratumRingsGroup.add(ringMesh);
        }
    });
}

function updateStatsSummary(data) {
    if (!statsEl || !data) return;
    const cubeSize = data.cubeSize;
    let sourceBadge = '';
    if (data.dataSource === 'CACHE') {
        sourceBadge = `<div style="margin-top:4px;font-size:11px;color:#2bfca8;">${tr('galaxy.source_cache')}</div>`;
    } else if (data.dataSource === 'EDSM') {
        sourceBadge = `<div style="margin-top:4px;font-size:11px;color:#00d4ff;">${tr('galaxy.source_edsm')}</div>`;
    } else if (data.dataSource === 'STALE_CACHE') {
        sourceBadge = `<div style="margin-top:4px;font-size:11px;color:#ffaa00;">${tr('galaxy.source_stale')} <button onclick="loadGalaxyCube()" style="margin-left:6px;padding:1px 6px;font-size:10px;cursor:pointer;">${tr('galaxy.btn_refresh')}</button></div>`;
    } else if (data.dataSource === 'LOCAL_ONLY') {
        sourceBadge = `<div style="margin-top:4px;font-size:11px;color:#ff6666;">${tr('galaxy.source_local')} <button onclick="loadGalaxyCube()" style="margin-left:6px;padding:1px 6px;font-size:10px;cursor:pointer;">${tr('galaxy.btn_retry')}</button></div>`;
    }
    statsEl.innerHTML = `
        <div>${tr('galaxy.stats_central')}: <b style="color: #fff;">${data.centralSystem}</b></div>
        <div>${tr('galaxy.stats_cube')}: <b>${cubeSize} x ${cubeSize} x ${cubeSize} ly</b></div>
        <div>${tr('galaxy.stats_known')}: <b style="color: #00d4ff;">${data.totalKnownSystems}</b></div>
        <div>${tr('galaxy.stats_gaps')}: <b style="color: #ffaa00;">${data.detectedVoidCount}</b></div>
        ${sourceBadge}
    `;
}

// Renderiza os sistemas e os cubos de vazios na cena 3D
function renderGalaxyData(data) {
    lastGalaxyCubeData = data;
    const cx = data.centerX;
    const cy = data.centerY;
    const cz = data.centerZ;
    const cubeSize = data.cubeSize;
    currentCubeCenter = { x: cx, y: cy, z: cz };

    // No primeiro carregamento ou ao alterar o tamanho do cubo, ajusta a câmera para enquadrar o cubo completo
    if (isFirstLoad) {
        isFirstLoad = false;
        const dist = cubeSize * 1.85;
        camera.position.set(0, dist * 0.5, dist * 0.95);
        controls.target.set(0, 0, 0);
        camera.updateProjectionMatrix();
    }

    updateStatsSummary(data);

    // 1. Atualiza o Bounding Box do Cubo Principal
    if (boundaryCubeMesh) {
        scene.remove(boundaryCubeMesh);
    }
    const boxGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    boundaryCubeMesh = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.25
    }));
    scene.add(boundaryCubeMesh);

    // 1b. Atualiza a Grade Horizontal do Planisfério (eixo Y = 0 local) para cobrir exatamente a área do cubo
    if (galacticGridMesh) {
        scene.remove(galacticGridMesh);
    }
    const gridDivisions = Math.max(10, Math.round(cubeSize / 5));
    galacticGridMesh = new THREE.GridHelper(cubeSize, gridDivisions, 0x00d4ff, 0x07223d);
    galacticGridMesh.position.y = 0;
    scene.add(galacticGridMesh);

    // 2. Registra e renderiza as estrelas conhecidas (respeitando o filtro de Apenas Habitados vs Todos)
    allReceivedStars = data.systems || [];
    updateVisibleStars();

    // Mantém o marcador de seleção posicionado se o sistema continuar no cubo
    if (currentPinnedStarName && allReceivedStars && selectedTargetMarker) {
        const pinned = allReceivedStars.find(s => s.name.toLowerCase().trim() === currentPinnedStarName.toLowerCase().trim());
        if (pinned) {
            selectedTargetMarker.position.set(pinned.x - cx, pinned.y - cy, pinned.z - cz);
            selectedTargetMarker.visible = true;
        } else {
            selectedTargetMarker.visible = false;
        }
    }

    // 3. Renderiza os Marcadores Holográficos de Sistemas Não Catalogados (Gaps Procedurais)
    while (voidBoxesGroup.children.length > 0) {
        voidBoxesGroup.remove(voidBoxesGroup.children[0]);
    }

    currentVoidSectors = data.voidSectors || [];
    currentVoidSectors.forEach(v => {
        // Baliza holográfica estilo diamante (octaedro) - tamanho discreto e proporcional
        const diamondGeo = new THREE.OctahedronGeometry(1.05, 0);
        const diamondMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00, // Âmbar Estelar Dourado
            wireframe: true,
            transparent: true,
            opacity: 0.88
        });

        const mesh = new THREE.Mesh(diamondGeo, diamondMat);
        mesh.position.set(v.centerX - cx, v.centerY - cy, v.centerZ - cz);
        mesh.userData = { isVoid: true, voidData: v, isGhostStar: true };

        // Núcleo central com leve glow
        const coreGeo = new THREE.SphereGeometry(0.45, 12, 8);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffcc33,
            transparent: true,
            opacity: 0.45,
            depthWrite: false
        });
        mesh.add(new THREE.Mesh(coreGeo, coreMat));

        // Esfera invisível para tolerância confortável de clique e hover
        const hitGeo = new THREE.SphereGeometry(1.8, 8, 6);
        const hitMat = new THREE.MeshBasicMaterial({
            visible: false
        });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.userData = { isVoid: true, voidData: v };
        mesh.add(hitMesh);

        voidBoxesGroup.add(mesh);
    });

    // 4. Se houver ROTA ATIVA traçada no computador de bordo do jogo (NavRoute.json),
    // desenha uma linha contínua branca conectando as estrelas dentro e através do cubo!
    if (activeRouteLine) {
        scene.remove(activeRouteLine);
        activeRouteLine = null;
    }

    if (data.activeRoute && data.activeRoute.length >= 2) {
        const routePoints = [];
        data.activeRoute.forEach(pt => {
            // Converte coordenada global para local em relação ao centro (cx, cy, cz)
            routePoints.push(new THREE.Vector3(pt.x - cx, pt.y - cy, pt.z - cz));
        });

        const routeGeo = new THREE.BufferGeometry().setFromPoints(routePoints);
        const routeMat = new THREE.LineBasicMaterial({
            color: 0xffffff, // Linha contínua branca
            linewidth: 2,
            transparent: true,
            opacity: 0.95
        });

        activeRouteLine = new THREE.Line(routeGeo, routeMat);
        scene.add(activeRouteLine);
    }

    // Atualiza o radar Top 3 Stratum, Top 3 Gaps Procedurais e busca estações do sistema atual
    updateStratumRadar();
    updateGapsRadar();
    loadCurrentSystemStations(data.centralSystem);
}

function updateCoordsDisplay(commander, sysName) {
    if (!coordsDisplayEl) return;
    coordsDisplayEl.innerHTML = `
        <span>CMDR: <b>${commander || tr('galaxy.cmdr_unknown')}</b></span> |
        <span>${tr('galaxy.system_label')}: <b>${sysName || tr('galaxy.cmdr_unknown')}</b></span>
    `;
}

// Monitora o status do jogador através do Journal Watcher do backend
async function checkPlayerStatus() {
    try {
        const res = await fetch('/api/player/status');
        if (!res.ok) return;
        const player = await res.json();
        lastPlayerInfo = player;

        const sysName = player.currentSystem || tr('galaxy.cmdr_unknown');
        const px = player.posX !== null ? player.posX : 0.0;
        const py = player.posY !== null ? player.posY : 0.0;
        const pz = player.posZ !== null ? player.posZ : 0.0;
        if (player.commander) currentCommanderName = player.commander;

        currentCenter = { x: px, y: py, z: pz, system: sysName };

        updateCoordsDisplay(player.commander, sysName);

        // Atualiza automaticamente:
        // 1. Se você saltar de sistema (FSDJump)
        // 2. Se você traçar ou alterar uma rota no mapa da galáxia (NavRoute.json)
        const routeChanged = player.navRouteTimestamp && player.navRouteTimestamp !== lastRouteTimestamp;
        const systemChanged = !lastScannedSystem || (lastScannedSystem.toLowerCase() !== sysName.toLowerCase());

        if (systemChanged || routeChanged) {
            console.log(`📡 [PlayerStatus] Atualização do Cubo: systemChanged=${systemChanged} (${lastScannedSystem} -> ${sysName}), routeChanged=${routeChanged}`);
            lastScannedSystem = sysName;
            lastRouteTimestamp = player.navRouteTimestamp || 0;
            currentPinnedStarName = null;
            if (selectedTargetMarker) selectedTargetMarker.visible = false;
            controls.target.set(0, 0, 0);
            controls.update();
            loadGalaxyCube();
        }

        // Atualiza estações do sistema atual
        loadCurrentSystemStations(sysName);
    } catch (e) {
        console.warn('Falha ao checar status do journal:', e);
    }
}

// Polling educado de descobertas em background de Stratum Tectonicas
async function pollStratumUpdates() {
    if (!allReceivedStars || allReceivedStars.length === 0 || !currentCubeCenter) return;
    try {
        const res = await fetch('/api/galaxy/stratum/candidates');
        if (!res.ok) return;
        const candidatesMap = await res.json();
        if (!candidatesMap || Object.keys(candidatesMap).length === 0) return;

        let needsCardUpdate = false;

        allReceivedStars.forEach(star => {
            const key = star.name.toLowerCase().trim();
            const candidates = candidatesMap[key];
            if (candidates && candidates.length > 0) {
                star.stratumCandidates = candidates;
                star.hasStratumCandidate = true;

                if (currentPinnedStarName && currentPinnedStarName.toLowerCase().trim() === key) {
                    needsCardUpdate = true;
                }
            }
        });

        // Re-renderiza respeitando o filtro ativo
        updateVisibleStars();

        if (needsCardUpdate && targetCardEl && targetCardEl.style.display !== 'none') {
            const pinnedStar = allReceivedStars.find(s => s.name.toLowerCase().trim() === currentPinnedStarName.toLowerCase().trim());
            if (pinnedStar) {
                pinStarCard(pinnedStar);
            }
        }

        // Mantém o Radar Top 5 atualizado conforme novos sistemas biológicos forem identificados
        updateStratumRadar();
    } catch (e) {
        // Silencioso em caso de oscilação momentânea de conexão
    }
}

function formatShortDate(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString(getLocale());
    } catch (e) {
        return iso;
    }
}

// Radar Top 3: Exibe os 3 sistemas mais próximos com Stratum/Biologia no card lateral direito
function updateStratumRadar() {
    const radarListEl = document.getElementById('stratumRadarList');
    const countBadge = document.getElementById('radarCountBadge');
    if (!radarListEl || !allReceivedStars) return;

    // Filtra estrelas que possuem corpos biológicos detectados ou confirmados
    const stratumStars = allReceivedStars.filter(s => 
        (s.stratumCandidates && s.stratumCandidates.length > 0) || 
        s.hasStratumConfirmed || 
        s.hasStratumCandidate
    );

    // Prioriza sistemas que ainda possuem planetas não coletados, depois ordena por distância
    stratumStars.sort((a, b) => {
        const aHasUncollected = a.stratumCandidates && a.stratumCandidates.some(p => !p.alreadyCollected);
        const bHasUncollected = b.stratumCandidates && b.stratumCandidates.some(p => !p.alreadyCollected);
        if (aHasUncollected && !bHasUncollected) return -1;
        if (!aHasUncollected && bHasUncollected) return 1;
        return a.distance - b.distance;
    });

    const top3 = stratumStars.slice(0, 3);
    if (countBadge) {
        countBadge.textContent = tr('galaxy.in_cube', stratumStars.length);
    }

    if (top3.length === 0) {
        radarListEl.innerHTML = `<div style="color: #6a88a8; font-size: 11px; font-style: italic; padding: 4px 0;">${tr('galaxy.scanning_bodies')}</div>`;
        return;
    }

    radarListEl.innerHTML = top3.map(star => {
        let planetItems = '';
        if (star.stratumCandidates && star.stratumCandidates.length > 0) {
            planetItems = star.stratumCandidates.map(p => {
                let planetLabel = p.planetName;
                if (planetLabel.toLowerCase().startsWith(star.name.toLowerCase())) {
                    planetLabel = planetLabel.substring(star.name.length).trim();
                }
                const distLsText = p.distanceLs ? `${Math.round(p.distanceLs).toLocaleString(getLocale())} ls` : '';

                let statusBadge = '';
                if (p.alreadyCollected) {
                    statusBadge = `<span style="color: #ff4466; background: rgba(255,68,102,0.18); border: 1px solid rgba(255,68,102,0.45); padding: 1px 5px; border-radius: 2px; font-size: 9px; font-weight: bold;" title="${tr('galaxy.collected_tooltip', formatShortDate(p.collectedDate))}">${tr('galaxy.already_collected')}</span>`;
                } else if (p.alreadyLanded) {
                    statusBadge = `<span style="color: #ffaa33; background: rgba(255,170,51,0.18); border: 1px solid rgba(255,170,51,0.45); padding: 1px 5px; border-radius: 2px; font-size: 9px; font-weight: bold;" title="${tr('galaxy.landed_tooltip', formatShortDate(p.landedDate))}">${tr('galaxy.already_landed')}</span>`;
                } else if (p.confirmed) {
                    statusBadge = `<span style="color: #2bfca8; background: rgba(43,252,168,0.15); border: 1px solid rgba(43,252,168,0.4); padding: 1px 5px; border-radius: 2px; font-size: 9px; font-weight: bold;">${tr('galaxy.confirmed_badge')}</span>`;
                } else {
                    statusBadge = `<span style="color: #ffcc44; background: rgba(255,204,68,0.15); border: 1px solid rgba(255,204,68,0.4); padding: 1px 5px; border-radius: 2px; font-size: 9px; font-weight: bold;" title="${tr('galaxy.potential_tooltip')}">${tr('galaxy.potential_badge')}</span>`;
                }

                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11px;">
                        <div>
                            <span style="color: ${p.alreadyCollected ? '#8da4be; text-decoration: line-through;' : '#fff;'}; font-weight: bold;">${planetLabel}</span>
                            ${p.surfaceTemperature ? `<span style="color: #8da4be; font-size: 9px; margin-left: 4px;">(${Math.round(p.surfaceTemperature)}K)</span>` : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #a4bedc; font-family: monospace; font-size: 10px;">${distLsText}</span>
                            ${statusBadge}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            const isConf = star.hasStratumConfirmed;
            planetItems = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11px;">
                    <span style="color: #8da4be;">${tr('galaxy.stratum_planet')}</span>
                    ${isConf 
                        ? `<span style="color: #2bfca8; background: rgba(43,252,168,0.15); border: 1px solid rgba(43,252,168,0.4); padding: 1px 5px; border-radius: 2px; font-size: 9px; font-weight: bold;">${tr('galaxy.confirmed_badge')}</span>`
                        : `<span style="color: #ffcc44; background: rgba(255,204,68,0.15); border: 1px solid rgba(255,204,68,0.4); padding: 1px 5px; border-radius: 2px; font-size: 9px; font-weight: bold;" title="${tr('galaxy.potential_tooltip')}">${tr('galaxy.potential_badge')}</span>`
                    }
                </div>
            `;
        }

        const escapedStarName = star.name.replace(/'/g, "\\'");
        return `
            <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(0,212,255,0.18); border-radius: 4px; padding: 6px 8px; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.borderColor='#00d4ff'; this.style.background='rgba(0,212,255,0.08)';"
                 onmouseout="this.style.borderColor='rgba(0,212,255,0.18)'; this.style.background='rgba(0,0,0,0.35)';"
                 onclick="focusRadarSystem('${escapedStarName}')">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #fff; font-weight: bold; font-size: 12px;">${star.name}</span>
                    <span style="color: #a4bedc; font-size: 11px; font-family: monospace;">${star.distance.toFixed(1)} ly</span>
                </div>
                <div style="margin-top: 4px; padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.06);">
                    ${planetItems}
                </div>
            </div>
        `;
    }).join('');
}

function focusRadarSystem(sysName) {
    if (!allReceivedStars) return;
    // Se clicar no mesmo sistema que já está selecionado, desmarca e volta o eixo para a nave
    if (currentPinnedStarName && currentPinnedStarName.toLowerCase().trim() === sysName.toLowerCase().trim()) {
        deselectTarget();
        return;
    }
    const star = allReceivedStars.find(s => s.name.toLowerCase().trim() === sysName.toLowerCase().trim());
    if (star) {
        pinStarCard(star);
        if (currentCubeCenter && controls) {
            controls.target.set(star.x - currentCubeCenter.x, star.y - currentCubeCenter.y, star.z - currentCubeCenter.z);
        }
    }
}

// Radar Top 3 Gaps Procedurais (Quebras de Sequência Matemática Stellar Forge)
function updateGapsRadar() {
    const listEl = document.getElementById('gapsRadarList');
    const badgeEl = document.getElementById('gapsCountBadge');
    if (!listEl) return;

    if (!currentVoidSectors || currentVoidSectors.length === 0) {
        if (badgeEl) badgeEl.textContent = tr('galaxy.in_cube', 0);
        listEl.innerHTML = `<div style="color: #6a88a8; font-size: 11px; font-style: italic; padding: 4px 0;">${tr('galaxy.no_gaps_detected')}</div>`;
        return;
    }

    if (badgeEl) {
        badgeEl.textContent = tr('galaxy.in_cube', currentVoidSectors.length);
    }

    // Ordena pela distância da nave do jogador
    const sortedGaps = [...currentVoidSectors].sort((a, b) => a.distanceToPlayer - b.distanceToPlayer);
    const top3 = sortedGaps.slice(0, 3);

    listEl.innerHTML = top3.map(gap => {
        const titleName = gap.systemName || gap.id;
        const distStr = `${gap.distanceToPlayer.toFixed(1)} ly`;
        const waypoint = gap.waypointSystemName || tr('galaxy.none_nearby');
        const escapedId = (gap.systemName || gap.id).replace(/'/g, "\\'");

        return `
            <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,170,0,0.22); border-radius: 4px; padding: 6px 8px; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.borderColor='#ffaa00'; this.style.background='rgba(255,170,0,0.08)';"
                 onmouseout="this.style.borderColor='rgba(255,170,0,0.22)'; this.style.background='rgba(0,0,0,0.35)';"
                 onclick="focusGapSystem('${escapedId}')">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #fff; font-weight: bold; font-size: 12px;">${titleName}</span>
                    <span style="color: #2bfca8; font-size: 11px; font-family: monospace; font-weight: 600;">${distStr}</span>
                </div>
                <div style="margin-top: 3px; font-size: 11px; color: #8da4be; display: flex; align-items: center; gap: 4px;">
                    <span>${tr('galaxy.jump_ref')}</span>
                    <b style="color: #00d4ff;">${waypoint}</b>
                </div>
            </div>
        `;
    }).join('');
}

function focusGapSystem(gapIdOrName) {
    if (!currentVoidSectors) return;
    if (currentPinnedVoidId && currentPinnedVoidId.toLowerCase() === gapIdOrName.toLowerCase()) {
        deselectTarget();
        return;
    }
    const gap = currentVoidSectors.find(v => 
        (v.systemName && v.systemName.toLowerCase() === gapIdOrName.toLowerCase()) || 
        (v.id && v.id.toLowerCase() === gapIdOrName.toLowerCase())
    );
    if (gap) {
        pinVoidCard(gap);
        if (currentCubeCenter && controls) {
            controls.target.set(gap.centerX - currentCubeCenter.x, gap.centerY - currentCubeCenter.y, gap.centerZ - currentCubeCenter.z);
        }
    }
}

// Estações no Sistema Atual (Ancoragem segura para pausar o jogo)
let lastLoadedStationsSystem = null;

function renderStationsList(sys, stations) {
    const listEl = document.getElementById('currentStationsList');
    const titleEl = document.getElementById('stationsSystemTitle');
    const countBadge = document.getElementById('stationsCountBadge');
    if (!listEl) return;

    if (!sys || sys === 'Posição Atual' || sys === 'Desconhecido' || sys === tr('galaxy.cmdr_unknown')) {
        listEl.innerHTML = `<div style="color: #6a88a8; font-size: 11px; font-style: italic;">${tr('galaxy.waiting_journal_signal')}</div>`;
        return;
    }

    if (titleEl) titleEl.textContent = sys;
    if (countBadge) countBadge.textContent = tr('galaxy.docks_orbital_count', stations ? stations.length : 0);

    if (!stations || stations.length === 0) {
        listEl.innerHTML = `
            <div style="color: #8da4be; font-size: 11px; font-style: italic; padding: 6px; background: rgba(0,0,0,0.25); border-radius: 3px;">
                ${tr('galaxy.no_orbital_stations')}<br>
                <span style="color: #ffaa33; font-size: 10px;">${tr('galaxy.deep_space_no_docks')}</span>
            </div>
        `;
        return;
    }

    listEl.innerHTML = stations.map(st => {
        let icon = '🛰️';
        let typeColor = '#00d4ff';
        const lowerType = (st.type || '').toLowerCase();
        if (lowerType.includes('starport') || lowerType.includes('coriolis') || lowerType.includes('orbis') || lowerType.includes('ocellus')) {
            icon = '🪐';
            typeColor = '#2bfca8';
        } else if (lowerType.includes('fleet carrier')) {
            icon = '🚀';
            typeColor = '#d0aaff';
        } else if (lowerType.includes('outpost') || lowerType.includes('asteroid')) {
            icon = '🛰️';
            typeColor = '#00d4ff';
        }

        const distFmt = st.distanceLs ? Math.round(st.distanceLs).toLocaleString(getLocale()) + ' ls' : '0 ls';
        const bodyInfo = st.bodyName ? `<div style="color: #6a88a8; font-size: 10px;">${tr('galaxy.orbit_prefix', st.bodyName)}</div>` : '';
        const services = [
            st.hasShipyard ? '🚀 Shipyard' : '',
            st.hasOutfitting ? '🛠️ Outfitting' : ''
        ].filter(Boolean).join(' • ');

        return `
            <div style="background: rgba(0,0,0,0.3); border-left: 2px solid ${typeColor}; border-radius: 3px; padding: 5px 7px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="color: #fff; font-weight: bold; font-size: 12px;">${icon} ${st.name}</div>
                        <div style="color: ${typeColor}; font-size: 10px; font-weight: 600;">${st.type || tr('galaxy.orbital_station_fallback')}</div>
                        ${bodyInfo}
                    </div>
                    <div style="text-align: right;">
                        <span style="color: #a4bedc; font-size: 11px; font-family: monospace;">${distFmt}</span>
                    </div>
                </div>
                ${services ? `<div style="color: #8da4be; font-size: 9px; margin-top: 3px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2px;">${services}</div>` : ''}
            </div>
        `;
    }).join('');
}

async function loadCurrentSystemStations(systemName) {
    const listEl = document.getElementById('currentStationsList');
    const titleEl = document.getElementById('stationsSystemTitle');
    if (!listEl) return;

    const sys = systemName || (currentCenter && currentCenter.system);
    if (!sys || sys === 'Posição Atual' || sys === 'Desconhecido' || sys === tr('galaxy.cmdr_unknown')) {
        listEl.innerHTML = `<div style="color: #6a88a8; font-size: 11px; font-style: italic;">${tr('galaxy.waiting_journal_signal')}</div>`;
        return;
    }

    if (titleEl) titleEl.textContent = sys;
    if (lastLoadedStationsSystem === sys) return;

    try {
        const res = await fetch(`/api/galaxy/stations?system=${encodeURIComponent(sys)}`);
        if (!res.ok) return;
        const allStations = await res.json();
        lastLoadedStationsSystem = sys;

        // Filtra para manter somente estações em órbita espacial (exclui bases terrestres/planetárias)
        const stations = (allStations || []).filter(st => {
            const t = (st.type || '').toLowerCase();
            return !t.includes('planetary') && !t.includes('settlement') && !t.includes('surface');
        });

        lastStationsCache = { system: sys, list: stations };
        renderStationsList(sys, stations);
    } catch (err) {
        console.warn('Erro ao buscar estações:', err);
    }
}

// Inicia
init3D();
checkPlayerStatus();
checkEdsmStatus();
setupGalaxyCubeSseListener();

// Polling do Journal a cada 5 segundos (fallback de suporte com SSE ativo)
setInterval(checkPlayerStatus, 5000);

// Conexão SSE reativa para atualizar o cubo galáctico imediatamente em saltos FSD
function setupGalaxyCubeSseListener() {
    if (!window.EventSource) return;
    try {
        const evtSource = new EventSource('/api/events/stream');
        evtSource.addEventListener('system_jump', (e) => {
            try {
                const data = JSON.parse(e.data);
                const newSys = data.system;
                console.log("🚀 [SSE EVENT] Salto de sistema recebido no Cubo Galáctico:", newSys);
                if (newSys && (!lastScannedSystem || newSys.toLowerCase() !== lastScannedSystem.toLowerCase())) {
                    lastScannedSystem = newSys;
                    if (data.x !== undefined && data.y !== undefined && data.z !== undefined && data.x !== null) {
                        currentCenter = { x: data.x, y: data.y, z: data.z, system: newSys };
                    } else {
                        currentCenter.system = newSys;
                    }
                    if (coordsDisplayEl) {
                        updateCoordsDisplay(currentCommanderName || tr('galaxy.commander_fallback'), newSys);
                    }
                    // Limpa alvo fixado e recentra a visualização no novo centro do cubo
                    currentPinnedStarName = null;
                    if (selectedTargetMarker) selectedTargetMarker.visible = false;
                    controls.target.set(0, 0, 0);
                    controls.update();

                    // Dispara a re-triangulação e renderização imediata do novo cubo
                    loadGalaxyCube();
                    loadCurrentSystemStations(newSys);
                }
            } catch (err) {
                console.error("Erro ao processar system_jump via SSE no Cubo:", err);
            }
        });
    } catch (err) {
        console.warn("Falha ao registrar SSE no Cubo Galáctico:", err);
    }
}

// Polling incremental de Stratum Tectonicas a cada 3.5 segundos
setInterval(pollStratumUpdates, 3500);

// Polling de status EDSM a cada 5 segundos
setInterval(checkEdsmStatus, 5000);

// Log dos 4 últimos eventos de tráfego (chegadas e partidas)
const recentTrafficLog = [];
const TRAFFIC_AUDIO_STORAGE_KEY = 'elite_explorer_traffic_audio';
let trafficAudioCtx = null;
let trafficAudioEnabled = (() => {
    try {
        return localStorage.getItem(TRAFFIC_AUDIO_STORAGE_KEY) !== '0';
    } catch (_) {
        return true;
    }
})();
const playedTrafficSoundIds = new Set();
let lastTrafficBeepAt = 0;

function ensureTrafficAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!trafficAudioCtx) {
        trafficAudioCtx = new AudioCtx();
    }
    if (trafficAudioCtx.state === 'suspended') {
        trafficAudioCtx.resume().catch(() => {});
    }
    return trafficAudioCtx;
}

function updateTrafficAudioButton() {
    const btn = document.getElementById('btnToggleTrafficAudio');
    if (!btn) return;
    btn.textContent = trafficAudioEnabled ? '🔊' : '🔇';
    btn.style.color = trafficAudioEnabled ? '#00d4ff' : '#6a88a8';
    btn.style.borderColor = trafficAudioEnabled ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.15)';
    btn.style.background = trafficAudioEnabled ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)';
    btn.title = trafficAudioEnabled ? tr('galaxy.traffic_sound_on') : tr('galaxy.traffic_sound_off');
}

function playTrafficBeep(isArrival) {
    if (!trafficAudioEnabled) return;
    const ctx = ensureTrafficAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isArrival) {
        // Bip curto ascendente (chegada ao sistema)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(780, now);
        osc.frequency.exponentialRampToValueAtTime(1120, now + 0.085);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.115);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    } else {
        // Bip curto descendente (saída do sistema)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.095);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.075, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.125);
    }
}

function initTrafficAudioControls() {
    updateTrafficAudioButton();
    const unlock = () => ensureTrafficAudioContext();
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });

    const btn = document.getElementById('btnToggleTrafficAudio');
    if (btn) {
        btn.addEventListener('click', () => {
            trafficAudioEnabled = !trafficAudioEnabled;
            try {
                localStorage.setItem(TRAFFIC_AUDIO_STORAGE_KEY, trafficAudioEnabled ? '1' : '0');
            } catch (_) {}
            updateTrafficAudioButton();
            if (trafficAudioEnabled) {
                ensureTrafficAudioContext();
                playTrafficBeep(true);
            }
        });
    }
}

initTrafficAudioControls();

function addTrafficEventToLog(ev) {
    if (!ev || !ev.systemName) return;
    if (recentTrafficLog.some(existing => existing.id === ev.id)) {
        return;
    }
    recentTrafficLog.unshift(ev);
    if (recentTrafficLog.length > 4) {
        recentTrafficLog.length = 4;
    }
    renderTrafficCard();
}

function renderTrafficCard() {
    const listEl = document.getElementById('trafficEventsList');
    if (!listEl) return;

    if (recentTrafficLog.length === 0) {
        listEl.innerHTML = `<div style="color: #6a88a8; font-size: 11px; font-style: italic; padding: 4px 0;">${tr('galaxy.waiting_sector_traffic')}</div>`;
        return;
    }

    listEl.innerHTML = recentTrafficLog.map(ev => {
        const isArrival = (ev.type === 'JUMP_IN' || ev.type === 'IN');
        const badgeColor = isArrival ? '#2bfca8' : '#ffaa00';
        const icon = isArrival ? '📥' : '📤';
        const actionLine = isArrival ? tr('galaxy.cmdr_arrived') : tr('galaxy.cmdr_departed');
        const timeAgo = formatTimeAgo(ev.timestamp);
        const escapedSys = ev.systemName.replace(/'/g, "\\'");

        return `
            <div style="background: rgba(0,0,0,0.35); border-left: 2px solid ${badgeColor}; border-radius: 3px; padding: 5px 8px; font-size: 11px; cursor: pointer; transition: background 0.2s;"
                 onmouseover="this.style.background='rgba(0,212,255,0.08)';"
                 onmouseout="this.style.background='rgba(0,0,0,0.35)';"
                 onclick="focusRadarSystem('${escapedSys}')"
                 title="${tr('galaxy.focus_system_title', ev.systemName)}">
                <div style="display: flex; justify-content: space-between; align-items: center; color: #a4bedc; font-size: 10.5px;">
                    <span>${icon} ${actionLine}</span>
                    <span style="font-size: 10px; color: #6a88a8; font-family: monospace;">${timeAgo}</span>
                </div>
                <div style="margin-top: 2px; padding-left: 18px; font-weight: bold; font-size: 12px; color: ${badgeColor}; letter-spacing: 0.3px;">
                    ${ev.systemName}
                </div>
            </div>
        `;
    }).join('');
}

function formatTimeAgo(ts) {
    if (!ts) return tr('galaxy.time_now');
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 10) return tr('galaxy.time_now');
    if (sec < 60) return tr('galaxy.time_s', sec);
    const min = Math.floor(sec / 60);
    if (min < 60) return tr('galaxy.time_m', min);
    const hrs = Math.floor(min / 60);
    return tr('galaxy.time_h', hrs);
}

// Atualiza os marcadores de tempo relativo do card a cada 10 segundos
setInterval(renderTrafficCard, 10000);

// Polling de saltos de Comandantes ao vivo (EDDN) a cada 1.2 segundos
setInterval(pollTrafficEvents, 1200);

// Dispara checagem inicial de tráfego
pollTrafficEvents();

async function pollTrafficEvents() {
    if (!currentCubeCenter) return;
    try {
        const isInitial = (lastTrafficCheckTime === 0);
        const res = await fetch(`/api/galaxy/traffic/recent?since=${lastTrafficCheckTime}`);
        if (!res.ok) return;
        const events = await res.json();
        if (events && events.length > 0) {
            events.forEach(ev => {
                if (ev.timestamp > lastTrafficCheckTime) {
                    lastTrafficCheckTime = ev.timestamp;
                }
                addTrafficEventToLog(ev);
                if (!isInitial || (Date.now() - ev.timestamp < 10000)) {
                    triggerJumpBeam(ev);
                    if (!isInitial && ev.id && !playedTrafficSoundIds.has(ev.id)) {
                        playedTrafficSoundIds.add(ev.id);
                        if (playedTrafficSoundIds.size > 200) {
                            const firstId = playedTrafficSoundIds.values().next().value;
                            playedTrafficSoundIds.delete(firstId);
                        }
                        const nowMs = Date.now();
                        if (nowMs - lastTrafficBeepAt >= 200) {
                            lastTrafficBeepAt = nowMs;
                            const isArrival = (ev.type === 'JUMP_IN' || ev.type === 'IN');
                            playTrafficBeep(isArrival);
                        }
                    }
                }
            });
        }
    } catch (e) {
        // Silencioso
    }
}

function triggerJumpBeam(ev) {
    if (!currentCubeCenter) return;
    const cx = currentCubeCenter.x;
    const cy = currentCubeCenter.y;
    const cz = currentCubeCenter.z;

    const relX = ev.x - cx;
    const starY = ev.y - cy;
    const relZ = ev.z - cz;

    const cubeSize = DEFAULT_CUBE_SIZE;
    const ceilingY = cubeSize / 2;

    const isJumpIn = (ev.type === 'JUMP_IN');
    const colorHex = isJumpIn ? 0x32ff44 : 0x00e5ff; // Verde Lime (#32ff44) ou Azul Claro (#00e5ff)

    spawnBeamEffect(relX, starY, relZ, ceilingY, isJumpIn, colorHex);
}

function spawnBeamEffect(relX, starY, relZ, ceilingY, isJumpIn, colorHex) {
    const group = new THREE.Group();
    scene.add(group);

    const totalHeight = Math.max(0.1, Math.abs(ceilingY - starY));

    // 1. Núcleo central de alta energia (Linha vertical fina e nítida)
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array([
        relX, isJumpIn ? ceilingY : starY, relZ,
        relX, isJumpIn ? ceilingY : starY, relZ
    ]);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 1,
        transparent: true,
        opacity: 0.95
    });
    const lineMesh = new THREE.Line(lineGeo, lineMat);
    group.add(lineMesh);

    // 2. Tubo holográfico cilíndrico afinado (raio 0.11 para traço esbelto e elegante)
    const cylGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 8, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const cylMesh = new THREE.Mesh(cylGeo, cylMat);
    cylMesh.visible = false;
    group.add(cylMesh);

    // 3. Faísca condutora de plasma na ponta (afinada para 0.28)
    const tipGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const tipMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const tipMesh = new THREE.Mesh(tipGeo, tipMat);
    tipMesh.position.set(relX, isJumpIn ? ceilingY : starY, relZ);
    group.add(tipMesh);

    // 4. Primeiro anel de onda de choque no ponto de ancoragem estelar
    const ring1Geo = new THREE.RingGeometry(0.15, 0.35, 24);
    const ring1Mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const ring1Mesh = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1Mesh.rotation.x = -Math.PI / 2;
    ring1Mesh.position.set(relX, starY, relZ);
    group.add(ring1Mesh);

    // 5. Segundo anel de onda de choque para o 2º pulso energético
    const ring2Geo = new THREE.RingGeometry(0.15, 0.32, 24);
    const ring2Mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2Mesh.rotation.x = -Math.PI / 2;
    ring2Mesh.position.set(relX, starY, relZ);
    group.add(ring2Mesh);

    const beamObj = {
        startTime: performance.now(),
        duration: 0.75, // Duração rápida acelerada (0.75 segundos com duplo pulso)
        update: function(progress) {
            const posAttr = lineGeo.attributes.position;
            const arr = posAttr.array;

            if (isJumpIn) {
                // Feixe desce rápido do teto (ceilingY) até o sistema (starY) em ~165ms
                if (progress < 0.22) {
                    const t = progress / 0.22;
                    const currentTipY = ceilingY + (starY - ceilingY) * t;

                    arr[0] = relX; arr[1] = ceilingY; arr[2] = relZ;
                    arr[3] = relX; arr[4] = currentTipY; arr[5] = relZ;
                    posAttr.needsUpdate = true;

                    const currentH = Math.max(0.05, Math.abs(ceilingY - currentTipY));
                    cylMesh.visible = true;
                    cylMesh.scale.set(1, currentH, 1);
                    cylMesh.position.set(relX, (ceilingY + currentTipY) / 2, relZ);

                    tipMesh.position.y = currentTipY;
                    tipMesh.visible = true;
                } else {
                    tipMesh.visible = false;

                    arr[0] = relX; arr[1] = ceilingY; arr[2] = relZ;
                    arr[3] = relX; arr[4] = starY; arr[5] = relZ;
                    posAttr.needsUpdate = true;

                    cylMesh.visible = true;
                    cylMesh.scale.set(1, totalHeight, 1);
                    cylMesh.position.set(relX, (ceilingY + starY) / 2, relZ);

                    // Curva de dois pulsos energéticos (Dual Stroke / Duplo Pulso)
                    const tAfter = (progress - 0.22) / 0.78;
                    let pulseOpacity = 0;
                    if (tAfter < 0.35) {
                        // Pulso 1: pico máximo e queda intermediária
                        pulseOpacity = 1.0 - (tAfter / 0.35) * 0.55;
                    } else if (tAfter < 0.65) {
                        // Pulso 2: segundo surto imediato de energia
                        const p2 = (tAfter - 0.35) / 0.30;
                        pulseOpacity = 0.45 + 0.55 * Math.sin(p2 * Math.PI);
                    } else {
                        // Dissipação rápida final
                        const p3 = (tAfter - 0.65) / 0.35;
                        pulseOpacity = Math.max(0, 0.45 * (1.0 - p3));
                    }

                    lineMat.opacity = pulseOpacity;
                    cylMat.opacity = pulseOpacity * 0.85;

                    // Onda de choque do 1º pulso
                    const r1 = Math.min(1.0, tAfter / 0.7);
                    ring1Mesh.scale.set(1.0 + r1 * 12.0, 1.0 + r1 * 12.0, 1.0 + r1 * 12.0);
                    ring1Mat.opacity = Math.max(0, (1.0 - r1) * 0.9);

                    // Onda de choque concêntrica do 2º pulso
                    if (tAfter >= 0.35) {
                        const r2 = (tAfter - 0.35) / 0.65;
                        ring2Mesh.scale.set(1.0 + r2 * 9.0, 1.0 + r2 * 9.0, 1.0 + r2 * 9.0);
                        ring2Mat.opacity = Math.max(0, (1.0 - r2) * 0.8);
                    }
                }
            } else {
                // Feixe sobe rápido do sistema (starY) em direção ao teto (ceilingY)
                if (progress < 0.22) {
                    const t = progress / 0.22;
                    const currentTipY = starY + (ceilingY - starY) * t;

                    arr[0] = relX; arr[1] = starY; arr[2] = relZ;
                    arr[3] = relX; arr[4] = currentTipY; arr[5] = relZ;
                    posAttr.needsUpdate = true;

                    const currentH = Math.max(0.05, Math.abs(currentTipY - starY));
                    cylMesh.visible = true;
                    cylMesh.scale.set(1, currentH, 1);
                    cylMesh.position.set(relX, (starY + currentTipY) / 2, relZ);

                    tipMesh.position.y = currentTipY;
                    tipMesh.visible = true;

                    ring1Mesh.scale.set(1.0 + t * 6.0, 1.0 + t * 6.0, 1.0 + t * 6.0);
                    ring1Mat.opacity = Math.max(0, (1.0 - t) * 0.8);
                } else {
                    tipMesh.visible = false;

                    arr[0] = relX; arr[1] = starY; arr[2] = relZ;
                    arr[3] = relX; arr[4] = ceilingY; arr[5] = relZ;
                    posAttr.needsUpdate = true;

                    cylMesh.visible = true;
                    cylMesh.scale.set(1, totalHeight, 1);
                    cylMesh.position.set(relX, (starY + ceilingY) / 2, relZ);

                    // Curva de dois pulsos energéticos
                    const tAfter = (progress - 0.22) / 0.78;
                    let pulseOpacity = 0;
                    if (tAfter < 0.35) {
                        pulseOpacity = 1.0 - (tAfter / 0.35) * 0.55;
                    } else if (tAfter < 0.65) {
                        const p2 = (tAfter - 0.35) / 0.30;
                        pulseOpacity = 0.45 + 0.55 * Math.sin(p2 * Math.PI);
                    } else {
                        const p3 = (tAfter - 0.65) / 0.35;
                        pulseOpacity = Math.max(0, 0.45 * (1.0 - p3));
                    }

                    lineMat.opacity = pulseOpacity;
                    cylMat.opacity = pulseOpacity * 0.85;

                    if (tAfter >= 0.35) {
                        const r2 = (tAfter - 0.35) / 0.65;
                        ring2Mesh.scale.set(1.0 + r2 * 7.0, 1.0 + r2 * 7.0, 1.0 + r2 * 7.0);
                        ring2Mat.opacity = Math.max(0, (1.0 - r2) * 0.7);
                    }
                }
            }
        },
        dispose: function() {
            scene.remove(group);
            lineGeo.dispose();
            lineMat.dispose();
            cylGeo.dispose();
            cylMat.dispose();
            tipGeo.dispose();
            tipMat.dispose();
            ring1Geo.dispose();
            ring1Mat.dispose();
            ring2Geo.dispose();
            ring2Mat.dispose();
        }
    };

    activeBeams.push(beamObj);
}

function renderEdsmStatus(data) {
    if (!edsmSyncDisplayEl || !data) return;
    if (!data.enabled) {
        edsmSyncDisplayEl.style.display = 'none';
        return;
    }
    edsmSyncDisplayEl.style.display = 'inline-flex';
    if (data.keyValid) {
        const count = data.totalAccepted || 0;
        edsmSyncDisplayEl.innerHTML = `🛰️ EDSM: <b style="color:#2bfca8">${tr('galaxy.edsm_sent', count)}</b>`;
        edsmSyncDisplayEl.style.borderColor = 'rgba(43, 252, 168, 0.45)';
        edsmSyncDisplayEl.style.color = '#2bfca8';
    } else {
        let statusLabel = '';
        switch (data.statusCode) {
            case 'NOT_CONFIGURED':
                statusLabel = tr('galaxy.edsm_not_configured');
                break;
            case 'DISABLED':
                statusLabel = tr('galaxy.edsm_disabled');
                break;
            case 'CONNECTION_FAILED':
                statusLabel = tr('galaxy.edsm_conn_failed');
                break;
            case 'NETWORK_ERROR':
                statusLabel = tr('galaxy.edsm_net_error');
                break;
            case 'CONNECTED':
                statusLabel = tr('galaxy.edsm_connected', data.statusDetail || data.commanderName || 'CMDR');
                break;
            case 'SYNCED':
                statusLabel = tr('galaxy.edsm_sent', data.statusDetail || data.totalAccepted || 0);
                break;
            case 'HTTP_ERROR':
                statusLabel = `HTTP ${data.statusDetail || ''}`;
                break;
            case 'EDSM_MESSAGE':
                statusLabel = data.statusDetail || data.lastStatus || '';
                break;
            case 'CONNECTING':
                edsmSyncDisplayEl.innerHTML = tr('galaxy.edsm_connecting');
                edsmSyncDisplayEl.style.borderColor = 'rgba(255, 170, 51, 0.4)';
                edsmSyncDisplayEl.style.color = '#ffaa33';
                return;
            default:
                if (!data.hasApiKey || !data.commanderName) {
                    statusLabel = tr('galaxy.edsm_not_configured');
                } else {
                    statusLabel = data.lastStatus || '';
                }
        }
        edsmSyncDisplayEl.innerHTML = statusLabel
            ? `🛰️ EDSM: <span style="color:#ffaa33">${statusLabel}</span>`
            : tr('galaxy.edsm_connecting');
        edsmSyncDisplayEl.style.borderColor = 'rgba(255, 170, 51, 0.4)';
        edsmSyncDisplayEl.style.color = '#ffaa33';
    }
}

async function checkEdsmStatus() {
    if (!edsmSyncDisplayEl) return;
    try {
        const res = await fetch('/api/edsm/status');
        if (!res.ok) return;
        const data = await res.json();
        lastEdsmData = data;
        renderEdsmStatus(data);
    } catch (e) {
        // silent fail
    }
}

window.addEventListener('elite:languageChanged', () => {
    updateToggleHabitedButton();
    updateTrafficAudioButton();
    if (lastGalaxyCubeData) {
        updateStatsSummary(lastGalaxyCubeData);
    }
    if (lastPlayerInfo || currentCenter) {
        updateCoordsDisplay(
            (lastPlayerInfo && lastPlayerInfo.commander) || currentCommanderName,
            (lastPlayerInfo && lastPlayerInfo.currentSystem) || (currentCenter && currentCenter.system)
        );
    }
    updateStratumRadar();
    updateGapsRadar();
    if (lastStationsCache && lastStationsCache.list !== null) {
        renderStationsList(lastStationsCache.system, lastStationsCache.list);
    }
    renderTrafficCard();
    if (lastEdsmData) {
        renderEdsmStatus(lastEdsmData);
    }
    if (currentPinnedStarName && allReceivedStars) {
        const star = allReceivedStars.find(s => s.name === currentPinnedStarName);
        if (star) pinStarCard(star);
    } else if (currentPinnedVoidId && currentVoidSectors) {
        const v = currentVoidSectors.find(g => (g.systemName || g.id) === currentPinnedVoidId);
        if (v) pinVoidCard(v);
    }
});
