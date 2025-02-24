import toast, { Toaster } from 'react-hot-toast'
import { Response, Routes, square } from 'shared'
import { useState, useEffect } from 'preact/hooks'
import './app.css'

const x = 5
console.log({ x, xSquared: square(x) })

export function App() {
  const [number, setNumber] = useState('')
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const [serverStatus, setServerStatus] = useState<string>('checking...')

  useEffect(() => {
    callApi('health', {})
      .then(() => setServerStatus('connected'))
      .catch(() => setServerStatus('disconnected'))
  }, [])

  return <>
    <Toaster />
    <div>Server Status: {serverStatus}</div>
    <div>
      <h3>Square Root</h3>
      <input type="number" value={number} onChange={e => setNumber(e.currentTarget.value)} placeholder="Enter number" />
      <button onClick={() => callApi('squareRoot', { x: Number(number) })}>Calculate Square Root</button>
    </div>

    <div>
      <h3>Add Numbers</h3>
      <input type="number" value={x} onChange={e => setX(e.currentTarget.value)} placeholder="First number" />
      <input type="number" value={y} onChange={e => setY(e.currentTarget.value)} placeholder="Second number" />
      <button onClick={() => callApi('plus', { x: Number(x), y: Number(y) })}>Add Numbers</button>
    </div>

    <div>
      <h3>Test Error</h3>
      <button onClick={() => callApi('throwsError', { message: 'Test error message' })}>Test Error</button>
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
