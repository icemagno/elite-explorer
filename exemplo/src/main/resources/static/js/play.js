// ==========================================================================
// QUATERNITY CHESS • CLIENTE WEB INTERATIVO & RESPONSIVO
// ==========================================================================

let stompClient = null;
let currentTableId = null;
let currentTableData = null;
let tableSubscription = null;
let tableCountdownSubscription = null;
let prevTablePaused = false;
let myColor = null;
let myPlayerName = '';
let selectedColorToJoin = null;
let wakeLockSentinel = null;

// Configurações Oficiais das 4 Cores Canônicas
const ARMY_CONFIG = {
    white: { id: 'white', name: 'Branco', hex: '#CCD4CA', textColor: '#0f172a', next: 'red' },
    red:   { id: 'red',   name: 'Vermelho', hex: '#9D0400', textColor: '#ffffff', next: 'black' },
    black: { id: 'black', name: 'Preto',  hex: '#000000', textColor: '#f8fafc', next: 'green' },
    green: { id: 'green', name: 'Verde',  hex: '#26C000', textColor: '#ffffff', next: 'white' }
};

const TURN_ORDER = ['white', 'red', 'black', 'green'];

// Utilitários para nomes de jogadores e persistência limpa
function isGenericArmyName(name) {
    if (!name) return false;
    const trimmed = name.trim().toLowerCase();
    return trimmed === 'jogador verde' ||
           trimmed === 'jogador branco' ||
           trimmed === 'jogador vermelho' ||
           trimmed === 'jogador preto' ||
           trimmed === 'jogador' ||
           trimmed === 'jogador (verde)' ||
           trimmed === 'jogador (branco)' ||
           trimmed === 'jogador (vermelho)' ||
           trimmed === 'jogador (preto)';
}

function getSavedCustomName() {
    const custom = localStorage.getItem('quaternity_player_custom_name') || sessionStorage.getItem('quaternity_player_custom_name');
    if (custom && !isGenericArmyName(custom)) {
        return custom.trim();
    }
    const legacy = sessionStorage.getItem('quaternity_player_name') || localStorage.getItem('quaternity_player_name');
    if (legacy && !isGenericArmyName(legacy)) {
        return legacy.trim();
    }
    return '';
}

function saveCustomName(name) {
    const trimmed = (name || '').trim();
    if (trimmed && !isGenericArmyName(trimmed)) {
        localStorage.setItem('quaternity_player_custom_name', trimmed);
        sessionStorage.setItem('quaternity_player_custom_name', trimmed);
        sessionStorage.setItem('quaternity_player_name', trimmed);
        myPlayerName = trimmed;
    } else {
        localStorage.removeItem('quaternity_player_custom_name');
        sessionStorage.removeItem('quaternity_player_custom_name');
        sessionStorage.removeItem('quaternity_player_name');
        myPlayerName = '';
    }
}

function handleGlobalNameChange(val) {
    saveCustomName(val);
    const nameInput = document.getElementById('playerNameInput');
    if (nameInput) {
        nameInput.value = getSavedCustomName();
    }
}

function handlePlayerNameInputChange(val) {
    saveCustomName(val);
    const globalInput = document.getElementById('globalPlayerNameInput');
    if (globalInput) {
        globalInput.value = getSavedCustomName();
    }
}

// ==========================================================================
// SERVIÇO DE BIPES SINTÉTICOS OFICIAIS (WEB AUDIO API)
// Frequências exatas do quaternity_clock.html e Quaternity_Clock_Overview_Final_pt.pdf:
// - 1 minuto restante: 700 Hz (1.0s)
// - 10 segundos restantes: 700 Hz duplo (0-0.42s e 0.45-1.0s)
// - Timeout (00:00): 600 Hz triplo (0-0.42s, 0.45-1.0s, 1.03-1.6s)
// - Despausa / Unpause: 440 Hz (1.0s)
// ==========================================================================
class QuaternityBeeper {
    constructor() {
        this.enabled = true;
        this.audioCtx = null;
    }

    _getCtx() {
        if (!this.audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) this.audioCtx = new AC();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    _addBeep(ctx, gainNode, frequencyHz, startTime, stopTime) {
        try {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequencyHz, startTime);
            osc.connect(gainNode);
            osc.start(startTime);
            osc.stop(stopTime);
        } catch (e) {
            console.warn('Erro ao emitir bipe:', e);
        }
    }

    playBeep(frequencyHz, durationSec) {
        if (!this.enabled) return;
        const ctx = this._getCtx();
        if (!ctx) return;
        try {
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(1, ctx.currentTime);
            gainNode.connect(ctx.destination);
            const now = ctx.currentTime;
            this._addBeep(ctx, gainNode, frequencyHz, now, now + durationSec);
        } catch (e) {
            console.warn('Erro no sintetizador de áudio:', e);
        }
    }

    play1MinuteRemaining() {
        this.playBeep(700, 1.0);
    }

    play10SecondsRemaining() {
        if (!this.enabled) return;
        const ctx = this._getCtx();
        if (!ctx) return;
        try {
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(1, ctx.currentTime);
            gainNode.connect(ctx.destination);
            const now = ctx.currentTime;
            this._addBeep(ctx, gainNode, 700, now, now + 0.42);
            this._addBeep(ctx, gainNode, 700, now + 0.45, now + 1.0);
        } catch (e) {
            console.warn('Erro no bipe de 10 segundos:', e);
        }
    }

    playTimeout() {
        if (!this.enabled) return;
        const ctx = this._getCtx();
        if (!ctx) return;
        try {
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(1, ctx.currentTime);
            gainNode.connect(ctx.destination);
            const now = ctx.currentTime;
            this._addBeep(ctx, gainNode, 600, now, now + 0.42);
            this._addBeep(ctx, gainNode, 600, now + 0.45, now + 1.0);
            this._addBeep(ctx, gainNode, 600, now + 1.03, now + 1.6);
        } catch (e) {
            console.warn('Erro no bipe de timeout:', e);
        }
    }

    playUnpause() {
        this.playBeep(440, 1.0);
    }
}

const beeper = new QuaternityBeeper();

// ==========================================================================
// ==========================================================================
// TEXTOS OFICIAIS I18N E SERVIÇO DE VOZ (ÁUDIO DESCRITIVO / CONVENCIONAL)
// Conforme especificações do Quaternity:
// - PT: "iniciando jogo", "jogo pausado", "retomando o jogo", Branco, Vermelho, Preto, Verde
// - ES: "Empezando el juego", "pausar el reloj", "Reanudar la partida", Blanco, Rojo, Negro, Verde
// - EN: "Starting the game", "game paused", "Resume the game", White, Red, Black, Green
// ==========================================================================
const I18N_TEXTS = {
    pt: {
        code: 'pt-BR',
        start: 'iniciando jogo',
        pause: 'jogo pausado',
        resume: 'retomando o jogo',
        colors: { white: 'Branco', red: 'Vermelho', black: 'Preto', green: 'Verde' },
        timeout: 'Tempo esgotado para o '
    },
    es: {
        code: 'es-ES',
        start: 'Empezando el juego',
        pause: 'juego pausado',
        resume: 'Reanudar la partida',
        colors: { white: 'Blanco', red: 'Rojo', black: 'Negro', green: 'Verde' },
        timeout: 'Tiempo agotado para '
    },
    en: {
        code: 'en-US',
        start: 'Starting the game',
        pause: 'game paused',
        resume: 'Resume the game',
        colors: { white: 'White', red: 'Red', black: 'Black', green: 'Green' },
        timeout: 'Time out for '
    }
};

const voiceService = {
    enabled: true,
    activeTurn: null,
    triggeredAlerts: new Set(),

    setEnabled(val) {
        this.enabled = !!val;
        beeper.enabled = this.enabled;
        if (!this.enabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    },

    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    },

    getLangConfig() {
        const lang = (window.i18n ? window.i18n.currentLang : (currentTableData && currentTableData.language ? currentTableData.language.toLowerCase() : 'pt'));
        if (window.i18n && window.i18n.getConfig()) {
            const cfg = window.i18n.getConfig();
            return {
                code: cfg.code,
                start: cfg.voice.start,
                pause: cfg.voice.pause,
                resume: cfg.voice.resume,
                timeout: cfg.voice.timeout,
                colors: cfg.colors
            };
        }
        return I18N_TEXTS[lang] || I18N_TEXTS.pt;
    },

    isInclusive() {
        if (!currentTableData) return true;
        return currentTableData.gameType !== 'CONVENTIONAL';
    },

    speak(text, priority = false) {
        if (!this.enabled || !this.isInclusive() || !text || !('speechSynthesis' in window)) return;
        try {
            if (priority) {
                window.speechSynthesis.cancel();
            }
            const langCfg = this.getLangConfig();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = langCfg.code;
            utter.rate = 1.15; // Ritmo dinâmico para fluxo de xadrez
            utter.pitch = 1.0;
            window.speechSynthesis.speak(utter);
        } catch (e) {
            console.warn('Erro na síntese de voz:', e);
        }
    },

    announceTurn(colorKey, isMine) {
        if (!this.enabled) return;
        this.triggeredAlerts.clear();
        if (!this.isInclusive()) return;
        const colorName = window.i18n ? window.i18n.getColorName(colorKey) : colorKey;
        // Regra oficial Quaternity: "Falar apenas Branco, Vermelho, Preto e Verde..."
        this.speak(colorName, true);
    },

    announceGameStart() {
        if (!this.enabled) return;
        beeper.playUnpause();
        if (this.isInclusive()) {
            const langCfg = this.getLangConfig();
            this.speak(langCfg.start, true);
        }
    },

    announcePause(isPaused) {
        if (!this.enabled) return;
        beeper.playUnpause();
        if (this.isInclusive()) {
            const langCfg = this.getLangConfig();
            this.speak(isPaused ? langCfg.pause : langCfg.resume, true);
        }
    },

    checkTimeAlerts(turnKey, remainingMs) {
        if (!this.enabled) return;
        if (this.activeTurn !== turnKey) {
            this.activeTurn = turnKey;
            this.triggeredAlerts.clear();
        }

        const sec = Math.ceil(remainingMs / 1000);
        const langCfg = this.getLangConfig();
        const colorName = window.i18n ? window.i18n.getColorName(turnKey) : turnKey;

        if (remainingMs <= 0) {
            if (!this.triggeredAlerts.has('timeout')) {
                this.triggeredAlerts.add('timeout');
                beeper.playTimeout();
                if (this.isInclusive()) {
                    this.speak(`${langCfg.timeout}${colorName}!`, false);
                }
            }
            return;
        }

        // Alerta de 1 minuto (Bipe oficial 700 Hz conforme quaternity_clock.html e PDF)
        if (sec <= 60 && sec > 56 && !this.triggeredAlerts.has('60s')) {
            this.triggeredAlerts.add('60s');
            beeper.play1MinuteRemaining();
            return;
        }

        // Alerta de 10 segundos (Bipe duplo 700 Hz conforme quaternity_clock.html e PDF)
        if (sec <= 10 && sec > 6 && !this.triggeredAlerts.has('10s')) {
            this.triggeredAlerts.add('10s');
            beeper.play10SecondsRemaining();
            return;
        }
    },

    announceElimination(colorKey) {
        if (!this.enabled) return;
        beeper.playTimeout();
        if (this.isInclusive()) {
            const colorName = window.i18n ? window.i18n.getColorName(colorKey) : colorKey;
            const elimWord = (window.i18n && window.i18n.currentLang === 'es') ? 'eliminado.' : (window.i18n && window.i18n.currentLang === 'en' ? 'eliminated.' : 'eliminado.');
            this.speak(`${colorName} ${elimWord}`, true);
        }
    },

    announceVictory(colorKey) {
        if (!this.enabled) return;
        beeper.playUnpause();
        if (this.isInclusive()) {
            const colorName = window.i18n ? window.i18n.getColorName(colorKey) : colorKey;
            const victPrefix = (window.i18n && window.i18n.currentLang === 'en') ? 'Winner: ' : (window.i18n && window.i18n.currentLang === 'es' ? 'Ganador: ' : 'Vencedor: ');
            this.speak(`${victPrefix}${colorName}!`, true);
        }
    }
};

