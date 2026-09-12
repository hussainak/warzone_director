// js/engine/camera.js - Isometric 2.5D Camera and Coordinate Transformations

import { MAP_CONFIG } from "../config.js";

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;             // World translation offset X (center of screen in world coordinates)
    this.y = 0;             // World translation offset Y
    this.zoom = 1.0;        // Zoom level
    this.minZoom = 0.40;
    this.maxZoom = 2.40;
    this.targetZoom = 1.0;

    this.panSpeed = 750;    // Pixels per second
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    this.edgePan = { x: 0, y: 0 };
  }

  // Convert tile coordinate (tx, ty) into world coordinate space
  tileToWorld(tx, ty) {
    const wx = (tx - ty) * MAP_CONFIG.TILE_WIDTH_HALF;
    const wy = (tx + ty) * MAP_CONFIG.TILE_HEIGHT_HALF;
    return { x: wx, y: wy };
  }

  // Alias for compatibility
  tileToScreen(tx, ty) {
    return this.tileToWorld(tx, ty);
  }

  // Convert canvas pixel (cx, cy) into world coordinate (wx, wy)
  canvasToWorld(cx, cy) {
    const wx = (cx - this.canvas.width / 2) / this.zoom + this.x;
    const wy = (cy - this.canvas.height / 2) / this.zoom + this.y;
    return { x: wx, y: wy };
  }

  // Convert canvas screen mouse coordinates into tile/grid coordinates
  screenToTile(screenX, screenY) {
    const world = this.canvasToWorld(screenX, screenY);
    const normX = world.x / MAP_CONFIG.TILE_WIDTH_HALF;
    const normY = world.y / MAP_CONFIG.TILE_HEIGHT_HALF;

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
    const cx = (wx - this.x) * this.zoom + this.canvas.width / 2;
    const cy = (wy - this.y) * this.zoom + this.canvas.height / 2;
    return { x: cx, y: cy };
  }

  centerOn(tx, ty) {
    const w = this.tileToWorld(tx, ty);
    this.x = w.x;
    this.y = w.y;
  }

  panBy(dx, dy) {
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
  }

  update(dt) {
    let dx = 0;
    let dy = 0;

    if (this.keys.left) dx -= 1;
    if (this.keys.right) dx += 1;
    if (this.keys.up) dy -= 1;
    if (this.keys.down) dy += 1;

    dx += this.edgePan.x;
    dy += this.edgePan.y;

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
    ctx.translate(-this.x, -this.y);
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

  setZoom(newZoom) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    this.zoom = this.targetZoom;
  }

  zoomByRatio(ratio) {
    const newZoom = this.targetZoom * ratio;
    this.setZoom(newZoom);
  }
}
