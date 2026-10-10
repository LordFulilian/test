import { CONFIG, isSku, PresetId, profileId, Scent, Sku, TestChain } from './Config';
import { DECOR, hasNode, reconcileChapter, STORY_VERSION, S3_VERSION, storyOrders, unlocked } from './Chapter';
import { makeOrder, Order } from './Orders';
import { GardenPlot, PendingEntry, Reservation, GARDEN, pendingFree } from './Garden';
export { makeOrder } from './Orders';

export interface Item { id: number; sku: Sku }
export interface State {
    mode?: 'story'; contentMaxChapter?: 1 | 2;
    chapterOneShortCompleted?: number; carryoverShortOrder?: Order | null; carryoverShortCompleted?: boolean;
    schemaVersion: number; configVersion: string; profileId: string; revision: number;
    nextEntityId: number; lastCommittedTxId: string; coins: number; boardPreset: PresetId;
    testChain: TestChain; board: (Item | null)[]; selectedScent: Scent;
    orders: Order[]; orderCycles: { short: number; medium: number }; chapter: number;
    completedChapters: number[]; permanentNodes: string[]; completedOrders: number;
    ownedDecorIds: string[]; activeDecorBySlot: { LANTERN: string; CURTAIN: string; COUNTER: string };
    pendingEntries: PendingEntry[]; reservations: Reservation[]; garden: GardenPlot[]; claimedRewards: string[];
    tutorialNodes: string[]; album: Sku[]; adState: null;
}
export function freshState(preset: PresetId, chain: TestChain): State {
    const { rows, cols } = CONFIG.presets[preset];
    const board: (Item | null)[] = Array.from({ length: rows * cols }, () => null);
    board[0] = { id: 1, sku: 'GUI_1' }; board[1] = { id: 2, sku: 'GUI_1' };
    return { schemaVersion: 1, configVersion: CONFIG.version, profileId: profileId(preset, chain),
        revision: 0, nextEntityId: 3, lastCommittedTxId: 'initial', coins: 0, boardPreset: preset,
        testChain: chain, board, selectedScent: 'GUI', orders: [makeOrder(chain, 0)],
        orderCycles: { short: 0, medium: 0 }, chapter: 1, completedChapters: [], permanentNodes: [],
        completedOrders: 0, ownedDecorIds: ['lantern-default', 'curtain-default', 'counter-default'],
        activeDecorBySlot: { LANTERN: 'lantern-default', CURTAIN: 'curtain-default', COUNTER: 'counter-default' },
        pendingEntries: [], reservations: [], garden: [], claimedRewards: [], tutorialNodes: [],
        album: ['GUI_1'], adState: null };
}
export function cloneState(state: State): State { return JSON.parse(JSON.stringify(state)) as State; }
export function freshStoryState(preset: PresetId, profile: string, max:1|2=1): State {
    const s = freshState(preset, 'GUI'); s.mode = 'story'; s.configVersion = STORY_VERSION;
    s.profileId = profile; s.contentMaxChapter = 1; s.orders = storyOrders(s);if(max===2)upgradeStoryState(s);return s;
}
export function upgradeStoryState(s:State):void {s.contentMaxChapter=2;s.configVersion=S3_VERSION;s.chapterOneShortCompleted=0;s.carryoverShortOrder=null;s.carryoverShortCompleted=false;}
export function knownPayloadFormat(v:unknown):boolean {if(!object(v))return false;
    return v.schemaVersion===1 && (v.mode==='story' ? v.configVersion===STORY_VERSION&&v.contentMaxChapter===1 || v.configVersion===S3_VERSION&&v.contentMaxChapter===2 : v.mode===undefined && v.configVersion===CONFIG.version);}
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
function object(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null; }
export function validState(v: unknown, expectedProfile: string): v is State {
    if (object(v) && v.mode === 'story') return validStoryState(v, expectedProfile);
    if (!object(v) || v.schemaVersion !== 1 || v.configVersion !== CONFIG.version || v.profileId !== expectedProfile ||
        (v.boardPreset !== 'A_5x4' && v.boardPreset !== 'B_6x5') || (v.testChain !== 'GUI' && v.testChain !== 'DUAL')) return false;
    if (profileId(v.boardPreset, v.testChain) !== expectedProfile || !integer(v.revision) || !integer(v.nextEntityId) ||
        !integer(v.coins) || !integer(v.completedOrders) || typeof v.lastCommittedTxId !== 'string') return false;
    const size = CONFIG.presets[v.boardPreset].cols * CONFIG.presets[v.boardPreset].rows;
    if (!Array.isArray(v.board) || v.board.length !== size || v.nextEntityId < 1) return false;
    const ids = new Set<number>();
    for (const item of v.board) {
        if (item === null) continue;
        if (!object(item) || !integer(item.id) || item.id === 0 || item.id >= v.nextEntityId || ids.has(item.id) || !isSku(item.sku)) return false;
        if (v.testChain === 'GUI' && item.sku.startsWith('JAS')) return false;
        ids.add(item.id);
    }
    if (v.selectedScent !== 'GUI' && (v.selectedScent !== 'JAS' || v.testChain !== 'DUAL')) return false;
    if (!object(v.orderCycles) || !integer(v.orderCycles.short) || v.orderCycles.short !== v.completedOrders || v.orderCycles.medium !== 0) return false;
    if (!Array.isArray(v.orders) || v.orders.length !== 1 || JSON.stringify(v.orders[0]) !== JSON.stringify(makeOrder(v.testChain, v.orderCycles.short))) return false;
    if (v.chapter !== 1 || !Array.isArray(v.completedChapters) || v.completedChapters.length !== 0) return false;
    for (const key of ['permanentNodes', 'ownedDecorIds', 'claimedRewards', 'tutorialNodes']) if (!strings(v[key])) return false;
    if (!object(v.activeDecorBySlot) || !strings(v.ownedDecorIds)) return false;
    for (const slot of ['LANTERN', 'CURTAIN', 'COUNTER']) if (typeof v.activeDecorBySlot[slot] !== 'string' || !v.ownedDecorIds.includes(v.activeDecorBySlot[slot] as string)) return false;
    for (const key of ['pendingEntries', 'reservations', 'garden']) if (!Array.isArray(v[key]) || (v[key] as unknown[]).length !== 0) return false;
    return Array.isArray(v.album) && v.album.every(isSku) && new Set(v.album).size === v.album.length && v.adState === null;
}