// ==========================================================================
// SCREEN WAKE LOCK & ISOLAMENTO DE ABA (SESSION STORAGE TOKEN)
// ==========================================================================

// Gera ou recupera um identificador exclusivo para ESTA ABA do navegador.
// O sessionStorage é estritamente isolado entre abas (ao contrário de cookies e localStorage).
function getTabClientToken() {
    let token = sessionStorage.getItem('quaternity_tab_client_token');
    if (!token) {
        token = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'tab_' + Math.random().toString(36).substring(2) + Date.now();
        sessionStorage.setItem('quaternity_tab_client_token', token);
    }
    return token;
}

async function requestScreenWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
            wakeLockSentinel.addEventListener('release', () => {
                wakeLockSentinel = null;
            });
        }
    } catch (e) {
        console.warn('Wake Lock não suportado ou negado:', e);
    }
}

function releaseScreenWakeLock() {
    if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
    }
}

async function refreshCurrentTableState() {
    if (!currentTableId) return;
    try {
        const res = await fetch(`api/tables/${currentTableId}`);
        if (res.ok) {
            const table = await res.json();
            handleTableLiveUpdate(table);
        }
    } catch (e) {
        console.warn('Erro ao atualizar dados da mesa do servidor:', e);
    }
}

// Sincronização automática e imediata quando a aba ganha foco ou se torna visível
async function syncOnTabVisible() {
    if (document.visibilityState === 'visible') {
        if (currentTableData && currentTableData.state === 'RUNNING') {
            requestScreenWakeLock();
        }
        if (currentTableId) {
            await refreshCurrentTableState();
            subscribeToCurrentTable(currentTableId);
        }
    }
}

document.addEventListener('visibilitychange', syncOnTabVisible);
window.addEventListener('focus', syncOnTabVisible);

// Heartbeat de segurança a cada 2s para garantir sincronia constante
setInterval(() => {
    if (currentTableId && currentTableData && (currentTableData.state === 'RUNNING' || currentTableData.state === 'LOBBY')) {
        if (document.visibilityState === 'visible') {
            refreshCurrentTableState();
        }
    }
}, 2000);

// ==========================================================================
// INICIALIZAÇÃO E PERSISTÊNCIA DE SESSÃO
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializa ou recupera o identificador único e isolado desta aba
    getTabClientToken();

    // 2. Recupera nome customizado do jogador salvo no dispositivo
    const savedName = getSavedCustomName();
    if (savedName) {
        myPlayerName = savedName;
        const globalInput = document.getElementById('globalPlayerNameInput');
        if (globalInput) globalInput.value = savedName;
        const input = document.getElementById('playerNameInput');
        if (input) input.value = savedName;
    } else {
        sessionStorage.removeItem('quaternity_player_name');
    }

    const savedColor = sessionStorage.getItem('quaternity_player_color');
    if (savedColor) {
        myColor = savedColor;
    }

    connectWebSocket();

    // 3. Persistência de Sessão pós-refresh: Se o jogador já estava em uma mesa nesta aba, reconecta instantaneamente
    const savedTableId = sessionStorage.getItem('quaternity_table_id');
    if (savedTableId) {
        const reconnected = await attemptAutoReconnect(savedTableId, myPlayerName, myColor);
        if (reconnected) {
            return;
        }
    }

    fetchTablesList();

    // Se houver parâmetro ?tableId=... na URL, já abre a tela de seleção da mesa
    const params = new URLSearchParams(window.location.search);
    const preselectedTableId = params.get('tableId');
    if (preselectedTableId) {
        openColorSelectForTable(preselectedTableId);
    }
});

