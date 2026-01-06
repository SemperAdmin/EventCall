/**
 * UX-004: Form User Experience Enhancement
 * - Real-time validation on blur/input with inline errors
 * - Password strength meter (zxcvbn preferred)
 * - Phone input handling with country selector + masking
 * - Autocomplete optimization and ARIA for accessibility (WCAG 2.1 AA)
 * - LocalStorage autosave + recovery with Start Over
 * - ENABLED FOR ALL USERS (A/B test removed)
 */
(function(){
  // Real-time validation is now enabled for all users
  const active = true;
  window.UX004Active = active;

  // Clean up old A/B test flag if it exists
  try {
    localStorage.removeItem('ux004_variant');
  } catch (e) {
    // Ignore if localStorage not available
  }

  const debounce = (fn, wait=150) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; };

  // Error summary component
  function updateErrorSummary(form) {
    if (!form) return;

    // Collect all current errors
    const errors = [];
    form.querySelectorAll('.form-error').forEach(errorEl => {
      const text = errorEl.textContent.replace(/^❌\s*/, '').trim();
      if (text) errors.push(text);
    });

    // Get or create error summary container
    let summary = form.querySelector('#form-error-summary');

    if (errors.length === 0) {
      // No errors - remove summary if it exists
      if (summary) summary.remove();
      return;
    }

    if (!summary) {
      // Create error summary
      summary = document.createElement('div');
      summary.id = 'form-error-summary';
      summary.className = 'form-error-summary';
      summary.setAttribute('role', 'alert');
      summary.setAttribute('aria-live', 'assertive');

      // Insert at the top of the form
      const firstChild = form.firstElementChild;
      if (firstChild) {
        form.insertBefore(summary, firstChild);
      } else {
        form.appendChild(summary);
      }
    }

    // Update summary content
    const title = errors.length === 1 ? 'Please fix this error:' : `Please fix these ${errors.length} errors:`;
    const errorList = errors.map(err =>
      `<li>${window.utils ? window.utils.escapeHTML(err) : err}</li>`
    ).join('');

    summary.innerHTML = `
      <div style="display: flex; align-items: start; gap: 1rem;">
        <div class="error-icon">⚠️</div>
        <div style="flex: 1;">
          <div class="error-title">
            ${window.utils ? window.utils.escapeHTML(title) : title}
          </div>
          <ul class="error-list">
            ${errorList}
          </ul>
        </div>
      </div>
    `;

    // Scroll to summary
    summary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

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

    // Update error summary (use RAF for next paint)
    const form = field.closest('form');
    if (form) {
      requestAnimationFrame(() => updateErrorSummary(form));
    }
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

    // Update error summary (use RAF for next paint)
    const form = field.closest('form');
    if (form) {
      requestAnimationFrame(() => updateErrorSummary(form));
    }
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
    name: (v) => {
      if (!v) return 'Please enter your full name';
      if (v.length < 2) return 'Name must be at least 2 characters';
      if (!/^[a-zA-Z\s\-\.]{2,50}$/.test(v)) return 'Please use only letters, spaces, hyphens, and periods';
      return null;
    },
    email: async (v) => {
      if (!v) return 'Please enter your email address';
      // Use the validation module if available
      if (window.validation && window.validation.validateEmail) {
        const result = await window.validation.validateEmail(v, { verifyDNS: false });
        return result.valid ? null : (result.errors[0] || 'Invalid email address');
      }
      // Fallback
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Please enter a valid email address';
      return null;
    },
    tel: (v, form) => {
      if (!v) return null; // Phone is optional on RSVP
      // Use the validation module if available
      if (window.validation && window.validation.validatePhone) {
        const result = window.validation.validatePhone(v, 'US');
        return result.valid ? null : (result.errors[0] || 'Invalid phone number');
      }
      // Fallback: US phone format (10 digits)
      const digits = v.replace(/\D+/g, '');
      if (digits.length !== 10) return 'Please enter a 10-digit US phone number';
      return null;
    }
  };

  function attachRealtimeValidation(form) {
    if (!form) return;
    const handler = debounce(async (e) => {
      const field = e.target;
      const name = field.getAttribute('name') || field.id;
      const val = (field.value || '').trim();
      const fn = validators[name];
      if (fn) {
        const msg = await fn(val, form);
        if (msg) setFieldError(field, msg); else clearFieldError(field);
      }
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

  // Phone input: formatting/masking (US format)
  function initPhoneHandling() {
    const phone = document.getElementById('rsvp-phone');
    if (!phone) return;
    phone.setAttribute('autocomplete','tel-national');
    const format = debounce(() => {
      const raw = (phone.value || '').trim();
      if (!raw) return; // Don't format empty input

      try {
        if (window.libphonenumber && typeof window.libphonenumber.parsePhoneNumberFromString === 'function') {
          const pn = window.libphonenumber.parsePhoneNumberFromString(raw, 'US');
          if (pn && pn.isValid()) {
            phone.value = pn.formatNational();
            clearFieldError(phone);
          }
        } else {
          // Minimal US mask fallback
          const digits = raw.replace(/\D+/g,'').slice(0,10);
          if (digits.length >= 4) {
            const masked = `(${digits.slice(0,3)}) ${digits.slice(3,6)}${digits.length>6?'-':''}${digits.slice(6,10)}`;
            phone.value = masked;
          }
        }
      } catch {
        // Silently ignore formatting errors - validation will handle it
      }
    }, 120);
    phone.addEventListener('input', format);
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
        else if (f.type === 'radio') {
          if (f.checked) data[name] = f.value;
        } else {
          data[name] = f.value;
        }
      });
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));

      // Show autosave indicator
      const indicator = document.getElementById('autosave-indicator');
      if (indicator) {
        // Clear any existing timeout to prevent overlapping fades
        if (indicator.fadeTimeout) {
          clearTimeout(indicator.fadeTimeout);
        }
        indicator.style.opacity = '1';
        indicator.fadeTimeout = setTimeout(() => {
          indicator.style.opacity = '0';
        }, 2000);
      }
    }, 200);
    form.addEventListener('input', save);
    form.addEventListener('change', save); // For radio buttons

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
              if (typeof value === 'boolean' && f.type === 'checkbox') {
                f.checked = value;
              } else if (f.type === 'radio') {
                if (f.value === value) f.checked = true;
              } else {
                f.value = value;
              }
            });
          }
        }
      } catch {}
    }
  }

  // Enhanced autosave for event creation form (handles custom questions)
  function enableEventFormAutosave(form) {
    if (!form) return;
    const key = 'eventcall_event_draft';

    const save = debounce(() => {
      const data = {
        fields: {},
        customQuestions: [],
        savedAt: Date.now()
      };

      // Save standard form fields
      form.querySelectorAll('input, select, textarea').forEach(f => {
        const name = f.name || f.id;
        if (!name || name.startsWith('custom-q-')) return; // Skip custom question inputs
        if (f.type === 'checkbox') data.fields[name] = !!f.checked;
        else if (f.type === 'radio') {
          if (f.checked) data.fields[name] = f.value;
        } else if (f.type !== 'file') { // Skip file inputs
          data.fields[name] = f.value;
        }
      });

      // Save custom questions structure
      const customContainer = document.getElementById('custom-questions-container');
      if (customContainer) {
        customContainer.querySelectorAll('.custom-question-item').forEach((item, idx) => {
          const questionInput = item.querySelector('.custom-question-text');
          const typeSelect = item.querySelector('.custom-question-type');
          const optionsInput = item.querySelector('.custom-question-options');
          const requiredCheckbox = item.querySelector('.custom-question-required');

          if (questionInput) {
            data.customQuestions.push({
              question: questionInput.value || '',
              type: typeSelect ? typeSelect.value : 'text',
              options: optionsInput ? optionsInput.value : '',
              required: requiredCheckbox ? requiredCheckbox.checked : false
            });
          }
        });
      }

      localStorage.setItem(key, JSON.stringify(data));

      // Show autosave indicator
      showAutosaveIndicator();
    }, 500);

    // Attach save listener
    form.addEventListener('input', save);
    form.addEventListener('change', save);

    // Also save when custom questions change
    const customContainer = document.getElementById('custom-questions-container');
    if (customContainer) {
      const observer = new MutationObserver(save);
      observer.observe(customContainer, { childList: true, subtree: true });
    }
  }

  function showAutosaveIndicator() {
    let indicator = document.getElementById('event-autosave-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'event-autosave-indicator';
      indicator.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 8px 16px;
        background: rgba(16, 185, 129, 0.9); color: white; border-radius: 8px;
        font-size: 14px; z-index: 1000; opacity: 0; transition: opacity 0.3s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      indicator.textContent = '✓ Draft saved';
      document.body.appendChild(indicator);
    }
    if (indicator.fadeTimeout) clearTimeout(indicator.fadeTimeout);
    indicator.style.opacity = '1';
    indicator.fadeTimeout = setTimeout(() => {
      indicator.style.opacity = '0';
    }, 2000);
  }

  // Restore event form draft
  function restoreEventFormDraft(form) {
    if (!form) return;
    const key = 'eventcall_event_draft';
    const savedRaw = localStorage.getItem(key);
    if (!savedRaw) return;

    try {
      const saved = JSON.parse(savedRaw);
      if (!saved || !saved.fields) return;

      // Check if draft is less than 24 hours old
      const ageHours = (Date.now() - saved.savedAt) / (1000 * 60 * 60);
      if (ageHours > 24) {
        localStorage.removeItem(key);
        return;
      }

      // Check if form is empty
      const hasContent = Array.from(form.querySelectorAll('input:not([type="file"]), select, textarea'))
        .some(f => f.type === 'checkbox' ? f.checked : (f.value || '').trim() !== '');
      if (hasContent) return;

      // Show recovery prompt
      const recoveryBanner = document.createElement('div');
      recoveryBanner.id = 'draft-recovery-banner';
      recoveryBanner.className = 'draft-recovery-banner';
      recoveryBanner.innerHTML = `
        <div class="draft-recovery-banner__content">
          <span class="draft-recovery-banner__icon">📝</span>
          <div>
            <div class="draft-recovery-banner__title">Draft found</div>
            <div class="draft-recovery-banner__subtitle">You have an unsaved event from earlier</div>
          </div>
        </div>
        <div class="draft-recovery-banner__actions">
          <button type="button" id="restore-draft-btn" class="btn btn-primary">
            Restore Draft
          </button>
          <button type="button" id="discard-draft-btn" class="btn">
            Start Fresh
          </button>
        </div>
      `;

      const firstFormGroup = form.querySelector('.form-group');
      if (firstFormGroup) {
        form.insertBefore(recoveryBanner, firstFormGroup);
      }

      document.getElementById('restore-draft-btn').addEventListener('click', () => {
        // Restore standard fields
        Object.entries(saved.fields).forEach(([name, value]) => {
          const f = form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);
          if (!f) return;
          if (typeof value === 'boolean' && f.type === 'checkbox') {
            f.checked = value;
          } else if (f.type !== 'file') {
            f.value = value;
          }
        });

        // Restore custom questions
        if (saved.customQuestions && saved.customQuestions.length > 0 && window.addCustomQuestion) {
          saved.customQuestions.forEach(q => {
            window.addCustomQuestion();
            const container = document.getElementById('custom-questions-container');
            const lastItem = container.lastElementChild;
            if (lastItem) {
              const questionInput = lastItem.querySelector('.custom-question-text');
              const typeSelect = lastItem.querySelector('.custom-question-type');
              const optionsInput = lastItem.querySelector('.custom-question-options');
              const requiredCheckbox = lastItem.querySelector('.custom-question-required');

              if (questionInput) questionInput.value = q.question;
              if (typeSelect) typeSelect.value = q.type;
              if (optionsInput) optionsInput.value = q.options;
              if (requiredCheckbox) requiredCheckbox.checked = q.required;
            }
          });
        }

        recoveryBanner.remove();
        if (window.showToast) window.showToast('Draft restored!', 'success');
      });

      document.getElementById('discard-draft-btn').addEventListener('click', () => {
        localStorage.removeItem(key);
        recoveryBanner.remove();
      });

    } catch (e) {
      console.warn('Failed to restore event draft:', e);
    }
  }

  // Clear draft on successful form submission
  window.clearEventFormDraft = function() {
    localStorage.removeItem('eventcall_event_draft');
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Attach validation to login/register forms
    attachRealtimeValidation(document.getElementById('login-form'));
    attachRealtimeValidation(document.getElementById('register-form'));

    // Strength meter for registration
    bindPasswordStrength();

    // Phone handling for RSVP (when present)
    initPhoneHandling();

    // Autosave for login/register only (RSVP handled in ui-components.js)
    enableAutosave(document.getElementById('login-form'), 'form:login');
    enableAutosave(document.getElementById('register-form'), 'form:register');

    // Event form autosave (with draft recovery)
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
      restoreEventFormDraft(eventForm);
      enableEventFormAutosave(eventForm);
    }
  });

  // Export function for RSVP form (called from ui-components.js setupRSVPForm)
  window.attachRSVPValidation = function() {
    const rsvpForm = document.getElementById('rsvp-form');
    if (rsvpForm) {
      attachRealtimeValidation(rsvpForm);

      // Get event from URL to create unique autosave key
      const event = window.getEventFromURL ? window.getEventFromURL() : null;
      const storageKey = event && event.id ? `form:rsvp:${event.id}` : 'form:rsvp';
      enableAutosave(rsvpForm, storageKey);

      console.log('✅ RSVP form validation and autosave enabled');
    }
  };
})();

console.log('✅ UX-004 form enhancements loaded');

