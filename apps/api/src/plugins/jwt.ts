import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import { env } from '../config/env.js'

// Single @fastify/jwt registration for access tokens.
// Refresh tokens are opaque random hex strings (stored hashed in DB + Redis),
// NOT JWTs — opaque tokens reveal zero information if intercepted.
export const jwtPlugin = fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: '15m' },
  })
})
