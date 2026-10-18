# UI 原生化 V1 资产盘点

盘点日期：2026-09-14

## 1. 稳定基线

V2 从以下稳定点开始：

```text
commit       c113bcf4c7729d0978ded3f37f3ab76496334af1
versionName  4.1.5
versionCode  113
package      com.guanji.app
```

该基线已经完成 Kotlin 统计/行为模型、Room 权威记录链以及 #253/#254 的旧 observations 和日期迁移修复。V2 不重新实现这些能力。

## 2. 旧工作区规模

旧工作区相对 v4.1.5 包含：

- 39 个 tracked 修改/状态项；
- 56 个 untracked 条目；
- tracked diff 约 33 个文件、`+1588/-127`；
- 当前版本号曾推进到 4.2.3，但这些版本没有形成可信的视觉等价发布基线。

## 3. 原生页面实现

以下文件是 #240/#257–#260 期间形成的实验页面：

| 文件 | 规模 | 审定用途 |
| --- | ---: | --- |
| `NativeHomeActivity.kt` | 925 行 | 只提取数据映射、图表计算和缺陷样本，不复用页面结构 |
| `NativeRecordActivity.kt` | 920 行 | 只提取保存 envelope、状态映射和回归用例，不复用页面结构 |
| `NativeShellActivity.kt` | 250 行 | 弃用；它造成第二套原生入口/占位壳 |
| `NativeSettingsActivity.kt` | 136 行 | 只作字段覆盖清单参考 |
| `NativeInsightActivity.kt` | 104 行 | 只作当前洞悉字段映射参考，禁止提前做洞悉改版 |
| `NativeBackupActivity.kt` | 65 行 | 只作入口清单参考 |
| `NativeStaticInfoActivity.kt` | 18 行 | 延后评估；静态说明页最终可继续用 WebView |
| `GuanjiDesignSystem.kt` | 388 行 | 逐 token 审核后重写，不整体复制 |
| `GuanjiVisualContract.kt` | 237 行 | 只提取已被真机证实的常量，不把猜测值带入 V2 |

旧 `AndroidManifest.xml` 同时注册了多个 Native Activity，`MainActivity` 又按 route 启动不同 Activity。这与 V2 的单宿主决策冲突。

## 4. 视觉测绘与闸门资产

旧工作区包含：

- `docs/visual-equivalence/` 下的页面、组件、路由、状态、证据和签收资料；
- `docs/contracts/native-visual-contract.md`；
- `docs/contracts/native-migration-gate.md`；
- `debug/collect-visual-baseline.cjs`；
- `debug/collect-visual-evidence.cjs`；
- `debug/collect-device-visual-evidence.cjs`；
- `debug/verify-270-visual-gate.cjs`；
- `debug/verify-native-migration-gate.cjs`。

这些资产不能原样成为 V2 闸门，原因有二：

1. 基线清单写死为 WebView v4.2.1，而 V2 的事实基线是 v4.1.5；
2. 旧宿主闸门明确要求 `NativeHomeActivity`、`NativeRecordActivity` 等多个 Activity，正好固化了这次需要废弃的架构。

可复用的是采集方法、数据结构、状态矩阵思想、视觉容差和失败样本；清单、签收结果、路由宿主和验证脚本必须在新架构下重新生成。

## 5. 非 UI 候选资产

旧工作区还包含从 v4.1.5 之后完成但尚未纳入稳定基线的非 UI 工作：

- #255 数据稳定化与迁移收口；
- #237 计时与生命周期原生化；
- #238 通知与小组件原生化；
- #239 profileContext 架构预留。

这些功能不和旧页面代码一起丢弃，但也不直接合并。每项必须以独立 patch 重新审查：确认不依赖多 Activity、旧视觉壳或错误路由后，运行它自己的测试并单独移植。

## 6. WebView 事实来源

V2 的视觉等价测绘必须直接读取 v4.1.5：

- 页面结构：`www/index.html`；
- 全局主题：`www/css/theme.css`、`base.css`；
- 卡片和控件：`www/css/components.css`、`glass.css`；
- Tab：`www/css/tabbar.css`；
- Sheet：`www/css/sheets.css`；
- 页面布局：`www/css/screens.css`、`responsive.css`；
- 页面行为：`www/js/ui-home.js`、`ui-calendar.js`、`ui-sheet.js`、`ui-timer.js`；
- 记录/统计/存储：`www/js/records.js`、`stats.js`、`storage.js`；
- 洞悉/AI：`www/js/behavior-model.js`、`evidence-graph.js`、`ai.js`；
- 备份恢复：`www/js/backup-picker.js`、`webdav.js`、`secure.js`。

## 7. 安全盘点

本次归档前已做以下检查：

- 未发现已知 WebDAV 测试密码的明文残留；
- 未发现按名称判断的 key/keystore/secret untracked 文件；
- 未发现超过 5 MB 的单个 untracked 文件；
- 实施报告和截图仍只存在于本地归档/旧工作区，不纳入 GitHub 提交。
