'use strict';

import { Entity } from './entity.js';
import { distanceSq, simpleCollisionCheck } from './utils.js';
// 注意： Player 的 attack 方法會調用 game.addArrow, game.addBullet, game.addSlashEffect 等
// 這些方法需要在 Game 類中定義，Player 類只需要調用它們

// --- 玩家類 ---
export class Player extends Entity {
    constructor(x, y, width, height, gameConstants) {
        super(x, y, width, height, 'blue');
        this.constants = gameConstants; // 儲存常量引用

        // --- 等級與經驗初始化 ---
        this.level = this.constants.PLAYER_INITIAL_LEVEL;
        this.xp = this.constants.PLAYER_INITIAL_XP;
        this.xpToNextLevel = this.calculateXpToNextLevel(this.level);
        this.baseMaxHp = this.constants.PLAYER_HP_BASE; // 儲存基礎 HP
        this.maxHp = this.calculateMaxHp(); // 計算初始 MaxHP
        this.hp = this.maxHp; // 初始血量設為最大值
        this.skillPoints = 1; // 初始技能點數

        this.wood = 0;
        this.diamond = 0;
        this.gold = 250; // 初始金幣
        this.attackTimer = 0;

        // --- 武器系統狀態 ---
        this.cleaverLevel = 1;       // 菜刀等級
        this.bowLevel = 0;           // 弓箭等級
        this.bowUnlocked = false;    // 弓箭是否解鎖
        this.finalCleaverDamage = 0; // 滿級菜刀傷害
        this.finalCleaverCooldown = 0;// 滿級菜刀冷卻
        this.finalBowDamage = 0;
        this.finalBowCooldown = 0;
        this.finalBowRange = 0;      // 確保添加了滿級射程
        this.gunLevel = 0;           // 槍械等級
        this.gunUnlocked = false;    // 槍械是否解鎖

        // --- 基礎屬性 (會被 updateWeaponStats 覆蓋) ---
        this.attackDamage = 0;
        this.attackCooldown = 0;
        this.attackRange = 0;

        // --- 治療冷卻計時器 ---
        this.healingCooldown = 0; // 初始為 0，可以立即治療
        // --- 武器升級冷卻計時器 ---
        this.weaponUpgradeCooldown = 0;

        this.image = new Image();
        this.imageLoaded = false;
        this.loadImage(this.constants.PLAYER_IMAGE_DATA_URL);

        // --- 玩家狀態 ---
        this.facingRight = true; // 初始朝向右
        this.isMoving = false;   // 初始靜止
        this.bobbingTimer = 0;   // 跳動效果計時器

        // --- 衝刺狀態 ---
        this.isDashing = false;         // 是否正在衝刺
        this.dashTimer = 0;             // 衝刺剩餘時間
        this.dashCooldownTimer = 0;     // 衝刺冷卻剩餘時間
        this.dashDirection = { dx: 0, dy: 0 }; // 衝刺方向
        this.isInvincible = false;      // 是否無敵 (衝刺期間)
        this.invincibilityTimer = 0;    // 無敵剩餘時間

        // --- 初始化武器屬性 ---
        this.updateWeaponStats(); // 根據初始武器等級計算屬性

        // --- 自動技能冷卻計時器 ---
        this.skillAoe1CooldownTimer = 0;
        this.skillAoe2CooldownTimer = 0;
        this.skillLinear1CooldownTimer = 0;
        this.skillLinear2CooldownTimer = 0;

        // --- 自動技能等級 ---
        this.skillAoe1Level = 0; // 震盪波等級
        this.skillAoe2Level = 0; // 新星爆發等級
        this.skillLinear1Level = 0; // 能量箭等級
        this.skillLinear2Level = 0; // 能量光束等級

        // --- 閃避屬性 ---
        this.dodgeChance = 0; // 初始閃避機率為 0

        // --- 商店升級等級 ---
        this.armorLevel = 0; // 防具店提供的生命加成等級
        this.danceLevel = 0; // 舞蹈室提供的閃避加成等級
        this.hasMetGoalCharacter = false; // 是否已觸碰目標角色

        // --- 重新計算初始屬性 ---
        this.recalculateStats(); // 包含 HP 和閃避

        // --- 獎杯攜帶狀態 ---
        this.carryingTrophy = false; // 是否正在攜帶獎杯
        this.trophyReference = null; // 對攜帶的獎杯物件的引用
    }

    // --- 重新計算所有基於等級的屬性 ---
    recalculateStats() {
        this.maxHp = this.calculateMaxHp();
        // 確保當前 HP 不超過新的 maxHp
        this.hp = Math.min(this.hp, this.maxHp);
        this.dodgeChance = this.calculateDodgeChance();
        this.updateWeaponStats(); // 武器屬性也可能受等級影響
        // console.log(`Stats Recalculated: MaxHP=${this.maxHp}, Dodge=${(this.dodgeChance * 100).toFixed(1)}%`);
    }

    // --- 計算來自防具店的 HP 加成 ---
    calculateArmorHpBonus() {
        if (this.armorLevel <= 0) return 0;
        const constants = this.constants;
        let totalBonus = 0;
        // 累加每級的遞增獎勵
        for (let i = 1; i <= this.armorLevel; i++) {
            totalBonus += constants.ARMOR_SHOP_BASE_HP_BONUS + (i - 1) * constants.ARMOR_SHOP_HP_BONUS_INCREMENT;
        }
        return totalBonus;
        // 或者直接計算總和公式:
        // return this.armorLevel * constants.ARMOR_SHOP_BASE_HP_BONUS +
        //        constants.ARMOR_SHOP_HP_BONUS_INCREMENT * this.armorLevel * (this.armorLevel - 1) / 2;

    }

    // --- 計算來自舞蹈室的閃避加成 ---
    calculateDanceDodgeBonus() {
        if (this.danceLevel <= 0) return 0;
        const constants = this.constants;
        // 從預計算的數組中獲取總加成
        // 確保等級不超過數組範圍
        const levelIndex = Math.min(this.danceLevel, constants.DANCE_STUDIO_DODGE_BONUS_PER_LEVEL.length - 1);
        return constants.DANCE_STUDIO_DODGE_BONUS_PER_LEVEL[levelIndex];
    }

    // --- 計算總閃避機率 ---
    calculateDodgeChance() {
        const baseDodge = this.constants.PLAYER_BASE_DODGE_CHANCE || 0; // 獲取基礎閃避 (如果定義了)
        const danceBonus = this.calculateDanceDodgeBonus();
        // 閃避率疊加，但不超過某個硬上限 (例如 90%)
        return Math.min(0.9, baseDodge + danceBonus);
    }

    // --- 計算下一級所需經驗 ---
    calculateXpToNextLevel(level) {
        return Math.floor(this.constants.PLAYER_XP_BASE_REQ * Math.pow(this.constants.PLAYER_XP_LEVEL_MULTIPLIER, level - 1));
    }

