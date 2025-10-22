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
        document.getElementById('invite-content').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #ef4444;">
                <h2>❌ Event Not Found</h2>
                <p>This invite link may be invalid or the event may have been deleted.</p>
            </div>
        `;
        return;
    }
    
    const eventId = event.id;
    const isPast = isEventInPast(event.date, event.time);
    
    if (isPast) {
        document.getElementById('invite-content').innerHTML = createPastEventHTML(event);
        return;
    }
    
    document.getElementById('invite-content').innerHTML = createInviteHTML(event, eventId);
    
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
function createInviteWithoutImageHTML(event, eventId) {
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
                        <strong>📝 Details:</strong> ${event.description}
                    </div>
                ` : ''}
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
                    <input type="tel" id="rsvp-phone" name="tel" autocomplete="tel" placeholder="(555) 123-4567" inputmode="tel" style="min-height: 44px;">
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

                ${event.askReason ? `
                    <div class="form-group">
                        <label for="reason">Why are you attending? (Optional)</label>
                        <textarea id="reason" placeholder="Share your thoughts..." rows="3"></textarea>
                    </div>
                ` : ''}
                
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
 * Create custom questions HTML
 */
function createCustomQuestionsHTML(customQuestions) {
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
 * Setup RSVP form functionality
 */
async function setupRSVPForm() {
    // Setup real-time validation if available
    if (window.rsvpHandler && window.rsvpHandler.setupRealTimeValidation) {
        window.rsvpHandler.setupRealTimeValidation();
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
}

/**
 * Get event data from URL parameters
 */
function getEventFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    
    if (encodedData) {
        try {
            return JSON.parse(atob(encodedData));
        } catch (e) {
            console.error('Failed to decode event data from URL:', e);
            return null;
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
                        <strong>📝 Details:</strong> ${event.description}
                    </div>
                ` : ''}
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
    rankSelect.innerHTML = '<option value="">Select rank...</option>';

    if (!selectedBranch || selectedBranch === 'Civilian' || selectedBranch === 'Other') {
        // For Civilian or Other, just add a Civilian option and disable
        if (selectedBranch === 'Civilian') {
            rankSelect.innerHTML = '<option value="Civilian">Civilian</option>';
            rankSelect.disabled = true;
        } else if (selectedBranch === 'Other') {
            rankSelect.innerHTML = '<option value="">N/A</option>';
            rankSelect.disabled = true;
        } else {
            rankSelect.innerHTML = '<option value="">Select service branch first...</option>';
            rankSelect.disabled = true;
        }
        return;
    }

    // Get ranks for selected branch
    const branchData = window.MilitaryData[selectedBranch];

    if (!branchData) {
        rankSelect.innerHTML = '<option value="">No ranks available</option>';
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