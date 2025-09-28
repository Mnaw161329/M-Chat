// Simple Chat Client
const socket = io();
let currentUser = null;
let currentGroup = null;

// DOM elements - will be initialized after DOM loads
let messagesEl, messageInputEl, sendBtn, groupsEl, searchInput, createBtn, newGroupInput;
let authContainer, loginForm, registerForm, loginBtn, registerBtn, showRegister, showLogin;
let loginError, registerError, loginPasswordToggle, registerPasswordToggle;

// Initialize DOM elements after page loads
function initializeDOMElements() {
  // Chat elements
  messagesEl = document.getElementById('messages');
  messageInputEl = document.getElementById('messageInput');
  sendBtn = document.getElementById('sendBtn');
  groupsEl = document.getElementById('rooms');
  searchInput = document.getElementById('roomSearch');
  createBtn = document.getElementById('createRoom');
  newGroupInput = document.getElementById('newRoom');

  // Authentication elements
  authContainer = document.getElementById('authContainer');
  loginForm = document.getElementById('loginForm');
  registerForm = document.getElementById('registerForm');
  loginBtn = document.getElementById('loginBtn');
  registerBtn = document.getElementById('registerBtn');
  showRegister = document.getElementById('showRegister');
  showLogin = document.getElementById('showLogin');
  loginError = document.getElementById('loginError');
  registerError = document.getElementById('registerError');
  loginPasswordToggle = document.getElementById('loginPasswordToggle');
  registerPasswordToggle = document.getElementById('registerPasswordToggle');

  // Setup event listeners only if elements exist
  setupEventListeners();

  // Check authentication status after DOM is ready
  checkAuthStatus();
}

// Setup all event listeners
function setupEventListeners() {
  // Chat event listeners
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (messageInputEl) messageInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  if (searchInput) searchInput.addEventListener('input', searchGroups);
  if (createBtn) createBtn.addEventListener('click', createGroup);

  // Authentication event listeners
  if (loginBtn) loginBtn.addEventListener('click', login);
  if (registerBtn) registerBtn.addEventListener('click', register);
  if (showRegister) showRegister.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthForms();
  });
  if (showLogin) showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthForms();
  });
  if (loginPasswordToggle) loginPasswordToggle.addEventListener('change', () => togglePassword('loginPassword', 'loginPasswordToggle'));
  if (registerPasswordToggle) registerPasswordToggle.addEventListener('change', () => togglePassword('registerPassword', 'registerPasswordToggle'));
}

// Check if user is authenticated on page load
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include' // Include cookies in the request
    });
    if (response.ok) {
      const user = await response.json();
      currentUser = user.userEmail;
      // Redirect to private chat if user is already authenticated
      window.location.href = '/private';
    } else {
      showAuthInterface();
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    showAuthInterface();
  }
}

// Show authentication interface
function showAuthInterface() {
  if (authContainer) {
    authContainer.style.display = 'block';
  }
  hideChatInterface();
}

// Hide authentication interface
function hideAuthInterface() {
  if (authContainer) {
    authContainer.style.display = 'none';
  }
}

// Show chat interface
function showChatInterface() {
  hideAuthInterface();
  // Redirect to private chat instead of showing group chat
  window.location.href = '/private';
}

// Hide chat interface
function hideChatInterface() {
  // Hide chat elements if they exist
  const chatElements = ['messages', 'messageInput', 'sendBtn', 'rooms', 'roomSearch', 'createRoom', 'newRoom'];
  chatElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// Show/hide password functionality
function togglePassword(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);

  if (input && toggle) {
    if (toggle.checked) {
      input.type = 'text';
    } else {
      input.type = 'password';
    }
  }
}

