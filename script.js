// ============ FIREBASE CONFIG ============
const firebaseConfig = {
    apiKey: "AIzaSyBR2z3ZFU7CBCfFhMGgTG2JEPRu-AJQbNs",
    authDomain: "shadowchat2-7395c.firebaseapp.com",
    databaseURL: "https://shadowchat2-7395c-default-rtdb.firebaseio.com",
    projectId: "shadowchat2-7395c",
    storageBucket: "shadowchat2-7395c.firebasestorage.app",
    messagingSenderId: "983012187140",
    appId: "1:983012187140:web:efa77398429b385f576951",
    measurementId: "G-Z3DGYPXW6F"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ============ GLOBAL STATE ============
let currentUser = null;
let currentChatId = null;
let currentChatUser = null;
let currentGroupId = null;
let allUsers = [];
let listeners = [];
let noxaInterval = null;

// ============ DOM REFS ============
const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const setupStep1 = document.getElementById('setup-step-1');
const setupStep2 = document.getElementById('setup-step-2');
const setupEmail = document.getElementById('setup-email');
const setupPassword = document.getElementById('setup-password');
const setupNext1 = document.getElementById('setup-next-1');
const setupUsername = document.getElementById('setup-username');
const usernameStatus = document.getElementById('username-status');
const setupFinish = document.getElementById('setup-finish');
const setupPhoto = document.getElementById('setup-photo');
const skipPhoto = document.getElementById('skip-photo');
const photoName = document.getElementById('photo-name');
const setupError = document.getElementById('setup-error');
const setupFinishError = document.getElementById('setup-finish-error');

// App pages
const pages = ['page-chats', 'page-groups', 'page-home', 'page-noxa', 'page-profile'];
const navItems = document.querySelectorAll('.nav-item');
const chatsList = document.getElementById('chats-list');
const groupsList = document.getElementById('groups-list');
const profileAvatar = document.getElementById('profile-avatar');
const profileUsername = document.getElementById('profile-username');
const profileEmail = document.getElementById('profile-email');
const profileGender = document.getElementById('profile-gender');

// Chat overlay
const chatOverlay = document.getElementById('chat-overlay');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const closeChat = document.getElementById('close-chat');
const chatPartnerName = document.getElementById('chat-partner-name');
const attachBtn = document.getElementById('attach-btn');
const attachOptions = document.getElementById('attach-options');

// NOXA
const noxaInput = document.getElementById('noxa-input');
const noxaSend = document.getElementById('noxa-send');
const noxaMessages = document.getElementById('noxa-messages');

// Search
const globalSearchBtn = document.getElementById('global-search-btn');
const searchOverlay = document.getElementById('search-overlay');
const closeSearch = document.getElementById('close-search');
const globalSearchInput = document.getElementById('global-search-input');
const searchResults = document.getElementById('search-results');

// Buttons
const newChatBtn = document.getElementById('new-chat-btn');
const newGroupBtn = document.getElementById('new-group-btn');
const logoutBtn = document.getElementById('logout-btn');
const editUsernameBtn = document.getElementById('edit-username-btn');
const hideUsernameBtn = document.getElementById('hide-username-btn');
const profilePhotoInput = document.getElementById('profile-photo-input');

// ============ AUTH & SETUP ============
setupNext1.onclick = async () => {
    const email = setupEmail.value.trim();
    const pass = setupPassword.value.trim();
    if (!email || !pass) { setupError.textContent = 'Please fill all fields.'; return; }
    setupError.textContent = '';
    try {
        await auth.createUserWithEmailAndPassword(email, pass);
        setupStep1.classList.remove('active');
        setupStep2.classList.add('active');
    } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
            try {
                await auth.signInWithEmailAndPassword(email, pass);
                setupStep1.classList.remove('active');
                setupStep2.classList.add('active');
            } catch (err) { setupError.textContent = err.message; }
        } else { setupError.textContent = e.message; }
    }
};

setupUsername.addEventListener('input', async () => {
    const val = setupUsername.value.trim();
    if (val.length < 3) { usernameStatus.className = 'status-msg error'; usernameStatus.textContent = 'Min 3 chars.'; return; }
    const snapshot = await db.collection('users').where('username', '==', val).get();
    if (!snapshot.empty) { usernameStatus.className = 'status-msg error'; usernameStatus.textContent = 'Username taken!'; }
    else { usernameStatus.className = 'status-msg success'; usernameStatus.textContent = 'Available!'; }
});

