// js/ui/hud.js - AoE Tactical HUD, Minimap Radar, Command Dock, and Selection Panel

import { BUILDINGS_CONFIG, UNITS_CONFIG, HERO_CONFIG, MAP_CONFIG } from "../config.js";
import { Sound } from "../audio.js";

export class HUD {
  constructor(economy, hero, invasion, camera, terrainMap, inputSystem) {
    this.economy = economy;
    this.hero = hero;
    this.invasion = invasion;
    this.camera = camera;
    this.map = terrainMap;
    this.input = inputSystem;

    this.minimapCanvas = document.getElementById("minimap-canvas");
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext("2d") : null;

    // Cache DOM Elements
    this.fundsEl = document.getElementById("hud-funds");
    this.techEl = document.getElementById("hud-tech");
    this.powerEl = document.getElementById("hud-power");
    this.waveTimerEl = document.getElementById("hud-wave-timer");
    this.waveStatusEl = document.getElementById("hud-wave-status");

    this.heroHpEl = document.getElementById("hero-hp-bar");
    this.heroEnergyEl = document.getElementById("hero-energy-bar");
    this.heroLevelEl = document.getElementById("hero-level-badge");

    this.selectionPanelEl = document.getElementById("selection-panel");
    this.buildDockEl = document.getElementById("build-dock");

    this.setupMinimapClicks();
    this.setupBuildButtons();
    this.setupAbilityButtons();
  }

  setupMinimapClicks() {
    if (!this.minimapCanvas) return;

    const handleMinimapClick = (e) => {
      const rect = this.minimapCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const normX = clickX / this.minimapCanvas.width;
      const normY = clickY / this.minimapCanvas.height;

      const tileX = normX * this.map.width;
      const tileY = normY * this.map.height;

      this.camera.centerOn(tileX, tileY);
      Sound.playRadioChirp();
    };

    this.minimapCanvas.addEventListener("click", handleMinimapClick);
  }

  setupBuildButtons() {
    const buildBtns = document.querySelectorAll(".btn-build");
    buildBtns.forEach((btn) => {
      let lastTrigger = 0;
      const handleBuildTrigger = (e) => {
        const now = performance.now();
        if (now - lastTrigger < 350) return;
        lastTrigger = now;
        const bType = btn.getAttribute("data-building");
        if (bType) {
          this.input.startBuildPlacement(bType);
          Sound.playRadioChirp();
        }
      };

      btn.addEventListener("click", handleBuildTrigger);
      btn.addEventListener("touchend", handleBuildTrigger, { passive: true });
    });
  }

  setupAbilityButtons() {
    const setupBtn = (id, key) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      let lastTrigger = 0;
      const trigger = (e) => {
        const now = performance.now();
        if (now - lastTrigger < 350) return;
        lastTrigger = now;
        if (key === "e") {
          if (this.hero && !this.hero.isDead) {
            this.hero.useAbilityE(window.__allEntities || [], this.input.particles);
          }
        } else {
          this.input.startAbilityTargeting(key);
        }
      };

      btn.addEventListener("click", trigger);
      btn.addEventListener("touchend", trigger, { passive: true });
    };