    // --- 計算當前等級的最大 HP (包含等級和防具店加成) ---
    calculateMaxHp() {
        const levelHpBonus = (this.level - 1) * this.constants.PLAYER_HP_GAIN_PER_LEVEL;
        const armorHpBonus = this.calculateArmorHpBonus();
        return this.constants.PLAYER_HP_BASE + levelHpBonus + armorHpBonus;
    }

    // --- 處理經驗獲取 ---
    gainXp(amount, game) { // 需要 game 來顯示消息
        if (!this.active) return;

        this.xp += amount;
        while (this.xp >= this.xpToNextLevel) {
            const remainingXp = this.xp - this.xpToNextLevel;
            this.levelUp(game);
        this.xp = remainingXp;
        this.skillPoints += this.constants.SKILL_POINTS_PER_LEVEL; // 獲得技能點數
    }
    }

    // --- 處理升級邏輯 ---
    levelUp(game) { // 需要 game 來顯示消息
        this.level++;
        const hpGain = this.constants.PLAYER_HP_GAIN_PER_LEVEL;
        const oldMaxHp = this.maxHp;
        this.maxHp = this.calculateMaxHp();
        const actualHpGain = this.maxHp - oldMaxHp;
        this.hp += actualHpGain;
        this.hp = Math.min(this.hp, this.maxHp);
        this.xpToNextLevel = this.calculateXpToNextLevel(this.level);
        // this.updateWeaponStats(); // recalculateStats 會調用它
        this.recalculateStats(); // 升級後重新計算所有屬性
        game.setMessage(`等級提升! Lv.${this.level}`, 2500);
    }

    loadImage(src) {
        if (!src) {
            console.warn("Player image URL not provided.");
            this.imageLoaded = true; // Mark as loaded to prevent blocking
            return;
        }
        this.image.onload = () => { this.imageLoaded = true; };
        this.image.onerror = () => { console.error(`載入玩家圖片錯誤: ${src}`); this.imageLoaded = true; };
        this.image.src = src;
    }

    // --- 計算武器屬性 ---
    updateWeaponStats() {
        const constants = this.constants;

        // --- 菜刀屬性 ---
        const cleaverDmg = constants.CLEAVER_BASE_DAMAGE + (this.cleaverLevel - 1) * constants.CLEAVER_DAMAGE_INCREASE_PER_LEVEL;
        const cleaverCd = constants.CLEAVER_BASE_COOLDOWN / (constants.CLEAVER_COOLDOWN_MULTIPLIER ** (this.cleaverLevel - 1));
        const cleaverRange = constants.CLEAVER_RANGE;
        if (this.cleaverLevel === constants.CLEAVER_MAX_LEVEL) {
            this.finalCleaverDamage = cleaverDmg;
            this.finalCleaverCooldown = cleaverCd;
        }

        // --- 弓箭屬性 ---
        let bowDmg = 0, bowCd = Infinity, bowRange = 0;
        if (this.bowUnlocked) {
            const bowBaseDmg = this.finalCleaverDamage > 0 ? this.finalCleaverDamage : (constants.CLEAVER_BASE_DAMAGE + (constants.CLEAVER_MAX_LEVEL - 1) * constants.CLEAVER_DAMAGE_INCREASE_PER_LEVEL); // Fallback if finalCleaverDamage not ready
            const bowBaseCd = this.finalCleaverCooldown > 0 ? this.finalCleaverCooldown : constants.CLEAVER_BASE_COOLDOWN / (constants.CLEAVER_COOLDOWN_MULTIPLIER ** (constants.CLEAVER_MAX_LEVEL - 1)); // Fallback
            bowDmg = bowBaseDmg + (this.bowLevel * constants.BOW_DAMAGE_INCREASE_PER_LEVEL);
            bowCd = bowBaseCd * (constants.BOW_COOLDOWN_MULTIPLIER ** this.bowLevel);
            bowRange = constants.BOW_BASE_RANGE + (this.bowLevel * constants.BOW_RANGE_INCREASE_PER_LEVEL);
            if (this.bowLevel === constants.BOW_MAX_LEVEL) {
                this.finalBowDamage = bowDmg;
                this.finalBowCooldown = bowCd;
                this.finalBowRange = bowRange; // Store final range too
            }
        }

        // --- 槍械屬性 ---
        let gunDmg = 0, gunCd = Infinity, gunRange = 0;
        if (this.gunUnlocked && this.gunLevel > 0) {
            // Ensure final bow stats are calculated if just reached max bow level
            if (this.finalBowDamage === 0 && this.bowLevel === constants.BOW_MAX_LEVEL) {
                const tempBowBaseDmg = this.finalCleaverDamage > 0 ? this.finalCleaverDamage : (constants.CLEAVER_BASE_DAMAGE + (constants.CLEAVER_MAX_LEVEL - 1) * constants.CLEAVER_DAMAGE_INCREASE_PER_LEVEL);
                const tempBowBaseCd = this.finalCleaverCooldown > 0 ? this.finalCleaverCooldown : constants.CLEAVER_BASE_COOLDOWN / (constants.CLEAVER_COOLDOWN_MULTIPLIER ** (constants.CLEAVER_MAX_LEVEL - 1));
                this.finalBowDamage = tempBowBaseDmg + (constants.BOW_MAX_LEVEL * constants.BOW_DAMAGE_INCREASE_PER_LEVEL);
                this.finalBowCooldown = tempBowBaseCd * (constants.BOW_COOLDOWN_MULTIPLIER ** constants.BOW_MAX_LEVEL);
                this.finalBowRange = constants.BOW_BASE_RANGE + (constants.BOW_MAX_LEVEL * constants.BOW_RANGE_INCREASE_PER_LEVEL);
            }

            if (this.finalBowDamage > 0) {
                const gunBaseDmg = this.finalBowDamage * constants.GUN_BASE_DAMAGE_MULTIPLIER;
                const gunBaseCd = this.finalBowCooldown;
                gunDmg = gunBaseDmg + (this.gunLevel * constants.GUN_DAMAGE_INCREASE_PER_LEVEL);
                gunCd = gunBaseCd * (constants.GUN_COOLDOWN_MULTIPLIER ** this.gunLevel);
                // Use finalBowRange as base for gun range calculation
                gunRange = (this.finalBowRange > 0 ? this.finalBowRange : constants.BOW_BASE_RANGE + (constants.BOW_MAX_LEVEL * constants.BOW_RANGE_INCREASE_PER_LEVEL)) // Base on final bow range
                           + (this.gunLevel * constants.GUN_RANGE_INCREASE_PER_LEVEL); // Add gun level increase
            } else {
                console.warn("計算槍械屬性時，滿級弓箭屬性尚未就緒！");
                // Fallback - might be inaccurate but prevents errors
                gunDmg = cleaverDmg * 5; // Rough estimate
                gunCd = cleaverCd * 0.5;
                gunRange = cleaverRange * 2;
            }
        }


        // --- 等級攻擊力加成 ---
        const levelAttackBonus = (this.level - 1) * constants.PLAYER_ATTACK_GAIN_PER_LEVEL;

        // --- 最終應用屬性 ---
        let baseWeaponDamage = 0;
        if (this.gunUnlocked && this.gunLevel > 0) {
            baseWeaponDamage = gunDmg;
            this.attackCooldown = gunCd;
            this.attackRange = gunRange;
        } else if (this.bowUnlocked && this.bowLevel > 0) {
            baseWeaponDamage = bowDmg;
            this.attackCooldown = bowCd;
            this.attackRange = bowRange;
        } else if (this.cleaverLevel === constants.CLEAVER_MAX_LEVEL && this.bowUnlocked && this.bowLevel === 0) {
            baseWeaponDamage = this.finalCleaverDamage;
            this.attackCooldown = this.finalCleaverCooldown;
            this.attackRange = cleaverRange;
        } else {
            baseWeaponDamage = cleaverDmg;
            this.attackCooldown = cleaverCd;
            this.attackRange = cleaverRange;
        }

        // 疊加等級攻擊力加成
        this.attackDamage = baseWeaponDamage + levelAttackBonus;
         // console.log(`Lv.${this.level} | WpnDmg:${baseWeaponDamage.toFixed(1)} LvlBonus:${levelAttackBonus} | Total Dmg:${this.attackDamage.toFixed(1)} | CD:${this.attackCooldown.toFixed(0)}ms | Range:${this.attackRange.toFixed(0)}`);
    }

