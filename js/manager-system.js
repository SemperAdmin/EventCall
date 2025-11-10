/**
 * Manager System - Enhanced with RSVP Sync Functionality and Email Auth
 * Added GitHub Issues processing, real-time sync capabilities, and userAuth support
 */

// Global sync state
let syncInProgress = false;
let pendingRSVPCount = 0;

// Add custom question function
function addCustomQuestion(questionData = null) {
    const container = document.getElementById('custom-questions-container');
    if (!container) return;

    const questionItem = document.createElement('div');
    questionItem.className = 'custom-question-item';

    // Default values or from existing questionData
    const questionText = questionData?.question || '';
    const questionType = questionData?.type || 'text';
    const questionOptions = questionData?.options || [];

    const optionsHTML = questionOptions.map((opt, idx) =>
        `<div class="question-option-item">
            <input type="text" class="question-option-input" placeholder="Option ${idx + 1}" value="${window.utils.escapeHTML(opt)}">
            <button type="button" class="btn-small btn-danger" onclick="removeQuestionOption(this)">✕</button>
        </div>`
    ).join('');

    questionItem.innerHTML = `
        <div class="question-header">
            <input type="text" placeholder="Enter your question..." class="custom-question-input" value="${window.utils.escapeHTML(questionText)}">
            <select class="question-type-select" onchange="handleQuestionTypeChange(this)">
                <option value="text" ${questionType === 'text' ? 'selected' : ''}>📝 Text</option>
                <option value="choice" ${questionType === 'choice' ? 'selected' : ''}>☑️ Multiple Choice</option>
                <option value="date" ${questionType === 'date' ? 'selected' : ''}>📅 Date</option>
                <option value="datetime" ${questionType === 'datetime' ? 'selected' : ''}>🕐 Date & Time</option>
            </select>
            <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">🗑️</button>
        </div>
        <div class="question-options-container" style="display: ${questionType === 'choice' ? 'block' : 'none'}">
            <div class="question-options-list">${optionsHTML}</div>
            <button type="button" class="btn-small" onclick="addQuestionOption(this)">+ Add Option</button>
        </div>
    `;
    container.appendChild(questionItem);
}

function removeCustomQuestion(button) {
    const questionItem = button.closest('.custom-question-item');
    if (questionItem) {
        questionItem.remove();
    }
}

// Handle question type change
function handleQuestionTypeChange(selectElement) {
    const questionItem = selectElement.closest('.custom-question-item');
    const optionsContainer = questionItem.querySelector('.question-options-container');

    if (selectElement.value === 'choice') {
        optionsContainer.style.display = 'block';
        // Add default options if none exist
        const optionsList = optionsContainer.querySelector('.question-options-list');
        if (!optionsList.querySelector('.question-option-item')) {
            addQuestionOption(optionsContainer.querySelector('.btn-small'));
            addQuestionOption(optionsContainer.querySelector('.btn-small'));
        }
    } else {
        optionsContainer.style.display = 'none';
    }
}

// Add option to a choice question
function addQuestionOption(button) {
    const optionsContainer = button.closest('.question-options-container');
    const optionsList = optionsContainer.querySelector('.question-options-list');
    const optionCount = optionsList.querySelectorAll('.question-option-item').length;

    const optionItem = document.createElement('div');
    optionItem.className = 'question-option-item';
    optionItem.innerHTML = `
        <input type="text" class="question-option-input" placeholder="Option ${optionCount + 1}">
        <button type="button" class="btn-small btn-danger" onclick="removeQuestionOption(this)">✕</button>
    `;
    optionsList.appendChild(optionItem);
}

