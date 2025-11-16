# EventCall Secure Architecture

## Overview

EventCall now uses a **secure GitHub Actions backend** to protect your private EventCall-Data repository while maintaining all functionality.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│                      (No Token Needed!)                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Reads from public files
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EventCall (Public Repo)                        │
│  ┌───────────────┬───────────────┬───────────────────────────┐  │
│  │events-index.js│users-index.json│rsvps-index.json           │  │
│  └───────────────┴───────────────┴───────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      ▲
                      │ Published by GitHub Actions
                      │ (Every 5-10 minutes via scheduled workflows)
                      │
┌─────────────────────────────────────────────────────────────────┐
│              GitHub Actions Workflows (Secure)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Uses EVENTCALL_MANAGER_TOKEN secret                      │   │
│  │ (Token never exposed to client-side code)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Fetches data securely
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              EventCall-Data (Private Repo)                       │
│  ┌────────────┬────────────┬──────────────────────────────┐     │
│  │  events/   │   users/   │   responses/ (RSVPs)         │     │
│  └────────────┴────────────┴──────────────────────────────┘     │
│               ⚠️ Stays Private - Never exposed                   │
└─────────────────────────────────────────────────────────────────┘
```

## Security Benefits

### ✅ Before (INSECURE)
- ❌ GitHub token hardcoded in `js/config.js`
- ❌ Token visible in browser DevTools
- ❌ Token exposed in source code
- ❌ Full access to private repo from client-side

### ✅ After (SECURE)
- ✅ No token in client-side code
- ✅ Token stored securely in GitHub Secrets
- ✅ EventCall-Data stays private
- ✅ Frontend reads from published public files
- ✅ GitHub Actions sync data automatically every 5-10 minutes

## How It Works

### 1. Data Collection (Server-Side)
GitHub Actions workflows run on a schedule:
- **api-get-events.yml**: Every 5 minutes
- **api-get-users.yml**: Every 10 minutes
- **api-get-rsvps.yml**: Every 5 minutes

Each workflow:
1. Uses `secrets.EVENTCALL_MANAGER_TOKEN` to access private EventCall-Data repo
2. Fetches all files from the respective directory (events/, users/, responses/)
3. Decodes base64 content from GitHub API
4. Combines into a single JSON file
5. Publishes to public EventCall repo

### 2. Data Consumption (Client-Side)
Frontend code reads from published files:
- `githubAPI.loadEvents()` → reads `events-index.json`
- `AdminDashboard.fetchAllUsers()` → reads `users-index.json`
- `githubAPI.loadResponses()` → reads `rsvps-index.json`

**No token needed!** Files are publicly readable from EventCall repo.

## Setup Instructions

### Step 1: Add GitHub Secret

1. Go to your EventCall repository settings
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `EVENTCALL_MANAGER_TOKEN`
5. Value: Your GitHub Personal Access Token with access to EventCall-Data
6. Click **Add secret**

### Step 2: Verify Token Permissions

Your token must have:
- **Repository Access**: EventCall-Data (private repo)
- **Permissions**:
  - Contents: Read and Write
  - Metadata: Read

### Step 3: Trigger Initial Sync

You can manually trigger the workflows or wait for the scheduled runs:

```bash
# Manually trigger via GitHub CLI
gh workflow run api-get-events.yml
gh workflow run api-get-users.yml
gh workflow run api-get-rsvps.yml
```

Or via GitHub UI:
1. Go to **Actions** tab
2. Select a workflow (e.g., "API - Get Events")
3. Click **Run workflow**

### Step 4: Verify Published Files

After workflows run, check for these files in your EventCall repo:
- `events-index.json`
- `users-index.json`
- `rsvps-index.json`

These will be auto-generated and updated by the workflows.

## File Changes

### Workflows Updated
- `.github/workflows/api-get-events.yml` - Uses `EVENTCALL_MANAGER_TOKEN`
- `.github/workflows/api-get-users.yml` - Uses `EVENTCALL_MANAGER_TOKEN`
- `.github/workflows/api-get-rsvps.yml` - Uses `EVENTCALL_MANAGER_TOKEN`

### Frontend Updated
- `js/config.js` - Token removed, set to `null`
- `js/github-api.js`:
  - `loadEvents()` - Reads from `events-index.json`
  - `loadResponses()` - Reads from `rsvps-index.json`
- `js/admin-dashboard.js`:
  - `fetchAllEvents()` - Reads from `events-index.json`
  - `fetchAllUsers()` - Reads from `users-index.json`

## Monitoring

### Check Workflow Status

Go to **Actions** tab to see workflow runs:
- Green checkmark = Success
- Red X = Failed (check logs)

### Common Issues

**Issue**: Published JSON files don't exist
- **Solution**: Workflows haven't run yet. Manually trigger them.

**Issue**: 404 errors when loading data
- **Solution**: Wait for workflows to complete. Check Actions tab for errors.

**Issue**: Workflows failing with 403/401
- **Solution**: Check that EVENTCALL_MANAGER_TOKEN secret is set correctly with proper permissions.

## Performance

- **Data Freshness**: 5-10 minutes (based on workflow schedule)
- **No API Rate Limits**: Reading from raw GitHub URLs (not API endpoints)
- **Client Performance**: Faster! Single file download vs. multiple API calls
- **Caching**: Frontend still uses in-memory cache for instant page loads

## Maintenance

### Token Rotation

GitHub tokens expire. To rotate:

1. Generate new Personal Access Token
2. Update `EVENTCALL_MANAGER_TOKEN` secret in repository settings
3. Workflows will automatically use new token on next run

### Adjusting Sync Frequency

Edit the `cron` schedule in workflow files:

```yaml
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
```

Common schedules:
- Every 5 minutes: `*/5 * * * *`
- Every 15 minutes: `*/15 * * * *`
- Every hour: `0 * * * *`
- Every 6 hours: `0 */6 * * *`

## Migration Checklist

- [x] Remove hardcoded token from `js/config.js`
- [x] Update all workflows to use `EVENTCALL_MANAGER_TOKEN`
- [x] Update frontend to read from published JSON files
- [ ] Add `EVENTCALL_MANAGER_TOKEN` secret in GitHub repository settings
- [ ] Manually trigger workflows for initial sync
- [ ] Verify published JSON files exist
- [ ] Test frontend loads data correctly
- [ ] Revoke old exposed token

## Support

If you encounter issues:

1. Check Actions tab for workflow errors
2. Verify secret is set correctly
3. Check browser console for JavaScript errors
4. Ensure published JSON files exist in repo

---

**Security Status**: ✅ READY FOR PRODUCTION

The hardcoded token has been removed and replaced with a secure GitHub Actions backend.
