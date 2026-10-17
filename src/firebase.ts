import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, runTransaction, get, remove } from 'firebase/database';
import { getAuth, onAuthStateChanged, sendEmailVerification, signInAnonymously, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';

// ============================================================
// 🔧 FIREBASE CONFIG — Replace with your own Firebase project
// Go to: https://console.firebase.google.com
// Create a project → Realtime Database → Copy config
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDj9xyuE6a5xY0ZH9V79dSX3DrJS_L8TqI",
    authDomain: "realtime-database-ae7e8.firebaseapp.com",
    databaseURL: "https://realtime-database-ae7e8-default-rtdb.firebaseio.com",
    projectId: "realtime-database-ae7e8",
    storageBucket: "realtime-database-ae7e8.firebasestorage.app",
    messagingSenderId: "100354496957",
    appId: "1:100354496957:web:b3f92925dae08a7fe45ad4",
    measurementId: "G-341Q5WTRBW"
};

let firebaseDb: ReturnType<typeof getDatabase> | null = null;
let sessionAuthPromise: Promise<User> | null = null;
export const ADMIN_EMAIL = 'nhanntl18402@gmail.com';
let activeSessionId = '';

export const normalizeSessionId = (value: string) => value.trim().toUpperCase();
const databaseSessionId = (value: string) => value.replace(/\./g, '%2E');
export const isValidSessionId = (value: string) => /^[A-Z0-9_.-]+$/.test(value) && databaseSessionId(value).length <= 768;
export const setActiveSession = (sessionId: string) => { activeSessionId = normalizeSessionId(sessionId); };
const sessionPath = (name: string) => `sessions/${databaseSessionId(activeSessionId)}/${name}`;

const getFirebaseApp = () => getApps().length ? getApp() : initializeApp(firebaseConfig);
export const ensureSessionAuth = () => sessionAuthPromise ||= (async () => {
    const auth = getAuth(getFirebaseApp());
    await auth.authStateReady();
    return auth.currentUser || (await signInAnonymously(auth)).user;
})().finally(() => { sessionAuthPromise = null; });

export const signInAdmin = async (password: string) => {
    const { user } = await signInWithEmailAndPassword(getAuth(getFirebaseApp()), ADMIN_EMAIL, password);
    if (!user.emailVerified) {
        await sendEmailVerification(user);
        throw new Error('email-not-verified');
    }
    return user;
};

export const signOutAdmin = () => signOut(getAuth(getFirebaseApp()));
export const watchAdminAuth = (callback: (user: User | null) => void) => {
    const auth = getAuth(getFirebaseApp());
    return onAuthStateChanged(auth, user => callback(user?.email === ADMIN_EMAIL && user.emailVerified ? user : null));
};

export const createSession = async (sessionId: string) => {
    const code = normalizeSessionId(sessionId);
    if (!isValidSessionId(code)) return false;
    const user = await ensureSessionAuth();
    const { db } = getFirebaseRefs();
    const result = await runTransaction(ref(db, `sessions/${databaseSessionId(code)}/info`), current => current === null ? { createdAt: Date.now() } : undefined);
    if (result.committed) await set(ref(db, `sessions/${databaseSessionId(code)}/members/${user.uid}`), true);
    return result.committed;
};

export const joinSession = async (sessionId: string) => {
    const code = normalizeSessionId(sessionId);
    if (!isValidSessionId(code)) return false;
    const user = await ensureSessionAuth();
    const { db } = getFirebaseRefs();
    const dbCode = databaseSessionId(code);
    const snapshot = await get(ref(db, `sessions/${dbCode}/info`));
    if (!snapshot.exists()) return false;
    await set(ref(db, `sessions/${dbCode}/members/${user.uid}`), true);
    return true;
};