// Remove option from a choice question
function removeQuestionOption(button) {
    const optionItem = button.closest('.question-option-item');
    if (optionItem) {
        optionItem.remove();
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
        if (response.attending === true || response.attending === 'true') {
            stats.attending++;
            // Parse guest count - handle both string and number formats
            const guestCount = parseInt(response.guestCount, 10) || 0;
            stats.attendingWithGuests += guestCount;
        } else if (response.attending === false || response.attending === 'false') {
            stats.notAttending++;
        }

        // Track total guests regardless of attendance
        stats.totalGuests += parseInt(response.guestCount, 10) || 0;
    });

    // Total headcount = people attending + their guests
    stats.totalHeadcount = stats.attending + stats.attendingWithGuests;
    stats.responseRate = stats.total > 0 ? ((stats.attending + stats.notAttending) / stats.total * 100).toFixed(1) : 0;

    // Debug logging
    console.log('📊 Event Stats:', {
        totalResponses: stats.total,
        attending: stats.attending,
        guests: stats.attendingWithGuests,
        totalHeadcount: stats.totalHeadcount
    });

    return stats;
}

/**
 * Get current authenticated user (supports both old and new auth)
 */
function getCurrentAuthenticatedUser() {
    // Try new userAuth first
    if (window.userAuth && window.userAuth.isAuthenticated()) {
        return window.userAuth.getCurrentUser();
    }
    
    // Fallback to old managerAuth
    if (window.managerAuth && window.managerAuth.isAuthenticated()) {
        return window.managerAuth.getCurrentManager();
    }
    
    return null;
}

/**
 * Check if user is authenticated (supports both old and new auth)
 */
function isUserAuthenticated() {
    return getCurrentAuthenticatedUser() !== null;
}

/**
 * Sync RSVPs from GitHub Issues
 */
async function syncWithGitHub() {
    if (syncInProgress) {
        showToast('⏳ Sync already in progress...', 'error');
        return;
    }

    if (!isUserAuthenticated()) {
        showToast('🔒 Please login to sync RSVPs', 'error');
        return;
    }

    syncInProgress = true;
    
    try {
        // Update button state
        const syncButtons = document.querySelectorAll('[onclick*="syncWithGitHub"]');
        syncButtons.forEach(btn => {
            // Safe HTML injection for spinner state
            btn.innerHTML = window.utils.sanitizeHTML('<div class="spinner"></div> Syncing...');
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
            // Use textContent to avoid HTML parsing for simple text
            btn.textContent = '🔄 Sync RSVPs';
            btn.disabled = false;
        });
    }
}

/**
 * Update pending RSVP count in UI
 */
