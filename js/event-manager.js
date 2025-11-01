/**
 * EventCall Event Management - Enhanced with Sync Integration
 * Handles event creation, editing, management, and RSVP sync functionality
 */

class EventManager {
    constructor() {
        this.currentEvent = null;
        this.editMode = false;
    }
    
    /**
     * Get invite roster for an event from localStorage
     * @param {string} eventId - Event ID
     * @returns {Array} Roster of invited people
     */
    getInviteRoster(eventId) {
        const key = `eventcall_invite_roster_${eventId}`;
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn('Failed to load roster:', e);
            return [];
        }
    }

    /**
     * Show event management page with sync functionality
     * @param {string} eventId - Event ID
     */
    async showEventManagement(eventId) {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];
        
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        this.currentEvent = event;
        const stats = calculateEventStats(eventResponses);

        let responseTableHTML = '';
        if (eventResponses.length > 0) {
            responseTableHTML = this.generateResponseTable(event, eventResponses, stats);
        } else {
            responseTableHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-color);">
                    <h3 style="color: var(--semper-navy);">ðŸ“­ No RSVPs Yet</h3>
                    <p>No RSVPs yet. Share your invite link to start collecting responses!</p>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-success" onclick="syncWithGitHub()" style="margin-right: 0.5rem;">
                            🔗„ Check for New RSVPs
                        </button>
                        <button class="btn" onclick="copyInviteLink('${eventId}')">
                            🔗— Share Invite Link
                        </button>
                    </div>
                </div>
            `;
        }

        document.getElementById('event-details').innerHTML = this.generateEventDetailsHTML(event, eventId, responseTableHTML);
        showPage('manage');
        
        const targetHash = `#manage/${eventId}`;
        if (window.location.hash !== targetHash) {
            setTimeout(() => {
                if (window.location.hash !== targetHash) {
                    window.location.hash = targetHash;
                }
            }, 0);
        }
    }

    /**
     * Generate event details HTML with enhanced sync controls
     * @param {Object} event - Event data
     * @param {string} eventId - Event ID
     * @param {string} responseTableHTML - Response table HTML
     * @returns {string} HTML content
     */
    /**
 * Generate Mission Control event details HTML - V2 Improved Design
 * Paste this function into event-manager.js to replace the existing generateEventDetailsHTML
 */

