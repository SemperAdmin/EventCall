/**
 * EventCall Admin Dashboard
 * Admin-only analytics and system management
 */

(function() {
    'use strict';

    const AdminDashboard = {
        /**
         * Initialize admin dashboard
         */
        init() {
            console.log('📊 Admin Dashboard module loaded');
            // Dashboard will be loaded when admin page is shown
        },

        /**
         * Check if current user is admin
         */
        isAdmin() {
            const user = window.userAuth?.currentUser;
            return user && user.role === 'admin';
        },

        /**
         * Load and render admin dashboard
         */
        async loadDashboard() {
            console.log('📊 Loading admin dashboard...');

            if (!this.isAdmin()) {
                console.error('❌ Access denied - user is not admin');
                const content = document.getElementById('admin-dashboard-content');
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
                const [events, users, rsvps] = await Promise.all([
                    this.fetchAllEvents(),
                    this.fetchAllUsers(),
                    this.fetchAllRSVPs()
                ]);

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

        /**
         * Fetch all events from EventCall-Data
         */
        async fetchAllEvents() {
            // Use existing GitHub API functions
            if (window.githubAPI && window.githubAPI.loadEvents) {
                const eventsObject = await window.githubAPI.loadEvents();
                // Convert object to array (loadEvents returns an object with event IDs as keys)
                return Object.values(eventsObject);
            }
            return [];
        },

        /**
         * Fetch all users from EventCall-Data
         */
        async fetchAllUsers() {
            try {
                const owner = window.GITHUB_CONFIG.dataOwner || window.GITHUB_CONFIG.owner;
                const repo = window.GITHUB_CONFIG.dataRepo || 'EventCall-Data';

                const response = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/contents/users`,
                    {
                        headers: {
                            'Authorization': `token ${window.GITHUB_CONFIG.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );

                if (!response.ok) throw new Error('Failed to fetch users');

                const files = await response.json();
                const userFiles = files.filter(f => f.name.endsWith('.json'));

                const users = [];
                for (const file of userFiles) {
                    try {
                        const userResponse = await fetch(file.download_url);
                        const userData = await userResponse.json();
                        users.push(userData);
                    } catch (e) {
                        console.warn('Failed to load user:', file.name, e);
                    }
                }

                return users;
            } catch (error) {
                console.error('Error fetching users:', error);
                return [];
            }
        },

        /**
         * Fetch all RSVPs from EventCall-Data
         */
        async fetchAllRSVPs() {
            // Use existing GitHub API functions
            if (window.githubAPI && window.githubAPI.loadResponses) {
                const responses = await window.githubAPI.loadResponses();
                // Flatten all RSVPs
                const allRsvps = [];
                for (const eventId in responses) {
                    if (Array.isArray(responses[eventId])) {
                        allRsvps.push(...responses[eventId]);
                    }
                }
                return allRsvps;
            }
            return [];
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
                        🎖️ EventCall Admin Dashboard
                        <span class="admin-badge">Admin</span>
                    </div>
                    <button class="btn btn-primary" onclick="AdminDashboard.refresh()">
                        🔄 Refresh Data
                    </button>
                </div>

                <!-- Admin Content -->
                <div class="admin-content">
                    <!-- KPI Cards -->
                    <div class="kpi-grid">
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
                            <span class="kpi-icon">👥</span>
                            <div class="kpi-label">Active Users</div>
                            <div class="kpi-value">${kpis.totalUsers}</div>
                            <div class="kpi-trend trend-neutral">
                                Registered users
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
                            <div class="chart-title">Recent Events</div>
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

                    <!-- Recent Events Table -->
                    <div class="admin-table">
                        <div class="chart-title" style="margin-bottom: 1.5rem;">Recent Events</div>
                        <div style="overflow-x: auto;">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Date</th>
                                        <th>Location</th>
                                        <th>Creator</th>
                                        <th>RSVPs</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.renderEventsTableRows(events, rsvps)}
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
         * Render events table rows
         */
        renderEventsTableRows(events, rsvps) {
            if (events.length === 0) {
                return '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No events found</td></tr>';
            }

            return events.slice(0, 10).map(event => {
                const eventRsvps = rsvps.filter(r => r.eventId === event.id);
                const rsvpCount = eventRsvps.length;
                const attendingCount = eventRsvps.filter(r => r.willAttend === 'yes' || r.status === 'attending').length;

                return `
                    <tr>
                        <td><strong>${event.title}</strong></td>
                        <td>${new Date(event.datetime).toLocaleDateString()}</td>
                        <td>${event.location || 'N/A'}</td>
                        <td>${event.managerEmail || 'N/A'}</td>
                        <td>${attendingCount}/${rsvpCount} RSVPs</td>
                        <td>
                            <button class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="showPage('manage', '${event.id}')">View</button>
                        </td>
                    </tr>
                `;
            }).join('');
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
         * Render events chart
         */
        renderEventsChart(events) {
            const ctx = document.getElementById('adminEventsChart');
            if (!ctx) return;

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
         * Render RSVPs chart
         */
        renderRsvpsChart(rsvps) {
            const ctx = document.getElementById('adminRsvpsChart');
            if (!ctx) return;

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
