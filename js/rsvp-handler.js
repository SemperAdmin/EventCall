/**
 * EventCall RSVP Handler - Secure Backend Integration
 */

class RSVPHandler {
    constructor() {
        this.currentEventId = null;
        this.submissionInProgress = false;
        this.maxRetries = 3;
        this.retryDelay = 2000;
        this.editMode = false;
        this.editToken = null;
        this.existingRsvpId = null;
    }

    generateValidationHash(rsvpData) {
        const dataString = `${rsvpData.eventId}-${rsvpData.email}-${rsvpData.timestamp}`;
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Check if URL contains edit token and load existing RSVP
     */
    async initEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('edit');
        const rsvpId = urlParams.get('rsvpId');

        if (editToken && rsvpId) {
            this.editMode = true;
            this.editToken = editToken;
            this.existingRsvpId = rsvpId;

            // Load existing RSVP data from localStorage as fallback
            // In production, this would fetch from GitHub
            const event = getEventFromURL();
            if (event) {
                const storageKey = `eventcall_pending_rsvps_${event.id}`;
                try {
                    const pending = localStorage.getItem(storageKey);
                    if (pending) {
                        const rsvps = JSON.parse(pending);
                        const existing = rsvps.find(r => r.rsvpId === rsvpId || r.editToken === editToken);
                        if (existing) {
                            return existing;
                        }
                    }
                } catch (e) {
                    console.warn('Could not load existing RSVP:', e);
                }
            }
        }

        return null;
    }

    /**
     * Pre-fill form with existing RSVP data
     */
    prefillEditForm(rsvpData) {
        if (!rsvpData) return;

        const nameInput = document.getElementById('rsvp-name');
        const emailInput = document.getElementById('rsvp-email');
        const phoneInput = document.getElementById('rsvp-phone');
        const reasonInput = document.getElementById('reason');
        const guestCountInput = document.getElementById('guest-count');

        if (nameInput) nameInput.value = rsvpData.name || '';
        if (emailInput) emailInput.value = rsvpData.email || '';
        if (phoneInput) phoneInput.value = rsvpData.phone || '';
        if (reasonInput) reasonInput.value = rsvpData.reason || '';
        if (guestCountInput) guestCountInput.value = rsvpData.guestCount || 0;

        // Set attending radio button
        if (rsvpData.attending !== undefined) {
            const attendingRadio = document.querySelector(`input[name="attending"][value="${rsvpData.attending}"]`);
            if (attendingRadio) attendingRadio.checked = true;
        }

        // Show edit mode banner
        this.showEditModeBanner();
    }

    /**
     * Show banner indicating edit mode
     */
    showEditModeBanner() {
        const inviteContent = document.getElementById('invite-content');
        if (!inviteContent) return;

        const banner = document.createElement('div');
        banner.className = 'edit-mode-banner';
        banner.style.cssText = `
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            color: #78350f;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
            font-weight: 600;
            text-align: center;
            border: 2px solid #fcd34d;
        `;
        banner.innerHTML = '✏️ <strong>Edit Mode:</strong> You are updating your existing RSVP';

        const firstChild = inviteContent.firstChild;
        if (firstChild) {
            inviteContent.insertBefore(banner, firstChild);
        }
    }

    async handleRSVP(e, eventId) {
        e.preventDefault();

        if (this.submissionInProgress) {
            showToast('⏳ Submission already in progress...', 'error');
            return;
        }

        this.submissionInProgress = true;
        this.currentEventId = eventId;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        try {
            submitBtn.innerHTML = '<div class="spinner"></div> Submitting...';
            submitBtn.disabled = true;

            const rsvpData = this.collectFormData();
            const validation = this.validateRSVPData(rsvpData);

            if (!validation.valid) {
                validation.errors.forEach(error => {
                    showToast(error, 'error');
                });
                return;
            }

            rsvpData.timestamp = Date.now();

            // In edit mode, use existing RSVP ID, otherwise generate new
            if (this.editMode && this.existingRsvpId) {
                rsvpData.rsvpId = this.existingRsvpId;
                rsvpData.editToken = this.editToken;
                rsvpData.isUpdate = true;
                rsvpData.lastModified = Date.now();
            } else {
                rsvpData.rsvpId = generateUUID();
                rsvpData.editToken = generateUUID(); // Generate edit token for new RSVPs
                rsvpData.isUpdate = false;
            }

            rsvpData.eventId = eventId;
            rsvpData.validationHash = this.generateValidationHash(rsvpData);
            rsvpData.submissionMethod = 'secure_backend';

            // Generate check-in token
            if (window.qrCheckIn) {
                rsvpData.checkInToken = window.qrCheckIn.generateCheckInToken(rsvpData.rsvpId);
            }

            const submissionResult = await this.submitWithRetry(eventId, rsvpData);
            this.showEnhancedConfirmation(rsvpData, submissionResult);

        } catch (error) {
            console.error('RSVP submission failed:', error);
            this.showSubmissionError(error);

        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            this.submissionInProgress = false;
        }
    }

