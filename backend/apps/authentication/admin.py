from django.contrib import admin
from .models import College, StudentProfile, EmailVerificationCode, PasswordResetCode


@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_code', 'domain', 'city', 'state', 'is_active', 'created_at')
    list_filter = ('is_active', 'state')
    search_fields = ('name', 'short_code', 'domain', 'city')
    ordering = ('name',)


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = (
        'full_name',
        'college_email',
        'college',
        'verification_status',
        'is_email_verified',
        'is_college_verified',
        'created_at',
    )
    list_filter = ('verification_status', 'is_email_verified', 'is_college_verified', 'college')
    search_fields = ('full_name', 'college_email', 'user__username', 'custom_college_name', 'student_id_number')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(EmailVerificationCode)
class EmailVerificationCodeAdmin(admin.ModelAdmin):
    list_display = ('email', 'code', 'is_used', 'expires_at', 'created_at')
    list_filter = ('is_used',)
    search_fields = ('email', 'code')
    readonly_fields = ('token', 'created_at')


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ('user', 'code', 'is_used', 'expires_at', 'created_at')
    list_filter = ('is_used',)
    search_fields = ('user__username', 'user__email', 'code')
    readonly_fields = ('token', 'created_at')
