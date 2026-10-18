# #277 补充回归 4 复盘与防回归规则

日期：2026-09-16<br>
基线：v4.1.5 WebView 经典/普通模式<br>
实施版本：v4.2.4 / versionCode 122<br>
范围：洞悉页 AI 增强观察卡片的间距、局部 loading 状态和复用/验收流程

## 1. 结论摘要

本轮并不是“重新制作 AI 卡片”，而是对已经冻结的洞悉卡片做两个局部校准：

1. 卡片内边距、标题/介绍/动作区/免责声明间距回到 WebView 的可测量值；
2. 重新生成时只替换原按钮所在的动作区，保留已有分析和介绍，显示左对齐 spinner + 灰色提示文案，暂时隐藏免责声明。

功能、数据源、AI owner、缓存协议和页面宿主均未改变。真正需要沉淀的不是本轮的 22dp 或 16dp 数值，而是“数值有来源、状态只局部替换、证据要等待语义状态确认、工具回执要验证最终状态”这四条工程规则。

## 2. 本轮问题分类与根因

### 2.1 视觉契约没有完全落到状态级

**现象**：原生卡片内边距和上下间距曾沿用旧的 16dp/12dp 猜测值；WebView 的动作区与其他洞悉卡片起始线不一致。<br>
**根因**：已有 #277 规则说明了“复用动作区”，但没有在每个状态中冻结 CSS `padding/margin/gap/min-height` 到 Compose token 的映射；实现者容易把“相近”当成“等价”。<br>
**修复**：从 WebView computed CSS 取得 22px、12px、16px、46px 等值，同时调整 `NativeInsightSurface` 和 `screens.css`，让两个实现共享同一组可追溯参数。<br>
**防复发**：任何视觉常量必须带 selector、computed style/bounds 或截图证据；没有来源的 `Spacer`、`padding`、`size` 不得进入迁移代码。

### 2.2 异步 loading 只做了“能转”，没有还原状态机

**现象**：原生点击重新生成后只有 spinner；介绍文字消失，按钮位置没有完整的 loading 行，卡片结构发生跳变。<br>
**根因**：把 `loading` 当成整张卡片的替代页面，而不是 `Header / Analysis / Intro / ActionArea / Disclaimer` 中的局部状态；没有把 WebView 的“内容保留、动作区替换、声明隐藏”写成显式契约。<br>
**修复**：新增 `InsightLoadingState`，固定动作区 46dp，只替换动作区；保留分析和介绍，隐藏免责声明；WebView 同步显示 spinner 与“正在生成 AI 增强观察…”文案。<br>
**防复发**：AI 卡片必须使用局部状态表；除非 WebView 明确清空，否则 loading 不得清空已有内容；正常/加载/成功/失败均要检查高度和内容保留。

### 2.3 运行时截图与 UI dump 的采样时序不可靠

**现象**：真机 140ms 截图仍显示就绪态，而约 250ms 的 UI dump 已进入 loading；固定等待和单张截图会得出相互矛盾的结论。<br>
**根因**：异步重组、动画和桥接请求不是固定时长；以“点击后睡眠 N 毫秒”代替等待可验证的语义状态。<br>
**修复**：以 UI 树中 `正在生成 AI 增强观察…`、按钮消失、免责声明隐藏作为 loading 判定，再保存截图；完成态以“重新生成分析”和免责声明恢复作为终止条件。<br>
**防复发**：证据采集必须“轮询语义条件 → 再截图”，并记录采样延迟；固定 sleep 只能作为轮询间隔，不能作为验收条件。截图、UI dump 和状态日志必须共享同一 evidence id。

### 2.4 浏览器动态 fixture 不足

**现象**：隔离浏览器可以读取 WebView DOM/CSS，但没有 AI-ready 数据，无法真实点击 loading。<br>
**根因**：静态视觉基线与动态状态 fixture 没有一起维护；页面可打开不代表每个状态都可触发。<br>
**防复发**：为洞悉页维护 `empty / ready / loading / ready-after` 四种确定性 fixture；没有 fixture 时，动态浏览器验证必须明确标记为未执行，不得写成“浏览器已通过”。可由真机证据补齐，但不能省略状态契约。

### 2.5 历史验证器与版本线脱节

**现象**：旧 `verify:274` 仅接受 versionCode 115–119，推进到 122 后把正常迁移误判为失败。<br>
**根因**：验证器把某次实施的版本号写成永久常量，没有区分“当前版本”与“历史范围”。<br>
**修复**：验证器改为接受当前 4.2.x 迁移线，并同步更新 #277 断言到 code122/CSS195/JS206。<br>
**防复发**：版本断言必须从 manifest/迁移台账读取，或显式维护“允许的当前迁移线 + 历史最低边界”；每次 versionCode、缓存标记或路线变更必须同提交更新 verifier。

### 2.6 构建、安装与页面验收曾被混在一起

**现象**：如果把“源码改完”误认为“原生迁移完成”，容易跳过稳定构建、真机安装和同状态对照。<br>
**根因**：任务完成条件、APK 产物状态和视觉验收证据没有分层。<br>
**防复发**：严格按 `preflight → 实现 → 静态验证 → build hook → 真机证据 → 台账签收` 顺序；任何一层失败，只能标记“功能完成/待视觉修复”，不得升级下一节点或发布。

