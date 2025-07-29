/**
 * EventCall UI Components
 * Handles rendering of dashboard, invite pages, and other UI components
 */

class UIComponents {
    constructor() {
        this.renderCache = new Map();
        this.lastRenderTime = 0;
    }

    /**
     * Render the main dashboard
     */
    renderDashboard() {
        const eventsList = document.getElementById('events-list');
        const allEvents = window.events || {};
        const eventIds = Object.keys(allEvents);

        if (eventIds.length === 0) {
            eventsList.innerHTML = this.renderEmptyDashboard();
            return;
        }

        // Sort events by creation date (newest first)
        const sortedEvents = eventIds
            .map(id => allEvents[id])
            .sort((a, b) => b.created - a.created);

        let html = '';
        sortedEvents.forEach(event => {
            html += this.renderEventCard(event);
        });

        eventsList.innerHTML = html;
        this.lastRenderTime = Date.now();
    }

    /**
     * Render empty dashboard state
     * @returns {string} HTML content
     */
    renderEmptyDashboard() {
        return `
            <div style="text-align: center; padding: 3rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">🎯</div>
                <h3 style="color: var(--semper-navy); margin-bottom: 1rem;">Ready for Your First Mission?</h3>
                <p style="margin-bottom: 2rem; color: #6b7280; max-width: 400px; margin-left: auto; margin-right: auto;">
                    ${MESSAGES.info.firstEvent}
                </p>
                <button class="btn" onclick="showPage('create')">🚀 Create First Event</button>
                
                <div style="margin-top: 2rem; padding: 1rem; background: var(--gray-50); border-radius: 0.5rem; font-size: 0.875rem; color: #6b7280;">
                    <strong>💡 Quick Tip:</strong> EventCall automatically syncs your events to the cloud, 
                    so you can access them from any device and your guests can RSVP from anywhere.
                </div>
            </div>
        `;
    }

