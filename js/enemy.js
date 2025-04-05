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
        // 生命值、傷害、鑽石獎勵的基礎縮放比例
        const hpScale = 1 + levelFactor * this.constants.ENEMY_HP_SCALING_FACTOR;
        const dmgScale = 1 + levelFactor * this.constants.ENEMY_DAMAGE_SCALING_FACTOR;
        const diamondScale = 1 + levelFactor * this.constants.diamond_AWARD_SCALING_FACTOR;
        // 計算難度等級達到 5 的倍數時的額外增強
        const boostTiers = Math.floor(this.difficultyLevel / 5); // 增強的層數
        const boostMultiplier = (this.constants.ENEMY_BOOST_FACTOR_PER_5_LEVELS ** boostTiers); // 增強乘數

        // 計算基礎屬性（應用縮放和增強）
        const baseHp = this.constants.ENEMY_HP_BASE * hpScale * boostMultiplier;
        let baseDamage = this.constants.ENEMY_DAMAGE_BASE * dmgScale * boostMultiplier;
        const basediamond = this.constants.diamond_AWARD_BASE * diamondScale;

        // --- 根據敵人類型調整屬性 ---
        if (this.enemyType === 'mini-boss') {
            this.maxHp = Math.ceil(baseHp * this.constants.MINI_BOSS_HP_MULTIPLIER); // 應用迷你 Boss 生命值乘數
            this.damage = Math.ceil(baseDamage * this.constants.MINI_BOSS_DAMAGE_MULTIPLIER); // 應用迷你 Boss 傷害乘數
            this.diamondReward = Math.ceil(basediamond * 1.5); // 迷你 Boss 鑽石獎勵增加
            this.speed = this.constants.ENEMY_SPEED_BASE * 0.9 + (Math.random() * 0.4 - 0.2); // 迷你 Boss 速度略慢
            this.color = 'purple'; // 設置顏色
        } else if (this.enemyType === 'boss') {
            this.maxHp = Math.ceil(baseHp * this.constants.BOSS_HP_MULTIPLIER); // 應用 Boss 生命值乘數
            this.damage = Math.ceil(baseDamage * this.constants.BOSS_DAMAGE_MULTIPLIER); // 應用 Boss 傷害乘數
            this.diamondReward = Math.ceil(basediamond * 3); // Boss 鑽石獎勵更多
            this.speed = this.constants.ENEMY_SPEED_BASE * 0.8 + (Math.random() * 0.4 - 0.2); // Boss 速度更慢
            this.color = 'darkred'; // 設置顏色
        } else { // 普通敵人 ('normal')
            this.maxHp = Math.ceil(baseHp);
            this.damage = Math.ceil(baseDamage);
            this.diamondReward = Math.ceil(basediamond);
            this.speed = this.constants.ENEMY_SPEED_BASE + (Math.random() * 0.4 - 0.2); // 普通敵人速度有隨機性
            this.color = 'saddlebrown'; // 設置顏色
        }
        this.hp = this.maxHp; // 初始生命值等於最大生命值
        this.speed = Math.max(0.3, this.speed); // 確保有最低速度

        // --- 計算經驗值獎勵 ---
        const baseXP = this.constants.XP_REWARD_BASE; // 基礎經驗值
        // 經驗值隨難度等級指數增長
        const levelMultiplier = Math.pow(this.constants.XP_REWARD_LEVEL_MULTIPLIER, this.difficultyLevel - 1);
        let bossMultiplier = 1; // Boss 類型經驗乘數
        if (this.enemyType === 'mini-boss') bossMultiplier = this.constants.XP_REWARD_MINI_BOSS_MULTIPLIER;
        else if (this.enemyType === 'boss') bossMultiplier = this.constants.XP_REWARD_BOSS_MULTIPLIER;
        this.xpReward = Math.ceil(baseXP * levelMultiplier * bossMultiplier); // 計算最終經驗獎勵

        // --- Boss 特殊攻擊計時器 ---
        // 360 度攻擊計時器 (迷你 Boss 和 Boss)
        this.threeSixtyAttackTimer = this.constants.MINI_BOSS_360_COOLDOWN + Math.random() * 500;
        // 目標攻擊計時器 (僅 Boss)
        this.targetedAttackTimer = this.constants.BOSS_TARGETED_COOLDOWN + Math.random() * 1000;

        // --- 其他狀態 ---
        this.attackCooldown = Math.random() * 1000; // 近戰攻擊冷卻計時器，初始隨機
        this.aiState = 'chasing'; // AI 狀態，默認為追擊，後續會根據情況調整
        this.wanderTargetX = null; // 閒晃目標 X 座標
        this.wanderTargetY = null; // 閒晃目標 Y 座標
        this.wanderTimer = 0; // 閒晃計時器

        // --- 圖像加載 ---
        this.image = new Image(); // 創建圖像對象
        this.imageLoaded = false; // 圖像是否加載完成標誌
        // 嘗試加載指定 URL 或默認敵人 URL 的圖像
        this.loadImage(imageUrl || (this.enemyType === 'mini-boss' ? this.constants.MINI_BOSS_IMAGE_URL : (this.enemyType === 'boss' ? this.constants.BOSS_IMAGE_URL : this.constants.ENEMY_IMAGE_DATA_URL)));
        this.setNewWanderTarget(this.constants); // 初始化閒晃目標
    }

    /**
     * 加載敵人圖像。
     * @param {string} src - 圖像的 URL
     */
    loadImage(src) {
        if (!src) {
            // 如果沒有提供 src，則警告並使用顏色繪製
            console.warn(`敵人 ${this.enemyType} (Level ${this.difficultyLevel}) 未提供圖片 URL，將使用顏色繪製。`);
            this.imageLoaded = true; // 標記為已加載（以便使用顏色回退）
            return;
        }
        // 設置加載成功的回調
        this.image.onload = () => { this.imageLoaded = true; };
        // 設置加載失敗的回調
        this.image.onerror = () => {
            console.error(`載入敵人圖片錯誤 (${this.enemyType}): ${src}`);
            this.imageLoaded = true; // 加載失敗也標記為已加載，使用顏色回退
        };
        this.image.src = src; // 開始加載圖像
    }

    /**
     * 更新敵人狀態（AI、移動、攻擊等）。
     * @param {number} deltaTime - 距離上一幀的時間差（毫秒）
     * @param {object} game - 遊戲主對象，用於訪問玩家、常量、添加投射物等
     */
    update(deltaTime, game) {
        // 基本檢查：如果敵人或玩家失效，或缺少 game 對象，則不更新
        if (!this.active || !game || !game.player || !game.player.active || !game.constants) return;

        const player = game.player; // 獲取玩家對象
        const constants = game.constants; // 獲取常量對象

        // --- Boss 特殊攻擊邏輯 ---
        if (this.enemyType === 'mini-boss' || this.enemyType === 'boss') {
            this.threeSixtyAttackTimer -= deltaTime; // 更新 360 攻擊計時器
            if (this.threeSixtyAttackTimer <= 0) {
                this.performThreeSixtyAttack(game); // 執行 360 攻擊
                // 重置計時器，加入隨機性
                this.threeSixtyAttackTimer = constants.MINI_BOSS_360_COOLDOWN + Math.random() * 500;
            }
        }
        if (this.enemyType === 'boss') {
            this.targetedAttackTimer -= deltaTime; // 更新目標攻擊計時器
            if (this.targetedAttackTimer <= 0) {
                this.performTargetedAttack(game); // 執行目標攻擊
                // 重置計時器，加入隨機性
                this.targetedAttackTimer = constants.BOSS_TARGETED_COOLDOWN + Math.random() * 1000;
            }
        }

        // --- AI 狀態決策 ---
        // 檢查玩家是否在安全區內
        const playerInSafeZone = player.centerX < constants.SAFE_ZONE_WIDTH &&
                                 player.centerY > constants.SAFE_ZONE_TOP_Y &&
                                 player.centerY < constants.SAFE_ZONE_BOTTOM_Y;
        // 計算與玩家距離的平方（性能優化）
        const distToPlayerSq = distanceSq(this, player);

        // 普通敵人在玩家進入安全區後切換到閒晃狀態
        if (playerInSafeZone && this.enemyType === 'normal') {
            if (this.aiState === 'chasing') {
                this.aiState = 'wandering';
                this.setNewWanderTarget(constants); // 設置新的閒晃目標
            }
        } else { // 玩家不在安全區，或敵人是 Boss/迷你 Boss
            // Boss 和迷你 Boss 總是追擊（除非玩家在安全區，但它們通常不會進入）
            if (this.enemyType !== 'normal') {
                this.aiState = 'chasing';
            }
            // 普通敵人在閒晃時，如果玩家靠近則切換到追擊
            else if (this.aiState === 'wandering' && distToPlayerSq < constants.ENEMY_SIGHT_RANGE_SQ) {
                this.aiState = 'chasing';
            }
            // 如果已經在追擊，則保持追擊狀態
        }

        let moveTargetX = null, moveTargetY = null, currentSpeed = 0;

        // --- 根據 AI 狀態設置移動目標和速度 ---
        if (this.aiState === 'chasing') {
            moveTargetX = player.centerX; // 目標是玩家中心
            moveTargetY = player.centerY;
            currentSpeed = this.speed; // 使用敵人的追擊速度

            // --- 近戰攻擊邏輯 ---
            if (this.attackCooldown > 0) this.attackCooldown -= deltaTime; // 更新冷卻計時器
            this.attackCooldown = Math.max(0, this.attackCooldown); // 防止負數

            // 如果冷卻結束且與玩家碰撞（使用簡化碰撞檢測，允許輕微重疊）
            if (this.attackCooldown <= 0 && simpleCollisionCheck(this, player, 5)) {
                const actualDamage = this.damage; // 獲取敵人傷害值
                player.takeDamage(actualDamage, game); // 對玩家造成傷害
                // 重置攻擊冷卻時間（Boss 攻擊間隔稍長）
                this.attackCooldown = (this.enemyType === 'boss' ? 1500 : 1000) + Math.random() * 300;
                // 在玩家身上顯示紅色傷害數字
                game.addDamageNumber(player.centerX, player.y, actualDamage, '#FF0000');
            }

        } else { // 閒晃狀態 (僅限普通敵人)
            this.wanderTimer -= deltaTime; // 更新閒晃計時器
            // 如果計時器結束，或沒有目標，或已到達目標附近，則設置新目標
            if (this.wanderTimer <= 0 || this.wanderTargetX === null || distanceSqValues(this.centerX, this.centerY, this.wanderTargetX, this.wanderTargetY) < (constants.TILE_SIZE * 1.5)**2 ) {
                this.setNewWanderTarget(constants);
            }
            moveTargetX = this.wanderTargetX; // 目標是閒晃點
            moveTargetY = this.wanderTargetY;
            currentSpeed = constants.ENEMY_WANDER_SPEED; // 使用較慢的閒晃速度
        }

        // --- 執行移動 ---
        if (moveTargetX !== null && moveTargetY !== null) {
            let dx = moveTargetX - this.centerX; // X 方向差
            let dy = moveTargetY - this.centerY; // Y 方向差
            const dist = Math.sqrt(dx * dx + dy * dy); // 到目標的距離

            // 設置停止距離：追擊時靠近玩家，閒晃時到達目標點附近即可
            const stopDistance = (this.aiState === 'chasing') ? (this.width / 2 + player.width / 2 - 5) : (constants.TILE_SIZE * 0.5);

            // 只有在距離大於停止距離時才移動
            if (dist > stopDistance) {
                // 計算歸一化方向向量並乘以速度
                const moveX = (dx / dist) * currentSpeed;
                const moveY = (dy / dist) * currentSpeed;
                // 計算下一步的座標
                let nextX = this.x + moveX;
                let nextY = this.y + moveY;
                const nextCenterX = nextX + this.width / 2;
                const nextCenterY = nextY + this.height / 2;

                // --- 防止進入安全區 ---
                let stoppedAtSafeZone = false;
                if (nextCenterX < constants.SAFE_ZONE_WIDTH &&
                    nextCenterY > constants.SAFE_ZONE_TOP_Y &&
                    nextCenterY < constants.SAFE_ZONE_BOTTOM_Y)
                {
                    if (this.aiState === 'chasing') { // 如果是追擊狀態，停在安全區邊界
                        // 簡化處理：沿反方向稍微推回
                        const pushBackDist = 5;
                        nextX -= (dx / dist) * pushBackDist;
                        nextY -= (dy / dist) * pushBackDist;
                        // 可以實現更精確的邊界吸附，但目前這樣處理
                        stoppedAtSafeZone = true;

                    } else { // 如果是閒晃狀態，重新設置閒晃目標
                        this.setNewWanderTarget(constants);
                        nextX = this.x; nextY = this.y; // 本幀不移動
                    }
                }

                // 應用移動，並限制在世界邊界內
                this.x = Math.max(0, Math.min(constants.WORLD_WIDTH - this.width, nextX));
                this.y = Math.max(0, Math.min(constants.WORLD_HEIGHT - this.height, nextY));

                // 可選：如果因安全區停止，可以考慮暫時切換到閒晃狀態
                // if (stoppedAtSafeZone && this.aiState === 'chasing') {
                //     this.aiState = 'wandering';
                //     this.setNewWanderTarget(constants);
                // }
            }
        }

        // --- 與柵欄的碰撞檢測 ---
        if (game.fences) { // 確保柵欄列表存在
            game.fences.forEach(fence => {
                // 如果柵欄有效且與敵人碰撞
                if (fence.active && simpleCollisionCheck(this, fence)) {
                    fence.takeDamage(Infinity); // 敵人瞬間摧毀柵欄
                }
            });
        }
    }

    /**
     * 執行 360 度彈幕攻擊 (迷你 Boss 和 Boss)。
     * @param {object} game - 遊戲主對象，用於調用 addBossProjectile
     */
    performThreeSixtyAttack(game) {
        const bulletCount = 12; // 發射 12 顆子彈
        const angleIncrement = (Math.PI * 2) / bulletCount; // 計算每顆子彈的角度增量
        const bulletSpeed = this.constants.BOSS_BULLET_SPEED * 0.6; // 子彈速度稍慢
        const bulletDamage = this.damage * 0.4; // 子彈傷害較低
        // Boss 和迷你 Boss 子彈顏色不同
        const bulletColor = this.enemyType === 'boss' ? '#DA70D6' : '#FF8C00'; // 紫紅色 vs 暗橙色

        // 循環發射子彈
        for (let i = 0; i < bulletCount; i++) {
            const angle = i * angleIncrement; // 當前子彈角度
            const directionDx = Math.cos(angle); // X 方向分量
            const directionDy = Math.sin(angle); // Y 方向分量
            // 調用 game 的方法添加 Boss 投射物
            game.addBossProjectile(this, this.centerX, this.centerY, directionDx, directionDy, bulletSpeed, bulletDamage, bulletColor);
        }
    }

    /**
     * 執行朝向玩家的扇形彈幕攻擊 (僅 Boss)。
     * @param {object} game - 遊戲主對象，用於訪問玩家和調用 addBossProjectile
     */
    performTargetedAttack(game) {
        if (!game.player || !game.player.active) return; // 玩家不存在或失效則不攻擊

        const bulletCount = this.constants.BOSS_TARGETED_BULLET_COUNT; // 發射的子彈數量
        const bulletSpeed = this.constants.BOSS_BULLET_SPEED; // 子彈速度
        const bulletDamage = this.damage * 0.6; // 子彈傷害較高
        const bulletColor = '#FF4500'; // 橙紅色
        const spreadAngle = Math.PI / 18; // 子彈之間的擴散角度 (10度)

        // 計算指向玩家的基礎角度
        const dx = game.player.centerX - this.centerX;
        const dy = game.player.centerY - this.centerY;
        const baseAngle = Math.atan2(dy, dx);

        // 循環發射扇形子彈
        for (let i = 0; i < bulletCount; i++) {
            // 計算每顆子彈相對於基礎角度的偏移
            const currentAngle = baseAngle + (i - (bulletCount - 1) / 2) * spreadAngle;
            const directionDx = Math.cos(currentAngle); // X 方向分量
            const directionDy = Math.sin(currentAngle); // Y 方向分量
            // 調用 game 的方法添加 Boss 投射物
            game.addBossProjectile(this, this.centerX, this.centerY, directionDx, directionDy, bulletSpeed, bulletDamage, bulletColor);
        }
    }

    /**
     * 在畫布上繪製敵人。
     * @param {CanvasRenderingContext2D} ctx - 畫布的 2D 渲染上下文
     */
    draw(ctx) {
        if (!this.active) return; // 失效則不繪製

        // 如果圖像已加載且有效，則繪製圖像
        if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // 否則，繪製回退顏色方塊
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        // 繪製生命值條
        this.drawHpBar(ctx);
    }

    /**
     * 繪製敵人的生命值條。
     * @param {CanvasRenderingContext2D} ctx - 畫布的 2D 渲染上下文
     */
    drawHpBar(ctx) {
        const barYOffset = 8; // 生命值條相對敵人頂部的偏移量
        const barHeight = 4; // 生命值條高度
        const barWidth = this.width; // 生命值條寬度等於敵人寬度
        const barX = this.x; // 生命值條 X 座標
        const barY = this.y - barYOffset; // 生命值條 Y 座標（在敵人上方）

        // 如果生命值條超出屏幕頂部，則不繪製
        if (barY < 0) return;

        // 計算當前生命值比例
        const hpRatio = Math.max(0, this.hp / this.maxHp);

        // 繪製背景條（深灰色）
        ctx.fillStyle = '#444';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        // 繪製當前生命值條（紅色）
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    }

    /**
     * 處理敵人受到傷害的邏輯。
     * @param {number} damage - 受到的傷害值
     * @param {object} game - 遊戲主對象，用於訪問玩家和設置消息
     */
    takeDamage(damage, game) {
        // 基本檢查
        if (!this.active || !game || !game.player || !game.player.active) return;

        this.hp -= damage; // 扣除生命值

        if (this.hp <= 0) { // 如果生命值耗盡
            this.active = false; // 標記為失效

            // --- 給予玩家獎勵 ---
            game.player.diamond += this.diamondReward; // 獎勵鑽石

            // Boss 和迷你 Boss 額外獎勵金幣
            let goldReward = 0;
            if (this.enemyType === 'mini-boss') goldReward = 300;
            if (this.enemyType === 'boss') goldReward = 800;
            if (goldReward > 0) game.player.gold += goldReward;

            // 獎勵經驗值
            game.player.gainXp(this.xpReward, game); // 調用玩家的 gainXp 方法

            // --- 顯示擊殺消息 ---
            let killMsg = `擊殺 ${this.enemyType}! +${this.diamondReward} 💎`;
            if (goldReward > 0) killMsg += ` +${goldReward}G`;
            killMsg += ` (+${this.xpReward} XP)`;
            game.setMessage(killMsg, 1500); // 在 UI 上顯示消息

        } else {
            // 可選：可以在這裡添加敵人受擊的視覺效果（例如閃爍）
        }
    }

    /**
     * 為閒晃狀態設置一個新的隨機目標點。
     * 確保目標點不在安全區內。
     * @param {object} constants - 遊戲常量對象
     */
    setNewWanderTarget(constants) {
        if (!constants) return; // 防禦性檢查

        const maxAttempts = 10; // 最大嘗試次數，防止無限循環
        let attempts = 0;
        let targetX, targetY;
        const margin = constants.TILE_SIZE; // 與世界邊緣的最小距離

        do {
            // 在世界範圍內隨機生成目標點（考慮邊距）
            targetX = Math.random() * (constants.WORLD_WIDTH - margin * 2) + margin;
            targetY = Math.random() * (constants.WORLD_HEIGHT - margin * 2) + margin;
            attempts++;
            // 檢查目標點是否在安全區內
        } while (
             (targetX < constants.SAFE_ZONE_WIDTH &&
              targetY > constants.SAFE_ZONE_TOP_Y &&
              targetY < constants.SAFE_ZONE_BOTTOM_Y) &&
              attempts < maxAttempts // 並且嘗試次數未達上限
        );

        // 如果多次嘗試後目標仍在安全區內，則強制將其設置在安全區外
        if (targetX < constants.SAFE_ZONE_WIDTH && targetY > constants.SAFE_ZONE_TOP_Y && targetY < constants.SAFE_ZONE_BOTTOM_Y) {
            // 將 X 設置在安全區右側的隨機位置
            targetX = constants.SAFE_ZONE_WIDTH + Math.random() * (constants.WORLD_WIDTH - constants.SAFE_ZONE_WIDTH - margin) + margin / 2;
            // Y 座標暫時保持不變，也可以重新生成
        }

        // 更新閒晃目標和計時器
        this.wanderTargetX = targetX;
        this.wanderTargetY = targetY;
        // 重置閒晃計時器，加入隨機性
        this.wanderTimer = constants.ENEMY_WANDER_CHANGE_DIR_TIME + Math.random() * 2000;
    }
}
