const tr = (key, ...args) => (window.t ? window.t(key, ...args) : key);

let currentRoutes = [];
let lastTradeErrorKey = null;
let lastTradeErrorArg = null;

document.addEventListener('DOMContentLoaded', () => {
    if (window.i18n) {
        document.title = tr('trade.page_title');
    }

    // Initial fetch on page load
    fetchTradeRoutes();

    // Event listeners
    document.getElementById('searchForm').addEventListener('submit', (e) => {
        e.preventDefault();
        fetchTradeRoutes();
    });

    document.getElementById('filterInput').addEventListener('input', () => {
        renderRoutes();
    });

    document.getElementById('sortSelect').addEventListener('change', () => {
        renderRoutes();
    });

    window.addEventListener('elite:languageChanged', () => {
        document.title = tr('trade.page_title');
        if (lastTradeErrorKey) {
            const errorBox = document.getElementById('errorBox');
            if (errorBox && errorBox.style.display === 'block') {
                errorBox.textContent = tr(lastTradeErrorKey, lastTradeErrorArg);
            }
        }
        renderRoutes();
    });
});

async function fetchTradeRoutes() {
    const btn = document.getElementById('btnRefresh');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('btnSpinner');
    const errorBox = document.getElementById('errorBox');

    const system = document.getElementById('inputSystem').value.trim();
    const cargo = document.getElementById('inputCargo').value;
    const maxDist = document.getElementById('inputMaxDist').value;
    const padSize = document.getElementById('inputPadSize').value;
    const maxAge = document.getElementById('inputMaxAge').value;

    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.textContent = tr('trade.consulting');
    errorBox.style.display = 'none';
    lastTradeErrorKey = null;
    lastTradeErrorArg = null;

    try {
        const query = new URLSearchParams({
            system: system || 'Col 285 Sector EG-D a42-1',
            cargoCapacity: cargo || '36',
            maxDistance: maxDist || '80',
            padSize: padSize || '1',
            maxAgeHours: maxAge || '72'
        });

        const resp = await fetch(`/api/routes?${query.toString()}`);
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        const data = await resp.json();

        if (!data.success) {
            throw new Error(data.errorMessage || tr('trade.fetch_error', 'Inara'));
        }

        currentRoutes = data.routes || [];
        document.getElementById('badgeCount').textContent = currentRoutes.length;
        document.getElementById('inaraLink').href = data.inaraUrl || '#';
        document.getElementById('lastFetchedAt').textContent = data.fetchedAt || '-';

        renderRoutes();
    } catch (err) {
        console.error('Erro ao buscar rotas:', err);
        lastTradeErrorKey = 'trade.fetch_error';
        lastTradeErrorArg = err.message;
        errorBox.textContent = tr('trade.fetch_error', err.message);
        errorBox.style.display = 'block';
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = tr('trade.btn_refresh');
    }
}

function getSortedAndFilteredRoutes() {
    const filterTerm = document.getElementById('filterInput').value.trim().toLowerCase();
    const sortBy = document.getElementById('sortSelect').value;

    let list = [...currentRoutes];

    if (filterTerm) {
        list = list.filter(r => {
            const str = [
                r.sourceStation, r.sourceSystem,
                r.targetStation, r.targetSystem,
                r.outbound?.commodity,
                r.inbound?.commodity
            ].filter(Boolean).join(' ').toLowerCase();

            return str.includes(filterTerm);
        });
    }

    list.sort((a, b) => {
        switch (sortBy) {
            case 'trip':
                return (b.profitPerTripNumeric || 0) - (a.profitPerTripNumeric || 0);
            case 'unit':
                return (b.profitPerUnitNumeric || 0) - (a.profitPerUnitNumeric || 0);
            case 'hour':
                return (b.profitPerHourNumeric || 0) - (a.profitPerHourNumeric || 0);
            case 'route_dist_asc':
                return (a.routeDistanceNumeric || 0) - (b.routeDistanceNumeric || 0);
            case 'dist_center_asc':
                return parseDistance(a.distanceFromCenter) - parseDistance(b.distanceFromCenter);
            default:
                return 0;
        }
    });

    return list;
}

