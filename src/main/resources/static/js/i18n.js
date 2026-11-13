/**
 * Elite Explorer Copilot - Sistema de Internacionalização (i18n)
 * Idiomas suportados: Português (pt), English (en) e Español (es).
 * Renderiza 3 pequenas bandeiras SVG nos containers [data-lang-switcher] do cabeçalho.
 */

(function () {
    const SUPPORTED_LANGS = ['pt', 'en', 'es'];
    const STORAGE_KEY = 'elite_explorer_language';
    const COOKIE_KEY = 'elite_explorer_lang';

    const LOCALE_META = {
        pt: { code: 'pt-BR', title: 'Português (Brasil)' },
        en: { code: 'en-US', title: 'English (US)' },
        es: { code: 'es-ES', title: 'Español' }
    };

    const FLAG_SVGS = {
        pt: `<svg viewBox="0 0 720 504" aria-hidden="true">
                <rect width="720" height="504" fill="#009c3b" rx="44"/>
                <polygon points="360,63 657,252 360,441 63,252" fill="#ffdf00"/>
                <circle cx="360" cy="252" r="126" fill="#002776"/>
                <path d="M 234,252 A 130,130 0 0,0 486,238" stroke="#ffffff" stroke-width="18" fill="none"/>
            </svg>`,
        en: `<svg viewBox="0 0 720 504" aria-hidden="true">
                <clipPath id="elite-us-clip"><rect width="720" height="504" rx="44"/></clipPath>
                <g clip-path="url(#elite-us-clip)">
                    <rect width="720" height="504" fill="#b22234"/>
                    <path d="M0,38.7h720M0,116.3h720M0,193.8h720M0,271.4h720M0,349h720M0,426.5h720" stroke="#ffffff" stroke-width="38.7"/>
                    <rect width="288" height="271.4" fill="#3c3b6e"/>
                    <g fill="#ffffff">
                        <circle cx="52" cy="48" r="12"/><circle cx="128" cy="48" r="12"/><circle cx="204" cy="48" r="12"/>
                        <circle cx="90" cy="96" r="12"/><circle cx="166" cy="96" r="12"/><circle cx="242" cy="96" r="12"/>
                        <circle cx="52" cy="144" r="12"/><circle cx="128" cy="144" r="12"/><circle cx="204" cy="144" r="12"/>
                        <circle cx="90" cy="192" r="12"/><circle cx="166" cy="192" r="12"/><circle cx="242" cy="192" r="12"/>
                        <circle cx="52" cy="236" r="12"/><circle cx="128" cy="236" r="12"/><circle cx="204" cy="236" r="12"/>
                    </g>
                </g>
            </svg>`,
        es: `<svg viewBox="0 0 720 504" aria-hidden="true">
                <clipPath id="elite-es-clip"><rect width="720" height="504" rx="44"/></clipPath>
                <g clip-path="url(#elite-es-clip)">
                    <rect width="720" height="504" fill="#aa151b"/>
                    <rect y="126" width="720" height="252" fill="#f1bf00"/>
                    <circle cx="215" cy="252" r="46" fill="#aa151b"/>
                    <circle cx="215" cy="252" r="32" fill="#f1bf00"/>
                </g>
            </svg>`
    };

    const TRANSLATIONS = {
        pt: {
            // Navegação comum & Sidebar
            'nav.menu_btn': 'MENU',
            'nav.menu_title': 'Menu do Copilot',
            'nav.close_menu': 'Fechar Menu',
            'nav.cmdr': 'COMANDANTE',
            'nav.system_label': 'SISTEMA ATUAL',
            'nav.navigation_title': 'NAVEGAÇÃO',
            'nav.language_title': 'IDIOMA / LANGUAGE',
            'nav.desc_galaxy': 'Exploração 3D e rota estelar',
            'nav.desc_orrery': 'Órbitas e corpos celestes',
            'nav.desc_surface': 'HUD tático de superfície e biologia',
            'nav.desc_market': 'Top 20 rotas comerciais da galáxia',
            'nav.status_online': 'ONLINE',
            'nav.status_offline': 'OFF-LINE',
            'nav.galaxy_cube': 'Cubo Galáctico',
            'nav.galaxy_cube_3d': 'Cubo Galáctico 3D',
            'nav.system': 'Sistema',
            'nav.system_orrery': 'Sistema 3D (Orrery)',
            'nav.surface': 'Superfície',
            'nav.market': 'Mercado Single-Hop',
            'nav.system_title': 'Abrir o Mapa 3D do Sistema Estelar',
            'nav.surface_disabled_title': 'Disponível apenas quando a nave estiver em órbita ou na superfície de um planeta',
            'nav.surface_active_title': 'Nave em órbita/solo de {0} - Clique para alternar o HUD de Superfície',
            'nav.orrery_surface_title': 'Nave em {0} - Clique para abrir a Tela de Superfície',

            // Splash
            'splash.subtitle': 'NAVEGAÇÃO GALÁCTICA • SISTEMA • SUPERFÍCIE',
            'splash.commander_label': 'COMANDANTE',
            'splash.connecting': 'CONECTANDO AO DIÁRIO DE BORDO...',
            'splash.ready': 'SISTEMAS PRONTOS • SINCRONIZANDO TELEMETRIA',

            // Explorer (Cubo Galáctico)
            'galaxy.syncing_journal': 'Sincronizando com Journal...',
            'galaxy.loading_default': 'Aguarde... Carregando dados estelares',
            'galaxy.loading_mapping': 'Aguarde... Mapeando e triangulando setor estelar',
            'galaxy.edsm_connecting': '🛰️ EDSM: Conectando...',
            'galaxy.edsm_not_configured': 'Não configurado',
            'galaxy.edsm_disabled': 'Desativado',
            'galaxy.edsm_conn_failed': 'Falha na conexão',
            'galaxy.edsm_net_error': 'Erro de rede no envio',
            'galaxy.edsm_connected': 'Conectado (CMDR {0})',
            'galaxy.edsm_sent': '{0} Envios',
            'galaxy.edsm_title': 'Transmissão contínua de telemetria e descobertas para o EDSM',
            'galaxy.cmdr_unknown': 'Desconhecido',
            'galaxy.commander_fallback': 'Comandante',
            'galaxy.system_label': 'Sistema',
            'galaxy.target_pinned': 'ALVO FIXADO',
            'galaxy.system_selected': 'SISTEMA SELECIONADO',
            'galaxy.close': 'Fechar',
            'galaxy.safe_docking': '⚓ ANCORAGEM SEGURA',
            'galaxy.current_system': 'Sistema Atual',
            'galaxy.docks_count': '{0} docas',
            'galaxy.docks_orbital_count': '{0} orbitais',
            'galaxy.querying_stations': 'Consultando estações do sistema...',
            'galaxy.waiting_journal_signal': 'Aguardando sinal do Journal...',
            'galaxy.no_orbital_stations': '🌌 Nenhuma estação orbital catalogada neste sistema.',
            'galaxy.deep_space_no_docks': 'Espaço Profundo / Sem Docas Espaciais',
            'galaxy.orbit_prefix': 'Órbita: {0}',
            'galaxy.orbital_station_fallback': 'Estação Orbital',
            'galaxy.star_filter': 'FILTRO ESTELAR',
            'galaxy.filter_all': '🌐 Todos',
            'galaxy.filter_inhabited': '🏙️ Apenas Habitados',
            'galaxy.filter_toggle_title': 'Alternar entre exibir todos os sistemas ou apenas habitados',
            'galaxy.top3_stratum': '🪐 TOP 3 STRATUM PRÓXIMAS',
            'galaxy.top3_gaps': '👻 TOP 3 GAPS PROCEDURAIS',
            'galaxy.traffic_title': '🛰️ TRÁFEGO DE COMANDANTES',
            'galaxy.traffic_live': 'AO VIVO',
            'galaxy.traffic_sound_on': 'Alertas sonoros de tráfego ativados (clique para silenciar)',
            'galaxy.traffic_sound_off': 'Alertas sonoros de tráfego silenciados (clique para ativar)',
            'galaxy.traffic_online_estimate': 'Cerca de {0} comandantes online na região',
            'galaxy.in_cube': '{0} no cubo',
            'galaxy.scanning_surroundings': 'Varrendo arredores...',
            'galaxy.scanning_bodies': 'Varrendo corpos celestes dos arredores...',
            'galaxy.scanning_voids': 'Varrendo vazios...',
            'galaxy.no_gaps_detected': 'Nenhum gap detectado',
            'galaxy.waiting_sector_traffic': 'Aguardando tráfego no setor...',
            'galaxy.legend_current': 'Localização Atual',
            'galaxy.legend_kgbfoam': 'Estrelas KGBFOAM',
            'galaxy.legend_other': 'Demais Estrelas',
            'galaxy.legend_gap': 'Provável Gap Procedural',
            'galaxy.legend_stratum_conf': 'Stratum Confirmado',
            'galaxy.legend_stratum_pot': 'Stratum Provável',
            'galaxy.edsm_error': 'Erro ao carregar dados do EDSM',
            'galaxy.stats_central': 'Sistema Central',
            'galaxy.stats_cube': 'Cubo',
            'galaxy.stats_known': 'Sistemas Conhecidos',
            'galaxy.stats_gaps': 'Gaps Procedurais',
            'galaxy.source_cache': '● Fonte: Cache local (0 reqs EDSM)',
            'galaxy.source_edsm': '● Fonte: EDSM (salvo em cache)',
            'galaxy.source_stale': '⚠ Cache prévio (EDSM offline)',
            'galaxy.source_local': '⚠ EDSM falhou — apenas sistemas locais',
            'galaxy.btn_refresh': 'Atualizar',
            'galaxy.btn_retry': 'Tentar novamente',
            'galaxy.confirmed_presence': '✔ Presença Confirmada',
            'galaxy.potential_first': '🪐 Potencial Inédito (1st)',
            'galaxy.confirmed_badge': '✔ Confirmado',
            'galaxy.potential_badge': '🪐 Inédito (1st)',
            'galaxy.already_collected': '🚫 JÁ COLETADO',
            'galaxy.already_landed': '👣 JÁ POUSADO',
            'galaxy.already_landed_card': '👣 Pouso já realizado',
            'galaxy.collected_tooltip': 'Stratum já coletado neste planeta em {0}',
            'galaxy.landed_tooltip': 'Pouso já realizado em {0}',
            'galaxy.potential_tooltip': '100% compatível com Stratum, mas ainda não mapeado no Spansh (Bônus 5x de 1st Discovery: ~95M cr!)',
            'galaxy.first_badge_title': 'Sem registro prévio de descoberta no EDSM',
            'galaxy.never_mapped': 'NUNCA MAPEADO',
            'galaxy.never_mapped_title': 'Corpo celeste nunca mapeado por nenhum comandante',
            'galaxy.thin_atmosphere': 'Atmosfera Fina',
            'galaxy.stratum_planet': 'Planeta com Stratum',
            'galaxy.distance': 'Distância',
            'galaxy.distance_ship': 'Distância da Nave',
            'galaxy.distance_your_ship': 'Distância da sua Nave',
            'galaxy.bodies_label': 'Corpos',
            'galaxy.celestial_bodies_label': 'Corpos Celestes',
            'galaxy.population_label': 'População',
            'galaxy.inhabitants': 'habitantes',
            'galaxy.inhabited_pop': '● Habitado (Pop: {0})',
            'galaxy.copy': '📋 Copiar',
            'galaxy.system_3d': '🪐 Sistema 3D',
            'galaxy.void_badge': 'SISTEMA INÉDITO (GAP PROCEDURAL)',
            'galaxy.void_tooltip_title': '👻 SISTEMA NÃO CATALOGADO (GAP PROCEDURAL)',
            'galaxy.void_certainty': 'Certeza Matemática',
            'galaxy.void_certainty_val': '100% no Stellar Forge',
            'galaxy.void_subblock': 'Sub-bloco',
            'galaxy.void_mass': 'Massa {0} (Precisão: ±{1} ly)',
            'galaxy.void_mass_class': 'Classe de Massa',
            'galaxy.void_spatial_acc': 'Precisão espacial: ±{0} ly',
            'galaxy.void_est_dist': 'Distância estimada',
            'galaxy.void_known_siblings': 'Irmãos conhecidos',
            'galaxy.void_suggested_jump': '🎯 SALTO SUGERIDO (Irmão Conhecido):',
            'galaxy.void_no_nearby_star': 'Sem estrela próxima catalogada',
            'galaxy.void_no_edge_system': 'Nenhum sistema catalogado na borda',
            'galaxy.void_to_target': 'Do Waypoint até o Alvo',
            'galaxy.jump_ref': 'Salto ref:',
            'galaxy.none_nearby': 'Nenhum próximo',
            'galaxy.cmdr_arrived': 'Um comandante chegou ao sistema:',
            'galaxy.cmdr_departed': 'Um comandante deixou o sistema:',
            'galaxy.focus_system_title': 'Clique para focar no sistema {0}',
            'galaxy.time_now': 'agora',
            'galaxy.time_s': 'há {0}s',
            'galaxy.time_m': 'há {0}m',
            'galaxy.time_h': 'há {0}h',
            'galaxy.on_date': ' em {0}',

            // Surface Navigator (Superfície 2.5D)
            'surface.zoom_global': '🌐 Global (-180°/+180°)',
            'surface.zoom_tactical': '🎯 Tático (1.200m)',
            'surface.zoom_auto': '🔄 Auto (Altitude)',
            'surface.recenter_ship': '📍 Focar Nave',
            'surface.recenter_ship_title': 'Re-alinhar e focar a câmera na posição da nave/jogador',
            'surface.body_label': '🪐 CORPO CELESTE',
            'surface.gravity_label': '⚖️ GRAVIDADE',
            'surface.compass_label': '🧭 BÚSSOLA / RUMO',
            'surface.atmosphere_label': '💨 ATMOSFERA',
            'surface.pressure_label': '🌡️ PRESSÃO',
            'surface.altimeter_title': '📐 ALTÍMETRO & TELEMETRIA',
            'surface.altitude_label': 'Altitude:',
            'surface.state_landed_srv': 'SRV NA SUPERFÍCIE',
            'surface.state_landed_foot': 'PILOTO A PÉ',
            'surface.state_landed_ship': 'NAVE POUSADA',
            'surface.state_glide': 'VOO EM GLIDE ORBITAL',
            'surface.state_flight': 'EM VOO ATMOSFÉRICO',
            'surface.gps_title': 'COORDENADAS GPS',
            'surface.lat_label': 'Latitude:',
            'surface.lon_label': 'Longitude:',
            'surface.touchdown_title': 'LOCAL DE POUSO',
            'surface.coords_label': 'Coordenadas:',
            'surface.ship_dist_label': 'Distância da Nave:',
            'surface.waiting_body': 'Aguardando corpo...',
            'surface.no_atmosphere': 'Sem atmosfera',
            'surface.bio_title': '🧬 HODÔMETRO EXOBIOLOGIA',
            'surface.bio_sample_1': 'AMOSTRA 1',
            'surface.bio_sample_2': 'AMOSTRA 2',
            'surface.bio_sample_3': 'AMOSTRA 3',
            'surface.bio_collected': 'COLETADA',
            'surface.bio_pending': 'PENDENTE',
            'surface.ship_parked': '🚀 NAVE ESTACIONADA',
            'surface.bio_sample_default': 'Amostra',
            'surface.bio_species_label': 'ESPÉCIE EM AMOSTRAGEM',
            'surface.bio_waiting_sample': 'Aguardando amostragem...',
            'surface.bio_dist_label': 'Distância da Amostra:',
            'surface.bio_waiting_scan': 'Aguardando scan inicial...',
            'surface.bio_completed': 'CONCLUÍDO',
            'surface.bio_success_banner': '🎉 ESPÉCIE ANALISADA COM SUCESSO',
            'surface.bio_ready_banner': '✅ DIVERSIDADE ALCANÇADA ({0}m) • PRONTA P/ AMOSTRA #{1}',
            'surface.bio_inside_banner': '⚠️ DENTRO DA COLÔNIA ({0}m) • Faltam {1}m',
            'surface.bio_leaving_area_voice': 'Saindo da área de amostra',
            'surface.legend_current_pos': 'Posição Atual',
            'surface.legend_ship': 'Nave',
            'surface.legend_colony': 'Colônia',
            'surface.legend_extraction': 'Extração',
            'surface.legend_wreckage': 'Destroços',
            'surface.legend_research': 'Pesquisa',
            'surface.legend_geological': 'Geológico',
            'surface.legend_ruin': 'Ruína / Lore',
            'surface.legend_bio': 'Bio-Amostra',
            'surface.legend_colony_radius': 'Raio Colônia',

            // Orrery (Sistema 3D)
            'orrery.title': 'Elite Explorer Copilot - Sistema 3D (Orrery)',
            'orrery.loading_orbital': 'Carregando mecânica orbital do sistema...',
            'orrery.loading_system': 'Consultando órbitas e telemetria de {0}...',
            'orrery.load_failed': 'Falha ao carregar sistema: {0}',
            'orrery.system_badge': 'SISTEMA:',
            'orrery.loading_short': 'Carregando...',
            'orrery.bodies_count': '{0} corpos',
            'orrery.bodies_unmapped': '0 corpos (Não Mapeado)',
            'orrery.unmapped_msg': '⚠️ <b>{0}</b> não catalogado no EDSM.<br><span style="color:#00d4ff; font-size:13px; font-weight:normal;">Utilize o Scanner FSS no jogo para mapear e revelar os corpos em tempo real!</span>',
            'orrery.btn_reset_view': '🔭 Ver Tudo',
            'orrery.btn_reset_title': 'Visão Panorâmica do Sistema',
            'orrery.btn_focus_star': '☀️ Estrela',
            'orrery.btn_focus_title': 'Centralizar na Estrela Principal',
            'orrery.legend_title': '🪐 LEGENDA DO SISTEMA',
            'orrery.legend_stars': 'Estrelas (KGBFOAM)',
            'orrery.legend_hmc': 'High Metal Content / Terrestre',
            'orrery.legend_metal_rich': 'Metal-Rich Body',
            'orrery.legend_water': 'Mundo com Água (Water World)',
            'orrery.legend_icy': 'Corpo Gelado (Icy Body)',
            'orrery.legend_gas': 'Gigante Gasoso',
            'orrery.legend_belt': 'Aglomerado de Asteroides',
            'orrery.legend_landable': 'Pousável com Nave / SRV',
            'orrery.tree_title': '🪐 CORPOS CELESTES',
            'orrery.tree_placeholder': 'Filtrar por nome ou classe...',
            'orrery.badge_planet': 'PLANETA',
            'orrery.badge_belt': 'AGLOMERADO DE ASTEROIDES',
            'orrery.landable_yes': '🟢 POUSÁVEL COM NAVE / SRV',
            'orrery.landable_no': '🔴 NÃO POUSÁVEL',
            'orrery.landable_belt': '⛏️ MINERAÇÃO NO VÁCUO (Laser / Explosão)',
            'orrery.landable_tooltip': ' • <span style="color:#2bfca8;font-weight:bold;">🟢 POUSÁVEL</span>',
            'orrery.mining_tooltip': '⛏️ Mineração',
            'orrery.orbital_section': 'MECÂNICA ORBITAL',
            'orrery.dist_arrival': 'Distância de Chegada:',
            'orrery.semi_major': 'Semi-Eixo Maior:',
            'orrery.orbital_period': 'Período Orbital:',
            'orrery.eccentricity': 'Excentricidade:',
            'orrery.inclination': 'Inclinação Orbital:',
            'orrery.physical_section': 'PROPRIEDADES FÍSICAS',
            'orrery.radius': 'Raio:',
            'orrery.gravity': 'Gravidade:',
            'orrery.mass': 'Massa:',
            'orrery.temperature': 'Temperatura de Superfície:',
            'orrery.atmosphere': 'Atmosfera:',
            'orrery.pressure': 'Pressão:',
            'orrery.signals_section': 'SINAIS DETECTADOS (DSS)',
            'orrery.materials_section': 'MATERIAIS DE SUPERFÍCIE',
            'orrery.days_unit': '{0} dias',
            'orrery.vacuum': 'Vácuo Espacial',
            'orrery.no_atmo': 'Vácuo / Sem atmosfera',
            'orrery.rocky_cluster': 'Aglomerado Rochoso',
            'orrery.microgravity': '0.00 G (Microgravidade)',
            'orrery.star_class': 'Classe {0}',

            // Copilot & Trade
            'copilot.page_title': 'Elite Explorer Copilot - Copilot em Tempo Real',
            'copilot.title_prefix': 'Painel de Bordo',
            'copilot.subtitle': 'Monitoramento de Voo em Tempo Real & Cotações de Venda de Ida',
            'copilot.journal_connecting': 'Conectando ao Journal...',
            'copilot.journal_active': 'Journal Ativo: {0}',
            'copilot.journal_waiting': 'Aguardando Arquivo Journal...',
            'copilot.label_commander': 'Comandante',
            'copilot.label_current_system': 'Sistema Atual (Origem)',
            'copilot.label_ship_cargo': 'Nave Ativa & Carga',
            'copilot.label_flight_status': 'Status de Voo',
            'copilot.reading_log': 'Lendo log...',
            'copilot.in_hyperspace': 'No hiperespaço',
            'copilot.in_supercruise': 'No Espaço / Supercruise',
            'copilot.docked_at': 'Atracado: {0}',
            'copilot.docked_station': 'Pousado em Estação',
            'copilot.flying_system': 'Voando no Sistema',
            'copilot.cargo_capacity': 'Capacidade de carga: {0} T',
            'copilot.cargo_capacity_init': 'Capacidade de carga: - T',
            'copilot.waiting_events': 'Aguardando eventos...',
            'copilot.event_prefix': 'Evento: {0}',
            'copilot.no_log': 'Sem log',
            'copilot.ship_default': 'Nave',
            'copilot.jump_detected': 'Novo salto detectado!',
            'copilot.jump_body': 'O comandante entrou no sistema {0}. Atualizando cotações de ida...',
            'copilot.auto_refresh': 'Auto-Atualizar ao Mudar de Sistema',
            'copilot.auto_refresh_title': 'Atualiza o mercado automaticamente ao detectar salto FSD no Journal',
            'copilot.max_dist': 'Dist. Máx (Ly):',
            'copilot.pad': 'Pad:',
            'copilot.pad_any': 'Qualquer / L',
            'copilot.pad_med': 'Médio (M)',
            'copilot.pad_small': 'Pequeno (S)',
            'copilot.simulate_jump': '🧪 Simular Salto',
            'copilot.simulate_title': 'Testar mudança de sistema manualmente',
            'copilot.simulate_prompt': 'Digite o nome do sistema estelar para simular salto (ex: Sol, Shinrarta Dezhra, Gendalla):',
            'copilot.simulate_ok': 'Salto simulado para {0}!',
            'copilot.simulate_err': 'Erro ao simular: {0}',
            'copilot.refresh_quotes': 'Atualizar Cotações',
            'copilot.searching': 'Buscando...',
            'copilot.outbound_opps': 'Oportunidades de Ida:',
            'copilot.last_search': 'Última busca:',
            'copilot.view_inara': 'Ver busca no Inara ↗',
            'copilot.filter_placeholder': 'Filtrar por produto, estação ou destino...',
            'copilot.sort_profit': 'Ordenar: Maior Lucro',
            'copilot.sort_distance': 'Ordenar: Menor Distância (Ly)',
            'copilot.sort_station_dist': 'Ordenar: Menor Distância da Estação (Ls)',
            'copilot.empty_title': 'Nenhuma oportunidade de venda de ida encontrada',
            'copilot.empty_desc': 'Verifique os filtros ou tente aumentar a distância máxima de busca (Ly).',
            'copilot.commodity': 'Mercadoria',
            'copilot.per_ton': '/ tonelada ({0}T)',
            'copilot.buy_origin': '1. Comprar na Origem ({0})',
            'copilot.sell_dest': '2. Vender no Destino',
            'copilot.station_dist': 'Dist. Estação:',
            'copilot.supply': 'Estoque:',
            'copilot.demand': 'Demanda:',
            'copilot.jump_dist': 'Distância do Salto:',
            'copilot.dest_station': 'Estação de Destino:',
            'copilot.fetch_error': 'Falha ao consultar cotações: {0}',
            'copilot.copied': 'Sistema "{0}" copiado!',

            'trade.page_title': 'Elite Explorer Copilot - Rotas de Mercado & Cotações',
            'trade.subtitle': 'Cotações e Rotas de Mercado Otimizadas (Via Inara API/Scraper)',
            'trade.center_system': 'Sistema de Centro da Busca (Origem)',
            'trade.center_placeholder': 'Ex: Sol, Shinrarta Dezhra...',
            'trade.ship_cargo': 'Carga da Nave (T)',
            'trade.max_dist': 'Distância Máx. (Ly)',
            'trade.pad_size': 'Pad de Pouso',
            'trade.pad_any': 'Qualquer / Grande (L)',
            'trade.max_age': 'Idade Máx. Dados',
            'trade.hours_24': '24 horas',
            'trade.hours_48': '48 horas',
            'trade.hours_72': '72 horas',
            'trade.days_7': '7 dias',
            'trade.btn_refresh': 'Atualizar',
            'trade.consulting': 'Consultando...',
            'trade.routes_found': 'Rotas Encontradas:',
            'trade.filter_placeholder': 'Filtrar por estação, sistema ou mercadoria...',
            'trade.sort_trip': 'Ordenar: Maior Lucro / Viagem',
            'trade.sort_unit': 'Ordenar: Maior Lucro / Unidade',
            'trade.sort_hour': 'Ordenar: Maior Lucro / Hora',
            'trade.sort_route_dist': 'Ordenar: Menor Distância da Rota',
            'trade.sort_center_dist': 'Ordenar: Mais Próximo do Centro',
            'trade.empty_title': 'Nenhuma rota encontrada',
            'trade.empty_desc': 'Verifique os filtros de pesquisa ou aumente a distância máxima de salto.',
            'trade.from_label': 'Origem (From)',
            'trade.to_label': 'Destino (To)',
            'trade.station_dist_label': 'Distância da estação:',
            'trade.profit_trip': 'Lucro por Viagem',
            'trade.outbound_leg': 'Ida ➔ {0}',
            'trade.inbound_leg': 'Volta ➔ {0}',
            'trade.buy_origin': 'Compra (Origem)',
            'trade.sell_dest': 'Venda (Destino)',
            'trade.buy_dest': 'Compra (Destino)',
            'trade.sell_origin': 'Venda (Origem)',
            'trade.supply': 'Oferta (Supply):',
            'trade.demand': 'Demanda:',
            'trade.route_dist': 'Distância da Rota',
            'trade.center_dist': 'Dist. do Centro',
            'trade.margin': 'Margem',
            'trade.updated': 'Atualizado',
            'trade.profit_unit': 'Lucro por Unidade',
            'trade.profit_hour': 'Lucro por Hora',
            'trade.fetch_error': 'Falha na consulta: {0}',

            // Mercado Single-Hop
            'market.page_title': 'Elite Explorer Copilot - Mercado Single-Hop',
            'market.subtitle': 'Top 20 oportunidades de mercado single-hop da galáxia (≤ 25 Ly) com cálculo de lucro em tempo real para sua nave',
            'market.commander': 'Comandante:',
            'market.current_ship': 'Nave:',
            'market.current_system': 'Sistema:',
            'market.calc_cargo': 'Carga (T):',
            'market.source_label': 'Origem:',
            'market.refresh_btn': 'Atualizar',
            'market.loading': 'Aguarde... Carregando oportunidades de mercado da galáxia...',
            'market.no_data': 'Nenhuma oportunidade comercial detectada no momento.',
            'market.copied_sys': 'copiado para a área de transferência!'
        },

        en: {
            // Common Navigation & Sidebar
            'nav.menu_btn': 'MENU',
            'nav.menu_title': 'Copilot Menu',
            'nav.close_menu': 'Close Menu',
            'nav.cmdr': 'COMMANDER',
            'nav.system_label': 'CURRENT SYSTEM',
            'nav.navigation_title': 'NAVIGATION',
            'nav.language_title': 'LANGUAGE',
            'nav.desc_galaxy': '3D star exploration & route',
            'nav.desc_orrery': 'Orbits & celestial bodies',
            'nav.desc_surface': 'Tactical surface HUD & biology',
            'nav.desc_market': 'Top 20 galaxy trade routes',
            'nav.status_online': 'ONLINE',
            'nav.status_offline': 'OFFLINE',
            'nav.galaxy_cube': 'Galactic Cube',
            'nav.galaxy_cube_3d': '3D Galactic Cube',
            'nav.system': 'System',
            'nav.system_orrery': '3D System (Orrery)',
            'nav.surface': 'Surface',
            'nav.market': 'Single-Hop Market',
            'nav.system_title': 'Open the 3D Star System Map',
            'nav.surface_disabled_title': 'Available only when the ship is in orbit or on a planet surface',
            'nav.surface_active_title': 'Ship orbiting/landed on {0} - Click to open Surface HUD',
            'nav.orrery_surface_title': 'Ship at {0} - Click to open Surface View',

            'splash.subtitle': 'GALACTIC NAVIGATION • SYSTEM • SURFACE',
            'splash.commander_label': 'COMMANDER',
            'splash.connecting': 'CONNECTING TO FLIGHT JOURNAL...',
            'splash.ready': 'SYSTEMS ONLINE • SYNCING TELEMETRY',

            'galaxy.syncing_journal': 'Syncing with Journal...',
            'galaxy.loading_default': 'Please wait... Loading stellar data',
            'galaxy.loading_mapping': 'Please wait... Mapping and triangulating star sector',
            'galaxy.edsm_connecting': '🛰️ EDSM: Connecting...',
            'galaxy.edsm_not_configured': 'Not configured',
            'galaxy.edsm_disabled': 'Disabled',
            'galaxy.edsm_conn_failed': 'Connection failed',
            'galaxy.edsm_net_error': 'Network upload error',
            'galaxy.edsm_connected': 'Connected (CMDR {0})',
            'galaxy.edsm_sent': '{0} Uploads',
            'galaxy.edsm_title': 'Continuous telemetry and discovery sync to EDSM',
            'galaxy.cmdr_unknown': 'Unknown',
            'galaxy.commander_fallback': 'Commander',
            'galaxy.system_label': 'System',
            'galaxy.target_pinned': 'PINNED TARGET',
            'galaxy.system_selected': 'SELECTED SYSTEM',
            'galaxy.close': 'Close',
            'galaxy.safe_docking': '⚓ SAFE DOCKING',
            'galaxy.current_system': 'Current System',
            'galaxy.docks_count': '{0} docks',
            'galaxy.docks_orbital_count': '{0} orbital',
            'galaxy.querying_stations': 'Querying system stations...',
            'galaxy.waiting_journal_signal': 'Waiting for Journal signal...',
            'galaxy.no_orbital_stations': '🌌 No orbital stations cataloged in this system.',
            'galaxy.deep_space_no_docks': 'Deep Space / No Orbital Docks',
            'galaxy.orbit_prefix': 'Orbit: {0}',
            'galaxy.orbital_station_fallback': 'Orbital Station',
            'galaxy.star_filter': 'STAR FILTER',
            'galaxy.filter_all': '🌐 All',
            'galaxy.filter_inhabited': '🏙️ Inhabited Only',
            'galaxy.filter_toggle_title': 'Toggle between all star systems or inhabited only',
            'galaxy.top3_stratum': '🪐 TOP 3 NEARBY STRATUM',
            'galaxy.top3_gaps': '👻 TOP 3 PROCEDURAL GAPS',
            'galaxy.traffic_title': '🛰️ COMMANDER TRAFFIC',
            'galaxy.traffic_live': 'LIVE',
            'galaxy.traffic_sound_on': 'Traffic audio alerts enabled (click to mute)',
            'galaxy.traffic_sound_off': 'Traffic audio alerts muted (click to enable)',
            'galaxy.traffic_online_estimate': 'About {0} commanders online in the region',
            'galaxy.in_cube': '{0} in cube',
            'galaxy.scanning_surroundings': 'Scanning surroundings...',
            'galaxy.scanning_bodies': 'Scanning nearby celestial bodies...',
            'galaxy.scanning_voids': 'Scanning voids...',
            'galaxy.no_gaps_detected': 'No gaps detected',
            'galaxy.waiting_sector_traffic': 'Waiting for sector traffic...',
            'galaxy.legend_current': 'Current Location',
            'galaxy.legend_kgbfoam': 'KGBFOAM Stars',
            'galaxy.legend_other': 'Other Stars',
            'galaxy.legend_gap': 'Likely Procedural Gap',
            'galaxy.legend_stratum_conf': 'Confirmed Stratum',
            'galaxy.legend_stratum_pot': 'Likely Stratum',
            'galaxy.edsm_error': 'Failed to load EDSM data',
            'galaxy.stats_central': 'Central System',
            'galaxy.stats_cube': 'Cube',
            'galaxy.stats_known': 'Known Systems',
            'galaxy.stats_gaps': 'Procedural Gaps',
            'galaxy.source_cache': '● Source: Local cache (0 EDSM reqs)',
            'galaxy.source_edsm': '● Source: EDSM (saved to cache)',
            'galaxy.source_stale': '⚠ Previous cache (EDSM offline)',
            'galaxy.source_local': '⚠ EDSM failed — local systems only',
            'galaxy.btn_refresh': 'Refresh',
            'galaxy.btn_retry': 'Retry',
            'galaxy.confirmed_presence': '✔ Confirmed Presence',
            'galaxy.potential_first': '🪐 Unmapped Potential (1st)',
            'galaxy.confirmed_badge': '✔ Confirmed',
            'galaxy.potential_badge': '🪐 Unmapped (1st)',
            'galaxy.already_collected': '🚫 COLLECTED',
            'galaxy.already_landed': '👣 LANDED',
            'galaxy.already_landed_card': '👣 Already landed',
            'galaxy.collected_tooltip': 'Stratum already collected on this planet on {0}',
            'galaxy.landed_tooltip': 'Already landed on {0}',
            'galaxy.potential_tooltip': '100% compatible with Stratum, not yet mapped on Spansh (5x First Discovery bonus: ~95M cr!)',
            'galaxy.first_badge_title': 'No prior discovery record on EDSM',
            'galaxy.never_mapped': 'NEVER MAPPED',
            'galaxy.never_mapped_title': 'Celestial body never mapped by any Commander',
            'galaxy.thin_atmosphere': 'Thin Atmosphere',
            'galaxy.stratum_planet': 'Stratum Candidate Planet',
            'galaxy.distance': 'Distance',
            'galaxy.distance_ship': 'Distance from Ship',
            'galaxy.distance_your_ship': 'Distance from Your Ship',
            'galaxy.bodies_label': 'Bodies',
            'galaxy.celestial_bodies_label': 'Celestial Bodies',
            'galaxy.population_label': 'Population',
            'galaxy.inhabitants': 'inhabitants',
            'galaxy.inhabited_pop': '● Inhabited (Pop: {0})',
            'galaxy.copy': '📋 Copy',
            'galaxy.system_3d': '🪐 3D System',
            'galaxy.void_badge': 'UNCATALOGED SYSTEM (PROCEDURAL GAP)',
            'galaxy.void_tooltip_title': '👻 UNCATALOGED SYSTEM (PROCEDURAL GAP)',
            'galaxy.void_certainty': 'Math Certainty',
            'galaxy.void_certainty_val': '100% in Stellar Forge',
            'galaxy.void_subblock': 'Sub-block',
            'galaxy.void_mass': 'Mass {0} (Accuracy: ±{1} ly)',
            'galaxy.void_mass_class': 'Mass Class',
            'galaxy.void_spatial_acc': 'Spatial accuracy: ±{0} ly',
            'galaxy.void_est_dist': 'Estimated distance',
            'galaxy.void_known_siblings': 'Known siblings',
            'galaxy.void_suggested_jump': '🎯 SUGGESTED JUMP (Known Sibling):',
            'galaxy.void_no_nearby_star': 'No nearby cataloged star',
            'galaxy.void_no_edge_system': 'No cataloged edge system',
            'galaxy.void_to_target': 'From Waypoint to Target',
            'galaxy.jump_ref': 'Jump ref:',
            'galaxy.none_nearby': 'None nearby',
            'galaxy.cmdr_arrived': 'A Commander arrived in:',
            'galaxy.cmdr_departed': 'A Commander departed from:',
            'galaxy.focus_system_title': 'Click to focus on system {0}',
            'galaxy.time_now': 'now',
            'galaxy.time_s': '{0}s ago',
            'galaxy.time_m': '{0}m ago',
            'galaxy.time_h': '{0}h ago',
            'galaxy.on_date': ' on {0}',

            'surface.zoom_global': '🌐 Global (-180°/+180°)',
            'surface.zoom_tactical': '🎯 Tactical (1,200m)',
            'surface.zoom_auto': '🔄 Auto (Altitude)',
            'surface.recenter_ship': '📍 Center Ship',
            'surface.recenter_ship_title': 'Re-align and focus camera on ship/pilot position',
            'surface.body_label': '🪐 CELESTIAL BODY',
            'surface.gravity_label': '⚖️ GRAVITY',
            'surface.compass_label': '🧭 COMPASS / HEADING',
            'surface.atmosphere_label': '💨 ATMOSPHERE',
            'surface.pressure_label': '🌡️ PRESSURE',
            'surface.altimeter_title': '📐 ALTIMETER & TELEMETRY',
            'surface.altitude_label': 'Altitude:',
            'surface.state_landed_srv': 'SRV ON SURFACE',
            'surface.state_landed_foot': 'PILOT ON FOOT',
            'surface.state_landed_ship': 'SHIP LANDED',
            'surface.state_glide': 'ORBITAL GLIDE',
            'surface.state_flight': 'ATMOSPHERIC FLIGHT',
            'surface.gps_title': 'GPS COORDINATES',
            'surface.lat_label': 'Latitude:',
            'surface.lon_label': 'Longitude:',
            'surface.touchdown_title': 'TOUCHDOWN SITE',
            'surface.coords_label': 'Coordinates:',
            'surface.ship_dist_label': 'Distance from Ship:',
            'surface.waiting_body': 'Waiting for body...',
            'surface.no_atmosphere': 'No atmosphere',
            'surface.bio_title': '🧬 EXOBIOLOGY ODOMETER',
            'surface.bio_sample_1': 'SAMPLE 1',
            'surface.bio_sample_2': 'SAMPLE 2',
            'surface.bio_sample_3': 'SAMPLE 3',
            'surface.bio_collected': 'COLLECTED',
            'surface.bio_pending': 'PENDING',
            'surface.ship_parked': '🚀 PARKED SHIP',
            'surface.bio_sample_default': 'Sample',
            'surface.bio_species_label': 'ACTIVE SPECIES',
            'surface.bio_waiting_sample': 'Waiting for sample...',
            'surface.bio_dist_label': 'Sample Distance:',
            'surface.bio_waiting_scan': 'Waiting for initial scan...',
            'surface.bio_completed': 'COMPLETE',
            'surface.bio_success_banner': '🎉 SPECIES ANALYSIS COMPLETE',
            'surface.bio_ready_banner': '✅ DIVERSITY REACHED ({0}m) • READY FOR SAMPLE #{1}',
            'surface.bio_inside_banner': '⚠️ INSIDE COLONY RADIUS ({0}m) • {1}m remaining',
            'surface.bio_leaving_area_voice': 'Leaving sample area',
            'surface.legend_current_pos': 'Current Pos',
            'surface.legend_ship': 'Ship',
            'surface.legend_colony': 'Colony',
            'surface.legend_extraction': 'Extraction',
            'surface.legend_wreckage': 'Wreckage',
            'surface.legend_research': 'Research',
            'surface.legend_geological': 'Geological',
            'surface.legend_ruin': 'Ruin / Lore',
            'surface.legend_bio': 'Bio-Sample',
            'surface.legend_colony_radius': 'Colony Radius',

            'orrery.title': 'Elite Explorer Copilot - 3D System (Orrery)',
            'orrery.loading_orbital': 'Loading system orbital mechanics...',
            'orrery.loading_system': 'Fetching orbits and telemetry for {0}...',
            'orrery.load_failed': 'Failed to load system: {0}',
            'orrery.system_badge': 'SYSTEM:',
            'orrery.loading_short': 'Loading...',
            'orrery.bodies_count': '{0} bodies',
            'orrery.bodies_unmapped': '0 bodies (Unmapped)',
            'orrery.unmapped_msg': '⚠️ <b>{0}</b> is not cataloged on EDSM.<br><span style="color:#00d4ff; font-size:13px; font-weight:normal;">Use the in-game FSS Scanner to map and reveal bodies in real time!</span>',
            'orrery.btn_reset_view': '🔭 Fit All',
            'orrery.btn_reset_title': 'Panoramic System View',
            'orrery.btn_focus_star': '☀️ Star',
            'orrery.btn_focus_title': 'Focus Primary Star',
            'orrery.legend_title': '🪐 SYSTEM LEGEND',
            'orrery.legend_stars': 'Stars (KGBFOAM)',
            'orrery.legend_hmc': 'High Metal Content / Rocky',
            'orrery.legend_metal_rich': 'Metal-Rich Body',
            'orrery.legend_water': 'Water World',
            'orrery.legend_icy': 'Icy Body',
            'orrery.legend_gas': 'Gas Giant',
            'orrery.legend_belt': 'Asteroid Belt Cluster',
            'orrery.legend_landable': 'Landable with Ship / SRV',
            'orrery.tree_title': '🪐 CELESTIAL BODIES',
            'orrery.tree_placeholder': 'Filter by name or class...',
            'orrery.badge_planet': 'PLANET',
            'orrery.badge_belt': 'ASTEROID CLUSTER',
            'orrery.landable_yes': '🟢 LANDABLE WITH SHIP / SRV',
            'orrery.landable_no': '🔴 NOT LANDABLE',
            'orrery.landable_belt': '⛏️ VACUUM MINING (Laser / Core)',
            'orrery.landable_tooltip': ' • <span style="color:#2bfca8;font-weight:bold;">🟢 LANDABLE</span>',
            'orrery.mining_tooltip': '⛏️ Mining',
            'orrery.orbital_section': 'ORBITAL MECHANICS',
            'orrery.dist_arrival': 'Arrival Distance:',
            'orrery.semi_major': 'Semi-Major Axis:',
            'orrery.orbital_period': 'Orbital Period:',
            'orrery.eccentricity': 'Eccentricity:',
            'orrery.inclination': 'Orbital Inclination:',
            'orrery.physical_section': 'PHYSICAL PROPERTIES',
            'orrery.radius': 'Radius:',
            'orrery.gravity': 'Gravity:',
            'orrery.mass': 'Mass:',
            'orrery.temperature': 'Surface Temperature:',
            'orrery.atmosphere': 'Atmosphere:',
            'orrery.pressure': 'Pressure:',
            'orrery.signals_section': 'DETECTED SIGNALS (DSS)',
            'orrery.materials_section': 'SURFACE MATERIALS',
            'orrery.days_unit': '{0} days',
            'orrery.vacuum': 'Space Vacuum',
            'orrery.no_atmo': 'Vacuum / No atmosphere',
            'orrery.rocky_cluster': 'Rocky Cluster',
            'orrery.microgravity': '0.00 G (Microgravity)',
            'orrery.star_class': 'Class {0}',

            'copilot.page_title': 'Elite Explorer Copilot - Live Copilot',
            'copilot.title_prefix': 'Flight Deck',
            'copilot.subtitle': 'Real-Time Flight Monitoring & Outbound Trade Quotes',
            'copilot.journal_connecting': 'Connecting to Journal...',
            'copilot.journal_active': 'Journal Active: {0}',
            'copilot.journal_waiting': 'Waiting for Journal File...',
            'copilot.label_commander': 'Commander',
            'copilot.label_current_system': 'Current System (Origin)',
            'copilot.label_ship_cargo': 'Active Ship & Cargo',
            'copilot.label_flight_status': 'Flight Status',
            'copilot.reading_log': 'Reading log...',
            'copilot.in_hyperspace': 'In hyperspace',
            'copilot.in_supercruise': 'In Space / Supercruise',
            'copilot.docked_at': 'Docked: {0}',
            'copilot.docked_station': 'Docked at Station',
            'copilot.flying_system': 'Flying in System',
            'copilot.cargo_capacity': 'Cargo capacity: {0} T',
            'copilot.cargo_capacity_init': 'Cargo capacity: - T',
            'copilot.waiting_events': 'Waiting for events...',
            'copilot.event_prefix': 'Event: {0}',
            'copilot.no_log': 'No log',
            'copilot.ship_default': 'Ship',
            'copilot.jump_detected': 'New jump detected!',
            'copilot.jump_body': 'Commander entered system {0}. Refreshing outbound trade quotes...',
            'copilot.auto_refresh': 'Auto-Refresh on System Change',
            'copilot.auto_refresh_title': 'Automatically refreshes market quotes when an FSD jump is detected in the Journal',
            'copilot.max_dist': 'Max Dist (Ly):',
            'copilot.pad': 'Pad:',
            'copilot.pad_any': 'Any / L',
            'copilot.pad_med': 'Medium (M)',
            'copilot.pad_small': 'Small (S)',
            'copilot.simulate_jump': '🧪 Simulate Jump',
            'copilot.simulate_title': 'Manually test a system change',
            'copilot.simulate_prompt': 'Enter star system name to simulate jump (e.g. Sol, Shinrarta Dezhra, Gendalla):',
            'copilot.simulate_ok': 'Simulated jump to {0}!',
            'copilot.simulate_err': 'Simulation error: {0}',
            'copilot.refresh_quotes': 'Refresh Quotes',
            'copilot.searching': 'Searching...',
            'copilot.outbound_opps': 'Outbound Opportunities:',
            'copilot.last_search': 'Last updated:',
            'copilot.view_inara': 'View search on Inara ↗',
            'copilot.filter_placeholder': 'Filter by commodity, station or destination...',
            'copilot.sort_profit': 'Sort: Highest Profit',
            'copilot.sort_distance': 'Sort: Shortest Distance (Ly)',
            'copilot.sort_station_dist': 'Sort: Nearest Station (Ls)',
            'copilot.empty_title': 'No outbound trade opportunities found',
            'copilot.empty_desc': 'Check your filters or increase the maximum search distance (Ly).',
            'copilot.commodity': 'Commodity',
            'copilot.per_ton': '/ ton ({0}T)',
            'copilot.buy_origin': '1. Buy at Origin ({0})',
            'copilot.sell_dest': '2. Sell at Destination',
            'copilot.station_dist': 'Station Dist:',
            'copilot.supply': 'Supply:',
            'copilot.demand': 'Demand:',
            'copilot.jump_dist': 'Jump Distance:',
            'copilot.dest_station': 'Destination Station:',
            'copilot.fetch_error': 'Failed to fetch quotes: {0}',
            'copilot.copied': 'System "{0}" copied!',

            'trade.page_title': 'Elite Explorer Copilot - Market Routes & Quotes',
            'trade.subtitle': 'Optimized Market Routes & Quotes (via Inara)',
            'trade.center_system': 'Search Center System (Origin)',
            'trade.center_placeholder': 'E.g.: Sol, Shinrarta Dezhra...',
            'trade.ship_cargo': 'Ship Cargo (T)',
            'trade.max_dist': 'Max Distance (Ly)',
            'trade.pad_size': 'Landing Pad',
            'trade.pad_any': 'Any / Large (L)',
            'trade.max_age': 'Max Data Age',
            'trade.hours_24': '24 hours',
            'trade.hours_48': '48 hours',
            'trade.hours_72': '72 hours',
            'trade.days_7': '7 days',
            'trade.btn_refresh': 'Refresh',
            'trade.consulting': 'Querying...',
            'trade.routes_found': 'Routes Found:',
            'trade.filter_placeholder': 'Filter by station, system or commodity...',
            'trade.sort_trip': 'Sort: Highest Profit / Trip',
            'trade.sort_unit': 'Sort: Highest Profit / Unit',
            'trade.sort_hour': 'Sort: Highest Profit / Hour',
            'trade.sort_route_dist': 'Sort: Shortest Route Distance',
            'trade.sort_center_dist': 'Sort: Closest to Center',
            'trade.empty_title': 'No routes found',
            'trade.empty_desc': 'Check search filters or increase the maximum jump distance.',
            'trade.from_label': 'Origin (From)',
            'trade.to_label': 'Destination (To)',
            'trade.station_dist_label': 'Station distance:',
            'trade.profit_trip': 'Profit per Trip',
            'trade.outbound_leg': 'Outbound ➔ {0}',
            'trade.inbound_leg': 'Return ➔ {0}',
            'trade.buy_origin': 'Buy (Origin)',
            'trade.sell_dest': 'Sell (Destination)',
            'trade.buy_dest': 'Buy (Destination)',
            'trade.sell_origin': 'Sell (Origin)',
            'trade.supply': 'Supply:',
            'trade.demand': 'Demand:',
            'trade.route_dist': 'Route Distance',
            'trade.center_dist': 'Dist. from Center',
            'trade.margin': 'Margin',
            'trade.updated': 'Updated',
            'trade.profit_unit': 'Profit per Unit',
            'trade.profit_hour': 'Profit per Hour',
            'trade.fetch_error': 'Query failed: {0}',

            // Single-Hop Market
            'market.page_title': 'Elite Explorer Copilot - Single-Hop Market',
            'market.subtitle': 'Top 20 galactic single-hop trade opportunities (≤ 25 Ly) with real-time ship profit calculation',
            'market.commander': 'Commander:',
            'market.current_ship': 'Ship:',
            'market.current_system': 'System:',
            'market.calc_cargo': 'Cargo (T):',
            'market.source_label': 'Source:',
            'market.refresh_btn': 'Refresh',
            'market.loading': 'Please wait... Loading galactic market opportunities...',
            'market.no_data': 'No trade opportunities currently detected.',
            'market.copied_sys': 'copied to clipboard!'
        },

        es: {
            // Navegación común & Sidebar
            'nav.menu_btn': 'MENÚ',
            'nav.menu_title': 'Menú del Copilot',
            'nav.close_menu': 'Cerrar Menú',
            'nav.cmdr': 'COMANDANTE',
            'nav.system_label': 'SISTEMA ACTUAL',
            'nav.navigation_title': 'NAVEGACIÓN',
            'nav.language_title': 'IDIOMA / LANGUAGE',
            'nav.desc_galaxy': 'Exploración 3D y ruta estelar',
            'nav.desc_orrery': 'Órbitas y cuerpos celestes',
            'nav.desc_surface': 'HUD táctico de superficie y biología',
            'nav.desc_market': 'Top 20 rutas comerciales de la galaxia',
            'nav.status_online': 'EN LÍNEA',
            'nav.status_offline': 'DESCONECTADO',
            'nav.galaxy_cube': 'Cubo Galáctico',
            'nav.galaxy_cube_3d': 'Cubo Galáctico 3D',
            'nav.system': 'Sistema',
            'nav.system_orrery': 'Sistema 3D (Orrery)',
            'nav.surface': 'Superficie',
            'nav.market': 'Mercado Single-Hop',
            'nav.system_title': 'Abrir el Mapa 3D del Sistema Estelar',
            'nav.surface_disabled_title': 'Disponible solo cuando la nave está en órbita o en la superficie de un planeta',
            'nav.surface_active_title': 'Nave en órbita/superficie de {0} - Clic para abrir el HUD de Superficie',
            'nav.orrery_surface_title': 'Nave en {0} - Clic para abrir la Vista de Superficie',

            'splash.subtitle': 'NAVEGACIÓN GALÁCTICA • SISTEMA • SUPERFICIE',
            'splash.commander_label': 'COMANDANTE',
            'splash.connecting': 'CONECTANDO AL DIARIO DE VUELO...',
            'splash.ready': 'SISTEMAS LISTOS • SINCRONIZANDO TELEMETRÍA',

            'galaxy.syncing_journal': 'Sincronizando con Journal...',
            'galaxy.loading_default': 'Espere... Cargando datos estelares',
            'galaxy.loading_mapping': 'Espere... Mapeando y triangulando sector estelar',
            'galaxy.edsm_connecting': '🛰️ EDSM: Conectando...',
            'galaxy.edsm_not_configured': 'No configurado',
            'galaxy.edsm_disabled': 'Desactivado',
            'galaxy.edsm_conn_failed': 'Fallo de conexión',
            'galaxy.edsm_net_error': 'Error de red al enviar',
            'galaxy.edsm_connected': 'Conectado (CMDR {0})',
            'galaxy.edsm_sent': '{0} Envíos',
            'galaxy.edsm_title': 'Transmisión continua de telemetría y descubrimientos a EDSM',
            'galaxy.cmdr_unknown': 'Desconocido',
            'galaxy.commander_fallback': 'Comandante',
            'galaxy.system_label': 'Sistema',
            'galaxy.target_pinned': 'OBJETIVO FIJADO',
            'galaxy.system_selected': 'SISTEMA SELECCIONADO',
            'galaxy.close': 'Cerrar',
            'galaxy.safe_docking': '⚓ ATRAQUE SEGURO',
            'galaxy.current_system': 'Sistema Actual',
            'galaxy.docks_count': '{0} muelles',
            'galaxy.docks_orbital_count': '{0} orbitales',
            'galaxy.querying_stations': 'Consultando estaciones del sistema...',
            'galaxy.waiting_journal_signal': 'Esperando señal del Journal...',
            'galaxy.no_orbital_stations': '🌌 Ninguna estación orbital catalogada en este sistema.',
            'galaxy.deep_space_no_docks': 'Espacio Profundo / Sin Muelles Espaciales',
            'galaxy.orbit_prefix': 'Órbita: {0}',
            'galaxy.orbital_station_fallback': 'Estación Orbital',
            'galaxy.star_filter': 'FILTRO ESTELAR',
            'galaxy.filter_all': '🌐 Todos',
            'galaxy.filter_inhabited': '🏙️ Solo Habitados',
            'galaxy.filter_toggle_title': 'Alternar entre mostrar todos los sistemas o solo habitados',
            'galaxy.top3_stratum': '🪐 TOP 3 STRATUM CERCANOS',
            'galaxy.top3_gaps': '👻 TOP 3 BRECHAS PROCEDURALES',
            'galaxy.traffic_title': '🛰️ TRÁFICO DE COMANDANTES',
            'galaxy.traffic_live': 'EN VIVO',
            'galaxy.traffic_sound_on': 'Alertas de audio de tráfico activadas (clic para silenciar)',
            'galaxy.traffic_sound_off': 'Alertas de audio de tráfico silenciadas (clic para activar)',
            'galaxy.traffic_online_estimate': 'Cerca de {0} comandantes en línea en la región',
            'galaxy.in_cube': '{0} en el cubo',
            'galaxy.scanning_surroundings': 'Escaneando alrededores...',
            'galaxy.scanning_bodies': 'Escaneando cuerpos celestes cercanos...',
            'galaxy.scanning_voids': 'Escaneando vacíos...',
            'galaxy.no_gaps_detected': 'Ninguna brecha detectada',
            'galaxy.waiting_sector_traffic': 'Esperando tráfico en el sector...',
            'galaxy.legend_current': 'Ubicación Actual',
            'galaxy.legend_kgbfoam': 'Estrellas KGBFOAM',
            'galaxy.legend_other': 'Otras Estrellas',
            'galaxy.legend_gap': 'Posible Brecha Procedural',
            'galaxy.legend_stratum_conf': 'Stratum Confirmado',
            'galaxy.legend_stratum_pot': 'Stratum Probable',
            'galaxy.edsm_error': 'Error al cargar datos de EDSM',
            'galaxy.stats_central': 'Sistema Central',
            'galaxy.stats_cube': 'Cubo',
            'galaxy.stats_known': 'Sistemas Conocidos',
            'galaxy.stats_gaps': 'Brechas Procedurales',
            'galaxy.source_cache': '● Fuente: Caché local (0 reqs EDSM)',
            'galaxy.source_edsm': '● Fuente: EDSM (guardado en caché)',
            'galaxy.source_stale': '⚠ Caché previa (EDSM sin conexión)',
            'galaxy.source_local': '⚠ EDSM falló — solo sistemas locales',
            'galaxy.btn_refresh': 'Actualizar',
            'galaxy.btn_retry': 'Reintentar',
            'galaxy.confirmed_presence': '✔ Presencia Confirmada',
            'galaxy.potential_first': '🪐 Potencial Inédito (1st)',
            'galaxy.confirmed_badge': '✔ Confirmado',
            'galaxy.potential_badge': '🪐 Inédito (1st)',
            'galaxy.already_collected': '🚫 YA RECOLECTADO',
            'galaxy.already_landed': '👣 YA ATERRIZADO',
            'galaxy.already_landed_card': '👣 Aterrizaje ya realizado',
            'galaxy.collected_tooltip': 'Stratum ya recolectado en este planeta el {0}',
            'galaxy.landed_tooltip': 'Aterrizaje ya realizado el {0}',
            'galaxy.potential_tooltip': '100% compatible con Stratum, aún sin mapear en Spansh (Bono 5x First Discovery: ~95M cr!)',
            'galaxy.first_badge_title': 'Sin registro previo de descubrimiento en EDSM',
            'galaxy.never_mapped': 'NUNCA MAPEADO',
            'galaxy.never_mapped_title': 'Cuerpo celeste nunca mapeado por ningún Comandante',
            'galaxy.thin_atmosphere': 'Atmósfera Tenue',
            'galaxy.stratum_planet': 'Planeta con Stratum',
            'galaxy.distance': 'Distancia',
            'galaxy.distance_ship': 'Distancia desde la Nave',
            'galaxy.distance_your_ship': 'Distancia desde tu Nave',
            'galaxy.bodies_label': 'Cuerpos',
            'galaxy.celestial_bodies_label': 'Cuerpos Celestes',
            'galaxy.population_label': 'Población',
            'galaxy.inhabitants': 'habitantes',
            'galaxy.inhabited_pop': '● Habitado (Pob: {0})',
            'galaxy.copy': '📋 Copiar',
            'galaxy.system_3d': '🪐 Sistema 3D',
            'galaxy.void_badge': 'SISTEMA INÉDITO (BRECHA PROCEDURAL)',
            'galaxy.void_tooltip_title': '👻 SISTEMA NO CATALOGADO (BRECHA PROCEDURAL)',
            'galaxy.void_certainty': 'Certeza Matemática',
            'galaxy.void_certainty_val': '100% en Stellar Forge',
            'galaxy.void_subblock': 'Sub-bloque',
            'galaxy.void_mass': 'Masa {0} (Precisión: ±{1} ly)',
            'galaxy.void_mass_class': 'Clase de Masa',
            'galaxy.void_spatial_acc': 'Precisión espacial: ±{0} ly',
            'galaxy.void_est_dist': 'Distancia estimada',
            'galaxy.void_known_siblings': 'Hermanos conocidos',
            'galaxy.void_suggested_jump': '🎯 SALTO SUGERIDO (Hermano Conocido):',
            'galaxy.void_no_nearby_star': 'Sin estrella cercana catalogada',
            'galaxy.void_no_edge_system': 'Ningún sistema catalogado en el borde',
            'galaxy.void_to_target': 'Del Waypoint al Objetivo',
            'galaxy.jump_ref': 'Salto ref:',
            'galaxy.none_nearby': 'Ninguno cercano',
            'galaxy.cmdr_arrived': 'Un Comandante llegó al sistema:',
            'galaxy.cmdr_departed': 'Un Comandante dejó el sistema:',
            'galaxy.focus_system_title': 'Clic para enfocar el sistema {0}',
            'galaxy.time_now': 'ahora',
            'galaxy.time_s': 'hace {0}s',
            'galaxy.time_m': 'hace {0}m',
            'galaxy.time_h': 'hace {0}h',
            'galaxy.on_date': ' el {0}',

            'surface.zoom_global': '🌐 Global (-180°/+180°)',
            'surface.zoom_tactical': '🎯 Táctico (1.200m)',
            'surface.zoom_auto': '🔄 Auto (Altitud)',
            'surface.recenter_ship': '📍 Centrar Nave',
            'surface.recenter_ship_title': 'Realinear y enfocar la cámara en la posición de la nave/piloto',
            'surface.body_label': '🪐 CUERPO CELESTE',
            'surface.gravity_label': '⚖️ GRAVEDAD',
            'surface.compass_label': '🧭 BRÚJULA / RUMBO',
            'surface.atmosphere_label': '💨 ATMÓSFERA',
            'surface.pressure_label': '🌡️ PRESIÓN',
            'surface.altimeter_title': '📐 ALTÍMETRO Y TELEMETRÍA',
            'surface.altitude_label': 'Altitud:',
            'surface.state_landed_srv': 'SRV EN SUPERFICIE',
            'surface.state_landed_foot': 'PILOTO A PIE',
            'surface.state_landed_ship': 'NAVE ATERRIZADA',
            'surface.state_glide': 'VUELO EN GLIDE ORBITAL',
            'surface.state_flight': 'EN VUELO ATMOSFÉRICO',
            'surface.gps_title': 'COORDENADAS GPS',
            'surface.lat_label': 'Latitud:',
            'surface.lon_label': 'Longitud:',
            'surface.touchdown_title': 'PUNTO DE ATERRIZAJE',
            'surface.coords_label': 'Coordenadas:',
            'surface.ship_dist_label': 'Distancia a la Nave:',
            'surface.waiting_body': 'Esperando cuerpo...',
            'surface.no_atmosphere': 'Sin atmósfera',
            'surface.bio_title': '🧬 ODÓMETRO EXOBIOLOGÍA',
            'surface.bio_sample_1': 'MUESTRA 1',
            'surface.bio_sample_2': 'MUESTRA 2',
            'surface.bio_sample_3': 'MUESTRA 3',
            'surface.bio_collected': 'RECOLECTADA',
            'surface.bio_pending': 'PENDIENTE',
            'surface.ship_parked': '🚀 NAVE APARCADA',
            'surface.bio_sample_default': 'Muestra',
            'surface.bio_species_label': 'ESPECIE EN MUESTREO',
            'surface.bio_waiting_sample': 'Esperando muestreo...',
            'surface.bio_dist_label': 'Distancia de Muestra:',
            'surface.bio_waiting_scan': 'Esperando escaneo inicial...',
            'surface.bio_completed': 'COMPLETADO',
            'surface.bio_success_banner': '🎉 ESPECIE ANALIZADA CON ÉXITO',
            'surface.bio_ready_banner': '✅ DIVERSIDAD ALCANZADA ({0}m) • LISTA P/ MUESTRA #{1}',
            'surface.bio_inside_banner': '⚠️ DENTRO DE LA COLONIA ({0}m) • Faltan {1}m',
            'surface.bio_leaving_area_voice': 'Saliendo del área de muestra',
            'surface.legend_current_pos': 'Posición Actual',
            'surface.legend_ship': 'Nave',
            'surface.legend_colony': 'Colonia',
            'surface.legend_extraction': 'Extracción',
            'surface.legend_wreckage': 'Restos',
            'surface.legend_research': 'Investigación',
            'surface.legend_geological': 'Geológico',
            'surface.legend_ruin': 'Ruina / Lore',
            'surface.legend_bio': 'Bio-Muestra',
            'surface.legend_colony_radius': 'Radio Colonia',

            'orrery.title': 'Elite Explorer Copilot - Sistema 3D (Orrery)',
            'orrery.loading_orbital': 'Cargando mecánica orbital del sistema...',
            'orrery.loading_system': 'Consultando órbitas y telemetría de {0}...',
            'orrery.load_failed': 'Error al cargar sistema: {0}',
            'orrery.system_badge': 'SISTEMA:',
            'orrery.loading_short': 'Cargando...',
            'orrery.bodies_count': '{0} cuerpos',
            'orrery.bodies_unmapped': '0 cuerpos (Sin Mapear)',
            'orrery.unmapped_msg': '⚠️ <b>{0}</b> no catalogado en EDSM.<br><span style="color:#00d4ff; font-size:13px; font-weight:normal;">¡Usa el Escáner FSS en el juego para mapear y revelar los cuerpos en tiempo real!</span>',
            'orrery.btn_reset_view': '🔭 Ver Todo',
            'orrery.btn_reset_title': 'Vista Panorámica del Sistema',
            'orrery.btn_focus_star': '☀️ Estrella',
            'orrery.btn_focus_title': 'Centrar en la Estrella Principal',
            'orrery.legend_title': '🪐 LEYENDA DEL SISTEMA',
            'orrery.legend_stars': 'Estrellas (KGBFOAM)',
            'orrery.legend_hmc': 'Alto Contenido Metálico / Rocoso',
            'orrery.legend_metal_rich': 'Cuerpo Rico en Metales',
            'orrery.legend_water': 'Mundo Acuático (Water World)',
            'orrery.legend_icy': 'Cuerpo Helado (Icy Body)',
            'orrery.legend_gas': 'Gigante Gaseoso',
            'orrery.legend_belt': 'Cúmulo de Asteroides',
            'orrery.legend_landable': 'Aterrizable con Nave / SRV',
            'orrery.tree_title': '🪐 CUERPOS CELESTES',
            'orrery.tree_placeholder': 'Filtrar por nombre o clase...',
            'orrery.badge_planet': 'PLANETA',
            'orrery.badge_belt': 'CÚMULO DE ASTEROIDES',
            'orrery.landable_yes': '🟢 ATERRIZABLE CON NAVE / SRV',
            'orrery.landable_no': '🔴 NO ATERRIZABLE',
            'orrery.landable_belt': '⛏️ MINERÍA EN EL VACÍO (Láser / Núcleo)',
            'orrery.landable_tooltip': ' • <span style="color:#2bfca8;font-weight:bold;">🟢 ATERRIZABLE</span>',
            'orrery.mining_tooltip': '⛏️ Minería',
            'orrery.orbital_section': 'MECÁNICA ORBITAL',
            'orrery.dist_arrival': 'Distancia de Llegada:',
            'orrery.semi_major': 'Semieje Mayor:',
            'orrery.orbital_period': 'Período Orbital:',
            'orrery.eccentricity': 'Excentricidad:',
            'orrery.inclination': 'Inclinación Orbital:',
            'orrery.physical_section': 'PROPIEDADES FÍSICAS',
            'orrery.radius': 'Radio:',
            'orrery.gravity': 'Gravedad:',
            'orrery.mass': 'Masa:',
            'orrery.temperature': 'Temperatura Superficial:',
            'orrery.atmosphere': 'Atmósfera:',
            'orrery.pressure': 'Presión:',
            'orrery.signals_section': 'SEÑALES DETECTADAS (DSS)',
            'orrery.materials_section': 'MATERIALES DE SUPERFICIE',
            'orrery.days_unit': '{0} días',
            'orrery.vacuum': 'Vacío Espacial',
            'orrery.no_atmo': 'Vacío / Sin atmósfera',
            'orrery.rocky_cluster': 'Cúmulo Rocoso',
            'orrery.microgravity': '0.00 G (Microgravedad)',
            'orrery.star_class': 'Clase {0}',

            'copilot.page_title': 'Elite Explorer Copilot - Copilot en Tiempo Real',
            'copilot.title_prefix': 'Panel de Vuelo',
            'copilot.subtitle': 'Monitoreo de Vuelo en Tiempo Real y Cotizaciones de Ida',
            'copilot.journal_connecting': 'Conectando al Journal...',
            'copilot.journal_active': 'Journal Activo: {0}',
            'copilot.journal_waiting': 'Esperando Archivo Journal...',
            'copilot.label_commander': 'Comandante',
            'copilot.label_current_system': 'Sistema Actual (Origen)',
            'copilot.label_ship_cargo': 'Nave Activa y Carga',
            'copilot.label_flight_status': 'Estado de Vuelo',
            'copilot.reading_log': 'Leyendo registro...',
            'copilot.in_hyperspace': 'En el hiperespacio',
            'copilot.in_supercruise': 'En el Espacio / Supercrucero',
            'copilot.docked_at': 'Atracado: {0}',
            'copilot.docked_station': 'Atracado en Estación',
            'copilot.flying_system': 'Volando en el Sistema',
            'copilot.cargo_capacity': 'Capacidad de carga: {0} T',
            'copilot.cargo_capacity_init': 'Capacidad de carga: - T',
            'copilot.waiting_events': 'Esperando eventos...',
            'copilot.event_prefix': 'Evento: {0}',
            'copilot.no_log': 'Sin registro',
            'copilot.ship_default': 'Nave',
            'copilot.jump_detected': '¡Nuevo salto detectado!',
            'copilot.jump_body': 'El comandante entró al sistema {0}. Actualizando cotizaciones de ida...',
            'copilot.auto_refresh': 'Auto-Actualizar al Cambiar de Sistema',
            'copilot.auto_refresh_title': 'Actualiza el mercado automáticamente al detectar salto FSD en el Journal',
            'copilot.max_dist': 'Dist. Máx (Ly):',
            'copilot.pad': 'Plataforma:',
            'copilot.pad_any': 'Cualquiera / L',
            'copilot.pad_med': 'Mediana (M)',
            'copilot.pad_small': 'Pequeña (S)',
            'copilot.simulate_jump': '🧪 Simular Salto',
            'copilot.simulate_title': 'Probar cambio de sistema manualmente',
            'copilot.simulate_prompt': 'Ingresa el nombre del sistema estelar para simular salto (ej: Sol, Shinrarta Dezhra, Gendalla):',
            'copilot.simulate_ok': '¡Salto simulado hacia {0}!',
            'copilot.simulate_err': 'Error al simular: {0}',
            'copilot.refresh_quotes': 'Actualizar Cotizaciones',
            'copilot.searching': 'Buscando...',
            'copilot.outbound_opps': 'Oportunidades de Ida:',
            'copilot.last_search': 'Última búsqueda:',
            'copilot.view_inara': 'Ver búsqueda en Inara ↗',
            'copilot.filter_placeholder': 'Filtrar por mercancía, estación o destino...',
            'copilot.sort_profit': 'Ordenar: Mayor Ganancia',
            'copilot.sort_distance': 'Ordenar: Menor Distancia (Ly)',
            'copilot.sort_station_dist': 'Ordenar: Estación Más Cercana (Ls)',
            'copilot.empty_title': 'No se encontraron oportunidades de ida',
            'copilot.empty_desc': 'Revisa los filtros o aumenta la distancia máxima de búsqueda (Ly).',
            'copilot.commodity': 'Mercancía',
            'copilot.per_ton': '/ tonelada ({0}T)',
            'copilot.buy_origin': '1. Comprar en Origen ({0})',
            'copilot.sell_dest': '2. Vender en Destino',
            'copilot.station_dist': 'Dist. Estación:',
            'copilot.supply': 'Oferta:',
            'copilot.demand': 'Demanda:',
            'copilot.jump_dist': 'Distancia del Salto:',
            'copilot.dest_station': 'Estación de Destino:',
            'copilot.fetch_error': 'Error al consultar cotizaciones: {0}',
            'copilot.copied': '¡Sistema "{0}" copiado!',

            'trade.page_title': 'Elite Explorer Copilot - Rutas de Mercado y Cotizaciones',
            'trade.subtitle': 'Cotizaciones y Rutas de Mercado Optimizadas (vía Inara)',
            'trade.center_system': 'Sistema Centro de Búsqueda (Origen)',
            'trade.center_placeholder': 'Ej.: Sol, Shinrarta Dezhra...',
            'trade.ship_cargo': 'Carga de la Nave (T)',
            'trade.max_dist': 'Distancia Máx. (Ly)',
            'trade.pad_size': 'Plataforma de Aterrizaje',
            'trade.pad_any': 'Cualquiera / Grande (L)',
            'trade.max_age': 'Antigüedad Máx. Datos',
            'trade.hours_24': '24 horas',
            'trade.hours_48': '48 horas',
            'trade.hours_72': '72 horas',
            'trade.days_7': '7 días',
            'trade.btn_refresh': 'Actualizar',
            'trade.consulting': 'Consultando...',
            'trade.routes_found': 'Rutas Encontradas:',
            'trade.filter_placeholder': 'Filtrar por estación, sistema o mercancía...',
            'trade.sort_trip': 'Ordenar: Mayor Ganancia / Viaje',
            'trade.sort_unit': 'Ordenar: Mayor Ganancia / Unidad',
            'trade.sort_hour': 'Ordenar: Mayor Ganancia / Hora',
            'trade.sort_route_dist': 'Ordenar: Menor Distancia de Ruta',
            'trade.sort_center_dist': 'Ordenar: Más Cercano al Centro',
            'trade.empty_title': 'No se encontraron rutas',
            'trade.empty_desc': 'Verifica los filtros o aumenta la distancia máxima de salto.',
            'trade.from_label': 'Origen (From)',
            'trade.to_label': 'Destino (To)',
            'trade.station_dist_label': 'Distancia a la estación:',
            'trade.profit_trip': 'Ganancia por Viaje',
            'trade.outbound_leg': 'Ida ➔ {0}',
            'trade.inbound_leg': 'Vuelta ➔ {0}',
            'trade.buy_origin': 'Compra (Origen)',
            'trade.sell_dest': 'Venta (Destino)',
            'trade.buy_dest': 'Compra (Destino)',
            'trade.sell_origin': 'Venta (Origen)',
            'trade.supply': 'Oferta (Supply):',
            'trade.demand': 'Demanda:',
            'trade.route_dist': 'Distancia de Ruta',
            'trade.center_dist': 'Dist. del Centro',
            'trade.margin': 'Margen',
            'trade.updated': 'Actualizado',
            'trade.profit_unit': 'Ganancia por Unidad',
            'trade.profit_hour': 'Ganancia por Hora',
            'trade.fetch_error': 'Error en la consulta: {0}',

            // Mercado Single-Hop
            'market.page_title': 'Elite Explorer Copilot - Mercado Single-Hop',
            'market.subtitle': 'Top 20 oportunidades de mercado de un salto de la galaxia (≤ 25 Ly) con cálculo de beneficios en tiempo real para tu nave',
            'market.commander': 'Comandante:',
            'market.current_ship': 'Nave:',
            'market.current_system': 'Sistema:',
            'market.calc_cargo': 'Carga (T):',
            'market.source_label': 'Origen:',
            'market.refresh_btn': 'Actualizar',
            'market.loading': 'Por favor espere... Cargando oportunidades de mercado de la galaxia...',
            'market.no_data': 'No se detectaron oportunidades comerciales en este momento.',
            'market.copied_sys': '¡copiado al portapapeles!'
        }
    };

    function injectFlagStyles() {
        if (document.getElementById('elite-i18n-styles')) return;
        const style = document.createElement('style');
        style.id = 'elite-i18n-styles';
        style.textContent = `
            .lang-flags-bar {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 4px 7px;
                border-radius: 5px;
                background: rgba(8, 16, 30, 0.85);
                border: 1px solid rgba(0, 212, 255, 0.3);
                backdrop-filter: blur(8px);
                pointer-events: auto;
            }
            .lang-flag-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 1px;
                border: 1px solid transparent;
                border-radius: 3px;
                background: transparent;
                cursor: pointer;
                opacity: 0.5;
                transition: opacity 0.18s, transform 0.15s, border-color 0.18s, box-shadow 0.18s;
                line-height: 0;
            }
            .lang-flag-btn svg {
                width: 20px;
                height: 14px;
                display: block;
                border-radius: 2px;
            }
            .lang-flag-btn:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }
            .lang-flag-btn.active {
                opacity: 1;
                border-color: #00d4ff;
                box-shadow: 0 0 8px rgba(0, 212, 255, 0.45);
            }
        `;
        document.head.appendChild(style);
    }

    class EliteI18n {
        constructor() {
            this.currentLang = this._detectLanguage();
            this._persist(this.currentLang);
        }

        _detectLanguage() {
            try {
                const params = new URLSearchParams(window.location.search);
                const urlLang = (params.get('lang') || '').toLowerCase();
                if (SUPPORTED_LANGS.includes(urlLang)) return urlLang;
            } catch (_) {}

            const cookieMatch = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_KEY}=([a-zA-Z-]+)`));
            if (cookieMatch && cookieMatch[1]) {
                const raw = cookieMatch[1].toLowerCase().split('-')[0];
                if (SUPPORTED_LANGS.includes(raw)) return raw;
            }

            try {
                const stored = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
                if (SUPPORTED_LANGS.includes(stored)) return stored;
            } catch (_) {}

            return 'en';
        }

        _persist(lang) {
            try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
            try { document.cookie = `${COOKIE_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax`; } catch (_) {}
        }

        getLang() {
            return this.currentLang;
        }

        getLocale() {
            return (LOCALE_META[this.currentLang] || LOCALE_META.en).code;
        }

        t(key, ...params) {
            const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS.en;
            let val = dict[key];
            if (val === undefined) {
                val = TRANSLATIONS.en[key];
            }
            if (val === undefined) {
                return key;
            }
            if (params && params.length > 0) {
                params.forEach((p, idx) => {
                    val = val.replace(new RegExp(`\\{${idx}\\}`, 'g'), p !== undefined && p !== null ? String(p) : '');
                });
            }
            return val;
        }

        renderSwitchers() {
            injectFlagStyles();
            document.querySelectorAll('[data-lang-switcher]').forEach(container => {
                container.classList.add('lang-flags-bar');
                if (!container.dataset.flagsRendered) {
                    container.innerHTML = SUPPORTED_LANGS.map(lang => `
                        <button type="button"
                                class="lang-flag-btn"
                                data-lang="${lang}"
                                title="${LOCALE_META[lang].title}"
                                aria-label="${LOCALE_META[lang].title}">
                            ${FLAG_SVGS[lang]}
                        </button>
                    `).join('');
                    container.querySelectorAll('.lang-flag-btn').forEach(btn => {
                        btn.addEventListener('click', () => this.setLanguage(btn.dataset.lang));
                    });
                    container.dataset.flagsRendered = '1';
                }
                container.querySelectorAll('.lang-flag-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
                });
            });
        }

        apply() {
            document.documentElement.lang = this.getLocale();
            this.renderSwitchers();

            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (key) el.textContent = this.t(key);
            });

            document.querySelectorAll('[data-i18n-html]').forEach(el => {
                const key = el.getAttribute('data-i18n-html');
                if (key) el.innerHTML = this.t(key);
            });

            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (key) el.setAttribute('placeholder', this.t(key));
            });

            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                if (key) el.setAttribute('title', this.t(key));
            });
        }

        setLanguage(lang) {
            const norm = (lang || '').toLowerCase();
            if (!SUPPORTED_LANGS.includes(norm) || norm === this.currentLang) {
                this.renderSwitchers();
                return;
            }
            this.currentLang = norm;
            this._persist(norm);
            this.apply();
            window.dispatchEvent(new CustomEvent('elite:languageChanged', { detail: { lang: norm } }));
        }
    }

    const i18n = new EliteI18n();
    window.i18n = i18n;
    window.EliteI18n = i18n;
    window.t = (...args) => i18n.t(...args);
    window.switchLanguage = (lang) => i18n.setLanguage(lang);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => i18n.apply());
    } else {
        i18n.apply();
    }
})();
