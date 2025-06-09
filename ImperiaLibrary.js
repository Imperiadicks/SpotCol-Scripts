/**
 * WolfyLibrary - Библиотека для облегчения создания аддонов для Яндекс.Музыки
 * @author WolfySoCute & ImperiaDicks
 * @version 2.1.0
 * @namespace WolfyLibrary
 */

/**
 * Менеджер для управления CSS стилями темы
 * @class
 * @classdesc Позволяет добавлять, удалять и комбинировать CSS стили с возможностью управления по идентификаторам
 */
class StylesManager {
	constructor() {
		/**
		 * Хранилище стилей в формате { [id]: css }
		 * @private
		 * @type {Object.<string, string>}
		 * @example
		 * {
		 *   "button-style": "button { color: red; }",
		 *   "text-style": "p { font-size: 14px; }"
		 * }
		 */
		this._styles = {};
	}

	/**
	 * Добавляет или обновляет CSS стиль
	 * @param {string} id - Уникальный идентификатор стиля (используется для последующего обновления/удаления)
	 * @param {string} style - CSS правила
	 * @throws {TypeError} Если id не строка или style не строка
	 * @example
	 * stylesManager.add('primary-button', 'button.primary { background: blue; }');
	 */
	add(id, style) {
		this._styles[id] = style;
	}

	/**
	 * Удаляет стиль по идентификатору
	 * @param {string} id - Идентификатор стиля для удаления
	 * @returns {boolean} true если стиль был удален, false если стиль не найден
	 * @example
	 * stylesManager.remove('outdated-style');
	 */
	remove(id) {
		if (this._styles[id]) {
			delete this._styles[id];
			return true;
		}
		return false;
	}

	/**
	 * Полностью очищает все сохраненные стили
	 * @example
	 * stylesManager.clear();
	 */
	clear() {
		this._styles = {};
	}

	/**
	 * Возвращает все стили объединенные в одну строку
	 * @readonly
	 * @type {string}
	 * @example
	 * const css = stylesManager.result;
	 * // Возвращает: "button { color: red; }\n\np { font-size: 14px; }"
	 */
	get result() {
		return Object.values(this._styles).join('\n\n');
	}
}

/**
 * Базовый класс для работы с событиями (подписка, отписка, вызов).
 * @template T - Тип событий (строка или union-тип конкретных событий).
 * @template D - Тип данных, передаваемых в событие.
 */
class EventEmitter {
	constructor() {
		/** @type {Object.<T, Array<function(D): void>>} */
		this.events = {};
	}

	/**
	 * Подписаться на событие.
	 * @param {T} eventName - Название события.
	 * @param {function(D): void} callback - Функция-обработчик.
	 */
	on(eventName, callback) {
		if (!this.events[eventName]) this.events[eventName] = [];
		this.events[eventName].push(callback);
	}

	/**
	 * Отписаться от события.
	 * @param {T} eventName - Название события.
	 * @param {function(D): void} callback - Функция-обработчик.
	 */
	off(eventName, callback) {
		if (!this.events[eventName]) return;
		this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
	}

	/**
	 * Вызвать событие.
	 * @param {T} eventName - Название события.
	 * @param {D} data - Данные для передачи подписчикам.
	 */
	emit(eventName, data) {
		if (!this.events[eventName]) return;
		this.events[eventName].forEach(callback => callback(data));
	}

	/**
	 * Подписаться на событие один раз (автоматически отпишется после первого вызова).
	 * @param {T} eventName - Название события.
	 * @param {function(D): void} callback - Функция-обработчик.
	 */
	once(eventName, callback) {
		const onceCallback = (data) => {
			callback(data);
			this.off(eventName, onceCallback);
		};
		this.on(eventName, onceCallback);
	}

	/**
	 * Удалить все подписки на событие.
	 * @param {T} eventName - Название события.
	 */
	removeAllListeners(eventName) {
		delete this.events[eventName];
	}
}

/**
 * Менеджер для работы с настройками темы
 * @class
 * @extends {EventEmitter<SettingsEvent,EventData>}
 * @classdesc Обеспечивает загрузку, преобразование и отслеживание изменений настроек темы.
 * Поддерживает систему событий для реагирования на изменения.
 * 
 * @example
 * // Подписка на изменения
 * settingsManager.on('update', ({ settings, styles, state }) => {
 *   console.log('Все настройки обновлены');
 * });
 * 
 * settingsManager.on('change:color', ({ settings, styles, state }) => {
 *   console.log('Настройка изменилась:', settings.value);
 * });
 */
