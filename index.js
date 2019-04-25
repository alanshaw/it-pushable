module.exports = onEnd => {
  let buffer = []
  let pushable, onNext, ended

  const waitNext = () => {
    if (buffer.length) return buffer.shift()
    if (ended) return { done: true }

    return new Promise(resolve => {
      onNext = next => {
        onNext = null
        resolve(next)
        return pushable
      }
    })
  }

  const bufferNext = next => {
    if (onNext) return onNext(Promise.resolve(next))
    buffer.push(Promise.resolve(next))
    return pushable
  }

  const bufferError = err => {
    buffer = []
    if (onNext) return onNext(Promise.reject(err))
    buffer.push(Promise.reject(err))
    return pushable
  }

  const push = value => bufferNext({ done: false, value })
  const end = err => {
    ended = true
    return err ? bufferError(err) : bufferNext({ done: true })
  }

  pushable = {
    [Symbol.asyncIterator] () { return this },
    next: waitNext,
    push,
    end
  }

  if (!onEnd) return pushable

  const _pushable = pushable
  pushable = (async function * () {
    try {
      for await (const value of _pushable) {
        yield value
      }
    } catch (err) {
      onEnd(err)
      throw err
    }
    onEnd()
  })()

  return Object.assign(pushable, { push, end })
}
