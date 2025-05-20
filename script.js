import { auth, db } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const socket = io();
const DEFAULT_AVATAR = "https://static.vecteezy.com/system/resources/previews/026/619/142/original/default-avatar-profile-icon-of-social-media-user-photo-image-vector.jpg";
let currentChatUser = null;
let typingTimeout;
let modals = {};

// Initialize Google Auth
const provider = new GoogleAuthProvider();

// Handle login
async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Successfully logged in:", result.user.displayName);
    } catch (error) {
        console.error("Login error:", error);
        alert("Login failed: " + error.message);
    }
}

// Auth state changes
auth.onAuthStateChanged(user => {
    const loginSection = document.getElementById('loginSection');
    const chatSection = document.getElementById('chatSection');
    
    if (user) {
        // Update UI for logged in user
        loginSection.style.display = 'none';
        chatSection.style.display = 'flex';
        
        // Set user profile
        document.getElementById('userDisplayName').textContent = user.displayName;
        document.getElementById('userAvatar').src = getProfilePhoto(user.photoURL);
        
        // Connect to socket
        socket.emit('user-login', {
            userId: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL
        });
        
        // Initialize chat
        setupSocketListeners();
    } else {
        loginSection.style.display = 'flex';
        chatSection.style.display = 'none';
    }
});

// Socket listeners
function setupSocketListeners() {
    socket.on('online-users', updateOnlineUsers);
    socket.on('chat message', displayMessage);
    socket.on('user-typing', showTypingIndicator);
}

// Update online users list
function updateOnlineUsers(users) {
    const contactsList = document.querySelector('.contacts-list');
    contactsList.innerHTML = '';
    
    users.forEach(user => {
        if (user.userId !== auth.currentUser.uid) {
            const contactElement = createContactElement(user);
            contactsList.appendChild(contactElement);
        }
    });
}

function createContactElement(user) {
    const div = document.createElement('div');
    div.className = 'contact-item p-3 border-bottom';
    
    const profilePhoto = getProfilePhoto(user.photoURL);
    const presence = user.presence?.status === 'online' ? 
        '<span class="text-success">● online</span>' : 
        '<span class="text-secondary">● offline</span>';
    
    div.innerHTML = `
        <div class="d-flex align-items-center">
            <img src="${profilePhoto}" alt="${user.displayName}" class="rounded-circle me-3">
            <div>
                <h6 class="mb-0">${user.displayName}</h6>
                ${presence}
            </div>
        </div>
    `;
    
    div.onclick = () => selectContact(user);
    return div;
}

// Handle contact selection
function selectContact(user) {
    currentChatUser = user;
    updateChatHeader();
    highlightSelectedContact(user.userId);
    
    // Hide sidebar on mobile after selection
    if (window.innerWidth <= 768) {
        toggleSidebar();
    }
    // Clear messages when switching contacts
    document.querySelector('.messages-area').innerHTML = '';
}

function updateChatHeader() {
    if (!currentChatUser) return;
    
    const header = document.getElementById('currentChatHeader');
    const profilePhoto = getProfilePhoto(currentChatUser.photoURL);
    
    header.innerHTML = `
        <img src="${profilePhoto}" alt="${currentChatUser.displayName}" class="rounded-circle">
        <div class="contact-info">
            <h6 class="mb-0">${currentChatUser.displayName}</h6>
            <small>${currentChatUser.presence?.status === 'online' ? '● online' : '● offline'}</small>
        </div>
    `;
}

// Message handling
async function sendMessage() {
    if (!currentChatUser) return;
    
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (message) {
        const messageData = {
            text: message,
            userId: auth.currentUser.uid,
            recipientId: currentChatUser.userId,
            messageId: Date.now().toString(),
            timestamp: new Date().toISOString()
        };
        
        socket.emit('chat message', messageData);
        displayMessage({ ...messageData, sent: true });
        messageInput.value = '';
    }
}

