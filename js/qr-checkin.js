/**
 * EventCall QR Code Check-in System
 * Generate QR codes for RSVPs and manage check-in process
 */

class QRCheckIn {
    constructor() {
        this.checkInTokens = new Map();
    }

    /**
     * Generate unique check-in token for RSVP
     */
    generateCheckInToken(rsvpId) {
        const token = generateUUID();
        this.checkInTokens.set(rsvpId, token);
        return token;
    }

    /**
     * Generate QR code data URL for RSVP
     */
    async generateQRCode(eventId, rsvpId, checkInToken) {
        if (!window.QRCode) {
            console.error('QRCode library not loaded');
            return null;
        }

        const qrData = JSON.stringify({
            type: 'eventcall-checkin',
            eventId: eventId,
            rsvpId: rsvpId,
            token: checkInToken,
            timestamp: Date.now()
        });

        try {
            const dataURL = await QRCode.toDataURL(qrData, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#0f1419',
                    light: '#ffffff'
                }
            });
            return dataURL;
        } catch (error) {
            console.error('QR Code generation failed:', error);
            return null;
        }
    }

    /**
     * Generate QR code HTML for RSVP confirmation page
     */
    async generateQRCodeHTML(eventId, rsvpId, checkInToken, rsvpData) {
        const qrDataURL = await this.generateQRCode(eventId, rsvpId, checkInToken);

        if (!qrDataURL) {
            return '';
        }

        return `
            <div style="margin: 2rem 0; padding: 1.5rem; background: white; border: 2px solid #3b82f6; border-radius: 1rem; text-align: center;">
                <div style="font-weight: 700; font-size: 1.25rem; color: #1e40af; margin-bottom: 1rem;">
                    📱 Mobile Check-In QR Code
                </div>
                <div style="margin: 1.5rem 0;">
                    <img src="${qrDataURL}" alt="Check-in QR Code" style="max-width: 250px; height: auto; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                </div>
                <div style="font-size: 0.875rem; color: #4b5563; margin-top: 1rem; line-height: 1.6;">
                    <strong>📍 For Event Day:</strong><br>
                    Save or screenshot this QR code and present it at check-in.<br>
                    Event organizers will scan it for fast entry.
                </div>
                <div style="margin-top: 1rem; padding: 0.75rem; background: #f0f9ff; border-radius: 0.5rem; font-size: 0.75rem; color: #1e40af;">
                    <strong>Check-in ID:</strong> <code style="background: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">${checkInToken.substring(0, 8)}</code>
                </div>
            </div>
        `;
    }

    /**
     * Scan and validate QR code
     */
    async validateCheckIn(qrData) {
        try {
            const data = JSON.parse(qrData);

            if (data.type !== 'eventcall-checkin') {
                return { valid: false, error: 'Invalid QR code type' };
            }

            // Validate timestamp (QR code should be from within last 24 hours for security)
            const ageInHours = (Date.now() - data.timestamp) / (1000 * 60 * 60);
            if (ageInHours > 48) {
                return { valid: false, error: 'QR code expired (older than 48 hours)' };
            }

            return {
                valid: true,
                eventId: data.eventId,
                rsvpId: data.rsvpId,
                token: data.token
            };
        } catch (error) {
            return { valid: false, error: 'Invalid QR code format' };
        }
    }

    /**
     * Mark RSVP as checked in
     */
    async checkInRSVP(eventId, rsvpId, checkInToken) {
        // In production, this would call a GitHub workflow
        // For now, store in secure session storage (fallback to localStorage)
        const checkInKey = `checkin_${eventId}_${rsvpId}`;
        const checkInData = {
            rsvpId: rsvpId,
            eventId: eventId,
            checkInToken: checkInToken,
            checkInTime: Date.now(),
            checkedInBy: 'manual'
        };

        try {
            const storageSync = window.utils && window.utils.secureStorageSync;
            if (storageSync) {
                storageSync.set(checkInKey, checkInData, { ttl: 4 * 60 * 60 * 1000 });
            } else {
                localStorage.setItem(checkInKey, JSON.stringify(checkInData));
            }
            return { success: true, checkInData };
        } catch (error) {
            console.error('Check-in failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get check-in status for RSVP
     */
    getCheckInStatus(eventId, rsvpId) {
        const checkInKey = `checkin_${eventId}_${rsvpId}`;
        try {
            const storageSync = window.utils && window.utils.secureStorageSync;
            if (storageSync) {
                const rec = storageSync.get(checkInKey);
                if (rec) return rec;
            } else {
                const data = localStorage.getItem(checkInKey);
                if (data) return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error reading check-in status:', error);
        }
        return null;
    }

    /**
     * Get all check-ins for an event
     */
    getAllCheckIns(eventId) {
        const checkIns = [];
        const prefix = `checkin_${eventId}_`;
        const storageSync = window.utils && window.utils.secureStorageSync;
        if (storageSync) {
            try {
                const keys = storageSync.keys(prefix);
                keys.forEach(k => {
                    const data = storageSync.get(k);
                    if (data) checkIns.push(data);
                });
            } catch (e) {
                console.error('Error reading secure check-ins:', e);
            }
        } else {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        checkIns.push(data);
                    } catch (error) {
                        console.error('Error parsing check-in data:', error);
                    }
                }
            }
        }
        return checkIns;
    }

    /**
     * Generate check-in interface HTML for managers
     */
    generateCheckInInterfaceHTML(eventId) {
        return `
            <div class="check-in-interface" style="padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #1e40af; margin-bottom: 1.5rem;">📱 Event Check-In</h2>

                <!-- Manual Check-in -->
                <div style="margin-bottom: 2rem; padding: 1.5rem; background: #f0f9ff; border-radius: 0.5rem;">
                    <h3 style="margin-bottom: 1rem;">Manual Check-In</h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <input type="text"
                               id="manual-checkin-id"
                               placeholder="Enter RSVP ID or Check-in Token..."
                               style="flex: 1; min-width: 200px; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; font-size: 1rem;">
                        <button onclick="window.qrCheckIn.manualCheckIn('${eventId}')"
                                class="btn"
                                style="padding: 0.75rem 1.5rem;">
                            ✅ Check In
                        </button>
                    </div>
                </div>

                <!-- Check-in Statistics -->
                <div id="checkin-stats-${eventId}" style="margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;">Check-In Statistics</h3>
                    <div id="checkin-stats-content-${eventId}" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                        <!-- Stats will be populated here -->
                    </div>
                </div>

                <!-- Recent Check-Ins -->
                <div id="recent-checkins-${eventId}">
                    <h3 style="margin-bottom: 1rem;">Recent Check-Ins</h3>
                    <div id="recent-checkins-list-${eventId}" style="max-height: 400px; overflow-y: auto;">
                        <!-- Recent check-ins will be populated here -->
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Manual check-in by ID
     */
    async manualCheckIn(eventId) {
        const input = document.getElementById('manual-checkin-id');
        if (!input || !input.value.trim()) {
            showToast('❌ Please enter an RSVP ID or check-in token', 'error');
            return;
        }

        const identifier = input.value.trim();

        // Try to find RSVP in local storage
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            showToast('❌ Event not found', 'error');
            return;
        }

        // Check if already checked in
        const existingCheckIn = this.getCheckInStatus(eventId, identifier);
        if (existingCheckIn) {
            const checkInTime = new Date(existingCheckIn.checkInTime).toLocaleTimeString();
            showToast(`⚠️ Already checked in at ${checkInTime}`, 'error');
            return;
        }

        // Perform check-in
        const result = await this.checkInRSVP(eventId, identifier, identifier);

        if (result.success) {
            showToast('✅ Check-in successful!', 'success');
            input.value = '';
            this.refreshCheckInStats(eventId);
        } else {
            showToast(`❌ Check-in failed: ${result.error}`, 'error');
        }
    }

    /**
     * Refresh check-in statistics
     */
    refreshCheckInStats(eventId) {
        const checkIns = this.getAllCheckIns(eventId);
        const statsContainer = document.getElementById(`checkin-stats-content-${eventId}`);
        const recentContainer = document.getElementById(`recent-checkins-list-${eventId}`);

        if (statsContainer) {
            statsContainer.innerHTML = window.utils.sanitizeHTML(`
                <div style="padding: 1rem; background: #dcfce7; border-radius: 0.5rem; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #16a34a;">${window.utils.escapeHTML(String(checkIns.length))}</div>
                    <div style="font-size: 0.875rem; color: #15803d;">Checked In</div>
                </div>
            `);
        }

        if (recentContainer) {
            if (checkIns.length === 0) {
                recentContainer.innerHTML = window.utils.sanitizeHTML(`
                    <div style="padding: 2rem; text-align: center; color: #6b7280;">
                        No check-ins yet
                    </div>
                `);
            } else {
                recentContainer.innerHTML = window.utils.sanitizeHTML(checkIns.reverse().slice(0, 10).map(checkIn => `
                    <div style="padding: 1rem; margin-bottom: 0.5rem; background: #f9fafb; border-left: 4px solid #10b981; border-radius: 0.5rem;">
                        <div style="font-weight: 600;">RSVP ID: ${window.utils.escapeHTML(checkIn.rsvpId.substring(0, 8))}...</div>
                        <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">
                            ✅ ${new Date(checkIn.checkInTime).toLocaleString()}
                        </div>
                    </div>
                `).join(''));
            }
        }
    }
}

// Initialize and make globally available
const qrCheckIn = new QRCheckIn();
window.qrCheckIn = qrCheckIn;
window.QRCheckIn = QRCheckIn;
