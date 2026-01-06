/**
 * EventCall Early Functions - Updated with Email-Only Authentication
 * These functions need to be available immediately when HTML loads
 * Load this file BEFORE all other scripts
 */

// =============================================================================
// THEME - Light mode only
// =============================================================================

// Set light theme on document
document.documentElement.setAttribute('data-theme', 'light');

// =============================================================================
// GLOBAL STATE INITIALIZATION
// =============================================================================

// Initialize global state
window.events = {};
window.responses = {};

// =============================================================================
// CACHE MANAGER - Centralized cache invalidation strategy
// =============================================================================

/**
 * CacheManager - Centralized cache management with invalidation
 * Provides consistent TTL, versioning, and invalidation across the app
 */
const CacheManager = {
    // Cache version - increment to invalidate all caches
    VERSION: 1,

    // Default TTL values (in milliseconds)
    TTL: {
        EVENTS: 5 * 60 * 1000,      // 5 minutes
        RESPONSES: 5 * 60 * 1000,   // 5 minutes
        USER: 30 * 60 * 1000,       // 30 minutes
        FORM_DRAFT: 60 * 60 * 1000  // 1 hour
    },

    // Track when data was last fetched
    _timestamps: {
        events: 0,
        responses: 0
    },

    // Subscribers for cache invalidation events
    _subscribers: [],

    /**
     * Check if cached data is stale
     * @param {string} cacheKey - 'events' or 'responses'
     * @returns {boolean}
     */
    isStale(cacheKey) {
        const timestamp = this._timestamps[cacheKey] || 0;
        const ttl = this.TTL[cacheKey.toUpperCase()] || this.TTL.EVENTS;
        return Date.now() - timestamp > ttl;
    },

    /**
     * Mark cache as fresh (just updated)
     * @param {string} cacheKey - 'events' or 'responses'
     */
    markFresh(cacheKey) {
        this._timestamps[cacheKey] = Date.now();
    },

    /**
     * Invalidate specific cache or all caches
     * @param {string} [cacheKey] - Optional specific cache to invalidate
     */
    invalidate(cacheKey) {
        if (cacheKey) {
            this._timestamps[cacheKey] = 0;
            console.log(`🗑️ Cache invalidated: ${cacheKey}`);
        } else {
            // Invalidate all
            Object.keys(this._timestamps).forEach(key => {
                this._timestamps[key] = 0;
            });
            console.log('🗑️ All caches invalidated');
        }

        // Notify subscribers
        this._notifySubscribers(cacheKey);

        // Also clear GitHub API caches if available
        if (window.githubAPI && typeof window.githubAPI.clearCache === 'function') {
            window.githubAPI.clearCache();
        }
    },

    /**
     * Invalidate caches after a mutation (create/update/delete)
     * @param {string} entityType - 'event' or 'rsvp'
     * @param {string} eventId - Event ID affected
     */
    invalidateAfterMutation(entityType, eventId) {
        if (entityType === 'event') {
            this.invalidate('events');
        }
        this.invalidate('responses');
        console.log(`🔄 Cache invalidated after ${entityType} mutation for event: ${eventId}`);
    },

    /**
     * Subscribe to cache invalidation events
     * @param {Function} callback - Called when cache is invalidated
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this._subscribers.push(callback);
        return () => {
            this._subscribers = this._subscribers.filter(cb => cb !== callback);
        };
    },

    /**
     * Notify all subscribers of cache invalidation
     * @param {string} [cacheKey] - Which cache was invalidated
     */
    _notifySubscribers(cacheKey) {
        this._subscribers.forEach(callback => {
            try {
                callback(cacheKey);
            } catch (err) {
                console.error('Cache subscriber error:', err);
            }
        });
    },

    /**
     * Get cache statistics for debugging
     * @returns {Object}
     */
    getStats() {
        const now = Date.now();
        return {
            version: this.VERSION,
            events: {
                age: now - this._timestamps.events,
                isStale: this.isStale('events'),
                count: Object.keys(window.events || {}).length
            },
            responses: {
                age: now - this._timestamps.responses,
                isStale: this.isStale('responses'),
                count: Object.keys(window.responses || {}).length
            }
        };
    }
};

// Export to window for global access
window.CacheManager = CacheManager;

// =============================================================================
// LOADING STATE MANAGER - Consistent loading/error states
// =============================================================================

/**
 * LoadingStateManager - Centralized loading and error state management
 * Provides consistent UI states across the application
 */
