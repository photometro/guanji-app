# #280 VC3-T2：我的 / 数据与隐私 / 备份与恢复 Typography 收口

> 历史批次记录。页面角色与几何验收仍可复用；字体资源/权重结论由 VC3-R2 替换，须按变量字体重新验收。

状态：实现完成，静态闸门与三设备同版本只读运行回归通过。

## 范围

- 我的页、设置页、数据与隐私页；
- 备份与恢复一级/二级卡片；
- 密码、恢复口令等输入型 Sheet；
- 共用 `NativeTypography` 的 Noto Sans CJK SC 字体族与语义角色。

## 规则

- 页面只通过 `NativeTypography.style(Role, ...)` 获取 Typography；
- 不在页面内直接新建 `TextStyle`，不让 Material/OEM 默认字体接管字重；
- 不修改 #279 的 IME、安全区、Footer 和 Sheet 高度规则；
- API 24 仅执行已批准的静态兼容审查，不增加运行时环境要求。

## 证据与验收

- `debug/verify-280-vc3-t2-typography.cjs`；
- 报告：`debug/visual-migration/#280-p6-vc0-20260922/vc3-t2-typography/vc3-t2-typography-report.json`；
- 魅族 18s、魅族 21 与 OnePlus 已使用同一只读 fixture 完成最终路线和生命周期对照；证据见 `debug/visual-migration/#280-p6-vc0-20260922/vc3-final/vc3-final-report.json`。
