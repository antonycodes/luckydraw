import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

// --- Utils ---
const triggerModalConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ff0000', '#00ff00', '#0000ff'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ff0000', '#00ff00', '#0000ff'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
};

const parseCandidates = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
        let parts = line.split(',');
        if (parts.length < 2) parts = line.split('-');
        if (parts.length >= 2) return { id: parts[0].trim(), name: parts.slice(1).join(' ').trim() };
        return { id: line.trim(), name: "" }; 
    });
};

// --- Components ---
const Stage = ({ 
    prize, displayId, displayName, showName, isRolling, 
    showTimer, timerWidth, timerTransition, showControls = true, 
    onSpin, isSpinning, onReset, showModal = false
}: any) => {
    return (
        <div className={`w-full max-w-6xl ${showControls ? 'glass-panel-stage rounded-3xl p-6' : 'h-full'} flex flex-col items-center justify-center relative overflow-hidden min-h-[70vh] md:min-h-[90vh] pb-32`}>
            <div className={`absolute top-6 left-6 md:left-10 flex items-center gap-4 animate-fade-up transition-opacity duration-500 ${showModal ? 'opacity-0' : 'opacity-100'}`}>
                <div className="w-20 h-20 md:w-24 md:h-24 bg-white/90 rounded-2xl p-2 shadow-xl transform rotate-3 border-2 border-yellow-400">
                    <img src={prize.image} className="w-full h-full object-contain" alt="Prize" />
                </div>
                <div>
                    <div className="text-white/80 text-sm font-bold uppercase tracking-wider shadow-black drop-shadow-md">Đang quay giải</div>
                    <div className="text-2xl md:text-4xl font-bold text-yellow-300 drop-shadow-lg">{prize.name}</div>
                </div>
            </div>

            <div className={`relative w-full flex flex-col items-center justify-center mb-8 mt-20 transition-all duration-500 ${showModal ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
                <div className="absolute w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 top-0 left-1/4"></div>
                <div className="absolute w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 top-0 right-1/4"></div>

                <div className={`relative z-10 text-[4rem] md:text-[8rem] font-bold text-white text-center break-words w-full px-4 leading-none display-text transition-all duration-300 ease-out will-change-transform`}>
                    <span className="transition-opacity duration-300"></span>
                    {displayId}
                    
                </div>
                <div className={`relative z-10 text-2xl md:text-4xl font-bold text-white text-center mt-2 h-12 transition-opacity duration-500 ${showName ? 'opacity-100' : 'opacity-0'}`}>
                    {displayName}
                </div>
            </div>

            <div className={`w-full max-w-lg h-4 bg-gray-200/30 rounded-full mb-8 overflow-visible relative shadow-inner backdrop-blur-sm z-20 ${showTimer ? 'block' : 'hidden'}`}>
                <div 
                    className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full relative overflow-visible"
                    style={{ width: timerWidth, transition: timerTransition }}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-20 h-20 shrink-0 flex items-center justify-center z-30">
                        <img src="/Chibi head.png" alt="Timer Icon" className="w-full h-full object-contain drop-shadow-lg" />
                    </div>
                </div>
            </div>

            {showControls && (
                <div className="absolute bottom-10 z-50">
                    <button 
                        onClick={onSpin}
                        disabled={isSpinning}
                        className={`group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full focus:outline-none shadow-xl ${isSpinning ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 hover:shadow-blue-500/50'}`}
                    >
                        <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-white rounded-full group-hover:w-80 group-hover:h-80 opacity-10"></span>
                        <span className="relative flex items-center gap-3 text-xl">
                            <i className="fa-solid fa-play"></i>
                            <span>{isSpinning ? "ĐANG QUAY..." : "QUAY"}</span>
                        </span>
                    </button>
                </div>
            )}

            {showControls && (
                <button onClick={onReset} className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors bg-white/20 p-3 rounded-full hover:bg-white" title="Reset màn hình">
                    <i className="fa-solid fa-rotate-right text-xl"></i>
                </button>
            )}
        </div>
    );
};

