'use strict';

// 導入相關的實體類和工具函數
import { Enemy } from './enemy.js';
import { Tree } from './environment.js';
import { Fence, Tower } from './structures.js';
import { distanceSqValues, simpleCollisionCheck } from './utils.js';

// --- 實體管理器類 ---
// 負責處理遊戲中實體的生成、放置和管理邏輯
export class EntityManager {
    /**
     * 創建一個實體管理器實例。
     * @param {object} game - 對主遊戲對象的引用，用於訪問遊戲狀態和常量
     */
    constructor(game) {
        this.game = game; // 保存對主遊戲對象的引用
    }

    // --- 生成邏輯 ---

    /**
     * 在遊戲世界中生成一個敵人。
     * 會嘗試在安全區外且遠離玩家和其他敵人的位置生成。
     * @param {boolean} [allowAnywhere=false] - 是否允許在任何位置生成（忽略安全區和玩家距離）
     * @param {number} [difficultyLevel=1] - 當前遊戲難度等級，影響敵人屬性
     * @param {string} [enemyType='normal'] - 敵人類型 ('normal', 'mini-boss', 'boss')
     * @param {string|null} [imageUrl=null] - 敵人圖片 URL
     * @returns {boolean} 如果成功生成敵人則返回 true，否則返回 false
     */
    spawnEnemy(allowAnywhere = false, difficultyLevel = 1, enemyType = 'normal', imageUrl = null) {
        const constants = this.game.constants; // 獲取常量
        // 根據敵人類型確定大小乘數
        const sizeMultiplier = (enemyType === 'boss' ? 1.8 : (enemyType === 'mini-boss' ? 1.5 : 1.2));
        const size = constants.TILE_SIZE * sizeMultiplier; // 計算敵人尺寸
        let x, y, attempts = 0; // 初始化座標和嘗試次數
        const maxAttempts = 50; // 最大嘗試次數

        // 循環嘗試找到一個有效的生成位置
        do {
            // 在世界範圍內隨機生成座標
            x = Math.random() * (constants.WORLD_WIDTH - size);
            y = Math.random() * (constants.WORLD_HEIGHT - size);
            attempts++;
        } while (
            ( // 開始主要條件組 (安全檢查 或 重疊檢查)
                ( // 組 1: 安全檢查 (僅當 !allowAnywhere 時)
                    !allowAnywhere &&
                    ( // 安全檢查的內部組
                        // 檢查是否在安全區內
                        (x + size / 2 < constants.SAFE_ZONE_WIDTH && y + size / 2 > constants.SAFE_ZONE_TOP_Y && y + size / 2 < constants.SAFE_ZONE_BOTTOM_Y) ||
                        // 檢查是否離玩家太近 (如果玩家存在且活躍)
                        (this.game.player && this.game.player.active && distanceSqValues(x + size / 2, y + size / 2, this.game.player.centerX, this.game.player.centerY) < constants.SAFE_SPAWN_DIST_SQ)
                    )
                ) || // OR 運算符連接安全檢查和重疊檢查
                // 組 2: 敵人重疊檢查 (始終適用)
                this.game.enemies.some(e => e.active && distanceSqValues(x + size / 2, y + size / 2, e.centerX, e.centerY) < (size * 0.8) ** 2)
            ) // 結束主要條件組
            && attempts < maxAttempts // 並且 (AND) 檢查嘗試次數 (在 while 的括號內)
        ); // 結束 while 條件

        // 如果嘗試次數過多，生成失敗
        if (attempts >= maxAttempts) {
             console.warn(`無法為 ${enemyType} 找到合適的生成位置，嘗試次數：${attempts}`);
             return false; // 生成失敗
        }
        // 最後的安全區檢查
        if (!allowAnywhere && (x + size / 2 < constants.SAFE_ZONE_WIDTH && y + size / 2 > constants.SAFE_ZONE_TOP_Y && y + size / 2 < constants.SAFE_ZONE_BOTTOM_Y)) {
             console.warn(`${enemyType} 的生成嘗試最終位置在安全區內，中止生成。`);
             return false; // 生成失敗
        }

        // 創建新的敵人實例
        const newEnemy = new Enemy(x, y, size, size, constants, difficultyLevel, enemyType, imageUrl);
        // 將新敵人添加到遊戲的敵人數組中（修改遊戲狀態）
        this.game.enemies.push(newEnemy);
        return true; // 生成成功
    }

