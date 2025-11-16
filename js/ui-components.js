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
function loadInviteContentDirect() {
    const event = getEventFromURL();
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

            <!-- Progress Indicator -->
            <div id="form-progress-container" style="margin-bottom: 1.5rem; display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.875rem; color: #6b7280; font-weight: 500;">Form Progress</span>
                        <span id="autosave-indicator" style="font-size: 0.75rem; color: #10b981; opacity: 0; transition: opacity 0.3s ease;">✓ Saved</span>
                    </div>
                    <span id="form-progress-text" style="font-size: 0.875rem; color: #059669; font-weight: 600;">0%</span>
                </div>
                <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                    <div id="form-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); transition: width 0.3s ease; border-radius: 4px;"></div>
                </div>
            </div>

            <form id="rsvp-form" data-event-id="${eventId}">
                <!-- Attending Decision - MOVED TO TOP -->
                <div style="margin-bottom: 2rem; padding: 1.5rem; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 1rem; border: 3px solid #3b82f6;">
                    <label style="font-weight: 700; margin-bottom: 1rem; display: block; font-size: 1.1rem; color: #1e40af; text-align: center;">Will you be attending? *</label>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <label class="rsvp-radio-option" style="flex: 1; min-width: 140px;">
                            <input type="radio" name="attending" value="true" required id="attending-yes">
                            <span>✅ Yes, I'll be there!</span>
                        </label>
                        <label class="rsvp-radio-option" style="flex: 1; min-width: 140px;">
                            <input type="radio" name="attending" value="false" required id="attending-no">
                            <span>❌ Can't make it</span>
                        </label>
                    </div>
                </div>

                <!-- Fields for DECLINE - Minimal info needed -->
                <div id="decline-fields" style="display: none;">
                    <p style="text-align: center; color: #6b7280; margin-bottom: 1.5rem; font-size: 0.95rem;">
                        We're sorry you can't make it! Please provide your name and email so we can update our records.
                    </p>

                    <div class="form-group">
                        <label for="rsvp-name-decline">Full Name *</label>
                        <input type="text" id="rsvp-name-decline" name="name" autocomplete="name" placeholder="John Smith" style="min-height: 44px;">
                    </div>

                    <div class="form-group">
                        <label for="rsvp-email-decline">Email Address *</label>
                        <input type="email" id="rsvp-email-decline" name="email" autocomplete="email" placeholder="john.smith@email.com" inputmode="email" style="min-height: 44px;">
                    </div>

                    ${event.askReason ? `
                        <div class="form-group">
                            <label for="reason-decline">Would you like to share why you can't attend? (Optional)</label>
                            <textarea id="reason-decline" placeholder="e.g., Prior commitment, traveling for work..." rows="3"></textarea>
                        </div>
                    ` : ''}
                </div>

                <!-- Fields for ACCEPT - Full details needed -->
                <div id="accept-fields" style="display: none;">
                    <p style="text-align: center; color: #059669; margin-bottom: 1.5rem; font-size: 0.95rem; font-weight: 600;">
                        Great! Please provide your details below.
                    </p>

                    <div class="form-group">
                        <label for="rsvp-name">Full Name *</label>
                        <input type="text" id="rsvp-name" name="name" autocomplete="name" placeholder="John Smith" style="min-height: 44px;">
                    </div>

                    <div class="form-group">
                        <label for="rsvp-email">Email Address *</label>
                        <input type="email" id="rsvp-email" name="email" autocomplete="email" placeholder="john.smith@email.com" inputmode="email" style="min-height: 44px;">
                    </div>

                    <div class="form-group">
                        <label for="rsvp-phone">Phone Number <span style="color: #6b7280; font-weight: 400;">(Optional)</span></label>
                        <input type="tel" id="rsvp-phone" name="tel" autocomplete="tel" placeholder="555-123-4567" inputmode="tel" style="min-height: 44px;">
                    </div>

                    ${event.allowGuests ? `
                        <div class="form-group" id="guest-count-group">
                            <label for="guest-count">How many additional guests will you bring? <span style="color: #6b7280; font-weight: 400;">(Optional)</span></label>
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

                    ${event.requiresMealChoice ? `
                        <div class="form-group">
                            <label>Dietary Restrictions (Optional)</label>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem;">
                                <label style="display: flex; align-items: center; cursor: pointer; min-height: 32px;">
                                    <input type="checkbox" name="dietary" value="vegetarian" style="margin-right: 0.5rem;">
                                    <span>Vegetarian</span>
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer; min-height: 32px;">
                                    <input type="checkbox" name="dietary" value="vegan" style="margin-right: 0.5rem;">
                                    <span>Vegan</span>
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer; min-height: 32px;">
                                    <input type="checkbox" name="dietary" value="gluten-free" style="margin-right: 0.5rem;">
                                    <span>Gluten-Free</span>
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer; min-height: 32px;">
                                    <input type="checkbox" name="dietary" value="dairy-free" style="margin-right: 0.5rem;">
                                    <span>Dairy-Free</span>
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer; min-height: 32px;">
                                    <input type="checkbox" name="dietary" value="halal" style="margin-right: 0.5rem;">
                                    <span>Halal</span>
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer; min-height: 32px;">
                                    <input type="checkbox" name="dietary" value="kosher" style="margin-right: 0.5rem;">
                                    <span>Kosher</span>
                                </label>
                            </div>
                            <div style="margin-top: 0.75rem;">
                                <input type="text" id="allergy-details" placeholder="e.g., Nut allergy, shellfish allergy..." style="min-height: 44px;">
                            </div>
                        </div>
                    ` : ''}

                    <!-- Military Information (Optional) - Collapsed by default -->
                    <details style="margin: 1.5rem 0; padding: 1rem; background: #f8fafc; border-left: 3px solid #cbd5e1; border-radius: 0.5rem;">
                        <summary style="font-weight: 500; margin-bottom: 0.75rem; color: #475569; cursor: pointer; list-style-position: outside;">
                            🎖️ Military Information <span style="color: #94a3b8; font-weight: 400;">(Optional - Click to expand)</span>
                        </summary>

                        <div class="form-group" style="margin-bottom: 1rem; margin-top: 1rem;">
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
                    </details>

                    ${createCustomQuestionsHTML(event.customQuestions || [])}

                    ${event.askReason ? `
                        <div class="form-group">
                            <label for="reason">Why are you attending? (Optional)</label>
                            <textarea id="reason" placeholder="Share your thoughts..." rows="3"></textarea>
                        </div>
                    ` : ''}
                </div>

                <div class="form-group" id="start-over-container" style="display: none; text-align: center;">
                  <button type="button" id="rsvp-start-over" class="btn-secondary" style="min-height: 44px;">🔄 Clear Form</button>
                </div>

                <div id="submit-container" style="display: none; text-align: center; margin-top: 1.5rem;">
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

        const requiredIndicator = q.required ? ' *' : ' <span style="color: #6b7280; font-weight: 400;">(Optional)</span>';
        return `
            <div class="form-group">
                <label for="${q.id}">${window.utils.escapeHTML(q.question)}${requiredIndicator}</label>
                ${inputHTML}
            </div>
        `;
    }).join('');
}

/**
 * Toggle attending/declining fields based on user selection
 * Returns a Promise that resolves when fields are displayed and focused
 */
function toggleAttendingFields(attending) {
    return new Promise((resolve) => {
        const acceptFields = document.getElementById('accept-fields');
        const declineFields = document.getElementById('decline-fields');
        const submitContainer = document.getElementById('submit-container');
        const startOverContainer = document.getElementById('start-over-container');

        const targetFields = attending ? acceptFields : declineFields;
        const hideFields = attending ? declineFields : acceptFields;

        // Show target fields, hide opposite
        if (targetFields) targetFields.style.display = 'block';
        if (hideFields) hideFields.style.display = 'none';

        // Show submit and start over buttons
        if (submitContainer) submitContainer.style.display = 'block';
        if (startOverContainer) startOverContainer.style.display = 'block';

        // Clear validation states when switching
        clearAllValidationStates();

        // Handle scroll and focus using requestAnimationFrame + IntersectionObserver
        if (targetFields) {
            requestAnimationFrame(() => {
                targetFields.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // Use IntersectionObserver to detect when element is in view
                const observer = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        observer.disconnect();

                        // Focus on first input after scroll completes
                        const inputSelector = attending ?
                            'input[type="text"], input[type="email"]' :
                            'input[type="text"]';
                        const firstInput = targetFields.querySelector(inputSelector);

                        if (firstInput) {
                            firstInput.focus();
                        }
                        resolve();
                    }
                }, { threshold: 0.5 });

                observer.observe(targetFields);

                // Fallback timeout in case observer doesn't fire (1 second max)
                setTimeout(() => {
                    observer.disconnect();
                    resolve();
                }, 1000);
            });
        } else {
            resolve();
        }
    });
}

/**
 * Clear all validation states from form fields
 */
function clearAllValidationStates() {
    const form = document.getElementById('rsvp-form');
    if (!form) return;

    form.querySelectorAll('.is-valid, .is-invalid').forEach(el => {
        el.classList.remove('is-valid', 'is-invalid');
        el.removeAttribute('aria-invalid');
        el.removeAttribute('aria-describedby');
    });

    form.querySelectorAll('.form-error').forEach(err => err.remove());
}

/**
 * Toggle guest count visibility (DEPRECATED)
 * This function has been replaced by toggleAttendingFields()
 *
 * Kept for backward compatibility in case any external code or bookmarked
 * URLs reference this function. Will be removed in a future version.
 *
 * @deprecated Use toggleAttendingFields() instead
 * @param {boolean} attending - Whether the user is attending
 */
function toggleGuestCount(attending) {
    // No-op - functionality moved to toggleAttendingFields
    if (window.toggleAttendingFields) {
        window.toggleAttendingFields(attending);
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
    // Setup real-time validation and autosave from form-ux.js
    if (window.attachRSVPValidation) {
        window.attachRSVPValidation();
    }

    // Setup datetime input synchronization
    setupDatetimeInputSync();

    // Setup military rank dropdown
    setupMilitaryRankDropdown();

    // Attach event listeners to attending radio buttons
    const attendingYes = document.getElementById('attending-yes');
    const attendingNo = document.getElementById('attending-no');

    if (attendingYes) {
        attendingYes.addEventListener('change', () => {
            if (attendingYes.checked) {
                toggleAttendingFields(true);
            }
        });
    }

    if (attendingNo) {
        attendingNo.addEventListener('change', () => {
            if (attendingNo.checked) {
                toggleAttendingFields(false);
            }
        });
    }

    // Setup "Start Over" / "Clear Form" button
    const startOverBtn = document.getElementById('rsvp-start-over');
    if (startOverBtn) {
        startOverBtn.addEventListener('click', function() {
            const form = document.getElementById('rsvp-form');
            if (form && confirm('Are you sure you want to clear the form and start over?')) {
                // Reset the form
                form.reset();

                // Hide all conditional sections
                const acceptFields = document.getElementById('accept-fields');
                const declineFields = document.getElementById('decline-fields');
                const submitContainer = document.getElementById('submit-container');
                const startOverContainer = document.getElementById('start-over-container');

                if (acceptFields) acceptFields.style.display = 'none';
                if (declineFields) declineFields.style.display = 'none';
                if (submitContainer) submitContainer.style.display = 'none';
                if (startOverContainer) startOverContainer.style.display = 'none';

                // Clear validation states
                clearAllValidationStates();

                // Scroll back to attending decision
                const attendingSection = form.querySelector('[name="attending"]');
                if (attendingSection) {
                    attendingSection.closest('div').scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                // Clear autosave if exists
                try {
                    const event = getEventFromURL();
                    if (event && event.id) {
                        localStorage.removeItem(`form:rsvp:${event.id}`);
                    }
                } catch (e) {
                    console.warn('Could not clear autosave:', e);
                }
            }
        });
    }

    // CRITICAL: Attach form submit handler to prevent navigation
    const rsvpForm = document.getElementById('rsvp-form');
    if (rsvpForm) {
        // Remove inline handler to avoid conflicts
        rsvpForm.removeAttribute('onsubmit');

        // Get event ID from data attribute or URL
        const eventId = rsvpForm.dataset.eventId || getEventFromURL()?.id;

        if (eventId) {
            // Use capture phase to intercept before any bubbling handlers
            rsvpForm.addEventListener('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('🛑 Form submit intercepted - preventing navigation');

                if (window.handleRSVP) {
                    window.handleRSVP(e, eventId);
                } else {
                    console.error('❌ handleRSVP not available');
                }

                return false;
            }, true); // Capture phase

            console.log('✅ RSVP form submit handler attached via addEventListener for event:', eventId);
        } else {
            console.error('❌ Could not determine eventId for RSVP form');
        }
    } else {
        console.warn('⚠️ RSVP form not found in DOM yet');
    }

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

    // Setup form progress indicator
    setupFormProgress();
}

/**
 * Setup form progress tracking
 */
function setupFormProgress() {
    const form = document.getElementById('rsvp-form');
    const progressContainer = document.getElementById('form-progress-container');
    const progressBar = document.getElementById('form-progress-bar');
    const progressText = document.getElementById('form-progress-text');

    if (!form || !progressContainer || !progressBar || !progressText) return;

    function updateProgress() {
        // Get all visible required fields
        const requiredFields = Array.from(form.querySelectorAll('input[required], select[required], textarea[required]'))
            .filter(field => {
                // Only count visible fields
                const parent = field.closest('#accept-fields, #decline-fields');
                if (parent) {
                    return parent.style.display !== 'none';
                }
                // For attending radio buttons, always count them
                if (field.name === 'attending') return true;
                return field.offsetParent !== null;
            });

        if (requiredFields.length === 0) return;

        // Calculate unique required fields (dedup radio buttons)
        const uniqueRequired = new Set();
        const filledSet = new Set();

        requiredFields.forEach(field => {
            const fieldKey = field.type === 'radio' ? field.name : (field.id || field.name);
            uniqueRequired.add(fieldKey);

            // Check if filled
            let isFilled = false;
            if (field.type === 'radio') {
                isFilled = form.querySelector(`input[name="${field.name}"]:checked`) !== null;
            } else if (field.type === 'checkbox') {
                isFilled = field.checked;
            } else {
                isFilled = field.value.trim() !== '';
            }

            if (isFilled) {
                filledSet.add(fieldKey);
            }
        });

        const totalRequired = uniqueRequired.size;
        const totalFilled = filledSet.size;
        const percentage = Math.round((totalFilled / totalRequired) * 100);

        // Update progress bar
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;

        // Show progress container once user starts filling
        if (totalFilled > 0 && progressContainer.style.display === 'none') {
            progressContainer.style.display = 'block';
        }
    }

    // Update progress on any input change
    form.addEventListener('input', updateProgress);
    form.addEventListener('change', updateProgress);

    // Initial update
    updateProgress();
}

/**
 * Setup military rank dropdown change listener
 */
function setupMilitaryRankDropdown() {
    const branchSelect = document.getElementById('branch');
    if (branchSelect) {
        // Remove any existing listeners by replacing the element
        const newBranchSelect = branchSelect.cloneNode(true);
        branchSelect.parentNode.replaceChild(newBranchSelect, branchSelect);

        // Add the change event listener
        newBranchSelect.addEventListener('change', function() {
            if (window.updateRanksForBranch) {
                window.updateRanksForBranch();
            }
        });

        console.log('✅ Military rank dropdown listener attached');
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
window.toggleAttendingFields = toggleAttendingFields;
window.clearAllValidationStates = clearAllValidationStates;
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
