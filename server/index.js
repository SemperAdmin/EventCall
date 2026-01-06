
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

// =============================================================================
// HELPER FUNCTIONS - Data mapping (DRY)
// =============================================================================

// Map Supabase event data to frontend-expected format
function mapSupabaseEvent(e) {
  if (!e) return null;
  return {
    id: e.id,
    title: e.title || '',
    date: e.date || '',
    time: e.time || '',
    location: e.location || '',
    description: e.description || '',
    dress_code: e.dress_code || '',
    cover_image_url: e.cover_image_url || e.image_url || '',
    status: e.status || 'active',
    created_by: e.creator_id || e.created_by || '',
    creator_id: e.creator_id || e.created_by || '',
    created_at: e.created_at || '',
    allow_guests: e.allow_guests ?? true,
    requires_meal_choice: e.requires_meal_choice ?? false,
    custom_questions: e.custom_questions || [],
    event_details: e.event_details || {},
    seating_chart: e.seating_chart || null
  };
}

// Map Supabase RSVP data to frontend-expected format
function mapSupabaseRsvp(r) {
  if (!r) return null;
  return {
    id: r.id,
    event_id: r.event_id,
    eventId: r.event_id,
    name: r.name || '',
    email: r.email || '',
    phone: r.phone || '',
    guests: r.guests || 0,
    dietary: r.dietary || '',
    notes: r.notes || '',
    status: r.status || 'confirmed',
    created_at: r.created_at || '',
    response: r.response || 'yes'
  };
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
  const username = req.headers['x-username'];
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Use unified getUser to support both GitHub and Supabase modes
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

// =============================================================================
// EVENTS API - Fetch events from Supabase or GitHub
// =============================================================================

// Helper: Get events from Supabase
async function getEventsFromSupabase(creatorId = null) {
  if (!supabase) return [];
  let query = supabase.from('ec_events').select('*');
  if (creatorId) {
    query = query.eq('creator_id', creatorId);
  }
  const { data, error } = await query.order('date', { ascending: true });
  if (error) {
    console.error('Supabase getEvents error:', error.message);
    return [];
  }
  return data || [];
}

// Helper: Get events from GitHub
async function getEventsFromGitHub() {
  try {
    const eventsUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/events`;
    const response = await fetch(eventsUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'EventCall-Backend'
      }
    });
    if (!response.ok) return [];
    const eventsData = await response.json();
    if (!Array.isArray(eventsData)) return [];
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
    return await Promise.all(eventPromises);
  } catch (err) {
    console.error('GitHub getEvents error:', err.message);
    return [];
  }
}

// GET /api/events - Fetch all events
app.get('/api/events', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    const creatorId = req.query.creator_id || req.query.created_by || null;
    let events;
    if (USE_SUPABASE) {
      events = await getEventsFromSupabase(creatorId);
      events = events.map(mapSupabaseEvent);
    } else {
      events = await getEventsFromGitHub();
      if (creatorId) {
        events = events.filter(e => e.creator_id === creatorId || e.creatorId === creatorId);
      }
    }
    res.json({ success: true, events });
  } catch (error) {
    console.error('Failed to fetch events:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/events/:id - Fetch single event
app.get('/api/events/:id', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    const eventId = req.params.id;
    let event = null;
    if (USE_SUPABASE) {
      const { data, error } = await supabase
        .from('ec_events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      if (error) {
        console.error('Supabase getEvent error:', error.message);
      }
      event = mapSupabaseEvent(data);
    } else {
      // Fetch single event directly from GitHub (more efficient than fetching all)
      const eventUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/events/${eventId}.json`;
      const response = await fetch(eventUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'EventCall-Backend'
        }
      });
      if (response.ok) {
        const eventData = await response.json();
        event = JSON.parse(Buffer.from(eventData.content, 'base64').toString('utf-8'));
      }
    }
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ success: true, event });
  } catch (error) {
    console.error('Failed to fetch event:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// =============================================================================
// RSVPS API - Fetch RSVPs from Supabase or GitHub
// =============================================================================

// Helper: Get RSVPs from Supabase
async function getRsvpsFromSupabase(eventId = null, email = null) {
  if (!supabase) return [];
  let query = supabase.from('ec_rsvps').select('*');
  if (eventId) {
    query = query.eq('event_id', eventId);
  }
  if (email) {
    query = query.ilike('email', email);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase getRsvps error:', error.message);
    return [];
  }
  return data || [];
}

// Helper: Get RSVPs from GitHub
async function getRsvpsFromGitHub() {
  try {
    const rsvpsUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/rsvps`;
    const response = await fetch(rsvpsUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'EventCall-Backend'
      }
    });
    if (!response.ok) return [];
    const rsvpsData = await response.json();
    if (!Array.isArray(rsvpsData)) return [];
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
    return await Promise.all(rsvpPromises);
  } catch (err) {
    console.error('GitHub getRsvps error:', err.message);
    return [];
  }
}

// GET /api/rsvps - Fetch RSVPs (optionally filtered by event_id or email)
app.get('/api/rsvps', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    const eventId = req.query.event_id || null;
    const email = req.query.email || null;
    let rsvps;
    if (USE_SUPABASE) {
      rsvps = await getRsvpsFromSupabase(eventId, email);
      rsvps = rsvps.map(mapSupabaseRsvp);
    } else {
      rsvps = await getRsvpsFromGitHub();
      if (eventId) {
        rsvps = rsvps.filter(r => r.event_id === eventId || r.eventId === eventId);
      }
      if (email) {
        rsvps = rsvps.filter(r => r.email && r.email.toLowerCase() === email.toLowerCase());
      }
    }
    res.json({ success: true, rsvps });
  } catch (error) {
    console.error('Failed to fetch RSVPs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events - Create a new event
app.post('/api/events', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    const eventData = req.body;
    if (!eventData.title || !eventData.date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }
    const eventId = eventData.id || crypto.randomUUID();
    const event = {
      id: eventId,
      title: eventData.title,
      date: eventData.date,
      time: eventData.time || '',
      location: eventData.location || '',
      description: eventData.description || '',
      dress_code: eventData.dress_code || eventData.dressCode || '',
      creator_id: eventData.creator_id || eventData.creatorId || '',
      created_at: new Date().toISOString()
    };
    if (USE_SUPABASE) {
      const { error } = await supabase.from('ec_events').insert([event]);
      if (error) {
        console.error('Supabase createEvent error:', error.message);
        return res.status(500).json({ error: 'Failed to create event' });
      }
    } else {
      // Save to GitHub
      const eventUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/events/${eventId}.json`;
      const ghResp = await fetch(eventUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'EventCall-Backend'
        },
        body: JSON.stringify({
          message: `Create event: ${event.title}`,
          content: Buffer.from(JSON.stringify(event, null, 2)).toString('base64')
        })
      });
      if (!ghResp.ok) {
        const errData = await ghResp.json();
        console.error('GitHub createEvent error:', errData.message);
        return res.status(500).json({ error: 'Failed to create event' });
      }
    }
    res.json({ success: true, event, eventId });
  } catch (error) {
    console.error('Failed to create event:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rsvps - Create a new RSVP
app.post('/api/rsvps', async (req, res) => {
  try {
    if (!isOriginAllowed(req)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    const rsvpData = req.body;
    if (!rsvpData.event_id && !rsvpData.eventId) {
      return res.status(400).json({ error: 'event_id is required' });
    }
    if (!rsvpData.name || !rsvpData.email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    const rsvpId = rsvpData.id || crypto.randomUUID();
    const rsvp = {
      id: rsvpId,
      event_id: rsvpData.event_id || rsvpData.eventId,
      name: rsvpData.name,
      email: rsvpData.email.toLowerCase(),
      phone: rsvpData.phone || '',
      guests: rsvpData.guests || 0,
      dietary: rsvpData.dietary || '',
      notes: rsvpData.notes || '',
      status: rsvpData.status || 'confirmed',
      created_at: new Date().toISOString()
    };
    if (USE_SUPABASE) {
      const { error } = await supabase.from('ec_rsvps').insert([rsvp]);
      if (error) {
        console.error('Supabase createRsvp error:', error.message);
        return res.status(500).json({ error: 'Failed to create RSVP' });
      }
    } else {
      // Save to GitHub
      const rsvpUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/rsvps/${rsvpId}.json`;
      const ghResp = await fetch(rsvpUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'EventCall-Backend'
        },
        body: JSON.stringify({
          message: `RSVP from ${rsvp.name}`,
          content: Buffer.from(JSON.stringify(rsvp, null, 2)).toString('base64')
        })
      });
      if (!ghResp.ok) {
        const errData = await ghResp.json();
        console.error('GitHub createRsvp error:', errData.message);
        return res.status(500).json({ error: 'Failed to create RSVP' });
      }
    }
    res.json({ success: true, rsvp, rsvpId });
  } catch (error) {
    console.error('Failed to create RSVP:', error);
    res.status(500).json({ error: 'Server error' });
  }
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
    let users = [];
    if (USE_SUPABASE) {
      const { data, error } = await supabase
        .from('ec_users')
        .select('id, username, name, email, branch, rank, role, created_at')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase getUsers error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch users' });
      }
      users = data || [];
    } else {
      // GitHub fallback
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
      users = await Promise.all(userPromises);
    }
    res.json(users);
  } catch (error) {
    console.error('Failed to fetch all users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/dashboard-data', isAdmin, async (req, res) => {
  try {
    let events = [];
    let rsvps = [];

    if (USE_SUPABASE) {
      // Fetch events from Supabase
      const { data: eventsData, error: eventsError } = await supabase
        .from('ec_events')
        .select('*')
        .order('date', { ascending: true });
      if (eventsError) {
        console.error('Supabase getEvents error:', eventsError.message);
        return res.status(500).json({ error: 'Failed to fetch events' });
      }
      events = eventsData || [];

      // Fetch RSVPs from Supabase
      const { data: rsvpsData, error: rsvpsError } = await supabase
        .from('ec_rsvps')
        .select('*')
        .order('created_at', { ascending: false });
      if (rsvpsError) {
        console.error('Supabase getRsvps error:', rsvpsError.message);
        return res.status(500).json({ error: 'Failed to fetch RSVPs' });
      }
      rsvps = rsvpsData || [];
    } else {
      // GitHub fallback
      const eventsUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/events`;
      const eventsResponse = await fetch(eventsUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'EventCall-Backend'
        }
      });
      const eventsDataRaw = await eventsResponse.json();
      if (Array.isArray(eventsDataRaw)) {
        const eventPromises = eventsDataRaw.map(async file => {
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
        events = await Promise.all(eventPromises);
      }

      const rsvpsUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/rsvps`;
      const rsvpsResponse = await fetch(rsvpsUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'EventCall-Backend'
        }
      });
      const rsvpsDataRaw = await rsvpsResponse.json();
      if (Array.isArray(rsvpsDataRaw)) {
        const rsvpPromises = rsvpsDataRaw.map(async file => {
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
        rsvps = await Promise.all(rsvpPromises);
      }
    }

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

  try {
    if (USE_SUPABASE) {
      // Use Supabase
      user = await getUserFromSupabase(username);
    } else {
      // GitHub fallback
      const userPath = `users/${username.toLowerCase()}.json`;
      const userUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/${userPath}`;
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
    }
  } catch (err) {
    console.log(`[RESET] Error fetching user: ${err.message}`);
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

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    if (USE_SUPABASE) {
      // Update password in Supabase
      const { error } = await supabase
        .from('ec_users')
        .update({
          password_hash: passwordHash,
          updated_at: new Date().toISOString()
        })
        .eq('username', tokenData.username);

      if (error) {
        console.error('Supabase password reset error:', error.message);
        return res.status(500).json({ error: 'Failed to update password' });
      }
    } else {
      // GitHub fallback
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

      const updatedUser = {
        ...user,
        passwordHash,
        passwordResetAt: new Date().toISOString()
      };

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

    // Fetch user using unified function
    const user = await getUser(username);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Verify current password (support both field names)
    const currentHash = user.passwordHash || user.password_hash;
    const isCurrentValid = await bcrypt.compare(currentPassword, currentHash);
    if (!isCurrentValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    if (USE_SUPABASE) {
      // Update password in Supabase
      const { error } = await supabase
        .from('ec_users')
        .update({
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString()
        })
        .eq('username', username.toLowerCase());

      if (error) {
        console.error('Supabase password change error:', error.message);
        return res.status(500).json({ error: 'Failed to update password' });
      }
    } else {
      // GitHub fallback
      const userPath = `users/${username.toLowerCase()}.json`;
      const userUrl = `https://api.github.com/repos/${REPO_OWNER}/EventCall-Data/contents/${userPath}`;

      // Get current file SHA
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

      const updatedUser = {
        ...user,
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date().toISOString()
      };

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
  console.log(`Mode: ${USE_SUPABASE ? 'Supabase' : 'GitHub'}`);
});
