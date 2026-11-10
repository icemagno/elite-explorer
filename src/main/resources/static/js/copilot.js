let lastKnownSystem = null;
let currentTrades = [];
let playerState = null;
let isFirstStatusLoad = true;

document.addEventListener('DOMContentLoaded', () => {
    // Start polling player status immediately
    pollPlayerStatus();
    setInterval(pollPlayerStatus, 2000);

    // Event listeners
    document.getElementById('btnRefreshTrades').addEventListener('click', () => {
        if (playerState && playerState.currentSystem) {
            fetchOutboundTrades(playerState.currentSystem, playerState.cargoCapacity);
        }
    });

    document.getElementById('filterInput').addEventListener('input', () => {
        renderTrades();
    });

    document.getElementById('sortSelect').addEventListener('change', () => {
        renderTrades();
    });

    document.getElementById('btnCopyCurrentSystem').addEventListener('click', () => {
        if (playerState && playerState.currentSystem) {
            copyToClipboard(playerState.currentSystem);
        }
    });

    document.getElementById('btnSimulate').addEventListener('click', () => {
        simulateJumpDialog();
    });
});

async function pollPlayerStatus() {
    try {
        const resp = await fetch('/api/player/status');
        if (!resp.ok) return;

        const status = await resp.json();
        playerState = status;

        updatePlayerHud(status);

        // Check if system changed
        if (status.currentSystem && status.currentSystem !== lastKnownSystem) {
            const previous = lastKnownSystem;
            lastKnownSystem = status.currentSystem;

            if (!isFirstStatusLoad && previous !== null) {
                // System changed!
                showJumpAlert(status.currentSystem);
                const autoRefresh = document.getElementById('chkAutoRefresh').checked;
                if (autoRefresh) {
                    fetchOutboundTrades(status.currentSystem, status.cargoCapacity);
                }
            } else if (isFirstStatusLoad) {
                isFirstStatusLoad = false;
                // Initial load
                fetchOutboundTrades(status.currentSystem, status.cargoCapacity);
            }
        }
    } catch (err) {
        console.warn('Erro ao consultar status do jogador:', err);
    }
}

function updatePlayerHud(status) {
    const dot = document.getElementById('journalDot');
    const statusText = document.getElementById('journalStatusText');

    if (status.journalFound) {
        dot.className = 'status-dot pulsing';
        statusText.textContent = `Journal Ativo: ${status.commander || 'CMDR'}`;
    } else {
        dot.className = 'status-dot';
        dot.style.backgroundColor = '#f85149';
        statusText.textContent = 'Aguardando Arquivo Journal...';
    }

    document.getElementById('cmdrName').textContent = status.commander ? `CMDR ${status.commander}` : 'Desconhecido';
    document.getElementById('journalFileName').textContent = status.journalFile ? `Log: ${status.journalFile}` : 'Sem log';

    document.getElementById('currentSystem').textContent = status.currentSystem || '-';
    
    let stationDesc = 'No Espaço / Supercruise';
    if (status.docked && status.currentStation) {
        stationDesc = `Docked: ${status.currentStation}`;
    } else if (status.currentStation) {
        stationDesc = status.currentStation;
    }
    document.getElementById('currentStation').textContent = stationDesc;

    document.getElementById('shipInfo').textContent = status.shipType || 'Nave';
    document.getElementById('cargoCapacityText').textContent = `Capacidade de carga: ${status.cargoCapacity || 36} T`;

    let flight = status.docked ? 'Pousado em Estação' : 'Voando no Sistema';
    document.getElementById('flightStatus').textContent = flight;
    document.getElementById('lastEventTime').textContent = status.lastEvent ? `Evento: ${status.lastEvent}` : '-';
}

function showJumpAlert(newSystem) {
    const alertBox = document.getElementById('jumpAlert');
    document.getElementById('jumpAlertSystem').textContent = newSystem;
    alertBox.style.display = 'block';

    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 6000);
}

async function fetchOutboundTrades(system, cargo) {
    const btn = document.getElementById('btnRefreshTrades');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('btnSpinner');
    const errorBox = document.getElementById('errorBox');

    const maxDist = document.getElementById('inputMaxDist').value || '80';
    const padSize = document.getElementById('selectPadSize').value || '1';
    const sortBy = document.getElementById('sortSelect').value || 'profit';

    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.textContent = 'Buscando...';
    errorBox.style.display = 'none';

    try {
        const query = new URLSearchParams({
            system: system || 'Col 285 Sector EG-D a42-1',
            cargoCapacity: cargo || 36,
            maxDistance: maxDist,
            padSize: padSize,
            sortBy: sortBy
        });

        const resp = await fetch(`/api/copilot/trades?${query.toString()}`);
        if (!resp.ok) {
            throw new Error(`Erro na API HTTP ${resp.status}`);
        }

        const data = await resp.json();

        if (!data.success) {
            throw new Error(data.errorMessage || 'Falha ao obter cotações de ida.');
        }

        currentTrades = data.trades || [];
        document.getElementById('badgeCount').textContent = currentTrades.length;
        document.getElementById('inaraLink').href = data.inaraUrl || '#';
        document.getElementById('lastFetchedAt').textContent = data.fetchedAt || '-';

        renderTrades();
    } catch (err) {
        console.error('Erro ao buscar cotações do copilot:', err);
        errorBox.textContent = `Falha ao consultar cotações: ${err.message}`;
        errorBox.style.display = 'block';
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = 'Atualizar Cotações';
    }
}

