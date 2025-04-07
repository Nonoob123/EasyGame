'use strict';

// 導入 Game 主類
import { Game } from './game.js';

// --- 遊戲啟動 ---
// 監聽 DOMContentLoaded 事件，確保在 HTML 文檔完全加載並解析完成後執行
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 完全加載並解析完成。正在初始化遊戲...");
    try {
        // 創建 Game 類的實例，傳入 Canvas 元素的 ID 'gameCanvas'
        const game = new Game('gameCanvas');

        // 啟動遊戲的初始化流程
        // 這會觸發一系列操作，包括狀態重置、商店設置、初始實體生成和圖像加載
        game.init();

        // 可選：將 game 實例暴露到全局 window 對象，方便在瀏覽器控制台中進行調試
        // window.currentGame = game;

         console.log("遊戲初始化已啟動。");

    } catch (error) {
        // 捕獲在遊戲初始化過程中可能發生的任何錯誤
        console.error("遊戲初始化期間發生嚴重錯誤:", error);

        // 在頁面上顯示一個用戶友好的錯誤消息
        const body = document.querySelector('body'); // 獲取 body 元素
        if (body) {
            // 使用模板字符串構建錯誤消息的 HTML
            body.innerHTML = `
<div style="color: red; padding: 20px; font-family: 'Nunito', sans-serif; background-color: #333; border-radius: 5px; margin: 20px auto; max-width: 800px; border: 1px solid #555;">
    <h2 style="margin-top: 0; color: #ff8a8a;">遊戲初始化失敗</h2>
    <p style="color: #eee;">糟糕！遊戲無法啟動。請檢查瀏覽器控制台 (按 F12) 以獲取詳細的錯誤信息。</p>
    <p style="color: #bbb; font-size: 0.9em;">錯誤詳情:</p>
    <pre style="background-color: #222; color: #ffc107; padding: 10px; border-radius: 3px; white-space: pre-wrap; word-wrap: break-word; max-height: 300px; overflow-y: auto;">${error.stack || error}</pre>
</div>`;
        }
    }
});
