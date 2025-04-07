'use strict';

// 導入基礎實體類和工具函數
import { Entity } from './entity.js';
import { distanceSq, distanceSqValues, simpleCollisionCheck } from './utils.js';

// --- 敵人類 ---
// 繼承自 Entity 類，代表遊戲中的敵人單位
export class Enemy extends Entity {
    static nextId = 0;
    /**
     * 創建一個敵人實例。
     * @param {number} x - 初始 X 座標
     * @param {number} y - 初始 Y 座標
     * @param {number} width - 寬度
     * @param {number} height - 高度
     * @param {object} gameConstants - 遊戲常量對象
     * @param {number} difficultyLevel - 當前遊戲難度等級
     * @param {string} [enemyType='normal'] - 敵人類型 ('normal', 'mini-boss', 'boss')
     * @param {string|null} [imageUrl=null] - 敵人圖片的 URL，如果為 null 則使用默認或類型特定的圖片
     */
    constructor(x, y, width, height, gameConstants, difficultyLevel, enemyType = 'normal', imageUrl = null) {
        // 調用父類構造函數，設置基礎屬性和顏色（根據類型）
        super(x, y, width, height, enemyType === 'boss' ? 'darkred' : (enemyType === 'mini-boss' ? 'purple' : 'saddlebrown'));
        this.id = Enemy.nextId++;
        this.constants = gameConstants; // 保存常量引用
        this.difficultyLevel = difficultyLevel; // 保存難度等級
        this.enemyType = enemyType; // 保存敵人類型

        // --- 計算屬性縮放 ---
        const levelFactor = this.difficultyLevel - 1; // 等級因子，從 0 開始
        const hpScale = 1 + levelFactor * this.constants.ENEMY_HP_SCALING_FACTOR;
        const dmgScale = 1 + levelFactor * this.constants.ENEMY_DAMAGE_SCALING_FACTOR;
        const diamondScale = 1 + levelFactor * this.constants.diamond_AWARD_SCALING_FACTOR;
        const boostTiers = Math.floor(this.difficultyLevel / 5);
        const boostMultiplier = (this.constants.ENEMY_BOOST_FACTOR_PER_5_LEVELS ** boostTiers);

        // 計算基礎屬性（應用縮放和增強）
        const baseHp = this.constants.ENEMY_HP_BASE * hpScale * boostMultiplier;
        let baseDamage = this.constants.ENEMY_DAMAGE_BASE * dmgScale * boostMultiplier;
        const basediamond = this.constants.diamond_AWARD_BASE * diamondScale;

        // --- 根據敵人類型調整屬性 ---
        if (this.enemyType === 'mini-boss') {
            this.maxHp = Math.ceil(baseHp * this.constants.MINI_BOSS_HP_MULTIPLIER);
            this.damage = Math.ceil(baseDamage * this.constants.MINI_BOSS_DAMAGE_MULTIPLIER);
            this.diamondReward = Math.ceil(basediamond * 1.5);
            this.speed = this.constants.ENEMY_SPEED_BASE * 0.9 + (Math.random() * 0.4 - 0.2);
            this.color = 'purple';
        } else if (this.enemyType === 'boss') {
            this.maxHp = Math.ceil(baseHp * this.constants.BOSS_HP_MULTIPLIER);
            this.damage = Math.ceil(baseDamage * this.constants.BOSS_DAMAGE_MULTIPLIER);
            this.diamondReward = Math.ceil(basediamond * 3);
            this.speed = this.constants.ENEMY_SPEED_BASE * 0.8 + (Math.random() * 0.4 - 0.2);
            this.color = 'darkred';
        } else { // normal
            this.maxHp = Math.ceil(baseHp);
            this.damage = Math.ceil(baseDamage);
            this.diamondReward = Math.ceil(basediamond);
            this.speed = this.constants.ENEMY_SPEED_BASE + (Math.random() * 0.4 - 0.2);
            this.color = 'saddlebrown';
        }
        this.hp = this.maxHp;
        this.speed = Math.max(0.3, this.speed);

        // --- 計算經驗值獎勵 ---
        const baseXP = this.constants.XP_REWARD_BASE;
        const levelMultiplier = Math.pow(this.constants.XP_REWARD_LEVEL_MULTIPLIER, this.difficultyLevel - 1);
        let bossMultiplier = 1;
        if (this.enemyType === 'mini-boss') bossMultiplier = this.constants.XP_REWARD_MINI_BOSS_MULTIPLIER;
        else if (this.enemyType === 'boss') bossMultiplier = this.constants.XP_REWARD_BOSS_MULTIPLIER;
        this.xpReward = Math.ceil(baseXP * levelMultiplier * bossMultiplier);

        // --- Boss 特殊攻擊計時器 ---
        this.threeSixtyAttackTimer = this.constants.MINI_BOSS_360_COOLDOWN + Math.random() * 500;
        this.targetedAttackTimer = this.constants.BOSS_TARGETED_COOLDOWN + Math.random() * 1000;

        // --- 其他狀態 ---
        this.attackCooldown = Math.random() * 1000;
        this.aiState = 'chasing';
        this.wanderTargetX = null;
        this.wanderTargetY = null;
        this.wanderTimer = 0;

        // --- 圖像加載 ---
        this.image = new Image();
        this.imageLoaded = false;
        this.loadImage(imageUrl || (this.enemyType === 'mini-boss' ? this.constants.MINI_BOSS_IMAGE_URL : (this.enemyType === 'boss' ? this.constants.BOSS_IMAGE_URL : this.constants.ENEMY_IMAGE_DATA_URL)));
        this.setNewWanderTarget(this.constants);
    }

