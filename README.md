# FoundIt - Lost & Found

Django REST backend (`backend/`) + React/Vite frontend (`frontend/`).

## Run locally (PowerShell)

Backend:
    cd backend
    copy .env.example .env        (then edit .env: set DB_PASSWORD, or leave it empty for SQLite)
    pip install -r requirements.txt
    py manage.py migrate
    py manage.py createsuperuser
    py manage.py runserver

Frontend (second window):
    cd frontend
    npm install
    npm run dev
Open http://localhost:5173

## Deploy on Render

1. Push this project to GitHub (.env is ignored, so your password stays private).
2. Create a PostgreSQL database on Render. Copy its Internal Database URL.
3. Create a Web Service (root directory: backend, Python):
   Build command:
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
   Start command:
     gunicorn config.wsgi:application
   Environment variables:
     DATABASE_URL         = (Internal Database URL from step 2)
     SECRET_KEY           = (long random string)
     DEBUG                = False
     ALLOWED_HOSTS        = your-backend.onrender.com
     CSRF_TRUSTED_ORIGINS = https://your-backend.onrender.com
     CORS_EXTRA_ORIGINS   = https://your-frontend.onrender.com   (add after step 4)
     CLOUDINARY_URL       = (from your Cloudinary dashboard; keeps uploaded photos permanently)
4. Create a Static Site (root directory: frontend):
   Build command:  npm install && npm run build
   Publish directory:  dist
   Environment variable:
     VITE_API_URL = https://your-backend.onrender.com
   Then go back to step 3 and set CORS_EXTRA_ORIGINS to this site's URL.
5. After the first deploy, open the Shell tab of the Web Service and run:
     python manage.py createsuperuser

Without CLOUDINARY_URL, uploaded photos are lost on every deploy and are not served when DEBUG=False.
