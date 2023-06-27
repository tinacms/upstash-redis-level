# upstash-redis-level

**An [`abstract-level`](https://github.com/Level/abstract-level) database backed by [upstash/redis](https://www.npmjs.com/package/@upstash/redis).**

> :pushpin: Which module should I use? What is `abstract-level`? Head over to the [FAQ](https://github.com/Level/community#faq).

## Usage

```js
const { RedisLevel } = require('upstash-redis-level')
const { Redis } = require('@upstash/redis')
const db = new RedisLevel({
  redis: new Redis({
    url: process.env.KV_REST_API_URL || 'http://localhost:8079',
    token: process.env.KV_REST_API_TOKEN || 'example_token',
  }),
  debug: process.env.DEBUG === 'true' || false,
})

// Add an entry with key 'a' and value 1
await db.put('a', 1)

// Add multiple entries
await db.batch([{ type: 'put', key: 'b', value: 2 }])

// Get value of key 'a': 1
const value = await db.get('a')

// Iterate entries with keys that are greater than 'a'
for await (const [key, value] of db.iterator({ gt: 'a' })) {
  console.log(value) // 2
}
```
## API

The API of `upstash-redis-level` follows that of [`abstract-level`](https://github.com/Level/abstract-level) with three additional constructor options (see below).

### `db = new RedisLevel([options])`

Besides `abstract-level` options, the optional `options` object may contain:

- redis: an instance of `@upstash/redis` client
- debug: a boolean to enable debug logs
- namespace: a string to prefix all keys with. The default is `level`

## Querying Redis Level with Redis commands

### List all keys in lexicographic order

```redis
ZRANGE level:z - + BYLEX
```
### Get value of a key

```redis
HGET level:h <key>
```

## Install

With [npm](https://npmjs.org) do:

```
npm install upstash-redis-level
```

## Contributing

See the [Contribution Guide](./CONTRIBUTING.md) for more details.

## License

See [LICENSE](./LICENSE) for more details.

[abstract-level]: https://github.com/Level/abstract-level

[level-badge]: https://leveljs.org/img/badge.svg
