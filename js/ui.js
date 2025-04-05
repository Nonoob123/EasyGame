'use strict';
import { drawRoundedRect } from './utils.js'; // 導入繪製圓角矩形的工具函數

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
    const hpBarX = hudPadding, hpBarY = hudPadding; // HP 條起始位置

    ctx.save(); // 保存繪圖狀態
    // 添加陰影效果
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1; ctx.shadowBlur = 3;

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
    ctx.fillStyle = 'white'; ctx.font = `bold 12px 'Nunito', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(player.hp)}/${player.maxHp}`, hpBarX + barWidth / 2, hpBarY + barHeight / 2 + 1);


    // --- 繪製等級和經驗值條 (Level & XP Bar) ---
     const levelY = hpBarY + barHeight + spacing * 0.8; // 等級文本 Y 座標
     const xpBarHeight = 8; // XP 條高度
     const xpBarWidth = barWidth; // XP 條寬度
     const xpBarY = levelY + spacing * 0.7; // XP 條 Y 座標
     // 繪製等級文本
     ctx.fillStyle = 'white';
     ctx.font = `bold 14px 'Nunito', sans-serif`;
     ctx.textAlign = 'left';
     ctx.textBaseline = 'middle';
     ctx.fillText(`Lv. ${player.level}`, hpBarX, levelY);
     // 繪製 XP 條背景框
     ctx.fillStyle = 'rgba(0,0,0,0.6)';
     drawRoundedRect(ctx, hpBarX - 1, xpBarY - 1, xpBarWidth + 2, xpBarHeight + 2, cornerRadius * 0.5);
     // 繪製 XP 條底色
     ctx.fillStyle = '#555';
     drawRoundedRect(ctx, hpBarX, xpBarY, xpBarWidth, xpBarHeight, cornerRadius * 0.5);
    // 如果需要升級經驗值
    if (player.xpToNextLevel > 0) {
        // 計算 XP 比例
        const xpRatio = Math.max(0, Math.min(1, player.xp / player.xpToNextLevel));
        if (xpRatio > 0) {
            // 繪製實際 XP 條
            ctx.fillStyle = '#fde047'; // 黃色
            drawRoundedRect(ctx, hpBarX, xpBarY, xpBarWidth * xpRatio, xpBarHeight, cornerRadius * 0.5, true, xpRatio < 1);
        }
         // 繪製 XP 數值文本
         ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 深色文字，在黃色條上更清晰
         ctx.font = `bold 9px 'Nunito', sans-serif`;
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText(`${player.xp}/${player.xpToNextLevel}`, hpBarX + xpBarWidth / 2, xpBarY + xpBarHeight / 2 + 1);
    }


    // --- 繪製資源顯示 (Resources) ---
     let currentX = hpBarX + barWidth + spacing * 1.5; // 起始 X 座標
     const resourceY = hpBarY + barHeight / 2; // Y 座標 (與 HP 條中心對齊)
     // 繪製金幣 (Gold)
     const goldIconX = currentX;
     const goldTextX = goldIconX + iconSize + spacing / 2;
     ctx.font = `${iconSize * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
     ctx.fillText('💰', goldIconX + iconSize / 2, resourceY); // 金幣圖標
     ctx.fillStyle = 'white'; ctx.font = `bold 15px 'Nunito', sans-serif`; ctx.textAlign = 'left';
     const goldText = `${player.gold}`; ctx.fillText(goldText, goldTextX, resourceY); // 金幣數量
     currentX = goldTextX + ctx.measureText(goldText).width + spacing * 1.5; // 更新 X 座標
     // 繪製木材 (Wood)
     const woodIconX = currentX;
     const woodTextX = woodIconX + iconSize + spacing / 2;
     ctx.font = `${iconSize * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
     ctx.fillText('🏝️', woodIconX + iconSize / 2, resourceY); // 木材圖標 (使用樹木表情符號)
     ctx.fillStyle = 'white'; ctx.font = `bold 15px 'Nunito', sans-serif`; ctx.textAlign = 'left';
     const woodText = `${player.wood}`; ctx.fillText(woodText, woodTextX, resourceY); // 木材數量
     currentX = woodTextX + ctx.measureText(woodText).width + spacing * 1.5; // 更新 X 座標
      // 繪製鑽石 (Diamond)
      const diamondIconX = currentX;
      const diamondTextX = diamondIconX + iconSize + spacing / 2;
      ctx.font = `${iconSize * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💎', diamondIconX + iconSize / 2, resourceY); // 鑽石圖標
      ctx.fillStyle = 'white'; ctx.font = `bold 15px 'Nunito', sans-serif`; ctx.textAlign = 'left';
      const diamondText = `${player.diamond}`; ctx.fillText(diamondText, diamondTextX, resourceY); // 鑽石數量
      currentX = diamondTextX + ctx.measureText(diamondText).width + spacing * 1.5; // 更新 X 座標
      // --- 新增：繪製技能點數 (Skill Points) ---
      const skillPointIconX = currentX;
      const skillPointTextX = skillPointIconX + iconSize + spacing / 2;
      ctx.font = `${iconSize * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🧬', skillPointIconX + iconSize / 2, resourceY); // 技能點圖標
      ctx.fillStyle = 'white'; ctx.font = `bold 15px 'Nunito', sans-serif`; ctx.textAlign = 'left';
      const skillPointText = `${player.skillPoints}`; ctx.fillText(skillPointText, skillPointTextX, resourceY); // 技能點數量
      currentX = skillPointTextX + ctx.measureText(skillPointText).width + spacing * 1.5; // 更新 X 座標


    // --- 繪製當前武器 (Current Weapon) ---
     const weaponDisplayY = xpBarY + xpBarHeight + spacing * 1.2; // Y 座標
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
     ctx.fillText(activeWeaponText, hpBarX, weaponDisplayY); // 繪製文本


    // --- 繪製衝刺技能 (Dash Skill) ---
    const dashIcon = '👟'; // 衝刺圖標
    const dashSkillY = weaponDisplayY + spacing * 1.5; // Y 座標
    const dashIconSize = 24; // 圖標大小
    const dashCooldownBarWidth = 50; // 冷卻條寬度
    const dashCooldownBarHeight = 10; // 冷卻條高度
    const dashIconX = hpBarX; // 圖標 X 座標
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

    // --- 新增：繪製自動技能冷卻 (Auto Skills Cooldown) ---
    const skillStartY = dashSkillY + dashCooldownBarHeight + spacing; // 技能 UI 起始 Y 座標
    const skillIconSize = 20;
    const skillBarWidth = 40;
    const skillBarHeight = 8;
    const skillSpacing = spacing * 0.6; // 技能之間的垂直間距

    // 繪製技能 1 (震盪波)
    drawSkillCooldown(ctx, player, 'skillAoe1CooldownTimer', constants.SKILL_AOE1_COOLDOWN, '💥', hpBarX, skillStartY, skillIconSize, skillBarWidth, skillBarHeight, cornerRadius);
    // 繪製技能 2 (新星爆發)
    drawSkillCooldown(ctx, player, 'skillAoe2CooldownTimer', constants.SKILL_AOE2_COOLDOWN, '🌟', hpBarX, skillStartY + skillIconSize + skillSpacing, skillIconSize, skillBarWidth, skillBarHeight, cornerRadius);
    // 繪製技能 3 (能量箭)
    drawSkillCooldown(ctx, player, 'skillLinear1CooldownTimer', constants.SKILL_LINEAR1_COOLDOWN, '⚡', hpBarX, skillStartY + (skillIconSize + skillSpacing) * 2, skillIconSize, skillBarWidth, skillBarHeight, cornerRadius);
    // 繪製技能 4 (能量光束)
    drawSkillCooldown(ctx, player, 'skillLinear2CooldownTimer', constants.SKILL_LINEAR2_COOLDOWN, '☄️', hpBarX, skillStartY + (skillIconSize + skillSpacing) * 3, skillIconSize, skillBarWidth, skillBarHeight, cornerRadius);


    // --- 繪製右上角信息 (Top Right Info) ---
     const topRightX = game.canvas.width - hudPadding; // 右上角 X 座標 (使用畫布寬度)
     let currentTopRightY = hpBarY + barHeight / 2; // 起始 Y 座標
     // 繪製難度等級 (Difficulty Level)
     const difficultyText = `關卡: ${game.difficultyLevel}`; // 使用 game.difficultyLevel
     ctx.fillStyle = '#f97316'; // 橘色
     ctx.font = `bold 14px 'Nunito', sans-serif`;
     ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; // 右對齊
     ctx.fillText(difficultyText, topRightX, currentTopRightY);
      // 繪製活躍敵人數量 (Active Enemy Count)
      currentTopRightY += spacing * 1.5; // 更新 Y 座標
      const activeEnemyCount = game.enemies.filter(e => e.active).length; // 計算活躍敵人數量
      const enemyCountText = `敵人: ${activeEnemyCount}`;
      ctx.fillStyle = 'white';
      ctx.font = `bold 14px 'Nunito', sans-serif`;
      ctx.fillText(enemyCountText, topRightX, currentTopRightY);
      // 繪製小王數量 (Mini-Boss Count)
      const miniBossCount = game.enemies.filter(e => e.active && e.enemyType === 'mini-boss').length;
      if (miniBossCount > 0) { // 僅在有小王時顯示
          currentTopRightY += spacing * 1.5;
          const miniBossText = `小王: ${miniBossCount}`;
          ctx.fillStyle = '#DA70D6'; // 紫色
          ctx.fillText(miniBossText, topRightX, currentTopRightY);
      }
      // 繪製大王數量 (Boss Count)
      const bossCount = game.enemies.filter(e => e.active && e.enemyType === 'boss').length;
      if (bossCount > 0) { // 僅在有大王時顯示
          currentTopRightY += spacing * 1.5;
          const bossText = `大王: ${bossCount}`;
          ctx.fillStyle = '#FF4500'; // 橘紅色
          ctx.fillText(bossText, topRightX, currentTopRightY);
      }

    ctx.restore(); // 恢復繪圖狀態
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
   const boxPadding = 12, boxY = 65, fontSize = 14;
   const minBoxWidth = 200, cornerRadius = 6;
   const canvasWidth = game.canvas.width; // 從 game 對象獲取畫布寬度

   // 設定字體並測量文本寬度
   ctx.font = `bold ${fontSize}px 'Nunito', sans-serif`;
   const textMetrics = ctx.measureText(game.messageText);
   // 計算消息框寬度 (取最小值和文本寬度+內邊距中的較大者)
   const boxWidth = Math.max(minBoxWidth, textMetrics.width + boxPadding * 2);
   // 計算消息框高度
   const boxHeight = fontSize + boxPadding * 1.5;
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
   ctx.fillStyle = `rgba(0, 0, 0, 0.85)`; // 半透明黑色背景
   drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius); // 使用導入的工具函數繪製圓角矩形

   // --- 繪製消息文本 ---
   ctx.shadowColor = `rgba(0, 0, 0, 0.6)`; ctx.shadowOffsetX = 1; // 添加陰影
   ctx.shadowOffsetY = 2; ctx.shadowBlur = 3;
   ctx.fillStyle = `white`; // 白色文本
   ctx.textAlign = 'center'; // 居中對齊
   ctx.textBaseline = 'middle'; // 垂直居中
   ctx.fillText(game.messageText, canvasWidth / 2, boxY + boxHeight / 2 + 1); // 在消息框中心繪製文本

   ctx.restore(); // 恢復繪圖狀態
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
    // 從 timerKey 推斷 levelKey (例如 'skillAoe1CooldownTimer' -> 'skillAoe1Level')
    const levelKey = timerKey.replace('CooldownTimer', 'Level');
    const currentLevel = player[levelKey] || 0; // 獲取當前技能等級，如果不存在則為 0
    const cooldownTimer = player[timerKey];
    const barX = startX + iconSize + 5; // 冷卻條 X 座標
    const textX = barX + barWidth / 2; // 文字 X 座標
    const textY = startY + barHeight / 2 + 1; // 文字 Y 座標
    const levelTextY = startY + barHeight + 10; // 等級文字 Y 座標 (在下方)

    // 繪製圖標 (如果技能已學習)
    if (currentLevel > 0) {
        ctx.font = `${iconSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, startX, startY + barHeight / 2); // 垂直居中對齊冷卻條
    } else {
        // 如果未學習，可以顯示灰色圖標或不顯示
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.font = `${iconSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, startX, startY + barHeight / 2);
        ctx.restore();
    }


    // 繪製冷卻條背景 (僅當技能已學習)
    if (currentLevel > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    drawRoundedRect(ctx, barX - 1, startY - 1, barWidth + 2, barHeight + 2, cornerRadius * 0.5);
        // 繪製冷卻條底色
        ctx.fillStyle = '#555';
        drawRoundedRect(ctx, barX, startY, barWidth, barHeight, cornerRadius * 0.5);

        // 繪製冷卻進度
        const stats = player.getSkillStats(parseInt(timerKey.match(/\d+/)[0])); // 獲取計算後的屬性
        const actualMaxCooldown = stats ? stats.cooldown : maxCooldown; // 使用計算後的冷卻時間

        if (cooldownTimer > 0 && actualMaxCooldown > 0 && actualMaxCooldown !== Infinity) {
            const cooldownRatio = 1 - (cooldownTimer / actualMaxCooldown);
            const progressWidth = barWidth * cooldownRatio;
            if (progressWidth > 0) {
                ctx.fillStyle = '#a78bfa'; // 紫色表示可用進度
                drawRoundedRect(ctx, barX, startY, progressWidth, barHeight, cornerRadius * 0.5, true, cooldownRatio < 1);
            }
            // 繪製冷卻時間文字
            ctx.fillStyle = 'white';
            ctx.font = `bold ${barHeight * 0.8}px 'Nunito', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${(cooldownTimer / 1000).toFixed(1)}`, textX, textY);
        } else {
            // 如果冷卻完成，填滿進度條
            ctx.fillStyle = '#a78bfa'; // 填滿表示可用
            drawRoundedRect(ctx, barX, startY, barWidth, barHeight, cornerRadius * 0.5);
            // 可選：顯示 "Ready" 或不顯示文字
            // ctx.fillStyle = 'white';
            // ctx.font = `bold ${barHeight * 0.8}px 'Nunito', sans-serif`;
            // ctx.textAlign = 'center';
            // ctx.textBaseline = 'middle';
            // ctx.fillText('OK', textX, textY);
        }

        // 繪製技能等級文字 (如果已學習)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `bold 10px 'Nunito', sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Lv.${currentLevel}`, startX, levelTextY);
    } else {
         // 如果未學習，可以顯示 "未學習" 或灰色文字
         ctx.fillStyle = 'rgba(150, 150, 150, 0.7)';
         ctx.font = `bold 10px 'Nunito', sans-serif`;
         ctx.textAlign = 'left';
         ctx.textBaseline = 'top';
         ctx.fillText(`Lv.0`, startX, levelTextY);
    }
}
