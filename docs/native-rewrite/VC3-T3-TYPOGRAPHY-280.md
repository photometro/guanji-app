# #280 VC3-T3：洞悉 / Tab / 空状态 Typography 收口

> 历史批次记录。页面角色与几何验收仍可复用；字体资源/权重结论由 VC3-R2 替换，须按变量字体重新验收。

状态：实现完成，静态闸门与三设备同版本只读运行回归通过。

## 范围

- 洞悉页全部标题、正文、指标、共同出现、可选建议、AI 标签、问答和空/不足数据状态；
- Tab 文案与图标邻接文字；
- 日期徽标及状态小字。

## 规则

- 洞悉页所有文字使用 `NativeTypography` 的 Insight 角色；
- Tab 使用 `Role.TabLabel`，保留现有 #274/#280 尺寸、层级、动画和安全区；
- 不改变 #277 的数据源、Evidence/AI 状态和 #280 的弹性布局参数；
- API 24 仅执行已批准的静态兼容审查。

## 证据与验收

- `debug/verify-280-vc3-t3-typography.cjs`；
- 报告：`debug/visual-migration/#280-p6-vc0-20260922/vc3-t3-typography/vc3-t3-typography-report.json`；
- T3 先完成两台魅族内部回归，随后连接 OnePlus；最终三设备同 fixture 证据已由 `vc3-final` 报告收口。