    loadImage(src) {
        if (!src) {
            console.warn(`敵人 ${this.enemyType} (Level ${this.difficultyLevel}) 未提供圖片 URL，將使用顏色繪製。`);
            this.imageLoaded = true;
            return;
        }
        this.image.onload = () => { this.imageLoaded = true; };
        this.image.onerror = () => {
            console.error(`載入敵人圖片錯誤 (${this.enemyType}): ${src}`);
            this.imageLoaded = true;
        };
        this.image.src = src;
    }

    // --- Private Helper Methods for Update ---

    _updateAIState(player, constants) {
        const playerInSafeZone = player.centerX < constants.SAFE_ZONE_WIDTH &&
                                 player.centerY > constants.SAFE_ZONE_TOP_Y &&
                                 player.centerY < constants.SAFE_ZONE_BOTTOM_Y;
        const distToPlayerSq = distanceSq(this, player);

        if (playerInSafeZone) {
            if (this.aiState === 'chasing') {
                this.aiState = 'wandering';
                this.setNewWanderTarget(constants);
            }
        } else {
            if (this.aiState === 'wandering' && distToPlayerSq < constants.ENEMY_SIGHT_RANGE_SQ) {
                this.aiState = 'chasing';
            } else if (this.aiState !== 'wandering') {
                 this.aiState = 'chasing';
            }
        }
    }

    _updateMovement(deltaTime, game) {
        const player = game.player;
        const constants = game.constants;
        let moveTargetX = null, moveTargetY = null, currentSpeed = 0;

        // 根據 AI 狀態設置移動目標和速度
        if (this.aiState === 'chasing') {
            moveTargetX = player.centerX;
            moveTargetY = player.centerY;
            currentSpeed = this.speed;
        } else { // wandering
            this.wanderTimer -= deltaTime;
            if (this.wanderTimer <= 0 || this.wanderTargetX === null || distanceSqValues(this.centerX, this.centerY, this.wanderTargetX, this.wanderTargetY) < (constants.TILE_SIZE * 1.5)**2 ) {
                this.setNewWanderTarget(constants);
            }
            moveTargetX = this.wanderTargetX;
            moveTargetY = this.wanderTargetY;
            currentSpeed = constants.ENEMY_WANDER_SPEED;
        }

        // 執行移動
        if (moveTargetX !== null && moveTargetY !== null) {
            let dx = moveTargetX - this.centerX;
            let dy = moveTargetY - this.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const stopDistance = (this.aiState === 'chasing') ? (this.width / 2 + player.width / 2 - 5) : (constants.TILE_SIZE * 0.5);

            if (dist > stopDistance) {
                const moveX = (dx / dist) * currentSpeed;
                const moveY = (dy / dist) * currentSpeed;
                let nextX = this.x + moveX;
                let nextY = this.y + moveY;
                const nextCenterX = nextX + this.width / 2;
                const nextCenterY = nextY + this.height / 2;

                // 防止進入安全區
                if (nextCenterX < constants.SAFE_ZONE_WIDTH &&
                    nextCenterY > constants.SAFE_ZONE_TOP_Y &&
                    nextCenterY < constants.SAFE_ZONE_BOTTOM_Y)
                {
                    if (this.aiState === 'chasing') {
                        const pushBackDist = 5;
                        nextX -= (dx / dist) * pushBackDist;
                        nextY -= (dy / dist) * pushBackDist;
                    } else {
                        this.setNewWanderTarget(constants);
                        nextX = this.x; nextY = this.y;
                    }
                }

                // 應用移動，並限制在世界邊界內
                this.x = Math.max(0, Math.min(constants.WORLD_WIDTH - this.width, nextX));
                this.y = Math.max(0, Math.min(constants.WORLD_HEIGHT - this.height, nextY));
            }
        }

        // 與柵欄的碰撞檢測
        if (game.fences) {
            game.fences.forEach(fence => {
                if (fence.active && simpleCollisionCheck(this, fence)) {
                    fence.takeDamage(Infinity); // 敵人瞬間摧毀柵欄
                }
            });
        }
    }

