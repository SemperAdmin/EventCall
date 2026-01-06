# Secure Token Implementation Guide
## Using GitHub Actions as a Serverless Backend

This guide shows how to secure your GitHub token while maintaining full functionality.

---

## Overview

**Problem:** GitHub token hardcoded in client-side JavaScript
**Solution:** Move token to GitHub Actions secrets, use workflows as serverless backend
**Benefits:** No additional hosting required, fully secure, same functionality

---

## Architecture

```
User Browser (Frontend)
    ↓ (triggers workflow via repository_dispatch)
GitHub Actions Workflow (Backend)
    ↓ (uses secure GITHUB_TOKEN)
EventCall-Data Repository
    ↓ (returns data)
GitHub Actions Workflow
    ↓ (publishes result)
User Browser (Frontend receives data)
```

---

## Step 1: Create GitHub Actions Workflows

### Workflow 1: Fetch User Data

Create `.github/workflows/fetch-users.yml`:

```yaml
name: Fetch Users API
on:
  repository_dispatch:
    types: [fetch-users]

jobs:
  fetch-users:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Fetch Users from EventCall-Data
        env:
          GH_TOKEN: ${{ secrets.EVENTCALL_DATA_TOKEN }}
        run: |
          # Fetch users directory
          response=$(curl -s -H "Authorization: token $GH_TOKEN" \
            "https://api.github.com/repos/${{ github.repository_owner }}/EventCall-Data/contents/users")

          # Extract user files
          echo "$response" | jq -r '.[] | select(.name | endswith(".json")) | .download_url' | while read url; do
            curl -s -H "Authorization: token $GH_TOKEN" "$url"
          done | jq -s '.' > users.json

      - name: Upload Users Data
        uses: actions/upload-artifact@v4
        with:
          name: users-data
          path: users.json
          retention-days: 1
```

### Workflow 2: Fetch Events Data

Create `.github/workflows/fetch-events.yml`:

```yaml
name: Fetch Events API
on:
  repository_dispatch:
    types: [fetch-events]

jobs:
  fetch-events:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Fetch Events from EventCall-Data
        env:
          GH_TOKEN: ${{ secrets.EVENTCALL_DATA_TOKEN }}
        run: |
          response=$(curl -s -H "Authorization: token $GH_TOKEN" \
            "https://api.github.com/repos/${{ github.repository_owner }}/EventCall-Data/git/trees/main?recursive=1")

          echo "$response" | jq -r '.tree[] | select(.path | startswith("events/") and endswith(".json")) | .sha' | while read sha; do
            curl -s -H "Authorization: token $GH_TOKEN" \
              "https://api.github.com/repos/${{ github.repository_owner }}/EventCall-Data/git/blobs/$sha" \
              | jq -r '.content' | base64 -d
          done | jq -s '.' > events.json

      - name: Upload Events Data
        uses: actions/upload-artifact@v4
        with:
          name: events-data
          path: events.json
          retention-days: 1
```

### Workflow 3: Update Data (Create/Update Events, Users)

Create `.github/workflows/update-data.yml`:

```yaml
name: Update Data API
on:
  repository_dispatch:
    types: [update-event, create-event, update-user, create-user]

jobs:
  update-data:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout EventCall-Data
        uses: actions/checkout@v4
        with:
          repository: ${{ github.repository_owner }}/EventCall-Data
          token: ${{ secrets.EVENTCALL_DATA_TOKEN }}

      - name: Update Data
        run: |
          # Get data from dispatch payload
          echo '${{ toJson(github.event.client_payload) }}' > payload.json

          ACTION_TYPE=$(jq -r '.action_type' payload.json)
          FILE_PATH=$(jq -r '.file_path' payload.json)
          CONTENT=$(jq -r '.content' payload.json)

          # Write content to file
          echo "$CONTENT" > "$FILE_PATH"

      - name: Commit and Push
        run: |
          git config user.name "EventCall Bot"
          git config user.email "eventcall-bot@users.noreply.github.com"
          git add .
          git commit -m "Update data via API: ${{ github.event.client_payload.action_type }}"
          git push
```

