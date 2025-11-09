/**
 * EventCall Manager Authentication System
 * Email + Access Code based authentication (no GitHub tokens needed)
 */

class ManagerAuth {
    constructor() {
        this.currentManager = null;
        this.currentSession = null;
        this.sessionKey = 'eventcall_session';
        this.rememberKey = 'eventcall_remember';
        this.storage = (window.utils && window.utils.secureStorageSync) || null;
    }

    /**
     * Initialize authentication system
     */
    async init() {
        console.log('🔐 Initializing Manager Authentication...');
        
        // Check for existing session
        await this.restoreSession();
        
        // Setup session timeout
        this.setupSessionTimeout();
        
        return this.isAuthenticated();
    }

    /**
     * Register new manager
     */
    async registerManager(email, name = null) {
        try {
            // Validate email
            if (!this.validateEmail(email)) {
                throw new Error('Invalid email address');
            }

            // Generate manager ID and access code
            const managerId = this.generateManagerId();
            const masterCode = CodeGenerator.generate(CODE_CONFIG.managerPrefix);

            const manager = {
                id: managerId,
                masterCode: masterCode,
                email: email.toLowerCase().trim(),
                name: name || this.extractNameFromEmail(email),
                created: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                authorizedEvents: [],
                role: 'manager'
            };

            // Save manager data (will be implemented with service worker)
            await this.saveManagerData(manager);

            console.log('✅ Manager registered:', manager.email);
            return {
                success: true,
                manager: manager,
                masterCode: masterCode
            };

        } catch (error) {
            console.error('❌ Manager registration failed:', error);
            throw error;
        }
    }

    /**
     * Login with email and access code
     */
    async login(email, accessCode, rememberMe = false) {
        try {
            email = email.toLowerCase().trim();
            accessCode = accessCode.toUpperCase().trim();

            console.log('🔑 Attempting login:', email);

            // Validate inputs
            if (!this.validateEmail(email)) {
                throw new Error(MESSAGES.auth.invalidEmail);
            }

            if (!CodeGenerator.validate(accessCode)) {
                throw new Error(MESSAGES.auth.invalidCode);
            }

            // Determine code type
            const codePrefix = CodeGenerator.getPrefix(accessCode);
            let manager = null;
            let authorizedEvents = [];

            if (codePrefix === CODE_CONFIG.managerPrefix) {
                // Manager Master Code - Access all their events
                manager = await this.findManagerByMasterCode(email, accessCode);
                if (manager) {
                    authorizedEvents = manager.authorizedEvents || [];
                }
            } else if (codePrefix === CODE_CONFIG.eventPrefix) {
                // Event-Specific Code - Access just this event
                const eventAuth = await this.findEventByCode(email, accessCode);
                if (eventAuth) {
                    manager = eventAuth.manager;
                    authorizedEvents = [eventAuth.eventId];
                }
            } else if (codePrefix === CODE_CONFIG.invitePrefix) {
                // Invite Code - Accept and convert to event access
                const invite = await this.processInviteCode(email, accessCode);
                if (invite) {
                    manager = invite.manager;
                    authorizedEvents = [invite.eventId];
                }
            }

            if (!manager) {
                throw new Error(MESSAGES.auth.invalidCode);
            }

            // Create session
            const session = this.createSession(manager, authorizedEvents, codePrefix);

            // Save session (secure, TTL)
            if (this.storage) {
                const ttlMs = Math.max(new Date(session.expiresAt).getTime() - Date.now(), 0);
                this.storage.set(this.sessionKey, session, { ttl: ttlMs || (4 * 60 * 60 * 1000) });
                if (rememberMe) {
                    this.saveRememberMe(session);
                }
            } else {
                // Fallback to sessionStorage if secure storage unavailable
                sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
                if (rememberMe) {
                    this.saveRememberMe(session);
                }
            }

            this.currentManager = manager;
            this.currentSession = session;

            // Update last login
            await this.updateLastLogin(manager.id);

            console.log('✅ Login successful:', manager.email);
            return {
                success: true,
                manager: manager,
                session: session
            };

        } catch (error) {
            console.error('❌ Login failed:', error);
            throw error;
        }
    }

    /**
     * Logout current manager
     */
    logout() {
        console.log('👋 Logging out:', this.currentManager?.email);
        
        if (this.storage) {
            this.storage.remove(this.sessionKey);
        } else {
            sessionStorage.removeItem(this.sessionKey);
        }
        this.currentManager = null;
        this.currentSession = null;
        
        showToast(MESSAGES.auth.logoutSuccess, 'success');
    }

