// js/engine/particles.js - Particle Systems, Explosions, Smoke Trails, and Floating Text

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.groundDecals = []; // Tank track marks, scorch marks
  }

  // Floating damage or bounty indicator
  addFloatingText(x, y, text, color = "#ff4444", fontSize = 13) {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      fontSize,
      life: 1.2,
      maxLife: 1.2,
      vy: -1.2,
    });
  }

  // Muzzle flash when units fire
  addMuzzleFlash(x, y, angle) {
    for (let i = 0; i < 4; i++) {
      const speed = 2 + Math.random() * 3;
      const spread = angle + (Math.random() - 0.5) * 0.6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(spread) * speed,
        vy: Math.sin(spread) * speed,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.4 ? "#ffdd55" : "#ff5500",
        alpha: 1.0,
        life: 0.12,
        maxLife: 0.12,
        type: "spark",
      });
    }
  }

  // Smoke trail for rockets and damaged vehicles
  addSmoke(x, y, size = 4, color = "rgba(160, 160, 160, 0.6)") {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 0.4,
      y: y + (Math.random() - 0.5) * 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.6 - Math.random() * 0.5,
      size,
      maxSize: size * 2.5,
      color,
      alpha: 0.7,
      life: 0.8,
      maxLife: 0.8,
      type: "smoke",
    });
  }

  // Fiery explosion
  addExplosion(x, y, intensity = "medium") {
    const count = intensity === "large" ? 35 : 18;
    const baseRadius = intensity === "large" ? 6 : 3.5;

    // Ground scorch decal
    this.groundDecals.push({
      x,
      y,
      radius: baseRadius * 1.5,
      alpha: 0.8,
      life: 15.0, // Lasts 15 seconds
      maxLife: 15.0,
    });

    // Expanding shockwave ring
    this.particles.push({
      x,
      y,
      radius: 2,
      maxRadius: intensity === "large" ? 28 : 16,
      color: "rgba(255, 200, 100, 0.8)",
      alpha: 0.9,
      life: 0.35,
      maxLife: 0.35,
      type: "shockwave",
    });

    // Fireball puffs
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random() * 2.5) * (intensity === "large" ? 1.8 : 1.0);
      const isFire = Math.random() < 0.65;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (3 + Math.random() * 6) * (intensity === "large" ? 1.5 : 1.0),
        maxSize: (8 + Math.random() * 12) * (intensity === "large" ? 1.8 : 1.0),
        color: isFire ? (Math.random() < 0.5 ? "#ff4500" : "#ffa500") : "#4a5568",
        alpha: 1.0,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        type: "fire",
      });
    }

    // High velocity sparks/shrapnel
    for (let i = 0; i < (intensity === "large" ? 20 : 10); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        color: "#fff3a8",
        alpha: 1.0,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        type: "spark",
      });
    }
  }

  // Nanotech healing aura sparkles
  addHealPulse(x, y, radius = 4) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      this.particles.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -1.2 - Math.random() * 1.0,
        size: 2 + Math.random() * 2,
        color: "#38ef7d",
        alpha: 1.0,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
        type: "heal",
      });
    }
  }

  update(dt) {
    // Update ground decals
    for (let i = this.groundDecals.length - 1; i >= 0; i--) {
      const d = this.groundDecals[i];
      d.life -= dt;
      d.alpha = Math.max(0, d.life / d.maxLife) * 0.7;
      if (d.life <= 0) this.groundDecals.splice(i, 1);
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const progress = 1 - p.life / p.maxLife;

      if (p.type === "shockwave") {
        p.radius += (p.maxRadius - p.radius) * dt * 10;
        p.alpha = 1 - progress;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.type === "smoke" || p.type === "fire") {
          p.size += (p.maxSize - p.size) * dt * 3;
          p.alpha = Math.max(0, 1 - progress);
        } else if (p.type === "spark" || p.type === "heal") {
          p.alpha = Math.max(0, 1 - progress);
        }
      }
    }

    // Update floating damage / bounty texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // Render ground decals beneath units
  renderDecals(ctx, camera) {
    this.groundDecals.forEach((d) => {
      const { x: sx, y: sy } = camera.tileToScreen(d.x, d.y);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = `rgba(18, 14, 10, ${d.alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, d.radius * 3, d.radius * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // Render air particles and shockwaves
  render(ctx, camera) {
    this.particles.forEach((p) => {
      const { x: sx, y: sy } = camera.tileToScreen(p.x, p.y);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalAlpha = p.alpha;

      if (p.type === "shockwave") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 2, p.radius, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "smoke") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "fire") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "heal") {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size * 1.5, p.size, p.size * 3);
        ctx.fillRect(-p.size * 1.5, -p.size / 2, p.size * 3, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }

      ctx.restore();
    });

    // Render floating texts
    this.floatingTexts.forEach((t) => {
      const { x: sx, y: sy } = camera.tileToScreen(t.x, t.y);
      const alpha = Math.min(1, t.life / 0.3);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${t.fontSize}px 'Outfit', sans-serif, monospace`;
      ctx.textAlign = "center";

      // Dark text shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillText(t.text, 1, 1);

      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);

      ctx.restore();
    });
  }
}
