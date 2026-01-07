/**
 * Manager System - Enhanced with RSVP Sync Functionality and Email Auth
 * Added GitHub Issues processing, real-time sync capabilities, and userAuth support
 * Version: 2.0 - Tabbed Dashboard UI
 */

console.log('📦 manager-system.js loaded - Version 2.0 (Tabbed Dashboard)');

// Global sync state
let syncInProgress = false;
let pendingRSVPCount = 0;

// Guard flag and promise for loadManagerData
let loadManagerDataInProgress = false;
let loadManagerDataPromise = null;

// Debounce helper for loadManagerData
let loadManagerDataDebounceTimer = null;
function debouncedLoadManagerData(delay = 300) {
    if (loadManagerDataDebounceTimer) {
        clearTimeout(loadManagerDataDebounceTimer);
    }
    loadManagerDataDebounceTimer = setTimeout(() => {
        loadManagerDataDebounceTimer = null;
        loadManagerData();
    }, delay);
}

// =============================================================================
// EVENT CREATION CANCEL HANDLING
// =============================================================================

/**
 * Check if the event form has any unsaved changes
 * @returns {boolean} True if form has data
 */
function hasEventFormData() {
    const form = document.getElementById('event-form');
    if (!form) return false;

    const title = document.getElementById('event-title')?.value?.trim() || '';
    const date = document.getElementById('event-date')?.value || '';
    const time = document.getElementById('event-time')?.value || '';
    const location = document.getElementById('event-location')?.value?.trim() || '';
    const description = document.getElementById('event-description')?.value?.trim() || '';
    const coverImage = document.getElementById('cover-image-url')?.value || '';
    const customQuestions = document.querySelectorAll('.custom-question-item');

    // Check if any field has data
    return !!(title || date || time || location || description || coverImage || customQuestions.length > 0);
}

/**
 * Handle cancel event creation - shows confirmation if form has data
 */
function handleCancelEventCreation() {
    if (hasEventFormData()) {
        // Show confirmation modal
        const modal = document.getElementById('cancel-event-modal');
        if (modal) {
            modal.classList.add('is-visible');
            // Focus the "Keep Editing" button for accessibility
            const keepEditingBtn = modal.querySelector('.btn-secondary');
            if (keepEditingBtn) keepEditingBtn.focus();
        }
    } else {
        // No data, go directly to dashboard
        navigateToDashboard();
    }
}

/**
 * Close the cancel confirmation modal
 */
function closeCancelModal() {
    const modal = document.getElementById('cancel-event-modal');
    if (modal) {
        modal.classList.remove('is-visible');
    }
}

/**
 * Confirm cancellation and navigate to dashboard
 * Draft is automatically saved by form-ux.js, so just navigate away
 */
function confirmCancelEventCreation() {
    closeCancelModal();
    navigateToDashboard();
}

/**
 * Navigate to dashboard and clear form state
 */
function navigateToDashboard() {
    // Reset the form
    const form = document.getElementById('event-form');
    if (form) {
        form.reset();
        // Clear custom questions
        const questionsContainer = document.getElementById('custom-questions-container');
        if (questionsContainer) questionsContainer.innerHTML = '';
        // Clear event details
        const detailsContainer = document.getElementById('event-details-container');
        if (detailsContainer) detailsContainer.innerHTML = '';
        const detailsSection = document.getElementById('event-details-section');
        if (detailsSection) detailsSection.classList.add('hidden');
        // Clear cover image preview
        const coverPreview = document.getElementById('cover-preview');
        if (coverPreview) {
            coverPreview.src = '';
            coverPreview.classList.add('hidden');
        }
        const coverUrl = document.getElementById('cover-image-url');
        if (coverUrl) coverUrl.value = '';
        // Reset seating chart
        const seatingCheckbox = document.getElementById('enable-seating');
        if (seatingCheckbox) seatingCheckbox.checked = false;
        const seatingFields = document.getElementById('seating-config-fields');
        if (seatingFields) seatingFields.classList.add('hidden');
        // Remove any error states
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        form.querySelectorAll('.form-error').forEach(el => el.remove());
        const errorSummary = form.querySelector('#form-error-summary');
        if (errorSummary) errorSummary.remove();
        // Remove draft recovery banner if visible
        const draftBanner = document.getElementById('draft-recovery-banner');
        if (draftBanner) draftBanner.remove();
    }

    // Navigate to dashboard using unified navigation
    if (typeof window.navigateTo === 'function') {
        window.navigateTo('dashboard');
    } else if (typeof showPage === 'function') {
        showPage('dashboard');
    }
}

/**
 * Setup keyboard shortcut (Escape) to cancel event creation
 */
function setupEventFormKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Only handle Escape key
        if (e.key !== 'Escape') return;

        // Check if we're on the create page
        const createPage = document.getElementById('create');
        if (!createPage || !createPage.classList.contains('active')) return;

        // Don't trigger if a modal is open (let modal handle its own Escape)
        const openModals = document.querySelectorAll('.modal-overlay.is-visible');
        if (openModals.length > 0) {
            // If cancel modal is open, close it
            const cancelModal = document.getElementById('cancel-event-modal');
            if (cancelModal && cancelModal.classList.contains('is-visible')) {
                closeCancelModal();
            }
            return;
        }

        // Don't trigger if focus is in a textarea (user might be using Escape for other purposes)
        if (document.activeElement?.tagName === 'TEXTAREA') return;

        // Trigger cancel
        handleCancelEventCreation();
    });
}

// Initialize keyboard shortcuts when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEventFormKeyboardShortcuts);
} else {
    setupEventFormKeyboardShortcuts();
}

// =============================================================================
// FORM PROGRESS INDICATOR
// =============================================================================

/**
 * Update the form progress bar based on required field completion
 */
