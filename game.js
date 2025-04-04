'use strict';

// --- 輔助函數 ---
function distanceSq(obj1, obj2) {
    if (!obj1 || !obj2) return Infinity;
    const dx = (obj1.x + (obj1.width || 0) / 2) - (obj2.x + (obj2.width || 0) / 2);
    const dy = (obj1.y + (obj1.height || 0) / 2) - (obj2.y + (obj2.height || 0) / 2);
    return dx * dx + dy * dy;
}
function distanceSqValues(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}
function simpleCollisionCheck(rect1, rect2, tolerance = 0) {
    if (!rect1 || !rect2) return false;
    const r1w = rect1.width || (rect1.radius ? rect1.radius * 2 : 0);
    const r1h = rect1.height || (rect1.radius ? rect1.radius * 2 : 0);
    const r2w = rect2.width || (rect2.radius ? rect2.radius * 2 : 0);
    const r2h = rect2.height || (rect2.radius ? rect2.radius * 2 : 0);
    if (r1w <= 0 || r1h <= 0 || r2w <= 0 || r2h <= 0) return false;
    const r1cx = rect1.x + r1w / 2;
    const r1cy = rect1.y + r1h / 2;
    const r2cx = rect2.x + r2w / 2;
    const r2cy = rect2.y + r2h / 2;
    const overlapX = Math.abs(r1cx - r2cx) * 2 < (r1w + r2w + tolerance * 2);
    const overlapY = Math.abs(r1cy - r2cy) * 2 < (r1h + r2h + tolerance * 2);
    return overlapX && overlapY;
}
// --- 遊戲實體基類 ---
class Entity {
    constructor(x, y, width, height, color = 'gray') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.active = true;
    }
    get centerX() { return this.x + this.width / 2; }
    get centerY() { return this.y + this.height / 2; }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update(deltaTime, game) {
        // 基類更新邏輯（如果有的話）
    }

    isRectInView(camera, canvasWidth, canvasHeight, leeway = 0) {
        return this.x + this.width > camera.x - leeway &&
            this.x < camera.x + canvasWidth + leeway &&
            this.y + this.height > camera.y - leeway &&
            this.y < camera.y + canvasHeight + leeway;
    }
}
// --- 玩家類 ---
class Player extends Entity {
    constructor(x, y, width, height, gameConstants) {
        super(x, y, width, height, 'blue');
        this.constants = gameConstants;

        // --- 等級與經驗初始化 ---
        this.level = this.constants.PLAYER_INITIAL_LEVEL;
        this.xp = this.constants.PLAYER_INITIAL_XP;
        this.xpToNextLevel = this.calculateXpToNextLevel(this.level);
        this.baseMaxHp = this.constants.PLAYER_HP_BASE; // 儲存基礎 HP
        this.maxHp = this.calculateMaxHp(); // 計算初始 MaxHP
        this.hp = this.maxHp; // 初始血量設為最大值

        this.wood = 20;
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

        // --- 初始化武器屬性 ---
        this.updateWeaponStats(); // 根據初始武器等級計算屬性
    }

    // --- 新增：計算下一級所需經驗 ---
    calculateXpToNextLevel(level) {
        // 使用指數增長公式
        return Math.floor(this.constants.PLAYER_XP_BASE_REQ * Math.pow(this.constants.PLAYER_XP_LEVEL_MULTIPLIER, level - 1));
        // 或者可以使用其他公式，例如：
        // return this.constants.PLAYER_XP_BASE_REQ + (level - 1) * 50 + Math.floor(Math.pow(level - 1, 2) * 5); // 混合線性與平方增長
    }

    // --- 新增：計算當前等級的最大 HP ---
    calculateMaxHp() {
        return this.baseMaxHp + (this.level - 1) * this.constants.PLAYER_HP_GAIN_PER_LEVEL;
    }

    // --- 新增：處理經驗獲取 ---
    gainXp(amount, game) {
        if (!this.active) return; // 死亡不獲得經驗

        this.xp += amount;
        // console.log(`獲得 ${amount} XP, 目前 ${this.xp} / ${this.xpToNextLevel}`); // 調試信息

        // 使用 while 循環處理可能一次升多級的情況
        while (this.xp >= this.xpToNextLevel) {
            const remainingXp = this.xp - this.xpToNextLevel; // 計算溢出經驗
            this.levelUp(game);                              // 執行升級
            this.xp = remainingXp;                           // 設置經驗為溢出值
            // console.log(`升級! 新經驗 ${this.xp} / ${this.xpToNextLevel}`); // 調試信息
        }
    }

    // --- 處理升級邏輯 ---
    levelUp(game) {
        this.level++;
        const hpGain = this.constants.PLAYER_HP_GAIN_PER_LEVEL;

        // 計算新的 MaxHP 並回復對應的血量
        const oldMaxHp = this.maxHp;
        this.maxHp = this.calculateMaxHp();
        const actualHpGain = this.maxHp - oldMaxHp; // 可能因為取整有微小差異，或者直接用 hpGain
        this.hp += actualHpGain;
        this.hp = Math.min(this.hp, this.maxHp); // 確保不超過新的上限

        // 計算下一級所需經驗
        this.xpToNextLevel = this.calculateXpToNextLevel(this.level);

        // 更新武器屬性 (因為基礎攻擊力增加了)
        this.updateWeaponStats();

        // 顯示升級提示
        game.setMessage(`等級提升! Lv.${this.level}`, 2500);
        // 可以添加音效或視覺效果
        // game.addLevelUpEffect(this);
    }

    loadImage(src) {
        this.image.onload = () => { this.imageLoaded = true; };
        this.image.onerror = () => { console.error(`載入玩家圖片錯誤: ${src}`); this.imageLoaded = true; /* Treat error as loaded to not block game */ };
        this.image.src = src;
    }

    // --- 計算武器屬性 ---
    updateWeaponStats() {
        const constants = this.constants;

        // --- 菜刀屬性計算 (始終計算) ---
        const cleaverDmg = this.constants.CLEAVER_BASE_DAMAGE + (this.cleaverLevel - 1) * this.constants.CLEAVER_DAMAGE_INCREASE_PER_LEVEL;
        // 使用除法和 >1 的乘數來減少冷卻時間
        const cleaverCd = this.constants.CLEAVER_BASE_COOLDOWN / (this.constants.CLEAVER_COOLDOWN_MULTIPLIER ** (this.cleaverLevel - 1));
        const cleaverRange = this.constants.CLEAVER_RANGE; // 菜刀固定射程

        // 記錄滿級菜刀屬性
        if (this.cleaverLevel === this.constants.CLEAVER_MAX_LEVEL) {
            this.finalCleaverDamage = cleaverDmg;
            this.finalCleaverCooldown = cleaverCd;
        }

        // --- 弓箭屬性計算 (如果解鎖) ---
        let bowDmg = 0, bowCd = Infinity, bowRange = 0;
        if (this.bowUnlocked) {
            const bowBaseDmg = this.finalCleaverDamage; // 基於滿級菜刀
            const bowBaseCd = this.finalCleaverCooldown;
            bowDmg = bowBaseDmg + (this.bowLevel * constants.BOW_DAMAGE_INCREASE_PER_LEVEL);
            bowCd = bowBaseCd * (constants.BOW_COOLDOWN_MULTIPLIER ** this.bowLevel);
            bowRange = constants.BOW_BASE_RANGE + (this.bowLevel * constants.BOW_RANGE_INCREASE_PER_LEVEL);

            // --- 記錄滿級弓箭屬性 ---
            if (this.bowLevel === constants.BOW_MAX_LEVEL) {
                this.finalBowDamage = bowDmg;
                this.finalBowCooldown = bowCd;
                 // console.log(`Final Bow Stats: Dmg=${this.finalBowDamage.toFixed(1)}, CD=${this.finalBowCooldown.toFixed(0)}, Range=${this.finalBowRange.toFixed(0)}`);
            }
        }

        // --- 槍械屬性計算 (如果解鎖且有等級) ---
         let gunDmg = 0, gunCd = Infinity, gunRange = 0;
         if (this.gunUnlocked && this.gunLevel > 0) {
             // 確保滿級弓箭屬性已計算
             if (this.finalBowDamage === 0 && this.bowLevel === constants.BOW_MAX_LEVEL) {
                  // 如果剛升到滿級弓，立即計算最終屬性
                  const tempBowBaseDmg = this.finalCleaverDamage;
                  const tempBowBaseCd = this.finalCleaverCooldown;
                  this.finalBowDamage = tempBowBaseDmg + (constants.BOW_MAX_LEVEL * constants.BOW_DAMAGE_INCREASE_PER_LEVEL);
                  this.finalBowCooldown = tempBowBaseCd * (constants.BOW_COOLDOWN_MULTIPLIER ** constants.BOW_MAX_LEVEL);
                  this.finalBowRange = constants.BOW_BASE_RANGE + (constants.BOW_MAX_LEVEL * constants.BOW_RANGE_INCREASE_PER_LEVEL);
                  // console.log(`Immediately calculated Final Bow Stats on Gun unlock: Dmg=${this.finalBowDamage.toFixed(1)}, CD=${this.finalBowCooldown.toFixed(0)}, Range=${this.finalBowRange.toFixed(0)}`);
             }

             if(this.finalBowDamage > 0) { // 確保基於有效的滿級弓箭數據
                 const gunBaseDmg = this.finalBowDamage * constants.GUN_BASE_DAMAGE_MULTIPLIER; // 基礎傷害大幅提升
                 const gunBaseCd = this.finalBowCooldown; // 繼承滿級弓箭冷卻
                 gunDmg = gunBaseDmg + (this.gunLevel * constants.GUN_DAMAGE_INCREASE_PER_LEVEL);
                 gunCd = gunBaseCd * (constants.GUN_COOLDOWN_MULTIPLIER ** this.gunLevel);
                 gunRange = constants.GUN_BASE_RANGE + (this.gunLevel * constants.GUN_RANGE_INCREASE_PER_LEVEL);
             } else {
                 console.warn("計算槍械屬性時，滿級弓箭屬性尚未就緒！");
                 // 可以設置一個保底值，或者等待下次 updateWeaponStats
             }
         }

        // --- 計算等級提供的攻擊力加成 ---
        const levelAttackBonus = (this.level - 1) * constants.PLAYER_ATTACK_GAIN_PER_LEVEL;         


        // --- 最終應用屬性 (判斷當前武器並疊加等級加成) ---
        let baseWeaponDamage = 0; // 用於臨時儲存武器本身的傷害
        if (this.gunUnlocked && this.gunLevel > 0) {
            baseWeaponDamage = gunDmg; // 使用槍械計算的傷害
            this.attackCooldown = gunCd;
            this.attackRange = gunRange;
        } else if (this.bowUnlocked && this.bowLevel > 0) {
            baseWeaponDamage = bowDmg; // 使用弓箭計算的傷害
            this.attackCooldown = bowCd;
            this.attackRange = bowRange;
        } else if (this.cleaverLevel === constants.CLEAVER_MAX_LEVEL && this.bowUnlocked && this.bowLevel === 0) {
            baseWeaponDamage = this.finalCleaverDamage;
            this.attackCooldown = this.finalCleaverCooldown;
            this.attackRange = cleaverRange;
        } else {
            baseWeaponDamage = cleaverDmg; // 使用菜刀計算的傷害
            this.attackCooldown = cleaverCd;
            this.attackRange = cleaverRange;
        }

        // --- 疊加等級攻擊力加成 ---
        this.attackDamage = baseWeaponDamage + levelAttackBonus;
        // --- 結束疊加 ---

        // console.log(`Lv.${this.level} | WpnDmg:${baseWeaponDamage.toFixed(1)} LvlBonus:${levelAttackBonus} | Total Dmg:${this.attackDamage.toFixed(1)} | CD:${this.attackCooldown.toFixed(0)}ms | Range:${this.attackRange.toFixed(0)}`);
    }

    update(deltaTime, game) {
        if (this.hp <= 0) return;

        // --- 計時器更新
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
            if (this.attackTimer < 0) this.attackTimer = 0;
        }
        if (this.healingCooldown > 0) {
            this.healingCooldown -= deltaTime;
            if (this.healingCooldown < 0) this.healingCooldown = 0;
        }
        if (this.weaponUpgradeCooldown > 0) {
            this.weaponUpgradeCooldown -= deltaTime;
            if (this.weaponUpgradeCooldown < 0) this.weaponUpgradeCooldown = 0;
        }

        // --- 移動輸入
        let dx = 0, dy = 0;
        if (game.keysPressed['arrowup'] || game.keysPressed['w']) dy -= this.constants.PLAYER_SPEED;
        if (game.keysPressed['arrowdown'] || game.keysPressed['s']) dy += this.constants.PLAYER_SPEED;
        if (game.keysPressed['arrowleft'] || game.keysPressed['a']) dx -= this.constants.PLAYER_SPEED;
        if (game.keysPressed['arrowright'] || game.keysPressed['d']) dx += this.constants.PLAYER_SPEED;

        // --- 更新朝向和移動狀態 ---
        if (dx > 0) {
            this.facingRight = true;
        } else if (dx < 0) {
            this.facingRight = false;
        }
        // 如果 dx 為 0，保持之前的朝向

        this.isMoving = (dx !== 0 || dy !== 0);
        if (this.isMoving) {
            this.bobbingTimer += deltaTime;
        } else {
            this.bobbingTimer = 0; // 停止時重置計時器
        }

        // --- 應用移動
        const nextX = this.x + dx;
        const nextY = this.y + dy;
        this.x = Math.max(0, Math.min(game.constants.WORLD_WIDTH - this.width, nextX));
        this.y = Math.max(0, Math.min(game.constants.WORLD_HEIGHT - this.height, nextY));
        
        // --- 交互邏輯
        if (game.tradingPost && simpleCollisionCheck(this, game.tradingPost) && this.diamond > 0) { // 使用 diamond
            this.tradeDiamond(game);
        }
        // --- 建築互動提示邏輯 ---
        let inResearchLab = game.researchLab && simpleCollisionCheck(this, game.researchLab);
        let inHealingRoom = game.healingRoom && simpleCollisionCheck(this, game.healingRoom);

        if (inResearchLab) {
            const upgraded = this.handleResearchLabInteraction(game); // 嘗試升級
            let labMsg = "在研究室！";
             if (this.weaponUpgradeCooldown > 0) {
                 // labMsg += ` (升級冷卻: ${(this.weaponUpgradeCooldown / 1000).toFixed(1)}s)`;
             } else if (!this.bowUnlocked) {
                if (this.cleaverLevel < this.constants.CLEAVER_MAX_LEVEL) {
                    const cost = this.constants.CLEAVER_COSTS[this.cleaverLevel];
                    labMsg += ` 菜刀 Lv.${this.cleaverLevel} -> Lv.${this.cleaverLevel + 1} (${cost}G)`;
                    if (this.gold < cost) labMsg += " - 金幣不足";
                } else {
                    labMsg += ` 菜刀 已滿級！靠近解鎖 弓箭！`;
                }
            } else {
                if (this.bowLevel < this.constants.BOW_MAX_LEVEL) {
                    const cost = this.constants.BOW_COSTS[this.bowLevel];
                    labMsg += ` 弓箭 Lv.${this.bowLevel} -> Lv.${this.bowLevel + 1} (${cost}G)`;
                    if (this.gold < cost) labMsg += " - 金幣不足";
                } else {
                    labMsg += ` 弓箭 已滿級！`;
                }
            }
            // 只有在沒有其他消息顯示時，才短暫顯示通用消息
            if (game.messageTimer <= 0) {
                game.setMessage(labMsg, 500); // 短暫顯示通用信息
            }
        }

