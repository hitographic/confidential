export function validatePasswordStrength(pw) {
  const len = pw.length >= 8 && pw.length <= 20
  const upper = /[A-Z]/.test(pw)
  const lower = /[a-z]/.test(pw)
  const special = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pw)
  const score = [len, upper, lower, special].filter(Boolean).length
  return { len, upper, lower, special, score, valid: score === 4 }
}

export function passwordIssues(pw) {
  const v = validatePasswordStrength(pw)
  if (v.valid) return null
  return 'Password harus 8-20 karakter, huruf besar, huruf kecil, dan karakter unik (!@#$%^&*)'
}