function updateFormProgress() {
    const form = document.getElementById('event-form');
    const progressFill = document.getElementById('form-progress-fill');
    const progressStatus = document.getElementById('form-progress-status');

    if (!form || !progressFill || !progressStatus) return;

    // Required fields
    const requiredFields = [
        { id: 'event-title', name: 'Title', minLength: 3 },
        { id: 'event-date', name: 'Date' },
        { id: 'event-time', name: 'Time' }
    ];

    let completedCount = 0;
    const missingFields = [];

    requiredFields.forEach(field => {
        const input = document.getElementById(field.id);
        if (!input) return;

        const value = input.value?.trim() || '';
        const isComplete = field.minLength
            ? value.length >= field.minLength
            : value.length > 0;

        if (isComplete) {
            completedCount++;
        } else {
            missingFields.push(field.name);
        }
    });

    // Calculate percentage
    const percentage = Math.round((completedCount / requiredFields.length) * 100);
    progressFill.style.width = `${percentage}%`;

    // Update status text and styling via CSS classes
    if (percentage === 100) {
        progressStatus.textContent = 'Ready to deploy your event!';
        progressFill.classList.add('form-progress__fill--complete');
    } else {
        progressFill.classList.remove('form-progress__fill--complete');
        if (percentage > 0) {
            const remaining = missingFields.join(', ');
            progressStatus.textContent = `Still needed: ${remaining}`;
        } else {
            progressStatus.textContent = 'Fill in the required fields to deploy your event';
        }
    }
}

/**
 * Setup form progress tracking
 */
function setupFormProgressTracking() {
    const form = document.getElementById('event-form');
    if (!form) return;

    // Track changes on required fields
    const requiredInputs = ['event-title', 'event-date', 'event-time'];

    requiredInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', updateFormProgress);
            input.addEventListener('change', updateFormProgress);
        }
    });

    // Initial update
    updateFormProgress();
}

// Initialize form progress when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupFormProgressTracking);
} else {
    setupFormProgressTracking();
}

// Expose functions to window for external access
window.updateFormProgress = updateFormProgress;
window.handleCancelEventCreation = handleCancelEventCreation;
window.closeCancelModal = closeCancelModal;
window.confirmCancelEventCreation = confirmCancelEventCreation;

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
            <button type="button" class="btn-add-option" onclick="addQuestionOption(this)">
                <span class="btn-add-option__icon">+</span>
                <span class="btn-add-option__text">Add Option</span>
            </button>
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
            addQuestionOption(optionsContainer.querySelector('.btn-add-option'));
            addQuestionOption(optionsContainer.querySelector('.btn-add-option'));
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
 * Sync/Refresh Data
 */
async function syncWithGitHub() {
    if (syncInProgress) {
        showToast('⏳ Refresh already in progress...', 'error');
        return;
    }

    if (!isUserAuthenticated()) {
        showToast('🔒 Please login to refresh data', 'error');
        return;
    }

    syncInProgress = true;
    
    try {
        // Update button state
        const syncButtons = document.querySelectorAll('[onclick*="syncWithGitHub"]');
        syncButtons.forEach(btn => {
            btn.innerHTML = window.utils.sanitizeHTML('<div class="spinner"></div> Refreshing...');
            btn.disabled = true;
        });

        showToast('🔄 Refreshing data from backend...', 'success');

        // Reload data
        await loadManagerData();
        
        showToast('✅ Data refreshed successfully!', 'success');
        
        // Clear pending count as we are now real-time
        updateDashboardSyncStatus(0);

    } catch (error) {
        console.error('Refresh failed:', error);
        showToast('❌ Refresh failed: ' + error.message, 'error');
    } finally {
        syncInProgress = false;
        
        // Reset button state
        const syncButtons = document.querySelectorAll('[onclick*="syncWithGitHub"]');
        syncButtons.forEach(btn => {
            btn.textContent = '🔄 Refresh Data';
            btn.disabled = false;
        });
    }
}

/**
 * Update pending RSVP count in UI
 */
