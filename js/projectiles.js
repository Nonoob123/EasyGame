'use strict';

import { Entity } from './entity.js'; // 導入基礎實體類
// 從 utils.js 導入 distanceSqValues, hexToRgb 和 simpleCollisionCheck
import { distanceSqValues, hexToRgb, simpleCollisionCheck } from './utils.js';
// 需要知道 Player, Enemy, Tower 類別以進行 instanceof 檢查
import { Player } from './player.js'; // 導入玩家類
import { Enemy } from './enemy.js'; // 導入敵人類
import { Tower } from './structures.js'; // 導入塔類 (假設 Tower 在 structures.js 中)

// --- 子彈類 (Bullet Class) ---
// 代表遊戲中的通用投射物，可以追蹤或直線飛行
export class Bullet extends Entity {
    /**
     * 創建一個子彈實例。
     * @param {number} x - 初始 X 座標 (中心點)。
     * @param {number} y - 初始 Y 座標 (中心點)。
     * @param {Entity|null} target - 子彈的目標實體 (如果追蹤)。
     * @param {Entity} shooter - 發射子彈的實體 (玩家、敵人、塔)。
     * @param {object} gameConstants - 遊戲常數。
     * @param {object} [options={}] - 子彈的可選屬性。
     * @param {boolean} [options.homing=true] - 子彈是否追蹤目標。
     * @param {number} [options.speed] - 子彈的速度。
     * @param {number} [options.damage] - 子彈的傷害值。
     * @param {string} [options.color] - 子彈的顏色。
     * @param {{dx: number, dy: number}|null} [options.direction=null] - 非追蹤子彈的初始方向 (標準化向量)。
     * @param {number} [options.lifeTime=5000] - 子彈的最大存活時間 (毫秒)。
     */
    constructor(x, y, target, shooter, gameConstants, options = {}) {
        const defaultRadius = 4; // 預設子彈半徑
        // 使用預設半徑初始化實體，稍後設定半徑
        super(x, y, defaultRadius * 2, defaultRadius * 2);
        this.radius = defaultRadius; // 子彈的碰撞半徑
        this.constants = gameConstants; // 儲存遊戲常數
        this.shooter = shooter; // 發射者 (玩家、敵人、塔)
        this.target = target;   // 預定目標 (非追蹤時可為 null)

        // --- 解析選項 (Parse Options) ---
        this.homing = options.homing !== undefined ? options.homing : true; // 預設為追蹤
        // 根據是否追蹤設定速度，或使用選項中的速度
        this.speed = options.speed || (this.homing ? this.constants.BULLET_SPEED : this.constants.BOSS_BULLET_SPEED);
        // 如果選項中未指定，則根據發射者類型決定傷害值
        this.damage = options.damage !== undefined ? options.damage : this.getDefaultDamage(shooter);
        // 如果選項中未指定，則根據發射者類型決定顏色
        this.color = options.color || this.getDefaultColor(shooter);
        this.direction = options.direction || null; // 非追蹤子彈的方向向量 {dx, dy} (需標準化)
        this.lifeTime = options.lifeTime || 5000; // 最大存活時間 (毫秒)
        this.spawnTime = performance.now(); // 子彈生成的時間戳

        // 調整位置，使 x, y 成為邊界框的左上角
        this.x = x - this.radius;
        this.y = y - this.radius;

        // 記錄上一幀的位置，用於繪製拖尾
        this.prevX = this.x;
        this.prevY = this.y;

        // 確保非追蹤子彈有方向
        if (!this.homing && !this.direction) {
            console.warn("創建非追蹤子彈時未指定方向。將設定隨機方向。");
            const randomAngle = Math.random() * Math.PI * 2; // 隨機角度
            // 計算標準化方向向量
            this.direction = { dx: Math.cos(randomAngle), dy: Math.sin(randomAngle) };
             // 再次標準化以防萬一 (Math.cos/sin 通常已是單位向量)
             const len = Math.sqrt(this.direction.dx ** 2 + this.direction.dy ** 2);
             if (len > 0) {
                 this.direction.dx /= len;
                 this.direction.dy /= len;
             }
        }
    }

