# Deployment

## Local Development (npm-only)
1. Install Node.js 22+.
2. Run from repo root:
   - `npm install`
   - `Copy-Item apps/server/.env.example apps/server/.env`
   - `npm --workspace @gwct/server run prisma:generate`
   - `npm --workspace @gwct/server run prisma:push`
3. Start server + mobile:
   - `npm run dev`
   - custom port on Windows: `npm run dev:4001`
4. Or run independently:
   - `npm run dev:server`
   - `npm run mobile`

## Environment Variables (server)
- `DATABASE_URL=file:../data/dev.db`
- `PORT` (runtime default: `process.env.PORT ?? 4000`)
- `MODE=live|fixture`
- `DEBUG_TOKEN=<token>`
- `EXPO_PUSH_ENABLED=true|false`
- `EXPO_ACCESS_TOKEN=<optional>`
- scrape interval/retry/cooldown variables in `.env.example`

## Environment Variables (mobile)
- `EXPO_PUBLIC_API_BASE_URL` controls API target for Expo app.
- default example: `http://127.0.0.1:4000`

## Useful Ops Commands
- `npm run scrape:once` (one-shot scrape + normalized print)
- `npm run replay:fixtures` (step1->step2 replay to generate alerts)
- `npm test`
- `npm run typecheck`

## Production Migration Path (Postgres)
1. Change Prisma datasource to PostgreSQL.
2. Keep repository/service/parsers unchanged.
3. Run Prisma migration against Postgres.
4. Replace local SQLite backup routines with managed DB backups.
5. (Optional) add Docker Compose orchestration once environment allows Docker.