class SettingsManager extends EventEmitter {
	/**
	 * @param {Theme} theme - Экземпляр основного класса
	 */
	constructor(theme) {
		super();
		/**
		 * Экземпляр основного класса
		 * @type {Theme}
		 */
		this.theme = theme;

		/**
		 * Текущие настройки в преобразованном формате
		 * @type {Object.<string, Setting | TextFields>}
		 */
		this.settings = {};

		/**
		 * Предыдущие значения настроек (для сравнения изменений)
		 * @type {Object.<string, Setting | TextFields>}
		 */
		this.old_settings = {};
	}

	/**
	 * Загружает и обновляет настройки с сервера
	 * @async
	 * @throws {Error} При ошибке сети или неверном формате данных
	 * @emits SettingsManager#update При любом обновлении настроек
	 * @emits SettingsManager#change:[id] При изменении конкретной настройки
	 * @example
	 * await settingsManager.update();
	 */
// В классе SettingsManager:
async update() {
    try {
        // ----------------------------------------------------------------
        // вместо fetch('http://127.0.0.1:2007/get_handle?name=...')
        // загружаем напрямую наш handleEvents.json из ассетов темы:
        const data = await this.theme.assetsManager.getContent('handleEvents.json');
        // ----------------------------------------------------------------

        if (!data?.sections) {
            console.warn("Структура handleEvents.json не соответствует ожидаемой");
            return null;
        }

        // сохраняем предыдущие настройки и преобразуем новый JSON в плоский объект
        this.old_settings = this.settings;
        this.settings    = this.transformJSON(data);

        // эмитим глобальный апдейт настроек...
        this.emit('update', {
            settings: this.theme.settingsManager,
            styles:   this.theme.stylesManager,
            state:    this.theme.player.state
        });

        // и вызываем change-события для всех изменённых ключей
        for (const id in this.settings) {
            if (this.hasChanged(id)) {
                this.emit(`change:${id}`, {
                    settings: this.theme.settingsManager,
                    styles:   this.theme.stylesManager,
                    state:    this.theme.player.state
                });
            }
        }
    } catch (error) {
        console.error(error);
        return null;
    }
}


	/**
	 * Преобразует сложную структуру настроек из API в плоский объект
	 * @private
	 * @param {Object} input - Исходные данные от API
	 * @param {Array} input.sections - Секции настроек
	 * @returns {Object.<string, Setting | TextFields>} Преобразованные настройки
	 * @example
	 * // Возвращает:
	 * {
	 *   "volume": { value: 80, default: 50 },
	 *   "theme.color": { value: "dark", default: "light" }
	 * }
	 */
	transformJSON(input) {
		const result = {};

		try {
			input.sections.forEach(section => {
				section.items.forEach(item => {
					if (item.type === "text" && item.buttons) {
						result[item.id] = {};
						item.buttons.forEach(button => {
							result[item.id][button.id] = {
								value: button.text,
								default: button.defaultParameter
							};
						});
					} else {
						result[item.id] = {
							value: item.bool != undefined ? item.bool :
								item.filePath != undefined ? item.filePath :
									item.input != undefined ? item.input :
										item.selected != undefined ? item.selected :
											item.value,
							default: item.defaultParameter
						};
					}
				});
			});
		} catch (error) {
			console.error("Failed to transform JSON:", error);
		}

		return result;
	}

	/**
	 * Получает значение настройки по пути
	 * @param {string} id - Путь к настройке через точки (например 'theme.color')
	 * @returns {Setting | TextFields | undefined} Значение настройки или undefined если не найдено
	 * @example
	 * const volume = settingsManager.get('volume');
	 * const color = settingsManager.get('theme.color');
	 */
	get(id) {
		const keys = id.split('.');
		let value = this.settings;

		for (const key of keys) {
			value = value[key];
		}

		return value;
	}

	/**
	 * Проверяет изменилось ли значение настройки
	 * @param {string} id - Путь к настройке через точки
	 * @returns {boolean} true если значение изменилось
	 * @example
	 * if (settingsManager.hasChanged('theme.color')) {
	 *   console.log('Цвет темы изменился!');
	 * }
	 */
	hasChanged(id) {
		const hasSettings = Object.keys(this.settings).length > 0;
		if (!hasSettings) return true;

		const keys = id.split('.');
		let value = this.settings;
		let oldValue = this.old_settings;

		for (const key of keys) {
			if (value === undefined || oldValue === undefined) return true;
			value = value[key];
			oldValue = oldValue[key];
		}

		return value?.value !== oldValue?.value;
	};
}

