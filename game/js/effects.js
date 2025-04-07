'use strict';

// 導入工具函數
import { hexToRgb } from './utils.js';

// --- 劈砍特效類 ---
// 用於顯示近戰攻擊（如菜刀）的視覺效果
export class SlashEffect {
    /**
     * 創建一個劈砍特效實例。
     * @param {object} attacker - 發動攻擊的實體 (需要 centerX, centerY, width)
     * @param {object} target - 受到攻擊的實體 (需要 centerX, centerY)
     * @param {object} gameConstants - 遊戲常量對象
     */
    constructor(attacker, target, gameConstants) {
        this.constants = gameConstants; // 保存常量引用

        // 計算攻擊者和目標的中心點
        const attackerCenterX = attacker.centerX;
        const attackerCenterY = attacker.centerY;
        const targetCenterX = target.centerX;
        const targetCenterY = target.centerY;

        // 計算從攻擊者指向目標的角度
        const dx = targetCenterX - attackerCenterX;
        const dy = targetCenterY - attackerCenterY;
        const angle = Math.atan2(dy, dx);

        // 特效參數計算
        const effectLength = this.constants.TILE_SIZE * 1.5; // 特效的長度
        const startDist = attacker.width / 2; // 特效起始點距離攻擊者中心的距離（剛好在攻擊者邊緣外）

        // 計算特效的起始和結束座標
        this.startX = attackerCenterX + Math.cos(angle) * startDist;
        this.startY = attackerCenterY + Math.sin(angle) * startDist;
        this.endX = this.startX + Math.cos(angle) * effectLength;
        this.endY = this.startY + Math.sin(angle) * effectLength;

        // 時間和外觀屬性
        this.startTime = performance.now(); // 特效創建時間
        this.duration = this.constants.SLASH_EFFECT_DURATION; // 特效持續時間 (來自常量)
        this.lineWidth = 4; // 線條寬度
        this.color = 'rgba(255, 255, 0, 0.9)'; // 初始顏色 (黃色，略微透明)
        this.active = true; // 特效是否活動
    }

    /**
     * 更新特效狀態。
     * @param {number} deltaTime - 距離上一幀的時間差（毫秒）
     */
    update(deltaTime) {
        if (!this.active) return; // 如果已失效，則不更新

        // 檢查是否超過持續時間
        if (performance.now() - this.startTime > this.duration) {
            this.active = false; // 標記為失效
        }
    }

