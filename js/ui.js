'use strict';
// 導入繪製圓角矩形、碰撞檢測和距離計算工具函數
import { drawRoundedRect, simpleCollisionCheck, distanceSq } from './utils.js';

// --- 儲存勝利/結束畫面按鈕的位置 ---
// 這些變數需要在 InputHandler 中訪問以進行點擊檢測
export let winScreenButtons = {
    continue: null, // { x, y, width, height }
    end: null
};
export let endScreenButton = null; // { x, y, width, height } for "Restart" (or similar)

// --- 新增：世界背景和安全區繪圖函數 ---

/**
 * 繪製世界背景（主要是安全區的可視化）。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象。
 */
function drawWorldBackground(ctx, game) {
    ctx.save(); // 保存狀態
    // 繪製安全區背景 (半透明綠色)
    ctx.fillStyle = 'rgba(160, 210, 160, 0.3)';
    const szTop = game.constants.SAFE_ZONE_TOP_Y;
    const szBottom = game.constants.SAFE_ZONE_BOTTOM_Y;
    const szWidth = game.constants.SAFE_ZONE_WIDTH;
    ctx.fillRect(0, szTop, szWidth, szBottom - szTop); // 填充矩形
    // 繪製安全區邊框 (半透明白色虛線)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]); // 設置虛線樣式
    ctx.strokeRect(0, szTop, szWidth, szBottom - szTop); // 描邊矩形
    ctx.setLineDash([]); // 清除虛線樣式
    ctx.restore(); // 恢復狀態
}

/**
 * 在安全區中間繪製 "安全區" 文字。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象。
 */
 function drawSafeZoneText(ctx, game) {
     ctx.save(); // 保存狀態
     // 設置字體樣式
     ctx.font = "bold 24px 'Nunito', sans-serif";
     ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'; // 半透明白色
     ctx.textAlign = 'center'; // 水平居中
     ctx.textBaseline = 'middle'; // 垂直居中
     // 計算文字位置 (安全區通道的中心)
     const shopAreaEndX = game.constants.TILE_SIZE * 4;
     const textX = shopAreaEndX + (game.constants.SAFE_ZONE_WIDTH - shopAreaEndX) / 2;
     const textY = (game.constants.SAFE_ZONE_TOP_Y + game.constants.SAFE_ZONE_BOTTOM_Y) / 2;
     // 添加陰影以提高可讀性
     ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
     ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.shadowBlur = 2;
     // 繪製文字
     ctx.fillText("安全區", textX, textY);
     ctx.restore(); // 恢復狀態
 }

/**
 * 導出函數：繪製世界相關元素（背景、安全區）。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象。
 */
export function drawWorld(ctx, game) {
    drawWorldBackground(ctx, game);
    drawSafeZoneText(ctx, game);
}

/**
 * 新增：繪製所有遊戲實體。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象。
 */
export function drawEntities(ctx, game) {
    const cam = game.camera; // 攝像機對象
    const zoom = game.constants.CAMERA_ZOOM;
    const visibleWidth = game.canvas.width / zoom; // 可見區域的世界寬度
    const visibleHeight = game.canvas.height / zoom; // 可見區域的世界高度
    const leeway = 50 / zoom; // 視錐體剔除的緩衝區 (按縮放調整)

    // 繪製樹木 (如果活躍且在視圖內)
    game.trees.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(ctx));

    // 繪製商店 (如果存在且在視圖內)
    if (game.tradingPost && game.tradingPost.isRectInView(cam, visibleWidth, visibleHeight, leeway)) game.tradingPost.draw(ctx, game);
    if (game.weaponShop && game.weaponShop.isRectInView(cam, visibleWidth, visibleHeight, leeway)) game.weaponShop.draw(ctx, game);
    if (game.healingRoom && game.healingRoom.isRectInView(cam, visibleWidth, visibleHeight, leeway)) game.healingRoom.draw(ctx, game);
    if (game.skillInstitute && game.skillInstitute.isRectInView(cam, visibleWidth, visibleHeight, leeway)) game.skillInstitute.draw(ctx, game);
    if (game.armorShop && game.armorShop.isRectInView(cam, visibleWidth, visibleHeight, leeway)) game.armorShop.draw(ctx, game);
    if (game.danceStudio && game.danceStudio.isRectInView(cam, visibleWidth, visibleHeight, leeway)) game.danceStudio.draw(ctx, game);

    // 繪製柵欄
    game.fences.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(ctx));
    // 繪製防禦塔
    game.towers.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(ctx));
    // 繪製視覺效果 (劈砍、範圍技能等)
    game.effects.forEach(e => e.active && e.draw(ctx)); // 特效通常不需要視錐體剔除
    // 繪製箭矢
    game.arrows.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(ctx));
    // 繪製子彈 (包括技能投射物)
    game.bullets.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(ctx));
    // 繪製敵人
    game.enemies.forEach(e => e.active && e.isRectInView(cam, visibleWidth, visibleHeight, leeway) && e.draw(ctx));
    // 繪製玩家 (如果活躍且在視圖內)
    if (game.player.active && game.player.isRectInView(cam, visibleWidth, visibleHeight, leeway)) game.player.draw(ctx);
    // 繪製目標角色 (如果存在且活躍且未被攜帶，並且在視圖內)
    if (game.goalCharacter && game.goalCharacter.active && !game.goalCharacter.isCarried && game.goalCharacter.isRectInView(cam, visibleWidth, visibleHeight, leeway)) {
        game.goalCharacter.draw(ctx);
    }
    // 繪製傷害數字
    game.damageNumbers.forEach(dn => dn.draw(ctx)); // 傷害數字通常不需要視錐體剔除
}


/**
 * 繪製技能選項 UI。
 * 當玩家站在研究所上且有技能點數時顯示。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象，包含玩家、常數等信息。
 */
