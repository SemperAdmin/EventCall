# Mobile Troubleshooting Guide

If EventCall works on desktop but not on mobile, follow these steps:

## Issue: Admin Dashboard Not Loading on Mobile

### Symptoms:
- Works perfectly on desktop browser
- Shows blank page, loading spinner, or errors on mobile
- Old features visible on mobile but new features missing

### Cause:
Mobile browsers and service workers aggressively cache JavaScript files. Your phone is loading old code.

## Fix 1: Clear Browser Cache

### iPhone Safari:
1. Go to **Settings** app
2. Scroll down to **Safari**
3. Tap **Clear History and Website Data**
4. Confirm
5. Reopen EventCall and force reload

### Android Chrome:
1. Open **Chrome** browser
2. Tap the **menu** (⋮) in top right
3. Go to **History** → **Clear browsing data**
4. Check **Cached images and files**
5. Tap **Clear data**
6. Reopen EventCall

### Android Firefox:
1. Open **Firefox** browser
2. Tap the **menu** (⋮)
3. Go to **Settings** → **Delete browsing data**
4. Check **Cache**
5. Tap **Delete browsing data**

## Fix 2: Force Reload

After clearing cache:

### iPhone Safari:
1. Open EventCall
2. Pull down on the page to refresh
3. Or long-press the reload button → **Reload Without Content Blockers**

### Android Chrome:
1. Open EventCall
2. Pull down to refresh
3. Or tap **menu** (⋮) → **Refresh**

## Fix 3: Clear Service Worker

EventCall uses a service worker that caches files for offline use. Sometimes this needs to be cleared.

### Option A: Use the Clear Page
1. Visit: `https://your-eventcall-url.com/clear-sw.html`
2. Tap **Clear Service Worker**
3. Wait for confirmation
4. Reload EventCall

### Option B: Manual Clear (Advanced)

Only if you can access mobile browser DevTools:

1. Open EventCall
2. Open browser DevTools (if available)
3. Go to **Application** → **Service Workers**
4. Click **Unregister**
5. Reload the page

## Fix 4: Incognito/Private Mode Test

To confirm it's a caching issue:

1. Open **Incognito/Private** browser window
2. Visit EventCall
3. Log in

**If it works in incognito:**
- Confirms caching issue
- Clear cache and service worker in normal browser

**If it still doesn't work:**
- Check browser console for errors
- May be a different issue (see below)

## Still Not Working?

### Check Browser Compatibility

EventCall requires a modern browser:
- ✅ Safari 14+ (iOS 14+)
- ✅ Chrome 90+
- ✅ Firefox 88+
- ❌ Old Android browsers (Samsung Internet < 14)

### Check Internet Connection

Admin dashboard loads data from GitHub:
- Requires stable internet connection
- May timeout on slow connections
- Try on WiFi instead of cellular

### Check Console Errors

If you can access mobile browser console:

1. **iOS Safari:**
   - On Mac: Safari → Develop → [Your iPhone] → EventCall
   - Requires Mac and cable connection

2. **Android Chrome:**
   - On desktop: Visit `chrome://inspect`
   - Requires USB debugging enabled
   - Connect phone via USB

3. **Look for errors:**
   ```
   Failed to fetch
   403 Forbidden
   Network request failed
   ```

### Report the Issue

If none of the above works:

1. Note your device and browser:
   - Device: (iPhone 13, Samsung S21, etc.)
   - Browser: (Safari 17, Chrome 120, etc.)
   - iOS/Android version:

2. Check browser console for errors

3. Take screenshots if possible

4. Contact support with details

## Prevention

To avoid this in the future:

1. **Hard refresh after updates:**
   - Pull down to refresh
   - Or clear cache periodically

2. **Use incognito for testing:**
   - Always works with latest code
   - No cached data

3. **Update your browser:**
   - Keep iOS/Android updated
   - Update browser app

4. **Check for service worker updates:**
   - EventCall should auto-update
   - But cache can sometimes stick

## Quick Summary

**Most common fix:**
1. Clear browser cache
2. Clear browsing data
3. Reopen EventCall
4. Log out and back in

**This solves 90% of mobile issues!**
