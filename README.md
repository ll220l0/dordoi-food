# Dordoi Food Web (v3 / 2026-ready)

PWA web-app for market restaurants (container delivery):
- guest menu
- cart + checkout (line / container)
- QR payment as **image** + payment code
- manual confirmation by restaurant
- **Admin hidden from clients** (no client links) + **Basic Auth** protection
- Admin menu editor (categories + items CRUD)
- Admin orders: confirm QR payments

## Run

```bash
npm i
docker compose up -d
cp .env.example .env
npm run prisma:migrate
npm run db:seed
npm run dev
```

To enable PWA locally in development:
- PowerShell: `$env:PWA_DEV="true"; npm run dev`
- Bash: `PWA_DEV=true npm run dev`

Open:
- http://localhost:3000
- root URL opens the first active restaurant automatically
- /admin (Basic Auth from .env)

## QR images
Replace:
- public/qr/demo-restaurant.png

## Seed behavior
- `npm run db:seed` now creates only an empty active restaurant (if none exists).
- Test categories/items are no longer created automatically.

## GitHub + deploy

### 1) Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

### 2) CI in GitHub Actions
- Workflow file: `.github/workflows/ci.yml`
- Runs on push/PR:
  - `npm ci`
  - `npm run lint`
  - `npm run build`

### 3) Deploy from GitHub (Vercel)
1. Import repository in Vercel.
2. Add environment variables in project settings:
   - `DATABASE_URL`
   - `ADMIN_USER`
   - `ADMIN_PASS`
   - `ADMIN_QR_PASS`
   - `NEXT_PUBLIC_APP_NAME`
3. Deploy.

### 4) Production DB migration
Run once for production database:
```bash
npm run prisma:migrate:deploy
```
