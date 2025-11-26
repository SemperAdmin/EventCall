# EventCall Data Fetching Architecture Analysis

## Executive Summary

The EventCall application uses a **centralized GitHub API integration** for data persistence with **client-side caching**, **rate limiting**, and a **dashboard-centric loading strategy**. Events and responses are loaded in two sequential API calls during initial page load, with a 5-minute TTL cache to reduce redundant requests.

---

## 1. GitHub API Integration (js/github-api.js)

### Architecture Overview
- **Single global instance**: `window.githubAPI` (instantiated at bottom of github-api.js)
- **Data repositories**: 
  - EventCall-Data (private) - stores events and RSVPs
  - EventCall-Images (public) - stores cover images
- **Token management**: Supports both `window.userAuth.getGitHubToken()` and `window.GITHUB_CONFIG.token`

### Key Methods

#### `loadEvents(options = {})`
**Purpose**: Load all events owned by current authenticated user from EventCall-Data repo

**Request Flow**:
1. Check 5-minute TTL cache first
2. If not cached (or `forceRefresh: true`):
   - Make 1 request: `GET /repos/{owner}/EventCall-Data/git/trees/main` (recursive)
   - Filter tree for `events/*.json` files
   - **Make N sequential requests** (one per event file): `GET /repos/{owner}/EventCall-Data/git/blobs/{sha}` 
   - Decode base64 content and parse JSON
   - Filter events by authenticated user (username-first, email fallback)
   - Cache results with timestamp

**Cache**: 
```javascript
this.eventsCache = {
    data: null,
    timestamp: null,
    ttl: 5 * 60 * 1000 // 5 minutes
};
```

**Waterfall Issues**: YES - Loads tree first, then loads each event file sequentially. Could be parallelized.

#### `loadResponses()`
**Purpose**: Load all RSVP responses for user's events from EventCall-Data repo

**Request Flow**:
1. No cache for responses
2. Make 1 request: `GET /repos/{owner}/EventCall-Data/git/trees/main`
3. Filter tree for `rsvps/*.json` or `rsvp-*.json` files
4. **Make N sequential requests** (one per RSVP file): `GET /repos/{owner}/EventCall-Data/git/blobs/{sha}`
5. Decode and parse JSON
6. Group RSVPs by event ID

**Waterfall Issues**: YES - Same sequential loading pattern

#### `loadRSVPIssues(options = {})`
**Purpose**: Load pending RSVP submissions from GitHub Issues

**Request Flow**:
1. Check 5-minute TTL cache
2. If not cached:
   - Make 1 request: `GET /repos/{owner}/EventCall/issues?labels=rsvp&state=open&per_page=100`
   - Pagination: Only fetches first 100 issues (no pagination handling for >100)
3. Cache results

**Cache**: Same 5-minute TTL

### Caching Mechanisms

| Cache Type | TTL | Invalidation | Scope |
|-----------|-----|--------------|-------|
| Events Cache | 5 minutes | Time-based | Per instance |
| RSVP Issues Cache | 5 minutes | Time-based | Per instance |
| Force Refresh | Manual | `forceRefresh: true` param | On-demand |

**Issue**: No automatic cache invalidation on data changes. If user creates/deletes event, old cache persists for up to 5 minutes.

---

## 2. Events Index File (events-index.json)

### Current Usage: **MINIMAL**

The `events-index.json` file in the repository root contains an array of events, but **is NOT used by the application**:

```json
[
  [],
  {
    "id": "13a8c3a3-117c-47ba-942b-a92c828b5ad2",
    "title": "Marine Corps Birthday Ball",
    "date": "2025-11-29",
    "time": "20:49",
    ...
  }
]
```

**Why Not Used**:
- The app loads events directly from the GitHub API tree structure
- No client-side code references `events-index.json`
- Appears to be a legacy artifact or intended for future optimization

**Optimization Opportunity**: This file could be updated server-side and fetched once instead of listing all events and loading them individually.

---

## 3. Dashboard Event Loading (js/manager-system.js)

