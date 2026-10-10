import type { State } from '../core/State';
import type { Result } from '../core/GameSession';
export type Scenario = 'chapter1' | 'chapter2' | 'pressure';
export type DragReview = 'intended' | 'unexpected' | 'probe';
export interface TestIdentity {
    participant: string; order: 'AB' | 'BA'; scenario: Scenario; round: string;
    environment: 'browser' | 'device'; platform: 'Android' | 'iOS' | 'desktop'; model: string; os: string; host: string;
}
export interface Sample { ms: number; revision: number; empty: number; occupied: number }
export interface DragSample { id: number; ms: number; source: number; target: number; outcome: string; review: DragReview | null }
export function percentile(values: number[], fraction: number): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((a,b)=>a-b); return sorted[Math.max(0,Math.ceil(sorted.length*fraction)-1)];
}
/** Local research data only. A completed browser run can never become a device result. */
export class S4Metrics {
    readonly samples: Sample[] = [];
    readonly drags: DragSample[] = [];
    readonly events: {ms:number;type:string;detail:string}[] = [];
    readonly frameBins = new Array<number>(201).fill(0);
    private accumulated = 0;
    private resumedAt: number | null = null;
    private ended = false;
    private seenRevision = -1;
    private fullSignature = '';
    private initialOrders = 0;
    private orders = 0;
    private cleaning = 0;
    private full = 0;
    private baselineNodes: string[] = [];
    private milestones: Record<string,number> = {};
    constructor(readonly identity: TestIdentity, readonly preset: string, readonly profile: string, private readonly now:()=>number) {}
    get elapsedMs():number { return Math.min(600000,this.accumulated+(this.resumedAt===null?0:Math.max(0,this.now()-this.resumedAt))); }
    get active():boolean { return this.resumedAt!==null&&!this.ended&&this.elapsedMs<600000; }
    get finished():boolean { return this.ended; }
    start(state: Readonly<State>):void {
        if(this.ended||this.resumedAt!==null)return;
        if(!this.samples.length){this.initialOrders=state.completedOrders;this.baselineNodes=[...state.permanentNodes];this.sample(state);}
        this.resumedAt=this.now();
    }
    pause():void { if(this.resumedAt!==null){this.accumulated=this.elapsedMs;this.resumedAt=null;} }
    finish():void {this.pause();this.ended=true;}
    private sample(state: Readonly<State>):void {
        if(state.revision===this.seenRevision)return;
        this.seenRevision=state.revision;
        const empty=state.board.filter(i=>i===null).length;
        this.samples.push({ms:this.elapsedMs,revision:state.revision,empty,occupied:(state.board.length-empty)/state.board.length});
        if(empty)this.fullSignature='';
    }
    transaction(before:Readonly<State>,after:Readonly<State>,result:Result):void {
        if(!this.active)return;
        this.sample(after);
        this.orders+=after.completedOrders-before.completedOrders;
        if(result.ok&&result.effect==='sell'&&this.identity.scenario!=='pressure')this.cleaning++;
        for(const node of after.permanentNodes)if(!this.baselineNodes.includes(node)&&this.milestones[node]===undefined)this.milestones[node]=this.elapsedMs;
        this.events.push({ms:this.elapsedMs,type:'transaction',detail:result.ok?result.effect??'change':result.code});
    }
    blocked(state: Readonly<State>,result:Result):void {
        if(!this.active||result.ok||result.code!=='full'||!result.reason.startsWith('棋盘')||state.board.includes(null))return;
        const signature=state.board.map(i=>`${i?.id}:${i?.sku}`).join(',');
        if(signature===this.fullSignature)return;
        this.fullSignature=signature;this.full++;this.events.push({ms:this.elapsedMs,type:'full',detail:signature});
    }
    drag(source:number,target:number,result:Result|null,cancelled:boolean):void {
        if(!this.active)return;
        this.drags.push({id:this.drags.length+1,ms:this.elapsedMs,source,target,outcome:cancelled?'cancelled':result?.ok?result.effect??'none':result?.code??'none',review:null});
    }
    review(id:number,value:DragReview):void {const d=this.drags.find(d=>d.id===id);if(!d)throw Error('Drag ID does not exist');d.review=value;}
    frame(ms:number):void {if(this.active&&Number.isFinite(ms)&&ms>0)this.frameBins[Math.min(200,Math.ceil(ms))]++;}
    report():object {
        const unreviewed=this.drags.filter(d=>d.review===null).length,probes=this.drags.filter(d=>d.review==='probe').length;
        const denominator=this.drags.length-probes,unexpected=this.drags.filter(d=>d.review==='unexpected').length;
        const frames=this.frameBins.reduce((a,b)=>a+b,0);let p95:number|null=null,total=0;
        for(let i=0;i<this.frameBins.length;i++){total+=this.frameBins[i];if(frames&&total>=Math.ceil(frames*.95)){p95=i;break;}}
        return {schema:'s4-research-1',identity:this.identity,preset:this.preset,profile:this.profile,
            effectiveMs:this.elapsedMs,finished:this.ended,completeTenMinutes:this.ended&&this.elapsedMs>=600000,
            baselineOrders:this.initialOrders,orders:this.orders,fullEvents:this.full,cleaning:this.cleaning,
            occupiedP95:percentile(this.samples.map(s=>s.occupied),.95),dragCount:this.drags.length,probes,unreviewed,
            misdragRate:unreviewed||!denominator?null:unexpected/denominator,milestones:this.milestones,
            frameCount:frames,frameP95Ms:p95,frameP95Capped:p95===200,longFrames:this.frameBins.slice(51).reduce((a,b)=>a+b,0),
            samples:this.samples,drags:this.drags,events:this.events};
    }
}
