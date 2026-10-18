# #280 VC3-R2：可变字体单一路径

状态：VC3-R2 与 VC3 已于 2026-09-29 签收；父级 #280 仍继续 VC4～VC6。版本保持 `4.2.12/code134`、minSdk 26，未重建 APK、未清除或修改任何真实设备数据。两台魅族 Run-10、OnePlus Run-11 与三设备 P5 路由/生命周期矩阵通过；API26 AVD Native Compose 可变字体冒烟通过。按 2026-09-29 范围修订 R1，API26 WebView 回退测试不适用、不纳入验收；API26 Native 页面/可变字体兼容性仍保留。字体包体、启动/内存实测及离线许可/NOTICE 核验完成，详见 `outputs/guanji-app_实施v4.2.12_#280-VC3-R2-收尾_2026-09-29.md`。

## 决策与边界

- 本方案完整替代 VC3 旧静态字重路径，不长期保留静态 + 可变双路径。
- 新版最低系统为 Android 8.0 / API 26；使用官方 Noto Sans SC Sans2.004 简体中文区域子集 Variable TTF。
- 只保留 `wght` 100–900 的一个字体资源；Compose 为 400/500/600/650/700/750/800 注册各自匹配的轴值；继续使用 `FontSynthesis.None`。
- 只允许更改最低系统、字体资源/加载接口、字体许可清单、字体相关测试/文档和必须的版本/发行说明。字号、行高、字距、颜色、卡片/Sheet 几何、Insets、Footer、Tab、动画、阴影、数据和业务逻辑冻结。
- 所有 `VC3-T0～T3` 旧报告保留为历史记录；页面角色/布局证据可复用，字体渲染结果必须重验。旧三设备静态字体报告不能作为 R2 通过证据。

### 2026-09-29 范围修订 R1（用户确认）

- WebView 只作为迁移期间的参考或测试入口，用户流程不依赖它；API 26 WebView fallback 测试因此标记为 **不适用 / 不纳入验收**，不再阻塞 VC3，也不为旧 Chromium 修复兼容层。
- API 26 的 Native 页面与可变字体运行验证仍是最低系统要求；以 NativeRoot 所有权、Compose 文本和实际 Native 页面显示作为验收对象。
- 本修订只调整验收范围，不更改产品代码、版本、字体资产、API 24/25 兼容基线或后续 WebView 清除路线。

## 输入资产与基线

- 官方固定来源：`https://github.com/notofonts/noto-cjk/tree/Sans2.004/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf`
- 字体 SHA-256：`D68BAFCB48A2707749396AA12BBBD833CB70401F3A9A689FD2902C7E0D295964`
- 字体大小：17,773,132 bytes；OpenType 表含 `fvar/avar/gvar/HVAR/STAT`；单轴 `wght=100..900`；31,036 glyphs。
- 静态回滚件和 API24 兼容 APK：`debug/visual-migration/#280-vc3-r2/baseline-static-api24/`；基线为 `4.2.11/code133`、`minSdk=24`、签名 SHA-256 `0F14FD7EDA0C58BFF82144B8D5CB6A6AD19A79C48E25B0D5B640213E7DC97E0B`。
- 基线 APK SHA-256：`ED9E43912323E24B67481FE197A76FFCFA52A774CA9A9ADB92A85A131BF3A509`。
- 候选下载和资产检查在 `debug/font-candidates/vc3-r2/`；候选/基线副本不进入 APK。

## 阶段与验收

