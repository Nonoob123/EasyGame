'use strict';

import { Entity } from './entity.js'; // 導入基礎實體類

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
