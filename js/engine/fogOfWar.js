// js/engine/fogOfWar.js - Classic RTS Dual-Layer Fog of War

import { MAP_CONFIG } from "../config.js";

export const FOG_STATE = {
  UNEXPLORED: 0,
  EXPLORED: 1,
  VISIBLE: 2,
};

export class FogOfWar {
  constructor(width = MAP_CONFIG.WIDTH, height = MAP_CONFIG.HEIGHT) {
    this.width = width;
    this.height = height;
    // Explored mask: 1 = explored, 0 = shroud
    this.explored = new Uint8Array(width * height);
    // Current visible mask: 1 = visible right now, 0 = in fog
    this.visible = new Uint8Array(width * height);
    // Active recon scans (from Hero Q ability)
    this.activeScans = [];
  }

  // Add a temporary recon scan circle that keeps an area revealed
  addReconScan(x, y, radius, duration) {
    this.activeScans.push({
      x,
      y,
      radius,
      timer: duration,
      maxDuration: duration,
    });
  }

  getState(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return FOG_STATE.UNEXPLORED;
    const idx = y * this.width + x;
    if (this.visible[idx] === 1) return FOG_STATE.VISIBLE;
    if (this.explored[idx] === 1) return FOG_STATE.EXPLORED;
    return FOG_STATE.UNEXPLORED;
  }

  // Clear current visible buffer before recalculating for this frame
  resetVisible() {
    this.visible.fill(0);
  }

  // Update vision from all allied entities and active scans
  revealCircle(cx, cy, radius) {
    const rInt = Math.ceil(radius);
    const rSq = radius * radius;
    const minX = Math.max(0, Math.floor(cx - rInt));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + rInt));
    const minY = Math.max(0, Math.floor(cy - rInt));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + rInt));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (distSq <= rSq) {
          const idx = y * this.width + x;
          this.visible[idx] = 1;
          this.explored[idx] = 1;
        }
      }
    }
  }

  update(dt, alliedEntities) {
    this.resetVisible();

    // Vision from allied buildings, hero, and units
    for (let i = 0; i < alliedEntities.length; i++) {
      const e = alliedEntities[i];
      if (e.isDead) continue;
      const sightRadius = e.sightRadius || 6;
      this.revealCircle(e.x, e.y, sightRadius);
    }

    // Vision from active orbital recon scans
    for (let i = this.activeScans.length - 1; i >= 0; i--) {
      const scan = this.activeScans[i];
      scan.timer -= dt;
      if (scan.timer <= 0) {
        this.activeScans.splice(i, 1);
      } else {
        this.revealCircle(scan.x, scan.y, scan.radius);
      }
    }
  }

  // Render unexplored pitch-black shroud over areas that have never been seen
  renderShroud(ctx, camera) {
    const hw = MAP_CONFIG.TILE_WIDTH_HALF;
    const hh = MAP_CONFIG.TILE_HEIGHT_HALF;

    const c1 = camera.screenToTile(0, 0);
    const c2 = camera.screenToTile(camera.canvas.width, 0);
    const c3 = camera.screenToTile(0, camera.canvas.height);
    const c4 = camera.screenToTile(camera.canvas.width, camera.canvas.height);

    const minX = Math.max(0, Math.floor(Math.min(c1.x, c2.x, c3.x, c4.x)) - 2);
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(c1.x, c2.x, c3.x, c4.x)) + 2);
    const minY = Math.max(0, Math.floor(Math.min(c1.y, c2.y, c3.y, c4.y)) - 2);
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(c1.y, c2.y, c3.y, c4.y)) + 2);

    ctx.fillStyle = "#070b12";

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * this.width + x;
        if (this.explored[idx] === 0) {
          const { x: sx, y: sy } = camera.tileToScreen(x, y);
          ctx.beginPath();
          ctx.moveTo(sx, sy - hh);
          ctx.lineTo(sx + hw, sy);
          ctx.lineTo(sx, sy + hh);
          ctx.lineTo(sx - hw, sy);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Render active recon scan effects
    this.activeScans.forEach((scan) => {
      const { x: sx, y: sy } = camera.tileToScreen(scan.x, scan.y);
      ctx.save();
      ctx.translate(sx, sy);

      // Rotating satellite scanner sweep
      const sweepAngle = (Date.now() * 0.004) % (Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, scan.radius * hw, scan.radius * hh, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(0, 240, 255, 0.08)";
      ctx.beginPath();
      ctx.ellipse(0, 0, scan.radius * hw, scan.radius * hh, 0, 0, Math.PI * 2);
      ctx.fill();

      // Satellite scanner radar arm
      ctx.strokeStyle = "rgba(0, 255, 200, 0.8)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(sweepAngle) * scan.radius * hw, Math.sin(sweepAngle) * scan.radius * hh);
      ctx.stroke();

      ctx.restore();
    });
  }
}
