/**
 * EventCall Seating Chart Management
 * Phase 1: Simple Table Numbers Only
 * Handles table assignment for event attendees
 */

// VIP ranks for auto-assignment priority (military officer ranks)
const VIP_RANKS = ['Gen', 'LtGen', 'MGen', 'BGen', 'Col', 'LtCol', 'Maj'];

class SeatingChart {
    constructor(eventId) {
        this.eventId = eventId;
        this.seatingData = null;
    }

    /**
     * Initialize seating chart for an event
     * @param {number} numberOfTables - Total number of tables
     * @param {number} seatsPerTable - Capacity per table
     * @returns {Object} Initial seating data structure
     */
    initializeSeatingChart(numberOfTables, seatsPerTable) {
        const tables = [];

        for (let i = 1; i <= numberOfTables; i++) {
            tables.push({
                tableNumber: i,
                capacity: seatsPerTable,
                assignedGuests: [],
                vipTable: i === 1 // Table 1 is VIP/head table by default
            });
        }

        this.seatingData = {
            enabled: true,
            numberOfTables: numberOfTables,
            seatsPerTable: seatsPerTable,
            totalCapacity: numberOfTables * seatsPerTable,
            tables: tables,
            unassignedGuests: [],
            lastModified: Date.now()
        };

        return this.seatingData;
    }

    /**
     * Load seating data for an event
     * @param {Object} event - Event object
     * @returns {Object} Seating data
     */
    loadSeatingData(event) {
        if (event.seatingChart && event.seatingChart.enabled) {
            this.seatingData = event.seatingChart;
            return this.seatingData;
        }
        return null;
    }

    /**
     * Assign a guest to a table
     * @param {string} rsvpId - RSVP ID
     * @param {number} tableNumber - Table number to assign
     * @param {Object} guestInfo - Guest information (name, attending, guestCount)
     * @returns {Object} Result with success status and message
     */
    assignGuestToTable(rsvpId, tableNumber, guestInfo) {
        if (!this.seatingData) {
            return { success: false, message: 'Seating chart not initialized' };
        }

        const table = this.seatingData.tables.find(t => t.tableNumber === tableNumber);
        if (!table) {
            return { success: false, message: 'Table not found' };
        }

        // Check if guest is already assigned
        const currentAssignment = this.findGuestAssignment(rsvpId);
        if (currentAssignment) {
            // Remove from current table
            this.unassignGuest(rsvpId);
        }

        // Check capacity (include guest count for +1s)
        const guestCount = (guestInfo.guestCount || 0) + 1; // Primary guest + additional guests
        const currentOccupancy = this.getTableOccupancy(tableNumber);

        if (currentOccupancy + guestCount > table.capacity) {
            return {
                success: false,
                message: `Not enough space at Table ${tableNumber}. Available: ${table.capacity - currentOccupancy}, Needed: ${guestCount}`
            };
        }

        // Add guest to table
        table.assignedGuests.push({
            rsvpId: rsvpId,
            name: guestInfo.name,
            guestCount: guestInfo.guestCount || 0,
            assignedAt: Date.now()
        });

        // Remove from unassigned list if present
        this.seatingData.unassignedGuests = this.seatingData.unassignedGuests.filter(
            id => id !== rsvpId
        );

        this.seatingData.lastModified = Date.now();

        return {
            success: true,
            message: `${guestInfo.name} assigned to Table ${tableNumber}`
        };
    }

    /**
     * Unassign a guest from their current table
     * @param {string} rsvpId - RSVP ID
     * @returns {boolean} Success status
     */
    unassignGuest(rsvpId) {
        if (!this.seatingData) return false;

        let found = false;
        for (const table of this.seatingData.tables) {
            const index = table.assignedGuests.findIndex(g => g.rsvpId === rsvpId);
            if (index !== -1) {
                table.assignedGuests.splice(index, 1);
                found = true;
                break; // Exit loop once guest is found
            }
        }

        if (found) {
            // Add to unassigned list if not already there
            if (!this.seatingData.unassignedGuests.includes(rsvpId)) {
                this.seatingData.unassignedGuests.push(rsvpId);
            }
            this.seatingData.lastModified = Date.now();
        }

        return found;
    }

