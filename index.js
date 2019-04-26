const FIFO = require('fast-fifo')

module.exports = onEnd => {
  let buffer = new FIFO()
  let pushable, onNext, ended

  const waitNext = () => {
    if (!buffer.isEmpty()) {
      const next = buffer.shift()
      if (next.error) throw next.error
      return next
    }

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
    buffer.push(next)
    return pushable
  }

  const bufferError = err => {
    buffer = new FIFO()
    if (onNext) return onNext(Promise.reject(err))
    buffer.push({ error: err })
    return pushable
  }

  const push = value => {
    if (ended) return pushable
    return bufferNext({ done: false, value })
  }
  const end = err => {
    if (ended) return pushable
    ended = true
    return err ? bufferError(err) : bufferNext({ done: true })
  }
  const _return = () => {
    buffer = new FIFO()
    end()
    return { done: true }
  }
  const _throw = err => {
    end(err)
    return { done: true }
  }

  pushable = {
    [Symbol.asyncIterator] () { return this },
    next: waitNext,
    return: _return,
    throw: _throw,
    push,
    end
  }

  if (!onEnd) return pushable

  const _pushable = pushable

  pushable = {
    [Symbol.asyncIterator] () { return this },
    async next () {
      let res
      try {
        res = await _pushable.next()

        if (res.done && onEnd) {
          onEnd()
          onEnd = null
        }

        return res
      } catch (err) {
        if (onEnd) {
          onEnd(err)
          onEnd = null
        }
        throw err
      }
    },
    throw (err) {
      _pushable.throw(err)
      if (onEnd) {
        onEnd(err)
        onEnd = null
      }
      return { done: true }
    },
    return () {
      _pushable.return()
      if (onEnd) {
        onEnd()
        onEnd = null
      }
      return { done: true }
    },
    push,
    end
  }

  return pushable
}
