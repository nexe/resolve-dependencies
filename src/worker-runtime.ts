if (process.send) {
  const contexts: any = {},
    send = process.send.bind(process)

  process.on('message', async ({ moduleName, contextName, id, method, options, args }) => {
    const ctx = contexts[contextName]

    if (moduleName) {
      contexts[contextName] = require(moduleName)
      let starting = Promise.resolve()
      if ('function' === typeof contexts[contextName].initialize) {
        starting = Promise.resolve(contexts[contextName].initialize(options))
      }
      starting.then(() => {
        send({ result: 'ready' })
      })
      return
    }

    if (!method || !ctx) {
      send({ error: `Error: Could not find "${method}" in "${contextName}"`, id })
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
  })
}