    /**
     * Check if manager is authenticated
     */
    isAuthenticated() {
        return this.currentSession !== null && this.currentManager !== null;
    }

    /**
     * Get current manager
     */
    getCurrentManager() {
        return this.currentManager;
    }

    /**
     * Get current session
     */
    getSession() {
        return this.currentSession;
    }

    /**
     * Check if manager has access to event
     */
    canAccessEvent(eventId) {
        if (!this.isAuthenticated()) return false;
        
        const session = this.currentSession;
        
        // Master code = access all events
        if (session.codeType === CODE_CONFIG.managerPrefix) {
            return session.authorizedEvents.includes(eventId);
        }
        
        // Event/Invite code = access specific event
        return session.authorizedEvents.includes(eventId);
    }

    /**
     * Generate invite link for event
     */
    generateInviteLink(eventId, eventData) {
        const inviteCode = CodeGenerator.generate(CODE_CONFIG.invitePrefix);
        const baseURL = window.location.origin + window.location.pathname;
        
        // Create invite data
        const inviteData = {
            code: inviteCode,
            eventId: eventId,
            eventTitle: eventData.title,
            createdBy: this.currentManager?.email,
            created: new Date().toISOString(),
            expiresAt: null // Optional: add expiration
        };

        // Save invite (will be implemented)
        this.saveInviteData(inviteData);

        // Generate shareable URL
        const inviteURL = `${baseURL}?invite=${inviteCode}#join`;
        
        return {
            code: inviteCode,
            url: inviteURL,
            data: inviteData
        };
    }