    /**
     * 根據發射者類型獲取預設傷害值。
     * @param {Entity} shooter - 發射子彈的實體。
     * @returns {number} 預設傷害值。
     */
    getDefaultDamage(shooter) {
        if (shooter instanceof Player) return shooter.attackDamage; // 玩家傷害
        if (shooter instanceof Tower) return shooter.damage; // 塔的傷害 (假設塔有 damage 屬性)
        if (shooter instanceof Enemy) return shooter.damage; // 敵人的傷害 (假設敵人有 damage 屬性)
        return this.constants.BULLET_DAMAGE; // 預設後備傷害
    }

    /**
     * 根據發射者類型獲取預設顏色。
     * @param {Entity} shooter - 發射子彈的實體。
     * @returns {string} 預設顏色。
     */
    getDefaultColor(shooter) {
        if (shooter instanceof Player) return '#9ACD32'; // 玩家子彈: 黃綠色 (YellowGreen)
        if (shooter instanceof Tower) return '#FF4500'; // 塔子彈: 橘紅色 (OrangeRed)
        if (shooter instanceof Enemy) return '#A9A9A9'; // 敵人子彈: 深灰色 (DarkGray) (或可根據敵人類型變化?)
        return 'gray'; // 預設後備顏色
    }

    /**
     * 更新子彈狀態 (位置、碰撞等)。
     * @param {number} deltaTime - 時間增量 (毫秒)。
     * @param {Game} game - 遊戲主對象，用於訪問其他實體和常數。
     */
    update(deltaTime, game) {
         // 如果子彈不活躍或缺少必要的遊戲對象，則不更新
         if (!this.active || !game || !game.constants) return;

         // 記錄當前位置作為下一幀的 prevX, prevY
         this.prevX = this.x;
         this.prevY = this.y;

         // --- 存活時間檢查 (Lifetime Check) ---
         if (performance.now() - this.spawnTime > this.lifeTime) {
             this.active = false; // 超過存活時間，設為不活躍
             return;
         }

         let moveX = 0; // 本幀 X 軸移動量
         let moveY = 0; // 本幀 Y 軸移動量
         // 根據 deltaTime 調整移動速度，使其與幀率無關 (基於 60 FPS)
         const moveAmount = this.speed * (deltaTime / 16.67);

         // --- 移動邏輯 (Movement Logic) ---
         if (this.homing && this.target && this.target.active) {
             // --- 追蹤模式 ---
             // 計算指向目標中心的方向向量
             const targetCenterX = this.target.centerX;
             const targetCenterY = this.target.centerY;
             const dx = targetCenterX - this.centerX; // 使用子彈中心點計算
             const dy = targetCenterY - this.centerY;
             const dist = Math.sqrt(dx * dx + dy * dy); // 到目標的距離

             if (dist > 1) { // 避免除以零
                 // 計算標準化方向向量並乘以移動量
                 moveX = (dx / dist) * moveAmount;
                 moveY = (dy / dist) * moveAmount;
                 // 更新方向向量，以便在目標消失時能繼續沿此方向飛行
                 this.direction = { dx: dx / dist, dy: dy / dist };
             } else {
                 // 非常接近目標，讓碰撞檢測處理
             }
         } else if (this.direction) {
             // --- 非追蹤模式或目標丟失 ---
             // 沿最後已知或初始方向移動
             moveX = this.direction.dx * moveAmount;
             moveY = this.direction.dy * moveAmount;
             // 如果之前是追蹤模式，現在停止追蹤
             this.homing = false;
             // 目標已無關緊要，可以清除 (可選)
             // this.target = null;
         } else {
             // --- 既不追蹤也無方向 ---
             // 這種情況下的子彈不應存在或移動，設為不活躍
             this.active = false;
             return;
         }

         // --- 應用移動 (Apply Movement) ---
         const nextX = this.x + moveX; // 預計下一幀的 X 位置
         const nextY = this.y + moveY; // 預計下一幀的 Y 位置

         // --- 安全區檢查 (僅限敵人子彈) (Safe Zone Check) ---
         if (this.shooter instanceof Enemy) {
             const constants = game.constants;
             const nextCenterX = nextX + this.radius; // 預計下一幀的中心 X
             const nextCenterY = nextY + this.radius; // 預計下一幀的中心 Y
             // 判斷預計位置是否會進入安全區
             const projectileWillEnterSafeZone = nextCenterX < constants.SAFE_ZONE_WIDTH &&
                                                nextCenterY > constants.SAFE_ZONE_TOP_Y &&
                                                nextCenterY < constants.SAFE_ZONE_BOTTOM_Y;
             // 檢查當前幀開始時是否在安全區外
             const wasOutsideSafeZone = !(this.prevX + this.radius < constants.SAFE_ZONE_WIDTH &&
                                           this.prevY + this.radius > constants.SAFE_ZONE_TOP_Y &&
                                           this.prevY + this.radius < constants.SAFE_ZONE_BOTTOM_Y);

             // 如果即將進入且之前在外部，則銷毀子彈
             if (projectileWillEnterSafeZone && wasOutsideSafeZone) {
                 // console.log("敵人子彈進入安全區 - 已銷毀。");
                 this.active = false;
                 return; // 停止後續處理
             }
         }

         // 如果未被安全區銷毀，則更新位置
         this.x = nextX;
         this.y = nextY;


         // --- 碰撞檢測 (Collision Detection) ---
         let collisionOccurred = false; // 標記是否發生碰撞
         // const hitThresholdRadiusSq = (this.radius + 5)**2; // 基礎命中半徑平方 (未使用)

         if (this.shooter instanceof Player || this.shooter instanceof Tower) {
             // --- 玩家或塔的子彈：檢測與敵人的碰撞 ---
             if (game.enemies) { // 確保敵人列表存在
                for (const enemy of game.enemies) {
                     if (!enemy.active) continue; // 跳過不活躍的敵人
                     // 根據敵人大小設定更寬鬆的命中半徑
                     const enemyHitRadius = (enemy.width / 3); // 敵人近似半徑
                     const requiredDistSq = (this.radius + enemyHitRadius) ** 2; // 碰撞所需距離平方

                     // 計算子彈中心與敵人中心的距離平方
                     if (distanceSqValues(this.centerX, this.centerY, enemy.centerX, enemy.centerY) < requiredDistSq) {
                         const damageDealt = this.damage; // 造成的傷害
                         const enemyDied = enemy.takeDamage(damageDealt, game); // 敵人受到傷害，獲取是否死亡
                         collisionOccurred = true; // 標記發生碰撞
                         // 在敵人位置顯示傷害數字
                         game.addDamageNumber(enemy.centerX, enemy.y, damageDealt, this.color);
                         if (enemyDied) {
                             game.handleEnemyDefeat(enemy); // 如果敵人死亡，處理獎勵
                         }
                         break; // 子彈擊中一個敵人後消失
                     }
                 }
             }
         } else if (this.shooter instanceof Enemy) {
             // --- 敵人子彈：檢測與玩家的碰撞 ---
             const player = game.player; // 獲取玩家對象
             // 確保玩家存在、活躍且有生命值
             if (player && player.active && player.hp > 0) {
                 const playerHitRadius = (player.width / 3); // 玩家近似半徑
                 const requiredDistSq = (this.radius + playerHitRadius) ** 2; // 碰撞所需距離平方
                 // 計算子彈中心與玩家中心的距離平方
                 if (distanceSqValues(this.centerX, this.centerY, player.centerX, player.centerY) < requiredDistSq) {
                     const damageDealt = this.damage; // 造成的傷害
                     player.takeDamage(damageDealt, game); // 玩家受到傷害 (takeDamage 內部會處理閃避和傷害數字顯示)
                     collisionOccurred = true; // 標記發生碰撞
                     // 不在此處添加傷害數字，交由 player.takeDamage 處理
                 }
             }
         }

         // 如果發生了碰撞
         if (collisionOccurred) {
             this.active = false; // 子彈設為不活躍
             // 可選: 在此處添加撞擊效果，例如 game.addEffect(...)
             return; // 停止後續處理
         }

         // --- 邊界檢查 (Boundary Check) ---
         const margin = this.radius * 2; // 邊界外緩衝區
         // 如果子彈超出世界邊界太多，則設為不活躍
         if (this.x < -margin || this.x > game.constants.WORLD_WIDTH + margin ||
             this.y < -margin || this.y > game.constants.WORLD_HEIGHT + margin) {
             this.active = false;
         }
     }

