/**
 * User RSVPs Management
 * Displays and manages RSVPs for the current user
 */

let currentEditingRSVP = null;

/**
 * Get all RSVPs for the current user across all events
 */
async function getUserRSVPs() {
    if (!window.userAuth || !window.userAuth.isAuthenticated()) {
        return [];
    }

    const user = window.userAuth.getCurrentUser();
    const userEmail = user.email?.toLowerCase();

    if (!userEmail) {
        console.warn('User email not available');
        return [];
    }

    const allRSVPs = [];

    // Scan localStorage for all eventcall_pending_rsvps_* keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('eventcall_pending_rsvps_')) {
            try {
                const data = localStorage.getItem(key);
                if (data) {
                    const rsvps = JSON.parse(data);
                    if (Array.isArray(rsvps)) {
                        // Filter RSVPs that match user's email
                        const userRSVPsInEvent = rsvps.filter(rsvp =>
                            rsvp.email && rsvp.email.toLowerCase() === userEmail
                        );
                        allRSVPs.push(...userRSVPsInEvent);
                    }
                }
            } catch (e) {
                console.error(`Error parsing RSVPs from ${key}:`, e);
            }
        }
    }

    // Also check secure storage if available
    if (window.utils && window.utils.secureStorageSync) {
        // TODO: Implement secure storage scanning if needed
    }

    return allRSVPs;
}

/**
 * Load event data for an RSVP
 */
async function getEventForRSVP(eventId) {
    try {
        // Check if events-index.json exists and load it
        const response = await fetch('events-index.json');
        if (response.ok) {
            const eventsIndex = await response.json();
            return eventsIndex.events?.find(e => e.id === eventId);
        }
    } catch (e) {
        console.error('Error loading event data:', e);
    }

    // Fallback: check if event data is in memory
    if (window.events && Array.isArray(window.events)) {
        return window.events.find(e => e.id === eventId);
    }

    return null;
}

/**
 * Display user's RSVPs in the dashboard
 */
