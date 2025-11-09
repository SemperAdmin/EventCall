// Unified Loading UI utilities for EventCall
// - Standardized spinner with min 300ms visibility
// - Skeleton components for major content types
// - Progress bar with percent and ETA
// Accessible and WCAG AA compliant

(function () {
  const MIN_VISIBLE_MS = 300;
  const MIN_PROGRESS_UPDATE_MS = 500; // throttle

  function sanitize(html) {
    try {
      return (window.utils && window.utils.sanitizeHTML) ? window.utils.sanitizeHTML(html) : String(html);
    } catch { return String(html); }
  }

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  // Spinner attached to buttons or containers
  function startSpinner(target, labelText = 'Loading...', opts = {}) {
    const startedAt = now();
    let originalHTML = '';
    let originalDisabled = false;
    const isButton = target && target.tagName && target.tagName.toLowerCase() === 'button';

    if (!target) return { done: () => {} };

    if (isButton) {
      originalHTML = target.innerHTML;
      originalDisabled = !!target.disabled;
      target.innerHTML = sanitize(`<span class="spinner" aria-hidden="true"></span> <span class="sr-only" aria-live="polite">${labelText}</span>${labelText ? ' ' + labelText : ''}`);
      target.disabled = true;
    } else {
      originalHTML = target.innerHTML;
      target.setAttribute('aria-busy', 'true');
      target.innerHTML = sanitize(`<div class="loading-inline"><span class="spinner" aria-hidden="true"></span><span class="sr-only" aria-live="polite">${labelText}</span>${labelText ? ' ' + labelText : ''}</div>`);
    }

    const done = () => {
      const elapsed = now() - startedAt;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setTimeout(() => {
        if (!target) return;
        if (isButton) {
          target.innerHTML = originalHTML;
          target.disabled = originalDisabled;
        } else {
          target.innerHTML = originalHTML;
          target.removeAttribute('aria-busy');
        }
      }, wait);
    };

    return { done, startedAt };
  }

  // Skeleton utilities
  function skeletonCard() {
    return `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-cover"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line w-70"></div>
          <div class="skeleton-line w-40"></div>
          <div class="skeleton-line w-55"></div>
        </div>
      </div>
    `;
  }

  function showSkeleton(container, type = 'cards', count = 6) {
    const el = (typeof container === 'string') ? document.querySelector(container) : container;
    if (!el) return { hide: () => {} };
    const content = Array.from({ length: count }).map(() => type === 'cards' ? skeletonCard() : '<div class="skeleton-line"></div>').join('');
    const original = el.innerHTML;
    el.setAttribute('data-skeleton-active', 'true');
    el.innerHTML = `<div class="skeleton-grid">${content}</div>`;
    return {
      hide: () => {
        // Fade-in transition for actual content is handled via CSS class
        el.classList.add('content-fade-in');
        setTimeout(() => {
          el.innerHTML = original;
          el.removeAttribute('data-skeleton-active');
          el.classList.remove('content-fade-in');
        }, 0);
      }
    };
  }

  // Progress bar
  function createProgressBar(container, { showETA = true } = {}) {
    const el = (typeof container === 'string') ? document.querySelector(container) : container;
    if (!el) return { update: () => {}, complete: () => {} };
    const startedAt = now();
    let lastUpdate = 0;

    const wrapper = document.createElement('div');
    wrapper.className = 'progress-wrapper';
    wrapper.innerHTML = `
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="progress-bar" style="width:0%"></div>
        <div class="progress-text" aria-live="polite">0%</div>
      </div>
    `;
    el.appendChild(wrapper);

    const bar = wrapper.querySelector('.progress-bar');
    const text = wrapper.querySelector('.progress-text');
    const progressEl = wrapper.querySelector('.progress');

    const update = (percent, etaSeconds = null) => {
      const t = now();
      if (t - lastUpdate < MIN_PROGRESS_UPDATE_MS) return; // throttle
      lastUpdate = t;
      const p = Math.max(0, Math.min(100, percent || 0));
      bar.style.width = p + '%';
      progressEl.setAttribute('aria-valuenow', String(p));
      let label = `${p.toFixed(0)}%`;
      if (showETA) {
        let eta = etaSeconds;
        if (eta == null && p > 0) {
          const elapsedMs = t - startedAt;
          const totalMs = elapsedMs / (p / 100);
          eta = Math.max(0, (totalMs - elapsedMs) / 1000);
        }
        if (eta != null && isFinite(eta)) {
          const m = Math.floor(eta / 60);
          const s = Math.floor(eta % 60);
          const etaStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
          label += ` • ETA ${etaStr}`;
        }
      }
      text.textContent = label;
    };

    const complete = () => {
      update(100, 0);
      setTimeout(() => {
        wrapper.remove();
      }, MIN_VISIBLE_MS);
    };

    return { update, complete, el: wrapper };
  }

  // Optimistic UI helpers
  async function withButtonLoading(button, labelText, fn) {
    const ctl = startSpinner(button, labelText);
    try {
      return await fn();
    } finally {
      ctl.done();
    }
  }

  function attachAutoHandlers() {
    // Apply standardized loading state for elements opted-in via data-loading="auto"
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-loading="auto"]');
      if (!btn || btn.tagName.toLowerCase() !== 'button') return;
      const label = btn.getAttribute('data-loading-label') || 'Working...';
      const ctl = startSpinner(btn, label);
      // Auto-restore after min time if no async handler manages it
      setTimeout(() => ctl.done(), MIN_VISIBLE_MS + 50);
    });
  }

  window.LoadingUI = {
    MIN_VISIBLE_MS,
    startSpinner,
    withButtonLoading,
    Skeleton: { show: showSkeleton },
    Progress: { create: createProgressBar },
    attachAutoHandlers
  };

  // Initialize auto handlers
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAutoHandlers);
  } else {
    attachAutoHandlers();
  }
})();

