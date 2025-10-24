/**
 * EventCall Event Templates Module
 * Pre-built templates for military ceremonies and events
 */

class EventTemplates {
    constructor() {
        this.templates = {
            promotion: {
                id: 'promotion',
                name: 'Promotion Ceremony',
                icon: '🎖️',
                description: 'Celebrate a Marine\'s advancement in rank',
                defaultTitle: 'Promotion Ceremony',
                defaultDescription: 'Please join us in celebrating this significant milestone in a Marine\'s career.',
                customQuestions: [
                    { id: 'current-rank', text: 'Current Rank', required: false },
                    { id: 'new-rank', text: 'New Rank', required: false },
                    { id: 'promoter-name', text: 'Who will be conducting the promotion?', required: false },
                    { id: 'special-message', text: 'Special message or dedication (optional)', required: false }
                ],
                askReason: false,
                allowGuests: true
            },
            retirement: {
                id: 'retirement',
                name: 'Retirement Ceremony',
                icon: '🎖️',
                description: 'Honor a Marine\'s dedicated service',
                defaultTitle: 'Retirement Ceremony',
                defaultDescription: 'Please join us in honoring the distinguished career and dedicated service of a fellow Marine.',
                customQuestions: [
                    { id: 'years-service', text: 'Years of Service', required: false },
                    { id: 'retiring-rank', text: 'Retiring Rank', required: false },
                    { id: 'attend-reception', text: 'Will you attend the reception following the ceremony?', required: false },
                    { id: 'meal-choice', text: 'Meal Selection (if applicable)', required: false }
                ],
                askReason: false,
                allowGuests: true
            },
            changeOfCommand: {
                id: 'changeOfCommand',
                name: 'Change of Command',
                icon: '⚓',
                description: 'Transfer of leadership ceremony',
                defaultTitle: 'Change of Command Ceremony',
                defaultDescription: 'Join us for the formal transfer of authority and responsibility.',
                customQuestions: [
                    { id: 'outgoing-co', text: 'Outgoing Commander (Rank & Name)', required: false },
                    { id: 'incoming-co', text: 'Incoming Commander (Rank & Name)', required: false },
                    { id: 'reviewing-officer', text: 'Reviewing Officer', required: false },
                    { id: 'attend-reception', text: 'Will you attend the reception?', required: false }
                ],
                askReason: false,
                allowGuests: true
            },
            marineCorpsBall: {
                id: 'marineCorpsBall',
                name: 'Marine Corps Ball',
                icon: '🎉',
                description: 'Annual birthday celebration',
                defaultTitle: 'Marine Corps Birthday Ball',
                defaultDescription: 'Join us in celebrating the founding of the United States Marine Corps with tradition, camaraderie, and honor.',
                customQuestions: [
                    { id: 'meal-choice', text: 'Meal Selection', required: true },
                    { id: 'table-preference', text: 'Table/Seating Preference (if any)', required: false },
                    { id: 'special-needs', text: 'Special accommodation needs', required: false }
                ],
                askReason: false,
                allowGuests: true
            },
            diningIn: {
                id: 'diningIn',
                name: 'Dining In / Dining Out',
                icon: '🍽️',
                description: 'Formal military dining event',
                defaultTitle: 'Dining In',
                defaultDescription: 'You are cordially invited to attend our formal dining event, a time-honored military tradition.',
                customQuestions: [
                    { id: 'meal-choice', text: 'Meal Selection', required: true },
                    { id: 'dress-code', text: 'Dress Code Acknowledged (Dress Blues/Formal)', required: false },
                    { id: 'dietary-restrictions-detail', text: 'Detailed dietary requirements', required: false }
                ],
                askReason: false,
                allowGuests: true
            },
            formation: {
                id: 'formation',
                name: 'Unit Formation',
                icon: '📋',
                description: 'Regular unit gathering or inspection',
                defaultTitle: 'Unit Formation',
                defaultDescription: 'Mandatory unit formation. All personnel are required to attend unless on approved leave or TDY.',
                customQuestions: [
                    { id: 'absence-reason', text: 'If unable to attend, please state reason', required: false },
                    { id: 'alternate-contact', text: 'Alternate contact information', required: false }
                ],
                askReason: true,
                allowGuests: false
            },
            training: {
                id: 'training',
                name: 'Training Event',
                icon: '🎯',
                description: 'Professional development or skills training',
                defaultTitle: 'Training Event',
                defaultDescription: 'Professional military education and training session.',
                customQuestions: [
                    { id: 'training-level', text: 'Current skill level with topic', required: false },
                    { id: 'special-topics', text: 'Topics you\'d like covered', required: false },
                    { id: 'equipment-needed', text: 'Special equipment or materials needed', required: false }
                ],
                askReason: false,
                allowGuests: false
            },
            familyDay: {
                id: 'familyDay',
                name: 'Family Day',
                icon: '👨‍👩‍👧‍👦',
                description: 'Family-friendly unit event',
                defaultTitle: 'Family Day Event',
                defaultDescription: 'Bring your families to celebrate and build camaraderie outside of duty hours.',
                customQuestions: [
                    { id: 'total-attendees', text: 'Total number of family members attending', required: true },
                    { id: 'children-ages', text: 'Ages of children attending', required: false },
                    { id: 'activities-interest', text: 'Activities of interest', required: false }
                ],
                askReason: false,
                allowGuests: true
            },
            memorial: {
                id: 'memorial',
                name: 'Memorial Service',
                icon: '🕊️',
                description: 'Honor fallen Marines',
                defaultTitle: 'Memorial Service',
                defaultDescription: 'We gather to honor and remember those who made the ultimate sacrifice.',
                customQuestions: [
                    { id: 'relationship', text: 'Relationship to honoree (optional)', required: false },
                    { id: 'attend-reception', text: 'Will you attend the reception?', required: false },
                    { id: 'special-message', text: 'Message for the family (optional)', required: false }
                ],
                askReason: false,
                allowGuests: true
            },
            awards: {
                id: 'awards',
                name: 'Awards Ceremony',
                icon: '🏅',
                description: 'Recognize outstanding achievement',
                defaultTitle: 'Awards Ceremony',
                defaultDescription: 'Join us in recognizing Marines for their exceptional performance and dedication.',
                customQuestions: [
                    { id: 'award-recipient', text: 'Name of award recipient (if applicable)', required: false },
                    { id: 'guest-presenter', text: 'Are you presenting an award?', required: false }
                ],
                askReason: false,
                allowGuests: true
            }
        };
    }

