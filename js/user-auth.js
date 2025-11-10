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
        if (appContent) {
            appContent.classList.add('hidden');
            appContent.style.display = 'none';
        }

        console.log('🔑 Login screen displayed');
    },

    /**
     * Hide login screen and show app
     */
    hideLoginScreen() {
        const loginPage = document.getElementById('login-page');
        const appContent = document.querySelector('.app-content');

        if (loginPage) loginPage.style.display = 'none';
        if (appContent) {
            appContent.classList.remove('hidden');
            appContent.style.display = 'block';
        }

        console.log('📱 App content displayed');
    },

    /**
     * Simple local validation for username/password
     * - If AUTH_CONFIG.users is provided, validates against that list
     * - Otherwise, accepts any non-empty username/password for demo access
     */
    simpleValidate(username, password) {
        const users = (window.AUTH_CONFIG && Array.isArray(window.AUTH_CONFIG.users)) ? window.AUTH_CONFIG.users : [];

        const uname = (username || '').trim().toLowerCase();
        const pass = (password || '').trim();

        // Require non-empty credentials
        if (!uname || !pass) {
            return null;
        }

        if (users.length > 0) {
            const match = users.find(u => (u.username || '').toLowerCase() === uname);
            if (!match) return null;

            // Support either plaintext demo password or precomputed hash field in future
            if (typeof match.password === 'string') {
                if (pass !== match.password) return null;
            } else {
                // No password to check; treat as invalid
                return null;
            }

            // Build user object from match
            return {
                id: 'user_' + uname,
                username: uname,
                name: match.name || uname,
                email: match.email || '',
                branch: match.branch || '',
                rank: match.rank || '',
                role: match.role || 'user'
            };
        }

        // Demo fallback: accept any non-empty credentials
        return {
            id: 'user_' + uname,
            username: uname,
            name: uname,
            email: '',
            branch: '',
            rank: '',
            role: 'user'
        };
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
        const emailInput = document.getElementById('reg-email');
        const branchInput = document.getElementById('reg-branch');
        const rankInput = document.getElementById('reg-rank');
        const passwordInput = document.getElementById('reg-password');
        const confirmPasswordInput = document.getElementById('reg-confirm-password');
        const submitBtn = form.querySelector('button[type="submit"]');

        const username = usernameInput?.value.trim().toLowerCase();
        const name = nameInput?.value.trim();
        const email = emailInput?.value.trim().toLowerCase();
        const branch = branchInput?.value || '';
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

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('❌ Please enter a valid email address', 'error');
            emailInput?.focus();
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

        // Show app loader immediately
        if (window.showAppLoader) {
            window.showAppLoader();
        }

        // Set authentication in progress
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
                email,
                branch,
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

                // Hide loading screen after a brief delay to ensure smooth transition
                setTimeout(() => {
                    if (window.hideAppLoader) {
                        window.hideAppLoader();
                    }
                }, 800);
            } else {
                throw new Error(response.error || 'Registration failed');
            }
        } catch (error) {
            console.error('❌ Registration failed:', error);
            showToast('❌ Registration failed: ' + error.message, 'error');

            // Hide app loader on error
            if (window.hideAppLoader) {
                window.hideAppLoader();
            }
        } finally {
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

        // Show app loader immediately
        if (window.showAppLoader) {
            window.showAppLoader();
        }

        // Set authentication in progress
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

                // Hide loading screen after a brief delay to ensure smooth transition
                setTimeout(() => {
                    if (window.hideAppLoader) {
                        window.hideAppLoader();
                    }
                }, 800);
            } else {
                throw new Error(response.error || 'Login failed');
            }
        } catch (error) {
            console.error('❌ Login failed:', error);
            showToast('❌ Login failed: ' + error.message, 'error');

            // Hide app loader on error
            if (window.hideAppLoader) {
                window.hideAppLoader();
            }
        } finally {
            this.authInProgress = false;
        }
    },

    /**
     * Trigger GitHub Actions authentication workflow
     */
    async triggerAuthWorkflow(actionType, payload) {
        try {
            // In simple auth mode, validate locally (works on GitHub Pages too)
            const simpleMode = !!(window.AUTH_CONFIG && window.AUTH_CONFIG.simpleAuth);
            if (simpleMode) {
                console.log('🔓 Simple auth enabled: processing locally without GitHub');

                // Handle profile updates differently - don't require password revalidation
                if (actionType === 'update_profile') {
                    // Get current user and update with new fields
                    const currentUser = this.getCurrentUser();
                    if (!currentUser) {
                        throw new Error('No authenticated user found');
                    }

                    // Create updated user object with new fields from payload
                    const updatedUser = {
                        ...currentUser,
                        name: payload?.name || currentUser.name,
                        email: payload?.email || currentUser.email || '',
                        branch: payload?.branch || currentUser.branch || '',
                        rank: payload?.rank || currentUser.rank || ''
                    };

                    return { success: true, user: updatedUser };
                }

                // For login/register, validate credentials
                const user = this.simpleValidate(payload?.username, payload?.password);
                if (!user) {
                    throw new Error('Invalid username or password');
                }
                return { success: true, user };
            }

            // In local development, bypass GitHub dispatch unless forced via config
            // Treat common local hosts as dev to bypass backend unless forced
            const isLocalDev = (function () {
                try {
                    const host = window.location.hostname;
                    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(host);
                } catch (_) {
                    return false;
                }
            })();
            const forceBackendInDev = !!(window.AUTH_CONFIG && window.AUTH_CONFIG.forceBackendInDev);
            if (isLocalDev && !forceBackendInDev) {
                console.log('🧪 Local dev detected: skipping GitHub workflow dispatch and polling (set AUTH_CONFIG.forceBackendInDev=true to enable)');

                // Handle profile updates differently in local dev
                if (actionType === 'update_profile') {
                    const currentUser = this.getCurrentUser();
                    if (!currentUser) {
                        throw new Error('No authenticated user found');
                    }

                    return {
                        success: true,
                        user: {
                            ...currentUser,
                            name: payload?.name || currentUser.name,
                            email: payload?.email || currentUser.email || '',
                            branch: payload?.branch || currentUser.branch || '',
                            rank: payload?.rank || currentUser.rank || ''
                        }
                    };
                }

                // For login/register
                return {
                    success: true,
                    user: {
                        id: 'user_' + (payload?.username || 'local'),
                        username: payload?.username || 'local_user',
                        name: payload?.name || payload?.username || 'Local User',
                        email: payload?.email || '',
                        branch: payload?.branch || '',
                        rank: payload?.rank || '',
                        role: 'manager'
                    }
                };
            }

            console.log('🔍 Checking BackendAPI availability...');

            if (!window.BackendAPI) {
                console.error('❌ window.BackendAPI is undefined');
                throw new Error('Backend API not loaded');
            }

            if (!window.BackendAPI.triggerWorkflow) {
                console.error('❌ BackendAPI.triggerWorkflow is undefined');
                throw new Error('Backend API triggerWorkflow method not available');
            }

            console.log('✅ BackendAPI available');
            console.log('🚀 Triggering workflow:', actionType);
            console.log('📦 Payload:', { ...payload, password: '[REDACTED]' });

            // Trigger workflow via BackendAPI
            const result = await window.BackendAPI.triggerWorkflow(actionType, payload);
            console.log('✅ Workflow dispatch result:', result);

            console.log('⏳ Polling for authentication response...');
            // Poll for response via GitHub Issues using configurable timeouts
            const timeoutMs = (window.AUTH_CONFIG && window.AUTH_CONFIG.authTimeoutMs) || 30000;
            const intervalMs = (window.AUTH_CONFIG && window.AUTH_CONFIG.pollIntervalMs) || 2000;
            const response = await this.pollForAuthResponse(payload.client_id, timeoutMs, intervalMs);

            console.log('✅ Authentication response received:', response);
            return response;

        } catch (error) {
            console.error('❌ Authentication workflow error:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);

            // Re-throw with more specific error message
            if (error.message.includes('timeout')) {
                throw new Error('Authentication timed out. The server took too long to respond.');
            } else if (error.message.includes('not available') || error.message.includes('not loaded')) {
                throw new Error('Backend API not available. Please refresh the page and try again.');
            } else {
                throw new Error(`Authentication failed: ${error.message}`);
            }
        }
    },

    /**
     * Poll GitHub Issues for authentication response
     */
    async pollForAuthResponse(clientId, timeout = 30000, pollInterval = 2000) {
        const startTime = Date.now();
        let pollCount = 0;

        console.log(`🔄 Starting to poll for client_id: ${clientId}`);
        console.log(`⏰ Timeout: ${timeout}ms, Poll interval: ${pollInterval}ms`);

        while (Date.now() - startTime < timeout) {
            pollCount++;
            const elapsed = Date.now() - startTime;

            try {
                console.log(`📡 Poll attempt #${pollCount} (${(elapsed / 1000).toFixed(1)}s elapsed)`);

                // Check for response issue
                // Note: Not filtering by labels since label application may be delayed
                const url = `https://api.github.com/repos/${window.GITHUB_CONFIG.owner}/${window.GITHUB_CONFIG.repo}/issues?state=open&per_page=100&sort=created&direction=desc&t=${Date.now()}`;
                console.log(`🌐 Fetching: ${url}`);

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `token ${window.GITHUB_CONFIG.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                console.log(`📥 Response status: ${response.status}`);

                if (!response.ok) {
                    console.error(`❌ Failed to fetch issues: ${response.status} ${response.statusText}`);
                    throw new Error(`Failed to check authentication status: ${response.status}`);
                }

                const issues = await response.json();
                console.log(`📋 Found ${issues.length} open issues total`);

                // Filter for AUTH_RESPONSE issues only
                const authIssues = issues.filter(i => i.title && i.title.startsWith('AUTH_RESPONSE::'));
                console.log(`🔐 Found ${authIssues.length} auth response issues`);

                if (authIssues.length > 0) {
                    console.log('📝 Auth issue titles:', authIssues.map(i => i.title));
                }

                // Find issue with matching client ID
                const searchTitle = `AUTH_RESPONSE::${clientId}`;
                console.log(`🔍 Searching for: "${searchTitle}"`);

                const matchingIssue = issues.find(issue =>
                    issue.title.includes(searchTitle)
                );

                if (matchingIssue) {
                    console.log(`✅ Found matching issue #${matchingIssue.number}`);
                    console.log(`📄 Issue body:`, matchingIssue.body);

                    try {
                        // Parse response from issue body
                        const responseData = JSON.parse(matchingIssue.body);
                        console.log(`✅ Parsed response data:`, responseData);

                        // Close the issue
                        console.log(`🔒 Closing issue #${matchingIssue.number}...`);
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

                        console.log(`✅ Issue closed successfully`);
                        return responseData;

                    } catch (parseError) {
                        console.error('❌ Failed to parse issue body:', parseError);
                        console.error('Raw body:', matchingIssue.body);
                        throw new Error(`Failed to parse authentication response: ${parseError.message}`);
                    }
                } else {
                    // Fallback: check across all states in case client closed or visibility lag
                    try {
                        const fallbackUrl = `https://api.github.com/repos/${window.GITHUB_CONFIG.owner}/${window.GITHUB_CONFIG.repo}/issues?state=all&per_page=100&sort=created&direction=desc&t=${Date.now()}`;
                        console.log(`🔎 Fallback fetching: ${fallbackUrl}`);
                        const fallbackResp = await fetch(fallbackUrl, {
                            headers: {
                                'Authorization': `token ${window.GITHUB_CONFIG.token}`,
                                'Accept': 'application/vnd.github.v3+json'
                            }
                        });

                        if (fallbackResp.ok) {
                            const allIssues = await fallbackResp.json();
                            const fallbackMatch = allIssues.find(issue => issue.title && issue.title.includes(searchTitle));
                            if (fallbackMatch) {
                                console.log(`✅ Found matching issue in fallback #${fallbackMatch.number}`);
                                const responseData = JSON.parse(fallbackMatch.body);
                                // Close the issue to keep the queue clean
                                await fetch(
                                    `https://api.github.com/repos/${window.GITHUB_CONFIG.owner}/${window.GITHUB_CONFIG.repo}/issues/${fallbackMatch.number}`,
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
                                console.log(`✅ Fallback issue closed successfully`);
                                return responseData;
                            }
                        } else {
                            console.warn(`⚠️ Fallback fetch failed: ${fallbackResp.status}`);
                        }
                    } catch (fallbackError) {
                        console.warn('⚠️ Fallback check error:', fallbackError);
                    }

                    console.log(`⏳ No matching issue found yet, waiting ${pollInterval}ms...`);
                }

            } catch (error) {
                console.error(`❌ Polling error on attempt #${pollCount}:`, error);
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        console.error(`⏰ Timeout reached after ${pollCount} polling attempts`);
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
            return { strength: 'none', message: '', color: '#ccc', score: 0, suggestions: [] };
        }

        // Prefer zxcvbn if available for robust analysis
        try {
            if (typeof window !== 'undefined' && typeof window.zxcvbn === 'function') {
                const result = window.zxcvbn(password);
                const scoreMap = ['very weak','weak','medium','strong','very strong'];
                const strength = scoreMap[Math.max(0, Math.min(4, result.score))];
                const colorMap = ['#e74c3c','#e67e22','#f39c12','#27ae60','#2ecc71'];
                const color = colorMap[Math.max(0, Math.min(4, result.score))];
                const suggestions = (result.feedback && result.feedback.suggestions) ? result.feedback.suggestions : [];
                const warning = (result.feedback && result.feedback.warning) ? result.feedback.warning : '';
                const message = warning || (strength.charAt(0).toUpperCase() + strength.slice(1));
                return { strength, message, color, score: result.score, suggestions };
            }
        } catch (e) {
            // Fall back to heuristic below
        }

        // Fallback heuristic if zxcvbn not present
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

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
        return { strength, message, color, score, suggestions: [] };
    },

    /**
     * Save user to localStorage
     */
    saveUserToStorage(user, rememberMe = false) {
        try {
            const storageSync = window.utils && window.utils.secureStorageSync;
            if (storageSync) {
                const ttl = 4 * 60 * 60 * 1000; // 4 hours
                storageSync.set('eventcall_user', user, { ttl });
                console.log('💾 User saved to secure session storage');
            } else {
                const storageType = rememberMe ? localStorage : sessionStorage;
                storageType.setItem('eventcall_user', JSON.stringify(user));
                console.log(`💾 User saved to ${rememberMe ? 'localStorage' : 'sessionStorage'}`);
            }
        } catch (error) {
            console.error('Failed to save user to storage:', error);
        }
    },

    /**
     * Load user from localStorage or sessionStorage
     */
    loadUserFromStorage() {
        try {
            const storageSync = window.utils && window.utils.secureStorageSync;
            if (storageSync) {
                const user = storageSync.get('eventcall_user');
                if (user) {
                    console.log('📥 User loaded from secure session storage:', user.username);
                    return user;
                }
            }
            // Compatibility fallback
            let saved = localStorage.getItem('eventcall_user');
            let source = 'localStorage';
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
            const storageSync = window.utils && window.utils.secureStorageSync;
            if (storageSync) {
                storageSync.remove('eventcall_user');
            }
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
    // Skip initialization in test mode
    if (window.__TEST_MODE__) {
        console.log('⚠️ Test mode detected - skipping auth initialization');
        return;
    }

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
            strengthIndicator.innerHTML = window.utils.sanitizeHTML(`
                <div class="strength-bar" style="background: ${result.color}; width: ${(result.score / 6) * 100}%"></div>
                <span class="strength-text" style="color: ${result.color}">${window.utils.escapeHTML(result.message)}</span>
            `);
        });
    }
});

// Make globally available
window.userAuth = userAuth;

console.log('✅ Username/password authentication system loaded');
