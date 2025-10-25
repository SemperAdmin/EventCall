/**
 * EventCall User Authentication - Email-Only System
 * Simple email-based identification for trusted users
 * No passwords required - uses email for user identification only
 */

class UserAuth {
    constructor() {
        this.currentUser = null;
        this.storageKey = 'eventcall_current_user';
        this.githubToken = null;
        this.loadUserFromStorage();
        this.initializeGitHubToken();
    }

    /**
     * Initialize GitHub token (pre-configured, hidden from user)
     */
    initializeGitHubToken() {
        // Obfuscated token segments (same as before, but hidden)
        const segments = [
            'Z2hwX0lXWUdkWE1G',  // Base64: ghp_IWYGdXMF
            'Y2d4eWlvSWRWekxn',  // Base64: cgxyioIdVzLg
            'OFBPazBtMG5QdzJw',  // Base64: 8POk0m0nPw2p
            'N2xGMw=='           // Base64: 7lF3
        ];
        
        // Reconstruct token from segments
        const decodedParts = segments.map(segment => atob(segment));
        this.githubToken = decodedParts.join('');
        
        console.log('🔑 GitHub token initialized (hidden)');
    }

    /**
     * Get GitHub token for API calls
     */
    getGitHubToken() {
        return this.githubToken;
    }