async function attemptAutoReconnect(tableId, playerName, playerColor) {
    if (!tableId) return false;
    try {
        const clientToken = getTabClientToken();
        const res = await fetch(`api/tables/${tableId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                color: playerColor,
                playerName: playerName,
                clientToken: clientToken
            })
        });

        if (res.ok) {
            const data = await res.json();
            currentTableId = tableId;
            myColor = data.assignedColor || playerColor;
            sessionStorage.setItem('quaternity_table_id', tableId);
            sessionStorage.setItem('quaternity_player_color', myColor);

            let table = data.table;
            if (!table || !table.players) {
                const getRes = await fetch(`api/tables/${tableId}`);
                if (getRes.ok) table = await getRes.json();
            }

            if (!table) return false;

            currentTableData = table;
            subscribeToCurrentTable(tableId);

            if (table.state === 'RUNNING' || table.state === 'PAUSED') {
                enterGameClock(table);
                showGameNotification('Você reconectou à sua partida em andamento!', 'info', 5000);
                voiceService.speak('Reconectado à partida.', false);
                return true;
            } else if (table.state === 'LOBBY') {
                enterLobby(table);
                showGameNotification('Você retornou à sala de espera da mesa.', 'info', 4000);
                return true;
            }
        } else {
            // Mesa não existe mais ou foi encerrada
            sessionStorage.removeItem('quaternity_table_id');
            sessionStorage.removeItem('quaternity_player_color');
        }
    } catch (e) {
        console.warn('Erro ao tentar reconectar à mesa salva:', e);
    }
    return false;
}

// Navegação entre telas SPA
function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'flex';
    }

    if (screenId === 'screenClock') {
        requestScreenWakeLock();
    } else {
        releaseScreenWakeLock();
    }
}

// ==========================================================================
// CONEXÃO WEBSOCKET STOMP
// ==========================================================================
function connectWebSocket() {
    const dot = document.getElementById('wsDot');
    const label = document.getElementById('wsStatusLabel');

    try {
        const socket = new SockJS('ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null; // Sem poluição no console

        stompClient.connect({}, (frame) => {
            if (dot) dot.style.background = '#10b981';
            if (label) label.innerText = 'Servidor Online • Ao Vivo';

            // Escuta atualizações de todas as mesas
            stompClient.subscribe('/topic/tables', (msg) => {
                try {
                    const tables = JSON.parse(msg.body);
                    renderTablesList(tables);
                } catch (e) {
                    console.error('Erro ao processar /topic/tables:', e);
                }
            });

            // Se o jogador já estiver dentro de uma mesa, re-assina imediatamente
            if (currentTableId) {
                subscribeToCurrentTable(currentTableId);
                refreshCurrentTableState();
                if (myColor) {
                    registerPlayerWebSocketSession();
                }
            }
        }, (error) => {
            if (dot) dot.style.background = '#eab308';
            if (label) label.innerText = 'Reconectando ao servidor...';
            setTimeout(connectWebSocket, 3000);
        });
    } catch (e) {
        console.error('Falha ao conectar WebSocket:', e);
        setTimeout(connectWebSocket, 3000);
    }
}

// ==========================================================================
// TELA 1: LISTAGEM DE MESAS DISPONÍVEIS
// ==========================================================================
let cachedTablesList = [];

function isMySlot(table, colorKey) {
    if (!table || !table.players) return false;
    const slot = table.players[colorKey];
    if (!slot) return false;
    const clientToken = getTabClientToken();
    const savedName = sessionStorage.getItem('quaternity_player_name') || myPlayerName;
    const savedColor = sessionStorage.getItem('quaternity_player_color') || myColor;

    if (slot.sessionId && slot.sessionId === clientToken) return true;
    if (savedColor && savedColor.toLowerCase() === colorKey.toLowerCase()
        && slot.playerName && savedName
        && !isGenericArmyName(savedName)
        && slot.playerName.trim().toLowerCase() === savedName.trim().toLowerCase()) {
        return true;
    }
    return false;
}

function isMyActiveTable(table) {
    if (!table || !table.players) return false;
    if (table.state === 'GAME_OVER' || table.state === 'ABORTED') return false;
    const clientToken = getTabClientToken();
    const savedName = sessionStorage.getItem('quaternity_player_name') || myPlayerName;
    const savedColor = sessionStorage.getItem('quaternity_player_color') || myColor;
    const savedTableId = sessionStorage.getItem('quaternity_table_id');

    if (savedTableId && savedTableId === table.id) return true;

    for (const color of TURN_ORDER) {
        const slot = table.players[color];
        if (slot) {
            if (slot.sessionId && slot.sessionId === clientToken) return true;
            if (savedColor && color === savedColor && slot.playerName && savedName && !isGenericArmyName(savedName) && slot.playerName.trim().toLowerCase() === savedName.trim().toLowerCase()) return true;
        }
    }
    return false;
}

async function handleTableCardClick(tableId) {
    const table = (cachedTablesList || []).find(t => t.id === tableId);
    if (table && isMyActiveTable(table)) {
        const reconnected = await attemptAutoReconnect(tableId, myPlayerName, myColor);
        if (reconnected) return;
    }
    openColorSelectForTable(tableId);
}

async function fetchTablesList() {
    try {
        const res = await fetch('api/tables');
        if (res.ok) {
            const tables = await res.json();
            cachedTablesList = tables;
            renderTablesList(tables);
        }
    } catch (e) {
        console.warn('Erro ao buscar mesas:', e);
    }
}

function renderTablesList(tables) {
    const container = document.getElementById('tablesListContainer');
    const badge = document.getElementById('tablesCountBadge');
    if (!container) return;

    cachedTablesList = tables || [];
    if (badge) badge.innerText = window.i18n ? window.i18n.t('tables.count_badge', cachedTablesList.length) : `${cachedTablesList.length} Table(s)`;

    if (!tables || tables.length === 0) {
        const noTitle = window.i18n ? window.i18n.t('play.no_tables_title') : 'Nenhuma mesa aberta no momento';
        const noDesc = window.i18n ? window.i18n.t('play.no_tables_desc') : 'Aguarde o árbitro ou organizador abrir uma nova mesa.';
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 16px; background: #0f172a; border-radius: 14px; border: 1px dashed #1e293b;">
                <i class="fa-solid fa-chess-board" style="font-size: 36px; color: #64748b; margin-bottom: 12px;"></i>
                <h3 style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">${noTitle}</h3>
                <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">${noDesc}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tables.map(t => {
        const connCount = t.connectedCount !== undefined ? t.connectedCount : (t.readyCount || 0);
        const isFull = connCount >= 4;
        const myActive = isMyActiveTable(t);
        const stateColorMap = {
            LOBBY: '#0284c7',
            RUNNING: '#10b981',
            PAUSED: '#eab308',
            GAME_OVER: '#ef4444'
        };
        const stateBg = stateColorMap[t.state] || '#64748b';
        const cardBorder = myActive ? 'border: 1.5px solid #10b981; box-shadow: 0 0 20px rgba(16, 185, 129, 0.28);' : '';

        return `
            <div class="table-row-card" style="${cardBorder}" onclick="handleTableCardClick('${t.id}')">
                <div class="table-row-top">
                    <span class="table-row-name">
                        ${escapeHtml(t.name)}
                        ${myActive ? '<span class="badge-you" style="margin-left: 8px; font-size: 10px; background: #10b981;">SUA MESA</span>' : ''}
                    </span>
                    <span class="table-row-state" style="background: ${stateBg}22; color: ${stateBg}; border: 1px solid ${stateBg}44;">
                        ${formatState(t.state)}
                    </span>
                </div>

                <div class="table-row-meta">
                    <span><i class="fa-regular fa-clock"></i> ${t.baseMinutes}m + ${t.incrementSeconds}s</span>
                    <span><i class="fa-solid fa-volume-high"></i> ${t.gameType === 'CONVENTIONAL' ? (window.i18n ? window.i18n.t('dashboard.beeps') : 'Bipes') : (window.i18n ? window.i18n.t('dashboard.inclusive') : 'Inclusivo')}</span>
                    <span><i class="fa-solid fa-users"></i> ${connCount}/4 ${window.i18n ? window.i18n.t('dashboard.players') : 'Jogadores'}</span>
                </div>

                <!-- 4 Bolinhas Canônicas: viva para livre, clara/fosca para ocupada -->
                <div class="table-dots-row">
                    ${renderTableDot(t, 'white')}
                    ${renderTableDot(t, 'red')}
                    ${renderTableDot(t, 'black')}
                    ${renderTableDot(t, 'green')}
                </div>

                ${myActive ? `
                    <button class="table-row-btn" style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-weight: 800;">
                        <i class="fa-solid fa-play"></i> ${window.i18n ? window.i18n.t('play.btn_continue') : 'Continuar Sua Partida'}
                    </button>
                ` : `
                    <button class="table-row-btn" ${isFull && t.state === 'RUNNING' ? 'style="background:#334155;"' : ''}>
                        <i class="fa-solid ${isFull ? 'fa-eye' : 'fa-right-to-bracket'}"></i>
                        ${isFull ? (window.i18n ? window.i18n.t('play.btn_observe') : 'Observar Partida') : (window.i18n ? window.i18n.t('play.btn_join') : 'Entrar na Mesa')}
                    </button>
                `}
            </div>
        `;
    }).join('');
}

function isSlotOccupied(table, colorKey) {
    if (!table || !table.players) return false;
    const slot = table.players[colorKey];
    if (slot && (slot.connected || (slot.playerName && slot.playerName !== 'Aguardando...'))) {
        return true;
    }
    if (table.colorAvailability && table.colorAvailability[colorKey] === false) {
        return true;
    }
    return false;
}

function renderTableDot(table, colorKey) {
    const isOccupied = isSlotOccupied(table, colorKey);
    const dotClass = isOccupied ? 'dot-occupied' : 'dot-free';
    const slot = table.players ? table.players[colorKey] : null;
    const occupiedWord = window.i18n ? window.i18n.t('play.occupied') : 'Ocupada';
    const freeWord = window.i18n ? window.i18n.t('play.available') : 'Livre';
    const colorName = window.i18n ? window.i18n.getColorName(colorKey) : colorKey;
    const pName = (slot && slot.playerName && slot.playerName !== 'Aguardando...') ? slot.playerName : (isOccupied ? occupiedWord : freeWord);
    return `<span class="army-dot dot-${colorKey} ${dotClass}" title="${colorName}: ${escapeHtml(pName)}"></span>`;
}

// ==========================================================================
// TELA 2: ESCOLHA DE COR E NOME DO JOGADOR
// ==========================================================================
async function openColorSelectForTable(tableId) {
    currentTableId = tableId;
    selectedColorToJoin = null;

    // Assina atualizações em tempo real da mesa imediatamente para refletir jogadores conectando
    subscribeToCurrentTable(tableId);

    try {
        const res = await fetch(`api/tables/${tableId}`);
        if (!res.ok) {
            showGameNotification('Mesa não encontrada ou encerrada.', 'danger');
            return;
        }
        currentTableData = await res.json();
        setupColorSelectUI(currentTableData);
        goToScreen('screenColorSelect');
    } catch (e) {
        console.error('Erro ao abrir seleção de cor:', e);
    }
}

function leaveColorSelect() {
    if (!myColor && tableSubscription) {
        tableSubscription.unsubscribe();
        tableSubscription = null;
    }
    selectedColorToJoin = null;
    currentTableId = null;
    currentTableData = null;
    goToScreen('screenTables');
    fetchTablesList();
}

function setupColorSelectUI(table) {
    document.getElementById('selectTableName').innerText = table.name;
    document.getElementById('selectTableMeta').innerText = `${table.baseMinutes} min + ${table.incrementSeconds}s/lance`;

    const confirmBtn = document.getElementById('btnConfirmJoin');
    let hasMySlot = false;
    let mySlotColor = null;

    // Atualiza o estado dos 4 cards de cor
    TURN_ORDER.forEach(color => {
        const cap = color.charAt(0).toUpperCase() + color.slice(1);
        const card = document.getElementById(`cardSelect${cap}`);
        const status = document.getElementById(`statusSelect${cap}`);
        const playerSlot = table.players ? table.players[color] : null;
        const isMine = isMySlot(table, color);
        const isOccupied = !isMine && isSlotOccupied(table, color);

        if (isMine) {
            hasMySlot = true;
            mySlotColor = color;
        }

        const titleEl = document.getElementById(`armyTitle${cap}`);
        if (titleEl) {
            titleEl.innerText = window.i18n ? window.i18n.getColorName(color) : (ARMY_CONFIG[color]?.name || cap);
        }

        if (card) {
            card.classList.remove('selected', 'disabled', 'is-my-slot');
            if (isMine) {
                card.classList.add('is-my-slot');
                if (status) {
                    const yourSlotText = window.i18n ? (window.i18n.currentLang === 'en' ? 'Your Slot (You)' : window.i18n.currentLang === 'es' ? 'Tu Lugar (Tú)' : 'Sua Vaga (Você)') : 'Sua Vaga (Você)';
                    status.innerHTML = `<span style="color: #10b981; font-weight: 800;"><i class="fa-solid fa-user-check"></i> ${yourSlotText}</span>`;
                }
            } else if (isOccupied) {
                card.classList.add('disabled');
                const occLabel = window.i18n ? window.i18n.t('play.occupied') : 'Ocupado';
                const pName = (playerSlot && playerSlot.playerName && playerSlot.playerName !== 'Aguardando...')
                    ? playerSlot.playerName
                    : occLabel;
                if (status) status.innerText = `${occLabel} (${escapeHtml(pName)})`;
            } else {
                if (status) status.innerText = window.i18n ? window.i18n.t('play.available') : 'Disponível';
            }
        }
    });

    if (hasMySlot && mySlotColor) {
        selectedColorToJoin = mySlotColor;
        const cap = mySlotColor.charAt(0).toUpperCase() + mySlotColor.slice(1);
        const myCard = document.getElementById(`cardSelect${cap}`);
        if (myCard) myCard.classList.add('selected');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-play"></i> ' + (window.i18n ? window.i18n.t('play.btn_continue') : 'Reconectar e Continuar');
        }
    } else {
        if (selectedColorToJoin) {
            const cap = selectedColorToJoin.charAt(0).toUpperCase() + selectedColorToJoin.slice(1);
            const selCard = document.getElementById(`cardSelect${cap}`);
            if (selCard && !isSlotOccupied(table, selectedColorToJoin)) {
                selCard.classList.add('selected');
            } else {
                selectedColorToJoin = null;
            }
        }
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> ' + (window.i18n ? window.i18n.t('play.btn_enter_table') : 'Entrar na Mesa');
            confirmBtn.disabled = !selectedColorToJoin || isSlotOccupied(table, selectedColorToJoin);
        }
    }

    // Se o jogador tem um apelido customizado salvo, preserva no campo
    const nameInput = document.getElementById('playerNameInput');
    const custom = getSavedCustomName();
    if (nameInput) {
        if (custom) {
            nameInput.value = custom;
        } else {
            nameInput.value = '';
        }
        nameInput.placeholder = 'Ex: Jogador ' + (selectedColorToJoin ? ARMY_CONFIG[selectedColorToJoin].name : '1');
    }
}

function selectColor(colorKey) {
    if (!currentTableData) return;
    const isMine = isMySlot(currentTableData, colorKey);
    if (isSlotOccupied(currentTableData, colorKey) && !isMine) {
        // Já ocupado por outro jogador
        return;
    }

    selectedColorToJoin = colorKey;

    // Remove seleção anterior
    document.querySelectorAll('.army-select-card').forEach(c => c.classList.remove('selected'));

    // Adiciona seleção ao escolhido
    const cap = colorKey.charAt(0).toUpperCase() + colorKey.slice(1);
    const card = document.getElementById(`cardSelect${cap}`);
    if (card) card.classList.add('selected');

    const confirmBtn = document.getElementById('btnConfirmJoin');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        if (isMine) {
            confirmBtn.innerHTML = '<i class="fa-solid fa-play"></i> Reconectar e Continuar';
        } else {
            confirmBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar na Mesa';
        }
    }

    // Atualiza apenas o placeholder com a cor escolhida (NUNCA força o input com texto de cor)
    const nameInput = document.getElementById('playerNameInput');
    if (nameInput) {
        if (isGenericArmyName(nameInput.value)) {
            nameInput.value = '';
        }
        nameInput.placeholder = `Ex: Jogador ${ARMY_CONFIG[colorKey].name}`;
    }
}

async function confirmJoinTable() {
    if (!currentTableId || !selectedColorToJoin) return;

    const nameInput = document.getElementById('playerNameInput');
    const inputVal = nameInput ? nameInput.value.trim() : '';

    let chosenName;
    if (inputVal && !isGenericArmyName(inputVal)) {
        chosenName = inputVal;
        saveCustomName(chosenName);
    } else {
        chosenName = `Jogador ${ARMY_CONFIG[selectedColorToJoin].name}`;
        sessionStorage.setItem('quaternity_player_name', chosenName);
    }

    myColor = selectedColorToJoin;
    myPlayerName = chosenName;
    sessionStorage.setItem('quaternity_player_name', chosenName);

    const clientToken = getTabClientToken();

    try {
        const res = await fetch(`api/tables/${currentTableId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                color: myColor,
                playerName: myPlayerName,
                clientToken: clientToken
            })
        });

        if (res.ok) {
            const data = await res.json();
            myColor = data.assignedColor || myColor;
            sessionStorage.setItem('quaternity_table_id', currentTableId);
            sessionStorage.setItem('quaternity_player_color', myColor);
            sessionStorage.setItem('quaternity_player_name', myPlayerName);

            // Obtém os dados completos da mesa (vindos no retorno ou via fetch de segurança)
            let table = data.table;
            if (!table || !table.players) {
                const refreshRes = await fetch(`api/tables/${currentTableId}`);
                if (refreshRes.ok) {
                    table = await refreshRes.json();
                }
            }

            currentTableData = table;
            subscribeToCurrentTable(currentTableId);

            if (table && (table.state === 'RUNNING' || table.state === 'PAUSED')) {
                enterGameClock(table);
            } else if (table) {
                enterLobby(table);
            }
        } else {
            const err = await res.json();
            showGameNotification(err.error || err.message || 'Erro ao entrar na mesa.', 'danger');
            if (currentTableId) {
                openColorSelectForTable(currentTableId);
            }
        }
    } catch (e) {
        console.error('Erro na requisição de entrada:', e);
        showGameNotification('Falha ao comunicar com o servidor: ' + (e.message || e), 'danger');
    }
}

