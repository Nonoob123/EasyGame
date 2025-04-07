'use strict';

// --- 導入所有需要的模塊 ---
import { gameConstants } from './constants.js'; // 遊戲常量
// 工具函數 (距離計算、碰撞檢測等)
import { distanceSq, distanceSqValues, simpleCollisionCheck } from './utils.js';
import { Player } from './player.js'; // 玩家類
import { Enemy } from './enemy.js'; // 敵人類
import { Tree } from './environment.js'; // 環境物件 (樹木)
import { Structure } from './structureBase.js'; // 從基礎文件導入 Structure
// 導入其他建築物 (柵欄、塔、防具店、舞蹈室)
import { Fence, Tower, ArmorShop, DanceStudio } from './structures.js'; // 從 structures.js 導入其他建築
import { Shop } from './shop.js'; // 商店類 (交易站、武器店、治療室、研究所)
// 導入所有投射物和效果類
import { Bullet, Arrow, EnergyBolt, EnergyBeam } from './projectiles.js';
import { SlashEffect, DamageNumber, ShockwaveEffect, NovaEffect } from './effects.js';
import { InputHandler } from './inputHandler.js'; // 輸入處理器
// 導入所有 UI 繪圖函數
import { drawHUD, drawMessages, drawWinScreen, drawEndScreen, drawWorld, drawEntities } from './ui.js'; // 導入 drawWorld 和 drawEntities
import { GoalCharacter } from './goalCharacter.js'; // 導入目標角色類
import { EntityManager } from './entityManager.js'; // 導入實體管理器


