import test from 'ava'
import pipe from 'it-pipe'
import pushable from '.'

const collect = async source => {
  const input = []
  for await (const value of source) input.push(value)
  return input
}

test('should push input slowly', async t => {
  const pusher = pushable()
  const input = [1, 2, 3]
  for (let i = 0; i < input.length; i++) {
    setTimeout(() => pusher.push(input[i]), i * 10)
  }
  setTimeout(() => pusher.end(), input.length * 10)
  const output = await pipe(pusher, collect)
  t.deepEqual(output, input)
})

test('should buffer input', async t => {
  const pusher = pushable()
  const input = [1, 2, 3]
  input.forEach(v => pusher.push(v))
  setTimeout(() => pusher.end())
  const output = await pipe(pusher, collect)
  t.deepEqual(output, input)
})

test('should buffer some inputs', async t => {
  const pusher = pushable()
  const input = [1, [2.1, 2.2, 2.3], 3, 4, 5, [6.1, 6.2, 6.3, 6.4], 7]
  for (let i = 0; i < input.length; i++) {
    setTimeout(() => {
      if (Array.isArray(input[i])) {
        input[i].forEach(v => pusher.push(v))
      } else {
        pusher.push(input[i])
      }
    }, i * 10)
  }
  setTimeout(() => pusher.end(), input.length * 10)
  const output = await pipe(pusher, collect)
  t.deepEqual(output, [].concat.apply([], input))
})

test('should allow end before start', async t => {
  const pusher = pushable()
  const input = [1, 2, 3]
  input.forEach(v => pusher.push(v))
  pusher.end()
  const output = await pipe(pusher, collect)
  t.deepEqual(output, input)
})

test('should end with error immediately', async t => {
  const pusher = pushable()
  const input = [1, 2, 3]
  input.forEach(v => pusher.push(v))
  pusher.end(new Error('boom'))
  const err = await t.throwsAsync(pipe(pusher, collect))
  t.deepEqual(err.message, 'boom')
})

test('should end with error in the middle', async t => {
  const pusher = pushable()
  const input = [1, new Error('boom'), 3]
  for (let i = 0; i < input.length; i++) {
    setTimeout(() => {
      if (input[i] instanceof Error) {
        pusher.end(input[i])
      } else {
        pusher.push(input[i])
      }
    }, i * 10)
  }
  setTimeout(() => pusher.end(), input.length * 10)
  const err = await t.throwsAsync(pipe(pusher, collect))
  t.deepEqual(err.message, 'boom')
})

test('should allow end without push', async t => {
  const pusher = pushable()
  const input = []
  pusher.end()
  const output = await pipe(pusher, collect)
  t.deepEqual(output, input)
})

test('should allow next after end', async t => {
  const pusher = pushable()
  const input = [1]
  pusher.push(input[0])
  let next = await pusher.next()
  t.falsy(next.done)
  t.is(next.value, input[0])
  pusher.end()
  next = await pusher.next()
  t.true(next.done)
  next = await pusher.next()
  t.true(next.done)
})
