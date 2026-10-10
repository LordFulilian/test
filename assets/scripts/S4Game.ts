import { _decorator, game, Game, sys, UITransform, Label, Graphics, view } from 'cc';
import { S3Game } from './S3Game';
import { ENABLE_S4_TESTS } from './core/BuildStage';
import { CONFIG } from './core/Config';
import { Result } from './core/GameSession';
import { cloneState } from './core/State';
import { S4_FIXTURES } from './testing/S4Fixtures';
import { S4Metrics, Scenario, DragReview, TestIdentity } from './testing/S4Metrics';
const {ccclass}=_decorator;
const BUTTONS=['Shop/GoalCard/Work','Work/Order0/Deliver','Work/Order1/Deliver','Work/Order2/Deliver','Controls/Gui','Controls/Jas','Controls/Spawn','Controls/Clean','Nav/Shop','Nav/Work','Nav/Garden','Nav/Decor','Nav/Album','QuickPending','Decor/Panel/LanternTab','Decor/Panel/CurtainTab','Decor/Panel/CounterTab','Decor/Panel/Use','Decor/Panel/Cancel','Garden/GUI/Harvest','Garden/JAS/Harvest','Garden/Plus30','Garden/Plus8','Garden/Offline','Pending/ReceiveAll','Pending/Prev','Pending/Next','Modal/Panel/Confirm','Modal/Panel/Cancel',...Array.from({length:6},(_,i)=>`Pending/Row${i}`),...Array.from({length:8},(_,i)=>`Album/Item${i}`),...Array.from({length:3},(_,i)=>`Decor/Panel/Card${i}`)];
@ccclass('S4Game')
export class S4Game extends S3Game {
    private metrics: S4Metrics | null=null;
    private identity!:TestIdentity;
    private reportKey='';
    private emitCountdown=0;
    private scenario:Scenario='chapter1';
    private viewportChanged=false;
    private initialContentValid=false;
    private outsideTimedChanges=0;
    protected testStage():'s2'|'s3'|'s4' {return 's4';}
    protected boardWidth():number {return 640;}
    protected dragThreshold():number {return CONFIG.dragThreshold/this.logicalScale();}
    onLoad():void {
        if(!ENABLE_S4_TESTS||!sys.isBrowser)throw Error('S4 entry is enabled only in explicit development Web Mobile test builds.');
        const q=new URLSearchParams(window.location.search),clean=(s:string)=>s.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32)||'local';
        this.scenario=q.get('scenario')==='chapter2'?'chapter2':q.get('scenario')==='pressure'?'pressure':'chapter1';
        this.identity={participant:clean(q.get('participant')??'local'),order:q.get('order')==='BA'?'BA':'AB',scenario:this.scenario,round:clean(q.get('round')??'1'),
            environment:q.get('environment')==='device'?'device':'browser',platform:q.get('platform')==='Android'?'Android':q.get('platform')==='iOS'?'iOS':'desktop',model:(q.get('model')??'未登记').slice(0,80),os:(q.get('os')??'未登记').slice(0,80),host:(q.get('host')??'浏览器').slice(0,80)};
        q.set('s4test','1');q.delete('core');q.set('profile',`${this.identity.participant}-${this.scenario}-${this.identity.round}`);
        window.history.replaceState(null,'','?'+q.toString());
        super.onLoad();this.page='work';this.refresh();
        window.addEventListener('message',this.message);document.addEventListener('visibilitychange',this.visibility);
        window.addEventListener('pagehide',this.pageHide);window.addEventListener('resize',this.resize);
        this.schedule(this.publish,1);
    }
    protected afterOpen():void {
        const state=this.session.state;
        this.initialContentValid=!!state&&(state.revision===0||state.revision===1&&state.lastCommittedTxId==='s4-initialize-fixture');
        if(state&&state.revision===0){
            const fixture=cloneState(S4_FIXTURES[this.scenario][this.preset]);fixture.profileId=state.profileId;fixture.revision=1;fixture.lastCommittedTxId='s4-initialize-fixture';
            const result=this.session.store.commit(fixture);if(result.kind!=='ready')throw Error('S4 fixture could not be saved; original test bytes retained.');this.session.retry();
        }
        super.afterOpen();
        this.metrics=new S4Metrics(this.identity,this.preset,this.session.store.profile,()=>performance.now());
        this.reportKey=`s4-research-${this.session.store.profile}-${Date.now()}`;
        this.session.onCommitted=(before,after,result)=>{
            if(this.metrics&&!this.metrics.active&&!this.metrics.finished&&this.metrics.elapsedMs<600000&&result.ok&&result.effect!=='settle')this.outsideTimedChanges++;
            this.metrics?.transaction(before,after,result);
        };
    }
    onEnable():void {super.onEnable();game.on(Game.EVENT_HIDE,this.pauseResearch,this);}
    onDisable():void {this.pauseResearch();game.off(Game.EVENT_HIDE,this.pauseResearch,this);super.onDisable();}
    onDestroy():void {this.unschedule(this.publish);window.removeEventListener('message',this.message);document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pagehide',this.pageHide);window.removeEventListener('resize',this.resize);this.session.onCommitted=undefined;}
    private readonly visibility=():void=>{if(document.hidden)this.pauseResearch();};
    private readonly pageHide=():void=>{this.pauseResearch();this.publish();};
    private readonly resize=():void=>{this.viewportChanged=true;this.pauseResearch();this.cancelDrag();this.refresh();this.publish();};
    private pauseResearch():void {this.metrics?.pause();}
    private readonly message=(event:MessageEvent):void=>{
        if(event.origin!==window.location.origin||event.source!==window.parent||!this.metrics)return;
        const data=event.data as {type?:string;id?:number;review?:DragReview};
        if(data.type==='s4-start'&&this.ready&&this.session.state&&!this.session.blocked)this.metrics.start(this.session.state);
        if(data.type==='s4-pause')this.pauseResearch();
        if(data.type==='s4-finish')this.metrics.finish();
        if(data.type==='s4-review'&&Number.isInteger(data.id)&&['intended','unexpected','probe'].includes(data.review??'')){
            try{this.metrics.review(data.id!,data.review!);}catch(error){console.warn(String(error));}
        }
        this.refresh();this.publish();
    };
    update(dt:number):void {this.metrics?.frame(dt*1000);if(this.metrics&&this.metrics.elapsedMs>=600000&&!this.metrics.finished){this.metrics.finish();this.publish();}}
    protected onDragFinished(source:number,target:number,result:Result|null,cancelled:boolean):void {this.metrics?.drag(source,target,result,cancelled);}
    protected apply(result:Result):void {if(this.session.state)this.metrics?.blocked(this.session.state,result);super.apply(result);this.publish();}
    private logicalScale():number {const size=view.getVisibleSize();return Math.min(window.innerWidth/size.width,window.innerHeight/size.height);}
    private size(path:string,height:number,width?:number):void {const t=this.n(path).getComponent(UITransform)!;t.setContentSize(width??t.width,height);}
    protected refresh():void {
        super.refresh();if(!this.session?.state)return;
        this.n('Tests').active=false;this.n('Footer').active=false;this.n('FooterPaper').active=false;
        this.text('Header/Title',`香铺谣 · ${this.preset==='A_5x4'?'20':'30'}格测试`);
        this.n('Header/Title').getComponent(Label)!.fontSize=27;
        for(const p of BUTTONS){const t=this.n(p).getComponent(UITransform)!;this.size(p,Math.max(96,t.height));}
        this.n('Nav').setPosition(0,-581);this.n('QuickPending').setPosition(0,-475);
        this.n('Controls').setPosition(0,-372);
        this.size('Work/BoardPanel',570,680);this.n('Work/BoardPanel').setPosition(0,-54);
        this.n('Work/BoardPanel/Board').setPosition(0,-2);this.size('Work/BoardPanel/Board',532,640);
        this.n('Work/BoardPanel/Status').setPosition(0,282);
        this.n('Work/Goal').setPosition(0,478);this.size('Work/Goal',56);
        const goal=this.n('Work/Goal').getComponent(Label)!;goal.fontSize=18;goal.lineHeight=24;
        for(let i=0;i<3;i++){
            const p=`Work/Order${i}`;this.n(p).setPosition(this.n(p).position.x,354);this.size(p,212);
            this.n(p+'/Title').setPosition(0,80);this.n(p+'/Needs').setPosition(0,28);
            this.n(p+'/Deliver').setPosition(0,-55);this.size(p+'/Deliver',96);
            this.round(this.n(p),'#FFF6E5F5','#CDA86D',18);
        }
        this.n('Pending/ReceiveAll').setPosition(0,-372);this.n('Pending/Prev').setPosition(-221,-478);this.n('Pending/Next').setPosition(221,-478);this.n('Pending/Page').setPosition(0,-478);
        // Time injection remains available only in explicit pressure preparation, never a natural timed run.
        for(const p of ['Garden/Plus30','Garden/Plus8','Garden/Offline'])this.n(p).active=this.scenario==='pressure'&&!this.metrics?.active;
        for(const p of BUTTONS){const n=this.n(p),g=n.getComponent(Graphics);if(n.activeInHierarchy&&g){
            const c=g.fillColor,fill='#'+[c.r,c.g,c.b,c.a].map(v=>v.toString(16).padStart(2,'0')).join('');
            this.round(n,fill,'#CDA86D',14);
        }}
    }
    private publish=():void=>{
        if(!this.metrics)return;
        const scale=this.logicalScale(),rects=BUTTONS.map(path=>{const n=this.n(path),t=n.getComponent(UITransform)!;return {path,active:n.activeInHierarchy,width:t.width*scale,height:t.height*scale};});
        const report={...this.metrics.report(),ready:this.ready,recording:this.metrics.active,viewport:{width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio},viewportChanged:this.viewportChanged,
            initialContentValid:this.initialContentValid,outsideTimedChanges:this.outsideTimedChanges,runValid:this.initialContentValid&&!this.outsideTimedChanges&&!this.viewportChanged,
            boardCellLogicalPx:this.cellSize*scale,buttons:rects,layoutPreflight:rects.filter(r=>r.active&&Math.min(r.width,r.height)<48).map(r=>r.path),
            deviceVerified:false,visualAndSafetyObservation:'pending',productionBoardPreset:CONFIG.productionBoardPreset};
        window.parent.postMessage({type:'s4-report',report},window.location.origin);
        if(++this.emitCountdown%5===0||this.metrics.finished){try{sys.localStorage.setItem(this.reportKey,JSON.stringify(report));}catch(error){console.warn('S4 research export backup unavailable',error);}}
    };
}
