import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import process from 'node:process'
import electronPath from 'electron'

const server = await createServer({
  server: { port: 5173, strictPort: true }
})
await server.listen()
server.printUrls()

const url = `http://localhost:${server.config.server.port ?? 5173}`

// Extra flags for the Electron binary, e.g. CLIPNEST_ELECTRON_ARGS="--no-sandbox"
// when developing inside a restricted environment.
const extraArgs = (process.env.CLIPNEST_ELECTRON_ARGS || '').split(' ').filter(Boolean)

const childEnv = { ...process.env, VITE_DEV_SERVER_URL: url, NODE_ENV: 'development' }
// Some IDEs and embedded terminals export this; inheriting it makes the Electron
// binary behave like plain Node, so `require('electron').app` comes back undefined.
delete childEnv.ELECTRON_RUN_AS_NODE

const child = spawn(electronPath, ['.', ...extraArgs], {
  stdio: 'inherit',
  env: childEnv
})

const shutdown = async (code = 0) => {
  try {
    if (!child.killed) child.kill()
    await server.close()
  } finally {
    process.exit(code)
  }
}

child.on('close', (code) => shutdown(code ?? 0))
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
