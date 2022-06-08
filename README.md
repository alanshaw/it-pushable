# it-pushable

[![Build Status](https://github.com/alanshaw/it-pushable/actions/workflows/js-test-and-release.yml/badge.svg?branch=master)](https://github.com/alanshaw/it-pushable/actions/workflows/js-test-and-release.yml)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

> An iterable that you can push values into

## Install

```sh
npm install it-pushable
```

## Usage

```js
import { pushable } from 'it-pushable'

const source = pushable()
await source.push(Uint8Array.from([0]))
await source.push(Uint8Array.from([1]))
await source.push(Uint8Array.from([2]))
await source.end()

for await (const arr of source) {
  console.log(arr)
}
/*
Output:
Uint8Array[0]
Uint8Array[1]
Uint8Array[2]
*/
```

We can also push non-`Uint8Array`s by specifying the `objectMode` option:

```js
import { pushable } from 'it-pushable'

const source = pushable({
  objectMode: true
})

setTimeout(() => source.push('hello'), 100)
setTimeout(() => source.push('world'), 200)
setTimeout(() => source.end(), 300)

const start = Date.now()

for await (const value of source) {
  console.log(`got "${value}" after ${Date.now() - start}ms`)
}
console.log(`done after ${Date.now() - start}ms`)

/*
Output:
got "hello" after 105ms
got "world" after 207ms
done after 309ms
*/
```

```js
import { pushableV } from 'it-pushable'
import all from 'it-all'

const source = pushableV({
  objectMode: true
})

await source.push(1)
await source.push(2)
await source.push(3)
await source.end()

console.info(await all(source))
/*
Output:
[ [1, 2, 3] ]
*/
```

## API

### `pushable([options])`

Create a new async iterable. The values yielded from calls to `.next()` or when used in a `for await of` loop are "pushed" into the iterable. Returns an async iterable object with the following additional methods:

* `.push(value)` - push a value into the iterable. Values are yielded from the iterable in the order they are pushed. Values not yet consumed from the iterable are buffered
* `.end([err])` - end the iterable after all values in the buffer (if any) have been yielded. If an error is passed the buffer is cleared immediately and the next iteration will throw the passed error

`options` is an _optional_ parameter, an object with the following properties:

* `onEnd` - a function called after _all_ values have been yielded from the iterator (including buffered values). In the case when the iterator is ended with an error it will be passed the error as a parameter.
* `objectMode` - a boolean value that means non-`Uint8Array`s will be passed to `.push`, default: `false`
* `highWaterMark` - a threshold beyond which calls to `.push` will wait for previously pushed items to be consumed.  If `objectMode` is `false`, this number is interpreted as the total number of bytes that the queue should hold, otherwise it is the number of items in the queue

### `pushableV([options])`

Similar to `pushable`, except it yields multiple buffered chunks at a time. All values yielded from the iterable will be arrays.

## Related

* [`it-pipe`](https://www.npmjs.com/package/it-pipe) Utility to "pipe" async iterables together

## Contribute

Feel free to dive in! [Open an issue](https://github.com/alanshaw/it-pushable/issues/new) or submit PRs.

## License

[MIT](LICENSE) © Alan Shaw