const ProjectorView = () => {
    const [bgImage, setBgImage] = useState('url("/background.png")');;
    const [prize, setPrize] = useState({ name: "Giải May Mắn", image: "https://cdn-icons-png.flaticon.com/512/4213/4213958.png" });
    const [displayId, setDisplayId] = useState("ARE YOU READY ?");
    const [displayIdVisible, setDisplayIdVisible] = useState(true);
    const [displayName, setDisplayName] = useState("");
    const [showName, setShowName] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [showTimer, setShowTimer] = useState(false);
    const [timerWidth, setTimerWidth] = useState('100%');
    const [timerTransition, setTimerTransition] = useState('none');
    const [showModal, setShowModal] = useState(false);
    const [modalData, setModalData] = useState({ id: '', name: '' });
    const [overlayState, setOverlayState] = useState('none'); 
    const [winners, setWinners] = useState<any[]>([]);

    useEffect(() => {
        const channel = new BroadcastChannel('lucky_draw_sync');
        channel.onmessage = (event) => {
            const { type, payload } = event.data;
            switch (type) {
                case 'UPDATE_BG': setBgImage(payload); break;
                case 'UPDATE_PRIZE': setPrize(payload); break;
                case 'SHOW_PRIZE_SCENE': 
                    setOverlayState('prize'); 
                    setPrize(payload);
                    break;
                case 'SHOW_WINNERS_LIST':
                    setOverlayState('winners');
                    setWinners(payload);
                    break;
                case 'BACK_TO_SPIN':
                    setOverlayState('none');
                    setShowModal(false);
                    break;
                case 'SPIN_TICK':
                    setDisplayId(payload.text);
                    setShowName(false);
                    break;
                case 'SPIN_START':
                    setOverlayState('none');
                    setIsRolling(true);
                    setShowName(false);
                    setShowTimer(true);
                    setTimerWidth('100%');
                    setTimerTransition('none');
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setTimerWidth('0%');
                            setTimerTransition(`width ${payload.duration}ms linear`);
                        });
                    });
                    break;
                case 'SPIN_STOP':
                    setIsRolling(false);
                    setDisplayId(payload.id);
                    setShowTimer(false);
                    break;
                case 'SHOW_NAME':
                    setDisplayName(payload.name);
                    setShowName(true);
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                    break;
                case 'SHOW_MODAL':
                    setModalData(payload);
                    setOverlayState('none');
                    setShowModal(true);
                    triggerModalConfetti();
                    break;
                case 'CLOSE_MODAL':
                    setShowModal(false);
                    break;
                case 'RESET':
                    setOverlayState('none');
                    setDisplayId("ARE YOU READY ?");
                    setShowName(false);
                    break;
            }
        };
        return () => channel.close();
    }, []);

    return (
        <div className="w-screen h-screen overflow-hidden bg-cover bg-center flex items-center justify-center" style={{ backgroundImage: bgImage }}>
            {overlayState === 'none' && (
                <Stage 
                    prize={prize}
                    displayId={displayId}
                    displayName={displayName}
                    showName={showName}
                    isRolling={isRolling}
                    showTimer={showTimer}
                    timerWidth={timerWidth}
                    timerTransition={timerTransition}
                    showControls={false}
                    showModal={showModal}
                />
            )}

            {overlayState === 'prize' && (
                <div className="fixed inset-0 bg-white/40 backdrop-blur-md z-[9999] flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative w-[50vh] h-[50vh] mb-10">
                        <img src={prize.image} className="w-full h-full object-contain relative z-10 drop-shadow-2xl animate-zoom-in prize-pulse" alt="Prize" />
                    </div>
                    <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-2xl rounded-[30px] px-20 py-10 text-center animate-fade-up">
                        <div className="text-xl font-bold text-gray-600 uppercase tracking-[0.3em] mb-2">Đang quay giải thưởng</div>
                        <div className="text-5xl text-red-500 font-bold uppercase">{prize.name}</div>
                    </div>
                </div>
            )}

            {overlayState === 'winners' && (
                <div className="fixed inset-0 bg-cover bg-center backdrop-blur-xl z-[9999] flex flex-col items-center p-10 animate-fade-in" style={{ backgroundImage: bgImage }}>
                    <h1 className="text-4xl md:text-5xl font-bold text-red-500 uppercase mb-16 drop-shadow-sm flex items-center gap-4 bg-white/90 px-8 py-4 rounded-full shadow-lg">
                        <i className="fa-solid fa-list"></i> XIN CHÚC MỪNG
                    </h1>
                    <div className="w-full max-w-5xl flex-grow overflow-y-auto pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                            {winners.length === 0 ? (
                                <div className="text-center text-gray-500 italic py-10 w-full col-span-2 bg-white/80 rounded-xl">Chưa có ai trúng thưởng</div>
                            ) : (
                                winners.map((w, index) => (
                                    <div key={index} className="flex items-center gap-4 bg-white/90 p-4 rounded-xl shadow-sm border border-gray-100 animate-fade-up" style={{ animationDelay: `${index * 0.1}s` }}>
                                        <div className="text-xl font-bold text-gray-400">#{winners.length - index}</div>
                                        <div className="w-12 h-12 bg-white p-1 rounded-lg border border-gray-200">
                                            <img src={w.prizeImage} className="w-full h-full object-contain" alt="Prize" />
                                        </div>
                                        <div className="flex-grow">
                                            <div className="text-xs font-bold text-yellow-600 uppercase">{w.prizeName}</div>
                                            <div className="text-lg font-bold text-gray-800">{w.name || "Ẩn danh"}</div>
                                            <div className="text-sm text-blue-600 font-mono">{w.id}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Winner Modal */}
            <div className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-500 ${showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className={`p-10 max-w-4xl w-[90%] text-center transform transition-transform duration-500  ${showModal ? 'scale-100' : 'scale-75'}`}>
                    <div className="relative z-10">
                        <div className="mb-6 flex flex-col items-center animate-fade-down">
                            <div className="text-2xl font-bold text-yellow-300 uppercase tracking-[0.3em] mb-2 drop-shadow-[0_0_10px_rgba(253,224,71,0.8)]">Xin chúc mừng</div>
                            <div className="text-4xl md:text-6xl font-bold text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">{prize.name}</div>
                        </div>
                        <div className="flex flex-col gap-4 mb-8">
                            <div className="text-7xl md:text-[8rem] leading-none font-bold text-yellow-400 break-words font-sans tracking-tighter drop-shadow-[0_0_40px_rgba(250,204,21,0.8)]">{modalData.id}</div>
                            <div className="text-5xl md:text-7xl font-bold text-white break-words mt-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]">{modalData.name}</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

const ControlView = () => {
    const [activeTab, setActiveTab] = useState('settings');
    const [prize, setPrize] = useState({ name: "Giải May Mắn", image: "https://cdn-icons-png.flaticon.com/512/4213/4213958.png" });
    const [winners, setWinners] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [removeWinner, setRemoveWinner] = useState(true);
    const [bgImage, setBgImage] = useState('url("/background.png")');
    const [customSound, setCustomSound] = useState<string | null>(null);
    const [soundName, setSoundName] = useState('Chọn file MP3/WAV...');
    const [inputText, setInputText] = useState("S03915,VŨ ĐỨC LÂM\nS12028,VƯU TẤN LỘC\nS12037,TRẦN LƯU THANH NHÂN\nS12170,THÁI MINH HIỂN\nS02791,BÙI SƠN TRÀ\nS12027,HÀ ANH TÀI\nS12068,NGUYỄN TIẾN ĐẠT\nS13073,NGUYỄN NGỌC TIẾN\nS00668,NGUYỄN MINH THÀNH\nS12196,NGUYỄN TRẦN LONG NHÂN\nS12203,NGUYỄN VĂN HOÀNG\nS12434,NGUYỄN HỮU LỘC\nS12504,NGUYỄN TIẾN THÀNH");
    
    const [displayId, setDisplayId] = useState("ARE YOU READY ?");
    const [displayIdVisible, setDisplayIdVisible] = useState(true);
    const [displayName, setDisplayName] = useState("");
    const [showName, setShowName] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [showTimer, setShowTimer] = useState(false);
    const [timerWidth, setTimerWidth] = useState('100%');
    const [timerTransition, setTimerTransition] = useState('none');
    
    const [showModal, setShowModal] = useState(false);
    const [modalData, setModalData] = useState({ id: '', name: '' });
    const [isFullscreen, setIsFullscreen] = useState(false);

    const channelRef = useRef<BroadcastChannel | null>(null);
    const audioRef = useRef(new Audio());
    const audioCtxRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        channelRef.current = new BroadcastChannel('lucky_draw_sync');
        return () => channelRef.current?.close();
    }, []);

    useEffect(() => {
        if (customSound) {
            audioRef.current.src = customSound;
        } else {
            audioRef.current = new Audio();
        }
    }, [customSound]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const broadcast = (msg: any) => {
        if (channelRef.current) {
            channelRef.current.postMessage(msg);
        }
    };

    const addLog = (action: string, detail: string) => {
        const time = new Date().toLocaleString('vi-VN');
        setLogs(prev => [...prev, { time, action, detail }]);
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

    const playWinSound = () => {
        if (!audioCtxRef.current) return;
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.value = 0.1;
            gain.gain.exponentialRampToValueAtTime(0.00001, audioCtxRef.current.currentTime + 2.5);
            osc.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start(audioCtxRef.current.currentTime + (i * 0.1));
            osc.stop(audioCtxRef.current.currentTime + 2.5);
        });
    };

    const startAutoSpin = () => {
        initAudio();
        const parsedCandidates = parseCandidates(inputText);
        if (parsedCandidates.length === 0) {
            alert("Vui lòng nhập danh sách!");
            setActiveTab('settings');
            return;
        }
        if (isSpinning) return;

        setIsSpinning(true);
        addLog("SPIN_START", `Bắt đầu quay giải: ${prize.name}. SL tham gia: ${parsedCandidates.length}`);

        if (customSound && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.warn(e));
        }

        setIsRolling(true);
        setShowName(false);
        setDisplayName("");
        setShowTimer(true);
        setTimerWidth('100%');
        setTimerTransition('none');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimerWidth('0%');
                setTimerTransition(`width 2000ms linear`);
            });
        });
        setShowModal(false);

        broadcast({ type: 'SPIN_START', payload: { duration: 2000 } });

        let counter = 0;
        const interval = setInterval(() => {
            const randomCandidate = parsedCandidates[Math.floor(Math.random() * parsedCandidates.length)];
            setDisplayId(randomCandidate.id);
            
            if (counter % 4 === 0) playTickSound();
            broadcast({ type: 'SPIN_TICK', payload: { text: randomCandidate.id, color: '#ffffff' } });
            counter++;
        }, 50);

        setTimeout(() => {
            clearInterval(interval);
            finishSpin(parsedCandidates);
        }, 2000);
    };

    const finishSpin = (parsedCandidates: any[]) => {
        setIsRolling(false);
        setShowTimer(false);

        if (customSound && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        
        const winnerIndex = Math.floor(Math.random() * parsedCandidates.length);
        const winner = parsedCandidates[winnerIndex];
        
        const winRecord = { ...winner, prizeName: prize.name, prizeImage: prize.image, timestamp: new Date() };
        setWinners(prev => [winRecord, ...prev]);

        addLog("WINNER_FOUND", `Người trúng: ${winner.id} - ${winner.name} (Giải: ${prize.name})`);

        setDisplayId(winner.id);
        broadcast({ type: 'SPIN_STOP', payload: { id: winner.id } });

        const name = winner.name || "(Không có tên)";
        setDisplayName(name);
        setShowName(true);
        playWinSound();
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        broadcast({ type: 'SHOW_NAME', payload: { name: name } });

        setTimeout(() => {
            setModalData({ id: winner.id, name: name });
            setShowModal(true);
            triggerModalConfetti();
            broadcast({ type: 'SHOW_MODAL', payload: { id: winner.id, name: name } });
        }, 2000);

        if (removeWinner) {
            const newCandidates = [...parsedCandidates];
            newCandidates.splice(winnerIndex, 1);
            const newText = newCandidates.map(c => c.name ? `${c.id}, ${c.name}` : c.id).join('\n');
            setInputText(newText);
            addLog("REMOVE_CANDIDATE", `Đã loại bỏ ${winner.id} khỏi danh sách.`);
        }

        setIsSpinning(false);
    };

    const handleReset = () => {
        setDisplayId("ARE YOU READY ?");
        setShowName(false);
        broadcast({ type: 'RESET' });
        addLog("RESET", "Reset màn hình hiển thị.");
    };

    const handleCloseModal = () => {
    setShowModal(false);
    broadcast({ type: 'CLOSE_MODAL' });

    setDisplayIdVisible(false); // fade out

    setTimeout(() => {
        setDisplayId("ARE YOU READY ?");
        setShowName(false);
        broadcast({ type: 'RESET' });

        requestAnimationFrame(() => {
            setDisplayIdVisible(true); // fade in
        });
    }, 400);
};

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                alert(`Lỗi khi bật toàn màn hình: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    const openProjectorWindow = () => {
        const width = 1024;
        const height = 768;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        const win = window.open('?projector=true', 'LuckyDrawProjector', `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`);
        
        if (!win) {
            alert("⚠️ Cửa sổ bị chặn! Vui lòng nhìn lên thanh địa chỉ và cho phép Pop-up (Cửa sổ bật lên) cho trang web này.");
            return;
        }

        setTimeout(() => {
            broadcast({ type: 'UPDATE_BG', payload: bgImage });
            broadcast({ type: 'UPDATE_PRIZE', payload: prize });
            if (customSound) broadcast({ type: 'UPDATE_SOUND', payload: customSound });
        }, 1000);
    };

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const url = `url(${ev.target?.result})`;
                setBgImage(url);
                broadcast({ type: 'UPDATE_BG', payload: url });
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handlePrizeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const newPrize = { ...prize, image: ev.target?.result as string };
                setPrize(newPrize);
                broadcast({ type: 'UPDATE_PRIZE', payload: newPrize });
                addLog("PRIZE_UPDATE", `Đổi ảnh giải thưởng: ${newPrize.name}`);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                const audioSrc = ev.target?.result as string;
                setCustomSound(audioSrc);
                setSoundName(file.name);
                addLog("SOUND_UPDATE", `Đã tải nhạc nền: ${file.name}`);
                broadcast({ type: 'UPDATE_SOUND', payload: audioSrc });
            };
            reader.readAsDataURL(file);
        }
    };

    const clearSound = () => {
        if (!audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setCustomSound(null);
        setSoundName('Chọn file MP3/WAV...');
        addLog("SOUND_CLEAR", "Đã xóa nhạc tùy chỉnh.");
        broadcast({ type: 'UPDATE_SOUND', payload: null });
    };

    const testSound = () => {
        if (!customSound) { alert("Chưa chọn file nhạc!"); return; }
        if (audioRef.current.paused) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => alert("Lỗi: " + e.message));
        } else {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const softReset = () => {
        if (confirm("Bạn có chắc muốn làm mới chương trình?\n- Lịch sử trúng thưởng sẽ bị xóa.\n- Danh sách tham gia trong ô nhập liệu sẽ được giữ nguyên.")) {
            setWinners([]);
            handleReset();
            setIsSpinning(false);
            addLog("SOFT_RESET", "Người dùng đã làm mới (Reset) chương trình.");
            alert("Đã làm mới thành công!");
        }
    };

    const exportSystemLogs = () => {
        if (logs.length === 0) { alert("Chưa có nhật ký hệ thống!"); return; }
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
        csvContent += "Thời Gian,Hành Động,Chi Tiết\n";
        logs.forEach(log => {
            const detail = log.detail.replace(/"/g, '""');
            csvContent += `"${log.time}","${log.action}","${detail}"\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const now = new Date();
        link.setAttribute("download", `system_log_${now.getHours()}h${now.getMinutes()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportWinners = () => {
        if (winners.length === 0) { alert("Chưa có dữ liệu!"); return; }
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
        csvContent += "STT,Tên Giải,Tên Người Trúng,MSSV,Thời Gian\n";
        [...winners].reverse().forEach((w, index) => {
            const date = w.timestamp.toLocaleString('vi-VN');
            const row = `${index + 1},"${(w.prizeName||"").replace(/"/g,'""')}","${(w.name||"").replace(/"/g,'""')}","${(w.id||"").replace(/"/g,'""')}","${date}"`;
            csvContent += row + "\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const now = new Date();
        link.setAttribute("download", `ket_qua_lucky_draw_${now.getHours()}h${now.getMinutes()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setInputText(ev.target?.result as string);
                addLog("IMPORT_DATA", `Nhập dữ liệu từ CSV.`);
                alert("Đã tải dữ liệu!");
            };
            reader.readAsText(e.target.files[0]);
        }
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-cover bg-center transition-all duration-500" style={{ backgroundImage: bgImage }}>
            {/* Top Nav */}
            <div id="topNav" className="fixed bottom-5 right-5 z-[100] opacity-80 hover:opacity-100 transform scale-95 hover:scale-100 hover:-translate-y-1 transition-all duration-300">
                <div className="glass-panel rounded-full p-1.5 flex gap-1 shadow-2xl border border-white/50">
                    <button onClick={() => setActiveTab('settings')} className={`nav-btn rounded-full font-bold transition-all flex items-center gap-2 px-4 py-2 text-sm ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <i className="fa-solid fa-gear"></i> <span>Cấu hình</span>
                    </button>
                    <button onClick={() => setActiveTab('stage')} className={`nav-btn rounded-full font-bold transition-all flex items-center gap-2 px-4 py-2 text-sm ${activeTab === 'stage' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <i className="fa-solid fa-tv"></i> <span>Sân khấu</span>
                    </button>
                    <button onClick={() => setActiveTab('fame')} className={`nav-btn rounded-full font-bold transition-all flex items-center gap-2 px-4 py-2 text-sm ${activeTab === 'fame' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <i className="fa-solid fa-gift"></i> <span>Kết quả</span>
                    </button>
                    <div className="w-[1px] h-6 bg-gray-300 mx-1 self-center"></div>
                    <button onClick={toggleFullScreen} className="nav-btn rounded-full font-bold transition-all text-gray-600 hover:bg-gray-100 flex items-center gap-2 px-4 py-2 text-sm" title="F11">
                        <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                    </button>
                    <button onClick={openProjectorWindow} className="nav-btn rounded-full font-bold transition-all text-purple-600 hover:bg-purple-100 flex items-center gap-2 px-4 py-2 text-sm" title="Mở màn hình chiếu">
                        <i className="fa-solid fa-up-right-from-square"></i>
                    </button>
                </div>
            </div>

            <div className="flex-grow flex items-center justify-center p-4 relative w-full h-full">
                {/* Settings View */}
                <div className={`w-full max-w-5xl h-[85vh] glass-panel rounded-3xl p-8 flex flex-col gap-6 relative z-10 animate-fade-in ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
                    <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <i className="fa-solid fa-sliders text-blue-600"></i> Thiết lập sự kiện
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={softReset} className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded border border-red-300 transition-colors flex items-center gap-1 font-bold" title="Làm mới lại từ đầu (Giữ dữ liệu)">
                                <i className="fa-solid fa-rotate"></i> Làm mới
                            </button>
                            <button onClick={exportSystemLogs} className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-300 transition-colors flex items-center gap-1" title="Tải file nhật ký hệ thống">
                                <i className="fa-solid fa-file-code"></i> Log Hệ Thống
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full overflow-hidden">
                        <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">1. Cấu hình chung:</label>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-gray-600">Loại bỏ người đã thắng?</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={removeWinner} onChange={e => setRemoveWinner(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <div className="relative mb-3">
                                    <input type="file" id="bgInput" accept="image/*" className="hidden" onChange={handleBgUpload} />
                                    <label htmlFor="bgInput" className="cursor-pointer w-full flex items-center justify-center gap-2 bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-all py-2 rounded-lg text-sm font-medium shadow-sm">
                                        <i className="fa-solid fa-image"></i> Đổi ảnh nền
                                    </label>
                                </div>

                                <div className="relative pt-2 border-t border-gray-200">
                                    <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Nhạc nền khi quay</label>
                                    <div className="flex items-center gap-2">
                                        <input type="file" id="soundInput" accept="audio/*" className="hidden" onChange={handleSoundUpload} />
                                        <label htmlFor="soundInput" className="cursor-pointer flex-grow flex items-center justify-center gap-2 bg-white text-purple-600 border border-purple-300 hover:bg-purple-50 transition-all py-2 rounded-lg text-sm font-medium shadow-sm">
                                            <i className="fa-solid fa-music"></i> <span>{soundName}</span>
                                        </label>
                                        <button onClick={testSound} className="px-3 py-2 min-w-[44px] bg-white border border-gray-300 rounded-lg hover:bg-gray-50" title="Nghe thử / Dừng">
                                            <i className="fa-solid fa-play"></i>
                                        </button>
                                        <button onClick={clearSound} className="px-3 py-2 min-w-[44px] bg-white border border-gray-300 rounded-lg hover:bg-gray-50" title="Xóa nhạc (Về mặc định)">
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 italic">*Lưu ý: Màn hình chiếu cần bấm nút "Bật âm thanh" xuất hiện lần đầu.</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-100 to-orange-50 rounded-bl-full -z-10 opacity-50"></div>
                                <label className="block text-lg font-bold text-gray-800 mb-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
                                        <i className="fa-solid fa-gift"></i>
                                    </div>
                                    2. Cấu hình Giải thưởng
                                </label>
                                
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Tên giải thưởng</label>
                                        <input type="text" value={prize.name} onChange={e => {
                                            const newPrize = { ...prize, name: e.target.value || "Giải Thưởng" };
                                            setPrize(newPrize);
                                            broadcast({ type: 'UPDATE_PRIZE', payload: newPrize });
                                        }} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 font-bold transition-all shadow-sm" placeholder="VD: Giải Nhất..." />
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Hình ảnh quà tặng</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center overflow-hidden relative group hover:border-blue-400 transition-colors">
                                                <img src={prize.image} className="w-full h-full object-contain p-2" alt="Prize Preview" />
                                            </div>
                                            <div className="flex-grow flex flex-col gap-2">
                                                <input type="file" id="prizeImgInput" accept="image/*" className="hidden" onChange={handlePrizeImageUpload} />
                                                <label htmlFor="prizeImgInput" className="cursor-pointer w-full text-center px-4 py-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 text-sm font-bold transition-all shadow-sm">
                                                    <i className="fa-solid fa-cloud-arrow-up mr-2"></i> Tải ảnh lên
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-5 border-t border-gray-100 grid grid-cols-2 gap-3">
                                        <button onClick={() => { addLog("SHOW_PRIZE", "Hiển thị giới thiệu giải thưởng"); broadcast({ type: 'SHOW_PRIZE_SCENE', payload: prize }); }} className="py-2.5 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white rounded-xl font-bold shadow-md transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-sm">
                                            <i className="fa-solid fa-desktop"></i> Chiếu Giới Thiệu
                                        </button>
                                        <button onClick={() => { addLog("BACK_TO_SPIN", "Quay lại màn hình quay số"); broadcast({ type: 'BACK_TO_SPIN' }); }} className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold shadow-sm transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-sm border border-gray-200">
                                            <i className="fa-solid fa-rotate-left"></i> Ẩn / Back
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col h-full">
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex justify-between items-center">
                                <span>3. Danh sách tham gia:</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">{parseCandidates(inputText).length}</span>
                                    <div className="relative group">
                                        <input type="file" id="csvInput" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                                        <label htmlFor="csvInput" className="cursor-pointer text-xs text-green-600 hover:underline font-semibold">
                                            <i className="fa-solid fa-upload"></i> CSV
                                        </label>
                                    </div>
                                </div>
                            </label>
                            <textarea 
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                className="flex-grow w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-gray-700 font-sans text-sm shadow-inner bg-white/50" 
                                placeholder="2011001, Nguyễn Văn A..." 
                                spellCheck="false"
                            />
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => { if(confirm('Xóa hết danh sách?')) { setInputText(''); addLog("CLEAR_DATA", "Xóa toàn bộ danh sách tham gia."); } }} className="text-xs text-red-500 hover:underline">Xóa tất cả</button>
                                <button onClick={() => { setInputText("Chưa có dữ liệu"); addLog("ADD_SAMPLE", "Thêm dữ liệu mẫu."); }} className="text-xs text-blue-500 hover:underline ml-auto">Mẫu</button> 
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 text-center">
                        <button onClick={() => setActiveTab('stage')} className="px-10 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105">
                            <i className="fa-solid fa-check mr-2"></i> Hoàn tất & Vào Sân khấu
                        </button>
                    </div>
                </div>

                {/* Stage View */}
                <div className={activeTab === 'stage' ? 'flex items-center justify-center w-full h-full' : 'hidden'}>
                    <Stage 
                        prize={prize}
                        displayId={displayId}
                        displayName={displayName}
                        showName={showName}
                        isRolling={isRolling}
                        showTimer={showTimer}
                        timerWidth={timerWidth}
                        timerTransition={timerTransition}
                        onSpin={startAutoSpin}
                        isSpinning={isSpinning}
                        onReset={handleReset}
                        showModal={showModal}
                    />
                </div>

                {/* Fame View */}
                <div className={`w-full max-w-6xl h-[85vh] glass-panel rounded-3xl p-8 flex flex-col relative z-10 animate-fade-in ${activeTab === 'fame' ? 'block' : 'hidden'}`}>
                    <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-800 uppercase tracking-wide">
                                <i className="fa-solid fa-gift text-red-500 mr-2"></i> Danh Sách Trúng Thưởng
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">Lịch sử các giải thưởng đã trao</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { addLog("SHOW_WINNERS", "Hiển thị danh sách trúng thưởng lên màn hình chiếu"); broadcast({ type: 'SHOW_WINNERS_LIST', payload: winners }); }} className="px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors border border-purple-200 font-semibold shadow-sm flex items-center gap-2">
                                <i className="fa-solid fa-tv"></i> Chiếu DS
                            </button>
                            <button onClick={() => { addLog("BACK_TO_SPIN", "Quay lại màn hình quay số"); broadcast({ type: 'BACK_TO_SPIN' }); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300 font-semibold shadow-sm flex items-center gap-2">
                                <i className="fa-solid fa-rotate-left"></i> Ẩn / Back
                            </button>
                            <div className="w-[1px] h-8 bg-gray-300 mx-2"></div>
                            <button onClick={exportWinners} className="px-4 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-200 font-semibold shadow-sm flex items-center gap-2">
                                <i className="fa-solid fa-file-excel"></i> Xuất danh sách
                            </button>
                            <button onClick={() => { if (confirm("Bạn có chắc?")) { setWinners([]); addLog("CLEAR_HISTORY", "Xóa lịch sử trúng thưởng."); } }} className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100 flex items-center gap-2">
                                <i className="fa-solid fa-trash-can"></i> Xóa lịch sử
                            </button>
                        </div>
                    </div>

                    {winners.length === 0 ? (
                        <div className="flex-grow flex flex-col items-center justify-center text-gray-400">
                            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <i className="fa-solid fa-box-open text-4xl opacity-30"></i>
                            </div>
                            <p>Chưa có ai trúng thưởng.</p>
                            <button onClick={() => setActiveTab('stage')} className="mt-4 px-6 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors font-semibold">
                                Quay ngay
                            </button>
                        </div>
                    ) : (
                        <div className="flex-grow overflow-y-auto pr-2 flex flex-col gap-3 pb-10">
                            {winners.map((w, index) => (
                                <div key={index} className="winner-card bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 animate-fade-up" style={{ animationDelay: `${index * 50}ms` }}>
                                    <div className="w-16 h-16 bg-gray-50 rounded-xl p-1 flex-shrink-0 border border-gray-100">
                                        <img src={w.prizeImage} className="w-full h-full object-contain" alt="Prize" />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <div className="text-xs font-bold text-yellow-600 uppercase mb-0.5 tracking-wide truncate">{w.prizeName}</div>
                                        <div className="text-lg font-bold text-gray-800 truncate">{w.name || "Ẩn danh"}</div>
                                        <div className="text-sm font-mono text-red-600 font-semibold">{w.id}</div>
                                    </div>
                                    <div className="text-xs text-gray-400 whitespace-nowrap">#{winners.length - index}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Winner Modal */}
            <div className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-500 ${showModal && activeTab === 'stage' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleCloseModal}>
                <div className={`p-10 max-w-4xl w-[90%] text-center transform transition-transform duration-500 ${showModal && activeTab === 'stage' ? 'scale-100' : 'scale-75'}`} onClick={e => e.stopPropagation()}>
                    <div className="relative z-10">
                        <div className="mb-6 flex flex-col items-center animate-fade-down">
                            <div className="text-2xl font-bold text-yellow-300 uppercase tracking-[0.3em] mb-2 drop-shadow-[0_0_10px_rgba(253,224,71,0.8)]">Xin chúc mừng</div>
                            <div className="text-4xl md:text-6xl font-bold text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">{prize.name}</div>
                        </div>
                        <div className="flex flex-col gap-4 mb-8">
                            <div className="text-7xl md:text-[8rem] leading-none font-bold text-yellow-400 break-words font-sans tracking-tighter drop-shadow-[0_0_40px_rgba(250,204,21,0.8)]">{modalData.id}</div>
                            <div className="text-5xl md:text-7xl font-bold text-white break-words mt-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]">{modalData.name}</div>
                        </div>
                        <div className="flex justify-center gap-4 mt-12">
                            <button onClick={handleCloseModal} className="px-8 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-full text-lg transition-colors flex items-center gap-2 backdrop-blur-md border border-white/30">
                                <i className="fa-solid fa-rotate-left"></i> Quay về
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function App() {
    const isProjector = window.location.search.includes('projector=true');

    if (isProjector) {
        return <ProjectorView />;
    }

    return <ControlView />;
}
