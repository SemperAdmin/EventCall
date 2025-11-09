// Simple History API Router for EventCall
// Provides navigation without hash-based URLs, with active state tracking.

(function(){
  function pageToPath(pageId, param) {
    // Get the base path (e.g., '/EventCall/' for GitHub Pages or '/' for local)
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

        history.replaceState(parsed, '', redirectPath);

        // Handle invite pages specially
        if (parsed.pageId === 'invite' && parsed.param) {
          if (window.uiComponents && window.uiComponents.showInvite) {
            window.uiComponents.showInvite(parsed.param);
          }
          if (window.showPageContent) window.showPageContent('invite');
        } else if (parsed.pageId === 'manage' && parsed.param) {
          if (window.eventManager && window.eventManager.showEventManagement) {
            window.eventManager.showEventManagement(parsed.param);
          }
        } else {
          if (window.showPage) window.showPage(parsed.pageId);
        }

        setActiveNav(parsed.pageId);
        return;
      }

      // Check for query parameter with event data (invite links)
      const hasInviteData = location.search && location.search.includes('data=');

      // Translate hash on first load for back-compat
      if (location.hash) {
        const hash = location.hash.replace(/^#/, '');
        const parts = hash.split('/');
        const pageId = parts[0] || 'dashboard';
        const param = parts[1] || '';

        // Handle invite URLs with hash
        if (pageId === 'invite' || hasInviteData) {
          const path = pageToPath('invite', param);
          history.replaceState({ pageId: 'invite', param }, '', path + location.search);
          if (window.showPageContent) window.showPageContent('invite');
          if (param && window.uiComponents && window.uiComponents.showInvite) {
            window.uiComponents.showInvite(param);
          }
        } else {
          const path = pageToPath(pageId, param);
          history.replaceState({ pageId, param }, '', path);
          if (window.showPage) window.showPage(pageId);
        }
      } else if (hasInviteData) {
        // Handle invite data in query parameter without hash
        const parsed = pathToPage(location.pathname);
        const pageId = parsed.pageId === 'dashboard' ? 'invite' : parsed.pageId;
        history.replaceState({ pageId, param: '' }, '', pageToPath(pageId, ''));
        if (window.showPageContent) window.showPageContent('invite');
      } else {
        const parsed = pathToPage(location.pathname);
        history.replaceState(parsed, '', pageToPath(parsed.pageId, parsed.param));
        if (window.showPage) window.showPage(parsed.pageId);
      }
      window.addEventListener('popstate', this.handlePopState.bind(this));
    },

    navigateToPage: function(pageId, param) {
      const path = pageToPath(pageId, param);
      history.pushState({ pageId, param }, '', path);
      if (pageId === 'manage' && param && window.eventManager && typeof window.eventManager.showEventManagement === 'function') {
        window.eventManager.showEventManagement(param);
      } else if (pageId === 'invite' && param && window.uiComponents && typeof window.uiComponents.showInvite === 'function') {
        window.uiComponents.showInvite(param);
        if (window.showPageContent) window.showPageContent('invite');
      } else if (window.showPage) {
        window.showPage(pageId);
      }
      setActiveNav(pageId);
    },

    updateURLForPage: function(pageId) {
      const st = history.state || {};
      if (st.pageId !== pageId) {
        const path = pageToPath(pageId, st.param);
        history.replaceState({ pageId, param: st.param }, '', path);
      }
      setActiveNav(pageId);
    },

    handlePopState: function(event) {
      const st = event.state || pathToPage(location.pathname);
      const pageId = st.pageId || 'dashboard';
      const param = st.param;
      if (pageId === 'manage' && param && window.eventManager && typeof window.eventManager.showEventManagement === 'function') {
        window.eventManager.showEventManagement(param);
        setActiveNav('manage');
        return;
      }
      if (pageId === 'invite' && param && window.uiComponents && typeof window.uiComponents.showInvite === 'function') {
        window.uiComponents.showInvite(param);
        if (window.showPageContent) window.showPageContent('invite');
        return;
      }
      if (window.showPage) window.showPage(pageId);
      setActiveNav(pageId);
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

