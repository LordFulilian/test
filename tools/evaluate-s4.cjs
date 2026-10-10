const fs=require('node:fs'),path=require('node:path');
const median=values=>{const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null;};
function evaluate(input){
    const rows=input.runs??[],missing=[],failures=[];
    const verified=rows.filter(r=>r.identity?.environment==='device'&&r.observation?.deviceVerified===true&&r.observation.evidence&&['Android','iOS'].includes(r.identity.platform));
    const deviceKeys=[...new Set(verified.map(r=>`${r.identity.platform}:${r.identity.model}`))];
    const android=deviceKeys.filter(k=>k.startsWith('Android:')),ios=deviceKeys.filter(k=>k.startsWith('iOS:'));
    if(android.length<2)missing.push('至少2台不同尺寸/性能Android，附真实证据');if(!ios.length)missing.push('至少1台iPhone，附真实证据');
    for(const key of deviceKeys)for(const preset of ['A_5x4','B_6x5'])for(const scenario of ['chapter1','chapter2','pressure'])
        if(!verified.some(r=>`${r.identity.platform}:${r.identity.model}`===key&&r.preset===preset&&r.identity.scenario===scenario))missing.push(`${key} ${preset} ${scenario} 未实测`);
    if(!verified.some(r=>r.viewport?.width>=350&&r.viewport?.width<=370))missing.push('实际约360逻辑像素窄屏证据');
    const natural=verified.filter(r=>r.identity.scenario==='chapter1'&&r.completeTenMinutes&&r.finished&&r.effectiveMs>=600000);
    const ids=[...new Set(natural.map(r=>r.identity.participant))],pairs=[];
    for(const id of ids){const a=natural.filter(r=>r.identity.participant===id&&r.preset==='A_5x4'),b=natural.filter(r=>r.identity.participant===id&&r.preset==='B_6x5');
        if(a.length!==1||b.length!==1){missing.push(`${id} 每版需唯一一份完整10分钟记录`);continue;}
        if(a[0].identity.order!==b[0].identity.order){missing.push(`${id} AB/BA顺序不一致`);continue;}pairs.push([a[0],b[0]]);}
    if(pairs.length!==10)missing.push('10位玩家完整配对记录');
    if(pairs.filter(p=>p[0].identity.order==='AB').length!==5||pairs.filter(p=>p[0].identity.order==='BA').length!==5)missing.push('5位AB、5位BA平衡顺序');
    const prefs=new Map();for(const p of input.preferences??[])if(prefs.has(p.participant))missing.push(`偏好重复:${p.participant}`);else prefs.set(p.participant,p);
    for(const [a] of pairs)if(!['A','B'].includes(prefs.get(a.identity.participant)?.choice)||!prefs.get(a.identity.participant)?.reason)missing.push(`${a.identity.participant} 缺偏好及原因`);
    const status={};for(const preset of ['A_5x4','B_6x5']){
        const tested=verified.filter(r=>r.preset===preset),player=pairs.map(p=>p[preset==='A_5x4'?0:1]),errors=[];
        for(const r of tested){if(r.observation.safety!=='pass')errors.push(`${r.identity.model}/${r.identity.scenario}: 数据/展示观察未通过`);
            if(!Number.isFinite(r.boardCellLogicalPx)||r.boardCellLogicalPx<48||!Array.isArray(r.layoutPreflight)||r.layoutPreflight.length)errors.push('格子/主要按钮不足48逻辑像素');
            if(r.viewportChanged)errors.push('计时期间视口改变，需重测');
            if(r.runValid!==true)missing.push(`${r.identity.model}/${r.identity.scenario}: 初始档或计时外操作不符合对照要求`);}
        for(const r of player){if(r.unreviewed||!Number.isFinite(r.misdragRate))missing.push(`${preset}/${r.identity.participant} 拖拽观察未完整复核`);
            else if(r.misdragRate>.05)errors.push('观察误拖率超过5%');
            if(![r.orders,r.fullEvents,r.cleaning].every(v=>Number.isFinite(v)&&v>=0))missing.push('缺少经营指标');}
        const fullMedian=median(player.map(r=>r.fullEvents));if(fullMedian!==null&&fullMedian>2)errors.push('自然满盘阻塞中位数超过每10分钟2次');
        status[preset]={passed:tested.length>0&&player.length===10&&!errors.length,fullMedian,orderMedian:median(player.map(r=>r.orders)),cleanMedian:median(player.map(r=>r.cleaning)),errors};failures.push(...errors.map(e=>preset+': '+e));
    }
    let selected=null;
    if(!missing.length){const a=status.A_5x4,b=status.B_6x5;
        if(a.passed&&b.passed&&a.orderMedian>=b.orderMedian*.9&&a.cleanMedian<=b.cleanMedian+1&&pairs.filter(([r])=>prefs.get(r.identity.participant)?.choice==='A').length>=6)selected='A_5x4';
        else if(b.passed)selected='B_6x5';}
    return {status:missing.length?'pending':selected?'passed':'failed',productionBoardPreset:selected,missing:[...new Set(missing)],failures,statusByPreset:status,
        evidence:'Observer-confirmed physical-device records only; browser/unit data never establish acceptance.'};
}
module.exports={evaluate};
if(require.main===module){const inputFile=process.argv[2]??path.join(__dirname,'../evidence/s4/records-template.json'),input=JSON.parse(fs.readFileSync(inputFile,'utf8')),result=evaluate(input);
    fs.mkdirSync(path.join(__dirname,'../evidence/s4'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../evidence/s4/decision.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
