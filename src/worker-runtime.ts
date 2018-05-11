if (process.send) {
  const contexts: any = {},
    send = process.send.bind(process)

  process.on(
    'message',
    async ({ modulePath, contextName, id, method, options, args }) => {
      const ctx = contexts[contextName]
      if (modulePath && !(contextName in contexts)) {
        contexts[contextName] = require(modulePath)
        let starting = Promise.resolve()
        if ('function' === typeof contexts[contextName].initialize) {
          starting = starting.then(() =>
            contexts[contextName].initialize(options)
          )
        }
        starting.then(
          (x: any) => {
            send({ result: x, id })
          },
          error => {
            send({ error: error.stack, id })
          }
        )
        return
      }

      if (!method || !ctx) {
        send({
          error: `Error: Could not find "${method}" in "${contextName}"`,
          id
        })
        return
      }

      let result = null
      let error = null

      try {
        result = await Promise.resolve(ctx[method].apply(ctx, args))
      } catch (e) {
        error = e.stack
      }
      send({ result, error, id })
    }
  )
}
