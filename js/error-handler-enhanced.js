/**
 * Enhanced Error Handler Utility
 * Provides centralized error handling with user notifications, logging, and recovery
 */

/**
 * Error severity levels
 */
const ErrorSeverity = {
    CRITICAL: 'critical',  // App-breaking errors
    HIGH: 'high',          // Feature-breaking errors
    MEDIUM: 'medium',      // Degraded functionality
    LOW: 'low'             // Minor issues
};

/**
 * User-friendly error messages for common error types
 */
const ERROR_MESSAGES = {
    // Network errors
    'Failed to fetch': 'Network error - please check your internet connection',
    'NetworkError': 'Unable to connect to the server',
    'ECONNREFUSED': 'Server is unavailable',

    // Authentication errors
    'Authentication required': 'Your session has expired. Please log in again.',
    'Invalid username or password': 'Incorrect username or password',
    'Token expired': 'Your session has expired. Please log in again.',
    '401': 'Authentication failed - please log in again',

    // Authorization errors
    '403': 'You don\'t have permission to perform this action',
    'Forbidden': 'Access denied',

    // Rate limiting
    'Rate limit exceeded': 'Too many requests. Please wait a moment and try again.',
    '429': 'Too many requests. Please slow down.',

    // Not found
    '404': 'Resource not found',
    'Not found': 'The requested item could not be found',

    // Server errors
    '500': 'Server error - please try again later',
    '502': 'Server is temporarily unavailable',
    '503': 'Service unavailable - please try again later',

    // Data errors
    'Invalid JSON': 'Received invalid data from server',
    'Parse error': 'Unable to process server response',

    // CSRF errors
    'Missing CSRF token': 'Security token missing - please refresh the page',
    'Invalid CSRF token': 'Security token invalid - please refresh the page'
};

/**
 * Enhanced error handler wrapper
 * @param {Function} fn - Function to execute
 * @param {object} options - Configuration options
 * @param {string} options.context - Description of what's being attempted
 * @param {string} options.severity - Error severity level
 * @param {boolean} options.showToast - Show toast notification (default: true)
 * @param {boolean} options.logError - Log to console (default: true)
 * @param {Function} options.onError - Custom error handler
 * @param {Function} options.fallback - Fallback function on error
 * @returns {Promise<any>} Result or fallback value
 */
async function withErrorHandling(fn, options = {}) {
    const {
        context = 'Operation',
        severity = ErrorSeverity.MEDIUM,
        showToast = true,
        logError = true,
        onError = null,
        fallback = null
    } = options;

    try {
        return await fn();
    } catch (error) {
        // Log error
        if (logError) {
            const errorDetails = {
                context,
                severity,
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            };

            console.error(`❌ Error in ${context}:`, errorDetails);
        }

        // Get user-friendly message
        const userMessage = getUserFriendlyMessage(error, context);

        // Show toast notification
        if (showToast && window.showToast) {
            const toastType = severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH
                ? 'error'
                : 'warning';
            window.showToast(userMessage, toastType);
        }

        // Call custom error handler if provided
        if (onError && typeof onError === 'function') {
            try {
                onError(error);
            } catch (handlerError) {
                console.error('Error in custom error handler:', handlerError);
            }
        }

        // Log to remote service if available
        if (window.errorLogger) {
            try {
                window.errorLogger.log({
                    context,
                    severity,
                    error: error.message,
                    stack: error.stack,
                    userAgent: navigator.userAgent,
                    url: window.location.href
                });
            } catch (loggerError) {
                console.error('Failed to log error remotely:', loggerError);
            }
        }

        // Return fallback value or re-throw
        if (fallback !== null) {
            return typeof fallback === 'function' ? fallback() : fallback;
        }

        throw error;
    }
}

/**
 * Get user-friendly error message
 * @param {Error} error - The error object
 * @param {string} context - Context of the operation
 * @returns {string} User-friendly message
 */
