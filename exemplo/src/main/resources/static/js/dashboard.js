// Quaternity Server Dashboard Controller
let stompClient = null;
let currentObservedTableId = null;
let currentObservedSubscription = null;
let activeFilter = 'ALL';
let allTablesCache = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    fetchTables();
});

// Atualiza a interface quando o idioma muda
window.addEventListener('quatime:languageChanged', () => {
    if (window.i18n) window.i18n.apply();
    updateMetrics(allTablesCache);
    renderTables(allTablesCache);
    if (currentObservedTableId) {
        const current = allTablesCache.find(t => t.id === currentObservedTableId);
        if (current) {
            updateObserverModal(current);
        }
    }
});

// Conexão WebSocket STOMP
function connectWebSocket() {
    const badge = document.getElementById('wsStatusBadge');
    const text = document.getElementById('wsStatusText');

    try {
        const socket = new SockJS('ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null; // Silencia logs verbosos

        stompClient.connect({}, (frame) => {
            if (badge) badge.style.color = '#10b981';
            if (text) text.innerText = window.i18n ? window.i18n.t('nav.server_online') : 'Servidor Online';

            // Assina atualizações da lista de mesas
            stompClient.subscribe('/topic/tables', (msg) => {
                const tables = JSON.parse(msg.body);
                handleTablesUpdate(tables);
            });
        }, (error) => {
            console.warn('Conexão perdida, tentando reconectar em 3s...', error);
            if (badge) badge.style.color = '#eab308';
            if (text) text.innerText = window.i18n ? window.i18n.t('nav.server_connecting') : 'Reconectando...';
            setTimeout(connectWebSocket, 3000);
        });
    } catch (e) {
        console.error('Falha ao iniciar SockJS:', e);
    }
}

// Busca inicial das mesas
async function fetchTables() {
    try {
        const res = await fetch('api/tables');
        if (res.ok) {
            const tables = await res.json();
            handleTablesUpdate(tables);
        }
    } catch (e) {
        console.warn('Erro ao buscar mesas:', e);
    }
}

// Atualização reativa da lista de mesas
function handleTablesUpdate(tables) {
    allTablesCache = tables || [];
    updateMetrics(allTablesCache);
    renderTables(allTablesCache);

    // Se estiver com o modal do observador aberto, atualiza os dados em tempo real
    if (currentObservedTableId) {
        const current = allTablesCache.find(t => t.id === currentObservedTableId);
        if (current) {
            updateObserverModal(current);
        }
    }
}

// Atualização das métricas superiores
function updateMetrics(tables) {
    const total = tables.length;
    const running = tables.filter(t => t.state === 'RUNNING').length;
    const paused = tables.filter(t => t.state === 'PAUSED').length;
    const players = tables.reduce((acc, t) => acc + (t.connectedCount !== undefined ? t.connectedCount : (t.readyCount || 0)), 0);

    const elTotal = document.getElementById('statTotalTables');
    const elRun = document.getElementById('statRunning');
    const elPause = document.getElementById('statPaused');
    const elPlayers = document.getElementById('statPlayers');
    const elBadge = document.getElementById('tableCountBadge');

    if (elTotal) elTotal.innerText = total;
    if (elRun) elRun.innerText = running;
    if (elPause) elPause.innerText = paused;
    if (elPlayers) elPlayers.innerText = players;
    if (elBadge) elBadge.innerText = window.i18n ? window.i18n.t('tables.count_badge', total) : total + ' Mesa(s)';
}

// Renderização dos cards de mesa
function renderTables(tables) {
    const container = document.getElementById('tablesContainer');
    if (!container) return;

    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

    const filtered = tables.filter(t => {
        const matchesFilter = activeFilter === 'ALL' || t.state === activeFilter;
        const matchesSearch = !searchTerm || t.name.toLowerCase().includes(searchTerm) || t.id.toLowerCase().includes(searchTerm);
        return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
        const emptyMsg = window.i18n ? window.i18n.t('dashboard.empty_title') : 'Nenhuma mesa encontrada com os filtros selecionados.';
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: #111827; border-radius: 16px; border: 1px dashed #1f293d;">
                <i class="fa-solid fa-chess-board" style="font-size: 38px; color: #64748b; margin-bottom: 12px;"></i>
                <p style="color: #94a3b8; font-size: 15px; font-weight: 600;">${emptyMsg}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(t => {
        const isRunning = t.state === 'RUNNING';
        const isPaused = t.state === 'PAUSED';
        const isLobby = t.state === 'LOBBY';
        const gameTypeLabel = t.gameType === 'CONVENTIONAL' 
            ? (window.i18n ? window.i18n.t('dashboard.beeps') : 'Bipes')
            : (window.i18n ? window.i18n.t('dashboard.inclusive') : 'Inclusivo');
        const playersWord = window.i18n ? window.i18n.t('dashboard.players') : 'Jogadores';
        const readyWord = window.i18n ? window.i18n.t('dashboard.ready_suffix') : 'prontos';
        const moveText = window.i18n ? window.i18n.t('clock.move', t.moveCount || 0) : `Lance #${t.moveCount || 0}`;

        return `
            <div class="table-card" data-id="${t.id}" data-state="${t.state}">
                <div class="table-card-header">
                    <div>
                        <h3 class="table-name">${escapeHtml(t.name)}</h3>
                    </div>
                    <div class="header-status-group">
                        <span class="badge-state state-${t.state.toLowerCase()}">${formatState(t.state)}</span>
                        <button class="btn-card-delete" title="${window.i18n ? window.i18n.t('dashboard.btn_delete') : 'Excluir mesa'}" onclick="deleteTable('${t.id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="table-meta">
                    <div class="meta-row">
                        <span><i class="fa-regular fa-clock"></i> <strong>${t.baseMinutes} min + ${t.incrementSeconds}s</strong></span>
                        <span><i class="fa-solid fa-volume-high"></i> <strong>${gameTypeLabel}</strong></span>
                    </div>
                    <div class="meta-row">
                        <span><i class="fa-solid fa-user-group"></i> <strong>${t.connectedCount !== undefined ? t.connectedCount : t.readyCount}/4</strong> ${playersWord} ${t.state === 'LOBBY' ? `(${t.readyCount || 0} ${readyWord})` : ''}</span>
                        <span><i class="fa-solid fa-arrows-rotate"></i> <strong>${moveText}</strong></span>
                    </div>
                </div>

                <div class="armies-list">
                    ${renderArmySlot(t, 'white', formatColorName('white'), 'bullet-white')}
                    ${renderArmySlot(t, 'red', formatColorName('red'), 'bullet-red')}
                    ${renderArmySlot(t, 'black', formatColorName('black'), 'bullet-black')}
                    ${renderArmySlot(t, 'green', formatColorName('green'), 'bullet-green')}
                </div>

                <div class="table-card-actions">
                    <button class="btn btn-secondary btn-sm" onclick="openLiveObserver('${t.id}')">
                        <i class="fa-solid fa-eye"></i> ${window.i18n ? window.i18n.t('dashboard.btn_observe') : 'Observar'}
                    </button>

                    ${(t.state === 'LOBBY') ? `
                        <button class="btn btn-primary btn-sm" onclick="startTableAdmin('${t.id}')" ${((t.connectedCount === 4 || t.readyCount === 4) && t.readyCount === 4) ? '' : `disabled title="${window.i18n ? window.i18n.t('dashboard.waiting_ready_hint') : 'Aguardando 4 jogadores prontos'}"`}>
                            <i class="fa-solid fa-play"></i> ${window.i18n ? window.i18n.t('dashboard.btn_start') : 'Iniciar'}
                        </button>
                    ` : ''}

                    ${isRunning ? `
                        <button class="btn btn-warning btn-sm" onclick="togglePauseTable('${t.id}', true)">
                            <i class="fa-solid fa-pause"></i> ${window.i18n ? window.i18n.t('dashboard.btn_pause') : 'Pausar'}
                        </button>
                    ` : ''}

                    ${isPaused ? `
                        <button class="btn btn-success btn-sm" onclick="togglePauseTable('${t.id}', false)">
                            <i class="fa-solid fa-play"></i> ${window.i18n ? window.i18n.t('dashboard.btn_resume') : 'Retomar'}
                        </button>
                        ${(t.moveCount > 0) ? `
                            <button class="btn btn-secondary btn-sm" title="${window.i18n ? window.i18n.t('dashboard.undo_title') : 'Desfazer último lance'}" onclick="undoTableMove('${t.id}')">
                                <i class="fa-solid fa-rotate-left"></i> ${window.i18n ? window.i18n.t('dashboard.undo') : 'Desfazer'}
                            </button>
                        ` : ''}
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderArmySlot(table, colorKey, displayName, bulletClass) {
    const slot = table.players[colorKey] || {};
    const isAlive = slot.alive !== false;
    const isTurn = table.state === 'RUNNING' && table.activeTurn && table.activeTurn.toLowerCase() === colorKey;
    const formatted = slot.formattedTime || '00:00';
    const isConnected = slot.connected || (slot.playerName && slot.playerName !== 'Aguardando...') || slot.ready;
    let playerName = window.i18n ? window.i18n.t('dashboard.free') : 'Livre';
    if (isConnected) {
        playerName = escapeHtml(slot.playerName || (window.i18n ? window.i18n.t('dashboard.connected') : 'Conectado'));
        if (table.state === 'LOBBY') {
            playerName += slot.ready 
                ? (' (' + (window.i18n ? window.i18n.t('dashboard.ready') : 'Pronto ✓') + ')')
                : (' (' + (window.i18n ? window.i18n.t('dashboard.waiting') : 'Aguardando') + ')');
        }
    }

    let classes = 'army-slot';
    if (!isAlive) classes += ' slot-eliminated';
    if (isTurn && isAlive) classes += ' turn-active';

    return `
        <div class="${classes}">
            <div class="army-bullet ${bulletClass}"></div>
            <div class="army-info">
                <span class="army-name">${displayName}</span>
                <span class="army-player">${playerName}</span>
            </div>
            <span class="army-clock">${formatted}</span>
        </div>
    `;
}

// Filtros
function setFilter(filter, btn) {
    activeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTables(allTablesCache);
}

function filterTables() {
    renderTables(allTablesCache);
}

// Modais
function openCreateModal() {
    document.getElementById('createModal').classList.add('active');
    document.getElementById('tableNameInput').focus();
}

function closeCreateModal() {
    document.getElementById('createModal').classList.remove('active');
}

function closeModalOnBackdrop(event, modalId) {
    if (event.target.id === modalId) {
        document.getElementById(modalId).classList.remove('active');
        if (modalId === 'observerModal') {
            closeObserverModal();
        }
    }
}

// Ações REST
async function submitCreateTable(event) {
    event.preventDefault();
    const name = document.getElementById('tableNameInput').value;
    const baseMinutes = parseInt(document.getElementById('baseMinutesInput').value, 10);
    const incrementSeconds = parseInt(document.getElementById('incrementSecInput').value, 10);
    const gameType = (document.getElementById('tableGameTypeInput') ? document.getElementById('tableGameTypeInput').value : 'INCLUSIVE');

    try {
        const res = await fetch('api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                baseMinutes,
                incrementSeconds,
                language: (window.i18n ? window.i18n.currentLang : 'pt'),
                gameType
            })
        });
        if (res.ok) {
            closeCreateModal();
            document.getElementById('tableNameInput').value = '';
            fetchTables();
            showNotification(`Mesa "${name}" criada com sucesso!`, 'info');
        } else {
            showNotification('Erro ao criar mesa.', 'danger');
        }
    } catch (e) {
        showNotification('Falha na comunicação com o servidor.', 'danger');
    }
}

async function togglePauseTable(tableId, shouldPause) {
    try {
        await fetch(`api/tables/${tableId}/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPaused: shouldPause, reason: 'Pausa acionada pelo Painel de Gestão' })
        });
        showNotification(shouldPause ? 'Partida pausada.' : 'Partida retomada.', 'info');
    } catch (e) {
        showNotification('Erro ao pausar/retomar partida.', 'danger');
    }
}

function abortTable(tableId) {
    const table = allTablesCache.find(t => t.id === tableId);
    const tableName = table ? table.name : tableId;
    openConfirmDialog({
        title: 'Cancelar Partida?',
        message: `Deseja realmente interromper e cancelar a partida na mesa "${tableName}"? A mesa ficará no estado cancelada e todos os participantes serão notificados.`,
        icon: 'fa-ban',
        glowType: 'danger-glow',
        confirmLabel: 'Sim, Cancelar Partida',
        confirmIcon: 'fa-ban',
        confirmClass: 'btn-confirm-danger',
        cancelLabel: 'Voltar',
        onConfirm: async () => {
            try {
                await fetch(`api/tables/${tableId}/abort`, { method: 'POST' });
                showNotification(`Partida da mesa "${tableName}" cancelada.`, 'warning');
            } catch (e) {
                showNotification('Erro ao cancelar partida.', 'danger');
            }
        }
    });
}

function deleteTable(tableId) {
    const table = allTablesCache.find(t => t.id === tableId);
    const tableName = table ? table.name : tableId;
    openConfirmDialog({
        title: 'Excluir Mesa?',
        message: `Deseja realmente excluir a mesa "${tableName}"? Esta ação removerá a mesa do servidor e desconectará todos os jogadores ativos.`,
        icon: 'fa-trash',
        glowType: 'danger-glow',
        confirmLabel: 'Sim, Excluir',
        confirmIcon: 'fa-trash',
        confirmClass: 'btn-confirm-danger',
        cancelLabel: 'Cancelar',
        onConfirm: async () => {
            try {
                const res = await fetch(`api/tables/${tableId}`, { method: 'DELETE' });
                if (res.ok) {
                    showNotification(`Mesa "${tableName}" excluída com sucesso.`, 'info');
                    fetchTables();
                } else {
                    showNotification('Erro ao excluir mesa.', 'danger');
                }
            } catch (e) {
                showNotification('Falha de conexão ao excluir mesa.', 'danger');
            }
        }
    });
}

// Modal do Observador
function openLiveObserver(tableId) {
    const table = allTablesCache.find(t => t.id === tableId);
    if (!table) return;

    currentObservedTableId = tableId;
    document.getElementById('observerModal').classList.add('active');
    updateObserverModal(table);

    // Assina o tópico individual de alta frequência da mesa
    if (stompClient && stompClient.connected) {
        if (currentObservedSubscription) {
            currentObservedSubscription.unsubscribe();
        }
        currentObservedSubscription = stompClient.subscribe(`/topic/table/${tableId}`, (msg) => {
            const updated = JSON.parse(msg.body);
            updateObserverModal(updated);
        });
    }
}

function closeObserverModal() {
    currentObservedTableId = null;
    if (currentObservedSubscription) {
        currentObservedSubscription.unsubscribe();
        currentObservedSubscription = null;
    }
    document.getElementById('observerModal').classList.remove('active');
}

function updateObserverModal(table) {
    document.getElementById('observerTableName').innerText = table.name;
    document.getElementById('observerTableId').innerText = 'ID: ' + table.id + ' • ' + table.baseMinutes + 'm+' + table.incrementSeconds + 's';

    const badge = document.getElementById('observerStateBadge');
    badge.className = 'badge-state state-' + table.state.toLowerCase();
    badge.innerText = formatState(table.state);

    const activeTurn = (table.activeTurn || 'WHITE').toLowerCase();
    document.getElementById('observerCurrentTurn').innerText = formatColorName(activeTurn);

    // Atualiza quadrantes
    updateObserverQuadrant('White', table.players['white'], activeTurn === 'white', table.state);
    updateObserverQuadrant('Red', table.players['red'], activeTurn === 'red', table.state);
    updateObserverQuadrant('Black', table.players['black'], activeTurn === 'black', table.state);
    updateObserverQuadrant('Green', table.players['green'], activeTurn === 'green', table.state);

    // Botão de iniciar do observador
    const startBtn = document.getElementById('observerStartBtn');
    if (startBtn) {
        if (table.state === 'LOBBY') {
            const canStart = (table.connectedCount === 4 && table.readyCount === 4);
            startBtn.style.display = 'inline-flex';
            startBtn.disabled = !canStart;
            startBtn.title = canStart ? (window.i18n ? window.i18n.t('observer.start') : 'Iniciar Partida') : (window.i18n ? window.i18n.t('dashboard.waiting_ready_hint') : 'Aguardando os 4 jogadores confirmarem que estão prontos');
        } else {
            startBtn.style.display = 'none';
        }
    }

    // Botão de pausa do observador
    const pauseBtn = document.getElementById('observerPauseBtn');
    if (table.state === 'RUNNING') {
        pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> ' + (window.i18n ? window.i18n.t('observer.pause') : 'Pausar');
        pauseBtn.className = 'btn btn-warning';
        pauseBtn.style.display = 'inline-flex';
    } else if (table.state === 'PAUSED') {
        pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> ' + (window.i18n ? window.i18n.t('observer.resume') : 'Retomar');
        pauseBtn.className = 'btn btn-success';
        pauseBtn.style.display = 'inline-flex';
    } else {
        pauseBtn.style.display = 'none';
    }

    // Botão de cancelar partida do observador (só faz sentido quando a partida está em andamento ou pausada)
    const abortBtn = document.getElementById('observerAbortBtn');
    if (abortBtn) {
        if (table.state === 'RUNNING' || table.state === 'PAUSED') {
            abortBtn.style.display = 'inline-flex';
        } else {
            abortBtn.style.display = 'none';
        }
    }
}

function updateObserverQuadrant(colorTitle, slot, isTurn, gameState) {
    slot = slot || {};
    const quad = document.getElementById('quad' + colorTitle);
    const timeEl = document.getElementById('time' + colorTitle);
    const playerEl = document.getElementById('player' + colorTitle);
    const isAlive = slot.alive !== false;

    if (!quad || !timeEl || !playerEl) return;

    timeEl.innerText = slot.formattedTime || '00:00';
    playerEl.innerText = (slot.connected || slot.ready) ? (slot.playerName || (window.i18n ? window.i18n.t('observer.player_prefix') : 'Jogador')) : (window.i18n ? window.i18n.t('dashboard.free') : 'Livre');

    quad.classList.toggle('turn-active', isTurn && isAlive && gameState === 'RUNNING');
    quad.classList.toggle('eliminated', !isAlive);
}

function toggleObserverPause() {
    if (!currentObservedTableId) return;
    const table = allTablesCache.find(t => t.id === currentObservedTableId);
    if (!table) return;
    togglePauseTable(currentObservedTableId, table.state === 'RUNNING');
}

function eliminateArmy(color) {
    if (!currentObservedTableId) return;
    const colorName = formatColorName(color);
    openConfirmDialog({
        title: `Baixar Bandeira (${colorName})?`,
        message: `Confirmar a baixa de bandeira e eliminação do exército ${colorName}? A partida será pausada para o ajuste do tabuleiro físico.`,
        icon: 'fa-flag',
        glowType: 'danger-glow',
        confirmLabel: 'Sim, Baixar Bandeira',
        confirmIcon: 'fa-flag',
        confirmClass: 'btn-confirm-danger',
        cancelLabel: 'Voltar',
        onConfirm: async () => {
            try {
                await fetch(`api/tables/${currentObservedTableId}/eliminate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ color: color, reason: 'Árbitro / Baixa de Bandeira' })
                });
                showNotification(`Exército ${colorName} eliminado.`, 'warning');
            } catch (e) {
                showNotification('Erro ao eliminar exército.', 'danger');
            }
        }
    });
}