### 2.7 Dify HTTP 200 被误认为上传完成

**现象**：本轮 REST 上传返回 HTTP 200 和 document id，但 DashScope embedding 出现 `SSLEOFError`，最终索引状态为 `error/error`。<br>
**根因**：上传接收（receipt）与异步索引（indexing）是两个阶段，HTTP 状态只证明文件被接收，不证明可检索。<br>
**防复发**：上传后必须轮询到 `completed/available`，再抽样检索或校验分段；`error` 必须记录 provider、错误文本和 document id，保留本地报告并允许幂等重试，不得写“知识库上传成功”。

### 2.8 复用边界没有及时回写

**现象**：本轮实际复用了 #277 的 AI owner、缓存和 46dp 动作区，但实施报告一度写成“无索引更新”。<br>
**根因**：没有区分“一次性微调”与“可跨任务复用的状态/证据规则”。<br>
**修复**：本复盘将“语义状态采样、局部 loading、最终索引验收、版本断言同步”提升为共享规则；22dp 等页面专属数值仍留在页面契约中。<br>
**防复发**：收尾时必须回答“本轮是否产生跨页面可复用规则”，并同步 `REUSE-RULES.md`、迁移清单和报告；若没有，报告也要明确说明理由。

## 3. 可复用实施闭环

以后任何 WebView → Compose 页面或状态迁移，必须按以下闭环执行：

```text
冻结 WebView 状态与参数
  → 建立 selector/CSS/bounds/token 对照
  → 定义状态机与 owner
  → 只实现允许的局部变化
  → 静态闸门
  → 语义状态轮询的浏览器/真机证据
  → 构建摘要与签名校验
  → 回归清单
  → 更新复用索引、台账和报告
```

### 3.1 视觉参数规则

- CSS `padding/margin/gap/line-height/min-height`、运行时 bounds 和动效采样必须能映射到 Compose token。
- token 至少记录：名称、WebView selector、CSS/computed 值、单位转换、Compose 用途和证据路径。
- 同一组件只能有一个 owner；页面专属变体必须命名，不能在 Composable 内复制匿名常量。
- `dp`/`px` 的数值相同不代表视觉等价，必须在相同 viewport、density、fontScale 下对照。

### 3.2 异步 UI 证据规则

- 为每个异步区域定义 `idle → loading → success/cache → error` 的可观察标记。
- loading 默认保留稳定内容，只替换 WebView 明确替换的区域；固定区域高度，避免 Layout Shift。
- 采集器先轮询语义标记，再截屏；同时保存 XML/DOM、截图、时间戳和触发动作。
- 完成态要验证新内容、原动作和声明恢复；失败态要验证旧可信内容不被覆盖。

### 3.3 版本、缓存和验证器规则

- versionName、versionCode、HTML CSS/JS cache marker、verifier 断言和报告必须同一变更集同步。
- 历史 verifier 不得锁死已结束版本；要么读取当前 manifest，要么维护明确的迁移线范围。
- 任一 verifier 失败先判断是代码回归还是断言过期，禁止通过删除断言掩盖问题。

### 3.4 构建与知识库规则

- APK 只经 `tools/build-apk.ps1`，使用摘要中的包名、版本、签名和 SHA-256 作为产物事实。
- 知识库采用“接收 → 索引 → 可检索”三阶段回执；任何中间状态都不能写成完成。
- 外部服务失败不阻塞本地实施收尾，但必须留下可重试的唯一文件名、错误信息和本地路径。

## 4. #277 补充回归清单

- [ ] WebView 与 Native 的卡片内边距、标题/介绍/动作/声明间距有 CSS→Compose 对照。
- [ ] 初始、加载、成功、失败四态均有 DOM/Compose 状态证据。
- [ ] loading 显示 spinner + “正在生成 AI 增强观察…”，并与上下文左对齐。
- [ ] loading 时已有分析和介绍保留，免责声明隐藏，动作区高度不跳变。
- [ ] 成功后按钮、免责声明和新分析恢复；失败不覆盖旧可信报告。
- [ ] 语义状态确认后再截图，截图与 XML/DOM 使用同一 evidence id。
- [ ] 无 AI-ready fixture 时报告明确“浏览器动态点击未执行”，并以真机证据补齐。
- [ ] `verify:272`、`verify:native-ui-v2:preflight -- 277`、`verify:277` 及受影响历史回归通过。
- [ ] versionCode、CSS/JS marker 和 verifier 断言一致。
- [ ] 构建摘要、签名、安装和真机回归记录齐全。
- [ ] Dify 索引最终为 `completed/available`；否则标记失败并保留本地报告。
- [ ] 本轮产生的跨页面规则已更新 `docs/REUSE-RULES.md` 和迁移台账。

## 5. 关联资产

- `docs/native-rewrite/INSIGHT-DATA-SOURCE-CONTRACT-277.md`
- `docs/native-rewrite/INSIGHT-TYPOGRAPHY-MAP-277-FOLLOWUP.md`
- `docs/native-rewrite/RECORD-276-RETROSPECTIVE.md`
- `docs/native-rewrite/NATIVE-MIGRATION-CHECKLIST.md`
- `docs/native-rewrite/MIGRATION-GATE.md`
- `debug/visual-migration/#277-followup4-device-evidence.json`
- `outputs/guanji-app_实施v4.2.4_#277-补充4_2026-09-16.md`
