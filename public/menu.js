// Shared Menu Component for all pages
window.ChatMenu = {
  init: function() {
    // Only initialize if menu elements exist
    const menuBtn = document.getElementById('menuBtn');
    const menuCard = document.getElementById('menuCard');
    const menuOverlay = document.getElementById('menuOverlay');

    if (!menuBtn || !menuCard || !menuOverlay) {
      return;
    }

    this.menuBtn = menuBtn;
    this.menuCard = menuCard;
    this.menuOverlay = menuOverlay;
    this.menuOpen = false;

    // Get other menu elements
    this.themeToggle = document.getElementById('themeToggle');
    this.themeIndicator = document.getElementById('themeIndicator');
    this.themeText = document.querySelector('.theme-text');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.profileBtn = document.getElementById('profileBtn');
    this.privacyBtn = document.getElementById('privacyBtn');
    this.helpBtn = document.getElementById('helpBtn');
    this.menuEmail = document.getElementById('menuEmail');
    this.menuId = document.getElementById('menuId');
    this.menuAvatar = document.getElementById('menuAvatar');
    this.menuName = document.getElementById('menuName');

    this.bindEvents();
    this.loadUserInfo();
    this.loadTheme(); // Load saved theme preference
  },

  bindEvents: function() {
    // Menu toggle
    this.menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleMenu();
    });

    this.menuOverlay.addEventListener('click', () => {
      this.hideMenu();
    });

    // Theme toggle
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // Menu items
    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => {
        this.handleLogout();
      });
    }

    if (this.profileBtn) {
      this.profileBtn.addEventListener('click', () => {
        alert('Profile Settings - Coming Soon!');
        this.hideMenu();
      });
    }

    if (this.privacyBtn) {
      this.privacyBtn.addEventListener('click', () => {
        alert('Privacy Settings - Coming Soon!');
        this.hideMenu();
      });
    }

    if (this.helpBtn) {
      this.helpBtn.addEventListener('click', () => {
        alert('Help & Support - Coming Soon!');
        this.hideMenu();
      });
    }

    // Copy functionality for user ID
    if (this.menuId) {
      this.menuId.addEventListener('click', () => {
        this.copyToClipboard(this.menuId.textContent.replace('ID: ', ''), 'ID');
      });
    }
  },

  toggleMenu: function() {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      this.showMenu();
    } else {
      this.hideMenu();
    }
  },

  showMenu: function() {
    this.menuCard.classList.add('show');
    this.menuOverlay.classList.add('show');
    this.menuOpen = true;
  },

  hideMenu: function() {
    this.menuCard.classList.remove('show');
    this.menuOverlay.classList.remove('show');
    this.menuOpen = false;
  },

  loadUserInfo: function() {
    // Get current user information
    fetch('/api/auth/me', { credentials: 'include' })
      .then(response => response.json())
      .then(user => {
        if (user.userName && user.userEmail) {
          this.updateUserInfo(user.userName, user.userEmail, user.userId);
        }
      })
      .catch(error => {
        console.log('Could not load user info for menu');
      });
  },

  updateUserInfo: function(userName, userEmail, userId) {
    if (this.menuAvatar) this.menuAvatar.textContent = this.getUserAvatar(userName);
    if (this.menuName) this.menuName.textContent = userName;
    if (this.menuEmail) this.menuEmail.textContent = userEmail;
    if (this.menuId) this.menuId.textContent = userId || `ID: ${userName.toLowerCase()}`;
  },

  getUserAvatar: function(name) {
    return name.charAt(0).toUpperCase();
  },

  // Cookie utility functions for theme persistence
  setCookie: function(name, value, days = 365) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  },

  getCookie: function(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  },

  copyToClipboard: function(text, type) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showCopyFeedback(type);
      }).catch(err => {
        console.error('Failed to copy: ', err);
        this.fallbackCopyTextToClipboard(text, type);
      });
    } else {
      this.fallbackCopyTextToClipboard(text, type);
    }
  },

  fallbackCopyTextToClipboard: function(text, type) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.showCopyFeedback(type);
      } else {
        console.error('Fallback: Unable to copy');
      }
    } catch (err) {
      console.error('Fallback: Unable to copy', err);
    }

    document.body.removeChild(textArea);
  },

  showCopyFeedback: function(type) {
    if (this.menuId) {
      const originalText = this.menuId.textContent;
      this.menuId.textContent = 'Copied!';
      this.menuId.classList.add('copied');

      setTimeout(() => {
        this.menuId.textContent = originalText;
        this.menuId.classList.remove('copied');
      }, 1500);
    }
  },

  toggleTheme: function() {
    const isDark = this.themeIndicator && this.themeIndicator.classList.contains('active');
    if (isDark) {
      // Switch to light theme
      this.applyLightTheme();
      this.setCookie('theme', 'light');
      if (this.themeText) this.themeText.textContent = 'Light Theme';
    } else {
      // Switch to dark theme
      this.applyDarkTheme();
      this.setCookie('theme', 'dark');
      if (this.themeText) this.themeText.textContent = 'Dark Theme';
    }
  },

  loadTheme: function() {
    const savedTheme = this.getCookie('theme');
    if (savedTheme === 'light') {
      this.applyLightTheme();
      if (this.themeIndicator) this.themeIndicator.classList.remove('active');
      if (this.themeText) this.themeText.textContent = 'Light Theme';
    } else {
      // Default to dark theme
      this.applyDarkTheme();
      if (this.themeIndicator) this.themeIndicator.classList.add('active');
      if (this.themeText) this.themeText.textContent = 'Dark Theme';
    }
  },

  applyLightTheme: function() {
    document.documentElement.style.setProperty('--bg', '#f8fafc');
    document.documentElement.style.setProperty('--panel', '#ffffff');
    document.documentElement.style.setProperty('--muted', '#64748b');
    document.documentElement.style.setProperty('--text', '#1e293b');
    document.documentElement.style.setProperty('--accent', '#0ea5e9');
    document.documentElement.style.setProperty('--accent2', '#3b82f6');
  },

  applyDarkTheme: function() {
    document.documentElement.style.setProperty('--bg', '#0f172a');
    document.documentElement.style.setProperty('--panel', '#111827');
    document.documentElement.style.setProperty('--muted', '#94a3b8');
    document.documentElement.style.setProperty('--text', '#e5e7eb');
    document.documentElement.style.setProperty('--accent', '#22d3ee');
    document.documentElement.style.setProperty('--accent2', '#60a5fa');
  },

  handleLogout: async function() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        window.location.href = '/';
      } else {
        alert('Logout failed. Please try again.');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed. Please try again.');
    }
  }
};

// Auto-initialize menu when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  window.ChatMenu.init();
});
