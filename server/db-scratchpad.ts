// $ esr src/scripts/slonik-scratchpad.ts

import { z } from 'zod'
import { DB, sql } from './not-slonik'
import type { Pool } from 'pg'

async function doThing(db: DB) {
  const ret = await db.rows(sql`SELECT 1+1 AS x`, z.any())
  console.log('ret:', ret)
  await db.transaction(async db => {
    await db.none(sql`CREATE TEMP TABLE foo (x int, y text)`)
    const rows1 = [
      { x: 1, y: 'a' },
      { x: 2, y: 'b' },
      { x: 3, y: 'c' },
      { x: 4, y: 'd' },
    ]
    // const rows1 = [
    //   [1, 'a'],
    //   [2, 'b'],
    //   [3, 'c'],
    //   [4, 'd'],
    // ]
    // await db.query(
    //   sql`
    //   INSERT INTO foo (x, y)
    //   SELECT * FROM unnest(${JSON.stringify(rows1)}::int[]) AS t(x, y)
    // `,
    //   // true, // rowmode
    // )
    await db.none(
      sql`
        INSERT INTO foo (x, y)
        SELECT x, y
        FROM jsonb_to_recordset(${JSON.stringify(rows1)}::jsonb)
        AS t(x int, y text)
      `,
    )
    console.log('rows1:', rows1)

    const rows2 = await db.rows(sql`SELECT * FROM foo`, z.any())
    console.log('rows2:', rows2)
  })
}

async function main() {
  const started = Date.now()
  const db = DB.make(process.env.PGDATABASE ?? 'postgres', {})
  await db.init()
  await doThing(db)
  const elapsed = Date.now() - started
  console.log('done in', elapsed, 'ms')
  await (db.poolOrConn as Pool)?.end()
}

void main()
