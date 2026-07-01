import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import { env } from '../config/env.js'

export const cookiePlugin = fp(async (app) => {
  await app.register(cookie, {
    secret: env.COOKIE_SECRET, // Signs cookies to prevent tampering
    hook: 'onRequest',
  })
})
