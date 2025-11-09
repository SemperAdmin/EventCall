// Simple History API Router for EventCall
// Provides navigation without hash-based URLs, with active state tracking.

(function(){
  function pageToPath(pageId, param) {
    switch(pageId) {
      case 'dashboard': return '/dashboard';
      case 'create': return '/create';
      case 'manage': return param ? `/manage/${param}` : '/manage';
      case 'invite': return param ? `/invite/${param}` : '/invite';
      default: return `/${pageId || ''}`;
    }
  }

  function pathToPage(pathname) {
    const path = String(pathname || '').replace(/^[#/]+/, '');
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
      // Translate hash on first load for back-compat
      if (location.hash) {
        const hash = location.hash.replace(/^#/, '');
        const parts = hash.split('/');
        const pageId = parts[0] || 'dashboard';
        const param = parts[1] || '';
        const path = pageToPath(pageId, param);
        history.replaceState({ pageId, param }, '', path);
        if (window.showPage) window.showPage(pageId);
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
    try { AppRouter.init(); } catch (e) { console.warn('Router init failed:', e); }
  });
})();

