require('isomorphic-fetch')

const test = require('tape')
const suite = require('abstract-level/test')
const { RedisLevel } = require('../dist/index.js')
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.REDIS_UPSTASH_URL || 'http://localhost:8079',
  token: 'example_token',
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