const LoadingStateManager = {
    // Current loading states by key
    _states: {},

    // State change subscribers
    _subscribers: [],

    /**
     * Check if any operation is loading
     * @param {string} [key] - Optional specific key to check
     * @returns {boolean}
     */
    isLoading(key) {
        if (key) {
            return this._states[key]?.loading || false;
        }
        return Object.values(this._states).some(s => s.loading);
    },

    /**
     * Get error for a specific key
     * @param {string} key
     * @returns {Error|null}
     */
    getError(key) {
        return this._states[key]?.error || null;
    },

    /**
     * Start a loading operation
     * @param {string} key - Unique operation key
     * @param {Object} [options] - Options
     * @param {boolean} [options.showOverlay] - Show global overlay
     * @param {string} [options.message] - Loading message
     */
    startLoading(key, options = {}) {
        const { showOverlay = false, message = 'Loading...' } = options;

        this._states[key] = {
            loading: true,
            error: null,
            startTime: Date.now(),
            message
        };

        if (showOverlay && window.LoadingUI?.Overlay) {
            window.LoadingUI.Overlay.show(message);
        }

        this._notify(key, 'loading');
    },

    /**
     * End a loading operation with success
     * @param {string} key - Operation key
     */
    endLoading(key) {
        if (this._states[key]) {
            const elapsed = Date.now() - (this._states[key].startTime || 0);
            console.log(`✅ ${key} completed in ${elapsed}ms`);
            this._states[key].loading = false;
            this._states[key].error = null;
        }

        // Hide overlay if no more operations loading
        if (!this.isLoading() && window.LoadingUI?.Overlay) {
            window.LoadingUI.Overlay.hide();
        }

        this._notify(key, 'success');
    },

    /**
     * End a loading operation with error
     * @param {string} key - Operation key
     * @param {Error|string} error - Error that occurred
     * @param {Object} [options] - Options
     * @param {boolean} [options.showToast] - Show error toast (default: true)
     * @param {boolean} [options.retry] - Allow retry
     */
    setError(key, error, options = {}) {
        const { showToast = true } = options;
        const errorObj = typeof error === 'string' ? new Error(error) : error;

        if (this._states[key]) {
            this._states[key].loading = false;
            this._states[key].error = errorObj;
        } else {
            this._states[key] = { loading: false, error: errorObj };
        }

        // Hide overlay
        if (window.LoadingUI?.Overlay) {
            window.LoadingUI.Overlay.hide();
        }

        // Show toast notification
        if (showToast && window.showToast) {
            const message = this._getUserFriendlyMessage(errorObj);
            window.showToast(`❌ ${message}`, 'error');
        }

        console.error(`❌ ${key} failed:`, errorObj);
        this._notify(key, 'error', errorObj);
    },

    /**
     * Clear error state
     * @param {string} key
     */
    clearError(key) {
        if (this._states[key]) {
            this._states[key].error = null;
        }
        this._notify(key, 'cleared');
    },

    /**
     * Execute an operation with automatic loading/error state management
     * @param {string} key - Operation key
     * @param {Function} fn - Async function to execute
     * @param {Object} [options] - Options
     * @returns {Promise<any>}
     */
    async withLoading(key, fn, options = {}) {
        this.startLoading(key, options);
        try {
            const result = await fn();
            this.endLoading(key);
            return result;
        } catch (error) {
            this.setError(key, error, options);
            throw error;
        }
    },

    /**
     * Subscribe to state changes
     * @param {Function} callback - Called with (key, state, error)
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this._subscribers.push(callback);
        return () => {
            this._subscribers = this._subscribers.filter(cb => cb !== callback);
        };
    },

    /**
     * Notify subscribers of state change
     * @private
     */
    _notify(key, state, error = null) {
        this._subscribers.forEach(cb => {
            try {
                cb(key, state, error);
            } catch (err) {
                console.error('LoadingStateManager subscriber error:', err);
            }
        });
    },

    /**
     * Get user-friendly error message
     * @private
     */
    _getUserFriendlyMessage(error) {
        const msg = error?.message || String(error);

        // Network errors
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('Network')) {
            return 'Network error - please check your connection';
        }

        // Rate limiting
        if (msg.includes('429') || msg.includes('rate limit')) {
            return 'Too many requests - please wait a moment';
        }

        // Auth errors
        if (msg.includes('401') || msg.includes('Authentication')) {
            return 'Please log in again';
        }

        // Server errors
        if (msg.includes('500') || msg.includes('Server')) {
            return 'Server error - please try again later';
        }

        // Timeout
        if (msg.includes('timeout') || msg.includes('Timeout')) {
            return 'Request timed out - please try again';
        }

        // Default: use original message (truncated)
        return msg.length > 100 ? msg.substring(0, 100) + '...' : msg;
    },

    /**
     * Get all current states (for debugging)
     * @returns {Object}
     */
    getStates() {
        return { ...this._states };
    }
};

// Export to window for global access
window.LoadingStateManager = LoadingStateManager;

// =============================================================================
// APP INITIALIZATION MUTEX
// =============================================================================

/**
 * AppInit - Manages application initialization with mutex protection
 * Ensures initialization happens exactly once and in the correct order
 */
const AppInit = {
    _initialized: false,
    _initializing: false,
    _initPromise: null,
    _readyCallbacks: [],

    /**
     * Check if app is fully initialized
     */
    isReady() {
        return this._initialized;
    },

    /**
     * Wait for initialization to complete
     * @returns {Promise<void>}
     */
    async waitForReady() {
        if (this._initialized) return;
        if (this._initPromise) return this._initPromise;
        return new Promise(resolve => {
            this._readyCallbacks.push(resolve);
        });
    },

    /**
     * Run initialization with mutex protection
     * @returns {Promise<void>}
     */
    async initialize() {
        // Already initialized - nothing to do
        if (this._initialized) {
            console.log('✅ AppInit: Already initialized');
            return;
        }

        // Another initialization in progress - wait for it
        if (this._initializing && this._initPromise) {
            console.log('⏳ AppInit: Waiting for existing initialization...');
            return this._initPromise;
        }

        // Start initialization with mutex
        this._initializing = true;
        this._initPromise = this._doInitialize();

        try {
            await this._initPromise;
        } finally {
            this._initializing = false;
        }

        return this._initPromise;
    },

    /**
     * Internal initialization logic
     */
    async _doInitialize() {
        console.log('🚀 AppInit: Starting initialization...');

        // Step 1: Wait for userAuth to be available (with timeout)
        const userAuthReady = await this._waitForDependency(
            () => window.userAuth && typeof window.userAuth.init === 'function',
            'userAuth',
            3000
        );

        if (!userAuthReady) {
            console.warn('⚠️ AppInit: userAuth not available, showing fallback login');
            showLoginPage();
            this._markReady();
            return;
        }

        // Step 2: Initialize userAuth
        try {
            await window.userAuth.init();
        } catch (err) {
            console.error('❌ AppInit: userAuth.init() failed:', err);
        }

        // Step 3: Handle authentication state
        if (!window.userAuth.isAuthenticated()) {
            console.log('🔒 AppInit: Not authenticated - showing login');
            if (typeof window.userAuth.showLoginScreen === 'function') {
                window.userAuth.showLoginScreen();
            }
            this._markReady();
            return;
        }

        console.log('✅ AppInit: User authenticated');
        enforceLogin();

        // Step 4: Load initial data for dashboard
        const hash = window.location.hash.substring(1);
        const isDefaultDashboard = !hash || hash === 'dashboard';

        if (isDefaultDashboard) {
            // Wait for loadManagerData to be available
            const loadDataReady = await this._waitForDependency(
                () => typeof window.loadManagerData === 'function',
                'loadManagerData',
                5000
            );

            if (loadDataReady) {
                console.log('📊 AppInit: Loading dashboard data...');
                try {
                    await window.loadManagerData();
                } catch (err) {
                    console.error('❌ AppInit: loadManagerData failed:', err);
                }
            }
        }

        this._markReady();
    },

    /**
     * Wait for a dependency to become available
     */
    async _waitForDependency(checkFn, name, timeoutMs) {
        const startTime = Date.now();
        while (!checkFn()) {
            if (Date.now() - startTime > timeoutMs) {
                console.warn(`⚠️ AppInit: ${name} not available after ${timeoutMs}ms timeout`);
                return false;
            }
            await new Promise(r => setTimeout(r, 50));
        }
        console.log(`✅ AppInit: ${name} is available`);
        return true;
    },

    /**
     * Mark initialization as complete and notify waiters
     */
    _markReady() {
        this._initialized = true;
        console.log('🎉 AppInit: Initialization complete');

        // Notify all waiters
        this._readyCallbacks.forEach(cb => cb());
        this._readyCallbacks = [];
    }
};

