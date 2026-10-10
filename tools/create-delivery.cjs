const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>香铺谣 S4 交付文档</title><style>
*{box-sizing:border-box}body{margin:0;background:#eee9df;color:#343a31;font:16px/1.75 system-ui,"Microsoft YaHei",sans-serif}article{max-width:1000px;margin:32px auto;padding:48px;background:#fffdf6;border-top:8px solid #477e64}h1{font-size:32px;margin:0}h2{font-size:22px;margin-top:32px;border-bottom:1px solid #cdbd9d;padding-bottom:8px}p{margin:10px 0}.meta{color:#726d5b}.badge{display:inline-block;padding:5px 14px;background:#f5e3bc;border-radius:20px;margin:12px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{margin:0;text-align:center}img{max-width:100%;height:auto;border:1px solid #d5cbb5}figure img{width:360px}figcaption{font-size:14px;color:#686550;margin:8px 0}.shop{width:360px;display:block;margin:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;border-bottom:1px solid #ddd4c1;padding:10px}th{background:#eee9d7}a{color:#326851}code{background:#eee9df;padding:2px 5px;font-size:14px}.note{padding:14px;background:#f2eddf;border-left:4px solid #bd934a}footer{border-top:1px solid #ddd4c1;margin-top:32px;padding-top:16px;font-size:14px}@media(max-width:650px){article{padding:20px;margin:0}.grid{grid-template-columns:1fr}h1{font-size:26px}}@media print{body{background:white}article{margin:0;padding:12px;border:0}.grid{break-inside:avoid}figure{break-inside:avoid}a{color:inherit}h2{break-after:avoid}}</style></head><body><article>
<p class="meta">2026-10-10 · Cocos Creator 3.8.7 · 版本 0.4.0</p><h1>香铺谣 · S4 交付文档</h1><span class="badge">测试准备已交付 · 阶段验收待实测</span>
<p>本轮提供20格与30格两套相同内容的测试配置、独立测试档、研究埋点和记录模板。用户已确认暂时没有设备和玩家，因此不将S4标为通过；正式棋盘 <code>productionBoardPreset = null</code>。</p>
<h2>当前进展</h2><table><thead><tr><th>内容</th><th>状态</th><th>证据</th></tr></thead><tbody>
<tr><td>S1—S3：合成、经营、装扮、两章、花园与待领取</td><td>本地开发验收完成</td><td>历史真实浏览器交互、核心测试与构建</td></tr>
<tr><td>S4：20格 / 30格包、三种初始场景、隔离存档</td><td>测试准备已交付</td><td>官方Creator构建、夹具对照与隔离测试</td></tr>
<tr><td>S4：满盘、整理、占用、拖拽、效率及观察记录</td><td>已实现并做短时浏览器检查</td><td>13项准备测试与实际交互报告</td></tr>
<tr><td>S4：设备与玩家对比、最终尺寸</td><td>待实测</td><td>暂无设备/玩家记录，判定保持pending</td></tr>
<tr><td>S5：真实平台、正式时间、广告与云存档</td><td>未执行</td><td>本轮范围止于S4</td></tr></tbody></table>
<h2>实际画面：相同内容，两个棋盘</h2><p class="note">以下均为最终S4 Cocos Web Mobile包在360×640浏览器视口运行的截图，不是真机验收。压力档为显式测试夹具：18件棋盘物品、30件待领、两个地块各16件、1100铜钱及两章完成；不是本轮玩家通关结果。</p>
<div class="grid"><figure><img src="evidence/s4/a20-pressure-browser-360.jpg" alt="20格实际浏览器画面"><figcaption>A · 5列×4行，20格，18件物品，剩2格。格子60.5逻辑像素。</figcaption></figure><figure><img src="evidence/s4/b30-pressure-browser-360.jpg" alt="30格实际浏览器画面"><figcaption>B · 6列×5行，30格，同样18件物品，剩12格。格子50逻辑像素。</figcaption></figure></div>
<h2>实际店景</h2><img class="shop" src="evidence/s4/shop-browser-360.jpg" alt="S4实际店景"><p>现有场景美术、角色、灯笼、门帘和柜台均已接入运行场景。制作态与店景可以切换；实际截图发现的按钮颜色覆盖问题已修复，最终画面重新核对。</p>
<h2>已执行的验证</h2><ul><li>自动回归：S1 66/66、S2 64/64、S3 93/93、S4准备13/13，共236项通过；真实Creator引擎类型检查0错误。</li><li>官方Web Mobile构建成功，输出 <code>build/s4-web</code>、<code>build/s4-20</code>、<code>build/s4-30</code>。构建诊断保留，不声称零警告。</li><li>20格新档：实际鼠标合成并交付首单，钱包0→40；18.15秒记录，1次拖拽、1单。样本不足以判断玩家误拖率或10分钟效率。</li><li>20格压力档：批量取物只取2件，棋盘18→20、待领30→28；连续满盘取物保持28件，埋点合并为1次满盘事件。该次9.81秒压力检查不并入自然经营统计。</li><li>当前采样页面的格子/按钮预检没有不足48逻辑像素项；仍需真机核实触摸、遮挡及所有页面。浏览器窗口变化出现一次Cocos方向警告，未捕获游戏error。</li></ul>
<h2>如何测试与记录</h2><ol><li>在Creator 3.8.7打开项目，运行 <code>npm test</code>、<code>npm run typecheck</code>、<code>npm run build</code>。</li><li>运行 <code>npm start</code>，默认本机7456；若占用，可运行 <code>node tools/serve.cjs 7484</code>。入口根页面可切换A/B，<code>/20/</code>和<code>/30/</code>固定配置。</li><li>填匿名编号、AB/BA顺序、机型、系统、宿主、场景和新轮次。相同档重开恢复；新对比使用新轮次，不清旧档。先载入，再开始计时，后台自动暂停。</li><li>观察员按拖拽ID复核正常、误拖或主动试探；未复核时误拖率为null。导出JSON，并补充真实设备截图/录像、观察结果和偏好原因。</li><li>至少2台不同尺寸/性能Android及1台iPhone覆盖A/B三种场景；约10位目标玩家各版10分钟，5位先A、5位先B。</li></ol>
<h2>选型规则与仍缺的工作</h2><p>两组均需数据安全、主要格/按钮≥48逻辑像素、观察误拖率≤5%、自然满盘中位数≤2次/10分钟。只有两组通过且A效率≥B的90%、A整理最多多1次、至少6/10玩家偏好A，才选20格；其余B通过才选30格，两者均失败则修复重测。</p><p>当前缺少全部真机与目标玩家证据，因此不选定尺寸。正式服务器时间、抖音宿主、安全区/胶囊、广告和云存档也未通过；开发测试时钟明确保留。下一步仅补齐S4实测，再按证据修复和判定。</p>
<footer><a href="PROGRESS.md">完整持续进度</a> · <a href="evidence/s4/records-template.json">记录模板</a> · <a href="evidence/s4/decision.json">当前判定</a><p>持续进度以PROGRESS.md为准。源码、原图和证据在项目中；本机缓存与生成构建不属于Git源文件。</p></footer></article></body></html>`;
fs.writeFileSync(path.join(root,'S4_交付文档.html'),html);
for(const output of ['s4-web','s4-20','s4-30']){
 const dest=path.join(root,'build',output);if(!fs.existsSync(dest))continue;
 fs.writeFileSync(path.join(dest,'delivery.html'),html);fs.copyFileSync(path.join(root,'PROGRESS.md'),path.join(dest,'PROGRESS.md'));
 fs.mkdirSync(path.join(dest,'evidence/s4'),{recursive:true});
 for(const file of ['a20-pressure-browser-360.jpg','b30-pressure-browser-360.jpg','shop-browser-360.jpg','records-template.json','decision.json']){
  const src=path.join(root,'evidence/s4',file);if(fs.existsSync(src))fs.copyFileSync(src,path.join(dest,'evidence/s4',file));
 }
}
console.log('S4 illustrated delivery document generated; source and local browser copies ready.');
