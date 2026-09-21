(function() {
    const BUILD_VERSION = window.ANAN_BUILD_VERSION || '20260818-1';
    const BUILD_KEY = 'ananLoadedBuild';
    const storageGet = (key) => {
      try { return localStorage.getItem(key); } catch (error) { return null; }
    };
    const storageSet = (key, value) => {
      try { localStorage.setItem(key, value); } catch (error) {}
    };

    const previousBuild = storageGet(BUILD_KEY);
    if (previousBuild !== BUILD_VERSION) {
      storageSet(BUILD_KEY, BUILD_VERSION);
      if ('caches' in window) {
        caches.keys().then(keys => Promise.all(
          keys.filter(key => key.toLowerCase().includes('anan')).map(key => caches.delete(key))
        )).catch(() => {});
      }
    }

    fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(info => {
        if (!info?.build || info.build === BUILD_VERSION) return;
        const url = new URL(location.href);
        if (url.searchParams.get('_v') === info.build) return;
        url.searchParams.set('_v', info.build);
        location.replace(url.toString());
      })
      .catch(() => {});

    const DISMISSED_KEY = 'ananInstallDismissed';
    const banner = document.getElementById('installBanner');
    const installBtn = document.getElementById('installBtn');
    const dismissBtn = document.getElementById('installDismiss');
    const iosModal = document.getElementById('iosInstallModal');
    const iosClose = document.getElementById('iosInstallClose');
    let deferredPrompt = null;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;

    if (isStandalone || storageGet(DISMISSED_KEY)) return;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setTimeout(() => banner.classList.add('show'), 3000);
    });

    if (isIOS && !isStandalone) {
      setTimeout(() => banner.classList.add('show'), 3000);
    }

    installBtn.addEventListener('click', async () => {
      if (isIOS) {
        banner.classList.remove('show');
        iosModal.classList.add('show');
        return;
      }
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        banner.classList.remove('show');
        if (outcome === 'accepted') storageSet(DISMISSED_KEY, '1');
      }
    });

    dismissBtn.addEventListener('click', () => {
      banner.classList.remove('show');
      storageSet(DISMISSED_KEY, '1');
    });

    iosClose.addEventListener('click', () => {
      iosModal.classList.remove('show');
      storageSet(DISMISSED_KEY, '1');
    });
    iosModal.addEventListener('click', (e) => {
      if (e.target === iosModal) {
        iosModal.classList.remove('show');
        storageSet(DISMISSED_KEY, '1');
      }
    });
  })();