/**
 * Менеджер для работы с ассетами (файлами) темы.
 * @class
 * @classdesc Позволяет получать содержимое файлов и ссылки на них, а также список всех доступных файлов.
 */
class AssetsManager {
	constructor() {
		/**
		 * Базовый URL для доступа к ассетам.
		 * @private
		 * @type {string}
		 */
		this._urlBase = 'http://127.0.0.1:2007/assets';
	}

	/**
	 * Получает содержимое файла.
	 * @async
	 * @param {string} fileName - Имя файла, содержимое которого нужно получить.
	 * @returns {Promise<string|void>} Содержимое файла в виде строки, либо в json если файл JSON.
	 * @throws {Error} Если произошла ошибка сети или файл не найден.
	 * @example
	 * const content = await assetsManager.getContent('info.json');
	 * console.log(content);
	 */
	async getContent(fileName) {
		try {
			const response = await fetch(`${this._urlBase}/${fileName}`);
			if (!response.ok) {
				throw new Error(`Ошибка сети: ${response.status}`);
			}

			const contentType = response.headers.get("Content-Type");

			if (contentType && contentType.includes("application/json")) {
				return await response.json();
			} else {
				return await response.text();
			}
		} catch (error) {
			console.error("Ошибка при получении данных:", error);
			throw error;
		}
	}

	/**
	 * Получает ссылку на файл.
	 * @param {string} fileName - Имя файла.
	 * @returns {string} Полный URL файла.
	 * @example
	 * const link = assetsManager.getLink('image.png');
	 * console.log(link); // http://127.0.0.1:2007/assets/image.png
	 */
	getLink(fileName) {
		return `${this._urlBase}/${fileName}`;
	}

	/**
	 * Получает список всех доступных файлов.
	 * @async
	 * @returns {Promise<string[]>} Массив имен файлов.
	 * @throws {Error} Если произошла ошибка сети.
	 * @example
	 * const files = await assetsManager.files;
	 * console.log(files); // ['style.css', 'image.png', 'data.json']
	 */
	get files() {
		return fetch(this._urlBase)
			.then(response => {
				if (!response.ok) {
					throw new Error(`Ошибка сети: ${response.status}`);
				}

				return response.json();
			})
			.then(data => { return data.files })
			.catch((reason) => {
				console.error("Ошибка при получении данных:", reason);
			});
	}
}

/**
 * Класс для работы с событиями плеера.
 * @extends {EventEmitter<PlayerEvent,EventData>}
 */
class PlayerEvents extends EventEmitter {
	/**
	 * @param {Theme} theme - Экземпляр основного класса
	 */
	constructor(theme) {
		super();
		/**
		 * Менеджер настроек
		 * @type {SettingsManager}
		 */
		this.settingsManager = theme.settingsManager;

		/**
		 * Менеджер стилей
		 * @type {StylesManager}
		 */
		this.stylesManager = theme.stylesManager;

		/**
		 * Текущее состояние плеера
		 * @type {PlayerState}
		 */
		this.state = {
			speed: 1,
			status: "paused",
			page: '',
			volume: 0,
			progress: {
				duration: 0,
				loaded: 0,
				position: 0,
				played: 0
			},
			shuffle: false,
			repeat: '',
			track: {
				albums: [],
				artists: [],
				available: true,
				availableForOptions: [],
				availableForPremiumUsers: true,
				availableFullWithoutPermission: false,
				coverUri: "",
				derivedColors: { average: '', waveText: '', miniPlayer: '', accent: '' },
				disclaimers: [],
				durationMs: 0,
				fade: { inStart: 0, inStop: 0, outStart: 0, outStop: 0 },
				fileSize: 0,
				id: "",
				lyricsAvailable: true,
				lyricsInfo: { hasAvailableSyncLyrics: true, hasAvailableTextLyrics: true },
				major: { id: 0, name: '' },
				ogImage: "",
				previewDurationMs: 0,
				r128: { i: 0, tp: 0 },
				realId: "",
				rememberPosition: true,
				specialAudioResources: [],
				storageDir: "",
				title: "",
				trackSharingFlag: "",
				trackSource: "",
				type: "",
				version: ""
			}
		}

		this._registerEvents();
	}

