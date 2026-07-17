import React, { useState, useEffect, useRef } from 'react';
import { sendCommand, updateStateField, saveWinners, saveCandidates, onWinnersChange, onCandidatesChange, onStateChange, detachListeners } from './firebase';

const parseCandidates = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
        let parts = line.split(',');
        if (parts.length < 2) parts = line.split('-');
        if (parts.length >= 2) return { id: parts[0].trim(), name: parts.slice(1).join(' ').trim() };
        return { id: line.trim(), name: "" };
    });
};

const ADMIN_PASSWORD = 'antony12345';

const AdminPanel = () => {
    const [prize, setPrize] = useState({ name: "Samsung Galaxy Buds Core (ANC)", image: "https://res.cloudinary.com/dxikjdqqn/image/upload/v1775861881/BUDS_CORE_yxhucn.png" });
    const [winners, setWinners] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [removeWinner, setRemoveWinner] = useState(true);
    const [bgImage, setBgImage] = useState('url("https://res.cloudinary.com/dxikjdqqn/image/upload/v1776474005/BG_SLIDE_184_Light_io8uno.png")');
    const [customSound, setCustomSound] = useState<string | null>(null);
    const [soundName, setSoundName] = useState('Chọn file MP3/WAV...');
    const [inputText, setInputText] = useState("090****5678, Nguyễn Hoàng Long\n091****6789, Trịnh Thu Hà\n092****7890, Lý Quốc Bảo\n093****8901, Dương Minh Đức\n094****9012, Nguyễn Thảo Vy\n095****0123, Trần Gia Bảo\n096****1234, Lê Phương Anh\n097****2345, Phạm Đức Anh\n098****3456, Võ Khánh Linh\n099****4567, Huỳnh Nhật Minh\n090****6789, Đinh Quang Huy\n091****7890, Cao Bảo Ngọc\n092****8901, Mai Anh Tuấn\n093****9012, Tạ Ngọc Mai\n094****0123, Ngô Minh Khang\n095****1234, Phan Gia Linh\n096****2345, Đoàn Quốc Việt\n097****3456, Trương Khả Hân\n098****4567, Hồ Thanh Phong\n099****5678, Vũ Bảo Trâm");
    const [activeSection, setActiveSection] = useState('winners');
    const [activeScene, setActiveScene] = useState<'spin' | 'prize' | 'winners'>('spin');
    const [spinDuration, setSpinDuration] = useState(10);
    const [connected, setConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordError, setPasswordError] = useState(false);

    const audioRef = useRef(new Audio());
    const audioCtxRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        // Listen to Firebase for cross-device sync
        onWinnersChange((w) => setWinners(w));
        onCandidatesChange((text) => setInputText(text));
        onStateChange((data) => {
            if (data.bgImage !== undefined) setBgImage(data.bgImage);
            if (data.prize !== undefined) setPrize(data.prize);
        });
        setConnected(true);

        return () => detachListeners();
    }, []);

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
        if (parsedCandidates.length === 0) {
            alert("Vui lòng nhập danh sách!");
            return;
        }
        if (isSpinning) return;

        setIsSpinning(true);
        setActiveScene('spin');
        addLog("SPIN_START", `Bắt đầu quay giải: ${prize.name}. SL: ${parsedCandidates.length}`);

        if (customSound && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.warn(e));
        }

        const duration = spinDuration * 1000;
        updateStateField('prize', prize);
        sendCommand('SPIN_START', { duration, candidates: parsedCandidates });

        let counter = 0;
        const interval = setInterval(() => {
            const rc = parsedCandidates[Math.floor(Math.random() * parsedCandidates.length)];
            if (counter % 4 === 0) playTickSound();
            counter++;
        }, 50);

        setTimeout(() => {
            clearInterval(interval);
            finishSpin(parsedCandidates);
        }, duration);
    };

    const finishSpin = (parsedCandidates: any[]) => {
        if (customSound && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        const winnerIndex = Math.floor(Math.random() * parsedCandidates.length);
        const winner = parsedCandidates[winnerIndex];
        const winRecord = { ...winner, prizeName: prize.name, prizeImage: prize.image, timestamp: new Date() };
        const newWinners = [winRecord, ...winners];
        setWinners(newWinners);
        saveWinners(newWinners);

        addLog("WINNER", `${winner.id} - ${winner.name} (${prize.name})`);

        sendCommand('SPIN_STOP', { id: winner.id });

        const name = winner.name || "(Không có tên)";
        setTimeout(() => {
            sendCommand('SHOW_NAME', { name });
        }, 500);

        setTimeout(() => {
            sendCommand('SHOW_MODAL', { id: winner.id, name });
        }, 2500);

        if (removeWinner) {
            const newCandidates = [...parsedCandidates];
            newCandidates.splice(winnerIndex, 1);
            const newText = newCandidates.map(c => c.name ? `${c.id}, ${c.name}` : c.id).join('\n');
            setInputText(newText);
            saveCandidates(newText);
            addLog("REMOVE", `Đã loại ${winner.id}`);
        }

        setIsSpinning(false);
    };

    const handleReset = () => {
        sendCommand('RESET');
        sendCommand('CLOSE_MODAL');
        setActiveScene('spin');
        addLog("RESET", "Reset màn hình.");
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
                setInputText(ev.target?.result as string);
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

    const candidateCount = parseCandidates(inputText).length;

    const handlePasswordSubmit = () => {
        if (passwordInput === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            setShowPasswordModal(false);
            setPasswordError(false);
            setPasswordInput('');
            setActiveSection('control');
        } else {
            setPasswordError(true);
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setActiveSection('winners');
    };

    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            setShowPasswordModal(true);
            return;
        }
        action();
    };

    // Sections that need auth to access
    const protectedSections = ['control', 'settings', 'candidates'];

    return (
        <div className="admin-root">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="sidebar-brand">
                    <h1 className="brand-title">Admin Control</h1>
                </div>

                <nav className="sidebar-nav">
                    {[
                        { id: 'control', icon: 'fa-gamepad', label: 'Điều khiển', locked: true },
                        { id: 'settings', icon: 'fa-sliders', label: 'Cấu hình', locked: true },
                        { id: 'candidates', icon: 'fa-users', label: 'Danh sách', locked: true },
                        { id: 'winners', icon: 'fa-trophy', label: 'Kết quả', locked: false },
                        { id: 'logs', icon: 'fa-clipboard-list', label: 'Nhật ký', locked: false },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (item.locked && !isAuthenticated) {
                                    setShowPasswordModal(true);
                                } else {
                                    setActiveSection(item.id);
                                }
                            }}
                            className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                        >
                            <i className={`fa-solid ${item.icon}`}></i>
                            <span>{item.label}</span>
                            {item.locked && !isAuthenticated && <i className="fa-solid fa-lock" style={{ fontSize: 10, marginLeft: 'auto', opacity: 0.4 }}></i>}
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="mobile-header-title">Admin Control</div>
                    <div className={`status-badge ${connected ? 'online' : 'offline'}`}>
                        <span className="status-dot"></span>
                        <span>{connected ? 'Đã kết nối' : 'Mất kết nối'}</span>
                    </div>
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
                            <p>Nhập mật khẩu để truy cập chức năng quản trị</p>
                            <form onSubmit={e => { e.preventDefault(); handlePasswordSubmit(); }}>
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
                                    className={`admin-input password-input ${passwordError ? 'error' : ''}`}
                                    placeholder="••••••••"
                                    autoFocus
                                />
                                {passwordError && <div className="password-error">Sai mật khẩu. Vui lòng thử lại.</div>}
                                <button type="submit" className="password-submit">
                                    <span>Đăng nhập</span>
                                    <i className="fa-solid fa-arrow-right-to-bracket"></i>
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Control Panel */}
                {activeSection === 'control' && isAuthenticated && (
                    <div className="admin-content animate-fade-in">
                        <div className="content-header">
                            <h2><i className="fa-solid fa-gamepad"></i> Bảng Điều Khiển</h2>
                            <p>Quản lý quay số trực tiếp</p>
                        </div>

                        {/* Current Prize Card */}
                        <div className="prize-hero-card">
                            <div className="prize-hero-img">
                                <img src={prize.image} alt="Prize" />
                            </div>
                            <div className="prize-hero-info">
                                <span className="prize-hero-label">Đang quay giải</span>
                                <h3 className="prize-hero-name">{prize.name}</h3>
                                <div className="prize-hero-stats">
                                    <div className="stat-item">
                                        <i className="fa-solid fa-users"></i>
                                        <span>{candidateCount} người tham gia</span>
                                    </div>
                                    <div className="stat-item">
                                        <i className="fa-solid fa-trophy"></i>
                                        <span>{winners.length} đã trúng</span>
                                    </div>
                                </div>
                            </div>
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
                                max="30"
                                value={spinDuration}
                                onChange={e => setSpinDuration(Number(e.target.value))}
                                className="duration-slider"
                            />
                            <div className="slider-labels">
                                <span>3s</span><span>15s</span><span>30s</span>
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
                                <button onClick={() => { if (confirm('Xóa hết?')) setInputText(''); }} className="header-btn danger">
                                    <i className="fa-solid fa-trash"></i> Xóa tất cả
                                </button>
                            </div>
                        </div>

                        <textarea
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            className="candidates-textarea"
                            placeholder="MSSV, Họ và tên..."
                            spellCheck={false}
                        />
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
                                    <button onClick={() => { if (confirm('Xóa hết lịch sử?')) setWinners([]); }} className="header-btn danger">
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
                                        <div className="winner-prize-img">
                                            <img src={w.prizeImage} alt="" />
                                        </div>
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
