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
    const pulseSize = 18 + Math.sin(this.auraPulse) * 2;
    ctx.strokeStyle = "rgba(0, 240, 255, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 4, pulseSize, pulseSize * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 3, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spec-Ops Commander Exo-Suit
    // Body / Torso
    ctx.fillStyle = "#1a365d"; // Elite Navy Blue
    ctx.beginPath();
    ctx.arc(0, -9, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Gold / Neon trims
    ctx.strokeStyle = "#ecc94b";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Combat Helmet / Visor
    ctx.fillStyle = "#2d3748";
    ctx.beginPath();
    ctx.arc(0, -17, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Cyan Tactical HUD Visor
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(-2, -18, 5, 2.5);

    // Dual Assault Carbine
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(Math.cos(this.angle) * 12, -9 + Math.sin(this.angle) * 12);
    ctx.stroke();

    // Hero Badge / Level Star
    ctx.fillStyle = "#ecc94b";
    ctx.font = "bold 9px 'Outfit', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`★ LVL ${this.level}`, 0, -28);

    ctx.restore();

    // Health and Energy Bar
    this.renderHealthBar(ctx, sx, sy, -22, 32, 4);

    // Energy bar (Blue line under health)
    const energyRatio = Math.max(0, Math.min(1, this.energy / this.maxEnergy));
    ctx.save();
    ctx.translate(sx, sy - 17);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(-16, 0, 32, 2.5);
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(-16, 0, 32 * energyRatio, 2.5);
    ctx.restore();
  }
}
