/**
 * UX-004: Form User Experience Enhancement
 * - Real-time validation on blur/input with inline errors
 * - Password strength meter (zxcvbn preferred)
 * - Phone input handling with country selector + masking
 * - Autocomplete optimization and ARIA for accessibility (WCAG 2.1 AA)
 * - LocalStorage autosave + recovery with Start Over
 * - 5% A/B gating via persisted feature flag
 */
(function(){
  const FLAG_KEY = 'ux004_variant';
  function getFeatureFlag() {
    const existing = localStorage.getItem(FLAG_KEY);
    if (existing === 'on') return true;
    if (existing === 'off') return false;
    const active = Math.random() < 0.05; // 5%
    localStorage.setItem(FLAG_KEY, active ? 'on' : 'off');
    return active;
  }

  const active = getFeatureFlag();
  window.UX004Active = active;
  if (!active) return; // Gate enhancements

  const debounce = (fn, wait=150) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; };

  // Error template rendering
  function setFieldError(field, msg) {
    clearFieldError(field);
    if (!msg) return;
    const id = field.id || field.name || 'field';
    const errId = `${id}-error`;
    const errorEl = document.createElement('div');
    errorEl.className = 'form-error';
    errorEl.id = errId;
    errorEl.setAttribute('role','alert');
    errorEl.setAttribute('aria-live','polite');
    errorEl.innerHTML = window.utils ? window.utils.sanitizeHTML(`❌ <span>${window.utils.escapeHTML(msg)}</span>`) : `❌ ${msg}`;
    field.setAttribute('aria-invalid','true');
    field.setAttribute('aria-describedby', errId);
    field.classList.remove('is-valid');
    field.classList.add('is-invalid');
    // Insert just after field
    (field.parentElement || field.closest('.form-group') || field).appendChild(errorEl);
  }

  function clearFieldError(field) {
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.classList.remove('is-invalid');
    field.classList.add('is-valid');
    const group = field.parentElement || field.closest('.form-group');
    if (!group) return;
    const err = group.querySelector('.form-error');
    if (err) err.remove();
  }

  // Simple validation rules
  const validators = {
    username: (v) => {
      if (!v) return 'Username is required';
      if (!window.userAuth || !window.userAuth.isValidUsername(v)) return '3-50 chars: letters, numbers, . - _ only';
      return null;
    },
    password: (v) => {
      if (!v) return 'Password is required';
      if (v.length < 8) return 'At least 8 characters';
      if (!/[A-Z]/.test(v)) return 'Include an uppercase letter';
      if (!/[a-z]/.test(v)) return 'Include a lowercase letter';
      if (!/[0-9]/.test(v)) return 'Include a number';
      return null;
    },
    confirmPassword: (v, form) => {
      if (!v) return 'Please confirm your password';
      const p = form.querySelector('#reg-password');
      if (p && v !== p.value) return 'Passwords do not match';
      return null;
    },
    name: (v) => (!v ? 'Full name is required' : null)
  };

  function attachRealtimeValidation(form) {
    if (!form) return;
    const handler = debounce((e) => {
      const field = e.target;
      const name = field.getAttribute('name') || field.id;
      const val = (field.value || '').trim();
      const fn = validators[name];
      const msg = fn ? fn(val, form) : null;
      if (msg) setFieldError(field, msg); else clearFieldError(field);
    });
    form.querySelectorAll('input, select, textarea').forEach(f => {
      f.addEventListener('input', handler);
      f.addEventListener('blur', handler);
    });
  }

  // Password strength UI
  function bindPasswordStrength() {
    const regPassword = document.getElementById('reg-password');
    const strengthIndicator = document.getElementById('password-strength');
    if (!regPassword || !strengthIndicator || !window.userAuth) return;
    const render = debounce((v) => {
      const result = window.userAuth.checkPasswordStrength(v);
      const width = Math.max(5, Math.round(((result.score || 0) / 4) * 100));
      const suggestions = (result.suggestions || []).slice(0,2).map(s => `<li>${window.utils ? window.utils.escapeHTML(s) : s}</li>`).join('');
      const html = `
        <div class="strength-meter" aria-live="polite">
          <div class="strength-bar" style="background:${result.color}; width:${width}%"></div>
          <div class="strength-text" style="color:${result.color}">${result.message || ''}</div>
          ${suggestions ? `<ul class="strength-suggestions">${suggestions}</ul>` : ''}
        </div>`;
      window.utils ? (strengthIndicator.innerHTML = window.utils.sanitizeHTML(html)) : (strengthIndicator.innerHTML = html);
    }, 120);
    regPassword.addEventListener('input', (e) => render(e.target.value));
  }

  // Phone input: country selector + formatting/masking
  function initPhoneHandling() {
    const phone = document.getElementById('rsvp-phone');
    const country = document.getElementById('rsvp-country');
    if (!phone) return;
    phone.setAttribute('autocomplete','tel-national');
    const format = debounce(() => {
      const raw = (phone.value || '').trim();
      const c = country && country.value ? country.value : 'US';
      try {
        if (window.libphonenumber && typeof window.libphonenumber.parsePhoneNumberFromString === 'function') {
          const pn = window.libphonenumber.parsePhoneNumberFromString(raw, c);
          if (pn) {
            phone.value = pn.formatNational();
            clearFieldError(phone);
          } else {
            setFieldError(phone, 'Invalid phone number');
          }
        } else {
          // Minimal US mask fallback
          if (c === 'US') {
            const digits = raw.replace(/\D+/g,'').slice(0,10);
            let masked = digits;
            if (digits.length >= 4) masked = `(${digits.slice(0,3)}) ${digits.slice(3,6)}${digits.length>6?'-':''}${digits.slice(6,10)}`;
            phone.value = masked;
          }
        }
      } catch {
        setFieldError(phone, 'Invalid phone number');
      }
    }, 120);
    phone.addEventListener('input', format);
    if (country) {
      country.setAttribute('autocomplete','tel-country-code');
      country.addEventListener('change', format);
    }
  }

  // Autosave + recovery
  function enableAutosave(form, key) {
    if (!form) return;
    const save = debounce(() => {
      const data = {};
      form.querySelectorAll('input, select, textarea').forEach(f => {
        const name = f.name || f.id;
        if (!name) return;
        if (f.type === 'checkbox') data[name] = !!f.checked;
        else data[name] = f.value;
      });
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    }, 200);
    form.addEventListener('input', save);

    // Recovery prompt if form is empty and saved exists
    const savedRaw = localStorage.getItem(key);
    if (savedRaw) {
      try {
        const saved = JSON.parse(savedRaw);
        const hasAnyValue = Array.from(form.querySelectorAll('input, select, textarea')).some(f => (f.type==='checkbox'?f.checked:(f.value||'').trim() !== ''));
        if (!hasAnyValue && saved && saved.data) {
          if (confirm('Restore your previous entries?')) {
            Object.entries(saved.data).forEach(([name, value]) => {
              const f = form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);
              if (!f) return;
              if (typeof value === 'boolean' && f.type === 'checkbox') f.checked = value; else f.value = value;
            });
          }
        }
      } catch {}
    }

    // Inject Start Over button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Start Over';
    btn.className = 'btn-secondary';
    btn.style.marginTop = '0.75rem';
    btn.addEventListener('click', () => {
      localStorage.removeItem(key);
      form.reset();
      form.querySelectorAll('.is-valid,.is-invalid,.form-error').forEach(el => { if (el.classList) { el.classList.remove('is-valid','is-invalid'); } if (el.classList && el.classList.contains('form-error')) el.remove(); });
    });
    const group = form.querySelector('.form-group:last-of-type') || form;
    group.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Attach validation
    attachRealtimeValidation(document.getElementById('login-form'));
    attachRealtimeValidation(document.getElementById('register-form'));

    // Strength meter
    bindPasswordStrength();

    // Phone handling for RSVP (when present)
    initPhoneHandling();

    // Autosave
    enableAutosave(document.getElementById('login-form'), 'form:login');
    enableAutosave(document.getElementById('register-form'), 'form:register');
    const rsvpForm = document.getElementById('rsvp-form');
    if (rsvpForm) enableAutosave(rsvpForm, 'form:rsvp');
  });
})();

console.log('✅ UX-004 form enhancements loaded');

