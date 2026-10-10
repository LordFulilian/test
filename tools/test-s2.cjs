const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.7/resources/app.asar.unpacked/node_modules/typescript');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'temp/s2-tests'); fs.mkdirSync(out, {recursive:true});
for (const name of ['BuildStage','Clock','Garden','Orders','Chapter','DecorPreview','Config','State','SnapshotStore','GameSession']) {
    fs.writeFileSync(path.join(out,name+'.js'),ts.transpileModule(fs.readFileSync(path.join(root,`assets/scripts/core/${name}.ts`),'utf8'),
        {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true}}).outputText);
}
const {GameSession}=require(path.join(out,'GameSession'));
const {DecorPreview}=require(path.join(out,'DecorPreview'));
const {validState}=require(path.join(out,'State'));
const {checksum}=require(path.join(out,'SnapshotStore'));
class Storage { values=new Map(); readFail=false; writeFail=false; late=false;
    getItem(k){if(this.readFail)throw Error('read');return this.values.get(k)??null;}
    setItem(k,v){if(this.writeFail)throw Error('quota');this.values.set(k,v);if(this.late)throw Error('late ack');}
}
const records=[], routes=[];
function test(name,fn){try{fn();records.push({name,passed:true});console.log('PASS '+name);}catch(e){records.push({name,passed:false,error:String(e)});console.error('FAIL '+name,e);process.exitCode=1;}}
function setup(preset='B_6x5'){const storage=new Storage();let t=0;const profile=`s2-test-${preset}-core`;
    const open=()=>new GameSession(storage,preset,'GUI',()=>t,{story:true,profile});
    return {storage,session:open(),open,tick:()=>t+=350};}
