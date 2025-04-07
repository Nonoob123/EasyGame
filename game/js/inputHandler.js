'use strict';
// 導入 simpleCollisionCheck 和 distanceSq
import { simpleCollisionCheck, distanceSq } from './utils.js';
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

    _handleKeyDown(event) {
        // 在遊戲結束或勝利狀態下，只允許特定按鍵 (例如 F5)
        if (this.game.gameState !== 'running' && !['F5', 'F12'].includes(event.key)) {
             event.preventDefault(); // 阻止其他按鍵行為
             return;
        }
        // if (!this.game.gameRunning && !['F5', 'F12'].includes(event.key)) return; // 舊的檢查方式
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
            // --- 互動邏輯 ('E' 鍵) ---
            const player = this.game.player;
            let interacted = false; // 標記是否已與商店互動

            // 檢查防具店
            const armorShop = this.game.armorShop;
            if (armorShop && distanceSq(player, armorShop) < armorShop.interactionRadius ** 2) {
                if (armorShop.upgradePlayer(player)) {
                    // 升級成功，描述已在 upgradePlayer 中更新
                    this.game.setMessage(`防具店: ${armorShop.description}`, 2000);
                } else {
                    // 升級失敗，顯示原因 (已滿級或金幣不足)
                    this.game.setMessage(`防具店: ${armorShop.description}`, 1500);
                }
                interacted = true;
            }
            // 檢查舞蹈室 (如果未與防具店互動)
            const danceStudio = this.game.danceStudio;
            if (!interacted && danceStudio && distanceSq(player, danceStudio) < danceStudio.interactionRadius ** 2) {
                if (danceStudio.upgradePlayer(player)) {
                    this.game.setMessage(`舞蹈室: ${danceStudio.description}`, 2000);
                } else {
                    this.game.setMessage(`舞蹈室: ${danceStudio.description}`, 1500);
                }
                interacted = true;
            }

            // 如果沒有與商店互動，則執行砍樹
            if (!interacted) {
                player.collectTree(this.game);
            }

        } else if (['1', '2', '3', '4'].includes(key) && this.game.player && this.game.skillInstitute) {
            const player = this.game.player;
            const institute = this.game.skillInstitute;
            if (simpleCollisionCheck(player, institute)) {
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

        console.log('Touch start:', { x: touchX, y: touchY, scaleX, scaleY, rect });

        // --- 檢查勝利畫面按鈕觸控 ---
        if (this.game.gameState === 'won') {
            // 檢查繼續遊戲按鈕
            const continueBtn = winScreenButtons.continue;
            if (continueBtn && touchX >= continueBtn.x && touchX <= continueBtn.x + continueBtn.width &&
                touchY >= continueBtn.y && touchY <= continueBtn.y + continueBtn.height) {
                console.log("觸控了 繼續遊戲");
                this.game.gameState = 'running';
                if (this.game.goalCharacter) {
                    this.game.goalCharacter.active = false; // 讓目標角色消失
                    // this.game.goalCharacter = null; // 或者直接移除引用
                }
                if (this.game.player) {
                    this.game.player.hasMetGoalCharacter = false; // 重置玩家狀態
                    this.game.player.carryingTrophy = false; // 移除獎盃
                    this.game.player.trophyReference = null; // 清除獎盃引用
                }
                this.touchActive = false; // 結束觸控處理
                return; // 處理完畢
            }
            // 檢查結束遊戲按鈕
            const endBtn = winScreenButtons.end;
            if (endBtn && touchX >= endBtn.x && touchX <= endBtn.x + endBtn.width &&
                touchY >= endBtn.y && touchY <= endBtn.y + endBtn.height) {
                console.log("觸控了 結束遊戲");
                this.game.gameState = 'ended';
                this.touchActive = false; // 結束觸控處理
                return; // 處理完畢
            }
             // 如果觸控了勝利畫面但沒點中按鈕，也阻止後續處理
             // this.touchActive = false; // 不需要設置 false
             return; // 阻止觸控穿透到遊戲內元素
        }
        // --- 如果遊戲已結束，檢查是否點擊重新開始按鈕 ---
        if (this.game.gameState === 'ended') {
            if (endScreenButton && touchX >= endScreenButton.x && touchX <= endScreenButton.x + endScreenButton.width &&
                touchY >= endScreenButton.y && touchY <= endScreenButton.y + endScreenButton.height) {
                console.log("觸控了 重新開始");
                this.game.init(); // 重新初始化遊戲
                // 不需要設置 gameState，init 會處理
            }
            this.touchActive = false; // 結束觸控處理
            return; // 處理完畢
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
                this.keysPressed[btn.key] = true;
                this.game.keysPressed[btn.key] = true;
                if (btn.key === ' ' && this.game.player) {
                    let inputDx = 0, inputDy = 0;
                    if (this.keysPressed['w']) inputDy -= 1;
                    if (this.keysPressed['s']) inputDy += 1;
                    if (this.keysPressed['a']) inputDx -= 1;
                    if (this.keysPressed['d']) inputDx += 1;
                    this.game.player.startDash(inputDx, inputDy);
                } else if (btn.key === 'e' && this.game.player) {
                    // --- 觸控/點擊互動邏輯 ('E' 按鈕) ---
                    const player = this.game.player;
                    let interacted = false;
                    // 檢查防具店
                    const armorShop = this.game.armorShop;
                    if (armorShop && distanceSq(player, armorShop) < armorShop.interactionRadius ** 2) {
                        if (armorShop.upgradePlayer(player)) {
                            this.game.setMessage(`防具店: ${armorShop.description}`, 2000);
                        } else {
                            this.game.setMessage(`防具店: ${armorShop.description}`, 1500);
                        }
                        interacted = true;
                    }
                    // 檢查舞蹈室
                    const danceStudio = this.game.danceStudio;
                    if (!interacted && danceStudio && distanceSq(player, danceStudio) < danceStudio.interactionRadius ** 2) {
                        if (danceStudio.upgradePlayer(player)) {
                            this.game.setMessage(`舞蹈室: ${danceStudio.description}`, 2000);
                        } else {
                            this.game.setMessage(`舞蹈室: ${danceStudio.description}`, 1500);
                        }
                        interacted = true;
                    }
                    // 砍樹
                    if (!interacted) {
                        player.collectTree(this.game);
                    }
                }
                // 短暫按下效果 (觸控不需要延遲釋放)
                // setTimeout(() => {
                //     this.keysPressed[btn.key] = false;
                //     this.game.keysPressed[btn.key] = false;
                // }, 100);
                buttonClicked = true;
            }
        }

        // 檢查技能升級選項觸控
        if (this.game.player && this.game.skillInstitute && simpleCollisionCheck(this.game.player, this.game.skillInstitute)) {
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
                    return;
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
            // console.log('Touch move skipped: touchActive is false or game not running');
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

        // console.log('Touch move:', { x: this.touchMoveX, y: this.touchMoveY }); // 減少日誌

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
            if (['w', 'a', 's', 'd'].includes(key)) { // 只同步移動鍵
                 this.game.keysPressed[key] = this.keysPressed[key];
            }
        });

        // console.log('Movement keys:', this.keysPressed); // 減少日誌
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
            this.game.keysPressed[key] = this.keysPressed[key];
        });
    }

    _handleClick(event) {
        // 檢查遊戲狀態，只在運行或勝利時處理點擊
        if (this.game.gameState === 'ended' || !this.game.player || !this.game.canvas) return;

        const rect = this.game.canvas.getBoundingClientRect();
        const scaleX = this.game.canvas.width / rect.width;
        const scaleY = this.game.canvas.height / rect.height;
        const clickX = (event.clientX - rect.left) * scaleX;
        const clickY = (event.clientY - rect.top) * scaleY;

        // --- 檢查勝利畫面按鈕點擊 ---
        if (this.game.gameState === 'won') {
            // 檢查繼續遊戲按鈕
            const continueBtn = winScreenButtons.continue;
            if (continueBtn && clickX >= continueBtn.x && clickX <= continueBtn.x + continueBtn.width &&
                clickY >= continueBtn.y && clickY <= continueBtn.y + continueBtn.height) {
                console.log("點擊了 繼續遊戲");
                this.game.gameState = 'running'; // 恢復遊戲運行
                if (this.game.goalCharacter) {
                    this.game.goalCharacter.active = false; // 讓目標角色消失
                    // this.game.goalCharacter = null; // 或者直接移除引用 (setting active=false is enough)
                }
                if (this.game.player) {
                    this.game.player.hasMetGoalCharacter = false; // 重置玩家狀態
                    this.game.player.carryingTrophy = false; // 移除獎盃
                    this.game.player.trophyReference = null; // 清除獎盃引用
                }
                return; // 處理完畢，退出函數
            }
            // 檢查結束遊戲按鈕
            const endBtn = winScreenButtons.end;
            if (endBtn && clickX >= endBtn.x && clickX <= endBtn.x + endBtn.width &&
                clickY >= endBtn.y && clickY <= endBtn.y + endBtn.height) {
                console.log("點擊了 結束遊戲");
                this.game.gameState = 'ended'; // 設置為結束狀態
                return; // 處理完畢，退出函數
            }
            // 如果點擊了勝利畫面但沒點中按鈕，也阻止後續處理
            return;
        }
        // --- 如果遊戲已結束，檢查是否點擊重新開始按鈕 ---
        if (this.game.gameState === 'ended') {
            if (endScreenButton && clickX >= endScreenButton.x && clickX <= endScreenButton.x + endScreenButton.width &&
                clickY >= endScreenButton.y && clickY <= endScreenButton.y + endScreenButton.height) {
                console.log("點擊了 重新開始");
                this.game.init(); // 重新初始化遊戲
                // 不需要設置 gameState，init 會處理
            }
            return; // 處理完畢
        }

        // --- 遊戲運行狀態下的點擊處理 ---
        if (this.game.gameState === 'running') {
            // 檢查遊戲內動作按鈕點擊
            for (const btn of this.actionButtons) {
                const dx = clickX - btn.cx;
                const dy = clickY - btn.cy;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= btn.r) {
                    this.keysPressed[btn.key] = true;
                    this.game.keysPressed[btn.key] = true;
                    if (btn.key === ' ' && this.game.player) {
                        let inputDx = 0, inputDy = 0;
                        if (this.keysPressed['w']) inputDy -= 1;
                        if (this.keysPressed['s']) inputDy += 1;
                        if (this.keysPressed['a']) inputDx -= 1;
                        if (this.keysPressed['d']) inputDx += 1;
                        this.game.player.startDash(inputDx, inputDy);
                    } else if (btn.key === 'e' && this.game.player) {
                        // --- 觸控/點擊互動邏輯 ('E' 按鈕) ---
                        const player = this.game.player;
                        let interacted = false;
                         // 檢查防具店
                        const armorShop = this.game.armorShop;
                        if (armorShop && distanceSq(player, armorShop) < armorShop.interactionRadius ** 2) {
                            if (armorShop.upgradePlayer(player)) {
                                this.game.setMessage(`防具店: ${armorShop.description}`, 2000);
                            } else {
                                this.game.setMessage(`防具店: ${armorShop.description}`, 1500);
                            }
                            interacted = true;
                        }
                        // 檢查舞蹈室
                        const danceStudio = this.game.danceStudio;
                        if (!interacted && danceStudio && distanceSq(player, danceStudio) < danceStudio.interactionRadius ** 2) {
                            if (danceStudio.upgradePlayer(player)) {
                                this.game.setMessage(`舞蹈室: ${danceStudio.description}`, 2000);
                            } else {
                                this.game.setMessage(`舞蹈室: ${danceStudio.description}`, 1500);
                            }
                            interacted = true;
                        }
                        // 砍樹
                        if (!interacted) {
                            player.collectTree(this.game);
                        }
                    }
                     // 短暫按下效果
                    setTimeout(() => {
                        this.keysPressed[btn.key] = false;
                        this.game.keysPressed[btn.key] = false;
                    }, 100);
                    return; // 處理完畢
                }
            }

            // 檢查技能升級選項點擊
            if (this.game.player && this.game.skillInstitute && simpleCollisionCheck(this.game.player, this.game.skillInstitute)) {
                const optionHeight = 40, optionWidth = 200, spacing = 10;
                const startY = this.game.canvas.height / 2 - (optionHeight * 2 + spacing * 1.5);
                const startX = this.game.canvas.width / 2 - optionWidth / 2;
                for (let i = 0; i < 4; i++) {
                    const y = startY + i * (optionHeight + spacing);
                    if (clickX >= startX && clickX <= startX + optionWidth &&
                        clickY >= y && clickY <= y + optionHeight) {
                        const skillIndex = i + 1;
                        this.game.player.attemptSkillUpgrade(skillIndex, this.game);
                        return; // 處理完畢
                    }
                }
            }

            // 如果點擊未命中任何按鈕或選項，則視為建造柵欄
            this._convertAndBuild(event, this.game.buildFence);
        }
    }

    _handleContextMenu(event) {
        // 只在遊戲運行狀態下處理右鍵點擊
        if (this.game.gameState !== 'running') {
             event.preventDefault();
             return;
        }
        this._convertAndBuild(event, this.game.buildTower);
    }

    _convertAndBuild(event, buildFunction) {
        // 確保遊戲正在運行
        if (this.game.gameState !== 'running' || !this.game.player || !this.game.canvas) return;
        event.preventDefault();
        const rect = this.game.canvas.getBoundingClientRect();
        const scaleX = this.game.canvas.width / rect.width;
        const scaleY = this.game.canvas.height / rect.height;
        const canvasX = (event.clientX - rect.left) * scaleX;
        const canvasY = (event.clientY - rect.top) * scaleY;
        const worldX = (canvasX / this.game.constants.CAMERA_ZOOM) + this.game.camera.x;
        const worldY = (canvasY / this.game.constants.CAMERA_ZOOM) + this.game.camera.y;
        buildFunction.call(this.game, worldX, worldY);
    }

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
