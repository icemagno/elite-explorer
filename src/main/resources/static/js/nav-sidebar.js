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
            <div id="copilotTriggerStatus" class="copilot-trigger-status" data-i18n-title="nav.menu_title" title="${tr('nav.menu_title')}">
                <span class="trigger-cmdr" id="quickCmdrBadge">CMDR ...</span>
                <span class="trigger-sep">•</span>
                <span class="trigger-sys" id="quickSysBadge">...</span>
                <span class="trigger-edsm" id="quickEdsmBadge" data-i18n-title="nav.edsm_telemetry" title="${tr('nav.edsm_telemetry')}">🛰️</span>
                <!-- Compatibilidade para scripts existentes -->
                <span id="playerCoordsDisplay" style="display:none;"></span>
                <span id="edsmSyncDisplay" style="display:none;"></span>
            </div>

            <!-- Card do Anon ID do Piloto (EDDN) -->
            <div id="copilotAnonCard" class="copilot-anon-card" data-i18n-title="nav.anon_card_title" title="${tr('nav.anon_card_title')}">
                <span class="top-anon-icon">🆔</span>
                <span class="top-anon-lbl" data-i18n="nav.anon_lbl">${tr('nav.anon_lbl')}</span>
                <span class="top-anon-val" id="topAnonCode">---·---</span>
                <button id="topBtnCopyAnon" class="top-btn-copy-anon" type="button" data-i18n-title="nav.copy_anon_title" title="${tr('nav.copy_anon_title')}">📋</button>
            </div>

            <!-- Campo de Busca de Amigo com Lupa -->
            <div class="copilot-friend-search" id="copilotFriendSearch">
                <input type="text" id="topFriendInput" data-i18n-placeholder="nav.friend_search_ph" placeholder="${tr('nav.friend_search_ph')}" maxlength="36" autocomplete="off" spellcheck="false" data-i18n-title="nav.friend_search_title" title="${tr('nav.friend_search_title')}">
                <button id="topBtnFriendSearch" class="top-btn-friend-search" type="button" data-i18n-title="nav.friend_search_btn" title="${tr('nav.friend_search_btn')}">🔍</button>
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

                <!-- 4. Commander Scan (Heatmap 2D) -->
                <a href="/cmdrscan.html" class="sidebar-nav-item" id="navItemCmdrScan">
                    <span class="nav-icon">🛰️</span>
                    <div class="nav-label-group">
                        <span class="nav-label" data-i18n="nav.cmdrscan">${tr('nav.cmdrscan')}</span>
                        <span class="nav-desc" data-i18n="nav.desc_cmdrscan">${tr('nav.desc_cmdrscan')}</span>
                    </div>
                </a>

                <!-- 5. Mercado Single-Hop -->
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
                <div class="sidebar-footer-left">
                    <span class="version-badge">v0.0.1</span>
                    <a class="sidebar-github-link" href="https://github.com/icemagno/elite-explorer" target="_blank" rel="noopener noreferrer" title="GitHub: icemagno/elite-explorer" aria-label="GitHub">
                        <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                        </svg>
                    </a>
                </div>
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
        const btnCmdrScan = document.getElementById('navItemCmdrScan');
        const btnMarket = document.getElementById('navItemMarket');

        if (btnGalaxy) btnGalaxy.classList.remove('active');
        if (btnOrrery) btnOrrery.classList.remove('active');
        if (btnSurface) btnSurface.classList.remove('active');
        if (btnCmdrScan) btnCmdrScan.classList.remove('active');
        if (btnMarket) btnMarket.classList.remove('active');

        if (path.includes('cmdrscan')) {
            if (btnCmdrScan) btnCmdrScan.classList.add('active');
        } else if (path.includes('market')) {
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

    // =========================================================================
    // Anon ID & Friend Locator (EDDN)
    // =========================================================================
    let myAnonIdentity = null;

    function showToast(msg, isError = false) {
        let toast = document.getElementById('cmdrToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cmdrToast';
            toast.className = 'cmdr-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = 'cmdr-toast show' + (isError ? ' error' : '');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.className = 'cmdr-toast' + (isError ? ' error' : '');
        }, 3600);
    }
    window.showToast = showToast;

    async function loadMyAnonIdentity() {
        try {
            const res = await fetch('/api/my-anon-id');
            if (!res.ok) return;
            const data = await res.json();
            myAnonIdentity = data;
            const codeEl = document.getElementById('topAnonCode');
            if (codeEl && data.shortId) {
                codeEl.textContent = data.shortId;
            }
        } catch (e) {
            console.warn('Could not load anon identity:', e);
        }
    }

    function copyAnonId() {
        const idToCopy = myAnonIdentity?.shortId || document.getElementById('topAnonCode')?.textContent;
        if (!idToCopy || idToCopy.includes('---')) return;

        const copyBtn = document.getElementById('topBtnCopyAnon');
        const origText = copyBtn ? copyBtn.textContent : '📋';

        navigator.clipboard.writeText(idToCopy).then(() => {
            if (copyBtn) copyBtn.textContent = '✅';
            showToast(tr('nav.anon_copied', idToCopy));
            setTimeout(() => {
                if (copyBtn) copyBtn.textContent = origText;
            }, 1800);
        }).catch(() => {
            prompt(tr('nav.anon_prompt_copy'), idToCopy);
        });
    }

    function showFriendHudCard(data) {
        let existing = document.getElementById('friendFoundHudCard');
        if (existing) existing.remove();

        const card = document.createElement('div');
        card.id = 'friendFoundHudCard';
        card.className = 'friend-found-hud-card';

        const shortId = data.shortId || (data.uploaderId ? data.uploaderId.substring(0, 6).toUpperCase() : 'CMDR');
        const sys = data.systemName || tr('nav.friend_hud_unknown');
        const ageMin = Math.round((data.ageSeconds || 0) / 60);
        const timeStr = ageMin < 1 ? tr('nav.friend_time_now') : tr('nav.friend_time_ago', ageMin);
        const coordsStr = (data.x != null && data.y != null && data.z != null)
            ? `[${data.x.toFixed(1)}, ${data.y.toFixed(1)}, ${data.z.toFixed(1)}]`
            : tr('nav.friend_hud_unknown_coords');

        card.innerHTML = `
            <div class="friend-hud-header">
                <span class="friend-hud-title">${tr('nav.friend_hud_title')}</span>
                <button type="button" class="friend-hud-close" id="btnCloseFriendHud">✕</button>
            </div>
            <div class="friend-hud-row">
                <span>Anon ID:</span>
                <span class="friend-hud-val" style="color: #2bfca8;">${shortId}</span>
            </div>
            <div class="friend-hud-row">
                <span>${tr('nav.friend_hud_system')}</span>
                <span class="friend-hud-val" style="color: #ffaa00;">${sys}</span>
            </div>
            <div class="friend-hud-row">
                <span>${tr('nav.friend_hud_coords')}</span>
                <span class="friend-hud-val">${coordsStr}</span>
            </div>
            <div class="friend-hud-row">
                <span>${tr('nav.friend_hud_last_signal')}</span>
                <span class="friend-hud-val" style="color: #8da4be;">${timeStr} (${data.event || 'EDDN'})</span>
            </div>
            <div class="friend-hud-actions">
                <a href="/cmdrscan.html?friend=${encodeURIComponent(shortId)}" class="btn-friend-hud-view">${tr('nav.friend_hud_btn_map')}</a>
            </div>
        `;

        const leftContainer = document.querySelector('.hud-left-column')
                           || document.querySelector('.sidebar-col')
                           || document.getElementById('sidebarPanel');
        if (leftContainer) {
            leftContainer.prepend(card);
        } else {
            document.body.appendChild(card);
        }

        const btnClose = card.querySelector('#btnCloseFriendHud');
        if (btnClose) {
            btnClose.addEventListener('click', () => card.remove());
        }

        // Auto fecha após 15 segundos se não houver interação
        setTimeout(() => {
            if (document.body.contains(card)) {
                card.remove();
            }
        }, 15000);
    }

    async function searchFriend() {
        const input = document.getElementById('topFriendInput');
        const btn = document.getElementById('topBtnFriendSearch');
        if (!input) return;
        const q = input.value.trim();
        if (!q) {
            showToast(tr('nav.friend_empty_id'), true);
            return;
        }

        const origText = btn ? btn.textContent : '🔍';
        if (btn) {
            btn.textContent = '⏳';
            btn.disabled = true;
        }

        try {
            const res = await fetch(`/api/search-friend?id=${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error('Falha na resposta do servidor');
            const data = await res.json();

            if (!data.found) {
                showToast(tr('nav.friend_not_found', q), true);
                return;
            }

            const sys = data.systemName;
            const shortId = data.shortId || q;
            const ageMin = Math.round((data.ageSeconds || 0) / 60);
            const timeStr = ageMin < 1 ? tr('nav.friend_time_now') : tr('nav.friend_time_ago', ageMin);

            showToast(tr('nav.friend_located', shortId, sys, timeStr));
            showFriendHudCard(data);

            // Se estiver no cmdrscan.html, centraliza imediatamente o mapa
            if (typeof window._centerMapOn === 'function' && data.normU != null && data.normV != null) {
                window._centerMapOn(data.normU, data.normV);
                if (typeof window._showFriendMarker === 'function') {
                    window._showFriendMarker(data);
                }
            } 
            // Se estiver no index.html (Cubo 3D), foca a estrela do amigo (dentro ou fora do cubo local)
            else if (typeof window.focusFriendSystem === 'function') {
                window.focusFriendSystem(data);
            } else if (typeof window.focusRadarSystem === 'function' && sys) {
                window.focusRadarSystem(sys);
            }
        } catch (err) {
            console.error('Erro na busca de amigo:', err);
            showToast(tr('nav.friend_err_connection'), true);
        } finally {
            if (btn) {
                btn.textContent = origText;
                btn.disabled = false;
            }
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
        const btnCmdrScan = document.getElementById('navItemCmdrScan');
        const btnMarket = document.getElementById('navItemMarket');
        if (btnOrrery) btnOrrery.addEventListener('click', () => closeSidebar());
        if (btnCmdrScan) btnCmdrScan.addEventListener('click', () => closeSidebar());
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

        // Anon ID Card & Copy
        const anonCard = document.getElementById('copilotAnonCard');
        const btnCopyAnon = document.getElementById('topBtnCopyAnon');
        if (anonCard) {
            anonCard.addEventListener('click', () => {
                copyAnonId();
            });
        }
        if (btnCopyAnon) {
            btnCopyAnon.addEventListener('click', (e) => {
                e.stopPropagation();
                copyAnonId();
            });
        }

        // Friend Search
        const btnFriendSearch = document.getElementById('topBtnFriendSearch');
        const inputFriend = document.getElementById('topFriendInput');
        if (btnFriendSearch) {
            btnFriendSearch.addEventListener('click', () => {
                searchFriend();
            });
        }
        if (inputFriend) {
            inputFriend.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchFriend();
                }
            });
        }
    }

    function init() {
        createSidebarDOM();
        setupEventListeners();
        updateActiveRouteState();

        if (window.EliteI18n && typeof window.EliteI18n.apply === 'function') {
            window.EliteI18n.apply();
        }

        // Carrega identidade anônima do comandante local
        loadMyAnonIdentity();

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
