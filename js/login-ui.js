/**
 * EventCall Manager Login UI
 * Email + Access Code based login interface
 */

class LoginUI {
    constructor() {
        this.loginFormId = 'manager-login-form';
        this.registerFormId = 'manager-register-form';
    }

    /**
     * Show login page
     */
    showLoginPage() {
        console.log('🔐 Showing login page');
        
        const appContent = document.querySelector('.app-content');
        const nav = document.querySelector('.nav');
        
        if (appContent) appContent.style.display = 'none';
        if (nav) nav.style.display = 'none';
        
        this.renderLoginForm();
    }

    /**
     * Render login form HTML
     */
    renderLoginForm() {
        let loginContainer = document.getElementById('login-container');
        
        if (!loginContainer) {
            loginContainer = document.createElement('div');
            loginContainer.id = 'login-container';
            document.body.appendChild(loginContainer);
        }

        loginContainer.innerHTML = window.utils.sanitizeHTML(`
            <div class="login-wrapper">
                <div class="login-box">
                    <!-- Header -->
                    <div class="login-header">
                        <div class="login-logo">
                            🎖️
                        </div>
                        <h1>EVENTCALL</h1>
                        <p class="login-subtitle">Manager Access Portal</p>
                    </div>

                    <!-- Login Form -->
                    <form id="${this.loginFormId}" class="login-form">
                        <div class="form-group">
                            <label for="login-email">
                                <span class="icon">📧</span>
                                Email Address
                            </label>
                            <input 
                                type="email" 
                                id="login-email" 
                                placeholder="your.email@military.mil"
                                required
                                autocomplete="email"
                            >
                        </div>

                        <div class="form-group">
                            <label for="login-code">
                                <span class="icon">🔑</span>
                                Access Code
                            </label>
                            <input 
                                type="text" 
                                id="login-code" 
                                placeholder="EVT-MARINE-BALL-2025 or MGR-ALPHA-BRAVO-2025"
                                required
                                autocomplete="off"
                                style="text-transform: uppercase;"
                            >
                            <small class="help-text">
                                Enter your Manager Code (all events) or Event Code (specific event)
                            </small>
                        </div>

                        <div class="form-group checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="remember-me">
                                <span>Remember me on this device</span>
                            </label>
                        </div>

                        <button type="submit" class="btn btn-primary btn-large">
                            🔓 ACCESS EVENTS
                        </button>
                    </form>

                    <!-- Divider -->
                    <div class="login-divider">
                        <span>OR</span>
                    </div>

                    <!-- Register Link -->
                    <div class="login-footer">
                        <p>First time using EventCall?</p>
                        <button class="btn btn-secondary" onclick="loginUI.showRegisterForm()">
                            ✨ Create Manager Account
                        </button>
                    </div>

                    <!-- Help Text -->
                    <div class="login-help">
                        <p><strong>Need help?</strong></p>
                        <ul>
                            <li>• Contact your event organizer for an access code</li>
                            <li>• Manager codes start with <code>MGR-</code></li>
                            <li>• Event codes start with <code>EVT-</code></li>
                            <li>• Invite codes start with <code>INV-</code></li>
                        </ul>
                    </div>
                </div>
            </div>
        `);

        this.attachLoginListeners();
    }

    /**
     * Show registration form
     */
    showRegisterForm() {
        const loginContainer = document.getElementById('login-container');
        
        loginContainer.innerHTML = window.utils.sanitizeHTML(`
            <div class="login-wrapper">
                <div class="login-box">
                    <!-- Header -->
                    <div class="login-header">
                        <div class="login-logo">
                            ✨
                        </div>
                        <h1>CREATE MANAGER ACCOUNT</h1>
                        <p class="login-subtitle">Register to manage military events</p>
                    </div>

                    <!-- Register Form -->
                    <form id="${this.registerFormId}" class="login-form">
                        <div class="form-group">
                            <label for="register-name">
                                <span class="icon">👤</span>
                                Full Name
                            </label>
                            <input 
                                type="text" 
                                id="register-name" 
                                placeholder="John Smith"
                                required
                            >
                        </div>

                        <div class="form-group">
                            <label for="register-email">
                                <span class="icon">📧</span>
                                Email Address
                            </label>
                            <input 
                                type="email" 
                                id="register-email" 
                                placeholder="your.email@military.mil"
                                required
                            >
                            <small class="help-text">
                                Use your military or organization email
                            </small>
                        </div>

                        <button type="submit" class="btn btn-primary btn-large">
                            🚀 CREATE ACCOUNT
                        </button>
                    </form>

                    <!-- Back to Login -->
                    <div class="login-footer">
                        <button class="btn btn-text" onclick="loginUI.showLoginPage()">
                            ← Back to Login
                        </button>
                    </div>
                </div>
            </div>
        `);

        this.attachRegisterListeners();
    }

