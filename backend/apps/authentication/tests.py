from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from apps.authentication.models import (
    College,
    StudentProfile,
    EmailVerificationCode,
    PasswordResetCode,
)


class AuthenticationIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cit = College.objects.create(
            name='Coimbatore Institute of Technology (CIT)',
            short_code='CIT',
            domain='cit.edu.in',
            city='Coimbatore',
            state='Tamil Nadu',
            is_active=True,
        )
        self.psg = College.objects.create(
            name='PSG College of Technology',
            short_code='PSG',
            domain='psgtech.edu',
            city='Coimbatore',
            state='Tamil Nadu',
            is_active=True,
        )

    def test_college_registry_endpoint(self):
        response = self.client.get('/api/auth/colleges/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        colleges = response.data['colleges']
        self.assertEqual(colleges[0]['short_code'], 'CIT')

    def test_registration_with_matching_college_domain(self):
        payload = {
            'full_name': 'Aarav Sharma',
            'email': 'aarav.s@cit.edu.in',
            'college_id': self.cit.id,
            'password': 'SecurePassword@2026',
            'confirm_password': 'SecurePassword@2026',
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['is_email_verified'], False)
        self.assertEqual(response.data['is_college_verified'], False)

        # Verify DB records
        user = User.objects.get(email='aarav.s@cit.edu.in')
        profile = user.profile
        self.assertEqual(profile.full_name, 'Aarav Sharma')
        self.assertEqual(profile.is_email_verified, False)
        self.assertEqual(profile.is_college_verified, False)
        self.assertEqual(profile.verification_status, 'unverified')

        # Code was created
        code_obj = EmailVerificationCode.objects.filter(user=user, is_used=False).first()
        self.assertIsNotNone(code_obj)
        self.assertEqual(len(code_obj.code), 6)

    def test_registration_password_mismatch(self):
        payload = {
            'full_name': 'Test User',
            'email': 'test@cit.edu.in',
            'college_id': self.cit.id,
            'password': 'Password123!',
            'confirm_password': 'DifferentPassword123!',
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('confirm_password', response.data['errors'])

    def test_email_verification_grants_verified_college_status(self):
        # Register user
        user = User.objects.create_user(
            username='priya@cit.edu.in',
            email='priya@cit.edu.in',
            password='ComplexPassword@123',
        )
        profile = StudentProfile.objects.create(
            user=user,
            full_name='Priya Raman',
            college=self.cit,
            college_email='priya@cit.edu.in',
            is_email_verified=False,
            is_college_verified=False,
            verification_status='unverified',
        )
        code_obj = EmailVerificationCode.generate_for_user(user, 'priya@cit.edu.in')

        # Submit OTP
        verify_payload = {
            'email': 'priya@cit.edu.in',
            'code': code_obj.code,
        }
        response = self.client.post('/api/auth/verify-email/', verify_payload, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['user']['is_email_verified'])
        self.assertTrue(response.data['user']['is_college_verified'])
        self.assertEqual(response.data['user']['verification_status'], 'verified_student')
        self.assertIn('token', response.data)

        # Refresh from db
        profile.refresh_from_db()
        self.assertTrue(profile.is_email_verified)
        self.assertTrue(profile.is_college_verified)
        self.assertEqual(profile.verification_status, 'verified_student')

    def test_unsupported_college_gets_email_verified_not_college_verified(self):
        # Student from unsupported college or with personal email
        user = User.objects.create_user(
            username='rohit@gmail.com',
            email='rohit@gmail.com',
            password='ComplexPassword@123',
        )
        profile = StudentProfile.objects.create(
            user=user,
            full_name='Rohit Verma',
            college=None,
            custom_college_name='City Polytech',
            college_email='rohit@gmail.com',
            is_email_verified=False,
            is_college_verified=False,
            verification_status='unverified',
        )
        code_obj = EmailVerificationCode.generate_for_user(user, 'rohit@gmail.com')

        verify_payload = {
            'email': 'rohit@gmail.com',
            'code': code_obj.code,
        }
        response = self.client.post('/api/auth/verify-email/', verify_payload, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['user']['is_email_verified'])
        # College verification must NOT be granted to unsupported college
        self.assertFalse(response.data['user']['is_college_verified'])
        self.assertEqual(response.data['user']['verification_status'], 'email_verified')

    def test_invalid_verification_code_rejected(self):
        user = User.objects.create_user(
            username='student@cit.edu.in',
            email='student@cit.edu.in',
            password='ComplexPassword@123',
        )
        StudentProfile.objects.create(
            user=user,
            full_name='Student One',
            college=self.cit,
            college_email='student@cit.edu.in',
        )
        EmailVerificationCode.generate_for_user(user, 'student@cit.edu.in')

        verify_payload = {
            'email': 'student@cit.edu.in',
            'code': '000000',  # Wrong code
        }
        response = self.client.post('/api/auth/verify-email/', verify_payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('code', response.data['errors'])

    def test_expired_verification_code_rejected(self):
        user = User.objects.create_user(
            username='student2@cit.edu.in',
            email='student2@cit.edu.in',
            password='ComplexPassword@123',
        )
        StudentProfile.objects.create(
            user=user,
            full_name='Student Two',
            college=self.cit,
            college_email='student2@cit.edu.in',
        )
        code_obj = EmailVerificationCode.generate_for_user(user, 'student2@cit.edu.in')
        # Expire code manually
        code_obj.expires_at = timezone.now() - timedelta(minutes=5)
        code_obj.save()

        verify_payload = {
            'email': 'student2@cit.edu.in',
            'code': code_obj.code,
        }
        response = self.client.post('/api/auth/verify-email/', verify_payload, format='json')
        self.assertEqual(response.status_code, 400)

    def test_login_flow(self):
        user = User.objects.create_user(
            username='swathi@cit.edu.in',
            email='swathi@cit.edu.in',
            password='ValidPassword@99',
        )
        profile = StudentProfile.objects.create(
            user=user,
            full_name='Swathi Kumar',
            college=self.cit,
            college_email='swathi@cit.edu.in',
            is_email_verified=True,
            is_college_verified=True,
            verification_status='verified_student',
        )

        # Successful login
        login_res = self.client.post('/api/auth/login/', {
            'email': 'swathi@cit.edu.in',
            'password': 'ValidPassword@99',
        }, format='json')
        self.assertEqual(login_res.status_code, 200)
        self.assertIn('token', login_res.data)
        self.assertEqual(login_res.data['user']['full_name'], 'Swathi Kumar')

        # Failed login with bad password
        bad_res = self.client.post('/api/auth/login/', {
            'email': 'swathi@cit.edu.in',
            'password': 'WrongPassword123',
        }, format='json')
        self.assertEqual(bad_res.status_code, 401)

    def test_login_blocked_for_unverified_email(self):
        user = User.objects.create_user(
            username='unverified@cit.edu.in',
            email='unverified@cit.edu.in',
            password='ValidPassword@99',
        )
        StudentProfile.objects.create(
            user=user,
            full_name='Unverified User',
            college=self.cit,
            college_email='unverified@cit.edu.in',
            is_email_verified=False,
            is_college_verified=False,
            verification_status='unverified',
        )

        login_res = self.client.post('/api/auth/login/', {
            'email': 'unverified@cit.edu.in',
            'password': 'ValidPassword@99',
        }, format='json')
        self.assertEqual(login_res.status_code, 403)
        self.assertTrue(login_res.data.get('requires_verification'))
        self.assertNotIn('token', login_res.data)

    def test_authenticated_me_and_logout(self):
        user = User.objects.create_user(
            username='naveen@cit.edu.in',
            email='naveen@cit.edu.in',
            password='ValidPassword@99',
        )
        profile = StudentProfile.objects.create(
            user=user,
            full_name='Naveen Raj',
            college=self.cit,
            college_email='naveen@cit.edu.in',
            is_email_verified=True,
            is_college_verified=True,
            verification_status='verified_student',
        )
        token = Token.objects.create(user=user)

        # Test authenticated /me
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        me_res = self.client.get('/api/auth/me/')
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.data['user']['full_name'], 'Naveen Raj')

        # Update profile
        patch_res = self.client.patch('/api/auth/me/', {
            'major': 'Computer Science & Engineering',
            'grad_year': 2027,
            'bio': 'Passionate about distributed systems & sports gear sharing.',
        }, format='json')
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.data['user']['major'], 'Computer Science & Engineering')
        self.assertEqual(patch_res.data['user']['grad_year'], 2027)

        # Logout
        logout_res = self.client.post('/api/auth/logout/')
        self.assertEqual(logout_res.status_code, 200)
        self.assertFalse(Token.objects.filter(key=token.key).exists())

        # Submitting with deleted token fails
        after_logout = self.client.get('/api/auth/me/')
        self.assertEqual(after_logout.status_code, 401)

    def test_forgot_password_and_reset_flow(self):
        user = User.objects.create_user(
            username='ananya@cit.edu.in',
            email='ananya@cit.edu.in',
            password='OldPassword@123',
        )
        StudentProfile.objects.create(
            user=user,
            full_name='Ananya Iyer',
            college=self.cit,
            college_email='ananya@cit.edu.in',
        )

        # Request reset
        forgot_res = self.client.post('/api/auth/forgot-password/', {
            'email': 'ananya@cit.edu.in',
        }, format='json')
        self.assertEqual(forgot_res.status_code, 200)

        reset_code_obj = PasswordResetCode.objects.filter(user=user, is_used=False).first()
        self.assertIsNotNone(reset_code_obj)

        # Reset password with valid code
        reset_res = self.client.post('/api/auth/reset-password/', {
            'email': 'ananya@cit.edu.in',
            'code': reset_code_obj.code,
            'new_password': 'BrandNewPassword@2026',
            'confirm_password': 'BrandNewPassword@2026',
        }, format='json')
        self.assertEqual(reset_res.status_code, 200)
        self.assertIn('token', reset_res.data)

        # Old password no longer works
        old_login = self.client.post('/api/auth/login/', {
            'email': 'ananya@cit.edu.in',
            'password': 'OldPassword@123',
        }, format='json')
        self.assertEqual(old_login.status_code, 401)

        # New password works
        new_login = self.client.post('/api/auth/login/', {
            'email': 'ananya@cit.edu.in',
            'password': 'BrandNewPassword@2026',
        }, format='json')
        self.assertEqual(new_login.status_code, 200)
