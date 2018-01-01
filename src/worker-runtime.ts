import { basename } from 'path'
const contexts: any = {}

if (process.send) {
  process.on('message', async (message) => {
    const contextName = message.context || basename(message.module)
  
    if (!contextName) {
      process.send!({ error: 'No context provided' })
    }
  
    if (message.module) {
      contexts[contextName] = require(message.module)
      process.send!({ result: 'ready' })
      return
    }

    if (!message.method) {
      process.send!({ error: 'You must specify a method in: "' + contextName + '"'})
      return
    }

    const context = contexts[contextName]

    if (!context) {
      process.send!({ error: 'No context exists with name: "' + contextName + '"'})
      return
    }

    let result = null
    let error = null

    try {
      result = await Promise.resolve(context[message.method].apply(context, message.args))
    } catch (e) {
      error = e.stack
    }
    process.send!({ result, error })
  })
}



