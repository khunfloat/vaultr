export class ConflictError extends Error {
  readonly path: string

  constructor(path: string) {
    super(`${path} was changed on disk`)
    this.name = 'ConflictError'
    this.path = path
  }
}

export class ReadOnlyError extends Error {
  constructor() {
    super('Vault is locked — reconnect to save changes')
    this.name = 'ReadOnlyError'
  }
}
