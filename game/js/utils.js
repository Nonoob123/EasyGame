'use strict';

// --- 輔助函數 (Utility Functions) ---

/**
 * 計算兩個對象中心點之間的距離平方。
 * 比計算實際距離更快，常用於比較距離。
 * @param {object} obj1 - 第一個對象 (需要 x, y, width/height 或 radius 屬性)。
 * @param {object} obj2 - 第二個對象 (需要 x, y, width/height 或 radius 屬性)。
 * @returns {number} 距離的平方，如果任一對象無效則返回 Infinity。
 */
export function distanceSq(obj1, obj2) {
    if (!obj1 || !obj2) return Infinity; // 檢查對象是否存在
    // 計算中心點座標
    const center1X = obj1.x + (obj1.width || (obj1.radius ? obj1.radius : 0)); // 使用寬度或半徑計算中心
    const center1Y = obj1.y + (obj1.height || (obj1.radius ? obj1.radius : 0));
    const center2X = obj2.x + (obj2.width || (obj2.radius ? obj2.radius : 0));
    const center2Y = obj2.y + (obj2.height || (obj2.radius ? obj2.radius : 0));
    // 計算 x 和 y 方向的差值
    const dx = center1X - center2X;
    const dy = center1Y - center2Y;
    // 返回距離的平方
    return dx * dx + dy * dy;
}

/**
 * 計算兩點之間的距離平方。
 * @param {number} x1 - 第一點的 X 座標。
 * @param {number} y1 - 第一點的 Y 座標。
 * @param {number} x2 - 第二點的 X 座標。
 * @param {number} y2 - 第二點的 Y 座標。
 * @returns {number} 距離的平方。
 */
export function distanceSqValues(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

/**
 * 簡單的矩形碰撞檢測 (AABB - Axis-Aligned Bounding Box)。
 * 檢查兩個矩形是否重疊。可以處理基於半徑的圓形對象。
 * @param {object} rect1 - 第一個矩形或圓形對象 (需要 x, y, width/height 或 radius)。
 * @param {object} rect2 - 第二個矩形或圓形對象 (需要 x, y, width/height 或 radius)。
 * @param {number} [tolerance=0] - 碰撞容差，增加檢測範圍。
 * @returns {boolean} 如果發生碰撞則返回 true，否則返回 false。
 */
export function simpleCollisionCheck(rect1, rect2, tolerance = 0) {
    if (!rect1 || !rect2) return false; // 檢查對象是否存在

    // 獲取對象的寬度和高度 (如果沒有 width/height，則嘗試使用 radius)
    const r1w = rect1.width || (rect1.radius ? rect1.radius * 2 : 0);
    const r1h = rect1.height || (rect1.radius ? rect1.radius * 2 : 0);
    const r2w = rect2.width || (rect2.radius ? rect2.radius * 2 : 0);
    const r2h = rect2.height || (rect2.radius ? rect2.radius * 2 : 0);

    // 如果任何一個對象尺寸無效，則無法碰撞
    if (r1w <= 0 || r1h <= 0 || r2w <= 0 || r2h <= 0) return false;

    // 計算中心點座標
    const r1cx = rect1.x + r1w / 2;
    const r1cy = rect1.y + r1h / 2;
    const r2cx = rect2.x + r2w / 2;
    const r2cy = rect2.y + r2h / 2;

    // 檢查 X 軸和 Y 軸是否重疊 (考慮容差)
    // 中心點距離是否小於兩個半寬度/高度之和
    const overlapX = Math.abs(r1cx - r2cx) * 2 < (r1w + r2w + tolerance * 2);
    const overlapY = Math.abs(r1cy - r2cy) * 2 < (r1h + r2h + tolerance * 2);

    // 必須在兩個軸上都重疊才算碰撞
    return overlapX && overlapY;
}

/**
 * 將十六進制顏色代碼 (#RRGGBB 或 #RGB) 轉換為 RGB 字符串 "r, g, b"。
 * 用於需要 RGB 分量的場合，例如 `rgba()`。
 * @param {string} hex - 十六進制顏色代碼。
 * @returns {string} RGB 字符串 "r, g, b"，如果格式錯誤則返回預設灰色 "128, 128, 128"。
 */
export function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    // 移除開頭的 '#' (如果存在)
    if (hex.startsWith('#')) { hex = hex.slice(1); }

    // 處理 3 位縮寫格式 (#RGB)
    if (hex.length == 3) {
        r = parseInt(hex[0] + hex[0], 16); // 將 R 複製一位並轉換為十進制
        g = parseInt(hex[1] + hex[1], 16); // 將 G 複製一位並轉換為十進制
        b = parseInt(hex[2] + hex[2], 16); // 將 B 複製一位並轉換為十進制
    }
    // 處理 6 位標準格式 (#RRGGBB)
    else if (hex.length == 6) {
        r = parseInt(hex.substring(0, 2), 16); // 提取 RR 並轉換為十進制
        g = parseInt(hex.substring(2, 4), 16); // 提取 GG 並轉換為十進制
        b = parseInt(hex.substring(4, 6), 16); // 提取 BB 並轉換為十進制
    }
    // 如果格式不正確，返回預設灰色
    else {
        console.warn(`Invalid hex color format: ${hex}. Defaulting to gray.`);
        return '128, 128, 128';
    }
    // 返回格式化的 RGB 字符串
    return `${r}, ${g}, ${b}`;
}

/**
 * 在 Canvas 上繪製一個圓角矩形。
 * 主要用於繪製 HUD 中的各種條狀元素。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {number} x - 矩形左上角 X 座標。
 * @param {number} y - 矩形左上角 Y 座標。
 * @param {number} width - 矩形寬度。
 * @param {number} height - 矩形高度。
 * @param {number} radius - 圓角半徑。
 * @param {boolean} [fill=true] - 是否填充矩形 (true) 或僅繪製邊框 (false)。
 * @param {boolean} [clipRight=false] - 是否裁剪右側圓角 (用於繪製進度條)。
 */
export function drawRoundedRect(ctx, x, y, width, height, radius, fill = true, clipRight = false) {
    // 確保寬高有效
    if (width <= 0 || height <= 0) return;
    // 確保半徑不超過寬高的一半
    radius = Math.min(radius, width / 2, height / 2);

    ctx.beginPath(); // 開始繪製路徑
    ctx.moveTo(x + radius, y); // 移動到左上圓角起始點
    // 繪製頂部線段 (如果 clipRight 為 true，則不繪製右上圓角)
    ctx.lineTo(x + width - (clipRight ? 0 : radius), y);
    // 繪製右上圓角 (如果 clipRight 為 false)
    if (!clipRight) {
        ctx.arcTo(x + width, y, x + width, y + radius, radius);
    } else {
        ctx.lineTo(x + width, y); // 如果裁剪，直接畫直線到右上角
    }
    // 繪製右側線段
    ctx.lineTo(x + width, y + height - radius);
    // 繪製右下圓角
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    // 繪製底部線段
    ctx.lineTo(x + radius, y + height);
    // 繪製左下圓角
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    // 繪製左側線段
    ctx.lineTo(x, y + radius);
    // 繪製左上圓角
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath(); // 閉合路徑

    // 根據 fill 參數決定是填充還是描邊
    if (fill) {
        ctx.fill();
    } else {
        ctx.stroke();
    }
}
