# EventCall Token Setup Guide

## Current Status
- ✅ Built-in GITHUB_TOKEN is working (automatic in workflows)
- ⚠️ EVENTCALL_MANAGER_TOKEN needs to be added to GitHub Secrets
- ⚠️ Dispatch token needs to be added to js/config.js
- ⚠️ Simple auth is currently enabled (temporary)

## Step 1: Add EVENTCALL_MANAGER_TOKEN Secret

This allows workflows to fetch data from your private EventCall-Data repository.

1. Go to: https://github.com/SemperAdmin/EventCall/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `EVENTCALL_MANAGER_TOKEN`
4. Value: Your "EventCall-Manager-Token" (the token with access to EventCall-Data)
5. Click **"Add secret"**

**Verify it works:**
1. Go to: https://github.com/SemperAdmin/EventCall/actions/workflows/api-get-events.yml
2. Click **"Run workflow"** → **"Run workflow"**
3. Wait for it to complete
4. Check if `events-index.json` was created in your repo

## Step 2: Add Dispatch Token to Config

This allows the browser to trigger GitHub Actions workflows.

### If you have an existing token:

Edit `js/config.js` line 18:

```javascript
// Before:
token: null,

// After (use your actual token):
token: 'ghp_your_token_here',
```

### If you need to create a new token:

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Token name: `EventCall-Dispatch-Token`
4. Expiration: Your choice (recommend 90 days)
5. Scopes: Check ONLY `public_repo` (or `workflow` if available)
   - ⚠️ DO NOT give it access to private repos
   - It only needs to trigger workflows on the public EventCall repo
6. Click **"Generate token"**
7. Copy the token
8. Add it to `js/config.js` line 18

## Step 3: Disable Simple Auth

Once you have the dispatch token added, edit `js/config.js` line 88:

```javascript
// Before:
simpleAuth: true,

// After:
simpleAuth: false,
```

This enables full workflow-based authentication.

## Step 4: Test the Setup

1. Clear your browser cache
2. Go to your EventCall app
3. Try to login with a real user (not the temporary semperadmin)
4. Create a test event
5. Submit a test RSVP

## Verification Checklist

- [ ] EVENTCALL_MANAGER_TOKEN added to GitHub Secrets
- [ ] Workflows can fetch from EventCall-Data (check Actions tab)
- [ ] Published JSON files exist (events-index.json, users-index.json, rsvps-index.json)
- [ ] Dispatch token added to js/config.js
- [ ] simpleAuth set to false
- [ ] Login works with real users
- [ ] Events can be created
- [ ] RSVPs can be submitted
- [ ] Admin dashboard loads

## Token Security Summary

| Token | Location | Access | Purpose |
|-------|----------|--------|---------|
| GITHUB_TOKEN | Automatic in workflows | EventCall repo (write) | Publish JSON files |
| EVENTCALL_MANAGER_TOKEN | GitHub Secrets | EventCall-Data (read/write) | Fetch private data |
| Dispatch Token | js/config.js | EventCall repo (workflow trigger) | Browser triggers workflows |

## Troubleshooting

### Workflows fail with 403/401
- Check EVENTCALL_MANAGER_TOKEN is set correctly
- Verify token has access to EventCall-Data repo

### Login doesn't work
- Check dispatch token is in js/config.js
- Verify simpleAuth is false
- Check browser console for errors

### Events don't load
- Check that workflows have run at least once
- Verify JSON files exist in repo
- Check browser console for 404 errors

### Admin dashboard shows 0 users
- Verify users-index.json exists
- Check that api-get-users.yml workflow has run
- Verify EVENTCALL_MANAGER_TOKEN has access to users/ directory

## Support

If issues persist:
1. Check GitHub Actions logs for errors
2. Check browser console for JavaScript errors
3. Verify all secrets are set correctly
4. Check that JSON files exist in repo
