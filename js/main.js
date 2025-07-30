// Initialize the application - SINGLE EVENT LISTENER
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing EventCall...');
    
    try {
        // Wait for userAuth to be available
        if (typeof userAuth === 'undefined') {
            console.error('❌ userAuth not defined - check script loading order');
            return;
        }
        
        // Initialize user authentication
        await userAuth.init();
        
        // Update user display after authentication
        if (userAuth.isLoggedIn && userAuth.isLoggedIn()) {
            updateUserDisplay();
            console.log('✅ User authenticated:', userAuth.getCurrentUser());
        }
        
        // Initialize other components
        if (typeof startMainApp === 'function') {
            startMainApp();
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize EventCall:', error);
    }
});

// Update user email display after authentication
function updateUserDisplay() {
    const userEmailDisplay = document.getElementById('user-email-display');
    if (userEmailDisplay && userAuth.currentUser) {
        const email = userAuth.currentUser;
        const displayEmail = email.length > 20 ? email.substring(0, 17) + '...' : email;
        userEmailDisplay.textContent = displayEmail;
    }
}