    /**
     * 在遊戲世界中生成一棵樹。
     * 會嘗試在安全區外且不與其他建築或樹木重疊的位置生成。
     * @param {boolean} [allowAnywhere=false] - 是否允許在任何位置生成（忽略安全區）
     * @returns {boolean} 如果成功生成樹木則返回 true，否則返回 false
     */
    spawnTree(allowAnywhere = false) {
       const constants = this.game.constants; // 獲取常量
       const width = constants.TILE_SIZE; // 樹的寬度
       const height = constants.TILE_SIZE * 1.5; // 樹的高度
       const margin = constants.TILE_SIZE; // 與世界邊緣的最小距離
       let x, y, attempts = 0; // 初始化座標和嘗試次數
       const maxAttempts = 30; // 最大嘗試次數
       const checkRect = { width, height }; // 用於碰撞檢測的矩形對象

        // 循環嘗試找到一個有效的生成位置
        do {
            // 在世界範圍內隨機生成座標（考慮邊距）
            x = Math.random() * (constants.WORLD_WIDTH - margin * 2 - width) + margin;
            y = Math.random() * (constants.WORLD_HEIGHT - margin * 2 - height) + margin;
            // 更新檢測矩形的座標
            checkRect.x = x; checkRect.y = y;
            attempts++;
        } while (
            ( // 開始主要碰撞檢查組
                // 1. 在安全區內 (如果不允許隨處生成)
                (!allowAnywhere && (x + width / 2 < constants.SAFE_ZONE_WIDTH && y + height / 2 > constants.SAFE_ZONE_TOP_Y && y + height / 2 < constants.SAFE_ZONE_BOTTOM_Y)) ||
                // 2. 與商店建築碰撞
                (this.game.tradingPost && simpleCollisionCheck(checkRect, this.game.tradingPost, 5)) ||
                (this.game.researchLab && simpleCollisionCheck(checkRect, this.game.researchLab, 5)) ||
                (this.game.healingRoom && simpleCollisionCheck(checkRect, this.game.healingRoom, 5)) ||
                // 3. 與其他活躍的樹木太近
                this.game.trees.some(t => t.active && distanceSqValues(x + width / 2, y + height / 2, t.centerX, t.centerY) < (constants.TILE_SIZE * 1.8) ** 2) ||
                // 4. 與活躍的結構（柵欄、塔）碰撞
                this.game.fences.some(f => f.active && simpleCollisionCheck(checkRect, f, 2)) ||
                this.game.towers.some(t => t.active && simpleCollisionCheck(checkRect, t, 2))
            ) // 結束主要碰撞檢查組
            && attempts < maxAttempts // 並且 (AND) 檢查嘗試次數
        ); // 結束 while 條件

        // 如果嘗試次數過多，生成失敗
        if (attempts >= maxAttempts) {
            console.warn("無法為樹木找到合適的生成位置。");
            return false; // 失敗
        }

        // 創建新的樹木實例
        const newTree = new Tree(x, y, width, height, constants);
        // 將新樹木添加到遊戲的樹木數組中（修改遊戲狀態）
        this.game.trees.push(newTree);
        return true; // 生成成功
    }

    /**
     * 嘗試生成特殊敵人（Boss 或 Mini-Boss）或普通敵人。
     * 根據當前難度等級決定生成類型。
     * 此方法應由遊戲主循環定期調用。
     */
    trySpawnSpecialOrNormalEnemy() {
        const difficultyLevel = this.game.difficultyLevel;
        const constants = this.game.constants;
        let spawnHandled = false;
        
        // 隨機決定是否生成特殊敵人
        const specialEnemyChance = Math.min(0.3, 0.05 + (difficultyLevel * 0.01)); // 隨難度增加特殊敵人機率
        
        // 嘗試生成特殊敵人
        if (Math.random() < specialEnemyChance) {
            // 決定生成哪種特殊敵人
            const specialTypes = ['fast', 'tank', 'ranged'];
            const specialWeights = [0.5, 0.3, 0.2]; // 不同類型的權重
            
            // 根據權重選擇敵人類型
            let typeIndex = 0;
            const randValue = Math.random();
            let cumulativeWeight = 0;
            
            for (let i = 0; i < specialWeights.length; i++) {
                cumulativeWeight += specialWeights[i];
                if (randValue <= cumulativeWeight) {
                    typeIndex = i;
                    break;
                }
            }
            
            const specialType = specialTypes[typeIndex];
            
            // 根據選擇的類型生成敵人
            if (specialType === 'fast') {
                this.spawnEnemy(false, difficultyLevel, 'fast', constants.ENEMY_FAST_IMAGE_URL);
                spawnHandled = true;
            } else if (specialType === 'tank') {
                this.spawnEnemy(false, difficultyLevel, 'tank', constants.ENEMY_TANK_IMAGE_URL);
                spawnHandled = true;
            } else if (specialType === 'ranged') {
                this.spawnEnemy(false, difficultyLevel, 'ranged', constants.ENEMY_RANGED_IMAGE_URL);
                spawnHandled = true;
            }
        }
        
        // 如果沒有生成特殊敵人，則生成普通敵人
        if (!spawnHandled) {
            this.spawnEnemy(false, difficultyLevel, 'normal', constants.ENEMY_IMAGE_URL);
        }
    }