export function drawSkillOptions(ctx, game) {
    // 確保必要的遊戲對象存在
    if (!game || !game.player || !game.skillInstitute || !game.constants) return;

    const player = game.player;
    const institute = game.skillInstitute;

    // 檢查玩家是否站在研究所上且有技能點數
    if (!simpleCollisionCheck(player, institute) || player.skillPoints <= 0) return;

    // 技能選項佈局參數
    const optionHeight = 40;
    const optionWidth = 200;
    const spacing = 10;
    const startY = game.canvas.height / 2 - (optionHeight * 2 + spacing * 1.5);
    const startX = game.canvas.width / 2 - optionWidth / 2;
    const cornerRadius = 5;

    // 技能圖標和名稱
    const skillIcons = ['💥', '🌟', '⚡', '☄️'];
    const skillNames = ['震盪波', '新星爆發', '能量箭', '能量光束'];

    // 獲取技能等級
    const skillLevels = [
        player.skillAoe1Level,
        player.skillAoe2Level,
        player.skillLinear1Level,
        player.skillLinear2Level
    ];

    ctx.save(); // 保存繪圖狀態

    // 添加陰影效果
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;

    // 繪製每個技能選項
    for (let i = 0; i < 4; i++) {
        const y = startY + i * (optionHeight + spacing);
        const currentLevel = skillLevels[i];
        const canUpgrade = currentLevel < game.constants.SKILL_MAX_LEVEL;

        // 檢查滑鼠或觸控位置以確定是否高亮
        let isHighlighted = false;
        const inputHandler = game.inputHandler;
        if (inputHandler) {
            // 滑鼠位置（電腦）
            if (!game.isTouchDevice() && inputHandler.mouseX !== undefined && inputHandler.mouseY !== undefined) {
                const mouseX = inputHandler.mouseX; // 已縮放
                const mouseY = inputHandler.mouseY; // 已縮放
                if (mouseX >= startX && mouseX <= startX + optionWidth && mouseY >= y && mouseY <= y + optionHeight) {
                    isHighlighted = true;
                }
            }
            // 觸控位置（手機）
            if (game.isTouchDevice() && inputHandler.touchActive) {
                const touchX = inputHandler.touchMoveX;
                const touchY = inputHandler.touchMoveY;
                if (touchX >= startX && touchX <= startX + optionWidth && touchY >= y && touchY <= y + optionHeight) {
                    isHighlighted = true;
                }
            }
        }

        // 選項背景
        ctx.fillStyle = canUpgrade ? 'rgba(60, 60, 100, 0.8)' : 'rgba(60, 60, 60, 0.8)';
        drawRoundedRect(ctx, startX, y, optionWidth, optionHeight, cornerRadius);
        ctx.fill();

        // 高亮邊框
        if (isHighlighted) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            drawRoundedRect(ctx, startX, y, optionWidth, optionHeight, cornerRadius);
            ctx.stroke();
        }

        // 繪製技能圖標
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(skillIcons[i], startX + 15, y + optionHeight / 2);

        // 繪製技能名稱
        ctx.font = 'bold 16px "Nunito", sans-serif';
        ctx.fillText(skillNames[i], startX + 50, y + optionHeight / 2 - 2);

        // 繪製技能等級
        ctx.font = '14px "Nunito", sans-serif';
        ctx.fillStyle = canUpgrade ? '#AAFFAA' : '#FFAAAA';
        const levelText = `Lv.${currentLevel}${canUpgrade ? ' → Lv.' + (currentLevel + 1) : ' (已滿級)'}`;
        ctx.fillText(levelText, startX + 50, y + optionHeight / 2 + 16);

        // 繪製按鍵提示
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 16px "Nunito", sans-serif';
        ctx.textAlign = 'right';
        // 移除按鍵提示： ctx.fillText(`[${i + 1}]`, startX + optionWidth - 15, y + optionHeight / 2);
    }

    // 繪製可用技能點數
    ctx.font = 'bold 14px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#AAFFAA';
    ctx.fillText(`可用技能點數: ${player.skillPoints}🧬`, startX + optionWidth / 2, startY - 15);

    ctx.restore(); // 恢復繪圖狀態
}

/**
 * 繪製遊戲的抬頭顯示器 (HUD)。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象，包含玩家、常數等信息。
 */