    /**
     * Find which table a guest is assigned to
     * @param {string} rsvpId - RSVP ID
     * @returns {Object|null} Table assignment info or null
     */
    findGuestAssignment(rsvpId) {
        if (!this.seatingData) return null;

        for (const table of this.seatingData.tables) {
            const guest = table.assignedGuests.find(g => g.rsvpId === rsvpId);
            if (guest) {
                return {
                    tableNumber: table.tableNumber,
                    guest: guest,
                    vipTable: table.vipTable
                };
            }
        }
        return null;
    }

    /**
     * Get current occupancy of a table (including guest counts)
     * @param {number} tableNumber - Table number
     * @returns {number} Total occupancy
     */
    getTableOccupancy(tableNumber) {
        if (!this.seatingData) return 0;

        const table = this.seatingData.tables.find(t => t.tableNumber === tableNumber);
        if (!table) return 0;

        return table.assignedGuests.reduce((total, guest) => {
            return total + 1 + (guest.guestCount || 0);
        }, 0);
    }

    /**
     * Get statistics about seating assignments
     * @returns {Object} Seating statistics
     */
    getSeatingStats() {
        if (!this.seatingData) {
            return { totalSeats: 0, assigned: 0, unassigned: 0, percentFilled: 0 };
        }

        let totalAssigned = 0;
        this.seatingData.tables.forEach(table => {
            totalAssigned += this.getTableOccupancy(table.tableNumber);
        });

        return {
            totalSeats: this.seatingData.totalCapacity,
            assigned: totalAssigned,
            unassigned: this.seatingData.unassignedGuests.length,
            available: this.seatingData.totalCapacity - totalAssigned,
            percentFilled: this.seatingData.totalCapacity > 0
                ? ((totalAssigned / this.seatingData.totalCapacity) * 100).toFixed(1)
                : 0,
            tableCount: this.seatingData.numberOfTables
        };
    }

    /**
     * Sync unassigned guests with RSVP list
     * @param {Array} rsvps - Array of RSVP responses (attending only)
     */
    syncUnassignedGuests(rsvps) {
        if (!this.seatingData) return;

        const attendingRsvps = rsvps.filter(r => r.attending === true || r.attending === 'true');
        const assignedRsvpIds = new Set();

        // Collect all assigned RSVP IDs
        this.seatingData.tables.forEach(table => {
            table.assignedGuests.forEach(guest => {
                assignedRsvpIds.add(guest.rsvpId);
            });
        });

        // Update unassigned list
        this.seatingData.unassignedGuests = attendingRsvps
            .filter(rsvp => !assignedRsvpIds.has(rsvp.rsvpId))
            .map(rsvp => rsvp.rsvpId);
    }

    /**
     * Auto-assign guests to tables (simple fill strategy)
     * @param {Array} rsvps - Array of RSVP responses to assign
     * @returns {Object} Result with assignment summary
     */
    autoAssignGuests(rsvps) {
        if (!this.seatingData) {
            return { success: false, message: 'Seating chart not initialized', assigned: 0 };
        }

        let assignedCount = 0;
        let failedAssignments = [];

        // Sort RSVPs: VIPs first, then by guest count (smaller groups first for better packing)
        const sortedRsvps = [...rsvps].sort((a, b) => {
            // VIP check using defined VIP ranks
            const aIsVip = a.rank && VIP_RANKS.includes(a.rank);
            const bIsVip = b.rank && VIP_RANKS.includes(b.rank);

            if (aIsVip && !bIsVip) return -1;
            if (!aIsVip && bIsVip) return 1;

            return (a.guestCount || 0) - (b.guestCount || 0);
        });

        // Assign to tables
        for (const rsvp of sortedRsvps) {
            let assigned = false;

            // Try to find a table with enough space
            for (const table of this.seatingData.tables) {
                const guestCount = 1 + (rsvp.guestCount || 0);
                const available = table.capacity - this.getTableOccupancy(table.tableNumber);

                if (available >= guestCount) {
                    const result = this.assignGuestToTable(rsvp.rsvpId, table.tableNumber, {
                        name: rsvp.name,
                        guestCount: rsvp.guestCount || 0
                    });

                    if (result.success) {
                        assignedCount++;
                        assigned = true;
                        break;
                    }
                }
            }

            if (!assigned) {
                failedAssignments.push(rsvp.name);
            }
        }

        return {
            success: true,
            assigned: assignedCount,
            failed: failedAssignments.length,
            failedNames: failedAssignments,
            message: `Auto-assigned ${assignedCount} guests. ${failedAssignments.length} could not be assigned due to capacity.`
        };
    }

