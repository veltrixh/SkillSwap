const API_URL = 'http://127.0.0.1:8000/api';
let currentPage = 'landing';
let currentUser = null;
let currentToken = null;
let currentConversationId = null;
let currentChatPartner = null;
let pollInterval = null;
let skillsOffered = [];
let skillsWanted = [];
let modalTarget = null;
window.addEventListener('load', () => {
  const token = localStorage.getItem('skillswap_token');
  const user = localStorage.getItem('skillswap_user');
  
  if (token && user) {
    currentToken = token;
    currentUser = JSON.parse(user);
    showPage('discover');
    loadMatches();
    updateUserUI();
  }
});

(function() {
    setTimeout(function() {
      var s = document.getElementById('ss-splash');
      if (s) {
        s.classList.add('ss-done');
        setTimeout(function() { s.remove(); }, 550);
      }
    }, 4200);
  })();

function showPage(pageName) {

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  document.getElementById(`page-${pageName}`).classList.add('active');
  currentPage = pageName;
  

  if (pageName !== 'messages' && pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  

  if (pageName === 'profile' && currentUser) {
    loadProfile();
  }
  if (pageName === 'discover' && currentUser) {
    loadMatches();
    updateUserUI();
  }
}


function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}


async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
    ...options.headers
  };
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || 'Something went wrong');
    }
    
    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Make sure backend is running on port 8000.');
    }
    throw error;
  }
}


async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  const btn = document.getElementById('loginBtn');
  btn.innerHTML = '<div class="spinner"></div>';
  btn.disabled = true;
  
  try {

    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    

    currentToken = data.access_token;
    currentUser = data.user;
    localStorage.setItem('skillswap_token', currentToken);
    localStorage.setItem('skillswap_user', JSON.stringify(currentUser));
    
    showToast(`Welcome back, ${currentUser.full_name}! 👋`);
    updateUserUI();
    showPage('discover');
    loadMatches();
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.innerHTML = 'Log In';
    btn.disabled = false;
  }
}


async function doRegister() {
  const full_name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const university = document.getElementById('regUniversity').value.trim();
  
  if (!full_name || !email || !password) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  if (password.length < 8) {
    showToast('Password must be at least 8 characters', 'error');
    return;
  }
  
  const btn = document.getElementById('registerBtn');
  btn.innerHTML = '<div class="spinner"></div> Creating account...';
  btn.disabled = true;
  
  try {
  
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name, email, password, university,
        skills_offered: skillsOffered,
        skills_wanted: skillsWanted
      })
    });
    
   
    currentToken = data.access_token;
    currentUser = data.user;
    localStorage.setItem('skillswap_token', currentToken);
    localStorage.setItem('skillswap_user', JSON.stringify(currentUser));
    
    showToast(`Welcome to SkillSwap, ${currentUser.full_name}! 🎉`);
    updateUserUI();
    showPage('discover');
    loadMatches();
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.innerHTML = 'Next Step →';
    btn.disabled = false;
  }
}

function updateUserUI() {
  if (!currentUser) return;
  const initials = currentUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
  const color = currentUser.avatar_color || '#6366f1';
  
  const discoverAvatar = document.getElementById('discoverUserAvatar');
  if (discoverAvatar) { discoverAvatar.textContent = initials; discoverAvatar.style.background = color; }
  
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  if (sidebarAvatar) { sidebarAvatar.textContent = initials; sidebarAvatar.style.background = color; }
  
  const sidebarName = document.getElementById('sidebarName');
  if (sidebarName) sidebarName.textContent = currentUser.full_name;
  
  const sidebarUni = document.getElementById('sidebarUniversity');
  if (sidebarUni) sidebarUni.textContent = currentUser.university || 'Student';
}

function logout() {
  localStorage.removeItem('skillswap_token');
  localStorage.removeItem('skillswap_user');
  currentToken = null;
  currentUser = null;
  showPage('landing');
  showToast('Logged out successfully');
}


async function loadMatches() {
  if (!currentToken) return;
  try {
    const matches = await api('/users/matches');
    renderMatchCards(matches);
  } catch (error) {
    console.error('Load matches error:', error);
    renderDemoCards();
  }
}

