# Elite Explorer Copilot

> Copiloto de exploração espacial, exobiologia e navegação planetária em tempo real para **Elite Dangerous**, conectado diretamente aos logs locais do jogo (`Journal` + `Status.json` + `NavRoute.json`) e às redes da comunidade (**EDSM**, **EDDN**, **Spansh** e **INARA**).

---

## Principais Recursos

- **🌌 Cubo Galáctico 3D (`/index.html`):**
  - Renderização 3D interativa em Three.js dos sistemas estelares ao redor da sua posição atual com classificação espectral (**KGBFOAM** e exóticas).
  - **Radar de *Stratum Tectonicas*:** identifica sistemas com candidatos confirmados ou prováveis a *Stratum Tectonicas* na região (via Spansh + cache local).
  - **Caçador de Vazios (*Gaps* Procedurais):** detecta setores pouco explorados ao redor do cubo galáctico.
  - **Ancoragem Segura:** lista estações/portos no sistema atual e exibe tráfego recente de comandantes via **EDDN** ao vivo (ZeroMQ + SSE).
- **🪐 Sistema 3D — Orrery (`/system-orrery.html`):**
  - Mapa orbital 3D com estrela principal, planetas, luas, anéis, materiais de superfície, sinais DSS (Bio/Geo) e indicação de corpos pousáveis.
  - Transição automática para a visão do Sistema ao sair da atmosfera/órbita do planeta.
- **🎯 HUD de Superfície Planetária 2.5D (`Columbus View`):**
  - Alternância automática entre **Mapa Global (-180°/+180°)** em voo orbital e **Radar Tático (1.200 m)** próximo ao solo.
  - Nave/piloto fixo no centro do radar tático com grade holográfica móvel, altímetro, fita de bússola em tempo real e marcador da nave estacionada ao desembarcar a pé ou de SRV.
  - **Hodômetro de Exobiologia:** acompanha as 3 amostras (`Log` / `Sample` / `Analyse`), desenha o anel de distância mínima da colônia no solo (ex.: `500 m` para *Stratum*) com indicador visual de diversidade genética atingida.
  - Registro automático em mapa de pontos de interesse confirmados por GPS real (`Touchdown`, `Liftoff`, `Location`, `ApproachSettlement`, `CodexEntry`).
- **🛰️ Integração EDSM & EDDN + Comércio INARA:**
  - Envio opcional de telemetria e descobertas para o **EDSM** e publicação sanitizada para o **EDDN**.
  - Telas auxiliares para rotas comerciais INARA (`/trade.html`) e oportunidades de saída (`/copilot.html`).

---

## Pré-requisitos

- **Windows** com **Java 22** instalado (`java -version`).
- **Elite Dangerous** executado no mesmo computador (leitura automática de `%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous`), ou caminho customizado via `--elite.journal.dir`.
- **Maven** (apenas caso queira recompilar o projeto a partir do código-fonte).

---

## Como Executar (Modo Fácil — `iniciar.bat`)

1. Abra o arquivo [`iniciar.bat`](iniciar.bat) no Bloco de Notas (ou qualquer editor de texto).
2. Edite **apenas estas duas linhas** no topo e salve:
   ```bat
   set "CMDR_NAME=SEU_NOME_NO_JOGO"
   set "EDSM_API_KEY=SUA_CHAVE_DO_EDSM"
   ```
   - `CMDR_NAME`: se ficar vazio, o sistema tenta ler automaticamente do `Journal` do jogo.
   - `EDSM_API_KEY`: opcional (obtida em `https://www.edsm.net/en/settings/api`). Se ficar vazia, tudo funciona normalmente em modo local sem enviar telemetria ao EDSM.
3. Dê um duplo clique em **`iniciar.bat`**.
4. Acesse no navegador (também funciona em outro dispositivo na mesma rede local):
   ```
   http://localhost:8080
   ```

---

## Compilar a partir do Código-Fonte

```powershell
mvn clean package -DskipTests
```

Para executar manualmente passando parâmetros via linha de comando:

```powershell
java -jar target/elite-explorer-1.0.0.jar --edsm.commander.name="SEU_NOME" --edsm.api.key="SUA_CHAVE"
```

---

## Estrutura do Projeto

```text
.
├── iniciar.bat                                  # Inicializador Windows com parâmetros do Comandante/EDSM
├── pom.xml                                      # Projeto Maven (Spring Boot 3.3.4 / Java 22)
├── traderoutes.html                             # Fixture HTML do INARA para teste unitário do parser
├── cache/                                       # Cache local gerado em execução (ignorado pelo Git)
└── src/
    ├── main/
    │   ├── java/com/eliteexplorer/
    │   │   ├── EliteExplorerApplication.java    # Classe principal Spring Boot
    │   │   ├── controller/TradeRouteController.java
    │   │   ├── dto/                             # Modelos de telemetria, sistemas, bio e superfície
    │   │   ├── model/PlayerStatus.java
    │   │   └── service/                         # Watchers (Journal/Status), EDSM, EDDN, Spansh, INARA
    │   └── resources/
    │       ├── application.properties           # Porta (8080) e flags padrão (sem credenciais hardcoded)
    │       └── static/
    │           ├── index.html                   # Splash screen + Cubo Galáctico 3D + HUD de Superfície 2.5D
    │           ├── system-orrery.html           # Mapa 3D do Sistema Estelar
    │           ├── explorer.html / copilot.html / trade.html
    │           └── js/                          # splash.js, explorer.js, surface-navigator.js, system-orrery.js
    └── test/java/com/eliteexplorer/service/     # Testes do parser e cliente INARA
```

---

## Notas Técnicas

- **Telemetria em Tempo Real:** O backend monitora `Journal.*.log`, `Status.json` e `NavRoute.json` e envia atualizações instantâneas para o navegador via **Server-Sent Events (`/api/events/stream`)**.
- **Limitação Nativa do DSS no Jogo:** Os eventos `SAASignalsFound` / `FSSBodySignals` do Elite Dangerous informam apenas a **quantidade** de sinais minerais ou geológicos em um planeta, sem exportar latitude/longitude. As coordenadas reais desses locais só aparecem nos arquivos do jogo quando o comandante se aproxima ou pousa neles (`NearestDestination`).
- **Testes:**
  ```powershell
  mvn test -Dtest=InaraParserServiceTest
  ```