    /**
     * Update table capacity
     * @param {number} tableNumber - Table number
     * @param {number} newCapacity - New capacity
     * @returns {Object} Result
     */
    updateTableCapacity(tableNumber, newCapacity) {
        if (!this.seatingData) {
            return { success: false, message: 'Seating chart not initialized' };
        }

        const table = this.seatingData.tables.find(t => t.tableNumber === tableNumber);
        if (!table) {
            return { success: false, message: 'Table not found' };
        }

        const currentOccupancy = this.getTableOccupancy(tableNumber);
        if (newCapacity < currentOccupancy) {
            return {
                success: false,
                message: `Cannot reduce capacity below current occupancy (${currentOccupancy})`
            };
        }

        table.capacity = newCapacity;
        this.seatingData.totalCapacity = this.seatingData.tables.reduce((total, t) => total + t.capacity, 0);
        this.seatingData.lastModified = Date.now();

        return { success: true, message: `Table ${tableNumber} capacity updated to ${newCapacity}` };
    }

    /**
     * Generate CSV export of seating chart
     * @param {Array} rsvps - All RSVPs for name lookup
     * @returns {string} CSV content
     */
    generateSeatingCSV(rsvps) {
        if (!this.seatingData) return '';

        const rsvpMap = new Map(rsvps.map(r => [r.rsvpId, r]));
        let csv = 'Table Number,Guest Name,Email,Rank,Unit,Guest Count,Total at Table,Dietary Restrictions,Allergies\n';

        this.seatingData.tables.forEach(table => {
            table.assignedGuests.forEach(guest => {
                const rsvp = rsvpMap.get(guest.rsvpId);
                if (rsvp) {
                    // Format dietary restrictions
                    const dietary = rsvp.dietaryRestrictions && rsvp.dietaryRestrictions.length
                        ? rsvp.dietaryRestrictions.join('; ')
                        : '';

                    // Get allergy details
                    const allergies = rsvp.allergyDetails || '';

                    csv += `${table.tableNumber},"${rsvp.name}","${rsvp.email || ''}","${rsvp.rank || ''}","${rsvp.unit || ''}",${guest.guestCount || 0},${1 + (guest.guestCount || 0)},"${dietary}","${allergies}"\n`;
                }
            });
        });

        // Add unassigned guests
        if (this.seatingData.unassignedGuests.length > 0) {
            csv += '\nUnassigned Guests\n';
            csv += 'Guest Name,Email,Rank,Unit,Guest Count,Dietary Restrictions,Allergies\n';
            this.seatingData.unassignedGuests.forEach(rsvpId => {
                const rsvp = rsvpMap.get(rsvpId);
                if (rsvp) {
                    // Format dietary restrictions
                    const dietary = rsvp.dietaryRestrictions && rsvp.dietaryRestrictions.length
                        ? rsvp.dietaryRestrictions.join('; ')
                        : '';

                    // Get allergy details
                    const allergies = rsvp.allergyDetails || '';

                    csv += `"${rsvp.name}","${rsvp.email || ''}","${rsvp.rank || ''}","${rsvp.unit || ''}",${rsvp.guestCount || 0},"${dietary}","${allergies}"\n`;
                }
            });
        }

        return csv;
    }

    /**
     * Export seating chart data
     * @returns {Object} Seating data for saving to event
     */
    exportSeatingData() {
        return this.seatingData;
    }
}

// Make SeatingChart available globally
window.SeatingChart = SeatingChart;
