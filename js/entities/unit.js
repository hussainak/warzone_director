// js/entities/unit.js - Realistic Modern Military Combat Units (Infantry, Armor, Gunships)

import { Entity } from "./entity.js";
import { UNITS_CONFIG, ENEMY_UNITS_CONFIG } from "../config.js";
import { Projectile } from "./projectile.js";
import { Sound } from "../audio.js";

export class Unit extends Entity {
  constructor(x, y, unitId, team = "player") {
    super(x, y, team);
    this.unitId = unitId;

    const conf = team === "player" ? UNITS_CONFIG[unitId] : (ENEMY_UNITS_CONFIG[unitId] || UNITS_CONFIG[unitId]);
    this.name = conf.name;
    this.category = conf.category || "infantry";
    this.isFlying = conf.isFlying || false;

    this.hp = conf.hp;
    this.maxHp = conf.maxHp;
    this.speed = conf.speed;
    this.range = conf.range;
    this.damage = conf.damage;
    this.attackRate = conf.attackRate;
    this.aoe = conf.aoe || 0;
    this.sightRadius = conf.sightRadius || 7;
    this.bounty = conf.bounty || 0;
    this.techBounty = conf.techBounty || 0;

    this.angle = 0;              // Movement orientation
    this.turretAngle = 0;        // Weapon / turret aim direction
    this.target = null;          // Target entity
    this.targetPosition = null;  // Move destination
    this.path = [];              // Waypoints from A*
    this.attackTimer = 0;
    this.rotorAngle = 0;         // Chopper rotor spin
    this.walkCycle = 0;          // Footstep stride cycle
    this.altitude = this.isFlying ? 28 : 0;

    // Enemy autonomous patrol wander
    this.patrolTimer = Math.random() * 8;
    this.homeBasePos = { x, y };
  }

  setMoveOrder(targetX, targetY, pathfinding) {
    this.target = null;
    this.targetPosition = { x: targetX, y: targetY };
    this.path = pathfinding.findPath(this.x, this.y, targetX, targetY, this.isFlying) || [];
  }

  setAttackOrder(targetEntity, pathfinding) {
    this.target = targetEntity;
    this.targetPosition = null;
    if (pathfinding) {
      this.path = pathfinding.findPath(this.x, this.y, targetEntity.x, targetEntity.y, this.isFlying) || [];
    }
  }

  update(dt, allEntities, pathfinding, particleSystem, projectiles, economy) {
    if (this.isDead) return;

    this.attackTimer -= dt;
    if (this.isFlying) {
      this.rotorAngle += dt * 32;
    }

    // --- Farmer / Civilian Worker Autonomous Behavior (Age of Empires style) ---
    if (this.unitId === "worker") {
      this.farmTimer = (this.farmTimer || 0) + dt;
      if (this.farmTimer >= 3.8) {
        this.farmTimer = 0;
        // Check if near an agricultural farm
        const nearbyFarm = allEntities.find(
          (e) => e.buildingType === "farm" && e.team === this.team && Math.hypot(e.x + 1 - this.x, e.y + 1 - this.y) <= 4.2
        );
        if (nearbyFarm) {
          if (economy) economy.funds += 18;
          particleSystem.addFloatingText(this.x, this.y, "+🌾 $18 HARVEST", "#ecc94b", 12);
          Sound.playCoins();
        }
      }

      // Check if near a damaged allied building to actively repair
      this.repairTimer = (this.repairTimer || 0) + dt;
      if (this.repairTimer >= 1.0) {
        this.repairTimer = 0;
        const damagedBldg = allEntities.find(
          (e) => e.w && e.team === this.team && e.hp < e.maxHp && !e.isDead && Math.hypot(e.x + e.w / 2 - this.x, e.y + e.h / 2 - this.y) <= 3.2
        );
        if (damagedBldg) {
          damagedBldg.heal(30);
          particleSystem.addFloatingText(damagedBldg.x + damagedBldg.w / 2, damagedBldg.y, "+🔨 REPAIR", "#38ef7d", 11);
        }
      }
    }

    // Auto-acquire closest hostile target if idle (farmers only defend if attacked)
    if (!this.target || this.target.isDead) {
      this.target = null;
      if (this.unitId !== "worker") {
        this.findAutoTarget(allEntities);
      }
    }

    // Enemy autonomous idle patrol wander around home base
    if (this.team === "enemy" && !this.target && this.path.length === 0) {
      this.patrolTimer += dt;
      if (this.patrolTimer >= 14 + Math.random() * 10) {
        this.patrolTimer = 0;
        const wanderX = Math.max(2, Math.min(68, this.homeBasePos.x + (Math.random() * 8 - 4)));
        const wanderY = Math.max(2, Math.min(68, this.homeBasePos.y + (Math.random() * 8 - 4)));
        this.setMoveOrder(wanderX, wanderY, pathfinding);
      }
    }

    // Combat behavior
    if (this.target && !this.target.isDead) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      this.turretAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

      if (dist <= this.range) {
        this.path = [];
        if (this.attackTimer <= 0) {
          this.fireWeapon(this.target, particleSystem, projectiles);
          this.attackTimer = this.attackRate;
        }
      } else {
        if (this.path.length === 0) {
          this.path = pathfinding.findPath(this.x, this.y, this.target.x, this.target.y, this.isFlying) || [];
        }
      }
    }

