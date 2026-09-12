// js/entities/hero.js - Controllable Spec-Ops Hero Commander

import { Entity } from "./entity.js";
import { HERO_CONFIG } from "../config.js";
import { Projectile } from "./projectile.js";
import { Sound } from "../audio.js";

export class HeroCommander extends Entity {
  constructor(x, y) {
    super(x, y, "player");
    this.name = HERO_CONFIG.name;
    this.hp = HERO_CONFIG.hp;
    this.maxHp = HERO_CONFIG.maxHp;
    this.energy = HERO_CONFIG.energy;
    this.maxEnergy = HERO_CONFIG.maxEnergy;
    this.energyRegen = HERO_CONFIG.energyRegen;

    this.speed = HERO_CONFIG.speed;
    this.range = HERO_CONFIG.range;
    this.damage = HERO_CONFIG.damage;
    this.attackRate = HERO_CONFIG.attackRate;
    this.sightRadius = HERO_CONFIG.sightRadius;

    this.level = 1;
    this.xp = 0;
    this.isHero = true;

    this.angle = 0;
    this.target = null;
    this.path = [];
    this.walkCycle = 0;
    this.attackTimer = 0;
    this.auraPulse = 0;

    // Ability cooldown trackers (seconds remaining)
    this.cooldowns = {
      q: 0,
      w: 0,
      e: 0,
      r: 0,
    };
  }

  addXp(amount, particleSystem) {
    this.xp += amount;
    const needed = HERO_CONFIG.xpToLevel[this.level - 1] || 99999;
    if (this.xp >= needed && this.level < 10) {
      this.level++;
      this.maxHp += 120;
      this.hp = this.maxHp;
      this.damage += 8;
      this.maxEnergy += 15;
      this.energy = this.maxEnergy;
      particleSystem.addFloatingText(this.x, this.y, `COMMANDER LEVEL UP! [LVL ${this.level}]`, "#00f0ff", 16);
      particleSystem.addExplosion(this.x, this.y, "medium");
      Sound.playHeroAbility("heal");
    }
  }

  setMoveOrder(targetX, targetY, pathfinding) {
    this.target = null;
    this.path = pathfinding.findPath(this.x, this.y, targetX, targetY, false) || [];
  }

  setAttackOrder(targetEntity, pathfinding) {
    this.target = targetEntity;
    if (pathfinding) {
      this.path = pathfinding.findPath(this.x, this.y, targetEntity.x, targetEntity.y, false) || [];
    }
  }

  update(dt, allEntities, pathfinding, particleSystem, projectiles, fogOfWar, spawnBuildingCallback) {
    if (this.isDead) return;

    this.auraPulse += dt * 3;
    this.attackTimer -= dt;

    // Energy regeneration
    this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen * dt);

    // Update cooldown timers
    for (const key in this.cooldowns) {
      if (this.cooldowns[key] > 0) {
        this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
      }
    }

    // Passive Logistics Aura: heals tiny HP (1/sec)
    this.hp = Math.min(this.maxHp, this.hp + 2 * dt);