export function drawHUD(ctx, game) {
    // 確保必要的遊戲對象存在
    if (!game || !game.player || !game.constants) return;

    const constants = game.constants; // 遊戲常數
    const player = game.player; // 玩家對象
    // HUD 佈局參數
    const hudPadding = 15, barHeight = 20, barWidth = 180, iconSize = 22;
    const textOffsetY = 16, spacing = 15, cornerRadius = 4;
    const hpText = "HP"; // 要添加的文字
    const hpTextFont = `bold 16px 'Nunito', sans-serif`; // HP 文字字體 (加大)
    ctx.font = hpTextFont;
    const hpTextWidth = ctx.measureText(hpText).width; // 測量 HP 文字寬度
    const hpTextX = hudPadding; // HP 文字 X 座標
    const hpBarX = hpTextX + hpTextWidth + spacing * 0.5; // HP 條起始 X 座標 (向右移)
    const hpBarY = hudPadding; // HP 條起始 Y 座標

    ctx.save(); // 保存繪圖狀態
    // 添加陰影效果
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.shadowBlur = 3;

    // --- 繪製 HP 文字 ---
    ctx.fillStyle = 'white';
    ctx.font = hpTextFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(hpText, hpTextX, hpBarY + barHeight / 2); // 垂直居中於 HP 條

    // --- 繪製生命值條 (HP Bar) ---
    // 背景框
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    drawRoundedRect(ctx, hpBarX - 2, hpBarY - 2, barWidth + 4, barHeight + 4, cornerRadius);
    // 底色
    ctx.fillStyle = '#555';
    drawRoundedRect(ctx, hpBarX, hpBarY, barWidth, barHeight, cornerRadius);
    // 計算 HP 比例
    const hpRatio = Math.max(0, player.hp / player.maxHp);
    if (hpRatio > 0) {
        // 根據 HP 比例選擇顏色
        if (hpRatio > 0.6) ctx.fillStyle = '#22c55e'; // 綠色 (健康)
        else if (hpRatio > 0.3) ctx.fillStyle = '#facc15'; // 黃色 (警告)
        else ctx.fillStyle = '#ef4444'; // 紅色 (危險)
        // 繪製實際 HP 條 (如果 HP 未滿，右側不繪製圓角)
        drawRoundedRect(ctx, hpBarX, hpBarY, barWidth * hpRatio, barHeight, cornerRadius, true, hpRatio < 1);
    }
    // 繪製 HP 數值文本
    ctx.fillStyle = 'white'; ctx.font = `bold 14px 'Nunito', sans-serif`; // (加大)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(player.hp)}/${player.maxHp}`, hpBarX + barWidth / 2, hpBarY + barHeight / 2 + 1);


    // --- 繪製等級和經驗值條 (Level & XP Bar) ---
     const levelY = hpBarY + barHeight + spacing * 0.8; // 等級文本 Y 座標
     const xpBarHeight = 20; // XP 條高度 (稍微加高一點)
     const xpBarWidth = barWidth + 1; // XP 條寬度 (比 HP 條寬一點)
     const xpBarY = levelY + spacing * 0.7; // XP 條 Y 座標
     const xpBarX = hpBarX; // XP 條 X 座標與 HP 條對齊
     // 繪製等級文本
     ctx.fillStyle = 'white';
     ctx.font = `bold 16px 'Nunito', sans-serif`; // (加大)
     ctx.textAlign = 'left';
     ctx.textBaseline = 'middle';
     ctx.fillText(`Lv. ${player.level}`, xpBarX, levelY); // 使用 xpBarX
     // 繪製 XP 條背景框
     ctx.fillStyle = 'rgba(0,0,0,0.6)';
     drawRoundedRect(ctx, xpBarX - 1, xpBarY - 1, xpBarWidth + 2, xpBarHeight + 2, cornerRadius * 0.5);
     // 繪製 XP 條底色
     ctx.fillStyle = '#555';
     drawRoundedRect(ctx, xpBarX, xpBarY, xpBarWidth, xpBarHeight, cornerRadius * 0.5);
    // 如果需要升級經驗值
    if (player.xpToNextLevel > 0) {
        // 計算 XP 比例
         const xpRatio = Math.max(0, Math.min(1, player.xp / player.xpToNextLevel));
         if (xpRatio > 0) {
             // 繪製實際 XP 條
             ctx.fillStyle = '#fde047'; // 黃色
             drawRoundedRect(ctx, xpBarX, xpBarY, xpBarWidth * xpRatio, xpBarHeight, cornerRadius * 0.5, true, xpRatio < 1); // 使用 xpBarX
         }
          // 繪製 XP 數值文本
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 深色文字，在黃色條上更清晰
          ctx.font = `bold 14px 'Nunito', sans-serif`; // (加大) 字體大小基於條高度 -> 改為固定 14px
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${player.xp}/${player.xpToNextLevel}`, xpBarX + xpBarWidth / 2, xpBarY + xpBarHeight / 2 + 1); // 使用 xpBarX
     }

     // --- 繪製技能點數 (Skill Points) --- (移到 XP 條後面)
     let skillPointX = xpBarX + xpBarWidth + spacing; // X 座標在 XP 條右側
     const skillPointY = xpBarY + xpBarHeight / 2; // Y 座標與 XP 條中心對齊
     const skillPointIconX = skillPointX;
     const skillPointTextX = skillPointIconX + iconSize + spacing / 2;
     ctx.font = `${iconSize * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
     ctx.fillText('🧬', skillPointIconX + iconSize / 2, skillPointY); // 技能點圖標
     ctx.fillStyle = 'white'; ctx.font = `bold 16px 'Nunito', sans-serif`; ctx.textAlign = 'left'; // (加大)
     const skillPointText = `${player.skillPoints}`; ctx.fillText(skillPointText, skillPointTextX, skillPointY); // 技能點數量
     let currentX = skillPointTextX + ctx.measureText(skillPointText).width + spacing * 1.5; // 更新 X 座標，從技能點後開始

     // --- 修改：繪製目標角色圖標 (僅當攜帶時) ---
     if (player.carryingTrophy && player.trophyReference) { // 檢查是否正在攜帶
         const goalIconX = currentX;
         ctx.font = `${iconSize * 1.0}px sans-serif`; // 圖標大小
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         // 添加一點陰影
         ctx.shadowColor = 'rgba(0,0,0,0.6)';
         ctx.shadowOffsetX = 1;
         ctx.shadowOffsetY = 1;
         ctx.shadowBlur = 2;
         ctx.fillText(player.trophyReference.icon, goalIconX + iconSize / 2, skillPointY); // 使用 trophyReference 的圖標
         // 恢復陰影設置
         ctx.shadowColor = 'rgba(0,0,0,0.7)';
         ctx.shadowOffsetX = 1;
         ctx.shadowOffsetY = 1;
         ctx.shadowBlur = 3;
         currentX = goalIconX + iconSize + spacing * 1.5; // 更新 X 座標
     }


     // --- 繪製資源顯示 (Resources) ---
     // let currentX = hpBarX + barWidth + spacing * 1.5; // 起始 X 座標 (在 HP 條之後) - 已移到上方
     const resourceStartX = hpBarX + barWidth + spacing * 1.5; // 資源區的起始 X 座標
     currentX = resourceStartX; // 重置 currentX 到資源區起始位置
     const resourceY = hpBarY + barHeight / 2; // Y 座標 (與 HP 條中心對齊)
     // 繪製金幣 (Gold)
     const goldIconX = currentX;
     const goldTextX = goldIconX + iconSize + spacing / 2;
     ctx.font = `${iconSize * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
     ctx.fillText('💰', goldIconX + iconSize / 2, resourceY); // 金幣圖標
     ctx.fillStyle = 'white'; ctx.font = `bold 16px 'Nunito', sans-serif`; ctx.textAlign = 'left'; // (加大)
     const goldText = `${player.gold}`; ctx.fillText(goldText, goldTextX, resourceY); // 金幣數量
     currentX = goldTextX + ctx.measureText(goldText).width + spacing * 1.5; // 更新 X 座標
     // 繪製鑽石 (Diamond)
     const diamondIconX = currentX;
     const diamondTextX = diamondIconX + iconSize + spacing / 2;
     ctx.font = `${iconSize * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
     ctx.fillText('💎', diamondIconX + iconSize / 2, resourceY); // 鑽石圖標
     ctx.fillStyle = 'white'; ctx.font = `bold 16px 'Nunito', sans-serif`; ctx.textAlign = 'left'; // (加大)
     const diamondText = `${player.diamond}`; ctx.fillText(diamondText, diamondTextX, resourceY); // 鑽石數量
     currentX = diamondTextX + ctx.measureText(diamondText).width + spacing * 1.5;
     // 繪製木材 (Wood)
     const woodIconX = currentX;
     const woodTextX = woodIconX + iconSize + spacing / 2;
     ctx.font = `${iconSize * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
     ctx.fillText('🏝️', woodIconX + iconSize / 2, resourceY); // 木材圖標 (使用樹木表情符號)
     ctx.fillStyle = 'white'; ctx.font = `bold 16px 'Nunito', sans-serif`; ctx.textAlign = 'left'; // (加大)
     const woodText = `${player.wood}`; ctx.fillText(woodText, woodTextX, resourceY); // 木材數量
    //  currentX = woodTextX + ctx.measureText(woodText).width + spacing * 1.5; // 不再需要更新 X 座標，因為後面沒有資源了


     // --- 繪製當前武器 (Current Weapon) ---
     const weaponDisplayY = xpBarY + xpBarHeight + spacing * 1.2; // Y 座標 (基於 XP 條底部)
     let activeWeaponIcon = '', activeWeaponName = '', activeWeaponLevel = 0;
     // 根據玩家解鎖和等級確定當前武器
     if (player.gunUnlocked && player.gunLevel > 0) { activeWeaponIcon = '🔫'; activeWeaponName = '槍'; activeWeaponLevel = player.gunLevel; }
     else if (player.bowUnlocked && player.bowLevel > 0) { activeWeaponIcon = '🏹'; activeWeaponName = '弓'; activeWeaponLevel = player.bowLevel; }
     else { activeWeaponIcon = '🔪'; activeWeaponName = '刀'; activeWeaponLevel = player.cleaverLevel; }
     // 組合武器顯示文本
     const activeWeaponText = `${activeWeaponIcon} ${activeWeaponName} Lv.${activeWeaponLevel}`;
     ctx.fillStyle = 'white';
     ctx.font = `bold 14px 'Nunito', sans-serif`;
     ctx.textAlign = 'left';
     ctx.textBaseline = 'middle';
     ctx.fillText(activeWeaponText, xpBarX, weaponDisplayY); // 使用 xpBarX 對齊


    // --- 繪製衝刺技能 (Dash Skill) ---
    const dashIcon = '👟'; // 衝刺圖標
    const dashSkillY = weaponDisplayY + spacing * 1.5; // Y 座標
    const dashIconSize = 24; // 圖標大小
    const dashCooldownBarWidth = 50; // 冷卻條寬度
    const dashCooldownBarHeight = 10; // 冷卻條高度
    const dashIconX = xpBarX; // 圖標 X 座標 (與 XP 條對齊)
    const dashCooldownBarX = dashIconX + dashIconSize + spacing * 0.5; // 冷卻條 X 座標
    const dashCooldownTextX = dashCooldownBarX + dashCooldownBarWidth / 2; // 冷卻文字 X 座標
    const dashCooldownTextY = dashSkillY + dashCooldownBarHeight / 2 + 1; // 冷卻文字 Y 座標

    // 繪製圖標
    ctx.font = `${dashIconSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dashIcon, dashIconX, dashSkillY + dashCooldownBarHeight / 2); // 垂直居中對齊冷卻條

    // 繪製冷卻條背景
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    drawRoundedRect(ctx, dashCooldownBarX - 1, dashSkillY - 1, dashCooldownBarWidth + 2, dashCooldownBarHeight + 2, cornerRadius * 0.5);
    // 繪製冷卻條底色
    ctx.fillStyle = '#555';
    drawRoundedRect(ctx, dashCooldownBarX, dashSkillY, dashCooldownBarWidth, dashCooldownBarHeight, cornerRadius * 0.5);

    // 繪製冷卻進度
    if (player.dashCooldownTimer > 0 && player.constants.PLAYER_DASH_COOLDOWN > 0) {
        const cooldownRatio = 1 - (player.dashCooldownTimer / player.constants.PLAYER_DASH_COOLDOWN);
        const progressWidth = dashCooldownBarWidth * cooldownRatio;
        if (progressWidth > 0) {
            ctx.fillStyle = '#60a5fa'; // 淺藍色表示可用進度
            drawRoundedRect(ctx, dashCooldownBarX, dashSkillY, progressWidth, dashCooldownBarHeight, cornerRadius * 0.5, true, cooldownRatio < 1);
        }
        // 繪製冷卻時間文字
        ctx.fillStyle = 'white';
        ctx.font = `bold 10px 'Nunito', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${(player.dashCooldownTimer / 1000).toFixed(1)}s`, dashCooldownTextX, dashCooldownTextY);
    } else {
        // 如果冷卻完成，顯示 "Ready" 或填滿進度條
        ctx.fillStyle = '#60a5fa'; // 填滿表示可用
        drawRoundedRect(ctx, dashCooldownBarX, dashSkillY, dashCooldownBarWidth, dashCooldownBarHeight, cornerRadius * 0.5);
        ctx.fillStyle = 'white';
        ctx.font = `bold 10px 'Nunito', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('就緒', dashCooldownTextX, dashCooldownTextY);
    }

    // --- 繪製自動技能冷卻 (Auto Skills Cooldown) ---
    const dashSkillBottomY = dashSkillY + dashCooldownBarHeight; // 計算衝刺技能UI的底部 Y
    const skillStartY = dashSkillBottomY + spacing * 1.8;
    const skillIconSize = 20;
    const skillBarWidth = 40; // 冷卻條寬度
    const skillBarHeight = 8; // 冷卻條高度
    const levelTextHeight = 12;
    const skillElementHeight = skillIconSize; // 每個技能元素佔據的高度（基於圖標）
    const skillSpacing = spacing * 1.0; // 技能之間的垂直間距 (稍微減小)
    const skillStartX = xpBarX; // 技能 X 座標與 XP 條對齊

    // 繪製技能 1 (震盪波)
    drawSkillCooldown(ctx, player, 'skillAoe1CooldownTimer', constants.SKILL_AOE1_COOLDOWN, '💥', skillStartX, skillStartY, skillIconSize, skillBarWidth, skillBarHeight, cornerRadius);
    // 繪製技能 2 (新星爆發)
    let nextSkillY = skillStartY + skillElementHeight + skillSpacing; // 修正：使用統一間距
    drawSkillCooldown(ctx, player, 'skillAoe2CooldownTimer', constants.SKILL_AOE2_COOLDOWN, '🌟', skillStartX, nextSkillY, skillIconSize, skillBarWidth, skillBarHeight, cornerRadius);
    // 繪製技能 3 (能量箭)
    nextSkillY += skillElementHeight + skillSpacing; // 修正：使用統一間距
    drawSkillCooldown(ctx, player, 'skillLinear1CooldownTimer', constants.SKILL_LINEAR1_COOLDOWN, '⚡', skillStartX, nextSkillY, skillIconSize, skillBarWidth, skillBarHeight, cornerRadius);
    // 繪製技能 4 (能量光束)
    nextSkillY += skillElementHeight + skillSpacing; // 修正：使用統一間距
    drawSkillCooldown(ctx, player, 'skillLinear2CooldownTimer', constants.SKILL_LINEAR2_COOLDOWN, '☄️', skillStartX, nextSkillY, skillIconSize, skillBarWidth, skillBarHeight, cornerRadius);


     // --- 繪製右上角信息 (Top Right Info) ---
      const topRightX = game.canvas.width - hudPadding; // 右上角 X 座標 (使用畫布寬度)
      const topRightFontSize = 20; // 加大字體 (加大)
      const topRightFont = `bold ${topRightFontSize}px 'Nunito', sans-serif`;
      const topRightSpacing = spacing * 1.8; // 增加垂直間距
      let currentTopRightY = hpBarY + barHeight / 2 + 5; // 起始 Y 座標 (稍微下移一點以平衡)

     // --- 繪製難度等級 (Difficulty Level) ---
     const difficultyText = `關卡: ${game.difficultyLevel}`;
     ctx.font = topRightFont;
     ctx.fillStyle = '#FFA500'; // 使用更亮的橘色
     ctx.textAlign = 'right';
     ctx.textBaseline = 'middle';
     // 加強陰影
     ctx.shadowColor = 'rgba(0,0,0,0.8)';
     ctx.shadowOffsetX = 2;
     ctx.shadowOffsetY = 2;
     ctx.shadowBlur = 4;
     ctx.fillText(difficultyText, topRightX, currentTopRightY);
     // 恢復預設陰影
     ctx.shadowColor = 'rgba(0,0,0,0.7)';
     ctx.shadowOffsetX = 1;
     ctx.shadowOffsetY = 1;
     ctx.shadowBlur = 3;


     // --- 繪製總活躍敵人數量 (Total Active Enemy Count) ---
     currentTopRightY += topRightSpacing; // 更新 Y 座標
     const activeEnemyCount = game.enemies.filter(e => e.active).length; // 計算總活躍敵人數量
     const enemyCountText = `敵人: ${activeEnemyCount}`;
     ctx.font = topRightFont;
     ctx.fillStyle = '#FFFFFF'; // 白色
     // 加強陰影
     ctx.shadowColor = 'rgba(0,0,0,0.8)';
     ctx.shadowOffsetX = 2;
     ctx.shadowOffsetY = 2;
     ctx.shadowBlur = 4;
     ctx.fillText(enemyCountText, topRightX, currentTopRightY);
     // 恢復預設陰影
     ctx.shadowColor = 'rgba(0,0,0,0.7)';
     ctx.shadowOffsetX = 1;
     ctx.shadowOffsetY = 1;
     ctx.shadowBlur = 3;

     // (移除單獨的小王和大王計數)

    // --- 繪製觸控 UI ---
    if (game.inputHandler) {
        game.inputHandler.draw(ctx); // 呼叫 InputHandler 的 draw 方法繪製搖桿和按鈕
    }

    // 繪製技能選項 UI
    drawSkillOptions(ctx, game);

    // --- 新增：繪製附近商店互動提示 ---
    drawNearbyShopInfo(ctx, game);

    // --- 新增：繪製左下角遊戲目標框 ---
    drawObjectiveBox(ctx, game);

    ctx.restore(); // 恢復繪圖狀態
}

/**
 * 輔助函數：繪製玩家附近商店的互動提示信息。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象。
 */
function drawNearbyShopInfo(ctx, game) {
    if (!game || !game.player) return;
    const player = game.player;
    let shopToShow = null; // 要顯示信息的商店
    let minDistSq = Infinity; // 最短距離平方

    // 將所有商店加入檢查列表，包括武器店
    const shops = [
        game.armorShop,
        game.danceStudio,
        game.weaponShop,  // 添加武器店
        game.healingRoom,
        // game.tradingPost,
        // game.skillInstitute
        // 如果有其他商店，也可以加入
    ];

    // 檢查玩家是否靠近任何商店
    for (const shop of shops) {
        if (!shop) continue; // 跳過未定義的商店
        
        // 使用 simpleCollisionCheck 或距離計算
        if (simpleCollisionCheck(player, shop, 5)) { // 5 是容差值
            const distSq = distanceSq(player, shop);
            if (distSq < minDistSq) {
                minDistSq = distSq;
                shopToShow = shop;
            }
        }
    }

    // 如果找到最近的商店，顯示其信息
    if (shopToShow) {
        // 獲取商店名稱
        let shopName = "商店";
        if (shopToShow === game.weaponShop) shopName = "武器店";
        else if (shopToShow === game.armorShop) shopName = "防具店";
        else if (shopToShow === game.healingRoom) shopName = "治療室";
        else if (shopToShow === game.danceStudio) shopName = "舞蹈室";
        else if (shopToShow === game.tradingPost) shopName = "交易站";
        else if (shopToShow === game.skillInstitute) shopName = "研究所";
        
        // 繪製提示框
        const boxPadding = 10, fontSize = 14, cornerRadius = 5;
        const infoY = game.canvas.height - 60; // 顯示在底部偏上位置

        ctx.save();
        ctx.font = `bold ${fontSize}px 'Nunito', sans-serif`;
        
        // 將商店名稱和互動提示合併為一行
        const infoText = `${shopName} - 按E互動`;
        const textMetrics = ctx.measureText(infoText);
        
        const boxWidth = textMetrics.width + boxPadding * 2;
        const boxHeight = fontSize + boxPadding * 2; // 單行文字的高度
        const boxX = game.canvas.width / 2 - boxWidth / 2; // 水平居中

        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        drawRoundedRect(ctx, boxX, infoY, boxWidth, boxHeight, cornerRadius);
        ctx.fill();
        
        // 繪製合併後的文字
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(infoText, game.canvas.width / 2, infoY + boxPadding + fontSize / 2);
        ctx.restore();
    }
}

/**
 * 繪製屏幕頂部的臨時消息框。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象，包含消息文本和計時器。
 */

export function drawMessages(ctx, game) {
   // 如果沒有遊戲對象、消息計時器結束或沒有消息文本，則不繪製
   if (!game || game.messageTimer <= 0 || !game.messageText) return;

   const constants = game.constants; // 遊戲常數 (未使用)
   // 消息框佈局參數
   const boxPadding = 15; // 增加內邊距
   const boxY = 70; // 稍微下移
   const baseFontSize = 16; // 基礎字體大小
   const cornerRadius = 8;
   const canvasWidth = game.canvas.width; // 從 game 對象獲取畫布寬度

    // --- 根據消息內容調整樣式 (例如，初始目標消息) ---
    let isGoalMessage = game.messageText.includes("堅持到關卡50");
    let currentFontSize = isGoalMessage ? baseFontSize + 12 : baseFontSize; // 初始目標消息字體更大 (+12 -> 28px) (加大)
    let currentFont = `bold ${currentFontSize}px 'Nunito', sans-serif`; // 確保粗體
    let textColor = isGoalMessage ? 'black' : 'white'; // 初始目標消息用黑色
    let bgColor = isGoalMessage ? 'rgba(255, 255, 180, 0.9)' : 'rgba(0, 0, 0, 0.85)'; // 初始目標消息用淡黃色背景
   // 為黑色文字添加更明顯的淺色陰影以提高對比度
   let shadowColor = isGoalMessage ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
   let shadowOffsetX = isGoalMessage ? 1 : 1;
   let shadowOffsetY = isGoalMessage ? 1 : 2;
   let shadowBlur = isGoalMessage ? 3 : 3; // 稍微增加模糊

   // 設定字體並測量文本寬度
   ctx.font = currentFont;
   const textMetrics = ctx.measureText(game.messageText);
   const minBoxWidth = isGoalMessage ? 400 : 200; // 初始消息框更寬
   // 計算消息框寬度 (取最小值和文本寬度+內邊距中的較大者)
   const boxWidth = Math.max(minBoxWidth, textMetrics.width + boxPadding * 2);
   // 計算消息框高度
   const boxHeight = currentFontSize + boxPadding * (isGoalMessage ? 2.0 : 1.5); // 根據字體調整高度
   // 計算消息框 X 座標 (使其居中)
   const boxX = canvasWidth / 2 - boxWidth / 2;

   // --- 計算淡出效果 ---
   const fadeDuration = 400; // 淡出持續時間 (毫秒)
   let groupAlpha = 1.0; // 初始透明度
   // 如果計時器小於淡出時間，計算透明度
   if (game.messageTimer < fadeDuration) {
       groupAlpha = Math.max(0, game.messageTimer / fadeDuration);
   }
   groupAlpha = Math.min(1.0, groupAlpha); // 確保透明度在 0 到 1 之間

   ctx.save(); // 保存繪圖狀態
   ctx.globalAlpha = groupAlpha; // 應用透明度

   // --- 繪製消息框背景 ---
   ctx.fillStyle = bgColor; // 使用動態背景色
   drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius); // 使用導入的工具函數繪製圓角矩形

    // --- 繪製消息文本 ---
    ctx.shadowColor = shadowColor; // 使用動態陰影
    ctx.shadowOffsetX = shadowOffsetX;
    ctx.shadowOffsetY = shadowOffsetY;
    ctx.shadowBlur = shadowBlur;
    ctx.fillStyle = textColor; // 使用動態文本顏色
    ctx.textAlign = 'center'; // 居中對齊
    ctx.textBaseline = 'middle'; // 垂直居中
    // 如果是目標消息，添加描邊
    if (isGoalMessage) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // 白色描邊
        ctx.lineWidth = 1;
        ctx.strokeText(game.messageText, canvasWidth / 2, boxY + boxHeight / 2 + 1);
    }
    // --- 處理多行文本 ---
    const lines = game.messageText.split('\n');
    const lineHeight = currentFontSize * 1.2; // 行高，可以根據需要調整
    const totalTextHeight = lines.length * lineHeight;
    // 重新計算 boxHeight 以適應多行文本
    const adjustedBoxHeight = totalTextHeight + boxPadding * (isGoalMessage ? 1.5 : 1.0); // 調整內邊距
    // 確保 boxHeight 不小於原始計算值 (以防單行文本)
    const finalBoxHeight = Math.max(boxHeight, adjustedBoxHeight);

    // --- 重新繪製背景 (使用調整後的高度) ---
    ctx.globalAlpha = groupAlpha; // 確保透明度正確
    ctx.fillStyle = bgColor;
    // 清除可能已繪製的舊背景
    // ctx.clearRect(boxX - 1, boxY - 1, boxWidth + 2, boxHeight + 2); // 可能不需要，取決於繪製順序
    drawRoundedRect(ctx, boxX, boxY, boxWidth, finalBoxHeight, cornerRadius);
    ctx.fill(); // 重新填充背景

    // --- 繪製多行文本 ---
    ctx.shadowColor = shadowColor;
    ctx.shadowOffsetX = shadowOffsetX;
    ctx.shadowOffsetY = shadowOffsetY;
    ctx.shadowBlur = shadowBlur;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'; // 保持垂直居中基準

    const startTextY = boxY + finalBoxHeight / 2 - (totalTextHeight - lineHeight) / 2; // 計算第一行的起始 Y 座標 (垂直居中)

    lines.forEach((line, index) => {
        const lineY = startTextY + index * lineHeight;
        // 如果是目標消息，添加描邊
        if (isGoalMessage) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.strokeText(line, canvasWidth / 2, lineY);
        }
        ctx.fillText(line, canvasWidth / 2, lineY); // 繪製每一行
    });


    ctx.restore(); // 恢復繪圖狀態
}

/**
 * 新增：繪製左下角的遊戲目標提示框。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象。
 */
function drawObjectiveBox(ctx, game) {
    // 確保必要的遊戲對象存在
    if (!game || !game.constants) return;

    const canvasWidth = game.canvas.width;
    const canvasHeight = game.canvas.height;

    // 目標文本內容
    const objectiveTitle = "遊戲目標：";
    const objectiveLines = [
        "1. 堅持到關卡 50",
        "2. 場上會出現獎杯 🏆",
        "3. 把獎杯帶回安全區即可獲勝"
    ];

    // 樣式和佈局參數
    const boxPadding = 12;
    const titleFontSize = 16;
    const lineFontSize = 14;
    const lineHeight = lineFontSize * 1.3;
    const cornerRadius = 6;
    const boxMargin = 20; // 距離屏幕邊緣的距離

    ctx.save();

    // 計算文本寬度以確定框寬
    ctx.font = `bold ${titleFontSize}px 'Nunito', sans-serif`;
    const titleWidth = ctx.measureText(objectiveTitle).width;
    let maxLineWidth = titleWidth;
    ctx.font = `${lineFontSize}px 'Nunito', sans-serif`;
    objectiveLines.forEach(line => {
        const lineWidth = ctx.measureText(line).width;
        if (lineWidth > maxLineWidth) {
            maxLineWidth = lineWidth;
        }
    });

    const boxWidth = maxLineWidth + boxPadding * 2;
    // 計算框高 (標題 + 行數 * 行高 + 上下內邊距 + 標題和內容間距)
    const boxHeight = titleFontSize + (objectiveLines.length * lineHeight) + boxPadding * 2 + boxPadding * 0.5;
    // 計算框的位置 (左下角)
    const boxX = boxMargin;
    const boxY = canvasHeight - boxHeight - boxMargin;

    // --- 繪製背景 ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 半透明黑色背景
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;
    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius);
    ctx.fill();

    // --- 繪製文字 ---
    ctx.shadowColor = 'transparent'; // 文字不需要陰影
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // 繪製標題
    let currentY = boxY + boxPadding;
    ctx.font = `bold ${titleFontSize}px 'Nunito', sans-serif`;
    ctx.fillText(objectiveTitle, boxX + boxPadding, currentY);

    // 繪製目標列表
    currentY += titleFontSize + boxPadding * 0.5; // 標題和列表之間的間距
    ctx.font = `${lineFontSize}px 'Nunito', sans-serif`;
    objectiveLines.forEach(line => {
        ctx.fillText(line, boxX + boxPadding, currentY);
        currentY += lineHeight;
    });

    ctx.restore();
}


/**
 * 輔助函數：繪製單個技能的冷卻 UI。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Player} player
 * @param {string} timerKey - 玩家對象中計時器的屬性名稱 (e.g., 'skillAoe1CooldownTimer')
 * @param {number} maxCooldown - 該技能的最大冷卻時間 (來自 constants)
 * @param {string} icon - 技能圖標
 * @param {number} startX - UI 元素的起始 X 座標
 * @param {number} startY - UI 元素的起始 Y 座標
 * @param {number} iconSize - 圖標大小
 * @param {number} barWidth - 冷卻條寬度
 * @param {number} barHeight - 冷卻條高度
 * @param {number} cornerRadius - 圓角半徑
 */
function drawSkillCooldown(ctx, player, timerKey, maxCooldown, icon, startX, startY, iconSize, barWidth, barHeight, cornerRadius) {
    const levelKey = timerKey.replace('CooldownTimer', 'Level');
    const currentLevel = player[levelKey] || 0;
    const cooldownTimer = player[timerKey];

    // --- 計算佈局 ---
    const iconCenterY = startY + iconSize / 2; // 圖標垂直中心
    const levelPadding = 6; // 圖標和等級之間的間距
    const cooldownPadding = 8; // 等級和冷卻條之間的間距

    // 等級文字位置 (圖標右側, 垂直居中)
    const levelTextX = startX + iconSize + levelPadding;
    const levelTextY = iconCenterY;

    // 先預設字體測量等級文字寬度，以便定位冷卻條
    ctx.font = `bold 12px 'Nunito', sans-serif`; // 使用預期的等級字體
    const levelTextString = `Lv.${currentLevel > 0 ? currentLevel : 0}`;
    const levelTextMetrics = ctx.measureText(levelTextString);
    const levelTextWidth = levelTextMetrics.width;

    // 冷卻條位置 (等級文字右側, 垂直居中)
    const barX = levelTextX + levelTextWidth + cooldownPadding;
    // 讓冷卻條的垂直中心與圖標中心對齊
    const barY = iconCenterY - barHeight / 2;

    // 冷卻條內文字位置 (條內水平居中, 垂直居中)
    const cooldownTextX = barX + barWidth / 2;
    const cooldownTextY = barY + barHeight / 2 + 1; // 微調垂直位置

    // --- 繪製圖標 ---
    ctx.save(); // 保存狀態用於繪製圖標
    try {
        ctx.font = `${iconSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        if (currentLevel > 0) ctx.globalAlpha = 1.0;
        else ctx.globalAlpha = 0.4;
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(icon, startX, startY);
    } finally { ctx.restore(); }

    // --- 繪製技能等級文字 ---
    ctx.save();
    try {
        ctx.font = `bold 12px 'Nunito', sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        if (currentLevel > 0) ctx.fillStyle = '#FFFFFF';
        else ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.fillText(`Lv.${currentLevel > 0 ? currentLevel : 0}`, levelTextX, levelTextY);
    } finally { ctx.restore(); }

    // --- 繪製冷卻條背景 (始終繪製) ---
    ctx.save();
    try {
        ctx.shadowColor = 'transparent'; // 清除陰影
        // 繪製背景框
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        drawRoundedRect(ctx, barX - 1, barY - 1, barWidth + 2, barHeight + 2, cornerRadius * 0.5);
        // 繪製底色 (灰色)
        ctx.fillStyle = '#555';
        drawRoundedRect(ctx, barX, barY, barWidth, barHeight, cornerRadius * 0.5);

        // --- 繪製冷卻進度和時間 (僅當技能已學習) ---
        if (currentLevel > 0) {
            const stats = player.getSkillStats(parseInt(timerKey.match(/\d+/)[0]));
            const actualMaxCooldown = stats ? stats.cooldown : maxCooldown;

            if (cooldownTimer > 0 && actualMaxCooldown > 0 && actualMaxCooldown !== Infinity) {
                // 繪製進度
                const cooldownRatio = 1 - (cooldownTimer / actualMaxCooldown);
                const progressWidth = barWidth * cooldownRatio;
                if (progressWidth > 0) {
                    ctx.fillStyle = '#a78bfa'; // 進度條顏色
                    drawRoundedRect(ctx, barX, barY, progressWidth, barHeight, cornerRadius * 0.5, true, cooldownRatio < 1);
                }
                // 繪製冷卻時間數字
                ctx.fillStyle = 'white';
                ctx.font = `bold ${barHeight * 0.9}px 'Nunito', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${(cooldownTimer / 1000).toFixed(1)}`, cooldownTextX, cooldownTextY);
            } else {
                // 冷卻完成，顯示就緒狀態
                ctx.fillStyle = '#a78bfa'; // 填滿顏色
                drawRoundedRect(ctx, barX, barY, barWidth, barHeight, cornerRadius * 0.5);
                ctx.fillStyle = 'white'; // 白色文字
                ctx.font = `bold ${barHeight * 0.85}px 'Nunito', sans-serif`; // 調整字體大小
                ctx.textAlign = 'center';   // 居中
                ctx.textBaseline = 'middle'; // 垂直居中
                ctx.fillText('就緒', cooldownTextX, cooldownTextY);
            }
        }
        // --- 如果未學習，可以在灰色底條上顯示 '未學習' 或鎖圖標 (可選) ---
        // else {
        //     ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
        //     ctx.font = `bold ${barHeight * 0.8}px 'Nunito', sans-serif`;
        //     ctx.textAlign = 'center';
        //     ctx.textBaseline = 'middle';
        //     ctx.fillText('🔒', cooldownTextX, cooldownTextY); // 或 'N/A'
        // }
    } finally {
        ctx.restore();
    }
} // 結束 drawSkillCooldown 函數


// --- 新增：繪製勝利畫面 ---
/**
 * 繪製遊戲勝利畫面。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象。
 */
export function drawWinScreen(ctx, game) {
    const canvasWidth = game.canvas.width;
    const canvasHeight = game.canvas.height;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // --- 繪製背景遮罩 ---
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; // 半透明黑色背景
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // --- 繪製勝利文字 ---
    ctx.fillStyle = '#FFD700'; // 金色
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "bold 60px 'Nunito', sans-serif"; // 大字體
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.shadowBlur = 5;
    ctx.fillText("恭喜~獲勝通關!", centerX, centerY - 80);

    // --- 繪製按鈕 ---
    const buttonWidth = 180;
    const buttonHeight = 50;
    const buttonSpacing = 30;
    const buttonY = centerY + 40;
    const cornerRadius = 8;

    // 按鈕字體
    ctx.font = "bold 20px 'Nunito', sans-serif";
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 3;

    // 1. 繼續遊戲按鈕
    const continueButtonX = centerX - buttonWidth - buttonSpacing / 2;
    winScreenButtons.continue = { x: continueButtonX, y: buttonY, width: buttonWidth, height: buttonHeight }; // 儲存按鈕位置
    // 檢查高亮
    let continueHighlighted = false;
    if (game.inputHandler && game.inputHandler.mouseX !== undefined) {
        const mx = game.inputHandler.mouseX;
        const my = game.inputHandler.mouseY;
        if (mx >= continueButtonX && mx <= continueButtonX + buttonWidth && my >= buttonY && my <= buttonY + buttonHeight) {
            continueHighlighted = true;
        }
    }
    // 繪製背景
    ctx.fillStyle = continueHighlighted ? 'rgba(60, 180, 60, 0.9)' : 'rgba(40, 140, 40, 0.8)';
    drawRoundedRect(ctx, continueButtonX, buttonY, buttonWidth, buttonHeight, cornerRadius);
    ctx.fill();
    // 繪製邊框 (可選)
    if (continueHighlighted) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, continueButtonX, buttonY, buttonWidth, buttonHeight, cornerRadius);
        ctx.stroke();
    }
    // 繪製文字
    ctx.fillStyle = 'white';
    ctx.fillText("繼續遊戲", continueButtonX + buttonWidth / 2, buttonY + buttonHeight / 2 + 2);


    // 2. 結束遊戲按鈕
    const endButtonX = centerX + buttonSpacing / 2;
    winScreenButtons.end = { x: endButtonX, y: buttonY, width: buttonWidth, height: buttonHeight }; // 儲存按鈕位置
    // 檢查高亮
    let endHighlighted = false;
    if (game.inputHandler && game.inputHandler.mouseX !== undefined) {
        const mx = game.inputHandler.mouseX;
        const my = game.inputHandler.mouseY;
        if (mx >= endButtonX && mx <= endButtonX + buttonWidth && my >= buttonY && my <= buttonY + buttonHeight) {
            endHighlighted = true;
        }
    }
    // 繪製背景
    ctx.fillStyle = endHighlighted ? 'rgba(180, 60, 60, 0.9)' : 'rgba(140, 40, 40, 0.8)';
    drawRoundedRect(ctx, endButtonX, buttonY, buttonWidth, buttonHeight, cornerRadius);
    ctx.fill();
    // 繪製邊框 (可選)
     if (endHighlighted) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, endButtonX, buttonY, buttonWidth, buttonHeight, cornerRadius);
        ctx.stroke();
    }
    // 繪製文字
    ctx.fillStyle = 'white';
    ctx.fillText("結束遊戲", endButtonX + buttonWidth / 2, buttonY + buttonHeight / 2 + 2);

    ctx.restore(); // 恢復繪圖狀態
}


// --- 繪製結束畫面 ---
/**
 * 繪製遊戲結束畫面。
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
 * @param {Game} game - 遊戲主對象。
 */
export function drawEndScreen(ctx, game) {
    const canvasWidth = game.canvas.width;
    const canvasHeight = game.canvas.height;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // --- 繪製黑色背景 ---
    ctx.save();
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // --- 繪製 "The End" 文字 ---
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "bold 80px 'Times New Roman', serif"; // 使用不同字體增加效果
    // 添加簡單陰影
    ctx.shadowColor = 'rgba(200,200,200,0.5)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 5;
    ctx.fillText("The End", centerX, centerY);

    // (可選) 添加重新開始按鈕
    const restartButtonWidth = 150;
    const restartButtonHeight = 45;
    const restartButtonY = centerY + 100;
    const restartButtonX = centerX - restartButtonWidth / 2;
    endScreenButton = { x: restartButtonX, y: restartButtonY, width: restartButtonWidth, height: restartButtonHeight };
    // ... 繪製按鈕邏輯 ...
    ctx.fillStyle = 'rgba(80, 80, 80, 0.8)';
    drawRoundedRect(ctx, restartButtonX, restartButtonY, restartButtonWidth, restartButtonHeight, 5);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = "bold 18px 'Nunito', sans-serif";
    ctx.fillText("重新開始", centerX, restartButtonY + restartButtonHeight / 2 + 2);


    ctx.restore(); // 恢復繪圖狀態
}

/**
 * 繪製技能冷卻指示器
 * @param {CanvasRenderingContext2D} ctx - 繪圖上下文
 * @param {Game} game - 遊戲對象
 */
function drawSkillCooldowns(ctx, game) {
    if (!game.player || !game.player.skills) return;
    
    const skills = game.player.skills;
    const now = performance.now();
    const skillKeys = ['dash', 'aoe1', 'aoe2', 'beam'];
    const skillNames = {
        'dash': '衝刺',
        'aoe1': '震波',
        'aoe2': '新星',
        'beam': '光束'
    };
    
    const startX = 10;
    const startY = game.canvas.height - 60;
    const width = 50;
    const height = 50;
    const gap = 10;
    
    ctx.save();
    
    // 繪製每個技能的冷卻狀態
    skillKeys.forEach((key, index) => {
        const skill = skills[key];
        if (!skill || skill.level <= 0) return;
        
        const x = startX + (width + gap) * index;
        const y = startY;
        
        // 繪製技能背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y, width, height);
        
        // 繪製技能名稱
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(skillNames[key], x + width/2, y + 15);
        
        // 繪製冷卻進度
        if (skill.lastUsed && skill.cooldown) {
            const elapsed = now - skill.lastUsed;
            const cooldownRatio = Math.min(1, elapsed / skill.cooldown);
            
            if (cooldownRatio < 1) {
                // 繪製冷卻遮罩
                ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
                const maskHeight = height * (1 - cooldownRatio);
                ctx.fillRect(x, y, width, maskHeight);
                
                // 繪製剩餘冷卻時間
                const remainingSec = Math.ceil((skill.cooldown - elapsed) / 1000);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px Arial';
                ctx.fillText(remainingSec, x + width/2, y + height/2);
            }
        }
        
        // 繪製技能快捷鍵
        const keyBindings = ['SPACE', 'Q', 'W', 'E'];
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '10px Arial';
        ctx.fillText(keyBindings[index], x + width/2, y + height - 5);
    });
    
    ctx.restore();
}
