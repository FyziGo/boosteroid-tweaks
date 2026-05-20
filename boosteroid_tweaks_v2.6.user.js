// ==UserScript==
// @name         Boosteroid Tweaks
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  Блокировка серверов и Anti-AFK (Steam Remote Play) для Boosteroid
// @author       You
// @match        *://*.boosteroid.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/FyziGo/boosteroid-tweaks/master/boosteroid_tweaks.user.js
// @downloadURL  https://raw.githubusercontent.com/FyziGo/boosteroid-tweaks/master/boosteroid_tweaks.user.js
// ==/UserScript==

(function () {
    'use strict';

    // В Tampermonkey с @grant GM_* скрипт работает в песочнице.
    // unsafeWindow — это реальный window страницы, куда нужно инжектить перехватчики.
    const _w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    // === НАСТРОЙКИ ===
    const defaultSettings = {
        antiAfkMode: 'off',
        preferredCodec: 'auto',
        bandwidthLimit: 0,
        resolution: 'auto',
        blockedServers: [],
        language: '',
        skipExitScreen: false
    };

    let settings = Object.assign({}, defaultSettings, JSON.parse(GM_getValue('boosteroid_settings', JSON.stringify(defaultSettings))));

    if (typeof settings.antiAfk === 'boolean') {
        settings.antiAfkMode = settings.antiAfk ? 'intercept' : 'off';
        delete settings.antiAfk;
        GM_setValue('boosteroid_settings', JSON.stringify(settings));
    }

    function saveSettings() {
        GM_setValue('boosteroid_settings', JSON.stringify(settings));
    }

    const i18n = {
        'en': { title: 'Boosteroid Tweaks', antiAfk: 'Anti-AFK Mode', afkOff: 'Off', afkNet: 'Net', afkF15: 'F15', codec: 'Video Codec', codecAuto: 'Auto', bandwidth: 'Bitrate Limit', bwUnlimited: 'Unlimited', resTitle: 'Resolution', resAuto: 'Auto (Native)', res1080p: '1080p (FHD)', res1440p: '1440p (2K)', res4k: '2160p (4K)', lastServer: 'Last server (auto-detect):', waiting: 'Waiting...', block: 'Block', blockedList: 'Blocked servers (IP or domain):', placeholder: 'e.g. sh1.boosteroid.com', add: 'Add', skipExit: 'Skip Exit Screen' },
        'ru': { title: 'Boosteroid Tweaks', antiAfk: 'Режим Anti-AFK', afkOff: 'Выкл', afkNet: 'Сеть', afkF15: 'F15', codec: 'Видеокодек', codecAuto: 'Авто', bandwidth: 'Лимит битрейта', bwUnlimited: 'Без ограничений', resTitle: 'Разрешение', resAuto: 'Авто (Родное)', res1080p: '1080p (FHD)', res1440p: '1440p (2K)', res4k: '2160p (4K)', lastServer: 'Последний сервер (автоопределение):', waiting: 'Ожидание...', block: 'Блок', blockedList: 'Заблокированные сервера (IP или домен):', placeholder: 'Например: sh1.boosteroid.com', add: 'Добавить', skipExit: 'Пропускать окно выхода' },
        'uk': { title: 'Boosteroid Tweaks', antiAfk: 'Режим Anti-AFK', afkOff: 'Вимк', afkNet: 'Мережа', afkF15: 'F15', codec: 'Відеокодек', codecAuto: 'Авто', bandwidth: 'Ліміт бітрейту', bwUnlimited: 'Без обмежень', resTitle: 'Роздільна здатність', resAuto: 'Авто (Рідна)', res1080p: '1080p (FHD)', res1440p: '1440p (2K)', res4k: '2160p (4K)', lastServer: 'Останній сервер (автовизначення):', waiting: 'Очікування...', block: 'Блок', blockedList: 'Заблоковані сервери (IP або домен):', placeholder: 'Наприклад: sh1.boosteroid.com', add: 'Додати', skipExit: 'Пропускати вікно виходу' },
        'es': { title: 'Boosteroid Tweaks', antiAfk: 'Modo Anti-AFK', afkOff: 'Apag', afkNet: 'Red', afkF15: 'F15', codec: 'Códec de video', codecAuto: 'Auto', bandwidth: 'Límite de bitrate', bwUnlimited: 'Sin límite', resTitle: 'Resolución', resAuto: 'Auto (Nativa)', res1080p: '1080p (FHD)', res1440p: '1440p (2K)', res4k: '2160p (4K)', lastServer: 'Último servidor (autodetectado):', waiting: 'Esperando...', block: 'Bloquear', blockedList: 'Servidores bloqueados (IP o dominio):', placeholder: 'Ejemplo: sh1.boosteroid.com', add: 'Añadir', skipExit: 'Omitir pantalla de salida' }
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

    let lastServerName = null;
    let lastServerIp = null;

    function isStreamingPage() {
        const path = window.location.pathname.toLowerCase();
        const href = window.location.href.toLowerCase();
        return path.includes('streaming.html') || href.includes('sessionid=');
    }

    // === HOOK RESOLUTION ===
    function applyResolutionHook() {
        if (!settings.resolution || settings.resolution === 'auto') return;
        
        const resParts = settings.resolution.split('x');
        if (resParts.length !== 2) return;
        
        const width = parseInt(resParts[0]);
        const height = parseInt(resParts[1]);
        if (!width || !height) return;

        // Определяем pixelRatio
        const pixelRatio = width >= 3840 ? 2 : (width >= 2560 ? 1.5 : 1);

        try {
            Object.defineProperty(_w, 'screen', {
                get: function () {
                    return {
                        width: width,
                        height: height,
                        availWidth: width,
                        availHeight: height,
                        availLeft: 0,
                        availTop: 0,
                        colorDepth: 30,
                        isExtended: false,
                        pixelDepth: 30,
                        orientation: { type: 'landscape-primary', angle: 0 }
                    };
                },
                configurable: true
            });

            Object.defineProperty(_w, 'devicePixelRatio', {
                get: () => pixelRatio,
                configurable: true
            });

            console.log(`[Boosteroid Tweaks] 🖥️ Разрешение принудительно установлено: ${width}x${height} @${pixelRatio}x`);
        } catch (e) {
            console.error('[Boosteroid Tweaks] Ошибка хука разрешения:', e);
        }
    }
    applyResolutionHook();

    // === ПЕРЕХВАТ СЕТИ (БЛОКИРОВКА И АВТОДЕТЕКТ СЕРВЕРОВ) ===
    
    // Функция для фильтрации служебных доменов Boosteroid
    const checkAndSetServer = (host, fullUrl = '') => {
        const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || (host && host.includes(':') && host.includes('[')); // Базовая проверка на IPv4 и IPv6
        // Захватываем /api/call - это финальный запрос к WebRTC серверу Boosteroid!
        const isStreamApi = fullUrl.includes('/webrtc') || fullUrl.includes('/janus') || fullUrl.includes('/api/call');
        const isPingApi = fullUrl.includes('&ping=1') || fullUrl.includes('?ping=1');

        // Расширяем поддержку доменов
        const isBoosteroidDomain = host && (host.includes('boosteroid') || host.includes('.cloud') || host.includes('.net'));

        if (isIP || isBoosteroidDomain || isStreamApi) {
            // Игнорируем основные сайты, API и служебные домены, если это не явный вызов Stream API
            const ignoreList = ['cloud.boosteroid.com', 'api.boosteroid.com', 'games.boosteroid.com', 'boosteroid.com', 'mtls.boosteroid.com'];
            
            // Если это явный вызов Stream API (/api/call) - это 100% активный гейтвей!
            if (isStreamApi) {
                let changed = false;
                if (isIP && host !== lastServerIp) { lastServerIp = host; changed = true; }
                if (!isIP && host !== lastServerName) { lastServerName = host; changed = true; }
                
                if (changed) {
                    console.log(`[Boosteroid Tweaks] 🎮 Подтвержден активный сервер: ${host} (через Stream API)`);
                    if (_w.renderPanelGlobal) _w.renderPanelGlobal();
                }
            } 
            // Иначе, если это не пинг-запрос и не в игнор-листе
            else if (!ignoreList.includes(host) && !isPingApi) {
                let changed = false;
                if (isIP && host !== lastServerIp) { lastServerIp = host; changed = true; }
                if (!isIP && host !== lastServerName) { lastServerName = host; changed = true; }
                
                if (changed) {
                    console.log(`[Boosteroid Tweaks] 🌍 Обнаружен сервер: ${host} (из ${fullUrl.substring(0, 80)})`);
                    if (_w.renderPanelGlobal) _w.renderPanelGlobal();
                }
            }
        }
    };

    // 1. Перехват WebSocket
    const OriginalWebSocket = _w.WebSocket;
    _w.WebSocket = function (url, protocols) {
        const urlObj = new URL(url);
        const host = urlObj.hostname;

        const isBlocked = settings.blockedServers.some(blockedItem => host.includes(blockedItem));

        if (isBlocked) {
            console.warn(`[Boosteroid Tweaks] Заблокировано подключение к WebSocket: ${host}`);
            // Выбрасываем ошибку, чтобы разорвать соединение на этапе инициализации
            throw new Error(`[Boosteroid Tweaks] Connection to ${host} blocked by user settings.`);
        }

        checkAndSetServer(host, url);

        let ws;
        if (protocols === undefined) {
            ws = new OriginalWebSocket(url);
        } else {
            ws = new OriginalWebSocket(url, protocols);
        }

        // Anti-AFK: ВСЕГДА устанавливаем перехватчик — проверяем settings.antiAfk
        // внутри обработчика, чтобы включение/выключение работало без перезагрузки
        const wsPropDescriptor = Object.getOwnPropertyDescriptor(OriginalWebSocket.prototype, 'onmessage');
        if (wsPropDescriptor) {
            Object.defineProperty(ws, 'onmessage', {
                get: function () {
                    return wsPropDescriptor.get.call(this);
                },
                set: function (handler) {
                    const wrappedHandler = function (evt) {
                        try {
                            if (settings.antiAfkMode === 'intercept') {
                                let dataStr = '';
                                if (typeof evt.data === 'string') {
                                    dataStr = evt.data;
                                } else if (evt.data instanceof ArrayBuffer) {
                                    dataStr = new TextDecoder().decode(evt.data);
                                }

                                if (dataStr && dataStr.includes('"action":"activity"')) {
                                    const msg = JSON.parse(dataStr);
                                    if (msg.type === 'message' && msg.action === 'activity') {
                                        console.log('[Boosteroid Tweaks] 🔥 Перехвачено AFK предупреждение от сервера (WebSocket)!');

                                        if (ws.readyState === OriginalWebSocket.OPEN) {
                                            ws.send(JSON.stringify({
                                                type: "settings",
                                                action: "activity",
                                                value: "I am here"
                                            }));
                                            console.log('[Boosteroid Tweaks] ✅ Успешно отправлен автоответ "I am here". Окно не появится.');
                                        }

                                        // Блокируем оригинальный обработчик
                                        return;
                                    }
                                }
                            }
                        } catch (e) { }

                        return handler ? handler.call(this, evt) : null;
                    };
                    wsPropDescriptor.set.call(this, wrappedHandler);
                }
            });
        }

        // Anti-AFK: перехватываем addEventListener('message') на случай,
        // если Boosteroid использует его вместо ws.onmessage
        const originalWsAddListener = ws.addEventListener;
        ws.addEventListener = function(type, listener, options) {
            if (type === 'message' && typeof listener === 'function') {
                const wrappedListener = function(evt) {
                    try {
                        if (settings.antiAfkMode === 'intercept') {
                            let dataStr = '';
                            if (typeof evt.data === 'string') {
                                dataStr = evt.data;
                            } else if (evt.data instanceof ArrayBuffer) {
                                dataStr = new TextDecoder().decode(evt.data);
                            }

                            if (dataStr && dataStr.includes('"action":"activity"')) {
                                const msg = JSON.parse(dataStr);
                                if (msg.type === 'message' && msg.action === 'activity') {
                                    console.log('[Boosteroid Tweaks] 🔥 Перехвачено AFK (WebSocket addEventListener)!');
                                    if (ws.readyState === OriginalWebSocket.OPEN) {
                                        ws.send(JSON.stringify({
                                            type: "settings",
                                            action: "activity",
                                            value: "I am here"
                                        }));
                                        console.log('[Boosteroid Tweaks] ✅ Автоответ отправлен (addEventListener).');
                                    }
                                    return;
                                }
                            }
                        }
                    } catch (e) { }
                    return listener.call(this, evt);
                };
                return originalWsAddListener.call(this, type, wrappedListener, options);
            }
            return originalWsAddListener.call(this, type, listener, options);
        };

        return ws;
    };



    // 3. Перехват Fetch API (для нового WebRTC движка Boosteroid и подмены конфигурации кодека)
    const originalFetch = _w.fetch;
    _w.fetch = async function () {
        let isConfigUrl = false;
        try {
            const req = arguments[0];
            const url = typeof req === 'string' ? req : (req instanceof Request ? req.url : '');
            if (url) {
                const urlObj = new URL(url, _w.location.origin);
                const host = urlObj.hostname;
                
                const isBlocked = settings.blockedServers.some(blockedItem => host.includes(blockedItem));
                if (isBlocked) {
                    console.warn(`[Boosteroid Tweaks] Заблокирован fetch запрос к: ${host}`);
                    return Promise.reject(new Error(`[Boosteroid Tweaks] Fetch to ${host} blocked.`));
                }

                checkAndSetServer(host, url);

                if (url.includes('/configuration') || url.includes('/session') || url.includes('/streaming')) {
                    isConfigUrl = true;
                }
            }
        } catch(e) {}

        const response = await originalFetch.apply(this, arguments);

        if (isConfigUrl && response.ok && settings.preferredCodec !== 'auto') {
            try {
                const clonedResponse = response.clone();
                const config = await clonedResponse.json();

                if (config) {
                    if (!config.clientStreamingConfigOverrides) {
                        config.clientStreamingConfigOverrides = '{}';
                    }

                    let overrides = {};
                    try {
                        overrides = JSON.parse(config.clientStreamingConfigOverrides);
                    } catch (e) {
                        overrides = {};
                    }

                    // Принудительно устанавливаем кодек и аппаратное ускорение для бэкенда Boosteroid
                    overrides.videoConfiguration = overrides.videoConfiguration || {};
                    overrides.videoConfiguration.enableHardwareDecoding = true;
                    overrides.videoConfiguration.hardwareDecoderProfile = 'high';
                    overrides.videoConfiguration.enableRtcStatsCollection = true;
                    
                    let backendCodec = settings.preferredCodec;
                    // Бэкенд Boosteroid часто использует 'hevc' вместо 'h265'
                    if (backendCodec === 'h265') backendCodec = 'hevc'; 
                    
                    overrides.videoConfiguration.preferredCodec = backendCodec;

                    // Установка битрейта на уровне бэкенда
                    if (settings.bandwidthLimit && settings.bandwidthLimit > 0) {
                        overrides.bitrateConfiguration = overrides.bitrateConfiguration || {};
                        const limitBps = settings.bandwidthLimit * 1000;
                        overrides.bitrateConfiguration.maxBitrate = limitBps;
                        overrides.bitrateConfiguration.targetBitrate = Math.floor(limitBps * 0.8);
                    }

                    config.clientStreamingConfigOverrides = JSON.stringify(overrides);

                    console.log(`[Boosteroid Tweaks] 🎬 Fetch Interceptor: конфиг потока изменен, кодек установлен на ${backendCodec.toUpperCase()}`);

                    return new Response(JSON.stringify(config), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                }
            } catch (e) {
                // Если парсинг не удался (например, это не JSON), просто возвращаем оригинальный ответ
            }
        }

        return response;
    };

    // 4. Перехват XMLHttpRequest (на всякий случай)
    const OriginalXHR = _w.XMLHttpRequest;
    _w.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open;
        xhr.open = function(method, url) {
            try {
                const urlObj = new URL(url, _w.location.origin);
                const host = urlObj.hostname;
                
                const isBlocked = settings.blockedServers.some(blockedItem => host.includes(blockedItem));
                if (isBlocked) {
                    console.warn(`[Boosteroid Tweaks] Заблокирован XHR запрос к: ${host}`);
                    throw new Error(`[Boosteroid Tweaks] XHR to ${host} blocked.`);
                }

                checkAndSetServer(host, url);
            } catch(e) {}
            return originalOpen.apply(this, arguments);
        };
        return xhr;
    };

    // === ANTI-AFK для WebRTC Data Channels ===
    function setupDataChannelInterceptor(channel) {
        if (!channel || channel.__btIntercepted) return;
        channel.__btIntercepted = true;

        const originalAddEventListener = channel.addEventListener;
        if (originalAddEventListener) {
            channel.addEventListener = function(type, listener, options) {
                if (type === 'message' && typeof listener === 'function') {
                    const wrappedListener = function(evt) {
                        try {
                            if (settings.antiAfkMode === 'intercept') {
                                let dataStr = '';
                                if (typeof evt.data === 'string') {
                                    dataStr = evt.data;
                                } else if (evt.data instanceof ArrayBuffer) {
                                    dataStr = new TextDecoder().decode(evt.data);
                                }

                                if (dataStr && dataStr.includes('"action":"activity"')) {
                                    const msg = JSON.parse(dataStr);
                                    if (msg.type === 'message' && msg.action === 'activity') {
                                        console.log('[Boosteroid Tweaks] 🔥 Перехвачено AFK (RTCDataChannel addEventListener)!');
                                        if (channel.readyState === 'open') {
                                            channel.send(JSON.stringify({
                                                type: "settings",
                                                action: "activity",
                                                value: "I am here"
                                            }));
                                            console.log('[Boosteroid Tweaks] ✅ Автоответ отправлен (RTCDataChannel).');
                                        }
                                        return; // Блокируем вызов оригинального обработчика
                                    }
                                }
                            }
                        } catch (e) {}
                        return listener.call(this, evt);
                    };
                    return originalAddEventListener.call(this, type, wrappedListener, options);
                }
                return originalAddEventListener.call(this, type, listener, options);
            };
        }

        const msgDescriptor = Object.getOwnPropertyDescriptor(RTCDataChannel.prototype, 'onmessage');
        if (msgDescriptor) {
            Object.defineProperty(channel, 'onmessage', {
                get: function() { return msgDescriptor.get ? msgDescriptor.get.call(this) : this.__btOnMessage; },
                set: function(handler) {
                    this.__btOnMessage = handler;
                    const wrappedHandler = function(evt) {
                        try {
                            if (settings.antiAfkMode === 'intercept') {
                                let dataStr = '';
                                if (typeof evt.data === 'string') {
                                    dataStr = evt.data;
                                } else if (evt.data instanceof ArrayBuffer) {
                                    dataStr = new TextDecoder().decode(evt.data);
                                }

                                if (dataStr && dataStr.includes('"action":"activity"')) {
                                    const msg = JSON.parse(dataStr);
                                    if (msg.type === 'message' && msg.action === 'activity') {
                                        console.log('[Boosteroid Tweaks] 🔥 Перехвачено AFK (RTCDataChannel onmessage)!');
                                        if (channel.readyState === 'open') {
                                            channel.send(JSON.stringify({
                                                type: "settings",
                                                action: "activity",
                                                value: "I am here"
                                            }));
                                            console.log('[Boosteroid Tweaks] ✅ Автоответ отправлен (RTCDataChannel onmessage).');
                                        }
                                        return;
                                    }
                                }
                            }
                        } catch (e) {}
                        return handler ? handler.call(this, evt) : null;
                    };
                    if (msgDescriptor.set) {
                        msgDescriptor.set.call(this, wrappedHandler);
                    } else if (originalAddEventListener) {
                        originalAddEventListener.call(this, 'message', wrappedHandler);
                    }
                }
            });
        }
    }

    // === ПРИНУДИТЕЛЬНЫЙ ВЫБОР ВИДЕОКОДЕКА (SDP Manipulation) ===
    function modifySdpCodecPreference(sdp, preferredCodec) {
        if (!preferredCodec || preferredCodec === 'auto') return sdp;

        const codecAliases = {
            'h265': ['h265', 'hevc'],
            'h264': ['h264'],
            'av1': ['av1', 'av01']
        };

        const aliases = codecAliases[preferredCodec];
        if (!aliases) return sdp;

        const lines = sdp.split('\r\n');
        let videoMLineIndex = -1;
        let inVideoSection = false;
        const codecPayloadTypes = {}; // payloadType -> codecName (lowercase)

        // Первый проход: находим m=video строку и строим карту кодеков
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('m=video')) {
                videoMLineIndex = i;
                inVideoSection = true;
                continue;
            }
            if (lines[i].startsWith('m=') && inVideoSection) break;
            if (inVideoSection) {
                const rtpmapMatch = lines[i].match(/^a=rtpmap:(\d+)\s+(\S+)/);
                if (rtpmapMatch) {
                    codecPayloadTypes[rtpmapMatch[1]] = rtpmapMatch[2].split('/')[0].toLowerCase();
                }
            }
        }

        if (videoMLineIndex === -1) return sdp;

        const mLineParts = lines[videoMLineIndex].split(' ');
        const payloadTypes = mLineParts.slice(3);

        // Находим payload types предпочитаемого кодека
        const preferredPTs = payloadTypes.filter(pt => {
            const codec = codecPayloadTypes[pt];
            return codec && aliases.some(alias => codec === alias);
        });

        if (preferredPTs.length === 0) {
            const available = Object.entries(codecPayloadTypes).map(([pt, name]) => `${name}(${pt})`).join(', ');
            console.warn(`[Boosteroid Tweaks] ⚠️ Кодек ${preferredCodec.toUpperCase()} не найден в SDP. Доступные: ${available}`);
            return sdp;
        }

        // Заменяем m-line — оставляем только предпочитаемый кодек
        const removePTs = new Set(payloadTypes.filter(pt => !preferredPTs.includes(pt)));
        mLineParts.splice(3, payloadTypes.length, ...preferredPTs);
        lines[videoMLineIndex] = mLineParts.join(' ');

        // Второй проход: удаляем атрибуты (rtpmap, fmtp, rtcp-fb) для удалённых кодеков
        inVideoSection = false;
        const filteredLines = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('m=video')) inVideoSection = true;
            else if (lines[i].startsWith('m=') && inVideoSection) inVideoSection = false;

            if (inVideoSection) {
                const attrMatch = lines[i].match(/^a=(rtpmap|fmtp|rtcp-fb):(\d+)/);
                if (attrMatch && removePTs.has(attrMatch[2])) continue;
            }
            filteredLines.push(lines[i]);
        }

        console.log(`[Boosteroid Tweaks] 🎬 Кодек ${preferredCodec.toUpperCase()} применён (PT: ${preferredPTs.join(', ')})`);
        return filteredLines.join('\r\n');
    }

    // === ОГРАНИЧЕНИЕ БИТРЕЙТА (SDP Bandwidth) ===
    function modifySdpBandwidth(sdp, limitKbps) {
        if (!limitKbps || limitKbps <= 0) return sdp;

        const lines = sdp.split('\r\n');
        const result = [];
        let inVideoSection = false;
        let bandwidthAdded = false;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('m=video')) {
                inVideoSection = true;
                bandwidthAdded = false;
                result.push(lines[i]);
                continue;
            }
            if (lines[i].startsWith('m=') && inVideoSection) {
                inVideoSection = false;
            }

            // Удаляем существующие bandwidth строки в видео-секции
            if (inVideoSection && (lines[i].startsWith('b=AS:') || lines[i].startsWith('b=TIAS:'))) {
                continue;
            }

            // Вставляем лимит перед первым a= атрибутом
            if (inVideoSection && !bandwidthAdded && lines[i].startsWith('a=')) {
                result.push(`b=AS:${limitKbps}`);
                result.push(`b=TIAS:${limitKbps * 1000}`);
                bandwidthAdded = true;
                console.log(`[Boosteroid Tweaks] 📡 Битрейт ограничен: ${limitKbps} Kbps`);
            }

            result.push(lines[i]);
        }

        return result.join('\r\n');
    }

    // Универсальная функция модификации SDP (кодек + битрейт)
    function applySdpModifications(sdp) {
        let modified = sdp;
        if (settings.preferredCodec && settings.preferredCodec !== 'auto') {
            modified = modifySdpCodecPreference(modified, settings.preferredCodec);
        }
        if (settings.bandwidthLimit && settings.bandwidthLimit > 0) {
            modified = modifySdpBandwidth(modified, settings.bandwidthLimit);
        }
        return modified;
    }

    // 5. Легковесный перехват WebRTC для определения IP сервера и DataChannels (Anti-AFK)
    const setupRtcProxy = (RTCClass) => {
        if (!RTCClass) return null;
        return new Proxy(RTCClass, {
            construct(target, args) {
                const pc = new target(...args);

                // Перехват SDP для кодека и битрейта
                const origSetRemote = pc.setRemoteDescription.bind(pc);
                pc.setRemoteDescription = function(desc) {
                    if (desc && desc.sdp) {
                        try {
                            // Диагностика: показываем доступные кодеки в SDP
                            const codecs = [...desc.sdp.matchAll(/a=rtpmap:(\d+)\s+(\S+)/g)].map(m => m[2]);
                            console.log(`[Boosteroid Tweaks] 📋 setRemoteDescription (${desc.type}), видео кодеки в SDP:`, codecs.filter(c => !c.includes('opus') && !c.includes('telephone')));
                            const modified = applySdpModifications(desc.sdp);
                            if (modified !== desc.sdp) desc = { type: desc.type, sdp: modified };
                        } catch(e) { console.error('[Boosteroid Tweaks] SDP modify error:', e); }
                    }
                    return origSetRemote(desc);
                };

                const origSetLocal = pc.setLocalDescription.bind(pc);
                pc.setLocalDescription = function(desc) {
                    if (desc && desc.sdp) {
                        try {
                            const modified = applySdpModifications(desc.sdp);
                            if (modified !== desc.sdp) desc = { type: desc.type, sdp: modified };
                        } catch(e) { console.error('[Boosteroid Tweaks] SDP modify error:', e); }
                    }
                    return origSetLocal(desc);
                };
                
                // Перехват DataChannels (созданных клиентом)
                const originalCreateDataChannel = pc.createDataChannel;
                if (originalCreateDataChannel) {
                    pc.createDataChannel = function() {
                        const channel = originalCreateDataChannel.apply(this, arguments);
                        setupDataChannelInterceptor(channel);
                        return channel;
                    };
                }

                // Перехват DataChannels (созданных сервером)
                const originalAddEventListener = pc.addEventListener;
                if (originalAddEventListener) {
                    pc.addEventListener = function(type, listener, options) {
                        if (type === 'datachannel' && typeof listener === 'function') {
                            const wrappedListener = function(evt) {
                                if (evt.channel) {
                                    setupDataChannelInterceptor(evt.channel);
                                }
                                return listener.call(this, evt);
                            };
                            return originalAddEventListener.call(this, type, wrappedListener, options);
                        }
                        return originalAddEventListener.call(this, type, listener, options);
                    };
                }
                
                const dcDescriptor = Object.getOwnPropertyDescriptor(target.prototype, 'ondatachannel');
                if (dcDescriptor) {
                    Object.defineProperty(pc, 'ondatachannel', {
                        get: function() { return dcDescriptor.get ? dcDescriptor.get.call(this) : this.__btOnDataChannel; },
                        set: function(handler) {
                            this.__btOnDataChannel = handler;
                            const wrappedHandler = function(evt) {
                                if (evt.channel) {
                                    setupDataChannelInterceptor(evt.channel);
                                }
                                return handler ? handler.call(this, evt) : null;
                            };
                            if (dcDescriptor.set) {
                                dcDescriptor.set.call(this, wrappedHandler);
                            } else if (originalAddEventListener) {
                                originalAddEventListener.call(this, 'datachannel', wrappedHandler);
                            }
                        }
                    });
                }

                let checkInterval = setInterval(async () => {
                    const state = pc.connectionState || pc.iceConnectionState;
                    if (state === 'connected') {
                        try {
                            const stats = await pc.getStats();
                            stats.forEach(report => {
                                if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.remoteCandidateId) {
                                    const remoteCandidate = stats.get(report.remoteCandidateId);
                                    if (remoteCandidate) {
                                        const ip = remoteCandidate.ip || remoteCandidate.address;
                                        // Убрали проверку ip.includes('.') для поддержки IPv6
                                        if (ip && !ip.startsWith('192.168.') && !ip.startsWith('10.') && !ip.endsWith('.local') && ip !== lastServerIp) {
                                            lastServerIp = ip;
                                            console.log(`[Boosteroid Tweaks] 📡 WebRTC IP сервера обнаружен: ${ip}`);
                                            if (_w.renderPanelGlobal) _w.renderPanelGlobal();
                                            clearInterval(checkInterval); // IP найден, прекращаем проверки
                                        }
                                    }
                                }
                            });
                        } catch (e) {}
                    } else if (state === 'closed' || state === 'failed') {
                        clearInterval(checkInterval);
                    }
                }, 2000);

                return pc;
            }
        });
    };

    if (_w.RTCPeerConnection) {
        _w.RTCPeerConnection = setupRtcProxy(_w.RTCPeerConnection);
    }
    if (_w.webkitRTCPeerConnection && !_w.webkitRTCPeerConnection.__btProxied) {
        _w.webkitRTCPeerConnection = setupRtcProxy(_w.webkitRTCPeerConnection);
        _w.webkitRTCPeerConnection.__btProxied = true;
    }

    // === ANTI-AFK ===
    // 1. Подмена Gamepad API (облачные сервисы доверяют геймпадам)
    const originalGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;
    let fakeGamepadActive = false;

    if (originalGetGamepads) {
        navigator.getGamepads = function () {
            const gamepads = originalGetGamepads();
            if (settings.antiAfkMode === 'intercept' && fakeGamepadActive) {
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
            if (settings.antiAfkMode !== 'off') {
                e.stopImmediatePropagation();
                e.stopPropagation();
            }
        }, true); // перехват на фазе погружения
    });

    const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    const originalVisibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    const originalHasFocus = Document.prototype.hasFocus;

    if (originalHidden) {
        Object.defineProperty(document, 'hidden', {
            get: function () { return settings.antiAfkMode !== 'off' ? false : originalHidden.get.call(this); }
        });
    }
    if (originalVisibility) {
        Object.defineProperty(document, 'visibilityState', {
            get: function () { return settings.antiAfkMode !== 'off' ? 'visible' : originalVisibility.get.call(this); }
        });
    }
    if (originalHasFocus) {
        document.hasFocus = function() {
            return settings.antiAfkMode !== 'off' ? true : originalHasFocus.call(document);
        };
    }

    setInterval(() => {
        if (settings.antiAfkMode !== 'intercept') return;

        // Активируем подмену геймпада на полсекунды
        fakeGamepadActive = true;
        setTimeout(() => fakeGamepadActive = false, 500);

        // Ищем элемент, в котором идет трансляция
        const streamTarget = document.querySelector('canvas') || document.querySelector('video') || document.body;

        if (streamTarget) {
            const rect = streamTarget.getBoundingClientRect();
            const opts = {
                view: null, bubbles: true, cancelable: true,
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

    // Новый режим: F15
    setInterval(() => {
        if (settings.antiAfkMode !== 'f15') return;
        
        const streamTarget = document.querySelector('canvas') || document.querySelector('video') || document.body;
        if (streamTarget) {
            const keyOpts = { key: 'F15', code: 'F15', keyCode: 126, bubbles: true, cancelable: true };
            streamTarget.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            setTimeout(() => streamTarget.dispatchEvent(new KeyboardEvent('keyup', keyOpts)), 50);
            
            // На всякий случай отправляем и на document
            document.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', keyOpts)), 50);

            console.log('[Boosteroid Tweaks] ⌨️ F15 key dispatched (Anti-AFK F15 Mode).');
        }
    }, 420000); // Каждые 7 минут

    // 3. Авто-клик удален. Теперь используется перехват WebSocket (см. выше), что на 100% надежнее.

    // 4. Fallback Auto-clicker
    // Если сетевой перехват не сработал (например, данные зашифрованы или Boosteroid изменил протокол),
    // мы обнаружим появление окна в DOM и нажмем кнопку "Я ВСЕ ЕЩЕ ЗДЕСЬ"
    const afkObserver = new MutationObserver((mutations) => {
        if (settings.antiAfkMode === 'off' && !settings.skipExitScreen) return;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Ищем кнопки только внутри добавленного узла, чтобы не вешать браузер
                    let buttons = [];
                    if (node.matches && node.matches('button, div[role="button"], .session-poll-start-btn')) {
                        buttons.push(node);
                    }
                    if (node.querySelectorAll) {
                        const childButtons = node.querySelectorAll('button, div[role="button"], .session-poll-start-btn');
                        childButtons.forEach(b => buttons.push(b));
                    }

                    for (const btn of buttons) {
                        // Anti-AFK
                        if (settings.antiAfkMode !== 'off') {
                            const text = (btn.innerText || btn.textContent || '').toUpperCase();
                            if (text.includes('I AM STILL HERE') || 
                                text.includes("I'M STILL HERE") || 
                                text.includes('Я ВСЕ ЕЩЕ ЗДЕСЬ') || 
                                text.includes('Я ТУТ') ||
                                text.includes('Я ЩЕ ТУТ') ||
                                text.includes('STILL HERE')) {
                                console.log('[Boosteroid Tweaks] 🖱️ Окно AFK появилось. Авто-клик по кнопке!');
                                btn.click();
                                return; // Выходим из обсервера
                            }
                        }

                        // Skip Exit Screen
                        if (settings.skipExitScreen && btn.classList && btn.classList.contains('session-poll-start-btn')) {
                            console.log('[Boosteroid Tweaks] 🚀 Пропускаем экран выхода (авто-клик "ДОМОЙ").');
                            btn.click();
                            return; // Выходим из обсервера
                        }
                    }
                }
            }
        }
    });

    // Инжектим стиль для скрытия окна выхода, если включено
    if (settings.skipExitScreen && document.documentElement) {
        const hideStyle = document.createElement('style');
        hideStyle.textContent = '.session-poll-wrapper { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }';
        document.documentElement.appendChild(hideStyle);
    }

    // Запускаем обсервер для body
    if (document.body) {
        afkObserver.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            afkObserver.observe(document.body, { childList: true, subtree: true });
        });
    }

    // === АВТОДЕТЕКТ СЕРВЕРА ЧЕРЕЗ ГЛОБАЛЫ BOOSTEROID (фолбэк) ===
    // Если перехват WS/Fetch/XHR не поймал имя сервера,
    // читаем напрямую из глобальных объектов Boosteroid.
    function discoverServerFromGlobals() {
        try {
            // JANUS_HELPER.server = "https://gw-xxx.boosteroid.com/janus"
            const janusServer = _w.JANUS_HELPER && _w.JANUS_HELPER.server;
            if (janusServer) {
                const url = new URL(janusServer);
                checkAndSetServer(url.hostname, janusServer);
            }
        } catch (e) { }

        try {
            // WebRtcTransport.serverBaseUrl = "https://gw-xxx.boosteroid.com/webrtc"
            const wrtUrl = _w.WebRtcTransport && _w.WebRtcTransport.serverBaseUrl;
            if (wrtUrl) {
                const url = new URL(wrtUrl);
                checkAndSetServer(url.hostname, wrtUrl);
            }
        } catch (e) { }

        try {
            // SessionHandler.parsePings[0].address = "https://gw-xxx.cloud.boosteroid.com:443"
            const pings = _w.SessionHandler && _w.SessionHandler.parsePings;
            if (pings && pings.length > 0 && pings[0].address) {
                const url = new URL(pings[0].address);
                checkAndSetServer(url.hostname, pings[0].address);
            }
        } catch (e) { }
    }

    // Polling: каждые 3 секунды пробуем обнаружить сервер через глобалы
    setInterval(() => {
        if (!lastServerName && !lastServerIp) {
            discoverServerFromGlobals();
        }
    }, 3000);


    // === ПОЛЬЗОВАТЕЛЬСКИЙ ИНТЕРФЕЙС ===
    function initUI() {
        if (_w.location.hostname !== 'cloud.boosteroid.com') return;
        if (document.getElementById('boosteroid-tweaks-container')) return;

        const container = document.createElement('div');
        container.id = 'boosteroid-tweaks-container';

        // Используем Shadow DOM, чтобы стили не пересекались с сайтом
        const shadow = container.attachShadow({ mode: 'open' });

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
            /* Segmented Control Slider */
            .segmented-control {
                position: relative;
                display: flex;
                background-color: #333;
                border-radius: 8px;
                padding: 3px;
                width: 170px;
                height: 26px;
            }
            .segmented-control input {
                display: none;
            }
            .segmented-control label {
                flex: 1;
                text-align: center;
                line-height: 26px;
                font-size: 12px;
                color: #aaa;
                cursor: pointer;
                z-index: 2;
                transition: color 0.3s ease;
            }
            .segmented-control input:checked + label {
                color: white;
                font-weight: bold;
            }
            .segmented-bg {
                position: absolute;
                top: 3px;
                left: 3px;
                bottom: 3px;
                width: calc(33.33% - 2px);
                background-color: #ff0055;
                border-radius: 6px;
                z-index: 1;
                transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }
            #afk-off:checked ~ .segmented-bg { transform: translateX(0); background-color: #555; }
            #afk-net:checked ~ .segmented-bg { transform: translateX(100%); }
            #afk-f15:checked ~ .segmented-bg { transform: translateX(200%); }
            
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
            #bt-btn.in-menu-mode {
                display: none !important;
            }
            #bt-panel.in-menu-mode {
                position: relative !important;
                bottom: auto !important;
                right: auto !important;
                width: 100% !important;
                box-sizing: border-box;
                display: block !important;
                box-shadow: none !important;
                border: none !important;
                background-color: transparent !important;
                margin-top: 20px;
                padding: 0;
            }
            #bt-panel.in-menu-mode .panel-header {
                border-bottom: none;
                margin-bottom: 20px;
                padding-bottom: 0;
            }
            #bt-panel.in-menu-mode h2 {
                text-transform: uppercase;
                font-size: 14px;
                font-weight: 800;
                letter-spacing: 0.5px;
                color: #fff;
            }
            #bt-panel.in-menu-mode .setting-row {
                background: transparent !important;
                border-radius: 0;
                padding: 0 !important;
                margin-bottom: 20px;
            }
            #bt-panel.in-menu-mode label {
                font-size: 14px;
                font-weight: 500;
                color: #fff;
            }
            #bt-panel.in-menu-mode select,
            #bt-panel.in-menu-mode input[type="text"] {
                background: #1a1a1f;
                border: 1px solid #3a3a40;
                font-size: 13px;
                font-weight: 500;
            }
            .panel-header {
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                border-bottom: 1px solid #444; 
                margin-bottom: 15px; 
                padding-bottom: 10px;
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
            const SUPPORTED_RESOLUTIONS = {
                '16:9': [[3840, 2160], [3200, 1800], [3200, 1440], [2560, 1440], [2048, 1152], [1920, 1080], [1600, 900], [1366, 768], [1360, 768], [1280, 720]],
                '16:10': [[3360, 2100], [3320, 2160], [2940, 1912], [2732, 2048], [2560, 1600], [2160, 1350], [2048, 1330], [2048, 1152], [1920, 1200], [1680, 1050], [1440, 900], [1280, 800]],
                '21:9 (Ultrawide)': [[3440, 1440], [2560, 1080], [2400, 1080], [1920, 864], [1600, 720]],
                '32:9 (Super Ultrawide)': [[3840, 1080]],
                '2.37:1': [[1920, 810]],
                '3:2': [[3000, 2000], [2256, 1504], [2160, 1440]],
                '4:3': [[2048, 1536], [1920, 1536], [1800, 1350], [1600, 1200], [1440, 1152], [1400, 1050], [1280, 960], [1152, 864], [1024, 768], [800, 600]],
                '5:4': [[2560, 2048], [1600, 1024], [1280, 1024]]
            };

            let resOptionsHtml = `<option value="auto" ${settings.resolution === 'auto' ? 'selected' : ''}>${t('resAuto')}</option>`;
            for (const [group, resList] of Object.entries(SUPPORTED_RESOLUTIONS)) {
                resOptionsHtml += `<optgroup label="${group}">`;
                resList.forEach(([w, h]) => {
                    const val = `${w}x${h}`;
                    resOptionsHtml += `<option value="${val}" ${settings.resolution === val ? 'selected' : ''}>${w}x${h}</option>`;
                });
                resOptionsHtml += `</optgroup>`;
            }

            panel.innerHTML = `
                <div class="panel-header">
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
                    <div class="segmented-control">
                        <input type="radio" name="antiAfkMode" id="afk-off" value="off" ${settings.antiAfkMode === 'off' ? 'checked' : ''}>
                        <label for="afk-off">${t('afkOff')}</label>
                        
                        <input type="radio" name="antiAfkMode" id="afk-net" value="intercept" ${settings.antiAfkMode === 'intercept' ? 'checked' : ''}>
                        <label for="afk-net">${t('afkNet')}</label>
                        
                        <input type="radio" name="antiAfkMode" id="afk-f15" value="f15" ${settings.antiAfkMode === 'f15' ? 'checked' : ''}>
                        <label for="afk-f15">${t('afkF15')}</label>
                        
                        <div class="segmented-bg"></div>
                    </div>
                </div>

                <div class="setting-row">
                    <label>${t('codec')}</label>
                    <select id="bt-codec" style="background: #2a2a2a; color: white; border: 1px solid #555; border-radius: 6px; padding: 4px 8px; outline: none; cursor: pointer; font-size: 13px;">
                        <option value="auto" ${settings.preferredCodec === 'auto' ? 'selected' : ''}>${t('codecAuto')}</option>
                        <option value="h265" ${settings.preferredCodec === 'h265' ? 'selected' : ''}>H.265 (HEVC)</option>
                        <option value="h264" ${settings.preferredCodec === 'h264' ? 'selected' : ''}>H.264</option>
                        <option value="av1" ${settings.preferredCodec === 'av1' ? 'selected' : ''}>AV1</option>
                    </select>
                </div>

                <div class="setting-row">
                    <label>${t('resTitle')}</label>
                    <select id="bt-resolution" style="background: #2a2a2a; color: white; border: 1px solid #555; border-radius: 6px; padding: 4px 8px; outline: none; cursor: pointer; font-size: 13px;">
                        ${resOptionsHtml}
                    </select>
                </div>

                <div class="setting-row">
                    <label>${t('bandwidth')}</label>
                    <select id="bt-bandwidth" style="background: #2a2a2a; color: white; border: 1px solid #555; border-radius: 6px; padding: 4px 8px; outline: none; cursor: pointer; font-size: 13px;">
                        <option value="0" ${!settings.bandwidthLimit ? 'selected' : ''}>${t('bwUnlimited')}</option>
                        <option value="256" ${settings.bandwidthLimit === 256 ? 'selected' : ''}>256 Kbps</option>
                        <option value="512" ${settings.bandwidthLimit === 512 ? 'selected' : ''}>512 Kbps</option>
                        <option value="1000" ${settings.bandwidthLimit === 1000 ? 'selected' : ''}>1 Mbps</option>
                        <option value="2000" ${settings.bandwidthLimit === 2000 ? 'selected' : ''}>2 Mbps</option>
                        <option value="3000" ${settings.bandwidthLimit === 3000 ? 'selected' : ''}>3 Mbps</option>
                    </select>
                </div>

                <div class="setting-row">
                    <label>${t('skipExit')}</label>
                    <label class="switch">
                        <input type="checkbox" id="bt-skipexit" ${settings.skipExitScreen ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="setting-row" style="flex-direction: column; align-items: flex-start; margin-bottom: 20px; background: #2a2a2a; padding: 10px; border-radius: 8px;">
                    <label style="margin-bottom: 5px; font-size: 13px; color: #bbb;">${t('lastServer')}</label>
                    <div style="display: flex; gap: 5px; width: 100%;">
                        <input type="text" readonly value="${lastServerName || lastServerIp || t('waiting')}" style="flex-grow: 1; background: #1a1a1a; border: 1px solid #444; color: #ddd; padding: 5px 10px; border-radius: 6px; outline: none; font-size: 13px;">
                        <button id="block-last-btn" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; ${!(lastServerName || lastServerIp) || settings.blockedServers.includes(lastServerName) || settings.blockedServers.includes(lastServerIp) ? 'opacity: 0.5; pointer-events: none;' : ''}">${t('block')}</button>
                    </div>
                    ${lastServerIp && lastServerName ? `<div style="font-size: 11px; color: #888; margin-top: 5px; font-family: monospace;">IP: ${lastServerIp}</div>` : ''}
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

            panel.querySelectorAll('input[name="antiAfkMode"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    settings.antiAfkMode = e.target.value;
                    saveSettings();
                });
            });

            panel.querySelector('#bt-codec').addEventListener('change', (e) => {
                settings.preferredCodec = e.target.value;
                saveSettings();
                console.log(`[Boosteroid Tweaks] 🎬 Кодек изменён на: ${e.target.value.toUpperCase()}. Перезапустите игру для применения.`);
            });

            panel.querySelector('#bt-resolution').addEventListener('change', (e) => {
                settings.resolution = e.target.value;
                saveSettings();
                console.log(`[Boosteroid Tweaks] 🖥️ Разрешение изменено на: ${e.target.value.toUpperCase()}. Обновите страницу для применения.`);
            });

            panel.querySelector('#bt-bandwidth').addEventListener('change', (e) => {
                settings.bandwidthLimit = parseInt(e.target.value);
                saveSettings();
                console.log(`[Boosteroid Tweaks] 📡 Лимит битрейта: ${e.target.value === '0' ? 'без ограничений' : e.target.value + ' Kbps'}. Перезапустите игру для применения.`);
            });

            panel.querySelector('#bt-skipexit').addEventListener('change', (e) => {
                settings.skipExitScreen = e.target.checked;
                saveSettings();
                console.log(`[Boosteroid Tweaks] 🚀 Пропуск окна выхода: ${settings.skipExitScreen ? 'ВКЛ' : 'ВЫКЛ'}. Обновите страницу для применения скрытия.`);
            });

            const blockLastBtn = panel.querySelector('#block-last-btn');
            if (blockLastBtn) {
                blockLastBtn.addEventListener('click', () => {
                    const toBlock = lastServerName || lastServerIp;
                    if (toBlock && !settings.blockedServers.includes(toBlock)) {
                        settings.blockedServers.push(toBlock);
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

        _w.renderPanelGlobal = renderPanel;

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
        
        let uiInjectedInMenu = false;
        
        function injectAsWidget() {
            if (container.parentNode !== document.body) {
                document.body.appendChild(container);
            }
            btn.classList.remove('in-menu-mode');
            panel.classList.remove('in-menu-mode');
            panel.style.display = 'none';
        }
        
        function injectInMenu(menuElement) {
            if (container.parentNode !== menuElement) {
                menuElement.appendChild(container);
            }
            btn.classList.add('in-menu-mode');
            panel.classList.add('in-menu-mode');
            uiInjectedInMenu = true;
        }

        const uiObserver = new MutationObserver(() => {
            const onStreaming = isStreamingPage();
            
            if (!onStreaming) {
                if (container.parentNode !== document.body) {
                    injectAsWidget();
                    uiInjectedInMenu = false;
                }
                return;
            }
            
            const menu = document.getElementById('menu');
            if (menu && menu.classList && menu.classList.contains('menu_desktop')) {
                const computedStyle = window.getComputedStyle(menu);
                if (computedStyle.display !== 'none' && menu.offsetParent !== null) {
                    if (!uiInjectedInMenu || container.parentNode !== menu) {
                        injectInMenu(menu);
                    }
                }
            } else if (!uiInjectedInMenu && container.parentNode === document.body) {
                // When game starts, hide the floating widget until menu opens
                document.body.removeChild(container);
            }
        });
        
        uiObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

        if (!isStreamingPage()) {
            injectAsWidget();
        }
    }

    // Инициализируем UI после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

})();
