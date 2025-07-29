/**
 * EventCall Main Application - Enhanced Version with Better Error Handling
 * Cloud storage with localStorage fallback
 */

// Global application state
let events = {};
let responses = {};
let currentPage = 'dashboard';
let currentUser = null;
let isLoggedIn = false;
let isOnline = true;
let lastSyncTime = 0;

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🚀 Initializing EventCall...');
        await initializeApp();
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showToast('Failed to initialize EventCall', 'error');
    }
});

/**
 * Initialize application components
 */
async function initializeApp() {
    // Check if user is already logged in
    const savedUser = getSavedUser();
    if (savedUser && isValidEmail(savedUser.email)) {
        currentUser = savedUser;
        isLoggedIn = true;
        console.log('👤 User auto-logged in:', savedUser.email);
        await startMainApp();
    } else {
        showLoginPage();
    }
}

/**
 * Show login page
 */
function showLoginPage() {
    // Hide main app content
    document.querySelector('.header').style.display = 'none';
    document.querySelector('.container').style.display = 'none';
    document.querySelector('.footer').style.display = 'none';

    // Create login overlay
    const loginOverlay = document.createElement('div');
    loginOverlay.id = 'login-overlay';
    loginOverlay.innerHTML = `
        <div class="login-container">
            <div class="login-hero">
                <div class="login-logo">
                    <div class="logo-icon">🎖️</div>
                    <h1>EventCall</h1>
                    <p class="tagline">Where Every Event Matters</p>
                </div>
                
                <div class="hero-description">
                    <h2>Professional Military Event Management</h2>
                    <p>Secure, private event management with real-time RSVP tracking.</p>
                </div>
            </div>

            <div class="login-form-section">
                <div class="login-card">
                    <h2>Access EventCall</h2>
                    <p>Enter your email to access your private event dashboard</p>
                    
                    <form id="login-form" class="login-form">
                        <div class="form-group">
                            <label for="login-email">Email Address</label>
                            <input type="email" id="login-email" required 
                                   placeholder="your.email@domain.com" 
                                   autocomplete="email">
                            <small>Your email is used to filter and secure your events</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="login-name">Display Name (Optional)</label>
                            <input type="text" id="login-name" 
                                   placeholder="Your Name"
                                   autocomplete="name">
                            <small>How your name appears on events you create</small>
                        </div>
                        
                        <div class="form-group checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="login-remember" checked>
                                <span class="checkmark"></span>
                                Remember me on this device
                            </label>
                        </div>
                        
                        <button type="submit" class="login-btn">
                            🚀 Access EventCall
                        </button>
                    </form>
                    
                    <div class="privacy-note">
                        <div class="privacy-icon">🔒</div>
                        <div class="privacy-text">
                            <strong>Privacy & Security</strong><br>
                            • Your email filters what events you can see and manage<br>
                            • Only you can see events you create<br>
                            • All data is stored securely in the cloud
                        </div>
                    </div>
                </div>
            </div>

            <div class="login-footer">
                <div class="powered-by">
                    <div class="powered-text">Powered by</div>
                    <div class="powered-logo" onclick="window.open('https://linktr.ee/semperadmin', '_blank')">
                        SEMPER ADMIN
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add login styles
    const loginStyles = document.createElement('style');
    loginStyles.textContent = `
        #login-overlay {
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
        
        .login-container {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }
        
        .login-hero {
            text-align: center;
            margin-bottom: 3rem;
        }
        
        .login-logo {
            margin-bottom: 2rem;
        }
        
        .logo-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        
        .login-logo h1 {
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
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: var(--semper-gold);
        }
        
        .hero-description p {
            font-size: 1rem;
            opacity: 0.9;
            max-width: 400px;
            margin: 0 auto;
        }
        
        .login-form-section {
            width: 100%;
            max-width: 400px;
        }
        
        .login-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 2rem;
            border-radius: 1rem;
            border: 2px solid var(--semper-gold);
            backdrop-filter: blur(10px);
        }
        
        .login-card h2 {
            text-align: center;
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
            color: var(--semper-gold);
        }
        
        .login-card > p {
            text-align: center;
            margin-bottom: 2rem;
            opacity: 0.9;
            font-size: 0.9rem;
        }
        
        .login-form .form-group {
            margin-bottom: 1.5rem;
        }
        
        .login-form label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: var(--semper-gold);
        }
        
        .login-form input[type="email"],
        .login-form input[type="text"] {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid rgba(255, 215, 0, 0.3);
            border-radius: 0.5rem;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 1rem;
            transition: border-color 0.3s ease;
        }
        
        .login-form input:focus {
            outline: none;
            border-color: var(--semper-gold);
            box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
        }
        
        .login-form input::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }
        
        .login-form small {
            display: block;
            margin-top: 0.5rem;
            font-size: 0.75rem;
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
        
        .login-btn {
            width: 100%;
            background: linear-gradient(135deg, var(--semper-gold) 0%, #e6c200 100%);
            color: var(--semper-navy);
            border: none;
            padding: 1rem;
            border-radius: 0.5rem;
            font-size: 1.1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4);
        }
        
        .privacy-note {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
            margin-top: 1.5rem;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0.5rem;
            border-left: 3px solid var(--semper-gold);
        }
        
        .privacy-icon {
            font-size: 1.2rem;
            flex-shrink: 0;
        }
        
        .privacy-text {
            font-size: 0.8rem;
            line-height: 1.4;
        }
        
        .login-footer {
            margin-top: 2rem;
            text-align: center;
            opacity: 0.8;
        }
        
        .powered-text {
            font-size: 0.8rem;
            margin-bottom: 0.5rem;
        }
        
        .powered-logo {
            font-size: 1rem;
            font-weight: 900;
            color: var(--semper-gold);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .powered-logo:hover {
            transform: scale(1.05);
        }
        
        @media (max-width: 768px) {
            .login-container {
                padding: 1rem;
            }
            
            .login-logo h1 {
                font-size: 2.5rem;
            }
            
            .hero-description h2 {
                font-size: 1.25rem;
            }
            
            .login-card {
                padding: 1.5rem;
            }
        }
    `;

    document.head.appendChild(loginStyles);
    document.body.appendChild(loginOverlay);

    // Handle form submission
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Focus email input
    setTimeout(() => {
        document.getElementById('login-email').focus();
    }, 100);
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const name = document.getElementById('login-name').value.trim();
    const remember = document.getElementById('login-remember').checked;

    // Validate email
    if (!isValidEmail(email)) {
        showLoginError('Please enter a valid email address');
        return;
    }

    // Create user object
    const user = {
        email: email,
        name: name || generateDisplayName(email),
        loginTime: Date.now(),
        remember: remember
    };

    // Save user if remember is checked
    if (remember) {
        saveUser(user);
    }

    // Set current user
    currentUser = user;
    isLoggedIn = true;

    // Remove login overlay
    const overlay = document.getElementById('login-overlay');
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        overlay.remove();
        startMainApp();
    }, 500);
}

/**
 * Start main application after login
 */
async function startMainApp() {
    // Show main app content
    document.querySelector('.header').style.display = 'block';
    document.querySelector('.container').style.display = 'block';
    document.querySelector('.footer').style.display = 'block';

    // Setup event listeners
    setupEventListeners();
    
    // Check URL hash for routing
    checkURLHash();
    
    // Update header with user info
    updateHeaderWithUser();
    
    // Load data with better error handling
    await loadDataWithFallback();
    
    console.log('✅ EventCall initialized for user:', currentUser.email);
}

/**
 * Load data with GitHub primary and localStorage fallback
 */
async function loadDataWithFallback() {
    let githubWorking = false;
    
    try {
        // Test GitHub connection first
        console.log('🔍 Testing GitHub connection...');
        githubWorking = await githubAPI.testConnection();
        
        if (githubWorking) {
            console.log('✅ GitHub connection successful');
            isOnline = true;
            showConnectionStatus('online');
            await loadFromGitHub();
        } else {
            throw new Error('GitHub connection failed');
        }
        
    } catch (error) {
        console.warn('⚠️ GitHub unavailable, using localStorage:', error.message);
        isOnline = false;
        showConnectionStatus('offline');
        loadFromLocalStorage();
    }
    
    // Render the dashboard
    renderDashboard();
    
    // Start periodic sync if GitHub is working
    if (githubWorking) {
        startPeriodicSync();
    }
}

/**
 * Load data from GitHub
 */
async function loadFromGitHub() {
    try {
        showToast('📡 Loading from cloud...', 'success');
        
        // Load ALL events and responses from GitHub
        const [allEvents, allResponses] = await Promise.all([
            githubAPI.loadEvents(),
            githubAPI.loadResponses()
        ]);
        
        // Filter events to only show user's events
        events = {};
        Object.keys(allEvents).forEach(eventId => {
            const event = allEvents[eventId];
            if (event.createdBy === currentUser.email) {
                events[eventId] = event;
            }
        });
        
        // Filter responses to only user's events
        responses = {};
        Object.keys(events).forEach(eventId => {
            if (allResponses[eventId]) {
                responses[eventId] = allResponses[eventId];
            }
        });
        
        console.log(`✅ Loaded ${Object.keys(events).length} events from GitHub`);
        
        // Save to localStorage as backup
        saveToLocalStorage();
        
        lastSyncTime = Date.now();
        
        // Initialize GitHub repository if it's empty
        if (Object.keys(allEvents).length === 0) {
            console.log('🔧 Initializing GitHub repository...');
            await githubAPI.initializeRepository();
        }
        
    } catch (error) {
        console.error('❌ Failed to load from GitHub:', error);
        throw error;
    }
}

/**
 * Load data from localStorage
 */
function loadFromLocalStorage() {
    try {
        console.log('💾 Loading from localStorage...');
        
        // Load user's events from localStorage
        const allLocalEvents = JSON.parse(localStorage.getItem('eventcall_events') || '{}');
        const allLocalResponses = JSON.parse(localStorage.getItem('eventcall_responses') || '{}');
        
        // Filter for current user
        events = {};
        Object.keys(allLocalEvents).forEach(eventId => {
            const event = allLocalEvents[eventId];
            if (event.createdBy === currentUser.email) {
                events[eventId] = event;
            }
        });
        
        responses = {};
        Object.keys(events).forEach(eventId => {
            if (allLocalResponses[eventId]) {
                responses[eventId] = allLocalResponses[eventId];
            }
        });
        
        console.log(`✅ Loaded ${Object.keys(events).length} events from localStorage`);
        
    } catch (error) {
        console.error('❌ Failed to load from localStorage:', error);
        events = {};
        responses = {};
    }
}

/**
 * Save data to localStorage
 */
function saveToLocalStorage() {
    try {
        // Load existing data first to preserve other users' events
        const allLocalEvents = JSON.parse(localStorage.getItem('eventcall_events') || '{}');
        const allLocalResponses = JSON.parse(localStorage.getItem('eventcall_responses') || '{}');
        
        // Update with current user's events
        Object.keys(events).forEach(eventId => {
            allLocalEvents[eventId] = events[eventId];
        });
        
        Object.keys(responses).forEach(eventId => {
            allLocalResponses[eventId] = responses[eventId];
        });
        
        // Save back to localStorage
        localStorage.setItem('eventcall_events', JSON.stringify(allLocalEvents));
        localStorage.setItem('eventcall_responses', JSON.stringify(allLocalResponses));
        
        console.log('💾 Data saved to localStorage');
        
    } catch (error) {
        console.error('❌ Failed to save to localStorage:', error);
    }
}

/**
 * Show connection status in header
 */
function showConnectionStatus(status) {
    // Remove existing status
    const existingStatus = document.querySelector('.connection-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    const statusElement = document.createElement('div');
    statusElement.className = 'connection-status';
    statusElement.style.cssText = `
        position: absolute;
        top: 1rem;
        left: 1rem;
        background: rgba(255, 255, 255, 0.1);
        padding: 0.5rem 1rem;
        border-radius: 2rem;
        font-size: 0.75rem;
        color: var(--semper-gold);
        z-index: 10;
        border: 1px solid rgba(255, 215, 0, 0.3);
    `;
    
    if (status === 'online') {
        statusElement.innerHTML = `☁️ Cloud Connected`;
        statusElement.style.background = 'rgba(16, 185, 129, 0.2)';
        statusElement.style.borderColor = 'rgba(16, 185, 129, 0.5)';
    } else {
        statusElement.innerHTML = `💾 Offline Mode`;
        statusElement.style.background = 'rgba(245, 158, 11, 0.2)';
        statusElement.style.borderColor = 'rgba(245, 158, 11, 0.5)';
    }
    
    const headerContent = document.querySelector('.header-content');
    headerContent.style.position = 'relative';
    headerContent.appendChild(statusElement);
}

/**
 * Start periodic sync with GitHub
 */
function startPeriodicSync() {
    // Sync every 5 minutes
    setInterval(async () => {
        if (isOnline) {
            try {
                console.log('🔄 Auto-syncing with GitHub...');
                await loadFromGitHub();
                console.log('✅ Auto-sync completed');
            } catch (error) {
                console.warn('⚠️ Auto-sync failed:', error.message);
                isOnline = false;
                showConnectionStatus('offline');
            }
        }
    }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Manual sync with GitHub
 */
async function syncWithGitHub() {
    try {
        showToast('🔄 Syncing with cloud...', 'success');
        
        // Test connection first
        const connected = await githubAPI.testConnection();
        if (!connected) {
            throw new Error('GitHub connection unavailable');
        }
        
        isOnline = true;
        showConnectionStatus('online');
        
        // Load latest data
        await loadFromGitHub();
        renderDashboard();
        
        showToast('✅ Sync completed!', 'success');
        
    } catch (error) {
        console.error('❌ Sync failed:', error);
        isOnline = false;
        showConnectionStatus('offline');
        showToast(`⚠️ Sync failed: ${error.message}`, 'error');
    }
}

/**
 * Save event with fallback handling
 */
async function saveEventWithFallback(eventData) {
    // Always save to localStorage first
    events[eventData.id] = eventData;
    saveToLocalStorage();
    
    // Try to save to GitHub if online
    if (isOnline) {
        try {
            await githubAPI.saveEvent(eventData);
            console.log('✅ Event saved to GitHub');
        } catch (error) {
            console.error('❌ Failed to save to GitHub:', error);
            isOnline = false;
            showConnectionStatus('offline');
            showToast('⚠️ Saved locally, will sync when online', 'error');
        }
    } else {
        showToast('💾 Saved locally, will sync when online', 'success');
    }
}

/**
 * Save RSVP with fallback handling
 */
async function saveRSVPWithFallback(eventId, rsvpData) {
    // Always save to localStorage first
    if (!responses[eventId]) {
        responses[eventId] = [];
    }
    
    // Check for duplicate email
    const existingIndex = responses[eventId].findIndex(r => 
        r.email.toLowerCase() === rsvpData.email.toLowerCase()
    );
    
    if (existingIndex !== -1) {
        responses[eventId][existingIndex] = rsvpData;
    } else {
        responses[eventId].push(rsvpData);
    }
    
    saveToLocalStorage();
    
    // Try to save to GitHub if online
    if (isOnline) {
        try {
            await githubAPI.saveRSVP(eventId, rsvpData);
            console.log('✅ RSVP saved to GitHub');
        } catch (error) {
            console.error('❌ Failed to save RSVP to GitHub:', error);
            isOnline = false;
            showConnectionStatus('offline');
            showToast('⚠️ RSVP saved locally, will sync when online', 'error');
        }
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Form submissions
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }
    
    // Image upload
    setupImageUpload();
    
    // Window events
    window.addEventListener('hashchange', checkURLHash);
    
    // RSVP options (delegated event listener)
    document.addEventListener('click', handleRSVPOptionClick);
    
    console.log('🎯 Event listeners setup complete');
}

/**
 * Update header with user information
 */
function updateHeaderWithUser() {
    if (!currentUser) return;

    // Add user info to header
    const headerContent = document.querySelector('.header-content');
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.style.cssText = `
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: rgba(255, 255, 255, 0.1);
        padding: 0.5rem 1rem;
        border-radius: 2rem;
        font-size: 0.75rem;
        color: var(--semper-gold);
        cursor: pointer;
        transition: all 0.3s ease;
        z-index: 10;
    `;
    userInfo.innerHTML = `
        👤 ${currentUser.name}
        <div style="font-size: 0.625rem; opacity: 0.8;">${currentUser.email}</div>
    `;
    userInfo.onclick = () => showUserProfile();
    
    // Add hover effect
    userInfo.onmouseenter = () => {
        userInfo.style.background = 'rgba(255, 255, 255, 0.2)';
        userInfo.style.transform = 'scale(1.05)';
    };
    userInfo.onmouseleave = () => {
        userInfo.style.background = 'rgba(255, 255, 255, 0.1)';
        userInfo.style.transform = 'scale(1)';
    };

    headerContent.style.position = 'relative';
    headerContent.appendChild(userInfo);
}

// Global state for editing
let isEditMode = false;
let editingEventId = null;

/**
 * Handle event form submission
 */
async function handleEventSubmit(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.innerHTML = '<div class="spinner"></div> ' + (isEditMode ? 'Updating...' : 'Creating...');
    submitBtn.disabled = true;

    try {
        const eventData = {
            id: isEditMode ? editingEventId : generateUUID(),
            title: sanitizeText(document.getElementById('event-title').value),
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            location: sanitizeText(document.getElementById('event-location').value),
            description: sanitizeText(document.getElementById('event-description').value),
            coverImage: document.getElementById('cover-preview').src || '',
            askReason: document.getElementById('ask-reason').checked,
            allowGuests: document.getElementById('allow-guests').checked,
            customQuestions: getCustomQuestions(),
            created: isEditMode ? events[editingEventId].created : Date.now(),
            lastModified: Date.now(),
            createdBy: currentUser.email,
            createdByName: currentUser.name,
            status: EVENT_STATUS.ACTIVE
        };

        if (!isValidEventTitle(eventData.title)) {
            throw new Error('Please enter a valid event title (3-100 characters)');
        }

        if (!eventData.date || !eventData.time) {
            throw new Error('Please specify both date and time for the event');
        }

        // Save with fallback handling
        await saveEventWithFallback(eventData);
        
        showToast(isEditMode ? '✅ Event updated successfully!' : MESSAGES.success.eventCreated, 'success');
        
        // Reset form and redirect
        resetEventForm();
        renderDashboard();
        showPage('dashboard');
        
    } catch (error) {
        console.error('Failed to save event:', error);
        showToast('Failed to save event: ' + error.message, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

/**
 * Delete event with fallback handling
 */
async function deleteEvent(eventId) {
    const event = events[eventId];
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) {
        return;
    }

    try {
        // Remove from local state first
        delete events[eventId];
        delete responses[eventId];
        saveToLocalStorage();
        
        // Try to delete from GitHub if online
        if (isOnline) {
            try {
                await githubAPI.deleteEvent(eventId, event.title);
                console.log('✅ Event deleted from GitHub');
            } catch (error) {
                console.error('❌ Failed to delete from GitHub:', error);
                isOnline = false;
                showConnectionStatus('offline');
                showToast('⚠️ Deleted locally, will sync when online', 'error');
            }
        }
        
        renderDashboard();
        showToast('🗑️ Event deleted successfully', 'success');
        
        if (currentPage === 'manage') {
            showPage('dashboard');
        }
        
    } catch (error) {
        console.error('Failed to delete event:', error);
        showToast('Failed to delete event: ' + error.message, 'error');
    }
}

// Continue with the rest of the functions...
// [Include all the remaining functions from the original main.js with enhanced error handling]

/**
 * Show user profile
 */
function showUserProfile() {
    const modal = document.createElement('div');
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
    `;
    
    const syncStatus = isOnline ? '☁️ Cloud Connected' : '💾 Offline Mode';
    const lastSync = lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never';
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 1rem; max-width: 500px; width: 90%; padding: 0; overflow: hidden; border: 3px solid var(--semper-gold);">
            <div style="background: linear-gradient(135deg, var(--semper-navy) 0%, var(--semper-red) 100%); color: white; padding: 2rem; text-align: center;">
                <h2 style="margin-bottom: 0.5rem;">👤 User Profile</h2>
                <p style="opacity: 0.9; color: var(--semper-gold);">Your EventCall account</p>
            </div>
            
            <div style="padding: 2rem;">
                <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                    <div style="margin-bottom: 1rem;"><strong>📧 Email:</strong> ${currentUser.email}</div>
                    <div style="margin-bottom: 1rem;"><strong>👤 Name:</strong> ${currentUser.name}</div>
                    <div style="margin-bottom: 1rem;"><strong>📊 Events:</strong> ${Object.keys(events).length}</div>
                    <div style="margin-bottom: 1rem;"><strong>🔗 Status:</strong> ${syncStatus}</div>
                    <div style="margin-bottom: 1rem;"><strong>🔄 Last Sync:</strong> ${lastSync}</div>
                    <div><strong>🕐 Login:</strong> ${new Date(currentUser.loginTime).toLocaleString()}</div>
                </div>
                
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                    <button style="flex: 1;" class="btn" onclick="syncWithGitHub()">🔄 Sync Now</button>
                    <button style="flex: 1;" class="btn btn-danger" onclick="logout()">🚪 Logout</button>
                </div>
                
                <div style="display: flex; gap: 0.5rem;">
                    <button style="flex: 1;" class="btn" onclick="closeUserProfile()">❌ Close</button>
                </div>
            </div>
        </div>
    `;

    // Add modal to page with ID for easy removal
    modal.id = 'user-profile-modal';
    document.body.appendChild(modal);
}

/**
 * Close user profile modal
 */
function closeUserProfile() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Logout user
 */
function logout() {
    // Clear user data
    currentUser = null;
    isLoggedIn = false;
    events = {};
    responses = {};
    
    // Clear saved user
    localStorage.removeItem('eventcall_user');
    
    // Reload page to show login
    window.location.reload();
}

/**
 * Save user to localStorage
 */
function saveUser(user) {
    try {
        localStorage.setItem('eventcall_user', JSON.stringify(user));
    } catch (error) {
        console.error('Failed to save user:', error);
    }
}

/**
 * Get saved user from localStorage
 */
function getSavedUser() {
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
 */
function isValidEmail(email) {
    return VALIDATION.email.test(email);
}

/**
 * Generate display name from email
 */
function generateDisplayName(email) {
    const username = email.split('@')[0];
    return username
        .replace(/[._]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Show login error
 */
function showLoginError(message) {
    const existingError = document.querySelector('.login-error');
    if (existingError) {
        existingError.remove();
    }

    const error = document.createElement('div');
    error.className = 'login-error';
    error.style.cssText = `
        background: var(--error-color);
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        margin-top: 1rem;
        font-weight: 600;
        text-align: center;
        font-size: 0.9rem;
    `;
    error.textContent = message;

    const form = document.getElementById('login-form');
    form.appendChild(error);

    setTimeout(() => error.remove(), 4000);
}

/**
 * Setup image upload functionality
 */
function setupImageUpload() {
    const coverUpload = document.getElementById('cover-upload');
    const coverInput = document.getElementById('cover-input');
    
    if (coverUpload && coverInput) {
        coverUpload.addEventListener('click', () => coverInput.click());
        coverUpload.addEventListener('dragover', handleDragOver);
        coverUpload.addEventListener('drop', handleDrop);
        coverInput.addEventListener('change', handleImageUpload);
    }
}

/**
 * Handle URL hash changes for routing
 */
function checkURLHash() {
    const hash = window.location.hash.substring(1);
    
    if (hash.startsWith('invite/')) {
        const eventId = hash.split('/')[1];
        const urlEvent = getEventFromURL();
        
        if (urlEvent) {
            showInvite(eventId);
        } else {
            // Try to find event in all events (for cross-user invites)
            loadEventForInvite(eventId);
        }
        
        document.querySelector('.nav').style.display = 'none';
    } else if (hash.startsWith('manage/')) {
        const eventId = hash.split('/')[1];
        showEventManagement(eventId);
        document.querySelector('.nav').style.display = 'flex';
    } else {
        document.querySelector('.nav').style.display = 'flex';
    }
}

/**
 * Load specific event for invite (cross-user access)
 */
async function loadEventForInvite(eventId) {
    try {
        // Try GitHub first if online
        if (isOnline) {
            const allEvents = await githubAPI.loadEvents();
            const event = allEvents[eventId];
            
            if (event) {
                showInvite(eventId, event);
                return;
            }
        }
        
        // Fallback to localStorage
        const allLocalEvents = JSON.parse(localStorage.getItem('eventcall_events') || '{}');
        const event = allLocalEvents[eventId];
        
        if (event) {
            showInvite(eventId, event);
        } else {
            showInviteNotFound();
        }
    } catch (error) {
        console.error('Failed to load event for invite:', error);
        showInviteNotFound();
    }
}

/**
 * Show invite not found
 */
function showInviteNotFound() {
    document.querySelector('.nav').style.display = 'none';
    document.getElementById('invite-content').innerHTML = `
        <div style="text-align: center; padding: 3rem;">
            <h2 style="color: var(--error-color); margin-bottom: 1rem;">❌ Event Not Found</h2>
            <p>This invite link may be invalid or the event may have been deleted.</p>
        </div>
    `;
    showPage('invite');
}

/**
 * Handle RSVP option clicks
 */
function handleRSVPOptionClick(e) {
    if (e.target.classList.contains('rsvp-option')) {
        document.querySelectorAll('.rsvp-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        e.target.classList.add('selected');
        const attending = e.target.textContent.includes("I'll be there");
        
        const attendingInput = document.getElementById('attending');
        if (attendingInput) {
            attendingInput.value = attending;
        }
    }
}

/**
 * Page navigation
 */
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    document.querySelectorAll('.nav button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    const navButton = document.getElementById(`nav-${pageId}`);
    if (navButton) {
        navButton.classList.add('active');
    }
    
    currentPage = pageId;
    
    if (pageId === 'invite') {
        document.querySelector('.nav').style.display = 'none';
    } else {
        document.querySelector('.nav').style.display = 'flex';
    }
    
    if (!window.location.hash.includes('invite/')) {
        window.location.hash = pageId;
    }
}

/**
 * Edit an existing event
 */
function editEvent(eventId) {
    const event = events[eventId];
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }
    
    // Check ownership
    if (event.createdBy !== currentUser.email) {
        showToast('You can only edit events you created', 'error');
        return;
    }

    // Set edit mode
    isEditMode = true;
    editingEventId = eventId;

    // Populate the form with event data
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-date').value = event.date;
    document.getElementById('event-time').value = event.time;
    document.getElementById('event-location').value = event.location || '';
    document.getElementById('event-description').value = event.description || '';
    document.getElementById('ask-reason').checked = event.askReason || false;
    document.getElementById('allow-guests').checked = event.allowGuests || false;

    // Handle cover image
    const coverPreview = document.getElementById('cover-preview');
    if (event.coverImage) {
        coverPreview.src = event.coverImage;
        coverPreview.classList.remove('hidden');
    } else {
        coverPreview.classList.add('hidden');
    }

    // Populate custom questions
    populateCustomQuestions(event.customQuestions || []);

    // Update form UI for editing
    updateFormForEditing();

    // Navigate to create page
    showPage('create');
}

/**
 * Populate custom questions in edit mode
 */
function populateCustomQuestions(questions) {
    const container = document.getElementById('custom-questions-container');
    container.innerHTML = '';

    if (questions.length === 0) {
        questions = [{ question: '' }];
    }

    questions.forEach(q => {
        const questionItem = document.createElement('div');
        questionItem.className = 'custom-question-item';
        questionItem.innerHTML = `
            <input type="text" placeholder="Enter your question..." class="custom-question-input" value="${q.question || ''}">
            <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">🗑️</button>
        `;
        container.appendChild(questionItem);
    });
}

/**
 * Update form UI for editing
 */
function updateFormForEditing() {
    // Update page title
    const createTitle = document.querySelector('#create h2');
    if (createTitle) {
        createTitle.textContent = 'Edit Event';
    }

    // Update submit button
    const submitBtn = document.querySelector('#event-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = '💾 Update Event';
        submitBtn.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #059669 100%)';
    }

    // Add cancel button if it doesn't exist
    if (!document.getElementById('cancel-edit-btn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'cancel-edit-btn';
        cancelBtn.className = 'btn';
        cancelBtn.style.cssText = 'margin-left: 0.5rem; background: var(--gray-200); color: var(--text-color);';
        cancelBtn.textContent = '❌ Cancel';
        cancelBtn.onclick = cancelEdit;
        submitBtn.parentNode.appendChild(cancelBtn);
    }
}

/**
 * Cancel edit mode
 */
function cancelEdit() {
    resetEventForm();
    showPage('dashboard');
}

/**
 * Reset event form to create mode
 */
function resetEventForm() {
    // Reset edit mode
    isEditMode = false;
    editingEventId = null;

    // Reset form
    const form = document.getElementById('event-form');
    if (form) {
        form.reset();
    }

    // Reset cover preview
    const coverPreview = document.getElementById('cover-preview');
    if (coverPreview) {
        coverPreview.classList.add('hidden');
        coverPreview.src = '';
    }

    // Reset custom questions
    clearCustomQuestions();

    // Reset form UI
    const createTitle = document.querySelector('#create h2');
    if (createTitle) {
        createTitle.textContent = 'Create New Event';
    }

    const submitBtn = document.querySelector('#event-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = '🚀 Deploy Event';
        submitBtn.style.background = '';
    }

    // Remove cancel button
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) {
        cancelBtn.remove();
    }
}

/**
 * Get custom questions from form
 */
function getCustomQuestions() {
    const inputs = document.querySelectorAll('.custom-question-input');
    const questions = [];
    
    inputs.forEach((input, index) => {
        const text = sanitizeText(input.value);
        if (text && text.length >= 3) {
            questions.push({
                id: `custom_${index}`,
                question: text
            });
        }
    });
    
    return questions;
}

/**
 * Clear custom questions form
 */
function clearCustomQuestions() {
    const container = document.getElementById('custom-questions-container');
    if (container) {
        container.innerHTML = `
            <div class="custom-question-item">
                <input type="text" placeholder="Enter your question..." class="custom-question-input">
                <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">🗑️</button>
            </div>
        `;
    }
}

/**
 * Add custom question input
 */
function addCustomQuestion() {
    const container = document.getElementById('custom-questions-container');
    const currentQuestions = container.querySelectorAll('.custom-question-item').length;
    
    if (currentQuestions >= APP_CONFIG.maxCustomQuestions) {
        showToast(`Maximum ${APP_CONFIG.maxCustomQuestions} custom questions allowed`, 'error');
        return;
    }
    
    const questionItem = document.createElement('div');
    questionItem.className = 'custom-question-item';
    questionItem.innerHTML = `
        <input type="text" placeholder="Enter your question..." class="custom-question-input">
        <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">🗑️</button>
    `;
    container.appendChild(questionItem);
}

/**
 * Remove custom question input
 */
function removeCustomQuestion(button) {
    const container = document.getElementById('custom-questions-container');
    const items = container.querySelectorAll('.custom-question-item');
    
    if (items.length > 1) {
        button.parentElement.remove();
    } else {
        const input = button.parentElement.querySelector('.custom-question-input');
        input.value = '';
    }
}

/**
 * Handle image drag over
 */
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

/**
 * Handle image drop
 */
function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processImageFile(files[0]);
    }
}

/**
 * Handle image upload input change
 */
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        processImageFile(file);
    }
}

/**
 * Process uploaded image file
 */
function processImageFile(file) {
    const validation = validateImageFile(file);
    
    if (!validation.valid) {
        validation.errors.forEach(error => {
            showToast(error, 'error');
        });
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('cover-preview');
        if (preview) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
}

/**
 * Copy invite link to clipboard
 */
async function copyInviteLink(eventId) {
    const event = events[eventId];
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }
    
    try {
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
 * Export event data as CSV
 */
function exportEventData(eventId) {
    const event = events[eventId];
    const eventResponses = responses[eventId] || [];
    
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }
    
    try {
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
 * Show event management
 */
function showEventManagement(eventId) {
    const event = events[eventId];
    
    if (!event) {
        showToast('Event not found', 'error');
        console.error('Event not found:', eventId, 'Available events:', Object.keys(events));
        return;
    }
    
    // Check if user owns this event
    if (event.createdBy !== currentUser.email) {
        showToast('You can only manage events you created', 'error');
        showPage('dashboard');
        return;
    }
    
    showSimpleEventManagement(event, eventId);
}

/**
 * Show simple event management interface
 */
function showSimpleEventManagement(event, eventId) {
    const eventResponses = responses[eventId] || [];
    const stats = calculateEventStats(eventResponses);
    const inviteURL = generateInviteURL(event);
    const timeUntil = getTimeUntilEvent(event.date, event.time);
    const isPast = isEventInPast(event.date, event.time);

    let responseTableHTML = '';
    if (eventResponses.length > 0) {
        responseTableHTML = `
            <div class="response-stats" style="margin-bottom: 2rem;">
                <div class="stat">
                    <div class="stat-number" style="color: var(--semper-navy); font-size: 2rem; font-weight: 900;">${stats.totalHeadcount}</div>
                    <div class="stat-label">🎖️ TOTAL HEADCOUNT</div>
                </div>
                <div class="stat">
                    <div class="stat-number" style="color: var(--success-color);">${stats.attending}</div>
                    <div class="stat-label">✅ Attending</div>
                </div>
                <div class="stat">
                    <div class="stat-number" style="color: var(--error-color);">${stats.notAttending}</div>
                    <div class="stat-label">❌ Not Attending</div>
                </div>
                <div class="stat">
                    <div class="stat-number" style="color: var(--semper-navy);">${stats.total}</div>
                    <div class="stat-label">📊 Total RSVPs</div>
                </div>
            </div>
            
            <div style="overflow-x: auto;">
                <table class="response-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Attending</th>
                            ${event.askReason ? '<th>Reason</th>' : ''}
                            ${event.allowGuests ? '<th>Guests</th>' : ''}
                            <th>Submitted</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        eventResponses.forEach(response => {
            const displayName = response.name || 'Unknown';
            const email = response.email || 'N/A';
            const phone = response.phone || 'N/A';

            responseTableHTML += `
                <tr>
                    <td><strong>${displayName}</strong></td>
                    <td><a href="mailto:${email}" style="color: var(--semper-red); text-decoration: none;">${email}</a></td>
                    <td>${phone !== 'N/A' ? `<a href="tel:${phone}" style="color: var(--semper-red); text-decoration: none;">${phone}</a>` : phone}</td>
                    <td class="${response.attending ? 'attending-yes' : 'attending-no'}">
                        ${response.attending ? '✅ Yes' : '❌ No'}
                    </td>
                    ${event.askReason ? `<td style="max-width: 200px; word-wrap: break-word;">${response.reason || '-'}</td>` : ''}
                    ${event.allowGuests ? `<td><strong>${response.guestCount || 0}</strong> ${(response.guestCount || 0) === 1 ? 'guest' : 'guests'}</td>` : ''}
                    <td style="font-size: 0.875rem;">${new Date(response.timestamp).toLocaleString()}</td>
                </tr>
            `;
        });
        
        responseTableHTML += '</tbody></table></div>';
    } else {
        responseTableHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-color);">
                <h3 style="color: var(--semper-navy);">📭 No RSVPs Yet</h3>
                <p>Share your invite link to start collecting responses!</p>
            </div>
        `;
    }

    document.getElementById('event-details').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h2 style="color: var(--semper-navy); font-size: 2rem; margin-bottom: 0.5rem;">${event.title}</h2>
                <div class="event-meta" style="margin-bottom: 1rem;">
                    📅 ${formatDate(event.date)} at ${formatTime(event.time)}<br>
                    📍 ${event.location || 'No location specified'}<br>
                    📝 ${event.description || 'No description provided'}<br>
                    👤 Created by ${event.createdByName || event.createdBy}<br>
                    🕐 Created ${formatRelativeTime(event.created)}<br>
                    ${isPast ? '⏰ <span style="color: var(--error-color);">Event has passed</span>' : `⏳ ${timeUntil}`}
                </div>
            </div>
            ${event.coverImage ? `
                <div style="max-width: 200px;">
                    <img src="${event.coverImage}" alt="Event cover" style="width: 100%; border-radius: 0.5rem; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                </div>
            ` : ''}
        </div>
        
        <div style="margin: 1rem 0; padding: 1rem; background: var(--gray-50); border-radius: 0.5rem; border-left: 4px solid var(--semper-gold);">
            <strong style="color: var(--semper-navy);">🔗 Invite Link:</strong><br>
            <input type="text" value="${inviteURL}" 
                   style="width: 100%; margin-top: 0.5rem; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.375rem;" 
                   readonly onclick="this.select()" id="invite-link-input">
            <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">
                Click the link above to select and copy, or use the Copy Link button below.
            </div>
        </div>
        
        <div style="margin: 2rem 0; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn" onclick="copyInviteLink('${eventId}')">🔗 Copy Invite Link</button>
            <button class="btn" onclick="editEvent('${eventId}')">✏️ Edit Event</button>
            <button class="btn" onclick="exportEventData('${eventId}')">📥 Export Data</button>
            <button class="btn" onclick="syncWithGitHub()">🔄 Sync Data</button>
            <button class="btn" onclick="showPage('dashboard')">🏠 Back to Dashboard</button>
            <button class="btn btn-danger" onclick="deleteEvent('${eventId}')">🗑️ Delete</button>
        </div>
        
        <h3 style="color: var(--semper-navy); margin-bottom: 1rem;">📊 RSVP Responses (${eventResponses.length})</h3>
        ${responseTableHTML}
    `;
    
    showPage('manage');
    window.location.hash = `manage/${eventId}`;
}

