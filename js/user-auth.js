/**
 * EventCall User Authentication
 * Handles email-based user identification and event filtering
 */

class UserAuth {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.setupComplete = false;
    }

    /**
     * Initialize user authentication
     */
    async initialize() {
        // Always show welcome page first (disable auto-login)
        // const savedUser = this.getSavedUser();
        // if (savedUser && this.isValidEmail(savedUser.email)) {
        //     this.currentUser = savedUser;
        //     this.isLoggedIn = true;
        //     this.setupComplete = true;
        //     console.log('User auto-logged in:', savedUser.email);
        //     return true;
        // } else {
            await this.showWelcomePage();
            return this.isLoggedIn;
        // }
    }

    /**
     * Show welcome/landing page
     */
    async showWelcomePage() {
        return new Promise((resolve) => {
            this.createWelcomeModal(resolve);
        });
    }

    /**
     * Create welcome modal with app overview
     * @param {Function} resolve - Promise resolve function
     */
    createWelcomeModal(resolve) {
        // Hide main app content
        document.querySelector('.header').style.display = 'none';
        document.querySelector('.container').style.display = 'none';
        document.querySelector('.footer').style.display = 'none';

        // Create welcome overlay
        const welcomeOverlay = document.createElement('div');
        welcomeOverlay.id = 'welcome-overlay';
        welcomeOverlay.innerHTML = `
            <div class="welcome-container">
                <!-- Hero Section -->
                <div class="welcome-hero">
                    <div class="welcome-logo">
                        <div class="logo-icon">🎖️</div>
                        <h1>EventCall</h1>
                        <p class="tagline">Where Every Event Matters</p>
                    </div>
                    
                    <div class="hero-description">
                        <h2>Professional Military Event Management</h2>
                        <p>Streamline your ceremonies, promotions, retirements, and special events with military precision.</p>
                    </div>
                </div>

                <!-- Features Section -->
                <div class="welcome-features">
                    <div class="feature-grid">
                        <div class="feature-card">
                            <div class="feature-icon">🚀</div>
                            <h3>Deploy Events Instantly</h3>
                            <p>Create professional event invitations with military precision. Set date, time, location, and custom details.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">📊</div>
                            <h3>Real-Time RSVP Tracking</h3>
                            <p>Monitor attendance in real-time. Get accurate headcounts, guest numbers, and response analytics.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">🔗</div>
                            <h3>Share Anywhere</h3>
                            <p>Generate shareable invite links that work on any device. No apps required for your guests.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">☁️</div>
                            <h3>Cloud Synchronized</h3>
                            <p>Access your events from any device. Data automatically syncs and backs up to the cloud.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">🔒</div>
                            <h3>Private & Secure</h3>
                            <p>Your events are private to you. Only people with invite links can RSVP. No account creation needed.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">📱</div>
                            <h3>Mobile Ready</h3>
                            <p>Works perfectly on phones, tablets, and computers. Responsive design for all screen sizes.</p>
                        </div>
                    </div>
                </div>

                <!-- Perfect For Section -->
                <div class="welcome-perfect-for">
                    <h2>Perfect for Military Events</h2>
                    <div class="event-types">
                        <div class="event-type">🎖️ Retirement Ceremonies</div>
                        <div class="event-type">📈 Promotion Celebrations</div>
                        <div class="event-type">🏛️ Change of Command</div>
                        <div class="event-type">🎉 Unit Gatherings</div>
                        <div class="event-type">👥 Family Events</div>
                        <div class="event-type">🏆 Awards Ceremonies</div>
                    </div>
                </div>

                <!-- Get Started Section -->
                <div class="welcome-get-started">
                    <div class="get-started-card">
                        <h2>Ready to Begin Your Mission?</h2>
                        <p>Enter your email address to start creating professional military events. No passwords, no complex setup - just enter your email and go.</p>
                        
                        <form id="welcome-auth-form" class="welcome-form">
                            <div class="form-group">
                                <label for="welcome-email">Military/Work Email Address</label>
                                <input type="email" id="welcome-email" required 
                                       placeholder="your.name@military.mil" 
                                       autocomplete="email">
                                <small>This identifies your events and keeps them private to you</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="welcome-name">Display Name (Optional)</label>
                                <input type="text" id="welcome-name" 
                                       placeholder="Rank FirstName LastName"
                                       autocomplete="name">
                                <small>How your name appears on events you create</small>
                            </div>
                            
                            <div class="form-group checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="welcome-remember" checked>
                                    <span class="checkmark"></span>
                                    Remember me on this device
                                </label>
                            </div>
                            
                            <button type="submit" class="welcome-btn">
                                🚀 Access EventCall
                            </button>
                        </form>
                        
                        <div class="privacy-note">
                            <div class="privacy-icon">🛡️</div>
                            <div class="privacy-text">
                                <strong>Complete Privacy Guaranteed</strong><br>
                                Your email is stored locally and used only for event filtering. 
                                No passwords • No account creation • No data sharing
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Powered By -->
                <div class="welcome-footer">
                    <div class="powered-by">
                        <div class="powered-text">Powered by</div>
                        <div class="powered-logo" onclick="window.open('https://linktr.ee/semperadmin', '_blank')">
                            SEMPER ADMIN
                        </div>
                        <div class="powered-tagline">Professional Military Solutions</div>
                    </div>
                </div>
            </div>
        `;

        // Add welcome styles
        const welcomeStyles = document.createElement('style');
        welcomeStyles.textContent = `
            #welcome-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, var(--semper-navy) 0%, var(--primary-color) 50%, var(--semper-red) 100%);
                z-index: 20000;
                overflow-y: auto;
                color: white;
            }
            
            .welcome-container {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            
            /* Hero Section */
            .welcome-hero {
                text-align: center;
                padding: 3rem 2rem;
                background: linear-gradient(45deg, transparent 30%, rgba(255, 215, 0, 0.1) 50%, transparent 70%);
            }
            
            .welcome-logo {
                margin-bottom: 2rem;
            }
            
            .logo-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            
            .welcome-logo h1 {
                font-size: 3.5rem;
                font-weight: 900;
                margin-bottom: 0.5rem;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            }
            
            .tagline {
                font-size: 1.25rem;
                color: var(--semper-gold);
                font-style: italic;
                opacity: 0.9;
            }
            
            .hero-description h2 {
                font-size: 2rem;
                margin-bottom: 1rem;
                color: var(--semper-gold);
            }
            
            .hero-description p {
                font-size: 1.1rem;
                opacity: 0.9;
                max-width: 600px;
                margin: 0 auto;
                line-height: 1.6;
            }
            
            /* Features Section */
            .welcome-features {
                background: rgba(255, 255, 255, 0.1);
                padding: 4rem 2rem;
                backdrop-filter: blur(10px);
            }
            
            .feature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 2rem;
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .feature-card {
                background: rgba(255, 255, 255, 0.1);
                padding: 2rem;
                border-radius: 1rem;
                text-align: center;
                border: 2px solid rgba(255, 215, 0, 0.3);
                transition: all 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            .feature-card:hover {
                transform: translateY(-5px);
                border-color: var(--semper-gold);
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            
            .feature-icon {
                font-size: 2.5rem;
                margin-bottom: 1rem;
            }
            
            .feature-card h3 {
                font-size: 1.25rem;
                font-weight: 700;
                margin-bottom: 1rem;
                color: var(--semper-gold);
            }
            
            .feature-card p {
                opacity: 0.9;
                line-height: 1.6;
            }
            
            /* Perfect For Section */
            .welcome-perfect-for {
                padding: 4rem 2rem;
                text-align: center;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .welcome-perfect-for h2 {
                font-size: 2rem;
                margin-bottom: 2rem;
                color: var(--semper-gold);
            }
            
            .event-types {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1rem;
                max-width: 800px;
                margin: 0 auto;
            }
            
            .event-type {
                background: rgba(255, 215, 0, 0.2);
                padding: 1rem;
                border-radius: 0.5rem;
                font-weight: 600;
                border: 1px solid rgba(255, 215, 0, 0.3);
            }
            
            /* Get Started Section */
            .welcome-get-started {
                padding: 4rem 2rem;
                background: rgba(255, 255, 255, 0.05);
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .get-started-card {
                background: rgba(255, 255, 255, 0.1);
                padding: 3rem;
                border-radius: 1.5rem;
                max-width: 500px;
                width: 100%;
                border: 3px solid var(--semper-gold);
                backdrop-filter: blur(10px);
            }
            
            .get-started-card h2 {
                text-align: center;
                font-size: 1.75rem;
                margin-bottom: 1rem;
                color: var(--semper-gold);
            }
            
            .get-started-card > p {
                text-align: center;
                margin-bottom: 2rem;
                opacity: 0.9;
                line-height: 1.6;
            }
            
            .welcome-form .form-group {
                margin-bottom: 1.5rem;
            }
            
            .welcome-form label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: var(--semper-gold);
            }
            
            .welcome-form input[type="email"],
            .welcome-form input[type="text"] {
                width: 100%;
                padding: 1rem;
                border: 2px solid rgba(255, 215, 0, 0.3);
                border-radius: 0.5rem;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                font-size: 1rem;
                transition: border-color 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            .welcome-form input[type="email"]:focus,
            .welcome-form input[type="text"]:focus {
                outline: none;
                border-color: var(--semper-gold);
                box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
            }
            
            .welcome-form input::placeholder {
                color: rgba(255, 255, 255, 0.6);
            }
            
            .welcome-form small {
                display: block;
                margin-top: 0.5rem;
                font-size: 0.875rem;
                opacity: 0.8;
                color: rgba(255, 215, 0, 0.8);
            }
            
            .checkbox-group {
                display: flex;
                align-items: center;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-weight: normal !important;
                margin-bottom: 0 !important;
            }
            
            .checkbox-label input[type="checkbox"] {
                margin-right: 0.75rem;
                width: auto;
                transform: scale(1.2);
            }
            
            .welcome-btn {
                width: 100%;
                background: linear-gradient(135deg, var(--semper-gold) 0%, #e6c200 100%);
                color: var(--semper-navy);
                border: none;
                padding: 1.25rem;
                border-radius: 0.75rem;
                font-size: 1.25rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-top: 1rem;
            }
            
            .welcome-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(255, 215, 0, 0.4);
            }
            
            .privacy-note {
                display: flex;
                align-items: flex-start;
                gap: 1rem;
                margin-top: 2rem;
                padding: 1rem;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 0.75rem;
                border-left: 4px solid var(--semper-gold);
            }
            
            .privacy-icon {
                font-size: 1.5rem;
                flex-shrink: 0;
            }
            
            .privacy-text {
                font-size: 0.875rem;
                line-height: 1.5;
            }
            
            /* Footer */
            .welcome-footer {
                padding: 2rem;
                text-align: center;
                background: rgba(0, 0, 0, 0.3);
                border-top: 1px solid rgba(255, 215, 0, 0.3);
            }
            
            .powered-by {
                opacity: 0.8;
            }
            
            .powered-text {
                font-size: 0.875rem;
                margin-bottom: 0.5rem;
            }
            
            .powered-logo {
                font-size: 1.25rem;
                font-weight: 900;
                color: var(--semper-gold);
                cursor: pointer;
                transition: all 0.3s ease;
                margin-bottom: 0.25rem;
            }
            
            .powered-logo:hover {
                transform: scale(1.05);
                opacity: 1;
            }
            
            .powered-tagline {
                font-size: 0.75rem;
                opacity: 0.7;
            }
            
            /* Mobile Responsive */
            @media (max-width: 768px) {
                .welcome-hero {
                    padding: 2rem 1rem;
                }
                
                .welcome-logo h1 {
                    font-size: 2.5rem;
                }
                
                .hero-description h2 {
                    font-size: 1.5rem;
                }
                
                .welcome-features {
                    padding: 2rem 1rem;
                }
                
                .feature-grid {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
                
                .feature-card {
                    padding: 1.5rem;
                }
                
                .welcome-perfect-for {
                    padding: 2rem 1rem;
                }
                
                .event-types {
                    grid-template-columns: 1fr;
                }
                
                .welcome-get-started {
                    padding: 2rem 1rem;
                }
                
                .get-started-card {
                    padding: 2rem;
                }
                
                .get-started-card h2 {
                    font-size: 1.5rem;
                }
            }
        `;

        document.head.appendChild(welcomeStyles);
        document.body.appendChild(welcomeOverlay);

        // Handle form submission
        document.getElementById('welcome-auth-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleWelcomeLogin(e, welcomeOverlay, resolve);
        });

        // Focus email input after animation
        setTimeout(() => {
            document.getElementById('welcome-email').focus();
        }, 500);
    }

    /**
     * Handle welcome page login
     * @param {Event} e - Form event
     * @param {Element} overlay - Welcome overlay
     * @param {Function} resolve - Promise resolve
     */
    handleWelcomeLogin(e, overlay, resolve) {
        const email = document.getElementById('welcome-email').value.trim();
        const name = document.getElementById('welcome-name').value.trim();
        const remember = document.getElementById('welcome-remember').checked;

        // Validate email
        if (!this.isValidEmail(email)) {
            this.showWelcomeError('Please enter a valid email address');
            return;
        }

        // Create user object
        const user = {
            email: email.toLowerCase(),
            name: name || this.generateDisplayName(email),
            loginTime: Date.now(),
            remember: remember
        };

        // Save user
        this.currentUser = user;
        this.isLoggedIn = true;
        this.setupComplete = true;

        if (remember) {
            this.saveUser(user);
        }

        // Animate out welcome page
        overlay.style.transform = 'translateY(-100%)';
        overlay.style.transition = 'transform 0.8s ease-in-out';

        setTimeout(() => {
            // Show main app content
            document.querySelector('.header').style.display = 'flex';
            document.querySelector('.container').style.display = 'block';
            document.querySelector('.footer').style.display = 'block';

            // Remove overlay
            overlay.remove();
            
            // Show welcome message
            console.log('User authenticated:', user.email);
            
            // Resolve the promise to continue app initialization
            resolve(true);
        }, 800);
    }

    /**
     * Generate display name from email
     * @param {string} email - Email address
     * @returns {string} Display name
     */
    generateDisplayName(email) {
        const username = email.split('@')[0];
        // Convert john.smith or john_smith to John Smith
        return username
            .replace(/[._]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Show welcome form error
     * @param {string} message - Error message
     */
    showWelcomeError(message) {
        // Remove existing error
        const existingError = document.querySelector('.welcome-error');
        if (existingError) {
            existingError.remove();
        }

        // Add new error
        const error = document.createElement('div');
        error.className = 'welcome-error';
        error.style.cssText = `
            background: var(--error-color);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-top: 1rem;
            font-weight: 600;
            text-align: center;
            animation: shake 0.5s ease-in-out;
        `;
        error.textContent = message;

        // Add shake animation
        const shakeKeyframes = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
        `;
        
        if (!document.querySelector('#shake-animation')) {
            const style = document.createElement('style');
            style.id = 'shake-animation';
            style.textContent = shakeKeyframes;
            document.head.appendChild(style);
        }

        const form = document.getElementById('welcome-auth-form');
        form.appendChild(error);

        // Remove after 4 seconds
        setTimeout(() => error.remove(), 4000);
    }

    /**
     * Save user to localStorage
     * @param {Object} user - User object
     */
    saveUser(user) {
        try {
            localStorage.setItem('eventcall_user', JSON.stringify(user));
        } catch (error) {
            console.error('Failed to save user:', error);
        }
    }

    /**
     * Get saved user from localStorage
     * @returns {Object|null} User object or null
     */
    getSavedUser() {
        try {
            const saved = localStorage.getItem('eventcall_user');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to get saved user:', error);
            return null;
        }
    }

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid
     */
    isValidEmail(email) {
        return VALIDATION.email.test(email);
    }

    /**
     * Get current user email
     * @returns {string} User email
     */
    getCurrentUserEmail() {
        return this.currentUser ? this.currentUser.email : null;
    }

    /**
     * Get current user name
     * @returns {string} User name
     */
    getCurrentUserName() {
        return this.currentUser ? this.currentUser.name : 'Unknown User';
    }

    /**
     * Check if current user owns an event
     * @param {Object} event - Event object
     * @returns {boolean} User owns event
     */
    userOwnsEvent(event) {
        if (!this.currentUser || !event) return false;
        return event.createdBy === this.currentUser.email;
    }

    /**
     * Filter events for current user
     * @param {Object} allEvents - All events object
     * @returns {Object} User's events
     */
    filterUserEvents(allEvents) {
        if (!this.currentUser) return {};

        const userEvents = {};
        Object.keys(allEvents).forEach(eventId => {
            const event = allEvents[eventId];
            if (this.userOwnsEvent(event)) {
                userEvents[eventId] = event;
            }
        });

        return userEvents;
    }

    /**
     * Add user information to event data
     * @param {Object} eventData - Event data
     * @returns {Object} Event data with user info
     */
    addUserToEvent(eventData) {
        if (!this.currentUser) return eventData;

        return {
            ...eventData,
            createdBy: this.currentUser.email,
            createdByName: this.currentUser.name
        };
    }

    /**
     * Logout current user
     */
    logout() {
        // Clear user data
        this.currentUser = null;
        this.isLoggedIn = false;
        this.setupComplete = false;

        // Clear localStorage
        localStorage.removeItem('eventcall_user');

        // Show toast
        showToast('👋 Logged out successfully', 'success');

        // Reload page to reset state
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    /**
     * Show user profile/settings
     */
    showUserProfile() {
        if (!this.currentUser) return;

        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 20, 25, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 1rem; max-width: 500px; width: 90%; padding: 0; overflow: hidden; border: 3px solid var(--semper-gold);">
                <div style="background: linear-gradient(135deg, var(--semper-navy) 0%, var(--semper-red) 100%); color: white; padding: 2rem; text-align: center;">
                    <h2 style="margin-bottom: 0.5rem;">👤 User Profile</h2>
                    <p style="opacity: 0.9; color: var(--semper-gold);">Manage your EventCall account</p>
                </div>
                
                <div style="padding: 2rem;">
                    <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                        <div style="margin-bottom: 1rem;"><strong>📧 Email:</strong> ${this.currentUser.email}</div>
                        <div style="margin-bottom: 1rem;"><strong>👤 Display Name:</strong> ${this.currentUser.name}</div>
                        <div><strong>🕐 Login Time:</strong> ${new Date(this.currentUser.loginTime).toLocaleString()}</div>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button style="flex: 1; min-width: 120px;" class="btn btn-danger" onclick="userAuth.logout()">🚪 Logout</button>
                        <button style="flex: 1; min-width: 120px;" class="btn btn-secondary" onclick="this.closest('div[style*=\"position: fixed\"]').remove()">❌ Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Get user statistics
     * @returns {Object} User stats
     */
    getUserStats() {
        if (!this.currentUser) return { events: 0, totalRSVPs: 0 };

        const allEvents = window.events || {};
        const allResponses = window.responses || {};
        const userEvents = this.filterUserEvents(allEvents);
        const eventCount = Object.keys(userEvents).length;
        
        let totalRSVPs = 0;
        Object.keys(userEvents).forEach(eventId => {
            const eventResponses = allResponses[eventId] || [];
            totalRSVPs += eventResponses.length;
        });

        return {
            events: eventCount,
            totalRSVPs: totalRSVPs,
            email: this.currentUser.email,
            name: this.currentUser.name
        };
    }
}

    /**
     * Initialize user authentication
     */
    async initialize() {
        // Check if user is already logged in
        const savedUser = this.getSavedUser();
        
        if (savedUser && this.isValidEmail(savedUser.email)) {
            this.currentUser = savedUser;
            this.isLoggedIn = true;
            this.setupComplete = true;
            console.log('User auto-logged in:', savedUser.email);
            return true;
        } else {
            // Show welcome page first
            await this.showWelcomePage();
            return this.isLoggedIn;
        }
    }

    /**
     * Show welcome/landing page
     */
    async showWelcomePage() {
        return new Promise((resolve) => {
            this.createWelcomeModal(resolve);
        });
    }

    /**
     * Create welcome modal with app overview
     * @param {Function} resolve - Promise resolve function
     */
    createWelcomeModal(resolve) {
        // Hide main app content
        document.querySelector('.header').style.display = 'none';
        document.querySelector('.container').style.display = 'none';
        document.querySelector('.footer').style.display = 'none';

        // Create welcome overlay
        const welcomeOverlay = document.createElement('div');
        welcomeOverlay.id = 'welcome-overlay';
        welcomeOverlay.innerHTML = `
            <div class="welcome-container">
                <!-- Hero Section -->
                <div class="welcome-hero">
                    <div class="welcome-logo">
                        <div class="logo-icon">🎖️</div>
                        <h1>EventCall</h1>
                        <p class="tagline">Where Every Event Matters</p>
                    </div>
                    
                    <div class="hero-description">
                        <h2>Professional Military Event Management</h2>
                        <p>Streamline your ceremonies, promotions, retirements, and special events with military precision.</p>
                    </div>
                </div>

                <!-- Features Section -->
                <div class="welcome-features">
                    <div class="feature-grid">
                        <div class="feature-card">
                            <div class="feature-icon">🚀</div>
                            <h3>Deploy Events Instantly</h3>
                            <p>Create professional event invitations with military precision. Set date, time, location, and custom details.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">📊</div>
                            <h3>Real-Time RSVP Tracking</h3>
                            <p>Monitor attendance in real-time. Get accurate headcounts, guest numbers, and response analytics.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">🔗</div>
                            <h3>Share Anywhere</h3>
                            <p>Generate shareable invite links that work on any device. No apps required for your guests.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">☁️</div>
                            <h3>Cloud Synchronized</h3>
                            <p>Access your events from any device. Data automatically syncs and backs up to the cloud.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">🔒</div>
                            <h3>Private & Secure</h3>
                            <p>Your events are private to you. Only people with invite links can RSVP. No account creation needed.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">📱</div>
                            <h3>Mobile Ready</h3>
                            <p>Works perfectly on phones, tablets, and computers. Responsive design for all screen sizes.</p>
                        </div>
                    </div>
                </div>

                <!-- Perfect For Section -->
                <div class="welcome-perfect-for">
                    <h2>Perfect for Military Events</h2>
                    <div class="event-types">
                        <div class="event-type">🎖️ Retirement Ceremonies</div>
                        <div class="event-type">📈 Promotion Celebrations</div>
                        <div class="event-type">🏛️ Change of Command</div>
                        <div class="event-type">🎉 Unit Gatherings</div>
                        <div class="event-type">👥 Family Events</div>
                        <div class="event-type">🏆 Awards Ceremonies</div>
                    </div>
                </div>

                <!-- Get Started Section -->
                <div class="welcome-get-started">
                    <div class="get-started-card">
                        <h2>Ready to Begin Your Mission?</h2>
                        <p>Enter your email address to start creating professional military events. No passwords, no complex setup - just enter your email and go.</p>
                        
                        <form id="welcome-auth-form" class="welcome-form">
                            <div class="form-group">
                                <label for="welcome-email">Military/Work Email Address</label>
                                <input type="email" id="welcome-email" required 
                                       placeholder="your.name@military.mil" 
                                       autocomplete="email">
                                <small>This identifies your events and keeps them private to you</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="welcome-name">Display Name (Optional)</label>
                                <input type="text" id="welcome-name" 
                                       placeholder="Rank FirstName LastName"
                                       autocomplete="name">
                                <small>How your name appears on events you create</small>
                            </div>
                            
                            <div class="form-group checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="welcome-remember" checked>
                                    <span class="checkmark"></span>
                                    Remember me on this device
                                </label>
                            </div>
                            
                            <button type="submit" class="welcome-btn">
                                🚀 Access EventCall
                            </button>
                        </form>
                        
                        <div class="privacy-note">
                            <div class="privacy-icon">🛡️</div>
                            <div class="privacy-text">
                                <strong>Complete Privacy Guaranteed</strong><br>
                                Your email is stored locally and used only for event filtering. 
                                No passwords • No account creation • No data sharing
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Powered By -->
                <div class="welcome-footer">
                    <div class="powered-by">
                        <div class="powered-text">Powered by</div>
                        <div class="powered-logo" onclick="window.open('https://linktr.ee/semperadmin', '_blank')">
                            SEMPER ADMIN
                        </div>
                        <div class="powered-tagline">Professional Military Solutions</div>
                    </div>
                </div>
            </div>
        `;

        // Add welcome styles
        const welcomeStyles = document.createElement('style');
        welcomeStyles.textContent = `
            #welcome-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, var(--semper-navy) 0%, var(--primary-color) 50%, var(--semper-red) 100%);
                z-index: 20000;
                overflow-y: auto;
                color: white;
            }
            
            .welcome-container {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            
            /* Hero Section */
            .welcome-hero {
                text-align: center;
                padding: 3rem 2rem;
                background: linear-gradient(45deg, transparent 30%, rgba(255, 215, 0, 0.1) 50%, transparent 70%);
            }
            
            .welcome-logo {
                margin-bottom: 2rem;
            }
            
            .logo-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            
            .welcome-logo h1 {
                font-size: 3.5rem;
                font-weight: 900;
                margin-bottom: 0.5rem;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            }
            
            .tagline {
                font-size: 1.25rem;
                color: var(--semper-gold);
                font-style: italic;
                opacity: 0.9;
            }
            
            .hero-description h2 {
                font-size: 2rem;
                margin-bottom: 1rem;
                color: var(--semper-gold);
            }
            
            .hero-description p {
                font-size: 1.1rem;
                opacity: 0.9;
                max-width: 600px;
                margin: 0 auto;
                line-height: 1.6;
            }
            
            /* Features Section */
            .welcome-features {
                background: rgba(255, 255, 255, 0.1);
                padding: 4rem 2rem;
                backdrop-filter: blur(10px);
            }
            
            .feature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 2rem;
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .feature-card {
                background: rgba(255, 255, 255, 0.1);
                padding: 2rem;
                border-radius: 1rem;
                text-align: center;
                border: 2px solid rgba(255, 215, 0, 0.3);
                transition: all 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            .feature-card:hover {
                transform: translateY(-5px);
                border-color: var(--semper-gold);
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            
            .feature-icon {
                font-size: 2.5rem;
                margin-bottom: 1rem;
            }
            
            .feature-card h3 {
                font-size: 1.25rem;
                font-weight: 700;
                margin-bottom: 1rem;
                color: var(--semper-gold);
            }
            
            .feature-card p {
                opacity: 0.9;
                line-height: 1.6;
            }
            
            /* Perfect For Section */
            .welcome-perfect-for {
                padding: 4rem 2rem;
                text-align: center;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .welcome-perfect-for h2 {
                font-size: 2rem;
                margin-bottom: 2rem;
                color: var(--semper-gold);
            }
            
            .event-types {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1rem;
                max-width: 800px;
                margin: 0 auto;
            }
            
            .event-type {
                background: rgba(255, 215, 0, 0.2);
                padding: 1rem;
                border-radius: 0.5rem;
                font-weight: 600;
                border: 1px solid rgba(255, 215, 0, 0.3);
            }
            
            /* Get Started Section */
            .welcome-get-started {
                padding: 4rem 2rem;
                background: rgba(255, 255, 255, 0.05);
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .get-started-card {
                background: rgba(255, 255, 255, 0.1);
                padding: 3rem;
                border-radius: 1.5rem;
                max-width: 500px;
                width: 100%;
                border: 3px solid var(--semper-gold);
                backdrop-filter: blur(10px);
            }
            
            .get-started-card h2 {
                text-align: center;
                font-size: 1.75rem;
                margin-bottom: 1rem;
                color: var(--semper-gold);
            }
            
            .get-started-card > p {
                text-align: center;
                margin-bottom: 2rem;
                opacity: 0.9;
                line-height: 1.6;
            }
            
            .welcome-form .form-group {
                margin-bottom: 1.5rem;
            }
            
            .welcome-form label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: var(--semper-gold);
            }
            
            .welcome-form input[type="email"],
            .welcome-form input[type="text"] {
                width: 100%;
                padding: 1rem;
                border: 2px solid rgba(255, 215, 0, 0.3);
                border-radius: 0.5rem;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                font-size: 1rem;
                transition: border-color 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            .welcome-form input[type="email"]:focus,
            .welcome-form input[type="text"]:focus {
                outline: none;
                border-color: var(--semper-gold);
                box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
            }
            
            .welcome-form input::placeholder {
                color: rgba(255, 255, 255, 0.6);
            }
            
            .welcome-form small {
                display: block;
                margin-top: 0.5rem;
                font-size: 0.875rem;
                opacity: 0.8;
                color: rgba(255, 215, 0, 0.8);
            }
            
            .checkbox-group {
                display: flex;
                align-items: center;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-weight: normal !important;
                margin-bottom: 0 !important;
            }
            
            .checkbox-label input[type="checkbox"] {
                margin-right: 0.75rem;
                width: auto;
                transform: scale(1.2);
            }
            
            .welcome-btn {
                width: 100%;
                background: linear-gradient(135deg, var(--semper-gold) 0%, #e6c200 100%);
                color: var(--semper-navy);
                border: none;
                padding: 1.25rem;
                border-radius: 0.75rem;
                font-size: 1.25rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-top: 1rem;
            }
            
            .welcome-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(255, 215, 0, 0.4);
            }
            
            .privacy-note {
                display: flex;
                align-items: flex-start;
                gap: 1rem;
                margin-top: 2rem;
                padding: 1rem;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 0.75rem;
                border-left: 4px solid var(--semper-gold);
            }
            
            .privacy-icon {
                font-size: 1.5rem;
                flex-shrink: 0;
            }
            
            .privacy-text {
                font-size: 0.875rem;
                line-height: 1.5;
            }
            
            /* Footer */
            .welcome-footer {
                padding: 2rem;
                text-align: center;
                background: rgba(0, 0, 0, 0.3);
                border-top: 1px solid rgba(255, 215, 0, 0.3);
            }
            
            .powered-by {
                opacity: 0.8;
            }
            
            .powered-text {
                font-size: 0.875rem;
                margin-bottom: 0.5rem;
            }
            
            .powered-logo {
                font-size: 1.25rem;
                font-weight: 900;
                color: var(--semper-gold);
                cursor: pointer;
                transition: all 0.3s ease;
                margin-bottom: 0.25rem;
            }
            
            .powered-logo:hover {
                transform: scale(1.05);
                opacity: 1;
            }
            
            .powered-tagline {
                font-size: 0.75rem;
                opacity: 0.7;
            }
            
            /* Mobile Responsive */
            @media (max-width: 768px) {
                .welcome-hero {
                    padding: 2rem 1rem;
                }
                
                .welcome-logo h1 {
                    font-size: 2.5rem;
                }
                
                .hero-description h2 {
                    font-size: 1.5rem;
                }
                
                .welcome-features {
                    padding: 2rem 1rem;
                }
                
                .feature-grid {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
                
                .feature-card {
                    padding: 1.5rem;
                }
                
                .welcome-perfect-for {
                    padding: 2rem 1rem;
                }
                
                .event-types {
                    grid-template-columns: 1fr;
                }
                
                .welcome-get-started {
                    padding: 2rem 1rem;
                }
                
                .get-started-card {
                    padding: 2rem;
                }
                
                .get-started-card h2 {
                    font-size: 1.5rem;
                }
            }
        `;

        document.head.appendChild(welcomeStyles);
        document.body.appendChild(welcomeOverlay);

        // Handle form submission
        document.getElementById('welcome-auth-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleWelcomeLogin(e, welcomeOverlay, resolve);
        });

        // Focus email input after animation
        setTimeout(() => {
            document.getElementById('welcome-email').focus();
        }, 500);
    }

    /**
     * Handle welcome page login
     * @param {Event} e - Form event
     * @param {Element} overlay - Welcome overlay
     * @param {Function} resolve - Promise resolve
     */
    handleWelcomeLogin(e, overlay, resolve) {
        const email = document.getElementById('welcome-email').value.trim();
        const name = document.getElementById('welcome-name').value.trim();
        const remember = document.getElementById('welcome-remember').checked;

        // Validate email
        if (!this.isValidEmail(email)) {
            this.showWelcomeError('Please enter a valid email address');
            return;
        }

        // Create user object
        const user = {
            email: email.toLowerCase(),
            name: name || this.generateDisplayName(email),
            loginTime: Date.now(),
            remember: remember
        };

        // Save user
        this.currentUser = user;
        this.isLoggedIn = true;
        this.setupComplete = true;

        if (remember) {
            this.saveUser(user);
        }

        // Animate out welcome page
        overlay.style.transform = 'translateY(-100%)';
        overlay.style.transition = 'transform 0.8s ease-in-out';

        setTimeout(() => {
            // Remove overlay
            overlay.remove();
            
            // Show welcome message
            console.log('User authenticated:', user.email);
            
            // Resolve the promise to continue app initialization
            resolve(true);
        }, 800);
    }

    /**
     * Generate display name from email
     * @param {string} email - Email address
     * @returns {string} Display name
     */
    generateDisplayName(email) {
        const username = email.split('@')[0];
        // Convert john.smith or john_smith to John Smith
        return username
            .replace(/[._]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Show welcome form error
     * @param {string} message - Error message
     */
    showWelcomeError(message) {
        // Remove existing error
        const existingError = document.querySelector('.welcome-error');
        if (existingError) {
            existingError.remove();
        }

        // Add new error
        const error = document.createElement('div');
        error.className = 'welcome-error';
        error.style.cssText = `
            background: var(--error-color);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-top: 1rem;
            font-weight: 600;
            text-align: center;
            animation: shake 0.5s ease-in-out;
        `;
        error.textContent = message;

        // Add shake animation
        const shakeKeyframes = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
        `;
        
        if (!document.querySelector('#shake-animation')) {
            const style = document.createElement('style');
            style.id = 'shake-animation';
            style.textContent = shakeKeyframes;
            document.head.appendChild(style);
        }

        const form = document.getElementById('welcome-auth-form');
        form.appendChild(error);

        // Remove after 4 seconds
        setTimeout(() => error.remove(), 4000);
    }

    /**
     * Save user to localStorage
     * @param {Object} user - User object
     */
    saveUser(user) {
        try {
            localStorage.setItem('eventcall_user', JSON.stringify(user));
        } catch (error) {
            console.error('Failed to save user:', error);
        }
    }

    /**
     * Get saved user from localStorage
     * @returns {Object|null} User object or null
     */
    getSavedUser() {
        try {
            const saved = localStorage.getItem('eventcall_user');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to get saved user:', error);
            return null;
        }
    }

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid
     */
    isValidEmail(email) {
        return VALIDATION.email.test(email);
    }

    /**
     * Get current user email
     * @returns {string} User email
     */
    getCurrentUserEmail() {
        return this.currentUser ? this.currentUser.email : null;
    }

    /**
     * Get current user name
     * @returns {string} User name
     */
    getCurrentUserName() {
        return this.currentUser ? this.currentUser.name : 'Unknown User';
    }

    /**
     * Check if current user owns an event
     * @param {Object} event - Event object
     * @returns {boolean} User owns event
     */
    userOwnsEvent(event) {
        if (!this.currentUser || !event) return false;
        return event.createdBy === this.currentUser.email;
    }

    /**
     * Filter events for current user
     * @param {Object} allEvents - All events object
     * @returns {Object} User's events
     */
    filterUserEvents(allEvents) {
        if (!this.currentUser) return {};

        const userEvents = {};
        Object.keys(allEvents).forEach(eventId => {
            const event = allEvents[eventId];
            if (this.userOwnsEvent(event)) {
                userEvents[eventId] = event;
            }
        });

        return userEvents;
    }

    /**
     * Add user information to event data
     * @param {Object} eventData - Event data
     * @returns {Object} Event data with user info
     */
    addUserToEvent(eventData) {
        if (!this.currentUser) return eventData;

        return {
            ...eventData,
            createdBy: this.currentUser.email,
            createdByName: this.currentUser.name
        };
    }

    /**
     * Logout current user
     */
    logout() {
        // Clear user data
        this.currentUser = null;
        this.isLoggedIn = false;
        this.setupComplete = false;

        // Clear localStorage
        localStorage.removeItem('eventcall_user');

        // Show toast
        showToast('👋 Logged out successfully', 'success');

        // Reload page to reset state
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    /**
     * Show user profile/settings
     */
    showUserProfile() {
        if (!this.currentUser) return;

        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 20, 25, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 1rem; max-width: 500px; width: 90%; padding: 0; overflow: hidden; border: 3px solid var(--semper-gold);">
                <div style="background: linear-gradient(135deg, var(--semper-navy) 0%, var(--semper-red) 100%); color: white; padding: 2rem; text-align: center;">
                    <h2 style="margin-bottom: 0.5rem;">👤 User Profile</h2>
                    <p style="opacity: 0.9; color: var(--semper-gold);">Manage your EventCall account</p>
                </div>
                
                <div style="padding: 2rem;">
                    <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                        <div style="margin-bottom: 1rem;"><strong>📧 Email:</strong> ${this.currentUser.email}</div>
                        <div style="margin-bottom: 1rem;"><strong>👤 Display Name:</strong> ${this.currentUser.name}</div>
                        <div><strong>🕐 Login Time:</strong> ${new Date(this.currentUser.loginTime).toLocaleString()}</div>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button style="flex: 1; min-width: 120px;" class="btn btn-danger" onclick="userAuth.logout()">🚪 Logout</button>
                        <button style="flex: 1; min-width: 120px;" class="btn btn-secondary" onclick="this.closest('div[style*=\"position: fixed\"]').remove()">❌ Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Get user statistics
     * @returns {Object} User stats
     */
    getUserStats() {
        if (!this.currentUser) return { events: 0, totalRSVPs: 0 };

        const allEvents = window.events || {};
        const allResponses = window.responses || {};
        const userEvents = this.filterUserEvents(allEvents);
        const eventCount = Object.keys(userEvents).length;
        
        let totalRSVPs = 0;
        Object.keys(userEvents).forEach(eventId => {
            const eventResponses = allResponses[eventId] || [];
            totalRSVPs += eventResponses.length;
        });

        return {
            events: eventCount,
            totalRSVPs: totalRSVPs,
            email: this.currentUser.email,
            name: this.currentUser.name
        };
    }
}

// Create global instance
const userAuth = new UserAuth();

// Make available globally
window.userAuth = userAuth;

/**
 * EventCall User Authentication
 * Handles email-based user identification and event filtering
 */

class UserAuth {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.setupComplete = false;
    }

    /**
     * Initialize user authentication
     */
    async initialize() {
        // Check if user is already logged in
        const savedUser = this.getSavedUser();
        
        if (savedUser && this.isValidEmail(savedUser.email)) {
            this.currentUser = savedUser;
            this.isLoggedIn = true;
            this.setupComplete = true;
            console.log('User auto-logged in:', savedUser.email);
            return true;
        } else {
            // Show welcome page first
            await this.showWelcomePage();
            return this.isLoggedIn;
        }
    }

    /**
     * Show welcome/landing page
     */
    async showWelcomePage() {
        return new Promise((resolve) => {
            this.createWelcomeModal(resolve);
        });
    }

    /**
     * Create welcome modal with app overview
     * @param {Function} resolve - Promise resolve function
     */
    createWelcomeModal(resolve) {
        // Hide main app content
        document.querySelector('.header').style.display = 'none';
        document.querySelector('.container').style.display = 'none';
        document.querySelector('.footer').style.display = 'none';

        // Create welcome overlay
        const welcomeOverlay = document.createElement('div');
        welcomeOverlay.id = 'welcome-overlay';
        welcomeOverlay.innerHTML = `
            <div class="welcome-container">
                <!-- Hero Section -->
                <div class="welcome-hero">
                    <div class="welcome-logo">
                        <div class="logo-icon">🎖️</div>
                        <h1>EventCall</h1>
                        <p class="tagline">Where Every Event Matters</p>
                    </div>
                    
                    <div class="hero-description">
                        <h2>Professional Military Event Management</h2>
                        <p>Streamline your ceremonies, promotions, retirements, and special events with military precision.</p>
                    </div>
                </div>

                <!-- Features Section -->
                <div class="welcome-features">
                    <div class="feature-grid">
                        <div class="feature-card">
                            <div class="feature-icon">🚀</div>
                            <h3>Deploy Events Instantly</h3>
                            <p>Create professional event invitations with military precision. Set date, time, location, and custom details.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">📊</div>
                            <h3>Real-Time RSVP Tracking</h3>
                            <p>Monitor attendance in real-time. Get accurate headcounts, guest numbers, and response analytics.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">🔗</div>
                            <h3>Share Anywhere</h3>
                            <p>Generate shareable invite links that work on any device. No apps required for your guests.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">☁️</div>
                            <h3>Cloud Synchronized</h3>
                            <p>Access your events from any device. Data automatically syncs and backs up to the cloud.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">🔒</div>
                            <h3>Private & Secure</h3>
                            <p>Your events are private to you. Only people with invite links can RSVP. No account creation needed.</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">📱</div>
                            <h3>Mobile Ready</h3>
                            <p>Works perfectly on phones, tablets, and computers. Responsive design for all screen sizes.</p>
                        </div>
                    </div>
                </div>

                <!-- Perfect For Section -->
                <div class="welcome-perfect-for">
                    <h2>Perfect for Military Events</h2>
                    <div class="event-types">
                        <div class="event-type">🎖️ Retirement Ceremonies</div>
                        <div class="event-type">📈 Promotion Celebrations</div>
                        <div class="event-type">🏛️ Change of Command</div>
                        <div class="event-type">🎉 Unit Gatherings</div>
                        <div class="event-type">👥 Family Events</div>
                        <div class="event-type">🏆 Awards Ceremonies</div>
                    </div>
                </div>

                <!-- Get Started Section -->
                <div class="welcome-get-started">
                    <div class="get-started-card">
                        <h2>Ready to Begin Your Mission?</h2>
                        <p>Enter your email address to start creating professional military events. No passwords, no complex setup - just enter your email and go.</p>
                        
                        <form id="welcome-auth-form" class="welcome-form">
                            <div class="form-group">
                                <label for="welcome-email">Military/Work Email Address</label>
                                <input type="email" id="welcome-email" required 
                                       placeholder="your.name@military.mil" 
                                       autocomplete="email">
                                <small>This identifies your events and keeps them private to you</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="welcome-name">Display Name (Optional)</label>
                                <input type="text" id="welcome-name" 
                                       placeholder="Rank FirstName LastName"
                                       autocomplete="name">
                                <small>How your name appears on events you create</small>
                            </div>
                            
                            <div class="form-group checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="welcome-remember" checked>
                                    <span class="checkmark"></span>
                                    Remember me on this device
                                </label>
                            </div>
                            
                            <button type="submit" class="welcome-btn">
                                🚀 Access EventCall
                            </button>
                        </form>
                        
                        <div class="privacy-note">
                            <div class="privacy-icon">🛡️</div>
                            <div class="privacy-text">
                                <strong>Complete Privacy Guaranteed</strong><br>
                                Your email is stored locally and used only for event filtering. 
                                No passwords • No account creation • No data sharing
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Powered By -->
                <div class="welcome-footer">
                    <div class="powered-by">
                        <div class="powered-text">Powered by</div>
                        <div class="powered-logo" onclick="window.open('https://linktr.ee/semperadmin', '_blank')">
                            SEMPER ADMIN
                        </div>
                        <div class="powered-tagline">Professional Military Solutions</div>
                    </div>
                </div>
            </div>
        `;

        // Add welcome styles
        const welcomeStyles = document.createElement('style');
        welcomeStyles.textContent = `
            #welcome-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, var(--semper-navy) 0%, var(--primary-color) 50%, var(--semper-red) 100%);
                z-index: 20000;
                overflow-y: auto;
                color: white;
            }
            
            .welcome-container {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            
            /* Hero Section */
            .welcome-hero {
                text-align: center;
                padding: 3rem 2rem;
                background: linear-gradient(45deg, transparent 30%, rgba(255, 215, 0, 0.1) 50%, transparent 70%);
            }
            
            .welcome-logo {
                margin-bottom: 2rem;
            }
            
            .logo-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            
            .welcome-logo h1 {
                font-size: 3.5rem;
                font-weight: 900;
                margin-bottom: 0.5rem;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            }
            
            .tagline {
                font-size: 1.25rem;
                color: var(--semper-gold);
                font-style: italic;
                opacity: 0.9;
            }
            
            .hero-description h2 {
                font-size: 2rem;
                margin-bottom: 1rem;
                color: var(--semper-gold);
            }
            
            .hero-description p {
                font-size: 1.1rem;
                opacity: 0.9;
                max-width: 600px;
                margin: 0 auto;
                line-height: 1.6;
            }
            
            /* Features Section */
            .welcome-features {
                background: rgba(255, 255, 255, 0.1);
                padding: 4rem 2rem;
                backdrop-filter: blur(10px);
            }
            
            .feature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 2rem;
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .feature-card {
                background: rgba(255, 255, 255, 0.1);
                padding: 2rem;
                border-radius: 1rem;
                text-align: center;
                border: 2px solid rgba(255, 215, 0, 0.3);
                transition: all 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            .feature-card:hover {
                transform: translateY(-5px);
                border-color: var(--semper-gold);
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            
            .feature-icon {
                font-size: 2.5rem;
                margin-bottom: 1rem;
            }
            
            .feature-card h3 {
                font-size: 1.25rem;
                font-weight: 700;
                margin-bottom: 1rem;
                color: var(--semper-gold);
            }
            
            .feature-card p {
                opacity: 0.9;
                line-height: 1.6;
            }
            
            /* Perfect For Section */
            .welcome-perfect-for {
                padding: 4rem 2rem;
                text-align: center;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .welcome-perfect-for h2 {
                font-size: 2rem;
                margin-bottom: 2rem;
                color: var(--semper-gold);
            }
            
            .event-types {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1rem;
                max-width: 800px;
                margin: 0 auto;
            }
            
            .event-type {
                background: rgba(255, 215, 0, 0.2);
                padding: 1rem;
                border-radius: 0.5rem;
                font-weight: 600;
                border: 1px solid rgba(255, 215, 0, 0.3);
            }
            
            /* Get Started Section */
            .welcome-get-started {
                padding: 4rem 2rem;
                background: rgba(255, 255, 255, 0.05);
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .get-started-card {
                background: rgba(255, 255, 255, 0.1);
                padding: 3rem;
                border-radius: 1.5rem;
                max-width: 500px;
                width: 100%;
                border: 3px solid var(--semper-gold);
                backdrop-filter: blur(10px);
            }
            
            .get-started-card h2 {
                text-align: center;
                font-size: 1.75rem;
                margin-bottom: 1rem;
                color: var(--semper-gold);
            }
            
            .get-started-card > p {
                text-align: center;
                margin-bottom: 2rem;
                opacity: 0.9;
                line-height: 1.6;
            }
            
            .welcome-form .form-group {
                margin-bottom: 1.5rem;
            }
            
            .welcome-form label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: var(--semper-gold);
            }
            
            .welcome-form input[type