    update(deltaTime, game) { // Needs game for keys, world bounds, entities, messages
        if (this.hp <= 0 || !game || !game.constants) return; // Check game existence

        // --- 計時器更新 ---
        if (this.attackTimer > 0) this.attackTimer -= deltaTime;
        if (this.healingCooldown > 0) this.healingCooldown -= deltaTime;
        if (this.weaponUpgradeCooldown > 0) this.weaponUpgradeCooldown -= deltaTime;
        if (this.dashTimer > 0) this.dashTimer -= deltaTime;
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= deltaTime;
        if (this.invincibilityTimer > 0) this.invincibilityTimer -= deltaTime;
        // --- 更新自動技能計時器 ---
        if (this.skillAoe1CooldownTimer > 0) this.skillAoe1CooldownTimer -= deltaTime;
        if (this.skillAoe2CooldownTimer > 0) this.skillAoe2CooldownTimer -= deltaTime;
        let skill3TimerBeforeUpdate = this.skillLinear1CooldownTimer; // <--- 定義變量記錄更新前的值
        let skill3TimerUpdated = false; // 標記計時器是否實際減少了

        if (this.skillLinear1CooldownTimer > 0) {
            this.skillLinear1CooldownTimer -= deltaTime;
            skill3TimerUpdated = true; // 標記已更新
        }      
        if (this.skillLinear2CooldownTimer > 0) this.skillLinear2CooldownTimer -= deltaTime;


        // Clamp timers >= 0
        this.attackTimer = Math.max(0, this.attackTimer);
        this.healingCooldown = Math.max(0, this.healingCooldown);
        this.weaponUpgradeCooldown = Math.max(0, this.weaponUpgradeCooldown);
        this.dashTimer = Math.max(0, this.dashTimer);
        this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer);
        this.invincibilityTimer = Math.max(0, this.invincibilityTimer);
        // --- Clamp 自動技能計時器 ---
        this.skillAoe1CooldownTimer = Math.max(0, this.skillAoe1CooldownTimer);
        this.skillAoe2CooldownTimer = Math.max(0, this.skillAoe2CooldownTimer);
        this.skillLinear1CooldownTimer = Math.max(0, this.skillLinear1CooldownTimer);
        this.skillLinear2CooldownTimer = Math.max(0, this.skillLinear2CooldownTimer);

        // --- 更新衝刺和無敵狀態 ---
        if (this.dashTimer <= 0 && this.isDashing) {
            this.isDashing = false;
        }
        if (this.invincibilityTimer <= 0 && this.isInvincible) {
            this.isInvincible = false;
        }

        // --- 移動處理 ---
        let moveX = 0, moveY = 0;
        let inputDx = 0, inputDy = 0; // 用於記錄輸入方向，以便衝刺

        // 讀取正常移動輸入
        if (game.keysPressed['arrowup'] || game.keysPressed['w']) inputDy -= 1;
        if (game.keysPressed['arrowdown'] || game.keysPressed['s']) inputDy += 1;
        if (game.keysPressed['arrowleft'] || game.keysPressed['a']) inputDx -= 1;
        if (game.keysPressed['arrowright'] || game.keysPressed['d']) inputDx += 1;

        // 標準化輸入方向向量
        const inputLen = Math.sqrt(inputDx * inputDx + inputDy * inputDy);
        if (inputLen > 0) {
            inputDx /= inputLen;
            inputDy /= inputLen;
        }

        // --- 判斷是否衝刺 ---
        if (this.isDashing) {
            // 使用衝刺方向和速度
            const dashSpeed = this.constants.PLAYER_SPEED * this.constants.PLAYER_DASH_SPEED_MULTIPLIER;
            moveX = this.dashDirection.dx * dashSpeed;
            moveY = this.dashDirection.dy * dashSpeed;
            // 衝刺時忽略正常移動輸入對實際移動的影響，但仍更新朝向
            if (inputDx > 0) this.facingRight = true;
            else if (inputDx < 0) this.facingRight = false;
            this.isMoving = true; // 衝刺時視為移動
        } else {
            // 使用正常移動速度
            moveX = inputDx * this.constants.PLAYER_SPEED;
            moveY = inputDy * this.constants.PLAYER_SPEED;
            // 更新朝向和移動狀態
            if (inputDx > 0) this.facingRight = true;
            else if (inputDx < 0) this.facingRight = false;
            this.isMoving = (moveX !== 0 || moveY !== 0);
        }

        // 更新跳動計時器
        if (this.isMoving) this.bobbingTimer += deltaTime;
        else this.bobbingTimer = 0;

        // --- 應用移動 (需要 game.constants.WORLD_WIDTH/HEIGHT) ---
        const nextX = this.x + moveX;
        const nextY = this.y + moveY;
        this.x = Math.max(0, Math.min(game.constants.WORLD_WIDTH - this.width, nextX));
        this.y = Math.max(0, Math.min(game.constants.WORLD_HEIGHT - this.height, nextY));

        // --- 交互邏輯 (需要 game.tradingPost 等) ---
        // 衝刺時可能不進行交互？或者允許？暫時允許
        if (game.tradingPost && simpleCollisionCheck(this, game.tradingPost) && this.diamond > 0) {
            this.tradeDiamond(game);
        }