    /**
     * Render individual event card
     * @param {Object} event - Event data
     * @returns {string} HTML content
     */
    renderEventCard(event) {
        const allResponses = window.responses || {};
        const eventResponses = allResponses[event.id] || [];
        const stats = calculateEventStats(eventResponses);
        const timeUntil = getTimeUntilEvent(event.date, event.time);
        const isPast = isEventInPast(event.date, event.time);

        return `
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
                
                ${this.renderEventStats(stats, event.allowGuests)}
                
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
                    <button class="btn" onclick="eventManager.showEventManagement('${event.id}')">📊 Manage</button>
                    <button class="btn" onclick="copyInviteLink('${event.id}')">🔗 Copy Link</button>
                    <button class="btn btn-success" onclick="exportEventData('${event.id}')">📥 Export</button>
                    ${!isPast ? `<button class="btn" onclick="eventManager.duplicateEvent('${event.id}')">📋 Duplicate</button>` : ''}
                    <button class="btn btn-danger" onclick="deleteEvent('${event.id}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    }

    /**
     * Render event statistics
     * @param {Object} stats - Event statistics
     * @param {boolean} allowGuests - Whether guests are allowed
     * @returns {string} HTML content
     */
    renderEventStats(stats, allowGuests = false) {
        return `
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
                ${allowGuests ? `
                    <div class="stat">
                        <div class="stat-number" style="color: var(--semper-red);">${stats.totalGuests}</div>
                        <div class="stat-label">👥 Additional Guests</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Show invite page for an event
     * @param {string} eventId - Event ID
     */
    showInvite(eventId) {
        let event = getEventFromURL() || events[eventId];
        
        // Hide navigation for guest view
        document.querySelector('.nav').style.display = 'none';
        
        if (!event) {
            document.getElementById('invite-content').innerHTML = this.renderInviteError();
            showPage('invite');
            return;
        }

        document.getElementById('invite-content').innerHTML = this.renderInviteContent(event, eventId);
        showPage('invite');

        // Setup real-time validation
        rsvpHandler.setupRealTimeValidation();
        
        // Pre-fill form if URL parameters exist
        rsvpHandler.prefillFormFromURL();
    }

    /**
     * Render invite error page
     * @returns {string} HTML content
     */
    renderInviteError() {
        return `
            <div class="invite-error">
                <h2>❌ Event Not Found</h2>
                <p>This invite link may be invalid or the event may have been deleted.</p>
                <p class="invite-error-note">
                    Please contact the event organizer for assistance.
                </p>
                <div style="margin-top: 2rem;">
                    <button class="btn" onclick="window.location.href = window.location.origin + window.location.pathname">
                        🏠 Go to EventCall Home
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render invite content
     * @param {Object} event - Event data
     * @param {string} eventId - Event ID
     * @returns {string} HTML content
     */
    renderInviteContent(event, eventId) {
        const isPast = isEventInPast(event.date, event.time);
        const timeUntil = getTimeUntilEvent(event.date, event.time);

        if (isPast) {
            return this.renderPastEventInvite(event);
        }

        return `
            <div class="${event.coverImage ? 'invite-display-split' : 'invite-display'}">
                ${event.coverImage ? this.renderInviteWithImage(event, eventId) : this.renderInviteWithoutImage(event, eventId)}
            </div>
        `;
    }

    /**
     * Render past event invite
     * @param {Object} event - Event data
     * @returns {string} HTML content
     */
    renderPastEventInvite(event) {
        return `
            <div class="invite-display">
                <div class="invite-header">
                    <h2 style="text-align: center; color: white;">Event Information</h2>
                </div>
                <div class="invite-content">
                    <h1 class="invite-title">${event.title}</h1>
                    <div style="text-align: center; margin-bottom: 2rem; padding: 1rem; background: #fef3c7; border-radius: 0.5rem; border-left: 4px solid var(--semper-gold);">
                        <strong style="color: var(--error-color);">⏰ This event has already taken place</strong><br>
                        <span style="font-size: 0.875rem; color: #6b7280;">RSVPs are no longer being accepted</span>
                    </div>
                    <div class="invite-details">
                        <div class="invite-detail">
                            <strong>📅 Date:</strong> ${formatDate(event.date)}
                        </div>
                        <div class="invite-detail">
                            <strong>🕐 Time:</strong> ${formatTime(event.time)}
                        </div>
                        ${event.location ? `
                            <div class="invite-detail">
                                <strong>📍 Location:</strong> ${event.location}
                            </div>
                        ` : ''}
                        ${event.description ? `
                            <div class="invite-detail">
                                <strong>📝 Details:</strong> ${event.description}
                            </div>
                        ` : ''}
                    </div>
                    ${this.renderInvitePoweredBy()}
                </div>
            </div>
        `;
    }

    /**
     * Render invite with cover image
     * @param {Object} event - Event data
     * @param {string} eventId - Event ID
     * @returns {string} HTML content
     */
    renderInviteWithImage(event, eventId) {
        return `
            <div class="invite-image-section" style="--bg-image: url('${event.coverImage}')">
                <img src="${event.coverImage}" alt="Event cover" class="invite-image">
            </div>
            <div class="invite-details-section">
                <h1 class="invite-title-main">${event.title}</h1>
                <div class="invite-details">
                    <div class="invite-detail">
                        <strong>📅 Date:</strong> ${formatDate(event.date)}
                    </div>
                    <div class="invite-detail">
                        <strong>🕐 Time:</strong> ${formatTime(event.time)}
                    </div>
                    ${event.location ? `
                        <div class="invite-detail">
                            <strong>📍 Location:</strong> ${event.location}
                        </div>
                    ` : ''}
                    ${event.description ? `
                        <div class="invite-detail">
                            <strong>📝 Details:</strong> ${event.description}
                        </div>
                    ` : ''}
                </div>
                ${this.renderRSVPForm(event, eventId)}
                ${this.renderInvitePoweredBy()}
            </div>
        `;
    }

    /**
     * Render invite without cover image
     * @param {Object} event - Event data
     * @param {string} eventId - Event ID
     * @returns {string} HTML content
     */
    renderInviteWithoutImage(event, eventId) {
        return `
            <div class="invite-header">
                <h2 style="text-align: center;">You're Invited!</h2>
            </div>
            <div class="invite-content">
                <h1 class="invite-title">${event.title}</h1>
                <div class="invite-details">
                    <div class="invite-detail">
                        <strong>📅 Date:</strong> ${formatDate(event.date)}
                    </div>
                    <div class="invite-detail">
                        <strong>🕐 Time:</strong> ${formatTime(event.time)}
                    </div>
                    ${event.location ? `
                        <div class="invite-detail">
                            <strong>📍 Location:</strong> ${event.location}
                        </div>
                    ` : ''}
                    ${event.description ? `
                        <div class="invite-detail">
                            <strong>📝 Details:</strong> ${event.description}
                        </div>
                    ` : ''}
                </div>
                ${this.renderRSVPForm(event, eventId)}
                ${this.renderInvitePoweredBy()}
            </div>
        `;
    }

    /**
     * Render RSVP form
     * @param {Object} event - Event data
     * @param {string} eventId - Event ID
     * @returns {string} HTML content
     */
    renderRSVPForm(event, eventId) {
        return `
            <div class="rsvp-form">
                <h3>RSVP</h3>
                <form id="rsvp-form" onsubmit="handleRSVP(event, '${eventId}')">
                    <div class="form-group">
                        <label for="rsvp-name">Full Name *</label>
                        <input type="text" id="rsvp-name" required placeholder="Enter your full name">
                    </div>

                    <div class="form-group">
                        <label for="rsvp-email">Email Address *</label>
                        <input type="email" id="rsvp-email" required placeholder="your.email@example.com">
                    </div>

                    <div class="form-group">
                        <label for="rsvp-phone">Phone Number</label>
                        <input type="tel" id="rsvp-phone" placeholder="(555) 123-4567">
                    </div>
                    
                    ${event.askReason ? `
                        <div class="form-group">
                            <label for="reason">Why are you attending? (Optional)</label>
                            <textarea id="reason" placeholder="Share your thoughts..." rows="3"></textarea>
                        </div>
                    ` : ''}
                    
                    ${this.renderCustomQuestions(event.customQuestions || [])}
                    
                    <div style="margin-bottom: 1.5rem;">
                        <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Will you be attending? *</label>
                        <div style="display: flex; gap: 1rem;">
                            <label class="rsvp-radio-option">
                                <input type="radio" name="attending" value="true" required>
                                <span>✅ Yes, I'll be there!</span>
                            </label>
                            <label class="rsvp-radio-option">
                                <input type="radio" name="attending" value="false" required>
                                <span>❌ Can't make it</span>
                            </label>
                        </div>
                    </div>

                    ${event.allowGuests ? `
                        <div class="form-group" id="guest-count-group" style="display: none;">
                            <label for="guest-count">How many additional guests will you bring?</label>
                            <select id="guest-count">
                                <option value="0">Just me</option>
                                <option value="1">+1 guest</option>
                                <option value="2">+2 guests</option>
                                <option value="3">+3 guests</option>
                                <option value="4">+4 guests</option>
                                <option value="5">+5 guests</option>
                            </select>
                        </div>
                    ` : ''}
                    
                    <div style="text-align: center; margin-top: 1.5rem;">
                        <button type="submit" class="btn">📝 Submit RSVP</button>
                    </div>
                </form>
            </div>
        `;
    }

    /**
     * Render custom questions
     * @param {Array} customQuestions - Custom questions array
     * @returns {string} HTML content
     */
    renderCustomQuestions(customQuestions) {
        if (!customQuestions || customQuestions.length === 0) {
            return '';
        }

        return customQuestions.map(q => `
            <div class="form-group">
                <label for="${q.id}">${q.question}</label>
                <textarea id="${q.id}" placeholder="Your answer..." rows="3"></textarea>
            </div>
        `).join('');
    }

    /**
     * Render powered by footer
     * @returns {string} HTML content
     */
    renderInvitePoweredBy() {
        return `
            <div class="invite-powered-by">
                <div class="powered-by-text">Powered by</div>
                <a href="https://linktr.ee/semperadmin" target="_blank" class="powered-by-link">
                    SEMPER ADMIN
                </a>
            </div>
        `;
    }

    /**
     * Render loading state
     * @param {string} message - Loading message
     * @returns {string} HTML content
     */
    renderLoadingState(message = 'Loading...') {
        return `
            <div style="display: flex; align-items: center; justify-content: center; padding: 3rem;">
                <div class="loading">
                    <div class="spinner"></div>
                    ${message}
                </div>
            </div>
        `;
    }

    /**
     * Render error state
     * @param {string} message - Error message
     * @param {string} action - Optional action button text
     * @param {Function} actionCallback - Optional action callback
     * @returns {string} HTML content
     */
    renderErrorState(message, action = null, actionCallback = null) {
        return `
            <div style="text-align: center; padding: 3rem; color: var(--error-color);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3>Something went wrong</h3>
                <p style="margin: 1rem 0; color: var(--text-color);">${message}</p>
                ${action ? `<button class="btn" onclick="${actionCallback || 'location.reload()'}">${action}</button>` : ''}
            </div>
        `;
    }

    /**
     * Update event card in place
     * @param {string} eventId - Event ID
     */
    updateEventCard(eventId) {
        const allEvents = window.events || {};
        const event = allEvents[eventId];
        if (!event) return;

        const eventCard = document.querySelector(`.event-card[data-event-id="${eventId}"]`);
        if (eventCard) {
            eventCard.outerHTML = this.renderEventCard(event);
        }
    }

    /**
     * Animate element entrance
     * @param {Element} element - Element to animate
     * @param {string} animation - Animation type
     */
    animateEntrance(element, animation = 'fadeIn') {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'all 0.3s ease';
        
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    }

    /**
     * Show/hide guest count based on attendance selection
     */
    setupAttendanceToggle() {
        document.addEventListener('change', (e) => {
            if (e.target.name === 'attending') {
                const guestCountGroup = document.getElementById('guest-count-group');
                if (guestCountGroup) {
                    if (e.target.value === 'true') {
                        guestCountGroup.style.display = 'block';
                        this.animateEntrance(guestCountGroup);
                    } else {
                        guestCountGroup.style.display = 'none';
                        const guestCountSelect = document.getElementById('guest-count');
                        if (guestCountSelect) {
                            guestCountSelect.value = '0';
                        }
                    }
                }
            }
        });
    }

    /**
     * Initialize UI components
     */
    initialize() {
        this.setupAttendanceToggle();
        console.log('UI Components initialized');
    }
}

// Create global instance
const uiComponents = new UIComponents();

// Make functions available globally
window.uiComponents = uiComponents;
window.renderDashboard = () => uiComponents.renderDashboard();
window.showInvite = (eventId) => uiComponents.showInvite(eventId);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    uiComponents.initialize();
});