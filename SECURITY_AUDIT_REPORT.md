# EventCall Security Architecture Audit Report

**Audit Date:** January 6, 2026
**Auditor:** Deep-Dive Security & Architecture Review
**Application:** EventCall - Military Event Management Platform
**Tech Stack:** Vanilla JavaScript (Frontend), Express.js (Backend), GitHub API (Data Persistence)

---

## Executive Summary

EventCall is a well-architected military event management application with several security measures in place. However, this audit identified **4 Critical**, **6 High**, **8 Medium**, and **5 Low** severity issues that require attention. The most pressing concerns involve authentication architecture, IDOR vulnerabilities, and missing rate limiting on guest-facing endpoints.

---

## Severity Table

| ID | Severity | Category | Finding | File/Location |
|----|----------|----------|---------|---------------|
| SEC-001 | **CRITICAL** | Security | GitHub Token Exposed in Client-Side Config | `js/github-api.js:44-59` |
| SEC-002 | **CRITICAL** | Security | IDOR - No Authorization Check on Event Access | `js/github-api.js:288-333` |
| SEC-003 | **CRITICAL** | Security | Missing Rate Limiting on RSVP Submissions | `js/rsvp-handler.js:182-275` |
| SEC-004 | **CRITICAL** | Security | Admin Endpoint Relies on Client-Supplied Header | `server/index.js:191-207` |
| SEC-005 | **HIGH** | Security | Reset Token Stored in Memory (No Persistence) | `server/index.js:532-543` |
| SEC-006 | **HIGH** | Security | Disposable Email Blocklist Too Small | `js/validation.js:19-22` |
| SEC-007 | **HIGH** | Security | CSRF Token Not Validated on RSVP Submit | `js/rsvp-handler.js:310-319` |
| SEC-008 | **HIGH** | Architecture | Single Point of Failure - GitHub API | `js/github-api.js:*` |
| SEC-009 | **HIGH** | Security | Password Reset Token Leaked in Dev Mode | `server/index.js:719` |
| SEC-010 | **HIGH** | Security | X-Username Header Spoofable for Admin Check | `server/index.js:192` |
| ARCH-001 | **MEDIUM** | Architecture | No Database - Git-as-Database Scalability Issues | Architecture Design |
| ARCH-002 | **MEDIUM** | Architecture | In-Memory Rate Limiting Lost on Restart | `server/index.js:11-71` |
| ARCH-003 | **MEDIUM** | Architecture | No Request Signing on GitHub Actions Workflows | `.github/workflows/*` |
| ARCH-004 | **MEDIUM** | Performance | Parallel Promise.all Without Concurrency Limit | `js/github-api.js:288-326` |
| ARCH-005 | **MEDIUM** | Architecture | Session Stored in localStorage (XSS Risk) | `js/user-auth.js:1024-1042` |
| ARCH-006 | **MEDIUM** | Security | No Account Lockout After Failed Attempts | `server/index.js:364-433` |
| ARCH-007 | **MEDIUM** | Architecture | Cache TTL Too Long for Security-Sensitive Data | `js/github-api.js:21-38` |
| ARCH-008 | **MEDIUM** | Security | Invite Links Never Expire | `js/rsvp-handler.js:807-827` |
| UX-001 | **LOW** | UX/UI | No Loading Skeleton for Dashboard | `js/event-manager.js:93-213` |
| UX-002 | **LOW** | UX/UI | Error Messages Expose Technical Details | `js/rsvp-handler.js:571-619` |
| UX-003 | **LOW** | Accessibility | Missing ARIA Live Regions for Toast Notifications | `js/ui-components.js` |
| UX-004 | **LOW** | UX/UI | Form Autosave Not Clearly Indicated | `js/form-ux.js` |
| UX-005 | **LOW** | UX/UI | Mobile Touch Targets Too Small (<48px) | `styles/responsive.css` |

---

## Detailed Findings

### CRITICAL Issues

#### SEC-001: GitHub Token Exposed in Client-Side Config
**Location:** `js/github-api.js:44-59`

The application accesses `window.GITHUB_CONFIG.token` directly from the client-side, making the GitHub Personal Access Token accessible to any JavaScript running on the page (including XSS payloads).

```javascript
// CURRENT - VULNERABLE
getToken() {
    if (window.userAuth && window.userAuth.getGitHubToken) {
        const token = window.userAuth.getGitHubToken();
        if (token) return token;
    }
    if (window.GITHUB_CONFIG && window.GITHUB_CONFIG.token) {
        return window.GITHUB_CONFIG.token;  // Exposed to client!
    }
}
```

**Impact:** Full repository access if token is compromised via XSS or browser extension.

**Recommendation:** All GitHub API calls should be proxied through the backend. The token should never exist in client-side code.

---

#### SEC-002: IDOR - No Authorization Check on Event Access
**Location:** `js/github-api.js:288-333`