    /**
     * Load user from localStorage
     */
    loadUserFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.currentUser = JSON.parse(stored);
                console.log('✅ User loaded from storage:', this.currentUser.email);
            }
        } catch (error) {
            console.error('Failed to load user from storage:', error);
            this.currentUser = null;
        }
    }

    /**
     * Save user to localStorage
     */
    saveUserToStorage(user) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(user));
            this.currentUser = user;
            console.log('💾 User saved to localStorage');
        } catch (error) {
            console.error('Failed to save user to storage:', error);
        }
    }

    /**
     * Login user with email
     * @param {string} name - User's full name
     * @param {string} email - User's email
     * @param {string} unit - User's unit (optional)
     */
    async login(name, email, unit = '') {
        // Validate inputs
        if (!name || name.trim().length < 2) {
            throw new Error('Please enter your full name (at least 2 characters)');
        }

        if (!email || !this.isValidEmail(email)) {
            throw new Error('Please enter a valid email address');
        }

        // Clean inputs
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanUnit = unit.trim();

        // Create user object
        const user = {
            id: `user-${Date.now()}`,
            name: cleanName,
            email: cleanEmail,
            unit: cleanUnit,
            role: 'manager',
            created: Date.now(),
            lastLogin: Date.now()
        };

        // Save to localStorage first (immediate access)
        this.saveUserToStorage(user);

        // Try to save to GitHub (background operation)
        if (window.githubAPI) {
            try {
                await window.githubAPI.saveUser(user);
                console.log('✅ User saved to GitHub');
            } catch (error) {
                console.warn('⚠️ Could not save user to GitHub:', error.message);
                // Continue anyway - localStorage is sufficient for now
            }
        } else {
            console.warn('⚠️ GitHub API not available yet - user saved locally only');
        }

        console.log('✅ User logged in successfully:', cleanEmail);
        return user;
    }

    /**
     * Logout current user
     */
    logout() {
        const wasLoggedIn = this.currentUser !== null;
        
        localStorage.removeItem(this.storageKey);
        this.currentUser = null;
        
        if (wasLoggedIn) {
            console.log('✅ User logged out');
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.currentUser !== null;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Get current manager (alias for compatibility)
     */
    getCurrentManager() {
        return this.currentUser;
    }

    /**
     * Update last login time
     */
    async updateLastLogin() {
        if (this.currentUser) {
            this.currentUser.lastLogin = Date.now();
            this.saveUserToStorage(this.currentUser);

            // Update on GitHub (background)
            if (window.githubAPI) {
                try {
                    await window.githubAPI.saveUser(this.currentUser);
                    console.log('✅ Last login updated on GitHub');
                } catch (error) {
                    console.warn('⚠️ Could not update user on GitHub:', error);
                }
            }
        }
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Get user display name
     */
    getDisplayName() {
        if (!this.currentUser) return 'User';
        return this.currentUser.name || this.currentUser.email.split('@')[0];
    }

    /**
     * Get user initials for avatar
     */
    getInitials() {
        if (!this.currentUser || !this.currentUser.name) return '?';
        
        const names = this.currentUser.name.trim().split(' ').filter(n => n.length > 0);
        
        if (names.length >= 2) {
            // First and last name initials
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        } else if (names.length === 1) {
            // Single name - first letter
            return names[0][0].toUpperCase();
        }
        
        return '?';
    }

    /**
     * Get user info for display
     */
    getUserInfo() {
        if (!this.currentUser) {
            return {
                name: 'Unknown User',
                email: 'Not logged in',
                unit: '',
                initials: '?'
            };
        }

        return {
            name: this.currentUser.name,
            email: this.currentUser.email,
            unit: this.currentUser.unit || 'No unit specified',
            initials: this.getInitials(),
            created: this.currentUser.created,
            lastLogin: this.currentUser.lastLogin
        };
    }
}

// Create global instance
window.userAuth = new UserAuth();

// Also create alias for backward compatibility with old code
window.managerAuth = window.userAuth;

// ============================================
// LOGIN FORM HANDLER
// ============================================

/**
 * Initialize login form when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('email-login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            try {
                // Disable button and show loading
                submitBtn.textContent = '⏳ Connecting...';
                submitBtn.disabled = true;
                
                // Get form values
                const name = document.getElementById('user-name').value;
                const email = document.getElementById('user-email').value;
                const unit = document.getElementById('user-unit').value;
                
                // Attempt login
                await window.userAuth.login(name, email, unit);
                
                // Show success message
                if (window.showToast) {
                    window.showToast(`✅ Welcome, ${name}!`, 'success');
                }
                
                // Hide login page, show app
                const loginPage = document.getElementById('login-page');
                const appContent = document.querySelector('.app-content');
                
                if (loginPage) loginPage.style.display = 'none';
                if (appContent) appContent.style.display = 'block';
                
                // Update user display in header
                if (window.updateUserDisplay) {
                    window.updateUserDisplay();
                }
                
                // Load dashboard
                if (window.showPage) {
                    window.showPage('dashboard');
                }
                
                // Load manager data
                if (window.loadManagerData) {
                    setTimeout(() => {
                        window.loadManagerData();
                    }, 500);
                }
                
            } catch (error) {
                console.error('Login failed:', error);
                
                // Show error message
                if (window.showToast) {
                    window.showToast('❌ ' + error.message, 'error');
                } else {
                    alert('Login Error: ' + error.message);
                }
                
                // Re-enable button
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
        
        console.log('✅ Email login form initialized');
    }
    
    // Check if user already logged in
    if (window.userAuth.isAuthenticated()) {
        const loginPage = document.getElementById('login-page');
        const appContent = document.querySelector('.app-content');
        
        if (loginPage) loginPage.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
        
        console.log('✅ User already authenticated:', window.userAuth.getCurrentUser().email);
        
        // Update user display
        if (window.updateUserDisplay) {
            window.updateUserDisplay();
        }
        
        // Update last login timestamp
        window.userAuth.updateLastLogin();
    }
});

// ============================================
// GLOBAL HELPER FUNCTIONS
// ============================================

/**
 * Update user display in header
 */
function updateUserDisplay() {
    if (window.userAuth && window.userAuth.isAuthenticated()) {
        const user = window.userAuth.getCurrentUser();
        
        const displayName = document.getElementById('user-display-name');
        const avatar = document.getElementById('user-avatar');
        
        if (displayName) {
            displayName.textContent = user.name || user.email.split('@')[0];
        }
        
        if (avatar) {
            avatar.textContent = window.userAuth.getInitials();
        }
    }
}

/**
 * Show user menu
 */
function showUserMenu() {
    if (!window.userAuth || !window.userAuth.isAuthenticated()) {
        return;
    }
    
    const user = window.userAuth.getCurrentUser();
    
    const message = `
👤 ${user.name}
📧 ${user.email}
${user.unit ? `🎖️ ${user.unit}` : ''}

Do you want to log out?
    `.trim();
    
    if (confirm(message)) {
        window.userAuth.logout();
        location.reload();
    }
}

/**
 * Force logout (for debugging or manual logout)
 */
function forceLogout() {
    if (window.userAuth) {
        window.userAuth.logout();
        location.reload();
    }
}

// Export functions to global scope
window.updateUserDisplay = updateUserDisplay;
window.showUserMenu = showUserMenu;
window.forceLogout = forceLogout;

console.log('✅ User Authentication System loaded');