    /**
     * 在畫布上繪製子彈。
     * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
     */
    draw(ctx) {
        if (!this.active) return; // 不繪製不活躍的子彈

         // --- 繪製拖尾 (Trail) ---
         // 如果有上一幀位置且位置發生了變化
         if (this.prevX !== undefined && this.prevY !== undefined && (this.x !== this.prevX || this.y !== this.prevY)) {
             ctx.save(); // 保存繪圖狀態
             // 根據子彈顏色決定拖尾顏色，使其更一致
             const trailColor = `rgba(${hexToRgb(this.color)}, ${this.constants.BULLET_TRAIL_OPACITY * 0.8})`; // 拖尾顏色，透明度稍低
             ctx.strokeStyle = trailColor; // 設定線條顏色
             ctx.lineWidth = this.radius * 1.2; // 拖尾線條寬度稍粗
             ctx.lineCap = 'round'; // 線條末端樣式為圓形
             ctx.beginPath(); // 開始繪製路徑
             // 從上一幀中心點畫到當前幀中心點
             ctx.moveTo(this.prevX + this.radius, this.prevY + this.radius);
             ctx.lineTo(this.x + this.radius, this.y + this.radius);
             ctx.stroke(); // 繪製線條
             ctx.restore(); // 恢復繪圖狀態
         }

        // --- 繪製子彈核心 (Bullet Core) ---
        ctx.fillStyle = this.color; // 設定填充顏色
        ctx.beginPath(); // 開始繪製路徑
        // 繪製圓形代表子彈
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fill(); // 填充圓形

        // 可選: 添加邊框以增加清晰度
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; // 半透明黑色邊框
        ctx.lineWidth = 1; // 邊框寬度
        ctx.stroke(); // 繪製邊框
    }
}


