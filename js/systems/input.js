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

    // Middle-click camera drag panning
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Building placement ghost
    this.activeBuildGhost = null;

    // Hero ability targeting mode
    this.activeAbilityTargeting = null;

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
      case "arrowup":
        this.camera.keys.up = true;
        break;
      case "s":
      case "arrowdown":
        this.camera.keys.down = true;
        break;
      case "a":
      case "arrowleft":
        this.camera.keys.left = true;
        break;
      case "d":
      case "arrowright":
        this.camera.keys.right = true;
        break;
      case " ":
        e.preventDefault();
        this.camera.centerOn(this.hero.x, this.hero.y);
        break;
      case "escape":
        this.cancelActiveMode();
        break;
      case "q":
        this.startAbilityTargeting("q");
        break;
      case "e":
        if (this.hero && !this.hero.isDead) {
          this.hero.useAbilityE(window.__allEntities || [], this.particles);
        }
        break;
      case "r":
        this.startAbilityTargeting("r");
        break;
      case "b":
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

    // Camera drag pan with middle mouse button
    if (this.isPanning) {
      const dx = this.panStart.x - e.clientX;
      const dy = this.panStart.y - e.clientY;
      this.camera.panBy(dx, dy);
      this.panStart.x = e.clientX;
      this.panStart.y = e.clientY;
    }

    // Edge panning (when cursor is within 25px of browser viewport edge)
    const edgeMargin = 25;
    this.camera.edgePan.x = 0;
    this.camera.edgePan.y = 0;

    if (e.clientX < edgeMargin) {
      this.camera.edgePan.x = -1;
    } else if (e.clientX > window.innerWidth - edgeMargin) {
      this.camera.edgePan.x = 1;
    }

    if (e.clientY < edgeMargin) {
      this.camera.edgePan.y = -1;
    } else if (e.clientY > window.innerHeight - edgeMargin) {
      this.camera.edgePan.y = 1;
    }
  }

  handleMouseDown(e) {
    // Middle click to drag-pan
    if (e.button === 1) {
      this.isPanning = true;
      this.panStart.x = e.clientX;
      this.panStart.y = e.clientY;
      return;
    }

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
    if (e.button === 1) {
      this.isPanning = false;
      return;
    }

    if (e.button === 0 && this.isDragging) {
      this.isDragging = false;
      const dragDist = Math.hypot(this.mousePos.x - this.dragStart.x, this.mousePos.y - this.dragStart.y);

      if (dragDist > 12) {
        this.selectUnitsInBox(this.dragStart, this.mousePos);
      } else {
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

    // Right Click Command to selected units or Hero
    const tileX = this.hoverTile.fx;
    const tileY = this.hoverTile.fy;

    // Show animated green move waypoint ring at destination
    this.particles.addMoveWaypoint(tileX, tileY, "#38ef7d");

    // Check if clicked an enemy entity
    let targetEnemy = null;
    const allEntities = window.__allEntities || [];
    for (const ent of allEntities) {
      if (ent.isDead || ent.team === "player") continue;
      const dist = Math.hypot(ent.x - tileX, ent.y - tileY);
      if (dist <= (ent.radius || 1.2)) {
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
      }
      Sound.playRadioChirp();
    }

    // Issue command to selected units
    if (this.selectedUnits.length > 0) {
      this.selectedUnits.forEach((unit, idx) => {
        const offX = ((idx % 3) - 1) * 0.9;
        const offY = Math.floor(idx / 3) * 0.9;

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
    if (this.hero && !this.hero.isDead && Math.hypot(this.hero.x - tx, this.hero.y - ty) <= 1.5) {
      this.hero.isSelected = true;
      if (this.onSelectionChanged) this.onSelectionChanged({ type: "hero", entity: this.hero });
      Sound.playRadioChirp();
      return;
    }

    // Check allied units
    for (const ent of allEntities) {
      if (ent.isDead || ent.team !== "player" || ent.isHero) continue;
      if (Math.hypot(ent.x - tx, ent.y - ty) <= (ent.radius || 1.1)) {
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

    if (this.economy.funds < conf.cost || this.economy.techSupplies < (conf.techCost || 0)) {
      this.particles.addFloatingText(tx, ty, "INSUFFICIENT RESOURCES", "#ff3333", 14);
      return;
    }

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

    this.economy.deductFunds(conf.cost);
    if (conf.techCost) this.economy.deductTech(conf.techCost);

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
    if (this.isDragging) {
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 1.8;
      ctx.fillStyle = "rgba(0, 240, 255, 0.15)";
      const w = this.mousePos.x - this.dragStart.x;
      const h = this.mousePos.y - this.dragStart.y;
      ctx.fillRect(this.dragStart.x, this.dragStart.y, w, h);
      ctx.strokeRect(this.dragStart.x, this.dragStart.y, w, h);
    }
  }

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

          ctx.fillStyle = isValid ? "rgba(56, 239, 125, 0.5)" : "rgba(235, 87, 87, 0.6)";
          ctx.fill();
          ctx.strokeStyle = isValid ? "#38ef7d" : "#eb5757";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (this.activeAbilityTargeting) {
      const { x: sx, y: sy } = this.camera.tileToScreen(this.hoverTile.fx, this.hoverTile.fy);
      const radius = this.activeAbilityTargeting === "r" ? 4.0 : 6.0;

      ctx.save();
      ctx.translate(sx, sy);

      const rot = (Date.now() * 0.005) % (Math.PI * 2);
      ctx.rotate(rot);

      ctx.strokeStyle = this.activeAbilityTargeting === "r" ? "#ff3333" : "#00f0ff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * hw, radius * hh, 0, 0, Math.PI * 2);
      ctx.stroke();

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
