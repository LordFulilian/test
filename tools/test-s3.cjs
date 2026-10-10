const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.7/resources/app.asar.unpacked/node_modules/typescript');
const root=path.resolve(__dirname,'..'),out=path.join(root,'temp/s3-tests');fs.mkdirSync(out,{recursive:true});
for(const n of ['BuildStage','Config','Clock','Garden','Orders','Chapter','DecorPreview','State','SnapshotStore','GameSession'])fs.writeFileSync(path.join(out,n+'.js'),ts.transpileModule(fs.readFileSync(path.join(root,`assets/scripts/core/${n}.ts`),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
const {GameSession}=require(path.join(out,'GameSession')),{checksum,SnapshotStore}=require(path.join(out,'SnapshotStore')),{validState,cloneState}=require(path.join(out,'State'));
const {settlePlot,pendingCount}=require(path.join(out,'Garden')),{InjectedTestClock,shanghaiDay}=require(path.join(out,'Clock'));
const records=[],routes=[],offline=[];const epoch=Date.UTC(2026,9,8);
class Storage{values=new Map();readFail=false;writeFail=false;late=false;getItem(k){if(this.readFail)throw Error('read');return this.values.get(k)??null;}setItem(k,v){if(this.writeFail)throw Error('quota');this.values.set(k,v);if(this.late)throw Error('late');}}
function test(name,fn){try{fn();records.push({name,passed:true});console.log('PASS '+name);}catch(e){records.push({name,passed:false,error:String(e)});console.error('FAIL '+name,e);process.exitCode=1;}}
function setup(preset='B_6x5',max=2){const storage=new Storage();let mono=0;const clock=new InjectedTestClock(epoch,()=>mono),profile=`s3-test-${preset}-core`;
    const open=(cap=max)=>new GameSession(storage,preset,'GUI',()=>mono,{story:true,profile,maxChapter:cap,clock});return {storage,clock,session:open(),open,tick:()=>mono+=350,preset};}
function verify(c){const s=c.session.state;assert.ok(validState(s,s.profileId));assert.deepEqual(c.open().state,s);}
function seed(c,fn){const s=c.session.state;fn(s);s.revision++;s.lastCommittedTxId='test-seed-'+s.revision;assert.equal(c.session.store.commit(s).kind,'ready');c.session.retry();verify(c);}
function fill(c,id){for(let i=0;i<400;i++){const goal=c.session.deficits(id).find(n=>n.count>0);if(!goal)return;const scent=goal.sku.slice(0,3),level=Number(goal.sku.slice(-1));assert.ok(c.session.select(scent).ok);
    const s=c.session.state,a=s.board.findIndex((a,i)=>a&&a.sku.startsWith(scent)&&Number(a.sku.slice(-1))<level&&s.board.some((b,j)=>i!==j&&b?.sku===a.sku));
    if(a>=0){const item=s.board[a],b=s.board.findIndex((b,j)=>j!==a&&b?.sku===item.sku);assert.ok(c.session.drop(a,b,item.id).ok);}
    else{c.tick();assert.ok(c.session.spawn().ok);}verify(c);}throw Error('could not fulfill');}
function deliver(c,id){fill(c,id);assert.ok(c.session.deliver(id).ok);verify(c);}
function chapter1(c){deliver(c,'T0');assert.ok(c.session.useDecor('lantern-osmanthus').ok);deliver(c,'C1a');deliver(c,c.session.state.orders[0].id);
    assert.ok(c.session.useDecor('curtain-celadon').ok);for(let i=0;i<3;i++)deliver(c,c.session.state.orders[0].id);assert.equal(c.session.state.coins,160);assert.equal(c.session.state.completedOrders,6);verify(c);}
function chapter2(c){chapter1(c);const before=c.session.state;assert.equal(before.chapter,2);assert.equal(before.carryoverShortOrder.id,'S-GUI-4');deliver(c,before.orders[0].id);deliver(c,'C2a');assert.ok(c.session.useDecor('counter-apricot').ok);deliver(c,'C2b');
    const points=[];for(let i=0;i<9;i++){const s=c.session.state,order=s.orders[i%2===0?1:0];deliver(c,order.id);points.push({id:order.id,coins:c.session.state.coins,orders:c.session.state.completedOrders});}
    assert.equal(c.session.state.completedOrders,18);assert.equal(c.session.state.coins,1100);assert.deepEqual(c.session.state.completedChapters,[1,2]);assert.equal(c.session.state.garden[1].storedCount,0);verify(c);return points;}
for(const preset of ['A_5x4','B_6x5']){
    test(`${preset}: new save -> both chapters without ads; S/M remain live`,()=>{const c=setup(preset),points=chapter2(c);routes.push({preset,coins:c.session.state.coins,orders:18,points});
        const prev=c.session.state.completedOrders;deliver(c,c.session.state.orders[0].id);assert.equal(c.session.state.completedOrders,prev+1);assert.deepEqual(c.session.state.completedChapters,[1,2]);assert.equal(c.session.select('JAS').ok,true);});
    test(`${preset}: C2a/C2b duplicate IDs and consignment cannot advance chapter`,()=>{const c=setup(preset);chapter1(c);deliver(c,'C2a');const done=c.session.state;assert.equal(c.session.deliver('C2a').code,'stale');assert.deepEqual(c.session.state,done);
        assert.equal(c.session.useDecor('counter-apricot').ok,true);deliver(c,'C2b');const paid=c.session.state;assert.equal(c.session.deliver('C2b').code,'stale');assert.deepEqual(c.session.state,paid);
        c.tick();c.session.spawn();const item=c.session.state.board.find(Boolean);c.session.sell(c.session.state.board.findIndex(i=>i?.id===item.id),item.id);assert.equal(c.session.state.completedOrders,paid.completedOrders);assert.deepEqual(c.session.state.completedChapters,[1]);});
    test(`${preset}: chapter-1 unfinished GUI_3 retained; new short index zero`,()=>{const c=setup(preset);deliver(c,'T0');c.session.useDecor('lantern-osmanthus');deliver(c,'C1a');for(let i=0;i<5;i++)deliver(c,c.session.state.orders[0].id);
        const order=c.session.state.orders[0];assert.equal(order.needs[0].sku,'GUI_3');c.session.useDecor('curtain-apricot');assert.deepEqual(c.session.state.orders[0],order);assert.equal(c.session.state.orderCycles.short,0);
        deliver(c,order.id);assert.equal(c.session.state.orders[0].id,'S-DUAL-0');assert.equal(c.session.state.orderCycles.short,0);verify(c);});
    test(`${preset}: legacy S2 upgrade preserves wallet/board/ownership/order and grants teaching once`,()=>{const c=setup(preset,1);chapter1(c);c.tick();c.session.spawn();const old=c.session.state;
        const upgraded=c.open(2);assert.equal(upgraded.state.chapter,2);assert.equal(upgraded.state.coins,old.coins);assert.deepEqual(upgraded.state.board,old.board);assert.equal(upgraded.state.nextEntityId,old.nextEntityId);
        assert.deepEqual(upgraded.state.activeDecorBySlot,old.activeDecorBySlot);assert.deepEqual(upgraded.state.ownedDecorIds,old.ownedDecorIds);assert.deepEqual(upgraded.state.orders[0],old.orders[0]);
        assert.equal(upgraded.state.garden[0].storedCount,2);assert.deepEqual(c.open(2).state,upgraded.state);assert.equal(c.open(1).blocked,true);});
    test(`${preset}: unavailable time stores unlock intent; first anchor grants two only once`,()=>{const c=setup(preset);c.clock.available=false;chapter1(c);const s=c.session.state;assert.equal(s.garden[0].initialized,false);assert.equal(s.garden[0].storedCount,0);
        assert.equal(c.session.harvest('GUI').code,'time');assert.equal(c.session.settleGarden().code,'time');c.tick();assert.ok(c.session.spawn().ok);
        c.clock.available=true;assert.ok(c.session.settleGarden().ok);assert.equal(c.session.state.garden[0].storedCount,2);const initialized=c.session.state;assert.ok(c.session.settleGarden().ok);assert.deepEqual(c.session.state,initialized);verify(c);});
    test(`${preset}: 20 waiting + 16 garden => 30 waiting + 6 garden, replay guarded`,()=>{const c=setup(preset);chapter1(c);c.clock.advance(8*3600000);c.session.settleGarden();c.session.receiveReward('existing','GUI_2',20);
        const r=c.session.harvest('GUI','one');assert.equal(r.quantity,10);assert.equal(pendingCount(c.session.state),30);assert.equal(c.session.state.garden[0].storedCount,6);
        const before=c.session.state;assert.equal(c.session.harvest('GUI','one').quantity,0);assert.deepEqual(c.session.state,before);verify(c);});
    test(`${preset}: 22 waiting + 8 reserved retains all garden stock`,()=>{const c=setup(preset);chapter1(c);c.clock.advance(8*3600000);c.session.settleGarden();c.session.receiveReward('existing','GUI_2',22);seed(c,s=>s.reservations=[{sourceId:'test-reserved-8',count:8}]);
        assert.equal(c.session.harvest('GUI','full').quantity,0);assert.equal(c.session.state.garden[0].storedCount,16);assert.equal(pendingCount(c.session.state),22);verify(c);});
    test(`${preset}: two plots 32 items respect shared 30 capacity`,()=>{const c=setup(preset);chapter2(c);c.clock.advance(8*3600000);c.session.settleGarden();assert.equal(c.session.harvest('GUI','g').quantity,16);assert.equal(c.session.harvest('JAS','j').quantity,14);
        assert.equal(pendingCount(c.session.state),30);assert.equal(c.session.state.garden[1].storedCount,2);verify(c);});
    test(`${preset}: FIFO partial receive; full board/repeated request preserve conservation`,()=>{const c=setup(preset);chapter1(c);c.session.receiveReward('first','GUI_2',12);c.session.receiveReward('second','JAS_4',8);
        seed(c,s=>{s.board=s.board.map((_,i)=>i<s.board.length-2?{id:s.nextEntityId++,sku:'GUI_1'}:null);});
        const coins=c.session.state.coins,orders=c.session.state.completedOrders;assert.equal(c.session.receivePending(null,'take-two').quantity,2);
        assert.deepEqual(c.session.state.board.slice(-2).map(i=>i.sku),['GUI_2','GUI_2']);assert.equal(c.session.state.pendingEntries[0].remainingCount,10);assert.equal(c.session.state.pendingEntries[1].remainingCount,8);
        const taken=c.session.state;assert.equal(c.session.receivePending(null,'take-two').quantity,0);assert.deepEqual(c.session.state,taken);assert.equal(c.session.receivePending(null,'another').code,'full');
        assert.equal(c.session.state.coins,coins);assert.equal(c.session.state.completedOrders,orders);assert.equal(c.session.state.album.includes('JAS_4'),false);
        c.session.sell(0,c.session.state.board[0].id);assert.equal(c.session.receivePending(c.session.state.pendingEntries[1].entryId,'one-high').quantity,1);assert.ok(c.session.state.album.includes('JAS_4'));verify(c);});
    test(`${preset}: source reward requires full capacity; duplicates and midnight never clear queue`,()=>{const c=setup(preset);chapter1(c);c.session.receiveReward('once','GUI_2',25);const before=c.session.state;
        assert.equal(c.session.receiveReward('once','GUI_2',25).quantity,0);assert.deepEqual(c.session.state,before);assert.equal(c.session.receiveReward('later','JAS_2',8).code,'full');assert.equal(c.session.state.claimedRewards.includes('reward:later'),false);
        c.clock.advance(25*3600000);c.session.settleGarden();assert.equal(pendingCount(c.session.state),25);verify(c);});
    for(const op of ['C2a','counter','C2b','settle','harvest','receive','upgrade'])for(const fault of ['before-write','during-write','after-write','before-feedback']){
        test(`${preset}: ${op} interruption ${fault}`,()=>{const c=setup(preset,op==='upgrade'?1:2);chapter1(c);
            let action;
            if(op==='C2a'){fill(c,'C2a');action=x=>x.session.deliver('C2a');}
            if(op==='counter'||op==='C2b'){deliver(c,'C2a');if(op==='counter')action=x=>x.session.useDecor('counter-apricot');else{c.session.useDecor('counter-apricot');fill(c,'C2b');action=x=>x.session.deliver('C2b');}}
            if(op==='settle'){c.clock.advance(30*60000);action=x=>x.session.settleGarden();}
            if(op==='harvest')action=x=>x.session.harvest('GUI','interrupted');
            if(op==='receive'){c.session.receiveReward('queue','JAS_2',4);action=x=>x.session.receivePending(null,'interrupted');}
            const before=c.session.state,source=new Map(c.storage.values),f=setup(preset,op==='upgrade'?1:2);f.storage.values=new Map(source);f.clock=c.clock;f.session=new GameSession(f.storage,preset,'GUI',()=>0,{story:true,profile:before.profileId,maxChapter:op==='upgrade'?1:2,clock:f.clock});
            f.session.store.fault=fault;
            if(op==='upgrade'){
                // Commit the same migration path under the selected store fault.
                const {upgradeStoryState}=require(path.join(out,'State'));const {reconcileChapter}=require(path.join(out,'Chapter'));const n=cloneState(before);upgradeStoryState(n);reconcileChapter(n,c.clock.now());n.revision++;n.lastCommittedTxId='upgrade-fixture';f.session.store.commit(n);
                const read=f.session.store.load();assert.equal(read.kind,'ready');assert.equal(read.state.contentMaxChapter,fault==='after-write'||fault==='before-feedback'?2:1);
                assert.equal(read.state.coins,before.coins);assert.deepEqual(read.state.board,before.board);return;
            }
            const result=action(f),wrote=fault==='after-write'||fault==='before-feedback';assert.equal(result.ok,wrote);
            const restored=new GameSession(f.storage,preset,'GUI',()=>0,{story:true,profile:before.profileId,maxChapter:2,clock:f.clock});assert.deepEqual(restored.state,f.session.state);
            if(!wrote)assert.deepEqual(restored.state,before);else {assert.ok(validState(restored.state,before.profileId));const stable=restored.state;
                if(op==='C2a'||op==='C2b'){assert.equal(restored.deliver(op).code,'stale');assert.deepEqual(restored.state,stable);}
                if(op==='counter'){assert.ok(restored.useDecor('counter-apricot').ok);assert.deepEqual(restored.state,stable);}
                if(op==='harvest'){assert.equal(restored.harvest('GUI','interrupted').quantity,0);assert.deepEqual(restored.state,stable);}
                if(op==='receive'){assert.equal(restored.receivePending(null,'interrupted').quantity,0);assert.deepEqual(restored.state,stable);}}
        });
    }
}
const minute=60000;
const cases=[
    ['empty 29m59s',0,0,1799000,0,1799000],['empty 30m',0,0,30*minute,1,0],['two +10m then25m',2,10*minute,25*minute,3,5*minute],
    ['empty offline8h',0,0,8*3600000,16,0],['empty offline25h',0,0,25*3600000,16,0],['15 +20m then20m',15,20*minute,20*minute,16,0],
    ['full then4h',16,0,4*3600000,16,0],['Shanghai23:50 to00:20',0,0,30*minute,1,0],['backwards time',2,10*minute,-minute,2,10*minute],
];
for(const [name,stock,carry,elapsed,result,remainder]of cases)test('offline: '+name,()=>{const last=Date.UTC(2026,9,8,15,50),p={id:'GUI',sku:'GUI_2',initialized:true,lastSettledAtMs:last,storedCount:stock,carryMs:carry};settlePlot(p,last+elapsed);
    assert.equal(p.storedCount,result);assert.equal(p.carryMs,remainder);assert.equal(p.lastSettledAtMs,elapsed<0?last:last+elapsed);offline.push({name,input:{stock,carry,elapsed},result:p});});
test('offline: 120 minute settlements equal one 2h settlement',()=>{const a={id:'GUI',sku:'GUI_2',initialized:true,lastSettledAtMs:epoch,storedCount:0,carryMs:0},b={...a};for(let m=1;m<=120;m++)settlePlot(a,epoch+m*minute);settlePlot(b,epoch+120*minute);assert.deepEqual(a,b);});
test('offline: cap skips excess; full storage never hides backlog after harvest',()=>{const c=setup();chapter1(c);c.clock.advance(25*3600000);c.session.settleGarden();c.session.harvest('GUI','all');assert.equal(c.session.state.garden[0].storedCount,0);c.session.settleGarden();assert.equal(c.session.state.garden[0].storedCount,0);c.clock.advance(29*minute);c.session.settleGarden();assert.equal(c.session.state.garden[0].storedCount,0);});
test('time: Shanghai day independent of device timezone',()=>{assert.equal(shanghaiDay(Date.UTC(2026,9,8,15,50)),'2026-10-08');assert.equal(shanghaiDay(Date.UTC(2026,9,8,16,20)),'2026-10-09');});
test('time: backwards clock keeps anchor, basic commerce remains available',()=>{const c=setup();chapter1(c);const before=c.session.state,last=before.garden[0].lastSettledAtMs;c.session.setGardenClock({kind:'injected-test',now:()=>last-1});assert.equal(c.session.settleGarden().code,'time');assert.deepEqual(c.session.state,before);c.tick();assert.ok(c.session.spawn().ok);assert.equal(c.session.state.garden[0].lastSettledAtMs,last);});
test('storage: mixed valid/future slot protected at load AND direct cached commit',()=>{for(const from of [1,2]){const c=setup('B_6x5',from),before=c.session.state,future={...before,schemaVersion:99};const raw=JSON.stringify({revision:before.revision+100,payload:future,checksum:checksum(JSON.stringify(future))});c.storage.setItem(c.session.store.key(1),raw);
    assert.equal(c.session.spawn().code,'blocked');assert.equal(c.storage.getItem(c.session.store.key(1)),raw);assert.equal(c.open().blocked,true);assert.equal(c.storage.getItem(c.session.store.key(1)),raw);}});
test('storage: unmigratable header retained; old cached revision cannot overwrite newer confirmed state',()=>{const c=setup(),old=c.session.state;c.tick();c.session.spawn();const latest=c.session.state;const result=c.session.store.commit(old);assert.equal(result.kind,'ready');assert.deepEqual(result.state,latest);
    const future={...latest,configVersion:'s2.1',contentMaxChapter:9},raw=JSON.stringify({revision:latest.revision,payload:future,checksum:checksum(JSON.stringify(future))});c.storage.setItem(c.session.store.key(0),raw);assert.equal(c.open().blocked,true);assert.equal(c.storage.getItem(c.session.store.key(0)),raw);});
test('migration: constructor quota failure pauses without replacing S2 bytes; retry upgrades once',()=>{const c=setup('B_6x5',1);chapter1(c);const before=c.session.state,raw=new Map(c.storage.values);c.storage.writeFail=true;
    const upgraded=c.open(2);assert.equal(upgraded.blocked,true);assert.equal(upgraded.state.coins,before.coins);assert.deepEqual(c.storage.values,raw);assert.equal(upgraded.spawn().code,'blocked');
    c.storage.writeFail=false;upgraded.retry();assert.equal(upgraded.blocked,false);assert.equal(upgraded.state.chapter,2);assert.equal(upgraded.state.garden[0].storedCount,2);assert.deepEqual(c.open(2).state,upgraded.state);});
test('invariants: over-capacity queue, duplicate pending IDs, missing teaching ledger rejected',()=>{const c=setup();chapter1(c);c.session.receiveReward('one','GUI_2',4);const s=c.session.state;
    const tooMany=cloneState(s);tooMany.pendingEntries[0].remainingCount=31;assert.equal(validState(tooMany,s.profileId),false);
    const duplicate=cloneState(s);duplicate.pendingEntries.push({...duplicate.pendingEntries[0]});assert.equal(validState(duplicate,s.profileId),false);
    const teaching=cloneState(s);teaching.claimedRewards=teaching.claimedRewards.filter(id=>id!=='garden:GUI:teaching');assert.equal(validState(teaching,s.profileId),false);});
fs.mkdirSync(path.join(root,'evidence/s3'),{recursive:true});fs.writeFileSync(path.join(root,'evidence/s3/core-tests.json'),JSON.stringify({kind:'S3 actual core tests; injected UTC/monotonic test clock, not live backend/device evidence',passed:records.filter(r=>r.passed).length,total:records.length,records,routes,offline},null,2));console.log(`${records.filter(r=>r.passed).length}/${records.length} S3 tests passed`);