    /**
     * Attach login form listeners
     */
    attachLoginListeners() {
        const form = document.getElementById(this.loginFormId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        // Auto-uppercase access code
        const codeInput = document.getElementById('login-code');
        if (codeInput) {
            codeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    }

    /**
     * Attach register form listeners
     */
    attachRegisterListeners() {
        const form = document.getElementById(this.registerFormId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister();
        });
    }

    /**
     * Handle login submission
     */
    async handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const code = document.getElementById('login-code').value.trim().toUpperCase();
        const rememberMe = document.getElementById('remember-me').checked;
        const submitBtn = document.querySelector(`#${this.loginFormId} button[type="submit"]`);

        try {
            submitBtn.disabled = true;
        submitBtn.innerHTML = window.utils.sanitizeHTML('<div class="spinner"></div> Verifying...');

            const result = await window.managerAuth.login(email, code, rememberMe);

            if (result.success) {
                showToast(MESSAGES.auth.loginSuccess, 'success');
                
                // Hide login screen
                const loginContainer = document.getElementById('login-container');
                if (loginContainer) loginContainer.style.display = 'none';
                
                // Show app
                const appContent = document.querySelector('.app-content');
                const nav = document.querySelector('.nav');
                if (appContent) {
                    appContent.classList.remove('hidden');
                    appContent.style.display = 'block';
                }
                if (nav) nav.style.display = 'flex';
                
                // Navigate to dashboard
                showPage('dashboard');

                // Load events and responses from GitHub
                if (window.loadManagerData) {
                    await window.loadManagerData();
                }
            }

        } catch (error) {
            console.error('Login error:', error);
            showToast(error.message || 'Login failed. Please check your credentials.', 'error');
            
        } finally {
            submitBtn.disabled = false;
        submitBtn.innerHTML = window.utils.sanitizeHTML('🔓 ACCESS EVENTS');
        }
    }

    /**
     * Handle registration submission
     */
    async handleRegister() {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const submitBtn = document.querySelector(`#${this.registerFormId} button[type="submit"]`);

        try {
            submitBtn.disabled = true;
        submitBtn.innerHTML = window.utils.sanitizeHTML('<div class="spinner"></div> Creating Account...');

            const result = await window.managerAuth.registerManager(email, name);

            if (result.success) {
                // Show success with access code
                this.showAccessCodeModal(result.manager, result.masterCode);
            }

        } catch (error) {
            console.error('Registration error:', error);
            showToast(error.message || 'Registration failed. Please try again.', 'error');
            
        } finally {
            submitBtn.disabled = false;
        submitBtn.innerHTML = window.utils.sanitizeHTML('🚀 CREATE ACCOUNT');
        }
    }

