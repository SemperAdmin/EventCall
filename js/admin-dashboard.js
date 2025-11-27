/**
 * EventCall Admin Dashboard
 * Admin-only analytics and system management
 */

(function() {
    'use strict';

    const AdminDashboard = {
        _getAdminApiUrl(path) {
            const cfg = window.BACKEND_CONFIG || {};
            const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
            if (!base) {
                console.error('Proxy dispatchURL not configured');
                return path; // Fallback to relative path
            }
            return `${base}${path}`;
        },
        /**
         * Initialize admin dashboard
         */
        init() {
            console.log('📊 Admin Dashboard module loaded');
            document.addEventListener('click', (event) => {
                const target = event.target;
                const action = target.dataset.action;
                if (action === 'close-edit-user-modal') {
                    this.closeEditUserModal();
                } else if (action === 'save-user-changes') {
                    this.saveUserChanges();
                } else if (target.closest('[data-action="edit-user"]')) {
                    const username = target.closest('tr').dataset.username;
                    this.editUser(username);
                } else if (target.closest('[data-action="delete-user"]')) {
                    const username = target.closest('tr').dataset.username;
                    this.deleteUser(username);
                }
            });
        },

        /**
         * Check if current user is admin
         */
        isAdmin() {
            const user = window.userAuth?.currentUser;
            return user && user.role === 'admin';
        },

        /**
         * PHASE 3: DRY helper to ensure Chart.js is loaded
         * Extracts duplicated logic from renderEventsChart and renderRsvpsChart
         * @param {HTMLElement} canvasCtx - Canvas context element for error display
         * @returns {Promise<boolean>} - True if loaded successfully, false otherwise
         */
        async _ensureChartJsLoaded(canvasCtx) {
            if (window.Chart) return true;

            try {
                await window.LazyLoader.loadChartJS();
                if (!window.Chart) {
                    throw new Error('Chart.js script loaded but `window.Chart` is not available.');
                }
                return true;
            } catch (error) {
                console.error('Failed to load Chart.js:', error);
                if (canvasCtx) {
                    canvasCtx.innerHTML = '<p style="color: #ef4444;">Failed to load charts library</p>';
                }
                return false;
            }
        },

        /**
         * Load and render admin dashboard
         */
        async loadDashboard() {
            console.log('📊 Loading admin dashboard...');
            const content = document.getElementById('admin-dashboard-content');
            if (content) {
                content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading admin data...</div>';
            }

            if (!this.isAdmin()) {
                console.error('❌ Access denied - user is not admin');
                if (content) {
                    content.innerHTML = `
                        <div style="padding: 2rem; text-align: center; color: var(--semper-red);">
                            <h2>❌ Access Denied</h2>
                            <p>You do not have permission to view this page.</p>
                            <button class="btn btn-primary" onclick="showPage('dashboard')">Return to Dashboard</button>
                        </div>
                    `;
                }
                return;
            }

            try {
                // Fetch all data
                const [adminData, users] = await Promise.all([
                    this.fetchAdminData(),
                    this.fetchAllUsers()
                ]);

                const { events, rsvps } = adminData;

                // Compute KPIs
                const kpis = this.computeKPIs(events, users, rsvps);

                // Render dashboard
                this.renderDashboard(kpis, events, users, rsvps);

                console.log('✅ Admin dashboard loaded successfully');
            } catch (error) {
                console.error('❌ Failed to load admin dashboard:', error);
                this.showError(error.message);
            }
        },

        async fetchAdminData() {
            try {
                const currentUser = window.userAuth?.currentUser;
                if (!currentUser) {
                    throw new Error("No authenticated user found");
                }
                const url = this._getAdminApiUrl('/api/admin/dashboard-data');
                const response = await fetch(url, {
                    headers: {
                        'x-username': currentUser.username
                    }
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch admin data: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error fetching admin data:', error);
                return { events: [], rsvps: [] };
            }
        },

        /**
         * Fetch all users from EventCall-Data
         */
        async fetchAllUsers() {
            try {
                const currentUser = window.userAuth?.currentUser;
                if (!currentUser) {
                    throw new Error("No authenticated user found");
                }
                const url = this._getAdminApiUrl('/api/admin/users');
                const response = await fetch(url, {
                    headers: {
                        'x-username': currentUser.username
                    }
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch users: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error fetching all users:', error);
                return []; // Return an empty array on error
            }
        },

        /**
         * Compute KPIs from data
         */
        computeKPIs(events, users, rsvps) {
            const now = new Date();
            const activeEvents = events.filter(e => new Date(e.datetime) >= now);
            const totalRsvps = rsvps.length;
            const attendingRsvps = rsvps.filter(r => r.willAttend === 'yes' || r.status === 'attending').length;
            const engagementRate = totalRsvps > 0 ? Math.round((attendingRsvps / totalRsvps) * 100) : 0;

            return {
                totalEvents: events.length,
                activeEvents: activeEvents.length,
                totalUsers: users.length,
                totalRsvps,
                attendingRsvps,
                engagementRate
            };
        },

        /**
         * Render admin dashboard
         */
        renderDashboard(kpis, events, users, rsvps) {
            const content = document.getElementById('admin-dashboard-content');
            if (!content) return;

            content.innerHTML = `
                <!-- Admin Header -->
                <div class="admin-header">
                    <div class="admin-title">
                        👑 EventCall Admin Control Panel
                        <span class="admin-badge">Admin</span>
                    </div>
                    <button class="btn btn-primary" onclick="AdminDashboard.refresh()">
                        🔄 Refresh Data
                    </button>
                </div>

                <!-- Admin Tabs -->
                <div class="dashboard-tabs" style="margin-bottom: 2rem;">
                    <button type="button" class="dashboard-tab dashboard-tab--active" data-tab="statistics" onclick="AdminDashboard.switchTab('statistics')">
                        📊 App Statistics
                    </button>
                    <button type="button" class="dashboard-tab" data-tab="users" onclick="AdminDashboard.switchTab('users')">
                        👥 User Management
                    </button>
                </div>

                <!-- Statistics Tab Content -->
                <div id="admin-statistics-tab" class="admin-tab-content admin-tab-content--active">
                    <!-- KPI Cards -->
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <span class="kpi-icon">👥</span>
                            <div class="kpi-label">Total Users</div>
                            <div class="kpi-value">${kpis.totalUsers}</div>
                            <div class="kpi-trend trend-neutral">
                                Registered accounts
                            </div>
                        </div>

                        <div class="kpi-card">
                            <span class="kpi-icon">📅</span>
                            <div class="kpi-label">Total Events</div>
                            <div class="kpi-value">${kpis.totalEvents}</div>
                            <div class="kpi-trend trend-neutral">
                                ${kpis.activeEvents} active events
                            </div>
                        </div>

                        <div class="kpi-card">
                            <span class="kpi-icon">✉️</span>
                            <div class="kpi-label">Total RSVPs</div>
                            <div class="kpi-value">${kpis.totalRsvps}</div>
                            <div class="kpi-trend trend-up">
                                ${kpis.attendingRsvps} attending
                            </div>
                        </div>

                        <div class="kpi-card">
                            <span class="kpi-icon">📊</span>
                            <div class="kpi-label">Engagement Rate</div>
                            <div class="kpi-value">${kpis.engagementRate}%</div>
                            <div class="kpi-trend trend-${kpis.engagementRate >= 70 ? 'up' : 'neutral'}">
                                RSVP response rate
                            </div>
                        </div>
                    </div>

                    <!-- Charts -->
                    <div class="chart-grid">
                        <div class="chart-card">
                            <div class="chart-title">Event Activity (Last 6 Months)</div>
                            <div class="chart-container">
                                <canvas id="adminEventsChart"></canvas>
                            </div>
                        </div>

                        <div class="chart-card">
                            <div class="chart-title">RSVP Status Distribution</div>
                            <div class="chart-container">
                                <canvas id="adminRsvpsChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- App Usage Stats -->
                    <div class="admin-table" style="margin-top: 2rem;">
                        <div class="chart-title" style="margin-bottom: 1.5rem;">📈 App Usage Summary</div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                            <div style="padding: 1.5rem; background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(212, 175, 55, 0.05)); border-radius: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.5rem;">Events per User</div>
                                <div style="font-size: 1.75rem; font-weight: 700; color: var(--semper-gold);">
                                    ${kpis.totalUsers > 0 ? (kpis.totalEvents / kpis.totalUsers).toFixed(1) : 0}
                                </div>
                            </div>
                            <div style="padding: 1.5rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05)); border-radius: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.5rem;">RSVPs per Event</div>
                                <div style="font-size: 1.75rem; font-weight: 700; color: #22c55e;">
                                    ${kpis.totalEvents > 0 ? (kpis.totalRsvps / kpis.totalEvents).toFixed(1) : 0}
                                </div>
                            </div>
                            <div style="padding: 1.5rem; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05)); border-radius: 0.5rem;">
                                <div style="font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.5rem;">Active Event Rate</div>
                                <div style="font-size: 1.75rem; font-weight: 700; color: #3b82f6;">
                                    ${kpis.totalEvents > 0 ? Math.round((kpis.activeEvents / kpis.totalEvents) * 100) : 0}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- User Management Tab Content -->
                <div id="admin-users-tab" class="admin-tab-content">
                    <div class="admin-table">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <div class="chart-title">👥 User Accounts (${users.length} total)</div>
                            <input type="text" id="user-search" placeholder="🔍 Search users..." style="padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #e2e8f0; width: 300px;" oninput="AdminDashboard.filterUsers(this.value)">
                        </div>
                        <div style="overflow-x: auto;">
                            <table id="users-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Branch</th>
                                        <th>Rank</th>
                                        <th>Role</th>
                                        <th>Events Created</th>
                                        <th>Last Active</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.renderUsersTableRows(users, events)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Render charts after DOM is ready
            setTimeout(() => {
                this.renderCharts(events, rsvps);
            }, 100);
        },

        /**
         * Render users table rows
         */
        renderUsersTableRows(users, events) {
            if (users.length === 0) {
                return '<tr><td colspan="8" style="text-align: center; color: #94a3b8;">No users found</td></tr>';
            }

            // Store for filtering
            this.allUsers = users;
            this.allEvents = events;

            return users.map(user => {
                // Count events created by this user
                const userEvents = events.filter(e => {
                    const createdBy = (e.createdBy || '').toLowerCase();
                    const createdByUsername = (e.createdByUsername || '').toLowerCase();
                    const username = (user.username || '').toLowerCase();
                    return createdBy === username || createdByUsername === username;
                });

                const eventCount = userEvents.length;
                // Check both lastLogin and lastActive for backward compatibility
                const lastLoginDate = user.lastLogin || user.lastActive;
                const lastActive = lastLoginDate
                    ? new Date(lastLoginDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : 'Never';
                const roleBadge = user.role === 'admin'
                    ? '<span style="background: var(--semper-gold); color: var(--semper-navy); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 700;">ADMIN</span>'
                    : '<span style="background: rgba(255,255,255,0.1); color: #94a3b8; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">USER</span>';

                return `
                    <tr data-username="${user.username?.toLowerCase() || ''}" data-name="${user.name?.toLowerCase() || ''}" data-email="${user.email?.toLowerCase() || ''}">
                        <td><strong>${user.username || 'N/A'}</strong></td>
                        <td>${user.name || 'N/A'}</td>
                        <td>${user.email || 'N/A'}</td>
                        <td>${user.branch || 'N/A'}</td>
                        <td>${user.rank || 'N/A'}</td>
                        <td>${roleBadge}</td>
                        <td style="text-align: center;">${eventCount}</td>
                        <td>${lastActive}</td>
                        <td>
                            <button class="btn btn-sm" data-action="edit-user">Edit</button>
                            <button class="btn btn-sm btn-danger" data-action="delete-user">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
        },

        editUser(username) {
            const user = this.allUsers.find(u => u.username === username);
            if (!user) return;

            document.getElementById('edit-user-username').value = user.username;
            document.getElementById('edit-user-name').value = user.name;
            document.getElementById('edit-user-email').value = user.email;
            document.getElementById('edit-user-role').value = user.role;
            document.getElementById('edit-user-status').value = user.status || 'active';
            document.getElementById('edit-user-modal').style.display = 'block';
        },

        closeEditUserModal() {
            document.getElementById('edit-user-modal').style.display = 'none';
        },

        async saveUserChanges() {
            const username = document.getElementById('edit-user-username').value;
            const name = document.getElementById('edit-user-name').value;
            const email = document.getElementById('edit-user-email').value;
            const role = document.getElementById('edit-user-role').value;
            const status = document.getElementById('edit-user-status').value;

            const currentUser = window.userAuth?.currentUser;
            const response = await fetch(`/api/admin/users/${username}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, role, status })
            });

            if (response.ok) {
                this.closeEditUserModal();
                this.refresh();
                window.showToast('User updated successfully', 'success');
            } else {
                window.showToast('Failed to save user changes.', 'error');
            }
        },

        async deleteUser(username) {
            if (!confirm(`Are you sure you want to delete user ${username}?`)) return;

            const currentUser = window.userAuth?.currentUser;
            const response = await fetch(`/api/admin/users/${username}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.refresh();
                window.showToast('User deleted successfully', 'success');
            } else {
                window.showToast('Failed to delete user.', 'error');
            }
        },

        /**
         * Switch between admin tabs
         */
        switchTab(tab) {
            console.log('🔄 Switching admin tab to:', tab);

            // Update tab buttons
            const tabs = document.querySelectorAll('.dashboard-tab');
            tabs.forEach(btn => {
                const isActive = btn.getAttribute('data-tab') === tab;
                btn.classList.toggle('dashboard-tab--active', isActive);
            });

            // Update tab content
            const statisticsTab = document.getElementById('admin-statistics-tab');
            const usersTab = document.getElementById('admin-users-tab');

            if (tab === 'statistics') {
                if (statisticsTab) statisticsTab.classList.add('admin-tab-content--active');
                if (usersTab) usersTab.classList.remove('admin-tab-content--active');
            } else if (tab === 'users') {
                if (statisticsTab) statisticsTab.classList.remove('admin-tab-content--active');
                if (usersTab) usersTab.classList.add('admin-tab-content--active');
            }
        },

        /**
         * Filter users table based on search query
         */
        filterUsers(query) {
            const searchQuery = query.toLowerCase().trim();
            const rows = document.querySelectorAll('#users-table tbody tr');

            rows.forEach(row => {
                const username = row.getAttribute('data-username') || '';
                const name = row.getAttribute('data-name') || '';
                const email = row.getAttribute('data-email') || '';

                const matches = username.includes(searchQuery) ||
                               name.includes(searchQuery) ||
                               email.includes(searchQuery);

                row.style.display = matches ? '' : 'none';
            });

            // Update count
            const visibleCount = Array.from(rows).filter(row => row.style.display !== 'none').length;
            const title = document.querySelector('#admin-users-tab .chart-title');
            if (title) {
                title.textContent = `👥 User Accounts (${visibleCount} ${searchQuery ? 'matching' : 'total'})`;
            }
        },

        /**
         * Render charts
         */
        renderCharts(events, rsvps) {
            if (typeof Chart === 'undefined') {
                console.warn('Chart.js not loaded');
                return;
            }

            // Configure Chart.js defaults
            Chart.defaults.color = '#94a3b8';
            Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

            // Events Chart
            this.renderEventsChart(events);

            // RSVPs Chart
            this.renderRsvpsChart(rsvps);
        },

        /**
         * Render events chart (PHASE 3: Lazy loads Chart.js)
         */
        async renderEventsChart(events) {
            const ctx = document.getElementById('adminEventsChart');
            if (!ctx) return;

            // PHASE 3: Use DRY helper to load Chart.js
            if (!await this._ensureChartJsLoaded(ctx)) return;

            // Group events by month
            const eventsByMonth = {};
            events.forEach(event => {
                const date = new Date(event.datetime);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                eventsByMonth[monthKey] = (eventsByMonth[monthKey] || 0) + 1;
            });

            const labels = Object.keys(eventsByMonth).sort().slice(-6);
            const data = labels.map(key => eventsByMonth[key]);

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels.map(l => {
                        const [year, month] = l.split('-');
                        return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
                    }),
                    datasets: [{
                        label: 'Events Created',
                        data: data,
                        borderColor: '#d4af37',
                        backgroundColor: 'rgba(212, 175, 55, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        },

        /**
         * Render RSVPs chart (PHASE 3: Lazy loads Chart.js)
         */
        async renderRsvpsChart(rsvps) {
            const ctx = document.getElementById('adminRsvpsChart');
            if (!ctx) return;

            // PHASE 3: Use DRY helper to load Chart.js
            if (!await this._ensureChartJsLoaded(ctx)) return;

            const attending = rsvps.filter(r => r.willAttend === 'yes' || r.status === 'attending').length;
            const notAttending = rsvps.filter(r => r.willAttend === 'no' || r.status === 'not-attending').length;
            const pending = rsvps.length - attending - notAttending;

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Attending', 'Not Attending', 'Pending'],
                    datasets: [{
                        data: [attending, notAttending, pending],
                        backgroundColor: ['#22c55e', '#ef4444', '#94a3b8'],
                        borderColor: '#1e293b',
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { padding: 15, usePointStyle: true, color: '#e2e8f0' }
                        }
                    }
                }
            });
        },

        /**
         * Refresh dashboard data
         */
        async refresh() {
            console.log('🔄 Refreshing admin dashboard...');
            await this.loadDashboard();
        },

        /**
         * Show error message
         */
        showError(message) {
            const content = document.getElementById('admin-dashboard-content');
            if (content) {
                content.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--semper-red);">
                        <h2>❌ Error Loading Dashboard</h2>
                        <p>${message}</p>
                        <button class="btn btn-primary" onclick="AdminDashboard.refresh()">Retry</button>
                    </div>
                `;
            }
        }
    };

    // Make AdminDashboard globally available
    window.AdminDashboard = AdminDashboard;

    // Initialize
    AdminDashboard.init();

    console.log('✅ Admin Dashboard module loaded');
})();
