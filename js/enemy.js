'use strict';

// 導入基礎實體類和工具函數
import { Entity } from './entity.js';
import { distanceSq, distanceSqValues, simpleCollisionCheck } from './utils.js';
import { NovaEffect, ShockwaveEffect } from './effects.js'; // 導入效果類

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
        let enemyColor;
        switch(enemyType) {
            case 'boss': enemyColor = 'darkred'; break;
            case 'mini-boss': enemyColor = 'purple'; break;
            case 'fast': enemyColor = 'lightgreen'; break;
            case 'tank': enemyColor = 'darkblue'; break;
            case 'ranged': enemyColor = 'orange'; break;
            case 'explosive': enemyColor = 'red'; break;
            case 'teleporter': enemyColor = 'cyan'; break;
            case 'summoner': enemyColor = 'magenta'; break;
            // 新增 Boss 顏色
            case 'mini-boss-a': enemyColor = '#FF6347'; break; // 番茄色
            case 'mini-boss-b': enemyColor = '#4682B4'; break; // 鋼藍色
            case 'new-boss': enemyColor = '#32CD32'; break;    // 酸橙綠
            default: enemyColor = 'saddlebrown';
        }
        super(x, y, width, height, enemyColor);
        
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

        // 基礎屬性計算
        const baseHp = Math.ceil(this.constants.ENEMY_HP_BASE * hpScale * boostMultiplier);
        const baseDamage = Math.ceil(this.constants.ENEMY_DAMAGE_BASE * dmgScale * boostMultiplier);
        const basediamond = Math.ceil(this.constants.diamond_AWARD_BASE * diamondScale);

        // --- 根據敵人類型調整屬性 ---
        switch(this.enemyType) {
            case 'mini-boss':
                this.maxHp = Math.ceil(baseHp * this.constants.MINI_BOSS_HP_MULTIPLIER);
                this.damage = Math.ceil(baseDamage * this.constants.MINI_BOSS_DAMAGE_MULTIPLIER);
                this.diamondReward = Math.ceil(basediamond * 1.5);
                this.speed = this.constants.ENEMY_SPEED_BASE * 0.9 + (Math.random() * 0.4 - 0.2);
                // 添加 Mini-Boss 特殊攻擊計時器
                this.threeSixtyAttackTimer = this.constants.MINI_BOSS_360_COOLDOWN + Math.random() * 500;
                break;
            case 'boss':
                this.maxHp = Math.ceil(baseHp * this.constants.BOSS_HP_MULTIPLIER);
                this.damage = Math.ceil(baseDamage * this.constants.BOSS_DAMAGE_MULTIPLIER);
                this.diamondReward = Math.ceil(basediamond * 3);
                this.speed = this.constants.ENEMY_SPEED_BASE * 0.8 + (Math.random() * 0.4 - 0.2);
                // 添加 Boss 特殊攻擊計時器
                this.threeSixtyAttackTimer = this.constants.MINI_BOSS_360_COOLDOWN + Math.random() * 500;
                this.targetedAttackTimer = this.constants.BOSS_TARGETED_COOLDOWN + Math.random() * 1000;
                break;
            // --- 新增 Boss 屬性 ---
            case 'mini-boss-a': // 快速衝撞型
                this.maxHp = Math.ceil(baseHp * this.constants.MINI_BOSS_HP_MULTIPLIER * 0.8); // HP 稍低
                this.damage = Math.ceil(baseDamage * this.constants.MINI_BOSS_DAMAGE_MULTIPLIER * 1.2); // 傷害稍高
                this.diamondReward = Math.ceil(basediamond * 1.8);
                this.speed = this.constants.ENEMY_SPEED_BASE * 1.7; // 速度較快
                this.xpMultiplier = this.constants.XP_REWARD_MINI_BOSS_MULTIPLIER * 1.1;
                // 特殊攻擊計時器
                this.dashAttackCooldown = 2500 + Math.random() * 1000;
                this.trackingBulletCooldown = 4000 + Math.random() * 1500;
                break;
            case 'mini-boss-b': // 召喚型
                this.maxHp = Math.ceil(baseHp * this.constants.MINI_BOSS_HP_MULTIPLIER * 1.2); // HP 較高
                this.damage = Math.ceil(baseDamage * this.constants.MINI_BOSS_DAMAGE_MULTIPLIER * 0.7); // 直接傷害較低
                this.diamondReward = Math.ceil(basediamond * 2.0);
                this.speed = this.constants.ENEMY_SPEED_BASE * 0.7; // 速度較慢
                this.xpMultiplier = this.constants.XP_REWARD_MINI_BOSS_MULTIPLIER * 1.2;
                // 特殊攻擊計時器
                this.summonMinionCooldown = 2000 + Math.random() * 2000;
                this.maxMinions = 9; // 最多召喚 4 個小兵
                this.summonedMinions = []; // 追蹤召喚的小兵
                break;
            case 'new-boss': // 新大王 - 混合型
                this.maxHp = Math.ceil(baseHp * this.constants.BOSS_HP_MULTIPLIER * 1.5); // HP 比原 Boss 稍高
                this.damage = Math.ceil(baseDamage * this.constants.BOSS_DAMAGE_MULTIPLIER * 1.3); // 傷害稍高
                this.diamondReward = Math.ceil(basediamond * 3.5);
                this.speed = this.constants.ENEMY_SPEED_BASE * 1.15; // 速度中等
                this.xpMultiplier = this.constants.XP_REWARD_BOSS_MULTIPLIER * 1.3;
                // 特殊攻擊計時器
                this.shockwaveAttackCooldown = 3200 + Math.random() * 1000;
                this.scatterShotCooldown = 2000 + Math.random() * 1000;
                break;
            // --- 結束新增 Boss 屬性 ---
            case 'fast':
                this.maxHp = Math.ceil(baseHp * this.constants.FAST_ENEMY_HP_MULTIPLIER);
                this.damage = Math.ceil(baseDamage * this.constants.FAST_ENEMY_DAMAGE_MULTIPLIER);
                this.diamondReward = Math.ceil(basediamond * 1.2);
                this.speed = this.constants.ENEMY_SPEED_BASE * this.constants.FAST_ENEMY_SPEED_MULTIPLIER;
                break;
            case 'tank':
                this.maxHp = Math.ceil(baseHp * this.constants.TANK_ENEMY_HP_MULTIPLIER);
                this.damage = Math.ceil(baseDamage * this.constants.TANK_ENEMY_DAMAGE_MULTIPLIER);
                this.diamondReward = Math.ceil(basediamond * 1.5);
                this.speed = this.constants.ENEMY_SPEED_BASE * this.constants.TANK_ENEMY_SPEED_MULTIPLIER;
                break;
            case 'ranged':
                this.maxHp = Math.ceil(baseHp * this.constants.RANGED_ENEMY_HP_MULTIPLIER);
                this.damage = Math.ceil(baseDamage * this.constants.RANGED_ENEMY_DAMAGE_MULTIPLIER);
                this.diamondReward = Math.ceil(basediamond * 1.3);
                this.speed = this.constants.ENEMY_SPEED_BASE * this.constants.RANGED_ENEMY_SPEED_MULTIPLIER;
                this.attackRange = this.constants.RANGED_ENEMY_ATTACK_RANGE;
                this.projectileSpeed = this.constants.RANGED_ENEMY_PROJECTILE_SPEED;
                this.rangedAttackCooldown = 1500 + Math.random() * 500;
                break;
            case 'explosive':
                this.maxHp = Math.ceil(baseHp * this.constants.EXPLOSIVE_ENEMY_HP_MULTIPLIER);
                this.damage = Math.ceil(baseDamage * this.constants.EXPLOSIVE_ENEMY_DAMAGE_MULTIPLIER);
                this.diamondReward = Math.ceil(basediamond * 1.4);
                this.speed = this.constants.ENEMY_SPEED_BASE * this.constants.EXPLOSIVE_ENEMY_SPEED_MULTIPLIER;
                this.explosionRadius = this.constants.EXPLOSIVE_ENEMY_EXPLOSION_RADIUS;
                this.explosionDamage = this.constants.EXPLOSIVE_ENEMY_EXPLOSION_DAMAGE * (1 + levelFactor * 0.1);
                break;
            case 'teleporter':
                this.maxHp = Math.ceil(baseHp * this.constants.TELEPORTER_ENEMY_HP_MULTIPLIER);
                this.damage = Math.ceil(baseDamage * this.constants.TELEPORTER_ENEMY_DAMAGE_MULTIPLIER);
                this.diamondReward = Math.ceil(basediamond * 1.3);
                this.speed = this.constants.ENEMY_SPEED_BASE * this.constants.TELEPORTER_ENEMY_SPEED_MULTIPLIER;
                this.teleportCooldown = this.constants.TELEPORTER_ENEMY_TELEPORT_COOLDOWN;
                this.teleportRange = this.constants.TELEPORTER_ENEMY_TELEPORT_RANGE;
                this.teleportTimer = Math.random() * 1000;
                break;
            case 'summoner':
                this.maxHp = Math.ceil(baseHp * this.constants.SUMMONER_ENEMY_HP_MULTIPLIER);
                this.damage = Math.ceil(baseDamage * this.constants.SUMMONER_ENEMY_DAMAGE_MULTIPLIER);
                this.diamondReward = Math.ceil(basediamond * 1.5);
                this.speed = this.constants.ENEMY_SPEED_BASE * this.constants.SUMMONER_ENEMY_SPEED_MULTIPLIER;
                this.summonCooldown = this.constants.SUMMONER_ENEMY_SUMMON_COOLDOWN;
                this.maxSummons = this.constants.SUMMONER_ENEMY_MAX_SUMMONS;
                this.summonTimer = Math.random() * 2000;
                this.summonedEnemies = [];
                break;
            default: // normal
                this.maxHp = Math.ceil(baseHp);
                this.damage = Math.ceil(baseDamage);
                this.diamondReward = Math.ceil(basediamond);
                this.speed = this.constants.ENEMY_SPEED_BASE + (Math.random() * 0.4 - 0.2);
        }
        
        // 其他初始化代碼...
        this.hp = this.maxHp;
        this.speed = Math.max(0.3, this.speed);

        // --- 計算經驗值獎勵 ---
        const baseXP = this.constants.XP_REWARD_BASE;
        const levelMultiplier = Math.pow(this.constants.XP_REWARD_LEVEL_MULTIPLIER, this.difficultyLevel - 1);
        // 使用前面計算的 xpMultiplier 或默認值
        const finalXpMultiplier = this.xpMultiplier || (this.enemyType === 'mini-boss' ? this.constants.XP_REWARD_MINI_BOSS_MULTIPLIER : (this.enemyType === 'boss' ? this.constants.XP_REWARD_BOSS_MULTIPLIER : 1));
        this.xpReward = Math.ceil(baseXP * levelMultiplier * finalXpMultiplier);


        // --- 其他狀態 ---
        this.attackCooldown = Math.random() * 1000;
        this.aiState = 'chasing';
        this.wanderTargetX = null;
        this.wanderTargetY = null;
        this.wanderTimer = 0;

        // --- 圖像加載 ---
        this.image = new Image();
        this.imageLoaded = false;
        // --- 更新圖像加載邏輯 ---
        let finalImageUrl = imageUrl;
        if (!finalImageUrl) {
            switch(this.enemyType) {
                case 'mini-boss': finalImageUrl = this.constants.MINI_BOSS_IMAGE_URL; break;
                case 'boss': finalImageUrl = this.constants.BOSS_IMAGE_URL; break;
                case 'mini-boss-a': finalImageUrl = this.constants.MINI_BOSS_A_IMAGE_URL; break;
                case 'mini-boss-b': finalImageUrl = this.constants.MINI_BOSS_B_IMAGE_URL; break;
                case 'new-boss': finalImageUrl = this.constants.NEW_BOSS_IMAGE_URL; break;
                // 添加其他敵人類型的圖像 URL
                case 'fast': finalImageUrl = this.constants.ENEMY_FAST_IMAGE_URL; break;
                case 'tank': finalImageUrl = this.constants.ENEMY_TANK_IMAGE_URL; break;
                case 'ranged': finalImageUrl = this.constants.ENEMY_RANGED_IMAGE_URL; break;
                case 'explosive': finalImageUrl = this.constants.ENEMY_EXPLOSIVE_IMAGE_URL; break;
                case 'teleporter': finalImageUrl = this.constants.ENEMY_TELEPORTER_IMAGE_URL; break;
                case 'summoner': finalImageUrl = this.constants.ENEMY_SUMMONER_IMAGE_URL; break;
                default: finalImageUrl = this.constants.ENEMY_IMAGE_DATA_URL;
            }
        }
        this.loadImage(finalImageUrl);
        // --- 結束更新圖像加載邏輯 ---
        this.setNewWanderTarget(this.constants);

        // 添加精灵动画相关属性
        this.spriteColumns = 6; // 每行6个帧
        this.spriteRows = 2;    // 共2行
        this.frameX = 0;        // 当前列
        this.frameY = 0;        // 当前行 (0=前面, 1=后面)
        this.animationSpeed = 360; // 调整动画速度
        this.lastFrameTime = 0;
        this.facingLeft = false; // 添加朝向标记
        this.lastMoveX = 0;     // 上一帧的X方向移动
        this.totalFrames = this.spriteColumns; // 每行的总帧数
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

        // 保存上一帧的移动方向
        const lastFacingLeft = this.facingLeft;

        // 根据 AI 状态设置移动目标和速度
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

        // 计算移动方向
        if (moveTargetX !== null && moveTargetY !== null) {
            const dx = moveTargetX - this.centerX;
            const dy = moveTargetY - this.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 更新朝向 - 修正朝向逻辑
            if (dist > 0) {
                // 向右移动时朝向右边，向左移动时朝向左边
                this.facingLeft = dx < 0;
                
                // 计算移动量
                let moveX = 0, moveY = 0;
                if (dist > 1) {
                    moveX = (dx / dist) * currentSpeed * (deltaTime / 1000);
                    moveY = (dy / dist) * currentSpeed * (deltaTime / 1000);
                }
                
                // 保存当前X方向移动
                this.lastMoveX = moveX;
            }
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
        // --- 修改攻擊處理 ---
        // this._handleAttacks(deltaTime, game); // 舊的統一處理方式
        this._handleSpecificAttacks(deltaTime, game); // 新的分類處理方式
        // --- 結束修改攻擊處理 ---
        this.updateAnimation(deltaTime); // 添加这一行

        // 根据敌人类型处理特殊行为 (部分移至 _handleSpecificAttacks)
        switch(this.enemyType) {
            case 'ranged':
                // this._handleRangedAttack(deltaTime, game); // 移至 _handleSpecificAttacks
                break;
            case 'teleporter':
                this._handleTeleport(deltaTime, game);
                break;
            case 'summoner':
                // this._handleSummon(deltaTime, game); // 移至 _handleSpecificAttacks
                break;
            // 其他非攻擊性特殊行為可以在這裡處理
        }
    }

    /**
     * 根據敵人類型處理不同的攻擊邏輯。
     * @param {number} deltaTime
     * @param {object} game
     */
    _handleSpecificAttacks(deltaTime, game) {
        // --- 通用近戰攻擊 ---
        if (this.aiState === 'chasing') {
            if (this.attackCooldown > 0) this.attackCooldown -= deltaTime;
            this.attackCooldown = Math.max(0, this.attackCooldown);

            if (this.attackCooldown <= 0 && simpleCollisionCheck(this, game.player, 5)) {
                const actualDamage = this.damage;
                game.player.takeDamage(actualDamage, game);
                // 基礎冷卻時間，Boss 類型可以有更長的冷卻
                let baseCooldown = 1000;
                if (this.enemyType.includes('boss')) baseCooldown = 1500;
                this.attackCooldown = baseCooldown + Math.random() * 300;
            }
        }

        // --- 特殊攻擊邏輯 ---
        switch(this.enemyType) {
            case 'mini-boss':
                if (this.threeSixtyAttackTimer > 0) this.threeSixtyAttackTimer -= deltaTime;
                if (this.threeSixtyAttackTimer <= 0) {
                    this.performThreeSixtyAttack(game);
                    this.threeSixtyAttackTimer = this.constants.MINI_BOSS_360_COOLDOWN + Math.random() * 500;
                }
                break;
            case 'boss':
                if (this.threeSixtyAttackTimer > 0) this.threeSixtyAttackTimer -= deltaTime;
                if (this.targetedAttackTimer > 0) this.targetedAttackTimer -= deltaTime;
                if (this.threeSixtyAttackTimer <= 0) {
                    this.performThreeSixtyAttack(game);
                    this.threeSixtyAttackTimer = this.constants.MINI_BOSS_360_COOLDOWN + Math.random() * 500;
                }
                if (this.targetedAttackTimer <= 0) {
                    this.performTargetedAttack(game);
                    this.targetedAttackTimer = this.constants.BOSS_TARGETED_COOLDOWN + Math.random() * 1000;
                }
                break;
            case 'mini-boss-a':
                this._handleMiniBossAAttack(deltaTime, game);
                break;
            case 'mini-boss-b':
                this._handleMiniBossBAttack(deltaTime, game);
                break;
            case 'new-boss':
                this._handleNewBossAttack(deltaTime, game);
                break;
            case 'ranged':
                this._handleRangedAttack(deltaTime, game);
                break;
            case 'explosive':
                // 爆炸敵人的邏輯可能在 takeDamage 或死亡時觸發，這裡不需要特殊攻擊計時器
                break;
            case 'teleporter':
                this._handleTeleport(deltaTime, game); // 傳送不是攻擊，但放在這裡也行
                break;
            case 'summoner':
                this._handleSummon(deltaTime, game); // 召喚不是直接攻擊
                break;
        }
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
        const bulletColor = this.enemyType === 'boss' ? '#DA70D6' : (this.enemyType === 'new-boss' ? '#98FB98' : '#FF8C00'); // 為新 Boss 添加顏色

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
        const bulletColor = this.enemyType === 'new-boss' ? '#FF69B4' : '#FF4500'; // 為新 Boss 添加顏色
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
            // 计算单个精灵的宽度和高度
            const frameWidth = this.image.width / this.spriteColumns;
            const frameHeight = this.image.height / this.spriteRows;
            
            ctx.save();
            
            if (!this.facingLeft) {
                // 如果朝向右边，水平翻转图像
                ctx.translate(this.x + this.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(
                    this.image, 
                    this.frameX * frameWidth,
                    this.frameY * frameHeight,
                    frameWidth,
                    frameHeight,
                    0,
                    this.y,
                    this.width,
                    this.height
                );
            } else {
                // 正常绘制（朝向左边）
                ctx.drawImage(
                    this.image, 
                    this.frameX * frameWidth,
                    this.frameY * frameHeight,
                    frameWidth,
                    frameHeight,
                    this.x,
                    this.y,
                    this.width,
                    this.height
                );
            }
            
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        this.drawHpBar(ctx);

        // 可選：為召喚型 Boss 繪製召喚物計數
        if (this.enemyType === 'mini-boss-b' || this.enemyType === 'summoner') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            // --- 修正計數邏輯 ---
            let countArray = [];
            if (this.enemyType === 'mini-boss-b' && this.summonedMinions) {
                countArray = this.summonedMinions;
            } else if (this.enemyType === 'summoner' && this.summonedEnemies) {
                countArray = this.summonedEnemies;
            }
            const summonCount = countArray.filter(m => m && m.active).length;
            // --- 結束修正 ---
            // --- 添加日誌 ---
            // console.log(`繪圖: ${this.enemyType} ID ${this.id}, 計算出的 summonCount: ${summonCount}, 陣列長度: ${countArray.length}`);
            // --- 結束日誌 ---
            // 在這裡定義 drawHpBar 中使用的相同偏移量和高度
            const barYOffset = 8;
            const barHeight = 4;
            ctx.fillText(`Minions: ${summonCount}`, this.centerX, this.y - barYOffset - barHeight - 2);
        }
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
            this.hp = 0;
            this.active = false;
            // 如果是爆炸敵人，在這裡觸發爆炸
            if (this.enemyType === 'explosive') {
                this._handleExplosion(game);
            }
            // 如果是召喚型 Boss，移除其召喚物
            if (this.enemyType === 'mini-boss-b' && this.summonedMinions) {
                this.summonedMinions.forEach(minion => { if(minion) minion.active = false; });
            }
            if (this.enemyType === 'summoner' && this.summonedEnemies) {
                this.summonedEnemies.forEach(minion => { if(minion) minion.active = false; });
            }
            return true;
        } else {
            return false;
        }
    }

    // --- 新增：爆炸敵人的爆炸邏輯 ---
    _handleExplosion(game) {
        if (!game || !game.player || !this.explosionRadius || !this.explosionDamage) return;
        const radiusSq = this.explosionRadius * this.explosionRadius;
        const effectColor = 'rgba(255, 0, 0, 0.7)';

        // 添加爆炸視覺效果
        game.effects.push(new NovaEffect(this.centerX, this.centerY, this.explosionRadius, 400, effectColor));

        // 對玩家造成傷害
        if (distanceSq(this, game.player) < radiusSq) {
            game.player.takeDamage(this.explosionDamage, game);
            game.addDamageNumber(game.player.centerX, game.player.y, this.explosionDamage, effectColor);
        }
        // 對其他敵人造成傷害 (可選)
        /*
        game.enemies.forEach(otherEnemy => {
            if (otherEnemy !== this && otherEnemy.active && distanceSq(this, otherEnemy) < radiusSq) {
                otherEnemy.takeDamage(this.explosionDamage * 0.5, game); // 對其他敵人傷害減半
                game.addDamageNumber(otherEnemy.centerX, otherEnemy.y, this.explosionDamage * 0.5, effectColor);
            }
        });
        */
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
        this.wanderTimer = constants.ENEMY_WANDER_CHANGE_DIR_TIME + Math.random() * 2000;
    }

    // 添加更新动画的方法
    updateAnimation(deltaTime) {
        // 如果沒有圖像或圖像未加載，則不執行動畫
        if (!this.imageLoaded || !this.image || this.image.naturalWidth === 0) {
            return;
        }
        // 更新动画帧
        if (performance.now() - this.lastFrameTime > this.animationSpeed) {
            // 更新帧索引，循环播放
            this.frameX = (this.frameX + 1) % this.spriteColumns;
            this.lastFrameTime = performance.now();
            
            // 只在转向时使用第二排的后面图
            // 检测是否正在转向（从左到右或从右到左）
            const isChangingDirection = (this.lastMoveX > 0 && this.facingLeft) || 
                                       (this.lastMoveX < 0 && !this.facingLeft);
            
            // 如果正在转向，使用后面的图（第二排）
            this.frameY = isChangingDirection ? 1 : 0;
        }
    }

    // 遠程敵人的攻擊處理
    _handleRangedAttack(deltaTime, game) {
        const player = game.player;
        
        // 計算與玩家的距離
        const distToPlayerSq = distanceSqValues(this.centerX, this.centerY, player.centerX, player.centerY);
        
        // 如果在攻擊範圍內
        if (distToPlayerSq <= this.attackRange * this.attackRange) {
            this.rangedAttackCooldown -= deltaTime;
            
            // 冷卻時間結束時發射投射物
            if (this.rangedAttackCooldown <= 0) {
                // 計算方向向量
                const dx = player.centerX - this.centerX;
                const dy = player.centerY - this.centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const dirX = dx / dist;
                const dirY = dy / dist;
                
                // 創建敵人投射物
                game.addBossProjectile(this, this.centerX, this.centerY, dirX, dirY, this.projectileSpeed, this.damage, 'orange');
                
                // 重置冷卻時間
                this.rangedAttackCooldown = 1500 + Math.random() * 500;
            }
        }
    }

    // 傳送敵人的傳送處理
    _handleTeleport(deltaTime, game) {
        this.teleportTimer -= deltaTime;
        
        // 冷卻時間結束時嘗試傳送
        if (this.teleportTimer <= 0) {
            const player = game.player;
            
            // 計算與玩家的距離
            const distToPlayerSq = distanceSqValues(this.centerX, this.centerY, player.centerX, player.centerY);
            
            // 如果玩家在範圍內且距離不太近，則傳送
            if (distToPlayerSq <= this.teleportRange * this.teleportRange && distToPlayerSq > (this.width * 3) * (this.width * 3)) {
                // 計算傳送位置 (靠近玩家但不重疊)
                const angle = Math.random() * Math.PI * 2
                const distance = Math.sqrt(distToPlayerSq) * 0.5;
                const newX = player.centerX + distance * Math.cos(angle);
                const newY = player.centerY + distance * Math.sin(angle);
                
                // 確保新位置在遊戲界內
                this.x = Math.max(0, Math.min(this.constants.WORLD_WIDTH - this.width, newX));
                this.y = Math.max(0, Math.min(this.constants.WORLD_HEIGHT - this.height, newY));
                
                // 重置冷卻時間
                this.teleportTimer = this.teleportCooldown;
            }
        }
    }

        // 召喚敵人的召喚處理
    _handleSummon(deltaTime, game) {
        this.summonTimer -= deltaTime;

        // 清理無效的召喚物引用 (移到計時器檢查之前，確保每次都清理)
        this.summonedEnemies = this.summonedEnemies.filter(e => e && e.active);

        // 冷卻時間結束時嘗試召喚
        if (this.summonTimer <= 0 && this.summonedEnemies.length < this.maxSummons) {
            console.log(`Summoner (ID ${this.id}): 嘗試召喚 (當前: ${this.summonedEnemies.length}/${this.maxSummons})`); // 添加日誌
            const player = game.player;

            // 計算與玩家的距離
            const distToPlayerSq = distanceSqValues(this.centerX, this.centerY, player.centerX, player.centerY);
            
            // 如果玩家在範圍內且距離不太近，則召喚
            if (distToPlayerSq <= this.teleportRange * this.teleportRange && distToPlayerSq > (this.width * 3) * (this.width * 3)) {
                // 計算召喚位置 (靠近玩家但不重疊)
                const angle = Math.random() * Math.PI * 2
                const distance = Math.sqrt(distToPlayerSq) * 0.5;
                const newX = player.centerX + distance * Math.cos(angle);
                const newY = player.centerY + distance * Math.sin(angle);
                
                // 確保新位置在遊戲界內
                const summonX = Math.max(0, Math.min(this.constants.WORLD_WIDTH - this.width, newX));
                const summonY = Math.max(0, Math.min(this.constants.WORLD_HEIGHT - this.height, newY));
                // --- 修正 Summoner 召喚邏輯 ---
                // 創建新敵人 (使用 entityManager)
                const minionLevel = Math.max(1, this.difficultyLevel - 1); // 召喚者的小兵可以稍微強一點
                const newlySpawnedEnemy = game.entityManager.spawnEnemy(false, minionLevel, 'normal', null, summonX, summonY);
                console.log(`Summoner (ID ${this.id}): spawnEnemy 返回:`, newlySpawnedEnemy); // 添加日誌

                if (newlySpawnedEnemy) {
                    this.summonedEnemies.push(newlySpawnedEnemy); // 將返回的物件加入追蹤陣列
                    console.log(`Summoner (ID ${this.id}): 小兵已加入陣列, 當前數量: ${this.summonedEnemies.length}`); // 添加日誌
                    // 添加召喚視覺效果 (可選)
                    game.effects.push(new NovaEffect(summonX, summonY, this.constants.TILE_SIZE, 300, 'rgba(200, 0, 200, 0.6)'));
                } else {
                    console.warn(`Summoner (ID ${this.id}): 召喚小兵失敗 (spawnEnemy 返回 null)`);
                }
                // --- 結束修正 ---

                // 重置冷卻時間
                this.summonTimer = this.summonCooldown;
            }
        }
        // 清理無效的召喚物引用 (這行已移到計時器檢查之前)
        // this.summonedEnemies = this.summonedEnemies.filter(e => e && e.active);
    }

    // --- 新增 Boss 攻擊處理方法 ---

    _handleMiniBossAAttack(deltaTime, game) {
        if (this.dashAttackCooldown > 0) this.dashAttackCooldown -= deltaTime;
        if (this.trackingBulletCooldown > 0) this.trackingBulletCooldown -= deltaTime;

        // 衝撞攻擊 (簡單實現：短時間內提高速度衝向玩家)
        if (this.dashAttackCooldown <= 0 && this.aiState === 'chasing') {
            const originalSpeed = this.speed;
            this.speed *= 2.5; // 提高速度
            // 添加衝撞視覺效果 (可選)
            game.effects.push(new ShockwaveEffect(this.centerX, this.centerY, this.width * 1.5, 200, 'rgba(255, 100, 100, 0.5)'));
            setTimeout(() => { this.speed = originalSpeed; }, 300); // 300ms 後恢復速度
            this.dashAttackCooldown = 3500 + Math.random() * 1000; // 重置冷卻
        }

        // 追蹤子彈攻擊
        if (this.trackingBulletCooldown <= 0 && this.aiState === 'chasing') {
            const bulletCount = 3;
            const bulletSpeed = this.constants.BOSS_BULLET_SPEED * 0.8;
            const bulletDamage = this.damage * 0.5;
            const bulletColor = '#FF4500'; // 橙紅色

            for (let i = 0; i < bulletCount; i++) {
                // 稍微分散初始方向
                const angleOffset = (Math.random() - 0.5) * Math.PI / 6;
                const dx = game.player.centerX - this.centerX;
                const dy = game.player.centerY - this.centerY;
                const baseAngle = Math.atan2(dy, dx);
                const angle = baseAngle + angleOffset;
                const dirX = Math.cos(angle);
                const dirY = Math.sin(angle);

                game.addBossProjectile(this, this.centerX, this.centerY, dirX, dirY, bulletSpeed, bulletDamage, bulletColor);
                // 注意：這裡的 addBossProjectile 創建的是普通子彈，如果需要追蹤，需要在 Bullet 類中實現
            }
            this.trackingBulletCooldown = 5000 + Math.random() * 1500; // 重置冷卻
        }
    }

    _handleMiniBossBAttack(deltaTime, game) {
        if (this.summonMinionCooldown > 0) this.summonMinionCooldown -= deltaTime;

        // 清理無效的小兵引用
        this.summonedMinions = this.summonedMinions.filter(m => m && m.active);

        // 召喚小兵
        if (this.summonMinionCooldown <= 0 && this.summonedMinions.length < this.maxMinions && this.aiState === 'chasing') {
            const spawnRadius = this.width * 2;
            const angle = Math.random() * Math.PI * 2;
            const spawnX = this.centerX + Math.cos(angle) * spawnRadius;
            const spawnY = this.centerY + Math.sin(angle) * spawnRadius;

            // 確保生成位置在世界內且不在安全區
            const safeSpawnX = Math.max(this.constants.SAFE_ZONE_WIDTH + this.constants.TILE_SIZE, Math.min(this.constants.WORLD_WIDTH - this.constants.TILE_SIZE, spawnX));
            const safeSpawnY = Math.max(this.constants.TILE_SIZE, Math.min(this.constants.WORLD_HEIGHT - this.constants.TILE_SIZE, spawnY));

            // 創建迷你 Boss 作為小兵，難度等級可以稍微降低
            const minionLevel = Math.max(1, this.difficultyLevel - 2);
            // --- 再次修正召喚邏輯 (使用 spawnEnemy 返回值) ---
            const newlySpawnedMinion = game.entityManager.spawnEnemy(false, minionLevel, 'mini-boss', null, safeSpawnX, safeSpawnY); // 使用 entityManager 生成並獲取返回的物件

            if (newlySpawnedMinion) { // 檢查是否成功返回了物件
                this.summonedMinions.push(newlySpawnedMinion); // 將實際的敵人物件加入陣列
                // 添加召喚視覺效果
                game.effects.push(new NovaEffect(safeSpawnX, safeSpawnY, this.constants.TILE_SIZE * 1.5, 300, 'rgba(100, 100, 255, 0.6)'));
            } else {
                 console.warn("Mini-Boss B: 召喚小兵失敗 (spawnEnemy 返回 null)");
            }
             // --- 結束修正 ---
            this.summonMinionCooldown = 6000 + Math.random() * 2000; // 重置冷卻
        }
    }

    _handleNewBossAttack(deltaTime, game) {
        if (this.shockwaveAttackCooldown > 0) this.shockwaveAttackCooldown -= deltaTime;
        if (this.scatterShotCooldown > 0) this.scatterShotCooldown -= deltaTime;

        // 震盪波攻擊
        if (this.shockwaveAttackCooldown <= 0) {
            const radius = this.constants.TILE_SIZE * 8;
            const damage = this.damage * 0.7;
            const effectColor = 'rgba(50, 205, 50, 0.7)'; // 酸橙綠相關顏色

            game.effects.push(new ShockwaveEffect(this.centerX, this.centerY, radius, 500, effectColor));

            game.enemies.forEach(enemy => { // 對其他敵人也可能造成傷害 (可選)
                if (enemy.active && enemy !== this && distanceSq(this, enemy) < radius * radius) {
                     // enemy.takeDamage(damage * 0.3, game);
                }
            });
            if (distanceSq(this, game.player) < radius * radius) {
                game.player.takeDamage(damage, game);
                game.addDamageNumber(game.player.centerX, game.player.y, damage, effectColor);
            }
            this.shockwaveAttackCooldown = 5500 + Math.random() * 1000; // 重置冷卻
        }

        // 散射彈幕攻擊
        if (this.scatterShotCooldown <= 0) {
            const bulletCount = 16; // 更多子彈
            const angleIncrement = (Math.PI * 2) / bulletCount;
            const bulletSpeed = this.constants.BOSS_BULLET_SPEED * 0.9;
            const bulletDamage = this.damage * 0.4;
            const bulletColor = '#ADFF2F'; // 綠黃色

            for (let i = 0; i < bulletCount; i++) {
                const angle = i * angleIncrement + (Math.random() - 0.5) * (angleIncrement * 0.5); // 加入隨機偏移
                const directionDx = Math.cos(angle);
                const directionDy = Math.sin(angle);
                game.addBossProjectile(this, this.centerX, this.centerY, directionDx, directionDy, bulletSpeed, bulletDamage, bulletColor);
            }
            this.scatterShotCooldown = 4000 + Math.random() * 1000; // 重置冷卻
        }
    }

} // Enemy 類結束
