/* ============================================================================
 * MllyCore — Dev Startup Script
 * ----------------------------------------------------------------------------
 * Starts Firebase emulators, waits for them to be ready, seeds test data,
 * then starts the Express server. All in one command.
 *
 * Usage: node scripts/start-dev.js
 * ==========================================================================*/

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const EMULATOR_HOST = 'localhost';
const EMULATOR_PORTS = { auth: 9099, firestore: 8080, storage: 9199, ui: 4000 };

function log(tag, msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] [${tag}] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPort(port, host, label, timeoutMs = 30000) {
  const start = Date.now();
  const http = require('http');
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://${host}:${port}`, (res) => {
          res.resume();
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      log('✅', `${label} ready on ${host}:${port}`);
      return true;
    } catch (_) {
      await sleep(500);
    }
  }
  log('⚠️', `${label} not ready after ${timeoutMs}ms, continuing anyway...`);
  return false;
}

async function runScript(scriptName) {
  log('📋', `Running ${scriptName}...`);
  try {
    execSync(`node ${path.join(ROOT, 'scripts', scriptName)}`, {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${EMULATOR_PORTS.firestore}`,
        FIREBASE_AUTH_EMULATOR_HOST: `${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`,
        FIREBASE_STORAGE_EMULATOR_HOST: `${EMULATOR_HOST}:${EMULATOR_PORTS.storage}`,
      }
    });
    log('✅', `${scriptName} completed`);
    return true;
  } catch (e) {
    log('❌', `${scriptName} failed: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   MllyCore — Dev Environment Starter        ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Kill any existing emulators
  try { execSync('pkill -f "firebase emulators" 2>/dev/null', { stdio: 'ignore' }); } catch (_) {}
  try { execSync('pkill -f "node server.js" 2>/dev/null', { stdio: 'ignore' }); } catch (_) {}
  await sleep(1000);

  // Step 1: Start Firebase emulators
  log('🔥', 'Starting Firebase emulators (auth, firestore, storage)...');
  const emulatorDir = ROOT;
  const emulatorProcess = spawn('npx', [
    'firebase', 'emulators:start',
    '--only', 'auth,firestore,storage',
    '--project', 'mllycore'
  ], {
    cwd: emulatorDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, JAVA_TOOL_OPTIONS: '-Xmx512m' }
  });

  emulatorProcess.stdout.on('data', (data) => {
    const line = data.toString().trim();
    if (line) process.stdout.write(`  [emulator] ${line}\n`);
  });
  emulatorProcess.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line && !line.includes('Deprecation')) process.stderr.write(`  [emulator] ${line}\n`);
  });

  emulatorProcess.on('error', (err) => {
    log('❌', `Emulator failed to start: ${err.message}`);
    process.exit(1);
  });

  // Step 2: Wait for emulators to be ready
  log('⏳', 'Waiting for emulators...');
  const authReady = await waitForPort(EMULATOR_PORTS.auth, EMULATOR_HOST, 'Auth Emulator');
  const firestoreReady = await waitForPort(EMULATOR_PORTS.firestore, EMULATOR_HOST, 'Firestore Emulator');
  const storageReady = await waitForPort(EMULATOR_PORTS.storage, EMULATOR_HOST, 'Storage Emulator');

  if (!authReady || !firestoreReady) {
    log('❌', 'Essential emulators not ready. Exiting.');
    process.exit(1);
  }

  log('✅', 'All emulators are running!');

  // Step 3: Seed data
  log('🌱', 'Seeding dev data...');
  await runScript('seed-dev-data.js');

  // Step 4: Start Express server
  log('🚀', 'Starting Express server...');
  const serverProcess = spawn('node', ['server.js'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: process.env.PORT || '3000',
      NODE_ENV: 'development',
    }
  });

  serverProcess.on('error', (err) => {
    log('❌', `Server failed: ${err.message}`);
  });

  serverProcess.on('exit', (code) => {
    log('🛑', `Server exited with code ${code}`);
    emulatorProcess.kill();
    process.exit(code || 0);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('🛑', 'Shutting down...');
    serverProcess.kill();
    emulatorProcess.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    serverProcess.kill();
    emulatorProcess.kill();
    process.exit(0);
  });

  log('✅✅✅', 'Dev environment is ready!');
  console.log('');
  console.log('  📍 Express:  http://localhost:3000');
  console.log('  📍 Emulator UI: http://localhost:4000');
  console.log('');
  console.log('  🔑 Admin: admin@test.com / password123');
  console.log('  🔑 User:  user@test.com / password123');
  console.log('');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