skipPhoto.onclick = () => { setupPhoto.value = ''; photoName.textContent = 'Profile Photo (Optional)'; };
setupPhoto.onchange = (e) => { if (e.target.files[0]) photoName.textContent = e.target.files[0].name; };

setupFinish.onclick = async () => {
    const username = setupUsername.value.trim();
    const gender = document.querySelector('input[name="gender"]:checked')?.value || 'Male';
    const file = setupPhoto.files[0];
    if (!username) { setupFinishError.textContent = 'Enter a username.'; return; }
    const snapshot = await db.collection('users').where('username', '==', username).get();
    if (!snapshot.empty) { setupFinishError.textContent = 'Username taken.'; return; }
    setupFinishError.textContent = '';
    const user = auth.currentUser;
    if (!user) return;
    let photoURL = 'https://via.placeholder.com/100/2a2a2a/fff?text=User';
    if (file) {
        const ref = storage.ref(`profiles/${user.uid}`);
        await ref.put(file);
        photoURL = await ref.getDownloadURL();
    }
    await db.collection('users').doc(user.uid).set({
        uid: user.uid,
        email: user.email,
        username: username,
        gender: gender,
        photoURL: photoURL,
        hideUsername: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Auto login
    setupScreen.classList.remove('active');
    appScreen.classList.add('active');
    initApp();
};

// ============ APP INIT ============
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists) { setupScreen.classList.add('active'); return; }
        currentUser = { uid: user.uid, ...doc.data() };
        setupScreen.classList.remove('active');
        appScreen.classList.add('active');
        initApp();
    } else {
        setupScreen.classList.add('active');
        appScreen.classList.remove('active');
    }
});

function initApp() {
    if (!currentUser) return;
    profileAvatar.src = currentUser.photoURL || 'https://via.placeholder.com/100/2a2a2a/fff?text=User';
    profileUsername.textContent = '@' + currentUser.username;
    profileEmail.textContent = currentUser.email;
    profileGender.textContent = 'Gender: ' + currentUser.gender;
    loadChats();
    loadGroups();
    loadAllUsers();
    // NOXA bot initial
    if (!noxaInterval) {
        noxaInterval = setInterval(() => {
            // random typing effect or just keep alive
        }, 5000);
    }
}

// ============ NAVIGATION ============
navItems.forEach(item => {
    item.onclick = () => {
        const pageId = item.dataset.page;
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        pages.forEach(p => document.getElementById(p).classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        // Close overlays
        chatOverlay.classList.remove('active');
        searchOverlay.classList.remove('active');
    };
});

// ============ LOAD USERS ============
async function loadAllUsers() {
    const snapshot = await db.collection('users').get();
    allUsers = [];
    snapshot.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
}

// ============ LOAD CHATS ============
function loadChats() {
    if (!currentUser) return;
    const listener = db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('updatedAt', 'desc')
        .onSnapshot(snapshot => {
            chatsList.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const otherId = data.participants.find(id => id !== currentUser.uid);
                db.collection('users').doc(otherId).get().then(userDoc => {
                    if (!userDoc.exists) return;
                    const u = userDoc.data();
                    const div = document.createElement('div');
                    div.className = 'chat-item';
                    div.innerHTML = `
                        <div class="avatar"><img src="${u.photoURL || 'https://via.placeholder.com/50/2a2a2a/fff?text=U'}" alt=""></div>
                        <div class="chat-info"><h4>${u.username}</h4><p>${data.lastMessage || 'Tap to chat'}</p></div>
                        <div class="chat-time">${data.updatedAt?.toDate?.()?.toLocaleTimeString() || ''}</div>
                    `;
                    div.onclick = () => openChat(otherId, u.username, u.photoURL);
                    chatsList.appendChild(div);
                });
            });
        });
    listeners.push(listener);
}

