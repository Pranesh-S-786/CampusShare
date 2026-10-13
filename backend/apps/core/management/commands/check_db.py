import os
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Checks connectivity to the configured database (Supabase PostgreSQL or fallback).'

    def handle(self, *args, **options):
        db_conf = settings.DATABASES['default']
        engine = db_conf.get('ENGINE', '')
        database_url_present = bool(os.getenv('DATABASE_URL', '').strip().strip('"').strip("'"))
        db_host_present = bool(os.getenv('DB_HOST', '').strip())

        self.stdout.write(self.style.NOTICE(f"Active Engine: {engine}"))
        self.stdout.write(self.style.NOTICE(f"Configured Host: {db_conf.get('HOST') or 'local file'}"))
        self.stdout.write(self.style.NOTICE(f"Database Name: {db_conf.get('NAME')}"))

        raw_db_url = os.getenv('DATABASE_URL', '')
        if '[YOUR-PASSWORD]' in raw_db_url or '[' in raw_db_url:
            self.stdout.write(self.style.ERROR(
                "\n[ACTION REQUIRED] Found '[YOUR-PASSWORD]' placeholder in backend/.env.\n"
                "You must replace '[YOUR-PASSWORD]' (including the brackets) with your actual Supabase database password.\n"
                "Example: postgresql://postgres.user:MyRealPassword123@aws-0-....pooler.supabase.com:6543/postgres\n"
            ))
            return

        if not database_url_present and not db_host_present:
            self.stdout.write(self.style.WARNING(
                "\n[INFO] Supabase PostgreSQL credentials are not yet configured in backend/.env.\n"
                "The application is using local SQLite fallback for development.\n"
                "To connect to Supabase:\n"
                "  1. Retrieve your connection string from the Supabase Dashboard.\n"
                "  2. Set DATABASE_URL in backend/.env.\n"
                "  3. Re-run 'python manage.py check_db' to verify connection."
            ))
            return

        self.stdout.write("\nTesting connection to remote PostgreSQL database...")
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1;')
                row = cursor.fetchone()
                if row and row[0] == 1:
                    self.stdout.write(self.style.SUCCESS(
                        f"SUCCESS: Connected to {connection.vendor} database successfully!"
                    ))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(
                f"ERROR: Connection to database failed: {exc}\n"
                "Please verify your Supabase credentials, password, and network access in backend/.env."
            ))
