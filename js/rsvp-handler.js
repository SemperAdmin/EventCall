/**
 * EventCall RSVP Handler - Enhanced with GitHub Actions Integration
 * Creates GitHub Issues with structured data for automated processing
 */

class RSVPHandler {
    constructor() {
        this.currentEventId = null;
        this.submissionInProgress = false;
        this.maxRetries = 3;
        this.retryDelay = 2000;
    }

    /**
     * Get secure API token using obfuscation method (keeping existing approach)
     */
    getAPIToken() {
        // Token parts stored separately and encoded
        const tokenSegments = [
            'Z2hwXzVWMGZKY3dp',  // Base64: ghp_5V0fJcwi
            'Q1JTTUQ3SmI5b2k=',  // Base64: CRSMR7Jb9oi
            'UjNaV3ZMMWJCZ1U=',  // Base64: R3ZWvL1bBgU
            'MGtIOXhw'           // Base64: 0kH9xp
        ];
        
        // Reconstruct token from segments
        const decodedParts = tokenSegments.map(segment => atob(segment));
        return decodedParts.join('');
    }

    /**
     * Generate validation hash for GitHub Actions verification
     */
    generateValidationHash(rsvpData) {
        const dataString = `${rsvpData.eventId}-${rsvpData.email}-${rsvpData.timestamp}`;
        // Simple hash for validation (not cryptographic security)
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Handle RSVP form submission with enhanced error handling and retry logic
     */
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

            // Collect and validate form data
            const rsvpData = this.collectFormData();
            const validation = this.validateRSVPData(rsvpData);

            if (!validation.valid) {
                validation.errors.forEach(error => {
                    showToast(error, 'error');
                });
                return;
            }

            // Add enhanced metadata
            rsvpData.timestamp = Date.now();
            rsvpData.rsvpId = generateUUID();
            rsvpData.eventId = eventId;
            rsvpData.validationHash = this.generateValidationHash(rsvpData);
            rsvpData.submissionMethod = 'github_actions_automated';

            // Attempt submission with retry logic
            const submissionResult = await this.submitWithRetry(eventId, rsvpData);

            // Show enhanced confirmation
            this.showEnhancedConfirmation(rsvpData, submissionResult);

        } catch (error) {
            console.error('RSVP submission failed after all retries:', error);
            this.showSubmissionError(error);

        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            this.submissionInProgress = false;
        }
    }

    /**
     * Submit with retry logic for improved reliability
     */
    async submitWithRetry(eventId, rsvpData, attempt = 1) {
        try {
            showToast(`📤 Submitting RSVP (attempt ${attempt}/${this.maxRetries})...`, 'success');
            return await this.submitToGitHubIssues(eventId, rsvpData);
            
        } catch (error) {
            console.error(`Submission attempt ${attempt} failed:`, error);
            
            if (attempt < this.maxRetries) {
                showToast(`⚠️ Attempt ${attempt} failed, retrying in ${this.retryDelay/1000} seconds...`, 'error');
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.submitWithRetry(eventId, rsvpData, attempt + 1);
            } else {
                // Final attempt failed, try local storage backup
                try {
                    const localResult = await this.storeLocally(eventId, rsvpData);
                    showToast('⚠️ GitHub submission failed, saved locally for manual processing', 'error');
                    return localResult;
                } catch (localError) {
                    throw new Error(`All submission methods failed. GitHub: ${error.message}, Local: ${localError.message}`);
                }
            }
        }
    }

    /**
     * Submit to GitHub Issues with enhanced structured format for GitHub Actions
     */
    async submitToGitHubIssues(eventId, rsvpData) {
        const event = getEventFromURL();
        if (!event) throw new Error('Event data not found');

        const apiToken = this.getAPIToken();
        const issueTitle = `RSVP: ${rsvpData.name} - ${event.title}`;
        const issueBody = this.createStructuredIssueBody(event, rsvpData);

        const issueData = {
            title: issueTitle,
            body: issueBody,
            labels: [
                'rsvp',
                'auto-process', // Trigger for GitHub Actions
                `event-${eventId}`,
                rsvpData.attending ? 'attending' : 'not-attending'
            ]
        };

        const response = await fetch('https://api.github.com/repos/SemperAdmin/EventCall/issues', {
            method: 'POST',
            headers: {
                'Authorization': `token ${apiToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'EventCall-RSVP-System'
            },
            body: JSON.stringify(issueData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let errorMessage = `GitHub API error: ${response.status}`;
            
            // Enhanced error reporting
            switch (response.status) {
                case 401:
                    errorMessage = 'Authentication failed - invalid token';
                    break;
                case 403:
                    errorMessage = 'Rate limit exceeded or insufficient permissions';
                    break;
                case 422:
                    errorMessage = 'Invalid data format - please check your input';
                    break;
                case 500:
                    errorMessage = 'GitHub server error - please try again';
                    break;
                default:
                    errorMessage += ` - ${errorData.message || 'Unknown error'}`;
            }
            
            throw new Error(errorMessage);
        }

        const issueResponse = await response.json();
        return {
            method: 'github_issues',
            success: true,
            issueNumber: issueResponse.number,
            issueUrl: issueResponse.html_url,
            processingStatus: 'automated',
            estimatedProcessingTime: '1-2 minutes'
        };
    }

    /**
     * Create structured issue body optimized for GitHub Actions parsing
     */
    createStructuredIssueBody(event, rsvpData) {
        const attendingStatus = rsvpData.attending ? '✅ ATTENDING' : '❌ NOT ATTENDING';
        
        let body = `## 🎖️ EventCall RSVP Submission\n\n`;
        
        // GitHub Actions Processing Markers
        body += `<!-- EVENTCALL_RSVP_START -->\n`;
        body += `**Validation Hash:** ${rsvpData.validationHash}\n`;
        body += `**Submission ID:** ${rsvpData.rsvpId}\n`;
        body += `**Processing Status:** PENDING\n`;
        body += `<!-- EVENTCALL_RSVP_END -->\n\n`;
        
        // Event Information Section
        body += `### 📅 Event Details\n`;
        body += `- **Event:** ${event.title}\n`;
        body += `- **Date:** ${formatDate(event.date)} at ${formatTime(event.time)}\n`;
        body += `- **Location:** ${event.location || 'TBD'}\n`;
        body += `- **Event ID:** ${rsvpData.eventId}\n\n`;
        
        // Attendee Information Section
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

        // Custom Questions Section
        if (event.customQuestions && Object.keys(rsvpData.customAnswers).length > 0) {
            body += `\n### 📝 Custom Questions\n`;
            event.customQuestions.forEach(q => {
                if (rsvpData.customAnswers[q.id]) {
                    body += `**${q.question}**\n`;
                    body += `${rsvpData.customAnswers[q.id]}\n\n`;
                }
            });
        }
        
        // Structured JSON Data for GitHub Actions (enhanced format)
        body += `\n### 🤖 Automated Processing Data\n`;
        body += `<!-- GITHUB_ACTIONS_JSON_START -->\n`;
        body += `\`\`\`json\n`;
        body += JSON.stringify({
            eventId: rsvpData.eventId,
            rsvpId: rsvpData.rsvpId,
            name: rsvpData.name,
            email: rsvpData.email,
            phone: rsvpData.phone || '',
            attending: rsvpData.attending,
            guestCount: rsvpData.guestCount || 0,
            reason: rsvpData.reason || '',
            customAnswers: rsvpData.customAnswers || {},
            timestamp: rsvpData.timestamp,
            validationHash: rsvpData.validationHash,
            submissionMethod: rsvpData.submissionMethod,
            processed: false,
            version: '2.0'
        }, null, 2);
        body += `\n\`\`\`\n`;
        body += `<!-- GITHUB_ACTIONS_JSON_END -->\n`;
        
        // Submission Details
        body += `\n### 📊 Submission Details\n`;
        body += `- **Submitted:** ${new Date(rsvpData.timestamp).toISOString()}\n`;
        body += `- **User Agent:** ${navigator.userAgent.substring(0, 100)}...\n`;
        body += `- **Referrer:** ${document.referrer || 'Direct access'}\n\n`;
        
        body += `---\n`;
        body += `*This RSVP will be automatically processed by GitHub Actions within 1-2 minutes.*\n`;
        body += `*Submitted via EventCall - Professional Military Event Management*`;
        
        return body;
    }

    /**
     * Enhanced local storage backup with better error handling
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
            console.warn('Failed to load existing pending RSVPs:', e);
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

    /**
     * Show enhanced confirmation with tracking information
     */
    showEnhancedConfirmation(rsvpData, submissionResult) {
        const event = getEventFromURL();
        let statusMessage = '';
        let statusColor = 'd1fae5';
        let borderColor = '10b981';
        let processingInfo = '';

        if (submissionResult.method === 'github_issues') {
            statusMessage = `✅ RSVP Successfully Submitted!`;
            processingInfo = `
                <div style="background: #e0f2fe; border-left: 4px solid #0288d1; padding: 1rem; margin: 1rem 0; border-radius: 0.5rem;">
                    <strong>🤖 Automated Processing:</strong><br>
                    • GitHub Issue #${submissionResult.issueNumber} created<br>
                    • Your RSVP will be automatically processed in ${submissionResult.estimatedProcessingTime}<br>
                    • Manager's dashboard will update automatically<br>
                    • Issue will be automatically closed after processing<br>
                    <a href="${submissionResult.issueUrl}" target="_blank" style="color: #0288d1; text-decoration: none; font-weight: 600;">
                        → View Submission Status
                    </a>
                </div>
            `;
        } else {
            statusMessage = `⚠️ RSVP Saved Locally - Manual Processing Required`;
            statusColor = 'fef3c7';
            borderColor = 'f59e0b';
            processingInfo = `
                <div style="background: #fff8e1; border-left: 4px solid #ff9800; padding: 1rem; margin: 1rem 0; border-radius: 0.5rem;">
                    <strong>📋 Manual Processing Required:</strong><br>
                    • GitHub submission failed - saved locally<br>
                    • Please contact the event organizer with your RSVP ID: <code>${rsvpData.rsvpId}</code><br>
                    • Organizer can manually sync pending RSVPs from their dashboard
                </div>
            `;
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
                    </div>
                    
                    ${processingInfo}
                    
                    <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; border-radius: 0.5rem;">
                        <strong>📋 RSVP Details:</strong><br>
                        <strong>RSVP ID:</strong> <code style="background: #e5e7eb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">${rsvpData.rsvpId}</code><br>
                        <strong>Validation Hash:</strong> <code style="background: #e5e7eb; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">${rsvpData.validationHash}</code><br>
                        <strong>Submitted:</strong> ${new Date(rsvpData.timestamp).toLocaleString()}<br>
                        ${submissionResult.issueNumber ? `<strong>GitHub Issue:</strong> #${submissionResult.issueNumber}<br>` : ''}
                    </div>
                </div>

                ${this.generateEventSummary(event, rsvpData)}
                
                <div style="margin-top: 2rem; display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
                    <button class="btn" onclick="window.print()">🖨️ Print Receipt</button>
                    <button class="btn" onclick="window.location.reload()">📝 Submit Another RSVP</button>
                    ${submissionResult.issueUrl ? `
                        <a href="${submissionResult.issueUrl}" target="_blank" class="btn" style="text-decoration: none;">
                            🔗 Track Status
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Show enhanced error message with actionable information
     */
    showSubmissionError(error) {
        const errorDetails = this.categorizeError(error);
        
        showToast(`❌ Submission failed: ${errorDetails.userMessage}`, 'error');
        
        // Show detailed error page
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
                    <button class="btn" onclick="this.copyErrorInfo('${error.message.replace(/'/g, "\\'")}')">📋 Copy Error Info</button>
                </div>
            </div>
        `;
    }

    /**
     * Categorize errors for better user experience
     */
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

    /**
     * Copy error information to clipboard for support
     */
    copyErrorInfo(errorMessage) {
        const errorInfo = `
EventCall RSVP Error Report
Generated: ${new Date().toISOString()}
Event ID: ${this.currentEventId}
Error: ${errorMessage}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
        `.trim();
        
        navigator.clipboard.writeText(errorInfo).then(() => {
            showToast('📋 Error information copied to clipboard', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = errorInfo;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('📋 Error information copied to clipboard', 'success');
        });
    }

    /**
     * Collect form data (keeping existing logic)
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
     * Validate RSVP data (keeping existing logic)
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
     * Generate event summary (keeping existing logic)
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
            </div>
        `;
    }

    // Keep existing setup methods
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

// Validation functions (keeping existing)
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
