import os
import sys
import time
import secrets
import mimetypes
import urllib.request
import urllib.error
from pathlib import Path
from typing import Tuple, Optional
from django.conf import settings


class ListingStorageService:
    """
    Handles secure item photo uploads to Supabase Storage via REST API.
    Uses the backend-only service-role key, ensuring credentials are never exposed to clients.
    Falls back to local media storage during local testing if cloud credentials are not yet set.
    """

    ALLOWED_CONTENT_TYPES = {
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
    }
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB per photo

    @classmethod
    def get_config(cls) -> dict:
        url = os.getenv('SUPABASE_URL', '').strip().rstrip('/')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip()
        bucket = os.getenv('SUPABASE_STORAGE_BUCKET_LISTINGS', 'listings').strip()
        return {
            'url': url,
            'key': key,
            'bucket': bucket,
            'is_configured': bool(url and key),
        }

    @classmethod
    def upload_listing_photo(
        cls,
        user_id: int,
        file_bytes: bytes,
        content_type: str,
        original_filename: str,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Uploads listing photo to Supabase Storage bucket (or local dev storage fallback).
        Returns:
            (public_url, None) on success
            (None, error_message) on failure
        """
        if len(file_bytes) > cls.MAX_FILE_SIZE:
            return None, f"File size ({len(file_bytes) / 1024 / 1024:.1f}MB) exceeds the 5MB limit per photo."

        norm_content_type = content_type.lower().split(';')[0].strip() if content_type else ''
        if norm_content_type not in cls.ALLOWED_CONTENT_TYPES:
            # Fallback check file extension
            guessed_type, _ = mimetypes.guess_type(original_filename)
            if guessed_type in cls.ALLOWED_CONTENT_TYPES:
                norm_content_type = guessed_type
            else:
                return None, f"Unsupported file type '{content_type}'. Please upload JPEG, PNG, or WebP images."

        ext = mimetypes.guess_extension(norm_content_type) or '.jpg'
        if ext == '.jpe':
            ext = '.jpg'

        filename = f"listing_{user_id}_{int(time.time())}_{secrets.token_hex(4)}{ext}"

        config = cls.get_config()
        if config['is_configured']:
            # Cloud Supabase Storage upload
            object_path = f"listings/{user_id}/{filename}"
            upload_endpoint = f"{config['url']}/storage/v1/object/{config['bucket']}/{object_path}"

            req = urllib.request.Request(
                upload_endpoint,
                data=file_bytes,
                headers={
                    'Authorization': f"Bearer {config['key']}",
                    'Content-Type': norm_content_type,
                    'x-upsert': 'true',
                },
                method='POST',
            )

            try:
                with urllib.request.urlopen(req, timeout=12) as response:
                    if response.status in (200, 201):
                        public_url = f"{config['url']}/storage/v1/object/public/{config['bucket']}/{object_path}"
                        return public_url, None
                    return None, f"Supabase Storage returned unexpected HTTP {response.status}"
            except urllib.error.HTTPError as exc:
                err_body = exc.read().decode('utf-8', errors='ignore')
                return None, f"Supabase Storage upload error ({exc.code}): {err_body}"
            except Exception as exc:
                return None, f"Failed to connect to Supabase Storage: {str(exc)}"

        # If Supabase Storage is not configured, support local storage in development/test
        if settings.DEBUG or 'test' in sys.argv:
            try:
                dest_dir = Path(settings.MEDIA_ROOT) / 'listings' / str(user_id)
                dest_dir.mkdir(parents=True, exist_ok=True)
                dest_path = dest_dir / filename
                with open(dest_path, 'wb') as f:
                    f.write(file_bytes)
                local_url = f"{settings.MEDIA_URL.rstrip('/')}/listings/{user_id}/{filename}"
                return local_url, None
            except Exception as exc:
                return None, f"Failed to save listing photo locally: {str(exc)}"

        return None, (
            "Supabase Storage credentials are missing. Please configure "
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env "
            "to enable cloud photo uploads."
        )
