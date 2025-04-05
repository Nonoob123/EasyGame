'use strict';

import { Entity } from './entity.js'; // 導入基礎實體類
// 防禦塔需要訪問 game.addBullet, game.findNearestActiveEnemy
// 這些將通過 update 方法傳遞

// --- 建築基類 (Structure Base Class) ---
// 所有靜態建築物的基礎，如圍欄、塔、商店
export class Structure extends Entity {
    /**
     * 創建一個建築實例。
     * @param {number} x - X 座標。
     * @param {number} y - Y 座標。
     * @param {number} width - 寬度。
     * @param {number} height - 高度。
     * @param {string} color - 顏色。
     * @param {number} [hp=Infinity] - 生命值 (預設為無限，表示不可摧毀)。
     */
    constructor(x, y, width, height, color, hp = Infinity) {
        super(x, y, width, height, color); // 調用父類構造函數
        this.hp = hp; // 當前生命值
        this.maxHp = hp; // 最大生命值
    }

    /**
     * 使建築受到傷害。
     * @param {number} damage - 受到的傷害量。
     */
    takeDamage(damage) {
        // 如果建築不活躍或是無限生命值，則不受傷害
        if (!this.active || this.hp === Infinity) return;
        this.hp -= damage; // 扣除生命值
        if (this.hp <= 0) {
            this.active = false; // 生命值歸零，設為不活躍
            // 可選: 如果需要，可以通過 game 對象在此處播放摧毀效果或聲音
        }
    }

     // 如果需要自定義繪製，可以覆蓋 draw 方法，但基礎 Entity 的 draw 可能已足夠
     // draw(ctx) { super.draw(ctx); }
}

// --- 圍欄類 (Fence Class) ---
// 可被摧毀的防禦性建築
export class Fence extends Structure {
    /**
     * 創建一個圍欄實例。
     * @param {number} x - X 座標。
     * @param {number} y - Y 座標。
     * @param {number} width - 寬度。
     * @param {number} height - 高度。
     * @param {object} gameConstants - 遊戲常數，用於獲取圍欄 HP。
     */
    constructor(x, y, width, height, gameConstants) {
         // 從常數中傳遞 HP (如果已定義)，否則使用預設值
        super(x, y, width, height, '#CD853F', gameConstants?.FENCE_HP || 50); // 顏色: Peru，HP 來自常數或預設 50
        this.constants = gameConstants; // 儲存常數以備後用
    }

    /**
     * 在畫布上繪製圍欄。
     * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
     */
    draw(ctx) {
        if (!this.active) return; // 不繪製不活躍的圍欄
        // --- 基礎顏色 ---
        ctx.fillStyle = this.color; // Peru (棕色)
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // --- 木紋/細節 ---
        ctx.strokeStyle = '#8B4513'; // 深棕色線條 (SaddleBrown)
        ctx.lineWidth = 1;
        ctx.beginPath();
        // 繪製水平木板線
        ctx.moveTo(this.x + 2, this.y + this.height * 0.3); ctx.lineTo(this.x + this.width - 2, this.y + this.height * 0.3);
        ctx.moveTo(this.x + 2, this.y + this.height * 0.7); ctx.lineTo(this.x + this.width - 2, this.y + this.height * 0.7);
        // 可選: 繪製垂直線
        // ctx.moveTo(this.x + this.width * 0.5, this.y + 2); ctx.lineTo(this.x + this.width * 0.5, this.y + this.height - 2);
        ctx.stroke();

        // --- 邊框 ---
        ctx.strokeStyle = '#654321'; // 更深的棕色邊框 (DarkBrown)
        ctx.lineWidth = 2;
        // 在內部稍微縮小一點繪製邊框，使其看起來更立體
        ctx.strokeRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);
    }
}

// --- 防禦塔類 (Tower Class) ---
// 自動攻擊範圍內敵人的建築
export class Tower extends Structure {
    /**
     * 創建一個防禦塔實例。
     * @param {number} x - X 座標。
     * @param {number} y - Y 座標。
     * @param {number} width - 寬度。
     * @param {number} height - 高度。
     * @param {object} gameConstants - 遊戲常數，用於獲取塔的屬性 (HP, 範圍, 射速等)。
     */
    constructor(x, y, width, height, gameConstants) {
        // 顏色: DarkGray，HP 來自常數或預設 100
        super(x, y, width, height, '#A9A9A9', gameConstants?.TOWER_HP || 100);
        this.constants = gameConstants; // 儲存常數
        this.range = this.constants.TOWER_RANGE; // 攻擊範圍
        this.fireRate = this.constants.TOWER_FIRE_RATE; // 射擊速率 (毫秒/發)
        // 隨機化初始冷卻時間，避免所有塔同時開火
        this.fireCooldown = Math.random() * this.fireRate;
        // 塔目前使用標準子彈傷害
        this.damage = this.constants.BULLET_DAMAGE;
    }

    /**
     * 更新塔的狀態 (尋找目標並射擊)。
     * @param {number} deltaTime - 時間增量 (毫秒)。
     * @param {Game} game - 遊戲主對象，用於尋找目標和添加子彈。
     */
    update(deltaTime, game) {
        if (!this.active || !game) return; // 如果塔不活躍或缺少遊戲對象，則不更新

        this.fireCooldown -= deltaTime; // 減少冷卻時間
        // 如果冷卻時間結束
        if (this.fireCooldown <= 0) {
            // 使用 game 的方法尋找範圍內最近的活躍敵人
            let targetEnemy = game.findNearestActiveEnemy(this, this.range);
            if (targetEnemy) {
                // 如果找到目標，則射擊
                this.shoot(targetEnemy, game); // 將 game 傳遞給 shoot 方法
                // 重置冷卻時間，並加入少量隨機性
                this.fireCooldown = this.fireRate + (Math.random() * 200 - 100);
            } else {
                 // 如果沒有目標，則縮短下次檢查時間
                 this.fireCooldown = this.fireRate * 0.2; // 更頻繁地檢查是否有目標
            }
             // 確保有最小冷卻時間，避免射速過快
             this.fireCooldown = Math.max(50, this.fireCooldown);
        }
    }

    /**
     * 在畫布上繪製防禦塔。
     * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
     */
    draw(ctx) {
        if (!this.active) return; // 不繪製不活躍的塔
        // --- 繪製塔基 ---
        ctx.fillStyle = this.color; // 深灰色 (DarkGray)
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // --- 繪製頂部圓形/炮管部分 ---
        ctx.fillStyle = '#696969'; // 暗灰色 (DimGray)
        ctx.beginPath();
        // 在塔中心繪製一個圓形
        ctx.arc(this.centerX, this.centerY, this.width / 2.5, 0, Math.PI * 2);
        ctx.fill();

        // --- 繪製邊框 ---
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

         // --- 可選: 繪製攻擊範圍指示器 ---
         // 可以在選中塔時或始終顯示
         // ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // 半透明白色
         // ctx.beginPath(); ctx.arc(this.centerX, this.centerY, this.range, 0, Math.PI * 2); ctx.stroke();
    }

    /**
     * 向目標敵人發射子彈。
     * @param {Enemy} target - 目標敵人。
     * @param {Game} game - 遊戲主對象，用於調用 addBullet 方法。
     */
    shoot(target, game) {
         // 使用 game 的方法創建子彈，指定塔為發射者
         // 傳遞選項，例如塔子彈的顏色
        game.addBullet(this, target, { color: '#FF4500' }); // 塔發射橘紅色 (OrangeRed) 子彈
    }
}
