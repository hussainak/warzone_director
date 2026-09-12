// js/entities/building.js - Military Structures, Factories, and Automated Defenses

import { Entity } from "./entity.js";
import { BUILDINGS_CONFIG, UNITS_CONFIG } from "../config.js";
import { Projectile } from "./projectile.js";
import { Sound } from "../audio.js";

export class Building extends Entity {
  constructor(x, y, buildingType, team = "player", isInstant = false) {
    super(x, y, team);
    this.buildingType = buildingType;

    const conf = BUILDINGS_CONFIG[buildingType];
    this.name = conf.name;
    this.w = conf.w; // Width in tiles
    this.h = conf.h; // Height in tiles

    this.hp = isInstant ? conf.hp : 1;
    this.maxHp = conf.hp;
    this.power = conf.power || 0; // Negative = consumes, positive = produces
    this.passiveIncome = conf.passiveIncome || 0;
    this.sightRadius = conf.sightRadius || 7;
    this.trains = conf.trains || [];

    // Combat attributes for defensive turrets
    this.attackRange = conf.attackRange || 0;
    this.damage = conf.damage || 0;
    this.attackRate = conf.attackRate || 1.0;
    this.aoe = conf.aoe || 0;
    this.turretAngle = 0;
    this.attackTimer = 0;

    // Construction state
    this.isConstructing = !isInstant;
    this.constructTime = isInstant ? 0 : Math.max(4, conf.cost / 60);
    this.constructProgress = isInstant ? 1.0 : 0.0;

    // Unit recruitment queue: array of { unitId, time, maxTime }
    this.productionQueue = [];
    this.currentProductionTime = 0;

    // Rally point for trained units
    this.rallyPoint = { x: this.x + this.w + 0.5, y: this.y + this.h + 0.5 };
  }

  // Queue a unit for training
  queueUnit(unitId, economy) {
    const conf = UNITS_CONFIG[unitId];
    if (!conf) return false;
    if (this.productionQueue.length >= 5) return false;
    if (economy.funds < conf.cost || economy.techSupplies < (conf.techCost || 0)) return false;

    economy.deductFunds(conf.cost);
    if (conf.techCost) economy.deductTech(conf.techCost);

    this.productionQueue.push({
      unitId,
      time: 0,
      maxTime: conf.trainTime,
    });
    return true;
  }

  update(dt, allEntities, projectiles, particleSystem, spawnUnitCallback, economy) {
    if (this.isDead) return;

    // Construction phase
    if (this.isConstructing) {
      this.constructProgress += dt / this.constructTime;
      this.hp = Math.round(this.maxHp * this.constructProgress);

      if (Math.random() < 0.3) {
        particleSystem.addMuzzleFlash(
          this.x + Math.random() * this.w,
          this.y + Math.random() * this.h,
          Math.random() * Math.PI * 2
        );
      }

      if (this.constructProgress >= 1.0) {
        this.isConstructing = false;
        this.constructProgress = 1.0;
        this.hp = this.maxHp;
        Sound.playBuildingPlaced();
        particleSystem.addFloatingText(this.x + this.w / 2, this.y + this.h / 2, "OPERATIONAL", "#38ef7d", 14);
      }
      return;
    }

    // Defensive turret engagement (Turret / SAM)
    if (this.attackRange > 0) {
      this.attackTimer -= dt;

      // Acquire closest hostile in range
      let bestTarget = null;
      let closestDist = this.attackRange;
      for (const e of allEntities) {
        if (e.isDead || e.team === this.team) continue;
        const d = Math.hypot(e.x - (this.x + this.w / 2), e.y - (this.y + this.h / 2));
        if (d <= closestDist) {
          closestDist = d;
          bestTarget = e;
        }
      }

      if (bestTarget) {
        const cx = this.x + this.w / 2;
        const cy = this.y + this.h / 2;
        this.turretAngle = Math.atan2(bestTarget.y - cy, bestTarget.x - cx);

        if (this.attackTimer <= 0) {
          this.fireDefenseWeapon(bestTarget, cx, cy, projectiles, particleSystem);
          this.attackTimer = this.attackRate;
        }
      }
    }

    // Unit recruitment production queue
    if (this.productionQueue.length > 0) {
      const currentItem = this.productionQueue[0];
      currentItem.time += dt;

      if (currentItem.time >= currentItem.maxTime) {
        // Unit finished!
        this.productionQueue.shift();
        spawnUnitCallback(currentItem.unitId, this.rallyPoint.x, this.rallyPoint.y, this.team);
        Sound.playRadioChirp();
      }
    }
  }

