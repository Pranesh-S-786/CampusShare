from datetime import timedelta
from decimal import Decimal
import secrets
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class College(models.Model):
    """
    Registry of verified institutions.
    Students registering with an official email domain matching this registry
    and successfully verifying email ownership achieve 'verified_student' status.
    """
    name = models.CharField(max_length=255, unique=True)
    short_code = models.CharField(max_length=50, unique=True)
    domain = models.CharField(
        max_length=120,
        help_text="Institutional email domain without '@' (e.g., 'cit.edu.in', 'psgtech.edu')",
    )
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'College'
        verbose_name_plural = 'Colleges'

    def __str__(self):
        return f"{self.name} ({self.short_code})"

    def matches_email_domain(self, email: str) -> bool:
        """
        Check whether an email address belongs to this college's official domain.
        Handles subdomains as well (e.g. student@alumni.cit.edu.in).
        """
        if not email or '@' not in email:
            return False
        email_domain = email.strip().lower().split('@')[-1]
        target_domain = self.domain.strip().lower()
        return email_domain == target_domain or email_domain.endswith('.' + target_domain)


class StudentProfile(models.Model):
    """
    Student profile linked 1:1 with Django User.
    Enforces separation between email ownership verification and verified college affiliation.
    """
    VERIFICATION_STATUS_CHOICES = [
        ('unverified', 'Unverified Account'),
        ('email_verified', 'Email Verified (Independent / Community Member)'),
        ('verified_student', 'Verified Campus Student'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    full_name = models.CharField(max_length=255)
    college = models.ForeignKey(
        College,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students',
        help_text="Selected college from official registry, or None if unsupported.",
    )
    custom_college_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="User-provided college name for unverified/unsupported colleges.",
    )
    college_email = models.EmailField(unique=True)
    avatar_url = models.URLField(max_length=1024, blank=True, null=True)

    is_email_verified = models.BooleanField(
        default=False,
        help_text="True only when user proves ownership of email via verification link or OTP.",
    )
    is_college_verified = models.BooleanField(
        default=False,
        help_text="True only when email is verified AND belongs to registered active College domain.",
    )
    verification_status = models.CharField(
        max_length=30,
        choices=VERIFICATION_STATUS_CHOICES,
        default='unverified',
    )

    # Optional student profile attributes
    grad_year = models.PositiveIntegerField(null=True, blank=True)
    major = models.CharField(max_length=150, blank=True)
    student_id_number = models.CharField(max_length=60, blank=True)
    bio = models.TextField(max_length=600, blank=True)

    # Dynamic Trust Score & Rental History
    trust_score = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Backend-managed 0-100 trust score computed from verified rental history"
    )
    trust_status = models.CharField(
        max_length=50,
        default='insufficient_history',
        help_text="Status label: 'insufficient_history', 'good', 'excellent', etc."
    )
    completed_rentals_count = models.PositiveIntegerField(
        default=0,
        help_text="Count of successfully returned/completed rentals as borrower or lender"
    )
    lender_average_rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Average rating (1.00 - 5.00) from borrower reviews of this lender"
    )
    lender_review_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of eligible reviews received as a lender"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Student Profile'
        verbose_name_plural = 'Student Profiles'

    def __str__(self):
        return f"{self.full_name} ({self.college_email})"

    def update_verification_status(self, save: bool = True):
        """
        Calculates and syncs the verification status based on email verification
        and college affiliation checks.
        """
        if not self.is_email_verified:
            self.is_college_verified = False
            self.verification_status = 'unverified'
        elif self.college and self.college.is_active and self.college.matches_email_domain(self.college_email):
            self.is_college_verified = True
            self.verification_status = 'verified_student'
        else:
            # Email verified, but unsupported college or domain mismatch
            self.is_college_verified = False
            self.verification_status = 'email_verified'

        if save:
            self.save(update_fields=['is_email_verified', 'is_college_verified', 'verification_status', 'updated_at'])

    @property
    def display_college(self) -> str:
        if self.college:
            return self.college.name
        if self.custom_college_name:
            return f"{self.custom_college_name} (Unsupported)"
        return "Independent / Other"

    @property
    def default_avatar_url(self) -> str:
        """
        Generate a neutral initials-based avatar when no photo is uploaded.
        """
        initials = ''.join([part[0] for part in self.full_name.split()[:2] if part]).upper() or 'CS'
        return f"https://ui-avatars.com/api/?name={initials}&background=1B3B2B&color=ffffff&size=200&bold=true"


class EmailVerificationCode(models.Model):
    """
    6-digit OTP code and cryptographic token for email verification.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_verifications')
    email = models.EmailField()
    code = models.CharField(max_length=6)
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    @classmethod
    def generate_for_user(cls, user: User, email: str, expiry_minutes: int = 15):
        # Invalidate previous unused codes for this user
        cls.objects.filter(user=user, is_used=False).update(is_used=True)

        code = f"{secrets.randbelow(900000) + 100000}"  # 6-digit random code
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes)

        return cls.objects.create(
            user=user,
            email=email.strip().lower(),
            code=code,
            token=token,
            expires_at=expires_at,
        )

    def is_valid(self) -> bool:
        return not self.is_used and timezone.now() < self.expires_at and self.attempts < 5


class PasswordResetCode(models.Model):
    """
    6-digit OTP code and token for password reset.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_resets')
    email = models.EmailField()
    code = models.CharField(max_length=6)
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    @classmethod
    def generate_for_user(cls, user: User, expiry_minutes: int = 15):
        cls.objects.filter(user=user, is_used=False).update(is_used=True)

        code = f"{secrets.randbelow(900000) + 100000}"
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes)

        return cls.objects.create(
            user=user,
            email=user.email.strip().lower(),
            code=code,
            token=token,
            expires_at=expires_at,
        )

    def is_valid(self) -> bool:
        return not self.is_used and timezone.now() < self.expires_at and self.attempts < 5
