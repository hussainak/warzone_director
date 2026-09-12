// js/entities/unit.js - Modern Military Combat Units (Infantry, Vehicles, Aircraft)

import { Entity } from "./entity.js";
import { UNITS_CONFIG, ENEMY_UNITS_CONFIG } from "../config.js";
import { Projectile } from "./projectile.js";
import { Sound } from "../audio.js";

export class Unit extends Entity {
  constructor(x, y, unitId, team = "player") {
    super(x, y, team);
    this.unitId = unitId;

    const conf = team === "player" ? UNITS_CONFIG[unitId] : (ENEMY_UNITS_CONFIG[unitId] || UNITS_CONFIG[unitId]);
    this.name = conf.name;
    this.category = conf.category || "infantry";
    this.isFlying = conf.isFlying || false;

    this.hp = conf.hp;
    this.maxHp = conf.maxHp;
    this.speed = conf.speed;
    this.range = conf.range;
    this.damage = conf.damage;
    this.attackRate = conf.attackRate;
    this.aoe = conf.aoe || 0;
    this.sightRadius = conf.sightRadius || 7;
    this.bounty = conf.bounty || 0;
    this.techBounty = conf.techBounty || 0;

    this.angle = 0;              // Current movement / facing orientation
    this.turretAngle = 0;        // For tanks and buggies
    this.target = null;          // Target entity
    this.targetPosition = null;  // Move destination
    this.path = [];              // Waypoints from A*
    this.attackTimer = 0;
    this.rotorAngle = 0;         // Chopper rotor spin
    this.altitude = this.isFlying ? 28 : 0;

    // Enemy autonomous patrol wander timer
    this.patrolTimer = Math.random() * 8;
    this.homeBasePos = { x, y };
  }

  setMoveOrder(targetX, targetY, pathfinding) {
    this.target = null;
    this.targetPosition = { x: targetX, y: targetY };
    this.path = pathfinding.findPath(this.x, this.y, targetX, targetY, this.isFlying) || [];
  }

  setAttackOrder(targetEntity, pathfinding) {
    this.target = targetEntity;
    this.targetPosition = null;
    if (pathfinding) {
      this.path = pathfinding.findPath(this.x, this.y, targetEntity.x, targetEntity.y, this.isFlying) || [];
    }
  }

  update(dt, allEntities, pathfinding, particleSystem, projectiles) {
    if (this.isDead) return;

    this.attackTimer -= dt;
    if (this.isFlying) {
      this.rotorAngle += dt * 30;
    }

    // Auto-acquire target if idle
    if (!this.target || this.target.isDead) {
      this.target = null;
      this.findAutoTarget(allEntities);
    }

    // Enemy autonomous idle patrol wander around base
    if (this.team === "enemy" && !this.target && this.path.length === 0) {
      this.patrolTimer += dt;
      if (this.patrolTimer >= 14 + Math.random() * 10) {
        this.patrolTimer = 0;
        const wanderX = Math.max(2, Math.min(68, this.homeBasePos.x + (Math.random() * 8 - 4)));
        const wanderY = Math.max(2, Math.min(68, this.homeBasePos.y + (Math.random() * 8 - 4)));
        this.setMoveOrder(wanderX, wanderY, pathfinding);
      }
    }

    // Combat behavior
    if (this.target && !this.target.isDead) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      this.turretAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

      if (dist <= this.range) {
        this.path = [];
        if (this.attackTimer <= 0) {
          this.fireWeapon(this.target, particleSystem, projectiles);
          this.attackTimer = this.attackRate;
        }
      } else {
        if (this.path.length === 0) {
          this.path = pathfinding.findPath(this.x, this.y, this.target.x, this.target.y, this.isFlying) || [];
        }
      }
    }

