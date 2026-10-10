const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.7/resources/app.asar.unpacked/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'temp/s1-tests'); fs.mkdirSync(out, { recursive: true });
for (const name of ['BuildStage', 'Clock', 'Garden', 'Orders', 'Chapter', 'Config', 'State', 'SnapshotStore', 'GameSession']) {
    const source = fs.readFileSync(path.join(root, `assets/scripts/core/${name}.ts`), 'utf8');
    fs.writeFileSync(path.join(out, name + '.js'), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true } }).outputText);
}
const { GameSession } = require(path.join(out, 'GameSession'));
const { SnapshotStore } = require(path.join(out, 'SnapshotStore'));
const { freshState, makeOrder, validState } = require(path.join(out, 'State'));
const { CONFIG } = require(path.join(out, 'Config'));
class MemoryStorage {
    values = new Map(); failRead = false; failWrite = false; throwAfterWrite = false;
    getItem(k) { if (this.failRead) throw Error('Read unavailable'); return this.values.get(k) ?? null; }
    setItem(k, v) { if (this.failWrite) throw Error('Quota'); this.values.set(k, v); if (this.throwAfterWrite) throw Error('Write acknowledged late'); }
}
let passed = 0; const records = [];
function test(name, fn) { try { fn(); passed++; records.push({ name, passed: true }); console.log(`PASS ${name}`); } catch (e) { console.error(`FAIL ${name}`, e); records.push({ name, passed: false }); process.exitCode = 1; } }
function setup(preset = 'B_6x5', chain = 'DUAL') { const storage = new MemoryStorage(); let clock = 0; const session = new GameSession(storage, preset, chain, () => clock); return { storage, session, tick: (ms = 350) => { clock += ms; }, reload: () => new GameSession(storage, preset, chain, () => clock) }; }
function seed(ctx, skus) {
    const state = JSON.parse(JSON.stringify(ctx.session.state)); state.revision++; state.lastCommittedTxId = 'test-seed-' + state.revision;
    state.board = Array.from({ length: state.board.length }, (_, i) => skus[i] ? { id: state.nextEntityId++, sku: skus[i] } : null);
    assert.equal(ctx.session.store.commit(state).kind, 'ready'); ctx.session.retry();
}
for (const preset of ['A_5x4', 'B_6x5']) {
    test(`${preset}: deterministic spawn / row-major / 350ms / immediate restart`, () => {
        const ctx = setup(preset); assert.equal(ctx.session.spawn().target, 2); assert.equal(ctx.session.spawn().code, 'cooldown');
        ctx.tick(349); assert.equal(ctx.session.spawn().code, 'cooldown'); ctx.tick(1); assert.equal(ctx.session.spawn().target, 3);
        assert.equal(ctx.reload().spawn().ok, true); assert.equal(ctx.session.state.coins, 0);
    });
    test(`${preset}: move / merge / swap / max / off-board / stale entity`, () => {
        const ctx = setup(preset); let state = ctx.session.state;
        assert.equal(ctx.session.drop(0, 1, state.board[0].id).effect, 'merge'); assert.equal(ctx.session.state.board[1].sku, 'GUI_2');
        assert.equal(ctx.session.drop(1, 5, ctx.session.state.board[1].id).effect, 'move');
        seed(ctx, ['GUI_2', 'JAS_2']); state = ctx.session.state;
        assert.equal(ctx.session.drop(0, 1, state.board[0].id).effect, 'swap'); assert.equal(ctx.session.state.board[0].sku, 'JAS_2');
        const before = ctx.session.state; assert.equal(ctx.session.drop(0, -1, before.board[0].id).code, 'cancel'); assert.deepEqual(ctx.session.state, before);
        assert.equal(ctx.session.drop(0, 1, 99999).code, 'stale');
        seed(ctx, ['GUI_4', 'GUI_4']); state = ctx.session.state; assert.equal(ctx.session.drop(0, 1, state.board[0].id).code, 'max'); assert.deepEqual(ctx.session.state, state);
    });
    test(`${preset}: full board free exit / no cooldown consumed / full highlights`, () => {
        const ctx = setup(preset); seed(ctx, Array(ctx.session.state.board.length).fill('GUI_1'));
        const before = ctx.session.state; assert.equal(ctx.session.spawn().code, 'full'); assert.deepEqual(ctx.session.state, before);
        assert.equal(ctx.session.mergeableIndices().length, before.board.length);
        assert.equal(ctx.session.sell(0, before.board[0].id).reward, 0); assert.equal(ctx.session.spawn().ok, true);
    });
    test(`${preset}: S cycle and row-major exact SKU consumption`, () => {
        const ctx = setup(preset);
        for (let round = 0; round < 10; round++) {
            const order = ctx.session.state.orders[0]; const needs = order.needs.flatMap(n => Array(n.count).fill(n.sku));
            seed(ctx, [...needs, ...needs, 'GUI_4']); const before = ctx.session.state;
            assert.equal(ctx.session.deliver(order.id).ok, true); const after = ctx.session.state;
            assert.equal(after.coins, before.coins + order.reward); assert.equal(after.completedOrders, round + 1);
            assert.ok(after.board.slice(0, needs.length).every(x => x === null)); assert.ok(after.board[needs.length]);
            assert.notEqual(after.orders[0].id, order.id); assert.equal(ctx.session.deliver(order.id).ok, false);
            assert.deepEqual(ctx.reload().state, ctx.session.state);
        }
    });
    test(`${preset}: missing order selects scent / cannot split higher SKU`, () => {
        const ctx = setup(preset); seed(ctx, ['GUI_4']); const before = ctx.session.state;
        assert.equal(ctx.session.deliver(before.orders[0].id).code, 'missing'); assert.equal(ctx.session.state.coins, 0); assert.equal(ctx.session.state.board[0].sku, 'GUI_4');
    });
    test(`${preset}: all sale prices / duplicate confirmation / no order credit`, () => {
        const ctx = setup(preset); seed(ctx, ['GUI_1', 'GUI_2', 'GUI_3', 'GUI_4']); const state = ctx.session.state;
        [0, 5, 12, 30].forEach((reward, i) => { assert.equal(ctx.session.sell(i, state.board[i].id).reward, reward); assert.equal(ctx.session.sell(i, state.board[i].id).ok, false); });
        assert.equal(ctx.session.state.coins, 47); assert.equal(ctx.session.state.completedOrders, 0);
    });
    for (const fault of ['before-write', 'during-write', 'after-write', 'before-feedback']) {
        for (const action of ['spawn', 'merge', 'move', 'swap', 'sell', 'order']) {
            test(`${preset}: ${action} interruption at ${fault} restores a whole transaction`, () => {
                const ctx = setup(preset); seed(ctx, ['GUI_2', 'GUI_2', 'JAS_1']);
                const before = ctx.session.state; ctx.session.store.fault = fault;
                const item = before.board[0];
                const result = action === 'spawn' ? ctx.session.spawn() : action === 'merge' ? ctx.session.drop(0, 1, item.id) :
                    action === 'move' ? ctx.session.drop(0, 5, item.id) : action === 'swap' ? ctx.session.drop(0, 2, item.id) :
                    action === 'sell' ? ctx.session.sell(0, item.id) : ctx.session.deliver(before.orders[0].id);
                const after = ctx.reload().state;
                assert.deepEqual(after, ctx.session.state);
                if (fault === 'before-write' || fault === 'during-write') { assert.equal(result.ok, false); assert.deepEqual(after, before); }
                else { assert.equal(result.ok, true); assert.equal(after.revision, before.revision + 1);
                    if (action === 'order') { assert.equal(after.coins, before.coins + 20); assert.equal(after.completedOrders, before.completedOrders + 1); } }
                assert.equal(validState(after, after.profileId), true);
            });
        }
    }
}
test('profiles: A/B and single/dual remain isolated without truncation', () => {
    const storage = new MemoryStorage(); const sessions = ['A_5x4', 'B_6x5'].flatMap(p => ['GUI', 'DUAL'].map(c => new GameSession(storage, p, c, () => 0)));
    sessions.forEach(s => { assert.equal(s.spawn().ok, true); });
    assert.equal(storage.values.size, 8);
    assert.equal(sessions[0].select('JAS').ok, false); assert.equal(sessions[1].select('JAS').ok, true);
    assert.equal(sessions[1].state.board.length, 20); assert.equal(sessions[3].state.board.length, 30);
    assert.equal(CONFIG.productionBoardPreset, null);
});
test('storage: quota failure keeps prior state; late write acknowledgement never double pays', () => {
    const ctx = setup(); seed(ctx, ['GUI_2']); const before = ctx.session.state;
    ctx.storage.failWrite = true; assert.equal(ctx.session.deliver(before.orders[0].id).ok, false); assert.deepEqual(ctx.reload().state, before);
    ctx.storage.failWrite = false; ctx.storage.throwAfterWrite = true; assert.equal(ctx.session.deliver(before.orders[0].id).ok, true);
    assert.equal(ctx.reload().state.coins, 20); assert.equal(ctx.reload().state.completedOrders, 1);
});
test('storage: unreadable results block new commands and retry restores', () => {
    const ctx = setup(); const before = ctx.session.state; ctx.storage.failRead = true;
    assert.equal(ctx.session.spawn().code, 'blocked'); assert.equal(ctx.session.spawn().code, 'blocked'); assert.deepEqual(ctx.session.state, before);
    ctx.storage.failRead = false; ctx.session.retry(); assert.equal(ctx.session.blocked, false); assert.deepEqual(ctx.session.state, before);
});
test('storage: corrupt / checksum mismatch / unknown schema retained without overwriting', () => {
    const ctx = setup(); ctx.session.spawn(); const keys = [...ctx.storage.values.keys()];
    ctx.storage.values.set(keys[1], 'truncated'); assert.equal(ctx.reload().state.revision, 0);
    ctx.storage.values.set(keys[0], '{"schemaVersion":999}'); const raw = [...ctx.storage.values];
    const restored = ctx.reload(); assert.equal(restored.blocked, true); assert.equal(restored.spawn().ok, false); assert.deepEqual([...ctx.storage.values], raw);
    const mismatch = setup(); const key = [...mismatch.storage.values.keys()][0]; const snap = JSON.parse(mismatch.storage.values.get(key)); snap.payload.coins = 999;
    mismatch.storage.values.set(key, JSON.stringify(snap)); assert.equal(mismatch.reload().blocked, true);
});
test('invariants: duplicate item ids / invalid values / shrinking profile rejected', () => {
    const state = freshState('B_6x5', 'DUAL'); state.board[1].id = state.board[0].id; assert.equal(validState(state, state.profileId), false);
    const negative = freshState('B_6x5', 'DUAL'); negative.coins = -1; assert.equal(validState(negative, negative.profileId), false);
    const narrow = freshState('B_6x5', 'DUAL'); narrow.board = narrow.board.slice(0, 20); assert.equal(validState(narrow, narrow.profileId), false);
});
test('600-second deterministic economic simulation / both presets / both chains / reopen every 10 orders', () => {
    for (const preset of ['A_5x4', 'B_6x5']) for (const chain of ['GUI', 'DUAL']) {
        const ctx = setup(preset, chain); let elapsed = 0;
        while (elapsed < 600000) {
            const state = ctx.session.state; const order = state.orders[0];
            if (ctx.session.deficits().every(n => n.count === 0)) { assert.equal(ctx.session.deliver(order.id).ok, true); if (ctx.session.state.completedOrders % 10 === 0) assert.deepEqual(ctx.reload().state, ctx.session.state); }
            else {
                const pair = state.board.map((a, i) => ({ a, i })).find(({ a, i }) => a && Number(a.sku.slice(-1)) < 4 && state.board.some((b, j) => i !== j && b?.sku === a.sku));
                if (pair) { const target = state.board.findIndex((b, j) => j !== pair.i && b?.sku === pair.a.sku); assert.equal(ctx.session.drop(pair.i, target, pair.a.id).ok, true); }
                else { const deficit = ctx.session.deficits().find(n => n.count > 0); ctx.session.select(deficit.sku.slice(0, 3)); const result = ctx.session.spawn(); assert.equal(result.ok, true); }
            }
            ctx.tick(); elapsed += 350; assert.equal(validState(ctx.session.state, ctx.session.state.profileId), true);
        }
        assert.ok(ctx.session.state.completedOrders > 100);
        console.log(`${preset}/${chain}: simulated 600s, ${ctx.session.state.completedOrders} orders, ${ctx.session.state.coins} coins`);
    }
});
fs.mkdirSync(path.join(root, 'evidence/s1'), { recursive: true });
fs.writeFileSync(path.join(root, 'evidence/s1/core-tests.json'), JSON.stringify({ kind: 'Node core tests; 600 seconds are simulated, not human play', passed, total: records.length, records }, null, 2));
console.log(`${passed}/${records.length} tests passed.`);
