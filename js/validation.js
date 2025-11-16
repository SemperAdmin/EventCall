/**
 * Comprehensive Validation Module (SEC-005)
 * - Email validation using validator.js with RFC 6531 support
 * - Disposable domain detection
 * - DNS MX lookup via DNS-over-HTTPS (optional)
 * - Phone validation/formatting using libphonenumber-js
 * - URL validation and sanitization with https enforcement
 * - File upload security: magic number, signature checks, size limits
 */

(function(){
  const hasValidator = typeof window !== 'undefined' && window.validator && typeof window.validator.isEmail === 'function';
  const hasPhoneLib = typeof window !== 'undefined' && window.libphonenumber && (
    typeof window.libphonenumber.parsePhoneNumberFromString === 'function' ||
    typeof window.libphonenumber.parsePhoneNumber === 'function'
  );

  // Basic disposable domain list (extendable)
  const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com',
    'temp-mail.org', 'trashmail.com', 'dispostable.com', 'fakeinbox.com'
  ]);

  async function checkDNSMX(domain) {
    try {
      const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
      const resp = await fetch(url, { method: 'GET' });
      if (!resp.ok) return { ok: false, error: `DNS query failed: ${resp.status}` };
      const data = await resp.json();
      const hasMX = Array.isArray(data.Answer) && data.Answer.length > 0;
      return { ok: hasMX };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function isDisposableDomain(domain) {
    const d = String(domain || '').toLowerCase();
    return DISPOSABLE_DOMAINS.has(d) || DISPOSABLE_DOMAINS.has(d.replace(/^www\./, ''));
  }

  async function validateEmail(email, opts = {}) {
    const result = { valid: false, errors: [], normalized: '' };
    const value = String(email || '').trim();
    if (!value) {
      result.errors.push('Email is required');
      return result;
    }

    let domain = '';
    let isValidSyntax = false;
    try {
      if (hasValidator) {
        isValidSyntax = window.validator.isEmail(value, {
          allow_utf8_local_part: true,
          require_tld: true,
          ignore_max_length: false,
          domain_specific_validation: true
        });
        const parts = value.split('@');
        domain = parts[1] || '';
      } else {
        // Fallback: permissive RFC-like pattern
        const basicPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        isValidSyntax = basicPattern.test(value);
        domain = value.split('@')[1] || '';
      }
    } catch (e) {
      isValidSyntax = false;
    }

    if (!isValidSyntax) {
      result.errors.push('Please enter a valid email address (e.g., name@example.com)');
    }

    if (domain) {
      if (isDisposableDomain(domain)) {
        result.errors.push('Temporary email addresses are not accepted. Please use your personal or work email');
      }

      if (opts.verifyDNS === true) {
        const dns = await checkDNSMX(domain);
        if (!dns.ok) {
          result.errors.push('This email domain appears to be invalid. Please double-check your email address');
        }
      }
    }

    result.valid = result.errors.length === 0;
    result.normalized = value.toLowerCase();
    return result;
  }

  function validatePhone(phone, country = 'US') {
    const result = { valid: false, errors: [], e164: '', formatted: '' };
    const value = String(phone || '').trim();

    if (!value) {
      result.errors.push('Phone number is required');
      return result;
    }

    if (hasPhoneLib) {
      try {
        const parser = window.libphonenumber.parsePhoneNumberFromString || window.libphonenumber.parsePhoneNumber;
        const pn = parser(value, country);
        if (pn && pn.isValid()) {
          result.valid = true;
          result.e164 = pn.number; // E.164
          result.formatted = pn.formatInternational();
          return result;
        }
        result.errors.push('Please enter a valid phone number for the selected country (e.g., (555) 123-4567)');
      } catch (e) {
        result.errors.push('Please check your phone number format');
      }
    } else {
      // Fallback: digits length check
      const digits = value.replace(/\D+/g, '');
      if (digits.length >= 10 && digits.length <= 15) {
        result.valid = true;
        result.e164 = `+${digits}`;
        result.formatted = result.e164;
      } else {
        result.errors.push('Phone number should contain 10-15 digits');
      }
    }

    return result;
  }

  function isLikelyURL(text) {
    const v = String(text || '').trim();
    return v.startsWith('http://') || v.startsWith('https://') || /\w+\.[a-z]{2,}/i.test(v);
  }

  function sanitizeQueryParams(url) {
    const u = new URL(url);
    const params = new URLSearchParams(u.search);
    const sanitized = new URLSearchParams();
    const forbidden = [/script/i, /<|>/, /on\w+=/i];
    for (const [k, v] of params.entries()) {
      const kv = `${k}=${v}`;
      if (forbidden.some(re => re.test(kv))) {
        continue; // drop suspicious params
      }
      sanitized.set(k, v);
    }
    u.search = sanitized.toString();
    return u.toString();
  }

  async function validateURL(url, opts = {}) {
    const result = { valid: false, errors: [], sanitized: '' };
    const value = String(url || '').trim();
    if (!value) {
      // Optional field in many cases
      return { valid: true, errors: [], sanitized: '' };
    }

    let u;
    try {
      u = new URL(value);
    } catch {
      // Try assuming https
      try { u = new URL(`https://${value}`); } catch { u = null; }
    }

    if (!u) {
      result.errors.push('Please enter a valid web address (e.g., https://example.com)');
      return result;
    }

    if (opts.requireHTTPS !== false && u.protocol !== 'https:') {
      result.errors.push('For security, please use a secure address starting with https://');
    }

    const hostname = u.hostname.toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(hostname) || hostname.startsWith('-') || hostname.endsWith('-')) {
      result.errors.push('This web address appears to be invalid. Please check and try again');
    }

    if (opts.verifyDNS === true) {
      const dns = await checkDNSMX(hostname.replace(/^www\./, ''));
      // For general URLs, A record would be better; MX check is a heuristic.
      if (!dns.ok) {
        result.errors.push('This web address may not exist. Please verify the URL');
      }
    }

    const sanitized = sanitizeQueryParams(u.toString());
    result.valid = result.errors.length === 0;
    result.sanitized = sanitized;
    return result;
  }

  async function getFileSignature(file, bytes = 16) {
    const slice = file.slice(0, bytes);
    const buf = await slice.arrayBuffer();
    const arr = new Uint8Array(buf);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
  }

  function isKnownImageSignature(sig) {
    return (
      sig.startsWith('ff d8 ff') || // JPEG
      sig.startsWith('89 50 4e 47 0d 0a 1a 0a') || // PNG
      sig.startsWith('47 49 46 38') || // GIF
      sig.startsWith('52 49 46 46') // RIFF (WebP)
    );
  }

  async function validateImageUpload(file) {
    const result = { valid: false, errors: [] };

    if (!file) {
      result.errors.push('Please select a file to upload');
      return result;
    }

    // Size check
    const maxSize = (window.APP_CONFIG && window.APP_CONFIG.maxFileSize) || 5 * 1024 * 1024;
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    if (file.size > maxSize) {
      result.errors.push(`Image is too large. Maximum file size is ${maxSizeMB}MB`);
    }

    // MIME check
    const allowed = (window.APP_CONFIG && window.APP_CONFIG.allowedImageTypes) || ['image/jpeg','image/png','image/gif','image/webp'];
    if (!allowed.includes(file.type)) {
      result.errors.push('Please upload a JPEG, PNG, GIF, or WebP image file');
    }

    // Magic number/signature check
    try {
      const sig = await getFileSignature(file);
      if (!isKnownImageSignature(sig)) {
        result.errors.push('This file does not appear to be a valid image. Please select a different file');
      }
    } catch (e) {
      result.errors.push('Unable to verify the image file. Please try a different file');
    }

    // Extension-MIME consistency
    const name = String(file.name || '').toLowerCase();
    const ext = name.split('.').pop();
    const mimeByExt = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp'
    };
    if (mimeByExt[ext] && mimeByExt[ext] !== file.type) {
      result.errors.push('The file extension doesn\'t match the image type. Please verify your file');
    }

    // Optional: virus scanning hook
    if (window.VIRUS_SCAN_CONFIG && window.VIRUS_SCAN_CONFIG.enabled) {
      // Placeholder: integrate with backend scan API
      // e.g., upload to scanning endpoint and await verdict
      // For now, we simply warn but do not block
      console.warn('Virus scanning integration is enabled but not implemented client-side');
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  window.validation = {
    validateEmail,
    validatePhone,
    isLikelyURL,
    validateURL,
    validateImageUpload
  };
})();
