import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import AdminPanel from './AdminPanel';
import './admin.css';
import { onCommandChange, onStateChange, onWinnersChange, sendCommand, updateStateField, saveWinners, saveCandidates, detachListeners } from './firebase';
import { hasOfflineState, loadOfflineState, sendOfflineCommand, subscribeOffline, updateOfflineState } from './offline';

// --- Theme ---
const DEFAULT_BG = 'radial-gradient(ellipse at 50% 35%, #2a0202 0%, #120000 55%, #000000 100%)';
const CONFETTI_COLORS = ['#ff3b3b', '#ffd166', '#ffffff', '#ff8080'];

const SAMPLE_DATA_STR = "20240001, Nguyễn Hoàng Long\n20240002, Trịnh Thu Hà\n20240003, Lý Quốc Bảo\n20240004, Dương Minh Đức\n20240005, Nguyễn Thảo Vy\n20240006, Trần Gia Bảo\n20240007, Lê Phương Anh\n20240008, Phạm Đức Anh\n20240009, Võ Khánh Linh\n20240010, Huỳnh Nhật Minh\n20240011, Đinh Quang Huy\n20240012, Cao Bảo Ngọc\n20240013, Mai Anh Tuấn\n20240014, Tạ Ngọc Mai\n20240015, Ngô Minh Khang\n20240016, Phan Gia Linh\n20240017, Đoàn Quốc Việt\n20240018, Trương Khả Hân\n20240019, Hồ Thanh Phong\n20240020, Vũ Bảo Trâm";

const PAGE_SIZE = 30;

// --- Utils ---
const triggerModalConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: CONFETTI_COLORS });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: CONFETTI_COLORS });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
};

const parseCandidateLine = (line: string) => {
    let parts = line.includes('\t') ? line.split('\t') : line.split(',');
    if (parts.length < 2) parts = line.split('-');
    if (parts.length >= 2) return { id: parts[0].trim(), name: parts.slice(1).join(' ').trim() };
    return { id: line.trim(), name: '' };
};

const parseCandidates = (text: string) => text.split(/\r?\n/).filter(line => line.trim() !== '').map(parseCandidateLine);

const parseEditableCandidates = (text: string) => text.split(/\r?\n/).map(parseCandidateLine);

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

const getDuplicateIds = (candidates: any[]) => {
    const counts = new Map<string, { id: string; count: number }>();
    candidates.forEach(candidate => {
        const id = String(candidate.id || '').trim();
        const normalized = id.toLowerCase();
        if (!normalized) return;
        const existing = counts.get(normalized);
        counts.set(normalized, { id: existing?.id || id, count: (existing?.count || 0) + 1 });
    });
    return Array.from(counts.values()).filter(item => item.count > 1);
};

const maskIdentifier = (id: string) => {
    if (!id || id.includes('*')) return id;
    if (id.length <= 4) return '*'.repeat(id.length);
    if (id.length <= 7) return `${id[0]}****${id.slice(-1)}`;
    return `${id.slice(0, 3)}****${id.slice(-4)}`;
};

const maskDisplayIdentifier = (id: string, shouldMask: boolean) =>
    shouldMask && id && !id.includes('READY') ? maskIdentifier(id) : id;

const getSeamlessList = (candidates: any[]) => {
    if (candidates.length === 0) return [];
    const ids = candidates.map(c => c.id || c);
    const base: string[] = [];
    for (let i = 0; i < 6; i++) {
        base.push(ids[Math.floor(Math.random() * ids.length)]);
    }
    return [...base, ...base];
};

const getAdaptiveFontSize = (text: string, baseVw = 10, maxVw = 12) => {
    if (!text) return `${baseVw}vw`;
    const N = text.length;
    if (N <= 6) {
        return `clamp(3rem, ${baseVw}vw, ${maxVw}rem)`;
    }
    // Scale down linearly for N > 6
    const calculatedVw = (6 / N) * baseVw;
    const calculatedMaxRem = (6 / N) * maxVw;
    return `clamp(1.5rem, ${calculatedVw}vw, ${calculatedMaxRem}rem)`;
};

// --- Components ---
// Shrinks its single-line content to fit the container width, so text never wraps.
const FitText = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    const boxRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const box = boxRef.current, el = textRef.current;
        if (!box || !el) return;
        const fit = () => {
            el.style.fontSize = '';
            const avail = box.clientWidth;
            const natural = el.scrollWidth;
            if (avail > 0 && natural > avail) {
                const base = parseFloat(getComputedStyle(el).fontSize);
                el.style.fontSize = `${(base * avail / natural).toFixed(2)}px`;
            }
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(box);
        return () => ro.disconnect();
    }, [children]);
    return (
        <div ref={boxRef} className={`w-full text-center overflow-visible ${className}`}>
            <span ref={textRef} className="inline-block whitespace-nowrap align-top overflow-visible">
                {children}
            </span>
        </div>
    );
};

