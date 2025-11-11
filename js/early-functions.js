/**
 * EventCall Early Functions - Updated with Email-Only Authentication
 * These functions need to be available immediately when HTML loads
 * Load this file BEFORE all other scripts
 */

// Initialize global state
window.events = {};
window.responses = {};

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Skip auth check for invite pages (guests don't need login)
    const isInvitePage = window.location.hash.includes('invite/') || window.location.search.includes('data=');

    if (isInvitePage) {
        return;
    }

    // Prefer the new username/password auth flow
    if (window.userAuth && typeof window.userAuth.init === 'function') {
        try {
            await window.userAuth.init();
        } catch (err) {
            console.error('Failed to initialize userAuth:', err);
        }

        if (!window.userAuth.isAuthenticated()) {
            console.log('🔒 Not authenticated - showing new login screen');
            // userAuth.showLoginScreen() is called inside init when needed, but call again for safety
            if (typeof window.userAuth.showLoginScreen === 'function') {
                window.userAuth.showLoginScreen();
            }
            return;
        }

        console.log('✅ Authenticated - showing app');

        // Load events on initial page load if on dashboard
        const hash = window.location.hash.substring(1);
        const isDefaultDashboard = !hash || hash === 'dashboard';

        if (isDefaultDashboard) {
            console.log('📊 Initial load: Loading dashboard data...');
            // Wait for loadManagerData to be available
            const waitForLoad = setInterval(() => {
                if (typeof window.loadManagerData === 'function') {
                    clearInterval(waitForLoad);
                    window.loadManagerData();
                }
            }, 100); // Check every 100ms

            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(waitForLoad);
                if (typeof window.loadManagerData !== 'function') {
                    console.error('❌ loadManagerData function not available after timeout');
                }
            }, 5000);
        }
        return;
    }

    // Fallback: if new auth is unavailable, show the generic login page UI
    console.warn('⚠️ userAuth not available; showing built-in login page UI');
    showLoginPage();
});

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
    
    return true;
}

/**
 * Show page navigation - Updated to enforce login state
 */
function showPage(pageId) {
    console.log(`🧭 Attempting to navigate to: ${pageId}`);
    
    // Allow access to invite page without login (for guests)
    if (pageId === 'invite') {
        console.log('🎟️ Guest invite access - no login required');
        showPageContent(pageId);
        return;
    }
    
    // Check if this is an invite URL (guest access)
    if (window.location.hash.includes('invite/') || window.location.search.includes('data=')) {
        console.log('🎟️ Guest invite URL detected - bypassing login');
        showPageContent('invite');
        return;
    }
    
    // Check if user is logged in for all other pages
    const isAuthenticated = window.userAuth?.isAuthenticated() || window.managerAuth?.isAuthenticated();
    
    if (!isAuthenticated) {
        console.log('🔒 Access denied - user not logged in');
        enforceLogin();
        return;
    }
    
    // User is logged in, proceed to requested page
    const user = window.userAuth?.getCurrentUser() || window.managerAuth?.getCurrentManager();
    console.log(`✅ Access granted to ${pageId} for user: ${user?.email}`);
    showPageContent(pageId);
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
 */
function showPageContent(pageId) {
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
        window.AppRouter.updateURLForPage(pageId);
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
    } else if (pageId === 'dashboard') {
        // Load dashboard data
        if (typeof window.loadManagerData === 'function') {
            window.loadManagerData();
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
            displayName.textContent = user.name || user.username || 'User';
        }
        
        if (avatar) {
            avatar.textContent = window.userAuth.getInitials();
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

    if (!modal) {
        console.error('User profile modal not found');
        return;
    }

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
    if (user.branch) {
        updateProfileRanksForBranch();
    }

    if (rankEl) rankEl.value = user.rank || '';

    // Show modal
    modal.style.display = 'flex';
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
                        // Fetch fresh user data from EventCall-Data after successful backend sync
                        const freshUserData = await window.userAuth.fetchUserData(response.username);
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
                    // Fetch fresh user data from EventCall-Data after successful backend sync
                    const freshUserData = await window.userAuth.fetchUserData(response.username);
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
        modal.style.display = 'none';
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

// Make functions globally available
window.showUserMenu = showUserMenu;
window.updateProfileRanksForBranch = updateProfileRanksForBranch;
window.saveUserProfile = saveUserProfile;
window.closeUserProfile = closeUserProfile;
window.logoutFromProfile = logoutFromProfile;

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

        // Delete from GitHub if available
        if (window.githubAPI && window.githubAPI.deleteEvent) {
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
            showPage('dashboard');
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
 */
function goToDashboard() {
    if (window.AppRouter && typeof window.AppRouter.navigateToPage === 'function') {
        window.AppRouter.navigateToPage('dashboard');
    } else {
        showPage('dashboard');
    }
}

/**
 * Initialize hash change listener
 */
function initializeHashListener() {
    // Use History API popstate for navigation
    window.addEventListener('popstate', handleURLPath);
    // Check initial path
    setTimeout(handleURLPath, 100);
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
 * Show the app loading screen (called on successful login)
 */
function showAppLoader() {
    const timestamp = new Date().toISOString();
    console.log(`🔵 [${timestamp}] showAppLoader() CALLED`);
    console.log('🔍 Searching for #app-loader element...');

    const loader = document.getElementById('app-loader');
    console.log('📍 Element found:', loader ? 'YES' : 'NO');

    if (loader) {
        console.log('📊 Current loader state BEFORE changes:');
        console.log('  - display:', window.getComputedStyle(loader).display);
        console.log('  - opacity:', window.getComputedStyle(loader).opacity);
        console.log('  - visibility:', window.getComputedStyle(loader).visibility);
        console.log('  - classList:', loader.classList.toString());
        console.log('  - z-index:', window.getComputedStyle(loader).zIndex);

        console.log('🔧 Removing "hidden" class...');
        loader.classList.remove('hidden');

        // Force style recalculation
        void loader.offsetHeight;

        console.log('✅ "hidden" class removed');
        console.log('📊 Current loader state AFTER changes:');
        console.log('  - display:', window.getComputedStyle(loader).display);
        console.log('  - opacity:', window.getComputedStyle(loader).opacity);
        console.log('  - visibility:', window.getComputedStyle(loader).visibility);
        console.log('  - classList:', loader.classList.toString());
        console.log('  - z-index:', window.getComputedStyle(loader).zIndex);

        console.log('✅ LOADER SHOULD NOW BE VISIBLE');
    } else {
        console.error('❌ LOADER ELEMENT NOT FOUND - #app-loader does not exist in DOM');
    }
}
window.showAppLoader = showAppLoader;

/**
 * Hide the app loading screen
 */
function hideAppLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) {
        // Add hidden class to trigger fade out
        loader.classList.add('hidden');
        // Remove from DOM after transition completes
        loader.addEventListener('transitionend', () => {
            if (loader.parentNode) {
                loader.remove();
            }
        }, { once: true });
    }
}
window.hideAppLoader = hideAppLoader;

// Initialize hash listener when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeHashListener();
    // Note: loader is NOT auto-hidden here - only shows/hides on login
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