export const getAllSessions = async () => {
    const snapshot = await get(ref(getFirebaseRefs().db, 'sessions'));
    return Object.entries(snapshot.val() || {}).map(([dbCode, data]: [string, any]) => ({
        code: dbCode.replace(/%2E/g, '.'),
        createdAt: data.info?.createdAt || 0,
        candidateCount: typeof data.candidates === 'string' ? data.candidates.split(/\r?\n/).filter(Boolean).length : 0,
        winnerCount: data.winners ? Object.keys(data.winners).length : 0,
    })).sort((a, b) => b.createdAt - a.createdAt);
};

export const deleteSession = (sessionId: string) => {
    if (!isValidSessionId(normalizeSessionId(sessionId))) throw new Error('invalid-session-id');
    return remove(ref(getFirebaseRefs().db, `sessions/${databaseSessionId(normalizeSessionId(sessionId))}`));
};

const getFirebaseRefs = () => {
    if (!firebaseDb) {
        const app = getFirebaseApp();
        firebaseDb = getDatabase(app);
    }
    const db = firebaseDb;
    return {
        db,
        stateRef: ref(db, sessionPath('state')),
        commandRef: ref(db, sessionPath('command')),
        candidatesRef: ref(db, sessionPath('candidates')),
        winnersRef: ref(db, sessionPath('winners')),
        settingsRef: ref(db, sessionPath('settings')),
    };
};

// --- Write helpers ---
export const updateState = (data: Record<string, any>) => {
    return set(getFirebaseRefs().stateRef, data);
};

export const updateStateField = (field: string, value: any) => {
    const { db } = getFirebaseRefs();
    const fieldRef = ref(db, sessionPath(`state/${field}`));
    return set(fieldRef, value);
};

export const sendCommand = (type: string, payload: any = null) => {
    return set(getFirebaseRefs().commandRef, {
        type,
        payload,
        ts: Date.now()
    });
};

export const saveCandidates = (text: string) => {
    return set(getFirebaseRefs().candidatesRef, text);
};

export const saveWinners = (winners: any[]) => {
    // Convert Date objects to ISO strings for Firebase
    const serialized = winners.map(w => ({
        ...w,
        timestamp: w.timestamp instanceof Date ? w.timestamp.toISOString() : w.timestamp
    }));
    return set(getFirebaseRefs().winnersRef, serialized);
};

export const saveSettings = (settings: Record<string, any>) => {
    return set(getFirebaseRefs().settingsRef, settings);
};

// --- Read/Listen helpers ---
export const onStateChange = (callback: (data: any) => void) => {
    const { stateRef } = getFirebaseRefs();
    onValue(stateRef, (snapshot) => {
        const data = snapshot.val();
        if (data) callback(data);
    });
};

export const onCommandChange = (callback: (data: any) => void) => {
    const { commandRef } = getFirebaseRefs();
    let isFirst = true;
    onValue(commandRef, (snapshot) => {
        const data = snapshot.val();
        if (isFirst) {
            isFirst = false;
            return;
        }
        if (data) {
            callback(data);
        }
    });
};

export const onCandidatesChange = (callback: (text: string) => void) => {
    const { candidatesRef } = getFirebaseRefs();
    onValue(candidatesRef, (snapshot) => {
        const data = snapshot.val();
        if (data !== null && data !== undefined) callback(data);
    });
};

export const onWinnersChange = (callback: (winners: any[]) => void) => {
    const { winnersRef } = getFirebaseRefs();
    onValue(winnersRef, (snapshot) => {
        const data = snapshot.val();
        callback(data || []);
    });
};

export const onSettingsChange = (callback: (settings: any) => void) => {
    const { settingsRef } = getFirebaseRefs();
    onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) callback(data);
    });
};

// --- Cleanup ---
export const detachListeners = () => {
    if (!firebaseDb) return;
    off(ref(firebaseDb, sessionPath('state')));
    off(ref(firebaseDb, sessionPath('command')));
    off(ref(firebaseDb, sessionPath('candidates')));
    off(ref(firebaseDb, sessionPath('winners')));
    off(ref(firebaseDb, sessionPath('settings')));
};