function abortCurrentObservedTable() {
    if (!currentObservedTableId) return;
    abortTable(currentObservedTableId);
}

function undoTableMove(tableId) {
    openConfirmDialog({
        title: 'Desfazer Lance?',
        message: 'Deseja realmente desfazer o último lance desta mesa e restaurar o turno anterior? De acordo com as regras, o tempo do relógio será recalculado.',
        icon: 'fa-rotate-left',
        glowType: 'warning-glow',
        confirmLabel: 'Sim, Desfazer Lance',
        confirmIcon: 'fa-rotate-left',
        confirmClass: 'btn-confirm-warning',
        cancelLabel: 'Voltar',
        onConfirm: async () => {
            try {
                const res = await fetch(`api/tables/${tableId}/undo`, { method: 'POST' });
                if (res.ok) {
                    showNotification('Último lance desfeito com sucesso.', 'info');
                } else {
                    showNotification('Não foi possível desfazer o lance.', 'danger');
                }
            } catch (e) {
                showNotification('Erro ao desfazer lance.', 'danger');
            }
        }
    });
}

function reinstatePlayerInTable(tableId, color) {
    const colorName = formatColorName(color);
    openConfirmDialog({
        title: `Reintegrar ${colorName}?`,
        message: `Deseja remover a Bandeira Baixada e reintegrar o exército ${colorName} à disputa nesta mesa?`,
        icon: 'fa-rotate-left',
        glowType: 'success-glow',
        confirmLabel: 'Sim, Reintegrar Exército',
        confirmIcon: 'fa-rotate-left',
        confirmClass: 'btn-confirm-warning',
        cancelLabel: 'Voltar',
        onConfirm: async () => {
            try {
                await fetch(`api/tables/${tableId}/reinstate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ color: color })
                });
                showNotification(`Exército ${colorName} reintegrado.`, 'info');
            } catch (e) {
                showNotification('Erro ao reintegrar jogador.', 'danger');
            }
        }
    });
}

// Helpers de formatação
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

function formatColorName(color) {
    if (window.i18n) {
        return window.i18n.getColorName(color);
    }
    switch (color) {
        case 'white': return 'Branco';
        case 'red': return 'Vermelho';
        case 'black': return 'Preto';
        case 'green': return 'Verde';
        default: return color;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

// ==========================================================================
// MODAL DE CONFIRMAÇÃO DO SISTEMA (DESIGN SYSTEM)
// ==========================================================================
let currentConfirmDialogCallback = null;

function openConfirmDialog({
    title = 'Confirmar Ação',
    message = 'Deseja realmente prosseguir?',
    icon = 'fa-triangle-exclamation',
    glowType = 'warning-glow',
    confirmLabel = 'Confirmar',
    confirmIcon = 'fa-check',
    confirmClass = 'btn-confirm-danger',
    cancelLabel = 'Cancelar',
    onConfirm = null
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
    if (iconWrapper) iconWrapper.className = `confirm-icon-wrapper ${glowType}`;
    if (iconEl) iconEl.className = `fa-solid ${icon} confirm-icon-symbol`;
    if (btnConfirm) btnConfirm.className = `btn-confirm-action ${confirmClass}`;
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
// NOTIFICAÇÕES TOAST (DASHBOARD)
// ==========================================================================
function showNotification(message, type = 'info', durationMs = 4500) {
    const container = document.getElementById('dashboardToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    let iconClass = 'fa-circle-info';
    if (type === 'danger') iconClass = 'fa-triangle-exclamation';
    else if (type === 'warning') iconClass = 'fa-circle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, durationMs);
}

async function startTableAdmin(tableId) {
    try {
        const res = await fetch(`api/tables/${tableId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (res.ok) {
            showNotification('Iniciando partida com contagem de 5 segundos...', 'success');
        } else {
            showNotification(data.message || 'Não foi possível iniciar a partida.', 'danger');
        }
    } catch (e) {
        showNotification('Erro ao conectar ao servidor para iniciar partida.', 'danger');
    }
}

function startCurrentObservedTable() {
    if (currentObservedTableId) {
        startTableAdmin(currentObservedTableId);
    }
}