// --- 箭矢類 (Arrow Class) ---
// 代表玩家射出的箭矢，總是追蹤目標
export class Arrow extends Entity {
    /**
     * 創建一個箭矢實例。
     * @param {number} x - 初始 X 座標 (箭頭尖端)。
     * @param {number} y - 初始 Y 座標 (箭頭尖端)。
     * @param {Enemy} target - 箭矢的目標敵人。
     * @param {Player} shooter - 發射箭矢的玩家。
     * @param {object} gameConstants - 遊戲常數。
     */
    constructor(x, y, target, shooter, gameConstants) {
         // 初始尺寸，但繪製主要使用長度和角度
        super(x, y, gameConstants.ARROW_LENGTH, 5, '#8B4513'); // 箭桿顏色: SaddleBrown
        this.constants = gameConstants; // 儲存遊戲常數
        this.target = target; // 目標敵人
        this.shooter = shooter; // 發射者 (應為玩家實例)
        this.speed = this.constants.ARROW_SPEED; // 箭矢速度
        this.damage = shooter.attackDamage; // 傷害值來自發射者 (玩家)
        this.length = gameConstants.ARROW_LENGTH; // 箭矢長度
        this.tipX = x; // 箭頭尖端的 X 座標
        this.tipY = y; // 箭頭尖端的 Y 座標
        this.angle = 0; // 箭矢指向的角度 (弧度)
        this.headColor = '#A9A9A9'; // 箭頭顏色: 深灰色 (DarkGray)
         // 如果目標存在，設定初始角度指向目標
         if (this.target) {
              const dx = this.target.centerX - this.tipX;
              const dy = this.target.centerY - this.tipY;
              this.angle = Math.atan2(dy, dx); // 計算角度
         } else {
              // 如果沒有初始目標，需要後備角度嗎？或者假設創建時總有目標？
              this.angle = 0; // 預設角度
         }
        // 根據箭頭位置和角度計算箭尾 (實體左上角) 的初始位置
        this.x = this.tipX - this.length * Math.cos(this.angle);
        this.y = this.tipY - this.length * Math.sin(this.angle);
    }

