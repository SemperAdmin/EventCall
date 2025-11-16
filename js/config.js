/**
 * EventCall Secure Configuration
 * Token is managed server-side via GitHub Actions Secrets
 * All data operations go through secure GitHub Actions workflows
 */

// **The main configuration object**
const GITHUB_CONFIG = {
    owner: 'SemperAdmin',
    repo: 'EventCall',
    dataRepo: 'EventCall-Data',  // Private repository for events, RSVPs, and user data
    imageRepo: 'EventCall-Images',  // Public repository for event cover images
    branch: 'main',

    // TODO: Add a dispatch token for triggering workflows
    // This token ONLY needs 'public_repo' or 'workflow' scope for the EventCall repo
    // It does NOT need access to EventCall-Data (that uses EVENTCALL_MANAGER_TOKEN in GitHub Secrets)
    token: null,  // Set this to your dispatch token to enable workflow triggers

    // Use GitHub Actions workflows for all data operations
    useWorkflowBackend: true,
    // Optional: provide multiple tokens to rotate under rate limiting
    tokens: [],

    // Helper methods for constructing GitHub API URLs
    getRepoUrl(repoType = 'main') {
        const repoName = repoType === 'data' ? this.dataRepo :
                         repoType === 'images' ? this.imageRepo :
                         this.repo;
        return `https://api.github.com/repos/${this.owner}/${repoName}`;
    },

    getTreeUrl(repoType = 'data', branch = 'main', recursive = true) {
        const repoName = repoType === 'data' ? this.dataRepo :
                         repoType === 'images' ? this.imageRepo :
                         this.repo;
        return `https://api.github.com/repos/${this.owner}/${repoName}/git/trees/${branch}${recursive ? '?recursive=1' : ''}`;
    },

    getBlobUrl(repoType = 'data', sha) {
        const repoName = repoType === 'data' ? this.dataRepo :
                         repoType === 'images' ? this.imageRepo :
                         this.repo;
        return `https://api.github.com/repos/${this.owner}/${repoName}/git/blobs/${sha}`;
    },

    getContentsUrl(repoType = 'data', path) {
        const repoName = repoType === 'data' ? this.dataRepo :
                         repoType === 'images' ? this.imageRepo :
                         this.repo;
        return `https://api.github.com/repos/${this.owner}/${repoName}/contents/${path}`;
    }
};

// Application Configuration
const APP_CONFIG = {
    maxFileSize: 5 * 1024 * 1024, // 5MB (renamed from maxImageSize to match usage in utils.js)
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
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
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    rememberMeOption: true, // Allow "remember me" checkbox
    rememberMeDays: 30,
    // Simple client-side authentication mode (no GitHub workflow/polling)
    // When enabled, login validates locally and grants access on success.
    // Set to false to use server-side GitHub Actions for auth and persistence.
    // TEMPORARY: Set to true until dispatch token is added
    simpleAuth: true,
    // Force backend workflow dispatch and issue polling even on localhost.
    // Enable this in local dev to test real saving to EventCall-Data.
    forceBackendInDev: false,
    // Polling configuration for server-driven authentication workflows
    // Increase timeout to accommodate GitHub Actions queuing delays
    authTimeoutMs: 120000,
    // Slightly faster polling for quicker detection without spamming
    pollIntervalMs: 1500,
    // Optional static users for simple auth. If empty, any non-empty
    // username/password pair will be accepted for demo purposes.
    users: [
        // Admin user
        { username: 'semperadmin', password: 'admin', name: 'Admin', rank: 'Admin', role: 'admin' },
        // Example users (customize as needed):
        // { username: 'demo', password: 'demo123', name: 'Demo User', rank: 'Guest', role: 'user' }
    ]
};

// Security Configuration (SEC-006)
const SECURITY_CONFIG = {
    allowedOrigins: [
        // Fill with production origins, e.g., 'https://eventcall.example.com'
        window.location.origin // include current origin by default
    ],
    csrfCookieName: 'eventcall_csrf',
    csrfStorageKey: 'eventcall_csrf_token',
    csrfRotateMs: 30 * 60 * 1000 // rotate every 30 minutes
};

// reCAPTCHA v3 Configuration (client-side only; server must validate tokens)
const RECAPTCHA_CONFIG = {
    enabled: true,
    siteKey: '', // provide your site key to enable; empty disables token requests
    enabledForms: ['rsvp'],
    scoreThreshold: 0.5,
    actionMap: {
        rsvp: 'rsvp_submit'
    }
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
    window.SECURITY_CONFIG = SECURITY_CONFIG;
    window.CODE_CONFIG = CODE_CONFIG;
    window.AUTH_CONFIG = AUTH_CONFIG;
    window.RECAPTCHA_CONFIG = RECAPTCHA_CONFIG;
    window.MESSAGES = MESSAGES;
    window.VALIDATION = VALIDATION;
    window.CodeGenerator = CodeGenerator;
}

console.log('✅ EventCall configuration loaded');
console.log('🔒 No tokens in client-side code - All authentication server-side');




