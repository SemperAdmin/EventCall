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
                eventFields: [
                    { id: 'honoree-name', label: 'Honoree Name', placeholder: 'e.g., Cpl John Smith', required: true },
                    { id: 'current-rank', label: 'Current Rank', placeholder: 'e.g., Corporal', required: false },
                    { id: 'new-rank', label: 'New Rank', placeholder: 'e.g., Sergeant', required: false },
                    { id: 'promoter-name', label: 'Promoted By', placeholder: 'e.g., Col Johnson', required: false }
                ],
                askReason: false,
                allowGuests: true,
                requiresMealChoice: false
            },
            retirement: {
                id: 'retirement',
                name: 'Retirement Ceremony',
                icon: '🎖️',
                description: 'Honor a Marine\'s dedicated service',
                defaultTitle: 'Retirement Ceremony',
                defaultDescription: 'Please join us in honoring the distinguished career and dedicated service of a fellow Marine.',
                eventFields: [
                    { id: 'retiree-name', label: 'Retiree Name', placeholder: 'e.g., MSgt Jane Doe', required: true },
                    { id: 'years-service', label: 'Years of Service', placeholder: 'e.g., 22 years', required: false },
                    { id: 'retiring-rank', label: 'Retiring Rank', placeholder: 'e.g., Master Sergeant', required: false },
                    { id: 'reception-location', label: 'Reception Location', placeholder: 'e.g., Officers Club', required: false }
                ],
                askReason: false,
                allowGuests: true,
                requiresMealChoice: true
            },
            changeOfCommand: {
                id: 'changeOfCommand',
                name: 'Change of Command',
                icon: '⚓',
                description: 'Transfer of leadership ceremony',
                defaultTitle: 'Change of Command Ceremony',
                defaultDescription: 'Join us for the formal transfer of authority and responsibility.',
                eventFields: [
                    { id: 'outgoing-co', label: 'Outgoing Commander', placeholder: 'e.g., LtCol Smith', required: true },
                    { id: 'incoming-co', label: 'Incoming Commander', placeholder: 'e.g., LtCol Williams', required: true },
                    { id: 'reviewing-officer', label: 'Reviewing Officer', placeholder: 'e.g., Col Davis', required: false },
                    { id: 'unit-designation', label: 'Unit', placeholder: 'e.g., 2nd Battalion, 1st Marines', required: false }
                ],
                askReason: false,
                allowGuests: true,
                requiresMealChoice: true
            },
            marineCorpsBall: {
                id: 'marineCorpsBall',
                name: 'Marine Corps Ball',
                icon: '🎉',
                description: 'Annual birthday celebration',
                defaultTitle: 'Marine Corps Birthday Ball',
                defaultDescription: 'Join us in celebrating the founding of the United States Marine Corps with tradition, camaraderie, and honor.',
                eventFields: [
                    { id: 'ball-year', label: 'Birthday Year', placeholder: 'e.g., 249th Birthday', required: false },
                    { id: 'venue', label: 'Venue', placeholder: 'e.g., Grand Ballroom', required: false },
                    { id: 'dress-code', label: 'Dress Code', placeholder: 'e.g., Dress Blues', required: false },
                    { id: 'ticket-price', label: 'Ticket Price', placeholder: 'e.g., $75 per person', required: false }
                ],
                askReason: false,
                allowGuests: true,
                requiresMealChoice: true
            },
            diningIn: {
                id: 'diningIn',
                name: 'Dining In / Dining Out',
                icon: '🍽️',
                description: 'Formal military dining event',
                defaultTitle: 'Dining In',
                defaultDescription: 'You are cordially invited to attend our formal dining event, a time-honored military tradition.',
                eventFields: [
                    { id: 'event-type', label: 'Event Type', placeholder: 'e.g., Dining In (members only)', required: false },
                    { id: 'dress-code', label: 'Dress Code', placeholder: 'e.g., Dress Blues / Formal Attire', required: false },
                    { id: 'guest-speaker', label: 'Guest Speaker', placeholder: 'e.g., Gen Martinez', required: false },
                    { id: 'cost-per-person', label: 'Cost Per Person', placeholder: 'e.g., $50', required: false }
                ],
                askReason: false,
                allowGuests: true,
                requiresMealChoice: true
            },
            formation: {
                id: 'formation',
                name: 'Unit Formation',
                icon: '📋',
                description: 'Regular unit gathering or inspection',
                defaultTitle: 'Unit Formation',
                defaultDescription: 'Mandatory unit formation. All personnel are required to attend unless on approved leave or TDY.',
                eventFields: [
                    { id: 'formation-type', label: 'Formation Type', placeholder: 'e.g., Company Formation', required: false },
                    { id: 'uniform', label: 'Uniform', placeholder: 'e.g., Cammies / Service Charlies', required: false },
                    { id: 'reporting-senior', label: 'Reporting Senior', placeholder: 'e.g., 1stSgt Brown', required: false }
                ],
                askReason: true,
                allowGuests: false,
                requiresMealChoice: false
            },
            training: {
                id: 'training',
                name: 'Training Event',
                icon: '🎯',
                description: 'Professional development or skills training',
                defaultTitle: 'Training Event',
                defaultDescription: 'Professional military education and training session.',
                eventFields: [
                    { id: 'training-topic', label: 'Training Topic', placeholder: 'e.g., Combat First Aid', required: true },
                    { id: 'instructor', label: 'Instructor', placeholder: 'e.g., SSgt Martinez', required: false },
                    { id: 'prerequisites', label: 'Prerequisites', placeholder: 'e.g., Basic Combat Training', required: false },
                    { id: 'equipment-bring', label: 'Equipment to Bring', placeholder: 'e.g., Notebook, pen', required: false }
                ],
                askReason: false,
                allowGuests: false,
                requiresMealChoice: false
            },
            familyDay: {
                id: 'familyDay',
                name: 'Family Day',
                icon: '👨‍👩‍👧‍👦',
                description: 'Family-friendly unit event',
                defaultTitle: 'Family Day Event',
                defaultDescription: 'Bring your families to celebrate and build camaraderie outside of duty hours.',
                eventFields: [
                    { id: 'activities-available', label: 'Activities', placeholder: 'e.g., BBQ, Games, Bounce Houses', required: false },
                    { id: 'food-provided', label: 'Food/Beverages', placeholder: 'e.g., BBQ lunch provided', required: false },
                    { id: 'parking-info', label: 'Parking', placeholder: 'e.g., Main lot open', required: false }
                ],
                askReason: false,
                allowGuests: true,
                requiresMealChoice: true
            },
            memorial: {
                id: 'memorial',
                name: 'Memorial Service',
                icon: '🕊️',
                description: 'Honor fallen Marines',
                defaultTitle: 'Memorial Service',
                defaultDescription: 'We gather to honor and remember those who made the ultimate sacrifice.',
                eventFields: [
                    { id: 'honoree-name', label: 'In Memory Of', placeholder: 'e.g., Sgt Robert Johnson', required: true },
                    { id: 'service-dates', label: 'Service Dates', placeholder: 'e.g., 2010 - 2024', required: false },
                    { id: 'chaplain', label: 'Officiant', placeholder: 'e.g., Chaplain Smith', required: false },
                    { id: 'reception-info', label: 'Reception Details', placeholder: 'e.g., Location and time', required: false }
                ],
                askReason: false,
                allowGuests: true,
                requiresMealChoice: true
            },
            awards: {
                id: 'awards',
                name: 'Awards Ceremony',
                icon: '🏅',
                description: 'Recognize outstanding achievement',
                defaultTitle: 'Awards Ceremony',
                defaultDescription: 'Join us in recognizing Marines for their exceptional performance and dedication.',
                eventFields: [
                    { id: 'award-type', label: 'Award(s) Presented', placeholder: 'e.g., Navy Achievement Medal', required: false },
                    { id: 'recipient-names', label: 'Recipients', placeholder: 'e.g., Cpl Smith, LCpl Jones', required: false },
                    { id: 'presenting-officer', label: 'Presenting Officer', placeholder: 'e.g., CO, Col Davis', required: false }
                ],
                askReason: false,
                allowGuests: true,
                requiresMealChoice: false
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
        const requiresMealCheckbox = document.getElementById('requires-meal-choice');

        if (titleInput) titleInput.value = template.defaultTitle;
        if (descInput) descInput.value = template.defaultDescription;
        if (askReasonCheckbox) askReasonCheckbox.checked = template.askReason;
        if (allowGuestsCheckbox) allowGuestsCheckbox.checked = template.allowGuests;
        if (requiresMealCheckbox) requiresMealCheckbox.checked = template.requiresMealChoice || false;

        // Clear and populate event details fields
        const eventDetailsContainer = document.getElementById('event-details-container');
        if (eventDetailsContainer && template.eventFields && template.eventFields.length > 0) {
            eventDetailsContainer.innerHTML = '';

            template.eventFields.forEach(field => {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'form-group';
                fieldDiv.innerHTML = window.utils.sanitizeHTML(`
                    <label for="event-detail-${window.utils.escapeHTML(field.id)}">
                        ${window.utils.escapeHTML(field.label)}${field.required ? ' *' : ''}
                    </label>
                    <input
                        type="text"
                        id="event-detail-${window.utils.escapeHTML(field.id)}"
                        name="${window.utils.escapeHTML(field.id)}"
                        placeholder="${window.utils.escapeHTML(field.placeholder || '')}"
                        ${field.required ? 'required' : ''}
                        class="event-detail-field"
                        data-field-id="${window.utils.escapeHTML(field.id)}"
                        data-field-label="${window.utils.escapeHTML(field.label)}"
                    >
                `);
                eventDetailsContainer.appendChild(fieldDiv);
            });

            // Show the event details section
            const eventDetailsSection = document.getElementById('event-details-section');
            if (eventDetailsSection) {
                eventDetailsSection.classList.remove('hidden');
                eventDetailsSection.style.display = 'block';
            }

            console.log(`✅ Added ${template.eventFields.length} event detail fields from template`);
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
