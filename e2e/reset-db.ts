/** Recreates the E2E database, so every run starts from the seed (the API migrates and seeds it on start). */
import postgres from 'postgres'

const url = new URL(process.env.DATABASE_URL ?? 'postgres://petrik:petrik@localhost:5432/petrik_e2e')
const name = url.pathname.slice(1)
const admin = new URL(url)
admin.pathname = '/postgres'
const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} })
await sql.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
await sql.unsafe(`CREATE DATABASE "${name}"`)
await sql.end()
console.log(`[e2e] fresh database ${name}`)
