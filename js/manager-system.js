/**
 * Manager System - Enhanced with RSVP Sync Functionality
 * Added GitHub Issues processing and real-time sync capabilities
 */

// Global sync state
let syncInProgress = false;
let pendingRSVPCount = 0;

// Add custom question function
function addCustomQuestion(questionText = '') {
    const container = document.getElementById('custom-questions-container');
    if (!container) return;

    const questionItem = document.createElement('div');
    questionItem.className = 'custom-question-item';
    questionItem.innerHTML = `
        <input type="text" placeholder="Enter your question..." class="custom-question-input" value="${questionText}">
        <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">ðŸ—‘ï¸</button>
    `;
    container.appendChild(questionItem);
}

function removeCustomQuestion(button) {
    const questionItem = button.closest('.custom-question-item');
    if (questionItem) {
        questionItem.remove();
    }
}

function calculateEventStats(responses) {
    const stats = {
        total: responses.length,
        attending: 0,
        notAttending: 0,
        totalGuests: 0,
        attendingWithGuests: 0,
        totalHeadcount: 0,
        responseRate: 0
    };

    responses.forEach(response => {
        if (response.attending === true) {
            stats.attending++;
            stats.attendingWithGuests += parseInt(response.guestCount) || 0;
        } else if (response.attending === false) {
            stats.notAttending++;
        }
        
        stats.totalGuests += parseInt(response.guestCount) || 0;
    });

    stats.totalHeadcount = stats.attending + stats.attendingWithGuests;
    stats.responseRate = stats.total > 0 ? ((stats.attending + stats.notAttending) / stats.total * 100).toFixed(1) : 0;

    return stats;
}

/**
 * Sync RSVPs from GitHub Issues
 */
async function syncWithGitHub() {
    if (syncInProgress) {
        showToast('â³ Sync already in progress...', 'error');
        return;
    }

    if (!managerAuth.isAuthenticated()) {
        showToast('ðŸ” Please login with GitHub token to sync RSVPs', 'error');
        return;
    }

    syncInProgress = true;
    
    try {
        // Update button state
        const syncButtons = document.querySelectorAll('[onclick*="syncWithGitHub"]');
        syncButtons.forEach(btn => {
            btn.innerHTML = '<div class="spinner"></div> Syncing...';
            btn.disabled = true;
        });

        showToast('ðŸ”„ Syncing RSVPs from GitHub Issues...', 'success');

        // Process RSVP issues
        const result = await window.githubAPI.processRSVPIssues();
        
        if (result.processed > 0) {
            // Reload data after processing
            await loadManagerData();
            
            // Show success message
            showToast(`âœ… Synced ${result.processed} new RSVPs successfully!`, 'success');
            
            // Update pending count
            await updatePendingRSVPCount();
        } else {
            showToast('â„¹ï¸ No new RSVPs to sync', 'success');
        }

    } catch (error) {
        console.error('Sync failed:', error);
        showToast('âŒ Sync failed: ' + error.message, 'error');
    } finally {
        syncInProgress = false;
        
        // Reset button state
        const syncButtons = document.querySelectorAll('[onclick*="syncWithGitHub"]');
        syncButtons.forEach(btn => {
            btn.innerHTML = 'ðŸ”„ Sync RSVPs';
            btn.disabled = false;
        });
    }
}

/**
 * Update pending RSVP count in UI
 */
async function updatePendingRSVPCount() {
    if (!managerAuth.isAuthenticated()) {
        return;
    }

    try {
        const count = await window.githubAPI.getPendingRSVPCount();
        pendingRSVPCount = count;
        
        // Update sync button text if pending RSVPs exist
        const syncButtons = document.querySelectorAll('[onclick*="syncWithGitHub"]');
        syncButtons.forEach(btn => {
            if (count > 0) {
                btn.innerHTML = `ðŸ”„ Sync RSVPs (${count} pending)`;
                btn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                btn.style.animation = 'pulse 2s infinite';
            } else {
                btn.innerHTML = 'ðŸ”„ Sync RSVPs';
                btn.style.background = '';
                btn.style.animation = '';
            }
        });

        // Add pending indicator to dashboard
        updateDashboardSyncStatus(count);

    } catch (error) {
        console.error('Failed to update pending RSVP count:', error);
    }
}

/**
 * Update dashboard sync status
 */
