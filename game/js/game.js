'use strict';

// --- 導入所有需要的模塊 ---
import { gameConstants } from './constants.js'; // 遊戲常量
// 工具函數 (距離計算、碰撞檢測等)
import { distanceSq, distanceSqValues, simpleCollisionCheck } from './utils.js';
import { Player } from './player.js'; // 玩家類
import { Enemy } from './enemy.js'; // 敵人類
import { Tree } from './environment.js'; // 環境物件 (樹木)
import { Structure, Fence, Tower } from './structures.js'; // 建築物 (基礎、柵欄、塔)
import { Shop } from './shop.js'; // 商店類
// 導入所有投射物和效果類
import { Bullet, Arrow, EnergyBolt, EnergyBeam } from './projectiles.js';
import { SlashEffect, DamageNumber, ShockwaveEffect, NovaEffect } from './effects.js';
import { InputHandler } from './inputHandler.js'; // 輸入處理器
import { drawHUD, drawMessages } from './ui.js'; // UI 繪圖函數 (抬頭顯示、消息)


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
        this.inputHandler = new InputHandler(this); // 創建 InputHandler 實例，傳入 game 引用

        this.setCanvasSize(); // 設置畫布尺寸
        this.resetState(); // 初始化遊戲狀態變量

        // 綁定 gameLoop 的 this 指向，確保在 requestAnimationFrame 中正確執行
        this.gameLoop = this.gameLoop.bind(this);

        // 圖像加載相關變量
        this.imagesToLoad = 0; // 需要加載的圖像總數
        this.imagesLoaded = 0; // 已加載完成的圖像數量
        this.areImagesLoaded = false; // 標記初始資源是否已準備就緒

        this.treeRespawnQueue = []; // 用於安排樹木重生的隊列
    }

    /**
     * 根據常量設置 Canvas 的寬度和高度。
     */
    setCanvasSize() {
        this.canvas.width = this.constants.CANVAS_WIDTH;
        this.canvas.height = this.constants.CANVAS_HEIGHT;
    }

    /**
     * 初始化或重置遊戲狀態變量。
     * 在遊戲開始或重新開始時調用。
     */
    resetState() {
        // 遊戲實體數組
        this.player = null; // 玩家對象
        this.enemies = []; // 敵人數組
        this.trees = []; // 樹木數組
        this.fences = []; // 柵欄數組
        this.towers = []; // 防禦塔數組
        this.bullets = []; // 子彈數組 (防禦塔、Boss、玩家直線技能)
        this.arrows = []; // 箭矢數組 (玩家弓箭)
        this.effects = []; // 效果數組 (劈砍、範圍技能、其他視覺效果)
        this.damageNumbers = []; // 傷害數字數組

        // 商店建築對象
        this.tradingPost = null;
        this.weaponShop = null; // 改名
        this.healingRoom = null;
        this.skillInstitute = null; // 新增研究所

        // 輸入狀態 (由 InputHandler 更新)
        this.keysPressed = {};

        // 遊戲邏輯變量
        this.enemySpawnTimer = 0; // 敵人生成計時器
        this.elapsedGameTime = 0; // 遊戲已進行時間
        this.difficultyLevel = 1; // 當前難度等級
        this.bossSpawnedForLevel = -1; // 標記當前難度等級是否已生成 Boss/Mini-Boss

        // UI 消息
        this.messageText = ''; // 當前顯示的消息文本
        this.messageTimer = 0; // 消息顯示剩餘時間

        // 攝像機
        this.camera = { x: 0, y: 0 }; // 攝像機左上角座標

        // 遊戲循環控制
        this.lastTime = 0; // 上一幀的時間戳
        this.gameRunning = false; // 遊戲是否正在運行

        // 樹木重生隊列
        this.treeRespawnQueue = [];

        console.log("遊戲狀態已重置。難度等級: 1");
    }


    // --- 初始化步驟 ---

    /**
     * 初始化遊戲。
     * 設置所有內容並準備開始遊戲循環。
     */
    init() {
        console.log("正在初始化遊戲...");
        this.resetState(); // 確保狀態乾淨
        this.setupShops(); // 創建商店實例
        this.spawnInitialEntities(); // 生成初始實體 (玩家、樹木、敵人)
        this.loadGameImages(); // 開始異步加載遊戲圖像
        this.attachListeners(); // 附加事件監聽器 (通過 InputHandler)
        console.log("遊戲初始化序列完成。等待圖像加載...");
        // 遊戲循環將在圖像加載完成後由回調函數啟動
    }

    /**
     * 創建並放置商店建築。
     */
    setupShops() {
        const TILE_SIZE = this.constants.TILE_SIZE;
        const shopMargin = TILE_SIZE * 2; // 商店區域左邊距
        const shopWidth = TILE_SIZE * 2; // 商店寬度
        const shopHeight = TILE_SIZE * 2; // 商店高度
        const shopX = shopMargin; // 商店的 X 座標

        // 使用 constants.js 中導出的建築 Y 座標
        const tradingPostY = this.constants.topBuildingY;
        const weaponShopY = this.constants.middleBuildingY; // 使用導出的中間 Y
        const healingRoomY = this.constants.bottomBuildingY;
        const skillInstituteY = this.constants.instituteBuildingY;

        // 創建交易站、武器店、治療室、研究所實例
        this.tradingPost = new Shop(shopX, tradingPostY, shopWidth, shopHeight, '#FFD700', 'trading_post'); // 黃色
        this.weaponShop = new Shop(shopX, weaponShopY, shopWidth, shopHeight, '#B22222', 'weapon_shop'); // 火磚色 (改名)
        this.healingRoom = new Shop(shopX, healingRoomY, shopWidth, shopHeight, '#90EE90', 'healing_room'); // 淺綠色
        this.skillInstitute = new Shop(shopX, skillInstituteY, shopWidth, shopHeight, '#8A2BE2', 'skill_institute'); // 紫羅蘭色 (新增)

        // DEBUG LOGS for shop creation
        console.log('Trading Post:', this.tradingPost ? `(${this.tradingPost.x}, ${this.tradingPost.y})` : 'null');
        console.log('Weapon Shop:', this.weaponShop ? `(${this.weaponShop.x}, ${this.weaponShop.y})` : 'null');
        console.log('Healing Room:', this.healingRoom ? `(${this.healingRoom.x}, ${this.healingRoom.y})` : 'null');
        console.log('Skill Institute:', this.skillInstitute ? `(${this.skillInstitute.x}, ${this.skillInstitute.y})` : 'null');

        console.log(`商店和研究所已創建。安全區範圍: Y=[${this.constants.SAFE_ZONE_TOP_Y.toFixed(0)}, ${this.constants.SAFE_ZONE_BOTTOM_Y.toFixed(0)}]`);
    }

    /**
     * 生成遊戲開始時的初始實體（玩家、樹木、敵人）。
     */
    spawnInitialEntities() {
        const constants = this.constants;
        const playerSize = constants.TILE_SIZE; // 玩家尺寸
        // 計算玩家初始位置 (在商店區右側的安全通道中間)
        const shopAreaEndX = constants.TILE_SIZE * 4; // 商店區域結束的 X 座標
        const safeLaneWidth = constants.SAFE_ZONE_WIDTH - shopAreaEndX; // 安全通道寬度
        const playerStartX = shopAreaEndX + safeLaneWidth / 2 - playerSize / 2; // 玩家起始 X
        const playerStartY = constants.WORLD_HEIGHT / 2 - playerSize / 2; // 玩家起始 Y (垂直居中)

        // 創建玩家實例
        this.player = new Player(playerStartX, playerStartY, playerSize, playerSize, constants);
        console.log(`玩家已生成於 (${playerStartX.toFixed(0)}, ${playerStartY.toFixed(0)})`);

        // 生成初始樹木
        for (let i = 0; i < constants.INITIAL_TREES; i++) { this.spawnTree(true); } // allowAnywhere=true 允許在任何地方生成初始樹木
        // 生成初始敵人
        for (let i = 0; i < constants.INITIAL_ENEMIES; i++) {
             this.spawnEnemy(true, 1, 'normal'); // allowAnywhere=true, 初始難度 1, 普通類型
         }
    }

    /**
     * 開始加載所有必要的遊戲圖像。
     */
     loadGameImages() {
         console.log("正在加載遊戲圖像...");
         this.imagesToLoad = 0; // 重置計數器
         this.imagesLoaded = 0;
         this.areImagesLoaded = false; // 重置標誌

         // 定義需要加載的圖像 URL
         const urls = {
             player: this.constants.PLAYER_IMAGE_DATA_URL,
             enemy: this.constants.ENEMY_IMAGE_DATA_URL,
             miniBoss: this.constants.MINI_BOSS_IMAGE_URL,
             boss: this.constants.BOSS_IMAGE_URL,
             tree: this.constants.TREE_IMAGE_URL
             // 可以添加其他圖像，如投射物、建築等
         };

         // 封裝的圖像加載函數
         const loadImage = (key, url, targetObject = null) => {
             if (!url) { // 如果 URL 無效
                 console.warn(`${key} 圖像 URL 缺失。`);
                 if (targetObject) targetObject.imageLoaded = true; // 如果有關聯對象，標記其圖像為已加載（使用回退繪製）
                 return;
             }
             this.imagesToLoad++; // 增加需要加載的圖像計數
             // 如果有關聯對象 (如 Player)，則使用其 image 屬性；否則創建新的 Image 對象
             const img = targetObject ? targetObject.image : new Image();
             // 設置加載成功的回調
             img.onload = () => {
                 console.log(`${key} 圖像加載成功: ${url.substring(0, 50)}...`);
                 if (targetObject) targetObject.imageLoaded = true; // 標記關聯對象的圖像已加載
                 this.imageLoadCallback(); // 調用計數回調
             };
             // 設置加載失敗的回調
             img.onerror = () => {
                 console.error(`加載 ${key} 圖像錯誤: ${url}`);
                 if (targetObject) targetObject.imageLoaded = true; // 加載失敗也標記為已加載（使用回退繪製）
                 this.imageLoadCallback(); // 調用計數回調
             };
             img.src = url; // 開始加載圖像
             // 檢查圖像是否可能已在緩存中
              if (img.complete && img.naturalWidth > 0) {
                 console.log(`${key} 圖像可能已緩存。`);
             }
         };

         // 加載各個圖像
         if (this.player) { loadImage('player', urls.player, this.player); } else { console.error("加載圖像前未創建玩家對象！"); }
         loadImage('enemy', urls.enemy); // 普通敵人圖像（不需要 targetObject）
         loadImage('miniBoss', urls.miniBoss); // 迷你 Boss 圖像
         loadImage('boss', urls.boss); // Boss 圖像
         loadImage('tree', urls.tree); // 樹木圖像

         // 如果沒有有效的圖像 URL 需要加載
          if (this.imagesToLoad === 0) {
             console.warn("未找到有效的圖像 URL 進行加載。");
             this.areImagesLoaded = true; // 直接標記為已加載
             this.startGameLoop(); // 嘗試啟動遊戲循環
         } else {
             console.log(`嘗試加載 ${this.imagesToLoad} 個圖像。`);
         }
     }

    /**
     * 每個圖像加載完成或失敗時的回調函數。
     * 用於跟踪加載進度並在所有圖像處理完畢後啟動遊戲循環。
     */
     imageLoadCallback() {
         this.imagesLoaded++; // 增加已處理的圖像計數
         console.log(`圖像加載進度: ${this.imagesLoaded} / ${this.imagesToLoad}`);
         // 如果所有需要加載的圖像都已處理完畢，且尚未標記為全部加載完成
         if (this.imagesLoaded >= this.imagesToLoad && !this.areImagesLoaded) {
             this.areImagesLoaded = true; // 標記所有圖像已加載（或失敗）
             console.log("所有追蹤的圖像已加載或失敗。啟動遊戲循環。");
             this.startGameLoop(); // 啟動遊戲循環
         }
     }

    /**
     * 啟動遊戲主循環。
     * 只有在圖像加載完成且遊戲尚未運行時才會啟動。
     */
    startGameLoop() {
        if (this.areImagesLoaded && !this.gameRunning) { // 確保圖像已加載且循環未運行
            this.gameRunning = true; // 設置遊戲運行標誌
            this.lastTime = performance.now(); // 記錄初始時間戳
            this.updateCamera(); // 初始更新一次攝像機位置
            requestAnimationFrame(this.gameLoop); // 請求第一幀動畫
            console.log("遊戲循環已啟動。");
        } else if (!this.areImagesLoaded) {
            console.log("等待圖像加載完成才能啟動循環...");
        }
    }


    // --- 遊戲循環 ---

    /**
     * 遊戲主循環函數。
     * 由 requestAnimationFrame 遞歸調用。
     * @param {number} timestamp - 由 requestAnimationFrame 提供的當前時間戳
     */
    gameLoop(timestamp) {
        if (!this.gameRunning) return; // 如果遊戲停止，則退出循環

        // 計算時間差 (deltaTime)，並進行處理以防止異常值
        let deltaTime = timestamp - this.lastTime;
        if (isNaN(deltaTime) || deltaTime <= 0) { deltaTime = 16.67; } // 如果時間戳異常，使用約 60fps 的時間
        deltaTime = Math.min(deltaTime, 100); // 限制最大 deltaTime，防止卡頓時跳躍過大
        this.lastTime = timestamp; // 更新上一幀的時間戳

        // 更新遊戲狀態
        this.update(deltaTime);
        // 繪製遊戲畫面
        this.draw();

        // 請求下一幀動畫
        requestAnimationFrame(this.gameLoop);
    }

    // --- 更新邏輯 ---

    /**
     * 更新遊戲內所有元素的狀態。
     * @param {number} deltaTime - 距離上一幀的時間差（毫秒）
     */
    update(deltaTime) {
        // 基本檢查
        if (!this.gameRunning || !this.player || !this.constants) return;

        // --- 更新遊戲時間和難度 ---
        this.elapsedGameTime += deltaTime; // 累加遊戲時間
        // 計算新的難度等級
        const newDifficultyLevel = Math.floor(this.elapsedGameTime / this.constants.TIME_PER_DIFFICULTY_LEVEL) + 1;
        // 如果難度等級提升
        if (newDifficultyLevel > this.difficultyLevel) {
            console.log(`難度從 ${this.difficultyLevel} 提升至 ${newDifficultyLevel}`);
            this.difficultyLevel = newDifficultyLevel; // 更新難度等級
            this.bossSpawnedForLevel = -1; // 重置 Boss 生成標記
            this.setMessage(`關卡 ${this.difficultyLevel}`, 2500); // 顯示提示消息
        }

        // --- 更新實體 ---
        try {
             // 更新玩家 (如果活躍)
             if (this.player.active) this.player.update(deltaTime, this);
        } catch (e) {
             // 捕獲玩家更新時的錯誤，防止遊戲崩潰
             console.error("更新玩家時出錯:", e);
             this.gameOver("玩家更新錯誤"); // 觸發遊戲結束
             return; // 停止後續更新
        }
        // 更新活躍的箭矢
        for (const arrow of this.arrows) if (arrow.active) arrow.update(deltaTime, this);
        // 更新活躍的子彈
        for (const bullet of this.bullets) if (bullet.active) bullet.update(deltaTime, this);
        // 更新活躍的防禦塔
        for (const tower of this.towers) if (tower.active) tower.update(deltaTime, this);
        // 更新活躍的敵人
        for (const enemy of this.enemies) if (enemy.active) enemy.update(deltaTime, this);
        // 更新活躍的視覺效果
        for (const effect of this.effects) if (effect.active) effect.update(deltaTime);
        // 更新活躍的傷害數字
        for (const dn of this.damageNumbers) if (dn.active) dn.update(deltaTime);

        // --- 更新攝像機 ---
        this.updateCamera();

        // --- 更新 UI 消息計時器 ---
        if (this.messageTimer > 0) {
            this.messageTimer -= deltaTime; // 減少剩餘時間
            if (this.messageTimer <= 0) { // 如果時間到
                this.messageText = ''; // 清空消息文本
                this.messageTimer = 0;
            }
        }

        // --- 處理樹木重生 ---
        this.processTreeRespawns(performance.now());

        // --- 敵人生成邏輯 ---
        this.enemySpawnTimer += deltaTime; // 累加生成計時器
        // 計算當前難度下的生成速率和最大數量
        const currentSpawnRate = Math.max(100, this.constants.ENEMY_SPAWN_RATE_BASE * (this.constants.ENEMY_SPAWN_RATE_SCALE_PER_LEVEL ** (this.difficultyLevel - 1)));
        const currentMaxEnemies = Math.floor(this.constants.MAX_ENEMIES_BASE + this.constants.MAX_ENEMIES_INCREASE_PER_LEVEL * (this.difficultyLevel - 1));
        const activeEnemyCount = this.enemies.filter(e => e.active).length; // 計算當前活躍敵人數量
        // 如果計時器到達且未達到最大敵人數量
        if (this.enemySpawnTimer >= currentSpawnRate && activeEnemyCount < currentMaxEnemies) {
            this.trySpawnSpecialOrNormalEnemy(); // 嘗試生成敵人
            this.enemySpawnTimer = 0; // 重置計時器
        }

        // --- 清理無效實體 ---
        // 使用 filter 過濾掉 active 為 false 的實體，創建新的數組
        this.enemies = this.enemies.filter(e => e.active);
        this.arrows = this.arrows.filter(a => a.active);
        this.bullets = this.bullets.filter(b => b.active);
        this.fences = this.fences.filter(f => f.active);
        this.towers = this.towers.filter(t => t.active);
        this.effects = this.effects.filter(e => e.active); // 清理不活躍的效果
        this.damageNumbers = this.damageNumbers.filter(dn => dn.active);

        // --- 檢查遊戲結束條件 ---
        if (this.player.hp <= 0 && this.gameRunning) { // 如果玩家生命值耗盡且遊戲仍在運行
            this.gameOver("你陣亡了！"); // 觸發遊戲結束
        }
    }

    /**
     * 嘗試生成特殊敵人（Boss 或 Mini-Boss）或普通敵人。
     * (此方法現在似乎與 EntityManager 中的方法重複，可能需要整合)
     */
    trySpawnSpecialOrNormalEnemy() {
        let spawnHandled = false;
        const constants = this.constants;
        // 檢查是否生成 Boss
        if (this.difficultyLevel % 10 === 0 && this.bossSpawnedForLevel !== this.difficultyLevel) {
            const bossExists = this.enemies.some(e => e.active && e.enemyType === 'boss' && e.difficultyLevel === this.difficultyLevel);
            if (!bossExists) {
                console.log(`嘗試為等級 ${this.difficultyLevel} 生成 BOSS`);
                if (this.spawnEnemy(false, this.difficultyLevel, 'boss', constants.BOSS_IMAGE_URL)) {
                    this.bossSpawnedForLevel = this.difficultyLevel;
                    spawnHandled = true;
                } else { console.warn("生成 BOSS 失敗。"); }
            } else { this.bossSpawnedForLevel = this.difficultyLevel; }
        }
        // 檢查是否生成 Mini-Boss
        else if (this.difficultyLevel % 5 === 0 && this.bossSpawnedForLevel !== this.difficultyLevel) {
            const miniBossExists = this.enemies.some(e => e.active && e.enemyType === 'mini-boss' && e.difficultyLevel === this.difficultyLevel);
            if (!miniBossExists) {
                let numToSpawn = 1 + Math.floor((this.difficultyLevel - 5) / 10);
                numToSpawn = Math.max(1, numToSpawn);
                console.log(`嘗試為等級 ${this.difficultyLevel} 生成 ${numToSpawn} 個 MINI-BOSS`);
                let spawnedCount = 0;
                for (let i = 0; i < numToSpawn; i++) {
                    const activeCount = this.enemies.filter(e => e.active).length;
                    const maxEnemies = Math.floor(constants.MAX_ENEMIES_BASE + constants.MAX_ENEMIES_INCREASE_PER_LEVEL * (this.difficultyLevel - 1));
                    if (activeCount >= maxEnemies) { console.warn("已達到最大敵人數量..."); break; }
                    if(this.spawnEnemy(false, this.difficultyLevel, 'mini-boss', constants.MINI_BOSS_IMAGE_URL)) {
                        spawnedCount++;
                    } else { console.warn(`生成 mini-boss #${i+1} 失敗。`); }
                }
                if (spawnedCount > 0) {
                    this.bossSpawnedForLevel = this.difficultyLevel;
                    spawnHandled = true;
                }
            } else { this.bossSpawnedForLevel = this.difficultyLevel; }
        }
        // 生成普通敵人
        if (!spawnHandled) {
            this.spawnEnemy(false, this.difficultyLevel, 'normal', constants.ENEMY_IMAGE_DATA_URL);
        }
    }


    // --- 繪圖邏輯 ---

    /**
     * 繪製遊戲的當前幀。
     */
    draw() {
         // 基本檢查
         if (!this.ctx || !this.player || !this.constants) { return; }
         // 如果圖像仍在加載，則不繪製遊戲內容 (可以顯示加載畫面)
         if (!this.areImagesLoaded && this.imagesToLoad > 0) {
             // 可以選擇在這裡繪製加載指示器
             return;
         }

        const zoom = this.constants.CAMERA_ZOOM; // 獲取鏡頭縮放比例

        // --- 清除畫布 ---
        this.ctx.save(); // 保存當前變換狀態
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置變換矩陣
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // 清除整個畫布
        this.ctx.restore(); // 恢復之前的變換狀態

        // --- 應用攝像機和縮放 ---
        this.ctx.save(); // 保存狀態，以便後續繪製 UI 時恢復
        this.ctx.scale(zoom, zoom); // 應用縮放
        this.ctx.translate(-this.camera.x, -this.camera.y); // 應用攝像機位移

        // --- 繪製世界背景和安全區 ---
        this.drawWorldBackground();

        // --- 繪製遊戲實體 (考慮可見性) ---
        const cam = this.camera; // 攝像機對象
        const visibleWidth = this.canvas.width / zoom; // 可見區域的世界寬度
        const visibleHeight = this.canvas.height / zoom; // 可見區域的世界高度
        const leeway = 50 / zoom; // 視錐體剔除的緩衝區 (按縮放調整)

        // 繪製樹木 (如果活躍且在視圖內)
        this.trees.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(this.ctx));

        // DEBUG LOGS for shop drawing (Uncommented for debugging)
        console.log('--- Drawing Shops ---');
        console.log('Trading Post Exists:', !!this.tradingPost, 'In View:', this.tradingPost ? this.tradingPost.isRectInView(cam, visibleWidth, visibleHeight, leeway) : 'N/A');
        console.log('Weapon Shop Exists:', !!this.weaponShop, 'In View:', this.weaponShop ? this.weaponShop.isRectInView(cam, visibleWidth, visibleHeight, leeway) : 'N/A');
        console.log('Healing Room Exists:', !!this.healingRoom, 'In View:', this.healingRoom ? this.healingRoom.isRectInView(cam, visibleWidth, visibleHeight, leeway) : 'N/A');
        console.log('Skill Institute Exists:', !!this.skillInstitute, 'In View:', this.skillInstitute ? this.skillInstitute.isRectInView(cam, visibleWidth, visibleHeight, leeway) : 'N/A');

        // 繪製商店 (如果存在且在視圖內)
        if (this.tradingPost && this.tradingPost.isRectInView(cam, visibleWidth, visibleHeight, leeway)) this.tradingPost.draw(this.ctx, this);
        if (this.weaponShop && this.weaponShop.isRectInView(cam, visibleWidth, visibleHeight, leeway)) this.weaponShop.draw(this.ctx, this); // 改名
        if (this.healingRoom && this.healingRoom.isRectInView(cam, visibleWidth, visibleHeight, leeway)) this.healingRoom.draw(this.ctx, this);
        if (this.skillInstitute && this.skillInstitute.isRectInView(cam, visibleWidth, visibleHeight, leeway)) this.skillInstitute.draw(this.ctx, this); // 新增
        // 繪製安全區文字
        this.drawSafeZoneText();
        // 繪製柵欄
        this.fences.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(this.ctx));
        // 繪製防禦塔
        this.towers.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(this.ctx));
        // 繪製視覺效果 (劈砍、範圍技能等)
        this.effects.forEach(e => e.active && e.draw(this.ctx)); // 特效通常不需要視錐體剔除
        // 繪製箭矢
        this.arrows.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(this.ctx));
        // 繪製子彈 (包括技能投射物)
        this.bullets.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(this.ctx));
        // 繪製敵人
        this.enemies.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(this.ctx));
        // 繪製玩家 (如果活躍且在視圖內)
        if (this.player.active && this.player.isRectInView(cam, visibleWidth, visibleHeight, leeway)) this.player.draw(this.ctx);
        // 繪製傷害數字
        this.damageNumbers.forEach(dn => dn.draw(this.ctx)); // 傷害數字通常不需要視錐體剔除

        // --- 恢復攝像機和縮放前的狀態 ---
        this.ctx.restore(); // 恢復到應用攝像機和縮放之前的狀態

        // --- 繪製 UI (在頂層，不受攝像機和縮放影響) ---
        // 調用從 ui.js 導入的函數
        drawHUD(this.ctx, this);       // 繪製抬頭顯示 (血條、資源等)
        drawMessages(this.ctx, this); // 繪製屏幕消息
    }

    /**
     * 繪製世界背景（主要是安全區的可視化）。
     */
    drawWorldBackground() {
        this.ctx.save(); // 保存狀態
        // 繪製安全區背景 (半透明綠色)
        this.ctx.fillStyle = 'rgba(160, 210, 160, 0.3)';
        const szTop = this.constants.SAFE_ZONE_TOP_Y;
        const szBottom = this.constants.SAFE_ZONE_BOTTOM_Y;
        const szWidth = this.constants.SAFE_ZONE_WIDTH;
        this.ctx.fillRect(0, szTop, szWidth, szBottom - szTop); // 填充矩形
        // 繪製安全區邊框 (半透明白色虛線)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 5]); // 設置虛線樣式
        this.ctx.strokeRect(0, szTop, szWidth, szBottom - szTop); // 描邊矩形
        this.ctx.setLineDash([]); // 清除虛線樣式
        this.ctx.restore(); // 恢復狀態
    }

    /**
     * 在安全區中間繪製 "安全區" 文字。
     */
     drawSafeZoneText() {
         this.ctx.save(); // 保存狀態
         // 設置字體樣式
         this.ctx.font = "bold 24px 'Nunito', sans-serif";
         this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'; // 半透明白色
         this.ctx.textAlign = 'center'; // 水平居中
         this.ctx.textBaseline = 'middle'; // 垂直居中
         // 計算文字位置 (安全區通道的中心)
         const shopAreaEndX = this.constants.TILE_SIZE * 4;
         const textX = shopAreaEndX + (this.constants.SAFE_ZONE_WIDTH - shopAreaEndX) / 2;
         const textY = (this.constants.SAFE_ZONE_TOP_Y + this.constants.SAFE_ZONE_BOTTOM_Y) / 2;
         // 添加陰影以提高可讀性
         this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
         this.ctx.shadowOffsetX = 1; this.ctx.shadowOffsetY = 1; this.ctx.shadowBlur = 2;
         // 繪製文字
         this.ctx.fillText("安全區", textX, textY);
         this.ctx.restore(); // 恢復狀態
     }

    /**
     * 更新攝像機位置，使其平滑跟隨玩家。
     * 同時限制攝像機不超出世界邊界。
     */
    updateCamera() {
        if (!this.player || !this.constants) return; // 確保玩家和常量存在

        const zoom = this.constants.CAMERA_ZOOM; // 獲取縮放比例
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        // 計算縮放後的可見世界尺寸
        const visibleWorldWidth = canvasWidth / zoom;
        const visibleWorldHeight = canvasHeight / zoom;

        // 計算目標攝像機位置 (使玩家位於畫面中心)
        let targetX = this.player.centerX - visibleWorldWidth / 2;
        let targetY = this.player.centerY - visibleWorldHeight / 2;

        // 使用線性插值 (Lerp) 實現平滑跟隨
        const lerpFactor = 0.1; // 插值因子，值越小跟隨越慢、越平滑
        this.camera.x += (targetX - this.camera.x) * lerpFactor;
        this.camera.y += (targetY - this.camera.y) * lerpFactor;

        // 限制攝像機移動範圍，防止看到世界外部
        const maxX = this.constants.WORLD_WIDTH - visibleWorldWidth; // 最大 X 座標
        const maxY = this.constants.WORLD_HEIGHT - visibleWorldHeight; // 最大 Y 座標
        this.camera.x = Math.max(0, Math.min(maxX, this.camera.x)); // 限制 X 在 [0, maxX] 範圍內
        this.camera.y = Math.max(0, Math.min(maxY, this.camera.y)); // 限制 Y 在 [0, maxY] 範圍內
    }

    // --- UI 繪圖方法已移至 ui.js ---
    // --- REMOVED drawHUD method ---
    // --- REMOVED drawMessages method ---

    // --- 遊戲狀態與交互 ---

    /**
     * 在屏幕上設置一條消息，持續指定時間。
     * 如果是相同的消息，會延長顯示時間。
     * @param {string} text - 要顯示的消息文本
     * @param {number} duration - 消息顯示的持續時間（毫秒）
     */
    setMessage(text, duration) {
         // 如果是新消息，或者舊消息快要消失了，直接設置新消息和時間
         if (this.messageText !== text || this.messageTimer <= 100) {
             this.messageText = text;
             this.messageTimer = duration;
         } else if (this.messageText === text) { // 如果是重複的消息
             // 延長顯示時間，取當前剩餘時間和新持續時間中的較大值
             this.messageTimer = Math.max(this.messageTimer, duration);
         }
    }

    /**
     * 處理遊戲結束邏輯。
     * 停止遊戲循環，移除監聽器，並顯示結束畫面。
     * @param {string} reason - 遊戲結束的原因
     */
    gameOver(reason) {
        if (!this.gameRunning) return; // 如果遊戲已經結束，則不執行
        this.gameRunning = false; // 停止遊戲循環標誌
        console.log("遊戲結束:", reason);
        this.detachListeners(); // 移除事件監聽器 (通過 InputHandler)

        // 使用 requestAnimationFrame 確保在下一幀繪製結束畫面
        requestAnimationFrame(() => {
             if (this.ctx) { // 確保渲染上下文存在
                 // 繪製半透明黑色背景遮罩
                 this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                 this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                 // 設置文字樣式
                 this.ctx.fillStyle = 'white';
                 this.ctx.textAlign = 'center';
                 // 繪製 "遊戲結束!"
                 this.ctx.font = "bold 32px 'Nunito', sans-serif";
                 this.ctx.fillText("遊戲結束!", this.canvas.width / 2, this.canvas.height / 2 - 30);
                 // 繪製結束原因
                 this.ctx.font = "22px 'Nunito', sans-serif";
                 this.ctx.fillText(reason, this.canvas.width / 2, this.canvas.height / 2 + 15);
                 // 繪製重新開始提示
                 this.ctx.font = "18px 'Nunito', sans-serif";
                 this.ctx.fillText("刷新頁面 (F5) 重新開始", this.canvas.width / 2, this.canvas.height / 2 + 60);
             }
        });
    }

    // --- 修改後的監聽器方法 (委派給 InputHandler) ---
    /**
     * 附加事件監聽器。
     */
    attachListeners() {
        this.inputHandler.attachListeners(); // 調用 InputHandler 的方法
    }

    /**
     * 移除事件監聽器。
     */
     detachListeners() {
         this.inputHandler.detachListeners(); // 調用 InputHandler 的方法
     }

    // --- 輸入處理相關方法已移至 InputHandler ---
    // --- REMOVED _handleKeyDown, _handleKeyUp, _handleClick, _handleContextMenu methods ---


    // --- 實體創建/工具方法 (部分可能移交 EntityManager 更合適) ---

    /**
     * 添加一個傷害數字特效到遊戲中。
     * @param {number} x - 數字出現的 X 座標
     * @param {number} y - 數字出現的 Y 座標
     * @param {number} amount - 顯示的傷害數值
     * @param {string} color - 數字的顏色
     */
    addDamageNumber(x, y, amount, color) {
        this.damageNumbers.push(new DamageNumber(x, y, amount, color, this.constants));
    }

    /**
     * 生成一個敵人 (此方法與 EntityManager 中的重複，建議整合)。
     * @param {boolean} [allowAnywhere=false]
     * @param {number} [difficultyLevel=1]
     * @param {string} [enemyType='normal']
     * @param {string|null} [imageUrl=null]
     * @returns {boolean}
     */
    spawnEnemy(allowAnywhere = false, difficultyLevel = 1, enemyType = 'normal', imageUrl = null) {
         // (代碼與 EntityManager.spawnEnemy 基本相同，建議移除此處的實現，調用 EntityManager 的方法)
         const constants = this.constants;
         const sizeMultiplier = (enemyType === 'boss' ? 1.8 : (enemyType === 'mini-boss' ? 1.5 : 1.2));
         const size = constants.TILE_SIZE * sizeMultiplier;
         let x, y, attempts = 0;
         const maxAttempts = 50;
         do {
            x = Math.random() * (constants.WORLD_WIDTH - size);
            y = Math.random() * (constants.WORLD_HEIGHT - size);
            attempts++;
         } while (
            (
                !allowAnywhere &&
                (
                    (x + size / 2 < constants.SAFE_ZONE_WIDTH && y + size / 2 > constants.SAFE_ZONE_TOP_Y && y + size / 2 < constants.SAFE_ZONE_BOTTOM_Y) ||
                    (this.player && this.player.active && distanceSqValues(x + size / 2, y + size / 2, this.player.centerX, this.player.centerY) < constants.SAFE_SPAWN_DIST_SQ)
                )
            ) ||
            this.enemies.some(e => e.active && distanceSqValues(x + size / 2, y + size / 2, e.centerX, e.centerY) < (size * 0.8) ** 2)
         && attempts < maxAttempts);
         if (attempts >= maxAttempts) { console.warn(`無法為 ${enemyType} 找到合適的生成位置...`); return false; }
         if (!allowAnywhere && (x + size / 2 < constants.SAFE_ZONE_WIDTH && y + size / 2 > constants.SAFE_ZONE_TOP_Y && y + size / 2 < constants.SAFE_ZONE_BOTTOM_Y)) { console.warn(`${enemyType} 的生成嘗試最終位置在安全區內...`); return false; }
         const newEnemy = new Enemy(x, y, size, size, constants, difficultyLevel, enemyType, imageUrl);
         this.enemies.push(newEnemy);
         return true;
    }

    /**
     * 生成一棵樹 (此方法與 EntityManager 中的重複，建議整合)。
     * @param {boolean} [allowAnywhere=false]
     * @returns {boolean}
     */
    spawnTree(allowAnywhere = false) {
         // (代碼與 EntityManager.spawnTree 基本相同，建議移除此處的實現，調用 EntityManager 的方法)
         const constants = this.constants;
         const width = constants.TILE_SIZE;
         const height = constants.TILE_SIZE * 1.5;
         const margin = constants.TILE_SIZE;
         let x, y, attempts = 0;
         const maxAttempts = 30;
         const checkRect = { width, height };
         do {
            x = Math.random() * (constants.WORLD_WIDTH - margin * 2 - width) + margin;
            y = Math.random() * (constants.WORLD_HEIGHT - margin * 2 - height) + margin;
            checkRect.x = x; checkRect.y = y;
            attempts++;
         } while (
            (
                (!allowAnywhere && (x + width / 2 < constants.SAFE_ZONE_WIDTH && y + height / 2 > constants.SAFE_ZONE_TOP_Y && y + height / 2 < constants.SAFE_ZONE_BOTTOM_Y)) ||
                (this.tradingPost && simpleCollisionCheck(checkRect, this.tradingPost, 5)) ||
                (this.researchLab && simpleCollisionCheck(checkRect, this.researchLab, 5)) ||
                (this.healingRoom && simpleCollisionCheck(checkRect, this.healingRoom, 5)) ||
                this.trees.some(t => t.active && distanceSqValues(x + width / 2, y + height / 2, t.centerX, t.centerY) < (constants.TILE_SIZE * 1.8) ** 2) ||
                this.fences.some(f => f.active && simpleCollisionCheck(checkRect, f, 2)) ||
                this.towers.some(t => t.active && simpleCollisionCheck(checkRect, t, 2))
            ) && attempts < maxAttempts
         );
         if (attempts >= maxAttempts) { console.warn("無法為樹木找到合適的生成位置。"); return false; }
         const newTree = new Tree(x, y, width, height, constants);
         this.trees.push(newTree);
         return true;
    }


    /**
     * 安排一個未來的樹木重生事件 (此方法與 EntityManager 中的重複，建議整合)。
     */
     scheduleTreeRespawn() {
         // (代碼與 EntityManager.scheduleTreeRespawn 基本相同)
         const constants = this.constants;
         const respawnDelay = constants.TREE_RESPAWN_TIME_MIN + Math.random() * (constants.TREE_RESPAWN_TIME_MAX - constants.TREE_RESPAWN_TIME_MIN);
         const respawnTime = performance.now() + respawnDelay;
         this.treeRespawnQueue.push(respawnTime);
     }

    /**
     * 處理樹木重生隊列 (此方法與 EntityManager 中的重複，建議整合)。
     * @param {number} currentTime
     */
     processTreeRespawns(currentTime) {
         // (代碼與 EntityManager.processTreeRespawns 基本相同)
         const activeTreeCount = this.trees.filter(t => t.active).length;
         if (activeTreeCount >= this.constants.INITIAL_TREES && this.treeRespawnQueue.length === 0) { return; }
         let respawnedCount = 0;
         while (this.treeRespawnQueue.length > 0 && this.treeRespawnQueue[0] <= currentTime) {
             this.treeRespawnQueue.shift();
             if (this.spawnTree(false)) { respawnedCount++; }
         }
     }


    /**
     * 嘗試在指定的世界座標建造一個柵欄 (此方法與 EntityManager 中的重複，建議整合)。
     * @param {number} worldX
     * @param {number} worldY
     */
    buildFence(worldX, worldY) {
         // (代碼與 EntityManager.buildFence 基本相同)
         if (!this.player || !this.constants) return;
         if (this.player.wood < this.constants.FENCE_COST) { this.setMessage(`木材不足 (需 ${this.constants.FENCE_COST})`, 1500); return; }
         const TILE_SIZE = this.constants.TILE_SIZE;
         const gridX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
         const gridY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;
         if (gridX + TILE_SIZE / 2 < this.constants.SAFE_ZONE_WIDTH && gridY + TILE_SIZE / 2 > this.constants.SAFE_ZONE_TOP_Y && gridY + TILE_SIZE / 2 < this.constants.SAFE_ZONE_BOTTOM_Y) { this.setMessage("不能在安全區內建造!", 1500); return; }
         if (this.isOccupied(gridX, gridY)) { this.setMessage("該位置已被佔用!", 1500); return; }
         this.player.wood -= this.constants.FENCE_COST;
         this.fences.push(new Fence(gridX, gridY, TILE_SIZE, TILE_SIZE, this.constants));
         this.setMessage(`建造圍欄! (-${this.constants.FENCE_COST} 木材)`, 1000);
    }

    /**
     * 嘗試在指定的世界座標建造一個防禦塔 (此方法與 EntityManager 中的重複，建議整合)。
     * @param {number} worldX
     * @param {number} worldY
     */
    buildTower(worldX, worldY) {
         // (代碼與 EntityManager.buildTower 基本相同)
         if (!this.player || !this.constants) return;
         if (this.player.wood < this.constants.TOWER_COST) { this.setMessage(`木材不足 (需 ${this.constants.TOWER_COST})`, 1500); return; }
         const TILE_SIZE = this.constants.TILE_SIZE;
         const gridX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
         const gridY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;
         if (gridX + TILE_SIZE / 2 < this.constants.SAFE_ZONE_WIDTH && gridY + TILE_SIZE / 2 > this.constants.SAFE_ZONE_TOP_Y && gridY + TILE_SIZE / 2 < this.constants.SAFE_ZONE_BOTTOM_Y) { this.setMessage("不能在安全區內建造!", 1500); return; }
         if (this.isOccupied(gridX, gridY)) { this.setMessage("該位置已被佔用!", 1500); return; }
         this.player.wood -= this.constants.TOWER_COST;
         this.towers.push(new Tower(gridX, gridY, TILE_SIZE, TILE_SIZE, this.constants));
         this.setMessage(`建造防禦塔! (-${this.constants.TOWER_COST} 木材)`, 1000);
    }

    /**
     * 檢查指定的網格座標是否已被佔用 (此方法與 EntityManager 中的重複，建議整合)。
     * @param {number} gridX
     * @param {number} gridY
     * @returns {boolean}
     */
    isOccupied(gridX, gridY) {
         // (代碼與 EntityManager.isOccupied 基本相同)
         const TILE_SIZE = this.constants.TILE_SIZE;
         const checkRect = { x: gridX, y: gridY, width: TILE_SIZE, height: TILE_SIZE };
         const tolerance = 2;
         if (this.fences.some(f => f.active && f.x === gridX && f.y === gridY) ||
             this.towers.some(t => t.active && t.x === gridX && t.y === gridY)) { return true; }
         if ((this.tradingPost && simpleCollisionCheck(checkRect, this.tradingPost, tolerance)) ||
             (this.weaponShop && simpleCollisionCheck(checkRect, this.weaponShop, tolerance)) || // 改名
             (this.healingRoom && simpleCollisionCheck(checkRect, this.healingRoom, tolerance)) ||
             (this.skillInstitute && simpleCollisionCheck(checkRect, this.skillInstitute, tolerance))) { return true; } // 新增
         if (this.trees.some(tree => tree.active && simpleCollisionCheck(checkRect, tree, TILE_SIZE * 0.5))) { return true; }
         return false;
    }

    // --- 尋找目標方法 ---

    /**
     * 尋找距離指定源最近的活躍敵人。
     * @param {object} source - 尋找目標的源對象 (需要 centerX, centerY 或 x, y, width, height)
     * @param {number} range - 尋找的最大範圍
     * @returns {Enemy|null} 返回最近的敵人對象，如果範圍內沒有則返回 null
     */
     findNearestActiveEnemy(source, range) {
         let nearestEnemy = null; // 初始化最近的敵人為 null
         let minDistanceSq = range * range; // 初始化最小距離平方為範圍的平方
         // 獲取源的中心座標
         const sourceCenterX = source.centerX || (source.x + (source.width || 0) / 2);
         const sourceCenterY = source.centerY || (source.y + (source.height || 0) / 2);
         const constants = this.constants; // 獲取常量

         // 遍歷所有敵人
         this.enemies.forEach(enemy => {
             if (!enemy.active) return; // 跳過無效的敵人

             // 如果源是防禦塔，則忽略安全區內的敵人
             if (source instanceof Tower) {
                 if (enemy.centerX < constants.SAFE_ZONE_WIDTH && enemy.centerY > constants.SAFE_ZONE_TOP_Y && enemy.centerY < constants.SAFE_ZONE_BOTTOM_Y) {
                     return; // 跳過安全區內的敵人
                 }
             }

             // 計算源與敵人中心點距離的平方
             const distSq = distanceSqValues(sourceCenterX, sourceCenterY, enemy.centerX, enemy.centerY);
             // 如果當前敵人更近
             if (distSq < minDistanceSq) {
                 minDistanceSq = distSq; // 更新最小距離平方
                 nearestEnemy = enemy; // 更新最近的敵人
             }
         });
         return nearestEnemy; // 返回找到的最近敵人或 null
     }


    /**
     * 尋找範圍內的多個敵人，按距離排序。
     * @param {object} source - 尋找目標的源對象
     * @param {number} range - 尋找的最大範圍
     * @param {number} maxTargets - 最多尋找的目標數量
     * @returns {Enemy[]} 返回範圍內按距離排序的敵人數組 (最多 maxTargets 個)
     */
     findMultipleEnemiesInRange(source, range, maxTargets) {
         if (maxTargets <= 0) return []; // 如果不需要目標，返回空數組
         const targetsInRange = []; // 存儲範圍內的目標及其距離
         const rangeSq = range * range; // 範圍的平方
         // 獲取源的中心座標
         const sourceCenterX = source.centerX || (source.x + (source.width || 0) / 2);
         const sourceCenterY = source.centerY || (source.y + (source.height || 0) / 2);

         // 遍歷所有敵人
         this.enemies.forEach(enemy => {
             if (!enemy.active) return; // 跳過無效敵人
             // 計算距離平方
             const distSq = distanceSqValues(sourceCenterX, sourceCenterY, enemy.centerX, enemy.centerY);
             // 如果在範圍內
             if (distSq < rangeSq) {
                 targetsInRange.push({ enemy: enemy, distSq: distSq }); // 添加到數組
             }
         });

         // 按距離平方升序排序
         targetsInRange.sort((a, b) => a.distSq - b.distSq);
         // 返回排序後的前 maxTargets 個敵人的對象
         return targetsInRange.slice(0, maxTargets).map(item => item.enemy);
     }

    // --- 添加特效/投射物 ---

    /**
     * 添加一個劈砍特效。
     * @param {object} attacker - 發動攻擊的實體
     * @param {object} target - 受到攻擊的實體
     */
    addSlashEffect(attacker, target) {
        this.effects.push(new SlashEffect(attacker, target, this.constants)); // 添加到通用 effects 數組
    }

    /**
     * 添加一個子彈投射物 (用於防禦塔或 Boss)。
     * @param {object} shooter - 發射者
     * @param {object|null} target - 目標敵人 (如果為 null，則需要 options.direction)
     * @param {object} [options={}] - 子彈的可選屬性 (如傷害、速度、顏色、方向、生命週期等)
     */
    addBullet(shooter, target, options = {}) {
         // 計算起始座標 (發射者中心)
         const startX = shooter.centerX || (shooter.x + (shooter.width || 0) / 2);
         const startY = shooter.centerY || (shooter.y + (shooter.height || 0) / 2);
         // 創建子彈實例並添加到數組
         this.bullets.push(new Bullet(startX, startY, target, shooter, this.constants, options));
     }

    /**
     * 添加一個 Boss 發射的投射物 (通常是非追踪的)。
     * @param {object} shooter - 發射者 (Boss 或 Mini-Boss)
     * @param {number} startX - 起始 X 座標
     * @param {number} startY - 起始 Y 座標
     * @param {number} directionDx - X 方向分量
     * @param {number} directionDy - Y 方向分量
     * @param {number} speed - 速度
     * @param {number} damage - 傷害
     * @param {string} color - 顏色
     */
    addBossProjectile(shooter, startX, startY, directionDx, directionDy, speed, damage, color) {
         // 歸一化方向向量
         const len = Math.sqrt(directionDx * directionDx + directionDy * directionDy);
         const normDx = len > 0 ? directionDx / len : 0;
         const normDy = len > 0 ? directionDy / len : 0;
         // 設置子彈選項
         const options = {
             homing: false, // Boss 子彈通常不追踪
             direction: { dx: normDx, dy: normDy }, // 指定方向
             speed: speed,
             damage: damage,
             color: color,
             lifeTime: 4000 // 子彈存在時間 (毫秒)
         };
         // 創建子彈實例 (目標為 null，因為方向已指定)
         this.bullets.push(new Bullet(startX, startY, null, shooter, this.constants, options));
     }

    /**
     * 添加一個箭矢投射物 (用於玩家弓箭)。
     * @param {object} shooter - 發射者 (玩家)
     * @param {object} target - 目標敵人
     */
    addArrow(shooter, target) {
        // 計算從玩家指向目標的角度
        const dx = target.centerX - shooter.centerX;
        const dy = target.centerY - shooter.centerY;
        const angle = Math.atan2(dy, dx);
        // 計算箭矢起始位置 (在玩家前方一點)
        const startDist = shooter.width / 2 + 5; // 距離玩家中心
        const startX = shooter.centerX + Math.cos(angle) * startDist;
        const startY = shooter.centerY + Math.sin(angle) * startDist;
        // 創建箭矢實例並添加到數組
        this.arrows.push(new Arrow(startX, startY, target, shooter, this.constants));
    }


    // --- 新增：技能觸發方法 ---

    /**
     * 觸發範圍技能 1 (震盪波)。
     * @param {Player} player - 觸發技能的玩家。
     * @param {object} stats - 計算後的技能屬性 { level, damage, cooldown, radius }
     */
    triggerSkillAoe1(player, stats) {
        if (!stats || stats.level <= 0) return; // 未學習或屬性無效
        const radius = stats.radius;
        const damage = stats.damage;
        const radiusSq = radius * radius;
        const effectColor = 'rgba(0, 150, 255, 0.7)'; // 震盪波顏色

        // 創建視覺效果
        this.effects.push(new ShockwaveEffect(player.centerX, player.centerY, radius, 300, effectColor)); // 持續 300ms

        // 對範圍內敵人造成傷害
        let enemiesHit = 0;
        this.enemies.forEach(enemy => {
            if (!enemy.active) return;
            const distSq = distanceSqValues(player.centerX, player.centerY, enemy.centerX, enemy.centerY);
            if (distSq < radiusSq) {
                enemy.takeDamage(damage, this);
                this.addDamageNumber(enemy.centerX, enemy.y, damage, effectColor);
                enemiesHit++;
            }
        });
        // console.log(`技能 1 (震盪波) 觸發，擊中 ${enemiesHit} 個敵人。`);
    }

    /**
     * 觸發範圍技能 2 (新星爆發)。
     * @param {Player} player - 觸發技能的玩家。
     * @param {object} stats - 計算後的技能屬性 { level, damage, cooldown, radius }
     */
    triggerSkillAoe2(player, stats) {
        if (!stats || stats.level <= 0) return;
        const radius = stats.radius;
        const damage = stats.damage;
        const radiusSq = radius * radius;
        const effectColor = 'rgba(255, 100, 0, 0.8)'; // 新星爆發顏色

        // 創建視覺效果
        this.effects.push(new NovaEffect(player.centerX, player.centerY, radius, 500, effectColor)); // 持續 500ms

        // 對範圍內敵人造成傷害
        let enemiesHit = 0;
        this.enemies.forEach(enemy => {
            if (!enemy.active) return;
            const distSq = distanceSqValues(player.centerX, player.centerY, enemy.centerX, enemy.centerY);
            if (distSq < radiusSq) {
                enemy.takeDamage(damage, this);
                this.addDamageNumber(enemy.centerX, enemy.y, damage, effectColor);
                enemiesHit++;
            }
        });
        // console.log(`技能 2 (新星爆發) 觸發，擊中 ${enemiesHit} 個敵人。`);
    }

    /**
     * 觸發直線技能 1 (能量箭)。
     * @param {Player} player - 觸發技能的玩家。
     * @param {object} stats - 計算後的技能屬性 { level, damage, cooldown, range, width }
     */
    triggerSkillLinear1(player, stats) {
        if (!stats || stats.level <= 0) return;
        const constants = this.constants;
        // 尋找最近的敵人作為目標方向，使用計算後的範圍
        const targetEnemy = this.findNearestActiveEnemy(player, stats.range * 1.2);
        let direction = null;

        if (targetEnemy) {
            // 計算指向目標的方向
            const dx = targetEnemy.centerX - player.centerX;
            const dy = targetEnemy.centerY - player.centerY;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                direction = { dx: dx / len, dy: dy / len };
            }
        } else {
            // 如果沒有敵人，則朝玩家面朝方向發射
            direction = { dx: player.facingRight ? 1 : -1, dy: 0 };
        }

        if (direction) {
            // 創建能量箭投射物
            const bolt = new EnergyBolt(
                player.centerX,
                player.centerY,
                direction,
                player,
                constants,
                { // 傳遞計算後的屬性給投射物
                    damage: stats.damage,
                    range: stats.range,
                    width: stats.width,
                    // speed: stats.speed // 如果速度也升級
                }
            );
            this.bullets.push(bolt); // 添加到子彈數組進行管理
            // console.log("技能 3 (能量箭) 觸發。");
        }
    }

    /**
     * 觸發直線技能 2 (能量光束)。
     * @param {Player} player - 觸發技能的玩家。
     * @param {object} stats - 計算後的技能屬性 { level, damage, cooldown, range, width }
     */
    triggerSkillLinear2(player, stats) {
        if (!stats || stats.level <= 0) return;
        const constants = this.constants;
        // 尋找最近的敵人作為目標方向，使用計算後的範圍
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
                { // 傳遞計算後的屬性給投射物
                    damage: stats.damage,
                    range: stats.range,
                    width: stats.width,
                    // speed: stats.speed
                }
            );
            this.bullets.push(beam);
            // console.log("技能 4 (能量光束) 觸發。");
        }
    }

} // 結束 Game 類
