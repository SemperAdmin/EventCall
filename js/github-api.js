/**
 * EventCall GitHub API Integration
 * Handles all GitHub API interactions for data storage and retrieval
 */

class GitHubAPI {
    constructor() {
        this.config = GITHUB_CONFIG;
        this.baseURL = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents`;
    }

    /**
     * Safe base64 encoding that handles Unicode characters
     * @param {string} str - String to encode
     * @returns {string} Base64 encoded string
     */
    safeBase64Encode(str) {
        try {
            // First convert to UTF-8 bytes, then to base64
            return btoa(unescape(encodeURIComponent(str)));
        } catch (error) {
            console.error('Base64 encoding failed:', error);
            // Fallback: remove problematic characters
            const cleanStr = str.replace(/[^\x00-\x7F]/g, "");
            return btoa(cleanStr);
        }
    }

    /**
     * Safe base64 decoding
     * @param {string} str - Base64 string to decode
     * @returns {string} Decoded string
     */
    safeBase64Decode(str) {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (error) {
            console.error('Base64 decoding failed:', error);
            return atob(str); // Fallback to simple decode
        }
    }

    /**
     * Generic GitHub API request handler
     * @param {string} path - API path
     * @param {string} method - HTTP method
     * @param {Object} data - Request data
     * @returns {Promise<Object|null>} API response or null if not found
     */
    async request(path, method = 'GET', data = null) {
        const url = `${this.baseURL}/${path}`;
        
        const options = {
            method,
            headers: {
                'Authorization': `token ${this.config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return null; // File not found is OK
                }
                
                let errorMessage = `GitHub API error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // Can't parse error response, use status
                }
                
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            console.error('GitHub API request failed:', error);
            throw error;
        }
    }

    /**
     * Test GitHub connection
     * @returns {Promise<boolean>} Connection status
     */
    async testConnection() {
        try {
            const response = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}`, {
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            return response.ok;
        } catch (error) {
            console.error('GitHub connection test failed:', error);
            return false;
        }
    }

    /**
     * Load all events from GitHub
     * @returns {Promise<Object>} Events object
     */
    async loadEvents() {
        try {
            const response = await this.request(`${GITHUB_PATHS.events}`);
            
            if (!response || !Array.isArray(response)) {
                console.log('No events directory found or empty');
                return {};
            }

            const events = {};
            
            // Load each event file
            for (const file of response) {
                if (file.name.endsWith('.json')) {
                    try {
                        const eventData = await this.request(`${GITHUB_PATHS.events}/${file.name}`);
                        if (eventData && eventData.content) {
                            const content = JSON.parse(this.safeBase64Decode(eventData.content));
                            events[content.id] = content;
                        }
                    } catch (error) {
                        console.error(`Failed to load event ${file.name}:`, error);
                    }
                }
            }

            return events;
        } catch (error) {
            console.error('Failed to load events:', error);
            return {};
        }
    }

    /**
     * Load all RSVP responses from GitHub
     * @returns {Promise<Object>} Responses object
     */
    async loadResponses() {
        try {
            const response = await this.request(`${GITHUB_PATHS.rsvps}`);
            
            if (!response || !Array.isArray(response)) {
                console.log('No responses directory found or empty');
                return {};
            }

            const responses = {};
            
            // Load each response file
            for (const file of response) {
                if (file.name.endsWith('.json')) {
                    try {
                        const responseData = await this.request(`${GITHUB_PATHS.rsvps}/${file.name}`);
                        if (responseData && responseData.content) {
                            const content = JSON.parse(this.safeBase64Decode(responseData.content));
                            const eventId = file.name.replace('.json', '');
                            responses[eventId] = content;
                        }
                    } catch (error) {
                        console.error(`Failed to load responses ${file.name}:`, error);
                    }
                }
            }

            return responses;
        } catch (error) {
            console.error('Failed to load responses:', error);
            return {};
        }
    }

    /**
     * Save event to GitHub
     * @param {Object} eventData - Event data
     * @returns {Promise<void>}
     */
    async saveEvent(eventData) {
        try {
            // Clean the event data to prevent encoding issues
            const cleanEventData = this.cleanEventData(eventData);
            
            const path = `${GITHUB_PATHS.events}/${cleanEventData.id}.json`;
            const content = this.safeBase64Encode(JSON.stringify(cleanEventData, null, 2));
            
            // Check if file exists
            const existing = await this.request(path);
            
            const data = {
                message: `${existing ? 'Update' : 'Create'} event: ${cleanEventData.title}`,
                content: content,
                branch: this.config.branch
            };

            if (existing) {
                data.sha = existing.sha;
            }

            await this.request(path, 'PUT', data);
            console.log('Event saved successfully:', cleanEventData.id);
            
        } catch (error) {
            console.error('Failed to save event:', error);
            throw error;
        }
    }

