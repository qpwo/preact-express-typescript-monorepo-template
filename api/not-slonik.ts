// https://github.com/METR/vivaria/blob/78f0bace3ca2fca55d3bdfb77c381350c3e5b6fd/server/src/services/db/db.ts

import 'dotenv/config'

import { once } from 'lodash'
import { Client, ClientBase, DatabaseError, Pool, PoolConfig, types, type PoolClient, type QueryArrayConfig, type QueryConfig } from 'pg'
import { ZodAny, ZodError, ZodObject, ZodTypeAny, z } from 'zod'

/** true for eg {}; false for eg 5, [], new Date(), etc  */
function isPlainObj(x: unknown): x is Record<PropertyKey, unknown> {
  return x != null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype
}

/** eg {x: 1, y: 'foo', z: [1,2,3]} => '{x=1; y=foo; z=1,2,3}'
 *
 * useful for logging objects without too many escapes and quotes
 *
 * anything that's not a plain object is just converted to a string
 */
export function objToEqStr(o: unknown) {
  if (!isPlainObj(o)) return String(o)
  return (
    '(' +
    Object.entries(o)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ') +
    ')'
  )
}

function parseWithGoodErrors<T extends ZodTypeAny>(
  Schema: T,
  val: unknown,
  extraInfo?: Record<PropertyKey, unknown>,
  prefix?: string,
): T['_output'] {
  try {
    return Schema.parse(val)
  } catch (e) {
    prefix = prefix ?? ''
    const ending = extraInfo == null ? '' : ` -- ${objToEqStr(extraInfo)}`
    if (e instanceof ZodError && e.errors.length) {
      const first = e.issues[0]
      throw new Error(`${prefix}zod parsing error: ${objToEqStr(first)}${ending}`)
    }
    const err = e instanceof Error ? e : new Error(`${e}`)
    err.message = `${prefix}zod parsing error: (no zoderror.issues)${ending}` + err.message
    throw err
  }
}

/** tag function that does JSON.stringify on all interpolated values */
export function repr(strings: TemplateStringsArray, ...values: unknown[]) {
  let result = ''
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]
    if (i < values.length) result += JSON.stringify(values[i])
  }
  return result
}

export class DBRowNotFoundError extends Error {}

export class DB {
  static {
    types.setTypeParser(types.builtins.INT8, str => {
      const n = parseInt(str, 10)
      if (!Number.isSafeInteger(n)) throw new Error(`int8 from postgres too large: ${str}`)
      return n
    })
  }
  constructor(
    private readonly database: string | undefined,
    // private
    public readonly poolOrConn: Pool | ConnectionWrapper,
  ) {}

  with(conn: ConnectionWrapper): DB {
    return new DB(this.database, conn)
  }

  static make(dbName: string, poolConfig: PoolConfig): DB {
    const pool = new Pool(poolConfig)
    return new DB(dbName, pool)
  }

  async init() {
    const res = await this.value(sql`SELECT 1+1;`, z.number())
    console.log('postgres says 1+1 is', res)
    const expected = 2
    if (res !== expected) {
      throw new Error(`db setup failed: expected 2, got ${res}`)
    }
    console.log('connected to database:', this.database ?? '((unknown))')
  }

  [Symbol.asyncDispose] = once(async () => {
    if (this.poolOrConn instanceof ConnectionWrapper) return
    await this.poolOrConn.end()
  })

  private async withConn<T>(fn: (conn: ConnectionWrapper) => Promise<T>): Promise<T> {
    if (this.poolOrConn instanceof ConnectionWrapper) {
      // Just do the query. Don't finish the transaction yet.
      return await fn(this.poolOrConn)
    } else {
      const poolClient = await this.poolOrConn.connect()
      try {
        return await fn(new ConnectionWrapper(poolClient))
      } finally {
        // Finish the transaction & return connection to the pool.
        poolClient.release()
      }
    }
  }

  async none(query: ParsedSql): Promise<{ rowCount: number }> {
    return await this.withConn(conn => conn.none(query))
  }

  async row<T extends ObjOrAny>(query: ParsedSql, RowSchema: T): Promise<T['_output']>
  async row<T extends ObjOrAny, O extends boolean>(
    query: ParsedSql,
    RowSchema: T,
    options: { optional: O },
  ): Promise<O extends true ? T['_output'] | undefined : T['_output']>
  async row<T extends ObjOrAny>(
    query: ParsedSql,
    RowSchema: T,
    options: { optional: boolean } = { optional: false },
  ): Promise<T['_output']> {
    return await this.withConn(conn => conn.row(query, RowSchema, options))
  }

  async value<T extends ZodTypeAny>(query: ParsedSql, ColSchema: T): Promise<T['_output']>
  async value<T extends ZodTypeAny, O extends boolean>(
    query: ParsedSql,
    ColSchema: T,
    options: { optional: O },
  ): Promise<O extends true ? T['_output'] | undefined : T['_output']>
  async value<T extends ZodTypeAny>(
    query: ParsedSql,
    ColSchema: T,
    options: { optional: boolean } = { optional: false },
  ): Promise<T['_output'] | undefined> {
    return await this.withConn(conn => conn.value(query, ColSchema, options))
  }

