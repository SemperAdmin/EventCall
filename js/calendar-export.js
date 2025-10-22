/**
 * EventCall Calendar Export Module
 * Generates ICS files and calendar links for events
 */

class CalendarExport {
    constructor() {
        this.calendarTypes = {
            google: 'Google Calendar',
            outlook: 'Outlook',
            yahoo: 'Yahoo Calendar',
            apple: 'Apple Calendar',
            ics: 'Download ICS'
        };
    }

    /**
     * Generate ICS file content
     */
    generateICS(event) {
        const eventDate = new Date(event.date + 'T' + event.time);
        const endDate = new Date(eventDate.getTime() + (2 * 60 * 60 * 1000)); // Default 2 hours duration

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}T${hours}${minutes}${seconds}`;
        };

        const now = new Date();
        const dtstamp = formatDate(now);
        const dtstart = formatDate(eventDate);
        const dtend = formatDate(endDate);

        // Escape special characters for ICS format
        const escapeICS = (str) => {
            if (!str) return '';
            return str.replace(/\\/g, '\\\\')
                      .replace(/;/g, '\\;')
                      .replace(/,/g, '\\,')
                      .replace(/\n/g, '\\n');
        };

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EventCall//Military Event Management//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${event.id}@eventcall
DTSTAMP:${dtstamp}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${escapeICS(event.title)}
DESCRIPTION:${escapeICS(event.description || '')}
LOCATION:${escapeICS(event.location || '')}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT24H
ACTION:DISPLAY
DESCRIPTION:Event reminder - ${escapeICS(event.title)}
END:VALARM
END:VEVENT
END:VCALENDAR`;

