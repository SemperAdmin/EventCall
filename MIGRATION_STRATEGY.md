# Supabase Migration Strategy for EventCall

This guide provides a complete walkthrough for migrating your EventCall data from the existing JSON files to your new Supabase PostgreSQL database.

**There are three main phases to this migration:**
1.  **Prepare Your Local Data:** You will need to gather all user data from the `EventCall-Data` repository.
2.  **Set Up Supabase:** You will run the `setup.sql` script to create the database tables.
3.  **Run the Migration Script:** You will execute the `migrate-to-supabase.js` script to move the data.

---

### Phase 1: Prepare Your Local Data

The migration script reads data from the `users`, `events`, and `rsvps` directories in the root of this repository. While `events` and `rsvps` are already here, the `users` data is stored in a separate repository.

1.  **Create a `users` Directory:** In the root of this `EventCall` repository, create a new folder named `users`.

2.  **Download User Data:** Go to your `EventCall-Data` repository. Download all the individual user `.json` files from the `/users` directory and place them inside the new `users` folder you just created.

After this step, your local `EventCall` directory should look like this:
```
/
|-- events/
|-- rsvps/
|-- users/      <-- The new folder with user JSON files
|-- server/
|-- migrate-to-supabase.js
|-- setup.sql
|-- ... (other files)
```

---

### Phase 2: Set Up Supabase

1.  **Navigate to the SQL Editor:**
    *   Open your Supabase project dashboard.
    *   In the left-hand menu, click on the **SQL Editor** icon.
    *   Click **"New query"**.

2.  **Run the Setup Script:**
    *   Open the `setup.sql` file from this repository.
    *   Copy the entire contents of the file.
    *   Paste the contents into the Supabase SQL editor.
    *   Click the **"RUN"** button.

This will create all the necessary tables (`users`, `events`, `rsvps`, etc.) and set up their relationships and indexes.

---

### Phase 3: Run the Migration Script

The final step is to run the Node.js script that will read your local JSON files and upload the data to Supabase.

1.  **Find Your Supabase Credentials:**
    *   In your Supabase dashboard, go to **Project Settings** (the gear icon).
    *   Click on **API**.
    *   You will need two values from this page:
        *   **Project URL:** Find this under the "Project URL" section.
        *   **Service Role Key:** Find this under the "Project API Keys" section. It will be the long string labeled `service_role`. **Warning: Keep this key secret, as it bypasses all security policies.**

2.  **Set Environment Variables:**
    *   You must set the credentials you just copied as environment variables in your terminal. This is to avoid hardcoding them in the script.

    *   **On macOS/Linux:**
        ```bash
        export SUPABASE_URL="YOUR_PROJECT_URL_HERE"
        export SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY_HERE"
        ```

    *   **On Windows (Command Prompt):**
        ```bash
        set SUPABASE_URL="YOUR_PROJECT_URL_HERE"
        set SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY_HERE"
        ```
    *   **On Windows (PowerShell):**
        ```powershell
        $env:SUPABASE_URL="YOUR_PROJECT_URL_HERE"
        $env:SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY_HERE"
        ```

3.  **Install Dependencies:**
    *   Make sure you have Node.js installed.
    *   You will also need the `supabase-js` library, which we will add to your project in the next step. If you haven't already, run:
        ```bash
        npm install
        ```

4.  **Execute the Script:**
    *   From the root directory of the `EventCall` repository, run the migration script:
        ```bash
        node migrate-to-supabase.js
        ```

The script will print its progress to the console. It will first clear any existing data in the tables and then upload the users, events, and RSVPs. If the script encounters any errors, it will stop and print the error message.

---

After the script finishes, go to the **Table Editor** in your Supabase dashboard to verify that all your data has been successfully migrated.
