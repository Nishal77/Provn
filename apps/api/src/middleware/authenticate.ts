import type { FastifyReply, FastifyRequest } from 'fastify'
import type { JwtAccessPayload } from '@attesta/shared'

// Augment Fastify's Request type so req.user is available after authenticate()
// We use a separate `currentUser` key to avoid conflicting with @fastify/jwt's
// built-in `user` property (which is typed as string | object | Buffer).
declare module 'fastify' {
  interface FastifyRequest {
    currentUser: JwtAccessPayload
  }
}

/**
 * Middleware that validates the Bearer token in the Authorization header.
 * Use as a preHandler on any route that requires authentication.
 *
 * Example:
 *   fastify.get('/me', { preHandler: [authenticate] }, handler)
 */
export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
    // @fastify/jwt puts decoded payload on req.user — copy to our typed property
    req.currentUser = req.user as unknown as JwtAccessPayload
  } catch {
    reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Valid access token required.' },
    })
  }
}
