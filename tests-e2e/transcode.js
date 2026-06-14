const path = require('path');
const fs   = require('fs');
const cp   = require('child_process');
const ffmpeg = require('ffmpeg-static');

const dir = path.join(__dirname, 'recordings');
const webms = fs.readdirSync(dir).filter((f) => f.endsWith('.webm'));
if (webms.length === 0) { console.error('no webm files in', dir); process.exit(1); }
// pick the largest
let best = webms[0];
let bestBytes = 0;
for (const f of webms) {
  const b = fs.statSync(path.join(dir, f)).size;
  if (b > bestBytes) { bestBytes = b; best = f; }
}
const inFile  = path.join(dir, best);
const outFile = inFile.replace(/\.webm$/i, '.mp4');
console.log('IN :', inFile);
console.log('OUT:', outFile);

const args = ['-y', '-i', inFile,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  outFile];
const proc = cp.spawnSync(ffmpeg, args, { stdio: 'inherit' });
process.exit(proc.status || 0);