const LuckyWheel = ({ isRolling }: { isRolling: boolean }) => {
    const CX = 250, CY = 262, R = 200;
    const wedges = Array.from({ length: 20 }, (_, i) => {
        const a0 = (i / 20) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / 20) * Math.PI * 2 - Math.PI / 2;
        return {
            d: `M${CX} ${CY} L${CX + R * Math.cos(a0)} ${CY + R * Math.sin(a0)} A${R} ${R} 0 0 1 ${CX + R * Math.cos(a1)} ${CY + R * Math.sin(a1)} Z`,
            red: i % 2 === 0
        };
    });
    const bulbs = Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2 - Math.PI / 2;
        return { x: CX + (R + 13) * Math.cos(angle), y: CY + (R + 13) * Math.sin(angle), even: i % 2 === 0 };
    });
    return (
        <svg viewBox="0 0 500 505" className="w-full h-full" aria-hidden="true">
            <defs>
                <radialGradient id="hubFace" cx="38%" cy="32%" r="85%">
                    <stop offset="0%" stopColor="#2a0505" />
                    <stop offset="100%" stopColor="#0d0101" />
                </radialGradient>
                <filter id="neonGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <filter id="neonGlowWide" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="9" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <clipPath id="hubClip">
                    <circle cx={CX} cy={CY} r="52" />
                </clipPath>
            </defs>

            {/* Halo + rim band with bulbs */}
            <circle cx={CX} cy={CY} r={R + 13} fill="none" stroke="rgba(255,25,25,0.25)" strokeWidth="18" filter="url(#neonGlowWide)" />
            <circle cx={CX} cy={CY} r={R + 13} fill="none" stroke="#150202" strokeWidth="24" />
            <circle cx={CX} cy={CY} r={R + 26} fill="none" stroke="#ff1e1e" strokeWidth="2.5" filter="url(#neonGlow)" />
            <circle cx={CX} cy={CY} r={R + 1} fill="none" stroke="#ff1e1e" strokeWidth="2.5" filter="url(#neonGlow)" />

            {/* Alternating neon red / near-black wedges */}
            <circle cx={CX} cy={CY} r={R} fill="#120202" />
            <g className={isRolling ? 'wheel-spinning' : ''} style={{ transformOrigin: `${CX}px ${CY}px` }}>
                {wedges.map((w, i) => (
                    <path key={i} d={w.d} fill={w.red ? '#9e1010' : '#1c0505'} />
                ))}
            </g>

            {/* Rim bulbs */}
            {bulbs.map((b, i) => (
                <circle key={i} cx={b.x} cy={b.y} r="5.5" fill="#fff8f8" filter="url(#neonGlow)" className={b.even ? 'bulb-a' : 'bulb-b'} />
            ))}

            {/* Mascot hub */}
            <circle cx={CX} cy={CY} r="66" fill="url(#hubFace)" />
            <circle cx={CX} cy={CY} r="58" fill="#ffffff" />
            <image href="/Chibi head.png" x={CX - 46} y={CY - 46} width="92" height="92" clipPath="url(#hubClip)" preserveAspectRatio="xMidYMid meet" />
            <circle cx={CX} cy={CY} r="62" fill="none" stroke="#ff2a2a" strokeWidth="3" filter="url(#neonGlow)" />

            {/* Top pointer */}
            <polygon points={`${CX - 26},6 ${CX + 26},6 ${CX},56`} fill="#e01818" stroke="#ff5050" strokeWidth="2" filter="url(#neonGlow)" />
        </svg>
    );
};

