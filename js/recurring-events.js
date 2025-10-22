/**
 * EventCall Recurring Events Module
 * Create and manage recurring events
 */

class RecurringEvents {
    constructor() {
        this.frequencies = {
            daily: { label: 'Daily', days: 1 },
            weekly: { label: 'Weekly', days: 7 },
            biweekly: { label: 'Every 2 Weeks', days: 14 },
            monthly: { label: 'Monthly', days: 30 },
            quarterly: { label: 'Quarterly', days: 90 },
            yearly: { label: 'Yearly', days: 365 }
        };
    }

    /**
     * Generate recurring event form HTML
     */
    generateRecurringFormHTML() {
        return `
            <div class="form-group">
                <label>
                    <input type="checkbox" id="is-recurring" onchange="window.recurringEvents.toggleRecurringOptions()">
                    🔄 Make this a recurring event
                </label>
            </div>

            <div id="recurring-options" style="display: none; margin: 1rem 0; padding: 1rem; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 0.5rem;">
                <h4 style="margin-bottom: 1rem; color: #1e40af;">Recurrence Settings</h4>

                <div class="form-group">
                    <label for="recurrence-frequency">Frequency</label>
                    <select id="recurrence-frequency" style="min-height: 44px;">
                        <option value="">Select frequency...</option>
                        ${Object.entries(this.frequencies).map(([key, value]) => `
                            <option value="${key}">${value.label}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label for="recurrence-end-date">End Date (Optional)</label>
                    <input type="date" id="recurrence-end-date">
                    <small style="color: #6b7280; font-size: 0.875rem;">Leave blank for no end date</small>
                </div>

                <div class="form-group">
                    <label for="recurrence-count">Number of Occurrences (Optional)</label>
                    <input type="number" id="recurrence-count" min="2" max="52" placeholder="e.g., 12">
                    <small style="color: #6b7280; font-size: 0.875rem;">Maximum 52 occurrences</small>
                </div>

                <div style="margin-top: 1rem; padding: 0.75rem; background: #fffbeb; border-radius: 0.5rem; font-size: 0.875rem;">
                    <strong>📅 Note:</strong> The system will create instances of this event based on your recurrence settings. Each instance can be managed independently.
                </div>
            </div>
        `;
    }

    /**
     * Toggle recurring options visibility
     */
    toggleRecurringOptions() {
        const checkbox = document.getElementById('is-recurring');
        const options = document.getElementById('recurring-options');

        if (options) {
            options.style.display = checkbox && checkbox.checked ? 'block' : 'none';
        }
    }

    /**
     * Get recurrence data from form
     */
    getRecurrenceData() {
        const isRecurring = document.getElementById('is-recurring')?.checked;

        if (!isRecurring) {
            return null;
        }

        const frequency = document.getElementById('recurrence-frequency')?.value;
        const endDate = document.getElementById('recurrence-end-date')?.value;
        const count = document.getElementById('recurrence-count')?.value;

        if (!frequency) {
            return null;
        }

        return {
            frequency: frequency,
            endDate: endDate || null,
            count: count ? parseInt(count) : null,
            createdInstances: []
        };
    }

    /**
     * Generate recurring event instances
     */
    generateInstances(baseEvent, recurrence) {
        const instances = [];
        const baseDate = new Date(baseEvent.date);
        const frequencyDays = this.frequencies[recurrence.frequency].days;

        let currentDate = new Date(baseDate);
        let instanceCount = 0;
        const maxInstances = recurrence.count || 52; // Default max

        while (instanceCount < maxInstances) {
            // Move to next occurrence
            if (recurrence.frequency === 'monthly') {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else if (recurrence.frequency === 'quarterly') {
                currentDate.setMonth(currentDate.getMonth() + 3);
            } else if (recurrence.frequency === 'yearly') {
                currentDate.setFullYear(currentDate.getFullYear() + 1);
            } else {
                currentDate.setDate(currentDate.getDate() + frequencyDays);
            }

            // Check end date
            if (recurrence.endDate) {
                const endDate = new Date(recurrence.endDate);
                if (currentDate > endDate) {
                    break;
                }
            }

            // Create instance
            const instance = {
                ...baseEvent,
                id: generateUUID(),
                date: currentDate.toISOString().split('T')[0],
                parentEventId: baseEvent.id,
                isRecurringInstance: true,
                instanceNumber: instanceCount + 1,
                recurrence: null // Instances don't have recurrence settings
            };

            instances.push(instance);
            instanceCount++;

            // Safety limit
            if (instanceCount >= 52) {
                break;
            }
        }

        return instances;
    }

    /**
     * Save recurring event and instances
     */
    async saveRecurringEvent(baseEvent, recurrence) {
        // Generate instances
        const instances = this.generateInstances(baseEvent, recurrence);

        // Store parent event ID in recurrence
        baseEvent.recurrence.createdInstances = instances.map(i => i.id);

        // In production, would submit to GitHub workflow
        // For now, store in localStorage
        const allEvents = [baseEvent, ...instances];

        allEvents.forEach(event => {
            const storageKey = `event_${event.id}`;
            try {
                localStorage.setItem(storageKey, JSON.stringify(event));
            } catch (e) {
                console.error('Failed to save event:', e);
            }
        });

        return {
            success: true,
            baseEvent: baseEvent,
            instances: instances,
            message: `Created ${instances.length + 1} events (1 parent + ${instances.length} recurring instances)`
        };
    }

    /**
     * Generate recurring event badge HTML
     */
    generateRecurringBadgeHTML(event) {
        if (!event.recurrence && !event.isRecurringInstance) {
            return '';
        }

        if (event.recurrence) {
            const frequency = this.frequencies[event.recurrence.frequency];
            return `
                <span style="display: inline-block; padding: 0.25rem 0.5rem; background: #dbeafe; color: #1e40af; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem;">
                    🔄 ${frequency ? frequency.label : 'Recurring'}
                </span>
            `;
        }

        if (event.isRecurringInstance) {
            return `
                <span style="display: inline-block; padding: 0.25rem 0.5rem; background: #e0e7ff; color: #4f46e5; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem;">
                    🔗 Instance #${event.instanceNumber || '?'}
                </span>
            `;
        }

        return '';
    }

    /**
     * Get all instances of a recurring event
     */
    getEventInstances(parentEventId) {
        const instances = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('event_')) {
                try {
                    const event = JSON.parse(localStorage.getItem(key));
                    if (event.parentEventId === parentEventId) {
                        instances.push(event);
                    }
                } catch (e) {
                    console.error('Error parsing event:', e);
                }
            }
        }

        // Sort by date
        instances.sort((a, b) => new Date(a.date) - new Date(b.date));

        return instances;
    }

    /**
     * Update all future instances of a recurring event
     */
    async updateFutureInstances(parentEventId, updates) {
        const instances = this.getEventInstances(parentEventId);
        const now = new Date();

        const futureInstances = instances.filter(instance => {
            const instanceDate = new Date(instance.date);
            return instanceDate >= now;
        });

        futureInstances.forEach(instance => {
            // Apply updates (excluding date and id)
            Object.keys(updates).forEach(key => {
                if (key !== 'id' && key !== 'date' && key !== 'parentEventId' && key !== 'instanceNumber') {
                    instance[key] = updates[key];
                }
            });

            // Save updated instance
            const storageKey = `event_${instance.id}`;
            try {
                localStorage.setItem(storageKey, JSON.stringify(instance));
            } catch (e) {
                console.error('Failed to update instance:', e);
            }
        });

        return {
            success: true,
            updated: futureInstances.length
        };
    }

    /**
     * Delete all instances of a recurring event
     */
    async deleteAllInstances(parentEventId) {
        const instances = this.getEventInstances(parentEventId);

        instances.forEach(instance => {
            const storageKey = `event_${instance.id}`;
            localStorage.removeItem(storageKey);
        });

        // Also delete parent event
        localStorage.removeItem(`event_${parentEventId}`);

        return {
            success: true,
            deleted: instances.length + 1
        };
    }
}

// Initialize and make globally available
const recurringEvents = new RecurringEvents();
window.recurringEvents = recurringEvents;
window.RecurringEvents = RecurringEvents;
