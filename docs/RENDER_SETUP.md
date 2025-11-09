# Render Deployment Setup (Proxy + CSRF)

This project includes a small proxy server (in `server/`) that securely forwards GitHub workflow dispatches and implements CSRF protection.

## Service Configuration

- Root Directory: `server`
- Build Command: `npm ci`
- Start Command: `node index.js`
- Runtime: Node 18+ (20 recommended)

## Required Environment Variables

- `GITHUB_TOKEN`: PAT with permissions to trigger repository dispatches.
- `REPO_OWNER`: e.g., `SemperAdmin`.
- `REPO_NAME`: e.g., `EventCall`.
- `ALLOWED_ORIGIN`: your site origin (include protocol), e.g., `https://semperadmin.github.io`.
- `CSRF_SHARED_SECRET`: random secret used to sign CSRF tokens (never expose to client).

## Generate CSRF_SHARED_SECRET

Any high-entropy string works. Recommended 32 bytes base64:

Linux/macOS or Git Bash:

```
openssl rand -base64 32
```

Windows PowerShell (no OpenSSL required):

```
[Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))
```

Node.js (cross-platform):

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Notes:
- A 32-byte base64 value is typically 44 characters ending with `=` padding.
- You may also use hex: `openssl rand -hex 32`.
- Paste the generated value into Render as `CSRF_SHARED_SECRET`.

## Frontend Configuration

On your site (e.g., in `index.html`), add:

```
<script>
  window.BACKEND_CONFIG = {
    dispatchURL: 'https://<your-render-service-url>',
    useProxyOnGithubPages: true
  };
</script>
```

When hosted on `*.github.io`, the app will:
- Fetch `GET /api/csrf` from the proxy to get `{ clientId, token, expires }`.
- Include those headers on `POST /api/dispatch`.
- The proxy validates CSRF and forwards to GitHub using `GITHUB_TOKEN`.

## Verify Deployment

After deploying the service on Render:

```
curl -s https://<your-render-service-url>/health
curl -s https://<your-render-service-url>/api/csrf
```

If `ALLOWED_ORIGIN` doesn't match the caller, `/api/csrf` will return 403. Call it from your website origin.

## Rotation

Tokens issued by the proxy expire after 15 minutes. You can rotate `CSRF_SHARED_SECRET` by updating the env var; existing tokens will naturally expire shortly.

