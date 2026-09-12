// js/engine/map.js - Sunny Morning Terrain Grid, Isometric Rendering, and Resource Nodes

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
    this.decorations = [];   // Trees, sandbag piles, rock boulders
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
    // Fill with lush morning emerald grass
    for (let i = 0; i < this.width * this.height; i++) {
      this.tiles[i] = TILE_TYPES.GRASS;
      this.collisionGrid[i] = 0;
    }

    // Sparkling River flowing across map with two paved bridge crossings
    for (let x = 0; x < this.width; x++) {
      const riverY = Math.floor(36 + Math.sin(x * 0.14) * 5);
      for (let offset = -2; offset <= 2; offset++) {
        const ry = riverY + offset;
        if (ry >= 0 && ry < this.height) {
          // Bridges at x = 18..22 and x = 46..50
          if ((x >= 18 && x <= 22) || (x >= 46 && x <= 50)) {
            this.setTile(x, ry, TILE_TYPES.ROAD);
          } else {
            this.setTile(x, ry, TILE_TYPES.WATER);
            this.setBlocked(x, ry, true);
          }
        }
      }
    }

    // Sandy riverbanks bordering the water
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (this.getTile(x, y) === TILE_TYPES.GRASS) {
          const neighbors = [
            this.getTile(x + 1, y), this.getTile(x - 1, y),
            this.getTile(x, y + 1), this.getTile(x, y - 1)
          ];
          if (neighbors.includes(TILE_TYPES.WATER)) {
            this.setTile(x, y, TILE_TYPES.DIRT);
          }
        }
      }
    }

    // Sunny Asphalt Military Highways connecting base to bridge and sectors
    for (let x = 10; x < 62; x++) {
      if (this.getTile(x, 19) !== TILE_TYPES.WATER) this.setTile(x, 19, TILE_TYPES.ROAD);
      if (this.getTile(x, 52) !== TILE_TYPES.WATER) this.setTile(x, 52, TILE_TYPES.ROAD);
    }
    for (let y = 10; y < 62; y++) {
      if (this.getTile(20, y) !== TILE_TYPES.WATER) this.setTile(20, y, TILE_TYPES.ROAD);
      if (this.getTile(48, y) !== TILE_TYPES.WATER) this.setTile(48, y, TILE_TYPES.ROAD);
    }

    // Player Base foundation zone at (14..26, 14..25)
    for (let bx = 14; bx <= 26; bx++) {
      for (let by = 14; by <= 25; by++) {
        if (this.getTile(bx, by) !== TILE_TYPES.ROAD && this.getTile(bx, by) !== TILE_TYPES.WATER) {
          this.setTile(bx, by, TILE_TYPES.CONCRETE);
        }
      }
    }

    // Enemy Outpost zones (distant)
    for (let ex = 48; ex <= 56; ex++) {
      for (let ey = 12; ey <= 20; ey++) {
        if (this.getTile(ex, ey) !== TILE_TYPES.ROAD) {
          this.setTile(ex, ey, TILE_TYPES.DIRT);
        }
      }
      for (let ey = 48; ey <= 56; ey++) {
        if (this.getTile(ex, ey) !== TILE_TYPES.ROAD) {
          this.setTile(ex, ey, TILE_TYPES.DIRT);
        }
      }
    }

    // Mountain rock clusters (natural barriers)
    const rockClusters = [
      { x: 32, y: 12, size: 4 },
      { x: 10, y: 40, size: 4 },
      { x: 40, y: 44, size: 4 },
      { x: 60, y: 32, size: 4 },
      { x: 34, y: 58, size: 4 },
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
      { id: "oil_1", type: "oil", x: 28, y: 22, captured: false, hp: 800, maxHp: 800, name: "North-West Oil Derrick" },
      { id: "oil_2", type: "oil", x: 24, y: 40, captured: false, hp: 800, maxHp: 800, name: "Central River Oil Rig" },
      { id: "oil_3", type: "oil", x: 44, y: 26, captured: false, hp: 800, maxHp: 800, name: "East Sector Oil Well" },
      { id: "oil_4", type: "oil", x: 36, y: 48, captured: false, hp: 800, maxHp: 800, name: "South Outpost Derrick" }
    );

    // Scavengeable Supply Crates
    const cratePositions = [
      { x: 14, y: 27 }, { x: 29, y: 15 }, { x: 33, y: 27 }, { x: 16, y: 44 },
      { x: 38, y: 38 }, { x: 44, y: 14 }, { x: 56, y: 24 }, { x: 42, y: 56 }
    ];
    cratePositions.forEach((pos, idx) => {
      this.resourceNodes.push({
        id: `crate_${idx}`,
        type: "crate",
        x: pos.x,
        y: pos.y,
        funds: 250,
        tech: 60,
        collected: false,
        name: "Military Supply Drop",
      });
    });

    this.resourceNodes.forEach((node) => {
      if (node.type === "oil") {
        this.setBlocked(node.x, node.y, true);
      }
    });

    // Scatter morning spruce & pine trees across green sectors
    for (let x = 2; x < this.width - 2; x += 2) {
      for (let y = 2; y < this.height - 2; y += 2) {
        if (this.getTile(x, y) === TILE_TYPES.GRASS && Math.random() < 0.24) {
          this.decorations.push({
            x: x + (Math.random() * 0.5 - 0.25),
            y: y + (Math.random() * 0.5 - 0.25),
            type: Math.random() < 0.8 ? "tree" : "sandbags",
          });
        }
      }
    }
  }

  // Render bright sunny morning isometric terrain tiles
  render(ctx, camera, fogOfWar) {
    const hw = MAP_CONFIG.TILE_WIDTH_HALF;
    const hh = MAP_CONFIG.TILE_HEIGHT_HALF;

    const c1 = camera.screenToTile(0, 0);
    const c2 = camera.screenToTile(camera.canvas.width, 0);
    const c3 = camera.screenToTile(0, camera.canvas.height);
    const c4 = camera.screenToTile(camera.canvas.width, camera.canvas.height);

    const minX = Math.max(0, Math.floor(Math.min(c1.x, c2.x, c3.x, c4.x)) - 4);
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(c1.x, c2.x, c3.x, c4.x)) + 4);
    const minY = Math.max(0, Math.floor(Math.min(c1.y, c2.y, c3.y, c4.y)) - 4);
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(c1.y, c2.y, c3.y, c4.y)) + 4);

    const waterAnim = Math.sin(Date.now() * 0.003) * 0.15;

    // Draw isometric terrain diamonds in bright morning daylight
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const type = this.getTile(x, y);
        const { x: sx, y: sy } = camera.tileToScreen(x, y);

        ctx.beginPath();
        ctx.moveTo(sx, sy - hh);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hh);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();

        // Sunny morning color palette (Age of Empires II inspired)
        switch (type) {
          case TILE_TYPES.CONCRETE:
            // Bright paved military concrete
            ctx.fillStyle = (x + y) % 2 === 0 ? "#6b7a8d" : "#728194";
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

          case TILE_TYPES.ROAD:
            // Sunlit asphalt road with centerline
            ctx.fillStyle = "#3e4856";
            ctx.fill();
            ctx.strokeStyle = "#505c6d";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

          case TILE_TYPES.WATER:
            // Sparkling azure morning river
            ctx.fillStyle = (x + y) % 2 === 0 ? "#2578bf" : "#2a82cb";
            ctx.fill();
            ctx.strokeStyle = "rgba(164, 218, 255, 0.35)";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

          case TILE_TYPES.DIRT:
            // Warm golden-brown sandy trails & riverbanks
            ctx.fillStyle = (x + y) % 2 === 0 ? "#b8956e" : "#bf9d75";
            ctx.fill();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
            break;

          case TILE_TYPES.ROCK:
            // Granite mountain rock
            ctx.fillStyle = "#73675a";
            ctx.fill();
            ctx.strokeStyle = "#87796a";
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

          default: // GRASS
            // Lush, vibrant morning emerald grass with AoE II checkerboard depth
            ctx.fillStyle = (x + y) % 2 === 0 ? "#4e9b38" : "#56a83d";
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
            break;
        }

        // Soft morning fog shading for tiles that haven't been actively scouted
        if (fogOfWar) {
          const fogState = fogOfWar.getState(x, y);
          if (fogState === 1) {
            // Explored: soft morning shadow
            ctx.fillStyle = "rgba(18, 28, 42, 0.22)";
            ctx.fill();
          } else if (fogState === 0) {
            // Unexplored: gentle morning mist (terrain still visible)
            ctx.fillStyle = "rgba(14, 24, 38, 0.38)";
            ctx.fill();
          }
        }
      }
    }

    // Render Resource Nodes (Oil Derricks and Supply Crates)
    this.resourceNodes.forEach((node) => {
      const { x: sx, y: sy } = camera.tileToScreen(node.x, node.y);

      if (node.type === "oil") {
        // High-tech Oil Derrick Rig
        ctx.save();
        ctx.translate(sx, sy);

        // Rig base shadow (morning light from top-left)
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.beginPath();
        ctx.ellipse(8, 6, 22, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Platform
        ctx.fillStyle = node.captured ? "#2b6cb0" : "#4a5568";
        ctx.fillRect(-14, -8, 28, 12);

        // Steel Derrick Tower
        ctx.strokeStyle = node.captured ? "#63b3ed" : "#cbd5e0";
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
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-12, -3, 24, 6);
        ctx.restore();

        // Status badge
        ctx.fillStyle = node.captured ? "#2f855a" : "#c05621";
        ctx.font = "bold 9px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.captured ? "SECURED DERRICK" : "NEUTRAL OIL RIG", 0, -38);

        ctx.restore();
      } else if (node.type === "crate" && !node.collected) {
        // High-tech Military Supply Crate with golden parachute flare
        ctx.save();
        ctx.translate(sx, sy);

        const bob = Math.sin(Date.now() * 0.005 + node.x) * 2;

        // Morning Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.beginPath();
        ctx.ellipse(5, 5, 11, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Crate body
        ctx.fillStyle = "#d69e2e";
        ctx.fillRect(-8, -12 + bob, 16, 14);
        ctx.strokeStyle = "#744210";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-8, -12 + bob, 16, 14);

        // White cross
        ctx.fillStyle = "#fff";
        ctx.fillRect(-2, -10 + bob, 4, 10);
        ctx.fillRect(-6, -7 + bob, 12, 4);

        // Supply label
        ctx.fillStyle = "#744210";
        ctx.font = "bold 8px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SUPPLY", 0, -16 + bob);

        ctx.restore();
      }
    });

    // Render tree decorations with morning sunlight highlights
    this.decorations.forEach((dec) => {
      const { x: sx, y: sy } = camera.tileToScreen(dec.x, dec.y);

      if (dec.type === "tree") {
        ctx.save();
        ctx.translate(sx, sy);

        // Morning directional shadow (cast towards bottom-right)
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.beginPath();
        ctx.ellipse(8, 6, 10, 5, 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = "#5c4028";
        ctx.fillRect(-2, -6, 4, 8);

        // Foliage cones with morning sunlight on the left
        ctx.fillStyle = "#27672e";
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(0, -18);
        ctx.lineTo(10, -4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#32833a";
        ctx.beginPath();
        ctx.moveTo(-8, -12);
        ctx.lineTo(0, -26);
        ctx.lineTo(8, -12);
        ctx.closePath();
        ctx.fill();

        // Top sunlit crown
        ctx.fillStyle = "#41a34c";
        ctx.beginPath();
        ctx.moveTo(-6, -20);
        ctx.lineTo(0, -32);
        ctx.lineTo(6, -20);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      } else {
        // Sandbag fortification
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = "#d69e2e";
        ctx.fillRect(-8, -4, 16, 6);
        ctx.strokeStyle = "#975a16";
        ctx.strokeRect(-8, -4, 16, 6);
        ctx.restore();
      }
    });
  }
}