    // Movement along waypoints with animated walk strides
    if (this.path.length > 0) {
      this.walkCycle += dt * 14;
      const nextWp = this.path[0];
      const dx = nextWp.x - this.x;
      const dy = nextWp.y - this.y;
      const distToWp = Math.hypot(dx, dy);

      this.angle = Math.atan2(dy, dx);
      if (!this.target) this.turretAngle = this.angle;

      const moveDist = this.speed * dt;
      if (distToWp <= moveDist) {
        this.x = nextWp.x;
        this.y = nextWp.y;
        this.path.shift();
      } else {
        this.x += (dx / distToWp) * moveDist;
        this.y += (dy / distToWp) * moveDist;
      }
    } else {
      this.walkCycle = 0;
    }
  }

  findAutoTarget(allEntities) {
    let bestTarget = null;
    let closestDist = this.sightRadius;

    for (let i = 0; i < allEntities.length; i++) {
      const e = allEntities[i];
      if (e.isDead || e.team === this.team) continue;
      const dist = Math.hypot(e.x - this.x, e.y - this.y);
      if (dist < closestDist) {
        closestDist = dist;
        bestTarget = e;
      }
    }

    if (bestTarget) {
      this.target = bestTarget;
    }
  }

  fireWeapon(target, particleSystem, projectiles) {
    particleSystem.addMuzzleFlash(this.x, this.y, this.turretAngle);

    if (this.unitId === "tank" || this.unitId === "enemy_tank") {
      Sound.playGunshot("cannon");
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "cannon",
          speed: 16,
          damage: this.damage,
          aoe: this.aoe,
          team: this.team,
          attacker: this,
        })
      );
    } else if (this.unitId === "artillery") {
      Sound.playRocketLaunch();
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          type: "artillery",
          speed: 7,
          damage: this.damage,
          aoe: this.aoe,
          team: this.team,
          attacker: this,
        })
      );
    } else if (this.unitId === "rpg" || this.unitId === "enemy_rpg") {
      Sound.playRocketLaunch();
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "rocket",
          speed: 9,
          damage: this.damage,
          aoe: this.aoe,
          team: this.team,
          attacker: this,
        })
      );
    } else if (this.unitId === "sniper") {
      Sound.playGunshot("sniper");
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "sniper",
          speed: 24,
          damage: this.damage,
          team: this.team,
          attacker: this,
        })
      );
    } else {
      Sound.playGunshot("rifle");
      projectiles.push(
        new Projectile({
          startX: this.x,
          startY: this.y,
          targetX: target.x,
          targetY: target.y,
          targetEntity: target,
          type: "bullet",
          speed: 16,
          damage: this.damage,
          team: this.team,
          attacker: this,
        })
      );
    }
  }

  onDeath(attacker) {}

  render(ctx, camera) {
    if (this.isDead) return;

    const { x: sx, y: sy } = camera.tileToScreen(this.x, this.y);
    const renderY = sy - this.altitude;

    ctx.save();
    ctx.translate(sx, renderY);

    // Tactical selection circle
    if (this.isSelected) {
      ctx.strokeStyle = this.team === "player" ? "#00f0ff" : "#ff3333";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 4, 16, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Directional ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(3, this.altitude + 2, 11, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    const isAllied = this.team === "player";
    const aimAngle = this.turretAngle;

    // =========================================================================
    // 1. ULTRA-REALISTIC MODERN MILITARY INFANTRY
    // =========================================================================
    if (this.category === "infantry" || this.unitId === "worker") {
      const stride = Math.sin(this.walkCycle) * 3.8;
      const bobY = Math.abs(Math.cos(this.walkCycle)) * 1.2;
      const isSniper = this.unitId === "sniper";
      const isRpg = this.unitId === "rpg" || this.unitId === "enemy_rpg";
      const isMilitia = this.unitId === "enemy_militia" || this.unitId === "enemy_scout";
      const isFarmer = this.unitId === "worker";

      // Tactical Camouflage & Civilian Attire Palette
      const pantsColor = isFarmer
        ? "#254470" // Denim blue work overalls
        : (isAllied
          ? (isSniper ? "#3c4f36" : "#364e3b") // Allied Woodland / Multicam
          : (isMilitia ? "#7c684d" : "#242831")); // Insurgent Tan vs Syndicate Urban

      const vestColor = isAllied
        ? (isSniper ? "#2d422e" : "#283f30") // MOLLE plate carrier
        : (isMilitia ? "#5c432d" : "#191d26");

      const helmetColor = isAllied
        ? "#3e5744" // FAST Ballistic Helmet
        : (isMilitia ? "#c29b68" : "#1a1e27");

      // --- A. ARTICULATED LEGS & BOOTS ---
      ctx.save();
      // Left Leg
      ctx.fillStyle = pantsColor;
      ctx.fillRect(-3.2 + stride, -5 - bobY, 2.8, 6.5);
      if (!isFarmer) {
        // Tactical Knee Pad
        ctx.fillStyle = "#161b22";
        ctx.fillRect(-3.2 + stride, -2.5 - bobY, 2.8, 2.0);
      }
      // Boot (Brown leather for farmers, black combat boot for soldiers)
      ctx.fillStyle = isFarmer ? "#5c3818" : "#111418";
      ctx.fillRect(-3.6 + stride, 1.2 - bobY, 3.6, 3.2);

      // Right Leg
      ctx.fillStyle = pantsColor;
      ctx.fillRect(0.8 - stride, -5 - bobY, 2.8, 6.5);
      if (!isFarmer) {
        // Tactical Knee Pad
        ctx.fillStyle = "#161b22";
        ctx.fillRect(0.8 - stride, -2.5 - bobY, 2.8, 2.0);
      }
      // Boot
      ctx.fillStyle = isFarmer ? "#5c3818" : "#111418";
      ctx.fillRect(0.4 - stride, 1.2 - bobY, 3.6, 3.2);
      ctx.restore();

      // --- B. BACKPACK & SPARE ORDNANCE ---
      if (isRpg) {
        // Heavy Backpack with 2x protruding spare PG-7VL Rocket Warheads!
        ctx.fillStyle = "#1e281e";
        ctx.fillRect(-4.5, -14 - bobY, 9, 7);
        // Left Rocket Warhead sticking out
        ctx.fillStyle = "#3d5733"; // Green warhead body
        ctx.fillRect(-4.5, -19 - bobY, 2.5, 5);
        ctx.fillStyle = "#d4a337"; // Brass detonator tip
        ctx.fillRect(-4.5, -20.5 - bobY, 2.5, 1.5);
        // Right Rocket Warhead sticking out
        ctx.fillStyle = "#3d5733";
        ctx.fillRect(2.0, -19 - bobY, 2.5, 5);
        ctx.fillStyle = "#d4a337";
        ctx.fillRect(2.0, -20.5 - bobY, 2.5, 1.5);
      } else if (isSniper) {
        // Ghillie foliage scrim netting over shoulders/back
        ctx.fillStyle = "#4a6336";
        ctx.beginPath();
        ctx.ellipse(0, -11 - bobY, 6.5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5c5737";
        ctx.fillRect(-5, -12 - bobY, 3, 4);
        ctx.fillRect(2, -12 - bobY, 3, 4);
      }

      // --- C. TORSO: FLANNEL / OVERALLS / PLATE CARRIER ---
      if (isFarmer) {
        // Red Flannel Shirt with Denim Overalls Bib
        ctx.fillStyle = "#b91c1c"; // Flannel red
        ctx.beginPath();
        ctx.roundRect(-4.8, -13.5 - bobY, 9.6, 9.5, 2);
        ctx.fill();
        // Denim bib overalls
        ctx.fillStyle = "#254470";
        ctx.fillRect(-3.6, -10.5 - bobY, 7.2, 6.5);
        // Brass overall strap buckles
        ctx.fillStyle = "#ecc94b";
        ctx.fillRect(-3.2, -10.8 - bobY, 1.8, 1.4);
        ctx.fillRect(1.4, -10.8 - bobY, 1.8, 1.4);
      } else {
        // Combat Plate Carrier / Chest Rig
        ctx.fillStyle = vestColor;
        ctx.beginPath();
        ctx.roundRect(-4.8, -13.5 - bobY, 9.6, 9.5, 2);
        ctx.fill();

        // MOLLE Straps & Mag Pouches
        ctx.fillStyle = "#121814";
        ctx.fillRect(-3.8, -10.5 - bobY, 7.6, 3.4);
        ctx.fillStyle = isAllied ? "#2d4536" : "#4a3525";
        ctx.fillRect(-3.2, -10 - bobY, 2, 2.5); // Mag 1
        ctx.fillRect(-0.8, -10 - bobY, 2, 2.5); // Mag 2
        ctx.fillRect(1.6, -10 - bobY, 2, 2.5);  // Mag 3

        // Tactical Shoulder Radio Antenna
        if (!isMilitia) {
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-4, -13 - bobY);
          ctx.lineTo(-5.5, -20 - bobY);
          ctx.stroke();
        }
      }

      // --- D. HEADGEAR: STRAW HAT / FAST HELMET / SHEMAGH / BOONIE ---
      if (isFarmer) {
        // Wide-Brim Straw Farmer Sunhat
        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.ellipse(0, -17.5 - bobY, 6.4, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f59e0b"; // Crown
        ctx.beginPath();
        ctx.arc(0, -19.0 - bobY, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#78350f"; // Hat band
        ctx.fillRect(-3.5, -18.0 - bobY, 7, 1.2);
      } else if (isMilitia) {
        // Desert Keffiyeh / Shemagh Wrap
        ctx.fillStyle = helmetColor;
        ctx.beginPath();
        ctx.arc(0, -17.5 - bobY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        // Scarf fringe & eye slit
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(-3, -18.5 - bobY, 6, 1.8);
        ctx.fillStyle = "#111"; // Eyes
        ctx.fillRect(-2, -18 - bobY, 4, 1.0);
      } else if (isSniper) {
        // Sniper Boonie Hat with foliage
        ctx.fillStyle = "#3d4f33";
        ctx.beginPath();
        ctx.ellipse(0, -17.5 - bobY, 5.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#546644";
        ctx.beginPath();
        ctx.arc(0, -18.5 - bobY, 3.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Ops-Core FAST Ballistic High-Cut Helmet
        ctx.fillStyle = helmetColor;
        ctx.beginPath();
        ctx.arc(0, -17.5 - bobY, 4.4, 0, Math.PI * 2);
        ctx.fill();

        // Ear Protection / Comms Headset
        ctx.fillStyle = "#111418";
        ctx.fillRect(-5.2, -18.5 - bobY, 1.5, 2.8);
        ctx.fillRect(3.7, -18.5 - bobY, 1.5, 2.8);

        // NVG Shroud & Night Vision Goggles / Visor
        ctx.fillStyle = isAllied ? "#00f0ff" : "#ff3333";
        ctx.fillRect(-2.2, -19.2 - bobY, 4.4, 1.8);
      }

      // --- E. ARMS & TOOL / WEAPON ---
      ctx.save();
      ctx.translate(0, -10 - bobY);
      ctx.rotate(aimAngle);

      // Arms (flannel for farmer, camouflage for soldiers)
      ctx.fillStyle = isFarmer ? "#b91c1c" : pantsColor;
      ctx.fillRect(0, -3.2, 6.5, 2.4); // Right arm
      ctx.fillRect(0, 1.2, 5.5, 2.4);  // Left arm

      // Distinctive Realistic Weapon Models
      if (isFarmer) {
        // --- AGRICULTURAL FARMING PITCHFORK / HOE ---
        ctx.fillStyle = "#92400e"; // Ash wooden tool handle
        ctx.fillRect(-2, -1.2, 16, 2.2);
        // Steel Pitchfork Head / Hoe Blade
        ctx.fillStyle = "#cbd5e0";
        ctx.fillRect(13, -4.5, 2.4, 9.0); // Crossbar
        ctx.fillRect(15, -4.5, 4.0, 1.8); // Top prong
        ctx.fillRect(15, -0.9, 4.0, 1.8); // Middle prong
        ctx.fillRect(15, 2.7, 4.0, 1.8);  // Bottom prong
      } else if (isSniper) {
        // --- BARRETT M82 / M107 .50 CAL ANTI-MATERIEL RIFLE ---
        ctx.fillStyle = "#141920";
        ctx.fillRect(2, -1.8, 16, 2.4); // Heavy fluted receiver & barrel
        // Iconic Triangular Dual-Baffle Arrowhead Muzzle Brake
        ctx.fillStyle = "#252d38";
        ctx.beginPath();
        ctx.moveTo(18, -2.8);
        ctx.lineTo(21.5, -0.6);
        ctx.lineTo(18, 1.6);
        ctx.closePath();
        ctx.fill();
        // High-Magnification Sniper Scope
        ctx.fillStyle = "#2a3442";
        ctx.fillRect(4, -4.0, 7, 2.2);
        ctx.fillStyle = "#00f0ff"; // Lens glare
        ctx.fillRect(10, -3.7, 1.2, 1.6);
        // Folded Harris Bipod
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(12, 0.5);
        ctx.lineTo(14, 2.5);
        ctx.stroke();
        // 10-Round Detachable Box Mag
        ctx.fillStyle = "#1e2530";
        ctx.fillRect(4, 0.6, 3, 3);
      } else if (isRpg) {
        // --- SHOULDER-FIRED RPG-7 ROCKET LAUNCHER ---
        // Olive Tube & Rear Venturi Nozzle
        ctx.fillStyle = "#2f422e";
        ctx.fillRect(-5, -4.8, 18, 3.4);
        ctx.fillStyle = "#1a2419"; // Venturi exhaust cone
        ctx.fillRect(-7, -5.2, 2.2, 4.2);
        // Wooden Composite Heat Shield Wrap
        ctx.fillStyle = "#8a4d29";
        ctx.fillRect(0, -5.0, 6, 3.8);
        // PGO-7 Optical Sight on side
        ctx.fillStyle = "#1a1e24";
        ctx.fillRect(2, -6.8, 3, 2.0);
        // PG-7VL High-Explosive Anti-Tank Warhead Cone
        ctx.fillStyle = "#3e5c3a"; // Warhead Flare
        ctx.beginPath();
        ctx.moveTo(13, -5.8);
        ctx.lineTo(18, -3.1);
        ctx.lineTo(13, -0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#d4a337"; // Brass detonator nose fuse
        ctx.fillRect(18, -3.6, 2.2, 1.0);
      } else if (isMilitia) {
        // --- AK-47 / AKM ASSAULT RIFLE ---
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(2, -1.8, 10, 2.2); // Stamped steel receiver & barrel
        // Wooden Stock & Handguard
        ctx.fillStyle = "#9c522b";
        ctx.fillRect(-2, -1.4, 4, 2.0); // Stock
        ctx.fillRect(4, -2.2, 4, 2.8);  // Handguard
        // Curved Orange Banana Magazine
        ctx.fillStyle = "#b45309";
        ctx.fillRect(3.5, 0.4, 2.5, 3.5);
        // Hooded Front Sight
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(11, -3.0, 1.5, 1.5);
      } else {
        // --- M4A1 SOPMOD ASSAULT CARBINE ---
        ctx.fillStyle = "#141920";
        ctx.fillRect(2, -1.8, 11, 2.4); // Receiver & barrel
        // Crane Retractable Buttstock
        ctx.fillStyle = "#27313f";
        ctx.fillRect(-1.5, -1.4, 3.5, 2.2);
        // EOTech Holographic Optic Sight
        ctx.fillStyle = "#475569";
        ctx.fillRect(4, -3.8, 3.5, 2.0);
        ctx.fillStyle = "#ff3333"; // Reticle
        ctx.fillRect(6, -3.2, 1.0, 1.0);
        // Vertical Foregrip
        ctx.fillStyle = "#141920";
        ctx.fillRect(9, 0.4, 1.8, 2.5);
        // Curved 30-Round Magazine
        ctx.fillStyle = "#283445";
        ctx.fillRect(4, 0.5, 2.2, 3.2);
        // Suppressor / Flash Hider
        ctx.fillStyle = "#334155";
        ctx.fillRect(13, -2.2, 3.5, 2.8);
        // Subtle Tactical Laser Aiming Beam
        ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16.5, -0.6);
        ctx.lineTo(34, -0.6);
        ctx.stroke();
      }

      ctx.restore();
    }

    // =========================================================================
    // 2. REALISTIC ABRAMS / SHADOW MAIN BATTLE TANK
    // =========================================================================
    else if (this.unitId === "tank" || this.unitId === "enemy_tank") {
      ctx.save();
      ctx.rotate(this.angle * 0.38);

      const hullColor = isAllied ? "#385e4a" : "#522424";
      const skirtColor = isAllied ? "#2b4c3b" : "#3d1818";
      const turretColor = isAllied ? "#44735a" : "#692929";

      // Caterpillar Tracks on Left and Right
      ctx.fillStyle = "#12161c";
      ctx.fillRect(-16, -10.5, 32, 5.0);
      ctx.fillRect(-16, 5.5, 32, 5.0);

      // 6 Pairs of Steel Roadwheels inside each track
      ctx.fillStyle = "#2d3748";
      for (let w = -12; w <= 12; w += 4.8) {
        ctx.beginPath();
        ctx.arc(w, -8.0, 1.8, 0, Math.PI * 2);
        ctx.arc(w, 8.0, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Heavy Side-Skirt Armor with Modular ERA Tiles
      ctx.fillStyle = skirtColor;
      ctx.fillRect(-15, -9.5, 30, 2.8);
      ctx.fillRect(-15, 6.7, 30, 2.8);
      // ERA Block Seams
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
      ctx.lineWidth = 1;
      for (let b = -12; b <= 12; b += 5) {
        ctx.beginPath();
        ctx.moveTo(b, -9.5);
        ctx.lineTo(b, -6.7);
        ctx.moveTo(b, 6.7);
        ctx.lineTo(b, 9.5);
        ctx.stroke();
      }

      // Armored Chassis with Slanted Glacis Plate
      ctx.fillStyle = hullColor;
      ctx.beginPath();
      ctx.roundRect(-13, -7, 26, 14, 2);
      ctx.fill();

      // Rear Engine Deck & Louvers
      ctx.fillStyle = "#161b22";
      ctx.fillRect(-12, -4.5, 4, 9);

      // Front Headlights & Driver Periscopes
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(12, -5, 1.5, 1.8);
      ctx.fillRect(12, 3.2, 1.5, 1.8);

      // Rotating Angular Chobham Armor Turret
      ctx.rotate(aimAngle - this.angle * 0.38);
      ctx.fillStyle = turretColor;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(8, -5);
      ctx.lineTo(10, 0);
      ctx.lineTo(8, 5);
      ctx.lineTo(-8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Rear Bustle Rack (Stowage Basket)
      ctx.fillStyle = "#1a222d";
      ctx.fillRect(-11, -4.5, 3.5, 9);

      // Dual 6-Tube Smoke Grenade Launchers
      ctx.fillStyle = "#2d3748";
      ctx.fillRect(1, -7.2, 4, 1.8);
      ctx.fillRect(1, 5.4, 4, 1.8);

      // Commander Cupola & Pintle-Mounted .50 Cal M2 Machine Gun
      ctx.fillStyle = "#111418";
      ctx.beginPath();
      ctx.arc(-2, -2.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
      // .50 Cal Gun Barrel & Ammo Can
      ctx.strokeStyle = "#cbd5e0";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-2, -2.5);
      ctx.lineTo(6, -2.5);
      ctx.stroke();
      ctx.fillStyle = "#4a5568";
      ctx.fillRect(0, -4.2, 2.2, 1.8); // Ammo can

      // 120mm Smoothbore Main Cannon with Central Bore Evacuator
      ctx.fillStyle = "#141920";
      ctx.fillRect(7, -1.8, 16, 3.6); // Main Gun Barrel
      // Bore Evacuator Cylinder
      ctx.fillStyle = "#475569";
      ctx.fillRect(13, -2.6, 4.5, 5.2);
      // Muzzle Reference Sensor Collimator
      ctx.fillStyle = "#141920";
      ctx.fillRect(22, -2.2, 2.5, 4.4);

      ctx.restore();
    }

    // =========================================================================
    // 3. REALISTIC FAST ATTACK BUGGY / ARMORED TECHNICAL
    // =========================================================================
    else if (this.unitId === "buggy" || this.unitId === "enemy_technical") {
      ctx.save();
      ctx.rotate(this.angle * 0.4);

      const bodyColor = isAllied ? "#2b6cb0" : "#7b2424";

      // 4 Oversized Knobby Off-Road Rubber Tires
      ctx.fillStyle = "#11161d";
      ctx.fillRect(-14, -9.0, 7.5, 4.0);
      ctx.fillRect(7.5, -9.0, 7.5, 4.0);
      ctx.fillRect(-14, 5.0, 7.5, 4.0);
      ctx.fillRect(7.5, 5.0, 7.5, 4.0);

      // Aluminum Wheel Hubs
      ctx.fillStyle = "#718096";
      ctx.fillRect(-11, -8.0, 2.5, 2.0);
      ctx.fillRect(10, -8.0, 2.5, 2.0);
      ctx.fillRect(-11, 6.0, 2.5, 2.0);
      ctx.fillRect(10, 6.0, 2.5, 2.0);

      // Tubular Roll-Cage & Chassis
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-10, -5.5, 20, 11);

      // Front Bull-Bar Brush Guard & Winch
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.8;
      ctx.strokeRect(-9, -4.5, 18, 9);
      ctx.beginPath();
      ctx.moveTo(10, -4);
      ctx.lineTo(14, 0);
      ctx.lineTo(10, 4);
      ctx.stroke();

      // Rear Strapped Spare Wheel & Red Fuel Cans
      ctx.fillStyle = "#11161d";
      ctx.beginPath();
      ctx.arc(-8, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e53e3e"; // Fuel jerry can
      ctx.fillRect(-6, -4, 2, 2.5);

      // Rotating Pintle Turret with Mounted Heavy Weapon
      ctx.rotate(aimAngle - this.angle * 0.4);
      ctx.fillStyle = "#161b22";
      ctx.fillRect(-3, -2.5, 6, 5);
      // Twin Gun Barrels
      ctx.strokeStyle = "#ecc94b";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(2, -1.2);
      ctx.lineTo(13, -1.2);
      ctx.moveTo(2, 1.2);
      ctx.lineTo(13, 1.2);
      ctx.stroke();

      ctx.restore();
    }

    // =========================================================================
    // 4. REALISTIC AH-64 APACHE ATTACK GUNSHIP
    // =========================================================================
    else if (this.category === "air") {
      ctx.save();
      ctx.rotate(this.angle * 0.32);

      const camoFuse = isAllied ? "#234e52" : "#5c2424";

      // Rotor Wash Downward Shadow & Disc Blur
      ctx.strokeStyle = "rgba(180, 220, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Streamlined Attack Helicopter Fuselage
      ctx.fillStyle = camoFuse;
      ctx.beginPath();
      ctx.ellipse(3, 0, 16, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stepped Tandem Cockpit Glass (Pilot & Gunner)
      ctx.fillStyle = "#00f0ff";
      ctx.beginPath();
      ctx.roundRect(5, -2.5, 8, 5, 2);
      ctx.fill();

      // Twin Turbine Engine Nacelles on Flanks
      ctx.fillStyle = "#1a232f";
      ctx.fillRect(-2, -7.5, 8, 3);
      ctx.fillRect(-2, 4.5, 8, 3);

      // Stub Weapon Wings
      ctx.fillStyle = "#11161d";
      ctx.fillRect(-1, -10, 4, 20);

      // AGM-114 Hellfire Missiles & Hydra 70 Rocket Pods
      ctx.fillStyle = "#cbd5e0";
      ctx.fillRect(3, -9.5, 4, 1.8);
      ctx.fillRect(3, 7.7, 4, 1.8);
      ctx.fillStyle = "#ecc94b"; // Rocket tips
      ctx.fillRect(2, -6.5, 3.5, 2.5);
      ctx.fillRect(2, 4.0, 3.5, 2.5);

      // Tail Boom, Horizontal Stabilator, and Tail Rotor
      ctx.fillStyle = camoFuse;
      ctx.fillRect(-19, -1.8, 16, 3.6);
      ctx.fillStyle = "#1a232f";
      ctx.fillRect(-16, -6, 2.5, 12); // Stabilator
      ctx.fillRect(-21, -5.5, 3, 7);   // Vertical fin

      // Spinning Tail Rotor
      ctx.strokeStyle = "rgba(220, 240, 255, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const trOffset = Math.sin(this.rotorAngle * 2) * 5;
      ctx.moveTo(-20, -trOffset);
      ctx.lineTo(-20, trOffset);
      ctx.stroke();

      // Nose-Mounted 30mm M230 Chain Gun & TADS Sensor Ball
      ctx.fillStyle = "#111418";
      ctx.beginPath();
      ctx.arc(15, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#718096";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(21, 0);
      ctx.stroke();

      // Spinning 4-Blade Main Rotor
      ctx.strokeStyle = "rgba(230, 245, 255, 0.85)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const rCos = Math.cos(this.rotorAngle) * 26;
      const rSin = Math.sin(this.rotorAngle) * 8.5;
      ctx.moveTo(-rCos, -rSin);
      ctx.lineTo(rCos, rSin);
      ctx.moveTo(-rSin, rCos * 0.33);
      ctx.lineTo(rSin, -rCos * 0.33);
      ctx.stroke();

      // Main Rotor Mast Center Hub
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // =========================================================================
    // 5. MOBILE MLRS ARTILLERY
    // =========================================================================
    else {
      ctx.save();
      ctx.rotate(this.angle * 0.35);

      const chassisColor = isAllied ? "#2b5278" : "#632727";

      // 8x8 Heavy Wheeled Chassis (4 wheels per side)
      ctx.fillStyle = "#11161d";
      for (let x = -12; x <= 12; x += 8) {
        ctx.fillRect(x - 3, -9.5, 6, 3.5);
        ctx.fillRect(x - 3, 6.0, 6, 3.5);
      }

      // Armored Cabin & Chassis
      ctx.fillStyle = chassisColor;
      ctx.beginPath();
      ctx.roundRect(-14, -6.5, 28, 13, 2);
      ctx.fill();

      // Front Armored Cab Windows
      ctx.fillStyle = "#00f0ff";
      ctx.fillRect(9, -4.5, 3.5, 9);

      // Elevated Multi-Tube Rocket Box Launcher (Rotates to Aim Angle)
      ctx.rotate(aimAngle - this.angle * 0.35);
      ctx.fillStyle = "#161b22";
      ctx.beginPath();
      ctx.roundRect(-8, -5, 16, 10, 2);
      ctx.fill();

      // 12 Rocket Tubes Grid
      ctx.fillStyle = "#e53e3e";
      for (let ry = -3.2; ry <= 3.2; ry += 2.2) {
        for (let rx = 5; rx <= 7; rx += 2) {
          ctx.fillRect(rx, ry, 1.4, 1.4);
        }
      }

      ctx.restore();
    }

    ctx.restore();

    // Render Health Bar
    this.renderHealthBar(ctx, sx, renderY, this.category === "air" ? -28 : -22, 26, 3.5);
  }
}
