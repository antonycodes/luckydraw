const STORAGE_KEY = 'lucky-draw-offline-v1';
const COMMAND_KEY = 'lucky-draw-offline-command';
const CHANNEL_NAME = 'lucky-draw-offline';

export type OfflineState = {
    bgImage: string;
    prize: { name: string; image: string };
    candidates: string;
    winners: any[];
    removeWinner: boolean;
};

const DEFAULT_STATE: OfflineState = {
    bgImage: 'radial-gradient(ellipse at 50% 35%, #2a0202 0%, #120000 55%, #000000 100%)',
    prize: { name: 'THÀNH VIÊN S-STUDENT', image: '' },
    candidates: '',
    winners: [],
    removeWinner: true,
};

let channel: BroadcastChannel | null = null;
let storageWarningShown = false;

const getChannel = () => {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
    return channel;
};

export const loadOfflineState = (): OfflineState => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
    } catch {
        return DEFAULT_STATE;
    }
};

export const hasOfflineState = () => {
    try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
};

export const updateOfflineState = (patch: Partial<OfflineState>) => {
    const next = { ...loadOfflineState(), ...patch };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        if (!storageWarningShown) {
            storageWarningShown = true;
            window.alert('Không thể lưu dữ liệu offline. Hãy xuất kết quả CSV ngay.');
        }
    }
    getChannel()?.postMessage({ id: `${Date.now()}-${Math.random()}`, type: 'state', payload: patch });
    return next;
};

export const sendOfflineCommand = (type: string, payload: any = null) => {
    const message = { id: `${Date.now()}-${Math.random()}`, type: 'command', payload: { type, payload } };
    const activeChannel = getChannel();
    if (activeChannel) {
        activeChannel.postMessage(message);
    } else {
        try { localStorage.setItem(COMMAND_KEY, JSON.stringify(message)); } catch { /* no-op */ }
    }
};

export const subscribeOffline = (callback: (message: { type: string; payload: any }) => void) => {
    const activeChannel = getChannel();
    const handle = (message: any) => {
        if (!message?.id) return;
        callback({ type: message.type, payload: message.payload });
    };
    const handleChannel = (event: MessageEvent) => handle(event.data);
    const handleStorage = (event: StorageEvent) => {
        if (event.key !== COMMAND_KEY || !event.newValue) return;
        try { handle(JSON.parse(event.newValue)); } catch { /* ignore malformed storage events */ }
    };

    activeChannel?.addEventListener('message', handleChannel);
    window.addEventListener('storage', handleStorage);
    return () => {
        activeChannel?.removeEventListener('message', handleChannel);
        window.removeEventListener('storage', handleStorage);
    };
};
