# CampusShare

CampusShare is a campus marketplace platform where college students can lend, rent, borrow, sell, and request items from other students within their campus community.

This repository represents **Stage 1: Project Foundation**, establishing the decoupled frontend and backend architectures, environment configurations, and development health checks.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide React |
| **Backend** | Python, Django, Django REST Framework, django-cors-headers, python-dotenv |
| **Database** | PostgreSQL (`psycopg` v3 driver) with local SQLite fallback |
| **Tooling** | npm, Python venv, Git |

---

## Project Structure

```text
CampusShare/
├── backend/
│   ├── apps/
│   │   ├── __init__.py
│   │   └── core/                   # Core application (health check, common logic)
│   │       ├── __init__.py
│   │       ├── apps.py
│   │       ├── tests.py
│   │       ├── urls.py
│   │       └── views.py
│   ├── campusshare/                # Django project package
│   │   ├── __init__.py
│   │   ├── asgi.py
│   │   ├── settings.py             # Environment-based settings
│   │   ├── urls.py                 # API routing root
│   │   └── wsgi.py
│   ├── .env.example                # Backend environment template
│   ├── .env                        # Local environment file (git-ignored)
│   ├── .gitignore
│   ├── manage.py
│   └── requirements.txt            # Frozen Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts              # API client and health check caller
│   │   ├── App.css
│   │   ├── App.tsx                 # Clean entry point with system status
│   │   ├── index.css               # Tailwind CSS integration
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── .env.example                # Frontend environment template
│   ├── .env                        # Local frontend environment (git-ignored)
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts              # Vite configuration with Tailwind CSS & proxy options
│
├── .gitignore                      # Root repository gitignore
└── README.md                       # Setup and run guide
```

---

## Prerequisites

- **Python**: 3.10+ (tested with Python 3.14)
- **Node.js**: v18+ or v20+ (tested with Node v24)
- **PostgreSQL**: 14+ (optional for immediate dry-run; SQLite fallback active until configured)

---

## Getting Started

### 1. Backend Setup

Open a terminal and navigate to the `backend` directory:

```bash
cd backend
```

#### a. Activate the Virtual Environment
- **Windows (PowerShell):**
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
  *(If `.venv` does not exist yet: `python -m venv .venv`)*

- **macOS / Linux:**
  ```bash
  source .venv/bin/activate
  ```

#### b. Install Dependencies
```bash
pip install -r requirements.txt
```

#### c. Environment Configuration
Copy `.env.example` to `.env`:
```bash
# Windows PowerShell:
Copy-Item .env.example .env

# macOS / Linux:
cp .env.example .env
```

Adjust `.env` with your settings:
- Update `DJANGO_SECRET_KEY` with a random string.
- When ready to connect to PostgreSQL, uncomment/set `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT`.

#### d. Run Migrations & Verify Checks
```bash
python manage.py check
python manage.py migrate
python manage.py test
```

#### e. Start the Django Development Server
```bash
python manage.py runserver 127.0.0.1:8000
```
API endpoint available at: [http://127.0.0.1:8000/api/health/](http://127.0.0.1:8000/api/health/)

---

### 2. Frontend Setup

Open a separate terminal and navigate to the `frontend` directory:

```bash
cd frontend
```

#### a. Install Node Dependencies
```bash
npm install
```

#### b. Environment Configuration
Copy `.env.example` to `.env`:
```bash
# Windows PowerShell:
Copy-Item .env.example .env

# macOS / Linux:
cp .env.example .env
```

The default value is set to:
```env
VITE_API_URL=http://127.0.0.1:8000/api
```

#### c. Start the Frontend Development Server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Manual Configuration (Supabase PostgreSQL)

Django connects to your Supabase-hosted PostgreSQL instance via Django's ORM and psycopg (v3). No Supabase JavaScript client or direct frontend database access is used.

### 1. Retrieve Connection Details from Supabase Dashboard

1. Log into [Supabase](https://supabase.com) and open your project (or create a new one).
2. Click on **Project Settings** (gear icon in the sidebar) &rarr; **Database**.
3. Under the **Connection string** section, select the **URI** tab:
   - Choose either **Transaction** pooler (port `6543`, recommended) or **Session** pooler (port `5432`).
   - Copy the URI string format:
     ```text
     postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
     ```
   - Replace `[YOUR-PASSWORD]` with the database password you set when creating the Supabase project.

### 2. Configure `backend/.env`

Open `backend/.env` and paste your connection string:

```env
DATABASE_URL=postgresql://postgres.yourprojectref:yourpassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

*Or, if configuring individual parameters instead:*
```env
DB_ENGINE=django.db.backends.postgresql
DB_NAME=postgres
DB_USER=postgres.yourprojectref
DB_PASSWORD=yourpassword
DB_HOST=aws-0-us-east-1.pooler.supabase.com
DB_PORT=6543
DB_SSLMODE=require
DB_DISABLE_SERVER_SIDE_CURSORS=True
```

### 3. Verify Connection and Apply Migrations

```powershell
cd backend
.\.venv\Scripts\Activate.ps1

# Check live connection to Supabase
python manage.py check_db

# Apply Django migrations to Supabase PostgreSQL
python manage.py migrate
```

### 4. Verify from the Frontend

Start the backend and frontend servers, then navigate to `http://localhost:5173`. Click **Test Backend Connection**. The database status will report `connected (postgresql)`.