/**
 * Show invite
 */
function showInvite(eventId, eventData = null) {
    let event = eventData || getEventFromURL() || events[eventId];
    
    if (event && window.uiComponents) {
        uiComponents.showInvite(eventId);
    } else if (event) {
        // Simple invite display if uiComponents not available
        document.querySelector('.nav').style.display = 'none';
        document.getElementById('invite-content').innerHTML = `
            <div style="max-width: 600px; margin: 2rem auto; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h1 style="text-align: center; color: var(--semper-navy); margin-bottom: 2rem;">${event.title}</h1>
                <div style="margin-bottom: 2rem;">
                    <p><strong>📅 Date:</strong> ${formatDate(event.date)}</p>
                    <p><strong>🕐 Time:</strong> ${formatTime(event.time)}</p>
                    ${event.location ? `<p><strong>📍 Location:</strong> ${event.location}</p>` : ''}
                    ${event.description ? `<p><strong>📝 Description:</strong> ${event.description}</p>` : ''}
                </div>
                <div style="text-align: center;">
                    <p style="margin-bottom: 1rem;">To RSVP for this event, please contact the organizer.</p>
                    <button class="btn" onclick="window.location.href = window.location.origin + window.location.pathname">
                        🏠 Go to EventCall
                    </button>
                </div>
            </div>
        `;
        showPage('invite');
    } else {
        showInviteNotFound();
    }
}

