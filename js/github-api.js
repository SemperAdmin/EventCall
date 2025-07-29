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
    