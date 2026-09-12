// js/entities/projectile.js - Ballistics, Missiles, Tracers, and Splash Damage

import { Sound } from "../audio.js";

export class Projectile {
  constructor(options) {
    this.startX = options.startX;
    this.startY = options.startY;
    this.targetX = options.targetX;
    this.targetY = options.targetY;
    this.x = options.startX;
    this.y = options.startY;
    this.targetEntity = options.targetEntity || null;

    this.type = options.type || "bullet"; // "bullet", "sniper", "rocket", "artillery", "missile"
    this.speed = options.speed || 12;      // Tiles per second
    this.damage = options.damage || 20;
    this.aoe = options.aoe || 0;           // Splash radius in tiles
    this.team = options.team || "player";
    this.attacker = options.attacker || null;

    this.isDead = false;
    this.height = 0;                       // Vertical offset for parabolic trajectory
    this.progress = 0;                     // 0 to 1
    this.totalDistance = Math.hypot(this.targetX - this.startX, this.targetY - this.startY) || 0.1;

    if (this.type === "missile") {
      this.speed = 8;
      this.totalDistance = Math.hypot(this.targetX - this.startX, this.targetY - this.startY) || 1;
    }
  }

  update(dt, entities, particleSystem, soundEngine) {
    if (this.isDead) return;

    // If target entity exists and is alive, update destination slightly for guided rockets
    if (this.targetEntity && !this.targetEntity.isDead && this.type === "rocket") {
      this.targetX = this.targetEntity.x;
      this.targetY = this.targetEntity.y;
      this.totalDistance = Math.hypot(this.targetX - this.startX, this.targetY - this.startY) || 0.1;
    }

    const step = (this.speed * dt) / this.totalDistance;
    this.progress += step;

    if (this.progress >= 1) {
      this.progress = 1;
      this.x = this.targetX;
      this.y = this.targetY;
      this.explode(entities, particleSystem, soundEngine);
      return;
    }

    this.x = this.startX + (this.targetX - this.startX) * this.progress;
    this.y = this.startY + (this.targetY - this.startY) * this.progress;

    // Parabolic arc for artillery & missiles
    if (this.type === "artillery") {
      this.height = Math.sin(this.progress * Math.PI) * 45;
    } else if (this.type === "missile") {
      this.height = (1 - this.progress) * 80;
    }

    // Smoke trail for rockets and artillery
    if (this.type === "rocket" || this.type === "missile") {
      particleSystem.addSmoke(this.x, this.y, 3, "rgba(200, 200, 200, 0.6)");
    } else if (this.type === "artillery" && Math.random() < 0.4) {
      particleSystem.addSmoke(this.x, this.y, 4, "rgba(120, 120, 120, 0.5)");
    }
  }

  explode(entities, particleSystem, soundEngine) {
    this.isDead = true;

    if (this.type === "missile") {
      soundEngine.playExplosion("large");
      particleSystem.addExplosion(this.x, this.y, "large");
    } else if (this.aoe > 0) {
      soundEngine.playExplosion("medium");
      particleSystem.addExplosion(this.x, this.y, "medium");
    } else if (this.type === "cannon") {
      particleSystem.addExplosion(this.x, this.y, "medium");
    }

    // Apply damage
    if (this.aoe > 0) {
      // Area of effect damage
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (e.isDead || e.team === this.team) continue;
        const dist = Math.hypot(e.x - this.x, e.y - this.y);
        if (dist <= this.aoe) {
          const falloff = 1 - dist / (this.aoe * 1.3);
          const dmg = Math.round(this.damage * Math.max(0.4, falloff));
          e.takeDamage(dmg, this.attacker);
          particleSystem.addFloatingText(e.x, e.y, `-${dmg}`, "#ff3333");
        }
      }
    } else {
      // Single target direct damage
      if (this.targetEntity && !this.targetEntity.isDead) {
        this.targetEntity.takeDamage(this.damage, this.attacker);
        particleSystem.addFloatingText(
          this.targetEntity.x,
          this.targetEntity.y,
          `-${this.damage}`,
          this.type === "sniper" ? "#ff0055" : "#ff4444",
          this.type === "sniper" ? 15 : 12
        );
      }
    }
  }

  render(ctx, camera) {
    if (this.isDead) return;

    const { x: sx, y: sy } = camera.tileToScreen(this.x, this.y);
    const renderY = sy - this.height;

    ctx.save();
    ctx.translate(sx, renderY);

    if (this.type === "bullet") {
      // Tracer line
      ctx.strokeStyle = this.team === "player" ? "#ffe066" : "#ff6b6b";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.stroke();
    } else if (this.type === "sniper") {
      // High-velocity bright cyan tracer
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
    } else if (this.type === "rocket") {
      // RPG Rocket with fiery tail
      ctx.fillStyle = "#a0aec0";
      ctx.fillRect(-4, -2, 8, 4);
      ctx.fillStyle = "#ff5500";
      ctx.fillRect(-6, -1, 3, 2);
    } else if (this.type === "missile") {
      // Cruise Missile Body
      ctx.fillStyle = "#edf2f7";
      ctx.fillRect(-5, -3, 10, 6);
      ctx.fillStyle = "#e53e3e";
      ctx.beginPath();
      ctx.moveTo(5, -3);
      ctx.lineTo(9, 0);
      ctx.lineTo(5, 3);
      ctx.fill();
    } else {
      // Heavy artillery shell
      ctx.fillStyle = "#4a5568";
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Target ground marker for missile / heavy artillery
    if (this.type === "missile") {
      const { x: tx, y: ty } = camera.tileToScreen(this.targetX, this.targetY);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.strokeStyle = "rgba(255, 30, 30, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.aoe * 20, this.aoe * 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
