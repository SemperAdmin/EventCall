/**
 * EventCall User Authentication - Username/Password System
 * Secure authentication with bcrypt password hashing via GitHub Actions
 */

const userAuth = {
    currentUser: null,
    authInProgress: false,

    /**
     * Initialize authentication system
     */
    async init() {
        console.log('🔐 Initializing username/password authentication...');

        // Skip auth check for invite pages (guests don't need login)
        const isInvitePage = window.location.hash.includes('invite/') || window.location.search.includes('data=');

        if (isInvitePage) {
            console.log('🎟️ Invite URL detected - bypassing login for guest access');
            this.hideLoginScreen();
            return;
        }

        // Check for saved user
        const savedUser = this.loadUserFromStorage();

        if (savedUser) {
            this.currentUser = savedUser;
            console.log('✅ User restored from storage:', savedUser.username);

            // Update UI
            if (window.updateUserDisplay) {
                window.updateUserDisplay();
            }

            this.hideLoginScreen();
        } else {
            console.log('🔒 No saved user - showing login screen');
            this.showLoginScreen();
        }
    },

    /**
     * Show login screen
     */
    showLoginScreen() {
        const loginPage = document.getElementById('login-page');
        const appContent = document.querySelector('.app-content');

        if (loginPage) loginPage.style.display = 'flex';
        if (appContent) appContent.style.display = 'none';

        console.log('🔑 Login screen displayed');
    },

    /**
     * Hide login screen and show app
     */
    hideLoginScreen() {
        const loginPage = document.getElementById('login-page');
        const appContent = document.querySelector('.app-content');

        if (loginPage) loginPage.style.display = 'none';
        if (appContent) appContent.style.display = 'block';

        console.log('📱 App content displayed');
    },

    /**
     * Handle user registration
     */
    async handleRegister(event) {
        event.preventDefault();

        if (this.authInProgress) {
            console.log('⏳ Authentication already in progress');
            return;
        }

        const form = event.target;
        const usernameInput = document.getElementById('reg-username');
        const nameInput = document.getElementById('reg-name');
        const rankInput = document.getElementById('reg-rank');
        const passwordInput = document.getElementById('reg-password');
        const confirmPasswordInput = document.getElementById('reg-confirm-password');
        const submitBtn = form.querySelector('button[type="submit"]');

        const username = usernameInput?.value.trim().toLowerCase();
        const name = nameInput?.value.trim();
        const rank = rankInput?.value || '';
        const password = passwordInput?.value;
        const confirmPassword = confirmPasswordInput?.value;

        const showToast = window.showToast || function(msg, type) { console.log(msg); };

        // Client-side validation
        if (!username || username.length < 3 || username.length > 50) {
            showToast('❌ Username must be 3-50 characters', 'error');
            usernameInput?.focus();
            return;
        }

        if (!/^[a-z0-9._-]+$/.test(username)) {
            showToast('❌ Username can only contain letters, numbers, dots, hyphens, and underscores', 'error');
            usernameInput?.focus();
            return;
        }

        if (!name || name.length < 2) {
            showToast('❌ Please enter your full name', 'error');
            nameInput?.focus();
            return;
        }

        if (!password || password.length < 8) {
            showToast('❌ Password must be at least 8 characters', 'error');
            passwordInput?.focus();
            return;
        }

        // Password strength validation
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);

        if (!hasUpper || !hasLower || !hasNumber) {
            showToast('❌ Password must contain uppercase, lowercase, and number', 'error');
            passwordInput?.focus();
            return;
        }

        if (password !== confirmPassword) {
            showToast('❌ Passwords do not match', 'error');
            confirmPasswordInput?.focus();
            return;
        }

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<div class="spinner"></div> Creating account...';
        submitBtn.disabled = true;
        this.authInProgress = true;

        try {
            // Generate unique client ID for tracking response
            const clientId = 'reg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // Trigger GitHub Actions workflow
            console.log('🚀 Triggering registration workflow...');

            const response = await this.triggerAuthWorkflow('register_user', {
                username,
                password,
                name,
                rank,
                client_id: clientId
            });

            if (response.success) {
                showToast(`✅ Account created! Welcome, ${response.user.name}!`, 'success');

                // Save user to storage (without password)
                this.currentUser = response.user;
                this.saveUserToStorage(response.user);

                // Update UI
                if (window.updateUserDisplay) {
                    window.updateUserDisplay();
                }

                // Clear form
                form.reset();

                // Hide login and show app
                this.hideLoginScreen();

                // Load user's events
                if (window.loadManagerData) {
                    await window.loadManagerData();
                }

                // Navigate to dashboard
                if (window.showPage) {
                    window.showPage('dashboard');
                }
            } else {
                throw new Error(response.error || 'Registration failed');
            }

        } catch (error) {
            console.error('❌ Registration failed:', error);
            showToast('❌ Registration failed: ' + error.message, 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            this.authInProgress = false;
        }
    },

    /**
     * Handle user login
     */
    async handleLogin(event) {
        event.preventDefault();

        if (this.authInProgress) {
            console.log('⏳ Authentication already in progress');
            return;
        }

        const form = event.target;
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        const rememberMeInput = document.getElementById('remember-me');
        const submitBtn = form.querySelector('button[type="submit"]');

        const username = usernameInput?.value.trim().toLowerCase();
        const password = passwordInput?.value;
        const rememberMe = rememberMeInput?.checked || false;

        const showToast = window.showToast || function(msg, type) { console.log(msg); };

        // Validation
        if (!username) {
            showToast('❌ Please enter your username', 'error');
            usernameInput?.focus();
            return;
        }

        if (!password) {
            showToast('❌ Please enter your password', 'error');
            passwordInput?.focus();
            return;
        }

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<div class="spinner"></div> Signing in...';
        submitBtn.disabled = true;
        this.authInProgress = true;

        try {
            // Generate unique client ID for tracking response
            const clientId = 'login_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // Trigger GitHub Actions workflow
            console.log('🚀 Triggering login workflow...');

            const response = await this.triggerAuthWorkflow('login_user', {
                username,
                password,
                client_id: clientId
            });

            if (response.success) {
                showToast(`✅ Welcome back, ${response.user.name}!`, 'success');

                // Save user to storage (without password)
                this.currentUser = response.user;
                this.saveUserToStorage(response.user, rememberMe);

                // Update UI
                if (window.updateUserDisplay) {
                    window.updateUserDisplay();
                }

                // Clear password field
                passwordInput.value = '';

                // Hide login and show app
                this.hideLoginScreen();

                // Load user's events
                if (window.loadManagerData) {
                    await window.loadManagerData();
                }

                // Navigate to dashboard
                if (window.showPage) {
                    window.showPage('dashboard');
                }
            } else {
                throw new Error(response.error || 'Login failed');
            }

        } catch (error) {
            console.error('❌ Login failed:', error);
            showToast('❌ Login failed: ' + error.message, 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            this.authInProgress = false;
        }
    },

    /**
     * Trigger GitHub Actions authentication workflow
     */
    async triggerAuthWorkflow(actionType, payload) {
        try {
            if (!window.BackendAPI || !window.BackendAPI.triggerWorkflow) {
                throw new Error('Backend API not available');
            }

            // Trigger workflow via BackendAPI
            const result = await window.BackendAPI.triggerWorkflow(actionType, payload);

            // Poll for response via GitHub Issues
            const response = await this.pollForAuthResponse(payload.client_id, 30000); // 30 second timeout

            return response;

        } catch (error) {
            console.error('Workflow trigger error:', error);
            throw new Error('Authentication service unavailable. Please try again later.');
        }
    },

    /**
     * Poll GitHub Issues for authentication response
     */
    async pollForAuthResponse(clientId, timeout = 30000) {
        const startTime = Date.now();
        const pollInterval = 2000; // Check every 2 seconds

        while (Date.now() - startTime < timeout) {
            try {
                // Check for response issue
                const response = await fetch(
                    `https://api.github.com/repos/${window.GITHUB_CONFIG.owner}/${window.GITHUB_CONFIG.repo}/issues?labels=auth-response&state=open`,
                    {
                        headers: {
                            'Authorization': `token ${window.GITHUB_CONFIG.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error('Failed to check authentication status');
                }

                const issues = await response.json();

                // Find issue with matching client ID
                const matchingIssue = issues.find(issue =>
                    issue.title.includes(`AUTH_RESPONSE::${clientId}`)
                );

                if (matchingIssue) {
                    // Parse response from issue body
                    const responseData = JSON.parse(matchingIssue.body);

                    // Close the issue
                    await fetch(
                        `https://api.github.com/repos/${window.GITHUB_CONFIG.owner}/${window.GITHUB_CONFIG.repo}/issues/${matchingIssue.number}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `token ${window.GITHUB_CONFIG.token}`,
                                'Accept': 'application/vnd.github.v3+json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ state: 'closed' })
                        }
                    );

                    return responseData;
                }

            } catch (error) {
                console.error('Polling error:', error);
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error('Authentication timeout - please try again');
    },

    /**
     * Validate username format
     */
    isValidUsername(username) {
        return /^[a-z0-9._-]{3,50}$/.test(username);
    },

    /**
     * Check password strength and return feedback
     */
    checkPasswordStrength(password) {
        if (!password) {
            return { strength: 'none', message: '', color: '#ccc' };
        }

        let score = 0;
        const feedback = [];

        // Length check
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;

        // Character variety checks
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        // Determine strength
        let strength, message, color;

        if (score <= 2) {
            strength = 'weak';
            message = 'Weak password';
            color = '#e74c3c';
        } else if (score <= 4) {
            strength = 'medium';
            message = 'Medium strength';
            color = '#f39c12';
        } else {
            strength = 'strong';
            message = 'Strong password';
            color = '#27ae60';
        }

        return { strength, message, color, score };
    },

    /**
     * Save user to localStorage
     */
    saveUserToStorage(user, rememberMe = false) {
        try {
            const storageType = rememberMe ? localStorage : sessionStorage;
            storageType.setItem('eventcall_user', JSON.stringify(user));
            console.log(`💾 User saved to ${rememberMe ? 'localStorage' : 'sessionStorage'}`);
        } catch (error) {
            console.error('Failed to save user to storage:', error);
        }
    },

    /**
     * Load user from localStorage or sessionStorage
     */
    loadUserFromStorage() {
        try {
            // Check localStorage first (remember me)
            let saved = localStorage.getItem('eventcall_user');
            let source = 'localStorage';

            // Fall back to sessionStorage
            if (!saved) {
                saved = sessionStorage.getItem('eventcall_user');
                source = 'sessionStorage';
            }

            if (saved) {
                const user = JSON.parse(saved);
                console.log(`📥 User loaded from ${source}:`, user.username);
                return user;
            }
        } catch (error) {
            console.error('Failed to load user from storage:', error);
        }
        return null;
    },

    /**
     * Clear user from storage
     */
    clearUserFromStorage() {
        try {
            localStorage.removeItem('eventcall_user');
            sessionStorage.removeItem('eventcall_user');
            console.log('🗑️ User cleared from all storage');
        } catch (error) {
            console.error('Failed to clear user from storage:', error);
        }
    },

    /**
     * Logout user
     */
    logout() {
        console.log('👋 Logging out user:', this.currentUser?.username);

        // Clear user data
        this.currentUser = null;
        this.clearUserFromStorage();

        // Clear events data
        if (window.events) window.events = {};
        if (window.responses) window.responses = {};

        const showToast = window.showToast || function(msg, type) { console.log(msg); };
        showToast('👋 Logged out successfully', 'success');

        // Show login screen
        setTimeout(() => {
            this.showLoginScreen();

            // Clear login form
            const loginUsername = document.getElementById('login-username');
            const loginPassword = document.getElementById('login-password');

            if (loginUsername) loginUsername.value = '';
            if (loginPassword) loginPassword.value = '';
            if (loginUsername) loginUsername.focus();
        }, 800);
    },

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.currentUser !== null;
    },

    /**
     * Get GitHub token for API calls
     */
    getGitHubToken() {
        // Return the shared GitHub token from config
        if (window.GITHUB_CONFIG && window.GITHUB_CONFIG.token) {
            return window.GITHUB_CONFIG.token;
        }
        console.error('⚠️ GitHub token not found in config');
        return null;
    },

    /**
     * Get user initials for avatar
     */
    getInitials() {
        if (!this.currentUser || !this.currentUser.name) {
            return '👤';
        }

        const names = this.currentUser.name.split(' ');

        if (names.length >= 2) {
            // First and last name initials
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }

        // Single name - first letter
        return this.currentUser.name[0].toUpperCase();
    },

    /**
     * Get user display name with rank
     */
    getDisplayName() {
        if (!this.currentUser) {
            return 'Guest';
        }

        if (this.currentUser.rank) {
            return `${this.currentUser.rank} ${this.currentUser.name}`;
        }

        return this.currentUser.name;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    userAuth.init();

    // Attach login form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => userAuth.handleLogin(e));
        console.log('✅ Login form attached');
    }

    // Attach registration form handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => userAuth.handleRegister(e));
        console.log('✅ Registration form attached');
    }

    // Password strength indicator
    const regPassword = document.getElementById('reg-password');
    const strengthIndicator = document.getElementById('password-strength');

    if (regPassword && strengthIndicator) {
        regPassword.addEventListener('input', (e) => {
            const result = userAuth.checkPasswordStrength(e.target.value);
            strengthIndicator.innerHTML = `
                <div class="strength-bar" style="background: ${result.color}; width: ${(result.score / 6) * 100}%"></div>
                <span class="strength-text" style="color: ${result.color}">${result.message}</span>
            `;
        });
    }
});

// Make globally available
window.userAuth = userAuth;

console.log('✅ Username/password authentication system loaded');