async function updatePendingRSVPCount() {
    // Legacy function - no longer needed with direct backend
    updateDashboardSyncStatus(0);
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
    // If already in progress, return the existing promise so callers can await it
    if (loadManagerDataInProgress && loadManagerDataPromise) {
        console.log('⏳ loadManagerData already in progress, awaiting existing promise...');
        return loadManagerDataPromise;
    }

    loadManagerDataInProgress = true;
    console.log('📊 Loading manager data...');

    // Track loading state for consistent UI
    if (window.LoadingStateManager) {
        window.LoadingStateManager.startLoading('dashboard', { message: 'Loading events...' });
    }

    // Create a promise that resolves when loading is complete
    loadManagerDataPromise = (async () => {

    try {
        if (!window.events) window.events = {};
        if (!window.responses) window.responses = {};
        if (typeof window.managerShowAllEvents !== 'boolean') window.managerShowAllEvents = false;

        if (!isUserAuthenticated()) {
            console.log('⚠️ No authentication - using local events only');
            if (window.LoadingStateManager) {
                window.LoadingStateManager.endLoading('dashboard');
            }
            renderDashboard();
            return;
        }

        // Show skeleton while fetching data
        try {
            const activeList = document.getElementById('active-events-list');
            const pastList = document.getElementById('past-events-list');
            if (activeList && window.LoadingUI && window.LoadingUI.Skeleton) {
                window.LoadingUI.Skeleton.show(activeList, 'cards', 3);
            }
            if (pastList && window.LoadingUI && window.LoadingUI.Skeleton) {
                window.LoadingUI.Skeleton.show(pastList, 'cards', 3);
            }
        } catch (_) {}
    
    // Helper to extract events array from API response
    const extractEventsFromResponse = (response) => {
        if (response && Array.isArray(response.events)) {
            return response.events;
        }
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            return Object.values(response);
        }
        return [];
    };

    if (window.BackendAPI) {
        try {
            const currentUser = window.userAuth && window.userAuth.isAuthenticated() ? window.userAuth.getCurrentUser() : null;
            const filterParams = {};
            // Only filter by creator if we're not explicitly asked to show all events
            const useCreatorFilter = !window.managerShowAllEvents && currentUser && currentUser.id;
            if (useCreatorFilter) {
                filterParams.created_by = currentUser.id;
            }

            // PERFORMANCE: Load filtered events and unassigned events in PARALLEL
            console.log('⚡ Loading events in parallel...');
            const [rawResponse, unassignedRaw] = await Promise.all([
                window.BackendAPI.loadEvents(filterParams),
                window.BackendAPI.loadEvents({ unassigned: true })
            ]);

            let allEventsList = extractEventsFromResponse(rawResponse);

            // Fallback: if filtered by creator returned nothing, load ALL events
            if (allEventsList.length === 0 && useCreatorFilter) {
                console.log('ℹ️ No events found for user filter, loading all events as fallback');
                const fallbackResponse = await window.BackendAPI.loadEvents({});
                allEventsList = extractEventsFromResponse(fallbackResponse);
            }

            // Helper to normalize event data
            const normalizeEvent = (ev, overrides = {}) => ({
                ...ev,
                id: ev.id || ev.legacyId,
                title: ev.title,
                date: ev.date,
                time: ev.time,
                location: ev.location,
                description: ev.description,
                coverImage: ev.cover_image_url || ev.coverImageUrl || ev.coverImage,
                createdBy: ev.created_by || ev.createdBy || ev.owner || '',
                allowGuests: ev.allow_guests !== undefined ? ev.allow_guests : ev.allowGuests,
                requiresMealChoice: ev.requires_meal_choice !== undefined ? ev.requires_meal_choice : ev.requiresMealChoice,
                ...overrides
            });

            // Convert to map and normalize
            const allEvents = {};
            allEventsList.forEach(ev => {
                if (!ev || typeof ev !== 'object') return;
                const normalized = normalizeEvent(ev);
                if (normalized.id) {
                    allEvents[normalized.id] = normalized;
                }
            });

            const myEvents = {};
            const myId = String(currentUser && currentUser.id ? currentUser.id : '').trim().toLowerCase();
            const myUsername = String(currentUser && currentUser.username ? currentUser.username : '').trim().toLowerCase();

            for (const [eid, ev] of Object.entries(allEvents || {})) {
                const owner = String(ev.createdBy || '').trim().toLowerCase();
                const isOwner = (myId && owner === myId) ||
                               (myUsername && owner === myUsername) ||
                               (ev.created_by_username && ev.created_by_username === myUsername);
                if (isOwner) {
                    myEvents[eid] = ev;
                }
            }

            // Process unassigned events
            let unassignedEvents = {};
            if (unassignedRaw && Array.isArray(unassignedRaw.events)) {
                unassignedRaw.events.forEach(ev => {
                    if (ev && (ev.id || ev.legacyId)) unassignedEvents[ev.id || ev.legacyId] = ev;
                });
            } else if (typeof unassignedRaw === 'object') {
                if (unassignedRaw.events) delete unassignedRaw.events;
                if (unassignedRaw.success) delete unassignedRaw.success;
                unassignedEvents = unassignedRaw;
            }

            // PERFORMANCE: Backfill unassigned events in PARALLEL using Promise.allSettled
            if (currentUser && currentUser.id && Object.keys(unassignedEvents).length > 0) {
                console.log(`⚡ Backfilling ${Object.keys(unassignedEvents).length} unassigned events in parallel...`);
                const backfillPromises = Object.entries(unassignedEvents).map(async ([eid, ev]) => {
                    await window.BackendAPI.updateEvent(eid, { created_by: currentUser.id });
                    return { eid, ev };
                });

                const backfillResults = await Promise.allSettled(backfillPromises);
                backfillResults.forEach(result => {
                    if (result.status === 'fulfilled') {
                        const { eid, ev } = result.value;
                        const normalized = normalizeEvent(ev, { id: ev.id || ev.legacyId || eid, createdBy: currentUser.id });
                        myEvents[eid] = normalized;
                        allEvents[eid] = normalized;
                    }
                });

                // Backfill username-matched events in parallel
                const usernameMatchEvents = Object.entries(allEvents)
                    .filter(([eid, ev]) => {
                        const owner = String(ev.createdBy || '').trim().toLowerCase();
                        return owner && myUsername && owner === myUsername && !myEvents[eid];
                    });

                if (usernameMatchEvents.length > 0) {
                    const usernameBackfillPromises = usernameMatchEvents.map(async ([eid, ev]) => {
                        await window.BackendAPI.updateEvent(eid, { created_by: currentUser.id });
                        return { eid, ev };
                    });
                    const usernameResults = await Promise.allSettled(usernameBackfillPromises);
                    usernameResults.forEach(result => {
                        if (result.status === 'fulfilled') {
                            const { eid, ev } = result.value;
                            myEvents[eid] = { ...ev, createdBy: currentUser.id };
                        }
                    });
                }
            }

            // PERFORMANCE: Load user details in PARALLEL
            const ownersRaw = Object.values(myEvents || {}).map(ev => ev.createdBy).filter(v => v);
            const uniqueOwners = Array.from(new Set(ownersRaw));
            const uuidLike = uniqueOwners.filter(v => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v)));
            const usernameLike = uniqueOwners.filter(v => !uuidLike.includes(v));
            let userMap = {};

            // Load UUID users and username users in parallel
            const userLoadPromises = [];
            if (uuidLike.length > 0 && window.BackendAPI.loadUsersByIds) {
                userLoadPromises.push(
                    window.BackendAPI.loadUsersByIds(uuidLike)
                        .then(result => ({ type: 'uuids', data: result }))
                        .catch(e => { console.warn('Failed to load user details:', e); return { type: 'uuids', data: {} }; })
                );
            }
            if (usernameLike.length > 0 && window.BackendAPI.loadUserByUsername) {
                // Parallelize username lookups
                const usernamePromises = usernameLike.map(uname =>
                    window.BackendAPI.loadUserByUsername(String(uname).trim().toLowerCase())
                        .then(u => u && u.id ? { id: u.id, username: u.username, name: u.name, email: u.email } : null)
                        .catch(() => null)
                );
                userLoadPromises.push(
                    Promise.all(usernamePromises)
                        .then(results => ({ type: 'usernames', data: results.filter(Boolean) }))
                );
            }

            if (userLoadPromises.length > 0) {
                console.log('⚡ Loading user details in parallel...');
                const userResults = await Promise.all(userLoadPromises);
                userResults.forEach(result => {
                    if (result.type === 'uuids') {
                        Object.assign(userMap, result.data);
                    } else if (result.type === 'usernames') {
                        result.data.forEach(u => { userMap[u.id] = u; });
                    }
                });
            }

            // Augment events with user details (no more API calls needed)
            for (const [eid, ev] of Object.entries(myEvents || {})) {
                const u = userMap[ev.createdBy];
                if (u) {
                    myEvents[eid] = { ...ev, createdByName: u.name || u.username || u.id, createdByUsername: u.username || '' };
                }
            }

            let selectedEvents = window.managerShowAllEvents ? (allEvents || {}) : (myEvents || {});
            if (!window.managerShowAllEvents) {
                const myCount = Object.keys(myEvents || {}).length;
                const allCount = Object.keys(allEvents || {}).length;
                if (myCount === 0 && allCount > 0) {
                    console.log('ℹ️ No events found for current user; showing all events as fallback');
                    selectedEvents = allEvents || {};
                }
            }
            for (const [eid, ev] of Object.entries(selectedEvents || {})) {
                if (!ev.id) {
                    selectedEvents[eid] = { ...ev, id: String(eid) };
                }
            }
            const allEventIds = Object.keys(selectedEvents || {});
            const responses = allEventIds.length > 0
                ? await window.BackendAPI.loadResponses({ event_ids: allEventIds })
                : {};

            window.events = selectedEvents || {};
            window.responses = responses || {};

            // Mark caches as fresh
            if (window.CacheManager) {
                window.CacheManager.markFresh('events');
                window.CacheManager.markFresh('responses');
            }

            console.log(`✅ Loaded ${Object.keys(window.events).length} events from backend`);
            console.log(`✅ Loaded responses for ${Object.keys(window.responses).length} events from backend`);

            if (typeof updatePendingRSVPCount === 'function' && window.githubAPI) {
                updatePendingRSVPCount().catch(() => {});
            }

        } catch (error) {
            console.error('❌ Failed to load from backend:', error);
            // Track error state but don't show duplicate toast (already shown by catch)
            if (window.LoadingStateManager) {
                window.LoadingStateManager.setError('dashboard', error, { showToast: false });
            }
        }
    }

        // Mark loading as successful
        if (window.LoadingStateManager) {
            window.LoadingStateManager.endLoading('dashboard');
        }

        renderDashboard();

        // Load user's RSVPs
        if (window.displayUserRSVPs) {
            window.displayUserRSVPs();
        }
    } catch (outerError) {
        // Catch any unexpected errors
        console.error('❌ loadManagerData failed:', outerError);
        if (window.LoadingStateManager) {
            window.LoadingStateManager.setError('dashboard', outerError);
        }
    } finally {
        // Always reset the guard flag
        loadManagerDataInProgress = false;
        loadManagerDataPromise = null;
    }
    })();

    return loadManagerDataPromise;
}