const NumberReel = ({ prevId, id, nextId, isRolling }: { prevId: string, id: string, nextId: string, isRolling: boolean }) => {
    const isMainMessage = id === "ARE YOU READY ?" || id.includes("READY") || !id;

    // Base clamp dimensions: base values are N=6 length equivalents in vw and max-rem
    const middleStyle = {
        fontSize: getAdaptiveFontSize(id, 9.5, 12.5)
    };
    const subStyleTop = {
        fontSize: getAdaptiveFontSize(prevId, 6.5, 8.5)
    };
    const subStyleBottom = {
        fontSize: getAdaptiveFontSize(nextId, 6.5, 8.5)
    };

    return (
        <div className="relative h-[15rem] md:h-[28rem] flex flex-col items-center justify-center overflow-hidden w-full select-none">
            {/* The slot machine cylinder container */}
            <div className="flex flex-col items-center justify-center transition-all w-full overflow-visible">
                {/* Top Number */}
                <div className="h-[3rem] md:h-[7rem] flex items-center justify-center opacity-30 scale-75 blur-[0.5px] transition-all duration-300 w-full select-none overflow-hidden">
                    <div
                        style={subStyleTop}
                        className={`font-extrabold text-white/50 font-sans tracking-tight overflow-visible tabular-nums whitespace-nowrap ${isRolling ? 'slot-sub-rolling' : ''}`}
                    >
                        {isMainMessage ? "" : prevId}
                    </div>
                </div>

                {/* Middle (Active) Number */}
                <div className="h-[7rem] md:h-[14rem] flex items-center justify-center opacity-100 scale-100 transition-all duration-300 relative z-10 w-full select-none overflow-visible">
                    <div
                        style={middleStyle}
                        className={`font-extrabold text-white font-sans tracking-tight display-text overflow-visible transition-all duration-300 whitespace-nowrap ${isRolling ? 'blur-[0.5px]' : ''} ${isMainMessage ? '' : 'tabular-nums'}`}
                    >
                        {id}
                    </div>
                </div>

                {/* Bottom Number */}
                <div className="h-[3rem] md:h-[7rem] flex items-center justify-center opacity-30 scale-75 blur-[0.5px] transition-all duration-300 w-full select-none overflow-hidden">
                    <div
                        style={subStyleBottom}
                        className={`font-extrabold text-white/50 font-sans tracking-tight overflow-visible tabular-nums whitespace-nowrap ${isRolling ? 'slot-sub-rolling' : ''}`}
                    >
                        {isMainMessage ? "" : nextId}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Stage = ({
    displayId, displayPrevId, displayNextId, displayName, showName, isRolling,
    showControls = true, onSpin, isSpinning, showModal = false, maskId = false
}: any) => {
    const visibleId = maskDisplayIdentifier(displayId, maskId);
    const visiblePrevId = maskDisplayIdentifier(displayPrevId, maskId);
    const visibleNextId = maskDisplayIdentifier(displayNextId, maskId);

    return (
        <div className={`w-full ${showControls ? 'glass-panel-stage rounded-3xl p-6 pb-35' : 'h-full'} flex flex-col items-center justify-center relative overflow-hidden min-h-[70vh] md:min-h-[90vh] ${showControls ? 'pb-35' : ''}`}>
            <div className={`w-full flex-grow flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 px-6 md:px-16 mt-4 transition-all duration-500 ${showModal ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
                <div className="relative flex-1 flex flex-col items-center justify-center min-w-0 w-full md:translate-y-5">
                    <div className="absolute w-[80%] h-[80%] bg-red-000 rounded-full filter blur-3xl opacity-30 -z-10"></div>
                    {/* Spacer to center the main text vertically by balancing the displayName below */}
                    <div className="text-2xl md:text-4xl mt-4 min-h-12 invisible select-none pointer-events-none" aria-hidden="true">&nbsp;</div>

                    <NumberReel prevId={visiblePrevId} id={visibleId} nextId={visibleNextId} isRolling={isRolling} />

                    <FitText className={`text-2xl md:text-4xl font-bold text-yellow-300 neon-text-gold mt-4 min-h-12 transform transition-all duration-500 ${showName ? 'opacity-100 translate-y-[10px]' : 'opacity-0 translate-y-0'}`}>
                        {displayName}
                    </FitText>
                </div>

                <div className="relative h-[28vh] md:h-[64vh] aspect-[500/505] max-w-[88vw] shrink-0">
                    <LuckyWheel isRolling={isRolling} />
                </div>
            </div>

            {showControls && (
                <div className="fixed md:absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
                    <button
                        onClick={onSpin}
                        disabled={isSpinning}
                        className={`group relative inline-flex items-center justify-center px-10 py-4 font-bold text-white transition-all duration-200 bg-gradient-to-b from-red-500 to-red-700 border border-red-300/60 rounded-full focus:outline-none shadow-[0_0_25px_rgba(255,40,40,0.7)] ${isSpinning ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 hover:shadow-[0_0_45px_rgba(255,60,60,0.9)]'}`}
                    >
                        <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-white rounded-full group-hover:w-80 group-hover:h-80 opacity-10"></span>
                        <span className="relative flex items-center gap-3 text-xl uppercase tracking-wider">
                            <i className="fa-solid fa-play"></i>
                            <span>{isSpinning ? "ĐANG QUAY..." : "QUAY"}</span>
                        </span>
                    </button>
                </div>
            )}

        </div>
    );
};

const ProjectorView = ({ offline = false }: { offline?: boolean }) => {
    const [bgImage, setBgImage] = useState(DEFAULT_BG);
    const [prize, setPrize] = useState({ name: "THÀNH VIÊN S-STUDENT", image: "" });
    const [displayId, setDisplayId] = useState("ARE YOU READY ?");
    const [displayPrevId, setDisplayPrevId] = useState("");
    const [displayNextId, setDisplayNextId] = useState("");
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
    const [maskId, setMaskId] = useState(false);
    const spinIntervalRef = useRef<any>(null);

    useEffect(() => {
        const handleCommand = (cmd: any) => {
            const { type, payload } = cmd;
            switch (type) {
                case 'SHOW_PRIZE_SCENE':
                    setOverlayState('prize');
                    if (payload) setPrize(payload);
                    break;
                case 'SHOW_WINNERS_LIST':
                    setOverlayState('winners');
                    break;
                case 'BACK_TO_SPIN':
                    setOverlayState('none');
                    setShowModal(false);
                    break;
                case 'SPIN_START': {
                    if (payload?.maskId !== undefined) setMaskId(payload.maskId);
                    setOverlayState('none');
                    setIsRolling(true);
                    setShowName(false);
                    setShowTimer(true);
                    setTimerWidth('100%');
                    setTimerTransition('none');
                    const duration = payload?.duration || 10000;
                    const candidates = payload?.candidates || [];
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setTimerWidth('0%');
                            setTimerTransition(`width ${duration}ms linear`);
                        });
                    });

                    // Run local spin animation
                    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
                    if (candidates.length > 0) {
                        spinIntervalRef.current = setInterval(() => {
                            const index = Math.floor(Math.random() * candidates.length);
                            const rc = candidates[index];
                            const prevRc = candidates[(index - 1 + candidates.length) % candidates.length];
                            const nextRc = candidates[(index + 1) % candidates.length];
                            setDisplayId(rc.id || rc);
                            setDisplayPrevId(prevRc.id || prevRc);
                            setDisplayNextId(nextRc.id || nextRc);
                        }, 50);
                    }
                    break;
                }
                case 'SPIN_STOP':
                    if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null; }
                    setIsRolling(false);
                    setDisplayId(payload?.id || '');
                    setDisplayPrevId(payload?.prevId || '');
                    setDisplayNextId(payload?.nextId || '');
                    setShowTimer(false);
                    break;
                case 'SHOW_NAME':
                    setDisplayName(payload?.name || '');
                    setShowName(true);
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: CONFETTI_COLORS });
                    break;
                case 'SHOW_MODAL':
                    setModalData(payload || { id: '', name: '' });
                    setOverlayState('none');
                    setShowModal(true);
                    triggerModalConfetti();
                    break;
                case 'CLOSE_MODAL':
                    setShowModal(false);
                    break;
                case 'RESET':
                    if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null; }
                    setOverlayState('none');
                    setDisplayId("ARE YOU READY ?");
                    setDisplayPrevId("");
                    setDisplayNextId("");
                    setShowName(false);
                    setShowModal(false);
                    break;
            }
        };

        if (offline) {
            const state = loadOfflineState();
            setBgImage(state.bgImage);
            setPrize(state.prize);
            setWinners(state.winners);
            setMaskId(state.maskId);
            return subscribeOffline((message) => {
                if (message.type === 'state') {
                    const data = message.payload;
                    if (data.bgImage !== undefined) setBgImage(data.bgImage);
                    if (data.prize !== undefined) setPrize(data.prize);
                    if (data.winners !== undefined) setWinners(data.winners);
                    if (data.maskId !== undefined) setMaskId(data.maskId);
                }
                if (message.type === 'command') handleCommand(message.payload);
            });
        }

        onStateChange((data) => {
            if (data.bgImage !== undefined) setBgImage(data.bgImage);
            if (data.prize !== undefined) setPrize(data.prize);
            if (data.maskId !== undefined) setMaskId(data.maskId);
        });
        onWinnersChange((w) => setWinners(w));
        onCommandChange(handleCommand);

        return () => detachListeners();
    }, [offline]);

    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('fullscreen') !== 'true') return;
        document.documentElement.requestFullscreen?.().catch(() => undefined);
    }, []);

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-cover bg-center flex items-center justify-center" style={{ backgroundImage: bgImage }}>
            <div className="absolute inset-0 bg-cover bg-center pointer-events-none mix-blend-screen" style={{ backgroundImage: "url('/particles.png')" }}></div>
            {overlayState === 'none' && (
                <Stage
                    displayId={displayId}
                    displayPrevId={displayPrevId}
                    displayNextId={displayNextId}
                    displayName={displayName}
                    showName={showName}
                    isRolling={isRolling}
                    showControls={false}
                    showModal={showModal}
                    maskId={maskId}
                />
            )}

            {overlayState === 'prize' && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center animate-fade-in" style={{ backgroundImage: DEFAULT_BG }}>
                    <div className="absolute inset-0 bg-cover bg-center pointer-events-none mix-blend-screen" style={{ backgroundImage: "url('/particles.png')" }}></div>
                    <div className="relative w-[50vh] h-[50vh] mb-10">
                        <div className="absolute inset-0 bg-red-500 rounded-full filter blur-3xl opacity-30"></div>
                        <img src={prize.image} className="w-full h-full object-contain relative z-10 drop-shadow-2xl animate-zoom-in prize-pulse" alt="Prize" />
                    </div>
                    <div className="bg-black/40 backdrop-blur-xl border border-red-500/50 shadow-[0_0_40px_rgba(255,40,40,0.4)] rounded-[30px] px-20 py-10 text-center animate-fade-up">
                        <div className="text-xl font-bold text-red-100/80 uppercase tracking-[0.3em] mb-2">Đang quay giải thưởng</div>
                        <FitText className="text-5xl text-yellow-300 font-extrabold uppercase neon-text-gold">{prize.name}</FitText>
                    </div>
                </div>
            )}

            {overlayState === 'winners' && (
                <div className="fixed inset-0 bg-cover bg-center backdrop-blur-xl z-[9999] flex flex-col items-center p-10 animate-fade-in" style={{ backgroundImage: bgImage }}>
                    <div className="absolute inset-0 bg-cover bg-center pointer-events-none mix-blend-screen" style={{ backgroundImage: "url('/particles.png')" }}></div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-yellow-300 neon-text-gold uppercase mb-16 flex items-center gap-4 bg-black/40 border border-red-500/50 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(255,40,40,0.4)]">
                        <i className="fa-solid fa-list"></i> XIN CHÚC MỪNG
                    </h1>
                    <div className="w-full max-w-5xl flex-grow overflow-y-auto pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                            {winners.length === 0 ? (
                                <div className="text-center text-red-100/70 italic py-10 w-full col-span-2 bg-black/30 border border-red-500/30 rounded-xl">Chưa có ai trúng thưởng</div>
                            ) : (
                                winners.map((w, index) => (
                                    <div key={index} className="flex items-center gap-4 bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-red-500/30 shadow-[0_0_15px_rgba(255,40,40,0.15)] animate-fade-up" style={{ animationDelay: `${index * 0.1}s` }}>
                                        <div className="text-xl font-bold text-red-300/60">#{winners.length - index}</div>
                                        <div className="w-12 h-12 bg-white/95 p-1 rounded-lg border border-red-400/40">
                                            <img src={w.prizeImage} className="w-full h-full object-contain" alt="Prize" />
                                        </div>
                                        <div className="flex-grow">
                                            <div className="text-xs font-bold text-yellow-400 uppercase">{w.prizeName}</div>
                                            <div className="text-lg font-bold text-white">{w.name || "Ẩn danh"}</div>
                                            <div className="text-sm text-red-300 font-mono">{maskId ? maskIdentifier(w.id) : w.id}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Winner Modal */}
            <div className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-500 bg-cover bg-center ${showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ backgroundImage: bgImage }}>
                <div className="absolute inset-0 bg-cover bg-center pointer-events-none mix-blend-screen" style={{ backgroundImage: "url('/particles.png')" }}></div>
                <div className={`relative z-10 p-8 max-w-6xl w-[90%] text-center transform transition-transform duration-500 ${showModal ? 'scale-100' : 'scale-75'}`}>
                    <div className="flex flex-col items-center justify-center gap-6">
                        <div className="text-3xl md:text-5xl font-bold text-white uppercase tracking-[0.2em] display-text animate-fade-down">
                            Xin chúc mừng
                        </div>
                        <FitText className="text-4xl md:text-6xl font-extrabold text-white uppercase display-text mb-4 animate-fade-down">
                            {prize.name}
                        </FitText>

                        <FitText className="text-6xl md:text-8xl lg:text-[8rem] font-extrabold text-yellow-300 neon-text-gold uppercase leading-tight my-4">
                            {modalData.name}
                        </FitText>

                        <FitText className="text-5xl md:text-6xl lg:text-7xl font-bold text-white font-sans tracking-widest display-text">
                            {maskId ? maskIdentifier(modalData.id) : modalData.id}
                        </FitText>
                    </div>
                </div>
            </div>

        </div>
    );
};