### Initial Page Load Flow

```
DOMContentLoaded Event
    ↓
window.userAuth.init() [authentication check]
    ↓ [if authenticated and on dashboard]
window.loadManagerData()
    ↓
Try to load from GitHub:
    ├─ githubAPI.loadEvents()          [API Call #1: Tree]
    │                                    [API Calls #2-N: Individual event blobs]
    ├─ githubAPI.loadResponses()       [API Call #N+1: Tree]
    │                                    [API Calls #N+2-M: Individual response blobs]
    ├─ updatePendingRSVPCount()        [May trigger: loadRSVPIssues()]
    │                                    [API Call #M+1: Issues list]
    └─ window.displayUserRSVPs()       [User-specific RSVP loading]
    ↓
renderDashboard() [Client-side rendering]
```

### API Call Count on Initial Load

| Scenario | API Calls | Details |
|----------|-----------|---------|
| First load (3 events, 2 RSVP files) | ~10 calls | 1 tree + 3 events + 1 tree + 2 responses + 1 issues + ~2 extras |
| With cache hit (subsequent load) | 0 calls | Both caches valid |
| Force refresh | Same as first | Bypasses cache |

### Load Characteristics

- **Sequential**: Events loaded one-by-one (not parallel)
- **Blocking**: Dashboard doesn't render until both load functions complete
- **No pagination**: All events/responses loaded in single pass
- **No streaming**: User waits for complete data load before seeing anything

---

## 4. Caching Mechanisms Summary

### Client-Side Caching

**Location**: `githubAPI.js` lines 18-28

```javascript
this.rsvpCache = { data: null, timestamp: null, ttl: 5 * 60 * 1000 };
this.eventsCache = { data: null, timestamp: null, ttl: 5 * 60 * 1000 };
```

**Implementation**:
- Time-based cache (5 minutes)
- Checked at start of `loadEvents()` and `loadRSVPIssues()`
- Bypassed if `forceRefresh: true` passed

### Storage

- **In-memory only** - Lost on page reload
- No localStorage persistence
- No service worker caching strategy

---

## 5. Waterfall Requests (Sequential Dependencies)

### Critical Waterfalls

#### Waterfall 1: Loading Events
```
GET /git/trees/main (get event file list)
    ↓
    └─ GET /git/blobs/{sha} (event 1)
    └─ GET /git/blobs/{sha} (event 2)
    └─ GET /git/blobs/{sha} (event 3)
    [Each blob request waits for previous to complete]
```

**Impact**: 3 events = 4 API calls, ~2-3 seconds (with 700ms min delay between requests)

#### Waterfall 2: Loading Responses  
```
GET /git/trees/main (get RSVP file list)
    ↓
    └─ GET /git/blobs/{sha} (RSVP file 1)
    └─ GET /git/blobs/{sha} (RSVP file 2)
    [Sequential loading]
```

#### Waterfall 3: Overall Load
```
Events waterfall (tree + blobs)
    ↓
Responses waterfall (tree + blobs)
    ↓
RSVP Issues list
    ↓
Dashboard render
```

**Optimization**: Events and responses could be loaded in parallel (separate threads/promises)

---

## 6. Rate Limiting & Request Management (js/rate-limiter.js)

### Rate Limiter Configuration

```javascript
class RateLimiter {
  maxConcurrent = 4              // Max 4 concurrent requests
  minDelayMs = 700               // 700ms minimum delay between starts
  
  endpointWindows = {
    default: { maxPerWindow: 30, windowMs: 30_000 }  // 30 req per 30s
  }
}
```

### Features

1. **Concurrency Control**: Max 4 concurrent requests
2. **Minimum Delay**: 700ms between request starts (intentional throttling)
3. **Per-Endpoint Windows**: Different rate limits for different endpoint types
4. **GitHub Header Observation**: Monitors `x-ratelimit-remaining` header
5. **Exponential Backoff**: On 429/503 errors with jitter
6. **Pre-emptive Throttling**: Delays increase when approaching GitHub's 60 req/hour limit