// ==========================================================================
// ASSINATURA WEBSOCKET DA MESA SELECIONADA
// ==========================================================================
let tableDeletedSubscription = null;
let alreadyAnnouncedAborted = false;

function subscribeToCurrentTable(tableId) {
    if (!stompClient || !stompClient.connected) return;

    if (tableSubscription) {
        tableSubscription.unsubscribe();
        tableSubscription = null;
    }
    if (tableDeletedSubscription) {
        tableDeletedSubscription.unsubscribe();
        tableDeletedSubscription = null;
    }
    if (tableCountdownSubscription) {
        tableCountdownSubscription.unsubscribe();
        tableCountdownSubscription = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    alreadyAnnouncedAborted = false;

    tableSubscription = stompClient.subscribe(`/topic/table/${tableId}`, (msg) => {
        try {
            const updatedTable = JSON.parse(msg.body);
            handleTableLiveUpdate(updatedTable);
        } catch (e) {
            console.error('Erro ao processar /topic/table update:', e);
        }
    });

    tableDeletedSubscription = stompClient.subscribe(`/topic/table/${tableId}/deleted`, (msg) => {
        showGameNotification('Esta mesa foi encerrada e excluída pelo administrador.', 'danger', 6000);
        voiceService.speak('Mesa encerrada pelo administrador.', true);
        leaveCurrentTable();
    });

    if (tableCountdownSubscription) {
        tableCountdownSubscription.unsubscribe();
        tableCountdownSubscription = null;
    }

    tableCountdownSubscription = stompClient.subscribe(`/topic/table/${tableId}/countdown`, (msg) => {
        try {
            const countdownData = JSON.parse(msg.body);
            startVisualCountdown(countdownData);
        } catch (e) {
            console.error('Erro ao processar /topic/table/countdown:', e);
        }
    });

    if (myColor) {
        registerPlayerWebSocketSession();
    }
}

function registerPlayerWebSocketSession() {
    if (!stompClient || !stompClient.connected || !currentTableId || !myColor) return;
    try {
        const clientToken = getTabClientToken();
        stompClient.send(`app/table/${currentTableId}/register`, {}, JSON.stringify({
            color: myColor,
            player: myColor,
            clientToken: clientToken,
            playerName: myPlayerName
        }));
    } catch (e) {
        console.warn('Erro ao registrar sessão WebSocket do jogador:', e);
    }
}

function handleTableLiveUpdate(table) {
    const previousTable = currentTableData;
    currentTableData = table;

    // Se a partida foi cancelada pelo administrador
    if (table.state === 'ABORTED') {
        handleTableAborted(table);
        return;
    }

    // Se não estiver cancelada, garante que o overlay de cancelamento fique oculto
    const abortedOverlay = document.getElementById('overlayAborted');
    if (abortedOverlay) abortedOverlay.style.display = 'none';

    // Notificações em tempo real para os demais participantes (Abandono, Eliminação ou Saída do Lobby)
    if (previousTable && previousTable.players && table.players) {
        TURN_ORDER.forEach(color => {
            const prevSlot = previousTable.players[color];
            const newSlot = table.players[color];
            if (prevSlot && newSlot) {
                // Caso 1: Exército eliminado durante a partida (Abandono / Desistência ou Baixa de Bandeira)
                if (prevSlot.alive !== false && newSlot.alive === false) {
                    const cfg = ARMY_CONFIG[color];
                    const armyName = cfg ? cfg.name : color;
                    const playerName = (newSlot.playerName && newSlot.playerName !== 'Aguardando...')
                        ? newSlot.playerName
                        : (prevSlot.playerName || armyName);
                    const isAbandonment = newSlot.eliminationReason && newSlot.eliminationReason.toLowerCase().includes('abandono');

                    if (isAbandonment) {
                        showGameNotification(`O jogador ${playerName} (${armyName}) abandonou a partida. O exército foi eliminado.`, 'danger', 6000);
                        voiceService.speak(`O exército ${armyName} abandonou a partida e foi eliminado.`, true);
                    } else {
                        const reasonDisplay = (!newSlot.eliminationReason || newSlot.eliminationReason.toUpperCase() === 'FLAG_DROP')
                            ? 'Bandeira baixada'
                            : newSlot.eliminationReason;
                        showGameNotification(`O exército ${armyName} foi eliminado (${reasonDisplay}).`, 'warning', 5000);
                        voiceService.announceElimination(color);
                    }
                }

                // Caso 2: Notificações em tempo real na Sala de Espera (Lobby)
                if (table.state === 'LOBBY' && previousTable.state === 'LOBBY') {
                    const wasConnected = prevSlot.connected || (prevSlot.playerName && prevSlot.playerName !== 'Aguardando...');
                    const isConnected = newSlot.connected || (newSlot.playerName && newSlot.playerName !== 'Aguardando...');
                    const cfg = ARMY_CONFIG[color];
                    const armyName = cfg ? cfg.name : color;

                    // Jogador saiu da sala
                    if (wasConnected && !isConnected && color !== myColor) {
                        const pName = prevSlot.playerName && prevSlot.playerName !== 'Aguardando...' ? prevSlot.playerName : armyName;
                        showGameNotification(`O jogador ${pName} (${armyName}) saiu da sala de espera.`, 'info', 4000);
                        voiceService.speak(`${pName} saiu da mesa.`);
                    }

                    // Novo jogador entrou na sala
                    if (!wasConnected && isConnected && color !== myColor) {
                        const pName = newSlot.playerName && newSlot.playerName !== 'Aguardando...' ? newSlot.playerName : armyName;
                        showGameNotification(`${pName} conectou-se como exército ${armyName}.`, 'info', 4000);
                        voiceService.speak(`${pName} entrou como exército ${armyName}.`);
                    }

                    // Jogador alterou confirmação de prontidão
                    if (wasConnected && isConnected && prevSlot.ready !== newSlot.ready && color !== myColor) {
                        const pName = newSlot.playerName && newSlot.playerName !== 'Aguardando...' ? newSlot.playerName : armyName;
                        if (newSlot.ready) {
                            showGameNotification(`${pName} (${armyName}) está pronto!`, 'success', 3000);
                            voiceService.speak(`Exército ${armyName} está pronto.`);
                        } else {
                            showGameNotification(`${pName} (${armyName}) cancelou confirmação.`, 'info', 3000);
                            voiceService.speak(`Exército ${armyName} cancelou prontidão.`);
                        }
                    }
                }
            }
        });
    }

    // Se a partida iniciou ou está em andamento (RUNNING ou PAUSED)
    if (table.state === 'RUNNING' || table.state === 'PAUSED') {
        const lobbyScreen = document.getElementById('screenLobby');
        const colorSelectScreen = document.getElementById('screenColorSelect');
        const clockScreen = document.getElementById('screenClock');

        // Se o jogador está na sala de espera ou na tela de cor, entra no relógio imediatamente
        if (lobbyScreen && (lobbyScreen.classList.contains('active') || lobbyScreen.style.display === 'flex')) {
            enterGameClock(table);
            return;
        }
        if (colorSelectScreen && colorSelectScreen.classList.contains('active') && myColor) {
            enterGameClock(table);
            return;
        }
        if (clockScreen && (clockScreen.classList.contains('active') || clockScreen.style.display === 'flex')) {
            updateClockUI(table);
            return;
        }
    }

    // Atualiza tela de Seleção de Cor em tempo real se o jogador estiver escolhendo a cor nesta mesa
    const colorSelectScreen = document.getElementById('screenColorSelect');
    if (colorSelectScreen && colorSelectScreen.classList.contains('active')) {
        setupColorSelectUI(table);
    }

    // Atualiza Lobby se a tela atual for o Lobby
    const lobbyScreen = document.getElementById('screenLobby');
    if (lobbyScreen && (lobbyScreen.classList.contains('active') || lobbyScreen.style.display === 'flex')) {
        updateLobbyUI(table);
    }

    // Atualiza Relógio se a tela atual for o Relógio
    const clockScreen = document.getElementById('screenClock');
    if (clockScreen && (clockScreen.classList.contains('active') || clockScreen.style.display === 'flex')) {
        updateClockUI(table);
    }
}

function handleTableAborted(table) {
    // Congela relógio na tela
    updateClockUI(table);

    // Oculta overlays de pausa e vitória
    const pauseOverlay = document.getElementById('overlayPause');
    if (pauseOverlay) pauseOverlay.style.display = 'none';
    const winnerOverlay = document.getElementById('overlayWinner');
    if (winnerOverlay) winnerOverlay.style.display = 'none';

    // Exibe overlay de partida cancelada se estiver no relógio
    const clockScreen = document.getElementById('screenClock');
    const abortedOverlay = document.getElementById('overlayAborted');
    if (clockScreen && clockScreen.classList.contains('active')) {
        if (abortedOverlay) abortedOverlay.style.display = 'flex';
    } else {
        showGameNotification('A partida desta mesa foi cancelada pelo administrador.', 'danger', 6000);
        leaveCurrentTable();
    }

    if (!alreadyAnnouncedAborted) {
        alreadyAnnouncedAborted = true;
        voiceService.speak('Atenção: Partida cancelada pelo administrador.', true);
    }
}

// ==========================================================================
// TELA 3: SALA DE ESPERA (LOBBY)
// ==========================================================================
function enterLobby(table) {
    if (table && table.id) {
        currentTableId = table.id;
        sessionStorage.setItem('quaternity_table_id', table.id);
    }
    updateLobbyUI(table);
    goToScreen('screenLobby');
}

function updateLobbyUI(table) {
    if (!table) return;
    if (table.state === 'RUNNING' || table.state === 'PAUSED') {
        enterGameClock(table);
        return;
    }
    document.getElementById('lobbyTableName').innerText = table.name;
    document.getElementById('lobbyTableMeta').innerText = `${table.baseMinutes} min + ${table.incrementSeconds}s/lance`;

    // Conta conectados e prontos
    let connectedCount = 0;
    let readyCount = 0;
    TURN_ORDER.forEach(c => {
        const slot = table.players[c];
        if (slot) {
            const isConn = slot.connected || (slot.playerName && slot.playerName !== 'Aguardando...');
            if (isConn) connectedCount++;
            if (slot.ready) readyCount++;
        }
    });

    document.getElementById('lobbyPlayerCountBadge').innerText = window.i18n ? window.i18n.t('lobby.connected_badge', connectedCount) : `${connectedCount}/4 conectados`;

    const titleEl = document.getElementById('lobbyTitleText');
    const subEl = document.getElementById('lobbySubText');
    const readyCard = document.getElementById('readyConfirmCard');
    const readyProgress = document.getElementById('readyProgressBar');
    const readyCountLabel = document.getElementById('readyCountLabel');

    const allConnected = (connectedCount === 4);
    if (readyCard) readyCard.classList.toggle('all-connected', allConnected);

    if (allConnected) {
        if (readyCount === 4) {
            if (titleEl) titleEl.innerText = window.i18n ? window.i18n.t('lobby.all_ready_title') : 'Todos Prontos! Iniciando...';
            if (subEl) subEl.innerText = window.i18n ? window.i18n.t('lobby.all_ready_sub') : 'Todos os 4 jogadores confirmaram Sim. O relógio começará a rodar!';
        } else {
            if (titleEl) titleEl.innerText = window.i18n ? window.i18n.t('lobby.ready_title') : 'Pronto para iniciar?';
            if (subEl) subEl.innerText = window.i18n ? window.i18n.t('lobby.all_connected_sub', readyCount) : `Todos os 4 jogadores conectaram. Aguardando a resposta de todos (${readyCount}/4 confirmaram Sim)...`;
        }
    } else {
        if (titleEl) titleEl.innerText = window.i18n ? window.i18n.t('lobby.waiting_players') : 'Aguardando Jogadores';
        if (subEl) subEl.innerText = window.i18n ? window.i18n.t('lobby.waiting_conn_sub', connectedCount) : `Aguardando a conexão dos 4 jogadores na mesa (${connectedCount}/4 conectados)...`;
    }

    if (readyProgress) {
        const pct = (readyCount / 4) * 100;
        readyProgress.style.width = `${pct}%`;
    }
    const readyProgressContainer = document.getElementById('readyProgressContainer');
    if (readyProgressContainer) {
        readyProgressContainer.setAttribute('aria-valuenow', readyCount);
    }
    if (readyCountLabel) {
        readyCountLabel.innerText = window.i18n ? window.i18n.t('lobby.count_label', readyCount, 4) : `${readyCount} de 4 jogadores responderam Sim`;
    }

    // Atualiza os 4 Slots na Sala de Espera
    TURN_ORDER.forEach(color => {
        const cap = color.charAt(0).toUpperCase() + color.slice(1);
        const playerSlot = table.players[color];
        const isConn = playerSlot && (playerSlot.connected || (playerSlot.playerName && playerSlot.playerName !== 'Aguardando...'));
        const isReady = playerSlot && playerSlot.ready;

        const slotEl = document.getElementById(`lobbySlot${cap}`);
        const nameEl = document.getElementById(`lobbyPlayer${cap}`);
        const badgeEl = document.getElementById(`lobbyBadge${cap}`);
        const lobbySlotNameEl = document.getElementById(`lobbyName${cap}`);
        const cfg = ARMY_CONFIG[color];
        const armyName = window.i18n ? window.i18n.getColorName(color) : (cfg ? cfg.name : cap);
        if (lobbySlotNameEl) lobbySlotNameEl.innerText = armyName;
        let accessibleDesc = `Exército ${armyName}. `;

        if (slotEl) {
            slotEl.classList.toggle('ready', isReady);
        }
        if (nameEl) {
            if (isConn) {
                const isMe = color === myColor;
                const displayName = escapeHtml(playerSlot.playerName || 'Jogador');
                if (isMe) {
                    nameEl.innerHTML = `<span class="slot-player-title">${displayName} <strong class="badge-you">★ (${window.i18n ? (window.i18n.currentLang === "en" ? "You" : window.i18n.currentLang === "es" ? "Tú" : "Você") : "Você"})</strong></span>
                        <button class="btn-slot-rename" onclick="editMyLobbyName(event)" title="Alterar seu nome">
                            <i class="fa-solid fa-pen"></i> ${window.i18n ? window.i18n.t('lobby.btn_edit_name') : 'Alterar'}
                        </button>`;
                } else {
                    nameEl.innerText = displayName;
                }
                accessibleDesc += `Jogador: ${playerSlot.playerName || 'Jogador'}${isMe ? ', você' : ''}. `;
            } else {
                nameEl.innerText = window.i18n ? window.i18n.t('lobby.waiting_player_slot') : 'Aguardando jogador...';
                accessibleDesc += 'Vaga livre, aguardando jogador. ';
            }
        }
        if (badgeEl) {
            if (!isConn) {
                badgeEl.className = 'lobby-ready-badge badge-empty';
                badgeEl.innerText = window.i18n ? window.i18n.t('dashboard.free') : 'Livre';
                accessibleDesc += 'Status: Vaga Livre.';
            } else if (isReady) {
                badgeEl.className = 'lobby-ready-badge badge-ready';
                badgeEl.innerText = window.i18n ? window.i18n.t('lobby.badge_ready') : 'Pronto ✓';
                accessibleDesc += 'Status: Confirmado e Pronto.';
            } else {
                badgeEl.className = 'lobby-ready-badge badge-pending';
                badgeEl.innerText = window.i18n ? window.i18n.t('lobby.badge_waiting') : 'Aguardando';
                accessibleDesc += 'Status: Aguardando resposta.';
            }
        }
        if (slotEl) {
            slotEl.setAttribute('aria-label', accessibleDesc);
        }
    });

    // Atualiza o botão de alternar prontidão do jogador atual
    const mySlot = myColor ? table.players[myColor] : null;
    const iAmReady = mySlot && mySlot.ready;
    const btnToggle = document.getElementById('btnReadyToggle');
    const btnLabel = document.getElementById('btnReadyLabel');

    if (btnToggle && btnLabel) {
        if (iAmReady) {
            btnToggle.className = 'btn-ready-toggle btn-is-ready';
            btnToggle.title = window.i18n ? window.i18n.t('lobby.btn_ready_cancel') : 'Clique para cancelar prontidão';
            btnLabel.innerText = window.i18n ? window.i18n.t('lobby.btn_ready_cancel') : 'Cancelar prontidão';
            btnToggle.setAttribute('aria-pressed', 'true');
            btnToggle.setAttribute('aria-label', 'Você está pronto. Toque para cancelar confirmação.');
        } else {
            btnToggle.className = 'btn-ready-toggle btn-not-ready';
            btnToggle.title = window.i18n ? window.i18n.t('lobby.btn_ready') : 'Clique para confirmar prontidão';
            btnLabel.innerText = window.i18n ? window.i18n.t('lobby.btn_ready') : 'Estou pronto';
            btnToggle.setAttribute('aria-pressed', 'false');
            btnToggle.setAttribute('aria-label', 'Confirmar que você está pronto para iniciar a partida.');
        }
    }
}

async function editMyLobbyName(e) {
    if (e) e.stopPropagation();
    if (!currentTableId || !myColor) return;

    const currentName = myPlayerName || (currentTableData && currentTableData.players && currentTableData.players[myColor] ? currentTableData.players[myColor].playerName : '');
    const newName = prompt('Digite seu novo nome / apelido para esta partida:', currentName);
    if (newName === null) return;

    const trimmed = newName.trim();
    if (!trimmed) {
        showGameNotification('O nome não pode ser vazio.', 'warning');
        return;
    }

    try {
        const clientToken = getTabClientToken();
        const res = await fetch(`api/tables/${currentTableId}/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                color: myColor,
                clientToken: clientToken,
                newName: trimmed
            })
        });

        if (res.ok) {
            saveCustomName(trimmed);
            showGameNotification('Nome atualizado com sucesso!', 'success');
            if (stompClient && stompClient.connected) {
                stompClient.send(`/app/table/${currentTableId}/rename`, {}, JSON.stringify({
                    color: myColor,
                    clientToken: clientToken,
                    newName: trimmed
                }));
            }
        } else {
            const err = await res.json().catch(() => ({}));
            showGameNotification(err.message || 'Erro ao alterar nome.', 'error');
        }
    } catch (err) {
        console.error('Erro ao renomear jogador:', err);
        showGameNotification('Falha de conexão ao alterar nome.', 'error');
    }
}

async function toggleMyReadyState() {
    if (!currentTableId || !myColor) return;

    const mySlot = currentTableData?.players?.[myColor];
    const currentlyReady = !!(mySlot && mySlot.ready);
    const nextState = !currentlyReady;

    if (navigator.vibrate) {
        navigator.vibrate(nextState ? [50, 40, 50] : 40);
    }

    // Feedback sonoro e por voz para acessibilidade (cegos e baixa visão)
    beeper.playBeep(nextState ? 660 : 440, 0.15);
    voiceService.speak(nextState ? 'Você confirmou que está pronto.' : 'Confirmação cancelada.', true);

    // Tenta primeiro via WebSocket STOMP
    if (stompClient && stompClient.connected) {
        stompClient.send(`/app/table/${currentTableId}/ready`, {}, JSON.stringify({
            player: myColor,
            color: myColor,
            ready: nextState
        }));
    }

    // Envia também via REST para garantia
    try {
        await fetch(`api/tables/${currentTableId}/ready`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player: myColor,
                color: myColor,
                ready: nextState
            })
        });
    } catch (e) {
        console.error('Erro ao alternar estado de pronto:', e);
    }
}

async function leaveCurrentTable() {
    if (currentTableId && myColor) {
        try {
            const clientToken = getTabClientToken();
            await fetch(`api/tables/${currentTableId}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player: myColor,
                    color: myColor,
                    clientToken: clientToken,
                    sessionId: clientToken
                })
            });
        } catch (e) {
            console.warn('Erro ao sair da mesa no servidor:', e);
        }
    }

    if (tableSubscription) {
        tableSubscription.unsubscribe();
        tableSubscription = null;
    }
    if (tableDeletedSubscription) {
        tableDeletedSubscription.unsubscribe();
        tableDeletedSubscription = null;
    }
    if (tableCountdownSubscription) {
        tableCountdownSubscription.unsubscribe();
        tableCountdownSubscription = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    alreadyAnnouncedAborted = false;
    currentTableId = null;
    currentTableData = null;
    myColor = null;
    selectedColorToJoin = null;
    sessionStorage.removeItem('quaternity_table_id');
    sessionStorage.removeItem('quaternity_player_color');
    if (isGenericArmyName(myPlayerName)) {
        sessionStorage.removeItem('quaternity_player_name');
        myPlayerName = getSavedCustomName();
    }

    // Garante que todos os overlays fiquem ocultos ao sair
    const abortedOverlay = document.getElementById('overlayAborted');
    if (abortedOverlay) abortedOverlay.style.display = 'none';
    const pauseOverlay = document.getElementById('overlayPause');
    if (pauseOverlay) pauseOverlay.style.display = 'none';
    const winnerOverlay = document.getElementById('overlayWinner');
    if (winnerOverlay) winnerOverlay.style.display = 'none';
    const abandonModal = document.getElementById('modalConfirmAbandon');
    if (abandonModal) abandonModal.style.display = 'none';
    const confirmModal = document.getElementById('modalConfirmDialog');
    if (confirmModal) confirmModal.style.display = 'none';

    goToScreen('screenTables');
    fetchTablesList();
}

