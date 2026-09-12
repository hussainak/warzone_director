# AGENTS.md - Warzone Project Standards & Specification

## 1. Mandatory Protocols
### 1.1 "Always Document"
> **CRITICAL RULE**: Every feature, architectural design decision, code modification, new game mechanic, system expansion, and debugging discovery in this project **must be thoroughly documented**.
> - Whenever code is modified or new systems are added, update the relevant documentation in this file or project docs.
> - Maintain clean code comments and architectural explanations so that any developer or agent can understand and extend any part of the engine.

### 1.2 "Always Publish & Deploy"
> **CRITICAL RULE**: Every new version, feature, bug fix, balance adjustment, or visual improvement **must be immediately committed, pushed to `origin/main`, and deployed to GitHub Pages**.
> - **Public Live URL**: **`https://hussainak.github.io/warzone_director/`**
> - The repository must remain public with GitHub Pages enabled on `main` at `/`.
> - Always verify that the public GitHub Pages build is updated and accessible after pushing changes.

---

## 2. Project Overview: Warzone
**Warzone** is an isometric, tactical real-time strategy (RTS) and base-building game built with pure HTML5 Canvas and Vanilla JavaScript (ES modules) and styled with responsive Vanilla CSS. It blends the city/base building, resource gathering, and unit recruitment of *Age of Empires* with the modern military combat and active hero abilities of *Command & Conquer: Generals*.

### Visual Style: Morning Tactical Battlefield
- **Time of Day**: Bright sunny morning daylight inspired by classic *Age of Empires II*.
- **Terrain**: Vibrant emerald and spring-green grasslands, sandy riverbanks, animated azure water with waves, bright paved concrete foundations, and morning directional shadows.
- **Full Battlefield & Rival Army Visibility**: The entire map terrain, enemy bases, and rival armies are fully visible in real time. Players can monitor opposing factions as they establish outposts, assemble armor columns, and construct base facilities.

---

## 3. Architecture & Code Structure

```
warzone_director/
├── AGENTS.md                # Project guidelines, architecture, and documentation
├── index.html               # Game viewport, tactical HUD, AoE command dock, minimap radar
├── css/
│   └── style.css            # Tactical military UI, morning accents, glassmorphic panels
└── js/
    ├── main.js              # Game initialization and orchestrator
    ├── config.js            # Balance constants, unit/building definitions, wave tables
    ├── audio.js             # Web Audio API procedural sound synthesizer
    ├── engine/
    │   ├── camera.js        # Isometric 2.5D camera, coordinate transforms, edge pan & zoom
    │   ├── map.js           # Morning terrain tilemap, obstacles, resource nodes
    │   ├── fogOfWar.js      # Line-of-sight & exploration system
    │   ├── pathfinding.js   # A* grid navigation and unit avoidance
    │   └── particles.js     # Smoke, fire, muzzle flash, explosions, move waypoints
    ├── entities/
    │   ├── entity.js        # Base entity (HP, team, position, bounding box)
    │   ├── hero.js          # Player Hero Commander with 4 active abilities
    │   ├── unit.js          # Infantry, armored vehicles, helicopters, patrol AI
    │   ├── building.js      # Base structures, automated enemy base construction
    │   └── projectile.js    # Ballistic shells, bullets, missiles with trails
    ├── systems/
    │   ├── economy.js       # Money, power, supply stockpiles, trade mechanics
    │   ├── invasion.js      # Wave spawner (5 min initial peace timer, early trigger button)
    │   ├── combat.js        # Targeting, range validation, ballistic damage
    │   └── input.js         # Mouse selection box, command issuing, move target rings, hotkeys
    └── ui/
        ├── hud.js           # Resource bars, minimap rendering, selection cards, enemy jump buttons
        └── tradeModal.js    # Tactical market exchange and mercenary procurement
```

---

## 4. Game Systems & Mechanics

### 4.1 Player Starting Force & Armies
- **Hero Commander**: Elite operative leading the strike force.
- **Starting Armies**:
  - 4x Spec-Ops Riflemen
  - 2x Marksman Snipers
  - 2x Anti-Armor RPG Troopers
  - 2x Fast Recon Buggies
  - 1x Abrams Heavy Battle Tank
- **Starting Base**: Command HQ, Solar Reactor (+140 MW), Barracks, War Factory, and 2x Minigun Pillboxes.

