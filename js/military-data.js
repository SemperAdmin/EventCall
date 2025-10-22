/**
 * EventCall Military Data Module
 * Rank and unit data for military personnel
 */

const MilitaryData = {
    // Marine Corps Ranks
    marineCorps: {
        enlisted: [
            { value: 'Pvt', label: 'Private (Pvt)' },
            { value: 'PFC', label: 'Private First Class (PFC)' },
            { value: 'LCpl', label: 'Lance Corporal (LCpl)' },
            { value: 'Cpl', label: 'Corporal (Cpl)' },
            { value: 'Sgt', label: 'Sergeant (Sgt)' },
            { value: 'SSgt', label: 'Staff Sergeant (SSgt)' },
            { value: 'GySgt', label: 'Gunnery Sergeant (GySgt)' },
            { value: 'MSgt', label: 'Master Sergeant (MSgt)' },
            { value: 'MGySgt', label: 'Master Gunnery Sergeant (MGySgt)' },
            { value: 'SgtMaj', label: 'Sergeant Major (SgtMaj)' }
        ],
        officer: [
            { value: '2ndLt', label: 'Second Lieutenant (2ndLt)' },
            { value: '1stLt', label: 'First Lieutenant (1stLt)' },
            { value: 'Capt', label: 'Captain (Capt)' },
            { value: 'Maj', label: 'Major (Maj)' },
            { value: 'LtCol', label: 'Lieutenant Colonel (LtCol)' },
            { value: 'Col', label: 'Colonel (Col)' },
            { value: 'BGen', label: 'Brigadier General (BGen)' },
            { value: 'MajGen', label: 'Major General (MajGen)' },
            { value: 'LtGen', label: 'Lieutenant General (LtGen)' },
            { value: 'Gen', label: 'General (Gen)' }
        ],
        warrant: [
            { value: 'WO1', label: 'Warrant Officer 1 (WO1)' },
            { value: 'CWO2', label: 'Chief Warrant Officer 2 (CWO2)' },
            { value: 'CWO3', label: 'Chief Warrant Officer 3 (CWO3)' },
            { value: 'CWO4', label: 'Chief Warrant Officer 4 (CWO4)' },
            { value: 'CWO5', label: 'Chief Warrant Officer 5 (CWO5)' }
        ]
    },

    // Common military branches
    branches: [
        { value: 'USMC', label: 'United States Marine Corps' },
        { value: 'USA', label: 'United States Army' },
        { value: 'USN', label: 'United States Navy' },
        { value: 'USAF', label: 'United States Air Force' },
        { value: 'USCG', label: 'United States Coast Guard' },
        { value: 'USSF', label: 'United States Space Force' },
        { value: 'Civilian', label: 'Civilian' },
        { value: 'Other', label: 'Other' }
    ],

    // Get all ranks combined
    getAllRanks() {
        return [
            ...this.marineCorps.enlisted,
            ...this.marineCorps.officer,
            ...this.marineCorps.warrant
        ];
    },

    // Get rank display with proper formatting
    formatRank(rankValue) {
        const allRanks = this.getAllRanks();
        const rank = allRanks.find(r => r.value === rankValue);
        return rank ? rank.label : rankValue;
    },

    // Sort RSVPs by rank (protocol order)
    sortByRank(rsvps) {
        const rankOrder = this.getAllRanks().map(r => r.value);

        return rsvps.sort((a, b) => {
            const aIndex = rankOrder.indexOf(a.rank);
            const bIndex = rankOrder.indexOf(b.rank);

            // If ranks not in our list, put them at the end
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;

            // Higher ranks (lower index) come first
            return aIndex - bIndex;
        });
    }
};

// Make available globally
window.MilitaryData = MilitaryData;