// ============ LOAD GROUPS ============
function loadGroups() {
    if (!currentUser) return;
    const listener = db.collection('groups')
        .where('members', 'array-contains', currentUser.uid)
        .onSnapshot(snapshot => {
            groupsList.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const div = document.createElement('div');
                div.className = 'group-item';
                div.innerHTML = `
                    <div class="avatar"><i class="fas fa-users" style="font-size:1.5rem;"></i></div>
                    <div class="chat-info"><h4>${data.name}</h4><p>${data.members?.length || 0} members</p></div>
                `;
                div.onclick = () => openGroupChat(doc.id);
                groupsList.appendChild(div);
            });
        });
    listeners.push(listener);
}

// ============ OPEN CHAT ============
function openChat(otherId, username, photoURL) {
    currentChatUser = { id: otherId, username, photoURL };
    const chatId = [currentUser.uid, otherId].sort().join('_');
    currentChatId = chatId;
    chatPartnerName.textContent = username;
    chatOverlay.classList.add('active');
    chatMessages.innerHTML = '';
    // Ensure chat doc exists
    db.collection('chats').doc(chatId).set({
        participants: [currentUser.uid, otherId],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    // Load messages
    const listener = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snap => {
            chatMessages.innerHTML = '';
            snap.forEach(doc => {
                const msg = doc.data();
                const div = document.createElement('div');
                div.className = `message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
                let content = msg.text || '';
                if (msg.type === 'image') content = `<img src="${msg.url}" style="max-width:200px;border-radius:10px;">`;
                if (msg.type === 'video') content = `<video src="${msg.url}" controls style="max-width:200px;border-radius:10px;"></video>`;
                if (msg.type === 'poll') content = `📊 Poll: ${msg.question} - Options: ${msg.options?.join(', ')}`;
                div.innerHTML = `<div class="bubble">${content}</div><div class="time">${msg.timestamp?.toDate?.()?.toLocaleTimeString() || ''}</div>`;
                chatMessages.appendChild(div);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    listeners.push(listener);
}

// Send message
chatSend.onclick = sendMessage;
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !currentChatId) return;
    chatInput.value = '';
    await db.collection('chats').doc(currentChatId).collection('messages').add({
        senderId: currentUser.uid,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'text'
    });
    await db.collection('chats').doc(currentChatId).update({
        lastMessage: text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

closeChat.onclick = () => {
    chatOverlay.classList.remove('active');
    listeners.forEach(unsub => unsub());
    listeners = [];
};

// ============ GROUP CHAT ============
async function openGroupChat(groupId) {
    currentGroupId = groupId;
    const doc = await db.collection('groups').doc(groupId).get();
    if (!doc.exists) return;
    const data = doc.data();
    chatPartnerName.textContent = data.name + ' (Group)';
    chatOverlay.classList.add('active');
    chatMessages.innerHTML = '';
    const listener = db.collection('groups').doc(groupId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snap => {
            chatMessages.innerHTML = '';
            snap.forEach(doc => {
                const msg = doc.data();
                const div = document.createElement('div');
                div.className = `message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
                div.innerHTML = `<div class="bubble">${msg.text || ''}</div><div class="time">${msg.timestamp?.toDate?.()?.toLocaleTimeString() || ''}</div>`;
                chatMessages.appendChild(div);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    listeners.push(listener);
}

// ============ NEW CHAT (SEARCH) ============
globalSearchBtn.onclick = () => {
    searchOverlay.classList.add('active');
    globalSearchInput.value = '';
    searchResults.innerHTML = '';
    globalSearchInput.focus();
};
closeSearch.onclick = () => searchOverlay.classList.remove('active');

globalSearchInput.addEventListener('input', async () => {
    const query = globalSearchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    if (!query) return;
    const snapshot = await db.collection('users').get();
    snapshot.forEach(doc => {
        const u = doc.data();
        if (u.uid === currentUser.uid) return;
        if (u.hideUsername) return;
        if (u.username.toLowerCase().includes(query)) {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<i class="fas fa-user"></i> @${u.username} (${u.gender})`;
            div.onclick = () => {
                searchOverlay.classList.remove('active');
                openChat(u.uid, u.username, u.photoURL);
            };
            searchResults.appendChild(div);
        }
    });
});

// ============ NEW GROUP ============
newGroupBtn.onclick = async () => {
    const name = prompt('Enter Group Name:');
    if (!name) return;
    const docRef = await db.collection('groups').add({
        name: name,
        description: 'Group chat',
        members: [currentUser.uid],
        admins: [currentUser.uid],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Group created!');
    loadGroups();
};

// ============ NOXA AI ============
noxaSend.onclick = sendNoxa;
noxaInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendNoxa(); });

const noxaResponses = {
    'hello': 'Hi there! How can I help you today?',
    'how are you': "I'm just a bunch of code, but I'm doing great! 😄",
    'what is your name': "I am NOXA AI, your virtual assistant.",
    'who created you': "I was built by Developer Matheesha Sasmin for ZypherChats.",
    'bye': 'Goodbye! See you later. 👋',
    'default': "Interesting! Tell me more. 🤖"
};

function sendNoxa() {
    const text = noxaInput.value.trim();
    if (!text) return;
    noxaInput.value = '';
    // User message
    const userDiv = document.createElement('div');
    userDiv.className = 'message sent';
    userDiv.innerHTML = `<div class="bubble">${text}</div>`;
    noxaMessages.appendChild(userDiv);
    noxaMessages.scrollTop = noxaMessages.scrollHeight;
    // Bot response
    setTimeout(() => {
        const reply = getNoxaReply(text);
        const botDiv = document.createElement('div');
        botDiv.className = 'message received';
        botDiv.innerHTML = `<div class="bubble">${reply}</div>`;
        noxaMessages.appendChild(botDiv);
        noxaMessages.scrollTop = noxaMessages.scrollHeight;
    }, 500);
}

function getNoxaReply(text) {
    const lower = text.toLowerCase();
    for (let key in noxaResponses) {
        if (lower.includes(key)) return noxaResponses[key];
    }
    return noxaResponses['default'];
}

// ============ PROFILE SETTINGS ============
editUsernameBtn.onclick = async () => {
    const newName = prompt('Enter new username:', currentUser.username);
    if (!newName || newName === currentUser.username) return;
    const snapshot = await db.collection('users').where('username', '==', newName).get();
    if (!snapshot.empty) { alert('Username taken!'); return; }
    await db.collection('users').doc(currentUser.uid).update({ username: newName });
    currentUser.username = newName;
    profileUsername.textContent = '@' + newName;
    alert('Username updated!');
};

hideUsernameBtn.onclick = async () => {
    const current = currentUser.hideUsername || false;
    const newVal = !current;
    await db.collection('users').doc(currentUser.uid).update({ hideUsername: newVal });
    currentUser.hideUsername = newVal;
    alert(`Username is now ${newVal ? 'HIDDEN' : 'VISIBLE'} in search.`);
};

profilePhotoInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ref = storage.ref(`profiles/${currentUser.uid}`);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.collection('users').doc(currentUser.uid).update({ photoURL: url });
    currentUser.photoURL = url;
    profileAvatar.src = url;
    alert('Photo updated!');
};

logoutBtn.onclick = () => {
    auth.signOut();
    location.reload();
};

// Attachments (basic)
attachBtn.onclick = () => {
    attachOptions.style.display = attachOptions.style.display === 'none' ? 'flex' : 'none';
};

document.getElementById('attach-photo').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    const ref = storage.ref(`chat_media/${Date.now()}_${file.name}`);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.collection('chats').doc(currentChatId).collection('messages').add({
        senderId: currentUser.uid,
        type: 'image',
        url: url,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Photo sent!');
};

document.getElementById('send-poll-btn').onclick = async () => {
    const q = document.getElementById('poll-question').value;
    if (!q || !currentChatId) return;
    const opts = prompt('Enter options separated by comma (e.g. Yes, No)');
    if (!opts) return;
    await db.collection('chats').doc(currentChatId).collection('messages').add({
        senderId: currentUser.uid,
        type: 'poll',
        question: q,
        options: opts.split(',').map(s => s.trim()),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('poll-question').value = '';
    alert('Poll sent!');
};

// ============ INITIAL SETUP CHECK ============
if (auth.currentUser) {
    setupScreen.classList.remove('active');
    appScreen.classList.add('active');
    initApp();
} else {
    setupScreen.classList.add('active');
}

console.log('🔥 ZypherChats loaded successfully! Developer: Matheesha Sasmin');
