// js/main.js - Game Loop, Entity Orchestration, and Rendering Pipeline

import { Camera } from "./engine/camera.js";
import { TerrainMap } from "./engine/map.js";
import { FogOfWar } from "./engine/fogOfWar.js";
import { Pathfinding } from "./engine/pathfinding.js";
import { ParticleSystem } from "./engine/particles.js";
import { HeroCommander } from "./entities/hero.js";
import { Unit } from "./entities/unit.js";
import { Building } from "./entities/building.js";
import { EconomySystem } from "./systems/economy.js";
import { CombatSystem } from "./systems/combat.js";
import { InvasionDirector } from "./systems/invasion.js";
import { InputSystem } from "./systems/input.js";
import { HUD } from "./ui/hud.js";
import { TradeModal } from "./ui/tradeModal.js";
import { Sound } from "./audio.js";

class Game {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    // Core Systems
    this.camera = new Camera(this.canvas);
    this.map = new TerrainMap();
    this.fogOfWar = new FogOfWar();
    this.pathfinding = new Pathfinding(this.map);
    this.particles = new ParticleSystem();
    this.economy = new EconomySystem();

    // Entities
    this.hero = new HeroCommander(18, 19);
    this.units = [];
    this.buildings = [];
    this.projectiles = [];

    // Combat & Invasion Directors
    this.combat = new CombatSystem(this.economy, this.hero, this.particles, this.map);
    this.invasion = new InvasionDirector(
      (type, x, y) => this.spawnUnit(type, x, y, "enemy"),
      { x: 17, y: 17 },
      this.hero
    );

    // Input & UI
    this.input = new InputSystem(
      this.canvas,
      this.camera,
      this.map,
      this.pathfinding,
      this.hero,
      this.economy,
      this.particles,
      this.projectiles,
      this.fogOfWar
    );

    this.hud = new HUD(this.economy, this.hero, this.invasion, this.camera, this.map, this.input);
    this.tradeModal = new TradeModal(this.economy, this.hero, (type, x, y) => this.spawnUnit(type, x, y, "player"));

    // Wire callbacks
    this.input.onSelectionChanged = (sel) => this.hud.updateSelectionCard(sel);
    this.input.onBuildPlaced = (bType, x, y) => this.spawnBuilding(bType, x, y, "player", false);
    this.input.onDeployTurret = (x, y) => this.spawnBuilding("turret", Math.floor(x), Math.floor(y), "player", true);

    const tradeOpenBtn = document.getElementById("btn-open-trade");
    if (tradeOpenBtn) {
      tradeOpenBtn.addEventListener("click", () => this.tradeModal.toggle());
    }