    /**
     * 在畫布上繪製特效。
     * @param {CanvasRenderingContext2D} ctx - 畫布的 2D 渲染上下文
     */
    draw(ctx) {
        if (!this.active) return; // 如果已失效，則不繪製

        const elapsed = performance.now() - this.startTime; // 已過時間
        const progress = elapsed / this.duration; // 進度 (0 到 1)

        // 如果進度超出範圍，標記為失效並返回
        if (progress >= 1 || progress < 0) {
            this.active = false;
            return;
        }

        // 計算當前透明度和線寬（逐漸消失和變細）
        const alpha = 0.9 * (1 - progress); // 透明度從 0.9 遞減到 0
        const currentLineWidth = Math.max(1, this.lineWidth * (1 - progress * 0.7)); // 線寬從初始值遞減，最小為 1

        // 動畫：使劈砍效果向外延伸
        const interpFactor = progress; // 使用線性插值 (0 到 1)
        const currentEndX = this.startX + (this.endX - this.startX) * interpFactor; // 當前結束點 X
        const currentEndY = this.startY + (this.endY - this.startY) * interpFactor; // 當前結束點 Y

        // 安全檢查：防止無效數據導致繪製錯誤
        if (isNaN(this.startX) || isNaN(this.startY) || isNaN(currentEndX) || isNaN(currentEndY) || isNaN(alpha) || isNaN(currentLineWidth)) {
            console.error("繪製劈砍特效時數據無效:", this, alpha, currentLineWidth);
            this.active = false; // 出錯時標記為失效
            return;
        }

        // 保存當前繪圖狀態
        ctx.save();
        try {
            // 設置繪圖屬性
            ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`; // 設置顏色和透明度
            ctx.lineWidth = currentLineWidth; // 設置線寬
            ctx.lineCap = 'round'; // 設置線條末端樣式為圓形，使效果更平滑

            // 繪製線條
            ctx.beginPath();
            ctx.moveTo(this.startX, this.startY); // 起點
            ctx.lineTo(currentEndX, currentEndY); // 終點
            ctx.stroke(); // 描邊
        } catch (e) {
            console.error("繪製劈砍特效時出錯:", e, this);
            this.active = false; // 出錯時標記為失效
        } finally {
            // 恢復之前的繪圖狀態
            ctx.restore();
        }
    }
}


// --- 傷害數字類 ---
// 用於顯示實體受到傷害時飄出的數字
export class DamageNumber {
    /**
     * 創建一個傷害數字實例。
     * @param {number} x - 數字出現的初始 X 座標
     * @param {number} y - 數字出現的初始 Y 座標
     * @param {number} amount - 顯示的傷害數值
     * @param {string} [color='#FFFFFF'] - 數字的顏色 (十六進制)
     * @param {object} gameConstants - 遊戲常量對象 (可選，可能用於字體大小等)
     */
    constructor(x, y, amount, color = '#FFFFFF', gameConstants) {
        this.x = x + (Math.random() * 12 - 6); // X 座標添加輕微的隨機抖動
        this.y = y; // Y 座標從實體位置開始
        this.amount = amount; // 傷害數值
        this.color = color; // 數字顏色
        this.constants = gameConstants; // 保存常量引用 (目前未使用)
        this.startTime = performance.now(); // 創建時間
        this.duration = 800; // 持續時間 (毫秒)
        this.ySpeed = -0.06; // 向上移動的速度 (像素/毫秒)
        this.active = true; // 是否活動
        this.initialFontSize = 16; // 基礎字體大小
        this.fontFamily = "'Nunito', sans-serif"; // 使用與 UI 一致的字體
    }

    /**
     * 更新傷害數字的狀態（主要是位置）。
     * @param {number} deltaTime - 距離上一幀的時間差（毫秒）
     */
    update(deltaTime) {
        if (!this.active) return; // 如果已失效，則不更新

        const elapsed = performance.now() - this.startTime; // 已過時間
        // 檢查是否超過持續時間
        if (elapsed > this.duration) {
            this.active = false; // 標記為失效
            return;
        }

        // 向上移動
        this.y += this.ySpeed * deltaTime;
    }

    /**
     * 在畫布上繪製傷害數字。
     * @param {CanvasRenderingContext2D} ctx - 畫布的 2D 渲染上下文
     */
    draw(ctx) {
        if (!this.active) return; // 如果已失效，則不繪製

        const elapsed = performance.now() - this.startTime; // 已過時間
        const progress = elapsed / this.duration; // 進度 (0 到 1)

        // 計算透明度 (在後半段時間逐漸消失)
        let alpha = 1.0;
        if (progress > 0.5) {
            // 從進度 0.5 到 1.0，透明度從 1.0 線性減到 0
            alpha = 1.0 - ((progress - 0.5) * 2);
        }
        alpha = Math.max(0, Math.min(1, alpha)); // 確保 alpha 在 0 到 1 之間

        // 可以選擇讓字體大小隨時間變化，但目前保持固定
        // const fontSize = this.initialFontSize * (1 - progress * 0.2);
        const fontSize = this.initialFontSize;

        // 保存當前繪圖狀態
        ctx.save();

        // 設置字體樣式
        ctx.font = `bold ${Math.round(fontSize)}px ${this.fontFamily}`;

        // --- 處理顏色格式 (十六進制或 RGBA) ---
        let finalColorStyle;
        if (this.color.startsWith('rgba')) {
            // 如果是 RGBA 格式，直接修改 alpha 值
            // 提取 R, G, B 值
            const match = this.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
            if (match) {
                finalColorStyle = `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
            } else {
                // 如果 RGBA 解析失敗，使用預設灰色
                console.warn(`無法解析 RGBA 顏色: ${this.color}`);
                finalColorStyle = `rgba(128, 128, 128, ${alpha})`; // 灰色
            }
        } else {
            // 否則，假定是十六進制，使用 hexToRgb
            try {
                 finalColorStyle = `rgba(${hexToRgb(this.color)}, ${alpha})`;
            } catch (e) {
                 console.warn(`處理顏色時出錯 (${this.color}):`, e);
                 finalColorStyle = `rgba(128, 128, 128, ${alpha})`; // 灰色
            }
        }
        ctx.fillStyle = finalColorStyle;
        ctx.textAlign = 'center'; // 水平居中對齊
        ctx.textBaseline = 'bottom'; // 垂直對齊基線，使數字顯示在 y 座標上方

        // 添加陰影以提高可讀性
        ctx.shadowColor = `rgba(0, 0, 0, ${alpha * 0.7})`; // 黑色陰影，透明度隨數字消失
        ctx.shadowOffsetX = 1; // 陰影水平偏移
        ctx.shadowOffsetY = 1; // 陰影垂直偏移
        ctx.shadowBlur = 2; // 陰影模糊度

