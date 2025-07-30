/**
 * EventCall RSVP Handler - Simple Working Solution
 * Creates GitHub Issues with a shared token approach
 */

class RSVPHandler {
    constructor() {
        this.currentEventId = null;
        this.submissionInProgress = false;
    }

    /**
     * Handle RSVP form submission
     */
    async handleRSVP(e, eventId) {
        e.preventDefault();

        if (this.submissionInProgress) {
            return;
        }

        this.submissionInProgress = true;
        this.currentEventId = eventId;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        try {
            submitBtn.innerHTML = '<div class="spinner"></div> Submitting...';
            submitBtn.disabled = true;

            // Collect and validate form data
            const rsvpData = this.collectFormData();
            const validation = this.validateRSVPData(rsvpData);

            if (!validation.valid) {
                validation.errors.forEach(error => {
                    showToast(error, 'error');
                });
                return;
            }

            // Add timestamp and ID
            rsvpData.timestamp = Date.now();
            rsvpData.id = generateUUID();
            rsvpData.eventId = eventId;

            // Try GitHub Issues with shared token
            let submissionResult = null;

            try {
                submissionResult = await this.submitToGitHubIssues(eventId, rsvpData);
                console.log('✅ Successfully submitted to GitHub Issues');
            } catch (error) {
                console.warn('GitHub submission failed, using local storage:', error.message);
                submissionResult = await this.storeLocally(eventId, rsvpData);
            }

            // Show confirmation
            this.showConfirmation(rsvpData, submissionResult);

        } catch (error) {
            console.error('RSVP submission failed:', error);
            showToast('Failed to submit RSVP: ' + error.message, 'error');

        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            this.submissionInProgress = false;
        }
    }