function renderMatchCards(matches) {
  const grid = document.getElementById('matchCards');
  
  if (matches.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">🤝</div>
      <p>No matches yet. Add more skills to find swaps!</p>
    </div>`;
    return;
  }
  
  grid.innerHTML = matches.map(user => {
    const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    const color = user.avatar_color || '#6366f1';
    const rating = (4.5 + Math.random() * 0.5).toFixed(1);
    const reviews = Math.floor(Math.random() * 30) + 5;
    
    return `
    <div class="user-card">
      <button class="card-bookmark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      </button>
      <div class="card-header">
        <div class="card-avatar" style="background:${color}">${initials}</div>
        <div>
          <div class="card-name">${user.full_name}</div>
          <div class="card-rating">★ ${rating} <span style="color:var(--text-muted);font-weight:400">(${reviews} reviews)</span></div>
        </div>
      </div>
      <div class="skills-section">
        <div class="skills-label">OFFERS</div>
        <div class="tags-row">
          ${user.skills_offered.slice(0,3).map(s => `<span class="tag tag-offer">${s}</span>`).join('')}
        </div>
      </div>
      <div class="skills-section">
        <div class="skills-label">WANTS</div>
        <div class="tags-row">
          ${user.skills_wanted.slice(0,3).map(s => `<span class="tag tag-want">${s}</span>`).join('')}
        </div>
      </div>
      <button class="card-chat-btn" onclick="startChat('${user.id}', '${user.full_name}', '${color}', '${(user.skills_offered[0]||'Student')}')">
        Chat
      </button>
    </div>`;
  }).join('');
}

function renderDemoCards() {
  const demoUsers = [
    { id: 'demo1', full_name: 'Alex Rivera', avatar_color: '#6366f1', skills_offered: ['UI Design', 'Figma', 'Branding'], skills_wanted: ['Javascript', 'React Native'] },
    { id: 'demo2', full_name: 'Sam Chen', avatar_color: '#10b981', skills_offered: ['Python', 'Django'], skills_wanted: ['SQL', 'AWS Cloud', 'Docker'] },
    { id: 'demo3', full_name: 'Taylor Reed', avatar_color: '#f59e0b', skills_offered: ['Marketing', 'SEO'], skills_wanted: ['Photography', 'Video Editing'] },
    { id: 'demo4', full_name: 'Casey Lee', avatar_color: '#ec4899', skills_offered: ['Cooking', 'Baking'], skills_wanted: ['Gardening', 'Interior Design'] },
  ];
  renderMatchCards(demoUsers);
}

async function startChat(userId, userName, userColor, userSkill) {
  if (!currentToken) {
    showToast('Please login first', 'error');
    showPage('login');
    return;
  }
  
  try {
    
    const result = await api('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ participant_id: userId })
    });
    
    currentConversationId = result.conversation_id;
    currentChatPartner = { id: userId, name: userName, color: userColor, skill: userSkill };
    
    showPage('messages');
    loadConversations();
    openConversation(result.conversation_id, userName, userColor, userSkill);
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}
async function loadConversations() {
  if (!currentToken) return;
  
  try {

    const conversations = await api('/chat/conversations');
    renderConversationsList(conversations);
  } catch (error) {
    console.error('Load conversations error:', error);
  }
}

function renderConversationsList(conversations) {
  const list = document.getElementById('conversationsList');
  
  if (conversations.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:40px 20px">
      <div class="empty-state-icon">💬</div>
      <p>No conversations yet</p>
      <p style="font-size:0.8rem;margin-top:8px">Chat with someone from the Discover page</p>
    </div>`;
    return;
  }
  
  list.innerHTML = conversations.map(conv => {
    const initials = conv.other_user_name.split(' ').map(n => n[0]).join('').toUpperCase();
    const isActive = conv.id === currentConversationId;
    return `
    <div class="conv-item ${isActive ? 'active' : ''}" onclick="openConversation('${conv.id}', '${conv.other_user_name}', '#6366f1', '${conv.other_user_skill || 'Student'}')">
      <div class="conv-avatar-wrap">
        <div class="conv-avatar" style="background:#6366f1">${initials}</div>
        <div class="conv-online"></div>
      </div>
      <div class="conv-info">
        <div class="conv-name">${conv.other_user_name}</div>
        <div class="conv-skill">${conv.other_user_skill || 'Student'}</div>
        <div class="conv-last">${conv.last_message || 'Start the conversation!'}</div>
      </div>
      <div class="conv-time">${conv.last_message_time ? formatTime(conv.last_message_time) : ''}</div>
    </div>`;
  }).join('');
}

function openConversation(convId, partnerName, partnerColor, partnerSkill) {
  currentConversationId = convId;
  
  document.getElementById('chatEmpty').style.display = 'none';
  const chatActive = document.getElementById('chatActive');
  chatActive.style.display = 'flex';
  chatActive.style.flexDirection = 'column';
  chatActive.style.flex = '1';
  chatActive.style.overflow = 'hidden';
  
  const initials = partnerName.split(' ').map(n => n[0]).join('').toUpperCase();
  document.getElementById('chatPartnerAvatar').textContent = initials;
  document.getElementById('chatPartnerAvatar').style.background = partnerColor;
  document.getElementById('chatPartnerName').textContent = partnerName;
  
  loadMessages();
  
 
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(loadMessages, 3000);
}

async function loadMessages() {
  if (!currentConversationId || !currentToken) return;
  
  try {
    const messages = await api(`/chat/messages/${currentConversationId}`);
    renderMessages(messages);
  } catch (error) {
    console.error('Load messages error:', error);
  }
}

