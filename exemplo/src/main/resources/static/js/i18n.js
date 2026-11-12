/**
 * QuaTime - Sistema de Internacionalização e Localização (i18n / l10n)
 * Suporte completo para: Português (pt-BR), English (en-US) e Español (es-ES).
 */

const QUATIME_TRANSLATIONS = {
    pt: {
        code: 'pt-BR',
        name: 'Português',
        flag: '🇧🇷',
        colors: { white: 'Branco', red: 'Vermelho', black: 'Preto', green: 'Verde' },
        voice: {
            start: 'iniciando jogo',
            pause: 'jogo pausado',
            resume: 'retomando o jogo',
            speechLang: 'pt-BR',
            timeout: 'Tempo esgotado para o '
        },
        texts: {
            'app.name': 'QuaTime',
            'app.subtitle': 'Xadrez Para Quatro Jogadores',
            'landing.select_language': 'Selecione o idioma para começar:',
            'nav.home': 'Início',
            'nav.refresh': 'Atualizar Mesas',
            'nav.admin': 'Painel de Administração',
            'nav.clock': 'Relógio',
            'nav.server_online': 'Servidor Online',
            'nav.server_connecting': 'Conectando...',
            'nav.port': 'Porta: 8080',
            'nav.back': 'Voltar',
            'profile.title': 'Seu Nome / Apelido:',
            'profile.placeholder': 'Digite seu nome (Ex: Magno)',
            'profile.saved': 'Salvo',
            'legend.title': 'Disponibilidade de Cores na Mesa:',
            'legend.available': 'Cor Livre',
            'legend.occupied': 'Ocupado',
            'play.open_tables': 'Mesas Abertas',
            'play.legend_vivid': 'Cor Viva:',
            'play.legend_free': 'Livre',
            'play.legend_faded': 'Cor Fosca:',
            'play.legend_occupied': 'Ocupada',
            'play.no_tables_title': 'Nenhuma mesa aberta no momento',
            'play.no_tables_desc': 'Aguarde o árbitro ou organizador abrir uma nova mesa.',
            'play.your_table': 'SUA MESA',
            'play.btn_continue': 'Continuar Sua Partida',
            'play.btn_observe': 'Observar Partida',
            'play.btn_join': 'Entrar na Mesa',
            'play.btn_enter_table': 'Entrar na Mesa',
            'play.color_select_tip': 'Toque em uma das cores livres para assumir o relógio',
            'play.your_name_label': 'Seu Nome ou Apelido',
            'play.available': 'Disponível',
            'play.occupied': 'Ocupada',
            'play.status_lobby': 'Aguardando início',
            'play.ready_prompt_title': 'Pronto para iniciar?',
            'play.ready_prompt_sub': 'Confirme sua presença. O administrador iniciará o jogo assim que todos responderem Sim.',
            'play.btn_ready': 'Estou pronto',
            'play.btn_ready_cancel': 'Cancelar prontidão',
            'play.ready_summary': '{0} de {1} jogadores responderam Sim',
            'play.btn_audio_tip': 'Ativar/Desativar Sons e Bipes',
            'play.tap_to_move': 'SUA VEZ! Toque na tela para passar o lance.',
            'play.tap_waiting': 'Aguardando jogada do exército {0}...',
            'play.tap_paused': '⏸ Jogo Pausado pelo Administrador',
            'play.tap_eliminated': 'Exército eliminado. Você está assistindo a partida.',
            'play.pause_title': 'PARTIDA PAUSADA',
            'play.pause_desc': 'O tempo dos 4 jogadores está congelado.',
            'play.btn_resume': 'Retomar Partida',
            'play.btn_undo': 'Desfazer Último Lance (Undo)',
            'play.abort_title': 'PARTIDA CANCELADA',
            'play.abort_desc': 'Esta partida foi cancelada ou encerrada pelo árbitro / administrador.',
            'play.btn_back_tables': 'Voltar à Lista de Mesas',
            'play.winner_title': 'VITÓRIA!',
            'play.winner_desc': 'O exército {0} é o vencedor da partida!',
            'play.btn_winner_exit': 'Sair para as Mesas',
            'play.flag_tip': 'Eliminar Exército',
            'play.playing_badge': 'JOGANDO',
            'play.waiting_badge': 'Aguardando',
            'tables.title': 'Mesas Disponíveis',
            'tables.count_badge': '{0} Mesa(s)',
            'tables.count_badge_zero': '0 Mesa(s)',
            'lobby.connected_badge': '{0}/4 conectados',
            'lobby.all_ready_title': 'Todos Prontos! Iniciando...',
            'lobby.all_ready_sub': 'Todos os 4 jogadores confirmaram Sim. O relógio começará a rodar!',
            'lobby.all_connected_sub': 'Todos os 4 jogadores conectaram. Aguardando a resposta de todos ({0}/4 confirmaram Sim)...',
            'lobby.waiting_conn_sub': 'Aguardando a conexão dos 4 jogadores na mesa ({0}/4 conectados)...',
            'lobby.waiting_player_slot': 'Aguardando jogador...',
            'lobby.btn_edit_name': 'Alterar',
            'tables.empty': 'Nenhuma mesa encontrada',
            'tables.empty_sub': 'Aguarde o administrador criar uma mesa no painel.',
            'tables.btn_play': 'Entrar na Mesa',
            'tables.status_running': 'Em Andamento',
            'tables.status_lobby': 'Sala de Espera',
            'tables.status_paused': 'Pausada',
            'tables.status_game_over': 'Encerrada',
            'tables.btn_continue': 'Continuar Sua Partida',
            'color_select.title': 'Escolha seu Exército',
            'color_select.sub': 'Selecione uma das cores disponíveis para esta partida:',
            'color_select.player_name_label': 'Seu Nome ou Apelido',
            'color_select.btn_confirm': 'Entrar na Mesa',
            'lobby.title': 'Sala de Espera',
            'lobby.waiting_players': 'Aguardando Jogadores',
            'lobby.waiting_sub': 'Aguardando os 4 jogadores confirmarem prontidão para o administrador iniciar a partida.',
            'lobby.ready_title': 'Pronto para iniciar?',
            'lobby.ready_sub': 'Confirme sua presença. O administrador iniciará o jogo assim que todos responderem Sim.',
            'lobby.btn_ready': 'Estou pronto',
            'lobby.btn_ready_cancel': 'Cancelar prontidão',
            'lobby.badge_ready': 'Pronto ✓',
            'lobby.badge_waiting': 'Aguardando',
            'lobby.count_label': '{0} de {1} jogadores responderam Sim',
            'clock.turn': 'Vez:',
            'clock.move': 'Lance #{0}',
            'clock.paused_banner': 'PARTIDA PAUSADA PELO ADMINISTRADOR - Aguardando retomada...',
            'clock.countdown_start': 'INICIANDO JOGO',
            'clock.countdown_resume': 'RETOMANDO O JOGO',
            'clock.get_ready': 'Preparem-se!',
            'clock.resuming': 'Retomando...',
            'clock.tap_footer_my_turn': 'SUA VEZ! Toque na tela para passar o lance.',
            'clock.tap_footer_waiting': 'Aguardando jogada do exército {0}...',
            'clock.tap_footer_paused': '⏸ Jogo Pausado pelo Administrador',
            'clock.tap_footer_eliminated': 'Exército eliminado. Você está assistindo a partida.',
            'clock.btn_exit': 'Sair da Sala',
            'clock.winner_title': 'VITÓRIA!',
            'clock.winner_text': 'O exército {0} é o vencedor da partida!',
            'clock.btn_winner_exit': 'Sair para as Mesas',
            'clock.aborted_title': 'PARTIDA CANCELADA',
            'clock.aborted_text': 'Esta partida foi cancelada ou encerrada pelo árbitro / administrador.',
            'dashboard.title': 'QuaTime • Gestão de Mesas',
            'dashboard.stat_total': 'Total de Mesas',
            'dashboard.stat_running': 'Partidas em Jogo',
            'dashboard.stat_paused': 'Partidas Pausadas',
            'dashboard.stat_players': 'Jogadores Conectados',
            'dashboard.btn_create': 'Criar Mesa',
            'dashboard.btn_create_modal': 'Criar Mesa',
            'dashboard.filter_all': 'Todas',
            'dashboard.filter_lobby': 'Sala de Espera',
            'dashboard.filter_running': 'Em Jogo',
            'dashboard.filter_paused': 'Pausadas',
            'dashboard.filter_finished': 'Finalizadas',
            'dashboard.search_placeholder': 'Buscar mesa por nome ou ID...',
            'dashboard.registered_tables': 'Mesas Registradas',
            'dashboard.btn_observe': 'Observar',
            'dashboard.btn_start': 'Iniciar',
            'dashboard.btn_pause': 'Pausar',
            'dashboard.btn_resume': 'Retomar',
            'dashboard.btn_delete': 'Excluir mesa',
            'dashboard.delete_title': 'Excluir mesa',
            'dashboard.players': 'Jogadores',
            'dashboard.ready_suffix': 'prontos',
            'dashboard.free': 'Livre',
            'dashboard.connected': 'Conectado',
            'dashboard.waiting': 'Aguardando',
            'dashboard.ready': 'Pronto ✓',
            'dashboard.inclusive': 'Inclusivo',
            'dashboard.beeps': 'Bipes',
            'dashboard.min': 'min',
            'dashboard.sec': 's',
            'dashboard.undo': 'Desfazer',
            'dashboard.undo_title': 'Desfazer último lance',
            'dashboard.waiting_ready_hint': 'Aguardando 4 jogadores prontos',
            'dashboard.empty_title': 'Nenhuma mesa encontrada com os filtros selecionados.',
            'observer.title': 'Observando Mesa',
            'observer.turn_prefix': 'Vez atual:',
            'observer.flag_title': 'Baixar Bandeira (Eliminar)',
            'observer.start': 'Iniciar Partida',
            'observer.pause': 'Pausar',
            'observer.resume': 'Retomar',
            'observer.abort': 'Cancelar Partida',
            'observer.playing': 'JOGANDO',
            'observer.player_prefix': 'Jogador',
            'modal_create.title': 'Configurar Nova Mesa',
            'modal_create.field_name': '1. Nome da Mesa',
            'modal_create.hint_name': 'Identificação visual da mesa para os jogadores.',
            'modal_create.field_gametype': '2. Tipo de Jogo',
            'modal_create.gametype_inclusive': 'INCLUSIVO - Áudio descritivo',
            'modal_create.gametype_conventional': 'CONVENCIONAL - Emissão de beep',
            'modal_create.hint_gametype': 'Narração de voz ou apenas bipes sonoros.',
            'modal_create.field_time': '3. Tempo (Minutos)',
            'modal_create.hint_time': 'Tempo de cada jogador no jogo.',
            'modal_create.field_inc': '4. Incremento (Segundos / Lance)',
            'modal_create.hint_inc': 'Tempo de Movimento da jogada / lance.',
            'modal_create.btn_submit': 'Criar Mesa',
            'modal_create.btn_cancel': 'Cancelar',
            'dialog.confirm_title': 'Confirmar Ação',
            'dialog.confirm_message': 'Deseja realmente prosseguir?',
            'dialog.btn_confirm': 'Confirmar',
            'dialog.btn_cancel': 'Cancelar'
        }
    },
    en: {
        code: 'en-US',
        name: 'English',
        flag: '🇺🇸',
        colors: { white: 'White', red: 'Red', black: 'Black', green: 'Green' },
        voice: {
            start: 'Starting the game',
            pause: 'game paused',
            resume: 'Resume the game',
            speechLang: 'en-US',
            timeout: 'Time out for '
        },
        texts: {
            'app.name': 'QuaTime',
            'app.subtitle': 'Four-Player Chess',
            'landing.select_language': 'Select your language to begin:',
            'nav.home': 'Home',
            'nav.refresh': 'Refresh Tables',
            'nav.admin': 'Admin Panel',
            'nav.clock': 'Clock',
            'nav.server_online': 'Server Online',
            'nav.server_connecting': 'Connecting...',
            'nav.port': 'Port: 8080',
            'nav.back': 'Back',
            'profile.title': 'Your Name / Nickname:',
            'profile.placeholder': 'Enter your name (e.g. John)',
            'profile.saved': 'Saved',
            'legend.title': 'Color Availability at the Table:',
            'legend.available': 'Available',
            'legend.occupied': 'Occupied',
            'play.open_tables': 'Open Tables',
            'play.legend_vivid': 'Vivid Color:',
            'play.legend_free': 'Available',
            'play.legend_faded': 'Dim Color:',
            'play.legend_occupied': 'Occupied',
            'play.no_tables_title': 'No open tables at the moment',
            'play.no_tables_desc': 'Wait for the arbiter or organizer to create a table.',
            'play.your_table': 'YOUR TABLE',
            'play.btn_continue': 'Continue Your Match',
            'play.btn_observe': 'Observe Match',
            'play.btn_join': 'Join Table',
            'play.btn_enter_table': 'Join Table',
            'play.color_select_tip': 'Tap an available color to take over the clock',
            'play.your_name_label': 'Your Name or Nickname',
            'play.available': 'Available',
            'play.occupied': 'Occupied',
            'play.status_lobby': 'Waiting to start',
            'play.ready_prompt_title': 'Ready to start?',
            'play.ready_prompt_sub': 'Confirm your presence. The arbiter will start the game once everyone answers Yes.',
            'play.btn_ready': 'I am ready',
            'play.btn_ready_cancel': 'Cancel readiness',
            'play.ready_summary': '{0} of {1} players answered Yes',
            'play.btn_audio_tip': 'Enable/Disable Sounds and Beeps',
            'play.tap_to_move': 'YOUR TURN! Tap screen to pass turn.',
            'play.tap_waiting': 'Waiting for {0} army to move...',
            'play.tap_paused': '⏸ Game Paused by Administrator',
            'play.tap_eliminated': 'Army eliminated. You are watching the match.',
            'play.pause_title': 'MATCH PAUSED',
            'play.pause_desc': 'Time is frozen for all 4 players.',
            'play.btn_resume': 'Resume Match',
            'play.btn_undo': 'Undo Last Move',
            'play.abort_title': 'MATCH ABORTED',
            'play.abort_desc': 'This match was canceled or ended by the administrator.',
            'play.btn_back_tables': 'Back to Tables List',
            'play.winner_title': 'VICTORY!',
            'play.winner_desc': 'The {0} army is the winner of the match!',
            'play.btn_winner_exit': 'Exit to Tables',
            'play.flag_tip': 'Eliminate Army',
            'play.playing_badge': 'PLAYING',
            'play.waiting_badge': 'Waiting',
            'tables.title': 'Available Tables',
            'tables.count_badge': '{0} Table(s)',
            'tables.count_badge_zero': '0 Table(s)',
            'lobby.connected_badge': '{0}/4 connected',
            'lobby.all_ready_title': 'All Ready! Starting...',
            'lobby.all_ready_sub': 'All 4 players confirmed Yes. The clock is starting!',
            'lobby.all_connected_sub': 'All 4 players connected. Waiting for everyone to confirm ({0}/4 answered Yes)...',
            'lobby.waiting_conn_sub': 'Waiting for all 4 players to connect ({0}/4 connected)...',
            'lobby.waiting_player_slot': 'Waiting for player...',
            'lobby.btn_edit_name': 'Edit',
            'tables.empty': 'No tables found',
            'tables.empty_sub': 'Wait for the administrator to create a table in the dashboard.',
            'tables.btn_play': 'Join Table',
            'tables.status_running': 'In Progress',
            'tables.status_lobby': 'Waiting Room',
            'tables.status_paused': 'Paused',
            'tables.status_game_over': 'Finished',
            'tables.btn_continue': 'Continue Your Match',
            'color_select.title': 'Choose your Army',
            'color_select.sub': 'Select an available color for this match:',
            'color_select.player_name_label': 'Your Name or Nickname',
            'color_select.btn_confirm': 'Join Table',
            'lobby.title': 'Waiting Room',
            'lobby.waiting_players': 'Waiting for Players',
            'lobby.waiting_sub': 'Waiting for all 4 players to confirm readiness so the arbiter can start.',
            'lobby.ready_title': 'Ready to start?',
            'lobby.ready_sub': 'Confirm your presence. The match will start once everyone answers Yes.',
            'lobby.btn_ready': 'I am ready',
            'lobby.btn_ready_cancel': 'Cancel readiness',
            'lobby.badge_ready': 'Ready ✓',
            'lobby.badge_waiting': 'Waiting',
            'lobby.count_label': '{0} of {1} players answered Yes',
            'clock.turn': 'Turn:',
            'clock.move': 'Move #{0}',
            'clock.paused_banner': 'MATCH PAUSED BY ADMINISTRATOR - Waiting to resume...',
            'clock.countdown_start': 'STARTING THE GAME',
            'clock.countdown_resume': 'RESUMING THE GAME',
            'clock.get_ready': 'Get ready!',
            'clock.resuming': 'Resuming...',
            'clock.tap_footer_my_turn': 'YOUR TURN! Tap screen to pass turn.',
            'clock.tap_footer_waiting': 'Waiting for {0} army to move...',
            'clock.tap_footer_paused': '⏸ Game Paused by Administrator',
            'clock.tap_footer_eliminated': 'Army eliminated. You are watching the match.',
            'clock.btn_exit': 'Leave Room',
            'clock.winner_title': 'VICTORY!',
            'clock.winner_text': 'The {0} army is the winner of the match!',
            'clock.btn_winner_exit': 'Exit to Tables',
            'clock.aborted_title': 'MATCH ABORTED',
            'clock.aborted_text': 'This match was canceled or ended by the arbiter / administrator.',
            'dashboard.title': 'QuaTime • Table Management',
            'dashboard.stat_total': 'Total Tables',
            'dashboard.stat_running': 'Matches in Progress',
            'dashboard.stat_paused': 'Paused Matches',
            'dashboard.stat_players': 'Connected Players',
            'dashboard.btn_create': 'Create Table',
            'dashboard.btn_create_modal': 'Create Table',
            'dashboard.filter_all': 'All',
            'dashboard.filter_lobby': 'Waiting Room',
            'dashboard.filter_running': 'In Progress',
            'dashboard.filter_paused': 'Paused',
            'dashboard.filter_finished': 'Finished',
            'dashboard.search_placeholder': 'Search table by name or ID...',
            'dashboard.registered_tables': 'Registered Tables',
            'dashboard.btn_observe': 'Observe',
            'dashboard.btn_start': 'Start',
            'dashboard.btn_pause': 'Pause',
            'dashboard.btn_resume': 'Resume',
            'dashboard.btn_delete': 'Delete table',
            'dashboard.delete_title': 'Delete table',
            'dashboard.players': 'Players',
            'dashboard.ready_suffix': 'ready',
            'dashboard.free': 'Free',
            'dashboard.connected': 'Connected',
            'dashboard.waiting': 'Waiting',
            'dashboard.ready': 'Ready ✓',
            'dashboard.inclusive': 'Inclusive',
            'dashboard.beeps': 'Beeps',
            'dashboard.min': 'min',
            'dashboard.sec': 's',
            'dashboard.undo': 'Undo',
            'dashboard.undo_title': 'Undo last move',
            'dashboard.waiting_ready_hint': 'Waiting for 4 ready players',
            'dashboard.empty_title': 'No tables found with selected filters.',
            'observer.title': 'Observing Table',
            'observer.turn_prefix': 'Current turn:',
            'observer.flag_title': 'Drop Flag (Eliminate)',
            'observer.start': 'Start Match',
            'observer.pause': 'Pause',
            'observer.resume': 'Resume',
            'observer.abort': 'Abort Match',
            'observer.playing': 'PLAYING',
            'observer.player_prefix': 'Player',
            'modal_create.title': 'Configure New Table',
            'modal_create.field_name': '1. Table Name',
            'modal_create.hint_name': 'Visual table identification for players.',
            'modal_create.field_gametype': '2. Game Mode',
            'modal_create.gametype_inclusive': 'INCLUSIVE - Descriptive audio',
            'modal_create.gametype_conventional': 'CONVENTIONAL - Sound beeps only',
            'modal_create.hint_gametype': 'Voice announcements or sound beeps.',
            'modal_create.field_time': '3. Time (Minutes)',
            'modal_create.hint_time': 'Base time for each player.',
            'modal_create.field_inc': '4. Increment (Seconds / Move)',
            'modal_create.hint_inc': 'Time increment per move.',
            'modal_create.btn_submit': 'Create Table',
            'modal_create.btn_cancel': 'Cancel',
            'dialog.confirm_title': 'Confirm Action',
            'dialog.confirm_message': 'Do you really want to proceed?',
            'dialog.btn_confirm': 'Confirm',
            'dialog.btn_cancel': 'Cancel'
        }
    },
    es: {
        code: 'es-ES',
        name: 'Español',
        flag: '🇪🇸',
        colors: { white: 'Blanco', red: 'Rojo', black: 'Negro', green: 'Verde' },
        voice: {
            start: 'Empezando el juego',
            pause: 'juego pausado',
            resume: 'Reanudar la partida',
            speechLang: 'es-ES',
            timeout: 'Tiempo agotado para '
        },
        texts: {
            'app.name': 'QuaTime',
            'app.subtitle': 'Ajedrez Para Cuatro Jugadores',
            'landing.select_language': 'Seleccione su idioma para comenzar:',
            'nav.home': 'Inicio',
            'nav.refresh': 'Actualizar Mesas',
            'nav.admin': 'Panel de Administración',
            'nav.clock': 'Reloj',
            'nav.server_online': 'Servidor En Línea',
            'nav.server_connecting': 'Conectando...',
            'nav.port': 'Puerto: 8080',
            'nav.back': 'Volver',
            'profile.title': 'Tu Nombre / Apodo:',
            'profile.placeholder': 'Escribe tu nombre (Ej: Juan)',
            'profile.saved': 'Guardado',
            'legend.title': 'Disponibilidad de Colores en la Mesa:',
            'legend.available': 'Disponible',
            'legend.occupied': 'Ocupado',
            'play.open_tables': 'Mesas Abiertas',
            'play.legend_vivid': 'Color Vivo:',
            'play.legend_free': 'Libre',
            'play.legend_faded': 'Color Opaco:',
            'play.legend_occupied': 'Ocupado',
            'play.no_tables_title': 'Ninguna mesa abierta por el momento',
            'play.no_tables_desc': 'Espere a que el árbitro u organizador abra una nueva mesa.',
            'play.your_table': 'TU MESA',
            'play.btn_continue': 'Continuar Tu Partida',
            'play.btn_observe': 'Observar Partida',
            'play.btn_join': 'Entrar a la Mesa',
            'play.btn_enter_table': 'Entrar a la Mesa',
            'play.color_select_tip': 'Toca uno de los colores libres para asumir el reloj',
            'play.your_name_label': 'Tu Nombre o Apodo',
            'play.available': 'Disponible',
            'play.occupied': 'Ocupado',
            'play.status_lobby': 'Esperando inicio',
            'play.ready_prompt_title': '¿Listo para empezar?',
            'play.ready_prompt_sub': 'Confirma tu presencia. El administrador iniciará el juego en cuanto todos respondan Sí.',
            'play.btn_ready': 'Estoy listo',
            'play.btn_ready_cancel': 'Cancelar disponibilidad',
            'play.ready_summary': '{0} de {1} jugadores respondieron Sí',
            'play.btn_audio_tip': 'Activar/Desactivar Sonidos y Pitidos',
            'play.tap_to_move': '¡TU TURNO! Toca la pantalla para pasar.',
            'play.tap_waiting': 'Esperando jugada del ejército {0}...',
            'play.tap_paused': '⏸ Juego Pausado por el Administrador',
            'play.tap_eliminated': 'Ejército eliminado. Estás viendo la partida.',
            'play.pause_title': 'PARTIDA PAUSADA',
            'play.pause_desc': 'El tiempo de los 4 jugadores está congelado.',
            'play.btn_resume': 'Reanudar Partida',
            'play.btn_undo': 'Deshacer Última Jugada (Undo)',
            'play.abort_title': 'PARTIDA CANCELADA',
            'play.abort_desc': 'Esta partida fue cancelada o terminada por el árbitro / administrador.',
            'play.btn_back_tables': 'Volver a la Lista de Mesas',
            'play.winner_title': '¡VICTORIA!',
            'play.winner_desc': '¡El ejército {0} es el ganador de la partida!',
            'play.btn_winner_exit': 'Salir a las Mesas',
            'play.flag_tip': 'Eliminar Ejército',
            'play.playing_badge': 'JUGANDO',
            'play.waiting_badge': 'Esperando',
            'tables.title': 'Mesas Disponibles',
            'tables.count_badge': '{0} Mesa(s)',
            'tables.count_badge_zero': '0 Mesa(s)',
            'lobby.connected_badge': '{0}/4 conectados',
            'lobby.all_ready_title': '¡Todos Listos! Iniciando...',
            'lobby.all_ready_sub': '¡Los 4 jugadores confirmaron Sí. El reloj comenzará a correr!',
            'lobby.all_connected_sub': 'Los 4 jugadores se conectaron. Esperando confirmación de todos ({0}/4 confirmaron Sí)...',
            'lobby.waiting_conn_sub': 'Esperando la conexión de los 4 jugadores ({0}/4 conectados)...',
            'lobby.waiting_player_slot': 'Esperando jugador...',
            'lobby.btn_edit_name': 'Cambiar',
            'tables.empty': 'No se encontraron mesas',
            'tables.empty_sub': 'Espere a que el administrador cree una mesa en el panel.',
            'tables.btn_play': 'Entrar a la Mesa',
            'tables.status_running': 'En Juego',
            'tables.status_lobby': 'Sala de Espera',
            'tables.status_paused': 'Pausada',
            'tables.status_game_over': 'Terminada',
            'tables.btn_continue': 'Continuar Tu Partida',
            'color_select.title': 'Elige tu Ejército',
            'color_select.sub': 'Selecciona un color disponible para esta partida:',
            'color_select.player_name_label': 'Tu Nombre o Apodo',
            'color_select.btn_confirm': 'Entrar a la Mesa',
            'lobby.title': 'Sala de Espera',
            'lobby.waiting_players': 'Esperando Jugadores',
            'lobby.waiting_sub': 'Esperando que los 4 jugadores confirmen disponibilidad para iniciar la partida.',
            'lobby.ready_title': '¿Listo para empezar?',
            'lobby.ready_sub': 'Confirma tu presencia. El juego iniciará en cuanto todos respondan Sí.',
            'lobby.btn_ready': 'Estoy listo',
            'lobby.btn_ready_cancel': 'Cancelar disponibilidad',
            'lobby.badge_ready': 'Listo ✓',
            'lobby.badge_waiting': 'Esperando',
            'lobby.count_label': '{0} de {1} jugadores respondieron Sí',
            'clock.turn': 'Turno:',
            'clock.move': 'Jugada #{0}',
            'clock.paused_banner': 'PARTIDA PAUSADA POR EL ADMINISTRADOR - Esperando reanudación...',
            'clock.countdown_start': 'EMPEZANDO EL JUEGO',
            'clock.countdown_resume': 'REANUDAR LA PARTIDA',
            'clock.get_ready': '¡Prepárense!',
            'clock.resuming': 'Reanudando...',
            'clock.tap_footer_my_turn': '¡TU TURNO! Toca la pantalla para pasar.',
            'clock.tap_footer_waiting': 'Esperando jugada del ejército {0}...',
            'clock.tap_footer_paused': '⏸ Juego Pausado por el Administrador',
            'clock.tap_footer_eliminated': 'Ejército eliminado. Estás viendo la partida.',
            'clock.btn_exit': 'Salir de la Sala',
            'clock.winner_title': '¡VICTORIA!',
            'clock.winner_text': '¡El ejército {0} es el ganador de la partida!',
            'clock.btn_winner_exit': 'Salir a las Mesas',
            'clock.aborted_title': 'PARTIDA CANCELADA',
            'clock.aborted_text': 'Esta partida fue cancelada o terminada por el árbitro / administrador.',
            'dashboard.title': 'QuaTime • Gestión de Mesas',
            'dashboard.stat_total': 'Total de Mesas',
            'dashboard.stat_running': 'Partidas en Juego',
            'dashboard.stat_paused': 'Partidas Pausadas',
            'dashboard.stat_players': 'Jugadores Conectados',
            'dashboard.btn_create': 'Crear Mesa',
            'dashboard.btn_create_modal': 'Crear Mesa',
            'dashboard.filter_all': 'Todas',
            'dashboard.filter_lobby': 'Sala de Espera',
            'dashboard.filter_running': 'En Juego',
            'dashboard.filter_paused': 'Pausadas',
            'dashboard.filter_finished': 'Finalizadas',
            'dashboard.search_placeholder': 'Buscar mesa por nombre o ID...',
            'dashboard.registered_tables': 'Mesas Registradas',
            'dashboard.btn_observe': 'Observar',
            'dashboard.btn_start': 'Iniciar',
            'dashboard.btn_pause': 'Pausar',
            'dashboard.btn_resume': 'Reanudar',
            'dashboard.btn_delete': 'Eliminar mesa',
            'dashboard.delete_title': 'Eliminar mesa',
            'dashboard.players': 'Jugadores',
            'dashboard.ready_suffix': 'listos',
            'dashboard.free': 'Libre',
            'dashboard.connected': 'Conectado',
            'dashboard.waiting': 'Esperando',
            'dashboard.ready': 'Listo ✓',
            'dashboard.inclusive': 'Inclusivo',
            'dashboard.beeps': 'Pitidos',
            'dashboard.min': 'min',
            'dashboard.sec': 's',
            'dashboard.undo': 'Deshacer',
            'dashboard.undo_title': 'Deshacer última jugada',
            'dashboard.waiting_ready_hint': 'Esperando 4 jugadores listos',
            'dashboard.empty_title': 'No se encontraron mesas con los filtros seleccionados.',
            'observer.title': 'Observando Mesa',
            'observer.turn_prefix': 'Turno actual:',
            'observer.flag_title': 'Bajar Bandera (Eliminar)',
            'observer.start': 'Iniciar Partida',
            'observer.pause': 'Pausar',
            'observer.resume': 'Reanudar',
            'observer.abort': 'Cancelar Partida',
            'observer.playing': 'JUGANDO',
            'observer.player_prefix': 'Jugador',
            'modal_create.title': 'Configurar Nueva Mesa',
            'modal_create.field_name': '1. Nombre de la Mesa',
            'modal_create.hint_name': 'Identificación visual de la mesa para los jugadores.',
            'modal_create.field_gametype': '2. Tipo de Juego',
            'modal_create.gametype_inclusive': 'INCLUSIVO - Audio descriptivo',
            'modal_create.gametype_conventional': 'CONVENCIONAL - Pitidos de sonido',
            'modal_create.hint_gametype': 'Voz narrativa o solo pitidos.',
            'modal_create.field_time': '3. Tiempo (Minutos)',
            'modal_create.hint_time': 'Tiempo base de cada jugador.',
            'modal_create.field_inc': '4. Incremento (Segundos / Jugada)',
            'modal_create.hint_inc': 'Incremento por jugada realizada.',
            'modal_create.btn_submit': 'Crear Mesa',
            'modal_create.btn_cancel': 'Cancelar',
            'dialog.confirm_title': 'Confirmar Acción',
            'dialog.confirm_message': '¿Realmente desea continuar?',
            'dialog.btn_confirm': 'Confirmar',
            'dialog.btn_cancel': 'Cancelar'
        }
    }
};

