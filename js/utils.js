/**
 * EventCall Utility Functions
 * Common utility functions used throughout the application
 */

/**
 * Generate a UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date
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
 * @param {string} time - Time string (HH:MM format)
 * @returns {string} Formatted time
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
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
function isValidEmail(email) {
    return VALIDATION.email.test(email);
}

/**
 * Validate phone number
 * @param {string} phone - Phone to validate
 * @returns {boolean} Is valid phone
 */
function isValidPhone(phone) {
    return VALIDATION.phone.test(phone.replace(/\s+/g, ''));
}

/**
 * Validate event title
 * @param {string} title - Title to validate
 * @returns {boolean} Is valid title
 */
function isValidEventTitle(title) {
    return VALIDATION.eventTitle.test(title);
}

/**
 * Validate name
 * @param {string} name - Name to validate
 * @returns {boolean} Is valid name
 */
function isValidName(name) {
    return VALIDATION.name.test(name);
}

/**
 * Sanitize text input
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
    if (!text) return '';
    return text.trim().replace(/[<>]/g, '');
}

/**
 * Generate invite URL for an event
 * @param {Object} event - Event data
 * @returns {string} Invite URL
 */
// function generateInviteURL(event) {
function generateInviteURL(event) {
    const baseURL = window.location.origin + window.location.pathname;
    const encodedData = encodeURIComponent(JSON.stringify({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        description: event.description,
        coverImage: event.coverImage,
        askReason: event.askReason,
        allowGuests: event.allowGuests,
        requiresMealChoice: event.requiresMealChoice || false,
        eventDetails: event.eventDetails || {},
        customQuestions: event.customQuestions || [],
        created: event.created
    }));
    return `${baseURL}?data=${encodedData}#invite/${event.id}`;
}

/**
 * Get event data from URL parameters
 * @returns {Object|null} Event data or null
 */
// function getEventFromURL() {
function getEventFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');

    if (encodedData) {
        try {
            return JSON.parse(decodeURIComponent(encodedData));
        } catch (e1) {
            try {
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
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }
}

/**
 * Download data as file
 * @param {string} data - Data to download
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
function downloadFile(data, filename, mimeType = 'text/plain') {
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/**
 * Convert file to base64
 * @param {File} file - File to convert
 * @returns {Promise<string>} Base64 string
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Validate image file
 * @param {File} file - File to validate
 * @returns {Object} Validation result
 */
function validateImageFile(file) {
    const result = {
        valid: true,
        errors: []
    };

    // Check file type
    if (!APP_CONFIG.allowedImageTypes.includes(file.type)) {
        result.valid = false;
        result.errors.push('Invalid file type. Please select a valid image file.');
    }

    // Check file size
    if (file.size > APP_CONFIG.maxFileSize) {
        result.valid = false;
        result.errors.push(`File size too large. Maximum size is ${formatFileSize(APP_CONFIG.maxFileSize)}.`);
    }

    return result;
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Calculate event statistics
 * @param {Array} responses - RSVP responses
 * @returns {Object} Statistics
 */
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
        // Accept both boolean and string forms
        const isAttending = response.attending === true || response.attending === 'true';
        const isNotAttending = response.attending === false || response.attending === 'false';

        if (isAttending) {
            stats.attending++;
            // Parse guest count (string or number)
            const guestCount = parseInt(response.guestCount, 10) || 0;
            stats.attendingWithGuests += guestCount;
        } else if (isNotAttending) {
            stats.notAttending++;
        }

        // Track total guests regardless of attendance
        stats.totalGuests += parseInt(response.guestCount, 10) || 0;
    });

    // Total headcount = attending people + their guests
    stats.totalHeadcount = stats.attending + stats.attendingWithGuests;
    stats.responseRate = stats.total > 0
        ? ((stats.attending + stats.notAttending) / stats.total * 100).toFixed(1)
        : 0;

    return stats;
}

/**
 * Create CSV content from RSVP data
 * @param {Object} event - Event data
 * @param {Array} responses - RSVP responses
 * @returns {string} CSV content
 */
function createCSVContent(event, responses) {
    let csvContent = "Name,Email,Phone,Attending,Rank,Unit,Branch,";
    
    if (event.askReason) csvContent += "Reason,";
    if (event.allowGuests) csvContent += "Guest Count,";
    if (event.requiresMealChoice) csvContent += "Dietary Restrictions,Allergy Details,";
    if (event.eventDetails && Object.keys(event.eventDetails).length > 0) {
        Object.values(event.eventDetails).forEach(detail => {
            csvContent += `"${detail.label}",`;
        });
    }
    if (event.customQuestions && event.customQuestions.length > 0) {
        event.customQuestions.forEach(q => {
            csvContent += `"${q.question}",`;
        });
    }
    csvContent += "Timestamp\n";

    responses.forEach(response => {
        csvContent += `"${response.name}","${response.email}","${response.phone || ''}","${response.attending ? 'Yes' : 'No'}","${response.rank || ''}","${response.unit || ''}","${response.branch || ''}",`;
        if (event.askReason) csvContent += `"${response.reason || ''}",`;
        if (event.allowGuests) csvContent += `"${response.guestCount || 0}",`;
        if (event.requiresMealChoice) {
            const diet = (response.dietaryRestrictions || []).join('; ');
            csvContent += `"${diet}","${response.allergyDetails || ''}",`;
        }
        if (event.eventDetails && Object.keys(event.eventDetails).length > 0) {
            Object.values(event.eventDetails).forEach(detail => {
                csvContent += `"${detail.value || ''}",`;
            });
        }
        if (event.customQuestions && event.customQuestions.length > 0) {
            event.customQuestions.forEach(q => {
                const answer = response.customAnswers && response.customAnswers[q.id] ? response.customAnswers[q.id] : '';
                csvContent += `"${answer}",`;
            });
        }
        csvContent += `"${new Date(response.timestamp).toLocaleString()}"\n`;
    });

    return csvContent;
}

/**
 * Generate safe filename from event title
 * @param {string} title - Event title
 * @returns {string} Safe filename
 */
function generateSafeFilename(title) {
    return title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
function formatRelativeTime(date) {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(diffInSeconds / interval.seconds);
        if (count >= 1) {
            return count === 1 ? `1 ${interval.label} ago` : `${count} ${interval.label}s ago`;
        }
    }

    return 'Just now';
}

/**
 * Check if date is in the past
 * @param {string} date - Date string
 * @param {string} time - Time string (optional)
 * @returns {boolean} Is in the past
 */
function isEventInPast(date, time = '00:00') {
    const eventDateTime = new Date(`${date}T${time}`);
    return eventDateTime < new Date();
}

/**
 * Get time until event
 * @param {string} date - Event date
 * @param {string} time - Event time
 * @returns {string} Time until event
 */
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
        return `${days} day${days > 1 ? 's' : ''} away`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} away`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} away`;
    } else {
        return 'Starting soon';
    }
}

// Add shared escaping helper
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
window.utils = window.utils || {};
window.utils.escapeHTML = escapeHTML;