function getUserFriendlyMessage(error, context = 'Operation') {
    const errorMessage = error.message || String(error);

    // Check for known error patterns
    for (const [pattern, message] of Object.entries(ERROR_MESSAGES)) {
        if (errorMessage.includes(pattern) || errorMessage === pattern) {
            return message;
        }
    }

    // Check for HTTP status codes in message
    const statusMatch = errorMessage.match(/\b(4\d{2}|5\d{2})\b/);
    if (statusMatch) {
        const status = statusMatch[1];
        if (ERROR_MESSAGES[status]) {
            return ERROR_MESSAGES[status];
        }
    }

    // Default message based on severity
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        return `${context} timed out. Please try again.`;
    }

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
    }

    // Generic fallback
    return `${context} failed. Please try again.`;
}

/**
 * Async error boundary for critical operations
 * @param {Function} fn - Function to execute
 * @param {string} context - Description
 * @returns {Promise<any>} Result or null on error
 */
async function safeAsync(fn, context = 'Operation') {
    return withErrorHandling(fn, {
        context,
        severity: ErrorSeverity.MEDIUM,
        showToast: true,
        fallback: null
    });
}

/**
 * Silent error handler (no toast, just logging)
 * @param {Function} fn - Function to execute
 * @param {string} context - Description
 * @returns {Promise<any>} Result or null on error
 */
async function silentAsync(fn, context = 'Background operation') {
    return withErrorHandling(fn, {
        context,
        severity: ErrorSeverity.LOW,
        showToast: false,
        fallback: null
    });
}

/**
 * Critical error handler (shows error, logs, and may redirect)
 * @param {Function} fn - Function to execute
 * @param {string} context - Description
 * @returns {Promise<any>} Result or throws
 */
async function criticalAsync(fn, context = 'Critical operation') {
    return withErrorHandling(fn, {
        context,
        severity: ErrorSeverity.CRITICAL,
        showToast: true,
        logError: true,
        onError: (error) => {
            // Log critical errors more prominently
            console.error('🚨 CRITICAL ERROR:', {
                context,
                error: error.message,
                stack: error.stack
            });
        }
    });
}

/**
 * Retry wrapper with exponential backoff
 * @param {Function} fn - Function to execute
 * @param {object} options - Retry options
 * @param {number} options.maxAttempts - Maximum retry attempts
 * @param {number} options.baseDelay - Base delay in ms
 * @param {boolean} options.jitter - Add random jitter
 * @param {string} options.context - Description
 * @returns {Promise<any>} Result after retries
 */
async function withRetry(fn, options = {}) {
    const {
        maxAttempts = 3,
        baseDelay = 1000,
        jitter = true,
        context = 'Operation'
    } = options;

    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            if (
                error.message.includes('Authentication required') ||
                error.message.includes('401') ||
                error.message.includes('403') ||
                error.message.includes('Invalid CSRF')
            ) {
                throw error;
            }

            if (attempt < maxAttempts - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                const randomJitter = jitter ? Math.floor(Math.random() * baseDelay) : 0;
                const totalDelay = delay + randomJitter;

                console.warn(`⏳ Retry ${attempt + 1}/${maxAttempts} for ${context} in ${totalDelay}ms`);

                if (window.showToast && attempt === 0) {
                    window.showToast(`${context} failed. Retrying...`, 'warning');
                }

                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }
    }

    throw lastError;
}

/**
 * Batch error handler - handles array of promises
 * @param {Array<Promise>} promises - Array of promises
 * @param {string} context - Description
 * @returns {Promise<Array>} Array of results or errors
 */
async function handleBatch(promises, context = 'Batch operation') {
    const results = await Promise.allSettled(promises);

    const failed = results.filter(r => r.status === 'rejected');
    const succeeded = results.filter(r => r.status === 'fulfilled');

    if (failed.length > 0) {
        console.warn(`⚠️ ${context}: ${failed.length}/${results.length} operations failed`);

        if (window.showToast) {
            if (succeeded.length === 0) {
                window.showToast(`${context} failed completely`, 'error');
            } else {
                window.showToast(
                    `${context} completed with ${failed.length} errors`,
                    'warning'
                );
            }
        }
    }

    return results;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ErrorHandler = {
        withErrorHandling,
        safeAsync,
        silentAsync,
        criticalAsync,
        withRetry,
        handleBatch,
        getUserFriendlyMessage,
        ErrorSeverity
    };
    console.log('✅ Enhanced error handler loaded');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        withErrorHandling,
        safeAsync,
        silentAsync,
        criticalAsync,
        withRetry,
        handleBatch,
        getUserFriendlyMessage,
        ErrorSeverity
    };
}
