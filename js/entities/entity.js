// js/entities/entity.js - Base Class for Units, Buildings, and Heroes

export class Entity {
  constructor(x, y, team = "player") {
    this.id = "e_" + Math.random().toString(36).substr(2, 9);
    this.x = x;
    this.y = y;
    this.team = team; // "player" or "enemy"
    this.hp = 100;
    this.maxHp = 100;
    this.isDead = false;
    this.isSelected = false;
    this.radius = 0.5; // Tile radius for selection and collision
    this.sightRadius = 6;
  }

  takeDamage(amount, attacker = null) {
    if (this.isDead) return 0;
    const actualDamage = Math.min(this.hp, amount);
    this.hp -= actualDamage;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.onDeath(attacker);
    }
    return actualDamage;
  }

  heal(amount) {
    if (this.isDead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  onDeath(attacker) {
    // Override in subclass
  }

  // Draw healthbar above entity
  renderHealthBar(ctx, sx, sy, yOffset = -25, width = 30, height = 4) {
    const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    ctx.save();
    ctx.translate(sx, sy + yOffset);

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2);

    // Bar color
    let barColor = "#48bb78"; // Green
    if (this.team === "enemy") {
      barColor = "#f56565"; // Red
    } else if (hpRatio < 0.35) {
      barColor = "#e53e3e"; // Low HP Red
    } else if (hpRatio < 0.65) {
      barColor = "#ed8936"; // Mid HP Orange
    }

    ctx.fillStyle = barColor;
    ctx.fillRect(-width / 2, -height / 2, width * hpRatio, height);

    ctx.restore();
  }
}