	/**
	 * Генерирует кастомное событие с данными.
	 * @private
	 * @param {PlayerEvent} eventName - Название события.
	 */
	_dispatchCustomEvent(eventName) {
		this.emit(eventName, {
			settings: this.settingsManager,
			styles: this.stylesManager,
			state: this.state
		});
	}

	/**
	 * Инициализирует отслеживание событий плеера
	 * @private
	 */
	_registerEvents() {
		const start = setInterval(() => {
			if (window?.player && window?.player?.state?.queueState?.currentEntity?.value?.entity?.data?.meta) {
				clearInterval(start);
				const playerState = window.player.state.playerState;
				const queueState = window.player.state.queueState;

				this.state.track = queueState.currentEntity.value.entity.data.meta;
				this.state.page = window.location.pathname;
				console.log(this.state.page);

				playerState.event.onChange((event => {
					if (event == 'audio-set-progress') {
						this._dispatchCustomEvent('seek');
					}
				}));

				playerState.progress.onChange((progress => {
					this.state.progress = progress;
					this._dispatchCustomEvent('progressChange');
				}));

				playerState.status.onChange((status => {
					this.state.status = status
					switch (status) {
						case "playing":
							this._dispatchCustomEvent('play');
							break;
						case "paused":
						case "ended":
							this._dispatchCustomEvent('pause');
							break;
						case "loadingMediaData":
							this.state.status = "paused";
							this.state.track = queueState.currentEntity.value.entity.data.meta;

							this._dispatchCustomEvent('trackChange');
							break;
						default:
							return;
					}
				}));

				playerState.volume.onChange((volume => {
					this.state.volume = Math.round(100 * volume) / 100;
					this._dispatchCustomEvent('volumeChange');
				}));

				queueState.shuffle.onChange((shuffle => {
					this.state.shuffle = shuffle;
					this._dispatchCustomEvent('shuffleChange');
				}));

				queueState.repeat.onChange((repeat => {
					this.state.repeat = repeat;
					this._dispatchCustomEvent('repeatChange');
				}));



				/* НАЧАЛО ЧАСТИ ИВЕНТОВ ПЛЕЕРА */
				const playerCheck = (node) => {
					if (node.querySelector) return !node?.matches('[data-floating-ui-portal]') ? node.querySelector('[data-test-id="FULLSCREEN_PLAYER_MODAL"]') : null;
				};
				const textCheck = (node) => {
					return node.querySelector ? node.querySelector('[data-test-id="SYNC_LYRICS_CONTENT"]') : null;
				};
				const queueCheck = (node) => {
					return node.querySelector ? node.querySelector('.PlayQueue_root__ponhw') : null;
				};

				const handleMutations = (mutations) => {
					for (const mutation of mutations) {
						for (const node of mutation.addedNodes) {
							const playerElement = playerCheck(node);
							const textElement = textCheck(node);
							const queueElement = queueCheck(node);

							if (playerElement) this._dispatchCustomEvent('openPlayer');
							else if (textElement) this._dispatchCustomEvent('openText');
							else if (queueElement) this._dispatchCustomEvent('openQueue');
						}

						for (const node of mutation.removedNodes) {
							const playerElement = playerCheck(node);
							const textElement = textCheck(node);
							const queueElement = queueCheck(node);

							if (playerElement) this._dispatchCustomEvent('closePlayer');
							else if (textElement) this._dispatchCustomEvent('closeText');
							else if (queueElement) this._dispatchCustomEvent('closeQueue');

						}
					}
				};

				const observer = new MutationObserver(handleMutations);
				observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				/* КОНЕЦ ЧАСТИ ИВЕНТОВ ПЛЕЕРА */



				/* НАЧАЛО ЧАСТИ ИВЕНТА СМЕНЫ СТРАНИЦЫ */
				const pushState = history.pushState;
				const replaceState = history.replaceState;

				const self = this; // Сохранить ссылку на экземпляр класса. Костыль, но иначе вылезает ошибка

				history.pushState = function (...args) {
					pushState.apply(this, args);
					self.state.page = window.location.pathname;
					self._dispatchCustomEvent('pageChange');
				};

				history.replaceState = function (...args) {
					replaceState.apply(this, args);
					self.state.page = window.location.pathname;
					self._dispatchCustomEvent('pageChange');
				};

				// Назад/вперёд
				window.addEventListener('popstate', () => {
					self.state.page = window.location.pathname;
					self._dispatchCustomEvent('pageChange');
				});
				/* КОНЕЦ ЧАСТИ ИВЕНТА СМЕНЫ СТРАНИЦЫ */
			}
		});
	};
}

