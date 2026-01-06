## Dev/Prod Endpoint Management

* Centralize `dispatchURL` selection via environment flag and single utility.

* Default to local proxy in dev; block remote Render URL for localhost/127.0.0.1.

* Update backend CORS to allow `http://localhost:4200` and `http://127.0.0.1:4200` consistently.

* Verify preflight handling and credentials as needed; add timeouts and per-request abort.

## GitHub Persistence (Users & RSVPs)

* Ensure `updateUserProfile` performs create vs update with correct `sha` handling on 404/200.

* Implement idempotent upserts and conflict detection for concurrent writes.

* Add robust error surfaces for rate limits and network failures; align with backoff policy.

* Normalize JSON schema for `users/<username>.json` and `rsvps/<eventId>.json` and validate on write.

## Events Loading & Caching

* Keep GitHub API as source of truth but add local cache with TTL for offline/poor network.

* Preload events once per session for `getEventForRSVP` lookups.

* Handle pagination and partial failures gracefully; show empty-state placeholders.

## Tabs, Seating, and Sync Banner

* Confirm `manage_active_tab='special'` persistence across refresh and route changes.

* Debounce seating save; guard action delegation selectors to avoid stray clicks.

* Finalize sync banner lifecycle: show on first failure, hide on success, backoff with cap.

## Validation UX

* Maintain silent realtime validation; surface errors only on submit.

* Ensure keyboard and screen-reader accessibility for summary and inline errors.

* Add field-level and form-level tests for submit gating.

## Date Formatting & Clearing Data

* Lock utility behavior: empty → `''`, invalid parse → `"Invalid Date"`, locale-safe formatting.

* Unit tests for edge cases (empty, null, bad strings, timezone crossings).

* Gate `clearLocalData` / `clearAppData` behind confirmation; integrate with sign-out and troubleshooting.

## UI Styling QA

* Validate color contrast against WCAG for inputs, placeholders, and seating empty-state.

* Cross-browser checks (Chrome, Firefox, Safari, Edge) and light/dark modes.

* Ensure CSS changes don’t regress form controls or seating readability.

## Observability & Error Handling

* Standardize fetch error handling paths and user messaging across profile/RSVP/events flows.

* Instrument retry counts and last failure reason for diagnostics (non-PII).

## Test Plan

* Unit tests: utilities (dates, validation), backend-api write flows.

* Integration tests: profile register/login, RSVP create/update, events preload and lookup.

* Scenario tests: offline mode, rate-limited GitHub, proxy unavailable.

## Deliverables

* Refactors for endpoint management and CORS.

* Write-path robustness for users/RSVPs.

* Caching layer, sync banner lifecycle, validation tests.

* QA checklist and test suite updates.

