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
    
    if (!isInvitePage) {
        // Check if user is authenticated (supports both old and new auth)
        const isAuthenticated = window.userAuth?.isAuthenticated() || window.managerAuth?.isAuthenticated();
        
        if (!isAuthenticated) {
            console.log('ðŸ"' Not authenticated - showing login page');
            window.loginUI.showLoginPage();
        } else {
            console.log('âœ… Authenticated - showing app');

            // Load events on initial page load if on dashboard
            const hash = window.location.hash.substring(1);
            const isDefaultDashboard = !hash || hash === 'dashboard';

            if (isDefaultDashboard) {
                console.log('ðŸ"Š Initial load: Loading dashboard data...');
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
                        console.error('âŒ loadManagerData function not available after timeout');
                    }
                }, 5000);
            console.log('🔒 Not authenticated - showing login page');
            enforceLogin();
        } else {
            console.log('✅ Authenticated - showing app');
            
            // Update user display in header
            if (window.updateUserDisplay) {
                window.updateUserDisplay();
            }
            
            // Load manager data if available
            if (window.loadManagerData) {
                window.loadManagerData();
            }
        }
    }
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
        if (appContent) appContent.style.display = 'none';
        
        return false;
    }
    
    console.log('✅ User authenticated:', window.userAuth.getCurrentUser().email);
    
    const loginPage = document.getElementById('login-page');
    const appContent = document.querySelector('.app-content');
    
    if (loginPage) loginPage.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
    
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
    
    // Show/hide nav based on page
    if (nav) {
        nav.style.display = pageId === 'invite' ? 'none' : 'flex';
    }
    
    // Update URL hash (but don't override invite URLs)
    if (!window.location.hash.includes('invite/')) {
        window.location.hash = pageId;
    }
    
    // Initialize template selector on create page
    if (pageId === 'create' && window.eventTemplates) {
        const container = document.getElementById('template-selector-container');
        if (container && !container.hasChildNodes()) {
            container.innerHTML = window.eventTemplates.generateTemplateSelectorHTML();
        }
    }
    
    console.log(`📄 Page changed to: ${pageId}`);
    
    // Load data when switching to dashboard
    if (pageId === 'dashboard' && typeof window.loadManagerData === 'function') {
        window.loadManagerData();
    }
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
            displayName.textContent = user.name || user.email.split('@')[0];
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
 * Generate invite URL - Utility function
 */
function generateInviteURL(event) {
    const baseURL = window.location.origin + window.location.pathname;
    const encodedData = btoa(JSON.stringify({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        description: event.description,
        coverImage: event.coverImage,
        askReason: event.askReason,
        allowGuests: event.allowGuests,
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
function createCSVContent(event, responses) {
    let csvContent = "Name,Email,Phone,Attending,";
    
    if (event.askReason) csvContent += "Reason,";
    if (event.allowGuests) csvContent += "Guest Count,";
    
    if (event.customQuestions && event.customQuestions.length > 0) {
        event.customQuestions.forEach(q => {
            csvContent += `"${q.question}",`;
        });
    }
    
    csvContent += "Timestamp\n";

    responses.forEach(response => {
        csvContent += `"${response.name}","${response.email}","${response.phone || ''}","${response.attending ? 'Yes' : 'No'}",`;
        
        if (event.askReason) csvContent += `"${response.reason || ''}",`;
        if (event.allowGuests) csvContent += `"${response.guestCount || 0}",`;
        
        if (event.customQuestions && event.customQuestions.length > 0) {
            event.customQuestions.forEach(q => {
                const answer = response.customAnswers && response.customAnswers[q.id] ? response.customAnswers[q.id] : '';
                csvContent += `"${answer}",`;
            });
        }
        
        csvContent += `"${new Date(response.timestamp).toLocaleString()}"\n`;
    });

    return csvContent;
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
            await window.githubAPI.deleteEvent(eventId, event.title);
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
        const eventId = hash.split('/')[1];
        console.log('🔗 Direct invite link accessed:', eventId);
        
        // Force show invite page without login requirement
        showPageContent('invite');
        
        if (window.uiComponents && window.uiComponents.showInvite) {
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
    showPage('dashboard');
}

/**
 * Initialize hash change listener
 */
function initializeHashListener() {
    window.addEventListener('hashchange', checkURLHash);
    
    // Check initial hash
    setTimeout(checkURLHash, 100);
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
window.initializeHashListener = initializeHashListener;
window.goToDashboard = goToDashboard;
window.enforceLogin = enforceLogin;
window.updateUserDisplay = updateUserDisplay;
window.showUserMenu = showUserMenu;

// Initialize hash listener when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeHashListener();
});

console.log('✅ Early functions loaded with email-only authentication support');
