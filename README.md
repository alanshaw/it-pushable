# it-pushable

> An iterable that you can push values into

## Install

```sh
npm install it-pushable
```

## Usage

```js
const pushable = require('it-pushable')
const pusher = pushable()

setTimeout(() => pusher.push('hello'), 100)
setTimeout(() => pusher.push('world'), 200)
setTimeout(() => pusher.end(), 300)

const start = Date.now()

for await (const value of pusher) {
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
