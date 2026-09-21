// 字体加载超时保护
    window.fontsReady = Promise.race([
      Promise.all([
        document.fonts.load("16px 'Noto Sans SC'"),
        document.fonts.load("bold 16px 'Noto Sans SC'"),
        document.fonts.load("16px 'Noto Color Emoji'")
      ]).then(function() { return document.fonts.ready; }).catch(function() {}),
      new Promise(function(resolve) { setTimeout(resolve, 1400); })
    ]);
    window._emojiFontCssResolve = function() {};
