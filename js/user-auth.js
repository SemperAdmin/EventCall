// js/user-auth.js - Fixed version

const userAuth = {
  currentUser: null,
  githubToken: null,

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

    if (!token) {
      showToast('Please enter your GitHub access token.', 'error');
      tokenInput?.focus();
      return;
    }

    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      showToast('Please enter a valid GitHub token (starts with ghp_ or github_pat_)', 'error');
      tokenInput?.focus();
      return;
    }

    const originalText = setupBtn.textContent;
    setupBtn.innerHTML = '<div class="spinner"></div> Connecting...';
    setupBtn.disabled = true;

    this.currentUser = email;
    this.githubToken = token;
    sessionStorage.setItem('eventcall_user', email);
    
    if (window.githubAPI) {
      window.githubAPI.config.token = token;
    }
    if (window.GITHUB_CONFIG) {
      window.GITHUB_CONFIG.token = token;
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
    if (!this.githubToken || !window.githubAPI) {
      return false;
    }

    try {
      console.log('🔍 Testing GitHub connection for manager...');
      const connected = await window.githubAPI.testConnection();
      
      if (connected) {
        console.log('✅ GitHub connection verified for manager:', this.currentUser);
        
        try {
          const repoResponse = await fetch(`https://api.github.com/repos/SemperAdmin/EventCall`, {
            headers: {
              'Authorization': `token ${this.githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'EventCall-App'
            }
          });
          
          if (repoResponse.ok) {
            console.log('✅ Repository access verified');
            return true;
          } else {
            console.error('❌ Repository access failed:', repoResponse.status);
            const showToast = window.showToast || function(msg, type) { console.log(msg); };
            showToast('❌ Cannot access repository. Check token permissions.', 'error');
            return false;
          }
        } catch (error) {
          console.error('❌ Repository access test failed:', error);
          return false;
        }
      } else {
        console.warn('⚠️ GitHub connection test failed');
        return false;
      }
    } catch (error) {
      console.error('GitHub connection error:', error);
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
    return !!this.githubToken;
  },

  getGitHubToken() {
    return this.githubToken;
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

  console.log('✅ User authentication system initialized');
});

window.userAuth = userAuth;