/**
 * Основной класс темы
 * @class
 * @classdesc Предоставляет API для создания тем, управления стилями и реагирования на события
 */
/* ======================================================================
   Класс Theme  —  ядро любой темы ImperiaLibrary
   ====================================================================== */

class Theme {
    /**
     * @param {string} id  — уникальный идентификатор темы (папка/название)
     */
    constructor(id) {
        /** @type {string} */
        this.id = id;

        /* ── менеджеры ─────────────────────────────────────────────── */
        /** @type {StylesManager}   */ this.stylesManager   = new StylesManager();
        /** @type {AssetsManager}   */ this.assetsManager   = new AssetsManager();
        /** @type {SettingsManager} */ this.settingsManager = new SettingsManager(this);
        /** @type {PlayerEvents}    */ this.player          = new PlayerEvents(this);
        /** @type {HandleEventsManager} */ this.handleEvents = new HandleEventsManager(this);

        /* ── внутренние структуры ──────────────────────────────────── */
        /** @type {Object.<string, ThemeAction>} */
        this.actions = {};              // пользовательские действия

        /** @private */ this._updateTimer = null;

        this.emitter = new EventEmitter();
    }

    /* -----------------------------------------------------------------
       PUBLIC API
       ----------------------------------------------------------------- */

    /**
     * Регистрирует действие — callback, вызываемый при изменении настройки
     * @param {string} id
     * @param {ThemeAction} callback
     */
    addAction(id, callback) {
        this.actions[id] = callback;
    }

