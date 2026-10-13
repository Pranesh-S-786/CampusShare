from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token

from apps.authentication.models import College, StudentProfile
from apps.marketplace.models import Category, Listing


class MarketplaceAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create colleges
        self.college_cit = College.objects.create(
            name='Coimbatore Institute of Technology (CIT)',
            short_code='CIT',
            domain='cit.edu.in',
            city='Coimbatore',
            state='Tamil Nadu',
            is_active=True
        )
        self.college_psg = College.objects.create(
            name='PSG College of Technology',
            short_code='PSG',
            domain='psgtech.edu',
            city='Coimbatore',
            state='Tamil Nadu',
            is_active=True
        )

        # Create categories
        self.cat_electronics = Category.objects.create(
            name='Electronics',
            slug='electronics',
            icon='laptop',
            order=1,
            is_active=True
        )
        self.cat_books = Category.objects.create(
            name='Books',
            slug='books',
            icon='book-open',
            order=2,
            is_active=True
        )

        # Create verified student user
        self.user = User.objects.create_user(
            username='arjun_k',
            email='arjun@cit.edu.in',
            password='TestPassword123!',
            first_name='Arjun',
            last_name='K'
        )
        self.profile = StudentProfile.objects.create(
            user=self.user,
            college=self.college_cit,
            college_email='arjun@cit.edu.in',
            is_email_verified=True,
            is_college_verified=True,
            verification_status='verified_student',
            grad_year=2026,
            major='Computer Science'
        )
        self.token = Token.objects.create(user=self.user)

    def test_category_list(self):
        response = self.client.get('/api/marketplace/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('categories', response.data)
        self.assertEqual(response.data['count'], 2)
        slugs = [c['slug'] for c in response.data['categories']]
        self.assertEqual(slugs, ['electronics', 'books'])

    def test_empty_listings(self):
        response = self.client.get('/api/marketplace/listings/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['listings'], [])

    def test_listing_filters(self):
        # Create listing 1 (Electronics, CIT)
        l1 = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='MacBook Air M1',
            subcategory='Laptops',
            price=Decimal('250.00'),
            pricing_unit='day',
            condition='like_new',
            is_available=True,
            is_visible=True,
            status='active'
        )
        # Create listing 2 (Books, PSG)
        l2 = Listing.objects.create(
            lender=self.profile,
            college=self.college_psg,
            category=self.cat_books,
            title='Data Structures Textbook',
            subcategory='Books',
            price=Decimal('20.00'),
            pricing_unit='day',
            condition='good',
            is_available=True,
            is_visible=True,
            status='active'
        )
        # Create listing 3 (Hidden/inactive)
        Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Old Monitor',
            price=Decimal('50.00'),
            is_available=False,
            is_visible=False,
            status='archived'
        )

        # 1. All visible listings
        res_all = self.client.get('/api/marketplace/listings/')
        self.assertEqual(res_all.data['count'], 2)

        # 2. Filter by category
        res_cat = self.client.get('/api/marketplace/listings/?category=electronics')
        self.assertEqual(res_cat.data['count'], 1)
        self.assertEqual(res_cat.data['listings'][0]['title'], 'MacBook Air M1')

        # 3. Filter by single college
        res_col = self.client.get(f'/api/marketplace/listings/?college_id={self.college_cit.id}')
        self.assertEqual(res_col.data['count'], 1)
        self.assertEqual(res_col.data['listings'][0]['college']['short_code'], 'CIT')

        # 4. Filter by multiple colleges
        res_multi_col = self.client.get(f'/api/marketplace/listings/?college_ids={self.college_cit.id},{self.college_psg.id}')
        self.assertEqual(res_multi_col.data['count'], 2)

        # 5. Search query
        res_search = self.client.get('/api/marketplace/listings/?search=Textbook')
        self.assertEqual(res_search.data['count'], 1)
        self.assertEqual(res_search.data['listings'][0]['title'], 'Data Structures Textbook')

    def test_authenticated_post_listing(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        payload = {
            'title': 'Canon EOS 80D',
            'description': 'DSLR camera with 18-135mm lens in excellent condition.',
            'category_id': self.cat_electronics.id,
            'subcategory': 'Cameras',
            'condition': 'like_new',
            'price': '180.00',
            'pricing_unit': 'day',
            'college_id': self.college_cit.id,
        }
        response = self.client.post('/api/marketplace/listings/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'Canon EOS 80D')
        self.assertEqual(response.data['lender']['username'], 'arjun_k')
        self.assertEqual(response.data['college']['short_code'], 'CIT')

    def test_unverified_student_cannot_post_listing(self):
        # Create unverified user
        unverified_user = User.objects.create_user(
            username='new_user',
            email='new@cit.edu.in',
            password='Password123!'
        )
        unverified_profile = StudentProfile.objects.create(
            user=unverified_user,
            college=self.college_cit,
            is_email_verified=False
        )
        unverified_token = Token.objects.create(user=unverified_user)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {unverified_token.key}')
        payload = {
            'title': 'Guitar',
            'category_id': self.cat_electronics.id,
            'price': '100.00',
        }
        response = self.client.post('/api/marketplace/listings/', payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('verify your college email', response.data['error'])

    def test_post_listing_types(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        # 1. Lend Listing (Free)
        lend_res = self.client.post('/api/marketplace/listings/', {
            'title': 'Physics Textbook for Lending',
            'category_id': self.cat_books.id,
            'listing_type': 'lend',
            'condition': 'good',
            'pickup_location': 'Library 2nd Floor',
        })
        self.assertEqual(lend_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(lend_res.data['listing_type'], 'lend')
        self.assertEqual(Decimal(lend_res.data['price']), Decimal('0.00'))
        self.assertEqual(lend_res.data['pickup_location'], 'Library 2nd Floor')

        # 2. Rent Listing with deposit and pricing unit
        rent_res = self.client.post('/api/marketplace/listings/', {
            'title': 'Sony Alpha A7 III',
            'category_id': self.cat_electronics.id,
            'listing_type': 'rent',
            'price': '350.00',
            'pricing_unit': 'day',
            'deposit_amount': '1500.00',
            'pickup_location': 'Media Lab Hall B',
        })
        self.assertEqual(rent_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(rent_res.data['listing_type'], 'rent')
        self.assertEqual(Decimal(rent_res.data['price']), Decimal('350.00'))
        self.assertEqual(Decimal(rent_res.data['deposit_amount']), Decimal('1500.00'))
        self.assertEqual(rent_res.data['pricing_unit'], 'day')

        # 3. Sell Listing
        sell_res = self.client.post('/api/marketplace/listings/', {
            'title': 'Scientific Calculator FX-991CW',
            'category_id': self.cat_electronics.id,
            'listing_type': 'sell',
            'price': '850.00',
            'condition': 'like_new',
        })
        self.assertEqual(sell_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(sell_res.data['listing_type'], 'sell')
        self.assertEqual(Decimal(sell_res.data['price']), Decimal('850.00'))
        self.assertEqual(sell_res.data['pricing_unit'], 'item')
        self.assertEqual(Decimal(sell_res.data['deposit_amount']), Decimal('0.00'))

    def test_listing_validation_rules(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        # Rent without price should fail
        res1 = self.client.post('/api/marketplace/listings/', {
            'title': 'Invalid Rent Item',
            'category_id': self.cat_electronics.id,
            'listing_type': 'rent',
            'price': '0.00',
        })
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('price', res1.data)

        # Negative deposit should fail
        res2 = self.client.post('/api/marketplace/listings/', {
            'title': 'Invalid Deposit Item',
            'category_id': self.cat_electronics.id,
            'listing_type': 'rent',
            'price': '100.00',
            'deposit_amount': '-50.00',
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('deposit_amount', res2.data)

        # Sell with zero price should fail
        res3 = self.client.post('/api/marketplace/listings/', {
            'title': 'Free Sell Item',
            'category_id': self.cat_electronics.id,
            'listing_type': 'sell',
            'price': '0.00',
        })
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('price', res3.data)

    def test_listing_with_multiple_images(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        payload = {
            'title': 'Mechanical Keyboard',
            'category_id': self.cat_electronics.id,
            'listing_type': 'rent',
            'price': '40.00',
            'pricing_unit': 'day',
            'images': [
                'https://example.com/photos/keyboard-front.jpg',
                'https://example.com/photos/keyboard-switches.jpg',
            ]
        }
        res = self.client.post('/api/marketplace/listings/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data['images']), 2)
        self.assertEqual(res.data['image_url'], 'https://example.com/photos/keyboard-front.jpg')
        self.assertTrue(res.data['images'][0]['is_primary'])

    def test_image_upload_endpoint(self):
        import io
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        # 1. Valid PNG upload
        valid_image = SimpleUploadedFile(
            name='test_product.png',
            content=b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82',
            content_type='image/png'
        )
        res = self.client.post('/api/marketplace/upload-image/', {'image': valid_image}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('image_url', res.data)
        self.assertTrue(len(res.data['image_url']) > 0)

        # 2. Invalid file type (e.g. text file)
        invalid_file = SimpleUploadedFile(
            name='notes.txt',
            content=b'Hello world',
            content_type='text/plain'
        )
        res_invalid = self.client.post('/api/marketplace/upload-image/', {'image': invalid_file}, format='multipart')
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('errors', res_invalid.data)

        # 3. Oversized file (> 5MB)
        oversized_file = SimpleUploadedFile(
            name='huge.jpg',
            content=b'x' * (6 * 1024 * 1024),
            content_type='image/jpeg'
        )
        res_huge = self.client.post('/api/marketplace/upload-image/', {'image': oversized_file}, format='multipart')
        self.assertEqual(res_huge.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_permissions_edit_and_archive(self):
        # Create second user
        other_user = User.objects.create_user(
            username='rohit_s',
            email='rohit@psgtech.edu',
            password='OtherPassword123!'
        )
        other_profile = StudentProfile.objects.create(
            user=other_user,
            college=self.college_psg,
            is_email_verified=True,
            is_college_verified=True
        )
        other_token = Token.objects.create(user=other_user)

        # Arjun creates listing
        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Arjun DSLR',
            listing_type='rent',
            price=Decimal('100.00'),
            pricing_unit='day',
            is_available=True,
            status='active'
        )

        # 1. Rohit (non-owner) tries to PATCH -> 403 Forbidden
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {other_token.key}')
        patch_res = self.client.patch(f'/api/marketplace/listings/{listing.id}/', {
            'title': 'Hacked Listing',
            'price': '10.00'
        })
        self.assertEqual(patch_res.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Rohit tries to archive -> 403 Forbidden
        archive_res = self.client.post(f'/api/marketplace/listings/{listing.id}/archive/')
        self.assertEqual(archive_res.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Arjun (owner) edits his listing -> 200 OK
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        owner_patch = self.client.patch(f'/api/marketplace/listings/{listing.id}/', {
            'title': 'Arjun DSLR Updated',
            'price': '120.00',
            'is_available': False
        })
        self.assertEqual(owner_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(owner_patch.data['title'], 'Arjun DSLR Updated')
        self.assertEqual(Decimal(owner_patch.data['price']), Decimal('120.00'))
        self.assertFalse(owner_patch.data['is_available'])

        # 4. Arjun archives his listing -> 200 OK
        owner_archive = self.client.post(f'/api/marketplace/listings/{listing.id}/archive/')
        self.assertEqual(owner_archive.status_code, status.HTTP_200_OK)
        listing.refresh_from_db()
        self.assertEqual(listing.status, 'archived')
        self.assertFalse(listing.is_available)

    def test_my_listings_endpoint(self):
        # Create second user with a listing
        other_user = User.objects.create_user(
            username='priya_m',
            email='priya@psgtech.edu',
            password='PriyaPassword123!'
        )
        other_profile = StudentProfile.objects.create(
            user=other_user,
            college=self.college_psg,
            is_email_verified=True
        )
        Listing.objects.create(
            lender=other_profile,
            college=self.college_psg,
            category=self.cat_books,
            title='Priya Biology Book',
            price=Decimal('15.00')
        )

        # Arjun has 3 listings: active, unavailable, archived
        l_active = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Arjun Active Laptop',
            listing_type='rent',
            price=Decimal('200.00'),
            status='active',
            is_available=True
        )
        l_unavail = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Arjun Paused Drone',
            listing_type='rent',
            price=Decimal('400.00'),
            status='unavailable',
            is_available=False
        )
        l_arch = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_books,
            title='Arjun Archived Chemistry Book',
            listing_type='lend',
            price=Decimal('0.00'),
            status='archived',
            is_available=False
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        # 1. All my listings
        res_all = self.client.get('/api/marketplace/my-listings/')
        self.assertEqual(res_all.status_code, status.HTTP_200_OK)
        self.assertEqual(res_all.data['count'], 3)
        titles = [item['title'] for item in res_all.data['listings']]
        self.assertNotIn('Priya Biology Book', titles)

        # 2. Filter active / published
        res_active = self.client.get('/api/marketplace/my-listings/?status=active')
        self.assertEqual(res_active.data['count'], 1)
        self.assertEqual(res_active.data['listings'][0]['title'], 'Arjun Active Laptop')

        # 3. Filter unavailable
        res_unavail = self.client.get('/api/marketplace/my-listings/?status=unavailable')
        self.assertEqual(res_unavail.data['count'], 1)
        self.assertEqual(res_unavail.data['listings'][0]['title'], 'Arjun Paused Drone')

        # 4. Filter archived
        res_arch = self.client.get('/api/marketplace/my-listings/?status=archived')
        self.assertEqual(res_arch.data['count'], 1)
        self.assertEqual(res_arch.data['listings'][0]['title'], 'Arjun Archived Chemistry Book')

    def test_booking_quote_calculation(self):
        # Create rental listing with deposit
        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Projector',
            listing_type='rent',
            price=Decimal('150.00'),
            pricing_unit='day',
            deposit_amount=Decimal('500.00'),
            is_available=True
        )

        from datetime import date, timedelta
        d_start = date.today() + timedelta(days=2)
        d_end = date.today() + timedelta(days=4)  # 3 days inclusive

        res = self.client.get(
            f'/api/marketplace/bookings/quote/?listing_id={listing.id}&start_date={d_start.isoformat()}&end_date={d_end.isoformat()}'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        quote = res.data['quote']
        self.assertEqual(quote['duration_days'], 3)
        self.assertEqual(Decimal(str(quote['total_rent'])), Decimal('450.00'))  # 3 * 150
        self.assertEqual(Decimal(str(quote['deposit_amount'])), Decimal('500.00'))
        self.assertEqual(Decimal(str(quote['total_due_upfront'])), Decimal('950.00'))
        self.assertFalse(res.data['has_conflict'])

    def test_booking_create_and_snapshots(self):
        # Create borrower user
        borrower_user = User.objects.create_user(
            username='kavya_s',
            email='kavya@cit.edu.in',
            password='TestPassword123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='GoPro Hero 10',
            listing_type='rent',
            price=Decimal('200.00'),
            pricing_unit='day',
            deposit_amount=Decimal('1000.00'),
            is_available=True
        )

        from datetime import date, timedelta
        d_start = date.today() + timedelta(days=5)
        d_end = date.today() + timedelta(days=6)  # 2 days

        # 1. Self-booking prevention: Arjun cannot book his own listing
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self_res = self.client.post('/api/marketplace/bookings/', {
            'listing_id': listing.id,
            'start_date': d_start.isoformat(),
            'end_date': d_end.isoformat(),
        })
        self.assertEqual(self_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Kavya requests booking
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        res = self.client.post('/api/marketplace/bookings/', {
            'listing_id': listing.id,
            'start_date': d_start.isoformat(),
            'end_date': d_end.isoformat(),
            'borrower_message': 'Need for weekend college event video shoot.'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], 'pending')
        self.assertEqual(res.data['borrower']['username'], 'kavya_s')
        self.assertEqual(res.data['lender']['username'], 'arjun_k')
        self.assertEqual(Decimal(str(res.data['calculated_total_rent'])), Decimal('400.00'))  # 2 * 200
        self.assertEqual(Decimal(str(res.data['snapshot_deposit_amount'])), Decimal('1000.00'))
        self.assertEqual(Decimal(str(res.data['total_due_upfront'])), Decimal('1400.00'))

    def test_booking_conflict_prevention(self):
        from datetime import date, timedelta
        borrower_user = User.objects.create_user(
            username='siddharth_r',
            email='sid@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        third_user = User.objects.create_user(
            username='deepak_v',
            email='deepak@cit.edu.in',
            password='Password123!'
        )
        third_profile = StudentProfile.objects.create(
            user=third_user,
            college=self.college_cit,
            college_email=third_user.email,
            is_email_verified=True
        )
        third_token = Token.objects.create(user=third_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Lab Oscilloscope',
            listing_type='rent',
            price=Decimal('100.00'),
            pricing_unit='day',
            is_available=True
        )

        d1 = date.today() + timedelta(days=10)
        d2 = date.today() + timedelta(days=15)

        # Existing accepted booking for [d1, d2]
        from apps.marketplace.models import Booking
        from apps.marketplace.booking_logic import calculate_booking_quote

        quote = calculate_booking_quote(listing, d1, d2)
        confirmed_booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='accepted',
            start_date=d1,
            end_date=d2,
            duration_days=quote['duration_days'],
            calculated_total_rent=quote['total_rent'],
            total_due_upfront=quote['total_due_upfront']
        )

        # Third user tries to request overlapping dates [d1 + 2, d2 + 2]
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {third_token.key}')
        overlap_res = self.client.post('/api/marketplace/bookings/', {
            'listing_id': listing.id,
            'start_date': (d1 + timedelta(days=2)).isoformat(),
            'end_date': (d2 + timedelta(days=2)).isoformat(),
        })
        self.assertEqual(overlap_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', overlap_res.data)

        # Non-overlapping request for [d2 + 1, d2 + 5] succeeds
        non_overlap_res = self.client.post('/api/marketplace/bookings/', {
            'listing_id': listing.id,
            'start_date': (d2 + timedelta(days=1)).isoformat(),
            'end_date': (d2 + timedelta(days=5)).isoformat(),
        })
        self.assertEqual(non_overlap_res.status_code, status.HTTP_201_CREATED)

    def test_owner_accept_and_decline_actions(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking
        from apps.marketplace.booking_logic import calculate_booking_quote

        borrower_user = User.objects.create_user(
            username='nithya_p',
            email='nithya@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Wireless Mic Set',
            listing_type='rent',
            price=Decimal('80.00'),
            pricing_unit='day',
            is_available=True
        )

        d1 = date.today() + timedelta(days=3)
        d2 = date.today() + timedelta(days=5)
        quote = calculate_booking_quote(listing, d1, d2)

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='pending',
            start_date=d1,
            end_date=d2,
            duration_days=quote['duration_days'],
            calculated_total_rent=quote['total_rent'],
            total_due_upfront=quote['total_due_upfront']
        )

        # 1. Non-owner (borrower or stranger) cannot accept -> 403 Forbidden
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        unauth_action = self.client.post(f'/api/marketplace/bookings/{booking.id}/action/', {
            'action': 'accept'
        })
        self.assertEqual(unauth_action.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Owner accepts booking -> 200 OK
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        accept_res = self.client.post(f'/api/marketplace/bookings/{booking.id}/action/', {
            'action': 'accept',
            'note': 'Confirmed, please pick up from CIT hostel common room.'
        })
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'accepted')
        self.assertIn('CIT hostel common room', booking.owner_response_note)

    def test_borrower_cancels_booking(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking

        borrower_user = User.objects.create_user(
            username='ashwin_m',
            email='ashwin@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Drawing Tablet',
            price=Decimal('50.00'),
            is_available=True
        )

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='pending',
            start_date=date.today() + timedelta(days=3),
            end_date=date.today() + timedelta(days=4)
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        cancel_res = self.client.post(f'/api/marketplace/bookings/{booking.id}/cancel/', {
            'note': 'Schedule changed.'
        })
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'cancelled')

    def test_wanted_item_requests_and_responses(self):
        # 1. Arjun creates a wanted item request
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        req_res = self.client.post('/api/marketplace/wanted-requests/', {
            'title': 'Need Arduino Uno Kit for Embedded Systems Project',
            'description': 'Looking for an Arduino kit with breadboard and jumper wires for 1 week.',
            'category_id': self.cat_electronics.id,
            'request_type': 'rent',
            'budget': '100.00',
            'preferred_terms': '1 week',
            'notes': 'Can pick up anywhere on campus.',
        })
        self.assertEqual(req_res.status_code, status.HTTP_201_CREATED)
        request_id = req_res.data['id']
        self.assertEqual(req_res.data['title'], 'Need Arduino Uno Kit for Embedded Systems Project')

        # 2. Public view of wanted requests includes this request
        public_res = self.client.get('/api/marketplace/wanted-requests/')
        self.assertEqual(public_res.status_code, status.HTTP_200_OK)
        self.assertTrue(any(r['id'] == request_id for r in public_res.data['requests']))

        # 3. Create responder student
        responder_user = User.objects.create_user(
            username='karthik_b',
            email='karthik@cit.edu.in',
            password='Password123!'
        )
        responder_profile = StudentProfile.objects.create(
            user=responder_user,
            college=self.college_cit,
            college_email=responder_user.email,
            is_email_verified=True
        )
        responder_token = Token.objects.create(user=responder_user)

        # 4. Responder responds with offer
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {responder_token.key}')
        offer_res = self.client.post(f'/api/marketplace/wanted-requests/{request_id}/respond/', {
            'message': 'I have a complete Arduino kit with extra sensors you can borrow.',
            'offered_price': '80.00'
        })
        self.assertEqual(offer_res.status_code, status.HTTP_201_CREATED)
        response_id = offer_res.data['id']
        self.assertEqual(offer_res.data['responder']['username'], 'karthik_b')

        # 5. Arjun reviews response and marks interested
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        action_res = self.client.post(f'/api/marketplace/wanted-responses/{response_id}/action/', {
            'action': 'interested'
        })
        self.assertEqual(action_res.status_code, status.HTTP_200_OK)
        self.assertEqual(action_res.data['response']['status'], 'interested')

    def test_qr_pickup_and_return_successful_flow(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking

        borrower_user = User.objects.create_user(
            username='rohit_s',
            email='rohit@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Sony Alpha A7 III Camera',
            listing_type='rent',
            price=Decimal('500.00'),
            pricing_unit='day',
            is_available=True
        )

        d1 = date.today() + timedelta(days=2)
        d2 = date.today() + timedelta(days=4)

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='accepted',
            start_date=d1,
            end_date=d2,
            duration_days=2,
            calculated_total_rent=Decimal('1000.00'),
            total_due_upfront=Decimal('1000.00')
        )

        # 1. Lender (Arjun) generates pickup QR code
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        gen_pickup = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {
            'action_type': 'pickup'
        })
        self.assertEqual(gen_pickup.status_code, status.HTTP_200_OK)
        raw_pickup_token = gen_pickup.data['raw_token']
        pickup_code = gen_pickup.data['verification_code']
        self.assertTrue(len(raw_pickup_token) > 20)
        self.assertTrue(len(pickup_code) == 6)

        # 2. Borrower (Rohit) scans lender's pickup QR code
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        verify_pickup = self.client.post(f'/api/marketplace/bookings/{booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': raw_pickup_token
        })
        self.assertEqual(verify_pickup.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'active')
        self.assertIsNotNone(booking.pickup_confirmed_at)

        # 3. Borrower (Rohit) generates return QR code
        gen_return = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {
            'action_type': 'return'
        })
        self.assertEqual(gen_return.status_code, status.HTTP_200_OK)
        raw_return_token = gen_return.data['raw_token']

        # 4. Lender (Arjun) scans borrower's return QR code
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        verify_return = self.client.post(f'/api/marketplace/bookings/{booking.id}/verify-handover/', {
            'action_type': 'return',
            'token': raw_return_token
        })
        self.assertEqual(verify_return.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'returned')
        self.assertIsNotNone(booking.return_confirmed_at)

    def test_qr_unauthorized_attempts_and_self_scan_rejection(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking

        borrower_user = User.objects.create_user(
            username='meera_v',
            email='meera@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        stranger_user = User.objects.create_user(
            username='stranger_x',
            email='stranger@cit.edu.in',
            password='Password123!'
        )
        StudentProfile.objects.create(
            user=stranger_user,
            college=self.college_cit,
            college_email=stranger_user.email,
            is_email_verified=True
        )
        stranger_token = Token.objects.create(user=stranger_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Microphone Kit',
            listing_type='rent',
            price=Decimal('100.00'),
            is_available=True
        )

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='accepted',
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=2)
        )

        # A: Borrower cannot generate pickup QR (only lender can)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        res1 = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {
            'action_type': 'pickup'
        })
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)

        # Lender generates pickup QR
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        gen = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {
            'action_type': 'pickup'
        })
        self.assertEqual(gen.status_code, status.HTTP_200_OK)
        raw_token = gen.data['raw_token']

        # B: Lender cannot self-scan their own pickup QR
        self_scan = self.client.post(f'/api/marketplace/bookings/{booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': raw_token
        })
        self.assertEqual(self_scan.status_code, status.HTTP_403_FORBIDDEN)

        # C: Unrelated stranger cannot scan
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {stranger_token.key}')
        stranger_scan = self.client.post(f'/api/marketplace/bookings/{booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': raw_token
        })
        self.assertEqual(stranger_scan.status_code, status.HTTP_403_FORBIDDEN)

    def test_qr_invalid_state_and_replay_rejection(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking

        borrower_user = User.objects.create_user(
            username='varun_t',
            email='varun@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Drone Quadcopter',
            listing_type='rent',
            price=Decimal('250.00'),
            is_available=True
        )

        # 1. Booking is still 'pending' -> Cannot generate pickup QR
        pending_booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='pending',
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=2)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        res_pending = self.client.post(f'/api/marketplace/bookings/{pending_booking.id}/generate-qr/', {
            'action_type': 'pickup'
        })
        self.assertEqual(res_pending.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Accepted booking: Test replay prevention
        pending_booking.status = 'accepted'
        pending_booking.save()

        gen = self.client.post(f'/api/marketplace/bookings/{pending_booking.id}/generate-qr/', {
            'action_type': 'pickup'
        })
        self.assertEqual(gen.status_code, status.HTTP_200_OK)
        token = gen.data['raw_token']

        # First scan consumes token
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        scan1 = self.client.post(f'/api/marketplace/bookings/{pending_booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': token
        })
        self.assertEqual(scan1.status_code, status.HTTP_200_OK)

        # Second scan attempt with same token -> Replay rejected
        scan2 = self.client.post(f'/api/marketplace/bookings/{pending_booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': token
        })
        self.assertEqual(scan2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_qr_expired_token_rejection(self):
        from datetime import date, timedelta
        from django.utils import timezone
        from apps.marketplace.models import Booking, HandoverToken

        borrower_user = User.objects.create_user(
            username='divya_m',
            email='divya@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Projector',
            listing_type='rent',
            price=Decimal('150.00'),
            is_available=True
        )

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='accepted',
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=2)
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        gen = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {
            'action_type': 'pickup'
        })
        token = gen.data['raw_token']

        # Artificially expire token
        HandoverToken.objects.filter(booking=booking).update(
            expires_at=timezone.now() - timedelta(minutes=5)
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        scan = self.client.post(f'/api/marketplace/bookings/{booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': token
        })
        self.assertEqual(scan.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', scan.data['error'].lower())

    def test_manual_backup_code_verification(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking

        borrower_user = User.objects.create_user(
            username='sanjay_k',
            email='sanjay@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Bluetooth Speaker',
            listing_type='rent',
            price=Decimal('50.00'),
            is_available=True
        )

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='accepted',
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=2)
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        gen = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {
            'action_type': 'pickup'
        })
        code = gen.data['verification_code']

        # Borrower enters the 6-character backup code instead of scanning QR
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        scan = self.client.post(f'/api/marketplace/bookings/{booking.id}/verify-handover/', {
            'action_type': 'pickup',
            'token': code
        })
        self.assertEqual(scan.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'active')

    # ========================================================
    # STAGE 8 TESTS: FINANCIAL RECORDS, BILLING & DIRECT PAYMENTS
    # ========================================================

    def test_payment_declaration_and_recipient_confirmation(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking, PaymentRecord

        borrower_user = User.objects.create_user(
            username='rohit_v',
            email='rohit@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        third_user = User.objects.create_user(
            username='stranger_u',
            email='stranger@cit.edu.in',
            password='Password123!'
        )
        third_profile = StudentProfile.objects.create(
            user=third_user,
            college=self.college_cit,
            college_email=third_user.email,
            is_email_verified=True
        )
        third_token = Token.objects.create(user=third_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Camera Gimbal Stabilizer',
            listing_type='rent',
            price=Decimal('150.00'),
            pricing_unit='day',
            deposit_amount=Decimal('500.00'),
            is_available=True
        )

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='accepted',
            start_date=date.today() + timedelta(days=2),
            end_date=date.today() + timedelta(days=4),
            duration_days=3,
            snapshot_price=Decimal('150.00'),
            snapshot_pricing_unit='day',
            snapshot_deposit_amount=Decimal('500.00'),
            calculated_total_rent=Decimal('450.00'),
            total_due_upfront=Decimal('950.00')
        )

        # 1. Borrower declares rent payment
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        res = self.client.post(f'/api/marketplace/bookings/{booking.id}/payments/declare/', {
            'purpose': 'rent',
            'amount': '450.00',
            'payment_method': 'upi',
            'transaction_reference': 'UPI-REF-998877',
            'payer_notes': 'Paid via Google Pay to lender QR'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        payment_id = res.data['payment']['id']
        self.assertEqual(res.data['payment']['status'], 'declared')
        self.assertEqual(Decimal(str(res.data['summary']['rent_declared'])), Decimal('450.00'))
        self.assertEqual(Decimal(str(res.data['summary']['rent_confirmed'])), Decimal('0.00'))

        # 2. Borrower tries to confirm their own payment -> Rejected (403)
        conf_self = self.client.post(f'/api/marketplace/payments/{payment_id}/confirm/')
        self.assertEqual(conf_self.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Third-party student tries to confirm -> Rejected (403)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {third_token.key}')
        conf_third = self.client.post(f'/api/marketplace/payments/{payment_id}/confirm/')
        self.assertEqual(conf_third.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Lender confirms payment -> 200 OK
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        conf_lender = self.client.post(f'/api/marketplace/payments/{payment_id}/confirm/')
        self.assertEqual(conf_lender.status_code, status.HTTP_200_OK)
        self.assertEqual(conf_lender.data['payment']['status'], 'confirmed')
        self.assertEqual(Decimal(str(conf_lender.data['summary']['rent_confirmed'])), Decimal('450.00'))

        # 5. Cannot re-confirm already confirmed payment
        re_conf = self.client.post(f'/api/marketplace/payments/{payment_id}/confirm/')
        self.assertEqual(re_conf.status_code, status.HTTP_400_BAD_REQUEST)

    def test_payment_dispute_and_prerequisite_blocks_pickup(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking

        borrower_user = User.objects.create_user(
            username='priya_m',
            email='priya@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Calculus Calculator',
            listing_type='rent',
            price=Decimal('50.00'),
            is_available=True
        )

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='accepted',
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=2),
            calculated_total_rent=Decimal('100.00'),
            total_due_upfront=Decimal('100.00')
        )

        # 1. Borrower declares payment
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        dec = self.client.post(f'/api/marketplace/bookings/{booking.id}/payments/declare/', {
            'purpose': 'rent',
            'amount': '100.00',
            'payment_method': 'upi'
        })
        self.assertEqual(dec.status_code, status.HTTP_201_CREATED)
        payment_id = dec.data['payment']['id']

        # 2. Lender disputes payment
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        disp = self.client.post(f'/api/marketplace/payments/{payment_id}/dispute/', {
            'dispute_reason': 'Transaction ID not found in bank account statement.'
        })
        self.assertEqual(disp.status_code, status.HTTP_200_OK)
        self.assertEqual(disp.data['payment']['status'], 'disputed')

        # 3. Pickup QR generation MUST be blocked while payment is disputed
        gen = self.client.post(f'/api/marketplace/bookings/{booking.id}/generate-qr/', {
            'action_type': 'pickup'
        })
        self.assertEqual(gen.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('disputed payment', gen.data['error'].lower())

    def test_settlement_adjustment_workflow(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking

        borrower_user = User.objects.create_user(
            username='anand_p',
            email='anand@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Projector',
            listing_type='rent',
            price=Decimal('200.00'),
            deposit_amount=Decimal('1000.00'),
            is_available=True
        )

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='returned',
            start_date=date.today() - timedelta(days=3),
            end_date=date.today() - timedelta(days=1),
            snapshot_deposit_amount=Decimal('1000.00'),
            calculated_total_rent=Decimal('400.00'),
            total_due_upfront=Decimal('1400.00')
        )

        # 1. Lender proposes late fee adjustment of ₹150
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        prop = self.client.post(f'/api/marketplace/bookings/{booking.id}/adjustments/propose/', {
            'adjustment_type': 'late_fee',
            'amount': '150.00',
            'reason': 'Returned 4 hours after agreed return time.',
            'description': 'Late fee agreed per hour basis.'
        })
        self.assertEqual(prop.status_code, status.HTTP_201_CREATED)
        adj_id = prop.data['adjustment']['id']
        self.assertEqual(prop.data['adjustment']['status'], 'proposed')

        # 2. Lender cannot accept their own adjustment
        self_acc = self.client.post(f'/api/marketplace/adjustments/{adj_id}/respond/', {'action': 'accept'})
        self.assertEqual(self_acc.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Borrower accepts late fee adjustment
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        acc = self.client.post(f'/api/marketplace/adjustments/{adj_id}/respond/', {
            'action': 'accept',
            'response_note': 'Acknowledged and agreed.'
        })
        self.assertEqual(acc.status_code, status.HTTP_200_OK)
        self.assertEqual(acc.data['adjustment']['status'], 'accepted')
        # Net deposit refund should now be 1000 - 150 = 850
        self.assertEqual(Decimal(str(acc.data['summary']['approved_deductions'])), Decimal('150.00'))
        self.assertEqual(Decimal(str(acc.data['summary']['net_refundable_deposit'])), Decimal('850.00'))

        # 4. Lender proposes second adjustment (damage claim of ₹300)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        prop2 = self.client.post(f'/api/marketplace/bookings/{booking.id}/adjustments/propose/', {
            'adjustment_type': 'damage',
            'amount': '300.00',
            'reason': 'Scratch on projector lens cap.'
        })
        adj2_id = prop2.data['adjustment']['id']

        # 5. Borrower disputes damage claim
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        disp2 = self.client.post(f'/api/marketplace/adjustments/{adj2_id}/respond/', {
            'action': 'dispute',
            'response_note': 'Scratch was already present during pickup.'
        })
        self.assertEqual(disp2.status_code, status.HTTP_200_OK)
        self.assertEqual(disp2.data['adjustment']['status'], 'disputed')
        # Disputed adjustment is NOT deducted from deposit balance
        self.assertEqual(Decimal(str(disp2.data['summary']['net_refundable_deposit'])), Decimal('850.00'))
        self.assertTrue(disp2.data['summary']['has_disputes'])

    def test_deposit_refund_workflow(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking

        borrower_user = User.objects.create_user(
            username='meera_t',
            email='meera@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='DSLR Camera',
            listing_type='rent',
            price=Decimal('300.00'),
            deposit_amount=Decimal('2000.00'),
            is_available=True
        )

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='returned',
            start_date=date.today() - timedelta(days=5),
            end_date=date.today() - timedelta(days=1),
            snapshot_deposit_amount=Decimal('2000.00'),
            calculated_total_rent=Decimal('1200.00'),
            total_due_upfront=Decimal('3200.00')
        )

        # 1. Lender declares deposit refund transfer of ₹2000
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        ref_dec = self.client.post(f'/api/marketplace/bookings/{booking.id}/refund/declare/', {
            'refund_method': 'upi',
            'transaction_reference': 'UPI-REFUND-443322',
            'notes': 'Refunded security deposit to borrower UPI ID.'
        })
        self.assertEqual(ref_dec.status_code, status.HTTP_200_OK)
        self.assertEqual(ref_dec.data['deposit_refund']['status'], 'declared')
        self.assertEqual(Decimal(str(ref_dec.data['deposit_refund']['net_refund_amount'])), Decimal('2000.00'))

        # 2. Borrower confirms receipt of refund
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        ref_conf = self.client.post(f'/api/marketplace/bookings/{booking.id}/refund/confirm/', {
            'action': 'confirm'
        })
        self.assertEqual(ref_conf.status_code, status.HTTP_200_OK)
        self.assertEqual(ref_conf.data['deposit_refund']['status'], 'confirmed')
        self.assertEqual(Decimal(str(ref_conf.data['summary']['refund_confirmed_amount'])), Decimal('2000.00'))

    def test_settlement_bill_and_unauthorized_access(self):
        from datetime import date, timedelta
        from apps.marketplace.models import Booking

        borrower_user = User.objects.create_user(
            username='tarun_s',
            email='tarun@cit.edu.in',
            password='Password123!'
        )
        borrower_profile = StudentProfile.objects.create(
            user=borrower_user,
            college=self.college_cit,
            college_email=borrower_user.email,
            is_email_verified=True
        )
        borrower_token = Token.objects.create(user=borrower_user)

        stranger_user = User.objects.create_user(
            username='stranger_two',
            email='stranger2@cit.edu.in',
            password='Password123!'
        )
        StudentProfile.objects.create(
            user=stranger_user,
            college=self.college_cit,
            college_email=stranger_user.email,
            is_email_verified=True
        )
        stranger_token = Token.objects.create(user=stranger_user)

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Camping Tent',
            listing_type='rent',
            price=Decimal('250.00'),
            deposit_amount=Decimal('500.00'),
            is_available=True
        )

        booking = Booking.objects.create(
            listing=listing,
            borrower=borrower_profile,
            lender=self.profile,
            status='returned',
            start_date=date.today() - timedelta(days=2),
            end_date=date.today() - timedelta(days=1),
            duration_days=2,
            snapshot_price=Decimal('250.00'),
            snapshot_pricing_unit='day',
            snapshot_deposit_amount=Decimal('500.00'),
            calculated_total_rent=Decimal('500.00'),
            total_due_upfront=Decimal('1000.00')
        )

        # 1. Stranger tries to view financial records -> 403 Forbidden
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {stranger_token.key}')
        unauth_fin = self.client.get(f'/api/marketplace/bookings/{booking.id}/financials/')
        self.assertEqual(unauth_fin.status_code, status.HTTP_403_FORBIDDEN)

        unauth_bill = self.client.get(f'/api/marketplace/bookings/{booking.id}/settlement-bill/')
        self.assertEqual(unauth_bill.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Borrower views settlement bill
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        bill = self.client.get(f'/api/marketplace/bookings/{booking.id}/settlement-bill/')
        self.assertEqual(bill.status_code, status.HTTP_200_OK)
        self.assertIn('bill_number', bill.data)
        self.assertTrue(bill.data['bill_number'].startswith(f'CS-BILL-{booking.id}-'))
        self.assertIn('disclaimer', bill.data)
        self.assertIn('CampusShare-generated transaction record', bill.data['disclaimer'])
        self.assertEqual(Decimal(str(bill.data['financial_summary']['agreed_base_rent'])), Decimal('500.00'))
        self.assertEqual(Decimal(str(bill.data['financial_summary']['agreed_deposit'])), Decimal('500.00'))

    # ========================================================
    # STAGE 9: NOTIFICATIONS & MESSAGING TESTS
    # ========================================================

    def test_notification_creation_on_booking_and_actions(self):
        from apps.marketplace.models import Notification, Booking
        from datetime import date, timedelta

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Canon DSLR Camera',
            subcategory='Cameras',
            price=Decimal('200.00'),
            pricing_unit='day',
            deposit_amount=Decimal('500.00'),
            listing_type='rent',
            condition='like_new',
            is_available=True,
            is_visible=True,
            status='active'
        )

        borrower_user = User.objects.create_user(username='notif_borrower', email='borrower@psgtech.ac.in', password='Pass!')
        borrower_profile = StudentProfile.objects.create(user=borrower_user, college=self.college_psg, college_email=borrower_user.email, is_email_verified=True)
        borrower_token = Token.objects.create(user=borrower_user)

        # 1. Borrower submits booking request
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {borrower_token.key}')
        book_res = self.client.post('/api/marketplace/bookings/', {
            'listing_id': listing.id,
            'start_date': (date.today() + timedelta(days=2)).isoformat(),
            'end_date': (date.today() + timedelta(days=4)).isoformat(),
            'borrower_notes': 'Need for weekend hackathon photography.'
        })
        self.assertEqual(book_res.status_code, status.HTTP_201_CREATED)
        booking_id = book_res.data['id']

        # Verify lender received notification
        lender_notifs = Notification.objects.filter(recipient=self.profile, notification_type='booking_request')
        self.assertEqual(lender_notifs.count(), 1)
        notif = lender_notifs.first()
        self.assertEqual(notif.target_modal, 'incoming_bookings')
        self.assertEqual(notif.target_id, str(booking_id))
        self.assertFalse(notif.is_read)

        # 2. Lender accepts booking request
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        accept_res = self.client.post(f'/api/marketplace/bookings/{booking_id}/action/', {
            'action': 'accept',
            'note': 'Accepted, pick up anytime after 10 AM.'
        })
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)

        # Verify borrower received notification
        borrower_notifs = Notification.objects.filter(recipient=borrower_profile, notification_type='booking_accepted')
        self.assertEqual(borrower_notifs.count(), 1)
        borrower_notif = borrower_notifs.first()
        self.assertEqual(borrower_notif.target_modal, 'my_bookings')
        self.assertEqual(borrower_notif.target_id, str(booking_id))

    def test_notification_read_unread_and_mark_all(self):
        from apps.marketplace.models import Notification

        # Create two notifications for self.profile
        n1 = Notification.objects.create(
            recipient=self.profile,
            notification_type='system',
            title='Welcome to Stage 9',
            message='Notifications are now active.',
            target_modal='marketplace',
        )
        n2 = Notification.objects.create(
            recipient=self.profile,
            notification_type='system',
            title='Profile Update',
            message='Your profile is in good standing.',
            target_modal='profile',
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        # 1. Check unread counts endpoint
        counts_res = self.client.get('/api/marketplace/unread-counts/')
        self.assertEqual(counts_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(counts_res.data['notifications_unread'], 2)

        # 2. List notifications
        list_res = self.client.get('/api/marketplace/notifications/?status=unread')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(list_res.data['unread_count'], 2)

        # 3. Mark single notification as read
        read_res = self.client.post(f'/api/marketplace/notifications/{n1.id}/read/')
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        n1.refresh_from_db()
        self.assertTrue(n1.is_read)
        self.assertIsNotNone(n1.read_at)

        # 4. Mark all as read
        mark_all = self.client.post('/api/marketplace/notifications/read-all/')
        self.assertEqual(mark_all.status_code, status.HTTP_200_OK)
        self.assertEqual(mark_all.data['unread_count'], 0)
        n2.refresh_from_db()
        self.assertTrue(n2.is_read)

    def test_conversation_lifecycle_and_messaging(self):
        from apps.marketplace.models import Conversation, Message, Notification

        listing = Listing.objects.create(
            lender=self.profile,
            college=self.college_cit,
            category=self.cat_electronics,
            title='Canon DSLR Camera',
            subcategory='Cameras',
            price=Decimal('200.00'),
            pricing_unit='day',
            listing_type='rent',
            condition='like_new',
            is_available=True,
            is_visible=True,
            status='active'
        )

        buyer_user = User.objects.create_user(username='buyer_student', email='buyer@psgtech.ac.in', password='Pass!')
        buyer_profile = StudentProfile.objects.create(user=buyer_user, college=self.college_psg, college_email=buyer_user.email, is_email_verified=True)
        buyer_token = Token.objects.create(user=buyer_user)

        # 1. Buyer initiates conversation about listing
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {buyer_token.key}')
        start_res = self.client.post('/api/marketplace/conversations/', {
            'listing_id': listing.id,
            'initial_message': 'Hi, is this camera available with the 50mm prime lens?'
        })
        self.assertEqual(start_res.status_code, status.HTTP_201_CREATED)
        conv_id = start_res.data['id']
        self.assertEqual(start_res.data['context_type'], 'listing')
        self.assertEqual(start_res.data['latest_message']['content'], 'Hi, is this camera available with the 50mm prime lens?')

        # Verify lender received notification of new message
        msg_notifs = Notification.objects.filter(recipient=self.profile, notification_type='new_message')
        self.assertEqual(msg_notifs.count(), 1)

        # 2. Lender reads conversation -> unread messages marked read
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        msgs_res = self.client.get(f'/api/marketplace/conversations/{conv_id}/messages/')
        self.assertEqual(msgs_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(msgs_res.data['messages']), 1)
        self.assertFalse(msgs_res.data['messages'][0]['is_mine'])

        # Verify message is now marked read in DB
        first_msg = Message.objects.get(conversation_id=conv_id)
        self.assertTrue(first_msg.is_read)

        # 3. Lender sends reply
        reply_res = self.client.post(f'/api/marketplace/conversations/{conv_id}/messages/', {
            'content': 'Yes, both the 18-55mm and 50mm prime lens are included in the carrying bag.'
        })
        self.assertEqual(reply_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(reply_res.data['is_mine'])

        # 4. Check conversation list endpoint
        convs_res = self.client.get('/api/marketplace/conversations/')
        self.assertEqual(convs_res.status_code, status.HTTP_200_OK)
        self.assertEqual(convs_res.data['count'], 1)

    def test_messaging_security_and_unauthorized_access(self):
        from apps.marketplace.models import Conversation

        student_a = User.objects.create_user(username='student_a', email='a@cit.edu.in', password='Pass!')
        profile_a = StudentProfile.objects.create(user=student_a, college=self.college_cit, college_email=student_a.email, is_email_verified=True)
        token_a = Token.objects.create(user=student_a)

        student_b = User.objects.create_user(username='student_b', email='b@cit.edu.in', password='Pass!')
        profile_b = StudentProfile.objects.create(user=student_b, college=self.college_cit, college_email=student_b.email, is_email_verified=True)
        token_b = Token.objects.create(user=student_b)

        stranger = User.objects.create_user(username='stranger_x', email='x@cit.edu.in', password='Pass!')
        profile_stranger = StudentProfile.objects.create(user=stranger, college=self.college_cit, college_email=stranger.email, is_email_verified=True)
        token_stranger = Token.objects.create(user=stranger)

        conv = Conversation.objects.create(
            participant_1=profile_a,
            participant_2=profile_b,
            subject='Private discussion'
        )

        # 1. Stranger attempts to view private conversation -> 403 Forbidden
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token_stranger.key}')
        unauth_conv = self.client.get(f'/api/marketplace/conversations/{conv.id}/')
        self.assertEqual(unauth_conv.status_code, status.HTTP_403_FORBIDDEN)

        unauth_msgs = self.client.get(f'/api/marketplace/conversations/{conv.id}/messages/')
        self.assertEqual(unauth_msgs.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Stranger attempts to inject message into conversation -> 403 Forbidden
        unauth_send = self.client.post(f'/api/marketplace/conversations/{conv.id}/messages/', {
            'content': 'Attempting unauthorized inject.'
        })
        self.assertEqual(unauth_send.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Initiating conversation without context -> 400 Bad Request
        bad_start = self.client.post('/api/marketplace/conversations/', {})
        self.assertEqual(bad_start.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Message length limit validation (> 2000 chars)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token_a.key}')
        too_long = self.client.post(f'/api/marketplace/conversations/{conv.id}/messages/', {
            'content': 'A' * 2001
        })
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_notification_prevention(self):
        from apps.marketplace.notification_service import create_notification
        from apps.marketplace.models import Notification

        recipient = self.profile
        actor_user = User.objects.create_user(username='actor_u', email='actor@psg.edu', password='Pass!')
        actor = StudentProfile.objects.create(user=actor_user, college=self.college_psg, college_email=actor_user.email, is_email_verified=True)

        # First trigger
        n1 = create_notification(
            recipient=recipient,
            actor=actor,
            notification_type='booking_request',
            title='Booking Request',
            message='Please accept my request',
            target_modal='incoming_bookings',
            target_id='9999'
        )
        self.assertIsNotNone(n1)

        # Repeated trigger within 60 seconds
        n2 = create_notification(
            recipient=recipient,
            actor=actor,
            notification_type='booking_request',
            title='Booking Request',
            message='Please accept my request',
            target_modal='incoming_bookings',
            target_id='9999'
        )
        # Should reuse n1 without creating duplicate
        self.assertEqual(n1.id, n2.id)
        self.assertEqual(Notification.objects.filter(recipient=recipient, target_id='9999').count(), 1)




