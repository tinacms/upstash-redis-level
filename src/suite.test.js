require('isomorphic-fetch')

const test = require('tape')
const suite = require('abstract-level/test')
const { RedisLevel } = require('../dist/index.js')
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'http://localhost:8079',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'example-token',
})

suite({
  test,
  factory (options) {
    const namespace = `test-${Math.random().toString(36).slice(2)}`
    return new RedisLevel({
      ...options,
      namespace,
      redis,
    })
  }
})
