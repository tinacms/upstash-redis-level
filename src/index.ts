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
import {
  AbstractDatabaseOptions,
  AbstractIterator,
  AbstractLevel,
  AbstractOpenOptions,
} from 'abstract-level'
import { NextCallback } from 'abstract-level/types/abstract-iterator'
import ModuleError from 'module-error'
import { Redis } from '@upstash/redis'
import { ZRangeCommandOptions } from '@upstash/redis/types/pkg/commands/zrange'

const DEFAULT_LIMIT = 50

const encode = (value: any) => {
  return encodeURIComponent(value)
}
const decode = (value: string) => {
  return decodeURIComponent(value)
}
export type RedisLevelOptions<K, V> = {
  redis: Redis
  namespace?: string
} & AbstractDatabaseOptions<K, V>

declare type BatchOperation = BatchPutOperation | BatchDelOperation

/**
 * A _put_ operation to be committed by a {@link RedisLevel}.
 */
declare interface BatchPutOperation {
  /**
   * Type of operation.
   */
  type: 'put'

  /**
   * Key of the entry to be added to the database.
   */
  key: string

  /**
   * Value of the entry to be added to the database.
   */
  value: string
}

/**
 * A _del_ operation to be committed by a {@link RedisLevel}.
 */
declare interface BatchDelOperation {
  /**
   * Type of operation.
   */
  type: 'del'

  /**
   * Key of the entry to be deleted from the database.
   */
  key: string
}

declare interface ClearOptions<KDefault> {
  gt?: KDefault
  gte?: KDefault
  lt?: KDefault
  lte?: KDefault
  limit: number
  reverse: boolean
  keyEncoding: string
  valueEncoding: string
}

declare interface IteratorOptions<KDefault> {
  offset: number
  limit: number
  keyEncoding: string
  valueEncoding: string
  reverse: boolean
  keys: boolean
  values: boolean
  gt?: KDefault
  gte?: KDefault
  lt?: KDefault
  lte?: KDefault
}

const queryFromOptions = (key: string, options: IteratorOptions<any>) => {
  let query: [
    key: string,
    min: `(${string}` | `[${string}` | "-" | "+",
    max: `(${string}` | `[${string}` | "-" | "+",
    options:  {
      byLex: true,
    } & ZRangeCommandOptions
  ] = [key, '-', '+', { byLex: true, rev: options.reverse }]

  const lowerBound = options.gte !== undefined ? options.gte : options.gt !== undefined ? options.gt : '-'
  const exclusiveLowerBound = options.gte === undefined && options.gt !== undefined
  const upperBound = options.lte !== undefined ? options.lte : options.lt !== undefined ? options.lt : '+'
  const exclusiveUpperBound = options.lte === undefined && options.lt !== undefined
  const noLowerBound = lowerBound === '-' || lowerBound === '+'
  const noUpperBound = upperBound === '-' || upperBound === '+'
  if (options.reverse) {
    query[1] = noUpperBound ? upperBound : exclusiveUpperBound ? `(${encode(upperBound)}` : `[${encode(upperBound)}`
    query[2] = noLowerBound ? lowerBound : exclusiveLowerBound ? `(${encode(lowerBound)}` : `[${encode(lowerBound)}`
  } else {
    query[1] = noLowerBound ? lowerBound : exclusiveLowerBound ? `(${encode(lowerBound)}` : `[${encode(lowerBound)}`
    query[2] = noUpperBound ? upperBound : exclusiveUpperBound ? `(${encode(upperBound)}` : `[${encode(upperBound)}`
  }

  query[3] = {
    byLex: true,
    rev: options.reverse,
  }

  if (options.limit !== Infinity) {
    query[3] = {
      ...query[3],
      count: options.limit,
      offset: options.offset,
    }
  }

  return query
}

class RedisIterator<KDefault, VDefault> extends AbstractIterator<
  RedisLevel<KDefault, VDefault>,
  KDefault,
  VDefault
> {
  private redis: Redis
  private options: IteratorOptions<KDefault>
  private offset: number
  private readonly resultLimit: number
  private results: any[]
  private finished: boolean

  constructor(db: RedisLevel<KDefault, VDefault>, options: IteratorOptions<KDefault>) {
    super(db, options)
    this.redis = db.redis
    this.options = options
    this.resultLimit = options.limit !== Infinity && options.limit >= 0 ? options.limit : DEFAULT_LIMIT
    this.offset = options.offset || 0
    this.results = []
    this.finished = false
  }

  async _next(callback: NextCallback<KDefault, VDefault>) {
    if (this.finished) {
      return this.db.nextTick(callback, null)
    }
    if (this.results.length === 0) {
      const getKeys = this.options.keys
      const getValues = this.options.values
      const query = queryFromOptions(this.db.zKey, { ...this.options, offset: this.offset, limit: this.resultLimit })
      let keys: string[] = []
      try {
        keys = await this.redis.zrange<string[]>(...query)
      } catch (e) {
        console.log(e)
      }
      if (!keys || keys.length === 0) {
        this.finished = true
        return this.db.nextTick(callback, null)
      }
      const values = getValues ? await this.redis.hmget(this.db.hKey, ...keys) : null
      for (const key of keys) {
        const decodedKey = decode(key)
        const result = []
        result.push(getKeys ? decodedKey : undefined)
        if (getValues) {
          if (!values) {
            result.push(undefined)
          } else {
            result.push(values[key] !== undefined ? decode(String(values[key])) : undefined)
          }
        }
        this.results.push(result)
      }
      this.offset += this.resultLimit
    }
    const result = this.results.shift()
    return this.db.nextTick(callback, null, ...result)
  }
}

