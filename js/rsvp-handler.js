/**
 * EventCall RSVP Handler
 * Handles RSVP form submission, validation, and processing
 */

class RSVPHandler {
    constructor() {
        this.currentEventId = null;
        this.submissionInProgress = false;
    }

    /**
     * Handle RSVP form submission
     * @param {Event} e - Form submission event
     * @param {string} eventId - Event ID
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
            // Show loading state
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

            // Try to save to GitHub
            await this.saveRSVP(eventId, rsvpData);

            // Show confirmation
            this.showConfirmation(rsvpData);

        } catch (error) {
            console.error('RSVP submission failed:', error);
            
            // Try email fallback
            const event = (window.events ? window.events[eventId] : null) || getEventFromURL();
            if (event) {
                const rsvpData = this.collectFormData();
                rsvpData.timestamp = Date.now();
                this.sendRSVPEmail(event, rsvpData);
            } else {
                showToast('Failed to submit RSVP: ' + error.message, 'error');
            }

        } finally {
            // Restore button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            this.submissionInProgress = false;
        }
    }

    /**
     * Collect form data from RSVP form
     * @returns {Object} RSVP data
     */
    collectFormData() {
        const attending = document.getElementById('attending')?.value;
        
        // Handle both radio buttons and custom attending field
        let attendingValue;
        if (attending !== undefined && attending !== '') {
            attendingValue = attending === 'true';
        } else {
            const attendingRadio = document.querySelector('input[name="attending"]:checked');
            attendingValue = attendingRadio ? attendingRadio.value === 'true' : null;
        }

        const event = (window.events ? window.events[this.currentEventId] : null) || getEventFromURL();
        const customAnswers = {};

        // Collect custom question answers
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
            userAgent: navigator.userAgent,
            ipAddress: 'N/A', // Would require server-side to get real IP
            submissionMethod: 'web_form'
        };
    }

    /**
     * Validate RSVP data
     * @param {Object} rsvpData - RSVP data to validate
     * @returns {Object} Validation result
     */
    validateRSVPData(rsvpData) {
        const result = {
            valid: true,
            errors: []
        };

        // Required fields
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
            result.errors.push(MESSAGES.error.selectAttending);
        }

        // Optional phone validation
        if (rsvpData.phone && !isValidPhone(rsvpData.phone)) {
            result.valid = false;
            result.errors.push('Please enter a valid phone number');
        }

        // Guest count validation
        if (rsvpData.guestCount < 0 || rsvpData.guestCount > 10) {
            result.valid = false;
            result.errors.push('Guest count must be between 0 and 10');
        }

        // Name format validation
        if (rsvpData.name && !isValidName(rsvpData.name)) {
            result.valid = false;
            result.errors.push('Please enter a valid name (letters, spaces, hyphens, and periods only)');
        }

        return result;
    }

    /**
     * Save RSVP to GitHub
     * @param {string} eventId - Event ID
     * @param {Object} rsvpData - RSVP data
     */
    async saveRSVP(eventId, rsvpData) {
        try {
            await githubAPI.saveRSVP(eventId, rsvpData);
            
            // Update local responses if we're the host
            if (window.responses && !window.responses[eventId]) {
                window.responses[eventId] = [];
            }
            if (window.responses) {
                window.responses[eventId].push(rsvpData);
            }
            
            showToast(MESSAGES.success.rsvpSubmitted, 'success');
            
        } catch (error) {
            console.error('Failed to save RSVP to GitHub:', error);
            throw error;
        }
    }

    /**
     * Send RSVP via email (fallback method)
     * @param {Object} event - Event data
     * @param {Object} rsvpData - RSVP data
     */
    sendRSVPEmail(event, rsvpData) {
        const subject = encodeURIComponent(`RSVP Response: ${event.title}`);
        let emailBody = `New RSVP Response:\n\n`;
        
        emailBody += `Event: ${event.title}\n`;
        emailBody += `Date: ${formatDate(event.date)} at ${formatTime(event.time)}\n`;
        if (event.location) emailBody += `Location: ${event.location}\n`;
        emailBody += `\nRespondent Details:\n`;
        emailBody += `Name: ${rsvpData.name}\n`;
        emailBody += `Email: ${rsvpData.email}\n`;
        emailBody += `Phone: ${rsvpData.phone || 'Not provided'}\n`;
        emailBody += `Attending: ${rsvpData.attending ? 'YES' : 'NO'}\n`;
        
        if (rsvpData.reason) {
            emailBody += `Reason: ${rsvpData.reason}\n`;
        }
        
        if (rsvpData.guestCount > 0) {
            emailBody += `Additional Guests: ${rsvpData.guestCount}\n`;
        }

        // Add custom question answers
        if (event.customQuestions && Object.keys(rsvpData.customAnswers).length > 0) {
            emailBody += `\nCustom Questions:\n`;
            event.customQuestions.forEach(q => {
                if (rsvpData.customAnswers[q.id]) {
                    emailBody += `${q.question}: ${rsvpData.customAnswers[q.id]}\n`;
                }
            });
        }
        
        emailBody += `\nSubmitted: ${new Date(rsvpData.timestamp).toLocaleString()}\n`;
        emailBody += `\n---\nSent via EventCall - Professional Military Event Management`;

        const body = encodeURIComponent(emailBody);
        const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
        
        // Open email client
        window.location.href = mailtoLink;
        
        showToast(MESSAGES.info.emailFallback, 'success');
        
        // Show email confirmation
        this.showEmailConfirmation(event, rsvpData);
    }

    /**
     * Show RSVP confirmation page
     * @param {Object} rsvpData - RSVP data
     */
    showConfirmation(rsvpData) {
        const event = (window.events ? window.events[this.currentEventId] : null) || getEventFromURL();
        
        document.getElementById('invite-content').innerHTML = `
            <div class="rsvp-confirmation">
                <div class="confirmation-title">🎉 Thank You!</div>
                <div class="confirmation-message">
                    Your RSVP has been submitted successfully, <strong>${rsvpData.name}</strong>!
                </div>
                
                <div class="confirmation-details">
                    <div class="confirmation-status">
                        <strong>Status:</strong> ${rsvpData.attending ? '✅ Attending' : '❌ Not Attending'}
                    </div>
                    
                    ${rsvpData.guestCount > 0 ? `
                        <div><strong>Additional Guests:</strong> ${rsvpData.guestCount}</div>
                    ` : ''}
                    
                    ${rsvpData.reason ? `
                        <div><strong>Reason:</strong> ${rsvpData.reason}</div>
                    ` : ''}
                    
                    <div class="confirmation-note">
                        Your response has been saved to the event database and the organizer has been notified.
                    </div>
                </div>

                ${this.generateConfirmationSummary(event, rsvpData)}
                
                <div style="margin-top: 2rem;">
                    <button class="btn" onclick="window.location.reload()">📝 Submit Another RSVP</button>
                </div>
            </div>
        `;
    }

    /**
     * Show email confirmation page
     * @param {Object} event - Event data
     * @param {Object} rsvpData - RSVP data
     */
    showEmailConfirmation(event, rsvpData) {
        document.getElementById('invite-content').innerHTML = `
            <div class="rsvp-confirmation">
                <div class="confirmation-title">📧 Email Client Opened</div>
                <div class="confirmation-message">
                    Thank you, <strong>${rsvpData.name}</strong>! Please send the email to complete your RSVP.
                </div>
                
                <div class="confirmation-details">
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 0.5rem; border-left: 4px solid var(--semper-gold);">
                        <strong>📋 To Complete Your RSVP:</strong><br>
                        1. Your email client should have opened with your response details<br>
                        2. Review the information and click "Send"<br>
                        3. The event organizer will receive your RSVP via email
                    </div>
                    
                    <div style="margin-top: 1rem;">
                        <strong>Your Response Summary:</strong><br>
                        Attending: ${rsvpData.attending ? '✅ Yes' : '❌ No'}<br>
                        ${rsvpData.guestCount > 0 ? `Additional Guests: ${rsvpData.guestCount}<br>` : ''}
                        ${rsvpData.reason ? `Reason: ${rsvpData.reason}<br>` : ''}
                    </div>
                </div>

                <div style="margin-top: 2rem; font-size: 0.875rem; color: #6b7280;">
                    <strong>Didn't see your email client open?</strong><br>
                    Please manually email the event organizer with your RSVP details.
                </div>
            </div>
        `;
    }

    /**
     * Generate confirmation summary
     * @param {Object} event - Event data
     * @param {Object} rsvpData - RSVP data
     * @returns {string} HTML summary
     */
    generateConfirmationSummary(event, rsvpData) {
        if (!event) return '';

        return `
            <div style="margin: 1.5rem 0; padding: 1rem; background: var(--gray-50); border-radius: 0.5rem;">
                <strong>📅 Event Details:</strong><br>
                <div style="margin-top: 0.5rem;">
                    <strong>${event.title}</strong><br>
                    ${formatDate(event.date)} at ${formatTime(event.time)}<br>
                    ${event.location ? `📍 ${event.location}<br>` : ''}
                    ${event.description ? `📝 ${event.description}` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Handle RSVP option selection
     * @param {boolean} attending - Attending status
     * @param {Element} element - Clicked element
     */
    selectRSVP(attending, element) {
        // Remove selected class from all options
        document.querySelectorAll('.rsvp-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        element.classList.add('selected');
        
        // Update hidden input
        const attendingInput = document.getElementById('attending');
        if (attendingInput) {
            attendingInput.value = attending;
        }

        // Show/hide guest count based on attending status
        const guestCountGroup = document.getElementById('guest-count')?.closest('.form-group');
        if (guestCountGroup) {
            if (attending) {
                guestCountGroup.style.display = 'block';
            } else {
                guestCountGroup.style.display = 'none';
                const guestCountSelect = document.getElementById('guest-count');
                if (guestCountSelect) {
                    guestCountSelect.value = '0';
                }
            }
        }
    }

    /**
     * Pre-fill form with URL parameters (if any)
     */
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

    /**
     * Validate email in real-time
     */
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

    /**
     * Check for duplicate RSVP submissions
     * @param {string} eventId - Event ID
     * @param {string} email - Email address
     * @returns {boolean} True if duplicate found
     */
    checkDuplicateSubmission(eventId, email) {
        const allResponses = window.responses || {};
        const eventResponses = allResponses[eventId] || [];
        return eventResponses.some(response => 
            response.email.toLowerCase() === email.toLowerCase()
        );
    }

    /**
     * Handle duplicate submission
     * @param {string} email - Email address
     */
    handleDuplicateSubmission(email) {
        const confirmUpdate = confirm(
            `An RSVP has already been submitted for ${email}. ` +
            'Would you like to update your previous response?'
        );

        if (confirmUpdate) {
            // Allow the submission to proceed (it will update the existing response)
            return true;
        } else {
            showToast('RSVP submission cancelled', 'error');
            return false;
        }
    }

    /**
     * Format RSVP data for display
     * @param {Object} rsvpData - RSVP data
     * @returns {string} Formatted text
     */
    formatRSVPForDisplay(rsvpData) {
        let formatted = `Name: ${rsvpData.name}\n`;
        formatted += `Email: ${rsvpData.email}\n`;
        if (rsvpData.phone) formatted += `Phone: ${rsvpData.phone}\n`;
        formatted += `Attending: ${rsvpData.attending ? 'Yes' : 'No'}\n`;
        if (rsvpData.guestCount > 0) formatted += `Guests: ${rsvpData.guestCount}\n`;
        if (rsvpData.reason) formatted += `Reason: ${rsvpData.reason}\n`;
        formatted += `Submitted: ${new Date(rsvpData.timestamp).toLocaleString()}`;
        
        return formatted;
    }
}

// Create global instance
const rsvpHandler = new RSVPHandler();

// Make functions available globally for HTML onclick handlers
window.rsvpHandler = rsvpHandler;
window.selectRSVP = (attending, element) => rsvpHandler.selectRSVP(attending, element);
window.handleRSVP = (e, eventId) => rsvpHandler.handleRSVP(e, eventId);