        return icsContent;
    }

    /**
     * Download ICS file
     */
    downloadICS(event) {
        const icsContent = this.generateICS(event);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('📅 Calendar file downloaded!', 'success');
    }

    /**
     * Generate Google Calendar URL
     */
    getGoogleCalendarURL(event) {
        const eventDate = new Date(event.date + 'T' + event.time);
        const endDate = new Date(eventDate.getTime() + (2 * 60 * 60 * 1000)); // 2 hours

        const formatGoogleDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}T${hours}${minutes}${seconds}`;
        };

        const start = formatGoogleDate(eventDate);
        const end = formatGoogleDate(endDate);

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: event.title,
            dates: `${start}/${end}`,
            details: event.description || '',
            location: event.location || ''
        });

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }

    /**
     * Generate Outlook Calendar URL
     */
    getOutlookCalendarURL(event) {
        const eventDate = new Date(event.date + 'T' + event.time);
        const endDate = new Date(eventDate.getTime() + (2 * 60 * 60 * 1000));

        const params = new URLSearchParams({
            path: '/calendar/action/compose',
            rru: 'addevent',
            subject: event.title,
            startdt: eventDate.toISOString(),
            enddt: endDate.toISOString(),
            body: event.description || '',
            location: event.location || ''
        });

        return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
    }

    /**
     * Generate Yahoo Calendar URL
     */
    getYahooCalendarURL(event) {
        const eventDate = new Date(event.date + 'T' + event.time);
        const endDate = new Date(eventDate.getTime() + (2 * 60 * 60 * 1000));

        const formatYahooDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}${month}${day}T${hours}${minutes}00`;
        };

        const st = formatYahooDate(eventDate);
        const et = formatYahooDate(endDate);

        const params = new URLSearchParams({
            v: '60',
            title: event.title,
            st: st,
            et: et,
            desc: event.description || '',
            in_loc: event.location || ''
        });

        return `https://calendar.yahoo.com/?${params.toString()}`;
    }

    /**
     * Open calendar in new window
     */
    openCalendar(type, event) {
        let url;

        switch (type) {
            case 'google':
                url = this.getGoogleCalendarURL(event);
                break;
            case 'outlook':
                url = this.getOutlookCalendarURL(event);
                break;
            case 'yahoo':
                url = this.getYahooCalendarURL(event);
                break;
            case 'apple':
            case 'ics':
                this.downloadICS(event);
                return;
            default:
                showToast('❌ Unknown calendar type', 'error');
                return;
        }

        window.open(url, '_blank');
        showToast(`📅 Opening ${this.calendarTypes[type]}...`, 'success');
    }

    /**
     * Generate calendar button HTML
     */
    generateCalendarButtonsHTML(event, buttonClass = 'btn') {
        return `
            <div class="calendar-export-buttons" style="display: flex; flex-direction: column; gap: 0.5rem; margin: 1rem 0;">
                <button type="button" class="${buttonClass}" onclick="window.calendarExport.openCalendar('google', getEventFromURL())">
                    📅 Add to Google Calendar
                </button>
                <button type="button" class="${buttonClass}" onclick="window.calendarExport.openCalendar('outlook', getEventFromURL())">
                    📅 Add to Outlook
                </button>
                <button type="button" class="${buttonClass}" onclick="window.calendarExport.downloadICS(getEventFromURL())">
                    📥 Download ICS File
                </button>
            </div>
        `;
    }

    /**
     * Generate dropdown calendar button HTML
     */
    generateCalendarDropdownHTML(event) {
        return `
            <div class="calendar-dropdown-container" style="position: relative; display: inline-block;">
                <button type="button" class="btn" onclick="window.calendarExport.toggleCalendarDropdown(event)">
                    📅 Add to Calendar ▼
                </button>
                <div class="calendar-dropdown" style="display: none; position: absolute; top: 100%; left: 0; min-width: 200px; background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 100; margin-top: 0.25rem;">
                    <button type="button" class="calendar-dropdown-item" onclick="window.calendarExport.openCalendar('google', getEventFromURL()); window.calendarExport.closeCalendarDropdown()">
                        📅 Google Calendar
                    </button>
                    <button type="button" class="calendar-dropdown-item" onclick="window.calendarExport.openCalendar('outlook', getEventFromURL()); window.calendarExport.closeCalendarDropdown()">
                        📅 Outlook
                    </button>
                    <button type="button" class="calendar-dropdown-item" onclick="window.calendarExport.openCalendar('yahoo', getEventFromURL()); window.calendarExport.closeCalendarDropdown()">
                        📅 Yahoo
                    </button>
                    <button type="button" class="calendar-dropdown-item" onclick="window.calendarExport.downloadICS(getEventFromURL()); window.calendarExport.closeCalendarDropdown()">
                        📥 Download ICS
                    </button>
                </div>
            </div>

            <style>
                .calendar-dropdown-item {
                    display: block;
                    width: 100%;
                    padding: 0.75rem 1rem;
                    text-align: left;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.875rem;
                    transition: background 0.2s;
                }
                .calendar-dropdown-item:hover {
                    background: #f3f4f6;
                }
                .calendar-dropdown-item:first-child {
                    border-radius: 0.5rem 0.5rem 0 0;
                }
                .calendar-dropdown-item:last-child {
                    border-radius: 0 0 0.5rem 0.5rem;
                }
            </style>
        `;
    }

    /**
     * Toggle calendar dropdown
     */
    toggleCalendarDropdown(event) {
        event.stopPropagation();
        const dropdown = event.target.nextElementSibling;
        if (dropdown && dropdown.classList.contains('calendar-dropdown')) {
            const isVisible = dropdown.style.display === 'block';
            this.closeAllCalendarDropdowns();
            dropdown.style.display = isVisible ? 'none' : 'block';
        }
    }

    /**
     * Close calendar dropdown
     */
    closeCalendarDropdown() {
        this.closeAllCalendarDropdowns();
    }

    /**
     * Close all calendar dropdowns
     */
    closeAllCalendarDropdowns() {
        document.querySelectorAll('.calendar-dropdown').forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }
}

// Initialize calendar export
const calendarExport = new CalendarExport();
window.calendarExport = calendarExport;

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    if (window.calendarExport) {
        window.calendarExport.closeAllCalendarDropdowns();
    }
});