// Export to window for global access
window.AppInit = AppInit;

async function initialAuthAndLoad() {
    const isInvitePage = window.location.hash.includes('invite/') || window.location.search.includes('data=');
    if (isInvitePage) {
        return;
    }

    // Use the new AppInit mutex system for guaranteed single initialization
    await AppInit.initialize();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialAuthAndLoad);
} else {
    initialAuthAndLoad();
}

// =============================================================================
// UNIFIED NAVIGATION
// =============================================================================

/**
 * Unified navigation function - single entry point for all navigation
 * Handles AppRouter, showPage fallback, and authentication checks
 * @param {string} pageId - The page to navigate to (e.g., 'dashboard', 'manage', 'create')
 * @param {string} [param] - Optional parameter (e.g., event ID for manage page)
 * @returns {Promise<void>}
 */
async function navigateTo(pageId, param = '') {
    console.log('🧭 navigateTo:', pageId, param || '');

    // Check authentication for protected pages
    const publicPages = ['invite', 'login'];
    if (!publicPages.includes(pageId)) {
        if (!window.userAuth || !window.userAuth.isAuthenticated()) {
            console.log('🔒 navigateTo: Not authenticated, redirecting to login');
            if (typeof window.userAuth?.showLoginScreen === 'function') {
                window.userAuth.showLoginScreen();
            }
            return;
        }
    }

    // Use AppRouter if available (preferred)
    if (window.AppRouter && typeof window.AppRouter.navigateToPage === 'function') {
        window.AppRouter.navigateToPage(pageId, param);
        return;
    }

    // Fallback to showPage
    if (typeof showPage === 'function') {
        showPage(pageId, param);
        return;
    }

    // Last resort: direct hash manipulation
    console.warn('⚠️ navigateTo: No router available, using hash fallback');
    if (param) {
        window.location.hash = `${pageId}/${param}`;
    } else {
        window.location.hash = pageId;
    }
}

// Export to window for global access
window.navigateTo = navigateTo;

/**
 * Enforce login - show login page if not authenticated
 */
