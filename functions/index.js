const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const WEB_API_KEY = defineString('FIREBASE_WEB_API_KEY');

exports.loginWithIdentifier = onCall({ region: 'europe-west1' }, async (request) => {
  const identifier = String(request.data?.identifier || '').trim();
  const password = String(request.data?.password || '');
  if (!identifier || !password || password.length > 256) {
    throw new HttpsError('invalid-argument', 'E-posta/kullanıcı adı ve şifre gerekli.');
  }

  let email = identifier.toLowerCase();
  let expectedUid = null;
  if (!identifier.includes('@')) {
    const nickname = identifier.toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(nickname)) {
      throw new HttpsError('unauthenticated', 'USERNAME_NOT_FOUND');
    }
    const claim = await db.collection('usernames').doc(nickname).get();
    if (!claim.exists || !claim.get('uid')) {
      throw new HttpsError('unauthenticated', 'USERNAME_NOT_FOUND');
    }
    expectedUid = claim.get('uid');
    const userDoc = await db.collection('users').doc(expectedUid).get();
    if (!userDoc.exists || !userDoc.get('email')) {
      throw new HttpsError('unauthenticated', 'USERNAME_NOT_FOUND');
    }
    email = String(userDoc.get('email')).toLowerCase();
  }

  let authResult;
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY.value()}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    authResult = await response.json();
    if (!response.ok) throw new Error(authResult?.error?.message || 'INVALID_LOGIN');
  } catch (error) {
    throw new HttpsError('unauthenticated', 'E-posta/kullanıcı adı veya şifre hatalı.');
  }

  if (expectedUid && authResult.localId !== expectedUid) {
    throw new HttpsError('unauthenticated', 'E-posta/kullanıcı adı veya şifre hatalı.');
  }
  if (authResult.emailVerified !== true) {
    throw new HttpsError('failed-precondition', 'EMAIL_NOT_VERIFIED');
  }
  const customToken = await getAuth().createCustomToken(authResult.localId);
  return { customToken };
});
