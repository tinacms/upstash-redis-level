/**
 Copyright 2023 Forestry.io Holdings, Inc.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */


import {RedisLevel} from './index'
import 'isomorphic-fetch'
import {Redis} from '@upstash/redis'

const ModuleError = require('module-error')

const keyNotFoundError = (key: string) => new ModuleError(`Key ${key} was not found`, {
  code: 'LEVEL_NOT_FOUND',
})

describe('redis-level', () => {
  let redis: Redis
  let level: RedisLevel
  beforeEach(() => {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || 'http://localhost:8079',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || 'mytoken',
      automaticDeserialization: true,
    })
  })

  describe('json encoding', () => {
    let namespace = `test-${Math.random()}`
    beforeEach(async () => {
      level = new RedisLevel<string, string>({
        redis,
        namespace,
        keyEncoding: 'json',
        valueEncoding: 'json',
      })
    })

    test('put and get', async () => {
      const data: Record<string,any>[] = [
        { key: '0', value: 0 },
        { key: '1', value: 1 },
        { key: '2', value: 'a string' },
        { key: '3', value: true },
        { key: '4', value: false }
      ]
      const operations = Object.values(data).map(entry => ({ type: 'put', ...entry }))
      await level.batch(operations as any[])
      const items = await level.iterator().all()
      expect(items).toEqual(data.map(kv => [kv.key, kv.value]))
    })
  })

  describe('default encoding', () => {
    beforeEach(async () => {
      level = new RedisLevel<string, string>({
        redis,
        namespace: `test-${Math.random()}`
      })
    })

    test('put and get', async () => {
      await level.put('mykey', 'myvalue1')
      expect(await level.get('mykey')).toEqual('myvalue1')
    })

    test('sublevel put and get', async () => {
      const sublevel = level.sublevel('sublevel')
      await sublevel.put('mykey', 'myvalue2')
      expect(await sublevel.get('mykey')).toEqual('myvalue2')
    })

    test('sub sublevel put and get', async () => {
      const sublevel = level.sublevel('sublevel')
      const subsublevel = sublevel.sublevel('subsublevel')
      await subsublevel.put('mykey', 'myvalue3')
      expect(await subsublevel.get('mykey')).toEqual('myvalue3')
    })

    test('put false', async () => {
      // @ts-ignore
      await level.put('mykey', false)
      expect(await level.get('mykey')).toEqual('false')
    })

    test('put quoted values', async () => {
      await level.put('mykey', '"foo"')
      expect(await level.get('mykey')).toEqual('"foo"')
    })

    test('iterator without limits', async () => {
      const pairs = [
        ['foo1', 'bar1'],
        ['foo2', 'bar2'],
        ['foo3', 'bar3'],
      ]
      await level.batch().put(pairs[0][0], pairs[0][1]).put(pairs[1][0], pairs[1][1]).put(pairs[2][0], pairs[2][1]).write()
      const iterator = level.iterator()
      const results = await iterator.all()
      expect(results).toHaveLength(3)
      expect(pairs[0]).toEqual(results[0])
    })

    test('value iterator without limits', async () => {
      const pairs = [
        ['foo1', 'bar1'],
        ['foo2', 'bar2'],
        ['foo3', 'bar3'],
      ]
      await level.batch().put(pairs[0][0], pairs[0][1]).put(pairs[1][0], pairs[1][1]).put(pairs[2][0], pairs[2][1]).write()
      const iterator = level.values()
      const results = await iterator.all()
      expect(results).toHaveLength(3)
      expect(pairs.map(pair => pair[1])).toEqual(results)
    })

    test('unicode values', async () => {
      await level.put('mykey', '🐄')
      expect(await level.get('mykey')).toEqual('🐄')
    })

    test('unicode keys', async () => {
      await level.put('👍', 'myvalue')
      const iterator = level.iterator()
      let found = false
      for await (const [key, value] of iterator) {
        if (key === '👍') {
          expect(value).toEqual('myvalue')
          found = true
          break
        }
      }
      expect(found).toEqual(true)
    })

    test.skip('ordering', async () => {
      const pairs =  [ [ '', 'empty' ], [ '\t', '\t' ], [ '12', '12' ], [ '2', '2' ], [ 'a', 'A' ], [ 'a🐄', 'A🐄' ], [ 'b', 'B' ], [ 'd', 'D' ], [ 'e', 'E' ], [ 'f', 'F' ], [ 'ff', 'FF' ], [ '~', '~' ], [ '🐄', '🐄' ] ]
      const batch = await level.batch()
      for (const pair of pairs) {
        batch.put(pair[0], pair[1])
      }
      await batch.write()

      const iterator = level.iterator()
      const results = await iterator.all()
      console.log(results.map(result => result[0]))
      // TODO https://github.com/upstash/upstash-redis/issues/400
    })

    test.skip('lexical sorting', async () => {
      const pairs =  [ [ '', 'empty' ], [ '\t', '\t' ], [ '12', '12' ], [ '2', '2' ], [ 'a', 'A' ], [ 'a🐄', 'A🐄' ], [ 'b', 'B' ], [ 'd', 'D' ], [ 'e', 'E' ], [ 'f', 'F' ], [ 'ff', 'FF' ], [ '~', '~' ], [ '🐄', '🐄' ] ]
      const orderedKeys = pairs.map(pair => pair[0]).sort()
      const orderedEncodedKeys = orderedKeys.map(key => encodeURIComponent(key)).sort().map(key => decodeURIComponent(key))
      console.log({orderedKeys})
      console.log({orderedEncodedKeys})
      // TODO this test isn't complete and won't work correctly with upstash
      // TODO https://github.com/upstash/upstash-redis/issues/400
    })

    test('clear range', async () => {
      await level.put('a', 'a')
      await level.put('b', 'b')
      await level.clear({ gte: 'b' })
      const items = await level.iterator().all()
      expect(items).toHaveLength(1)
      expect(items[0]).toEqual(['a', 'a'])
    })
  })
})
