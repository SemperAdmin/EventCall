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
        <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">🗑️</button>
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
        showToast('⏳ Sync already in progress...', 'error');
        return;
    }

    if (!managerAuth.isAuthenticated()) {
        showToast('🔒 Please login with GitHub token to sync RSVPs', 'error');
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

        showToast('🔄 Syncing RSVPs from GitHub Issues...', 'success');

        // Process RSVP issues
        const result = await window.githubAPI.processRSVPIssues();
        
        if (result.processed > 0) {
            // Reload data after processing
            await loadManagerData();
            
            // Show success message
            showToast(`✅ Synced ${result.processed} new RSVPs successfully!`, 'success');
            
            // Update pending count
            await updatePendingRSVPCount();
        } else {
            showToast('ℹ️ No new RSVPs to sync', 'success');
        }

    } catch (error) {
        console.error('Sync failed:', error);
        showToast('❌ Sync failed: ' + error.message, 'error');
    } finally {
        syncInProgress = false;
        
        // Reset button state
        const syncButtons = document.querySelectorAll('[onclick*="syncWithGitHub"]');
        syncButtons.forEach(btn => {
            btn.innerHTML = '🔄 Sync RSVPs';
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
                btn.innerHTML = `🔄 Sync RSVPs (${count} pending)`;
                btn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                btn.style.animation = 'pulse 2s infinite';
            } else {
                btn.innerHTML = '🔄 Sync RSVPs';
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
                <span style="font-size: 1.2rem;">📬</span>
                <span>${pendingCount} new RSVP${pendingCount > 1 ? 's' : ''} ready to sync!</span>
                <button class="btn" onclick="syncWithGitHub()" style="margin-left: 1rem; padding: 0.5rem 1rem; font-size: 0.875rem;">
                    🔄 Sync Now
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
    console.log('📊 Loading manager data...');
    
    if (!window.events) window.events = {};
    if (!window.responses) window.responses = {};
    
    if (!managerAuth.isAuthenticated()) {
        console.log('⚠️ No GitHub token available - using local events only');
        renderDashboard();
        return;
    }
    
    if (window.githubAPI) {
        try {
            // Load events
            const events = await window.githubAPI.loadEvents();
            window.events = events || {};
            console.log(`✅ Loaded ${Object.keys(window.events).length} events from GitHub`);
            
            // Load responses
            const responses = await window.githubAPI.loadResponses();
            window.responses = responses || {};
            console.log(`✅ Loaded responses for ${Object.keys(window.responses).length} events from GitHub`);
            
            // Update pending RSVP count
            await updatePendingRSVPCount();
            
        } catch (error) {
            console.error('❌ Failed to load from GitHub:', error);
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

        const currentUser = managerAuth.getCurrentManager();
        if (!currentUser || event.createdBy !== currentUser.email) {
            showToast('❌ You can only delete your own events', 'error');
            return;
        }

        if (managerAuth.isAuthenticated() && window.githubAPI) {
            try {
                if (window.githubAPI && window.githubAPI.deleteEvent) {
                    await window.githubAPI.deleteEvent(eventId, event.title);
                }
            } catch (error) {
                console.error('Failed to delete from GitHub:', error);
            }
        }
        
        if (window.events) delete window.events[eventId];
        if (window.responses) delete window.responses[eventId];
        
        showToast('🗑️ Event deleted successfully', 'success');
        
        await loadManagerData();
        
        if (window.location.hash.includes('manage/')) {
            if (window.showPage) {
                window.showPage('dashboard');
            }
        }
        
    } catch (error) {
        console.error('Failed to delete event:', error);
        showToast('Failed to delete event: ' + error.message, 'error');
    }
}

function renderDashboard() {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;

    if (!window.events || Object.keys(window.events).length === 0) {
        eventsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎖️</div>
                <h3>No Events Created Yet</h3>
                <p>Start by creating your first military event</p>
                <button class="btn" onclick="showPage('create')">➕ Create Event</button>
            </div>
        `;
        return;
    }

    const eventArray = Object.values(window.events);
    console.log('📊 Rendering dashboard with ' + eventArray.length + ' events');
    
    eventsList.innerHTML = eventArray
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(event => {
            const eventResponses = window.responses?.[event.id] || [];
            const stats = calculateEventStats(eventResponses);
            const inviteLink = `${window.location.origin}${window.location.pathname}#invite/${event.id}`;
            const isPast = isEventInPast(event.date, event.time);
            
            return `
                <div class="event-card ${isPast ? 'event-past' : ''}">
                    ${event.coverImage ? `<img src="${event.coverImage}" alt="${event.title}" class="event-cover">` : ''}
                    <div class="event-header">
                        <h3>${event.title}</h3>
                        ${isPast ? '<span class="event-status-badge event-status-past">Past Event</span>' : '<span class="event-status-badge event-status-active">Active</span>'}
                    </div>
                    <div class="event-meta">
                        <span>📅 ${formatDate(event.date)}</span>
                        <span>⏰ ${formatTime(event.time)}</span>
                        <span>📍 ${event.location}</span>
                    </div>
                    
                    <div class="rsvp-stats">
                        <div class="stat">
                            <span class="stat-value">${stats.attending}</span>
                            <span class="stat-label">Attending</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${stats.notAttending}</span>
                            <span class="stat-label">Not Attending</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${stats.totalHeadcount}</span>
                            <span class="stat-label">Total Headcount</span>
                        </div>
                    </div>

                    <div class="event-actions">
                        <button class="btn btn-primary" onclick="window.eventManager.showEventManagement('${event.id}')">
                            📊 Manage
                        </button>
                        <button class="btn" onclick="copyInviteLink('${inviteLink}', event)">
                            🔗 Copy Link
                        </button>
                        <button class="btn" onclick="exportEventData('${event.id}')">
                            💾 Export
                        </button>
                        <button class="btn btn-danger" onclick="deleteEvent('${event.id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        })
        .join('');

    console.log('✅ Dashboard rendered successfully with sync functionality');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function formatRelativeTime(dateString, timeString = '00:00') {
    const eventDateTime = new Date(`${dateString}T${timeString}`);
    const now = new Date();
    const diffInSeconds = Math.floor((eventDateTime - now) / 1000);

    if (diffInSeconds < 0) {
        return 'Past event';
    }

    const days = Math.floor(diffInSeconds / 86400);
    const hours = Math.floor((diffInSeconds % 86400) / 3600);
    
    if (days > 0) {
        return `${days} day${days !== 1 ? 's' : ''} away`;
    } else if (hours > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''} away`;
    } else {
        return 'Today';
    }
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
        return `${days}d ${hours}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
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

        // Save directly to EventCall-Data via GitHub API
        if (managerAuth.isAuthenticated() && window.githubAPI) {
            await window.githubAPI.saveEvent(eventData);
        } else {
            throw new Error('GitHub API not available or not authenticated');
        }

        if (!window.events) window.events = {};
        window.events[eventData.id] = eventData;
        
        const showToast = window.showToast || function(msg, type) { console.log(msg); };
        showToast('🎖️ Event deployed successfully!', 'success');
        
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
            // Wait longer for manager-system.js to fully load
            if (typeof window.loadManagerData === 'function') {
                window.loadManagerData();
            } else {
                // Retry after additional delay
                setTimeout(() => {
                    if (typeof window.loadManagerData === 'function') {
                        window.loadManagerData();
                    }
                }, 500);
            }
            if (window.showPage) {
                window.showPage('dashboard');
            }
        }, 1000); // Increased from 500ms to 1000ms
    }
}

function setupEventForm() {
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        eventForm.removeEventListener('submit', handleEventSubmit);
        eventForm.addEventListener('submit', handleEventSubmit);
        console.log('✅ Event form listener attached');
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
    console.log('ℹ️ RSVP sync checker initialized (manual mode)');
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

console.log('✅ Enhanced manager system loaded with RSVP sync functionality');