function renderMessages(messages) {
  const area = document.getElementById('messagesArea');
  const myId = currentUser?.id;
  
  area.innerHTML = '<div class="date-divider">TODAY</div>';
  
  messages.forEach(msg => {
    const isMine = msg.sender_id === myId;
    const initials = msg.sender_name.split(' ').map(n => n[0]).join('').toUpperCase();
    
    area.innerHTML += `
    <div class="message-row ${isMine ? 'mine' : ''}">
      ${!isMine ? `<div class="msg-avatar" style="background:#6366f1">${initials}</div>` : ''}
      <div class="msg-bubble">${escapeHtml(msg.content)}</div>
      ${isMine ? `<div class="msg-avatar" style="background:var(--primary)">${myId ? currentUser.full_name.split(' ').map(n=>n[0]).join('').toUpperCase() : 'Me'}</div>` : ''}
    </div>`;
  });
  
  area.scrollTop = area.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  
  if (!content || !currentConversationId) return;
  if (!currentToken) {
    showToast('Please login first', 'error');
    return;
  }
  
  input.value = '';
  
  try {
    await api('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: currentConversationId,
        content: content
      })
    });
    
    await loadMessages();
    loadConversations();
    
  } catch (error) {
    showToast(error.message, 'error');
    input.value = content;
  }
}

function loadProfile() {
  if (!currentUser) return;
  
  const initials = currentUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
  const color = currentUser.avatar_color || '#6366f1';
  
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileAvatar').style.background = color;
  document.getElementById('profileName').textContent = currentUser.full_name;
  document.getElementById('profileBio').textContent = `Skills: ${currentUser.skills_offered.join(', ') || 'Not set yet'}`;
  document.getElementById('profileUniversity').textContent = currentUser.university || 'University not set';
  document.getElementById('profileYear').textContent = currentUser.member_since || new Date().getFullYear();
  document.getElementById('profileCredits').textContent = currentUser.credits || 0;
  
  const teachGrid = document.getElementById('teachSkillsGrid');
  if (currentUser.skills_offered.length > 0) {
    teachGrid.innerHTML = currentUser.skills_offered.map(skill => `
    <div class="teach-card">
      <div class="teach-card-header">
        <div class="teach-skill-name">${skill}</div>
        <div class="teach-rating">★ 4.8</div>
      </div>
      <div class="teach-level">INTERMEDIATE</div>
      <div class="teach-description">Teaching ${skill} to fellow students. Connect to schedule a session!</div>
      <div class="tags-row"><span class="tag">${skill}</span></div>
    </div>`).join('');
  } else {
    teachGrid.innerHTML = '<div class="empty-state">Add skills you can teach in your profile!</div>';
  }

  const wantedTags = document.getElementById('wantedSkillsTags');
  wantedTags.innerHTML = currentUser.skills_wanted.map(skill =>
    `<span class="tag" style="background:var(--primary-light);color:var(--primary)">${skill}</span>`
  ).join('') || '<span style="color:var(--text-muted)">No skills added yet</span>';
}

let modalType = null;

function openModal(type) {
  modalType = type;
  document.getElementById('modalTitle').textContent = type === 'offered' ? 'Add Skill to Teach' : 'Add Skill to Learn';
  document.getElementById('skillInput').value = '';
  document.getElementById('skillModal').classList.add('open');
  setTimeout(() => document.getElementById('skillInput').focus(), 100);
}

function closeModal() {
  document.getElementById('skillModal').classList.remove('open');
  modalType = null;
}

function confirmAddSkill() {
  const skill = document.getElementById('skillInput').value.trim();
  if (!skill) return;
  
  if (modalType === 'offered') {
    if (!skillsOffered.includes(skill)) {
      skillsOffered.push(skill);
      renderPreviewSkills();
    }
  } else {
    if (!skillsWanted.includes(skill)) {
      skillsWanted.push(skill);
      renderPreviewSkills();
    }
  }
  closeModal();
}

function removeSkill(type, skill) {
  if (type === 'offered') {
    skillsOffered = skillsOffered.filter(s => s !== skill);
  } else {
    skillsWanted = skillsWanted.filter(s => s !== skill);
  }
  renderPreviewSkills();
}

function renderPreviewSkills() {
  const offeredDiv = document.getElementById('previewOffered');
  offeredDiv.innerHTML = skillsOffered.map(s =>
    `<span class="tag tag-offer">${s} <span class="remove" onclick="removeSkill('offered','${s}')" style="cursor:pointer">×</span></span>`
  ).join('') + `<button class="add-skill-btn" onclick="openModal('offered')">+ Add Skill</button>`;
  
  const wantedDiv = document.getElementById('previewWanted');
  wantedDiv.innerHTML = skillsWanted.map(s =>
    `<span class="tag tag-want">${s} <span class="remove" onclick="removeSkill('wanted','${s}')" style="cursor:pointer">×</span></span>`
  ).join('') + `<button class="add-skill-btn" onclick="openModal('wanted')">+ Add Skill</button>`;
}

function updatePreview() {

}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

document.getElementById('skillModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

document.getElementById('skillInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') confirmAddSkill();
});