    /**
     * Submit to GitHub Issues using a basic shared token
     */
    async submitToGitHubIssues(eventId, rsvpData) {
        const event = getEventFromURL();
        if (!event) throw new Error('Event data not found');

        // Simple shared token for public RSVP submissions
        // This token has minimal permissions - only create issues in public repos
        const sharedToken = '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';

        const issueTitle = `RSVP: ${rsvpData.name} - ${event.title}`;
        const issueBody = this.createIssueBody(event, rsvpData);

        const issueData = {
            title: issueTitle,
            body: issueBody,
            labels: ['rsvp', `event-${eventId}`, rsvpData.attending ? 'attending' : 'not-attending']
        };

        const response = await fetch('https://api.github.com/repos/SemperAdmin/EventCall/issues', {
            method: 'POST',
            headers: {
                'Authorization': `token ${sharedToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'EventCall-RSVP-System'
            },
            body: JSON.stringify(issueData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`GitHub API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }

        const issueResponse = await response.json();
        return {
            method: 'github_issues',
            success: true,
            issueNumber: issueResponse.number,
            issueUrl: issueResponse.html_url
        };
    }

    /**
     * Store locally as fallback
     */
    async storeLocally(eventId, rsvpData) {
        const storageKey = `eventcall_pending_rsvps_${eventId}`;
        let pendingRSVPs = [];
        
        try {
            const existing = localStorage.getItem(storageKey);
            if (existing) {
                pendingRSVPs = JSON.parse(existing);
            }
        } catch (e) {
            pendingRSVPs = [];
        }

        // Check for duplicate email and update or add
        const existingIndex = pendingRSVPs.findIndex(r => 
            r.email && r.email.toLowerCase() === rsvpData.email.toLowerCase()
        );
        
        if (existingIndex !== -1) {
            pendingRSVPs[existingIndex] = rsvpData;
        } else {
            pendingRSVPs.push(rsvpData);
        }

        localStorage.setItem(storageKey, JSON.stringify(pendingRSVPs));

        return {
            method: 'local_storage',
            success: true,
            pendingCount: pendingRSVPs.length
        };
    }

    /**
     * Create issue body with structured data
     */
    createIssueBody(event, rsvpData) {
        const attendingStatus = rsvpData.attending ? '✅ ATTENDING' : '❌ NOT ATTENDING';
        
        let body = `## 🎖️ EventCall RSVP Submission\n\n`;
        body += `**Event:** ${event.title}\n`;
        body += `**Date:** ${formatDate(event.date)} at ${formatTime(event.time)}\n`;
        body += `**Event ID:** ${rsvpData.eventId}\n\n`;
        
        body += `### 👤 Attendee Information\n`;
        body += `- **Name:** ${rsvpData.name}\n`;
        body += `- **Email:** ${rsvpData.email}\n`;
        body += `- **Phone:** ${rsvpData.phone || 'Not provided'}\n`;
        body += `- **Status:** ${attendingStatus}\n`;
        
        if (rsvpData.guestCount > 0) {
            body += `- **Additional Guests:** ${rsvpData.guestCount}\n`;
        }
        
        if (rsvpData.reason) {
            body += `- **Reason:** ${rsvpData.reason}\n`;
        }

        if (event.customQuestions && Object.keys(rsvpData.customAnswers).length > 0) {
            body += `\n### 📝 Custom Questions\n`;
            event.customQuestions.forEach(q => {
                if (rsvpData.customAnswers[q.id]) {
                    body += `**${q.question}**\n`;
                    body += `${rsvpData.customAnswers[q.id]}\n\n`;
                }
            });
        }
        
        body += `\n### 📊 Submission Details\n`;
        body += `- **RSVP ID:** ${rsvpData.id}\n`;
        body += `- **Submitted:** ${new Date(rsvpData.timestamp).toISOString()}\n`;
        
        // Add structured JSON data for automatic processing
        body += `\n### 🔧 Processing Data\n`;
        body += `\`\`\`json\n`;
        body += JSON.stringify({
            eventId: rsvpData.eventId,
            rsvpId: rsvpData.id,
            name: rsvpData.name,
            email: rsvpData.email,
            phone: rsvpData.phone,
            attending: rsvpData.attending,
            guestCount: rsvpData.guestCount || 0,
            reason: rsvpData.reason,
            customAnswers: rsvpData.customAnswers,
            timestamp: rsvpData.timestamp,
            processed: false
        }, null, 2);
        body += `\n\`\`\`\n`;
        
        body += `\n---\n*Submitted via EventCall - Professional Military Event Management*`;
        
        return body;
    }

    /**
     * Collect form data
     */
    collectFormData() {
        const attendingRadio = document.querySelector('input[name="attending"]:checked');
        const attendingValue = attendingRadio ? attendingRadio.value === 'true' : null;

        const event = getEventFromURL();
        const customAnswers = {};

        if (event && event.customQuestions) {
            event.customQuestions.forEach(q => {
                const answerElement = document.getElementById(q.id);
                if (answerElement) {
                    customAnswers[q.id] = sanitizeText(answerElement.value);
                }
            });
        }

        return {
            name: sanitizeText(document.getElementById('rsvp-name')?.value || ''),
            email: sanitizeText(document.getElementById('rsvp-email')?.value || ''),
            phone: sanitizeText(document.getElementById('rsvp-phone')?.value || ''),
            attending: attendingValue,
            reason: sanitizeText(document.getElementById('reason')?.value || ''),
            guestCount: parseInt(document.getElementById('guest-count')?.value || '0'),
            customAnswers: customAnswers,
            userAgent: navigator.userAgent
        };
    }

    /**
     * Validate RSVP data
     */
    validateRSVPData(rsvpData) {
        const result = {
            valid: true,
            errors: []
        };

        if (!rsvpData.name || rsvpData.name.length < 2) {
            result.valid = false;
            result.errors.push('Please enter your full name (at least 2 characters)');
        }

        if (!rsvpData.email || !isValidEmail(rsvpData.email)) {
            result.valid = false;
            result.errors.push('Please enter a valid email address');
        }

        if (rsvpData.attending === null || rsvpData.attending === undefined) {
            result.valid = false;
            result.errors.push('Please select if you\'re attending');
        }

        if (rsvpData.phone && !isValidPhone(rsvpData.phone)) {
            result.valid = false;
            result.errors.push('Please enter a valid phone number');
        }

        if (rsvpData.guestCount < 0 || rsvpData.guestCount > 10) {
            result.valid = false;
            result.errors.push('Guest count must be between 0 and 10');
        }

        if (rsvpData.name && !isValidName(rsvpData.name)) {
            result.valid = false;
            result.errors.push('Please enter a valid name (letters, spaces, hyphens, and periods only)');
        }

        return result;
    }

    /**
     * Show confirmation page
     */
    showConfirmation(rsvpData, submissionResult) {
        const event = getEventFromURL();
        let statusMessage = '';
        let statusColor = 'd1fae5';
        let borderColor = '10b981';

        if (submissionResult.method === 'github_issues') {
            statusMessage = `✅ RSVP Created: Your submission was saved as GitHub Issue #${submissionResult.issueNumber}. The event organizer will see it on their dashboard when they sync.`;
        } else {
            statusMessage = `💾 RSVP Saved: Your submission has been saved locally. Please share the details below with the event organizer.`;
            statusColor = 'fef3c7';
            borderColor = 'f59e0b';
        }
        
        document.getElementById('invite-content').innerHTML = `
            <div class="rsvp-confirmation">
                <div class="confirmation-title">🎉 RSVP Submitted Successfully!</div>
                <div class="confirmation-message">
                    Thank you, <strong>${rsvpData.name}</strong>! Your RSVP has been recorded.
                </div>
                
                <div class="confirmation-details">
                    <div class="confirmation-status">
                        <strong>Your Status:</strong> ${rsvpData.attending ? '✅ Attending' : '❌ Not Attending'}
                    </div>
                    
                    ${rsvpData.guestCount > 0 ? `
                        <div><strong>Additional Guests:</strong> ${rsvpData.guestCount}</div>
                    ` : ''}
                    
                    ${rsvpData.reason ? `
                        <div><strong>Reason:</strong> ${rsvpData.reason}</div>
                    ` : ''}
                    
                    <div style="margin-top: 1rem; padding: 1rem; background: #${statusColor}; border-radius: 0.5rem; border-left: 4px solid #${borderColor};">
                        <strong>📊 Submission Status:</strong><br>
                        ${statusMessage}
                        ${submissionResult.issueUrl ? `<br><br><a href="${submissionResult.issueUrl}" target="_blank" style="color: #3b82f6; text-decoration: none;">→ View GitHub Issue</a>` : ''}
                    </div>
                    
                    ${submissionResult.method === 'local_storage' ? `
                        <div style="margin-top: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 0.5rem; border-left: 4px solid #3b82f6;">
                            <strong>📋 For Event Organizer:</strong><br>
                            Copy this data to manually add to your EventCall dashboard:<br><br>
                            <textarea readonly onclick="this.select()" style="width: 100%; height: 120px; font-family: monospace; font-size: 0.875rem; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem;">${JSON.stringify({
                                eventId: rsvpData.eventId,
                                id: rsvpData.id,
                                name: rsvpData.name,
                                email: rsvpData.email,
                                phone: rsvpData.phone,
                                attending: rsvpData.attending,
                                guestCount: rsvpData.guestCount || 0,
                                reason: rsvpData.reason,
                                customAnswers: rsvpData.customAnswers,
                                timestamp: rsvpData.timestamp,
                                submissionMethod: 'local_storage'
                            }, null, 2)}</textarea>
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 0.5rem; border-left: 4px solid #3b82f6;">
                        <strong>📋 What Happens Next:</strong><br>
                        • Event organizer will process your RSVP<br>
                        • You may receive confirmation from the organizer<br>
                        • Keep this page as your receipt<br>
                        • Need to make changes? Contact the organizer directly
                    </div>
                </div>

                ${this.generateEventSummary(event, rsvpData)}
                
                <div style="margin-top: 2rem;">
                    <button class="btn" onclick="window.print()">🖨️ Print Receipt</button>
                    <button class="btn" onclick="window.location.reload()" style="margin-left: 0.5rem;">📝 Submit Another RSVP</button>
                </div>
            </div>
        `;
    }

    /**
     * Generate event summary
     */
    generateEventSummary(event, rsvpData) {
        if (!event) return '';

        return `
            <div style="margin: 1.5rem 0; padding: 1rem; background: var(--gray-50); border-radius: 0.5rem;">
                <strong>📅 Event Summary:</strong><br>
                <div style="margin-top: 0.5rem;">
                    <strong>${event.title}</strong><br>
                    📅 ${formatDate(event.date)} at ${formatTime(event.time)}<br>
                    ${event.location ? `📍 ${event.location}<br>` : ''}
                    ${event.description ? `📝 ${event.description}` : ''}
                </div>
                <div style="margin-top: 1rem; font-size: 0.875rem; color: #6b7280;">
                    <strong>RSVP ID:</strong> ${rsvpData.id}<br>
                    <strong>Submitted:</strong> ${new Date(rsvpData.timestamp).toLocaleString()}
                </div>
            </div>
        `;
    }

    setupRealTimeValidation() {
        const emailInput = document.getElementById('rsvp-email');
        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                const email = emailInput.value;
                if (email && !isValidEmail(email)) {
                    emailInput.style.borderColor = 'var(--error-color)';
                    emailInput.title = 'Please enter a valid email address';
                } else {
                    emailInput.style.borderColor = '';
                    emailInput.title = '';
                }
            });
        }

        const phoneInput = document.getElementById('rsvp-phone');
        if (phoneInput) {
            phoneInput.addEventListener('blur', () => {
                const phone = phoneInput.value;
                if (phone && !isValidPhone(phone)) {
                    phoneInput.style.borderColor = 'var(--error-color)';
                    phoneInput.title = 'Please enter a valid phone number';
                } else {
                    phoneInput.style.borderColor = '';
                    phoneInput.title = '';
                }
            });
        }

        const nameInput = document.getElementById('rsvp-name');
        if (nameInput) {
            nameInput.addEventListener('blur', () => {
                const name = nameInput.value;
                if (name && !isValidName(name)) {
                    nameInput.style.borderColor = 'var(--error-color)';
                    nameInput.title = 'Please enter a valid name (letters, spaces, hyphens, and periods only)';
                } else {
                    nameInput.style.borderColor = '';
                    nameInput.title = '';
                }
            });
        }
    }

    prefillFormFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        const name = urlParams.get('name');
        const email = urlParams.get('email');
        const phone = urlParams.get('phone');
        
        if (name) {
            const nameInput = document.getElementById('rsvp-name');
            if (nameInput) nameInput.value = decodeURIComponent(name);
        }
        
        if (email) {
            const emailInput = document.getElementById('rsvp-email');
            if (emailInput) emailInput.value = decodeURIComponent(email);
        }
        
        if (phone) {
            const phoneInput = document.getElementById('rsvp-phone');
            if (phoneInput) phoneInput.value = decodeURIComponent(phone);
        }
    }
}

// Validation functions
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^[\+]?[1-9][\d]{0,15}$/.test(phone.replace(/\s+/g, ''));
}

function isValidName(name) {
    return /^[a-zA-Z\s\-\.]{2,50}$/.test(name);
}

function sanitizeText(text) {
    if (!text) return '';
    return text.trim().replace(/[<>]/g, '');
}

// Create global instance
const rsvpHandler = new RSVPHandler();

// Make functions available globally
window.rsvpHandler = rsvpHandler;
window.handleRSVP = (e, eventId) => rsvpHandler.handleRSVP(e, eventId);