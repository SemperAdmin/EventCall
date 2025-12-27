
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// =============================================================================
// RATE LIMITING - Brute force protection (no external dependencies)
// =============================================================================
class RateLimiter {
  constructor(windowMs, maxAttempts) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    this.attempts = new Map();

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.attempts) {
      if (now - data.firstAttempt > this.windowMs) {
        this.attempts.delete(key);
      }
    }
  }

  isRateLimited(key) {
    const now = Date.now();
    const data = this.attempts.get(key);

    if (!data) {
      this.attempts.set(key, { count: 1, firstAttempt: now });
      return false;
    }

    // Reset if window has passed
    if (now - data.firstAttempt > this.windowMs) {
      this.attempts.set(key, { count: 1, firstAttempt: now });
      return false;
    }

    // Increment and check
    data.count++;
    if (data.count > this.maxAttempts) {
      return true;
    }

    return false;
  }

  getRemainingTime(key) {
    const data = this.attempts.get(key);
    if (!data) return 0;
    const elapsed = Date.now() - data.firstAttempt;
    return Math.max(0, Math.ceil((this.windowMs - elapsed) / 1000));
  }

  getAttempts(key) {
    const data = this.attempts.get(key);
    return data ? data.count : 0;
  }
}

// Rate limiters for auth endpoints
// Login: 5 attempts per 15 minutes per IP
const loginLimiter = new RateLimiter(15 * 60 * 1000, 5);
// Registration: 3 attempts per hour per IP
const registerLimiter = new RateLimiter(60 * 60 * 1000, 3);

function getClientIP(req) {
  // Support common proxy headers
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

// =============================================================================

// Env configuration
const PORT = process.env.PORT || 10000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = process.env.REPO_OWNER || '';
const REPO_NAME = process.env.REPO_NAME || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const CSRF_SHARED_SECRET = process.env.CSRF_SHARED_SECRET || '';

if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
  console.error('Missing required env: GITHUB_TOKEN, REPO_OWNER, REPO_NAME. Exiting.');
  process.exit(1);
}
if (!ALLOWED_ORIGIN) {
  console.warn('ALLOWED_ORIGIN is not set; requests will be blocked.');
}
if (!CSRF_SHARED_SECRET) {
  console.warn('CSRF_SHARED_SECRET is not set; CSRF validation will fail.');
}

const app = express();

// Helper functions for GitHub API interactions
async function getUserFromGitHub(username) {
  const userUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/users/${username}.json`;
  const response = await fetch(userUrl, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'EventCall-Backend'
    }
  });

  if (!response.ok) {
    return null;
  }

  const userData = await response.json();
  return JSON.parse(Buffer.from(userData.content, 'base64').toString('utf-8'));
}

async function saveUserToGitHub(username, userData) {
  const createUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/users/${username}.json`;
  const response = await fetch(createUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'EventCall-Backend'
    },
    body: JSON.stringify({
      message: `Register user: ${username}`,
      content: Buffer.from(JSON.stringify(userData, null, 2)).toString('base64')
    })
  });

  return response;
}

// Configure Helmet with an explicit CSP including frame-ancestors.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://www.google.com', 'https://www.gstatic.com', "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:', 'https://www.google.com', 'https://www.gstatic.com', 'https://dns.google'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      // Enable upgrade-insecure-requests directive
      upgradeInsecureRequests: [],
      // Ensure the app cannot be embedded in iframes
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '256kb' }));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin === ALLOWED_ORIGIN) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
}));

function isOriginAllowed(req) {
  const origin = req.headers.origin;
  // Allow non-browser clients (no Origin) like curl and server-to-server
  if (!origin) return true;
  if (origin !== ALLOWED_ORIGIN) return false;
  // If referer exists, it must be consistent; otherwise allow
  const referer = req.headers.referer;
  return !referer || referer.startsWith(ALLOWED_ORIGIN);
}