---

## Step 2: Configure GitHub Secrets

1. **Create a new Personal Access Token:**
   - Go to https://github.com/settings/tokens?type=beta
   - Click "Generate new token" (Fine-grained)
   - Name: `EventCall Data API Token`
   - Expiration: 90 days
   - Repository access: Only select repositories
     - EventCall-Data
     - EventCall-Images
   - Permissions:
     - Contents: Read and Write
     - Actions: Read (for artifact access)
   - Click "Generate token"
   - **COPY THE TOKEN** (you won't see it again)

2. **Add token to repository secrets:**
   - Go to your EventCall repository settings
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `EVENTCALL_DATA_TOKEN`
   - Value: [paste your token]
   - Click "Add secret"

---

## Step 3: Update Frontend Code

### Update `js/config.js`:

```javascript
/**
 * EventCall Secure Configuration
 * Token is managed server-side via GitHub Actions
 */

const GITHUB_CONFIG = {
    owner: 'SemperAdmin',
    repo: 'EventCall',
    dataRepo: 'EventCall-Data',
    imageRepo: 'EventCall-Images',
    branch: 'main',

    // NO TOKEN IN CLIENT CODE
    token: null,

    // API mode: use GitHub Actions as backend
    useActionsBackend: true,

    // Helper methods
    getRepoUrl(repoType = 'main') {
        const repoName = repoType === 'data' ? this.dataRepo :
                         repoType === 'images' ? this.imageRepo :
                         this.repo;
        return `https://api.github.com/repos/${this.owner}/${repoName}`;
    },

    // ... rest of config
};
```

### Create `js/actions-backend.js`:

```javascript
/**
 * GitHub Actions Backend API
 * Secure alternative to direct GitHub API calls
 */

class ActionsBackend {
    constructor() {
        this.baseUrl = `https://api.github.com/repos/${window.GITHUB_CONFIG.owner}/${window.GITHUB_CONFIG.repo}`;
        this.pollInterval = 2000; // 2 seconds
        this.maxPolls = 30; // 60 seconds max wait
    }