    // 在entityManager.js中添加明確的Mini-Boss生成方法
    spawnMiniBoss(difficultyLevel) {
        const constants = this.game.constants;
        const size = constants.TILE_SIZE * 1.5; // Mini-Boss 比普通敵人大
        
        // 尋找合適的生成位置
        let x, y;
        let attempts = 0;
        const maxAttempts = 50;
        
        do {
            // 在世界範圍內隨機生成座標（避開安全區）
            x = Math.random() * (constants.WORLD_WIDTH - size * 2) + size;
            y = Math.random() * (constants.WORLD_HEIGHT - size * 2) + size;
            attempts++;
            
            // 確保不在安全區內
            if (x < constants.SAFE_ZONE_WIDTH * 1.5) {
                x = constants.SAFE_ZONE_WIDTH * 1.5 + Math.random() * 100;
            }
        } while (
            // 檢查是否與其他實體重疊
            this.game.enemies.some(e => e.active && 
                distanceSqValues(x + size/2, y + size/2, e.centerX, e.centerY) < (size * 1.5) ** 2) &&
            attempts < maxAttempts
        );
        
        if (attempts >= maxAttempts) {
            console.warn("無法為Mini-Boss找到合適的生成位置");
            // 強制在遠離安全區的位置生成
            x = constants.WORLD_WIDTH * 0.75;
            y = constants.WORLD_HEIGHT * 0.5;
        }
        
        // 創建Mini-Boss實例 - 使用直接導入的Enemy類，而不是this.game.Enemy
        const miniBoss = new Enemy(
            x, y, size, size, 
            constants, 
            difficultyLevel, 
            'mini-boss', 
            constants.MINI_BOSS_IMAGE_URL
        );
        
        // 添加到敵人數組
        this.game.enemies.push(miniBoss);
        
        // 顯示Mini-Boss生成消息
        this.game.setMessage(`警告！Mini-Boss出現了！`, 3000);
        
        console.log(`Mini-Boss已生成於 (${x.toFixed(0)}, ${y.toFixed(0)})`);
        return miniBoss;
    }

    // --- 建築邏輯 ---

    /**
     * 檢查指定的網格座標是否已被佔用。
     * @param {number} gridX - 網格的 X 座標 (左上角)
     * @param {number} gridY - 網格的 Y 座標 (左上角)
     * @returns {boolean} 如果被佔用則返回 true，否則返回 false
     */
    isOccupied(gridX, gridY) {
       const TILE_SIZE = this.game.constants.TILE_SIZE; // 獲取瓦片大小
       // 創建一個代表該網格的矩形，用於碰撞檢測
       const checkRect = { x: gridX, y: gridY, width: TILE_SIZE, height: TILE_SIZE };
       const tolerance = 2; // 碰撞檢測的容差

       // 檢查是否有活躍的柵欄或防禦塔正好在該網格座標
       if (this.game.fences.some(f => f.active && f.x === gridX && f.y === gridY) ||
           this.game.towers.some(t => t.active && t.x === gridX && t.y === gridY)) {
           return true;
       }
       // 檢查是否與主要建築物（交易站、研究室、治療室）碰撞
       if ((this.game.tradingPost && simpleCollisionCheck(checkRect, this.game.tradingPost, tolerance)) ||
           (this.game.researchLab && simpleCollisionCheck(checkRect, this.game.researchLab, tolerance)) ||
           (this.game.healingRoom && simpleCollisionCheck(checkRect, this.game.healingRoom, tolerance))) {
            return true;
        }
        // 檢查是否與主要商店建築碰撞 (從 game 對象訪問)
        if ((this.game.tradingPost && simpleCollisionCheck(checkRect, this.game.tradingPost, tolerance)) ||
            (this.game.weaponShop && simpleCollisionCheck(checkRect, this.game.weaponShop, tolerance)) || // 改名
            (this.game.healingRoom && simpleCollisionCheck(checkRect, this.game.healingRoom, tolerance)) ||
            (this.game.skillInstitute && simpleCollisionCheck(checkRect, this.game.skillInstitute, tolerance)) ||
            (this.game.armorShop && simpleCollisionCheck(checkRect, this.game.armorShop, tolerance)) || // 防具店檢查
            (this.game.danceStudio && simpleCollisionCheck(checkRect, this.game.danceStudio, tolerance)) || // 舞蹈室檢查
            (this.game.goalCharacter && this.game.goalCharacter.active && simpleCollisionCheck(checkRect, this.game.goalCharacter, tolerance))) { // 檢查目標角色
            return true;
        }
        // 檢查是否與活躍的樹木碰撞（使用較大的容差，因為樹木可能不完全對齊網格）
        if (this.game.trees.some(tree => tree.active && simpleCollisionCheck(checkRect, tree, TILE_SIZE * 0.5))) {
             return true;
         }
       // 如果以上都沒有碰撞，則該位置未被佔用
       return false;
    }

