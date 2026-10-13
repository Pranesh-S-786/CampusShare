from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import College, StudentProfile, EmailVerificationCode, PasswordResetCode
from .serializers import (
    CollegeSerializer,
    StudentProfileSerializer,
    UserRegistrationSerializer,
    EmailVerificationSerializer,
    ResendVerificationSerializer,
    LoginSerializer,
    ForgotPasswordRequestSerializer,
    PasswordResetConfirmSerializer,
    StudentProfileUpdateSerializer,
)
from .email_service import EmailDeliveryService
from .storage import SupabaseStorageService


class CollegeListView(APIView):
    """
    Returns active colleges from the official registry.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        colleges = College.objects.filter(is_active=True).order_by('name')
        serializer = CollegeSerializer(colleges, many=True)
        return Response({
            'colleges': serializer.data,
            'count': colleges.count(),
        })


class RegisterView(APIView):
    """
    Registers a new student account.
    Creates User and StudentProfile, then sends an email verification code.
    Account starts as unverified until ownership of the email address is confirmed.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        email = data['email'].strip().lower()
        full_name = data['full_name'].strip()
        college_obj = data.get('college_obj')
        custom_college_name = data.get('custom_college_name', '').strip()

        with transaction.atomic():
            # Use email as unique username
            user = User.objects.create_user(
                username=email,
                email=email,
                password=data['password'],
                first_name=full_name.split()[0] if full_name else '',
                last_name=' '.join(full_name.split()[1:]) if len(full_name.split()) > 1 else '',
            )

            profile = StudentProfile.objects.create(
                user=user,
                full_name=full_name,
                college=college_obj,
                custom_college_name=custom_college_name,
                college_email=email,
                is_email_verified=False,
                is_college_verified=False,
                verification_status='unverified',
            )

            # Generate OTP verification code
            verification = EmailVerificationCode.generate_for_user(user=user, email=email)

        # Dispatch email verification OTP
        delivery = EmailDeliveryService.send_verification_otp(
            email=email,
            code=verification.code,
            full_name=full_name,
        )

        return Response({
            'message': 'Account created successfully. Please verify your college email address.',
            'user_id': user.id,
            'email': email,
            'full_name': full_name,
            'is_email_verified': False,
            'is_college_verified': False,
            'verification_token': verification.token,
            'email_delivery': delivery,
        }, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    """
    Verifies ownership of the registered college email using a 6-digit OTP code.
    Upon verification, determines whether the student receives verified college status.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].strip().lower()
        code = serializer.validated_data['code'].strip()

        try:
            user = User.objects.get(email__iexact=email)
            profile = user.profile
        except (User.DoesNotExist, StudentProfile.DoesNotExist):
            return Response({
                'errors': {'email': 'No account found with this email address.'}
            }, status=status.HTTP_404_NOT_FOUND)

        if profile.is_email_verified:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'message': 'Email address is already verified.',
                'token': token.key,
                'user': StudentProfileSerializer(profile).data,
            }, status=status.HTTP_200_OK)

        # Look up valid verification record
        records = EmailVerificationCode.objects.filter(
            user=user,
            email=email,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).order_by('-created_at')

        if not records.exists():
            return Response({
                'errors': {'code': 'Verification code has expired or was not found. Please request a new code.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        record = records.first()
        if record.code != code:
            record.attempts += 1
            record.save(update_fields=['attempts'])
            return Response({
                'errors': {'code': f'Invalid verification code. {5 - record.attempts} attempts remaining.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        # Mark code used and update profile verification status
        record.is_used = True
        record.save(update_fields=['is_used'])

        profile.is_email_verified = True
        profile.update_verification_status(save=True)

        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            'message': 'Email address verified successfully!',
            'token': token.key,
            'user': StudentProfileSerializer(profile).data,
            'is_college_verified': profile.is_college_verified,
            'verification_status': profile.verification_status,
        }, status=status.HTTP_200_OK)


class ResendVerificationView(APIView):
    """
    Generates and resends a fresh 6-digit OTP verification code.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].strip().lower()

        try:
            user = User.objects.get(email__iexact=email)
            profile = user.profile
        except (User.DoesNotExist, StudentProfile.DoesNotExist):
            return Response({
                'errors': {'email': 'No account found with this email address.'}
            }, status=status.HTTP_404_NOT_FOUND)

        if profile.is_email_verified:
            return Response({
                'message': 'Email address is already verified.',
            }, status=status.HTTP_200_OK)

        verification = EmailVerificationCode.generate_for_user(user=user, email=email)
        delivery = EmailDeliveryService.send_verification_otp(
            email=email,
            code=verification.code,
            full_name=profile.full_name,
        )

        return Response({
            'message': f'New verification code generated for {email}.',
            'verification_token': verification.token,
            'email_delivery': delivery,
        }, status=status.HTTP_200_OK)