function updateDashboardSyncStatus(pendingCount) {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;

    // Remove existing sync status
    const existingStatus = document.getElementById('sync-status-banner');
    if (existingStatus) {
        existingStatus.remove();
    }

    if (pendingCount > 0) {
        const syncBanner = document.createElement('div');
        syncBanner.id = 'sync-status-banner';
        syncBanner.style.cssText = `
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 2px solid #f59e0b;
            border-radius: 0.75rem;
            padding: 1rem;
            margin-bottom: 1.5rem;
            text-center: center;
            font-weight: 600;
            color: #92400e;
        `;
        syncBanner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                <span style="font-size: 1.2rem;">ðŸ“¬</span>
                <span>${pendingCount} new RSVP${pendingCount > 1 ? 's' : ''} ready to sync!</span>
                <button class="btn" onclick="syncWithGitHub()" style="margin-left: 1rem; padding: 0.5rem 1rem; font-size: 0.875rem;">
                    ðŸ”„ Sync Now
                </button>
            </div>
        `;
        
        // Insert at the top of events list
        eventsList.insertBefore(syncBanner, eventsList.firstChild);
    }
}

/**
 * Enhanced load manager data with sync status
 */
async function loadManagerData() {
    console.log('ðŸ“Š Loading manager data...');
    
    if (!window.events) window.events = {};
    if (!window.responses) window.responses = {};
    
    if (!managerAuth.isAuthenticated()) {
        console.log('âš ï¸ No GitHub token available - using local events only');
        renderDashboard();
        return;
    }
    
    if (window.githubAPI) {
        try {
            // Load events
            const events = await window.githubAPI.loadEvents();
            window.events = events || {};
            console.log(`âœ… Loaded ${Object.keys(window.events).length} events from GitHub`);
            
            // Load responses
            const responses = await window.githubAPI.loadResponses();
            window.responses = responses || {};
            console.log(`âœ… Loaded responses for ${Object.keys(window.responses).length} events from GitHub`);
            
            // Update pending RSVP count
            await updatePendingRSVPCount();
            
        } catch (error) {
            console.error('âŒ Failed to load from GitHub:', error);
        }
    }
    
    renderDashboard();
}

async function deleteEvent(eventId) {
    try {
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            const showToast = window.showToast || function(msg, type) { console.log(msg); };
            showToast('Event not found', 'error');
            return;
        }
        
        if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) {
            return;
        }

        const showToast = window.showToast || function(msg, type) { console.log(msg); };
        showToast('ðŸ—‘ï¸ Deleting event...', 'success');

        if (window.githubAPI && window.githubAPI.deleteEvent) {
            try {
                await window.githubAPI.deleteEvent(eventId, event.title);
            } catch (error) {
                console.error('GitHub deletion failed:', error);
            }
        }
        
        if (window.events) delete window.events[eventId];
        if (window.responses) delete window.responses[eventId];
        
        showToast('ðŸ—‘ï¸ Event deleted successfully', 'success');
        
        await loadManagerData(); // Reload everything from GitHub
        
        if (window.location.hash.includes('manage/')) {
            if (window.showPage) {
                window.showPage('dashboard');
            }
        }
        
    } catch (error) {
        console.error('Failed to delete event:', error);
        const showToast = window.showToast || function(msg, type) { console.log(msg); };
        showToast('Failed to delete event: ' + error.message, 'error');
    }
}

function renderDashboard() {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) {
        console.error('âŒ Events list element not found');
        return;
    }


    const allEvents = window.events || {};
    const eventIds = Object.keys(allEvents);

    console.log(`ðŸ“Š Rendering dashboard with ${eventIds.length} events`);

    if (eventIds.length === 0) {
        eventsList.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">ðŸŽ¯</div>
                <h3 style="color: var(--semper-navy); margin-bottom: 1rem;">Ready for Your First Mission?</h3>
                <p style="margin-bottom: 2rem; color: #6b7280; max-width: 400px; margin-left: auto; margin-right: auto;">
                    Create your first event to get started with professional military event management.
                </p>
                <button class="btn" onclick="showPage('create')">ðŸš€ Create First Event</button>
                
                <div style="margin-top: 2rem; padding: 1rem; background: var(--gray-50); border-radius: 0.5rem; font-size: 0.875rem; color: #6b7280;">
                    <strong>ðŸ’¡ Quick Tip:</strong> EventCall automatically syncs your events to the cloud, 
                    so you can access them from any device and your guests can RSVP from anywhere.
                </div>
            </div>
        `;
        return;
    }


    const sortedEvents = eventIds
        .map(id => allEvents[id])
        .sort((a, b) => b.created - a.created);

        let html = ``; // Start with empty HTML string

        // Then the rest of your event rendering code continues...
        sortedEvents.forEach(event => {
            // ... your existing event card code
        });
    
    sortedEvents.forEach(event => {
        const eventResponses = (window.responses && window.responses[event.id]) || [];
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
                            ðŸ“… ${formatDate(event.date)} at ${formatTime(event.time)}<br>
                            ðŸ“ ${event.location || 'No location specified'}<br>
                            ðŸ• Created ${formatRelativeTime(event.created)}<br>
                            ${isPast ? 'â° <span style="color: var(--error-color);">Event has passed</span>' : `â³ ${timeUntil}`}
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
                        <div class="stat-label">ðŸŽ–ï¸ TOTAL HEADCOUNT</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color: var(--success-color);">${stats.attending}</div>
                        <div class="stat-label">âœ… Attending</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color: var(--error-color);">${stats.notAttending}</div>
                        <div class="stat-label">âŒ Not Attending</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color: var(--semper-navy);">${stats.total}</div>
                        <div class="stat-label">ðŸ“Š Total RSVPs</div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
                    <button class="btn" onclick="eventManager.showEventManagement('${event.id}')">ðŸ“Š Manage</button>
                    <button class="btn" onclick="copyInviteLink('${event.id}')">ðŸ”— Copy Link</button>
                    <button class="btn btn-success" onclick="exportEventData('${event.id}')">ðŸ“¥ Export</button>
                    <button class="btn btn-success" onclick="syncWithGitHub()">ðŸ”„ Sync</button>
                    ${!isPast ? `<button class="btn" onclick="eventManager.duplicateEvent('${event.id}')">ðŸ“‹ Duplicate</button>` : ''}
                    <button class="btn btn-danger" onclick="deleteEvent('${event.id}')">ðŸ—‘ï¸ Delete</button>
                </div>
            </div>
        `;
    });

    eventsList.innerHTML = html;
    
    // Add CSS for pulse animation if not present
    if (!document.querySelector('#pulse-animation')) {
        const style = document.createElement('style');
        style.id = 'pulse-animation';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.8; transform: scale(1.05); }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('âœ… Dashboard rendered successfully with sync functionality');
}

// Utility functions
function formatDate(date, options = {}) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
    };
    
    return dateObj.toLocaleDateString('en-US', defaultOptions);
}

function formatTime(time) {
    if (!time) return '';
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
}

function formatRelativeTime(date) {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(diffInSeconds / interval.seconds);
        if (count >= 1) {
            return count === 1 ? `1 ${interval.label} ago` : `${count} ${interval.label}s ago`;
        }
    }

    return 'Just now';
}

function isEventInPast(date, time = '00:00') {
    const eventDateTime = new Date(`${date}T${time}`);
    return eventDateTime < new Date();
}

function getTimeUntilEvent(date, time) {
    const eventDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    const diffInSeconds = Math.floor((eventDateTime - now) / 1000);

    if (diffInSeconds <= 0) {
        return 'Event has passed';
    }

    const days = Math.floor(diffInSeconds / 86400);
    const hours = Math.floor((diffInSeconds % 86400) / 3600);
    const minutes = Math.floor((diffInSeconds % 3600) / 60);

    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} away`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} away`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} away`;
    } else {
        return 'Starting soon';
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function sanitizeText(text) {
    if (!text) return '';
    return text.trim().replace(/[<>]/g, '');
}

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

function getEventDetails() {
    const detailFields = document.querySelectorAll('.event-detail-field');
    const details = {};

    detailFields.forEach(field => {
        const value = sanitizeText(field.value);
        const fieldId = field.getAttribute('data-field-id');
        const fieldLabel = field.getAttribute('data-field-label');

        if (value) {
            details[fieldId] = {
                label: fieldLabel,
                value: value
            };
        }
    });

    return details;
}

function clearCustomQuestions() {
    const container = document.getElementById('custom-questions-container');
    if (container) {
        container.innerHTML = '';
    }
}

function clearEventDetails() {
    const container = document.getElementById('event-details-container');
    const section = document.getElementById('event-details-section');
    if (container) {
        container.innerHTML = '';
    }
    if (section) {
        section.style.display = 'none';
    }
}

function handleRSVP(e, eventId) {
    if (window.rsvpHandler && window.rsvpHandler.handleRSVP) {
        window.rsvpHandler.handleRSVP(e, eventId);
    } else {
        console.error('RSVP handler not available');
        e.preventDefault();
    }
}

async function handleEventSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.innerHTML = '<div class="spinner"></div> Creating...';
    submitBtn.disabled = true;

    try {
        if (!managerAuth.isAuthenticated()) {
            throw new Error('Please log in to create events');
        }

        const eventData = {
            id: generateUUID(),
            title: sanitizeText(document.getElementById('event-title').value),
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            location: sanitizeText(document.getElementById('event-location').value),
            description: sanitizeText(document.getElementById('event-description').value),
            coverImage: document.getElementById('cover-preview').src || '',
            askReason: document.getElementById('ask-reason').checked,
            allowGuests: document.getElementById('allow-guests').checked,
            requiresMealChoice: document.getElementById('requires-meal-choice').checked,
            customQuestions: getCustomQuestions(),
            eventDetails: getEventDetails(),
            created: Date.now(),
            status: 'active',
            createdBy: managerAuth.getCurrentManager()?.email,
            createdByName: managerAuth.getCurrentManager()?.email.split('@')[0]
        };

        if (!eventData.title || eventData.title.length < 3) {
            throw new Error('Please enter a valid event title (3+ characters)');
        }

        if (!eventData.date || !eventData.time) {
            throw new Error('Please specify both date and time for the event');
        }

        // Use BackendAPI to trigger workflow and save to EventCall-Data
        if (managerAuth.isAuthenticated() && window.githubAPI) {
            await window.githubAPI.saveEvent(eventData);
            showToast('ðŸ“¤ Event submitted to secure backend for processing...', 'success');
        } else {
            throw new Error('GitHub API not available or not authenticated');
        }

        if (!window.events) window.events = {};
        window.events[eventData.id] = eventData;
        
        const showToast = window.showToast || function(msg, type) { console.log(msg); };
        showToast('ðŸŽ–ï¸ Event deployed successfully!', 'success');
        
        document.getElementById('event-form').reset();
        const coverPreview = document.getElementById('cover-preview');
        if (coverPreview) {
            coverPreview.classList.add('hidden');
            coverPreview.src = '';
        }
        clearCustomQuestions();
        clearEventDetails();
        
    } catch (error) {
        console.error('Failed to save event:', error);
        const showToast = window.showToast || function(msg, type) { console.log(msg); };
        showToast('Failed to save event: ' + error.message, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        setTimeout(() => {
            if (typeof window.loadManagerData === 'function') {
                window.loadManagerData();
            }
            if (window.showPage) {
                window.showPage('dashboard');
            }
        }, 500);
    }
}

function setupEventForm() {
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        eventForm.removeEventListener('submit', handleEventSubmit);
        eventForm.addEventListener('submit', handleEventSubmit);
        console.log('âœ… Event form listener attached');
    }
}

/**
 * Initialize sync status checker
 * Note: Automatic polling removed to reduce API calls.
 * Pending RSVP count updates only on:
 * - Initial dashboard load (loadManagerData)
 * - Manual sync button click (syncWithGitHub)
 */
function initializeSyncChecker() {
    // Removed automatic polling - use manual sync buttons instead
    console.log('â„¹ï¸ RSVP sync checker initialized (manual mode)');
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setupEventForm();
    initializeSyncChecker();
});

