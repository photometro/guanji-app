// bump #110/#111：versionCode 29→30、versionName 3.8→3.9、资源 ?v=91→92、about-ver
const fs = require('fs');

const g = 'C:/Users/43124/Desktop/test/guanji-app/android/app/build.gradle';
let s = fs.readFileSync(g, 'utf8');
s = s.replace('versionCode 29', 'versionCode 30');
s = s.replace('versionName "3.8"', 'versionName "3.9"');
fs.writeFileSync(g, s, 'utf8');

const h = 'C:/Users/43124/Desktop/test/guanji-app/www/index.html';
let t = fs.readFileSync(h, 'utf8');
t = t.replace(/\?v=91/g, '?v=92');
t = t.replace('>v3.8 · 数据仅存本地<', '>v3.9 · 数据仅存本地<');
fs.writeFileSync(h, t, 'utf8');

const r = fs.readFileSync(g, 'utf8');
const r2 = fs.readFileSync(h, 'utf8');
console.log(JSON.stringify({
  gradleVc: (r.match(/versionCode (\d+)/) || [])[1],
  gradleVn: (r.match(/versionName "([^"]+)"/) || [])[1],
  v92: (r2.match(/\?v=92/g) || []).length,
  aboutVer: (r2.match(/>v\d+\.\d+ · 数据仅存本地</) || [])[0]
}, null, 2));