    /**
     * 更新箭矢狀態 (位置、碰撞等)。
     * @param {number} deltaTime - 時間增量 (毫秒)。
     * @param {Game} game - 遊戲主對象，用於訪問目標、常數和添加傷害數字。
     */
    update(deltaTime, game) {
         // 如果箭矢不活躍或缺少必要的遊戲對象，則不更新
         if (!this.active || !game || !game.constants) return;

         // 檢查目標是否存在且活躍
         if (!this.target || !this.target.active) {
             this.active = false; // 如果目標消失，箭矢也消失
             return;
         }

         // --- 計算與目標的距離和方向 ---
         const targetCenterX = this.target.centerX;
         const targetCenterY = this.target.centerY;
         const dx = targetCenterX - this.tipX; // X 方向差
         const dy = targetCenterY - this.tipY; // Y 方向差
         const distSq = dx * dx + dy * dy; // 距離平方，用於碰撞檢測

         // --- 碰撞檢測 ---
         // 定義命中閾值，基於目標大小
         // 快速的箭矢可能需要更大的閾值，以在穿過目標前註冊命中
         const hitThreshold = (this.target.width / 3); // 目標近似半徑
         const hitThresholdSq = hitThreshold * hitThreshold; // 命中閾值平方

         if (distSq < hitThresholdSq) {
             // --- 命中目標 ---
             const damageDealt = this.damage; // 造成的傷害
             const enemyDied = this.target.takeDamage(damageDealt, game); // 目標受到傷害，獲取是否死亡
             this.active = false; // 箭矢消失
             // 在目標位置顯示傷害數字 (玩家箭矢顏色)
             game.addDamageNumber(this.target.centerX, this.target.y, damageDealt, '#9ACD32'); // YellowGreen
             if (enemyDied) {
                 game.handleEnemyDefeat(this.target); // 如果敵人死亡，處理獎勵
             }
             // 可選: 添加箭矢插入效果？
         } else {
             // --- 未命中，繼續移動 ---
             const dist = Math.sqrt(distSq); // 計算實際距離以進行標準化
             this.angle = Math.atan2(dy, dx); // 持續更新箭矢角度以指向目標

             // 計算移動量 (假設 deltaTime 由遊戲循環處理，否則需要乘以 deltaTime 調整)
             const moveAmount = this.speed; // * (deltaTime / 16.67);
             // 計算標準化移動向量
             const moveX = (dx / dist) * moveAmount;
             const moveY = (dy / dist) * moveAmount;

             // 更新箭頭位置
             this.tipX += moveX;
             this.tipY += moveY;

             // 更新實體基類位置 (箭尾) - 如果繪圖直接使用 tipX/Y，則可能不需要
             // this.x = this.tipX - this.length * Math.cos(this.angle);
             // this.y = this.tipY - this.length * Math.sin(this.angle);
         }

         // --- 邊界檢查 (Boundary Check) ---
         const margin = this.length * 2; // 邊界外緩衝區
         // 如果箭頭超出世界邊界太多，則設為不活躍
         if (this.tipX < -margin || this.tipX > game.constants.WORLD_WIDTH + margin ||
             this.tipY < -margin || this.tipY > game.constants.WORLD_HEIGHT + margin) {
             this.active = false;
         }
     }