// Make functions globally available
window.addCustomQuestion = addCustomQuestion;
window.removeCustomQuestion = removeCustomQuestion;
window.handleEventSubmit = handleEventSubmit;
window.generateUUID = generateUUID;
window.sanitizeText = sanitizeText;
window.getCustomQuestions = getCustomQuestions;
window.clearCustomQuestions = clearCustomQuestions;
window.getEventDetails = getEventDetails;
window.clearEventDetails = clearEventDetails;
window.setupEventForm = setupEventForm;
window.calculateEventStats = calculateEventStats;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatRelativeTime = formatRelativeTime;
window.isEventInPast = isEventInPast;
window.getTimeUntilEvent = getTimeUntilEvent;
window.handleRSVP = handleRSVP;
window.loadManagerData = loadManagerData;
window.renderDashboard = renderDashboard;
window.deleteEvent = deleteEvent;
window.syncWithGitHub = syncWithGitHub;
window.updatePendingRSVPCount = updatePendingRSVPCount;
window.initializeSyncChecker = initializeSyncChecker;

window.showEventManagement = function(eventId) {
    if (window.eventManager && window.eventManager.showEventManagement) {
        window.eventManager.showEventManagement(eventId);
    } else {
        console.error('EventManager not available');
    }
};

window.duplicateEvent = function(eventId) {
    if (window.eventManager && window.eventManager.duplicateEvent) {
        window.eventManager.duplicateEvent(eventId);
    } else {
        console.error('EventManager not available');
    }
};

console.log('âœ… Enhanced manager system loaded with RSVP sync functionality');
