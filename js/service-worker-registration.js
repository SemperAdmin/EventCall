/**
 * Service Worker Registration
 * Handles registration and updates
 */

// Check if service workers are supported
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Skip service worker in local development to avoid caching/register issues
            const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
            if (isLocalDev) {
                console.log('🧪 Local dev detected: skipping Service Worker registration');
                return;
            }

            // Detect GitHub Pages by hostname, not pathname (more reliable)
            const isGitHubPages = window.location.hostname.endsWith('.github.io');

            // Determine base path
            let basePath = '/';
            if (isGitHubPages) {
                // Extract repo name from hostname or pathname
                const pathParts = window.location.pathname.split('/').filter(p => p);
                if (pathParts.length > 0 && pathParts[0] !== '') {
                    basePath = '/' + pathParts[0] + '/';
                } else {
                    // Fallback: try to extract from meta tag or use default
                    basePath = '/EventCall/';
                }
            }

            console.log(`📍 Detected basePath: ${basePath} (GitHub Pages: ${isGitHubPages})`);

            // IMPORTANT: Unregister any old service workers with wrong scope first
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                if (registration.scope !== window.location.origin + basePath) {
                    console.warn(`🧹 Unregistering old service worker with wrong scope: ${registration.scope}`);
                    await registration.unregister();
                }
            }

            // Register service worker with environment-aware path and scope
            const registration = await navigator.serviceWorker.register(basePath + 'service-worker.js', {
                scope: basePath,
                updateViaCache: 'none' // Don't cache the service worker file itself
            });

            console.log('✅ Service Worker registered:', registration.scope);

            // Check for updates
            // Add banner renderer
            function renderUpdateBanner() {
                const existing = document.getElementById('sw-update-banner');
                if (existing) return;

                const banner = document.createElement('div');
                banner.id = 'sw-update-banner';
                banner.style.cssText = `
                    position: fixed; bottom: 16px; right: 16px; z-index: 9999;
                    background: #1f2937; color: #fff; padding: 0.75rem 1rem;
                    border-radius: 0.5rem; box-shadow: 0 6px 20px rgba(0,0,0,0.2);
                    display: flex; align-items: center; gap: 0.75rem;
                `;
                banner.innerHTML = window.utils.sanitizeHTML(`
                    <span>📦 App update available</span>
                    <button id="sw-refresh-btn" style="
                        background: #10b981; color: #fff; border: none;
                        padding: 0.5rem 0.75rem; border-radius: 0.375rem; cursor: pointer;">
                        Refresh now
                    </button>
                `);
                document.body.appendChild(banner);

                const btn = banner.querySelector('#sw-refresh-btn');
                btn.addEventListener('click', () => window.location.reload());
            }
            
            // Inside updatefound listener statechange:
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
            
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available
                        console.log('🔄 New Service Worker available');
                        renderUpdateBanner();
                        if (window.showToast) {
                            window.showToast('📦 App update available! Click Refresh.', 'success');
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

    // Provide manual cache clear and service worker reset function
    window.clearAppCache = async () => {
        try {
            // Clear all caches manually
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                console.log('🧹 All caches cleared manually');
            }

            // Unregister all service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
                console.log('🧹 All service workers unregistered');
            }

            if (window.showToast) {
                window.showToast('🧹 Cache and service workers cleared!', 'success');
            }

            // Reload after a brief delay
            setTimeout(() => window.location.reload(true), 500);
        } catch (error) {
            console.error('Cache clear error:', error);
            if (window.showToast) {
                window.showToast('⚠️ Cache clear may have failed: ' + error.message, 'error');
            }
        }
    };

    // Add global unregister function for debugging
    window.unregisterServiceWorkers = async () => {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
                console.log('✅ Unregistered service worker:', registration.scope);
            }
            console.log('✅ All service workers unregistered');
            return true;
        } catch (error) {
            console.error('❌ Failed to unregister service workers:', error);
            return false;
        }
    };

} else {
    console.warn('⚠️ Service Workers not supported in this browser');
}
