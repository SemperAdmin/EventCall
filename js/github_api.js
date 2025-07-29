/**
 * EventCall GitHub API Integration - Fixed Version
 * Handles CORS issues and provides robust error handling
 */

class GitHubAPI {
    constructor() {
        this.config = GITHUB_CONFIG;
        this.baseURL = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents`;
        this.corsProxy = 'https://api.allorigins.win/raw?url=';
        this.useCorsProxy = false; // We'll detect and enable if needed
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
     * Generic GitHub API request handler with CORS handling
     */
    async request(path, method = 'GET', data = null) {
        const url = `${this.baseURL}/${path}`;
        
        const options = {
            method,
            headers: {
                'Authorization': `token ${this.config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'EventCall-App'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        // Try direct request first
        try {
            const response = await this.makeRequest(url, options);
            return await this.handleResponse(response);
        } catch (error) {
            // If it's a CORS error, try with CORS proxy
            if (this.isCorsError(error)) {
                console.log('CORS detected, trying alternative approach...');
                return await this.requestWithCorsProxy(url, options);
            }
            throw error;
        }
    }

    /**
     * Make the actual fetch request
     */
    async makeRequest(url, options) {
        const response = await fetch(url, options);
        return response;
    }

    /**
     * Handle response and check for errors
     */
    async handleResponse(response) {
        if (!response.ok) {
            if (response.status === 404) {
                return null; // File not found is OK
            }
            
            let errorMessage = `GitHub API error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
                
                // Provide helpful error messages
                if (response.status === 401) {
                    errorMessage = 'GitHub token is invalid or expired. Please check your token in config.js';
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
     * Check if error is CORS-related
     */
    isCorsError(error) {
        const corsKeywords = ['cors', 'cross-origin', 'network error', 'failed to fetch'];
        const errorString = error.toString().toLowerCase();
        return corsKeywords.some(keyword => errorString.includes(keyword));
    }

    /**
     * Alternative request method for CORS issues
     */
    async requestWithCorsProxy(url, options) {
        // For CORS issues, we'll use a different approach
        // Create a simplified request that works with GitHub's API
        const simplifiedUrl = url.replace('/contents/', '/git/trees/main?recursive=1');
        
        try {
            const response = await fetch(simplifiedUrl, {
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.ok) {
                return await response.json();
            } else {
                throw new Error(`Alternative request failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Alternative request also failed:', error);
            throw new Error('GitHub API unavailable. Using local storage only.');
        }
    }

    /**
     * Test GitHub connection
     */
    async testConnection() {
        try {
            // Test with a simple repository info request
            const response = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}`, {
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });
            
            if (response.ok) {
                const repoData = await response.json();
                console.log('✅ GitHub connection successful:', repoData.full_name);
                return true;
            } else {
                console.error('❌ GitHub connection failed:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('❌ GitHub connection test failed:', error);
            return false;
        }
    }

    /**
     * Load all events from GitHub using Git Trees API (more reliable)
     */
    async loadEvents() {
        try {
            console.log('Loading events from GitHub...');
            
            // First, get the repository tree
            const treeResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/git/trees/main?recursive=1`, {
                headers: {
                    'Authorization': `token ${this.config.token}`,
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

            // Find event files in the tree
            const eventFiles = treeData.tree.filter(item => 
                item.path.startsWith('events/') && 
                item.path.endsWith('.json') && 
                item.type === 'blob'
            );

            // Load each event file
            for (const file of eventFiles) {
                try {
                    const fileResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/git/blobs/${file.sha}`, {
                        headers: {
                            'Authorization': `token ${this.config.token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'EventCall-App'
                        }
                    });

                    if (fileResponse.ok) {
                        const fileData = await fileResponse.json();
                        const content = JSON.parse(this.safeBase64Decode(fileData.content));
                        events[content.id] = content;
                        console.log('✅ Loaded event:', content.title);
                    }
                } catch (error) {
                    console.error(`Failed to load event file ${file.path}:`, error);
                }
            }

            console.log(`✅ Loaded ${Object.keys(events).length} events from GitHub`);
            return events;

        } catch (error) {
            console.error('Failed to load events from GitHub:', error);
            // Return empty object to allow local operation
            return {};
        }
    }