    /**
     * Немедленно применяет все стили из stylesManager
     * (вызывается внутри update и при старте)
     */
    applyStyles() {
        let styleEl = document.getElementById(`${this.id}-styles`);
        if (!styleEl) {
            styleEl        = document.createElement('style');
            styleEl.id     = `${this.id}-styles`;
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = this.stylesManager.result;
    }

    /**
     * Применяет все registered actions (действия темы)
     */
    applyTheme() {
        const settings = this.settingsManager.settings;

        for (const id in this.actions) {
            const action = this.actions[id];
            const changed = this.settingsManager.hasChanged?.(id);
            try {
                action({ settings, changed, styles: this.stylesManager, state: this.player.state });
            } catch (err) {
                console.error(`[Theme:${this.id}] Action "${id}" failed:`, err);
            }
        }

        // итоговые стили
        this.applyStyles();
    }

    /**
     * Загружает настройки, обрабатывает Open-Blocker и «Действия»,
     * затем вызывает applyTheme()
     */
    async update() {
        await this.settingsManager.update();
        const newSettings = this.settingsManager.settings;
        if (!newSettings) return;              // конфиг не пришёл

        /* общий обработчик handleEvents (Open-Blocker + «Действия») */
        this.handleEvents.apply(newSettings);

        /* действия конкретной темы */
        this.applyTheme();

        /* эмитим глобальное событие */
        this.emitter.emit('update', {
            settings: newSettings,
            styles:   this.stylesManager,
            state:    this.player.state,
        });
    }

    /**
     * Запускает периодическое обновление темы
     * @param {number} interval  — период в мс (по умолчанию 1000)
     */
    start(interval = 1000) {
        if (this._updateTimer) clearInterval(this._updateTimer); // перезапуск

        // первое применение сразу
        this.update().catch(console.error);

        // периодический цикл
        this._updateTimer = setInterval(() => this.update().catch(console.error),
                                         interval);
    }

    /**
     * Останавливает цикл обновления
     */
    stop() {
        if (this._updateTimer) clearInterval(this._updateTimer);
        this._updateTimer = null;
    }
}


/**
 * Информация о прогрессе воспроизведения
 * @typedef {Object} ProgressInfo
 * @property {number} duration - Полная длительность трека в секундах
 * @property {number} loaded - Загруженная часть трека в секундах
 * @property {number} position - Текущая позиция в секундах
 * @property {number} played - Проигранная часть трека в секундах
 */

/**
 * Полная информация о музыкальном треке
 * @typedef {Object} TrackInfo
 * @property {string} id - Уникальный идентификатор трека
 * @property {string} realId - Оригинальный ID трека (может совпадать с id)
 * @property {string} title - Название трека
 * @property {MajorInfo} major - Информация о лейбле/дистрибьюторе
 * @property {boolean} available - Доступен ли трек для прослушивания
 * @property {boolean} availableForPremiumUsers - Доступен только для премиум пользователей
 * @property {boolean} availableFullWithoutPermission - Доступен ли трек полностью без ограничений
 * @property {string[]} availableForOptions - Доступные опции (например, ['bookmate'])
 * @property {Object[]} disclaimers - Предупреждения/ограничения для трека
 * @property {string} storageDir - Директория хранения трека
 * @property {number} durationMs - Длительность трека в миллисекундах
 * @property {number} fileSize - Размер файла трека в байтах
 * @property {R128Info} r128 - Информация о громкости по стандарту R128
 * @property {FadeInfo} fade - Настройки фейдов (плавного появления/исчезновения)
 * @property {number} previewDurationMs - Длительность превью трека
 * @property {ArtistInfo[]} artists - Массив исполнителей
 * @property {AlbumInfo[]} albums - Массив альбомов
 * @property {string} coverUri - URI обложки трека
 * @property {DerivedColors} derivedColors - Автоматически вычисленные цвета для интерфейса
 * @property {string} ogImage - URI изображения для OpenGraph
 * @property {boolean} lyricsAvailable - Доступны ли тексты песни
 * @property {string} type - Тип контента (music/podcast/etc)
 * @property {boolean} rememberPosition - Запоминать ли позицию прослушивания
 * @property {string} trackSharingFlag - Флаг доступности шаринга (COVER_ONLY и др.)
 * @property {LyricsInfo} lyricsInfo - Информация о доступности текстов
 * @property {string} trackSource - Источник трека (OWN - собственный и др.)
 * @property {string[]} specialAudioResources - Специальные аудио ресурсы (smart_preview и др.)
 */

/**
 * Информация о лейбле/дистрибьюторе
 * @typedef {Object} MajorInfo
 * @property {number} id - ID лейбла
 * @property {string} name - Название лейбла
 */

/**
 * Информация о громкости по стандарту R128
 * @typedef {Object} R128Info
 * @property {number} i - Integrated loudness (LUFS)
 * @property {number} tp - True peak (dBTP)
 */

/**
 * Настройки фейдов трека
 * @typedef {Object} FadeInfo
 * @property {number} inStart - Начало фейда в секундах
 * @property {number} inStop - Конец фейда в секундах
 * @property {number} outStart - Начало затухания в секундах
 * @property {number} outStop - Конец затухания в секундах
 */

/**
 * Информация об исполнителе
 * @typedef {Object} ArtistInfo
 * @property {number} id - ID исполнителя
 * @property {string} name - Имя исполнителя
 * @property {boolean} various - Является ли сборником
 * @property {boolean} composer - Является ли композитором
 * @property {boolean} available - Доступен ли исполнитель
 * @property {ArtistCover} cover - Обложка исполнителя
 * @property {string[]} genres - Жанры исполнителя
 * @property {Object[]} disclaimers - Ограничения для исполнителя
 */

/**
 * Обложка исполнителя
 * @typedef {Object} ArtistCover
 * @property {string} type - Тип обложки (from-album-cover и др.)
 * @property {string} uri - URI обложки
 * @property {string} prefix - Префикс URI
 */

/**
 * Информация об альбоме
 * @typedef {Object} AlbumInfo
 * @property {number} id - ID альбома
 * @property {string} title - Название альбома
 * @property {string} type - Тип альбома (single/album и др.)
 * @property {string} metaType - Тип метаданных (music)
 * @property {number} year - Год выпуска
 * @property {string} releaseDate - Дата релиза в ISO формате
 * @property {string} coverUri - URI обложки альбома
 * @property {string} ogImage - URI изображения для OpenGraph
 * @property {string} genre - Основной жанр
 * @property {number} trackCount - Количество треков
 * @property {number} likesCount - Количество лайков
 * @property {boolean} recent - Является ли новым
 * @property {boolean} veryImportant - Является ли важным
 * @property {ArtistInfo[]} artists - Исполнители альбома
 * @property {LabelInfo[]} labels - Лейблы альбома
 * @property {boolean} available - Доступен ли альбом
 * @property {boolean} availableForPremiumUsers - Доступен только для премиум пользователей
 * @property {string[]} availableForOptions - Доступные опции
 * @property {boolean} availableForMobile - Доступен ли на мобильных устройствах
 * @property {boolean} availablePartially - Доступен ли частично
 * @property {Object[]} bests - Лучшие треки
 * @property {Object[]} disclaimers - Ограничения
 * @property {boolean} listeningFinished - Был ли дослушан до конца
 * @property {TrackPosition} trackPosition - Позиция трека в альбоме
 */

/**
 * Информация о лейбле
 * @typedef {Object} LabelInfo
 * @property {number} id - ID лейбла
 * @property {string} name - Название лейбла
 */

/**
 * Позиция трека в альбоме
 * @typedef {Object} TrackPosition
 * @property {number} volume - Номер диска
 * @property {number} index - Номер трека
 */

/**
 * Автоматически вычисленные цвета для интерфейса
 * @typedef {Object} DerivedColors
 * @property {string} average - Средний цвет
 * @property {string} waveText - Цвет текста для волны
 * @property {string} miniPlayer - Цвет для мини-плеера
 * @property {string} accent - Акцентный цвет
 */

/**
 * Информация о текстах песни
 * @typedef {Object} LyricsInfo
 * @property {boolean} hasAvailableSyncLyrics - Доступны ли синхронизированные тексты
 * @property {boolean} hasAvailableTextLyrics - Доступен ли обычный текст
 */

/**
 * Функция-обработчик действия темы
 * @callback ThemeAction
 * @param {ActionArgs} data - Вся доступная информация
 * @returns {void}
 * @example
 * function handleThemeColorChange({ setting, changed, styles, settings, state }) {
 *   if (changed) {
 *     const color = settings.get('theme.color').value;
 *     styles.add('main-theme', `body { background: ${color}; }`);
 *   }
 * }
 */

/**
 * Аргументы для обработчика
 * @typedef {Object} ActionArgs
 * @property {Setting | TextFields} setting - Текущая настройка
 * @property {boolean} changed - Флаг изменения значения настройки
 * @property {StylesManager} styles - Менеджер стилей темы
 * @property {SettingsManager} settings - Менеджер настроек темы
 * @property {PlayerState} state - Текущее состояние плеера
 */

/**
 * Текущее состояние плеера
 * @typedef {Object} PlayerState
 * @property {string} status - Статус ('playing', 'paused' и т.п.)
 * @property {string} page - Страница
 * @property {number} volume - Уровень громкости (0-1)
 * @property {TrackProgress} progress - Прогресс воспроизведения
 * @property {boolean} shuffle - Режим перемешивания
 * @property {string} repeat - Режим повтора ('none', 'one', 'all')
 * @property {TrackInfo} track - Информация о текущем треке
 */

/**
 * Настройка
 * @typedef {Object} Setting
 * @property {string | boolean | number} value - Текущее значение
 * @property {string | boolean | number} default - Значение по умолчанию
 */

/**
 * Контейнер текстовых полей.
 * @typedef {Object.<string, Object.<string, { value: string, default: string }>>} TextFields
 */

/**
 * Доступные события плеера.
 * @typedef {(
 *   'play' | 'pause' | 'seek' | 'trackChange' | 'volumeChange' |
 *   'shuffleChange' | 'repeatChange' | 'progressChange' |
 *   'openPlayer' | 'closePlayer' | 'openText' | 'closeText' |
 *   'openQueue' | 'closeQueue' | 'pageChange'
 * )} PlayerEvent
 */

/**
 * Данные, передаваемые в события плеера.
 * @typedef {Object} EventData
 * @property {SettingsManager} settings - Менеджер настроек.
 * @property {StylesManager} styles - Менеджер стилей.
 * @property {PlayerState} state - Текущее состояние плеера.
 */

/**
 * Доступные события плеера.
 * @typedef {(
 *   'update' | 'change:[id]'
 * )} SettingsEvent
 */

/**
 * Событие полного обновления настроек
 * @event SettingsManager#update
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие изменения конкретной настройки
 * @event SettingsManager#change:[id]
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 * @example
 * // Для настройки с id 'volume' будет событие 'change:volume'
 * settingsManager.on('change:volume', ({ settings, styles, state }) => {
 *   console.log(setting.value, setting.default);
 * });
 */



/**
 * Событие начала проигрывания трека
 * @event PlayerEvents#play
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие паузы трека
 * @event PlayerEvents#pause
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие перемотки трека
 * @event PlayerEvents#seek
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие смены трека
 * @event PlayerEvents#trackChange
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие изменения громкости
 * @event PlayerEvents#volumeChange
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие изменения режима перемешивания
 * @event PlayerEvents#shuffleChange
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие изменения режима повтора
 * @event PlayerEvents#repeatChange
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие изменения прогресса трека (вызывается пока трек играет)
 * @event PlayerEvents#changeProgress
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие открытия плеера
 * @event PlayerEvents#openPlayer
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие закрытие плеера
 * @event PlayerEvents#closePlayer
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие открытия текста
 * @event PlayerEvents#openText
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие закрытия текста
 * @event PlayerEvents#closeText
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие открытия очереди
 * @event PlayerEvents#openQueue
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */

/**
 * Событие закрытия очереди
 * @event PlayerEvents#closeQueue
 * @type {Object}
 * @param {EventData} data - Менеджер настроек.
 */
const asd = 0;
/* ────────────────────────────────────────────────────────────────
   HandleEventsManager — общая обработка настроек из handleEvents.json
   ──────────────────────────────────────────────────────────────── */
// В файле ImperiaLibrary.js, внутри класса HandleEventsManager
class HandleEventsManager {
    constructor(theme) {
        this.theme = theme;

        // карта ключей из handleEvents.json → slug для Open-Blocker
        this.moduleMap = {
            OBpodcasts:    'podcasts',
            OBdonations:   'donations',
            OBconcerts:    'concerts',
            OBmywave:      'mywave',
            OBshorts:      'shorts',
            OBvideos:      'videos',
            OBuserprofile: 'userprofile',
            OBtrailers:    'trailers',
            OBvibeanimation:'vibeanimation',
            // …добавьте остальные из вашего handleEvents.json
        };
    }

