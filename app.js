import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDIGeq9LTEkVfDrrDKlst0tqnABrmYjqIs",
  authDomain: "role-management-app-35181.firebaseapp.com",
  projectId: "role-management-app-35181",
  storageBucket: "role-management-app-35181.firebasestorage.app",
  messagingSenderId: "581484081501",
  appId: "1:581484081501:web:53b482c7a7a596b29e78b4"
};


const BACKEND_URL = "https://role-backend-ama2.onrender.com";; // Replace with your live backend API URL

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Auth Event Listeners
document.getElementById('btn-login').onclick = () => {
  signInWithEmailAndPassword(auth, getValue('email'), getValue('password')).catch(alert);
};

document.getElementById('btn-register').onclick = async () => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, getValue('email'), getValue('password'));
    // Default role on signup is incrementor
    await addDoc(collection(db, "users"), { uid: cred.user.uid, email: cred.user.email, role: "incrementor" });
  } catch (e) { alert(e.message); }
};

document.getElementById('btn-logout').onclick = () => signOut(auth);

// Auth State Change Handler
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('user-email').innerText = user.email;

    // Force token refresh to fetch updated claims
    const tokenResult = await user.getIdTokenResult(true);
    const role = tokenResult.claims.role || 'incrementor'; // Default fallback
    document.getElementById('user-role').innerText = role;

    renderPanels(role);
    listenToWork(role);
  } else {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
  }
});

function renderPanels(role) {
  if (role === 'admin') {
    document.getElementById('admin-panel').classList.remove('hidden');
    loadUsersList();
  }
  if (role === 'admin' || role === 'incrementor') {
    document.getElementById('incrementor-panel').classList.remove('hidden');
  }
}

// Work Management Logic
document.getElementById('btn-add-work').onclick = async () => {
  const title = getValue('work-title');
  if (title) {
    await addDoc(collection(db, "work"), { title, createdAt: new Date() });
    document.getElementById('work-title').value = '';
  }
};

function listenToWork(userRole) {
  onSnapshot(collection(db, "work"), (snapshot) => {
    const list = document.getElementById('work-list');
    list.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const li = document.createElement('li');
      li.innerText = data.title + " ";
      
      // Show Delete button if user is Admin or Decrementor
      if (userRole === 'admin' || userRole === 'decrementor') {
        const btnDelete = document.createElement('button');
        btnDelete.innerText = 'Delete';
        btnDelete.onclick = () => deleteDoc(doc(db, "work", docSnap.id));
        li.appendChild(btnDelete);
      }
      list.appendChild(li);
    });
  });
}

// Admin Logic: Fetch Users & Assign Roles
function loadUsersList() {
  onSnapshot(collection(db, "users"), (snapshot) => {
    const container = document.getElementById('users-list');
    container.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const u = docSnap.data();
      const div = document.createElement('div');
      div.innerHTML = `
        ${u.email} - Role: <b>${u.role}</b>
        <select onchange="updateUserRole('${u.uid}', this.value)">
          <option value="">Change Role</option>
          <option value="admin">Admin</option>
          <option value="incrementor">Incrementor</option>
          <option value="decrementor">Decrementor</option>
        </select>
      `;
      container.appendChild(div);
    });
  });
}

window.updateUserRole = async (targetUid, role) => {
  if (!role) return;
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${BACKEND_URL}/api/admin/set-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ targetUid, role })
  });
  const data = await res.json();
  alert(data.message || data.error);
};

const getValue = (id) => document.getElementById(id).value;