    // Movement along waypoints
    if (this.path.length > 0) {
      const nextWp = this.path[0];
      const dx = nextWp.x - this.x;
      const dy = nextWp.y - this.y;
      const distToWp = Math.hypot(dx, dy);

      this.angle = Math.atan2(dy, dx);
      if (!this.target) this.turretAngle = this.angle;

      const moveDist = this.speed * dt;
      if (distToWp <= moveDist) {
        this.x = nextWp.x;
        this.y = nextWp.y;
        this.path.shift();
      } else {
        this.x += (dx / distToWp) * moveDist;
        this.y += (dy / distToWp) * moveDist;
      }
    }
  }

  findAutoTarget(allEntities) {
    let bestTarget = null;
    let closestDist = this.sightRadius;

    for (let i = 0; i < allEntities.length; i++) {
      const e = allEntities[i];
      if (e.isDead || e.team === this.team) continue;
      const dist = Math.hypot(e.x - this.x, e.y - this.y);
      if (dist < closestDist) {
        closestDist = dist;
        bestTarget = e;
      }
    }

    if (bestTarget) {
      this.target = bestTarget;
    }
  }

  fireWeapon(target, particleSystem, projectiles) {
    particleSystem.addMuzzleFlash(this.x, this.y, this.turretAngle);

    if (this.unitId === "tank" || this.unitId === "enemy_tank") {
      Sound.playGunshot("cannon");
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "cannon",
          speed: 16,
          damage: this.damage,
          aoe: this.aoe,
          team: this.team,
          attacker: this,
        })
      );
    } else if (this.unitId === "artillery") {
      Sound.playRocketLaunch();
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          type: "artillery",
          speed: 7,
          damage: this.damage,
          aoe: this.aoe,
          team: this.team,
          attacker: this,
        })
      );
    } else if (this.unitId === "rpg" || this.unitId === "enemy_rpg") {
      Sound.playRocketLaunch();
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "rocket",
          speed: 9,
          damage: this.damage,
          aoe: this.aoe,
          team: this.team,
          attacker: this,
        })
      );
    } else if (this.unitId === "sniper") {
      Sound.playGunshot("sniper");
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "sniper",
          speed: 24,
          damage: this.damage,
          team: this.team,
          attacker: this,
        })
      );
    } else {
      Sound.playGunshot("rifle");
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "bullet",
          speed: 15,
          damage: this.damage,
          team: this.team,
          attacker: this,
        })
      );
    }
  }

  onDeath(attacker) {}

  render(ctx, camera) {
    if (this.isDead) return;

    const { x: sx, y: sy } = camera.tileToScreen(this.x, this.y);
    const renderY = sy - this.altitude;

    ctx.save();
    ctx.translate(sx, renderY);

    if (this.isSelected) {
      ctx.strokeStyle = this.team === "player" ? "#00f0ff" : "#ff3333";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 4, 16, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, this.altitude + 2, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const isAllied = this.team === "player";
    const primaryColor = isAllied ? "#2b6cb0" : "#9b2c2c";
    const highlightColor = isAllied ? "#4299e1" : "#e53e3e";

    if (this.category === "infantry") {
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(0, -6, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isAllied ? "#2d3748" : "#4a1215";
      ctx.beginPath();
      ctx.arc(0, -13, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#1a202c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(Math.cos(this.turretAngle) * 9, -7 + Math.sin(this.turretAngle) * 9);
      ctx.stroke();
    } else if (this.unitId === "tank" || this.unitId === "enemy_tank") {
      ctx.save();
      ctx.rotate(this.angle * 0.4);

      ctx.fillStyle = "#1a202c";
      ctx.fillRect(-14, -8, 28, 4);
      ctx.fillRect(-14, 4, 28, 4);

      ctx.fillStyle = primaryColor;
      ctx.fillRect(-11, -6, 22, 12);

      ctx.rotate(this.turretAngle - this.angle * 0.4);
      ctx.fillStyle = highlightColor;
      ctx.fillRect(-6, -4, 12, 8);

      ctx.strokeStyle = "#1a202c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();

      ctx.restore();
    } else if (this.category === "air") {
      ctx.save();
      ctx.rotate(this.angle * 0.3);

      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isAllied ? "#00f0ff" : "#ff3333";
      ctx.fillRect(4, -2, 6, 4);

      ctx.strokeStyle = "rgba(230, 240, 255, 0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(this.rotorAngle) * 22, -Math.sin(this.rotorAngle) * 7);
      ctx.lineTo(Math.cos(this.rotorAngle) * 22, Math.sin(this.rotorAngle) * 7);
      ctx.stroke();

      ctx.restore();
    } else {
      ctx.fillStyle = primaryColor;
      ctx.fillRect(-10, -6, 20, 12);
      ctx.fillStyle = "#1a202c";
      ctx.fillRect(-12, -7, 5, 3);
      ctx.fillRect(7, -7, 5, 3);
      ctx.fillRect(-12, 4, 5, 3);
      ctx.fillRect(7, 4, 5, 3);

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(this.turretAngle) * 11, Math.sin(this.turretAngle) * 11);
      ctx.stroke();
    }

    ctx.restore();

    this.renderHealthBar(ctx, sx, renderY, this.category === "air" ? -28 : -20, 26, 3.5);
  }
}
