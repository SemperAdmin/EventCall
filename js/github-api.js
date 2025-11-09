/**
 * EventCall GitHub API Integration - Enhanced with Issue Processing and User Management
 * Added RSVP issue processing, management capabilities, and email-based user authentication
 */

class GitHubAPI {
    constructor() {
        this.config = GITHUB_CONFIG;
        // Provide safe defaults if config is missing fields
        this.config.repo = this.config.repo || 'EventCall';
        this.config.branch = this.config.branch || 'main';
        this.baseURL = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents`;
        this.issuesURL = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/issues`;
        this.corsProxy = 'https://api.allorigins.win/raw?url=';
        this.useCorsProxy = false;
    }

    /**
     * Get token from userAuth or config
     */
    getToken() {
        // First try to get token from userAuth (new email-only system)
        if (window.userAuth && window.userAuth.getGitHubToken) {
            const token = window.userAuth.getGitHubToken();
            if (token) {
                return token;
            }
        }
        
        // Fallback to GITHUB_CONFIG
        if (window.GITHUB_CONFIG && window.GITHUB_CONFIG.token) {
            return window.GITHUB_CONFIG.token;
        }
        
        console.error('GITHUB_CONFIG.token not found');
        return null;
    }

    /**
     * Check if token is available
     */
    hasToken() {
        const token = this.getToken();
        return !!(token && token.length > 10);
    }

    /**
     * Safe base64 encoding that handles Unicode characters
     */
    safeBase64Encode(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (error) {
            console.error('Base64 encoding failed:', error);
            const cleanStr = str.replace(/[^\x00-\x7F]/g, "");
            return btoa(cleanStr);
        }
    }

    /**
     * Safe base64 decoding
     */
    safeBase64Decode(str) {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (error) {
            console.error('Base64 decoding failed:', error);
            return atob(str);
        }
    }