// ==========================================================================
// TELA 4: RELÓGIO OFICIAL DO JOGO (FULL MOBILE TOUCH CLOCK)
// ==========================================================================
let prevActiveTurn = null;

function enterGameClock(table) {
    if (table && table.id) {
        currentTableId = table.id;
        sessionStorage.setItem('quaternity_table_id', table.id);
    }
    registerPlayerWebSocketSession();
    goToScreen('screenClock');
    prevActiveTurn = null;
    if (table && table.state === 'RUNNING' && (!table.moveCount || table.moveCount === 0)) {
        voiceService.announceGameStart();
    }
    updateClockUI(table);
}

function updateClockUI(table) {
    const isRunning = table.state === 'RUNNING';
    const isPaused = table.state === 'PAUSED';
    const isGameOver = table.state === 'GAME_OVER';
    const isAborted = table.state === 'ABORTED';
    const activeTurnKey = (table.activeTurn || 'white').toLowerCase();

    // Atualiza Barra Superior
    const turnText = document.getElementById('clockActiveTurnText');
    const turnBullet = document.getElementById('turnBullet');
    const pauseIcon = document.getElementById('pauseIcon');
    const moveText = document.getElementById('clockMoveText');
    const btnUndoMove = document.getElementById('btnUndoMove');
    const btnUndoPause = document.getElementById('btnUndoPause');

    const moveCount = table.moveCount !== undefined ? table.moveCount : (table.movesHistory ? table.movesHistory.length : 0);
    const mySlot = (myColor && table.players) ? table.players[myColor] : null;
    const isEliminated = !!(mySlot && mySlot.alive === false);

    if (moveText) {
        moveText.innerText = `Lance #${moveCount}`;
    }
    if (btnUndoMove) {
        btnUndoMove.style.display = (!isEliminated && moveCount > 0) ? 'flex' : 'none';
    }
    if (btnUndoPause) {
        btnUndoPause.style.display = (!isEliminated && moveCount > 0) ? 'inline-flex' : 'none';
    }

    const btnPauseToggle = document.getElementById('btnPauseToggle');
    if (btnPauseToggle) {
        if (isEliminated) {
            btnPauseToggle.disabled = true;
            btnPauseToggle.style.opacity = '0.35';
            btnPauseToggle.style.cursor = 'not-allowed';
            btnPauseToggle.title = 'Apenas jogadores ativos podem pausar ou despausar a partida.';
        } else {
            btnPauseToggle.disabled = false;
            btnPauseToggle.style.opacity = '1';
            btnPauseToggle.style.cursor = 'pointer';
            btnPauseToggle.title = isPaused ? 'Retomar tempo da partida' : 'Pausar tempo da partida';
        }
    }

    const btnExit = document.querySelector('.btn-exit');
    if (btnExit) {
        if (isEliminated || isGameOver) {
            btnExit.style.display = 'flex';
            btnExit.title = 'Sair da Sala (Voltar ao Lobby de Mesas)';
            btnExit.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
        } else {
            // Jogador ativo: a desistência é feita exclusivamente pelo botão da Bandeira no seu quadrante
            btnExit.style.display = 'none';
        }
    }

    if (turnText) {
        if (isAborted) {
            turnText.innerText = 'CANCELADA';
            turnText.style.color = '#ef4444';
        } else {
            const i18n = voiceService.getLangConfig();
            const colorName = i18n.colors[activeTurnKey] || (ARMY_CONFIG[activeTurnKey]?.name || activeTurnKey);
            turnText.innerText = colorName;
            turnText.style.color = ARMY_CONFIG[activeTurnKey]?.hex || '#ffffff';
        }
    }
    if (turnBullet) {
        turnBullet.style.background = isAborted ? '#ef4444' : (ARMY_CONFIG[activeTurnKey]?.hex || '#f59e0b');
    }
    if (pauseIcon) {
        pauseIcon.className = isPaused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
    }

    // Anúncio de voz de alternância de turno
    if (isRunning && prevActiveTurn !== activeTurnKey) {
        prevActiveTurn = activeTurnKey;
        voiceService.announceTurn(activeTurnKey, activeTurnKey === myColor);
    }

    // Atualiza os 4 Quadrantes
    TURN_ORDER.forEach(color => {
        const cap = color.charAt(0).toUpperCase() + color.slice(1);
        const slot = table.players[color] || {};
        const isAlive = slot.alive !== false;
        const isTurn = isRunning && activeTurnKey === color;
        const isMine = myColor === color;

        const quad = document.getElementById(`clockQuad${cap}`);
        const title = document.getElementById(`title${cap}`);
        const digits = document.getElementById(`digits${cap}`);
        const sub = document.getElementById(`sub${cap}`);
        const flagBtn = document.getElementById(`flagBtn${cap}`);

        if (quad) {
            quad.classList.toggle('turn-active', isTurn && isAlive);
            quad.classList.toggle('eliminated', !isAlive);
        }

        if (title) {
            title.innerHTML = `${ARMY_CONFIG[color].name} ${isMine ? '<span class="badge-you">VOCÊ</span>' : ''}`;
        }

        if (digits) {
            digits.innerText = slot.formattedTime || '00:00';
        }

        if (sub) {
            if (!isAlive) {
                if (slot.eliminationReason && slot.eliminationReason.toLowerCase().includes('abandono')) {
                    sub.innerText = 'Eliminado por Abandono';
                } else if (!slot.eliminationReason || slot.eliminationReason.toUpperCase() === 'FLAG_DROP' || slot.eliminationReason.toLowerCase().includes('bandeira')) {
                    sub.innerText = 'Bandeira Baixada (Omitido)';
                } else {
                    sub.innerText = `Eliminado (${slot.eliminationReason})`;
                }
            } else if (isTurn) {
                sub.innerText = isMine ? 'TOQUE PARA PASSAR O LANCE' : 'Jogando...';
            } else {
                sub.innerText = (slot.connected || slot.ready) ? (escapeHtml(slot.playerName || 'Jogador')) : 'Aguardando';
            }
        }

        if (flagBtn) {
            // Um jogador só pode desistir pelo seu próprio exército
            const canManageFlag = (color === myColor);
            flagBtn.style.display = canManageFlag ? 'flex' : 'none';
            if (isAlive) {
                flagBtn.className = 'btn-quad-flag';
                flagBtn.title = 'Desistir / Baixar Bandeira';
                flagBtn.onclick = (e) => { e.stopPropagation(); triggerEliminate(color); };
                flagBtn.innerHTML = '<i class="fa-solid fa-flag"></i>';
            } else {
                flagBtn.className = 'btn-quad-flag btn-reinstate';
                flagBtn.title = 'Remover Bandeira Negra / Reintegrar Exército';
                flagBtn.onclick = (e) => { e.stopPropagation(); triggerReinstate(color); };
                flagBtn.innerHTML = '<i class="fa-solid fa-flag-checkered"></i>';
            }
        }

        // Se for o jogador da vez, checa alertas de voz
        if (isTurn && isAlive) {
            voiceService.checkTimeAlerts(color, slot.remainingMs || 0);
        }
    });

    // Barra de Toque no Rodapé
    const tapFooter = document.getElementById('clockTapFooter');
    const tapText = document.getElementById('tapFooterText');
    const isMyTurn = isRunning && activeTurnKey === myColor;

    if (tapFooter) {
        tapFooter.classList.toggle('my-turn', isMyTurn && !isAborted);
    }
    const clockScreen = document.getElementById('screenClock');
    if (clockScreen) {
        clockScreen.classList.toggle('is-my-turn', isMyTurn && !isAborted && !isPaused);
        clockScreen.classList.toggle('is-waiting-turn', isRunning && !isMyTurn && !isAborted && !isPaused);
    }
    if (tapText) {
        if (isAborted) {
            tapText.innerHTML = '<span style="color:#ef4444; font-weight:800;"><i class="fa-solid fa-ban"></i> Partida cancelada pelo administrador.</span>';
        } else if (isEliminated) {
            tapText.innerHTML = '<span style="color:#94a3b8;"><i class="fa-solid fa-eye"></i> Exército eliminado. Você está assistindo a partida.</span>';
        } else if (isMyTurn) {
            tapText.innerHTML = '<strong>SUA VEZ!</strong> Toque na tela para passar a jogada.';
        } else {
            const activeCfg = ARMY_CONFIG[activeTurnKey];
            tapText.innerText = `Aguardando jogada do exército ${activeCfg ? activeCfg.name : activeTurnKey}...`;
        }
    }

    // Banner e Estado de Pausa (Regras Oficiais: a tela continua visível, mas com cliques desabilitados)
    const pauseOverlay = document.getElementById('overlayPause');
    if (pauseOverlay) pauseOverlay.style.display = 'none';

    const pausedBanner = document.getElementById('pausedBanner');
    const pausedBannerText = document.getElementById('pausedBannerText');
    const quadrantsGrid = document.querySelector('.clock-quadrants-grid');

    if (pausedBanner) {
        pausedBanner.style.display = isPaused ? 'flex' : 'none';
        if (isPaused && pausedBannerText) {
            pausedBannerText.innerText = table.pauseReason ? `⏸ ${table.pauseReason}` : '⏸ PARTIDA PAUSADA PELO ADMINISTRADOR - Aguardando retomada...';
        }
    }
    if (quadrantsGrid) {
        quadrantsGrid.classList.toggle('is-paused', isPaused);
    }
    if (tapFooter) {
        tapFooter.classList.toggle('is-paused', isPaused);
    }

    if (isPaused && !prevTablePaused) {
        voiceService.announcePause(true);
    }
    prevTablePaused = isPaused;

    // Modal de Vitória
    const winnerOverlay = document.getElementById('overlayWinner');
    const winnerText = document.getElementById('winnerText');
    if (isGameOver && table.winner) {
        const winCfg = ARMY_CONFIG[table.winner.toLowerCase()];
        if (winnerText) {
            winnerText.innerText = `O exército ${winCfg ? winCfg.name : table.winner} venceu a partida!`;
        }
        if (winnerOverlay) winnerOverlay.style.display = 'flex';
        voiceService.announceVictory(table.winner.toLowerCase());
    } else {
        if (winnerOverlay) winnerOverlay.style.display = 'none';
    }
}