Events are filtered client-side by comparing `createdBy` with the current user. An attacker can bypass this by directly calling the GitHub API or modifying the client-side filter.

```javascript
// CURRENT - Client-side authorization only
const matchesUsername = userUsername && (createdBy === userUsername || createdByUsername === userUsername);
const matchesEmail = userEmail && createdBy === userEmail;
if (matchesUsername || matchesEmail) {
    events[event.id] = event;  // No server-side verification!
}
```

**Impact:** Any authenticated user can potentially access all events in the repository.

**Recommendation:** Implement server-side authorization. Events should be namespaced or access-controlled at the repository level.

---

#### SEC-003: Missing Rate Limiting on RSVP Submissions
**Location:** `js/rsvp-handler.js:182-275`

The guest-facing RSVP submission endpoint has no rate limiting. An attacker could spam RSVPs to:
- Fill up storage
- Abuse workflow dispatch quotas
- Create denial of service

```javascript
// CURRENT - No rate limit check before submission
async handleRSVP(e, eventId) {
    // No IP-based or session-based rate limiting
    const submissionResult = await this.submitWithRetry(eventId, rsvpData);
}
```

**Impact:** Abuse of GitHub Actions minutes, storage exhaustion, spam submissions.

**Recommendation:** Add rate limiting to the `/api/dispatch` endpoint for RSVP submissions (e.g., 5 per IP per hour).

---

#### SEC-004: Admin Endpoint Relies on Client-Supplied Header
**Location:** `server/index.js:191-207`

The `isAdmin` middleware trusts the `x-username` header sent by the client without cryptographic verification.

```javascript
// CURRENT - VULNERABLE
async function isAdmin(req, res, next) {
    const username = req.headers['x-username'];  // Attacker can spoof this!
    if (!username) return res.status(401).json({ error: 'Unauthorized' });

    const user = await getUserFromGitHub(username);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}
```

**Impact:** Attacker could set `x-username: semperadmin` header and gain admin access if `semperadmin` is an actual admin user.

**Recommendation:** Implement JWT or session tokens with cryptographic signatures. Never trust client-supplied identity headers.

---

### HIGH Severity Issues

#### SEC-005: Reset Token Stored in Memory Only
**Location:** `server/index.js:532-543`

Password reset tokens are stored in a JavaScript `Map` that is lost on server restart. This creates operational issues and potential security gaps.

```javascript
// CURRENT - Lost on restart
const resetTokens = new Map();
```

**Recommendation:** Use Redis or a persistent store with TTL support for reset tokens.

---

#### SEC-006: Disposable Email Blocklist Too Small
**Location:** `js/validation.js:19-22`

Only 8 disposable email domains are blocked. There are 10,000+ known disposable domains.

```javascript
const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com',
    'temp-mail.org', 'trashmail.com', 'dispostable.com', 'fakeinbox.com'
    // Only 8 domains - easily bypassed!
]);
```

**Recommendation:** Use a comprehensive list (e.g., disposable-email-domains npm package with 30,000+ domains).

---

#### SEC-009: Password Reset Token Leaked in Dev Mode
**Location:** `server/index.js:719`

The reset token is returned in the API response when `NODE_ENV !== 'production'`.

```javascript
// DANGEROUS - Token leaked in development
...(process.env.NODE_ENV !== 'production' && { _devToken: resetToken })
```

**Recommendation:** Remove this entirely or require an explicit `UNSAFE_DEV_MODE=true` flag.

---

### MEDIUM Severity Issues

#### ARCH-002: In-Memory Rate Limiting Lost on Restart
**Location:** `server/index.js:11-71`

Rate limiting uses an in-memory `Map`. On server restart or horizontal scaling, rate limits are reset.

**Recommendation:** Use Redis for distributed rate limiting, or at minimum implement rate limit state persistence.

---

#### ARCH-005: Session Stored in localStorage (XSS Risk)
**Location:** `js/user-auth.js:1024-1042`

User session data is stored in `localStorage`, which is accessible to JavaScript and vulnerable to XSS attacks.

```javascript
saveUserToStorage(user, rememberMe = false) {
    const storageType = rememberMe ? localStorage : sessionStorage;
    storageType.setItem('eventcall_user', JSON.stringify(user));
}
```

**Recommendation:** Use HttpOnly cookies for session tokens managed by the backend.

---

#### ARCH-008: Invite Links Never Expire
**Location:** `js/rsvp-handler.js:807-827`

Event invite URLs contain all event data encoded in base64 and never expire.

```javascript
const encodedData = btoa(JSON.stringify({
    id: event.id,
    title: event.title,
    // ... all event data
}));
return `${baseURL}?data=${encodedData}...`;  // Never expires!
```

**Recommendation:** Add expiration timestamps to invite links and validate server-side.

---

## Code Refactors for Critical Issues

