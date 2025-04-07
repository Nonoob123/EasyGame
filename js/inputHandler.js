'use strict';
// 導入 simpleCollisionCheck 和 distanceSq, distanceSqValues
import { simpleCollisionCheck, distanceSq, distanceSqValues } from './utils.js';
// 導入勝利/結束畫面按鈕位置 (確保 ui.js 已導出)
import { winScreenButtons, endScreenButton } from './ui.js';

export class InputHandler {
    constructor(game) {
        this.game = game;
        this.keysPressed = game.keysPressed || {};
        this.touchActive = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchMoveX = 0;
        this.touchMoveY = 0;
        this.joystickRadius = 50;
        this.actionButtons = [];
        this.mouseX = undefined;
        this.mouseY = undefined;
        this.pendingBuildRequest = null; // 待處理的建造請求

        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleKeyUp = this._handleKeyUp.bind(this);
        this._handleClick = this._handleClick.bind(this);
        this._handleContextMenu = this._handleContextMenu.bind(this);
        this._handleTouchStart = this._handleTouchStart.bind(this);
        this._handleTouchMove = this._handleTouchMove.bind(this);
        this._handleTouchEnd = this._handleTouchEnd.bind(this);
        this._handleMouseMove = this._handleMouseMove.bind(this);
    }

    attachListeners() {
        document.addEventListener('keydown', this._handleKeyDown);
        document.addEventListener('keyup', this._handleKeyUp);
        this.game.canvas.addEventListener('click', this._handleClick);
        this.game.canvas.addEventListener('contextmenu', this._handleContextMenu);
        this.game.canvas.addEventListener('mousemove', this._handleMouseMove);
        const isTouchDevice = this.game.isTouchDevice();
        console.log('Is touch device:', isTouchDevice);
        if (isTouchDevice) {
            console.log('Attaching touch listeners');
            this.game.canvas.addEventListener('touchstart', this._handleTouchStart, { passive: false });
            this.game.canvas.addEventListener('touchmove', this._handleTouchMove, { passive: false });
            this.game.canvas.addEventListener('touchend', this._handleTouchEnd, { passive: false });
        } else {
            console.log('Not a touch device, skipping touch listeners');
        }
    }

    detachListeners() {
        document.removeEventListener('keydown', this._handleKeyDown);
        document.removeEventListener('keyup', this._handleKeyUp);
        this.game.canvas.removeEventListener('mousemove', this._handleMouseMove);
        if (this.game.canvas) {
            this.game.canvas.removeEventListener('click', this._handleClick);
            this.game.canvas.removeEventListener('contextmenu', this._handleContextMenu);
            if (this.game.isTouchDevice()) {
                console.log('Detaching touch listeners');
                this.game.canvas.removeEventListener('touchstart', this._handleTouchStart);
                this.game.canvas.removeEventListener('touchmove', this._handleTouchMove);
                this.game.canvas.removeEventListener('touchend', this._handleTouchEnd);
            }
        }
    }

    _handleMouseMove(event) {
        const rect = this.game.canvas.getBoundingClientRect();
        const scaleX = this.game.canvas.width / rect.width;
        const scaleY = this.game.canvas.height / rect.height;
        this.mouseX = (event.clientX - rect.left) * scaleX;
        this.mouseY = (event.clientY - rect.top) * scaleY;
    }