    /**
     * 在畫布上繪製箭矢。
     * @param {CanvasRenderingContext2D} ctx - 繪圖上下文。
     */
    draw(ctx) {
        if (!this.active) return; // 不繪製不活躍的箭矢
        ctx.save(); // 保存繪圖狀態

        // --- 旋轉繪圖上下文 ---
        // 將原點平移到箭桿的中點以便旋轉
        // 中點 X = tipX - (length/2) * cos(angle)
        // 中點 Y = tipY - (length/2) * sin(angle)
        const midX = this.tipX - (this.length / 2) * Math.cos(this.angle);
        const midY = this.tipY - (this.length / 2) * Math.sin(this.angle);

        ctx.translate(midX, midY); // 平移原點到中點
        ctx.rotate(this.angle); // 旋轉坐標系

        // --- 繪製箭桿 (Shaft) ---
        // 在旋轉後的坐標系中，箭桿沿 X 軸繪製，中心在 (0,0)
        ctx.strokeStyle = this.color; // 箭桿顏色 (棕色)
        ctx.lineWidth = 3; // 箭桿寬度
        ctx.beginPath(); // 開始路徑
        ctx.moveTo(-this.length / 2, 0); // 從箭尾開始 (相對於中點)
        ctx.lineTo(this.length / 2, 0);  // 畫到箭頭 (相對於中點)
        ctx.stroke(); // 繪製線條

        // --- 繪製箭頭 (Head) ---
        // 在旋轉後坐標系的正 X 軸端 (length/2)
        ctx.strokeStyle = this.headColor; // 箭頭顏色 (灰色)
        ctx.lineWidth = 2.5; // 箭頭線條寬度
        const headLength = this.length * 0.25; // 箭頭倒鉤的長度
        const headAngle = Math.PI / 6; // 倒鉤與箭桿的角度 (30度)

        ctx.beginPath(); // 開始新路徑繪製箭頭
        // 從尖端畫回一個倒鉤
        ctx.moveTo(this.length / 2, 0); // 箭尖
        ctx.lineTo(this.length / 2 - headLength * Math.cos(headAngle), -headLength * Math.sin(headAngle));
        // 從尖端畫回另一個倒鉤
        ctx.moveTo(this.length / 2, 0); // 回到箭尖
        ctx.lineTo(this.length / 2 - headLength * Math.cos(headAngle), headLength * Math.sin(headAngle));
        ctx.stroke(); // 繪製箭頭

        // --- 可選: 繪製箭羽 (Fletching) ---
        // 在旋轉後坐標系的負 X 軸端 (-length/2)
        // ctx.strokeStyle = '#FFFFFF'; // 羽毛顏色 (白色)
        // ctx.lineWidth = 1.5;
        // const fletchLength = this.length * 0.2; // 羽毛長度
        // ctx.beginPath();
        // ctx.moveTo(-this.length / 2, 0); ctx.lineTo(-this.length / 2 - fletchLength, -3); // 一側羽毛
        // ctx.moveTo(-this.length / 2, 0); ctx.lineTo(-this.length / 2 - fletchLength, 3);  // 另一側羽毛
        // ctx.stroke();

        ctx.restore(); // 恢復繪圖狀態 (移除平移和旋轉)
    }
}


// --- 新增：能量箭 (EnergyBolt) - 直線穿透投射物 ---
export class EnergyBolt extends Entity {
    /**
     * 創建一個能量箭實例。
     * @param {number} x - 初始 X 座標 (中心點)。
     * @param {number} y - 初始 Y 座標 (中心點)。
     * @param {{dx: number, dy: number}} direction - 飛行的標準化方向向量。
     * @param {Entity} shooter - 發射者 (通常是玩家)。
     * @param {object} gameConstants - 遊戲常數。
     * @param {object} [options={}] - 可選屬性。
     * @param {number} [options.damage] - 傷害值。
     * @param {number} [options.speed] - 飛行速度。
     * @param {number} [options.range] - 最大射程。
     * @param {number} [options.width] - 投射物寬度 (用於繪製和碰撞)。
     * @param {string} [options.color] - 顏色。
     */
    constructor(x, y, direction, shooter, gameConstants, options = {}) {
        const width = options.width || gameConstants.SKILL_LINEAR1_WIDTH || 10;
        const height = width; // 假設寬高相同用於碰撞
        super(x - width / 2, y - height / 2, width, height); // Entity 構造函數需要左上角座標

        this.constants = gameConstants;
        this.shooter = shooter;
        this.direction = direction; // {dx, dy}
        this.damage = options.damage || gameConstants.SKILL_LINEAR1_DAMAGE || 40;
        this.speed = options.speed || gameConstants.SKILL_LINEAR1_SPEED || 9;
        this.range = options.range || gameConstants.SKILL_LINEAR1_RANGE || 400;
        this.color = options.color || '#00FFFF'; // 青色 (Cyan)
        this.spawnX = x; // 記錄生成點以計算射程
        this.spawnY = y;
        this.distanceTraveled = 0;
        this.hitEnemies = new Set(); // 記錄本投射物已擊中的敵人 ID，防止重複傷害
    }

