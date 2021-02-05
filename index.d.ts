declare namespace pushable {
  export interface Pushable<T> extends AsyncIterable<T> {
    push: (value: T) => this,
    end: (err?: Error) => this
  }

  type Options = {
    onEnd?: (err?: Error) => void,
    writev?: false
  }
}

declare function pushable<T> (options?: pushable.Options): pushable.Pushable<T>

export = pushable
