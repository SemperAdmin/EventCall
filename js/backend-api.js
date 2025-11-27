class BackendAPI {
    constructor() {
        this.owner = window.GITHUB_CONFIG?.owner || 'SemperAdmin';
        this.repo = window.GITHUB_CONFIG?.repo || 'EventCall';
        this.apiBase = 'https://api.github.com';
        this.tokenIndex = parseInt(sessionStorage.getItem('github_token_index') || '0', 10);
        this.proxyCsrf = null; // { clientId, token, expires }
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
    getApiUrl(path) {
        const cfg = window.BACKEND_CONFIG || {};
        const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
        if (!base) {
            console.error('Backend dispatchURL not configured');
            // Fallback to relative path, which might work if on the same origin
            return path;
        }
        return `${base}${path}`;
    }

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
        if (!payload.csrfToken) {
            const err = new Error('Missing CSRF token');
            if (window.errorHandler) window.errorHandler.handleError(err, 'Security-CSRF', { form: 'rsvp' });
        }

        // Try direct file write first (most reliable), then fallback to workflow/issue
        try {
            console.log('💾 Attempting direct RSVP file write to GitHub...');
            return await this.submitRSVPDirectToFile(payload);
        } catch (directError) {
            console.warn('⚠️ Direct file write failed:', directError.message);

            // Try workflow dispatch as fallback
            try {
                console.log('🔄 Attempting workflow dispatch...');
                return await this.triggerWorkflow('submit_rsvp', payload);
            } catch (workflowError) {
                console.error('❌ All submission methods failed');
                // Throw a comprehensive error
                throw new Error(`RSVP submission failed: Direct (${directError.message}), Workflow (${workflowError.message})`);
            }
        }
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
        console.log('Creating event via workflow...');

        // Get manager token and info
        const token = window.GITHUB_CONFIG && window.GITHUB_CONFIG.token ? window.GITHUB_CONFIG.token : null;
        const managerEmail = window.managerAuth && window.managerAuth.getCurrentManager()
            ? window.managerAuth.getCurrentManager().email
            : '';

        // Prefer username from new auth
        const user = window.userAuth && window.userAuth.isAuthenticated() ? window.userAuth.getCurrentUser() : null;
        const creatorUsername = user?.username || (eventData.createdBy ? String(eventData.createdBy).trim() : '');
        const creatorName = eventData.createdByName || user?.name || user?.username || 'unknown';

        if (!token) {
            throw new Error('Manager token required to create event');
        }

        // Prepare event payload for workflow
        const payload = {
        id: eventData.id,
        title: String(eventData.title || '').trim(),
        description: String(eventData.description || '').trim().substring(0, 500),
        date: String(eventData.date || '').trim(),
        time: String(eventData.time || '').trim(),
        location: String(eventData.location || '').trim().substring(0, 200),
        coverImage: eventData.coverImage ? 'yes' : 'no',
        askReason: Boolean(eventData.askReason),
        allowGuests: Boolean(eventData.allowGuests),
        requiresMealChoice: Boolean(eventData.requiresMealChoice),
        customQuestionsCount: (eventData.customQuestions || []).length,
        managerEmail: managerEmail || 'unknown',
        createdBy: creatorUsername || managerEmail || 'unknown',
        createdByUsername: creatorUsername || '',
        createdByName: creatorName,
        created: eventData.created || Date.now(),
        status: 'active',
        csrfToken: (window.csrf && window.csrf.getToken && window.csrf.getToken()) || ''
    };

        if (!payload.title || !payload.date || !payload.time) {
            throw new Error('Missing required event fields');
        }

        return await this.triggerWorkflow('create_event', payload);
    }

    async updateUserProfile(userData) {
        console.log('Updating user profile in backend...');

        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available');
        }

        const username = userData.username;
        const filePath = `data/users/${username}.json`;

        try {
            // Get existing user file
            const checkResponse = await window.safeFetchGitHub(
                `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${filePath}`,
                {
                    headers: {
                        'Authorization': 'token ' + token,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                },
                'Get existing user profile'
            );

            if (!checkResponse.ok) {
                throw new Error(`User file not found: ${username}`);
            }

            const fileData = await checkResponse.json();
            const sha = fileData.sha;

            // Decode existing content
            const existingContent = JSON.parse(atob(fileData.content));

            // Merge with new data, preserving critical fields
            const updatedUser = {
                ...existingContent,
                name: userData.name || existingContent.name,
                email: userData.email || existingContent.email || '',
                branch: userData.branch || existingContent.branch || '',
                rank: userData.rank || existingContent.rank || '',
                lastUpdated: new Date().toISOString()
            };

            // Encode updated content
            const content = btoa(JSON.stringify(updatedUser, null, 2));
            const commitMessage = `Update profile for ${username}`;

            // Update file
            const response = await window.safeFetchGitHub(
                `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${filePath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'token ' + token,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: commitMessage,
                        content: content,
                        sha: sha,
                        branch: 'main'
                    })
                },
                'Update user profile'
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('User profile update failed:', errorData);
                throw new Error(`User profile update failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }

            const result = await response.json();
            console.log('✅ User profile updated in backend:', filePath);

            return {
                success: true,
                method: 'direct_file_update',
                filePath: filePath,
                commitSha: result.commit?.sha,
                user: updatedUser
            };

        } catch (error) {
            console.error('Failed to update user profile:', error);
            throw error;
        }
    }
}

if (typeof window !== 'undefined') {
    window.BackendAPI = new BackendAPI();
    console.log('Backend API loaded (Secure)');
}
