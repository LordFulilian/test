// Start from the installed Creator's official 2D scene template, preserving the
// camera/canvas/globals format. All major layout and text nodes are editable assets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const creator = process.env.COCOS_CREATOR_ROOT || 'C:/ProgramData/cocos/editors/Creator/3.8.7';
const templateRoot = path.join(creator, 'resources/templates/empty-2d');
const sceneUuid = 'dc7b9945-3b9e-4d65-ab81-508612d361c1';
const scriptUuid = '29b6a8d2-ffbb-4d4c-aa2c-479f48b1376b';
const compress = uuid => { const h = uuid.replaceAll('-', ''); const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let result = h.slice(0, 5); for (let i = 5; i < 32; i += 3) { const n = parseInt(h.slice(i, i + 3), 16); result += alphabet[n >> 6] + alphabet[n & 63]; } return result; };
function write(file, data) { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); }
for (const dir of ['settings', '.creator']) fs.cpSync(path.join(templateRoot, dir), path.join(root, dir), { recursive: true });
const scene = JSON.parse(fs.readFileSync(path.join(creator, 'resources/resources/3d/engine/editor/assets/default_file_content/scene/scene-2d.scene'), 'utf8'));
scene[0]._name = scene[1]._name = 'S1'; scene[1]._id = sceneUuid;
scene[2]._lpos.x = 360; scene[2]._lpos.y = 640;
scene[5]._contentSize = { __type__: 'cc.Size', width: 720, height: 1280 };
scene[4]._color = { __type__: 'cc.Color', r: 251, g: 246, b: 233, a: 255 };
const id = v => ({ __id__: v });
function component(node, type, extra = {}) {
    const index = scene.length;
    scene.push({ __type__: type, _name: '', _objFlags: 0, node: id(node), _enabled: true, __prefab: null, ...extra, _id: crypto.randomUUID() });
    scene[node]._components.push(id(index)); return index;
}
function node(parent, name, x, y, w, h) {
    const index = scene.length; const n = structuredClone(scene[3]);
    n._name = name; n._parent = id(parent); n._children = []; n._components = [];
    n._lpos = { __type__: 'cc.Vec3', x, y, z: 0 }; n._layer = 33554432; n._id = crypto.randomUUID();
    scene.push(n); scene[parent]._children.push(id(index));
    component(index, 'cc.UITransform', { _contentSize: { __type__: 'cc.Size', width: w, height: h }, _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } });
    return index;
}
function label(parent, name, text, x, y, w, h, size = 24, color = '#354B45', align = 1) {
    const index = node(parent, name, x, y, w, h);
    const rgb = color.match(/\w\w/g).map(s => parseInt(s, 16));
    component(index, 'cc.Label', { _string: text, _fontSize: size, _lineHeight: size + 8, _horizontalAlign: align,
        _verticalAlign: 1, _color: { __type__: 'cc.Color', r: rgb[0], g: rgb[1], b: rgb[2], a: 255 },
        _fontFamily: 'Microsoft YaHei', _isSystemFontUsed: true, _enableWrapText: true, _overflow: 2, _isBold: false });
    return index;
}
function button(parent, name, text, x, y, w, h, size = 24, white = false) {
    const index = node(parent, name, x, y, w, h);
    label(index, 'Text', text, 0, 0, w - 8, h - 4, size, white ? '#FFFFFF' : '#354B45');
    return index;
}
node(2, 'Background', 0, 0, 720, 1280);
const header = node(2, 'Header', 0, 538, 656, 112);
label(header, 'Kicker', '江南一隅 · 慢慢制香', -125, 32, 380, 30, 22, '#89948B', 0);
label(header, 'Title', '香 铺 谣', -125, -15, 380, 64, 46, '#354B45', 0);
const wallet = node(header, 'Wallet', 215, 0, 190, 64);
label(wallet, 'Text', '0 铜钱', 0, 0, 180, 50, 27);
const order = node(2, 'OrderCard', 0, 367, 656, 192);
label(order, 'Kicker', '今日短单  /  无倒计时', -88, 63, 414, 30, 22, '#89948B', 0);
label(order, 'Needs', '桂花绣囊 × 1', -78, 9, 440, 52, 29, '#354B45', 0);
label(order, 'Reward', '交付得20铜钱 / 已交0单', -85, -55, 430, 36, 22, '#89948B', 0);
button(order, 'Deliver', '交付订单', 224, 0, 164, 78, 25, true);
const board = node(2, 'BoardPanel', 0, -16, 656, 560);
label(board, 'Status', '同类同级拖动合成', 0, 240, 620, 30, 22, '#7F897C');
node(board, 'Board', 0, -28, 616, 486);
const controls = node(2, 'Controls', 0, -365, 656, 132);
button(controls, 'Gui', '桂花', -242, 28, 138, 64);
button(controls, 'Jas', '茉莉·未开放', -75, 28, 176, 64, 22);
button(controls, 'Spawn', '免费出货', 144, 28, 234, 64, 28, true);
button(controls, 'Clean', '整理', 257, -51, 104, 50, 23);
label(controls, 'Hint', '1级免费回收 · 寄售 5 / 12 / 30 铜钱', -59, -52, 460, 32, 20, '#89948B', 0);
const tests = node(2, 'Tests', 0, -497, 656, 112);
label(tests, 'Profile', 'S1独立测试档 · 正式棋盘待S4确定', 0, 29, 632, 30, 18, '#89948B');
button(tests, 'Preset', '切换20 / 30格', -204, -21, 204, 48, 20);
button(tests, 'Chain', '切换测试香型', 1, -21, 192, 48, 20);
button(tests, 'Fault', '中断：关闭', 205, -21, 202, 48, 20);
const footer = node(2, 'Footer', 0, -591, 656, 70);
label(footer, 'Notice', '把相同的香袋拖到一起', 0, 19, 654, 46, 21, '#427E6F');
label(footer, 'Save', '本地双槽存档', 0, -23, 654, 28, 17, '#89948B');
const modal = node(2, 'Modal', 0, 0, 720, 1280);
component(modal, 'cc.BlockInputEvents');
const panel = node(modal, 'Panel', 0, 0, 600, 410);
label(panel, 'Title', '整理香品', 0, 135, 560, 56, 34);
label(panel, 'Body', '', 0, 14, 550, 166, 25);
button(panel, 'Cancel', '取消', -137, -128, 210, 66);
button(panel, 'Confirm', '确认整理', 130, -128, 238, 66, 26, true);
component(2, compress(scriptUuid));
write('assets/scenes/S1.scene', scene);
write('assets/scenes/S1.scene.meta', { ver: '1.1.50', importer: 'scene', imported: true, uuid: sceneUuid, files: ['.json'], subMetas: {}, userData: {} });
write('assets/scripts/S1Game.ts.meta', { ver: '4.0.24', importer: 'typescript', imported: true, uuid: scriptUuid, files: [], subMetas: {}, userData: {} });
write('settings/v2/packages/project.json', { __version__: '1.0.0', general: { designResolution: { width: 720, height: 1280, fitWidth: true, fitHeight: true } } });
write('settings/v2/packages/scene.json', { __version__: '1.0.0', 'current-scene': sceneUuid });
write('profiles/v2/packages/scene.json', { 'gizmos-infos': { is2D: true }, 'current-scene': sceneUuid });
write('build-config.json', { name: '香铺谣 S1', platform: 'web-mobile', buildPath: 'project://build', outputName: 's1-web',
    startScene: sceneUuid, scenes: [{ url: 'db://assets/scenes/S1.scene', uuid: sceneUuid }], debug: true,
    sourceMaps: true, md5Cache: false, orientation: 'portrait', webDebug: false,
    packages: { 'web-mobile': { __version__: '1.0.0', embedWebDebugger: false, mainBundleCompressionType: 'merge_dep' } } });
console.log('Created Creator 3.8.7 scene from official 2D template: assets/scenes/S1.scene');