class LoginView(APIView):
    """
    Authenticates user with college email and password.
    Returns secure DRF auth token and student profile.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].strip().lower()
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({
                'errors': {'detail': 'Invalid email address or password.'}
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return Response({
                'errors': {'detail': 'Invalid email address or password.'}
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({
                'errors': {'detail': 'This account has been deactivated.'}
            }, status=status.HTTP_403_FORBIDDEN)

        profile, _ = StudentProfile.objects.get_or_create(
            user=user,
            defaults={
                'full_name': user.get_full_name() or email.split('@')[0],
                'college_email': email,
            }
        )

        token, _ = Token.objects.get_or_create(user=user)

        delivery_info = None
        if not profile.is_email_verified:
            # Automatically generate and dispatch a verification OTP so user receives it in their inbox immediately
            verification = EmailVerificationCode.generate_for_user(user=user, email=email)
            delivery_info = EmailDeliveryService.send_verification_otp(
                email=email,
                code=verification.code,
                full_name=profile.full_name or user.get_full_name() or email.split('@')[0],
            )

        return Response({
            'message': 'Login successful.',
            'token': token.key,
            'user': StudentProfileSerializer(profile).data,
            'is_email_verified': profile.is_email_verified,
            'is_college_verified': profile.is_college_verified,
            'email_delivery': delivery_info,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Securely invalidates the user's active authentication token.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if hasattr(request, 'auth') and isinstance(request.auth, Token):
            request.auth.delete()
        return Response({
            'message': 'Logged out successfully.'
        }, status=status.HTTP_200_OK)


class MeView(APIView):
    """
    Retrieves or updates the authenticated student's profile.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        return Response({
            'user': StudentProfileSerializer(profile).data,
        })

    def patch(self, request):
        profile = request.user.profile
        serializer = StudentProfileUpdateSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response({
            'message': 'Profile updated successfully.',
            'user': StudentProfileSerializer(profile).data,
        })


class ForgotPasswordView(APIView):
    """
    Initiates forgot-password flow by sending a 6-digit reset code.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].strip().lower()

        try:
            user = User.objects.get(email__iexact=email)
            reset_code = PasswordResetCode.generate_for_user(user=user)
            delivery = EmailDeliveryService.send_password_reset_otp(
                email=email,
                code=reset_code.code,
            )
            return Response({
                'message': f'Password reset instructions sent to {email}.',
                'email_delivery': delivery,
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            # Do not leak email existence, but return uniform message
            return Response({
                'message': f'If an account exists with {email}, password reset instructions have been sent.',
            }, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """
    Verifies reset OTP code and securely updates user password.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].strip().lower()
        code = serializer.validated_data['code'].strip()
        new_password = serializer.validated_data['new_password']

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({
                'errors': {'email': 'No account found with this email address.'}
            }, status=status.HTTP_404_NOT_FOUND)

        records = PasswordResetCode.objects.filter(
            user=user,
            email=email,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).order_by('-created_at')

        if not records.exists():
            return Response({
                'errors': {'code': 'Reset code has expired. Please request a new code.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        record = records.first()
        if record.code != code:
            record.attempts += 1
            record.save(update_fields=['attempts'])
            return Response({
                'errors': {'code': f'Invalid code. {5 - record.attempts} attempts remaining.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        record.is_used = True
        record.save(update_fields=['is_used'])

        # Update password
        user.set_password(new_password)
        user.save()

        # Invalidate old tokens and issue a fresh one
        Token.objects.filter(user=user).delete()
        new_token = Token.objects.create(user=user)

        return Response({
            'message': 'Password has been reset successfully. You are now logged in.',
            'token': new_token.key,
            'user': StudentProfileSerializer(user.profile).data,
        }, status=status.HTTP_200_OK)


class UploadProfilePhotoView(APIView):
    """
    Uploads optional profile photo directly to configured Supabase Storage.
    Never stores base64 blobs in the database.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        photo = request.FILES.get('photo')
        if not photo:
            return Response({
                'errors': {'photo': 'No image file was provided.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        profile = request.user.profile
        content_type = photo.content_type or 'image/jpeg'
        file_bytes = photo.read()

        public_url, err = SupabaseStorageService.upload_avatar(
            user_id=request.user.id,
            file_bytes=file_bytes,
            content_type=content_type,
            original_filename=photo.name,
        )

        if err:
            return Response({
                'errors': {'storage': err},
                'storage_configured': SupabaseStorageService.get_config()['is_configured'],
            }, status=status.HTTP_400_BAD_REQUEST)

        profile.avatar_url = public_url
        profile.save(update_fields=['avatar_url', 'updated_at'])

        return Response({
            'message': 'Profile photo uploaded to Supabase Storage successfully.',
            'avatar_url': public_url,
            'user': StudentProfileSerializer(profile).data,
        }, status=status.HTTP_200_OK)
