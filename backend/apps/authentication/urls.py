from django.urls import path
from .views import (
    CollegeListView,
    RegisterView,
    VerifyEmailView,
    ResendVerificationView,
    LoginView,
    LogoutView,
    MeView,
    ForgotPasswordView,
    ResetPasswordView,
    UploadProfilePhotoView,
)

app_name = 'authentication'

urlpatterns = [
    path('colleges/', CollegeListView.as_view(), name='colleges-list'),
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('resend-verification/', ResendVerificationView.as_view(), name='resend-verification'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('profile/photo/', UploadProfilePhotoView.as_view(), name='upload-photo'),
]
