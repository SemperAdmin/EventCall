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
                    </div>
                ` : ''}
                ${event.description ? `
                    <div class="invite-detail">
                        <strong>📝 Details:</strong> ${event.description}
                    </div>
                ` : ''}
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
function setupRSVPForm() {
    // Setup real-time validation if available
    if (window.rsvpHandler && window.rsvpHandler.setupRealTimeValidation) {
        window.rsvpHandler.setupRealTimeValidation();
    }
    
    // Pre-fill form if URL parameters exist
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
                    </div>
                ` : ''}
                ${event.description ? `
                    <div class="invite-detail">
                        <strong>📝 Details:</strong> ${event.description}
                    </div>
                ` : ''}
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

// Make functions globally available
window.loadInviteContentDirect = loadInviteContentDirect;
window.toggleGuestCount = toggleGuestCount;
window.getEventFromURL = getEventFromURL;
window.isEventInPast = isEventInPast;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.createPastEventHTML = createPastEventHTML;
window.createInviteWithImageHTML = createInviteWithImageHTML;