import os
import time
import secrets
import mimetypes
import urllib.request
import urllib.error
from typing import Tuple, Optional


class SupabaseStorageService:
    """
    Handles secure profile photo uploads to Supabase Storage via REST API.
    Uses the backend-only service-role key, ensuring credentials are never exposed to clients.
    """

    ALLOWED_CONTENT_TYPES = {
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
    }
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

    @classmethod
    def get_config(cls) -> dict:
        url = os.getenv('SUPABASE_URL', '').strip().rstrip('/')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip()
        bucket = os.getenv('SUPABASE_STORAGE_BUCKET', 'avatars').strip()
        return {
            'url': url,
            'key': key,
            'bucket': bucket,
            'is_configured': bool(url and key),
        }

    @classmethod
    def upload_avatar(
        cls,
        user_id: int,
        file_bytes: bytes,
        content_type: str,
        original_filename: str,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Uploads profile photo to Supabase Storage bucket.
        Returns:
            (public_url, None) on success
            (None, error_message) on failure or when unconfigured
        """
        config = cls.get_config()
        if not config['is_configured']:
            return None, (
                "Supabase Storage credentials are missing. Please configure "
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env "
                "to enable cloud photo uploads."
            )

        if len(file_bytes) > cls.MAX_FILE_SIZE:
            return None, f"File size ({len(file_bytes) / 1024 / 1024:.1f}MB) exceeds the 5MB limit."

        norm_content_type = content_type.lower().split(';')[0].strip()
        if norm_content_type not in cls.ALLOWED_CONTENT_TYPES:
            # Check file extension as fallback
            ext = os.path.splitext(original_filename)[1].lower()
            guessed_type, _ = mimetypes.guess_type(original_filename)
            if guessed_type in cls.ALLOWED_CONTENT_TYPES:
                norm_content_type = guessed_type
            else:
                return None, f"Unsupported file type '{content_type}'. Please upload JPEG, PNG, or WebP."

        ext = mimetypes.guess_extension(norm_content_type) or '.jpg'
        if ext == '.jpe':
            ext = '.jpg'

        filename = f"avatar_{int(time.time())}_{secrets.token_hex(4)}{ext}"
        object_path = f"users/{user_id}/{filename}"
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