async function updatePendingRSVPCount() {
    if (!isUserAuthenticated()) {
        return;
    }

    try {
        const count = await window.githubAPI.getPendingRSVPCount();
        pendingRSVPCount = count;
        
        // Update sync button text if pending RSVPs exist
        const syncButtons = document.querySelectorAll('[onclick*="syncWithGitHub"]');
        syncButtons.forEach(btn => {
            if (count > 0) {
                btn.innerHTML = window.utils.sanitizeHTML(`🔄 Sync RSVPs (${window.utils.escapeHTML(String(count))} pending)`);
                btn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                btn.style.animation = 'pulse 2s infinite';
            } else {
                btn.innerHTML = window.utils.sanitizeHTML('🔄 Sync RSVPs');
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
        // Keep inline onclick; escape dynamic pieces
        syncBanner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                <span style="font-size: 1.2rem;">📬</span>
                <span>${window.utils.escapeHTML(String(pendingCount))} new RSVP${pendingCount > 1 ? 's' : ''} ready to sync!</span>
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
    
    if (!isUserAuthenticated()) {
        console.log('⚠️ No authentication - using local events only');
        renderDashboard();
        return;
    }

    // Show skeleton while fetching data
    try {
        const list = document.getElementById('events-list');
        if (list && window.LoadingUI && window.LoadingUI.Skeleton) {
            window.LoadingUI.Skeleton.show(list, 'cards', 6);
        }
    } catch (_) {}
    
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

    // Load user's RSVPs
    if (window.displayUserRSVPs) {
        window.displayUserRSVPs();
    }
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

        const currentUser = getCurrentAuthenticatedUser();
        const ownerUsername = currentUser && currentUser.username;
        const eventOwnerMatches = ownerUsername && (event.createdBy === ownerUsername || event.createdByUsername === ownerUsername);
        if (!currentUser || !eventOwnerMatches) {
            showToast('❌ You can only delete your own events', 'error');
            return;
        }

        if (isUserAuthenticated() && window.githubAPI) {
            try {
                if (window.githubAPI && window.githubAPI.deleteEvent) {
                    await window.githubAPI.deleteEvent(eventId, event.title, event.coverImage);
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
                <button class="btn btn-primary" onclick="showPage('create')">➕ Create Event</button>
            </div>
        `;
        return;
    }

    const eventArray = Object.values(window.events);
    console.log('📊 Rendering dashboard with ' + eventArray.length + ' events');
    
    // Separate active and past events
    const now = new Date();
    const activeEvents = eventArray.filter(event => !isEventInPast(event.date, event.time));
    const pastEvents = eventArray.filter(event => isEventInPast(event.date, event.time));
    
    // Sort: active by date ascending, past by date descending
    activeEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
    pastEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Render active events section
    let html = `
        <div class="dashboard-header">
            <h2>🎖️ Command Center</h2>
            <div class="quick-actions">
                <button class="btn btn-primary" onclick="showPage('create')">
                    ➕ Create Event
                </button>
                <button class="btn" onclick="syncWithGitHub()">
                    🔄 Sync RSVPs
                </button>
            </div>
        </div>
    `;
    
    if (activeEvents.length > 0) {
        html += `
            <div class="events-section">
                <h3 class="section-title">🟢 Active Events</h3>
                <div class="events-grid">
                    ${activeEvents.map(event => renderEventCard(event, false)).join('')}
                </div>
            </div>
        `;
    }
    
    if (pastEvents.length > 0) {
        html += `
            <div class="events-section">
                <h3 class="section-title">🔴 Past Events</h3>
                <div class="events-grid">
                    ${pastEvents.map(event => renderEventCard(event, true)).join('')}
                </div>
            </div>
        `;
    }
    
    eventsList.innerHTML = html;
    console.log('✅ Dashboard rendered successfully with Command Center layout');
}

function renderEventCard(event, isPast) {
    const eventResponses = window.responses?.[event.id] || [];
    const stats = calculateEventStats(eventResponses);
    const inviteLink = `${window.location.origin}${window.location.pathname}#invite/${event.id}`;
    
    // Use sanitization for all user-generated content
    const h = sanitizeHTML;
    
    return `
        <div class="event-card-v2 ${isPast ? 'event-past' : 'event-active'}">
            ${event.coverImage ? `
                <div class="event-cover-wrapper">
                    <img src="${sanitizeURL(event.coverImage)}" alt="${h(event.title)}" class="event-cover">
                    <div class="event-badge ${isPast ? 'badge-past' : 'badge-active'}">
                        ${isPast ? '🔴 Past' : '🟢 Active'}
                    </div>
                </div>
            ` : `
                <div class="event-cover-placeholder">
                    <div class="placeholder-icon">🎖️</div>
                    <div class="event-badge ${isPast ? 'badge-past' : 'badge-active'}">
                        ${isPast ? '🔴 Past' : '🟢 Active'}
                    </div>
                </div>
            `}
            
            <div class="event-card-content">
                <h3 class="event-title">${h(event.title)}</h3>
                
                <div class="event-meta-v2">
                    <div class="meta-item">
                        <span class="meta-icon">📅</span>
                        <span class="meta-text">${formatDate(event.date)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">⏰</span>
                        <span class="meta-text">${formatTime(event.time)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">📍</span>
                        <span class="meta-text">${h(event.location)}</span>
                    </div>
                </div>
                
                <div class="rsvp-stats-v2">
                    <div class="stat-box stat-attending">
                        <div class="stat-icon">✅</div>
                        <div class="stat-number">${stats.attending}</div>
                        <div class="stat-label">Attending</div>
                    </div>
                    <div class="stat-box stat-declined">
                        <div class="stat-icon">❌</div>
                        <div class="stat-number">${stats.notAttending}</div>
                        <div class="stat-label">Declined</div>
                    </div>
                    <div class="stat-box stat-headcount">
                        <div class="stat-icon">👥</div>
                        <div class="stat-number">${stats.totalHeadcount}</div>
                        <div class="stat-label">Total</div>
                        ${event.allowGuests ? `
                            <div class="stat-sublabel" style="font-size: 0.65rem; color: #6b7280; margin-top: 0.25rem;">
                                ${stats.attending} + ${stats.attendingWithGuests}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="event-actions-v2">
                    <button class="btn-primary-action" onclick="handleManageClick(event, '${event.id}')">
                        📊 Manage Event
                    </button>
                    <div class="quick-actions-row">
                        <button class="btn-quick" onclick="handleActionClick(event, () => copyInviteLink('${event.id}'))" title="Copy Invite Link">
                            🔗 Copy Link
                        </button>
                        <button class="btn-quick" onclick="handleActionClick(event, () => exportEventData('${event.id}'))" title="Export Data">
                            📤 Export
                        </button>
                        <button class="btn-quick btn-danger-quick" onclick="handleActionClick(event, () => deleteEvent('${event.id}'))" title="Delete Event">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
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

/**
 * Enhanced text sanitization to prevent XSS attacks
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
    if (!text) return '';

    // HTML entity map for escaping
    const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };

    // Trim and escape HTML entities
    return text
        .trim()
        .replace(/[&<>"'\/]/g, char => entityMap[char])
        .substring(0, 500); // Limit length to prevent abuse
}

/**
 * Sanitize HTML content while preserving safe tags
 * @param {string} html - HTML content to sanitize
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html) {
    if (!html) return '';

    // Create temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.textContent = html;

    return tempDiv.innerHTML;
}

/**
 * Validate and sanitize URL
 * @param {string} url - URL to validate
 * @returns {string|null} Sanitized URL or null if invalid
 */
function sanitizeURL(url) {
    if (!url) return null;

    try {
        const parsed = new URL(url);

        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return null;
        }

        return parsed.href;
    } catch (e) {
        return null;
    }
}

function getCustomQuestions() {
    const questionItems = document.querySelectorAll('.custom-question-item');
    const questions = [];

    questionItems.forEach((item, index) => {
        const input = item.querySelector('.custom-question-input');
        const typeSelect = item.querySelector('.question-type-select');
        const text = sanitizeText(input.value);

        if (text && text.length >= 3) {
            const questionData = {
                id: `custom_${index}`,
                question: text,
                type: typeSelect.value
            };

            // Collect options for choice questions
            if (typeSelect.value === 'choice') {
                const optionInputs = item.querySelectorAll('.question-option-input');
                const options = [];
                optionInputs.forEach(optInput => {
                    const optText = sanitizeText(optInput.value);
                    if (optText) {
                        options.push(optText);
                    }
                });
                questionData.options = options;
            }

            questions.push(questionData);
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
        section.classList.add('hidden');
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

    // Show loading state
    submitBtn.innerHTML = '<div class="spinner"></div> Processing...';
    submitBtn.disabled = true;

    try {
        // Validate authentication using helper function
        if (!isUserAuthenticated()) {
            throw new Error('Authentication required. Please log in to create events.');
        }

        // Get current user using helper function
        const currentUser = getCurrentAuthenticatedUser();
        if (!currentUser) {
            throw new Error('Unable to get user information. Please log in again.');
        }

        // If in edit mode, route to update flow
        if (window.eventManager && window.eventManager.editMode) {
            const baseData = window.eventManager.getFormData ? window.eventManager.getFormData() : {};

            // Validate event data (title/date/time and location URL)
            if (window.eventManager && typeof window.eventManager.validateEventData === 'function') {
                const validation = window.eventManager.validateEventData(baseData);
                if (!validation.valid) {
                    validation.errors.forEach(err => showToast(err, 'error'));
                    throw new Error('Event validation failed');
                }
            }

            // Additional async URL validation when present - only for actual URLs
            // Allow plain text addresses like "Building 123, Room 456"
            const looksLikeURL = /^https?:\/\/|:\/\//.test(baseData.location);
            if (baseData.location && looksLikeURL && window.validation && window.validation.validateURL) {
                try {
                    const check = await window.validation.validateURL(baseData.location, { requireHTTPS: false, verifyDNS: false });
                    if (!check.valid) {
                        check.errors.forEach(err => showToast(err, 'error'));
                        throw new Error('Invalid event location URL');
                    }
                    // Optionally use sanitized URL
                    baseData.location = check.sanitized;
                } catch (e2) {
                    showToast('❌ Failed to validate event location URL', 'error');
                    throw e2;
                }
            }

            // Preserve or initialize seating chart based on toggle
            const enableSeatingEl = document.getElementById('enable-seating');
            const currentEvent = window.eventManager.currentEvent;

            if (enableSeatingEl && enableSeatingEl.checked) {
                if (currentEvent && currentEvent.seatingChart) {
                    baseData.seatingChart = currentEvent.seatingChart; // preserve assignments
                } else if (typeof window.SeatingChart === 'function') {
                    const tables = parseInt(document.getElementById('number-of-tables')?.value) || 0;
                    const seats = parseInt(document.getElementById('seats-per-table')?.value) || 0;
                    if (tables > 0 && seats > 0) {
                        const sc = new window.SeatingChart(currentEvent?.id || generateUUID());
                        baseData.seatingChart = sc.initializeSeatingChart(tables, seats);
                    }
                }
            } else if (currentEvent && currentEvent.seatingChart) {
                baseData.seatingChart = { ...currentEvent.seatingChart, enabled: false, lastModified: Date.now() };
            }

            // Show progress update
            submitBtn.innerHTML = '<div class="spinner"></div> Updating...';
            await window.eventManager.updateEvent(baseData);
            return; // Skip create logic
        }

        // Collect form data
        const eventData = {
            id: generateUUID(),
            title: sanitizeText(document.getElementById('event-title').value),
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            location: sanitizeText(document.getElementById('event-location').value),
            description: sanitizeText(document.getElementById('event-description').value),
            coverImage: document.getElementById('cover-image-url').value || '',
            askReason: document.getElementById('ask-reason').checked,
            allowGuests: document.getElementById('allow-guests').checked,
            requiresMealChoice: document.getElementById('requires-meal-choice').checked,
            customQuestions: getCustomQuestions(),
            eventDetails: getEventDetails(),
            created: Date.now(),
            status: 'active',
            createdBy: (currentUser.username || 'unknown'),
            createdByName: currentUser.name || currentUser.username || 'unknown'
        };

        // Secure URL validation for event location - only if it looks like a URL
        // Allow plain text addresses like "Building 123, Room 456"
        if (eventData.location && typeof window.validation === 'object' && typeof window.validation.validateURL === 'function') {
            // Only validate as URL if it starts with http:// or https:// or contains ://
            const looksLikeURL = /^https?:\/\/|:\/\//.test(eventData.location);

            if (looksLikeURL) {
                try {
                    const urlCheck = await window.validation.validateURL(eventData.location, { requireHTTPS: false, verifyDNS: false });
                    if (!urlCheck.valid) {
                        showToast(`❌ Invalid event location URL: ${urlCheck.errors.join(', ')}`, 'error');
                        throw new Error('Event location URL failed validation');
                    }
                    // Use sanitized URL
                    eventData.location = urlCheck.sanitized;
                } catch (e) {
                    showToast('❌ Failed to validate event location URL', 'error');
                    throw e;
                }
            }
            // Otherwise, treat as plain text and keep as-is (already sanitized above)
        }

        // Seating Chart: initialize and persist if enabled
        const enableSeating = document.getElementById('enable-seating');
        if (enableSeating && enableSeating.checked && typeof window.SeatingChart === 'function') {
            const tablesInput = document.getElementById('number-of-tables');
            const seatsInput = document.getElementById('seats-per-table');
            const numberOfTables = parseInt(tablesInput && tablesInput.value) || 0;
            const seatsPerTable = parseInt(seatsInput && seatsInput.value) || 0;

            if (numberOfTables > 0 && seatsPerTable > 0) {
                const seatingChart = new window.SeatingChart(eventData.id);
                eventData.seatingChart = seatingChart.initializeSeatingChart(numberOfTables, seatsPerTable);
            }
        }

        // Validate required fields
        if (!eventData.title || eventData.title.length < 3) {
            throw new Error('Event title must be at least 3 characters long.');
        }

        if (!eventData.date || !eventData.time) {
            throw new Error('Please specify both date and time for the event.');
        }

        // Validate date is not too far in the past
        const eventDateTime = new Date(`${eventData.date}T${eventData.time}`);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (eventDateTime < yesterday) {
            throw new Error('Event date cannot be more than 1 day in the past.');
        }

        // Show progress update
        submitBtn.innerHTML = '<div class="spinner"></div> Saving to GitHub...';

        // Save to GitHub with retry logic
        if (window.githubAPI) {
            if (window.errorHandler) {
                // Use error handler's retry mechanism
                await window.errorHandler.retryWithBackoff(
                    () => window.githubAPI.saveEvent(eventData),
                    3,
                    2000
                );
            } else {
                await window.githubAPI.saveEvent(eventData);
            }
        } else {
            throw new Error('GitHub API not available. Please check your connection.');
        }

        // Update local state
        if (!window.events) window.events = {};
        window.events[eventData.id] = eventData;

        showToast('🎖️ Event deployed successfully!', 'success');

        // Reset form
        document.getElementById('event-form').reset();
        const coverPreview = document.getElementById('cover-preview');
        const coverImageUrlInput = document.getElementById('cover-image-url');
        if (coverPreview) {
            coverPreview.classList.add('hidden');
            coverPreview.src = '';
        }
        if (coverImageUrlInput) {
            coverImageUrlInput.value = '';
        }

        // Reset upload area text
        const coverUpload = document.getElementById('cover-upload');
        if (coverUpload) {
            coverUpload.innerHTML = window.utils.sanitizeHTML('<p>Click or drag to upload cover image</p>');
        }

        clearCustomQuestions();
        clearEventDetails();

        // Navigate to dashboard after successful creation
        setTimeout(() => {
            if (typeof window.loadManagerData === 'function') {
                window.loadManagerData();
            }
            if (window.showPage) {
                window.showPage('dashboard');
            }
        }, 500);

    } catch (error) {
        // Use error handler for better error messages
        if (window.errorHandler) {
            window.errorHandler.handleError(error, 'Event Creation');
        } else {
            console.error('Failed to save event:', error);
            showToast(`❌ Failed to save event: ${error.message}`, 'error');
        }
    } finally {
        // Always reset button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function setupEventForm() {
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        // Skip if already initialized
        if (eventForm.dataset.formInitialized === 'true') {
            console.log('ℹ️ Event form already initialized, skipping...');
            return;
        }

        eventForm.addEventListener('submit', handleEventSubmit);
        // Initialize seating chart toggle/fields when the form is set up
        if (typeof setupSeatingChartToggle === 'function') {
            setupSeatingChartToggle();
        }
        eventForm.dataset.formInitialized = 'true';
        console.log('✅ Event form listener attached');
    }
}

/**
 * Setup seating chart configuration toggle and capacity calculation
 */
function setupSeatingChartToggle() {
    const enableSeatingCheckbox = document.getElementById('enable-seating');
    const seatingConfigFields = document.getElementById('seating-config-fields');
    const numberOfTablesInput = document.getElementById('number-of-tables');
    const seatsPerTableInput = document.getElementById('seats-per-table');
    const totalCapacitySpan = document.getElementById('total-seating-capacity');

    if (!enableSeatingCheckbox || !seatingConfigFields) return;

    // Toggle seating config fields visibility
    enableSeatingCheckbox.addEventListener('change', function() {
        seatingConfigFields.classList.toggle('hidden', !this.checked);
        if (this.checked) {
            updateSeatingCapacity();
        }
    });

    // Update total capacity when inputs change
    function updateSeatingCapacity() {
        const tables = parseInt(numberOfTablesInput.value) || 0;
        const seatsPerTable = parseInt(seatsPerTableInput.value) || 0;
        const total = tables * seatsPerTable;

        if (totalCapacitySpan) {
            totalCapacitySpan.textContent = total;
        }
    }

    if (numberOfTablesInput) {
        numberOfTablesInput.addEventListener('input', updateSeatingCapacity);
    }

    if (seatsPerTableInput) {
        seatsPerTableInput.addEventListener('input', updateSeatingCapacity);
    }

    // Initialize capacity display
    updateSeatingCapacity();
}

/**
 * Toggle past events visibility
 */
function togglePastEvents() {
    const pastSection = document.querySelector('.past-events-grid');
    const toggle = document.querySelector('.past-events-toggle');
    
    if (pastSection && toggle) {
        const isCollapsed = toggle.classList.contains('collapsed');
        
        if (isCollapsed) {
            pastSection.style.display = 'grid';
            toggle.classList.remove('collapsed');
        } else {
            pastSection.style.display = 'none';
            toggle.classList.add('collapsed');
        }
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

/**
 * Handle manage event button click with proper event handling
 * @param {Event} e - Click event
 * @param {string} eventId - Event ID
 */
function handleManageClick(e, eventId) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    if (window.AppRouter && typeof window.AppRouter.navigateToPage === 'function') {
        window.AppRouter.navigateToPage('manage', eventId);
    } else if (window.eventManager && typeof window.eventManager.showEventManagement === 'function') {
        window.eventManager.showEventManagement(eventId);
    }
}

/**
 * Handle action button clicks with proper event handling
 * @param {Event} e - Click event
 * @param {Function} callback - Action to perform
 */
function handleActionClick(e, callback) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    if (typeof callback === 'function') {
        callback();
    }
}

/**
 * Setup photo upload handlers for cover image
 */
function setupPhotoUpload() {
    const coverUpload = document.getElementById('cover-upload');
    const coverInput = document.getElementById('cover-input');
    const coverPreview = document.getElementById('cover-preview');
    const coverImageUrlInput = document.getElementById('cover-image-url');

    if (!coverUpload || !coverInput || !coverPreview || !coverImageUrlInput) {
        console.warn('⚠️ Photo upload elements not found. Ensure all IDs (cover-upload, cover-input, cover-preview, cover-image-url) are correct.');
        return;
    }

    // Skip if already initialized
    if (coverUpload.dataset.uploadInitialized === 'true') {
        console.log('ℹ️ Photo upload already initialized, skipping...');
        return;
    }

    // Click handler - open file picker when upload area is clicked
    coverUpload.addEventListener('click', () => {
        coverInput.click();
    });

    // Keyboard handler - Enter or Space key to open file picker (accessibility)
    coverUpload.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            coverInput.click();
        }
    });

    // File input change handler
    coverInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await handleImageFile(file, coverPreview, coverUpload, coverImageUrlInput);
        }
    });

    // Drag and drop handlers
    coverUpload.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        coverUpload.classList.add('dragover');
        coverUpload.style.borderColor = 'var(--semper-gold)';
        coverUpload.style.background = 'rgba(255, 215, 0, 0.05)';
        coverUpload.setAttribute('aria-label', 'Drop image file here to upload');
    });

    coverUpload.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        coverUpload.classList.remove('dragover');
        coverUpload.style.borderColor = '';
        coverUpload.style.background = '';
        coverUpload.setAttribute('aria-label', 'Upload cover image by clicking or dragging a file');
    });

    coverUpload.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        coverUpload.classList.remove('dragover');
        coverUpload.style.borderColor = '';
        coverUpload.style.background = '';
        coverUpload.setAttribute('aria-label', 'Upload cover image by clicking or dragging a file');

        const file = e.dataTransfer.files[0];
        if (file) {
            // Validate that it's an image file
            if (file.type.startsWith('image/')) {
                await handleImageFile(file, coverPreview, coverUpload, coverImageUrlInput);
            } else {
                showToast('❌ Please upload an image file (JPEG, PNG, GIF, WebP)', 'error');
            }
        }
    });

    // Mark as initialized
    coverUpload.dataset.uploadInitialized = 'true';

    console.log('✅ Photo upload handlers attached with keyboard support');
}