// --- 遊戲主類 ---
export class Game {
    /**
     * 創建一個遊戲實例。
     * @param {string} canvasId - HTML 中 Canvas 元素的 ID
     */
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); // 獲取 Canvas DOM 元素
        if (!this.canvas) throw new Error(`找不到 ID 為 '${canvasId}' 的 Canvas 元素！`);
        this.ctx = this.canvas.getContext('2d'); // 獲取 2D 渲染上下文
        if (!this.ctx) throw new Error("無法獲取 Canvas 的 2D 渲染上下文！");

        this.constants = gameConstants; // 將導入的常量賦值給實例屬性
        this.entityManager = new EntityManager(this); // 創建 EntityManager 實例
        this.inputHandler = new InputHandler(this); // 創建 InputHandler 實例，傳入 game 引用

        this.setCanvasSize(); // 設置畫布尺寸
        this.resetState(); // 初始化遊戲狀態變量

        // 綁定 gameLoop 的 this 指向，確保在 requestAnimationFrame 中正確執行
        this.gameLoop = this.gameLoop.bind(this);
        this._boundResizeHandler = this.setCanvasSize.bind(this); // 綁定 resize 處理函數

        // 圖像加載相關變量
        this.imagesToLoad = 0; // 需要加載的圖像總數
        this.imagesLoaded = 0; // 已加載完成的圖像數量
        this.areImagesLoaded = false; // 標記初始資源是否已準備就緒

        this.treeRespawnQueue = []; // 用於安排樹木重生的隊列
        this.listenersAttached = false; // 新增：標記監聽器是否已附加
    }

    /**
     * 根據常量設置 Canvas 的寬度和高度。
     */
    setCanvasSize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.constants.CANVAS_WIDTH = this.canvas.width;
        this.constants.CANVAS_HEIGHT = this.canvas.height;
        // 可以在這裡觸發 UI 重新佈局等操作
    }

    isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    }

    /**
     * 初始化或重置遊戲狀態變量。
     * 在遊戲開始或重新開始時調用。
     */
    resetState() {
        // 停止當前的遊戲循環（如果正在運行）
        this.gameRunning = false;

        // 遊戲實體數組
        this.player = null;
        this.enemies = [];
        this.trees = [];
        this.fences = [];
        this.towers = [];
        this.bullets = [];
        this.arrows = [];
        this.effects = [];
        this.damageNumbers = [];
        this.goalCharacter = null;

        // 商店建築對象
        this.tradingPost = null;
        this.weaponShop = null;
        this.healingRoom = null;
        this.skillInstitute = null;
        this.armorShop = null;
        this.danceStudio = null;

        // 輸入狀態 (由 InputHandler 更新，但這裡可以清空)
        this.keysPressed = {};
        if(this.inputHandler) this.inputHandler.keysPressed = this.keysPressed; // 確保 InputHandler 也同步

        // 遊戲邏輯變量
        this.enemySpawnTimer = 0;
        this.elapsedGameTime = 0;
        this.difficultyLevel = 0;
        this.bossSpawnedForLevel = -1;
        this.miniBossSpawnedForLevel = -1; // 添加這一行

        // UI 消息
        this.messageText = '';
        this.messageTimer = 0;

        // 攝像機
        this.camera = { x: 0, y: 0 };

        // 遊戲循環控制
        this.lastTime = 0;
        // this.gameRunning = false; // 已在開頭設置
        this.gameState = 'running'; // 重置後直接設為運行狀態

        // 樹木重生隊列
        this.treeRespawnQueue = [];

        console.log("遊戲狀態已重置。難度等級: 1");
    }


    // --- 初始化步驟 ---

    /**
     * 完整初始化遊戲，包括加載資源和附加監聽器。
     * 只在首次加載時調用。
     */
    init() {
        console.log("正在初始化遊戲 (首次)...");
        this.resetState(); // 清理狀態
        this.setupShops(); // 創建商店
        this.spawnInitialEntities(); // 生成初始實體
        this.loadGameImages(); // **加載圖像**

        // --- 監聽器管理 ---
        if (!this.listenersAttached) {
            this.attachListeners(); // 附加 InputHandler 的監聽器
            window.addEventListener('resize', this._boundResizeHandler); // 附加 resize 監聽器
            this.listenersAttached = true;
            console.log("事件監聽器已附加。");
        }

        this.setCanvasSize(); // 設置畫布大小
        console.log("遊戲初始化序列完成。等待圖像加載...");
        // startGameLoop 會在圖像加載完成後被調用

        // 初始化 Boss 生成追蹤變數
        this.miniBossSpawnedForLevel = 0;
        this.bossSpawnedForLevel = 0;

        // 添加調試信息
        console.log(`遊戲初始化完成。難度等級: ${this.difficultyLevel}`);
        console.log(`Mini-Boss 生成間隔: ${this.constants.MINI_BOSS_SPAWN_LEVEL_INTERVAL} 關`);
        console.log(`Boss 生成間隔: ${this.constants.BOSS_SPAWN_LEVEL_INTERVAL} 關`);
        console.log(`Mini-Boss 圖像 URL: ${this.constants.MINI_BOSS_IMAGE_URL}`);
        console.log(`Boss 圖像 URL: ${this.constants.BOSS_IMAGE_URL}`);
    }

    /**
     * 重新開始遊戲，重置狀態但不重新加載資源。
     */
    restart() {
        console.log("正在重新開始遊戲...");
        this.resetState(); // 清理狀態
        this.setupShops(); // 重新放置商店 (通常是靜態的)
        this.spawnInitialEntities(); // 重新生成初始實體
        // **跳過 loadGameImages()**
        this.areImagesLoaded = true; // 假設圖片已加載
        this.setCanvasSize(); // 確保畫布尺寸正確
        this.startGameLoop(); // 直接啟動遊戲循環
        console.log("遊戲已重新開始。");
    }


    /**
     * 創建並放置商店建築。
     */
    setupShops() {
        const TILE_SIZE = this.constants.TILE_SIZE;
        const shopMargin = TILE_SIZE * 2;
        const shopWidth = TILE_SIZE * 2;
        const shopHeight = TILE_SIZE * 2;
        const shopX = shopMargin;

        const tradingPostY = this.constants.topBuildingY;
        const weaponShopY = this.constants.middleBuildingY;
        const healingRoomY = this.constants.bottomBuildingY;
        const skillInstituteY = this.constants.instituteBuildingY;
        const armorShopY = skillInstituteY + shopHeight + TILE_SIZE;
        const danceStudioY = armorShopY + shopHeight + TILE_SIZE;

        this.tradingPost = new Shop(shopX, tradingPostY, shopWidth, shopHeight, '#FFD700', 'trading_post');
        this.weaponShop = new Shop(shopX, weaponShopY, shopWidth, shopHeight, '#B22222', 'weapon_shop');
        this.healingRoom = new Shop(shopX, healingRoomY, shopWidth, shopHeight, '#90EE90', 'healing_room');
        this.skillInstitute = new Shop(shopX, skillInstituteY, shopWidth, shopHeight, '#8A2BE2', 'skill_institute');
        this.armorShop = new ArmorShop(shopX, armorShopY, shopWidth, shopHeight, this.constants);
        this.danceStudio = new DanceStudio(shopX, danceStudioY, shopWidth, shopHeight, this.constants);

        console.log(`所有商店已創建/重新放置。`); // 修改日誌
    }

    /**
     * 生成遊戲開始時的初始實體（玩家、樹木、敵人）。
     */
    spawnInitialEntities() {
        const constants = this.constants;
        const playerSize = constants.TILE_SIZE;
        const shopAreaEndX = constants.TILE_SIZE * 4;
        const safeLaneWidth = constants.SAFE_ZONE_WIDTH - shopAreaEndX;
        const playerStartX = shopAreaEndX + safeLaneWidth / 2 - playerSize / 2;
        const playerStartY = constants.WORLD_HEIGHT / 2 - playerSize / 2;

        this.player = new Player(playerStartX, playerStartY, playerSize, playerSize, constants);
        console.log(`玩家已生成於 (${playerStartX.toFixed(0)}, ${playerStartY.toFixed(0)})`);

        for (let i = 0; i < constants.INITIAL_TREES; i++) { this.entityManager.spawnTree(true); }
        for (let i = 0; i < constants.INITIAL_ENEMIES; i++) {
             this.entityManager.spawnEnemy(true, 1, 'normal');
         }
         console.log("初始實體已生成。"); // 添加日誌
    }

    /**
     * 開始加載所有必要的遊戲圖像。
     */
     loadGameImages() {
         console.log("正在加載遊戲圖像...");
         this.imagesToLoad = 0;
         this.imagesLoaded = 0;
         this.areImagesLoaded = false; // 重置加載狀態

         const urls = {
             player: this.constants.PLAYER_IMAGE_DATA_URL,
             enemy: this.constants.ENEMY_IMAGE_DATA_URL,
             miniBoss: this.constants.MINI_BOSS_IMAGE_URL,
             boss: this.constants.BOSS_IMAGE_URL,
             tree: this.constants.TREE_IMAGE_URL
         };

         const loadImage = (key, url, targetObject = null) => {
             if (!url) {
                 console.warn(`${key} 圖像 URL 缺失。`);
                 if (targetObject) targetObject.imageLoaded = true;
                 return;
             }
             this.imagesToLoad++;
             const img = targetObject ? targetObject.image : new Image();
             img.onload = () => {
                 console.log(`${key} 圖像加載成功: ${url.substring(0, 50)}...`);
                 if (targetObject) targetObject.imageLoaded = true;
                 this.imageLoadCallback();
             };
             img.onerror = () => {
                 console.error(`加載 ${key} 圖像錯誤: ${url}`);
                 if (targetObject) targetObject.imageLoaded = true;
                 this.imageLoadCallback();
             };
             // 檢查圖像是否已在緩存中 (避免重複加載日誌)
             if (!img.src) {
                 img.src = url;
             } else if (img.complete && img.naturalWidth > 0) {
                 console.log(`${key} 圖像已緩存。`);
                 // 如果已緩存，手動觸發回調
                 setTimeout(() => this.imageLoadCallback(), 0);
             } else {
                 // 如果 src 已設置但未完成，等待 onerror 或 onload
             }
         };

         if (this.player) { loadImage('player', urls.player, this.player); } else { console.error("加載圖像前未創建玩家對象！"); }
         loadImage('enemy', urls.enemy);
         loadImage('miniBoss', urls.miniBoss);
         loadImage('boss', urls.boss);
         loadImage('tree', urls.tree);

          if (this.imagesToLoad === 0) {
             console.warn("未找到有效的圖像 URL 進行加載。");
             this.areImagesLoaded = true;
             this.startGameLoop();
         } else {
             console.log(`嘗試加載 ${this.imagesToLoad} 個圖像。`);
         }
     }

    /**
     * 每個圖像加載完成或失敗時的回調函數。
     */
     imageLoadCallback() {
         this.imagesLoaded++;
         console.log(`圖像加載進度: ${this.imagesLoaded} / ${this.imagesToLoad}`);
         if (this.imagesLoaded >= this.imagesToLoad && !this.areImagesLoaded) {
             this.areImagesLoaded = true;
             console.log("所有追蹤的圖像已加載或失敗。啟動遊戲循環。");
             this.startGameLoop();
         }
     }

    /**
     * 啟動遊戲主循環。
     */
    startGameLoop() {
        // 確保圖像已加載且循環未運行
        if (this.areImagesLoaded && !this.gameRunning) {
            this.gameRunning = true;
            this.lastTime = performance.now();
            this.updateCamera();
            requestAnimationFrame(this.gameLoop);
            console.log("遊戲循環已啟動。");
        } else if (!this.areImagesLoaded) {
            console.log("等待圖像加載完成才能啟動循環...");
        } else if (this.gameRunning) {
            console.log("遊戲循環已在運行中。");
        }
    }


    // --- 遊戲循環 ---
    gameLoop(timestamp) {
        if (!this.gameRunning) return; // 如果遊戲停止，則退出循環

        let deltaTime = timestamp - this.lastTime;
        if (isNaN(deltaTime) || deltaTime <= 0) { deltaTime = 16.67; }
        deltaTime = Math.min(deltaTime, 100);
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame(this.gameLoop);
    }

    // --- 更新邏輯 ---
    update(deltaTime) {
        if (this.gameState !== 'running' || !this.player || !this.constants) return;

        // --- 更新遊戲時間和難度 ---
        this.elapsedGameTime += deltaTime;
        const newDifficultyLevel = Math.floor(this.elapsedGameTime / this.constants.TIME_PER_DIFFICULTY_LEVEL) + 1;
        if (newDifficultyLevel > this.difficultyLevel) {
            console.log(`難度從 ${this.difficultyLevel} 提升至 ${newDifficultyLevel}`);
            this.difficultyLevel = newDifficultyLevel;
            this.bossSpawnedForLevel = -1;
            this.setMessage(`關卡 ${this.difficultyLevel}`, 2500);
        };
        // --- 目標角色生成邏輯 ---
        if (this.difficultyLevel >= 50 && !this.goalCharacter) {
            this.spawnGoalCharacter();
            if (this.goalCharacter) {
                 this.setMessage("獎杯出現了！🏆 快去尋找！", 5000);
            }
        }

        // --- 更新實體 ---
        try {
             if (this.player.active) this.player.update(deltaTime, this);
        } catch (e) {
             console.error("更新玩家時出錯:", e);
             this.gameOver("玩家更新錯誤");
             return;
        }
        for (const arrow of this.arrows) if (arrow.active) arrow.update(deltaTime, this);
        for (const bullet of this.bullets) if (bullet.active) bullet.update(deltaTime, this);
        for (const tower of this.towers) if (tower.active) tower.update(deltaTime, this);
        for (const enemy of this.enemies) if (enemy.active) enemy.update(deltaTime, this);
        for (const effect of this.effects) if (effect.active) effect.update(deltaTime);
        for (const dn of this.damageNumbers) if (dn.active) dn.update(deltaTime);
        if (this.goalCharacter) this.goalCharacter.update(deltaTime, this);

        // --- 更新攝像機 ---
        this.updateCamera();

        // --- 更新 UI 消息計時器 ---
        if (this.messageTimer > 0) {
            this.messageTimer -= deltaTime;
            if (this.messageTimer <= 0) {
                this.messageText = '';
                this.messageTimer = 0;
            }
        }

        // --- 處理樹木重生 ---
        this.entityManager.processTreeRespawns(performance.now());

        // --- 敵人生成邏輯 ---
        this.enemySpawnTimer += deltaTime;
        const currentSpawnRate = Math.max(100, this.constants.ENEMY_SPAWN_RATE_BASE * (this.constants.ENEMY_SPAWN_RATE_SCALE_PER_LEVEL ** (this.difficultyLevel - 1)));
        const currentMaxEnemies = Math.floor(this.constants.MAX_ENEMIES_BASE + this.constants.MAX_ENEMIES_INCREASE_PER_LEVEL * (this.difficultyLevel - 1));
        const activeEnemyCount = this.enemies.filter(e => e.active).length;
        if (this.enemySpawnTimer >= currentSpawnRate && activeEnemyCount < currentMaxEnemies) {
            this.entityManager.trySpawnSpecialOrNormalEnemy();
            this.enemySpawnTimer = 0;
        }

        // --- 清理無效實體 ---
        this.enemies = this.enemies.filter(e => e.active);
        this.arrows = this.arrows.filter(a => a.active);
        this.bullets = this.bullets.filter(b => b.active);
        this.fences = this.fences.filter(f => f.active);
        this.towers = this.towers.filter(t => t.active);
        this.effects = this.effects.filter(e => e.active);
        this.damageNumbers = this.damageNumbers.filter(dn => dn.active);

        // --- 檢查玩家與目標角色碰撞 ---
        if (this.goalCharacter && this.goalCharacter.active && !this.player.hasMetGoalCharacter) {
            if (simpleCollisionCheck(this.player, this.goalCharacter)) {
                this.player.hasMetGoalCharacter = true;
                this.goalCharacter.markAsInteracted();
                this.setMessage("找到目標！返回安全區！", 3000);
            }
        }

        // --- 檢查勝利條件 ---
        if (this.player.carryingTrophy && this.isPlayerInSafeZone()) {
            this.winGame();
        }

        // --- 檢查遊戲結束條件 ---
        if (this.player.hp <= 0 && this.gameState === 'running') {
            this.gameOver("你陣亡了！");
        }

        // --- 處理待處理的建造請求 ---
        if (this.inputHandler.pendingBuildRequest) {
            const request = this.inputHandler.pendingBuildRequest;
            if (request.type === 'fence') {
                this.entityManager.buildFence(request.x, request.y);
            } else if (request.type === 'tower') {
                this.entityManager.buildTower(request.x, request.y);
            }
            this.inputHandler.pendingBuildRequest = null;
        }

        // --- 檢查是否應該生成Mini-Boss ---
        if (this.difficultyLevel % this.constants.MINI_BOSS_SPAWN_LEVEL_INTERVAL === 0 && 
            this.miniBossSpawnedForLevel < this.difficultyLevel) {
            // 確保Mini-Boss和Boss不會在同一關卡生成
            if (this.difficultyLevel % this.constants.BOSS_SPAWN_LEVEL_INTERVAL !== 0) {
                this.entityManager.spawnMiniBoss(this.difficultyLevel);
                this.miniBossSpawnedForLevel = this.difficultyLevel;
                console.log(`Mini-Boss已生成 (難度等級: ${this.difficultyLevel})`);
            }
        }

        // --- 檢查是否應該生成Boss ---
        if (this.difficultyLevel % this.constants.BOSS_SPAWN_LEVEL_INTERVAL === 0 && 
            this.bossSpawnedForLevel < this.difficultyLevel) {
            this.entityManager.spawnBoss(this.difficultyLevel);
            this.bossSpawnedForLevel = this.difficultyLevel;
            console.log(`Boss已生成 (難度等級: ${this.difficultyLevel})`);
        }

        // 檢查是否應該增加難度
        this.enemiesKilled++;
        if (this.enemiesKilled >= this.constants.ENEMIES_PER_LEVEL) {
            this.enemiesKilled = 0;
            this.increaseDifficulty();
        }
     }

    // --- 繪圖邏輯 ---
    draw() {
         if (!this.ctx || !this.player || !this.constants) { return; }
         if (!this.areImagesLoaded && this.imagesToLoad > 0) {
             return;
         }

        const zoom = this.constants.CAMERA_ZOOM;

        // --- 清除畫布 ---
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        // --- 應用攝像機和縮放 ---
        this.ctx.save();
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // --- 繪製世界背景和安全區 (委託給 ui.js) ---
        drawWorld(this.ctx, this);

        // --- 繪製遊戲實體 (委託給 ui.js) ---
        drawEntities(this.ctx, this);

        // --- 恢復攝像機和縮放前的狀態 ---
        this.ctx.restore();

        // --- 繪製 UI (在頂層，不受攝像機和縮放影響) ---
        if (this.gameState === 'running') {
            drawHUD(this.ctx, this);
            drawMessages(this.ctx, this);
        } else if (this.gameState === 'won') {
            drawWinScreen(this.ctx, this);
        } else if (this.gameState === 'ended') {
            drawEndScreen(this.ctx, this);
        }
    }

    // --- drawWorldBackground 和 drawSafeZoneText 已移至 ui.js ---

    /**
     * 更新攝像機位置，使其平滑跟隨玩家。
     */
    updateCamera() {
        if (!this.player || !this.constants) return;

        const zoom = this.constants.CAMERA_ZOOM;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const visibleWorldWidth = canvasWidth / zoom;
        const visibleWorldHeight = canvasHeight / zoom;

        let targetX = this.player.centerX - visibleWorldWidth / 2;
        let targetY = this.player.centerY - visibleWorldHeight / 2;

        const lerpFactor = 0.1;
        this.camera.x += (targetX - this.camera.x) * lerpFactor;
        this.camera.y += (targetY - this.camera.y) * lerpFactor;

        const maxX = this.constants.WORLD_WIDTH - visibleWorldWidth;
        const maxY = this.constants.WORLD_HEIGHT - visibleWorldHeight;
        this.camera.x = Math.max(0, Math.min(maxX, this.camera.x));
        this.camera.y = Math.max(0, Math.min(maxY, this.camera.y));
    }

    // --- 輔助方法：檢查玩家是否在安全區 ---
    isPlayerInSafeZone() {
        if (!this.player || !this.constants) return false;
        return this.player.centerX < this.constants.SAFE_ZONE_WIDTH &&
               this.player.centerY > this.constants.SAFE_ZONE_TOP_Y &&
               this.player.centerY < this.constants.SAFE_ZONE_BOTTOM_Y;
     };

    // --- 新增：處理敵人被擊敗的邏輯 ---
    handleEnemyDefeat(enemy) {
        if (!this.player || !enemy) return;

        // --- 給予玩家獎勵 ---
        this.player.diamond += enemy.diamondReward;

        let goldReward = 0;
        if (enemy.enemyType === 'mini-boss') goldReward = this.constants.GOLD_REWARD_MINI_BOSS || 300;
        if (enemy.enemyType === 'boss') goldReward = this.constants.GOLD_REWARD_BOSS || 800;
        if (goldReward > 0) this.player.gold += goldReward;

        this.player.gainXp(enemy.xpReward, this);

        // --- 添加擊殺視覺效果 ---
        // 普通敵人的小爆炸效果
        this.effects.push(new NovaEffect(enemy.centerX, enemy.centerY, 30, 300, 'rgba(255, 200, 0, 0.7)'));
        
        // Boss敵人的大爆炸效果
        if (enemy.enemyType === 'boss' || enemy.enemyType === 'mini-boss') {
            this.effects.push(new NovaEffect(enemy.centerX, enemy.centerY, 60, 500, 'rgba(255, 100, 0, 0.8)'));
            this.effects.push(new ShockwaveEffect(enemy.centerX, enemy.centerY, 80, 600, 'rgba(255, 50, 0, 0.6)'));
            // 播放Boss擊敗音效
            if (this.audioManager && typeof this.audioManager.playSound === 'function') {
                this.audioManager.playSound('bossDeath');
            }
        }

        // --- 顯示擊殺消息 ---
        let killMsg = `擊殺 ${enemy.enemyType}! +${enemy.diamondReward} 💎`;
        if (goldReward > 0) killMsg += ` +${goldReward}G`;
        killMsg += ` (+${enemy.xpReward} XP)`;
        this.setMessage(killMsg, 1500);
    }

     // --- 遊戲狀態與交互 ---
    setMessage(text, duration) {
         if (this.messageText !== text || this.messageTimer <= 100) {
             this.messageText = text;
             this.messageTimer = duration;
         } else if (this.messageText === text) {
             this.messageTimer = Math.max(this.messageTimer, duration);
         }
    }

    gameOver(reason) {
        if (this.gameState !== 'running') return;
        this.gameState = 'ended';
        this.gameRunning = false; // 確保遊戲循環停止
        console.log("遊戲結束:", reason);
        // 繪製結束畫面由 draw() 方法根據 gameState 處理
    }

    winGame() {
        if (this.gameState !== 'running') return;
        this.gameState = 'won';
        this.gameRunning = false; // 遊戲勝利時也停止主循環
        console.log("恭喜！遊戲勝利！");
        // 繪製勝利畫面由 draw() 方法根據 gameState 處理
    }

    // --- 監聽器管理 ---
    attachListeners() {
        this.inputHandler.attachListeners();
        // 注意：resize 監聽器在 init 中處理，確保只添加一次
    }

     detachListeners() {
         this.inputHandler.detachListeners();
         window.removeEventListener('resize', this._boundResizeHandler); // 移除 resize 監聽器
         this.listenersAttached = false;
     }

    // --- 實體創建/工具方法 ---
    addDamageNumber(x, y, amount, color) {
        this.damageNumbers.push(new DamageNumber(x, y, amount, color, this.constants));
    }

    spawnGoalCharacter() {
        const constants = this.constants;
        const size = constants.TILE_SIZE * 1.5;
        const x = constants.WORLD_WIDTH - size - constants.TILE_SIZE;
        const y = constants.WORLD_HEIGHT / 2 - size / 2;

        let attempts = 0;
        let finalY = y;
        while (this.entityManager.isOccupied(x, finalY) && attempts < 10) {
            finalY += constants.TILE_SIZE;
            attempts++;
        }

        if (attempts >= 10) {
            console.error("無法為目標角色找到生成位置！");
            return;
        }

        this.goalCharacter = new GoalCharacter(x, finalY, size, constants);
        console.log(`目標角色已生成於 (${x.toFixed(0)}, ${finalY.toFixed(0)})`);
    }

    // --- 尋找目標方法 ---
     findNearestActiveEnemy(source, range) {
         let nearestEnemy = null;
         let minDistanceSq = range * range;
         const sourceCenterX = source.centerX || (source.x + (source.width || 0) / 2);
         const sourceCenterY = source.centerY || (source.y + (source.height || 0) / 2);
         const constants = this.constants;

         this.enemies.forEach(enemy => {
             if (!enemy.active) return;
             if (source instanceof Tower) {
                 if (enemy.centerX < constants.SAFE_ZONE_WIDTH && enemy.centerY > constants.SAFE_ZONE_TOP_Y && enemy.centerY < constants.SAFE_ZONE_BOTTOM_Y) {
                     return;
                 }
             }
             const distSq = distanceSqValues(sourceCenterX, sourceCenterY, enemy.centerX, enemy.centerY);
             if (distSq < minDistanceSq) {
                 minDistanceSq = distSq;
                 nearestEnemy = enemy;
             }
         });
         return nearestEnemy;
     }

     findMultipleEnemiesInRange(source, range, maxTargets) {
         if (maxTargets <= 0) return [];
         const targetsInRange = [];
         const rangeSq = range * range;
         const sourceCenterX = source.centerX || (source.x + (source.width || 0) / 2);
         const sourceCenterY = source.centerY || (source.y + (source.height || 0) / 2);

         this.enemies.forEach(enemy => {
             if (!enemy.active) return;
             const distSq = distanceSqValues(sourceCenterX, sourceCenterY, enemy.centerX, enemy.centerY);
             if (distSq < rangeSq) {
                 targetsInRange.push({ enemy: enemy, distSq: distSq });
             }
         });

         targetsInRange.sort((a, b) => a.distSq - b.distSq);
         return targetsInRange.slice(0, maxTargets).map(item => item.enemy);
     }

    // --- 添加特效/投射物 ---
    addSlashEffect(attacker, target) {
        this.effects.push(new SlashEffect(attacker, target, this.constants));
    }

    addBullet(shooter, target, options = {}) {
         const startX = shooter.centerX || (shooter.x + (shooter.width || 0) / 2);
         const startY = shooter.centerY || (shooter.y + (shooter.height || 0) / 2);
         this.bullets.push(new Bullet(startX, startY, target, shooter, this.constants, options));
     }

    addBossProjectile(shooter, startX, startY, directionDx, directionDy, speed, damage, color) {
         const len = Math.sqrt(directionDx * directionDx + directionDy * directionDy);
         const normDx = len > 0 ? directionDx / len : 0;
         const normDy = len > 0 ? directionDy / len : 0;
         const options = {
             homing: false,
             direction: { dx: normDx, dy: normDy },
             speed: speed,
             damage: damage,
             color: color,
             lifeTime: 4000
         };
         this.bullets.push(new Bullet(startX, startY, null, shooter, this.constants, options));
     }

    addArrow(shooter, target) {
        const dx = target.centerX - shooter.centerX;
        const dy = target.centerY - shooter.centerY;
        const angle = Math.atan2(dy, dx);
        const startDist = shooter.width / 2 + 5;
        const startX = shooter.centerX + Math.cos(angle) * startDist;
        const startY = shooter.centerY + Math.sin(angle) * startDist;
        this.arrows.push(new Arrow(startX, startY, target, shooter, this.constants));
    }


    // --- 技能觸發方法 ---
    triggerSkillAoe1(player, stats) {
        if (!stats || stats.level <= 0) return;
        const radius = stats.radius;
        const damage = stats.damage;
        const radiusSq = radius * radius;
        const effectColor = 'rgba(0, 150, 255, 0.7)';

        this.effects.push(new ShockwaveEffect(player.centerX, player.centerY, radius, 300, effectColor));

        this.enemies.forEach(enemy => {
            if (!enemy.active) return;
            const distSq = distanceSqValues(player.centerX, player.centerY, enemy.centerX, enemy.centerY);
            if (distSq < radiusSq) {
                const enemyDied = enemy.takeDamage(damage, this); // 獲取是否死亡
                this.addDamageNumber(enemy.centerX, enemy.y, damage, effectColor);
                if (enemyDied) {
                    this.handleEnemyDefeat(enemy); // 處理獎勵
                }
            }
        });
    }

    triggerSkillAoe2(player, stats) {
        if (!stats || stats.level <= 0) return;
        const radius = stats.radius;
        const damage = stats.damage;
        const radiusSq = radius * radius;
        const effectColor = 'rgba(255, 100, 0, 0.8)';

        this.effects.push(new NovaEffect(player.centerX, player.centerY, radius, 500, effectColor));

        this.enemies.forEach(enemy => {
            if (!enemy.active) return;
            const distSq = distanceSqValues(player.centerX, player.centerY, enemy.centerX, enemy.centerY);
            if (distSq < radiusSq) {
                const enemyDied = enemy.takeDamage(damage, this); // 獲取是否死亡
                this.addDamageNumber(enemy.centerX, enemy.y, damage, effectColor);
                 if (enemyDied) {
                    this.handleEnemyDefeat(enemy); // 處理獎勵
                }
            }
        });
    }

    triggerSkillLinear1(player, stats) {
        if (!stats || stats.level <= 0) return;
        const constants = this.constants;
        const targetEnemy = this.findNearestActiveEnemy(player, stats.range * 1.2);
        let direction = null;

        if (targetEnemy) {
            const dx = targetEnemy.centerX - player.centerX;
            const dy = targetEnemy.centerY - player.centerY;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                direction = { dx: dx / len, dy: dy / len };
            }
        } else {
            direction = { dx: player.facingRight ? 1 : -1, dy: 0 };
        }

        if (direction) {
            const bolt = new EnergyBolt(
                player.centerX,
                player.centerY,
                direction,
                player,
                constants,
                {
                    damage: stats.damage,
                    range: stats.range,
                    width: stats.width,
                }
            );
            this.bullets.push(bolt);
        }
    }

    triggerSkillLinear2(player, stats) {
        if (!stats || stats.level <= 0) return;
        const constants = this.constants;
        const targetEnemy = this.findNearestActiveEnemy(player, stats.range * 1.2);
        let direction = null;

        if (targetEnemy) {
            const dx = targetEnemy.centerX - player.centerX;
            const dy = targetEnemy.centerY - player.centerY;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                direction = { dx: dx / len, dy: dy / len };
            }
        } else {
            direction = { dx: player.facingRight ? 1 : -1, dy: 0 };
        }

        if (direction) {
            const beam = new EnergyBeam(
                player.centerX,
                player.centerY,
                direction,
                player,
                constants,
                {
                    damage: stats.damage,
                    range: stats.range,
                    width: stats.width,
                }
            );
            this.bullets.push(beam);
        };
    }

    // 在適當的地方添加難度增加的方法
    increaseDifficulty() {
        this.difficultyLevel++;
        console.log(`難度等級提升至: ${this.difficultyLevel}`);
        
        // 在難度提升時檢查是否應該生成 Boss
        this.checkBossSpawns();
    }

    // 添加一個專門檢查 Boss 生成的方法
    checkBossSpawns() {
        // 檢查是否應該生成Mini-Boss
        if (this.difficultyLevel % this.constants.MINI_BOSS_SPAWN_LEVEL_INTERVAL === 0 && 
            this.miniBossSpawnedForLevel < this.difficultyLevel) {
            // 確保Mini-Boss和Boss不會在同一關卡生成
            if (this.difficultyLevel % this.constants.BOSS_SPAWN_LEVEL_INTERVAL !== 0) {
                this.entityManager.spawnMiniBoss(this.difficultyLevel);
                this.miniBossSpawnedForLevel = this.difficultyLevel;
                console.log(`Mini-Boss已生成 (難度等級: ${this.difficultyLevel})`);
            }
        }

        // 檢查是否應該生成Boss
        if (this.difficultyLevel % this.constants.BOSS_SPAWN_LEVEL_INTERVAL === 0 && 
            this.bossSpawnedForLevel < this.difficultyLevel) {
            this.entityManager.spawnBoss(this.difficultyLevel);
            this.bossSpawnedForLevel = this.difficultyLevel;
            console.log(`Boss已生成 (難度等級: ${this.difficultyLevel})`);
        }
    }

}; // 結束 Game 類 (添加分號)
