'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app } = require('electron')

const { detectSensitive } = require(path.join(__dirname, '..', 'electron', 'sensitive.cjs'))
const { Store } = require(path.join(__dirname, '..', 'electron', 'store.cjs'))

app.disableHardwareAcceleration()

let failures = 0
const ok = (label, cond) => {
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
}

// Fixtures are assembled at runtime on purpose. A literal that looks like a live
// credential trips GitHub's push protection for anybody who clones this repo.
const fx = (...parts) => parts.join('')

const positives = [
  ['OpenAI key', fx('sk-', 'proj-', 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'), 'api-key'],
  ['GitHub token', fx('ghp_', 'abcdefghijklmnopqrstuvwxyz0123456789'), 'api-key'],
  ['AWS key', fx('AKIA', 'IOSFODNN7EXAMPLE'), 'api-key'],
  ['Stripe key', fx('sk_', 'live_', 'abcdefghijklmnopqrstuvwx'), 'api-key'],
  ['Slack token', fx('xoxb-', '123456789012', '-abcdefghijklm'), 'api-key'],
  ['private key', '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA', 'private-key'],
  [
    'JWT',
    fx(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      '.',
      'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      '.',
      'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    ),
    'jwt'
  ],
  ['身份证', '110105199003071234', 'id-card'],
  ['银行卡（Luhn 通过）', '4111111111111111', 'bank-card'],
  ['口令赋值', fx('password', ': ', 'hunter2hunter2'), 'credential'],
  ['带下划线的 key 赋值', fx('API_KEY', '=', 'abcd1234efgh5678'), 'credential']
]

const negatives = [
  ['中文说明文字', '把几段文字分开复制，再用 ClipNest 一次性合并粘贴，这就是区别'],
  ['命令', 'npm run dist:win'],
  ['链接', 'https://github.com/tzq-debug/clipnest'],
  ['订单号', '订单号 20261031-8842 · 收货人 张先生'],
  ['手机号（暂不识别）', '13800000000'],
  ['普通编号', '会议纪要：周四下午三点，讨论 v0.2 的加密存储方案'],
  ['随机 16 位数字（Luhn 不过）', '1234567890123456'],
  ['短文本', 'sk-1']
]

console.log('--- 应该识别为敏感 ---')
for (const [label, text, expected] of positives) {
  const got = detectSensitive(text)
  ok(`${label} → ${got ? got.kind : 'null'}（期望 ${expected}）`, got && got.kind === expected)
}

console.log('\n--- 不应该误判 ---')
for (const [label, text] of negatives) {
  const got = detectSensitive(text)
  ok(`${label} → ${got ? got.kind : 'null'}`, got === null)
}

app.whenReady().then(() => {
  console.log('\n--- 系统密钥加密往返 ---')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipnest-sensitive-'))
  const store = new Store(dir)
  ok('系统支持 safeStorage', store.canSeal() === true)

  const secret = 'sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
  const sealed = store.seal(secret)
  ok('可以加密', typeof sealed === 'string' && !sealed.includes('sk-proj'))
  ok('可以解密还原', store.revealText({ sealed }) === secret)

  store.add({ id: 's1', type: 'text', text: '', sealed, chars: secret.length, hash: 'h1', createdAt: Date.now() })
  store.dirty = true
  store.flush()
  const onDisk = fs.readFileSync(path.join(dir, 'history.json'), 'utf8')
  ok('落盘文件里搜不到明文', !onDisk.includes('sk-proj'))
  ok('从磁盘读回后仍可解密', store.revealText(store.get('s1')) === secret)

  fs.rmSync(dir, { recursive: true, force: true })
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
  app.exit(failures ? 1 : 0)
})
