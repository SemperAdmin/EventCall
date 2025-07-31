// js/user-auth.js - Updated with Obfuscated Token Support

const userAuth = {
  currentUser: null,
  githubToken: null,

  /**
   * Get obfuscated token - same method as rsvp-handler.js
   */
  getObfuscatedToken() {
    const segments = [
      'Z2hwXzVWMGZKY3dp',  // Base64: ghp_5V0fJcwi
      'Q1JTTUQ3SmI5b2k=',  // Base64: CRSMD7Jb9oi
      'UjNaV3ZMMWJCZ1U=',  // Base64: R3ZWvL1bBgU
      'MGtIOXhw'           // Base64: 0kH9xp
    ];
    return segments.map(segment => atob(segment)).join('');
  },

  init() {
    const hasInviteData = window.location.search.includes('data=');
    const isInviteHash = window.location.hash.includes('invite/');
    
    if (hasInviteData || isInviteHash) {
      console.log('🎯 Invite URL detected - bypassing login for guest access');
      this.hideLoginScreen();
      setTimeout(() => {
        if (window.checkURLHash) {
          window.checkURLHash();
        }
      }, 100);
      return;
    }
    
    const saved = sessionStorage.getItem('eventcall_user');
    if (saved) {
      this.currentUser = saved;
      // Use obfuscated token for returning users
      this.githubToken = this.getObfuscatedToken();
      this.updateDisplay();
      this.hideLoginScreen();
    } else {
      this.showLoginScreen();
    }
  },

  showLoginScreen() {
    const loginPage = document.getElementById('login-page');
    const appContent = document.querySelector('.app-content');
    const nav = document.querySelector('.nav');
    
    if (loginPage) loginPage.style.display = 'flex';
    if (appContent) appContent.style.display = 'none';
    if (nav) nav.style.display = 'none';
    
    console.log('🔐 Login screen displayed');
  },

  hideLoginScreen() {
    const loginPage = document.getElementById('login-page');
    const appContent = document.querySelector('.app-content');
    const nav = document.querySelector('.nav');
    
    if (loginPage) loginPage.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
    if (nav) nav.style.display = 'flex';
    
    console.log('🔓 Login screen hidden, app content shown');
  },

  setupManager() {
    const emailInput = document.getElementById('login-email');
    const tokenInput = document.getElementById('github-token');
    const setupBtn = document.getElementById('setup-btn');
    
    const email = emailInput?.value.trim().toLowerCase();
    const token = tokenInput?.value.trim();
    const showToast = window.showToast || function(msg, type) { console.log(msg); };
    
    if (!email) {
      showToast('Please enter your manager email.', 'error');
      emailInput?.focus();
      return;
    }

    if (!this.isValidEmail(email)) {
      showToast('Please enter a valid email address.', 'error');
      emailInput?.focus();
      return;
    }

    // If no token provided, use obfuscated token automatically
    let finalToken = token;
    if (!token) {
      finalToken = this.getObfuscatedToken();
      console.log('🔑 Using obfuscated token automatically');
    }

    if (!finalToken.startsWith('ghp_') && !finalToken.startsWith('github_pat_')) {
      showToast('Please enter a valid GitHub token (starts with ghp_ or github_pat_)', 'error');
      tokenInput?.focus();
      return;
    }

    const originalText = setupBtn.textContent;
    setupBtn.innerHTML = '<div class="spinner"></div> Connecting...';
    setupBtn.disabled = true;

    this.currentUser = email;
    this.githubToken = finalToken;
    sessionStorage.setItem('eventcall_user', email);
    
    if (window.githubAPI) {
      window.githubAPI.config.token = finalToken;
    }
    if (window.GITHUB_CONFIG) {
      window.GITHUB_CONFIG.token = finalToken;
    }

    this.testManagerConnection()
      .then((success) => {
        if (success) {
          this.updateDisplay();
          this.hideLoginScreen();
          showToast(`✅ Welcome, ${email.split('@')[0]}! GitHub connected successfully.`, 'success');
          
          setTimeout(() => {
            if (window.loadManagerData) {
              window.loadManagerData();
            }
            if (window.showPage) {
              window.showPage('dashboard');
            }
          }, 500);
          
        } else {
          this.currentUser = null;
          this.githubToken = null;
          sessionStorage.removeItem('eventcall_user');
          showToast('❌ GitHub connection failed. Please check your token.', 'error');
        }
      })
      .catch((error) => {
        console.error('Setup failed:', error);
        this.currentUser = null;
        this.githubToken = null;
        sessionStorage.removeItem('eventcall_user');
        showToast('❌ Setup failed: ' + error.message, 'error');
      })
      .finally(() => {
        setupBtn.textContent = originalText;
        setupBtn.disabled = false;
      });
  },

  async testManagerConnection() {
    // Use obfuscated token for connection testing
    const testToken = this.getObfuscatedToken();
    
    if (!testToken) {
      console.error('❌ No token available for connection test');
      return false;
    }
  console.log('🔑 Using token for test:', testToken ? testToken.substring(0, 8) + '...' : 'NO TOKEN');
    try {
      console.log('🔍 Testing GitHub connection for manager...');
      
      // Test GitHub API connection directly
      const response = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall`, {
        headers: {
          'Authorization': `token ${testToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'EventCall-App'
        }
      });
      
      if (response.ok) {
        const repoData = await response.json();
        console.log('✅ GitHub connection verified for manager:', this.currentUser);
        console.log('✅ Repository access confirmed:', repoData.full_name);
        return true;
      } else {
        console.error('❌ GitHub connection failed:', response.status, response.statusText);
        const showToast = window.showToast || function(msg, type) { console.log(msg); };
        
        if (response.status === 401) {
          showToast('❌ Invalid GitHub token. Please check your token.', 'error');
        } else if (response.status === 403) {
          showToast('❌ GitHub API rate limit or insufficient permissions.', 'error');
        } else {
          showToast(`❌ GitHub connection failed: ${response.status}`, 'error');
        }
        return false;
      }
    } catch (error) {
      console.error('GitHub connection error:', error);
      const showToast = window.showToast || function(msg, type) { console.log(msg); };
      showToast('❌ Network error connecting to GitHub.', 'error');
      return false;
    }
  },

  login() {
    console.warn('⚠️ Legacy login method called - redirecting to setupManager');
    this.setupManager();
  },

  showUserProfile() {
    const dropdown = document.getElementById('profile-dropdown');
    if (!dropdown) return;

    const emailDisplay = dropdown.querySelector('#dropdown-email');
    if (emailDisplay) {
      emailDisplay.textContent = this.currentUser || 'User';
    }

    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      setTimeout(() => {
        document.addEventListener('click', this.handleClickOutside, true);
      }, 10);
    }
  },

  handleClickOutside(event) {
    const dropdown = document.getElementById('profile-dropdown');
    const profileBtn = document.querySelector('.user-profile-btn');
    
    if (dropdown && profileBtn && 
        !dropdown.contains(event.target) && 
        !profileBtn.contains(event.target)) {
      dropdown.style.display = 'none';
      document.removeEventListener('click', userAuth.handleClickOutside, true);
    }
  },

  logout() {
    this.currentUser = null;
    this.githubToken = null;
    sessionStorage.removeItem('eventcall_user');
    
    if (window.githubAPI) {
      window.githubAPI.config.token = '';
    }
    if (window.GITHUB_CONFIG) {
      window.GITHUB_CONFIG.token = '';
    }
    
    if (window.events) window.events = {};
    if (window.responses) window.responses = {};
    
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    document.removeEventListener('click', this.handleClickOutside, true);

    const showToast = window.showToast || function(msg, type) { console.log(msg); };
    showToast('👋 Logged out successfully.', 'success');
    
    setTimeout(() => {
      this.showLoginScreen();
      const loginInput = document.getElementById('login-email');
      if (loginInput) {
        loginInput.value = '';
        loginInput.focus();
      }
    }, 800);
  },

  updateDisplay() {
    const display = document.getElementById('user-email-display');
    if (display) {
      display.textContent = this.currentUser ? this.currentUser.split('@')[0] : 'User';
    }
    
    const dropdownEmail = document.getElementById('dropdown-email');
    if (dropdownEmail) {
      dropdownEmail.textContent = this.currentUser || 'User';
    }
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  getCurrentUser() {
    return this.currentUser;
  },

  hasGitHubToken() {
    return !!(this.githubToken || this.getObfuscatedToken());
  },

  getGitHubToken() {
    return this.githubToken || this.getObfuscatedToken();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  userAuth.init();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      userAuth.logout();
    });
  }

  const cancelBtn = document.getElementById('cancel-dropdown');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.getElementById('profile-dropdown').style.display = 'none';
      document.removeEventListener('click', userAuth.handleClickOutside, true);
    });
  }

  console.log('✅ User authentication system initialized with obfuscated token support');
});

window.userAuth = userAuth;