### Fix SEC-004: Secure Admin Authentication

```javascript
// server/index.js - REFACTORED

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is required');
  process.exit(1);
}

// Issue JWT on successful login
app.post('/api/auth/login', async (req, res) => {
  // ... existing validation ...

  if (isValid) {
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ success: true, user: safeUser });
  }
});

// Secure admin middleware using JWT
async function isAdmin(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

---

### Fix SEC-003: Add Rate Limiting to RSVP Submissions

```javascript
// server/index.js - Add new rate limiter

// RSVP submission: 5 per hour per IP
const rsvpLimiter = new RateLimiter(60 * 60 * 1000, 5);

app.post('/api/dispatch', async (req, res) => {
  // ... existing CSRF validation ...

  const { event_type } = req.body;

  // Rate limit RSVP submissions specifically
  if (event_type === 'submit_rsvp') {
    const clientIP = getClientIP(req);
    if (rsvpLimiter.isRateLimited(clientIP)) {
      const retryAfter = rsvpLimiter.getRemainingTime(clientIP);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many RSVP submissions. Please try again later.',
        retryAfter
      });
    }
  }

  // ... rest of dispatch logic ...
});
```

---

### Fix SEC-001: Proxy All GitHub API Calls Through Backend

```javascript
// server/index.js - Add GitHub API proxy

app.get('/api/github/events', isAuthenticated, async (req, res) => {
  try {
    const username = req.user.username;

    const eventsUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/events`;
    const response = await fetch(eventsUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch events' });
    }

    const eventsData = await response.json();

    // Server-side filtering - only return user's events
    const userEvents = await Promise.all(
      eventsData
        .filter(f => f.name.endsWith('.json'))
        .map(async (file) => {
          const fileResp = await fetch(file.url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
          });
          const data = await fileResp.json();
          const event = JSON.parse(Buffer.from(data.content, 'base64').toString());

          // Server-side authorization check
          if (event.createdBy === username) {
            return event;
          }
          return null;
        })
    );

    res.json(userEvents.filter(Boolean));
  } catch (error) {
    console.error('GitHub proxy error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
```

---

## Top 3 Priority Fixes (Next 24 Hours)

### 1. Implement JWT-Based Authentication (SEC-004)
**Why:** The current admin check can be bypassed by spoofing headers. This is the most exploitable vulnerability.

**Action Items:**
- [ ] Add `jsonwebtoken` dependency
- [ ] Generate and set `JWT_SECRET` environment variable
- [ ] Refactor login to issue HttpOnly cookies with JWT
- [ ] Refactor `isAdmin` middleware to verify JWT
- [ ] Remove `x-username` header trust

---

### 2. Add Rate Limiting to RSVP Endpoint (SEC-003)
**Why:** Without rate limiting, attackers can abuse GitHub Actions quotas and spam events with fake RSVPs.

**Action Items:**
- [ ] Add `rsvpLimiter` for guest submissions (5/hour/IP)
- [ ] Add rate limit headers to responses
- [ ] Log rate limit violations for monitoring

---

### 3. Proxy GitHub API Through Backend (SEC-001)
**Why:** The GitHub token in client-side code is the largest attack surface. Any XSS vulnerability gives full repo access.

**Action Items:**
- [ ] Create `/api/github/events` backend endpoint
- [ ] Create `/api/github/rsvps` backend endpoint
- [ ] Remove `window.GITHUB_CONFIG.token` from client
- [ ] Update `github-api.js` to call backend instead of GitHub directly

---

## Security Strengths Noted

The application demonstrates good security practices in several areas:

1. **Password Hashing:** bcrypt with proper salt rounds (10)
2. **Input Sanitization:** DOMPurify for HTML, escapeHTML for output
3. **CSRF Protection:** Double-submit cookie pattern with HMAC validation
4. **CSP Headers:** Strict Content-Security-Policy with frame-ancestors: 'none'
5. **Timing Attack Prevention:** `crypto.timingSafeEqual` for token comparison
6. **Path Traversal Prevention:** Username validation with strict regex
7. **DoS Prevention:** Password length limit (128 chars)
8. **Helmet.js:** Security headers properly configured

---

## Recommendations Summary

| Priority | Action | Effort |
|----------|--------|--------|
| P0 | Implement JWT authentication | 4-6 hours |
| P0 | Add RSVP rate limiting | 1-2 hours |
| P0 | Proxy GitHub API through backend | 6-8 hours |
| P1 | Use Redis for rate limiting & sessions | 4-6 hours |
| P1 | Expand disposable email blocklist | 1 hour |
| P1 | Add invite link expiration | 2-3 hours |
| P2 | Remove dev token leak | 30 minutes |
| P2 | Add loading skeletons | 2-3 hours |
| P2 | Improve error messages | 1-2 hours |

---

*Report Generated: January 6, 2026*
