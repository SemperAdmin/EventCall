
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

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
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => String(s).trim())
  .filter(Boolean)
  .concat(ALLOWED_ORIGIN ? [ALLOWED_ORIGIN] : []);
const CSRF_SHARED_SECRET = process.env.CSRF_SHARED_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const MIGRATION_SECRET = process.env.MIGRATION_SECRET || '';
const MIGRATE_ON_START = String(process.env.MIGRATE_ON_START || '').toLowerCase() === 'true' || process.env.MIGRATE_ON_START === '1';
const MIGRATION_SOURCE_DIR = process.env.MIGRATION_SOURCE_DIR || '';
const IMAGE_BUCKET = process.env.IMAGE_BUCKET || 'event-images';
const SUPABASE_HOST = SUPABASE_URL ? (new URL(SUPABASE_URL)).hostname : '';

if (!USE_SUPABASE && (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME)) {
  console.error('Missing required env for GitHub mode: GITHUB_TOKEN, REPO_OWNER, REPO_NAME. Exiting.');
  process.exit(1);
}
if (!ALLOWED_ORIGIN) {
  console.warn('ALLOWED_ORIGIN is not set; requests will be blocked.');
}
if (!CSRF_SHARED_SECRET) {
  console.warn('CSRF_SHARED_SECRET is not set; CSRF validation will fail.');
}

const app = express();
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

function getMimeTypeFromExt(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'application/octet-stream';
}

async function ensurePublicBucket(bucket) {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  const { data } = await supabase.storage.getBucket(bucket);
  if (data && data.name) return { ok: true };
  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'],
    fileSizeLimit: '10MB'
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

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

async function getUserFromSupabase(username) {
  if (!supabase) return null;
  const uname = String(username || '').toLowerCase();
  let { data, error } = await supabase
    .from('ec_users')
    .select('*')
    .eq('username', uname)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('Supabase getUser error:', error.message);
    return null;
  }
  if (data) return data;
  // Fallback: try original casing if lowercased lookup failed
  const { data: data2, error: error2 } = await supabase
    .from('ec_users')
    .select('*')
    .eq('username', username)
    .limit(1)
    .maybeSingle();
  if (error2) {
    console.error('Supabase getUser fallback error:', error2.message);
    return null;
  }
  return data2 || null;
}

async function saveUserToSupabase(userRow) {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  const { error } = await supabase.from('ec_users').insert([userRow]);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function getUser(username) {
  if (USE_SUPABASE) {
    return await getUserFromSupabase(username);
  }
  return await getUserFromGitHub(username);
}

async function saveUser(username, userData) {
  if (USE_SUPABASE) {
    const row = {
      id: userData.id || undefined,
      username: userData.username,
      name: userData.name,
      email: (userData.email || '').toLowerCase(),
      branch: userData.branch || '',
      rank: userData.rank || '',
      role: userData.role || 'user',
      password_hash: userData.passwordHash
    };
    return await saveUserToSupabase(row);
  }
  return await saveUserToGitHub(username, userData);
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
// CORS configuration with explicit preflight handling
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.some(o => origin === o)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-csrf-client', 'x-csrf-token', 'x-csrf-expires', 'x-username'],
  credentials: true,
  optionsSuccessStatus: 204
}));
app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.some(o => origin === o)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-csrf-client', 'x-csrf-token', 'x-csrf-expires', 'x-username'],
  credentials: true,
  optionsSuccessStatus: 204
}));

function isOriginAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const ok = ALLOWED_ORIGINS.some(o => origin === o || String(origin).startsWith(o));
  if (!ok) return false;
  const referer = req.headers.referer;
  return !referer || ALLOWED_ORIGINS.some(o => String(referer).startsWith(o));
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
  if (MIGRATION_SECRET) {
    const s = req.headers['x-migration-secret'];
    if (s && s === MIGRATION_SECRET) {
      return next();
    }
  }
  const username = req.headers['x-username'];
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await getUser(username);
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
    if (USE_SUPABASE) {
      const { data, error } = await supabase
        .from('ec_users')
        .select('id,username,name,email,branch,rank,role,created_at,last_updated');
      if (error) throw new Error(error.message);
      return res.json(data || []);
    }
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

