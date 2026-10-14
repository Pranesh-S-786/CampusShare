import os
import logging
import threading
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


def _send_email_worker(subject: str, text_message: str, html_message: str, from_email: str, recipient_list: list, reply_to: list):
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_message,
            from_email=from_email,
            to=recipient_list,
            reply_to=reply_to,
        )
        if html_message:
            msg.attach_alternative(html_message, "text/html")
        msg.send(fail_silently=False)
        print(f"[CAMPUSSHARE EMAIL SUCCESS] Delivered to {recipient_list}")
    except Exception as exc:
        logger.error("Failed to deliver email via SMTP: %s", exc)
        print(f"[CAMPUSSHARE EMAIL ERROR] Delivery to {recipient_list} failed: {exc}")


class EmailDeliveryService:
    """
    Manages fast, high-deliverability email delivery for OTP verification and password resets.
    Dispatches asynchronously via background workers so API responses return in milliseconds.
    """

    @classmethod
    def get_smtp_host(cls) -> str:
        return getattr(settings, 'EMAIL_HOST', None) or os.getenv('EMAIL_HOST', 'smtp.gmail.com')

    @classmethod
    def get_smtp_user(cls) -> str:
        return getattr(settings, 'EMAIL_HOST_USER', None) or os.getenv('EMAIL_HOST_USER', 'campusshare7@gmail.com')

    @classmethod
    def is_smtp_configured(cls) -> bool:
        host = cls.get_smtp_host()
        user = cls.get_smtp_user()
        return bool(host and user)

    @classmethod
    def send_verification_otp(cls, email: str, code: str, full_name: str, async_dispatch: bool = True) -> dict:
        subject = f"CampusShare Verification Code: {code}"
        
        text_message = (
            f"Hello {full_name},\n\n"
            f"Welcome to CampusShare! Use the following 6-digit code to verify your college email address:\n\n"
            f"  {code}\n\n"
            f"This code will expire in 15 minutes.\n"
            f"If you did not request this account, please ignore this email.\n\n"
            f"— The CampusShare Team"
        )

        html_message = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FBF8F3; margin: 0; padding: 24px; color: #1C1917; }}
    .container {{ max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; border: 1px solid #E7E5E4; padding: 36px 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .logo {{ font-size: 26px; font-weight: 800; color: #1B3B2B; letter-spacing: -0.5px; }}
    .logo span {{ color: #2C6E49; }}
    .title {{ font-size: 20px; font-weight: 700; color: #1C1917; margin-bottom: 8px; text-align: center; }}
    .subtitle {{ font-size: 14px; color: #78716C; text-align: center; margin-bottom: 28px; line-height: 1.5; }}
    .otp-box {{ background: #FBF8F3; border: 2px dashed #1B3B2B; border-radius: 16px; padding: 20px; text-align: center; margin: 0 auto 24px auto; max-width: 280px; }}
    .otp-code {{ font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1B3B2B; margin: 0; }}
    .notice {{ font-size: 13px; color: #78716C; text-align: center; margin-bottom: 20px; line-height: 1.5; }}
    .folder-tip {{ background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 12px; padding: 12px 16px; font-size: 12px; color: #92400E; margin-bottom: 24px; text-align: center; }}
    .footer {{ text-align: center; font-size: 11px; color: #A8A29E; border-top: 1px solid #F5F5F4; padding-top: 16px; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Campus<span>Share</span></div>
    </div>
    <div class="title">Verify Your College Email</div>
    <div class="subtitle">Hello {full_name}, welcome to CampusShare. Use the one-time verification code below to activate your account:</div>
    <div class="otp-box">
      <div class="otp-code">{code}</div>
    </div>
    <div class="notice">This code expires in <strong>15 minutes</strong>.<br>If you did not request this, please disregard this email.</div>
    <div class="folder-tip">Tip: If this email landed in your <strong>Spam / Junk / Promotions</strong> folder, please mark it as <em>Not Spam</em> to ensure you receive future booking updates.</div>
    <div class="footer">CampusShare &bull; The Peer-to-Peer Campus Marketplace</div>
  </div>
</body>
</html>"""

        from_user = cls.get_smtp_user()
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or f"CampusShare <{from_user}>"
        reply_to = [from_user]

        if cls.is_smtp_configured():
            if async_dispatch:
                # Dispatch concurrently so student receives response in milliseconds
                thread = threading.Thread(
                    target=_send_email_worker,
                    args=(subject, text_message, html_message, from_email, [email], reply_to),
                    daemon=True,
                )
                thread.start()
            else:
                _send_email_worker(subject, text_message, html_message, from_email, [email], reply_to)

            allow_hint = getattr(settings, 'SHOW_OTP_HINT', False)
            return {
                'delivered': True,
                'method': 'smtp',
                'message': f"Verification code sent to {email}",
                'dev_code': code if allow_hint else None,
            }

        # SMTP fallback in case no host/user is provided
        allow_hint = getattr(settings, 'SHOW_OTP_HINT', False)
        if settings.DEBUG:
            print(f"[CAMPUSSHARE DEV] OTP for {email}: {code}")
            return {
                'delivered': False,
                'method': 'development_fallback',
                'message': f"Verification code sent to {email}",
                'dev_code': code if allow_hint else None,
            }

        return {
            'delivered': False,
            'method': 'unconfigured',
            'message': "Email delivery is not configured.",
        }

    @classmethod
    def send_password_reset_otp(cls, email: str, code: str, async_dispatch: bool = True) -> dict:
        subject = f"CampusShare Password Reset Code: {code}"
        
        text_message = (
            f"Hello,\n\n"
            f"We received a request to reset your CampusShare account password. "
            f"Use the following 6-digit code to proceed:\n\n"
            f"  {code}\n\n"
            f"This code will expire in 15 minutes.\n"
            f"If you did not request a password reset, your account is secure and you can ignore this email.\n\n"
            f"— The CampusShare Team"
        )

        html_message = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FBF8F3; margin: 0; padding: 24px; color: #1C1917; }}
    .container {{ max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; border: 1px solid #E7E5E4; padding: 36px 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .logo {{ font-size: 26px; font-weight: 800; color: #1B3B2B; letter-spacing: -0.5px; }}
    .logo span {{ color: #2C6E49; }}
    .title {{ font-size: 20px; font-weight: 700; color: #1C1917; margin-bottom: 8px; text-align: center; }}
    .subtitle {{ font-size: 14px; color: #78716C; text-align: center; margin-bottom: 28px; line-height: 1.5; }}
    .otp-box {{ background: #FBF8F3; border: 2px dashed #1B3B2B; border-radius: 16px; padding: 20px; text-align: center; margin: 0 auto 24px auto; max-width: 280px; }}
    .otp-code {{ font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1B3B2B; margin: 0; }}
    .notice {{ font-size: 13px; color: #78716C; text-align: center; margin-bottom: 24px; line-height: 1.5; }}
    .footer {{ text-align: center; font-size: 11px; color: #A8A29E; border-top: 1px solid #F5F5F4; padding-top: 16px; margin-top: 20px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Campus<span>Share</span></div>
    </div>
    <div class="title">Reset Your Password</div>
    <div class="subtitle">We received a request to reset your password. Use the one-time code below:</div>
    <div class="otp-box">
      <div class="otp-code">{code}</div>
    </div>
    <div class="notice">This code expires in <strong>15 minutes</strong>.<br>If you did not request a password reset, you can safely ignore this email.</div>
    <div class="footer">CampusShare &bull; The Peer-to-Peer Campus Marketplace</div>
  </div>
</body>
</html>"""

        from_user = cls.get_smtp_user()
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or f"CampusShare <{from_user}>"
        reply_to = [from_user]

        if cls.is_smtp_configured():
            if async_dispatch:
                thread = threading.Thread(
                    target=_send_email_worker,
                    args=(subject, text_message, html_message, from_email, [email], reply_to),
                    daemon=True,
                )
                thread.start()
            else:
                _send_email_worker(subject, text_message, html_message, from_email, [email], reply_to)

            allow_hint = getattr(settings, 'SHOW_OTP_HINT', False)
            return {
                'delivered': True,
                'method': 'smtp',
                'message': f"Password reset code sent to {email}",
                'dev_code': code if allow_hint else None,
            }

        allow_hint = getattr(settings, 'SHOW_OTP_HINT', False)
        if settings.DEBUG:
            print(f"[CAMPUSSHARE DEV] Password reset code for {email}: {code}")
            return {
                'delivered': False,
                'method': 'development_fallback',
                'message': f"Password reset code sent to {email}",
                'dev_code': code if allow_hint else None,
            }

        return {
            'delivered': False,
            'method': 'unconfigured',
            'message': "Email delivery is not configured.",
        }
