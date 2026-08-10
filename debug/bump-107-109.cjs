// bump #107/#108/#109：versionCode 28→29、versionName 3.7→3.8、资源 ?v=89→90、about-ver
const fs = require('fs');

const g = 'C:/Users/43124/Desktop/test/guanji-app/android/app/build.gradle';
let s = fs.readFileSync(g, 'utf8');
s = s.replace('versionCode 28', 'versionCode 29');
s = s.replace('versionName "3.7"', 'versionName "3.8"');
fs.writeFileSync(g, s, 'utf8');

const h = 'C:/Users/43124/Desktop/test/guanji-app/www/index.html';
let t = fs.readFileSync(h, 'utf8');
t = t.replace(/\?v=89/g, '?v=90');
t = t.replace('>v3.7 · 数据仅存本地<', '>v3.8 · 数据仅存本地<');
fs.writeFileSync(h, t, 'utf8');

const r = fs.readFileSync(g, 'utf8');
const r2 = fs.readFileSync(h, 'utf8');
console.log(JSON.stringify({
  gradleVc: (r.match(/versionCode (\d+)/) || [])[1],
  gradleVn: (r.match(/versionName "([^"]+)"/) || [])[1],
  v90: (r2.match(/\?v=90/g) || []).length,
  v89: (r2.match(/\?v=89/g) || []).length,
  aboutVer: (r2.match(/>v\d+\.\d+ · 数据仅存本地</) || [])[0]
}, null, 2));
