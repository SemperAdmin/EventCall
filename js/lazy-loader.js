/**
 * PHASE 3 OPTIMIZATION: Lazy Loading Utility
 * Dynamically loads external libraries only when needed
 * Reduces initial bundle size and improves page load time
 */

const LazyLoader = {
    // Track in-flight requests to avoid duplicate loads
    loadingPromises: new Map(),

    // CDN URLs for external libraries
    CDN_URLS: {
        CHARTJS: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
        ZXCVBN: 'https://cdn.jsdelivr.net/npm/zxcvbn@4.4.2/dist/zxcvbn.js'
    },

    /**
     * Lazy load Chart.js (180KB) - only for admin dashboard
     * @returns {Promise<Object>} Chart.js library
     */
    async loadChartJS() {
        console.log('📊 Loading Chart.js...');
        return this.loadScript(this.CDN_URLS.CHARTJS, 'Chart');
    },

    /**
     * Lazy load zxcvbn (250KB) - only when password field is focused
     * @returns {Promise<Function>} zxcvbn function
     */
    async loadZxcvbn() {
        console.log('🔐 Loading zxcvbn...');
        return this.loadScript(this.CDN_URLS.ZXCVBN, 'zxcvbn');
    },

    /**
     * Preload a library (download but don't execute yet)
     * Useful for libraries that will be needed soon
     * @param {string} url - Library URL
     */
    preload(url) {
        // Use <link rel="preload"> for better caching
        const existing = document.querySelector(`link[href="${url}"]`);
        if (existing) return;

        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = url;
        document.head.appendChild(link);
        console.log(`🔄 Preloading: ${url}`);
    },

    /**
     * Generic library loader
     * @param {string} url - Script URL
     * @param {string} globalName - Global variable name to check
     * @returns {Promise<any>} Loaded library
     */
    async loadScript(url, globalName) {
        // Check if already loaded
        if (globalName && window[globalName]) {
            console.log(`✅ ${globalName} already loaded`);
            return window[globalName];
        }

        // Return existing promise if loading
        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url);
        }

        console.log(`📥 Loading ${globalName || url}...`);
        const loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = () => {
                console.log(`✅ ${globalName || url} loaded`);
                this.loadingPromises.delete(url);
                resolve(globalName ? window[globalName] : true);
            };
            script.onerror = () => {
                console.error(`❌ Failed to load ${globalName || url}`);
                this.loadingPromises.delete(url);
                reject(new Error(`Failed to load ${url}`));
            };
            document.head.appendChild(script);
        });

        this.loadingPromises.set(url, loadPromise);
        return loadPromise;
    }
};

// Export to window
window.LazyLoader = LazyLoader;
