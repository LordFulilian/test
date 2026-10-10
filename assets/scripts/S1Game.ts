import { _decorator, Component, Node, UITransform, Label, Graphics, Color, EventTouch, Vec3, Vec2, tween, Tween, game, Game, input, Input, view, ResolutionPolicy, sys, profiler } from 'cc';
import { CONFIG, itemName, levelOf, PresetId, Sku, TestChain } from './core/Config';
import { GameSession, Result } from './core/GameSession';
import { FaultPoint } from './core/SnapshotStore';
import { SoakRun } from './testing/SoakRun';
const { ccclass } = _decorator;
const C = { ink: '#354B45', jade: '#427E6F', paper: '#FBF6E9', cream: '#EFE5D1', gold: '#C69546', muted: '#89948B', white: '#FFFFFF' };
interface Drag { index: number; id: number; finger: number; start: Vec2; active: boolean }

@ccclass('S1Game')
export class S1Game extends Component {
    protected session!: GameSession;
    protected cells: Node[] = [];
    protected icons: Node[] = [];
    protected drag: Drag | null = null;
    protected selectedIndex = -1;
    protected cleaning = false;
    protected modalAction: (() => void) | null = null;
    protected modalLocked = false;
    private lastFullNotice = -Infinity;
    protected cellSize = 92;
    protected boardWidth(): number { return 596; }
    protected dragThreshold(): number { return CONFIG.dragThreshold; }
    protected onDragFinished(_source: number, _target: number, _result: Result | null, _cancelled: boolean): void {}
    protected preset: PresetId = 'B_6x5';
    private chain: TestChain = 'GUI';
    private soak: SoakRun | null = null;