  async rows<T extends ObjOrAny>(query: ParsedSql, RowSchema: T): Promise<T['_output'][]> {
    return await this.withConn(conn => conn.rows(query, RowSchema))
  }

  async column<T extends ZodTypeAny>(query: ParsedSql, ColSchema: T): Promise<T['_output'][]> {
    return await this.withConn(conn => conn.column(query, ColSchema))
  }
  async transaction<T>(fn: (conn: ConnectionWrapper) => Promise<T>): Promise<T> {
    // If we're already in a transaction, execute the function without wrapping it in a transaction.
    if (this.poolOrConn instanceof ConnectionWrapper) {
      return await this.withConn(fn)
    }

    return await this.withConn(conn => conn.transact(fn))
  }
}
function myhash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) + h + str.charCodeAt(i)
    h = h & h // Convert to 32-bit integer
  }
  return h
}
// replace all non-alphanumeric characters with underscores
function underscorify(str: string) {
  return str.replace(/[^a-zA-Z0-9]/g, '_')
}

const nameOf = new Map<string, string>()
/** private! output of sql tagged template */
class ParsedSql {
  constructor(public vals: Array<unknown>) {}

  parse() {
    const strs = []
    const vals = []

    for (const v of this.vals) {
      if (v instanceof SqlLit) {
        strs.push(v.text)
      } else if (Array.isArray(v)) {
        for (let index = 0; index < v.length; index++) {
          const element = v[index]
          vals.push(element)
          strs.push('$' + vals.length.toString() + (index === v.length - 1 ? '' : ', '))
        }
      } else {
        vals.push(v)
        strs.push('$' + vals.length.toString())
      }
    }
    const text = strs.join('')
    let name = nameOf.get(text)
    if (!name) {
      name = underscorify(text).slice(0, 50) + myhash(text).toString(36).slice(0, 5)
      nameOf.set(text, name)
    }
    return {
      name,
      text,
      values: vals.map(v => {
        if (v != null && typeof v == 'object') {
          return sanitizeNullChars(v)
        } else {
          return v
        }
      }),
    }
  }
}

// Escapes \0 characters with ␀ (U+2400), in strings and objects (which get returned
// JSON-serialized). Needed because Postgres can't store \0 characters in its jsonb columns :'(
function sanitizeNullChars(o: object | string): string {
  if (typeof o == 'string') {
    return o.replaceAll('\0', '\u2400')
  } else {
    return JSON.stringify(o, (_, v) => (typeof v == 'string' ? v.replaceAll('\0', '\u2400') : v))
  }
}

/** private! output of sqlLit tagged template */
class SqlLit {
  constructor(public text: string) {}
  toString(): string {
    return this.text
  }
}

export type { SqlLit }

/** The types that are allowed to go into sql tagged template literals. */
export type Value =
  | string
  | number
  | boolean
  | null
  | undefined
  | { then?: never; [key: string]: unknown } // excludes promises
  | unknown[]
  | SqlLit
  | ParsedSql

/** like slonik's sql tag.
 * NOTE: a json array arg must be stringified and cast with `::jsonb` (otherwise interpreted as postgres array)
 */
export function sql(in_strs: TemplateStringsArray, ...in_vals: Value[]): ParsedSql {
  let allVals: Array<unknown> = [new SqlLit(in_strs[0])]

  for (let i = 0; i < in_vals.length; i++) {
    const v = in_vals[i]

    if (v instanceof ParsedSql) {
      allVals = [...allVals, ...v.vals]
    } else if (Array.isArray(v) && v.length === 0) {
      throw new Error('sql tag does not allow empty arrays')
    } else if (Array.isArray(v) && v.every(v => v instanceof ParsedSql)) {
      const subqueries = v
      if (subqueries.length === 0) throw new Error('sql tag does not allow empty arrays')
      allVals = [...allVals, ...subqueries[0].vals]
      for (const subquery of subqueries.slice(1)) {
        allVals = [...allVals, new SqlLit(', '), ...subquery.vals]
      }
    } else if (Array.isArray(v) && v.every(v => v instanceof SqlLit)) {
      const joined = v.map(s => s.text).join(', ')
      allVals.push(new SqlLit(joined))
    } else if (typeof v == 'string') {
      allVals.push(sanitizeNullChars(v))
    } else {
      allVals.push(v)
    }
    allVals.push(new SqlLit(in_strs[i + 1]))
  }
  return new ParsedSql(allVals)
}

/** sql literal. useful for e.g. dynamic column names */
export function sqlLit(in_strs: TemplateStringsArray, ...in_vals: []): SqlLit {
  if (in_vals.length > 0 || in_strs.length !== 1)
    throw new Error(`sqlLit does not allow values (received ${in_vals.length} vals and ${in_strs.length} strings)`)
  return new SqlLit(in_strs[0])
}

