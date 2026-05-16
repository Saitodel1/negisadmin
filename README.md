# Negis Control

Отдельный сайт супер-админки для владельца платформы Negis.

## Запуск локально

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:8787

Если `.env` ещё не создан, локально работает dev-only вход:

```text
admin@negis.local
admin123
```

В production эти значения не включаются: без `SUPER_ADMIN_EMAIL` и `SUPER_ADMIN_PASSWORD` сервер не даст войти.

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=
SESSION_SECRET=
MAIN_NEGIS_APP_URL=
PORT=8787
```

`SUPABASE_SERVICE_ROLE_KEY` используется только в `server/index.ts` и не передаётся в React/Vite.

## Что уже есть

- Login с httpOnly cookie-сессией.
- Защищённый layout с sidebar/topbar.
- Страницы: dashboard, clinics, clinic detail, users, subscriptions, finances, logs, settings.
- Express API поверх Supabase service role.
- Mock fallback, если `.env` не заполнен или схема Supabase отличается.
- Production build через `npm run build`.

## Важно

Service role ключ, который был отправлен в чат, лучше перевыпустить в Supabase перед production-запуском.
