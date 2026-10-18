# Native UI V2 迁移台账

基线：观己 v4.1.5 WebView（versionCode 113，commit `c113bcf4c7729d0978ded3f37f3ab76496334af1`）。

本台账区分“宿主/闸门已验收”和“页面视觉等价已验收”，不把脚手架完成误写成页面迁移完成。

| 条目 | 范围 | 状态 | 证据 |
| --- | --- | --- | --- |
| #273 | 单宿主 `MainActivity`、`NativeRoot`、Route/Tab/Sheet 契约、V2 静态闸门与公开 WebView 回退 | `verified`（脚手架/闸门） | `debug/visual-migration/#273-preflight.json`；`#273-device-home.png`；`#273-calendar-open.png`；`#273-after-back.png`；`#273-relaunch.png`；对应 UI 树 XML；`debug/apk-build-summary.json` |
| #274 | 共享 Tab 视觉等价迁移（当前仅经典模式） | `verified` | `docs/native-rewrite/TAB-CONTRACT-274.md`；经典模式同设备 WebView/Native 对照 `debug/#274-after-build-classic.png`；玻璃模式保留 WebView 回退并通过主题切换静态检查；`debug/#274-after-build-classic.xml`；`debug/visual-migration/#274-preflight.json` |
| #275 | 首页与日历经典模式迁移 | `verified` | `debug/visual-migration/#275-device-evidence.json`；真机首页/日历/记录 Sheet/返回与 Tab 路径证据；同状态 WebView/Native 视觉签收已通过 |
| #276 | 记录、计时、补记、详情与保存汇总经典模式迁移 | `verified` | `debug/visual-migration/#276-device-evidence.json`；直接记录/补记/编辑/详情滚动/footer/计时重启恢复/保存返回真机证据；`npm run verify:276`；`debug/apk-build-summary.json` |
| #277 | 当前洞悉页经典模式视觉等价迁移 | `verified` | 初始证据 `debug/visual-migration/#277-device-evidence.json`；补充回归 `debug/visual-migration/#277-followup-device-evidence.json`；补充回归 2 `debug/visual-migration/#277-followup2-device-evidence.json`；补充回归 3 `debug/visual-migration/#277-followup3-device-evidence.json`；补充回归 4 `debug/visual-migration/#277-followup4-device-evidence.json`（AI 卡片间距、loading 文案与左对齐恢复）；Typography 对照 `docs/native-rewrite/INSIGHT-TYPOGRAPHY-MAP-277-FOLLOWUP.md`；数据来源契约 `docs/native-rewrite/INSIGHT-DATA-SOURCE-CONTRACT-277.md`；复盘规则 `docs/native-rewrite/RECORD-277-FOLLOWUP4-RETROSPECTIVE.md`；`npm run verify:277`；v4.2.4/code122 构建摘要 |
| #278 | 我的、设置与 AI 设置经典模式视觉等价迁移；衍生收口：原生日历/记录弹层与 Tab 层级 | `verified` | 契约 `docs/native-rewrite/SETTINGS-CONTRACT-278.md`；预检 `debug/visual-migration/#278-preflight.json`；`npm run verify:278`、`npm run verify:276`；设置证据索引 `debug/visual-migration/#278-device-evidence.json`；后续校准真机证据 `debug/278-followup-settings-runtime.png/xml`、`debug/278-followup-settings-runtime-scroll.png/xml`、`debug/278-followup-settings-runtime-classic.png/xml`、`debug/278-settings-current.png/xml`、`debug/278-reminder-picker-postbuild.png/xml`、`debug/278-live-after-postbuild.png/xml`；弹层所有权收口证据 `debug/278-impl-record.png/xml`、`debug/278-impl-record-closed.png/xml`、`debug/278-impl-tab-under-home.png`；用户已完成 #278 视觉验收，后续任务按同树 Tab/Sheet 规则继续 |
| #279 | 备份首页、WebDAV 配置、本机文件管理、恢复来源与经典模式路由 | `verified` | `docs/native-rewrite/BACKUP-RESTORE-CONTRACT-279.md`；`debug/visual-migration/#279-preflight.json`；`debug/visual-migration/#279-device-evidence.json`；`npm run verify:279`；用户视觉验收；`debug/apk-build-summary.json` |
| #280 | 默认入口、分领域 Gateway、revision 去重与稳定性观察 | `implemented_pending_stability_signoff` | `docs/native-rewrite/GATEWAY-CONTRACTS-280.md`；`debug/visual-migration/#280-preflight.json`；`debug/visual-migration/#280-device-evidence/`；`debug/visual-migration/#280-stability-round1/`；`debug/visual-migration/#280-stability-round2/`；`debug/visual-migration/#280-p6-elastic-20260922/p6-report.json`（P6 弹性布局收口通过）；`docs/native-rewrite/VC2-FONT-ADMISSION-280.md`；`debug/visual-migration/#280-p6-vc0-20260922/vc2-font-admission-report.json`；`docs/native-rewrite/VC2.1-FONT-CONSISTENCY-RECHECK-280.md`；`debug/visual-migration/#280-p6-vc0-20260922/vc2.1-font-consistency/vc2.1-font-consistency-report.json`；`debug/visual-migration/#280-p6-vc0-20260922/vc2.1-font-consistency/vc2.1-rendered-font-report.json`（三设备归一化完成，但 OnePlus 字形覆盖差异 13.79%，进入字体候选阻断）；`docs/native-rewrite/VC2.2-FONT-CANDIDATE-ADMISSION-280.md`；`debug/visual-migration/#280-p6-vc0-20260922/vc2.2-font-candidate-admission/vc2.2-font-candidate-report.json`（Noto 已选；API24 改为静态兼容审查并明确接受运行时残余风险）；`docs/native-rewrite/VC3-T2-TYPOGRAPHY-280.md`；`docs/native-rewrite/VC3-T3-TYPOGRAPHY-280.md`；`debug/visual-migration/#280-p6-vc0-20260922/vc3-t2-typography/vc3-t2-typography-report.json`；`debug/visual-migration/#280-p6-vc0-20260922/vc3-t3-typography/vc3-t3-typography-report.json`；`debug/visual-migration/#280-p6-vc0-20260922/vc3-internal/vc3-internal-report.json`；`debug/visual-migration/#280-p5-regression-20260922/p5-report.json`（T0–T3 静态角色与两台魅族只读回归通过，OnePlus 按计划延后）；`debug/visual-migration/#280-p6-vc0-20260922/vc3-t1-typography/vc3-t1-typography-report.json`；`debug/verify-280-settings-regression.cjs`；`npm run verify:280:p6`；`debug/apk-build-summary.json`。VC3-T0–T3 当前为两台魅族内部通过、待 OnePlus 最终同 fixture 对照；VC0–VC6 仍为独立视觉阻断分支，未通过前不改为 verified。 |
| #281 | 经典版 JS 核心收口与最终原生化验收 | `pending` | #280 两轮稳定性签收后实施 |

