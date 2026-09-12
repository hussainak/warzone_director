// js/systems/input.js - RTS Selection Box, Commands, Building Placement, and Hotkeys

import { BUILDINGS_CONFIG, MAP_CONFIG } from "../config.js";
import { Sound } from "../audio.js";

export class InputSystem {
  constructor(canvas, camera, terrainMap, pathfinding, hero, economy, particleSystem, projectiles, fogOfWar) {
    this.canvas = canvas;
    this.camera = camera;
    this.map = terrainMap;
    this.pathfinding = pathfinding;
    this.hero = hero;
    this.economy = economy;
    this.particles = particleSystem;
    this.projectiles = projectiles;
    this.fogOfWar = fogOfWar;

    // Selection
    this.selectedUnits = [];
    this.selectedBuilding = null;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.mousePos = { x: 0, y: 0 };
    this.hoverTile = { x: 0, y: 0 };

    // Building placement ghost
    this.activeBuildGhost = null; // buildingTypeId e.g. "power", "barracks"

    // Hero ability targeting mode
    this.activeAbilityTargeting = null; // "q", "w", "r"

    // Callbacks
    this.onSelectionChanged = null;
    this.onBuildPlaced = null;
    this.onDeployTurret = null;

    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
    window.addEventListener("keyup", (e) => this.handleKeyUp(e));

    this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));
    this.canvas.addEventListener("contextmenu", (e) => this.handleContextMenu(e));
    this.canvas.addEventListener("wheel", (e) => this.handleWheel(e), { passive: false });
  }

  handleKeyDown(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    switch (e.key.toLowerCase()) {
      case "w":
        if (e.ctrlKey || e.metaKey) return;
        // If not using ability W directly, handle camera up
        this.camera.keys.up = true;
        break;
      case "s":
        this.camera.keys.down = true;
        break;
      case "a":
        this.camera.keys.left = true;
        break;
      case "d":
        this.camera.keys.right = true;
        break;
      case "arrowup":
        this.camera.keys.up = true;
        break;
      case "arrowdown":
        this.camera.keys.down = true;
        break;
      case "arrowleft":
        this.camera.keys.left = true;
        break;
      case "arrowright":
        this.camera.keys.right = true;
        break;
      case " ":
        // Spacebar: Center camera on Hero Commander
        e.preventDefault();
        this.camera.centerOn(this.hero.x, this.hero.y);
        break;
      case "escape":
        this.cancelActiveMode();
        break;
      case "q":
        // Hero Ability Q: Recon
        this.startAbilityTargeting("q");
        break;
      case "e":
        // Hero Ability E: Field Medevac (Instant self & AoE heal)
        if (this.hero && !this.hero.isDead) {
          this.hero.useAbilityE(window.__allEntities || [], this.particles);
        }
        break;
      case "r":
        // Hero Ability R: Cruise Missile
        this.startAbilityTargeting("r");
        break;
      case "b":
        // Toggle build dock
        const dock = document.getElementById("build-dock");
        if (dock) dock.classList.toggle("open");
        break;
    }
  }

  handleKeyUp(e) {
    switch (e.key.toLowerCase()) {
      case "w":
      case "arrowup":
        this.camera.keys.up = false;
        break;
      case "s":
      case "arrowdown":
        this.camera.keys.down = false;
        break;
      case "a":
      case "arrowleft":
        this.camera.keys.left = false;
        break;
      case "d":
      case "arrowright":
        this.camera.keys.right = false;
        break;
    }
  }

  handleWheel(e) {
    e.preventDefault();
    this.camera.handleZoom(e.deltaY);
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos.x = e.clientX - rect.left;
    this.mousePos.y = e.clientY - rect.top;
    this.hoverTile = this.camera.screenToTile(this.mousePos.x, this.mousePos.y);
  }

  handleMouseDown(e) {
    if (e.button === 0) {
      // Left click
      if (this.activeBuildGhost) {
        this.placeBuildingAtHover();
        return;
      }

      if (this.activeAbilityTargeting) {
        this.executeAbilityAtHover();
        return;
      }

      this.isDragging = true;
      this.dragStart.x = this.mousePos.x;
      this.dragStart.y = this.mousePos.y;
    }
  }

  handleMouseUp(e) {
    if (e.button === 0 && this.isDragging) {
      this.isDragging = false;
      const dragDist = Math.hypot(this.mousePos.x - this.dragStart.x, this.mousePos.y - this.dragStart.y);

      if (dragDist > 12) {
        // Multi-unit box selection
        this.selectUnitsInBox(this.dragStart, this.mousePos);
      } else {
        // Single entity selection
        this.selectEntityAt(this.hoverTile.x, this.hoverTile.y);
      }
    }
  }

  handleContextMenu(e) {
    e.preventDefault();

    if (this.activeBuildGhost || this.activeAbilityTargeting) {
      this.cancelActiveMode();
      return;
    }

    // Right Click Command to selected units and Hero
    const tileX = this.hoverTile.fx;
    const tileY = this.hoverTile.fy;

    // Check if clicked an enemy entity
    let targetEnemy = null;
    const allEntities = window.__allEntities || [];
    for (const ent of allEntities) {
      if (ent.isDead || ent.team === "player") continue;
      const dist = Math.hypot(ent.x - tileX, ent.y - tileY);
      if (dist <= (ent.radius || 1.0)) {
        targetEnemy = ent;
        break;
      }
    }

    // Issue command to Hero
    if (this.hero && !this.hero.isDead && (this.hero.isSelected || this.selectedUnits.length === 0)) {
      if (targetEnemy) {
        this.hero.setAttackOrder(targetEnemy, this.pathfinding);
        this.particles.addFloatingText(tileX, tileY, "ENGAGING", "#ff4444", 12);
      } else {
        this.hero.setMoveOrder(tileX, tileY, this.pathfinding);
        this.particles.addFloatingText(tileX, tileY, "MOVING", "#00f0ff", 11);
      }
      Sound.playRadioChirp();
    }

    // Issue command to selected units
    if (this.selectedUnits.length > 0) {
      this.selectedUnits.forEach((unit, idx) => {
        // Formational offset so they don't bunch into 1 tile
        const offX = (idx % 3 - 1) * 0.8;
        const offY = Math.floor(idx / 3) * 0.8;

        if (targetEnemy) {
          unit.setAttackOrder(targetEnemy, this.pathfinding);
        } else {
          unit.setMoveOrder(tileX + offX, tileY + offY, this.pathfinding);
        }
      });
      Sound.playRadioChirp();
    }

    // Set rally point if building is selected
    if (this.selectedBuilding && this.selectedBuilding.team === "player") {
      this.selectedBuilding.rallyPoint = { x: tileX, y: tileY };
      this.particles.addFloatingText(tileX, tileY, "RALLY POINT SET", "#ecc94b", 12);
      Sound.playRadioChirp();
    }
  }

  cancelActiveMode() {
    this.activeBuildGhost = null;
    this.activeAbilityTargeting = null;
    this.clearSelection();
    if (this.onSelectionChanged) this.onSelectionChanged(null);
  }

  clearSelection() {
    if (this.hero) this.hero.isSelected = false;
    this.selectedUnits.forEach((u) => (u.isSelected = false));
    this.selectedUnits = [];
    if (this.selectedBuilding) {
      this.selectedBuilding.isSelected = false;
      this.selectedBuilding = null;
    }
  }

  selectEntityAt(tx, ty) {
    this.clearSelection();
    const allEntities = window.__allEntities || [];

    // Check Hero first
    if (this.hero && !this.hero.isDead && Math.hypot(this.hero.x - tx, this.hero.y - ty) <= 1.4) {
      this.hero.isSelected = true;
      if (this.onSelectionChanged) this.onSelectionChanged({ type: "hero", entity: this.hero });
      Sound.playRadioChirp();
      return;
    }

    // Check allied units
    for (const ent of allEntities) {
      if (ent.isDead || ent.team !== "player" || ent.isHero) continue;
      if (Math.hypot(ent.x - tx, ent.y - ty) <= (ent.radius || 1.0)) {
        ent.isSelected = true;
        this.selectedUnits.push(ent);
        if (this.onSelectionChanged) this.onSelectionChanged({ type: "unit", entity: ent });
        Sound.playRadioChirp();
        return;
      }
    }

    // Check buildings
    for (const ent of allEntities) {
      if (ent.isDead) continue;
      if (ent.w && ent.h) {
        if (tx >= ent.x && tx < ent.x + ent.w && ty >= ent.y && ty < ent.y + ent.h) {
          ent.isSelected = true;
          this.selectedBuilding = ent;
          if (this.onSelectionChanged) this.onSelectionChanged({ type: "building", entity: ent });
          Sound.playRadioChirp();
          return;
        }
      }
    }

    if (this.onSelectionChanged) this.onSelectionChanged(null);
  }

  selectUnitsInBox(p1, p2) {
    this.clearSelection();

    const minScreenX = Math.min(p1.x, p2.x);
    const maxScreenX = Math.max(p1.x, p2.x);
    const minScreenY = Math.min(p1.y, p2.y);
    const maxScreenY = Math.max(p1.y, p2.y);

    const allEntities = window.__allEntities || [];
    let selectedHero = false;

    // Check Hero
    if (this.hero && !this.hero.isDead) {
      const { x: sx, y: sy } = this.camera.tileToScreen(this.hero.x, this.hero.y);
      const canvasPos = this.camera.worldToCanvas(sx, sy);
      if (canvasPos.x >= minScreenX && canvasPos.x <= maxScreenX && canvasPos.y >= minScreenY && canvasPos.y <= maxScreenY) {
        this.hero.isSelected = true;
        selectedHero = true;
      }
    }

    // Check units
    for (const ent of allEntities) {
      if (ent.isDead || ent.team !== "player" || ent.isHero || (ent.w && ent.h)) continue;
      const { x: sx, y: sy } = this.camera.tileToScreen(ent.x, ent.y);
      const canvasPos = this.camera.worldToCanvas(sx, sy);

      if (canvasPos.x >= minScreenX && canvasPos.x <= maxScreenX && canvasPos.y >= minScreenY && canvasPos.y <= maxScreenY) {
        ent.isSelected = true;
        this.selectedUnits.push(ent);
      }
    }

    if (this.selectedUnits.length > 0) {
      if (this.onSelectionChanged) this.onSelectionChanged({ type: "squad", units: this.selectedUnits });
      Sound.playRadioChirp();
    } else if (selectedHero) {
      if (this.onSelectionChanged) this.onSelectionChanged({ type: "hero", entity: this.hero });
      Sound.playRadioChirp();
    } else {
      if (this.onSelectionChanged) this.onSelectionChanged(null);
    }
  }

  startBuildPlacement(buildingType) {
    this.activeBuildGhost = buildingType;
    this.activeAbilityTargeting = null;
  }

  placeBuildingAtHover() {
    if (!this.activeBuildGhost) return;
    const conf = BUILDINGS_CONFIG[this.activeBuildGhost];
    if (!conf) return;

    const tx = this.hoverTile.x;
    const ty = this.hoverTile.y;

    // Check affordability
    if (this.economy.funds < conf.cost || this.economy.techSupplies < (conf.techCost || 0)) {
      this.particles.addFloatingText(tx, ty, "INSUFFICIENT RESOURCES", "#ff3333", 14);
      return;
    }

    // Validate placement footprint
    let isValid = true;
    for (let x = tx; x < tx + conf.w; x++) {
      for (let y = ty; y < ty + conf.h; y++) {
        if (x < 1 || x >= this.map.width - 1 || y < 1 || y >= this.map.height - 1 || this.map.isBlocked(x, y)) {
          isValid = false;
          break;
        }
      }
      if (!isValid) break;
    }

    if (!isValid) {
      this.particles.addFloatingText(tx, ty, "TERRAIN BLOCKED", "#ff4444", 13);
      return;
    }

    // Deduct cost and spawn
    this.economy.deductFunds(conf.cost);
    if (conf.techCost) this.economy.deductTech(conf.techCost);

    // Block collision grid
    for (let x = tx; x < tx + conf.w; x++) {
      for (let y = ty; y < ty + conf.h; y++) {
        this.map.setBlocked(x, y, true);
      }
    }

    if (this.onBuildPlaced) {
      this.onBuildPlaced(this.activeBuildGhost, tx, ty);
    }

    Sound.playBuildingPlaced();
    this.activeBuildGhost = null;
  }

  startAbilityTargeting(abilityKey) {
    if (!this.hero || this.hero.isDead) return;
    this.activeAbilityTargeting = abilityKey;
    this.activeBuildGhost = null;
  }

  executeAbilityAtHover() {
    if (!this.activeAbilityTargeting || !this.hero || this.hero.isDead) return;
    const tx = this.hoverTile.fx;
    const ty = this.hoverTile.fy;

    if (this.activeAbilityTargeting === "q") {
      this.hero.useAbilityQ(tx, ty, this.fogOfWar, this.particles);
    } else if (this.activeAbilityTargeting === "w") {
      this.hero.useAbilityW(
        tx,
        ty,
        (sx, sy) => {
          if (this.onDeployTurret) this.onDeployTurret(sx, sy);
        },
        this.particles
      );
    } else if (this.activeAbilityTargeting === "r") {
      this.hero.useAbilityR(tx, ty, this.projectiles, this.particles);
    }

    this.activeAbilityTargeting = null;
  }

  render(ctx) {
    // Render Selection Box
    if (this.isDragging) {
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 1.5;
      ctx.fillStyle = "rgba(0, 240, 255, 0.12)";
      const w = this.mousePos.x - this.dragStart.x;
      const h = this.mousePos.y - this.dragStart.y;
      ctx.fillRect(this.dragStart.x, this.dragStart.y, w, h);
      ctx.strokeRect(this.dragStart.x, this.dragStart.y, w, h);
    }
  }

  // Render isometric building footprint ghost or ability targeting reticle
  renderWorldOverlays(ctx) {
    const hw = MAP_CONFIG.TILE_WIDTH_HALF;
    const hh = MAP_CONFIG.TILE_HEIGHT_HALF;

    if (this.activeBuildGhost) {
      const conf = BUILDINGS_CONFIG[this.activeBuildGhost];
      const tx = this.hoverTile.x;
      const ty = this.hoverTile.y;

      let isValid = true;
      for (let x = tx; x < tx + conf.w; x++) {
        for (let y = ty; y < ty + conf.h; y++) {
          if (x < 1 || x >= this.map.width - 1 || y < 1 || y >= this.map.height - 1 || this.map.isBlocked(x, y)) {
            isValid = false;
            break;
          }
        }
      }

      ctx.save();
      for (let x = tx; x < tx + conf.w; x++) {
        for (let y = ty; y < ty + conf.h; y++) {
          const { x: sx, y: sy } = this.camera.tileToScreen(x, y);
          ctx.beginPath();
          ctx.moveTo(sx, sy - hh);
          ctx.lineTo(sx + hw, sy);
          ctx.lineTo(sx, sy + hh);
          ctx.lineTo(sx - hw, sy);
          ctx.closePath();

          ctx.fillStyle = isValid ? "rgba(56, 239, 125, 0.45)" : "rgba(235, 87, 87, 0.55)";
          ctx.fill();
          ctx.strokeStyle = isValid ? "#38ef7d" : "#eb5757";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (this.activeAbilityTargeting) {
      // Tactical ability targeting reticle
      const { x: sx, y: sy } = this.camera.tileToScreen(this.hoverTile.fx, this.hoverTile.fy);
      const radius = this.activeAbilityTargeting === "r" ? 3.5 : 6;

      ctx.save();
      ctx.translate(sx, sy);

      // Rotating targeting reticle
      const rot = (Date.now() * 0.005) % (Math.PI * 2);
      ctx.rotate(rot);

      ctx.strokeStyle = this.activeAbilityTargeting === "r" ? "#ff3333" : "#00f0ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * hw, radius * hh, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(-radius * hw - 10, 0);
      ctx.lineTo(radius * hw + 10, 0);
      ctx.moveTo(0, -radius * hh - 10);
      ctx.lineTo(0, radius * hh + 10);
      ctx.stroke();

      ctx.restore();
    }
  }
}
