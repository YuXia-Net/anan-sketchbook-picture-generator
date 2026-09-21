  const ANAN_BUILD_VERSION = '20260818-1';
  const versionedAsset = (src) => {
    if (!src || /^(?:https?:|data:|blob:)/i.test(src)) return src;
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}v=${ANAN_BUILD_VERSION}`;
  };
  window.ANAN_BUILD_VERSION = ANAN_BUILD_VERSION;

// 页面背景
  (function loadBgAsync() {
    const img = new Image();
    img.onload = () => document.body.classList.add('bg-loaded');
    img.src = versionedAsset('assets/images/bg.png');
  })();

  const StorageManager = {
    KEY: 'ananMemeSettings',

    getDefaults() {
      return {
        text: '',
        fontFamily: "'Noto Sans SC', 'Noto Color Emoji', sans-serif",
        fontColor: '#2c3e50',
        textAlign: 'center',
        fontSize: '32',
        lineHeight: '1.0',
        posY: '452',
        emotion: '开心.png',
        filterPreset: 'none',
        filterBrightness: 100,
        filterContrast: 100,
        filterSaturate: 100
      };
    },

    save(data) {
      try {
        localStorage.setItem(this.KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
        return true;
      } catch (e) {
        console.error('保存设置失败:', e);
        return false;
      }
    },

    load() {
      try {
        const saved = localStorage.getItem(this.KEY);
        if (!saved) return this.getDefaults();
        return { ...this.getDefaults(), ...JSON.parse(saved) };
      } catch (e) {
        return this.getDefaults();
      }
    },

    clear() {
      try { localStorage.removeItem(this.KEY); } catch (e) {}
    }
  };

  // 浏览器本地工程存储
  const ProjectStore = {
    DB_NAME: 'ananStudioDB',
    STORE_NAME: 'projects',
    KEY: 'current-project',

    open() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
        const request = indexedDB.open(this.DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) db.createObjectStore(this.STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open project store'));
      });
    },

    async withStore(mode, operation) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, mode);
        const store = transaction.objectStore(this.STORE_NAME);
        const request = operation(store);
        let result;
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => { db.close(); reject(request.error || new Error('Project store operation failed')); };
        transaction.oncomplete = () => { db.close(); resolve(result); };
        transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Project transaction failed')); };
        transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Project transaction aborted')); };
      });
    },

    save(project) { return this.withStore('readwrite', store => store.put(project, this.KEY)); },
    load() { return this.withStore('readonly', store => store.get(this.KEY)); },
    clear() { return this.withStore('readwrite', store => store.delete(this.KEY)); }
  };

  class UndoHistory {
    constructor(maxSize = 50) {
      this.stack = [];
      this.index = -1;
      this.maxSize = maxSize;
    }

    push(value) {
      if (this.index >= 0 && this.stack[this.index] === value) return;
      this.stack.splice(this.index + 1);
      this.stack.push(value);
      if (this.stack.length > this.maxSize) this.stack.shift();
      this.index = this.stack.length - 1;
    }

    undo() { return this.index > 0 ? this.stack[--this.index] : null; }
    redo() { return this.index < this.stack.length - 1 ? this.stack[++this.index] : null; }
    canUndo() { return this.index > 0; }
    canRedo() { return this.index < this.stack.length - 1; }
  }

  // 图片缓存
  const ImageCache = {
    cache: new Map(),
    MAX_SIZE: 20,

    load(src) {
      if (this.cache.has(src)) return Promise.resolve(this.cache.get(src));
      return new Promise((resolve) => {
        const img = new Image();
        // 跨域图片启用匿名请求
        if (src.startsWith('http') && !src.includes(location.hostname)) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
          if (this.cache.size >= this.MAX_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
          this.cache.set(src, img);
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = versionedAsset(src);
      });
    }
  };

  const PRESET_TEXTS = [
    {
      name: '😭 感动落泪',
      preview: '坚强... 感动哭了喵',
      text: '[蓝色开始][删除线开始]坚强[删除线结束][蓝色结束]\n[紫色开始]感动哭了喵[紫色结束]\n[洗脑魔法开始]太好了太好了[洗脑魔法结束]'
    },
    {
      name: '1.0版本的示例文字',
      preview: '梦开始的地方',
      text: '[黄色开始]示例文字[黄色结束]\n[渐变开始]给我次香咕[渐变结束]\n[下划线开始]给我次零语[下划线结束]\n[红色开始][删除线开始]关注魔裁新春会喵[删除线结束][红色结束]'
    },
    {
      name: '🍬 香咕安利',
      preview: '香咕真的很好吃喵！',
      text: '[渐变开始][粗体开始]香咕真的很好吃！[粗体结束][渐变结束]\n[洗脑魔法开始]给我次香咕[洗脑魔法结束]\n[黄色开始]🍬🍬🍬[黄色结束]'
    },
    {
      name: '🌸 日常问候',
      preview: '早安！今天也要加油哦',
      text: '[粉色开始][粗体开始]早安！[粗体结束][粉色结束]\n[绿色开始]今天也要加油哦～[绿色结束]\n[黄色开始]🌸 一起努力 🌸[黄色结束]'
    },
    {
      name: '🔴 不可摧毁的硬币',
      preview: '强？！！？不好孩子，我并非不可摧毁',
      text: '🔴[棕色开始][下划线开始]不可摧毁的硬币[下划线结束][棕色结束]'
    },
    {
      name: '🟡 硬币正面',
      preview: '大功率发生小概率事件',
      text: '🟡[棕色开始][下划线开始]硬币[下划线结束][棕色结束]'
    },
    {
      name: '🟠 硬币反面',
      preview: '不知道说什么',
      text: '🟠[棕色开始][下划线开始]硬币[下划线结束][棕色结束]'
    },
    {
      name: '🌬️ 呼吸法',
      preview: '暴击率+25%（每层+5%），暴击时层数-1',
      text: '🌬[棕色开始][下划线开始]呼吸[下划线结束][棕色结束]'
    },
    {
      name: '🐖贼大的群友㊗㊗(推荐!!!)',
      preview: '发现群友！😋',
      text: '\n\n\n\n[文字大小=200开始]🐖[文字大小=200结束]'
    },
   {
      name: '🐖XXX群友是㊗(推荐!!!)',
      preview: '献给最好的群友！😋',
      text: '\n\n\n[文字大小=32开始]群友A[文字大小=32结束]=[文字大小=100开始]🐖[文字大小=100结束]'
    },
    {
      name: '贡献快捷预设文字➕',
      preview: '谢谢你们的支持！',
      text: '[文字大小=20开始]请在b站视频:https://b23.tv/5qzXj6s[文字大小=20结束]\n[文字大小=20开始]评论区底下评论提交[文字大小=20结束]\n[文字大小=20开始]没有b站？[文字大小=20结束]\n[文字大小=20开始]也可以通过邮箱：luo@xia.kim提交[文字大小=20结束]'
    },
    {
      name: '🐖🐖猪猪贴贴(推荐!!!)',
      preview: '群友，贴贴！',
      text: '\n\n[文字大小=100开始][左右镜像开始]🐖[左右镜像结束][文字大小=100结束][文字大小=100开始]🐖[文字大小=100结束]\n\n[文字大小=36开始][粉色开始]猪贴贴~[粉色结束][文字大小=36结束]'
    },
    {
      name: '🐖🐖敲打猪猪群友!(推荐!!!)',
      preview: '群友，坏！',
      text: '\n\n[文字大小=100开始][左右镜像开始]🐖[左右镜像结束][文字大小=100结束][上下偏移=-20开始][左右偏移=-20开始]🔨[左右偏移=-20结束][上下偏移=-20结束][文字大小=100开始][左右偏移=-30开始]🐖[左右偏移=-30结束][文字大小=100结束]\n\n[文字大小=36开始][粉色开始]敲打猪猪群友![粉色结束][文字大小=36结束]'
    },
  ];

  const FILTER_PRESETS = {
    none:      { brightness: 100, contrast: 100, saturate: 100 },
    grayscale: { brightness: 100, contrast: 110, saturate: 0   },
    sepia:     { brightness: 95,  contrast: 110, saturate: 40  },
    warm:      { brightness: 105, contrast: 100, saturate: 130 },
    cool:      { brightness: 98,  contrast: 100, saturate: 80  },
    vivid:     { brightness: 105, contrast: 130, saturate: 180 }
  };

  const FONT_PREVIEW_TEXT = {
    "'Noto Sans SC', 'Noto Color Emoji', sans-serif": '默认字体：香咕真的很好吃喵～ 🐱',
    "'ZCOOL KuaiLe', 'Noto Color Emoji', cursive": '快乐体：艾克斯很神秘～ 🎉',
    "'ZCOOL XiaoWei', 'Noto Color Emoji', serif": '糯米？!樱桃？！柠檬？！～ 🍬✨',
    "'Ma Shan Zheng', 'Noto Color Emoji', cursive": '毛笔楷体：香咕真的很好吃喵～ ✍️',
    "'Long Cang', 'Noto Color Emoji', cursive": '龙藏体：香咕真的很好吃喵～ 🖋️',
    "'Zhi Mang Xing', 'Noto Color Emoji', cursive": '知芒行：香咕真的很好吃喵～ 🌊',
    "'Liu Jian Mao Cao', 'Noto Color Emoji', cursive": '流墨毛草：香咕真的很好吃喵～ 🐱',
  };

  const GOOGLE_FONT_URLS = {
    "'ZCOOL KuaiLe', 'Noto Color Emoji', cursive":       'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap',
    "'ZCOOL XiaoWei', 'Noto Color Emoji', serif":        'https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&display=swap',
    "'Ma Shan Zheng', 'Noto Color Emoji', cursive":      'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap',
    "'Long Cang', 'Noto Color Emoji', cursive":          'https://fonts.googleapis.com/css2?family=Long+Cang&display=swap',
    "'Zhi Mang Xing', 'Noto Color Emoji', cursive":      'https://fonts.googleapis.com/css2?family=Zhi+Mang+Xing&display=swap',
    "'Liu Jian Mao Cao', 'Noto Color Emoji', cursive":   'https://fonts.googleapis.com/css2?family=Liu+Jian+Mao+Cao&display=swap',
  };

  const loadedFontLinks = new Set();

  function injectFontLink(fontVal) {
    const url = GOOGLE_FONT_URLS[fontVal];
    if (!url || loadedFontLinks.has(url)) return Promise.resolve();
    loadedFontLinks.add(url);
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  // 输入防抖
  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  class TinyCache {
    constructor(limit = 2500) { this.limit = limit; this.map = new Map(); }
    get(key) { return this.map.get(key); }
    set(key, value) {
      if (this.map.size >= this.limit && !this.map.has(key)) {
        const oldest = this.map.keys().next().value;
        this.map.delete(oldest);
      }
      this.map.set(key, value);
      return value;
    }
    clear() { this.map.clear(); }
  }

  class AnanMemeGenerator {
    constructor() {
      this.canvas = document.getElementById('canvas');
      this.ctx = this.canvas.getContext('2d');

      this.baseImage = null;
      this.handImage = null;
      this.customImage = null;
      this.customEmotionImage = null;
      this.customEmotionSourceBlob = null;
      this.customFonts = [];
      this.imageLayers = [];
      this.imageLayerCounter = 0;
      this.textLayerCounter = 1;
      this.textLayers = [{
        id: 'text-1', type: 'text', name: '空白文字', kind: '可编辑文字',
        text: '', fontFamily: "'Noto Sans SC', 'Noto Color Emoji', sans-serif",
        fontColor: '#2c3e50', textAlign: 'center', fontSize: 32, lineHeight: 1,
        x: 260, y: 452, rotation: 0, scaleX: 1, scaleY: 1,
        visible: true, opacity: 1, locked: false, history: new UndoHistory(50)
      }];
      this.layerOrder = ['base', 'text-1', 'drawing', 'hand'];
      this.layerSettings = {
        base:    { id: 'base', name: '角色底图', kind: '角色', visible: true, opacity: 1, locked: true },
        drawing: { id: 'drawing', name: '绘画', kind: '透明笔迹', visible: true, opacity: 1, locked: true },
        hand:    { id: 'hand', name: '手部遮罩', kind: '角色前景', visible: true, opacity: 1, locked: true }
      };
      this.selectedLayerId = 'text-1';
      this.activeTextLayerId = 'text-1';

      this.currentEmotion = '开心.png';
      this.isCustomEmotion = false;

      this.drawPending = false;

      this.longPressTimer = null;

      this.history = this.textLayers[0].history;
      this.textMetricsCache = new TinyCache(2600);
      this.parsedTextCache = new TinyCache(120);
      this.baseRenderCache = document.createElement('canvas');
      this.baseRenderCache.width = this.canvas.width;
      this.baseRenderCache.height = this.canvas.height;
      this.baseRenderCacheKey = '';

      this.paintCanvas = document.getElementById('paintCanvas');
      this.paintCtx = this.paintCanvas.getContext('2d');
      this.paintBackground = document.getElementById('paintBackground');
      this.paintBackgroundCtx = this.paintBackground.getContext('2d', { alpha: false });
      this.paintTool = 'pen';
      this.paintPointerId = null;
      this.paintLastPoint = null;
      this.paintHistory = [];
      this.paintHistoryIndex = -1;
      this.paintHistoryLimit = 14;
      this.paintDirty = false;
      this.paintView = { boardOnly: false, toolbarCollapsed: false, zoom: 1, rotation: 0, panX: 0, panY: 0, panning: false };
      this.paintPanSession = null;

      this.interactionCanvas = document.getElementById('interactionCanvas');
      this.interactionCtx = this.interactionCanvas.getContext('2d');
      this.transformSession = null;
      this.transformPointerId = null;
      this.transformHandles = [];
      this.projectReady = false;
      this.projectDirty = false;
      this.lastSavedAt = null;

      this.colorMap = {
        '红色': '#e74c3c', '橙色': '#e67e22', '黄色': '#f1c40f',
        '绿色': '#2ecc71', '青色': '#1abc9c', '蓝色': '#3498db',
        '紫色': '#9b59b6', '粉色': '#fd79a8', '灰色': '#7f8c8d',
        '黑色': '#2c3e50', '白色': '#ecf0f1', '棕色': '#8b4513'
      };

      this.boardArea = {
        left: 88, right: 432, top: 430, bottom: 638,
        get width()  { return this.right - this.left; },
        get height() { return this.bottom - this.top; }
      };

      this.filter = { preset: 'none', brightness: 100, contrast: 100, saturate: 100 };
      this.invalidateBaseCache();

      this._debouncedDrawFromFilter = debounce(() => this.scheduleDraw(), 40);
      this._debouncedDrawFromText   = debounce(() => this.scheduleDraw(), 80);

      this.init();
    }

    async init() {
      if (document.fonts && document.fonts.addEventListener) {
        document.fonts.addEventListener('loadingdone', () => {
          this.textMetricsCache.clear();
          this.textLayers.forEach(layer => { layer._boundsKey = ''; });
          this.scheduleDraw();
          this.updateFontPreview();
        });
      }
      this.loadSettings();
      this.bindEvents();
      this.bindPaintEvents();
      this.bindTransformEvents();
      this.buildPresetGrid();
      this.renderLayerPanel();
      await this.preloadImages();
      const restoredProject = await this.restoreProject();
      if (!restoredProject && this.savedEmotion && this.savedEmotion !== '开心.png') await this.changeEmotion(this.savedEmotion);
      this.checkMobile();
      this.scheduleDraw();
      const selectedFonts = [...new Set(this.textLayers.map(layer => layer.fontFamily))];
      await Promise.all(selectedFonts.map(font => injectFontLink(font)));
      await (window.fontsReady || Promise.resolve());
      this.textMetricsCache.clear();
      this.textLayers.forEach(layer => { layer._boundsKey = ''; });
      this.scheduleDraw();
      this.activeTextLayer()?.history.push(document.getElementById('textInput').value);
      this.updateFontPreview();
      this.paintHistory = [];
      this.paintHistoryIndex = -1;
      this.savePaintSnapshot(true);
      this.projectReady = true;
      this.markProjectClean(restoredProject ? '已恢复上次保存的完整工程' : '尚未保存完整工程');
      this.showUpdateIntroOnce();
    }

    updateFontPreview() {
      const select = document.getElementById('fontFamily');
      const preview = document.getElementById('fontPreview');
      const val = select.value;
      if (val === 'custom') return;
      const fontName = val === 'custom' ? "'Noto Sans SC'" : val;
      preview.style.fontFamily = fontName;
      preview.textContent = FONT_PREVIEW_TEXT[val] || '预览：香咕真的很好吃喵～ 🍬✨';
    }

    bindEvents() {
      const textarea = document.getElementById('textInput');

      textarea.addEventListener('input', (e) => {
        const layer = this.activeTextLayer();
        if (!layer) return;
        layer.text = e.target.value;
        layer.name = this.getTextLayerName(layer.text);
        this.updateTextLayerLabel(layer);
        this.autoResizeTextarea(e.target);
        layer.history.push(e.target.value);
        this.history = layer.history;
        this.updateUndoRedoButtons();
        this._debouncedDrawFromText();
      });

      ['fontColor', 'lineHeight', 'textAlign', 'fontSize'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => { this.updateActiveTextStyleFromControls(); this.scheduleDraw(); });
      });
      document.getElementById('fontColor').addEventListener('input', debounce(() => { this.updateActiveTextStyleFromControls(); this.scheduleDraw(); }, 60));
      document.getElementById('lineHeight').addEventListener('input', debounce(() => { this.updateActiveTextStyleFromControls(); this.scheduleDraw(); }, 60));
      document.getElementById('fontSize').addEventListener('input', debounce(() => { this.updateActiveTextStyleFromControls(); this.scheduleDraw(); }, 60));

      document.getElementById('fontFamily').addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          const activeLayer = this.activeTextLayer();
          e.target.value = activeLayer?.fontFamily || StorageManager.getDefaults().fontFamily;
          document.getElementById('customFontInput').click();
        } else {
          const fontVal = e.target.value;
          const activeLayer = this.activeTextLayer();
          if (activeLayer) activeLayer.fontFamily = fontVal;
          const firstFamily = fontVal.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
          const testSize = parseInt(document.getElementById('fontSize').value) || 32;
          const preview = document.getElementById('fontPreview');
          const variants = [
            `${testSize}px '${firstFamily}'`,
            `bold ${testSize}px '${firstFamily}'`,
            `italic ${testSize}px '${firstFamily}'`,
            `italic bold ${testSize}px '${firstFamily}'`
          ];
          const allReady = variants.every(v => document.fonts.check(v));
          if (!allReady) {
            preview.textContent = '⏳ 字体加载中，请稍候...';
            preview.style.color = '#e67e22';
          }
          injectFontLink(fontVal).then(() => {
            return Promise.all(variants.map(v => document.fonts.load(v).catch(() => null)));
          }).then(() => {
            return document.fonts.ready;
          }).then(() => {
            preview.style.color = '';
            this.textMetricsCache.clear();
            this.updateFontPreview();
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                this.drawCanvas();
              });
            });
          });
        }
      });
      document.getElementById('customFontInput').addEventListener('change', (e) => this.handleCustomFont(e));

      document.getElementById('posY').addEventListener('input', (e) => {
        document.getElementById('posYDisplay').textContent = e.target.value;
        const layer = this.activeTextLayer();
        if (layer) layer.y = parseFloat(e.target.value);
        this.scheduleDraw();
      });

      document.getElementById('imagePosY').addEventListener('input', (e) => {
        document.getElementById('imagePosYDisplay').textContent = e.target.value;
        if (this.customImage) {
          this.customImage.y = parseFloat(e.target.value);
          this.scheduleDraw();
        }
      });

      document.getElementById('emotionSelect').addEventListener('change', (e) => {
        this.changeEmotion(e.target.value);
      });
      document.getElementById('customEmotionInput').addEventListener('change', (e) => {
        this.handleCustomEmotion(e);
      });

      document.getElementById('addImageBtn').addEventListener('click', () => {
        document.getElementById('customImageInput').click();
      });
      document.getElementById('customImageInput').addEventListener('change', (e) => {
        this.handleCustomImage(e);
      });
      document.getElementById('removeImageBtn').addEventListener('click', () => {
        this.removeCustomImage();
      });

      document.getElementById('imageAlign').addEventListener('change', (e) => {
        if (this.customImage) {
          const halfWidth = this.getTransformBounds(this.customImage).width * this.customImage.scaleX / 2;
          this.customImage.x = e.target.value === 'left' ? this.boardArea.left + halfWidth
            : e.target.value === 'right' ? this.boardArea.right - halfWidth
            : (this.boardArea.left + this.boardArea.right) / 2;
          this.scheduleDraw(); this.renderLayerPanel();
        }
      });
      document.getElementById('imageRotation').addEventListener('input', (e) => {
        if (this.customImage) { this.customImage.rotation = parseFloat(e.target.value) || 0; this.scheduleDraw(); }
      });
      document.getElementById('zoomInput').addEventListener('input', (e) => {
        const value = Math.max(1, Math.min(1200, parseInt(e.target.value) || 100));
        if (this.customImage) {
          const scale = this.customImage.baseScale * value / 100;
          this.customImage.scaleX = scale;
          this.customImage.scaleY = scale;
          this.scheduleDraw();
        }
      });

      document.getElementById('addTextLayerBtn').addEventListener('click', () => this.addTextLayer());
      document.getElementById('duplicateTextLayerBtn').addEventListener('click', () => this.duplicateTextLayer());
      document.getElementById('deleteTextLayerBtn').addEventListener('click', () => {
        if (this.textLayers.length > 1) this.removeTextLayer(this.activeTextLayerId);
      });

      document.querySelectorAll('.filter-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.filter-preset-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.applyFilterPreset(btn.dataset.filter);
          this.invalidateBaseCache();
          this.scheduleDraw();
        });
      });

      ['filterBrightness', 'filterContrast', 'filterSaturate'].forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
          const key = id.replace('filter', '').toLowerCase();
          const display = document.getElementById(key + 'Value');
          display.textContent = e.target.value;
          this.filter[key] = parseInt(e.target.value);
          this.invalidateBaseCache();
          this._debouncedDrawFromFilter();
        });
      });

      const toggleLayerPanel = () => {
        const box = document.getElementById('layerBox');
        if (!box) return;
        box.classList.toggle('open');
        document.getElementById('layerBoxHeader')?.setAttribute('aria-expanded', box.classList.contains('open'));
      };
      const layerBoxHeader = document.getElementById('layerBoxHeader');
      if (layerBoxHeader) {
        layerBoxHeader.addEventListener('click', toggleLayerPanel);
        layerBoxHeader.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLayerPanel(); }
        });
      }
      document.getElementById('layerOpacity').addEventListener('input', (e) => {
        const layer = this.getLayer(this.selectedLayerId);
        if (!layer) return;
        layer.opacity = parseInt(e.target.value, 10) / 100;
        document.getElementById('layerOpacityValue').textContent = e.target.value + '%';
        this.scheduleDraw();
      });
      document.getElementById('duplicateLayerBtn').addEventListener('click', () => this.duplicateSelectedLayer());
      document.getElementById('deleteLayerBtn').addEventListener('click', () => this.deleteSelectedLayer());

      document.getElementById('focusModeRow').addEventListener('click', () => {
        document.body.classList.toggle('focus-mode');
        this.autoResizeTextarea(document.getElementById('textInput'));
        this.markProjectDirty();
      });

      document.getElementById('effectBtn').addEventListener('click', () => {
        document.getElementById('effectModal').classList.add('show');
      });
      document.getElementById('effectClose').addEventListener('click', () => {
        document.getElementById('effectModal').classList.remove('show');
      });
      document.getElementById('effectModal').addEventListener('click', (e) => {
        if (e.target.id === 'effectModal') document.getElementById('effectModal').classList.remove('show');
      });

      document.getElementById('presetBtn').addEventListener('click', () => {
        document.getElementById('presetModal').classList.add('show');
      });
      document.getElementById('presetClose').addEventListener('click', () => {
        document.getElementById('presetModal').classList.remove('show');
      });
      document.getElementById('presetModal').addEventListener('click', (e) => {
        if (e.target.id === 'presetModal') document.getElementById('presetModal').classList.remove('show');
      });

      document.querySelectorAll('.effect-item').forEach(item => {
        item.addEventListener('click', () => {
          if (item.dataset.paramType) {
            this.openParamModal(item);
          } else {
            this.insertEffect(item.dataset.start, item.dataset.end || '');
          }
        });
      });

      document.getElementById('paramModalClose').addEventListener('click', () => {
        document.getElementById('paramModal').classList.remove('show');
      });
      document.getElementById('paramModalCancel').addEventListener('click', () => {
        document.getElementById('paramModal').classList.remove('show');
      });
      document.getElementById('paramModal').addEventListener('click', (e) => {
        if (e.target.id === 'paramModal') document.getElementById('paramModal').classList.remove('show');
      });
      document.getElementById('paramInputValue').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('paramModalConfirm').click();
      });
      document.getElementById('paramModalConfirm').addEventListener('click', () => {
        const modal  = document.getElementById('paramModal');
        const type   = modal.dataset.currentType;
        const dirSign = modal.dataset.dirSign || '1';
        const rawVal = parseFloat(document.getElementById('paramInputValue').value);
        if (isNaN(rawVal)) return;

        let finalType, finalVal;

        if (type === '旋转') {
          finalType = '旋转';
          finalVal  = dirSign === '-1' ? -Math.abs(rawVal) : Math.abs(rawVal);
        } else if (type === '偏移') {
          const signMap = { right: 1, left: -1, down: 1, up: -1 };
          const typeMap = { right: '左右偏移', left: '左右偏移', down: '上下偏移', up: '上下偏移' };
          finalType = typeMap[dirSign] || '左右偏移';
          finalVal  = (signMap[dirSign] || 1) * Math.abs(rawVal);
        } else {
          finalType = type;
          finalVal  = rawVal;
        }

        const start = `[${finalType}=${finalVal}开始]`;
        const end   = `[${finalType}=${finalVal}结束]`;
        modal.classList.remove('show');
        this.insertEffect(start, end);
      });

      document.getElementById('filterToggle').addEventListener('click', () => {
        const filterBox = document.getElementById('filterBox');
        filterBox.classList.toggle('open');
        const label = filterBox.querySelector('.box-label span:first-child');
        label.textContent = filterBox.classList.contains('open') ? '🎨 图片滤镜（点击收起）' : '🎨 图片滤镜（点击展开）';
        this.markProjectDirty();
      });

      document.getElementById('changelogBtn').addEventListener('click', () => {
        document.getElementById('changelogModal').classList.add('show');
      });
      document.getElementById('whatsNewBtn').addEventListener('click', () => this.openUpdateIntro());
      document.getElementById('updateLaterBtn').addEventListener('click', () => this.closeUpdateIntro());
      document.getElementById('updateStartBtn').addEventListener('click', () => {
        this.closeUpdateIntro();
        document.getElementById('layerBox').classList.add('open');
        document.getElementById('layerBoxHeader')?.setAttribute('aria-expanded', 'true');
        document.getElementById('canvasWrapper').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      document.getElementById('updateModal').addEventListener('click', (e) => {
        if (e.target.id === 'updateModal') this.closeUpdateIntro();
      });
      document.getElementById('changelogClose').addEventListener('click', () => {
        document.getElementById('changelogModal').classList.remove('show');
      });
      document.getElementById('changelogModal').addEventListener('click', (e) => {
        if (e.target.id === 'changelogModal') document.getElementById('changelogModal').classList.remove('show');
      });

      document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
      document.getElementById('exportProjectBtn').addEventListener('click', () => this.exportProject());
      document.getElementById('importProjectBtn').addEventListener('click', () => document.getElementById('importProjectInput').click());
      document.getElementById('importProjectInput').addEventListener('change', (e) => this.importProject(e));
      document.getElementById('centerLayerBtn').addEventListener('click', () => this.centerSelectedLayer());
      document.getElementById('resetTransformBtn').addEventListener('click', () => this.resetSelectedTransform());

      const resetBtn = document.getElementById('resetSettingsBtn');
      const startLongPress = () => {
        document.getElementById('longPressHint').style.display = 'block';
        resetBtn.style.opacity = '0.7';
        this.longPressTimer = setTimeout(() => {
          this.executeReset();
          document.getElementById('longPressHint').style.display = 'none';
          resetBtn.style.opacity = '';
        }, 2000);
      };
      const cancelLongPress = () => {
        clearTimeout(this.longPressTimer);
        document.getElementById('longPressHint').style.display = 'none';
        resetBtn.style.opacity = '';
      };
      resetBtn.addEventListener('mousedown', startLongPress);
      resetBtn.addEventListener('mouseup', cancelLongPress);
      resetBtn.addEventListener('mouseleave', cancelLongPress);
      resetBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startLongPress(); }, { passive: false });
      resetBtn.addEventListener('touchend', cancelLongPress);
      resetBtn.addEventListener('touchcancel', cancelLongPress);

      document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());
      document.getElementById('copyBtn').addEventListener('click', () => this.copyToClipboard());

      document.getElementById('undoBtn').addEventListener('click', () => {
        const layer = this.activeTextLayer();
        if (!layer) return;
        const value = layer.history.undo();
        if (value !== null) {
          layer.text = value;
          this.updateTextLayerLabel(layer);
          document.getElementById('textInput').value = value;
          this.autoResizeTextarea(document.getElementById('textInput'));
          this.updateUndoRedoButtons();
          this.markProjectDirty();
          this.scheduleDraw();
        }
      });
      document.getElementById('redoBtn').addEventListener('click', () => {
        const layer = this.activeTextLayer();
        if (!layer) return;
        const value = layer.history.redo();
        if (value !== null) {
          layer.text = value;
          this.updateTextLayerLabel(layer);
          document.getElementById('textInput').value = value;
          this.autoResizeTextarea(document.getElementById('textInput'));
          this.updateUndoRedoButtons();
          this.markProjectDirty();
          this.scheduleDraw();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (document.getElementById('paintModal').classList.contains('show')) this.closePaintMode();
          document.getElementById('updateModal').classList.remove('show');
        }
        if (document.getElementById('paintModal').classList.contains('show')) return;
        const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
        const selected = this.getLayer(this.selectedLayerId);
        if (!editing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && (selected?.type === 'image' || selected?.type === 'text')) {
          e.preventDefault();
          this.duplicateSelectedLayer();
          return;
        }
        if (!editing && !selected?.locked && (e.key === 'Delete' || e.key === 'Backspace') && (selected?.type === 'image' || selected?.type === 'text')) {
          e.preventDefault();
          this.deleteSelectedLayer();
          return;
        }
        if (!editing && selected && !selected.locked && (selected.type === 'image' || selected.type === 'text') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          if (e.key === 'ArrowLeft') selected.x -= step;
          if (e.key === 'ArrowRight') selected.x += step;
          if (e.key === 'ArrowUp') selected.y -= step;
          if (e.key === 'ArrowDown') selected.y += step;
          if (selected.type === 'image') this.syncActiveImageControls();
          if (selected.type === 'text') this.syncTextLayerControls();
          this.markProjectDirty();
          this.scheduleDraw();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
          e.preventDefault();
          document.getElementById('undoBtn').click();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
          e.preventDefault();
          document.getElementById('redoBtn').click();
        }
      });

      document.addEventListener('input', (e) => {
        if (!this.projectReady || e.target.id === 'importProjectInput') return;
        if (e.target.matches('textarea, input, select')) this.markProjectDirty();
      });
      window.addEventListener('beforeunload', (e) => {
        if (!this.projectDirty) return;
        e.preventDefault();
        e.returnValue = '';
      });
    }

    getLayer(id) {
      return this.layerSettings[id]
        || this.imageLayers.find(layer => layer.id === id)
        || this.textLayers.find(layer => layer.id === id)
        || null;
    }

    activeTextLayer() {
      return this.textLayers.find(layer => layer.id === this.activeTextLayerId) || this.textLayers[0] || null;
    }

    getTextLayerName(text) {
      const plain = String(text || '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!plain) return '空白文字';
      const chars = Array.from(plain);
      return chars.length > 22 ? chars.slice(0, 22).join('') + '…' : plain;
    }

    updateTextLayerLabel(layer) {
      if (!layer) return;
      layer.name = this.getTextLayerName(layer.text);
      if (layer.id === this.activeTextLayerId) document.getElementById('activeTextLayerName').textContent = '📝 ' + layer.name;
      const layerRow = [...document.querySelectorAll('.layer-item')].find(item => item.dataset.layerId === layer.id);
      const row = layerRow?.querySelector('.layer-name');
      if (row) row.textContent = layer.name;
    }

    selectLayer(id) {
      const layer = this.getLayer(id);
      if (!layer) return;
      this.selectedLayerId = id;
      if (layer.type === 'image') {
        this.customImage = layer;
        this.syncActiveImageControls();
      } else if (layer.type === 'text') {
        this.activeTextLayerId = layer.id;
        this.history = layer.history;
        this.syncTextLayerControls();
      }
      this.renderLayerPanel();
      this.drawInteractionOverlay();
    }

    updateActiveTextStyleFromControls() {
      const layer = this.activeTextLayer();
      if (!layer) return;
      layer.fontFamily = document.getElementById('fontFamily').value || layer.fontFamily;
      layer.fontColor = document.getElementById('fontColor').value;
      layer.textAlign = document.getElementById('textAlign').value;
      layer.fontSize = Math.max(8, parseFloat(document.getElementById('fontSize').value) || 32);
      layer.lineHeight = Math.max(1, parseFloat(document.getElementById('lineHeight').value) || 1);
    }

    syncTextLayerControls() {
      const layer = this.activeTextLayer();
      if (!layer) return;
      const textarea = document.getElementById('textInput');
      textarea.value = layer.text;
      document.getElementById('fontFamily').value = layer.fontFamily;
      if (!document.getElementById('fontFamily').value) {
        layer.fontFamily = StorageManager.getDefaults().fontFamily;
        document.getElementById('fontFamily').value = layer.fontFamily;
      }
      document.getElementById('fontColor').value = layer.fontColor;
      document.getElementById('textAlign').value = layer.textAlign;
      document.getElementById('fontSize').value = layer.fontSize;
      document.getElementById('lineHeight').value = layer.lineHeight;
      document.getElementById('posY').value = Math.round(layer.y);
      document.getElementById('posYDisplay').textContent = Math.round(layer.y);
      layer.name = this.getTextLayerName(layer.text);
      document.getElementById('activeTextLayerName').textContent = '📝 ' + layer.name;
      ['textInput', 'fontFamily', 'fontColor', 'textAlign', 'fontSize', 'lineHeight', 'posY'].forEach(id => {
        document.getElementById(id).disabled = layer.locked === true;
      });
      document.getElementById('deleteTextLayerBtn').disabled = this.textLayers.length <= 1 || layer.locked === true;
      this.history = layer.history;
      this.autoResizeTextarea(textarea);
      this.updateUndoRedoButtons();
      this.updateFontPreview();
      const firstFamily = layer.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
      injectFontLink(layer.fontFamily)
        .then(() => document.fonts.load(`${layer.fontSize}px '${firstFamily}'`).catch(() => null))
        .then(() => { this.textMetricsCache.clear(); this.textLayers.forEach(item => { item._boundsKey = ''; }); this.scheduleDraw(); });
    }

    addTextLayer(source = null) {
      const reference = source || this.activeTextLayer();
      const id = 'text-' + (++this.textLayerCounter);
      const history = new UndoHistory(50);
      const layer = {
        id, type: 'text', name: source ? this.getTextLayerName(source.text) : '空白文字', kind: '可编辑文字',
        text: source ? source.text : '',
        fontFamily: reference?.fontFamily || StorageManager.getDefaults().fontFamily,
        fontColor: reference?.fontColor || '#2c3e50',
        textAlign: reference?.textAlign || 'center',
        fontSize: reference?.fontSize || 32,
        lineHeight: reference?.lineHeight || 1,
        x: Math.min(500, (reference?.x || 260) + 12),
        y: Math.min(620, (reference?.y || 452) + 12),
        rotation: source?.rotation || 0,
        scaleX: source?.scaleX || 1,
        scaleY: source?.scaleY || 1,
        visible: true, opacity: source?.opacity ?? 1, locked: false, history
      };
      history.push(layer.text);
      this.textLayers.push(layer);
      const selectedIndex = this.layerOrder.indexOf(this.selectedLayerId);
      const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : Math.max(1, this.layerOrder.indexOf('drawing'));
      this.layerOrder.splice(insertAt, 0, id);
      this.activeTextLayerId = id;
      this.selectedLayerId = id;
      this.history = history;
      this.syncTextLayerControls();
      this.renderLayerPanel();
      this.markProjectDirty();
      this.scheduleDraw();
      document.getElementById('textInput').focus();
      return layer;
    }

    duplicateTextLayer(source = this.activeTextLayer()) {
      if (!source) return;
      this.addTextLayer(source);
    }

    renderLayerPanel() {
      const list = document.getElementById('layerList');
      if (!list) return;
      list.replaceChildren();
      const displayOrder = [...this.layerOrder].reverse();
      displayOrder.forEach((id) => {
        const layer = this.getLayer(id);
        if (!layer) return;
        const row = document.createElement('div');
        row.className = 'layer-item' + (id === this.selectedLayerId ? ' selected' : '');
        row.dataset.layerId = id;
        row.setAttribute('role', 'button');
        row.tabIndex = 0;

        const eye = document.createElement('button');
        eye.type = 'button';
        eye.className = 'layer-eye' + (layer.visible ? '' : ' off');
        eye.textContent = layer.visible ? '👁' : '○';
        eye.title = layer.visible ? '隐藏图层' : '显示图层';
        eye.addEventListener('click', (e) => {
          e.stopPropagation();
          layer.visible = !layer.visible;
          this.markProjectDirty();
          this.renderLayerPanel();
          this.scheduleDraw();
        });

        const info = document.createElement('div');
        info.className = 'layer-info';
        const name = document.createElement('div');
        name.className = 'layer-name';
        if (layer.type === 'text') layer.name = this.getTextLayerName(layer.text);
        name.textContent = layer.name;
        const kind = document.createElement('div');
        kind.className = 'layer-kind';
        kind.textContent = layer.kind || '图片图层';
        info.append(name, kind);

        const lock = document.createElement('button');
        lock.type = 'button';
        lock.className = 'layer-lock';
        lock.textContent = layer.locked ? '🔒' : '🔓';
        lock.title = layer.locked ? '解锁图层' : '锁定图层';
        lock.disabled = layer.type !== 'image' && layer.type !== 'text';
        lock.addEventListener('click', (e) => {
          e.stopPropagation();
          if (lock.disabled) return;
          layer.locked = !layer.locked;
          this.markProjectDirty();
          if (layer.type === 'text') this.syncTextLayerControls();
          if (layer.type === 'image') this.syncActiveImageControls();
          this.renderLayerPanel();
          this.drawInteractionOverlay();
        });

        const up = document.createElement('button');
        up.type = 'button'; up.className = 'layer-move'; up.textContent = '↑'; up.title = '上移一层';
        up.disabled = this.layerOrder.indexOf(id) === this.layerOrder.length - 1;
        up.addEventListener('click', (e) => { e.stopPropagation(); this.moveLayer(id, 1); });
        const down = document.createElement('button');
        down.type = 'button'; down.className = 'layer-move'; down.textContent = '↓'; down.title = '下移一层';
        down.disabled = this.layerOrder.indexOf(id) === 0;
        down.addEventListener('click', (e) => { e.stopPropagation(); this.moveLayer(id, -1); });

        row.addEventListener('click', () => this.selectLayer(id));
        row.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.selectLayer(id); }
        });
        row.append(eye, info, lock, up, down);
        list.appendChild(row);
      });

      const selected = this.getLayer(this.selectedLayerId) || this.activeTextLayer() || this.layerSettings.base;
      const percent = Math.round((selected.opacity ?? 1) * 100);
      document.getElementById('layerOpacity').value = percent;
      document.getElementById('layerOpacityValue').textContent = percent + '%';
      const editable = selected.type === 'image' || selected.type === 'text';
      document.getElementById('centerLayerBtn').disabled = !editable || selected.locked;
      document.getElementById('resetTransformBtn').disabled = !editable || selected.locked;
      document.getElementById('duplicateLayerBtn').disabled = !editable;
      document.getElementById('deleteLayerBtn').disabled = !editable || selected.locked || (selected.type === 'text' && this.textLayers.length <= 1);
      document.getElementById('layerCount').textContent = this.layerOrder.length;
      document.getElementById('deleteTextLayerBtn').disabled = this.textLayers.length <= 1;
    }

    moveLayer(id, delta) {
      const index = this.layerOrder.indexOf(id);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= this.layerOrder.length) return;
      [this.layerOrder[index], this.layerOrder[next]] = [this.layerOrder[next], this.layerOrder[index]];
      this.markProjectDirty();
      this.renderLayerPanel();
      this.scheduleDraw();
    }

    centerSelectedLayer() {
      const layer = this.getLayer(this.selectedLayerId);
      if (!layer || layer.locked || (layer.type !== 'image' && layer.type !== 'text')) return;
      const rect = this.getLayerLocalRect(layer);
      const localCenterX = (rect.x + rect.width / 2) * layer.scaleX;
      const localCenterY = (rect.y + rect.height / 2) * layer.scaleY;
      const angle = (layer.rotation || 0) * Math.PI / 180;
      const offsetX = localCenterX * Math.cos(angle) - localCenterY * Math.sin(angle);
      const offsetY = localCenterX * Math.sin(angle) + localCenterY * Math.cos(angle);
      layer.x = (this.boardArea.left + this.boardArea.right) / 2 - offsetX;
      layer.y = (this.boardArea.top + this.boardArea.bottom) / 2 - offsetY;
      if (layer.type === 'image') this.syncActiveImageControls();
      if (layer.type === 'text') this.syncTextLayerControls();
      this.markProjectDirty();
      this.scheduleDraw();
    }

    fitTextLayerToBoard(layer) {
      if (!layer || layer.type !== 'text') return;
      layer.rotation = 0;
      layer._boundsKey = '';
      const bounds = this.getTransformBounds(layer);
      const availableWidth = Math.max(1, this.boardArea.width - 16);
      const availableHeight = Math.max(1, this.boardArea.height - 16);
      const scale = Math.max(.04, Math.min(1, availableWidth / bounds.width, availableHeight / bounds.height));
      layer.scaleX = scale;
      layer.scaleY = scale;
      const rect = this.getLayerLocalRect(layer);
      layer.x = (this.boardArea.left + this.boardArea.right) / 2 - (rect.x + rect.width / 2) * scale;
      layer.y = (this.boardArea.top + this.boardArea.bottom) / 2 - (rect.y + rect.height / 2) * scale;
    }

    resetSelectedTransform() {
      const layer = this.getLayer(this.selectedLayerId);
      if (!layer || layer.locked || (layer.type !== 'image' && layer.type !== 'text')) return;
      layer.rotation = 0;
      const scale = layer.type === 'image' ? layer.baseScale : 1;
      layer.scaleX = scale;
      layer.scaleY = scale;
      if (layer.type === 'image') this.syncActiveImageControls();
      this.markProjectDirty();
      this.scheduleDraw();
    }

    duplicateSelectedLayer() {
      const source = this.getLayer(this.selectedLayerId);
      if (!source) return;
      if (source.type === 'text') { this.duplicateTextLayer(source); return; }
      if (source.type !== 'image') return;
      const copy = {
        ...source,
        id: 'image-' + (++this.imageLayerCounter),
        name: source.name.replace(/\s\(副本(?: \d+)?\)$/, '') + ' (副本)',
        locked: false,
        x: source.x + 12,
        y: source.y + 12
      };
      this.imageLayers.push(copy);
      const index = this.layerOrder.indexOf(source.id);
      this.layerOrder.splice(index + 1, 0, copy.id);
      this.customImage = copy;
      this.selectedLayerId = copy.id;
      this.syncActiveImageControls();
      this.renderLayerPanel();
      this.markProjectDirty();
      this.scheduleDraw();
    }

    deleteSelectedLayer() {
      const layer = this.getLayer(this.selectedLayerId);
      if (!layer || layer.locked) return;
      if (layer.type === 'image') this.removeImageLayer(layer.id);
      if (layer.type === 'text' && this.textLayers.length > 1) this.removeTextLayer(layer.id);
    }

    removeTextLayer(id) {
      const index = this.textLayers.findIndex(layer => layer.id === id);
      if (index < 0 || this.textLayers[index].locked || this.textLayers.length <= 1) return;
      this.textLayers.splice(index, 1);
      this.layerOrder = this.layerOrder.filter(layerId => layerId !== id);
      const next = this.textLayers[Math.min(index, this.textLayers.length - 1)];
      this.activeTextLayerId = next.id;
      this.selectedLayerId = next.id;
      this.history = next.history;
      this.syncTextLayerControls();
      this.renderLayerPanel();
      this.markProjectDirty();
      this.scheduleDraw();
    }

    removeImageLayer(id) {
      const index = this.imageLayers.findIndex(layer => layer.id === id);
      if (index < 0 || this.imageLayers[index].locked) return;
      this.imageLayers.splice(index, 1);
      this.layerOrder = this.layerOrder.filter(layerId => layerId !== id);
      this.customImage = this.imageLayers[this.imageLayers.length - 1] || null;
      this.selectedLayerId = this.customImage ? this.customImage.id : this.activeTextLayerId;
      this.syncActiveImageControls();
      this.renderLayerPanel();
      this.markProjectDirty();
      this.scheduleDraw();
    }

    syncActiveImageControls() {
      const layer = this.customImage;
      const hasImage = Boolean(layer);
      document.getElementById('imageFilename').textContent = hasImage ? layer.name : '未添加图片';
      document.getElementById('removeImageBtn').style.display = hasImage ? 'inline-block' : 'none';
      document.getElementById('imageLayoutBox').style.display = hasImage ? 'block' : 'none';
      document.getElementById('imagePosYGroup').style.display = hasImage ? 'block' : 'none';
      if (!hasImage) return;
      ['imageAlign', 'imageRotation', 'zoomInput', 'imagePosY', 'removeImageBtn'].forEach(id => {
        document.getElementById(id).disabled = layer.locked === true;
      });
      document.getElementById('imageAlign').value = 'center';
      document.getElementById('imageRotation').value = Math.round(layer.rotation || 0);
      document.getElementById('zoomInput').value = Math.round((layer.scaleX / layer.baseScale) * 100);
      document.getElementById('imagePosY').value = Math.round(layer.y);
      document.getElementById('imagePosYDisplay').textContent = Math.round(layer.y);
    }

    measureTextLayerBounds(layer) {
      const key = [layer.text, layer.fontFamily, layer.fontSize, layer.lineHeight, layer.textAlign].join('|');
      if (layer._boundsKey === key && layer._bounds) return layer._bounds;
      const chars = this.parseStyledText(layer.text || ' ');
      const maxWidth = this.boardArea.width;
      let lineWidth = 0;
      let maxLineWidth = 0;
      let lineMaxSize = layer.fontSize;
      const lineSizes = [];
      for (const char of chars) {
        if (char.char === '\n') {
          maxLineWidth = Math.max(maxLineWidth, lineWidth);
          lineSizes.push(lineMaxSize);
          lineWidth = 0;
          lineMaxSize = layer.fontSize;
          continue;
        }
        const size = char.fontSize !== null ? char.fontSize : layer.fontSize;
        const weight = char.fontWeight !== null ? char.fontWeight : (char.bold ? 'bold' : 'normal');
        const style = char.italic ? 'italic' : 'normal';
        const font = `${style} ${weight} ${size}px ${layer.fontFamily}`;
        const metricKey = font + '\u0000' + char.char;
        let width = this.textMetricsCache.get(metricKey);
        if (width === undefined) {
          this.ctx.font = font;
          width = this.textMetricsCache.set(metricKey, this.ctx.measureText(char.char).width);
        }
        if (lineWidth + width > maxWidth && lineWidth > 0) {
          maxLineWidth = Math.max(maxLineWidth, lineWidth);
          lineSizes.push(lineMaxSize);
          lineWidth = width;
          lineMaxSize = size;
        } else {
          lineWidth += width;
          lineMaxSize = Math.max(lineMaxSize, size);
        }
      }
      lineSizes.push(lineMaxSize);
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
      const width = Math.max(60, Math.min(maxWidth, maxLineWidth + 12));
      const tallest = Math.max(...lineSizes, layer.fontSize);
      const height = Math.max(layer.fontSize * 1.25, lineSizes.reduce((sum, size) => sum + size * layer.lineHeight, 0) + tallest * .25);
      layer._boundsKey = key;
      layer._bounds = { width, height: Math.min(620, height), firstLineSize: lineSizes[0] || layer.fontSize };
      return layer._bounds;
    }

    getTransformBounds(layer) {
      if (layer.type === 'image') {
        return {
          width: layer.image.naturalWidth || layer.image.width || 1,
          height: layer.image.naturalHeight || layer.image.height || 1
        };
      }
      if (layer.type === 'text') return this.measureTextLayerBounds(layer);
      return null;
    }

    getLayerLocalRect(layer) {
      const bounds = this.getTransformBounds(layer);
      if (!bounds) return null;
      if (layer.type !== 'text') {
        return { x: -bounds.width / 2, y: -bounds.height / 2, width: bounds.width, height: bounds.height };
      }
      const x = layer.textAlign === 'left' ? 0
        : layer.textAlign === 'right' ? -bounds.width
          : -bounds.width / 2;
      return { x, y: -bounds.height / 2, width: bounds.width, height: bounds.height };
    }

    layerPointToWorld(layer, localX, localY) {
      const sx = localX * layer.scaleX;
      const sy = localY * layer.scaleY;
      const angle = (layer.rotation || 0) * Math.PI / 180;
      return {
        x: layer.x + sx * Math.cos(angle) - sy * Math.sin(angle),
        y: layer.y + sx * Math.sin(angle) + sy * Math.cos(angle)
      };
    }

    worldPointToLayer(layer, worldX, worldY, includeScale = true) {
      const angle = -(layer.rotation || 0) * Math.PI / 180;
      const dx = worldX - layer.x;
      const dy = worldY - layer.y;
      const x = dx * Math.cos(angle) - dy * Math.sin(angle);
      const y = dx * Math.sin(angle) + dy * Math.cos(angle);
      return includeScale ? { x: x / layer.scaleX, y: y / layer.scaleY } : { x, y };
    }

    getTransformHandles(layer) {
      const rect = this.getLayerLocalRect(layer);
      if (!rect) return [];
      const left = rect.x;
      const right = rect.x + rect.width;
      const top = rect.y;
      const bottom = rect.y + rect.height;
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const points = [
        ['nw', left, top], ['n', centerX, top], ['ne', right, top],
        ['e', right, centerY], ['se', right, bottom], ['s', centerX, bottom],
        ['sw', left, bottom], ['w', left, centerY]
      ].map(([name, x, y]) => ({ name, ...this.layerPointToWorld(layer, x, y) }));
      const topCenter = this.layerPointToWorld(layer, centerX, top);
      const angle = (layer.rotation || 0) * Math.PI / 180;
      points.push({ name: 'rotate', x: topCenter.x + Math.sin(angle) * 30, y: topCenter.y - Math.cos(angle) * 30 });
      return points;
    }

    drawInteractionOverlay() {
      const ctx = this.interactionCtx;
      ctx.clearRect(0, 0, this.interactionCanvas.width, this.interactionCanvas.height);
      const layer = this.getLayer(this.selectedLayerId);
      if (!layer || !layer.visible || layer.locked || (layer.type !== 'image' && layer.type !== 'text')) {
        this.transformHandles = [];
        return;
      }
      const rect = this.getLayerLocalRect(layer);
      const corners = [
        this.layerPointToWorld(layer, rect.x, rect.y),
        this.layerPointToWorld(layer, rect.x + rect.width, rect.y),
        this.layerPointToWorld(layer, rect.x + rect.width, rect.y + rect.height),
        this.layerPointToWorld(layer, rect.x, rect.y + rect.height)
      ];
      this.transformHandles = this.getTransformHandles(layer);
      const rotateHandle = this.transformHandles.find(handle => handle.name === 'rotate');
      const northHandle = this.transformHandles.find(handle => handle.name === 'n');

      ctx.save();
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      if (rotateHandle && northHandle) {
        ctx.beginPath();
        ctx.moveTo(northHandle.x, northHandle.y);
        ctx.lineTo(rotateHandle.x, rotateHandle.y);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
      }

      for (const handle of this.transformHandles) {
        ctx.beginPath();
        if (handle.name === 'rotate') {
          ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
        } else {
          ctx.rect(handle.x - 5, handle.y - 5, 10, 10);
        }
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    interactionPoint(e) {
      const rect = this.interactionCanvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * this.interactionCanvas.width / rect.width,
        y: (e.clientY - rect.top) * this.interactionCanvas.height / rect.height
      };
    }

    hitTransformHandle(point) {
      return this.transformHandles.find(handle => Math.hypot(point.x - handle.x, point.y - handle.y) <= 13) || null;
    }

    hitTestTransformLayer(point) {
      for (const id of [...this.layerOrder].reverse()) {
        const layer = this.getLayer(id);
        if (!layer || !layer.visible || layer.locked || layer.opacity <= 0 || (layer.type !== 'image' && layer.type !== 'text')) continue;
        const local = this.worldPointToLayer(layer, point.x, point.y);
        const rect = this.getLayerLocalRect(layer);
        if (local.x >= rect.x && local.x <= rect.x + rect.width && local.y >= rect.y && local.y <= rect.y + rect.height) return layer;
      }
      return null;
    }

    bindTransformEvents() {
      const canvas = this.interactionCanvas;
      canvas.addEventListener('pointerdown', (e) => {
        if (this.transformPointerId !== null) return;
        const point = this.interactionPoint(e);
        let layer = this.getLayer(this.selectedLayerId);
        let handle = this.hitTransformHandle(point);
        if (!handle || !layer || (layer.type !== 'image' && layer.type !== 'text')) {
          layer = this.hitTestTransformLayer(point);
          handle = null;
        }
        if (!layer) return;
        e.preventDefault();
        this.selectLayer(layer.id);
        this.transformPointerId = e.pointerId;
        canvas.setPointerCapture(e.pointerId);
        const unscaled = this.worldPointToLayer(layer, point.x, point.y, false);
        this.transformSession = {
          mode: handle ? (handle.name === 'rotate' ? 'rotate' : 'scale') : 'drag',
          handle: handle?.name || null,
          startPoint: point,
          startX: layer.x, startY: layer.y,
          startRotation: layer.rotation || 0,
          startScaleX: layer.scaleX, startScaleY: layer.scaleY,
          startAngle: Math.atan2(point.y - layer.y, point.x - layer.x),
          startUnscaled: unscaled
        };
      });

      canvas.addEventListener('pointermove', (e) => {
        const point = this.interactionPoint(e);
        if (e.pointerId !== this.transformPointerId || !this.transformSession) {
          const handle = this.hitTransformHandle(point);
          canvas.style.cursor = handle ? (handle.name === 'rotate' ? 'crosshair' : 'nwse-resize')
            : (this.hitTestTransformLayer(point) ? 'move' : 'default');
          return;
        }
        e.preventDefault();
        const layer = this.getLayer(this.selectedLayerId);
        if (!layer) return;
        const session = this.transformSession;
        if (session.mode === 'drag') {
          layer.x = Math.max(-100, Math.min(this.canvas.width + 100, session.startX + point.x - session.startPoint.x));
          layer.y = Math.max(-100, Math.min(this.canvas.height + 100, session.startY + point.y - session.startPoint.y));
        } else if (session.mode === 'rotate') {
          const angle = Math.atan2(point.y - layer.y, point.x - layer.x);
          let degrees = session.startRotation + (angle - session.startAngle) * 180 / Math.PI;
          if (e.shiftKey) degrees = Math.round(degrees / 15) * 15;
          layer.rotation = ((degrees + 180) % 360 + 360) % 360 - 180;
        } else {
          const local = this.worldPointToLayer({ ...layer, scaleX: 1, scaleY: 1 }, point.x, point.y, false);
          const rect = this.getLayerLocalRect(layer);
          let sx = session.startScaleX;
          let sy = session.startScaleY;
          if (session.handle.includes('e') || session.handle.includes('w')) {
            const referenceX = session.handle.includes('e') ? rect.x + rect.width : rect.x;
            if (Math.abs(referenceX) > .01) sx = Math.max(.04, Math.abs(local.x / referenceX));
          }
          if (session.handle.includes('n') || session.handle.includes('s')) {
            const referenceY = session.handle.includes('s') ? rect.y + rect.height : rect.y;
            if (Math.abs(referenceY) > .01) sy = Math.max(.04, Math.abs(local.y / referenceY));
          }
          if (e.shiftKey && session.handle.length === 2) {
            const ratio = Math.max(sx / session.startScaleX, sy / session.startScaleY);
            sx = session.startScaleX * ratio;
            sy = session.startScaleY * ratio;
          }
          layer.scaleX = Math.min(12, sx);
          layer.scaleY = Math.min(12, sy);
        }
        if (layer.type === 'image') this.syncActiveImageControls();
        if (layer.type === 'text') {
          document.getElementById('posY').value = Math.round(layer.y);
          document.getElementById('posYDisplay').textContent = Math.round(layer.y);
        }
        this.scheduleDraw();
      });

      const finish = (e) => {
        if (e.pointerId !== this.transformPointerId) return;
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        this.transformPointerId = null;
        this.transformSession = null;
        this.markProjectDirty();
        this.renderLayerPanel();
      };
      canvas.addEventListener('pointerup', finish);
      canvas.addEventListener('pointercancel', finish);
      canvas.addEventListener('dblclick', (e) => {
        const layer = this.hitTestTransformLayer(this.interactionPoint(e));
        if (layer?.type === 'text') {
          this.selectLayer(layer.id);
          document.getElementById('textInput').focus();
          document.getElementById('textInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    bindPaintEvents() {
      document.getElementById('paintModeBtn').addEventListener('click', () => this.openPaintMode());
      document.getElementById('paintFinishBtn').addEventListener('click', () => this.closePaintMode());
      document.querySelectorAll('[data-paint-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.paintTool = btn.dataset.paintTool;
          this.setPaintPanMode(false);
          document.querySelectorAll('[data-paint-tool]').forEach(item => item.classList.toggle('active', item === btn));
          this.markProjectDirty();
        });
      });
      document.getElementById('paintSize').addEventListener('input', (e) => {
        document.getElementById('paintSizeValue').textContent = e.target.value;
      });
      document.getElementById('paintOpacity').addEventListener('input', (e) => {
        document.getElementById('paintOpacityValue').textContent = e.target.value + '%';
      });
      document.getElementById('paintUndoBtn').addEventListener('click', () => this.undoPaint());
      document.getElementById('paintRedoBtn').addEventListener('click', () => this.redoPaint());
      document.getElementById('paintClearBtn').addEventListener('click', () => {
        this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
        this.savePaintSnapshot();
        this.paintDirty = true;
        this.markProjectDirty();
      });
      document.getElementById('paintToolbarToggleBtn').addEventListener('click', () => {
        this.setPaintToolbarCollapsed(!this.paintView.toolbarCollapsed);
        this.markProjectDirty();
      });

      document.getElementById('paintBoardOnlyBtn').addEventListener('click', () => {
        this.setPaintBoardOnly(!this.paintView.boardOnly);
        this.markProjectDirty();
      });
      document.getElementById('paintPanBtn').addEventListener('click', () => this.setPaintPanMode(!this.paintView.panning));
      document.getElementById('paintZoom').addEventListener('input', (e) => this.setPaintZoom(Number(e.target.value) / 100));
      document.getElementById('paintZoom').addEventListener('change', () => this.markProjectDirty());
      document.getElementById('paintZoomOutBtn').addEventListener('click', () => { this.setPaintZoom(this.paintView.zoom - .15); this.markProjectDirty(); });
      document.getElementById('paintZoomInBtn').addEventListener('click', () => { this.setPaintZoom(this.paintView.zoom + .15); this.markProjectDirty(); });
      document.getElementById('paintRotation').addEventListener('input', (e) => this.setPaintRotation(Number(e.target.value)));
      document.getElementById('paintRotation').addEventListener('change', () => this.markProjectDirty());
      document.getElementById('paintRotateLeftBtn').addEventListener('click', () => { this.setPaintRotation(this.paintView.rotation - 15); this.markProjectDirty(); });
      document.getElementById('paintRotateRightBtn').addEventListener('click', () => { this.setPaintRotation(this.paintView.rotation + 15); this.markProjectDirty(); });
      document.getElementById('paintFitBtn').addEventListener('click', () => this.fitPaintView());
      document.getElementById('paintResetViewBtn').addEventListener('click', () => { this.setPaintRotation(0); this.fitPaintView(); this.markProjectDirty(); });

      this.paintCanvas.addEventListener('pointerdown', (e) => this.startPaintStroke(e));
      this.paintCanvas.addEventListener('pointermove', (e) => this.movePaintStroke(e));
      this.paintCanvas.addEventListener('pointerup', (e) => this.endPaintStroke(e));
      this.paintCanvas.addEventListener('pointercancel', (e) => this.endPaintStroke(e));
      this.paintCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
      document.getElementById('paintStage').addEventListener('wheel', (e) => {
        e.preventDefault();
        this.setPaintZoom(this.paintView.zoom * (e.deltaY < 0 ? 1.1 : .9), { x: e.clientX, y: e.clientY });
        this.markProjectDirty();
      }, { passive: false });
      window.addEventListener('resize', debounce(() => {
        if (document.getElementById('paintModal').classList.contains('show')) this.fitPaintView();
      }, 80));
      document.addEventListener('fullscreenchange', () => {
        if (document.getElementById('paintModal').classList.contains('show')) {
          if (document.fullscreenElement) this.lockPaintOrientation();
          requestAnimationFrame(() => this.fitPaintView());
        }
      });
    }

    openPaintMode() {
      const modal = document.getElementById('paintModal');
      const drawingLayer = this.layerSettings.drawing;
      const wasVisible = drawingLayer.visible;
      drawingLayer.visible = false;
      this.drawCanvas();
      this.paintBackgroundCtx.clearRect(0, 0, this.paintBackground.width, this.paintBackground.height);
      this.paintBackgroundCtx.drawImage(this.canvas, 0, 0);
      drawingLayer.visible = wasVisible;
      this.drawCanvas();
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => this.fitPaintView());
      this.enterPaintFullscreen(modal);
    }

    async enterPaintFullscreen(modal) {
      if (document.fullscreenElement) {
        await this.lockPaintOrientation();
        return;
      }
      try {
        if (modal.requestFullscreen) await modal.requestFullscreen({ navigationUI: 'hide' });
        else if (modal.webkitRequestFullscreen) await modal.webkitRequestFullscreen();
        await this.lockPaintOrientation();
      } catch (error) {}
    }

    async lockPaintOrientation() {
      try {
        if (screen.orientation?.lock) await screen.orientation.lock('portrait');
      } catch (error) {}
    }

    closePaintMode() {
      document.getElementById('paintModal').classList.remove('show');
      document.body.style.overflow = '';
      this.layerSettings.drawing.visible = true;
      this.selectedLayerId = 'drawing';
      this.renderLayerPanel();
      this.scheduleDraw();
      try { screen.orientation?.unlock?.(); } catch (error) {}
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }

    setPaintBoardOnly(enabled) {
      this.paintView.boardOnly = enabled === true;
      const button = document.getElementById('paintBoardOnlyBtn');
      button.classList.toggle('active', this.paintView.boardOnly);
      button.setAttribute('aria-pressed', String(this.paintView.boardOnly));
      document.getElementById('paintCanvasStack').classList.toggle('board-only', this.paintView.boardOnly);
      requestAnimationFrame(() => this.fitPaintView());
      document.getElementById('paintStatus').textContent = this.paintView.boardOnly
        ? '当前仅显示安安的画板区域'
        : '可随时缩放、旋转或移动画布';
    }

    setPaintToolbarCollapsed(collapsed) {
      this.paintView.toolbarCollapsed = collapsed === true;
      const modal = document.getElementById('paintModal');
      const button = document.getElementById('paintToolbarToggleBtn');
      modal.classList.toggle('toolbar-collapsed', this.paintView.toolbarCollapsed);
      button.setAttribute('aria-expanded', String(!this.paintView.toolbarCollapsed));
      button.textContent = this.paintView.toolbarCollapsed ? '⌃ 展开工具栏' : '⌄ 收起工具栏';
      requestAnimationFrame(() => this.fitPaintView());
    }

    setPaintPanMode(enabled) {
      this.paintView.panning = enabled === true;
      const button = document.getElementById('paintPanBtn');
      button.classList.toggle('active', this.paintView.panning);
      button.setAttribute('aria-pressed', String(this.paintView.panning));
      this.paintCanvas.classList.toggle('pan-ready', this.paintView.panning);
      if (!this.paintView.panning) this.paintCanvas.classList.remove('panning');
      if (this.paintView.panning) document.getElementById('paintStatus').textContent = '拖动画布调整位置，再点一次可继续绘画';
    }

    setPaintZoom(zoom, anchor) {
      const nextZoom = Math.max(.4, Math.min(4, Number(zoom) || 1));
      if (anchor) {
        const stageRect = document.getElementById('paintStage').getBoundingClientRect();
        const localX = anchor.x - (stageRect.left + stageRect.width / 2);
        const localY = anchor.y - (stageRect.top + stageRect.height / 2);
        const ratio = nextZoom / this.paintView.zoom;
        this.paintView.panX = localX - (localX - this.paintView.panX) * ratio;
        this.paintView.panY = localY - (localY - this.paintView.panY) * ratio;
      }
      this.paintView.zoom = nextZoom;
      this.applyPaintView();
    }

    setPaintRotation(rotation) {
      let nextRotation = Number(rotation) || 0;
      nextRotation = ((nextRotation + 180) % 360 + 360) % 360 - 180;
      this.paintView.rotation = nextRotation;
      this.applyPaintView();
    }

    applyPaintView() {
      const stack = document.getElementById('paintCanvasStack');
      stack.style.transform = `translate3d(${this.paintView.panX}px, ${this.paintView.panY}px, 0) scale(${this.paintView.zoom}) rotate(${this.paintView.rotation}deg)`;
      const percent = Math.round(this.paintView.zoom * 100);
      document.getElementById('paintZoom').value = percent;
      document.getElementById('paintZoomValue').textContent = percent + '%';
      document.getElementById('paintRotation').value = Math.round(this.paintView.rotation);
      document.getElementById('paintRotationValue').textContent = Math.round(this.paintView.rotation) + '°';
    }

    fitPaintView() {
      const stage = document.getElementById('paintStage');
      const stack = document.getElementById('paintCanvasStack');
      if (!stage.clientWidth || !stack.offsetWidth) return;
      let zoom = 1;
      let panX = 0;
      let panY = 0;
      const availableWidth = Math.max(1, stage.clientWidth - 24);
      const availableHeight = Math.max(1, stage.clientHeight - 24);
      const radians = this.paintView.rotation * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const rawWidth = this.paintView.boardOnly
        ? stack.offsetWidth * this.boardArea.width / this.paintCanvas.width
        : stack.offsetWidth;
      const rawHeight = this.paintView.boardOnly
        ? stack.offsetHeight * this.boardArea.height / this.paintCanvas.height
        : stack.offsetHeight;
      const rotatedWidth = Math.abs(rawWidth * cos) + Math.abs(rawHeight * sin);
      const rotatedHeight = Math.abs(rawWidth * sin) + Math.abs(rawHeight * cos);
      zoom = Math.min(4, Math.max(.4, Math.min(availableWidth / rotatedWidth, availableHeight / rotatedHeight) * .96));
      if (this.paintView.boardOnly) {
        const boardCenterX = (this.boardArea.left + this.boardArea.right) / 2;
        const boardCenterY = (this.boardArea.top + this.boardArea.bottom) / 2;
        const offsetX = (boardCenterX / this.paintCanvas.width - .5) * stack.offsetWidth;
        const offsetY = (boardCenterY / this.paintCanvas.height - .5) * stack.offsetHeight;
        panX = -(offsetX * cos - offsetY * sin) * zoom;
        panY = -(offsetX * sin + offsetY * cos) * zoom;
      }
      this.paintView.zoom = zoom;
      this.paintView.panX = panX;
      this.paintView.panY = panY;
      this.applyPaintView();
    }

    paintPointFromEvent(e) {
      const stageRect = document.getElementById('paintStage').getBoundingClientRect();
      const stack = document.getElementById('paintCanvasStack');
      const dx = e.clientX - (stageRect.left + stageRect.width / 2 + this.paintView.panX);
      const dy = e.clientY - (stageRect.top + stageRect.height / 2 + this.paintView.panY);
      const radians = -this.paintView.rotation * Math.PI / 180;
      const localX = (dx * Math.cos(radians) - dy * Math.sin(radians)) / this.paintView.zoom;
      const localY = (dx * Math.sin(radians) + dy * Math.cos(radians)) / this.paintView.zoom;
      return {
        x: (localX / stack.offsetWidth + .5) * this.paintCanvas.width,
        y: (localY / stack.offsetHeight + .5) * this.paintCanvas.height,
        pressure: e.pointerType === 'pen' ? Math.max(.08, e.pressure || .35) : .58
      };
    }

    startPaintStroke(e) {
      if (this.paintPointerId !== null) return;
      e.preventDefault();
      this.paintPointerId = e.pointerId;
      this.paintCanvas.setPointerCapture(e.pointerId);
      if (this.paintView.panning || e.button === 1) {
        this.paintPanSession = { clientX: e.clientX, clientY: e.clientY, panX: this.paintView.panX, panY: this.paintView.panY };
        this.paintCanvas.classList.add('panning');
        return;
      }
      this.paintLastPoint = this.paintPointFromEvent(e);
      this.updatePressureStatus(e, this.paintLastPoint.pressure);
      this.drawPaintSegment(this.paintLastPoint, { ...this.paintLastPoint, x: this.paintLastPoint.x + .01 });
    }

    movePaintStroke(e) {
      if (e.pointerId !== this.paintPointerId) return;
      e.preventDefault();
      if (this.paintPanSession) {
        this.paintView.panX = this.paintPanSession.panX + e.clientX - this.paintPanSession.clientX;
        this.paintView.panY = this.paintPanSession.panY + e.clientY - this.paintPanSession.clientY;
        this.applyPaintView();
        return;
      }
      if (!this.paintLastPoint) return;
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      for (const event of events) {
        const point = this.paintPointFromEvent(event);
        this.drawPaintSegment(this.paintLastPoint, point);
        this.paintLastPoint = point;
        this.updatePressureStatus(event, point.pressure);
      }
    }

    endPaintStroke(e) {
      if (e.pointerId !== this.paintPointerId) return;
      e.preventDefault();
      if (this.paintCanvas.hasPointerCapture(e.pointerId)) this.paintCanvas.releasePointerCapture(e.pointerId);
      this.paintPointerId = null;
      if (this.paintPanSession) {
        this.paintPanSession = null;
        this.paintCanvas.classList.remove('panning');
        this.markProjectDirty();
        return;
      }
      this.paintLastPoint = null;
      this.paintDirty = true;
      this.savePaintSnapshot();
      this.markProjectDirty();
    }

    drawPaintSegment(from, to) {
      const ctx = this.paintCtx;
      const baseSize = parseFloat(document.getElementById('paintSize').value) || 10;
      const selectedOpacity = (parseInt(document.getElementById('paintOpacity').value, 10) || 100) / 100;
      const pressure = (from.pressure + to.pressure) / 2;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(.7, baseSize * (.35 + pressure * .95));
      if (this.paintTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = selectedOpacity * (this.paintTool === 'marker' ? .34 : 1);
        ctx.strokeStyle = document.getElementById('paintColor').value;
        if (this.paintTool === 'marker') ctx.lineWidth *= 1.8;
      }
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    }

    updatePressureStatus(e, pressure) {
      const pill = document.getElementById('pressurePill');
      const isPen = e.pointerType === 'pen';
      pill.classList.toggle('active', isPen);
      document.getElementById('pressureText').textContent = isPen ? '压感 ' + Math.round(pressure * 100) + '%' : '鼠标 / 触摸';
      document.getElementById('paintStatus').textContent = isPen ? '数位笔已连接，笔触正在跟随力度' : '正在绘画…';
    }

    savePaintSnapshot(initial = false) {
      if (!initial && this.paintHistoryIndex >= 0) this.paintHistory.splice(this.paintHistoryIndex + 1);
      const snapshot = this.paintCtx.getImageData(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.paintHistory.push(snapshot);
      if (this.paintHistory.length > this.paintHistoryLimit) this.paintHistory.shift();
      this.paintHistoryIndex = this.paintHistory.length - 1;
      this.updatePaintHistoryButtons();
    }

    restorePaintSnapshot(index) {
      const snapshot = this.paintHistory[index];
      if (!snapshot) return;
      this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.paintCtx.putImageData(snapshot, 0, 0);
      this.paintDirty = true;
      this.markProjectDirty();
      this.updatePaintHistoryButtons();
    }

    undoPaint() {
      if (this.paintHistoryIndex <= 0) return;
      this.restorePaintSnapshot(--this.paintHistoryIndex);
    }

    redoPaint() {
      if (this.paintHistoryIndex >= this.paintHistory.length - 1) return;
      this.restorePaintSnapshot(++this.paintHistoryIndex);
    }

    updatePaintHistoryButtons() {
      document.getElementById('paintUndoBtn').disabled = this.paintHistoryIndex <= 0;
      document.getElementById('paintRedoBtn').disabled = this.paintHistoryIndex >= this.paintHistory.length - 1;
    }

    showUpdateIntroOnce() {
      let seen = '';
      try { seen = localStorage.getItem('ananSeenVersion') || ''; } catch (e) {}
      if (seen !== '2.0') setTimeout(() => this.openUpdateIntro(), 650);
    }

    openUpdateIntro() {
      document.getElementById('updateModal').classList.add('show');
    }

    closeUpdateIntro() {
      document.getElementById('updateModal').classList.remove('show');
      try { localStorage.setItem('ananSeenVersion', '2.0'); } catch (e) {}
    }

    buildPresetGrid() {
      const grid = document.getElementById('presetGrid');
      const frag = document.createDocumentFragment();
      PRESET_TEXTS.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.innerHTML = `<div class="preset-name">${preset.name}</div><div class="preset-preview">${preset.preview}</div>`;
        item.addEventListener('click', () => {
          const textarea = document.getElementById('textInput');
          const existing = textarea.value;
          textarea.value = existing ? existing + '\n' + preset.text : preset.text;
          const layer = this.activeTextLayer();
          if (layer) {
            layer.text = textarea.value;
            this.updateTextLayerLabel(layer);
            this.fitTextLayerToBoard(layer);
          }
          this.autoResizeTextarea(textarea);
          if (layer) { layer.history.push(textarea.value); this.history = layer.history; }
          this.updateUndoRedoButtons();
          if (layer) this.syncTextLayerControls();
          this.markProjectDirty();
          this.scheduleDraw();
          document.getElementById('presetModal').classList.remove('show');
        });
        frag.appendChild(item);
      });
      grid.appendChild(frag);
    }

    autoResizeTextarea(textarea) {
      textarea.style.height = 'auto';
      const focusMode = document.body.classList.contains('focus-mode');
      const minHeight = focusMode ? 260 : 60;
      const maxHeight = focusMode ? Math.min(600, Math.max(320, window.innerHeight - 220)) : 120;
      textarea.style.height = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight) + 'px';
    }

    updateUndoRedoButtons() {
      document.getElementById('undoBtn').disabled = !this.history.canUndo();
      document.getElementById('redoBtn').disabled = !this.history.canRedo();
    }

    checkMobile() {
      if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        document.getElementById('mobileWarning').style.display = 'block';
      }
    }

    loadImageFromFile(file) {
      return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          const maxDimension = 2048;
          const longest = Math.max(img.naturalWidth, img.naturalHeight);
          if (longest <= maxDimension) { resolve(img); return; }
          const ratio = maxDimension / longest;
          const reduced = document.createElement('canvas');
          reduced.width = Math.max(1, Math.round(img.naturalWidth * ratio));
          reduced.height = Math.max(1, Math.round(img.naturalHeight * ratio));
          reduced.getContext('2d').drawImage(img, 0, 0, reduced.width, reduced.height);
          resolve(reduced);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    }

    truncateFilename(name, maxLen) {
      return name.length > maxLen ? name.substring(0, maxLen) + '...' : name;
    }

    async preloadImages() {
      const [base, hand] = await Promise.all([
        ImageCache.load('anans/开心.png'),
        ImageCache.load('anans/AnAn2.png')
      ]);
      this.baseImage = base;
      this.handImage = hand;
      this.invalidateBaseCache();
    }

    async changeEmotion(filename) {
      if (filename === 'custom') {
        document.getElementById('customEmotionInput').click();
        return;
      }
      if (filename === 'custom_temp' && this.customEmotionImage) {
        this.baseImage = this.customEmotionImage;
        this.currentEmotion = 'custom';
        this.isCustomEmotion = true;
        this.invalidateBaseCache();
        this.scheduleDraw();
        return;
      }
      this.isCustomEmotion = false;
      this.currentEmotion = filename;
      const img = await ImageCache.load('anans/' + filename);
      if (img) { this.baseImage = img; this.invalidateBaseCache(); this.scheduleDraw(); }
    }

    async handleCustomEmotion(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const img = await this.loadImageFromFile(file);
        if (img) {
          this.baseImage = img;
          this.customEmotionImage = img;
          this.customEmotionSourceBlob = await this.imageSourceToBlob(img);
          this.customEmotionName = file.name;
          this.currentEmotion = 'custom';
          this.isCustomEmotion = true;
          const select = document.getElementById('emotionSelect');
          select.querySelector('option[value="custom_temp"]')?.remove();
          const opt = document.createElement('option');
          opt.value = 'custom_temp';
          opt.text = '📷 ' + this.truncateFilename(file.name, 20);
          opt.selected = true;
          select.insertBefore(opt, select.lastElementChild);
          this.invalidateBaseCache();
          this.markProjectDirty();
          this.scheduleDraw();
        }
      } catch (e) {
        console.error('加载自定义表情失败:', e);
      } finally {
        event.target.value = '';
      }
    }

    async handleCustomImage(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const img = await this.loadImageFromFile(file);
        if (img) {
          const imageWidth = img.naturalWidth || img.width;
          const imageHeight = img.naturalHeight || img.height;
          const baseScale = Math.min((this.boardArea.width - 24) / imageWidth, (this.boardArea.height - 24) / imageHeight, 1);
          const layer = {
            id: 'image-' + (++this.imageLayerCounter),
            type: 'image', image: img, name: file.name, kind: '图片图层',
            sourceBlob: await this.imageSourceToBlob(img),
            x: (this.boardArea.left + this.boardArea.right) / 2,
            y: (this.boardArea.top + this.boardArea.bottom) / 2,
            rotation: 0, scaleX: baseScale, scaleY: baseScale, baseScale,
            visible: true, opacity: 1, locked: false
          };
          this.imageLayers.push(layer);
          const textIndex = this.layerOrder.indexOf(this.activeTextLayerId);
          this.layerOrder.splice(Math.max(1, textIndex), 0, layer.id);
          this.customImage = layer;
          this.selectedLayerId = layer.id;

          this.syncActiveImageControls();
          this.renderLayerPanel();
          this.markProjectDirty();
          this.scheduleDraw();
        }
      } catch (e) {
        console.error('加载自定义图片失败:', e);
      } finally {
        event.target.value = '';
      }
    }

    removeCustomImage() {
      if (this.customImage) this.removeImageLayer(this.customImage.id);
    }

    async handleCustomFont(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const fontName = 'CustomFont_' + Date.now();
        const fontFace = new FontFace(fontName, buffer);
        await fontFace.load();
        document.fonts.add(fontFace);

        const select = document.getElementById('fontFamily');
        select.querySelectorAll('option').forEach(opt => {
          if (opt.text.startsWith('📝 ' + file.name.slice(0, 8))) opt.remove();
        });
        const opt = document.createElement('option');
        opt.value = fontName + ", 'Noto Color Emoji', sans-serif";
        opt.text = '📝 ' + this.truncateFilename(file.name, 15);
        opt.dataset.customFont = '1';
        opt.selected = true;
        select.insertBefore(opt, select.lastElementChild);

        const preview = document.getElementById('fontPreview');
        preview.style.fontFamily = fontName;
        preview.textContent = '自定义字体：香咕真的很好吃喵～ 🍬✨';

        const layer = this.activeTextLayer();
        if (layer) layer.fontFamily = opt.value;
        this.customFonts.push({ fontName, value: opt.value, label: opt.text, buffer: buffer.slice(0) });
        this.markProjectDirty();
        this.textMetricsCache.clear();
        this.scheduleDraw();
      } catch (e) {
        alert('字体加载失败，请尝试其他格式');
        document.getElementById('fontFamily').value = "'Noto Sans SC', 'Noto Color Emoji', sans-serif";
        const layer = this.activeTextLayer();
        if (layer) layer.fontFamily = document.getElementById('fontFamily').value;
      }
    }

    openParamModal(item) {
      const textarea = document.getElementById('textInput');
      const selStart = textarea.selectionStart;
      const selEnd   = textarea.selectionEnd;
      const selected = textarea.value.substring(selStart, selEnd);
      const type     = item.dataset.paramType;
      const def      = item.dataset.paramDefault;

      const modal      = document.getElementById('paramModal');
      const dirGroup   = document.getElementById('paramDirectionGroup');
      const dirLabel   = document.getElementById('paramDirectionLabel');
      const dirBtns    = document.getElementById('paramDirectionBtns');
      const inputLabel = document.getElementById('paramInputLabel');
      const inputEl    = document.getElementById('paramInputValue');
      const hintEl     = document.getElementById('paramInputHint');

      modal.dataset.currentType = type;
      modal.dataset.dirSign = '1';

      document.getElementById('paramSelectedText').textContent = selected || '（未选中文字，将在光标处插入标签）';

      dirGroup.style.display = 'none';
      dirBtns.innerHTML = '';

      const makeDirectionBtns = (labelText, options) => {
        dirGroup.style.display = 'block';
        dirLabel.textContent   = labelText;
        dirBtns.style.gridTemplateColumns = `repeat(${options.length}, 1fr)`;
        options.forEach((opt, i) => {
          const btn = document.createElement('button');
          btn.className = 'btn';
          btn.textContent = opt.label;
          btn.style.cssText = 'font-size:13px;height:40px;';
          if (i === 0) {
            btn.style.background = '#333';
            btn.style.color = '#fff';
            modal.dataset.dirSign = opt.sign;
          }
          btn.addEventListener('click', () => {
            dirBtns.querySelectorAll('button').forEach(b => {
              b.style.background = '#fff';
              b.style.color = '#000';
            });
            btn.style.background = '#333';
            btn.style.color = '#fff';
            modal.dataset.dirSign = opt.sign;
          });
          dirBtns.appendChild(btn);
        });
      };

      if (type === '旋转') {
        document.getElementById('paramModalTitle').textContent = '🔃 设置旋转角度';
        makeDirectionBtns('旋转方向', [
          { label: '↻ 顺时针', sign: '1' },
          { label: '↺ 逆时针', sign: '-1' }
        ]);
        inputLabel.textContent = '旋转角度（度）';
        inputEl.value          = def;
        inputEl.removeAttribute('min');
        inputEl.removeAttribute('max');
        hintEl.textContent     = '输入 0 ~ 360 的角度值，方向由上方选项决定';

      } else if (type === '偏移') {
        document.getElementById('paramModalTitle').textContent = '↔ 设置文字偏移';
        makeDirectionBtns('偏移方向', [
          { label: '→ 向右',  sign: 'right'  },
          { label: '← 向左',  sign: 'left'   },
          { label: '↓ 向下',  sign: 'down'   },
          { label: '↑ 向上',  sign: 'up'     }
        ]);
        inputLabel.textContent = '偏移距离（px）';
        inputEl.value          = def;
        inputEl.removeAttribute('min');
        inputEl.removeAttribute('max');
        hintEl.textContent     = '输入偏移的像素距离，方向由上方选项决定';

      } else if (type === '文字大小') {
        document.getElementById('paramModalTitle').textContent = '设置字体大小';
        inputLabel.textContent = '字体大小（px）';
        inputEl.value          = def;
        inputEl.removeAttribute('min');
        inputEl.removeAttribute('max');
        hintEl.textContent     = '建议 10 ~ 120，数字越大字越大';

      } else if (type === '文字粗细') {
        document.getElementById('paramModalTitle').textContent = '设置字体粗细';
        inputLabel.textContent = '字体粗细（100 ~ 900）';
        inputEl.value          = def;
        inputEl.removeAttribute('min');
        inputEl.removeAttribute('max');
        hintEl.textContent     = '100 最细，900 最粗，通常用 100 的倍数，例如 400 / 700 / 900';
      }

      document.getElementById('effectModal').classList.remove('show');
      modal.classList.add('show');
      setTimeout(() => inputEl.select(), 50);
    }

    insertEffect(startTag, endTag) {
      const textarea = document.getElementById('textInput');
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      const value = textarea.value;

      textarea.value = value.substring(0, selStart) + startTag + value.substring(selStart, selEnd) + endTag + value.substring(selEnd);
      const layer = this.activeTextLayer();
      if (layer) { layer.text = textarea.value; this.updateTextLayerLabel(layer); }
      textarea.focus();
      textarea.setSelectionRange(selStart + startTag.length, selStart + startTag.length);

      this.autoResizeTextarea(textarea);
      if (layer) { layer.history.push(textarea.value); this.history = layer.history; }
      this.updateUndoRedoButtons();
      this.markProjectDirty();
      this.scheduleDraw();
      document.getElementById('effectModal').classList.remove('show');
    }

    applyFilterPreset(presetName) {
      const preset = FILTER_PRESETS[presetName] || FILTER_PRESETS.none;
      this.filter = { preset: presetName, ...preset };

      document.getElementById('filterBrightness').value = preset.brightness;
      document.getElementById('brightnessValue').textContent = preset.brightness;
      document.getElementById('filterContrast').value = preset.contrast;
      document.getElementById('contrastValue').textContent = preset.contrast;
      document.getElementById('filterSaturate').value = preset.saturate;
      document.getElementById('saturateValue').textContent = preset.saturate;
      this.markProjectDirty();
    }

    get canvasFilterString() {
      const f = this.filter;
      if (f.brightness === 100 && f.contrast === 100 && f.saturate === 100) return 'none';
      return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%)`;
    }

    parseStyledText(rawText) {
      const cached = this.parsedTextCache.get(rawText);
      if (cached) return cached;
      const sourceText = rawText;
      rawText = rawText.replace(/\[洗脑魔法开始\]([\s\S]*?)\[洗脑魔法结束\]/g, '[洗脑魔法开始]【$1】[洗脑魔法结束]');

      const tagRegex = /\[(红色|橙色|黄色|绿色|青色|蓝色|紫色|粉色|灰色|黑色|白色|棕色|删除线|下划线|斜体|粗体|洗脑魔法|阴影|渐变|描边|左右镜像|上下镜像)(开始|结束)\]|\[文字大小=(\d+)(开始|结束)\]|\[文字粗细=(\d+)(开始|结束)\]|\[旋转=(-?\d+(?:\.\d+)?)(开始|结束)\]|\[左右偏移=(-?\d+(?:\.\d+)?)(开始|结束)\]|\[上下偏移=(-?\d+(?:\.\d+)?)(开始|结束)\]/g;

      const tags = [];
      let match;
      while ((match = tagRegex.exec(rawText)) !== null) {
        if (match[1]) {
          tags.push({ index: match.index, length: match[0].length, name: match[1], type: match[2] });
        } else if (match[3] !== undefined) {
          tags.push({ index: match.index, length: match[0].length, name: '文字大小', type: match[4], value: parseInt(match[3]) });
        } else if (match[5] !== undefined) {
          tags.push({ index: match.index, length: match[0].length, name: '文字粗细', type: match[6], value: parseInt(match[5]) });
        } else if (match[7] !== undefined) {
          tags.push({ index: match.index, length: match[0].length, name: '旋转', type: match[8], value: parseFloat(match[7]) });
        } else if (match[9] !== undefined) {
          tags.push({ index: match.index, length: match[0].length, name: '左右偏移', type: match[10], value: parseFloat(match[9]) });
        } else if (match[11] !== undefined) {
          tags.push({ index: match.index, length: match[0].length, name: '上下偏移', type: match[12], value: parseFloat(match[11]) });
        }
      }

      const currentStyle = {
        color: null, strike: false, underline: false,
        italic: false, bold: false,
        shadow: false, gradient: false, outline: false,
        mirrorH: false, mirrorV: false,
        rotate: null,
        offsetX: 0, offsetY: 0,
        fontSize: null,
        fontWeight: null
      };

      const styleStack = [];
      const intervals = [];
      let pos = 0;

      for (const tag of tags) {
        if (tag.index > pos) {
          intervals.push({ start: pos, end: tag.index, style: { ...currentStyle } });
        }

        if (tag.type === '开始') {
          styleStack.push({ name: tag.name, value: tag.value, prevStyle: { ...currentStyle } });
          const cm = this.colorMap;
          if (cm[tag.name])               currentStyle.color = cm[tag.name];
          else if (tag.name === '删除线') currentStyle.strike = true;
          else if (tag.name === '下划线') currentStyle.underline = true;
          else if (tag.name === '斜体')   currentStyle.italic = true;
          else if (tag.name === '粗体')   currentStyle.bold = true;
          else if (tag.name === '洗脑魔法') currentStyle.color = '#9b59b6';
          else if (tag.name === '阴影')   currentStyle.shadow = true;
          else if (tag.name === '渐变')   currentStyle.gradient = true;
          else if (tag.name === '描边')   currentStyle.outline = true;
          else if (tag.name === '左右镜像') currentStyle.mirrorH = true;
          else if (tag.name === '上下镜像') currentStyle.mirrorV = true;
          else if (tag.name === '旋转')   currentStyle.rotate = tag.value;
          else if (tag.name === '左右偏移') currentStyle.offsetX = tag.value;
          else if (tag.name === '上下偏移') currentStyle.offsetY = tag.value;
          else if (tag.name === '文字大小')  currentStyle.fontSize = tag.value;
          else if (tag.name === '文字粗细')  currentStyle.fontWeight = tag.value;

        } else if (tag.type === '结束') {
          let idx = -1;
          for (let i = styleStack.length - 1; i >= 0; i--) {
            const x = styleStack[i];
            if (x.name !== tag.name) continue;
            const parameterized = tag.name === '文字大小' || tag.name === '文字粗细' || tag.name === '旋转' || tag.name === '左右偏移' || tag.name === '上下偏移';
            if (!parameterized || x.value === tag.value) { idx = i; break; }
          }
          if (idx !== -1) {
            Object.assign(currentStyle, styleStack[idx].prevStyle);
            styleStack.splice(idx, 1);
          }
        }

        pos = tag.index + tag.length;
      }

      if (pos < rawText.length) {
        intervals.push({ start: pos, end: rawText.length, style: { ...currentStyle } });
      }

      const result = [];
      for (const interval of intervals) {
        const chars = Array.from(rawText.substring(interval.start, interval.end));
        for (const char of chars) {
          result.push({ char, ...interval.style });
        }
      }
      return this.parsedTextCache.set(sourceText, result);
    }

    drawImageLayer(layer) {
      const bounds = this.getTransformBounds(layer);
      this.ctx.translate(layer.x, layer.y);
      this.ctx.rotate((layer.rotation || 0) * Math.PI / 180);
      this.ctx.scale(layer.scaleX, layer.scaleY);
      this.ctx.drawImage(layer.image, -bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height);
    }

    drawTextLayer(layer) {
      const bounds = this.getTransformBounds(layer);
      const rect = this.getLayerLocalRect(layer);
      const chars = this.parseStyledText(layer.text || '');
      this.ctx.translate(layer.x, layer.y);
      this.ctx.rotate((layer.rotation || 0) * Math.PI / 180);
      this.ctx.scale(layer.scaleX, layer.scaleY);
      return this.renderTextInArea(
        chars,
        rect.x,
        rect.y + bounds.firstLineSize,
        bounds.width,
        Math.max(1, bounds.height - bounds.firstLineSize),
        layer.fontSize,
        layer.fontFamily,
        layer.fontColor,
        layer.textAlign,
        layer.lineHeight
      );
    }

    scheduleDraw() {
      if (this.drawPending) return;
      this.drawPending = true;
      requestAnimationFrame(() => {
        this.drawPending = false;
        this.drawCanvas();
        this.drawInteractionOverlay();
      });
    }

    invalidateBaseCache() {
      this.baseRenderCacheKey = '';
    }

    getBaseRenderCanvas() {
      if (!this.baseImage) return null;
      const sourceWidth = this.baseImage.naturalWidth || this.baseImage.width || 0;
      const sourceHeight = this.baseImage.naturalHeight || this.baseImage.height || 0;
      if (!sourceWidth || ('complete' in this.baseImage && !this.baseImage.complete)) return null;
      const sourceKey = this.baseImage.currentSrc || this.baseImage.src || (sourceWidth + 'x' + sourceHeight);
      const key = sourceKey + '|' + this.canvasFilterString;
      if (key === this.baseRenderCacheKey) return this.baseRenderCache;
      const cacheCtx = this.baseRenderCache.getContext('2d');
      cacheCtx.clearRect(0, 0, this.baseRenderCache.width, this.baseRenderCache.height);
      const filterStr = this.canvasFilterString;
      if (filterStr !== 'none' && typeof cacheCtx.filter !== 'undefined') cacheCtx.filter = filterStr;
      cacheCtx.drawImage(this.baseImage, 0, 0, this.baseRenderCache.width, this.baseRenderCache.height);
      if (typeof cacheCtx.filter !== 'undefined') cacheCtx.filter = 'none';
      this.baseRenderCacheKey = key;
      return this.baseRenderCache;
    }

    drawCanvas() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (const id of this.layerOrder) {
        const layer = this.getLayer(id);
        if (!layer || !layer.visible || layer.opacity <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity ?? 1));

        if (id === 'base') {
          const baseCanvas = this.getBaseRenderCanvas();
          if (baseCanvas) ctx.drawImage(baseCanvas, 0, 0);
        } else if (layer.type === 'image') {
          this.drawImageLayer(layer);
        } else if (layer.type === 'text') {
          this.drawTextLayer(layer);
        } else if (id === 'drawing') {
          ctx.drawImage(this.paintCanvas, 0, 0, this.canvas.width, this.canvas.height);
        } else if (id === 'hand' && !this.isCustomEmotion && this.handImage && this.handImage.complete && this.handImage.naturalWidth) {
          ctx.drawImage(this.handImage, 0, 0, this.canvas.width, this.canvas.height);
        }
        ctx.restore();
      }
      const hasOversizedText = this.textLayers.some(layer => layer.visible && this.getTransformBounds(layer).height >= 539);
      document.getElementById('overflowWarning').classList.toggle('show', hasOversizedText);
    }

    renderTextInArea(chars, areaX, areaY, maxWidth, maxHeight, globalFontSize, fontFamily, defaultColor, align, lineHeightMult) {
      const ctx = this.ctx;

      const processed = chars.map(char => {
        const fontSize = char.fontSize !== null ? char.fontSize : globalFontSize;
        const weight = char.fontWeight !== null ? char.fontWeight : (char.bold ? 'bold' : 'normal');
        const style = char.italic ? 'italic' : 'normal';
        const font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
        const metricsKey = font + '\u0000' + char.char;
        let charWidth = this.textMetricsCache.get(metricsKey);
        if (charWidth === undefined) {
          ctx.font = font;
          charWidth = this.textMetricsCache.set(metricsKey, ctx.measureText(char.char).width);
        }
        return { ...char, resolvedFont: font, resolvedFontSize: fontSize, charWidth };
      });

      const lines = [];
      let currentLine = [];
      let currentLineWidth = 0;

      for (const char of processed) {
        if (char.char === '\n') {
          lines.push(currentLine);
          currentLine = [];
          currentLineWidth = 0;
          continue;
        }
        if (currentLineWidth + char.charWidth > maxWidth - 1 && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = [char];
          currentLineWidth = char.charWidth;
        } else {
          currentLine.push(char);
          currentLineWidth += char.charWidth;
        }
      }
      if (currentLine.length) lines.push(currentLine);
      if (!lines.length) return 0;

      ctx.font = `normal ${globalFontSize}px ${fontFamily}`;
      const metrics = ctx.measureText('M');
      const ascent  = metrics.actualBoundingBoxAscent  || globalFontSize * 0.8;
      const descent = metrics.actualBoundingBoxDescent || globalFontSize * 0.2;

      let lineY = areaY;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i > 0) {
          const previousLine = lines[i - 1];
          const previousMaxSize = Math.max(globalFontSize, ...previousLine.map(char => char.resolvedFontSize));
          lineY += previousMaxSize * lineHeightMult;
        }

        const lineMaxSize = Math.max(globalFontSize, ...line.map(char => char.resolvedFontSize));
        if (lineY + Math.max(descent, lineMaxSize * .2) > areaY + maxHeight) break;
        if (!line.length) continue;

        const totalWidth = line.reduce((sum, c) => sum + c.charWidth, 0);

        let startX;
        if (align === 'left') {
          startX = areaX;
        } else if (align === 'right') {
          startX = areaX + maxWidth - totalWidth;
        } else {
          startX = areaX + (maxWidth - totalWidth) / 2;
        }

        const xScale = 1;

        let x = startX;
        const charPositions = line.map(char => {
          const pos = x;
          x += char.charWidth * xScale;
          return pos;
        });

        const strikeSections = [];
        const underlineSections = [];
        let strikeStart = null;
        let underlineStart = null;

        let ci = 0;
        while (ci < line.length) {
          const char = line[ci];
          const charX = charPositions[ci];

          if (char.rotate !== null) {
            const angle = char.rotate;
            let groupEnd = ci;
            while (groupEnd + 1 < line.length && line[groupEnd + 1].rotate === angle) groupEnd++;

            const groupStartX = charPositions[ci];
            const groupEndX   = charPositions[groupEnd] + line[groupEnd].charWidth * xScale;
            const groupCX     = (groupStartX + groupEndX) / 2;
            const groupCY     = lineY - globalFontSize / 2;

            ctx.save();
            ctx.translate(groupCX, groupCY);
            ctx.rotate(angle * Math.PI / 180);
            ctx.translate(-groupCX, -groupCY);

            for (let gi = ci; gi <= groupEnd; gi++) {
              const gc   = line[gi];
              const gcX  = charPositions[gi];
              const gcW  = gc.charWidth * xScale;

              ctx.save();
              ctx.font = gc.resolvedFont;

              if (gc.mirrorH || gc.mirrorV) {
                const mx = gcX + gcW / 2;
                const my = lineY - gc.resolvedFontSize / 2;
                ctx.translate(mx, my);
                if (gc.mirrorH) ctx.scale(-1, 1);
                if (gc.mirrorV) ctx.scale(1, -1);
                ctx.translate(-mx, -my);
              }

              if (gc.shadow) {
                ctx.shadowColor = 'rgba(0,0,0,0.65)';
                ctx.shadowBlur = 5;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
              }

              if (gc.gradient) {
                const grad = ctx.createLinearGradient(gcX, lineY - gc.resolvedFontSize, gcX + gcW, lineY);
                grad.addColorStop(0, '#e74c3c');
                grad.addColorStop(0.33, '#f1c40f');
                grad.addColorStop(0.66, '#27ae60');
                grad.addColorStop(1, '#9b59b6');
                ctx.fillStyle = grad;
              } else {
                ctx.fillStyle = gc.color || defaultColor;
              }

              ctx.fillText(gc.char, gcX + (gc.offsetX || 0), lineY + (gc.offsetY || 0));

              if (gc.outline) {
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.strokeStyle = gc.color || defaultColor;
                ctx.lineWidth = Math.max(1.5, gc.resolvedFontSize * 0.06);
                ctx.strokeText(gc.char, gcX + (gc.offsetX || 0), lineY + (gc.offsetY || 0));
              }

              ctx.restore();

              if (gc.strike) {
                if (!strikeStart) strikeStart = { x: gcX, color: gc.color };
              } else if (strikeStart) {
                strikeSections.push({ startX: strikeStart.x, endX: gcX, color: strikeStart.color });
                strikeStart = null;
              }
              if (gc.underline) {
                if (!underlineStart) underlineStart = { x: gcX, color: gc.color };
              } else if (underlineStart) {
                underlineSections.push({ startX: underlineStart.x, endX: gcX, color: underlineStart.color });
                underlineStart = null;
              }
            }

            ctx.restore();
            ci = groupEnd + 1;

          } else {
            const charW = char.charWidth * xScale;
            ctx.save();
            ctx.font = char.resolvedFont;

            if (char.mirrorH || char.mirrorV) {
              const cx = charX + charW / 2;
              const cy = lineY - char.resolvedFontSize / 2;
              ctx.translate(cx, cy);
              if (char.mirrorH) ctx.scale(-1, 1);
              if (char.mirrorV) ctx.scale(1, -1);
              ctx.translate(-cx, -cy);
            }

            if (char.shadow) {
              ctx.shadowColor = 'rgba(0,0,0,0.65)';
              ctx.shadowBlur = 5;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
            }

            if (char.gradient) {
              const grad = ctx.createLinearGradient(charX, lineY - char.resolvedFontSize, charX + charW, lineY);
              grad.addColorStop(0, '#e74c3c');
              grad.addColorStop(0.33, '#f1c40f');
              grad.addColorStop(0.66, '#27ae60');
              grad.addColorStop(1, '#9b59b6');
              ctx.fillStyle = grad;
            } else {
              ctx.fillStyle = char.color || defaultColor;
            }

            ctx.fillText(char.char, charX + (char.offsetX || 0), lineY + (char.offsetY || 0));

            if (char.outline) {
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.strokeStyle = char.color || defaultColor;
              ctx.lineWidth = Math.max(1.5, char.resolvedFontSize * 0.06);
              ctx.strokeText(char.char, charX + (char.offsetX || 0), lineY + (char.offsetY || 0));
            }

            ctx.restore();

            if (char.strike) {
              if (!strikeStart) strikeStart = { x: charX, color: char.color };
            } else if (strikeStart) {
              strikeSections.push({ startX: strikeStart.x, endX: charX, color: strikeStart.color });
              strikeStart = null;
            }
            if (char.underline) {
              if (!underlineStart) underlineStart = { x: charX, color: char.color };
            } else if (underlineStart) {
              underlineSections.push({ startX: underlineStart.x, endX: charX, color: underlineStart.color });
              underlineStart = null;
            }

            ci++;
          }
        }

        const finalX = charPositions[line.length - 1] + line[line.length - 1].charWidth * xScale;
        if (strikeStart)    strikeSections.push({ startX: strikeStart.x, endX: finalX, color: strikeStart.color });
        if (underlineStart) underlineSections.push({ startX: underlineStart.x, endX: finalX, color: underlineStart.color });

        ctx.save();
        ctx.lineWidth = Math.max(1, globalFontSize * 0.08);
        const strikeY    = lineY - (ascent - globalFontSize * 0.5);
        const underlineY = lineY + descent * 0.8;

        for (const s of strikeSections) {
          ctx.beginPath();
          ctx.strokeStyle = s.color || defaultColor;
          ctx.moveTo(s.startX, strikeY);
          ctx.lineTo(s.endX, strikeY);
          ctx.stroke();
        }
        for (const u of underlineSections) {
          ctx.beginPath();
          ctx.strokeStyle = u.color || defaultColor;
          ctx.moveTo(u.startX, underlineY);
          ctx.lineTo(u.endX, underlineY);
          ctx.stroke();
        }
        ctx.restore();
      }

      return lines.length;
    }

    markProjectDirty() {
      if (!this.projectReady || this.projectDirty) return;
      this.projectDirty = true;
      const status = document.getElementById('projectSaveStatus');
      status.textContent = '有未保存的修改';
      status.className = 'project-save-status dirty';
      document.getElementById('saveSettingsBtn').classList.add('unsaved');
    }

    markProjectClean(message = '所有修改已保存到当前浏览器') {
      this.projectDirty = false;
      const status = document.getElementById('projectSaveStatus');
      status.textContent = message;
      status.className = 'project-save-status saved';
      document.getElementById('saveSettingsBtn').classList.remove('unsaved');
    }

    canvasToBlob(canvas, type = 'image/png') {
      return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法编码画布')), type);
      });
    }

    async imageSourceToBlob(source) {
      const width = source.naturalWidth || source.width || 1;
      const height = source.naturalHeight || source.height || 1;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(source, 0, 0, width, height);
      return this.canvasToBlob(canvas);
    }

    loadImageFromBlob(blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
        image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('工程图片解码失败')); };
        image.src = url;
      });
    }

    serializeTextLayers() {
      return this.textLayers.map(layer => ({
        id: layer.id, type: 'text', name: this.getTextLayerName(layer.text), text: layer.text,
        fontFamily: layer.fontFamily, fontColor: layer.fontColor,
        textAlign: layer.textAlign, fontSize: layer.fontSize, lineHeight: layer.lineHeight,
        x: layer.x, y: layer.y, rotation: layer.rotation,
        scaleX: layer.scaleX, scaleY: layer.scaleY,
        visible: layer.visible, opacity: layer.opacity, locked: layer.locked === true
      }));
    }

    async createProjectSnapshot() {
      this.updateActiveTextStyleFromControls();
      const imageLayers = await Promise.all(this.imageLayers.map(async layer => ({
        id: layer.id, type: 'image', name: layer.name,
        x: layer.x, y: layer.y, rotation: layer.rotation,
        scaleX: layer.scaleX, scaleY: layer.scaleY, baseScale: layer.baseScale,
        visible: layer.visible, opacity: layer.opacity, locked: layer.locked === true,
        imageBlob: layer.sourceBlob || await this.imageSourceToBlob(layer.image)
      })));
      const drawingBlob = await this.canvasToBlob(this.paintCanvas);
      const customEmotionBlob = this.customEmotionImage
        ? (this.customEmotionSourceBlob || await this.imageSourceToBlob(this.customEmotionImage))
        : null;
      return {
        kind: 'anan-studio-project', schemaVersion: 4, savedAt: Date.now(),
        currentEmotion: this.currentEmotion,
        isCustomEmotion: this.isCustomEmotion,
        customEmotionName: this.customEmotionName || '自定义表情',
        customEmotionBlob,
        filter: { ...this.filter },
        coreLayers: Object.fromEntries(Object.entries(this.layerSettings).map(([id, layer]) => [id, {
          visible: layer.visible, opacity: layer.opacity
        }])),
        textLayers: this.serializeTextLayers(),
        imageLayers,
        layerOrder: [...this.layerOrder],
        selectedLayerId: this.selectedLayerId,
        activeTextLayerId: this.activeTextLayerId,
        drawingBlob,
        paintSettings: {
          tool: this.paintTool,
          color: document.getElementById('paintColor').value,
          size: document.getElementById('paintSize').value,
          opacity: document.getElementById('paintOpacity').value,
          boardOnly: this.paintView.boardOnly,
          toolbarCollapsed: this.paintView.toolbarCollapsed,
          rotation: this.paintView.rotation
        },
        uiState: {
          focusMode: document.body.classList.contains('focus-mode'),
          filterOpen: document.getElementById('filterBox').classList.contains('open')
        },
        customFonts: this.customFonts.map(font => ({
          fontName: font.fontName, value: font.value, label: font.label,
          buffer: font.buffer.slice(0)
        }))
      };
    }

    async restoreCustomFonts(fonts = []) {
      this.customFonts = [];
      document.querySelectorAll('#fontFamily option[data-custom-font="1"]').forEach(option => option.remove());
      for (const saved of fonts.slice(0, 20)) {
        try {
          const buffer = saved.buffer instanceof ArrayBuffer ? saved.buffer : await saved.buffer.arrayBuffer();
          const fontFace = new FontFace(saved.fontName, buffer);
          await fontFace.load();
          document.fonts.add(fontFace);
          const option = document.createElement('option');
          option.value = saved.value;
          option.text = saved.label || ('📝 ' + saved.fontName);
          option.dataset.customFont = '1';
          document.getElementById('fontFamily').insertBefore(option, document.getElementById('fontFamily').lastElementChild);
          this.customFonts.push({ ...saved, buffer: buffer.slice(0) });
        } catch (error) {
          console.warn('跳过无法恢复的自定义字体:', error);
        }
      }
    }

    safeNumber(value, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    createTextLayerFromSaved(saved, index) {
      const history = new UndoHistory(50);
      const layer = {
        id: saved.id || 'text-' + (index + 1), type: 'text',
        name: this.getTextLayerName(saved.text), kind: '可编辑文字',
        text: String(saved.text || ''),
        fontFamily: saved.fontFamily || StorageManager.getDefaults().fontFamily,
        fontColor: saved.fontColor || '#2c3e50',
        textAlign: ['left', 'center', 'right'].includes(saved.textAlign) ? saved.textAlign : 'center',
        fontSize: Math.max(8, Number(saved.fontSize) || 32),
        lineHeight: Math.max(1, Number(saved.lineHeight) || 1),
        x: this.safeNumber(saved.x, 260), y: this.safeNumber(saved.y, 452),
        rotation: this.safeNumber(saved.rotation, 0),
        scaleX: Math.max(.04, this.safeNumber(saved.scaleX, 1)),
        scaleY: Math.max(.04, this.safeNumber(saved.scaleY, 1)),
        visible: saved.visible !== false, opacity: Math.max(0, Math.min(1, Number(saved.opacity ?? 1))),
        locked: saved.locked === true, history
      };
      history.push(layer.text);
      return layer;
    }

    async applyProjectSnapshot(project) {
      if (!project || project.kind !== 'anan-studio-project') throw new Error('不是有效的安安工程');
      await this.restoreCustomFonts(project.customFonts || []);

      if (Array.isArray(project.textLayers) && project.textLayers.length) {
        this.textLayers = project.textLayers.slice(0, 30).map((layer, index) => this.createTextLayerFromSaved(layer, index));
      }
      this.textLayerCounter = this.textLayers.reduce((max, layer) => Math.max(max, Number(layer.id.split('-').pop()) || 0), 0);

      this.imageLayers = [];
      for (const saved of (project.imageLayers || []).slice(0, 20)) {
        if (!saved.imageBlob) continue;
        const image = await this.loadImageFromBlob(saved.imageBlob);
        const naturalWidth = image.naturalWidth || image.width;
        const naturalHeight = image.naturalHeight || image.height;
        const baseScale = Number(saved.baseScale) || Math.min((this.boardArea.width - 24) / naturalWidth, (this.boardArea.height - 24) / naturalHeight, 1);
        this.imageLayers.push({
          id: saved.id, type: 'image', image, name: saved.name || '图片图层', kind: '图片图层',
          sourceBlob: saved.imageBlob,
          x: this.safeNumber(saved.x, 260), y: this.safeNumber(saved.y, 534),
          rotation: this.safeNumber(saved.rotation, 0),
          scaleX: Math.max(.04, this.safeNumber(saved.scaleX, baseScale)),
          scaleY: Math.max(.04, this.safeNumber(saved.scaleY, baseScale)), baseScale,
          visible: saved.visible !== false, opacity: Math.max(0, Math.min(1, Number(saved.opacity ?? 1))),
          locked: saved.locked === true
        });
      }
      this.imageLayerCounter = this.imageLayers.reduce((max, layer) => Math.max(max, Number(layer.id.split('-').pop()) || 0), 0);

      if (project.coreLayers) {
        Object.entries(project.coreLayers).forEach(([id, saved]) => {
          if (!this.layerSettings[id]) return;
          this.layerSettings[id].visible = saved.visible !== false;
          this.layerSettings[id].opacity = Math.max(0, Math.min(1, Number(saved.opacity ?? 1)));
        });
      }
      const allLayerIds = new Set([...Object.keys(this.layerSettings), ...this.textLayers.map(layer => layer.id), ...this.imageLayers.map(layer => layer.id)]);
      const restoredOrder = Array.isArray(project.layerOrder) ? project.layerOrder.filter(id => allLayerIds.has(id)) : [];
      this.layerOrder = [...new Set([...restoredOrder, 'base', ...this.imageLayers.map(layer => layer.id), ...this.textLayers.map(layer => layer.id), 'drawing', 'hand'])];

      this.filter = {
        preset: FILTER_PRESETS[project.filter?.preset] ? project.filter.preset : 'none',
        brightness: Number(project.filter?.brightness ?? 100),
        contrast: Number(project.filter?.contrast ?? 100),
        saturate: Number(project.filter?.saturate ?? 100)
      };
      document.querySelectorAll('.filter-preset-btn').forEach(button => button.classList.toggle('active', button.dataset.filter === this.filter.preset));
      document.getElementById('filterBrightness').value = this.filter.brightness;
      document.getElementById('brightnessValue').textContent = this.filter.brightness;
      document.getElementById('filterContrast').value = this.filter.contrast;
      document.getElementById('contrastValue').textContent = this.filter.contrast;
      document.getElementById('filterSaturate').value = this.filter.saturate;
      document.getElementById('saturateValue').textContent = this.filter.saturate;

      if (project.customEmotionBlob) {
        const image = await this.loadImageFromBlob(project.customEmotionBlob);
        this.customEmotionImage = image;
        this.customEmotionSourceBlob = project.customEmotionBlob;
        this.customEmotionName = project.customEmotionName || '自定义表情';
        const select = document.getElementById('emotionSelect');
        select.querySelector('option[value="custom_temp"]')?.remove();
        const option = document.createElement('option');
        option.value = 'custom_temp';
        option.text = '📷 ' + this.truncateFilename(this.customEmotionName, 20);
        select.insertBefore(option, select.lastElementChild);
        if (project.isCustomEmotion === true || project.currentEmotion === 'custom') {
          this.baseImage = image;
          this.isCustomEmotion = true;
          this.currentEmotion = 'custom';
          option.selected = true;
        } else {
          await this.changeEmotion(project.currentEmotion || '开心.png');
          select.value = this.currentEmotion;
        }
      } else {
        this.customEmotionImage = null;
        this.customEmotionSourceBlob = null;
        this.customEmotionName = '';
        document.getElementById('emotionSelect').querySelector('option[value="custom_temp"]')?.remove();
        await this.changeEmotion(project.currentEmotion && project.currentEmotion !== 'custom' ? project.currentEmotion : '开心.png');
        document.getElementById('emotionSelect').value = this.currentEmotion;
      }
      this.invalidateBaseCache();

      this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      if (project.drawingBlob) {
        const drawing = await this.loadImageFromBlob(project.drawingBlob);
        this.paintCtx.drawImage(drawing, 0, 0, this.paintCanvas.width, this.paintCanvas.height);
      }
      if (project.paintSettings) {
        this.paintTool = ['pen', 'marker', 'eraser'].includes(project.paintSettings.tool) ? project.paintSettings.tool : 'pen';
        document.querySelectorAll('[data-paint-tool]').forEach(button => button.classList.toggle('active', button.dataset.paintTool === this.paintTool));
        if (/^#[0-9a-f]{6}$/i.test(project.paintSettings.color || '')) document.getElementById('paintColor').value = project.paintSettings.color;
        document.getElementById('paintSize').value = project.paintSettings.size || 10;
        document.getElementById('paintSizeValue').textContent = document.getElementById('paintSize').value;
        document.getElementById('paintOpacity').value = project.paintSettings.opacity || 100;
        document.getElementById('paintOpacityValue').textContent = document.getElementById('paintOpacity').value + '%';
        this.setPaintRotation(this.safeNumber(project.paintSettings.rotation, 0));
        this.setPaintBoardOnly(project.paintSettings.boardOnly === true);
        this.setPaintToolbarCollapsed(project.paintSettings.toolbarCollapsed === true);
      }
      document.body.classList.toggle('focus-mode', project.uiState?.focusMode === true);
      document.getElementById('filterBox').classList.toggle('open', project.uiState?.filterOpen === true);
      document.querySelector('#filterToggle span:first-child').textContent = project.uiState?.filterOpen === true
        ? '🎨 图片滤镜（点击收起）' : '🎨 图片滤镜（点击展开）';
      document.getElementById('layerBox').classList.remove('open');
      document.getElementById('layerBoxHeader')?.setAttribute('aria-expanded', 'false');

      this.activeTextLayerId = this.textLayers.some(layer => layer.id === project.activeTextLayerId)
        ? project.activeTextLayerId : this.textLayers[0].id;
      this.selectedLayerId = allLayerIds.has(project.selectedLayerId) ? project.selectedLayerId : this.activeTextLayerId;
      this.customImage = this.imageLayers.find(layer => layer.id === this.selectedLayerId) || this.imageLayers[0] || null;
      this.history = this.activeTextLayer().history;
      this.paintHistory = [];
      this.paintHistoryIndex = -1;
      this.savePaintSnapshot(true);
      this.syncTextLayerControls();
      this.syncActiveImageControls();
      this.renderLayerPanel();
      this.scheduleDraw();
    }

    async restoreProject() {
      try {
        const project = await ProjectStore.load();
        if (!project) return false;
        await this.applyProjectSnapshot(project);
        this.lastSavedAt = project.savedAt || null;
        return true;
      } catch (error) {
        console.warn('无法恢复完整工程，已使用基础设置:', error);
        return false;
      }
    }

    blobToDataURL(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }

    async exportProject() {
      const button = document.getElementById('exportProjectBtn');
      const original = button.textContent;
      button.disabled = true;
      button.textContent = '正在打包…';
      try {
        const project = await this.createProjectSnapshot();
        const portable = {
          ...project,
          customEmotionBlob: project.customEmotionBlob ? await this.blobToDataURL(project.customEmotionBlob) : null,
          drawingBlob: await this.blobToDataURL(project.drawingBlob),
          imageLayers: await Promise.all(project.imageLayers.map(async layer => ({
            ...layer, imageBlob: await this.blobToDataURL(layer.imageBlob)
          }))),
          customFonts: await Promise.all(project.customFonts.map(async font => ({
            ...font, buffer: await this.blobToDataURL(new Blob([font.buffer]))
          })))
        };
        const blob = new Blob([JSON.stringify(portable)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `安安创作工程_${new Date().toISOString().slice(0, 10)}.anan`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        alert('工程导出失败，请重试');
        console.error(error);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    }

    async importProject(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const portable = JSON.parse(await file.text());
        if (portable.kind !== 'anan-studio-project') throw new Error('工程格式不正确');
        const fromDataUrl = async value => value ? await (await fetch(value)).blob() : null;
        const project = {
          ...portable,
          customEmotionBlob: await fromDataUrl(portable.customEmotionBlob),
          drawingBlob: await fromDataUrl(portable.drawingBlob),
          imageLayers: await Promise.all((portable.imageLayers || []).map(async layer => ({
            ...layer, imageBlob: await fromDataUrl(layer.imageBlob)
          }))),
          customFonts: await Promise.all((portable.customFonts || []).map(async font => ({
            ...font, buffer: await (await fromDataUrl(font.buffer)).arrayBuffer()
          })))
        };
        await this.applyProjectSnapshot(project);
        project.savedAt = Date.now();
        await ProjectStore.save(project);
        this.lastSavedAt = project.savedAt;
        this.markProjectClean('工程已导入并保存到当前浏览器');
      } catch (error) {
        alert('导入失败：' + (error.message || '工程文件无效'));
        console.error(error);
      } finally {
        event.target.value = '';
      }
    }

    async saveSettings() {
      const btn = document.getElementById('saveSettingsBtn');
      const status = document.getElementById('projectSaveStatus');
      btn.disabled = true;
      btn.textContent = '正在保存完整工程…';
      status.textContent = '正在整理图层、图片、笔迹和字体…';
      status.className = 'project-save-status';
      try {
        const project = await this.createProjectSnapshot();
        await ProjectStore.save(project);
        const active = this.activeTextLayer();
        StorageManager.save({
          text: active?.text || '', fontFamily: active?.fontFamily || StorageManager.getDefaults().fontFamily,
          fontSize: String(active?.fontSize || 32), fontColor: active?.fontColor || '#2c3e50',
          textAlign: active?.textAlign || 'center', lineHeight: String(active?.lineHeight || 1),
          posY: String(active?.y || 452), emotion: this.currentEmotion,
          filterPreset: this.filter.preset, filterBrightness: this.filter.brightness,
          filterContrast: this.filter.contrast, filterSaturate: this.filter.saturate
        });
        this.lastSavedAt = project.savedAt;
        const time = new Date(project.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.markProjectClean(`已于 ${time} 保存完整工程，下次打开会自动恢复`);
        btn.classList.add('success');
        btn.textContent = '✅ 已保存全部修改';
      } catch (error) {
        console.error('完整工程保存失败:', error);
        this.projectDirty = true;
        status.textContent = error?.name === 'QuotaExceededError'
          ? '保存空间不足，请导出工程备份或移除部分大图片'
          : '保存失败，修改仍保留在当前页面';
        status.className = 'project-save-status dirty';
        btn.classList.add('error', 'unsaved');
        btn.textContent = '❌ 保存失败';
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.classList.remove('success', 'error');
          btn.textContent = '💾 保存修改';
        }, 1600);
      }
    }

    loadSettings() {
      const s = StorageManager.load();

      if (Array.isArray(s.textLayers) && s.textLayers.length) {
        this.textLayers = s.textLayers.slice(0, 30).map((saved, index) => {
          const history = new UndoHistory(50);
          const layer = {
            id: saved.id || 'text-' + (index + 1), type: 'text',
            name: this.getTextLayerName(saved.text), kind: '可编辑文字',
            text: String(saved.text || ''),
            fontFamily: saved.fontFamily || StorageManager.getDefaults().fontFamily,
            fontColor: saved.fontColor || '#2c3e50',
            textAlign: ['left', 'center', 'right'].includes(saved.textAlign) ? saved.textAlign : 'center',
            fontSize: Math.max(8, Number(saved.fontSize) || 32),
            lineHeight: Math.max(1, Number(saved.lineHeight) || 1),
            x: Number(saved.x) || 260, y: Number(saved.y) || 452,
            rotation: Number(saved.rotation) || 0,
            scaleX: Math.max(.04, Number(saved.scaleX) || 1),
            scaleY: Math.max(.04, Number(saved.scaleY) || 1),
            visible: saved.visible !== false, locked: saved.locked === true,
            opacity: Math.max(0, Math.min(1, Number(saved.opacity ?? 1))), history
          };
          history.push(layer.text);
          return layer;
        });
        this.textLayerCounter = this.textLayers.reduce((max, layer) => Math.max(max, Number(layer.id.split('-').pop()) || 0), 0);
      } else {
        const layer = this.textLayers[0];
        Object.assign(layer, {
          text: s.text || '', fontFamily: s.fontFamily || StorageManager.getDefaults().fontFamily,
          fontSize: Number(s.fontSize) || 32, fontColor: s.fontColor || '#2c3e50',
          textAlign: s.textAlign || 'center', lineHeight: Number(s.lineHeight) || 1,
          y: Number(s.posY) || 452
        });
        layer.history.push(layer.text);
      }
      this.activeTextLayerId = this.textLayers.some(layer => layer.id === s.activeTextLayerId) ? s.activeTextLayerId : this.textLayers[0].id;
      this.selectedLayerId = this.activeTextLayerId;
      const allowedOrder = new Set(['base', 'drawing', 'hand', ...this.textLayers.map(layer => layer.id)]);
      const restoredOrder = Array.isArray(s.layerOrder) ? s.layerOrder.filter(id => allowedOrder.has(id)) : [];
      this.layerOrder = [...new Set([...restoredOrder, 'base', ...this.textLayers.map(layer => layer.id), 'drawing', 'hand'])];
      this.syncTextLayerControls();

      const savedPreset = FILTER_PRESETS[s.filterPreset] ? s.filterPreset : 'none';
      const savedBrightness = Number(s.filterBrightness ?? 100);
      const savedContrast = Number(s.filterContrast ?? 100);
      const savedSaturate = Number(s.filterSaturate ?? 100);
      this.filter = { preset: savedPreset, brightness: savedBrightness, contrast: savedContrast, saturate: savedSaturate };
      document.querySelectorAll('.filter-preset-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === savedPreset));
      document.getElementById('filterBrightness').value = savedBrightness;
      document.getElementById('brightnessValue').textContent = savedBrightness;
      document.getElementById('filterContrast').value = savedContrast;
      document.getElementById('contrastValue').textContent = savedContrast;
      document.getElementById('filterSaturate').value = savedSaturate;
      document.getElementById('saturateValue').textContent = savedSaturate;

      if (s.emotion && s.emotion !== '开心.png') {
        this.savedEmotion = s.emotion;
        document.getElementById('emotionSelect').value = s.emotion;
      }
      if (s.coreLayers) {
        Object.entries(s.coreLayers).forEach(([id, value]) => {
          if (!this.layerSettings[id]) return;
          this.layerSettings[id].visible = value.visible !== false;
          this.layerSettings[id].opacity = Math.max(0, Math.min(1, Number(value.opacity ?? 1)));
        });
      }
      return s;
    }

    async executeReset() {
      const defaults = StorageManager.getDefaults();

      document.getElementById('textInput').value   = defaults.text;
      document.getElementById('fontFamily').value   = defaults.fontFamily;
      document.getElementById('fontSize').value     = defaults.fontSize;
      document.getElementById('fontColor').value    = defaults.fontColor;
      document.getElementById('textAlign').value    = defaults.textAlign;
      document.getElementById('lineHeight').value   = defaults.lineHeight;
      document.getElementById('posY').value         = defaults.posY;
      document.getElementById('posYDisplay').textContent = defaults.posY;

      this.filter = { preset: 'none', brightness: 100, contrast: 100, saturate: 100 };
      document.querySelectorAll('.filter-preset-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'none'));
      document.getElementById('filterBrightness').value = 100; document.getElementById('brightnessValue').textContent = 100;
      document.getElementById('filterContrast').value = 100;   document.getElementById('contrastValue').textContent = 100;
      document.getElementById('filterSaturate').value = 100;   document.getElementById('saturateValue').textContent = 100;

      await this.changeEmotion(defaults.emotion);
      document.getElementById('emotionSelect').value = defaults.emotion;
      this.customEmotionImage = null;
      this.customEmotionSourceBlob = null;
      this.customEmotionName = '';
      document.getElementById('emotionSelect').querySelector('option[value="custom_temp"]')?.remove();
      this.customFonts = [];
      document.querySelectorAll('#fontFamily option[data-custom-font="1"]').forEach(option => option.remove());

      this.imageLayers = [];
      const history = new UndoHistory(50);
      history.push(defaults.text);
      this.textLayerCounter = 1;
      this.textLayers = [{
        id: 'text-1', type: 'text', name: '空白文字', kind: '可编辑文字',
        text: defaults.text, fontFamily: defaults.fontFamily, fontColor: defaults.fontColor,
        textAlign: defaults.textAlign, fontSize: Number(defaults.fontSize), lineHeight: Number(defaults.lineHeight),
        x: 260, y: Number(defaults.posY), rotation: 0, scaleX: 1, scaleY: 1,
        visible: true, opacity: 1, locked: false, history
      }];
      this.layerOrder = ['base', 'text-1', 'drawing', 'hand'];
      this.customImage = null;
      this.selectedLayerId = 'text-1';
      this.activeTextLayerId = 'text-1';
      this.history = history;
      Object.values(this.layerSettings).forEach(layer => { layer.visible = true; layer.opacity = 1; });
      this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.paintTool = 'pen';
      document.querySelectorAll('[data-paint-tool]').forEach(button => button.classList.toggle('active', button.dataset.paintTool === 'pen'));
      document.getElementById('paintColor').value = '#e74c3c';
      document.getElementById('paintSize').value = 10;
      document.getElementById('paintSizeValue').textContent = '10';
      document.getElementById('paintOpacity').value = 100;
      document.getElementById('paintOpacityValue').textContent = '100%';
      this.setPaintRotation(0);
      this.setPaintBoardOnly(false);
      this.setPaintToolbarCollapsed(false);
      document.body.classList.remove('focus-mode');
      document.getElementById('filterBox').classList.remove('open');
      document.querySelector('#filterToggle span:first-child').textContent = '🎨 图片滤镜（点击展开）';
      document.getElementById('layerBox').classList.remove('open');
      document.getElementById('layerBoxHeader')?.setAttribute('aria-expanded', 'false');
      this.paintHistory = [];
      this.paintHistoryIndex = -1;
      this.savePaintSnapshot(true);
      this.syncActiveImageControls();
      this.syncTextLayerControls();
      this.renderLayerPanel();

      StorageManager.clear();
      try { await ProjectStore.clear(); } catch (error) { console.warn('清理浏览器工程失败:', error); }
      this.autoResizeTextarea(document.getElementById('textInput'));
      this.updateUndoRedoButtons();
      this.scheduleDraw();
      this.updateFontPreview();
      this.markProjectClean('已清空浏览器中的工程并恢复默认');

      const btn = document.getElementById('resetSettingsBtn');
      this.showButtonFeedback(btn, '✅ 已恢复默认', 'success');
    }

    async downloadImage() {
      const loading = document.getElementById('globalLoading');
      loading.classList.add('show');
      try {
        this.drawCanvas();
        const emotion = this.currentEmotion.replace('.png', '').replace(/[^\w\u4e00-\u9fa5]/g, '_');
        const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('PNG encoding failed');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `[anan.xia.kim]夏目安安_${emotion}_${Date.now()}.png`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        console.error('保存图片失败:', e);
      } finally {
        loading.classList.remove('show');
      }
    }

    async copyToClipboard() {
      const btn = document.getElementById('copyBtn');
      if (!navigator.clipboard || !navigator.clipboard.write) {
        this.showButtonFeedback(btn, '❌ 浏览器不支持', 'error');
        return;
      }
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '复制中...';
      try {
        this.drawCanvas();
        const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('PNG encoding failed');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        this.showButtonFeedback(btn, '✅ 已复制！可直接粘贴', 'success');
      } catch (err) {
        const msg = (err.name === 'NotAllowedError' || err.name === 'SecurityError') ? '❌ 需要权限' : '❌ 复制失败';
        this.showButtonFeedback(btn, msg, 'error');
      } finally {
        btn.disabled = false;
        setTimeout(() => { btn.classList.remove('success', 'error'); btn.textContent = originalText; }, 2500);
      }
    }

    showButtonFeedback(btn, text, cssClass) {
      const original = btn.textContent;
      btn.classList.add(cssClass);
      btn.textContent = text;
      setTimeout(() => { btn.classList.remove(cssClass); btn.textContent = original; }, 2000);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.app = new AnanMemeGenerator();
  });
