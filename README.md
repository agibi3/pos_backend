# Mai_Ganima Energiez — POS

React POS frontend + FastAPI/PostgreSQL backend. Supabase is no longer required.

## Frontend

```bash
npm install
cp .env
npm run dev
```

Set `VITE_API_URL` to the FastAPI server URL.

## Backend

See `backend/README.md`. The backend stores users, products and sales history. Receipt files are not stored; receipts are regenerated from sales history.
