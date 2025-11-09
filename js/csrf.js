/**
 * CSRF Protection Module (SEC-006)
 * - Generates per-session CSRF token using crypto
 * - Double-submit cookie pattern (cookie + header/payload)
 * - Embeds hidden token fields in state-changing forms
 * - Supports token rotation
 */
(function(){
  const CFG = (window.SECURITY_CONFIG || {});
  const COOKIE_NAME = CFG.csrfCookieName || 'eventcall_csrf';
  const STORAGE_KEY = CFG.csrfStorageKey || 'eventcall_csrf_token';
  const ROTATE_MS = CFG.csrfRotateMs || (30 * 60 * 1000); // 30 min default

  function toBase64Url(bytes) {
    const bin = String.fromCharCode.apply(null, bytes);
    const b64 = btoa(bin);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function generateToken() {
    const arr = new Uint8Array(32);
    (window.crypto && window.crypto.getRandomValues) ? window.crypto.getRandomValues(arr) : arr.fill(Math.floor(Math.random() * 255));
    return toBase64Url(arr);
  }

  function setCookie(name, value) {
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${name}=${value}; Path=/; SameSite=Strict${secure}`;
    } catch (e) {
      console.warn('Failed to set CSRF cookie', e);
    }
  }

  function getCookie(name) {
    const parts = document.cookie.split(';').map(s => s.trim());
    for (const part of parts) {
      if (part.startsWith(name + '=')) return part.substring(name.length + 1);
    }
    return '';
  }

  function initToken() {
    let token = sessionStorage.getItem(STORAGE_KEY) || '';
    if (!token) {
      token = generateToken();
      sessionStorage.setItem(STORAGE_KEY, token);
      setCookie(COOKIE_NAME, token);
    } else {
      // Ensure cookie aligns with storage
      if (getCookie(COOKIE_NAME) !== token) setCookie(COOKIE_NAME, token);
    }
    return token;
  }

  function rotateToken() {
    const token = generateToken();
    sessionStorage.setItem(STORAGE_KEY, token);
    setCookie(COOKIE_NAME, token);
    attachCSRFToForms();
    console.log('🔒 CSRF token rotated');
    return token;
  }

  function getToken() {
    return sessionStorage.getItem(STORAGE_KEY) || initToken();
  }

  function attachHiddenInput(form) {
    if (!form) return;
    let input = form.querySelector('input[name="csrf_token"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'csrf_token';
      form.appendChild(input);
    }
    input.value = getToken();
  }

  function isStateChangingForm(form) {
    const id = form.id || '';
    const method = (form.method || 'post').toLowerCase();
    const candidates = ['rsvp-form', 'event-form'];
    return candidates.includes(id) || method === 'post';
  }

  function attachCSRFToForms() {
    const forms = document.querySelectorAll('form');
    forms.forEach(f => { if (isStateChangingForm(f)) attachHiddenInput(f); });
  }

  function originAllowed() {
    const origin = window.location.origin;
    const host = window.location.hostname;
    const allowed = (CFG.allowedOrigins || []).slice();
    // Always allow localhost for dev
    if (!allowed.includes(origin) && (host === 'localhost' || host === '127.0.0.1')) return true;
    return allowed.length === 0 || allowed.includes(origin);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initToken();
    attachCSRFToForms();
    if (ROTATE_MS > 0) setInterval(rotateToken, ROTATE_MS);
    console.log('✅ CSRF module initialized');
  });

  window.csrf = {
    getToken,
    rotateToken,
    attachCSRFToForms,
    originAllowed,
    cookieName: COOKIE_NAME,
    storageKey: STORAGE_KEY
  };
})();