/**
 * Handle image file upload and preview
 * @param {File} file - Image file to process
 */
async function handleImageFile(file, coverPreview, coverUpload, coverImageUrlInput) {
    // Enhanced file validation (size, MIME, signature)
    if (window.validation && typeof window.validation.validateImageUpload === 'function') {
        const check = await window.validation.validateImageUpload(file);
        if (!check.valid) {
            showToast('❌ ' + (check.errors.join('\n') || 'File validation failed'), 'error');
            return;
        }
    } else {
        // Fallback: minimal checks
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showToast('❌ Image too large. Maximum size is 5MB', 'error');
            return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showToast('❌ Invalid file type. Please use JPEG, PNG, GIF, or WebP', 'error');
            return;
        }
    }

    try {
        // Show loading state
        coverUpload.innerHTML = window.utils.sanitizeHTML('<div class="spinner"></div><p>Uploading...</p>');

        // Generate a unique filename
        const fileExtension = file.name.split('.').pop();
        const uniqueFileName = `${generateUUID()}.${fileExtension}`;

        // Upload image and get public URL
        const imageUrl = await window.githubAPI.uploadImage(file, uniqueFileName);

        // Store the URL and update the preview
        coverImageUrlInput.value = imageUrl;
        coverPreview.src = imageUrl;
        coverPreview.classList.remove('hidden');

        // Update upload area text
        coverUpload.innerHTML = window.utils.sanitizeHTML('<p>✅ Image uploaded! Click or drag to change</p>');

        showToast('📷 Cover image uploaded successfully!', 'success');

    } catch (error) {
        console.error('Image upload failed:', error);
        showToast('❌ Failed to upload image: ' + error.message, 'error');

        // Reset upload area
        coverUpload.innerHTML = window.utils.sanitizeHTML('<p>Click or drag to upload cover image</p>');
    }
}



// Make functions globally available
window.addCustomQuestion = addCustomQuestion;
window.removeCustomQuestion = removeCustomQuestion;
window.handleEventSubmit = handleEventSubmit;
window.handleManageClick = handleManageClick;
window.handleActionClick = handleActionClick;
window.generateUUID = generateUUID;
window.sanitizeText = sanitizeText;
window.sanitizeHTML = sanitizeHTML;
window.sanitizeURL = sanitizeURL;
window.getCustomQuestions = getCustomQuestions;
window.clearCustomQuestions = clearCustomQuestions;
window.getEventDetails = getEventDetails;
window.clearEventDetails = clearEventDetails;
window.setupEventForm = setupEventForm;
window.setupPhotoUpload = setupPhotoUpload;
window.handleImageFile = handleImageFile;
window.fileToBase64 = fileToBase64;
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
window.togglePastEvents = togglePastEvents;
window.getCurrentAuthenticatedUser = getCurrentAuthenticatedUser;
window.isUserAuthenticated = isUserAuthenticated;

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

console.log('✅ Enhanced manager system loaded with RSVP sync functionality and username auth support');
