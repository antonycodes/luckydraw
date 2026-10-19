import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSequentialDraw, type DrawCandidate } from '../src/sequentialDraw';

const candidates = [
    { id: '01', name: 'Người một' },
    { id: '02', name: 'Người hai' },
    { id: '03', name: 'Người ba' },
];

test('reveals one winner per duration and excludes prior winners', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const starts: Array<{ remaining: DrawCandidate[]; revealed: DrawCandidate[] }> = [];
    const reveals: Array<{ revealed: DrawCandidate[]; complete: boolean }> = [];
    runSequentialDraw({
        candidates, count: 3, duration: 3000,
        onStart: (remaining, revealed) => starts.push({ remaining, revealed }),
        onReveal: (revealed, complete) => reveals.push({ revealed, complete }),
    });
    assert.equal(starts.length, 1);
    t.mock.timers.tick(2999);
    assert.equal(reveals.length, 0);
    t.mock.timers.tick(1);
    assert.equal(reveals[0].revealed.length, 1);
    assert.equal(reveals[0].complete, false);
    t.mock.timers.tick(899);
    assert.equal(starts.length, 1);
    t.mock.timers.tick(1);
    assert.equal(starts.length, 2);
    assert.equal(starts[1].remaining.includes(reveals[0].revealed[0]), false);
    t.mock.timers.tick(3000);
    t.mock.timers.tick(900);
    t.mock.timers.tick(3000);
    assert.equal(reveals.length, 3);
    assert.equal(reveals[2].complete, true);
    assert.equal(new Set(reveals[2].revealed.map(winner => winner.id)).size, 3);
    assert.equal(reveals[0].revealed.length, 1);
    assert.equal(candidates.length, 3);
    t.mock.timers.tick(10000);
    assert.equal(starts.length, 3);
});

for (const cancelAfter of [1000, 3000]) {
    test(`cancellation at ${cancelAfter}ms stops further rows`, t => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        let starts = 0;
        let reveals = 0;
        const cancel = runSequentialDraw({
            candidates, count: 3, duration: 3000,
            onStart: () => starts++, onReveal: () => reveals++,
        });
        t.mock.timers.tick(cancelAfter);
        cancel();
        t.mock.timers.tick(20000);
        assert.equal(starts, 1);
        assert.equal(reveals, cancelAfter === 3000 ? 1 : 0);
    });
}

test('rejects insufficient candidates before starting', () => {
    assert.throws(() => runSequentialDraw({
        candidates, count: 4, duration: 3000,
        onStart: () => assert.fail('must not start'), onReveal: () => {},
    }), /Invalid sequential draw count/);
});
