/**
 * EventCall Error Handler - Comprehensive Error Management
 * Provides user-friendly error messages, logging, and fallback behavior
 */

class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.setupGlobalErrorHandlers();
    }

    /**
     * Setup global error handlers
     */
    setupGlobalErrorHandlers() {
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, 'Unhandled Promise Rejection', {
                promise: event.promise
            });
            event.preventDefault();
        });

        // Catch general errors
        window.addEventListener('error', (event) => {
            // Extra visibility to locate syntax errors: log filename and message
            try {
                console.error('🧭 Global error source:', event.filename, 'line', event.lineno, 'col', event.colno, '-', event.message);
            } catch (_) { /* noop */ }
            this.handleError(event.error, 'Global Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
    }

    /**
     * Handle and log errors with user-friendly messages
     * @param {Error|string} error - Error object or message
     * @param {string} context - Context where error occurred
     * @param {Object} metadata - Additional error metadata
     */
    handleError(error, context = 'Unknown', metadata = {}) {
        const errorDetails = {
            timestamp: new Date().toISOString(),
            context,
            message: error?.message || error,
            stack: error?.stack,
            metadata,
            userAgent: navigator.userAgent
        };

        // Log to console in development
        console.error(`[${context}]`, errorDetails);

        // Add to error log
        this.logError(errorDetails);

        // Show user-friendly message
        const userMessage = this.getUserFriendlyMessage(error, context);
        this.showErrorToast(userMessage);

        // In production, you would send this to a logging service like Sentry
        // this.sendToLoggingService(errorDetails);
    }

    /**
     * Log error to internal log
     * @param {Object} errorDetails - Error details
     */
    logError(errorDetails) {
        this.errorLog.push(errorDetails);

        // Keep log size manageable
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // Store in session storage for debugging
        try {
            sessionStorage.setItem('eventcall_error_log', JSON.stringify(this.errorLog.slice(-10)));
        } catch (e) {
            console.warn('Failed to store error log in session storage');
        }
    }

    /**
     * Get user-friendly error message
     * @param {Error|string} error - Error object or message
     * @param {string} context - Error context
     * @returns {string} User-friendly message
     */
    getUserFriendlyMessage(error, context) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';

        // Network errors
        if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('Failed to fetch')) {
            return '🌐 Network connection issue. Please check your internet connection and try again.';
        }

        // Authentication errors
        if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('authentication')) {
            return '🔒 Authentication failed. Please log in again with your GitHub token.';
        }

        // Permission errors
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden') || errorMsg.includes('permission')) {
            return '⛔ You don\'t have permission to perform this action. Please check your access rights.';
        }

        // Not found errors
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return '🔍 Requested resource not found. It may have been deleted or moved.';
        }

        // Rate limit errors
        if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
            return '⏱️ Too many requests. Please wait a moment before trying again.';
        }

        // Server errors
        if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) {
            return '🔧 Server error. Our team has been notified. Please try again later.';
        }

        // File upload errors
        if (context.includes('upload') || context.includes('image')) {
            if (errorMsg.includes('size') || errorMsg.includes('large')) {
                return '📦 File is too large. Please use an image under 5MB.';
            }
            if (errorMsg.includes('type') || errorMsg.includes('format')) {
                return '📸 Invalid file format. Please use JPEG, PNG, GIF, or WebP images.';
            }
            return '❌ File upload failed. Please check the file and try again.';
        }

        // Validation errors
        if (context.includes('validation') || errorMsg.includes('invalid') || errorMsg.includes('required')) {
            return '✏️ Please check your input and ensure all required fields are filled correctly.';
        }

        // GitHub API errors
        if (context.includes('GitHub') || errorMsg.includes('GitHub')) {
            return '🐙 GitHub API error. Please check your token permissions and try again.';
        }

        // Generic fallback with context
        return `❌ ${context}: ${errorMsg}. Please try again or contact support if the issue persists.`;
    }

    /**
     * Show error toast notification
     * @param {string} message - Error message to display
     */
    showErrorToast(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, 'error');
        } else {
            alert(message);
        }
    }

    /**
     * Wrap async function with error handling
     * @param {Function} fn - Async function to wrap
     * @param {string} context - Error context
     * @returns {Function} Wrapped function
     */
    wrapAsync(fn, context) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error, context);
                throw error; // Re-throw for caller to handle if needed
            }
        };
    }

    /**
     * Retry failed operations with exponential backoff
     * @param {Function} operation - Operation to retry
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} initialDelay - Initial delay in ms
     * @returns {Promise} Result of operation
     */
    async retryWithBackoff(operation, maxRetries = 3, initialDelay = 1000) {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                if (attempt < maxRetries) {
                    const delay = initialDelay * Math.pow(2, attempt);
                    console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * Get error log for debugging
     * @returns {Array} Error log
     */
    getErrorLog() {
        return this.errorLog;
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
        try {
            sessionStorage.removeItem('eventcall_error_log');
        } catch (e) {
            console.warn('Failed to clear error log from session storage');
        }
    }

    /**
     * Export error log for support
     * @returns {string} JSON string of error log
     */
    exportErrorLog() {
        return JSON.stringify({
            exportDate: new Date().toISOString(),
            userAgent: navigator.userAgent,
            errors: this.errorLog
        }, null, 2);
    }
}

// Create global instance
const errorHandler = new ErrorHandler();

// Make globally available
window.errorHandler = errorHandler;

console.log('✅ Error handler initialized with comprehensive logging');