/**
 * Render dashboard with enhanced status
 */
function renderDashboard() {
    const eventsList = document.getElementById('events-list');
    const eventIds = Object.keys(events);

    if (eventIds.length === 0) {
        eventsList.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">🎯</div>
                <h3 style="color: var(--semper-navy); margin-bottom: 1rem;">Welcome, ${currentUser.name}!</h3>
                <p style="margin-bottom: 2rem; color: #6b7280; max-width: 400px; margin-left: auto; margin-right: auto;">
                    Ready to create your first event? EventCall makes military event management simple and professional.
                </p>
                <button class="btn" onclick="showPage('create')">🚀 Create Your First Event</button>
                
                <div style="margin-top: 2rem; padding: 1rem; background: var(--gray-50); border-radius: 0.5rem; font-size: 0.875rem; color: #6b7280;">
                    <strong>${isOnline ? '☁️ Cloud Connected' : '💾 Offline Mode'}:</strong> 
                    ${isOnline ? 'Your events will sync automatically with GitHub.' : 'Events saved locally. Will sync when connection is restored.'}
                </div>
            </div>
        `;
        return;
    }

    // Sort events by creation date (newest first)
    const sortedEvents = eventIds
        .map(id => events[id])
        .sort((a, b) => b.created - a.created);

    const connectionStatus = isOnline ? '☁️ Cloud Connected' : '💾 Offline Mode';
    const lastSyncStatus = lastSyncTime ? `Last sync: ${formatRelativeTime(lastSyncTime)}` : 'Never synced';

    let html = `
        <div style="background: linear-gradient(135deg, ${isOnline ? '#d1fae5' : '#fef3c7'} 0%, ${isOnline ? '#ecfdf5' : '#fef7df'} 100%); 
                    padding: 1rem; border-radius: 0.5rem; margin-bottom: 2rem; text-align: center; font-weight: 600;">
            ${connectionStatus} • ${eventIds.length} Events • User: ${currentUser.email}<br>
            <small style="font-weight: normal; opacity: 0.8;">${lastSyncStatus}</small>
        </div>
    `;
    
    sortedEvents.forEach(event => {
        const eventResponses = responses[event.id] || [];
        const stats = calculateEventStats(eventResponses);
        const timeUntil = getTimeUntilEvent(event.date, event.time);
        const isPast = isEventInPast(event.date, event.time);

        html += `
            <div class="event-card ${isPast ? 'event-past' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <h3 style="color: var(--semper-navy); font-size: 1.5rem; margin-bottom: 0.5rem;">
                            ${event.title}
                            ${isPast ? '<span style="color: var(--error-color); font-size: 0.875rem; font-weight: normal;">(Past Event)</span>' : ''}
                        </h3>
                        <div class="event-meta">
                            📅 ${formatDate(event.date)} at ${formatTime(event.time)}<br>
                            📍 ${event.location || 'No location specified'}<br>
                            🕐 Created ${formatRelativeTime(event.created)}<br>
                            ${isPast ? '⏰ <span style="color: var(--error-color);">Event has passed</span>' : `⏳ ${timeUntil}`}
                        </div>
                    </div>
                    ${event.coverImage ? `
                        <div style="margin-left: 1rem;">
                            <img src="${event.coverImage}" alt="Event cover" 
                                 style="width: 80px; height: 60px; object-fit: cover; border-radius: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        </div>
                    ` : ''}
                </div>
                
                <div class="response-stats">
                    <div class="stat">
                        <div class="stat-number" style="color: var(--semper-navy); font-size: 2rem; font-weight: 900;">${stats.totalHeadcount}</div>
                        <div class="stat-label">🎖️ TOTAL HEADCOUNT</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color: var(--success-color);">${stats.attending}</div>
                        <div class="stat-label">✅ Attending</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color: var(--error-color);">${stats.notAttending}</div>
                        <div class="stat-label">❌ Not Attending</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color: var(--semper-navy);">${stats.total}</div>
                        <div class="stat-label">📊 Total RSVPs</div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
                    <button class="btn" onclick="showEventManagement('${event.id}')">📊 Manage</button>
                    <button class="btn" onclick="copyInviteLink('${event.id}')">🔗 Copy Link</button>
                    <button class="btn btn-success" onclick="exportEventData('${event.id}')">📥 Export</button>
                    ${!isPast ? `<button class="btn" onclick="duplicateEvent('${event.id}')">📋 Duplicate</button>` : ''}
                    <button class="btn btn-danger" onclick="deleteEvent('${event.id}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    });

    eventsList.innerHTML = html;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, APP_CONFIG.toastDuration);
}