### 4.2 Visible Rival Armies & Base Building
- **Full Tactical Awareness**: Enemy bases and armies are visible on both the tactical map and minimap radar.
- **Rival Faction Encampments**:
  1. **Red Talon Outpost (North-East)** at (50, 16): Headquarters, Barracks, Minigun Pillboxes, Technical Trucks, and patrolling militia.
  2. **Shadow Syndicate Fortress (South-East)** at (50, 50): Command HQ, Heavy War Factory, SAM Missile Battery, and Abrams-tier Shadow Tanks.
  3. **River Raiders Encampment (South-West)** at (16, 46): Barracks, defense turret, combat buggies, guarding the southern river bridge crossing.
- **Dynamic Enemy Construction**: Enemy barracks and war factories actively manufacture reinforcement units and cycle perimeter patrols.

### 4.3 Delayed Invasion & Early Trigger Option
- **Pacing**: Initial peaceful development window set to **300 seconds (5 minutes)**, allowing players to build bases, assemble columns, trade, and explore at their leisure.
- **Early Trigger**: "CALL WAVE NOW" button lets players summon the next hostile wave immediately when ready.

### 4.4 Controls & Camera Navigation
- **Left Click**: Select single unit/building or drag selection box across multiple units.
- **Right Click**: Issue Move / Attack order with animated green move waypoint rings.
- **Camera Movement**: WASD / Arrow keys, screen edge panning, on-screen D-Pad, or clicking minimap and sector jump buttons.
- **Spacebar / Focus Button**: Centers camera directly on player base.
- **Mouse Wheel**: Smooth zoom.

### 4.5 Realistic Military Visuals & Unit Design
- **Spec-Ops Rifleman**: Digital woodland/multicam camouflage trousers, combat boots with sole tread, high-impact knee pads, Crye-style MOLLE plate carrier with 3x STANAG 5.56mm magazine pouches, left shoulder radio with whip antenna, FAST high-cut ballistic helmet with Wilcox NVG shroud and cyan dual-tube night vision goggles, and M4A1 SOPMOD carbine (EOTech holographic sight, vertical foregrip, suppressor, and tactical laser pointer).
- **Marksman Sniper**: Textured 3D ghillie foliage scrim cloak draping over shoulders/back, sniper boonie hat, and heavy Barrett M82 .50 Cal anti-materiel rifle with fluted barrel, iconic dual-baffle arrowhead muzzle brake, high-power optical scope with anti-glare lens glint, folded Harris bipod, and 10-round steel box magazine.
- **Anti-Armor RPG Specialist**: Heavy assault backpack carrying **2x spare PG-7VL rocket warheads** visibly protruding above both shoulders, blast goggles, and shoulder-mounted RPG-7 launcher with wooden heat shield, PGO-7 optical sight, flared front tube, and loaded PG-7VL shaped-charge warhead.
- **Rogue Insurgent / Militiaman**: Desert khaki fatigues, chest webbing rig, head wrapped in a traditional desert Shemagh / Keffiyeh scarf with eye slit, and AK-47 assault rifle with stamped receiver, curved orange banana magazine, wooden handguard and buttstock, and hooded front sight post.
- **Hero Commander "Vanguard"**: Elite spec-ops commander with tactical exosuit frame, gold officer rank epaulets, glowing cyan holographic HUD visor, left-wrist gauntlet with holo-projector, customized suppressed Mk18 CQBR carbine, sidearm holster, dynamic walking stride, and floating level star badge (`★ LVL ${level}`).
- **M1A2 Abrams Battle Tank**: Continuous caterpillar tracks with 6 roadwheels per side, animated rubber chevron track pads, heavy side-skirt armor with modular rectangular ERA tiles, slanted glacis plate, faceted Chobham turret, 120mm smoothbore cannon with central bore evacuator and muzzle collimator, commander .50 cal cupola, bustle storage rack, and dual 6-tube smoke grenade dischargers.
- **Fast Attack Buggy**: 4 oversized knobby all-terrain tires with aluminum wheel hubs, tubular roll-cage chassis, front bull-bar brush guard with winch, rear utility bed with strapped spare tire and fuel jerry cans, and rotating pintle turret with twin heavy machine guns.
- **AH-64 Apache Attack Gunship**: Aerodynamic matte olive fuselage, stepped tandem cockpits with blue polarized glass, twin turbine engine pods, 4-blade spinning rotor with aerodynamic blur disc, tail boom with tail rotor, stub wings armed with 8x AGM-114 Hellfires and twin 19-tube Hydra 70 rocket pods, and nose-mounted 30mm chain gun.

