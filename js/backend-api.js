class BackendAPI {
    constructor() {
        this.owner = 'SemperAdmin';
        this.repo = 'EventCall';
        this.apiBase = 'https://api.github.com';
        this.tokenIndex = parseInt(sessionStorage.getItem('github_token_index') || '0', 10);
    }

    getToken() {
        const cfg = window.GITHUB_CONFIG || {};
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
        const url = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/dispatches';

        // Skip external dispatch in local development unless forced via config
        const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const forceBackendInDev = !!(window.AUTH_CONFIG && window.AUTH_CONFIG.forceBackendInDev);
        if (isLocalDev && !forceBackendInDev) {
            console.warn('🧪 Local dev detected: skipping GitHub workflow dispatch (set AUTH_CONFIG.forceBackendInDev=true to enable)');
            return { success: true, local: true };
        }

        // Get token (with optional rotation support)
        const token = this.getToken();

        if (!token) {
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

            const response = await (window.rateLimiter ? window.rateLimiter.fetch(url, {
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

            // Rotate token if rate limit is exhausted
            const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '-1', 10);
            if (!isNaN(remaining) && remaining <= 0) {
                this.advanceToken();
            }

            if (!response.ok) {
                // Try to get error details from response
                let errorMessage = 'Workflow dispatch failed: ' + response.status;
                try {
                    const errorData = await response.json();
                    console.error('GitHub API Error Details:', errorData);
                    errorMessage = errorData.message || errorMessage;
                    if (errorData.errors) {
                        console.error('Validation Errors:', errorData.errors);
                        errorMessage += ' - ' + JSON.stringify(errorData.errors);
                    }
                } catch (parseError) {
                    console.error('Could not parse error response');
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

        // Try workflow dispatch first, fall back to GitHub Issues if it fails
        try {
            return await this.triggerWorkflow('submit_rsvp', payload);
        } catch (workflowError) {
            console.warn('Workflow dispatch failed, trying GitHub Issues fallback:', workflowError.message);
            return await this.submitRSVPViaIssue(payload);
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
}

if (typeof window !== 'undefined') {
    window.BackendAPI = new BackendAPI();
    console.log('Backend API loaded (Secure)');
}
