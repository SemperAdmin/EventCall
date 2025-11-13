/**
 * EventCall Utility Functions
 * Common utility functions used throughout the application
 */

/**
 * Generate a UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date
 */
function formatDate(date, options = {}) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
    };
    
    return dateObj.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format time for display
 * @param {string} time - Time string (HH:MM format)
 * @returns {string} Formatted time
 */
function formatTime(time) {
    if (!time) return '';
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
function isValidEmail(email) {
    return VALIDATION.email.test(email);
}

/**
 * Validate phone number
 * @param {string} phone - Phone to validate
 * @returns {boolean} Is valid phone
 */
function isValidPhone(phone) {
    return VALIDATION.phone.test(phone.replace(/\s+/g, ''));
}

/**
 * Validate event title
 * @param {string} title - Title to validate
 * @returns {boolean} Is valid title
 */
function isValidEventTitle(title) {
    return VALIDATION.eventTitle.test(title);
}

/**
 * Validate name
 * @param {string} name - Name to validate
 * @returns {boolean} Is valid name
 */
function isValidName(name) {
    return VALIDATION.name.test(name);
}

/**
 * Sanitize text input
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
    if (!text) return '';
    return text.trim().replace(/[<>]/g, '');
}

/**
 * Get the base path for the application (handles GitHub Pages)
 * @returns {string} Base path (e.g., '/EventCall/' or '/')
 */
function getBasePath() {
    // Check if we're on GitHub Pages
    const isGitHubPages = window.location.hostname.endsWith('.github.io');

    if (isGitHubPages) {
        // Extract repo name from pathname
        const pathParts = window.location.pathname.split('/').filter(p => p);
        if (pathParts.length > 0) {
            return '/' + pathParts[0] + '/';
        }
        // Fallback for root
        return '/EventCall/';
    }

    return '/';
}

/**
 * Generate invite URL for an event
 * @param {Object} event - Event data
 * @returns {string} Invite URL
 */
// function generateInviteURL(event) {
function generateInviteURL(event) {
    const basePath = getBasePath();
    const baseURL = window.location.origin + basePath;
    const encodedData = encodeURIComponent(JSON.stringify({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        description: event.description,
        coverImage: event.coverImage,
        askReason: event.askReason,
        allowGuests: event.allowGuests,
        requiresMealChoice: event.requiresMealChoice || false,
        eventDetails: event.eventDetails || {},
        customQuestions: event.customQuestions || [],
        created: event.created
    }));
    return `${baseURL}?data=${encodedData}#invite/${event.id}`;
}

/**
 * Get event data from URL parameters
 * @returns {Object|null} Event data or null
 */
// function getEventFromURL() {
function getEventFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');

    if (encodedData) {
        try {
            return JSON.parse(decodeURIComponent(encodedData));
        } catch (e1) {
            try {
                return JSON.parse(atob(encodedData));
            } catch (e2) {
                console.error('Failed to decode event data from URL:', e1, e2);
                return null;
            }
        }
    }
    return null;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }
}

/**
 * Download data as file
 * @param {string} data - Data to download
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 * @param {function(number):void} [onProgress] - Optional progress callback (0-100)
 */
function downloadFile(data, filename, mimeType = 'text/plain', onProgress) {
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    if (typeof onProgress === 'function') {
        try { onProgress(0); } catch (_) {}
    }
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    if (typeof onProgress === 'function') {
        // Schedule completion update to ensure visual progress can render
        setTimeout(() => { try { onProgress(100); } catch (_) {} }, 0);
    }
}

/**
 * Convert file to base64
 * @param {File} file - File to convert
 * @param {function(number):void} [onProgress] - Optional progress callback (0-100)
 * @returns {Promise<string>} Base64 string
 */