function initShowAllEventsToggle() {
    const el = document.getElementById('show-all-events-toggle');
    if (!el) return;
    el.addEventListener('change', () => {
        window.managerShowAllEvents = !!el.checked;
        // Use debounced version to prevent rapid toggle calls
        debouncedLoadManagerData(300);
    });
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

        if (window.BackendAPI) {
            await window.BackendAPI.deleteEvent(eventId);
        }
        
        if (window.events) delete window.events[eventId];
        if (window.responses) delete window.responses[eventId];
        
        showToast('🗑️ Event deleted successfully', 'success');
        
        await loadManagerData();
        
        if (window.location.hash.includes('manage/')) {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('dashboard');
            } else if (window.showPage) {
                window.showPage('dashboard');
            }
        }
        
    } catch (error) {
        console.error('Failed to delete event:', error);
        showToast('Failed to delete event: ' + error.message, 'error');
    }
}

/**
 * PHASE 2 PERFORMANCE OPTIMIZATION: Incremental dashboard rendering
 * Track rendered events to avoid full re-renders
 *
 * PHASE 3: Added pagination for large event lists
 */
const dashboardState = {
    renderedEvents: new Map(), // Map of eventId -> { element, hash }
    activeListeners: new Map(), // Map of eventId -> array of cleanup functions
    pagination: {
        active: { shown: 0, pageSize: 20 },
        past: { shown: 0, pageSize: 20 }
    }
};

/**
 * Reset dashboard state - call this when navigating to dashboard
 * Ensures clean render by clearing cached state
 */
function resetDashboardState() {
    console.log('🔄 Resetting dashboard state for clean render');
    dashboardState.renderedEvents.clear();
    dashboardState.pagination.active.shown = 0;
    dashboardState.pagination.past.shown = 0;
    // Don't clear activeListeners - they'll be cleaned up by cleanupEventListeners
}

window.resetDashboardState = resetDashboardState;

/**
 * Generate a hash of event data to detect changes
 */
function getEventHash(event) {
    const eventResponses = window.responses?.[event.id] || [];
    const stats = calculateEventStats(eventResponses);
    // Hash includes title, date, time, location, and stats
    return `${event.title}-${event.date}-${event.time}-${event.location}-${stats.attending}-${stats.notAttending}-${stats.totalHeadcount}`;
}

/**
 * PERFORMANCE OPTIMIZED: Incremental dashboard render
 * Only updates changed events instead of full re-render
 */