// ==========================================================================
// TOQUE NA TELA PARA PASSAR A VEZ (TAP TO MOVE)
// ==========================================================================
let lastTapTime = 0;

async function handleClockAreaTap(e) {
    if (!currentTableData || currentTableData.state !== 'RUNNING') return;
    if (currentTableData.isPaused) return;

    // Se o jogador estiver eliminado (modo espectador), ignora toques na tela
    const mySlot = (myColor && currentTableData.players) ? currentTableData.players[myColor] : null;
    if (mySlot && mySlot.alive === false) {
        showGameNotification('Seu exército foi eliminado. Você está assistindo a partida.', 'info', 3000);
        return;
    }

    // Ignora se o clique foi em um botão de controle ou de ação
    if (e && e.target && e.target.closest('button, .btn-quad-flag, .clock-action-btn, .clock-overlay-pause, .clock-overlay-winner, .clock-overlay-aborted')) {
        return;
    }

    const now = Date.now();
    if (now - lastTapTime < 250) return;
    lastTapTime = now;

    let activeColor = (currentTableData.activeTurn || 'white').toLowerCase();
    const targetQuad = (e && e.target) ? e.target.closest('.clock-quadrant') : null;

    let colorToSend = null;
    if (myColor) {
        const myColorKey = myColor.toLowerCase();

        // Se o turno ativo local parecer divergente do jogador atual, faz checagem instantânea no servidor
        // (Previne bloqueio caso a aba tenha ficado em segundo plano e perdido o broadcast WebSocket)
        if (activeColor !== myColorKey) {
            try {
                const checkRes = await fetch(`api/tables/${currentTableId}`);
                if (checkRes.ok) {
                    const freshTable = await checkRes.json();
                    handleTableLiveUpdate(freshTable);
                    activeColor = (freshTable.activeTurn || 'white').toLowerCase();
                }
            } catch (err) {
                console.warn('Erro ao atualizar turno:', err);
            }
        }

        if (activeColor !== myColorKey) {
            const tapText = document.getElementById('tapFooterText');
            if (tapText) {
                const activeCfg = ARMY_CONFIG[activeColor];
                const activeName = activeCfg ? activeCfg.name : activeColor;
                tapText.innerHTML = `<span style="color:#ef4444; font-weight:800;"><i class="fa-solid fa-lock"></i> Não é sua vez! Aguarde a jogada do exército ${activeName}.</span>`;
                setTimeout(() => {
                    if (currentTableData && currentTableData.state === 'RUNNING') {
                        const cur = (currentTableData.activeTurn || 'white').toLowerCase();
                        tapText.innerText = (cur === myColorKey)
                            ? 'SUA VEZ! Toque na tela para passar o lance.'
                            : `Aguardando jogada do exército ${ARMY_CONFIG[cur]?.name || cur}...`;
                    }
                }, 1400);
            }
            return;
        }

        colorToSend = myColorKey;
    } else {
        // Modo relógio compartilhado (mesa física / tablet sem jogadores cadastrados por aba)
        // Permite passar clicando diretamente no quadrante do exército da vez
        if (targetQuad && targetQuad.dataset.color === activeColor) {
            colorToSend = activeColor;
        } else {
            return;
        }
    }

    // Vibração suave no dispositivo (Haptic feedback)
    if (navigator.vibrate) {
        navigator.vibrate(40);
    }

    const clientToken = getTabClientToken();

    try {
        const res = await fetch(`api/tables/${currentTableId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player: colorToSend,
                color: colorToSend,
                clientToken: clientToken
            })
        });

        if (res.ok) {
            // Re-sincroniza o estado da mesa imediatamente
            refreshCurrentTableState();
        } else {
            const err = await res.json();
            console.warn('Resposta da jogada:', err);
            refreshCurrentTableState();
        }
    } catch (err) {
        console.error('Erro ao enviar jogada:', err);
        // Fallback secundário via WebSocket STOMP
        if (stompClient && stompClient.connected) {
            stompClient.send(`/app/table/${currentTableId}/move`, {}, JSON.stringify({
                player: colorToSend,
                color: colorToSend,
                clientToken: clientToken
            }));
        }
    }
}

// ==========================================================================
// AÇÕES DO RELÓGIO (ELIMINAR / PAUSAR / SAIR / VOZ)
// ==========================================================================
async function triggerEliminate(colorKey) {
    if (!currentTableId) return;
    if (myColor && colorKey.toLowerCase() !== myColor.toLowerCase()) {
        showGameNotification("Você só pode baixar a bandeira do seu próprio exército!", "warning");
        return;
    }
    const cfg = ARMY_CONFIG[colorKey.toLowerCase()];
    const name = cfg ? cfg.name : colorKey;

    showConfirmDialog({
        title: 'Baixar Bandeira?',
        message: `Deseja baixar a bandeira e eliminar o exército ${name}? De acordo com as regras, o turno será omitido e a partida pausada para ajuste do tabuleiro físico.`,
        icon: 'fa-flag',
        glowType: 'danger-glow',
        confirmLabel: 'Sim, Baixar Bandeira',
        confirmIcon: 'fa-flag',
        confirmClass: 'btn-modal-danger',
        cancelLabel: 'Continuar Jogando',
        onConfirm: async () => {
            try {
                const clientToken = getTabClientToken();
                await fetch(`api/tables/${currentTableId}/eliminate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        color: colorKey,
                        reason: 'Bandeira Baixada',
                        clientToken: clientToken
                    })
                });
                voiceService.announceElimination(colorKey);
            } catch (e) {
                console.error('Erro ao eliminar exército:', e);
            }
        }
    });
}

