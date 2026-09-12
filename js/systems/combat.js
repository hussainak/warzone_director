// js/systems/combat.js - Damage Resolution, Death Cleanup, Bounties, and Node Capture

import { Sound } from "../audio.js";

export class CombatSystem {
  constructor(economy, hero, particleSystem, terrainMap) {
    this.economy = economy;
    this.hero = hero;
    this.particleSystem = particleSystem;
    this.map = terrainMap;
  }

  update(dt, units, buildings, allEntities) {
    // Process dead units and award bounties
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.isDead) {
        this.particleSystem.addExplosion(u.x, u.y, u.category === "vehicle" ? "medium" : "small");
        Sound.playExplosion(u.category === "vehicle" ? "medium" : "small");

        if (u.team === "enemy") {
          const bounty = u.bounty || 25;
          const techBounty = u.techBounty || 5;
          this.economy.addFunds(bounty);
          this.economy.addTech(techBounty);
          this.hero.addXp(bounty * 1.5, this.particleSystem);

          this.particleSystem.addFloatingText(u.x, u.y, `+$${bounty}  +${techBounty}T`, "#ecc94b", 12);
        }

        units.splice(i, 1);
      }
    }

    // Process dead buildings
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (b.isDead) {
        this.particleSystem.addExplosion(b.x + b.w / 2, b.y + b.h / 2, "large");
        Sound.playExplosion("large");

        // Clear collision grid
        for (let bx = b.x; bx < b.x + b.w; bx++) {
          for (let by = b.y; by < b.y + b.h; by++) {
            this.map.setBlocked(bx, by, false);
          }
        }

        if (b.team === "enemy") {
          this.economy.addFunds(450);
          this.economy.addTech(120);
          this.hero.addXp(350, this.particleSystem);
          this.particleSystem.addFloatingText(b.x + b.w / 2, b.y + b.h / 2, "+$450 OUTPOST DESTROYED!", "#ecc94b", 16);
        }

        buildings.splice(i, 1);
      }
    }

    // Capturable Oil Derricks
    this.map.resourceNodes.forEach((node) => {
      if (node.type === "oil") {
        if (!node.captured) {
          // Check if allied units or hero are nearby
          const distToHero = Math.hypot(this.hero.x - node.x, this.hero.y - node.y);
          let captured = distToHero <= 3.0;

          if (!captured) {
            for (const u of units) {
              if (u.team === "player" && !u.isDead && Math.hypot(u.x - node.x, u.y - node.y) <= 2.5) {
                captured = true;
                break;
              }
            }
          }

          if (captured) {
            node.captured = true;
            Sound.playCashRegister();
            this.particleSystem.addFloatingText(node.x, node.y, "OIL DERRICK SECURED!", "#38ef7d", 15);
            this.economy.addFunds(200);
            this.hero.addXp(120, this.particleSystem);
          }
        }
      } else if (node.type === "crate" && !node.collected) {
        // Collect supply drops
        const distToHero = Math.hypot(this.hero.x - node.x, this.hero.y - node.y);
        let collected = distToHero <= 2.0;

        if (!collected) {
          for (const u of units) {
            if (u.team === "player" && !u.isDead && Math.hypot(u.x - node.x, u.y - node.y) <= 1.8) {
              collected = true;
              break;
            }
          }
        }

        if (collected) {
          node.collected = true;
          Sound.playCashRegister();
          this.economy.addFunds(node.funds);
          this.economy.addTech(node.tech);
          this.hero.addXp(80, this.particleSystem);
          this.particleSystem.addFloatingText(node.x, node.y, `+$${node.funds} +${node.tech} TECH`, "#ecc94b", 14);
        }
      }
    });
  }
}