function renderDashboard() {
    const activeEventsList = document.getElementById('active-events-list');
    const pastEventsList = document.getElementById('past-events-list');

    console.log('🎨 renderDashboard called');
    console.log('📍 activeEventsList:', activeEventsList);
    console.log('📍 pastEventsList:', pastEventsList);

    if (!activeEventsList || !pastEventsList) {
        console.error('❌ Tab containers not found!');
        return;
    }

    if (!window.events || Object.keys(window.events).length === 0) {
        activeEventsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎖️</div>
                <h3>No Events Created Yet</h3>
                <p>Start by creating your first military event</p>
                <button class="btn btn-primary" onclick="showPage('create')">➕ Create Event</button>
            </div>
        `;
        pastEventsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <h3>No Past Events</h3>
                <p>Past events will appear here</p>
            </div>
        `;
        return;
    }

    const eventArray = Object.values(window.events);
    console.log('📊 Rendering dashboard with ' + eventArray.length + ' events');

    // Separate active and past events
    const now = new Date();
    // Helper to check if event is in past (handles time correctly)
    const checkIsPast = (event) => {
        if (!event.date) return false;
        const eventDate = new Date(event.date + 'T' + (event.time || '00:00'));
        return eventDate < now;
    };

    const activeEvents = eventArray.filter(event => !checkIsPast(event));
    const pastEvents = eventArray.filter(event => checkIsPast(event));

    // Sort: active by date ascending, past by date descending
    activeEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
    pastEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    // PERFORMANCE: Incremental updates instead of full innerHTML replacement
    updateEventList(activeEventsList, activeEvents, false, 'active');
    updateEventList(pastEventsList, pastEvents, true, 'past');

    console.log('✅ Dashboard rendered successfully with incremental updates');
}

/**
 * PERFORMANCE OPTIMIZED: Update event list incrementally
 * Uses DocumentFragment for batch DOM operations
 * PHASE 3: Added pagination for better performance with many events
 */
function updateEventList(container, events, isPast, listType) {
    // Get or create events grid
    let eventsSection = container.querySelector('.events-section');
    let eventsGrid = eventsSection?.querySelector('.events-grid');

    if (events.length === 0) {
        let root = container.querySelector('.events-section');
        if (!root) {
            root = document.createElement('div');
            root.className = 'events-section';
            container.appendChild(root);
        }
        const emptyHtml = listType === 'active' ? `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <h3>No Active Events</h3>
                <p>Create a new event to get started</p>
                <button class="btn btn-primary" onclick="showPage('create')">➕ Create Event</button>
            </div>
        ` : `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <h3>No Past Events</h3>
                <p>Completed events will appear here</p>
            </div>
        `;
        root.innerHTML = emptyHtml;
        dashboardState.pagination[listType].shown = 0;
        return;
    }

    // Create structure if needed
    if (!eventsGrid) {
        eventsSection = document.createElement('div');
        eventsSection.className = 'events-section';
        eventsGrid = document.createElement('div');
        eventsGrid.className = 'events-grid';
        eventsSection.appendChild(eventsGrid);
        container.innerHTML = ''; // Clear existing content
        container.appendChild(eventsSection);
        // Reset pagination on new render
        dashboardState.pagination[listType].shown = 0;
    }

    // PHASE 3 PAGINATION: Determine how many events to show
    const pageSize = dashboardState.pagination[listType].pageSize;
    let shownCount = dashboardState.pagination[listType].shown;

    // Initialize if first time
    if (shownCount === 0) {
        shownCount = Math.min(events.length, pageSize);
        dashboardState.pagination[listType].shown = shownCount;
    }

    const eventsToShow = events.slice(0, shownCount);
    const hasMore = shownCount < events.length;

    // Track current event IDs
    const currentEventIds = new Set(eventsToShow.map(e => e.id));

    // PERFORMANCE: Create a Map of existing cards for O(1) lookups instead of querying DOM in loop
    const existingCardsMap = new Map(
        Array.from(eventsGrid.querySelectorAll('[data-event-id]')).map(card => [
            card.getAttribute('data-event-id'),
            card
        ])
    );

    // Remove cards for deleted or hidden events
    for (const [eventId, card] of existingCardsMap.entries()) {
        if (!currentEventIds.has(eventId)) {
            // Clean up event listeners
            cleanupEventListeners(eventId);
            card.remove();
            dashboardState.renderedEvents.delete(eventId);
            existingCardsMap.delete(eventId); // Keep map in sync
        }
    }

    // PERFORMANCE: Use DocumentFragment for batch insertions
    const fragment = document.createDocumentFragment();

    eventsToShow.forEach((event, index) => {
        const hash = getEventHash(event);
        const cached = dashboardState.renderedEvents.get(event.id);
        const existsInDOM = existingCardsMap.has(event.id);

        // Check if event needs update - ONLY skip if card exists in DOM AND hash matches
        if (cached && cached.hash === hash && existsInDOM) {
            // Event unchanged and card exists in DOM, skip re-render
            return;
        }

        // Event changed, new, or card missing from DOM - create element
        const card = createEventCardElement(event, isPast);
        dashboardState.renderedEvents.set(event.id, { element: card, hash });

        // Check if we need to replace existing card using the map for O(1) lookup
        if (existsInDOM) {
            const existingCard = existingCardsMap.get(event.id);
            existingCard.replaceWith(card);
        } else {
            fragment.appendChild(card);
        }
    });

    // Batch append new cards
    if (fragment.children.length > 0) {
        eventsGrid.appendChild(fragment);
    }

    // PHASE 3: Add/update "Load More" button if needed
    updateLoadMoreButton(eventsSection, listType, shownCount, events.length);
}

/**
 * PHASE 3: Add or update "Load More" button for pagination
 * SECURITY: Uses addEventListener instead of inline onclick
 */