function check(ctx){const s=ctx.session.state;assert.ok(validState(s,s.profileId));assert.deepEqual(ctx.open().state,s);}
function fill(ctx,id){for(let i=0;i<160;i++){
    const goal=ctx.session.deficits(id).find(n=>n.count>0);if(!goal)return;
    const state=ctx.session.state, level=Number(goal.sku.slice(-1));
    const a=state.board.findIndex((a,i)=>a&&Number(a.sku.slice(-1))<level&&state.board.some((b,j)=>j!==i&&b?.sku===a.sku));
    if(a>=0){const item=state.board[a],b=state.board.findIndex((b,j)=>j!==a&&b?.sku===item.sku);assert.ok(ctx.session.drop(a,b,item.id).ok);}
    else{ctx.tick();assert.ok(ctx.session.spawn().ok);}check(ctx);
}throw Error('unable to fulfill');}
function deliver(ctx,id){fill(ctx,id);assert.ok(ctx.session.deliver(id).ok);check(ctx);}
function t0(ctx){deliver(ctx,'T0');assert.equal(ctx.session.state.coins,40);assert.equal(ctx.session.state.orders.length,0);}
function light(ctx){t0(ctx);assert.ok(ctx.session.useDecor('lantern-osmanthus').ok);check(ctx);}
function unlockedCurtain(ctx){light(ctx);deliver(ctx,'C1a');deliver(ctx,ctx.session.state.orders[0].id);assert.equal(ctx.session.state.coins,140);}
for(const preset of ['A_5x4','B_6x5']){
    test(`${preset}: true new save and tutorial restrictions`,()=>{const c=setup(preset),s=c.session.state;
        assert.equal(s.coins,0);assert.equal(s.completedOrders,0);assert.equal(s.orders[0].id,'T0');assert.equal(s.orders[0].reward,40);
        assert.equal(s.board.filter(Boolean).length,2);assert.deepEqual(s.album,['GUI_1']);assert.equal(c.session.select('JAS').ok,false);
        assert.equal(c.session.useDecor('lantern-osmanthus').code,'locked');assert.equal(c.session.useDecor('curtain-celadon').code,'locked');check(c);});
    test(`${preset}: six-order free chapter route, exactly 160 coins`,()=>{const c=setup(preset),points=[];
        const record=label=>points.push({label,coins:c.session.state.coins,orders:c.session.state.completedOrders,nodes:c.session.state.permanentNodes});
        t0(c);record('T0 +40');c.session.useDecor('lantern-osmanthus');record('lantern -40');
        deliver(c,'C1a');record('C1a +120');deliver(c,c.session.state.orders[0].id);record('S0 +20');
        assert.ok(c.session.useDecor('curtain-celadon').ok);record('curtain -120');
        for(const label of ['S1 +50','S2 +40','S3 +50']){deliver(c,c.session.state.orders[0].id);record(label);}
        assert.equal(c.session.state.coins,160);assert.equal(c.session.state.completedOrders,6);
        assert.deepEqual(c.session.state.completedChapters,[1]);assert.equal(c.session.state.chapter,1);assert.equal(c.session.state.contentMaxChapter,1);
        assert.equal(c.session.state.orders[0].id,'S-GUI-4');check(c);routes.push({preset,points});
        const coins=c.session.state.coins;c.session.useDecor('lantern-default');c.session.useDecor('curtain-default');
        assert.equal(c.session.state.coins,coins);assert.deepEqual(c.session.state.completedChapters,[1]);
        deliver(c,c.session.state.orders[0].id);assert.equal(c.session.state.coins,180);});
    test(`${preset}: late decorating completes without another order`,()=>{const c=setup(preset);unlockedCurtain(c);
        for(let i=0;i<3;i++)deliver(c,c.session.state.orders[0].id);assert.equal(c.session.state.completedOrders,6);assert.deepEqual(c.session.state.completedChapters,[]);
        c.session.useDecor('curtain-apricot');assert.deepEqual(c.session.state.completedChapters,[1]);assert.equal(c.session.state.completedOrders,6);check(c);});
    test(`${preset}: preview locked/unowned, cancel, slot switch, reopen, hide`,()=>{const c=setup(preset),p=new DecorPreview(),before=c.session.state;
        assert.ok(p.select('curtain-celadon'));assert.equal(p.displayed('CURTAIN',before),'curtain-celadon');assert.equal(p.displayed('LANTERN',before),'lantern-default');
        p.select('lantern-celadon');assert.equal(p.displayed('CURTAIN',before),'curtain-default');p.cancel();assert.equal(p.id,null);
        assert.deepEqual(c.session.state,before);assert.deepEqual(c.open().state,before);
        assert.equal(new DecorPreview().displayed('LANTERN',c.open().state),'lantern-default');});
    test(`${preset}: ownership, free switching, idempotency and permanent nodes`,()=>{const c=setup(preset);light(c);
        const s=c.session.state;assert.ok(c.session.useDecor('lantern-osmanthus').ok);assert.deepEqual(c.session.state,s);
        assert.equal(c.session.useDecor('lantern-celadon').code,'coins');assert.deepEqual(c.session.state,s);
        for(let i=0;i<2;i++)deliver(c,c.session.state.orders[0].id);
        assert.ok(c.session.useDecor('lantern-celadon').ok);const paid=c.session.state.coins;
        c.session.useDecor('lantern-default');c.session.useDecor('lantern-osmanthus');c.session.useDecor('lantern-celadon');
        assert.equal(c.session.state.coins,paid);assert.equal(c.session.state.ownedDecorIds.filter(id=>id==='lantern-celadon').length,1);assert.ok(c.session.state.permanentNodes.includes('1B'));check(c);});
    test(`${preset}: chapters cannot be completed by consignment`,()=>{const c=setup(preset);light(c);
        const s=c.session.state;assert.ok(c.session.spawn().ok);c.session.sell(0,c.session.state.board[0].id);
        assert.equal(c.session.state.completedOrders,s.completedOrders);assert.deepEqual(c.session.state.completedChapters,[]);check(c);});
    test(`${preset}: chapter order exact SKU, stable IDs and duplicate guard`,()=>{const c=setup(preset);light(c);fill(c,'C1a');
        const before=c.session.state;assert.equal(c.session.deliver('wrong').code,'stale');assert.deepEqual(c.session.state,before);
        c.session.deliver('C1a');const after=c.session.state;assert.equal(c.session.deliver('C1a').code,'stale');assert.deepEqual(c.session.state,after);
        assert.equal(after.coins,120);assert.equal(after.completedOrders,2);assert.equal(after.orders.length,1);check(c);});
    for(const transaction of ['T0','C1a','lantern','curtain','switch','completion']) for(const fault of ['before-write','during-write','after-write','before-feedback']){
        test(`${preset}: ${transaction} interrupted ${fault}`,()=>{const c=setup(preset);let action;
            if(transaction==='T0'){fill(c,'T0');action=()=>c.session.deliver('T0');}
            if(transaction==='C1a'){light(c);fill(c,'C1a');action=()=>c.session.deliver('C1a');}
            if(transaction==='lantern'){t0(c);action=()=>c.session.useDecor('lantern-osmanthus');}
            if(transaction==='curtain'){unlockedCurtain(c);action=()=>c.session.useDecor('curtain-apricot');}
            if(transaction==='switch'){light(c);action=()=>c.session.useDecor('lantern-default');}
            if(transaction==='completion'){unlockedCurtain(c);c.session.useDecor('curtain-celadon');for(let i=0;i<2;i++)deliver(c,c.session.state.orders[0].id);
                const id=c.session.state.orders[0].id;fill(c,id);action=()=>c.session.deliver(id);}
            const before=c.session.state;const normal=action();assert.ok(normal.ok);const expected=c.session.state;
            // Restore the complete pre-transaction snapshot in an independent fault fixture.
            const f=setup(preset);f.storage.values.clear();f.storage.setItem(f.session.store.key(0),JSON.stringify({revision:before.revision,payload:before,checksum:checksum(JSON.stringify(before))}));f.session=f.open();f.session.store.fault=fault;
            const invoke=transaction==='T0'||transaction==='C1a'||transaction==='completion'?()=>f.session.deliver(before.orders.find(o=>transaction==='C1a'?o.id==='C1a':transaction==='T0'?o.id==='T0':o.id.startsWith('S-')).id):
                ()=>f.session.useDecor(transaction==='switch'?'lantern-default':transaction==='lantern'?'lantern-osmanthus':'curtain-apricot');
            const result=invoke();const wrote=fault==='after-write'||fault==='before-feedback';assert.equal(result.ok,wrote);
            const restored=f.open().state;
            if(wrote){assert.equal(restored.coins,expected.coins);assert.deepEqual(restored.board,expected.board);assert.deepEqual(restored.activeDecorBySlot,expected.activeDecorBySlot);
                assert.deepEqual(restored.completedChapters,expected.completedChapters);assert.equal(restored.completedOrders,expected.completedOrders);assert.deepEqual(restored.orders,expected.orders);}
            else assert.deepEqual(restored,before);check(f);
        });
    }
}
test('quota/read failures suspend; late acknowledgement never charges twice',()=>{const c=setup();t0(c);const before=c.session.state;
    c.storage.writeFail=true;assert.equal(c.session.useDecor('lantern-osmanthus').ok,false);assert.deepEqual(c.session.state,before);
    c.storage.writeFail=false;c.storage.late=true;assert.ok(c.session.useDecor('lantern-osmanthus').ok);assert.equal(c.session.state.coins,0);
    c.storage.late=false;const paid=c.session.state;c.session.useDecor('lantern-osmanthus');assert.deepEqual(c.session.state,paid);
    c.storage.readFail=true;assert.equal(c.session.useDecor('lantern-default').code,'blocked');assert.equal(c.session.spawn().code,'blocked');
    c.storage.readFail=false;c.session.retry();check(c);});
test('unknown/malformed story saves stay preserved; S1 test namespace isolated',()=>{const c=setup(),state=c.session.state;state.configVersion='future';
    const raw=JSON.stringify({revision:state.revision,payload:state,checksum:checksum(JSON.stringify(state))});c.storage.values.clear();c.storage.setItem(c.session.store.key(0),raw);
    assert.equal(c.open().blocked,true);assert.equal(c.storage.getItem(c.session.store.key(0)),raw);
    const core=new GameSession(c.storage,'B_6x5','GUI',()=>0);assert.equal(core.state.orders[0].reward,20);assert.equal(c.storage.getItem(c.session.store.key(0)),raw);});
fs.mkdirSync(path.join(root,'evidence/s2'),{recursive:true});
fs.writeFileSync(path.join(root,'evidence/s2/core-tests.json'),JSON.stringify({kind:'S2 core transaction tests; no physical-device claims',passed:records.filter(r=>r.passed).length,total:records.length,records,routes},null,2));
console.log(`${records.filter(r=>r.passed).length}/${records.length} S2 tests passed`);
