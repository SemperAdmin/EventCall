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
                            ðŸ”„ Check for New RSVPs
                        </button>
                        <button class="btn" onclick="copyInviteLink('${eventId}')">
                            ðŸ”— Share Invite Link
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
                    <h1>${event.title}</h1>
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
                                    <div class="meta-value">${event.location || 'Not specified'}</div>
                                </div>
                            </div>
                            <div class="meta-item-v2">
                                <span class="meta-icon-v2">${isPast ? '⏱️' : '⏳'}</span>
                                <div class="meta-content">
                                    <div class="meta-label">${isPast ? 'Status' : 'Time Until'}</div>
                                    <div class="meta-value">${isPast ? 'Event Passed' : timeUntil}</div>
                                </div>
                            </div>
                        </div>
                        ${event.description ? `
                            <div class="meta-item-v2" style="grid-column: 1 / -1;">
                                <span class="meta-icon-v2">📝</span>
                                <div class="meta-content">
                                    <div class="meta-label">Description</div>
                                    <div class="meta-value">${event.description}</div>
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
                            <img src="${event.coverImage}" alt="${event.title}">
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
                    ${event.allowGuests ? `
                        <div class="stat-card-large stat-card-guests">
                            <div class="stat-card-icon">👥+</div>
                            <div class="stat-card-number">${stats.attendingWithGuests}</div>
                            <div class="stat-card-label">Guests</div>
                        </div>
                    ` : ''}
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

                <!-- Dashboard Actions -->
                <div class="dashboard-actions">
                    <button class="btn-action btn-sync" onclick="eventManager.syncEventRSVPs('${eventId}')">
                        🔄 Sync RSVPs
                    </button>
                    <button class="btn-action btn-reminder" onclick="alert('Email reminder feature coming soon!')">
                        📧 Send Reminder
                    </button>
                    <button class="btn-action btn-export" onclick="exportEventData('${eventId}')">
                        📊 Export CSV
                    </button>
                    <button class="btn-action btn-export" onclick="copyEventData('${eventId}')">
                        📋 Copy TSV
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
                    <button class="btn-action" onclick="alert('QR Code feature coming soon!')">
                        📱 QR Code
                    </button>
                    <button class="btn-action" onclick="alert('Email link feature coming soon!')">
                        📧 Email Link
                    </button>
                </div>
            </div>

            <!-- Attendee List -->
            <div class="attendee-list-section">
                <div class="attendee-list-header">
                    <h3 class="attendee-list-title">📋 Attendee List (${eventResponses.length})</h3>
                    <div class="attendee-controls">
                        <input 
                            type="text" 
                            class="search-input" 
                            placeholder="🔍 Search attendees..." 
                            id="attendee-search"
                            oninput="eventManager.filterAttendees()"
                        >
                        <select class="filter-select" id="attendee-filter" onchange="eventManager.filterAttendees()">
                            <option value="all">All Responses</option>
                            <option value="attending">Attending Only</option>
                            <option value="declined">Declined Only</option>
                        </select>
                    </div>
                </div>

                ${eventResponses.length > 0 ? this.generateAttendeeCards(eventResponses) : `
                    <div class="no-attendees">
                        <div class="no-attendees-icon">📭</div>
                        <h3>No RSVPs Yet</h3>
                        <p>Share your invite link to start collecting responses!</p>
                        <button class="btn-action btn-sync" onclick="eventManager.copyInviteLink('${eventId}')" style="margin-top: 1rem;">
                            🔗 Share Invite Link
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
}

/**
 * Generate attendee cards HTML - UPDATED with Email button
 */