    onLoad(): void {
        view.setDesignResolutionSize(720, 1280, ResolutionPolicy.SHOW_ALL);
        profiler.hideStats();
        this.skin(); this.bindControls(); this.openProfile();
        if (sys.isBrowser && new URLSearchParams(window.location.search).get('s1soak') === '1') {
            this.soak = new SoakRun(sys.localStorage, () => performance.now());
            this.text('Header/Title', '自动验收中'); this.schedule(this.soakTick, 0.4);
        }
    }
    onEnable(): void {
        game.on(Game.EVENT_HIDE, this.cancelDrag, this);
        input.on(Input.EventType.TOUCH_START, this.touchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
        if (sys.isBrowser) window.addEventListener('blur', this.blur);
    }
    onDisable(): void {
        game.off(Game.EVENT_HIDE, this.cancelDrag, this);
        input.off(Input.EventType.TOUCH_START, this.touchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
        if (sys.isBrowser) window.removeEventListener('blur', this.blur);
        this.cancelDrag();
    }
    private readonly blur = (): void => this.cancelDrag();
    protected n(path: string): Node {
        const node = this.node.getChildByPath(path);
        if (!node) throw new Error(`S1 scene binding missing: ${path}`);
        return node;
    }
    protected text(path: string, value: string): void {
        const label = this.n(path).getComponent(Label);
        if (!label) throw new Error(`S1 Label missing: ${path}`);
        label.string = value;
    }
    protected round(node: Node, fill: string, stroke?: string, radius = 16): Graphics {
        const t = node.getComponent(UITransform)!;
        const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
        g.clear(); g.fillColor = new Color(fill); g.roundRect(-t.width / 2, -t.height / 2, t.width, t.height, radius); g.fill();
        if (stroke) { g.strokeColor = new Color(stroke); g.lineWidth = 2; g.stroke(); }
        return g;
    }
    private skin(): void {
        this.round(this.n('Modal'), '#354B45BB', undefined, 0);
        for (const [path, color] of [
            ['Background', C.paper], ['Header/Wallet', C.cream], ['OrderCard', C.white],
            ['BoardPanel', C.cream], ['Controls/Gui', C.gold], ['Controls/Jas', C.cream],
            ['Controls/Spawn', C.jade], ['Controls/Clean', C.cream], ['Tests', C.white],
            ['Modal/Panel', C.paper], ['Modal/Panel/Confirm', C.jade], ['Modal/Panel/Cancel', C.cream],
        ]) this.round(this.n(path), color);
        this.round(this.n('OrderCard/Deliver'), C.jade);
        for (const path of ['Tests/Preset', 'Tests/Chain', 'Tests/Fault']) this.round(this.n(path), C.cream, undefined, 10);
        this.n('Modal').active = false;
    }
    protected click(path: string, action: () => void): void {
        this.n(path).on(Node.EventType.TOUCH_END, () => { if (this.n('Modal').active && !path.startsWith('Modal/')) return; action(); }, this);
    }
    private bindControls(): void {
        this.click('Controls/Spawn', () => { this.cancelDrag(); this.apply(this.session.spawn()); });
        this.click('Controls/Gui', () => { this.cancelDrag(); this.apply(this.session.select('GUI')); });
        this.click('Controls/Jas', () => { this.cancelDrag(); this.apply(this.session.select('JAS')); });
        this.click('Controls/Clean', () => {
            this.cancelDrag(); this.cleaning = !this.cleaning;
            this.selectedIndex = -1; this.refresh(); this.notice(this.cleaning ? '整理模式：点选一件物品，查看收益后确认。' : '已退出整理模式。');
        });
        this.click('OrderCard/Deliver', () => {
            this.cancelDrag(); const order = this.session.state?.orders[0]; if (!order) return;
            const result = this.session.deliver(order.id);
            if (!result.ok && result.code === 'missing') {
                const deficits = this.session.deficits().filter(n => n.count > 0);
                this.apply(result); this.notice(deficits.map(n => `${itemName(n.sku)}还差${n.count}件`).join('，')); return;
            }
            this.apply(result);
        });
        this.click('Tests/Preset', () => { this.cancelDrag(); this.preset = this.preset === 'B_6x5' ? 'A_5x4' : 'B_6x5'; this.openProfile(); });
        this.click('Tests/Chain', () => { this.cancelDrag(); this.chain = this.chain === 'GUI' ? 'DUAL' : 'GUI'; this.openProfile(); });
        this.click('Tests/Fault', () => {
            this.cancelDrag();
            const current = this.session.store.fault;
            const sequence: (FaultPoint | null)[] = [null, 'before-write', 'during-write', 'after-write', 'before-feedback'];
            this.session.store.fault = sequence[(sequence.indexOf(current) + 1) % sequence.length];
            this.refresh(); this.notice('仅独立S1测试档：下一笔业务提交使用所选中断点。');
        });
        this.click('Modal/Panel/Confirm', () => { const action = this.modalAction; this.closeModal(); action?.(); });
        this.click('Modal/Panel/Cancel', () => { if (!this.modalLocked) this.closeModal(); });
    }
    private openProfile(): void {
        this.cleaning = false; this.selectedIndex = -1; this.n('Modal').active = false;
        this.session = new GameSession(sys.localStorage, this.preset, this.chain, () => performance.now());
        this.buildBoard(); this.refresh();
        this.notice(this.session.message || '把两只相同香袋拖到一起，做好绣囊就能交单。');
        if (this.session.blocked) this.showRecovery();
    }
    protected buildBoard(): void {
        const root = this.n('BoardPanel/Board'); root.children.forEach(child => child.destroy()); root.removeAllChildren();
        this.cells = []; this.icons = [];
        const { cols, rows, gap } = CONFIG.presets[this.preset];
        this.cellSize = Math.floor((this.boardWidth() - gap * (cols - 1)) / cols);
        const step = this.cellSize + gap;
        for (let i = 0; i < cols * rows; i++) {
            const cell = new Node(`Cell-${i + 1}`); cell.layer = root.layer; root.addChild(cell);
            cell.addComponent(UITransform).setContentSize(this.cellSize, this.cellSize);
            cell.setPosition((i % cols - (cols - 1) / 2) * step, ((rows - 1) / 2 - Math.floor(i / cols)) * step);
            this.round(cell, '#F8F2E5', '#E2D6BC', 12);
            const icon = new Node('Item'); icon.layer = root.layer; cell.addChild(icon);
            icon.addComponent(UITransform).setContentSize(this.cellSize - 10, this.cellSize - 10);
            icon.addComponent(Graphics);
            const name = new Node('Name'); name.layer = root.layer; icon.addChild(name);
            name.addComponent(UITransform).setContentSize(this.cellSize - 4, 25); name.setPosition(0, -this.cellSize / 2 + 16);
            const label = name.addComponent(Label); label.fontSize = this.cellSize < 100 ? 18 : 20; label.lineHeight = 24; label.color = new Color(C.ink);
            this.cells.push(cell); this.icons.push(icon);
        }
    }
    protected drawItem(icon: Node, sku: Sku): void {
        const g = icon.getComponent(Graphics)!; g.clear();
        const size = this.cellSize; const scale = size / 92;
        const level = levelOf(sku); const gui = sku.startsWith('GUI');
        const fill = gui ? ['#F4D48F', '#DFAB59', '#D08C38', '#B27631'][level - 1] : ['#E3EAD7', '#B6CEAD', '#8BAC91', '#598773'][level - 1];
        const line = gui ? '#9A6939' : '#4A7061';
        g.fillColor = new Color(fill); g.strokeColor = new Color(line); g.lineWidth = 2;
        if (level === 4) { g.roundRect(-29 * scale, -15 * scale, 58 * scale, 45 * scale, 5); g.fill(); g.stroke();
            g.moveTo(-29 * scale, 16 * scale); g.lineTo(29 * scale, 16 * scale); g.moveTo(0, -15 * scale); g.lineTo(0, 30 * scale); g.stroke();
        } else {
            g.moveTo(-15 * scale, 27 * scale); g.lineTo(15 * scale, 27 * scale);
            g.bezierCurveTo(15 * scale, 9 * scale, 32 * scale, -5 * scale, 23 * scale, -17 * scale);
            g.bezierCurveTo(10 * scale, -25 * scale, -10 * scale, -25 * scale, -23 * scale, -17 * scale);
            g.bezierCurveTo(-32 * scale, -5 * scale, -15 * scale, 9 * scale, -15 * scale, 27 * scale); g.close(); g.fill(); g.stroke();
            g.moveTo(-18 * scale, 20 * scale); g.lineTo(18 * scale, 20 * scale); g.stroke();
            if (level >= 2) { g.fillColor = new Color('#FFF4DA');
                for (let petal = 0; petal < 5; petal++) { const a = petal * Math.PI * 2 / 5; g.circle(Math.sin(a) * 5 * scale, Math.cos(a) * 5 * scale, 3 * scale); g.fill(); } }
            if (level === 3) { g.strokeColor = new Color('#FFF4DA'); g.moveTo(-17 * scale, -13 * scale); g.lineTo(17 * scale, -13 * scale); g.stroke(); }
        }
        icon.getChildByName('Name')!.getComponent(Label)!.string = `${gui ? '桂' : '茉'}·${['', '素袋', '绣囊', '缎囊', '礼匣'][level]}`;
    }
    protected refresh(): void {
        const state = this.session.state;
        this.text('Tests/Profile', `S1 独立测试档 · ${this.preset === 'B_6x5' ? '30格' : '20格'} · ${this.chain === 'GUI' ? '桂花单链' : '双香型'} · 正式棋盘待S4确定`);
        const faultNames = { 'before-write': '写入前', 'during-write': '写入中', 'after-write': '写完未反馈', 'before-feedback': '动画前' };
        this.text('Tests/Fault/Text', `中断：${this.session.store.fault ? faultNames[this.session.store.fault] : '关闭'}`);
        if (!state) return;
        this.text('Header/Wallet/Text', `${state.coins} 铜钱`);
        this.text('OrderCard/Needs', state.orders[0].needs.map(n => `${itemName(n.sku)} × ${n.count}`).join('  ＋  '));
        this.text('OrderCard/Reward', `交付得 ${state.orders[0].reward} 铜钱   /   已交 ${state.completedOrders} 单`);
        const canDeliver = this.session.deficits().every(n => n.count === 0);
        this.round(this.n('OrderCard/Deliver'), canDeliver ? C.jade : '#929F91');
        this.text('OrderCard/Deliver/Text', canDeliver ? '交付订单' : '查看缺口');
        this.text('Controls/Clean/Text', this.cleaning ? '退出整理' : '整理');
        this.round(this.n('Controls/Gui'), state.selectedScent === 'GUI' ? C.gold : C.cream);
        this.round(this.n('Controls/Jas'), state.selectedScent === 'JAS' ? C.jade : C.cream);
        this.text('Controls/Jas/Text', this.chain === 'DUAL' ? '茉莉' : '茉莉·未开放');
        this.text('BoardPanel/Status', `${state.board.filter(x => x === null).length} 个空格  ·  ${this.cleaning ? '点选物品整理' : '同类同级拖动合成'}`);
        this.text('Footer/Save', `本地双槽已确认 · 版本 ${state.revision} · ${this.session.blocked ? '经营暂停' : '每次操作即时保存'}`);
        const highlighted = state.board.includes(null) ? [] : this.session.mergeableIndices();
        state.board.forEach((item, i) => {
            this.round(this.cells[i], this.selectedIndex === i ? '#F2DCA6' : '#F8F2E5', highlighted.includes(i) ? C.jade : '#E2D6BC', 12);
            const icon = this.icons[i]; icon.active = item !== null;
            if (item) this.drawItem(icon, item.sku);
        });
    }
    private boardPoint(p: Vec2): Vec3 { return this.n('BoardPanel/Board').getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y)); }
    private indexAt(p: Vec2): number {
        const local = this.boardPoint(p);
        return this.cells.findIndex(cell => Math.abs(local.x - cell.position.x) <= this.cellSize / 2 && Math.abs(local.y - cell.position.y) <= this.cellSize / 2);
    }
    private startDrag(index: number, finger: number, point: Vec2): void {
        if (this.drag || this.n('Modal').active || this.session.blocked) return;
        const item = this.session.state?.board[index]; if (!item) return;
        this.drag = { index, id: item.id, finger, start: point.clone(), active: false };
        this.selectedIndex = index;
    }
    private moveDrag(finger: number, point: Vec2): void {
        const drag = this.drag; if (!drag || drag.finger !== finger || this.cleaning) return;
        if (!drag.active && Vec2.distance(drag.start, point) <= this.dragThreshold()) return;
        drag.active = true;
        const icon = this.icons[drag.index]; Tween.stopAllByTarget(icon); icon.setScale(1, 1, 1);
        icon.setParent(this.n('BoardPanel/Board')); icon.setPosition(this.boardPoint(point)); icon.setSiblingIndex(this.cells.length);
    }
    private endDrag(finger: number, point: Vec2): void {
        const drag = this.drag; if (!drag || drag.finger !== finger) return;
        this.drag = null; this.restoreIcon(drag.index);
        if (this.cleaning && !drag.active) { this.confirmClean(drag.index, drag.id); return; }
        if (drag.active) {
            const target = this.indexAt(point), result = this.session.drop(drag.index, target, drag.id);
            this.onDragFinished(drag.index, target, result, false); this.apply(result);
        }
        else { this.refresh(); this.notice('拖到相同物品上可合成；整理可回收或寄售。'); }
    }
    private restoreIcon(index: number): void { const icon = this.icons[index]; if (!icon) return; icon.setParent(this.cells[index]); icon.setPosition(0, 0, 0); }
    protected cancelDrag(): void {
        if (this.drag) { if (this.drag.active) this.onDragFinished(this.drag.index, -1, null, true); this.restoreIcon(this.drag.index); this.drag = null; }
    }
    protected touchStart(e: EventTouch): void {
        const id = e.getID(); const p = e.getUILocation(); const index = this.indexAt(p);
        if (id !== null && index >= 0) this.startDrag(index, id, p);
    }
    private touchMove(e: EventTouch): void { const id = e.getID(); if (id !== null) this.moveDrag(id, e.getUILocation()); }
    private touchEnd(e: EventTouch): void { const id = e.getID(); if (id !== null) this.endDrag(id, e.getUILocation()); }
    private touchCancel(e: EventTouch): void { if (this.drag?.finger === e.getID()) this.cancelDrag(); }
    protected confirmClean(index: number, id: number): void {
        const item = this.session.state?.board[index]; if (!item || item.id !== id) return;
        const reward = CONFIG.sell[levelOf(item.sku)];
        this.refresh(); this.showModal('整理香品', `将移除「${itemName(item.sku)}」\n${reward ? `寄售所得：${reward} 铜钱` : '1级免费回收，所得：0 铜钱'}\n寄售不计订单或章节进度。`, '确认整理', () => {
            this.selectedIndex = -1; this.apply(this.session.sell(index, id));
        });
    }
    protected apply(result: Result): void {
        this.refresh();
        if (!result.ok) {
            if (result.code !== 'full' || performance.now() - this.lastFullNotice >= CONFIG.fullNoticeIntervalMs) {
                this.notice(result.reason); if (result.code === 'full') this.lastFullNotice = performance.now();
            }
            if (this.session.blocked) this.showRecovery(); return;
        }
        if (result.effect === 'merge' && result.target !== undefined) {
            const icon = this.icons[result.target]; Tween.stopAllByTarget(icon); icon.setScale(0.75, 0.75, 1);
            tween(icon).to(CONFIG.mergeDuration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            this.notice('香品升级，已保存。');
        } else if (result.effect === 'order') this.notice(`订单已交付，获得 ${result.reward} 铜钱。`);
        else if (result.effect === 'sell') this.notice(`整理完成，获得 ${result.reward} 铜钱。`);
        else if (result.effect === 'spawn') this.notice('新香袋已放入第一个空格。');
        else if (result.effect === 'select') this.notice(`已选择${this.session.state?.selectedScent === 'GUI' ? '桂花' : '茉莉'}，免费出货。`);
    }
    protected notice(message: string): void { this.text('Footer/Notice', message); }
    protected showModal(title: string, body: string, confirm: string, action: () => void, locked = false): void {
        this.cancelDrag(); this.text('Modal/Panel/Title', title); this.text('Modal/Panel/Body', body);
        this.text('Modal/Panel/Confirm/Text', confirm); this.modalAction = action; this.modalLocked = locked;
        this.n('Modal/Panel/Cancel').active = !locked; this.n('Modal').active = true;
    }
    protected closeModal(): void { this.n('Modal').active = false; this.modalAction = null; this.modalLocked = false; }
    protected showRecovery(): void {
        this.showModal('存档需要重试', this.session.message, '重试读取', () => {
            this.session.retry(); this.refresh(); if (this.session.blocked) this.showRecovery(); else this.notice('已确认有效快照，可以继续经营。');
        }, true);
    }
    private soakTick(): void {
        if (!this.soak) return;
        try {
            const report = this.soak.step(); this.session.retry(); this.refresh();
            this.notice(`自动经营验收 ${Math.floor(report.elapsedMs / 1000)} / 600 秒 · 四档合计 ${report.orders} 单`);
            if (report.done) { this.unschedule(this.soakTick); this.text('Header/Title', '验收已完成'); }
        } catch (error) {
            this.unschedule(this.soakTick); this.text('Header/Title', '验收失败'); this.notice(String(error)); console.error('S1_SOAK_FAILED', error);
        }
    }
}
