const express = require('express');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

// Load your Firebase Service Account Key
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin SDK using cert directly
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

// Middleware: Authenticate user ID token and check for 'admin' role
async function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Check if user is registered as an Admin in Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Role Management Backend Running');
});

// ADMIN ENDPOINT: Set role for a given user (admin, incrementor, decrementor)
app.post('/api/admin/set-role', verifyAdmin, async (req, res) => {
  const { targetUid, role } = req.body;
  
  const validRoles = ['admin', 'incrementor', 'decrementor'];
  if (!targetUid || !role || !validRoles.includes(role)) {
    return res.status(400).json({ 
      error: 'Invalid request parameters. Required: targetUid and role (admin, incrementor, or decrementor)' 
    });
  }

  try {
    // 1. Assign custom role claims to Firebase Auth account
    await auth.setCustomUserClaims(targetUid, { role });
    
    // 2. Sync the updated role in Firestore users collection
    await db.collection('users').doc(targetUid).set({ role }, { merge: true });

    return res.json({ 
      success: true, 
      message: `Successfully set user role to ${role}` 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});