    /**
     * Get all templates
     */
    getAllTemplates() {
        return Object.values(this.templates);
    }

    /**
     * Get template by ID
     */
    getTemplate(templateId) {
        return this.templates[templateId] || null;
    }

    /**
     * Apply template to event form
     */
    applyTemplate(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) {
            console.error('Template not found:', templateId);
            return false;
        }

        // Fill in form fields
        const titleInput = document.getElementById('event-title');
        const descInput = document.getElementById('event-description');
        const askReasonCheckbox = document.getElementById('ask-reason');
        const allowGuestsCheckbox = document.getElementById('allow-guests');

        if (titleInput) titleInput.value = template.defaultTitle;
        if (descInput) descInput.value = template.defaultDescription;
        if (askReasonCheckbox) askReasonCheckbox.checked = template.askReason;
        if (allowGuestsCheckbox) allowGuestsCheckbox.checked = template.allowGuests;

        // Clear existing custom questions
        const customQuestionsContainer = document.getElementById('custom-questions-container');
        if (customQuestionsContainer) {
            customQuestionsContainer.innerHTML = '';
        }

        // Add template custom questions
        if (template.customQuestions && template.customQuestions.length > 0) {
            // Add each question from the template
            template.customQuestions.forEach(question => {
                if (window.addCustomQuestion) {
                    window.addCustomQuestion(question.text);
                }
            });

            console.log(`✅ Added ${template.customQuestions.length} custom questions from template`);
        }

        showToast(`✅ Applied "${template.name}" template`, 'success');
        return true;
    }

    /**
     * Generate template selector HTML
     */
    generateTemplateSelectorHTML() {
        const templates = this.getAllTemplates();

        return `
            <div class="template-selector" style="margin: 1.5rem 0; padding: 1rem; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 0.5rem;">
                <div style="font-weight: 600; margin-bottom: 0.75rem; color: #1e40af;">
                    📋 Event Templates
                </div>
                <div style="font-size: 0.875rem; color: #4b5563; margin-bottom: 1rem;">
                    Choose a pre-built template to quickly set up your event:
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
                    ${templates.map(template => `
                        <button type="button"
                                class="template-card"
                                onclick="window.eventTemplates.applyTemplate('${template.id}')"
                                style="padding: 1rem; background: white; border: 2px solid #e5e7eb; border-radius: 0.5rem; text-align: left; cursor: pointer; transition: all 0.2s;"
                                onmouseover="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 4px 6px rgba(59, 130, 246, 0.1)'"
                                onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${template.icon}</div>
                            <div style="font-weight: 600; color: #1f2937; margin-bottom: 0.25rem;">${template.name}</div>
                            <div style="font-size: 0.75rem; color: #6b7280;">${template.description}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

// Initialize and make globally available
const eventTemplates = new EventTemplates();
window.eventTemplates = eventTemplates;
window.EventTemplates = EventTemplates;
