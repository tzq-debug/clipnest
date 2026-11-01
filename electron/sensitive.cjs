'use strict'

/**
 * Guesses whether a piece of text looks like a credential.
 *
 * Precision matters more than recall here: a false positive hides something the
 * user legitimately copied, so every rule is anchored to a well-known prefix,
 * a structure that is hard to fake, or a checksum.
 */

const RULES = [
  {
    kind: 'private-key',
    label: '私钥',
    test: (t) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)
  },
  {
    kind: 'api-key',
    label: 'API 密钥',
    test: (t) =>
      /\b(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|ghu_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|glpat-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk_live_[A-Za-z0-9]{20,}|rk_live_[A-Za-z0-9]{20,})\b/.test(
        t
      )
  },
  {
    kind: 'jwt',
    label: 'JWT 令牌',
    test: (t) => /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(t)
  },
  {
    kind: 'id-card',
    label: '身份证号',
    test: (t) =>
      /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/.test(t)
  },
  {
    kind: 'bank-card',
    label: '银行卡号',
    test: (t) => {
      const m = t.match(/\b(?:\d[ -]?){15,18}\d\b/g)
      if (!m) return false
      return m.some((raw) => {
        const digits = raw.replace(/[ -]/g, '')
        return digits.length >= 16 && digits.length <= 19 && luhn(digits)
      })
    }
  },
  {
    kind: 'credential',
    label: '账号口令',
    test: (t) =>
      /(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret)\s*[:=]\s*\S{6,}/i.test(t)
  }
]

/** Luhn checksum, used to keep random 16-digit numbers from matching. */
function luhn(digits) {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i])
    if (Number.isNaN(n)) return false
    if (double) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    double = !double
  }
  return sum % 10 === 0
}

/** Returns { kind, label } when the text looks sensitive, otherwise null. */
function detectSensitive(text) {
  if (!text || text.length < 8) return null
  // A wall of prose is never a single credential; skip the regex work.
  if (text.length > 4000) {
    const head = text.slice(0, 4000)
    for (const rule of RULES) if (rule.test(head)) return { kind: rule.kind, label: rule.label }
    return null
  }
  for (const rule of RULES) {
    if (rule.test(text)) return { kind: rule.kind, label: rule.label }
  }
  return null
}

module.exports = { detectSensitive }
