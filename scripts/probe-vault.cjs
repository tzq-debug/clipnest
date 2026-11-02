'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app } = require('electron')

const { Store } = require(path.join(__dirname, '..', 'electron', 'store.cjs'))

app.disableHardwareAcceleration()

let failures = 0
const ok = (label, cond) => {
  if (!cond) failures += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
}

app.whenReady().then(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipnest-vault-'))
  const jsonFile = path.join(dir, 'history.json')
  const encFile = path.join(dir, 'history.enc')

  const s1 = new Store(dir)
  s1.add({
    id: 'a1',
    type: 'text',
    text: 'hello secret',
    chars: 12,
    hash: 'h1',
    createdAt: Date.now(),
    pinned: false
  })
  s1.dirty = true
  s1.flush()
  ok('明文 history.json 已写入', fs.existsSync(jsonFile))

  const png = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.png'))
  const asset = s1.saveImageBuffer(png)
  ok('加密前图片可读', Boolean(s1.readImageAsset(asset.image)))

  const res = s1.enableEncryption('pw1234')
  ok('开启加密成功', res.ok)
  ok('history.json 已删除', !fs.existsSync(jsonFile))
  ok('history.enc 已生成', fs.existsSync(encFile))
  ok('history.enc 不含明文', !fs.readFileSync(encFile, 'utf8').includes('hello secret'))
  ok('图片文件已加密（CNV1 头）', fs.readFileSync(path.join(dir, 'images', asset.image)).subarray(0, 4).toString() === 'CNV1')

  const s2 = new Store(dir)
  ok('重开后处于锁定态', s2.locked === true)
  ok('锁定态不加载条目', s2.all().length === 0)
  ok('错误密码被拒绝', s2.vault.unlock('wrong') === null)

  const key = s2.vault.unlock('pw1234')
  ok('正确密码通过', Boolean(key))
  const count = s2.unlock(key)
  ok('解锁后条目回来', count === 1 && s2.all()[0].text === 'hello secret')
  ok('解锁后图片可解密', Boolean(s2.readImageAsset(asset.image)))

  // 锁定态下即使触发保存，也不能把加密文件覆盖成空表
  const before = fs.readFileSync(encFile)
  const s3 = new Store(dir)
  s3.dirty = true
  s3.flush()
  ok('锁定态不会覆盖加密文件', fs.readFileSync(encFile).equals(before))

  const off = s2.disableEncryption('wrong')
  ok('错误密码无法关闭加密', off.ok === false)
  const off2 = s2.disableEncryption('pw1234')
  ok('正确密码可以关闭加密', off2.ok === true)
  ok('history.json 恢复', fs.existsSync(jsonFile))
  ok('history.enc 已删除', !fs.existsSync(encFile))
  ok('图片已解密', fs.readFileSync(path.join(dir, 'images', asset.image)).subarray(0, 4).toString() !== 'CNV1')
  ok('解密后条目仍在', JSON.parse(fs.readFileSync(jsonFile, 'utf8')).items[0].text === 'hello secret')

  fs.rmSync(dir, { recursive: true, force: true })
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
  app.exit(failures ? 1 : 0)
})