class QuaTimeI18n {
    constructor() {
        this.currentLang = this._detectLanguage();
        this._persist(this.currentLang);
    }

    _detectLanguage() {
        // 1. URL Query parameter ?lang=
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && ['pt', 'en', 'es'].includes(urlLang.toLowerCase())) {
            return urlLang.toLowerCase();
        }

        // 2. Cookie 'quatime_lang'
        const match = document.cookie.match(/(?:^|;\s*)quatime_lang=([a-zA-Z-]+)/);
        if (match && match[1]) {
            const raw = match[1].toLowerCase();
            if (raw.startsWith('pt')) return 'pt';
            if (raw.startsWith('en')) return 'en';
            if (raw.startsWith('es')) return 'es';
        }

        // 3. LocalStorage
        try {
            const stored = localStorage.getItem('quatime_language');
            if (stored && ['pt', 'en', 'es'].includes(stored.toLowerCase())) {
                return stored.toLowerCase();
            }
        } catch (_) {}

        // 4. Idioma do Navegador
        const nav = (navigator.language || navigator.userLanguage || 'pt').toLowerCase();
        if (nav.startsWith('en')) return 'en';
        if (nav.startsWith('es')) return 'es';
        return 'pt';
    }

    _persist(lang) {
        try {
            localStorage.setItem('quatime_language', lang);
        } catch (_) {}

        try {
            document.cookie = `quatime_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
        } catch (_) {}
    }

    setLanguage(lang) {
        if (!['pt', 'en', 'es'].includes(lang)) return;
        this.currentLang = lang;
        this._persist(lang);
        this.apply();
        window.dispatchEvent(new CustomEvent('quatime:languageChanged', { detail: { lang } }));
    }

    getConfig() {
        return QUATIME_TRANSLATIONS[this.currentLang] || QUATIME_TRANSLATIONS.pt;
    }

    getColorName(colorKey) {
        if (!colorKey) return '';
        const lower = colorKey.toLowerCase();
        const cfg = this.getConfig();
        return (cfg.colors && cfg.colors[lower]) ? cfg.colors[lower] : colorKey;
    }

    getVoiceTexts() {
        return this.getConfig().voice;
    }

    t(key, ...params) {
        const cfg = this.getConfig();
        let val = (cfg.texts && cfg.texts[key]) ? cfg.texts[key] : (QUATIME_TRANSLATIONS.pt.texts[key] || key);
        if (params && params.length > 0) {
            params.forEach((p, idx) => {
                val = val.replace(new RegExp(`\\{${idx}\\}`, 'g'), p);
            });
        }
        return val;
    }

    apply() {
        // Atualiza elementos com atributo data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                el.innerText = this.t(key);
            }
        });

        // Atualiza placeholders com data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.setAttribute('placeholder', this.t(key));
            }
        });

        // Atualiza títulos com data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                el.setAttribute('title', this.t(key));
            }
        });

        // Atualiza badge/seletor de idioma no topo se existir
        const pillText = document.getElementById('currentLangPillText');
        const pillFlag = document.getElementById('currentLangPillFlag');
        const cfg = this.getConfig();
        if (pillText) pillText.innerText = cfg.code.split('-')[0].toUpperCase();
        if (pillFlag) pillFlag.innerText = cfg.flag;
    }
}

// Instância global disponível em todo o aplicativo
const i18n = new QuaTimeI18n();
window.i18n = i18n;

// Helper global para alternar idioma
window.switchLanguage = function(lang) {
    if (window.i18n) {
        window.i18n.setLanguage(lang);
    }
    const menu = document.getElementById('langDropdownMenu');
    if (menu) menu.style.display = 'none';
};

window.toggleLanguageMenu = function(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('langDropdownMenu');
    if (!menu) return;
    menu.style.display = (menu.style.display === 'flex' || menu.style.display === 'block') ? 'none' : 'flex';
};

document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('langSelectorWrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        const menu = document.getElementById('langDropdownMenu');
        if (menu) menu.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    i18n.apply();
});
