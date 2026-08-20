import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lockPath = 'package-lock.json';
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

let changed = false;
if (lock.version !== pkg.version) {
  lock.version = pkg.version;
  changed = true;
}
if (lock.packages?.[''] && lock.packages[''].version !== pkg.version) {
  lock.packages[''].version = pkg.version;
  changed = true;
}

if (changed) {
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`V94: package-lock sincronizado para ${pkg.version}.`);
} else {
  console.log(`V94: package-lock já está sincronizado em ${pkg.version}.`);
}