        // --- 建築互動提示 ---
        let inWeaponShop = game.weaponShop && simpleCollisionCheck(this, game.weaponShop);
        let inHealingRoom = game.healingRoom && simpleCollisionCheck(this, game.healingRoom);
        let inSkillInstitute = game.skillInstitute && simpleCollisionCheck(this, game.skillInstitute);
        let inArmorShop = game.armorShop && simpleCollisionCheck(this, game.armorShop); // 新增防具店檢測
        let inDanceStudio = game.danceStudio && simpleCollisionCheck(this, game.danceStudio); // 新增舞蹈室檢測

        if (inWeaponShop) {
            this.handleWeaponShopInteraction(game); // Attempt weapon upgrade (方法名也改一下)
            let shopMsg = "在武器店！"; 
            if (this.weaponUpgradeCooldown > 0) {
                // Optional: shopMsg += ` (冷卻: ...)`
            } else if (!this.bowUnlocked) {
                if (this.cleaverLevel < this.constants.CLEAVER_MAX_LEVEL) {
                    const cost = this.constants.CLEAVER_COSTS[this.cleaverLevel];
                    shopMsg += ` 🔪 Lv.${this.cleaverLevel + 1} (${cost}G)`;
                    if (this.gold < cost) shopMsg += " - 金幣不足";
                } else { shopMsg += ` 🔪 已滿級！靠近解鎖 🏹！`; }
            } else if (this.bowLevel < this.constants.BOW_MAX_LEVEL) {
                const cost = this.constants.BOW_COSTS[this.bowLevel];
                shopMsg += ` 🏹 Lv.${this.bowLevel + 1} (${cost}G)`;
                if (this.gold < cost) shopMsg += " - 金幣不足";
            } else if (!this.gunUnlocked) {
                shopMsg += ` 🏹 已滿級！靠近解鎖 🔫！`;
            } else if (this.gunLevel < this.constants.GUN_MAX_LEVEL) {
                 const cost = this.constants.GUN_COSTS[this.gunLevel];
                 shopMsg += ` 🔫 Lv.${this.gunLevel + 1} (${cost}G)`;
                 if (this.gold < cost) shopMsg += " - 金幣不足";
            } else { shopMsg += " 武器已滿級"; }

            if (game.messageTimer <= 0) game.setMessage(shopMsg, 500); // 改名
        }

        if (inHealingRoom) {
            const healed = this.handleHealingRoomInteraction(game); // Attempt heal
            if (!healed) { // Only show reason if not healed
                const cost = 10 * this.constants.HEALING_COST_PER_HP; // Cost for 10 HP heal
                let healMsg = "在治療室！";
                if (this.hp >= this.maxHp) healMsg = "生命值已滿！";
                else if (this.healingCooldown > 0) healMsg = `治療冷卻中: ${(this.healingCooldown / 1000).toFixed(1)}s`;
                else if (this.gold < cost) healMsg = `金幣不足 (需 ${cost}G)`;
                // Show message only if not full/cooling/broke, or if no other message showing
                if (healMsg !== "在治療室！" || game.messageTimer <= 0) {
                    game.setMessage(healMsg, healMsg !== "在治療室！" ? 1000 : 500);
                }
            }
        }

        if (inArmorShop) { // 防具店互動處理
            const upgraded = this.handleArmorShopInteraction(game);
            if (!upgraded) { // 僅在未成功升級時顯示提示
                let armorMsg = "在防具店！";
                if (this.armorLevel >= this.constants.ARMOR_SHOP_MAX_LEVEL) {
                    armorMsg = "護甲已滿級！";
                } else if (this.weaponUpgradeCooldown > 0) {
                    // 可選：顯示冷卻提示
                    // armorMsg = `升級冷卻中: ${(this.weaponUpgradeCooldown / 1000).toFixed(1)}s`;
                } else {
                    const cost = Math.floor(this.constants.ARMOR_SHOP_BASE_COST * (this.constants.ARMOR_SHOP_COST_MULTIPLIER ** this.armorLevel));
                    const hpBonusNextLevel = this.constants.ARMOR_SHOP_BASE_HP_BONUS + this.armorLevel * this.constants.ARMOR_SHOP_HP_BONUS_INCREMENT;
                    armorMsg += ` 🩸 Lv.${this.armorLevel + 1} (+${hpBonusNextLevel}HP): ${cost}G`;
                    if (this.gold < cost) armorMsg += " - 金幣不足";
                }
                 // 僅在有具體信息或無其他消息時顯示
                if (armorMsg !== "在防具店！" || game.messageTimer <= 0) {
                    game.setMessage(armorMsg, armorMsg !== "在防具店！" ? 1000 : 500);
                }
            }
        }

        if (inDanceStudio) { // 新增舞蹈室互動處理
            const upgraded = this.handleDanceStudioInteraction(game);
             if (!upgraded) { // 僅在未成功升級時顯示提示
                let danceMsg = "在舞蹈室！";
                if (this.danceLevel >= this.constants.DANCE_STUDIO_MAX_LEVEL) {
                    danceMsg = "閃避已滿級！";
                } else if (this.weaponUpgradeCooldown > 0) {
                     // 可選：顯示冷卻提示
                     // danceMsg = `升級冷卻中: ${(this.weaponUpgradeCooldown / 1000).toFixed(1)}s`;
                } else {
                    const cost = Math.floor(this.constants.DANCE_STUDIO_BASE_COST * (this.constants.DANCE_STUDIO_COST_MULTIPLIER ** this.danceLevel));
                    const currentTotalBonus = this.constants.DANCE_STUDIO_DODGE_BONUS_PER_LEVEL[this.danceLevel];
                    const nextTotalBonus = this.constants.DANCE_STUDIO_DODGE_BONUS_PER_LEVEL[this.danceLevel + 1];
                    const dodgeIncrease = nextTotalBonus - currentTotalBonus;
                    danceMsg += ` 🤸 Lv.${this.danceLevel + 1} (+${(dodgeIncrease * 100).toFixed(1)}%閃避): ${cost}G`;
                    if (this.gold < cost) danceMsg += " - 金幣不足";
                }
                 // 僅在有具體信息或無其他消息時顯示
                if (danceMsg !== "在舞蹈室！" || game.messageTimer <= 0) {
                    game.setMessage(danceMsg, danceMsg !== "在舞蹈室！" ? 1000 : 500);
                }
            }
        }


        if (inSkillInstitute) {
            if (this.skillPoints > 0 && this.weaponUpgradeCooldown <= 0) { // 檢查技能點和冷卻
                // 使用持續時間稍長的消息，方便玩家看到按鍵提示
                game.setMessage("按[1-4]學習/升級技能", 1000); // (原500ms可能太短)
            } else if (this.skillPoints <= 0) {
                game.setMessage("無可用技能點", 1000);
           } else if (this.weaponUpgradeCooldown > 0) {
                // 可選：如果希望顯示冷卻，可以取消註釋下一行
                // game.setMessage(`技能升級冷卻中: ${(this.weaponUpgradeCooldown / 1000).toFixed(1)}s`, 500);
           }
       }

