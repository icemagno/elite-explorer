const tr = (key, ...args) => (window.t ? window.t(key, ...args) : key);

let lastKnownSystem = null;
let currentTrades = [];
let playerState = null;
let isFirstStatusLoad = true;
let lastJumpAlertSystem = null;
let lastCopilotErrorKey = null;
let lastCopilotErrorArg = null;

document.addEventListener('DOMContentLoaded', () => {
    if (window.i18n) {
        document.title = tr('copilot.page_title');
    }

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

    window.addEventListener('elite:languageChanged', () => {
        document.title = tr('copilot.page_title');
        if (playerState) updatePlayerHud(playerState);
        if (lastJumpAlertSystem) {
            const bodyEl = document.getElementById('jumpAlertBody');
            if (bodyEl) {
                bodyEl.innerHTML = tr('copilot.jump_body', `<span id="jumpAlertSystem" style="color: var(--accent-cyan); font-weight: 700;">${escapeHtml(lastJumpAlertSystem)}</span>`);
            }
        }
        if (lastCopilotErrorKey) {
            const errorBox = document.getElementById('errorBox');
            if (errorBox && errorBox.style.display === 'block') {
                errorBox.textContent = tr(lastCopilotErrorKey, lastCopilotErrorArg);
            }
        }
        renderTrades();
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
        dot.style.backgroundColor = '';
        statusText.textContent = tr('copilot.journal_active', status.commander || 'CMDR');
    } else {
        dot.className = 'status-dot';
        dot.style.backgroundColor = '#f85149';
        statusText.textContent = tr('copilot.journal_waiting');
    }

    document.getElementById('cmdrName').textContent = status.commander ? `CMDR ${status.commander}` : tr('galaxy.cmdr_unknown');
    document.getElementById('journalFileName').textContent = status.journalFile ? `Log: ${status.journalFile}` : tr('copilot.no_log');

    document.getElementById('currentSystem').textContent = status.currentSystem || '-';
    
    let stationDesc = tr('copilot.in_supercruise');
    if (status.docked && status.currentStation) {
        stationDesc = tr('copilot.docked_at', status.currentStation);
    } else if (status.currentStation) {
        stationDesc = status.currentStation;
    }
    document.getElementById('currentStation').textContent = stationDesc;

    document.getElementById('shipInfo').textContent = status.shipType || tr('copilot.ship_default');
    document.getElementById('cargoCapacityText').textContent = tr('copilot.cargo_capacity', status.cargoCapacity || 36);

    let flight = status.docked ? tr('copilot.docked_station') : tr('copilot.flying_system');
    document.getElementById('flightStatus').textContent = flight;
    document.getElementById('lastEventTime').textContent = status.lastEvent ? tr('copilot.event_prefix', status.lastEvent) : '-';
}

function showJumpAlert(newSystem) {
    lastJumpAlertSystem = newSystem;
    const alertBox = document.getElementById('jumpAlert');
    const bodyEl = document.getElementById('jumpAlertBody');
    if (bodyEl) {
        bodyEl.innerHTML = tr('copilot.jump_body', `<span id="jumpAlertSystem" style="color: var(--accent-cyan); font-weight: 700;">${escapeHtml(newSystem)}</span>`);
    } else {
        const sysEl = document.getElementById('jumpAlertSystem');
        if (sysEl) sysEl.textContent = newSystem;
    }
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
    btnText.textContent = tr('copilot.searching');
    errorBox.style.display = 'none';
    lastCopilotErrorKey = null;
    lastCopilotErrorArg = null;

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
            throw new Error(`HTTP ${resp.status}`);
        }

        const data = await resp.json();

        if (!data.success) {
            throw new Error(data.errorMessage || tr('copilot.fetch_error', ''));
        }

        currentTrades = data.trades || [];
        document.getElementById('badgeCount').textContent = currentTrades.length;
        document.getElementById('inaraLink').href = data.inaraUrl || '#';
        document.getElementById('lastFetchedAt').textContent = data.fetchedAt || '-';

        renderTrades();
    } catch (err) {
        console.error('Erro ao buscar cotações do copilot:', err);
        lastCopilotErrorKey = 'copilot.fetch_error';
        lastCopilotErrorArg = err.message;
        errorBox.textContent = tr('copilot.fetch_error', err.message);
        errorBox.style.display = 'block';
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = tr('copilot.refresh_quotes');
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
                <h3>${tr('copilot.empty_title')}</h3>
                <p>${tr('copilot.empty_desc')}</p>
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
                    <span style="font-size: 11px; text-transform: uppercase; color: var(--accent-cyan); font-weight: 700; letter-spacing: 0.5px;">${tr('copilot.commodity')}</span>
                    <div class="outbound-product">${escapeHtml(trade.commodity || '-')}</div>
                </div>
                <div class="outbound-profit-badge">
                    <div class="outbound-profit-val">+${escapeHtml(trade.profitTotalTripFormatted || '-')}</div>
                    <div class="outbound-profit-sub">+${escapeHtml(trade.profitPerUnitFormatted || '-')} ${tr('copilot.per_ton', cargo)}</div>
                </div>
            </div>

            <!-- Route Flow -->
            <div class="outbound-route-flow">
                <!-- Origem (Compra) -->
                <div class="flow-point">
                    <div class="flow-point-left">
                        <span class="flow-point-tag buy">${tr('copilot.buy_origin', escapeHtml(trade.originSystem || '-'))}</span>
                        <span class="flow-station">${escapeHtml(trade.originStation || '-')}</span>
                        <span class="flow-system">${tr('copilot.station_dist')} ${escapeHtml(trade.originDistance || '-')}</span>
                    </div>
                    <div class="flow-point-right">
                        <span class="flow-price">${escapeHtml(trade.buyPrice || '-')}</span>
                        <span class="flow-volume">${tr('copilot.supply')} ${escapeHtml(trade.supply || '-')}</span>
                    </div>
                </div>

                <!-- Destino (Venda) -->
                <div class="flow-point">
                    <div class="flow-point-left">
                        <span class="flow-point-tag sell">${tr('copilot.sell_dest')}</span>
                        <span class="flow-station">${escapeHtml(trade.destStation || '-')}</span>
                        <div class="flow-system">
                            <span>${escapeHtml(trade.destSystem || '-')}</span>
                            <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(trade.destSystem)}')" title="${tr('galaxy.copy')}">📋 ${tr('galaxy.copy')}</button>
                        </div>
                    </div>
                    <div class="flow-point-right">
                        <span class="flow-price text-profit">${escapeHtml(trade.sellPrice || '-')}</span>
                        <span class="flow-volume">${tr('copilot.demand')} ${escapeHtml(trade.demand || '-')}</span>
                    </div>
                </div>
            </div>

            <!-- Footer: Métricas do Salto -->
            <div class="outbound-footer">
                <div class="footer-metric">
                    <span>${tr('copilot.jump_dist')}</span>
                    <strong>${escapeHtml(trade.routeDistance || '-')}</strong>
                </div>
                <div class="footer-metric">
                    <span>${tr('copilot.dest_station')}</span>
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
        showToast(tr('copilot.copied', text));
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
    const sys = prompt(tr('copilot.simulate_prompt'));
    if (!sys || !sys.trim()) return;

    fetch(`/api/player/simulate?system=${encodeURIComponent(sys.trim())}`, { method: 'POST' })
        .then(r => r.json())
        .then(updated => {
            showToast(tr('copilot.simulate_ok', updated.currentSystem));
            pollPlayerStatus();
        })
        .catch(err => alert(tr('copilot.simulate_err', err.message)));
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