export class RedisLevel<KDefault = string, VDefault = string> extends AbstractLevel<string, KDefault, VDefault> {
  public readonly redis: Redis
  public readonly hKey: string
  public readonly zKey: string

  constructor(options: RedisLevelOptions<KDefault, VDefault>) {
    super({ encodings: { utf8: true }, snapshots: false }, options)
    this.redis = options.redis
    const namespace = options.namespace || 'level'
    this.hKey = `${namespace}:h`
    this.zKey = `${namespace}:z`
  }

  get type() {
    return '@upstash/redis'
  }

  async _open(options: AbstractOpenOptions, callback: (error?: Error) => void) {
    this.nextTick(callback)
  }

  async _close(callback: (error?: Error) => void) {
    this.nextTick(callback)
  }

  async _get(key: string, options: { keyEncoding: 'utf8', valueEncoding: 'utf8' }, callback: (error?: Error, value?: string) => void) {
    const data = await this.redis.hget<string>(this.hKey, encode(key))
    if (data !== null) {
      return this.nextTick(callback, null, decode(data))
    } else {
      return this.nextTick(
        callback,
        new ModuleError(`Key '${key}' was not found`, {
          code: 'LEVEL_NOT_FOUND',
        })
      )
    }
  }

  async _getMany(keys: string[], options: { keyEncoding: 'utf8', valueEncoding: 'utf8 '}, callback: (error?: Error, value?: string) => void) {
    try {
      const data = await this.redis.hmget(this.hKey, ...keys.map((key) => encode(key)))
      // TODO not sure if the we need to encode the key when retrieving it from the data object...
      if (data) {
        return this.nextTick(callback, null, keys.map((key) => data[key] ? decode(String(data[key])) : undefined))
      } else {
        return this.nextTick(callback, null, keys.map((key) => undefined))
      }
    } catch (e) {
      console.log(e)
      return this.nextTick(
        callback,
        new ModuleError(`Unexpected error in getMany`, {
          code: 'LEVEL_NOT_FOUND',
        })
      )
    }
  }

  async _put(key: string, value: string, options: { keyEncoding: 'utf8', valueEncoding: 'utf8'}, callback: (error?: Error) => void) {
    await this.redis.hset<string>(this.hKey, { [encode(key)]: encode(value) })
    await this.redis.zadd<string>(this.zKey, { score: 0, member: encode(key) })
    this.nextTick(callback)
  }

  async _del(key: Buffer, options: any, callback: (error?: Error) => void) {
    await this.redis.hdel(this.hKey, encode(key))
    await this.redis.zrem(this.zKey, encode(key))
    this.nextTick(callback)
  }

  async _batch(batch: BatchOperation[], options: any, callback: (error?: Error) => void): Promise<void> {
    if (batch.length === 0) return this.nextTick(callback)
    const p = this.redis.pipeline()
    for (const op of batch) {
      if (op.type === 'put') {
        p.hset<string>(this.hKey, { [encode(op.key)]: encode(op.value) })
        p.zadd<string>(this.zKey, { score: 0, member: encode(op.key) })
      } else if (op.type === 'del') {
        p.hdel(this.hKey, encode(op.key))
        p.zrem(this.zKey, encode(op.key))
      }
    }
    await p.exec()
    this.nextTick(callback)
  }

  async _clear(options: ClearOptions<KDefault>, callback: (error?: Error) => void): Promise<void> {
    let limit = options.limit !== Infinity && options.limit >= 0 ? options.limit : Infinity
    let offset = 0
    const fetchLimit = 100
    let total = 0
    while (true) {
      const query = queryFromOptions(this.zKey, {keys: true, values: false, ...options, offset, limit: fetchLimit })
      let keys: string[] = []
      try {
        keys = await this.redis.zrange<string[]>(...query)
      } catch (e) {
        console.log(e)
      }
      if (!keys || keys.length === 0) {
        break
      }
      if (keys.length + total > limit) {
        keys = keys.slice(0, limit - total)
      }
      await this.redis.hdel(this.hKey, ...keys)
      await this.redis.zrem(this.zKey, ...keys)
      offset += fetchLimit
      total += keys.length
      if (total >= limit) {
        break
      }
    }
    this.nextTick(callback)
  }

  _iterator(
    options: IteratorOptions<KDefault>
  ): RedisIterator<KDefault, VDefault> {
    return new RedisIterator<KDefault, VDefault>(this, options)
  }
}