        // --- 自動攻擊 (需要 game.find...Enemy 方法) ---
        // 衝刺時不攻擊
        if (this.attackTimer <= 0 && !this.isDashing) {
            // The attack method itself will find targets based on the current weapon
            this.attack(null, game); // Pass null target, method handles finding
        }

        // --- 自動技能觸發 ---
        this.tryActivateAutoSkills(game);

        // --- 拾取獎杯邏輯 ---
        if (game.goalCharacter && game.goalCharacter.active && !this.carryingTrophy && simpleCollisionCheck(this, game.goalCharacter)) {
            game.goalCharacter.pickUp();
            this.carryingTrophy = true;
            this.trophyReference = game.goalCharacter;
            game.setMessage("撿到了獎杯！🏆 帶回安全區！", 3000);
            // 標記玩家已觸碰過目標角色 (用於 HUD 顯示)
            // 注意：這裡假設 goalCharacter 就是獎杯，所以直接設置 hasMetGoalCharacter
            this.hasMetGoalCharacter = true;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        // --- 繪製衝刺效果 (例如：半透明) ---
        if (this.isDashing) {
            ctx.save();
            ctx.globalAlpha = 0.6; // 衝刺時半透明
        }

         // --- 繪製玩家圖片 (翻轉和跳動) ---
        if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
            ctx.save();

            const bobAmplitude = 2;
            const bobFrequency = 180;
            const bobOffset = this.isMoving ? Math.sin(this.bobbingTimer / bobFrequency) * bobAmplitude : 0;
            const drawY = this.y + bobOffset;

            if (!this.facingRight) {
                ctx.translate(this.x + this.width / 2, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(this.image, -this.width / 2, drawY, this.width, this.height);
            } else {
                ctx.drawImage(this.image, this.x, drawY, this.width, this.height);
            }

            ctx.restore();
        } else {
            // Fallback drawing if image fails
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

        // --- 恢復衝刺效果的透明度 ---
        if (this.isDashing) {
            ctx.restore();
        }

        // --- 繪製無敵效果 (例如：閃爍或外框) ---
        if (this.isInvincible && !this.isDashing) { // 僅在非衝刺的無敵狀態下顯示，避免與衝刺效果重疊
             // 簡單的閃爍效果 (通過改變透明度)
             const blinkSpeed = 250; // 閃爍速度 (毫秒)
             const alpha = (Math.sin(performance.now() / blinkSpeed) + 1) / 2 * 0.4 + 0.3; // Alpha between 0.3 and 0.7
             ctx.save();
             ctx.globalAlpha = alpha;
             // 重新繪製一次玩家圖像 (或只繪製外框)
             if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
                 const bobOffset = this.isMoving ? Math.sin(this.bobbingTimer / 180) * 2 : 0;
                 const drawY = this.y + bobOffset;
                 if (!this.facingRight) {
                     ctx.translate(this.x + this.width / 2, 0);
                     ctx.scale(-1, 1);
                     ctx.drawImage(this.image, -this.width / 2, drawY, this.width, this.height);
                 } else {
                     ctx.drawImage(this.image, this.x, drawY, this.width, this.height);
                 }
             } else {
                 ctx.fillStyle = this.color;
                 ctx.fillRect(this.x, this.y, this.width, this.height);
             }
             ctx.restore();
        }

        // --- 繪製攜帶的獎杯 ---
        if (this.carryingTrophy && this.trophyReference) {
            ctx.save();
            const iconSize = this.width * 0.6; // 獎杯圖標大小
            const iconX = this.centerX;
            // 計算跳動效果，使獎杯跟隨玩家頭頂跳動
            const bobAmplitude = 2;
            const bobFrequency = 180;
            const bobOffset = this.isMoving ? Math.sin(this.bobbingTimer / bobFrequency) * bobAmplitude : 0;
            const iconY = this.y + bobOffset - iconSize * 0.8; // 在頭頂上方一點，並應用跳動

            ctx.font = `${iconSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            // 添加陰影
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.shadowBlur = 3;
            ctx.fillText(this.trophyReference.icon, iconX, iconY);
            ctx.restore();
        }

        // Draw attack range (optional)
        if (this.attackRange > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, this.attackRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }

    takeDamage(damage, game) {
        // 增加無敵判斷
        if (!this.active || this.isInvincible || !game || !game.constants) return;

        const constants = game.constants;
        const isInSafeZone = this.centerX < constants.SAFE_ZONE_WIDTH &&
                             this.centerY > constants.SAFE_ZONE_TOP_Y &&
                             this.centerY < constants.SAFE_ZONE_BOTTOM_Y;

        if (isInSafeZone) return; // 安全區內不受傷害

        // --- 閃避判定 ---
        if (Math.random() < this.dodgeChance) {
            // 觸發閃避
            game.addDamageNumber(this.centerX, this.y, 'Miss', '#00FFFF'); // 顯示 "Miss" 文字，使用青色
            // console.log("玩家閃避了攻擊！"); // 可以保留或移除日誌
            return; // 不受到傷害，直接返回
        }

        // --- 未閃避，受到傷害 ---
        this.hp -= damage;
        this.hp = Math.max(0, this.hp); // 確保 HP 不會低於 0

        // 在這裡添加傷害數字顯示，因為確定受到傷害了
        game.addDamageNumber(this.centerX, this.y, damage, '#FF8888'); // 使用淡紅色表示玩家受到的傷害

        // --- 檢查玩家是否死亡 ---
        if (this.hp <= 0) {
            // 如果攜帶獎杯，則掉落
            if (this.carryingTrophy && this.trophyReference) {
                this.trophyReference.drop(this.x, this.y); // 在玩家死亡位置掉落
                this.carryingTrophy = false;
                this.trophyReference = null;
                game.setMessage("你倒下了，獎杯掉落了！", 3000);
            }
            // 可以在這裡觸發遊戲結束邏輯，或者由 Game 類檢測玩家 HP
        }
    }

    tradeDiamond(game) { // Needs game for constants, setMessage
        if (!game || !game.constants) return;
        const goldEarned = this.diamond * this.constants.diamond_VALUE;
        this.gold += goldEarned;
        game.setMessage(`用 ${this.diamond} 💎 轉換 ${goldEarned} G! (總金幣: ${this.gold})`, 2000);
        this.diamond = 0;
    }

    // 方法名修改
    handleWeaponShopInteraction(game) { // Needs game for constants, setMessage
        const constants = this.constants;
        if (this.weaponUpgradeCooldown > 0 || !game) return false; // Still cooling down or no game object

        let upgraded = false;

        // 1. Cleaver
        if (this.cleaverLevel < constants.CLEAVER_MAX_LEVEL) {
            const cost = constants.CLEAVER_COSTS[this.cleaverLevel];
            if (this.gold >= cost) {
                this.gold -= cost;
                this.cleaverLevel++;
                this.updateWeaponStats();
                game.setMessage(`🔪 升級! Lv.${this.cleaverLevel} (${cost}G)`, 1500);
                this.weaponUpgradeCooldown = constants.WEAPON_UPGRADE_COOLDOWN;
                upgraded = true;
                if (this.cleaverLevel === constants.CLEAVER_MAX_LEVEL) {
                    this.bowUnlocked = true;
                    this.updateWeaponStats(); // Update again after unlock
                    game.setMessage(`🔪 已滿級! 解鎖 🏹！`, 2500);
                }
            }
        }
        // 2. Bow
        else if (this.bowUnlocked && this.bowLevel < constants.BOW_MAX_LEVEL) {
            const cost = constants.BOW_COSTS[this.bowLevel];
            if (this.gold >= cost) {
                this.gold -= cost;
                this.bowLevel++;
                this.updateWeaponStats();
                game.setMessage(`🏹 升級! Lv.${this.bowLevel} (${cost}G)`, 1500);
                this.weaponUpgradeCooldown = constants.WEAPON_UPGRADE_COOLDOWN;
                upgraded = true;
                if (this.bowLevel === constants.BOW_MAX_LEVEL) {
                    this.gunUnlocked = true;
                    this.updateWeaponStats(); // Update again after unlock
                    game.setMessage(`🏹 已滿級! 解鎖 🔫！`, 2500);
                }
            }
        }
        // 3. Gun
        else if (this.gunUnlocked && this.gunLevel < constants.GUN_MAX_LEVEL) {
             const cost = constants.GUN_COSTS[this.gunLevel];
             if (this.gold >= cost) {
                 this.gold -= cost;
                 this.gunLevel++;
                 this.updateWeaponStats();
                 game.setMessage(`🔫 升級! Lv.${this.gunLevel} (${cost}G)`, 1500);
                 this.weaponUpgradeCooldown = constants.WEAPON_UPGRADE_COOLDOWN;
                 upgraded = true;
                 if (this.gunLevel === constants.GUN_MAX_LEVEL) {
                     game.setMessage(`🔫 已滿級!`, 2500);
                 }
             }
        }
        return upgraded; // Return whether an upgrade happened
    }


    handleHealingRoomInteraction(game) { // Needs game for constants, setMessage
         if (this.healingCooldown > 0 || !game || !game.constants) return false; // 冷卻中或缺少遊戲對象
         if (this.hp >= this.maxHp) return false; // 生命值已滿

         // 計算補滿所需 HP 和金幣
         const hpToHeal = Math.max(0, this.maxHp - this.hp);
         // 使用 Math.ceil 確保即使只差一點點 HP 也要支付對應的最小金幣單位 (如果 costPerHp 不是整數)
         const costToFull = Math.ceil(hpToHeal * this.constants.HEALING_COST_PER_HP);

         // 檢查金幣是否足夠
         if (this.gold < costToFull) return false; // 金幣不足

         // 執行治療 (補滿)
         this.gold -= costToFull;
         const actualHealed = this.maxHp - this.hp; // 記錄實際恢復量
         this.hp = this.maxHp; // 直接補滿
         this.healingCooldown = this.constants.HEALING_RATE; // 開始冷卻

         game.setMessage(`+${Math.ceil(actualHealed)} HP (花費 ${costToFull}G)`, 1000); // 顯示實際恢復量和花費
        return true; // Healing was successful
    }

    // --- 處理防具店互動 ---
    handleArmorShopInteraction(game) {
        const constants = this.constants;
        // 檢查冷卻、遊戲對象、等級上限
        if (this.weaponUpgradeCooldown > 0 || !game || !constants || this.armorLevel >= constants.ARMOR_SHOP_MAX_LEVEL) {
            return false;
        }

        // 計算成本
        const cost = Math.floor(constants.ARMOR_SHOP_BASE_COST * (constants.ARMOR_SHOP_COST_MULTIPLIER ** this.armorLevel));

        // 檢查金幣
        if (this.gold < cost) {
            return false;
        }

        // 執行升級
        this.gold -= cost;
        this.armorLevel++;
        const oldMaxHp = this.maxHp; // 記錄舊的最大 HP
        this.recalculateStats(); // 重新計算 MaxHP (以及其他屬性)
        const maxHpIncrease = this.maxHp - oldMaxHp; // 計算最大 HP 的實際增加量

        // 同時增加當前 HP
        if (maxHpIncrease > 0) {
            this.hp += maxHpIncrease;
            // 確保當前 HP 不超過新的最大值 (雖然 recalculateStats 裡可能已處理，但再次確認更安全)
            this.hp = Math.min(this.hp, this.maxHp);
        }

        this.weaponUpgradeCooldown = constants.WEAPON_UPGRADE_COOLDOWN; // 設置冷卻

        // 顯示消息時，顯示本次升級增加的 *總* HP 加成量可能更直觀
        const totalHpBonus = this.calculateArmorHpBonus(); // 獲取升級後的總加成
        game.setMessage(`🩸 血線升級! Lv.${this.armorLevel} (已+${totalHpBonus}HP) (${cost}G)`, 1500);
        return true; // 升級成功
    }

    // --- 新增：處理舞蹈室互動 ---
    handleDanceStudioInteraction(game) {
        const constants = this.constants;
        // 檢查冷卻、遊戲對象、等級上限
        if (this.weaponUpgradeCooldown > 0 || !game || !constants || this.danceLevel >= constants.DANCE_STUDIO_MAX_LEVEL) {
            return false;
        }

        // 計算成本
        const cost = Math.floor(constants.DANCE_STUDIO_BASE_COST * (constants.DANCE_STUDIO_COST_MULTIPLIER ** this.danceLevel));

        // 檢查金幣
        if (this.gold < cost) {
            return false;
        }

        // 執行升級
        this.gold -= cost;
        this.danceLevel++;
        // 計算這次升級 *增加* 的閃避率
        const prevTotalBonus = constants.DANCE_STUDIO_DODGE_BONUS_PER_LEVEL[this.danceLevel - 1];
        const currentTotalBonus = constants.DANCE_STUDIO_DODGE_BONUS_PER_LEVEL[this.danceLevel];
        const dodgeIncrease = currentTotalBonus - prevTotalBonus;

        this.recalculateStats(); // 重新計算閃避率
        this.weaponUpgradeCooldown = constants.WEAPON_UPGRADE_COOLDOWN; // 設置冷卻

        game.setMessage(`🤸 閃避提升! Lv.${this.danceLevel} (+${(dodgeIncrease * 100).toFixed(1)}%) (${cost}G)`, 1500);
        return true; // 升級成功
    }


    attack(enemy, game) { // Needs game to find targets and add projectiles/effects
         if (!game || !game.constants) return; // Need game object

         const constants = this.constants;
         let attackPerformed = false;

         // --- 槍攻擊 ---
         if (this.gunUnlocked && this.gunLevel > 0) {
             let numBullets = 1;
             const baseArrowsAtMaxBow = constants.BOW_MAX_LEVEL >= constants.BOW_MULTISHOT_START_LEVEL
                 ? constants.BOW_MAX_LEVEL - constants.BOW_MULTISHOT_START_LEVEL + 2
                 : 1;
             numBullets = baseArrowsAtMaxBow + this.gunLevel;

             const targets = game.findMultipleEnemiesInRange(this, this.attackRange, numBullets);
             if (targets.length > 0) {
                 targets.forEach(target => {
                     game.addBullet(this, target, { color: '#FFA500' }); // Pass options
                 });
                 attackPerformed = true;
             }
         }
         // --- 弓箭攻擊 ---
         else if (this.bowUnlocked && this.bowLevel > 0) {
             let numArrows = 1;
             if (this.bowLevel >= constants.BOW_MULTISHOT_START_LEVEL) {
                 numArrows = this.bowLevel - constants.BOW_MULTISHOT_START_LEVEL + 2;
             }

             if (numArrows > 1) {
                 const targets = game.findMultipleEnemiesInRange(this, this.attackRange, numArrows);
                 if (targets.length > 0) {
                     targets.forEach(target => game.addArrow(this, target));
                     attackPerformed = true;
                 }
             } else {
                 let nearestEnemy = game.findNearestActiveEnemy(this, this.attackRange);
                 if (nearestEnemy) {
                     game.addArrow(this, nearestEnemy);
                     attackPerformed = true;
                 }
             }
         }
         // --- 菜刀攻擊 ---
         else {
             let targetEnemy = game.findNearestActiveEnemy(this, this.attackRange);
             if (targetEnemy) {
                 const damageDealt = this.attackDamage;
                 targetEnemy.takeDamage(damageDealt, game); // Pass game to enemy's takeDamage
                 game.addDamageNumber(targetEnemy.centerX, targetEnemy.y, damageDealt, '#FFFFFF'); // White for cleaver hit
                 game.addSlashEffect(this, targetEnemy);
                 attackPerformed = true;
             }
         }

         // 設置冷卻 (只有在實際攻擊後才設置)
         if (attackPerformed) {
             this.attackTimer = this.attackCooldown;
         }
     }


    collectTree(game) { // Needs game for trees list, constants, setMessage
        if (!game || !game.trees || !game.constants) return false;

        let collected = false;
        let closestTreeDistSq = Infinity;
        let treeToCollect = null;
        // Use player center and tree center for distance check
        const collectRangeSq = (this.constants.TILE_SIZE * 1.5) ** 2; // Increased range slightly

        game.trees.forEach((tree) => {
            if (!tree.active) return;
            const distSq = distanceSq(this, tree); // Use center-to-center distance
            if (distSq < collectRangeSq && distSq < closestTreeDistSq) {
                closestTreeDistSq = distSq;
                treeToCollect = tree;
            }
        });

        if (treeToCollect) {
            this.wood += 5;
            treeToCollect.active = false; // Deactivate the collected tree
            collected = true;
            game.setMessage(`採集到 5 木材! (總計: ${this.wood})`, 1000);
            // Respawn logic is handled in Game.update or similar, not directly here
            game.scheduleTreeRespawn(); // Tell the game to handle respawning
        }
        return collected;
    }

    // --- 觸發衝刺的方法 ---
    startDash(inputDx, inputDy) {
        // 檢查冷卻時間是否結束，以及是否已經在衝刺中
        if (this.dashCooldownTimer > 0 || this.isDashing) {
            return; // 還在冷卻或正在衝刺，無法再次觸發
        }

        // 設定衝刺狀態
        this.isDashing = true;
        this.dashTimer = this.constants.PLAYER_DASH_DURATION; // 設定衝刺持續時間
        this.dashCooldownTimer = this.constants.PLAYER_DASH_COOLDOWN; // 設定冷卻時間
        this.isInvincible = true; // 衝刺期間無敵
        this.invincibilityTimer = this.constants.PLAYER_DASH_INVINCIBILITY_DURATION; // 設定無敵時間

        // 決定衝刺方向
        // 如果有移動輸入，則使用輸入方向
        if (inputDx !== 0 || inputDy !== 0) {
            // 確保方向已標準化 (雖然 update 中會做，這裡再做一次也無妨)
            const len = Math.sqrt(inputDx * inputDx + inputDy * inputDy);
             if (len > 0) {
                 this.dashDirection.dx = inputDx / len;
                 this.dashDirection.dy = inputDy / len;
             } else { // 如果輸入向量長度為 0 (理論上不應發生，但作為備份)
                 this.dashDirection.dx = this.facingRight ? 1 : -1;
                 this.dashDirection.dy = 0;
             }
        }
        // 如果沒有移動輸入，則使用玩家當前朝向
        else {
            this.dashDirection.dx = this.facingRight ? 1 : -1;
            this.dashDirection.dy = 0;
        }

        // 可選：添加衝刺視覺效果 (例如：殘影)
        // game.addDashEffect(this);
    }

    // --- 檢查是否可以升級指定技能 ---
    canUpgradeSkill(skillIndex) {
        if (this.skillPoints <= 0) return false; // 沒點數

        let currentLevel;
        switch (skillIndex) {
            case 1: currentLevel = this.skillAoe1Level; break;
            case 2: currentLevel = this.skillAoe2Level; break;
            case 3: currentLevel = this.skillLinear1Level; break;
            case 4: currentLevel = this.skillLinear2Level; break;
            default: return false; // 無效索引
        }
        // 檢查是否達到最高等級
        return currentLevel < this.constants.SKILL_MAX_LEVEL;
    }

    // --- 嘗試升級指定技能 ---
    attemptSkillUpgrade(skillIndex, game) {
        // 檢查冷卻時間，防止快速連續點擊
        if (this.weaponUpgradeCooldown > 0) {
             // game.setMessage(`技能升級冷卻中...`, 500); // 可選提示
             return false;
        }

        if (!this.canUpgradeSkill(skillIndex)) {
            // 檢查不能升級的原因
            if (this.skillPoints <= 0) {
                game.setMessage("沒有技能點！", 1500);
            } else {
                // 判斷是哪個技能已滿級
                let skillName = "";
                switch (skillIndex) {
                    case 1: skillName = "震盪波"; break;
                    case 2: skillName = "新星爆發"; break;
                    case 3: skillName = "能量箭"; break;
                    case 4: skillName = "能量光束"; break;
                }
                game.setMessage(`${skillName} 已達到最高等級!`, 1500);
            }
            return false; // 升級失敗
        }

        // --- 執行升級 ---
        this.skillPoints--; // 消耗技能點
        let skillName = "";
        let newLevel = 0;

        switch (skillIndex) {
            case 1:
                this.skillAoe1Level++;
                skillName = "💥 震盪波";
                newLevel = this.skillAoe1Level;
                break;
            case 2:
                this.skillAoe2Level++;
                skillName = "🌟 新星爆發";
                newLevel = this.skillAoe2Level;
                break;
            case 3:
                this.skillLinear1Level++;
                skillName = "⚡ 能量箭";
                newLevel = this.skillLinear1Level;
                break;
            case 4:
                this.skillLinear2Level++;
                skillName = "☄️ 能量光束";
                newLevel = this.skillLinear2Level;
                break;
        }

        // 設置短暫冷卻，防止誤觸
        this.weaponUpgradeCooldown = 500; // 0.5秒冷卻

        game.setMessage(`${skillName} 升級! Lv.${newLevel} (-1🧬)`, 1500);
        return true; // 升級成功
    }    

    // --- 計算技能屬性 ---
    getSkillStats(skillIndex) {
        const constants = this.constants;
        let baseDamage, damagePerLevel, baseCooldown, cooldownMultiplier, baseRadius, radiusPerLevel, baseRange, rangePerLevel, baseWidth, widthPerLevel, currentLevel;

        switch (skillIndex) {
            case 1: // AOE1 - Shockwave
                currentLevel = this.skillAoe1Level;
                baseDamage = constants.SKILL_AOE1_DAMAGE;
                damagePerLevel = constants.SKILL_AOE1_DAMAGE_PER_LEVEL;
                baseCooldown = constants.SKILL_AOE1_COOLDOWN;
                cooldownMultiplier = constants.SKILL_LINEAR1_COOLDOWN_MULTIPLIER;
                baseRadius = constants.SKILL_AOE1_RADIUS;
                radiusPerLevel = constants.SKILL_AOE1_RADIUS_PER_LEVEL;
                break;
            case 2: // AOE2 - Nova
                currentLevel = this.skillAoe2Level;
                baseDamage = constants.SKILL_AOE2_DAMAGE;
                damagePerLevel = constants.SKILL_AOE2_DAMAGE_PER_LEVEL;
                baseCooldown = constants.SKILL_AOE2_COOLDOWN;
                cooldownMultiplier = constants.SKILL_AOE2_COOLDOWN_MULTIPLIER;
                baseRadius = constants.SKILL_AOE2_RADIUS;
                radiusPerLevel = constants.SKILL_AOE2_RADIUS_PER_LEVEL;
                break;
            case 3: // Linear1 - Bolt
                currentLevel = this.skillLinear1Level;
                baseDamage = constants.SKILL_LINEAR1_DAMAGE;
                damagePerLevel = constants.SKILL_LINEAR1_DAMAGE_PER_LEVEL;
                baseCooldown = constants.SKILL_LINEAR1_COOLDOWN;
                cooldownMultiplier = constants.SKILL_LINEAR1_COOLDOWN_MULTIPLIER;
                baseRange = constants.SKILL_LINEAR1_RANGE;
                rangePerLevel = constants.SKILL_LINEAR1_RANGE_PER_LEVEL;
                baseWidth = constants.SKILL_LINEAR1_WIDTH;
                // widthPerLevel = constants.SKILL_LINEAR1_WIDTH_PER_LEVEL || 0;
                break;
            case 4: // Linear2 - Beam
                currentLevel = this.skillLinear2Level;
                baseDamage = constants.SKILL_LINEAR2_DAMAGE;
                damagePerLevel = constants.SKILL_LINEAR2_DAMAGE_PER_LEVEL;
                baseCooldown = constants.SKILL_LINEAR2_COOLDOWN;
                cooldownMultiplier = constants.SKILL_LINEAR2_COOLDOWN_MULTIPLIER;
                baseRange = constants.SKILL_LINEAR2_RANGE;
                rangePerLevel = constants.SKILL_LINEAR2_RANGE_PER_LEVEL;
                baseWidth = constants.SKILL_LINEAR2_WIDTH;
                // widthPerLevel = constants.SKILL_LINEAR2_WIDTH_PER_LEVEL || 0;
                break;
            default:
                return null; // 無效技能索引
        }

        if (currentLevel <= 0) { // 如果技能未學習，返回基礎值或 null/0
             return {
                 level: 0,
                 damage: 0, // 未學習時無傷害
                 cooldown: Infinity, // 未學習時無限冷卻
                 radius: baseRadius || 0,
                 range: baseRange || 0,
                 width: baseWidth || 0,
             };
        }

        const levelFactor = currentLevel -1; // 等級因子從 0 開始計算加成
        const damage = baseDamage + levelFactor * damagePerLevel;
        const cooldown = baseCooldown * (cooldownMultiplier ** levelFactor);
        const radius = baseRadius ? baseRadius + levelFactor * radiusPerLevel : undefined;
        const range = baseRange ? baseRange + levelFactor * rangePerLevel : undefined;
        const width = baseWidth;

        return { level: currentLevel, damage, cooldown, radius, range, width };
    }


    // --- 嘗試觸發自動技能 (使用計算後的屬性) ---
    tryActivateAutoSkills(game) {
        if (!game || !game.constants) return;

        // 技能 1: 震盪波 (Shockwave)
        const stats1 = this.getSkillStats(1);
        if (stats1 && stats1.level > 0 && this.skillAoe1CooldownTimer <= 0) {
            game.triggerSkillAoe1(this, stats1); // 傳遞計算後的屬性
            this.skillAoe1CooldownTimer = stats1.cooldown; // 使用計算後的冷卻時間
        }

        // 技能 2: 新星爆發 (Nova)
        const stats2 = this.getSkillStats(2);
        if (stats2 && stats2.level > 0 && this.skillAoe2CooldownTimer <= 0) {
            game.triggerSkillAoe2(this, stats2);
            this.skillAoe2CooldownTimer = stats2.cooldown;
        }

        // 技能 3: 能量箭 (Bolt)
        const stats3 = this.getSkillStats(3);
        // **** 添加日誌：檢查觸發條件 ****
        if (stats3 && stats3.level > 0) {
            // console.log(`Checking Skill 3 trigger: Level=${stats3.level}, Timer=${this.skillLinear1CooldownTimer.toFixed(0)}`);
        }
        // **** -------------------------- ****
        if (stats3 && stats3.level > 0 && this.skillLinear1CooldownTimer <= 0) {
            game.triggerSkillLinear1(this, stats3);
            this.skillLinear1CooldownTimer = stats3.cooldown;
        }

        // 技能 4: 能量光束 (Beam)
        const stats4 = this.getSkillStats(4);
        // ... (類似地為技能4添加日誌，如果需要) ...
        if (stats4 && stats4.level > 0 && this.skillLinear2CooldownTimer <= 0) {
            game.triggerSkillLinear2(this, stats4);
            this.skillLinear2CooldownTimer = stats4.cooldown;
            // console.log(`>>> Skill 4 Triggered! Cooldown set to: ${this.skillLinear2CooldownTimer.toFixed(0)}`);
        }
    }
}
