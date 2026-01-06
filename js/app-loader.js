/**
 * EventCall App Loader
 * Handles the military-themed loading screen
 * Extracted from early-functions.js for reliability
 */

(function() {
    /**
     * Show the app loading screen (called on successful login)
     */
    function showAppLoader() {
        const timestamp = new Date().toISOString();
        console.log(`🔵 [${timestamp}] showAppLoader() CALLED`);
        console.log('🔍 Searching for #app-loader element...');

        const loader = document.getElementById('app-loader');
        console.log('📍 Element found:', loader ? 'YES' : 'NO');

        if (loader) {
            console.log('📊 Current loader state BEFORE changes:');
            console.log('  - display:', window.getComputedStyle(loader).display);
            console.log('  - opacity:', window.getComputedStyle(loader).opacity);
            console.log('  - visibility:', window.getComputedStyle(loader).visibility);
            console.log('  - classList:', loader.classList.toString());
            console.log('  - z-index:', window.getComputedStyle(loader).zIndex);

            // CRITICAL: Hide login page to prevent it from covering the loader
            // Both have z-index: 10000, so login page (later in DOM) would cover loader
            const loginPage = document.getElementById('login-page');
            if (loginPage) {
                console.log('🔧 Hiding login page to show loader...');
                loginPage.style.display = 'none';
            }

            console.log('🔧 Removing "hidden" class from loader...');
            loader.classList.remove('hidden');

            // Force style recalculation
            void loader.offsetHeight;

            console.log('✅ "hidden" class removed');
            console.log('📊 Current loader state AFTER changes:');
            console.log('  - display:', window.getComputedStyle(loader).display);
            console.log('  - opacity:', window.getComputedStyle(loader).opacity);
            console.log('  - visibility:', window.getComputedStyle(loader).visibility);
            console.log('  - classList:', loader.classList.toString());
            console.log('  - z-index:', window.getComputedStyle(loader).zIndex);

            console.log('✅ LOADER SHOULD NOW BE VISIBLE (login page hidden)');
        } else {
            console.error('❌ LOADER ELEMENT NOT FOUND - #app-loader does not exist in DOM');
        }
    }

    /**
     * Hide the app loading screen
     */
    function hideAppLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) {
            // Reset loader message to default before hiding
            const statusLabel = loader.querySelector('.app-loader__status-label');
            if (statusLabel) {
                statusLabel.textContent = 'Loading';
            }

            // Add hidden class to trigger fade out
            loader.classList.add('hidden');
            // Remove from DOM after transition completes
            loader.addEventListener('transitionend', () => {
                if (loader.parentNode) {
                    // Don't remove from DOM, just hide, so we can reuse it if needed
                    // loader.remove(); 
                    // Actually, keeping it hidden is safer for re-login scenarios
                }
            }, { once: true });
        }
    }

    /**
     * PERFORMANCE: Update loader message for progress feedback
     * @param {string} message - Message to display
     */
    function updateLoaderMessage(message) {
        const loader = document.getElementById('app-loader');
        if (loader) {
            const statusLabel = loader.querySelector('.app-loader__status-label');
            if (statusLabel) {
                statusLabel.textContent = message;
            }
        }
    }

    // Expose globally
    window.showAppLoader = showAppLoader;
    window.hideAppLoader = hideAppLoader;
    window.updateLoaderMessage = updateLoaderMessage;

    console.log('✅ App Loader utilities initialized');
})();