function fileToBase64(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        if (typeof onProgress === 'function') {
            try { onProgress(0); } catch (_) {}
        }
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            if (typeof onProgress === 'function') {
                try { onProgress(100); } catch (_) {}
            }
            resolve(base64);
        };
        reader.onprogress = (e) => {
            if (e && e.lengthComputable && typeof onProgress === 'function') {
                const p = Math.max(0, Math.min(100, (e.loaded / e.total) * 100));
                try { onProgress(Math.round(p)); } catch (_) {}
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Validate image file
 * @param {File} file - File to validate
 * @returns {Object} Validation result
 */
function validateImageFile(file) {
    const result = {
        valid: true,
        errors: []
    };

    // Check file type
    if (!APP_CONFIG.allowedImageTypes.includes(file.type)) {
        result.valid = false;
        result.errors.push('Invalid file type. Please select a valid image file.');
    }

    // Check file size
    if (file.size > APP_CONFIG.maxFileSize) {
        result.valid = false;
        result.errors.push(`File size too large. Maximum size is ${formatFileSize(APP_CONFIG.maxFileSize)}.`);
    }

    return result;
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Calculate event statistics
 * @param {Array} responses - RSVP responses
 * @returns {Object} Statistics
 */
function calculateEventStats(responses) {
    const stats = {
        total: responses.length,
        attending: 0,
        notAttending: 0,
        totalGuests: 0,
        attendingWithGuests: 0,
        totalHeadcount: 0,
        responseRate: 0
    };

    responses.forEach(response => {
        // Accept both boolean and string forms
        const isAttending = response.attending === true || response.attending === 'true';
        const isNotAttending = response.attending === false || response.attending === 'false';

        if (isAttending) {
            stats.attending++;
            // Parse guest count (string or number)
            const guestCount = parseInt(response.guestCount, 10) || 0;
            stats.attendingWithGuests += guestCount;
        } else if (isNotAttending) {
            stats.notAttending++;
        }

        // Track total guests regardless of attendance
        stats.totalGuests += parseInt(response.guestCount, 10) || 0;
    });

    // Total headcount = attending people + their guests
    stats.totalHeadcount = stats.attending + stats.attendingWithGuests;
    stats.responseRate = stats.total > 0
        ? ((stats.attending + stats.notAttending) / stats.total * 100).toFixed(1)
        : 0;

    return stats;
}

/**
 * Create CSV content from RSVP data
 * @param {Object} event - Event data
 * @param {Array} responses - RSVP responses
 * @returns {string} CSV content
 */
// Update CSV generation with csvSafe + ISO timestamps
function createCSVContent(event, responses) {
    const csvSafe = (v) => {
        const s = String(v ?? '');
        const needsQuote = /[",\n]/.test(s);
        const safe = s.replace(/"/g, '""');
        // Prevent formula injection
        const prefixed = /^[=+\-@]/.test(s) ? `'${safe}` : safe;
        return needsQuote ? `"${prefixed}"` : prefixed;
    };

    const toISO = (ts) => new Date(ts).toISOString();

    const headers = [
        'RSVP ID','Name','Email','Phone','Branch','Rank','Unit',
        'Attending','Guest Count','Dietary','Allergies',
        'Reason','Submitted ISO','Check-In Status'
    ];

    const rows = responses.map(r => ([
        r.rsvpId, r.name, r.email, r.phone, r.branch, r.rank, r.unit,
        r.attending ? 'Yes' : 'No', r.guestCount ?? 0,
        (r.dietaryRestrictions || []).join('; '),
        r.allergyDetails || '',
        r.reason || '',
        toISO(r.timestamp),
        r.checkedIn ? 'Checked In' : 'Not Checked In'
    ].map(csvSafe).join(',')));

    return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate safe filename from event title
 * @param {string} title - Event title
 * @returns {string} Safe filename
 */
function generateSafeFilename(title) {
    return title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
function formatRelativeTime(date) {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(diffInSeconds / interval.seconds);
        if (count >= 1) {
            return count === 1 ? `1 ${interval.label} ago` : `${count} ${interval.label}s ago`;
        }
    }

    return 'Just now';
}

/**
 * Check if date is in the past
 * @param {string} date - Date string
 * @param {string} time - Time string (optional)
 * @returns {boolean} Is in the past
 */
function isEventInPast(date, time = '00:00') {
    const eventDateTime = new Date(`${date}T${time}`);
    return eventDateTime < new Date();
}

/**
 * Get time until event
 * @param {string} date - Event date
 * @param {string} time - Event time
 * @returns {string} Time until event
 */
function getTimeUntilEvent(date, time) {
    const eventDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    const diffInSeconds = Math.floor((eventDateTime - now) / 1000);

    if (diffInSeconds <= 0) {
        return 'Event has passed';
    }

    const days = Math.floor(diffInSeconds / 86400);
    const hours = Math.floor((diffInSeconds % 86400) / 3600);
    const minutes = Math.floor((diffInSeconds % 3600) / 60);

    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} away`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} away`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} away`;
    } else {
        return 'Starting soon';
    }
}

// Add shared escaping helper
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
window.utils = window.utils || {};
window.utils.escapeHTML = escapeHTML;

/**
 * Sanitize HTML content using DOMPurify when available; fallback escapes all HTML
 * @param {string} html - HTML string to sanitize
 * @param {Object} options - Optional DOMPurify config
 * @returns {string} Safe HTML string
 */
function sanitizeHTML(html, options = {}) {
    if (html === null || html === undefined) return '';
    const raw = String(html);
    if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
        // Use DOMPurify with default safe tags to avoid breaking UI
        try {
            return window.DOMPurify.sanitize(raw, options);
        } catch (e) {
            console.warn('DOMPurify sanitize failed, falling back to escape:', e);
        }
    }
    // Fallback: escape to plain text to prevent XSS
    return escapeHTML(raw);
}

/**
 * Safely set innerHTML on an element using sanitizeHTML
 * @param {HTMLElement} el - Target element
 * @param {string} html - HTML content
 */
function safeSetHTML(el, html) {
    if (!el) return;
    el.innerHTML = sanitizeHTML(html);
}

window.utils.sanitizeHTML = sanitizeHTML;
window.utils.safeSetHTML = safeSetHTML;

/**
 * SecureStorage (Async) - AES-GCM 256 + HMAC-SHA256, TTL, audit logging
 * Notes:
 * - Key material is generated per-session and stored in sessionStorage
 * - Methods return Promises; use await when calling
 */
class SecureStorage {
    constructor(namespace = 'sec') {
        this.ns = namespace;
        this.encKey = null;
        this.macKey = null;
        this.auditKey = `${this.ns}_audit_log`;
        this.defaultTTLms = 4 * 60 * 60 * 1000; // 4 hours
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        // Load or generate key material (64 bytes base64)
        let materialB64 = sessionStorage.getItem(`${this.ns}_key_material`);
        if (!materialB64) {
            const bytes = new Uint8Array(64);
            crypto.getRandomValues(bytes);
            materialB64 = btoa(String.fromCharCode(...bytes));
            sessionStorage.setItem(`${this.ns}_key_material`, materialB64);
        }
        const materialBytes = Uint8Array.from(atob(materialB64), c => c.charCodeAt(0));
        const encBytes = materialBytes.slice(0, 32);
        const macBytes = materialBytes.slice(32, 64);
        this.encKey = await crypto.subtle.importKey('raw', encBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        this.macKey = await crypto.subtle.importKey('raw', macBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
        this.initialized = true;
    }

    _namespacedKey(key) { return `${this.ns}_${key}`; }

    async set(key, value, opts = {}) {
        await this.init();
        const ttl = typeof opts.ttl === 'number' ? opts.ttl : this.defaultTTLms;
        const wrapper = { v: 1, exp: Date.now() + ttl, data: value };
        const plaintext = new TextEncoder().encode(JSON.stringify(wrapper));
        const iv = new Uint8Array(12);
        crypto.getRandomValues(iv);
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.encKey, plaintext);
        const ctBytes = new Uint8Array(ct);
        // HMAC over iv|ct
        const combined = new Uint8Array(iv.length + ctBytes.length);
        combined.set(iv, 0); combined.set(ctBytes, iv.length);
        const macBuf = await crypto.subtle.sign('HMAC', this.macKey, combined);
        const macBytes = new Uint8Array(macBuf);

        const record = {
            v: 1,
            iv: btoa(String.fromCharCode(...iv)),
            ct: btoa(String.fromCharCode(...ctBytes)),
            mac: btoa(String.fromCharCode(...macBytes)),
            exp: wrapper.exp
        };
        sessionStorage.setItem(this._namespacedKey(key), JSON.stringify(record));
        this._audit('set', key, true);
    }

    async get(key) {
        await this.init();
        const raw = sessionStorage.getItem(this._namespacedKey(key));
        if (!raw) { this._audit('get', key, false); return null; }
        try {
            const rec = JSON.parse(raw);
            if (typeof rec.exp === 'number' && Date.now() > rec.exp) {
                sessionStorage.removeItem(this._namespacedKey(key));
                this._audit('get_expired', key, false);
                return null;
            }
            const iv = Uint8Array.from(atob(rec.iv), c => c.charCodeAt(0));
            const ct = Uint8Array.from(atob(rec.ct), c => c.charCodeAt(0));
            const combined = new Uint8Array(iv.length + ct.length);
            combined.set(iv, 0); combined.set(ct, iv.length);
            const macStored = Uint8Array.from(atob(rec.mac), c => c.charCodeAt(0));
            const macValid = await crypto.subtle.verify('HMAC', this.macKey, macStored, combined);
            if (!macValid) { this._audit('get_mac_invalid', key, false); return null; }
            const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.encKey, ct);
            const pt = new TextDecoder().decode(ptBuf);
            const wrapper = JSON.parse(pt);
            this._audit('get', key, true);
            return wrapper.data;
        } catch (e) {
            console.warn('SecureStorage get failed:', e);
            this._audit('get_error', key, false);
            return null;
        }
    }

    remove(key) {
        sessionStorage.removeItem(this._namespacedKey(key));
        this._audit('remove', key, true);
    }

    keys(prefix = '') {
        const nsPrefix = this._namespacedKey(prefix);
        const out = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i) || '';
            if (k.startsWith(this.ns + '_') && (!prefix || k.startsWith(nsPrefix))) {
                out.push(k.substring(this.ns.length + 1));
            }
        }
        return out;
    }

    _audit(action, key, success) {
        try {
            const entry = { ts: Date.now(), action, key, success };
            const raw = sessionStorage.getItem(this.auditKey);
            const log = raw ? JSON.parse(raw) : [];
            log.push(entry);
            if (log.length > 1000) log.shift();
            sessionStorage.setItem(this.auditKey, JSON.stringify(log));
        } catch (e) {
            // swallow audit errors
        }
    }
}

/**
 * SecureStorageSync (No-crypto) - Synchronous TTL wrapper for modules that need sync access
 * - Uses sessionStorage
 * - Applies TTL and audit logging
 * - Intended as transitional storage for synchronous rendering paths
 */
class SecureStorageSync {
    constructor(namespace = 'sec') {
        this.ns = namespace;
        this.auditKey = `${this.ns}_audit_log_sync`;
        this.defaultTTLms = 4 * 60 * 60 * 1000; // 4 hours
    }
    _namespacedKey(key) { return `${this.ns}_${key}`; }
    set(key, value, opts = {}) {
        const ttl = typeof opts.ttl === 'number' ? opts.ttl : this.defaultTTLms;
        const wrapper = { v: 1, exp: Date.now() + ttl, data: value };
        sessionStorage.setItem(this._namespacedKey(key), JSON.stringify(wrapper));
        this._audit('set', key, true);
    }
    get(key) {
        const raw = sessionStorage.getItem(this._namespacedKey(key));
        if (!raw) { this._audit('get', key, false); return null; }
        try {
            const rec = JSON.parse(raw);
            if (typeof rec.exp === 'number' && Date.now() > rec.exp) {
                sessionStorage.removeItem(this._namespacedKey(key));
                this._audit('get_expired', key, false);
                return null;
            }
            this._audit('get', key, true);
            return rec.data ?? rec; // backward compatible if plain array was stored
        } catch (e) {
            this._audit('get_error', key, false);
            return null;
        }
    }
    remove(key) { sessionStorage.removeItem(this._namespacedKey(key)); this._audit('remove', key, true); }
    keys(prefix = '') {
        const nsPrefix = this._namespacedKey(prefix);
        const out = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i) || '';
            if (k.startsWith(this.ns + '_') && (!prefix || k.startsWith(nsPrefix))) {
                out.push(k.substring(this.ns.length + 1));
            }
        }
        return out;
    }
    _audit(action, key, success) {
        try {
            const entry = { ts: Date.now(), action, key, success };
            const raw = sessionStorage.getItem(this.auditKey);
            const log = raw ? JSON.parse(raw) : [];
            log.push(entry);
            if (log.length > 1000) log.shift();
            sessionStorage.setItem(this.auditKey, JSON.stringify(log));
        } catch (e) {}
    }
}

window.utils.secureStorage = new SecureStorage('sec');
window.utils.secureStorageSync = new SecureStorageSync('sec');

/**
 * reCAPTCHA v3 Loader and Token Helper
 */
(function(){
  function loadRecaptchaScript(siteKey) {
    return new Promise((resolve, reject) => {
      if (window.grecaptcha && window.grecaptcha.execute) return resolve();
      const existing = document.querySelector('script[data-recaptcha="v3"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', reject);
        return;
      }
      const s = document.createElement('script');
      s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      s.async = true;
      s.defer = true;
      s.setAttribute('data-recaptcha', 'v3');
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
      document.head.appendChild(s);
    });
  }

  async function getRecaptchaToken(action = 'submit') {
    try {
      const cfg = window.RECAPTCHA_CONFIG || {};
      if (!cfg.enabled || !cfg.siteKey) {
        console.warn('reCAPTCHA not configured; skipping token acquisition');
        return null;
      }
      await loadRecaptchaScript(cfg.siteKey);
      return new Promise((resolve, reject) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute(cfg.siteKey, { action }).then(resolve).catch(reject);
        });
      });
    } catch (e) {
      console.warn('reCAPTCHA token acquisition failed:', e);
      return null;
    }
  }

  if (typeof window !== 'undefined') {
    window.utils = window.utils || {};
    window.utils.getRecaptchaToken = getRecaptchaToken;
  }
})();

/**
 * PERFORMANCE OPTIMIZATION: Batch DOM updates to prevent layout thrashing
 * These utilities help avoid forced reflows by batching style changes
 */
(function() {
  /**
   * Batch update multiple element styles to avoid layout thrashing
   * @param {Array} updates - Array of {element, styles} objects
   * @example
   * batchStyleUpdate([
   *   { element: el1, styles: { display: 'block', opacity: '1' } },
   *   { element: el2, styles: { display: 'none' } }
   * ]);
   */
  function batchStyleUpdate(updates) {
    // Use requestAnimationFrame to batch all style changes together
    requestAnimationFrame(() => {
      updates.forEach(({ element, styles }) => {
        if (element && styles) {
          Object.assign(element.style, styles);
        }
      });
    });
  }

  /**
   * Show/hide multiple elements efficiently
   * @param {Array} elements - Array of {element, show} objects
   * @example
   * batchVisibilityUpdate([
   *   { element: card1, show: true },
   *   { element: card2, show: false }
   * ]);
   */
  function batchVisibilityUpdate(elements) {
    const updates = elements.map(({ element, show }) => ({
      element,
      styles: { display: show ? '' : 'none' }
    }));
    batchStyleUpdate(updates);
  }

  /**
   * Add/remove CSS classes in batch to avoid layout thrashing
   * @param {Array} updates - Array of {element, add, remove} objects
   */
  function batchClassUpdate(updates) {
    requestAnimationFrame(() => {
      updates.forEach(({ element, add, remove }) => {
        if (element) {
          if (remove) {
            if (Array.isArray(remove)) {
              element.classList.remove(...remove);
            } else {
              element.classList.remove(remove);
            }
          }
          if (add) {
            if (Array.isArray(add)) {
              element.classList.add(...add);
            } else {
              element.classList.add(add);
            }
          }
        }
      });
    });
  }

  // Export to window.utils
  if (typeof window !== 'undefined') {
    window.utils = window.utils || {};
    window.utils.batchStyleUpdate = batchStyleUpdate;
    window.utils.batchVisibilityUpdate = batchVisibilityUpdate;
    window.utils.batchClassUpdate = batchClassUpdate;
  }
})();
