// js/systems/invasion.js - Hostile Armies Wave Director and Outpost Reinforcement

import { INVASION_CONFIG } from "../config.js";
import { Sound } from "../audio.js";

export class InvasionDirector {
  constructor(spawnEnemyUnitCallback, playerHqPos, heroRef) {
    this.spawnEnemy = spawnEnemyUnitCallback;
    this.playerHqPos = playerHqPos;
    this.hero = heroRef;

    this.currentWave = 1;
    this.maxWaves = 10;
    this.waveTimer = INVASION_CONFIG.INITIAL_DELAY;
    this.isWarning = false;
    this.isWaveActive = false;
    this.strikeVector = "NORTH-EAST"; // Direction of impending strike
    this.onWaveAlert = null;
    this.onWaveStart = null;
  }

  // Wave unit composition table
  getWaveComposition(wave) {
    switch (wave) {
      case 1:
        return [
          { type: "enemy_scout", count: 4 },
          { type: "enemy_militia", count: 2 },
        ];
      case 2:
        return [
          { type: "enemy_militia", count: 5 },
          { type: "enemy_rpg", count: 2 },
          { type: "enemy_technical", count: 1 },
        ];
      case 3:
        return [
          { type: "enemy_militia", count: 6 },
          { type: "enemy_rpg", count: 4 },
          { type: "enemy_technical", count: 3 },
        ];
      case 4:
        return [
          { type: "enemy_technical", count: 4 },
          { type: "enemy_tank", count: 1 },
          { type: "enemy_rpg", count: 4 },
        ];
      case 5:
        return [
          { type: "enemy_technical", count: 4 },
          { type: "enemy_tank", count: 2 },
          { type: "enemy_chopper", count: 2 },
        ];
      case 6:
        return [
          { type: "enemy_militia", count: 10 },
          { type: "enemy_rpg", count: 6 },
          { type: "enemy_tank", count: 3 },
          { type: "enemy_chopper", count: 2 },
        ];
      default:
        // Scaled endgame swarms
        return [
          { type: "enemy_tank", count: 3 + Math.floor(wave / 2) },
          { type: "enemy_chopper", count: 2 + Math.floor(wave / 3) },
          { type: "enemy_technical", count: 4 },
          { type: "enemy_rpg", count: 8 },
        ];
    }
  }

  // Pick random map perimeter invasion spawn vector
  getSpawnPoints() {
    const vectors = [
      { name: "NORTH", x: 35, y: 3 },
      { name: "NORTH-EAST", x: 62, y: 8 },
      { name: "EAST", x: 64, y: 35 },
      { name: "SOUTH-EAST", x: 60, y: 58 },
      { name: "SOUTH", x: 35, y: 64 },
    ];
    const pick = vectors[Math.floor(Math.random() * vectors.length)];
    this.strikeVector = pick.name;
    return pick;
  }

  triggerNextWaveEarly() {
    this.waveTimer = 1.0;
  }

  update(dt, units, pathfinding, particleSystem) {
    this.waveTimer -= dt;

    // Siren alert warning 20 seconds prior
    if (this.waveTimer <= INVASION_CONFIG.WARNING_DURATION && !this.isWarning) {
      this.isWarning = true;
      Sound.startSiren();
      if (this.onWaveAlert) {
        this.onWaveAlert(this.currentWave, this.strikeVector, Math.ceil(this.waveTimer));
      }
    }

    // Launch invasion wave
    if (this.waveTimer <= 0) {
      this.waveTimer = INVASION_CONFIG.TIME_BETWEEN_WAVES;
      this.isWarning = false;
      this.isWaveActive = true;
      Sound.stopSiren();

      const spawnPoint = this.getSpawnPoints();
      const comp = this.getWaveComposition(this.currentWave);

      comp.forEach((group) => {
        for (let i = 0; i < group.count; i++) {
          const offsetX = (Math.random() - 0.5) * 6;
          const offsetY = (Math.random() - 0.5) * 6;
          const sx = Math.max(2, Math.min(68, spawnPoint.x + offsetX));
          const sy = Math.max(2, Math.min(68, spawnPoint.y + offsetY));

          const spawnedUnit = this.spawnEnemy(group.type, sx, sy);
          if (spawnedUnit) {
            // Target player's HQ or Hero
            const targetX = Math.random() < 0.6 ? this.playerHqPos.x : this.hero.x;
            const targetY = Math.random() < 0.6 ? this.playerHqPos.y : this.hero.y;
            spawnedUnit.setMoveOrder(targetX, targetY, pathfinding);
          }
        }
      });

      if (this.onWaveStart) {
        this.onWaveStart(this.currentWave, this.strikeVector);
      }

      this.currentWave++;
    }
  }
}
