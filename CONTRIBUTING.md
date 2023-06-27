# Contributing to upstash-redis-level

The following is a set of guidelines and tips for contributing to upstash-redis-level.

## Getting Started

You _should_ :fingers_crossed: be able to just run these commands. (Please make a note of any hang-ups you ran into during this process)

```sh
# check the node version, 14 or greater is required
node -v
# you can use nvm (https://github.com/nvm-sh/nvm) to switch version
# install pnpm (see docs for other options https://pnpm.io/installation)
curl -fsSL https://get.pnpm.io/install.sh | sh -
# ensure you have the latest (at the time of this writing this is 7.4.0)
pnpm -v
# install dependencies
pnpm install
# build the library
pnpm run build
```

### Testing

[SRH](https://github.com/hiett/serverless-redis-http) is used to run the tests. There is a provided [docker-compose.yml](./docker-compose.yml) to start the server. After installed [Docker](https://docs.docker.com/get-docker/), you can execute `docker-compose up` in the project directory to start the SRH server.

You can run the tests locally by running the following command:

```sh
pnpm run test
```

The [abstract test suite](https://github.com/Level/abstract-level#test-suite) can be executed to validate the implementation:

```sh
pnpm run test:suite
```

**NOTE**: There are currently two failing tests in the suite related to this [issue](https://github.com/upstash/upstash-redis/issues/400). 
