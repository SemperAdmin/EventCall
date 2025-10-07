class BackendAPI {
    constructor() {
        this.owner = 'SemperAdmin';
        this.repo = 'EventCall';
        this.apiBase = 'https://api.github.com';
    }

    async triggerWorkflow(eventType, payload) {
        const url = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/dispatches';
        
        try {
            console.log('Triggering: ' + eventType);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
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
}

if (typeof window !== 'undefined') {
    window.BackendAPI = new BackendAPI();
    console.log('Backend API loaded (Secure)');
}
