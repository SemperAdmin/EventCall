/**
 * EventCall CSV Guest List Import
 * Bulk import guests from spreadsheet
 */

class CSVImporter {
    constructor() {
        this.importData = null;
        this.validRows = [];
        this.errorRows = [];
        this.validRosterRows = [];
    }

    /**
     * Parse CSV file
     */
    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            if (!window.Papa) {
                reject(new Error('PapaParse library not loaded'));
                return;
            }

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    this.importData = results;
                    resolve(results);
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    /**
     * Validate CSV data
     */
    validateCSVData(data, eventId) {
        this.validRows = [];
        this.errorRows = [];

        data.data.forEach((row, index) => {
            const errors = [];

            // Required fields
            if (!row.Name || row.Name.trim() === '') {
                errors.push('Name is required');
            }

            if (!row.Email || !this.isValidEmail(row.Email)) {
                errors.push('Valid email is required');
            }

            if (row.Attending && !['Yes', 'No', 'yes', 'no', 'true', 'false', '1', '0'].includes(row.Attending)) {
                errors.push('Attending must be Yes/No');
            }

            // Optional fields validation
            if (row.Phone && row.Phone.trim() && !this.isValidPhone(row.Phone)) {
                errors.push('Invalid phone number format');
            }

            if (errors.length > 0) {
                this.errorRows.push({
                    row: index + 2, // +2 for header row and 0-index
                    data: row,
                    errors: errors
                });
            } else {
                // Convert to RSVP format
                const rsvpData = {
                    name: row.Name.trim(),
                    email: row.Email.trim(),
                    phone: row.Phone ? row.Phone.trim() : '',
                    attending: this.parseAttending(row.Attending),
                    rank: row.Rank || '',
                    unit: row.Unit || '',
                    branch: row.Branch || '',
                    dietaryRestrictions: row.DietaryRestrictions ? row.DietaryRestrictions.split(',').map(d => d.trim()) : [],
                    allergyDetails: row.AllergyDetails || '',
                    reason: row.Reason || '',
                    guestCount: parseInt(row.GuestCount || '0'),
                    eventId: eventId,
                    rsvpId: generateUUID(),
                    editToken: generateUUID(),
                    timestamp: Date.now(),
                    submissionMethod: 'csv_import',
                    userAgent: 'CSV Import'
                };

                this.validRows.push(rsvpData);
            }
        });

        return {
            valid: this.validRows.length,
            invalid: this.errorRows.length,
            total: data.data.length
        };
    }

    /**
     * Parse attending value
     */
    parseAttending(value) {
        if (!value) return true; // Default to attending
        const lowerValue = value.toString().toLowerCase();
        return ['yes', 'true', '1'].includes(lowerValue);
    }

    /**
     * Validate email
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Validate phone
     */
    isValidPhone(phone) {
        // Remove all non-digit characters and check length
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 15;
    }