function displayMessage(message) {
    // Only display if message is for current chat
    if (message.recipientId !== currentChatUser?.userId && 
        message.userId !== currentChatUser?.userId) {
        return;
    }
    
    const messagesArea = document.querySelector('.messages-area');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.type}`;
    
    messageElement.innerHTML = `
        ${message.text}
        <span class="message-time">${formatTime(new Date(message.timestamp))}</span>
        ${message.type === 'outgoing' ? '<span class="message-status"><i class="fas fa-check-double"></i></span>' : ''}
    `;
    
    messagesArea.appendChild(messageElement);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Modal handlers
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Bootstrap modals
    ['profileModal', 'logoutModal'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            modals[id] = new bootstrap.Modal(element);
        }
    });

    // Add click handlers
    document.querySelector('.fa-ellipsis-vertical').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Initialize theme
    initializeTheme();
});

window.showProfile = () => {
    const user = auth.currentUser;
    if (user && modals.profileModal) {
        document.getElementById('profileModalImage').src = getProfilePhoto(user.photoURL);
        document.getElementById('profileModalName').textContent = user.displayName;
        document.getElementById('profileModalEmail').textContent = user.email;
        modals.profileModal.show();
    }
};

window.toggleTheme = () => {
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const label = document.getElementById('themeLabel');
    if (label) {
        label.textContent = `${newTheme === 'light' ? 'Dark' : 'Light'} Mode`;
    }
    showToast(`Switched to ${newTheme} mode`);
};

window.handleLogout = () => {
    if (modals.logoutModal) {
        modals.logoutModal.show();
    }
};

window.confirmLogout = async () => {
    try {
        await auth.signOut();
        if (modals.logoutModal) {
            modals.logoutModal.hide();
        }
        window.location.reload();
    } catch (error) {
        console.error("Logout failed:", error);
        showToast("Logout failed");
    }
};

// Toast Notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }, 100);
}

// Utility functions
function getProfilePhoto(photoURL) {
    return photoURL || DEFAULT_AVATAR;
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Theme handling
const DEFAULT_THEME = 'light';

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeLabel(savedTheme);
}

function toggleTheme() {
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('themeLabel').textContent = 
        `${newTheme === 'light' ? 'Dark' : 'Light'} Mode`;

    // Show theme change notification
    showToast(`Switched to ${newTheme} mode`);
}

function updateThemeLabel(theme) {
    const themeLabel = document.getElementById('themeLabel');
    if (themeLabel) {
        themeLabel.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
    }
}

// Add mobile navigation handlers
function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.addEventListener('click', toggleSidebar);
    document.body.appendChild(overlay);
    return overlay;
}

window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    let overlay = document.querySelector('.overlay');
    
    if (!overlay) {
        overlay = createOverlay();
    }
    
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
}

// Event listeners
document.getElementById('googleLogin')?.addEventListener('click', handleGoogleLogin);
document.getElementById('sendMessage')?.addEventListener('click', sendMessage);
document.getElementById('messageInput')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});

// Initialize dropdown triggers
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Bootstrap dropdowns
    const dropdowns = document.querySelectorAll('[data-bs-toggle="dropdown"]');
    dropdowns.forEach(dropdown => {
        new bootstrap.Dropdown(dropdown);
    });
    
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeLabel').textContent = 
        `${savedTheme === 'light' ? 'Dark' : 'Light'} Mode`;
    
    initializeTheme();
});

// Close sidebar when window is resized to desktop size
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.overlay');
        if (sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
            overlay?.classList.remove('show');
        }
    }
});

// Initialize mobile view
document.addEventListener('DOMContentLoaded', () => {
    // Add swipe handlers for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });
    
    document.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });
    
    function handleSwipe() {
        const sidebar = document.querySelector('.sidebar');
        const swipeDistance = touchEndX - touchStartX;
        
        if (Math.abs(swipeDistance) > 50) {
            if (swipeDistance > 0) {
                sidebar.classList.add('show');
            } else {
                sidebar.classList.remove('show');
            }
        }
    }
});

// Initialize emoji picker
document.addEventListener('DOMContentLoaded', () => {
    $('#messageInput').emojioneArea({
        pickerPosition: "top",
        tonesStyle: "bullet",
        inline: false,
        hidePickerOnBlur: true,
        shortcuts: true,
        filtersPosition: "bottom",
        searchPosition: "bottom",
        saveEmojisAs: "unicode",
        events: {
            keyup: function(editor, event) {
                if (event.key === 'Enter' && !event.shiftKey) {
                    sendMessage();
                }
            }
        }
    });

    // Update message sending to work with emojionearea
    window.sendMessage = function() {
        const emojioneArea = $('#messageInput').data('emojioneArea');
        const message = emojioneArea.getText().trim();
        
        if (message && currentChatUser) {
            const messageData = {
                text: message,
                userId: auth.currentUser.uid,
                recipientId: currentChatUser.userId,
                messageId: Date.now().toString(),
                timestamp: new Date().toISOString()
            };
            
            socket.emit('chat message', messageData);
            emojioneArea.setText(''); // Clear input
        }
    };
});