const ControlView = ({ offline = false }: { offline?: boolean }) => {
    const [activeTab, setActiveTab] = useState('settings');
    const [prize, setPrize] = useState({ name: "THÀNH VIÊN S-STUDENT", image: "" });
    const [winners, setWinners] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [maskId, setMaskId] = useState(false);
    const [removeWinner, setRemoveWinner] = useState(true);
    const [bgImage, setBgImage] = useState(DEFAULT_BG);
    const [customSound, setCustomSound] = useState<string | null>(null);
    const [soundName, setSoundName] = useState('Chọn file MP3/WAV...');
    const [inputText, setInputText] = useState('');
    const [inputIds, setInputIds] = useState('');
    const [inputNames, setInputNames] = useState('');
    const [showDataTable, setShowDataTable] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const [displayId, setDisplayId] = useState("ARE YOU READY ?");
    const [displayPrevId, setDisplayPrevId] = useState("");
    const [displayNextId, setDisplayNextId] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [showName, setShowName] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [showTimer, setShowTimer] = useState(false);
    const [timerWidth, setTimerWidth] = useState('100%');
    const [timerTransition, setTimerTransition] = useState('none');

    const [showModal, setShowModal] = useState(false);
    const [modalData, setModalData] = useState({ id: '', name: '' });
    const [isFullscreen, setIsFullscreen] = useState(false);

    const audioRef = useRef(new Audio());
    const audioCtxRef = useRef<AudioContext | null>(null);
    const spinIntervalRef = useRef<any>(null);

    const syncImportData = (text: string) => {
        const columns = splitCandidateColumns(text);
        setInputText(text);
        setInputIds(columns.ids);
        setInputNames(columns.names);
    };

    useEffect(() => {
        if (offline) {
            const state = loadOfflineState();
            setWinners(state.winners);
            syncImportData(hasOfflineState() ? state.candidates : '');
            setBgImage(state.bgImage || DEFAULT_BG);
            setPrize(state.prize);
            setRemoveWinner(state.removeWinner);
            setMaskId(state.maskId);
            return subscribeOffline((message) => {
                if (message.type !== 'state') return;
                const data = message.payload;
                if (data.winners !== undefined) setWinners(data.winners);
                if (data.candidates !== undefined) syncImportData(data.candidates);
                if (data.bgImage !== undefined) setBgImage(data.bgImage);
                if (data.prize !== undefined) setPrize(data.prize);
                if (data.removeWinner !== undefined) setRemoveWinner(data.removeWinner);
                if (data.maskId !== undefined) setMaskId(data.maskId);
            });
        }

        onWinnersChange((w) => setWinners(w));
        onStateChange((data) => {
            if (data.maskId !== undefined) setMaskId(data.maskId);
        });
        return () => detachListeners();
    }, [offline]);

    const appCommand = (type: string, payload: any = null) => offline ? sendOfflineCommand(type, payload) : sendCommand(type, payload);
    const saveAppWinners = (next: any[]) => offline ? updateOfflineState({ winners: next }) : saveWinners(next);
    const saveAppCandidates = (text: string) => offline ? updateOfflineState({ candidates: text }) : saveCandidates(text);
    const updateImportColumns = (ids: string, names: string) => {
        const next = combineCandidateColumns(ids, names);
        syncImportData(next);
        if (offline) updateOfflineState({ candidates: next });
    };

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
                setTimerTransition(`width 10000ms linear`);
            });
        });
        setShowModal(false);

        // Send the spin command through the active sync channel.
        appCommand('SPIN_START', { duration: 10000, candidates: parsedCandidates, maskId });

        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        let counter = 0;
        spinIntervalRef.current = setInterval(() => {
            const index = Math.floor(Math.random() * parsedCandidates.length);
            const randomCandidate = parsedCandidates[index];
            const prevCandidate = parsedCandidates[(index - 1 + parsedCandidates.length) % parsedCandidates.length];
            const nextCandidate = parsedCandidates[(index + 1) % parsedCandidates.length];
            setDisplayId(randomCandidate.id);
            setDisplayPrevId(prevCandidate.id);
            setDisplayNextId(nextCandidate.id);
            if (counter % 4 === 0) playTickSound();
            counter++;
        }, 50);

        setTimeout(() => {
            if (spinIntervalRef.current) {
                clearInterval(spinIntervalRef.current);
                spinIntervalRef.current = null;
            }
            finishSpin(parsedCandidates);
        }, 10000);
    };

    const finishSpin = (parsedCandidates: any[]) => {
        setIsRolling(false);
        setShowTimer(false);

        if (spinIntervalRef.current) {
            clearInterval(spinIntervalRef.current);
            spinIntervalRef.current = null;
        }

        if (customSound && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        const winnerIndex = Math.floor(Math.random() * parsedCandidates.length);
        const winner = parsedCandidates[winnerIndex];

        const winRecord = { ...winner, prizeName: prize.name, prizeImage: prize.image, timestamp: new Date() };
        const newWinners = [winRecord, ...winners];
        setWinners(newWinners);
        saveAppWinners(newWinners);

        addLog("WINNER_FOUND", `Người trúng: ${winner.id} - ${winner.name} (Giải: ${prize.name})`);

        const prevId = parsedCandidates[(winnerIndex - 1 + parsedCandidates.length) % parsedCandidates.length].id;
        const nextId = parsedCandidates[(winnerIndex + 1) % parsedCandidates.length].id;
        setDisplayId(winner.id);
        setDisplayPrevId(prevId);
        setDisplayNextId(nextId);
        appCommand('SPIN_STOP', { id: winner.id, prevId, nextId });

        const name = winner.name || "(Không có tên)";
        setDisplayName(name);
        setShowName(true);
        playWinSound();
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: CONFETTI_COLORS });
        setTimeout(() => appCommand('SHOW_NAME', { name }), 500);

        setTimeout(() => {
            setModalData({ id: winner.id, name: name });
            setShowModal(true);
            triggerModalConfetti();
            appCommand('SHOW_MODAL', { id: winner.id, name: name });
        }, 2000);

        if (removeWinner) {
            const newCandidates = [...parsedCandidates];
            newCandidates.splice(winnerIndex, 1);
            const newText = serializeCandidates(newCandidates);
            syncImportData(newText);
            saveAppCandidates(newText);
            addLog("REMOVE_CANDIDATE", `Đã loại bỏ ${winner.id} khỏi danh sách.`);
        }

        setIsSpinning(false);
    };

    const handleReset = () => {
        setDisplayId("ARE YOU READY ?");
        setDisplayPrevId("");
        setDisplayNextId("");
        setShowName(false);
        setShowModal(false);
        appCommand('RESET');
        addLog("RESET", "Reset màn hình hiển thị.");
    };

    const handleCloseModal = () => {
        setShowModal(false);
        appCommand('CLOSE_MODAL');
        setTimeout(() => {
            setDisplayId("ARE YOU READY ?");
            setDisplayPrevId("");
            setDisplayNextId("");
            setShowName(false);
            appCommand('RESET');
        }, 300);
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
        const width = window.screen.availWidth;
        const height = window.screen.availHeight;

        const win = window.open(
            `${window.location.origin}${window.location.pathname}?${offline ? 'offline=true&' : ''}projector=true`,
            '_blank',
            `popup=yes,width=${width},height=${height},top=0,left=0`
        );

        if (!win) {
            alert("⚠️ Cửa sổ bị chặn! Hãy cho phép pop-up.");
            return;
        }
        win.focus();

        if (offline) {
            updateOfflineState({ bgImage, prize, maskId });
        } else {
            updateStateField('bgImage', bgImage);
            updateStateField('prize', prize);
            updateStateField('maskId', maskId);
        }
    };
    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const url = `url(${ev.target?.result})`;
                setBgImage(url);
                if (offline) updateOfflineState({ bgImage: url });
                else updateStateField('bgImage', url);
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
        if (confirm("Bạn có chắc muốn làm mới chương trình?\n- Lịch sử trúng thưởng sẽ bị xóa.\n- Dữ liệu tham gia sẽ về trắng.\n- Màn hình sẽ quay lại ô Import data.")) {
            setWinners([]);
            if (offline) updateOfflineState({ winners: [] });
            syncImportData('');
            setShowDataTable(false);
            setCurrentPage(1);
            if (offline) updateOfflineState({ candidates: '' });
            else saveCandidates('');
            handleReset();
            setIsSpinning(false);
            addLog("SOFT_RESET", "Đã làm mới chương trình và đưa dữ liệu về trắng.");
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
            const date = new Date(w.timestamp).toLocaleString('vi-VN');
            const winnerId = maskId ? maskIdentifier(w.id || '') : (w.id || '');
            const row = `${index + 1},"${(w.prizeName || "").replace(/"/g, '""')}","${(w.name || "").replace(/"/g, '""')}","${winnerId.replace(/"/g, '""')}","${date}"`;
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
                const value = ev.target?.result as string;
                syncImportData(value);
                setShowDataTable(true);
                if (offline) updateOfflineState({ candidates: value });
                addLog("IMPORT_DATA", `Nhập dữ liệu từ CSV.`);
                alert("Đã tải dữ liệu!");
            };
            reader.readAsText(e.target.files[0]);
        }
    };

    const parsedCandidates = parseCandidates(inputText);
    const editableCandidates = parseEditableCandidates(inputText);
    const duplicateIds = getDuplicateIds(parsedCandidates);
    const totalPages = Math.max(1, Math.ceil(editableCandidates.length / PAGE_SIZE));
    const remainingCount = removeWinner ? parsedCandidates.length : Math.max(parsedCandidates.length - winners.length, 0);
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
        if (offline) updateOfflineState({ candidates: next });
    };
    const addCandidateRow = () => {
        const next = `${inputText}${inputText ? '\n' : ''}`;
        syncImportData(next);
        if (offline) updateOfflineState({ candidates: next });
    };
    const removeCandidateRow = (index: number) => {
        const rows = parseEditableCandidates(inputText);
        rows.splice(index, 1);
        const next = serializeCandidates(rows);
        syncImportData(next);
        if (offline) updateOfflineState({ candidates: next });
    };
    const applyData = () => {
        setShowDataTable(true);
        setCurrentPage(1);
        addLog("APPLY_DATA", `Đã chuyển ${parseCandidates(inputText).length} dòng sang bảng.`);
    };
    const resetCandidateData = () => {
        if (!confirm('Đưa dữ liệu tham gia về trắng?')) return;
        syncImportData('');
        setShowDataTable(false);
        setCurrentPage(1);
        if (offline) updateOfflineState({ candidates: '' });
        else saveCandidates('');
        addLog("RESET_DATA", "Đã đưa dữ liệu tham gia về trắng.");
    };

    return (
        <div className="relative flex flex-col h-screen overflow-hidden bg-cover bg-center transition-all duration-500" style={{ backgroundImage: bgImage }}>
            <div className="absolute inset-0 bg-cover bg-center pointer-events-none mix-blend-screen" style={{ backgroundImage: "url('/particles.png')" }}></div>
            {/* Top Nav */}
            <div id="topNav" className="fixed top-5 md:top-auto bottom-auto md:bottom-5 right-5 z-[100] opacity-80 hover:opacity-100 transform scale-95 hover:scale-100 hover:-translate-y-1 transition-all duration-300">
                <div className="glass-panel rounded-full p-1.5 flex gap-1 shadow-2xl border border-white/50">
                    {offline && <span className="px-3 py-2 text-xs font-bold text-green-700 bg-green-100 rounded-full">OFFLINE</span>}
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
                    <button onClick={openProjectorWindow} className="nav-btn rounded-full font-bold transition-all text-purple-600 hover:bg-purple-100 flex items-center gap-2 px-4 py-2 text-sm" title="Mở màn hình chiếu (Extend)">
                        <i className="fa-solid fa-up-right-from-square"></i> <span>Extend</span>
                    </button>
                </div>
            </div>

            <div className="flex-grow flex items-center justify-center p-4 relative w-full h-full">
                {/* Settings View */}
                <div className={`w-full max-w-5xl h-[85vh] overflow-y-auto glass-panel rounded-3xl p-8 flex flex-col gap-6 relative z-10 animate-fade-in ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
                    <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <i className="fa-solid fa-sliders text-blue-600"></i> Thiết lập sự kiện
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={softReset} className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded border border-red-300 transition-colors flex items-center gap-1 font-bold" title="Làm mới và xóa dữ liệu tham gia">
                                <i className="fa-solid fa-rotate"></i> Làm mới
                            </button>
                            <button onClick={exportSystemLogs} className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-300 transition-colors flex items-center gap-1" title="Tải file nhật ký hệ thống">
                                <i className="fa-solid fa-file-code"></i> Log Hệ Thống
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-0 overflow-visible">
                        <div className="flex flex-col gap-4 h-auto overflow-visible pr-2">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">1. Cấu hình chung:</label>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-gray-600">Loại bỏ người đã thắng?</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={removeWinner} onChange={e => { const value = e.target.checked; setRemoveWinner(value); if (offline) updateOfflineState({ removeWinner: value }); }} className="sr-only peer" />
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
                            </div>                        </div>

                        <div className="flex flex-col h-auto min-h-0">
                            <div className="block text-sm font-semibold text-gray-700 mb-2 flex justify-between items-center">
                                <span>3. Danh sách tham gia:</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">{parsedCandidates.length}</span>
                                    <label className="flex items-center gap-1 text-xs text-gray-600 font-medium cursor-pointer" title="Giữ 3 ký tự đầu và 4 ký tự cuối">
                                        <input
                                            type="checkbox"
                                            checked={maskId}
                                            onChange={e => {
                                                const value = e.target.checked;
                                                setMaskId(value);
                                                if (offline) updateOfflineState({ maskId: value });
                                                else updateStateField('maskId', value);
                                            }}
                                        />
                                        Che ID
                                    </label>
                                    <div className="relative group">
                                        <input type="file" id="csvInput" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                                        <label htmlFor="csvInput" className="cursor-pointer text-xs text-green-600 hover:underline font-semibold">
                                            <i className="fa-solid fa-upload"></i> CSV
                                        </label>
                                    </div>
                                    {showDataTable && <button type="button" onClick={() => setShowDataTable(false)} className="text-xs text-blue-600 hover:underline font-semibold">Import data</button>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-4">
                                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                    <div className="text-[10px] uppercase text-blue-600">Tham gia</div>
                                    <div className="text-xl font-bold text-blue-900">{parsedCandidates.length}</div>
                                </div>
                                <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
                                    <div className="text-[10px] uppercase text-purple-600">Đã quay</div>
                                    <div className="text-xl font-bold text-purple-900">{winners.length}</div>
                                </div>
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                                    <div className="text-[10px] uppercase text-emerald-600">Còn lại</div>
                                    <div className="text-xl font-bold text-emerald-900">{remainingCount}</div>
                                </div>
                                <div className={`rounded-lg border px-3 py-2 ${duplicateIds.length ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                                    <div className={`text-[10px] uppercase ${duplicateIds.length ? 'text-red-600' : 'text-gray-500'}`}>ID trùng</div>
                                    <div className={`text-xl font-bold ${duplicateIds.length ? 'text-red-900' : 'text-gray-700'}`}>{duplicateIds.length}</div>
                                </div>
                            </div>
                            {duplicateIds.length > 0 && (
                                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                                    <div className="font-semibold"><i className="fa-solid fa-triangle-exclamation mr-1"></i>Cảnh báo ID trùng</div>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {duplicateIds.map(item => <span key={item.id} className="rounded bg-white px-2 py-1 font-mono">{item.id} ({item.count} dòng)</span>)}
                                    </div>
                                </div>
                            )}
                            {showDataTable ? (
                                <>
                            <div className="h-[min(55vh,520px)] min-h-0 overflow-y-auto rounded-xl border border-gray-300 bg-white/50 shadow-inner">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 z-10 bg-gray-100/95 text-left text-[11px] uppercase text-gray-500">
                                        <tr>
                                            <th className="p-2 font-semibold">ID</th>
                                            <th className="p-2 font-semibold">Họ và tên</th>
                                            <th className="w-16 p-2 text-center font-semibold">Xóa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedCandidates.map(({ candidate, index }) => (
                                            <tr key={index} className="border-t border-gray-200">
                                                <td className="p-1 align-top">
                                                    <input
                                                        aria-label={`ID dòng ${index + 1}`}
                                                        value={maskId ? maskIdentifier(candidate.id) : candidate.id}
                                                        readOnly={maskId}
                                                        onChange={e => updateCandidateField(index, 'id', e.target.value)}
                                                        className="w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                        placeholder="MSSV / SĐT / STT"
                                                    />
                                                </td>
                                                <td className="p-1 align-top">
                                                    <input
                                                        aria-label={`Họ và tên dòng ${index + 1}`}
                                                        value={candidate.name}
                                                        onChange={e => updateCandidateField(index, 'name', e.target.value)}
                                                        className="w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                        placeholder="Nguyễn Văn A"
                                                    />
                                                </td>
                                                <td className="p-1 text-center align-top">
                                                    <button type="button" onClick={() => removeCandidateRow(index)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50" aria-label={`Xóa dòng ${index + 1}`}>
                                                        Xóa
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                                <span>Trang {currentPage} / {totalPages}</span>
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded border border-gray-300 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Trước</button>
                                    <button type="button" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded border border-gray-300 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Sau</button>
                                </div>
                            </div>
                            <p className="mt-2 text-[11px] text-gray-500">Bật “Che ID” sẽ giữ 3 ký tự đầu và 4 ký tự cuối. Dữ liệu gốc vẫn dùng để quay số.</p>
                            <div className="flex gap-2 mt-2">
                                <button onClick={resetCandidateData} className="text-xs text-red-500 hover:underline">Reset data</button>
                                <button onClick={addCandidateRow} className="text-xs text-blue-600 hover:underline">Thêm dòng</button>
                                <button onClick={() => { syncImportData(SAMPLE_DATA_STR); if (offline) updateOfflineState({ candidates: SAMPLE_DATA_STR }); addLog("ADD_SAMPLE", "Thêm dữ liệu mẫu."); }} className="text-xs text-blue-500 hover:underline ml-auto">Mẫu</button>
                            </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <label className="block text-xs font-semibold text-gray-600">
                                            <span className="mb-1 block">ID</span>
                                            <textarea
                                                value={inputIds}
                                                onChange={e => updateImportColumns(e.target.value, inputNames)}
                                                className="h-[min(38vh,360px)] min-h-[180px] w-full resize-none rounded-xl border border-gray-300 bg-white/50 p-3 font-mono text-sm text-gray-700 shadow-inner outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
                                                spellCheck="false"
                                            />
                                        </label>
                                        <label className="block text-xs font-semibold text-gray-600">
                                            <span className="mb-1 block">Họ và tên</span>
                                            <textarea
                                                value={inputNames}
                                                onChange={e => updateImportColumns(inputIds, e.target.value)}
                                                className="h-[min(38vh,360px)] min-h-[180px] w-full resize-none rounded-xl border border-gray-300 bg-white/50 p-3 text-sm text-gray-700 shadow-inner outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
                                                spellCheck="false"
                                            />
                                        </label>
                                    </div>
                                    <p className="mt-2 text-[11px] text-gray-500">Dán riêng từng cột từ Excel. Dòng ID thứ nhất ghép với họ tên thứ nhất.</p>
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={applyData} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Apply data</button>
                                        <button onClick={resetCandidateData} className="text-xs text-red-500 hover:underline">Reset data</button>
                                        <button onClick={() => { syncImportData(SAMPLE_DATA_STR); if (offline) updateOfflineState({ candidates: SAMPLE_DATA_STR }); addLog("ADD_SAMPLE", "Thêm dữ liệu mẫu."); }} className="text-xs text-blue-500 hover:underline ml-auto">Mẫu</button>
                                    </div>
                                </>
                            )}
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
                        displayId={displayId}
                        displayPrevId={displayPrevId}
                        displayNextId={displayNextId}
                        displayName={displayName}
                        showName={showName}
                        isRolling={isRolling}
                        onSpin={startAutoSpin}
                        isSpinning={isSpinning}
                        showModal={showModal}
                        maskId={maskId}
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
                            <button onClick={() => { addLog("SHOW_WINNERS", "Hiển thị danh sách trúng thưởng lên màn hình chiếu"); appCommand('SHOW_WINNERS_LIST', winners); }} className="px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors border border-purple-200 font-semibold shadow-sm flex items-center gap-2">
                                <i className="fa-solid fa-tv"></i> Chiếu DS
                            </button>
                            <button onClick={() => { addLog("BACK_TO_SPIN", "Quay lại màn hình quay số"); appCommand('BACK_TO_SPIN'); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300 font-semibold shadow-sm flex items-center gap-2">
                                <i className="fa-solid fa-rotate-left"></i> Ẩn / Back
                            </button>
                            <div className="w-[1px] h-8 bg-gray-300 mx-2"></div>
                            <button onClick={exportWinners} className="px-4 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-200 font-semibold shadow-sm flex items-center gap-2">
                                <i className="fa-solid fa-file-excel"></i> Xuất danh sách
                            </button>
                            <button onClick={() => { if (confirm("Bạn có chắc?")) { setWinners([]); saveAppWinners([]); addLog("CLEAR_HISTORY", "Xóa lịch sử trúng thưởng."); } }} className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100 flex items-center gap-2">
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
                                        <div className="text-sm font-mono text-red-600 font-semibold">{maskId ? maskIdentifier(w.id) : w.id}</div>
                                    </div>
                                    <div className="text-xs text-gray-400 whitespace-nowrap">#{winners.length - index}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Winner Modal */}
            <div className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-500 bg-cover bg-center ${showModal && activeTab === 'stage' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ backgroundImage: bgImage }} onClick={handleCloseModal}>
                <div className="absolute inset-0 bg-cover bg-center pointer-events-none mix-blend-screen" style={{ backgroundImage: "url('/particles.png')" }}></div>
                <div className={`relative z-10 p-8 max-w-4xl w-[90%] text-center transform transition-transform duration-500 ${showModal && activeTab === 'stage' ? 'scale-100' : 'scale-75'}`} onClick={e => e.stopPropagation()}>
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="text-2xl md:text-3xl font-bold text-white uppercase tracking-widest display-text animate-fade-down">
                            Xin chúc mừng
                        </div>
                        <FitText className="text-3xl md:text-5xl font-extrabold text-white uppercase display-text mb-2 animate-fade-down">
                            THÀNH VIÊN S-STUDENT
                        </FitText>

                        <FitText className="text-5xl md:text-7xl font-extrabold text-yellow-300 neon-text-gold uppercase leading-tight my-2">
                            {modalData.name}
                        </FitText>

                        <FitText className="text-4xl md:text-5xl font-bold text-white font-sans tracking-widest display-text">
                            {maskId ? maskIdentifier(modalData.id) : modalData.id}
                        </FitText>

                        <div className="flex justify-center gap-4 mt-8">
                            <button onClick={handleCloseModal} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full text-lg transition-colors flex items-center gap-2 backdrop-blur-md border border-red-500/40">
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
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const query = new URLSearchParams(window.location.search);
    const isProjector = query.get('projector') === 'true';
    const isAdmin = pathname === '/admin' || query.get('admin') === 'true';
    const isOffline = query.get('offline') === 'true';

    if (isProjector) {
        return <ProjectorView offline={isOffline} />;
    }

    if (isAdmin && !isOffline) {
        return <AdminPanel />;
    }

    return <ControlView offline={isOffline} />;
}