app.delete('/api/admin/users/:username', isAdmin, async (req, res) => {
  try {
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const uname = String(req.params.username || '').trim().toLowerCase();
    if (!uname) return res.status(400).json({ error: 'Missing username' });
    const { data: userRow, error: uErr } = await supabase.from('ec_users').select('id,username').eq('username', uname).limit(1).maybeSingle();
    if (uErr) return res.status(500).json({ error: uErr.message });
    if (!userRow) return res.status(404).json({ error: 'User not found' });
    const { data: events, error: eErr } = await supabase.from('ec_events').select('id,cover_image_url').eq('created_by', userRow.id);
    if (eErr) return res.status(500).json({ error: eErr.message });
    const eventIds = Array.isArray(events) ? events.map(ev => ev.id).filter(Boolean) : [];
    let rsvpIds = [];
    if (eventIds.length > 0) {
      const { data: rsvps, error: rErr } = await supabase.from('ec_rsvps').select('id,event_id').in('event_id', eventIds);
      if (rErr) return res.status(500).json({ error: rErr.message });
      rsvpIds = Array.isArray(rsvps) ? rsvps.map(r => r.id).filter(Boolean) : [];
      if (rsvpIds.length > 0) {
        const delAns = await supabase.from('ec_rsvp_answers').delete().in('rsvp_id', rsvpIds);
        if (delAns.error) return res.status(500).json({ error: delAns.error.message });
      }
      const delAssign = await supabase.from('ec_seating_assignments').delete().in('event_id', eventIds);
      if (delAssign.error) return res.status(500).json({ error: delAssign.error.message });
      const delTables = await supabase.from('ec_seating_tables').delete().in('event_id', eventIds);
      if (delTables.error) return res.status(500).json({ error: delTables.error.message });
      const delR = await supabase.from('ec_rsvps').delete().in('event_id', eventIds);
      if (delR.error) return res.status(500).json({ error: delR.error.message });
      const delE = await supabase.from('ec_events').delete().in('id', eventIds);
      if (delE.error) return res.status(500).json({ error: delE.error.message });
      for (const ev of events || []) {
        const imgUrl = String(ev.cover_image_url || '').trim();
        if (!imgUrl) continue;
        try {
          const u = new URL(imgUrl);
          if (SUPABASE_HOST && u.hostname === SUPABASE_HOST && u.pathname.startsWith('/storage/v1/object/public/')) {
            const parts = u.pathname.split('/').filter(Boolean);
            const bucket = parts[4];
            const objectPath = parts.slice(5).join('/');
            if (bucket && objectPath) {
              await supabase.storage.from(bucket).remove([objectPath]);
            }
          } else if (GITHUB_TOKEN && u.hostname.includes('raw.githubusercontent.com')) {
            const parts = u.pathname.split('/').filter(Boolean);
            const owner = parts[0];
            const repo = parts[1];
            const pathParts = parts.slice(3);
            const path = pathParts.join('/');
            const infoUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            const infoResp = await fetch(infoUrl, {
              headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
            });
            if (infoResp.ok) {
              const info = await infoResp.json();
              const delResp = await fetch(infoUrl, {
                method: 'DELETE',
                headers: {
                  'Authorization': `token ${GITHUB_TOKEN}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: `Delete cover image for user ${uname}`, sha: info.sha, branch: 'main' })
              });
              await delResp.text();
            }
          } else if (GITHUB_TOKEN && u.hostname === 'api.github.com' && u.pathname.startsWith('/repos/')) {
            const parts = u.pathname.split('/').filter(Boolean);
            const owner = parts[1];
            const repo = parts[2];
            const path = parts.slice(4).join('/');
            const infoUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            const infoResp = await fetch(infoUrl, {
              headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
            });
            if (infoResp.ok) {
              const info = await infoResp.json();
              const delResp = await fetch(infoUrl, {
                method: 'DELETE',
                headers: {
                  'Authorization': `token ${GITHUB_TOKEN}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: `Delete cover image for user ${uname}`, sha: info.sha, branch: 'main' })
              });
              await delResp.text();
            }
          }
        } catch (_) {}
      }
    }
    const delU = await supabase.from('ec_users').delete().eq('id', userRow.id);
    if (delU.error) return res.status(500).json({ error: delU.error.message });
    res.json({ success: true, deletedEvents: eventIds.length, deletedRsvps: rsvpIds.length });
  } catch (e) {
    console.error('Delete user error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const idsParam = String(req.query.ids || '').trim();
    const ids = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    let q = supabase.from('ec_users').select('id,username,name,email');
    if (ids.length > 0) q = q.in('id', ids);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, users: data || [] });
  } catch (e) {
    console.error('List users error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users/by-username/:username', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const uname = String(req.params.username || '').trim().toLowerCase();
    if (!uname) return res.status(400).json({ error: 'Missing username' });
    const { data, error } = await supabase
      .from('ec_users')
      .select('id,username,name,email')
      .eq('username', uname)
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: data });
  } catch (e) {
    console.error('Get user by username error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile fields for a user in ec_users
app.post('/api/users/update-profile', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const b = req.body || {};
    const uname = String(b.username || '').trim().toLowerCase();
    if (!uname) return res.status(400).json({ error: 'Missing username' });
    const updates = {};
    if (b.name !== undefined) updates.name = String(b.name || '').trim();
    if (b.email !== undefined) updates.email = String(b.email || '').trim().toLowerCase();
    if (b.branch !== undefined) updates.branch = String(b.branch || '').trim();
    if (b.rank !== undefined) updates.rank = String(b.rank || '').trim();
    updates.last_updated = new Date().toISOString();
    const { data, error } = await supabase
      .from('ec_users')
      .update(updates)
      .eq('username', uname)
      .select('id,username,name,email,branch,rank,role,created_at,last_updated')
      .limit(1);
    if (error) return res.status(500).json({ error: error.message });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: row });
  } catch (e) {
    console.error('Update profile error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/dashboard-data', isAdmin, async (req, res) => {
  try {
    if (USE_SUPABASE) {
      const { data: events, error: evErr } = await supabase.from('ec_events').select('*');
      if (evErr) throw new Error(evErr.message);
      const { data: rsvps, error: rsErr } = await supabase.from('ec_rsvps').select('*');
      if (rsErr) throw new Error(rsErr.message);
      res.json({ events, rsvps });
      return;
    }
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

app.get('/api/admin/relationships-snapshot', isAdmin, async (req, res) => {
  try {
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const { data: users, error: uErr } = await supabase.from('ec_users').select('id,username,name,email');
    if (uErr) return res.status(500).json({ error: uErr.message });
    const { data: events, error: eErr } = await supabase.from('ec_events').select('id,title,date,time,location,created_by,status,created_at');
    if (eErr) return res.status(500).json({ error: eErr.message });
    const { data: rsvps, error: rErr } = await supabase.from('ec_rsvps').select('id,event_id,name,email,attending,guest_count,created_at');
    if (rErr) return res.status(500).json({ error: rErr.message });
    const userMap = new Map();
    for (const u of users || []) userMap.set(String(u.id), u);
    const eventMap = new Map();
    for (const e of events || []) eventMap.set(String(e.id), e);
    const groups = [];
    for (const u of users || []) {
      const owned = (events || []).filter(ev => String(ev.created_by || '') === String(u.id));
      const evs = [];
      for (const ev of owned) {
        const ers = (rsvps || []).filter(r => String(r.event_id || '') === String(ev.id)).map(r => ({
          id: r.id,
          event_id: r.event_id,
          name: r.name,
          email: r.email,
          attending: !!r.attending,
          guest_count: r.guest_count || 0,
          created_at: r.created_at || null
        }));
        evs.push({
          id: ev.id,
          title: ev.title || '',
          date: ev.date || '',
          time: ev.time || '',
          location: ev.location || '',
          status: ev.status || 'active',
          created_at: ev.created_at || null,
          rsvps: ers
        });
      }
      groups.push({
        user: { id: u.id, username: u.username || '', name: u.name || '', email: u.email || '' },
        events: evs
      });
    }
    const orphanEvents = (events || []).filter(ev => !ev.created_by || !userMap.has(String(ev.created_by))).map(ev => ev.id);
    const orphanRsvps = (rsvps || []).filter(r => !eventMap.has(String(r.event_id))).map(r => r.id);
    const stats = {
      total_users: (users || []).length,
      total_events: (events || []).length,
      total_rsvps: (rsvps || []).length,
      events_without_owner: orphanEvents.length,
      rsvps_without_event: orphanRsvps.length
    };
    res.json({ success: true, stats, groups, issues: { orphan_events: orphanEvents, orphan_rsvps: orphanRsvps } });
  } catch (e) {
    console.error('Relationships snapshot error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});
async function fetchGitHubDirectory(dir) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/${dir}`;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'EventCall-Backend'
  };
  if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) return [];
  const items = await resp.json();
  const out = [];
  for (const file of items) {
    const fr = await fetch(file.url, { headers });
    if (!fr.ok) continue;
    const fd = await fr.json();
    const txt = Buffer.from(fd.content, 'base64').toString('utf-8');
    try { out.push(JSON.parse(txt)); } catch (_) {}
  }
  return out;
}

async function readLocalEvents() {
  try {
    const p = path.resolve(process.cwd(), '..', 'events-index.json');
    const txt = await fs.readFile(p, 'utf-8');
    const data = JSON.parse(txt);
    if (Array.isArray(data)) return data.filter(e => e && typeof e === 'object' && (e.id || e.eventId || e.title));
    return [];
  } catch (_) {
    return [];
  }
}

async function readLocalRSVPs() {
  const out = [];
  try {
    const dir = path.resolve(process.cwd(), '..', 'rsvps');
    const entries = await fs.readdir(dir);
    for (const name of entries) {
      if (!name.endsWith('.json')) continue;
      try {
        const txt = await fs.readFile(path.join(dir, name), 'utf-8');
        const arr = JSON.parse(txt);
        if (Array.isArray(arr)) {
          for (const r of arr) {
            if (r && typeof r === 'object') out.push(r);
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
  return out;
}

async function readSourceDirJSON(dir) {
  const out = [];
  try {
    const entries = await fs.readdir(dir);
    for (const name of entries) {
      if (!name.endsWith('.json')) continue;
      try {
        const txt = await fs.readFile(path.join(dir, name), 'utf-8');
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed)) {
          for (const r of parsed) {
            if (r && typeof r === 'object') out.push(r);
          }
        } else if (parsed && typeof parsed === 'object') {
          out.push(parsed);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return out;
}

async function readSourceData(baseDirRaw) {
  const baseDir = baseDirRaw ? path.resolve(baseDirRaw) : '';
  if (!baseDir) return { events: [], rsvps: [], users: [] };
  let events = [];
  let rsvps = [];
  let users = [];
  try {
    const evIdxPath = path.join(baseDir, 'events-index.json');
    try {
      const txt = await fs.readFile(evIdxPath, 'utf-8');
      const arr = JSON.parse(txt);
      if (Array.isArray(arr)) {
        for (const e of arr) {
          if (e && typeof e === 'object') events.push(e);
        }
      }
    } catch (_) {}
    const evDir = path.join(baseDir, 'events');
    events = events.concat(await readSourceDirJSON(evDir));
  } catch (_) {}
  try {
    const rsDir = path.join(baseDir, 'rsvps');
    rsvps = rsvps.concat(await readSourceDirJSON(rsDir));
  } catch (_) {}
  try {
    const respDir = path.join(baseDir, 'responses');
    rsvps = rsvps.concat(await readSourceDirJSON(respDir));
  } catch (_) {}
  try {
    const usersDir = path.join(baseDir, 'users');
    users = users.concat(await readSourceDirJSON(usersDir));
  } catch (_) {}
  return { events, rsvps, users };
}
function normalizeEvent(e) {
  return {
    legacyId: e.id || e.eventId || '',
    title: String(e.title || '').trim(),
    date: String(e.date || '').trim(),
    time: (function () {
      const s = String(e.time || '').trim();
      if (!s) return '00:00:00';
      if (/^[0-9]{2}:[0-9]{2}$/.test(s)) return s + ':00';
      return s;
    })(),
    location: String(e.location || '').trim(),
    description: String(e.description || '').trim(),
    cover_image_url: e.coverImageUrl || e.coverImage || '',
    status: String(e.status || 'active').trim(),
    created_by_username: (function () {
      const raw = String(e.createdByUsername ?? e.createdBy ?? e.owner ?? '').trim();
      if (!raw) return '';
      if (raw.includes('@')) return '';
      return raw.toLowerCase();
    })(),
    created_by_email: (function () {
      const raw = String(e.createdByEmail ?? e.createdBy ?? '').trim();
      if (!raw) return '';
      if (!raw.includes('@')) return '';
      return raw.toLowerCase();
    })()
  };
}

function normalizeRSVP(r) {
  return {
    eventId: r.eventId || r.event_id || '',
    name: String(r.name || '').trim(),
    email: String(r.email || '').trim().toLowerCase(),
    phone: String(r.phone || '').trim(),
    attending: !!r.attending,
    guest_count: Number(r.guestCount ?? r.guest_count ?? 0),
    reason: String(r.reason || '').trim(),
    rank: String(r.rank || '').trim(),
    unit: String(r.unit || '').trim(),
    branch: String(r.branch || '').trim(),
    dietary_restrictions: Array.isArray(r.dietaryRestrictions ?? r.dietary_restrictions) ? (r.dietaryRestrictions ?? r.dietary_restrictions) : [],
    allergy_details: String(r.allergyDetails ?? r.allergy_details ?? '').trim(),
    custom_answers: typeof (r.customAnswers ?? r.custom_answers) === 'object' && (r.customAnswers ?? r.custom_answers) !== null ? (r.customAnswers ?? r.custom_answers) : {},
    check_in_token: String(r.checkInToken ?? r.check_in_token ?? '').trim(),
    edit_token: String(r.editToken ?? r.edit_token ?? '').trim()
  };
}

async function performMigration() {
  const evGit = REPO_OWNER ? await fetchGitHubDirectory('events') : [];
  const rsGit = REPO_OWNER ? (await fetchGitHubDirectory('rsvps')).concat(await fetchGitHubDirectory('responses')) : [];
  const usGit = REPO_OWNER ? await fetchGitHubDirectory('users') : [];
  const evLocal = await readLocalEvents();
  const rsLocal = await readLocalRSVPs();
  const srcData = MIGRATION_SOURCE_DIR ? await readSourceData(MIGRATION_SOURCE_DIR) : { events: [], rsvps: [], users: [] };
  const eventsSrc = [...evGit, ...evLocal, ...srcData.events];
  const rsvpsSrc = [...rsGit, ...rsLocal, ...srcData.rsvps];
  const usersSrc = [...usGit, ...srcData.users];
  let usersUpserted = 0;
  for (const u of usersSrc) {
    const username = String(u.username || '').toLowerCase();
    if (!username) continue;
    const row = {
      username,
      name: u.name || username,
      email: String(u.email || '').toLowerCase(),
      branch: u.branch || '',
      rank: u.rank || '',
      role: u.role || 'user',
      password_hash: u.passwordHash || u.password_hash || crypto.randomUUID()
    };
    const { error } = await supabase.from('ec_users').upsert([row], { onConflict: 'username' });
    if (!error) usersUpserted++;
  }
  const eventIdMap = new Map();
  let eventsInserted = 0;
  for (const e of eventsSrc) {
    const ne = normalizeEvent(e);
    if (!ne.title || !ne.date || !ne.time) continue;
    let ownerId = null;
    if (ne.created_by_email) {
      const { data: ue } = await supabase.from('ec_users').select('id').eq('email', ne.created_by_email).limit(1).maybeSingle();
      if (ue && ue.id) ownerId = ue.id;
    }
    if (!ownerId && ne.created_by_username) {
      const { data: uu } = await supabase.from('ec_users').select('id').eq('username', ne.created_by_username).limit(1).maybeSingle();
      if (uu && uu.id) ownerId = uu.id;
    }
    const { data, error } = await supabase.from('ec_events').insert([{
      title: ne.title,
      date: ne.date,
      time: ne.time,
      location: ne.location,
      description: ne.description,
      cover_image_url: ne.cover_image_url,
      status: ne.status,
      created_by: ownerId || null
    }]).select().limit(1);
    if (error) continue;
    const row = Array.isArray(data) ? data[0] : data;
    const legacy = ne.legacyId || '';
    if (legacy) eventIdMap.set(legacy, row.id);
    eventsInserted++;
  }
  let rsvpsInserted = 0;
  for (const r of rsvpsSrc) {
    const nr = normalizeRSVP(r);
    let eid = eventIdMap.get(nr.eventId);
    if (!eid) {
      const { data, error } = await supabase.from('ec_events').insert([{
        title: `Legacy Event ${nr.eventId}`,
        date: '1970-01-01',
        time: '00:00',
        location: '',
        description: '',
        cover_image_url: '',
        status: 'active'
      }]).select().limit(1);
      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        eid = row?.id;
        if (eid) eventIdMap.set(nr.eventId, eid);
      }
    }
    if (!eid || !nr.email) continue;
    const { error } = await supabase.from('ec_rsvps').insert([{
      event_id: eid,
      name: nr.name,
      email: nr.email,
      phone: nr.phone,
      attending: nr.attending,
      guest_count: nr.guest_count,
      reason: nr.reason,
      rank: nr.rank,
      unit: nr.unit,
      branch: nr.branch,
      dietary_restrictions: nr.dietary_restrictions,
      allergy_details: nr.allergy_details,
      custom_answers: nr.custom_answers,
      check_in_token: nr.check_in_token,
      edit_token: nr.edit_token
    }]);
    if (!error) rsvpsInserted++;
  }
  let seatingTablesInserted = 0;
  let seatingAssignmentsInserted = 0;
  let rsvpAnswersInserted = 0;
  try {
    const { data: eventsAll } = await supabase.from('ec_events').select('id,seating_chart,custom_questions');
    const qMap = new Map();
    for (const ev of eventsAll || []) {
      const arr = Array.isArray(ev.custom_questions) ? ev.custom_questions : [];
      const map = new Map();
      for (const q of arr) {
        const qid = String(q.id ?? q.key ?? '').trim();
        if (qid) map.set(qid, String(q.label ?? q.text ?? q.title ?? '').trim());
      }
      qMap.set(ev.id, map);
    }
    for (const ev of eventsAll || []) {
      const sc = ev.seating_chart;
      if (!sc || sc.enabled === false) continue;
      await supabase.from('ec_seating_assignments').delete().eq('event_id', ev.id);
      await supabase.from('ec_seating_tables').delete().eq('event_id', ev.id);
      const tables = Array.isArray(sc.tables) ? sc.tables : [];
      for (const t of tables) {
        const ins = await supabase.from('ec_seating_tables').insert([{
          event_id: ev.id,
          table_number: Number(t.tableNumber ?? t.number ?? 0),
          capacity: Number(t.capacity ?? 0),
          vip_table: !!(t.vipTable ?? false)
        }]).select();
        if (!ins.error) seatingTablesInserted += Array.isArray(ins.data) ? ins.data.length : 1;
        const guests = Array.isArray(t.assignedGuests) ? t.assignedGuests : [];
        for (const g of guests) {
          const ridStr = String(g.rsvpId ?? '').trim();
          const rid = /^\d+$/.test(ridStr) ? Number(ridStr) : ridStr;
          const firstTry = await supabase.from('ec_seating_assignments').insert([{
            event_id: ev.id,
            table_number: Number(t.tableNumber ?? t.number ?? 0),
            rsvp_id: rid,
            guest_count: Number(g.guestCount ?? 0),
            assigned_at: g.assignedAt ? new Date(g.assignedAt).toISOString() : new Date().toISOString()
          }]).select();
          if (!firstTry.error) {
            seatingAssignmentsInserted += Array.isArray(firstTry.data) ? firstTry.data.length : 1;
          } else {
            const msg = String(firstTry.error.message || '');
            if (msg.includes('assigned_at') || msg.includes('column') && msg.includes('does not exist')) {
              const retry = await supabase.from('ec_seating_assignments').insert([{
                event_id: ev.id,
                table_number: Number(t.tableNumber ?? t.number ?? 0),
                rsvp_id: rid,
                guest_count: Number(g.guestCount ?? 0)
              }]).select();
              if (!retry.error) seatingAssignmentsInserted += Array.isArray(retry.data) ? retry.data.length : 1;
            }
          }
        }
      }
    }
    const { data: rsvpsAll } = await supabase.from('ec_rsvps').select('id,event_id,custom_answers');
    for (const r of rsvpsAll || []) {
      const ans = r.custom_answers;
      if (!ans || typeof ans !== 'object') continue;
      await supabase.from('ec_rsvp_answers').delete().eq('rsvp_id', r.id);
      const entries = Object.entries(ans);
      for (const [qidRaw, aval] of entries) {
        const qid = String(qidRaw || '').trim();
        if (!qid) continue;
        const evMap = qMap.get(r.event_id) || new Map();
        const qtext = String(evMap.get(qid) || '');
        const val = typeof aval === 'string' ? aval : JSON.stringify(aval);
        const firstAns = await supabase.from('ec_rsvp_answers').insert([{
          rsvp_id: r.id,
          event_id: r.event_id,
          question_id: qid,
          question_text: qtext,
          answer_text: val
        }]).select();
        if (!firstAns.error) {
          rsvpAnswersInserted += Array.isArray(firstAns.data) ? firstAns.data.length : 1;
        } else {
          const msg = String(firstAns.error.message || '');
          // Fallback 1: drop question_text if missing
          if (msg.includes('question_text')) {
            const retry1 = await supabase.from('ec_rsvp_answers').insert([{
              rsvp_id: r.id,
              event_id: r.event_id,
              question_id: qid,
              answer_text: val
            }]).select();
            if (!retry1.error) {
              rsvpAnswersInserted += Array.isArray(retry1.data) ? retry1.data.length : 1;
              continue;
            } else {
              // If answer_text missing too, fall through to minimal insert
              const msg2 = String(retry1.error.message || '');
              if (!msg2.includes('answer_text')) continue;
            }
          }
          // Fallback 2: drop answer_text if missing (store only question metadata)
          if (msg.includes('answer_text')) {
            const retry2 = await supabase.from('ec_rsvp_answers').insert([{
              rsvp_id: r.id,
              event_id: r.event_id,
              question_id: qid,
              question_text: qtext
            }]).select();
            if (!retry2.error) {
              rsvpAnswersInserted += Array.isArray(retry2.data) ? retry2.data.length : 1;
              continue;
            }
          }
          // Fallback 3: minimal insert when unknown columns are missing
          if (msg.includes('column') && msg.includes('does not exist')) {
            const retry3 = await supabase.from('ec_rsvp_answers').insert([{
              rsvp_id: r.id,
              event_id: r.event_id,
              question_id: qid
            }]).select();
            if (!retry3.error) rsvpAnswersInserted += Array.isArray(retry3.data) ? retry3.data.length : 1;
          }
        }
      }
    }
  } catch (_) {}
  return { eventsInserted, rsvpsInserted, usersUpserted, seatingTablesInserted, seatingAssignmentsInserted, rsvpAnswersInserted };
}

app.post('/api/admin/migrate-supabase', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    if (MIGRATION_SECRET) {
      const s = req.headers['x-migration-secret'];
      if (!s || s !== MIGRATION_SECRET) return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await performMigration();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    const { title, date, time, location, description, cover_image_url, created_by, status, allow_guests, requires_meal_choice, custom_questions, event_details, seating_chart } = req.body || {};
    if (!title || !date || !time) return res.status(400).json({ error: 'Missing required fields' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const row = {
      title: String(title).trim(),
      date,
      time,
      location: location || '',
      description: description || '',
      cover_image_url: cover_image_url || '',
      created_by: created_by || null,
      status: status || 'active',
      allow_guests: !!allow_guests,
      requires_meal_choice: !!requires_meal_choice,
      custom_questions: Array.isArray(custom_questions) ? custom_questions : [],
      event_details: typeof event_details === 'object' && event_details !== null ? event_details : {},
      seating_chart: typeof seating_chart === 'object' && seating_chart !== null ? seating_chart : null
    };
    const { data, error } = await supabase.from('ec_events').insert([row]).select().limit(1);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, event: Array.isArray(data) ? data[0] : data });
  } catch (e) {
    console.error('Create event error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const id = req.params.id;
    const b = req.body || {};
    const upd = {};
    if (b.title !== undefined) upd.title = String(b.title || '').trim();
    if (b.date !== undefined) upd.date = b.date;
    if (b.time !== undefined) upd.time = b.time;
    if (b.location !== undefined) upd.location = b.location || '';
    if (b.description !== undefined) upd.description = b.description || '';
    if (b.cover_image_url !== undefined) upd.cover_image_url = b.cover_image_url || '';
    if (b.status !== undefined) upd.status = b.status || 'active';
    if (b.allow_guests !== undefined) upd.allow_guests = !!b.allow_guests;
    if (b.requires_meal_choice !== undefined) upd.requires_meal_choice = !!b.requires_meal_choice;
    if (b.custom_questions !== undefined) upd.custom_questions = Array.isArray(b.custom_questions) ? b.custom_questions : [];
    if (b.event_details !== undefined) upd.event_details = typeof b.event_details === 'object' && b.event_details !== null ? b.event_details : {};
    if (b.seating_chart !== undefined) upd.seating_chart = typeof b.seating_chart === 'object' && b.seating_chart !== null ? b.seating_chart : null;
    if (b.created_by !== undefined) upd.created_by = b.created_by || null;
    if (Object.keys(upd).length === 0) return res.status(400).json({ error: 'No update fields' });
    const { data, error } = await supabase.from('ec_events').update(upd).eq('id', id).select().limit(1);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, event: Array.isArray(data) ? data[0] : data });
  } catch (e) {
    console.error('Update event error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/images/upload', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const b = req.body || {};
    const fileName = String(b.file_name || '').trim();
    const contentBase64 = String(b.content_base64 || '');
    const eventId = b.event_id ? String(b.event_id) : null;
    const tags = Array.isArray(b.tags) ? b.tags.map(t => String(t)) : [];
    const uploaderUsername = String(b.uploader_username || '').trim().toLowerCase();
    const uploaderId = b.uploader_id ? String(b.uploader_id) : null;
    if (!fileName || !contentBase64) return res.status(400).json({ error: 'Missing file data' });
    const lower = fileName.toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    if (!allowed.some(ext => lower.endsWith(ext))) return res.status(400).json({ error: 'Invalid file extension' });
    const bucketEnsure = await ensurePublicBucket(IMAGE_BUCKET);
    if (!bucketEnsure.ok) return res.status(500).json({ error: bucketEnsure.error || 'Failed to ensure bucket' });
    const filePath = `images/${fileName}`;
    const contentType = getMimeTypeFromExt(fileName);
    const fileBuffer = Buffer.from(contentBase64, 'base64');
    const up = await supabase.storage.from(IMAGE_BUCKET).upload(filePath, fileBuffer, { contentType, upsert: true });
    if (up.error) return res.status(500).json({ error: up.error.message || 'Upload failed' });
    const pub = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filePath);
    const url = pub.data && pub.data.publicUrl ? String(pub.data.publicUrl) : null;
    if (!url) return res.status(500).json({ error: 'Upload succeeded but no URL returned' });

    // Insert into ec_event_photos if associated with an event
    if (USE_SUPABASE && eventId) {
      const { error: photoErr } = await supabase.from('ec_event_photos').insert([{
        event_id: eventId,
        url: url,
        storage_path: filePath,
        uploaded_by: uploaderId || null,
        caption: b.caption || ''
      }]);
      if (photoErr) {
        // If table doesn't exist, this might fail, but we shouldn't block the upload response
        // for backward compatibility unless we are strict. 
        // For now log it.
        console.warn('Failed to insert photo record (table might be missing?):', photoErr.message);
      }
    }

    const meta = {
      uploaded_at: new Date().toISOString(),
      uploader_username: uploaderUsername || null,
      uploader_id: uploaderId || null,
      file_name: fileName,
      bucket: IMAGE_BUCKET,
      object_path: filePath
    };
    let supabaseUpdate = { attempted: false, updated: false, verified: false };
    if (USE_SUPABASE && eventId) {
      supabaseUpdate.attempted = true;
      // Fetch existing event_details to merge
      const { data: evRow, error: evErr } = await supabase
        .from('ec_events')
        .select('id, event_details')
        .eq('id', eventId)
        .limit(1)
        .maybeSingle();
      if (evErr) {
        supabaseUpdate.error = evErr.message;
      } else if (evRow && evRow.id) {
        const existingDetails = (evRow.event_details && typeof evRow.event_details === 'object') ? evRow.event_details : {};
        const mergedDetails = {
          ...existingDetails,
          cover_image_meta: meta,
          cover_image_tags: tags
        };
        const { data: upd, error: uErr } = await supabase
          .from('ec_events')
          .update({ cover_image_url: url, event_details: mergedDetails })
          .eq('id', eventId)
          .select('id, cover_image_url, event_details')
          .limit(1);
        if (uErr) {
          supabaseUpdate.error = uErr.message;
        } else {
          const row = Array.isArray(upd) ? upd[0] : upd;
          supabaseUpdate.updated = true;
          supabaseUpdate.verified = !!(row && row.cover_image_url === url);
        }
      } else {
        supabaseUpdate.error = 'Event not found';
      }
    }
    res.json({ success: true, url, metadata: meta, supabase: supabaseUpdate, event_id: eventId });
  } catch (e) {
    console.error('Image upload error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    let q = supabase.from('ec_events').select('*');
    const createdBy = req.query.created_by;
    const status = req.query.status;
    const unassigned = String(req.query.unassigned || '').toLowerCase() === 'true';
    if (createdBy) q = q.eq('created_by', createdBy);
    if (unassigned) q = q.is('created_by', null);
    if (status) q.eq('status', status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, events: data || [] });
  } catch (e) {
    console.error('List events error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const id = req.params.id;
    const { data: ev, error: eLoadErr } = await supabase.from('ec_events').select('id,cover_image_url').eq('id', id).limit(1).maybeSingle();
    if (eLoadErr) return res.status(500).json({ error: eLoadErr.message });
    if (!ev) return res.status(404).json({ error: 'Event not found' });

    // Delete associated photos from storage (ec_event_photos)
    // We must do this before deleting the event because CASCADE will delete the rows
    try {
      const { data: photos } = await supabase.from('ec_event_photos').select('storage_path').eq('event_id', id);
      if (photos && photos.length > 0) {
        const paths = photos.map(p => p.storage_path).filter(Boolean);
        if (paths.length > 0) {
          // Chunk deletion to avoid limits if necessary, though 1000 is usually limit
          await supabase.storage.from(IMAGE_BUCKET).remove(paths);
        }
      }
    } catch (photoDelErr) {
      console.error('Error deleting event photos from storage:', photoDelErr);
      // Continue with event deletion even if storage cleanup fails
    }

    const { data: rsvpsForEvent } = await supabase.from('ec_rsvps').select('id').eq('event_id', id);
    const rsvpIds = Array.isArray(rsvpsForEvent) ? rsvpsForEvent.map(r => r.id).filter(Boolean) : [];
    if (rsvpIds.length > 0) {
      const delAns = await supabase.from('ec_rsvp_answers').delete().in('rsvp_id', rsvpIds);
      if (delAns.error) return res.status(500).json({ error: delAns.error.message });
    }
    const delAssign = await supabase.from('ec_seating_assignments').delete().eq('event_id', id);
    if (delAssign.error) return res.status(500).json({ error: delAssign.error.message });
    const delTables = await supabase.from('ec_seating_tables').delete().eq('event_id', id);
    if (delTables.error) return res.status(500).json({ error: delTables.error.message });
    const delR = await supabase.from('ec_rsvps').delete().eq('event_id', id);
    if (delR.error) return res.status(500).json({ error: delR.error.message });
    const delE = await supabase.from('ec_events').delete().eq('id', id);
    if (delE.error) return res.status(500).json({ error: delE.error.message });
  const imgUrl = String(ev.cover_image_url || '').trim();
  if (imgUrl) {
    try {
      const u = new URL(imgUrl);
      if (SUPABASE_HOST && u.hostname === SUPABASE_HOST && u.pathname.startsWith('/storage/v1/object/public/')) {
        const parts = u.pathname.split('/').filter(Boolean);
        const bucket = parts[4];
        const objectPath = parts.slice(5).join('/');
        if (bucket && objectPath) {
          await supabase.storage.from(bucket).remove([objectPath]);
        }
      } else if (GITHUB_TOKEN && u.hostname.includes('raw.githubusercontent.com')) {
        const parts = u.pathname.split('/').filter(Boolean);
        const owner = parts[0];
        const repo = parts[1];
        const pathParts = parts.slice(3);
        const path = pathParts.join('/');
        const infoUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const infoResp = await fetch(infoUrl, {
          headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (infoResp.ok) {
          const info = await infoResp.json();
          const delResp = await fetch(infoUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: `Delete cover image for event ${id}`, sha: info.sha, branch: 'main' })
          });
          await delResp.text();
        }
      } else if (GITHUB_TOKEN && u.hostname === 'api.github.com' && u.pathname.startsWith('/repos/')) {
        const parts = u.pathname.split('/').filter(Boolean);
        const owner = parts[1];
        const repo = parts[2];
        const path = parts.slice(4).join('/');
        const infoUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
          const infoResp = await fetch(infoUrl, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
          });
          if (infoResp.ok) {
            const info = await infoResp.json();
            const delResp = await fetch(infoUrl, {
              method: 'DELETE',
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ message: `Delete cover image for event ${id}`, sha: info.sha, branch: 'main' })
            });
            await delResp.text();
          }
      }
    } catch (_) {}
  }
    res.json({ success: true });
  } catch (e) {
    console.error('Delete event error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events/:id/photos', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const id = req.params.id;
    const { data: photos, error } = await supabase.from('ec_event_photos').select('*').eq('event_id', id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, photos: photos || [] });
  } catch (e) {
    console.error('List event photos error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/photos/:id', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const id = req.params.id;
    const { data: photo, error: loadErr } = await supabase.from('ec_event_photos').select('id,storage_path').eq('id', id).limit(1).maybeSingle();
    if (loadErr) return res.status(500).json({ error: loadErr.message });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    // Delete from storage
    if (photo.storage_path) {
      await supabase.storage.from(IMAGE_BUCKET).remove([photo.storage_path]);
    }

    const { error: delErr } = await supabase.from('ec_event_photos').delete().eq('id', id);
    if (delErr) return res.status(500).json({ error: delErr.message });

    res.json({ success: true });
  } catch (e) {
    console.error('Delete photo error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/rsvps', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    const body = req.body || {};
    if (!body.event_id && body.eventId) body.event_id = body.eventId;
    if (!body.email || !body.event_id) return res.status(400).json({ error: 'Missing required fields' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const row = {
      event_id: body.event_id,
      name: body.name || '',
      email: String(body.email || '').toLowerCase(),
      phone: body.phone || '',
      attending: !!body.attending,
      guest_count: Number(body.guest_count ?? body.guestCount ?? 0),
      reason: body.reason || '',
      rank: body.rank || '',
      unit: body.unit || '',
      branch: body.branch || '',
      dietary_restrictions: body.dietary_restrictions ?? body.dietaryRestrictions ?? [],
      allergy_details: body.allergy_details ?? body.allergyDetails ?? '',
      custom_answers: body.custom_answers ?? body.customAnswers ?? {},
      check_in_token: body.check_in_token ?? body.checkInToken ?? '',
      edit_token: body.edit_token ?? body.editToken ?? ''
    };
    const { data, error } = await supabase.from('ec_rsvps').insert([row]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, rsvp: Array.isArray(data) ? data[0] : data });
  } catch (e) {
    console.error('Submit RSVP error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rsvps', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const eventId = req.query.event_id;
    const eventIds = req.query.event_ids ? String(req.query.event_ids).split(',').map(s => s.trim()).filter(s => s) : null;
    let q = supabase.from('ec_rsvps').select('*');
    if (eventIds && eventIds.length > 0) {
      q = q.in('event_id', eventIds);
    } else if (eventId) {
      q = q.eq('event_id', eventId);
    }
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, rsvps: data || [] });
  } catch (e) {
    console.error('List RSVPs error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/duplicates', isAdmin, async (req, res) => {
  try {
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const { data: events, error: eErr } = await supabase.from('ec_events').select('id,title,date,time,location,created_at');
    if (eErr) return res.status(500).json({ error: eErr.message });
    const map = new Map();
    for (const ev of events || []) {
      const k = `${String(ev.title || '').trim().toLowerCase()}|${String(ev.date || '')}|${String(ev.time || '')}|${String(ev.location || '').trim().toLowerCase()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    }
    const eventGroups = [];
    for (const [key, arr] of map.entries()) {
      if ((arr || []).length > 1) {
        eventGroups.push({
          key,
          count: arr.length,
          ids: arr.map(a => a.id),
          sample: { title: arr[0].title, date: arr[0].date, time: arr[0].time, location: arr[0].location },
          created: arr.map(a => a.created_at || null)
        });
      }
    }
    eventGroups.sort((a, b) => b.count - a.count);
    const { data: rsvps, error: rErr } = await supabase.from('ec_rsvps').select('id,event_id,email');
    if (rErr) return res.status(500).json({ error: rErr.message });
    const rmap = new Map();
    for (const r of rsvps || []) {
      const k = `${String(r.event_id)}|${String(r.email || '').trim().toLowerCase()}`;
      if (!rmap.has(k)) rmap.set(k, []);
      rmap.get(k).push(r);
    }
    const rsvpGroups = [];
    for (const [key, arr] of rmap.entries()) {
      if ((arr || []).length > 1) {
        rsvpGroups.push({
          key,
          count: arr.length,
          ids: arr.map(a => a.id),
          event_id: arr[0].event_id,
          email: arr[0].email
        });
      }
    }
    rsvpGroups.sort((a, b) => b.count - a.count);
    res.json({ success: true, events: eventGroups, rsvps: rsvpGroups });
  } catch (e) {
    console.error('Duplicates report error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/apply-baseline', isAdmin, async (req, res) => {
  try {
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const payload = req.body || {};
    const purgeAll = !!payload.purge_all;
    const purgeUsers = !!payload.purge_users;
    const purgeEvents = purgeAll || !!payload.purge_events;
    const purgeRsvps = purgeAll || !!payload.purge_rsvps;
    function arr(v) { return Array.isArray(v) ? v : []; }
    function isUUID(v) {
      const s = String(v || '').trim();
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
    }
    const usersIn = arr(payload.users);
    const eventsIn = arr(payload.events);
    const rsvpsIn = arr(payload.rsvps);
    const groupsIn = arr(payload.groups).concat(arr(payload.users_with_events));
    const errors = { users: [], events: [], rsvps: [] };
    const users = [];
    const events = [];
    const rsvps = [];
    for (const g of groupsIn) {
      const uRaw = g.user || g;
      const uid = String(uRaw.id ?? uRaw.userUuid ?? uRaw.user_id ?? '').trim();
      const uname = String(uRaw.username ?? '').trim();
      const nm = String(uRaw.name ?? '').trim();
      const em = String(uRaw.email ?? '').trim().toLowerCase();
      users.push({ id: uid, username: uname, name: nm, email: em });
      const evs = arr(g.events);
      for (const ev of evs) {
        const eid = String(ev.id ?? ev.eventId ?? '').trim();
        const createdBy = String(ev.created_by ?? ev.createdByUserId ?? ev.createdBy ?? ev.owner ?? '').trim();
        const title = String(ev.title ?? '').trim();
        const date = String(ev.date ?? '').trim();
        const time = String(ev.time ?? '').trim();
        const location = String(ev.location ?? '').trim();
        const description = String(ev.description ?? '').trim();
        const cover = String(ev.coverImage ?? ev.cover_image_url ?? '').trim();
        const status = String(ev.status ?? 'active').trim();
        const allowGuests = !!ev.allowGuests;
        const requiresMealChoice = !!ev.requiresMealChoice;
        const customQuestions = Array.isArray(ev.customQuestions) ? ev.customQuestions : (Array.isArray(ev.custom_questions) ? ev.custom_questions : []);
        const eventDetails = typeof ev.eventDetails === 'object' && ev.eventDetails ? ev.eventDetails : (typeof ev.event_details === 'object' && ev.event_details ? ev.event_details : {});
        const seatingChart = ev.seatingChart ?? ev.seating_chart ?? null;
        const createdAt = ev.created_at ?? ev.created ?? null;
        events.push({
          id: eid,
          created_by: createdBy || uid,
          title,
          date,
          time,
          location,
          description,
          cover_image_url: cover,
          status,
          allow_guests: allowGuests,
          requires_meal_choice: requiresMealChoice,
          custom_questions: customQuestions,
          event_details: eventDetails,
          seating_chart: seatingChart,
          created_at: createdAt
        });
        const rs = arr(ev.rsvps);
        for (const r of rs) {
          const rid = r.id ?? r.rsvpId;
          const name = String(r.name ?? '').trim();
          const email = String(r.email ?? '').trim().toLowerCase();
          const phone = String(r.phone ?? '').trim();
          const attending = !!r.attending;
          const guestCount = Number(r.guest_count ?? r.guestCount ?? 0);
          const reason = String(r.reason ?? '').trim();
          const rank = String(r.rank ?? '').trim();
          const unit = String(r.unit ?? '').trim();
          const branch = String(r.branch ?? '').trim();
          const dietary = String(r.dietary_restrictions ?? '').trim();
          const allergy = String(r.allergy_details ?? '').trim();
          const customAnswers = typeof r.custom_answers === 'object' && r.custom_answers ? r.custom_answers : (typeof r.customAnswers === 'object' && r.customAnswers ? r.customAnswers : {});
          const createdR = r.created_at ?? r.timestamp ?? null;
          rsvps.push({
            id: rid,
            event_id: eid,
            name,
            email,
            phone,
            attending,
            guest_count: guestCount,
            reason,
            rank,
            unit,
            branch,
            dietary_restrictions: dietary,
            allergy_details: allergy,
            custom_answers: customAnswers,
            created_at: createdR
          });
        }
      }
    }
    for (const u of usersIn) {
      const uid = String(u.id ?? u.userUuid ?? '').trim();
      const uname = String(u.username ?? '').trim();
      const nm = String(u.name ?? '').trim();
      const em = String(u.email ?? '').trim().toLowerCase();
      users.push({ id: uid, username: uname, name: nm, email: em });
    }
    for (const ev of eventsIn) {
      const eid = String(ev.id ?? ev.eventId ?? '').trim();
      const owner = String(ev.created_by ?? ev.createdByUserId ?? ev.createdBy ?? ev.owner ?? '').trim();
      const title = String(ev.title ?? '').trim();
      const date = String(ev.date ?? '').trim();
      const time = String(ev.time ?? '').trim();
      const location = String(ev.location ?? '').trim();
      const description = String(ev.description ?? '').trim();
      const cover = String(ev.coverImage ?? ev.cover_image_url ?? '').trim();
      const status = String(ev.status ?? 'active').trim();
      const allowGuests = !!ev.allowGuests;
      const requiresMealChoice = !!ev.requiresMealChoice;
      const customQuestions = Array.isArray(ev.customQuestions) ? ev.customQuestions : (Array.isArray(ev.custom_questions) ? ev.custom_questions : []);
      const eventDetails = typeof ev.eventDetails === 'object' && ev.eventDetails ? ev.eventDetails : (typeof ev.event_details === 'object' && ev.event_details ? ev.event_details : {});
      const seatingChart = ev.seatingChart ?? ev.seating_chart ?? null;
      const createdAt = ev.created_at ?? ev.created ?? null;
      events.push({
        id: eid,
        created_by: owner,
        title,
        date,
        time,
        location,
        description,
        cover_image_url: cover,
        status,
        allow_guests: allowGuests,
        requires_meal_choice: requiresMealChoice,
        custom_questions: customQuestions,
        event_details: eventDetails,
        seating_chart: seatingChart,
        created_at: createdAt
      });
    }
    for (const r of rsvpsIn) {
      const rid = r.id ?? r.rsvpId;
      const eid = String(r.event_id ?? r.eventId ?? '').trim();
      const name = String(r.name ?? '').trim();
      const email = String(r.email ?? '').trim().toLowerCase();
      const phone = String(r.phone ?? '').trim();
      const attending = !!r.attending;
      const guestCount = Number(r.guest_count ?? r.guestCount ?? 0);
      const reason = String(r.reason ?? '').trim();
      const rank = String(r.rank ?? '').trim();
      const unit = String(r.unit ?? '').trim();
      const branch = String(r.branch ?? '').trim();
      const dietary = String(r.dietary_restrictions ?? '').trim();
      const allergy = String(r.allergy_details ?? '').trim();
      const customAnswers = typeof r.custom_answers === 'object' && r.custom_answers ? r.custom_answers : (typeof r.customAnswers === 'object' && r.customAnswers ? r.customAnswers : {});
      const createdR = r.created_at ?? r.timestamp ?? null;
      rsvps.push({
        id: rid,
        event_id: eid,
        name,
        email,
        phone,
        attending,
        guest_count: guestCount,
        reason,
        rank,
        unit,
        branch,
        dietary_restrictions: dietary,
        allergy_details: allergy,
        custom_answers: customAnswers,
        created_at: createdR
      });
    }
    const userMap = new Map();
    for (const u of users) {
      if (u.username) userMap.set(u.username.toLowerCase(), u);
    }
    for (const ev of events) {
      const owner = String(ev.created_by || '').trim();
      if (!owner) {
        const k1 = ev.event_details && ev.event_details.createdByUsername ? String(ev.event_details.createdByUsername).trim().toLowerCase() : '';
        const k2 = ev.event_details && ev.event_details.owner ? String(ev.event_details.owner).trim().toLowerCase() : '';
        const uu = userMap.get(k1) || userMap.get(k2);
        if (uu && uu.id) ev.created_by = uu.id;
      }
    }
    let deletedEvents = 0;
    let deletedRsvps = 0;
    let deletedUsers = 0;
    if (purgeRsvps) {
      const eventIds = Array.from(new Set(events.map(e => e.id))).filter(Boolean);
      if (eventIds.length > 0) {
        const delR = await supabase.from('ec_rsvps').delete().in('event_id', eventIds);
        if (!delR.error) deletedRsvps = delR.count || 0;
      } else {
        const delAllR = await supabase.from('ec_rsvps').delete();
        if (!delAllR.error) deletedRsvps = delAllR.count || 0;
      }
      await supabase.from('ec_rsvp_answers').delete();
      await supabase.from('ec_seating_assignments').delete();
    }
    if (purgeEvents) {
      await supabase.from('ec_seating_tables').delete();
      const delE = await supabase.from('ec_events').delete();
      if (!delE.error) deletedEvents = delE.count || 0;
    }
    if (purgeUsers) {
      const delU = await supabase.from('ec_users').delete();
      if (!delU.error) deletedUsers = delU.count || 0;
    }
    let usersUpserted = 0;
    for (const u of users) {
      const row = {
        id: isUUID(u.id) ? u.id : undefined,
        username: u.username || '',
        name: u.name || (u.username || ''),
        email: u.email || ((u.username ? `${u.username}@eventcall.local` : 'unknown@eventcall.local')),
        branch: u.branch || '',
        rank: u.rank || '',
        role: u.role || 'user',
        password_hash: u.password_hash || crypto.randomUUID()
      };
      let conf = 'username';
      if (row.id) conf = 'id';
      const ins = await supabase.from('ec_users').upsert([row], { onConflict: conf }).select('id').limit(1);
      if (!ins.error) {
        usersUpserted += Array.isArray(ins.data) ? ins.data.length : (ins.data ? 1 : 0);
      } else {
        console.error('Baseline user upsert error:', ins.error && ins.error.message ? ins.error.message : String(ins.error));
        errors.users.push(ins.error && ins.error.message ? ins.error.message : String(ins.error));
      }
    }
    let eventsUpserted = 0;
    const { data: existingEvents } = await supabase.from('ec_events').select('id');
    const existingEventIds = new Set((existingEvents || []).map(x => String(x.id)));
    for (const e of events) {
      const row = {
        id: isUUID(e.id) ? e.id : undefined,
        title: e.title || '',
        date: e.date || '',
        time: (function () {
          const s = String(e.time || '').trim();
          if (!s) return '00:00:00';
          if (/^[0-9]{2}:[0-9]{2}$/.test(s)) return s + ':00';
          return s;
        })(),
        location: e.location || '',
        description: e.description || '',
        cover_image_url: e.cover_image_url || '',
        status: e.status || 'active',
        created_by: isUUID(e.created_by) ? e.created_by : null,
        allow_guests: !!e.allow_guests,
        requires_meal_choice: !!e.requires_meal_choice,
        custom_questions: Array.isArray(e.custom_questions) ? e.custom_questions : [],
        event_details: typeof e.event_details === 'object' && e.event_details ? e.event_details : {},
        seating_chart: e.seating_chart ?? null,
        created_at: e.created_at || new Date().toISOString()
      };
      if (row.id && existingEventIds.has(String(row.id))) {
        const up = await supabase.from('ec_events').update(row).eq('id', row.id).select('id').limit(1);
        if (!up.error) {
          eventsUpserted += Array.isArray(up.data) ? up.data.length : (up.data ? 1 : 0);
        } else {
          console.error('Baseline event update error:', up.error && up.error.message ? up.error.message : String(up.error));
          errors.events.push(up.error && up.error.message ? up.error.message : String(up.error));
        }
      } else {
        const ins = await supabase.from('ec_events').insert([row]).select('id');
        if (!ins.error) {
          eventsUpserted += Array.isArray(ins.data) ? ins.data.length : (ins.data ? 1 : 0);
        } else {
          console.error('Baseline event insert error:', ins.error && ins.error.message ? ins.error.message : String(ins.error));
          errors.events.push(ins.error && ins.error.message ? ins.error.message : String(ins.error));
          const ins2 = await supabase.from('ec_events').insert([Object.assign({}, row, { id: undefined })]).select('id');
          if (!ins2.error) {
            eventsUpserted += Array.isArray(ins2.data) ? ins2.data.length : (ins2.data ? 1 : 0);
          } else {
            console.error('Baseline event insert (no id) error:', ins2.error && ins2.error.message ? ins2.error.message : String(ins2.error));
            errors.events.push(ins2.error && ins2.error.message ? ins2.error.message : String(ins2.error));
          }
        }
      }
    }
    if (eventsUpserted === 0 && events.length > 0) {
      for (const e of events) {
        const b = {
          title: e.title || '',
          date: e.date || '',
          time: e.time || '',
          location: e.location || '',
          description: e.description || '',
          cover_image_url: e.cover_image_url || '',
          created_by: e.created_by || null,
          status: e.status || 'active',
          allow_guests: !!e.allow_guests,
          requires_meal_choice: !!e.requires_meal_choice,
          custom_questions: Array.isArray(e.custom_questions) ? e.custom_questions : [],
          event_details: typeof e.event_details === 'object' && e.event_details ? e.event_details : {},
          seating_chart: e.seating_chart ?? null
        };
        try {
          const resp = await fetch(`http://localhost:${PORT}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
          if (resp.ok) eventsUpserted++;
        } catch (_) {}
      }
    }
    let rsvpsInserted = 0;
    const eventIdsSet = new Set(events.map(e => e.id).filter(Boolean));
    const rsvpRows = rsvps.filter(r => !r.event_id || eventIdsSet.has(String(r.event_id))).map(r => ({
      id: isUUID(r.id) ? r.id : crypto.randomUUID(),
      event_id: isUUID(r.event_id) ? r.event_id : null,
      name: r.name || '',
      email: r.email || '',
      phone: r.phone || '',
      attending: !!r.attending,
      guest_count: Number(r.guest_count || 0),
      reason: r.reason || '',
      rank: r.rank || '',
      unit: r.unit || '',
      branch: r.branch || '',
      dietary_restrictions: r.dietary_restrictions || '',
      allergy_details: r.allergy_details || '',
      custom_answers: typeof r.custom_answers === 'object' && r.custom_answers ? r.custom_answers : {},
      created_at: r.created_at || new Date().toISOString()
    }));
    for (const r of rsvpRows) {
      if (!r.event_id) {
        errors.rsvps.push('Missing or invalid event_id for RSVP');
        continue;
      }
      const ins = await supabase.from('ec_rsvps').upsert([r], { onConflict: 'event_id,email' }).select('id');
      if (!ins.error) {
        rsvpsInserted += Array.isArray(ins.data) ? ins.data.length : (ins.data ? 1 : 0);
      } else {
        console.error('Baseline RSVP insert error:', ins.error && ins.error.message ? ins.error.message : String(ins.error));
        errors.rsvps.push(ins.error && ins.error.message ? ins.error.message : String(ins.error));
      }
    }
    if (rsvpsInserted === 0 && rsvpRows.length > 0) {
      for (const r of rsvpRows) {
        const b = {
          event_id: r.event_id,
          name: r.name || '',
          email: r.email || '',
          phone: r.phone || '',
          attending: !!r.attending,
          guest_count: Number(r.guest_count || 0),
          reason: r.reason || '',
          rank: r.rank || '',
          unit: r.unit || '',
          branch: r.branch || '',
          dietary_restrictions: r.dietary_restrictions || '',
          allergy_details: r.allergy_details || '',
          custom_answers: typeof r.custom_answers === 'object' && r.custom_answers ? r.custom_answers : {}
        };
        try {
          const resp = await fetch(`http://localhost:${PORT}/api/rsvps`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
          if (resp.ok) rsvpsInserted++;
        } catch (_) {}
      }
    }
    res.json({
      success: true,
      purge: { users: purgeUsers, events: purgeEvents, rsvps: purgeRsvps, deleted_users: deletedUsers, deleted_events: deletedEvents, deleted_rsvps: deletedRsvps },
      applied: { users_upserted: usersUpserted, events_upserted: eventsUpserted, rsvps_inserted: rsvpsInserted },
      errors
    });
  } catch (e) {
    console.error('Apply baseline error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/admin/dedupe-events', isAdmin, async (req, res) => {
  try {
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const dryRun = !!(req.body && req.body.dry_run);
    const strategy = (req.body && req.body.strategy) || 'oldest';
    const { data: events, error: eErr } = await supabase.from('ec_events').select('id,title,date,time,location,created_at');
    if (eErr) return res.status(500).json({ error: eErr.message });
    const map = new Map();
    for (const ev of events || []) {
      const k = `${String(ev.title || '').trim().toLowerCase()}|${String(ev.date || '')}|${String(ev.time || '')}|${String(ev.location || '').trim().toLowerCase()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    }
    const plan = [];
    for (const [key, arr] of map.entries()) {
      if ((arr || []).length > 1) {
        let keep;
        if (strategy === 'newest') {
          keep = arr.slice().sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))).slice(-1)[0];
        } else {
          keep = arr.slice().sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))[0];
        }
        const removeIds = arr.map(a => a.id).filter(id => id !== keep.id);
        plan.push({ key, keepId: keep.id, removeIds, count: arr.length });
      }
    }
    if (dryRun) {
      return res.json({ success: true, dry_run: true, plan, total_groups: plan.length });
    }
    let rsvpUpdates = 0;
    let eventDeletes = 0;
    for (const p of plan) {
      if (p.removeIds.length === 0) continue;
      const up = await supabase.from('ec_rsvps').update({ event_id: p.keepId }).in('event_id', p.removeIds);
      if (!up.error) {
        const cnt = Array.isArray(up.data) ? up.data.length : 0;
        rsvpUpdates += cnt;
      }
      const del = await supabase.from('ec_events').delete().in('id', p.removeIds);
      if (!del.error) {
        eventDeletes += p.removeIds.length;
      }
    }
    res.json({ success: true, applied: true, groups: plan.length, rsvp_updates: rsvpUpdates, event_deletes: eventDeletes });
  } catch (e) {
    console.error('Dedupe error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/backfill-event-owners', async (req, res) => {
  try {
    if (MIGRATION_SECRET) {
      const s = req.headers['x-migration-secret'];
      if (!s || s !== MIGRATION_SECRET) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const evGit = REPO_OWNER ? await fetchGitHubDirectory('events') : [];
    const evLocal = await readLocalEvents();
    const srcData = MIGRATION_SOURCE_DIR ? await readSourceData(MIGRATION_SOURCE_DIR) : { events: [] };
    const sources = [...evGit, ...evLocal, ...srcData.events];
    function keyFromObj(o) {
      const t = String(o.title || '').trim().toLowerCase();
      const d = String(o.date || '').trim();
      const ti = String(o.time || '').trim();
      const l = String(o.location || '').trim().toLowerCase();
      return `${t}|${d}|${ti}|${l}`;
    }
    const sourceMap = new Map();
    const legacyIdMap = new Map();
    for (const e of sources) {
      try {
        sourceMap.set(keyFromObj(e), e);
      } catch (_) {}
      try {
        const lid = String(e.id ?? e.eventId ?? '').trim();
        if (lid) legacyIdMap.set(lid, e);
      } catch (_) {}
    }
    const { data: rows } = await supabase.from('ec_events').select('id,title,date,time,location,created_by').is('created_by', null);
    let updated = 0;
    let checked = 0;
    for (const ev of rows || []) {
      checked++;
      let src = sourceMap.get(keyFromObj(ev));
      if (!src) {
        const t = String(ev.title || '');
        const m = t.match(/^Legacy Event\s+([0-9a-fA-F-]{36})$/);
        if (m && m[1]) {
          const lid = m[1];
          src = legacyIdMap.get(lid);
        }
      }
      if (!src) continue;
      let email = String(src.createdByEmail ?? src.createdBy ?? '').trim().toLowerCase();
      let username = String(src.createdByUsername ?? src.createdBy ?? src.owner ?? '').trim().toLowerCase();
      if (email && !email.includes('@')) email = '';
      if (username && username.includes('@')) username = '';
      let ownerId = null;
      if (email) {
        const { data: ue } = await supabase.from('ec_users').select('id').eq('email', email).limit(1).maybeSingle();
        if (ue && ue.id) ownerId = ue.id;
      }
      if (!ownerId && username) {
        const { data: uu } = await supabase.from('ec_users').select('id').eq('username', username).limit(1).maybeSingle();
        if (uu && uu.id) ownerId = uu.id;
      }
      if (!ownerId && (email || username)) {
        const unameCandidate = username || (email ? email.split('@')[0] : '');
        const nameCandidate = (src.createdByName ? String(src.createdByName).trim() : '') || unameCandidate;
        const row = {
          username: unameCandidate,
          name: nameCandidate,
          email: email || '',
          branch: '',
          rank: '',
          role: 'user',
          password_hash: crypto.randomUUID()
        };
        const { data: ins } = await supabase.from('ec_users').upsert([row], { onConflict: 'username' }).select('id').limit(1);
        const createdRow = Array.isArray(ins) ? ins[0] : ins;
        if (createdRow && createdRow.id) ownerId = createdRow.id;
      }
      if (ownerId) {
        await supabase.from('ec_events').update({ created_by: ownerId }).eq('id', ev.id);
        updated++;
      }
    }
    res.json({ success: true, checked, updated });
  } catch (e) {
    console.error('Backfill owners error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/assign-unowned-to-user', async (req, res) => {
  try {
    if (MIGRATION_SECRET) {
      const s = req.headers['x-migration-secret'];
      if (!s || s !== MIGRATION_SECRET) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const target = String((req.body && req.body.target_user_id) || '').trim();
    if (!target) return res.status(400).json({ error: 'Missing target_user_id' });
    const { data: rows } = await supabase.from('ec_events').select('id,created_by').is('created_by', null);
    let updated = 0;
    for (const ev of rows || []) {
      await supabase.from('ec_events').update({ created_by: target }).eq('id', ev.id);
      updated++;
    }
    res.json({ success: true, updated });
  } catch (e) {
    console.error('Assign unowned error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/reassign-by-source-username', async (req, res) => {
  try {
    if (MIGRATION_SECRET) {
      const s = req.headers['x-migration-secret'];
      if (!s || s !== MIGRATION_SECRET) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!USE_SUPABASE) return res.status(501).json({ error: 'Supabase not configured' });
    const targetUsername = String((req.body && req.body.username) || '').trim().toLowerCase();
    if (!targetUsername) return res.status(400).json({ error: 'Missing username' });
    const { data: targetUser } = await supabase.from('ec_users').select('id,username,email').eq('username', targetUsername).limit(1).maybeSingle();
    if (!targetUser || !targetUser.id) return res.status(404).json({ error: 'Target user not found' });
    const evGit = REPO_OWNER ? await fetchGitHubDirectory('events') : [];
    const evLocal = await readLocalEvents();
    const srcData = MIGRATION_SOURCE_DIR ? await readSourceData(MIGRATION_SOURCE_DIR) : { events: [] };
    function keyFromObj(o) {
      const t = String(o.title || '').trim().toLowerCase();
      const d = String(o.date || '').trim();
      const ti = String(o.time || '').trim();
      const l = String(o.location || '').trim().toLowerCase();
      return `${t}|${d}|${ti}|${l}`;
    }
    function srcUsername(o) {
      const u1 = String(o.createdByUsername ?? o.createdBy ?? o.owner ?? '').trim().toLowerCase();
      if (u1 && !u1.includes('@')) return u1;
      return '';
    }
    function srcEmail(o) {
      const e1 = String(o.createdByEmail ?? o.createdBy ?? '').trim().toLowerCase();
      if (e1 && e1.includes('@')) return e1;
      return '';
    }
    const sourceMap = new Map();
    for (const e of [...evGit, ...evLocal, ...srcData.events]) {
      try { sourceMap.set(keyFromObj(e), e); } catch (_) {}
    }
    const { data: rows } = await supabase.from('ec_events').select('id,title,date,time,location,created_by');
    let checked = 0;
    let updated = 0;
    for (const ev of rows || []) {
      checked++;
      const key = keyFromObj(ev);
      const src = sourceMap.get(key);
      if (!src) continue;
      const su = srcUsername(src);
      const se = srcEmail(src);
      if (su === targetUsername || (se && se === String(targetUser.email || '').toLowerCase())) {
        await supabase.from('ec_events').update({ created_by: targetUser.id }).eq('id', ev.id);
        updated++;
      }
    }
    res.json({ success: true, checked, updated });
  } catch (e) {
    console.error('Reassign by source username error:', e);
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
    const uname = String(username || '').trim().toLowerCase();

    if (!uname || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    // SECURITY: Validate username format to prevent path traversal
    const isValidUsername = /^[a-z0-9._-]{3,50}$/.test(uname);
    if (!isValidUsername) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    // SECURITY: Enforce reasonable password length limit (DoS prevention)
    if (password.length > 128) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

  const user = await getUser(uname);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  const hash = user.passwordHash || user.password_hash;
  if (typeof hash !== 'string' || !hash.startsWith('$2')) {
    // Require bcrypt hashes only
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
  const isValid = await bcrypt.compare(password, hash);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
    }

    // Return user data (without password hash)
    const { passwordHash, password_hash, ...safeUser } = user;
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
    const uname = String(username || '').trim().toLowerCase();

    // Validation
    if (!uname || !password || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // SECURITY: Validate username format to prevent path traversal
    const isValidUsername = /^[a-z0-9._-]{3,50}$/.test(uname);
    if (!isValidUsername) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    // SECURITY: Enforce reasonable password length limit (DoS prevention)
    if (password.length > 128) {
      return res.status(400).json({ error: 'Invalid password length' });
    }

    // Check if user exists
    const existingUser = await getUser(uname);
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
      id: crypto.randomUUID(),
      username: uname,
      name,
      email: email.toLowerCase(),
      branch: branch || '',
      rank: rank || '',
      role: 'user',
      passwordHash,
      created: new Date().toISOString()
    };

    const saveResp = await saveUser(username, user);
    if (!saveResp.ok) {
      return res.status(500).json({
        success: false,
        error: typeof saveResp.error === 'string' ? saveResp.error : 'Failed to create user'
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

// Helper function to fetch user for password reset (prevents code duplication)
async function findUserForReset(username) {
  let user = null;
  let userFileSha = null;
  if (USE_SUPABASE) {
    user = await getUser(username.toLowerCase());
  } else {
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
        userFileSha = fileData.sha;
      }
    } catch (err) {
      console.log(`[RESET] Error fetching user: ${err.message}`);
    }
  }

  // Add artificial delay to prevent timing attacks (100-300ms random)
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  return { user, userFileSha };
}

// Verify username and email for UI-based password reset
// Returns a reset token if credentials match, allowing immediate password reset
app.post('/api/auth/verify-reset', async (req, res) => {
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

    // Fetch user with timing attack protection
    const { user, userFileSha } = await findUserForReset(username);

    // Verify user exists and email matches (case-insensitive)
    if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
      console.log(`[RESET] Verification failed for: ${username}`);
      return res.status(400).json({
        success: false,
        error: 'Username and email do not match our records'
      });
    }

    // Generate reset token (valid for 15 minutes for UI-based reset)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (15 * 60 * 1000); // 15 minutes

    // Store token
    resetTokens.set(resetToken, {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      expires,
      fileSha: userFileSha
    });

    console.log(`[RESET] Verification successful, token generated for: ${username}`);
    res.json({
      success: true,
      verified: true,
      token: resetToken,
      message: 'Identity verified. You can now reset your password.'
    });

  } catch (error) {
    console.error('Reset verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy email-based reset request (kept for compatibility)
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

    // Fetch user with timing attack protection
    const { user, userFileSha } = await findUserForReset(username);

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
      fileSha: userFileSha
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
    let user;
    if (USE_SUPABASE) {
      user = await getUser(tokenData.username);
      if (!user) return res.status(400).json({ error: 'User not found' });
    } else {
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
      user = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Save updated user
    if (USE_SUPABASE) {
      const { error } = await supabase
        .from('ec_users')
        .update({ password_hash: passwordHash, last_updated: new Date().toISOString() })
        .eq('username', tokenData.username.toLowerCase());
      if (error) return res.status(500).json({ error: error.message || 'Failed to update password' });
    } else {
      const userPath = `users/${tokenData.username}.json`;
      const userUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/${userPath}`;
      const fileResp = await fetch(userUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!fileResp.ok) return res.status(400).json({ error: 'User not found' });
      const fileData = await fileResp.json();
      const updatedUser = { ...user, passwordHash, passwordResetAt: new Date().toISOString() };
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

// Rate limiter for password change attempts (5 per hour per IP)
const passwordChangeLimiter = new RateLimiter(60 * 60 * 1000, 5);

// Change password from profile (requires current password verification)
// Security note: In this architecture without JWT/sessions, the current password
// verification serves as authentication. Rate limiting prevents brute force attacks.
app.post('/api/auth/change-password', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    // Rate limit to prevent brute force attacks
    const clientIP = getClientIP(req);
    if (passwordChangeLimiter.isRateLimited(clientIP)) {
      const retryAfter = passwordChangeLimiter.getRemainingTime(clientIP);
      return res.status(429).json({
        error: 'Too many password change attempts. Please try again later.',
        retryAfter
      });
    }

    const { username, currentPassword, newPassword } = req.body;

    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Username, current password, and new password are required' });
    }

    // Validate new password strength - must match frontend requirements
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Password complexity validation (same as frontend)
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasNumber) {
      return res.status(400).json({
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    let user;
    if (USE_SUPABASE) {
      user = await getUser(username.toLowerCase());
      if (!user) return res.status(400).json({ error: 'User not found' });
    } else {
      const userPath = `users/${username.toLowerCase()}.json`;
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
      user = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
    }

    // Verify current password
    const currentHash = user.passwordHash || user.password_hash || '';
    const isCurrentValid = await bcrypt.compare(currentPassword, currentHash);
    if (!isCurrentValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    if (USE_SUPABASE) {
      const { error } = await supabase
        .from('ec_users')
        .update({ password_hash: newPasswordHash, last_updated: new Date().toISOString() })
        .eq('username', username.toLowerCase());
      if (error) return res.status(500).json({ error: error.message || 'Failed to update password' });
    } else {
      const userPath = `users/${username.toLowerCase()}.json`;
      const userUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/${userPath}`;
      const fileResp = await fetch(userUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!fileResp.ok) return res.status(400).json({ error: 'User not found' });
      const fileData = await fileResp.json();
      const updatedUser = { ...user, passwordHash: newPasswordHash, passwordChangedAt: new Date().toISOString() };
      const updateResp = await fetch(userUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Change password for ${username}`,
          content: Buffer.from(JSON.stringify(updatedUser, null, 2)).toString('base64'),
          sha: fileData.sha
        })
      });
      if (!updateResp.ok) {
        const error = await updateResp.json();
        return res.status(500).json({ error: error.message || 'Failed to update password' });
      }
    }

    console.log(`[AUTH] Password changed successfully for: ${username}`);
    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`EventCall proxy listening on port ${PORT}`);
  if (MIGRATE_ON_START && USE_SUPABASE) {
    performMigration().then(r => {
      console.log(`Migration completed: ${JSON.stringify(r)}`);
    }).catch(() => {});
  }
});
