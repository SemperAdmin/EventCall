/**
 * EventCall UI Components - Fixed Invite Form Display
 */

// Initialize invite page on load
document.addEventListener('DOMContentLoaded', () => {
    // Check if this is an invite URL
    const hasInviteData = window.location.search.includes('data=');
    const isInviteHash = window.location.hash.includes('invite/');
    
    if (hasInviteData || isInviteHash) {
        console.log('🎯 Invite page detected, loading content...');
        
        // Force show invite page
        const invitePage = document.getElementById('invite');
        if (invitePage) {
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            invitePage.classList.add('active');
            console.log('✅ Invite page shown');
        }
        
        // Hide nav
        const nav = document.querySelector('.nav');
        if (nav) {
            nav.style.display = 'none';
        }
        
        setTimeout(() => {
            loadInviteContentDirect();
        }, 200);
    }
});

/**
 * Direct invite content loader
 */
async function loadInviteContentDirect() {
    // Show loading state
    const inviteContent = document.getElementById('invite-content');
    if (inviteContent) {
        inviteContent.innerHTML = window.utils.sanitizeHTML(`
            <div style="text-align: center; padding: 3rem;">
                <div class="spinner" style="width: 50px; height: 50px; border: 4px solid rgba(212, 175, 55, 0.2); border-top-color: #d4af37; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p style="color: #9ca3af;">Loading event...</p>
            </div>
        `);
    }

    const event = await getEventFromURL();
    if (!event) {
        document.getElementById('invite-content').innerHTML = window.utils.sanitizeHTML(`
            <div style="text-align: center; padding: 3rem; color: #ef4444;">
                <h2>❌ Event Not Found</h2>
                <p>This invite link may be invalid or the event may have been deleted.</p>
            </div>
        `);
        return;
    }

    const eventId = event.id;
    const isPast = isEventInPast(event.date, event.time);

    if (isPast) {
        document.getElementById('invite-content').innerHTML = window.utils.sanitizeHTML(createPastEventHTML(event));
        return;
    }

    document.getElementById('invite-content').innerHTML = window.utils.sanitizeHTML(createInviteHTML(event, eventId));

    // Setup form functionality
    setupRSVPForm();
}

/**
 * Create invite HTML content
 */
function createInviteHTML(event, eventId) {
    return `
        <div class="${event.coverImage ? 'invite-display-split' : 'invite-display'}">
            ${event.coverImage ? createInviteWithImageHTML(event, eventId) : createInviteWithoutImageHTML(event, eventId)}
        </div>
    `;
}

/**
 * Create invite without image HTML
 */
// Helper for escaping dynamic strings
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// function createInviteWithoutImageHTML(event, eventId) {
function createInviteWithoutImageHTML(event, eventId) {
    return `
        <div class="invite-content">
            <h1 class="invite-title">${escapeHTML(event.title)}</h1>
            <div class="invite-details">
                <div class="invite-detail">
                    <strong>📅 Date:</strong> ${formatDate(event.date)}
                </div>
                <div class="invite-detail">
                    <strong>🕐 Time:</strong> ${formatTime(event.time)}
                </div>
                ${event.location ? `
                    <div class="invite-detail">
                        <strong>📍 Location:</strong> ${escapeHTML(event.location)}
                    </div>
                ` : ''}
                ${event.description ? `
                    <div class="invite-detail">
                        <strong>📝 Details:</strong> ${escapeHTML(event.description)}
                    </div>
                ` : ''}
                ${createEventDetailsHTML(event.eventDetails)}
                ${createRSVPSettingsHTML(event)}
            </div>
            <div style="margin: 1.5rem 0; text-align: center;">
                <div style="display: inline-block;">
                    ${window.calendarExport ? window.calendarExport.generateCalendarDropdownHTML(event) : ''}
                </div>
            </div>
            ${createRSVPFormHTML(event, eventId)}
            <div class="invite-powered-by">
                <div class="powered-by-text">Powered by</div>
                <a href="https://linktr.ee/semperadmin" target="_blank" class="powered-by-link">
                    SEMPER ADMIN
                </a>
            </div>
        </div>
    `;
}

