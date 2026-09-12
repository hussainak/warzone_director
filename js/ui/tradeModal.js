// js/ui/tradeModal.js - Tactical Military Trade Market Modal

import { Sound } from "../audio.js";

export class TradeModal {
  constructor(economy, hero, spawnUnitCallback) {
    this.economy = economy;
    this.hero = hero;
    this.spawnUnit = spawnUnitCallback;
    this.modalEl = document.getElementById("trade-modal");
    this.setupListeners();
  }

  setupListeners() {
    const closeBtn = document.getElementById("close-trade-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hide());
    }

    const buyTechBtn = document.getElementById("btn-buy-tech");
    if (buyTechBtn) {
      buyTechBtn.addEventListener("click", () => {
        const res = this.economy.buyTech(50);
        this.updateContent();
      });
    }

    const sellTechBtn = document.getElementById("btn-sell-tech");
    if (sellTechBtn) {
      sellTechBtn.addEventListener("click", () => {
        const res = this.economy.sellTech(50);
        this.updateContent();
      });
    }

    const buyMercsBtn = document.getElementById("btn-buy-mercs");
    if (buyMercsBtn) {
      buyMercsBtn.addEventListener("click", () => {
        const res = this.economy.buyMercenaries(this.spawnUnit, { x: this.hero.x, y: this.hero.y });
        this.updateContent();
      });
    }
  }

  show() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove("hidden");
    Sound.playRadioChirp();
    this.updateContent();
  }

  hide() {
    if (!this.modalEl) return;
    this.modalEl.classList.add("hidden");
    Sound.playRadioChirp();
  }

  toggle() {
    if (this.modalEl && this.modalEl.classList.contains("hidden")) {
      this.show();
    } else {
      this.hide();
    }
  }

  updateContent() {
    const cashEl = document.getElementById("trade-cash-display");
    const techEl = document.getElementById("trade-tech-display");
    if (cashEl) cashEl.textContent = `$${Math.floor(this.economy.funds)}`;
    if (techEl) techEl.textContent = `${Math.floor(this.economy.techSupplies)} T`;
  }
}
