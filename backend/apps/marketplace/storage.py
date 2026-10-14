import os
import sys
import time
import json
import secrets
import mimetypes
import logging
import urllib.request
import urllib.error
from pathlib import Path
from typing import Tuple, Optional
from django.conf import settings

logger = logging.getLogger(__name__)


class ListingStorageService:
    """
    Handles secure item photo uploads to Supabase Storage via REST API.
    Uses the backend-only service-role key, ensuring credentials are never exposed to clients.
    Automatically ensures the target bucket exists, creating it as public if needed.
    Falls back to local media storage if cloud storage is unavailable or not yet configured.
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
    def ensure_bucket(cls, config: dict) -> bool:
        """
        Ensures the Supabase Storage bucket exists.
        If it does not exist, automatically creates it as a public bucket using the service-role key.
        """
        if not config.get('is_configured'):
            return False
        try:
            create_endpoint = f"{config['url']}/storage/v1/bucket"
            payload = json.dumps({
                "id": config['bucket'],
                "name": config['bucket'],
                "public": True,
                "file_size_limit": cls.MAX_FILE_SIZE,
                "allowed_mime_types": list(cls.ALLOWED_CONTENT_TYPES),
            }).encode('utf-8')

            req = urllib.request.Request(
                create_endpoint,
                data=payload,
                headers={
                    'Authorization': f"Bearer {config['key']}",
                    'Content-Type': 'application/json',
                },
                method='POST',
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status in (200, 201)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode('utf-8', errors='ignore')
            # 409 Conflict or "already exists" means bucket is ready
            if exc.code == 409 or 'already exists' in body.lower() or 'duplicate' in body.lower():
                return True
            logger.warning("Could not auto-create Supabase bucket '%s': %s", config['bucket'], body)
            return False
        except Exception as exc:
            logger.warning("Exception auto-creating Supabase bucket '%s': %s", config['bucket'], exc)
            return False

    @classmethod
    def _save_local(cls, user_id: int, filename: str, file_bytes: bytes) -> Optional[str]:
        """Saves file to local MEDIA_ROOT storage as a robust fallback."""
        try:
            dest_dir = Path(settings.MEDIA_ROOT) / 'listings' / str(user_id)
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_path = dest_dir / filename
            with open(dest_path, 'wb') as f:
                f.write(file_bytes)
            return f"{settings.MEDIA_URL.rstrip('/')}/listings/{user_id}/{filename}"
        except Exception as exc:
            logger.warning("Local storage fallback failed: %s", exc)
            return None

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
            object_path = f"listings/{user_id}/{filename}"
            upload_endpoint = f"{config['url']}/storage/v1/object/{config['bucket']}/{object_path}"

            def _attempt_upload() -> Tuple[Optional[str], Optional[str]]:
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
                with urllib.request.urlopen(req, timeout=12) as response:
                    if response.status in (200, 201):
                        return f"{config['url']}/storage/v1/object/public/{config['bucket']}/{object_path}", None
                    return None, f"Supabase Storage returned unexpected HTTP {response.status}"

            try:
                public_url, err = _attempt_upload()
                if public_url:
                    return public_url, None
            except urllib.error.HTTPError as exc:
                err_body = exc.read().decode('utf-8', errors='ignore')
                # If bucket was not found, auto-create the bucket and retry upload
                if exc.code in (400, 404) and ('nosuchbucket' in err_body.lower() or 'not found' in err_body.lower() or 'bucket' in err_body.lower()):
                    if cls.ensure_bucket(config):
                        try:
                            public_url, _ = _attempt_upload()
                            if public_url:
                                return public_url, None
                        except Exception:
                            pass

                # If cloud upload failed, fall back to local storage so user flow is not broken
                local_url = cls._save_local(user_id, filename, file_bytes)
                if local_url:
                    return local_url, None

                return None, f"Supabase Storage upload error ({exc.code}): {err_body}"
            except Exception as exc:
                local_url = cls._save_local(user_id, filename, file_bytes)
                if local_url:
                    return local_url, None
                return None, f"Failed to connect to Supabase Storage: {str(exc)}"

        # If Supabase Storage is not configured, support local storage in development/test
        local_url = cls._save_local(user_id, filename, file_bytes)
        if local_url:
            return local_url, None

        return None, (
            "Supabase Storage credentials are missing. Please configure "
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env "
            "to enable cloud photo uploads."
        )
