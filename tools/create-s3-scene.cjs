const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),file=path.join(root,'assets/scenes/S3.scene');if(fs.existsSync(file))throw Error('S3 scene already exists; edit it rather than regenerate.');
const s=JSON.parse(fs.readFileSync(path.join(root,'assets/scenes/S2.scene'),'utf8'));
const uuid='9fc557a7-7056-49eb-9fc8-36f41aac3a05',script='8aed9716-6177-4cf1-89c2-e2939653c582';
for(const n of s)if(n._id)n._id=crypto.randomUUID();s[0]._name=s[1]._name='S3';s[1]._id=uuid;
const compIndex=s[2]._components.find(c=>!s[c.__id__].__type__.startsWith('cc.')).__id__;
function compressed(u){const h=u.replaceAll('-',''),a='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let r=h.slice(0,5);for(let i=5;i<32;i+=3){const n=parseInt(h.slice(i,i+3),16);r+=a[n>>6]+a[n&63];}return r;}
s[compIndex].__type__=compressed(script);const ref=i=>({__id__:i});
const find=p=>{let i=2;for(const n of p.split('/')){const link=s[i]._children.find(c=>s[c.__id__]._name===n);if(!link)throw Error(p);i=link.__id__;}return i;};
function component(n,type,extra={}){const i=s.length;s.push({__type__:type,_name:'',_objFlags:0,node:ref(n),_enabled:true,__prefab:null,...extra,_id:crypto.randomUUID()});s[n]._components.push(ref(i));return i;}
function node(p,name,x,y,w,h){const i=s.length,n=structuredClone(s[3]);Object.assign(n,{_name:name,_parent:ref(p),_children:[],_components:[],_layer:33554432,_id:crypto.randomUUID(),_lpos:{__type__:'cc.Vec3',x,y,z:0}});s.push(n);s[p]._children.push(ref(i));component(i,'cc.UITransform',{_contentSize:{__type__:'cc.Size',width:w,height:h},_anchorPoint:{__type__:'cc.Vec2',x:.5,y:.5}});return i;}
function label(p,name,text,x,y,w,h,size=24,color='#493725',align=1){const i=node(p,name,x,y,w,h),rgb=color.match(/\w\w/g).map(v=>parseInt(v,16));component(i,'cc.Label',{_string:text,_fontSize:size,_lineHeight:size+6,_horizontalAlign:align,_verticalAlign:1,_color:{__type__:'cc.Color',r:rgb[0],g:rgb[1],b:rgb[2],a:255},_fontFamily:'Microsoft YaHei',_isSystemFontUsed:true,_enableWrapText:true,_overflow:2,_isBold:false});return i;}
function button(p,name,text,x,y,w,h,size=24,white=false){const i=node(p,name,x,y,w,h);label(i,'Text',text,0,0,w-12,h-6,size,white?'#FFF9E8':'#493725');return i;}
const resize=(p,w,h)=>{const n=s[find(p)];s[n._components.find(c=>s[c.__id__].__type__==='cc.UITransform').__id__]._contentSize={__type__:'cc.Size',width:w,height:h};};
const shop=find('Shop'),counter=node(shop,'Counter',0,0,720,1280);s[counter]._lscale={__type__:'cc.Vec3',x:.8,y:.65,z:1};s[counter]._lpos.x=-72;s[counter]._lpos.y=64;
const counterLink=s[shop]._children.pop();s[shop]._children.splice(s[shop]._children.findIndex(c=>s[c.__id__]._name==='Customer'),0,counterLink);
s[find('Shop/GoalCard')]._lpos.y=-320;resize('Shop/GoalCard',660,174);
const chapter=s[find('Header/Chapter')];chapter._lpos.x=0;chapter._lpos.y=-36;resize('Header/Chapter',640,32);s[chapter._components.find(c=>s[c.__id__].__type__==='cc.Label').__id__]._fontSize=20;
const work=find('Work'),o=node(work,'Order2',220,344,210,170);label(o,'Title','章节订单',0,59,196,32,22,'#857351');label(o,'Needs','',0,13,196,58,24);button(o,'Deliver','交付',0,-47,184,50,22,true);
const controls=find('Work/Controls');s[find('Work/Controls/Gui')]._lpos.x=-267;resize('Work/Controls/Gui',102,70);button(controls,'Jas','茉莉',-150,0,106,70,24);s[find('Work/Controls/Spawn')]._lpos.x=38;resize('Work/Controls/Spawn',246,70);resize('Work/Controls/Spawn/Text',234,64);
const dp=find('Decor/Panel');s[find('Decor/Panel/LanternTab')]._lpos.x=-214;resize('Decor/Panel/LanternTab',196,54);resize('Decor/Panel/LanternTab/Text',184,48);s[find('Decor/Panel/CurtainTab')]._lpos.x=0;resize('Decor/Panel/CurtainTab',196,54);resize('Decor/Panel/CurtainTab/Text',184,48);button(dp,'CounterTab','柜 台',214,169,196,54,25);
const garden=node(2,'Garden',0,0,720,1280);node(garden,'Backdrop',0,0,720,1280);
for(const [id,x]of [['GUI',-170],['JAS',170]]){const p=node(garden,id,x,-102,310,234);label(p,'Title',id==='GUI'?'桂花地块':'茉莉地块',0,78,284,38,29);label(p,'Stock','0 / 16',0,28,286,46,25);label(p,'Progress','生长中',0,-22,286,40,21,'#6D654F');button(p,'Harvest','收获到待领取区',0,-78,274,54,22,true);}
const gp=node(garden,'TimePanel',0,-310,656,162);label(gp,'ClockTitle','时间与收获',0,60,600,32,24);label(garden,'Time','开发测试时间',0,-288,600,54,21,'#6D654F');label(garden,'Capacity','',0,-343,600,58,22);
button(garden,'Plus30','测试 +30分钟',-222,-414,210,48,20);button(garden,'Plus8','测试 +8小时',0,-414,208,48,20);button(garden,'Offline','模拟离线',222,-414,210,48,20);
const pending=node(2,'Pending',0,0,720,1100);node(pending,'Panel',0,-24,684,1058);label(pending,'Title','待领取',0,456,620,58,35);label(pending,'Description','',0,399,620,64,23);
for(let i=0;i<6;i++){const p=node(pending,'Row'+i,0,281-i*110,620,98);node(p,'Icon',-246,0,84,84);label(p,'Name','香品 ×1',44,16,470,42,25,'#493725',0);label(p,'Hint','点取1件',44,-24,470,34,19,'#857351',0);}
button(pending,'ReceiveAll','取出可放入数量',0,-424,618,60,25,true);button(pending,'Prev','上一页',-221,-495,174,42,20);button(pending,'Next','下一页',221,-495,174,42,20);label(pending,'Page','1 / 1',0,-495,210,36,21);
const album=node(2,'Album',0,0,720,1100);node(album,'Panel',0,-24,684,1058);label(album,'Title','香册',0,450,620,66,35);label(album,'Guide','香品第一次进入棋盘，就会记入香册。',0,389,620,56,23,'#6D654F');
for(let i=0;i<8;i++){const p=node(album,'Item'+i,(i%4-1.5)*159,221-Math.floor(i/4)*282,148,254);node(p,'Icon',0,30,132,172);label(p,'Name','未发现',0,-83,138,66,22);}
const nav=find('Nav');button(nav,'Garden','花 园',0,0,122,70,25);button(nav,'Album','香 册',264,0,122,70,25);
for(const name of ['Shop','Work','Decor']){resize('Nav/'+name,122,70);resize('Nav/'+name+'/Text',110,64);}
button(2,'QuickPending','待领取 0/30 · 查看',0,-442,656,56,23,true);
// New page layers must sit below shared header, navigation, notices, and modal.
const canvas=s[2]._children;const pages=canvas.filter(c=>['Garden','Pending','Album'].includes(s[c.__id__]._name));s[2]._children=canvas.filter(c=>!pages.includes(c));const pos=s[2]._children.findIndex(c=>s[c.__id__]._name==='Header');s[2]._children.splice(pos,0,...pages);
const quick=s[2]._children.find(c=>s[c.__id__]._name==='QuickPending');s[2]._children=s[2]._children.filter(c=>c!==quick);s[2]._children.splice(s[2]._children.findIndex(c=>s[c.__id__]._name==='Nav'),0,quick);
fs.writeFileSync(file,JSON.stringify(s,null,2));fs.writeFileSync(file+'.meta',JSON.stringify({ver:'1.1.50',importer:'scene',imported:true,uuid,files:['.json'],subMetas:{},userData:{}},null,2));
fs.writeFileSync(path.join(root,'assets/scripts/S3Game.ts.meta'),JSON.stringify({ver:'4.0.24',importer:'typescript',imported:true,uuid:script,files:[],subMetas:{},userData:{}},null,2));console.log('Created editable S3 scene; S1/S2 assets preserved.');