    /**
     * Generate import preview HTML
     */
    generatePreviewHTML(stats) {
        return `
            <div style="padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="margin-bottom: 1.5rem; color: #1e40af;">📊 CSV Import Preview</h2>

                <!-- Statistics -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                    <div style="padding: 1rem; background: #dcfce7; border-radius: 0.5rem; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: #16a34a;">${stats.valid}</div>
                        <div style="font-size: 0.875rem; color: #15803d;">Valid Rows</div>
                    </div>
                    <div style="padding: 1rem; background: ${stats.invalid > 0 ? '#fef2f2' : '#f3f4f6'}; border-radius: 0.5rem; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: ${stats.invalid > 0 ? '#dc2626' : '#6b7280'};">${stats.invalid}</div>
                        <div style="font-size: 0.875rem; color: ${stats.invalid > 0 ? '#991b1b' : '#4b5563'};">Errors</div>
                    </div>
                    <div style="padding: 1rem; background: #f0f9ff; border-radius: 0.5rem; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: #0284c7;">${stats.total}</div>
                        <div style="font-size: 0.875rem; color: #075985;">Total Rows</div>
                    </div>
                </div>

                ${this.errorRows.length > 0 ? `
                    <div style="margin-bottom: 2rem; padding: 1rem; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 0.5rem;">
                        <strong style="color: #991b1b;">⚠️ Errors Found:</strong>
                        <div style="max-height: 200px; overflow-y: auto; margin-top: 0.75rem;">
                            ${this.errorRows.map(error => `
                                <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: white; border-radius: 0.5rem; font-size: 0.875rem;">
                                    <strong>Row ${error.row}:</strong> ${error.data.Name || 'Unnamed'} (${error.data.Email || 'No email'})<br>
                                    <span style="color: #dc2626;">${error.errors.join(', ')}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Valid Entries Preview -->
                <div style="margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;">Valid Entries (First 10)</h3>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                            <thead>
                                <tr style="background: #f3f4f6;">
                                    <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Name</th>
                                    <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
                                    <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Phone</th>
                                    <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid #e5e7eb;">Attending</th>
                                    <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Rank</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.validRows.slice(0, 10).map(row => `
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 0.75rem;">${row.name}</td>
                                        <td style="padding: 0.75rem;">${row.email}</td>
                                        <td style="padding: 0.75rem;">${row.phone || '-'}</td>
                                        <td style="padding: 0.75rem; text-align: center;">${row.attending ? '✅' : '❌'}</td>
                                        <td style="padding: 0.75rem;">${row.rank || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${this.validRows.length > 10 ? `
                            <div style="padding: 0.75rem; text-align: center; color: #6b7280; font-size: 0.875rem;">
                                ... and ${this.validRows.length - 10} more entries
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Actions -->
                <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                    ${stats.valid > 0 ? `
                        <button onclick="window.csvImporter.importGuests()" class="btn" style="background: #16a34a;">
                            ✅ Import ${stats.valid} Valid ${stats.valid === 1 ? 'Guest' : 'Guests'}
                        </button>
                    ` : ''}
                    <button onclick="window.csvImporter.cancelImport()" class="btn" style="background: #6b7280;">
                        ❌ Cancel
                    </button>
                </div>

                <!-- CSV Format Help -->
                <div style="margin-top: 2rem; padding: 1rem; background: #f0f9ff; border-radius: 0.5rem; font-size: 0.875rem;">
                    <strong>📋 CSV Format Requirements:</strong><br>
                    <div style="margin-top: 0.5rem; color: #4b5563;">
                        Required columns: <code>Name</code>, <code>Email</code><br>
                        Optional columns: <code>Phone</code>, <code>Attending</code> (Yes/No), <code>Rank</code>, <code>Unit</code>, <code>Branch</code>, <code>DietaryRestrictions</code>, <code>AllergyDetails</code>, <code>Reason</code>, <code>GuestCount</code>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Import guests to event
     */
    async importGuests() {
        if (this.validRows.length === 0) {
            showToast('❌ No valid guests to import', 'error');
            return;
        }

        showToast(`⏳ Importing ${this.validRows.length} guests...`, 'success');

        // Store in localStorage (in production, would submit to GitHub workflow)
        this.validRows.forEach(rsvpData => {
            const storageKey = `eventcall_pending_rsvps_${rsvpData.eventId}`;
            let pendingRSVPs = [];

            try {
                const existing = localStorage.getItem(storageKey);
                if (existing) {
                    pendingRSVPs = JSON.parse(existing);
                }
            } catch (e) {
                console.warn('Failed to load existing pending RSVPs:', e);
            }

            pendingRSVPs.push(rsvpData);

            try {
                localStorage.setItem(storageKey, JSON.stringify(pendingRSVPs));
            } catch (e) {
                console.error('Failed to save RSVP:', e);
            }
        });

        showToast(`✅ Successfully imported ${this.validRows.length} guests!`, 'success');

        // Redirect to manage page
        setTimeout(() => {
            if (window.showPage) {
                window.showPage('manage');
            }
        }, 2000);
    }

    /**
     * Cancel import
     */
    cancelImport() {
        this.importData = null;
        this.validRows = [];
        this.errorRows = [];

        showToast('Import cancelled', 'success');

        // Go back to create page
        if (window.showPage) {
            window.showPage('create');
        }
    }

    /**
     * Generate CSV import button HTML
     */
    generateImportButtonHTML() {
        return `
            <div style="margin: 1.5rem 0; padding: 1rem; background: #fffbeb; border-left: 4px solid #fbbf24; border-radius: 0.5rem;">
                <div style="font-weight: 600; margin-bottom: 0.5rem; color: #92400e;">
                    📥 Bulk Import Guests
                </div>
                <div style="font-size: 0.875rem; color: #78350f; margin-bottom: 1rem;">
                    Upload a CSV file to import multiple guests at once.
                </div>
                <input type="file"
                       id="csv-import-file"
                       accept=".csv"
                       style="display: none;"
                       onchange="window.csvImporter.handleFileUpload(event, '${eventId || ''}')">
                <button type="button"
                        class="btn"
                        onclick="document.getElementById('csv-import-file').click()"
                        style="background: #f59e0b;">
                    📤 Upload CSV File
                </button>
                <a href="#" onclick="window.csvImporter.downloadTemplate(); return false;" style="margin-left: 1rem; color: #0284c7; text-decoration: underline; font-size: 0.875rem;">
                    Download CSV Template
                </a>
            </div>
        `;
    }

    /**
     * Handle file upload
     */
    async handleFileUpload(event, eventId) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            showToast('⏳ Parsing CSV file...', 'success');

            const result = await this.parseCSV(file);
            const stats = this.validateCSVData(result, eventId);

            // Show preview
            const previewContainer = document.getElementById('csv-import-preview');
            if (previewContainer) {
                previewContainer.innerHTML = this.generatePreviewHTML(stats);
            }

            showToast(`✅ Found ${stats.valid} valid entries`, 'success');

        } catch (error) {
            console.error('CSV parsing failed:', error);
            showToast(`❌ Failed to parse CSV: ${error.message}`, 'error');
        }

        // Clear file input
        event.target.value = '';
    }

    /**
     * Download CSV template
     */
    downloadTemplate() {
        const template = `Name,Email,Phone,Attending,Rank,Unit,Branch,DietaryRestrictions,AllergyDetails,Reason,GuestCount
John Smith,john@example.com,555-0100,Yes,GySgt,2/1,USMC,vegetarian,,Celebration,2
Jane Doe,jane@example.com,555-0101,Yes,Capt,HQ,USMC,,"Peanut allergy",,0
Bob Johnson,bob@example.com,555-0102,No,,,Civilian,,,Personal conflict,0`;

        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'eventcall_guest_list_template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('📥 Template downloaded', 'success');
    }

    async handleRosterUpload(evt, eventId) {
        const file = evt.target.files[0];
        if (!file) return;
        try {
            showToast('⏳ Parsing roster CSV...', 'info');
            const result = await this.parseCSV(file);
            const stats = this.validateRosterCSV(result);
            const preview = document.getElementById('roster-import-preview');
            if (preview) {
                preview.innerHTML = this.generateRosterPreviewHTML(stats, eventId);
            }
            showToast(`✅ Roster: ${stats.valid} valid, ${stats.invalid} errors`, 'success');
        } catch (err) {
            console.error('Roster CSV parsing failed:', err);
            showToast(`❌ Failed to parse roster CSV: ${err.message}`, 'error');
        }
        evt.target.value = '';
    }

    validateRosterCSV(data) {
        this.validRosterRows = [];
        this.errorRows = [];
        data.data.forEach((row, idx) => {
            const errors = [];
            if (!row.Name || row.Name.trim() === '') errors.push('Name is required');
            if (!row.Email || !this.isValidEmail(row.Email)) errors.push('Valid email is required');
            if (errors.length) {
                this.errorRows.push({ row: idx + 2, data: row, errors });
            } else {
                this.validRosterRows.push({
                    name: row.Name.trim(),
                    email: row.Email.trim().toLowerCase(),
                    phone: row.Phone ? row.Phone.trim() : '',
                    expectedGuests: parseInt(row.GuestCount || '0')
                });
            }
        });
        return { valid: this.validRosterRows.length, invalid: this.errorRows.length, total: data.data.length };
    }

    generateRosterPreviewHTML(stats, eventId) {
        return `
            <div style="padding: 1rem; background: #1e293b; border-radius: 0.5rem; margin: 1rem 0;">
                <div style="color:#d4af37; font-weight:700; margin-bottom:0.5rem;">📋 Invite Roster Preview</div>
                <div style="color:#e2e8f0; font-size:0.9rem;">${stats.valid} valid • ${stats.invalid} errors • ${stats.total} total</div>
                ${stats.valid ? `<button class="btn-action" style="margin-top:0.75rem;" onclick="window.csvImporter.importRoster('${eventId}')">✅ Save ${stats.valid} to roster</button>` : ''}
            </div>
        `;
    }

    importRoster(eventId) {
        if (!this.validRosterRows.length) {
            showToast('❌ No valid roster entries to save', 'error');
            return;
        }
        const key = `eventcall_invite_roster_${eventId}`;
        try {
            localStorage.setItem(key, JSON.stringify(this.validRosterRows));
            showToast(`✅ Saved ${this.validRosterRows.length} invitees to roster`, 'success');
        } catch (e) {
            console.error('Failed to save roster:', e);
            showToast('❌ Failed to save roster', 'error');
            return;
        }
        const preview = document.getElementById('roster-import-preview');
        if (preview) preview.innerHTML = '';
    }
}

// Initialize and make globally available
const csvImporter = new CSVImporter();
window.csvImporter = csvImporter;
window.CSVImporter = CSVImporter;
