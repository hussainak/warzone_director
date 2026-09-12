# AGENTS.md - Warzone Project Standards & Specification

## 1. Mandatory Protocol: "Always Document"
> **CRITICAL RULE**: Every feature, architectural design decision, code modification, new game mechanic, system expansion, and debugging discovery in this project **must be thoroughly documented**.
> - Whenever code is modified or new systems are added, update the relevant documentation in this file or project docs.
> - Maintain clean code comments and architectural explanations so that any developer or agent can understand and extend any part of the engine.

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
