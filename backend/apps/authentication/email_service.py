import os
import logging
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


class EmailDeliveryService:
    """
    Manages email delivery for OTP verification and password resets.
    Strictly reports delivery configuration status rather than faking success.
    """

    @classmethod
    def is_smtp_configured(cls) -> bool:
        host = getattr(settings, 'EMAIL_HOST', '') or os.getenv('EMAIL_HOST', '').strip()
        user = getattr(settings, 'EMAIL_HOST_USER', '') or os.getenv('EMAIL_HOST_USER', '').strip()
        backend = getattr(settings, 'EMAIL_BACKEND', '')
        return bool(host and user and 'smtp' in backend.lower())

    @classmethod
    def send_verification_otp(cls, email: str, code: str, full_name: str) -> dict:
        subject = f"CampusShare Verification Code: {code}"
        message = (
            f"Hello {full_name},\n\n"
            f"Welcome to CampusShare! Use the following 6-digit code to verify your college email address:\n\n"
            f"  {code}\n\n"
            f"This code will expire in 15 minutes.\n"
            f"If you did not request this account, please ignore this email.\n\n"
            f"— The CampusShare Team"
        )
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or os.getenv('DEFAULT_FROM_EMAIL', 'CampusShare <noreply@campusshare.edu>')

        if cls.is_smtp_configured():
            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=from_email,
                    recipient_list=[email],
                    fail_silently=False,
                )
                print(f"[CAMPUSSHARE EMAIL] Verification OTP {code} sent successfully to {email}")
                return {
                    'delivered': True,
                    'method': 'smtp',
                    'message': f"Verification code sent to {email}",
                }
            except Exception as exc:
                logger.error("Failed to deliver email via SMTP: %s", exc)
                print(f"[CAMPUSSHARE EMAIL ERROR] Failed to deliver verification code to {email}: {exc}")
                return {
                    'delivered': False,
                    'method': 'smtp_error',
                    'message': f"SMTP delivery error: {str(exc)}",
                    'dev_code': code if settings.DEBUG else None,
                }

        # SMTP is not configured
        if settings.DEBUG:
            print("\n" + "=" * 60)
            print(f"[CAMPUSSHARE DEV EMAIL NOTIFICATION]")
            print(f"To: {email}")
            print(f"Subject: {subject}")
            print(f"Verification Code: {code}")
            print("=" * 60 + "\n")
            return {
                'delivered': False,
                'method': 'development_fallback',
                'message': (
                    "SMTP credentials are not configured in backend/.env. "
                    "For development, your 6-digit verification code is logged below."
                ),
                'dev_code': code,
            }

        return {
            'delivered': False,
            'method': 'unconfigured',
            'message': (
                "Email delivery is not configured. Please configure EMAIL_HOST, "
                "EMAIL_PORT, EMAIL_HOST_USER, and EMAIL_HOST_PASSWORD in backend/.env."
            ),
        }

    @classmethod
    def send_password_reset_otp(cls, email: str, code: str) -> dict:
        subject = f"CampusShare Password Reset Code: {code}"
        message = (
            f"Hello,\n\n"
            f"We received a request to reset your CampusShare account password. "
            f"Use the following 6-digit code to proceed:\n\n"
            f"  {code}\n\n"
            f"This code will expire in 15 minutes.\n"
            f"If you did not request a password reset, your account is secure and you can ignore this email.\n\n"
            f"— The CampusShare Team"
        )
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or os.getenv('DEFAULT_FROM_EMAIL', 'CampusShare <noreply@campusshare.edu>')

        if cls.is_smtp_configured():
            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=from_email,
                    recipient_list=[email],
                    fail_silently=False,
                )
                print(f"[CAMPUSSHARE EMAIL] Password reset OTP {code} sent successfully to {email}")
                return {
                    'delivered': True,
                    'method': 'smtp',
                    'message': f"Password reset code sent to {email}",
                }
            except Exception as exc:
                logger.error("Failed to deliver password reset via SMTP: %s", exc)
                print(f"[CAMPUSSHARE EMAIL ERROR] Failed to deliver password reset to {email}: {exc}")
                return {
                    'delivered': False,
                    'method': 'smtp_error',
                    'message': f"SMTP delivery error: {str(exc)}",
                    'dev_code': code if settings.DEBUG else None,
                }

        if settings.DEBUG:
            print("\n" + "=" * 60)
            print(f"[CAMPUSSHARE PASSWORD RESET CODE]")
            print(f"To: {email}")
            print(f"Reset Code: {code}")
            print("=" * 60 + "\n")
            return {
                'delivered': False,
                'method': 'development_fallback',
                'message': (
                    "SMTP credentials are not configured in backend/.env. "
                    "In development, your 6-digit reset code is provided below."
                ),
                'dev_code': code,
            }

        return {
            'delivered': False,
            'method': 'unconfigured',
            'message': (
                "Email delivery is not configured. Please configure EMAIL_HOST, "
                "EMAIL_PORT, EMAIL_HOST_USER, and EMAIL_HOST_PASSWORD in backend/.env."
            ),
        }
