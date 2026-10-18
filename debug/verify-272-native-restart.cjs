const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));
const fail = (message) => {
  console.error(`FAIL #272: ${message}`);
  process.exitCode = 1;
};

const requiredDocs = [
  'docs/native-rewrite/README.md',
  'docs/native-rewrite/ASSET-INVENTORY.md',
  'docs/native-rewrite/SALVAGE-MATRIX.md',
  'docs/native-rewrite/FAILURE-RETROSPECTIVE.md',
  'docs/native-rewrite/PLAN-MIGRATION-MAP.md',
  'docs/native-rewrite/MIGRATION-GATE.md'
];

for (const file of requiredDocs) {
  if (!exists(file)) fail(`缺少 ${file}`);
}

const gradle = read('android/app/build.gradle');
const currentVersionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1] || 0);
const currentVersionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1] || '';
if (!currentVersionCode || !currentVersionName || currentVersionCode < 114) {
  fail('当前 V2 工作树必须使用高于 v4.1.5 的可解析版本');
}

const baselineDocs = requiredDocs.map(read).join('\n');
for (const term of ['v4.1.5', 'versionCode 113', 'c113bcf4c7729d0978ded3f37f3ab76496334af1']) {
  if (!baselineDocs.includes(term)) fail(`V2 文档未保留 v4.1.5 基线身份：${term}`);
}

const manifest = read('android/app/src/main/AndroidManifest.xml');
if (/android:name="\.Native[^\"]*Activity"/.test(manifest)) {
  fail('v4.1.5 重启基线不应注册旧 Native*Activity');
}

const javaDir = path.join(root, 'android/app/src/main/java/com/guanji/app');
if (exists('android/app/src/main/java/com/guanji/app/NativeShellActivity.kt')) {
  fail('NativeShellActivity 不得进入 V2 基线');
}

const improvements = read('IMPROVEMENTS.md');
for (const id of ['271', '272', '273', '274', '275', '276', '277', '278', '279', '280', '281']) {
  if (!new RegExp(`^## ${id}\\.`, 'm').test(improvements)) fail(`IMPROVEMENTS.md 缺少 #${id}`);
}

const gate = read('docs/native-rewrite/MIGRATION-GATE.md');
for (const term of ['MainActivity（唯一可见 Activity）', 'GuanjiBottomTabs（唯一实例）', 'SheetHost（唯一实例）', '≤1dp', '≤2dp', '≤3dp']) {
  if (!gate.includes(term)) fail(`V2 闸门缺少关键约束：${term}`);
}

if (!process.exitCode) {
  console.log(`PASS #272: v4.1.5 基线身份仍可追溯；当前 ${currentVersionName} / versionCode ${currentVersionCode} 与 V2 单宿主闸门均已建立`);
}
