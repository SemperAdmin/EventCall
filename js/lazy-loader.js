/**
 * PHASE 3 OPTIMIZATION: Lazy Loading Utility
 * Dynamically loads external libraries only when needed
 * Reduces initial bundle size and improves page load time
 */

const LazyLoader = {
    // Track loaded libraries to avoid duplicates
    loadedLibraries: new Set(),
    loadingPromises: new Map(),

    /**
     * Lazy load Chart.js (180KB) - only for admin dashboard
     * @returns {Promise<Object>} Chart.js library
     */
    async loadChartJS() {
        const libName = 'chartjs';

        // Return if already loaded
        if (window.Chart) {
            console.log('📊 Chart.js already loaded');
            return window.Chart;
        }

        // Return existing promise if loading
        if (this.loadingPromises.has(libName)) {
            return this.loadingPromises.get(libName);
        }

        console.log('📥 Lazy loading Chart.js...');
        const loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
            script.async = true;
            script.onload = () => {
                console.log('✅ Chart.js loaded successfully');
                this.loadedLibraries.add(libName);
                this.loadingPromises.delete(libName);
                resolve(window.Chart);
            };
            script.onerror = () => {
                console.error('❌ Failed to load Chart.js');
                this.loadingPromises.delete(libName);
                reject(new Error('Failed to load Chart.js'));
            };
            document.head.appendChild(script);
        });

        this.loadingPromises.set(libName, loadPromise);
        return loadPromise;
    },

    /**
     * Lazy load zxcvbn (250KB) - only when password field is focused
     * @returns {Promise<Function>} zxcvbn function
     */
    async loadZxcvbn() {
        const libName = 'zxcvbn';

        // Return if already loaded
        if (window.zxcvbn) {
            console.log('🔐 zxcvbn already loaded');
            return window.zxcvbn;
        }

        // Return existing promise if loading
        if (this.loadingPromises.has(libName)) {
            return this.loadingPromises.get(libName);
        }

        console.log('📥 Lazy loading zxcvbn...');
        const loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/zxcvbn@4.4.2/dist/zxcvbn.js';
            script.async = true;
            script.onload = () => {
                console.log('✅ zxcvbn loaded successfully');
                this.loadedLibraries.add(libName);
                this.loadingPromises.delete(libName);
                resolve(window.zxcvbn);
            };
            script.onerror = () => {
                console.error('❌ Failed to load zxcvbn');
                this.loadingPromises.delete(libName);
                reject(new Error('Failed to load zxcvbn'));
            };
            document.head.appendChild(script);
        });

        this.loadingPromises.set(libName, loadPromise);
        return loadPromise;
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
