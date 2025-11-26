/**
 * EventCall Feedback Widget
 * Simple feedback collection system that creates GitHub issues
 */

class FeedbackWidget {
    constructor() {
        this.modal = null;
        this.isOpen = false;
        this.submitting = false;
    }

    /**
     * Initialize the feedback widget
     */
    init() {
        console.log('🎯 Initializing feedback widget...');
        this.createFeedbackButton();
        this.createFeedbackModal();
        this.attachEventListeners();
        console.log('✅ Feedback widget initialized');
    }

    /**
     * Create the floating feedback button
     */
    createFeedbackButton() {
        const button = document.createElement('button');
        button.id = 'feedback-button';
        button.className = 'feedback-button';
        button.setAttribute('aria-label', 'Open feedback form');
        button.innerHTML = '💬';
        document.body.appendChild(button);

        button.addEventListener('click', () => this.openModal());
    }

    /**
     * Create the feedback modal
     */
    createFeedbackModal() {
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.className = 'feedback-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'feedback-modal-title');

        modal.innerHTML = `
            <div class="feedback-modal__overlay"></div>
            <div class="feedback-modal__content">
                <div class="feedback-modal__header">
                    <h2 id="feedback-modal-title" class="feedback-modal__title">Send Feedback</h2>
                    <button type="button" class="feedback-modal__close" aria-label="Close feedback form">×</button>
                </div>

                <form id="feedback-form" class="feedback-form">
                    <div class="form-group">
                        <label for="feedback-type" class="form-label">Feedback Type *</label>
                        <select id="feedback-type" name="type" class="form-input" required>
                            <option value="">Select type...</option>
                            <option value="bug">🐛 Bug Report</option>
                            <option value="feature">✨ Feature Request</option>
                            <option value="ux">🎨 UX Suggestion</option>
                            <option value="other">💬 Other</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="feedback-title" class="form-label">Title *</label>
                        <input
                            type="text"
                            id="feedback-title"
                            name="title"
                            class="form-input"
                            placeholder="Brief summary of your feedback"
                            maxlength="200"
                            required
                        >
                        <small class="form-hint">Max 200 characters</small>
                    </div>

                    <div class="form-group">
                        <label for="feedback-description" class="form-label">Description *</label>
                        <textarea
                            id="feedback-description"
                            name="description"
                            class="form-input"
                            placeholder="Please provide details..."
                            rows="6"
                            maxlength="5000"
                            required
                        ></textarea>
                        <small class="form-hint">Max 5000 characters</small>
                    </div>

                    <div class="form-group">
                        <label for="feedback-email" class="form-label">
                            Email (Optional - will be public in GitHub issue)
                        </label>
                        <input
                            type="email"
                            id="feedback-email"
                            name="email"
                            class="form-input"
                            placeholder="your@email.com (visible publicly)"
                            maxlength="200"
                        >
                        <small class="form-hint feedback-privacy-warning">⚠️ Your email will be visible in the public GitHub issue</small>
                    </div>

                    <div class="feedback-form__actions">
                        <button type="button" class="btn btn--secondary" id="feedback-cancel">Cancel</button>
                        <button type="submit" class="btn btn--primary" id="feedback-submit">Submit Feedback</button>
                    </div>
                </form>

                <div id="feedback-success" class="feedback-success" style="display: none;">
                    <div class="feedback-success__icon">✅</div>
                    <h3 class="feedback-success__title">Thank you for your feedback!</h3>
                    <p class="feedback-success__message">Your feedback has been submitted successfully.</p>
                    <button type="button" class="btn btn--primary" id="feedback-close">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        const closeBtn = this.modal.querySelector('.feedback-modal__close');
        closeBtn.addEventListener('click', () => this.closeModal());

        // Cancel button
        const cancelBtn = this.modal.querySelector('#feedback-cancel');
        cancelBtn.addEventListener('click', () => this.closeModal());

        // Close success button
        const closeSuccessBtn = this.modal.querySelector('#feedback-close');
        closeSuccessBtn.addEventListener('click', () => this.closeModal());

        // Overlay click
        const overlay = this.modal.querySelector('.feedback-modal__overlay');
        overlay.addEventListener('click', () => this.closeModal());

        // Form submit
        const form = this.modal.querySelector('#feedback-form');
        form.addEventListener('submit', (e) => this.handleSubmit(e));

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeModal();
            }
        });
    }

    /**
     * Open the modal
     */
    openModal() {
        this.modal.classList.add('feedback-modal--open');
        this.isOpen = true;
        document.body.style.overflow = 'hidden';

        // Focus first input
        setTimeout(() => {
            const firstInput = this.modal.querySelector('#feedback-type');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    /**
     * Close the modal
     */
    closeModal() {
        this.modal.classList.remove('feedback-modal--open');
        this.isOpen = false;
        document.body.style.overflow = '';

        // Reset form after animation
        setTimeout(() => {
            const form = this.modal.querySelector('#feedback-form');
            const success = this.modal.querySelector('#feedback-success');
            form.style.display = 'block';
            success.style.display = 'none';
            form.reset();
        }, 300);
    }

    /**
     * Handle form submission
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (this.submitting) {
            return;
        }

        const form = e.target;
        const submitBtn = form.querySelector('#feedback-submit');
        const formData = new FormData(form);

        // Collect form data
        const feedback = {
            type: this.sanitizeString(formData.get('type')),
            title: this.sanitizeString(formData.get('title')),
            description: this.sanitizeString(formData.get('description')),
            email: this.sanitizeString(formData.get('email')),
            // Auto-captured context
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        // Validate
        if (!feedback.type || !feedback.title || !feedback.description) {
            this.showToast('❌ Please fill in all required fields', 'error');
            return;
        }

        this.submitting = true;

        try {
            await window.LoadingUI.withButtonLoading(submitBtn, 'Submitting...', async () => {
                await this.submitFeedback(feedback);
                this.showSuccess();
            });
        } catch (error) {
            console.error('Feedback submission failed:', error);
            this.showToast('❌ Failed to submit feedback: ' + error.message, 'error');
        } finally {
            this.submitting = false;
        }
    }

    /**
     * Submit feedback to GitHub
     */
    async submitFeedback(feedback) {
        const typeLabels = {
            bug: '🐛 BUG REPORT',
            feature: '✨ FEATURE REQUEST',
            ux: '🎨 UX SUGGESTION',
            other: '💬 FEEDBACK'
        };

        const issueTitle = `[${typeLabels[feedback.type] || 'FEEDBACK'}] ${feedback.title}`;

        const issueBody = `## ${typeLabels[feedback.type] || 'Feedback'}

${feedback.description}

---

### Technical Context
- **Submitted:** ${feedback.timestamp}
- **URL:** ${feedback.url}
- **Browser:** ${feedback.userAgent}
- **Screen:** ${feedback.screenResolution}
- **Viewport:** ${feedback.viewport}
${feedback.email ? `- **Contact:** ${feedback.email}` : ''}

---
*Submitted via EventCall Feedback Widget*
`;

        // Try to submit via GitHub API
        try {
            if (!window.GITHUB_CONFIG || !window.GITHUB_CONFIG.token) {
                throw new Error('GitHub configuration not found');
            }

            const response = await fetch(
                `https://api.github.com/repos/${window.GITHUB_CONFIG.owner}/${window.GITHUB_CONFIG.repo}/issues`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${window.GITHUB_CONFIG.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: issueTitle,
                        body: issueBody
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `GitHub API error: ${response.status}`);
            }

            const issue = await response.json();
            console.log('✅ Feedback submitted as issue #' + issue.number);
            return issue;

        } catch (error) {
            console.error('Failed to submit via GitHub API:', error);
            throw error;
        }
    }

    /**
     * Show success message
     */
    showSuccess() {
        const form = this.modal.querySelector('#feedback-form');
        const success = this.modal.querySelector('#feedback-success');

        form.style.display = 'none';
        success.style.display = 'block';
    }

    /**
     * Sanitize string input
     */
    sanitizeString(str) {
        if (!str) return '';
        // Remove control characters except newlines and tabs
        return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
}

// Initialize feedback widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Skip in test mode
    if (window.__TEST_MODE__) {
        console.log('⚠️ Test mode detected - skipping feedback widget initialization');
        return;
    }

    const feedbackWidget = new FeedbackWidget();
    feedbackWidget.init();
    window.feedbackWidget = feedbackWidget;
});

console.log('✅ Feedback widget script loaded');
