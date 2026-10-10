// Add a new scene using the already validated Creator 3.8.7 camera/canvas/globals.
// Does not overwrite S1 or its asset identities. Main UI/art layers stay editable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'assets/scenes/S2.scene');
if(fs.existsSync(file))throw Error('S2 already exists. Edit its scene; do not regenerate over it.');
const scene=JSON.parse(fs.readFileSync(path.join(root,'assets/scenes/S1.scene'),'utf8')).slice(0,15);
const sceneUuid='11a75777-c943-4ca4-a18c-6043ba70d931',scriptUuid='c3843eb5-bfcd-4897-b746-91ce60532533';
scene[0]._name=scene[1]._name='S2';scene[1]._id=sceneUuid;scene[2]._children=[{__id__:3}];scene[2]._components=[5,6,7].map(i=>({__id__:i}));
const id=v=>({__id__:v});
function component(node,type,extra={}){const i=scene.length;scene.push({__type__:type,_name:'',_objFlags:0,node:id(node),_enabled:true,__prefab:null,...extra,_id:crypto.randomUUID()});scene[node]._components.push(id(i));return i;}
function node(parent,name,x,y,w,h){const i=scene.length,n=structuredClone(scene[3]);Object.assign(n,{_name:name,_parent:id(parent),_children:[],_components:[],_layer:33554432,_id:crypto.randomUUID(),_lpos:{__type__:'cc.Vec3',x,y,z:0}});scene.push(n);scene[parent]._children.push(id(i));component(i,'cc.UITransform',{_contentSize:{__type__:'cc.Size',width:w,height:h},_anchorPoint:{__type__:'cc.Vec2',x:.5,y:.5}});return i;}
function label(parent,name,text,x,y,w,h,size=24,color='#493725',align=1){const i=node(parent,name,x,y,w,h),rgb=color.match(/\w\w/g).map(v=>parseInt(v,16));component(i,'cc.Label',{_string:text,_fontSize:size,_lineHeight:size+6,_horizontalAlign:align,_verticalAlign:1,_color:{__type__:'cc.Color',r:rgb[0],g:rgb[1],b:rgb[2],a:255},_fontFamily:'Microsoft YaHei',_isSystemFontUsed:true,_enableWrapText:true,_overflow:2,_isBold:false});return i;}
function button(p,n,t,x,y,w,h,size=24,white=false){const i=node(p,n,x,y,w,h);label(i,'Text',t,0,0,w-12,h-6,size,white?'#FFF9E8':'#493725');return i;}
node(2,'Background',0,0,720,1280);
const shop=node(2,'Shop',0,0,720,1280);
node(shop,'Lantern',-74,396,120,218);node(shop,'Glow',-74,396,184,206);
node(shop,'Curtain',263,247,183,266);node(shop,'Customer',-4,-53,224,345);
label(shop,'PreviewBadge','仅预览 · 尚未摆上',0,486,362,48,24,'#FFF9E8');
const goal=node(shop,'GoalCard',0,-391,660,190);
node(goal,'Portrait',-251,0,92,128);label(goal,'Who','阿绫',-251,-58,94,26,21);
label(goal,'Goal','开张首单',-16,33,344,54,26,'#493725',0);
label(goal,'Dialogue','把两只素袋合成绣囊',-16,-21,344,55,22,'#6D654F',0);
button(goal,'Work','去制香',235,-32,150,66,25,true);
const work=node(2,'Work',0,0,720,1100);
const sheet=node(work,'Sheet',0,-42,684,1030);
label(work,'Goal','重新开张',0,479,650,62,23);
for(const [name,x] of [['Order0',-166],['Order1',166]]){const o=node(work,name,x,344,322,170);label(o,'Title','今日短单',0,59,294,32,22,'#857351');label(o,'Needs','桂花绣囊 × 1',-12,13,278,50,25);button(o,'Deliver','交付 +40',0,-47,268,50,23,true);}
const board=node(work,'BoardPanel',0,-28,656,552);label(board,'Status','同类同级拖动合成',0,248,620,30,20,'#857351');node(board,'Board',0,-24,616,486);
const ctl=node(work,'Controls',0,-367,656,76);
button(ctl,'Gui','桂花',-241,0,144,70,25);button(ctl,'Spawn','免费制香',11,0,336,70,29,true);button(ctl,'Clean','整理',255,0,106,70,24);
label(work,'Hint','相同香品拖到一起升级 · 1级可免费回收',0,-422,656,36,20,'#857351');
const decor=node(2,'Decor',0,0,720,1100),panel=node(decor,'Panel',0,-298,680,440);
button(panel,'LanternTab','灯 笼',-150,169,270,54,25);button(panel,'CurtainTab','门 帘',150,169,270,54,25);
for(let i=0;i<3;i++){const c=node(panel,'Card'+i,(i-1)*214,24,196,216);node(c,'Icon',0,23,142,142);label(c,'Name','样式',0,-57,180,32,23);label(c,'State','使用中',0,-89,180,28,20,'#857351');}
label(panel,'Condition','预览不扣铜钱',0,-115,636,46,21,'#6D654F');
button(panel,'Cancel','取消预览',-161,-172,248,60,24);button(panel,'Use','购买并摆上',135,-172,298,60,25,true);
const header=node(2,'Header',0,567,680,118);node(header,'Paper',0,0,680,118);
label(header,'Title','香 铺 谣',-144,16,330,57,43,'#493725',0);label(header,'Chapter','第一章 · 重新开张',-142,-32,334,32,23,'#857351',0);
const wallet=node(header,'Wallet',217,14,188,66);label(wallet,'Text','0 铜钱',0,0,174,56,27);
const nav=node(2,'Nav',0,-559,680,78);button(nav,'Shop','香 铺',-226,0,206,70,26);button(nav,'Work','制 香',0,0,206,70,26);button(nav,'Decor','布 置',226,0,206,70,26);
const footer=node(2,'Footer',0,-624,680,32);label(footer,'Notice','正在装好香铺…',0,0,678,38,20,'#493725');
// Only visible in explicitly isolated ?s2test=1 builds/runs.
const tests=node(2,'Tests',0,-482,652,48);button(tests,'Fault','测试中断：关闭',0,0,326,44,18);label(tests,'Profile','S2 独立验收档',0,43,652,28,18);
const modal=node(2,'Modal',0,0,720,1280);component(modal,'cc.BlockInputEvents');const mp=node(modal,'Panel',0,0,620,440);
label(mp,'Title','整理香品',0,147,578,62,33);label(mp,'Body','',0,17,570,190,25);
button(mp,'Cancel','取消',-146,-143,218,68,24);button(mp,'Confirm','确认',132,-143,252,68,25,true);
const h=scriptUuid.replaceAll('-',''),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let compressed=h.slice(0,5);for(let i=5;i<32;i+=3){const n=parseInt(h.slice(i,i+3),16);compressed+=alphabet[n>>6]+alphabet[n&63];}component(2,compressed);
fs.writeFileSync(file,JSON.stringify(scene,null,2));
fs.writeFileSync(file+'.meta',JSON.stringify({ver:'1.1.50',importer:'scene',imported:true,uuid:sceneUuid,files:['.json'],subMetas:{},userData:{}},null,2));
fs.writeFileSync(path.join(root,'assets/scripts/S2Game.ts.meta'),JSON.stringify({ver:'4.0.24',importer:'typescript',imported:true,uuid:scriptUuid,files:[],subMetas:{},userData:{}},null,2));
console.log('Created editable S2 scene; original S1 scene preserved.');
