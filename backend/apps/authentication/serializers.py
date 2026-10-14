from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import College, StudentProfile


class CollegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = College
        fields = [
            'id',
            'name',
            'short_code',
            'domain',
            'city',
            'state',
        ]


class StudentProfileSerializer(serializers.ModelSerializer):
    college = CollegeSerializer(read_only=True)
    display_college = serializers.CharField(read_only=True)
    default_avatar_url = serializers.CharField(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    trust_score = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    def get_avatar_url(self, obj):
        url = obj.avatar_url
        if not url:
            return None
        if url.startswith('http://') or url.startswith('https://'):
            return url
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(url)
        import os
        backend_base = os.getenv('BACKEND_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
        return f"{backend_base}{url}"

    class Meta:
        model = StudentProfile
        fields = [
            'id',
            'username',
            'full_name',
            'college_email',
            'college',
            'custom_college_name',
            'display_college',
            'avatar_url',
            'default_avatar_url',
            'is_email_verified',
            'is_college_verified',
            'verification_status',
            'trust_score',
            'trust_status',
            'completed_rentals_count',
            'lender_average_rating',
            'lender_review_count',
            'grad_year',
            'major',
            'student_id_number',
            'bio',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'college_email',
            'is_email_verified',
            'is_college_verified',
            'verification_status',
            'created_at',
            'updated_at',
        ]

    def get_trust_score(self, obj):
        return obj.trust_score if obj.trust_score is not None else 75


class UserRegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, required=True)
    email = serializers.EmailField(required=True)
    college_id = serializers.IntegerField(required=False, allow_null=True)
    custom_college_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate_email(self, value):
        norm_email = value.strip().lower()
        # Allow re-registration if the existing account was never verified with OTP
        user = User.objects.filter(email__iexact=norm_email).first()
        if user:
            profile = getattr(user, 'profile', None)
            if profile and profile.is_email_verified:
                raise serializers.ValidationError("An account with this email address already exists.")
        elif StudentProfile.objects.filter(college_email__iexact=norm_email, is_email_verified=True).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return norm_email

    def validate(self, attrs):
        password = attrs.get('password')
        confirm_password = attrs.get('confirm_password')

        if password != confirm_password:
            raise serializers.ValidationError({'confirm_password': "Passwords do not match."})

        # Run Django password validators
        try:
            validate_password(password)
        except Exception as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})

        college_id = attrs.get('college_id')
        if college_id:
            try:
                attrs['college_obj'] = College.objects.get(id=college_id, is_active=True)
            except College.DoesNotExist:
                raise serializers.ValidationError({'college_id': "Selected college is not in the active registry."})
        else:
            attrs['college_obj'] = None

        return attrs


class EmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.CharField(max_length=6, min_length=6, required=True)

    def validate_code(self, value):
        clean = value.strip()
        if not clean.isdigit() or len(clean) != 6:
            raise serializers.ValidationError("Verification code must be exactly 6 digits.")
        return clean


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)


class ForgotPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.CharField(max_length=6, min_length=6, required=True)
    new_password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        if attrs.get('new_password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({'confirm_password': "Passwords do not match."})
        try:
            validate_password(attrs.get('new_password'))
        except Exception as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)})
        return attrs


class StudentProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = [
            'full_name',
            'major',
            'grad_year',
            'student_id_number',
            'bio',
        ]