function updateLoadMoreButton(container, listType, shown, total) {
    const existingBtn = container.querySelector('.load-more-btn');

    if (shown >= total) {
        // All events shown, remove button if exists
        if (existingBtn) {
            // Clean up listener before removing
            const btnElement = existingBtn.querySelector('button');
            if (btnElement && btnElement._loadMoreHandler) {
                btnElement.removeEventListener('click', btnElement._loadMoreHandler);
            }
            existingBtn.remove();
        }
        return;
    }

    if (!existingBtn) {
        // Create new button with proper event listener (not inline onclick)
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'load-more-btn';
        buttonContainer.style.cssText = 'text-align: center; margin-top: 1.5rem;';

        const button = document.createElement('button');
        button.className = 'btn btn-secondary';
        button.textContent = `📋 Load More Events (${total - shown} remaining)`;

        // Attach event listener instead of using inline onclick (security best practice)
        const handler = () => loadMoreEvents(listType);
        button.addEventListener('click', handler);
        // Store reference for cleanup
        button._loadMoreHandler = handler;

        buttonContainer.appendChild(button);
        container.appendChild(buttonContainer);
    } else {
        // Update existing button text
        const btn = existingBtn.querySelector('button');
        if (btn) {
            btn.textContent = `📋 Load More Events (${total - shown} remaining)`;
        }
    }
}

/**
 * PHASE 3: Load more events (called from Load More button)
 * No longer exposed on window - kept private to this module
 */
function loadMoreEvents(listType) {
    const pageSize = dashboardState.pagination[listType].pageSize;
    dashboardState.pagination[listType].shown += pageSize;
    renderDashboard();
}

/**
 * PERFORMANCE OPTIMIZED: Create event card as DOM element instead of HTML string
 * Properly attaches event listeners that can be cleaned up
 */
function createEventCardElement(event, isPast) {
    const eventResponses = window.responses?.[event.id] || [];
    const stats = calculateEventStats(eventResponses);

    // Create card container
    const card = document.createElement('div');
    card.className = `event-card-v2 ${isPast ? 'event-past' : 'event-active'}`;
    card.setAttribute('data-event-id', event.id);

    // Use innerHTML for card content (complex structure)
    // But attach listeners properly afterwards
    // Use utility sanitization for consistency and better security
    const h = window.utils?.sanitizeHTML || sanitizeHTML;
    card.innerHTML = `
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
                        <div class="stat-sublabel">
                            ${stats.attending} + ${stats.attendingWithGuests}
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="event-actions-v2">
                <button class="btn-primary-action" data-action="manage">
                    📊 Manage Event
                </button>
                <div class="quick-actions-row">
                    <button class="btn-quick" data-action="copy" title="Copy Invite Link">
                        🔗 Copy Link
                    </button>
                    <button class="btn-quick" data-action="duplicate" title="Duplicate Event">
                        📋 Duplicate
                    </button>
                    <button class="btn-quick" data-action="export" title="Export Data">
                        📤 Export
                    </button>
                    <button class="btn-quick btn-danger-quick" data-action="delete" title="Delete Event">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `;

    // PERFORMANCE: Attach event listeners properly (can be cleaned up later)
    attachCardListeners(card, event.id);

    return card;
}

/**
 * Attach event listeners to card with proper cleanup tracking
 */
function attachCardListeners(card, eventId) {
    const cleanupFunctions = [];

    // Manage button
    const manageBtn = card.querySelector('[data-action="manage"]');
    const manageHandler = (e) => {
        e.stopPropagation();
        if (window.AppRouter && typeof window.AppRouter.navigateToPage === 'function') {
            window.AppRouter.navigateToPage('manage', eventId);
        } else {
            showPage('manage', eventId);
        }
    };
    manageBtn.addEventListener('click', manageHandler);
    cleanupFunctions.push(() => manageBtn.removeEventListener('click', manageHandler));

    // Copy link button
    const copyBtn = card.querySelector('[data-action="copy"]');
    const copyHandler = (e) => {
        e.stopPropagation();
        copyInviteLink(eventId);
    };
    copyBtn.addEventListener('click', copyHandler);
    cleanupFunctions.push(() => copyBtn.removeEventListener('click', copyHandler));

    // Duplicate button
    const duplicateBtn = card.querySelector('[data-action="duplicate"]');
    if (duplicateBtn) {
        const duplicateHandler = (e) => {
            e.stopPropagation();
            if (window.duplicateEvent) {
                window.duplicateEvent(eventId);
            } else if (window.eventManager && window.eventManager.duplicateEvent) {
                window.eventManager.duplicateEvent(eventId);
            }
        };
        duplicateBtn.addEventListener('click', duplicateHandler);
        cleanupFunctions.push(() => duplicateBtn.removeEventListener('click', duplicateHandler));
    }

    // Export button
    const exportBtn = card.querySelector('[data-action="export"]');
    const exportHandler = (e) => {
        e.stopPropagation();
        exportEventData(eventId);
    };
    exportBtn.addEventListener('click', exportHandler);
    cleanupFunctions.push(() => exportBtn.removeEventListener('click', exportHandler));

    // Delete button
    const deleteBtn = card.querySelector('[data-action="delete"]');
    const deleteHandler = (e) => {
        e.stopPropagation();
        deleteEvent(eventId);
    };
    deleteBtn.addEventListener('click', deleteHandler);
    cleanupFunctions.push(() => deleteBtn.removeEventListener('click', deleteHandler));

    // Store cleanup functions
    dashboardState.activeListeners.set(eventId, cleanupFunctions);
}

/**
 * Clean up event listeners for a card
 */