function hmacToken(clientId, expiresMs) {
  const msg = `${clientId}:${expiresMs}`;
  return crypto.createHmac('sha256', CSRF_SHARED_SECRET).update(msg).digest('base64');
}

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
async function isAdmin(req, res, next) {
  const username = req.headers['x-username'];
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await getUserFromGitHub(username);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch (error) {
    console.error('Admin check failed:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
// Issue a short-lived CSRF token for the client
app.get('/api/csrf', (req, res) => {
  if (!isOriginAllowed(req)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  const clientId = crypto.randomUUID();
  const ttlMs = 15 * 60 * 1000; // 15 minutes
  const expires = Date.now() + ttlMs;
  const token = hmacToken(clientId, expires);
  res.json({ clientId, token, expires });
});

// Proxy the workflow dispatch to GitHub, validating CSRF headers
app.post('/api/dispatch', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    const clientId = req.headers['x-csrf-client'];
    const token = req.headers['x-csrf-token'];
    const expiresHeader = req.headers['x-csrf-expires'];
    const expires = Number(expiresHeader);

    if (!clientId || !token || !expires || Number.isNaN(expires)) {
      return res.status(400).json({ error: 'Missing CSRF headers' });
    }
    if (Date.now() > expires) {
      return res.status(403).json({ error: 'CSRF token expired' });
    }
    const expected = hmacToken(clientId, expires);
    if (!constantTimeEqual(expected, token)) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    const { event_type, client_payload } = req.body || {};
    if (!event_type || typeof event_type !== 'string') {
      return res.status(400).json({ error: 'Invalid event_type' });
    }

    const dispatchUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`;
    const ghResp = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'EventCall-Proxy'
      },
      body: JSON.stringify({ event_type, client_payload })
    });

    if (!ghResp.ok) {
      let err = 'GitHub dispatch failed';
      try {
        const data = await ghResp.json();
        err = data.message || err;
      } catch (_) {}
      return res.status(ghResp.status).json({ error: err });
    }
    return res.json({ success: true });
  } catch (e) {
    console.error('Dispatch proxy error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const usersUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/users`;
    const response = await fetch(usersUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'EventCall-Backend'
      }
    });
    const usersData = await response.json();
    const userPromises = usersData.map(async file => {
      const userResponse = await fetch(file.url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'EventCall-Backend'
        }
      });
      const userData = await userResponse.json();
      const user = JSON.parse(Buffer.from(userData.content, 'base64').toString('utf-8'));
      delete user.passwordHash;
      return user;
    });
    const users = await Promise.all(userPromises);
    res.json(users);
  } catch (error) {
    console.error('Failed to fetch all users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/dashboard-data', isAdmin, async (req, res) => {
  try {
    // Fetch all events
    const eventsUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/events`;
    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'EventCall-Backend'
      }
    });
    const eventsData = await eventsResponse.json();
    const eventPromises = eventsData.map(async file => {
      const eventResponse = await fetch(file.url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'EventCall-Backend'
        }
      });
      const eventData = await eventResponse.json();
      return JSON.parse(Buffer.from(eventData.content, 'base64').toString('utf-8'));
    });
    const events = await Promise.all(eventPromises);

    // Fetch all RSVPs
    const rsvpsUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/rsvps`;
    const rsvpsResponse = await fetch(rsvpsUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'EventCall-Backend'
      }
    });
    const rsvpsData = await rsvpsResponse.json();
    const rsvpPromises = rsvpsData.map(async file => {
      const rsvpResponse = await fetch(file.url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'EventCall-Backend'
        }
      });
      const rsvpData = await rsvpResponse.json();
      return JSON.parse(Buffer.from(rsvpData.content, 'base64').toString('utf-8'));
    });
    const rsvps = await Promise.all(rsvpPromises);

    res.json({ events, rsvps });
  } catch (error) {
    console.error('Failed to fetch admin dashboard data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PERFORMANCE: Direct authentication endpoint (bypasses GitHub Actions)
// Reduces login time from 67s to 200-500ms (99% faster!)
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    // SECURITY: Rate limiting to prevent brute force attacks
    const clientIP = getClientIP(req);
    if (loginLimiter.isRateLimited(clientIP)) {
      const retryAfter = loginLimiter.getRemainingTime(clientIP);
      console.warn(`[SECURITY] Rate limit exceeded for IP: ${clientIP}`);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
        retryAfter
      });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    // SECURITY: Validate username format to prevent path traversal
    const isValidUsername = /^[a-z0-9._-]{3,50}$/.test(username);
    if (!isValidUsername) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    // SECURITY: Enforce reasonable password length limit (DoS prevention)
    if (password.length > 128) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Load user from EventCall-Data repo
    const user = await getUserFromGitHub(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify password with bcrypt
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Return user data (without password hash)
    const { passwordHash, ...safeUser } = user;
    res.json({
      success: true,
      user: safeUser,
      userId: safeUser.id,
      username: safeUser.username,
      action: 'login_user',
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PERFORMANCE: Direct registration endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    // SECURITY: Rate limiting to prevent registration abuse
    const clientIP = getClientIP(req);
    if (registerLimiter.isRateLimited(clientIP)) {
      const retryAfter = registerLimiter.getRemainingTime(clientIP);
      console.warn(`[SECURITY] Registration rate limit exceeded for IP: ${clientIP}`);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many registration attempts. Please try again later.',
        retryAfter
      });
    }

    const { username, password, name, email, branch, rank } = req.body;

    // Validation
    if (!username || !password || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // SECURITY: Validate username format to prevent path traversal
    const isValidUsername = /^[a-z0-9._-]{3,50}$/.test(username);
    if (!isValidUsername) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    // SECURITY: Enforce reasonable password length limit (DoS prevention)
    if (password.length > 128) {
      return res.status(400).json({ error: 'Invalid password length' });
    }

    // Check if user exists
    const existingUser = await getUserFromGitHub(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user object
    const user = {
      id: `user_${username}`,
      username,
      name,
      email: email.toLowerCase(),
      branch: branch || '',
      rank: rank || '',
      role: 'user',
      passwordHash,
      created: new Date().toISOString()
    };

    // Save to GitHub
    const createResp = await saveUserToGitHub(username, user);

    if (!createResp.ok) {
      const error = await createResp.json();
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create user'
      });
    }

    // Return success (without password hash)
    const { passwordHash: _, ...safeUser } = user;
    res.json({
      success: true,
      user: safeUser,
      userId: safeUser.id,
      username: safeUser.username,
      action: 'register_user',
      message: 'Registration successful'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// =============================================================================
// PASSWORD RESET ENDPOINTS
// =============================================================================

// Rate limiter for password reset requests (3 per hour per IP)
const resetLimiter = new RateLimiter(60 * 60 * 1000, 3);

// In-memory store for reset tokens (in production, use Redis or database)
const resetTokens = new Map();

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of resetTokens) {
    if (now > data.expires) {
      resetTokens.delete(token);
    }
  }
}, 5 * 60 * 1000);

// Request password reset
app.post('/api/auth/request-reset', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    const clientIP = getClientIP(req);
    if (resetLimiter.isRateLimited(clientIP)) {
      const retryAfter = resetLimiter.getRemainingTime(clientIP);
      return res.status(429).json({
        error: 'Too many reset requests. Please try again later.',
        retryAfter
      });
    }

    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    // Validate username format - but don't return early to avoid timing attacks
    const isValidUsername = /^[a-z0-9._-]{3,50}$/.test(username.toLowerCase());

    // Try to fetch user from EventCall-Data repository
    // Even if username format is invalid, we proceed to maintain consistent timing
    let user = null;
    if (isValidUsername) {
      const userPath = `users/${username.toLowerCase()}.json`;
      const userUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/${userPath}`;

      try {
        const userResp = await fetch(userUrl, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (userResp.ok) {
          const fileData = await userResp.json();
          user = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
        }
      } catch (err) {
        console.log(`[RESET] Error fetching user: ${err.message}`);
      }
    }

    // Add artificial delay to prevent timing attacks (100-300ms random)
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Verify user exists and email matches (case-insensitive)
    if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
      // User doesn't exist or email mismatch - don't reveal which
      console.log(`[RESET] Reset request failed for: ${username}`);
      return res.json({ success: true, message: 'If an account exists, a reset link will be sent.' });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (60 * 60 * 1000); // 1 hour

    // Store token
    resetTokens.set(resetToken, {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      expires,
      fileSha: fileData.sha
    });

    // In production, send email with reset link
    // For now, we'll trigger a GitHub Action workflow to send the email
    const resetUrl = `${req.headers.origin || ALLOWED_ORIGIN}?reset=${resetToken}`;

    // Try to trigger email workflow (if configured)
    try {
      const workflowResp = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event_type: 'password_reset',
            client_payload: {
              email: user.email,
              name: user.name,
              resetUrl,
              expiresIn: '1 hour'
            }
          })
        }
      );

      if (workflowResp.ok) {
        console.log(`[RESET] Email workflow triggered for: ${username}`);
      }
    } catch (emailError) {
      console.warn('[RESET] Failed to trigger email workflow:', emailError.message);
    }

    console.log(`[RESET] Token generated for user: ${username}`);
    res.json({
      success: true,
      message: 'If an account exists, a reset link will be sent.',
      // Include token in development for testing (remove in production)
      ...(process.env.NODE_ENV !== 'production' && { _devToken: resetToken })
    });

  } catch (error) {
    console.error('Reset request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find and validate token
    const tokenData = resetTokens.get(token);
    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (Date.now() > tokenData.expires) {
      resetTokens.delete(token);
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Fetch current user data
    const userPath = `users/${tokenData.username}.json`;
    const userUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/${userPath}`;

    const userResp = await fetch(userUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!userResp.ok) {
      return res.status(400).json({ error: 'User not found' });
    }

    const fileData = await userResp.json();
    const user = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user with new password
    const updatedUser = {
      ...user,
      passwordHash,
      passwordResetAt: new Date().toISOString()
    };

    // Save updated user
    const updateResp = await fetch(userUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Reset password for ${tokenData.username}`,
        content: Buffer.from(JSON.stringify(updatedUser, null, 2)).toString('base64'),
        sha: fileData.sha
      })
    });

    if (!updateResp.ok) {
      const error = await updateResp.json();
      return res.status(500).json({ error: error.message || 'Failed to update password' });
    }

    // Invalidate the token
    resetTokens.delete(token);

    console.log(`[RESET] Password reset successful for: ${tokenData.username}`);
    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in.'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`EventCall proxy listening on port ${PORT}`);
});
