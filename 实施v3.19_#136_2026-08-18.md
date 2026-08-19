# 实施记录 — v3.19 记录详情页入口收敛

日期：2026-08-18

## 实施条目

- #136：普通记录、补记和编辑详情页移除重复的“本次是否受到成人内容影响？”独立开关，统一使用“成人内容影响”诱因 chip 表达。
- 保存记录时由诱因集合推导 `media` 字段，继续兼容旧数据结构。
- 旧记录只有 `media: true`、没有对应诱因时，进入编辑页会自动预选“成人内容影响”，避免编辑其他字段时丢失语义。

## 主要改动文件

- `www/index.html`：移除普通详情页 `#mediaSwitch` 开关，并将资源缓存参数更新为 `v=109`。
- `www/js/records.js`：`media` 改为由成人内容影响诱因推导。
- `www/js/ui-sheet.js`：移除开关初始化和监听，补充旧记录兼容与空数组保护。
- `android/app/build.gradle`：`versionCode 40`、`versionName "3.19"`。
- `CHANGELOG.md`、`README.md`、`IMPROVEMENTS.md`：补充 v3.19/#136 实施记录。

## 验证结果

- JavaScript 语法检查通过。
- 浏览器 Playwright 回归通过：详情页无 `#mediaSwitch`；诱因 chip 可见；新记录正确写入 `media: true`；旧 media-only 记录编辑时自动预选；无页面错误。
- `npx cap sync android` 通过。
- `assembleDebug --no-daemon` 构建通过。
- 真机 `461QYFDN226NF` 安装并启动成功；设备 DOM 确认无独立开关且诱因文案为“成人内容影响”；系统版本为 versionCode 40 / versionName 3.19。
- 真机截图：`screenshots/v319_detail.png`。

## 待确认

用户可在真机上检查普通记录、补记和历史记录编辑流程；本条实现无待处理代码项。

