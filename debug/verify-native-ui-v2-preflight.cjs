const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = process.argv[2];
const valid = new Set(['273', '274', '275', '276', '277', '278', '279', '280', '281']);
if (!valid.has(target)) { console.error('FAIL V2 preflight: 必须传入 #273–#281 的明确条目号'); process.exit(1); }
const plan = fs.readFileSync(path.join(root, 'IMPROVEMENTS.md'), 'utf8');
if (!plan.includes('## 272.') || !plan.includes('P0-R：旧原生化资产审计、归档与计划重置 ✅ 已实施')) {
  console.error('FAIL V2 preflight: #272 重启基线未完成');
  process.exit(1);
}
const gate = fs.readFileSync(path.join(root, 'docs/native-rewrite/MIGRATION-GATE.md'), 'utf8');
const ledger = fs.readFileSync(path.join(root, 'docs/native-rewrite/MIGRATION-LEDGER.md'), 'utf8');
const required = ['MainActivity（唯一可见 Activity）', 'GuanjiBottomTabs（唯一实例）', 'SheetHost（唯一实例）', '≤1dp', '≤2dp', '≤3dp'];
const missing = required.filter((item) => !gate.includes(item));
if (missing.length) { console.error(`FAIL V2 preflight #${target}: ${missing.join(', ')}`); process.exit(1); }
const isVerified = (entry) => ledger.split(/\r?\n/).some((line) =>
  line.startsWith(`| #${entry} |`) && line.includes('`verified`')
);
const prerequisite = {
  '274': isVerified(273),
  '275': isVerified(274),
  '276': isVerified(275),
  '277': isVerified(276),
  '278': isVerified(277),
  '279': isVerified(278),
  '280': isVerified(279),
  '281': isVerified(280)
};
const manifest = {
  schemaVersion: 'guanji-native-ui-v2-preflight-1',
  target: `#${target}`,
  baseline: { versionName: '4.1.5', versionCode: 113, source: 'webview', commit: 'c113bcf4c7729d0978ded3f37f3ab76496334af1' },
  host: { activity: 'MainActivity', root: 'NativeRoot', routeHost: 'RouteHost', bottomTabs: 'GuanjiBottomTabs', sheetHost: 'SheetHost' },
  requiredEvidence: ['same viewport/density/fontScale/theme/fixture', 'WebView screenshot + bounds', 'Native screenshot + Compose bounds', 'topResumedActivity and back stack', 'animation keyframes', 'negative checks: clipping/ripple/scale/bounce/black-overlay/white-bar'],
  status: target === '273'
    ? 'scaffold-preflight'
    : prerequisite[target]
      ? 'ready-after-prerequisite-signoff'
      : `blocked-until-${Number(target) - 1}-signed-off`
};
const outDir = path.join(root, 'debug', 'visual-migration');
fs.mkdirSync(outDir, { recursive: true });
const output = path.join(outDir, `#${target}-preflight.json`);
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`PASS V2 preflight #${target}: ${path.relative(root, output)}`);
