# EventCall-Data Repository Setup

The admin dashboard requires a properly structured `EventCall-Data` repository to display user analytics. If you're seeing "0 users", follow this guide.

## Repository Structure

Your `EventCall-Data` repository should have this structure:

```
EventCall-Data/
├── events/
│   └── *.json          # Event files
├── responses/
│   └── *.json          # RSVP response files
└── users/              # ← THIS FOLDER IS REQUIRED
    ├── semperadmin.json
    └── *.json          # Other user files
```

## Required: Create users/ Directory

1. **Go to your EventCall-Data repository** on GitHub
2. **Click "Add file" → "Create new file"**
3. **Type:** `users/.gitkeep`
4. **Commit the file**

This creates the `users/` directory.

## Add User Files

Each user needs a JSON file in `users/` directory. Create `users/semperadmin.json`:

```json
{
  "id": "user_semperadmin",
  "username": "semperadmin",
  "name": "Semper Admin",
  "email": "admin@example.com",
  "role": "admin",
  "branch": "",
  "rank": "",
  "created": "2025-01-16T00:00:00.000Z",
  "lastLogin": "2025-01-16T00:00:00.000Z"
}
```

### Critical Fields

- **`username`** - Must match login username (lowercase)
- **`role`** - Set to `"admin"` for admin users, `"user"` for regular users
- **`id`** - Format: `user_<username>`

## Verify Setup

1. **Refresh EventCall** in your browser
2. **Log out and log back in**
3. **Open browser console** (F12)
4. **Look for these messages:**
   ```
   📂 Fetching users from: https://api.github.com/repos/SemperAdmin/EventCall-Data/contents/users
   📋 Found 1 files in users/ directory
   📋 Found 1 user JSON files
   📥 Loading user from: semperadmin.json
   ✅ Loaded user: semperadmin
   ✅ Successfully loaded 1 users
   ```

## Troubleshooting

### "404" Error in Console
**Problem:** `users/` directory doesn't exist

**Solution:** Create `users/.gitkeep` file as described above

### "0 user JSON files"
**Problem:** No `.json` files in `users/` directory

**Solution:** Add user JSON files like `users/semperadmin.json`

### Users showing but role not working
**Problem:** User file missing `"role": "admin"`

**Solution:** Edit user JSON file and add the role field

### Still showing 0 users
**Problem:** API authentication issue or repository permissions

**Solution:**
1. Check browser console for error messages
2. Verify GitHub token has access to EventCall-Data repo
3. Ensure EventCall-Data is in the same GitHub account as EventCall

## Quick Console Check

Run this in browser console:
```javascript
// Check what the admin dashboard is seeing
AdminDashboard.fetchAllUsers().then(users => {
    console.log('Users loaded:', users.length);
    console.log('Users:', users);
});
```

## Automatic User Creation

When users register through the app, their user files are automatically created in `EventCall-Data/users/`. However:
- The `users/` directory must exist first
- New users default to `"role": "user"`
- You must manually change role to `"admin"` for admin users
