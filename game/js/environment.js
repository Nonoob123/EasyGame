'use strict';

// 導入基礎實體類
import { Entity } from './entity.js';

// --- 樹木類 ---
// 代表遊戲世界中的樹木，玩家可以砍伐以獲取資源
export class Tree extends Entity {
    /**
     * 創建一個樹木實例。
     * @param {number} x - 初始 X 座標
     * @param {number} y - 初始 Y 座標
     * @param {number} width - 寬度
     * @param {number} height - 高度
     * @param {object} gameConstants - 遊戲常量對象
     */
    constructor(x, y, width, height, gameConstants) {
        // 調用父類構造函數，顏色在這裡不太重要，因為會優先使用圖片
        super(x, y, width, height);
        this.constants = gameConstants; // 保存常量引用
        this.image = new Image(); // 創建圖像對象
        this.imageLoaded = false; // 圖像是否加載完成標誌
        // 嘗試加載常量中定義的樹木圖片 URL
        this.loadImage(this.constants.TREE_IMAGE_URL);
    }

    /**
     * 加載樹木圖像。
     * @param {string} src - 圖像的 URL
     */
    loadImage(src) {
        if (!src) {
            // 如果沒有提供 src，則警告並標記為已加載（以便使用顏色回退）
            console.warn("未提供樹木圖片 URL。");
            this.imageLoaded = true;
            return;
        }
        // 設置加載成功的回調
        this.image.onload = () => { this.imageLoaded = true; };
        // 設置加載失敗的回調
        this.image.onerror = () => {
            console.error(`載入樹木圖片錯誤: ${src}`);
            this.imageLoaded = true; // 加載失敗也標記為已加載，使用顏色回退
        };
        this.image.src = src; // 開始加載圖像
    }

    /**
     * 在畫布上繪製樹木。
     * 優先繪製圖像，如果圖像加載失敗或未完成，則繪製備用的形狀。
     * @param {CanvasRenderingContext2D} ctx - 畫布的 2D 渲染上下文
     */
    draw(ctx) {
        if (!this.active) return; // 如果樹木無效（例如已被砍伐），則不繪製

        // 檢查圖像是否已成功加載且可用
        if (this.imageLoaded && this.image.complete && this.image.naturalWidth > 0) {
            // 繪製圖像
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // --- 備用繪製邏輯 (如果圖像加載失敗) ---
            // 繪製樹幹 (棕色矩形)
            ctx.fillStyle = '#8B4513'; // SaddleBrown
            ctx.fillRect(
                this.x + this.width * 0.3, // 樹幹 X 座標 (稍微居中)
                this.y + this.height * 0.4, // 樹幹 Y 座標 (從下方開始)
                this.width * 0.4,          // 樹幹寬度
                this.height * 0.6          // 樹幹高度
            );
            // 繪製樹冠 (綠色圓形)
            ctx.fillStyle = '#228B22'; // ForestGreen
            ctx.beginPath();
            ctx.arc(
                this.centerX,              // 圓心 X (實體中心)
                this.y + this.height * 0.3, // 圓心 Y (稍微靠上)
                this.width / 2,            // 半徑 (寬度的一半)
                0,                         // 起始角度
                Math.PI * 2                // 結束角度 (完整圓)
            );
            ctx.fill(); // 填充圓形
        }
    }

    // 樹木通常沒有複雜的 update 邏輯，除非有特殊效果（例如生長動畫）
    // update(deltaTime, game) {
    //     super.update(deltaTime, game); // 可以調用父類的 update (如果有的話)
    // }
}
