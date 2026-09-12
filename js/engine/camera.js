// js/engine/camera.js - Isometric 2.5D Camera and Coordinate Transformations

import { MAP_CONFIG } from "../config.js";

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;             // World translation offset X
    this.y = 0;             // World translation offset Y
    this.zoom = 1.0;        // Zoom level
    this.minZoom = 0.65;
    this.maxZoom = 1.6;
    this.targetZoom = 1.0;

    this.panSpeed = 650;    // Pixels per second
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    // Center camera on the initial base position (tile 18, 18)
    const initialScreen = this.tileToScreen(18, 18);
    this.x = initialScreen.x - canvas.width / 2;
    this.y = initialScreen.y - canvas.height / 3;
  }

  // Convert tile/world coordinates (x, y) into 2D isometric screen space
  tileToScreen(tx, ty) {
    const sx = (tx - ty) * MAP_CONFIG.TILE_WIDTH_HALF;
    const sy = (tx + ty) * MAP_CONFIG.TILE_HEIGHT_HALF;
    return { x: sx, y: sy };
  }

  // Convert viewport screen mouse coordinates (clientX, clientY) into tile/world coordinates
  screenToTile(screenX, screenY) {
    // Offset by camera position and zoom
    const worldX = (screenX - this.canvas.width / 2) / this.zoom + this.x + this.canvas.width / 2;
    const worldY = (screenY - this.canvas.height / 2) / this.zoom + this.y + this.canvas.height / 2;

    const normX = worldX / MAP_CONFIG.TILE_WIDTH_HALF;
    const normY = worldY / MAP_CONFIG.TILE_HEIGHT_HALF;

    const tileX = (normX + normY) / 2;
    const tileY = (normY - normX) / 2;

    return {
      x: Math.floor(tileX),
      y: Math.floor(tileY),
      fx: tileX,
      fy: tileY,
    };
  }

  // Transform world point into current rendering canvas space
  worldToCanvas(wx, wy) {
    const cx = (wx - (this.x + this.canvas.width / 2)) * this.zoom + this.canvas.width / 2;
    const cy = (wy - (this.y + this.canvas.height / 2)) * this.zoom + this.canvas.height / 2;
    return { x: cx, y: cy };
  }

  centerOn(tx, ty) {
    const s = this.tileToScreen(tx, ty);
    this.x = s.x;
    this.y = s.y;
  }

  update(dt) {
    let dx = 0;
    let dy = 0;

    if (this.keys.left) dx -= 1;
    if (this.keys.right) dx += 1;
    if (this.keys.up) dy -= 1;
    if (this.keys.down) dy += 1;

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    this.x += dx * this.panSpeed * (dt / this.zoom);
    this.y += dy * this.panSpeed * (dt / this.zoom);

    // Smooth zoom lerp
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 10);
  }

  applyTransform(ctx) {
    ctx.save();
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x - this.canvas.width / 2, -this.y - this.canvas.height / 2);
  }

  restoreTransform(ctx) {
    ctx.restore();
  }

  handleZoom(delta) {
    if (delta < 0) {
      this.targetZoom = Math.min(this.maxZoom, this.targetZoom + 0.15);
    } else {
      this.targetZoom = Math.max(this.minZoom, this.targetZoom - 0.15);
    }
  }
}
