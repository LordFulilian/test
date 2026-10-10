import type { State } from './State';
import type { Scent, Sku } from './Config';
export interface PendingEntry { entryId: string; sku: Sku; remainingCount: number; sourceId: string; createdSequence: number }
export interface Reservation { sourceId: string; count: number }
export interface GardenPlot { id: Scent; sku: 'GUI_2' | 'JAS_2'; initialized: boolean; lastSettledAtMs: number | null; carryMs: number; storedCount: number }
export const GARDEN = { intervalMs:1800000, offlineCapMs:28800000, storageCap:16, pendingCap:30 };
export function pendingCount(s: State): number { return s.pendingEntries.reduce((n,e)=>n+e.remainingCount,0); }
export function pendingFree(s: State): number { return GARDEN.pendingCap-pendingCount(s)-s.reservations.reduce((n,r)=>n+r.count,0); }
export function newPlot(id: Scent): GardenPlot { return {id,sku:id==='GUI'?'GUI_2':'JAS_2',initialized:false,lastSettledAtMs:null,carryMs:0,storedCount:0}; }
export function initializePlots(s: State, now: number | null | undefined): void {
    if(now===null || now===undefined)return;
    for(const p of s.garden)if(!p.initialized){p.initialized=true;p.lastSettledAtMs=now;p.storedCount=p.id==='GUI'?2:0;
        if(p.id==='GUI'&&!s.claimedRewards.includes('garden:GUI:teaching'))s.claimedRewards.push('garden:GUI:teaching');}
}
export function settlePlot(p: GardenPlot, now: number): boolean {
    if(!p.initialized || p.lastSettledAtMs===null || now<p.lastSettledAtMs)return false;
    const elapsed=Math.min(now-p.lastSettledAtMs,GARDEN.offlineCapMs);
    if(p.storedCount===GARDEN.storageCap)p.carryMs=0;
    else {const total=p.carryMs+elapsed;p.storedCount+=Math.min(Math.floor(total/GARDEN.intervalMs),GARDEN.storageCap-p.storedCount);
        p.carryMs=p.storedCount===GARDEN.storageCap?0:total%GARDEN.intervalMs;}
    p.lastSettledAtMs=now;return true;
}
export function settlePlots(s: State, now: number): boolean { initializePlots(s,now);let normal=true;for(const p of s.garden)if(!settlePlot(p,now))normal=false;return normal; }
export function appendPending(s: State, sku: Sku, count: number, sourceId: string): void {
    const sequence=s.nextEntityId++;s.pendingEntries.push({entryId:`pending-${sequence}`,sku,remainingCount:count,sourceId,createdSequence:sequence});
}