| 阶段 | 交付 | 状态 |
| --- | --- | --- |
| P0 | 冻结 API24 静态字体 APK、字体资产哈希、版本/签名；记录 API24/25 退场边界 | 已完成 |
| P1 | 固定 Sans2.004 官方资产；检查来源、哈希、OpenType 轴、字形覆盖、许可 | 静态完成：官方 tag/hash/axis；Native Kotlin/XML 847 字符、缺字 0；OFL/NOTICE/应用内入口静态对照通过 |
| P2 | `minSdk=26`；单 TTF 入 `res/font`；删除三份静态 OTF | 4.2.12/code134 构建通过；覆盖安装到两台魅族；旧版 4.2.11/code133 与数据未清除 |
| P3 | `NativeTypography` 作为唯一字体入口，注册真实轴值；增加 `verify:280:variable-font` | Compose 构建、静态合同及 847 字符覆盖通过；实机页面已运行 |
| P4 | 保留 T0–T3 语义角色与视觉参数，仅统一到变量字体；清除旧映射/旁路 | T0/T1/T2/T3 与内部静态/代码闸门通过；两机 P5 路由证据可用 |
| P5 | T0～T3 字样重验收；两台魅族、OnePlus、API26 Native；覆盖安装和本地数据保留；布局/IME/弹性回归 | 已通过：两台魅族 Run-10 与 OnePlus Run-11 完成 Native T0～T3 字体样本复核；三设备 P5 路由/生命周期矩阵通过。两台魅族使用同版本、light、`fontScale=1.0`，每机 13 个 Native 视口和 26 个 allowlist 文字样本；OnePlus 运行批次及原有 68 条记录摘要前后保持一致。API26 AVD Native 首页/洞悉/我的可变字体冒烟通过，`webViewNodeCount=0`。不声称同 fixture 像素级 WebView 等价。API26 WebView fallback 按 R1 为不适用，不纳入验收 |
| 收尾 | APK 字体体积、冷启动、首次文字、长页、多字重 PSS；应用内许可、NOTICE、README、发行说明；更新 VC4～VC6/#281 依赖 | 已完成：当前变量字体包内 17,773,132 bytes（ZIP 压缩 11,276,746 bytes），旧三份静态字体合计 25,219,940 bytes（压缩 21,932,029 bytes）；旧/新 APK 总大小作旁证但不将差值全部归因于字体。API26 AVD 3 次 force-stop 冷进程启动 `am start -W TotalTime` 为 1490/1664/1695 ms；Native 首页/洞悉/我的主进程 PSS 为 122,961/125,913/128,724 KiB。计划未定义 PSS 数值预算，故仅归档为本机构建观测基线，不虚称与旧字体的内存差值或通用设备性能结论。当前 APK 两份完整许可资产与源码哈希一致，Native 离线许可页可打开并滚动读取 SQLCipher BSD 与 Noto OFL 正文；根目录 `THIRD_PARTY_NOTICES.md` 已核验。实际发行时仍须将该 NOTICE 文件随 APK 发布 |

## 2026-09-29 VC3-R2 收尾签收

