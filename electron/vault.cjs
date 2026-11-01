'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

/**
 * Optional vault for the clipboard history.
 *
 * The password never touches the disk: only a random salt and a small
 * "canary" value are stored in security.json. The data key is derived with
 * scrypt and everything else is AES-256-GCM, so a wrong password simply fails
 * the authentication tag instead of decrypting into garbage.
 */

const MAGIC = Buffer.from('CNV1')
const IV_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32
const SALT_LEN = 16
const CHECK_PLAIN = Buffer.from('clipnest-vault-check')
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, KEY_LEN, SCRYPT)
}

function encrypt(key, plain) {
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body])
}

function decrypt(key, payload) {
  if (!isEncrypted(payload)) throw new Error('not a vault payload')
  const iv = payload.subarray(MAGIC.length, MAGIC.length + IV_LEN)
  const tag = payload.subarray(MAGIC.length + IV_LEN, MAGIC.length + IV_LEN + TAG_LEN)
  const body = payload.subarray(MAGIC.length + IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()])
}

function isEncrypted(payload) {
  return (
    Buffer.isBuffer(payload) &&
    payload.length >= MAGIC.length + IV_LEN + TAG_LEN &&
    payload.subarray(0, MAGIC.length).equals(MAGIC)
  )
}

function atomicWrite(file, data) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

class Vault {
  constructor(dir) {
    this.file = path.join(dir, 'security.json')
    this.state = { enabled: false }
    try {
      this.state = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      /* no vault yet */
    }
  }

  get enabled() {
    return Boolean(this.state && this.state.enabled)
  }

  persist(state) {
    this.state = state
    atomicWrite(this.file, JSON.stringify(state, null, 2))
  }

  /** Turn encryption on and hand back the derived key. */
  create(password) {
    const salt = crypto.randomBytes(SALT_LEN)
    const key = deriveKey(password, salt)
    this.persist({
      enabled: true,
      version: 1,
      salt: salt.toString('base64'),
      check: encrypt(key, CHECK_PLAIN).toString('base64'),
      createdAt: Date.now()
    })
    return key
  }

  /** Returns the derived key when the password is right, null otherwise. */
  unlock(password) {
    if (!this.enabled || !this.state.salt || !this.state.check) return null
    try {
      const salt = Buffer.from(this.state.salt, 'base64')
      const key = deriveKey(password, salt)
      const plain = decrypt(key, Buffer.from(this.state.check, 'base64'))
      return plain.equals(CHECK_PLAIN) ? key : null
    } catch {
      return null
    }
  }

  disable() {
    this.persist({ enabled: false })
  }
}

module.exports = { Vault, encrypt, decrypt, isEncrypted }
