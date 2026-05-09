// ==UserScript==
// @name         Boosteroid Tweaks
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Блокировка серверов и Anti-AFK (Steam Remote Play) для Boosteroid
// @author       You
// @match        *://*.boosteroid.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // === НАСТРОЙКИ ===
    const defaultSettings = {
        antiAfk: false,
        blockedServers: [],
        language: '',
        statsMode: 0,
        showPerfRating: true
    };

    let settings = Object.assign({}, defaultSettings, JSON.parse(GM_getValue('boosteroid_settings', JSON.stringify(defaultSettings))));

    function saveSettings() {
        GM_setValue('boosteroid_settings', JSON.stringify(settings));
    }

    const i18n = {
        'en': { title: 'Boosteroid Tweaks', antiAfk: 'Anti-AFK (Steam Remote)', lastServer: 'Last server (auto-detect):', waiting: 'Waiting...', block: 'Block', blockedList: 'Blocked servers (IP or domain):', placeholder: 'e.g. sh1.boosteroid.com', add: 'Add', statsTitle: 'Better Stats (Overlay)', statsOff: 'Off', statsMin: 'Minimal', statsFull: 'Detailed', perfRating: 'Performance Rating', ratingExc: 'Excellent', ratingGood: 'Good', ratingPoor: 'Poor', ratingBad: 'Bad' },
        'ru': { title: 'Boosteroid Tweaks', antiAfk: 'Anti-AFK (Steam Remote)', lastServer: 'Последний сервер (автоопределение):', waiting: 'Ожидание...', block: 'Блок', blockedList: 'Заблокированные сервера (IP или домен):', placeholder: 'Например: sh1.boosteroid.com', add: 'Добавить', statsTitle: 'Оверлей статистики', statsOff: 'Выкл', statsMin: 'Минимум', statsFull: 'Детально', perfRating: 'Оценка производительности', ratingExc: 'Отлично', ratingGood: 'Хорошо', ratingPoor: 'Плохо', ratingBad: 'Ужасно' },
        'uk': { title: 'Boosteroid Tweaks', antiAfk: 'Anti-AFK (Steam Remote)', lastServer: 'Останній сервер (автовизначення):', waiting: 'Очікування...', block: 'Блок', blockedList: 'Заблоковані сервери (IP або домен):', placeholder: 'Наприклад: sh1.boosteroid.com', add: 'Додати', statsTitle: 'Оверлей статистики', statsOff: 'Вимк', statsMin: 'Мінімум', statsFull: 'Детально', perfRating: 'Оцінка продуктивності', ratingExc: 'Відмінно', ratingGood: 'Добре', ratingPoor: 'Погано', ratingBad: 'Жахливо' },
        'es': { title: 'Boosteroid Tweaks', antiAfk: 'Anti-AFK (Steam Remote)', lastServer: 'Último servidor (autodetectado):', waiting: 'Esperando...', block: 'Bloquear', blockedList: 'Servidores bloqueados (IP o dominio):', placeholder: 'Ejemplo: sh1.boosteroid.com', add: 'Añadir', statsTitle: 'Mejores Estadísticas', statsOff: 'Apagado', statsMin: 'Mínimo', statsFull: 'Detallado', perfRating: 'Calificación de rendimiento', ratingExc: 'Excelente', ratingGood: 'Bueno', ratingPoor: 'Pobre', ratingBad: 'Malo' }
    };

    let currentLang = settings.language;
    if (!currentLang) {
        const navLang = navigator.language.toLowerCase();
        if (navLang.startsWith('ru')) currentLang = 'ru';
        else if (navLang.startsWith('uk')) currentLang = 'uk';
        else if (navLang.startsWith('es')) currentLang = 'es';
        else currentLang = 'en';
    }

    function t(key) {
        return i18n[currentLang][key] || i18n['en'][key];
    }

    let lastDetectedServer = null;

    // === ПЕРЕХВАТ СЕТИ (БЛОКИРОВКА СЕРВЕРОВ) ===
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const urlObj = new URL(url);
        const host = urlObj.hostname;

        const isBlocked = settings.blockedServers.some(blockedItem => host.includes(blockedItem));

        if (isBlocked) {
            console.warn(`[Boosteroid Tweaks] Заблокировано подключение к WebSocket: ${host}`);
            // Выбрасываем ошибку, чтобы разорвать соединение на этапе инициализации
            throw new Error(`[Boosteroid Tweaks] Connection to ${host} blocked by user settings.`);
        }

        // Автоопределение сервера
        if (host && host.includes('boosteroid.com')) {
            lastDetectedServer = host;
            if (window.renderPanelGlobal) {
                window.renderPanelGlobal();
            }
        }

        let ws;
        if (protocols === undefined) {
            ws = new OriginalWebSocket(url);
        } else {
            ws = new OriginalWebSocket(url, protocols);
        }

        if (settings.antiAfk) {
            const wsPropDescriptor = Object.getOwnPropertyDescriptor(OriginalWebSocket.prototype, 'onmessage');
            if (wsPropDescriptor) {
                Object.defineProperty(ws, 'onmessage', {
                    get: function() {
                        return wsPropDescriptor.get.call(this);
                    },
                    set: function(handler) {
                        const wrappedHandler = function(evt) {
                            try {
                                if (typeof evt.data === 'string' && evt.data.includes('"action":"activity"')) {
                                    const msg = JSON.parse(evt.data);
                                    if (msg.type === 'message' && msg.action === 'activity') {
                                        console.log('[Boosteroid Tweaks] 🔥 Перехвачено AFK предупреждение от сервера!');
                                        
                                        if (ws.readyState === OriginalWebSocket.OPEN) {
                                            ws.send(JSON.stringify({
                                                type: "settings",
                                                action: "activity",
                                                value: "I am here"
                                            }));
                                            console.log('[Boosteroid Tweaks] ✅ Успешно отправлен автоответ "I am here". Окно не появится.');
                                        }
                                        
                                        // Блокируем оригинальный обработчик, чтобы окно не появилось на экране и звук не проигрался
                                        return;
                                    }
                                }
                            } catch(e) {}
                            
                            return handler ? handler.call(this, evt) : null;
                        };
                        wsPropDescriptor.set.call(this, wrappedHandler);
                    }
                });
            }
        }

        return ws;
    };
    
    // Перехватем также RTCPeerConnection на всякий случай, если сигналинг происходит не по WS, 
    // но обычно для видео-стримов IP адрес определяется при создании PeerConnection
    let currentPeerConnection = null;
    const OriginalRTCPeerConnection = window.RTCPeerConnection;
    window.RTCPeerConnection = function(configuration) {
        // Мы не можем легко заблокировать по IP в RTCPeerConnection до получения ICE кандидатов,
        // но основное подключение к серверу Boosteroid идёт через WebSocket для сигналинга, 
        // так что блокировки WS обычно достаточно, чтобы отменить сессию на "плохом" сервере.
        const pc = new OriginalRTCPeerConnection(configuration);
        currentPeerConnection = pc;
        return pc;
    };


    // === ANTI-AFK ===
    // 1. Подмена Gamepad API (облачные сервисы доверяют геймпадам)
    const originalGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;
    let fakeGamepadActive = false;
    
    if (originalGetGamepads) {
        navigator.getGamepads = function() {
            const gamepads = originalGetGamepads();
            if (settings.antiAfk && fakeGamepadActive) {
                const pads = Array.from(gamepads);
                if (!pads[0]) {
                    pads[0] = {
                        axes: [0, 0, 0, 0],
                        buttons: Array(17).fill({ pressed: false, touched: false, value: 0 }),
                        connected: true,
                        id: "Standard Gamepad (Vendor: 0000 Product: 0000)",
                        index: 0,
                        mapping: "standard",
                        timestamp: performance.now()
                    };
                }
                // Микро-отклонение стика, чтобы обмануть таймер
                pads[0].axes[0] = 0.05;
                pads[0].timestamp = performance.now();
                return pads;
            }
            return gamepads;
        };
    }

    // 2. Блокировка событий потери фокуса (чтобы Boosteroid не открывал меню при Alt-Tab)
    ['blur', 'visibilitychange', 'pagehide', 'mouseout', 'mouseleave'].forEach(evt => {
        window.addEventListener(evt, (e) => {
            if (settings.antiAfk) {
                e.stopImmediatePropagation();
                e.stopPropagation();
            }
        }, true); // перехват на фазе погружения
    });

    const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    const originalVisibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    const originalHasFocus = Object.getOwnPropertyDescriptor(Document.prototype, 'hasFocus');

    if (originalHidden) {
        Object.defineProperty(document, 'hidden', {
            get: function() { return settings.antiAfk ? false : originalHidden.get.call(this); }
        });
    }
    if (originalVisibility) {
        Object.defineProperty(document, 'visibilityState', {
            get: function() { return settings.antiAfk ? 'visible' : originalVisibility.get.call(this); }
        });
    }
    if (originalHasFocus) {
        Object.defineProperty(document, 'hasFocus', {
            get: function() { return settings.antiAfk ? true : originalHasFocus.get.call(this); }
        });
    }

    setInterval(() => {
        if (!settings.antiAfk) return;

        // Активируем подмену геймпада на полсекунды
        fakeGamepadActive = true;
        setTimeout(() => fakeGamepadActive = false, 500);

        // Ищем элемент, в котором идет трансляция
        const streamTarget = document.querySelector('canvas') || document.querySelector('video') || document.body;
        
        if (streamTarget) {
            const rect = streamTarget.getBoundingClientRect();
            const opts = {
                view: window, bubbles: true, cancelable: true,
                clientX: rect.width / 2, clientY: rect.height / 2
            };
            
            // Симулируем события мыши, тача и клавиатуры для надежности
            streamTarget.dispatchEvent(new MouseEvent('mousemove', opts));
            streamTarget.dispatchEvent(new PointerEvent('pointermove', opts));
            
            const keyOpts = { key: 'Shift', code: 'ShiftLeft', keyCode: 16, bubbles: true, cancelable: true };
            document.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', keyOpts)), 50);

            console.log('[Boosteroid Tweaks] Anti-AFK (Gamepad + Mouse + Keyboard) dispatched.');
        }
    }, 120000); // Каждые 2 минуты

    // 3. Авто-клик удален. Теперь используется перехват WebSocket (см. выше), что на 100% надежнее.

    // === BETTER STATS OVERLAY ===
    let lastBytesReceived = 0;
    let lastStatsTime = 0;
    let statsContainer = null;

    async function updateStatsLoop() {
        if (!statsContainer) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'bt-stats-overlay';
            Object.assign(statsContainer.style, {
                position: 'fixed', top: '20px', left: '20px', background: 'rgba(0,0,0,0.7)', 
                color: '#fff', fontFamily: 'monospace', padding: '10px 15px', borderRadius: '8px', 
                pointerEvents: 'none', zIndex: '999998', display: 'none', fontSize: '14px',
                textShadow: '1px 1px 2px #000', border: '1px solid rgba(255,255,255,0.1)'
            });
            document.body.appendChild(statsContainer);
        }

        if (settings.statsMode === 0 || !currentPeerConnection || currentPeerConnection.connectionState !== 'connected') {
            statsContainer.style.display = 'none';
            return;
        }

        try {
            const stats = await currentPeerConnection.getStats();
            let ping = 0, packetLoss = 0, fps = 0, resolution = '', bytesReceived = 0;
            
            stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    ping = report.currentRoundTripTime ? (report.currentRoundTripTime * 1000).toFixed(0) : 0;
                }
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    packetLoss = report.packetsLost || 0;
                    fps = report.framesPerSecond || 0;
                    bytesReceived = report.bytesReceived || 0;
                    if (report.frameWidth) resolution = `${report.frameWidth}x${report.frameHeight}`;
                }
            });

            const now = performance.now();
            let bitrateMbps = '0.00';
            if (lastStatsTime && bytesReceived) {
                const timeDiff = (now - lastStatsTime) / 1000;
                const bytesDiff = bytesReceived - lastBytesReceived;
                bitrateMbps = ((bytesDiff * 8) / 1000000 / timeDiff).toFixed(2);
            }
            lastBytesReceived = bytesReceived;
            lastStatsTime = now;

            statsContainer.style.display = 'block';
            let html = '';

            if (settings.showPerfRating) {
                let rating = t('ratingBad'), color = '#ff4444';
                if (ping < 20 && packetLoss < 10) { rating = t('ratingExc'); color = '#00e676'; }
                else if (ping < 50 && packetLoss < 50) { rating = t('ratingGood'); color = '#c6ff00'; }
                else if (ping < 100 || packetLoss < 150) { rating = t('ratingPoor'); color = '#ff9100'; }
                
                html += `<div style="color: ${color}; font-weight: bold; font-size: 16px; margin-bottom: 5px; text-align: center;">${rating}</div>`;
            }

            if (settings.statsMode === 1) {
                html += `<div style="display:flex;justify-content:space-between;gap:15px;"><span>PING:</span><span style="color:#0f0">${ping}ms</span></div>
                         <div style="display:flex;justify-content:space-between;gap:15px;"><span>FPS:</span><span style="color:#0f0">${fps}</span></div>`;
            } else if (settings.statsMode === 2) {
                html += `<div style="display:flex;justify-content:space-between;gap:15px;"><span>PING:</span><span style="color:#0f0">${ping}ms</span></div>
                         <div style="display:flex;justify-content:space-between;gap:15px;"><span>BITRATE:</span><span style="color:#0f0">${bitrateMbps} Mbps</span></div>
                         <div style="display:flex;justify-content:space-between;gap:15px;"><span>FPS:</span><span style="color:#0f0">${fps}</span></div>
                         <div style="display:flex;justify-content:space-between;gap:15px;"><span>LOSS:</span><span style="color:#0f0">${packetLoss}</span></div>
                         <div style="display:flex;justify-content:space-between;gap:15px;"><span>RES:</span><span style="color:#0f0">${resolution || 'N/A'}</span></div>`;
            }

            statsContainer.innerHTML = html;
        } catch (e) { console.error('BT Stats Error', e); }
    }
    
    setInterval(updateStatsLoop, 1000);


    // === ПОЛЬЗОВАТЕЛЬСКИЙ ИНТЕРФЕЙС ===
    function initUI() {
        if (window.location.hostname !== 'cloud.boosteroid.com') return;
        if (document.getElementById('boosteroid-tweaks-container')) return;

        const container = document.createElement('div');
        container.id = 'boosteroid-tweaks-container';
        
        // Используем Shadow DOM, чтобы стили не пересекались с сайтом
        const shadow = container.attachShadow({mode: 'open'});

        const style = document.createElement('style');
        style.textContent = `
            #bt-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: rgba(30, 30, 30, 0.6);
                color: rgba(255, 255, 255, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                width: 44px;
                height: 44px;
                cursor: pointer;
                z-index: 999999;
                backdrop-filter: blur(5px);
                transition: transform 0.2s, opacity 0.3s ease, background-color 0.2s, color 0.2s;
                opacity: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #bt-btn:hover {
                transform: scale(1.05);
                background-color: rgba(50, 50, 50, 0.8);
                color: #fff;
            }
            #bt-btn svg {
                width: 20px;
                height: 20px;
            }
            #bt-panel {
                position: fixed;
                bottom: 80px;
                right: 20px;
                background-color: rgba(20, 20, 20, 0.95);
                backdrop-filter: blur(10px);
                color: white;
                border: 1px solid #333;
                border-radius: 12px;
                padding: 20px;
                width: 320px;
                z-index: 999999;
                box-shadow: 0 10px 30px rgba(0,0,0,0.7);
                display: none;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            h2 {
                margin-top: 0;
                font-size: 18px;
                border-bottom: 1px solid #444;
                padding-bottom: 10px;
                margin-bottom: 15px;
            }
            .setting-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            /* Toggle Switch */
            .switch {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 20px;
            }
            .switch input { 
                opacity: 0;
                width: 0;
                height: 0;
            }
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: #555;
                transition: .4s;
                border-radius: 20px;
            }
            .slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            input:checked + .slider {
                background-color: #ff0055;
            }
            input:checked + .slider:before {
                transform: translateX(20px);
            }
            
            /* Server List */
            .server-list-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            #server-input-container {
                display: flex;
                gap: 5px;
            }
            #server-input {
                flex-grow: 1;
                background: #333;
                border: 1px solid #555;
                color: white;
                padding: 5px 10px;
                border-radius: 6px;
                outline: none;
            }
            #server-add-btn {
                background: #ff0055;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 6px;
                cursor: pointer;
            }
            #server-list {
                list-style: none;
                padding: 0;
                margin: 0;
                max-height: 150px;
                overflow-y: auto;
            }
            #server-list li {
                display: flex;
                justify-content: space-between;
                background: #2a2a2a;
                padding: 5px 10px;
                margin-bottom: 5px;
                border-radius: 6px;
                font-size: 14px;
            }
            .remove-btn {
                background: transparent;
                border: none;
                color: #ff4444;
                cursor: pointer;
                font-weight: bold;
            }
        `;

        const btn = document.createElement('button');
        btn.id = 'bt-btn';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        btn.title = 'Boosteroid Tweaks';

        const panel = document.createElement('div');
        panel.id = 'bt-panel';

        // Рендерим панель
        const renderPanel = () => {
            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; margin-bottom: 15px; padding-bottom: 10px;">
                    <h2 style="margin: 0; border: none; padding: 0;">${t('title')}</h2>
                    <select id="bt-lang" style="background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 2px 5px; outline: none; cursor: pointer;">
                        <option value="en" ${currentLang === 'en' ? 'selected' : ''}>EN</option>
                        <option value="ru" ${currentLang === 'ru' ? 'selected' : ''}>RU</option>
                        <option value="uk" ${currentLang === 'uk' ? 'selected' : ''}>UK</option>
                        <option value="es" ${currentLang === 'es' ? 'selected' : ''}>ES</option>
                    </select>
                </div>
                
                <div class="setting-row">
                    <label>${t('antiAfk')}</label>
                    <label class="switch">
                        <input type="checkbox" id="bt-antiafk" ${settings.antiAfk ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="setting-row">
                    <label>${t('statsTitle')}</label>
                    <select id="bt-stats-mode" style="background: #2a2a2a; color: white; border: 1px solid #555; border-radius: 4px; padding: 2px 5px; outline: none;">
                        <option value="0" ${settings.statsMode === 0 ? 'selected' : ''}>${t('statsOff')}</option>
                        <option value="1" ${settings.statsMode === 1 ? 'selected' : ''}>${t('statsMin')}</option>
                        <option value="2" ${settings.statsMode === 2 ? 'selected' : ''}>${t('statsFull')}</option>
                    </select>
                </div>
                
                <div class="setting-row">
                    <label>${t('perfRating')}</label>
                    <label class="switch">
                        <input type="checkbox" id="bt-perf-rating" ${settings.showPerfRating ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="setting-row" style="flex-direction: column; align-items: flex-start; margin-bottom: 20px; background: #2a2a2a; padding: 10px; border-radius: 8px;">
                    <label style="margin-bottom: 5px; font-size: 13px; color: #bbb;">${t('lastServer')}</label>
                    <div style="display: flex; gap: 5px; width: 100%;">
                        <input type="text" readonly value="${lastDetectedServer || t('waiting')}" style="flex-grow: 1; background: #1a1a1a; border: 1px solid #444; color: #ddd; padding: 5px 10px; border-radius: 6px; outline: none; font-size: 13px;">
                        <button id="block-last-btn" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; ${!lastDetectedServer || settings.blockedServers.includes(lastDetectedServer) ? 'opacity: 0.5; pointer-events: none;' : ''}">${t('block')}</button>
                    </div>
                </div>

                <div class="server-list-container">
                    <label>${t('blockedList')}</label>
                    <div id="server-input-container">
                        <input type="text" id="server-input" placeholder="${t('placeholder')}">
                        <button id="server-add-btn">${t('add')}</button>
                    </div>
                    <ul id="server-list">
                        ${settings.blockedServers.map((srv, index) => `
                            <li>
                                <span>${srv}</span>
                                <button class="remove-btn" data-index="${index}">✖</button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;

            // Привязываем события
            panel.querySelector('#bt-lang').addEventListener('change', (e) => {
                currentLang = e.target.value;
                settings.language = currentLang;
                saveSettings();
                renderPanel();
            });

            panel.querySelector('#bt-antiafk').addEventListener('change', (e) => {
                settings.antiAfk = e.target.checked;
                saveSettings();
            });

            panel.querySelector('#bt-stats-mode').addEventListener('change', (e) => {
                settings.statsMode = parseInt(e.target.value);
                saveSettings();
                renderPanel();
            });

            panel.querySelector('#bt-perf-rating').addEventListener('change', (e) => {
                settings.showPerfRating = e.target.checked;
                saveSettings();
                renderPanel();
            });

            const blockLastBtn = panel.querySelector('#block-last-btn');
            if (blockLastBtn) {
                blockLastBtn.addEventListener('click', () => {
                    if (lastDetectedServer && !settings.blockedServers.includes(lastDetectedServer)) {
                        settings.blockedServers.push(lastDetectedServer);
                        saveSettings();
                        renderPanel();
                    }
                });
            }

            panel.querySelector('#server-add-btn').addEventListener('click', () => {
                const input = panel.querySelector('#server-input');
                const val = input.value.trim();
                if (val && !settings.blockedServers.includes(val)) {
                    settings.blockedServers.push(val);
                    saveSettings();
                    renderPanel(); // Перерисовываем список
                }
                input.value = '';
            });

            panel.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.getAttribute('data-index'));
                    settings.blockedServers.splice(index, 1);
                    saveSettings();
                    renderPanel();
                });
            });
        };

        window.renderPanelGlobal = renderPanel;

        renderPanel();

        btn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            resetHideBtn();
        });

        // Логика автоскрытия кнопки
        let hideTimeout;
        const hideBtn = () => {
            if (panel.style.display !== 'block') {
                btn.style.opacity = '0';
                btn.style.pointerEvents = 'none';
            }
        };
        const resetHideBtn = () => {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(hideBtn, 3000);
        };

        window.addEventListener('mousemove', resetHideBtn);
        window.addEventListener('keydown', resetHideBtn);
        resetHideBtn();

        shadow.appendChild(style);
        shadow.appendChild(btn);
        shadow.appendChild(panel);
        document.body.appendChild(container);
    }

    // Инициализируем UI после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

})();