        if (inHealingRoom) {
            const healed = this.handleHealingRoomInteraction(game); // 嘗試治療
            // 治療成功 (+HP -G) 的消息現在由 handleHealingRoomInteraction 內部觸發
            if (!healed) { // 只有在 *未* 成功治療時，才顯示原因
                 const cost = 1 * this.constants.HEALING_COST_PER_HP;
                 let healMsg = "在治療室！"; // 基礎消息
                 if (this.hp >= this.maxHp) {
                    healMsg = "生命值已滿！";
                    game.setMessage(healMsg, 1000);
                 } else if (this.healingCooldown > 0) {
                    healMsg = `治療冷卻中: ${(this.healingCooldown / 1000).toFixed(1)}s`;
                    game.setMessage(healMsg, 500);
                 } else if (this.gold < cost) {
                    healMsg = `金幣不足無法治療 (需 ${cost}G)`;
                    game.setMessage(healMsg, 1000);
                 } else if (game.messageTimer <= 0) {
                     // 如果沒有其他消息（冷卻、已滿、不足），短暫顯示基礎消息
                     game.setMessage(healMsg, 500);
                 }
            }
        }

        // --- 自動攻擊 ---
        if (this.attackTimer <= 0) {
            let nearestEnemy = game.findNearestActiveEnemy(this, this.attackRange);
            if (nearestEnemy) {
                this.attack(nearestEnemy, game);
            }
        }
    }

    draw(ctx) {
        if (!this.active) return;
        // --- 繪製玩家圖片 (翻轉和跳動) ---
        if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
            ctx.save(); // 保存當前繪圖狀態 (重要!)

            // 計算跳動位移 (使用 sine 函數產生上下效果)
            const bobAmplitude = 2; // 跳動幅度 (像素)
            const bobFrequency = 180; // 跳動頻率 (數值越小越快)
            const bobOffset = this.isMoving ? Math.sin(this.bobbingTimer / bobFrequency) * bobAmplitude : 0;
            const drawY = this.y + bobOffset; // 應用垂直位移

            if (!this.facingRight) {
                // 如果朝左，進行翻轉
                // 1. 將原點移動到圖片的水平中心
                ctx.translate(this.x + this.width / 2, 0);
                // 2. 水平翻轉畫布
                ctx.scale(-1, 1);
                // 3. 在翻轉後的坐標系中繪製圖片，注意 X 坐標要設為負的寬度一半
                ctx.drawImage(this.image, -this.width / 2, drawY, this.width, this.height);
            } else {
                // 如果朝右，正常繪製
                ctx.drawImage(this.image, this.x, drawY, this.width, this.height);
            }

            ctx.restore(); // 恢復之前的繪圖狀態 (移除 translate 和 scale)
        } else {
            // 圖片未加載時的後備繪製
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

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

    takeDamage(damage, game) { // 確保接收 game 對象
        if (!this.active) return; // 如果玩家已經死亡則不處理

        // --- 安全區無敵檢查 ---
        const constants = this.constants; // 獲取常量
        const isInSafeZone = this.centerX < constants.SAFE_ZONE_WIDTH &&
                             this.centerY > constants.SAFE_ZONE_TOP_Y &&
                             this.centerY < constants.SAFE_ZONE_BOTTOM_Y;

        if (isInSafeZone) {
            // console.log("玩家在安全區內，傷害無效。"); // 可選的調試信息
            return; // 在安全區內，直接返回，不承受傷害
        }

        // 如果不在安全區內，則執行原有的傷害邏輯
        this.hp -= damage;
        if (this.hp < 0) this.hp = 0;

        // 注意：傷害數字的顯示移到 Enemy.update 中觸發，以確保傷害數值正確
    }

    tradeDiamond(game) { 
        const goldEarned = this.diamond * this.constants.diamond_VALUE;
        this.gold += goldEarned;
        game.setMessage(`用 ${this.diamond} 鑽石轉換 ${goldEarned} 金幣! (總金幣: ${this.gold})`, 2000);
        this.diamond = 0;
    }

    handleResearchLabInteraction(game) {
        const constants = this.constants;
        if (this.weaponUpgradeCooldown > 0) {
            return; // Still cooling down
        }

        // 1. 菜刀升級
        if (this.cleaverLevel < this.constants.CLEAVER_MAX_LEVEL) {
            const cost = this.constants.CLEAVER_COSTS[this.cleaverLevel];
            if (this.gold >= cost) {
                this.gold -= cost;
                this.cleaverLevel++;
                this.updateWeaponStats(); // Recalculate stats including cooldown
                game.setMessage(`菜刀 升級! Lv.${this.cleaverLevel} (花費 ${cost}G)`, 1500);
                this.weaponUpgradeCooldown = this.constants.WEAPON_UPGRADE_COOLDOWN;

                if (this.cleaverLevel === this.constants.CLEAVER_MAX_LEVEL) {
                    this.bowUnlocked = true;
                    this.updateWeaponStats(); // Update again after unlocking bow
                    game.setMessage(`菜刀 已滿級! 解鎖 弓箭！`, 2500);
                    console.log("弓箭 已解鎖!");
                }
                return; // Return after successful upgrade
            } else {
                // Insufficient gold message handled in update loop
            }
        }
        // 2. 弓箭升級
        else if (this.bowUnlocked && this.bowLevel < constants.BOW_MAX_LEVEL) {
            const cost = constants.BOW_COSTS[this.bowLevel];
            if (this.gold >= cost) {
                this.gold -= cost;
                this.bowLevel++;
                this.updateWeaponStats(); // 更新屬性，可能會觸發 finalBow 屬性記錄
                game.setMessage(`弓箭 升級! ${this.bowLevel}級 (花費 ${cost}G)`, 1500);
                this.weaponUpgradeCooldown = constants.WEAPON_UPGRADE_COOLDOWN;
 
                // --- 檢查是否解鎖槍械 ---
                if (this.bowLevel === constants.BOW_MAX_LEVEL) {
                    this.gunUnlocked = true;
                    // 注意：這裡再次調用 updateWeaponStats 是為了確保 finalBow 屬性被正確設置
                    // 即使 gunLevel 還是 0，也需要更新一次武器狀態計算流程
                    this.updateWeaponStats();
                    game.setMessage(`弓箭 已滿級! 解鎖 槍械！`, 2500);
                    console.log("槍械 已解鎖!");
                }
                // --- 結束槍械解鎖檢查 ---
                return; // Return after successful upgrade
            } // ... (else 金幣不足) ...
        }
        // --- 槍升級 ---
        else if (this.gunUnlocked && this.gunLevel < constants.GUN_MAX_LEVEL) {
             const cost = constants.GUN_COSTS[this.gunLevel];
             if (this.gold >= cost) {
                 this.gold -= cost;
                 this.gunLevel++;
                 this.updateWeaponStats(); // 更新屬性
                 game.setMessage(`槍械 升級! ${this.gunLevel}級 (花費 ${cost}G)`, 1500);
                 this.weaponUpgradeCooldown = constants.WEAPON_UPGRADE_COOLDOWN;
                 return; // Return after successful upgrade
             } // ... (else 金幣不足) ...
        }
    }

    handleHealingRoomInteraction(game) {
        if (this.healingCooldown > 0) {
            return false; // 冷卻
        }
        if (this.hp >= this.maxHp) {
            return false; // 生命值已滿
        }

        const healAmount = 10; // 每次治療 10 HP
        const goldCost = healAmount * this.constants.HEALING_COST_PER_HP;

        if (this.gold < goldCost) {
            return false; // 金幣不足
        }

        // 執行治療
        this.gold -= goldCost;
        this.hp += healAmount;
        this.hp = Math.min(this.hp, this.maxHp); // 確保 HP 不超過最大值
        this.healingCooldown = this.constants.HEALING_RATE; // 開始治療冷卻

        // Show confirmation message
        game.setMessage(`+${healAmount} HP (花費 ${goldCost}G)`, 1000);
        return true; // Healing was successful
    }

    attack(enemy, game) { // enemy 參數基本可以忽略了
        const constants = this.constants;

        // --- 優先檢查槍械 ---
        if (this.gunUnlocked && this.gunLevel > 0) {
            // --- 槍攻擊 ---
            let numBullets = 1; // 基礎值（理論上不會是1）

            // 計算弓箭滿級時的箭矢數
            const baseArrowsAtMaxBow = constants.BOW_MAX_LEVEL >= constants.BOW_MULTISHOT_START_LEVEL
                ? constants.BOW_MAX_LEVEL - constants.BOW_MULTISHOT_START_LEVEL + 2
                : 1;

            // 計算槍械的子彈數量：繼承弓箭滿級數量，並隨槍械等級增加
            // Gun Lv 1 = 繼承 Bow Lv 10 (7) + 0 = 7
            // Gun Lv 2 = 繼承 Bow Lv 10 (7) + 1 = 8
            // Gun Lv 10 = 繼承 Bow Lv 10 (7) + 9 = 16
            numBullets = baseArrowsAtMaxBow + this.gunLevel;

            // console.log(`Gun Lv.${this.gunLevel}, Base Arrows: ${baseArrowsAtMaxBow}, Total Bullets: ${numBullets}`); // 調試信息

            // 尋找目標並發射
            const targets = game.findMultipleEnemiesInRange(this, this.attackRange, numBullets); // 使用槍的 attackRange
            if (targets.length > 0) {
                targets.forEach(target => {
                    // 使用子彈，可以指定顏色或其他選項
                    game.addBullet(this, target, { color: '#FFA500' }); // 橙色子彈
                });
            } else {
                 // 如果範圍內沒敵人，可以選擇做點什麼，比如朝最近方向發射一發？
                 // 目前行為：不發射
            }
        }
        // 其次檢查弓箭
        else if (this.bowUnlocked && this.bowLevel > 0) {
            // --- 弓箭攻擊 (Multi-shot logic) ---
            let numArrows = 1;
            if (this.bowLevel >= constants.BOW_MULTISHOT_START_LEVEL) {
                numArrows = this.bowLevel - constants.BOW_MULTISHOT_START_LEVEL + 2;
            }

            if (numArrows > 1) {
                const targets = game.findMultipleEnemiesInRange(this, this.attackRange, numArrows);
                if (targets.length > 0) {
                    targets.forEach(target => game.addArrow(this, target));
                }
            } else {
                let nearestEnemy = game.findNearestActiveEnemy(this, this.attackRange);
                if (nearestEnemy) {
                    game.addArrow(this, nearestEnemy);
                }
            }
        }
        // 最後是菜刀
        else {
            // --- 菜刀攻擊 ---
            // 1. 找到範圍內最近的敵人 (使用菜刀的 attackRange)
            let targetEnemy = game.findNearestActiveEnemy(this, this.attackRange);

            // 2. 檢查是否找到了敵人 *並且* 這個敵人在攻擊範圍內
            if (targetEnemy) {
                 const damageDealt = this.attackDamage;
                 targetEnemy.takeDamage(damageDealt, game);
                 game.addDamageNumber(targetEnemy.centerX, targetEnemy.y, damageDealt, '#FFFFFF');
                 game.addSlashEffect(this, targetEnemy); // 對找到的目標觸發特效

            }
        }

        // 設置冷卻 (基於當前生效武器的 attackCooldown)
        this.attackTimer = this.attackCooldown;
    }

    collectTree(game) {
        let collected = false;
        let closestTreeDistSq = Infinity;
        let treeToCollect = null;
        const collectRangeSq = (this.width / 2 + game.constants.TILE_SIZE / 2 + 15) ** 2;

        game.trees.forEach((tree) => {
            if (!tree.active) return;
            const distSq = distanceSq(this, tree);
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
            const respawnDelay = game.constants.TREE_RESPAWN_TIME_MIN + Math.random() * (game.constants.TREE_RESPAWN_TIME_MAX - game.constants.TREE_RESPAWN_TIME_MIN);
            setTimeout(() => game.spawnTree(), respawnDelay); // Spawn a new tree after delay
        }
        return collected;
    }
}

// --- 敵人類 ---
class Enemy extends Entity {
    constructor(x, y, width, height, gameConstants, difficultyLevel, enemyType = 'normal', imageUrl = null) {
        // 使用默認顏色，後面會被圖片覆蓋
        super(x, y, width, height, enemyType === 'boss' ? 'darkred' : (enemyType === 'mini-boss' ? 'purple' : 'saddlebrown'));
        this.constants = gameConstants;
        this.difficultyLevel = difficultyLevel;
        this.enemyType = enemyType; // 'normal', 'mini-boss', 'boss'

        // --- 計算基礎的每級縮放 ---
        const levelFactor = this.difficultyLevel - 1; // 從 Level 1 開始，因子為 0
        const hpScale = 1 + levelFactor * this.constants.ENEMY_HP_SCALING_FACTOR;
        const dmgScale = 1 + levelFactor * this.constants.ENEMY_DAMAGE_SCALING_FACTOR;
        const diamondScale = 1 + levelFactor * this.constants.diamond_AWARD_SCALING_FACTOR;

        // --- 計算每 5 級的大幅提升 ---
        const boostTiers = Math.floor(this.difficultyLevel / 5);
        const boostMultiplier = (this.constants.ENEMY_BOOST_FACTOR_PER_5_LEVELS ** boostTiers);

        // --- 計算基礎屬性 ---
        const baseHp = this.constants.ENEMY_HP_BASE * hpScale * boostMultiplier;
        let baseDamage = this.constants.ENEMY_DAMAGE_BASE * dmgScale * boostMultiplier;
        const basediamond = this.constants.diamond_AWARD_BASE * diamondScale;

        // --- 根據敵人類型調整屬性 ---
        if (this.enemyType === 'mini-boss') {
            this.maxHp = Math.ceil(baseHp * this.constants.MINI_BOSS_HP_MULTIPLIER);
            this.damage = Math.ceil(baseDamage * this.constants.MINI_BOSS_DAMAGE_MULTIPLIER);
            this.diamondReward = Math.ceil(basediamond * 1.5); // 小王掉落多點鑽石
            this.speed = this.constants.ENEMY_SPEED_BASE * 0.9 + (Math.random() * 0.4 - 0.2); // 稍微慢一點
            this.color = 'purple'; // 以防圖片加載失敗
        } else if (this.enemyType === 'boss') {
            this.maxHp = Math.ceil(baseHp * this.constants.BOSS_HP_MULTIPLIER);
            this.damage = Math.ceil(baseDamage * this.constants.BOSS_DAMAGE_MULTIPLIER);
            this.diamondReward = Math.ceil(basediamond * 3); // 大王掉落多點鑽石
            this.speed = this.constants.ENEMY_SPEED_BASE * 0.8 + (Math.random() * 0.4 - 0.2); // 更慢一點
            this.color = 'darkred'; // 以防圖片加載失敗
        } else { // normal
            this.maxHp = Math.ceil(baseHp);
            this.damage = Math.ceil(baseDamage);
            this.diamondReward = Math.ceil(basediamond);
            this.speed = this.constants.ENEMY_SPEED_BASE + (Math.random() * 0.4 - 0.2);
        }
        this.hp = this.maxHp;

        // --- 計算經驗獎勵
        const baseXP = this.constants.XP_REWARD_BASE; 
        const levelMultiplier = Math.pow(this.constants.XP_REWARD_LEVEL_MULTIPLIER, this.difficultyLevel - 1);
        let bossMultiplier = 1;
        if (this.enemyType === 'mini-boss') {
            bossMultiplier = this.constants.XP_REWARD_MINI_BOSS_MULTIPLIER;
        } else if (this.enemyType === 'boss') {
            bossMultiplier = this.constants.XP_REWARD_BOSS_MULTIPLIER
        }
        this.xpReward = Math.ceil(baseXP * levelMultiplier * bossMultiplier);        

        // --- Boss 特殊攻擊計時器 ---
        this.threeSixtyAttackTimer = this.constants.MINI_BOSS_360_COOLDOWN + Math.random() * 500; // 初始隨機延遲
        this.targetedAttackTimer = this.constants.BOSS_TARGETED_COOLDOWN + Math.random() * 1000; // 初始隨機延遲

        this.attackCooldown = Math.random() * 1000;
        this.aiState = 'chasing';
        this.wanderTargetX = null;
        this.wanderTargetY = null;
        this.wanderTimer = 0;
        this.image = new Image();
        this.imageLoaded = false;
        // 使用傳入的 imageUrl，如果沒有則用默認的
        this.loadImage(imageUrl || this.constants.ENEMY_IMAGE_DATA_URL);
        this.setNewWanderTarget(this.constants);
    }    

    loadImage(src) {
        if (!src) { // 如果沒有提供 URL，則直接標記為已加載，使用顏色繪製
            console.warn(`敵人 ${this.enemyType} (Level ${this.difficultyLevel}) 未提供圖片 URL，將使用顏色繪製。`);
            this.imageLoaded = true;
            return;
        }
        this.image.onload = () => { this.imageLoaded = true; };
        this.image.onerror = () => {
            console.error(`載入敵人圖片錯誤 (${this.enemyType}): ${src}`);
            this.imageLoaded = true; // Treat error as loaded to not block game, will use fallback color
        };
        this.image.src = src;
    }

    update(deltaTime, game) {
        if (!this.active || !game.player || game.player.hp <= 0) return; // Also check if player is alive

        // --- Boss 特殊攻擊邏輯 ---
        if (this.enemyType === 'mini-boss' || this.enemyType === 'boss') {
            this.threeSixtyAttackTimer -= deltaTime;
            if (this.threeSixtyAttackTimer <= 0) {
                this.performThreeSixtyAttack(game);
                this.threeSixtyAttackTimer = this.constants.MINI_BOSS_360_COOLDOWN; // 重置冷卻
            }
        }
        if (this.enemyType === 'boss') {
            this.targetedAttackTimer -= deltaTime;
            if (this.targetedAttackTimer <= 0) {
                this.performTargetedAttack(game);
                this.targetedAttackTimer = this.constants.BOSS_TARGETED_COOLDOWN; // 重置冷卻
            }
        }

        const playerInSafeZone = game.player.centerX < game.constants.SAFE_ZONE_WIDTH &&
                                game.player.centerY > game.constants.SAFE_ZONE_TOP_Y &&
                                game.player.centerY < game.constants.SAFE_ZONE_BOTTOM_Y;
        const distToPlayerSq = distanceSq(this, game.player);

        // AI State Transition
        if (playerInSafeZone) {
            if (this.aiState === 'chasing') {
                this.aiState = 'wandering';
                this.setNewWanderTarget(game.constants);
            }
        } else {
            // Bosses always chase if player is not in safe zone
            if (this.enemyType === 'mini-boss' || this.enemyType === 'boss') {
                 this.aiState = 'chasing';
            } else if (this.aiState === 'wandering' && distToPlayerSq < game.constants.ENEMY_SIGHT_RANGE_SQ) {
                this.aiState = 'chasing';
            }
        }

        let moveTargetX, moveTargetY, currentSpeed;

        if (this.aiState === 'chasing') {
           moveTargetX = game.player.centerX;
           moveTargetY = game.player.centerY;
           currentSpeed = this.speed;

           // 近戰攻擊
           if (this.attackCooldown > 0) { this.attackCooldown -= deltaTime; if (this.attackCooldown < 0) this.attackCooldown = 0;}
           // Bosses might rely more on ranged attacks, but keep melee as fallback/close range
           if (this.attackCooldown <= 0 && simpleCollisionCheck(this, game.player, 5)) {
                const actualDamage = this.damage; // Get current damage
                game.player.takeDamage(actualDamage, game); // Pass game object
                this.attackCooldown = (this.enemyType === 'boss' ? 1500 : 1000) + Math.random() * 300; // Bosses attack slightly slower melee
                // *** 顯示敵人對玩家造成的傷害數字 (紅色) ***
                game.addDamageNumber(game.player.centerX, game.player.y, actualDamage, '#FF0000');
           }
       } else { // Wandering state (normal enemies only, bosses always chase outside safe zone)
           this.wanderTimer -= deltaTime;
           if (this.wanderTimer <= 0 || this.wanderTargetX === null || distanceSqValues(this.centerX, this.centerY, this.wanderTargetX, this.wanderTargetY) < (game.constants.TILE_SIZE * 1.5)**2 ) {
               this.setNewWanderTarget(game.constants);
           }
           if (this.wanderTargetX === null) this.setNewWanderTarget(game.constants); // Fallback
           moveTargetX = this.wanderTargetX;
           moveTargetY = this.wanderTargetY;
           currentSpeed = this.constants.ENEMY_WANDER_SPEED;
       }

        // Movement Logic
        if (moveTargetX !== null && moveTargetY !== null) {
            let dx = moveTargetX - this.centerX;
            let dy = moveTargetY - this.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const stopDistance = (this.aiState === 'chasing') ? (this.width / 2 + game.player.width / 2 - 5) : (this.constants.TILE_SIZE * 0.5);

            if (dist > stopDistance) {
                const moveX = (dx / dist) * currentSpeed;
                const moveY = (dy / dist) * currentSpeed;
                let nextX = this.x + moveX;
                let nextY = this.y + moveY;
                const nextCenterX = nextX + this.width / 2;
                const nextCenterY = nextY + this.height / 2;

                // Prevent entering safe zone
                if (nextCenterX < game.constants.SAFE_ZONE_WIDTH &&
                    nextCenterY > game.constants.SAFE_ZONE_TOP_Y &&
                    nextCenterY < game.constants.SAFE_ZONE_BOTTOM_Y)
                {
                    if (this.aiState === 'chasing') { // Stop at boundary if chasing
                        if (Math.abs(dx) > Math.abs(dy)) { // Primarily horizontal movement
                            nextX = game.constants.SAFE_ZONE_WIDTH - this.width / 2;
                        } else { // Primarily vertical movement
                           nextY = (dy < 0) ? (game.constants.SAFE_ZONE_BOTTOM_Y - this.height / 2) : (game.constants.SAFE_ZONE_TOP_Y - this.height / 2);
                        }
                    } else { // Change target if wandering into safe zone
                        this.setNewWanderTarget(game.constants);
                        nextX = this.x; nextY = this.y; // Don't move this frame
                    }
                }
                // Apply movement, clamped to world bounds
                this.x = Math.max(0, Math.min(game.constants.WORLD_WIDTH - this.width, nextX));
                this.y = Math.max(0, Math.min(game.constants.WORLD_HEIGHT - this.height, nextY));
            }
        }

        // Collision with Fences
        game.fences.forEach(fence => {
            if (fence.active && simpleCollisionCheck(this, fence)) {
                fence.takeDamage(Infinity); // Destroy fence instantly
            }
        });
    }

    // 執行 360 度全方位攻擊
    performThreeSixtyAttack(game) {
        console.log(`${this.enemyType} performs 360 attack`);
        const bulletCount = 12; // 發射 12 顆子彈
        const angleIncrement = (Math.PI * 2) / bulletCount;
        const bulletSpeed = this.constants.BOSS_BULLET_SPEED * 0.6; // 360度子彈稍慢
        const bulletDamage = this.damage * 0.4; // 360度子彈傷害較低
        const bulletColor = this.enemyType === 'boss' ? '#DA70D6' : '#FF8C00'; // Boss 紫色, Mini-boss 橙色

        for (let i = 0; i < bulletCount; i++) {
            const angle = i * angleIncrement;
            const directionDx = Math.cos(angle);
            const directionDy = Math.sin(angle);
            game.addBossProjectile(this, this.centerX, this.centerY, directionDx, directionDy, bulletSpeed, bulletDamage, bulletColor);
        }
    }

    // 執行朝向玩家的蓄力攻擊 (僅 Boss)
    performTargetedAttack(game) {
        if (!game.player || game.player.hp <= 0) return;
        console.log("Boss performs targeted attack");

        const bulletCount = this.constants.BOSS_TARGETED_BULLET_COUNT; // 發射 5 顆
        const bulletSpeed = this.constants.BOSS_BULLET_SPEED; // 速度較快
        const bulletDamage = this.damage * 0.6; // 傷害較高
        const bulletColor = '#FF4500'; // 橙紅色
        const spreadAngle = Math.PI / 18; // 子彈間的輕微散佈角度 (10度)

        const dx = game.player.centerX - this.centerX;
        const dy = game.player.centerY - this.centerY;
        const baseAngle = Math.atan2(dy, dx);

        for (let i = 0; i < bulletCount; i++) {
            // 計算每顆子彈的角度，從中間散開
            const currentAngle = baseAngle + (i - (bulletCount - 1) / 2) * spreadAngle;
            const directionDx = Math.cos(currentAngle);
            const directionDy = Math.sin(currentAngle);
            game.addBossProjectile(this, this.centerX, this.centerY, directionDx, directionDy, bulletSpeed, bulletDamage, bulletColor);
        }
    }    

    draw(ctx) {
        if (!this.active) return;
        if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // Fallback drawing with color if image fails or not loaded
             ctx.fillStyle = this.color;
             ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        this.drawHpBar(ctx);
    }

    drawHpBar(ctx) {
        const barY = this.y - 8;
        const barHeight = 4;
        const barWidth = this.width;
        const hpRatio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#444';
        ctx.fillRect(this.x, barY, barWidth, barHeight);
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(this.x, barY, barWidth * hpRatio, barHeight);
    }

    takeDamage(damage, game) {
        if (!this.active) return;
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false;
            if (game.player && game.player.active) { // 確保玩家存在且活躍
                // 掉落鑽石
                game.player.diamond += this.diamondReward;
                // Boss 擊殺給予金幣獎勵
                let goldReward = 0;
                if (this.enemyType === 'mini-boss') goldReward = 300;
                if (this.enemyType === 'boss') goldReward = 800;
                if (goldReward > 0) game.player.gold += goldReward;

                // --- 給予玩家經驗 ---
                game.player.gainXp(this.xpReward, game);

                // 顯示擊殺消息
                game.setMessage(`擊殺 ${this.enemyType}! +${this.diamondReward} 💎 ${goldReward > 0 ? ('+' + goldReward + 'G') : ''} (+${this.xpReward} XP)`, 1500);
            }
        }
    }

    setNewWanderTarget(constants) {
        const maxAttempts = 10;
        let attempts = 0;
        let targetX, targetY;
        do {
            targetX = Math.random() * constants.WORLD_WIDTH;
            targetY = Math.random() * constants.WORLD_HEIGHT;
            attempts++;
        } while (
            targetX < constants.SAFE_ZONE_WIDTH &&
            targetY > constants.SAFE_ZONE_TOP_Y &&
            targetY < constants.SAFE_ZONE_BOTTOM_Y &&
            attempts < maxAttempts
        );

        if (targetX < constants.SAFE_ZONE_WIDTH && targetY > constants.SAFE_ZONE_TOP_Y && targetY < constants.SAFE_ZONE_BOTTOM_Y) {
            targetX = constants.SAFE_ZONE_WIDTH + Math.random() * (constants.WORLD_WIDTH - constants.SAFE_ZONE_WIDTH);
        }
        this.wanderTargetX = targetX;
        this.wanderTargetY = targetY;
        this.wanderTimer = constants.ENEMY_WANDER_CHANGE_DIR_TIME + Math.random() * 2000;
    }
}

