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
                console.warn('⚠️ Workflow dispatch failed:', workflowError.message);

                // Final fallback to GitHub Issues
                console.log('📋 Attempting GitHub Issues fallback...');
                try {
                    return await this.submitRSVPViaIssue(payload);
                } catch (issueError) {
                    console.error('❌ All submission methods failed');
                    // Throw a comprehensive error
                    throw new Error(`RSVP submission failed: Direct (${directError.message}), Workflow (${workflowError.message}), Issues (${issueError.message})`);
                }
            }
        }
    }

    async submitRSVPDirectToFile(rsvpData) {
        console.log('Writing RSVP directly to GitHub file...');

        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available');
        }

        const eventId = rsvpData.eventId;
        const rsvpId = rsvpData.rsvpId;
        const filePath = `data/rsvps/${eventId}/${rsvpId}.json`;

        try {
            // Check if file already exists (for updates)
            let sha = null;
            try {
                const checkResponse = await window.safeFetchGitHub(
                    `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${filePath}`,
                    {
                        headers: {
                            'Authorization': 'token ' + token,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    },
                    'Check existing RSVP file'
                );

                if (checkResponse.ok) {
                    const fileData = await checkResponse.json();
                    sha = fileData.sha;
                    console.log('📝 Updating existing RSVP file');
                } else {
                    console.log('📄 Creating new RSVP file');
                }
            } catch (e) {
                console.log('📄 Creating new RSVP file');
            }

            // Prepare file content
            const content = btoa(JSON.stringify(rsvpData, null, 2));
            const commitMessage = rsvpData.isUpdate
                ? `Update RSVP: ${rsvpData.name} - ${eventId}`
                : `New RSVP: ${rsvpData.name} - ${eventId}`;

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
                `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${filePath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'token ' + token,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                },
                'Save RSVP file'
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub file write failed:', errorData);
                throw new Error(`GitHub file write failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }

            const result = await response.json();
            console.log('✅ RSVP written to GitHub file:', filePath);

            return {
                success: true,
                method: 'direct_file_write',
                filePath: filePath,
                commitSha: result.commit?.sha
            };

        } catch (error) {
            console.error('Failed to write RSVP file:', error);
            throw error;
        }
    }

    async submitRSVPViaIssue(rsvpData) {
        console.log('Submitting RSVP via GitHub Issue...');

        const token = this.getToken();

        if (!token) {
            throw new Error('GitHub token not available');
        }

        // Format RSVP data for issue body
        const issueTitle = `RSVP: ${rsvpData.name} - ${rsvpData.attending ? 'Attending' : 'Not Attending'}`;

        // Build military info section without nested template literals
        let militaryInfo = '';
        if (rsvpData.rank || rsvpData.unit || rsvpData.branch) {
            militaryInfo += '### Military Information\n';
            if (rsvpData.rank) militaryInfo += `**Rank:** ${rsvpData.rank}\n`;
            if (rsvpData.unit) militaryInfo += `**Unit:** ${rsvpData.unit}\n`;
            if (rsvpData.branch) militaryInfo += `**Branch:** ${rsvpData.branch}\n`;
        }

        const reasonBlock = rsvpData.reason ? `**Reason:** ${rsvpData.reason}\n\n` : '';
        const allergyBlock = rsvpData.allergyDetails ? `**Allergy Details:** ${rsvpData.allergyDetails}\n\n` : '';

        const issueBody = `
## RSVP Submission

**Event ID:** ${rsvpData.eventId}
**RSVP ID:** ${rsvpData.rsvpId}
**Name:** ${rsvpData.name}
**Email:** ${rsvpData.email}
**Phone:** ${rsvpData.phone || 'Not provided'}
**Attending:** ${rsvpData.attending ? '✅ Yes' : '❌ No'}
**Guest Count:** ${rsvpData.guestCount}

${militaryInfo}

${reasonBlock}${allergyBlock}
---
**Timestamp:** ${new Date(rsvpData.timestamp).toISOString()}
**Validation Hash:** ${rsvpData.validationHash}
**CSRF Token:** ${(window.csrf && window.csrf.getToken && window.csrf.getToken()) || ''}
**Submission Method:** github_issue_fallback

\`\`\`json
${JSON.stringify(rsvpData, null, 2)}
\`\`\`
`;

        try {
            const response = await (window.rateLimiter ? window.rateLimiter.fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: issueTitle,
                    body: issueBody,
                    labels: ['rsvp', 'automated', rsvpData.attending ? 'attending' : 'not-attending']
                })
            }, { endpointKey: 'github_issues', retry: { maxAttempts: 5, baseDelayMs: 1000, jitter: true } }) : fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: issueTitle,
                    body: issueBody,
                    labels: ['rsvp', 'automated', rsvpData.attending ? 'attending' : 'not-attending']
                })
            }));

            const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '-1', 10);
            if (!isNaN(remaining) && remaining <= 0) {
                this.advanceToken();
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub Issue creation failed:', errorData);
                throw new Error(`GitHub Issue creation failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }

            const issueData = await response.json();
            console.log('✅ RSVP submitted via GitHub Issue:', issueData.number);

            return {
                success: true,
                method: 'github_issue',
                issueNumber: issueData.number,
                issueUrl: issueData.html_url
            };

        } catch (error) {
            console.error('Failed to submit RSVP via GitHub Issue:', error);
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
