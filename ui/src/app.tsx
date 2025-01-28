import { useEffect, useState } from 'preact/hooks'
import './app.css'
import toast, { Toaster } from 'react-hot-toast'

// import preactLogo from './assets/preact.svg'
// import viteLogo from '/vite.svg'
// <img src={viteLogo} class="logo" alt="Vite logo" />
// <img src={preactLogo} class="logo preact" alt="Preact logo" />
import {square} from 'shared'
const x = 5
console.log({x, xSquared: square(x)})
export function App() {
  return <>
    <Toaster />
  <div>Hello</div>
  </>
}
