// js/engine/map.js - Terrain Grid, Isometric Rendering, and Resource Nodes

import { MAP_CONFIG } from "../config.js";

export const TILE_TYPES = {
  GRASS: 0,
  DIRT: 1,
  CONCRETE: 2,
  ROAD: 3,
  WATER: 4,
  ROCK: 5,
};

export class TerrainMap {
  constructor(width = MAP_CONFIG.WIDTH, height = MAP_CONFIG.HEIGHT) {
    this.width = width;
    this.height = height;
    this.tiles = new Uint8Array(width * height);
    this.collisionGrid = new Uint8Array(width * height); // 1 = blocked, 0 = walkable
    this.decorations = [];   // Trees, sandbag piles, barrels
    this.resourceNodes = []; // Capturable oil derricks, supply crates

    this.generateTerrain();
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TILE_TYPES.ROCK;
    return this.tiles[y * this.width + x];
  }

  setTile(x, y, type) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.tiles[y * this.width + x] = type;
  }

  isBlocked(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
    return this.collisionGrid[y * this.width + x] === 1;
  }

  setBlocked(x, y, blocked = true) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.collisionGrid[y * this.width + x] = blocked ? 1 : 0;
  }

  generateTerrain() {
    // Fill with tactical steppe grass
    for (let i = 0; i < this.width * this.height; i++) {
      this.tiles[i] = TILE_TYPES.GRASS;
      this.collisionGrid[i] = 0;
    }

    // River running through the map from top-right to bottom-left with crossing bridges
    for (let x = 0; x < this.width; x++) {
      const riverY = Math.floor(35 + Math.sin(x * 0.15) * 6);
      for (let offset = -2; offset <= 2; offset++) {
        const ry = riverY + offset;
        if (ry >= 0 && ry < this.height) {
          // Leave bridge crossing at x = 20..24 and x = 45..49
          if ((x >= 20 && x <= 23) || (x >= 46 && x <= 49)) {
            this.setTile(x, ry, TILE_TYPES.ROAD);
          } else {
            this.setTile(x, ry, TILE_TYPES.WATER);
            this.setBlocked(x, ry, true);
          }
        }
      }
    }

    // Asphalt Military Roads connecting sectors
    for (let x = 8; x < 62; x++) {
      if (this.getTile(x, 18) !== TILE_TYPES.WATER) this.setTile(x, 18, TILE_TYPES.ROAD);
      if (this.getTile(x, 52) !== TILE_TYPES.WATER) this.setTile(x, 52, TILE_TYPES.ROAD);
    }
    for (let y = 8; y < 62; y++) {
      if (this.getTile(18, y) !== TILE_TYPES.WATER) this.setTile(18, y, TILE_TYPES.ROAD);
      if (this.getTile(48, y) !== TILE_TYPES.WATER) this.setTile(48, y, TILE_TYPES.ROAD);
    }

    // Player Base foundation zone at (14..22, 14..22)
    for (let bx = 14; bx <= 22; bx++) {
      for (let by = 14; by <= 22; by++) {
        this.setTile(bx, by, TILE_TYPES.CONCRETE);
      }
    }

    // Enemy Outpost foundation zone at (48..56, 48..56)
    for (let ex = 48; ex <= 56; ex++) {
      for (let ey = 48; ey <= 56; ey++) {
        this.setTile(ex, ey, TILE_TYPES.DIRT);
      }
    }

    // Rock ridges (cliffs / barriers)
    const rockClusters = [
      { x: 30, y: 12, size: 4 },
      { x: 10, y: 40, size: 5 },
      { x: 40, y: 42, size: 4 },
      { x: 58, y: 30, size: 5 },
      { x: 34, y: 56, size: 4 },
    ];
    rockClusters.forEach((c) => {
      for (let rx = c.x - c.size; rx <= c.x + c.size; rx++) {
        for (let ry = c.y - c.size; ry <= c.y + c.size; ry++) {
          if (Math.hypot(rx - c.x, ry - c.y) <= c.size && this.getTile(rx, ry) === TILE_TYPES.GRASS) {
            this.setTile(rx, ry, TILE_TYPES.ROCK);
            this.setBlocked(rx, ry, true);
          }
        }
      }
    });

    // Resource Nodes: Capturable Oil Derricks
    this.resourceNodes.push(
      { id: "oil_1", type: "oil", x: 26, y: 22, captured: false, hp: 600, maxHp: 600, name: "North-West Oil Derrick" },
      { id: "oil_2", type: "oil", x: 22, y: 38, captured: false, hp: 600, maxHp: 600, name: "Central River Oil Rig" },
      { id: "oil_3", type: "oil", x: 44, y: 26, captured: false, hp: 600, maxHp: 600, name: "East Sector Oil Well" },
      { id: "oil_4", type: "oil", x: 36, y: 48, captured: false, hp: 600, maxHp: 600, name: "South Outpost Derrick" }
    );

    // Scavengeable Supply Crates
    const cratePositions = [
      { x: 12, y: 25 }, { x: 28, y: 14 }, { x: 32, y: 26 }, { x: 15, y: 45 },
      { x: 38, y: 38 }, { x: 44, y: 14 }, { x: 56, y: 24 }, { x: 42, y: 56 }
    ];
    cratePositions.forEach((pos, idx) => {
      this.resourceNodes.push({
        id: `crate_${idx}`,
        type: "crate",
        x: pos.x,
        y: pos.y,
        funds: 160,
        tech: 45,
        collected: false,
        name: "Military Supply Drop",
      });
    });

    // Mark oil derricks as blocked
    this.resourceNodes.forEach((node) => {
      if (node.type === "oil") {
        this.setBlocked(node.x, node.y, true);
      }
    });

    // Scatter procedural trees and sandbag props
    for (let x = 2; x < this.width - 2; x += 3) {
      for (let y = 2; y < this.height - 2; y += 3) {
        if (this.getTile(x, y) === TILE_TYPES.GRASS && Math.random() < 0.28) {
          this.decorations.push({
            x: x + (Math.random() * 0.6 - 0.3),
            y: y + (Math.random() * 0.6 - 0.3),
            type: Math.random() < 0.75 ? "tree" : "sandbags",
          });
        }
      }
    }
  }

  // Render visible isometric terrain tiles
  render(ctx, camera, fogOfWar) {
    const hw = MAP_CONFIG.TILE_WIDTH_HALF;
    const hh = MAP_CONFIG.TILE_HEIGHT_HALF;

    // Determine visible tile bounds using inverse camera corners
    const c1 = camera.screenToTile(0, 0);
    const c2 = camera.screenToTile(camera.canvas.width, 0);
    const c3 = camera.screenToTile(0, camera.canvas.height);
    const c4 = camera.screenToTile(camera.canvas.width, camera.canvas.height);

    const minX = Math.max(0, Math.floor(Math.min(c1.x, c2.x, c3.x, c4.x)) - 3);
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(c1.x, c2.x, c3.x, c4.x)) + 3);
    const minY = Math.max(0, Math.floor(Math.min(c1.y, c2.y, c3.y, c4.y)) - 3);
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(c1.y, c2.y, c3.y, c4.y)) + 3);

    // Draw isometric terrain diamonds
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const fogState = fogOfWar ? fogOfWar.getState(x, y) : 2; // 0 = hidden, 1 = explored, 2 = visible
        if (fogState === 0) continue; // Unexplored shroud

        const type = this.getTile(x, y);
        const { x: sx, y: sy } = camera.tileToScreen(x, y);

        ctx.beginPath();
        ctx.moveTo(sx, sy - hh);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hh);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();

        // Style tile based on terrain type
        switch (type) {
          case TILE_TYPES.CONCRETE:
            ctx.fillStyle = "#2d3748";
            ctx.fill();
            ctx.strokeStyle = "#4a5568";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
          case TILE_TYPES.ROAD:
            ctx.fillStyle = "#1e2430";
            ctx.fill();
            ctx.strokeStyle = "#384252";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
          case TILE_TYPES.WATER:
            ctx.fillStyle = "#1a365d";
            ctx.fill();
            ctx.strokeStyle = "#2b6cb0";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
          case TILE_TYPES.DIRT:
            ctx.fillStyle = "#3d2f21";
            ctx.fill();
            ctx.strokeStyle = "#57422f";
            ctx.lineWidth = 0.5;
            ctx.stroke();
            break;
          case TILE_TYPES.ROCK:
            ctx.fillStyle = "#4a4238";
            ctx.fill();
            ctx.strokeStyle = "#685d4f";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
          default: // GRASS
            // Alternate tile shades for classic Age of Empires isometric depth
            ctx.fillStyle = (x + y) % 2 === 0 ? "#1c2e1f" : "#1f3322";
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
            break;
        }

        // Shroud overlay for explored but not currently visible tiles
        if (fogState === 1) {
          ctx.fillStyle = "rgba(4, 8, 14, 0.65)";
          ctx.fill();
        }
      }
    }

    // Render Resource Nodes (Oil Derricks and Supply Crates)
    this.resourceNodes.forEach((node) => {
      const fogState = fogOfWar ? fogOfWar.getState(node.x, node.y) : 2;
      if (fogState === 0) return;

      const { x: sx, y: sy } = camera.tileToScreen(node.x, node.y);

      if (node.type === "oil") {
        // High-tech Oil Derrick Rig
        ctx.save();
        ctx.translate(sx, sy);

        // Rig base shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(0, 4, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Platform
        ctx.fillStyle = node.captured ? "#2b6cb0" : "#4a5568";
        ctx.fillRect(-14, -8, 28, 12);

        // Steel Derrick Tower
        ctx.strokeStyle = node.captured ? "#63b3ed" : "#a0aec0";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(0, -32);
        ctx.lineTo(10, 0);
        ctx.stroke();

        // Cross braces
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-7, -12);
        ctx.lineTo(7, -12);
        ctx.moveTo(-4, -22);
        ctx.lineTo(4, -22);
        ctx.stroke();

        // Derrick pump head
        const pumpAngle = Math.sin(Date.now() * 0.003) * 0.35;
        ctx.save();
        ctx.translate(0, -32);
        ctx.rotate(pumpAngle);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(-12, -3, 24, 6);
        ctx.restore();

        // Status badge
        ctx.fillStyle = node.captured ? "#48bb78" : "#ed8936";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(node.captured ? "ALLIED DERRICK" : "NEUTRAL OIL RIG", 0, -40);

        ctx.restore();
      } else if (node.type === "crate" && !node.collected) {
        // High-tech Military Supply Crate with parachute flare
        ctx.save();
        ctx.translate(sx, sy);

        // Subtle floating / pulse
        const bob = Math.sin(Date.now() * 0.005 + node.x) * 2;

        // Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.beginPath();
        ctx.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Crate body
        ctx.fillStyle = "#d69e2e";
        ctx.fillRect(-8, -12 + bob, 16, 14);
        ctx.strokeStyle = "#744210";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-8, -12 + bob, 16, 14);

        // Glow cross
        ctx.fillStyle = "#fff";
        ctx.fillRect(-2, -10 + bob, 4, 10);
        ctx.fillRect(-6, -7 + bob, 12, 4);

        // Supply label
        ctx.fillStyle = "#faf089";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText("SUPPLY", 0, -16 + bob);

        ctx.restore();
      }
    });

    // Render tree decorations
    this.decorations.forEach((dec) => {
      const tx = Math.floor(dec.x);
      const ty = Math.floor(dec.y);
      const fogState = fogOfWar ? fogOfWar.getState(tx, ty) : 2;
      if (fogState === 0) return;

      const { x: sx, y: sy } = camera.tileToScreen(dec.x, dec.y);

      if (dec.type === "tree") {
        // Vector Pine / Spruce Tree
        ctx.save();
        ctx.translate(sx, sy);

        // Tree shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.beginPath();
        ctx.ellipse(5, 4, 8, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = "#4a3525";
        ctx.fillRect(-2, -6, 4, 8);

        // Foliage cones
        ctx.fillStyle = "#1e4620";
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(0, -18);
        ctx.lineTo(10, -4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#275c2a";
        ctx.beginPath();
        ctx.moveTo(-8, -12);
        ctx.lineTo(0, -26);
        ctx.lineTo(8, -12);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#337a37";
        ctx.beginPath();
        ctx.moveTo(-6, -20);
        ctx.lineTo(0, -32);
        ctx.lineTo(6, -20);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      } else {
        // Sandbag fortification pile
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = "#b7791f";
        ctx.fillRect(-8, -4, 16, 6);
        ctx.strokeStyle = "#744210";
        ctx.strokeRect(-8, -4, 16, 6);
        ctx.restore();
      }
    });
  }
}
