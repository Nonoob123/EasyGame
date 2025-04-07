'use strict';

// --- 遊戲實體基類 ---
// 所有遊戲內對象（如玩家、敵人、建築物等）的基礎類別
export class Entity {
    /**
     * 創建一個實體實例。
     * @param {number} x - 初始 X 座標
     * @param {number} y - 初始 Y 座標
     * @param {number} width - 寬度
     * @param {number} height - 高度
     * @param {string} [color='gray'] - 實體的顏色（用於繪製）
     */
    constructor(x, y, width, height, color = 'gray') {
        this.x = x; // 左上角 X 座標
        this.y = y; // 左上角 Y 座標
        this.width = width; // 寬度
        this.height = height; // 高度
        this.color = color; // 顏色
        this.active = true; // 實體是否活動/有效
    }

    // --- Getter 屬性 ---
    // 計算並返回實體的中心 X 座標
    get centerX() { return this.x + this.width / 2; }
    // 計算並返回實體的中心 Y 座標
    get centerY() { return this.y + this.height / 2; }

    /**
     * 在畫布上繪製實體（默認為繪製一個純色矩形）。
     * 子類可以覆蓋此方法以實現自定義繪製。
     * @param {CanvasRenderingContext2D} ctx - 畫布的 2D 渲染上下文
     */
    draw(ctx) {
        if (!this.active) return; // 如果實體無效，則不繪製
        ctx.fillStyle = this.color; // 設置填充顏色
        ctx.fillRect(this.x, this.y, this.width, this.height); // 繪製矩形
    }

    /**
     * 更新實體狀態。
     * 子類應覆蓋此方法以實現其特定的更新邏輯。
     * @param {number} deltaTime - 距離上一幀的時間差（毫秒）
     * @param {object} game - 遊戲主對象（可選，用於訪問遊戲狀態）
     */
    update(deltaTime, game) {
        // 基類目前沒有更新邏輯，留給子類實現
    }

    /**
     * 檢查實體的矩形邊界是否在攝像機視圖內。
     * 用於性能優化，只繪製可見的實體。
     * @param {object} camera - 攝像機對象 (需要 x, y 屬性)
     * @param {number} canvasWidth - 畫布寬度
     * @param {number} visibleWorldWidth - 攝像機可見的世界寬度 (考慮縮放後)
     * @param {number} visibleWorldHeight - 攝像機可見的世界高度 (考慮縮放後)
     * @param {number} [leeway=0] - 視圖範圍的額外緩衝區（像素），用於提前加載或延遲卸載
     * @returns {boolean} 如果實體在視圖內（或部分在內），則返回 true
     */
    isRectInView(camera, visibleWorldWidth, visibleWorldHeight, leeway = 0) {
        // 確保 camera 對象存在
        if (!camera) {
            // 如果沒有攝像機，可以假設總是在視圖內，或根據遊戲設計決定
            // console.warn("isRectInView: camera object is missing.");
            return true; // 暫定為總是在視圖內
        }

        // 基礎的 AABB (Axis-Aligned Bounding Box) 碰撞檢測邏輯
        // 檢查實體矩形是否與攝像機視圖矩形（加上緩衝區）有重疊
        const inView =
            this.x + this.width > camera.x - leeway && // 實體右邊界 > 視圖左邊界
            this.x < camera.x + visibleWorldWidth + leeway && // 實體左邊界 < 視圖右邊界 (使用 visibleWorldWidth)
            this.y + this.height > camera.y - leeway && // 實體下邊界 > 視圖上邊界
            this.y < camera.y + visibleWorldHeight + leeway;  // 實體上邊界 < 視圖下邊界 (使用 visibleWorldHeight)

        return inView;
    }
}