function validStoryState(v: Record<string, unknown>, expectedProfile: string): boolean {
    const advanced=v.configVersion===S3_VERSION && v.contentMaxChapter===2;
    if (v.schemaVersion !== 1 || (!advanced && (v.configVersion!==STORY_VERSION || v.contentMaxChapter!==1)) || v.profileId !== expectedProfile ||
        !/^(main-v1|s2-test|s3-test|s4-test)-[AB]_[56]x[45](?:-[a-zA-Z0-9_-]+)?$/.test(expectedProfile) ||
        (v.boardPreset !== 'A_5x4' && v.boardPreset !== 'B_6x5') || !expectedProfile.includes(`-${v.boardPreset}`) ||
        v.testChain !== 'GUI' || (v.chapter!==1 && (!advanced || v.chapter!==2)) || (v.selectedScent!=='GUI' && (v.chapter!==2 || v.selectedScent!=='JAS')) || !integer(v.revision) || !integer(v.nextEntityId) ||
        !integer(v.coins) || !integer(v.completedOrders) || typeof v.lastCommittedTxId !== 'string' || v.nextEntityId < 1) return false;
    const size = CONFIG.presets[v.boardPreset].cols * CONFIG.presets[v.boardPreset].rows;
    if (!Array.isArray(v.board) || v.board.length !== size) return false;
    const ids = new Set<number>();
    for (const item of v.board) {
        if (item === null) continue;
        if (!object(item) || !integer(item.id) || item.id === 0 || item.id >= v.nextEntityId || ids.has(item.id) || !isSku(item.sku) || (v.chapter===1&&!item.sku.startsWith('GUI'))) return false;
        ids.add(item.id);
    }
    for (const key of ['permanentNodes', 'ownedDecorIds', 'claimedRewards', 'tutorialNodes']) if (!strings(v[key]) || new Set(v[key] as string[]).size !== (v[key] as string[]).length) return false;
    const allowed=['1A','1B','C1a','1C','curtain-used','1D',...advanced?['2A','C2a','2B','2C','C2b','2D']:[]];
    if (!(v.permanentNodes as string[]).every(n=>allowed.includes(n)) || !(v.tutorialNodes as string[]).every(n=>n==='T0') || (!advanced&&(v.claimedRewards as string[]).length!==0))return false;
    if (!object(v.activeDecorBySlot) || !strings(v.ownedDecorIds) || !v.ownedDecorIds.every(id => DECOR.some(d => d.id === id))) return false;
    const s = v as unknown as State;
    for (const slot of ['LANTERN', 'CURTAIN', 'COUNTER'] as const) {
        const d = DECOR.find(d => d.id === s.activeDecorBySlot[slot]);
        if (!d || d.slot !== slot || !s.ownedDecorIds.includes(d.id) || !s.ownedDecorIds.includes(`${slot.toLowerCase()}-default`)) return false;
    }
    for (const d of DECOR) if (s.ownedDecorIds.includes(d.id) && !unlocked(s, d)) return false;
    if (!object(v.orderCycles) || !integer(v.orderCycles.short) || !integer(v.orderCycles.medium) || (v.chapter===1&&v.orderCycles.medium!==0))return false;
    let counted=s.orderCycles.short+(s.tutorialNodes.includes('T0')?1:0)+(hasNode(s,'C1a')?1:0);
    if(advanced){
        if(!integer(s.chapterOneShortCompleted)||typeof s.carryoverShortCompleted!=='boolean')return false;
        if(s.chapter===1){if(s.chapterOneShortCompleted!==0||s.carryoverShortOrder!==null||s.carryoverShortCompleted)return false;}
        else {if(s.chapterOneShortCompleted<4 || JSON.stringify(s.carryoverShortOrder)!==JSON.stringify(s.carryoverShortCompleted?null:makeOrder('GUI',s.chapterOneShortCompleted)))return false;
            counted+=s.chapterOneShortCompleted+(s.carryoverShortCompleted?1:0)+s.orderCycles.medium+(hasNode(s,'C2a')?1:0)+(hasNode(s,'C2b')?1:0);}
    }
    if(s.completedOrders!==counted)return false;
    if (hasNode(s, '1A') !== s.tutorialNodes.includes('T0') ||
        hasNode(s, '1B') !== s.ownedDecorIds.some(id => id.startsWith('lantern-') && id !== 'lantern-default') ||
        hasNode(s, 'C1a') && !hasNode(s, '1B') ||
        hasNode(s, '1C') !== (hasNode(s, 'C1a') && s.completedOrders >= 3) ||
        hasNode(s, 'curtain-used') !== s.ownedDecorIds.some(id => id.startsWith('curtain-') && id !== 'curtain-default') ||
        hasNode(s, '1D') !== (hasNode(s, 'C1a') && s.completedOrders >= 6 && hasNode(s, 'curtain-used'))) return false;
    if(!Array.isArray(s.completedChapters)||JSON.stringify(s.completedChapters)!==JSON.stringify([...(hasNode(s,'1D')?[1]:[]),...(hasNode(s,'2D')?[2]:[])]))return false;
    if(advanced && (hasNode(s,'2A')!==hasNode(s,'1D') || (s.chapter===2)!==hasNode(s,'2A') || hasNode(s,'2B')!==hasNode(s,'C2a') ||
        hasNode(s,'2C')!==s.ownedDecorIds.some(id=>id.startsWith('counter-')&&id!=='counter-default') ||
        hasNode(s,'C2a')&&!hasNode(s,'2A') || hasNode(s,'C2b')&&!hasNode(s,'2C') ||
        hasNode(s,'2D')!==(hasNode(s,'C2b')&&hasNode(s,'2C')&&s.completedOrders>=18)))return false;
    if (!Array.isArray(v.orders) || JSON.stringify(s.orders) !== JSON.stringify(storyOrders(s))) return false;
    const reconciled = cloneState(s); reconcileChapter(reconciled);
    if (JSON.stringify(reconciled) !== JSON.stringify(s)) return false;
    if(advanced){if(!validGardenInventory(s,ids))return false;}else for(const key of ['pendingEntries','reservations','garden'])if(!Array.isArray(v[key])||(v[key] as unknown[]).length!==0)return false;
    return Array.isArray(s.album) && s.album.every(sku=>isSku(sku)&&(s.chapter===2||sku.startsWith('GUI'))) && new Set(s.album).size===s.album.length && s.adState===null;
}

