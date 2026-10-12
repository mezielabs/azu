import { randomUUID } from 'node:crypto'
import User from '#models/user'

/**
 * A user with the given role and a unique email, so tests don't depend
 * on seeded data.
 */
export function createUser(role: User['role']) {
  return User.create({
    fullName: `${role} tester`,
    email: `${role}-${randomUUID().slice(0, 8)}@azu.test`,
    password: 'secret-password',
    role,
  })
}