    update(deltaTime, game) {
        if (!this.active || !game || !game.constants) return;

        const moveAmount = this.speed * (deltaTime / 16.67);
        const moveX = this.direction.dx * moveAmount;
        const moveY = this.direction.dy * moveAmount;

        this.x += moveX;
        this.y += moveY;
        this.distanceTraveled += moveAmount;

        // --- 射程檢查 ---
        if (this.distanceTraveled >= this.range) {
            this.active = false;
            return;
        }

        // --- 邊界檢查 ---
        const margin = this.width; // 使用寬度作為邊界緩衝
        if (this.x < -margin || this.x > game.constants.WORLD_WIDTH + margin ||
            this.y < -margin || this.y > game.constants.WORLD_HEIGHT + margin) {
            this.active = false;
            return;
        }

        // --- 穿透碰撞檢測 ---
        if (game.enemies && (this.shooter instanceof Player)) {
            for (const enemy of game.enemies) {
                // 跳過不活躍的敵人，或者這個投射物已經擊中過的敵人
                if (!enemy.active || this.hitEnemies.has(enemy.id)) { // <--- 檢查 hitEnemies
                    continue;
                }

                // 進行碰撞檢測
                if (simpleCollisionCheck(this, enemy)) {
                    const damageDealt = this.damage;
                    const enemyDied = enemy.takeDamage(damageDealt, game); // 敵人受到傷害，獲取是否死亡
                    game.addDamageNumber(enemy.centerX, enemy.y, damageDealt, this.color); // 顯示傷害數字

                    // 將敵人 ID 加入已擊中列表，防止重複傷害
                    this.hitEnemies.add(enemy.id); // <--- 添加到 Set
                    if (enemyDied) {
                        game.handleEnemyDefeat(enemy); // 如果敵人死亡，處理獎勵
                    }

                    // **** 注意：這裡不再設置 this.active = false ****
                    // 投射物會繼續飛行
                }
            }
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color; // 添加同色輝光
        ctx.shadowBlur = 8;

        // 繪製一個簡單的矩形代表能量箭
        // 可以考慮根據方向旋轉矩形，但為了簡單起見，先繪製對齊軸線的矩形
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // 或者繪製一條線段
        // const length = this.constants.TILE_SIZE * 0.8;
        // const angle = Math.atan2(this.direction.dy, this.direction.dx);
        // ctx.strokeStyle = this.color;
        // ctx.lineWidth = this.width / 2; // 使用寬度的一半作為線寬
        // ctx.lineCap = 'round';
        // ctx.beginPath();
        // ctx.moveTo(this.centerX - Math.cos(angle) * length / 2, this.centerY - Math.sin(angle) * length / 2);
        // ctx.lineTo(this.centerX + Math.cos(angle) * length / 2, this.centerY + Math.sin(angle) * length / 2);
        // ctx.stroke();

        ctx.restore();
    }
}


// --- 能量光束 (EnergyBeam) - 直線穿透投射物 ---
export class EnergyBeam extends Entity {
     /**
     * 創建一個能量光束實例。
     * @param {number} x - 初始 X 座標 (中心點)。
     * @param {number} y - 初始 Y 座標 (中心點)。
     * @param {{dx: number, dy: number}} direction - 飛行的標準化方向向量。
     * @param {Entity} shooter - 發射者 (通常是玩家)。
     * @param {object} gameConstants - 遊戲常數。
     * @param {object} [options={}] - 可選屬性。
     * @param {number} [options.damage] - 傷害值。
     * @param {number} [options.speed] - 飛行速度。
     * @param {number} [options.range] - 最大射程。
     * @param {number} [options.width] - 投射物寬度。
     * @param {string} [options.color] - 顏色。
     */
    constructor(x, y, direction, shooter, gameConstants, options = {}) {
        const width = options.width || gameConstants.SKILL_LINEAR2_WIDTH || 15;
        const height = width; // 假設寬高相同
        super(x - width / 2, y - height / 2, width, height);

        this.constants = gameConstants;
        this.shooter = shooter;
        this.direction = direction;
        this.damage = options.damage || gameConstants.SKILL_LINEAR2_DAMAGE || 90;
        this.speed = options.speed || gameConstants.SKILL_LINEAR2_SPEED || 7;
        this.range = options.range || gameConstants.SKILL_LINEAR2_RANGE || 600;
        this.color = options.color || '#FF00FF'; // 品紅色 (Magenta)
        this.spawnX = x;
        this.spawnY = y;
        this.distanceTraveled = 0;
        this.hitEnemies = new Set(); // 記錄已擊中的敵人
    }