    async submitWithRetry(eventId, rsvpData, attempt = 1) {
        try {
            showToast(`📤 Submitting RSVP (attempt ${attempt}/${this.maxRetries})...`, 'success');
            return await this.submitToSecureBackend(eventId, rsvpData);
            
        } catch (error) {
            console.error(`Submission attempt ${attempt} failed:`, error);
            
            if (attempt < this.maxRetries) {
                showToast(`⚠️ Attempt ${attempt} failed, retrying in ${this.retryDelay/1000} seconds...`, 'error');
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.submitWithRetry(eventId, rsvpData, attempt + 1);
            } else {
                try {
                    const localResult = await this.storeLocally(eventId, rsvpData);
                    showToast('⚠️ Submission failed, saved locally for manual processing', 'error');
                    return localResult;
                } catch (localError) {
                    throw new Error(`All submission methods failed. Backend: ${error.message}, Local: ${localError.message}`);
                }
            }
        }
    }

    async submitToSecureBackend(eventId, rsvpData) {
        const event = getEventFromURL();
        if (!event) throw new Error('Event data not found');

        if (!window.BackendAPI) {
            throw new Error('Backend API not loaded. Please refresh the page.');
        }

        try {
            const result = await window.BackendAPI.submitRSVP(rsvpData);
            
            return {
                method: 'secure_backend',
                success: true,
                processingStatus: 'automated',
                estimatedProcessingTime: '30-60 seconds',
                message: 'RSVP submitted to secure backend for processing'
            };
        } catch (error) {
            console.error('Backend submission error:', error);
            
            let errorMessage = 'Backend submission failed';
            
            if (error.message.includes('Failed: 404')) {
                errorMessage = 'Backend workflow not found - please contact administrator';
            } else if (error.message.includes('Failed: 401')) {
                errorMessage = 'Authentication failed - please contact administrator';
            } else if (error.message.includes('Failed: 403')) {
                errorMessage = 'Permission denied - please contact administrator';
            } else {
                errorMessage = error.message;
            }
            
            throw new Error(errorMessage);
        }
    }

    async storeLocally(eventId, rsvpData) {
        const storageKey = `eventcall_pending_rsvps_${eventId}`;
        let pendingRSVPs = [];
        
        try {
            const existing = localStorage.getItem(storageKey);
            if (existing) {
                pendingRSVPs = JSON.parse(existing);
            }
        } catch (e) {
            console.warn('Failed to load existing pending RSVPs:', e);
            pendingRSVPs = [];
        }

        const existingIndex = pendingRSVPs.findIndex(r => 
            r.email && r.email.toLowerCase() === rsvpData.email.toLowerCase()
        );
        
        if (existingIndex !== -1) {
            pendingRSVPs[existingIndex] = rsvpData;
        } else {
            pendingRSVPs.push(rsvpData);
        }

        try {
            localStorage.setItem(storageKey, JSON.stringify(pendingRSVPs));
        } catch (e) {
            throw new Error(`Failed to save locally: ${e.message}`);
        }

        return {
            method: 'local_storage',
            success: true,
            pendingCount: pendingRSVPs.length,
            requiresManualProcessing: true
        };
    }

