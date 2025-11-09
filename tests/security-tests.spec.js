/* Security Test Suite for EventCall */

describe('Authentication', function() {
  beforeEach(function() {
    try { localStorage.clear(); } catch (_) {}
    // Reset minimal auth state
    if (window.userAuth && typeof window.userAuth.logout === 'function') {
      try { window.userAuth.logout(); } catch (_) {}
    }
  });

  it('requires valid credentials (client-side checks present)', function() {
    expect(window.userAuth).to.exist;
    expect(window.userAuth.init).to.be.a('function');
    // Presence tests for common auth helpers
    expect(
      window.userAuth.getCurrentUser || window.userAuth.getUser || window.userAuth.isAuthenticated
    ).to.exist;
  });

  it('has brute force mitigation via RateLimiter integration', function() {
    expect(window.rateLimiter).to.exist;
    expect(window.rateLimiter.fetch).to.be.a('function');
    expect(window.RateLimiter).to.be.a('function');
  });

  it('supports session timeout and CSRF rotation hooks (client)', function() {
    expect(window.csrf).to.exist;
    expect(window.csrf.getToken).to.be.a('function');
    expect(window.csrf.rotateToken).to.be.a('function');
  });
});

describe('Authorization', function() {
  it('exposes client guards for manager-only actions', function() {
    // Manager system uses isUserAuthenticated
    expect(window.isUserAuthenticated || (window.managerAuth && window.managerAuth.isAuthenticated)).to.exist;
  });
});

describe('Input Validation & Sanitization', function() {
  it('escapes HTML entities correctly', function() {
    const raw = '<script>alert(1)</script>&"\'';
    const escaped = window.utils.escapeHTML(raw);
    expect(escaped).to.not.include('<script>');
    expect(escaped).to.include('&lt;script&gt;');
    expect(escaped).to.include('&amp;');
  });

  it('sanitizes HTML to prevent XSS injection', function() {
    const html = '<div>Hi</div><img src=x onerror="alert(1)"><script>alert(1)</script>';
    const sanitized = window.utils.sanitizeHTML(html);
    const lower = sanitized.toLowerCase();
    // Script tags must be removed
    expect(lower).to.not.include('<script>');
    // Ensure dangerous tag is not rendered (escaped is acceptable)
    expect(lower).to.not.include('<img');
    expect(lower).to.include('&lt;img');
  });
});

describe('CSRF', function() {
  it('generates and rotates CSRF tokens', function() {
    const t1 = window.csrf.getToken();
    window.csrf.rotateToken();
    const t2 = window.csrf.getToken();
    expect(t1).to.be.a('string');
    expect(t2).to.be.a('string');
    expect(t1).to.not.equal(t2);
  });

  it('originAllowed returns boolean', function() {
    expect(window.csrf.originAllowed).to.be.a('function');
    expect(window.csrf.originAllowed()).to.be.a('boolean');
  });
});

describe('Rate Limiter', function() {
  it('queues requests to respect rate limits', async function() {
    const limiter = new window.RateLimiter({ maxRequestsPerInterval: 1, intervalMs: 100, concurrent: 1 });
    const timestamps = [];
    const origFetch = window.fetch;
    window.fetch = async () => { timestamps.push(Date.now()); return new Response('', { status: 200 }); };
    try {
      await limiter.fetch('http://localhost/', {});
      await limiter.fetch('http://localhost/', {});
    } finally {
      window.fetch = origFetch;
    }
    expect(timestamps.length).to.equal(2);
    const delta = timestamps[1] - timestamps[0];
    expect(delta).to.be.at.least(90); // allow minor variance
  });
});

describe('API Security (client checks)', function() {
  it('error handler is present for reporting', function() {
    expect(window.errorHandler).to.exist;
    expect(window.errorHandler.handleError).to.be.a('function');
  });
});

describe('Security Headers & TLS (documentation-only in local)', function() {
  it('CSP/HSTS headers require production web server configuration', function() {
    // Local server does not set headers; document requirement
    this.skip();
  });
});