generateAttendeeCards(eventResponses) {
    return `
        <div class="attendee-cards" id="attendee-cards-container">
            ${eventResponses.map(response => `
                <div class="attendee-card" 
                     data-name="${(response.name || '').toLowerCase()}" 
                     data-status="${response.attending ? 'attending' : 'declined'}"
                     data-branch="${(response.branch || '').toLowerCase()}"
                     data-rank="${(response.rank || '').toLowerCase()}"
                     data-unit="${(response.unit || '').toLowerCase()}"
                     data-email="${(response.email || '').toLowerCase()}"
                     data-phone="${(response.phone || '').toLowerCase()}">
                    <div class="attendee-card-header">
                        <div class="attendee-info">
                            <div class="attendee-name">${response.name || 'Anonymous'}</div>
                            <span class="attendee-status ${response.attending ? 'status-attending' : 'status-declined'}">
                                ${response.attending ? '✅ Attending' : '❌ Declined'}
                            </span>
                        </div>
                    </div>
                    <div class="attendee-details">
                        ${response.email ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">📧</span>
                                <span>${response.email}</span>
                            </div>
                        ` : ''}
                        ${response.phone ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">📱</span>
                                <span>${response.phone}</span>
                            </div>
                        ` : ''}
                        ${response.guestCount > 0 ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">👥</span>
                                <span>+${response.guestCount} guest${response.guestCount > 1 ? 's' : ''}</span>
                            </div>
                        ` : ''}
                        ${response.reason ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">💬</span>
                                <span>${response.reason}</span>
                            </div>
                        ` : ''}
                        ${(response.dietaryRestrictions && response.dietaryRestrictions.length) ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">🍽️</span>
                                <span>${response.dietaryRestrictions.join(', ')}</span>
                            </div>
                        ` : ''}
                        ${response.allergyDetails ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">⚠️</span>
                                <span>${response.allergyDetails}</span>
                            </div>
                        ` : ''}
                        ${response.rank ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">⭐</span>
                                <span>${response.rank}</span>
                            </div>
                        ` : ''}
                        ${response.unit ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">🎖️</span>
                                <span>${response.unit}</span>
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
                            onclick="if(confirm('Remove this RSVP?')) alert('Remove feature coming soon!')"
                            title="Remove this RSVP">
                            🗑️ Remove
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}
    
    /**
     * Filter attendees based on search and filter
     * Add this new function to event-manager.js
     */
    filterAttendees() {
        const searchInput = document.getElementById('attendee-search');
        const filterSelect = document.getElementById('attendee-filter');
        const cards = document.querySelectorAll('.attendee-card');
        
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const filterValue = filterSelect?.value || 'all';
        
        cards.forEach(card => {
            const name = card.dataset.name || '';
            const status = card.dataset.status || '';
            const extra = [
                card.dataset.branch || '',
                card.dataset.rank || '',
                card.dataset.unit || '',
                card.dataset.email || '',
                card.dataset.phone || ''
            ].join(' ');
            
            const matchesSearch = searchTerm === '' || name.includes(searchTerm) || extra.includes(searchTerm);
            const matchesFilter = filterValue === 'all' || status === filterValue;
            
            card.style.display = (matchesSearch && matchesFilter) ? 'block' : 'none';
        });
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

            showToast('ðŸ”„ Syncing RSVPs for this event...', 'success');

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
                           placeholder="ðŸ” Search responses by name, email, phone, or any field..."
                           onkeyup="eventManager.filterResponses('${eventId}')">
                    
                    <select id="attendance-filter" class="search-filter" onchange="eventManager.filterResponses('${eventId}')">
                        <option value="">All Responses</option>
                        <option value="attending">âœ… Attending Only</option>
                        <option value="not-attending">âŒ Not Attending Only</option>
                    </select>
                    
                    <button class="clear-search" onclick="eventManager.clearSearch('${eventId}')">Clear</button>
                    <button class="btn btn-success" onclick="eventManager.syncEventRSVPs('${eventId}')" style="margin-left: 0.5rem;">
                        ðŸ”„ Refresh
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
            const sourceIcon = response.issueNumber ? 'ðŸ”—' : 'ðŸ“';

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
                                ðŸ”—
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
            statsElement.innerHTML = `ðŸ” Showing ${visibleCount} of ${totalCount} responses`;
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
                showToast('ðŸ”— Invite link copied to clipboard!', 'success');
                
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
}

// Create global instance
const eventManager = new EventManager();

// Make functions available globally for HTML onclick handlers
window.eventManager = eventManager;