    // --- 統一的互動觸發邏輯 (修正：基於碰撞和距離判斷) ---
    _processInteraction() {
        const player = this.game.player;
        if (!player) return;

        let collidingShops = []; // 儲存與玩家碰撞的商店
        const interactionTolerance = 5; // 碰撞檢測的容差

        // 定義所有可互動的商店及其對應的玩家處理方法
        const shopsToCheck = [
            { shop: this.game.weaponShop, handler: player.handleWeaponShopInteraction },
            { shop: this.game.healingRoom, handler: player.handleHealingRoomInteraction },
            { shop: this.game.armorShop, handler: player.handleArmorShopInteraction },
            { shop: this.game.danceStudio, handler: player.handleDanceStudioInteraction },
            { shop: this.game.tradingPost, handler: player.tradeDiamond },
            { shop: this.game.skillInstitute, handler: null } // 技能研究所暫無處理方法
        ];

        // 檢查每個商店是否與玩家碰撞
        for (const { shop, handler } of shopsToCheck) {
            if (shop && simpleCollisionCheck(player, shop, interactionTolerance)) {
                collidingShops.push({ shop, handler });
            }
        }

        // 如果有多個碰撞的商店，選擇最近的一個
        if (collidingShops.length > 0) {
            let closestShop = collidingShops[0];
            let minDistSq = distanceSqValues(
                player.x + player.width / 2, 
                player.y + player.height / 2,
                closestShop.shop.x + closestShop.shop.width / 2,
                closestShop.shop.y + closestShop.shop.height / 2
            );

            for (let i = 1; i < collidingShops.length; i++) {
                const distSq = distanceSqValues(
                    player.x + player.width / 2, 
                    player.y + player.height / 2,
                    collidingShops[i].shop.x + collidingShops[i].shop.width / 2,
                    collidingShops[i].shop.y + collidingShops[i].shop.height / 2
                );
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    closestShop = collidingShops[i];
                }
            }

            // 調用對應的處理方法
            if (typeof closestShop.handler === 'function') {
                // 傳遞 game 對象給處理方法
                closestShop.handler.call(player, this.game);
            } else {
                console.warn('商店互動處理方法未定義:', closestShop.shop);
            }
        }
    }


    _handleKeyDown(event) {
        // 在遊戲結束或勝利狀態下，只允許特定按鍵 (例如 F5)
        if (this.game.gameState !== 'running' && !['F5', 'F12'].includes(event.key)) {
             event.preventDefault(); // 阻止其他按鍵行為
             return;
        }
        const key = event.key.toLowerCase();
        this.keysPressed[key] = true;
        if (this.game.keysPressed) this.game.keysPressed[key] = true;

        if (event.code === 'Space' && this.game.player) {
            event.preventDefault();
            let inputDx = 0, inputDy = 0;
            if (this.keysPressed['w']) inputDy -= 1;
            if (this.keysPressed['s']) inputDy += 1;
            if (this.keysPressed['a']) inputDx -= 1;
            if (this.keysPressed['d']) inputDx += 1;
            this.game.player.startDash(inputDx, inputDy);
        } else if (key === 'e' && this.game.player) {
            event.preventDefault();
            this._processInteraction(); // 調用統一的互動處理邏輯

        } else if (['1', '2', '3', '4'].includes(key) && this.game.player && this.game.skillInstitute) {
            const player = this.game.player;
            const institute = this.game.skillInstitute;
            // 技能升級需要靠近研究所
            const radius = institute.interactionRadius || (institute.width * 1.5);
            if (distanceSq(player, institute) < radius ** 2) { // 技能升級仍可基於中心點
                event.preventDefault();
                const skillIndex = parseInt(key);
                player.attemptSkillUpgrade(skillIndex, this.game);
            }
        }

        // 阻止移動和衝刺鍵的默認行為
        if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            event.preventDefault();
        }
    }

    _handleKeyUp(event) {
        const key = event.key.toLowerCase();
        this.keysPressed[key] = false;
        if (this.game.keysPressed) this.game.keysPressed[key] = false;
    }

    _handleTouchStart(event) {
        event.preventDefault();
        if (!event.touches || event.touches.length === 0) {
            console.log('Touch start: No touches detected');
            return;
        }

        const touch = event.touches[0];
        const rect = this.game.canvas.getBoundingClientRect();
        const scaleX = this.game.canvas.width / rect.width;
        const scaleY = this.game.canvas.height / rect.height;
        const touchX = (touch.clientX - rect.left) * scaleX;
        const touchY = (touch.clientY - rect.top) * scaleY;

        //console.log('Touch start:', { x: touchX, y: touchY, scaleX, scaleY, rect });

        // --- 檢查勝利畫面按鈕觸控 ---
        if (this.game.gameState === 'won') {
            const continueBtn = winScreenButtons.continue;
            if (continueBtn && touchX >= continueBtn.x && touchX <= continueBtn.x + continueBtn.width &&
                touchY >= continueBtn.y && touchY <= continueBtn.y + continueBtn.height) {
                console.log("觸控了 繼續遊戲");
                this.game.gameState = 'running';
                if (this.game.goalCharacter) this.game.goalCharacter.active = false;
                if (this.game.player) {
                    this.game.player.hasMetGoalCharacter = false;
                    this.game.player.carryingTrophy = false;
                    this.game.player.trophyReference = null;
                }
                this.touchActive = false;
                return;
            }
            const endBtn = winScreenButtons.end;
            if (endBtn && touchX >= endBtn.x && touchX <= endBtn.x + endBtn.width &&
                touchY >= endBtn.y && touchY <= endBtn.y + endBtn.height) {
                console.log("觸控了 結束遊戲");
                this.game.gameState = 'ended';
                this.touchActive = false;
                return;
            }
             return;
        }
        // --- 如果遊戲已結束，檢查是否點擊重新開始按鈕 ---
        if (this.game.gameState === 'ended') {
            if (endScreenButton && touchX >= endScreenButton.x && touchX <= endScreenButton.x + endScreenButton.width &&
                touchY >= endScreenButton.y && touchY <= endScreenButton.y + endScreenButton.height) {
                console.log("觸控了 重新開始");
                this.game.init();
            }
            this.touchActive = false;
            return;
        }

        // --- 遊戲運行狀態下的觸控處理 ---
        this.touchActive = true;
        this.touchStartX = touchX;
        this.touchStartY = touchY;
        this.touchMoveX = touchX;
        this.touchMoveY = touchY;

        let buttonClicked = false;
        // 檢查遊戲內動作按鈕
        for (const btn of this.actionButtons) {
            const dx = touchX - btn.cx;
            const dy = touchY - btn.cy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= btn.r) {
                console.log('Button clicked:', btn.label);
                this.keysPressed[btn.key] = true; // 模擬按鍵按下
                if (this.game.keysPressed) this.game.keysPressed[btn.key] = true;

                if (btn.key === ' ' && this.game.player) {
                    let inputDx = 0, inputDy = 0;
                    if (this.keysPressed['w']) inputDy -= 1;
                    if (this.keysPressed['s']) inputDy += 1;
                    if (this.keysPressed['a']) inputDx -= 1;
                    if (this.keysPressed['d']) inputDx += 1;
                    this.game.player.startDash(inputDx, inputDy);
                } else if (btn.key === 'e' && this.game.player) {
                    this._processInteraction(); // <--- 調用修正後的互動邏輯
                }
                // 觸控不需要延遲釋放按鍵狀態，在 touchend 中處理
                buttonClicked = true;
                break; // 一次觸控只點擊一個按鈕
            }
        }

        // 檢查技能升級選項觸控 (只有靠近研究所時才有效)
        if (this.game.player && this.game.skillInstitute) {
            const institute = this.game.skillInstitute;
            const radius = institute.interactionRadius || (institute.width * 1.5);
            if (distanceSq(this.game.player, institute) < radius ** 2) { // 技能升級仍可基於中心點
            const optionHeight = 40, optionWidth = 200, spacing = 10;
            const startY = this.game.canvas.height / 2 - (optionHeight * 2 + spacing * 1.5);
            const startX = this.game.canvas.width / 2 - optionWidth / 2;
            for (let i = 0; i < 4; i++) {
                const y = startY + i * (optionHeight + spacing);
                if (touchX >= startX && touchX <= startX + optionWidth &&
                    touchY >= y && touchY <= y + optionHeight) {
                    console.log('Skill option clicked:', i + 1);
                    const skillIndex = i + 1;
                    this.game.player.attemptSkillUpgrade(skillIndex, this.game);
                    this.touchActive = false; // 點擊技能選項後結束觸控
                    buttonClicked = true; // 標記為按鈕點擊，避免觸發移動
                    return;
                }
            }
        }
        }

        // 如果沒有點擊任何按鈕或技能選項，則認為是開始移動
        if (!buttonClicked) {
            console.log('Touch start for movement');
        }
    }

    _handleTouchMove(event) {
        event.preventDefault();
        // 只在遊戲運行狀態下處理移動
        if (!this.touchActive || this.game.gameState !== 'running') {
            return;
        }

        if (!event.touches || event.touches.length === 0) {
            console.log('Touch move: No touches detected');
            return;
        }

        const touch = event.touches[0];
        const rect = this.game.canvas.getBoundingClientRect();
        const scaleX = this.game.canvas.width / rect.width;
        const scaleY = this.game.canvas.height / rect.height;
        this.touchMoveX = (touch.clientX - rect.left) * scaleX;
        this.touchMoveY = (touch.clientY - rect.top) * scaleY;

        const dx = this.touchMoveX - this.touchStartX;
        const dy = this.touchMoveY - this.touchStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const threshold = 10; // 移動閾值

        // 根據搖桿位置更新按鍵狀態
        this.keysPressed['w'] = dy < -threshold && distance > threshold;
        this.keysPressed['s'] = dy > threshold && distance > threshold;
        this.keysPressed['a'] = dx < -threshold && distance > threshold;
        this.keysPressed['d'] = dx > threshold && distance > threshold;
        // 同步到 game.keysPressed
        Object.keys(this.keysPressed).forEach(key => {
            if (['w', 'a', 's', 'd'].includes(key)) {
                 this.game.keysPressed[key] = this.keysPressed[key];
            }
        });
    }

    _handleTouchEnd(event) {
        event.preventDefault();
        console.log('Touch end');
        this.touchActive = false;
        // 釋放所有移動鍵和動作鍵
        this.keysPressed['w'] = false;
        this.keysPressed['s'] = false;
        this.keysPressed['a'] = false;
        this.keysPressed['d'] = false;
        this.keysPressed['e'] = false; // 確保釋放動作鍵
        this.keysPressed[' '] = false; // 確保釋放衝刺鍵
        // 同步到 game.keysPressed
        Object.keys(this.keysPressed).forEach(key => {
            if (this.game.keysPressed) this.game.keysPressed[key] = false;
        });
    }

    _handleClick(event) {
        event.preventDefault();
        
        // 獲取點擊在 Canvas 上的坐標
        const rect = this.game.canvas.getBoundingClientRect();
        const scaleX = this.game.canvas.width / rect.width;
        const scaleY = this.game.canvas.height / rect.height;
        const clickX = (event.clientX - rect.left) * scaleX;
        const clickY = (event.clientY - rect.top) * scaleY;
        
        // 處理遊戲勝利畫面的按鈕點擊
        if (this.game.gameState === 'won' && winScreenButtons) {
            // 檢查"繼續遊戲"按鈕
            if (winScreenButtons.continue && 
                clickX >= winScreenButtons.continue.x && 
                clickX <= winScreenButtons.continue.x + winScreenButtons.continue.width &&
                clickY >= winScreenButtons.continue.y && 
                clickY <= winScreenButtons.continue.y + winScreenButtons.continue.height) {
                console.log("點擊了'繼續遊戲'按鈕");
                this.game.restart();
                return;
            }
            
            // 檢查"結束遊戲"按鈕
            if (winScreenButtons.end && 
                clickX >= winScreenButtons.end.x && 
                clickX <= winScreenButtons.end.x + winScreenButtons.end.width &&
                clickY >= winScreenButtons.end.y && 
                clickY <= winScreenButtons.end.y + winScreenButtons.end.height) {
                console.log("點擊了'結束遊戲'按鈕");
                // 這裡可以添加結束遊戲的邏輯，例如返回主菜單
                window.location.reload(); // 簡單地重新加載頁面
                return;
            }
        }
        
        // 處理遊戲結束畫面的重新開始按鈕點擊
        if (this.game.gameState === 'ended' && endScreenButton) {
            if (clickX >= endScreenButton.x && 
                clickX <= endScreenButton.x + endScreenButton.width &&
                clickY >= endScreenButton.y && 
                clickY <= endScreenButton.y + endScreenButton.height) {
                console.log("點擊了'重新開始'按鈕");
                this.game.restart();
                return;
            }
        }
        
        // 如果遊戲正在運行，處理其他點擊邏輯
        if (this.game.gameState === 'running') {
            // 檢查技能升級選項點擊 (只有靠近研究所時才有效)
            if (this.game.player && this.game.skillInstitute) {
                const institute = this.game.skillInstitute;
                const radius = institute.interactionRadius || (institute.width * 1.5);
                if (distanceSq(this.game.player, institute) < radius ** 2) {
                    const optionHeight = 40, optionWidth = 200, spacing = 10;
                    const startY = this.game.canvas.height / 2 - (optionHeight * 2 + spacing * 1.5);
                    const startX = this.game.canvas.width / 2 - optionWidth / 2;
                    for (let i = 0; i < 4; i++) {
                        const y = startY + i * (optionHeight + spacing);
                        if (clickX >= startX && clickX <= startX + optionWidth &&
                            clickY >= y && clickY <= y + optionHeight) {
                            console.log('Skill option clicked:', i + 1);
                            const skillIndex = i + 1;
                            this.game.player.attemptSkillUpgrade(skillIndex, this.game);
                            return;
                        }
                    }
                }
            }
        }
    }

    _handleContextMenu(event) {
        // 只在遊戲運行狀態下處理右鍵點擊
        if (this.game.gameState !== 'running') {
             event.preventDefault();
              return;
         }
         // 記錄建造塔請求
         event.preventDefault();
         const rect = this.game.canvas.getBoundingClientRect();
         const scaleX = this.game.canvas.width / rect.width;
         const scaleY = this.game.canvas.height / rect.height;
         const canvasX = (event.clientX - rect.left) * scaleX;
         const canvasY = (event.clientY - rect.top) * scaleY;
         const worldX = (canvasX / this.game.constants.CAMERA_ZOOM) + this.game.camera.x;
         const worldY = (canvasY / this.game.constants.CAMERA_ZOOM) + this.game.camera.y;
         this.pendingBuildRequest = { type: 'tower', x: worldX, y: worldY };
         console.log("記錄建造塔請求:", this.pendingBuildRequest);
     }

     // --- REMOVED _convertAndBuild method ---

     draw(ctx) {
        // 只在遊戲運行狀態下繪製搖桿和動作按鈕
        if (this.game.gameState !== 'running') return;

        // 繪製搖桿
        if (this.game.isTouchDevice() && this.touchActive) {
            ctx.save();
            ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
            ctx.beginPath();
            ctx.arc(this.touchStartX, this.touchStartY, this.joystickRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            // 限制搖桿頭部在半徑內
            const dx = this.touchMoveX - this.touchStartX;
            const dy = this.touchMoveY - this.touchStartY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const clampedX = distance > this.joystickRadius ? this.touchStartX + (dx / distance) * this.joystickRadius : this.touchMoveX;
            const clampedY = distance > this.joystickRadius ? this.touchStartY + (dy / distance) * this.joystickRadius : this.touchMoveY;
            ctx.arc(clampedX, clampedY, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 繪製動作按鈕
        const canvas = this.game.canvas;
        const btnRadius = 30;
        const spacing = 20;
        const margin = 20;
        const cx = canvas.width - btnRadius - margin;
        this.actionButtons = [
            { cx: cx, cy: canvas.height - btnRadius - margin, r: btnRadius, key: ' ', label: '衝刺' },
            { cx: cx, cy: canvas.height - btnRadius * 3 - spacing - margin, r: btnRadius, key: 'e', label: '互動' }, // 標籤改為互動
        ];

        ctx.save();
        this.actionButtons.forEach(btn => {
            let isHighlighted = false;
            // 檢查高亮 (滑鼠)
            if (!this.game.isTouchDevice() && this.mouseX !== undefined && this.mouseY !== undefined) {
                const dx = this.mouseX - btn.cx;
                const dy = this.mouseY - btn.cy;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= btn.r) isHighlighted = true;
            }
            // 檢查高亮 (觸控 - 僅在 touchStart 時檢查，這裡只繪製視覺效果)
            // 注意：觸控高亮邏輯可能需要在 touchStart 中處理更精確

            // 繪製按鈕背景
            ctx.fillStyle = this.keysPressed[btn.key] ? 'rgba(136, 136, 136, 0.8)' : 'rgba(85, 85, 85, 0.8)';
            ctx.beginPath();
            ctx.arc(btn.cx, btn.cy, btn.r, 0, Math.PI * 2);
            ctx.fill();

            // 繪製高亮邊框
            if (isHighlighted) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(btn.cx, btn.cy, btn.r, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 繪製按鈕文字
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.label, btn.cx, btn.cy);
        });
        ctx.restore();
    }
}