/**
 * Duplicate an existing event
 */
function duplicateEvent(eventId) {
    const event = events[eventId];
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }
    
    // Check ownership
    if (event.createdBy !== currentUser.email) {
        showToast('You can only duplicate events you created', 'error');
        return;
    }

    // Reset edit mode (we're creating new, not editing)
    isEditMode = false;
    editingEventId = null;

    // Populate the form with duplicated data
    document.getElementById('event-title').value = event.title + ' (Copy)';
    document.getElementById('event-date').value = event.date;
    document.getElementById('event-time').value = event.time;
    document.getElementById('event-location').value = event.location || '';
    document.getElementById('event-description').value = event.description || '';
    document.getElementById('ask-reason').checked = event.askReason || false;
    document.getElementById('allow-guests').checked = event.allowGuests || false;

    // Handle cover image
    const coverPreview = document.getElementById('cover-preview');
    if (event.coverImage) {
        coverPreview.src = event.coverImage;
        coverPreview.classList.remove('hidden');
    } else {
        coverPreview.classList.add('hidden');
    }

    // Populate custom questions
    populateCustomQuestions(event.customQuestions || []);

    // Ensure form is in create mode
    const createTitle = document.querySelector('#create h2');
    if (createTitle) {
        createTitle.textContent = 'Create New Event';
    }

    const submitBtn = document.querySelector('#event-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = '🚀 Deploy Event';
        submitBtn.style.background = '';
    }

    // Remove any cancel button
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) {
        cancelBtn.remove();
    }

    // Navigate to create page
    showPage('create');
    showToast('📋 Event duplicated - modify and deploy', 'success');
}

// Make functions available globally for HTML onclick handlers
window.showPage = showPage;
window.copyInviteLink = copyInviteLink;
window.exportEventData = exportEventData;
window.deleteEvent = deleteEvent;
window.editEvent = editEvent;
window.duplicateEvent = duplicateEvent;
window.cancelEdit = cancelEdit;
window.addCustomQuestion = addCustomQuestion;
window.removeCustomQuestion = removeCustomQuestion;
window.showEventManagement = showEventManagement;
window.showInvite = showInvite;
window.renderDashboard = renderDashboard;
window.logout = logout;
window.syncWithGitHub = syncWithGitHub;
window.closeUserProfile = closeUserProfile;
window.saveEventWithFallback = saveEventWithFallback;
window.saveRSVPWithFallback = saveRSVPWithFallback;

// Make global variables available
window.events = events;
window.responses = responses;
window.currentUser = currentUser;
window.isOnline = isOnline;
        