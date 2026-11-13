/**
 * Elite Explorer Copilot - Barra de Navegação e Menu Lateral Retrátil (Sidebar HUD)
 * Componente unificado flutuante para todas as telas (Cubo Galáctico, Sistema 3D e Mercado).
 */
(function () {
    'use strict';

    function getI18n() {
        return window.EliteI18n || window.i18n;
    }

    function tr(key, ...args) {
        const inst = getI18n();
        if (inst && typeof inst.t === 'function') {
            return inst.t(key, ...args);
        }
        return key;
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

    let lastSurfaceData = null;
    let lastEdsmData = null;
    let isSidebarOpen = false;

    function createSidebarDOM() {
        if (document.getElementById('copilotSidebar')) return;

        // 1. Botão Flutuante do Topo (Trigger Capsule)
        const triggerBar = document.createElement('div');
        triggerBar.id = 'copilotTopNavTrigger';
        triggerBar.className = 'copilot-top-nav-trigger';
        triggerBar.innerHTML = `
            <button id="btnOpenCopilotSidebar" class="copilot-menu-btn" type="button" title="${tr('nav.menu_title')}">
                <span class="copilot-menu-icon" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                </span>
                <span class="copilot-menu-text" data-i18n="nav.menu_btn">${tr('nav.menu_btn')}</span>
            </button>
            <div id="copilotTriggerStatus" class="copilot-trigger-status" title="${tr('nav.menu_title')}">
                <span class="trigger-cmdr" id="quickCmdrBadge">CMDR ...</span>
                <span class="trigger-sep">•</span>
                <span class="trigger-sys" id="quickSysBadge">...</span>
                <span class="trigger-edsm" id="quickEdsmBadge" title="EDSM Telemetria">🛰️</span>
                <!-- Compatibilidade para scripts existentes -->
                <span id="playerCoordsDisplay" style="display:none;"></span>
                <span id="edsmSyncDisplay" style="display:none;"></span>
            </div>
        `;

        // 2. Backdrop Overlay
        const backdrop = document.createElement('div');
        backdrop.id = 'copilotSidebarBackdrop';
        backdrop.className = 'copilot-sidebar-backdrop';

        // 3. Drawer Retrátil
        const sidebar = document.createElement('aside');
        sidebar.id = 'copilotSidebar';
        sidebar.className = 'copilot-sidebar';
        sidebar.setAttribute('aria-label', tr('nav.menu_title'));
        sidebar.innerHTML = `
            <!-- Sidebar Header -->
            <div class="sidebar-header">
                <div class="sidebar-brand">
                    <div class="sidebar-logo">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#00d4ff" stroke-width="2">
                            <polygon points="12 2 22 20 12 16 2 20 12 2" fill="rgba(0,212,255,0.2)"/>
                        </svg>
                    </div>
                    <div>
                        <div class="sidebar-app-name">ELITE EXPLORER</div>
                        <div class="sidebar-app-sub">COPILOT HUD</div>
                    </div>
                </div>
                <button id="btnCloseCopilotSidebar" class="sidebar-close-btn" type="button" title="${tr('nav.close_menu')}" aria-label="${tr('nav.close_menu')}">✕</button>
            </div>

            <!-- Telemetria & Status do Comandante -->
            <div class="sidebar-pilot-card">
                <div class="pilot-row">
                    <span class="pilot-label" data-i18n="nav.cmdr">${tr('nav.cmdr')}</span>
                    <span id="sidebarCmdrName" class="pilot-val cmdr-gold">CMDR ...</span>
                </div>
                <div class="pilot-row">
                    <span class="pilot-label" data-i18n="nav.system_label">${tr('nav.system_label')}</span>
                    <span id="sidebarSysName" class="pilot-val sys-cyan">...</span>
                </div>
                <div class="pilot-row">
                    <span class="pilot-label">EDSM</span>
                    <span id="sidebarEdsmStatus" class="edsm-badge">🛰️ Conectando...</span>
                </div>
            </div>

            <!-- Seção de Navegação -->
            <nav class="sidebar-nav-section">
                <div class="sidebar-section-title" data-i18n="nav.navigation_title">${tr('nav.navigation_title')}</div>

                <!-- 1. Cubo Galáctico 3D -->
                <a href="/index.html" class="sidebar-nav-item" id="navItemGalaxyCube">
                    <span class="nav-icon">🌌</span>
                    <div class="nav-label-group">
                        <span class="nav-label" data-i18n="nav.galaxy_cube_3d">${tr('nav.galaxy_cube_3d')}</span>
                        <span class="nav-desc" data-i18n="nav.desc_galaxy">${tr('nav.desc_galaxy')}</span>
                    </div>
                </a>

                <!-- 2. Sistema 3D (Orrery) -->
                <a href="/system-orrery.html" class="sidebar-nav-item" id="navItemOrrery">
                    <span class="nav-icon">🪐</span>
                    <div class="nav-label-group">
                        <span class="nav-label" data-i18n="nav.system_orrery">${tr('nav.system_orrery')}</span>
                        <span class="nav-desc" data-i18n="nav.desc_orrery">${tr('nav.desc_orrery')}</span>
                    </div>
                </a>

                <!-- 3. Superfície (Columbus View) -->
                <button type="button" class="sidebar-nav-item disabled" id="btnSwitchToSurface">
                    <span class="nav-icon">🧭</span>
                    <div class="nav-label-group">
                        <span class="nav-label" data-i18n="nav.surface">${tr('nav.surface')}</span>
                        <span class="nav-desc" id="navSurfaceDesc" data-i18n="nav.surface_disabled_title">${tr('nav.surface_disabled_title')}</span>
                    </div>
                    <span id="navSurfaceBadge" class="nav-status-badge disabled" data-i18n="nav.status_offline">${tr('nav.status_offline')}</span>
                </button>

                <!-- 4. Mercado Single-Hop -->
                <a href="/market.html" class="sidebar-nav-item" id="navItemMarket">
                    <span class="nav-icon">🚀</span>
                    <div class="nav-label-group">
                        <span class="nav-label" data-i18n="nav.market">${tr('nav.market')}</span>
                        <span class="nav-desc" data-i18n="nav.desc_market">${tr('nav.desc_market')}</span>
                    </div>
                </a>
            </nav>

            <!-- Seção de Idioma -->
            <div class="sidebar-lang-section">
                <div class="sidebar-section-title" data-i18n="nav.language_title">${tr('nav.language_title')}</div>
                <div data-lang-switcher class="sidebar-lang-container"></div>
            </div>

            <!-- Rodapé -->
            <div class="sidebar-footer">
                <span class="version-badge">v0.0.1</span>
                <div class="sidebar-author-info">
                    <span class="author-name">Carlos M. Abreu</span>
                    <a href="mailto:magno.mabreu@gmail.com" class="author-email">magno.mabreu@gmail.com</a>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(sidebar);
        document.body.appendChild(triggerBar);

        // Aplica traduções [data-i18n] e renderiza bandeiras de idioma
        const i18nInst = getI18n();
        if (i18nInst && typeof i18nInst.apply === 'function') {
            i18nInst.apply();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                const lateInst = getI18n();
                if (lateInst && typeof lateInst.apply === 'function') {
                    lateInst.apply();
                }
            });
        }
    }

    function openSidebar() {
        const sidebar = document.getElementById('copilotSidebar');
        const backdrop = document.getElementById('copilotSidebarBackdrop');
        if (sidebar && backdrop) {
            sidebar.classList.add('is-open');
            backdrop.classList.add('is-open');
            isSidebarOpen = true;
        }
    }

    function closeSidebar() {
        const sidebar = document.getElementById('copilotSidebar');
        const backdrop = document.getElementById('copilotSidebarBackdrop');
        if (sidebar && backdrop) {
            sidebar.classList.remove('is-open');
            backdrop.classList.remove('is-open');
            isSidebarOpen = false;
        }
    }

    function toggleSidebar() {
        if (isSidebarOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    function updateActiveRouteState() {
        const path = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();

        const btnGalaxy = document.getElementById('navItemGalaxyCube');
        const btnOrrery = document.getElementById('navItemOrrery');
        const btnSurface = document.getElementById('btnSwitchToSurface');
        const btnMarket = document.getElementById('navItemMarket');

        if (btnGalaxy) btnGalaxy.classList.remove('active');
        if (btnOrrery) btnOrrery.classList.remove('active');
        if (btnSurface) btnSurface.classList.remove('active');
        if (btnMarket) btnMarket.classList.remove('active');

        if (path.includes('market')) {
            if (btnMarket) btnMarket.classList.add('active');
        } else if (path.includes('system-orrery')) {
            if (btnOrrery) btnOrrery.classList.add('active');
        } else {
            // index.html ou raiz /
            if (search.includes('view=surface') || (window.isSurfaceViewActive)) {
                if (btnSurface) btnSurface.classList.add('active');
            } else {
                if (btnGalaxy) btnGalaxy.classList.add('active');
            }
        }
    }

    function updateSurfaceButton(data) {
        const btnSurface = document.getElementById('btnSwitchToSurface');
        const badge = document.getElementById('navSurfaceBadge');
        const desc = document.getElementById('navSurfaceDesc');
        if (!btnSurface) return;

        const isNear = checkIsNearSurface(data);

        if (isNear) {
            btnSurface.classList.remove('disabled');
            btnSurface.disabled = false;
            btnSurface.style.cursor = 'pointer';
            btnSurface.style.pointerEvents = 'auto';

            const bodyName = data.bodyName || data.planetName || '';
            if (badge) {
                badge.className = 'nav-status-badge online';
                badge.textContent = bodyName ? bodyName : tr('nav.status_online');
            }
            if (desc) {
                desc.textContent = bodyName
                    ? `${tr('nav.surface_active_title', bodyName)}`
                    : tr('nav.desc_surface');
            }
        } else {
            btnSurface.classList.add('disabled');
            btnSurface.disabled = true;
            btnSurface.style.cursor = 'not-allowed';
            btnSurface.style.pointerEvents = 'none';

            if (badge) {
                badge.className = 'nav-status-badge disabled';
                badge.textContent = tr('nav.status_offline');
            }
            if (desc) {
                desc.textContent = tr('nav.surface_disabled_title');
            }
        }
    }

    function updatePlayerInfo(pData) {
        if (!pData) return;
        const rawCmdr = pData.commander || pData.cmdr || '';
        const sys = pData.currentSystem || pData.system || '';

        const quickCmdr = document.getElementById('quickCmdrBadge');
        const quickSys = document.getElementById('quickSysBadge');
        const sideCmdr = document.getElementById('sidebarCmdrName');
        const sideSys = document.getElementById('sidebarSysName');

        if (rawCmdr) {
            const displayCmdr = rawCmdr.startsWith('CMDR') ? rawCmdr : `CMDR ${rawCmdr}`;
            if (quickCmdr) quickCmdr.textContent = displayCmdr;
            if (sideCmdr) sideCmdr.textContent = displayCmdr;
        }

        if (sys) {
            if (quickSys) quickSys.textContent = sys;
            if (sideSys) sideSys.textContent = sys;
        }
    }

    function updateTelemetryDisplay(data) {
        if (!data) return;
        lastSurfaceData = data;

        if (data.commander) {
            const rawCmdr = data.commander;
            const displayCmdr = rawCmdr.startsWith('CMDR') ? rawCmdr : `CMDR ${rawCmdr}`;
            const quickCmdr = document.getElementById('quickCmdrBadge');
            const sideCmdr = document.getElementById('sidebarCmdrName');
            if (quickCmdr) quickCmdr.textContent = displayCmdr;
            if (sideCmdr) sideCmdr.textContent = displayCmdr;
        }

        const sysName = data.currentSystem || data.starSystem || data.systemName || data.system;
        if (sysName) {
            const quickSys = document.getElementById('quickSysBadge');
            const sideSys = document.getElementById('sidebarSysName');
            if (quickSys) quickSys.textContent = sysName;
            if (sideSys) sideSys.textContent = sysName;
        }

        updateSurfaceButton(data);
        updateActiveRouteState();
    }

    function updateEdsmDisplay(data) {
        if (!data) return;
        lastEdsmData = data;

        const quickBadge = document.getElementById('quickEdsmBadge');
        const sideStatus = document.getElementById('sidebarEdsmStatus');

        if (!data.enabled) {
            if (quickBadge) quickBadge.style.display = 'none';
            if (sideStatus) sideStatus.textContent = 'Desativado';
            return;
        }

        if (quickBadge) quickBadge.style.display = 'inline';

        if (data.keyValid) {
            const count = data.totalAccepted || 0;
            if (quickBadge) {
                quickBadge.textContent = '🛰️';
                quickBadge.title = `EDSM: ${count} sincronizações`;
            }
            if (sideStatus) {
                sideStatus.innerHTML = `🛰️ <b style="color:#2bfca8">${count} enviados</b>`;
            }
        } else {
            let label = data.statusCode || 'Conectando';
            if (quickBadge) {
                quickBadge.textContent = '🛰️';
                quickBadge.title = `EDSM: ${label}`;
            }
            if (sideStatus) {
                sideStatus.innerHTML = `🛰️ <span style="color:#ffaa33">${label}</span>`;
            }
        }
    }

    async function pollTelemetry() {
        try {
            // 1. Status Geral do Jogador (Comandante, Sistema)
            const pRes = await fetch('/api/player/status');
            if (pRes.ok) {
                const pData = await pRes.json();
                updatePlayerInfo(pData);
            }
        } catch (e) {}

        try {
            // 2. Status de Superfície (Órbita, Solo, Sinais)
            const sRes = await fetch('/api/player/surface-status');
            if (sRes.ok) {
                const sData = await sRes.json();
                updateTelemetryDisplay(sData);
            }
        } catch (e) {}
    }

    async function pollEdsm() {
        try {
            const res = await fetch('/api/edsm/status');
            if (res.ok) {
                const data = await res.json();
                updateEdsmDisplay(data);
            }
        } catch (e) {
            // Silencioso
        }
    }

    function setupEventListeners() {
        // Toggle do Menu
        const btnOpen = document.getElementById('btnOpenCopilotSidebar');
        const triggerStatus = document.getElementById('copilotTriggerStatus');
        const btnClose = document.getElementById('btnCloseCopilotSidebar');
        const backdrop = document.getElementById('copilotSidebarBackdrop');

        if (btnOpen) btnOpen.addEventListener('click', toggleSidebar);
        if (triggerStatus) triggerStatus.addEventListener('click', toggleSidebar);
        if (btnClose) btnClose.addEventListener('click', closeSidebar);
        if (backdrop) backdrop.addEventListener('click', closeSidebar);

        // Fechar no Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isSidebarOpen) {
                closeSidebar();
            }
        });

        // Ação do Botão Cubo Galáctico
        const btnGalaxy = document.getElementById('navItemGalaxyCube');
        if (btnGalaxy) {
            btnGalaxy.addEventListener('click', (e) => {
                const path = window.location.pathname.toLowerCase();
                if (!path.includes('market') && !path.includes('system-orrery')) {
                    // Já estamos no index.html! Se estiver em modo superfície, sai dele
                    if (window.hideSurfaceView && typeof window.hideSurfaceView === 'function') {
                        e.preventDefault();
                        window.hideSurfaceView();
                        closeSidebar();
                        updateActiveRouteState();
                    } else {
                        closeSidebar();
                    }
                } else {
                    closeSidebar();
                }
            });
        }

        // Ação do Botão Superfície
        const btnSurface = document.getElementById('btnSwitchToSurface');
        if (btnSurface) {
            btnSurface.addEventListener('click', (e) => {
                if (btnSurface.classList.contains('disabled')) {
                    e.preventDefault();
                    return;
                }

                const path = window.location.pathname.toLowerCase();
                if (!path.includes('market') && !path.includes('system-orrery')) {
                    // Já está no index.html: aciona alternância de visão 2.5D Columbus View
                    e.preventDefault();
                    closeSidebar();
                    if (window.showSurfaceView && typeof window.showSurfaceView === 'function') {
                        window.showSurfaceView();
                    }
                    updateActiveRouteState();
                } else {
                    // Redireciona para o index.html em modo superfície
                    e.preventDefault();
                    closeSidebar();
                    window.location.href = '/index.html?view=surface';
                }
            });
        }

        // Links normais fecham a sidebar
        const btnOrrery = document.getElementById('navItemOrrery');
        const btnMarket = document.getElementById('navItemMarket');
        if (btnOrrery) btnOrrery.addEventListener('click', () => closeSidebar());
        if (btnMarket) btnMarket.addEventListener('click', () => closeSidebar());

        // Escuta mudança de idioma para atualizar badges e textos
        const handleLangChange = () => {
            const inst = getI18n();
            if (inst && typeof inst.apply === 'function') inst.apply();
            if (lastSurfaceData) updateSurfaceButton(lastSurfaceData);
            if (lastEdsmData) updateEdsmDisplay(lastEdsmData);
            updateActiveRouteState();
        };
        window.addEventListener('elite:languageChanged', handleLangChange);
        document.addEventListener('elite-i18n-changed', handleLangChange);
    }

    function init() {
        createSidebarDOM();
        setupEventListeners();
        updateActiveRouteState();

        if (window.EliteI18n && typeof window.EliteI18n.apply === 'function') {
            window.EliteI18n.apply();
        }

        // Polling contínuo
        pollTelemetry();
        pollEdsm();
        setInterval(pollTelemetry, 3000);
        setInterval(pollEdsm, 10000);

        // Expõe funções auxiliares para outros scripts se necessário
        window.CopilotNav = {
            open: openSidebar,
            close: closeSidebar,
            toggle: toggleSidebar,
            updateTelemetry: updateTelemetryDisplay,
            updateEdsm: updateEdsmDisplay,
            refreshState: updateActiveRouteState
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