function cleanupEventListeners(eventId) {
    const cleanupFunctions = dashboardState.activeListeners.get(eventId);
    if (cleanupFunctions) {
        cleanupFunctions.forEach(fn => fn());
        dashboardState.activeListeners.delete(eventId);
    }
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
                            <div class="stat-sublabel">
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
                const validation = window.eventManager.validateEventData(baseData, true); // isUpdate = true
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
            createdBy: currentUser.id || null,
            createdByUsername: currentUser.username || 'unknown',
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

        submitBtn.innerHTML = '<div class="spinner"></div> Saving...';
        if (!window.BackendAPI) {
            throw new Error('Backend API not available.');
        }
        const result = await window.BackendAPI.createEvent({
            title: eventData.title,
            description: eventData.description,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            coverImageUrl: eventData.coverImage,
            createdByUserId: currentUser.id || null,
            status: eventData.status,
            askReason: eventData.askReason,
            allowGuests: eventData.allowGuests,
            requiresMealChoice: eventData.requiresMealChoice,
            customQuestions: eventData.customQuestions,
            eventDetails: eventData.eventDetails,
            seatingChart: eventData.seatingChart
        });
        const created = result && result.event ? result.event : null;
        if (created && created.id) {
            eventData.id = String(created.id);
        }
        if (window.BackendAPI && eventData.id) {
            await window.BackendAPI.updateEvent(eventData.id, {
                allowGuests: eventData.allowGuests,
                requiresMealChoice: eventData.requiresMealChoice,
                customQuestions: eventData.customQuestions,
                eventDetails: eventData.eventDetails,
                seatingChart: eventData.seatingChart
            });
        }

        // Update local state
        if (!window.events) window.events = {};
        window.events[eventData.id] = eventData;

        showToast('🎖️ Event deployed successfully!', 'success');

        // Clear autosave draft
        if (window.clearEventFormDraft) {
            window.clearEventFormDraft();
        }

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
        setTimeout(async () => {
            try {
                if (typeof window.loadManagerData === 'function') {
                    await window.loadManagerData();
                }
            } catch (e) {
                console.warn('Failed to refresh data after save:', e);
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
    const pastEventsList = document.getElementById('past-events-list');
    
    if (pastEventsList) {
        // Just switch tab to past events if not already there
        // Or if this is a collapse/expand toggle inside the tab (legacy logic)
        
        // Check if we are using the new tab system
        const pastTabBtn = document.querySelector('.dashboard-tab[data-tab="past-events"]');
        if (pastTabBtn && window.switchDashboardTab) {
            window.switchDashboardTab('past-events');
            return;
        }

        // Legacy toggle logic
        const pastSection = pastEventsList.querySelector('.events-grid');
        const toggle = document.querySelector('.past-events-toggle');
        
        if (pastSection) {
            if (pastSection.style.display === 'none') {
                pastSection.style.display = 'grid';
                if (toggle) toggle.classList.remove('collapsed');
            } else {
                pastSection.style.display = 'none';
                if (toggle) toggle.classList.add('collapsed');
            }
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
    const activePage = document.querySelector('.page.active');
    if (!activePage || (activePage.id !== 'create' && activePage.id !== 'manage')) {
        return;
    }

    // Determine ID prefix based on active page
    // Create page uses default IDs (cover-upload), Manage page uses prefixed IDs (manage-cover-upload)
    const prefix = activePage.id === 'manage' ? 'manage-' : '';

    const maxTries = 10;
    const tryInit = () => {
        const coverUpload = document.getElementById(`${prefix}cover-upload`);
        const coverInput = document.getElementById(`${prefix}cover-input`);
        const coverPreview = document.getElementById(`${prefix}cover-preview`);
        const coverImageUrlInput = document.getElementById(`${prefix}cover-image-url`);
        
        if (!coverUpload || !coverInput || !coverPreview || !coverImageUrlInput) {
            const t = (window.__photoUploadInitTries || 0) + 1;
            window.__photoUploadInitTries = t;
            if (t < maxTries) {
                setTimeout(tryInit, 100);
            } else {
                console.warn(`⚠️ Photo upload elements not found (Page: ${activePage.id}, Prefix: "${prefix}"). Ensure all IDs exist.`);
            }
            return;
        }
        window.__photoUploadInitTries = 0;
        
        // Check initialization on the specific element
        if (coverUpload.dataset.uploadInitialized === 'true') {
            console.log(`ℹ️ Photo upload already initialized for ${activePage.id}, skipping...`);
            return;
        }

        // Note: Click handling is now done via overlay input in CSS/HTML to ensure reliability
        // We only need to handle the file selection change event and visual feedback

        coverInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await handleImageFile(file, coverPreview, coverUpload, coverImageUrlInput);
            }
        });

        // Visual feedback for drag and drop
        // Since input covers the div, we listen on input
        coverInput.addEventListener('dragenter', (e) => {
            coverUpload.classList.add('dragover');
            coverUpload.style.borderColor = 'var(--semper-gold)';
            coverUpload.style.background = 'rgba(255, 215, 0, 0.05)';
        });

        coverInput.addEventListener('dragleave', (e) => {
            coverUpload.classList.remove('dragover');
            coverUpload.style.borderColor = '';
            coverUpload.style.background = '';
        });

        coverInput.addEventListener('drop', (e) => {
            coverUpload.classList.remove('dragover');
            coverUpload.style.borderColor = '';
            coverUpload.style.background = '';
            // No need to handle file manually, 'change' event will fire
        });
        
        coverUpload.dataset.uploadInitialized = 'true';
        console.log(`✅ Photo upload handlers attached for ${activePage.id} (Overlay Input method)`);
    };
    tryInit();
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

        let imageUrl = '';
        let uploadResult = null;
        const activePage = document.querySelector('.page.active');
        const isManagePage = activePage && activePage.id === 'manage';

        // Get event ID from multiple sources for reliability
        let eventIdForUpload = null;
        if (window.eventManager && window.eventManager.currentEvent) {
            eventIdForUpload = window.eventManager.currentEvent.id;
        } else if (isManagePage) {
            // Try to get from URL hash or hidden input
            const hashMatch = window.location.hash.match(/manage\/([a-f0-9-]+)/i);
            if (hashMatch) {
                eventIdForUpload = hashMatch[1];
            } else {
                // Try hidden input on form
                const eventIdInput = document.getElementById('manage-event-id');
                if (eventIdInput && eventIdInput.value) {
                    eventIdForUpload = eventIdInput.value;
                }
            }
        }
        console.log('📸 [UPLOAD] eventIdForUpload:', eventIdForUpload, 'isManagePage:', isManagePage);

        if (window.BackendAPI && window.BackendAPI.uploadImage) {
            try {
                uploadResult = await window.BackendAPI.uploadImage(file, uniqueFileName, { eventId: eventIdForUpload, tags: [] });
                imageUrl = String(uploadResult.url || '');
                if (uploadResult && uploadResult.supabase && uploadResult.supabase.attempted) {
                    if (uploadResult.supabase.updated && uploadResult.supabase.verified) {
                        showToast('✅ Image synced to Supabase', 'success');
                    } else if (uploadResult.supabase.error) {
                        showToast('⚠️ Supabase update failed: ' + uploadResult.supabase.error, 'warning');
                    } else {
                        showToast('⚠️ Supabase update not verified', 'warning');
                    }
                }
            } catch (e) {
                console.error('Backend upload failed:', e);
                // No fallback to GitHub API as it is insecure
            }
        }
        
        if (!imageUrl) {
            throw new Error('Image upload failed');
        }

        // Save cover_image_url to event in Supabase
        if (eventIdForUpload && imageUrl) {
            try {
                console.log('📸 [UPLOAD] Saving cover image to event:', eventIdForUpload);
                if (window.BackendAPI && window.BackendAPI.updateEvent) {
                    await window.BackendAPI.updateEvent(eventIdForUpload, { coverImageUrl: imageUrl });
                    console.log('📸 [UPLOAD] Cover image saved successfully');
                    showToast('✅ Cover image saved', 'success');
                }
                if (window.events && window.events[eventIdForUpload]) {
                    window.events[eventIdForUpload] = { ...window.events[eventIdForUpload], coverImage: imageUrl };
                }
            } catch (e) {
                console.warn('Fallback Supabase save failed:', e);
                showToast('⚠️ Fallback save failed: ' + e.message, 'warning');
            }
        }

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

// =============================================================================
// EVENT SEARCH FUNCTIONALITY
// =============================================================================

/**
 * Initialize event search functionality
 */
function initEventSearch() {
    const searchInput = document.getElementById('event-search-input');
    const clearBtn = document.getElementById('event-search-clear');
    const resultsDiv = document.getElementById('event-search-results');

    if (!searchInput) return;

    let searchTimeout = null;

    // Debounced search
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        // Show/hide clear button via CSS class
        if (clearBtn) {
            clearBtn.classList.toggle('visible', !!query);
        }

        // Clear previous timeout
        if (searchTimeout) clearTimeout(searchTimeout);

        // Debounce search
        searchTimeout = setTimeout(() => {
            filterEventsBySearch(query);
        }, 200);
    });

    // Clear search
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.remove('visible');
            filterEventsBySearch('');
            searchInput.focus();
        });
    }

    // Handle escape key to clear
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            if (clearBtn) clearBtn.classList.remove('visible');
            filterEventsBySearch('');
        }
    });

    console.log('✅ Event search initialized');
}

