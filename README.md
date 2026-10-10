# 香铺谣 · The Perfume Shop Ballad

Cocos Creator **3.8.7** / TypeScript 的合成经营游戏工程，当前开发版本 **0.4.0**。

S1—S3 已完成本地开发验收。S4 已提供 20 格 / 30 格测试构建、相同内容的独立测试档、埋点和记录模板；**真机与玩家实测尚未执行，正式棋盘配置仍为 `null`**。当前使用明确标识的开发测试时钟，尚未接入正式时间服务、抖音宿主、广告和云存档。

## 实际运行画面

下图是 S4 Cocos Web Mobile 构建在 360×640 浏览器视口中的截图，使用显式开发压力测试档；不是手机验收，也不是玩家通关记录。

<img src="evidence/s4/shop-browser-360.jpg" alt="S4 实际店景" width="300">

| A：20 格 | B：30 格 |
| --- | --- |
| <img src="evidence/s4/a20-pressure-browser-360.jpg" alt="20格压力测试" width="280"> | <img src="evidence/s4/b30-pressure-browser-360.jpg" alt="30格压力测试" width="280"> |

两图初始内容一致：棋盘 18 件、待领取 30 件、两个花园地块各 16 件。仅棋盘与对应布局不同，A 剩 2 格、B 剩 12 格。

## 打开与运行

1. 用 Cocos Creator 3.8.7 打开仓库根目录，等待资源导入与引擎类型生成。
2. 打开 `assets/scenes/S4.scene`。S1、S2、S3 场景也保留在工程中。
3. Windows 下安装 Node.js 后执行：

```powershell
npm test
npm run typecheck
npm run build
npm start
```

构建脚本默认使用 `C:\ProgramData\cocos\editors\Creator\3.8.7`。若安装位置不同，可向 `tools/build.ps1` 传入 `-CreatorRoot`。类型检查及核心测试工具也使用该默认安装目录中的 TypeScript；其他安装环境需相应调整工具路径。

本地服务默认 `http://127.0.0.1:7456/`，固定 20 格入口 `/20/`，固定 30 格入口 `/30/`。若端口占用，执行 `node tools/serve.cjs 7484`。服务默认仅绑定本机。

`npm run build` 生成 `build/s4-web`、`build/s4-20`、`build/s4-30`；构建目录与 Creator 缓存不提交，克隆后需在 Creator 中重新导入和构建。

## 交付与验证

- [持续进度与完整验收记录](PROGRESS.md)
- [分阶段开发规格](香铺谣_分阶段开发规格与Codex步骤.md)
- [S4 图文交付文档](S4_交付文档.html)（下载后用浏览器打开，图片位于同仓库 `evidence/s4`）
- [S4 测试记录模板](evidence/s4/records-template.json)
- [S4 当前选型结果：待实测](evidence/s4/decision.json)

2026-10-10 自动回归：S1 66/66、S2 64/64、S3 93/93、S4 准备 13/13，共 **236/236**；真实 Creator 引擎类型检查 **0 错误**。官方 Web Mobile 构建已成功，相关原始日志保留在本机 `evidence`，未将机器诊断日志纳入仓库。

短时浏览器输入已检查首单合成交付、部分取物与满盘事件去重。尚缺至少两台不同尺寸/性能 Android、一台 iPhone，以及约十位目标玩家的 A/B 各十分钟记录。浏览器结果和单元测试不能替代这些验收。

## 目录

- `assets/`：可编辑场景、游戏逻辑及接入美术，保留 `.meta` 资源身份。
- `Image/`：用户提供的原始美术参考。
- `tools/`：构建、测试、测试夹具生成、记录判定与本地服务。
- `settings/`：Cocos 工程设置。
- `evidence/`：测试 JSON、实际截图与待填模板。

主线档与 S1—S4 测试档隔离；未知格式存档受保护，不通过降容截断或清档解决兼容问题。