    applyOpenBlocker(settings) {
        Object.entries(this.moduleMap).forEach(([key, slug]) => {
            const cssId   = `openblocker-${slug}`;
            const setting = settings[key];
            const hide    = setting?.value === false;

            if (hide && !document.getElementById(cssId)) {
                // можно подгружать ваш собственный CSS или просто скрывать:
                this.theme.stylesManager.add(cssId, `
                    .${slug} { display: none !important; }
                `);
            } else if (!hide) {
                this.theme.stylesManager.remove(cssId);
            }
        });
    }

    applyPlayerBackground(settings) {
        const on  = settings['togglePlayerBackground']?.value === true;
        const css = `
            .FullscreenPlayerDesktopContent_syncLyrics__6dTfH,
            .FullscreenPlayerDesktopContent_info__Dq69p,
            .PlayQueue_root__ponhw {
                background: ${on ? 'none !important' : 'initial'};
            }
        `;
        this.theme.stylesManager.add('toggle-player-background', css);
    }

    applyNewButtonHeight(settings) {
        const tall = settings['Newbuttona']?.value === true;
        const css  = tall
            ? `.MainPage_vibe__XEBbh { transform: scale(1.2); }`
            : `.MainPage_vibe__XEBbh { transform: scale(1); }`;
        this.theme.stylesManager.add('newbutton-height', css);
    }

    applyNewButtonHide(settings) {
        const show = settings['NewbuttonHide']?.value === true;
        const css  = show
            ? `body > div.WithTopBanner_root__P__x3 { display: block; }`
            : `body > div.WithTopBanner_root__P__x3 { display: none !important; }`;
        this.theme.stylesManager.add('newbutton-hide', css);
    }

    apply(settings) {
        // запускаем все 4 блока
        this.applyOpenBlocker(settings);
        this.applyPlayerBackground(settings);
        this.applyNewButtonHeight(settings);
        this.applyNewButtonHide(settings);
    }
}
/* ======================================================================
   Экспортируем в глобальный namespace, если ещё не экспортирован
   ====================================================================== */
(function (global) {
    global.ImperiaLibrary = Object.assign(global.ImperiaLibrary || {}, {
        Theme,
        StylesManager,
        SettingsManager,
        HandleEventsManager,
        PlayerEvents,
        AssetsManager,
        EventEmitter
    });
})(typeof window !== 'undefined' ? window : globalThis);