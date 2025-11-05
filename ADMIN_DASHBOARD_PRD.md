# Admin Dashboard PRD
## EventCall Military Event Management Platform

**Version:** 1.1
**Date:** November 5, 2025
**Author:** Claude AI
**Status:** Draft for Review - Technical Corrections Applied

---

## 1. Executive Summary

### 1.1 Purpose
Create a comprehensive admin dashboard for EventCall that enables the system administrator (`semperadmin`) to monitor platform health, manage user accounts, analyze event performance, and gain actionable insights into user engagement and platform usage.

### 1.2 Goals
- Provide real-time visibility into platform metrics and KPIs
- Enable efficient user account management and moderation
- Deliver actionable insights for improving event success rates
- Monitor system health and identify trends
- Support data-driven decision making for platform improvements

### 1.3 Scope
- **In Scope:** Analytics dashboard, user management, event performance tracking, RSVP analytics, system monitoring
- **Out of Scope:** Event creation/editing (already exists), RSVP form modifications, external integrations

---

## 2. User Personas

### 2.1 Primary User: System Administrator (semperadmin)
- **Role:** Platform owner and system administrator
- **Technical Level:** High
- **Goals:**
  - Monitor overall platform health
  - Understand user engagement patterns
  - Identify and resolve issues
  - Optimize event success rates
  - Manage user accounts and permissions
- **Pain Points:**
  - No centralized view of platform metrics
  - Cannot easily identify poorly performing events
  - Limited visibility into user behavior
  - Manual process for user account management

---

## 3. Product Requirements

### 3.1 Access Control

#### 3.1.1 Authentication
- Dashboard accessible only to username `semperadmin`
- Integrated into existing authentication system (`user-auth.js`)
- Role-based access check on dashboard route
- Automatic redirect if unauthorized user attempts access
- Session-based security (maintains existing 30-minute timeout)

#### 3.1.2 Authorization Logic
```javascript
// Check if current user is admin
if (userAuth.getCurrentUser()?.username === 'semperadmin') {
  // Grant access to admin dashboard
  showAdminDashboard();
} else {
  // Redirect to regular dashboard
  showPage('dashboard');
}
```

#### 3.1.3 Navigation
- Admin menu item visible only to `semperadmin`
- Special admin icon/badge in user profile area
- Quick access from main navigation sidebar
- Clear visual distinction from regular user interface

---

### 3.2 Dashboard Layout & Design

