'use strict';

// 使用立即調用函數表達式 (IIFE) 來封裝計算邏輯並導出常量對象
export const gameConstants = (() => {
    // --- 基礎尺寸與世界設定 ---
    const TILE_SIZE = 40; // 遊戲中基本瓦片的大小（像素）
    const WORLD_HEIGHT = 1800; // 遊戲世界的總高度（像素）

    // --- 商店與建築位置計算 ---
    const shopHeight = TILE_SIZE * 2; // 商店的高度 (80) - 只定義一次
    const yBase = WORLD_HEIGHT / 2; // 世界 Y 軸的基準線 (900)
    const ySpacing = TILE_SIZE * 3; // 增加建築物之間的垂直間距 (120)
    // const shopHeight = TILE_SIZE * 2; // 移除重複定義

    // Recalculate Y positions relative to yBase with simpler spacing
    const weaponShopY = yBase - shopHeight / 2; // 武器店 Y (860)
    const tradingPostY = weaponShopY - ySpacing; // 交易站 Y (860 - 120 = 740)
    const healingRoomY = weaponShopY + ySpacing; // 治療室 Y (860 + 120 = 980)
    const instituteBuildingY = healingRoomY + ySpacing; // 研究所 Y (980 + 120 = 1100)

    const verticalBuffer = TILE_SIZE * 2; // 恢復緩衝區大小 (80)

    // --- 鑽石獎勵相關 ---
    const DIAMOND_AWARD_BASE = 1; // 擊殺敵人掉落鑽石的基礎數量
    const DIAMOND_VALUE = 4; // 每個鑽石的價值（用於購買）
    const DIAMOND_AWARD_SCALING_FACTOR = 1.05; // 鑽石獎勵隨難度等級的增長因子

    return {
        // --- 圖像資源 URL ---
        PLAYER_IMAGE_DATA_URL: 'https://lh3.googleusercontent.com/d/1EUKtxOBk2_gqWKWV3dPyNQec4wZGt3oH', // 玩家圖像
        ENEMY_IMAGE_DATA_URL: 'https://lh3.googleusercontent.com/d/1KJjenZtfeOByx-anum0wrlleGlQC5tOj', // 普通敵人圖像
        MINI_BOSS_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1AbsRrr3HFLvxNFC5fQ52cY4onZljvfRA', // 迷你 Boss 圖像
        BOSS_IMAGE_URL: 'https://lh3.googleusercontent.com/d/14uHsPWQM4WkOS9ZtwCnsPdhqLxN0Nq35', // Boss 圖像
        TREE_IMAGE_URL: 'https://lh3.googleusercontent.com/d/18Dg-zoR7ImttNuvDpfaWucLP658spVE3', // 樹木圖像
        // 新增敵人類型圖片
        ENEMY_FAST_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1Vm5cvKoKrbRCKgRSSiecX7CIGO7vp9AE', // 快速敵人圖像
        ENEMY_TANK_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1dcEruOyiZCDhDfVLvasJYdqF6Is2eo21', // 坦克敵人圖像
        ENEMY_RANGED_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1cfcwn2Y4_ZVg1dW5MfswU0L8S0TCGbrb', // 遠程敵人圖像
        ENEMY_EXPLOSIVE_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1I_812uUFnKznCxNoelPuRgOdkzRosxK9', // 爆炸敵人圖像
        ENEMY_TELEPORTER_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1BDIY44qFF0VjkgCfNjl_ELL9IxW7JAvf', // 傳送敵人圖像
        ENEMY_SUMMONER_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1U6pKWjobSZ6JSuY5Kk2cYcJ2xzMV5UDy', // 召喚師敵人圖像
        // 新增 Boss 圖像
        MINI_BOSS_A_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1fhjqi-RyuX-neRYH-iLkzA4P99MyMe41', // 新小王 快速衝撞 + 少量追蹤子彈
        MINI_BOSS_B_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1rQUqjg8Kb3nl3Q3h8HYc7fWLz5_obm0l', // 新小王 召喚普通小兵
        NEW_BOSS_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1N5oDJ05szNvxGerwoa0Xww3Es1ZMbbXm',    // 新大王 範圍震盪波 + 散射彈幕

        // --- 鏡頭縮放 ---
        CAMERA_ZOOM: 1.2, // 鏡頭放大倍數 (> 1 表示放大)

        // --- 世界與畫布尺寸 ---
        WORLD_WIDTH: 2400, // 遊戲世界的總寬度（像素）
        WORLD_HEIGHT: WORLD_HEIGHT, // 遊戲世界的總高度（像素） - 引用上面計算的值
        CANVAS_WIDTH: 1200, // HTML 畫布的寬度（像素）
        CANVAS_HEIGHT: 710, // HTML 畫布的高度（像素）
        TILE_SIZE: TILE_SIZE, // 導出瓦片大小 - 引用上面定義的值

        // --- 安全區計算 ---
        get SAFE_ZONE_WIDTH() { // 安全區寬度（動態計算）
            const sw = TILE_SIZE * 2; // 商店寬度
            const sm = TILE_SIZE * 2; // 商店與建築間距
            const sb = TILE_SIZE * 3; // 建築寬度
            return sm + sw + sb;
        },
        // Export calculated Y positions directly
        topBuildingY: tradingPostY,
        middleBuildingY: weaponShopY, // Keep for potential reference, though setupShops uses direct calculation
        bottomBuildingY: healingRoomY,
        instituteBuildingY: instituteBuildingY,
        verticalBuffer: verticalBuffer, // Export buffer for potential use

        get SAFE_ZONE_TOP_Y() { // 安全區頂部 Y 座標（動態計算，基於最上方的交易站）
            return tradingPostY - verticalBuffer; // (740 - 80 = 660)
        },
        get SAFE_ZONE_BOTTOM_Y() { // 安全區底部 Y 座標（動態計算，基於最下方的建築）
            // 找出所有建築的 Y 座標
            const buildingYs = [tradingPostY, weaponShopY, healingRoomY, instituteBuildingY];
            // 假設新商店的位置計算方式與 game.js 中一致
            const armorShopY = instituteBuildingY + shopHeight + TILE_SIZE;
            const danceStudioY = armorShopY + shopHeight + TILE_SIZE;
            buildingYs.push(armorShopY, danceStudioY);
            // 找到最低建築的底部 Y
            const lowestBuildingY = Math.max(...buildingYs);
            return lowestBuildingY + shopHeight + verticalBuffer; // 最低建築底部 + 緩衝區
        },

        // --- 玩家屬性 ---
        PLAYER_SPEED: 3, // 玩家移動速度
        PLAYER_DASH_SPEED_MULTIPLIER: 3.5, // 衝刺時的速度倍率
        PLAYER_DASH_DURATION: 180, // 衝刺持續時間 (毫秒)
        PLAYER_DASH_COOLDOWN: 1500, // 衝刺冷卻時間 (毫秒)
        PLAYER_DASH_INVINCIBILITY_DURATION: 300, // 衝刺期間的無敵時間 (毫秒) - 與持續時間相同

        // --- 敵人生成與屬性 ---
        ENEMY_SPAWN_RATE_BASE: 600, // 基礎敵人生成速率（毫秒）
        ENEMY_SPAWN_RATE_SCALE_PER_LEVEL: 0.60, // 每級難度生成速率的縮放因子 (越小越快)
        MAX_ENEMIES_BASE: 60, // 基礎最大敵人數量
        MAX_ENEMIES_INCREASE_PER_LEVEL: 20, // 每級難度增加的最大敵人數量
        ENEMY_HP_BASE: 30, // 敵人基礎生命值
        ENEMY_DAMAGE_BASE: 10, // 敵人基礎傷害值
        INITIAL_ENEMIES: 20, // 遊戲開始時的初始敵人數量
        ENEMY_WANDER_CHANGE_DIR_TIME: 1500, // 敵人在閒晃狀態下改變方向的時間間隔（毫秒）
        ENEMY_SIGHT_RANGE_SQ: (TILE_SIZE * 15) ** 2, // 敵人視野範圍的平方（用於性能優化）
        ENEMY_COLLISION_DIST_SQ: (TILE_SIZE * 1.5) ** 2, // 敵人碰撞檢測距離的平方
        SAFE_SPAWN_DIST_SQ: (TILE_SIZE * 10) ** 2, // 確保敵人在玩家安全距離外生成的距離平方
        TIME_PER_DIFFICULTY_LEVEL: 7000, // 提升一級難度所需的時間（毫秒）
        ENEMY_HP_SCALING_FACTOR: 0.12, // 敵人生命值隨難度等級的增長因子
        ENEMY_DAMAGE_SCALING_FACTOR: 0.07, // 敵人傷害值隨難度等級的增長因子
        ENEMY_BOOST_FACTOR_PER_5_LEVELS: 1.6, // 每 5 個難度等級，敵人獲得的額外增強因子
        ENEMY_SPEED_BASE: 1.0, // 敵人基礎移動速度
        ENEMY_WANDER_SPEED: 0.8, // 敵人閒晃時的移動速度

        // --- 環境物件 ---
        TREE_RESPAWN_TIME_MIN: 7000, // 樹木重生最短時間（毫秒）
        TREE_RESPAWN_TIME_MAX: 11000, // 樹木重生最長時間（毫秒）
        INITIAL_TREES: 50, // 遊戲開始時的初始樹木數量

        // --- 建築（防禦塔、柵欄） ---
        TOWER_RANGE: 180, // 防禦塔的攻擊範圍（像素）
        TOWER_FIRE_RATE: 900, // 防禦塔的開火速率（毫秒）
        FENCE_COST: 1, // 建造柵欄的成本（鑽石）
        TOWER_COST: 5, // 建造防禦塔的成本（鑽石）

        // --- 投射物 ---
        BULLET_DAMAGE: 12, // 防禦塔子彈的基礎傷害

        // --- 鑽石獎勵（導出） ---
        diamond_AWARD_BASE: DIAMOND_AWARD_BASE, // 導出基礎鑽石獎勵 - 引用上面定義的值
        diamond_VALUE: DIAMOND_VALUE, // 導出鑽石價值 - 引用上面定義的值
        diamond_AWARD_SCALING_FACTOR: DIAMOND_AWARD_SCALING_FACTOR, // 導出鑽石獎勵增長因子 - 引用上面定義的值

        // --- 玩家等級與經驗常量 ---
        PLAYER_INITIAL_LEVEL: 1, // 玩家初始等級
        PLAYER_INITIAL_XP: 0, // 玩家初始經驗值
        PLAYER_XP_BASE_REQ: 100, // 升到下一級所需的基礎經驗值
        PLAYER_XP_LEVEL_MULTIPLIER: 1.6, // 每級所需經驗值的乘數因子
        PLAYER_HP_BASE: 150, // 玩家基礎生命值
        PLAYER_HP_GAIN_PER_LEVEL: 15, // 玩家每級獲得的生命值增益
        PLAYER_ATTACK_GAIN_PER_LEVEL: 2, // 玩家每級獲得的攻擊力增益（可能影響武器傷害）
        SKILL_POINTS_PER_LEVEL: 1, // 玩家每級獲得的技能點數

        // --- 敵人經驗獎勵常量 ---
        XP_REWARD_BASE: 8, // 擊殺普通敵人的基礎經驗獎勵
        XP_REWARD_LEVEL_MULTIPLIER: 1.15, // 經驗獎勵隨敵人等級的乘數因子
        XP_REWARD_MINI_BOSS_MULTIPLIER: 5, // 擊殺迷你 Boss 的經驗獎勵乘數
        XP_REWARD_BOSS_MULTIPLIER: 20, // 擊殺 Boss 的經驗獎勵乘數
        GOLD_REWARD_MINI_BOSS: 400, // 增加小Boss獎勵
        GOLD_REWARD_BOSS: 1000, // 增加Boss獎勵

        // --- 武器：菜刀屬性 ---
        CLEAVER_MAX_LEVEL: 5, // 菜刀最高等級
        CLEAVER_BASE_DAMAGE: 16, // 菜刀基礎傷害
        CLEAVER_DAMAGE_INCREASE_PER_LEVEL: 5, // 菜刀每級增加的傷害
        CLEAVER_BASE_COOLDOWN: 100, // 菜刀基礎冷卻時間（毫秒）
        CLEAVER_COOLDOWN_MULTIPLIER: 0.95, // 菜刀冷卻時間隨等級的乘數因子 (修正：應小於1以減少冷卻)
        CLEAVER_RANGE: TILE_SIZE * 3.0, // 菜刀攻擊範圍
        CLEAVER_COSTS: [0, 25, 60, 130, 250], // 菜刀升級成本（索引對應等級-1）

        // --- 武器：弓箭屬性 ---
        BOW_MAX_LEVEL: 10, // 弓箭最高等級
        BOW_DAMAGE_INCREASE_PER_LEVEL: 32, // 弓箭每級增加的傷害
        BOW_COOLDOWN_MULTIPLIER: 0.96, // 弓箭冷卻時間隨等級的乘數因子（越小越快）
        BOW_BASE_RANGE: TILE_SIZE * 5, // 弓箭基礎射程
        BOW_RANGE_INCREASE_PER_LEVEL: TILE_SIZE * 0.55, // 弓箭每級增加的射程
        BOW_COSTS: [ 200, 400, 800, 1600, 3200, 4000, 7200, 9000, 14000, 20000 ], // 弓箭升級成本
        BOW_MULTISHOT_START_LEVEL: 5, // 弓箭開始多重射擊的等級

        // --- 武器：槍屬性 ---
        GUN_MAX_LEVEL: 10, // 槍最高等級
        GUN_UNLOCK_AT_BOW_LEVEL: 10, // 解鎖槍所需的弓箭等級
        GUN_BASE_DAMAGE_MULTIPLIER: 3.0, // 槍相對於基礎攻擊力的傷害乘數
        GUN_DAMAGE_INCREASE_PER_LEVEL: 68, // 槍每級增加的傷害
        GUN_COOLDOWN_MULTIPLIER: 0.90, // 槍冷卻時間隨等級的乘數因子（越小越快）
        GUN_BASE_RANGE: TILE_SIZE * 6.5, // 槍基礎射程
        GUN_RANGE_INCREASE_PER_LEVEL: TILE_SIZE * 0.3, // 槍每級增加的射程
        GUN_COSTS: [ 30000, 50000, 80000, 120000, 180000, 250000, 350000, 500000, 700000, 1000000 ], // 槍升級成本

        // --- 商店與效果 ---
        HEALING_COST_PER_HP: 1, // 每點生命值的治療成本（鑽石）
        HEALING_RATE: 200, // 治療速率（毫秒/點 HP）
        WEAPON_UPGRADE_COOLDOWN: 500, // 武器升級操作的冷卻時間（防止快速點擊）
        ARROW_SPEED: 8, // 箭矢飛行速度
        ARROW_LENGTH: TILE_SIZE * 0.8, // 箭矢視覺長度
        BULLET_SPEED: 10, // 槍子彈飛行速度
        BULLET_TRAIL_OPACITY: 0.4, // 槍子彈拖尾的不透明度
        SLASH_EFFECT_DURATION: 150, // 菜刀揮砍效果的持續時間（毫秒）

        // --- Boss 相關常量 ---
        MINI_BOSS_HP_MULTIPLIER: 4.0, // 迷你 Boss 相對於普通敵人的生命值乘數
        MINI_BOSS_DAMAGE_MULTIPLIER: 1.0, // 迷你 Boss 相對於普通敵人的傷害乘數
        BOSS_HP_MULTIPLIER: 30.0, // Boss 相對於普通敵人的生命值乘數
        BOSS_DAMAGE_MULTIPLIER: 1.5, // Boss 相對於普通敵人的傷害乘數
        MINI_BOSS_360_COOLDOWN: 3200, // 迷你 Boss 360度攻擊的冷卻時間（毫秒）
        BOSS_TARGETED_COOLDOWN: 2200, // Boss 目標攻擊的冷卻時間（毫秒）
        BOSS_BULLET_SPEED: 7, // Boss 子彈的飛行速度
        BOSS_TARGETED_BULLET_COUNT: 5, // Boss 目標攻擊發射的子彈數量

        // --- 自動玩家技能 ---
        // 技能 1: 範圍攻擊 - 震盪波 (Shockwave)
        SKILL_AOE1_DAMAGE: 30,       // 基礎傷害
        SKILL_AOE1_COOLDOWN: 1500,    // 冷卻時間 (毫秒)
        SKILL_AOE1_RADIUS: TILE_SIZE * 6, // 作用半徑

        // 技能 2: 範圍攻擊 - 新星爆發 (Nova)
        SKILL_AOE2_DAMAGE: 70,       // 基礎傷害
        SKILL_AOE2_COOLDOWN: 3000,   // 冷卻時間 (毫秒)
        SKILL_AOE2_RADIUS: TILE_SIZE * 7, // 作用半徑

        // 技能 3: 直線穿透 - 能量箭 (Bolt)
        SKILL_LINEAR1_DAMAGE: 85,    // 基礎傷害
        SKILL_LINEAR1_COOLDOWN: 2000, // 冷卻時間 (毫秒)
        SKILL_LINEAR1_RANGE: TILE_SIZE * 10, // 射程
        SKILL_LINEAR1_WIDTH: TILE_SIZE * 0.8, // 寬度
        SKILL_LINEAR1_SPEED: 9,      // 投射物速度

        // 技能 4: 直線穿透 - 能量光束 (Beam)
        SKILL_LINEAR2_DAMAGE: 95,    // 基礎傷害
        SKILL_LINEAR2_COOLDOWN: 3500,// 冷卻時間 (毫秒)
        SKILL_LINEAR2_RANGE: TILE_SIZE * 15, // 射程
        SKILL_LINEAR2_WIDTH: TILE_SIZE * 1.2, // 寬度
        SKILL_LINEAR2_SPEED: 7,      // 投射物速度

        // --- 技能等級與加成 ---
        SKILL_MAX_LEVEL: 10, // 所有自動技能的最高等級

        // 震盪波 (AOE1) 加成
        SKILL_AOE1_DAMAGE_PER_LEVEL: 120,     // 每級增加傷害
        SKILL_AOE1_COOLDOWN_MULTIPLIER: 0.95, // 每級冷卻時間乘數 (修正：應小於1以減少冷卻)
        SKILL_AOE1_RADIUS_PER_LEVEL: TILE_SIZE * 0.15, // 每級增加半徑

        // 新星爆發 (AOE2) 加成
        SKILL_AOE2_DAMAGE_PER_LEVEL: 220,    // 每級增加傷害
        SKILL_AOE2_COOLDOWN_MULTIPLIER: 0.95, // 每級冷卻時間乘數 (減少 8%)
        SKILL_AOE2_RADIUS_PER_LEVEL: TILE_SIZE * 0.3, // 每級增加半徑

        // 能量箭 (Linear1) 加成
        SKILL_LINEAR1_DAMAGE_PER_LEVEL: 330,   // 每級增加傷害
        SKILL_LINEAR1_COOLDOWN_MULTIPLIER: 0.95,// 每級冷卻時間乘數 (減少 5%)
        SKILL_LINEAR1_RANGE_PER_LEVEL: TILE_SIZE * 0.5, // 每級增加射程
        // SKILL_LINEAR1_WIDTH_PER_LEVEL: TILE_SIZE * 0.05, // 可選：每級增加寬度

        // 能量光束 (Linear2) 加成
        SKILL_LINEAR2_DAMAGE_PER_LEVEL: 300,   // 每級增加傷害
        SKILL_LINEAR2_COOLDOWN_MULTIPLIER: 0.97,// 每級冷卻時間乘數 (減少 7%)
        SKILL_LINEAR2_RANGE_PER_LEVEL: TILE_SIZE * 1.4, // 每級增加射程
        // SKILL_LINEAR2_WIDTH_PER_LEVEL: TILE_SIZE * 0.08,  // 可選：每級增加寬度

        // --- 技能信息 (用於 UI) ---
        SKILLS_INFO: [
            { index: 1, name: "震盪波", icon: "💥" },
            { index: 2, name: "新星爆發", icon: "🌟" },
            { index: 3, name: "能量箭", icon: "⚡" },
            { index: 4, name: "能量光束", icon: "☄️" }
        ],

        // --- 防具店與舞蹈室常量 (等級化) ---
        ARMOR_SHOP_MAX_LEVEL: 10, // 防具店最高等級
        ARMOR_SHOP_BASE_COST: 110, // 防具店升級基礎成本
        ARMOR_SHOP_COST_MULTIPLIER: 1.7, // 防具店成本每級乘數
        ARMOR_SHOP_BASE_HP_BONUS: 80, // 防具店 Lv1 提供的 HP 加成
        ARMOR_SHOP_HP_BONUS_INCREMENT: 320, // 防具店每級額外增加的 HP 量 (遞增)

        DANCE_STUDIO_MAX_LEVEL: 10, // 舞蹈室最高等級
        DANCE_STUDIO_BASE_COST: 110, // 舞蹈室升級基礎成本
        DANCE_STUDIO_COST_MULTIPLIER: 1.7, // 舞蹈室成本每級乘數
        DANCE_STUDIO_BASE_DODGE_BONUS: 0.0725, // 舞蹈室 Lv1 提供的閃避率 (約 7.3%) - 這是第一級的增量
        // 舞蹈室每級增加的閃避率 (遞減)，目標是 Lv10 總加成為 0.5 (50%)
        // Level:    1      2      3      4      5      6      7      8      9      10
        // Increase: 0.0725 0.0675 0.0625 0.0575 0.0525 0.0475 0.0425 0.0375 0.0325 0.0275
        // 預先計算好每級的 *總* 閃避加成，方便查找
        DANCE_STUDIO_DODGE_BONUS_PER_LEVEL: [
            0,      // Level 0 (未升級)
            0.0725, // Level 1
            0.14,   // Level 2 (+0.0675)
            0.2025, // Level 3 (+0.0625)
            0.26,   // Level 4 (+0.0575)
            0.3125, // Level 5 (+0.0525)
            0.36,   // Level 6 (+0.0475)
            0.4025, // Level 7 (+0.0425)
            0.44,   // Level 8 (+0.0375)
            0.4725, // Level 9 (+0.0325)
            0.60    // Level 10 (+0.0275) -> 總加成 60%
            // 注意：這個數組的索引對應等級，索引 0 表示 0 級
        ],
        // PLAYER_BASE_DODGE_CHANCE: 0.00, // 確保基礎閃避為 0，如果需要基礎閃避，請取消註釋並調整上方數組
        MINI_BOSS_SPAWN_LEVEL_INTERVAL: 3, // 原 Mini-Boss 生成間隔
        BOSS_SPAWN_LEVEL_INTERVAL: 5, // 原 Boss 生成間隔
        NEW_BOSS_START_LEVEL: 10, // 新 Boss 開始生成的關卡
        MINI_BOSS_A_SPAWN_INTERVAL: 2, // 新小王 A 生成間隔
        MINI_BOSS_B_SPAWN_INTERVAL: 3, // 新小王 B 生成間隔
        NEW_BOSS_SPAWN_INTERVAL: 4,    // 新大王 生成間隔

        // --- 新增敵人屬性常量 ---
        // 快速敵人
        FAST_ENEMY_SPEED_MULTIPLIER: 2.0, // 速度倍率
        FAST_ENEMY_HP_MULTIPLIER: 0.7,    // 生命值倍率
        FAST_ENEMY_DAMAGE_MULTIPLIER: 1.2, // 傷害倍率

        // 坦克敵人
        TANK_ENEMY_SPEED_MULTIPLIER: 0.7, // 速度倍率
        TANK_ENEMY_HP_MULTIPLIER: 4.5,    // 生命值倍率
        TANK_ENEMY_DAMAGE_MULTIPLIER: 1.5, // 傷害倍率

        // 遠程敵人
        RANGED_ENEMY_SPEED_MULTIPLIER: 0.9, // 速度倍率
        RANGED_ENEMY_HP_MULTIPLIER: 0.7,    // 生命值倍率
        RANGED_ENEMY_DAMAGE_MULTIPLIER: 1.3, // 傷害倍率
        RANGED_ENEMY_ATTACK_RANGE: TILE_SIZE * 8, // 攻擊範圍
        RANGED_ENEMY_PROJECTILE_SPEED: 3.5, // 投射物速度

        // 爆炸敵人
        EXPLOSIVE_ENEMY_SPEED_MULTIPLIER: 1.4, // 速度倍率
        EXPLOSIVE_ENEMY_HP_MULTIPLIER: 0.9,    // 生命值倍率
        EXPLOSIVE_ENEMY_DAMAGE_MULTIPLIER: 1.5, // 傷害倍率
        EXPLOSIVE_ENEMY_EXPLOSION_RADIUS: TILE_SIZE * 3, // 爆炸半徑
        EXPLOSIVE_ENEMY_EXPLOSION_DAMAGE: 30,  // 爆炸基礎傷害

        // 傳送敵人
        TELEPORTER_ENEMY_SPEED_MULTIPLIER: 1.0, // 速度倍率
        TELEPORTER_ENEMY_HP_MULTIPLIER: 1.0,    // 生命值倍率
        TELEPORTER_ENEMY_DAMAGE_MULTIPLIER: 1.1, // 傷害倍率
        TELEPORTER_ENEMY_TELEPORT_COOLDOWN: 2000, // 傳送冷卻時間(毫秒)
        TELEPORTER_ENEMY_TELEPORT_RANGE: TILE_SIZE * 7, // 傳送範圍

        // 召喚師敵人
        SUMMONER_ENEMY_SPEED_MULTIPLIER: 0.8, // 速度倍率
        SUMMONER_ENEMY_HP_MULTIPLIER: 1.5,    // 生命值倍率
        SUMMONER_ENEMY_DAMAGE_MULTIPLIER: 0.9, // 傷害倍率
        SUMMONER_ENEMY_SUMMON_COOLDOWN: 1500, // 召喚冷卻時間(毫秒)
        SUMMONER_ENEMY_MAX_SUMMONS: 6,        // 最大召喚數量
    };
})(); // IIFE 結束
