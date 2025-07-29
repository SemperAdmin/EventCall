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
            
            if (!response.ok && response.status !== 404) {
                const error = await response.json();
                throw new Error(error.message || `GitHub API error: ${response.status}`);
            }

            return response.status === 404 ? null : response.json();
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
                            const content = JSON.parse(atob(eventData.content));
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
                            const content = JSON.parse(atob(responseData.content));
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
            const path = `${GITHUB_PATHS.events}/${eventData.id}.json`;
            const content = btoa(JSON.stringify(eventData, null, 2));
            
            // Check if file exists
            const existing = await this.request(path);
            
            const data = {
                message: `${existing ? 'Update' : 'Create'} event: ${eventData.title}`,
                content: content,
                branch: this.config.branch
            };

            if (existing) {
                data.sha = existing.sha;
            }

            await this.request(path, 'PUT', data);
            console.log('Event saved successfully:', eventData.id);
            
        } catch (error) {
            console.error('Failed to save event:', error);
            throw error;
        }
    }

    /**
     * Save RSVP response to GitHub
     * @param {string} eventId - Event ID
     * @param {Object} rsvpData - RSVP data
     * @returns {Promise<void>}
     */
    async saveRSVP(eventId, rsvpData) {
        try {
            const path = `${GITHUB_PATHS.rsvps}/${eventId}.json`;
            
            // Load existing responses
            const existing = await this.request(path);
            let responses = [];
            
            if (existing && existing.content) {
                responses = JSON.parse(atob(existing.content));
            }
            
            // Check for duplicate email
            const existingIndex = responses.findIndex(r => r.email.toLowerCase() === rsvpData.email.toLowerCase());
            
            if (existingIndex !== -1) {
                // Update existing response
                responses[existingIndex] = rsvpData;
            } else {
                // Add new response
                responses.push(rsvpData);
            }
            
            const content = btoa(JSON.stringify(responses, null, 2));
            
            const data = {
                message: `RSVP response: ${rsvpData.name} for event ${eventId}`,
                content: content,
                branch: this.config.branch
            };

            if (existing) {
                data.sha = existing.sha;
            }

            await this.request(path, 'PUT', data);
            console.log('RSVP saved successfully:', rsvpData.id);
            
        } catch (error) {
            console.error('Failed to save RSVP:', error);
            throw error;
        }
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
                    message: `Delete event: ${eventTitle}`,
                    sha: eventFile.sha,
                    branch: this.config.branch
                });
            }

            // Delete associated responses file
            const responsePath = `${GITHUB_PATHS.rsvps}/${eventId}.json`;
            const responseFile = await this.request(responsePath);
            
            if (responseFile) {
                await this.request(responsePath, 'DELETE', {
                    message: `Delete responses for event: ${eventTitle}`,
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
                    content: btoa(''),
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