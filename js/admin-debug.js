/**
 * Admin Dashboard Debugging Utility
 * Run in browser console: checkAdminStatus()
 */

(function() {
    'use strict';

    function checkAdminStatus() {
        console.log('🔍 ========== ADMIN DASHBOARD DEBUG ==========');

        // Check if user is logged in
        console.log('\n1️⃣ USER AUTHENTICATION:');
        if (!window.userAuth) {
            console.error('❌ window.userAuth is not defined');
            return;
        }

        const currentUser = window.userAuth.getCurrentUser();
        if (!currentUser) {
            console.error('❌ No user is currently logged in');
            return;
        }

        console.log('✅ User logged in:', currentUser.username);
        console.log('   Name:', currentUser.name);
        console.log('   Role:', currentUser.role);
        console.log('   Full user object:', currentUser);

        // Check if user has admin role
        console.log('\n2️⃣ ADMIN ROLE CHECK:');
        if (currentUser.role === 'admin') {
            console.log('✅ User has admin role');
        } else {
            console.error('❌ User does NOT have admin role');
            console.error('   Current role:', currentUser.role || '(not set)');
            console.error('   To fix: Update users/' + currentUser.username + '.json in EventCall-Data repo');
            console.error('   Add: "role": "admin"');
            return;
        }

        // Check if AdminDashboard module is loaded
        console.log('\n3️⃣ ADMIN DASHBOARD MODULE:');
        if (!window.AdminDashboard) {
            console.error('❌ window.AdminDashboard is not defined');
            console.error('   Check if js/admin-dashboard.js is loaded');
            return;
        }
        console.log('✅ AdminDashboard module loaded');

        // Check if admin page element exists
        console.log('\n4️⃣ ADMIN PAGE ELEMENT:');
        const adminPage = document.getElementById('admin');
        if (!adminPage) {
            console.error('❌ Admin page element (#admin) not found in DOM');
            return;
        }
        console.log('✅ Admin page element exists');
        console.log('   Display:', getComputedStyle(adminPage).display);
        console.log('   Visibility:', getComputedStyle(adminPage).visibility);
        console.log('   Classes:', adminPage.className);

        // Check admin dashboard content
        console.log('\n5️⃣ ADMIN DASHBOARD CONTENT:');
        const content = document.getElementById('admin-dashboard-content');
        if (!content) {
            console.error('❌ Admin dashboard content element not found');
            return;
        }
        console.log('✅ Admin dashboard content element exists');
        console.log('   Inner HTML length:', content.innerHTML.length);
        if (content.innerHTML.length < 100) {
            console.warn('⚠️ Dashboard content appears empty or minimal');
            console.log('   Content:', content.innerHTML);
        }

        console.log('\n6️⃣ RECOMMENDED ACTIONS:');
        if (currentUser.role !== 'admin') {
            console.log('📋 1. Go to EventCall-Data repository');
            console.log('📋 2. Edit users/' + currentUser.username + '.json');
            console.log('📋 3. Set "role": "admin"');
            console.log('📋 4. Commit and push');
            console.log('📋 5. Log out and log back in');
        } else if (adminPage && getComputedStyle(adminPage).display === 'none') {
            console.log('📋 Admin page element is hidden');
            console.log('📋 Try running: userAuth.showAdminInterface()');
        } else if (content && content.innerHTML.length < 100) {
            console.log('📋 Dashboard content is empty');
            console.log('📋 Try running: AdminDashboard.loadDashboard()');
        } else {
            console.log('✅ Everything looks good!');
            console.log('📋 If dashboard still not showing, check browser console for errors');
        }

        console.log('\n🔍 ========== END DEBUG ==========\n');
    }

    // Make function globally available
    window.checkAdminStatus = checkAdminStatus;

    console.log('🛠️ Admin debug utility loaded. Run checkAdminStatus() to diagnose issues.');
})();
