// migrate-to-supabase.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURATION ---
// These must be set as environment variables before running the script
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use the service role key for migration

// Paths to the data directories. Assumes the script is run from the repo root.
const USERS_DIR = './users'; // User must create this directory and populate it with user JSON files from the EventCall-Data repo.
const EVENTS_DIR = './events';
const RSVPS_DIR = './rsvps';

/**
 * Reads all .json files in a directory and returns their content as an array of objects.
 * @param {string} dirPath The path to the directory.
 * @returns {Promise<Array<any>>} A promise that resolves to an array of file contents.
 */
async function readJsonFilesFromDir(dirPath) {
    try {
        const dirents = await fs.readdir(dirPath, { withFileTypes: true });
        const files = await Promise.all(
            dirents
                .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
                .map(dirent => fs.readFile(path.join(dirPath, dirent.name), 'utf-8'))
        );
        return files.map(file => JSON.parse(file));
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`Warning: Directory not found: ${dirPath}. Skipping.`);
            return [];
        }
        throw error;
    }
}

/**
 * Main migration function.
 */
async function main() {
    console.log('--- EventCall Supabase Migration ---');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set.');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // --- 1. Migrate Users ---
    console.log('\nStep 1: Migrating Users...');
    const userFiles = await readJsonFilesFromDir(USERS_DIR);
    if (userFiles.length === 0) {
        console.log('No user files found. Skipping user migration.');
    } else {
        const usersToInsert = userFiles.map(user => ({
            username: user.username,
            name: user.name,
            email: user.email.toLowerCase(),
            branch: user.branch,
            rank: user.rank,
            role: user.role,
            password_hash: user.passwordHash,
            created_at: new Date(user.created).toISOString(),
        }));

        const { error: deleteUsersError } = await supabase.from('users').delete().neq('id', -1);
        if (deleteUsersError) throw new Error(`Failed to clear users table: ${deleteUsersError.message}`);

        const { data: insertedUsers, error: insertUsersError } = await supabase.from('users').insert(usersToInsert).select();
        if (insertUsersError) throw new Error(`Failed to insert users: ${insertUsersError.message}`);
        console.log(`Successfully inserted ${insertedUsers.length} users.`);
    }

    // Create a map of emails to new user IDs for linking events and RSVPs
    const { data: allUsers } = await supabase.from('users').select('id, email, username');
    const emailToDbId = new Map(allUsers.map(u => [u.email, u.id]));
    const usernameToDbId = new Map(allUsers.map(u => [u.username, u.id]));

    // --- 2. Migrate Events and Custom Questions ---
    console.log('\nStep 2: Migrating Events...');
    const eventFiles = await readJsonFilesFromDir(EVENTS_DIR);
    if (eventFiles.length === 0) {
        console.log('No event files found. Skipping event migration.');
    } else {
        const eventsToInsert = eventFiles.map(event => {
            // The `createdBy` field in the JSON seems to be an email.
            // Some older events might have a username. We'll try email first, then username.
            const createdByEmail = event.createdBy ? event.createdBy.toLowerCase() : null;
            const createdByName = event.createdByName;
            const userId = emailToDbId.get(createdByEmail) || usernameToDbId.get(createdByName);

            if (!userId) {
                console.warn(`Could not find user with email '${createdByEmail}' or username '${createdByName}' for event '${event.title}'. Skipping this event.`);
                return null;
            }

            return {
                id: event.id,
                title: event.title,
                event_at: new Date(`${event.date}T${event.time}:00Z`).toISOString(), // Assuming UTC
                location: event.location,
                description: event.description,
                cover_image_url: event.coverImage,
                ask_reason: event.askReason,
                allow_guests: event.allowGuests,
                status: event.status,
                created_by: userId,
                created_at: new Date(event.created).toISOString(),
            };
        }).filter(e => e !== null); // Filter out events that couldn't be mapped to a user

        const { error: deleteEventsError } = await supabase.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteEventsError) throw new Error(`Failed to clear events table: ${deleteEventsError.message}`);
        const { data: insertedEvents, error: insertEventsError } = await supabase.from('events').insert(eventsToInsert).select();
        if (insertEventsError) throw new Error(`Failed to insert events: ${insertEventsError.message}`);
        console.log(`Successfully inserted ${insertedEvents.length} events.`);

        // --- Migrate Custom Questions ---
        console.log('Migrating custom questions...');
        const customQuestionsToInsert = [];

        for (const event of eventFiles) {
            if (event.customQuestions && Array.isArray(event.customQuestions) && event.customQuestions.length > 0) {
                 event.customQuestions.forEach(q => {
                    // Assuming q is an object like { text: "...", type: "...", ... }
                    if (q && q.text) {
                        customQuestionsToInsert.push({
                            event_id: event.id,
                            question_text: q.text,
                            question_type: q.type || 'text',
                            options: q.options ? JSON.stringify(q.options) : null
                        });
                    }
                });
            }
        }

        if (customQuestionsToInsert.length > 0) {
            const { error: deleteQuestionsError } = await supabase.from('event_custom_questions').delete().neq('id', -1);
            if (deleteQuestionsError) throw new Error(`Failed to clear questions table: ${deleteQuestionsError.message}`);

            const { data: insertedQuestions, error: insertQuestionsError } = await supabase.from('event_custom_questions').insert(customQuestionsToInsert).select();
            if (insertQuestionsError) throw new Error(`Failed to insert custom questions: ${insertQuestionsError.message}`);
            console.log(`Successfully inserted ${insertedQuestions.length} custom questions.`);
        } else {
            console.log('No custom questions to migrate.');
        }
    }


    // --- 3. Migrate RSVPs and Custom Answers ---
    console.log('\nStep 3: Migrating RSVPs...');
    const rsvpFiles = await readJsonFilesFromDir(RSVPS_DIR);
    const rsvpLists = rsvpFiles.flat(); // each file can be an array of rsvps
    if (rsvpLists.length === 0) {
        console.log('No RSVPs found. Skipping RSVP migration.');
    } else {
        const rsvpsToInsert = rsvpLists.map(rsvp => ({
            id: rsvp.rsvpId,
            event_id: rsvp.eventId,
            user_id: emailToDbId.get(rsvp.email.toLowerCase()) || null,
            name: rsvp.name,
            email: rsvp.email,
            phone: rsvp.phone,
            attending: rsvp.attending,
            guest_count: rsvp.guestCount || 0,
            reason: rsvp.reason,
            created_at: new Date(rsvp.timestamp).toISOString(),
        }));

        const { error: deleteRsvpsError } = await supabase.from('rsvps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteRsvpsError) throw new Error(`Failed to clear rsvps table: ${deleteRsvpsError.message}`);

        const { data: insertedRsvps, error: insertRsvpsError } = await supabase.from('rsvps').insert(rsvpsToInsert).select();
        if (insertRsvpsError) throw new Error(`Failed to insert RSVPs: ${insertRsvpsError.message}`);
        console.log(`Successfully inserted ${insertedRsvps.length} RSVPs.`);

        // --- Migrate Custom Answers ---
        // This part is complex due to the `custom_0` format. We need to fetch the questions we just inserted.
        console.log('Migrating custom answers...');
        const { data: allQuestions } = await supabase.from('event_custom_questions').select('id, event_id, question_text');

        // Create a map for easy lookup: eventId -> [{id, question_text}]
        const questionsByEvent = new Map();
        allQuestions.forEach(q => {
            if (!questionsByEvent.has(q.event_id)) {
                questionsByEvent.set(q.event_id, []);
            }
            questionsByEvent.get(q.event_id).push(q);
        });

        const customAnswersToInsert = [];
        for (const rsvp of rsvpLists) {
            if (rsvp.customAnswers) {
                const eventQuestions = questionsByEvent.get(rsvp.eventId) || [];
                // This assumes the order of questions in the original event JSON is preserved and maps to the `custom_X` keys.
                // This is a fragile assumption, but it's the best we can do with the current data structure.
                for (const [key, answer] of Object.entries(rsvp.customAnswers)) {
                    const match = key.match(/^custom_(\d+)$/);
                    if (match) {
                        const questionIndex = parseInt(match[1], 10);
                        if (questionIndex < eventQuestions.length) {
                            const question = eventQuestions[questionIndex];
                            customAnswersToInsert.push({
                                rsvp_id: rsvp.rsvpId,
                                question_id: question.id,
                                answer_text: answer
                            });
                        }
                    }
                }
            }
        }

        if (customAnswersToInsert.length > 0) {
            const { error: deleteAnswersError } = await supabase.from('rsvp_custom_answers').delete().neq('id', -1);
            if (deleteAnswersError) throw new Error(`Failed to clear answers table: ${deleteAnswersError.message}`);

            const { data: insertedAnswers, error: insertAnswersError } = await supabase.from('rsvp_custom_answers').insert(customAnswersToInsert).select();
            if (insertAnswersError) throw new Error(`Failed to insert custom answers: ${insertAnswersError.message}`);
            console.log(`Successfully inserted ${insertedAnswers.length} custom answers.`);
        } else {
            console.log('No custom answers to migrate.');
        }
    }


    console.log('\n--- Migration Complete! ---');
    console.log('Please check your Supabase dashboard to verify the data.');
}

main().catch(error => {
    console.error('\n--- MIGRATION FAILED ---');
    console.error(error);
    process.exit(1);
});
