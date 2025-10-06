/**
 * EventCall Secure Configuration
 * NO hardcoded tokens - Service token managed by GitHub Actions only
 */

// GitHub Repository Configuration
const GITHUB_CONFIG = {
    owner: 'SemperAdmin',
    repo: 'EventCall',
    apiBase: 'https://api.github.com/repos',
    // NO TOKEN HERE - Managed server-side only
};

// Application Configuration
const APP_CONFIG = {
    appName: 'EventCall',
    appVersion: '2.0.0-secure',
    maxImageSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    codeWordList: [
        // Military-themed memorable words for code generation
        'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT',
        'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA',
        'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO',
        'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'XRAY',
        'YANKEE', 'ZULU', 'MARINE', 'NAVY', 'ARMY', 'FORCE',
        'GUARD', 'CORPS', 'UNIT', 'SQUAD', 'TEAM', 'HONOR',
        'DUTY', 'PRIDE', 'VALOR', 'COURAGE', 'LOYALTY', 'SERVICE'
    ]
};

// Access Code Configuration
const CODE_CONFIG = {
    managerPrefix: 'MGR',
    eventPrefix: 'EVT',
    invitePrefix: 'INV',
    codeLength: 3, // Number of words/segments
    includeYear: true,
    separator: '-'
};

// Authentication Settings
const AUTH_CONFIG = {
    requireEmail: true,
    emailDomains: [], // Empty = allow all domains
    sessionStorage: true, // Use sessionStorage (expires on close)
    rememberMeOption: true, // Allow "remember me" checkbox
    rememberMeDays: 30
};

// Storage Paths in GitHub Repository
const GITHUB_PATHS = {
    managers: 'data/managers',
    events: 'events',
    rsvps: 'rsvps',
    invites: 'data/invites',
    logs: 'data/logs'
};

// Messages
const MESSAGES = {
    auth: {
        loginRequired: 'Please log in to access this feature',
        invalidCode: 'Invalid access code. Please check and try again.',
        invalidEmail: 'Please enter a valid email address',
        sessionExpired: 'Your session has expired. Please log in again.',
        accessDenied: 'You do not have permission to access this event',
        loginSuccess: 'Welcome back! Access granted.',
        logoutSuccess: 'You have been logged out successfully'
    },
    manager: {
        accountCreated: 'Manager account created! Your access code is: ',
        codeGenerated: 'New access code generated',
        inviteCreated: 'Invite link created successfully',
        managerAdded: 'Manager added to event',
        managerRemoved: 'Manager removed from event'
    },
    rsvp: {
        submitSuccess: '✅ RSVP submitted successfully!',
        submitError: 'Failed to submit RSVP. Please try again.',
        processing: 'Processing your RSVP...'
    }
};

// Validation Patterns
const VALIDATION = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[\+]?[1-9][\d]{0,15}$/,
    managerCode: /^MGR-[A-Z0-9-]+$/,
    eventCode: /^EVT-[A-Z0-9-]+$/,
    inviteCode: /^INV-[A-Z0-9-]+$/
};

// Code Generation Helper
const CodeGenerator = {
    /**
     * Generate memorable access code
     * Format: PREFIX-WORD1-WORD2-YEAR (e.g., EVT-MARINE-BALL-2025)
     */
    generate(prefix = 'EVT') {
        const words = APP_CONFIG.codeWordList;
        const numWords = CODE_CONFIG.codeLength;
        const separator = CODE_CONFIG.separator;
        
        let code = prefix;
        
        // Add random words
        for (let i = 0; i < numWords; i++) {
            const randomWord = words[Math.floor(Math.random() * words.length)];
            code += separator + randomWord;
        }
        
        // Add year if configured
        if (CODE_CONFIG.includeYear) {
            const year = new Date().getFullYear();
            code += separator + year;
        }
        
        // Add random number for uniqueness
        const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        code += separator + randomNum;
        
        return code;
    },
    
    /**
     * Validate code format
     */
    validate(code, prefix = null) {
        if (!code || typeof code !== 'string') return false;
        
        if (prefix) {
            return code.startsWith(prefix + CODE_CONFIG.separator);
        }
        
        return VALIDATION.managerCode.test(code) || 
               VALIDATION.eventCode.test(code) || 
               VALIDATION.inviteCode.test(code);
    },
    
    /**
     * Extract prefix from code
     */
    getPrefix(code) {
        if (!code) return null;
        return code.split(CODE_CONFIG.separator)[0];
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.GITHUB_CONFIG = GITHUB_CONFIG;
    window.APP_CONFIG = APP_CONFIG;
    window.CODE_CONFIG = CODE_CONFIG;
    window.AUTH_CONFIG = AUTH_CONFIG;
    window.GITHUB_PATHS = GITHUB_PATHS;
    window.MESSAGES = MESSAGES;
    window.VALIDATION = VALIDATION;
    window.CodeGenerator = CodeGenerator;
}

console.log('✅ EventCall secure configuration loaded (v2.0.0)');
console.log('🔒 No tokens in client-side code - All authentication server-side');