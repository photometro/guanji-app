# #280 VC3-T1：Home / Calendar / Record-Timer 语义字体映射

> 历史批次记录。页面角色与几何验收仍可复用；字体资源/权重结论由 VC3-R2 替换，须按变量字体重新验收。

日期：2026-09-22<br>
基线：`4.2.10 / code132`，`com.guanji.app`

## 目标

在 VC2.2 已选定 Noto Sans CJK SC 后，将首页、日历、记录和计时页面的文字统一接入 `NativeTypography` 语义角色。T1 只收拢字体家族、真实字重、字距和已有字号/行高，不重新设计布局，不修改 Sheet、Insets、Footer、Tab、动画或滚动归属。

## 已实施

- `NativeTypography.Role` 增加 Home、Calendar、Record-Timer 角色。
- `NativeHomeSurface.kt` 的首页问候、统计、趋势、时段、最近记录、日历标题/日期徽标/操作文字改用语义角色。
- `NativeRecordSurface.kt` 的计时提示、计时数字、开始/结束/取消、计时汇总、时长状态文字改用语义角色。
- 所有角色统一使用 Noto Sans CJK SC 静态 Regular/Medium/Bold；`FontSynthesis.None` 禁止 OEM 合成字重。
- 原始 T1 记录关于 600→Bold 的描述已由 `VC3-WEIGHT-MAPPING-CORRECTION-280.md` 更正：600 请求使用 Medium500，800 请求仍落到 Bold700 静态脸；这是后续字重映射修订，不重写当时的历史验收报告。

## 闸门

```text
npm run verify:native-ui-v2:preflight -- 280
npm run verify:280:vc3
npm run verify:280:vc3:t1
```

结果：

- V2 preflight：通过。
- VC3-T0：通过。
- VC3-T1 静态角色、资源、许可证和当前设备版本检查：通过。
- 两台魅族先完成同一 `4.2.10/code132` 产物的 P5 只读同 fixture 回归；T3 完成后已补采 OnePlus，并由最终报告合并完成三设备同 fixture 对照。

## API 24 决策

工程 `minSdkVersion=24`，当前没有 API 24 真机或模拟器。本阶段不执行 API 24 运行时测试，改以静态 OTF 资源审查、aapt 打包和 minSdk 资源兼容检查覆盖，并在 VC2.2 报告中明确接受该残余风险；这不是 API 24 运行时通过声明。

## 当前状态

`passed_static_and_runtime_ready`。三设备最终证据见 `debug/visual-migration/#280-p6-vc0-20260922/vc3-final/vc3-final-report.json`；VC3 仍需完成发布许可证入口、NOTICE 和性能收尾后再归档。