#### 3.2.1 Visual Design System
- **Theme:** Military-inspired, professional, data-focused
- **Color Palette:**
  - Primary: Gold (#d4af37) - for CTAs and highlights
  - Secondary: Deep Navy (#1e293b) - for backgrounds
  - Accent: Military Green (#4a5d3f) - for success states
  - Warning: Amber (#f59e0b) - for alerts
  - Danger: Red (#dc2626) - for critical issues
  - Neutral: Slate gray (#64748b) - for text and borders
- **Typography:**
  - Headers: Bold, sans-serif (similar to existing EventCall branding)
  - Body: Clean, readable sans-serif
  - Data: Monospace for numbers/metrics
- **Layout:**
  - Responsive grid system (12-column)
  - Card-based component architecture
  - Sticky header with navigation
  - Collapsible sidebar for filters

#### 3.2.2 Dashboard Structure
```
┌─────────────────────────────────────────────────────┐
│ Header: EventCall Admin Dashboard                   │
│ [semperadmin] | Last Sync: 2 min ago | [Refresh]   │
├─────────────────────────────────────────────────────┤
│ Quick Stats Bar (4 KPI cards)                       │
├─────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────────────┐  │
│ │ Event Metrics    │ │ RSVP Trends Chart        │  │
│ │ (Chart)          │ │                          │  │
│ └──────────────────┘ └──────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐   │
│ │ Recent Events Table                          │   │
│ │ (sortable, filterable)                       │   │
│ └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌──────────────┐ ┌──────────┐   │
│ │ User Activity │ │ Event Types  │ │ Check-ins│   │
│ │ Timeline      │ │ Distribution │ │ Status   │   │
│ └───────────────┘ └──────────────┘ └──────────┘   │
└─────────────────────────────────────────────────────┘
```

---

### 3.3 Key Performance Indicators (KPIs)

#### 3.3.1 Top-Line Metrics (Quick Stats Cards)

**Card 1: Total Events**
- **Metric:** Total number of events created
- **Visual:** Large number with trend indicator
- **Breakdowns:**
  - Active events
  - Archived events
  - Events this month
  - Month-over-month growth %
- **Data Source:** `events/*.json` files

**Card 2: Total RSVPs**
- **Metric:** Total RSVP submissions
- **Visual:** Large number with trend indicator
- **Breakdowns:**
  - Attending vs. Not Attending ratio
  - Average response rate
  - RSVPs this month
  - Total guests (including plus-ones)
- **Data Source:** `rsvps/*.json` files

**Card 3: Active Users**
- **Metric:** Total registered users (unique event creators)
- **Visual:** Large number with trend indicator
- **Breakdowns:**
  - Event managers/creators
  - Active in last 30 days
  - New users this month
  - User growth rate
- **Data Source:** Unique `createdBy` emails from `events/*.json` files
- **Note:** Full user registry requires server-side aggregation via GitHub Actions workflow (see Section 4.2.3)

**Card 4: Average RSVPs per Event**
- **Metric:** Average number of RSVPs received per event
- **Visual:** Number with trend indicator
- **Calculation:** `Total RSVPs / Total Events`
- **Note:** If invitee count tracking is added to event data structure in the future, this can be converted to a true "Engagement Rate" percentage by calculating `(Total RSVPs / Total Invitees) * 100`
- **Benchmark:** Historical average for the platform

---

### 3.4 Analytics Modules

#### 3.4.1 Event Performance Analytics

**A. Event Metrics Overview**
- **Chart Type:** Line chart showing events created over time
- **Time Periods:** Last 7 days, 30 days, 90 days, 1 year, All time
- **Metrics Displayed:**
  - Events created per day/week/month
  - Trend line with moving average
  - Annotations for peak periods

**B. Event Success Dashboard**
- **Definition of Success:**
  - High RSVP rate (>50% of invited)
  - High attendance rate
  - Low cancellation rate
- **Metrics:**
  - Top 10 most successful events (by RSVP count)
  - Bottom 10 least successful events
  - Average RSVPs per event type
  - Success rate by event category

**C. Event Type Distribution**
- **Chart Type:** Donut chart
- **Categories:**
  - Promotion Ceremony
  - Retirement Ceremony
  - Marine Corps Ball
  - Change of Command
  - Dining In/Out
  - Unit Formation
  - Other/Custom
- **Metrics:**
  - Count per category
  - Percentage of total
  - Average RSVPs per category
  - Click to drill down into category details

**D. Event Timeline Analysis**
- **Chart Type:** Calendar heatmap
- **Display:** Events scheduled by date
- **Color Intensity:** Number of events on each date
- **Insights:**
  - Identify busy periods
  - Spot scheduling patterns
  - Find optimal event timing

**E. Events Table (Detailed View)**
- **Columns:**
  - Event Title
  - Date & Time
  - Location
  - Created By
  - Created Date
  - Status (Active/Archived)
  - Total RSVPs
  - Attending Count
  - Not Attending Count
  - Response Rate (%)
  - Last RSVP Date
  - Actions (View, Edit, Archive)
- **Features:**
  - Sortable by any column
  - Search/filter functionality
  - Export to CSV/Excel
  - Bulk actions (archive, delete)
  - Click row to view event details

---

#### 3.4.2 RSVP Analytics

**A. RSVP Trends Over Time**
- **Chart Type:** Multi-line chart
- **Lines:**
  - Total RSVPs submitted
  - Attending RSVPs
  - Not Attending RSVPs
  - Response rate %
- **Time Range:** Selectable (7d, 30d, 90d, 1y, all)
- **Insights:**
  - Identify RSVP submission patterns
  - Track seasonal trends
  - Monitor response rate health

**B. Response Time Analysis**
- **Metric:** Average time from event creation to first RSVP
- **Chart Type:** Bar chart by event
- **Breakdowns:**
  - Fastest responding events
  - Slowest responding events
  - Average response time by event type
- **Goal:** Identify events that generate quick engagement

**C. Guest Count Distribution**
- **Chart Type:** Histogram
- **X-axis:** Number of guests (1, 2, 3, 4, 5+)
- **Y-axis:** Number of RSVPs
- **Metrics:**
  - Average guests per RSVP
  - Most common guest count
  - Total capacity needed per event
  - Plus-one acceptance rate

**D. Dietary Restrictions Analysis**
- **Chart Type:** Horizontal bar chart
- **Data Points:**
  - Vegetarian count
  - Gluten-free count
  - Vegan count
  - Nut allergy count
  - Other restrictions
- **Use Case:** Help event planners prepare for common dietary needs
- **Insights:**
  - Trending dietary restrictions
  - Percentage of attendees with restrictions
  - Recommendations for catering

**E. Attendance Status Breakdown**
- **Chart Type:** Stacked bar chart (per event)
- **Segments:**
  - Attending
  - Not Attending
  - No Response (if invite system added)
- **Metrics:**
  - Overall attendance rate
  - Events with highest/lowest attendance
  - Cancellation patterns

**F. Check-in Performance**
- **Chart Type:** Gauge chart
- **Metrics:**
  - Check-in rate (checked in / total attending)
  - Average check-in time (if tracked)
  - Events with completed check-ins
  - Outstanding check-ins
- **Goal:** Monitor day-of event execution

**G. Military Data Insights** (if collected)
- **Branch Distribution:** Pie chart of USMC, USA, USN, USAF, USCG, USSF
- **Rank Distribution:** Bar chart showing attendee ranks
- **Unit Analysis:** Top units by event participation
- **Civilian vs. Military:** Percentage breakdown

---

#### 3.4.3 User Growth & Engagement

**A. User Registration Timeline**
- **Chart Type:** Area chart
- **Metrics:**
  - New user registrations over time
  - Cumulative total users
  - Growth rate (month-over-month)
- **Data Source:** User creation timestamps from localStorage/GitHub

**B. Event Creator Analytics**
- **Metrics:**
  - Total unique event creators
  - Top event creators (leaderboard)
  - Average events per creator
  - First-time vs. returning creators
- **Chart Type:** Leaderboard table + bar chart
- **Data Source:** `createdBy` field in events

**C. User Activity Heatmap**
- **Chart Type:** Calendar heatmap
- **Display:** User activity by day of week and hour
- **Activities Tracked:**
  - Event creation time
  - RSVP submission time
  - Login times (if tracked)
- **Insights:** Identify peak usage times for maintenance windows

**D. User Retention**
- **Metrics:**
  - 30-day retention rate
  - Repeat event creators
  - Average time between events per creator
  - Churn rate (users who stopped creating events)

**E. User Table (Account Management)**
- **Columns:**
  - Username
  - Full Name
  - Rank
  - Role
  - Email (if available)
  - Events Created
  - Last Login
  - Account Status (Active/Suspended)
  - Actions
- **Features:**
  - Search by username/name/email
  - Filter by role, rank, status
  - Sort by any column
  - Export user list
  - Quick actions:
    - View profile
    - Edit profile
    - Suspend account
    - Delete account (with confirmation)
    - View user's events

---

#### 3.4.4 System Health Monitoring

**A. Platform Activity Log**
- **Display:** Scrollable timeline of recent actions
- **Events Logged:**
  - New event created (by whom, when)
  - RSVP submitted (event, timestamp)
  - User registered (username, timestamp)
  - Event archived/deleted
  - Profile edited
  - System errors (if any)
- **Retention:** Last 1000 actions
- **Features:**
  - Filter by action type
  - Search by username or event
  - Export log

**B. Data Storage Metrics**
- **Metrics:**
  - Total events stored
  - Total RSVPs stored
  - Total users stored
  - Storage usage (if calculable via GitHub API)
  - Growth trend
- **Visual:** Progress bars with capacity indicators

**C. GitHub Integration Status**
- **Metrics:**
  - Last successful sync timestamp
  - Failed workflow runs (if trackable)
  - API rate limit status
  - Repository health
- **Visual:** Status badges (green = healthy, yellow = warning, red = error)

**D. Error Tracking**
- **Display:** Table of recent errors
- **Columns:**
  - Error type
  - Error message
  - User affected
  - Timestamp
  - Status (Resolved/Open)
- **Features:**
  - Mark as resolved
  - Add admin notes
  - Export error log

---

### 3.5 User Account Management

#### 3.5.1 User Profile Management

**A. View User Profile**
- **Access:** Click on username in User Table
- **Modal/Page Display:**
  ```
  ┌─────────────────────────────────────┐
  │ User Profile: [Username]            │
  ├─────────────────────────────────────┤
  │ 👤 Avatar/Initials                  │
  │                                     │
  │ Full Name: [Name]                   │
  │ Username: [username]                │
  │ Rank: [Rank]                        │
  │ Role: [manager/user]                │
  │ Account Created: [Date]             │
  │ Last Login: [Date]                  │
  │ Email: [email] (if available)       │
  │                                     │
  │ ─────────────────────────────       │
  │ Events Created: 12                  │
  │ Total RSVPs Received: 145           │
  │ Average RSVPs per Event: 12.1       │
  │                                     │
  │ [Edit Profile] [View Events]        │
  │ [Suspend Account] [Delete Account]  │
  └─────────────────────────────────────┘
  ```

**B. Edit User Profile**
- **Editable Fields:**
  - Full Name
  - Rank
  - Role (user/manager/admin)
  - Email (if added to system)
  - Account Status (Active/Suspended)
- **Validation:**
  - Require full name (min 2 characters)
  - Rank from dropdown (military + civilian options)
  - Role from dropdown
  - Email validation (if provided)
- **Actions:**
  - Save changes → Update user data in localStorage/GitHub
  - Cancel → Discard changes
  - Reset password (trigger workflow if backend supports)

**C. Account Actions**
- **Suspend Account:**
  - Add `suspended: true` flag to user data
  - Prevent login
  - Show reason modal
  - Notification to user (if email available)
  - Reversible action
- **Delete Account:**
  - Confirmation modal with warning
  - Option to:
    - Delete user only (keep events and RSVPs)
    - Delete user and reassign events to admin
    - Full deletion (user + events + RSVPs)
  - Cannot be reversed
  - Log deletion in activity log

**D. Bulk User Actions**
- **Selection:** Checkbox in user table
- **Actions:**
  - Export selected users
  - Bulk suspend
  - Bulk delete (with confirmation)
  - Send notification (if messaging system exists)

---

### 3.6 Advanced Analytics Features

#### 3.6.1 Custom Date Range Filtering
- **Component:** Date range picker in dashboard header
- **Ranges:**
  - Today
  - Last 7 days
  - Last 30 days
  - Last 90 days
  - This year
  - All time
  - Custom range (date picker)
- **Behavior:** All charts/metrics update when date range changes

#### 3.6.2 Export Functionality
- **Export Options:**
  - Events table → CSV/Excel
  - RSVPs table → CSV/Excel
  - User table → CSV/Excel
  - Analytics summary → PDF report
  - Charts → PNG images
- **Features:**
  - Respects current filters
  - Includes metadata (export date, admin username, filters applied)
  - Async download for large datasets

#### 3.6.3 Search & Filtering
- **Global Search:**
  - Search across events, users, RSVPs
  - Real-time results as you type
  - Keyboard navigation (arrow keys, enter)
- **Filters:**
  - Event status (active/archived)
  - Event type (promotion, retirement, etc.)
  - Date range
  - Creator
  - Location
  - RSVP status (attending/not attending)
  - User role (manager/user)
  - Rank

#### 3.6.4 Comparative Analytics
- **Period Comparison:**
  - Compare current period vs. previous period
  - Example: "This month vs. last month"
  - Show increase/decrease with percentage
  - Trend indicators (↑↓→)
- **Event Comparison:**
  - Select 2-5 events to compare side-by-side
  - Compare RSVPs, attendance, response time, etc.
  - Visual: Grouped bar chart or table

---

### 3.7 Notifications & Alerts

#### 3.7.1 Admin Alerts Dashboard
- **Alert Types:**
  - ⚠️ **Low RSVP Alert:** Event with <20% response rate 7 days before event
  - 🚨 **System Error Alert:** Failed workflow, API errors
  - 📊 **Milestone Alert:** Platform reaches 100 events, 1000 RSVPs, etc.
  - 📅 **Upcoming Event Alert:** Events happening in next 7 days
  - 👤 **Suspicious Activity Alert:** Unusual user behavior (mass deletions, etc.)
- **Display:**
  - Bell icon with notification count in header
  - Dropdown panel with recent alerts
  - Dismiss or mark as read
  - Link to relevant detail page

#### 3.7.2 Email Notifications (if email integration exists)
- **Send admin email for:**
  - Critical system errors
  - Daily summary report (optional)
  - Weekly analytics digest (optional)

---

### 3.8 Insights & Recommendations Engine

#### 3.8.1 Automated Insights
- **Display:** Insight cards at top of dashboard
- **Insight Types:**
  - 💡 "Events created on Fridays get 35% more RSVPs on average"
  - 💡 "Marine Corps Ball events have the highest attendance rate (78%)"
  - 💡 "Response rates drop by 15% for events created less than 2 weeks in advance"
  - 💡 "40% of your users have dietary restrictions - consider adding meal options"
  - 💡 "Peak event creation time is Thursday 2-4 PM"
- **Generation:**
  - Automated analysis of historical data
  - Machine learning patterns (if feasible)
  - Statistical correlations
  - Best practices from top-performing events

#### 3.8.2 Recommendations
- **For Event Creators:**
  - Optimal event creation timing
  - Suggested RSVP deadline (based on historical data)
  - Event types to consider based on past success
- **For Platform Improvement:**
  - Features most requested (based on custom questions)
  - Bottlenecks in user flow
  - Opportunity areas (e.g., "Only 20% of events use seating charts")

---

## 4. Technical Implementation

### 4.1 Architecture

#### 4.1.1 Frontend Components
```
/js/
  admin-dashboard.js       # Main admin dashboard controller
  admin-analytics.js       # Analytics calculations and data processing
  admin-charts.js          # Chart rendering (Chart.js integration)
  admin-user-management.js # User account management functions
  admin-utils.js           # Utility functions for admin panel

/styles/
  admin-dashboard.css      # Admin-specific styling

/index.html
  <!-- Add admin dashboard section -->
```

#### 4.1.2 Data Flow
```
Events JSON Files        → Parse → Calculate Metrics → Render Charts
RSVPs JSON Files         → Parse → Calculate Metrics → Update Tables
GitHub Actions Workflow  → Aggregate User Data → Store in users.json → Parse → Display
                         (or derive from events[].createdBy for basic metrics)
```

#### 4.1.3 Libraries & Dependencies
- **Chart.js 4.x** - For data visualization (line, bar, pie, donut charts)
- **Chart.js Date Adapter** - For time-series charts
- **Existing EventCall utilities** - Reuse existing functions where possible
- **No additional backend** - All processing client-side from existing JSON files

---

### 4.2 Data Sources & Calculations

#### 4.2.1 Event Data
- **Source:** `/events/*.json` files
- **Parsing:**
  ```javascript
  async function loadAllEvents() {
    const eventFiles = await getEventFileList(); // Via GitHub API
    const events = await Promise.all(
      eventFiles.map(file => fetch(file).then(r => r.json()))
    );
    return events;
  }
  ```
- **Metrics Calculated:**
  - Total events: `events.length`
  - Active events: `events.filter(e => e.status === 'active').length`
  - Events this month: `events.filter(e => isThisMonth(e.created)).length`
  - Growth rate: `((currentMonth - lastMonth) / lastMonth) * 100`

#### 4.2.2 RSVP Data
- **Source:** `/rsvps/*.json` files (array format)
- **Parsing:**
  ```javascript
  async function loadAllRSVPs() {
    const rsvpFiles = await getRSVPFileList();
    const rsvpArrays = await Promise.all(
      rsvpFiles.map(file => fetch(file).then(r => r.json()))
    );
    return rsvpArrays.flat(); // Flatten arrays
  }
  ```
- **Metrics Calculated:**
  - Total RSVPs: `rsvps.length`
  - Attending count: `rsvps.filter(r => r.attending === true).length`
  - Average response rate: `(rsvps.length / events.length) * 100`
  - Total guests: `rsvps.reduce((sum, r) => sum + (r.guestCount || 1), 0)`

#### 4.2.3 User Data

**⚠️ Important Note on User Data Aggregation:**

Browser security models prevent accessing localStorage across different user sessions. The admin dashboard cannot read other users' localStorage data from the browser.

**Recommended Approaches:**

**Option 1: GitHub Actions Aggregation (Recommended)**
- Create a GitHub Actions workflow that aggregates user data from authentication events
- Store aggregated user data in a central `users/users.json` file in the repository
- Admin dashboard fetches this file like events and RSVPs
- Workflow triggers:
  - On user registration (via existing `api-auth.yml`)
  - On user login (update last login timestamp)
  - On user profile update
- **Implementation:**
  ```javascript
  async function loadAllUsers() {
    // Fetch aggregated user data from GitHub
    const response = await fetch('users/users.json');
    const users = await response.json();
    return users;
  }
  ```

**Option 2: Derive from Event Creators (Interim Solution)**
- Extract unique event creators from `events[].createdBy` field
- Build basic user metrics from event data
- Limited information available (no registration dates, last login, etc.)
- **Implementation:**
  ```javascript
  function getUsersFromEvents(events) {
    const creatorEmails = [...new Set(events.map(e => e.createdBy))];

    // Build basic user objects
    const users = creatorEmails.map(email => {
      const userEvents = events.filter(e => e.createdBy === email);
      return {
        id: email,
        email: email,
        name: userEvents[0]?.createdByName || extractNameFromEmail(email),
        eventCount: userEvents.length,
        firstEventDate: Math.min(...userEvents.map(e => e.created)),
        lastEventDate: Math.max(...userEvents.map(e => e.created)),
        role: 'manager' // All event creators are managers
      };
    });

    return users;
  }
  ```

**Recommendation for Implementation:**
1. **Phase 1**: Use Option 2 (derive from events) for initial implementation
2. **Phase 2**: Implement Option 1 (GitHub Actions) for complete user management features
3. **Phase 3**: Consider dedicated backend service for real-time user data (future enhancement)

**Required GitHub Actions Workflow:**
```yaml
name: Aggregate User Data
on:
  workflow_dispatch:
  schedule:
    - cron: '0 * * * *' # Hourly aggregation

jobs:
  aggregate-users:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Aggregate user data
        run: |
          # Collect user registration events from issues/workflows
          # Merge with existing users.json
          # Update last login timestamps
          # Save to users/users.json

      - name: Commit updated users data
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add users/users.json
          git commit -m "Update aggregated user data"
          git push
```

#### 4.2.4 Caching Strategy
- **Cache Duration:** 5 minutes
- **Refresh Triggers:**
  - Manual refresh button click
  - Auto-refresh every 5 minutes (if admin dashboard is active)
  - After admin action (e.g., deleting event)
- **Implementation:**
  ```javascript
  let dataCache = {
    events: null,
    rsvps: null,
    users: null,
    lastUpdated: null
  };

  async function loadDashboardData(forceRefresh = false) {
    const cacheAge = Date.now() - dataCache.lastUpdated;
    if (!forceRefresh && cacheAge < 5 * 60 * 1000) {
      return dataCache; // Use cached data
    }
    // Fetch fresh data
    dataCache.events = await loadAllEvents();
    dataCache.rsvps = await loadAllRSVPs();
    dataCache.users = await getAllUsers();
    dataCache.lastUpdated = Date.now();
    return dataCache;
  }
  ```

---

### 4.3 Security Considerations

#### 4.3.1 Access Control
- **Username Check:**
  ```javascript
  function canAccessAdminDashboard() {
    const currentUser = userAuth.getCurrentUser();
    return currentUser && currentUser.username === 'semperadmin';
  }
  ```
- **Route Protection:**
  - Check on dashboard page load
  - Check before any admin action
  - Redirect unauthorized users immediately

#### 4.3.2 Data Modification Safeguards
- **Confirmation Modals:** For all destructive actions (delete, suspend)
- **Audit Logging:** Log all admin actions with timestamp
- **Undo Functionality:** For reversible actions (suspend account)
- **Backup Prompts:** Suggest exporting data before bulk deletions

#### 4.3.3 Data Privacy
- **Sensitive Data Handling:**
  - Hash or redact passwords in any admin view
  - Mask partial email addresses if displayed
  - Follow military data protection protocols
- **Export Security:**
  - Watermark exported files with admin username and timestamp
  - Include disclaimer about data confidentiality

---

### 4.4 Performance Optimization

#### 4.4.1 Lazy Loading
- **Initial Load:** Load only top-line metrics and first chart
- **Progressive Enhancement:** Load remaining charts as user scrolls
- **Benefits:** Faster perceived load time, reduced initial data processing

#### 4.4.2 Pagination
- **User Table:** 25 users per page
- **Events Table:** 25 events per page
- **Activity Log:** 50 items per page
- **Infinite Scroll:** Optional for tables

#### 4.4.3 Chart Rendering Optimization
- **Debounce:** Delay chart updates when filtering (300ms)
- **Destroy & Recreate:** Properly destroy Chart.js instances before updating
- **Canvas Optimization:** Limit chart animations for large datasets

#### 4.4.4 Data Processing
- **Web Workers:** Consider using Web Workers for heavy calculations
- **Memoization:** Cache computed metrics until data changes
- **Incremental Updates:** When new RSVP arrives, update metrics incrementally vs. recalculating all

---

### 4.5 Responsive Design

#### 4.5.1 Mobile View (< 768px)
- **Layout:** Single column, stacked cards
- **Charts:** Simplified versions (fewer data points, larger touch targets)
- **Tables:** Horizontal scroll or card view
- **Navigation:** Hamburger menu for admin sections

#### 4.5.2 Tablet View (768px - 1024px)
- **Layout:** 2-column grid
- **Charts:** Full functionality with touch optimization
- **Tables:** Responsive width, sticky headers

#### 4.5.3 Desktop View (> 1024px)
- **Layout:** Full 3-4 column grid
- **Charts:** Large, detailed visualizations
- **Tables:** Full feature set, keyboard navigation

---

## 5. User Stories & Acceptance Criteria

### 5.1 Core User Stories

**US-1: Admin Authentication**
- **As** the system admin (`semperadmin`)
- **I want to** log in and access a dedicated admin dashboard
- **So that** I can manage the platform and view analytics

**Acceptance Criteria:**
- ✅ Only username `semperadmin` can access admin dashboard
- ✅ Admin menu item appears in navigation only for admin
- ✅ Unauthorized access redirects to regular dashboard with error message
- ✅ Admin session follows same timeout rules (30 minutes)

---

**US-2: Platform Overview**
- **As** the admin
- **I want to** see key platform metrics at a glance
- **So that** I can quickly assess platform health

**Acceptance Criteria:**
- ✅ Dashboard displays 4 top-line KPI cards: Total Events, Total RSVPs, Active Users, Engagement Rate
- ✅ Each KPI shows trend indicator (up/down/neutral)
- ✅ Metrics update when date range filter changes
- ✅ Data refreshes automatically every 5 minutes

---

**US-3: Event Performance Analysis**
- **As** the admin
- **I want to** analyze which events perform best
- **So that** I can identify success patterns and share best practices

**Acceptance Criteria:**
- ✅ Dashboard shows event type distribution (donut chart)
- ✅ Events table displays all events with sortable columns
- ✅ Can filter events by status, type, date range, creator
- ✅ Top 10 and bottom 10 events by RSVP count are highlighted
- ✅ Can export events table to CSV

---

**US-4: RSVP Analytics**
- **As** the admin
- **I want to** understand RSVP patterns and trends
- **So that** I can optimize event planning and improve response rates

**Acceptance Criteria:**
- ✅ Dashboard shows RSVP trend over time (line chart)
- ✅ Displays attendance vs. non-attendance breakdown
- ✅ Shows dietary restrictions analysis
- ✅ Calculates average response time per event
- ✅ Displays guest count distribution (histogram)
- ✅ Check-in performance metrics visible

---

**US-5: User Account Management**
- **As** the admin
- **I want to** view and edit user accounts
- **So that** I can manage permissions and resolve account issues

**Acceptance Criteria:**
- ✅ User table displays all registered users
- ✅ Can search users by username, name, or email
- ✅ Can edit user profile (name, rank, role, status)
- ✅ Can suspend or delete user accounts with confirmation
- ✅ Can view user's event history
- ✅ Can export user list to CSV

---

**US-6: System Health Monitoring**
- **As** the admin
- **I want to** monitor system activity and errors
- **So that** I can proactively identify and resolve issues

**Acceptance Criteria:**
- ✅ Activity log displays recent platform actions (last 1000)
- ✅ Error log displays system errors with timestamps
- ✅ GitHub integration status shows last sync time
- ✅ Storage metrics display current usage
- ✅ Can filter activity log by action type

---

**US-7: Data Export**
- **As** the admin
- **I want to** export platform data
- **So that** I can perform offline analysis or create reports

**Acceptance Criteria:**
- ✅ Can export events to CSV/Excel
- ✅ Can export RSVPs to CSV/Excel
- ✅ Can export users to CSV/Excel
- ✅ Can export analytics summary to PDF
- ✅ Exports include metadata (export date, filters applied)

---

**US-8: Insights & Recommendations**
- **As** the admin
- **I want to** receive automated insights about platform usage
- **So that** I can make data-driven improvements

**Acceptance Criteria:**
- ✅ Dashboard displays 3-5 automated insights based on data analysis
- ✅ Insights update when data changes
- ✅ Insights are actionable and specific
- ✅ Can dismiss individual insights

---

## 6. Wireframes & Mockups

### 6.1 Admin Dashboard - Main View

```
┌─────────────────────────────────────────────────────────────────────┐
│  EventCall Admin Dashboard                    🔔 3    semperadmin ▼ │
│  Last Updated: 2 minutes ago           [🔄 Refresh] [📅 Date Filter]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │    📅     │  │    ✉️      │  │    👥     │  │    📊     │       │
│  │   Total   │  │   Total   │  │  Active   │  │ Engagement│       │
│  │  Events   │  │   RSVPs   │  │   Users   │  │    Rate   │       │
│  │    247    │  │   1,843   │  │    89     │  │    74%    │       │
│  │  ↗ +12%   │  │  ↗ +18%   │  │  ↗ +5%    │  │  ↗ +3%    │       │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 💡 Insights                                                  │   │
│  │ • Events created on Fridays get 35% more RSVPs on average   │   │
│  │ • Response rates drop by 15% for events <2 weeks in advance │   │
│  │ • Marine Corps Ball events have highest attendance (78%)    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐   │
│  │ Event Creation Trend     │  │ RSVP Trend                   │   │
│  │ ┌─────────────────────┐  │  │ ┌─────────────────────────┐  │   │
│  │ │   Line Chart        │  │  │ │  Multi-line Chart       │  │   │
│  │ │   📈                │  │  │ │  📊                     │  │   │
│  │ │                     │  │  │ │  - Total RSVPs          │  │   │
│  │ │                     │  │  │ │  - Attending            │  │   │
│  │ │                     │  │  │ │  - Not Attending        │  │   │
│  │ └─────────────────────┘  │  │ └─────────────────────────┘  │   │
│  └──────────────────────────┘  └──────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Recent Events                              [🔍 Search] [⚙️]  │   │
│  ├──────────┬──────────┬──────────┬───────────┬─────────┬─────┤   │
│  │ Title    │ Date     │ Creator  │ RSVPs     │ Rate    │ ... │   │
│  ├──────────┼──────────┼──────────┼───────────┼─────────┼─────┤   │
│  │ Marine..│ Nov 10   │ john.doe │ 45/60     │ 75%     │ 👁️  │   │
│  │ Promo.. │ Nov 15   │ jane.sm..│ 12/30     │ 40%     │ 👁️  │   │
│  │ Retire..│ Nov 20   │ bob.jones│ 89/100    │ 89%     │ 👁️  │   │
│  └──────────┴──────────┴──────────┴───────────┴─────────┴─────┘   │
│  [← Previous]  Page 1 of 10  [Next →]                              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Event Types  │  │ User Activity│  │ Check-in Rate│             │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │             │
│  │ │ Donut    │ │  │ │ Timeline │ │  │ │  Gauge   │ │             │
│  │ │ Chart    │ │  │ │ ──────── │ │  │ │   68%    │ │             │
│  │ │ 🍩       │ │  │ │ ●──────  │ │  │ │          │ │             │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 6.2 User Management View

```
┌─────────────────────────────────────────────────────────────────────┐
│  User Management                                         🔔    ⚙️    │
│  ← Back to Dashboard                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [🔍 Search users...]  [🗂️ Role ▼] [🎖️ Rank ▼] [📊 Export CSV]     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Total Users: 89  |  Active: 76  |  Suspended: 2  |  New: 5  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ☑️ Username    Name           Rank    Events  Last Login  ⚙️│   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ☐ john.doe    John Doe       Sgt      12     2 days ago   👁️│   │
│  │ ☐ jane.smith  Jane Smith     Cpl       8     1 hour ago   👁️│   │
│  │ ☐ bob.jones   Bob Jones      MSgt     23     3 days ago   👁️│   │
│  │ ☐ alice.mil   Alice Miller   Capt      5     Just now     👁️│   │
│  │ ☐ ...                                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  [← Previous]  Page 1 of 4  [Next →]                              │
│                                                                      │
│  Selected: 2 users                                                  │
│  [📤 Export Selected] [🚫 Suspend Selected] [🗑️ Delete Selected]   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 6.3 User Profile Edit Modal

```
┌─────────────────────────────────────┐
│ Edit User Profile          [✕ Close]│
├─────────────────────────────────────┤
│                                     │
│  👤 john.doe                        │
│                                     │
│  Full Name *                        │
│  [John Doe                        ] │
│                                     │
│  Username                           │
│  [john.doe         ] (read-only)    │
│                                     │
│  Rank                               │
│  [Sergeant ▼                      ] │
│                                     │
│  Role                               │
│  [Manager ▼                       ] │
│                                     │
│  Account Status                     │
│  ● Active  ○ Suspended              │
│                                     │
│  ─────────────────────────────      │
│  Account Stats                      │
│  • Created: Jan 15, 2025            │
│  • Last Login: 2 days ago           │
│  • Events Created: 12               │
│  • Total RSVPs Received: 145        │
│                                     │
│  ─────────────────────────────      │
│                                     │
│  [💾 Save Changes]  [Cancel]        │
│                                     │
│  Danger Zone                        │
│  [🚫 Suspend Account]               │
│  [🗑️ Delete Account]                │
└─────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Set up admin dashboard structure and access control

**Deliverables:**
- [ ] Admin route and page structure
- [ ] Access control logic (username check)
- [ ] Admin navigation menu item
- [ ] Basic dashboard layout (header, sidebar, main content area)
- [ ] Data loading functions (events, RSVPs, users)
- [ ] Caching mechanism

**Testing:**
- Access control works correctly
- Only `semperadmin` sees admin menu
- Unauthorized users redirected
- Data loads successfully

---

### Phase 2: Core Analytics (Week 3-4)
**Goal:** Implement top-line metrics and key charts

**Deliverables:**
- [ ] 4 KPI cards (Events, RSVPs, Users, Engagement)
- [ ] Event creation trend chart (line chart)
- [ ] RSVP trend chart (multi-line)
- [ ] Event type distribution (donut chart)
- [ ] Date range filter functionality
- [ ] Auto-refresh mechanism
- [ ] Chart.js integration

**Testing:**
- KPIs calculate correctly
- Charts render properly
- Date filter updates all metrics
- Auto-refresh works
- Responsive on mobile/tablet

---

### Phase 3: Tables & User Management (Week 5-6)
**Goal:** Implement data tables and user account management

**Deliverables:**
- [ ] Events table (sortable, filterable, searchable)
- [ ] User table (sortable, filterable, searchable)
- [ ] Pagination for tables
- [ ] User profile view modal
- [ ] User profile edit functionality
- [ ] Suspend/delete account features
- [ ] Export to CSV functionality

**Testing:**
- Tables sort correctly
- Search/filter works
- Pagination functions
- Edit user profile saves changes
- Suspend account works
- Delete account with confirmation

---

### Phase 4: Advanced Analytics (Week 7-8)
**Goal:** Add detailed analytics modules

**Deliverables:**
- [ ] RSVP detailed analytics (response time, guest count, dietary restrictions)
- [ ] Check-in performance metrics
- [ ] Military data insights (rank, branch distribution)
- [ ] User growth charts
- [ ] Event creator leaderboard
- [ ] Activity heatmap
- [ ] Comparative analytics (period comparison)

**Testing:**
- All calculations accurate
- Charts display correctly
- Insights are meaningful
- Comparisons work

---

### Phase 5: System Monitoring & Alerts (Week 9)
**Goal:** Add system health monitoring and notifications

**Deliverables:**
- [ ] Activity log (recent actions)
- [ ] Error tracking
- [ ] GitHub integration status
- [ ] Storage metrics
- [ ] Alert system (low RSVP, errors, milestones)
- [ ] Notification bell with dropdown

**Testing:**
- Activity log updates in real-time
- Alerts trigger correctly
- Notifications dismissable
- Error log displays errors

---

### Phase 6: Insights & Polish (Week 10)
**Goal:** Add automated insights and final polish

**Deliverables:**
- [ ] Automated insights engine
- [ ] Recommendations based on data patterns
- [ ] Export analytics to PDF
- [ ] Chart export to PNG
- [ ] Performance optimization
- [ ] Mobile responsiveness refinement
- [ ] Accessibility audit (keyboard nav, screen readers)
- [ ] User documentation

**Testing:**
- Insights are accurate and actionable
- PDF export works
- Performance is acceptable (< 2s load time)
- Passes accessibility checks
- Works on all devices

---

### Phase 7: Testing & Launch (Week 11-12)
**Goal:** Comprehensive testing and deployment

**Deliverables:**
- [ ] End-to-end testing
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Performance testing (large datasets)
- [ ] Security audit
- [ ] Bug fixes
- [ ] User acceptance testing with `semperadmin`
- [ ] Documentation (admin guide)
- [ ] Deployment to production

**Launch Checklist:**
- [ ] All features working
- [ ] No critical bugs
- [ ] Performance acceptable
- [ ] Security reviewed
- [ ] Documentation complete
- [ ] Admin trained
- [ ] Backup plan in place

---

## 8. Success Metrics

### 8.1 Product Success Metrics

**Adoption:**
- Admin logs in at least 3x per week
- Average session duration > 10 minutes
- All dashboard sections viewed within first month

**Utility:**
- Admin uses user management features at least 2x per month
- Data export used at least 1x per week
- Insights section viewed in 80% of sessions

**Performance:**
- Dashboard loads in < 2 seconds
- Charts render in < 1 second
- No critical bugs reported in first month

**Platform Impact:**
- Event success rate improves by 10% within 3 months
- User issues resolved 50% faster with admin tools
- Data-driven decisions documented

---

### 8.2 Technical Success Metrics

**Code Quality:**
- Follows existing EventCall code style
- Commented for maintainability
- Modular and reusable components
- Passes ESLint (if used)

**Performance:**
- No memory leaks (Chart.js instances properly destroyed)
- < 5MB total data transferred on load
- Efficient data processing (< 500ms for calculations)

**Compatibility:**
- Works on Chrome, Firefox, Safari, Edge (latest versions)
- Mobile responsive (iOS Safari, Android Chrome)
- Degrades gracefully on older browsers

**Security:**
- Access control enforced
- No sensitive data exposed in console logs
- XSS protection maintained
- Follows military data handling protocols

---

## 9. Risks & Mitigation

### 9.1 Technical Risks

**Risk 1: Large Dataset Performance**
- **Description:** As events/RSVPs grow (1000+ events), dashboard may slow down
- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - Implement pagination early
  - Use Web Workers for heavy calculations
  - Consider server-side aggregation in future (GitHub Actions workflow)
  - Limit default date range to last 90 days

**Risk 2: Chart.js Integration Issues**
- **Description:** Chart.js may conflict with existing code or have rendering bugs
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Test Chart.js in isolated environment first
  - Use stable version (4.x)
  - Include fallback to table view if charts fail
  - Properly destroy chart instances to prevent memory leaks

**Risk 3: Data Inconsistency**
- **Description:** JSON files may have inconsistent structure, breaking calculations
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Implement robust error handling
  - Validate data structure on load
  - Display error messages for invalid data
  - Provide data cleanup utility

---

### 9.2 UX Risks

**Risk 1: Admin Overwhelmed by Data**
- **Description:** Too many metrics and charts may confuse rather than inform
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Start with top-line metrics only
  - Progressive disclosure (expand for details)
  - Provide dashboard tour/tutorial
  - Allow admin to customize dashboard layout (future)

**Risk 2: Mobile Experience Subpar**
- **Description:** Complex dashboard may not work well on mobile
- **Likelihood:** Low (admin likely uses desktop)
- **Impact:** Low
- **Mitigation:**
  - Optimize for tablet/desktop primarily
  - Ensure critical features work on mobile
  - Test on actual mobile devices

---

### 9.3 Security Risks

**Risk 1: Hardcoded Admin Username**
- **Description:** Username `semperadmin` is hardcoded, not flexible for multiple admins
- **Likelihood:** High (by design)
- **Impact:** Low (acceptable for v1)
- **Mitigation:**
  - Document limitation
  - Plan for role-based access in v2
  - Ensure strong password for `semperadmin`

**Risk 2: Client-Side Data Access**
- **Description:** All data visible in browser (JSON files), potential privacy concern
- **Likelihood:** Low (GitHub repo already controls access)
- **Impact:** Medium
- **Mitigation:**
  - Maintain GitHub repo access control
  - Don't expose sensitive data in exports
  - Consider server-side analytics aggregation (future)

---

## 10. Future Enhancements (Post-V1)

### 10.1 Advanced Features
- **Multi-Admin Support:** Role-based access for multiple admin users
- **Custom Dashboard:** Allow admin to customize dashboard layout (drag-and-drop widgets)
- **Automated Reports:** Schedule weekly/monthly email reports
- **Predictive Analytics:** ML-based predictions for event success
- **A/B Testing:** Test different event configurations
- **User Messaging:** Direct messaging to event creators from admin panel
- **Advanced Filtering:** Saved filter presets
- **Data Export Scheduling:** Automated daily/weekly exports

### 10.2 Integrations
- **Google Analytics:** Track page views and user flows
- **Email Integration:** Send notifications from admin panel
- **Slack/Teams Integration:** Post alerts to channels
- **External BI Tools:** Export data to Tableau, Power BI, etc.

### 10.3 Performance Enhancements
- **Server-Side Analytics:** Move heavy calculations to GitHub Actions workflows
- **Real-Time Updates:** WebSocket or polling for live data
- **CDN for Static Assets:** Faster load times
- **Lazy Loading Images:** For event cover images in tables

---

## 11. Appendix

### 11.1 Chart.js Setup Example

```javascript
// Event creation trend line chart
const ctx = document.getElementById('eventTrendChart').getContext('2d');
const eventTrendChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Events Created',
      data: [12, 19, 15, 25, 22, 30],
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
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  }
});
```

### 11.2 Sample Metric Calculations

```javascript
// Calculate average RSVPs per event
function calculateAvgRSVPsPerEvent(events, rsvps) {
  if (events.length === 0) return 0;

  const avgRSVPs = rsvps.length / events.length;
  return Math.round(avgRSVPs * 10) / 10; // Round to 1 decimal place
}

// Calculate true engagement rate (requires inviteeCount tracking)
// Note: This requires adding an 'inviteeCount' field to each event object
function calculateEngagementRate(events, rsvps) {
  // Group RSVPs by event
  const rsvpsByEvent = groupRSVPsByEvent(rsvps);

  // Calculate engagement for each event that has invitee count
  let totalEngagement = 0;
  let eventsWithInviteeCount = 0;

  events.forEach(event => {
    if (event.inviteeCount && event.inviteeCount > 0) {
      const eventRSVPs = rsvpsByEvent[event.id]?.length || 0;
      const eventEngagement = (eventRSVPs / event.inviteeCount) * 100;
      totalEngagement += eventEngagement;
      eventsWithInviteeCount++;
    }
  });

  if (eventsWithInviteeCount === 0) {
    // Fallback: return average RSVPs per event if invitee tracking not available
    return calculateAvgRSVPsPerEvent(events, rsvps);
  }

  // Return average engagement rate across all events
  return Math.round(totalEngagement / eventsWithInviteeCount);
}

// Calculate growth rate
function calculateGrowthRate(currentPeriod, previousPeriod) {
  if (previousPeriod === 0) return 100;

  const growth = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
  return Math.round(growth);
}

// Get events by date range
function filterEventsByDateRange(events, startDate, endDate) {
  return events.filter(event => {
    const eventDate = new Date(event.created);
    return eventDate >= startDate && eventDate <= endDate;
  });
}

// Group RSVPs by event
function groupRSVPsByEvent(rsvps) {
  return rsvps.reduce((acc, rsvp) => {
    if (!acc[rsvp.eventId]) {
      acc[rsvp.eventId] = [];
    }
    acc[rsvp.eventId].push(rsvp);
    return acc;
  }, {});
}
```

### 11.3 Glossary

- **KPI:** Key Performance Indicator - measurable value showing how effectively objectives are achieved
- **RSVP:** Répondez s'il vous plaît - response to event invitation
- **Engagement Rate:** Percentage of invited guests who respond to an event (requires invitee count tracking); if not tracked, displayed as "Average RSVPs per Event" instead
- **Average RSVPs per Event:** Total RSVPs divided by total events (used when invitee count is not tracked)
- **Check-in Rate:** Percentage of attendees who check in at event
- **Response Time:** Time from event creation to first RSVP
- **Active User:** User who has logged in or created event in last 30 days
- **Event Success:** Event with RSVP rate > 50% and high attendance

---

## 12. Sign-Off

This PRD requires approval from:

- [ ] **Product Owner:** _______________________ Date: _______
- [ ] **Technical Lead:** _______________________ Date: _______
- [ ] **Admin User (semperadmin):** _____________ Date: _______

**Version History:**
- v1.0 - November 4, 2025 - Initial draft
- v1.1 - November 5, 2025 - Technical corrections:
  - Fixed user data aggregation strategy (removed localStorage approach, added GitHub Actions workflow)
  - Corrected engagement rate calculation to use invitee count or display as "Average RSVPs per Event"
  - Updated data flow documentation
  - Added implementation recommendations for phased rollout

---

*End of Admin Dashboard PRD*
