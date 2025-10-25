/**
 * EventCall GitHub API Integration - Enhanced with Issue Processing
 * Added RSVP issue processing and management capabilities
 */

class GitHubAPI {
    constructor() {
        this.config = GITHUB_CONFIG;
        this.baseURL = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents`;
        this.issuesURL = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/issues`;
        this.corsProxy = 'https://api.allorigins.win/raw?url=';
        this.useCorsProxy = false;
    }

    /**
     * Get token from userAuth or config
     */
getToken() {
    // Use token from GITHUB_CONFIG
    if (window.GITHUB_CONFIG && window.GITHUB_CONFIG.token) {
        return window.GITHUB_CONFIG.token;
    }
    
    // Fallback if GITHUB_CONFIG not loaded
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

        const response = await fetch(url, options);
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
            console.warn('âš ï¸ No GitHub token available for connection test');
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
                console.log('âœ… GitHub connection successful:', repoData.full_name);
                this.updateTokenStatus(true);
                return true;
            } else {
                console.error('âŒ GitHub connection failed:', response.status, response.statusText);
                this.updateTokenStatus(false);
                return false;
            }
        } catch (error) {
            console.error('âŒ GitHub connection test failed:', error);
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
                statusIcon.textContent = 'âœ…';
                statusText.textContent = 'GitHub Connected';
                statusText.style.color = '#10b981';
            } else {
                statusIcon.textContent = 'âŒ';
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
            console.warn('âš ï¸ No GitHub token - returning empty events');
            return {};
        }

        try {
            console.log('ðŸ“¥ Loading events from private EventCall-Data repo...');

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

                        // Filter events by authenticated manager
                        if (window.managerAuth && window.managerAuth.isAuthenticated()) {
                            const currentManager = window.managerAuth.getCurrentManager();
                            if (content.createdBy === currentManager?.email) {
                                events[content.id] = content;
                                console.log('âœ… Loaded event for manager:', content.title);
                            }
                        } else {
                            // No auth - load all events
                            events[content.id] = content;
                        }
                    }
                } catch (error) {
                    console.error('Failed to load event file ' + file.path + ':', error);
                }
            }

            console.log(`âœ… Loaded ${Object.keys(events).length} events from private repo for current user`);
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
        console.warn('âš ï¸ No GitHub token - returning empty responses');
        return {};
    }

    try {
        console.log('ðŸ“¥ Loading responses from private EventCall-Data repo...');
        
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
            item.path !== '.gitkeep'
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
                let rsvpData = JSON.parse(this.safeBase64Decode(fileData.content));

                // Normalize to array format
                if (!Array.isArray(rsvpData)) {
                    rsvpData = [rsvpData];
                }
                rsvpArray = rsvpData;

                // Extract eventId - either from filename or from content
                if (file.path.startsWith('rsvps/') && !file.path.includes('rsvp-')) {
                    // Format: rsvps/{eventId}.json
                    eventId = file.path.replace('rsvps/', '').replace('.json', '');
                } else if (Array.isArray(rsvpArray) && rsvpArray.length > 0 && rsvpArray[0].eventId) {
                    // Format: rsvp-{timestamp}.json - get eventId from content
                    eventId = rsvpArray[0].eventId;
                } else {
                    console.warn(`⚠️ Could not extract eventId from RSVP file: ${file.path}`);
                    continue;
                }

                // RSVP file contains an array of RSVPs for this event
                if (Array.isArray(rsvpArray) && eventId) {
                    if (!responses[eventId]) {
                        responses[eventId] = [];
                    }

                    // Add all RSVPs from the array
                    responses[eventId] = rsvpArray;
                    console.log(`✅ Loaded ${rsvpArray.length} RSVP(s) for event: ${eventId} from ${file.path}`);
                } else {
                    console.warn(`⚠️ Unexpected RSVP format in ${file.path}`);
                }
            } catch (error) {
                console.error('Failed to load response file ' + file.path + ':', error);
            }
        }

        console.log('âœ… Loaded responses for ' + Object.keys(responses).length + ' events from private repo');
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
            console.log('ðŸ” Loading RSVP issues from GitHub...');
            
            // Get issues with RSVP label
            const response = await fetch(`${this.issuesURL}?labels=rsvp&state=open&per_page=100`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load RSVP issues: ${response.status}`);
            }

            const issues = await response.json();
            console.log(`âœ… Found ${issues.length} RSVP issues`);
            
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
            showToast('ðŸ”„ Processing RSVP submissions...', 'success');
            
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

            const message = `âœ… Processed ${processedCount.success} RSVPs successfully${processedCount.errors > 0 ? ` (${processedCount.errors} errors)` : ''}`;
            showToast(message, processedCount.errors > 0 ? 'error' : 'success');
            
            return {
                totalIssues: issues.length,
                processed: processedCount.success,
                errors: processedCount.errors,
                eventGroups: Object.keys(eventGroups)
            };

        } catch (error) {
            console.error('Failed to process RSVP issues:', error);
            showToast('âŒ Failed to process RSVPs: ' + error.message, 'error');
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

            console.log(`âœ… Saved ${eventRSVPs.length} RSVPs for event ${eventId}`);

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

            console.log(`âœ… Closed processed issue #${issueNumber}`);

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
            const cleanEventData = this.cleanEventData(eventData);
            const path = `events/${cleanEventData.id}.json`;
            const content = this.safeBase64Encode(JSON.stringify(cleanEventData, null, 2));

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
                message: `${existingSha ? 'Update' : 'Create'} event: ${cleanEventData.title}`,
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
                throw new Error(`Failed to save event: ${createResponse.status} - ${errorText}`);
            }

            console.log('âœ… Event saved successfully to EventCall-Data:', cleanEventData.id);
            return await createResponse.json();

        } catch (error) {
            console.error('Failed to save event to EventCall-Data:', error);
            throw error;
        }
    }

    /**
     * Delete event from EventCall-Data repository
     */
    async deleteEvent(eventId, eventTitle) {
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

            console.log('âœ… Event deleted successfully from EventCall-Data:', eventId);

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

                console.log(`âœ… Deleted ${path} from EventCall-Data`);
            }
        } catch (error) {
            console.log(`File ${path} may not exist in EventCall-Data, skipping deletion`);
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
}

// Create global instance
const githubAPI = new GitHubAPI();

// Make available globally
window.githubAPI = githubAPI;