// Login function
async function login() {
  const userEmail = document.getElementById('loginEmail')?.value;
  const userPassword = document.getElementById('loginPassword')?.value;

  if (!userEmail || !userPassword) {
    showLoginError('Please fill in all fields');
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies in the request
      body: JSON.stringify({ userName: userEmail, userPassword: userPassword })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user.userEmail;
      hideLoginError();
      // Redirect to private chat after successful login
      window.location.href = '/private';
    } else {
      showLoginError(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    showLoginError('Network error. Please try again.');
  }
}

// Register function
async function register() {
  const userName = document.getElementById('registerName')?.value;
  const userEmail = document.getElementById('registerEmail')?.value;
  const userPassword = document.getElementById('registerPassword')?.value;

  if (!userName || !userEmail || !userPassword) {
    showRegisterError('Please fill in all fields');
    return;
  }

  if (userPassword.length < 6) {
    showRegisterError('Password must be at least 6 characters');
    return;
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies in the request
      body: JSON.stringify({ userName: userName, userPassword: userPassword, userEmail: userEmail })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user.userEmail;
      hideRegisterError();
      // Redirect to private chat after successful registration
      window.location.href = '/private';
    } else {
      showRegisterError(data.error || 'Registration failed');
    }
  } catch (error) {
    console.error('Register error:', error);
    showRegisterError('Network error. Please try again.');
  }
}

// Show login error
function showLoginError(message) {
  if (loginError) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
  }
}

// Hide login error
function hideLoginError() {
  if (loginError) {
    loginError.classList.add('hidden');
  }
}

// Show register error
function showRegisterError(message) {
  if (registerError) {
    registerError.textContent = message;
    registerError.classList.remove('hidden');
  }
}

// Hide register error
function hideRegisterError() {
  if (registerError) {
    registerError.classList.add('hidden');
  }
}

// Toggle between login and register forms
function toggleAuthForms() {
  if (loginForm && registerForm) {
    if (loginForm.classList.contains('hidden')) {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    }
  }
}

// Add message to chat
function addMessage(msg, isMe = false) {
  const wrap = document.createElement('div');
  wrap.className = `message ${isMe ? 'me' : ''}`;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = msg.userName || msg.sender;

  const body = document.createElement('div');
  body.className = 'text';
  body.textContent = msg.text || msg.message;

  wrap.appendChild(meta);
  wrap.appendChild(body);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Display groups in sidebar
function displayGroups(groups) {
  groupsEl.innerHTML = '';

  groups.forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'room' + (group.groupName === currentGroup ? ' active' : '');
    groupDiv.onclick = () => switchGroup(group.groupName);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'group-name';
    nameDiv.textContent = group.groupName;

    const descDiv = document.createElement('div');
    descDiv.className = 'group-desc';
    descDiv.textContent = group.groupDescription || 'No description';

    const memberCount = document.createElement('div');
    memberCount.className = 'member-count';
    memberCount.textContent = `${group.members?.length || 0} members`;

    groupDiv.appendChild(nameDiv);
    groupDiv.appendChild(descDiv);
    groupDiv.appendChild(memberCount);

    groupsEl.appendChild(groupDiv);
  });
}

// Load groups from API
async function loadGroups() {
  try {
    const response = await fetch('/api/groups', {
      credentials: 'include' // Include cookies in the request
    });
    if (response.ok) {
      const data = await response.json();
      displayGroups(data.groups || []);
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

// Create new group
async function createGroup() {
  const groupName = newGroupInput.value.trim();
  if (!groupName) return;

  try {
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies in the request
      body: JSON.stringify({ groupName })
    });

    if (response.ok) {
      newGroupInput.value = '';
      await loadGroups();
    }
  } catch (error) {
    console.error('Error creating group:', error);
  }
}

// Switch to different group
function switchGroup(groupName) {
  if (groupName === currentGroup) return;
  currentGroup = groupName;
  messagesEl.innerHTML = '';
  socket.emit('switchGroup', groupName);
  loadGroups();
}

// Search groups
function searchGroups() {
  const query = searchInput.value.toLowerCase();
  const groupElements = groupsEl.querySelectorAll('.room');

  groupElements.forEach(el => {
    const name = el.querySelector('.group-name').textContent.toLowerCase();
    const desc = el.querySelector('.group-desc').textContent.toLowerCase();

    if (name.includes(query) || desc.includes(query)) {
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });
}

// Send message
function sendMessage() {
  const text = messageInputEl.value.trim();
  if (!text) return;
  socket.emit('message', text);
  messageInputEl.value = '';
}

// Socket events
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('message', (msg) => {
  addMessage(msg);
});

socket.on('history', (msgs) => {
  messagesEl.innerHTML = '';
  (msgs || []).forEach((m) => addMessage(m));
});

socket.on('system', (msg) => {
  addMessage(msg);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// DOM Content Loaded - Initialize all elements and event listeners
document.addEventListener('DOMContentLoaded', initializeDOMElements);