    /**
     * 嘗試在指定的世界座標建造一個柵欄。
     * 會檢查資源、安全區和佔用情況。
     * @param {number} worldX - 點擊的世界 X 座標
     * @param {number} worldY - 點擊的世界 Y 座標
     */
    buildFence(worldX, worldY) {
       if (!this.game.player) return; // 確保玩家存在
       const constants = this.game.constants; // 獲取常量

       // 檢查木材資源是否足夠
       if (this.game.player.wood < constants.FENCE_COST) {
            this.game.setMessage(`木材不足 (需 ${constants.FENCE_COST})`, 1500); // 顯示提示消息
            return;
        }

        const TILE_SIZE = constants.TILE_SIZE;
        // 將世界座標轉換為網格座標 (對齊到網格左上角)
        const gridX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;

        // 完整的安全區檢查
        if (gridX + TILE_SIZE / 2 < constants.SAFE_ZONE_WIDTH &&
            gridY + TILE_SIZE / 2 > constants.SAFE_ZONE_TOP_Y &&
            gridY + TILE_SIZE / 2 < constants.SAFE_ZONE_BOTTOM_Y) {
            this.game.setMessage("不能在安全區內建造!", 1500);
            return;
        }
        // 檢查目標網格是否已被佔用
        if (this.isOccupied(gridX, gridY)) {
            this.game.setMessage("該位置已被佔用!", 1500);
            return;
        }

        // 扣除玩家資源
        this.game.player.wood -= constants.FENCE_COST;
        // 創建新的柵欄實例並添加到遊戲的柵欄數組中（修改遊戲狀態）
        this.game.fences.push(new Fence(gridX, gridY, TILE_SIZE, TILE_SIZE, constants));
        this.game.setMessage(`建造圍欄! (-${constants.FENCE_COST} 木材)`, 1000); // 顯示成功消息
    }

    /**
     * 嘗試在指定的世界座標建造一個防禦塔。
     * 會檢查資源、安全區和佔用情況。
     * @param {number} worldX - 點擊的世界 X 座標
     * @param {number} worldY - 點擊的世界 Y 座標
     */
    buildTower(worldX, worldY) {
        if (!this.game.player) return; // 確保玩家存在
        const constants = this.game.constants; // 獲取常量

        // 檢查木材資源是否足夠
        if (this.game.player.wood < constants.TOWER_COST) {
            this.game.setMessage(`木材不足 (需 ${constants.TOWER_COST})`, 1500); // 顯示提示消息
            return;
        }

        const TILE_SIZE = constants.TILE_SIZE;
        // 將世界座標轉換為網格座標
        const gridX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;

        // 完整的安全區檢查
        if (gridX + TILE_SIZE / 2 < constants.SAFE_ZONE_WIDTH &&
            gridY + TILE_SIZE / 2 > constants.SAFE_ZONE_TOP_Y &&
            gridY + TILE_SIZE / 2 < constants.SAFE_ZONE_BOTTOM_Y) {
            this.game.setMessage("不能在安全區內建造!", 1500);
            return;
        }
        // 檢查目標網格是否已被佔用
        if (this.isOccupied(gridX, gridY)) {
            this.game.setMessage("該位置已被佔用!", 1500);
            return;
        }

        // 扣除玩家資源
        this.game.player.wood -= constants.TOWER_COST;
        // 創建新的防禦塔實例並添加到遊戲的防禦塔數組中（修改遊戲狀態）
        this.game.towers.push(new Tower(gridX, gridY, TILE_SIZE, TILE_SIZE, constants));
        this.game.setMessage(`建造防禦塔! (-${constants.TOWER_COST} 木材)`, 1000); // 顯示成功消息
    }

