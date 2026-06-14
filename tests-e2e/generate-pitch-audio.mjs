// Generate the Aegis.0G demo pitch audio with edge-tts.
//
// Output: docs/demo/pitch.mp3 (single seamless file timed to the 3:30 video)
//
// Per-beat narration is timed to the video's existing cut. Each beat is
// generated with msedge-tts (Microsoft Edge's neural voices), then ffmpeg
// pads/trims it to its exact window so the final track lines up with the
// video frame-for-frame.
//
// Voice: en-US-AndrewMultilingualNeural — energetic, confident baritone,
// closest free analogue to ElevenLabs "Adam".

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegStatic from 'ffmpeg-static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO, 'docs', 'demo', 'pitch-beats');
const FINAL = path.join(REPO, 'docs', 'demo', 'pitch.mp3');

const VOICE = process.env.AEGIS_VOICE || 'en-US-AndrewMultilingualNeural';

// Beat = [startSec, endSec, narration]
// Beats are timed to the existing 3:30 video. Narration matches the
// submission description (energetic, pitch-style, "no kinda/basically").
const BEATS = [
  [0, 20,
    "Aegis turns 'I'm worried about something' into a principal-protected hedge in two clicks. " +
    "Crypto promised self-custody and got casinos. AI promised assistants and got opaque chatbots. " +
    "Aegis fuses them. An agent that talks to you in plain English, makes a recommendation you can " +
    "cryptographically verify, and settles a hedge on chain where your principal is mathematically protected."],
  [20, 37,
    "I'm on the live app. Connecting to 0G Aristotle, chain 16661, the actual mainnet. " +
    "Aegis runs every 0G module: Chain for settlement, Storage for the agreement, Compute for the " +
    "recommendation, and an OpenClaw skill so any agent can do exactly what I'm about to."],
  [37, 55,
    "I don't know what to hedge, so I ask. The recommendation runs on 0G Compute, inside a TEE enclave. " +
    "I ask for something safe. Gold comes back. The provider, the model, and the signature are recorded " +
    "on chain alongside the shield. The agent cannot lie about what it recommended."],
  [55, 68,
    "Aegis covers crypto, precious metals, energy, forex, and fifteen US real estate indexes. " +
    "Override the suggestion at will. One click to add A-USDC to your wallet right there."],
  [68, 74,
    "Pick one month for a quick projection."],
  [74, 91,
    "Bump it to six months. Here's the full math. Your principal is mathematically protected. " +
    "A clamp in the contract cannot pay out less than what you put in. " +
    "The exposure budget is what tracks gold. That is the only thing at risk."],
  [91, 115,
    "Approve the spend. Sign the on-chain createShield. Two real mainnet transactions. No custody on our side. " +
    "Aegis never sees your private key. The contract pulls the deposit, stores the parameters on chain, " +
    "and links the agreement document on 0G Storage. The shield is live. You walk away with a position " +
    "that mathematically cannot lose your money."],
  [115, 123,
    "Live on chainscan. One hundred A-USDC moved into the Aegis vault on 0G Aristotle. Real mainnet activity."],
  [123, 140,
    "Same shield, on 0G Storage. Every parameter we chose: principal, asset, duration, entry price, TEE inference proof, " +
    "immutably stored and fetchable by root hash. This is what an auditor or another agent pulls to reconstruct the trade."],
  [140, 147,
    "Every asset class we support. The same shield primitive works on each one."],
  [147, 150,
    "Leaderboard. Real on-chain PnL."],
  [150, 157,
    "Dashboard: protected positions, marked live. A principal floor on every row."],
  [157, 161,
    "Now the agent layer. Every read here is wallet-signed."],
  [161, 180,
    "I mint a session key. Label it Claude Smart Investor. Pick the scopes: recommend, shield, read. " +
    "The key is wallet-derived. I sign once. The agent never touches my wallet. " +
    "Aegis stores only a hash, returns the raw key one time."],
  [180, 183,
    "Sign. Saved."],
  [183, 186,
    "Paste the key. Copy the bootstrap."],
  [186, 198,
    "That bootstrap pastes into any agent. Claude, GPT, Cursor, a custom one. " +
    "It fetches our OpenClaw skill manifest, learns the endpoints, and starts acting on my behalf. " +
    "Verifiably. Every call recorded."],
  [198, 210,
    "Real Claude agents already trading on this wallet. Different strategies, every action signed. " +
    "This is the future of agentic finance. One that cannot lose your money. Aegis."],
];

