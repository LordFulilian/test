import { _decorator, Node, UITransform, Graphics, Sprite, SpriteFrame, Color, resources, view, ResolutionPolicy, sys, game, Game, director, profiler, isValid, EventTouch, Label } from 'cc';
import { S1Game } from './S1Game';
import { GameSession, Result } from './core/GameSession';
import { CONFIG, itemName, Sku } from './core/Config';
import { chapterGoal, DECOR, DecorSlot, hasNode, unlocked } from './core/Chapter';
import { DecorPreview } from './core/DecorPreview';
import { FaultPoint } from './core/SnapshotStore';
const { ccclass } = _decorator;
const ASSETS = ['shop','aling','lantern-default','lantern-osmanthus','lantern-celadon','curtain-default','curtain-apricot','curtain-celadon','GUI_1','GUI_2','GUI_3','GUI_4'];
export type Page = 'shop' | 'work' | 'decor' | 'garden' | 'pending' | 'album';
@ccclass('S2Game')
export class S2Game extends S1Game {
    protected page: Page = 'work';
    protected slot: DecorSlot = 'LANTERN';
    protected readonly preview = new DecorPreview();
    protected readonly frames = new Map<string, SpriteFrame>();
    private readonly artBounds = new Map<Node, {width:number;height:number}>();
    protected ready = false;
    protected testing = false;
    protected chapterLimit():1|2 {return 1;}
    protected testStage():'s2'|'s3'|'s4' {return 's2';}
    protected assetKeys():readonly string[] {return ASSETS;}
    protected assetPath(key:string):string {return `s2/${key}/spriteFrame`;}
    protected afterOpen():void {}
    protected afterArtLoaded():void {}
    onLoad(): void {
        const query = sys.isBrowser ? new URLSearchParams(window.location.search) : new URLSearchParams();
        if (query.get('core') === '1') { this.enabled = false; director.loadScene('S1'); return; }
        this.testing = query.get(this.testStage()+'test') === '1';
        this.preset = this.testing && query.get('preset') === 'A' ? 'A_5x4' : CONFIG.prototypeBoardPreset;
        const suffix = (query.get('profile') ?? 'local').replace(/[^a-zA-Z0-9_-]/g, '').slice(0,48) || 'local';
        const profile = this.testing ? `${this.testStage()}-test-${this.preset}-${suffix}` : `main-v1-${this.preset}`;
        view.setDesignResolutionSize(720,1280,ResolutionPolicy.SHOW_ALL); profiler.hideStats();
        this.session = new GameSession(sys.localStorage,this.preset,'GUI',()=>performance.now(),{story:true,profile,maxChapter:this.chapterLimit()});
        this.skinS2(); this.bindS2(); this.buildBoard();
        this.afterOpen();
        const state=this.session.state;if(state && hasNode(state, '1A')) this.page = 'shop';
        this.refresh(); this.loadArt(); if(this.session.blocked) this.showRecovery();
    }
    onEnable(): void {
        super.onEnable(); game.on(Game.EVENT_HIDE,this.clearPreview,this);
        if(sys.isBrowser) window.addEventListener('blur',this.previewBlur);
    }
    onDisable(): void {
        super.onDisable(); game.off(Game.EVENT_HIDE,this.clearPreview,this);
        if(sys.isBrowser) window.removeEventListener('blur',this.previewBlur);
        this.preview.cancel();
    }
    private readonly previewBlur = (): void => this.clearPreview();
    private clearPreview(): void { this.preview.cancel(); if(this.session && isValid(this.node))this.refresh(); }
    protected touchStart(e: EventTouch): void { if(this.page==='work' && this.ready) super.touchStart(e); }
    protected n(path: string): Node {
        if(path==='BoardPanel' || path.startsWith('BoardPanel/'))path='Work/'+path;
        if(path==='Controls' || path.startsWith('Controls/'))path='Work/'+path;
        return super.n(path);
    }
    protected skinS2(): void {
        for(const p of ['Header/Paper','Header/Wallet','Shop/GoalCard','Work/Sheet','Work/Order0','Work/Order1','Work/BoardPanel','Decor/Panel']) this.round(this.n(p),'#FFF6E5F5','#CDA86D',20);
        for(const p of ['Nav/Shop','Nav/Work','Nav/Decor','Controls/Gui','Controls/Clean','Decor/Panel/LanternTab','Decor/Panel/CurtainTab','Decor/Panel/Cancel','Modal/Panel/Cancel','Tests/Fault'])this.round(this.n(p),'#F0DEC0','#CDA86D',14);
        for(const p of ['Shop/GoalCard/Work','Controls/Spawn','Work/Order0/Deliver','Work/Order1/Deliver','Decor/Panel/Use','Modal/Panel/Confirm'])this.round(this.n(p),'#477E64','#D5B86E',16);
        this.round(this.n('Modal'),'#30291FCC',undefined,0);this.round(this.n('Modal/Panel'),'#FFF6E5','#CDA86D',22);this.n('Modal').active=false;
        this.round(this.n('FooterPaper'),'#FFF6E5F5','#CDA86D',8);
    }
    protected bindS2(): void {
        for(const [name,page] of [['Shop','shop'],['Work','work'],['Decor','decor']] as const)this.click('Nav/'+name,()=>this.setPage(page));
        this.click('Shop/GoalCard/Work',()=>this.setPage('work'));
        this.click('Controls/Spawn',()=>{if(!this.ready)return;this.cancelDrag();this.apply(this.session.spawn());});
        this.click('Controls/Gui',()=>this.apply(this.session.select('GUI')));
        this.click('Controls/Clean',()=>{this.cancelDrag();this.cleaning=!this.cleaning;this.selectedIndex=-1;this.refresh();this.notice(this.cleaning?'整理：点选香品，确认后回收或寄售。':'已退出整理。');});
        for(let i=0;i<2;i++)this.click(`Work/Order${i}/Deliver`,()=>{this.cancelDrag();const state=this.session.state;const order=state?.orders[i];if(order)this.apply(this.session.deliver(order.id));else if(state){this.slot=hasNode(state,'1C')?'CURTAIN':'LANTERN';this.setPage('decor');}});
        this.click('Decor/Panel/LanternTab',()=>this.setSlot('LANTERN'));
        this.click('Decor/Panel/CurtainTab',()=>this.setSlot('CURTAIN'));
        for(let i=0;i<3;i++)this.click(`Decor/Panel/Card${i}`,()=>{const decor=DECOR.filter(d=>d.slot===this.slot)[i];this.preview.select(decor.id);this.refresh();});
        this.click('Decor/Panel/Cancel',()=>{this.preview.cancel();this.setPage('shop');});
        this.click('Decor/Panel/Use',()=>{
            const state=this.session.state;if(!state)return;
            const id=this.preview.id??state.activeDecorBySlot[this.slot];this.preview.cancel();const result=this.session.useDecor(id);this.apply(result);
            if(!result.ok && result.code==='coins')this.showModal('继续接单就能攒够',result.reason,'去接单',()=>this.setPage('work'));
        });
        this.click('Tests/Fault',()=>{const seq:(FaultPoint|null)[]=[null,'before-write','during-write','after-write','before-feedback'];this.session.store.fault=seq[(seq.indexOf(this.session.store.fault)+1)%seq.length];this.refresh();});
        this.click('Modal/Panel/Confirm',()=>{const action=this.modalAction;this.closeModal();action?.();});
        this.click('Modal/Panel/Cancel',()=>{if(!this.modalLocked)this.closeModal();});
    }
    protected setPage(page:Page):void {this.cancelDrag();this.preview.cancel();this.cleaning=false;this.selectedIndex=-1;this.page=page;this.refresh();}
    protected setSlot(slot:DecorSlot):void {this.preview.cancel();this.slot=slot;this.refresh();}
    protected loadArt():void {
        Promise.all(this.assetKeys().map(name=>new Promise<void>((resolve,reject)=>resources.load(this.assetPath(name),SpriteFrame,(err,frame)=>{
            if(err || !frame){reject(err??new Error(`Missing sprite ${name}`));return;}this.frames.set(name,frame);resolve();
        })))).then(()=>{if(!isValid(this.node))return;this.afterArtLoaded();this.ready=true;this.refresh();this.notice('把香品拖到一起，慢慢把小铺布置好。');})
            .catch(error=>{if(!isValid(this.node))return;console.error('S2_REQUIRED_ART_LOAD_FAILED',error);this.showModal('画面加载失败','请重试加载香铺画面。','重试',()=>this.loadArt(),true);});
    }
    protected image(path:string,key:string):void {
        const node=this.n(path),frame=this.frames.get(key);if(!frame)return;
        const t=node.getComponent(UITransform)!;let bounds=this.artBounds.get(node);
        if(!bounds){bounds={width:t.width,height:t.height};this.artBounds.set(node,bounds);}
        const scale=Math.min(bounds.width/frame.originalSize.width,bounds.height/frame.originalSize.height);
        t.setContentSize(frame.originalSize.width*scale,frame.originalSize.height*scale);
        const sprite=node.getComponent(Sprite)??node.addComponent(Sprite);sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=frame;
        sprite.color=new Color(key==='lantern-default'?'#B6AF9D':'#FFFFFF');
    }
    protected drawItem(icon:Node,sku:Sku):void {
        const frame=this.frames.get(sku);if(!frame){super.drawItem(icon,sku);return;}
        icon.getComponent(Graphics)?.clear();
        let art=icon.getChildByName('Art');if(!art){art=new Node('Art');art.layer=icon.layer;icon.addChild(art);art.addComponent(UITransform);art.addComponent(Sprite);}
        art.getComponent(UITransform)!.setContentSize(this.cellSize-8,this.cellSize-8);art.setPosition(0,5);
        const sprite=art.getComponent(Sprite)!;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=frame;
        const label=icon.getChildByName('Name')!;label.setPosition(0,-this.cellSize/2+10);
        // Use the base label API through a direct component, never as data storage.
        const component=label.getComponent(Label)!;component.string=['','素袋','绣囊','缎囊','礼匣'][Number(sku.slice(-1))];component.fontSize=18;
    }
    protected refresh():void {
        if(!this.session)return;const s=this.session.state;
        this.n('Work').active=this.page==='work';this.n('Shop').active=this.page!=='work';this.n('Decor').active=this.page==='decor';
        this.n('Shop/Customer').active=this.page==='shop';
        this.n('Tests').active=this.testing && this.page==='work';
        if(!s)return;
        this.text('Header/Wallet/Text',`${s.coins} 铜钱`);this.text('Header/Chapter',s.completedChapters.includes(1)?'第一章已完成 · 继续经营':'第一章 · 重新开张');
        this.text('Work/Goal',chapterGoal(s));this.text('Shop/GoalCard/Goal',chapterGoal(s));
        this.text('Shop/GoalCard/Dialogue',hasNode(s,'C1a')?'香气送到好友身边，小铺也慢慢热闹起来。':'想给好友，带一份桂花香。');
        this.text('Shop/GoalCard/Who','阿绫');
        for(const [name,page] of [['Shop','shop'],['Work','work'],['Decor','decor']] as const)this.round(this.n('Nav/'+name),this.page===page?'#C6D7B5':'#F0DEC0','#CDA86D',14);
        for(let i=0;i<2;i++){
            const o=s.orders[i],p=`Work/Order${i}`;
            this.n(p).active=i===0 || hasNode(s,'1B');
            if(i===0)this.n(p).setPosition(hasNode(s,'1B')?-166:0,344,0);
            this.text(p+'/Title',o?.id==='C1a'?'阿绫 · 桂花赠友':o?.id==='T0'?'开张首单 · 阿绫':o?'桂花短单':i===0?'下一步 · 布置灯笼':'装修目标');
            this.text(p+'/Needs',o?o.needs.map(n=>`${itemName(n.sku)} × ${n.count}`).join(' + '):i===0?'换上新灯笼，开始接单':s.completedChapters.includes(1)?'第一章已完成':hasNode(s,'curtain-used')?`累计交付 ${s.completedOrders}/6 单`:hasNode(s,'1C')?'挑选一幅新门帘':`累计交付 ${s.completedOrders}/3 单`);
            const can=o&&this.session.deficits(o.id).every(n=>n.count===0);this.round(this.n(p+'/Deliver'),can?'#477E64':'#928D76','#D5B86E',12);
            this.text(p+'/Deliver/Text',o?`${can?'交付':'查看缺口'} +${o.reward}`:'去布置');
        }
        this.text('Work/BoardPanel/Status',`${s.board.filter(x=>x===null).length} 个空格 · ${this.cleaning?'点选香品整理':'同类同级拖动合成'}`);
        this.text('Controls/Clean/Text',this.cleaning?'退出':'整理');
        const highlights=s.board.includes(null)?[]:this.session.mergeableIndices();
        s.board.forEach((item,i)=>{this.round(this.cells[i],this.selectedIndex===i?'#F1D6A0':'#FFF4DF',highlights.includes(i)?'#477E64':'#D8BA86',12);this.icons[i].active=item!==null;if(item)this.drawItem(this.icons[i],item.sku);});
        this.image('Background','shop');this.image('Shop/Lantern',this.preview.displayed('LANTERN',s));this.image('Shop/Curtain',this.preview.displayed('CURTAIN',s));this.image('Shop/Customer','aling');this.image('Shop/GoalCard/Portrait','aling');
        this.n('Shop/PreviewBadge').active=this.preview.id!==null;
        this.n('Shop/PreviewPaper').active=this.preview.id!==null;
        if(this.preview.id!==null)this.round(this.n('Shop/PreviewPaper'),'#7A6349E8',undefined,14);
        const displayedLamp=this.preview.displayed('LANTERN',s),glow=this.n('Shop/Glow');glow.active=displayedLamp!=='lantern-default';
        const g=glow.getComponent(Graphics)??glow.addComponent(Graphics);g.clear();g.fillColor=new Color('#FFD88928');g.circle(0,0,90);g.fill();glow.setSiblingIndex(0);
        const choices=DECOR.filter(d=>d.slot===this.slot),chosen=this.preview.id??s.activeDecorBySlot[this.slot];
        choices.forEach((d,i)=>{const p=`Decor/Panel/Card${i}`;this.round(this.n(p),chosen===d.id?'#E2EACF':'#FFF5DF',chosen===d.id?'#477E64':'#D8BA86',14);this.image(p+'/Icon',d.id);this.text(p+'/Name',d.name);this.text(p+'/State',s.activeDecorBySlot[d.slot]===d.id?'使用中':s.ownedDecorIds.includes(d.id)?'已拥有 · 免费':'未拥有 · '+d.cost+'铜钱');});
        const d=DECOR.find(d=>d.id===chosen)!;const owned=s.ownedDecorIds.includes(d.id),allowed=unlocked(s,d);
        this.text('Decor/Panel/Condition',allowed?this.preview.id?'仅预览，不扣铜钱；确认后才摆上。':'每个位置使用一款，已拥有的免费换回。':'尚未解锁 · '+d.condition);
        this.text('Decor/Panel/Use/Text',!allowed?'尚未解锁':owned?s.activeDecorBySlot[d.slot]===d.id?'正在使用':'免费使用':`购买并摆上 · ${d.cost}`);
        this.round(this.n('Decor/Panel/Use'),allowed?'#477E64':'#928D76','#D5B86E',16);
        this.round(this.n('Decor/Panel/LanternTab'),this.slot==='LANTERN'?'#C6D7B5':'#F0DEC0','#CDA86D',14);this.round(this.n('Decor/Panel/CurtainTab'),this.slot==='CURTAIN'?'#C6D7B5':'#F0DEC0','#CDA86D',14);
        const names={'before-write':'写入前','during-write':'写入中','after-write':'写完未反馈','before-feedback':'动画前'};
        this.text('Tests/Fault/Text',`测试中断：${this.session.store.fault?names[this.session.store.fault]:'关闭'}`);
        this.text('Tests/Profile',`S2独立验收档 · ${this.preset} · ${s.coins}铜钱 / ${s.completedOrders}单`);
    }
    protected apply(result:Result):void {
        super.apply(result);
        if(!result.ok && result.code==='save')this.showModal('本次操作未保存','已恢复上一完整状态，物品和铜钱保持不变。\n可以重新点选物品或装扮，再确认操作。','知道了',()=>{});
        if(result.ok && result.effect==='decor')this.notice('装扮已摆上，已保存；换回已拥有款不花钱。');
        if(result.ok && result.effect==='order' && this.session.state?.completedChapters.includes(1))this.notice('第一章已完成！还能继续接单，慢慢布置香铺。');
    }
}
