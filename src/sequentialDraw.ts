export type DrawCandidate = { id: string; name: string };

export type SequentialDisplay = {
    count: number;
    revealed: DrawCandidate[];
    activeIndex: number | null;
    rollingId: string;
};

export const runSequentialDraw = ({ candidates, count, duration, onStart, onReveal }: {
    candidates: DrawCandidate[];
    count: number;
    duration: number;
    onStart: (remaining: DrawCandidate[], revealed: DrawCandidate[]) => void;
    onReveal: (revealed: DrawCandidate[], complete: boolean) => void;
}) => {
    if (count < 1 || count > candidates.length || !Number.isInteger(count)) {
        throw new Error('Invalid sequential draw count');
    }
    const remaining = [...candidates];
    const revealed: DrawCandidate[] = [];
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const startRow = () => {
        if (cancelled) return;
        onStart([...remaining], [...revealed]);
        timer = setTimeout(() => {
            if (cancelled) return;
            const index = Math.floor(Math.random() * remaining.length);
            revealed.push(remaining.splice(index, 1)[0]);
            const complete = revealed.length === count;
            onReveal([...revealed], complete);
            if (!complete && !cancelled) timer = setTimeout(startRow, 900);
        }, duration);
    };

    startRow();
    return () => {
        cancelled = true;
        clearTimeout(timer);
    };
};