    update(deltaTime, game) {
        if (!this.active || !game || !game.constants) return;

        const moveAmount = this.speed * (deltaTime / 16.67);
        const moveX = this.direction.dx * moveAmount;
        const moveY = this.direction.dy * moveAmount;

        this.x += moveX;
        this.y += moveY;
        this.distanceTraveled += moveAmount;

        // --- 射程檢查 ---
        if (this.distanceTraveled >= this.range) {
            this.active = false;
            return;
        }

        // --- 邊界檢查 ---
        const margin = this.width;
        if (this.x < -margin || this.x > game.constants.WORLD_WIDTH + margin ||
            this.y < -margin || this.y > game.constants.WORLD_HEIGHT + margin) {
            this.active = false;
            return;
        }

        // --- 穿透碰撞檢測 ---
        if (game.enemies && (this.shooter instanceof Player)) {
            for (const enemy of game.enemies) {
                // 跳過不活躍的敵人，或者這個投射物已經擊中過的敵人
                if (!enemy.active || this.hitEnemies.has(enemy.id)) { // <--- 檢查 hitEnemies
                    continue;
                }

                // 進行碰撞檢測
                if (simpleCollisionCheck(this, enemy)) {
                    const damageDealt = this.damage;
                    const enemyDied = enemy.takeDamage(damageDealt, game); // 敵人受到傷害，獲取是否死亡
                    game.addDamageNumber(enemy.centerX, enemy.y, damageDealt, this.color); // 顯示傷害數字

                    // 將敵人 ID 加入已擊中列表，防止重複傷害
                    this.hitEnemies.add(enemy.id); // <--- 添加到 Set
                    if (enemyDied) {
                        game.handleEnemyDefeat(enemy); // 如果敵人死亡，處理獎勵
                    }

                    // **** 注意：這裡不再設置 this.active = false ****
                    // 投射物會繼續飛行
                }
            }
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        // 繪製更像光束的線條
        const length = this.constants.TILE_SIZE * 1.2; // 光束視覺長度
        const angle = Math.atan2(this.direction.dy, this.direction.dx);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width; // 使用指定的寬度
        ctx.lineCap = 'butt'; // 平直末端
        ctx.globalAlpha = 0.8; // 略微透明
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        // 計算線段的起點和終點，使其中心在 (centerX, centerY)
        const startX = this.centerX - Math.cos(angle) * length / 2;
        const startY = this.centerY - Math.sin(angle) * length / 2;
        const endX = this.centerX + Math.cos(angle) * length / 2;
        const endY = this.centerY + Math.sin(angle) * length / 2;
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.restore();
    }
}
