import React, { useState, useEffect, useRef } from 'react';
import { ADMIN_EMAIL, sendCommand, updateStateField, saveWinners, saveCandidates, onWinnersChange, onCandidatesChange, onStateChange, detachListeners, setActiveSession, joinSession, signInAdmin, signOutAdmin, watchAdminAuth, getAllSessions, deleteSession } from './firebase';

const parseCandidates = (text: string) => {
    return text.split(/\r?\n/).filter(line => line.trim() !== '').map(parseCandidateLine).filter(candidate => candidate.id || candidate.name);
};

const parseCandidateLine = (line: string) => {
    let parts = line.includes('\t') ? line.split('\t') : line.split(',');
    if (parts.length < 2) parts = line.split('-');
    if (parts.length >= 2) return { id: parts[0].trim(), name: parts.slice(1).join(' ').trim() };
    return { id: line.trim(), name: '' };
};

const parseEditableCandidates = (text: string) => text.split(/\r?\n/).filter(line => line.trim() !== '').map(parseCandidateLine);

const serializeCandidates = (candidates: any[]) => candidates
    .map(candidate => candidate.name ? `${candidate.id}, ${candidate.name}` : candidate.id)
    .join('\n');

const splitCandidateColumns = (text: string) => {
    const rows = parseEditableCandidates(text);
    return {
        ids: rows.map(candidate => candidate.id).join('\n'),
        names: rows.map(candidate => candidate.name).join('\n')
    };
};

const combineCandidateColumns = (ids: string, names: string) => {
    if (!ids.trim() && !names.trim()) return '';
    const idRows = ids.split(/\r?\n/);
    const nameRows = names.split(/\r?\n/);
    const rowCount = Math.max(idRows.length, nameRows.length);
    return Array.from({ length: rowCount }, (_, index) => `${idRows[index]?.trim() || ''}\t${nameRows[index]?.trim() || ''}`).join('\n').trimEnd();
};

const PAGE_SIZE = 30;

type AdminSession = { code: string; createdAt: number; candidateCount: number; winnerCount: number };