    /**
     * Show access code modal after registration
     */
    showAccessCodeModal(manager, masterCode) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = window.utils.sanitizeHTML(`
            <div class="modal access-code-modal">
                <div class="modal-header">
                    <h2>✅ Account Created Successfully!</h2>
                </div>
                <div class="modal-body">
                    <div class="success-message">
                        <p>Welcome, <strong>${window.utils.escapeHTML(manager.name)}</strong>!</p>
                        <p>Your manager account has been created.</p>
                    </div>

                    <div class="access-code-display">
                        <label>🔑 Your Manager Access Code:</label>
                        <div class="code-box">
                            <code id="manager-code-display">${window.utils.escapeHTML(masterCode)}</code>
                            <button id="copy-code-btn" class="btn btn-icon" title="Copy to clipboard">
                                📋
                            </button>
                        </div>
                        <small class="help-text">
                            This code gives you access to all your events. Keep it secure!
                        </small>
                    </div>

                    <div class="info-box">
                        <h3>📌 Important Information:</h3>
                        <ul>
                            <li>✅ Save this code in a secure location</li>
                            <li>✅ Use this code to log in from any device</li>
                            <li>✅ You'll also receive event-specific codes when you create events</li>
                            <li>✅ Share event codes (not this master code) with co-managers</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="proceed-btn" class="btn btn-primary">
                        Continue to Dashboard
                    </button>
                </div>
            </div>
        `);

        document.body.appendChild(modal);
        const copyBtn = modal.querySelector('#copy-code-btn');
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyCode(masterCode));
        const proceedBtn = modal.querySelector('#proceed-btn');
        if (proceedBtn) proceedBtn.addEventListener('click', () => this.proceedAfterRegistration(manager.email, masterCode));
    }

    /**
     * Copy code to clipboard
     */
    copyCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('✅ Code copied to clipboard!', 'success');
        }).catch(() => {
            showToast('❌ Failed to copy code', 'error');
        });
    }

    /**
     * Proceed to dashboard after registration
     */
    async proceedAfterRegistration(email, masterCode) {
        // Close modal
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();

        // Auto-login with new credentials
        try {
            const result = await window.managerAuth.login(email, masterCode, true);
            
            if (result.success) {
                showToast('Welcome to EventCall! 🎉', 'success');
                
                // Hide login screen
                const loginContainer = document.getElementById('login-container');
                if (loginContainer) loginContainer.style.display = 'none';
                
                // Show app
                const appContent = document.querySelector('.app-content');
                const nav = document.querySelector('.nav');
                if (appContent) {
                    appContent.classList.remove('hidden');
                    appContent.style.display = 'block';
                }
                if (nav) nav.style.display = 'flex';
                
                // Navigate to create event
                showPage('create');
            }
        } catch (error) {
            console.error('Auto-login failed:', error);
            this.showLoginPage();
        }
    }

 hideLoginScreen() {
        const loginContainer = document.getElementById('login-container');
        if (loginContainer) {
            loginContainer.style.display = 'none';
        }
    }

    showUserMenu() {
        const manager = window.managerAuth.getCurrentManager();
        if (!manager) return;

        const existing = document.querySelector('.user-menu-dropdown');
        if (existing) {
            existing.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.className = 'user-menu-dropdown';
        menu.innerHTML = window.utils.sanitizeHTML(`
            <div class="user-menu-header">
                <strong>${window.utils.escapeHTML(manager.name)}</strong>
                <small>${window.utils.escapeHTML(manager.email)}</small>
            </div>
            <div class="user-menu-item" data-action="dashboard">
                📊 Dashboard
            </div>
            <div class="user-menu-item" data-action="create">
                ➕ Create Event
            </div>
            <div class="user-menu-divider"></div>
            <div class="user-menu-item" data-action="logout">
                🚪 Logout
            </div>
        `);

        const userBtn = document.querySelector('.user-profile-btn');
        if (userBtn) {
            userBtn.appendChild(menu);
            const dashboard = menu.querySelector('[data-action="dashboard"]');
            const create = menu.querySelector('[data-action="create"]');
            const logout = menu.querySelector('[data-action="logout"]');
            if (dashboard) dashboard.addEventListener('click', () => window.showPage('dashboard'));
            if (create) create.addEventListener('click', () => window.showPage('create'));
            if (logout) logout.addEventListener('click', () => this.handleLogout());
        }
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            window.managerAuth.logout();
            location.reload();
        }
    }
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.loginUI = new LoginUI();
}

console.log('✅ Login UI Component loaded');

// Escape user-facing strings (errors, prompts, etc.)
function showLoginError(msg) {
    const h = window.utils.escapeHTML;
    document.getElementById('login-error').innerHTML = window.utils.sanitizeHTML(`
        <div class="error">${h(msg || 'Unknown error')}</div>
    `);
}