/**
 * Filter events by search query
 * @param {string} query - Search query
 */
function filterEventsBySearch(query) {
    const activeEventsList = document.getElementById('active-events-list');
    const pastEventsList = document.getElementById('past-events-list');
    const resultsDiv = document.getElementById('event-search-results');

    if (!window.events) return;

    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    let matchCount = 0;
    let totalCount = 0;

    // Get all event cards
    const allEventCards = [
        ...(activeEventsList ? activeEventsList.querySelectorAll('.event-card') : []),
        ...(pastEventsList ? pastEventsList.querySelectorAll('.event-card') : [])
    ];

    allEventCards.forEach(card => {
        totalCount++;
        const eventId = card.dataset.eventId;
        const event = window.events[eventId];

        if (!query) {
            // No search - show all
            card.style.display = '';
            matchCount++;
            return;
        }

        if (!event) {
            card.style.display = 'none';
            return;
        }

        // Build searchable text
        const searchableText = [
            event.title || '',
            event.location || '',
            event.description || '',
            event.date || '',
            event.createdByName || ''
        ].join(' ').toLowerCase();

        // Check if all search terms match
        const matches = searchTerms.every(term => searchableText.includes(term));

        if (matches) {
            card.style.display = '';
            matchCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Update results counter via CSS class
    if (resultsDiv) {
        if (query) {
            resultsDiv.classList.add('visible');
            resultsDiv.textContent = `Found ${matchCount} of ${totalCount} event${totalCount !== 1 ? 's' : ''}`;
        } else {
            resultsDiv.classList.remove('visible');
        }
    }
}

// Initialize search when DOM is ready
document.addEventListener('DOMContentLoaded', initEventSearch);

// Re-apply search filter after dashboard renders
const _originalRenderDashboard = window.renderDashboard;
if (_originalRenderDashboard) {
    window.renderDashboard = function() {
        _originalRenderDashboard.apply(this, arguments);
        const searchInput = document.getElementById('event-search-input');
        if (searchInput && searchInput.value) {
            setTimeout(() => filterEventsBySearch(searchInput.value.trim()), 100);
        }
    };
}

window.filterEventsBySearch = filterEventsBySearch;
window.initEventSearch = initEventSearch;

console.log('✅ Enhanced manager system loaded with RSVP sync functionality and username auth support');

document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-action="manage"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const card = btn.closest('[data-event-id]');
    const eventId = card ? card.getAttribute('data-event-id') : null;
    if (!eventId) return;
    if (window.AppRouter && typeof window.AppRouter.navigateToPage === 'function') {
        window.AppRouter.navigateToPage('manage', eventId);
    } else if (window.eventManager && typeof window.eventManager.showEventManagement === 'function') {
        window.eventManager.showEventManagement(eventId);
    } else {
        showPage('manage', eventId);
    }
});
