/**
 * EventCall Configuration - Fixed Version with New Token
 * Contains all configuration constants and settings
 */

// GitHub Database Configuration (Production Ready)
const GITHUB_CONFIG = {
    token: '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',
    owner: 'SemperAdmin',
    repo: 'EventCall',
    branch: 'main',
    apiBase: 'https://api.github.com/repos'
};

// Application Settings
const APP_CONFIG = {
    name: 'EventCall',
    tagline: 'Where Every Event Matters',
    version: '1.0.0',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    maxCustomQuestions: 10,
    toastDuration: 3000,
    syncInterval: 30000 // 30 seconds
};

// UI Messages
const MESSAGES = {
    loading: {
        events: 'Loading events...',
        saving: 'Saving...',
        syncing: 'Syncing with database...',
        deleting: 'Deleting...',
        creating: 'Creating event...'
    },
    success: {
        eventCreated: '🎖️ Event deployed successfully!',
        eventDeleted: '🗑️ Event deleted successfully',
        rsvpSubmitted: '✅ RSVP submitted successfully!',
        linkCopied: '🔗 Invite link copied to clipboard!',
        dataExported: '📊 Data exported successfully!',
        syncCompleted: '✅ Sync completed!',
        searchCleared: '🧹 Search cleared'
    },
    error: {
        eventNotFound: 'Event not found',
        invalidFile: 'Please select a valid image file',
        fileTooLarge: 'File size too large. Maximum size is 5MB',
        selectAttending: 'Please select if you\'re attending',
        syncFailed: 'Sync failed',
        saveFailed: 'Failed to save',
        loadFailed: 'Failed to load events',
        deleteFailed: 'Failed to delete event',
        exportFailed: 'Failed to export data',
        copyFailed: 'Failed to copy link'
    },
    confirm: {
        deleteEvent: 'Are you sure you want to delete this event? This cannot be undone.'
    },
    info: {
        noEvents: 'No events found.',
        noResponses: 'No RSVPs yet. Share your invite link to start collecting responses!',
        emailFallback: '📧 Email fallback activated - please send the email',
        firstEvent: 'Create your first event to get started with professional military event management.'
    }
};

// Event Status Constants
const EVENT_STATUS = {
    DRAFT: 'draft',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// RSVP Status Constants
const RSVP_STATUS = {
    ATTENDING: true,
    NOT_ATTENDING: false,
    PENDING: null
};

// File Paths for GitHub Storage
const GITHUB_PATHS = {
    events: 'events',
    rsvps: 'rsvps',
    assets: 'assets',
    logs: 'logs'
};

// Default Event Settings
const DEFAULT_EVENT = {
    askReason: false,
    allowGuests: false,
    customQuestions: [],
    maxGuests: 4,
    requireApproval: false,
    sendNotifications: true
};

// API Endpoints
const API_ENDPOINTS = {
    github: {
        contents: (path) => `${GITHUB_CONFIG.apiBase}/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`,
        repo: `${GITHUB_CONFIG.apiBase}/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`
    }
};

// Regular Expressions for Validation
const VALIDATION = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[\+]?[1-9][\d]{0,15}$/,
    eventTitle: /^.{3,100}$/,
    name: /^[a-zA-Z\s\-\.]{2,50}$/
};

// CSS Classes for Dynamic Styling
const CSS_CLASSES = {
    hidden: 'hidden',
    loading: 'loading',
    active: 'active',
    selected: 'selected',
    highlight: 'highlight',
    error: 'error',
    success: 'success',
    attending: {
        yes: 'attending-yes',
        no: 'attending-no'
    }
};

// Local Storage Keys
const STORAGE_KEYS = {
    events: 'eventcall_events',
    responses: 'eventcall_responses',
    settings: 'eventcall_settings',
    cache: 'eventcall_cache'
};

// Export configuration for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GITHUB_CONFIG,
        APP_CONFIG,
        MESSAGES,
        EVENT_STATUS,
        RSVP_STATUS,
        GITHUB_PATHS,
        DEFAULT_EVENT,
        API_ENDPOINTS,
        VALIDATION,
        CSS_CLASSES,
        STORAGE_KEYS
    };
}