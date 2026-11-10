let currentRoutes = [];

document.addEventListener('DOMContentLoaded', () => {
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
    btnText.textContent = 'Consultando...';
    errorBox.style.display = 'none';

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
            throw new Error(`Erro de rede ou servidor: HTTP ${resp.status}`);
        }

        const data = await resp.json();

        if (!data.success) {
            throw new Error(data.errorMessage || 'Falha ao buscar dados no Inara.');
        }

        currentRoutes = data.routes || [];
        document.getElementById('badgeCount').textContent = currentRoutes.length;
        document.getElementById('inaraLink').href = data.inaraUrl || '#';
        document.getElementById('lastFetchedAt').textContent = data.fetchedAt || '-';

        renderRoutes();
    } catch (err) {
        console.error('Erro ao buscar rotas:', err);
        errorBox.textContent = `Falha na consulta: ${err.message}`;
        errorBox.style.display = 'block';
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = 'Atualizar';
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
                <h3>Nenhuma rota encontrada</h3>
                <p>Verifique os filtros de pesquisa ou aumente a distância máxima de salto.</p>
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
                    <span class="loc-label from">Origem (From)</span>
                    <span class="loc-station">${escapeHtml(route.sourceStation || '-')}</span>
                    <div class="loc-system-row">
                        <span class="loc-system">${escapeHtml(route.sourceSystem || '-')}</span>
                        <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(route.sourceSystem)}')" title="Copiar nome do sistema">📋 Copiar</button>
                    </div>
                    <span class="loc-distance">Distância da estação: <span>${escapeHtml(route.sourceDistance || '-')}</span></span>
                </div>

                <div class="location-box">
                    <span class="loc-label to">Destino (To)</span>
                    <span class="loc-station">${escapeHtml(route.targetStation || '-')}</span>
                    <div class="loc-system-row">
                        <span class="loc-system">${escapeHtml(route.targetSystem || '-')}</span>
                        <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(route.targetSystem)}')" title="Copiar nome do sistema">📋 Copiar</button>
                    </div>
                    <span class="loc-distance">Distância da estação: <span>${escapeHtml(route.targetDistance || '-')}</span></span>
                </div>

                <div class="profits-right">
                    <div class="profit-badge">
                        <div class="profit-badge-label">Lucro por Viagem</div>
                        <div class="profit-badge-value major">${escapeHtml(route.profitPerTrip || '-')}</div>
                    </div>
                </div>
            </div>

            <!-- Trade Legs: Ida e Volta -->
            <div class="trade-legs-grid">
                <!-- Ida -->
                <div class="trade-leg-box">
                    <div class="leg-title">
                        <span>Ida ➔ ${escapeHtml(route.targetStation || 'Destino')}</span>
                        <span class="commodity-name text-cyan">${escapeHtml(outLeg.commodity || '-')}</span>
                    </div>
                    <div class="leg-data-row">
                        <div class="data-cell">
                            <span class="data-cell-label">Compra (Origem)</span>
                            <span class="data-cell-value">${escapeHtml(outLeg.buyPrice || '-')}</span>
                            <span class="data-cell-label" style="margin-top:4px;">Oferta (Supply): <span class="data-cell-value">${escapeHtml(outLeg.supply || '-')}</span></span>
                        </div>
                        <div class="data-cell">
                            <span class="data-cell-label">Venda (Destino)</span>
                            <span class="data-cell-value text-profit">${escapeHtml(outLeg.sellPrice || '-')}</span>
                            <span class="data-cell-label" style="margin-top:4px;">Demanda: <span class="data-cell-value">${escapeHtml(outLeg.demand || '-')}</span></span>
                        </div>
                    </div>
                </div>

                <!-- Volta -->
                <div class="trade-leg-box">
                    <div class="leg-title">
                        <span>Volta ➔ ${escapeHtml(route.sourceStation || 'Origem')}</span>
                        <span class="commodity-name text-orange">${escapeHtml(inLeg.commodity || '-')}</span>
                    </div>
                    <div class="leg-data-row">
                        <div class="data-cell">
                            <span class="data-cell-label">Compra (Destino)</span>
                            <span class="data-cell-value">${escapeHtml(inLeg.buyPrice || '-')}</span>
                            <span class="data-cell-label" style="margin-top:4px;">Oferta (Supply): <span class="data-cell-value">${escapeHtml(inLeg.supply || '-')}</span></span>
                        </div>
                        <div class="data-cell">
                            <span class="data-cell-label">Venda (Origem)</span>
                            <span class="data-cell-value text-profit">${escapeHtml(inLeg.sellPrice || '-')}</span>
                            <span class="data-cell-label" style="margin-top:4px;">Demanda: <span class="data-cell-value">${escapeHtml(inLeg.demand || '-')}</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer: Lucros & Métricas da Rota -->
            <div class="route-summary-row">
                <div class="stats-left">
                    <div class="stat-item">
                        <span class="stat-item-label">Distância da Rota</span>
                        <span class="stat-item-value">${escapeHtml(route.routeDistance || '-')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-item-label">Dist. do Centro</span>
                        <span class="stat-item-value">${escapeHtml(route.distanceFromCenter || '-')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-item-label">Margem</span>
                        <span class="stat-item-value text-profit">${escapeHtml(route.margin || '-')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-item-label">Atualizado</span>
                        <span class="stat-item-value">${escapeHtml(route.updated || '-')}</span>
                    </div>
                </div>

                <div class="profits-right">
                    <div class="stat-item" style="text-align: right;">
                        <span class="stat-item-label">Lucro por Unidade</span>
                        <span class="stat-item-value text-orange" style="font-weight: 700;">${escapeHtml(route.profitPerUnit || '-')}</span>
                    </div>
                    <div class="stat-item" style="text-align: right;">
                        <span class="stat-item-label">Lucro por Hora</span>
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
