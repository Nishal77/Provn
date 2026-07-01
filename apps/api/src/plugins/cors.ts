import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { corsOrigins } from '../config/env.js'

export const corsPlugin = fp(async (app) => {
  await app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Required for cookies
  })
})