function parseDistance(text) {
    if (!text) return 999999;
    const num = parseFloat(text.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 999999 : num;
}

function renderRoutes() {
    const container = document.getElementById('routesList');
    const routes = getSortedAndFilteredRoutes();

    if (routes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>${tr('trade.empty_title')}</h3>
                <p>${tr('trade.empty_desc')}</p>
            </div>
        `;
        return;
    }

    let html = '';
    routes.forEach(route => {
        html += createRouteCardHtml(route);
    });

    container.innerHTML = html;
}

function createRouteCardHtml(route) {
    const outLeg = route.outbound || {};
    const inLeg = route.inbound || {};

    return `
        <div class="route-card">
            <!-- Header: Origem & Destino -->
            <div class="route-header-row">
                <div class="location-box">
                    <span class="loc-label from">${tr('trade.from_label')}</span>
                    <span class="loc-station">${escapeHtml(route.sourceStation || '-')}</span>
                    <div class="loc-system-row">
                        <span class="loc-system">${escapeHtml(route.sourceSystem || '-')}</span>
                        <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(route.sourceSystem)}')" title="${tr('galaxy.copy')}">📋 ${tr('galaxy.copy')}</button>
                    </div>
                    <span class="loc-distance">${tr('trade.station_dist_label')} <span>${escapeHtml(route.sourceDistance || '-')}</span></span>
                </div>

                <div class="location-box">
                    <span class="loc-label to">${tr('trade.to_label')}</span>
                    <span class="loc-station">${escapeHtml(route.targetStation || '-')}</span>
                    <div class="loc-system-row">
                        <span class="loc-system">${escapeHtml(route.targetSystem || '-')}</span>
                        <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(route.targetSystem)}')" title="${tr('galaxy.copy')}">📋 ${tr('galaxy.copy')}</button>
                    </div>
                    <span class="loc-distance">${tr('trade.station_dist_label')} <span>${escapeHtml(route.targetDistance || '-')}</span></span>
                </div>

                <div class="profits-right">
                    <div class="profit-badge">
                        <div class="profit-badge-label">${tr('trade.profit_trip')}</div>
                        <div class="profit-badge-value major">${escapeHtml(route.profitPerTrip || '-')}</div>
                    </div>
                </div>
            </div>

            <!-- Trade Legs: Ida e Volta -->
            <div class="trade-legs-grid">
                <!-- Ida -->
                <div class="trade-leg-box">
                    <div class="leg-title">
                        <span>${tr('trade.outbound_leg', escapeHtml(route.targetStation || tr('trade.to_label')))}</span>
                        <span class="commodity-name text-cyan">${escapeHtml(outLeg.commodity || '-')}</span>
                    </div>
                    <div class="leg-data-row">
                        <div class="data-cell">
                            <span class="data-cell-label">${tr('trade.buy_origin')}</span>
                            <span class="data-cell-value">${escapeHtml(outLeg.buyPrice || '-')}</span>
                            <span class="data-cell-label" style="margin-top:4px;">${tr('trade.supply')} <span class="data-cell-value">${escapeHtml(outLeg.supply || '-')}</span></span>
                        </div>
                        <div class="data-cell">
                            <span class="data-cell-label">${tr('trade.sell_dest')}</span>
                            <span class="data-cell-value text-profit">${escapeHtml(outLeg.sellPrice || '-')}</span>
                            <span class="data-cell-label" style="margin-top:4px;">${tr('trade.demand')} <span class="data-cell-value">${escapeHtml(outLeg.demand || '-')}</span></span>
                        </div>
                    </div>
                </div>

                <!-- Volta -->
                <div class="trade-leg-box">
                    <div class="leg-title">
                        <span>${tr('trade.inbound_leg', escapeHtml(route.sourceStation || tr('trade.from_label')))}</span>
                        <span class="commodity-name text-orange">${escapeHtml(inLeg.commodity || '-')}</span>
                    </div>
                    <div class="leg-data-row">
                        <div class="data-cell">
                            <span class="data-cell-label">${tr('trade.buy_dest')}</span>
                            <span class="data-cell-value">${escapeHtml(inLeg.buyPrice || '-')}</span>
                            <span class="data-cell-label" style="margin-top:4px;">${tr('trade.supply')} <span class="data-cell-value">${escapeHtml(inLeg.supply || '-')}</span></span>
                        </div>
                        <div class="data-cell">
                            <span class="data-cell-label">${tr('trade.sell_origin')}</span>
                            <span class="data-cell-value text-profit">${escapeHtml(inLeg.sellPrice || '-')}</span>
                            <span class="data-cell-label" style="margin-top:4px;">${tr('trade.demand')} <span class="data-cell-value">${escapeHtml(inLeg.demand || '-')}</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer: Lucros & Métricas da Rota -->
            <div class="route-summary-row">
                <div class="stats-left">
                    <div class="stat-item">
                        <span class="stat-item-label">${tr('trade.route_dist')}</span>
                        <span class="stat-item-value">${escapeHtml(route.routeDistance || '-')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-item-label">${tr('trade.center_dist')}</span>
                        <span class="stat-item-value">${escapeHtml(route.distanceFromCenter || '-')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-item-label">${tr('trade.margin')}</span>
                        <span class="stat-item-value text-profit">${escapeHtml(route.margin || '-')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-item-label">${tr('trade.updated')}</span>
                        <span class="stat-item-value">${escapeHtml(route.updated || '-')}</span>
                    </div>
                </div>

                <div class="profits-right">
                    <div class="stat-item" style="text-align: right;">
                        <span class="stat-item-label">${tr('trade.profit_unit')}</span>
                        <span class="stat-item-value text-orange" style="font-weight: 700;">${escapeHtml(route.profitPerUnit || '-')}</span>
                    </div>
                    <div class="stat-item" style="text-align: right;">
                        <span class="stat-item-label">${tr('trade.profit_hour')}</span>
                        <span class="stat-item-value text-cyan" style="font-weight: 700;">${escapeHtml(route.profitPerHour || '-')}</span>
                    </div>
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