function enforceLogin() {
    // Check if user is authenticated (supports both old and new auth)
    if (!window.userAuth || !window.userAuth.isAuthenticated()) {
        console.log('🔒 User not authenticated, showing login page');
        
        const loginPage = document.getElementById('login-page');
        const appContent = document.querySelector('.app-content');
        
        if (loginPage) loginPage.style.display = 'flex';
        if (appContent) {
            appContent.classList.add('hidden');
            appContent.style.display = 'none';
        }
        
        return false;
    }
    
    console.log('✅ User authenticated:', window.userAuth.getCurrentUser().email);

    const loginPage = document.getElementById('login-page');
    const appContent = document.querySelector('.app-content');

    if (loginPage) loginPage.style.display = 'none';
    if (appContent) {
        appContent.classList.remove('hidden');
        appContent.style.display = 'block';
    }

    // Only show dashboard by default if there's no URL path/hash indicating another page
    // Let the router handle page selection when there's a specific URL
    const hash = window.location.hash.replace(/^#/, '');

    // Handle base path correctly for GitHub Pages (e.g., /repo-name/)
    const basePath = (typeof getBasePath === 'function' && getBasePath()) || '/';
    let path = window.location.pathname;
    if (basePath !== '/' && path.startsWith(basePath)) {
        path = path.substring(basePath.length);
    }
    path = path.replace(/^[#/]+/, '').replace(/\/$/, '');
    const hasSpecificPage = hash || (path && path !== 'index.html');

    if (!hasSpecificPage) {
        const dashboardPage = document.getElementById('dashboard');
        if (dashboardPage && !dashboardPage.classList.contains('active')) {
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            dashboardPage.classList.add('active');
            console.log('📊 Dashboard page activated (no specific URL)');
        }
    } else {
        console.log('🔗 URL has specific page, letting router handle:', hash || path);
    }

    return true;
}

/**
 * Show page navigation - Updated to enforce login state
 * @param {string} pageId - Page ID to show (dashboard, create, manage, etc.)
 * @param {string} param - Optional parameter (e.g., eventId for manage page)
 */
function showPage(pageId, param) {
    console.log(`🧭 Attempting to navigate to: ${pageId}${param ? `/${param}` : ''}`);

    // Allow access to invite page without login (for guests)
    if (pageId === 'invite') {
        console.log('🎟️ Guest invite access - no login required');
        showPageContent(pageId, param);
        return;
    }

    // Check if this is an invite URL (guest access)
    if (window.location.hash.includes('invite/') || window.location.search.includes('data=')) {
        console.log('🎟️ Guest invite URL detected - bypassing login');
        showPageContent('invite', param);
        return;
    }

    // Check if user is logged in for all other pages
    const isAuthenticated = window.userAuth?.isAuthenticated() || window.managerAuth?.isAuthenticated();

    if (!isAuthenticated) {
        console.log('🔒 Access denied - user not logged in');
        enforceLogin();
        return;
    }

    // User is logged in, check if admin
    const user = window.userAuth?.getCurrentUser() || window.managerAuth?.getCurrentManager();

    // Admin users can ONLY access admin page
    if (user && user.role === 'admin') {
        if (pageId !== 'admin') {
            console.log('👑 Admin user attempting to access non-admin page - redirecting to admin dashboard');
            pageId = 'admin';
        }
        console.log(`✅ Admin access granted to ${pageId}`);
    } else {
        // Regular users cannot access admin page
        if (pageId === 'admin') {
            console.log('🚫 Regular user attempting to access admin page - access denied');
            showToast('❌ Access denied - Admin privileges required', 'error');
            pageId = 'dashboard';
        }
        console.log(`✅ Access granted to ${pageId} for user: ${user?.email}`);
    }

    showPageContent(pageId, param);
}

/**
 * Show login page and hide app content
 */
function showLoginPage() {
    // Hide all app pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show login screen
    const loginPage = document.getElementById('login-page');
    const appContent = document.querySelector('.app-content');
    const nav = document.querySelector('.nav');
    
    if (loginPage) {
        loginPage.style.display = 'flex';
    }
    if (appContent) {
        appContent.style.display = 'none';
    }
    if (nav) {
        nav.style.display = 'none';
    }
    
    // Focus on name input
    setTimeout(() => {
        const nameInput = document.getElementById('user-name');
        if (nameInput) {
            nameInput.focus();
        }
    }, 100);
    
    console.log('🔑 Login page displayed');
}

/**
 * Show specific page content (internal function)
 * @param {string} pageId - Page ID to show
 * @param {string} param - Optional parameter (e.g., eventId for manage/invite pages)
 */
function showPageContent(pageId, param) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    // Update nav buttons (only if nav is visible)
    const nav = document.querySelector('.nav');
    if (nav && nav.style.display !== 'none') {
        document.querySelectorAll('.nav button').forEach(btn => {
            btn.classList.remove('active');
        });
        const navButton = document.getElementById(`nav-${pageId}`);
        if (navButton) navButton.classList.add('active');
    }

    // Show/hide header and nav based on page
    const header = document.querySelector('.header');
    if (header) {
        header.style.display = pageId === 'manage' ? 'none' : '';
    }
    if (nav) {
        nav.style.display = pageId === 'invite' || pageId === 'manage' ? 'none' : 'flex';
    }

    // Sync URL via History API (no hash) when router is available
    if (window.AppRouter && typeof window.AppRouter.updateURLForPage === 'function') {
        window.AppRouter.updateURLForPage(pageId, param);
    }

    // Handle page-specific loading with parameters
    if (pageId === 'manage' && param) {
        // Load event management page with eventId
        if (window.eventManager && window.eventManager.showEventManagement) {
            window.eventManager.showEventManagement(param);
        } else {
            console.warn('⚠️ Event manager not loaded yet');
        }
        return;
    }
    
    // Page-specific initializations
    if (pageId === 'create') {
        // Initialize template selector
        if (window.eventTemplates) {
            const container = document.getElementById('template-selector-container');
            if (container && !container.hasChildNodes()) {
                container.innerHTML = window.eventTemplates.generateTemplateSelectorHTML();
            }
        }

        // Initialize photo upload handlers
        if (window.setupPhotoUpload) {
            window.setupPhotoUpload();
        }

        // Initialize event form handlers
        if (window.setupEventForm) {
            window.setupEventForm();
        }

        // Update form progress indicator
        if (typeof window.updateFormProgress === 'function') {
            window.updateFormProgress();
        }
    } else if (pageId === 'dashboard') {
        // Load dashboard data
        if (typeof window.loadManagerData === 'function') {
            window.loadManagerData();
        }
    } else if (pageId === 'admin') {
        // Load admin dashboard (admin only)
        if (window.AdminDashboard && typeof window.AdminDashboard.loadDashboard === 'function') {
            window.AdminDashboard.loadDashboard();
        }
    }

    console.log(`📄 Page changed to: ${pageId}`);
}

/**
 * Update user display in header
 */
function updateUserDisplay() {
    if (window.userAuth && window.userAuth.isAuthenticated()) {
        const user = window.userAuth.getCurrentUser();

        const displayName = document.getElementById('user-display-name');
        const avatar = document.getElementById('user-avatar');

        if (displayName) {
            displayName.textContent = (window.userAuth && typeof window.userAuth.getDisplayName === 'function')
                ? window.userAuth.getDisplayName()
                : (user.name || user.username || 'User');
        }

        if (avatar) {
            avatar.textContent = window.userAuth.getInitials();
        }

        // Show/hide admin navigation based on user role
        const adminNavBtn = document.getElementById('admin-nav-btn');
        if (adminNavBtn) {
            if (user.role === 'admin') {
                adminNavBtn.style.display = 'inline-block';
                console.log('👑 Admin navigation enabled for:', user.username);
            } else {
                adminNavBtn.style.display = 'none';
            }
        }

        console.log('👤 User display updated:', user.name);
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
    const modal = document.getElementById('user-profile-modal');

    if (!modal) return;

    // Populate modal with user data
    const avatarEl = document.getElementById('profile-avatar');
    const usernameEl = document.getElementById('profile-username');
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const branchEl = document.getElementById('profile-branch');
    const rankEl = document.getElementById('profile-rank');

    if (avatarEl) avatarEl.textContent = window.userAuth.getInitials ? window.userAuth.getInitials() : '👤';
    
    if (usernameEl) usernameEl.value = user.username || '';
    if (nameEl) nameEl.value = user.name || '';
    if (emailEl) emailEl.value = user.email || '';
    if (branchEl) branchEl.value = user.branch || '';

    // Update ranks for selected branch
    if (user.branch && window.updateProfileRanksForBranch) {
        window.updateProfileRanksForBranch();
    }

    if (rankEl) rankEl.value = user.rank || '';

    // Show modal
    modal.style.display = 'flex';
    const innerModal = modal.querySelector('.modal');
    if (innerModal) {
        innerModal.style.display = 'block';
        innerModal.classList.add('show');
    }
    requestAnimationFrame(() => {
        modal.classList.add('active', 'is-visible');
    });
}

/**
 * Update rank options when branch is selected in profile
 */
function updateProfileRanksForBranch() {
    const branchSelect = document.getElementById('profile-branch');
    const rankSelect = document.getElementById('profile-rank');

    if (!branchSelect || !rankSelect) return;

    const branch = branchSelect.value;
    const currentRank = rankSelect.value;

    // Clear existing options
    rankSelect.innerHTML = '<option value="">Select rank...</option>';

    if (!branch) {
        rankSelect.disabled = true;
        rankSelect.innerHTML = '<option value="">Select service branch first...</option>';
        return;
    }

    // Handle Civilian and Other
    if (branch === 'Civilian') {
        rankSelect.innerHTML = '<option value="Civilian">Civilian</option>';
        rankSelect.disabled = true;
        return;
    }

    if (branch === 'Other') {
        rankSelect.innerHTML = '<option value="">N/A</option>';
        rankSelect.disabled = true;
        return;
    }

    rankSelect.disabled = false;

    // Get ranks for branch using MilitaryData
    if (!window.MilitaryData) {
        console.error('MilitaryData not loaded');
        return;
    }

    const ranks = window.MilitaryData.getRanksForBranch(branch);

    ranks.forEach(rankData => {
        const option = document.createElement('option');
        option.value = rankData.value;
        option.textContent = rankData.label;
        rankSelect.appendChild(option);
    });

    // Restore previously selected rank if still valid
    if (currentRank) {
        const validRank = ranks.find(r => r.value === currentRank);
        if (validRank) {
            rankSelect.value = currentRank;
        }
    }
}

/**
 * Save user profile changes
 */
async function saveUserProfile() {
    if (!window.userAuth || !window.userAuth.isAuthenticated()) {
        return;
    }

    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const branchEl = document.getElementById('profile-branch');
    const rankEl = document.getElementById('profile-rank');
    const saveBtn = document.querySelector('#user-profile-modal button[onclick*="saveUserProfile"]');

    const name = nameEl?.value.trim();
    const email = emailEl?.value.trim().toLowerCase();
    const branch = branchEl?.value || '';
    const rank = rankEl?.value || '';

    if (!name || name.length < 2) {
        showToast('❌ Please enter a valid name', 'error');
        nameEl?.focus();
        return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('❌ Please enter a valid email address', 'error');
        emailEl?.focus();
        return;
    }

    const user = window.userAuth.getCurrentUser();
    const showToast = window.showToast || function(msg, type) { console.log(msg); };

    // IMPORTANT: Save to local storage FIRST, then sync to backend
    // This ensures user data is preserved even if backend fails
    user.name = name;
    user.email = email;
    user.branch = branch;
    user.rank = rank;
    user.lastUpdated = new Date().toISOString();

    // Save to local storage immediately
    window.userAuth.saveUserToStorage(user);

    // Update UI immediately
    if (window.updateUserDisplay) {
        window.updateUserDisplay();
    }

    try {
        // Show loading state
        if (saveBtn && window.LoadingUI && window.LoadingUI.withButtonLoading) {
            await window.LoadingUI.withButtonLoading(saveBtn, 'Syncing to backend...', async () => {
                // Try to sync to backend
                try {
                    const response = await window.userAuth.triggerAuthWorkflow('update_profile', {
                        username: user.username,
                        password: '', // Password not required for profile updates
                        name: name,
                        email: email,
                        branch: branch,
                        rank: rank,
                        client_id: 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
                    });

                    if (response.success) {
                        const freshUserData = response.user;
                        if (freshUserData) {
                            window.userAuth.saveUserToStorage(freshUserData);
                            window.userAuth.currentUser = freshUserData;
                        }
                        showToast('✅ Profile updated and synced to backend', 'success');
                    } else {
                        showToast('✅ Profile updated locally (backend sync pending)', 'success');
                    }
                } catch (backendError) {
                    // Check if it's a rate limit error
                    if (backendError.message && backendError.message.includes('rate limit')) {
                        showToast('✅ Profile updated locally (backend rate limited, will sync later)', 'success');
                    } else {
                        showToast('✅ Profile updated locally (backend sync failed)', 'success');
                    }
                    console.warn('Backend sync failed:', backendError);
                }

                closeUserProfile();
            });
        } else {
            // Fallback if LoadingUI not available
            try {
                const response = await window.userAuth.triggerAuthWorkflow('update_profile', {
                    username: user.username,
                    password: '',
                    name: name,
                    email: email,
                    branch: branch,
                    rank: rank,
                    client_id: 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
                });

                if (response.success) {
                    const freshUserData = response.user;
                    if (freshUserData) {
                        window.userAuth.saveUserToStorage(freshUserData);
                        window.userAuth.currentUser = freshUserData;
                    }
                    showToast('✅ Profile updated and synced to backend', 'success');
                } else {
                    showToast('✅ Profile updated locally (backend sync pending)', 'success');
                }
            } catch (backendError) {
                if (backendError.message && backendError.message.includes('rate limit')) {
                    showToast('✅ Profile updated locally (backend rate limited, will sync later)', 'success');
                } else {
                    showToast('✅ Profile updated locally (backend sync failed)', 'success');
                }
                console.warn('Backend sync failed:', backendError);
            }

            closeUserProfile();
        }
    } catch (error) {
        console.error('❌ Profile update UI error:', error);
        showToast('✅ Profile saved locally', 'success');
        closeUserProfile();
    }
}

/**
 * Close user profile modal
 */
function closeUserProfile() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        const innerModal = modal.querySelector('.modal');
        if (innerModal) {
            innerModal.style.display = '';
            innerModal.classList.remove('show');
        }
        modal.style.display = 'none';
        modal.classList.remove('active', 'is-visible');
    }
}

/**
 * Logout from profile modal
 */
function logoutFromProfile() {
    if (confirm('Are you sure you want to log out?')) {
        if (window.userAuth) {
            window.userAuth.logout();
        }
        location.reload();
    }
}

/**
 * Handle profile password change form submission
 */
async function handleProfilePasswordChange(e) {
    e.preventDefault();

    if (!window.userAuth || !window.userAuth.isAuthenticated()) {
        showToast('❌ You must be logged in to change your password', 'error');
        return;
    }

    const currentPassword = document.getElementById('profile-current-password')?.value;
    const newPassword = document.getElementById('profile-new-password')?.value;
    const confirmPassword = document.getElementById('profile-confirm-password')?.value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Validation
    if (!currentPassword) {
        showToast('❌ Please enter your current password', 'error');
        document.getElementById('profile-current-password')?.focus();
        return;
    }

    if (!newPassword || newPassword.length < 8) {
        showToast('❌ New password must be at least 8 characters', 'error');
        document.getElementById('profile-new-password')?.focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('❌ New passwords do not match', 'error');
        document.getElementById('profile-confirm-password')?.focus();
        return;
    }

    // Password strength check
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasNumber) {
        showToast('❌ Password must contain uppercase, lowercase, and number', 'error');
        return;
    }

    const user = window.userAuth.getCurrentUser();
    const cfg = window.BACKEND_CONFIG || {};
    const baseUrl = String(cfg.dispatchURL || '').replace(/\/$/, '');

    if (!baseUrl) {
        showToast('❌ Password change service is unavailable', 'error');
        return;
    }

    const doChangePassword = async () => {
        const response = await fetch(`${baseUrl}/api/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: user.username,
                currentPassword,
                newPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Password change failed');
        }

        // Clear the form
        e.target.reset();

        showToast('✅ Password changed successfully!', 'success');
    };

    try {
        if (window.LoadingUI && window.LoadingUI.withButtonLoading) {
            await window.LoadingUI.withButtonLoading(submitBtn, 'Updating...', doChangePassword);
        } else {
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner"></span> Updating...';
            submitBtn.disabled = true;
            try {
                await doChangePassword();
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    } catch (error) {
        console.error('Password change error:', error);
        showToast('❌ ' + error.message, 'error');
    }
}

// Make functions globally available
window.showUserMenu = showUserMenu;
window.updateProfileRanksForBranch = updateProfileRanksForBranch;
window.saveUserProfile = saveUserProfile;
window.closeUserProfile = closeUserProfile;
window.logoutFromProfile = logoutFromProfile;
window.handleProfilePasswordChange = handleProfilePasswordChange;

/**
 * Show toast notification - Available immediately
 */
function showToast(message, type = 'success') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        ${type === 'success' ? 'background: #10b981;' : 'background: #ef4444;'}
    `;
    toast.textContent = message;
    
    // Add animation styles if not present
    if (!document.querySelector('#toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

/**
 * Copy invite link - Available immediately for HTML onclick
 */
async function copyInviteLink(eventId) {
    try {
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }
        
        const link = generateInviteURL(event);
        const success = await copyToClipboard(link);
        
        if (success) {
            showToast('🔗 Invite link copied to clipboard!', 'success');
        } else {
            prompt('Copy this invite link:', link);
        }
    } catch (error) {
        console.error('Failed to copy link:', error);
        showToast('Failed to copy link', 'error');
    }
}

/**
 * Get the base path for the application (handles GitHub Pages)
 * @returns {string} Base path (e.g., '/EventCall/' or '/')
 */
function getBasePath() {
    // Return cached value if already determined
    if (window.__BASE_PATH_CACHE__) {
        return window.__BASE_PATH_CACHE__;
    }

    // Check if we're on GitHub Pages
    const isGitHubPages = window.location.hostname.endsWith('.github.io');

    if (isGitHubPages) {
        // List of known app pages to exclude when extracting base path
        const knownPages = ['dashboard', 'create', 'manage', 'invite', 'index.html'];

        // Extract repo name from pathname
        const pathParts = window.location.pathname.split('/').filter(p => p);
        if (pathParts.length > 0 && !knownPages.includes(pathParts[0])) {
            window.__BASE_PATH_CACHE__ = '/' + pathParts[0] + '/';
            return window.__BASE_PATH_CACHE__;
        }
        // Fallback for root or when first part is a known page
        window.__BASE_PATH_CACHE__ = '/EventCall/';
        return window.__BASE_PATH_CACHE__;
    }

    window.__BASE_PATH_CACHE__ = '/';
    return window.__BASE_PATH_CACHE__;
}

/**
 * Generate invite URL - Utility function
 */
// function generateInviteURL(event) {
function generateInviteURL(event) {
    const basePath = getBasePath();
    const baseURL = window.location.origin + basePath;
    const encodedData = encodeURIComponent(JSON.stringify({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        description: event.description,
        coverImage: event.coverImage,
        askReason: event.askReason,
        allowGuests: event.allowGuests,
        requiresMealChoice: event.requiresMealChoice || false,
        eventDetails: event.eventDetails || {},
        customQuestions: event.customQuestions || [],
        created: event.created
    }));
    return `${baseURL}?data=${encodedData}#invite/${event.id}`;
}

/**
 * Copy to clipboard - Utility function
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }
}

/**
 * Open default email client to compose message to attendee
 */
function mailAttendee(email, eventTitle = 'EventCall Event') {
    if (!email) {
        showToast('❌ No email address available', 'error');
        return;
    }
    
    const sanitizedEmail = encodeURIComponent(email.trim());
    const sanitizedTitle = encodeURIComponent(eventTitle);
    const subject = `RE: ${sanitizedTitle}`;
    const mailtoLink = `mailto:${sanitizedEmail}?subject=${encodeURIComponent(subject)}`;
    
    window.location.href = mailtoLink;
    
    console.log(`📧 Opening email client for: ${email}`);
    showToast(`📧 Opening email to ${email}`, 'success');
}

/**
 * Export event data - Available immediately for HTML onclick
 */
function exportEventData(eventId) {
    try {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];
        
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }
        
        const csvContent = createCSVContent(event, eventResponses);
        const filename = `${generateSafeFilename(event.title)}_rsvps.csv`;
        
        downloadFile(csvContent, filename, 'text/csv');
        showToast('📊 Data exported successfully!', 'success');
        
    } catch (error) {
        console.error('Failed to export data:', error);
        showToast('Failed to export data', 'error');
    }
}

/**
 * Create CSV content from RSVP data
 */
// function createCSVContent(event, responses) {
function createTSVContent(event, responses) {
    // Add TSV generation and clipboard copy helper
    function csvSafe(value) {
        let v = (value ?? '').toString();
        v = v.replace(/\t/g, ' '); // avoid breaking TSV cells
        v = v.replace(/"/g, '""');
        if (/^[=\+\-@]/.test(v)) v = `'${v}`;
        return v;
    }

    let tsv = "Name\tEmail\tPhone\tAttending\tRank\tUnit\tBranch\t";
    if (event.askReason) tsv += "Reason\t";
    if (event.allowGuests) tsv += "Guest Count\t";
    if (event.requiresMealChoice) tsv += "Dietary Restrictions\tAllergy Details\t";
    if (event.eventDetails && Object.keys(event.eventDetails).length > 0) {
        Object.values(event.eventDetails).forEach(detail => {
            tsv += `${csvSafe(detail.label)}\t`;
        });
    }
    if (event.customQuestions && event.customQuestions.length > 0) {
        event.customQuestions.forEach(q => {
            tsv += `${csvSafe(q.question)}\t`;
        });
    }
    tsv += "Timestamp\n";

    responses.forEach(response => {
        const diet = (response.dietaryRestrictions || []).join('; ');
        let row = [
            csvSafe(response.name),
            csvSafe(response.email),
            csvSafe(response.phone || ''),
            response.attending ? 'Yes' : 'No',
            csvSafe(response.rank || ''),
            csvSafe(response.unit || ''),
            csvSafe(response.branch || '')
        ];
        if (event.askReason) row.push(csvSafe(response.reason || ''));
        if (event.allowGuests) row.push(csvSafe(response.guestCount || 0));
        if (event.requiresMealChoice) {
            row.push(csvSafe(diet), csvSafe(response.allergyDetails || ''));
        }
        if (event.eventDetails && Object.keys(event.eventDetails).length > 0) {
            Object.values(event.eventDetails).forEach(detail => {
                row.push(csvSafe(detail.value || ''));
            });
        }
        if (event.customQuestions && event.customQuestions.length > 0) {
            event.customQuestions.forEach(q => {
                const answer = response.customAnswers && response.customAnswers[q.id] ? response.customAnswers[q.id] : '';
                row.push(csvSafe(answer));
            });
        }
        row.push(new Date(response.timestamp).toISOString());
        tsv += row.join('\t') + '\n';
    });

    return tsv;
}

function copyEventData(eventId) {
    try {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }
        const tsv = createTSVContent(event, eventResponses);
        copyToClipboard(tsv).then(() => {
            showToast('📋 TSV copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Clipboard copy failed:', err);
            showToast('❌ Failed to copy TSV', 'error');
        });
    } catch (error) {
        console.error('Failed to copy data:', error);
        showToast('❌ Failed to copy data', 'error');
    }
}

/**
 * Generate safe filename from event title
 */
function generateSafeFilename(title) {
    return title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Download file utility
 */
function downloadFile(data, filename, mimeType = 'text/plain') {
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/**
 * Delete event - Available immediately for HTML onclick
 */
async function deleteEvent(eventId) {
    try {
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }
        
        if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) {
            return;
        }

        const currentUser = (window.userAuth && window.userAuth.getCurrentUser && window.userAuth.getCurrentUser()) || (window.userAuth && window.userAuth.currentUser) || (window.getCurrentAuthenticatedUser ? window.getCurrentAuthenticatedUser() : null);
        const ownerId = String(currentUser && currentUser.id ? currentUser.id : '').trim().toLowerCase();
        const ownerUsername = String(currentUser && currentUser.username ? currentUser.username : '').trim().toLowerCase();
        const eventOwner = String(event.createdBy || event.createdByUsername || '').trim().toLowerCase();
        if (ownerId || ownerUsername) {
            const matchesOwner = (ownerId && eventOwner === ownerId) || (ownerUsername && eventOwner === ownerUsername);
            if (!matchesOwner) {
                showToast('❌ You can only delete your own events', 'error');
                return;
            }
        }

        if (window.BackendAPI && window.BackendAPI.deleteEvent) {
            await window.BackendAPI.deleteEvent(eventId);
        } else if (window.githubAPI && window.githubAPI.deleteEvent) {
            await window.githubAPI.deleteEvent(eventId, event.title, event.coverImage);
        }
        
        // Remove from local state
        if (window.events) delete window.events[eventId];
        if (window.responses) delete window.responses[eventId];
        
        // Refresh dashboard if function exists
        if (window.renderDashboard) {
            window.renderDashboard();
        } else if (window.loadManagerData) {
            await window.loadManagerData();
        }
        
        showToast('🗑️ Event deleted successfully', 'success');

        // Navigate to dashboard if on manage page
        if (window.location.hash.includes('manage/')) {
            navigateTo('dashboard');
        }
        
    } catch (error) {
        console.error('Failed to delete event:', error);
        showToast('Failed to delete event: ' + error.message, 'error');
    }
}

/**
 * Check URL hash on page load to handle direct links
 */
function checkURLHash() {
    const hash = window.location.hash.substring(1);
    const hasInviteData = window.location.search.includes('data=');

    // Handle invite URLs (guest access)
    if (hash.startsWith('invite/') || hasInviteData) {
        let eventId = '';

        // Try to get event ID from hash first
        if (hash.startsWith('invite/')) {
            eventId = hash.split('/')[1];
        }

        // If no event ID in hash but we have query data, try to parse it
        if (!eventId && hasInviteData) {
            try {
                const params = new URLSearchParams(window.location.search);
                const data = params.get('data');
                if (data) {
                    const eventData = JSON.parse(decodeURIComponent(data));
                    eventId = eventData.id;
                }
            } catch (e) {
                console.error('Failed to parse event data from URL:', e);
            }
        }

        console.log('🔗 Direct invite link accessed:', eventId);

        // Force show invite page without login requirement
        showPageContent('invite');

        if (eventId && window.uiComponents && window.uiComponents.showInvite) {
            window.uiComponents.showInvite(eventId);
        } else {
            console.log('⏳ UI components not loaded yet, will handle invite later');
        }
        return;
    }
    
    if (hash.startsWith('manage/')) {
        const eventId = hash.split('/')[1];
        console.log('📊 Direct manage link accessed:', eventId);

        // Check login first (supports both auth systems)
        const isAuthenticated = window.userAuth?.isAuthenticated() || window.managerAuth?.isAuthenticated();
        if (!isAuthenticated) {
            console.log('🔒 Manage access denied - redirecting to login');
            showLoginPage();
            return;
        }

        // Avoid re-entrancy if already showing this event's management page
        if (window.eventManager?.currentEvent?.id === eventId) {
            showPage('manage');
            return;
        }

        if (window.eventManager && window.eventManager.showEventManagement) {
            window.eventManager.showEventManagement(eventId);
        } else {
            console.log('⏳ Event manager not loaded yet, will handle later');
        }
        return;
    }
    
    // Handle other hash values
    if (hash && ['dashboard', 'create'].includes(hash)) {
        showPage(hash);
    }
}

/**
 * Navigate to dashboard - Available immediately for HTML onclick
 * Uses unified navigation internally
 */
function goToDashboard() {
    navigateTo('dashboard');
}

/**
 * Initialize hash change listener
 */
function initializeHashListener() {
    // If AppRouter is available, let it handle routing
    if (window.AppRouter) {
        console.log('📡 AppRouter detected - yielding routing control');
        return;
    }

    const isGitHubPages = window.location.hostname.endsWith('.github.io');
    if (isGitHubPages) {
        window.addEventListener('popstate', handleURLPath);
        setTimeout(handleURLPath, 100);
    } else {
        window.addEventListener('hashchange', checkURLHash);
        setTimeout(checkURLHash, 100);
    }
}

// Make functions globally available immediately
window.showPage = showPage;
window.showLoginPage = showLoginPage;
window.showPageContent = showPageContent;
window.showToast = showToast;
window.copyInviteLink = copyInviteLink;
window.exportEventData = exportEventData;
window.deleteEvent = deleteEvent;
window.mailAttendee = mailAttendee;
window.checkURLHash = checkURLHash;
window.getBasePath = getBasePath;
// New path-based handler
function handleURLPath() {
    const pathname = window.location.pathname || '';
    const path = pathname.replace(/^\/+/, '');
    const hasInviteData = window.location.search.includes('data=');

    if (path.startsWith('invite/') || hasInviteData) {
        const eventId = path.split('/')[1];
        showPageContent('invite');
        if (window.uiComponents && window.uiComponents.showInvite) {
            window.uiComponents.showInvite(eventId);
        }
        return;
    }

    if (path.startsWith('manage/')) {
        const eventId = path.split('/')[1];
        const isAuthenticated = window.userAuth?.isAuthenticated() || window.managerAuth?.isAuthenticated();
        if (!isAuthenticated) {
            showLoginPage();
            return;
        }
        if (window.eventManager && window.eventManager.showEventManagement) {
            window.eventManager.showEventManagement(eventId);
        } else {
            showPage('manage');
        }
        return;
    }

    if (!path || path === 'dashboard') {
        showPage('dashboard');
        return;
    }
    if (path === 'create') {
        showPage('create');
        return;
    }
}
window.handleURLPath = handleURLPath;
window.initializeHashListener = initializeHashListener;
window.goToDashboard = goToDashboard;
window.enforceLogin = enforceLogin;
window.updateUserDisplay = updateUserDisplay;
window.showUserMenu = showUserMenu;

/**
 * App Loader functions have been moved to js/app-loader.js
 * to ensure reliable loading and prevent initialization conflicts.
 */


// Initialize hash listener when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeHashListener();
    // Note: loader is NOT auto-hidden here - only shows/hides on login

    // Attach profile password change form handler
    const profilePasswordForm = document.getElementById('profile-password-form');
    if (profilePasswordForm) {
        profilePasswordForm.addEventListener('submit', handleProfilePasswordChange);
    }

    // Add password strength indicator for profile password change
    const profileNewPassword = document.getElementById('profile-new-password');
    const profilePasswordStrength = document.getElementById('profile-password-strength');
    if (profileNewPassword && profilePasswordStrength && window.userAuth) {
        profileNewPassword.addEventListener('input', (e) => {
            const result = window.userAuth.checkPasswordStrength(e.target.value);
            // Escape message to prevent XSS (message may contain parts of password)
            const escapeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const escapedMessage = escapeHTML(result.message);
            const widthPercent = Math.min(100, (result.score / 6) * 100);
            profilePasswordStrength.innerHTML = `
                <div class="password-strength-bar" style="background: ${result.color}; width: ${widthPercent}%;"></div>
                <span class="password-strength-text" style="color: ${result.color};">${escapedMessage}</span>
            `;
        });
    }
});

console.log('✅ Early functions loaded with username-only authentication support');

// Add TSV generation and clipboard copy helper
async function copyEventDataAsTSV(event, responses) {
    const tsv = createTSVContent(event, responses);
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(tsv);
            showToast('✅ TSV copied to clipboard', 'success');
            return;
        }
        throw new Error('Clipboard API unavailable');
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = tsv;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('✅ TSV copied to clipboard', 'success');
        } catch (err) {
            console.error('Clipboard copy failed:', err);
            showToast('⚠️ Could not copy TSV. Please copy manually.', 'error');
        } finally {
            document.body.removeChild(textarea);
        }
    }
}
