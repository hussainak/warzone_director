// js/engine/pathfinding.js - Optimized 8-Directional A* Pathfinding and Flocking

export class Pathfinding {
  constructor(terrainMap) {
    this.map = terrainMap;
    this.width = terrainMap.width;
    this.height = terrainMap.height;
  }

  // Heuristic: Octile distance for 8-directional grid movement
  heuristic(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    const F = Math.SQRT2 - 1;
    return dx < dy ? F * dx + dy : F * dy + dx;
  }

  findPath(startX, startY, endX, endY, isFlying = false) {
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    endX = Math.floor(endX);
    endY = Math.floor(endY);

    // If destination is out of bounds
    if (endX < 0 || endX >= this.width || endY < 0 || endY >= this.height) {
      return null;
    }

    // If flying unit (chopper), straight flight path
    if (isFlying) {
      return [{ x: endX + 0.5, y: endY + 0.5 }];
    }

    // If destination is blocked, find nearest walkable tile
    if (this.map.isBlocked(endX, endY)) {
      const neighbors = [
        { x: endX + 1, y: endY }, { x: endX - 1, y: endY },
        { x: endX, y: endY + 1 }, { x: endX, y: endY - 1 },
        { x: endX + 1, y: endY + 1 }, { x: endX - 1, y: endY - 1 },
        { x: endX + 1, y: endY - 1 }, { x: endX - 1, y: endY + 1 },
      ];
      let found = false;
      for (const n of neighbors) {
        if (!this.map.isBlocked(n.x, n.y)) {
          endX = n.x;
          endY = n.y;
          found = true;
          break;
        }
      }
      if (!found) return null;
    }

    if (startX === endX && startY === endY) {
      return [{ x: endX + 0.5, y: endY + 0.5 }];
    }

    // Priority queue / Open Set
    const openSet = [];
    const closedSet = new Uint8Array(this.width * this.height);
    const gScore = new Float32Array(this.width * this.height).fill(Infinity);
    const cameFrom = new Int32Array(this.width * this.height).fill(-1);

    const startIdx = startY * this.width + startX;
    const endIdx = endY * this.width + endX;

    gScore[startIdx] = 0;
    openSet.push({ x: startX, y: startY, f: this.heuristic(startX, startY, endX, endY), idx: startIdx });

    const DIRS = [
      { dx: 1, dy: 0, cost: 1 },
      { dx: -1, dy: 0, cost: 1 },
      { dx: 0, dy: 1, cost: 1 },
      { dx: 0, dy: -1, cost: 1 },
      { dx: 1, dy: 1, cost: 1.414 },
      { dx: -1, dy: 1, cost: 1.414 },
      { dx: 1, dy: -1, cost: 1.414 },
      { dx: -1, dy: -1, cost: 1.414 },
    ];

    let iterations = 0;
    const maxIterations = 2000;

    while (openSet.length > 0 && iterations++ < maxIterations) {
      // Find node with lowest f score
      let lowestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIdx].f) {
          lowestIdx = i;
        }
      }

      const current = openSet.splice(lowestIdx, 1)[0];
      if (current.idx === endIdx) {
        // Reconstruct path
        const path = [];
        let curr = endIdx;
        while (curr !== -1) {
          const cy = Math.floor(curr / this.width);
          const cx = curr % this.width;
          path.push({ x: cx + 0.5, y: cy + 0.5 });
          curr = cameFrom[curr];
        }
        path.reverse();
        // Remove start node
        if (path.length > 1) path.shift();
        return path;
      }

      closedSet[current.idx] = 1;

      for (let i = 0; i < DIRS.length; i++) {
        const d = DIRS[i];
        const nx = current.x + d.dx;
        const ny = current.y + d.dy;

        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

        const nIdx = ny * this.width + nx;
        if (closedSet[nIdx] === 1) continue;

        // Blocked check
        if (this.map.isBlocked(nx, ny)) continue;

        // Prevent cutting corners through walls
        if (d.dx !== 0 && d.dy !== 0) {
          if (this.map.isBlocked(current.x + d.dx, current.y) || this.map.isBlocked(current.x, current.y + d.dy)) {
            continue;
          }
        }

        const tentativeG = gScore[current.idx] + d.cost;
        if (tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = current.idx;
          gScore[nIdx] = tentativeG;
          const f = tentativeG + this.heuristic(nx, ny, endX, endY);

          const existing = openSet.find((node) => node.idx === nIdx);
          if (!existing) {
            openSet.push({ x: nx, y: ny, f, idx: nIdx });
          } else {
            existing.f = f;
          }
        }
      }
    }

    // Direct fallback if path blocked
    return [{ x: endX + 0.5, y: endY + 0.5 }];
  }
}