const AdminPanel = ({ sessionId = '' }: { sessionId?: string }) => {
    const [prize, setPrize] = useState({ name: "Samsung Galaxy Buds Core (ANC)", image: "https://res.cloudinary.com/dxikjdqqn/image/upload/v1775861881/BUDS_CORE_yxhucn.png" });
    const [winners, setWinners] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [winnerCount, setWinnerCount] = useState(1);
    const [removeWinner, setRemoveWinner] = useState(true);
    const [bgImage, setBgImage] = useState('url("https://res.cloudinary.com/dxikjdqqn/image/upload/v1776474005/BG_SLIDE_184_Light_io8uno.png")');
    const [customSound, setCustomSound] = useState<string | null>(null);
    const [soundName, setSoundName] = useState('Chọn file MP3/WAV...');
    const [inputText, setInputText] = useState("090****5678, Nguyễn Hoàng Long\n091****6789, Trịnh Thu Hà\n092****7890, Lý Quốc Bảo\n093****8901, Dương Minh Đức\n094****9012, Nguyễn Thảo Vy\n095****0123, Trần Gia Bảo\n096****1234, Lê Phương Anh\n097****2345, Phạm Đức Anh\n098****3456, Võ Khánh Linh\n099****4567, Huỳnh Nhật Minh\n090****6789, Đinh Quang Huy\n091****7890, Cao Bảo Ngọc\n092****8901, Mai Anh Tuấn\n093****9012, Tạ Ngọc Mai\n094****0123, Ngô Minh Khang\n095****1234, Phan Gia Linh\n096****2345, Đoàn Quốc Việt\n097****3456, Trương Khả Hân\n098****4567, Hồ Thanh Phong\n099****5678, Vũ Bảo Trâm");
    const [activeSection, setActiveSection] = useState(sessionId ? 'logs' : 'sessions');
    const [activeScene, setActiveScene] = useState<'spin' | 'prize' | 'winners'>('spin');
    const [spinDuration, setSpinDuration] = useState(10);
    const [connected, setConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const [authError, setAuthError] = useState('');
    const [sessions, setSessions] = useState<AdminSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionsError, setSessionsError] = useState('');
    const [inputIds, setInputIds] = useState(() => splitCandidateColumns(inputText).ids);
    const [inputNames, setInputNames] = useState(() => splitCandidateColumns(inputText).names);
    const [showDataTable, setShowDataTable] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const audioRef = useRef(new Audio());
    const audioCtxRef = useRef<AudioContext | null>(null);

    const syncImportData = (text: string) => {
        const columns = splitCandidateColumns(text);
        setInputText(text);
        setInputIds(columns.ids);
        setInputNames(columns.names);
    };

    useEffect(() => {
        const unsubscribe = watchAdminAuth(user => setIsAuthenticated(!!user));
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!sessionId) return;
        setActiveSession(sessionId);
        let active = true;
        joinSession(sessionId).then(exists => {
            if (!active) return;
            if (!exists) { setConnected(false); return; }
            onWinnersChange((w) => setWinners(w));
            onCandidatesChange((text) => syncImportData(text));
            onStateChange((data) => {
                if (data.bgImage !== undefined) setBgImage(data.bgImage);
                if (data.prize !== undefined) setPrize(data.prize);
            });
            setConnected(true);
        }).catch(() => { if (active) setConnected(false); });

        return () => { active = false; detachListeners(); };
    }, [sessionId]);

    useEffect(() => {
        if (activeSection !== 'sessions' || !isAuthenticated) return;
        setSessionsLoading(true);
        setSessionsError('');
        getAllSessions().then(setSessions).catch(() => setSessionsError('Không thể tải phiên. Kiểm tra quyền Firebase.')).finally(() => setSessionsLoading(false));
    }, [activeSection, isAuthenticated]);

    useEffect(() => {
        if (customSound) {
            audioRef.current.src = customSound;
        } else {
            audioRef.current = new Audio();
        }
    }, [customSound]);

    const addLog = (action: string, detail: string) => {
        const time = new Date().toLocaleString('vi-VN');
        setLogs(prev => [{ time, action, detail }, ...prev]);
    };

    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    };

    const playTickSound = () => {
        if (customSound) return;
        if (!audioCtxRef.current) return;
        const oscillator = audioCtxRef.current.createOscillator();
        const gainNode = audioCtxRef.current.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = 150 + Math.random() * 50;
        gainNode.gain.value = 0.05;
        oscillator.connect(gainNode);
        gainNode.connect(audioCtxRef.current.destination);
        oscillator.start();
        oscillator.stop(audioCtxRef.current.currentTime + 0.05);
    };

    const startSpin = () => {
        initAudio();
        const parsedCandidates = parseCandidates(inputText);
        const count = winnerCount;
        if (parsedCandidates.length === 0) {
            alert("Vui lòng nhập danh sách!");
            return;
        }
        if (count > parsedCandidates.length) {
            alert(`Số người cần chọn không được vượt quá ${parsedCandidates.length}.`);
            return;
        }
        if (isSpinning) return;

        setIsSpinning(true);
        setActiveScene('spin');
        addLog("SPIN_START", count > 1 ? `Chọn ${count} người từ ${parsedCandidates.length} ứng viên.` : `Bắt đầu quay giải: ${prize.name}. SL: ${parsedCandidates.length}`);

        if (customSound && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.warn(e));
        }

        const duration = spinDuration * 1000;
        updateStateField('prize', prize);
        sendCommand('SPIN_START', { duration, candidates: parsedCandidates, winnerCount: count });

        let counter = 0;
        const interval = setInterval(() => {
            const rc = parsedCandidates[Math.floor(Math.random() * parsedCandidates.length)];
            if (counter % 4 === 0) playTickSound();
            counter++;
        }, 50);

        setTimeout(() => {
            clearInterval(interval);
            finishSpin(parsedCandidates, count);
        }, duration);
    };

    const finishSpin = (parsedCandidates: any[], count: number) => {
        if (customSound && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        const remaining = [...parsedCandidates];
        const selected = Array.from({ length: count }, () => remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
        const resultName = count === 1 ? prize.name : 'Quay nhiều người';
        const resultImage = count === 1 ? prize.image : '';
        const winnerRecords = selected.map(winner => ({ ...winner, prizeName: resultName, prizeImage: resultImage, timestamp: new Date() }));
        const newWinners = [...winnerRecords, ...winners];
        setWinners(newWinners);
        saveWinners(newWinners);

        addLog("WINNER", `${selected.length} người được chọn trong lượt quay.`);

        const winner = selected[0];
        const firstWinnerIndex = parsedCandidates.indexOf(winner);
        const lastWinnerIndex = parsedCandidates.indexOf(selected[selected.length - 1]);
        const prevId = parsedCandidates[(firstWinnerIndex - 1 + parsedCandidates.length) % parsedCandidates.length].id;
        const nextId = parsedCandidates[(lastWinnerIndex + 1) % parsedCandidates.length].id;
        sendCommand('SPIN_STOP', { id: winner.id, prevId, nextId, ...(count > 1 ? { winners: selected } : {}) });

        if (count === 1) {
            const name = winner.name || "(Không có tên)";
            setTimeout(() => sendCommand('SHOW_NAME', { name }), 500);
            setTimeout(() => sendCommand('SHOW_MODAL', { id: winner.id, name }), 2500);
        } else {
            setTimeout(() => sendCommand('SHOW_MODAL', { winners: selected }), 2500);
        }

        if (removeWinner) {
            const selectedIds = new Set(selected);
            const newCandidates = parsedCandidates.filter(candidate => !selectedIds.has(candidate));
            const newText = newCandidates.map(c => c.name ? `${c.id}, ${c.name}` : c.id).join('\n');
            syncImportData(newText);
            saveCandidates(newText);
            addLog("REMOVE", `Đã loại ${selected.length} người trúng khỏi danh sách.`);
        }

        setIsSpinning(false);
    };

    const handleReset = () => {
        sendCommand('RESET');
        sendCommand('CLOSE_MODAL');
        setActiveScene('spin');
        addLog("RESET", "Reset màn hình.");
    };

    const openProjectorWindow = () => {
        const projectorUrl = new URL(window.location.href);
        projectorUrl.search = `?session=${encodeURIComponent(sessionId)}&projector=true&fullscreen=true`;
        projectorUrl.hash = '';
        const currentScreen = window.screen as typeof window.screen & { availLeft: number; availTop: number };
        const projectorWindow = window.open(
            projectorUrl.toString(),
            'lucky-draw-projector',
            `popup=yes,width=${currentScreen.availWidth},height=${currentScreen.availHeight},left=${currentScreen.availLeft},top=${currentScreen.availTop}`
        );

        if (!projectorWindow) {
            alert('Cửa sổ bị chặn. Hãy cho phép pop-up cho trang này.');
            return;
        }

        const positionProjector = async () => {
            let targetScreen = currentScreen;
            const screenApi = window as Window & {
                getScreenDetails?: () => Promise<{ currentScreen: typeof currentScreen; screens: typeof currentScreen[] }>;
            };
            try {
                const details = await screenApi.getScreenDetails?.();
                targetScreen = details?.screens.find(screen => screen !== details.currentScreen) || currentScreen;
            } catch {
                // Fall back to the current screen when display permission is unavailable.
            }

            try {
                projectorWindow.moveTo(targetScreen.availLeft, targetScreen.availTop);
                projectorWindow.resizeTo(targetScreen.availWidth, targetScreen.availHeight);
                projectorWindow.focus();
            } catch {
                projectorWindow.focus();
            }
        };

        void positionProjector();
        addLog('PROJECTOR_OPEN', 'Đã mở màn hình trình chiếu.');
    };



    const showWinnersList = () => {
        if (activeScene === 'winners') { backToSpin(); return; }
        sendCommand('SHOW_WINNERS_LIST', winners);
        setActiveScene('winners');
        addLog("SHOW_WINNERS", "Chiếu DS trúng thưởng");
    };

    const backToSpin = () => {
        sendCommand('BACK_TO_SPIN');
        sendCommand('CLOSE_MODAL');
        setActiveScene('spin');
        addLog("BACK", "Quay lại màn hình quay");
    };

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const url = `url(${ev.target?.result})`;
                setBgImage(url);
                updateStateField('bgImage', url);
                addLog("BG_CHANGE", "Đổi ảnh nền");
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };



    const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                setCustomSound(ev.target?.result as string);
                setSoundName(file.name);
                addLog("SOUND", `Tải nhạc: ${file.name}`);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                syncImportData(ev.target?.result as string);
                setShowDataTable(true);
                setCurrentPage(1);
                addLog("IMPORT", "Nhập CSV");
            };
            reader.readAsText(e.target.files[0]);
        }
    };

    const exportWinners = () => {
        if (winners.length === 0) { alert("Chưa có dữ liệu!"); return; }
        let csv = "data:text/csv;charset=utf-8,\uFEFF";
        csv += "STT,Giải,Tên,MSSV,Thời Gian\n";
        [...winners].reverse().forEach((w, i) => {
            csv += `${i + 1},"${w.prizeName}","${w.name}","${w.id}","${w.timestamp?.toLocaleString?.('vi-VN') || ''}"\n`;
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csv));
        link.setAttribute("download", `winners_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const parsedCandidates = parseCandidates(inputText);
    const editableCandidates = parseEditableCandidates(inputText);
    const candidateCount = parsedCandidates.length;
    const totalPages = Math.max(1, Math.ceil(editableCandidates.length / PAGE_SIZE));
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const paginatedCandidates = editableCandidates
        .map((candidate, index) => ({ candidate, index }))
        .slice(pageStart, pageStart + PAGE_SIZE);

    useEffect(() => {
        setCurrentPage(page => Math.min(page, totalPages));
    }, [totalPages]);

    const updateCandidateField = (index: number, field: 'id' | 'name', value: string) => {
        const rows = parseEditableCandidates(inputText);
        rows[index] = { ...rows[index], [field]: value };
        const next = serializeCandidates(rows);
        syncImportData(next);
        saveCandidates(next);
    };

    const updateImportColumns = (ids: string, names: string) => {
        syncImportData(combineCandidateColumns(ids, names));
    };

    const addCandidateRow = () => {
        const next = `${inputText}${inputText ? '\n' : ''},`;
        syncImportData(next);
    };

    const removeCandidateRow = (index: number) => {
        const rows = parseEditableCandidates(inputText);
        rows.splice(index, 1);
        const next = serializeCandidates(rows);
        syncImportData(next);
        saveCandidates(next);
    };

    const applyData = () => {
        saveCandidates(inputText);
        setShowDataTable(true);
        setCurrentPage(1);
        addLog('APPLY_DATA', `Đã chuyển ${candidateCount} dòng sang bảng.`);
    };

    const resetCandidateData = () => {
        if (!confirm('Đưa dữ liệu tham gia về trắng?')) return;
        syncImportData('');
        saveCandidates('');
        setShowDataTable(false);
        setCurrentPage(1);
        addLog('RESET_DATA', 'Đã đưa dữ liệu tham gia về trắng.');
    };

    const handlePasswordSubmit = async () => {
        setAuthError('');
        try {
            await signInAdmin(passwordInput);
            setShowPasswordModal(false);
            setPasswordError(false);
            setPasswordInput('');
            setActiveSection(sessionId ? 'logs' : 'sessions');
        } catch (error) {
            setPasswordError(true);
            setAuthError(error instanceof Error && error.message === 'email-not-verified'
                ? 'Firebase đã gửi email xác minh. Xác minh email rồi đăng nhập lại.'
                : 'Đăng nhập thất bại. Kiểm tra email, mật khẩu và cấu hình Firebase Authentication.');
        }
    };

    const handleLogout = () => {
        void signOutAdmin().then(() => window.location.assign('/admin')).catch(() => alert('Không thể đăng xuất khỏi Firebase.'));
    };

    const openSession = (code: string) => window.location.assign(`/?session=${encodeURIComponent(code)}`);
    const removeSession = async (session: AdminSession) => {
        if (!confirm(`Xóa toàn bộ dữ liệu phiên ${session.code}? Không thể hoàn tác.`)) return;
        try {
            await deleteSession(session.code);
            setSessions(current => current.filter(item => item.code !== session.code));
        } catch {
            alert(`Không thể xóa phiên ${session.code}. Kiểm tra quyền Admin Firebase.`);
        }
    };

    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            setShowPasswordModal(true);
            return;
        }
        action();
    };

    return (
        <div className="admin-root">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="sidebar-brand">
                    <h1 className="brand-title">Admin Control</h1>
                </div>

                <nav className="sidebar-nav">
                    {[
                        { id: 'logs', icon: 'fa-clipboard-list', label: 'Nhật ký' },
                        { id: 'sessions', icon: 'fa-layer-group', label: 'Quản lý phiên' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (item.id === 'sessions' && !isAuthenticated) {
                                    setShowPasswordModal(true);
                                } else {
                                    setActiveSection(item.id);
                                }
                            }}
                            className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                        >
                            <i className={`fa-solid ${item.icon}`}></i>
                            <span>{item.label}</span>
                            {item.id === 'sessions' && !isAuthenticated && <i className="fa-solid fa-lock" style={{ fontSize: 10, marginLeft: 'auto', opacity: 0.4 }}></i>}
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="mobile-header-title">Admin Control</div>
                    <div className={`status-badge ${connected ? 'online' : 'offline'}`}>
                        <span className="status-dot"></span>
                        <span>{connected ? 'Đã kết nối' : 'Mất kết nối'}</span>
                    </div>
                    <button onClick={openProjectorWindow} className="projector-btn">
                        <i className="fa-solid fa-display"></i>
                        <span>Trình chiếu</span>
                    </button>
                    {isAuthenticated ? (
                        <button onClick={handleLogout} className="projector-btn" style={{ borderColor: 'rgba(248,113,113,0.3)', color: '#f87171', background: 'rgba(248,113,113,0.1)' }}>
                            <i className="fa-solid fa-right-from-bracket"></i>
                            <span>Đăng xuất</span>
                        </button>
                    ) : (
                        <button onClick={() => setShowPasswordModal(true)} className="projector-btn">
                            <i className="fa-solid fa-lock"></i>
                            <span>Đăng nhập Admin</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="admin-main">
                {/* Password Modal */}
                {showPasswordModal && (
                    <div className="password-overlay" onClick={() => { setShowPasswordModal(false); setPasswordError(false); setPasswordInput(''); }}>
                        <div className="password-modal" onClick={e => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowPasswordModal(false)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                            <div className="password-icon">
                                <i className="fa-solid fa-lock"></i>
                            </div>
                            <h3>Xác thực Admin</h3>
                            <p>{ADMIN_EMAIL}</p>
                            <form onSubmit={e => { e.preventDefault(); void handlePasswordSubmit(); }}>
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
                                    className={`admin-input password-input ${passwordError ? 'error' : ''}`}
                                    placeholder="Mật khẩu Firebase"
                                    autoFocus
                                />
                                {passwordError && <div className="password-error">{authError}</div>}
                                <button type="submit" className="password-submit">
                                    <span>Đăng nhập</span>
                                    <i className="fa-solid fa-arrow-right-to-bracket"></i>
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {activeSection === 'sessions' && (
                    <div className="admin-content animate-fade-in">
                        <div className="content-header">
                            <h2><i className="fa-solid fa-layer-group"></i> Quản Lý Phiên</h2>
                            {isAuthenticated && <button onClick={() => { setSessionsLoading(true); getAllSessions().then(setSessions).catch(() => setSessionsError('Không thể tải phiên.')).finally(() => setSessionsLoading(false)); }} className="header-btn success"><i className="fa-solid fa-rotate"></i> Tải lại</button>}
                        </div>
                        {!isAuthenticated ? <div className="empty-state"><i className="fa-solid fa-lock"></i><p>Đăng nhập Admin để xem và quản lý phiên.</p></div>
                            : sessionsLoading ? <div className="empty-state"><p>Đang tải phiên…</p></div>
                            : sessionsError ? <div className="empty-state"><p>{sessionsError}</p></div>
                            : sessions.length === 0 ? <div className="empty-state"><i className="fa-solid fa-box-open"></i><p>Chưa có phiên nào</p></div>
                            : <div className="sessions-list">
                                {sessions.map(session => <div className="session-row" key={session.code}>
                                    <div className="session-details">
                                        <strong>{session.code}</strong>
                                        <span>{session.createdAt ? new Date(session.createdAt).toLocaleString('vi-VN') : 'Không có ngày tạo'}</span>
                                        <span>{session.candidateCount} người tham gia · {session.winnerCount} kết quả</span>
                                    </div>
                                    <div className="session-actions">
                                        <button onClick={() => openSession(session.code)} className="header-btn success">Mở phiên</button>
                                        <button onClick={() => void removeSession(session)} className="header-btn danger"><i className="fa-solid fa-trash"></i> Xóa</button>
                                    </div>
                                </div>)}
                            </div>}
                    </div>
                )}

                {/* Control Panel */}
                {activeSection === 'control' && isAuthenticated && (
                    <div className="admin-content animate-fade-in">
                        <div className="content-header">
                            <h2><i className="fa-solid fa-gamepad"></i> Bảng Điều Khiển</h2>
                            <p>Quản lý quay số trực tiếp</p>
                        </div>

                        {/* Spin Duration */}
                        <div className="control-card">
                            <label className="control-label">
                                <i className="fa-solid fa-clock"></i>
                                Thời gian quay: <strong>{spinDuration}s</strong>
                            </label>
                            <input
                                type="range"
                                min="3"
                                max="10"
                                value={spinDuration}
                                onChange={e => setSpinDuration(Number(e.target.value))}
                                className="duration-slider"
                            />
                            <div className="slider-labels">
                                <span>3s</span><span>10s</span>
                            </div>
                        </div>

                        <div className="control-card">
                            <div className="field-group">
                                <span className="mb-2 block font-semibold text-gray-700">Số người cần chọn</span>
                                <div role="group" aria-label="Số người cần chọn" className="grid grid-cols-5 gap-2">
                                    {[1, 2, 3, 4, 5].map(count => <button key={count} type="button" aria-pressed={winnerCount === count} onClick={() => setWinnerCount(count)} className={`rounded-full border py-2 text-sm font-semibold transition-colors ${winnerCount === count ? 'border-red-700 bg-red-700 text-white shadow-sm' : 'border-gray-300 bg-white text-gray-700 hover:border-red-400 hover:text-red-700'}`}>{count}</button>)}
                                </div>
                            </div>
                        </div>

                        {/* Main Actions */}
                        <div className="action-grid">
                            <button
                                onClick={startSpin}
                                disabled={isSpinning}
                                className={`action-btn spin-btn ${isSpinning ? 'spinning' : ''}`}
                            >
                                <i className={`fa-solid ${isSpinning ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
                                <span>{isSpinning ? 'ĐANG QUAY...' : 'QUAY SỐ'}</span>
                            </button>

                            <button onClick={handleReset} className="action-btn reset-btn">
                                <i className="fa-solid fa-rotate-right"></i>
                                <span>Reset</span>
                            </button>



                            <button onClick={showWinnersList} className={`action-btn winners-btn ${activeScene === 'winners' ? 'active' : ''}`}>
                                <i className={`fa-solid ${activeScene === 'winners' ? 'fa-rotate-left' : 'fa-list'}`}></i>
                                <span>{activeScene === 'winners' ? 'Ẩn DS' : 'Chiếu DS'}</span>
                            </button>

                            <button onClick={backToSpin} className="action-btn back-btn">
                                <i className="fa-solid fa-rotate-left"></i>
                                <span>Ẩn / Back</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Settings */}
                {activeSection === 'settings' && isAuthenticated && (
                    <div className="admin-content animate-fade-in">
                        <div className="content-header">
                            <h2><i className="fa-solid fa-sliders"></i> Cấu Hình</h2>
                            <p>Thiết lập giải thưởng và giao diện</p>
                        </div>

                        <div className="settings-grid">

                            {/* Background */}
                            <div className="settings-card">
                                <h3><i className="fa-solid fa-image"></i> Giao diện</h3>
                                <div className="field-group">
                                    <label>Ảnh nền</label>
                                    <input type="file" id="adminBgInput" accept="image/*" className="hidden" onChange={handleBgUpload} />
                                    <label htmlFor="adminBgInput" className="upload-btn full-width">
                                        <i className="fa-solid fa-image"></i> Đổi ảnh nền
                                    </label>
                                </div>
                                <div className="field-group">
                                    <label>Loại bỏ người đã thắng</label>
                                    <div className="toggle-row">
                                        <span className="toggle-label">{removeWinner ? 'Bật' : 'Tắt'}</span>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={removeWinner} onChange={e => setRemoveWinner(e.target.checked)} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Sound */}
                            <div className="settings-card">
                                <h3><i className="fa-solid fa-music"></i> Âm thanh</h3>
                                <div className="field-group">
                                    <label>Nhạc nền khi quay</label>
                                    <input type="file" id="adminSoundInput" accept="audio/*" className="hidden" onChange={handleSoundUpload} />
                                    <label htmlFor="adminSoundInput" className="upload-btn full-width sound-upload">
                                        <i className="fa-solid fa-music"></i> {soundName}
                                    </label>
                                    <div className="sound-actions">
                                        <button onClick={() => {
                                            if (!customSound) { alert("Chưa chọn file!"); return; }
                                            if (audioRef.current.paused) { audioRef.current.currentTime = 0; audioRef.current.play(); }
                                            else { audioRef.current.pause(); audioRef.current.currentTime = 0; }
                                        }} className="sound-btn"><i className="fa-solid fa-play"></i> Thử</button>
                                        <button onClick={() => {
                                            audioRef.current.pause(); audioRef.current.currentTime = 0;
                                            setCustomSound(null); setSoundName('Chọn file MP3/WAV...');
                                        }} className="sound-btn danger"><i className="fa-solid fa-trash"></i> Xóa</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Candidates */}
                {activeSection === 'candidates' && isAuthenticated && (
                    <div className="admin-content animate-fade-in">
                        <div className="content-header">
                            <h2><i className="fa-solid fa-users"></i> Danh Sách Tham Gia</h2>
                            <div className="header-actions">
                                <span className="count-badge">{candidateCount} người</span>
                                <input type="file" id="adminCsvInput" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                                <label htmlFor="adminCsvInput" className="header-btn">
                                    <i className="fa-solid fa-upload"></i> Nhập CSV
                                </label>
                                {showDataTable && <button onClick={() => setShowDataTable(false)} className="header-btn">Import data</button>}
                                <button onClick={resetCandidateData} className="header-btn danger">
                                    <i className="fa-solid fa-trash"></i> Xóa tất cả
                                </button>
                            </div>
                        </div>
                        {showDataTable ? (
                            <>
                                <div className="h-[min(65vh,620px)] overflow-y-auto rounded-xl border border-slate-200 bg-white">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase text-slate-500">
                                            <tr>
                                                <th className="p-3 font-semibold">ID</th>
                                                <th className="p-3 font-semibold">Họ và tên</th>
                                                <th className="w-20 p-3 text-center font-semibold">Xóa</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedCandidates.map(({ candidate, index }) => (
                                                <tr key={index} className="border-t border-slate-100">
                                                    <td className="p-2 align-top">
                                                        <input
                                                            aria-label={`ID dòng ${index + 1}`}
                                                            value={candidate.id}
                                                            onChange={e => updateCandidateField(index, 'id', e.target.value)}
                                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-700 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                                            placeholder="MSSV / SĐT / STT"
                                                        />
                                                    </td>
                                                    <td className="p-2 align-top">
                                                        <input
                                                            aria-label={`Họ và tên dòng ${index + 1}`}
                                                            value={candidate.name}
                                                            onChange={e => updateCandidateField(index, 'name', e.target.value)}
                                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                                            placeholder="Nguyễn Văn A"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center align-top">
                                                        <button type="button" onClick={() => removeCandidateRow(index)} className="rounded-lg px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-50" aria-label={`Xóa dòng ${index + 1}`}>
                                                            Xóa
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                                    <span>Trang {currentPage} / {totalPages}</span>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Trước</button>
                                        <button type="button" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Sau</button>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-3 text-xs">
                                    <button type="button" onClick={addCandidateRow} className="font-semibold text-red-600 hover:underline">Thêm dòng</button>
                                    <button type="button" onClick={resetCandidateData} className="font-semibold text-red-600 hover:underline">Reset data</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        <span className="mb-1 block">ID</span>
                                        <textarea
                                            value={inputIds}
                                            onChange={e => updateImportColumns(e.target.value, inputNames)}
                                            className="h-[min(55vh,520px)] min-h-[220px] w-full resize-none rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm text-slate-700 shadow-inner outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                            spellCheck={false}
                                        />
                                    </label>
                                    <label className="block text-xs font-semibold text-slate-600">
                                        <span className="mb-1 block">Họ và tên</span>
                                        <textarea
                                            value={inputNames}
                                            onChange={e => updateImportColumns(inputIds, e.target.value)}
                                            className="h-[min(55vh,520px)] min-h-[220px] w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-inner outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                            spellCheck={false}
                                        />
                                    </label>
                                </div>
                                <p className="mt-3 text-xs text-slate-500">Dán riêng từng cột từ Excel. Dòng ID thứ nhất ghép với họ tên thứ nhất.</p>
                                <div className="mt-3 flex gap-3">
                                    <button type="button" onClick={applyData} className="header-btn success">Apply data</button>
                                    <button type="button" onClick={resetCandidateData} className="header-btn danger">Reset data</button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Winners */}
                {activeSection === 'winners' && (
                    <div className="admin-content animate-fade-in">
                        <div className="content-header">
                            <h2><i className="fa-solid fa-trophy"></i> Kết Quả Trúng Thưởng</h2>
                            <div className="header-actions">
                                <span className="count-badge">{winners.length} người</span>
                                <button onClick={exportWinners} className="header-btn success">
                                    <i className="fa-solid fa-file-excel"></i> Xuất CSV
                                </button>
                                {isAuthenticated && (
                                    <button onClick={() => { if (confirm('Xóa hết lịch sử?')) { setWinners([]); saveWinners([]); } }} className="header-btn danger">
                                        <i className="fa-solid fa-trash"></i> Xóa
                                    </button>
                                )}
                            </div>
                        </div>

                        {winners.length === 0 ? (
                            <div className="empty-state">
                                <i className="fa-solid fa-box-open"></i>
                                <p>Chưa có ai trúng thưởng</p>
                            </div>
                        ) : (
                            <div className="winners-list">
                                {winners.map((w, i) => (
                                    <div key={i} className="winner-item" style={{ animationDelay: `${i * 50}ms` }}>
                                        <div className="winner-rank">#{winners.length - i}</div>
                                        {w.prizeImage && <div className="winner-prize-img"><img src={w.prizeImage} alt="" /></div>}
                                        <div className="winner-info">
                                            <div className="winner-prize-name">{w.prizeName}</div>
                                            <div className="winner-name">{w.name || "Ẩn danh"}</div>
                                            <div className="winner-id">{w.id}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Logs */}
                {activeSection === 'logs' && (
                    <div className="admin-content animate-fade-in">
                        <div className="content-header">
                            <h2><i className="fa-solid fa-clipboard-list"></i> Nhật Ký Hệ Thống</h2>
                            <div className="header-actions">
                                {isAuthenticated && (
                                    <button onClick={() => setLogs([])} className="header-btn danger">
                                        <i className="fa-solid fa-trash"></i> Xóa log
                                    </button>
                                )}
                            </div>
                        </div>

                        {logs.length === 0 ? (
                            <div className="empty-state">
                                <i className="fa-solid fa-scroll"></i>
                                <p>Chưa có nhật ký</p>
                            </div>
                        ) : (
                            <div className="logs-list">
                                {logs.map((log, i) => (
                                    <div key={i} className="log-item">
                                        <span className="log-time">{log.time}</span>
                                        <span className={`log-action ${log.action.toLowerCase()}`}>{log.action}</span>
                                        <span className="log-detail">{log.detail}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPanel;