  fireDefenseWeapon(target, cx, cy, projectiles, particleSystem) {
    particleSystem.addMuzzleFlash(cx, cy, this.turretAngle);

    if (this.buildingType === "sam") {
      Sound.playRocketLaunch();
      projectiles.push(
        new Projectile({
          startX: cx,
          startY: cy,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "rocket",
          speed: 11,
          damage: this.damage,
          aoe: this.aoe,
          team: this.team,
          attacker: this,
        })
      );
    } else {
      Sound.playGunshot("rifle");
      projectiles.push(
        new Projectile({
          startX: cx,
          startY: cy,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "bullet",
          speed: 16,
          damage: this.damage,
          team: this.team,
          attacker: this,
        })
      );
    }
  }

  render(ctx, camera) {
    if (this.isDead) return;

    const { x: sx, y: sy } = camera.tileToScreen(this.x + this.w / 2, this.y + this.h / 2);

    ctx.save();
    ctx.translate(sx, sy);

    const isAllied = this.team === "player";
    const baseColor = isAllied ? "#2b4c7e" : "#742a2a";
    const wallColor = isAllied ? "#1a365d" : "#4a1d1d";
    const roofColor = isAllied ? "#2c5282" : "#9b2c2c";

    // Selection box indicator
    if (this.isSelected) {
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, (this.w + this.h) * 14, (this.w + this.h) * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(0, 4, (this.w + this.h) * 12, (this.w + this.h) * 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Under construction scaffolding visual
    if (this.isConstructing) {
      ctx.fillStyle = "#4a5568";
      ctx.fillRect(-this.w * 12, -this.h * 12, this.w * 24, this.h * 20);

      ctx.strokeStyle = "#ecc94b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-this.w * 12, -this.h * 12);
      ctx.lineTo(this.w * 12, this.h * 8);
      ctx.moveTo(this.w * 12, -this.h * 12);
      ctx.lineTo(-this.w * 12, this.h * 8);
      ctx.stroke();

      // Progress bar
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(-24, -28, 48, 6);
      ctx.fillStyle = "#ecc94b";
      ctx.fillRect(-24, -28, 48 * this.constructProgress, 6);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`BUILDING: ${Math.floor(this.constructProgress * 100)}%`, 0, -32);

      ctx.restore();
      return;
    }

    // Finished Building Types
    if (this.buildingType === "hq") {
      // Command HQ: Modern multi-story bunker with radar dish and command dome
      ctx.fillStyle = wallColor;
      ctx.fillRect(-28, -24, 56, 32);

      // Glass Command Tier
      ctx.fillStyle = "#00f0ff";
      ctx.fillRect(-18, -32, 36, 12);

      // Main Roof
      ctx.fillStyle = roofColor;
      ctx.fillRect(-22, -38, 44, 8);

      // Rotating Satellite Radar Dish
      const dishAngle = (Date.now() * 0.003) % (Math.PI * 2);
      ctx.save();
      ctx.translate(0, -42);
      ctx.rotate(dishAngle);
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#cbd5e0";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    } else if (this.buildingType === "power") {
      // Solar / Nuclear Power Grid
      ctx.fillStyle = wallColor;
      ctx.fillRect(-20, -16, 40, 24);

      // Solar Panel Cells
      ctx.fillStyle = "#2b6cb0";
      ctx.fillRect(-16, -24, 14, 10);
      ctx.fillRect(2, -24, 14, 10);
      ctx.strokeStyle = "#63b3ed";
      ctx.lineWidth = 1;
      ctx.strokeRect(-16, -24, 14, 10);
      ctx.strokeRect(2, -24, 14, 10);

      // Glowing power coil
      const glow = (Math.sin(Date.now() * 0.006) + 1) * 0.5;
      ctx.fillStyle = `rgba(0, 255, 200, ${0.4 + glow * 0.5})`;
      ctx.fillRect(-4, -8, 8, 12);
    } else if (this.buildingType === "barracks") {
      // Modern Military Training Barracks
      ctx.fillStyle = wallColor;
      ctx.fillRect(-22, -18, 44, 26);
      ctx.fillStyle = roofColor;
      ctx.fillRect(-20, -26, 40, 10);

      // Firing range / gate
      ctx.fillStyle = "#1a202c";
      ctx.fillRect(-6, -2, 12, 10);

      // Camo stripe
      ctx.fillStyle = "#4a5568";
      ctx.fillRect(-20, -14, 40, 4);
    } else if (this.buildingType === "factory") {
      // Heavy Industrial War Factory with smokestacks and vehicle bay doors
      ctx.fillStyle = wallColor;
      ctx.fillRect(-32, -22, 64, 34);

      // Rollup Bay Door
      ctx.fillStyle = "#2d3748";
      ctx.fillRect(-14, -6, 28, 18);
      ctx.strokeStyle = "#ecc94b";
      ctx.lineWidth = 1;
      ctx.strokeRect(-14, -6, 28, 18);

      // Dual Smokestacks
      ctx.fillStyle = "#718096";
      ctx.fillRect(-26, -34, 8, 16);
      ctx.fillRect(-14, -38, 8, 20);
    } else if (this.buildingType === "helipad") {
      // Helipad with marked landing circle
      ctx.fillStyle = "#2d3748";
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ecc94b";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Big 'H' marking
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", 0, 0);
    } else if (this.buildingType === "trade") {
      // Trade Exchange Hub with digital stock ticker sign
      ctx.fillStyle = wallColor;
      ctx.fillRect(-22, -18, 44, 26);

      // Gold Exchange Insignia
      ctx.fillStyle = "#ecc94b";
      ctx.fillRect(-18, -26, 36, 10);
      ctx.fillStyle = "#000";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TRADE HUB", 0, -19);
    } else if (this.buildingType === "turret") {
      // Minigun Pillbox Bunker
      ctx.fillStyle = "#2d3748";
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rotating twin 20mm minigun
      ctx.save();
      ctx.rotate(this.turretAngle);
      ctx.fillStyle = "#718096";
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#1a202c";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(14, -4);
      ctx.moveTo(0, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
      ctx.restore();
    } else if (this.buildingType === "sam") {
      // Heavy SAM Rocket Battery
      ctx.fillStyle = "#2d3748";
      ctx.fillRect(-16, -12, 32, 20);

      // Rotating Missile Launch Pod
      ctx.save();
      ctx.rotate(this.turretAngle);
      ctx.fillStyle = "#4a5568";
      ctx.fillRect(-8, -6, 16, 12);

      // 4 Missile tips
      ctx.fillStyle = "#e53e3e";
      ctx.fillRect(8, -6, 4, 3);
      ctx.fillRect(8, -2, 4, 3);
      ctx.fillRect(8, 2, 4, 3);
      ctx.restore();
    }

    // Structure Name Tag
    ctx.fillStyle = isAllied ? "#cbd5e0" : "#feb2b2";
    ctx.font = "bold 9px 'Outfit', monospace";
    ctx.textAlign = "center";
    ctx.fillText(this.name.toUpperCase(), 0, -this.h * 11 - 6);

    ctx.restore();

    // Health Bar
    this.renderHealthBar(ctx, sx, sy, -this.h * 12 - 14, this.w * 16, 4);

    // Production Queue Bar
    if (this.productionQueue.length > 0) {
      const q = this.productionQueue[0];
      const prog = Math.min(1, q.time / q.maxTime);
      ctx.save();
      ctx.translate(sx, sy - this.h * 12 - 9);
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(-20, 0, 40, 3.5);
      ctx.fillStyle = "#ecc94b";
      ctx.fillRect(-20, 0, 40 * prog, 3.5);
      ctx.restore();
    }
  }
}