### 4.6 Tactical Mission Briefing & Start Screen Overlay
- **Start Screen Overlay (`#briefing-modal`)**: Greets player on first load with a high-impact military briefing card.
- **4-Step Quick Summarized Guide**:
  1. *Direct Your Strike Force* (Right-click move, box drag select, WASD/Edge pan).
  2. *Establish Forward Base* (Deploy Barracks, War Factory, Helipads, Turrets).
  3. *Secure Oil Derricks & Trade Hub* (Capture derricks for passive income, exchange commodities, call mercenary airdrops).
  4. *Repel Rival Hostile Armies* (5-minute peace countdown, or early trigger with "CALL WAVE NOW").
- **Commence Operation Button (`#btn-start-game`)**: Prominent glowing tactical button that starts the game loop, initializes Web Audio API on user gesture, plays radio squelch, and closes the modal.
- **Keyboard Shortcuts**: Pressing `ENTER` or `SPACEBAR` also triggers game start immediately.

### 4.7 iPad & Touchscreen Navigation (Tap-Drag Pan & Pinch-to-Zoom)
- **Fluid Tap-Drag Panning**: On iPad and mobile touch devices, players can smoothly drag single fingers across the battlefield to pan the isometric camera in any direction without unwanted browser viewport bouncing (enforced via CSS `touch-action: none;` and `-webkit-touch-callout: none;`).
- **Continuous Pinch-to-Zoom**: Two-finger pinch gestures scale the camera zoom continuously using direct distance ratios (`zoomByRatio(ratio)`) between `0.40x` and `2.40x`, complemented by native iOS Safari `gesturestart`, `gesturechange`, and `gestureend` handlers.
- **Touch Selection & Commands**:
  - Single tap selects units or buildings under finger.
  - Tapping ground while units are selected issues move/attack orders.
  - Long press (500ms) issues an immediate tactical move or attack order with animated green waypoints.

### 4.8 Civilian Agricultural Economy & Farmers (Age of Empires Hybrid)
- **Agricultural Farm Plot (`farm`)**: 2x2 base structure ($140) featuring tilled fertile soil, rows of swaying golden wheat and green maize, rustic cedar tool shed, and an automated rotating micro-irrigation sprinkler with cyan water mist. Generates passive base funds ($16/s) and trains civilian workers.
- **Civilian Farmer / Worker (`worker`)**: Civilian unit ($50, 130 HP) dressed in realistic agricultural attire (red plaid flannel shirt, denim overalls with brass buckles, brown leather boots, wide-brim woven straw sunhat, and steel pitchfork/hoe tool).
- **Autonomous Agricultural Harvesting**: When stationed near an active farm, farmers cultivate crops every 3.8s, yielding `+$18 HARVEST` deposits directly into player funds accompanied by gold floating text and coin audio.
- **Autonomous Building Repair**: Damaged allied structures within 3.2 tiles are automatically patched and repaired by farmers (+30 HP/s, with `+🔨 REPAIR` notifications).
- **Recruitment**: Farmers can be recruited at the Command HQ, Agricultural Farms, or Infantry Barracks.

### 4.9 Tactical Simulation Pause System
- **Timeline Freeze with Free Camera Navigation**: Pausing the game freezes combat, unit movement, invasion timers, and production while keeping the isometric camera, zoom, and tactical inspection fully operational.
- **HUD Pause Button (`#btn-toggle-pause`)**: Located in the top-right toolbar with dynamic icon toggle (`⏸️ PAUSE` / `▶ RESUME`).
- **Keyboard Hotkey `P`**: Pressing `P` toggles pause at any time during gameplay.
- **Tactical Pause Overlay (`#pause-overlay`)**: Sleek dark modal overlay indicating simulation hold, resumable via button click, `[P]` key, or clicking the semi-transparent backdrop.

---

## 5. Public Deployment & GitHub Pages
- **Hosting**: GitHub Pages (Branch: `main`, Path: `/`)
- **Public URL**: [https://hussainak.github.io/warzone_director/](https://hussainak.github.io/warzone_director/)
- **Deployment Flow**:
  1. Commit all modified files with descriptive commit message.
  2. Push to `origin main`.
  3. Verify GitHub Pages build status with `gh api repos/hussainak/warzone_director/pages`.
  4. Ensure live web access and zero 404s.
