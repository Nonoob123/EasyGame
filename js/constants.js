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
        ENEMY_IMAGE_DATA_URL: 'https://lh3.googleusercontent.com/d/1DBdId0qyQ71fGvsgw1IP1EfUZhjlvdYS', // 普通敵人圖像
        MINI_BOSS_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1pDCDVEk38jJswoy_r2l18zd3b2IY4k5U', // 迷你 Boss 圖像
        BOSS_IMAGE_URL: 'https://lh3.googleusercontent.com/d/1_Yfz7kU6GCg28W5xFw7r3hi1pW67cZYb', // Boss 圖像
        TREE_IMAGE_URL: 'https://lh3.googleusercontent.com/d/18Dg-zoR7ImttNuvDpfaWucLP658spVE3', // 樹木圖像

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
        get SAFE_ZONE_BOTTOM_Y() { // 安全區底部 Y 座標（動態計算，基於最下方的研究所）
            return instituteBuildingY + shopHeight + verticalBuffer; // (1100 + 80 + 80 = 1260)
        },

        // --- 玩家屬性 ---
        PLAYER_SPEED: 3, // 玩家移動速度
        PLAYER_DASH_SPEED_MULTIPLIER: 3.5, // 衝刺時的速度倍率
        PLAYER_DASH_DURATION: 180, // 衝刺持續時間 (毫秒)
        PLAYER_DASH_COOLDOWN: 1500, // 衝刺冷卻時間 (毫秒)
        PLAYER_DASH_INVINCIBILITY_DURATION: 180, // 衝刺期間的無敵時間 (毫秒) - 與持續時間相同

        // --- 敵人生成與屬性 ---
        ENEMY_SPAWN_RATE_BASE: 1000, // 基礎敵人生成速率（毫秒）
        ENEMY_SPAWN_RATE_SCALE_PER_LEVEL: 0.80, // 每級難度生成速率的縮放因子 (越小越快)
        MAX_ENEMIES_BASE: 30, // 基礎最大敵人數量
        MAX_ENEMIES_INCREASE_PER_LEVEL: 10, // 每級難度增加的最大敵人數量
        ENEMY_HP_BASE: 30, // 敵人基礎生命值
        ENEMY_DAMAGE_BASE: 10, // 敵人基礎傷害值
        INITIAL_ENEMIES: 10, // 遊戲開始時的初始敵人數量
        ENEMY_WANDER_CHANGE_DIR_TIME: 3000, // 敵人在閒晃狀態下改變方向的時間間隔（毫秒）
        ENEMY_SIGHT_RANGE_SQ: (TILE_SIZE * 15) ** 2, // 敵人視野範圍的平方（用於性能優化）
        ENEMY_COLLISION_DIST_SQ: (TILE_SIZE * 1.5) ** 2, // 敵人碰撞檢測距離的平方
        SAFE_SPAWN_DIST_SQ: (TILE_SIZE * 10) ** 2, // 確保敵人在玩家安全距離外生成的距離平方
        TIME_PER_DIFFICULTY_LEVEL: 10000, // 提升一級難度所需的時間（毫秒）
        ENEMY_HP_SCALING_FACTOR: 0.12, // 敵人生命值隨難度等級的增長因子
        ENEMY_DAMAGE_SCALING_FACTOR: 0.08, // 敵人傷害值隨難度等級的增長因子
        ENEMY_BOOST_FACTOR_PER_5_LEVELS: 1.6, // 每 5 個難度等級，敵人獲得的額外增強因子
        ENEMY_SPEED_BASE: 1.0, // 敵人基礎移動速度
        ENEMY_WANDER_SPEED: 0.5, // 敵人閒晃時的移動速度

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

        // --- 武器：菜刀屬性 ---
        CLEAVER_MAX_LEVEL: 5, // 菜刀最高等級
        CLEAVER_BASE_DAMAGE: 16, // 菜刀基礎傷害
        CLEAVER_DAMAGE_INCREASE_PER_LEVEL: 5, // 菜刀每級增加的傷害
        CLEAVER_BASE_COOLDOWN: 600, // 菜刀基礎冷卻時間（毫秒）
        CLEAVER_COOLDOWN_MULTIPLIER: 1.6, // 菜刀冷卻時間隨等級的乘數因子（這裡似乎是增加冷卻？可能需要檢查邏輯）
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

        // --- 新增：自動玩家技能 ---
        // 技能 1: 範圍攻擊 - 震盪波 (Shockwave)
        SKILL_AOE1_DAMAGE: 35,       // 基礎傷害
        SKILL_AOE1_COOLDOWN: 2000,    // 冷卻時間 (毫秒)
        SKILL_AOE1_RADIUS: TILE_SIZE * 4, // 作用半徑

        // 技能 2: 範圍攻擊 - 新星爆發 (Nova)
        SKILL_AOE2_DAMAGE: 75,       // 基礎傷害
        SKILL_AOE2_COOLDOWN: 3000,   // 冷卻時間 (毫秒)
        SKILL_AOE2_RADIUS: TILE_SIZE * 7, // 作用半徑

        // 技能 3: 直線穿透 - 能量箭 (Bolt)
        SKILL_LINEAR1_DAMAGE: 85,    // 基礎傷害
        SKILL_LINEAR1_COOLDOWN: 2000, // 冷卻時間 (毫秒)
        SKILL_LINEAR1_RANGE: TILE_SIZE * 10, // 射程
        SKILL_LINEAR1_WIDTH: TILE_SIZE * 0.8, // 寬度
        SKILL_LINEAR1_SPEED: 9,      // 投射物速度

        // 技能 4: 直線穿透 - 能量光束 (Beam)
        SKILL_LINEAR2_DAMAGE: 90,    // 基礎傷害
        SKILL_LINEAR2_COOLDOWN: 3000,// 冷卻時間 (毫秒)
        SKILL_LINEAR2_RANGE: TILE_SIZE * 15, // 射程
        SKILL_LINEAR2_WIDTH: TILE_SIZE * 1.2, // 寬度
        SKILL_LINEAR2_SPEED: 7,      // 投射物速度

        // --- 技能等級與加成 ---
        SKILL_MAX_LEVEL: 10, // 所有自動技能的最高等級

        // 震盪波 (AOE1) 加成
        SKILL_AOE1_DAMAGE_PER_LEVEL: 120,     // 每級增加傷害
        SKILL_AOE1_COOLDOWN_MULTIPLIER: 0.94, // 每級冷卻時間乘數 (減少 6%)
        SKILL_AOE1_RADIUS_PER_LEVEL: TILE_SIZE * 0.3, // 每級增加半徑

        // 新星爆發 (AOE2) 加成
        SKILL_AOE2_DAMAGE_PER_LEVEL: 250,    // 每級增加傷害
        SKILL_AOE2_COOLDOWN_MULTIPLIER: 0.95, // 每級冷卻時間乘數 (減少 8%)
        SKILL_AOE2_RADIUS_PER_LEVEL: TILE_SIZE * 0.5, // 每級增加半徑

        // 能量箭 (Linear1) 加成
        SKILL_LINEAR1_DAMAGE_PER_LEVEL: 120,   // 每級增加傷害
        SKILL_LINEAR1_COOLDOWN_MULTIPLIER: 0.95,// 每級冷卻時間乘數 (減少 5%)
        SKILL_LINEAR1_RANGE_PER_LEVEL: TILE_SIZE * 0.8, // 每級增加射程
        // SKILL_LINEAR1_WIDTH_PER_LEVEL: TILE_SIZE * 0.05, // 可選：每級增加寬度

        // 能量光束 (Linear2) 加成
        SKILL_LINEAR2_DAMAGE_PER_LEVEL: 250,   // 每級增加傷害
        SKILL_LINEAR2_COOLDOWN_MULTIPLIER: 0.97,// 每級冷卻時間乘數 (減少 7%)
        SKILL_LINEAR2_RANGE_PER_LEVEL: TILE_SIZE * 1.2, // 每級增加射程
        // SKILL_LINEAR2_WIDTH_PER_LEVEL: TILE_SIZE * 0.08,  // 可選：每級增加寬度

        // --- 新增：技能信息 (用於 UI) ---
        SKILLS_INFO: [
            { index: 1, name: "震盪波", icon: "💥" },
            { index: 2, name: "新星爆發", icon: "🌟" },
            { index: 3, name: "能量箭", icon: "⚡" },
            { index: 4, name: "能量光束", icon: "☄️" }
        ]
    };
})(); // IIFE 結束