async function displayUserRSVPs() {
    const container = document.getElementById('user-rsvps-list');
    if (!container) return;

    // Show loading state
    container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading your RSVPs...</div>';

    try {
        const rsvps = await getUserRSVPs();

        if (rsvps.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; background: rgba(255, 255, 255, 0.05); border-radius: 0.5rem; border: 2px dashed rgba(212, 175, 55, 0.3);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                    <h3 style="margin: 0 0 0.5rem 0; color: #d4af37;">No RSVPs Yet</h3>
                    <p style="margin: 0; color: #9ca3af;">Your RSVPs to events will appear here</p>
                </div>
            `;
            return;
        }

        // Load event data for each RSVP
        const rsvpsWithEvents = await Promise.all(
            rsvps.map(async (rsvp) => {
                const event = await getEventForRSVP(rsvp.eventId);
                return { rsvp, event };
            })
        );

        // Sort by event date (upcoming first)
        rsvpsWithEvents.sort((a, b) => {
            if (!a.event || !b.event) return 0;
            const dateA = new Date(a.event.date + ' ' + a.event.time);
            const dateB = new Date(b.event.date + ' ' + b.event.time);
            return dateA - dateB;
        });

        // Render RSVP cards
        const html = rsvpsWithEvents.map(({ rsvp, event }) => createRSVPCard(rsvp, event)).join('');
        container.innerHTML = html;

    } catch (error) {
        console.error('Error displaying user RSVPs:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; background: rgba(239, 68, 68, 0.1); border-radius: 0.5rem; border: 2px solid rgba(239, 68, 68, 0.3);">
                <strong style="color: #ef4444;">❌ Error loading RSVPs</strong>
                <p style="margin: 0.5rem 0 0 0; color: #9ca3af;">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Create HTML for a single RSVP card
 */
function createRSVPCard(rsvp, event) {
    const utils = window.utils || { escapeHTML: (s) => s, sanitizeHTML: (s) => s };

    // Determine if event is past
    const isPast = event ? isEventInPast(event.date, event.time) : false;
    const eventDate = event ? new Date(event.date + ' ' + event.time) : null;
    const formattedDate = event ? formatDate(event.date) : 'Unknown Date';
    const formattedTime = event ? formatTime(event.time) : 'Unknown Time';

    const attendingBadge = rsvp.attending
        ? '<span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.875rem; font-weight: 600;">✅ Attending</span>'
        : '<span style="background: #fef2f2; color: #991b1b; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.875rem; font-weight: 600;">❌ Not Attending</span>';

    const pastBadge = isPast
        ? '<span style="background: #e5e7eb; color: #6b7280; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.875rem; font-weight: 600;">📅 Past Event</span>'
        : '<span style="background: #dbeafe; color: #1e40af; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.875rem; font-weight: 600;">📅 Upcoming</span>';

    return `
        <div class="rsvp-card" style="background: linear-gradient(135deg, rgba(31, 41, 55, 0.8), rgba(17, 24, 39, 0.8)); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 0.5rem 0; color: #d4af37; font-size: 1.25rem;">
                        ${event ? utils.escapeHTML(event.title) : 'Event Not Found'}
                    </h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                        ${attendingBadge}
                        ${pastBadge}
                        ${rsvp.guestCount > 0 ? `<span style="background: #f0f9ff; color: #1e40af; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.875rem; font-weight: 600;">👥 +${rsvp.guestCount} Guest${rsvp.guestCount > 1 ? 's' : ''}</span>` : ''}
                    </div>
                </div>
            </div>

            ${event ? `
                <div style="display: grid; gap: 0.5rem; margin-bottom: 1rem; color: #9ca3af; font-size: 0.95rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span>📅</span>
                        <span>${formattedDate} at ${formattedTime}</span>
                    </div>
                    ${event.location ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span>📍</span>
                            <span>${utils.escapeHTML(event.location)}</span>
                        </div>
                    ` : ''}
                </div>
            ` : '<p style="color: #9ca3af; font-size: 0.95rem; margin-bottom: 1rem;">Event details not available</p>'}

            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                ${event && !isPast ? `
                    <button
                        onclick="openEditRSVPModal('${utils.escapeHTML(rsvp.rsvpId)}', '${utils.escapeHTML(rsvp.eventId)}')"
                        class="btn btn-primary"
                        style="font-size: 0.875rem; padding: 0.5rem 1rem;"
                    >
                        ✏️ Edit RSVP
                    </button>
                    <button
                        onclick="viewEventDetails('${utils.escapeHTML(rsvp.eventId)}')"
                        class="btn btn-secondary"
                        style="font-size: 0.875rem; padding: 0.5rem 1rem;"
                    >
                        👁️ View Event
                    </button>
                ` : ''}
            </div>

            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(212, 175, 55, 0.2); font-size: 0.75rem; color: #6b7280;">
                <strong>RSVP ID:</strong> ${rsvp.rsvpId}<br>
                <strong>Submitted:</strong> ${new Date(rsvp.timestamp).toLocaleString()}
            </div>
        </div>
    `;
}

/**
 * Open edit RSVP modal
 */
async function openEditRSVPModal(rsvpId, eventId) {
    const modal = document.getElementById('edit-rsvp-modal');
    if (!modal) return;

    // Find the RSVP
    const storageKey = `eventcall_pending_rsvps_${eventId}`;
    let rsvp = null;

    try {
        const data = localStorage.getItem(storageKey);
        if (data) {
            const rsvps = JSON.parse(data);
            rsvp = rsvps.find(r => r.rsvpId === rsvpId);
        }
    } catch (e) {
        console.error('Error loading RSVP:', e);
        showToast('❌ Error loading RSVP', 'error');
        return;
    }

    if (!rsvp) {
        showToast('❌ RSVP not found', 'error');
        return;
    }

    // Load event data
    const event = await getEventForRSVP(eventId);

    // Store current editing RSVP
    currentEditingRSVP = { rsvp, event, eventId };

    // Populate event info
    const eventInfoEl = document.getElementById('edit-rsvp-event-info');
    if (eventInfoEl && event) {
        eventInfoEl.innerHTML = `
            <h3 style="margin: 0 0 0.5rem 0; color: #d4af37; font-size: 1.1rem;">${window.utils?.escapeHTML(event.title) || event.title}</h3>
            <div style="color: #9ca3af; font-size: 0.9rem;">
                📅 ${formatDate(event.date)} at ${formatTime(event.time)}
                ${event.location ? `<br>📍 ${window.utils?.escapeHTML(event.location) || event.location}` : ''}
            </div>
        `;
    }

    // Populate form
    document.getElementById('edit-rsvp-name').value = rsvp.name || '';
    document.getElementById('edit-rsvp-email').value = rsvp.email || '';
    document.getElementById('edit-rsvp-phone').value = rsvp.phone || '';

    // Set attending radio button
    const attendingRadio = document.querySelector(`input[name="edit-attending"][value="${rsvp.attending}"]`);
    if (attendingRadio) {
        attendingRadio.checked = true;
        toggleEditGuestCount(rsvp.attending);
    }

    // Set guest count
    const guestCountEl = document.getElementById('edit-guest-count');
    if (guestCountEl) {
        guestCountEl.value = rsvp.guestCount || 0;
    }

    // Set reason if available
    const reasonEl = document.getElementById('edit-reason');
    if (reasonEl) {
        reasonEl.value = rsvp.reason || '';
        // Show reason field if event asks for it
        const reasonGroup = document.getElementById('edit-reason-group');
        if (reasonGroup && event && event.askReason) {
            reasonGroup.style.display = 'block';
        }
    }

    // Setup attending change listener
    document.querySelectorAll('input[name="edit-attending"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            toggleEditGuestCount(e.target.value === 'true');
        });
    });

    // Show modal
    modal.style.display = 'flex';
}

