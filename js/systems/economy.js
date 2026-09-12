// js/systems/economy.js - Funds ($), Tech Supplies, Power Grid, and Trade Market

import { STARTING_RESOURCES, TRADE_CONFIG } from "../config.js";
import { Sound } from "../audio.js";

export class EconomySystem {
  constructor() {
    this.funds = STARTING_RESOURCES.FUNDS;
    this.techSupplies = STARTING_RESOURCES.TECH_SUPPLIES;
    this.powerProduction = STARTING_RESOURCES.POWER_PRODUCTION;
    this.powerConsumption = STARTING_RESOURCES.POWER_CONSUMPTION;

    this.passiveIncomeAccumulator = 0;
    this.tradeRates = {
      buyTech: TRADE_CONFIG.BUY_TECH_RATE,
      sellTech: TRADE_CONFIG.SELL_TECH_RATE,
    };
  }

  addFunds(amount) {
    this.funds += amount;
  }

  deductFunds(amount) {
    if (this.funds >= amount) {
      this.funds -= amount;
      return true;
    }
    return false;
  }

  addTech(amount) {
    this.techSupplies += amount;
  }

  deductTech(amount) {
    if (this.techSupplies >= amount) {
      this.techSupplies -= amount;
      return true;
    }
    return false;
  }

  // Update power grid totals from active buildings
  updatePowerGrid(buildings) {
    let prod = STARTING_RESOURCES.POWER_PRODUCTION;
    let cons = STARTING_RESOURCES.POWER_CONSUMPTION;

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (b.isDead || b.team !== "player" || b.isConstructing) continue;
      if (b.power > 0) {
        prod += b.power;
      } else if (b.power < 0) {
        cons += Math.abs(b.power);
      }
    }

    this.powerProduction = prod;
    this.powerConsumption = cons;
  }

  get isPowerSurplus() {
    return this.powerProduction >= this.powerConsumption;
  }

  // Passive income from HQ, Trade Hubs, and captured oil derricks
  update(dt, buildings, capturedOilCount) {
    this.passiveIncomeAccumulator += dt;
    if (this.passiveIncomeAccumulator >= 1.0) {
      let income = 0;
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (b.isDead || b.team !== "player" || b.isConstructing) continue;
        income += b.passiveIncome;
      }

      // Each captured oil derrick gives +$18/s and +4 Tech/s
      income += capturedOilCount * 18;
      this.funds += income;
      this.techSupplies += capturedOilCount * 4;

      this.passiveIncomeAccumulator -= 1.0;
    }
  }

  // Buy 50 Tech Crates using cash
  buyTech(amount = 50) {
    const cost = Math.round(amount * this.tradeRates.buyTech);
    if (this.deductFunds(cost)) {
      this.addTech(amount);
      Sound.playCashRegister();
      return { success: true, cost, amount };
    }
    return { success: false, reason: "Insufficient Funds" };
  }

  // Sell 50 Tech Crates for cash
  sellTech(amount = 50) {
    if (this.deductTech(amount)) {
      const revenue = Math.round(amount * this.tradeRates.sellTech);
      this.addFunds(revenue);
      Sound.playCashRegister();
      return { success: true, revenue, amount };
    }
    return { success: false, reason: "Insufficient Tech Supplies" };
  }

  // Emergency Mercenary Airdrop: 3 Spec-Ops Soldiers deployed immediately
  buyMercenaries(spawnCallback, heroPos) {
    const cost = TRADE_CONFIG.MERCENARY_SQUAD_COST;
    if (this.deductFunds(cost)) {
      spawnCallback("rifleman", heroPos.x + 1.5, heroPos.y);
      spawnCallback("rifleman", heroPos.x - 1.5, heroPos.y);
      spawnCallback("sniper", heroPos.x, heroPos.y + 1.5);
      Sound.playCashRegister();
      return { success: true };
    }
    return { success: false, reason: "Insufficient Funds" };
  }
}
