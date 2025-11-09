/* Navigation Test Suite for EventCall (History API Router) */

describe('Navigation Router', function() {
  beforeEach(function() {
    // Minimal DOM for nav and pages
    document.body.innerHTML = `
      <nav class="nav"><button id="nav-dashboard">Dashboard</button><button id="nav-create">Create</button></nav>
      <div id="dashboard" class="page active">D</div>
      <div id="create" class="page">C</div>
    `;
    // Mock showPage/showPageContent used by router
    window.showPageContent = function(pageId) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const target = document.getElementById(pageId);
      if (target) target.classList.add('active');
      document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById(`nav-${pageId}`);
      if (btn) btn.classList.add('active');
    };
    window.showPage = function(pageId) { window.showPageContent(pageId); };
  });

  it('navigates to create and sets active state via pushState', function() {
    expect(window.AppRouter).to.exist;
    window.AppRouter.init();
    window.AppRouter.navigateToPage('create');
    expect(history.state.pageId).to.equal('create');
    expect(document.getElementById('create').classList.contains('active')).to.equal(true);
    expect(document.getElementById('nav-create').classList.contains('active')).to.equal(true);
    expect(document.getElementById('dashboard').classList.contains('active')).to.equal(false);
  });

  it('handles popstate to restore previous page', function() {
    window.AppRouter.init();
    window.AppRouter.navigateToPage('create');
    // Simulate back to dashboard
    history.pushState({ pageId: 'dashboard' }, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate', { state: { pageId: 'dashboard' } }));
    expect(document.getElementById('dashboard').classList.contains('active')).to.equal(true);
    expect(document.getElementById('nav-dashboard').classList.contains('active')).to.equal(true);
  });
});

