'use strict';
import { simpleCollisionCheck } from './utils.js';

// --- 輸入處理器類 ---
// 負責監聽和處理用戶的鍵盤和滑鼠輸入事件
export class InputHandler {
    /**
     * 創建一個輸入處理器實例。
     * @param {object} game - 對主遊戲對象的引用
     */
    constructor(game) {
        this.game = game; // 保存對遊戲實例的引用
        this.keysPressed = {}; // 用於跟踪當前按下的鍵

        // 綁定事件處理函數的 this 指向，確保它們在被調用時指向 InputHandler 實例
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleKeyUp = this._handleKeyUp.bind(this);
        this._handleClick = this._handleClick.bind(this);
        this._handleContextMenu = this._handleContextMenu.bind(this);
    }

    /**
     * 附加所有必要的事件監聽器到文檔或 Canvas。
     */
    attachListeners() {
        console.log("正在附加輸入監聽器...");
        // 監聽鍵盤按下事件
        document.addEventListener('keydown', this._handleKeyDown);
        // 監聽鍵盤釋放事件
        document.addEventListener('keyup', this._handleKeyUp);
        // 監聽 Canvas 上的點擊事件 (左鍵)
        this.game.canvas.addEventListener('click', this._handleClick);
        // 監聽 Canvas 上的右鍵菜單事件 (通常是右鍵點擊)
        this.game.canvas.addEventListener('contextmenu', this._handleContextMenu);
        console.log("輸入監聽器已附加。");
    }

    /**
     * 移除所有附加的事件監聽器。
     * 在遊戲結束或清理時調用。
     */
    detachListeners() {
        console.log("正在分離輸入監聽器...");
        // 移除鍵盤監聽器
        document.removeEventListener('keydown', this._handleKeyDown);
        document.removeEventListener('keyup', this._handleKeyUp);
        // 檢查 Canvas 是否存在，然後移除滑鼠監聽器
         if (this.game.canvas) {
            this.game.canvas.removeEventListener('click', this._handleClick);
            this.game.canvas.removeEventListener('contextmenu', this._handleContextMenu);
        }
        console.log("輸入監聽器已分離。");
    }

    /**
     * 處理鍵盤按下事件。
     * @param {KeyboardEvent} event - 鍵盤事件對象
     */
    _handleKeyDown(event) {
       // 如果遊戲未運行，只允許 F5 (刷新) 和 F12 (開發者工具)
       if (!this.game.gameRunning && !['F5', 'F12'].includes(event.key)) return;

       const key = event.key.toLowerCase(); // 將按鍵轉換為小寫
       this.keysPressed[key] = true; // 標記該鍵被按下
       if(this.game.keysPressed) this.game.keysPressed[key] = true;

       // --- 特定按鍵的動作 ---
       // 空格鍵：觸發衝刺
       if (event.code === 'Space' && this.game.player) {
            event.preventDefault(); // 阻止空格鍵的默認滾動行為
            // 獲取當前移動輸入方向，傳遞給 startDash
            let inputDx = 0, inputDy = 0;
            if (this.keysPressed['arrowup'] || this.keysPressed['w']) inputDy -= 1;
            if (this.keysPressed['arrowdown'] || this.keysPressed['s']) inputDy += 1;
            if (this.keysPressed['arrowleft'] || this.keysPressed['a']) inputDx -= 1;
            if (this.keysPressed['arrowright'] || this.keysPressed['d']) inputDx += 1;
            // 調用玩家的衝刺方法
            this.game.player.startDash(inputDx, inputDy);
        }
        // E 鍵：砍樹/交互 (如果需要分開，可以改鍵位)
        else if (key === 'e' && this.game.player) {
             event.preventDefault();
             this.game.player.collectTree(this.game); // 嘗試砍樹
             // 未來可以加入其他交互，例如開門、拾取等
        }
        // **** 處理技能升級按鍵 ****
        else if (['1', '2', '3', '4'].includes(key) && this.game.player && this.game.skillInstitute) {
            // 檢查是否在研究所範圍內
            const player = this.game.player;
            const institute = this.game.skillInstitute;
            if (simpleCollisionCheck(player, institute)) {
                event.preventDefault(); // 阻止數字鍵的默認行為 (例如輸入到地址欄)
                const skillIndex = parseInt(key); // 將按鍵 '1'...'4' 轉換為數字 1...4
                player.attemptSkillUpgrade(skillIndex, this.game); // 調用玩家的嘗試升級方法
            }
       }

        // 阻止方向鍵和 WASD 的默認滾動行為 (當遊戲運行時)
        if (this.game.gameRunning && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(key)) { // 加入空格鍵
            event.preventDefault();
        }
    }

    /**
     * 處理鍵盤釋放事件。
     * @param {KeyboardEvent} event - 鍵盤事件對象
     */
    _handleKeyUp(event) {
        const key = event.key.toLowerCase(); // 將按鍵轉換為小寫
        this.keysPressed[key] = false; // 標記該鍵已釋放
        if(this.game.keysPressed) this.game.keysPressed[key] = false;
    }

    /**
     * 將屏幕點擊座標轉換為世界座標，並調用指定的建造函數。
     * @param {MouseEvent} event - 滑鼠事件對象
     * @param {Function} buildFunction - 要在 game 對象上調用的建造函數 (例如 game.buildFence)
     */
    _convertAndBuild(event, buildFunction) {
        // 基本檢查
        if (!this.game.gameRunning || !this.game.player || !this.game.canvas) return;

         event.preventDefault(); // 阻止可能的默認行為 (例如右鍵菜單)

         // --- 座標轉換 ---
         const rect = this.game.canvas.getBoundingClientRect(); // 獲取 Canvas 在屏幕上的位置和尺寸
         // 計算 Canvas 內容相對於其顯示尺寸的縮放比例 (處理 CSS 縮放)
         const scaleX = this.game.canvas.width / rect.width;
         const scaleY = this.game.canvas.height / rect.height;
         // 計算點擊位置相對於 Canvas 左上角的座標
         const canvasX = (event.clientX - rect.left) * scaleX;
         const canvasY = (event.clientY - rect.top) * scaleY;
         // 將 Canvas 座標轉換為考慮到攝像機位移和縮放的世界座標
         const worldX = (canvasX / this.game.constants.CAMERA_ZOOM) + this.game.camera.x;
         const worldY = (canvasY / this.game.constants.CAMERA_ZOOM) + this.game.camera.y;

         // 在 game 對象上調用傳入的建造函數，並傳遞世界座標
         buildFunction.call(this.game, worldX, worldY);
    }

    /**
     * 處理 Canvas 上的點擊事件 (通常是左鍵)。
     * 調用 _convertAndBuild 來嘗試建造柵欄。
     * @param {MouseEvent} event - 滑鼠事件對象
     */
    _handleClick(event) {
        // 傳遞建造柵欄的函數 (this.game.buildFence)
        this._convertAndBuild(event, this.game.buildFence);
    }

    /**
     * 處理 Canvas 上的右鍵菜單事件 (通常是右鍵點擊)。
     * 調用 _convertAndBuild 來嘗試建造防禦塔。
     * @param {MouseEvent} event - 滑鼠事件對象
     */
    _handleContextMenu(event) {
        // 傳遞建造防禦塔的函數 (this.game.buildTower)
        this._convertAndBuild(event, this.game.buildTower);
    }
}