function validGardenInventory(s:State,used:Set<number>):boolean {
    if(!Array.isArray(s.pendingEntries)||!Array.isArray(s.reservations)||!Array.isArray(s.garden))return false;
    let sequence=-1;const sources=new Set<string>();
    for(const e of s.pendingEntries){if(!object(e)||typeof e.entryId!=='string'||!integer(e.createdSequence)||e.createdSequence<=sequence||e.createdSequence>=s.nextEntityId||used.has(e.createdSequence)||e.entryId!==`pending-${e.createdSequence}`||
        !isSku(e.sku)||s.chapter===1||!integer(e.remainingCount)||e.remainingCount<1||typeof e.sourceId!=='string'||!e.sourceId||sources.has(e.sourceId)||!s.claimedRewards.includes(e.sourceId))return false;
        sequence=e.createdSequence;used.add(e.createdSequence);sources.add(e.sourceId);}
    const reserved=new Set<string>();for(const r of s.reservations)if(!object(r)||typeof r.sourceId!=='string'||!r.sourceId||reserved.has(r.sourceId)||!integer(r.count)||r.count<1)return false;else reserved.add(r.sourceId);
    if(pendingFree(s)<0)return false;
    const expected=hasNode(s,'2A')?['GUI',...hasNode(s,'2D')?['JAS']:[]]:[];
    if(s.garden.length!==expected.length)return false;
    for(let i=0;i<s.garden.length;i++){const p=s.garden[i];if(!object(p)||p.id!==expected[i]||p.sku!==`${p.id}_2`||typeof p.initialized!=='boolean'||!integer(p.storedCount)||p.storedCount>16||!integer(p.carryMs)||p.carryMs>=GARDEN.intervalMs)return false;
        if(p.initialized){if(!integer(p.lastSettledAtMs)||(p.storedCount===16&&p.carryMs!==0))return false;if(p.id==='GUI'&&!s.claimedRewards.includes('garden:GUI:teaching'))return false;}
        else if(p.lastSettledAtMs!==null||p.storedCount!==0||p.carryMs!==0)return false;}
    return true;
}
