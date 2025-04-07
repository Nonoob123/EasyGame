'use strict';

// import { Entity } from './entity.js'; // Entity 由 Structure 導入，這裡不再需要
import { Structure } from './structureBase.js'; // 從新的基礎文件導入 Structure
import { Shop } from './shop.js'; // 導入商店類，因為 ArmorShop 和 DanceStudio 將繼承它
// 防禦塔需要訪問 game.addBullet, game.findNearestActiveEnemy
// 這些將通過 update 方法傳遞

// --- 移除本地的 Structure 定義 ---


// --- 防具店類 (Armor Shop Class) ---
// 現在繼承自 Shop 以使用統一的繪圖和交互邏輯
export class ArmorShop extends Shop {
    /**
     * 創建一個防具店實例。
     * @param {number} x - X 座標。
     * @param {number} y - Y 座標。
     * @param {number} width - 寬度。
     * @param {number} height - 高度。
     * @param {object} gameConstants - 遊戲常數 (Shop 構造函數不需要，但保留以防萬一)。
     */
    constructor(x, y, width, height, gameConstants) {
        // 調用 Shop 的構造函數，傳入類型 'armor_shop' 和顏色
        super(x, y, width, height, '#8B8B7A', 'armor_shop'); // 顏色: DarkSlateGray
        // this.constants = gameConstants; // Shop 基類不需要直接訪問 constants
        // 移除特定於舊實現的屬性 (maxLevel, interactionRadius, name, description)
        // 這些現在由 Shop 的 draw 和 Player 的互動邏輯處理
    }
    // 移除 getUpgradeCost, getHpIncreaseForLevel, updateDescription, upgradePlayer, draw 方法
    // 這些方法的功能現在由 Shop.draw 和 Player.handleArmorShopInteraction 處理
}

// --- 舞蹈室類 (Dance Studio Class) ---
// 現在繼承自 Shop 以使用統一的繪圖和交互邏輯
export class DanceStudio extends Shop {
    /**
     * 創建一個舞蹈室實例。
     * @param {number} x - X 座標。
     * @param {number} y - Y 座標。
     * @param {number} width - 寬度。
     * @param {number} height - 高度。
     * @param {object} gameConstants - 遊戲常數 (Shop 構造函數不需要)。
     */
    constructor(x, y, width, height, gameConstants) {
        // 調用 Shop 的構造函數，傳入類型 'dance_studio' 和顏色
        super(x, y, width, height, '#FFC0CB', 'dance_studio'); // 顏色: Pink
        // this.constants = gameConstants; // Shop 基類不需要
        // 移除特定於舊實現的屬性
    }
    // 移除 getUpgradeCost, getTotalDodgeBonusForLevel, updateDescription, upgradePlayer, draw 方法
    // 這些方法的功能現在由 Shop.draw 和 Player.handleDanceStudioInteraction 處理
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
        
        // 升級塔的邏輯 - 隨時間增強
        if (this.level < 3 && game.elapsedGameTime > 0) {
            // 每5分鐘自動升級一次，最高3級
            const upgradeTime = 300000; // 5分鐘 = 300000毫秒
            const shouldUpgrade = Math.floor(game.elapsedGameTime / upgradeTime) + 1;
            
            if (shouldUpgrade > this.level) {
                this.level = shouldUpgrade;
                this.damage = game.constants.BULLET_DAMAGE * (1 + (this.level - 1) * 0.5); // 每級增加50%傷害
                this.range = game.constants.TOWER_RANGE * (1 + (this.level - 1) * 0.2); // 每級增加20%範圍
                this.fireRate = game.constants.TOWER_FIRE_RATE * (1 - (this.level - 1) * 0.15); // 每級減少15%冷卻
                
                // 添加升級視覺效果
                game.effects.push(new NovaEffect(this.centerX, this.centerY, 40, 500, 'rgba(0, 255, 150, 0.7)'));
            }
        }
        
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
     * 射擊指定的敵人。
     * @param {Enemy} enemy - 目標敵人。
     * @param {Game} game - 遊戲主對象，用於添加子彈。
     */
    shoot(enemy, game) {
        if (!enemy || !enemy.active || !game) return;
        
        // 計算子彈的起始位置 (塔的中心)
        const startX = this.centerX;
        const startY = this.centerY;
        
        // 計算子彈的方向 (指向敵人)
        const dx = enemy.centerX - startX;
        const dy = enemy.centerY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        // 根據塔的等級決定子彈類型
        if (this.level >= 3) {
            // 3級塔發射能量彈
            game.bullets.push(new EnergyBolt(startX, startY, dirX, dirY, this.damage * 1.5, 'tower'));
        } else if (this.level >= 2) {
            // 2級塔發射加強子彈
            game.bullets.push(new Bullet(startX, startY, dirX, dirY, this.damage * 1.2, 'tower', 'rgba(255, 200, 0, 1)'));
        } else {
            // 1級塔發射普通子彈
            game.bullets.push(new Bullet(startX, startY, dirX, dirY, this.damage, 'tower'));
        }
    }
}
