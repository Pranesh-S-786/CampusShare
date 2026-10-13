from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from apps.authentication.models import College, StudentProfile
from apps.marketplace.models import (
    Category,
    Listing,
    Booking,
    HandoverToken,
    PaymentRecord,
    SettlementAdjustment,
    DepositRefund,
    Review,
)
from apps.marketplace.trust_score_service import calculate_and_update_trust_score
from apps.marketplace.duration_rent_service import calculate_actual_rental_terms, calculate_late_penalty_estimate
from apps.marketplace.booking_logic import get_listing_availability_info, check_booking_conflict


class EnhancedRentalLifecycleAndSettlementTests(TestCase):
    """
    Comprehensive tests for the enhanced CampusShare rental lifecycle:
    Sections 2-15 of specification.
    """

    def setUp(self):
        self.client = APIClient()

        self.college = College.objects.create(
            name='Coimbatore Institute of Technology',
            short_code='CIT',
            domain='cit.edu.in',
            city='Coimbatore',
            state='Tamil Nadu',
            is_active=True
        )

        self.category = Category.objects.create(
            name='Electronics',
            slug='electronics',
            icon='laptop',
            order=1,
            is_active=True
        )

        # User A: Lender
        self.user_a = User.objects.create_user(
            username='arjun@cit.edu.in',
            email='arjun@cit.edu.in',
            password='Password123!',
            first_name='Arjun',
            last_name='K'
        )
        self.profile_a = StudentProfile.objects.create(
            user=self.user_a,
            college=self.college,
            college_email='arjun@cit.edu.in',
            full_name='Arjun K',
            is_email_verified=True,
            is_college_verified=True,
            verification_status='verified_student'
        )
        self.token_a = Token.objects.create(user=self.user_a)

        # User B: Borrower
        self.user_b = User.objects.create_user(
            username='priya@cit.edu.in',
            email='priya@cit.edu.in',
            password='Password123!',
            first_name='Priya',
            last_name='S'
        )
        self.profile_b = StudentProfile.objects.create(
            user=self.user_b,
            college=self.college,
            college_email='priya@cit.edu.in',
            full_name='Priya S',
            is_email_verified=True,
            is_college_verified=True,
            verification_status='verified_student'
        )
        self.token_b = Token.objects.create(user=self.user_b)

        # User C: Unrelated student
        self.user_c = User.objects.create_user(
            username='rohit@cit.edu.in',
            email='rohit@cit.edu.in',
            password='Password123!',
            first_name='Rohit',
            last_name='M'
        )
        self.profile_c = StudentProfile.objects.create(
            user=self.user_c,
            college=self.college,
            college_email='rohit@cit.edu.in',
            full_name='Rohit M',
            is_email_verified=True,
            is_college_verified=True,
            verification_status='verified_student'
        )
        self.token_c = Token.objects.create(user=self.user_c)

    def _create_booking(self, price='100.00', deposit='200.00', pricing_unit='day', days=2):
        listing = Listing.objects.create(
            lender=self.profile_a,
            college=self.college,
            category=self.category,
            title='Scientific Calculator',
            description='Casio FX-991EX',
            price=Decimal(price),
            deposit_amount=Decimal(deposit),
            pricing_unit=pricing_unit,
            listing_type='rent',
            condition='like_new',
            is_available=True,
            status='active'
        )
        start_date = date.today() + timedelta(days=1)
        end_date = start_date + timedelta(days=days - 1)
        booking = Booking.objects.create(
            listing=listing,
            borrower=self.profile_b,
            lender=self.profile_a,
            start_date=start_date,
            end_date=end_date,
            duration_days=days,
            booking_type='rent',
            snapshot_price=Decimal(price),
            snapshot_deposit_amount=Decimal(deposit),
            snapshot_pricing_unit=pricing_unit,
            calculated_total_rent=Decimal(price) * Decimal(days),
            total_due_upfront=Decimal(price) * Decimal(days) + Decimal(deposit),
            agreed_advance_amount=Decimal(deposit),
            advance_negotiation_status='agreed',
            status='accepted'
        )
        return listing, booking

    # =========================================================================
    # 1. ADVANCE PAYMENT REQUIREMENTS & NEGOTIATION
    # =========================================================================
    def test_required_advance_prevents_pickup_until_confirmed(self):
        """If advance is required, pickup QR generation is blocked until both declared and confirmed."""
        listing, booking = self._create_booking(deposit='200.00')

        # Lender attempts to generate pickup QR before advance is paid -> BLOCKED (HTTP 400)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        gen_fail = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {'action_type': 'pickup'})
        self.assertEqual(gen_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('advance/deposit of ₹200.00 is required', gen_fail.data['error'])

        # Borrower declares payment
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        pay_decl = self.client.post(f'/api/marketplace/bookings/{booking.id}/payments/declare/', {
            'purpose': 'deposit',
            'amount': '200.00',
            'payment_method': 'upi',
            'transaction_reference': 'UPI-ADV-123',
        })
        self.assertEqual(pay_decl.status_code, status.HTTP_201_CREATED)
        pay_id = pay_decl.data['payment']['id']

        # Lender attempts pickup QR generation before confirming receipt -> STILL BLOCKED
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        gen_fail2 = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {'action_type': 'pickup'})
        self.assertEqual(gen_fail2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('lender receipt confirmation is pending', gen_fail2.data['error'])

        # Lender confirms receipt
        conf_resp = self.client.post(f'/api/marketplace/payments/{pay_id}/confirm/')
        self.assertEqual(conf_resp.status_code, status.HTTP_200_OK)

        # Now Lender successfully generates pickup QR!
        gen_ok = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {'action_type': 'pickup'})
        self.assertEqual(gen_ok.status_code, status.HTTP_200_OK)
        token = gen_ok.data['raw_token']

        # Borrower verifies pickup handover
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        scan_ok = self.client.post(f'/api/marketplace/bookings/{booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': token
        })
        self.assertEqual(scan_ok.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'active')

    def test_no_required_advance_allows_pickup_immediately(self):
        """If advance/deposit is 0, pickup QR can be generated immediately without payment."""
        listing, booking = self._create_booking(deposit='0.00')

        # Lender generates pickup QR immediately
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        gen_resp = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {'action_type': 'pickup'})
        self.assertEqual(gen_resp.status_code, status.HTTP_200_OK)
        token = gen_resp.data['raw_token']

        # Borrower verifies pickup QR immediately
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        scan_ok = self.client.post(f'/api/marketplace/bookings/{booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': token
        })
        self.assertEqual(scan_ok.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'active')

    def test_revised_advance_negotiation_workflow(self):
        """Negotiating a different advance requires mutual agreement and new confirmations."""
        listing, booking = self._create_booking(deposit='200.00')

        # Borrower proposes to reduce advance to 100.00
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        prop_resp = self.client.post(f'/api/marketplace/bookings/{booking.id}/propose-advance/', {
            'proposed_amount': '100.00',
            'notes': 'Can we reduce security deposit to ₹100 since we are in the same hostel?'
        })
        self.assertEqual(prop_resp.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.advance_negotiation_status, 'proposed')

        # While proposed, pickup QR generation is blocked
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        gen_block = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {'action_type': 'pickup'})
        self.assertEqual(gen_block.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('negotiation', gen_block.data['error'])

        # Lender accepts proposed advance of 100.00
        resp_agree = self.client.post(f'/api/marketplace/bookings/{booking.id}/respond-advance/', {
            'action': 'accept'
        })
        self.assertEqual(resp_agree.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.agreed_advance_amount, Decimal('100.00'))
        self.assertEqual(booking.advance_negotiation_status, 'agreed')

        # Borrower declares the agreed ₹100
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        pay_decl = self.client.post(f'/api/marketplace/bookings/{booking.id}/payments/declare/', {
            'purpose': 'deposit',
            'amount': '100.00',
            'payment_method': 'cash',
        })
        pay_id = pay_decl.data['payment']['id']

        # Lender confirms receipt
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        self.client.post(f'/api/marketplace/payments/{pay_id}/confirm/')

        # Pickup QR generation succeeds
        gen_ok = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {'action_type': 'pickup'})
        self.assertEqual(gen_ok.status_code, status.HTTP_200_OK)
        token = gen_ok.data['raw_token']

        # Borrower verifies handover
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        scan_ok = self.client.post(f'/api/marketplace/bookings/{booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': token
        })
        self.assertEqual(scan_ok.status_code, status.HTTP_200_OK)

    # =========================================================================
    # 2. DYNAMIC RENT CALCULATION & EARLY RETURN
    # =========================================================================
    def test_dynamic_rent_calculation_and_early_return(self):
        """Rent is recalculated from actual verified duration, without early return penalties."""
        listing, booking = self._create_booking(price='100.00', deposit='0.00', days=4)

        # Pickup on day 1
        booking.status = 'active'
        pickup_time = timezone.now() - timedelta(days=2)  # Picked up 2 days ago
        booking.pickup_confirmed_at = pickup_time
        booking.save()

        # Return now (2 days elapsed out of 4 days)
        custom_return = pickup_time + timedelta(days=2)
        terms = calculate_actual_rental_terms(booking, custom_return_time=custom_return)
        self.assertTrue(terms['is_early_return'])
        self.assertEqual(Decimal(terms['final_calculated_rent']), Decimal('200.00'))  # 2 days * 100
        self.assertEqual(Decimal(terms['original_rent_estimate']), Decimal('400.00'))  # Planned 4 days

    # =========================================================================
    # 3. LENDER PROPOSED RENT ADJUSTMENT WORKFLOW
    # =========================================================================
    def test_lender_proposed_rent_adjustment_acceptance_and_rejection(self):
        """Lender proposes rent adjustment; borrower must accept before it becomes agreed."""
        listing, booking = self._create_booking(price='100.00', deposit='0.00', days=2)
        booking.status = 'returned'
        booking.actual_rent_calculated = Decimal('200.00')
        booking.save()

        # Lender proposes discounted rent of ₹150 with reason
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        prop_resp = self.client.post(f'/api/marketplace/bookings/{booking.id}/propose-rent-adjustment/', {
            'proposed_rent': '150.00',
            'reason': 'Returned a bit early, offering ₹50 discount.'
        })
        self.assertEqual(prop_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(prop_resp.data['adjustment']['status'], 'proposed')
        self.assertEqual(prop_resp.data['adjustment']['difference'], '-50.00')

        # Borrower rejects the proposal
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        rej_resp = self.client.post(f'/api/marketplace/bookings/{booking.id}/respond-rent-adjustment/', {
            'action': 'reject',
            'reason': 'I insist on paying the full ₹200 as calculated.'
        })
        self.assertEqual(rej_resp.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.rent_adjustment_status, 'rejected')

        # Financial summary maintains original system calculated rent of ₹200
        fin_resp = self.client.get(f'/api/marketplace/bookings/{booking.id}/financials/')
        self.assertEqual(fin_resp.data['summary']['final_agreed_rent'], '200.00')

        # Lender proposes revised amount of ₹180
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        prop2 = self.client.post(f'/api/marketplace/bookings/{booking.id}/propose-rent-adjustment/', {
            'proposed_rent': '180.00',
            'reason': 'Let us settle at ₹180.'
        })
        self.assertEqual(prop2.status_code, status.HTTP_200_OK)

        # Borrower accepts
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        acc_resp = self.client.post(f'/api/marketplace/bookings/{booking.id}/respond-rent-adjustment/', {
            'action': 'accept'
        })
        self.assertEqual(acc_resp.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.rent_adjustment_status, 'accepted')
        self.assertEqual(booking.lender_proposed_rent, Decimal('180.00'))

        # Financial summary now reflects mutually adjusted rent of ₹180
        fin_resp2 = self.client.get(f'/api/marketplace/bookings/{booking.id}/financials/')
        self.assertEqual(fin_resp2.data['summary']['final_agreed_rent'], '180.00')

    # =========================================================================
    # 4. LATE PENALTIES & DAMAGE ADJUSTMENT DISPUTES
    # =========================================================================
    def test_late_penalty_estimate_and_grace_period(self):
        """Late returns beyond grace period compute explicit estimate."""
        listing, booking = self._create_booking(price='60.00', pricing_unit='day', days=1)
        booking.status = 'active'
        booking.pickup_confirmed_at = timezone.now() - timedelta(days=2)
        booking.end_date = date.today() - timedelta(days=1)
        booking.save()

        estimate = calculate_late_penalty_estimate(booking)
        self.assertTrue(estimate['is_late'])
        self.assertGreater(Decimal(estimate['suggested_late_fee']), Decimal('0.00'))

    def test_damage_dispute_does_not_become_agreed_charge(self):
        """Disputed damage penalty remains disputed and is NOT included in agreed obligations."""
        listing, booking = self._create_booking(price='100.00', deposit='500.00', days=1)
        booking.status = 'returned'
        booking.actual_rent_calculated = Decimal('100.00')
        booking.save()

        # Lender proposes damage fee of ₹250
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        prop_dmg = self.client.post(f'/api/marketplace/bookings/{booking.id}/adjustments/propose/', {
            'adjustment_type': 'damage',
            'amount': '250.00',
            'reason': 'Cracked screen protector'
        })
        self.assertEqual(prop_dmg.status_code, status.HTTP_201_CREATED)
        adj_id = prop_dmg.data['adjustment']['id']

        # Borrower disputes the damage claim
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        disp_resp = self.client.post(f'/api/marketplace/adjustments/{adj_id}/respond/', {
            'action': 'dispute',
            'response_note': 'The crack was present before pickup.'
        })
        self.assertEqual(disp_resp.status_code, status.HTTP_200_OK)

        # Check financial summary: accepted penalties must be 0, disputed is 250
        bill_resp = self.client.get(f'/api/marketplace/bookings/{booking.id}/settlement-bill/')
        summary = bill_resp.data['financial_summary']
        self.assertEqual(summary['accepted_damage_fees'], '0.00')
        self.assertEqual(summary['disputed_adjustments_total'], '250.00')
        self.assertEqual(summary['has_disputes'], True)

    # =========================================================================
    # 5. MUTUAL SETTLEMENT AGREEMENT VS DIRECT MONEY TRANSFER
    # =========================================================================
    def test_mutual_settlement_distinct_from_money_transfer(self):
        """Agreeing to settlement terms does not mark transaction settled until transfer confirmed."""
        listing, booking = self._create_booking(price='100.00', deposit='200.00', days=1)
        booking.status = 'returned'
        booking.actual_rent_calculated = Decimal('100.00')
        booking.save()

        # Both parties agree to settlement terms
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        self.client.post(f'/api/marketplace/bookings/{booking.id}/agree-settlement/')

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        agree_l = self.client.post(f'/api/marketplace/bookings/{booking.id}/agree-settlement/')
        self.assertEqual(agree_l.status_code, status.HTTP_200_OK)
        self.assertTrue(agree_l.data['is_mutually_agreed'])

        # Since deposit was ₹200 and rent ₹100, if money transfer is pending:
        # Settlement status is 'agreed_payment_pending' or 'settlement_proposed'
        booking.refresh_from_db()
        fin_resp = self.client.get(f'/api/marketplace/bookings/{booking.id}/financials/')
        self.assertIn(fin_resp.data['summary']['settlement_status'], ['agreed_payment_pending', 'settlement_proposed'])

    # =========================================================================
    # 6. LISTING AVAILABILITY & OVERDUE ENFORCEMENT
    # =========================================================================
    def test_overdue_item_remains_unavailable(self):
        """When end_date has passed but item is unreturned, status is return_overdue and conflicts are blocked."""
        listing, booking = self._create_booking(days=2)
        booking.status = 'active'
        booking.end_date = date.today() - timedelta(days=1)  # Yesterday
        booking.pickup_confirmed_at = timezone.now() - timedelta(days=3)
        booking.save()

        avail_info = get_listing_availability_info(listing)
        self.assertEqual(avail_info['availability_status'], 'return_overdue')
        self.assertEqual(avail_info['status_label'], 'Return overdue')

        # Attempt to book this overdue item by User C -> Conflicted!
        conflict_msg = check_booking_conflict(
            listing=listing,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=1)
        )
        self.assertIsNotNone(conflict_msg)
        self.assertIn('overdue', conflict_msg)

    # =========================================================================
    # 7. LENDER RE-LISTING CHOICES AFTER RETURN
    # =========================================================================
    def test_relisting_choices_after_return(self):
        """Lender must explicitly choose between relist, edit, or archive."""
        listing, booking = self._create_booking(deposit='0.00')
        booking.status = 'returned'
        booking.relist_prompted = True
        listing.is_available = False
        listing.save()
        booking.save()

        # Non-owner cannot choose
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        unauth = self.client.post(f'/api/marketplace/bookings/{booking.id}/relist-choice/', {'choice': 'relist'})
        self.assertEqual(unauth.status_code, status.HTTP_403_FORBIDDEN)

        # Owner chooses 'relist'
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        relist_resp = self.client.post(f'/api/marketplace/bookings/{booking.id}/relist-choice/', {'choice': 'relist'})
        self.assertEqual(relist_resp.status_code, status.HTTP_200_OK)
        listing.refresh_from_db()
        self.assertTrue(listing.is_available)
        self.assertEqual(listing.status, 'active')

        # Owner chooses 'archive'
        arch_resp = self.client.post(f'/api/marketplace/bookings/{booking.id}/relist-choice/', {'choice': 'archive'})
        self.assertEqual(arch_resp.status_code, status.HTTP_200_OK)
        listing.refresh_from_db()
        self.assertFalse(listing.is_available)
        self.assertEqual(listing.status, 'archived')

    # =========================================================================
    # 8. RATINGS & REVIEWS (BORROWER ELIGIBILITY & DUAL SUBMISSION)
    # =========================================================================
    def test_ratings_and_reviews_lifecycle(self):
        """Only eligible borrower can submit product and lender reviews after return."""
        listing, booking = self._create_booking()
        booking.status = 'completed'
        booking.return_confirmed_at = timezone.now()
        booking.save()

        # Lender cannot submit borrower reviews
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_a.key}')
        fail_rev = self.client.post(f'/api/marketplace/bookings/{booking.id}/reviews/', {
            'review_type': 'product',
            'rating': 5,
            'review_text': 'Great device.'
        })
        self.assertEqual(fail_rev.status_code, status.HTTP_403_FORBIDDEN)

        # Borrower submits product review
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token_b.key}')
        prod_rev = self.client.post(f'/api/marketplace/bookings/{booking.id}/reviews/', {
            'review_type': 'product',
            'rating': 5,
            'review_text': 'Very clean calculator in excellent working condition.'
        })
        self.assertEqual(prod_rev.status_code, status.HTTP_201_CREATED)

        # Borrower submits lender review
        lend_rev = self.client.post(f'/api/marketplace/bookings/{booking.id}/reviews/', {
            'review_type': 'lender',
            'rating': 4,
            'review_text': 'Punctual and communicative lender.'
        })
        self.assertEqual(lend_rev.status_code, status.HTTP_201_CREATED)

        # Duplicate product review is rejected
        dup_rev = self.client.post(f'/api/marketplace/bookings/{booking.id}/reviews/', {
            'review_type': 'product',
            'rating': 4,
            'review_text': 'Trying to review again.'
        })
        self.assertEqual(dup_rev.status_code, status.HTTP_400_BAD_REQUEST)

        # Check listing stats updated
        listing.refresh_from_db()
        self.assertEqual(listing.average_rating, Decimal('5.0'))
        self.assertEqual(listing.review_count, 1)

        # Check lender profile stats updated
        self.profile_a.refresh_from_db()
        self.assertEqual(self.profile_a.lender_average_rating, Decimal('4.0'))
        self.assertEqual(self.profile_a.lender_review_count, 1)

    # =========================================================================
    # 9. DYNAMIC EXPLAINABLE TRUST SCORE CALCULATION
    # =========================================================================
    def test_trust_score_calculation_and_damage_fairness(self):
        """Trust score rewards on-time returns; damage allegation alone does not penalize."""
        profile = self.profile_b
        score_data = calculate_and_update_trust_score(profile)
        self.assertEqual(score_data['trust_status'], 'insufficient_history')
        self.assertIn('explanation', score_data)
        self.assertIn('scoring_rules', score_data)

        # Add a booking with an ACCEPTED damage fee
        listing, booking = self._create_booking()
        booking.status = 'completed'
        booking.return_confirmed_at = timezone.now()
        booking.save()

        # Propose damage fee
        adj = SettlementAdjustment.objects.create(
            booking=booking,
            proposed_by=self.profile_a,
            adjustment_type='damage',
            amount=Decimal('100.00'),
            reason='Broken case',
            status='disputed'  # Disputed!
        )

        # Calculate trust score while DISPUTED -> No damage penalty!
        score_disputed = calculate_and_update_trust_score(profile)
        self.assertEqual(score_disputed['confirmed_damage_count'], 0)
        self.assertEqual(score_disputed['disputed_claims_count'], 1)
        self.assertIn('unproven/disputed claim(s) do not affect trust score', score_disputed['explanation'])

        # Now borrower accepts damage
        adj.status = 'accepted'
        adj.save()

        # Calculate trust score with ACCEPTED damage -> Penalty applied!
        score_accepted = calculate_and_update_trust_score(profile)
        self.assertEqual(score_accepted['confirmed_damage_count'], 1)
        self.assertIn('confirmed damage incident', score_accepted['explanation'])
        self.assertLess(score_accepted['trust_score'], score_disputed['trust_score'])
        # Confirmed damage drops by exactly 25 points
        self.assertEqual(score_disputed['trust_score'] - score_accepted['trust_score'], 25)