    _handleAttacks(deltaTime, game) {
        const player = game.player;
        const constants = game.constants;

        // --- Boss 特殊攻擊邏輯 ---
        if (this.enemyType === 'mini-boss' || this.enemyType === 'boss') {
            this.threeSixtyAttackTimer -= deltaTime;
            if (this.threeSixtyAttackTimer <= 0) {
                this.performThreeSixtyAttack(game);
                this.threeSixtyAttackTimer = constants.MINI_BOSS_360_COOLDOWN + Math.random() * 500;
            }
        }
        if (this.enemyType === 'boss') {
            this.targetedAttackTimer -= deltaTime;
            if (this.targetedAttackTimer <= 0) {
                this.performTargetedAttack(game);
                this.targetedAttackTimer = constants.BOSS_TARGETED_COOLDOWN + Math.random() * 1000;
            }
        }

        // --- 近戰攻擊邏輯 ---
        if (this.aiState === 'chasing') { // 只有追擊時才近戰攻擊
            if (this.attackCooldown > 0) this.attackCooldown -= deltaTime;
            this.attackCooldown = Math.max(0, this.attackCooldown);

            if (this.attackCooldown <= 0 && simpleCollisionCheck(this, player, 5)) {
                const actualDamage = this.damage;
                player.takeDamage(actualDamage, game);
                this.attackCooldown = (this.enemyType === 'boss' ? 1500 : 1000) + Math.random() * 300;
            }
        }
    }

    /**
     * 更新敵人狀態（AI、移動、攻擊等）。
     * @param {number} deltaTime - 距離上一幀的時間差（毫秒）
     * @param {object} game - 遊戲主對象，用於訪問玩家、常量、添加投射物等
     */
    update(deltaTime, game) {
        if (!this.active || !game || !game.player || !game.player.active || !game.constants) return;

        this._updateAIState(game.player, game.constants);
        this._updateMovement(deltaTime, game);
        this._handleAttacks(deltaTime, game);
    }

    /**
     * 執行 360 度彈幕攻擊 (迷你 Boss 和 Boss)。
     * @param {object} game - 遊戲主對象，用於調用 addBossProjectile
     */
    performThreeSixtyAttack(game) {
        const bulletCount = 12;
        const angleIncrement = (Math.PI * 2) / bulletCount;
        const bulletSpeed = this.constants.BOSS_BULLET_SPEED * 0.6;
        const bulletDamage = this.damage * 0.4;
        const bulletColor = this.enemyType === 'boss' ? '#DA70D6' : '#FF8C00';

        for (let i = 0; i < bulletCount; i++) {
            const angle = i * angleIncrement;
            const directionDx = Math.cos(angle);
            const directionDy = Math.sin(angle);
            game.addBossProjectile(this, this.centerX, this.centerY, directionDx, directionDy, bulletSpeed, bulletDamage, bulletColor);
        }
    }

    /**
     * 執行朝向玩家的扇形彈幕攻擊 (僅 Boss)。
     * @param {object} game - 遊戲主對象，用於訪問玩家和調用 addBossProjectile
     */
    performTargetedAttack(game) {
        if (!game.player || !game.player.active) return;

        const bulletCount = this.constants.BOSS_TARGETED_BULLET_COUNT;
        const bulletSpeed = this.constants.BOSS_BULLET_SPEED;
        const bulletDamage = this.damage * 0.6;
        const bulletColor = '#FF4500';
        const spreadAngle = Math.PI / 18;

        const dx = game.player.centerX - this.centerX;
        const dy = game.player.centerY - this.centerY;
        const baseAngle = Math.atan2(dy, dx);

        for (let i = 0; i < bulletCount; i++) {
            const currentAngle = baseAngle + (i - (bulletCount - 1) / 2) * spreadAngle;
            const directionDx = Math.cos(currentAngle);
            const directionDy = Math.sin(currentAngle);
            game.addBossProjectile(this, this.centerX, this.centerY, directionDx, directionDy, bulletSpeed, bulletDamage, bulletColor);
        }
    }

