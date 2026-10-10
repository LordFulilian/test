import { cloneState, State, validState, knownPayloadFormat } from './State';
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type FaultPoint = 'before-write' | 'during-write' | 'after-write' | 'before-feedback';
export type LoadResult = { kind: 'ready'; state: State; warning?: string } | { kind: 'empty' } | { kind: 'blocked'; message: string };
interface Snapshot { revision: number; payload: State; checksum: string }
export function checksum(s: string): string {
    let hash = 2166136261;
    for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
}
export class SnapshotStore {
    fault: FaultPoint | null = null;
    constructor(private readonly storage: StoragePort, readonly profile: string) {}
    key(slot: number): string { return `perfume-ballad:${this.profile}:slot${slot}`; }
    private protectedRaw(raw:string|null):boolean {
        if(raw===null)return false;
        try {const snapshot=JSON.parse(raw) as Partial<Snapshot>;
            return !knownPayloadFormat(snapshot?.payload) || snapshot.payload?.profileId!==this.profile || !validState(snapshot.payload,this.profile);
        } catch {return false;} // A truncated known write can recover from the other valid slot.
    }
    private decode(raw: string | null): State | null {
        if (raw === null) return null;
        try {
            const s = JSON.parse(raw) as Partial<Snapshot>;
            if (!validState(s.payload, this.profile) || s.revision !== s.payload.revision || s.checksum !== checksum(JSON.stringify(s.payload))) return null;
            return s.payload;
        } catch { return null; }
    }
    load(): LoadResult {
        try {
            const raw = [this.storage.getItem(this.key(0)), this.storage.getItem(this.key(1))];
            if(raw.some(v=>this.protectedRaw(v)))return {kind:'blocked',message:'存档槽包含未知格式或其他档位数据，原始内容已保留。请使用兼容版本或检查存档，不会覆盖。'};
            const states = raw.map(v => this.decode(v));
            const valid = states.filter((v): v is State => v !== null).sort((a, b) => b.revision - a.revision);
            if (valid.length === 2 && valid[0].revision === valid[1].revision && JSON.stringify(valid[0]) !== JSON.stringify(valid[1]))
                return { kind: 'blocked', message: '两个快照版本冲突，已保留原始数据。请重试或检查存档。' };
            if (valid.length) return { kind: 'ready', state: cloneState(valid[0]),
                warning: raw.some((v, i) => v !== null && states[i] === null) ? '已从有效快照恢复；另一槽损坏，原始数据已保留。' : undefined };
            if (raw.every(v => v === null)) return { kind: 'empty' };
            return { kind: 'blocked', message: '没有有效快照，原始数据已保留。S1尚未接云备份；请重试读取。' };
        } catch { return { kind: 'blocked', message: '无法读取存档，经营已暂停。请重试；不会覆盖原数据。' }; }
    }
    commit(candidate: State): LoadResult {
        if (!validState(candidate, this.profile)) throw new Error('Candidate violates state invariants');
        const fault = this.fault; this.fault = null;
        try {
            const raw=[this.storage.getItem(this.key(0)),this.storage.getItem(this.key(1))];
            if(raw.some(v=>this.protectedRaw(v)))return {kind:'blocked',message:'检测到未知存档格式，原始槽已保护，经营暂停。'};
            const a=this.decode(raw[0]),b=this.decode(raw[1]);
            const latest=Math.max(a?.revision??-1,b?.revision??-1);
            if(latest>=candidate.revision)return this.load();
            const slot = !a ? 0 : !b ? 1 : a.revision <= b.revision ? 0 : 1;
            const snapshot: Snapshot = { revision: candidate.revision, payload: candidate, checksum: checksum(JSON.stringify(candidate)) };
            const text = JSON.stringify(snapshot);
            if (fault === 'before-write') throw new Error('Injected interruption before write');
            this.storage.setItem(this.key(slot), fault === 'during-write' ? text.slice(0, Math.floor(text.length / 2)) : text);
            if (fault === 'during-write' || fault === 'after-write') throw new Error('Injected interruption');
            const readback = this.decode(this.storage.getItem(this.key(slot)));
            if (!readback || JSON.stringify(readback) !== JSON.stringify(candidate)) throw new Error('Readback failed');
            if (fault === 'before-feedback') throw new Error('Injected interruption before UI');
            return { kind: 'ready', state: cloneState(readback) };
        } catch {
            // The write may have succeeded before the exception. Re-read both complete slots.
            const restored = this.load();
            if (restored.kind === 'ready') return restored;
            return { kind: 'blocked', message: '写入结果无法确认，经营已暂停。请重试读取，原数据保留。' };
        }
    }
}
