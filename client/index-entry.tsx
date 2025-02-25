import './index.css'
import { App } from './app.tsx'
import { render } from 'react'

render(<App />, document.getElementById('app')!)
// import { hydrate, prerender as ssr } from 'preact-iso'
// if (typeof window !== 'undefined') {
//   hydrate(<App />, document.getElementById('app')!)
// }

// export async function prerender(data: any) {
//   return await ssr(<App {...data} />)
// }