     // --- 樹木重生邏輯 ---

    /**
     * 安排一個未來的樹木重生事件。
     * 將一個時間戳添加到遊戲的重生隊列中。
     */
    scheduleTreeRespawn() {
        const constants = this.game.constants; // 獲取常量
        // 計算隨機的重生延遲時間
        const respawnDelay = constants.TREE_RESPAWN_TIME_MIN + Math.random() * (constants.TREE_RESPAWN_TIME_MAX - constants.TREE_RESPAWN_TIME_MIN);
        // 計算未來的重生時間戳
        const respawnTime = performance.now() + respawnDelay;
        // 將時間戳添加到遊戲的重生隊列中（修改遊戲狀態）
        this.game.treeRespawnQueue.push(respawnTime);
    }

    /**
     * 處理樹木重生隊列。
     * 檢查隊列中是否有到期的重生事件，並嘗試生成樹木。
     * @param {number} currentTime - 當前遊戲時間 (來自 performance.now())
     */
    processTreeRespawns(currentTime) {
        // 計算當前活躍的樹木數量
        const activeTreeCount = this.game.trees.filter(t => t.active).length;
        // 使用 game 對象引用的常量
        if (activeTreeCount >= this.game.constants.INITIAL_TREES && this.game.treeRespawnQueue.length === 0) {
            return; // 如果樹木數量已達上限且隊列為空，則無需處理
        }
        let respawnedCount = 0; // 記錄本次處理中成功重生的數量
        // 處理隊列中所有到期的重生事件
        while (this.game.treeRespawnQueue.length > 0 && this.game.treeRespawnQueue[0] <= currentTime) {
            this.game.treeRespawnQueue.shift(); // 從遊戲的隊列頭部移除一個到期事件
            // 嘗試生成新的樹木
            if (this.spawnTree(false)) { // 使用管理器自身的 spawnTree 方法
                respawnedCount++;
            } else {
                // 可選：記錄重生嘗試失敗的日誌
                // console.warn("從隊列重生樹木失敗，可能沒有空間。");
            }
        }
        // 可選：記錄重生數量
        // if (respawnedCount > 0) console.log(`重生了 ${respawnedCount} 棵樹。`);
    }

    // 修復 spawnBoss 方法中的邏輯錯誤
    spawnBoss(difficultyLevel) {
        const constants = this.game.constants;
        const size = constants.TILE_SIZE * 2; // Boss 比 Mini-Boss 更大
        
        // 尋找合適的生成位置
        let x, y;
        let attempts = 0;
        const maxAttempts = 50;
        
        do {
            // 在世界範圍內隨機生成座標（避開安全區）
            x = Math.random() * (constants.WORLD_WIDTH - size * 2) + size;
            y = Math.random() * (constants.WORLD_HEIGHT - size * 2) + size;
            attempts++;
            
            // 確保不在安全區內
            if (x < constants.SAFE_ZONE_WIDTH * 2) {
                x = constants.SAFE_ZONE_WIDTH * 2 + Math.random() * 150;
            }
        } while (
            // 檢查是否與其他實體重疊
            this.game.enemies.some(e => e.active && 
                distanceSqValues(x + size/2, y + size/2, e.centerX, e.centerY) < (size * 2) ** 2) &&
            attempts < maxAttempts
        );
        
        if (attempts >= maxAttempts) {
            console.warn("無法為Boss找到合適的生成位置");
            // 強制在遠離安全區的位置生成
            x = constants.WORLD_WIDTH * 0.8;
            y = constants.WORLD_HEIGHT * 0.5;
        }
        
        // 創建Boss實例 - 使用直接導入的Enemy類，而不是this.game.Enemy
        const boss = new Enemy(
            x, y, size, size, 
            constants, 
            difficultyLevel, 
            'boss', 
            constants.BOSS_IMAGE_URL
        );
        
        // 添加到敵人數組
        this.game.enemies.push(boss);
        
        // 顯示Boss生成消息
        this.game.setMessage(`警告！Boss出現了！`, 5000);
        
        console.log(`Boss已生成於 (${x.toFixed(0)}, ${y.toFixed(0)})`);
        return boss;
    }
}