- API 26 WebView fallback：`not_applicable`（R1，用户流程不依赖 WebView）；没有执行也不要求修复 Chromium 69 回退路径。
- API 26 Native：现有 `api26-runtime-report.json` 已证明 4.2.12/code134 在 API26 上可启动 Native Home/Insight/Settings 并显示 Compose 文字、无 WebView 页面节点；本轮再以 AVD 原生离线许可入口和页面核验确认 Native 路由可达。
- 启动数据仅是该 AVD/当前混合宿主构建的 `am start -W` ActivityManager 指标，不等同 Android Vitals TTID/TTFD；三次 1.49～1.695 秒，测试桥接初始化时间不计入应用启动值。稳定 Native 页面主进程 PSS 为 120.1～125.7 MiB，不能隔离归因至字体文件。
- 官方 Android Vitals 将 cold startup ≥5 秒列为 excessive；本次 ActivityManager `TotalTime` 不是 Android Vitals TTID，因此只作粗略参照，不作为严格同口径验收。详见 [Android Developers：App startup time](https://developer.android.com/google/play/vitals/launch-time)。
- `npm run verify:280:variable-font` 与 `npm run verify:280:vc3:final` 本轮重跑通过；当前 APK SHA-256 `21EFC6627796D82B403195C89B2503F9AE32DC18062BFD6CB07BE31469AEC67E`。

## 验证契约

- `verify:280:variable-font` 检查 `minSdk=26`、单一 TTF、SHA、`fvar/wght` 范围、七个轴值注册、无三份静态文件/旧吸附映射、`FontSynthesis.None`、无页面级字体旁路、OFL/NOTICE/应用内许可/API24 说明。
- API 26 验收只要求 Native Compose 页面和可变字体最低系统运行；WebView fallback 因 R1 标记不适用，不测试、不修复且不阻塞。Run-10/Run-11 与最终三设备路由矩阵均已通过；性能按本机冷启动和 PSS 数据记录为基线，项目未定义 PSS 预算，不据此宣称跨设备性能保证。任何 Native 字体加载失败、缺字、裁切、意外换行、布局变化或启动崩溃仍阻止签收。
- 热进程的 API 26 Native 首页/洞悉顶部与长页滚动 PSS 复采为 131,137/130,140 KiB、131,476/130,730 KiB；在已加载字体与多页内容的单次序列中，长页滚动样本未见 PSS 上升。它是同一 AVD 混合宿主主进程观测，不能分离字体本身、WebView 宿主或其他缓存的内存占用。
- 三设备使用同一 APK、fixture、主题、`fontScale`、入口和截图时机；不得为单一设备加分支。安装前核对包名/签名/versionCode，只允许覆盖安装，不清数据。
- VC3-R2/VC3 的设备与 Native/API26 字体验收现已完成并签收；父级 #280 仍不能标记 verified，须继续 VC4～VC6 的独立任务。

## 2026-09-29：两台魅族字体来源取证

- 探针报告：`debug/visual-migration/#280-vc3-r2/font-source/4.2.12-134/webview-font-source-probe.json`；独立人工字样 PNG：`debug/visual-migration/#280-vc3-r2/font-source/4.2.12-134/[序列号已省略]/webview-weight-specimen.png`、`.../[序列号已省略]/webview-weight-specimen.png`。两台均为 4.2.12/code134、fontScale=1.0；探针结束时 DOM overlay / ADB forward 清理校验通过；无用户记录读写。临时 fontScale 在结束后恢复为 18s=1.0、21=1.06。
- 两台 WebView 都声明相同系统字体栈，CDP 对七个字重（400/500/600/650/700/750/800）均报告非自定义 `Noto Sans CJK SC` Regular face；但相同字样的归一化 ink coverage 签名不同：

| 设备 | 400 | 500 | 600 | 650 | 700 | 750 | 800 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Meizu 18s | 0.267191 | 0.267191 | 0.267191 | 0.445166 | 0.445166 | 0.445166 | 0.445166 |
| Meizu 21 | 0.269614 | 0.334826 | 0.374677 | 0.416099 | 0.416099 | 0.454906 | 0.454906 |

- 这说明 WebView 的 CSS 请求权重在两台设备上并未形成同一组可复现的物理字重梯度：18s 上 400–600 与 650–800 分别塌缩成两档；21 上 650=700、750=800。Native 变量字体用同一份字体资源及显式 wght 轴，仍是降低 OEM/WebView 权重不一致的合理实现；但该 WebView 取证**不能**冒充 Native Compose 七个轴值的逐轴像素验收。
- 同态 Native/WebView 页面截图目前只覆盖设置页：`debug/visual-migration/#280-vc3-weight-same-state-4.2.12-134/same-state-report.json`。它可确认当前构建、路由归属、fontScale 设定/恢复和设置页可见；但不构成跨设备同 fixture 全屏对照（18s WebView 截图有黄色浮层，21/18s 磨砂设置值分别为 6px/3px），也不能签收全部 T0～T3 页面、全部实际使用字重或 OnePlus。

## 对后续节点的同步影响

- VC4 阴影阶段必须重新生成变量字体下的截图/bounds；阴影 token 本身保持不变。
- VC5 增加 API26 启动、字体首次加载/缓存、冷/热启动、进程重建、多字重、fontScale、旧版本覆盖升级与数据完整性。
- VC6 增加最低系统 26、APK 仅一份主字体、删除静态资产/旧映射、三设备/API26、许可与 NOTICE、最后 API24 APK、README/发行说明核查。
- #281 固定 `NativeTypography` 为唯一原生字体事实源；删除 JS 核心不得将 WebView 系统字体栈搬入 Native。后续玻璃 Native 复用此字体接口。
- API24/25 用户留在 4.2.11/code133 或更早兼容版本；不清理其数据，不承诺安装 API26 新版。
