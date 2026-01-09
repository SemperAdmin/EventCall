class BackendAPI {
    constructor() {
        this.owner = window.GITHUB_CONFIG?.owner || 'SemperAdmin';
        this.repo = window.GITHUB_CONFIG?.repo || 'EventCall';
        this.apiBase = 'https://api.github.com';
        this.tokenIndex = parseInt(sessionStorage.getItem('github_token_index') || '0', 10);
        this.proxyCsrf = null; // { clientId, token, expires }
    }

    /**
     * Centralized fetch wrapper with exponential backoff
     * Uses the rate limiter when available, falls back to plain fetch
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @param {Object} meta - Metadata for rate limiter (endpointKey, retry config)
     * @returns {Promise<Response>}
     */
    async _fetch(url, options = {}, meta = {}) {
        const defaultRetry = {
            maxAttempts: 4,
            baseDelayMs: 1000,
            jitter: true
        };
        const retryCfg = { ...defaultRetry, ...(meta.retry || {}) };
        const endpointKey = meta.endpointKey || 'backend_api';

        // Use rate limiter if available
        if (window.rateLimiter && typeof window.rateLimiter.fetch === 'function') {
            return window.rateLimiter.fetch(url, options, {
                endpointKey,
                retry: retryCfg
            });
        }

        // Fallback: plain fetch with manual exponential backoff
        let lastErr;
        for (let attempt = 0; attempt < retryCfg.maxAttempts; attempt++) {
            try {
                const resp = await fetch(url, options);

                // Retry on server errors (5xx) or rate limits (429)
                if (resp.status >= 500 || resp.status === 429) {
                    throw new Error(`Server error: ${resp.status}`);
                }

                return resp;
            } catch (err) {
                lastErr = err;
                if (attempt < retryCfg.maxAttempts - 1) {
                    // Exponential backoff: 1s, 2s, 4s, 8s...
                    const delay = retryCfg.baseDelayMs * Math.pow(2, attempt);
                    const jitter = retryCfg.jitter ? Math.random() * (retryCfg.baseDelayMs / 2) : 0;
                    console.warn(`🔁 Retry ${attempt + 1}/${retryCfg.maxAttempts} in ${Math.ceil((delay + jitter) / 1000)}s: ${err.message}`);
                    await new Promise(r => setTimeout(r, delay + jitter));
                }
            }
        }
        throw lastErr || new Error('Request failed after retries');
    }

    shouldUseProxy() {
        try {
            const cfg = window.BACKEND_CONFIG || {};
            const hasProxy = typeof cfg.dispatchURL === 'string' && cfg.dispatchURL.length > 0;
            const isGithubPages = (window.location.hostname || '').endsWith('github.io');
            const forceProxy = !!cfg.useProxyOnGithubPages;
            return hasProxy && (isGithubPages || forceProxy);
        } catch (_) {
            return false;
        }
    }

    async getProxyCsrf() {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Proxy dispatchURL not configured');
        const current = this.proxyCsrf;
        if (current && current.expires && Date.now() < (Number(current.expires) - 5000)) {
            return current;
        }
        const res = await fetch(base + '/api/csrf', { method: 'GET', credentials: 'omit' });
        if (!res.ok) throw new Error('Failed to obtain CSRF handshake from proxy');
        const data = await res.json();
        this.proxyCsrf = { clientId: data.clientId, token: data.token, expires: data.expires };
        return this.proxyCsrf;
    }

    getToken() {
        const cfg = window.GITHUB_CONFIG || {};

        // Check token expiration
        if (cfg.tokenExpiry) {
            const expiryTime = typeof cfg.tokenExpiry === 'number' ? cfg.tokenExpiry : Date.parse(cfg.tokenExpiry);
            if (!isNaN(expiryTime) && Date.now() > expiryTime) {
                console.error('❌ GitHub token expired');
                // Trigger re-authentication if handler exists
                if (window.handleTokenExpiration) {
                    window.handleTokenExpiration();
                }
                throw new Error('GitHub token expired - please re-authenticate');
            }
        }

        const tokens = Array.isArray(cfg.tokens) ? cfg.tokens.filter(t => !!t) : [];
        if (tokens.length > 0) {
            const tok = tokens[this.tokenIndex % tokens.length];
            return tok;
        }
        return cfg.token || null;
    }

    advanceToken() {
        const cfg = window.GITHUB_CONFIG || {};
        const tokens = Array.isArray(cfg.tokens) ? cfg.tokens.filter(t => !!t) : [];
        if (tokens.length > 1) {
            this.tokenIndex = (this.tokenIndex + 1) % tokens.length;
            sessionStorage.setItem('github_token_index', String(this.tokenIndex));
            console.warn('🔄 Rotated GitHub token due to rate limiting');
        }
    }

    async triggerWorkflow(eventType, payload) {
        const useProxy = this.shouldUseProxy();
        const url = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/dispatches';

        // Skip external dispatch in local development unless forced via config
        // Treat common local hosts as dev to avoid external dispatches unless forced
        const isLocalDev = (function () {
            try {
                const host = window.location.hostname;
                return ['localhost', '127.0.0.1', '0.0.0.0'].includes(host);
            } catch (_) {
                return false;
            }
        })();
        const forceBackendInDev = !!(window.AUTH_CONFIG && window.AUTH_CONFIG.forceBackendInDev);
        if (isLocalDev && !forceBackendInDev) {
            console.warn('🧪 Local dev detected: skipping GitHub workflow dispatch (set AUTH_CONFIG.forceBackendInDev=true to enable)');
            return { success: true, local: true };
        }

        // Get token (with optional rotation support) only for direct GitHub calls
        const token = useProxy ? null : this.getToken();

        if (!useProxy && !token) {
            throw new Error('GitHub token not available for workflow trigger');
        }

        try {
            // CSRF origin check (client-side preflight)
            if (window.csrf && typeof window.csrf.originAllowed === 'function') {
                if (!window.csrf.originAllowed()) {
                    const err = new Error('Origin not allowed by SECURITY_CONFIG');
                    if (window.errorHandler) window.errorHandler.handleError(err, 'Security-CSRF', { origin: window.location.origin });
                    throw err;
                }
            }

            const csrfToken = (window.csrf && window.csrf.getToken && window.csrf.getToken()) || '';

            console.log('Triggering workflow:', eventType);
            console.log('Payload size:', JSON.stringify(payload).length, 'bytes');

            // Wrap payload under a single key to satisfy GitHub's client_payload limits
            const requestBody = {
                event_type: eventType,
                client_payload: {
                    data: { ...payload, csrfToken }, // embed CSRF token
                    sentAt: Date.now(),       // optional meta
                    source: 'EventCall-App',  // optional meta
                    origin: window.location.origin,
                    referer: document.referrer || ''
                }
            };

            let response;
            if (useProxy) {
                const cfg = window.BACKEND_CONFIG || {};
                const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
                const csrf = await this.getProxyCsrf();
                const proxyOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Client': csrf.clientId,
                        'X-CSRF-Token': csrf.token,
                        'X-CSRF-Expires': String(csrf.expires)
                    },
                    body: JSON.stringify(requestBody)
                };
                response = await (window.rateLimiter
                    ? window.rateLimiter.fetch(base + '/api/dispatch', proxyOptions, { endpointKey: 'proxy_dispatch', retry: { maxAttempts: 5, baseDelayMs: 1000, jitter: true } })
                    : fetch(base + '/api/dispatch', proxyOptions));
            } else {
                response = await (window.rateLimiter ? window.rateLimiter.fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'token ' + token,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(requestBody)
                }, { endpointKey: 'github_dispatch', retry: { maxAttempts: 5, baseDelayMs: 1000, jitter: true } }) : fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'token ' + token,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(requestBody)
                }));
            }

            // Rotate token if rate limit is exhausted (only when hitting GitHub directly)
            if (!useProxy) {
                const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '-1', 10);
                if (!isNaN(remaining) && remaining <= 0) {
                    this.advanceToken();
                }
            }

            if (!response.ok) {
                // Try to get error details from response
                let errorMessage = 'Workflow dispatch failed: ' + response.status;
                let shouldFallbackToIssues = false;

                try {
                    const errorData = await response.json();
                    console.error('GitHub API Error Details:', errorData);
                    errorMessage = errorData.message || errorMessage;
                    if (errorData.errors) {
                        console.error('Validation Errors:', errorData.errors);
                        errorMessage += ' - ' + JSON.stringify(errorData.errors);
                    }

                    // Detect specific 404 cases that should fallback to Issues
                    if (response.status === 404) {
                        if (errorData.message && errorData.message.includes('Not Found')) {
                            console.warn('⚠️ Repository dispatch endpoint not found - workflow may not be enabled');
                            shouldFallbackToIssues = true;
                            errorMessage = 'Workflow not found (404) - attempting fallback to GitHub Issues';
                        }
                    }
                } catch (parseError) {
                    console.error('Could not parse error response');
                    // If we can't parse and got 404, assume workflow issue
                    if (response.status === 404) {
                        shouldFallbackToIssues = true;
                        errorMessage = 'Workflow dispatch failed (404) - attempting fallback';
                    }
                }

                // For 404 errors, mark for fallback instead of throwing immediately
                if (shouldFallbackToIssues) {
                    const fallbackError = new Error(errorMessage);
                    fallbackError.shouldFallback = true;
                    fallbackError.status = 404;
                    throw fallbackError;
                }

                throw new Error(errorMessage);
            }

            console.log('✅ Workflow triggered successfully');
            return { success: true };

        } catch (error) {
            console.error('Workflow trigger error:', error);
            throw error;
        }
    }

    /**
     * PERFORMANCE: Direct authentication (bypasses GitHub Actions)
     * Reduces login time from 67s to 200-500ms (99% faster!)
     * @param {string} action - 'login_user' or 'register_user'
     * @param {Object} credentials - { username, password, name, email, etc. }
     * @returns {Promise<Object>} - Authentication response
     */
    async authenticateDirect(action, credentials) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');

        if (!base) {
            throw new Error('Backend not configured - cannot use direct authentication');
        }

        const endpoint = action === 'register_user' ? '/api/auth/register' : '/api/auth/login';
        const url = base + endpoint;

        console.log(`🚀 Using direct authentication: ${endpoint}`);

        const startTime = Date.now();
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            if (!response.ok) {
                const error = await response.json();

                // Handle rate limiting (429) with user-friendly message
                if (response.status === 429) {
                    const retryAfter = error.retryAfter || parseInt(response.headers.get('Retry-After') || '900', 10);
                    const minutes = Math.ceil(retryAfter / 60);
                    const rateLimitError = new Error(
                        `Too many attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`
                    );
                    rateLimitError.isRateLimited = true;
                    rateLimitError.retryAfter = retryAfter;
                    throw rateLimitError;
                }

                throw new Error(error.error || 'Authentication failed');
            }

            const result = await response.json();
            const duration = Date.now() - startTime;
            console.log(`✅ Direct authentication successful in ${duration}ms`);
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Direct authentication failed after ${duration}ms:`, error);
            throw error;
        }
    }

    async submitRSVP(rsvpData) {
        console.log('Submitting RSVP with data:', rsvpData);

        // Pass through all RSVP data - the backend/GitHub Action will handle sanitization
        // This ensures we don't lose any fields during submission
        const payload = {
            eventId: String(rsvpData.eventId || '').trim(),
            rsvpId: rsvpData.rsvpId || '',
            name: String(rsvpData.name || '').trim(),
            email: String(rsvpData.email || '').trim().toLowerCase(),
            phone: String(rsvpData.phone || '').trim(),
            attending: rsvpData.attending,
            guestCount: parseInt(rsvpData.guestCount, 10) || 0,
            reason: String(rsvpData.reason || '').trim(),
            rank: String(rsvpData.rank || '').trim(),
            unit: String(rsvpData.unit || '').trim(),
            branch: String(rsvpData.branch || '').trim(),
            dietaryRestrictions: rsvpData.dietaryRestrictions || [],
            allergyDetails: String(rsvpData.allergyDetails || '').trim(),
            customAnswers: rsvpData.customAnswers || {},
            timestamp: rsvpData.timestamp || Date.now(),
            validationHash: rsvpData.validationHash || '',
            submissionMethod: rsvpData.submissionMethod || 'secure_backend',
            userAgent: rsvpData.userAgent || '',
            checkInToken: rsvpData.checkInToken || '',
            editToken: rsvpData.editToken || '',
            isUpdate: rsvpData.isUpdate || false,
            lastModified: rsvpData.lastModified || null,
            csrfToken: (window.csrf && window.csrf.getToken && window.csrf.getToken()) || '',
            captchaToken: rsvpData.captchaToken || '',
            captchaAction: rsvpData.captchaAction || ''
        };

        if (!payload.eventId || !payload.name || !payload.email) {
            throw new Error('Missing required fields: eventId, name, or email');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
            throw new Error('Invalid email format');
        }

        console.log('Submitting RSVP payload with guestCount:', payload.guestCount);
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const url = base + '/api/rsvps';
        const resp = await this._fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_id: payload.eventId,
                name: payload.name,
                email: payload.email,
                phone: payload.phone,
                attending: payload.attending,
                guest_count: payload.guestCount,
                reason: payload.reason,
                rank: payload.rank,
                unit: payload.unit,
                branch: payload.branch,
                dietary_restrictions: payload.dietaryRestrictions,
                allergy_details: payload.allergyDetails,
                custom_answers: payload.customAnswers,
                check_in_token: payload.checkInToken,
                edit_token: payload.editToken
            })
        }, { endpointKey: 'submit_rsvp' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'RSVP submission failed');
        }
        return await resp.json();
    }

    async submitRSVPDirectToFile(rsvpData) {
        console.log('Writing RSVP directly to EventCall-Data repository...');

        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available');
        }

        const eventId = rsvpData.eventId;
        const dataRepo = window.GITHUB_CONFIG?.dataRepo || 'EventCall-Data';
        const filePath = `rsvps/${eventId}.json`;
        const fileUrl = `${this.apiBase}/repos/${this.owner}/${dataRepo}/contents/${filePath}`;

        try {
            // Try to get existing file
            let existingRSVPs = [];
            let sha = null;

            try {
                const checkResponse = await window.safeFetchGitHub(
                    fileUrl,
                    {
                        headers: {
                            'Authorization': 'token ' + token,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    },
                    'Check existing RSVP file in EventCall-Data'
                );

                if (checkResponse.ok) {
                    const fileData = await checkResponse.json();
                    sha = fileData.sha;

                    // Decode existing content
                    const decodedContent = atob(fileData.content);
                    const parsedContent = JSON.parse(decodedContent);

                    // Ensure it's an array
                    existingRSVPs = Array.isArray(parsedContent) ? parsedContent : [parsedContent];
                    console.log(`📝 Found existing file with ${existingRSVPs.length} RSVPs`);
                }
            } catch (e) {
                console.log('📄 No existing file found, will create new');
            }

            // Check if this is an update (same rsvpId exists)
            const existingIndex = existingRSVPs.findIndex(r => r.rsvpId === rsvpData.rsvpId);

            if (existingIndex >= 0) {
                // Update existing RSVP
                existingRSVPs[existingIndex] = rsvpData;
                console.log(`🔄 Updating existing RSVP at index ${existingIndex}`);
            } else {
                // Add new RSVP
                existingRSVPs.push(rsvpData);
                console.log(`➕ Adding new RSVP (total: ${existingRSVPs.length})`);
            }

            // Encode updated array
            const content = btoa(JSON.stringify(existingRSVPs, null, 2));
            const commitMessage = existingIndex >= 0
                ? `Update RSVP: ${rsvpData.name} for event ${eventId}`
                : `Add RSVP: ${rsvpData.name} for event ${eventId}`;

            // Create or update file
            const body = {
                message: commitMessage,
                content: content,
                branch: 'main'
            };

            if (sha) {
                body.sha = sha;
            }

            const response = await window.safeFetchGitHub(
                fileUrl,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'token ' + token,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                },
                'Save RSVP to EventCall-Data'
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub file write failed:', errorData);
                throw new Error(`GitHub file write failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }

            const result = await response.json();
            console.log('✅ RSVP saved to EventCall-Data:', filePath);

            return {
                success: true,
                method: 'direct_file_write',
                repository: dataRepo,
                filePath: filePath,
                commitSha: result.commit?.sha,
                totalRSVPs: existingRSVPs.length
            };

        } catch (error) {
            console.error('Failed to write RSVP to EventCall-Data:', error);
            throw error;
        }
    }

    async createEvent(eventData) {
        console.log('Creating event via backend...');

        // Get manager token and info
        const token = window.GITHUB_CONFIG && window.GITHUB_CONFIG.token ? window.GITHUB_CONFIG.token : null;
        const managerEmail = window.managerAuth && window.managerAuth.getCurrentManager()
            ? window.managerAuth.getCurrentManager().email
            : '';

        // Prefer username from new auth
        const user = window.userAuth && window.userAuth.isAuthenticated() ? window.userAuth.getCurrentUser() : null;
        const creatorUsername = user?.username || (eventData.createdBy ? String(eventData.createdBy).trim() : '');
        const creatorName = eventData.createdByName || user?.name || user?.username || 'unknown';

        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');

        const payload = {
            title: String(eventData.title || '').trim(),
            description: String(eventData.description || '').trim().substring(0, 500),
            date: String(eventData.date || '').trim(),
            time: String(eventData.time || '').trim(),
            location: String(eventData.location || '').trim().substring(0, 200),
            cover_image_url: (eventData.coverImage || eventData.coverImageUrl || ''),
            created_by: (user && user.id) ? user.id : (eventData.createdByUserId || null),
            status: 'active',
            ask_reason: !!eventData.askReason,
            allow_guests: !!eventData.allowGuests,
            requires_meal_choice: !!eventData.requiresMealChoice,
            custom_questions: Array.isArray(eventData.customQuestions) ? eventData.customQuestions : [],
            event_details: typeof eventData.eventDetails === 'object' && eventData.eventDetails !== null ? eventData.eventDetails : {},
            seating_chart: typeof eventData.seatingChart === 'object' && eventData.seatingChart !== null ? eventData.seatingChart : null,
            invite_template: eventData.inviteTemplate ?? eventData.invite_template ?? 'envelope'
        };

        if (!payload.title || !payload.date || !payload.time) {
            throw new Error('Missing required event fields');
        }

        const url = base + '/api/events';
        const resp = await this._fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, { endpointKey: 'create_event' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Event creation failed');
        }
        return await resp.json();
    }

    async uploadImage(file, fileName, options = {}) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const contentBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const s = String(reader.result || '');
                const idx = s.indexOf(',');
                resolve(idx >= 0 ? s.slice(idx + 1) : s);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const url = base + '/api/images/upload';
        const currentUser = (window.userAuth && window.userAuth.getCurrentUser && window.userAuth.getCurrentUser()) || window.userAuth?.currentUser || null;
        const payload = {
            file_name: String(fileName || '').trim(),
            content_base64: contentBase64,
            event_id: options.eventId || null,
            caption: options.caption || '',
            tags: Array.isArray(options.tags) ? options.tags : [],
            uploader_username: currentUser?.username || '',
            uploader_id: currentUser?.id || ''
        };
        const resp = await this._fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, { endpointKey: 'upload_image' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Image upload failed');
        }
        const data = await resp.json();
        return data;
    }

    async getEventPhotos(eventId) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const url = base + '/api/events/' + encodeURIComponent(String(eventId)) + '/photos';
        const resp = await this._fetch(url, { method: 'GET' }, { endpointKey: 'load_photos' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to load photos');
        }
        return await resp.json();
    }

    async deletePhoto(storagePath) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const url = base + '/api/photos';
        const resp = await this._fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storagePath: String(storagePath) })
        }, { endpointKey: 'delete_photo' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to delete photo');
        }
        return await resp.json();
    }

    async loadEvents(params = {}) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const q = new URLSearchParams();
        if (params.created_by) q.set('created_by', params.created_by);
        if (params.unassigned === true) q.set('unassigned', 'true');
        if (params.status) q.set('status', params.status);
        const url = base + '/api/events' + (q.toString() ? ('?' + q.toString()) : '');
        const resp = await this._fetch(url, { method: 'GET' }, { endpointKey: 'load_events' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to load events');
        }
        const data = await resp.json();
        const list = Array.isArray(data.events) ? data.events : [];
        const out = {};
        for (const e of list) {
            const id = String(e.id ?? e.eventId ?? '');
            if (!id) continue;
            // FIX: Check multiple sources for cover image URL
            // Server stores in event_details._cover_image_url and returns both cover_image_url and coverImage
            const eventDetails = e.event_details || {};
            const coverImage = e.cover_image_url || e.coverImage || eventDetails._cover_image_url || '';
            if (coverImage || eventDetails._cover_image_url) {
                console.log(`[loadEvents] Event ${id}: cover=${coverImage ? 'YES' : 'NO'}, from: cover_image_url=${e.cover_image_url ? 'YES' : 'NO'}, coverImage=${e.coverImage ? 'YES' : 'NO'}, _cover_image_url=${eventDetails._cover_image_url ? 'YES' : 'NO'}`);
            }
            out[id] = {
                id,
                title: String(e.title || '').trim(),
                date: String(e.date || '').trim(),
                time: String(e.time || '').trim(),
                location: String(e.location || '').trim(),
                description: String(e.description || '').trim(),
                coverImage: coverImage,
                status: String(e.status || 'active').trim(),
                createdBy: e.created_by || '',
                created: e.created_at || Date.now(),
                askReason: !!(e.ask_reason ?? e.askReason),
                allowGuests: !!e.allow_guests,
                requiresMealChoice: !!e.requires_meal_choice,
                customQuestions: e.custom_questions || [],
                eventDetails: eventDetails,
                seatingChart: e.seating_chart || null
            };
        }
        return out;
    }

    async loadUsersByIds(ids = []) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const q = new URLSearchParams();
        if (Array.isArray(ids) && ids.length > 0) q.set('ids', ids.join(','));
        const url = base + '/api/users' + (q.toString() ? ('?' + q.toString()) : '');
        const resp = await this._fetch(url, { method: 'GET' }, { endpointKey: 'load_users' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to load users');
        }
        const data = await resp.json();
        const list = Array.isArray(data.users) ? data.users : [];
        const map = {};
        for (const u of list) {
            const id = String(u.id || '');
            if (!id) continue;
            map[id] = {
                id,
                username: String(u.username || '').trim(),
                name: String(u.name || '').trim(),
                email: String(u.email || '').trim().toLowerCase()
            };
        }
        return map;
    }

    async loadUserByUsername(username) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const uname = String(username || '').trim().toLowerCase();
        if (!uname) throw new Error('Username required');
        const url = base + '/api/users/by-username/' + encodeURIComponent(uname);
        const resp = await this._fetch(url, { method: 'GET' }, { endpointKey: 'load_users' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to load user');
        }
        const data = await resp.json();
        const u = data.user;
        if (!u) return null;
        return {
            id: String(u.id || ''),
            username: String(u.username || '').trim(),
            name: String(u.name || '').trim(),
            email: String(u.email || '').trim().toLowerCase()
        };
    }

    async loadResponses(params = {}) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const q = new URLSearchParams();
        if (params.event_id) q.set('event_id', params.event_id);
        if (Array.isArray(params.event_ids) && params.event_ids.length > 0) {
            q.set('event_ids', params.event_ids.join(','));
        }
        const url = base + '/api/rsvps' + (q.toString() ? ('?' + q.toString()) : '');
        const resp = await this._fetch(url, { method: 'GET' }, { endpointKey: 'load_rsvps' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to load RSVPs');
        }
        const data = await resp.json();
        const list = Array.isArray(data.rsvps) ? data.rsvps : [];
        const out = {};
        for (const r of list) {
            const eid = String(r.event_id ?? r.eventId ?? '');
            if (!eid) continue;
            if (!out[eid]) out[eid] = [];
            out[eid].push({
                rsvpId: String(r.id ?? r.rsvpId ?? ''),
                eventId: eid,
                name: String(r.name || '').trim(),
                email: String(r.email || '').trim().toLowerCase(),
                phone: String(r.phone || '').trim(),
                attending: !!r.attending,
                guestCount: Number(r.guest_count ?? r.guestCount ?? 0),
                reason: String(r.reason || '').trim(),
                rank: String(r.rank || '').trim(),
                unit: String(r.unit || '').trim(),
                branch: String(r.branch || '').trim(),
                dietaryRestrictions: Array.isArray(r.dietary_restrictions ?? r.dietaryRestrictions) ? (r.dietary_restrictions ?? r.dietaryRestrictions) : [],
                allergyDetails: String(r.allergy_details ?? r.allergyDetails ?? '').trim(),
                customAnswers: typeof (r.custom_answers ?? r.customAnswers) === 'object' && (r.custom_answers ?? r.customAnswers) !== null ? (r.custom_answers ?? r.customAnswers) : {},
                checkInToken: String(r.check_in_token ?? r.checkInToken ?? '').trim(),
                editToken: String(r.edit_token ?? r.editToken ?? '').trim(),
                timestamp: r.created_at || Date.now()
            });
        }
        return out;
    }

    async updateEvent(eventId, update) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const url = base + '/api/events/' + encodeURIComponent(String(eventId));
        // Only include cover_image_url if explicitly provided (don't send empty string which would overwrite existing)
        const coverUrl = update.coverImageUrl || update.coverImage;
        const payload = {
            title: update.title,
            date: update.date,
            time: update.time,
            location: update.location,
            description: update.description,
            cover_image_url: coverUrl || undefined, // undefined = don't update, preserves existing value
            status: update.status,
            allow_guests: update.allowGuests,
            requires_meal_choice: update.requiresMealChoice,
            custom_questions: Array.isArray(update.customQuestions) ? update.customQuestions : undefined,
            event_details: typeof update.eventDetails === 'object' && update.eventDetails !== null ? update.eventDetails : undefined,
            seating_chart: typeof update.seatingChart === 'object' && update.seatingChart !== null ? update.seatingChart : undefined,
            created_by: update.created_by,
            invite_template: update.inviteTemplate ?? update.invite_template ?? undefined
        };
        const resp = await this._fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, { endpointKey: 'update_event' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to update event');
        }
        return await resp.json();
    }

    async deleteEvent(eventId) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const url = base + '/api/events/' + encodeURIComponent(String(eventId));
        const resp = await this._fetch(url, { method: 'DELETE' }, { endpointKey: 'delete_event' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to delete event');
        }
        return await resp.json();
    }

    async updateUserProfile(userData) {
        console.log('Updating user profile in Supabase...');
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) {
            throw new Error('Backend not configured');
        }
        const url = base + '/api/users/update-profile';
        const resp = await this._fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: userData.username,
                name: userData.name,
                email: userData.email,
                branch: userData.branch,
                rank: userData.rank
            })
        }, { endpointKey: 'update_profile' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to update profile');
        }
        const data = await resp.json();
        return { success: true, user: data.user };
    }

    /**
     * Delete an RSVP by ID
     * @param {string} rsvpId - RSVP ID to delete
     * @returns {Promise<Object>}
     */
    async deleteRsvp(rsvpId) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) throw new Error('Backend not configured');
        const url = base + '/api/rsvps/' + encodeURIComponent(String(rsvpId));
        const resp = await this._fetch(url, { method: 'DELETE' }, { endpointKey: 'delete_rsvp' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to delete RSVP');
        }
        return await resp.json();
    }
}

if (typeof window !== 'undefined') {
    window.BackendAPI = new BackendAPI();
    console.log('Backend API loaded (Secure)');
}
