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
    this.power = conf.power || 0;
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

    // Automated enemy base production timer
    this.enemyProductionTimer = Math.random() * 10;

    // Rally point for trained units
    this.rallyPoint = { x: this.x + this.w + 0.8, y: this.y + this.h + 0.8 };
  }

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

      if (Math.random() < 0.25) {
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
        if (this.team === "player") Sound.playBuildingPlaced();
        particleSystem.addFloatingText(this.x + this.w / 2, this.y + this.h / 2, "OPERATIONAL", "#38ef7d", 14);
      }
      return;
    }

    // Defensive turret engagement (Turret / SAM)
    if (this.attackRange > 0) {
      this.attackTimer -= dt;

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

    // Dynamic Automated Enemy Base Production
    if (this.team === "enemy" && !this.isConstructing && this.trains.length > 0) {
      this.enemyProductionTimer += dt;
      if (this.enemyProductionTimer >= 26 && this.productionQueue.length < 2) {
        this.enemyProductionTimer = 0;

        // Check density of local defenders
        let localDefenders = 0;
        for (const e of allEntities) {
          if (e.team === "enemy" && !e.isDead && !e.w && Math.hypot(e.x - this.x, e.y - this.y) < 12) {
            localDefenders++;
          }
        }

        if (localDefenders < 7) {
          const pick = this.trains[Math.floor(Math.random() * this.trains.length)];
          const enemyType = pick === "tank" ? "enemy_tank" : pick === "buggy" ? "enemy_technical" : pick === "rpg" ? "enemy_rpg" : "enemy_militia";
          this.productionQueue.push({
            unitId: enemyType,
            time: 0,
            maxTime: 9.0,
          });
          particleSystem.addFloatingText(this.x + this.w / 2, this.y + this.h / 2, "PRODUCING ARMOR", "#fc8181", 11);
        }
      }
    }

    // Unit recruitment production queue
    if (this.productionQueue.length > 0) {
      const currentItem = this.productionQueue[0];
      currentItem.time += dt;

      if (currentItem.time >= currentItem.maxTime) {
        this.productionQueue.shift();
        const spawned = spawnUnitCallback(currentItem.unitId, this.rallyPoint.x, this.rallyPoint.y, this.team);

        if (this.team === "player") {
          Sound.playRadioChirp();
        } else {
          particleSystem.addFloatingText(this.rallyPoint.x, this.rallyPoint.y, "UNIT DEPLOYED", "#fc8181", 11);
        }
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
    const baseColor = isAllied ? "#2b4c7e" : "#63171b";
    const wallColor = isAllied ? "#1a365d" : "#4a1215";
    const roofColor = isAllied ? "#2c5282" : "#9b2c2c";

    // Selection box indicator
    if (this.isSelected) {
      ctx.strokeStyle = isAllied ? "#00f0ff" : "#ff3333";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, (this.w + this.h) * 14, (this.w + this.h) * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(4, 4, (this.w + this.h) * 12, (this.w + this.h) * 6, 0, 0, Math.PI * 2);
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
      ctx.fillStyle = wallColor;
      ctx.fillRect(-28, -24, 56, 32);

      ctx.fillStyle = isAllied ? "#00f0ff" : "#ff4444";
      ctx.fillRect(-18, -32, 36, 12);

      ctx.fillStyle = roofColor;
      ctx.fillRect(-22, -38, 44, 8);

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
      ctx.fillStyle = wallColor;
      ctx.fillRect(-20, -16, 40, 24);

      ctx.fillStyle = "#2b6cb0";
      ctx.fillRect(-16, -24, 14, 10);
      ctx.fillRect(2, -24, 14, 10);
      ctx.strokeStyle = "#63b3ed";
      ctx.lineWidth = 1;
      ctx.strokeRect(-16, -24, 14, 10);
      ctx.strokeRect(2, -24, 14, 10);

      const glow = (Math.sin(Date.now() * 0.006) + 1) * 0.5;
      ctx.fillStyle = `rgba(0, 255, 200, ${0.4 + glow * 0.5})`;
      ctx.fillRect(-4, -8, 8, 12);
    } else if (this.buildingType === "barracks") {
      ctx.fillStyle = wallColor;
      ctx.fillRect(-22, -18, 44, 26);
      ctx.fillStyle = roofColor;
      ctx.fillRect(-20, -26, 40, 10);

      ctx.fillStyle = "#1a202c";
      ctx.fillRect(-6, -2, 12, 10);

      ctx.fillStyle = isAllied ? "#4a5568" : "#822727";
      ctx.fillRect(-20, -14, 40, 4);
    } else if (this.buildingType === "factory") {
      ctx.fillStyle = wallColor;
      ctx.fillRect(-32, -22, 64, 34);

      ctx.fillStyle = "#2d3748";
      ctx.fillRect(-14, -6, 28, 18);
      ctx.strokeStyle = isAllied ? "#ecc94b" : "#e53e3e";
      ctx.lineWidth = 1;
      ctx.strokeRect(-14, -6, 28, 18);

      ctx.fillStyle = "#718096";
      ctx.fillRect(-26, -34, 8, 16);
      ctx.fillRect(-14, -38, 8, 20);
    } else if (this.buildingType === "helipad") {
      ctx.fillStyle = "#2d3748";
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ecc94b";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", 0, 0);
    } else if (this.buildingType === "trade") {
      ctx.fillStyle = wallColor;
      ctx.fillRect(-22, -18, 44, 26);

      ctx.fillStyle = "#ecc94b";
      ctx.fillRect(-18, -26, 36, 10);
      ctx.fillStyle = "#000";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TRADE HUB", 0, -19);
    } else if (this.buildingType === "turret") {
      ctx.fillStyle = isAllied ? "#2d3748" : "#4a1215";
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.rotate(this.turretAngle);
      ctx.fillStyle = isAllied ? "#718096" : "#c53030";
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
      ctx.fillStyle = isAllied ? "#2d3748" : "#4a1215";
      ctx.fillRect(-16, -12, 32, 20);

      ctx.save();
      ctx.rotate(this.turretAngle);
      ctx.fillStyle = isAllied ? "#4a5568" : "#822727";
      ctx.fillRect(-8, -6, 16, 12);

      ctx.fillStyle = "#e53e3e";
      ctx.fillRect(8, -6, 4, 3);
      ctx.fillRect(8, -2, 4, 3);
      ctx.fillRect(8, 2, 4, 3);
      ctx.restore();
    }

    // Structure Name Tag
    ctx.fillStyle = isAllied ? "#cbd5e0" : "#feb2b2";
    ctx.font = "bold 9px 'Outfit', sans-serif";
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
      ctx.fillStyle = isAllied ? "#ecc94b" : "#fc8181";
      ctx.fillRect(-20, 0, 40 * prog, 3.5);
      ctx.restore();
    }
  }
}