generateEventDetailsHTML(event, eventId, responseTableHTML) {
    const inviteURL = generateInviteURL(event);
    const timeUntil = getTimeUntilEvent(event.date, event.time);
    const isPast = isEventInPast(event.date, event.time);
    const eventResponses = window.responses ? window.responses[eventId] || [] : [];
    const stats = calculateEventStats(eventResponses);
    
    // Get invite roster data
    const roster = this.getInviteRoster(eventId);
    const rosterEmails = new Set((roster || []).map(i => i.email?.toLowerCase().trim()).filter(Boolean));
    const respondedEmails = new Set(eventResponses.filter(r => r.email).map(r => r.email.toLowerCase().trim()));
    const invitedTotal = roster.length;
    const respondedFromRoster = [...respondedEmails].filter(e => rosterEmails.has(e)).length;
    const pendingFromRoster = Math.max(invitedTotal - respondedFromRoster, 0);
    const unlistedResponses = [...respondedEmails].filter(e => !rosterEmails.has(e)).length;
    
    // XSS Protection helper
    const h = window.utils.escapeHTML;
    
    // Calculate response rate
    const responseRate = eventResponses.length > 0 
        ? Math.round(((stats.attending + stats.notAttending) / eventResponses.length) * 100)
        : 0;
    
    // Calculate pending (people who viewed but haven't responded)
    const pending = eventResponses.length - (stats.attending + stats.notAttending);
    
    // Get last RSVP time
    const lastRSVP = eventResponses.length > 0 
        ? new Date(Math.max(...eventResponses.map(r => r.timestamp || 0)))
        : null;
    const lastRSVPText = lastRSVP 
        ? formatRelativeTime(lastRSVP.getTime())
        : 'No RSVPs yet';

    return `
        <div class="mission-control-container">
            <!-- Header -->
            <div class="mission-control-header">
                <div class="mission-control-title">
                    <h1>${h(event.title)}</h1>
                    <div class="mission-control-subtitle">
                        ${isPast ? '🔴 Past Event' : '🟢 Active Event'} • Created ${formatRelativeTime(event.created)}
                    </div>
                </div>
                <div class="mission-control-actions">
                    <button class="btn-back" onclick="showPage('dashboard')">
                        ← Back to Dashboard
                    </button>
                    <button class="btn-edit" onclick="eventManager.editEvent('${eventId}')">
                        ⚙️ Edit
                    </button>
                </div>
            </div>

            <!-- Event Overview -->
            <div class="event-overview-section">
                <div class="event-overview-grid">
                    <div class="event-details-left">
                        <div class="event-meta-grid">
                            <div class="meta-item-v2">
                                <span class="meta-icon-v2">📅</span>
                                <div class="meta-content">
                                    <div class="meta-label">Date</div>
                                    <div class="meta-value">${formatDate(event.date)}</div>
                                </div>
                            </div>
                            <div class="meta-item-v2">
                                <span class="meta-icon-v2">⏰</span>
                                <div class="meta-content">
                                    <div class="meta-label">Time</div>
                                    <div class="meta-value">${formatTime(event.time)}</div>
                                </div>
                            </div>
                            <div class="meta-item-v2">
                                <span class="meta-icon-v2">📍</span>
                                <div class="meta-content">
                                    <div class="meta-label">Location</div>
                                    <div class="meta-value">${h(event.location) || 'Not specified'}</div>
                                </div>
                            </div>
                            <div class="meta-item-v2">
                                <span class="meta-icon-v2">${isPast ? '⏱️' : '⏳'}</span>
                                <div class="meta-content">
                                    <div class="meta-label">${isPast ? 'Status' : 'Time Until'}</div>
                                    <div class="meta-value">${isPast ? 'Event Passed' : h(timeUntil)}</div>
                                </div>
                            </div>
                        </div>
                        ${event.description ? `
                            <div class="meta-item-v2" style="grid-column: 1 / -1;">
                                <span class="meta-icon-v2">📝</span>
                                <div class="meta-content">
                                    <div class="meta-label">Description</div>
                                    <div class="meta-value">${h(event.description)}</div>
                                </div>
                            </div>
                        ` : ''}
                        ${(event.askReason || event.allowGuests || event.requiresMealChoice) ? `
                            <div class="meta-item-v2" style="grid-column: 1 / -1;">
                                <span class="meta-icon-v2">⚙️</span>
                                <div class="meta-content">
                                    <div class="meta-label">RSVP Settings</div>
                                    <div class="meta-value">
                                        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                                            ${event.askReason ? `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .5rem;border-radius:999px;background:#e0f2fe;color:#0c4a6e;border:1px solid #7dd3fc;">💬 Ask why attending</span>` : ''}
                                            ${event.allowGuests ? `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .5rem;border-radius:999px;background:#f0fdf4;color:#064e3b;border:1px solid #86efac;">👥 Allow additional guests</span>` : ''}
                                            ${event.requiresMealChoice ? `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .5rem;border-radius:999px;background:#fff7ed;color:#7c2d12;border:1px solid #fdba74;">🍽️ Meal/dietary choices required</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        ${event.eventDetails && Object.keys(event.eventDetails).length ? `
                            <div class="meta-item-v2" style="grid-column: 1 / -1;">
                                <span class="meta-icon-v2">ℹ️</span>
                                <div class="meta-content">
                                    <div class="meta-label">Event Details</div>
                                    <div class="meta-value">
                                        ${createEventDetailsHTML(event.eventDetails)}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    ${event.coverImage ? `
                        <div class="event-cover-large">
                            <img src="${h(event.coverImage)}" alt="${h(event.title)}">
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- RSVP Dashboard -->
            <div class="rsvp-dashboard-section">
                <h2 class="rsvp-dashboard-title">📊 RSVP Dashboard</h2>
                
                <!-- Big Stat Cards -->
                <div class="rsvp-stats-cards">
                    <div class="stat-card-large stat-card-headcount">
                        <div class="stat-card-icon">👥</div>
                        <div class="stat-card-number">${stats.totalHeadcount}</div>
                        <div class="stat-card-label">Total Headcount</div>
                        ${event.allowGuests ? `
                            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem; font-weight: 500;">
                                ${stats.attending} attendees + ${stats.attendingWithGuests} guests
                            </div>
                        ` : ''}
                    </div>
                    <div class="stat-card-large stat-card-attending">
                        <div class="stat-card-icon">✅</div>
                        <div class="stat-card-number">${stats.attending}</div>
                        <div class="stat-card-label">Attending</div>
                    </div>
                    <div class="stat-card-large stat-card-declined">
                        <div class="stat-card-icon">❌</div>
                        <div class="stat-card-number">${stats.notAttending}</div>
                        <div class="stat-card-label">Declined</div>
                    </div>
                    <div class="stat-card-large stat-card-pending">
                        <div class="stat-card-icon">⏳</div>
                        <div class="stat-card-number">${pending}</div>
                        <div class="stat-card-label">Pending</div>
                    </div>
                </div>

                <!-- Response Rate Progress -->
                <div class="response-rate-section">
                    <div class="response-rate-header">
                        <span class="response-rate-label">Response Rate</span>
                        <span class="response-rate-value">${responseRate}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${responseRate}%">
                            ${responseRate > 10 ? `<span class="progress-bar-text">${responseRate}%</span>` : ''}
                        </div>
                    </div>
                    <div class="last-rsvp-info">
                        Last RSVP: ${lastRSVPText}
                    </div>
                </div>

                <!-- Invite Roster Baseline -->
                <div class="rsvp-stats-cards">
                    <div class="stat-card-large stat-card-headcount">
                        <div class="stat-card-icon">📧</div>
                        <div class="stat-card-number">${invitedTotal}</div>
                        <div class="stat-card-label">Invited</div>
                    </div>
                    <div class="stat-card-large stat-card-attending">
                        <div class="stat-card-icon">✅</div>
                        <div class="stat-card-number">${respondedFromRoster}</div>
                        <div class="stat-card-label">Responded</div>
                    </div>
                    <div class="stat-card-large stat-card-pending">
                        <div class="stat-card-icon">⏳</div>
                        <div class="stat-card-number">${pendingFromRoster}</div>
                        <div class="stat-card-label">Pending</div>
                    </div>
                    <div class="stat-card-large stat-card-declined">
                        <div class="stat-card-icon">🧾</div>
                        <div class="stat-card-number">${unlistedResponses}</div>
                        <div class="stat-card-label">Unlisted Responses</div>
                    </div>
                </div>

                <!-- Invite Roster Import -->
                <div class="invite-link-section">
                    <h3 class="invite-link-title">📥 Invite Roster</h3>
                    <div class="invite-link-actions" style="margin-bottom: 0.75rem;">
                        <input type="file"
                               id="roster-import-file-${eventId}"
                               accept=".csv"
                               style="display:none"
                               onchange="window.csvImporter.handleRosterUpload(event, '${eventId}')">
                        <button class="btn-action" onclick="document.getElementById('roster-import-file-${eventId}').click()">
                            📤 Upload Roster CSV
                        </button>
                        <a href="#" onclick="window.csvImporter.downloadTemplate(); return false;" style="margin-left: 0.75rem; color: #60a5fa;">
                            Download CSV Template
                        </a>
                    </div>
                    <div id="roster-import-preview"></div>
                </div>

                <!-- Dashboard Actions -->
                <div class="dashboard-actions">
                    <button class="btn-action btn-sync" onclick="syncWithGitHub()">
                        🔄 Sync RSVPs
                    </button>
                    <button class="btn-action btn-reminder" onclick="eventManager.showReminderOptionsModal('${eventId}')">
                        ✉️ Send Reminders
                    </button>
                    <button class="btn-action btn-export" onclick="calendarExport.exportEvent('${eventId}')">
                        📤 Export
                    </button>
                </div>
            </div>

            <!-- Invite Link -->
            <div class="invite-link-section">
                <h3 class="invite-link-title">🔗 Invite Link</h3>
                <div class="invite-link-input-wrapper">
                    <input 
                        type="text" 
                        class="invite-link-input" 
                        value="${inviteURL}" 
                        readonly 
                        onclick="this.select()" 
                        id="invite-link-input"
                    >
                </div>
                <div class="invite-link-actions">
                    <button class="btn-action" onclick="eventManager.copyInviteLink('${eventId}')">
                        📋 Copy Link
                    </button>
                    <button class="btn-action" onclick="alert('Email link feature coming soon!')">
                        📧 Email Link
                    </button>
                </div>
            </div>

            ${event.seatingChart && event.seatingChart.enabled ? this.generateSeatingChartSection(event, eventId, eventResponses) : ''}

            <!-- Attendee List -->
            <div class="attendee-list-section">
                <div class="attendee-list-header">
                    <h3 class="attendee-list-title">📋 Attendee List (${eventResponses.length + roster.filter(r => r.email && !respondedEmails.has(r.email.toLowerCase().trim())).length})</h3>
                    <div class="attendee-controls">
                        <input
                            type="text"
                            class="search-input"
                            placeholder="🔍 Search attendees..."
                            id="attendee-search"
                            oninput="eventManager.filterAttendees()"
                        >
                        <select class="filter-select" id="attendee-filter" onchange="eventManager.filterAttendees()">
                            <option value="all">All People</option>
                            <option value="attending">Attending Only</option>
                            <option value="declined">Declined Only</option>
                            <option value="invited">Invited Only</option>
                        </select>
                    </div>
                </div>

                ${this.generateAttendeeCards(eventResponses, eventId)}
            </div>
        </div>
    `;
}

    /**
     * Send email reminder to event attendees
     * @param {string} eventId - Event ID
     */
    async sendEventReminder(eventId) {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];
        
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        if (!window.githubAPI || !window.githubAPI.hasToken()) {
            showToast('🔐 GitHub token required to send email reminders', 'error');
            return;
        }

        // Show reminder options modal
        const reminderType = await this.showReminderOptionsModal(event, eventResponses);
        if (!reminderType) return; // User cancelled

        try {
            showToast('📧 Sending email reminders...', 'info');

            // Filter attendees based on reminder type
            let recipients = [];
            if (reminderType === 'all') {
                recipients = eventResponses.filter(r => r.email);
            } else if (reminderType === 'attending') {
                recipients = eventResponses.filter(r => r.email && r.attending);
            } else if (reminderType === 'pending') {
                recipients = eventResponses.filter(r => r.email && r.attending === undefined);
            }

            if (recipients.length === 0) {
                showToast('No recipients found for the selected reminder type', 'warning');
                return;
            }

            // Calculate days until event
            const eventDate = new Date(`${event.date}T${event.time}`);
            const now = new Date();
            const daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
            const daysText = daysUntil === 1 ? 'tomorrow' : 
                           daysUntil === 0 ? 'today' : 
                           daysUntil > 0 ? `in ${daysUntil} days` : 
                           `${Math.abs(daysUntil)} days ago`;

            // Send reminders via GitHub Actions
            let successCount = 0;
            for (const recipient of recipients) {
                try {
                    await this.sendIndividualReminder(event, recipient, daysText);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to send reminder to ${recipient.email}:`, error);
                }
            }

            if (successCount > 0) {
                showToast(`✅ Sent ${successCount} reminder email${successCount > 1 ? 's' : ''}`, 'success');
            } else {
                showToast('❌ Failed to send reminder emails', 'error');
            }

        } catch (error) {
            console.error('Failed to send reminders:', error);
            showToast('Failed to send reminders: ' + error.message, 'error');
        }
    }

    /**
     * Show reminder options modal
     * @param {Object} event - Event data
     * @param {Array} eventResponses - Event responses
     * @returns {Promise<string|null>} Selected reminder type or null if cancelled
     */
    async showReminderOptionsModal(event, eventResponses) {
        const h = window.utils.escapeHTML;
        const stats = calculateEventStats(eventResponses);
        
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>📧 Send Event Reminder</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove(); resolve(null);">×</button>
                    </div>
                    <div class="modal-body">
                        <p>Send reminder emails for: <strong>${h(event.title)}</strong></p>
                        <p>Event Date: <strong>${formatDate(event.date)} at ${formatTime(event.time)}</strong></p>
                        
                        <div style="margin: 1.5rem 0;">
                            <h4>Who should receive reminders?</h4>
                            <div class="reminder-options">
                                <label class="reminder-option">
                                    <input type="radio" name="reminderType" value="attending" checked>
                                    <span>Attending Only (${stats.attending} people)</span>
                                </label>
                                <label class="reminder-option">
                                    <input type="radio" name="reminderType" value="all">
                                    <span>All RSVPs (${eventResponses.filter(r => r.email).length} people)</span>
                                </label>
                                <label class="reminder-option">
                                    <input type="radio" name="reminderType" value="pending">
                                    <span>Pending Responses (${eventResponses.filter(r => r.email && r.attending === undefined).length} people)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove(); resolve(null);">Cancel</button>
                        <button class="btn btn-primary" onclick="
                            const selected = this.closest('.modal-content').querySelector('input[name=reminderType]:checked').value;
                            this.closest('.modal-overlay').remove();
                            resolve(selected);
                        ">Send Reminders</button>
                    </div>
                </div>
            `;

            // Add styles for reminder options
            const style = document.createElement('style');
            style.textContent = `
                .reminder-options {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .reminder-option {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .reminder-option:hover {
                    background-color: #f9fafb;
                    border-color: #d1d5db;
                }
                .reminder-option input[type="radio"] {
                    margin: 0;
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(modal);

            // Override resolve function in modal context
            modal.querySelector('.modal-content').resolve = resolve;
        });
    }

    /**
     * Send individual reminder email via GitHub Actions
     * @param {Object} event - Event data
     * @param {Object} recipient - Recipient data
     * @param {string} daysText - Days until event text
     */
    async sendIndividualReminder(event, recipient, daysText) {
        const h = window.utils.escapeHTML;
        
        // Create email content using the template structure
        const emailSubject = `⏰ Reminder: ${event.title} - ${daysText}`;
        const emailBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Event Reminder</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <tr>
                                    <td style="background: linear-gradient(135deg, #0f1419, #1f2937); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                        <h1 style="color: #ffd700; margin: 0; font-size: 28px;">EventCall</h1>
                                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Where Every Event Matters</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <h2 style="color: #0f1419; margin: 0 0 20px 0;">⏰ Event Reminder</h2>
                                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                            Hello <strong>${h(recipient.name || 'there')}</strong>,
                                        </p>
                                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                            This is a friendly reminder that you have an upcoming event <strong>${h(daysText)}</strong>:
                                        </p>
                                        <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
                                            <tr>
                                                <td>
                                                    <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📅 Event Details</h3>
                                                    <p style="margin: 5px 0; color: #374151;"><strong>Event:</strong> ${h(event.title)}</p>
                                                    <p style="margin: 5px 0; color: #374151;"><strong>Date:</strong> ${formatDate(event.date)}</p>
                                                    <p style="margin: 5px 0; color: #374151;"><strong>Time:</strong> ${formatTime(event.time)}</p>
                                                    ${event.location ? `<p style="margin: 5px 0; color: #374151;"><strong>Location:</strong> ${h(event.location)}</p>` : ''}
                                                </td>
                                            </tr>
                                        </table>
                                        ${recipient.attending ? `
                                            <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #dcfce7; border-left: 4px solid #16a34a; border-radius: 4px; margin: 20px 0;">
                                                <tr>
                                                    <td>
                                                        <h3 style="color: #166534; margin: 0 0 10px 0;">✅ Your RSVP Status</h3>
                                                        <p style="margin: 0; color: #374151;">You are <strong>attending</strong> this event.</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        ` : recipient.attending === false ? `
                                            <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #fee2e2; border-left: 4px solid #dc2626; border-radius: 4px; margin: 20px 0;">
                                                <tr>
                                                    <td>
                                                        <h3 style="color: #991b1b; margin: 0 0 10px 0;">❌ Your RSVP Status</h3>
                                                        <p style="margin: 0; color: #374151;">You indicated you will <strong>not be attending</strong> this event.</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        ` : `
                                            <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
                                                <tr>
                                                    <td>
                                                        <h3 style="color: #92400e; margin: 0 0 10px 0;">⏳ RSVP Needed</h3>
                                                        <p style="margin: 0; color: #374151;">Please respond to let us know if you'll be attending.</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        `}
                                        <div style="text-align: center; margin: 30px 0;">
                                            <a href="${generateInviteURL(event)}" style="display: inline-block; background: linear-gradient(135deg, #0f1419, #1f2937); color: #ffd700; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                                                View Event Details
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
                                        <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                            Powered by <strong>EventCall</strong> - Where Every Event Matters
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        // Trigger GitHub Actions workflow
        const payload = {
            to: recipient.email,
            subject: emailSubject,
            body: emailBody.replace(/\n\s+/g, ' ').replace(/"/g, '\\"'),
            type: 'event_reminder',
            event_id: event.id,
            event_title: event.title
        };

        await window.githubAPI.triggerWorkflow('send_email', payload);
    }

    /**
     * Generate and display QR code for event invite link
     * @param {string} eventId - Event ID
     */
    async generateEventQRCode(eventId) {
        const event = window.events ? window.events[eventId] : null;
        
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        if (!window.QRCode) {
            showToast('QR Code library not loaded', 'error');
            return;
        }

        try {
            showToast('📱 Generating QR code...', 'info');

            // Generate invite URL
            const inviteURL = generateInviteURL(event);
            
            // Generate QR code
            const qrDataURL = await QRCode.toDataURL(inviteURL, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#0f1419',
                    light: '#ffffff'
                },
                errorCorrectionLevel: 'M'
            });

            // Show QR code modal
            this.showQRCodeModal(event, inviteURL, qrDataURL);

        } catch (error) {
            console.error('QR Code generation failed:', error);
            showToast('Failed to generate QR code: ' + error.message, 'error');
        }
    }

    /**
     * Show QR code modal with sharing options
     * @param {Object} event - Event data
     * @param {string} inviteURL - Event invite URL
     * @param {string} qrDataURL - QR code data URL
     */
    showQRCodeModal(event, inviteURL, qrDataURL) {
        const h = window.utils.escapeHTML;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title" tabindex="0" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 id="qr-modal-title">📱 Event QR Code</h3>
                    <button id="qr-close-btn" class="modal-close" aria-label="Close QR code modal">×</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <h4 style="margin: 0 0 1rem 0; color: #374151;">${h(event.title)}</h4>
                    <p style="color: #6b7280; margin: 0 0 1.5rem 0; font-size: 14px;">
                        Scan this QR code to quickly access the event RSVP page
                    </p>
                    
                    <div class="qr-code-container" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 0 0 1.5rem 0; display: inline-block;">
                        <img src="${qrDataURL}" alt="Event QR Code" style="display: block; max-width: 100%; height: auto;">
                    </div>
                    
                    <div class="qr-actions" style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <button id="qr-download-btn" class="btn btn-primary" aria-label="Download QR code image">
                            💾 Download QR Code
                        </button>
                        <button id="qr-copy-link-btn" class="btn btn-secondary" aria-label="Copy event invite link">
                            🔗 Copy Invite Link
                        </button>
                        <button id="qr-share-btn" class="btn btn-secondary" aria-label="Share event invite">
                            📤 Share Event
                        </button>
                    </div>
                    
                    <div class="qr-info" style="margin-top: 1.5rem; padding: 1rem; background-color: #f9fafb; border-radius: 8px; text-align: left;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #374151; font-size: 14px;">💡 How to use:</h5>
                        <ul style="margin: 0; padding-left: 1.25rem; color: #6b7280; font-size: 13px; line-height: 1.5;">
                            <li>Print and display at your event location</li>
                            <li>Share digitally via social media or messaging</li>
                            <li>Include in event flyers or promotional materials</li>
                            <li>Guests can scan to instantly access RSVP form</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="qr-close-footer-btn" class="btn btn-secondary" aria-label="Close modal">Close</button>
                </div>
            </div>
        `;

        // Add QR modal styles
        const style = document.createElement('style');
        style.textContent = `
            .qr-modal .modal-body { padding: 1.5rem; }
            .qr-actions .btn { width: 100%; justify-content: center; display: flex; align-items: center; gap: 0.5rem; }
            .qr-code-container { transition: transform 0.2s ease; }
            .qr-code-container:hover { transform: scale(1.02); }
        `;
        document.head.appendChild(style);

        document.body.appendChild(modal);

        const dialog = modal.querySelector('.modal-content');
        const closeBtn = modal.querySelector('#qr-close-btn');
        const closeFooterBtn = modal.querySelector('#qr-close-footer-btn');
        const copyBtn = modal.querySelector('#qr-copy-link-btn');
        const downloadBtn = modal.querySelector('#qr-download-btn');
        const shareBtn = modal.querySelector('#qr-share-btn');

        // Focus trap
        const focusableSelectors = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusable = Array.from(dialog.querySelectorAll(focusableSelectors)).filter(el => !el.disabled && el.offsetParent !== null);
        const firstEl = focusable[0] || dialog;
        const lastEl = focusable[focusable.length - 1] || dialog;

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                modal.remove();
            } else if (e.key === 'Tab') {
                if (focusable.length === 0) return;
                if (e.shiftKey && document.activeElement === firstEl) {
                    e.preventDefault();
                    lastEl.focus();
                } else if (!e.shiftKey && document.activeElement === lastEl) {
                    e.preventDefault();
                    firstEl.focus();
                }
            }
        };

        const cleanup = () => {
            dialog.removeEventListener('keydown', onKeyDown, true);
            document.head.removeChild(style);
        };

        // Attach events
        dialog.addEventListener('keydown', onKeyDown, true);
        closeBtn.addEventListener('click', () => { cleanup(); modal.remove(); });
        closeFooterBtn.addEventListener('click', () => { cleanup(); modal.remove(); });
        copyBtn.addEventListener('click', async () => { await this.copyInviteLink(inviteURL); });
        downloadBtn.addEventListener('click', () => { this.downloadQRCode(qrDataURL, event.title); });
        shareBtn.addEventListener('click', async () => { await this.shareQRCode(event.title, inviteURL); });

        // Initial focus
        (copyBtn || firstEl).focus();
    }

    /**
     * Download QR code as PNG image
     * @param {string} qrDataURL - QR code data URL
     * @param {string} eventTitle - Event title for filename
     */
    downloadQRCode(qrDataURL, eventTitle) {
        try {
            const link = document.createElement('a');
            link.download = `${eventTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qr_code.png`;
            link.href = qrDataURL;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('✅ QR code downloaded successfully', 'success');
        } catch (error) {
            console.error('Download failed:', error);
            showToast('Failed to download QR code', 'error');
        }
    }

    /**
     * Copy invite link to clipboard
     * @param {string} inviteURL - Event invite URL
     */
    async copyInviteLink(inviteURL) {
        try {
            await navigator.clipboard.writeText(inviteURL);
            showToast('✅ Invite link copied to clipboard', 'success');
        } catch (error) {
            console.error('Copy failed:', error);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = inviteURL;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast('✅ Invite link copied to clipboard', 'success');
            } catch (fallbackError) {
                showToast('Failed to copy link. Please copy manually: ' + inviteURL, 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    /**
     * Share event using Web Share API or fallback
     * @param {string} eventTitle - Event title
     * @param {string} inviteURL - Event invite URL
     */
    async shareQRCode(eventTitle, inviteURL) {
        const shareData = {
            title: `RSVP for ${eventTitle}`,
            text: `You're invited to ${eventTitle}! Please RSVP using the link below.`,
            url: inviteURL
        };

        try {
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
                showToast('✅ Event shared successfully', 'success');
            } else {
                // Fallback: Copy to clipboard and show share options
                await this.copyInviteLink(inviteURL);
                showToast('📋 Link copied! You can now paste it in your preferred app', 'info');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share failed:', error);
                // Fallback to copy
                await this.copyInviteLink(inviteURL);
            }
        }
    }

    /**
     * Generate attendee cards HTML - UPDATED with Email button and Roster Integration
     */
    generateAttendeeCards(eventResponses, eventId) {
        // XSS Protection helper
        const h = window.utils.escapeHTML;

        // Get event for seating chart info
        const event = window.events ? window.events[eventId] : null;
        let seatingChart = null;
        if (event && event.seatingChart && event.seatingChart.enabled) {
            seatingChart = new window.SeatingChart(eventId);
            seatingChart.loadSeatingData(event);
        }

        // Get invite roster
        const roster = this.getInviteRoster(eventId);
        const respondedEmails = new Set(eventResponses.filter(r => r.email).map(r => r.email.toLowerCase().trim()));

        // Create invited-only entries for roster members who haven't responded
        const invitedOnly = roster.filter(invitee =>
            invitee.email && !respondedEmails.has(invitee.email.toLowerCase().trim())
        ).map(invitee => ({
            name: invitee.name || 'Unknown',
            email: invitee.email,
            phone: invitee.phone || '',
            guestCount: invitee.guestCount || 0,
            attending: null, // null indicates "invited but not responded"
            status: 'invited',
            timestamp: null,
            isInvitedOnly: true
        }));

        // Combine responses and invited-only entries
        const allAttendees = [...eventResponses, ...invitedOnly];

        return `
        <div class="attendee-cards" id="attendee-cards-container">
            ${allAttendees.map(response => {
                // Get table assignment if seating chart is enabled
                let tableAssignment = null;
                if (seatingChart && response.rsvpId) {
                    tableAssignment = seatingChart.findGuestAssignment(response.rsvpId);
                }

                return `
                <div class="attendee-card ${response.isInvitedOnly ? 'attendee-invited-only' : ''}"
                     data-name="${(response.name || '').toLowerCase()}"
                     data-status="${response.attending === null ? 'invited' : (response.attending ? 'attending' : 'declined')}"
                     data-branch="${(response.branch || '').toLowerCase()}"
                     data-rank="${(response.rank || '').toLowerCase()}"
                     data-unit="${(response.unit || '').toLowerCase()}"
                     data-email="${(response.email || '').toLowerCase()}"
                     data-phone="${(response.phone || '').toLowerCase()}">
                    <div class="attendee-card-header">
                        <div class="attendee-info">
                            <div class="attendee-name">
                                ${h(response.name) || 'Anonymous'}
                                ${tableAssignment ? `<span class="attendee-table-badge ${tableAssignment.vipTable ? 'vip' : ''}">Table ${tableAssignment.tableNumber}</span>` :
                                  (seatingChart && response.attending ? '<span class="attendee-table-badge unassigned">No Table</span>' : '')}
                            </div>
                            <span class="attendee-status ${
                                response.attending === null ? 'status-invited' :
                                (response.attending ? 'status-attending' : 'status-declined')
                            }">
                                ${response.attending === null ? '📧 Invited' :
                                  (response.attending ? '✅ Attending' : '❌ Declined')}
                            </span>
                        </div>
                    </div>
                    <div class="attendee-details">
                        ${response.email ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">📧</span>
                                <span>${h(response.email)}</span>
                            </div>
                        ` : ''}
                        ${response.phone ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">📱</span>
                                <span>${h(response.phone)}</span>
                            </div>
                        ` : ''}
                        ${response.guestCount > 0 ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">👥</span>
                                <span>+${parseInt(response.guestCount)} guest${response.guestCount > 1 ? 's' : ''}</span>
                            </div>
                        ` : ''}
                        ${response.reason ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">💬</span>
                                <span>${h(response.reason)}</span>
                            </div>
                        ` : ''}
                        ${(response.dietaryRestrictions && response.dietaryRestrictions.length) ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">🍽️</span>
                                <span>${response.dietaryRestrictions.map(r => h(r)).join(', ')}</span>
                            </div>
                        ` : ''}
                        ${response.allergyDetails ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">⚠️</span>
                                <span>${h(response.allergyDetails)}</span>
                            </div>
                        ` : ''}
                        ${response.rank ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">⭐</span>
                                <span>${h(response.rank)}</span>
                            </div>
                        ` : ''}
                        ${response.unit ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">🎖️</span>
                                <span>${h(response.unit)}</span>
                            </div>
                        ` : ''}
                        ${response.branch ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">🪖</span>
                                <span>${response.branch}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- ✅ UPDATED: Actions with Email Button -->
                    <div class="attendee-actions">
                        <button 
                            class="btn-attendee-action" 
                            onclick="alert('Edit feature coming soon!')"
                            title="Edit this RSVP">
                            ✏️ Edit
                        </button>
                        
                        <button 
                            class="btn-attendee-action btn-attendee-action-email" 
                            onclick="mailAttendee('${response.email || ''}', '${this.currentEvent?.title || 'Event'}')"
                            ${!response.email ? 'disabled title="No email address available"' : 'title="Send email to attendee"'}>
                            📧 Email
                        </button>
                        
                        <button 
                            class="btn-attendee-action btn-danger-attendee" 
                            onclick="if(confirm('${response.isInvitedOnly ? 'Remove from invite roster?' : 'Remove this RSVP?'}')) alert('Remove feature coming soon!')"
                            title="${response.isInvitedOnly ? 'Remove from invite roster' : 'Remove this RSVP'}">
                            🗑️ Remove
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    }
    
    /**
     * Hook a "Copy TSV" action into event actions
     * @param {Object} event - Event data
     * @param {Array} responses - RSVP responses
     */
    attachExportActions(event, responses) {
        const copyBtn = document.getElementById('copy-tsv-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                window.earlyFunctions.copyEventDataAsTSV(event, responses);
            });
        }
    }

    /**
     * Filter attendees based on search and filter
     * Add this new function to event-manager.js
     */
    filterAttendees() {
        const searchInput = document.getElementById('attendee-search');
        const filterSelect = document.getElementById('attendee-filter');
        const branchSelect = document.getElementById('filter-branch');
        const rankSelect = document.getElementById('filter-rank');
        const unitInput = document.getElementById('filter-unit');
        const cards = document.querySelectorAll('.attendee-card');
        
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const filterValue = filterSelect?.value || 'all';
        const branchValue = branchSelect?.value || '';
        const rankValue = rankSelect?.value || '';
        const unitValue = unitInput?.value.toLowerCase() || '';
        
        cards.forEach(card => {
            const name = card.dataset.name || '';
            const status = card.dataset.status || '';
            const branch = card.dataset.branch || '';
            const rank = card.dataset.rank || '';
            const unit = card.dataset.unit || '';
            const extra = [
                branch,
                rank,
                unit,
                card.dataset.email || '',
                card.dataset.phone || ''
            ].join(' ');
            
            const matchesSearch = searchTerm === '' || name.includes(searchTerm) || extra.includes(searchTerm);
            const matchesFilter = filterValue === 'all' || status === filterValue;
            const matchesBranch = branchValue === '' || branch === branchValue;
            const matchesRank = rankValue === '' || rank === rankValue;
            const matchesUnit = unitValue === '' || unit.includes(unitValue);
            
            card.style.display = (matchesSearch && matchesFilter && matchesBranch && matchesRank && matchesUnit) ? 'block' : 'none';
        });
    }
    
    /**
     * Initialize filter controls with branch-rank dependency
     */
    initFilterControls() {
        const branchSelect = document.getElementById('filter-branch');
        const rankSelect = document.getElementById('filter-rank');
        
        if (!branchSelect || !rankSelect) return;
        
        const populateRanks = (branchValue) => {
            if (!window.MilitaryData) return;
            
            const ranks = window.MilitaryData.getRanksForBranch(branchValue) || [];
            rankSelect.innerHTML = '<option value="">All Ranks</option>';
            ranks.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.value;
                opt.textContent = r.label;
                rankSelect.appendChild(opt);
            });
        };
        
        branchSelect.addEventListener('change', () => {
            const val = branchSelect.value;
            populateRanks(val);
            this.filterAttendees();
        });
        
        rankSelect.addEventListener('change', () => this.filterAttendees());
        
        const unitInput = document.getElementById('filter-unit');
        if (unitInput) {
            unitInput.addEventListener('input', () => this.filterAttendees());
        }
    }


    /**
     * Sync RSVPs for a specific event
     * @param {string} eventId - Event ID
     */
    async syncEventRSVPs(eventId) {
        if (!window.githubAPI || !window.githubAPI.hasToken()) {
            showToast('🔐 GitHub token required to sync RSVPs', 'error');
            return;
        }

        const syncBtn = document.getElementById('sync-event-btn');
        const syncIndicator = document.getElementById('sync-indicator');
        const originalText = syncBtn ? syncBtn.textContent : '';

        try {
            if (syncBtn) {
                syncBtn.innerHTML = '<div class="spinner"></div> Syncing...';
                syncBtn.disabled = true;
            }

            showToast('🔗„ Syncing RSVPs for this event...', 'success');

            // Process RSVP issues for all events (GitHub doesn't allow filtering by event easily)
            const result = await window.githubAPI.processRSVPIssues();
            
            if (result.processed > 0) {
                // Reload responses for this event
                const responses = await window.githubAPI.loadResponses();
                window.responses = responses || {};
                
                // Refresh the management view
                await this.showEventManagement(eventId);
                
                showToast(`âœ… Synced RSVPs successfully! Found ${result.processed} new responses.`, 'success');
                
                // Show sync indicator
                if (syncIndicator) {
                    syncIndicator.style.display = 'inline';
                    setTimeout(() => {
                        syncIndicator.style.display = 'none';
                    }, 3000);
                }
                
                // Update last sync time
                const lastSyncTime = document.getElementById('last-sync-time');
                if (lastSyncTime) {
                    lastSyncTime.textContent = new Date().toLocaleTimeString();
                }
                
            } else {
                showToast('â„¹ï¸ No new RSVPs found for this event', 'success');
            }

        } catch (error) {
            console.error('Event RSVP sync failed:', error);
            showToast('âŒ Sync failed: ' + error.message, 'error');
        } finally {
            if (syncBtn) {
                syncBtn.textContent = originalText;
                syncBtn.disabled = false;
            }
        }
    }

    /**
     * Generate seating chart section HTML
     * @param {Object} event - Event data
     * @param {string} eventId - Event ID
     * @param {Array} eventResponses - RSVP responses
     * @returns {string} HTML content
     */
    generateSeatingChartSection(event, eventId, eventResponses) {
        if (!event.seatingChart || !event.seatingChart.enabled) return '';

        const h = window.utils.escapeHTML;
        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        // Get attending guests only
        const attendingGuests = eventResponses.filter(r => r.attending === true || r.attending === 'true');

        // Sync unassigned guests
        seatingChart.syncUnassignedGuests(attendingGuests);

        // Get stats
        const stats = seatingChart.getSeatingStats();

        // Get unassigned guests with full details
        const unassignedGuestsDetails = attendingGuests.filter(rsvp =>
            seatingChart.seatingData.unassignedGuests.includes(rsvp.rsvpId)
        );

        return `
            <div class="seating-chart-container" id="seating-chart-section">
                <h2 class="rsvp-dashboard-title">🪑 Seating Chart</h2>

                <!-- Seating Stats -->
                <div class="seating-stats-grid">
                    <div class="seating-stat-card filled">
                        <div class="stat-value">${stats.assigned}</div>
                        <div class="stat-label">Seated</div>
                    </div>
                    <div class="seating-stat-card unassigned">
                        <div class="stat-value">${stats.unassigned}</div>
                        <div class="stat-label">Unassigned</div>
                    </div>
                    <div class="seating-stat-card available">
                        <div class="stat-value">${stats.available}</div>
                        <div class="stat-label">Available Seats</div>
                    </div>
                    <div class="seating-stat-card">
                        <div class="stat-value">${stats.percentFilled}%</div>
                        <div class="stat-label">Capacity Used</div>
                    </div>
                </div>

                <!-- Seating Actions -->
                <div class="seating-actions">
                    <button class="btn btn-primary" onclick="eventManager.autoAssignSeats('${eventId}')">
                        🎯 Auto-Assign All
                    </button>
                    <button class="btn" onclick="eventManager.exportSeatingCSV('${eventId}')">
                        📥 Export Seating Chart
                    </button>
                    <button class="btn" onclick="eventManager.refreshSeatingChart('${eventId}')">
                        🔄 Refresh
                    </button>
                </div>

                ${unassignedGuestsDetails.length > 0 ? `
                    <!-- Unassigned Guests Section -->
                    <div class="unassigned-section">
                        <h3>
                            📋 Unassigned Guests
                            <span class="unassigned-count">${unassignedGuestsDetails.length}</span>
                        </h3>
                        <div class="unassigned-guests-list">
                            ${unassignedGuestsDetails.map(guest => `
                                <div class="unassigned-guest-item">
                                    <div class="unassigned-guest-info">
                                        <div class="unassigned-guest-name">${h(guest.name)}</div>
                                        <div class="unassigned-guest-details">
                                            ${guest.rank ? h(guest.rank) + ' • ' : ''}${guest.unit ? h(guest.unit) : ''}
                                            ${guest.guestCount ? ` • +${guest.guestCount} guest${guest.guestCount > 1 ? 's' : ''}` : ''}
                                        </div>
                                    </div>
                                    <div class="unassigned-guest-actions">
                                        <select class="table-select" id="table-select-${guest.rsvpId}">
                                            <option value="">Select Table...</option>
                                            ${event.seatingChart.tables.map(table => {
                                                const occupancy = seatingChart.getTableOccupancy(table.tableNumber);
                                                const available = table.capacity - occupancy;
                                                const guestCount = 1 + (guest.guestCount || 0);
                                                const canFit = available >= guestCount;
                                                return `<option value="${table.tableNumber}" ${!canFit ? 'disabled' : ''}>
                                                    Table ${table.tableNumber} ${table.vipTable ? '⭐' : ''} (${available}/${table.capacity} available)
                                                </option>`;
                                            }).join('')}
                                        </select>
                                        <button class="assign-btn" onclick="eventManager.assignGuestToTable('${eventId}', '${guest.rsvpId}', '${h(guest.name)}', ${guest.guestCount || 0})">
                                            Assign
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="seating-empty-state">
                        <h3>✅ All Attending Guests Assigned</h3>
                        <p>All guests have been assigned to tables.</p>
                    </div>
                `}

                <!-- Tables Grid -->
                <div class="tables-grid">
                    ${event.seatingChart.tables.map(table => {
                        const occupancy = seatingChart.getTableOccupancy(table.tableNumber);
                        const percentFull = (occupancy / table.capacity) * 100;
                        const isFull = occupancy >= table.capacity;
                        const isAlmostFull = percentFull >= 75 && !isFull;

                        return `
                            <div class="table-card ${table.vipTable ? 'vip-table' : ''} ${isFull ? 'full' : ''}">
                                <div class="table-header">
                                    <div class="table-number">
                                        ${table.vipTable ? '⭐ ' : ''}Table ${table.tableNumber}
                                    </div>
                                    <div class="table-capacity ${isFull ? 'full' : isAlmostFull ? 'almost-full' : ''}">
                                        ${occupancy}/${table.capacity}
                                    </div>
                                </div>
                                <div class="table-guests-list">
                                    ${table.assignedGuests.length > 0 ? table.assignedGuests.map(guest => `
                                        <div class="table-guest-item">
                                            <div>
                                                <span class="table-guest-name">${h(guest.name)}</span>
                                                ${guest.guestCount > 0 ? `<span class="table-guest-count">+${guest.guestCount}</span>` : ''}
                                            </div>
                                            <button class="table-guest-remove" onclick="eventManager.unassignGuest('${eventId}', '${guest.rsvpId}')" title="Remove from table">
                                                ✖
                                            </button>
                                        </div>
                                    `).join('') : `
                                        <div class="table-empty-state">
                                            Empty table
                                        </div>
                                    `}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Generate response table HTML with enhanced features
     * @param {Object} event - Event data
     * @param {Array} eventResponses - RSVP responses
     * @param {Object} stats - Event statistics
     * @returns {string} HTML content
     */
    generateResponseTable(event, eventResponses, stats) {
        const eventId = event.id;

        let html = `
            <div style="margin-bottom: 2rem;">
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
                        <div class="stat-label">📊 Total RSVPs</div>
                    </div>
                </div>
            </div>

            <div class="search-controls">
                <div class="search-row">
                    <input type="text" id="response-search" class="search-input" 
                           placeholder="🔗 Search responses by name, email, phone, or any field..."
                           onkeyup="eventManager.filterResponses('${eventId}')">
                    
                    <select id="attendance-filter" class="search-filter" onchange="eventManager.filterResponses('${eventId}')">
                        <option value="">All Responses</option>
                        <option value="attending">âœ… Attending Only</option>
                        <option value="not-attending">âŒ Not Attending Only</option>
                    </select>
                    
                    <button class="clear-search" onclick="eventManager.clearSearch('${eventId}')">Clear</button>
                    <button class="btn btn-success" onclick="eventManager.syncEventRSVPs('${eventId}')" style="margin-left: 0.5rem;">
                        🔗„ Refresh
                    </button>
                </div>
                
                <div class="search-stats" id="search-stats-${eventId}">
                    📊 Showing ${eventResponses.length} of ${eventResponses.length} responses
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
                            ${event.customQuestions ? event.customQuestions.map(q => `<th>${q.question}</th>`).join('') : ''}
                            <th>Submitted</th>
                            <th>Source</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="response-table-body-${eventId}">
        `;
        
        eventResponses.forEach((response, index) => {
            const displayName = response.name || 'Unknown';
            const email = response.email || 'N/A';
            const phone = response.phone || 'N/A';
            const source = response.issueNumber ? `GitHub Issue #${response.issueNumber}` : 'Direct Entry';
            const sourceIcon = response.issueNumber ? '🔗—' : 'ðŸ“';

            html += `
                <tr class="response-row" data-response-index="${index}" 
                    data-name="${displayName.toLowerCase()}" 
                    data-attending="${response.attending}" 
                    data-reason="${(response.reason || '').toLowerCase()}" 
                    data-guest-count="${response.guestCount || 0}"
                    data-phone="${phone.toLowerCase()}" 
                    data-email="${email.toLowerCase()}"
                    data-branch="${(response.branch || '').toLowerCase()}"
                    data-rank="${(response.rank || '').toLowerCase()}"
                    data-unit="${(response.unit || '').toLowerCase()}">
                    <td><strong>${displayName}</strong></td>
                    <td><a href="mailto:${email}" style="color: var(--semper-red); text-decoration: none;">${email}</a></td>
                    <td>${phone !== 'N/A' ? `<a href="tel:${phone}" style="color: var(--semper-red); text-decoration: none;">${phone}</a>` : phone}</td>
                    <td class="${response.attending ? 'attending-yes' : 'attending-no'}">
                        ${response.attending ? 'âœ… Yes' : 'âŒ No'}
                    </td>
                    ${event.askReason ? `<td style="max-width: 200px; word-wrap: break-word;">${response.reason || '-'}</td>` : ''}
                    ${event.allowGuests ? `<td><strong>${response.guestCount || 0}</strong> ${(response.guestCount || 0) === 1 ? 'guest' : 'guests'}</td>` : ''}
                    ${event.customQuestions ? event.customQuestions.map(q => 
                        `<td style="max-width: 150px; word-wrap: break-word;">${response.customAnswers && response.customAnswers[q.id] ? response.customAnswers[q.id] : '-'}</td>`
                    ).join('') : ''}
                    <td style="font-size: 0.875rem;">${new Date(response.timestamp).toLocaleString()}</td>
                    <td style="font-size: 0.875rem;" title="${source}">
                        ${sourceIcon} ${response.issueNumber ? `#${response.issueNumber}` : 'Direct'}
                    </td>
                    <td>
                        <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                                onclick="eventManager.deleteResponse('${eventId}', ${index})" 
                                title="Delete this RSVP">ðŸ—‘ï¸</button>
                        ${response.issueUrl ? `
                            <a href="${response.issueUrl}" target="_blank" class="btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-left: 0.25rem;" title="View GitHub Issue">
                                🔗—
                            </a>
                        ` : ''}
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        return html;
    }

    /**
     * Filter responses based on search criteria
     * @param {string} eventId - Event ID
     */
    filterResponses(eventId) {
        const searchTerm = document.getElementById('response-search').value.toLowerCase();
        const attendanceFilter = document.getElementById('attendance-filter').value;
        const rows = document.querySelectorAll(`#response-table-body-${eventId} .response-row`);
        const statsElement = document.getElementById(`search-stats-${eventId}`);
        
        let visibleCount = 0;
        let totalCount = rows.length;
        
        rows.forEach(row => {
            const name = row.getAttribute('data-name');
            const attending = row.getAttribute('data-attending');
            const reason = row.getAttribute('data-reason');
            const guestCount = row.getAttribute('data-guest-count');
            const phone = row.getAttribute('data-phone');
            const email = row.getAttribute('data-email');
            const branch = row.getAttribute('data-branch') || '';
            const rank = row.getAttribute('data-rank') || '';
            const unit = row.getAttribute('data-unit') || '';

            const matchesSearch = searchTerm === '' || 
                name.includes(searchTerm) || 
                reason.includes(searchTerm) ||
                guestCount.includes(searchTerm) ||
                phone.includes(searchTerm) ||
                email.includes(searchTerm) ||
                branch.includes(searchTerm) ||
                rank.includes(searchTerm) ||
                unit.includes(searchTerm);
            
            const matchesAttendance = attendanceFilter === '' ||
                (attendanceFilter === 'attending' && attending === 'true') ||
                (attendanceFilter === 'not-attending' && attending === 'false');
            
            if (matchesSearch && matchesAttendance) {
                row.classList.remove('hidden');
                visibleCount++;
                
                if (searchTerm !== '') {
                    row.classList.add('highlight');
                } else {
                    row.classList.remove('highlight');
                }
            } else {
                row.classList.add('hidden');
            }
        });
        
        if (searchTerm || attendanceFilter) {
            statsElement.innerHTML = `🔗 Showing ${visibleCount} of ${totalCount} responses`;
            if (visibleCount === 0) {
                statsElement.innerHTML += ' - <span style="color: var(--error-color);">No matches found</span>';
            }
        } else {
            statsElement.innerHTML = `📊 Showing ${totalCount} of ${totalCount} responses`;
        }
    }

    /**
     * Clear search filters
     * @param {string} eventId - Event ID
     */
    clearSearch(eventId) {
        document.getElementById('response-search').value = '';
        document.getElementById('attendance-filter').value = '';
        
        const rows = document.querySelectorAll(`#response-table-body-${eventId} .response-row`);
        rows.forEach(row => {
            row.classList.remove('hidden', 'highlight');
        });
        
        const statsElement = document.getElementById(`search-stats-${eventId}`);
        statsElement.innerHTML = `📊 Showing ${rows.length} of ${rows.length} responses`;
        
        showToast('ðŸ§¹ Search cleared', 'success');
    }

    /**
     * Copy invite link for an event
     * @param {string} eventId - Event ID
     */
    async copyInviteLink(eventId) {
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }
        
        try {
            const link = generateInviteURL(event);
            const success = await copyToClipboard(link);
            
            if (success) {
                showToast('🔗— Invite link copied to clipboard!', 'success');
                
                // Briefly highlight the input field
                const input = document.getElementById('invite-link-input');
                if (input) {
                    input.style.background = 'rgba(16, 185, 129, 0.1)';
                    setTimeout(() => {
                        input.style.background = '';
                    }, 1000);
                }
            } else {
                const input = document.getElementById('invite-link-input');
                if (input) {
                    input.select();
                    input.focus();
                }
            }
        } catch (error) {
            console.error('Failed to copy link:', error);
            showToast('Failed to copy link', 'error');
        }
    }

    /**
     * Edit an existing event
     * @param {string} eventId - Event ID
     */
    editEvent(eventId) {
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        this.editMode = true;
        this.currentEvent = event;

        // Populate the create form with event data
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-time').value = event.time;
        document.getElementById('event-location').value = event.location || '';
        document.getElementById('event-description').value = event.description || '';
        document.getElementById('ask-reason').checked = event.askReason || false;
        document.getElementById('allow-guests').checked = event.allowGuests || false;
        document.getElementById('requires-meal-choice').checked = event.requiresMealChoice || false;

        // Handle cover image
        const coverPreview = document.getElementById('cover-preview');
        if (event.coverImage) {
    coverPreview.src = event.coverImage;
    coverPreview.classList.remove('hidden');
    
    // Update upload area to show existing image
    const uploadArea = document.getElementById('cover-upload');
    if (uploadArea) {
        uploadArea.innerHTML = `
            <p style="color: #10b981; font-weight: 600;">✅ Current image loaded</p>
            <p style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.5rem;">Click to change image</p>
        `;
    }
} else {
    // Reset upload area for new image
    const uploadArea = document.getElementById('cover-upload');
    if (uploadArea) {
        uploadArea.innerHTML = `<p>Click or drag to upload cover image</p>`;
    }
}

        // Populate custom questions
        this.populateCustomQuestions(event.customQuestions || []);

        // Change form submission behavior
        const submitBtn = document.querySelector('#event-form button[type="submit"]');
        submitBtn.textContent = 'ðŸ’¾ Update Event';
        submitBtn.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #059669 100%)';

        // Add cancel button
        if (!document.getElementById('cancel-edit-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = 'âŒ Cancel Edit';
            cancelBtn.style.marginLeft = '0.5rem';
            cancelBtn.onclick = () => this.cancelEdit();
            submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
        }

        showPage('create');
        document.querySelector('#create h2').textContent = 'Edit Event';
    }

    /**
     * Populate custom questions in edit mode
     * @param {Array} questions - Custom questions array
     */
    populateCustomQuestions(questions) {
        const container = document.getElementById('custom-questions-container');
        container.innerHTML = '';

        // Only add questions if they exist - no default empty question
        if (questions && questions.length > 0) {
            questions.forEach(q => {
                const questionItem = document.createElement('div');
                questionItem.className = 'custom-question-item';
                questionItem.innerHTML = `
                    <input type="text" placeholder="Enter your question..." class="custom-question-input" value="${q.question || ''}">
                    <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">ðŸ—‘ï¸</button>
                `;
                container.appendChild(questionItem);
            });
        }
    }

    /**
     * Cancel edit mode
     */
    cancelEdit() {
        this.editMode = false;
        this.currentEvent = null;

        // Reset form
        document.getElementById('event-form').reset();
        document.getElementById('cover-preview').classList.add('hidden');
        clearCustomQuestions();

        // Reset submit button
        const submitBtn = document.querySelector('#event-form button[type="submit"]');
        submitBtn.textContent = 'ðŸš€ Deploy Event';
        submitBtn.style.background = '';

        // Remove cancel button
        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.remove();
        }

        // Reset page title
        document.querySelector('#create h2').textContent = 'Create New Event';

        showPage('dashboard');
    }

    /**
     * Update an existing event
     * @param {Object} eventData - Updated event data
     */
    async updateEvent(eventData) {
        try {
            // Preserve original creation data
            eventData.id = this.currentEvent.id;
            eventData.created = this.currentEvent.created;
            eventData.createdBy = this.currentEvent.createdBy;
            eventData.createdByName = this.currentEvent.createdByName;
            eventData.lastModified = Date.now();

            // Use BackendAPI to trigger workflow and save to EventCall-Data
            if (window.BackendAPI) {
                await window.BackendAPI.createEvent(eventData);
            } else {
                throw new Error('Backend API not available');
            }

            // Update local state
            if (window.events) {
                window.events[eventData.id] = eventData;
            }

            showToast('âœ… Event updated successfully!', 'success');

            // Reset edit mode
            this.cancelEdit();

            // Refresh dashboard
            renderDashboard();

        } catch (error) {
            console.error('Failed to update event:', error);
            throw error;
        }
    }

    /**
     * Duplicate an existing event
     * @param {string} eventId - Event ID to duplicate
     */
    duplicateEvent(eventId) {
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        // Create a copy with new ID and updated title
        const duplicatedEvent = {
            ...event,
            id: generateUUID(),
            title: `${event.title} (Copy)`,
            created: Date.now(),
            lastModified: Date.now()
        };

        // Populate form with duplicated data
        this.editMode = false; // Not editing, creating new
        this.currentEvent = null;

        document.getElementById('event-title').value = duplicatedEvent.title;
        document.getElementById('event-date').value = duplicatedEvent.date;
        document.getElementById('event-time').value = duplicatedEvent.time;
        document.getElementById('event-location').value = duplicatedEvent.location || '';
        document.getElementById('event-description').value = duplicatedEvent.description || '';
        document.getElementById('ask-reason').checked = duplicatedEvent.askReason || false;
        document.getElementById('allow-guests').checked = duplicatedEvent.allowGuests || false;

        // Handle cover image
        const coverPreview = document.getElementById('cover-preview');
        if (duplicatedEvent.coverImage) {
            coverPreview.src = duplicatedEvent.coverImage;
            coverPreview.classList.remove('hidden');
        }

        // Populate custom questions
        this.populateCustomQuestions(duplicatedEvent.customQuestions || []);

        showPage('create');
        showToast('ðŸ“‹ Event duplicated - modify details and deploy', 'success');
    }

    /**
     * Delete a specific RSVP response
     * @param {string} eventId - Event ID
     * @param {number} responseIndex - Index of response to delete
     */
    async deleteResponse(eventId, responseIndex) {
        if (!confirm('Are you sure you want to delete this RSVP response?')) {
            return;
        }

        try {
            const eventResponses = window.responses ? window.responses[eventId] || [] : [];
            const deletedResponse = eventResponses[responseIndex];
            
            if (!deletedResponse) {
                showToast('Response not found', 'error');
                return;
            }

            // Remove from local array
            eventResponses.splice(responseIndex, 1);
            if (window.responses) {
                window.responses[eventId] = eventResponses;
            }

            // Update GitHub if connected
            if (window.githubAPI && window.githubAPI.hasToken()) {
                try {
                    const path = `rsvps/${eventId}.json`;
                    const content = window.githubAPI.safeBase64Encode(JSON.stringify(eventResponses, null, 2));
                    
                    // Get existing file info
                    const existingResponse = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall/contents/${path}`, {
                        headers: {
                            'Authorization': `token ${window.githubAPI.getToken()}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'EventCall-App'
                        }
                    });

                    let createData = {
                        message: `Delete RSVP response: ${deletedResponse.name}`,
                        content: content,
                        branch: 'main'
                    };

                    if (existingResponse.ok) {
                        const existingData = await existingResponse.json();
                        createData.sha = existingData.sha;
                    }

                    await fetch(`https://api.github.com/repos/SemperAdmin/EventCall/contents/${path}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${window.githubAPI.getToken()}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json',
                            'User-Agent': 'EventCall-App'
                        },
                        body: JSON.stringify(createData)
                    });

                } catch (error) {
                    console.error('Failed to update GitHub:', error);
                    // Continue anyway - local deletion succeeded
                }
            }

            // Refresh the event management view
            this.showEventManagement(eventId);
            showToast('ðŸ—‘ï¸ RSVP response deleted successfully', 'success');

        } catch (error) {
            console.error('Failed to delete response:', error);
            showToast('Failed to delete response: ' + error.message, 'error');
        }
    }

    /**
     * Get event creation form data
     * @returns {Object} Event data from form
     */
    getFormData() {
        return {
            title: sanitizeText(document.getElementById('event-title').value),
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            location: sanitizeText(document.getElementById('event-location').value),
            description: sanitizeText(document.getElementById('event-description').value),
            coverImage: document.getElementById('cover-preview').src || '',
            askReason: document.getElementById('ask-reason').checked,
            allowGuests: document.getElementById('allow-guests').checked,
            customQuestions: getCustomQuestions()
        };
    }

    /**
     * Validate event form data
     * @param {Object} eventData - Event data to validate
     * @returns {Object} Validation result
     */
    validateEventData(eventData) {
        const result = {
            valid: true,
            errors: []
        };

        if (!eventData.title || eventData.title.length < 3 || eventData.title.length > 100) {
            result.valid = false;
            result.errors.push('Please enter a valid event title (3-100 characters)');
        }

        if (!eventData.date || !eventData.time) {
            result.valid = false;
            result.errors.push('Please specify both date and time for the event');
        }

        // Check if date is not too far in the past
        const eventDate = new Date(`${eventData.date}T${eventData.time}`);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (eventDate < yesterday) {
            result.valid = false;
            result.errors.push('Event date cannot be more than 1 day in the past');
        }

        return result;
    }

    /**
     * Assign a guest to a table
     * @param {string} eventId - Event ID
     * @param {string} rsvpId - RSVP ID
     * @param {string} guestName - Guest name
     * @param {number} guestCount - Guest count
     */
    async assignGuestToTable(eventId, rsvpId, guestName, guestCount) {
        const event = window.events ? window.events[eventId] : null;
        if (!event || !event.seatingChart) {
            showToast('Event or seating chart not found', 'error');
            return;
        }

        // Get selected table from dropdown
        const selectElement = document.getElementById(`table-select-${rsvpId}`);
        if (!selectElement) {
            showToast('Table selection not found', 'error');
            return;
        }

        const tableNumber = parseInt(selectElement.value);
        if (!tableNumber) {
            showToast('Please select a table', 'warning');
            return;
        }

        // Create seating chart instance and assign
        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        const result = seatingChart.assignGuestToTable(rsvpId, tableNumber, {
            name: guestName,
            guestCount: guestCount
        });

        if (result.success) {
            // Update event data
            event.seatingChart = seatingChart.exportSeatingData();
            await this.saveEventSeatingData(event);
            showToast(result.message, 'success');

            // Refresh the seating chart display
            this.refreshSeatingChart(eventId);
        } else {
            showToast(result.message, 'error');
        }
    }

    /**
     * Unassign a guest from their table
     * @param {string} eventId - Event ID
     * @param {string} rsvpId - RSVP ID
     */
    async unassignGuest(eventId, rsvpId) {
        const event = window.events ? window.events[eventId] : null;
        if (!event || !event.seatingChart) {
            showToast('Event or seating chart not found', 'error');
            return;
        }

        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        if (seatingChart.unassignGuest(rsvpId)) {
            // Update event data
            event.seatingChart = seatingChart.exportSeatingData();
            await this.saveEventSeatingData(event);
            showToast('Guest unassigned from table', 'success');

            // Refresh the seating chart display
            this.refreshSeatingChart(eventId);
        } else {
            showToast('Failed to unassign guest', 'error');
        }
    }

    /**
     * Auto-assign all unassigned guests
     * @param {string} eventId - Event ID
     */
    async autoAssignSeats(eventId) {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];

        if (!event || !event.seatingChart) {
            showToast('Event or seating chart not found', 'error');
            return;
        }

        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        // Get attending guests only
        const attendingGuests = eventResponses.filter(r => r.attending === true || r.attending === 'true');

        // Sync unassigned guests first
        seatingChart.syncUnassignedGuests(attendingGuests);

        // Get unassigned guests with details
        const unassignedGuestsDetails = attendingGuests.filter(rsvp =>
            seatingChart.seatingData.unassignedGuests.includes(rsvp.rsvpId)
        );

        if (unassignedGuestsDetails.length === 0) {
            showToast('No unassigned guests to assign', 'info');
            return;
        }

        // Auto-assign
        const result = seatingChart.autoAssignGuests(unassignedGuestsDetails);

        if (result.success) {
            // Update event data
            event.seatingChart = seatingChart.exportSeatingData();
            await this.saveEventSeatingData(event);

            if (result.failed > 0) {
                showToast(`✅ Assigned ${result.assigned} guests. ⚠️ ${result.failed} could not be assigned (insufficient capacity)`, 'warning');
            } else {
                showToast(`✅ Successfully assigned ${result.assigned} guests to tables`, 'success');
            }

            // Refresh the seating chart display
            this.refreshSeatingChart(eventId);
        } else {
            showToast('Auto-assign failed', 'error');
        }
    }

    /**
     * Export seating chart as CSV
     * @param {string} eventId - Event ID
     */
    exportSeatingCSV(eventId) {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];

        if (!event || !event.seatingChart) {
            showToast('Event or seating chart not found', 'error');
            return;
        }

        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        const csv = seatingChart.generateSeatingCSV(eventResponses);

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `seating-chart-${event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('📥 Seating chart exported', 'success');
    }

    /**
     * Refresh seating chart display
     * @param {string} eventId - Event ID
     */
    refreshSeatingChart(eventId) {
        // Simply reload the event management view
        this.showEventManagement(eventId);
    }

    /**
     * Save event seating data to GitHub
     * @param {Object} event - Event object with updated seating data
     */
    async saveEventSeatingData(event) {
        try {
            if (window.githubAPI) {
                await window.githubAPI.saveEvent(event);
                // Update local state
                if (window.events) {
                    window.events[event.id] = event;
                }
            }
        } catch (error) {
            console.error('Failed to save seating data:', error);
            showToast('Failed to save seating data', 'error');
        }
    }
}

// Create global instance
const eventManager = new EventManager();

// Make functions available globally for HTML onclick handlers
window.eventManager = eventManager;