const TOTAL_SEC = BEATS[BEATS.length - 1][1];
const FFMPEG = ffmpegStatic;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d.toString(); });
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exit ${code}\n${err.slice(-500)}`)));
  });
}

async function ffprobeDuration(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-i', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stderr.on('data', d => { out += d.toString(); });
    p.on('close', () => {
      const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (!m) return reject(new Error(`no duration in ffmpeg output:\n${out.slice(-400)}`));
      const sec = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
      resolve(sec);
    });
  });
}

async function synthBeat(idx, text, targetSec) {
  // Pick a rate that gets close to targetSec on the first pass.
  // Edge neural voices speak ~2.6 wps at default rate.
  const words = text.split(/\s+/).filter(Boolean).length;
  const naturalSec = words / 2.6;
  let ratePct = Math.round(((naturalSec / targetSec) - 1) * 100);
  // Clamp so it never sounds chipmunk or sluggish
  ratePct = Math.max(-15, Math.min(25, ratePct));
  const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;

  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
    rate: rateStr,
    pitch: '+0Hz',
    volume: '+0%',
  });

  const rawPath = path.join(OUT_DIR, `beat_${String(idx).padStart(2, '0')}_raw.mp3`);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(rawPath);
    const { audioStream } = tts.toStream(text);
    audioStream.on('data', chunk => ws.write(chunk));
    audioStream.on('end', () => { ws.end(); ws.on('close', resolve); });
    audioStream.on('error', reject);
  });

  const actual = await ffprobeDuration(rawPath);
  console.log(`  beat ${idx}: ${words}w · rate ${rateStr} · ${actual.toFixed(2)}s / ${targetSec}s target`);
  return { rawPath, actual };
}

async function fitToWindow(rawPath, actualSec, targetSec, outPath) {
  // If actual is shorter, pad with trailing silence; if longer, speed up
  // with atempo just enough to fit. atempo accepts 0.5-100 per stage.
  let filter;
  if (actualSec <= targetSec) {
    const pad = (targetSec - actualSec).toFixed(3);
    filter = `apad=pad_dur=${pad}`;
  } else {
    const speedup = (actualSec / targetSec).toFixed(4);
    filter = `atempo=${speedup}`;
  }
  await run(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-i', rawPath,
    '-af', `${filter},aresample=44100`,
    '-t', String(targetSec),
    '-c:a', 'libmp3lame', '-b:a', '128k',
    outPath,
  ]);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Voice: ${VOICE}`);
  console.log(`Beats: ${BEATS.length} · target total: ${TOTAL_SEC}s\n`);

  const fitted = [];
  for (let i = 0; i < BEATS.length; i++) {
    const [start, end, text] = BEATS[i];
    const target = end - start;
    const { rawPath, actual } = await synthBeat(i, text, target);
    const outPath = path.join(OUT_DIR, `beat_${String(i).padStart(2, '0')}.mp3`);
    await fitToWindow(rawPath, actual, target, outPath);
    fitted.push(outPath);
  }

  // Concat list
  const listPath = path.join(OUT_DIR, '_concat.txt');
  fs.writeFileSync(listPath, fitted.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));

  console.log('\nConcatenating...');
  await run(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-c:a', 'libmp3lame', '-b:a', '192k',
    FINAL,
  ]);

  const finalDur = await ffprobeDuration(FINAL);
  console.log(`\nDone: ${FINAL}`);
  console.log(`Final duration: ${finalDur.toFixed(2)}s (target ${TOTAL_SEC}s)`);
}

main().catch(e => { console.error(e); process.exit(1); });
