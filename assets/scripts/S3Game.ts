import { _decorator, game, Game, Label, Color, Sprite, SpriteFrame, Rect, Size, Vec2, UITransform } from 'cc';
import { Page, S2Game } from './S2Game';
import { CONTENT_MAX_CHAPTER, ENABLE_TEST_CLOCK } from './core/BuildStage';
import { InjectedTestClock } from './core/Clock';
import { chapterGoal, hasNode } from './core/Chapter';
import { pendingCount, pendingFree, GARDEN } from './core/Garden';
import { Result } from './core/GameSession';
import { itemName, Sku, Scent } from './core/Config';
const {ccclass}=_decorator;
const EXTRA=['garden','xiaoman','zhoushen','counter-apricot','counter-celadon','JAS_1','JAS_2','JAS_3','JAS_4'];
@ccclass('S3Game')
export class S3Game extends S2Game {
    private clock:InjectedTestClock|null=null;
    private queuePage=0;
    protected chapterLimit():1|2 {return CONTENT_MAX_CHAPTER;}
    protected testStage():'s2'|'s3'|'s4' {return 's3';}
    protected assetKeys():readonly string[] {return [...super.assetKeys(),...EXTRA];}
    protected assetPath(key:string):string {return EXTRA.includes(key)?`s3/${key}/spriteFrame`:super.assetPath(key);}
    protected afterOpen():void {
        if(ENABLE_TEST_CLOCK){const anchors=this.session.state?.garden.map(p=>p.lastSettledAtMs??0)??[];
            this.clock=new InjectedTestClock(Math.max(Date.UTC(2026,9,8),...anchors),()=>performance.now());this.session.setGardenClock(this.clock);
            if(this.session.state?.garden.length)this.session.settleGarden();}
        this.schedule(this.gardenPulse,60);
    }
    onEnable():void {super.onEnable();game.on(Game.EVENT_HIDE,this.settleBeforeHide,this);game.on(Game.EVENT_SHOW,this.gardenPulse,this);}
    onDisable():void {this.unschedule(this.gardenPulse);game.off(Game.EVENT_HIDE,this.settleBeforeHide,this);game.off(Game.EVENT_SHOW,this.gardenPulse,this);super.onDisable();}
    private settleBeforeHide():void {if(this.session?.state?.garden.length&&!this.session.blocked)this.session.settleGarden();}
    private gardenPulse():void {if(this.session?.state?.garden.length&&!this.session.blocked){this.session.settleGarden();this.refresh();}}
    protected skinS2():void {
        super.skinS2();
        for(const p of ['Garden/GUI','Garden/JAS','Garden/TimePanel','Pending/Panel','Album/Panel'])this.round(this.n(p),'#FFF6E5F5','#CDA86D',20);
        for(const p of ['Nav/Garden','Nav/Album','Controls/Jas','Decor/Panel/CounterTab','Pending/Prev','Pending/Next','Garden/Plus30','Garden/Plus8','Garden/Offline'])this.round(this.n(p),'#F0DEC0','#CDA86D',14);
        for(const p of ['QuickPending','Garden/GUI/Harvest','Garden/JAS/Harvest','Pending/ReceiveAll'])this.round(this.n(p),'#477E64','#D5B86E',14);
        for(let i=0;i<6;i++)this.round(this.n(`Pending/Row${i}`),'#FFF6E5','#D8BA86',12);
        for(let i=0;i<8;i++)this.round(this.n(`Album/Item${i}`),'#FFF6E5','#D8BA86',14);
    }
    protected bindS2():void {
        super.bindS2();this.click('Nav/Garden',()=>this.setPage('garden'));this.click('Nav/Album',()=>this.setPage('album'));
        this.click('QuickPending',()=>this.setPage('pending'));this.click('Controls/Jas',()=>{this.cancelDrag();this.apply(this.session.select('JAS'));});
        this.click('Decor/Panel/CounterTab',()=>this.setSlot('COUNTER'));
        this.click('Work/Order2/Deliver',()=>{const s=this.session.state,o=s?.orders[2];if(o)this.apply(this.session.deliver(o.id));else if(s){this.slot='COUNTER';this.setPage('decor');}});
        for(const id of ['GUI','JAS'] as Scent[])this.click(`Garden/${id}/Harvest`,()=>this.apply(this.session.harvest(id)));
        this.click('Pending/ReceiveAll',()=>this.apply(this.session.receivePending(null)));
        this.click('Pending/Prev',()=>{this.queuePage=Math.max(0,this.queuePage-1);this.refresh();});
        this.click('Pending/Next',()=>{const entries=this.session.state?.pendingEntries.length??0;this.queuePage=Math.min(Math.max(0,Math.ceil(entries/6)-1),this.queuePage+1);this.refresh();});
        for(let i=0;i<6;i++)this.click(`Pending/Row${i}`,()=>{const entry=this.session.state?.pendingEntries[this.queuePage*6+i];if(entry)this.apply(this.session.receivePending(entry.entryId));});
        for(let i=0;i<8;i++)this.click(`Album/Item${i}`,()=>{const sku=`${i<4?'GUI':'JAS'}_${i%4+1}` as Sku;const found=this.session.state?.album.includes(sku);
            this.showModal(itemName(sku),found?'香品已收录。它第一次实际进入棋盘时，香册就会记下这一页。':'制作或领取到棋盘后，便会收录这件香品。','知道了',()=>{});});
        this.click('Garden/Plus30',()=>this.advance(30*60000));this.click('Garden/Plus8',()=>this.advance(8*3600000));
        this.click('Garden/Offline',()=>{if(!ENABLE_TEST_CLOCK||!this.clock)return;this.clock.available=!this.clock.available;if(this.clock.available)this.session.settleGarden();this.refresh();});
    }
    protected setPage(page:Page):void {super.setPage(page);if(page==='garden'&&this.session.state?.garden.length)this.apply(this.session.settleGarden());}
    private advance(ms:number):void {if(!ENABLE_TEST_CLOCK||!this.clock)return;this.clock.advance(ms);this.apply(this.session.settleGarden());}
    protected afterArtLoaded():void {
        for(const key of ['shop','counter-apricot','counter-celadon']){
            const src=this.frames.get(key)!;const frame=new SpriteFrame(),w=src.texture.width,h=src.texture.height;
            frame.texture=src.texture;frame.rect=new Rect(0,h*.34,w*(key==='shop'?.85:1),h*.43);frame.originalSize=new Size(frame.rect.width,frame.rect.height);frame.offset=new Vec2(0,0);
            this.frames.set(key==='shop'?'thumb-counter-default':'thumb-'+key,frame);
        }
    }
    protected image(path:string,key:string):void {
        const counterThumb=path.startsWith('Decor/Panel/Card')&&this.slot==='COUNTER';
        super.image(path,counterThumb?'thumb-'+key:key);
        if(path==='Shop/Counter'){const sprite=this.n(path).getComponent(Sprite);if(sprite)sprite.trim=false;}
    }
    protected refresh():void {
        super.refresh();if(!this.session)return;const s=this.session.state;if(!s)return;
        this.n('Shop').active=this.page==='shop'||this.page==='decor';this.n('Work').active=this.page==='work';this.n('Decor').active=this.page==='decor';
        for(const [node,page]of [['Garden','garden'],['Pending','pending'],['Album','album']]as const)this.n(node).active=this.page===page;
        this.n('Work/Hint').active=false;this.n('Tests/Profile').active=false;
        this.n('QuickPending').active=s.chapter===2&&['work','shop','garden'].includes(this.page);this.text('QuickPending/Text',`待领取 ${pendingCount(s)}/30 · 查看与取出`);
        this.n('QuickPending').setPosition(0,this.page==='garden'?-482:-442,0);
        const nav=s.chapter===2?['Shop','Work','Garden','Decor','Album']:['Shop','Work','Decor','Album'];
        this.n('Nav/Garden').active=s.chapter===2;
        nav.forEach((name,i)=>{this.n('Nav/'+name).setPosition((i-(nav.length-1)/2)*(nav.length===5?132:168),0);this.round(this.n('Nav/'+name),this.page===name.toLowerCase()?'#C6D7B5':'#F0DEC0','#CDA86D',14);});
        this.text('Header/Chapter',`${s.completedChapters.includes(2)?'两章已完成':s.chapter===2?'第二章 · 花窗来客':'第一章 · 重新开张'}${ENABLE_TEST_CLOCK?' · 开发时钟':''}`);
        this.text('Work/Goal',`${chapterGoal(s)}\n累计交付 ${s.completedOrders} 单`);
        this.text('Tests/Profile',`S3独立验收档 · ${this.preset} · ${s.coins}铜钱 / ${s.completedOrders}单`);
        this.n('Controls/Jas').active=s.chapter===2;this.round(this.n('Controls/Gui'),s.selectedScent==='GUI'?'#E9C783':'#F0DEC0','#CDA86D',14);
        this.round(this.n('Controls/Jas'),s.selectedScent==='JAS'?'#C6D7B5':'#F0DEC0','#CDA86D',14);
        for(let i=0;i<3;i++){
            const p=`Work/Order${i}`,o=s.orders[i],two=s.chapter!==2;
            this.n(p).active=i===0||(two?hasNode(s,'1B')&&i===1:true);
            this.n(p).setPosition(two?(i===0&&!hasNode(s,'1B')?0:(i-.5)*330):(i-1)*220,344);
            const card=this.n(p).getComponent(UITransform)!;card.setContentSize(two?322:210,170);
            for(const name of ['Title','Needs'])this.n(p+'/'+name).getComponent(UITransform)!.setContentSize(two?278:196,name==='Needs'?58:32);
            this.n(p+'/Needs').setPosition(0,13);this.n(p+'/Deliver').getComponent(UITransform)!.setContentSize(two?268:184,50);
            this.n(p+'/Deliver/Text').getComponent(UITransform)!.setContentSize(two?256:176,44);
            this.text(p+'/Title',o?.id==='T0'?'开张首单':o?.id==='C1a'?'阿绫 · 赠友':o?.id==='C2a'?'小满 · 茉莉香':o?.id==='C2b'?'周婶 · 成套礼':o?.id.startsWith('M-')?'中单':o?'短单':s.completedChapters.includes(2)?'两章已完成':'装修目标');
            this.text(p+'/Needs',o?o.needs.map(n=>`${itemName(n.sku)} ×${n.count}`).join('\n'):chapterGoal(s));
            const can=o&&this.session.deficits(o.id).every(n=>n.count===0);this.round(this.n(p),'#FFF6E5F5','#CDA86D',18);
            this.round(this.n(p+'/Deliver'),can?'#477E64':'#928D76','#D5B86E',12);this.text(p+'/Deliver/Text',o?`${can?'交付':'缺口'} +${o.reward}`:'去布置');
        }
        if(s.chapter===2){this.text('Shop/GoalCard/Goal',chapterGoal(s));
            const aunt=hasNode(s,'2C')&&!hasNode(s,'C2b'),who=aunt?'zhoushen':'xiaoman';this.image('Shop/Customer',who);this.image('Shop/GoalCard/Portrait',who);
            this.text('Shop/GoalCard/Who',aunt?'周婶':'小满');this.text('Shop/GoalCard/Dialogue',aunt?'桂花、茉莉各一匣，给家里带一份好香。':'茉莉清雅，想把这份香气带回去。');}
        const counter=this.preview.displayed('COUNTER',s);this.n('Shop/Counter').active=counter!=='counter-default';if(counter!=='counter-default')this.image('Shop/Counter',counter);
        this.round(this.n('Decor/Panel/CounterTab'),this.slot==='COUNTER'?'#C6D7B5':'#F0DEC0','#CDA86D',14);
        this.image('Garden/Backdrop','garden');
        for(const id of ['GUI','JAS']as Scent[]){const p=s.garden.find(p=>p.id===id),path=`Garden/${id}`;this.text(path+'/Title',id==='GUI'?'桂花地块':'茉莉地块');
            this.text(path+'/Stock',p?`${p.storedCount}/16 件 ${id==='GUI'?'桂花':'茉莉'}绣囊`:'第二章完成后开放');
            this.text(path+'/Progress',!p?'尚未开放':!p.initialized?'联网后初始化':p.storedCount===16?'库存已满，生长暂停':`下一件还需 ${Math.ceil((GARDEN.intervalMs-p.carryMs)/60000)} 分钟`);
            this.text(path+'/Harvest/Text',p?'收获到待领取区':'尚未开放');this.round(this.n(path+'/Harvest'),p?'#477E64':'#928D76','#D5B86E',14);}
        this.text('Garden/Time',ENABLE_TEST_CLOCK?(this.clock?.available?'开发测试时间 · 可用按钮注入时长，非服务器时间':'测试离线状态 · 联网后结算花园'):'联网后结算花园；当前未接入时间服务');
        this.text('Garden/Capacity',`待领取 ${pendingCount(s)}/30 件 · 可入库 ${pendingFree(s)} 件\n收不下的香品会留在地块里。`);
        for(const p of ['Plus30','Plus8','Offline'])this.n('Garden/'+p).active=ENABLE_TEST_CLOCK;
        this.text('Garden/Offline/Text',this.clock?.available?'模拟离线':'恢复测试时钟');
        this.text('Pending/Title',`待领取 · ${pendingCount(s)}/30 件`);this.queuePage=Math.min(this.queuePage,Math.max(0,Math.ceil(s.pendingEntries.length/6)-1));
        this.text('Pending/Description',s.pendingEntries.length?'点一条取出1件，或取出棋盘能放下的全部。':'这里会保留花园收获；不会过期，也不会自动出售。');
        this.text('Pending/Page',`${this.queuePage+1} / ${Math.max(1,Math.ceil(s.pendingEntries.length/6))}`);
        for(let i=0;i<6;i++){const path=`Pending/Row${i}`,e=s.pendingEntries[this.queuePage*6+i];this.n(path).active=!!e;if(e){this.image(path+'/Icon',e.sku);this.text(path+'/Name',`${itemName(e.sku)} × ${e.remainingCount}`);this.text(path+'/Hint','点取1件 · 自动放入第一个空格');}}
        this.text('Album/Title',`香册 · 已收录 ${s.album.length}/8`);
        for(let i=0;i<8;i++){const sku=`${i<4?'GUI':'JAS'}_${i%4+1}`as Sku,p=`Album/Item${i}`,found=s.album.includes(sku);this.image(p+'/Icon',sku);const sprite=this.n(p+'/Icon').getComponent(Sprite);if(sprite)sprite.color=new Color(found?'#FFFFFF':'#A6A39388');
            this.text(p+'/Name',found?itemName(sku):'未发现');this.round(this.n(p),found?'#FFF6E5':'#E6DECB','#D8BA86',14);}
    }
    protected apply(r:Result):void {super.apply(r);if(r.ok){if(r.effect==='harvest')this.notice(r.quantity?`已收获${r.quantity}件到待领取区。`:'没有转出香品，库存仍留在花园。');
        if(r.effect==='receive')this.notice(`已取出${r.quantity??0}件，放入棋盘空格。`);if(r.effect==='settle')this.notice('花园库存已按当前时间结算。');
        if(r.effect==='order'&&this.session.state?.chapter===2&&!this.session.state.completedChapters.includes(2))this.notice(`订单已交付，获得${r.reward}铜钱，累计${this.session.state.completedOrders}单。`);
        if(r.effect==='order'&&this.session.state?.completedChapters.includes(2))this.notice('两章已完成！继续经营、布置和收获。');}}
}