    // Auto-engage targets
    if (!this.target || this.target.isDead) {
      this.target = null;
      let closest = this.sightRadius;
      for (const e of allEntities) {
        if (e.isDead || e.team === "player") continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < closest) {
          closest = d;
          this.target = e;
        }
      }
    }

    if (this.target && !this.target.isDead) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

      if (dist <= this.range) {
        this.path = [];
        if (this.attackTimer <= 0) {
          this.fireAssaultRifle(this.target, particleSystem, projectiles);
          this.attackTimer = this.attackRate;
        }
      } else if (this.path.length === 0) {
        this.path = pathfinding.findPath(this.x, this.y, this.target.x, this.target.y, false) || [];
      }
    }

    // Path navigation
    if (this.path.length > 0) {
      this.walkCycle += dt * 14;
      const wp = this.path[0];
      const dx = wp.x - this.x;
      const dy = wp.y - this.y;
      const dist = Math.hypot(dx, dy);

      this.angle = Math.atan2(dy, dx);
      const move = this.speed * dt;
      if (dist <= move) {
        this.x = wp.x;
        this.y = wp.y;
        this.path.shift();
      } else {
        this.x += (dx / dist) * move;
        this.y += (dy / dist) * move;
      }
    } else {
      this.walkCycle = 0;
    }
  }

  fireAssaultRifle(target, particleSystem, projectiles) {
    Sound.playGunshot("rifle");
    particleSystem.addMuzzleFlash(this.x, this.y, this.angle);

    projectiles.push(
      new Projectile({
        startX: this.x,
        startY: this.y,
        targetX: target.x,
        targetY: target.y,
        targetEntity: target,
        type: "bullet",
        speed: 18,
        damage: this.damage,
        team: "player",
        attacker: this,
      })
    );
  }

  // Tactical Ability [Q]: Recon Drone Scan
  useAbilityQ(targetX, targetY, fogOfWar, particleSystem) {
    const ab = HERO_CONFIG.abilities.q;
    if (this.cooldowns.q > 0 || this.energy < ab.energyCost) return false;

    this.energy -= ab.energyCost;
    this.cooldowns.q = ab.cooldown;
    Sound.playHeroAbility("recon");

    fogOfWar.addReconScan(targetX, targetY, ab.radius, ab.duration);
    particleSystem.addFloatingText(targetX, targetY, "ORBITAL RECON ACTIVE", "#00f0ff", 14);
    return true;
  }

  // Tactical Ability [W]: Drop Sentry Turret
  useAbilityW(targetX, targetY, spawnTurretCallback, particleSystem) {
    const ab = HERO_CONFIG.abilities.w;
    if (this.cooldowns.w > 0 || this.energy < ab.energyCost) return false;

    this.energy -= ab.energyCost;
    this.cooldowns.w = ab.cooldown;
    Sound.playHeroAbility("turret");

    spawnTurretCallback(targetX, targetY);
    particleSystem.addExplosion(targetX, targetY, "medium");
    particleSystem.addFloatingText(targetX, targetY, "SENTRY DEPLOYED", "#ecc94b", 14);
    return true;
  }

  // Tactical Ability [E]: Field Medevac / Nanorepair
  useAbilityE(allEntities, particleSystem) {
    const ab = HERO_CONFIG.abilities.e;
    if (this.cooldowns.e > 0 || this.energy < ab.energyCost) return false;

    this.energy -= ab.energyCost;
    this.cooldowns.e = ab.cooldown;
    Sound.playHeroAbility("heal");

    particleSystem.addHealPulse(this.x, this.y, ab.radius);

    // Heal self and all nearby player units/buildings
    for (const e of allEntities) {
      if (e.isDead || e.team !== "player") continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= ab.radius) {
        e.heal(ab.healAmount);
        particleSystem.addFloatingText(e.x, e.y, `+${ab.healAmount} HP`, "#38ef7d", 14);
      }
    }
    return true;
  }

  // Tactical Ability [R]: Tactical Cruise Missile Strike
  useAbilityR(targetX, targetY, projectiles, particleSystem) {
    const ab = HERO_CONFIG.abilities.r;
    if (this.cooldowns.r > 0 || this.energy < ab.energyCost) return false;

    this.energy -= ab.energyCost;
    this.cooldowns.r = ab.cooldown;
    Sound.playHeroAbility("missile");

    projectiles.push(
      new Projectile({
        startX: targetX,
        startY: targetY - 12,
        targetX,
        targetY,
        type: "missile",
        speed: 6.5,
        damage: ab.damage,
        aoe: ab.radius,
        team: "player",
        attacker: this,
      })
    );

    particleSystem.addFloatingText(targetX, targetY, "MISSILE INBOUND!", "#ff2222", 15);
    return true;
  }

  render(ctx, camera) {
    if (this.isDead) return;

    const { x: sx, y: sy } = camera.tileToScreen(this.x, this.y);

    ctx.save();
    ctx.translate(sx, sy);

    // Hero Command Aura on ground (glowing tactical cyan ring)
    const pulseSize = 19 + Math.sin(this.auraPulse) * 2.5;
    ctx.strokeStyle = "rgba(0, 240, 255, 0.45)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 4, pulseSize, pulseSize * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Directional morning ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(2.5, 4, 13, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Animated stride and vertical bobbing
    const stride = Math.sin(this.walkCycle) * 3.8;
    const bobY = Math.abs(Math.cos(this.walkCycle)) * 1.2;

    // --- 1. ARTICULATED LEGS & COMBAT BOOTS ---
    // Left Leg
    ctx.fillStyle = "#1e2c3d"; // Dark Navy Tactical Cargo
    ctx.fillRect(-3.5 + stride, -6 - bobY, 3, 7);
    ctx.fillStyle = "#10161f"; // Tactical Combat Boot
    ctx.fillRect(-4 + stride, 1 - bobY, 3.8, 3.2);
    // Gold Officer Kneepad
    ctx.fillStyle = "#ecc94b";
    ctx.fillRect(-3.5 + stride, -3 - bobY, 3, 2);

    // Right Leg
    ctx.fillStyle = "#1e2c3d";
    ctx.fillRect(1 - stride, -6 - bobY, 3, 7);
    ctx.fillStyle = "#10161f";
    ctx.fillRect(0.5 - stride, 1 - bobY, 3.8, 3.2);
    // Gold Officer Kneepad
    ctx.fillStyle = "#ecc94b";
    ctx.fillRect(1 - stride, -3 - bobY, 3, 2);

    // --- 2. TORSO: SPEC-OPS EXOSUIT PLATE CARRIER ---
    ctx.fillStyle = "#142538"; // Elite Navy Ballistic Plate
    ctx.beginPath();
    ctx.roundRect(-5.5, -15 - bobY, 11, 10, 2);
    ctx.fill();

    // Gold Rank Epaulets & MOLLE Straps
    ctx.fillStyle = "#ecc94b";
    ctx.fillRect(-4, -14.5 - bobY, 8, 1.8);
    // Triple Mag Pouches
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-4, -10.5 - bobY, 8, 3.5);
    ctx.fillStyle = "#475569";
    ctx.fillRect(-3.5, -10 - bobY, 2, 2.8);
    ctx.fillRect(-0.5, -10 - bobY, 2, 2.8);
    ctx.fillRect(2.5, -10 - bobY, 2, 2.8);

    // Shoulder Comms Antenna
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4.5, -14 - bobY);
    ctx.lineTo(-6.5, -22 - bobY);
    ctx.stroke();

    // Thigh Holster with Sidearm Pistol on right
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(3.5, -6 - bobY, 2.5, 4);

    // --- 3. HEAD & ADVANCED COMMAND HELMET ---
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(0, -18.5 - bobY, 4.8, 0, Math.PI * 2);
    ctx.fill();

    // Gold Officer Helmet Trim
    ctx.strokeStyle = "#ecc94b";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -19 - bobY, 4.8, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Glowing Cyan Tactical HUD Visor
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(-2.5, -20 - bobY, 5, 2.2);

    // Tactical Headset Earmuffs
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-5.8, -19.5 - bobY, 1.8, 3);
    ctx.fillRect(4.0, -19.5 - bobY, 1.8, 3);

    // --- 4. ARMS & WEAPON (Rotated to Aim Angle) ---
    ctx.save();
    ctx.translate(0, -11 - bobY);
    ctx.rotate(this.angle);

    // Left Arm with Tactical Gauntlet
    ctx.fillStyle = "#1e2c3d";
    ctx.fillRect(0, 1.5, 6, 2.8);
    // Glowing cyan wrist holo-projector
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(4, 2, 2, 1.8);

    // Right Arm gripping rifle
    ctx.fillStyle = "#1e2c3d";
    ctx.fillRect(0, -3.5, 7, 2.8);

    // Customized Suppressed Mk18 Carbine
    ctx.fillStyle = "#0f172a"; // Receiver
    ctx.fillRect(3, -1.8, 11, 2.4);
    // Holographic Optic Sight
    ctx.fillStyle = "#ecc94b";
    ctx.fillRect(5, -3.6, 3.5, 1.8);
    ctx.fillStyle = "#ff3333"; // Reticle dot
    ctx.fillRect(7, -3, 1, 1);
    // Drum Magazine
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(6, 1.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Silencer / Suppressor
    ctx.fillStyle = "#334155";
    ctx.fillRect(14, -2.1, 5, 3.0);

    // Tactical Aiming Laser Beam
    ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(19, -0.6);
    ctx.lineTo(42, -0.6);
    ctx.stroke();

    ctx.restore();

    // Floating Level Star Badge
    ctx.fillStyle = "#ecc94b";
    ctx.font = "bold 9px 'Outfit', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`★ LVL ${this.level}`, 0, -29 - bobY);

    ctx.restore();

    // Health and Energy Bar
    this.renderHealthBar(ctx, sx, sy, -23, 34, 4);

    // Energy bar (Cyan line under health)
    const energyRatio = Math.max(0, Math.min(1, this.energy / this.maxEnergy));
    ctx.save();
    ctx.translate(sx, sy - 18);
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(-17, 0, 34, 2.5);
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(-17, 0, 34 * energyRatio, 2.5);
    ctx.restore();
  }
}
