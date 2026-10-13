import hashlib
from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from apps.authentication.models import College, StudentProfile, EmailVerificationCode
from apps.marketplace.models import (
    Category,
    Listing,
    Booking,
    HandoverToken,
    PaymentRecord,
    SettlementAdjustment,
    DepositRefund,
    Conversation,
    Message,
    Notification,
    WantedItemRequest,
    WantedItemResponse,
)
from apps.marketplace.booking_logic import check_booking_conflict


class Stage10EndToEndAndSecurityTests(TestCase):
    """
    Stage 10: Complete End-to-End User Journey, Concurrency, and Security Hardening test suite.
    Validates complete lifecycle across Auth -> Listings -> Bookings -> QR Handover ->
    Direct Payment Tracking -> Adjustments -> Deposit Refunds -> Settlement Bills -> Messaging.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Setup Colleges
        self.cit = College.objects.create(
            name='Coimbatore Institute of Technology',
            short_code='CIT',
            domain='cit.edu.in',
            city='Coimbatore',
            state='Tamil Nadu',
            is_active=True
        )
        self.psg = College.objects.create(
            name='PSG College of Technology',
            short_code='PSG',
            domain='psgtech.edu',
            city='Coimbatore',
            state='Tamil Nadu',
            is_active=True
        )

        # 2. Setup Category
        self.cat_electronics = Category.objects.create(
            name='Electronics',
            slug='electronics',
            icon='laptop',
            order=1,
            is_active=True
        )

        # 3. Create Student A (Lender)
        self.user_a = User.objects.create_user(
            username='arjun@cit.edu.in',
            email='arjun@cit.edu.in',
            password='SecurePassword123!',
            first_name='Arjun',
            last_name='K'
        )
        self.profile_a = StudentProfile.objects.create(
            user=self.user_a,
            college=self.cit,
            college_email='arjun@cit.edu.in',
            full_name='Arjun K',
            is_email_verified=True,
            is_college_verified=True,
            verification_status='verified_student'
        )
        self.token_a = Token.objects.create(user=self.user_a)

        # 4. Create Student B (Borrower)
        self.user_b = User.objects.create_user(
            username='priya@cit.edu.in',
            email='priya@cit.edu.in',
            password='SecurePassword123!',
            first_name='Priya',
            last_name='S'
        )
        self.profile_b = StudentProfile.objects.create(
            user=self.user_b,
            college=self.cit,
            college_email='priya@cit.edu.in',
            full_name='Priya S',
            is_email_verified=True,
            is_college_verified=True,
            verification_status='verified_student'
        )
        self.token_b = Token.objects.create(user=self.user_b)

        # 5. Create Student C (Unrelated Attacker / Snooper)
        self.user_c = User.objects.create_user(
            username='snooper@psgtech.edu',
            email='snooper@psgtech.edu',
            password='SecurePassword123!',
            first_name='Malicious',
            last_name='User'
        )
        self.profile_c = StudentProfile.objects.create(
            user=self.user_c,
            college=self.psg,
            college_email='snooper@psgtech.edu',
            full_name='Malicious User',
            is_email_verified=True,
            is_college_verified=True,
            verification_status='verified_student'
        )
        self.token_c = Token.objects.create(user=self.user_c)

    def test_complete_e2e_student_lifecycle(self):
        """
        Step-by-step verification of the complete real student workflow:
        1. Registration & email OTP verification.
        2. Listing creation with photos.
        3. Discovery & booking quote calculation.
        4. Booking submission and notification.
        5. Owner approval with notification.
        6. Pickup QR generation, verification, and transition to active.
        7. Direct peer payment declaration & recipient confirmation.
        8. Return QR generation, verification, and transition to returned.
        9. Settlement adjustment proposal & mutual acceptance.
        10. Deposit refund declaration & borrower confirmation.
        11. Final settlement bill generation with Decimal precision.
        12. Contextual messaging and conversation history.
        """
        # ==========================================
        # STEP 1: Registration & OTP Verification
        # ==========================================
        reg_data = {
            'full_name': 'Divya M',
            'email': 'divya@cit.edu.in',
            'college_id': self.cit.id,
            'password': 'StrongPassword2026!',
            'confirm_password': 'StrongPassword2026!',
        }
        resp = self.client.post('/api/auth/register/', reg_data)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        user_divya = User.objects.get(email='divya@cit.edu.in')
        otp_code = EmailVerificationCode.objects.filter(user=user_divya, is_used=False).first()
        self.assertIsNotNone(otp_code)

        # Verify OTP
        verify_resp = self.client.post('/api/auth/verify-email/', {
            'email': 'divya@cit.edu.in',
            'code': otp_code.code,
        })
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        user_divya.profile.refresh_from_db()
        self.assertTrue(user_divya.profile.is_email_verified)
        self.assertTrue(user_divya.profile.is_college_verified)

        # ==========================================
        # STEP 2: Listing Creation by Student A
        # ==========================================
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        listing_payload = {
            'title': 'Casio FX-991EX Scientific Calculator',
            'description': 'Advanced non-programmable calculator for engineering mathematics exams.',
            'category_id': self.cat_electronics.id,
            'listing_type': 'rent',
            'price': '50.00',
            'pricing_unit': 'day',
            'deposit_amount': '200.00',
            'condition': 'like_new',
            'pickup_location': 'CIT Mechanical Block Room 204',
        }
        list_resp = self.client.post('/api/marketplace/listings/', listing_payload)
        self.assertEqual(list_resp.status_code, status.HTTP_201_CREATED)
        listing_id = list_resp.data['id']
        listing = Listing.objects.get(pk=listing_id)
        self.assertEqual(listing.price, Decimal('50.00'))
        self.assertEqual(listing.deposit_amount, Decimal('200.00'))

        # ==========================================
        # STEP 3: Discovery & Quote by Student B
        # ==========================================
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        search_resp = self.client.get('/api/marketplace/listings/?search=calculator')
        self.assertEqual(search_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(search_resp.data['count'], 1)

        start_date = date.today() + timedelta(days=2)
        end_date = start_date + timedelta(days=2)  # 3 days total

        quote_resp = self.client.get(
            f'/api/marketplace/bookings/quote/?listing_id={listing_id}&start_date={start_date.isoformat()}&end_date={end_date.isoformat()}'
        )
        self.assertEqual(quote_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(quote_resp.data['has_conflict'])
        self.assertEqual(quote_resp.data['quote']['duration_days'], 3)
        self.assertEqual(quote_resp.data['quote']['total_rent'], Decimal('150.00'))
        self.assertEqual(quote_resp.data['quote']['deposit_amount'], Decimal('200.00'))
        self.assertEqual(quote_resp.data['quote']['total_due_upfront'], Decimal('350.00'))

        # ==========================================
        # STEP 4: Booking Request Submission
        # ==========================================
        booking_payload = {
            'listing_id': listing_id,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'borrower_message': 'Need for end semester exam.',
        }
        book_resp = self.client.post('/api/marketplace/bookings/', booking_payload)
        self.assertEqual(book_resp.status_code, status.HTTP_201_CREATED)
        booking_id = book_resp.data['id']
        booking = Booking.objects.get(pk=booking_id)
        self.assertEqual(booking.status, 'pending')
        self.assertEqual(booking.calculated_total_rent, Decimal('150.00'))
        self.assertEqual(booking.snapshot_deposit_amount, Decimal('200.00'))
        self.assertEqual(booking.total_due_upfront, Decimal('350.00'))

        # Check notification received by Student A
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        notif_resp = self.client.get('/api/marketplace/notifications/')
        self.assertEqual(notif_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(any(n['notification_type'] == 'booking_request' for n in notif_resp.data['notifications']))

        # ==========================================
        # STEP 5: Owner Accepts Request
        # ==========================================
        accept_resp = self.client.post(f'/api/marketplace/bookings/{booking_id}/action/', {
            'action': 'accept',
            'note': 'Available, please collect at mechanical block.',
        })
        self.assertEqual(accept_resp.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'accepted')

        # Check notification received by Student B
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        notif_b = self.client.get('/api/marketplace/notifications/')
        self.assertTrue(any(n['notification_type'] == 'booking_accepted' for n in notif_b.data['notifications']))

        # Step 5B: Mutual Terms Review and Agreement (Requirement 1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        terms_prop = self.client.post(f'/api/marketplace/bookings/{booking_id}/terms/propose/', {
            'adjust': False,
        })
        self.assertEqual(terms_prop.status_code, status.HTTP_200_OK)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        terms_resp = self.client.post(f'/api/marketplace/bookings/{booking_id}/terms/respond/', {
            'action': 'accept',
        })
        self.assertEqual(terms_resp.status_code, status.HTTP_200_OK)

        # ==========================================
        # STEP 6: Mutual Advance Confirmation & Pickup Handover
        # ==========================================
        # Student B declares direct UPI payment for required advance/security deposit
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        dep_decl = self.client.post(f'/api/marketplace/bookings/{booking_id}/payments/declare/', {
            'purpose': 'deposit',
            'amount': '200.00',
            'payment_method': 'upi',
            'transaction_reference': 'UPI9876543211',
            'payer_notes': 'Advance deposit paid',
        })
        self.assertEqual(dep_decl.status_code, status.HTTP_201_CREATED)
        dep_payment_id = dep_decl.data['payment']['id']

        # Student A confirms receipt of advance
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        conf_dep = self.client.post(f'/api/marketplace/payments/{dep_payment_id}/confirm/')
        self.assertEqual(conf_dep.status_code, status.HTTP_200_OK)

        # Student A (lender) generates pickup QR
        qr_gen_resp = self.client.post(f'/api/marketplace/bookings/{booking_id}/generate-qr/', {
            'action_type': 'pickup',
        })
        self.assertEqual(qr_gen_resp.status_code, status.HTTP_200_OK)
        raw_token = qr_gen_resp.data['raw_token']

        # Unauthorized Student C attempts to scan Student A's QR -> HTTP 403
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_c.key}')
        bad_scan = self.client.post(f'/api/marketplace/bookings/{booking_id}/verify-handover/', {
            'action_type': 'pickup',
            'token': raw_token,
        })
        self.assertEqual(bad_scan.status_code, status.HTTP_403_FORBIDDEN)

        # Authorized Student B scans pickup QR
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        scan_resp = self.client.post(f'/api/marketplace/bookings/{booking_id}/verify-handover/', {
            'action_type': 'pickup',
            'token': raw_token,
        })
        self.assertEqual(scan_resp.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'active')
        self.assertIsNotNone(booking.pickup_confirmed_at)

        # Replay attempt fails
        replay_resp = self.client.post(f'/api/marketplace/bookings/{booking_id}/verify-handover/', {
            'action_type': 'pickup',
            'token': raw_token,
        })
        self.assertEqual(replay_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # ==========================================
        # STEP 7: Direct Peer Rent Payment Tracking (Stage 8)
        # ==========================================
        # Student B declares direct UPI payment for rent
        rent_decl = self.client.post(f'/api/marketplace/bookings/{booking_id}/payments/declare/', {
            'purpose': 'rent',
            'amount': '150.00',
            'payment_method': 'upi',
            'transaction_reference': 'UPI9876543210',
            'payer_notes': 'Paid via GooglePay UPI',
        })
        self.assertEqual(rent_decl.status_code, status.HTTP_201_CREATED)
        rent_payment_id = rent_decl.data['payment']['id']

        # Student A confirms receipt of rent
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        conf_rent = self.client.post(f'/api/marketplace/payments/{rent_payment_id}/confirm/')
        self.assertEqual(conf_rent.status_code, status.HTTP_200_OK)

        # Verify financial summary
        fin_resp = self.client.get(f'/api/marketplace/bookings/{booking_id}/financials/')
        self.assertEqual(fin_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(fin_resp.data['summary']['rent_confirmed'], '150.00')
        self.assertEqual(fin_resp.data['summary']['deposit_confirmed'], '200.00')
        self.assertEqual(fin_resp.data['summary']['total_confirmed_received'], '350.00')
        self.assertEqual(fin_resp.data['summary']['is_rent_settled'], True)

        # ==========================================
        # STEP 8: Return QR Workflow
        # ==========================================
        # Student B (Borrower) presents return QR
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        ret_qr = self.client.post(f'/api/marketplace/bookings/{booking_id}/generate-qr/', {
            'action_type': 'return',
        })
        self.assertEqual(ret_qr.status_code, status.HTTP_200_OK)
        return_token = ret_qr.data['raw_token']

        # Student A (Lender) verifies return QR
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        ret_scan = self.client.post(f'/api/marketplace/bookings/{booking_id}/verify-handover/', {
            'action_type': 'return',
            'token': return_token,
        })
        self.assertEqual(ret_scan.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'returned')
        self.assertIsNotNone(booking.return_confirmed_at)

        # ==========================================
        # STEP 9: Settlement Adjustment & Deposit Refund
        # ==========================================
        # Student A proposes ₹50 late fee deduction
        adj_resp = self.client.post(f'/api/marketplace/bookings/{booking_id}/adjustments/propose/', {
            'adjustment_type': 'late_fee',
            'amount': '50.00',
            'reason': 'Returned 1 hour late after scheduled exam window',
        })
        self.assertEqual(adj_resp.status_code, status.HTTP_201_CREATED)
        adj_id = adj_resp.data['adjustment']['id']

        # Student B accepts adjustment
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        adj_accept = self.client.post(f'/api/marketplace/adjustments/{adj_id}/respond/', {
            'action': 'accept',
            'response_note': 'Agreed, sorry for the delay.',
        })
        self.assertEqual(adj_accept.status_code, status.HTTP_200_OK)

        # Student A declares deposit refund: Net ₹150 (₹200 deposit - ₹50 late fee)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        ref_decl = self.client.post(f'/api/marketplace/bookings/{booking_id}/refund/declare/', {
            'refund_method': 'upi',
            'transaction_reference': 'UPI_REFUND_9988',
            'notes': 'Refunded net ₹150 via UPI',
        })
        self.assertEqual(ref_decl.status_code, status.HTTP_200_OK)
        self.assertEqual(ref_decl.data['deposit_refund']['net_refund_amount'], '150.00')

        # Student B confirms refund receipt
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        ref_conf = self.client.post(f'/api/marketplace/bookings/{booking_id}/refund/confirm/', {
            'action': 'confirm',
        })
        self.assertEqual(ref_conf.status_code, status.HTTP_200_OK)
        self.assertEqual(ref_conf.data['deposit_refund']['status'], 'confirmed')

        # Both parties approve the final settlement bill (Requirement 3 & 4)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        agree_a = self.client.post(f'/api/marketplace/bookings/{booking_id}/agree-settlement/')
        self.assertEqual(agree_a.status_code, status.HTTP_200_OK)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        agree_b = self.client.post(f'/api/marketplace/bookings/{booking_id}/agree-settlement/')
        self.assertEqual(agree_b.status_code, status.HTTP_200_OK)

        # Owner marks booking complete
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        comp_resp = self.client.post(f'/api/marketplace/bookings/{booking_id}/action/', {
            'action': 'complete',
            'note': 'Clean transaction, settled completely.',
        })
        self.assertEqual(comp_resp.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'completed')

        # ==========================================
        # STEP 10: Platform Settlement Bill Generation
        # ==========================================
        bill_resp = self.client.get(f'/api/marketplace/bookings/{booking_id}/settlement-bill/')
        self.assertEqual(bill_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(bill_resp.data['bill_number'].startswith(f"CS-BILL-{booking_id}-"))
        self.assertEqual(bill_resp.data['financial_summary']['settlement_status'], 'settled')
        self.assertEqual(bill_resp.data['financial_summary']['approved_deductions'], '50.00')
        self.assertEqual(bill_resp.data['financial_summary']['net_refundable_deposit'], '150.00')
        self.assertIn('CampusShare-generated transaction record', bill_resp.data['disclaimer'])

        # Unauthorized Student C cannot view bill -> HTTP 403
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_c.key}')
        unauth_bill = self.client.get(f'/api/marketplace/bookings/{booking_id}/settlement-bill/')
        self.assertEqual(unauth_bill.status_code, status.HTTP_403_FORBIDDEN)

        # ==========================================
        # STEP 11: Contextual Messaging
        # ==========================================
        # Student B initiates conversation tied to this booking
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        conv_resp = self.client.post('/api/marketplace/conversations/', {
            'booking_id': booking_id,
            'initial_message': 'Thanks Arjun! The calculator helped a lot in my test.',
        })
        self.assertEqual(conv_resp.status_code, status.HTTP_201_CREATED)
        conv_id = conv_resp.data['id']

        # Student A retrieves messages and replies
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        msg_list = self.client.get(f'/api/marketplace/conversations/{conv_id}/messages/')
        self.assertEqual(msg_list.status_code, status.HTTP_200_OK)
        self.assertEqual(msg_list.data['count'], 1)

        reply_resp = self.client.post(f'/api/marketplace/conversations/{conv_id}/messages/', {
            'content': 'Glad to hear that Priya! Good luck with the rest of your exams.',
        })
        self.assertEqual(reply_resp.status_code, status.HTTP_201_CREATED)

        # Unauthorized Student C cannot view or send in this thread
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_c.key}')
        hack_msgs = self.client.get(f'/api/marketplace/conversations/{conv_id}/messages/')
        self.assertEqual(hack_msgs.status_code, status.HTTP_403_FORBIDDEN)
        hack_send = self.client.post(f'/api/marketplace/conversations/{conv_id}/messages/', {
            'content': 'Injecting spam',
        })
        self.assertEqual(hack_send.status_code, status.HTTP_403_FORBIDDEN)

    def test_security_active_rental_cannot_be_cancelled(self):
        """
        Security verification: An active rental in progress (after physical handover)
        CANNOT be bypassed or cancelled via /cancel/ endpoint.
        """
        listing = Listing.objects.create(
            lender=self.profile_a,
            college=self.cit,
            category=self.cat_electronics,
            title='Lab Coat',
            price=Decimal('20.00'),
            is_available=True,
            status='active'
        )
        booking = Booking.objects.create(
            listing=listing,
            borrower=self.profile_b,
            lender=self.profile_a,
            booking_type='rent',
            status='active',  # Handover was already completed!
            start_date=date.today(),
            end_date=date.today() + timedelta(days=2),
            snapshot_price=Decimal('20.00'),
            calculated_total_rent=Decimal('60.00'),
            total_due_upfront=Decimal('60.00')
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        cancel_resp = self.client.post(f'/api/marketplace/bookings/{booking.id}/cancel/', {
            'note': 'Attempting cancellation after taking item home'
        })
        self.assertEqual(cancel_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Cannot cancel a booking with status "active"', cancel_resp.data['error'])
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'active')

    def test_security_check_booking_conflict_blocks_active_rentals(self):
        """
        Security verification: check_booking_conflict blocks overlapping requests
        for listings that are actively checked out ('active') as well as 'accepted'.
        """
        listing = Listing.objects.create(
            lender=self.profile_a,
            college=self.cit,
            category=self.cat_electronics,
            title='Arduino Uno Starter Kit',
            price=Decimal('30.00'),
            is_available=True,
            status='active'
        )
        start = date.today() + timedelta(days=5)
        end = start + timedelta(days=3)

        # Existing active booking
        Booking.objects.create(
            listing=listing,
            borrower=self.profile_b,
            lender=self.profile_a,
            booking_type='rent',
            status='active',
            start_date=start,
            end_date=end,
            snapshot_price=Decimal('30.00'),
            calculated_total_rent=Decimal('120.00'),
            total_due_upfront=Decimal('120.00')
        )

        # Attempt to book overlapping dates
        conflict = check_booking_conflict(listing, start_date=start + timedelta(days=1), end_date=end + timedelta(days=2))
        self.assertIsNotNone(conflict)
        self.assertIn('already has a confirmed or active booking', conflict)

    def test_security_adjusted_booking_dates_validation(self):
        """
        Security verification: Owner cannot adjust booking dates to past dates or inverted ranges.
        """
        listing = Listing.objects.create(
            lender=self.profile_a,
            college=self.cit,
            category=self.cat_electronics,
            title='Guitar Tuner',
            price=Decimal('15.00'),
            is_available=True,
            status='active'
        )
        booking = Booking.objects.create(
            listing=listing,
            borrower=self.profile_b,
            lender=self.profile_a,
            booking_type='rent',
            status='pending',
            start_date=date.today() + timedelta(days=3),
            end_date=date.today() + timedelta(days=5),
            snapshot_price=Decimal('15.00'),
            calculated_total_rent=Decimal('45.00'),
            total_due_upfront=Decimal('45.00')
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')

        # 1. Past date attempt
        past_date = (date.today() - timedelta(days=2)).isoformat()
        resp_past = self.client.post(f'/api/marketplace/bookings/{booking.id}/action/', {
            'action': 'accept',
            'start_date': past_date,
        })
        self.assertEqual(resp_past.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot be in the past', resp_past.data['error'])

        # 2. Inverted dates attempt
        resp_inv = self.client.post(f'/api/marketplace/bookings/{booking.id}/action/', {
            'action': 'accept',
            'start_date': (date.today() + timedelta(days=10)).isoformat(),
            'end_date': (date.today() + timedelta(days=5)).isoformat(),
        })
        self.assertEqual(resp_inv.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot be before start date', resp_inv.data['error'])

    def test_security_wanted_item_workflow_and_negative_price_rejection(self):
        """
        Wanted item request lifecycle:
        - Creation by Student B
        - Rejection of negative offered price
        - Legitimate response by Student A
        - Action by Student B
        """
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        req_resp = self.client.post('/api/marketplace/wanted-requests/', {
            'title': 'Need Engineering Drawing Mini Drafter',
            'description': 'Required for first year engineering drawing practical exam.',
            'category_id': self.cat_electronics.id,
            'budget_max': '150.00',
        })
        self.assertEqual(req_resp.status_code, status.HTTP_201_CREATED)
        wanted_id = req_resp.data['id']

        # Student A attempts to offer with negative price -> HTTP 400
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        neg_resp = self.client.post(f'/api/marketplace/wanted-requests/{wanted_id}/respond/', {
            'message': 'Can lend mine',
            'offered_price': '-50.00',
        })
        self.assertEqual(neg_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot be negative', neg_resp.data['errors']['offered_price'])

        # Legitimate response
        pos_resp = self.client.post(f'/api/marketplace/wanted-requests/{wanted_id}/respond/', {
            'message': 'Have an Omega mini drafter in excellent condition.',
            'offered_price': '100.00',
        })
        self.assertEqual(pos_resp.status_code, status.HTTP_201_CREATED)
        resp_id = pos_resp.data['id']

        # Requester marks interested
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        act_resp = self.client.post(f'/api/marketplace/wanted-responses/{resp_id}/action/', {
            'action': 'interested',
        })
        self.assertEqual(act_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(act_resp.data['response']['status'], 'interested')

    def test_security_unsolicited_conversation_prevented(self):
        """
        Anti-spam security verification:
        Users cannot initiate conversations with arbitrary recipients without
        shared listing, booking, or wanted request context.
        """
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_c.key}')
        bad_conv = self.client.post('/api/marketplace/conversations/', {
            'recipient_id': self.profile_a.id,
            'initial_message': 'Unsolicited spam direct message',
        })
        self.assertEqual(bad_conv.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('A valid listing, booking, or wanted-item request reference is required', bad_conv.data['error'])
