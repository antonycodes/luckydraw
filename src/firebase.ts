import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, DatabaseReference } from 'firebase/database';

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

type FirebaseRefs = {
    db: ReturnType<typeof getDatabase>;
    stateRef: DatabaseReference;
    commandRef: DatabaseReference;
    candidatesRef: DatabaseReference;
    winnersRef: DatabaseReference;
    settingsRef: DatabaseReference;
};

let firebaseRefs: FirebaseRefs | null = null;

const getFirebaseRefs = (): FirebaseRefs => {
    if (!firebaseRefs) {
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        firebaseRefs = {
            db,
            stateRef: ref(db, 'lucky_draw/state'),
            commandRef: ref(db, 'lucky_draw/command'),
            candidatesRef: ref(db, 'lucky_draw/candidates'),
            winnersRef: ref(db, 'lucky_draw/winners'),
            settingsRef: ref(db, 'lucky_draw/settings'),
        };
    }
    return firebaseRefs;
};

// --- Write helpers ---
export const updateState = (data: Record<string, any>) => {
    return set(getFirebaseRefs().stateRef, data);
};

export const updateStateField = (field: string, value: any) => {
    const { db } = getFirebaseRefs();
    const fieldRef = ref(db, `lucky_draw/state/${field}`);
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
    if (!firebaseRefs) return;
    off(firebaseRefs.stateRef);
    off(firebaseRefs.commandRef);
    off(firebaseRefs.candidatesRef);
    off(firebaseRefs.winnersRef);
    off(firebaseRefs.settingsRef);
};