/**
 * Toggle guest count visibility in edit modal
 */
function toggleEditGuestCount(attending) {
    const guestCountGroup = document.getElementById('edit-guest-count-group');
    if (guestCountGroup) {
        guestCountGroup.style.display = attending ? 'block' : 'none';
    }
}

/**
 * Close edit RSVP modal
 */
function closeEditRSVPModal() {
    const modal = document.getElementById('edit-rsvp-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentEditingRSVP = null;
}

/**
 * Save edited RSVP
 */
async function saveEditedRSVP() {
    if (!currentEditingRSVP) {
        showToast('❌ No RSVP being edited', 'error');
        return;
    }

    const { rsvp, eventId } = currentEditingRSVP;

    // Collect form data
    const name = document.getElementById('edit-rsvp-name').value.trim();
    const email = document.getElementById('edit-rsvp-email').value.trim().toLowerCase();
    const phone = document.getElementById('edit-rsvp-phone').value.trim();
    const attendingRadio = document.querySelector('input[name="edit-attending"]:checked');
    const attending = attendingRadio ? attendingRadio.value === 'true' : null;
    const guestCount = parseInt(document.getElementById('edit-guest-count').value) || 0;
    const reason = document.getElementById('edit-reason')?.value.trim() || '';

    // Validate
    if (!name || name.length < 2) {
        showToast('❌ Please enter a valid name', 'error');
        return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('❌ Please enter a valid email address', 'error');
        return;
    }

    if (attending === null) {
        showToast('❌ Please select if you are attending', 'error');
        return;
    }

    // Update RSVP object
    const updatedRSVP = {
        ...rsvp,
        name,
        email,
        phone,
        attending,
        guestCount: attending ? guestCount : 0,
        reason,
        lastModified: Date.now(),
        isUpdate: true
    };

    // Save to localStorage
    const storageKey = `eventcall_pending_rsvps_${eventId}`;
    try {
        const data = localStorage.getItem(storageKey);
        if (data) {
            const rsvps = JSON.parse(data);
            const index = rsvps.findIndex(r => r.rsvpId === rsvp.rsvpId);
            if (index !== -1) {
                rsvps[index] = updatedRSVP;
                localStorage.setItem(storageKey, JSON.stringify(rsvps));

                // Submit update to backend if available
                if (window.BackendAPI) {
                    try {
                        await window.BackendAPI.submitRSVP(updatedRSVP);
                        showToast('✅ RSVP updated successfully', 'success');
                    } catch (e) {
                        console.error('Backend update failed:', e);
                        showToast('✅ RSVP updated locally (backend sync may be pending)', 'success');
                    }
                } else {
                    showToast('✅ RSVP updated successfully', 'success');
                }

                // Close modal and refresh display
                closeEditRSVPModal();
                displayUserRSVPs();
            } else {
                throw new Error('RSVP not found in storage');
            }
        }
    } catch (error) {
        console.error('Error saving RSVP:', error);
        showToast('❌ Error saving RSVP: ' + error.message, 'error');
    }
}

/**
 * View event details (navigate to event page)
 */
function viewEventDetails(eventId) {
    // TODO: Implement navigation to event details/invite page
    showToast('ℹ️ Event details view coming soon', 'info');
}

// Make functions globally available
window.getUserRSVPs = getUserRSVPs;
window.displayUserRSVPs = displayUserRSVPs;
window.openEditRSVPModal = openEditRSVPModal;
window.closeEditRSVPModal = closeEditRSVPModal;
window.saveEditedRSVP = saveEditedRSVP;
window.viewEventDetails = viewEventDetails;

// Auto-load RSVPs when dashboard loads
document.addEventListener('DOMContentLoaded', () => {
    // Load RSVPs when user is authenticated
    if (window.userAuth && window.userAuth.isAuthenticated()) {
        setTimeout(() => {
            displayUserRSVPs();
        }, 1000);
    }
});

console.log('✅ User RSVPs module loaded');