    /**
     * Clean event data to prevent encoding issues
     * @param {Object} eventData - Raw event data
     * @returns {Object} Cleaned event data
     */
    cleanEventData(eventData) {
        const cleaned = { ...eventData };
        
        // Clean text fields
        if (cleaned.title) cleaned.title = this.cleanText(cleaned.title);
        if (cleaned.description) cleaned.description = this.cleanText(cleaned.description);
        if (cleaned.location) cleaned.location = this.cleanText(cleaned.location);
        if (cleaned.createdByName) cleaned.createdByName = this.cleanText(cleaned.createdByName);
        
        // Clean custom questions
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
     * @param {string} text - Text to clean
     * @returns {string} Cleaned text
     */
    cleanText(text) {
        if (typeof text !== 'string') return text;
        
        // Remove or replace problematic characters
        return text
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/[\u2000-\u206F]/g, ' ') // Replace various spaces with regular space
            .replace(/[\u2070-\u209F]/g, '') // Remove superscripts/subscripts
            .replace(/[\uFFF0-\uFFFF]/g, '') // Remove specials
            .trim();
    }

    /**
     * Save RSVP response to GitHub
     * @param {string} eventId - Event ID
     * @param {Object} rsvpData - RSVP data
     * @returns {Promise<void>}
     */
    async saveRSVP(eventId, rsvpData) {
        try {
            // Clean RSVP data
            const cleanRsvpData = this.cleanRsvpData(rsvpData);
            
            const path = `${GITHUB_PATHS.rsvps}/${eventId}.json`;
            
            // Load existing responses
            const existing = await this.request(path);
            let responses = [];
            
            if (existing && existing.content) {
                responses = JSON.parse(this.safeBase64Decode(existing.content));
            }
            
            // Check for duplicate email
            const existingIndex = responses.findIndex(r => r.email.toLowerCase() === cleanRsvpData.email.toLowerCase());
            
            if (existingIndex !== -1) {
                // Update existing response
                responses[existingIndex] = cleanRsvpData;
            } else {
                // Add new response
                responses.push(cleanRsvpData);
            }
            
            const content = this.safeBase64Encode(JSON.stringify(responses, null, 2));
            
            const data = {
                message: `RSVP response: ${cleanRsvpData.name} for event ${eventId}`,
                content: content,
                branch: this.config.branch
            };

            if (existing) {
                data.sha = existing.sha;
            }

            await this.request(path, 'PUT', data);
            console.log('RSVP saved successfully:', cleanRsvpData.id);
            
        } catch (error) {
            console.error('Failed to save RSVP:', error);
            throw error;
        }
    }

    /**
     * Clean RSVP data to prevent encoding issues
     * @param {Object} rsvpData - Raw RSVP data
     * @returns {Object} Cleaned RSVP data
     */
    cleanRsvpData(rsvpData) {
        const cleaned = { ...rsvpData };
        
        // Clean text fields
        if (cleaned.name) cleaned.name = this.cleanText(cleaned.name);
        if (cleaned.email) cleaned.email = this.cleanText(cleaned.email);
        if (cleaned.phone) cleaned.phone = this.cleanText(cleaned.phone);
        if (cleaned.reason) cleaned.reason = this.cleanText(cleaned.reason);
        
        // Clean custom answers
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
     * Delete event from GitHub
     * @param {string} eventId - Event ID
     * @param {string} eventTitle - Event title for commit message
     * @returns {Promise<void>}
     */
    async deleteEvent(eventId, eventTitle) {
        try {
            // Delete event file
            const eventPath = `${GITHUB_PATHS.events}/${eventId}.json`;
            const eventFile = await this.request(eventPath);
            
            if (eventFile) {
                await this.request(eventPath, 'DELETE', {
                    message: `Delete event: ${this.cleanText(eventTitle)}`,
                    sha: eventFile.sha,
                    branch: this.config.branch
                });
            }

            // Delete associated responses file
            const responsePath = `${GITHUB_PATHS.rsvps}/${eventId}.json`;
            const responseFile = await this.request(responsePath);
            
            if (responseFile) {
                await this.request(responsePath, 'DELETE', {
                    message: `Delete responses for event: ${this.cleanText(eventTitle)}`,
                    sha: responseFile.sha,
                    branch: this.config.branch
                });
            }

            console.log('Event deleted successfully:', eventId);
            
        } catch (error) {
            console.error('Failed to delete event:', error);
            throw error;
        }
    }

    /**
     * Create initial directory structure if needed
     * @returns {Promise<void>}
     */
    async initializeRepository() {
        try {
            // Create events directory
            await this.createDirectoryIfNotExists(GITHUB_PATHS.events);
            
            // Create rsvps directory
            await this.createDirectoryIfNotExists(GITHUB_PATHS.rsvps);
            
            console.log('Repository initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize repository:', error);
            throw error;
        }
    }

    /**
     * Create directory if it doesn't exist
     * @param {string} path - Directory path
     * @returns {Promise<void>}
     */
    async createDirectoryIfNotExists(path) {
        try {
            const existing = await this.request(path);
            
            if (!existing) {
                // Create directory by creating a placeholder file
                await this.request(`${path}/.gitkeep`, 'PUT', {
                    message: `Initialize ${path} directory`,
                    content: this.safeBase64Encode(''),
                    branch: this.config.branch
                });
            }
        } catch (error) {
            console.error(`Failed to create directory ${path}:`, error);
            throw error;
        }
    }

    /**
     * Get repository information
     * @returns {Promise<Object>} Repository info
     */
    async getRepositoryInfo() {
        try {
            const response = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}`, {
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`Repository not found: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to get repository info:', error);
            throw error;
        }
    }
}

// Create global instance
const githubAPI = new GitHubAPI();

// Make available globally
window.githubAPI = githubAPI;