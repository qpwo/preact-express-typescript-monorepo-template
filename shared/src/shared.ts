import { z, object as o, number as n, string as s } from 'zod'

export function square(x: number) {
  return x * x
}

export const Routes = {
  squareRoot: [o({ x: n() }), o({ sqrt: n() })],
  plus: [o({ x: n(), y: n() }), o({ total: n() })],
  throwsError: [o({ message: s() }), o({ never: s() })],
} as const

export type Response<T> =
  | {
    ok: true
    data: T
  }
  | {
    ok: false
    message: string
  }

export type Routes = {
  [K in keyof typeof Routes]: (_: z.infer<(typeof Routes)[K][0]>) => Promise<z.infer<(typeof Routes)[K][1]>>
}
