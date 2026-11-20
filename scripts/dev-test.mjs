// One command for working on the app against dummy data, with no way to reach production:
//
//   npm run dev:test
//
// Starts the stand-in backend (scripts/fake-supabase.mjs: an in-memory Postgres running the real
// migrations and the demo seed) and the app pointed at it. The two addresses below are handed to
// the app directly, so no .env file is read and nothing real can be configured by mistake.
// Everything lives in memory: stop it and the data is gone; start it and it is fresh again.
import { spawn } from 'node:child_process'

// The usual ports, unless another copy has to run beside this one (for example an automated check while
// you keep working): APP_PORT=5184 BACKEND_PORT=54331 npm run dev:test
const APP_PORT = process.env.APP_PORT ?? '5174'
const BACKEND_PORT = process.env.BACKEND_PORT ?? '54321'
const BACKEND = `http://127.0.0.1:${BACKEND_PORT}`
const APP = `http://localhost:${APP_PORT}`
const children = []
let stopping = false

function start(name, command, args, env = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
  const relay = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split('\n')) if (line.trim()) out.write(`[${name}] ${line}\n`)
    })
  relay(child.stdout, process.stdout)
  relay(child.stderr, process.stderr)
  child.on('exit', (code) => {
    if (stopping) return
    console.error(`[${name}] stopped (${code}). Stopping the rest.`)
    stop(code || 1)
  })
  children.push(child)
}

function stop(code = 0) {
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 300)
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

start('backend', process.execPath, ['scripts/fake-supabase.mjs'], { PORT: BACKEND_PORT })
start('app', 'node_modules/.bin/vite', ['--mode', 'fake', '--port', APP_PORT, '--strictPort'], {
  VITE_SUPABASE_URL: BACKEND,
  VITE_SUPABASE_ANON_KEY: 'test-key',
})

setTimeout(() => {
  console.log(`
  Test environment, dummy data only.
    App:      ${APP}
    Backend:  ${BACKEND}   (in memory, fresh on every start)

    admin@loko.test   / admin123    main admin
    viewer@loko.test  / viewer123   signed in, not an admin
    daniel@loko.test                pending invitation: Entrar > Primeiro acesso, code 12345678

  Emails are printed here instead of being sent. Ctrl+C stops both.
`)
}, 2500)
