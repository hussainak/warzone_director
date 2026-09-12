# AGENTS.md - Warzone Project Standards & Specification

## 1. Mandatory Protocol: "Always Document"
> **CRITICAL RULE**: Every feature, architectural design decision, code modification, new game mechanic, system expansion, and debugging discovery in this project **must be thoroughly documented**.
> - Whenever code is modified or new systems are added, update the relevant documentation in this file or project docs.
> - Maintain clean code comments and architectural explanations so that any developer or agent can understand and extend any part of the engine.

---

## 2. Project Overview: Warzone
**Warzone** is an isometric, tactical real-time strategy (RTS) and base-building game built with pure HTML5 Canvas and Vanilla JavaScript (ES modules) and styled with responsive Vanilla CSS. It blends the city/base building, resource gathering, and unit recruitment of *Age of Empires* with the modern military combat and active hero abilities of *Command & Conquer: Generals*.

### Key Pillars
1. **Active Hero Commander**: The player controls a high-tech Hero Operative who can fight, level up, deploy battlefield assets, and lead strikes.
2. **Base & Factory Construction**: Players construct HQs, Power Plants, Barracks, War Factories, Helipads, and defensive Turrets on an isometric grid.
3. **Modern Economy & Trade**: Resources include **Funds ($)**, **Power (MW)**, and **Tech Supplies**. A real-time Trade Hub allows buying/selling supplies and calling in mercenary drops.
4. **Hostile Invasions**: Escalating waves of enemy forces ("Shadow Coalition") launch coordinated attacks with siren warnings, requiring fortified base defenses and tactical hero interventions.
5. **Modern Ballistics & Weaponry**: Automatic rifles, anti-tank RPGs, tank cannon shells, cruise missiles, and drone airstrikes with realistic particle physics and synthesized audio.

---

## 3. Architecture & Code Structure

```
warzone_director/
├── AGENTS.md                # Project guidelines, architecture, and documentation
├── index.html               # Game viewport, tactical HUD, AoE command dock, minimap radar
├── css/
│   └── style.css            # Dark tactical military UI, glassmorphic panels, scanlines
└── js/
    ├── main.js              # Game initialization and orchestrator
    ├── config.js            # Balance constants, unit/building definitions, wave tables
    ├── audio.js             # Web Audio API procedural sound synthesizer
    ├── engine/
    │   ├── camera.js        # Isometric 2.5D camera, coordinate transforms, pan & zoom
    │   ├── map.js           # Terrain tilemap, obstacles, resource nodes
    │   ├── fogOfWar.js      # Line-of-sight & exploration system
    │   ├── pathfinding.js   # A* grid navigation and unit avoidance
    │   └── particles.js     # Smoke, fire, muzzle flash, explosions, floating numbers
    ├── entities/
    │   ├── entity.js        # Base entity (HP, team, position, bounding box)
    │   ├── hero.js          # Player Hero Commander with 4 active abilities
    │   ├── unit.js          # Infantry, armored vehicles, helicopters
    │   ├── building.js      # Base structures, construction queues, power drains
    │   └── projectile.js    # Ballistic shells, bullets, missiles with trails
    ├── systems/
    │   ├── economy.js       # Money, power, supply stockpiles, trade mechanics
    │   ├── invasion.js      # Wave spawner, enemy outpost AI, invasion sirens
    │   ├── combat.js        # Targeting, range validation, ballistic damage
    │   └── input.js         # Mouse selection box, command issuing, hotkeys, ghost placement
    └── ui/
        ├── hud.js           # Resource bars, minimap rendering, selection cards, ability buttons
        └── tradeModal.js    # Tactical market exchange and mercenary procurement
```

---

## 4. Game Systems & Mechanics

### 4.1 Hero Commander
- **Attributes**: Level 1-10, Health, Energy, Damage, Attack Range, Movement Speed.
- **Abilities**:
  - `[Q] Recon Drone`: Reveals target sector through fog of war.
  - `[W] Sentry Turret`: Deploys a stationary automated minigun turret for 30s.
  - `[E] Field Repair / Medevac`: Restores health to Hero and all nearby allied units/buildings.
  - `[R] Cruise Missile Strike`: Calls down a devastating tactical missile strike with high explosive AOE damage.

### 4.2 Base & Factory Building
- **Command HQ**: Central base, generates passive funds ($25/sec), unlocks tech tree.
- **Solar / Nuclear Power Plant**: Produces +100 MW power. Low power disables radar and reduces turret fire rate.
- **Barracks**: Trains Spec-Ops Riflemen, Snipers, and Anti-Tank RPG Operators.
- **War Factory**: Fabricates Light Combat Buggies, Armored Personnel Carriers (APCs), and Main Battle Tanks.
- **Helipad**: Produces Attack Gunships with high mobility and aerial rockets.
- **Trade Hub / Market**: Generates steady trading profits and enables dynamic resource exchange.
- **Defense Turrets**: Minigun Pillboxes (anti-infantry) and SAM Rocket Batteries (anti-vehicle/anti-air).

### 4.3 Economy & Trade
- **Funds ($)**: Primary currency for units, buildings, and market purchases.
- **Power (MW)**: Grid consumption versus output; keeps radar and automated defenses active.
- **Tech Supplies**: Gathered from supply crates and oil derricks on the map or imported via Trade Hub.
- **Trade Hub Exchange**: Allows instant buying/selling of tech supplies, market speculation, and calling emergency supply airdrops.

### 4.4 Invasions & Enemy AI
- **Invasion Alert**: Red alert siren sounds 30 seconds prior to each wave, displaying wave number and enemy strike vector on the minimap.
- **Escalation**: Early waves feature light scout patrols; later waves bring armored columns, rocket artillery, and heavy battle tanks.
- **Enemy Outposts**: Hostile fortified bases spawn across the map. Eradicating enemy bases grants massive tech rewards and victory.

### 4.5 Controls
- **Left Click**: Select unit / structure or drag to box-select multiple units.
- **Right Click**: Issue Move / Attack / Build / Gather order to selected units.
- **WASD / Arrow Keys / Screen Edges**: Pan the isometric camera.
- **Mouse Wheel**: Zoom in and out.
- **Keys Q, W, E, R**: Trigger Hero Commander tactical abilities.
- **Key B**: Toggle Base Construction Menu.
- **Spacebar**: Center camera on Hero Commander.
- **Escape**: Cancel active build placement or deselect.

---

## 5. Technical Design & Asset Strategy
- **Visuals**: Procedural 2.5D vector canvas rendering with isometric depth sorting, dynamic muzzle flashes, tank track marks, smoke plumes, and shadow projections.
- **Audio Engine**: Synthesized in real-time using the HTML5 Web Audio API (oscillators, noise buffers, custom envelope filters for gunfire, rocket whooshes, tank cannon booms, and air-raid sirens). Zero external asset loading latency.
- **Performance**: Target 60 FPS across desktop and modern browsers. Pathfinding is cached and decoupled from per-frame rendering.