// Note that this is vulnerable to command injection and should only be used with
// approved column names
export function dynamicSqlCol(columnName: string): SqlLit {
  return new SqlLit(`"${columnName}"`)
}

/** z.any() matches and z.object(whatever) matches, but z.number() does not */
type ObjOrAny = ZodObject<any, any, any> | ZodAny

function throwNull(): never {
  throw new Error('got nullish')
}
// Low-level class that provides helpful query methods and error parsing.
export class ConnectionWrapper {
  constructor(private connection: ClientBase) {}

  async none(query: ParsedSql): Promise<{ rowCount: number }> {
    const { rows, rowCount } = await this.query(query)
    if (rows.length > 0) throw new Error(repr`db return error: expected no rows; got ${rows.length}. query: ${query.parse().text}`)
    return { rowCount: rowCount ?? 0 }
  }

  async row<T extends ObjOrAny>(query: ParsedSql, RowSchema: T): Promise<T['_output']>
  async row<T extends ObjOrAny, O extends boolean>(
    query: ParsedSql,
    RowSchema: T,
    options: { optional: O },
  ): Promise<O extends true ? T['_output'] | undefined : T['_output']>
  async row<T extends ObjOrAny>(
    query: ParsedSql,
    RowSchema: T,
    options: { optional: boolean } = { optional: false },
  ): Promise<T['_output'] | undefined> {
    const { rows } = await this.query(query)
    if (rows.length === 0 && options.optional) return undefined
    if (rows.length !== 1)
      throw new DBRowNotFoundError(repr`db return error: expected 1 row, got ${rows.length}. query: ${query.parse().text}`)
    return parseWithGoodErrors(RowSchema, rows[0], { query: query.parse().text, value: rows[0] }, 'db return ')
  }

  /** unlike slonik, the Schema is just for a column, not a row */
  async value<T extends ZodTypeAny>(query: ParsedSql, ColSchema: T): Promise<T['_output']>
  async value<T extends ZodTypeAny, O extends boolean>(
    query: ParsedSql,
    ColSchema: T,
    options: { optional: O },
  ): Promise<O extends true ? T['_output'] | undefined : T['_output']>
  async value<T extends ZodTypeAny>(
    query: ParsedSql,
    ColSchema: T,
    options: { optional: boolean } = { optional: false },
  ): Promise<T['_output'] | undefined> {
    const { rows } = await this.query(query, true)
    if (rows.length === 0 && options.optional) return undefined

    if (rows.length !== 1) throw new Error(repr`db return error: expected 1 row; got ${rows.length}. query: ${query.parse().text}`)

    if (rows[0].length !== 1) {
      throw new Error(repr`db return error: expected 1 column; got ${rows[0].length}. query: ${query.parse().text}`)
    }

    return parseWithGoodErrors(ColSchema, rows[0][0], { query: query.parse().text, value: rows[0][0] }, 'db return ')
  }

  async rows<T extends ObjOrAny>(query: ParsedSql, RowSchema: T): Promise<T['_output'][]> {
    const { rows } = await this.query(query)
    return rows.map((row, rowIdx) => parseWithGoodErrors(RowSchema, row, { query: query.parse().text, value: row, rowIdx }, 'db return '))
  }

  /** unlike slonik, the Schema is just for a column, not a row */
  async column<T extends ZodTypeAny>(query: ParsedSql, ColSchema: T): Promise<T['_output'][]> {
    const { rows } = await this.query(query, true)
    if (rows.length && rows[0].length !== 1)
      throw new Error(repr`db return error: expected 1 column; got ${rows[0].length}. query: ${query.parse().text}`)
    return rows.map((row, rowIdx) =>
      parseWithGoodErrors(ColSchema, row[0], { query: query.parse().text, value: row, rowIdx }, 'db return '),
    )
  }

  /** rewrites errors to be more helpful */
  private async query(query: ParsedSql, rowMode = false) {
    if (!(query instanceof ParsedSql)) throw new Error(repr`db query is not ParsedSql: ${query}`)
    const parsedQuery = query.parse()
    try {
      // shouldn't spread because it's a class
      const q: QueryConfig | QueryArrayConfig = { name: parsedQuery.name, text: parsedQuery.text, values: parsedQuery.values }
      if (rowMode) {
        ;(q as QueryArrayConfig).rowMode = 'array'
      }
      return await this.connection.query(q)
    } catch (e) {
      if (e instanceof DatabaseError) {
        console.warn(e)
        const text_ = JSON.stringify(parsedQuery.text)
        // all the other DatabaseError fields are useless
        throw new Error(
          `db query failed: ${e.message} position=${e.position} text=${text_} values=${parsedQuery.values} rowMode=${rowMode}`,
        )
      }
      throw e
    }
  }

  async transact<T>(fn: (conn: ConnectionWrapper) => Promise<T>): Promise<T> {
    try {
      await this.connection.query('BEGIN')
      const result = await fn(this)
      await this.connection.query('COMMIT')
      return result
    } catch (e) {
      await this.connection.query('ROLLBACK')
      throw e
    }
  }
}
