# Proposed SQL Schema for EventCall

This document outlines the proposed SQL schema for migrating EventCall's data from JSON files to a relational database. This schema incorporates feedback for improved performance, scalability, and long-term maintainability.

## Tables

### 1. Users

Stores user information.

-   `id` (Primary Key, BIGINT AUTO_INCREMENT): Unique, non-meaningful identifier for the user.
-   `username` (VARCHAR(255), Not Null, Unique): The user's username.
-   `name` (VARCHAR(255), Not Null): The user's full name.
-   `email` (VARCHAR(255), Not Null, Unique): The user's email address.
-   `branch` (VARCHAR(255)): The user's military branch.
-   `rank` (VARCHAR(255)): The user's rank.
-   `role` (VARCHAR(255), Not Null, Default: 'user'): The user's role (e.g., 'user', 'admin').
-   `password_hash` (VARCHAR(255), Not Null): The hashed password for the user.
-   `created_at` (TIMESTAMP WITH TIME ZONE, Not Null, Default: CURRENT_TIMESTAMP): The timestamp when the user was created.

### 2. Events

Stores event details.

-   `id` (Primary Key, UUID, Default: gen_random_uuid()): Unique identifier for the event.
-   `title` (VARCHAR(255), Not Null): The title of the event.
-   `event_at` (TIMESTAMP WITH TIME ZONE, Not Null): The combined date and time of the event.
-   `location` (VARCHAR(255), Not Null): The location of the event.
-   `description` (TEXT): A description of the event.
-   `cover_image_url` (VARCHAR(255)): The URL for the event's cover image.
-   `ask_reason` (BOOLEAN, Not Null, Default: false): Whether to ask for a reason for not attending.
-   `allow_guests` (BOOLEAN, Not Null, Default: false): Whether guests are allowed.
-   `status` (VARCHAR(50), Not Null, Default: 'active'): The status of the event (e.g., 'active', 'cancelled').
-   `created_by` (BIGINT, Not Null, Foreign Key to Users.id): The ID of the user who created the event.
-   `created_at` (TIMESTAMP WITH TIME ZONE, Not Null, Default: CURRENT_TIMESTAMP): The timestamp when the event was created.

### 3. EventCustomQuestions

Stores the custom questions for each event.

-   `id` (Primary Key, SERIAL): Unique identifier for the custom question.
-   `event_id` (UUID, Not Null, Foreign Key to Events.id): The ID of the event these questions belong to.
-   `question_text` (VARCHAR(255), Not Null): The text of the custom question.
-   `question_type` (VARCHAR(50), Not Null, Default: 'text'): The type of the question (e.g., 'text', 'multiple-choice').
-   `options` (JSONB): The options for multiple-choice questions.

### 4. RSVPs

Stores RSVP data for each event.

-   `id` (Primary Key, UUID, Default: gen_random_uuid()): Unique identifier for the RSVP.
-   `event_id` (UUID, Not Null, Foreign Key to Events.id): The ID of the event being RSVP'd to.
-   `user_id` (BIGINT, Foreign Key to Users.id, Nullable): The ID of the user who RSVP'd, if they are a registered user.
-   `name` (VARCHAR(255), Not Null): The name of the person RSVP'ing.
-   `email` (VARCHAR(255), Not Null): The email of the person RSVP'ing.
-   `phone` (VARCHAR(50)): The phone number of the person RSVP'ing.
-   `attending` (BOOLEAN, Not Null): Whether the person is attending.
-   `guest_count` (INTEGER, Default: 0): The number of guests.
-   `reason` (TEXT): The reason for not attending.
-   `created_at` (TIMESTAMP WITH TIME ZONE, Not Null, Default: CURRENT_TIMESTAMP): The timestamp when the RSVP was created.

### 5. RSVPCustomAnswers

Stores the answers to the custom questions for each RSVP.

-   `id` (Primary Key, SERIAL): Unique identifier for the custom answer.
-   `rsvp_id` (UUID, Not Null, Foreign Key to RSVPs.id): The ID of the RSVP this answer belongs to.
-   `question_id` (INTEGER, Not Null, Foreign Key to EventCustomQuestions.id): The ID of the question being answered.
-   `answer_text` (TEXT, Not Null): The answer to the custom question.

## Relationships

-   A **User** can create multiple **Events**. (`Events.created_by` -> `Users.id`)
-   An **Event** can have multiple **RSVPs**. (`RSVPs.event_id` -> `Events.id`)
-   An **Event** can have multiple **EventCustomQuestions**. (`EventCustomQuestions.event_id` -> `Events.id`)
-   An **RSVP** can have multiple **RSVPCustomAnswers**. (`RSVPCustomAnswers.rsvp_id` -> `RSVPs.id`)
-   An **RSVP** may be associated with a **User**. (`RSVPs.user_id` -> `Users.id`)

## Indexing Recommendations

To ensure optimal query performance, the following indexes should be created:

-   **Foreign Keys:** All foreign key columns should be indexed.
    -   `Events(created_by)`
    -   `EventCustomQuestions(event_id)`
    -   `RSVPs(event_id)`
    -   `RSVPs(user_id)`
    -   `RSVPCustomAnswers(rsvp_id)`
    -   `RSVPCustomAnswers(question_id)`
-   **Frequently Queried Columns:** Columns often used in `WHERE` clauses should also be indexed.
    -   `Users(username)`
    -   `Users(email)`
    -   `Events(event_at)`
    -   `RSVPs(email)`