    /**
     * Add co-manager to event
     */
    async addCoManager(eventId, email, name = null) {
        try {
            if (!this.canAccessEvent(eventId)) {
                throw new Error(MESSAGES.auth.accessDenied);
            }

            email = email.toLowerCase().trim();

            // Check if manager exists
            let manager = await this.findManagerByEmail(email);
            
            // Create new manager if doesn't exist
            if (!manager) {
                const result = await this.registerManager(email, name);
                manager = result.manager;
            }

            // Add event to manager's authorized events
            if (!manager.authorizedEvents.includes(eventId)) {
                manager.authorizedEvents.push(eventId);
                await this.saveManagerData(manager);
            }

            // Add manager to event's authorized list
            await this.addManagerToEvent(eventId, manager.id, email);

            console.log('✅ Co-manager added:', email, 'to event:', eventId);
            return manager;

        } catch (error) {
            console.error('❌ Failed to add co-manager:', error);
            throw error;
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Generate unique manager ID
     */
    generateManagerId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${CODE_CONFIG.managerPrefix}-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * Validate email format
     */
    validateEmail(email) {
        return VALIDATION.email.test(email);
    }

    /**
     * Extract name from email
     */
    extractNameFromEmail(email) {
        const username = email.split('@')[0];
        return username
            .split(/[._-]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Create session object
     */
    createSession(manager, authorizedEvents, codeType) {
        return {
            managerId: manager.id,
            email: manager.email,
            name: manager.name,
            authorizedEvents: authorizedEvents,
            codeType: codeType,
            loginTime: new Date().toISOString(),
            expiresAt: new Date(Date.now() + (AUTH_CONFIG.sessionTimeout || 1800000)).toISOString()        };
    }

    /**
     * Setup session timeout
     */
    setupSessionTimeout() {
        setInterval(() => {
            if (this.isAuthenticated()) {
                const session = this.currentSession;
                const expiresAt = new Date(session.expiresAt);
                
                if (new Date() > expiresAt) {
                    console.log('⏰ Session expired');
                    this.logout();
                    showToast(MESSAGES.auth.sessionExpired, 'error');
                    showPage('login');
                }
            }
        }, 60000); // Check every minute
    }

    /**
     * Restore session from storage
     */
    async restoreSession() {
        try {
            // Try secure storage first
            let session = null;
            if (this.storage) {
                session = this.storage.get(this.sessionKey);
                if (!session && AUTH_CONFIG.rememberMeOption) {
                    const remembered = this.storage.get(this.rememberKey);
                    if (remembered) session = remembered;
                }
            } else {
                // Fallback: session/local storage
                const sessionData = sessionStorage.getItem(this.sessionKey) || (AUTH_CONFIG.rememberMeOption ? localStorage.getItem(this.rememberKey) : null);
                if (sessionData) session = JSON.parse(sessionData);
            }

            if (session) {
                // Check if expired
                if (new Date() > new Date(session.expiresAt)) {
                    console.log('⏰ Stored session expired');
                    return false;
                }

                // Restore manager data
                const manager = await this.findManagerById(session.managerId);
                if (manager) {
                    this.currentManager = manager;
                    this.currentSession = session;
                    console.log('✅ Session restored:', manager.email);
                    return true;
                }
            }
        } catch (error) {
            console.error('❌ Failed to restore session:', error);
        }
        return false;
    }

    /**
     * Save "remember me" session
     */
    saveRememberMe(session) {
        if (!AUTH_CONFIG.rememberMeOption) return;
        const rememberSession = { ...session };
        // Security policy: cap persistence to 4 hours
        rememberSession.expiresAt = new Date(Date.now() + (4 * 60 * 60 * 1000)).toISOString();
        if (this.storage) {
            this.storage.set(this.rememberKey, rememberSession, { ttl: 4 * 60 * 60 * 1000 });
        } else {
            localStorage.setItem(this.rememberKey, JSON.stringify(rememberSession));
        }
    }

    // ==================== DATA PERSISTENCE (To be implemented with GitHub Actions) ====================

    /**
     * Save manager data to repository
     */
    async saveManagerData(manager) {
        // TODO: Implement with GitHub Action webhook
        console.log('💾 Saving manager data:', manager.id);
        // For now, store in secure session storage for development
        if (this.storage) {
            const managers = this.storage.get('managers') || {};
            managers[manager.id] = manager;
            this.storage.set('managers', managers, { ttl: 4 * 60 * 60 * 1000 });
        } else {
            const managers = JSON.parse(localStorage.getItem('managers') || '{}');
            managers[manager.id] = manager;
            localStorage.setItem('managers', JSON.stringify(managers));
        }
        return true;
    }

    /**
     * Find manager by master code
     */
    async findManagerByMasterCode(email, masterCode) {
        // TODO: Implement with GitHub API
        console.log('🔍 Finding manager by master code:', email);
        const managers = this.storage ? (this.storage.get('managers') || {}) : JSON.parse(localStorage.getItem('managers') || '{}');
        return Object.values(managers).find(m => 
            m.email === email && m.masterCode === masterCode
        );
    }

    /**
     * Find manager by email
     */
    async findManagerByEmail(email) {
        // TODO: Implement with GitHub API
        const managers = this.storage ? (this.storage.get('managers') || {}) : JSON.parse(localStorage.getItem('managers') || '{}');
        return Object.values(managers).find(m => m.email === email);
    }

    /**
     * Find manager by ID
     */
    async findManagerById(managerId) {
        // TODO: Implement with GitHub API
        const managers = this.storage ? (this.storage.get('managers') || {}) : JSON.parse(localStorage.getItem('managers') || '{}');
        return managers[managerId];
    }

    /**
     * Find event by code
     */
    async findEventByCode(email, eventCode) {
        // TODO: Implement with GitHub API
        console.log('🔍 Finding event by code:', eventCode);
        // For now, return null (will implement after event system update)
        return null;
    }

    /**
     * Process invite code
     */
    async processInviteCode(email, inviteCode) {
        // TODO: Implement invite system
        console.log('📨 Processing invite code:', inviteCode);
        return null;
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(managerId) {
        const manager = await this.findManagerById(managerId);
        if (manager) {
            manager.lastLogin = new Date().toISOString();
            await this.saveManagerData(manager);
        }
    }

    /**
     * Add manager to event's authorized list
     */
    async addManagerToEvent(eventId, managerId, email) {
        // TODO: Implement with event data structure
        console.log('➕ Adding manager to event:', managerId, eventId);
        return true;
    }

    /**
     * Save invite data
     */
    async saveInviteData(inviteData) {
        // TODO: Implement with GitHub Action
        console.log('💾 Saving invite data:', inviteData.code);
        if (this.storage) {
            const invites = this.storage.get('invites') || {};
            invites[inviteData.code] = inviteData;
            this.storage.set('invites', invites, { ttl: 4 * 60 * 60 * 1000 });
        } else {
            const invites = JSON.parse(localStorage.getItem('invites') || '{}');
            invites[inviteData.code] = inviteData;
            localStorage.setItem('invites', JSON.stringify(invites));
        }
        return true;
    }
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.managerAuth = new ManagerAuth();
}

console.log('✅ Manager Authentication System loaded');