### GitHub Rate Limit Handling

```javascript
githubState = {
    remaining: null,     // Requests remaining in hour
    resetAt: null        // Unix timestamp of reset
}
```

**Behavior**:
- Tracks remaining requests from response headers
- Waits if remaining ≤ 1
- Throttles if remaining ≤ 5
- Warns if remaining ≤ 10

---

## 7. API Call Flow Diagram

```
Initial Page Load
├─ loadManagerData()
│  ├─ githubAPI.loadEvents()
│  │  ├─ [CACHED?] Return cached events
│  │  └─ [NOT CACHED]
│  │     ├─ REQUEST: GET /git/trees/main?recursive=1
│  │     ├─ PARSE: Filter events/*.json
│  │     └─ For each event file:
│  │        ├─ REQUEST: GET /git/blobs/{sha}
│  │        ├─ DECODE: Base64 → JSON
│  │        └─ FILTER: By current user
│  │
│  ├─ githubAPI.loadResponses()  [No cache]
│  │  ├─ REQUEST: GET /git/trees/main?recursive=1
│  │  ├─ PARSE: Filter rsvps/*.json
│  │  └─ For each RSVP file:
│  │     ├─ REQUEST: GET /git/blobs/{sha}
│  │     ├─ DECODE: Base64 → JSON
│  │     └─ GROUP: By event ID
│  │
│  ├─ updatePendingRSVPCount()
│  │  └─ githubAPI.loadRSVPIssues()  [5-min cache]
│  │     └─ REQUEST: GET /issues?labels=rsvp&per_page=100
│  │
│  └─ window.displayUserRSVPs()
│     └─ Displays user's own RSVP entries
│
└─ renderDashboard()
   └─ Client-side rendering (no API calls)
```

---

## 8. Redundant API Calls

### Confirmed Redundancies

1. **Tree fetched twice**: 
   - Once in `loadEvents()` to list event files
   - Again in `loadResponses()` to list RSVP files
   - **Could be optimized**: Fetch once, filter for both
   - **Savings**: 1 API call per load

2. **RSVP Issues loaded during sync**:
   - `syncWithGitHub()` calls `githubAPI.processRSVPIssues()`
   - Which calls `loadRSVPIssues()` (might be cached)
   - Then reloads all data via `loadManagerData()` (cache invalidated)
   - **Timing**: Issues are loaded, processed, then events/responses reloaded

### Potential Issues

- **No validation**: Events deleted from storage but still in cache
- **Stale data**: Cache persists for 5 minutes even if underlying data changed
- **User isolation**: No per-user cache invalidation

---

## 9. Handling Large Datasets

### Current Limitations

| Aspect | Behavior | Limit |
|--------|----------|-------|
| Events per user | All loaded at once | No pagination |
| RSVP responses | All loaded at once | No pagination |
| Issues | First 100 only | `per_page=100` |
| Concurrent requests | 4 simultaneous | Hard coded |
| Memory footprint | All events in `window.events` | Unbounded |

### Scalability Issues

1. **No Pagination**: 
   - User with 100+ events loads all at once
   - Each event = 1 API call
   - 100 events = ~100 API calls + 2 tree calls
   - With 700ms delay = ~70 seconds load time

2. **Memory Consumption**:
   - All event data stored in `window.events` object
   - Each RSVP response in `window.responses[eventId]` array
   - No cleanup on navigation

3. **No Streaming/Virtual Lists**:
   - Dashboard loads all 100+ event cards into DOM
   - Renders immediately (no lazy loading)
   - Potential UI freeze on large datasets

### Workarounds in Place

- **Rate Limiter**: Prevents overwhelming GitHub API
- **Caching**: Reduces repeated fetches within 5 min
- **Tree recursion**: Gets all files in one call instead of directory walking

---

## 10. Performance Metrics

### Network Performance

**Best case** (all cached):
- Time: 0ms
- API calls: 0
- User experience: Instant display