    const soundToggleBtn = document.getElementById("btn-toggle-sound");
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener("click", () => {
        const isMuted = Sound.toggleMute();
        soundToggleBtn.textContent = isMuted ? "🔇 SOUND: OFF" : "🔊 SOUND: ON";
      });
    }

    // Audio init on user gesture
    window.addEventListener(
      "click",
      () => {
        Sound.init();
      },
      { once: true }
    );

    this.setupStartingWorld();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupStartingWorld() {
    // Spawn Player HQ (instant)
    this.spawnBuilding("hq", 17, 16, "player", true);
    // Spawn Solar Grid (instant)
    this.spawnBuilding("power", 14, 20, "player", true);
    // Spawn Barracks (instant)
    this.spawnBuilding("barracks", 21, 19, "player", true);

    // Spawn initial player escort units
    this.spawnUnit("rifleman", 19, 18, "player");
    this.spawnUnit("rifleman", 20, 18, "player");
    this.spawnUnit("buggy", 21, 22, "player");

    // Spawn Enemy Outpost 1 (North-East)
    this.spawnBuilding("barracks", 52, 16, "enemy", true);
    this.spawnBuilding("turret", 49, 18, "enemy", true);
    this.spawnUnit("enemy_technical", 53, 19, "enemy");
    this.spawnUnit("enemy_militia", 51, 17, "enemy");

    // Spawn Enemy Outpost 2 (South-East Fortification)
    this.spawnBuilding("factory", 50, 50, "enemy", true);
    this.spawnBuilding("sam", 47, 52, "enemy", true);
    this.spawnUnit("enemy_tank", 52, 54, "enemy");
    this.spawnUnit("enemy_rpg", 48, 51, "enemy");

    // Center camera on base
    this.camera.centerOn(18, 18);
  }

  spawnBuilding(buildingType, x, y, team = "player", isInstant = false) {
    const building = new Building(x, y, buildingType, team, isInstant);
    this.buildings.push(building);

    // Mark terrain blocked
    for (let bx = x; bx < x + building.w; bx++) {
      for (let by = y; by < y + building.h; by++) {
        this.map.setBlocked(bx, by, true);
      }
    }

    return building;
  }

  spawnUnit(unitId, x, y, team = "player") {
    const unit = new Unit(x, y, unitId, team);
    this.units.push(unit);
    return unit;
  }

  getAllEntities() {
    const list = [this.hero, ...this.units, ...this.buildings];
    window.__allEntities = list;
    return list;
  }

  loop(currentTime) {
    const dt = Math.min(0.08, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    const allEntities = this.getAllEntities();
    const alliedEntities = allEntities.filter((e) => e.team === "player");

    // Update Camera
    this.camera.update(dt);

    // Update Fog of War
    this.fogOfWar.update(dt, alliedEntities);

    // Update Hero Commander
    this.hero.update(
      dt,
      allEntities,
      this.pathfinding,
      this.particles,
      this.projectiles,
      this.fogOfWar,
      (type, x, y) => this.spawnBuilding(type, x, y, "player")
    );

    // Update Units
    for (let i = 0; i < this.units.length; i++) {
      this.units[i].update(dt, allEntities, this.pathfinding, this.particles, this.projectiles);
    }

    // Update Buildings
    for (let i = 0; i < this.buildings.length; i++) {
      this.buildings[i].update(
        dt,
        allEntities,
        this.projectiles,
        this.particles,
        (uId, rx, ry, team) => this.spawnUnit(uId, rx, ry, team),
        this.economy
      );
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, allEntities, this.particles, Sound);
      if (p.isDead) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update Particles
    this.particles.update(dt);

    // Update Combat & Bounties
    this.combat.update(dt, this.units, this.buildings, allEntities);

    // Update Economy
    const capturedOilCount = this.map.resourceNodes.filter((n) => n.type === "oil" && n.captured).length;
    this.economy.updatePowerGrid(this.buildings);
    this.economy.update(dt, this.buildings, capturedOilCount);

    // Update Invasion Director
    this.invasion.update(dt, this.units, this.pathfinding, this.particles);

    // Update HUD
    this.hud.update(dt, allEntities);
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply 2.5D Isometric World Transform
    this.camera.applyTransform(this.ctx);

    // 1. Terrain Map & Resource Nodes
    this.map.render(this.ctx, this.camera, this.fogOfWar);

    // 2. Ground Scorch Decals & Tracks
    this.particles.renderDecals(this.ctx, this.camera);

    // 3. Isometric Depth-Sorted Entities (Buildings, Hero, Units)
    // In isometric projection, entities with smaller (x + y) are drawn first, behind larger (x + y)
    const renderableEntities = [this.hero, ...this.units, ...this.buildings].filter((e) => !e.isDead);

    renderableEntities.sort((a, b) => {
      const depthA = a.w ? a.x + a.w / 2 + (a.y + a.h / 2) : a.x + a.y;
      const depthB = b.w ? b.x + b.w / 2 + (b.y + b.h / 2) : b.x + b.y;
      return depthA - depthB;
    });

    for (let i = 0; i < renderableEntities.length; i++) {
      const ent = renderableEntities[i];

      // Fog of War check: only render enemies if tile is VISIBLE
      if (ent.team === "enemy") {
        const fog = this.fogOfWar.getState(Math.floor(ent.x), Math.floor(ent.y));
        if (fog !== 2) continue; // Hidden in fog
      }

      ent.render(this.ctx, this.camera);
    }

    // 4. Projectiles (Tracers, Rockets, Missiles)
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].render(this.ctx, this.camera);
    }

    // 5. Air Particles (Explosions, Smoke, Sparks, Floating Text)
    this.particles.render(this.ctx, this.camera);

    // 6. Fog of War Black Shroud
    this.fogOfWar.renderShroud(this.ctx, this.camera);

    // 7. World Overlays (Ghost Building Placement & Reticles)
    this.input.renderWorldOverlays(this.ctx);

    this.camera.restoreTransform(this.ctx);

    // 8. Screen-Space Drag Selection Box
    this.input.render(this.ctx);
  }
}

// Start Game on window load
window.addEventListener("DOMContentLoaded", () => {
  new Game();
});
