// js/main.js - Game Loop, Entity Orchestration, and Morning Rendering Pipeline

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

    // Player Hero Commander
    this.hero = new HeroCommander(20, 20);
    this.units = [];
    this.buildings = [];
    this.projectiles = [];

    // Combat & Invasion Directors
    this.combat = new CombatSystem(this.economy, this.hero, this.particles, this.map);
    this.invasion = new InvasionDirector(
      (type, x, y) => this.spawnUnit(type, x, y, "enemy"),
      { x: 18, y: 17 },
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

    // Wire Callbacks
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

    const waveTriggerBtn = document.getElementById("btn-launch-wave-now");
    if (waveTriggerBtn) {
      waveTriggerBtn.addEventListener("click", () => {
        this.invasion.triggerNextWaveEarly();
        this.particles.addFloatingText(this.hero.x, this.hero.y, "HOSTILE INVASION TRIGGERED!", "#ff3333", 16);
        Sound.playRadioChirp();
      });
    }

    // Camera Quick Jump Buttons for Sectors
    const jumpHomeBtn = document.getElementById("jump-sector-home");
    if (jumpHomeBtn) jumpHomeBtn.addEventListener("click", () => this.camera.centerOn(20, 20));

    const jumpNorthBtn = document.getElementById("jump-sector-north");
    if (jumpNorthBtn) jumpNorthBtn.addEventListener("click", () => this.camera.centerOn(50, 16));

    const jumpSouthBtn = document.getElementById("jump-sector-south");
    if (jumpSouthBtn) jumpSouthBtn.addEventListener("click", () => this.camera.centerOn(50, 50));

    const jumpRiverBtn = document.getElementById("jump-sector-river");
    if (jumpRiverBtn) jumpRiverBtn.addEventListener("click", () => this.camera.centerOn(16, 46));

    // Tactical Pause State
    this.isPaused = false;
    window.__togglePause = () => this.togglePause();

    // Audio init & Start Game Handler
    window.__startGame = () => {
      Sound.init();
      Sound.playRadioChirp();
      this.particles.addFloatingText(this.hero.x, this.hero.y, "OPERATION COMMENCED! GOOD LUCK COMMANDER", "#38ef7d", 16);
    };

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

  togglePause() {
    this.isPaused = !this.isPaused;
    const pauseOverlay = document.getElementById("pause-overlay");
    const pauseBtnIcon = document.getElementById("pause-btn-icon");
    const pauseBtnLabel = document.getElementById("pause-btn-label");

    if (this.isPaused) {
      if (pauseOverlay) pauseOverlay.classList.remove("hidden");
      if (pauseBtnIcon) pauseBtnIcon.textContent = "▶";
      if (pauseBtnLabel) pauseBtnLabel.textContent = "RESUME";
      Sound.playRadioChirp();
    } else {
      if (pauseOverlay) pauseOverlay.classList.add("hidden");
      if (pauseBtnIcon) pauseBtnIcon.textContent = "⏸️";
      if (pauseBtnLabel) pauseBtnLabel.textContent = "PAUSE";
      Sound.playRadioChirp();
    }
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupStartingWorld() {
    // 1. Player Base Structures
    this.spawnBuilding("hq", 18, 16, "player", true);
    this.spawnBuilding("farm", 14, 15, "player", true); // Agricultural Farm Plot (Age of Empires economy)
    this.spawnBuilding("power", 14, 21, "player", true);
    this.spawnBuilding("barracks", 23, 17, "player", true);
    this.spawnBuilding("factory", 22, 22, "player", true);
    this.spawnBuilding("turret", 13, 18, "player", true);
    this.spawnBuilding("turret", 27, 18, "player", true);

    // 2. Civilian Farmers / Workers (cultivates crops +$18 harvest, repairs damaged buildings)
    this.spawnUnit("worker", 15, 17, "player");
    this.spawnUnit("worker", 16, 17, "player");
    this.spawnUnit("worker", 17, 18, "player");

    // 3. Full Player Starting Army (Infantry squads, buggies, tank)
    this.spawnUnit("rifleman", 20, 18, "player");
    this.spawnUnit("rifleman", 21, 19, "player");
    this.spawnUnit("rifleman", 19, 21, "player");
    this.spawnUnit("rifleman", 18, 20, "player");

    this.spawnUnit("sniper", 22, 20, "player");
    this.spawnUnit("sniper", 23, 21, "player");

    this.spawnUnit("rpg", 19, 22, "player");
    this.spawnUnit("rpg", 20, 23, "player");

    this.spawnUnit("buggy", 25, 21, "player");
    this.spawnUnit("buggy", 25, 23, "player");

    this.spawnUnit("tank", 21, 25, "player");

    // 3. Enemy Fortified Base 1: Red Talon Stronghold (North-East)
    this.spawnBuilding("hq", 51, 13, "enemy", true);
    this.spawnBuilding("barracks", 48, 17, "enemy", true);
    this.spawnBuilding("turret", 46, 14, "enemy", true);
    this.spawnBuilding("turret", 54, 18, "enemy", true);
    this.spawnUnit("enemy_technical", 52, 19, "enemy");
    this.spawnUnit("enemy_technical", 47, 19, "enemy");
    this.spawnUnit("enemy_militia", 50, 16, "enemy");
    this.spawnUnit("enemy_militia", 53, 17, "enemy");
    this.spawnUnit("enemy_rpg", 49, 15, "enemy");

    // 4. Enemy Fortified Base 2: Shadow Syndicate Complex (South-East)
    this.spawnBuilding("hq", 51, 47, "enemy", true);
    this.spawnBuilding("factory", 48, 52, "enemy", true);
    this.spawnBuilding("sam", 46, 48, "enemy", true);
    this.spawnBuilding("turret", 55, 53, "enemy", true);
    this.spawnUnit("enemy_tank", 52, 53, "enemy");
    this.spawnUnit("enemy_tank", 49, 56, "enemy");
    this.spawnUnit("enemy_technical", 54, 49, "enemy");
    this.spawnUnit("enemy_rpg", 47, 51, "enemy");
    this.spawnUnit("enemy_rpg", 52, 51, "enemy");
    this.spawnUnit("enemy_militia", 50, 49, "enemy");

    // 5. Enemy Fortified Base 3: River Raiders Camp (South-West Bridgehead)
    this.spawnBuilding("barracks", 15, 46, "enemy", true);
    this.spawnBuilding("turret", 18, 44, "enemy", true);
    this.spawnUnit("enemy_technical", 16, 49, "enemy");
    this.spawnUnit("enemy_militia", 14, 48, "enemy");
    this.spawnUnit("enemy_rpg", 17, 47, "enemy");

    // Center camera squarely on player base
    this.camera.centerOn(20, 20);
  }

  spawnBuilding(buildingType, x, y, team = "player", isInstant = false) {
    const building = new Building(x, y, buildingType, team, isInstant);
    this.buildings.push(building);

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

    // Camera navigation (WASD, edge panning, touch drag) updates smoothly even while paused
    this.camera.update(dt);

    if (this.isPaused) {
      // Keep selection cards and HUD updated, but freeze world timeline & combat
      this.hud.update(0, allEntities);
      return;
    }

    this.fogOfWar.update(dt, alliedEntities);

    this.hero.update(
      dt,
      allEntities,
      this.pathfinding,
      this.particles,
      this.projectiles,
      this.fogOfWar,
      (type, x, y) => this.spawnBuilding(type, x, y, "player")
    );

    for (let i = 0; i < this.units.length; i++) {
      this.units[i].update(dt, allEntities, this.pathfinding, this.particles, this.projectiles, this.economy);
    }

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

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, allEntities, this.particles, Sound);
      if (p.isDead) {
        this.projectiles.splice(i, 1);
      }
    }

    this.particles.update(dt);
    this.combat.update(dt, this.units, this.buildings, allEntities);

    const capturedOilCount = this.map.resourceNodes.filter((n) => n.type === "oil" && n.captured).length;
    this.economy.updatePowerGrid(this.buildings);
    this.economy.update(dt, this.buildings, capturedOilCount);

    this.invasion.update(dt, this.units, this.pathfinding, this.particles);
    this.hud.update(dt, allEntities);
  }

  render() {
    this.ctx.fillStyle = "#8fc0e6";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.camera.applyTransform(this.ctx);

    // 1. Morning Terrain Map & Resource Nodes
    this.map.render(this.ctx, this.camera, this.fogOfWar);

    // 2. Ground Scorch Decals & Move Waypoint Target Rings
    this.particles.renderDecals(this.ctx, this.camera);

    // 3. Isometric Depth-Sorted Entities (Both Allied and Enemy Armies & Bases are Fully Visible)
    const renderableEntities = [this.hero, ...this.units, ...this.buildings].filter((e) => !e.isDead);

    renderableEntities.sort((a, b) => {
      const depthA = a.w ? a.x + a.w / 2 + (a.y + a.h / 2) : a.x + a.y;
      const depthB = b.w ? b.x + b.w / 2 + (b.y + b.h / 2) : b.x + b.y;
      return depthA - depthB;
    });

    for (let i = 0; i < renderableEntities.length; i++) {
      renderableEntities[i].render(this.ctx, this.camera);
    }

    // 4. Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].render(this.ctx, this.camera);
    }

    // 5. Air Particles
    this.particles.render(this.ctx, this.camera);

    // 6. Fog of War Shroud & Active Recon Sweeps
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
