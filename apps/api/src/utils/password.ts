import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/** Hash a plain-text password. Use before storing in DB. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

/** Compare plain-text against stored hash. Constant-time to prevent timing attacks. */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
