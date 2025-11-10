/**
 * API Wrapper Utility
 * Provides safe fetch() wrapper with automatic rate limiting, retries, and error handling
 */

/**
 * Safe fetch wrapper that automatically uses rate limiter when available
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options (headers, method, body, etc.)
 * @param {object} config - Configuration options
 * @param {string} config.endpointKey - Rate limiter endpoint key ('github_issues', 'github_contents', etc.)
 * @param {object} config.retry - Retry configuration
 * @param {number} config.retry.maxAttempts - Maximum retry attempts (default: 3)
 * @param {number} config.retry.baseDelayMs - Base delay for exponential backoff (default: 1000)
 * @param {boolean} config.retry.jitter - Add random jitter to retry delays (default: true)
 * @param {string} config.context - Context description for error logging
 * @returns {Promise<Response>} Fetch response
 */
async function safeFetch(url, options = {}, config = {}) {
    const {
        endpointKey = 'default',
        retry = {},
        context = 'API call'
    } = config;

    const retryConfig = {
        maxAttempts: retry.maxAttempts || 3,
        baseDelayMs: retry.baseDelayMs || 1000,
        jitter: retry.jitter !== undefined ? retry.jitter : true
    };

    // Use rate limiter if available
    if (window.rateLimiter) {
        try {
            return await window.rateLimiter.fetch(url, options, {
                endpointKey,
                retry: retryConfig
            });
        } catch (error) {
            console.error(`❌ Rate-limited fetch failed for ${context}:`, error);
            throw error;
        }
    }

    // Fallback to native fetch with manual retry logic
    console.warn('⚠️ Rate limiter not available, using native fetch for:', context);
    return await fetchWithRetry(url, options, retryConfig, context);
}

/**
 * Manual retry logic for when rate limiter is not available
 * @private
 */
async function fetchWithRetry(url, options, retryConfig, context) {
    let lastError;

    for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
        try {
            const response = await fetch(url, options);

            // Check for rate limiting
            if (response.status === 429 || response.status === 403) {
                const remaining = response.headers.get('x-ratelimit-remaining');
                if (remaining === '0') {
                    throw new Error('Rate limit exceeded');
                }
            }

            return response;
        } catch (error) {
            lastError = error;

            if (attempt < retryConfig.maxAttempts - 1) {
                const delay = retryConfig.baseDelayMs * Math.pow(2, attempt);
                const jitter = retryConfig.jitter
                    ? Math.floor(Math.random() * (retryConfig.baseDelayMs / 2))
                    : 0;
                const totalDelay = delay + jitter;

                console.warn(`⏳ Retry ${attempt + 1}/${retryConfig.maxAttempts} for ${context} in ${totalDelay}ms`);
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }
    }

    throw new Error(`${context} failed after ${retryConfig.maxAttempts} attempts: ${lastError.message}`);
}

/**
 * Safe fetch for GitHub API calls with automatic endpoint detection
 * @param {string} url - GitHub API URL
 * @param {object} options - Fetch options
 * @param {string} context - Context description
 * @returns {Promise<Response>} Fetch response
 */
async function safeFetchGitHub(url, options = {}, context = 'GitHub API call') {
    // Detect endpoint type from URL
    let endpointKey = 'default';

    if (url.includes('/issues')) {
        endpointKey = 'github_issues';
    } else if (url.includes('/contents') || url.includes('/git/trees') || url.includes('/git/blobs')) {
        endpointKey = 'github_contents';
    } else if (url.includes('/dispatches')) {
        endpointKey = 'github_dispatch';
    }

    return safeFetch(url, options, {
        endpointKey,
        retry: { maxAttempts: 3, baseDelayMs: 1000, jitter: true },
        context
    });
}

/**
 * Batch fetch multiple URLs with rate limiting
 * @param {Array<{url: string, options: object, context: string}>} requests - Array of request configs
 * @param {object} config - Configuration options
 * @param {number} config.concurrency - Maximum concurrent requests (default: 4)
 * @param {string} config.endpointKey - Rate limiter endpoint key
 * @returns {Promise<Array<Response>>} Array of responses
 */
async function batchFetch(requests, config = {}) {
    const {
        concurrency = 4,
        endpointKey = 'default'
    } = config;

    const results = [];
    const queue = [...requests];

    async function processNext() {
        if (queue.length === 0) return;

        const request = queue.shift();
        try {
            const response = await safeFetch(request.url, request.options, {
                endpointKey,
                context: request.context || 'Batch request'
            });
            results.push({ success: true, response, request });
        } catch (error) {
            results.push({ success: false, error, request });
        }

        await processNext();
    }

    // Start concurrent workers
    const workers = Array(Math.min(concurrency, queue.length))
        .fill(null)
        .map(() => processNext());

    await Promise.all(workers);

    return results;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.safeFetch = safeFetch;
    window.safeFetchGitHub = safeFetchGitHub;
    window.batchFetch = batchFetch;
    console.log('✅ API wrapper utility loaded');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        safeFetch,
        safeFetchGitHub,
        batchFetch
    };
}
