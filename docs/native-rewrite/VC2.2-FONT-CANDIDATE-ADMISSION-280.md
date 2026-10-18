# #280 VC2.2：字体候选准入评估

日期：2026-09-22<br>
基线：`4.2.10 / code 132`，`com.guanji.app`

## 当前结论

VC2.1 的归一化渲染复核显示：系统 `FontFamily.SansSerif` 在 OnePlus PLZ110 与魅族基线之间的“次数趋势”字形覆盖差异为 `13.79%`，超过 VC0 的 `5%` 阈值。因此不能把系统字体准入当作跨设备视觉一致性通过。

本阶段已选择 Noto Sans CJK SC 作为 Native 字体，复制到 `android/app/src/main/res/font` 的只有未修改的静态 Regular/Medium/Bold 文件；页面字号、布局、Sheet/Insets/Footer/Tab 和版本号保持不变。API 24 没有运行时环境，因此改为静态兼容审查并明确接受该未覆盖风险。

## 候选范围

| 候选 | 官方发布 | 首轮资产 | 许可证 | API 24 策略 | 当前状态 |
|---|---|---|---|---|---|
| Noto Sans CJK SC | [Sans2.004](https://github.com/notofonts/noto-cjk/releases/tag/Sans2.004) | `18_NotoSansSC.zip`（约 50,077,940 bytes，压缩包） | SIL Open Font License 1.1（[官方说明](https://github.com/notofonts/noto-cjk/blob/main/Sans/NEWS.md)） | 静态文件；API 24 采用静态兼容审查，运行时风险已记录 | 已选择 |
| Source Han Sans SC | [2.005R](https://github.com/adobe-fonts/source-han-sans/releases/tag/2.005R) | `09_SourceHanSansSC.zip`（约 95,177,106 bytes，压缩包） | SIL Open Font License 1.1（[许可证](https://github.com/adobe-fonts/source-han-sans/blob/master/LICENSE.txt)） | 静态文件；不能只依赖变量字体 | 待资产与渲染评估 |

压缩包大小不等于 APK 增量，不能据此选型。必须解压后确认实际使用的 400/500/700 字重、APK 增量、冷启动和内存影响。

本次隔离资产清点结果：

- `18_NotoSansSC.zip`：`50,077,940` bytes，SHA-256 `4d107c09ada479d3e48b6e78c83835773cbd9214bf6e12cdb7b60f8e068292ec`；已发现 `Regular / Medium / Bold`。
- `09_SourceHanSansSC.zip`：`95,177,106` bytes，SHA-256 `ef7364f7ac2564be1ae9c1d74276de2653fe38b73449070398c4fc0b7e032ff1`；已发现 `Normal / Medium / Bold`。

Noto 的三个实际字重已复制到生产 `res/font`；Source Han 仍只保留在隔离候选目录，没有参与生产构建。

## 准入硬条件

1. 候选必须来自上述官方发布和许可证页面；不得打包 PingFang、Microsoft YaHei、HarmonyOS Sans 或从设备提取的系统字体。
2. 当前工程 `minSdkVersion=24`；本机没有 API 24 真机或模拟器，因此本轮不执行 API 24 运行时测试，改为 `aapt`/资源打包/静态 OTF 兼容审查，并在报告中明确记录残余风险。不能为了字体评估降低 minSdk。变量字体不进入本轮。
3. 首轮不裁剪、不改名、不修改字体文件。若后续子集化，必须重新检查 OFL Reserved Font Name 和衍生版本义务。
4. 需要记录：官方来源、发布版本、资产名、SHA-256、实际字重、是否修改、完整许可证、APK 增量、启动/内存影响。
5. 使用同一组中文、数字、英文、长文案、粗体样张，在三设备、浅色/深色、`fontScale=1.0/1.15/1.30` 下与 WebView 对照；API 24 运行时不作为本轮前置条件，改由静态资源/打包/`minSdk=24` 兼容审查覆盖，并在报告中接受残余风险。
6. 候选评估不得改变已有 `NativeTypography` 角色映射；字体来源切换必须是单一配置变更，可回退到系统字体。

## 自动化入口

```text
npm run verify:280:vc2.2:candidates
```

报告：

```text
debug/visual-migration/#280-p6-vc0-20260922/vc2.2-font-candidate-admission/vc2.2-font-candidate-report.json
```

当前报告为 `passed_static_compatibility_runtime_unverified`，决策为 `noto-sans-cjk-sc_selected`：三台目标设备静态渲染、字体资产、许可证文件和静态兼容审查通过；API 24 运行时不执行，作为明确的残余风险接受。冷启动/内存和三设备 WebView 同 fixture 对照仍是后续 VC3/VC6 证据，不宣称 #280 已完成。

## 两台魅族候选渲染基线（2026-09-22）

测试条件固定为：`4.2.10 / code 132`、`com.guanji.app`、经典浅色、`fontScale=1.0`、同一 `home-top-static-title-v1` fixture，目标静态文字为“次数趋势”。候选只临时复制到 `res/font` 生成 APK，测试完成后已恢复生产源码和资源，并通过无缓存构建确认生产 APK 不含候选字体。

| 候选 | 魅族 21 覆盖率 | 魅族 18S 覆盖率 | 两台相对差异 | 当前判断 |
|---|---:|---:|---:|---|
| Noto Sans CJK SC | `0.307606` | `0.309239` | `0.5281%` | 两台魅族通过；不能据此完成三设备准入 |
| Source Han Sans SC | `0.307207` | `0.309406` | `0.7107%` | 两台魅族通过；不能据此完成三设备准入 |

证据报告：

- `debug/visual-migration/#280-p6-vc0-20260922/vc2.2-font-candidate-render/noto-report.json`
- `debug/visual-migration/#280-p6-vc0-20260922/vc2.2-font-candidate-render/source-han-report.json`

该段是两台魅族的历史基线；随后已补齐 OnePlus，并据三设备结果选择 Noto。API 24 运行时不做，本轮改用静态兼容审查并接受残余风险。

## 三设备候选渲染结果（2026-09-22）

OnePlus PLZ110 已连接后，使用完全相同的 `home-top-static-title-v1` fixture、经典浅色、`fontScale=1.0` 和 `4.2.10/code132` 完成补采集。三台设备的两两覆盖率差异均低于 VC0 的 5% 红线：

| 候选 | 魅族 21→魅族 18S | 魅族 21→OnePlus PLZ110 | 三设备静态候选判断 |
|---|---:|---:|---|
| Noto Sans CJK SC | `0.5281%` | `0.1759%` | 通过本轮静态渲染 |
| Source Han Sans SC | `0.7107%` | `0.1527%` | 通过本轮静态渲染 |

证据报告已更新为 `Status=three_device_candidate_render`、`Passed=true`：

- `debug/visual-migration/#280-p6-vc0-20260922/vc2.2-font-candidate-render/noto-report.json`
- `debug/visual-migration/#280-p6-vc0-20260922/vc2.2-font-candidate-render/source-han-report.json`

这证明两套候选在三台现有真机的单一静态文字样张上通过；Noto 以较低的最差相对差异和较小的实际字重集合被选中。它不能替代 WebView 同样张、包体/启动/内存证据，API 24 运行时风险也已单独记录。

## 选型与构建收尾

Noto 选型后，生产 `NativeTypography.kt` 使用静态 400/500/700 文件，完整 OFL 文本位于 `android/app/src/main/assets/licenses/NotoSansCJKSC-OFL-1.1.txt`，项目声明位于 `THIRD_PARTY_NOTICES.md`。VC3-T1 已通过统一构建钩子测得选定字体 APK 为 `54,707,001` bytes（SHA-256 `95E52614E70321B43FE1EF2893E57F70C78E2D5E10FCF5D683A906C8553512C2`），相对上一份无字体基线 `32,070,486` bytes 增加 `22,636,515` bytes；冷启动和内存仍待专项测量，不复用候选阶段缓存产物。

候选构建期间发现一次 Gradle 增量输出复用风险：更换候选字体后再次构建可能复用旧候选 APK，因此候选阶段的包体增量不作为有效证据；本轮已使用 `tools/build-apk.ps1 -Mode debug -NoBuildCache -NoDaemon` 重新构建并用 APK SHA/包名/版本/签名校验，当前生产 APK 的字体资源和设备端副本一致。

## 下一步

1. Noto Sans CJK SC 已选定并接入生产 Native 字体资源；Source Han 保留为未选候选。
2. API 24 运行时测试明确不执行，静态兼容审查和残余风险记录已完成；该风险不再作为运行时阻断条件。
3. VC3-T1 已进入：首页、日历、记录、计时核心页面已扩展统一 Typography 角色，静态闸门 `verify:280:vc3:t1` 通过。
4. 下一步补齐 OnePlus 的三设备同 fixture 运行时对照，以及冷启动/内存、深浅主题和 fontScale 回归；这些仍是 #280 最终签收前的阻断证据。