    /**
     * 在畫布上繪製敵人。
     * @param {CanvasRenderingContext2D} ctx - 畫布的 2D 渲染上下文
     */
    draw(ctx) {
        if (!this.active) return;

        if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        this.drawHpBar(ctx);
    }

    /**
     * 繪製敵人的生命值條。
     * @param {CanvasRenderingContext2D} ctx - 畫布的 2D 渲染上下文
     */
    drawHpBar(ctx) {
        const barYOffset = 8;
        const barHeight = 4;
        const barWidth = this.width;
        const barX = this.x;
        const barY = this.y - barYOffset;

        if (barY < 0) return;

        const hpRatio = Math.max(0, this.hp / this.maxHp);

        ctx.fillStyle = '#444';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    }

    /**
     * 處理敵人受到傷害的邏輯。
     * @param {number} damage - 受到的傷害值
     * @param {object} game - 遊戲主對象，用於添加傷害數字
     * @returns {boolean} 如果敵人因此次傷害死亡，返回 true，否則返回 false
     */
    takeDamage(damage, game) {
        if (!this.active || !game) return false; // 如果敵人已失效或缺少 game 對象，直接返回 false

        this.hp -= damage;

        if (this.hp <= 0) {
            this.hp = 0; // 確保 HP 不為負數
            this.active = false; // 標記為失效
            return true; // 敵人死亡
        } else {
            // 可選：添加受擊效果
            return false; // 敵人未死亡
        }
    }

    /**
     * 為閒晃狀態設置一個新的隨機目標點。
     * 確保目標點不在安全區內。
     * @param {object} constants - 遊戲常量對象
     */
    setNewWanderTarget(constants) {
        if (!constants) return;

        const maxAttempts = 10;
        let attempts = 0;
        let targetX, targetY;
        const margin = constants.TILE_SIZE;

        do {
            targetX = Math.random() * (constants.WORLD_WIDTH - margin * 2) + margin;
            targetY = Math.random() * (constants.WORLD_HEIGHT - margin * 2) + margin;
            attempts++;
        } while (
             (targetX < constants.SAFE_ZONE_WIDTH &&
              targetY > constants.SAFE_ZONE_TOP_Y &&
              targetY < constants.SAFE_ZONE_BOTTOM_Y) &&
              attempts < maxAttempts
        );

        if (targetX < constants.SAFE_ZONE_WIDTH && targetY > constants.SAFE_ZONE_TOP_Y && targetY < constants.SAFE_ZONE_BOTTOM_Y) {
            targetX = constants.SAFE_ZONE_WIDTH + Math.random() * (constants.WORLD_WIDTH - constants.SAFE_ZONE_WIDTH - margin) + margin / 2;
        }

        this.wanderTargetX = targetX;
        this.wanderTargetY = targetY;

        do {
            targetX = Math.random() * (constants.WORLD_WIDTH - margin * 2) + margin;
            targetY = Math.random() * (constants.WORLD_HEIGHT - margin * 2) + margin;
            attempts++;
        } while (
             (targetX < constants.SAFE_ZONE_WIDTH &&
              targetY > constants.SAFE_ZONE_TOP_Y &&
              targetY < constants.SAFE_ZONE_BOTTOM_Y) &&
              attempts < maxAttempts
        );

        if (targetX < constants.SAFE_ZONE_WIDTH && targetY > constants.SAFE_ZONE_TOP_Y && targetY < constants.SAFE_ZONE_BOTTOM_Y) {
            targetX = constants.SAFE_ZONE_WIDTH + Math.random() * (constants.WORLD_WIDTH - constants.SAFE_ZONE_WIDTH - margin) + margin / 2;
        }

        this.wanderTargetX = targetX;
        this.wanderTargetY = targetY;
        this.wanderTimer = constants.ENEMY_WANDER_CHANGE_DIR_TIME + Math.random() * 2000;
    }
}
