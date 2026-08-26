# Tünde Divat Online MVP 

Webes, API-first MVP online ruhakereskedéshez. A rendszer célja, hogy a felhasználó mobilról vagy desktopról feltöltsön/készítsen termékfotót, rögzítse a termékadatokat, AI service rétegen keresztül marketingképet generáljon, az alkalmazás saját overlay service-ével ráhelyezze a `display_number`, ár és méret információkat, majd jóváhagyás után a termék bekerüljön a Kész képek nézetbe.

## Stack

- Monorepo: npm workspaces
- Backend: Node.js, Express, TypeScript
- Database: MySQL + Prisma ORM
- Auth: HTTPOnly session cookie, JWT payload, Argon2id password hashing
- Upload és képfeldolgozás: Multer 2, Sharp, local `StorageService`
- Frontend: Vite, React, TypeScript, responsive CSS
- Tests: Vitest

## Könyvtárstruktúra

```text
apps/api      Express REST API, Prisma schema, services, routes
apps/web      React mobil-webes felület
packages/shared  közös validációk, státuszok, formázók
```

## MySQL adatmodell

A Prisma schema itt található: `apps/api/prisma/schema.prisma`.

Fő táblák:

- `users`: username, opcionális email, `password_hash`, role (`ADMIN`, `STAFF`)
- `products`: technikai `id`, külön belső `product_id`, külön publikus `display_number`, price, status, opcionális metaadatok
- `product_sizes`: méret és opcionális quantity, későbbi készletkezeléshez előkészítve
- `product_images`: `ORIGINAL`, `AI_GENERATED`, `FINAL` képek storage referenciái
- `generation_jobs`: AI job státuszok (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`)

MVP feltételezés: egy nagykereskedő van, ezért a `product_id` jelenleg unique. Később supplier mezővel `supplier + product_id` egyediségre kell váltani.

## Local setup

```bash
npm install
cp .env.example .env
```

Állítsd be a `.env` fájlban:

```bash
DATABASE_URL="mysql://fashion_user:fashion_password@127.0.0.1:3306/fashion_mvp"
SESSION_SECRET="legalabb-32-karakteres-veletlen-string"
CORS_ORIGIN="http://localhost:5173"
AI_PROVIDER="mock"
SEED_ADMIN_USERNAME="admin123"
SEED_ADMIN_PASSWORD="admin1234"
SEED_DUMMY_USERNAME="user123"
SEED_DUMMY_PASSWORD="user1234"
```

MySQL példa:

```sql
CREATE DATABASE fashion_mvp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fashion_user'@'localhost' IDENTIFIED BY 'fashion_password';
GRANT ALL PRIVILEGES ON fashion_mvp.* TO 'fashion_user'@'localhost';
```

Migráció és próba felhasználók seedelése:

```bash
npm run prisma:migrate
npm run seed --workspace @fashion-mvp/api
```

Próba belépések a tesztidőszak alatt:

- Admin: `admin123` / `admin1234`
- Dummy felhasználó: `user123` / `user1234`

Indítás:

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:4000`

## API struktúra

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/products/dashboard`
- `POST /api/products`
- `GET /api/products`
- `GET /api/products/:id`
- `PUT /api/products/:id`
- `POST /api/products/:id/image`
- `POST /api/products/:id/generate`
- `POST /api/products/:id/regenerate`
- `POST /api/products/:id/overlay`
- `POST /api/products/:id/approve`
- `POST /api/products/:id/publish`
- `POST /api/products/:id/archive`
- `GET /api/images/:id`

## AI integráció

Az MVP-ben az `ImageGenerationService` külön adapterréteg. Alapértelmezésben `AI_PROVIDER=mock`, amely kipróbálható marketing-alapképet készít a feltöltött fotóból. A valódi provider adaptert backend oldalon kell bekötni, és az API kulcs csak environment variable lehet (`OPENAI_API_KEY`), soha nem frontend bundle.

Fontos: a termékadatokat nem az AI írja rá a képre. A `ImageOverlayService` helyezi rá a `display_number`, ár és méret információkat WebP exporttal.

## Security

MVP-ben beépítve:

- Argon2id jelszóhash
- HTTPOnly cookie alapú session
- backend authorization middleware minden termék/kép endpointon
- Zod backend input validation
- Prisma ORM, nincs string-concat SQL
- upload méretlimit, MIME validation, Sharp metadata validation, random storage fájlnév
- login, upload és generation rate limit
- Helmet és CORS credential konfiguráció
- production error response nem ad stack trace-t
- `.env` gitignore alatt, `.env.example` secret nélkül

Következő hardening lépések:

- CSRF token cookie alapú auth mellé productionben
- object storage adapter (S3/R2)
- részletes audit log tárolás
- integrációs tesztek valós tesztadatbázissal

## Tesztek és build

```bash
npm run build --workspace @fashion-mvp/shared
npm run build --workspace @fashion-mvp/api
npm run build --workspace @fashion-mvp/web
npm test
npm audit --omit=dev
```

Jelenlegi automatizált tesztek:

- shared validáció és HUF formázás
- overlay WebP generálás

## Roadmap

1. Valódi AI image provider bekötése az `ImageGenerationService` mögé
2. API integration tests MySQL test adatbázissal
3. szerkesztő modal approved termékekhez
4. CSRF védelem production cookie auth mellé
5. object storage adapter
6. reservation és inventory modulok későbbi fázisban
