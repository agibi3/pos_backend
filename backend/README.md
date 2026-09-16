# Mai_Ganima POS Backend

FastAPI + PostgreSQL backend replacing the Supabase dependency in the React POS.
Designed for a very small deployment (cashier + admin) but with server-side pagination and indexed sales history so the sales table can grow substantially.

## Data model

- `users` — usernames, hashed passwords, role (`admin`/`cashier`)
- `products` — product catalogue
- `sales_history` — one row per sold item; rows share a `receipt_no`. Includes `status`.
- No receipt images/PDFs are stored. The React app can rebuild a receipt from `/sales/{receipt_no}`.

## Local setup

1. Install PostgreSQL, or run `docker compose up -d` from this folder.
2. Create `.env` from `.env.example`.
3. Create a Python virtual environment.
4. `pip install -r requirements.txt`
5. Run `python seed.py` once to create the first admin.
6. Start API: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

Default seed login: `admin` / `admin123`. **Change it immediately in the Admin Users screen.**

API docs: `http://localhost:8000/docs`

## Production notes

- Put the API behind HTTPS/reverse proxy.
- Change `JWT_SECRET`.
- Use a strong database password.
- Back up PostgreSQL regularly.
- Keep the React app pointed at the API URL, not PostgreSQL directly.
