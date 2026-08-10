// bump #105/#106：versionCode 27→28、versionName 3.6→3.7、资源 ?v=88→89、about-ver
const fs = require('fs');

const g = 'C:/Users/43124/Desktop/test/guanji-app/android/app/build.gradle';
let s = fs.readFileSync(g, 'utf8');
s = s.replace('versionCode 27', 'versionCode 28');
s = s.replace('versionName "3.6"', 'versionName "3.7"');
fs.writeFileSync(g, s, 'utf8');

const h = 'C:/Users/43124/Desktop/test/guanji-app/www/index.html';
let t = fs.readFileSync(h, 'utf8');
const n89 = (t.match(/\?v=89/g) || []).length;
t = t.replace(/\?v=88/g, '?v=89');
t = t.replace('>v3.6 · 数据仅存本地<', '>v3.7 · 数据仅存本地<');
fs.writeFileSync(h, t, 'utf8');

const r = fs.readFileSync(g, 'utf8');
const r2 = fs.readFileSync(h, 'utf8');
console.log(JSON.stringify({
  gradleVc: (r.match(/versionCode (\d+)/) || [])[1],
  gradleVn: (r.match(/versionName "([^"]+)"/) || [])[1],
  v89: (r2.match(/\?v=89/g) || []).length,
  v88: (r2.match(/\?v=88/g) || []).length,
  aboutVer: (r2.match(/>v\d+\.\d+ · 数据仅存本地</) || [])[0]
}, null, 2));
