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

    // Touch gesture state for iPad and mobile touchscreens
    this.touchDragMode = "pan"; // "pan" or "select"
    this.touchState = {
      isTouch: false,
      isPinching: false,
      isPanning: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      initialPinchDist: 0,
      lastPinchDist: 0,
      lastMidX: 0,
      lastMidY: 0,
    };

    // Building placement ghost
    this.activeBuildGhost = null;

    // Hero ability targeting mode
    this.activeAbilityTargeting = null;

    // Callbacks
    this.onSelectionChanged = null;
    this.onBuildPlaced = null;
    this.onDeployTurret = null;

    // Wire global handlers for iPad touch action bar
    window.__cancelActiveMode = () => {
      this.cancelActiveMode();
      this.updateTouchActionBar();
    };
    window.__toggleTouchDragMode = () => {
      this.toggleTouchDragMode();
    };

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

    // Touch events for iPad and touchscreen drag panning & pinch-to-zoom
    this.canvas.addEventListener("touchstart", (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener("touchmove", (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener("touchend", (e) => this.handleTouchEnd(e), { passive: false });
    this.canvas.addEventListener("touchcancel", (e) => this.handleTouchEnd(e), { passive: false });
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
        this.placeBuildingAt(this.hoverTile.x, this.hoverTile.y);
        return;
      }

      if (this.activeAbilityTargeting) {
        this.executeAbilityAt(this.hoverTile.fx, this.hoverTile.fy);
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
        this.handleTap(this.mousePos.x, this.mousePos.y, false);
      }
    }
  }

  handleContextMenu(e) {
    e.preventDefault();

    if (this.activeBuildGhost || this.activeAbilityTargeting) {
      this.cancelActiveMode();
      return;
    }

    this.issueMoveOrAttackOrder(this.hoverTile.fx, this.hoverTile.fy);
  }

  issueMoveOrAttackOrder(tileX, tileY) {
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

  // --- iPad & Touchscreen Gestures (Tap-Drag to Pan, Pinch to Zoom, Tap to Select/Move) ---
  handleTouchStart(e) {
    e.preventDefault();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const cx = touch.clientX - rect.left;
      const cy = touch.clientY - rect.top;

      this.touchState.isTouch = true;
      this.touchState.isPinching = false;
      this.touchState.isPanning = false;
      this.touchState.startX = cx;
      this.touchState.startY = cy;
      this.touchState.lastX = cx;
      this.touchState.lastY = cy;

      this.mousePos.x = cx;
      this.mousePos.y = cy;
      this.hoverTile = this.camera.screenToTile(cx, cy);

      if (this.touchDragMode === "select") {
        this.isDragging = true;
        this.dragStart.x = cx;
        this.dragStart.y = cy;
      }
    } else if (e.touches.length === 2) {
      this.touchState.isPinching = true;
      this.touchState.isPanning = true;
      this.isDragging = false;

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      this.touchState.initialPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      this.touchState.lastPinchDist = this.touchState.initialPinchDist;
      this.touchState.lastMidX = (t1.clientX + t2.clientX) / 2;
      this.touchState.lastMidY = (t1.clientY + t2.clientY) / 2;
    }
  }

  handleTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 1 && !this.touchState.isPinching) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const cx = touch.clientX - rect.left;
      const cy = touch.clientY - rect.top;

      const totalDist = Math.hypot(cx - this.touchState.startX, cy - this.touchState.startY);
      if (totalDist > 8) {
        this.touchState.isPanning = true;
      }

      this.mousePos.x = cx;
      this.mousePos.y = cy;
      this.hoverTile = this.camera.screenToTile(cx, cy);

      if (this.touchDragMode === "select" && this.isDragging) {
        // Dragging selection rectangle
      } else {
        // Dragging camera pan
        if (this.touchState.isPanning) {
          const dx = this.touchState.lastX - cx;
          const dy = this.touchState.lastY - cy;
          this.camera.panBy(dx, dy);
        }
      }

      this.touchState.lastX = cx;
      this.touchState.lastY = cy;

    } else if (e.touches.length === 2) {
      this.touchState.isPinching = true;
      this.touchState.isPanning = true;
      this.isDragging = false;

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      if (this.touchState.lastPinchDist > 0 && currentDist > 0) {
        const ratio = currentDist / this.touchState.lastPinchDist;
        this.camera.zoomByRatio(ratio);
        this.touchState.lastPinchDist = currentDist;
      }

      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      const dx = this.touchState.lastMidX - midX;
      const dy = this.touchState.lastMidY - midY;
      this.camera.panBy(dx, dy);
      this.touchState.lastMidX = midX;
      this.touchState.lastMidY = midY;
    }
  }

  handleTouchEnd(e) {
    e.preventDefault();

    // If user was pinching, do not treat finger release as a tap
    if (this.touchState.isPinching) {
      if (e.touches.length === 0) {
        this.touchState.isPinching = false;
        this.touchState.isPanning = false;
        this.touchState.lastPinchDist = 0;
      }
      return;
    }

    if (this.touchDragMode === "select" && this.isDragging) {
      this.isDragging = false;
      const dragDist = Math.hypot(this.mousePos.x - this.dragStart.x, this.mousePos.y - this.dragStart.y);
      if (dragDist > 14) {
        this.selectUnitsInBox(this.dragStart, this.mousePos);
      } else {
        this.handleTap(this.mousePos.x, this.mousePos.y, true);
      }
    } else if (!this.touchState.isPanning && e.changedTouches.length > 0) {
      // Tap detected (no drag)
      const touch = e.changedTouches[0];
      const rect = this.canvas.getBoundingClientRect();
      const tapX = touch.clientX - rect.left;
      const tapY = touch.clientY - rect.top;
      this.handleTap(tapX, tapY, true);
    }

    if (e.touches.length === 0) {
      this.touchState.isTouch = false;
      this.touchState.isPanning = false;
      this.touchState.isPinching = false;
      this.isDragging = false;
    }
  }

  // --- Smart Contextual Tap Handler (Supports iPad / Touchscreens with NO Right Click) ---
  handleTap(screenX, screenY, isTouch = false) {
    const tile = this.camera.screenToTile(screenX, screenY);
    this.hoverTile = tile;

    // 1. If building placement mode active -> construct building at tapped location
    if (this.activeBuildGhost) {
      this.placeBuildingAt(tile.x, tile.y);
      return;
    }

    // 2. If hero ability targeting active -> fire tactical strike at tapped location
    if (this.activeAbilityTargeting) {
      this.executeAbilityAt(tile.fx, tile.fy);
      return;
    }

    // 3. Check what was tapped
    const tappedEntity = this.findSelectableEntityAt(tile.x, tile.y);
    const hasSelectedTroops = (this.hero && this.hero.isSelected) || this.selectedUnits.length > 0;

    if (isTouch) {
      // --- iPad & Touchscreens (No Right-Click Available) ---
      if (hasSelectedTroops) {
        if (tappedEntity && tappedEntity.team === "player") {
          // Tapped another player unit/hero -> switch selection to it
          this.selectEntity(tappedEntity);
        } else {
          // Tapped ground or enemy -> ISSUE MOVE OR ATTACK ORDER!
          this.issueMoveOrAttackOrder(tile.fx, tile.fy);
        }
      } else {
        // No units selected currently -> select whatever was tapped
        if (tappedEntity) {
          this.selectEntity(tappedEntity);
        } else {
          this.clearSelection();
          if (this.onSelectionChanged) this.onSelectionChanged(null);
          this.updateTouchActionBar();
        }
      }
    } else {
      // --- Desktop Mouse Left-Click Mode ---
      if (tappedEntity) {
        this.selectEntity(tappedEntity);
      } else {
        this.clearSelection();
        if (this.onSelectionChanged) this.onSelectionChanged(null);
        this.updateTouchActionBar();
      }
    }
  }

  findSelectableEntityAt(tx, ty) {
    const allEntities = window.__allEntities || [];

    // Check Hero first
    if (this.hero && !this.hero.isDead && Math.hypot(this.hero.x - tx, this.hero.y - ty) <= 1.4) {
      return this.hero;
    }

    // Check allied units
    for (const ent of allEntities) {
      if (ent.isDead || ent.team !== "player" || ent.isHero) continue;
      if (Math.hypot(ent.x - tx, ent.y - ty) <= (ent.radius || 1.1)) {
        return ent;
      }
    }

    // Check buildings
    for (const ent of allEntities) {
      if (ent.isDead) continue;
      if (ent.w && ent.h) {
        if (tx >= ent.x && tx < ent.x + ent.w && ty >= ent.y && ty < ent.y + ent.h) {
          return ent;
        }
      }
    }

    return null;
  }

  selectEntity(entity) {
    this.clearSelection();
    if (!entity || entity.isDead) {
      if (this.onSelectionChanged) this.onSelectionChanged(null);
      this.updateTouchActionBar();
      return;
    }

    entity.isSelected = true;
    if (entity.isHero) {
      if (this.onSelectionChanged) this.onSelectionChanged({ type: "hero", entity });
    } else if (entity.w && entity.h) {
      this.selectedBuilding = entity;
      if (this.onSelectionChanged) this.onSelectionChanged({ type: "building", entity });
    } else {
      this.selectedUnits.push(entity);
      if (this.onSelectionChanged) this.onSelectionChanged({ type: "unit", entity });
    }

    Sound.playRadioChirp();
    this.updateTouchActionBar();
  }

  selectEntityAt(tx, ty) {
    const ent = this.findSelectableEntityAt(tx, ty);
    if (ent) {
      this.selectEntity(ent);
      return true;
    }
    this.clearSelection();
    if (this.onSelectionChanged) this.onSelectionChanged(null);
    this.updateTouchActionBar();
    return false;
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

    this.updateTouchActionBar();
  }

  cancelActiveMode() {
    this.activeBuildGhost = null;
    this.activeAbilityTargeting = null;
    this.clearSelection();
    if (this.onSelectionChanged) this.onSelectionChanged(null);
    this.updateTouchActionBar();
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

  updateTouchActionBar() {
    const bar = document.getElementById("touch-action-bar");
    const icon = document.getElementById("touch-action-icon");
    const msg = document.getElementById("touch-action-msg");
    if (!bar || !icon || !msg) return;

    if (this.activeBuildGhost) {
      const conf = BUILDINGS_CONFIG[this.activeBuildGhost];
      bar.classList.remove("hidden");
      icon.textContent = "🏗️";
      msg.textContent = `TAP PLAY AREA TO PLACE ${conf ? conf.name.toUpperCase() : "BUILDING"}`;
      return;
    }

    if (this.activeAbilityTargeting) {
      bar.classList.remove("hidden");
      icon.textContent = "🎯";
      msg.textContent = `TAP TARGET AREA FOR HERO ABILITY [${this.activeAbilityTargeting.toUpperCase()}]`;
      return;
    }

    const heroSelected = this.hero && this.hero.isSelected;
    const unitCount = this.selectedUnits.length;

    if (heroSelected || unitCount > 0) {
      bar.classList.remove("hidden");
      icon.textContent = "🎯";
      if (heroSelected && unitCount > 0) {
        msg.textContent = `HERO & ${unitCount} TROOPS: TAP GROUND TO MOVE / ATTACK`;
      } else if (heroSelected) {
        msg.textContent = `HERO VANGUARD: TAP GROUND TO MOVE / ATTACK`;
      } else {
        msg.textContent = `${unitCount} UNIT${unitCount > 1 ? "S" : ""}: TAP GROUND TO MOVE / ATTACK`;
      }
      return;
    }

    bar.classList.add("hidden");
  }

  toggleTouchDragMode() {
    this.touchDragMode = this.touchDragMode === "pan" ? "select" : "pan";
    const btn = document.getElementById("btn-touch-mode-toggle");
    if (btn) {
      btn.textContent = this.touchDragMode === "pan" ? "✋ DRAG: PAN" : "📦 DRAG: SELECT";
    }
    Sound.playRadioChirp();
  }

  startBuildPlacement(buildingType) {
    this.activeBuildGhost = buildingType;
    this.activeAbilityTargeting = null;
    this.clearSelection();
    this.updateTouchActionBar();
  }

  placeBuildingAt(tx, ty) {
    if (!this.activeBuildGhost) return false;
    const conf = BUILDINGS_CONFIG[this.activeBuildGhost];
    if (!conf) return false;

    if (this.economy.funds < conf.cost || this.economy.techSupplies < (conf.techCost || 0)) {
      this.particles.addFloatingText(tx, ty, "INSUFFICIENT FUNDS", "#ff3333", 14);
      Sound.playHeroAbility("recon");
      return false;
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
      Sound.playHeroAbility("recon");
      return false;
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
    this.particles.addFloatingText(tx, ty, `+${conf.name.toUpperCase()} DEPLOYED`, "#38ef7d", 14);
    this.activeBuildGhost = null;
    this.updateTouchActionBar();
    return true;
  }

  placeBuildingAtHover() {
    if (!this.hoverTile) return;
    this.placeBuildingAt(this.hoverTile.x, this.hoverTile.y);
  }

  startAbilityTargeting(abilityKey) {
    if (!this.hero || this.hero.isDead) return;
    this.activeAbilityTargeting = abilityKey;
    this.activeBuildGhost = null;
    this.updateTouchActionBar();
  }

  executeAbilityAt(tx, ty) {
    if (!this.activeAbilityTargeting || !this.hero || this.hero.isDead) return;

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
    this.updateTouchActionBar();
  }

  executeAbilityAtHover() {
    if (!this.hoverTile) return;
    this.executeAbilityAt(this.hoverTile.fx, this.hoverTile.fy);
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
