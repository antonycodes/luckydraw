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
    projectId: "realtime-database-ae7e8",
    storageBucket: "realtime-database-ae7e8.firebasestorage.app",
    databaseURL: "https://realtime-database-ae7e8-default-rtdb.firebaseio.com",
    messagingSenderId: "100354496957",
    appId: "1:100354496957:web:b3f92925dae08a7fe45ad4",
    measurementId: "G-341Q5WTRBW"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Database References ---
const stateRef = ref(db, 'lucky_draw/state');
const commandRef = ref(db, 'lucky_draw/command');
const candidatesRef = ref(db, 'lucky_draw/candidates');
const winnersRef = ref(db, 'lucky_draw/winners');
const settingsRef = ref(db, 'lucky_draw/settings');

// --- Write helpers ---
export const updateState = (data: Record<string, any>) => {
    return set(stateRef, data);
};

export const updateStateField = (field: string, value: any) => {
    const fieldRef = ref(db, `lucky_draw/state/${field}`);
    return set(fieldRef, value);
};

export const sendCommand = (type: string, payload: any = null) => {
    return set(commandRef, {
        type,
        payload,
        ts: Date.now()
    });
};

export const saveCandidates = (text: string) => {
    return set(candidatesRef, text);
};

export const saveWinners = (winners: any[]) => {
    // Convert Date objects to ISO strings for Firebase
    const serialized = winners.map(w => ({
        ...w,
        timestamp: w.timestamp instanceof Date ? w.timestamp.toISOString() : w.timestamp
    }));
    return set(winnersRef, serialized);
};

export const saveSettings = (settings: Record<string, any>) => {
    return set(settingsRef, settings);
};

// --- Read/Listen helpers ---
export const onStateChange = (callback: (data: any) => void) => {
    onValue(stateRef, (snapshot) => {
        const data = snapshot.val();
        if (data) callback(data);
    });
};

export const onCommandChange = (callback: (data: any) => void) => {
    let lastTs = 0;
    onValue(commandRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.ts > lastTs) {
            lastTs = data.ts;
            callback(data);
        }
    });
};

export const onCandidatesChange = (callback: (text: string) => void) => {
    onValue(candidatesRef, (snapshot) => {
        const data = snapshot.val();
        if (data !== null && data !== undefined) callback(data);
    });
};

export const onWinnersChange = (callback: (winners: any[]) => void) => {
    onValue(winnersRef, (snapshot) => {
        const data = snapshot.val();
        callback(data || []);
    });
};

export const onSettingsChange = (callback: (settings: any) => void) => {
    onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) callback(data);
    });
};

// --- Cleanup ---
export const detachListeners = () => {
    off(stateRef);
    off(commandRef);
    off(candidatesRef);
    off(winnersRef);
    off(settingsRef);
};

export { db, stateRef, commandRef, candidatesRef, winnersRef, settingsRef };
