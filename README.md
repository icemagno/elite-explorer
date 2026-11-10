# Elite Explorer Copilot

<img width="676" height="592" alt="004" src="https://github.com/user-attachments/assets/888acb31-c510-4106-a684-85e7227622d5" />

> Real-time space exploration, exobiology, and planetary surface navigation copilot for **Elite Dangerous**, connected directly to your local game logs (`Journal` + `Status.json` + `NavRoute.json`) and community networks (**EDSM**, **EDDN**, **Spansh**, and **INARA**).

---

<img width="1908" height="1066" alt="001" src="https://github.com/user-attachments/assets/3a08a342-6511-46e6-98c5-6543cecde46e" />

<img width="1905" height="1065" alt="002" src="https://github.com/user-attachments/assets/809c7930-f137-4f99-97ed-1eb8f8535de0" />
<img width="1907" height="1070" alt="003" src="https://github.com/user-attachments/assets/eac04c8f-a04c-4d34-86da-296bd72b8319" />

## Key Features

- **🌌 3D Galactic Cube (`/index.html`):**
  - Interactive Three.js 3D visualization of surrounding star systems with spectral classification (**KGBFOAM** and exotic stars).
  - **Stratum Tectonicas Radar:** highlights nearby systems with confirmed or likely *Stratum Tectonicas* candidates (via Spansh + local cache).
  - **Procedural Void Hunter:** detects unexplored gaps around the galactic cube.
  - **Safe Docking & Live Traffic:** lists stations/ports in the current system and streams live Commander traffic via **EDDN** (ZeroMQ + SSE).
- **🪐 3D Star System — Orrery (`/system-orrery.html`):**
  - Interactive 3D orbital map showing the primary star, planets, moons, rings, surface materials, DSS signals (Bio/Geo), and landable bodies.
  - Automatically switches back to the System view when leaving planetary orbit/atmosphere.
- **🎯 2.5D Planetary Surface HUD (`Columbus View`):**
  - Automatic transition between **Global Map (-180°/+180°)** during orbital flight and **Tactical Radar (1,200 m)** near the ground.
  - Player ship/pilot stays centered on the tactical radar with a scrolling holographic grid, altimeter, real-time compass tape, and parked ship tether beacon when disembarked on foot or in an SRV.
  - **Exobiology Odometer:** tracks all 3 genetic samples (`Log` / `Sample` / `Analyse`), renders the minimum colony exclusion ring on the ground (e.g., `500 m` for *Stratum*), and indicates when genetic diversity distance is reached.
  - Automatically records confirmed surface POIs with real GPS coordinates (`Touchdown`, `Liftoff`, `Location`, `ApproachSettlement`, `CodexEntry`).
- **🛰️ EDSM & EDDN Telemetry + INARA Trade:**
  - Optional telemetry/discovery sync to **EDSM** and privacy-sanitized journal publishing to **EDDN**.
  - Auxiliary views for INARA trade loops (`/trade.html`) and outbound trade opportunities (`/copilot.html`).

---

## Prerequisites

- **Windows** with **Java 22** installed (`java -version`).
- **Elite Dangerous** running on the same machine (automatically reads `%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous`), or a custom path passed via `--elite.journal.dir`.
- **Maven** (only needed if building from source).

---

## Quick Start (Easy Setup — `iniciar.bat`)

1. Open [`iniciar.bat`](iniciar.bat) in Notepad (or any text editor).
2. Edit **only these two lines** at the top and save:
   ```bat
   set "CMDR_NAME=YOUR_IN_GAME_COMMANDER_NAME"
   set "EDSM_API_KEY=YOUR_EDSM_API_KEY"
   ```
   - `CMDR_NAME`: if left empty, the app automatically reads your Commander name from the game's `Journal`.
   - `EDSM_API_KEY`: optional (available at `https://www.edsm.net/en/settings/api`). If left empty, everything works normally in local mode without pushing telemetry to EDSM.
3. Double-click **`iniciar.bat`**.
4. Open your browser (also accessible from other devices on your local network):
   ```
   http://localhost:8080
   ```

---

## Build from Source

```powershell
mvn clean package -DskipTests
```

To launch manually with command-line parameters:

```powershell
java -jar target/elite-explorer-1.0.0.jar --edsm.commander.name="YOUR_NAME" --edsm.api.key="YOUR_KEY"
```

---

## Project Structure

```text
.
├── iniciar.bat                                  # Windows launcher with Commander/EDSM parameters
├── pom.xml                                      # Maven project (Spring Boot 3.3.4 / Java 22)
├── traderoutes.html                             # Saved INARA HTML fixture for parser unit tests
├── cache/                                       # Local runtime cache (gitignored)
└── src/
    ├── main/
    │   ├── java/com/eliteexplorer/
    │   │   ├── EliteExplorerApplication.java    # Spring Boot entry point
    │   │   ├── controller/TradeRouteController.java
    │   │   ├── dto/                             # Telemetry, system, bio, and surface DTOs
    │   │   ├── model/PlayerStatus.java
    │   │   └── service/                         # Watchers (Journal/Status), EDSM, EDDN, Spansh, INARA
    │   └── resources/
    │       ├── application.properties           # Server port (8080) & default flags (no hardcoded secrets)
    │       └── static/
    │           ├── index.html                   # Splash screen + 3D Galactic Cube + 2.5D Surface HUD
    │           ├── system-orrery.html           # 3D Star System Orrery
    │           ├── explorer.html / copilot.html / trade.html
    │           └── js/                          # splash.js, explorer.js, surface-navigator.js, system-orrery.js
    └── test/java/com/eliteexplorer/service/     # INARA parser & client tests
```

---

## Technical Notes

- **Real-Time Telemetry:** The backend watches `Journal.*.log`, `Status.json`, and `NavRoute.json`, pushing live updates to the browser via **Server-Sent Events (`/api/events/stream`)**.
- **Native Game DSS Limitation:** Elite Dangerous `SAASignalsFound` / `FSSBodySignals` events only export the **count** of planetary mining or geological signals, without latitude/longitude coordinates. Exact coordinates only appear in game logs once the Commander approaches or lands near a site (`NearestDestination`).
- **Tests:**
  ```powershell
  mvn test -Dtest=InaraParserServiceTest
  ```
