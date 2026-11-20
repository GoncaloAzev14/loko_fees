// Saves a copy of the club's data from the live Supabase project to your computer.
//
//   npm run backup
//
// It only READS (the CLI is told --read-only). Each table becomes one JSON file in
// backups/<date and time>/, a folder that git ignores. The files hold the club's real data:
// keep them private. Run it before anything risky (deleting data, closing a season, a migration).
//
// Needs `npx supabase login` and a linked project, as for deploying.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const TABLES = [
  ['players', 'select * from players order by created_at'],
  ['fine_types', 'select * from fine_types order by created_at'],
  ['settings', 'select * from settings'],
  ['fines', 'select * from fines order by fined_on, seq'],
  ['payments', 'select * from payments order by paid_on, created_at'],
  ['incomes', 'select * from incomes order by received_on, created_at'],
  ['expenses', 'select * from expenses order by spent_on, created_at'],
  ['season_archive', 'select * from season_archive order by closed_at'],
  ['season_archive_players', 'select * from season_archive_players'],
  ['season_archive_types', 'select * from season_archive_types'],
  ['admins', 'select user_id, accepted_at, is_owner from admins'], // ids only, no emails
  ['late_fee_waivers', 'select * from late_fee_waivers'], // exists once migration 7 is run
  ['change_log', 'select * from change_log order by id'], // exists once migration 8 is run
]

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dir = join('backups', stamp)
mkdirSync(dir, { recursive: true })

let saved = 0
for (const [table, query] of TABLES) {
  try {
    const out = execFileSync(
      'npx',
      ['supabase', 'db', 'query', '--remote', '--read-only', `select coalesce(jsonb_agg(t), '[]'::jsonb) as data from (${query}) t`, '--output-format', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 },
    )
    const parsed = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1))
    const rows = parsed.rows[0].data
    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 2))
    console.log(`  ${table.padEnd(24)} ${String(rows.length).padStart(5)} rows`)
    saved++
  } catch (error) {
    // the CLI reports its errors on stdout as JSON, so look at everything it printed
    const text = [error.stdout, error.stderr, error.message].map(String).join('\n')
    if (/42P01|does not exist/i.test(text)) console.log(`  ${table.padEnd(24)} (not in the database yet, skipped)`)
    else {
      console.error(`  ${table}: FAILED\n${text.slice(0, 400)}`)
      process.exitCode = 1
    }
  }
}
console.log(`\nSaved ${saved} tables to ${dir}/ (private: it holds real club data).`)
