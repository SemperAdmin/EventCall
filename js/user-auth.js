/**
 * EventCall User Authentication - Email-Only System
 * No password required - simple email-based access with automatic GitHub integration
 */

const userAuth = {
    currentUser: null,

    /**
     * Initialize authentication system
     */
    async init() {
        console.log('🔐 Initializing email-only authentication...');

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
            console.log('✅ User restored from storage:', savedUser.email);

            // Update UI
            if (window.updateUserDisplay) {
                window.updateUserDisplay();
            }

            this.hideLoginScreen();

            // Load user's events
            if (window.loadManagerData) {
                await window.loadManagerData();
            }
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
     * Handle email login form submission
     */
    async handleEmailLogin(event) {
        event.preventDefault();

        const nameInput = document.getElementById('user-name');
        const emailInput = document.getElementById('user-email');
        const unitInput = document.getElementById('user-unit');
        const submitBtn = event.target.querySelector('button[type="submit"]');

        const name = nameInput?.value.trim();
        const email = emailInput?.value.trim().toLowerCase();
        const unit = unitInput?.value.trim();

        const showToast = window.showToast || function(msg, type) { console.log(msg); };

        // Validation
        if (!name || name.length < 2) {
            showToast('❌ Please enter your full name', 'error');
            nameInput?.focus();
            return;
        }

        if (!email || !this.isValidEmail(email)) {
            showToast('❌ Please enter a valid email address', 'error');
            emailInput?.focus();
            return;
        }

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<div class="spinner"></div> Logging in...';
        submitBtn.disabled = true;

        try {
            // Create user object
            const user = {
                id: this.generateUserId(email),
                name: name,
                email: email,
                unit: unit || '',
                createdAt: Date.now(),
                lastLogin: Date.now()
            };

            // Save user to GitHub (if API available)
            if (window.githubAPI && window.githubAPI.saveUser) {
                try {
                    await window.githubAPI.saveUser(user);
                    console.log('✅ User saved to GitHub:', user.email);
                } catch (error) {
                    console.warn('⚠️ Could not save user to GitHub:', error.message);
                    // Continue anyway - local storage is enough
                }
            }

            // Save to local storage
            this.currentUser = user;
            this.saveUserToStorage(user);

            showToast(`✅ Welcome, ${user.name}!`, 'success');

            // Update UI
            if (window.updateUserDisplay) {
                window.updateUserDisplay();
            }

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

        } catch (error) {
            console.error('❌ Login failed:', error);
            showToast('❌ Login failed: ' + error.message, 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    },

    /**
     * Generate unique user ID from email
     */
    generateUserId(email) {
        return 'user_' + email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    },

    /**
     * Validate email format
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Save user to localStorage
     */
    saveUserToStorage(user) {
        try {
            localStorage.setItem('eventcall_user', JSON.stringify(user));
            console.log('💾 User saved to localStorage');
        } catch (error) {
            console.error('Failed to save user to localStorage:', error);
        }
    },

    /**
     * Load user from localStorage
     */
    loadUserFromStorage() {
        try {
            const saved = localStorage.getItem('eventcall_user');
            if (saved) {
                const user = JSON.parse(saved);
                console.log('📥 User loaded from localStorage:', user.email);
                return user;
            }
        } catch (error) {
            console.error('Failed to load user from localStorage:', error);
        }
        return null;
    },

    /**
     * Clear user from storage
     */
    clearUserFromStorage() {
        try {
            localStorage.removeItem('eventcall_user');
            console.log('🗑️ User cleared from localStorage');
        } catch (error) {
            console.error('Failed to clear user from localStorage:', error);
        }
    },

    /**
     * Logout user
     */
    logout() {
        console.log('👋 Logging out user:', this.currentUser?.email);

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

            // Clear and focus name input
            const nameInput = document.getElementById('user-name');
            const emailInput = document.getElementById('user-email');
            const unitInput = document.getElementById('user-unit');

            if (nameInput) nameInput.value = '';
            if (emailInput) emailInput.value = '';
            if (unitInput) unitInput.value = '';
            if (nameInput) nameInput.focus();
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
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    userAuth.init();

    // Attach form handler
    const emailLoginForm = document.getElementById('email-login-form');
    if (emailLoginForm) {
        emailLoginForm.addEventListener('submit', (e) => userAuth.handleEmailLogin(e));
        console.log('✅ Email login form attached');
    }
});

// Make globally available
window.userAuth = userAuth;

console.log('✅ Email-only user authentication system loaded');