## #280 VC3-R2 当前字体迁移状态（2026-09-29）

- **状态**：`implementation_in_progress`; 旧 T0～T3 与 2026-09-22 静态字体三设备报告是历史证据，不代表变量字体重验收通过。
- **决策**：完整替代静态字体方案；最低 Android API 26；只嵌入官方 Noto Sans SC Sans2.004 Variable TTF；`NativeTypography` 按真实 `wght` 轴注册 400/500/600/650/700/750/800；继续 `FontSynthesis.None`。
- **P0**：`debug/visual-migration/#280-vc3-r2/baseline-static-api24/` 已封存 4.2.11/code133、minSdk24 APK 与三份静态字体，供 API24 最后兼容与回滚。
- **P1**：固定 tag 资产哈希 `D68BAFCB48A2707749396AA12BBBD833CB70401F3A9A689FD2902C7E0D295964`，`wght 100–900`、31,036 glyphs；自动扫描 Native Kotlin/XML 88 个文件中的 847 个 UI 汉字/标点，缺字 0；OFL 完整文本、NOTICE 和应用内入口静态对照通过。
- **P2/P3/P4 静态实施**：minSdk 已设为 26；生产 `res/font` 仅保留变量 TTF，三份静态 OTF 已在 P0 路径留存；`NativeTypography` 按 400/500/600/650/700/750/800 注册同值 wght 轴，`FontSynthesis.None` 保留；专项变量字体闸门通过，T0–T3 历史闸门已改为变量字体合同且报告写入 R2 独立目录。
- **待完成**：4.2.12/code134 Compose 编译、T0～T3 新字体真机重验收、两台魅族/OnePlus/API26 运行、旧版覆盖安装与数据保留、包体/启动/内存测量及许可证运行可达性。
- **后续约束**：VC4 重新冻结变量字体截图/bounds；VC5 增加 API26/字体缓存/进程/多字重/升级回归；VC6 与 #281 更新最低系统、NOTICE、最后 API24 APK 与唯一 NativeTypography 字体事实源。未完成 R2 前不得签收 VC3、VC0～VC6 或 #280。

## 当前统一材质范围（2026-09-15）

- #275–#280：NativeRoute 只接管经典/普通模式（浅色、深色、降低透明度回退）；玻璃模式继续由既有 WebView 唯一渲染，玻璃 Native 不在这些条目的验收范围内。
- #281：删除全部旧 JS 核心业务后，不保留玻璃 WebView 核心回退；玻璃请求在后置原生玻璃计划完成前安全回落到已验收的 Native 经典界面，避免空壳或双宿主。
- #281 之后：玻璃 Native 作为独立任务重新测绘、重新编号、重新建立视觉契约和验收证据，直接从 Native 经典界面重构，不复制旧 WebView 玻璃实现。

## #273 验收边界

- 仅验收单宿主、隐藏原生区域、调试开关和 WebView 公开路径；未迁移任何完整业务页面。
- 真机证据来自设备 `[序列号已省略]`，包名 `com.guanji.app`，v4.2.0 / versionCode 114，Android Debug 签名。
- “视觉等价”只对未来实际迁移的页面签收；#273 不改变 WebView 的视觉和业务所有权。

## #280 VC3 最终三设备签收（2026-09-22）

- VC3-T0/T1/T2/T3 已完成 Noto Sans CJK SC 语义 Typography 映射；字体资源、OFL-1.1 许可证、`FontSynthesis.None` 与源码角色闸门均通过。
- 受最多两台设备在线限制，先完成魅族 18s + 魅族 21 批次，再完成魅族 18s + OnePlus PLZ110 批次；`npm run verify:280:vc3:final` 已将两批同一 `4.2.10/code132`、同一只读 fixture 的证据合并校验。
- 最终报告：`debug/visual-migration/#280-p6-vc0-20260922/vc3-final/vc3-final-report.json`，状态 `passed_three_device_same_fixture`；覆盖冷/热/强制停止生命周期及 home/calendar/record/timer/insight/settings/backup/input-sheet 路线。
- VC3 现已从“等待 OnePlus”推进到“最终运行时通过”。“我的 → App 介绍 → 开源软件许可”入口及 SQLCipher/Noto 的本地完整许可文本已加入源码；仍待构建后确认运行时可达、确认发行材料包含 `NOTICE`，并完成更完整的直接/传递依赖许可清单与字体性能收尾。#280 仍保持 `implemented_pending_stability_signoff`，VC0–VC6 其他独立阻断分支也尚未全部签收。
