
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

// Env configuration
const PORT = process.env.PORT || 10000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = process.env.REPO_OWNER || '';
const REPO_NAME = process.env.REPO_NAME || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const CSRF_SHARED_SECRET = process.env.CSRF_SHARED_SECRET || '';

if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME || !process.env.JWT_SECRET) {
  console.error('Missing required env: GITHUB_TOKEN, REPO_OWNER, REPO_NAME, JWT_SECRET. Exiting.');
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

// Suggested helper function to be placed with other helpers
async function fetchFromGitHub(url) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'EventCall-Backend'
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Failed to read error response.');
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

async function fetchAllFileContents(files, processor) {
  const promises = files.map(async (file) => {
    if (!file.url) {
      console.warn('File object is missing url property, skipping:', file);
      return null;
    }
    const data = await fetchFromGitHub(file.url);
    const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
    return processor ? processor(content) : content;
  });
  // Filter out any nulls from skipped files
  return (await Promise.all(promises)).filter(item => item !== null);
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
app.use(cookieParser());
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
  // Example: Reading JWT from an HttpOnly cookie named 'token'.
  // This requires the cookie-parser middleware to be used by the app.
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
  }

  try {
    // Verify the token using the secret key. This will throw an error if the token is invalid or expired.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // The token payload should contain the user's role, added during login.
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    // Optionally, attach user info to the request object for use in the route handler.
    req.user = { username: decoded.username, role: decoded.role };

    next();
  } catch (error) {
    console.error('Admin check failed:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
    }
    res.status(500).json({ error: 'Server error during authentication.' });
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
    const usersData = await fetchFromGitHub(usersUrl);
    const users = await fetchAllFileContents(usersData, user => {
      delete user.passwordHash;
      return user;
    });
    res.json(users);
  } catch (error) {
    console.error('Failed to fetch all users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/dashboard-data', isAdmin, async (req, res) => {
  try {
    const eventsUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/events`;
    const rsvpsUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/rsvps`;

    const [eventsData, rsvpsData] = await Promise.all([
      fetchFromGitHub(eventsUrl),
      fetchFromGitHub(rsvpsUrl)
    ]);

    const [events, rsvps] = await Promise.all([
      fetchAllFileContents(eventsData),
      fetchAllFileContents(rsvpsData)
    ]);

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

    // Create a JWT
    const token = jwt.sign({ username: safeUser.username, role: safeUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Set the JWT as an HttpOnly cookie
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'strict' });

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

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`EventCall proxy listening on port ${PORT}`);
});
