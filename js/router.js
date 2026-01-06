// Simple History API Router for EventCall
// Provides navigation without hash-based URLs, with active state tracking.

(function(){
  function isGitHubPagesHost() {
    return window.location.hostname.endsWith('.github.io');
  }

  function pageToPath(pageId, param) {
    // Use hash-based routing on local to avoid asset path issues on refresh
    if (!isGitHubPagesHost()) {
      switch(pageId) {
        case 'dashboard': return '#dashboard';
        case 'create': return '#create';
        case 'manage': return param ? `#manage/${param}` : '#manage';
        case 'invite': return param ? `#invite/${param}` : '#invite';
        default: return `#${pageId || ''}`;
      }
    }

    // GitHub Pages: history-based paths with repo base
    const basePath = (window.getBasePath && window.getBasePath()) || '/';
    const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

    switch(pageId) {
      case 'dashboard': return base + '/dashboard';
      case 'create': return base + '/create';
      case 'manage': return param ? `${base}/manage/${param}` : `${base}/manage`;
      case 'invite': return param ? `${base}/invite/${param}` : `${base}/invite`;
      default: return `${base}/${pageId || ''}`;
    }
  }

  function pathToPage(pathname) {
    // Get the base path and strip it from the pathname
    const basePath = (window.getBasePath && window.getBasePath()) || '/';
    let path = String(pathname || '');

    // Remove the base path if present
    if (basePath !== '/' && path.startsWith(basePath)) {
      path = path.substring(basePath.length);
    }

    // Clean up the path
    path = path.replace(/^[#/]+/, '').replace(/\/$/, '');

    if (!path || path === 'index.html') return { pageId: 'dashboard' };
    const parts = path.split('/');
    const base = parts[0];
    const param = parts[1] || '';
    if (base === 'invite') return { pageId: 'invite', param };
    if (base === 'manage') return { pageId: 'manage', param };
    if (base === 'dashboard') return { pageId: 'dashboard' };
    if (base === 'create') return { pageId: 'create' };
    return { pageId: base, param };
  }

  function setActiveNav(pageId) {
    try {
      document.querySelectorAll('.nav button').forEach(btn => btn.classList.remove('active'));
      const btn = document.getElementById(`nav-${pageId}`);
      if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'page');
      }
    } catch (_) {}
  }

  // Centralized route handler to ensure consistent behavior
  async function handleRoute(pageId, param) {
    console.log('🔄 Routing to:', pageId, param);

    // Wait for app initialization before handling deep links
    if (window.AppInit && !window.AppInit.isReady()) {
      console.log('⏳ Waiting for AppInit before routing...');
      try {
        await window.AppInit.waitForReady();
      } catch (err) {
        console.warn('AppInit wait failed:', err);
      }
    }

    if (pageId === 'manage' && param) {
      // Ensure data is loaded before showing event management
      await ensureDataLoaded(param);

      if (window.eventManager && typeof window.eventManager.showEventManagement === 'function') {
        window.eventManager.showEventManagement(param);
      }
      // Ensure page visibility is toggled - CRITICAL FIX
      if (window.showPageContent) window.showPageContent('manage');
    } else if (pageId === 'invite' && param && window.uiComponents && typeof window.uiComponents.showInvite === 'function') {
      window.uiComponents.showInvite(param);
      if (window.showPageContent) window.showPageContent('invite');
    } else {
      if (window.showPage) window.showPage(pageId);
    }
    setActiveNav(pageId);
  }

  /**
   * Ensure event data is loaded before rendering
   * Implements retry logic with promise queuing
   * @param {string} eventId - Event ID to load
   */
  async function ensureDataLoaded(eventId) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 500;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Check if event is already in cache
      if (window.events && window.events[eventId]) {
        console.log('✅ Event found in cache:', eventId);
        return true;
      }

      // Check if cache is stale and needs refresh
      const cacheStale = window.CacheManager && window.CacheManager.isStale('events');

      if (!window.events || Object.keys(window.events).length === 0 || cacheStale) {
        console.log(`📊 Loading data (attempt ${attempt + 1}/${MAX_RETRIES})...`);

        try {
          // Wait for loadManagerData if it exists
          if (typeof window.loadManagerData === 'function') {
            await window.loadManagerData();
          }
        } catch (err) {
          console.warn('loadManagerData failed:', err);
        }

        // Check again after loading
        if (window.events && window.events[eventId]) {
          return true;
        }
      }

      // Wait before retrying
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }

    console.warn(`⚠️ Event ${eventId} not found after ${MAX_RETRIES} attempts`);
    return false;
  }

  const AppRouter = {
    init: function() {
      // Check for redirected path from 404.html (GitHub Pages SPA routing)
      const redirectPath = sessionStorage.getItem('redirectPath');
      if (redirectPath) {
        console.log('📍 Restored path from 404 redirect:', redirectPath);
        sessionStorage.removeItem('redirectPath');

        // Parse the redirect path
        const url = new URL(redirectPath, window.location.origin);
        const parsed = pathToPage(url.pathname);

        if (isGitHubPagesHost()) {
          history.replaceState(parsed, '', redirectPath);
          handleRoute(parsed.pageId, parsed.param);
        } else {
          // Local dev: reflect redirect in hash
          // This triggers hashchange, which calls handleRoute
          const hashPath = pageToPath(parsed.pageId, parsed.param);
          window.location.replace(hashPath + url.search);
        }
      } else {
        // Normal initialization
        
        // Check for query parameter with event data (invite links)
        const hasInviteData = location.search && location.search.includes('data=');
        
        if (location.hash) {
            // Hash exists, parse it
            const hash = location.hash.replace(/^#/, '');
            const parts = hash.split('/');
            const pageId = parts[0] || 'dashboard';
            const param = parts[1] || '';
            
            // For invite links with hash
            if (pageId === 'invite' || hasInviteData) {
                const path = pageToPath('invite', param);
                if (isGitHubPagesHost()) {
                    history.replaceState({ pageId: 'invite', param }, '', path + location.search);
                } else {
                    window.location.replace(path + location.search);
                }
            }
            handleRoute(pageId, param);
        } else if (hasInviteData) {
             // Query param only
             const parsed = pathToPage(location.pathname);
             const pageId = parsed.pageId === 'dashboard' ? 'invite' : parsed.pageId;
             const p = pageToPath(pageId, '');
             if (isGitHubPagesHost()) {
                 history.replaceState({ pageId, param: '' }, '', p);
                 handleRoute(pageId, '');
             } else {
                 window.location.replace(p + location.search);
             }
        } else {
            // No hash, standard load
            const parsed = pathToPage(location.pathname);
            const p = pageToPath(parsed.pageId, parsed.param);
            
            if (isGitHubPagesHost()) {
                history.replaceState(parsed, '', p);
            } else if (!location.hash && parsed.pageId !== 'dashboard') {
                 // Ensure hash matches if we are deep linking locally without hash?
                 // Usually local deep links are already hash-based.
            }
            handleRoute(parsed.pageId, parsed.param);
        }
      }

      // Set up listeners
      if (isGitHubPagesHost()) {
        window.addEventListener('popstate', this.handlePopState.bind(this));
      } else {
        window.addEventListener('hashchange', () => {
          const hash = location.hash.replace(/^#/, '');
          const parts = hash.split('/');
          const pageId = parts[0] || 'dashboard';
          const param = parts[1] || '';
          handleRoute(pageId, param);
        });
      }
    },

    navigateToPage: function(pageId, param) {
      const path = pageToPath(pageId, param);
      if (isGitHubPagesHost()) {
        history.pushState({ pageId, param }, '', path);
        handleRoute(pageId, param);
      } else {
        window.location.hash = path.replace(/^#/, '');
        // hashchange will trigger handleRoute
      }
    },

    updateURLForPage: function(pageId, param) {
      if (isGitHubPagesHost()) {
        const st = history.state || {};
        if (st.pageId !== pageId) {
          const path = pageToPath(pageId, typeof param !== 'undefined' ? param : st.param);
          history.replaceState({ pageId, param: typeof param !== 'undefined' ? param : st.param }, '', path);
        }
      } else {
        const hashParts = (location.hash || '').replace(/^#/, '').split('/');
        const current = hashParts[0];
        const currentParam = hashParts[1] || '';
        const desiredParam = typeof param !== 'undefined' ? param : currentParam;
        if (current !== pageId || currentParam !== desiredParam) {
          const path = pageToPath(pageId, desiredParam);
          window.location.replace(path);
        }
      }
      setActiveNav(pageId);
    },

    handlePopState: function(event) {
      const st = event.state || pathToPage(location.pathname);
      const pageId = st.pageId || 'dashboard';
      const param = st.param;
      handleRoute(pageId, param);
    }
  };

  window.AppRouter = AppRouter;
  // Auto-init when DOM is ready
  document.addEventListener('DOMContentLoaded', function(){
    // Skip initialization in test mode
    if (window.__TEST_MODE__) {
      console.log('⚠️ Test mode detected - skipping router initialization');
      return;
    }
    try { AppRouter.init(); } catch (e) { console.warn('Router init failed:', e); }
  });
})();
