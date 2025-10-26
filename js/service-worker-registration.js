/**
 * Service Worker Registration
 * Handles registration and updates
 */

// Check if service workers are supported
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Register service worker
            const registration = await navigator.serviceWorker.register('/EventCall/service-worker.js', {
                scope: '/EventCall/'
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
                banner.innerHTML = `
                    <span>📦 App update available</span>
                    <button id="sw-refresh-btn" style="
                        background: #10b981; color: #fff; border: none;
                        padding: 0.5rem 0.75rem; border-radius: 0.375rem; cursor: pointer;">
                        Refresh now
                    </button>
                `;
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
