const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => { console.error(`FAIL #273: ${message}`); process.exitCode = 1; };
const pass = (message) => console.log(`PASS #273: ${message}`);

const plan = read('IMPROVEMENTS.md');
if (plan.includes('## 272.') && plan.includes('P0-R：旧原生化资产审计、归档与计划重置 ✅ 已实施')) pass('已建立 #272 重启基线');
else fail('未找到 #272 已完成的重启基线记录');

const gradle = read('android/app/build.gradle');
const currentCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1] || 0);
const currentName = gradle.match(/versionName\s+"([^"]+)"/)?.[1] || '';
if (currentCode >= 114 && /^4\.2\./.test(currentName)) pass(`V2 版本仍在 4.2.x 迁移线（${currentName} / versionCode ${currentCode}）`);
else fail('当前版本必须位于 v4.2.x 原生迁移线');

const main = read('android/app/src/main/java/com/guanji/app/MainActivity.java');
if (main.includes('NativeRootHost.install(this)')) pass('MainActivity 安装唯一 NativeRoot'); else fail('MainActivity 缺少 NativeRootHost.install(this)');
if (!exists('android/app/src/main/java/com/guanji/app/NativeRoot.kt')) fail('缺少 NativeRoot.kt'); else pass('NativeRoot.kt 存在');
if (!exists('android/app/src/main/java/com/guanji/app/NativeRootHost.kt')) fail('缺少 NativeRootHost.kt'); else pass('NativeRootHost.kt 存在');
if (!exists('android/app/src/main/java/com/guanji/app/NativeMigrationContracts.kt')) fail('缺少 NativeMigrationContracts.kt'); else pass('RouteHost/Tab/SheetHost 契约存在');

const manifest = read('android/app/src/main/AndroidManifest.xml');
if (/android:name="\.Native[^\"]*Activity"/.test(manifest)) fail('Manifest 注册了页面级 Native Activity'); else pass('Manifest 只有 MainActivity 作为窗口级宿主');
if (/startActivity\s*\(/.test(main) && /Native[A-Za-z]+Activity/.test(main)) fail('MainActivity 仍包含页面级 Native Activity 路由'); else pass('没有页面级 Native Activity 路由');

const rootSource = read('android/app/src/main/java/com/guanji/app/NativeRoot.kt');
for (const term of ['legacyRegion', 'nativeRegion', 'setNativeRegionVisible', 'DisposeOnViewTreeLifecycleDestroyed']) if (!rootSource.includes(term)) fail(`NativeRoot 缺少 ${term}`);
if (!rootSource.includes('visibility = View.GONE')) fail('NativeRoot 默认未隐藏原生区域'); else pass('NativeRoot 默认隐藏原生区域，保持 WebView 首屏');
const hostSource = read('android/app/src/main/java/com/guanji/app/NativeRootHost.kt');
if (!hostSource.includes('FLAG_DEBUGGABLE') || !hostSource.includes('setNativeRouteDebugEnabled')) fail('缺少仅调试构建可用的 NativeRoute 开关'); else pass('NativeRoute 开关仅允许调试构建');

const docs = read('docs/native-rewrite/MIGRATION-GATE.md');
for (const term of ['MainActivity（唯一可见 Activity）', '同一职责区域只能有一个所有者', '核心页面不得新增 `Native*Activity`']) if (!docs.includes(term)) fail(`V2 闸门缺少：${term}`);
const ledger = read('docs/native-rewrite/MIGRATION-LEDGER.md');
if (!ledger.includes('| #273 |') || !ledger.includes('`verified`（脚手架/闸门）')) fail('迁移台账未将 #273 标记为脚手架/闸门 verified');
else pass('迁移台账已记录 #273 验收边界');
if (!process.exitCode) pass('V2 单宿主与分区式混合规则通过');
