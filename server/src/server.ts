import 'dotenv/config'
import express from 'express'
import { Routes, Response } from 'shared'

const app = express()
app.use(express.json())

const squareRoot: Routes['squareRoot'] = async function squareRoot({ x }) {
  return { sqrt: Math.sqrt(x) }
}

const plus: Routes['plus'] = async function plus({ x, y }) {
  return { total: x + y }
}

const throwsError: Routes['throwsError'] = async function throwsError({ message }) {
  throw new Error(message)
}

const health: Routes['health'] = async function health() {
  return { status: 'ok' }
}

const routeHandlers: Routes = {
  squareRoot,
  plus,
  throwsError,
  health,
}

const routeWrapper = <T extends keyof Routes>(handler: Routes[T], name: T) => {
  async function wrapped(req: express.Request, res: express.Response) {
    try {
      const validInput = (Routes as any)[name][0].parse(req.body)
      const output = await handler(validInput)
        ; (Routes as any)[name][1].parse(output)
      res.json({ ok: true, data: output } satisfies Response<typeof output>)
    } catch (err: any) {
      res.json({ ok: false, message: err.message } satisfies Response<never>)
    }
  }
  return wrapped
}

Object.entries(routeHandlers).forEach(([name, handler]) => {
  app.post('/' + name, routeWrapper(handler, name as keyof Routes))
})

const host = process.env.HOST ?? '127.0.0.1'
const port = parseInt(process.env.PORT ?? '15347')

app.listen(port, host, () => {
  console.log(`Server running on ${host}:${port}`)
})