    /**
     * Load all RSVP responses from GitHub
     */
    async loadResponses() {
        try {
            console.log('Loading responses from GitHub...');
            
            // Get the repository tree
            const treeResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/git/trees/main?recursive=1`, {
                headers: {
                    'Authorization': `token ${this.config.token}`,
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

            // Find response files in the tree
            const responseFiles = treeData.tree.filter(item => 
                item.path.startsWith('rsvps/') && 
                item.path.endsWith('.json') && 
                item.type === 'blob'
            );

            // Load each response file
            for (const file of responseFiles) {
                try {
                    const fileResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/git/blobs/${file.sha}`, {
                        headers: {
                            'Authorization': `token ${this.config.token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'EventCall-App'
                        }
                    });

                    if (fileResponse.ok) {
                        const fileData = await fileResponse.json();
                        const content = JSON.parse(this.safeBase64Decode(fileData.content));
                        const eventId = file.path.replace('rsvps/', '').replace('.json', '');
                        responses[eventId] = content;
                        console.log('✅ Loaded responses for event:', eventId);
                    }
                } catch (error) {
                    console.error(`Failed to load response file ${file.path}:`, error);
                }
            }

            console.log(`✅ Loaded responses for ${Object.keys(responses).length} events from GitHub`);
            return responses;

        } catch (error) {
            console.error('Failed to load responses from GitHub:', error);
            return {};
        }
    }

    /**
     * Save event to GitHub using Contents API
     */
    async saveEvent(eventData) {
        try {
            const cleanEventData = this.cleanEventData(eventData);
            const path = `events/${cleanEventData.id}.json`;
            const content = this.safeBase64Encode(JSON.stringify(cleanEventData, null, 2));
            
            // Check if file exists
            let existingSha = null;
            try {
                const existingResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                    headers: {
                        'Authorization': `token ${this.config.token}`,
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
                message: `${existingSha ? 'Update' : 'Create'} event: ${cleanEventData.title}`,
                content: content,
                branch: this.config.branch
            };

            if (existingSha) {
                createData.sha = existingSha;
            }

            const createResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.config.token}`,
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

            console.log('✅ Event saved successfully:', cleanEventData.id);
            return await createResponse.json();

        } catch (error) {
            console.error('Failed to save event to GitHub:', error);
            throw error;
        }
    }

    /**
     * Save RSVP response to GitHub
     */
    async saveRSVP(eventId, rsvpData) {
        try {
            const cleanRsvpData = this.cleanRsvpData(rsvpData);
            const path = `rsvps/${eventId}.json`;
            
            // Load existing responses
            let existingResponses = [];
            let existingSha = null;
            
            try {
                const existingResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                    headers: {
                        'Authorization': `token ${this.config.token}`,
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

            // Check for duplicate email and update or add
            const existingIndex = existingResponses.findIndex(r => 
                r.email.toLowerCase() === cleanRsvpData.email.toLowerCase()
            );
            
            if (existingIndex !== -1) {
                existingResponses[existingIndex] = cleanRsvpData;
            } else {
                existingResponses.push(cleanRsvpData);
            }
            
            const content = this.safeBase64Encode(JSON.stringify(existingResponses, null, 2));
            
            const createData = {
                message: `RSVP response: ${cleanRsvpData.name} for event ${eventId}`,
                content: content,
                branch: this.config.branch
            };

            if (existingSha) {
                createData.sha = existingSha;
            }

            const createResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'EventCall-App'
                },
                body: JSON.stringify(createData)
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Failed to save RSVP: ${createResponse.status} - ${errorText}`);
            }

            console.log('✅ RSVP saved successfully:', cleanRsvpData.id);
            return await createResponse.json();

        } catch (error) {
            console.error('Failed to save RSVP to GitHub:', error);
            throw error;
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
     * Clean RSVP data to prevent encoding issues
     */
    cleanRsvpData(rsvpData) {
        const cleaned = { ...rsvpData };
        
        if (cleaned.name) cleaned.name = this.cleanText(cleaned.name);
        if (cleaned.email) cleaned.email = this.cleanText(cleaned.email);
        if (cleaned.phone) cleaned.phone = this.cleanText(cleaned.phone);
        if (cleaned.reason) cleaned.reason = this.cleanText(cleaned.reason);
        
        if (cleaned.customAnswers && typeof cleaned.customAnswers === 'object') {
            const cleanAnswers = {};
            for (const [key, value] of Object.entries(cleaned.customAnswers)) {
                cleanAnswers[key] = this.cleanText(value);
            }
            cleaned.customAnswers = cleanAnswers;
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
     * Delete event from GitHub
     */
    async deleteEvent(eventId, eventTitle) {
        try {
            // Delete event file
            const eventPath = `events/${eventId}.json`;
            await this.deleteFile(eventPath, `Delete event: ${this.cleanText(eventTitle)}`);

            // Delete associated responses file
            const responsePath = `rsvps/${eventId}.json`;
            await this.deleteFile(responsePath, `Delete responses for event: ${this.cleanText(eventTitle)}`);

            console.log('✅ Event deleted successfully:', eventId);
            
        } catch (error) {
            console.error('Failed to delete event:', error);
            throw error;
        }
    }

    /**
     * Delete a file from GitHub
     */
    async deleteFile(path, message) {
        try {
            // Get file info first
            const fileResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });

            if (fileResponse.ok) {
                const fileData = await fileResponse.json();
                
                const deleteResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${this.config.token}`,
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
     * Initialize repository structure
     */
    async initializeRepository() {
        try {
            console.log('Initializing repository structure...');
            
            // Create events directory
            await this.ensureDirectoryExists('events');
            
            // Create rsvps directory  
            await this.ensureDirectoryExists('rsvps');
            
            console.log('✅ Repository initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize repository:', error);
            // Don't throw error - app can still work without GitHub
        }
    }

    /**
     * Ensure directory exists by creating a .gitkeep file
     */
    async ensureDirectoryExists(dirPath) {
        try {
            const keepPath = `${dirPath}/.gitkeep`;
            
            // Check if directory already has files
            const treeResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/git/trees/main?recursive=1`, {
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventCall-App'
                }
            });

            if (treeResponse.ok) {
                const treeData = await treeResponse.json();
                const hasFiles = treeData.tree.some(item => item.path.startsWith(dirPath + '/'));
                
                if (hasFiles) {
                    console.log(`Directory ${dirPath} already exists with files`);
                    return;
                }
            }

            // Create .gitkeep file
            const createResponse = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${keepPath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'EventCall-App'
                },
                body: JSON.stringify({
                    message: `Initialize ${dirPath} directory`,
                    content: this.safeBase64Encode(''),
                    branch: this.config.branch
                })
            });

            if (createResponse.ok) {
                console.log(`✅ Created directory: ${dirPath}`);
            }

        } catch (error) {
            console.log(`Could not create directory ${dirPath}:`, error.message);
        }
    }
}

// Create global instance
const githubAPI = new GitHubAPI();

// Make available globally
window.githubAPI = githubAPI;