function getSortedAndFilteredTrades() {
    const filterTerm = document.getElementById('filterInput').value.trim().toLowerCase();
    const sortBy = document.getElementById('sortSelect').value;

    let list = [...currentTrades];

    if (filterTerm) {
        list = list.filter(t => {
            const str = [
                t.commodity,
                t.originStation,
                t.originSystem,
                t.destStation,
                t.destSystem
            ].filter(Boolean).join(' ').toLowerCase();

            return str.includes(filterTerm);
        });
    }

    list.sort((a, b) => {
        switch (sortBy) {
            case 'profit':
                if (b.profitPerUnit !== a.profitPerUnit) {
                    return b.profitPerUnit - a.profitPerUnit;
                }
                return (a.routeDistanceNumeric || 0) - (b.routeDistanceNumeric || 0);
            case 'distance':
                if (a.routeDistanceNumeric !== b.routeDistanceNumeric) {
                    return (a.routeDistanceNumeric || 0) - (b.routeDistanceNumeric || 0);
                }
                return b.profitPerUnit - a.profitPerUnit;
            case 'station_dist':
                return parseLs(a.destDistance) - parseLs(b.destDistance);
            default:
                return 0;
        }
    });

    return list;
}

function parseLs(txt) {
    if (!txt) return 9999999;
    const clean = txt.replace(/[^0-9]/g, '');
    return clean ? parseInt(clean, 10) : 9999999;
}

function renderTrades() {
    const container = document.getElementById('tradesContainer');
    const trades = getSortedAndFilteredTrades();

    if (trades.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>Nenhuma oportunidade de venda de ida encontrada</h3>
                <p>Verifique os filtros ou tente aumentar a distância máxima de busca (Ly).</p>
            </div>
        `;
        return;
    }

    let html = '';
    trades.forEach(trade => {
        html += createTradeCardHtml(trade);
    });

    container.innerHTML = html;
}

function createTradeCardHtml(trade) {
    const cargo = playerState ? playerState.cargoCapacity : 36;

    return `
        <div class="outbound-card">
            <!-- Header: Produto e Lucro -->
            <div class="outbound-header">
                <div>
                    <span style="font-size: 11px; text-transform: uppercase; color: var(--accent-cyan); font-weight: 700; letter-spacing: 0.5px;">Mercadoria</span>
                    <div class="outbound-product">${escapeHtml(trade.commodity || '-')}</div>
                </div>
                <div class="outbound-profit-badge">
                    <div class="outbound-profit-val">+${escapeHtml(trade.profitTotalTripFormatted || '-')}</div>
                    <div class="outbound-profit-sub">+${escapeHtml(trade.profitPerUnitFormatted || '-')} / tonelada (${cargo}T)</div>
                </div>
            </div>

            <!-- Route Flow -->
            <div class="outbound-route-flow">
                <!-- Origem (Compra) -->
                <div class="flow-point">
                    <div class="flow-point-left">
                        <span class="flow-point-tag buy">1. Comprar na Origem (${escapeHtml(trade.originSystem || '-')})</span>
                        <span class="flow-station">${escapeHtml(trade.originStation || '-')}</span>
                        <span class="flow-system">Dist. Estação: ${escapeHtml(trade.originDistance || '-')}</span>
                    </div>
                    <div class="flow-point-right">
                        <span class="flow-price">${escapeHtml(trade.buyPrice || '-')}</span>
                        <span class="flow-volume">Estoque: ${escapeHtml(trade.supply || '-')}</span>
                    </div>
                </div>

                <!-- Destino (Venda) -->
                <div class="flow-point">
                    <div class="flow-point-left">
                        <span class="flow-point-tag sell">2. Vender no Destino</span>
                        <span class="flow-station">${escapeHtml(trade.destStation || '-')}</span>
                        <div class="flow-system">
                            <span>${escapeHtml(trade.destSystem || '-')}</span>
                            <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(trade.destSystem)}')" title="Copiar sistema de destino">📋 Copiar</button>
                        </div>
                    </div>
                    <div class="flow-point-right">
                        <span class="flow-price text-profit">${escapeHtml(trade.sellPrice || '-')}</span>
                        <span class="flow-volume">Demanda: ${escapeHtml(trade.demand || '-')}</span>
                    </div>
                </div>
            </div>

            <!-- Footer: Métricas do Salto -->
            <div class="outbound-footer">
                <div class="footer-metric">
                    <span>Distância do Salto:</span>
                    <strong>${escapeHtml(trade.routeDistance || '-')}</strong>
                </div>
                <div class="footer-metric">
                    <span>Estação de Destino:</span>
                    <strong>${escapeHtml(trade.destDistance || '-')}</strong>
                </div>
                <div class="footer-metric">
                    <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(trade.updated || '-')}</span>
                </div>
            </div>
        </div>
    `;
}

function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast(`Sistema "${text}" copiado!`);
    }).catch(err => {
        console.error('Falha ao copiar:', err);
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2500);
}

function simulateJumpDialog() {
    const sys = prompt('Digite o nome do sistema estrelar para simular salto (ex: Sol, Shinrarta Dezhra, Gendalla):');
    if (!sys || !sys.trim()) return;

    fetch(`/api/player/simulate?system=${encodeURIComponent(sys.trim())}`, { method: 'POST' })
        .then(r => r.json())
        .then(updated => {
            showToast(`Salto simulado para ${updated.currentSystem}!`);
            pollPlayerStatus();
        })
        .catch(err => alert('Erro ao simular: ' + err.message));
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
