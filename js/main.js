/**
 * EventCall Main Application
 * Main application logic and initialization
 */

// Global application state
let events = {};
let responses = {};
let currentPage = 'dashboard';

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await initializeApp();
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showToast(MESSAGES.error.loadFailed, 'error');
    }
});

/**
 * Initialize application components
 */
async function initializeApp() {
    // Setup event listeners
    setupEventListeners();
    
    // Check URL hash for routing
    checkURLHash();
    
    // Load initial data
    await loadInitialData();
    
    // Start periodic sync
    startPeriodicSync();
    
    console.log('EventCall initialized successfully');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Form submissions
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }
    
    // Image upload
    setupImageUpload();
    
    // Window events
    window.addEventListener('hashchange', checkURLHash);
    
    // RSVP options (delegated event listener)
    document.addEventListener('click', handleRSVPOptionClick);
    
    console.log('Event listeners setup complete');
}

/**
 * Setup image upload functionality
 */
function setupImageUpload() {
    const coverUpload = document.getElementById('cover-upload');
    const coverInput = document.getElementById('cover-input');
    
    if (coverUpload && coverInput) {
        coverUpload.addEventListener('click', () => coverInput.click());
        coverUpload.addEventListener('dragover', handleDragOver);
        coverUpload.addEventListener('drop', handleDrop);
        coverInput.addEventListener('change', handleImageUpload);
    }
}

/**
 * Load initial application data
 */
