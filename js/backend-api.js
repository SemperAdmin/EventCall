class BackendAPI {
    constructor() {
        this.owner = 'SemperAdmin';
        this.repo = 'EventCall';
        this.apiBase = 'https://api.github.com';
    }

async triggerWorkflow(eventType, payload) {
    const url = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/dispatches';
    
    // Get token from GITHUB_CONFIG
    const token = window.GITHUB_CONFIG && window.GITHUB_CONFIG.token ? window.GITHUB_CONFIG.token : null;
    
    if (!token) {
        throw new Error('GitHub token not available for workflow trigger');
    }
    
    try {
        console.log('Triggering: ' + eventType);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'token ' + token,  // ← ADD TOKEN HERE
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: eventType,
                client_payload: payload
            })
        });

        if (!response.ok) {
            throw new Error('Failed: ' + response.status);
        }

        console.log('Workflow triggered');
        return { success: true };
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

    async submitRSVP(rsvpData) {
        console.log('Submitting RSVP...');

        const sanitized = {
            eventId: String(rsvpData.eventId || '').trim(),
            name: String(rsvpData.name || '').trim(),
            email: String(rsvpData.email || '').trim().toLowerCase(),
            phone: String(rsvpData.phone || '').trim(),
            rank: String(rsvpData.rank || '').trim(),
            unit: String(rsvpData.unit || '').trim(),
            attending: String(rsvpData.attending || '').trim(),
            guests: parseInt(rsvpData.guests) || 0,
            dietaryRestrictions: String(rsvpData.dietaryRestrictions || '').trim(),
            specialRequests: String(rsvpData.specialRequests || '').trim()
        };

        if (!sanitized.eventId || !sanitized.name || !sanitized.email) {
            throw new Error('Missing required fields');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized.email)) {
            throw new Error('Invalid email');
        }

        return await this.triggerWorkflow('submit_rsvp', sanitized);
    }

    async createEvent(eventData) {
        console.log('Creating event via workflow...');

        // Get manager token and info
        const token = window.GITHUB_CONFIG && window.GITHUB_CONFIG.token ? window.GITHUB_CONFIG.token : null;
        const managerEmail = window.managerAuth && window.managerAuth.getCurrentManager()
            ? window.managerAuth.getCurrentManager().email
            : 'unknown';

        if (!token) {
            throw new Error('Manager token required to create event');
        }

        // Prepare event payload for workflow
        const payload = {
            id: eventData.id,
            title: String(eventData.title || '').trim(),
            description: String(eventData.description || '').trim(),
            date: String(eventData.date || '').trim(),
            time: String(eventData.time || '').trim(),
            location: String(eventData.location || '').trim(),
            coverImage: String(eventData.coverImage || '').trim(),
            askReason: Boolean(eventData.askReason),
            allowGuests: Boolean(eventData.allowGuests),
            requiresMealChoice: Boolean(eventData.requiresMealChoice),
            customQuestions: eventData.customQuestions || [],
            eventDetails: eventData.eventDetails || {},
            managerToken: token,
            managerEmail: managerEmail,
            createdBy: managerEmail,
            createdByName: eventData.createdByName || managerEmail.split('@')[0],
            created: eventData.created || Date.now(),
            status: 'active'
        };

        if (!payload.title || !payload.date || !payload.time) {
            throw new Error('Missing required event fields');
        }

        return await this.triggerWorkflow('create_event', payload);
    }
}

if (typeof window !== 'undefined') {
    window.BackendAPI = new BackendAPI();
    console.log('Backend API loaded (Secure)');
}

