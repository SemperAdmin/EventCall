/**
 * Service Worker Registration
 * Handles registration and updates
 */

// Check if service workers are supported
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Register service worker
            const registration = await navigator.serviceWorker.register('service-worker.js', {
                scope: './'
            });

            console.log('✅ Service Worker registered:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available
                        console.log('🔄 New Service Worker available');

                        // Optionally show update notification
                        if (window.showToast) {
                            window.showToast('📦 App update available! Refresh to update.', 'success');
                        }
                    }
                });
            });

            // Handle controller change (new service worker activated)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('🔄 Service Worker updated, reloading page...');
                window.location.reload();
            });

            // Periodic update check (every hour)
            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000);

        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    });

    // Provide manual cache clear function
    window.clearAppCache = async () => {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CLEAR_CACHE'
            });

            if (window.showToast) {
                window.showToast('🧹 Cache cleared successfully!', 'success');
            }

            // Reload after a brief delay
            setTimeout(() => window.location.reload(), 500);
        }
    };

} else {
    console.warn('⚠️ Service Workers not supported in this browser');
}