    /**
     * Generic GitHub API request handler
     */
    async request(path, method = 'GET', data = null) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available. Please login and provide token.');
        }

        const url = `${this.baseURL}/${path}`;
        
        const options = {
            method,
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'EventCall-App'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await (window.rateLimiter
            ? window.rateLimiter.fetch(url, options, {
                endpointKey: 'github_contents',
                retry: { maxAttempts: 5, baseDelayMs: 800, jitter: true }
              })
            : fetch(url, options));
        return await this.handleResponse(response);
    }

    /**
     * Handle response and check for errors
     */
    async handleResponse(response) {
        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            
            let errorMessage = `GitHub API error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
                
                if (response.status === 401) {
                    errorMessage = 'GitHub token is invalid or expired. Please check your token.';
                } else if (response.status === 403) {
                    errorMessage = 'GitHub API rate limit exceeded or insufficient permissions';
                }
            } catch (e) {
                // Can't parse error response
            }
            
            throw new Error(errorMessage);
        }

        return await response.json();
    }

    /**
     * Test GitHub connection
     */
    async testConnection() {
        const token = this.getToken();
        if (!token) {
            console.warn('⚠️ No GitHub token available for connection test');
            return false;
        }

        try {
            const response = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });
            
            if (response.ok) {
                const repoData = await response.json();
                console.log('✅ GitHub connection successful:', repoData.full_name);
                this.updateTokenStatus(true);
                return true;
            } else {
                console.error('❌ GitHub connection failed:', response.status, response.statusText);
                this.updateTokenStatus(false);
                return false;
            }
        } catch (error) {
            console.error('❌ GitHub connection test failed:', error);
            this.updateTokenStatus(false);
            return false;
        }
    }

    /**
     * Update token status in UI
     */
    updateTokenStatus(connected) {
        const statusIcon = document.getElementById('token-status-icon');
        const statusText = document.getElementById('token-status-text');
        
        if (statusIcon && statusText) {
            if (connected) {
                statusIcon.textContent = '✅';
                statusText.textContent = 'GitHub Connected';
                statusText.style.color = '#10b981';
            } else {
                statusIcon.textContent = '❌';
                statusText.textContent = 'GitHub Disconnected';
                statusText.style.color = '#ef4444';
            }
        }
    }

    /**
     * Load all events from EventCall-Data repository for current user
     */
    async loadEvents() {
        const token = this.getToken();
        if (!token) {
            console.warn('⚠️ No GitHub token - returning empty events');
            return {};
        }

        try {
            console.log('📥 Loading events from private EventCall-Data repo...');

            // Load from PRIVATE repo: EventCall-Data
            const treeResponse = await fetch('https://api.github.com/repos/SemperAdmin/EventCall-Data/git/trees/main?recursive=1', {
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });

            if (!treeResponse.ok) {
                if (treeResponse.status === 404) {
                    console.log('Repository or main branch not found, treating as empty');
                    return {};
                }
                throw new Error(`Failed to load repository tree: ${treeResponse.status}`);
            }

            const treeData = await treeResponse.json();
            const events = {};

            const eventFiles = treeData.tree.filter(item =>
                item.path.startsWith('events/') &&
                item.path.endsWith('.json') &&
                item.type === 'blob'
            );

            console.log('Found ' + eventFiles.length + ' event files in private repo');

            for (const file of eventFiles) {
                try {
                    const fileResponse = await fetch('https://api.github.com/repos/SemperAdmin/EventCall-Data/git/blobs/' + file.sha, {
                        headers: {
                            'Authorization': 'token ' + token,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'EventCall-App'
                        }
                    });

                    if (fileResponse.ok) {
                        const fileData = await fileResponse.json();
                        const content = JSON.parse(this.safeBase64Decode(fileData.content));

                        // Filter events by authenticated user (supports username-first, email fallback)
                        const currentUser = window.userAuth?.getCurrentUser() || window.managerAuth?.getCurrentManager();
                        if (!currentUser) {
                            console.warn('🔒 Skipping event load: no authenticated user');
                            continue;
                        }

                        const userUsername = (currentUser.username || '').toLowerCase();
                        const userEmail = (currentUser.email || '').toLowerCase();

                        const createdBy = (content.createdBy || '').toLowerCase();
                        const createdByUsername = (content.createdByUsername || '').toLowerCase();

                        const matchesUsername = userUsername && (createdBy === userUsername || createdByUsername === userUsername);
                        const matchesEmail = userEmail && createdBy === userEmail; // Backward-compat for older events

                        if (matchesUsername || matchesEmail) {
                            events[content.id] = content;
                            console.log('✅ Loaded event for owner:', content.title);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load event file ' + file.path + ':', error);
                }
            }

            console.log(`✅ Loaded ${Object.keys(events).length} events from private repo for current user`);
            return events;

        } catch (error) {
            console.error('Failed to load events from private repo:', error);
            return {};
        }
    }

    /**
     * Load all RSVP responses from GitHub
     */
    async loadResponses() {
        const token = this.getToken();
        if (!token) {
            console.warn('⚠️ No GitHub token - returning empty responses');
            return {};
        }

        try {
            console.log('📥 Loading responses from private EventCall-Data repo...');
            
            // Load from PRIVATE repo: EventCall-Data
            const treeResponse = await fetch('https://api.github.com/repos/SemperAdmin/EventCall-Data/git/trees/main?recursive=1', {
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });

            if (!treeResponse.ok) {
                console.log('No responses found or repository not accessible');
                return {};
            }

            const treeData = await treeResponse.json();
            const responses = {};

            // Debug: log all files to see the actual structure
            console.log('🔍 All files in tree:', treeData.tree.length);
            const rsvpRelated = treeData.tree.filter(item => 
                item.path.includes('rsvp') || item.path.includes('RSVP')
            );
            console.log('🔍 RSVP-related files:', rsvpRelated.map(f => f.path));

            const responseFiles = treeData.tree.filter(item => 
                (item.path.startsWith('rsvps/') || item.path.startsWith('rsvp-')) && 
                item.path.endsWith('.json') && 
                item.type === 'blob' &&
                item.path !== 'rsvps/.gitkeep' &&
                item.path !== '.gitkeep' &&
                item.path !== 'rsvps/.json' // exclude malformed filename
            );

            console.log('Found ' + responseFiles.length + ' RSVP files in private repo');

            for (const file of responseFiles) {
                try {
                    let eventId;
                    let rsvpArray;
                    
                    // Fetch the file content first
                    const fileResponse = await fetch('https://api.github.com/repos/SemperAdmin/EventCall-Data/git/blobs/' + file.sha, {
                        headers: {
                            'Authorization': 'token ' + token,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'EventCall-App'
                        }
                    });

                    if (!fileResponse.ok) continue;

                    const fileData = await fileResponse.json();
                    const decoded = this.safeBase64Decode(fileData.content);
                    const rawJson = JSON.parse(decoded);

                    // Normalize to array and flatten "data" wrapper if present
                    if (Array.isArray(rawJson)) {
                        rsvpArray = rawJson.map(item =>
                            item && item.data
                                ? { ...item.data, sentAt: item.sentAt, source: item.source }
                                : item
                        );
                    } else {
                        rsvpArray = [
                            rawJson && rawJson.data
                                ? { ...rawJson.data, sentAt: rawJson.sentAt, source: rawJson.source }
                                : rawJson
                        ];
                    }

                    // Extract eventId from filename or content
                    if (file.path.startsWith('rsvps/') && !file.path.includes('rsvp-')) {
                        // Format: rsvps/{eventId}.json
                        eventId = file.path.replace('rsvps/', '').replace('.json', '');
                    } else {
                        const sample = rsvpArray[0] || {};
                        eventId = sample.eventId || (rawJson && rawJson.data && rawJson.data.eventId) || null;
                    }

                    if (!eventId) {
                        console.warn(`⚠️ Could not extract eventId from RSVP file: ${file.path}`);
                        continue;
                    }

                    // Append RSVPs to the event bucket
                    if (!responses[eventId]) {
                        responses[eventId] = [];
                    }
                    responses[eventId].push(...rsvpArray);
                    console.log(`✅ Loaded ${rsvpArray.length} RSVP(s) for event: ${eventId} from ${file.path}`);
                } catch (error) {
                    console.error('Failed to load response file ' + file.path + ':', error);
                }
            }

            // Log summary
            const eventCount = Object.keys(responses).length;
            const totalRSVPs = Object.values(responses).reduce((sum, arr) => sum + arr.length, 0);
            console.log(`✅ Loaded responses for ${eventCount} event(s) from private repo`);
            console.log(`📊 Total RSVPs loaded: ${totalRSVPs}`);
            
            // Log per-event breakdown
            Object.entries(responses).forEach(([eventId, rsvps]) => {
                console.log(`   Event ${eventId}: ${rsvps.length} RSVP(s)`);
            });
            
            return responses;

        } catch (error) {
            console.error('Failed to load responses from private repo:', error);
            return {};
        }
    }

    /**
     * Load RSVP issues from GitHub
     */
    async loadRSVPIssues() {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token required to load RSVP issues');
        }

        try {
            console.log('🔎 Loading RSVP issues from GitHub...');
            
            // Get issues with RSVP label
            const response = await (window.rateLimiter ? window.rateLimiter.fetch(`${this.issuesURL}?labels=rsvp&state=open&per_page=100`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            }, { endpointKey: 'github_issues', retry: { maxAttempts: 5, baseDelayMs: 1000, jitter: true } }) : fetch(`${this.issuesURL}?labels=rsvp&state=open&per_page=100`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            }));

            if (!response.ok) {
                throw new Error(`Failed to load RSVP issues: ${response.status}`);
            }

            const issues = await response.json();
            console.log(`✅ Found ${issues.length} RSVP issues`);
            
            return issues;

        } catch (error) {
            console.error('Failed to load RSVP issues:', error);
            throw error;
        }
    }

    /**
     * Process RSVP issues and convert to JSON files
     */
    async processRSVPIssues() {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token required to process RSVPs');
        }

        try {
            showToast('🔄 Processing RSVP submissions...', 'success');
            
            const issues = await this.loadRSVPIssues();
            const processedCount = { total: 0, success: 0, errors: 0 };
            const eventGroups = {};

            // Group issues by event ID
            for (const issue of issues) {
                try {
                    const rsvpData = this.extractRSVPFromIssue(issue);
                    if (rsvpData && rsvpData.eventId) {
                        if (!eventGroups[rsvpData.eventId]) {
                            eventGroups[rsvpData.eventId] = [];
                        }
                        eventGroups[rsvpData.eventId].push({
                            issue: issue,
                            rsvpData: rsvpData
                        });
                    }
                } catch (error) {
                    console.error(`Failed to process issue #${issue.number}:`, error);
                    processedCount.errors++;
                }
            }

            // Process each event's RSVPs
            for (const [eventId, eventRSVPs] of Object.entries(eventGroups)) {
                try {
                    await this.saveEventRSVPs(eventId, eventRSVPs);
                    
                    // Close processed issues
                    for (const { issue } of eventRSVPs) {
                        await this.closeProcessedIssue(issue.number);
                        processedCount.success++;
                    }
                    
                } catch (error) {
                    console.error(`Failed to process RSVPs for event ${eventId}:`, error);
                    processedCount.errors += eventRSVPs.length;
                }
            }

            const message = `✅ Processed ${processedCount.success} RSVPs successfully${processedCount.errors > 0 ? ` (${processedCount.errors} errors)` : ''}`;
            showToast(message, processedCount.errors > 0 ? 'error' : 'success');
            
            return {
                totalIssues: issues.length,
                processed: processedCount.success,
                errors: processedCount.errors,
                eventGroups: Object.keys(eventGroups)
            };

        } catch (error) {
            console.error('Failed to process RSVP issues:', error);
            showToast('❌ Failed to process RSVPs: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Extract RSVP data from GitHub issue
     */
    extractRSVPFromIssue(issue) {
        try {
            // Look for JSON data in issue body
            const jsonMatch = issue.body.match(/```json\s*([\s\S]*?)\s*```/);
            if (!jsonMatch) {
                console.warn(`No JSON data found in issue #${issue.number}`);
                return null;
            }

            const rsvpData = JSON.parse(jsonMatch[1]);
            
            // Add GitHub issue metadata
            rsvpData.issueNumber = issue.number;
            rsvpData.issueUrl = issue.html_url;
            rsvpData.processedAt = Date.now();
            
            return rsvpData;

        } catch (error) {
            console.error(`Failed to extract RSVP data from issue #${issue.number}:`, error);
            return null;
        }
    }

    /**
     * Save event RSVPs to JSON file
     */
    async saveEventRSVPs(eventId, eventRSVPs) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token required');
        }

        try {
            const path = `rsvps/${eventId}.json`;
            
            // Load existing responses
            let existingResponses = [];
            let existingSha = null;
            
            try {
                const existingResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'EventCall-App'
                    }
                });

                if (existingResponse.ok) {
                    const existingData = await existingResponse.json();
                    existingSha = existingData.sha;
                    existingResponses = JSON.parse(this.safeBase64Decode(existingData.content));
                }
            } catch (error) {
                // File doesn't exist, start with empty array
            }

            // Merge new RSVPs with existing ones
            for (const { rsvpData } of eventRSVPs) {
                // Check if RSVP already exists (by email)
                const existingIndex = existingResponses.findIndex(r => 
                    r.email && r.email.toLowerCase() === rsvpData.email.toLowerCase()
                );
                
                if (existingIndex !== -1) {
                    // Update existing RSVP
                    existingResponses[existingIndex] = rsvpData;
                    console.log(`Updated existing RSVP for ${rsvpData.email}`);
                } else {
                    // Add new RSVP
                    existingResponses.push(rsvpData);
                    console.log(`Added new RSVP for ${rsvpData.email}`);
                }
            }
            
            const content = this.safeBase64Encode(JSON.stringify(existingResponses, null, 2));
            
            const createData = {
                message: `Process RSVPs for event ${eventId} (${eventRSVPs.length} submissions)`,
                content: content,
                branch: this.config.branch
            };

            if (existingSha) {
                createData.sha = existingSha;
            }

            const createResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'EventCall-App'
                },
                body: JSON.stringify(createData)
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Failed to save RSVPs: ${createResponse.status} - ${errorText}`);
            }

            console.log(`✅ Saved ${eventRSVPs.length} RSVPs for event ${eventId}`);

        } catch (error) {
            console.error(`Failed to save RSVPs for event ${eventId}:`, error);
            throw error;
        }
    }

    /**
     * Close processed RSVP issue
     */
    async closeProcessedIssue(issueNumber) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token required');
        }

        try {
            const response = await fetch(`${this.issuesURL}/${issueNumber}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'EventCall-App'
                },
                body: JSON.stringify({
                    state: 'closed',
                    labels: ['rsvp', 'processed']
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to close issue #${issueNumber}: ${response.status}`);
            }

            console.log(`✅ Closed processed issue #${issueNumber}`);

        } catch (error) {
            console.error(`Failed to close issue #${issueNumber}:`, error);
            // Don't throw - closing issues is not critical
        }
    }

    /**
     * Save event to EventCall-Data repository
     * DEPRECATED: Use BackendAPI.createEvent() for new events
     * This method is kept for backward compatibility
     */
    async saveEvent(eventData) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available. Cannot save to cloud.');
        }

        try {
            // Separate coverImage to protect it from the cleaning process
            const { coverImage, ...otherData } = eventData;
            
            // Clean the rest of the data
            const cleanedData = this.cleanEventData(otherData);
            
            // Re-combine the data, ensuring coverImage is preserved
            const finalEventData = { ...cleanedData, coverImage: coverImage };

            const path = `events/${finalEventData.id}.json`;
            const content = this.safeBase64Encode(JSON.stringify(finalEventData, null, 2));

            // Check if file exists in EventCall-Data repo
            let existingSha = null;
            try {
                const existingResponse = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall-Data/contents/${path}`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'EventCall-App'
                    }
                });

                if (existingResponse.ok) {
                    const existingData = await existingResponse.json();
                    existingSha = existingData.sha;
                }
            } catch (error) {
                // File doesn't exist, which is fine
            }

            // Create or update the file in EventCall-Data repo
            const createData = {
                message: `${existingSha ? 'Update' : 'Create'} event: ${finalEventData.title}`,
                content: content,
                branch: 'main'
            };

            if (existingSha) {
                createData.sha = existingSha;
            }

            // CSRF headers for state-changing request (informational; GitHub does not validate)
            const csrfToken = (window.csrf && window.csrf.getToken && window.csrf.getToken()) || '';

            // Client-side origin whitelist precheck
            if (window.csrf && typeof window.csrf.originAllowed === 'function') {
                if (!window.csrf.originAllowed()) {
                    const err = new Error('Origin not allowed by SECURITY_CONFIG');
                    if (window.errorHandler) window.errorHandler.handleError(err, 'Security-CSRF', { origin: window.location.origin });
                    throw err;
                }
            }

            // Note: Don't send X-CSRF-Token to GitHub API - it causes CORS errors
            // GitHub API has its own authentication via the Authorization token
            const createResponse = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall-Data/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'EventCall-App'
                },
                body: JSON.stringify(createData)
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Failed to save event: ${createResponse.status} - ${errorText}`);
            }

            console.log('✅ Event saved successfully to EventCall-Data:', finalEventData.id);
            return await createResponse.json();

        } catch (error) {
            console.error('Failed to save event to EventCall-Data:', error);
            throw error;
        }
    }

    /**
     * Delete event from EventCall-Data repository
     * @param {string} eventId - The event ID
     * @param {string} eventTitle - The event title
     * @param {string} coverImageUrl - Optional cover image URL to delete
     */
    async deleteEvent(eventId, eventTitle, coverImageUrl = null) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available. Cannot delete from cloud.');
        }

        try {
            // Delete event file from EventCall-Data
            const eventPath = `events/${eventId}.json`;
            await this.deleteFileFromDataRepo(eventPath, `Delete event: ${this.cleanText(eventTitle)}`);

            // Delete associated responses file from EventCall-Data
            const responsePath = `rsvps/${eventId}.json`;
            await this.deleteFileFromDataRepo(responsePath, `Delete responses for event: ${this.cleanText(eventTitle)}`);

            // Delete cover image if it exists
            if (coverImageUrl) {
                try {
                    // Extract the filename from the URL
                    // Expected format: https://raw.githubusercontent.com/SemperAdmin/EventCall-Images/main/images/filename.ext
                    const urlParts = coverImageUrl.split('/');
                    const fileName = urlParts[urlParts.length - 1];

                    if (fileName) {
                        const imagePath = `images/${fileName}`;
                        await this.deleteFileFromImageRepo(imagePath, `Delete cover image for event: ${this.cleanText(eventTitle)}`);
                        console.log('✅ Cover image deleted:', fileName);
                    }
                } catch (imageError) {
                    console.log('Could not delete cover image:', imageError.message);
                    // Don't throw - we don't want image deletion failure to fail the entire event deletion
                }
            }

            console.log('✅ Event deleted successfully from EventCall-Data:', eventId);

        } catch (error) {
            console.error('Failed to delete event:', error);
            throw error;
        }
    }

    /**
     * Delete a file from GitHub main repo (deprecated)
     */
    async deleteFile(path, message) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available');
        }

        try {
            // Get file info first
            const fileResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });

            if (fileResponse.ok) {
                const fileData = await fileResponse.json();

                const deleteResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'EventCall-App'
                    },
                    body: JSON.stringify({
                        message: message,
                        sha: fileData.sha,
                        branch: this.config.branch
                    })
                });

                if (!deleteResponse.ok) {
                    throw new Error(`Failed to delete ${path}: ${deleteResponse.status}`);
                }
            }
        } catch (error) {
            console.log(`File ${path} may not exist, skipping deletion`);
        }
    }

    /**
     * Delete a file from EventCall-Data repository
     */
    async deleteFileFromDataRepo(path, message) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available');
        }

        try {
            // Get file info first from EventCall-Data
            const fileResponse = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall-Data/contents/${path}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });

            if (fileResponse.ok) {
                const fileData = await fileResponse.json();

                const deleteResponse = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall-Data/contents/${path}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'EventCall-App'
                    },
                    body: JSON.stringify({
                        message: message,
                        sha: fileData.sha,
                        branch: 'main'
                    })
                });

                if (!deleteResponse.ok) {
                    throw new Error(`Failed to delete ${path} from EventCall-Data: ${deleteResponse.status}`);
                }

                console.log(`✅ Deleted ${path} from EventCall-Data`);
            }
        } catch (error) {
            console.log(`File ${path} may not exist in EventCall-Data, skipping deletion`);
        }
    }

    /**
     * Delete a file from EventCall-Images repository
     */
    async deleteFileFromImageRepo(path, message) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available');
        }

        if (!this.config.imageRepo) {
            throw new Error('imageRepo not defined in GITHUB_CONFIG');
        }

        try {
            // Get file info first from EventCall-Images
            const fileResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.imageRepo}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });

            if (fileResponse.ok) {
                const fileData = await fileResponse.json();

                const deleteResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.imageRepo}/contents/${path}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'EventCall-App'
                    },
                    body: JSON.stringify({
                        message: message,
                        sha: fileData.sha,
                        branch: 'main'
                    })
                });

                if (!deleteResponse.ok) {
                    throw new Error(`Failed to delete ${path} from ${this.config.imageRepo}: ${deleteResponse.status}`);
                }

                console.log(`✅ Deleted ${path} from ${this.config.imageRepo}`);
            }
        } catch (error) {
            console.log(`File ${path} may not exist in ${this.config.imageRepo}, skipping deletion`);
        }
    }

    /**
     * Save user to EventCall-Data repository
     * @param {Object} user - User object
     */
    async saveUser(user) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available. Cannot save user.');
        }

        try {
            const cleanUser = this.cleanUserData(user);
            const path = `users/${cleanUser.id}.json`;
            const content = this.safeBase64Encode(JSON.stringify(cleanUser, null, 2));

            // Check if file exists
            let existingSha = null;
            try {
                const existingResponse = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall-Data/contents/${path}`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'EventCall-App'
                    }
                });

                if (existingResponse.ok) {
                    const existingData = await existingResponse.json();
                    existingSha = existingData.sha;
                }
            } catch (error) {
                // File doesn't exist, which is fine
            }

            // Create or update the file
            const createData = {
                message: `${existingSha ? 'Update' : 'Create'} user: ${cleanUser.username || cleanUser.name || cleanUser.id}`,
                content: content,
                branch: 'main'
            };

            if (existingSha) {
                createData.sha = existingSha;
            }

            const createResponse = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall-Data/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'EventCall-App'
                },
                body: JSON.stringify(createData)
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Failed to save user: ${createResponse.status} - ${errorText}`);
            }

            console.log('✅ User saved successfully to EventCall-Data:', cleanUser.username || cleanUser.name || cleanUser.id);
            return await createResponse.json();

        } catch (error) {
            console.error('Failed to save user to EventCall-Data:', error);
            throw error;
        }
    }

    /**
     * Load user from EventCall-Data by email
     * @param {string} email - User email
     */
    async loadUserByEmail(email) {
        const token = this.getToken();
        if (!token) {
            console.warn('⚠️ No GitHub token - cannot load user');
            return null;
        }

        try {
            console.log('🔍 Searching for user by email:', email);

            // Load user files from EventCall-Data
            const treeResponse = await fetch('https://api.github.com/repos/SemperAdmin/EventCall-Data/git/trees/main?recursive=1', {
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });

            if (!treeResponse.ok) {
                console.log('No users found or repository not accessible');
                return null;
            }

            const treeData = await treeResponse.json();

            // Find user files
            const userFiles = treeData.tree.filter(item =>
                item.path.startsWith('users/') &&
                item.path.endsWith('.json') &&
                item.type === 'blob'
            );

            console.log(`Found ${userFiles.length} user files`);

            // Search for user by email
            for (const file of userFiles) {
                try {
                    const fileResponse = await fetch('https://api.github.com/repos/SemperAdmin/EventCall-Data/git/blobs/' + file.sha, {
                        headers: {
                            'Authorization': 'token ' + token,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'EventCall-App'
                        }
                    });

                    if (fileResponse.ok) {
                        const fileData = await fileResponse.json();
                        const userData = JSON.parse(this.safeBase64Decode(fileData.content));

                        if (userData.email && userData.email.toLowerCase() === email.toLowerCase()) {
                            console.log('✅ Found user:', userData.email);
                            return userData;
                        }
                    }
                } catch (error) {
                    console.error('Failed to load user file ' + file.path + ':', error);
                }
            }

            console.log('User not found with email:', email);
            return null;

        } catch (error) {
            console.error('Failed to load user by email:', error);
            return null;
        }
    }

    /**
     * Clean event data to prevent encoding issues
     */
    cleanEventData(eventData) {
        const cleaned = { ...eventData };
        
        if (cleaned.title) cleaned.title = this.cleanText(cleaned.title);
        if (cleaned.description) cleaned.description = this.cleanText(cleaned.description);
        if (cleaned.location) cleaned.location = this.cleanText(cleaned.location);
        if (cleaned.createdByName) cleaned.createdByName = this.cleanText(cleaned.createdByName);
        
        if (cleaned.customQuestions && Array.isArray(cleaned.customQuestions)) {
            cleaned.customQuestions = cleaned.customQuestions.map(q => ({
                ...q,
                question: this.cleanText(q.question)
            }));
        }
        
        return cleaned;
    }

    /**
     * Clean user data to prevent encoding issues
     */
    cleanUserData(user) {
        const cleaned = { ...user };
        
        if (cleaned.name) cleaned.name = this.cleanText(cleaned.name);
        if (cleaned.email) cleaned.email = this.cleanText(cleaned.email);
        if (cleaned.unit) cleaned.unit = this.cleanText(cleaned.unit);
        
        return cleaned;
    }

    /**
     * Clean text to prevent encoding issues
     */
    cleanText(text) {
        if (typeof text !== 'string') return text;
        
        return text
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .replace(/[\u2000-\u206F]/g, ' ')
            .replace(/[\u2070-\u209F]/g, '')
            .replace(/[\uFFF0-\uFFFF]/g, '')
            .trim();
    }

    /**
     * Get pending RSVP count
     */
    async getPendingRSVPCount() {
        try {
            const issues = await this.loadRSVPIssues();
            return issues.length;
        } catch (error) {
            console.error('Failed to get pending RSVP count:', error);
            return 0;
        }
    }

    /**
     * Upload an image to the public image repository
     * @param {File} file - The image file to upload
     * @param {string} fileName - The desired name for the file in the repo
     * @returns {Promise<string>} The public URL of the uploaded image
     */
    async uploadImage(file, fileName) {
        if (!this.config.imageRepo) {
            throw new Error('imageRepo not defined in GITHUB_CONFIG');
        }

        const path = `images/${fileName}`;
        const result = await this.uploadFile(
            this.config.imageRepo,
            path,
            file,
            `Upload image: ${fileName}`
        );

        // Return the raw content URL which is publicly accessible
        return result.content.download_url;
    }

    /**
     * Generic file upload utility
     * @param {string} repo - The name of the repository
     * @param {string} path - The full path for the new file
     * @param {File} file - The file to upload
     * @param {string} message - The commit message
     * @returns {Promise<Object>} The GitHub API response
     */
    async uploadFile(repo, path, file, message) {
        const token = this.getToken();
        if (!token) {
            throw new Error('GitHub token not available');
        }

        const content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const url = `https://api.github.com/repos/${this.config.owner}/${repo}/contents/${path}`;

        const data = {
            message: message,
            content: content,
            branch: 'main'
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'EventCall-App'
            },
            body: JSON.stringify(data)
        });

        return this.handleResponse(response);
    }
}

// Create global instance
const githubAPI = new GitHubAPI();

// Make available globally
window.githubAPI = githubAPI;