        // 繪製傷害數字或文字
        const displayText = typeof this.amount === 'number' ? Math.round(this.amount) : this.amount;
        ctx.fillText(displayText, this.x, this.y);

        // 恢復之前的繪圖狀態（移除陰影、透明度等設置）
        ctx.restore();
    }
}


// --- 新增：震盪波特效類 ---
// 用於顯示範圍技能的視覺效果
export class ShockwaveEffect {
    /**
     * 創建一個震盪波特效實例。
     * @param {number} x - 特效中心的 X 座標
     * @param {number} y - 特效中心的 Y 座標
     * @param {number} radius - 特效的最大半徑
     * @param {number} duration - 特效的持續時間 (毫秒)
     * @param {string} [color='rgba(0, 150, 255, 0.7)'] - 特效的顏色
     */
    constructor(x, y, radius, duration, color = 'rgba(0, 150, 255, 0.7)') {
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.duration = duration;
        this.color = color;
        this.startTime = performance.now();
        this.active = true;
        this.lineWidth = 5; // 初始線寬
    }

    update(deltaTime) {
        if (!this.active) return;
        if (performance.now() - this.startTime > this.duration) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        const elapsed = performance.now() - this.startTime;
        const progress = elapsed / this.duration;

        if (progress >= 1 || progress < 0) {
            this.active = false;
            return;
        }

        const currentRadius = this.maxRadius * progress; // 半徑從 0 擴展到 maxRadius
        const alpha = 0.7 * (1 - progress); // 透明度從 0.7 遞減到 0
        const currentLineWidth = Math.max(1, this.lineWidth * (1 - progress)); // 線寬從初始值遞減

        // 解析顏色以應用透明度
        const rgbColor = this.color.match(/\d+/g); // 提取 R, G, B 值
        let strokeColor = `rgba(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]}, ${alpha})`;
        if (!rgbColor || rgbColor.length < 3) {
            strokeColor = `rgba(0, 150, 255, ${alpha})`; // Fallback color
        }


        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = currentLineWidth;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}


// --- 新增：新星爆發特效類 ---
// 類似震盪波，但可能有不同的視覺表現或參數
export class NovaEffect {
    /**
     * 創建一個新星爆發特效實例。
     * @param {number} x - 特效中心的 X 座標
     * @param {number} y - 特效中心的 Y 座標
     * @param {number} radius - 特效的最大半徑
     * @param {number} duration - 特效的持續時間 (毫秒)
     * @param {string} [color='rgba(255, 100, 0, 0.8)'] - 特效的顏色
     */
    constructor(x, y, radius, duration, color = 'rgba(255, 100, 0, 0.8)') {
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.duration = duration;
        this.color = color;
        this.startTime = performance.now();
        this.active = true;
        this.lineWidth = 8; // 初始線寬，比震盪波粗
    }

    update(deltaTime) {
        if (!this.active) return;
        if (performance.now() - this.startTime > this.duration) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        const elapsed = performance.now() - this.startTime;
        const progress = elapsed / this.duration;

        if (progress >= 1 || progress < 0) {
            this.active = false;
            return;
        }

        const currentRadius = this.maxRadius * progress;
        const alpha = 0.8 * (1 - progress); // 透明度從 0.8 遞減
        const currentLineWidth = Math.max(2, this.lineWidth * (1 - progress * 0.5)); // 線寬遞減，最小為 2

        const rgbColor = this.color.match(/\d+/g);
        let strokeColor = `rgba(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]}, ${alpha})`;
         if (!rgbColor || rgbColor.length < 3) {
             strokeColor = `rgba(255, 100, 0, ${alpha})`; // Fallback color
         }

        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = currentLineWidth;
        // 可以添加更多視覺元素，例如多個環或填充
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 可選：添加內環或其他效果
        if (currentRadius > this.maxRadius * 0.5) {
             const innerRadius = currentRadius * 0.6;
             const innerAlpha = alpha * 0.7;
             const innerLineWidth = currentLineWidth * 0.6;
             let innerStrokeColor = `rgba(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]}, ${innerAlpha})`;
             if (!rgbColor || rgbColor.length < 3) {
                 innerStrokeColor = `rgba(255, 100, 0, ${innerAlpha})`; // Fallback color
             }
             ctx.strokeStyle = innerStrokeColor;
             ctx.lineWidth = Math.max(1, innerLineWidth);
             ctx.beginPath();
             ctx.arc(this.x, this.y, innerRadius, 0, Math.PI * 2);
             ctx.stroke();
        }

        ctx.restore();
    }
}