/**
 * Create RSVP form HTML with original working fields
 */
function createRSVPFormHTML(event, eventId) {
    return `
        <div class="rsvp-form">
            <h3>RSVP</h3>
            <form id="rsvp-form" onsubmit="handleRSVP(event, '${eventId}')">
                <div class="form-group">
                    <label for="rsvp-name">Full Name *</label>
                    <input type="text" id="rsvp-name" name="name" autocomplete="name" required placeholder="Enter your full name" style="min-height: 44px;">
                </div>

                <div class="form-group">
                    <label for="rsvp-email">Email Address *</label>
                    <input type="email" id="rsvp-email" name="email" autocomplete="email" required placeholder="your.email@example.com" inputmode="email" style="min-height: 44px;">
                </div>

                <div class="form-group">
                    <label for="rsvp-phone">Phone Number</label>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                      <select id="rsvp-country" style="min-height:44px;">
                        <option value="US">🇺🇸 US</option>
                        <option value="CA">🇨🇦 CA</option>
                        <option value="GB">🇬🇧 UK</option>
                        <option value="AU">🇦🇺 AU</option>
                        <option value="DE">🇩🇪 DE</option>
                      </select>
                      <input type="tel" id="rsvp-phone" name="tel" autocomplete="tel" placeholder="(555) 123-4567" inputmode="tel" style="min-height: 44px; flex:1;">
                    </div>
                </div>

                <!-- Military Information (Optional) -->
                <div style="margin: 1.5rem 0; padding: 1rem; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 0.5rem;">
                    <div style="font-weight: 600; margin-bottom: 0.75rem; color: #1e40af;">🎖️ Military Information (Optional)</div>

                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label for="branch">Service Branch</label>
                        <select id="branch" onchange="window.updateRanksForBranch && window.updateRanksForBranch()" style="min-height: 44px; font-size: 16px;">
                            <option value="">Select service branch...</option>
                            ${window.MilitaryData ? window.MilitaryData.branches.map(b =>
                                `<option value="${b.value}">${b.label}</option>`
                            ).join('') : ''}
                        </select>
                    </div>

                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label for="rank">Rank</label>
                        <select id="rank" style="min-height: 44px; font-size: 16px;" disabled>
                            <option value="">Select service branch first...</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="unit">Unit</label>
                        <input type="text" id="unit" placeholder="e.g., 2nd Battalion, 1st Marines" style="min-height: 44px;">
                    </div>
                </div>

                ${event.requiresMealChoice ? `
                    <div class="form-group">
                        <label>Dietary Restrictions (Optional)</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem;">
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="checkbox" name="dietary" value="vegetarian" style="margin-right: 0.5rem;">
                                <span>🥗 Vegetarian</span>
                            </label>
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="checkbox" name="dietary" value="vegan" style="margin-right: 0.5rem;">
                                <span>🌱 Vegan</span>
                            </label>
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="checkbox" name="dietary" value="gluten-free" style="margin-right: 0.5rem;">
                                <span>🌾 Gluten-Free</span>
                            </label>
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="checkbox" name="dietary" value="dairy-free" style="margin-right: 0.5rem;">
                                <span>🥛 Dairy-Free</span>
                            </label>
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="checkbox" name="dietary" value="halal" style="margin-right: 0.5rem;">
                                <span>☪️ Halal</span>
                            </label>
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="checkbox" name="dietary" value="kosher" style="margin-right: 0.5rem;">
                                <span>✡️ Kosher</span>
                            </label>
                        </div>
                        <div style="margin-top: 0.75rem;">
                            <input type="text" id="allergy-details" placeholder="Other allergies or dietary needs..." style="min-height: 44px;">
                        </div>
                    </div>
                ` : ''}

                ${event.askReason ? `
                    <div class="form-group">
                        <label for="reason">Why are you attending? (Optional)</label>
                        <textarea id="reason" placeholder="Share your thoughts..." rows="3"></textarea>
                    </div>
                ` : ''}

                <div class="form-group">
                  <button type="button" id="rsvp-start-over" class="btn-secondary">Start Over</button>
                </div>
                
                ${createCustomQuestionsHTML(event.customQuestions || [])}
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Will you be attending? *</label>
                    <div style="display: flex; gap: 1rem;">
                        <label class="rsvp-radio-option">
                            <input type="radio" name="attending" value="true" required onchange="toggleGuestCount(true)">
                            <span>✅ Yes, I'll be there!</span>
                        </label>
                        <label class="rsvp-radio-option">
                            <input type="radio" name="attending" value="false" required onchange="toggleGuestCount(false)">
                            <span>❌ Can't make it</span>
                        </label>
                    </div>
                </div>

                ${event.allowGuests ? `
                    <div class="form-group" id="guest-count-group" style="display: none;">
                        <label for="guest-count">How many additional guests will you bring?</label>
                        <select id="guest-count" style="min-height: 44px; font-size: 16px;">
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
                    <button type="submit" class="btn" style="min-height: 48px; padding: 0.875rem 2rem; font-size: 1.1rem;">📝 Submit RSVP</button>
                </div>
            </form>
        </div>
    `;
}

/**
 * Create event details HTML for display on invite
 */
function createEventDetailsHTML(eventDetails) {
    if (!eventDetails || Object.keys(eventDetails).length === 0) {
        return '';
    }

    // Map field labels to appropriate icons
    const fieldIcons = {
        'honoree name': '🎖️',
        'retiree name': '🎖️',
        'recipient': '🎖️',
        'rank': '⭐',
        'current rank': '⭐',
        'new rank': '⭐',
        'retiring rank': '⭐',
        'promoted by': '👔',
        'promoter': '👔',
        'years of service': '📅',
        'service dates': '📅',
        'outgoing': '👤',
        'incoming': '👤',
        'commander': '👔',
        'officer': '👔',
        'chaplain': '⛪',
        'unit': '🪖',
        'venue': '🏛️',
        'location': '📍',
        'reception': '🍽️',
        'dress code': '👔',
        'uniform': '🎖️',
        'price': '💵',
        'cost': '💵',
        'ticket': '🎫',
        'speaker': '🎤',
        'instructor': '👨‍🏫',
        'topic': '📚',
        'training': '🎯',
        'activities': '🎉',
        'food': '🍔',
        'parking': '🅿️',
        'award': '🏅',
        'formation': '📋',
        'type': '📝'
    };

    // Get icon for field based on label keywords
    const getIcon = (label) => {
        const lowerLabel = label.toLowerCase();
        for (const [keyword, icon] of Object.entries(fieldIcons)) {
            if (lowerLabel.includes(keyword)) {
                return icon;
            }
        }
        return '📌'; // Default icon
    };

    const detailsHTML = Object.values(eventDetails).map(detail => `
        <div class="invite-detail" style="display: flex; align-items: start; gap: 0.75rem; padding: 0.75rem; background: linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(212, 175, 55, 0.02)); border-radius: 0.5rem; margin-bottom: 0.75rem; border-left: 3px solid #d4af37;">
            <span style="font-size: 1.25rem; flex-shrink: 0;">${getIcon(detail.label)}</span>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #86efac; font-size: 0.875rem; margin-bottom: 0.25rem;">${escapeHTML(detail.label)}</div>
                <div style="color: #d4af37; font-size: 1rem; font-weight: 600;">${escapeHTML(detail.value)}</div>
            </div>
        </div>
    `).join('');
    
    return `
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid #e5e7eb;">
            <div style="font-weight: 700; color: #d4af37; font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>ℹ️</span>
                <span>Event Details</span>
            </div>
            ${detailsHTML}
        </div>
    `;
}

/**
 * Create custom questions HTML
 */
function createCustomQuestionsHTML(customQuestions) {
    if (!customQuestions || customQuestions.length === 0) {
        return '';
    }

    return customQuestions.map(q => {
        const type = q.type || 'text';
        let inputHTML = '';

        switch(type) {
            case 'text':
                inputHTML = `<textarea id="${q.id}" class="custom-question-response" data-question-type="text" placeholder="Your answer..." rows="3"></textarea>`;
                break;

            case 'choice':
                if (q.options && q.options.length > 0) {
                    inputHTML = `<select id="${q.id}" class="custom-question-response" data-question-type="choice">
                        <option value="">-- Select an option --</option>
                        ${q.options.map(opt => `<option value="${window.utils.escapeHTML(opt)}">${window.utils.escapeHTML(opt)}</option>`).join('')}
                    </select>`;
                } else {
                    inputHTML = `<p style="color: var(--error-color);">No options configured for this question.</p>`;
                }
                break;

            case 'date':
                inputHTML = `<input type="date" id="${q.id}" class="custom-question-response" data-question-type="date">`;
                break;

            case 'datetime':
                inputHTML = `<div class="datetime-input-group">
                    <input type="date" id="${q.id}_date" class="custom-question-response-date" data-question-type="datetime" placeholder="Date">
                    <input type="time" id="${q.id}_time" class="custom-question-response-time" data-question-type="datetime" placeholder="Time">
                </div>
                <input type="hidden" id="${q.id}" class="custom-question-response" data-question-type="datetime">`;
                break;

            default:
                inputHTML = `<textarea id="${q.id}" class="custom-question-response" data-question-type="text" placeholder="Your answer..." rows="3"></textarea>`;
        }

        return `
            <div class="form-group">
                <label for="${q.id}">${window.utils.escapeHTML(q.question)}</label>
                ${inputHTML}
            </div>
        `;
    }).join('');
}

/**
 * Toggle guest count visibility
 */
function toggleGuestCount(attending) {
    const guestCountGroup = document.getElementById('guest-count-group');
    if (guestCountGroup) {
        if (attending) {
            guestCountGroup.style.display = 'block';
        } else {
            guestCountGroup.style.display = 'none';
            const guestCountSelect = document.getElementById('guest-count');
            if (guestCountSelect) {
                guestCountSelect.value = '0';
            }
        }
    }
}

/**
 * Setup datetime input synchronization for custom questions
 */
function setupDatetimeInputSync() {
    // Find all datetime question groups
    document.querySelectorAll('.datetime-input-group').forEach(group => {
        const dateInput = group.querySelector('.custom-question-response-date');
        const timeInput = group.querySelector('.custom-question-response-time');

        if (dateInput && timeInput) {
            const hiddenId = dateInput.id.replace('_date', '');
            const hiddenInput = document.getElementById(hiddenId);

            if (hiddenInput) {
                // Function to sync values
                const syncValues = () => {
                    if (dateInput.value && timeInput.value) {
                        hiddenInput.value = `${dateInput.value}T${timeInput.value}`;
                    } else if (dateInput.value) {
                        hiddenInput.value = dateInput.value;
                    } else {
                        hiddenInput.value = '';
                    }
                };

                // Attach listeners
                dateInput.addEventListener('change', syncValues);
                timeInput.addEventListener('change', syncValues);
            }
        }
    });
}

/**
 * Setup RSVP form functionality
 */
async function setupRSVPForm() {
    // Setup real-time validation if available
    if (window.rsvpHandler && window.rsvpHandler.setupRealTimeValidation) {
        window.rsvpHandler.setupRealTimeValidation();
    }

    // Setup datetime input synchronization
    setupDatetimeInputSync();

    // Check for edit mode and pre-fill if editing
    if (window.rsvpHandler && window.rsvpHandler.initEditMode) {
        const existingRSVP = await window.rsvpHandler.initEditMode();
        if (existingRSVP) {
            window.rsvpHandler.prefillEditForm(existingRSVP);
            return; // Skip regular prefill if in edit mode
        }
    }

    // Pre-fill form if URL parameters exist (for new RSVPs)
    if (window.rsvpHandler && window.rsvpHandler.prefillFormFromURL) {
        window.rsvpHandler.prefillFormFromURL();
    }
}

/**
 * Get event data from URL parameters
 */
// function getEventFromURL() {
function getEventFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');

    if (encodedData) {
        try {
            // Prefer URL-encoded JSON
            return JSON.parse(decodeURIComponent(encodedData));
        } catch (e1) {
            try {
                // Fallback for legacy Base64 links
                return JSON.parse(atob(encodedData));
            } catch (e2) {
                console.error('Failed to decode event data from URL:', e1, e2);
                return null;
            }
        }
    }
    return null;
}

/**
 * Check if event is in the past
 */
function isEventInPast(date, time = '00:00') {
    const eventDateTime = new Date(`${date}T${time}`);
    return eventDateTime < new Date();
}

/**
 * Format date for display
 */
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

/**
 * Format time for display
 */
function formatTime(time) {
    if (!time) return '';
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Create past event HTML
 */
function createPastEventHTML(event) {
    return `
        <div class="invite-display">
            <div class="invite-header">
                <h2 style="text-align: center; color: #ef4444;">Event Has Passed</h2>
            </div>
            <div class="invite-content">
                <h1 class="invite-title" style="color: #6b7280;">${event.title}</h1>
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
                </div>
                <div style="text-align: center; padding: 2rem; color: #6b7280;">
                    <p>This event has already taken place. RSVPs are no longer being accepted.</p>
                </div>
                <div class="invite-powered-by">
                    <div class="powered-by-text">Powered by</div>
                    <a href="https://linktr.ee/semperadmin" target="_blank" class="powered-by-link">
                        SEMPER ADMIN
                    </a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Create invite with image HTML
 */
function createInviteWithImageHTML(event, eventId) {
    return `
        <div class="invite-image-section" style="--bg-image: url('${event.coverImage}')">
            <img src="${event.coverImage}" alt="Event cover" class="invite-image">
        </div>
        <div class="invite-details-section">
            <h1 class="invite-title-main">${escapeHTML(event.title)}</h1>
            <div class="invite-details">
                <div class="invite-detail">
                    <strong>📅 Date:</strong> ${formatDate(event.date)}
                </div>
                <div class="invite-detail">
                    <strong>🕐 Time:</strong> ${formatTime(event.time)}
                </div>
                ${event.location ? `
                    <div class="invite-detail">
                        <strong>📍 Location:</strong> ${escapeHTML(event.location)}
                        <div style="margin-top: 0.5rem;">
                            <a href="https://maps.google.com/?q=${encodeURIComponent(event.location)}"
                               target="_blank"
                               class="btn"
                               style="display: inline-block; padding: 0.5rem 1rem; font-size: 0.875rem; text-decoration: none;">
                                🗺️ Get Directions
                            </a>
                        </div>
                    </div>
                ` : ''}
                ${event.description ? `
                    <div class="invite-detail">
                        <strong>📝 Details:</strong> ${escapeHTML(event.description)}
                    </div>
                ` : ''}
                ${createEventDetailsHTML(event.eventDetails)}
                ${createRSVPSettingsHTML(event)}
            </div>
            <div style="margin: 1.5rem 0; text-align: center;">
                <div style="display: inline-block;">
                    ${window.calendarExport ? window.calendarExport.generateCalendarDropdownHTML(event) : ''}
                </div>
            </div>
            ${createRSVPFormHTML(event, eventId)}
            <div class="invite-powered-by">
                <div class="powered-by-text">Powered by</div>
                <a href="https://linktr.ee/semperadmin" target="_blank" class="powered-by-link">
                    SEMPER ADMIN
                </a>
            </div>
        </div>
    `;
}

/**
 * Update rank dropdown based on selected service branch
 */
function updateRanksForBranch() {
    const branchSelect = document.getElementById('branch');
    const rankSelect = document.getElementById('rank');

    if (!branchSelect || !rankSelect || !window.MilitaryData) {
        return;
    }

    const selectedBranch = branchSelect.value;

    // Clear current ranks
    rankSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select rank...';
    rankSelect.appendChild(defaultOption);

    if (!selectedBranch || selectedBranch === 'Civilian' || selectedBranch === 'Other') {
        // For Civilian or Other, just add a Civilian option and disable
        rankSelect.innerHTML = '';
        const option = document.createElement('option');

        if (selectedBranch === 'Civilian') {
            option.value = 'Civilian';
            option.textContent = 'Civilian';
            rankSelect.appendChild(option);
            rankSelect.disabled = true;
        } else if (selectedBranch === 'Other') {
            option.value = '';
            option.textContent = 'N/A';
            rankSelect.appendChild(option);
            rankSelect.disabled = true;
        } else {
            option.value = '';
            option.textContent = 'Select service branch first...';
            rankSelect.appendChild(option);
            rankSelect.disabled = true;
        }
        return;
    }

    // Get ranks for selected branch
    const branchData = window.MilitaryData[selectedBranch];

    if (!branchData) {
        rankSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No ranks available';
        rankSelect.appendChild(option);
        rankSelect.disabled = true;
        return;
    }

    // Enable the rank dropdown
    rankSelect.disabled = false;

    // Add officer ranks
    if (branchData.officer && branchData.officer.length > 0) {
        const officerGroup = document.createElement('optgroup');
        officerGroup.label = 'Officer';
        branchData.officer.forEach(rank => {
            const option = document.createElement('option');
            option.value = rank.value;
            option.textContent = rank.label;
            officerGroup.appendChild(option);
        });
        rankSelect.appendChild(officerGroup);
    }

    // Add warrant officer ranks
    if (branchData.warrant && branchData.warrant.length > 0) {
        const warrantGroup = document.createElement('optgroup');
        warrantGroup.label = 'Warrant Officer';
        branchData.warrant.forEach(rank => {
            const option = document.createElement('option');
            option.value = rank.value;
            option.textContent = rank.label;
            warrantGroup.appendChild(option);
        });
        rankSelect.appendChild(warrantGroup);
    }

    // Add enlisted ranks
    if (branchData.enlisted && branchData.enlisted.length > 0) {
        const enlistedGroup = document.createElement('optgroup');
        enlistedGroup.label = 'Enlisted';
        branchData.enlisted.forEach(rank => {
            const option = document.createElement('option');
            option.value = rank.value;
            option.textContent = rank.label;
            enlistedGroup.appendChild(option);
        });
        rankSelect.appendChild(enlistedGroup);
    }

    // Add Civilian option at the end
    const civilianOption = document.createElement('option');
    civilianOption.value = 'Civilian';
    civilianOption.textContent = 'Civilian';
    rankSelect.appendChild(civilianOption);
}

// Make functions globally available
window.loadInviteContentDirect = loadInviteContentDirect;
window.toggleGuestCount = toggleGuestCount;
window.getEventFromURL = getEventFromURL;
window.isEventInPast = isEventInPast;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.createPastEventHTML = createPastEventHTML;
window.createInviteWithImageHTML = createInviteWithImageHTML;
window.updateRanksForBranch = updateRanksForBranch;

function createRSVPSettingsHTML(event) {
    const badges = [];
    if (event.askReason) {
        badges.push(`<span style="display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .6rem;border-radius:999px;background:#e0f2fe;color:#0c4a6e;border:1px solid #7dd3fc;">💬 Ask why attending</span>`);
    }
    if (event.allowGuests) {
        badges.push(`<span style="display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .6rem;border-radius:999px;background:#f0fdf4;color:#064e3b;border:1px solid #86efac;">👥 Allow additional guests</span>`);
    }
    if (event.requiresMealChoice) {
        badges.push(`<span style="display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .6rem;border-radius:999px;background:#fff7ed;color:#7c2d12;border:1px solid #fdba74;">🍽️ Meal/dietary choices required</span>`);
    }
    if (badges.length === 0) return '';
    return `
        <div style="margin-top:1rem;">
            <div style="font-weight:700;color:#1a1f2e;font-size:1rem;margin-bottom:.5rem;display:flex;align-items:center;gap:.5rem;">
                <span>⚙️</span><span>RSVP Settings</span>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;">${badges.join(' ')}</div>
        </div>
    `;
}

// In functions that render HTML (e.g., buildInviteForm, renderAttendeeRow)
function renderAttendeeRow(att) {
    const h = window.utils.escapeHTML;

    const rowHTML = `
        <div class="attendee-row" data-id="${h(att.rsvpId)}">
            <div class="name">${h(att.name || '')}</div>
            <div class="email">${h(att.email || '')}</div>
            <div class="phone">${h(att.phone || '')}</div>
            <div class="branch">${h(att.branch || '')}</div>
            <div class="rank">${h(att.rank || '')}</div>
            <div class="unit">${h(att.unit || '')}</div>
        </div>
    `;
    
    return rowHTML;
}
