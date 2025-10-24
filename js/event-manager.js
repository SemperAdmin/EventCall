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
                    <h3 style="color: var(--semper-navy);">📭 No RSVPs Yet</h3>
                    <p>No RSVPs yet. Share your invite link to start collecting responses!</p>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-success" onclick="syncWithGitHub()" style="margin-right: 0.5rem;">
                            🔄 Check for New RSVPs
                        </button>
                        <button class="btn" onclick="copyInviteLink('${eventId}')">
                            🔗 Share Invite Link
                        </button>
                    </div>
                </div>
            `;
        }

        document.getElementById('event-details').innerHTML = this.generateEventDetailsHTML(event, eventId, responseTableHTML);
        showPage('manage');
        window.location.hash = `manage/${eventId}`;
    }

    /**
     * Generate event details HTML with enhanced sync controls
     * @param {Object} event - Event data
     * @param {string} eventId - Event ID
     * @param {string} responseTableHTML - Response table HTML
     * @returns {string} HTML content
     */
    generateEventDetailsHTML(event, eventId, responseTableHTML) {
        const inviteURL = generateInviteURL(event);
        const timeUntil = getTimeUntilEvent(event.date, event.time);
        const isPast = isEventInPast(event.date, event.time);
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];

        return `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h2 style="color: var(--semper-navy); font-size: 2rem; margin-bottom: 0.5rem;">${event.title}</h2>
                    <div class="event-meta" style="margin-bottom: 1rem;">
                        📅 ${formatDate(event.date)} at ${formatTime(event.time)}<br>
                        📍 ${event.location || 'No location specified'}<br>
                        📝 ${event.description || 'No description provided'}<br>
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
            
            <!-- Enhanced Sync Status Section -->
            <div id="sync-status-section" style="margin: 1rem 0; padding: 1rem; background: var(--gray-50); border-radius: 0.5rem; border-left: 4px solid var(--semper-gold);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <strong style="color: var(--semper-navy);">📊 RSVP Status:</strong>
                        <span style="margin-left: 0.5rem;">${eventResponses.length} responses recorded</span>
                        <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">
                            Last synced: <span id="last-sync-time">Just now</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn btn-success" onclick="eventManager.syncEventRSVPs('${eventId}')" id="sync-event-btn">
                            🔄 Sync RSVPs
                        </button>
                        <span id="sync-indicator" style="display: none; color: var(--success-color); font-weight: 600;">
                            ✅ Synced
                        </span>
                    </div>
                </div>
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
                <button class="btn" onclick="eventManager.copyInviteLink('${eventId}')">🔗 Copy Invite Link</button>
                <button class="btn" onclick="eventManager.editEvent('${eventId}')">✏️ Edit Event</button>
                <button class="btn btn-success" onclick="exportEventData('${eventId}')">📥 Export Data</button>
                <button class="btn btn-success" onclick="syncWithGitHub()">🔄 Sync All RSVPs</button>
                <button class="btn" onclick="showPage('dashboard')">🏠 Back to Dashboard</button>
                ${isPast ? '' : `<button class="btn" onclick="eventManager.duplicateEvent('${eventId}')">📋 Duplicate Event</button>`}
            </div>
            
            <h3 style="color: var(--semper-navy); margin-bottom: 1rem;">📊 RSVP Responses (${eventResponses.length})</h3>
            ${responseTableHTML}
        `;
    }

    /**
     * Sync RSVPs for a specific event
     * @param {string} eventId - Event ID
     */
    async syncEventRSVPs(eventId) {
        if (!userAuth.isLoggedIn() || !userAuth.hasGitHubToken()) {
            showToast('🔐 Please login with GitHub token to sync RSVPs', 'error');
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

            showToast('🔄 Syncing RSVPs for this event...', 'success');

            // Process RSVP issues for all events (GitHub doesn't allow filtering by event easily)
            const result = await window.githubAPI.processRSVPIssues();
            
            if (result.processed > 0) {
                // Reload responses for this event
                const responses = await window.githubAPI.loadResponses();
                window.responses = responses || {};
                
                // Refresh the management view
                await this.showEventManagement(eventId);
                
                showToast(`✅ Synced RSVPs successfully! Found ${result.processed} new responses.`, 'success');
                
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
                showToast('ℹ️ No new RSVPs found for this event', 'success');
            }

        } catch (error) {
            console.error('Event RSVP sync failed:', error);
            showToast('❌ Sync failed: ' + error.message, 'error');
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
            </div>

            <div class="search-controls">
                <div class="search-row">
                    <input type="text" id="response-search" class="search-input" 
                           placeholder="🔍 Search responses by name, email, phone, or any field..."
                           onkeyup="eventManager.filterResponses('${eventId}')">
                    
                    <select id="attendance-filter" class="search-filter" onchange="eventManager.filterResponses('${eventId}')">
                        <option value="">All Responses</option>
                        <option value="attending">✅ Attending Only</option>
                        <option value="not-attending">❌ Not Attending Only</option>
                    </select>
                    
                    <button class="clear-search" onclick="eventManager.clearSearch('${eventId}')">Clear</button>
                    <button class="btn btn-success" onclick="eventManager.syncEventRSVPs('${eventId}')" style="margin-left: 0.5rem;">
                        🔄 Refresh
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
            const sourceIcon = response.issueNumber ? '🔗' : '📝';

            html += `
                <tr class="response-row" data-response-index="${index}" 
                    data-name="${displayName.toLowerCase()}" 
                    data-attending="${response.attending}" 
                    data-reason="${(response.reason || '').toLowerCase()}" 
                    data-guest-count="${response.guestCount || 0}"
                    data-phone="${phone.toLowerCase()}" 
                    data-email="${email.toLowerCase()}">
                    <td><strong>${displayName}</strong></td>
                    <td><a href="mailto:${email}" style="color: var(--semper-red); text-decoration: none;">${email}</a></td>
                    <td>${phone !== 'N/A' ? `<a href="tel:${phone}" style="color: var(--semper-red); text-decoration: none;">${phone}</a>` : phone}</td>
                    <td class="${response.attending ? 'attending-yes' : 'attending-no'}">
                        ${response.attending ? '✅ Yes' : '❌ No'}
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
                                title="Delete this RSVP">🗑️</button>
                        ${response.issueUrl ? `
                            <a href="${response.issueUrl}" target="_blank" class="btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-left: 0.25rem;" title="View GitHub Issue">
                                🔗
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

            const matchesSearch = searchTerm === '' || 
                name.includes(searchTerm) || 
                reason.includes(searchTerm) ||
                guestCount.includes(searchTerm) ||
                phone.includes(searchTerm) ||
                email.includes(searchTerm);
            
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
            statsElement.innerHTML = `🔍 Showing ${visibleCount} of ${totalCount} responses`;
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
        
        showToast('🧹 Search cleared', 'success');
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
                showToast('🔗 Invite link copied to clipboard!', 'success');
                
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
        } else {
            coverPreview.classList.add('hidden');
        }

        // Populate custom questions
        this.populateCustomQuestions(event.customQuestions || []);

        // Change form submission behavior
        const submitBtn = document.querySelector('#event-form button[type="submit"]');
        submitBtn.textContent = '💾 Update Event';
        submitBtn.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #059669 100%)';

        // Add cancel button
        if (!document.getElementById('cancel-edit-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = '❌ Cancel Edit';
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
                    <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">🗑️</button>
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
        submitBtn.textContent = '🚀 Deploy Event';
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

            showToast('✅ Event updated successfully!', 'success');

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
        showToast('📋 Event duplicated - modify details and deploy', 'success');
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
            if (userAuth.hasGitHubToken() && window.githubAPI) {
                try {
                    const path = `rsvps/${eventId}.json`;
                    const content = window.githubAPI.safeBase64Encode(JSON.stringify(eventResponses, null, 2));
                    
                    // Get existing file info
                    const existingResponse = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall/contents/${path}`, {
                        headers: {
                            'Authorization': `token ${userAuth.getGitHubToken()}`,
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
                            'Authorization': `token ${userAuth.getGitHubToken()}`,
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
            showToast('🗑️ RSVP response deleted successfully', 'success');

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

    