    setupBtn("btn-ability-q", "q");
    setupBtn("btn-ability-w", "w");
    setupBtn("btn-ability-e", "e");
    setupBtn("btn-ability-r", "r");
  }

  updateSelectionCard(selected) {
    if (!this.selectionPanelEl) return;

    if (!selected) {
      this.selectionPanelEl.innerHTML = `
        <div class="empty-selection">
          <div class="radar-scan-anim"></div>
          <span>RIGHT-CLICK TO MOVE HERO & ARMIES</span>
        </div>
      `;
      return;
    }

    if (selected.type === "hero") {
      const h = selected.entity;
      this.selectionPanelEl.innerHTML = `
        <div class="entity-card">
          <div class="card-header">
            <span class="badge-hero">HERO COMMANDER</span>
            <span class="entity-name">${h.name}</span>
          </div>
          <div class="card-stats">
            <div class="stat-line"><span>HP:</span> <b>${Math.round(h.hp)} / ${h.maxHp}</b></div>
            <div class="stat-line"><span>ENERGY:</span> <b>${Math.round(h.energy)} / ${h.maxEnergy}</b></div>
            <div class="stat-line"><span>RANK:</span> <b>LEVEL ${h.level}</b></div>
            <div class="stat-line"><span>WEAPON:</span> <b>Dual M4 Carbine (${h.damage} DMG)</b></div>
          </div>
        </div>
      `;
    } else if (selected.type === "unit") {
      const u = selected.entity;
      const isPlayer = u.team === "player";
      this.selectionPanelEl.innerHTML = `
        <div class="entity-card">
          <div class="card-header">
            <span class="${isPlayer ? 'badge-unit' : 'badge-enemy'}">${isPlayer ? 'ALLIED ' : 'HOSTILE '}${u.category.toUpperCase()}</span>
            <span class="entity-name">${u.name}</span>
          </div>
          <div class="card-stats">
            <div class="stat-line"><span>HP:</span> <b>${Math.round(u.hp)} / ${u.maxHp}</b></div>
            <div class="stat-line"><span>DAMAGE:</span> <b>${u.damage}</b></div>
            <div class="stat-line"><span>RANGE:</span> <b>${u.range}</b></div>
            <div class="stat-line"><span>SPEED:</span> <b>${u.speed}</b></div>
          </div>
        </div>
      `;
    } else if (selected.type === "squad") {
      this.selectionPanelEl.innerHTML = `
        <div class="entity-card">
          <div class="card-header">
            <span class="badge-unit">STRIKE GROUP</span>
            <span class="entity-name">${selected.units.length} UNITS SELECTED</span>
          </div>
          <div class="card-stats">
            <div class="stat-line"><span>ORDER:</span> <b>RIGHT-CLICK TO MOVE / ATTACK</b></div>
          </div>
        </div>
      `;
    } else if (selected.type === "building") {
      const b = selected.entity;
      const isPlayer = b.team === "player";
      let trainingControls = "";

      if (isPlayer && b.trains && b.trains.length > 0 && !b.isConstructing) {
        trainingControls = `<div class="train-buttons-header">RECRUIT / FABRICATE:</div><div class="train-buttons-grid">`;
        b.trains.forEach((uId) => {
          const uConf = UNITS_CONFIG[uId];
          if (uConf) {
            trainingControls += `
              <button class="btn-train" data-unit="${uId}">
                <span>${uConf.name}</span>
                <span class="cost-tag">$${uConf.cost}</span>
              </button>
            `;
          }
        });
        trainingControls += `</div>`;
      }

      this.selectionPanelEl.innerHTML = `
        <div class="entity-card">
          <div class="card-header">
            <span class="${isPlayer ? 'badge-building' : 'badge-enemy'}">${isPlayer ? 'ALLIED' : 'HOSTILE'} STRUCTURE</span>
            <span class="entity-name">${b.name}</span>
          </div>
          <div class="card-stats">
            <div class="stat-line"><span>STRUCTURE HP:</span> <b>${Math.round(b.hp)} / ${b.maxHp}</b></div>
            <div class="stat-line"><span>POWER:</span> <b>${b.power >= 0 ? "+" : ""}${b.power} MW</b></div>
            ${b.isConstructing ? `<div class="stat-line"><span>CONSTRUCTION:</span> <b>${Math.floor(b.constructProgress * 100)}%</b></div>` : ""}
            ${b.productionQueue.length > 0 ? `<div class="stat-line"><span>PRODUCING:</span> <b>${b.productionQueue[0].unitId.toUpperCase()} (${Math.floor((b.productionQueue[0].time / b.productionQueue[0].maxTime) * 100)}%)</b></div>` : ""}
          </div>
          ${trainingControls}
        </div>
      `;

      const trainBtns = this.selectionPanelEl.querySelectorAll(".btn-train");
      trainBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const uId = btn.getAttribute("data-unit");
          if (uId && b.queueUnit(uId, this.economy)) {
            Sound.playRadioChirp();
            this.updateSelectionCard(selected);
          } else {
            Sound.playHeroAbility("recon");
          }
        });
      });
    }
  }

  update(dt, allEntities) {
    if (this.fundsEl) this.fundsEl.textContent = `$${Math.floor(this.economy.funds).toLocaleString()}`;
    if (this.techEl) this.techEl.textContent = `${Math.floor(this.economy.techSupplies)} T`;

    if (this.powerEl) {
      const netPower = this.economy.powerProduction - this.economy.powerConsumption;
      this.powerEl.textContent = `${netPower >= 0 ? "+" : ""}${netPower} MW`;
      this.powerEl.className = netPower < 0 ? "power-warning" : "power-good";
    }

    if (this.waveTimerEl) {
      const t = Math.max(0, Math.ceil(this.invasion.waveTimer));
      const mins = Math.floor(t / 60);
      const secs = t % 60;
      this.waveTimerEl.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

      if (this.waveStatusEl) {
        if (this.invasion.isWarning) {
          this.waveStatusEl.textContent = `RED ALERT: WAVE ${this.invasion.currentWave} [${this.invasion.strikeVector}]`;
          this.waveStatusEl.className = "status-alert pulse";
        } else {
          this.waveStatusEl.textContent = `PEACE GRACE PERIOD`;
          this.waveStatusEl.className = "status-normal";
        }
      }
    }

    if (this.hero && !this.hero.isDead) {
      if (this.heroHpEl) this.heroHpEl.style.width = `${Math.max(0, (this.hero.hp / this.hero.maxHp) * 100)}%`;
      if (this.heroEnergyEl) this.heroEnergyEl.style.width = `${Math.max(0, (this.hero.energy / this.hero.maxEnergy) * 100)}%`;
      if (this.heroLevelEl) this.heroLevelEl.textContent = `LVL ${this.hero.level}`;

      ["q", "w", "e", "r"].forEach((key) => {
        const cd = this.hero.cooldowns[key];
        const cdEl = document.getElementById(`cd-overlay-${key}`);
        if (cdEl) {
          if (cd > 0) {
            cdEl.style.display = "flex";
            cdEl.textContent = Math.ceil(cd);
          } else {
            cdEl.style.display = "none";
          }
        }
      });
    }

    this.renderMinimap(allEntities);
  }

  renderMinimap(allEntities) {
    if (!this.minimapCtx || !this.minimapCanvas) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    // Tactical Radar Background
    ctx.fillStyle = "#0c1522";
    ctx.fillRect(0, 0, w, h);

    const scaleX = w / this.map.width;
    const scaleY = h / this.map.height;

    // Water River
    for (let x = 0; x < this.map.width; x += 2) {
      for (let y = 0; y < this.map.height; y += 2) {
        if (this.map.getTile(x, y) === 4) {
          ctx.fillStyle = "#1e3a5f";
          ctx.fillRect(x * scaleX, y * scaleY, scaleX * 2, scaleY * 2);
        } else if (this.map.getTile(x, y) === 5) {
          ctx.fillStyle = "#4a5568";
          ctx.fillRect(x * scaleX, y * scaleY, scaleX * 2, scaleY * 2);
        }
      }
    }

    // Oil Derricks (Yellow / Green)
    this.map.resourceNodes.forEach((node) => {
      if (node.type === "oil") {
        ctx.fillStyle = node.captured ? "#38ef7d" : "#ecc94b";
        ctx.fillRect(node.x * scaleX - 2, node.y * scaleY - 2, 4, 4);
      }
    });

    // Draw all entities: Friendly (Cyan / Blue), Hostile rival armies (Red)
    for (let i = 0; i < allEntities.length; i++) {
      const e = allEntities[i];
      if (e.isDead) continue;

      if (e.isHero) {
        ctx.fillStyle = "#00f0ff";
        ctx.beginPath();
        ctx.arc(e.x * scaleX, e.y * scaleY, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.w && e.h) {
        // Building
        ctx.fillStyle = e.team === "player" ? "#3182ce" : "#e53e3e";
        ctx.fillRect(e.x * scaleX, e.y * scaleY, e.w * scaleX, e.h * scaleY);
      } else {
        // Unit
        ctx.fillStyle = e.team === "player" ? "#63b3ed" : "#fc8181";
        ctx.fillRect(e.x * scaleX - 1.5, e.y * scaleY - 1.5, 3, 3);
      }
    }

    // Radar Base Threat Labels
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#63b3ed";
    ctx.fillText("HQ", 20 * scaleX - 6, 17 * scaleY - 4);

    ctx.fillStyle = "#fc8181";
    ctx.fillText("NORTH BASE", 46 * scaleX, 13 * scaleY);
    ctx.fillText("SOUTH FORT", 46 * scaleX, 47 * scaleY);
    ctx.fillText("RIVER CAMP", 10 * scaleX, 44 * scaleY);

    // Camera Frustum Indicator
    const centerTile = this.camera.screenToTile(this.camera.canvas.width / 2, this.camera.canvas.height / 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.2;
    const viewW = (this.camera.canvas.width / 64) * scaleX / this.camera.zoom;
    const viewH = (this.camera.canvas.height / 32) * scaleY / this.camera.zoom;
    ctx.strokeRect(centerTile.x * scaleX - viewW / 2, centerTile.y * scaleY - viewH / 2, viewW, viewH);

    // Radar Grid Ring
    ctx.strokeStyle = "rgba(0, 240, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2);
    ctx.stroke();
  }
}
