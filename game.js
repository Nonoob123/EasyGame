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
        this.maxHp = this.constants.PLAYER_HP_MAX_UPGRADED;
        this.hp = this.maxHp; // 初始血量設為最大值
        this.wood = 20;
        this.meat = 0;
        this.gold = 200; // 初始金幣
        this.attackTimer = 0;
        // --- 武器系統狀態 ---
        this.cleaverLevel = 1;       // 菜刀等級
        this.bowLevel = 0;           // 弓箭等級
        this.bowUnlocked = false;    // 弓箭是否解鎖
        this.finalCleaverDamage = 0; // 滿級菜刀傷害
        this.finalCleaverCooldown = 0;// 滿級菜刀冷卻

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

        // --- 初始化武器屬性 ---
        this.updateWeaponStats(); // 根據初始武器等級計算屬性
    }

    loadImage(src) {
        this.image.onload = () => { this.imageLoaded = true; };
        this.image.onerror = () => { console.error(`載入玩家圖片錯誤: ${src}`); this.imageLoaded = true; /* Treat error as loaded to not block game */ };
        this.image.src = src;
    }

    // --- 計算武器屬性 ---
    updateWeaponStats() {
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

        // --- 應用屬性 ---
        if (this.bowUnlocked && this.bowLevel > 0) {
            // 弓箭屬性 (基於滿級菜刀)
            const bowBaseDmg = this.finalCleaverDamage;
            const bowBaseCd = this.finalCleaverCooldown; // 弓箭的基礎冷卻繼承滿級菜刀的極快冷卻

            this.attackDamage = bowBaseDmg + (this.bowLevel) * this.constants.BOW_DAMAGE_INCREASE_PER_LEVEL;
            // 弓箭的冷卻乘數 (<1) 會在滿級菜刀的基礎上進一步減少冷卻
            this.attackCooldown = bowBaseCd * (this.constants.BOW_COOLDOWN_MULTIPLIER ** this.bowLevel);
            this.attackRange = this.constants.BOW_BASE_RANGE + (this.bowLevel) * this.constants.BOW_RANGE_INCREASE_PER_LEVEL;

        } else if (this.cleaverLevel === this.constants.CLEAVER_MAX_LEVEL && this.bowUnlocked && this.bowLevel === 0) {
            // 特殊情況：菜刀滿級，弓箭已解鎖但等級為 0 -> 使用滿級菜刀屬性
            this.attackDamage = this.finalCleaverDamage;
            this.attackCooldown = this.finalCleaverCooldown;
            this.attackRange = cleaverRange;
        }
        else {
            // 使用當前等級菜刀屬性
            this.attackDamage = cleaverDmg;
            this.attackCooldown = cleaverCd;
            this.attackRange = cleaverRange;
        }
        // console.log(`等級 Cleaver:${this.cleaverLevel} Bow:${this.bowLevel} | 傷害:${this.attackDamage.toFixed(1)} CD:${this.attackCooldown.toFixed(0)}ms 範圍:${this.attackRange}`);
    }

    update(deltaTime, game) {
        if (this.hp <= 0) return;

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

        let dx = 0, dy = 0;
        if (game.keysPressed['arrowup'] || game.keysPressed['w']) dy -= this.constants.PLAYER_SPEED;
        if (game.keysPressed['arrowdown'] || game.keysPressed['s']) dy += this.constants.PLAYER_SPEED;
        if (game.keysPressed['arrowleft'] || game.keysPressed['a']) dx -= this.constants.PLAYER_SPEED;
        if (game.keysPressed['arrowright'] || game.keysPressed['d']) dx += this.constants.PLAYER_SPEED;

        const nextX = this.x + dx;
        const nextY = this.y + dy;
        this.x = Math.max(0, Math.min(game.constants.WORLD_WIDTH - this.width, nextX));
        this.y = Math.max(0, Math.min(game.constants.WORLD_HEIGHT - this.height, nextY));

        if (game.tradingPost && simpleCollisionCheck(this, game.tradingPost) && this.meat > 0) {
            this.tradeMeat(game);
        }

        // --- 建築互動提示邏輯 ---
        let inResearchLab = game.researchLab && simpleCollisionCheck(this, game.researchLab);
        let inHealingRoom = game.healingRoom && simpleCollisionCheck(this, game.healingRoom);

        if (inResearchLab) {
            this.handleResearchLabInteraction(game); // 嘗試升級
            let labMsg = "在研究室！";
             if (this.weaponUpgradeCooldown > 0) {
                 labMsg += ` (升級冷卻: ${(this.weaponUpgradeCooldown / 1000).toFixed(1)}s)`;
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
            game.setMessage(labMsg, 1500); // 持續顯示
        }

        if (inHealingRoom) {
            const healed = this.handleHealingRoomInteraction(game); // 嘗試治療
            if (!healed) { // 只有在未成功治療時顯示通用/錯誤信息
                 const cost = 1 * this.constants.HEALING_COST_PER_HP;
                 if (this.hp >= this.maxHp) {
                    game.setMessage("生命值已滿！", 1000);
                 } else if (this.healingCooldown > 0) {
                    game.setMessage(`治療冷卻中: ${(this.healingCooldown / 1000).toFixed(1)}s`, 500);
                 } else if (this.gold < cost) {
                    game.setMessage(`金幣不足無法治療 (需 ${cost}G)`, 1000);
                 } else {
                     // 理論上不應到達這裡，除非有其他條件
                 }
            } // 治療成功的信息在 handleHealingRoomInteraction 內部設置
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
        if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
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
        this.hp -= damage;
        if (this.hp < 0) this.hp = 0;

        // 注意：傷害數字的顯示移到 Enemy.update 中觸發，以確保傷害數值正確
    }

    tradeMeat(game) {
        const goldEarned = this.meat * this.constants.MEAT_VALUE;
        this.gold += goldEarned;
        game.setMessage(`用 ${this.meat} 熊肉換得 ${goldEarned} 金幣! (總金幣: ${this.gold})`, 2000);
        this.meat = 0;
    }

    handleResearchLabInteraction(game) {
        if (this.weaponUpgradeCooldown > 0) {
            return; // Still cooling down
        }

        // 1. Upgrade Cleaver
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
        // 2. Upgrade Bow
        else if (this.bowUnlocked && this.bowLevel < this.constants.BOW_MAX_LEVEL) {
           const cost = this.constants.BOW_COSTS[this.bowLevel];
           if (this.gold >= cost) {
               this.gold -= cost;
               this.bowLevel++;
               this.updateWeaponStats(); // Recalculate stats
               game.setMessage(`弓箭 升級! ${this.bowLevel}級 (花費 ${cost}G)`, 1500);
               this.weaponUpgradeCooldown = this.constants.WEAPON_UPGRADE_COOLDOWN;
               return; // Return after successful upgrade
           } else {
               // Insufficient gold message handled in update loop
           }
       }
   }

    handleHealingRoomInteraction(game) {
        if (this.healingCooldown > 0) {
            return false; // Still cooling down
        }
        if (this.hp >= this.maxHp) {
            return false; // Already full HP
        }

        const healAmount = 1;
        const goldCost = healAmount * this.constants.HEALING_COST_PER_HP;

        if (this.gold < goldCost) {
            // Message handled in update loop
            return false; // Insufficient gold
        }

        // Execute healing
        this.gold -= goldCost;
        this.hp += healAmount;
        this.hp = Math.min(this.hp, this.maxHp); // Cap HP at max
        this.healingCooldown = this.constants.HEALING_RATE; // Start cooldown

        // Show confirmation message
        game.setMessage(`+${healAmount} HP (花費 ${goldCost}G)`, 500);
        return true; // Healing was successful
    }

    attack(enemy, game) {
        if (this.bowUnlocked && this.bowLevel > 0) {
            game.addArrow(this, enemy); // Arrow logic handles damage number
        } else {
            // --- 菜刀攻擊 ---
            const damageDealt = this.attackDamage; // Store damage before applying
            enemy.takeDamage(damageDealt, game); // Pass game object to takeDamage
            // *** 新增：顯示傷害數字 (白色) ***
            game.addDamageNumber(enemy.centerX, enemy.y, damageDealt, '#FFFFFF');
            game.addSlashEffect(this, enemy);
        }
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
    constructor(x, y, width, height, gameConstants, difficultyLevel) {
        super(x, y, width, height, 'saddlebrown');
        this.constants = gameConstants;
        this.difficultyLevel = difficultyLevel;

        // --- 計算基礎的每級縮放 ---
        const levelFactor = this.difficultyLevel - 1; // 從 Level 1 開始，因子為 0
        const hpScale = 1 + levelFactor * this.constants.ENEMY_HP_SCALING_FACTOR;
        const dmgScale = 1 + levelFactor * this.constants.ENEMY_DAMAGE_SCALING_FACTOR;
        const meatScale = 1 + levelFactor * this.constants.MEAT_AWARD_SCALING_FACTOR;

        // --- 計算每 5 級的大幅提升 ---
        const boostTiers = Math.floor(this.difficultyLevel / 5);
        const boostMultiplier = (this.constants.ENEMY_BOOST_FACTOR_PER_5_LEVELS ** boostTiers);

        // --- 應用最終屬性 ---
        const baseHp = this.constants.ENEMY_HP_BASE;
        this.maxHp = Math.ceil(baseHp * hpScale * boostMultiplier);
        this.hp = this.maxHp;
        this.damage = Math.ceil(this.constants.ENEMY_DAMAGE_BASE * dmgScale * boostMultiplier);
        this.meatReward = Math.ceil(this.constants.MEAT_AWARD_BASE * meatScale);

        this.speed = this.constants.ENEMY_SPEED_BASE + (Math.random() * 0.4 - 0.2);
        this.attackCooldown = Math.random() * 1000;
        this.aiState = 'chasing';
        this.wanderTargetX = null;
        this.wanderTargetY = null;
        this.wanderTimer = 0;
        this.image = new Image();
        this.imageLoaded = false;
        this.loadImage(this.constants.ENEMY_IMAGE_DATA_URL);
        this.setNewWanderTarget(this.constants);
    }

    loadImage(src) {
        this.image.onload = () => { this.imageLoaded = true; };
        this.image.onerror = () => { console.error(`載入敵人圖片錯誤: ${src}`); this.imageLoaded = true; /* Treat error as loaded */ };
        this.image.src = src;
    }

    update(deltaTime, game) {
        if (!this.active || !game.player || game.player.hp <= 0) return; // Also check if player is alive

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
            if (this.aiState === 'wandering' && distToPlayerSq < game.constants.ENEMY_SIGHT_RANGE_SQ) {
                this.aiState = 'chasing';
            }
        }

        let moveTargetX, moveTargetY, currentSpeed;

        if (this.aiState === 'chasing') {
           moveTargetX = game.player.centerX;
           moveTargetY = game.player.centerY;
           currentSpeed = this.speed;

           if (this.attackCooldown > 0) { this.attackCooldown -= deltaTime; if (this.attackCooldown < 0) this.attackCooldown = 0;}
           if (this.attackCooldown <= 0 && simpleCollisionCheck(this, game.player, 5)) {
                const actualDamage = this.damage; // Get current damage
                game.player.takeDamage(actualDamage, game); // Pass game object
                this.attackCooldown = 1000 + Math.random() * 300;
                // *** 新增：顯示敵人對玩家造成的傷害數字 (紅色) ***
                game.addDamageNumber(game.player.centerX, game.player.y, actualDamage, '#FF0000');
           }
       } else { // Wandering state
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

    draw(ctx) {
        if (!this.active) return;
        if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            super.draw(ctx); // Fallback drawing
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

    takeDamage(damage, game) { // Accept game argument
        if (!this.active) return;
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false;
            if (game.player) { // Check if player exists
                game.player.meat += this.meatReward;
                game.setMessage(`+${this.meatReward} 熊肉`, 800);
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
        this.colorTrunk = '#A0522D';
        this.colorLeaves = '#228B22';
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.colorTrunk;
        ctx.fillRect(this.x + this.width * 0.3, this.y + this.height * 0.4, this.width * 0.4, this.height * 0.6);
        ctx.fillStyle = this.colorLeaves;
        const crownCenterX = this.x + this.width / 2;
        const crownCenterY = this.y + this.height * 0.3;
        const crownRadius = this.width / 1.8;
        ctx.beginPath(); ctx.arc(crownCenterX, crownCenterY, crownRadius, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(crownCenterX + crownRadius * 0.3, crownCenterY - crownRadius * 0.2, crownRadius * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(crownCenterX - crownRadius * 0.3, crownCenterY - crownRadius * 0.1, crownRadius * 0.7, 0, Math.PI * 2); ctx.fill();
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
    constructor(x, y, target, shooter, gameConstants) {
        super(x, y, 8, 8);
        this.radius = 4;
        this.color = (shooter instanceof Player) ? '#9ACD32' : '#FF4500'; // Player bullets are green, tower red
        this.constants = gameConstants;
        this.speed = this.constants.BULLET_SPEED;
        this.target = target;
        this.damage = (shooter instanceof Player) ? shooter.attackDamage : this.constants.BULLET_DAMAGE;
        this.shooter = shooter;
        this.prevX = x;
        this.prevY = y;
    }
    update(deltaTime, game) {
        if (!this.active) return;
        this.prevX = this.x;
        this.prevY = this.y;

        if (!this.target || !this.target.active) {
            this.active = false; return;
        }

        const targetCenterX = this.target.centerX;
        const targetCenterY = this.target.centerY;
        const dx = targetCenterX - (this.x + this.radius);
        const dy = targetCenterY - (this.y + this.radius);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitThreshold = this.radius + (this.target.width / 3);

        if (dist < hitThreshold) {
            const damageDealt = this.damage; // Store damage before applying
            this.target.takeDamage(damageDealt, game);
            this.active = false;
             // *** 新增：顯示傷害數字 (根據子彈顏色決定) ***
             const damageColor = this.color; // Use bullet's own color
             game.addDamageNumber(this.target.centerX, this.target.y, damageDealt, damageColor);
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }

        if (this.x < -this.radius * 10 || this.x > game.constants.WORLD_WIDTH + this.radius * 10 ||
            this.y < -this.radius * 10 || this.y > game.constants.WORLD_HEIGHT + this.radius * 10) {
            this.active = false;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        // Draw trail
        if (this.prevX !== undefined && this.prevY !== undefined && (this.x !== this.prevX || this.y !== this.prevY)) {
            ctx.save();
            const trailColor = (this.shooter instanceof Player) ? `rgba(154, 205, 50, ${this.constants.BULLET_TRAIL_OPACITY})` : `rgba(255, 69, 0, ${this.constants.BULLET_TRAIL_OPACITY})`;
            ctx.strokeStyle = trailColor;
            ctx.lineWidth = this.radius * 1.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.prevX + this.radius, this.prevY + this.radius);
            ctx.lineTo(this.x + this.radius, this.y + this.radius);
            ctx.stroke();
            ctx.restore();
        }
        // Draw bullet
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.radius, this.y + this.radius, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
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
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; ctx.lineWidth = currentLineWidth; ctx.lineCap = 'round';
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
            // *** 新增：顯示傷害數字 (黃綠色) ***
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

// --- 新增：傷害數字類 ---
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
    draw(ctx) {
        if (!this.active) return;
        super.draw(ctx); ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; ctx.lineWidth = 1; ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.save(); ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.shadowBlur = 2;
        ctx.fillStyle = (this.type === 'trading_post' || this.type === 'research_lab' || this.type === 'healing_room') ? 'white' : '#333';
        ctx.font = "bold 14px 'Nunito', sans-serif"; ctx.textAlign = 'center';
        let text = "", subText = "";
        switch(this.type) {
            case 'trading_post': text = "交易站"; subText = "(熊肉 ➔ 金幣)"; break;
            case 'research_lab': text = "研究室"; subText = "(靠近自動升級)"; break;
            case 'healing_room': text = "治療室"; subText = "(靠近自動治療)"; break;
            case 'weapon_shop': text = "武器店"; subText = "(功能待定)"; break;
        }
        ctx.fillText(text, this.centerX, this.y + 18); ctx.font = "11px 'Nunito', sans-serif"; ctx.fillText(subText, this.centerX, this.y + 34);
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
        this.damageNumbers = []; // <--- 新增：存儲傷害數字的數組
        this.tradingPost = null; this.researchLab = null; this.weaponShop = null; this.healingRoom = null;
        this.keysPressed = {}; this.enemySpawnTimer = 0; this.gameRunning = false;
        this.messageTimer = 0; this.messageText = ''; this.lastTime = 0;
        this.listenersAttached = false; this.imagesToLoad = 0; this.imagesLoaded = 0;
        this.areImagesLoaded = false; this.camera = { x: 0, y: 0 };
    }

    loadConstants() {
        const TILE_SIZE = 40;
        const WORLD_HEIGHT = 1800;
        const shopHeight = TILE_SIZE * 2; const yBase = WORLD_HEIGHT / 2; const ySpacing = TILE_SIZE * 2.5;
        const topBuildingY = yBase - ySpacing; const bottomBuildingY = yBase + ySpacing + shopHeight; const verticalBuffer = TILE_SIZE * 2;

        return {
            PLAYER_IMAGE_DATA_URL: 'https://lh3.googleusercontent.com/d/1ZbALRrI1ovwRX2H7uK91kezYkNZKOJTZ',
            ENEMY_IMAGE_DATA_URL: 'https://lh3.googleusercontent.com/d/1BXLyjksU2o8tT9T5suuzYa0mxVowEp2a',
            WORLD_WIDTH: 2400, WORLD_HEIGHT: WORLD_HEIGHT,
            get SAFE_ZONE_WIDTH() { const sw=TILE_SIZE*2; const sm=TILE_SIZE*2; const sb=TILE_SIZE*3; return sm+sw+sb; },
            get SAFE_ZONE_TOP_Y() { return topBuildingY - verticalBuffer; },
            get SAFE_ZONE_BOTTOM_Y() { return bottomBuildingY + verticalBuffer; },
            CANVAS_WIDTH: 1200, CANVAS_HEIGHT: 710,
            TILE_SIZE: TILE_SIZE, PLAYER_SPEED: 3,
            ENEMY_SPAWN_RATE_BASE: 1500,
            ENEMY_SPAWN_RATE_SCALE_PER_LEVEL: 0.97,
            MAX_ENEMIES_BASE: 15,
            MAX_ENEMIES_INCREASE_PER_LEVEL: 2,
            ENEMY_HP_BASE: 30,
            ENEMY_DAMAGE_BASE: 10,
            MEAT_AWARD_BASE: 1,
            INITIAL_ENEMIES: 5,
            ENEMY_WANDER_CHANGE_DIR_TIME: 3000,
            ENEMY_SIGHT_RANGE_SQ: (TILE_SIZE * 15) ** 2,
            ENEMY_COLLISION_DIST_SQ: (TILE_SIZE * 1.5) ** 2,
            SAFE_SPAWN_DIST_SQ: (TILE_SIZE * 10) ** 2,
            TIME_PER_DIFFICULTY_LEVEL: 20000,
            ENEMY_HP_SCALING_FACTOR: 0.12,
            ENEMY_DAMAGE_SCALING_FACTOR: 0.08,
            MEAT_AWARD_SCALING_FACTOR: 1.50,
            ENEMY_BOOST_FACTOR_PER_5_LEVELS: 1.6,
            ENEMY_SPEED_BASE: 1.0, ENEMY_WANDER_SPEED: 0.5, // Keep enemy speed constant for now
            TREE_RESPAWN_TIME_MIN: 7000, TREE_RESPAWN_TIME_MAX: 11000, INITIAL_TREES: 50,
            TOWER_RANGE: 180, TOWER_FIRE_RATE: 900,
            PLAYER_HP_MAX_UPGRADED: 150,
            FENCE_COST: 1, TOWER_COST: 5,
            BULLET_DAMAGE: 12, MEAT_VALUE: 4,
            CLEAVER_MAX_LEVEL: 5, CLEAVER_BASE_DAMAGE: 16,
            CLEAVER_DAMAGE_INCREASE_PER_LEVEL: 5, CLEAVER_BASE_COOLDOWN: 600,
            CLEAVER_COOLDOWN_MULTIPLIER: 1.6, // *** 修改：大幅提升攻速的乘數 (>1) ***
            CLEAVER_RANGE: TILE_SIZE * 2.5, CLEAVER_COSTS: [0, 25, 60, 130, 250],
            BOW_MAX_LEVEL: 5, BOW_DAMAGE_INCREASE_PER_LEVEL: 6,
            BOW_COOLDOWN_MULTIPLIER: 0.96, // 弓箭仍然使用<1的乘數進一步縮短CD
            BOW_BASE_RANGE: TILE_SIZE * 5, BOW_RANGE_INCREASE_PER_LEVEL: TILE_SIZE * 0.75,
            BOW_COSTS: [0, 400, 900, 2000, 4000],
            HEALING_COST_PER_HP: 1, HEALING_RATE: 200, WEAPON_UPGRADE_COOLDOWN: 2000,
            ARROW_SPEED: 8, ARROW_LENGTH: TILE_SIZE * 0.8,
            BULLET_SPEED: 10, BULLET_TRAIL_OPACITY: 0.4,
            SLASH_EFFECT_DURATION: 150,
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
        this.damageNumbers = []; // <--- 新增：重置時清空
        this.keysPressed = {}; this.enemySpawnTimer = 0; this.messageText = '';
        this.messageTimer = 0; this.imagesLoaded = 0; this.areImagesLoaded = false;
        this.gameRunning = false; this.camera = { x: 0, y: 0 };
        this.tradingPost = null; this.researchLab = null; this.weaponShop = null; this.healingRoom = null;
        this.elapsedGameTime = 0; this.difficultyLevel = 1;
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
        for (let i = 0; i < this.constants.INITIAL_ENEMIES; i++) { this.spawnEnemy(true, 1); }
    }

    loadGameImages() {
        console.log("載入遊戲圖片...");
        this.imagesToLoad = 0; this.imagesLoaded = 0; let playerImageLoaded = false; let enemyImageLoaded = false;

        if (this.player && this.player.image && this.constants.PLAYER_IMAGE_DATA_URL) {
            this.imagesToLoad++;
            this.player.image.onload = () => { console.log("玩家圖片載入成功"); this.player.imageLoaded = true; playerImageLoaded = true; this.imageLoadCallback(); };
            this.player.image.onerror = () => { console.error(`載入玩家圖片錯誤: ${this.constants.PLAYER_IMAGE_DATA_URL}`); this.player.imageLoaded = true; playerImageLoaded = true; this.imageLoadCallback(); };
            if (this.player.image.complete && this.player.image.naturalWidth > 0) { console.log("玩家圖片已緩存"); this.player.imageLoaded = true; playerImageLoaded = true; }
        } else if (this.player) { console.warn("玩家圖片URL或對象未定義"); this.player.imageLoaded = true; playerImageLoaded = true; }
         else { console.error("Player對象未創建"); playerImageLoaded = true; }

        if (this.constants.ENEMY_IMAGE_DATA_URL) {
            this.imagesToLoad++; const enemyImage = new Image();
            enemyImage.onload = () => { console.log("敵人圖片載入成功"); enemyImageLoaded = true; this.imageLoadCallback(); };
            enemyImage.onerror = () => { console.error(`載入敵人圖片錯誤: ${this.constants.ENEMY_IMAGE_DATA_URL}`); enemyImageLoaded = true; this.imageLoadCallback(); };
            enemyImage.src = this.constants.ENEMY_IMAGE_DATA_URL;
            if (enemyImage.complete && enemyImage.naturalWidth > 0) { console.log("敵人圖片已緩存"); enemyImageLoaded = true; }
        } else { console.warn("敵人圖片URL未定義"); enemyImageLoaded = true; }

        const initiallyLoadedCount = (playerImageLoaded ? 1 : 0) + (enemyImageLoaded ? 1 : 0);
         if (initiallyLoadedCount >= this.imagesToLoad && this.imagesToLoad > 0) {
              console.log("所有圖片已在緩存中。"); this.imagesLoaded = this.imagesToLoad; this.areImagesLoaded = true; this.startGameLoop();
         } else if (this.imagesToLoad === 0) {
             console.warn("沒有需要預載的圖片。"); this.areImagesLoaded = true; this.startGameLoop();
         } else { console.log(`需要載入 ${this.imagesToLoad} 張圖片。等待回調...`); }
    }

    imageLoadCallback() {
        this.imagesLoaded++; console.log(`圖片載入進度: ${this.imagesLoaded}/${this.imagesToLoad}`);
        if (this.imagesLoaded >= this.imagesToLoad && !this.areImagesLoaded) {
            this.areImagesLoaded = true; console.log("圖片載入完成(回調)。"); this.startGameLoop();
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
        const difficultyCheckTime = this.difficultyLevel * this.constants.TIME_PER_DIFFICULTY_LEVEL;
        if (this.elapsedGameTime >= difficultyCheckTime) {
            this.difficultyLevel++; console.log(`難度提升至 ${this.difficultyLevel}`);
            this.setMessage(`難度提升! 等級 ${this.difficultyLevel}`, 2500);
        }

        // Update Entities
        try { this.player.update(deltaTime, this); } catch (e) { console.error("玩家更新錯誤:", e); this.gameOver("玩家更新錯誤"); return; }
        this.arrows.forEach(e => { try { if(e.active) e.update(deltaTime, this); } catch(err){ console.error("箭矢更新錯誤", err, e); e.active=false; }});
        this.bullets.forEach(e => { try { if(e.active) e.update(deltaTime, this); } catch(err){ console.error("子彈更新錯誤", err, e); e.active=false; }});
        this.towers.forEach(e => { try { if(e.active) e.update(deltaTime, this); } catch(err){ console.error("塔更新錯誤", err, e); e.active=false; }});
        this.enemies.forEach(e => { try { if(e.active) e.update(deltaTime, this); } catch(err){ console.error("敵人更新錯誤", err, e); e.active=false; }});
        this.slashEffects.forEach(e => { try { if(e.active) e.update(deltaTime); } catch(err){ console.error("特效更新錯誤", err, e); e.active=false; }});
        this.damageNumbers.forEach(dn => dn.update(deltaTime)); // <--- 新增：更新傷害數字

        this.updateCamera();

        // Update Message Timer
        if (this.messageTimer > 0) {
            this.messageTimer -= deltaTime;
            if (this.messageTimer <= 0) { this.messageText = ''; this.messageTimer = 0; }
        }

        // Spawn Enemies (with dynamic rate/max)
        this.enemySpawnTimer += deltaTime;
        const currentSpawnRate = this.constants.ENEMY_SPAWN_RATE_BASE * (this.constants.ENEMY_SPAWN_RATE_SCALE_PER_LEVEL ** (this.difficultyLevel - 1));
        const currentMaxEnemies = Math.floor(this.constants.MAX_ENEMIES_BASE + this.constants.MAX_ENEMIES_INCREASE_PER_LEVEL * (this.difficultyLevel - 1));
        const activeEnemyCount = this.enemies.filter(e => e.active).length;
        if (this.enemySpawnTimer >= currentSpawnRate && activeEnemyCount < currentMaxEnemies) {
            if (this.spawnEnemy(false, this.difficultyLevel)) { this.enemySpawnTimer = 0; }
            else { this.enemySpawnTimer = currentSpawnRate * 0.5; } // Try sooner if spawn failed
        }

        // Cleanup Inactive Objects
        this.enemies = this.enemies.filter(e => e.active);
        this.arrows = this.arrows.filter(a => a.active);
        this.bullets = this.bullets.filter(b => b.active);
        this.fences = this.fences.filter(f => f.active);
        this.towers = this.towers.filter(t => t.active);
        this.slashEffects = this.slashEffects.filter(s => s.active);
        this.damageNumbers = this.damageNumbers.filter(dn => dn.active); // <--- 新增：清理傷害數字

        // Check Game Over
        if (this.player.hp <= 0) { this.gameOver("你陣亡了！"); }
    }

    draw() {
        if (!this.ctx || !this.player || !this.areImagesLoaded) return;
        // Clear Canvas
        this.ctx.save(); this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.ctx.restore();
        // Apply Camera
        this.ctx.save(); this.ctx.translate(-this.camera.x, -this.camera.y);
        // Draw Background
        this.drawWorldBackground();
        // Draw Entities
        const cam=this.camera; const cw=this.canvas.width; const ch=this.canvas.height;
        this.trees.forEach(e=>e.isRectInView(cam,cw,ch,50)&&e.draw(this.ctx));
        if(this.tradingPost && this.tradingPost.isRectInView(cam,cw,ch)) this.tradingPost.draw(this.ctx);
        if(this.researchLab && this.researchLab.isRectInView(cam,cw,ch)) this.researchLab.draw(this.ctx);
        if(this.healingRoom && this.healingRoom.isRectInView(cam,cw,ch)) this.healingRoom.draw(this.ctx);
        // Draw Safe Zone Text (after shops, before other entities)
        this.drawSafeZoneText(); // <--- 將文字繪製抽取為獨立函數調用
        this.fences.forEach(e=>e.isRectInView(cam,cw,ch)&&e.draw(this.ctx));
        this.towers.forEach(e=>e.isRectInView(cam,cw,ch)&&e.draw(this.ctx));
        this.slashEffects.forEach(e=>e.draw(this.ctx));
        this.arrows.forEach(e=>e.isRectInView(cam,cw,ch,this.constants.ARROW_LENGTH*2)&&e.draw(this.ctx));
        this.bullets.forEach(e=>e.isRectInView(cam,cw,ch,20)&&e.draw(this.ctx));
        this.enemies.forEach(e=>e.isRectInView(cam,cw,ch,50)&&e.draw(this.ctx));
        if(this.player.isRectInView(cam,cw,ch,10)) this.player.draw(this.ctx);
        // Draw Damage Numbers (on top of entities)
        this.damageNumbers.forEach(dn => dn.draw(this.ctx)); // <--- 新增：繪製傷害數字
        // Restore Camera
        this.ctx.restore();
        // Draw UI
        this.drawHUD();
        this.drawMessages();
    }

    // --- 新增：獨立繪製安全區文字的函數 ---
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
        let targetX = this.player.centerX - this.canvas.width / 2;
        let targetY = this.player.centerY - this.canvas.height / 2;
        const lerpFactor = 0.1;
        this.camera.x += (targetX - this.camera.x) * lerpFactor;
        this.camera.y += (targetY - this.camera.y) * lerpFactor;
        this.camera.x = Math.max(0, Math.min(this.constants.WORLD_WIDTH - this.canvas.width, this.camera.x));
        this.camera.y = Math.max(0, Math.min(this.constants.WORLD_HEIGHT - this.canvas.height, this.camera.y));
    }

    drawHUD() {
        if (!this.ctx || !this.player) return;
        const hudPadding=15, barHeight=20, barWidth=180, iconSize=22, textOffsetY=15, spacing=15, hpBarX=hudPadding, hpBarY=hudPadding, cornerRadius=4;
        this.ctx.save(); this.ctx.shadowColor = 'rgba(0,0,0,0.7)'; this.ctx.shadowOffsetX=1; this.ctx.shadowOffsetY=1; this.ctx.shadowBlur=3;
        // HP Bar
        this.ctx.fillStyle = 'rgba(0,0,0,0.6)'; this.drawRoundedRect(this.ctx, hpBarX-2, hpBarY-2, barWidth+4, barHeight+4, cornerRadius);
        this.ctx.fillStyle = '#555'; this.drawRoundedRect(this.ctx, hpBarX, hpBarY, barWidth, barHeight, cornerRadius);
        const hpRatio = Math.max(0, this.player.hp / this.player.maxHp);
        if (hpRatio > 0.6) this.ctx.fillStyle='#22c55e'; else if (hpRatio > 0.3) this.ctx.fillStyle='#facc15'; else this.ctx.fillStyle='#ef4444';
        this.drawRoundedRect(this.ctx, hpBarX, hpBarY, barWidth * hpRatio, barHeight, cornerRadius, true, hpRatio < 1);
        this.ctx.fillStyle = 'white'; this.ctx.font = "bold 12px 'Nunito', sans-serif"; this.ctx.textAlign = 'center';
        this.ctx.fillText(`${Math.ceil(this.player.hp)} / ${this.player.maxHp}`, hpBarX + barWidth / 2, hpBarY + textOffsetY - 1);
        // Resources
        let currentX = hpBarX + barWidth + spacing * 1.5;
        // Gold
        const goldIconX = currentX; const goldIconY = hpBarY + barHeight / 2 - iconSize / 2; const goldTextX = goldIconX + iconSize + spacing / 2;
        this.ctx.fillStyle='#facc15'; this.ctx.beginPath(); this.ctx.arc(goldIconX+iconSize/2, goldIconY+iconSize/2, iconSize/2, 0, Math.PI*2); this.ctx.fill();
        this.ctx.fillStyle='#ca8a04'; this.ctx.beginPath(); this.ctx.arc(goldIconX+iconSize/2, goldIconY+iconSize/2, iconSize/3, 0, Math.PI*2); this.ctx.fill();
        this.ctx.fillStyle='white'; this.ctx.font = "bold 10px 'Nunito'"; this.ctx.textAlign='center'; this.ctx.fillText('G', goldIconX+iconSize/2, goldIconY+iconSize/2+4);
        this.ctx.fillStyle='white'; this.ctx.font = "bold 15px 'Nunito', sans-serif"; this.ctx.textAlign='left'; const goldText=`${this.player.gold}`; this.ctx.fillText(goldText, goldTextX, hpBarY+textOffsetY); currentX = goldTextX + this.ctx.measureText(goldText).width + spacing * 2;
        // Wood
        const woodIconX = currentX; const woodIconY = hpBarY + barHeight / 2 - iconSize / 2; const woodTextX = woodIconX + iconSize + spacing / 2;
        this.ctx.fillStyle='#a16207'; this.drawRoundedRect(this.ctx, woodIconX, woodIconY, iconSize*0.8, iconSize, 3);
        this.ctx.fillStyle='#ca8a04'; this.ctx.fillRect(woodIconX+3, woodIconY+3, iconSize*0.8-6, 2); this.ctx.fillRect(woodIconX+3, woodIconY+iconSize-5, iconSize*0.8-6, 2);
        this.ctx.fillStyle='white'; this.ctx.font = "bold 15px 'Nunito', sans-serif"; this.ctx.textAlign='left'; const woodText=`${this.player.wood}`; this.ctx.fillText(woodText, woodTextX, hpBarY+textOffsetY); currentX = woodTextX + this.ctx.measureText(woodText).width + spacing * 2;
        // Meat
        const meatIconX = currentX; const meatIconY = hpBarY + barHeight / 2 - iconSize / 2; const meatTextX = meatIconX + iconSize + spacing / 2;
        this.ctx.fillStyle='#f472b6'; this.ctx.beginPath(); this.ctx.ellipse(meatIconX+iconSize/2, meatIconY+iconSize/2, iconSize/2.2, iconSize/2.8, Math.PI/5, 0, Math.PI*2); this.ctx.fill();
        this.ctx.fillStyle='rgba(255,255,255,0.5)'; this.ctx.beginPath(); this.ctx.ellipse(meatIconX+iconSize/2-2, meatIconY+iconSize/2-2, iconSize/6, iconSize/8, Math.PI/5, 0, Math.PI*2); this.ctx.fill();
        this.ctx.fillStyle='white'; this.ctx.font = "bold 15px 'Nunito', sans-serif"; this.ctx.textAlign='left'; const meatText=`${this.player.meat}`; this.ctx.fillText(meatText, meatTextX, hpBarY+textOffsetY); currentX = meatTextX + this.ctx.measureText(meatText).width + spacing * 2;
        // Weapon Levels
        const weaponTextY = hpBarY + textOffsetY; const cleaverText=`🔪 ${this.player.cleaverLevel}`; let bowText = this.player.bowUnlocked ? (this.player.bowLevel > 0 ? `🏹 ${this.player.bowLevel}` : '🏹 -') : '🏹 未解鎖';
        this.ctx.fillStyle='white'; this.ctx.font = "bold 14px 'Nunito', sans-serif"; this.ctx.textAlign='left'; const cleaverWidth = this.ctx.measureText(cleaverText).width; this.ctx.fillText(cleaverText, currentX, weaponTextY); currentX += cleaverWidth + spacing * 1.5; this.ctx.fillText(bowText, currentX, weaponTextY);
        // Difficulty Level
        const difficultyText = `關卡: ${this.difficultyLevel}`; this.ctx.fillStyle='#f97316'; this.ctx.font = "bold 14px 'Nunito', sans-serif"; this.ctx.textAlign = 'right'; this.ctx.fillText(difficultyText, this.canvas.width - hudPadding, hpBarY + textOffsetY);
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

    // --- 新增：創建傷害數字的方法 ---
    addDamageNumber(x, y, amount, color) {
        this.damageNumbers.push(new DamageNumber(x, y, amount, color, this.constants));
    }

    spawnEnemy(allowAnywhere = false, difficultyLevel = 1) {
        const size = this.constants.TILE_SIZE * 1.2;
        let x, y, attempts = 0; const maxAttempts = 50; const constants = this.constants;
        do {
            x = Math.random() * (constants.WORLD_WIDTH - size); y = Math.random() * (constants.WORLD_HEIGHT - size); attempts++;
        } while (
            ( (!allowAnywhere && ( (x+size/2 < constants.SAFE_ZONE_WIDTH && y+size/2 > constants.SAFE_ZONE_TOP_Y && y+size/2 < constants.SAFE_ZONE_BOTTOM_Y) || (this.player && this.player.hp > 0 && distanceSqValues(x+size/2,y+size/2,this.player.centerX,this.player.centerY)<constants.SAFE_SPAWN_DIST_SQ))) ||
              this.enemies.some(e => e.active && distanceSqValues(x+size/2, y+size/2, e.centerX, e.centerY) < constants.ENEMY_COLLISION_DIST_SQ) ) && attempts < maxAttempts );
        if (attempts >= maxAttempts) return false;
        if (!allowAnywhere && x+size/2 < constants.SAFE_ZONE_WIDTH && y+size/2 > constants.SAFE_ZONE_TOP_Y && y+size/2 < constants.SAFE_ZONE_BOTTOM_Y) return false;
        this.enemies.push(new Enemy(x, y, size, size, constants, difficultyLevel)); return true;
    }

    spawnTree(allowAnywhere = false) {
        const width = this.constants.TILE_SIZE; const height = this.constants.TILE_SIZE * 1.5; const margin = this.constants.TILE_SIZE; // *** 修正：使用 this.constants.TILE_SIZE ***
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

    addSlashEffect(attacker, target) { this.slashEffects.push(new SlashEffect(attacker, target, this.constants)); }

    addBullet(shooter, target) {
        const startX = shooter.centerX - 4; const startY = shooter.centerY - 4;
        this.bullets.push(new Bullet(startX, startY, target, shooter, this.constants));
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