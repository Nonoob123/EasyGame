'use strict';

import { Entity } from './entity.js'; // 導入基礎實體類

// 代表遊戲勝利目標的角色
export class GoalCharacter extends Entity {
    /**
     * 創建一個目標角色實例。
     * @param {number} x - X 座標。
     * @param {number} y - Y 座標。
     * @param {number} size - 角色的尺寸 (寬度和高度)。
     * @param {object} constants - 遊戲常量。
     */
    constructor(x, y, size, constants) {
        // 目標角色通常是靜態且不可摧毀的
        super(x, y, size, size, constants, Infinity); // 使用無限生命值
        this.icon = '🏆'; // 用於 UI 顯示的圖標
        this.color = 'gold'; // 繪製時的顏色 (如果不用圖像)
        this.active = true; // 初始時是活躍的
        this.interacted = false; // 標記是否已被玩家互動 (保留用於可能的其他互動)
        this.isCarried = false; // 新增：標記是否被玩家攜帶
    }

    /**
     * 繪製目標角色。
     * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
     */
    draw(ctx) {
        // 如果不活躍或被攜帶，則不在原地繪製
        if (!this.active || this.isCarried) return;

        ctx.save();
        // 可以選擇繪製圖標或簡單形狀
        ctx.font = `${this.width * 0.8}px sans-serif`; // 根據大小調整字體
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 添加陰影
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 4;

        // 如果已被互動，可以改變外觀 (例如變暗或半透明)
        if (this.interacted) {
            ctx.globalAlpha = 0.5;
        }

        ctx.fillText(this.icon, this.centerX, this.centerY);

        // (可選) 繪製一個底座或邊框
        // ctx.fillStyle = this.color;
        // ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.restore();
    }

    /**
     * 更新目標角色狀態。如果被攜帶，則跟隨玩家。
     * @param {number} deltaTime - 時間增量。
     * @param {Game} game - 遊戲主對象。
     */
    update(deltaTime, game) {
        if (this.isCarried && game.player) {
            // 跟隨玩家中心點
            this.x = game.player.centerX - this.width / 2;
            this.y = game.player.centerY - this.height / 2;
        }
        // 如果需要其他更新邏輯，可以在這裡添加
    }

    /**
     * 標記為已被玩家拾取。
     */
    pickUp() {
        if (!this.isCarried) {
            this.isCarried = true;
            this.active = false; // 在地圖上不再顯示為獨立實體
            this.interacted = true; // 標記為已互動
            console.log("Trophy picked up!");
        }
    }

    /**
     * 標記為已被放下（例如，如果玩家死亡或主動放下）。
     * @param {number} dropX - 放下的 X 座標。
     * @param {number} dropY - 放下的 Y 座標。
     */
    drop(dropX, dropY) {
        if (this.isCarried) {
            this.isCarried = false;
            this.active = true; // 重新在地圖上顯示
            this.x = dropX;
            this.y = dropY;
            console.log("Trophy dropped at:", dropX, dropY);
        }
    }
}
