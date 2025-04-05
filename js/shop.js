'use strict';

import { Structure } from './structures.js'; // 導入結構基類
// 商店繪圖需要訪問 game.player 和 game.constants

// --- 商店類 (Shop Class) ---
// 代表遊戲中玩家可以互動的特殊建築物
export class Shop extends Structure {
    /**
     * 創建一個商店實例。
     * @param {number} x - X 座標。
     * @param {number} y - Y 座標。
     * @param {number} width - 寬度。
     * @param {number} height - 高度。
     * @param {string} color - 顏色。
     * @param {string} type - 商店類型 ('trading_post', 'research_lab', 'healing_room')。
     */
    constructor(x, y, width, height, color, type) {
        // 商店通常是不可摧毀的，生命值設為無限大
        super(x, y, width, height, color, Infinity);
        this.type = type; // 商店的具體類型
    }

    /**
     * 在畫布上繪製商店及其相關信息。
     * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
     * @param {Game} game - 遊戲主對象，用於獲取玩家狀態和常數。
     */
    draw(ctx, game) {
        // 如果商店不活躍或缺少必要的遊戲對象，則不繪製
        if (!this.active || !game || !game.constants || !game.player) return;
        const constants = game.constants; // 獲取遊戲常數
        const player = game.player; // 獲取玩家對象

        // --- 繪製基礎結構 ---
        super.draw(ctx); // 調用父類的繪製方法 (繪製彩色矩形)
        // 添加邊框
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; // 半透明黑色邊框
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // --- 繪製文字信息 ---
        ctx.save(); // 保存當前繪圖狀態
        // 添加文字陰影以提高可讀性
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.shadowBlur = 2;
        ctx.fillStyle = 'white'; // 文字顏色
        ctx.textAlign = 'center'; // 文字居中對齊

        let titleText = ""; // 商店標題
        let subtitleText = ""; // 副標題或提示
        let costText = ""; // 費用或狀態文本
        let costColor = '#FFD700'; // 預設費用顏色 (金色)

        // 計算文字繪製的 Y 座標
        const titleY = this.y + 18;
        const subtitleY = this.y + 34;
        const costY = this.y + 50;

        // 根據商店類型決定顯示的文字內容和顏色
        switch (this.type) {
            case 'trading_post': // 交易站
                titleText = "交易站";
                subtitleText = "(💎 ➔ G)"; // 提示鑽石換金幣
                costText = `1💎 = ${constants.diamond_VALUE}G`; // 顯示匯率
                break;

            case 'weapon_shop': // 武器店 (原研究室)
                titleText = "武器店"; // 改名
                subtitleText = "(靠近升級武器)"; // 提示靠近進行升級
                // 檢查武器升級冷卻時間
                if (player.weaponUpgradeCooldown > 0) {
                    costText = `冷卻: ${(player.weaponUpgradeCooldown / 1000).toFixed(1)}s`; // 顯示剩餘冷卻時間
                    costColor = '#FFAAAA'; // 冷卻時使用淺紅色
                }
                // 檢查切肉刀是否可升級
                else if (player.cleaverLevel < constants.CLEAVER_MAX_LEVEL) {
                    const cost = constants.CLEAVER_COSTS[player.cleaverLevel]; // 獲取下一級費用
                    costText = `🔪 Lv${player.cleaverLevel + 1}: ${cost}G`; // 顯示升級信息和費用
                    if (player.gold < cost) costColor = '#FF6666'; // 如果金幣不足，顯示紅色
                }
                // 檢查弓是否已解鎖
                else if (!player.bowUnlocked) {
                    costText = "解鎖 🏹!"; // 提示解鎖弓
                }
                // 檢查弓是否可升級
                else if (player.bowLevel < constants.BOW_MAX_LEVEL) {
                    const cost = constants.BOW_COSTS[player.bowLevel]; // 獲取下一級費用
                    costText = `🏹 Lv${player.bowLevel + 1}: ${cost}G`; // 顯示升級信息和費用
                     if (player.gold < cost) costColor = '#FF6666'; // 如果金幣不足，顯示紅色
                }
                // 檢查槍是否已解鎖
                else if (!player.gunUnlocked) {
                     costText = "解鎖 🔫!"; // 提示解鎖槍
                }
                // 檢查槍是否可升級
                else if (player.gunLevel < constants.GUN_MAX_LEVEL) {
                    const cost = constants.GUN_COSTS[player.gunLevel]; // 獲取下一級費用
                    costText = `🔫 Lv${player.gunLevel + 1}: ${cost}G`; // 顯示升級信息和費用
                    if (player.gold < cost) costColor = '#FF6666'; // 如果金幣不足，顯示紅色
                }
                // 所有武器已滿級
                else {
                    costText = "武器已滿級";
                    costColor = '#AAFFAA'; // 滿級時顯示綠色
                }
                break;

            case 'healing_room': // 治療室
                titleText = "治療室";
                subtitleText = "(靠近治療)"; // 提示靠近進行治療
                const costPerHp = constants.HEALING_COST_PER_HP; // 每點 HP 的治療費用
                const healAmount = 10; // 每次互動治療的量
                const interactionCost = healAmount * costPerHp; // 每次互動的總費用
                costText = `${healAmount}HP=${interactionCost}G`; // 顯示標準治療的費用
                // 檢查玩家生命值是否已滿
                if (player.hp >= player.maxHp) {
                     costText = "生命值已滿"; costColor = '#AAFFAA'; // 生命值滿時顯示綠色
                }
                // 檢查治療冷卻時間
                else if (player.healingCooldown > 0) {
                     costText = `冷卻: ${(player.healingCooldown / 1000).toFixed(1)}s`; costColor = '#FFAAAA'; // 冷卻時顯示淺紅色
                }
                // 檢查玩家金幣是否足夠支付治療費用
                else if (player.gold < interactionCost) {
                 costText = `需 ${interactionCost}G`; costColor = '#FF6666'; // 金幣不足時顯示紅色，但仍顯示費用
                }
                break;

            case 'skill_institute': // 技能研究所 (新增)
                titleText = "研究所";
                subtitleText = "(學習/升級自動技能)"; // 簡化副標題
                if (player.skillPoints > 0) { // 只根據是否有技能點顯示狀態
                    costText = `可用點數: ${player.skillPoints}🧬`;
                    costColor = '#AAFFAA'; // 綠色表示可用
                } else {
                    costText = "無可用技能點";
                    costColor = '#FFAAAA'; // 紅色表示無點數
                }
                break; // <--- 確保這裡有 break
        }

        // --- 繪製文字 ---
        // 繪製標題
        ctx.font = "bold 14px 'Nunito', sans-serif"; // 標題字體
        ctx.fillStyle = 'white'; // 標題顏色
        ctx.fillText(titleText, this.centerX, titleY); // 在中心位置繪製標題

        // 繪製副標題
        ctx.font = "11px 'Nunito', sans-serif"; // 副標題字體
        ctx.fillStyle = 'white'; // 副標題顏色
        ctx.fillText(subtitleText, this.centerX, subtitleY); // 在中心位置繪製副標題

        // 繪製費用/狀態文本
        ctx.font = "bold 12px 'Nunito', sans-serif"; // 費用字體
        ctx.fillStyle = costColor; // 使用動態計算的顏色
        ctx.fillText(costText, this.centerX, costY); // 在中心位置繪製費用文本

        ctx.restore(); // 恢復之前保存的繪圖狀態
    }
}
