/**
 * Simple client-side Rate Limiter with queue, concurrency, delays, and retries
 * - Limits concurrent requests
 * - Enforces minimum delay between starts
 * - Per-endpoint rate windows
 * - Exponential backoff with jitter on failures (429/5xx/403 rate-limited)
 * - Observes GitHub rate limit headers to avoid hitting hard caps
 */
(function(){
  class RateLimiter {
    constructor(config = {}) {
      this.maxConcurrent = config.maxConcurrent || 4;
      this.minDelayMs = config.minDelayMs || 700; // between starts
      this.endpointWindows = config.endpointWindows || {
        // Default window: 30 req per 30s
        default: { maxPerWindow: 30, windowMs: 30_000 }
      };

      this.queue = [];
      this.active = 0;
      this.lastStart = 0;
      this.endpointState = new Map(); // key -> { windowStart, count }

      // GitHub rate limit observation state
      this.githubState = {
        remaining: null,
        resetAt: null
      };
    }

    _now() { return Date.now(); }

    _getEndpointWindow(key) {
      return this.endpointWindows[key] || this.endpointWindows.default;
    }

    _canStartEndpoint(key) {
      const now = this._now();
      const win = this._getEndpointWindow(key);
      let state = this.endpointState.get(key);
      if (!state) {
        state = { windowStart: now, count: 0 };
        this.endpointState.set(key, state);
      }

      // Reset window if elapsed
      if (now - state.windowStart >= win.windowMs) {
        state.windowStart = now;
        state.count = 0;
      }

      return state.count < win.maxPerWindow;
    }

    _markStartEndpoint(key) {
      const state = this.endpointState.get(key) || { windowStart: this._now(), count: 0 };
      state.count += 1;
      this.endpointState.set(key, state);
    }

    async _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

    async _respectGlobalDelay() {
      const now = this._now();
      const sinceLast = now - this.lastStart;
      if (sinceLast < this.minDelayMs) {
        await this._wait(this.minDelayMs - sinceLast);
      }
      this.lastStart = this._now();
    }

    async _respectEndpointDelay(key) {
      if (this._canStartEndpoint(key)) return;
      const win = this._getEndpointWindow(key);
      const state = this.endpointState.get(key);
      const now = this._now();
      const waitMs = Math.max(0, (state.windowStart + win.windowMs) - now);
      await this._wait(waitMs);
      // reset window
      state.windowStart = this._now();
      state.count = 0;
      this.endpointState.set(key, state);
    }

    _isGithubRateLimited(resp, bodyText) {
      if (!resp) return false;
      if (resp.status === 429) return true;
      if (resp.status === 403 && ((bodyText || '').toLowerCase().includes('rate limit'))) return true;
      const remain = parseInt(resp.headers.get('x-ratelimit-remaining') || '-1', 10);
      if (!isNaN(remain) && remain <= 0) return true;
      return false;
    }

    _updateGithubState(resp) {
      if (!resp) return;
      const remaining = parseInt(resp.headers.get('x-ratelimit-remaining') || '-1', 10);
      const reset = parseInt(resp.headers.get('x-ratelimit-reset') || '0', 10);
      if (!isNaN(remaining)) this.githubState.remaining = remaining;
      if (!isNaN(reset) && reset > 0) this.githubState.resetAt = reset * 1000; // seconds -> ms
    }

    async _maybeWaitForGithubReset() {
      if (this.githubState.resetAt && this.githubState.remaining !== null && this.githubState.remaining <= 1) {
        const now = this._now();
        const waitMs = Math.max(0, this.githubState.resetAt - now);
        if (waitMs > 0) {
          console.warn(`⏳ Waiting ${Math.ceil(waitMs/1000)}s for GitHub rate limit reset`);
          await this._wait(waitMs + Math.floor(Math.random()*250));
        }
      }
    }

    async fetch(url, options = {}, meta = {}) {
      const endpointKey = meta.endpointKey || 'default';
      const retryCfg = Object.assign({ maxAttempts: 5, baseDelayMs: 1000, jitter: true }, meta.retry || {});

      return new Promise((resolve, reject) => {
        this.queue.push({ url, options, endpointKey, retryCfg, resolve, reject });
        this._drain();
      });
    }

    async _drain() {
      while (this.active < this.maxConcurrent && this.queue.length > 0) {
        const task = this.queue.shift();
        this.active += 1;
        this._runTask(task).finally(() => {
          this.active -= 1;
          // Schedule next drain on microtask
          Promise.resolve().then(() => this._drain());
        });
      }
    }

    async _runTask(task) {
      const { url, options, endpointKey, retryCfg, resolve, reject } = task;
      try {
        await this._respectGlobalDelay();
        await this._respectEndpointDelay(endpointKey);
        this._markStartEndpoint(endpointKey);
        await this._maybeWaitForGithubReset();

        const resp = await this._fetchWithRetry(url, options, retryCfg, endpointKey);
        resolve(resp);
      } catch (e) {
        reject(e);
      }
    }

    async _fetchWithRetry(url, options, retryCfg, endpointKey) {
      let attempt = 0;
      let lastErr;
      while (attempt < retryCfg.maxAttempts) {
        try {
          const resp = await fetch(url, options);
          const clone = resp.clone();
          let bodyText = '';
          try { bodyText = await clone.text(); } catch {}
          this._updateGithubState(resp);

          if (!resp.ok) {
            if (this._isGithubRateLimited(resp, bodyText) || resp.status >= 500) {
              throw new Error(`Rate-limited or server error: ${resp.status}`);
            }
            // non-retryable
            return resp;
          }
          return resp;
        } catch (err) {
          lastErr = err;
          attempt++;
          if (attempt >= retryCfg.maxAttempts) break;
          const delay = retryCfg.baseDelayMs * Math.pow(2, attempt - 1);
          const jitter = retryCfg.jitter ? Math.floor(Math.random() * (retryCfg.baseDelayMs / 2)) : 0;
          const totalDelay = delay + jitter;
          console.warn(`🔁 Retry ${attempt}/${retryCfg.maxAttempts} for ${endpointKey} in ${Math.ceil(totalDelay/1000)}s: ${err.message}`);
          await this._wait(totalDelay);
        }
      }
      throw new Error(`Rate limit/retry exhausted for ${endpointKey}: ${lastErr ? lastErr.message : 'unknown error'}`);
    }
  }

  // Initialize global instance
  const limiter = new RateLimiter({
    maxConcurrent: 4,
    minDelayMs: 700,
    endpointWindows: {
      default: { maxPerWindow: 30, windowMs: 30_000 },
      // Explicit window for backend proxy dispatches (Render proxy)
      // Keeps bursty client traffic under control and separates from GitHub keys
      proxy_dispatch: { maxPerWindow: 20, windowMs: 30_000 },
      github_dispatch: { maxPerWindow: 5, windowMs: 60_000 },
      github_issues: { maxPerWindow: 8, windowMs: 60_000 },
      github_contents: { maxPerWindow: 50, windowMs: 60_000 }
    }
  });

  if (typeof window !== 'undefined') {
    window.RateLimiter = RateLimiter;
    window.rateLimiter = limiter;
  }
})();