// --- 樹木類 ---
class Tree extends Entity {
    constructor(x, y, width, height, gameConstants) {
        super(x, y, width, height);
        this.constants = gameConstants;
        // this.colorTrunk = '#A0522D';
        // this.colorLeaves = '#228B22';
        this.image = new Image();
        this.imageLoaded = false;
        this.loadImage(this.constants.TREE_IMAGE_URL);        
    }

    loadImage(src) {
        if (!src) {
            console.warn("樹木圖片 URL 未定義，將使用後備繪製。");
            this.imageLoaded = true; // 標記為已處理
            return;
        }
        this.image.onload = () => { this.imageLoaded = true; };
        this.image.onerror = () => {
            console.error(`載入樹木圖片錯誤: ${src}`);
            this.imageLoaded = true; // 視為已處理，使用後備
        };
        this.image.src = src;
    }

    draw(ctx) {
        if (!this.active) return;

        if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
            // --- 繪製圖片 ---
            // 保持原始圖片比例繪製，或者根據需要調整 this.width 和 this.height
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // --- 後備繪製 (如果圖片加載失敗或未提供) ---
            // 繪製一個簡單的棕色矩形代表樹幹
            ctx.fillStyle = '#8B4513'; // SaddleBrown
            ctx.fillRect(this.x + this.width * 0.3, this.y + this.height * 0.4, this.width * 0.4, this.height * 0.6);
            // 繪製一個簡單的綠色圓形代表樹冠
            ctx.fillStyle = '#228B22'; // ForestGreen
            ctx.beginPath();
            ctx.arc(this.centerX, this.y + this.height * 0.3, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
// --- 建築基類 ---
class Structure extends Entity {
    constructor(x, y, width, height, color, hp = Infinity) {
        super(x, y, width, height, color);
        this.hp = hp;
        this.maxHp = hp;
    }
    takeDamage(damage) {
        if (!this.active) return;
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false;
        }
    }
}
// --- 圍欄類 ---
class Fence extends Structure {
    constructor(x, y, width, height, gameConstants) {
        super(x, y, width, height, '#CD853F', 50);
        this.constants = gameConstants;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x + 2, this.y + this.height * 0.3); ctx.lineTo(this.x + this.width - 2, this.y + this.height * 0.3);
        ctx.moveTo(this.x + 2, this.y + this.height * 0.7); ctx.lineTo(this.x + this.width - 2, this.y + this.height * 0.7);
        ctx.stroke();
        ctx.strokeStyle = '#654321'; ctx.lineWidth = 2;
        ctx.strokeRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);
    }
}
// --- 防禦塔類 ---
class Tower extends Structure {
    constructor(x, y, width, height, gameConstants) {
        super(x, y, width, height, '#A9A9A9', 100);
        this.constants = gameConstants;
        this.range = this.constants.TOWER_RANGE;
        this.fireRate = this.constants.TOWER_FIRE_RATE;
        this.fireCooldown = Math.random() * this.fireRate;
    }
    update(deltaTime, game) {
        if (!this.active) return;
        this.fireCooldown -= deltaTime;
        if (this.fireCooldown <= 0) {
            let targetEnemy = game.findNearestActiveEnemy(this, this.range);
            if (targetEnemy) {
                this.shoot(targetEnemy, game);
                this.fireCooldown = this.fireRate + (Math.random() * 200 - 100);
            } else {
                this.fireCooldown = this.fireRate * 0.1; // Check less often if no target
            }
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#696969';
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.width / 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
    shoot(target, game) {
        game.addBullet(this, target); // Bullet logic handles damage number
    }
}
// --- 子彈類 ---
class Bullet extends Entity {
    constructor(x, y, target, shooter, gameConstants, options = {}) {
        const defaultRadius = 4;
        super(x - defaultRadius, y - defaultRadius, defaultRadius * 2, defaultRadius * 2); // x, y 是中心點
        this.radius = defaultRadius;
        this.constants = gameConstants;
        this.shooter = shooter;
        this.target = target; // 可能為 null

        // --- 解析選項 ---
        this.homing = options.homing !== undefined ? options.homing : true; // 默認追蹤
        this.speed = options.speed || (this.homing ? this.constants.BULLET_SPEED : this.constants.BOSS_BULLET_SPEED);
        this.damage = options.damage || ((shooter instanceof Player) ? shooter.attackDamage : this.constants.BULLET_DAMAGE);
        this.color = options.color || ((shooter instanceof Player) ? '#9ACD32' : (shooter instanceof Tower ? '#FF4500' : 'gray')); // 默認敵人子彈灰色
        this.direction = options.direction || null; // {dx, dy}，歸一化向量
        this.lifeTime = options.lifeTime || 5000; // 子彈最大存活時間 (ms)
        this.spawnTime = performance.now();

        // --- 修正初始位置，使 x, y 成為矩形左上角 ---
        this.x = x - this.radius;
        this.y = y - this.radius;

        this.prevX = this.x;
        this.prevY = this.y;

        // 如果是非追蹤且沒有提供方向，則隨機一個方向（不應該發生）
        if (!this.homing && !this.direction) {
            console.warn("非追蹤子彈未提供方向，將隨機設定！");
            const randomAngle = Math.random() * Math.PI * 2;
            this.direction = { dx: Math.cos(randomAngle), dy: Math.sin(randomAngle) };
        }
    }

    update(deltaTime, game) {
        if (!this.active) return;
        this.prevX = this.x;
        this.prevY = this.y;

        // --- 生存時間檢查 ---
        if (performance.now() - this.spawnTime > this.lifeTime) {
            this.active = false;
            return;
        }

        let moveX = 0;
        let moveY = 0;
        const moveAmount = this.speed * (deltaTime / 16.67); // 基於 60 FPS 的移動量

        // --- 移動邏輯 ---
        if (this.homing && this.target && this.target.active) {
            // 追蹤目標
            const targetCenterX = this.target.centerX;
            const targetCenterY = this.target.centerY;
            const dx = targetCenterX - (this.x + this.radius);
            const dy = targetCenterY - (this.y + this.radius);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 1) { // 避免除以零
                moveX = (dx / dist) * moveAmount;
                moveY = (dy / dist) * moveAmount;
            }
        } else if (!this.homing && this.direction) {
            // 直線飛行
            moveX = this.direction.dx * moveAmount;
            moveY = this.direction.dy * moveAmount;
        } else {
            // 沒有目標/方向 或 目標失效 -> 直線飛行或停止? 這裡讓它繼續直線飛
            if (this.direction) {
                 moveX = this.direction.dx * moveAmount;
                 moveY = this.direction.dy * moveAmount;
            } else {
                this.active = false; // 沒有方向，直接消失
                return;
            }
        }

        // 計算下一步的位置
        const nextX = this.x + moveX;
        const nextY = this.y + moveY;
        const nextCenterX = nextX + this.radius;
        const nextCenterY = nextY + this.radius;

        // --- 安全區阻擋敵人遠程攻擊 ---
        if (this.shooter instanceof Enemy) { // 僅阻擋敵人發射的子彈
            const constants = this.constants;
            const projectileWillEnterSafeZone = nextCenterX < constants.SAFE_ZONE_WIDTH &&
                                               nextCenterY > constants.SAFE_ZONE_TOP_Y &&
                                               nextCenterY < constants.SAFE_ZONE_BOTTOM_Y;

            // 確保子彈是從外部進入安全區，而不是在安全區邊界內生成並移動
            const wasOutsideSafeZone = !(this.prevX + this.radius < constants.SAFE_ZONE_WIDTH &&
                                          this.prevY + this.radius > constants.SAFE_ZONE_TOP_Y &&
                                          this.prevY + this.radius < constants.SAFE_ZONE_BOTTOM_Y);

            if (projectileWillEnterSafeZone && wasOutsideSafeZone) {
                // console.log("敵方子彈試圖進入安全區，已被銷毀。"); // 可選調試信息
                this.active = false; // 銷毀子彈
                return; // 停止處理此子彈的後續邏輯（移動、碰撞）
            }
        }

        // 如果子彈未被銷毀，則更新位置
        this.x = nextX;
        this.y = nextY;

        // --- 碰撞檢測 ---
        let collisionOccurred = false;
        if (this.shooter instanceof Player || this.shooter instanceof Tower) {
            // 玩家或塔的子彈，檢查是否擊中敵人
            if (this.target && this.target.active && this.target instanceof Enemy) { // 確保目標是敵人
                const hitThreshold = this.radius + (this.target.width / 3); // 碰撞半徑
                 if (distanceSqValues(this.centerX, this.centerY, this.target.centerX, this.target.centerY) < hitThreshold * hitThreshold) {
                    const damageDealt = this.damage;
                    this.target.takeDamage(damageDealt, game);
                    collisionOccurred = true;
                    // 顯示傷害數字 (由玩家或塔發射)
                    game.addDamageNumber(this.target.centerX, this.target.y, damageDealt, this.color);
                 }
            } else if (this.homing) {
                 // 如果是追蹤彈但目標失效，也讓其失效
                 // this.active = false; // Or let it fly off screen
            }
        } else if (this.shooter instanceof Enemy) {
            // 敵人的子彈，檢查是否擊中玩家
            if (game.player && game.player.active && game.player.hp > 0) {
                const hitThreshold = this.radius + (game.player.width / 3);
                if (distanceSqValues(this.centerX, this.centerY, game.player.centerX, game.player.centerY) < hitThreshold * hitThreshold) {
                    const damageDealt = this.damage;
                    game.player.takeDamage(damageDealt, game);
                    collisionOccurred = true;
                    // 顯示傷害數字 (敵人命中玩家，紅色)
                    game.addDamageNumber(game.player.centerX, game.player.y, damageDealt, '#FF0000');
                }
            }
        }

        if (collisionOccurred) {
            this.active = false;
            return;
        }

        // --- 邊界檢測 ---
        const margin = this.radius * 2;
        if (this.x < -margin || this.x > game.constants.WORLD_WIDTH + margin ||
            this.y < -margin || this.y > game.constants.WORLD_HEIGHT + margin) {
            this.active = false;
        }
    }

    draw(ctx) { // 基本不變
        if (!this.active) return;
        // Draw trail (保持不變)
        if (this.prevX !== undefined && this.prevY !== undefined && (this.x !== this.prevX || this.y !== this.prevY)) {
            ctx.save();
            const trailColorAlpha = (this.shooter instanceof Player) ? `rgba(154, 205, 50, ${this.constants.BULLET_TRAIL_OPACITY})`
                                  : (this.shooter instanceof Tower ? `rgba(255, 69, 0, ${this.constants.BULLET_TRAIL_OPACITY})`
                                  : `rgba(${this.hexToRgb(this.color)}, ${this.constants.BULLET_TRAIL_OPACITY * 0.8})`); // 敵人子彈用自己的顏色
            ctx.strokeStyle = trailColorAlpha;
            ctx.lineWidth = this.radius * 1.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.prevX + this.radius, this.prevY + this.radius);
            ctx.lineTo(this.x + this.radius, this.y + this.radius);
            ctx.stroke();
            ctx.restore();
        }
        // Draw bullet (保持不變)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.radius, this.y + this.radius, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
     // 輔助函數：將十六進制顏色轉為 RGB 字符串 (用於 rgba)
     hexToRgb(hex) {
        let r = 0, g = 0, b = 0;
        if (hex.startsWith('#')) { hex = hex.slice(1); } // Remove # if present
        if (hex.length == 3) {
            r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length == 6) {
            r = parseInt(hex[0] + hex[1], 16); g = parseInt(hex[2] + hex[3], 16); b = parseInt(hex[4] + hex[5], 16);
        } else { return '128, 128, 128'; /* Default gray */ } // Default to gray if format is wrong
        return `${r}, ${g}, ${b}`;
    }
}

// --- 劈砍特效類 ---
class SlashEffect {
    constructor(attacker, target, gameConstants) {
        this.constants = gameConstants;
        const attackerCenterX = attacker.centerX;
        const attackerCenterY = attacker.centerY;
        const targetCenterX = target.centerX;
        const targetCenterY = target.centerY;
        const dx = targetCenterX - attackerCenterX;
        const dy = targetCenterY - attackerCenterY;
        const angle = Math.atan2(dy, dx);
        const effectLength = this.constants.TILE_SIZE * 1.5;
        const startDist = attacker.width / 2;
        this.startX = attackerCenterX + Math.cos(angle) * startDist;
        this.startY = attackerCenterY + Math.sin(angle) * startDist;
        this.endX = this.startX + Math.cos(angle) * effectLength;
        this.endY = this.startY + Math.sin(angle) * effectLength;
        this.startTime = performance.now();
        this.duration = this.constants.SLASH_EFFECT_DURATION;
        this.lineWidth = 4;
        this.active = true;
    }
    update(deltaTime) {
        if (!this.active) return;
        if (performance.now() - this.startTime > this.duration) {
            this.active = false;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        const elapsed = performance.now() - this.startTime;
        const progress = elapsed / this.duration;
        if (progress >= 1 || progress < 0) { this.active = false; return; }

        const alpha = 0.9 * (1 - progress);
        const currentLineWidth = Math.max(1, this.lineWidth * (1 - progress * 0.7));
        const interpFactor = 0.5 + progress * 0.5;
        const currentEndX = this.startX + (this.endX - this.startX) * interpFactor;
        const currentEndY = this.startY + (this.endY - this.startY) * interpFactor;

        if (isNaN(this.startX) || isNaN(this.startY) || isNaN(currentEndX) || isNaN(currentEndY) || isNaN(alpha) || isNaN(currentLineWidth)) {
            console.error("繪製劈砍特效時數據無效:", this, alpha, currentLineWidth); this.active = false; return;
        }
        ctx.save();
        try {
            ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`; ctx.lineWidth = currentLineWidth; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(this.startX, this.startY); ctx.lineTo(currentEndX, currentEndY); ctx.stroke();
        } catch (e) { console.error("繪製劈砍特效時出錯:", e, this); this.active = false; }
        finally { ctx.restore(); }
    }
}
// --- 箭矢類 ---
class Arrow extends Entity {
    constructor(x, y, target, shooter, gameConstants) {
        super(x, y, gameConstants.ARROW_LENGTH, 5, '#8B4513');
        this.constants = gameConstants; this.target = target; this.shooter = shooter;
        this.speed = this.constants.ARROW_SPEED; this.damage = shooter.attackDamage;
        this.length = gameConstants.ARROW_LENGTH; this.tipX = x; this.tipY = y;
        this.angle = 0; this.headColor = '#A9A9A9';
    }
    update(deltaTime, game) {
        if (!this.active) return;
        if (!this.target || !this.target.active) { this.active = false; return; }

        const targetCenterX = this.target.centerX; const targetCenterY = this.target.centerY;
        const dx = targetCenterX - this.tipX; const dy = targetCenterY - this.tipY;
        const dist = Math.sqrt(dx * dx + dy * dy); this.angle = Math.atan2(dy, dx);
        const hitThreshold = this.length * 0.2 + (this.target.width / 3);

        if (dist < hitThreshold) {
            const damageDealt = this.damage; // Store damage
            this.target.takeDamage(damageDealt, game);
            this.active = false;
            // *** 顯示傷害數字 (黃綠色) ***
            game.addDamageNumber(this.target.centerX, this.target.y, damageDealt, '#9ACD32');
        } else {
            const moveX = (dx / dist) * this.speed; const moveY = (dy / dist) * this.speed;
            this.tipX += moveX; this.tipY += moveY;
            this.x = this.tipX - (this.length / 2) * Math.cos(this.angle);
            this.y = this.tipY - (this.length / 2) * Math.sin(this.angle);
        }
        const margin = this.length * 2;
        if (this.tipX < -margin || this.tipX > game.constants.WORLD_WIDTH + margin ||
            this.tipY < -margin || this.tipY > game.constants.WORLD_HEIGHT + margin) {
            this.active = false;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2); ctx.rotate(this.angle);
        ctx.strokeStyle = this.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-this.length / 2, 0); ctx.lineTo(this.length / 2, 0); ctx.stroke(); // Shaft
        ctx.strokeStyle = this.headColor; ctx.lineWidth = 2.5; const headLength = this.length * 0.25; const headAngle = Math.PI / 6; ctx.beginPath(); ctx.moveTo(this.length / 2, 0); ctx.lineTo(this.length / 2 - headLength * Math.cos(headAngle), -headLength * Math.sin(headAngle)); ctx.moveTo(this.length / 2, 0); ctx.lineTo(this.length / 2 - headLength * Math.cos(headAngle), headLength * Math.sin(headAngle)); ctx.stroke(); // Head
        ctx.restore();
    }
}

// --- 傷害數字類 ---
class DamageNumber {
    constructor(x, y, amount, color = 'white', gameConstants) {
        this.x = x + (Math.random() * 10 - 5); // 輕微隨機水平偏移
        this.y = y;
        this.amount = amount;
        this.color = color; // 可以根據傷害來源不同設置顏色
        this.constants = gameConstants; // 雖然沒用到，但保留結構一致性
        this.startTime = performance.now();
        this.duration = 800; // 持續時間 (ms)
        this.ySpeed = -0.05; // 向上漂浮速度 (像素/毫秒)
        this.active = true;
        this.initialFontSize = 16; // 初始字體大小
    }

    update(deltaTime) {
        if (!this.active) return;

        const elapsed = performance.now() - this.startTime;
        if (elapsed > this.duration) {
            this.active = false;
            return;
        }

        // 向上移動
        this.y += this.ySpeed * deltaTime;
    }

    draw(ctx) {
        if (!this.active) return;

        const elapsed = performance.now() - this.startTime;
        const progress = elapsed / this.duration; // 0 to 1

        // 計算透明度 (後半段開始淡出)
        let alpha = 1.0;
        if (progress > 0.5) {
            alpha = 1.0 - ((progress - 0.5) * 2);
        }
        alpha = Math.max(0, Math.min(1, alpha)); // Clamp alpha between 0 and 1

        // 計算字體大小
        const fontSize = this.initialFontSize;

        ctx.save();
        ctx.font = `bold ${fontSize}px 'Nunito', sans-serif`;
        ctx.fillStyle = `rgba(${this.hexToRgb(this.color)}, ${alpha})`; // 使用傳入的顏色和計算的透明度
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom'; // 讓數字從指定 y 向上顯示

        // 添加陰影提高可讀性
        ctx.shadowColor = `rgba(0, 0, 0, ${alpha * 0.7})`;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.shadowBlur = 2;

        ctx.fillText(Math.round(this.amount), this.x, this.y); // 顯示整數傷害

        ctx.restore();
    }

    // 輔助函數：將十六進制顏色轉為 RGB 字符串 (用於 rgba)
    hexToRgb(hex) {
        let r = 0, g = 0, b = 0;
        if (hex.startsWith('#')) { hex = hex.slice(1); } // Remove # if present
        if (hex.length == 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length == 6) {
            r = parseInt(hex[0] + hex[1], 16);
            g = parseInt(hex[2] + hex[3], 16);
            b = parseInt(hex[4] + hex[5], 16);
        } else {
            // Default to white if format is wrong
            return '255, 255, 255';
        }
        return `${r}, ${g}, ${b}`;
    }
}

// --- 商店類 ---
class Shop extends Structure {
    constructor(x, y, width, height, color, type) {
        super(x, y, width, height, color);
        this.type = type;
    }
    draw(ctx, game) {
        if (!this.active || !game || !game.constants || !game.player) return; // 增加 game 和 player 的檢查
        const constants = game.constants;
        const player = game.player;

        // --- 繪製基礎方塊和邊框 ---
        super.draw(ctx);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.shadowBlur = 2;
        ctx.fillStyle = 'white'; // 所有文字都用白色
        ctx.textAlign = 'center';

        let titleText = "";     // 主標題
        let subtitleText = ""; // 副標題 (靠近...)
        let costText = "";      // 花費信息

        const titleY = this.y + 18; // 第一行 Y
        const subtitleY = this.y + 34; // 第二行 Y
        const costY = this.y + 50;   // 第三行 Y

        switch (this.type) {
            case 'trading_post':
                titleText = "交易站";
                subtitleText = "(鑽石 ➔ 金幣)";
                costText = `1 💎 = ${constants.diamond_VALUE} G`; // 顯示兌換比例
                break;

            case 'research_lab':
                titleText = "研究室";
                subtitleText = "(靠近自動升級)";
                if (player.weaponUpgradeCooldown > 0) {
                    costText = `冷卻: ${(player.weaponUpgradeCooldown / 1000).toFixed(1)}s`;
                } else if (player.cleaverLevel < constants.CLEAVER_MAX_LEVEL) {
                        const cost = constants.CLEAVER_COSTS[player.cleaverLevel];
                        costText = `🔪 Lv${player.cleaverLevel + 1}: ${cost} G`;
                } else if (!player.bowUnlocked) {
                    costText = "解鎖弓箭!";
                } else if (player.bowLevel < constants.BOW_MAX_LEVEL) {
                        const cost = constants.BOW_COSTS[player.bowLevel];
                        costText = `🏹 Lv${player.bowLevel + 1}: ${cost} G`;
                }
                // --- 顯示槍械升級費用 ---
                else if (!player.gunUnlocked) { // 弓箭滿級但槍未解鎖
                    costText = "解鎖槍械!"; // 理論上這個狀態很短暫
                }
                else if (player.gunLevel < constants.GUN_MAX_LEVEL) {
                    const cost = constants.GUN_COSTS[player.gunLevel];
                    costText = `🔫 Lv${player.gunLevel + 1}: ${cost} G`;
                }
                else {
                    costText = "武器已滿級"; // 所有武器都滿級了
                }
                break;

            case 'healing_room':
                titleText = "治療室";
                subtitleText = "(靠近自動治療)";
                // --- 顯示治療花費 ---
                // 根據你的代碼，是 healAmount(10) * costPerHp(10) = 100G 治療 10HP
                // 因此 10 G = 1 HP 或 1 HP = 10 G
                const costPerHp = constants.HEALING_COST_PER_HP;
                costText = `1 HP = ${costPerHp} G`; // 顯示每點 HP 的花費
                 // 或者你想顯示 1G 能買多少 HP:
                 // const hpPerGold = 1 / constants.HEALING_COST_PER_HP;
                 // costText = `1 G = ${hpPerGold.toFixed(1)} HP`;
                break;

            // case 'weapon_shop': // 如果有武器店的話
            //     titleText = "武器店";
            //     subtitleText = "(功能待定)";
            //     costText = "敬請期待";
            //     break;
        }

        // --- 繪製文字 ---
        ctx.font = "bold 14px 'Nunito', sans-serif"; // 標題字體
        ctx.fillText(titleText, this.centerX, titleY);

        ctx.font = "11px 'Nunito', sans-serif"; // 副標題字體
        ctx.fillText(subtitleText, this.centerX, subtitleY);

        // 繪製花費信息
        ctx.font = "bold 12px 'Nunito', sans-serif"; // 花費信息字體（加粗）
        ctx.fillStyle = '#FFD700'; // 花費信息用金色字體，更醒目
        ctx.fillText(costText, this.centerX, costY);

        ctx.restore();
    }
}

// --- 遊戲主類 ---
class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) { throw new Error(`找不到 ID 為 '${canvasId}' 的 Canvas 元素！`); }
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) { throw new Error("無法獲取 Canvas 的 2D 繪圖上下文！"); }
        this.constants = this.loadConstants();
        this.setCanvasSize();
        this.resetState();

        this.player = null; this.enemies = []; this.trees = []; this.fences = []; this.towers = [];
        this.bullets = []; this.arrows = []; this.slashEffects = [];
        this.damageNumbers = []; // <--- 存儲傷害數字的數組
        this.tradingPost = null; this.researchLab = null; this.weaponShop = null; this.healingRoom = null;
        this.keysPressed = {}; this.enemySpawnTimer = 0; this.gameRunning = false;
        this.messageTimer = 0; this.messageText = ''; this.lastTime = 0;
        this.listenersAttached = false; this.imagesToLoad = 0; this.imagesLoaded = 0;
        this.areImagesLoaded = false; this.camera = { x: 0, y: 0 };

        this.bossSpawnedForLevel = -1; // 記錄當前關卡是否已生成 Boss/Mini-Boss
    }

    loadConstants() {
        const TILE_SIZE = 40;
        const WORLD_HEIGHT = 1800;
        const shopHeight = TILE_SIZE * 2; const yBase = WORLD_HEIGHT / 2; const ySpacing = TILE_SIZE * 2.5;
        const topBuildingY = yBase - ySpacing; const bottomBuildingY = yBase + ySpacing + shopHeight; const verticalBuffer = TILE_SIZE * 2;

        const DIAMOND_AWARD_BASE = 1;
        const DIAMOND_VALUE = 4;
        const DIAMOND_AWARD_SCALING_FACTOR = 1.05;

        return {
            PLAYER_IMAGE_DATA_URL: 'https://lh3.googleusercontent.com/d/1EUKtxOBk2_gqWKWV3dPyNQec4wZGt3oH',
            ENEMY_IMAGE_DATA_URL: 'https://lh3.googleusercontent.com/d/1DBdId0qyQ71fGvsgw1IP1EfUZhjlvdYS',
            MINI_BOSS_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1pDCDVEk38jJswoy_r2l18zd3b2IY4k5U',
            BOSS_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1_Yfz7kU6GCg28W5xFw7r3hi1pW67cZYb',
            TREE_IMAGE_URL: 'https://lh3.googleusercontent.com/d/18Dg-zoR7ImttNuvDpfaWucLP658spVE3',

            // --- 鏡頭縮放 ---
            CAMERA_ZOOM: 1.2, // 放大倍數，> 1 表示放大

            WORLD_WIDTH: 2400, WORLD_HEIGHT: WORLD_HEIGHT,
            get SAFE_ZONE_WIDTH() { const sw=TILE_SIZE*2; const sm=TILE_SIZE*2; const sb=TILE_SIZE*3; return sm+sw+sb; },
            get SAFE_ZONE_TOP_Y() { return topBuildingY - verticalBuffer; },
            get SAFE_ZONE_BOTTOM_Y() { return bottomBuildingY + verticalBuffer; },
            CANVAS_WIDTH: 1200, CANVAS_HEIGHT: 710,
            TILE_SIZE: TILE_SIZE, PLAYER_SPEED: 3,
            ENEMY_SPAWN_RATE_BASE: 1000, // 初始生成間隔縮短 (原為 1500)
            ENEMY_SPAWN_RATE_SCALE_PER_LEVEL: 0.80, // 每級生成速度提升幅度更大 (原為 0.97)
            MAX_ENEMIES_BASE: 30, // 初始最大敵人數量提高 (原為 15)
            MAX_ENEMIES_INCREASE_PER_LEVEL: 10, // 每級最大敵人數量增加更多 (原為 2)
            ENEMY_HP_BASE: 30,
            ENEMY_DAMAGE_BASE: 10,
            INITIAL_ENEMIES: 10, // 初始生成的敵人數量不變，但後續會更快更多
            ENEMY_WANDER_CHANGE_DIR_TIME: 3000,
            ENEMY_SIGHT_RANGE_SQ: (TILE_SIZE * 15) ** 2,
            ENEMY_COLLISION_DIST_SQ: (TILE_SIZE * 1.5) ** 2,
            SAFE_SPAWN_DIST_SQ: (TILE_SIZE * 10) ** 2,
            TIME_PER_DIFFICULTY_LEVEL: 10000, // 10秒升一級
            ENEMY_HP_SCALING_FACTOR: 0.12, // 每級HP增加12%
            ENEMY_DAMAGE_SCALING_FACTOR: 0.08, // 每級傷害增加8%
            ENEMY_BOOST_FACTOR_PER_5_LEVELS: 1.6, // 每5級屬性大幅提升倍數
            ENEMY_SPEED_BASE: 1.0, ENEMY_WANDER_SPEED: 0.5,
            TREE_RESPAWN_TIME_MIN: 7000, TREE_RESPAWN_TIME_MAX: 11000, INITIAL_TREES: 50,
            TOWER_RANGE: 180, TOWER_FIRE_RATE: 900,
            FENCE_COST: 1, TOWER_COST: 5,
            BULLET_DAMAGE: 12,            
            diamond_AWARD_BASE: DIAMOND_AWARD_BASE,
            diamond_VALUE: DIAMOND_VALUE,
            diamond_AWARD_SCALING_FACTOR: DIAMOND_AWARD_SCALING_FACTOR,

            // --- 玩家等級與經驗常量 ---
            PLAYER_INITIAL_LEVEL: 1,
            PLAYER_INITIAL_XP: 0,
            PLAYER_XP_BASE_REQ: 100,      // 升到 Lv2 所需基礎經驗
            PLAYER_XP_LEVEL_MULTIPLIER: 1.6, // 每級所需經驗的增長係數 (指數增長)
            PLAYER_HP_BASE: 150,          // 玩家基礎 HP (取代之前的 PLAYER_HP_MAX_UPGRADED)
            PLAYER_HP_GAIN_PER_LEVEL: 15,  // 每級增加 HP 上限
            PLAYER_ATTACK_GAIN_PER_LEVEL: 2, // 每級增加固定攻擊力 (疊加在武器傷害上)

            // --- 敵人經驗獎勵常量 ---
            XP_REWARD_BASE: 8,                // 普通敵人基礎經驗
            XP_REWARD_LEVEL_MULTIPLIER: 1.15, // 敵人每高一級，經驗增加的倍數
            XP_REWARD_MINI_BOSS_MULTIPLIER: 5, // Mini-Boss 經驗倍率 (基於同級普通怪)
            XP_REWARD_BOSS_MULTIPLIER: 20,    // Boss 經驗倍率 (基於同級普通怪)            

            // 菜刀屬性
            CLEAVER_MAX_LEVEL: 5,
            CLEAVER_BASE_DAMAGE: 16,
            CLEAVER_DAMAGE_INCREASE_PER_LEVEL: 5,
            CLEAVER_BASE_COOLDOWN: 600,
            CLEAVER_COOLDOWN_MULTIPLIER: 1.6,
            CLEAVER_RANGE: TILE_SIZE * 3.0,
            CLEAVER_COSTS: [0, 25, 60, 130, 250],

            // 弓箭屬性
            BOW_MAX_LEVEL: 10,
            BOW_DAMAGE_INCREASE_PER_LEVEL: 32,
            BOW_COOLDOWN_MULTIPLIER: 0.96,
            BOW_BASE_RANGE: TILE_SIZE * 5,
            BOW_RANGE_INCREASE_PER_LEVEL: TILE_SIZE * 0.55,
            BOW_COSTS: [
                200,    // Lv 0 -> 1
                400,    // Lv 1 -> 2
                800,   // Lv 2 -> 3
                1600,   // Lv 3 -> 4
                3200,   // Lv 4 -> 5
                4000,  // Lv 5 -> 6
                7200,  // Lv 6 -> 7
                9000,  // Lv 7 -> 8
                14000,  // Lv 8 -> 9
                20000   // Lv 9 -> 10
            ],
            BOW_MULTISHOT_START_LEVEL: 5, // <--- 從第 5 級開始多重射擊

            // 槍屬性
            GUN_MAX_LEVEL: 10,
            GUN_UNLOCK_AT_BOW_LEVEL: 10, // 明确解鎖等級
            GUN_BASE_DAMAGE_MULTIPLIER: 3.0, // +200% 基礎傷害 (相對於滿級弓箭)
            GUN_DAMAGE_INCREASE_PER_LEVEL: 68, // 每級增加固定傷害值 (需要平衡)
            GUN_COOLDOWN_MULTIPLIER: 0.90,   // 每級稍微提升攻速 (需要平衡)
            GUN_BASE_RANGE: TILE_SIZE * 6.5, // 示例值：比基礎弓遠一點
            GUN_RANGE_INCREASE_PER_LEVEL: TILE_SIZE * 0.3, // 每級微量增加射程
            // 槍械升級費用 (示例，需要仔細平衡！)
            GUN_COSTS: [
                 30000,   50000,   80000,  120000,  180000, // Lv 0-5
                250000,  350000,  500000,  700000, 1000000  // Lv 5-10
            ],            

            HEALING_COST_PER_HP: 1, HEALING_RATE: 200,
            WEAPON_UPGRADE_COOLDOWN: 2000,
            ARROW_SPEED: 8, ARROW_LENGTH: TILE_SIZE * 0.8,
            BULLET_SPEED: 10, BULLET_TRAIL_OPACITY: 0.4,
            SLASH_EFFECT_DURATION: 150,

            // --- Boss 相關常量 ---
            MINI_BOSS_HP_MULTIPLIER: 4.0, // 小王血量倍率
            MINI_BOSS_DAMAGE_MULTIPLIER: 1.0, // 小王傷害倍率
            BOSS_HP_MULTIPLIER: 30.0,      // 大王血量倍率
            BOSS_DAMAGE_MULTIPLIER: 1.5,   // 大王傷害倍率
            MINI_BOSS_360_COOLDOWN: 3200,  // 360度攻擊冷卻 (ms)
            BOSS_TARGETED_COOLDOWN: 2200, // 指向性攻擊冷卻 (ms)
            BOSS_BULLET_SPEED: 7,        // Boss 子彈速度
            BOSS_TARGETED_BULLET_COUNT: 5 // Boss 指向性攻擊的子彈數量
        };
    }

    setCanvasSize() {
        this.canvas.width = this.constants.CANVAS_WIDTH;
        this.canvas.height = this.constants.CANVAS_HEIGHT;
    }

    init() {
        console.log("初始化遊戲...");
        this.resetState();
        this.setupShops();
        this.spawnInitialEntities();
        this.loadGameImages();
        this.attachListeners();
        console.log("遊戲初始化序列完成。等待圖片載入...");
    }

    resetState() {
        this.enemies = []; this.trees = []; this.fences = []; this.towers = [];
        this.bullets = []; this.arrows = []; this.slashEffects = [];
        this.damageNumbers = []; // <--- 重置時清空
        this.keysPressed = {}; this.enemySpawnTimer = 0; this.messageText = '';
        this.messageTimer = 0; this.imagesLoaded = 0; this.areImagesLoaded = false;
        this.gameRunning = false; this.camera = { x: 0, y: 0 };
        this.tradingPost = null; this.researchLab = null; this.weaponShop = null; this.healingRoom = null;
        this.elapsedGameTime = 0; this.difficultyLevel = 1;
        this.bossSpawnedForLevel = -1; // 重置 Boss 生成標記
        console.log("Game state reset. Difficulty Level: 1");
    }

    setupShops() {
        const TILE_SIZE = this.constants.TILE_SIZE;
        const shopMargin = TILE_SIZE * 2; const shopWidth = TILE_SIZE * 2; const shopHeight = TILE_SIZE * 2;
        const yBase = this.constants.WORLD_HEIGHT / 2; const ySpacing = TILE_SIZE * 2.5; const shopX = shopMargin;
        this.tradingPost = new Shop(shopX, yBase - ySpacing, shopWidth, shopHeight, '#FFD700', 'trading_post');
        this.researchLab = new Shop(shopX, yBase, shopWidth, shopHeight, '#B22222', 'research_lab');
        this.healingRoom = new Shop(shopX, yBase + ySpacing, shopWidth, shopHeight, '#90EE90', 'healing_room');
        console.log(`商店/設施已設置。安全區寬度: ${this.constants.SAFE_ZONE_WIDTH}`);
    }

    spawnInitialEntities() {
        const shopMargin = this.constants.TILE_SIZE * 2;
        const shopWidth = this.constants.TILE_SIZE * 2;
        const shopAreaEndX = shopMargin + shopWidth;
        const targetPlayerCenterX = shopAreaEndX + (this.constants.SAFE_ZONE_WIDTH - shopAreaEndX) / 2;
        const targetPlayerCenterY = this.constants.WORLD_HEIGHT / 2;
        const playerSize = this.constants.TILE_SIZE;
        const playerStartX = targetPlayerCenterX - (playerSize / 2);
        const playerStartY = targetPlayerCenterY - (playerSize / 2);

        this.player = new Player(playerStartX, playerStartY, playerSize, playerSize, this.constants);
        console.log(`Player spawned at: (${playerStartX.toFixed(0)}, ${playerStartY.toFixed(0)})`);

        for (let i = 0; i < this.constants.INITIAL_TREES; i++) { this.spawnTree(true); }
        for (let i = 0; i < this.constants.INITIAL_ENEMIES; i++) {
            this.spawnEnemy(true, 1, 'normal'); // 強制初始為 normal
        }
    }

    loadGameImages() {
        console.log("載入遊戲圖片...");
        this.imagesToLoad = 0;
        this.imagesLoaded = 0;
        let imagesStatus = { player: false, enemy: false, miniBoss: false, boss: false, tree: false };
        const urls = {
            player: this.constants.PLAYER_IMAGE_DATA_URL,
            enemy: this.constants.ENEMY_IMAGE_DATA_URL,
            miniBoss: this.constants.MINI_BOSS_IMAGE_URL,
            boss: this.constants.BOSS_IMAGE_URL,
            tree: this.constants.TREE_IMAGE_URL
        };

        // 玩家圖片加載
        if (this.player && this.player.image && urls.player) {
            this.imagesToLoad++; // 需要加載玩家圖片
            this.player.image.onload = () => { console.log("玩家圖片載入成功"); imagesStatus.player = true; this.player.imageLoaded = true; this.imageLoadCallback(); };
            this.player.image.onerror = () => { console.error(`載入玩家圖片錯誤: ${urls.player}`); imagesStatus.player = true; this.player.imageLoaded = true; this.imageLoadCallback(); /* 錯誤也算完成 */ };
            this.player.image.src = urls.player;
            // 檢查緩存 (確保回調也被觸發) - 使用 setTimeout 避免同步問題
            if (this.player.image.complete && this.player.image.naturalWidth > 0) {
                console.log("玩家圖片已緩存");
                 setTimeout(() => {
                     if (!imagesStatus.player) { // 如果 onload/onerror 還沒觸發
                        imagesStatus.player = true;
                        this.player.imageLoaded = true;
                        this.imageLoadCallback();
                     }
                 }, 0);
            }
        } else {
             console.warn("玩家圖片URL/對象未定義或Player不存在");
             imagesStatus.player = true; // 標記為已處理
        }


        // 預加載其他圖片 (敵人, 小王, 大王)
        const preloadImage = (key, url) => {
            if (url) {
                this.imagesToLoad++;
                const img = new Image();
                img.onload = () => { console.log(`${key} 圖片預載入成功`); imagesStatus[key] = true; this.imageLoadCallback(); };
                img.onerror = () => { console.error(`預載入 ${key} 圖片錯誤: ${url}`); imagesStatus[key] = true; this.imageLoadCallback(); /* 錯誤也算完成 */};
                img.src = url;
                 // 檢查緩存 (確保回調也被觸發)
                 if (img.complete && img.naturalWidth > 0) {
                    console.log(`${key} 圖片已緩存`);
                     setTimeout(() => {
                         if (!imagesStatus[key]) { // 如果 onload/onerror 還沒觸發
                             imagesStatus[key] = true;
                             this.imageLoadCallback();
                         }
                     }, 0);
                }
            } else {
                console.warn(`${key} 圖片 URL 未定義`);
                imagesStatus[key] = true; // 標記為已處理
            }
        };

        preloadImage('enemy', urls.enemy);
        preloadImage('miniBoss', urls.miniBoss);
        preloadImage('boss', urls.boss);
        preloadImage('tree', urls.tree); 

        // 初始檢查：如果根本沒有需要加載的圖片 (所有URL都無效或為空)
        if (this.imagesToLoad === 0 && imagesStatus.player) { // 如果沒有需要異步加載的圖片（都無效或玩家圖也失敗/未定義）
            console.warn("沒有有效的圖片 URL 需要異步加載。");
            this.areImagesLoaded = true;
            this.imagesLoaded = 0; // 確保計數為 0
            // 如果玩家圖片也沒加載成功，可能會有問題，但至少不卡死
            this.startGameLoop();
       } else if (this.imagesToLoad > 0) { // 如果確實有圖片需要加載
            // 檢查是否所有圖片已經立即完成 (主要針對緩存情況)
            // 注意：這個檢查可能不完全準確，因為 imagesStatus 可能尚未被回調更新
            // 更可靠的是完全依賴 imageLoadCallback 中的計數
            const initiallyProcessed = Object.values(imagesStatus).filter(status => status).length;
            if (initiallyProcessed >= this.imagesToLoad && this.imagesLoaded < this.imagesToLoad) {
                // 這個情況比較微妙，可能意味著所有圖片都在緩存中，但回調還沒來得及執行
                console.log("所有圖片似乎都在緩存中，稍後由回調確認...");
            } else {
               console.log(`需要處理 ${this.imagesToLoad} 張圖片。等待回調...`);
            }
            // 不在這裡直接啟動遊戲，等待 imageLoadCallback
       } else {
            // imagesToLoad 為 0，但 player 狀態未知，也嘗試啟動
            console.warn("邊緣情況：沒有圖片計入待加載，嘗試啟動。");
            this.areImagesLoaded = true;
            this.imagesLoaded = 0;
            this.startGameLoop();
       }
   }

    imageLoadCallback() {
       this.imagesLoaded++; // 增加已處理（加載成功或失敗或緩存）的圖片數量
       console.log(`圖片載入進度: ${this.imagesLoaded}/${this.imagesToLoad}`);
       // 檢查是否所有 *需要加載* 的圖片都已處理完畢
       if (this.imagesLoaded >= this.imagesToLoad && !this.areImagesLoaded) {
           this.areImagesLoaded = true;
           console.log("圖片載入完成(回調觸發)。");
           this.startGameLoop();
       }
    }
    startGameLoop() {
        if (this.areImagesLoaded && !this.gameRunning) {
            this.gameRunning = true; this.lastTime = performance.now(); this.updateCamera();
            requestAnimationFrame(this.gameLoop.bind(this)); console.log("遊戲迴圈啟動。");
        } else if (!this.areImagesLoaded) { console.log("仍在等待圖像載入..."); }
    }

    gameLoop(timestamp) {
        if (!this.gameRunning) return;
        let deltaTime = timestamp - this.lastTime;
        if (isNaN(deltaTime) || deltaTime <= 0) deltaTime = 16.67;
        deltaTime = Math.min(deltaTime, 100); this.lastTime = timestamp;
        this.update(deltaTime); this.draw();
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(deltaTime) {
        if (!this.gameRunning || !this.player) return;

        // Update Time & Difficulty
        this.elapsedGameTime += deltaTime;
        const previousDifficultyLevel = this.difficultyLevel;
        // 檢查是否升級
        const newDifficultyLevel = Math.floor(this.elapsedGameTime / this.constants.TIME_PER_DIFFICULTY_LEVEL) + 1;
        if (newDifficultyLevel > this.difficultyLevel) {
            this.difficultyLevel = newDifficultyLevel;
            this.bossSpawnedForLevel = -1; // 新的等級，重置 Boss 生成標記
            console.log(`難度提升至 ${this.difficultyLevel}`);
            this.setMessage(`關卡 ${this.difficultyLevel}`, 2500);
        }

        // Update Entities
        try { this.player.update(deltaTime, this); } catch (e) { console.error("玩家更新錯誤:", e); this.gameOver("玩家更新錯誤"); return; }
        this.arrows.forEach(e => { try { if(e.active) e.update(deltaTime, this); } catch(err){ console.error("箭矢更新錯誤", err, e); e.active=false; }});
        this.bullets.forEach(e => { try { if(e.active) e.update(deltaTime, this); } catch(err){ console.error("子彈更新錯誤", err, e); e.active=false; }});
        this.towers.forEach(e => { try { if(e.active) e.update(deltaTime, this); } catch(err){ console.error("塔更新錯誤", err, e); e.active=false; }});
        this.enemies.forEach(e => { try { if(e.active) e.update(deltaTime, this); } catch(err){ console.error("敵人更新錯誤", err, e); e.active=false; }});
        this.slashEffects.forEach(e => { try { if(e.active) e.update(deltaTime); } catch(err){ console.error("特效更新錯誤", err, e); e.active=false; }});
        this.damageNumbers.forEach(dn => dn.update(deltaTime)); // <--- 更新傷害數字

        this.updateCamera();

        // Update Message Timer
        if (this.messageTimer > 0) {
            this.messageTimer -= deltaTime;
            if (this.messageTimer <= 0) { this.messageText = ''; this.messageTimer = 0; }
        }

        // 敵人生成邏輯 (with dynamic rate/max)
        this.enemySpawnTimer += deltaTime;
        const currentSpawnRate = this.constants.ENEMY_SPAWN_RATE_BASE * (this.constants.ENEMY_SPAWN_RATE_SCALE_PER_LEVEL ** (this.difficultyLevel - 1));
        const currentMaxEnemies = Math.floor(this.constants.MAX_ENEMIES_BASE + this.constants.MAX_ENEMIES_INCREASE_PER_LEVEL * (this.difficultyLevel - 1));
        
        const activeEnemyCount = this.enemies.filter(e => e.active).length;

        // 檢查是否需要生成敵人（時間到達且未達上限）
        if (this.enemySpawnTimer >= currentSpawnRate && activeEnemyCount < currentMaxEnemies) {

            let spawnHandled = false; // 標記是否處理了 Boss/Mini-Boss 生成

            // 檢查是否是 Boss 關卡 (第 10, 20, 30... 關)
            if (this.difficultyLevel % 10 === 0 && this.bossSpawnedForLevel !== this.difficultyLevel) {
                const bossExists = this.enemies.some(e => e.active && e.enemyType === 'boss' && e.difficultyLevel === this.difficultyLevel);
                if (!bossExists) {
                    console.log(`準備生成 大王 (Level ${this.difficultyLevel})`);
                    if (this.spawnEnemy(false, this.difficultyLevel, 'boss', this.constants.BOSS_IMAGE_URL)) {
                        this.bossSpawnedForLevel = this.difficultyLevel; // 標記已生成
                        this.enemySpawnTimer = 0; // 重置計時器
                    } else {
                        this.enemySpawnTimer = currentSpawnRate * 0.8; // 生成失敗，稍後重試
                    }
                    spawnHandled = true; // 本次生成週期處理完畢
                }
            }
            // 檢查是否是 Mini-Boss 關卡 (第 5, 15, 25... 關)
            else if (this.difficultyLevel % 3 === 0 && this.bossSpawnedForLevel !== this.difficultyLevel) {
                const miniBossExists = this.enemies.some(e => e.active && e.enemyType === 'mini-boss' && e.difficultyLevel === this.difficultyLevel);
                if (!miniBossExists) {
                    // --- 計算需要生成的 Mini-Boss 數量 ---
                    let numMiniBossesToSpawn = 1; // 基礎數量
                    // 從第 10 關 *之後* 的第一個 Mini-Boss 關卡 (即 15 關) 開始增加
                    if (this.difficultyLevel >= 15) {
                        // 每隔 10 個關卡增加一隻
                        // Level 15: floor((15-5)/10) = 1, 總數 = 1 + 1 = 2
                        // Level 25: floor((25-5)/10) = 2, 總數 = 1 + 2 = 3
                        // Level 35: floor((35-5)/10) = 3, 總數 = 1 + 3 = 4
                        numMiniBossesToSpawn = 1 + Math.floor((this.difficultyLevel - 5) / 10);
                    }
                    console.log(`準備生成 ${numMiniBossesToSpawn} 隻 小王 (Level ${this.difficultyLevel})`);

                    let allSpawnedSuccessfully = true;
                    let spawnedCount = 0;
                    // --- 循環生成 Mini-Boss ---
                    for (let i = 0; i < numMiniBossesToSpawn; i++) {
                        // 確保總敵人數量不超過上限
                         if (activeEnemyCount + spawnedCount < currentMaxEnemies) {
                            if (this.spawnEnemy(false, this.difficultyLevel, 'mini-boss', this.constants.MINI_BOSS_IMAGE_URL)) {
                                spawnedCount++;
                            } else {
                                console.warn(`生成第 ${i + 1} 隻 Mini-Boss 失敗 (可能空間不足)。`);
                                allSpawnedSuccessfully = false;
                                // 可以選擇 break 或者繼續嘗試生成剩下的
                                break; // 暫定：如果有一隻生成失敗，則停止生成後續的 Mini-Boss
                            }
                         } else {
                             console.warn(`達到敵人上限，無法生成第 ${i + 1} 隻 Mini-Boss。`);
                             allSpawnedSuccessfully = false;
                             break;
                         }
                    }

                    // 只有在至少成功生成一隻後才標記
                    if (spawnedCount > 0) {
                        this.bossSpawnedForLevel = this.difficultyLevel; // 標記本關卡的 (Mini)Boss 已處理
                        this.enemySpawnTimer = 0; // 重置計時器
                    } else {
                        this.enemySpawnTimer = currentSpawnRate * 0.8; // 完全生成失敗，稍後重試
                    }
                    spawnHandled = true; // 本次生成週期處理完畢
                }
            }

            // 如果不是 Boss/Mini-Boss 關卡，或者 Boss/Mini-Boss 已生成/生成失敗，則生成普通敵人
            if (!spawnHandled) {
                if (this.spawnEnemy(false, this.difficultyLevel, 'normal', this.constants.ENEMY_IMAGE_DATA_URL)) {
                     this.enemySpawnTimer = 0; // 重置計時器
                } else {
                    this.enemySpawnTimer = currentSpawnRate * 0.8; // 生成失敗，稍後重試
                }
            }
        }

        // 清理非活躍對象
        this.enemies = this.enemies.filter(e => e.active);
        this.arrows = this.arrows.filter(a => a.active);
        this.bullets = this.bullets.filter(b => b.active);
        this.fences = this.fences.filter(f => f.active);
        this.towers = this.towers.filter(t => t.active);
        this.slashEffects = this.slashEffects.filter(s => s.active);
        this.damageNumbers = this.damageNumbers.filter(dn => dn.active); // <--- 清理傷害數字

        // Check Game Over
        if (this.player.hp <= 0) { this.gameOver("你陣亡了！"); }
    }

    draw() {
        if (!this.ctx || !this.player || !this.areImagesLoaded) return;
        const zoom = this.constants.CAMERA_ZOOM;
        // Clear Canvas
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        // Apply Camera and Zoom
        this.ctx.save();
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Draw Background
        this.drawWorldBackground();

        // Draw Entities
        const cam = this.camera;
        const visibleWidth = this.canvas.width / zoom;
        const visibleHeight = this.canvas.height / zoom;
        const leewayMultiplier = 1 / zoom;

        this.trees.forEach(e => e.isRectInView(cam, visibleWidth, visibleHeight, 50 * leewayMultiplier) && e.draw(this.ctx));
        if (this.tradingPost && this.tradingPost.isRectInView(cam, visibleWidth, visibleHeight)) this.tradingPost.draw(this.ctx, this);
        if (this.researchLab && this.researchLab.isRectInView(cam, visibleWidth, visibleHeight)) this.researchLab.draw(this.ctx, this);
        if (this.healingRoom && this.healingRoom.isRectInView(cam, visibleWidth, visibleHeight)) this.healingRoom.draw(this.ctx, this);
        this.drawSafeZoneText(); // 文字也會被縮放
        this.fences.forEach(e => e.isRectInView(cam, visibleWidth, visibleHeight) && e.draw(this.ctx));
        this.towers.forEach(e => e.isRectInView(cam, visibleWidth, visibleHeight) && e.draw(this.ctx));
        this.slashEffects.forEach(e => e.draw(this.ctx));
        
        this.arrows.forEach(e => e.isRectInView(cam, visibleWidth, visibleHeight, this.constants.ARROW_LENGTH * 2 * leewayMultiplier) && e.draw(this.ctx));
        this.bullets.forEach(e => e.isRectInView(cam, visibleWidth, visibleHeight, 20 * leewayMultiplier) && e.draw(this.ctx));
        this.enemies.forEach(e => e.isRectInView(cam, visibleWidth, visibleHeight, 50 * leewayMultiplier) && e.draw(this.ctx));
        if (this.player.isRectInView(cam, visibleWidth, visibleHeight, 10 * leewayMultiplier)) this.player.draw(this.ctx);
        this.damageNumbers.forEach(dn => dn.draw(this.ctx));

        // Restore Camera and Zoom
        this.ctx.restore();

        // Draw UI
        this.drawHUD();
        this.drawMessages();
    }

    // --- 獨立繪製安全區文字的函數 ---
    drawSafeZoneText() {
        this.ctx.save();
        this.ctx.font = "bold 24px 'Nunito', sans-serif";
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'; // 清晰度調整
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const shopMargin = this.constants.TILE_SIZE * 2;
        const shopWidth = this.constants.TILE_SIZE * 2;
        const shopAreaEndX = shopMargin + shopWidth;
        const textX = shopAreaEndX + (this.constants.SAFE_ZONE_WIDTH - shopAreaEndX) / 2;
        const textY = (this.constants.SAFE_ZONE_TOP_Y + this.constants.SAFE_ZONE_BOTTOM_Y) / 2;
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowOffsetX = 1; this.ctx.shadowOffsetY = 1; this.ctx.shadowBlur = 2;
        this.ctx.fillText("安全區", textX, textY);
        this.ctx.restore();
    }

    drawWorldBackground() {
        this.ctx.fillStyle = 'rgba(160, 210, 160, 0.3)';
        const safeZoneRect = { x:0, y:this.constants.SAFE_ZONE_TOP_Y, width:this.constants.SAFE_ZONE_WIDTH, height:this.constants.SAFE_ZONE_BOTTOM_Y-this.constants.SAFE_ZONE_TOP_Y };
        this.ctx.fillRect(safeZoneRect.x, safeZoneRect.y, safeZoneRect.width, safeZoneRect.height);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; this.ctx.lineWidth = 2; this.ctx.setLineDash([10, 5]);
        // Draw all four borders
        this.ctx.beginPath(); this.ctx.moveTo(safeZoneRect.width, safeZoneRect.y); this.ctx.lineTo(safeZoneRect.width, safeZoneRect.y + safeZoneRect.height); this.ctx.stroke(); // Right
        this.ctx.beginPath(); this.ctx.moveTo(safeZoneRect.x, safeZoneRect.y); this.ctx.lineTo(safeZoneRect.width, safeZoneRect.y); this.ctx.stroke(); // Top
        this.ctx.beginPath(); this.ctx.moveTo(safeZoneRect.x, safeZoneRect.y + safeZoneRect.height); this.ctx.lineTo(safeZoneRect.width, safeZoneRect.y + safeZoneRect.height); this.ctx.stroke(); // Bottom
        this.ctx.beginPath(); this.ctx.moveTo(safeZoneRect.x, safeZoneRect.y); this.ctx.lineTo(safeZoneRect.x, safeZoneRect.y + safeZoneRect.height); this.ctx.stroke(); // Left
        this.ctx.setLineDash([]);
    }

    updateCamera() {
        if (!this.player) return;

        const zoom = this.constants.CAMERA_ZOOM;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        // 計算縮放後畫布實際顯示的世界寬度和高度
        const visibleWorldWidth = canvasWidth / zoom;
        const visibleWorldHeight = canvasHeight / zoom;

        // 計算相機目標位置，使玩家位於縮放後視口的中心
        let targetX = this.player.centerX - visibleWorldWidth / 2;
        let targetY = this.player.centerY - visibleWorldHeight / 2;

        // 相機緩慢跟隨 (Lerp)
        const lerpFactor = 0.1;
        this.camera.x += (targetX - this.camera.x) * lerpFactor;
        this.camera.y += (targetY - this.camera.y) * lerpFactor;

        // 計算相機的最大可移動範圍 (考慮縮放)
        const maxX = this.constants.WORLD_WIDTH - visibleWorldWidth;
        const maxY = this.constants.WORLD_HEIGHT - visibleWorldHeight;

        // 限制相機移動範圍
        this.camera.x = Math.max(0, Math.min(maxX, this.camera.x));
        this.camera.y = Math.max(0, Math.min(maxY, this.camera.y));
    }

    drawHUD() {
        if (!this.ctx || !this.player) return;
        const hudPadding = 15, barHeight = 20, barWidth = 180, iconSize = 22, textOffsetY = 15, spacing = 15, hpBarX = hudPadding, hpBarY = hudPadding, cornerRadius = 4;
        const player = this.player;

        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0,0,0,0.7)'; this.ctx.shadowOffsetX = 1; this.ctx.shadowOffsetY = 1; this.ctx.shadowBlur = 3;

        // HP Bar
        this.ctx.fillStyle = 'rgba(0,0,0,0.6)'; this.drawRoundedRect(this.ctx, hpBarX-2, hpBarY-2, barWidth+4, barHeight+4, cornerRadius);
        this.ctx.fillStyle = '#555'; this.drawRoundedRect(this.ctx, hpBarX, hpBarY, barWidth, barHeight, cornerRadius);
        const hpRatio = Math.max(0, this.player.hp / this.player.maxHp);
        if (hpRatio > 0.6) this.ctx.fillStyle='#22c55e'; else if (hpRatio > 0.3) this.ctx.fillStyle='#facc15'; else this.ctx.fillStyle='#ef4444';
        this.drawRoundedRect(this.ctx, hpBarX, hpBarY, barWidth * hpRatio, barHeight, cornerRadius, true, hpRatio < 1);
        this.ctx.fillStyle = 'white'; this.ctx.font = "bold 12px 'Nunito', sans-serif"; this.ctx.textAlign = 'center';
        this.ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, hpBarX + barWidth / 2, hpBarY + textOffsetY - 1);
        
        // --- 繪製等級和經驗條 ---
        const levelY = hpBarY + barHeight + spacing; // 放在 HP 條下方
        const xpBarHeight = 8;
        const xpBarWidth = barWidth; // 與 HP 條同寬
        const xpBarY = levelY + spacing * 0.75; // 等級文字下方

        // 繪製等級
        this.ctx.fillStyle = 'white';
        this.ctx.font = "bold 14px 'Nunito', sans-serif";
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`Lv. ${player.level}`, hpBarX, levelY);

        // 繪製經驗條背景
        this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.drawRoundedRect(this.ctx, hpBarX - 1, xpBarY - 1, xpBarWidth + 2, xpBarHeight + 2, cornerRadius * 0.5);
        this.ctx.fillStyle = '#555'; // 深灰色背景
        this.drawRoundedRect(this.ctx, hpBarX, xpBarY, xpBarWidth, xpBarHeight, cornerRadius * 0.5);

        // 繪製經驗條填充部分
        const xpRatio = Math.max(0, Math.min(1, player.xp / player.xpToNextLevel)); // 確保比例在 0-1 之間
        if (xpRatio > 0) {
            this.ctx.fillStyle = '#fde047'; // 黃色經驗條
            this.drawRoundedRect(this.ctx, hpBarX, xpBarY, xpBarWidth * xpRatio, xpBarHeight, cornerRadius * 0.5, true, xpRatio < 1);
        }

        // 繪製經驗值文字 (放在經驗條中間)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // 白色半透明，避免太刺眼
        this.ctx.font = "bold 9px 'Nunito', sans-serif";
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${player.xp} / ${player.xpToNextLevel}`, hpBarX + xpBarWidth / 2, xpBarY + xpBarHeight / 2 + 1);        
        
        // Resources
        let currentX = hpBarX + barWidth + spacing * 1.5;
        let resourceY = hpBarY + textOffsetY; // 保持在第一行
        // Gold
        const goldIconX = currentX; const goldIconY = hpBarY + barHeight / 2 - iconSize / 2; const goldTextX = goldIconX + iconSize + spacing / 2;
        this.ctx.fillStyle='#facc15'; this.ctx.beginPath(); this.ctx.arc(goldIconX+iconSize/2, goldIconY+iconSize/2, iconSize/2, 0, Math.PI*2); this.ctx.fill();
        this.ctx.fillStyle='#ca8a04'; this.ctx.beginPath(); this.ctx.arc(goldIconX+iconSize/2, goldIconY+iconSize/2, iconSize/3, 0, Math.PI*2); this.ctx.fill();
        this.ctx.fillStyle='white'; this.ctx.font = "bold 10px 'Nunito'"; this.ctx.textAlign='center'; this.ctx.fillText('G', goldIconX+iconSize/2, goldIconY+iconSize/2+4);
        this.ctx.fillStyle='white'; this.ctx.font = "bold 15px 'Nunito', sans-serif"; this.ctx.textAlign='left'; const goldText=`${this.player.gold}`; this.ctx.fillText(goldText, goldTextX, hpBarY+textOffsetY); currentX = goldTextX + this.ctx.measureText(goldText).width + spacing * 2;
        this.ctx.fillText(goldText, goldTextX, resourceY); currentX = goldTextX + this.ctx.measureText(goldText).width + spacing * 2;        
        // Wood
        const woodIconX = currentX; const woodIconY = hpBarY + barHeight / 2 - iconSize / 2; const woodTextX = woodIconX + iconSize + spacing / 2;
        this.ctx.fillStyle='#a16207'; this.drawRoundedRect(this.ctx, woodIconX, woodIconY, iconSize*0.8, iconSize, 3);
        this.ctx.fillStyle='#ca8a04'; this.ctx.fillRect(woodIconX+3, woodIconY+3, iconSize*0.8-6, 2); this.ctx.fillRect(woodIconX+3, woodIconY+iconSize-5, iconSize*0.8-6, 2);
        this.ctx.fillStyle='white'; this.ctx.font = "bold 15px 'Nunito', sans-serif"; this.ctx.textAlign='left'; const woodText=`${this.player.wood}`; this.ctx.fillText(woodText, woodTextX, hpBarY+textOffsetY); currentX = woodTextX + this.ctx.measureText(woodText).width + spacing * 2;
        this.ctx.fillText(woodText, woodTextX, resourceY); currentX = woodTextX + this.ctx.measureText(woodText).width + spacing * 2;        
        // diamond
        const diamondIconX = currentX;
        const diamondTextY = hpBarY + textOffsetY;
        const diamondTextX = diamondIconX + iconSize + spacing / 2;
        this.ctx.font = `${iconSize}px 'Nunito', sans-serif`; // 設置 emoji 大小，約等於原圖標大小
        this.ctx.fillStyle = 'white';                       // 設置 emoji 顏色 (可以改成藍色等)
        this.ctx.textAlign = 'left';                        // 左對齊
        this.ctx.textBaseline = 'middle';                   // 垂直居中對齊 diamondTextY
        this.ctx.fillText('💎', diamondIconX, diamondTextY);      // 在圖標位置繪製 emoji
        this.ctx.font = "bold 15px 'Nunito', sans-serif"; // 重設字體以繪製數字
        this.ctx.fillStyle='white';
        const diamondText=`${this.player.diamond}`;
        this.ctx.fillText(diamondText, diamondTextX, resourceY); currentX = diamondTextX + this.ctx.measureText(diamondText).width + spacing * 2;
        currentX = diamondTextX + this.ctx.measureText(diamondText).width + spacing * 2; // 更新 currentX        

        let weaponDisplayY = xpBarY + xpBarHeight + spacing; 
                
        // 顯示當前使用武器和等級
        const weaponTextY = hpBarY + textOffsetY;
        let activeWeaponIcon = '';
        let activeWeaponName = '';
        let activeWeaponLevel = 0;

        // 判斷當前生效的武器
        if (this.player.gunUnlocked && this.player.gunLevel > 0) {
            activeWeaponIcon = '🔫';
            activeWeaponName = '槍械';
            activeWeaponLevel = this.player.gunLevel;
        } else if (this.player.bowUnlocked && this.player.bowLevel > 0) {
            activeWeaponIcon = '🏹';
            activeWeaponName = '弓箭';
            activeWeaponLevel = this.player.bowLevel;
        } else {
            activeWeaponIcon = '🔪';
            activeWeaponName = '菜刀';
            activeWeaponLevel = this.player.cleaverLevel;
        }

        // 格式化顯示文本
        const activeWeaponText = `${activeWeaponIcon} ${activeWeaponName} Lv.${activeWeaponLevel}`;

        // 繪製當前武器文本
        this.ctx.fillStyle = 'white';
        this.ctx.font = "bold 14px 'Nunito', sans-serif";
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle'; // 確保垂直對齊
        this.ctx.fillText(activeWeaponText, currentX, weaponTextY);
        // 你可以選擇在這裡更新 currentX 如果後面還要加東西
        // currentX += this.ctx.measureText(activeWeaponText).width + spacing * 1.5;

        // --- 右上角信息 (敵人數量、Boss 數量、關卡) ---
        const topRightX = this.canvas.width - hudPadding;
        let currentTopRightY = hpBarY + textOffsetY; // 從第一行開始

        // 關卡等級 (保持在第一行最右側)
        const difficultyText = `關卡: ${this.difficultyLevel}`;
        this.ctx.fillStyle = '#f97316'; // 橙色
        this.ctx.font = "bold 14px 'Nunito', sans-serif";
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle'; // 設置基準線
        this.ctx.fillText(difficultyText, topRightX, currentTopRightY);

        // 總敵人數量 (放在第二行)
        currentTopRightY += spacing * 1.5; // 下移一行
        const activeEnemyCount = this.enemies.filter(e => e.active).length;
        const enemyCountText = `敵人: ${activeEnemyCount}`;
        this.ctx.fillStyle = 'white'; // 白色
        this.ctx.font = "bold 14px 'Nunito', sans-serif";
        // textAlign 和 textBaseline 保持不變 (right, middle)
        this.ctx.fillText(enemyCountText, topRightX, currentTopRightY);

        // --- 計算並顯示 Mini-Boss 和 Boss 數量 ---
        const miniBossCount = this.enemies.filter(e => e.active && e.enemyType === 'mini-boss').length;
        const bossCount = this.enemies.filter(e => e.active && e.enemyType === 'boss').length;

        // 只有當數量大於 0 時才顯示，避免 HUD 混亂
        if (miniBossCount > 0) {
            currentTopRightY += spacing * 1.5; // 下移一行
            const miniBossText = `小王: ${miniBossCount}`;
            this.ctx.fillStyle = '#DA70D6'; // 紫色 (Orchid)
            this.ctx.fillText(miniBossText, topRightX, currentTopRightY);
        }

        if (bossCount > 0) {
            currentTopRightY += spacing * 1.5; // 下移一行
            const bossText = `大王: ${bossCount}`;
            this.ctx.fillStyle = '#FF4500'; // 橙紅色
            this.ctx.fillText(bossText, topRightX, currentTopRightY);
        }

        this.ctx.restore(); // Restore shadow state
    }

    drawRoundedRect(ctx, x, y, width, height, radius, fill = true, clipRight = false) {
        if (width <= 0 || height <= 0) return; ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - (clipRight ? 0 : radius), y); if (!clipRight) ctx.arcTo(x + width, y, x + width, y + radius, radius); else ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + height - radius); ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius); ctx.lineTo(x + radius, y + height); ctx.arcTo(x, y + height, x, y + height - radius, radius); ctx.lineTo(x, y + radius); ctx.arcTo(x, y, x + radius, y, radius); ctx.closePath(); if (fill) ctx.fill(); else ctx.stroke();
    }

    drawMessages() {
        if (!this.ctx || this.messageTimer <= 0 || !this.messageText) return;
        const boxPadding = 12; const boxY = 65; const fontSize = 14; const minBoxWidth = 200; const cornerRadius = 6;
        this.ctx.font = `bold ${fontSize}px 'Nunito', sans-serif`;
        const textMetrics = this.ctx.measureText(this.messageText); let textWidth = textMetrics.width;
        let boxWidth = Math.max(minBoxWidth, textWidth + boxPadding * 2); const boxHeight = fontSize + boxPadding * 1.5;
        const boxX = this.canvas.width / 2 - boxWidth / 2;
        const fadeDuration = 400; let groupAlpha = 1.0;
        if (this.messageTimer < fadeDuration) { groupAlpha = Math.max(0, this.messageTimer / fadeDuration); }
        groupAlpha = Math.min(1.0, groupAlpha);
        this.ctx.save(); this.ctx.globalAlpha = groupAlpha;
        this.ctx.fillStyle = `rgba(0, 0, 0, 0.85)`; this.drawRoundedRect(this.ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius);
        this.ctx.shadowColor = `rgba(0, 0, 0, 0.6)`; this.ctx.shadowOffsetX = 1; this.ctx.shadowOffsetY = 2; this.ctx.shadowBlur = 3;
        this.ctx.fillStyle = `white`; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.messageText, this.canvas.width / 2, boxY + boxHeight / 2 + 1);
        this.ctx.restore();
    }

    setMessage(text, duration) {
        if (this.messageText !== text || this.messageTimer < 100) {
           this.messageText = text; this.messageTimer = duration;
        } else if (this.messageText === text) { this.messageTimer = Math.max(this.messageTimer, duration); }
    }

    gameOver(reason) {
        if (!this.gameRunning) return;
        this.gameRunning = false; console.log("Game Over:", reason);
        requestAnimationFrame(() => {
            if (this.ctx) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.fillStyle = 'white'; this.ctx.textAlign = 'center';
                this.ctx.font = "bold 32px 'Nunito', sans-serif"; this.ctx.fillText("遊戲結束!", this.canvas.width/2, this.canvas.height/2 - 30);
                this.ctx.font = "22px 'Nunito', sans-serif"; this.ctx.fillText(reason, this.canvas.width/2, this.canvas.height/2 + 15);
                this.ctx.font = "18px 'Nunito', sans-serif"; this.ctx.fillText("刷新頁面 (F5) 重新開始", this.canvas.width/2, this.canvas.height/2 + 60);
            }
        });
    }

    attachListeners() {
        if (this.listenersAttached) return; console.log("附加事件監聽器...");
        this._handleKeyDown = this._handleKeyDown.bind(this); this._handleKeyUp = this._handleKeyUp.bind(this);
        this._handleClick = this._handleClick.bind(this); this._handleContextMenu = this._handleContextMenu.bind(this);
        document.addEventListener('keydown', this._handleKeyDown); document.addEventListener('keyup', this._handleKeyUp);
        this.canvas.addEventListener('click', this._handleClick); this.canvas.addEventListener('contextmenu', this._handleContextMenu);
        this.listenersAttached = true; console.log("事件監聽器已附加。");
    }
    _handleKeyDown(event) {
        if (!this.gameRunning && !['F5', 'F12'].includes(event.key)) return; const key = event.key.toLowerCase();
        this.keysPressed[key] = true;
        if (event.code === 'Space') { event.preventDefault(); if (this.player) this.player.collectTree(this); }
        if (this.gameRunning && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { event.preventDefault(); }
    }
    _handleKeyUp(event) { this.keysPressed[event.key.toLowerCase()] = false; }
    _handleClick(event) { if (!this.gameRunning) return; event.preventDefault(); const rect = this.canvas.getBoundingClientRect(); const clickX = event.clientX - rect.left; const clickY = event.clientY - rect.top; this.buildFence(clickX, clickY); }
    _handleContextMenu(event) { if (!this.gameRunning) return; event.preventDefault(); const rect = this.canvas.getBoundingClientRect(); const clickX = event.clientX - rect.left; const clickY = event.clientY - rect.top; this.buildTower(clickX, clickY); }

    // --- 創建傷害數字的方法 ---
    addDamageNumber(x, y, amount, color) {
        this.damageNumbers.push(new DamageNumber(x, y, amount, color, this.constants));
    }

    spawnEnemy(allowAnywhere = false, difficultyLevel = 1, enemyType = 'normal', imageUrl = null) {
        // Boss 和 Mini-Boss 可能需要更大的尺寸
        const sizeMultiplier = (enemyType === 'boss' ? 1.8 : (enemyType === 'mini-boss' ? 1.5 : 1.2));
        const size = this.constants.TILE_SIZE * sizeMultiplier;
        let x, y, attempts = 0; const maxAttempts = 50; const constants = this.constants;

        do {
            x = Math.random() * (constants.WORLD_WIDTH - size);
            y = Math.random() * (constants.WORLD_HEIGHT - size);
            attempts++;
            // 檢查是否在安全區內生成，或離玩家太近，或與其他敵人重疊
        } while (
            ( (!allowAnywhere && ( (x+size/2 < constants.SAFE_ZONE_WIDTH && y+size/2 > constants.SAFE_ZONE_TOP_Y && y+size/2 < constants.SAFE_ZONE_BOTTOM_Y) || (this.player && this.player.hp > 0 && distanceSqValues(x+size/2,y+size/2,this.player.centerX,this.player.centerY)<constants.SAFE_SPAWN_DIST_SQ))) ||
              this.enemies.some(e => e.active && distanceSqValues(x+size/2, y+size/2, e.centerX, e.centerY) < (constants.TILE_SIZE * sizeMultiplier * 0.8)**2) // 根據尺寸調整碰撞距離檢查
            ) && attempts < maxAttempts );

        if (attempts >= maxAttempts) {
             console.warn(`無法為 ${enemyType} 找到安全的生成點 after ${attempts} attempts.`);
             return false; // 生成失敗
        }

        // 再次檢查安全區（以防萬一）
        if (!allowAnywhere && x+size/2 < constants.SAFE_ZONE_WIDTH && y+size/2 > constants.SAFE_ZONE_TOP_Y && y+size/2 < constants.SAFE_ZONE_BOTTOM_Y) {
             console.warn(`嘗試在安全區內生成 ${enemyType}，已阻止。`);
             return false; // 生成失敗
        }

        // 使用傳入的類型和圖片 URL 創建敵人
        const newEnemy = new Enemy(x, y, size, size, constants, difficultyLevel, enemyType, imageUrl || (enemyType === 'normal' ? constants.ENEMY_IMAGE_DATA_URL : null));
        this.enemies.push(newEnemy);
        // console.log(`成功生成 ${enemyType} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
        return true; // 生成成功
    }

    spawnTree(allowAnywhere = false) {
        const width = this.constants.TILE_SIZE;
        const height = this.constants.TILE_SIZE * 1.5;
        const margin = this.constants.TILE_SIZE;
        let x, y, attempts = 0; const maxAttempts = 30; const constants = this.constants; const checkRect = { width, height };
        do {
            x = Math.random() * (constants.WORLD_WIDTH - margin*2 - width) + margin; y = Math.random() * (constants.WORLD_HEIGHT - margin*2 - height) + margin;
            checkRect.x = x; checkRect.y = y; attempts++;
        } while (
            ( (!allowAnywhere && (x+width/2 < constants.SAFE_ZONE_WIDTH && y+height/2 > constants.SAFE_ZONE_TOP_Y && y+height/2 < constants.SAFE_ZONE_BOTTOM_Y)) ||
              (this.tradingPost && simpleCollisionCheck(checkRect, this.tradingPost, 5)) || (this.researchLab && simpleCollisionCheck(checkRect, this.researchLab, 5)) || (this.healingRoom && simpleCollisionCheck(checkRect, this.healingRoom, 5)) ||
              this.trees.some(t => t.active && distanceSqValues(x+width/2, y+height/2, t.centerX, t.centerY) < (constants.TILE_SIZE * 1.8)**2) ||
              this.fences.some(f => f.active && simpleCollisionCheck(checkRect, f, 2)) || this.towers.some(t => t.active && simpleCollisionCheck(checkRect, t, 2))
            ) && attempts < maxAttempts );
        if (attempts >= maxAttempts) { console.warn("無法找到合適的樹木生成點"); return; }
        this.trees.push(new Tree(x, y, width, height, constants));
    }

    buildFence(clickX, clickY) {
        if (!this.player || this.player.wood < this.constants.FENCE_COST) { this.setMessage(`木材不足 (需 ${this.constants.FENCE_COST})`, 1500); return; }
        const worldX = clickX + this.camera.x; const worldY = clickY + this.camera.y;
        const gridX = Math.floor(worldX / this.constants.TILE_SIZE) * this.constants.TILE_SIZE; const gridY = Math.floor(worldY / this.constants.TILE_SIZE) * this.constants.TILE_SIZE; const constants = this.constants;
        if (gridX+constants.TILE_SIZE/2 < constants.SAFE_ZONE_WIDTH && gridY+constants.TILE_SIZE/2 > constants.SAFE_ZONE_TOP_Y && gridY+constants.TILE_SIZE/2 < constants.SAFE_ZONE_BOTTOM_Y) { this.setMessage("不能在安全區內建造防禦工事!", 1500); return; }
        if (this.isOccupied(gridX, gridY)) { this.setMessage("該位置已被佔用!", 1500); return; }
        this.player.wood -= constants.FENCE_COST;
        this.fences.push(new Fence(gridX, gridY, constants.TILE_SIZE, constants.TILE_SIZE, constants));
        this.setMessage(`建造圍欄! (木材: ${this.player.wood})`, 1000);
    }

    buildTower(clickX, clickY) {
        if (!this.player || this.player.wood < this.constants.TOWER_COST) { this.setMessage(`木材不足 (需 ${this.constants.TOWER_COST})`, 1500); return; }
        const worldX = clickX + this.camera.x; const worldY = clickY + this.camera.y;
        const gridX = Math.floor(worldX / this.constants.TILE_SIZE) * this.constants.TILE_SIZE; const gridY = Math.floor(worldY / this.constants.TILE_SIZE) * this.constants.TILE_SIZE; const constants = this.constants;
        if (gridX+constants.TILE_SIZE/2 < constants.SAFE_ZONE_WIDTH && gridY+constants.TILE_SIZE/2 > constants.SAFE_ZONE_TOP_Y && gridY+constants.TILE_SIZE/2 < constants.SAFE_ZONE_BOTTOM_Y) { this.setMessage("不能在安全區內建造防禦工事!", 1500); return; }
        if (this.isOccupied(gridX, gridY)) { this.setMessage("該位置已被佔用!", 1500); return; }
        this.player.wood -= constants.TOWER_COST;
        this.towers.push(new Tower(gridX, gridY, constants.TILE_SIZE, constants.TILE_SIZE, constants));
        this.setMessage(`建造防禦塔! (木材: ${this.player.wood})`, 1000);
    }

    isOccupied(gridX, gridY) {
        const TILE_SIZE = this.constants.TILE_SIZE;
        const checkRect = { x: gridX, y: gridY, width: TILE_SIZE, height: TILE_SIZE };
        if (this.fences.some(f => f.active && f.x === gridX && f.y === gridY) ||
            this.towers.some(t => t.active && t.x === gridX && t.y === gridY)) { return true; }
        return ( (this.tradingPost && simpleCollisionCheck(checkRect, this.tradingPost, 2)) ||
                 (this.researchLab && simpleCollisionCheck(checkRect, this.researchLab, 2)) ||
                 (this.healingRoom && simpleCollisionCheck(checkRect, this.healingRoom, 2)) ||
                 (this.weaponShop && simpleCollisionCheck(checkRect, this.weaponShop, 2)) ||
                 this.trees.some(tree => tree.active && simpleCollisionCheck(checkRect, tree, 5)) );
    }

    findNearestActiveEnemy(source, range) {
        let nearestEnemy = null; let minDistanceSq = range * range;
        const sourceCenterX = source.x + (source.width || source.radius || 0)/2;
        const sourceCenterY = source.y + (source.height || source.radius || 0)/2;
        const constants = this.constants;
        this.enemies.forEach(enemy => {
            if (!enemy.active) return;
            const distSq = distanceSqValues(sourceCenterX, sourceCenterY, enemy.centerX, enemy.centerY);
            if (distSq < minDistanceSq) {
                if (source instanceof Tower && enemy.centerX < constants.SAFE_ZONE_WIDTH && enemy.centerY > constants.SAFE_ZONE_TOP_Y && enemy.centerY < constants.SAFE_ZONE_BOTTOM_Y) { return; }
                minDistanceSq = distSq; nearestEnemy = enemy;
            }
        });
        return nearestEnemy;
    }

    findMultipleEnemiesInRange(source, range, maxTargets) {
        if (maxTargets <= 0) return []; // 不需要目標

        const targetsInRange = [];
        const rangeSq = range * range;
        const sourceCenterX = source.x + (source.width || 0) / 2;
        const sourceCenterY = source.y + (source.height || 0) / 2;
        const constants = this.constants; // 獲取常量

        this.enemies.forEach(enemy => {
            if (!enemy.active) return; // 跳過非活躍敵人

            // 玩家的多重射擊可以攻擊安全區邊緣的敵人，但塔不行（這裏假設 source 是 Player）
            // 如果需要讓塔也多重射擊，則需要加入類似 findNearestActiveEnemy 中的 Tower 判斷
            // (暫時不加，保持玩家專屬多重射擊)

            const distSq = distanceSqValues(sourceCenterX, sourceCenterY, enemy.centerX, enemy.centerY);
            if (distSq < rangeSq) {
                targetsInRange.push({ enemy: enemy, distSq: distSq });
            }
        });

        // 按距離排序 (從近到遠)
        targetsInRange.sort((a, b) => a.distSq - b.distSq);

        // 取最多 maxTargets 個敵人對象
        return targetsInRange.slice(0, maxTargets).map(item => item.enemy);
    }    

    addSlashEffect(attacker, target) { this.slashEffects.push(new SlashEffect(attacker, target, this.constants)); }

    addBullet(shooter, target, options = {}) {
        const startX = shooter.centerX;
        const startY = shooter.centerY;
        // 將目標也傳遞給構造函數，即使是非追蹤也可能需要目標信息（例如初始方向）
        this.bullets.push(new Bullet(startX, startY, target, shooter, this.constants, options));
    }

     // --- 專門用於 Boss 非追蹤子彈的方法 ---
     addBossProjectile(shooter, startX, startY, directionDx, directionDy, speed, damage, color) {
        const normalizedDx = directionDx / Math.sqrt(directionDx * directionDx + directionDy * directionDy);
        const normalizedDy = directionDy / Math.sqrt(directionDx * directionDx + directionDy * directionDy);
        const options = {
            homing: false, // 非追蹤
            direction: { dx: normalizedDx, dy: normalizedDy },
            speed: speed,
            damage: damage,
            color: color,
            lifeTime: 4000 // Boss 子彈存活時間可以短一點
        };
        // 注意：這裡的 target 傳 null
        this.bullets.push(new Bullet(startX, startY, null, shooter, this.constants, options));
    }

    addArrow(shooter, target) {
        const dx = target.centerX - shooter.centerX; const dy = target.centerY - shooter.centerY;
        const angle = Math.atan2(dy, dx); const startDist = shooter.width / 2 + 5;
        const startX = shooter.centerX + Math.cos(angle) * startDist;
        const startY = shooter.centerY + Math.sin(angle) * startDist;
        this.arrows.push(new Arrow(startX, startY, target, shooter, this.constants));
    }
}

// --- 遊戲啟動 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 完全載入並解析");
    try {
        const game = new Game('gameCanvas');
        game.init();
    } catch (error) {
        console.error("初始化遊戲時發生錯誤:", error);
        const body = document.querySelector('body');
        if (body) {
            body.innerHTML = `
<div style="color: red; padding: 20px; font-family: 'Nunito', sans-serif; background-color: #333; border-radius: 5px; margin: 20px;">
    <h2 style="margin-top: 0; color: #ff8a8a;">遊戲初始化失敗</h2>
    <p style="color: #eee;">糟糕！遊戲無法啟動。請檢查瀏覽器控制台 (按 F12) 以獲取詳細的錯誤信息，這有助於我們解決問題。</p>
    <p style="color: #bbb; font-size: 0.9em;">錯誤詳情:</p>
    <pre style="background-color: #222; color: #ffc107; padding: 10px; border-radius: 3px; white-space: pre-wrap; word-wrap: break-word;">${error.stack || error}</pre>
</div>`;
        }
    }
});
