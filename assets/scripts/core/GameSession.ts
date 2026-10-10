import { CONFIG, isSku, levelOf, PresetId, profileId, Scent, scentOf, Sku, TestChain } from './Config';
import { cloneState, freshState, freshStoryState, makeOrder, State, upgradeStoryState } from './State';
import { DECOR, reconcileChapter, unlocked } from './Chapter';
import { SnapshotStore, StoragePort } from './SnapshotStore';
import { GardenClock } from './Clock';
import { appendPending, pendingFree, settlePlots } from './Garden';
export type Result = { ok: true; effect?: 'spawn' | 'merge' | 'move' | 'swap' | 'order' | 'sell' | 'select' | 'decor' | 'upgrade' | 'settle' | 'harvest' | 'receive' | 'reward'; target?: number; reward?: number; quantity?:number }
    | { ok: false; reason: string; code: 'blocked' | 'full' | 'cooldown' | 'cancel' | 'max' | 'stale' | 'missing' | 'save' | 'locked' | 'coins' | 'time' };
export class GameSession {
    /** Optional development observer; never supplies or changes business state. */
    onCommitted?: (before: Readonly<State>, after: Readonly<State>, result: Result) => void;
    private current: State | null = null;
    private stopped = false;
    private busy = false;
    private lastSpawnAt = -Infinity;
    private txSequence = 0;
    private gardenClock?:GardenClock;
    readonly store: SnapshotStore;
    message = '';
    constructor(storage: StoragePort, readonly preset: PresetId, readonly chain: TestChain, private readonly now: () => number,
        private readonly options: { story?: boolean; profile?: string; maxChapter?:1|2; clock?:GardenClock } = {}) {
        this.gardenClock=options.clock;
        this.store = new SnapshotStore(storage, options.story ? options.profile ?? `main-v1-${preset}` : profileId(preset, chain)); this.retry();
    }
    get state(): Readonly<State> | null { return this.current ? cloneState(this.current) : null; }
    get blocked(): boolean { return this.stopped || !this.current; }
    retry(): void {
        const result = this.store.load();
        if (result.kind === 'empty') {
            const initial = this.store.commit(this.options.story ? freshStoryState(this.preset, this.store.profile,this.options.maxChapter??1) : freshState(this.preset, this.chain));
            if (initial.kind === 'ready') { this.current = initial.state; this.stopped = false; this.message = ''; }
            else { this.stopped = true; this.message = initial.kind === 'blocked' ? initial.message : '初始化存档失败，请重试。'; }
        } else if (result.kind === 'ready') { this.current = result.state; this.stopped = false; this.message = result.warning ?? ''; }
        else { this.stopped = true; this.message = result.message; }
        if(!this.blocked && this.current?.mode==='story'){
            if((this.options.maxChapter??1)<(this.current.contentMaxChapter??1)){this.stopped=true;this.message='此存档已升级，请使用S3入口；不会降级覆盖。';return;}
            if(this.options.maxChapter===2&&this.current.contentMaxChapter===1){const upgrade=this.transact(s=>{upgradeStoryState(s);return {ok:true,effect:'upgrade'};});
                if(!upgrade.ok){this.stopped=true;this.message='升级尚未确认，旧存档已保留，请重试读取。';}}
        }
    }
    private transact(change: (next: State) => Result): Result {
        if (this.blocked || this.busy || !this.current) return { ok: false, code: 'blocked', reason: this.message || '正在确认存档，请稍后重试。' };
        this.busy = true;
        try {
            const next = cloneState(this.current); const result = change(next);
            if (!result.ok) return result;
            reconcileChapter(next,this.gardenNow());
            if(JSON.stringify(next)===JSON.stringify(this.current))return result;
            next.revision++; next.lastCommittedTxId = `${next.profileId}:${next.revision}:${++this.txSequence}`;
            const saved = this.store.commit(next);
            if (saved.kind !== 'ready') {
                this.stopped = true; this.message = saved.kind === 'blocked' ? saved.message : '未确认写入结果，请重试。';
                return { ok: false, code: 'blocked', reason: this.message };
            }
            const before = this.current;
            this.current = saved.state;
            if (saved.state.lastCommittedTxId !== next.lastCommittedTxId) return { ok: false, code: 'save', reason: '本次操作未保存，已恢复上一完整状态。可重新操作。' };
            this.message = saved.warning ?? '';
            if (this.onCommitted) {
                try { this.onCommitted(cloneState(before), cloneState(saved.state), result); }
                catch (error) { console.warn('Development observation failed; business snapshot remains confirmed.', error); }
            }
            return result;
        } finally { this.busy = false; }
    }
    select(scent: Scent): Result {
        if (this.blocked) return { ok: false, code: 'blocked', reason: this.message || '存档未确认，请重试读取。' };
        if (scent === 'JAS' && (this.options.story ? this.current?.chapter!==2 : this.chain !== 'DUAL')) return { ok: false, code: 'missing', reason: this.options.story ? '第一章只制作桂花香。' : '茉莉仅在独立双香型测试档开放。' };
        if (this.current?.selectedScent === scent) return { ok: true, effect: 'select' };
        return this.transact(s => { s.selectedScent = scent; return { ok: true, effect: 'select' }; });
    }
    spawn(): Result {
        if(this.blocked)return {ok:false,code:'blocked',reason:this.message||'请先确认存档。'};
        const now = this.now();
        // Full board never starts a cooldown, even when a recent successful click exists.
        if (this.current && !this.current.board.includes(null)) return { ok: false, code: 'full', reason: '棋盘满了：合成、交单，或免费整理一件物品。' };
        if (now - this.lastSpawnAt < CONFIG.spawnIntervalMs) return { ok: false, code: 'cooldown', reason: '稍等一下，每次成功出货间隔350毫秒。' };
        const result = this.transact(s => {
            const index = s.board.indexOf(null); if (index < 0) return { ok: false, code: 'full', reason: '棋盘满了，请整理。' };
            const sku = `${s.selectedScent}_1` as Sku; s.board[index] = { id: s.nextEntityId++, sku };
            if (!s.album.includes(sku)) s.album.push(sku);
            return { ok: true, effect: 'spawn', target: index };
        });
        if (result.ok) this.lastSpawnAt = now;
        return result;
    }
    drop(source: number, target: number, expectedId: number): Result {
        return this.transact(s => {
            if (!Number.isInteger(source) || !Number.isInteger(target) || source < 0 || target < 0 || source >= s.board.length || target >= s.board.length || source === target)
                return { ok: false, code: 'cancel', reason: '已回到原位。' };
            const a = s.board[source], b = s.board[target];
            if (!a || a.id !== expectedId) return { ok: false, code: 'stale', reason: '物品已变化，请重新选择。' };
            if (!b) { s.board[target] = a; s.board[source] = null; return { ok: true, effect: 'move', target }; }
            if (a.sku === b.sku) {
                if (levelOf(a.sku) === 4) return { ok: false, code: 'max', reason: '礼匣已满级，无法继续合成。' };
                const sku = `${scentOf(a.sku)}_${levelOf(a.sku) + 1}` as Sku;
                s.board[target] = { id: s.nextEntityId++, sku }; s.board[source] = null;
                if (!s.album.includes(sku)) s.album.push(sku);
                return { ok: true, effect: 'merge', target };
            }
            s.board[source] = b; s.board[target] = a; return { ok: true, effect: 'swap', target };
        });
    }
    deficits(orderId?: string): { sku: Sku; count: number }[] {
        if (!this.current) return [];
        const order = orderId ? this.current.orders.find(o => o.id === orderId) : this.current.orders[0];
        if (!order) return [];
        return order.needs.map(n => ({ sku: n.sku,
            count: Math.max(0, n.count - this.current!.board.filter(item => item?.sku === n.sku).length) }));
    }
    deliver(expectedOrderId: string): Result {
        if (this.blocked) return { ok: false, code: 'blocked', reason: this.message || '存档未确认，请重试读取。' };
        if (!this.current?.orders.some(o => o.id === expectedOrderId)) return { ok: false, code: 'stale', reason: '这张订单已交付。' };
        const missing = this.deficits(expectedOrderId).filter(n => n.count > 0);
        if (missing.length) {
            const selected = this.select(scentOf(missing[0].sku));
            if (!selected.ok) return selected;
            return { ok: false, code: 'missing', reason: missing.map(n => `${n.sku}缺${n.count}件`).join('，') };
        }
        return this.transact(s => {
            const order = s.orders.find(o => o.id === expectedOrderId); if (!order) return { ok: false, code: 'stale', reason: '这张订单已交付。' };
            for (const need of order.needs) {
                const indices = s.board.map((v, i) => v?.sku === need.sku ? i : -1).filter(i => i >= 0);
                if (indices.length < need.count) return { ok: false, code: 'missing', reason: '商品数量不足。' };
                indices.slice(0, need.count).forEach(i => { s.board[i] = null; });
            }
            s.coins += order.reward; s.completedOrders++;
            if (s.mode === 'story') {
                if (order.id === 'T0') s.tutorialNodes.push('T0');
                else if (order.id === 'C1a') s.permanentNodes.push('C1a');
                else if(order.id==='C2a'||order.id==='C2b')s.permanentNodes.push(order.id);
                else if(order.id.startsWith('M-'))s.orderCycles.medium++;
                else if(s.chapter===2&&s.carryoverShortOrder?.id===order.id){s.carryoverShortOrder=null;s.carryoverShortCompleted=true;}
                else s.orderCycles.short++;
            } else { s.orderCycles.short++; s.orders = [makeOrder(s.testChain, s.orderCycles.short)]; }
            return { ok: true, effect: 'order', reward: order.reward };
        });
    }
    setGardenClock(clock:GardenClock|undefined):void {this.gardenClock=clock;}
    private gardenNow():number|null {const n=this.gardenClock?.now();return n!==null&&n!==undefined&&Number.isSafeInteger(n)&&n>=0?n:null;}
    settleGarden():Result {
        const now=this.gardenNow();if(now===null)return {ok:false,code:'time',reason:'联网后结算花园；现有棋盘和装扮仍可经营。'};
        if(!this.current?.garden.length)return {ok:false,code:'locked',reason:'完成第一章后开放桂花花园。'};
        if(this.current.garden.some(p=>p.lastSettledAtMs!==null&&now<p.lastSettledAtMs))return {ok:false,code:'time',reason:'时间锚点异常，未新增产出；基础经营仍可继续。'};
        return this.transact(s=>{settlePlots(s,now);return {ok:true,effect:'settle'};});
    }
    harvest(plotId:Scent,requestId?:string):Result {
        const now=this.gardenNow();if(now===null)return {ok:false,code:'time',reason:'联网后结算花园；本次收获未执行。'};
        const receipt=`harvest:${plotId}:${requestId??`${this.store.profile}:${(this.current?.revision??0)+1}`}`;
        if(this.current?.claimedRewards.includes(receipt))return {ok:true,effect:'harvest',quantity:0};
        if(this.current?.garden.some(p=>p.lastSettledAtMs!==null&&now<p.lastSettledAtMs))return {ok:false,code:'time',reason:'时间倒退，库存与结算锚点保持不变。'};
        return this.transact(s=>{const plot=s.garden.find(p=>p.id===plotId);if(!plot)return {ok:false,code:'locked',reason:'这个地块还未开放。'};
            settlePlots(s,now);const n=Math.min(plot.storedCount,pendingFree(s));
            if(n>0){appendPending(s,plot.sku,n,receipt);plot.storedCount-=n;s.claimedRewards.push(receipt);}
            return {ok:true,effect:'harvest',quantity:n};});
    }
    receivePending(entryId:string|null,requestId?:string):Result {
        const receipt=`receive:${requestId??`${this.store.profile}:${(this.current?.revision??0)+1}`}`;
        if(this.current?.claimedRewards.includes(receipt))return {ok:true,effect:'receive',quantity:0};
        return this.transact(s=>{
            if(entryId!==null&&!s.pendingEntries.some(e=>e.entryId===entryId))return {ok:false,code:'stale',reason:'该条目已经领取。'};
            let room=s.board.filter(v=>v===null).length;if(room===0)return {ok:false,code:'full',reason:'棋盘已满，待领物品会保留；先合成、交单或整理。'};
            let received=0;const limit=entryId===null?room:1;
            for(const entry of s.pendingEntries){if(entryId!==null&&entry.entryId!==entryId)continue;
                const n=Math.min(entry.remainingCount,room,limit-received);
                for(let i=0;i<n;i++){s.board[s.board.indexOf(null)]={id:s.nextEntityId++,sku:entry.sku};if(!s.album.includes(entry.sku))s.album.push(entry.sku);}
                entry.remainingCount-=n;room-=n;received+=n;if(received===limit||room===0)break;}
            if(received){s.pendingEntries=s.pendingEntries.filter(e=>e.remainingCount>0);s.claimedRewards.push(receipt);}
            return {ok:true,effect:'receive',quantity:received};
        });
    }
    // Core ingress for future verified reward adapters. No ads/platform callback is simulated here.
    receiveReward(sourceId:string,sku:Sku,count:number):Result {
        const receipt=`reward:${sourceId}`;
        if(this.current?.claimedRewards.includes(receipt))return {ok:true,effect:'reward',quantity:0};
        return this.transact(s=>{if(s.contentMaxChapter!==2||s.chapter!==2||!sourceId||!isSku(sku)||!Number.isSafeInteger(count)||count<1)return {ok:false,code:'missing',reason:'来源或奖励内容无效。'};
            if(count>pendingFree(s))return {ok:false,code:'full',reason:'待领取空间不足，奖励尚未领取。'};
            appendPending(s,sku,count,receipt);s.claimedRewards.push(receipt);return {ok:true,effect:'reward',quantity:count};});
    }
    useDecor(id: string): Result {
        if (this.blocked) return { ok: false, code: 'blocked', reason: this.message || '存档未确认，请重试。' };
        const decor = DECOR.find(d => d.id === id);
        if (!decor || !this.options.story) return { ok: false, code: 'locked', reason: '当前档位不支持这件装扮。' };
        if (this.current?.activeDecorBySlot[decor.slot] === id) return { ok: true, effect: 'decor' };
        return this.transact(s => {
            if (!unlocked(s, decor)) return { ok: false, code: 'locked', reason: decor.condition };
            if (!s.ownedDecorIds.includes(id)) {
                if (s.coins < decor.cost) return { ok: false, code: 'coins', reason: `还差${decor.cost - s.coins}铜钱，继续接单即可攒够。` };
                s.coins -= decor.cost; s.ownedDecorIds.push(id);
            }
            s.activeDecorBySlot[decor.slot] = id; return { ok: true, effect: 'decor' };
        });
    }
    sell(index: number, expectedId: number): Result {
        return this.transact(s => {
            const item = s.board[index]; if (!item || item.id !== expectedId) return { ok: false, code: 'stale', reason: '物品已变化，请重新选择。' };
            const reward = CONFIG.sell[levelOf(item.sku)]; s.board[index] = null; s.coins += reward;
            return { ok: true, effect: 'sell', reward };
        });
    }
    mergeableIndices(): number[] {
        if (!this.current) return [];
        return this.current.board.map((a, i, board) => a && levelOf(a.sku) < 4 && board.some((b, j) => j !== i && b?.sku === a.sku) ? i : -1).filter(i => i >= 0);
    }
}