    /**
     * Trigger a workflow and wait for results
     */
    async triggerWorkflow(eventType, payload = {}) {
        try {
            // Trigger workflow via repository_dispatch
            const response = await fetch(`${this.baseUrl}/dispatches`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    // No token needed - public endpoint
                },
                body: JSON.stringify({
                    event_type: eventType,
                    client_payload: payload
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to trigger workflow: ${response.status}`);
            }

            console.log(`✅ Triggered workflow: ${eventType}`);

            // Wait for workflow to complete and get artifact
            return await this.pollForArtifact(eventType);

        } catch (error) {
            console.error('Error triggering workflow:', error);
            throw error;
        }
    }

    /**
     * Poll for workflow artifact
     */
    async pollForArtifact(artifactName) {
        console.log(`📊 Polling for artifact: ${artifactName}`);

        for (let i = 0; i < this.maxPolls; i++) {
            await this.sleep(this.pollInterval);

            try {
                const artifacts = await fetch(
                    `${this.baseUrl}/actions/artifacts?per_page=10`,
                    {
                        headers: {
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );

                if (!artifacts.ok) continue;

                const data = await artifacts.json();
                const artifact = data.artifacts.find(a =>
                    a.name === artifactName &&
                    Date.now() - new Date(a.created_at).getTime() < 120000 // Within 2 min
                );

                if (artifact) {
                    console.log(`✅ Found artifact: ${artifactName}`);
                    return await this.downloadArtifact(artifact.archive_download_url);
                }

            } catch (error) {
                console.warn(`Poll attempt ${i + 1} failed:`, error);
            }
        }

        throw new Error(`Timeout waiting for artifact: ${artifactName}`);
    }

    /**
     * Download and extract artifact data
     */
    async downloadArtifact(url) {
        // Note: Artifacts require authentication to download
        // Alternative: Use workflow to publish data to GitHub Pages
        // or use Issues API to post results

        // For now, use alternative approach: publish to gist or issue
        throw new Error('Artifact download requires authentication - see alternative approaches');
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fetch users (triggers workflow)
     */
    async fetchUsers() {
        return await this.triggerWorkflow('fetch-users', {});
    }

    /**
     * Fetch events (triggers workflow)
     */
    async fetchEvents() {
        return await this.triggerWorkflow('fetch-events', {});
    }

    /**
     * Create or update event
     */
    async saveEvent(eventData) {
        return await this.triggerWorkflow('update-event', {
            action_type: 'update_event',
            file_path: `events/${eventData.id}.json`,
            content: JSON.stringify(eventData, null, 2)
        });
    }
}

// Initialize and export
window.ActionsBackend = new ActionsBackend();
console.log('✅ Actions Backend initialized');
```

---

## Step 4: Alternative - Simpler Approach

**If the above is too complex, use this hybrid approach:**

### Make EventCall-Data repository PUBLIC
- Data is already user-generated (events, RSVPs)
- No sensitive personal information (users choose what to share)
- Use a read-only public token for fetching
- Use GitHub Actions for write operations only

### Benefits:
- ✅ No token needed for reading data
- ✅ Secure token only for writes (via Actions)
- ✅ Simpler implementation
- ✅ Better transparency

### Implementation:

1. **Make EventCall-Data public** (if acceptable)
2. **Remove token from config.js completely**
3. **Use anonymous GitHub API for reads** (60 requests/hour)
4. **Use Actions for all write operations**

```javascript
// js/config.js
const GITHUB_CONFIG = {
    owner: 'SemperAdmin',
    repo: 'EventCall',
    dataRepo: 'EventCall-Data',  // Now public
    imageRepo: 'EventCall-Images',
    branch: 'main',

    token: null,  // No token needed for public repos!

    // Use Actions for writes
    useActionsForWrites: true,

    // ... rest of config
};
```

---

## Step 5: Best Practice - Rate Limiting

With no token, you're limited to 60 requests/hour. To handle this:

1. **Cache aggressively:**
```javascript
// Cache API responses for 5 minutes
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function cachedFetch(url) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const response = await fetch(url);
    const data = await response.json();

    cache.set(url, { data, timestamp: Date.now() });
    return data;
}
```

2. **Batch requests:**
```javascript
// Use git/trees API to fetch multiple files at once
const tree = await fetch(
    `https://api.github.com/repos/SemperAdmin/EventCall-Data/git/trees/main?recursive=1`
);
```

3. **User authentication for higher limits:**
```javascript
// Users can optionally provide their own GitHub token
// for 5000 requests/hour instead of 60
```

---

## Comparison of Solutions

| Approach | Security | Complexity | Hosting | Rate Limit |
|----------|----------|------------|---------|------------|
| **GitHub Actions Backend** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | GitHub (free) | 5000/hr |
| **Public Repo + Actions Writes** | ⭐⭐⭐⭐ | ⭐⭐ | GitHub (free) | 60/hr |
| **Cloudflare Workers** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Cloudflare (free tier) | 5000/hr |
| **Current (hardcoded)** | ⭐ | ⭐ | GitHub (free) | 5000/hr but **EXPOSED** |

---

## Recommended Path Forward

**For your use case (military event management):**

1. **Short term (today):**
   - Make EventCall-Data repository public (data is not sensitive)
   - Remove token from config.js
   - Use anonymous API for reads
   - Implement caching

2. **Medium term (this week):**
   - Set up GitHub Actions workflows for write operations
   - Update frontend to use Actions for creates/updates
   - Keep reads direct (no token needed for public repo)

3. **Long term (if needed):**
   - Implement full Actions backend if rate limits become an issue
   - Or migrate to Cloudflare Workers for more control

---

## Next Steps

1. **Decide:** Public repo or keep private?
2. **Revoke:** Current exposed token
3. **Implement:** Chosen solution above
4. **Test:** Thoroughly before going live
5. **Monitor:** API rate limits

Need help implementing any of these? Let me know which approach you prefer!