    async showEnhancedConfirmation(rsvpData, submissionResult) {
        const event = getEventFromURL();
        let statusMessage = '';
        let statusColor = 'd1fae5';
        let borderColor = '10b981';
        let processingInfo = '';

        if (submissionResult.method === 'secure_backend') {
            statusMessage = `✅ RSVP Successfully Submitted!`;
            processingInfo = `
                <div style="background: #e0f2fe; border-left: 4px solid #0288d1; padding: 1rem; margin: 1rem 0; border-radius: 0.5rem;">
                    <strong>🔒 Secure Processing:</strong><br>
                    • Your RSVP has been submitted to our secure backend<br>
                    • Processing time: ${submissionResult.estimatedProcessingTime}<br>
                    • Your information is encrypted and protected<br>
                    • You will receive a confirmation email shortly
                </div>
            `;
        } else {
            statusMessage = `⚠️ RSVP Saved Locally - Manual Processing Required`;
            statusColor = 'fef3c7';
            borderColor = 'f59e0b';
            processingInfo = `
                <div style="background: #fff8e1; border-left: 4px solid #ff9800; padding: 1rem; margin: 1rem 0; border-radius: 0.5rem;">
                    <strong>📋 Manual Processing Required:</strong><br>
                    • Submission failed - saved locally<br>
                    • Please contact the event organizer with your RSVP ID: <code>${rsvpData.rsvpId}</code><br>
                    • Organizer can manually sync pending RSVPs from their dashboard
                </div>
            `;
        }

        // Generate QR code if attending
        let qrCodeHTML = '';
        if (rsvpData.attending && rsvpData.checkInToken && window.qrCheckIn) {
            qrCodeHTML = await window.qrCheckIn.generateQRCodeHTML(
                rsvpData.eventId,
                rsvpData.rsvpId,
                rsvpData.checkInToken,
                rsvpData
            );
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

                    ${rsvpData.dietaryRestrictions && rsvpData.dietaryRestrictions.length > 0 ? `
                        <div><strong>Dietary Restrictions:</strong> ${rsvpData.dietaryRestrictions.join(', ')}</div>
                    ` : ''}

                    ${rsvpData.allergyDetails ? `
                        <div><strong>Allergy Details:</strong> ${rsvpData.allergyDetails}</div>
                    ` : ''}

                    ${rsvpData.rank || rsvpData.unit || rsvpData.branch ? `
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: #f0f9ff; border-radius: 0.5rem;">
                            <strong>🎖️ Military Information:</strong><br>
                            ${rsvpData.rank ? `<div>Rank: ${rsvpData.rank}</div>` : ''}
                            ${rsvpData.unit ? `<div>Unit: ${rsvpData.unit}</div>` : ''}
                            ${rsvpData.branch ? `<div>Branch: ${rsvpData.branch}</div>` : ''}
                        </div>
                    ` : ''}

                    ${rsvpData.reason ? `
                        <div><strong>Reason:</strong> ${rsvpData.reason}</div>
                    ` : ''}
                    
                    <div style="margin-top: 1rem; padding: 1rem; background: #${statusColor}; border-radius: 0.5rem; border-left: 4px solid #${borderColor};">
                        <strong>📊 Submission Status:</strong><br>
                        ${statusMessage}
                    </div>
                    
                    ${processingInfo}
                    
                    <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; border-radius: 0.5rem;">
                        <strong>📋 RSVP Details:</strong><br>
                        <strong>RSVP ID:</strong> <code style="background: #e5e7eb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">${rsvpData.rsvpId}</code><br>
                        <strong>Validation Hash:</strong> <code style="background: #e5e7eb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">${rsvpData.validationHash}</code><br>
                        <strong>Submitted:</strong> ${new Date(rsvpData.timestamp).toLocaleString()}<br>
                    </div>
                </div>

                ${this.generateEventSummary(event, rsvpData)}

                ${qrCodeHTML}

                ${rsvpData.attending && window.calendarExport ? `
                <div style="margin-top: 1.5rem; padding: 1rem; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 0.5rem;">
                    <strong>📅 Add to Your Calendar</strong><br>
                    <div style="margin-top: 0.75rem;">
                        ${window.calendarExport.generateCalendarDropdownHTML(event)}
                    </div>
                </div>
                ` : ''}

                <div style="margin-top: 2rem; display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
                    <button class="btn" onclick="window.print()">🖨️ Print Receipt</button>
                    <button class="btn" onclick="window.rsvpHandler.copyEditLink('${rsvpData.rsvpId}', '${rsvpData.editToken}')">✏️ Copy Edit Link</button>
                    <button class="btn" onclick="window.location.reload()">📝 Submit Another RSVP</button>
                </div>

                <div style="margin-top: 1.5rem; padding: 1rem; background: #fffbeb; border-left: 4px solid #fbbf24; border-radius: 0.5rem;">
                    <strong>✏️ Need to make changes?</strong><br>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem;">
                        Save your edit link to update your RSVP later:<br>
                        <code style="background: #fef3c7; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.75rem; display: inline-block; margin-top: 0.25rem; word-break: break-all;">
                            ${this.generateEditURL(event, rsvpData.rsvpId, rsvpData.editToken)}
                        </code>
                    </div>
                </div>
            </div>
        `;
    }

    showSubmissionError(error) {
        const errorDetails = this.categorizeError(error);
        
        showToast(`❌ Submission failed: ${errorDetails.userMessage}`, 'error');
        
        document.getElementById('invite-content').innerHTML = `
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 1rem; padding: 2rem; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <div style="color: #ef4444; font-size: 2rem; font-weight: 700; margin-bottom: 1rem;">
                    ❌ Submission Failed
                </div>
                
                <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem; margin: 1rem 0; border-radius: 0.5rem; text-align: left;">
                    <strong>Error Details:</strong><br>
                    ${errorDetails.userMessage}
                </div>
                
                <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; border-radius: 0.5rem; text-align: left;">
                    <strong>What to do next:</strong><br>
                    ${errorDetails.suggestions.join('<br>')}
                </div>
                
                <div style="margin-top: 2rem;">
                    <button class="btn" onclick="window.location.reload()">🔄 Try Again</button>
                </div>
            </div>
        `;
    }

    categorizeError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('network') || message.includes('fetch')) {
            return {
                userMessage: 'Network connection issue. Please check your internet connection.',
                suggestions: [
                    '• Check your internet connection',
                    '• Try refreshing the page and submitting again',
                    '• If the problem persists, contact the event organizer directly'
                ]
            };
        } else if (message.includes('rate limit')) {
            return {
                userMessage: 'Too many requests. Please wait a moment and try again.',
                suggestions: [
                    '• Wait 60 seconds before trying again',
                    '• Only submit your RSVP once',
                    '• Contact event organizer if urgent'
                ]
            };
        } else if (message.includes('authentication') || message.includes('401')) {
            return {
                userMessage: 'System authentication issue. This is a temporary problem.',
                suggestions: [
                    '• Try again in a few minutes',
                    '• Contact the event organizer with your RSVP details',
                    '• Reference Error Code: AUTH_001'
                ]
            };
        } else {
            return {
                userMessage: 'An unexpected error occurred during submission.',
                suggestions: [
                    '• Try refreshing the page and submitting again',
                    '• Contact the event organizer directly',
                    '• Include the error details when contacting support'
                ]
            };
        }
    }

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

        // Collect dietary restrictions
        const dietaryRestrictions = [];
        document.querySelectorAll('input[name="dietary"]:checked').forEach(checkbox => {
            dietaryRestrictions.push(checkbox.value);
        });

        const allergyDetails = sanitizeText(document.getElementById('allergy-details')?.value || '');

        // Collect military information
        const rank = document.getElementById('rank')?.value || '';
        const unit = sanitizeText(document.getElementById('unit')?.value || '');
        const branch = document.getElementById('branch')?.value || '';

        return {
            name: sanitizeText(document.getElementById('rsvp-name')?.value || ''),
            email: sanitizeText(document.getElementById('rsvp-email')?.value || ''),
            phone: sanitizeText(document.getElementById('rsvp-phone')?.value || ''),
            attending: attendingValue,
            reason: sanitizeText(document.getElementById('reason')?.value || ''),
            guestCount: parseInt(document.getElementById('guest-count')?.value || '0'),
            dietaryRestrictions: dietaryRestrictions,
            allergyDetails: allergyDetails,
            rank: rank,
            unit: unit,
            branch: branch,
            customAnswers: customAnswers,
            userAgent: navigator.userAgent
        };
    }

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
            result.errors.push('Please select if you are attending');
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

    /**
     * Generate edit URL for an RSVP
     */
    generateEditURL(event, rsvpId, editToken) {
        if (!event) return '';
        const currentURL = window.location.href.split('?')[0].split('#')[0];
        const encodedData = btoa(JSON.stringify({
            id: event.id,
            title: event.title,
            date: event.date,
            time: event.time,
            location: event.location,
            description: event.description,
            coverImage: event.coverImage,
            askReason: event.askReason,
            allowGuests: event.allowGuests,
            requiresMealChoice: event.requiresMealChoice || false,
            eventDetails: event.eventDetails || {},
            customQuestions: event.customQuestions || [],
            created: event.created
        }));
        return `${currentURL}?data=${encodedData}&edit=${editToken}&rsvpId=${rsvpId}#invite/${event.id}`;
    }

    /**
     * Copy edit link to clipboard
     */
    async copyEditLink(rsvpId, editToken) {
        const event = getEventFromURL();
        if (!event) {
            showToast('❌ Event data not found', 'error');
            return;
        }

        const editURL = this.generateEditURL(event, rsvpId, editToken);

        try {
            await navigator.clipboard.writeText(editURL);
            showToast('✏️ Edit link copied to clipboard!', 'success');
        } catch (error) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = editURL;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('✏️ Edit link copied!', 'success');
        }
    }
}

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

const rsvpHandler = new RSVPHandler();

window.rsvpHandler = rsvpHandler;
window.handleRSVP = (e, eventId) => rsvpHandler.handleRSVP(e, eventId);