**Typical case** (cache miss, 3 events):
- Tree call: 150ms
- 3 event blobs: 450ms (3 × 150ms)
- Responses tree: 150ms
- 2 response blobs: 300ms (2 × 150ms)
- Issues list: 150ms
- **Total**: ~1.2 seconds (5 parallel batches if optimized)
- **Current**: ~2+ seconds (sequential)

**Worst case** (50 events, 25 RSVP files):
- Tree calls: 300ms (2 trees)
- 50 event blobs: 3750ms+ (50 × 150ms, throttled by rate limiter)
- 25 response blobs: 1875ms+ (25 × 150ms)
- Issues: 150ms
- **Total**: 6+ seconds minimum

### DOM Rendering

- Event cards rendered all at once
- No virtual scrolling
- ~100 DOM elements for 100 events
- Re-render on dashboard tab switch

---

## 11. Redundancy Analysis & Optimization Opportunities

### HIGH PRIORITY Issues

1. **Sequential Event Loading** (Lines 266-308 in github-api.js)
   - **Current**: For loop loads events one-by-one
   - **Optimization**: Use `Promise.all()` with max concurrency control
   - **Savings**: 5-10x faster for >5 events
   - **Effort**: Low

2. **Duplicate Tree Fetches** 
   - **Current**: `loadEvents()` and `loadResponses()` each fetch tree
   - **Optimization**: Cache tree results, reuse in both functions
   - **Savings**: 1 API call per page load
   - **Effort**: Low

3. **No Response Caching**
   - **Current**: `loadResponses()` fetches fresh every time
   - **Optimization**: Add 5-min cache like events
   - **Savings**: 1+ API call on re-navigation
   - **Effort**: Very Low

### MEDIUM PRIORITY Issues

4. **Issues Pagination Limit**
   - **Current**: Only fetches first 100 issues
   - **Optimization**: Add pagination for >100 issues
   - **Effort**: Medium

5. **No Parallel Loading**
   - **Current**: Events → Responses → Issues (sequential)
   - **Optimization**: Load events AND responses in parallel
   - **Savings**: ~30-40% load time
   - **Effort**: Low

### LOW PRIORITY Optimizations

6. **Streaming Dashboard**
   - **Current**: Wait for all data, then render
   - **Optimization**: Render event skeletons while loading
   - **Savings**: Perceived performance improvement
   - **Effort**: Medium-High

7. **Virtual Scrolling**
   - **Current**: Render all events
   - **Optimization**: Only render visible event cards
   - **Savings**: Better performance with 100+ events
   - **Effort**: High

---

## 12. Code Flow Summary

### Key Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `js/github-api.js` | GitHub API wrapper | `loadEvents()`, `loadResponses()`, `loadRSVPIssues()` |
| `js/manager-system.js` | Dashboard & sync | `loadManagerData()`, `syncWithGitHub()`, `renderDashboard()` |
| `js/early-functions.js` | Initial page setup | Calls `loadManagerData()` after auth |
| `js/rate-limiter.js` | Rate limiting | Controls request concurrency & delay |
| `js/api-wrapper.js` | Fetch wrapper | `safeFetchGitHub()`, `batchFetch()` |

### Global State

```javascript
window.events = {}              // All user's events
window.responses = {}           // All RSVP responses, keyed by event ID
window.githubAPI = instance     // Singleton API instance with caches
window.rateLimiter = instance   // Singleton rate limiter
```

---

## 13. Findings Summary

| Aspect | Finding |
|--------|---------|
| **Integration** | Single GitHub API layer via `window.githubAPI` |
| **Caching** | 5-minute TTL, in-memory only, automatic |
| **Loading** | Sequential (waterfall), all-or-nothing |
| **Pagination** | None for events/responses; issues limited to 100 |
| **API Calls** | 5-8 on first load (3 events), 0 within 5 min |
| **Rate Limiting** | 4 concurrent, 700ms min delay, 30 req/30s window |
| **Redundancy** | Tree fetched twice per load cycle |
| **Waterfall** | Events and responses load sequentially |
| **Large Data** | No optimization for 50+ events/responses |
| **Index File** | Not used by application |

