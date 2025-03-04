import './app.css'
import toast, { Toaster } from 'react-hot-toast'
import { Response, Routes, square } from 'shared'
import { useEffect } from 'react'
import { create } from 'zustand'

const x = 5
// const x: string = 5
console.log({ x, xSquared: square(x) })

interface State {
  number: number
  x: number
  y: number
  serverStatus: string
}

const __store = create<State>()(() => ({
  number: 0,
  x: 0,
  y: 0,
  serverStatus: 'checking...',
}))

/** KEEP THESE GLOBAL FUNCTIONS AS-IS! USE THEM! */
function set(partial: Partial<State> | ((state: State) => Partial<State>)) {
  return __store.setState(partial)
}
function identity<T>(x: T) {
  return x
}
function use<T = State>(f: (state: State) => T = identity as any) {
  return __store(f)
}
function get(): State {
  return __store.getState()
}
/** KEEP THE ABOVE GLOBAL FUNCTIONS AS-IS! USE THEM! */

export function App() {
  const number = use(s => s.number)
  const x = use(s => s.x)
  const y = use(s => s.y)
  const serverStatus = use(s => s.serverStatus)

  useEffect(() => {
    callApi('health', {})
      .then(() => set({ serverStatus: 'connected' }))
      .catch(() => set({ serverStatus: 'disconnected' }))
  }, [])

  return <>
    <Toaster />
    <div>Server Status: {serverStatus}</div>
    <div>
      <h3>Square Root</h3>
      <input
        type="number"
        // value={number}
        onChange={e => set({ number: Number(e.currentTarget.value) })}
        placeholder="Enter number"
      />
      <button onClick={() => callApi('squareRoot', { x: Number(number) })}>Calculate Square Root</button>
    </div>

    <div>
      <h3>Add Numbers</h3>
      <input
        type="number"
        // value={x}
        onChange={e => set({ x: Number(e.currentTarget.value) })}
        placeholder="First number"
      />
      <input
        type="number"
        // value={y}
        onChange={e => set({ y: Number(e.currentTarget.value) })}
        placeholder="Second number"
      />
      <button onClick={() => callApi('plus', { x: Number(x), y: Number(y) })}>Add Numbers</button>
    </div>

    <div>
      <h3>Test Error</h3>
      <button onClick={() => callApi('throwsError', { message: 'Test error message' })}>Test Error</button>
    </div>
    <div>
      <button onClick={() => console.log(get())}>log state to console</button>
    </div>
  </>
}

async function callApi<T extends keyof Routes>(route: T, data: Parameters<Routes[T]>[0]): Promise<ReturnType<Routes[T]>> {
  const response = await fetch(`/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const result: Response<ReturnType<Routes[T]>> = await response.json()

  if (result.ok) {
    toast.success(JSON.stringify(result.data))
    return result.data
  } else {
    toast.error(result.message)
    console.error('error trying to call api', { route, data, result })
    throw new Error(result.message)
  }
}