async function triggerReinstate(colorKey) {
    if (!currentTableId || !colorKey) return;
    const cfg = ARMY_CONFIG[colorKey.toLowerCase()];
    const name = cfg ? cfg.name : colorKey;

    showConfirmDialog({
        title: 'Reintegrar Exército?',
        message: `Deseja remover a Bandeira Negra e reintegrar o exército ${name} à disputa?`,
        icon: 'fa-flag-checkered',
        glowType: 'success-glow',
        confirmLabel: 'Sim, Reintegrar',
        confirmIcon: 'fa-check',
        confirmClass: 'btn-modal-success',
        cancelLabel: 'Cancelar',
        onConfirm: async () => {
            try {
                if (stompClient && stompClient.connected) {
                    stompClient.send(`/app/table/${currentTableId}/reinstate`, {}, JSON.stringify({
                        color: colorKey
                    }));
                }
                await fetch(`api/tables/${currentTableId}/reinstate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ color: colorKey })
                });
            } catch (e) {
                console.error('Erro ao reintegrar jogador:', e);
            }
        }
    });
}

async function undoLastMove() {
    if (!currentTableId) return;

    const mySlot = (myColor && currentTableData?.players) ? currentTableData.players[myColor] : null;
    if (mySlot && mySlot.alive === false) {
        showGameNotification('Jogadores eliminados não podem solicitar desfazer lances.', 'warning', 4000);
        return;
    }

    showConfirmDialog({
        title: 'Desfazer Último Lance?',
        message: 'Deseja realmente desfazer o último lance? O tempo decorrido será revertido e o relógio retornará a vez ao exército anterior.',
        icon: 'fa-rotate-left',
        glowType: 'warning-glow',
        confirmLabel: 'Sim, Desfazer Lance',
        confirmIcon: 'fa-rotate-left',
        confirmClass: 'btn-modal-warning',
        cancelLabel: 'Manter Lance Atual',
        onConfirm: async () => {
            try {
                if (stompClient && stompClient.connected) {
                    stompClient.send(`/app/table/${currentTableId}/undo`, {}, {});
                }
                await fetch(`api/tables/${currentTableId}/undo`, {
                    method: 'POST'
                });
            } catch (e) {
                console.error('Erro ao desfazer lance:', e);
            }
        }
    });
}

async function togglePauseGame() {
    if (!currentTableId || !currentTableData) return;

    const mySlot = (myColor && currentTableData.players) ? currentTableData.players[myColor] : null;
    if (mySlot && mySlot.alive === false) {
        showGameNotification('Apenas jogadores ativos podem pausar ou retomar a partida.', 'warning', 4000);
        return;
    }

    const isCurrentlyPaused = currentTableData.state === 'PAUSED';
    const nextPaused = !isCurrentlyPaused;
    const clientToken = getTabClientToken();

    try {
        const payload = {
            isPaused: nextPaused,
            paused: nextPaused,
            reason: nextPaused ? 'Partida pausada pelo participante' : 'Partida retomada pelo participante',
            clientToken: clientToken,
            sessionId: clientToken
        };

        const res = await fetch(`api/tables/${currentTableId}/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (stompClient && stompClient.connected) {
            stompClient.send(`/app/table/${currentTableId}/pause`, {}, JSON.stringify(payload));
        }

        if (res.ok) {
            if (!nextPaused) {
                const pauseOverlay = document.getElementById('overlayPause');
                if (pauseOverlay) pauseOverlay.style.display = 'none';
            }
            voiceService.announcePause(nextPaused);
        } else {
            console.warn('Servidor recusou alteração de pausa.');
        }
    } catch (e) {
        console.error('Erro ao pausar/retomar:', e);
    }
}

function toggleVoice() {
    const isEnabled = voiceService.toggle();
    const icon = document.getElementById('voiceIcon');
    if (icon) {
        icon.className = isEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    }
}

function exitGame() {
    leaveCurrentTable();
}

// ==========================================================================
// MODAL DE CONFIRMAÇÃO GENÉRICO REUTILIZÁVEL (DESIGN SYSTEM)
// ==========================================================================
let currentConfirmDialogCallback = null;

function showConfirmDialog({
    title,
    message,
    icon = 'fa-circle-question',
    glowType = 'warning-glow',
    confirmLabel = 'Confirmar',
    confirmIcon = 'fa-check',
    confirmClass = 'btn-modal-warning',
    cancelLabel = 'Cancelar',
    onConfirm
}) {
    currentConfirmDialogCallback = onConfirm;

    const modal = document.getElementById('modalConfirmDialog');
    const titleEl = document.getElementById('confirmDialogTitle');
    const msgEl = document.getElementById('confirmDialogMessage');
    const iconWrapper = document.getElementById('confirmDialogIconWrapper');
    const iconEl = document.getElementById('confirmDialogIcon');
    const btnConfirm = document.getElementById('confirmDialogBtnConfirm');
    const btnIcon = document.getElementById('confirmDialogBtnIcon');
    const btnLabel = document.getElementById('confirmDialogBtnLabel');
    const cancelLabelEl = document.getElementById('confirmDialogCancelLabel');

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (iconWrapper) iconWrapper.className = `modal-icon-wrapper ${glowType}`;
    if (iconEl) iconEl.className = `fa-solid ${icon} modal-icon-symbol`;
    if (btnConfirm) btnConfirm.className = confirmClass;
    if (btnIcon) btnIcon.className = `fa-solid ${confirmIcon}`;
    if (btnLabel) btnLabel.innerText = confirmLabel;
    if (cancelLabelEl) cancelLabelEl.innerText = cancelLabel;

    if (modal) modal.style.display = 'flex';
}

function closeConfirmDialog() {
    const modal = document.getElementById('modalConfirmDialog');
    if (modal) modal.style.display = 'none';
    currentConfirmDialogCallback = null;
}

function handleConfirmDialogAccept() {
    const cb = currentConfirmDialogCallback;
    closeConfirmDialog();
    if (typeof cb === 'function') {
        cb();
    }
}

// ==========================================================================
// NOTIFICAÇÕES TOAST GLOBAIS
// ==========================================================================
function showGameNotification(message, type = 'info', durationMs = 5000) {
    const container = document.getElementById('gameToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `game-toast ${type}`;

    let iconClass = 'fa-circle-info';
    if (type === 'danger') iconClass = 'fa-triangle-exclamation';
    else if (type === 'warning') iconClass = 'fa-flag';

    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.3s forwards';
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, durationMs);
}

// Utilitários de escape e formatação
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatState(state) {
    if (window.i18n) {
        switch (state) {
            case 'LOBBY': return window.i18n.t('tables.status_lobby');
            case 'RUNNING': return window.i18n.t('tables.status_running');
            case 'PAUSED': return window.i18n.t('tables.status_paused');
            case 'GAME_OVER': return window.i18n.t('tables.status_game_over');
            case 'ABORTED': return window.i18n.t('clock.aborted_title');
            default: return state;
        }
    }
    switch (state) {
        case 'LOBBY': return 'Sala de Espera';
        case 'RUNNING': return 'Em Jogo';
        case 'PAUSED': return 'Pausada';
        case 'GAME_OVER': return 'Finalizada';
        case 'ABORTED': return 'Cancelada';
        default: return state;
    }
}

// Trata abandono imediato caso o jogador feche a aba ou saia da página durante a partida
window.addEventListener('beforeunload', () => {
    if (currentTableId && myColor && currentTableData &&
        (currentTableData.state === 'RUNNING' || currentTableData.state === 'PAUSED')) {
        const clientToken = getTabClientToken();
        const payload = JSON.stringify({
            player: myColor,
            color: myColor,
            clientToken: clientToken,
            reason: 'Bandeira Baixada / Abandono'
        });
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(`api/tables/${currentTableId}/leave`, blob);
        }
    }
});


// ==========================================================================
// CONTAGEM REGRESSIVA OFICIAL (5 SEGUNDOS) - INÍCIO E RETOMADA
// ==========================================================================
let countdownInterval = null;

function startVisualCountdown(data) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    const action = data ? data.action : 'START';
    const isStart = action === 'START';
    const langCfg = voiceService.getLangConfig();

    const titleText = isStart 
        ? (window.i18n ? window.i18n.t('clock.countdown_start') : langCfg.start)
        : (window.i18n ? window.i18n.t('clock.countdown_resume') : langCfg.resume);

    // Se estiver iniciando a partir do lobby, entra no relógio imediatamente
    if (isStart) {
        if (currentTableData) {
            enterGameClock(currentTableData);
        } else if (currentTableId) {
            enterGameClock({ id: currentTableId });
        }
    }

    // Regra oficial: Fala "iniciando jogo" ou "retomando o jogo"
    if (voiceService.isInclusive()) {
        voiceService.speak(titleText, true);
    }

    const overlay = document.getElementById('overlayCountdown');
    const titleEl = document.getElementById('countdownActionTitle');
    const digitsEl = document.getElementById('countdownDigits');
    const subEl = document.getElementById('countdownSub');

    if (titleEl) titleEl.textContent = titleText.toUpperCase();
    if (subEl) subEl.textContent = isStart
        ? (window.i18n ? window.i18n.t('clock.get_ready') : 'Preparem-se!')
        : (window.i18n ? window.i18n.t('clock.resuming') : 'Retomando...');

    let count = 5;
    if (digitsEl) digitsEl.textContent = count;
    if (overlay) overlay.style.display = 'flex';

    // 1º segundo (count 5): primeiro bipe (600 Hz, 0.15s)
    beeper.playBeep(600, 0.15);

    countdownInterval = setInterval(() => {
        count--;
        if (count > 1) {
            if (digitsEl) digitsEl.textContent = count;
            // 2º, 3º e 4º segundo: bipe curto (600 Hz, 0.15s)
            beeper.playBeep(600, 0.15);
        } else if (count === 1) {
            if (digitsEl) digitsEl.textContent = count;
            // 5º segundo: bipe um pouco mais longo (800 Hz, 0.5s)
            beeper.playBeep(800, 0.5);
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            if (overlay) overlay.style.display = 'none';
        }
    }, 1000);
}


// Atualiza a interface quando o idioma muda
window.addEventListener('quatime:languageChanged', () => {
    if (window.i18n) window.i18n.apply();
    if (typeof cachedTablesList !== 'undefined' && cachedTablesList && cachedTablesList.length >= 0) {
        renderTablesList(cachedTablesList);
    }
    if (currentTableData) {
        setupColorSelectUI(currentTableData);
        updateLobbyUI(currentTableData);
        updateClockUI(currentTableData);
    }
});