async function loadInitialData() {
    try {
        showToast(MESSAGES.loading.events, 'success');
        
        // Load events and responses from GitHub
        [events, responses] = await Promise.all([
            githubAPI.loadEvents(),
            githubAPI.loadResponses()
        ]);
        
        // Render the dashboard
        renderDashboard();
        
    } catch (error) {
        console.error('Failed to load initial data:', error);
        showToast(MESSAGES.error.loadFailed, 'error');
        
        // Show error state in dashboard
        const eventsList = document.getElementById('events-list');
        if (eventsList) {
            eventsList.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--error-color);">
                    <h3>⚠️ Connection Issue</h3>
                    <p>Unable to load events. Please try refreshing the page.</p>
                    <button class="btn" onclick="location.reload()">🔄 Refresh Page</button>
                </div>
            `;
        }
    }
}

/**
 * Start periodic sync with GitHub
 */
function startPeriodicSync() {
    if (APP_CONFIG.syncInterval > 0) {
        setInterval(async () => {
            try {
                await syncWithGitHub();
            } catch (error) {
                console.error('Periodic sync failed:', error);
            }
        }, APP_CONFIG.syncInterval);
    }
}

/**
 * Handle URL hash changes for routing
 */
function checkURLHash() {
    const hash = window.location.hash.substring(1);
    
    if (hash.startsWith('invite/')) {
        const eventId = hash.split('/')[1];
        const urlEvent = getEventFromURL();
        
        if (urlEvent) {
            if (!events[eventId]) {
                events[eventId] = urlEvent;
            }
            showInvite(eventId);
        } else if (events[eventId]) {
            showInvite(eventId);
        } else {
            showInvite(eventId); // Will show "Event Not Found"
        }
        
        document.querySelector('.nav').style.display = 'none';
    } else if (hash.startsWith('manage/')) {
        const eventId = hash.split('/')[1];
        showEventManagement(eventId);
        document.querySelector('.nav').style.display = 'flex';
    } else {
        // Clear URL parameters if not processing an invite
        if (window.location.search && !hash.startsWith('invite/')) {
            const newURL = window.location.origin + window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newURL);
        }
        
        document.querySelector('.nav').style.display = 'flex';
    }
}

/**
 * Handle RSVP option clicks (delegated event handler)
 */
function handleRSVPOptionClick(e) {
    if (e.target.classList.contains('rsvp-option')) {
        document.querySelectorAll('.rsvp-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        e.target.classList.add('selected');
        const attending = e.target.textContent.includes("I'll be there");
        
        const attendingInput = document.getElementById('attending');
        if (attendingInput) {
            attendingInput.value = attending;
        }
    }
}

/**
 * Page navigation
 */
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Remove active class from nav buttons
    document.querySelectorAll('.nav button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update nav button
    const navButton = document.getElementById(`nav-${pageId}`);
    if (navButton) {
        navButton.classList.add('active');
    }
    
    // Update current page
    currentPage = pageId;
    
    // Handle navigation display
    if (pageId === 'invite') {
        document.querySelector('.nav').style.display = 'none';
    } else {
        document.querySelector('.nav').style.display = 'flex';
    }
    
    // Update URL hash (but don't change invite URLs)
    if (!window.location.hash.includes('invite/')) {
        window.location.hash = pageId;
    }
}

/**
 * Sync data with GitHub
 */
async function syncWithGitHub() {
    try {
        showToast(MESSAGES.loading.syncing, 'success');
        
        // Reload data from GitHub
        [events, responses] = await Promise.all([
            githubAPI.loadEvents(),
            githubAPI.loadResponses()
        ]);
        
        // Re-render current view
        if (currentPage === 'dashboard') {
            renderDashboard();
        }
        
        showToast(MESSAGES.success.syncCompleted, 'success');
        
    } catch (error) {
        console.error('Sync failed:', error);
        showToast(MESSAGES.error.syncFailed + ': ' + error.message, 'error');
    }
}

/**
 * Handle event form submission
 */
async function handleEventSubmit(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Show loading state
    submitBtn.innerHTML = '<div class="spinner"></div> Creating...';
    submitBtn.disabled = true;

    try {
        // Collect form data
        const eventData = {
            id: generateUUID(),
            title: sanitizeText(document.getElementById('event-title').value),
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            location: sanitizeText(document.getElementById('event-location').value),
            description: sanitizeText(document.getElementById('event-description').value),
            coverImage: document.getElementById('cover-preview').src || '',
            askReason: document.getElementById('ask-reason').checked,
            allowGuests: document.getElementById('allow-guests').checked,
            customQuestions: getCustomQuestions(),
            created: Date.now(),
            createdBy: 'EventCall User',
            status: EVENT_STATUS.ACTIVE
        };

        // Validate required fields
        if (!isValidEventTitle(eventData.title)) {
            throw new Error('Please enter a valid event title (3-100 characters)');
        }

        if (!eventData.date || !eventData.time) {
            throw new Error('Please specify both date and time for the event');
        }

        // Save to GitHub
        await githubAPI.saveEvent(eventData);
        
        // Update local state
        events[eventData.id] = eventData;
        
        // Show success message
        showToast(MESSAGES.success.eventCreated, 'success');
        
        // Reset form and redirect
        e.target.reset();
        document.getElementById('cover-preview').classList.add(CSS_CLASSES.hidden);
        clearCustomQuestions();
        renderDashboard();
        showPage('dashboard');
        
    } catch (error) {
        console.error('Failed to create event:', error);
        showToast(MESSAGES.error.saveFailed + ': ' + error.message, 'error');
    } finally {
        // Restore button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

/**
 * Get custom questions from form
 */
function getCustomQuestions() {
    const inputs = document.querySelectorAll('.custom-question-input');
    const questions = [];
    
    inputs.forEach((input, index) => {
        const text = sanitizeText(input.value);
        if (text && text.length >= 3) {
            questions.push({
                id: `custom_${index}`,
                question: text
            });
        }
    });
    
    return questions;
}

/**
 * Clear custom questions form
 */
function clearCustomQuestions() {
    const container = document.getElementById('custom-questions-container');
    if (container) {
        container.innerHTML = `
            <div class="custom-question-item">
                <input type="text" placeholder="Enter your question..." class="custom-question-input">
                <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">🗑️</button>
            </div>
        `;
    }
}

/**
 * Add custom question input
 */
function addCustomQuestion() {
    const container = document.getElementById('custom-questions-container');
    const currentQuestions = container.querySelectorAll('.custom-question-item').length;
    
    if (currentQuestions >= APP_CONFIG.maxCustomQuestions) {
        showToast(`Maximum ${APP_CONFIG.maxCustomQuestions} custom questions allowed`, 'error');
        return;
    }
    
    const questionItem = document.createElement('div');
    questionItem.className = 'custom-question-item';
    questionItem.innerHTML = `
        <input type="text" placeholder="Enter your question..." class="custom-question-input">
        <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)">🗑️</button>
    `;
    container.appendChild(questionItem);
}

/**
 * Remove custom question input
 */
function removeCustomQuestion(button) {
    const container = document.getElementById('custom-questions-container');
    const items = container.querySelectorAll('.custom-question-item');
    
    if (items.length > 1) {
        button.parentElement.remove();
    } else {
        // Keep at least one question input but clear it
        const input = button.parentElement.querySelector('.custom-question-input');
        input.value = '';
    }
}

/**
 * Handle image drag over
 */
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

/**
 * Handle image drag leave
 */
function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

/**
 * Handle image drop
 */
function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processImageFile(files[0]);
    }
}

/**
 * Handle image upload input change
 */
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        processImageFile(file);
    }
}

/**
 * Process uploaded image file
 */
function processImageFile(file) {
    const validation = validateImageFile(file);
    
    if (!validation.valid) {
        validation.errors.forEach(error => {
            showToast(error, 'error');
        });
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('cover-preview');
        if (preview) {
            preview.src = e.target.result;
            preview.classList.remove(CSS_CLASSES.hidden);
        }
    };
    reader.readAsDataURL(file);
}

/**
 * Copy invite link to clipboard
 */
async function copyInviteLink(eventId) {
    const event = events[eventId];
    if (!event) {
        showToast(MESSAGES.error.eventNotFound, 'error');
        return;
    }
    
    try {
        const link = generateInviteURL(event);
        const success = await copyToClipboard(link);
        
        if (success) {
            showToast(MESSAGES.success.linkCopied, 'success');
        } else {
            // Fallback: show prompt
            prompt('Copy this invite link:', link);
        }
    } catch (error) {
        console.error('Failed to copy link:', error);
        showToast(MESSAGES.error.copyFailed, 'error');
    }
}

/**
 * Export event data as CSV
 */
function exportEventData(eventId) {
    const event = events[eventId];
    const eventResponses = responses[eventId] || [];
    
    if (!event) {
        showToast(MESSAGES.error.eventNotFound, 'error');
        return;
    }
    
    try {
        const csvContent = createCSVContent(event, eventResponses);
        const filename = `${generateSafeFilename(event.title)}_rsvps.csv`;
        
        downloadFile(csvContent, filename, 'text/csv');
        showToast(MESSAGES.success.dataExported, 'success');
        
    } catch (error) {
        console.error('Failed to export data:', error);
        showToast(MESSAGES.error.exportFailed, 'error');
    }
}

/**
 * Delete event
 */
async function deleteEvent(eventId) {
    const event = events[eventId];
    if (!event) {
        showToast(MESSAGES.error.eventNotFound, 'error');
        return;
    }
    
    if (!confirm(MESSAGES.confirm.deleteEvent)) {
        return;
    }

    try {
        // Delete from GitHub
        await githubAPI.deleteEvent(eventId, event.title);
        
        // Remove from local state
        delete events[eventId];
        delete responses[eventId];
        
        // Re-render dashboard
        renderDashboard();
        showToast(MESSAGES.success.eventDeleted, 'success');
        
        // Redirect to dashboard if currently viewing this event
        if (currentPage === 'manage') {
            showPage('dashboard');
        }
        
    } catch (error) {
        console.error('Failed to delete event:', error);
        showToast(MESSAGES.error.deleteFailed + ': ' + error.message, 'error');
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, APP_CONFIG.toastDuration);
}

// Make functions available globally for HTML onclick handlers
window.showPage = showPage;
window.syncWithGitHub = syncWithGitHub;
window.copyInviteLink = copyInviteLink;
window.exportEventData = exportEventData;
window.deleteEvent = deleteEvent;
window.addCustomQuestion = addCustomQuestion;
window.removeCustomQuestion = removeCustomQuestion;
 