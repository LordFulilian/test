// Development-only S1 entry, enabled by ?s1soak=1. Uses actual Cocos scheduling,
// wall-clock duration and the engine local storage; this is not human touch acceptance.
import { PresetId, scentOf, TestChain, levelOf } from '../core/Config';
import { GameSession } from '../core/GameSession';
import { StoragePort } from '../core/SnapshotStore';
import { validState } from '../core/State';
export class SoakRun {
    private readonly sessions: GameSession[];
    private readonly startedAt: number;
    private ticks = 0;
    private finished = false;
    constructor(private readonly storage: StoragePort, private readonly now: () => number) {
        this.startedAt = now();
        this.sessions = (['A_5x4', 'B_6x5'] as PresetId[]).flatMap(p => (['GUI', 'DUAL'] as TestChain[]).map(c => new GameSession(storage, p, c, now)));
        console.log('S1_SOAK_STARTED', JSON.stringify({ durationMs: 600000, profiles: this.sessions.map(s => s.state?.profileId) }));
    }
    step(): { elapsedMs: number; orders: number; done: boolean } {
        const elapsedMs = this.now() - this.startedAt;
        if (this.finished) return { elapsedMs, orders: this.sessions.reduce((n, s) => n + (s.state?.completedOrders ?? 0), 0), done: true };
        this.ticks++;
        for (const session of this.sessions) {
            const state = session.state; if (!state || session.blocked) throw new Error('S1 soak storage blocked');
            if (session.deficits().every(n => n.count === 0)) {
                const result = session.deliver(state.orders[0].id); if (!result.ok) throw new Error(result.reason);
                if (session.state!.completedOrders % 10 === 0) {
                    const reload = new GameSession(this.storage, session.preset, session.chain, this.now);
                    if (JSON.stringify(reload.state) !== JSON.stringify(session.state)) throw new Error('S1 soak reload mismatch');
                }
            } else {
                const source = state.board.findIndex((a, i) => a && levelOf(a.sku) < 4 && state.board.some((b, j) => i !== j && b?.sku === a.sku));
                if (source >= 0) {
                    const a = state.board[source]!; const target = state.board.findIndex((b, j) => j !== source && b?.sku === a.sku);
                    const result = session.drop(source, target, a.id); if (!result.ok) throw new Error(result.reason);
                } else {
                    const deficit = session.deficits().find(n => n.count > 0)!; const selected = session.select(scentOf(deficit.sku));
                    if (!selected.ok) throw new Error(selected.reason);
                    const result = session.spawn(); if (!result.ok && result.code !== 'cooldown') throw new Error(result.reason);
                }
            }
            const next = session.state; if (!next || !validState(next, next.profileId)) throw new Error('S1 soak invariant failed');
        }
        const report = { elapsedMs, ticks: this.ticks, orders: this.sessions.reduce((n, s) => n + s.state!.completedOrders, 0),
            done: elapsedMs >= 600000, profiles: this.sessions.map(s => ({ id: s.state!.profileId, revision: s.state!.revision, orders: s.state!.completedOrders, coins: s.state!.coins })) };
        if (this.ticks % 150 === 0) console.log('S1_SOAK_PROGRESS', JSON.stringify(report));
        if (report.done) { this.finished = true; console.log('S1_SOAK_PASSED', JSON.stringify(report)); }
        return report;
    }
}
