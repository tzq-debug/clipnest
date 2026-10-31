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
const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url, NODE_ENV: 'development' }
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
