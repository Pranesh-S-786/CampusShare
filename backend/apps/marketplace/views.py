from decimal import Decimal
from django.db.models import Q
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.authentication.models import StudentProfile, College
from .models import Category, Listing, ListingImage, Booking, Review
from .storage import ListingStorageService
from .serializers import (
    CategorySerializer,
    ListingSerializer,
    ListingWriteSerializer,
    ListingCreateSerializer,
)


class IsListingOwner(permissions.BasePermission):
    """
    Object-level permission to only allow owners of a listing to edit or archive it.
    """
    def has_object_permission(self, request, view, obj):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return False
        return obj.lender_id == profile.id


class CategoryListView(APIView):
    """
    Public listing of item categories available on CampusShare.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        categories = Category.objects.filter(is_active=True).order_by('order', 'name')
        serializer = CategorySerializer(categories, many=True)
        return Response({
            'count': categories.count(),
            'categories': serializer.data,
        })


class ListingListView(APIView):
    """
    Discover items shared on campus, with filtering by search query, category, colleges, and listing type.
    Authenticated students can also post new listings.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get(self, request):
        queryset = Listing.objects.filter(
            is_visible=True,
            status='active'
        ).select_related(
            'category', 'college', 'lender', 'lender__college'
        ).prefetch_related('images')

        # 1. Search Query Filter
        search_query = request.query_params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(title__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(subcategory__icontains=search_query) |
                Q(pickup_location__icontains=search_query)
            )

        # 2. Category Filter (by slug)
        category_slug = request.query_params.get('category', '').strip()
        if category_slug and category_slug != 'all':
            queryset = queryset.filter(category__slug=category_slug)

        # 3. College Selection Filter (single or multiple)
        college_ids_param = request.query_params.get('college_ids', '').strip()
        single_college_id = request.query_params.get('college_id', '').strip()

        if college_ids_param:
            try:
                college_ids = [int(cid.strip()) for cid in college_ids_param.split(',') if cid.strip().isdigit()]
                if college_ids:
                    queryset = queryset.filter(college_id__in=college_ids)
            except ValueError:
                pass
        elif single_college_id and single_college_id.isdigit():
            queryset = queryset.filter(college_id=int(single_college_id))

        # 4. Listing Type Filter (lend, rent, sell)
        listing_type_param = request.query_params.get('listing_type', '').strip().lower()
        if listing_type_param and listing_type_param != 'all':
            queryset = queryset.filter(listing_type=listing_type_param)

        # 5. Availability Filter
        is_available_param = request.query_params.get('is_available', '').strip().lower()
        if is_available_param in ('true', '1'):
            queryset = queryset.filter(is_available=True)

        serializer = ListingSerializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'listings': serializer.data,
        })

    def post(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response(
                {'error': 'A student profile is required to post listings.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not profile.is_email_verified:
            return Response(
                {'error': 'You must verify your college email address before posting listings.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ListingWriteSerializer(data=request.data)
        if serializer.is_valid():
            college = serializer.validated_data.get('college') or profile.college

            listing = serializer.save(
                lender=profile,
                college=college,
                status='active',
                is_available=True,
                is_visible=True
            )
            return Response(
                ListingSerializer(listing).data,
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ListingDetailView(APIView):
    """
    Retrieve, update, or archive a campus listing.
    """
    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [permissions.IsAuthenticated(), IsListingOwner()]
        return [permissions.AllowAny()]

    def get_object(self, pk):
        try:
            return Listing.objects.select_related(
                'category', 'college', 'lender', 'lender__college'
            ).prefetch_related('images').get(pk=pk)
        except Listing.DoesNotExist:
            return None

    def get(self, request, pk):
        listing = self.get_object(pk)
        if not listing:
            return Response(
                {'error': 'Listing not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Hidden or archived listings are only visible to owner or admin
        if not listing.is_visible or listing.status == 'archived':
            profile = getattr(request.user, 'profile', None)
            if not (profile and listing.lender_id == profile.id):
                return Response(
                    {'error': 'Listing not found or unavailable.'},
                    status=status.HTTP_404_NOT_FOUND
                )

        serializer = ListingSerializer(listing)
        return Response(serializer.data)

    def patch(self, request, pk):
        listing = self.get_object(pk)
        if not listing:
            return Response(
                {'error': 'Listing not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        self.check_object_permissions(request, listing)

        serializer = ListingWriteSerializer(listing, data=request.data, partial=True)
        if serializer.is_valid():
            updated_listing = serializer.save()
            return Response(ListingSerializer(updated_listing).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, pk):
        return self.patch(request, pk)

    def delete(self, request, pk):
        listing = self.get_object(pk)
        if not listing:
            return Response(
                {'error': 'Listing not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        self.check_object_permissions(request, listing)

        # Check for active bookings before deletion
        has_active = listing.bookings.filter(status__in=['accepted', 'active', 'returned']).exists()
        if has_active:
            return Response(
                {'error': 'Cannot delete listing: An active rental or unresolved settlement is currently in progress.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        listing.status = 'archived'
        listing.is_available = False
        listing.is_visible = False
        listing.save(update_fields=['status', 'is_available', 'is_visible', 'updated_at'])

        return Response({
            'message': 'Listing has been deleted successfully from marketplace discovery.',
            'listing': ListingSerializer(listing).data
        }, status=status.HTTP_200_OK)


class ListingArchiveView(APIView):
    """
    Explicit endpoint to archive a listing. Only the owner can archive their listing.
    """
    permission_classes = [permissions.IsAuthenticated, IsListingOwner]

    def post(self, request, pk):
        try:
            listing = Listing.objects.get(pk=pk)
        except Listing.DoesNotExist:
            return Response(
                {'error': 'Listing not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        self.check_object_permissions(request, listing)

        listing.status = 'archived'
        listing.is_available = False
        listing.save(update_fields=['status', 'is_available', 'updated_at'])

        return Response({
            'message': 'Listing has been archived successfully.',
            'listing': ListingSerializer(listing).data
        }, status=status.HTTP_200_OK)


class MyListingsView(APIView):
    """
    Returns all listings created by the authenticated student across all statuses
    (active/published, unavailable, archived).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response(
                {'error': 'Student profile not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        queryset = Listing.objects.filter(
            lender=profile
        ).select_related(
            'category', 'college', 'lender', 'lender__college'
        ).prefetch_related('images').order_by('-created_at')

        status_param = request.query_params.get('status', '').strip().lower()
        if status_param in ['active', 'published']:
            queryset = queryset.filter(status='active', is_available=True)
        elif status_param == 'unavailable':
            queryset = queryset.filter(Q(status='unavailable') | Q(is_available=False)).exclude(status='archived')
        elif status_param == 'archived':
            queryset = queryset.filter(status='archived')

        serializer = ListingSerializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'listings': serializer.data,
        })


class ListingImageUploadView(APIView):
    """
    Upload an item photo to Supabase Storage (with fallback during local test).
    Validates file format (JPEG, PNG, WebP) and size (max 5MB).
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        photo = request.FILES.get('image') or request.FILES.get('photo')
        if not photo:
            return Response(
                {'errors': {'image': 'No image file was provided in the upload request.'}},
                status=status.HTTP_400_BAD_REQUEST
            )

        content_type = photo.content_type or 'image/jpeg'
        file_bytes = photo.read()

        public_url, err = ListingStorageService.upload_listing_photo(
            user_id=request.user.id,
            file_bytes=file_bytes,
            content_type=content_type,
            original_filename=photo.name,
        )

        if err:
            return Response({
                'errors': {'image': err},
                'storage_configured': ListingStorageService.get_config()['is_configured'],
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': 'Listing photo uploaded successfully.',
            'image_url': public_url,
            'filename': photo.name,
            'storage_configured': ListingStorageService.get_config()['is_configured'],
        }, status=status.HTTP_201_CREATED)


# ========================================================
# BOOKING SYSTEM VIEWS (Stage 6)
# ========================================================

class BookingQuoteView(APIView):
    """
    Live price calculation and conflict check for proposed booking dates.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from datetime import datetime
        from .booking_logic import calculate_booking_quote, check_booking_conflict

        listing_id = request.query_params.get('listing_id')
        start_str = request.query_params.get('start_date')
        end_str = request.query_params.get('end_date')

        if not listing_id or not start_str:
            return Response(
                {'error': 'listing_id and start_date query parameters are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            listing = Listing.objects.get(pk=listing_id, is_visible=True)
        except Listing.DoesNotExist:
            return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            start_date = datetime.strptime(start_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_str, '%Y-%m-%d').date() if end_str else start_date
        except ValueError:
            return Response({'error': 'Dates must be in YYYY-MM-DD format.'}, status=status.HTTP_400_BAD_REQUEST)

        quote = calculate_booking_quote(listing, start_date, end_date)
        conflict_msg = check_booking_conflict(listing, start_date, end_date)

        return Response({
            'listing_id': listing.id,
            'quote': quote,
            'has_conflict': bool(conflict_msg),
            'conflict_message': conflict_msg,
        })


class BookingCreateView(APIView):
    """
    Submit a booking request or purchase intent for a listing.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .serializers import BookingSerializer, BookingCreateSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'A student profile is required.'}, status=status.HTTP_403_FORBIDDEN)

        if not profile.is_email_verified:
            return Response(
                {'error': 'You must verify your college email address before requesting bookings.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = BookingCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            booking = serializer.save()
            from .notification_service import notify_booking_request
            notify_booking_request(booking)
            return Response(
                BookingSerializer(booking).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MyBookingsView(APIView):
    """
    List bookings submitted by the authenticated student (as borrower).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import Booking
        from .serializers import BookingSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        queryset = Booking.objects.filter(
            borrower=profile
        ).select_related(
            'listing', 'listing__college', 'listing__category', 'borrower', 'lender', 'lender__college'
        ).order_by('-created_at')

        status_param = request.query_params.get('status', '').strip().lower()
        if status_param and status_param != 'all':
            queryset = queryset.filter(status=status_param)

        serializer = BookingSerializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'bookings': serializer.data,
        })


class IncomingBookingsView(APIView):
    """
    List incoming booking requests received by the authenticated student (as owner/lender).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import Booking
        from .serializers import BookingSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        queryset = Booking.objects.filter(
            lender=profile
        ).select_related(
            'listing', 'listing__college', 'listing__category', 'borrower', 'borrower__college', 'lender'
        ).order_by('-created_at')

        status_param = request.query_params.get('status', '').strip().lower()
        if status_param and status_param != 'all':
            queryset = queryset.filter(status=status_param)

        serializer = BookingSerializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'bookings': serializer.data,
        })


class BookingDetailView(APIView):
    """
    Retrieve details for a specific booking. Visible only to borrower or lender.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from .models import Booking
        from .serializers import BookingSerializer

        profile = getattr(request.user, 'profile', None)
        try:
            booking = Booking.objects.select_related(
                'listing', 'listing__college', 'listing__category', 'borrower', 'borrower__college', 'lender', 'lender__college'
            ).get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not profile or (booking.borrower_id != profile.id and booking.lender_id != profile.id):
            return Response({'error': 'You do not have permission to view this booking.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = BookingSerializer(booking)
        return Response(serializer.data)


class BookingActionView(APIView):
    """
    Owner action to Accept, Decline, or Complete a booking request.
    Includes atomic locking and conflict prevention.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from datetime import datetime
        from django.db import transaction
        from .models import Booking, Listing
        from .serializers import BookingSerializer
        from .booking_logic import check_booking_conflict, calculate_booking_quote

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action', '').strip().lower()
        note = request.data.get('note', '').strip()
        adjusted_start_str = request.data.get('start_date')
        adjusted_end_str = request.data.get('end_date')

        if action not in ['accept', 'decline', 'complete']:
            return Response({'error': "Action must be 'accept', 'decline', or 'complete'."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Owner authorization check
            if booking.lender_id != profile.id:
                return Response(
                    {'error': 'Only the owner of this item can accept or decline this request.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            listing = Listing.objects.select_for_update().get(pk=booking.listing_id)

            if action == 'accept':
                if booking.status == 'accepted':
                    return Response({'error': 'This booking has already been accepted.'}, status=status.HTTP_400_BAD_REQUEST)
                if booking.status in ['declined', 'cancelled']:
                    return Response({'error': f'Cannot accept a booking that is {booking.status}.'}, status=status.HTTP_400_BAD_REQUEST)

                # Check if dates are being adjusted
                if adjusted_start_str:
                    try:
                        from datetime import date
                        new_start = datetime.strptime(adjusted_start_str, '%Y-%m-%d').date()
                        new_end = datetime.strptime(adjusted_end_str, '%Y-%m-%d').date() if adjusted_end_str else booking.end_date
                        if new_start < date.today():
                            return Response({'error': 'Adjusted start date cannot be in the past.'}, status=status.HTTP_400_BAD_REQUEST)
                        if new_end and new_end < new_start:
                            return Response({'error': 'Adjusted end date cannot be before start date.'}, status=status.HTTP_400_BAD_REQUEST)
                        booking.start_date = new_start
                        booking.end_date = new_end
                        # Recalculate quote with adjusted dates
                        quote = calculate_booking_quote(listing, booking.start_date, booking.end_date)
                        booking.duration_days = quote['duration_days']
                        booking.calculated_total_rent = quote['total_rent']
                        booking.total_due_upfront = quote['total_due_upfront']
                    except ValueError:
                        return Response({'error': 'Invalid date format. Expected YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

                # Enforce conflict check under lock
                conflict_err = check_booking_conflict(
                    listing=listing,
                    start_date=booking.start_date,
                    end_date=booking.end_date,
                    exclude_booking_id=booking.id
                )
                if conflict_err:
                    return Response({'error': conflict_err}, status=status.HTTP_400_BAD_REQUEST)

                booking.record_status_change('accepted', actor_id=profile.id, note=note or 'Owner accepted booking')
                booking.owner_response_note = note

                # If rental, set terms agreement status awaiting mutual review
                if booking.booking_type in ['rent', 'lend']:
                    booking.terms_status = 'pending_review'
                    booking.terms_agreed_by_lender = False
                    booking.terms_agreed_by_borrower = False
                    if booking.proposed_rent_rate is None:
                        booking.proposed_rent_rate = booking.snapshot_price
                    if booking.proposed_pricing_unit is None:
                        booking.proposed_pricing_unit = booking.snapshot_pricing_unit
                    if booking.proposed_deposit_amount is None:
                        booking.proposed_deposit_amount = booking.snapshot_deposit_amount

                # If item is sold, update listing availability
                if booking.booking_type == 'buy':
                    listing.status = 'rented'
                    listing.is_available = False
                    listing.save(update_fields=['status', 'is_available', 'updated_at'])

                booking.save()
                from .notification_service import notify_booking_accepted
                notify_booking_accepted(booking)

            elif action == 'decline':
                if booking.status in ['completed']:
                    return Response({'error': 'Cannot decline a completed booking.'}, status=status.HTTP_400_BAD_REQUEST)

                was_accepted = (booking.status == 'accepted')
                booking.record_status_change('declined', actor_id=profile.id, note=note or 'Owner declined request')
                booking.owner_response_note = note
                booking.save()
                from .notification_service import notify_booking_declined
                notify_booking_declined(booking, note=note)

                # Release listing availability if it was marked unavailable
                if was_accepted and booking.booking_type == 'buy':
                    listing.status = 'active'
                    listing.is_available = True
                    listing.save(update_fields=['status', 'is_available', 'updated_at'])

            elif action == 'complete':
                from .financial_logic import check_order_closure_eligibility
                eligible, err_msg = check_order_closure_eligibility(booking)
                if not eligible:
                    return Response({'error': err_msg}, status=status.HTTP_400_BAD_REQUEST)

                booking.record_status_change('completed', actor_id=profile.id, note=note or 'Booking marked completed')
                booking.owner_response_note = note
                booking.relist_prompted = True
                booking.save()

                # Do not automatically reactivate listing; wait for lender's explicit re-listing choice
                if booking.booking_type in ['rent', 'lend']:
                    listing.is_available = False
                    listing.status = 'unavailable'
                    listing.save(update_fields=['status', 'is_available', 'updated_at'])

            return Response({
                'message': f"Booking successfully {action}ed.",
                'booking': BookingSerializer(booking).data
            })


class BookingCancelView(APIView):
    """
    Borrower cancellation of a booking request.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.db import transaction
        from .models import Booking, Listing
        from .serializers import BookingSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        note = request.data.get('note', '').strip()

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Only borrower or lender can cancel
            if booking.borrower_id != profile.id and booking.lender_id != profile.id:
                return Response({'error': 'You do not have permission to cancel this booking.'}, status=status.HTTP_403_FORBIDDEN)

            if booking.status not in ['pending', 'accepted']:
                return Response(
                    {'error': f'Cannot cancel a booking with status "{booking.status}". Only pending or accepted bookings can be cancelled before handover.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            was_accepted = (booking.status == 'accepted')
            booking.record_status_change('cancelled', actor_id=profile.id, note=note or 'Booking cancelled')
            booking.save()
            from .notification_service import notify_booking_cancelled
            notify_booking_cancelled(booking, cancelled_by=profile)

            if was_accepted and booking.booking_type == 'buy':
                listing = Listing.objects.select_for_update().get(pk=booking.listing_id)
                listing.status = 'active'
                listing.is_available = True
                listing.save(update_fields=['status', 'is_available', 'updated_at'])

            return Response({
                'message': 'Booking has been cancelled.',
                'booking': BookingSerializer(booking).data
            })


# ========================================================
# QR HANDOVER & RETURN VERIFICATION VIEWS (Stage 7)
# ========================================================

class BookingGenerateQRView(APIView):
    """
    Generate a cryptographically secure, single-use, short-lived QR token for item pickup or return.
    - Pickup QR is generated and presented by the Lender.
    - Return QR is generated and presented by the Borrower.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'qr_handover'

    def post(self, request, pk):
        import secrets
        import hashlib
        from datetime import timedelta
        from django.utils import timezone
        from django.db import transaction
        from .models import Booking, HandoverToken
        from .serializers import HandoverQRGenerateSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = HandoverQRGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action_type = serializer.validated_data['action_type']

        try:
            booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if action_type == 'pickup':
            if booking.lender_id != profile.id:
                return Response(
                    {'error': 'Only the item owner/lender can generate the pickup QR code.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if booking.status != 'accepted':
                if booking.status in ['active', 'returned', 'completed']:
                    return Response(
                        {'error': f'Cannot generate pickup QR: Booking is already {booking.status}.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                return Response(
                    {'error': f'Cannot generate pickup QR: Booking status is {booking.status}. It must be accepted first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check financial prerequisites before pickup handover
            from .financial_logic import check_payment_prerequisites_for_pickup
            can_proceed, prereq_err = check_payment_prerequisites_for_pickup(booking)
            if not can_proceed:
                return Response(
                    {'error': prereq_err},
                    status=status.HTTP_400_BAD_REQUEST
                )

            target_scanner = booking.borrower

        elif action_type == 'return':
            if booking.borrower_id != profile.id:
                return Response(
                    {'error': 'Only the borrower can generate the return QR code.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if booking.status != 'active':
                return Response(
                    {'error': f'Cannot generate return QR: Booking is in {booking.status} state. It must be active/in-progress.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if booking.booking_type == 'buy':
                return Response(
                    {'error': 'Sale/purchase transactions do not have a return handover.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            target_scanner = booking.lender

        # Cryptographically secure random tokens
        raw_token = secrets.token_urlsafe(32)
        manual_code = ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        code_hash = hashlib.sha256(manual_code.upper().encode('utf-8')).hexdigest()
        expires_at = timezone.now() + timedelta(minutes=15)

        with transaction.atomic():
            # Revoke previous unused tokens for this booking and action
            HandoverToken.objects.filter(
                booking=booking,
                action_type=action_type,
                is_used=False
            ).update(is_revoked=True)

            HandoverToken.objects.create(
                booking=booking,
                action_type=action_type,
                presenter=profile,
                authorized_scanner=target_scanner,
                token_hash=token_hash,
                verification_code_hash=code_hash,
                expires_at=expires_at,
            )

        qr_payload = f"campusshare:handover?booking_id={booking.id}&action={action_type}&token={raw_token}"

        return Response({
            'booking_id': booking.id,
            'action_type': action_type,
            'raw_token': raw_token,
            'verification_code': manual_code,
            'expires_at': expires_at.isoformat(),
            'qr_payload': qr_payload,
        })


class BookingVerifyHandoverView(APIView):
    """
    Verify and consume a QR token or manual code to confirm pickup or return.
    - Borrower scans lender's pickup QR -> confirms pickup, moves to 'active' (or 'completed' if buy).
    - Lender scans borrower's return QR -> confirms return, moves to 'returned'.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'qr_handover'

    def post(self, request, pk):
        import hashlib
        from urllib.parse import parse_qs
        from django.utils import timezone
        from django.db import transaction
        from django.db.models import Q
        from .models import Booking, Listing, HandoverToken
        from .serializers import BookingSerializer, HandoverQRVerifySerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = HandoverQRVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action_type = serializer.validated_data['action_type']
        raw_input = serializer.validated_data['token'].strip()

        # If payload is a full URI (e.g. campusshare:handover?... or http://...), extract the token
        token_str = raw_input
        if 'token=' in raw_input:
            if '?' in raw_input:
                qs = raw_input.split('?', 1)[1]
                params = parse_qs(qs)
                if 'token' in params and params['token']:
                    token_str = params['token'][0].strip()

        input_hash = hashlib.sha256(token_str.encode('utf-8')).hexdigest()
        code_hash = hashlib.sha256(token_str.upper().encode('utf-8')).hexdigest()

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

            listing = Listing.objects.select_for_update().get(pk=booking.listing_id)

            # 1. Participant and Role checks
            if action_type == 'pickup':
                if profile.id == booking.lender_id:
                    return Response(
                        {'error': 'You cannot confirm your own pickup QR code. The borrower must scan this code.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                if profile.id != booking.borrower_id:
                    return Response(
                        {'error': 'Unauthorized: Only the assigned borrower can confirm pickup for this booking.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                if booking.status == 'active':
                    return Response({'error': 'Item pickup has already been confirmed.'}, status=status.HTTP_400_BAD_REQUEST)
                if booking.status in ['completed', 'returned']:
                    return Response({'error': f'Booking is already {booking.status}.'}, status=status.HTTP_400_BAD_REQUEST)
                if booking.status != 'accepted':
                    return Response(
                        {'error': f'Cannot confirm pickup: Booking status is {booking.status} (must be accepted).'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                from .financial_logic import check_payment_prerequisites_for_pickup
                can_proceed, prereq_err = check_payment_prerequisites_for_pickup(booking)
                if not can_proceed:
                    return Response(
                        {'error': prereq_err},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            elif action_type == 'return':
                if profile.id == booking.borrower_id:
                    return Response(
                        {'error': 'You cannot confirm your own return QR code. The owner/lender must scan this code.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                if profile.id != booking.lender_id:
                    return Response(
                        {'error': 'Unauthorized: Only the item lender can confirm item return.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                if booking.status == 'returned':
                    return Response({'error': 'Item return has already been confirmed.'}, status=status.HTTP_400_BAD_REQUEST)
                if booking.status != 'active':
                    return Response(
                        {'error': f'Cannot confirm return: Booking status is {booking.status} (must be active).'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # 2. Find matching HandoverToken
            token_obj = HandoverToken.objects.select_for_update().filter(
                booking=booking,
                action_type=action_type,
                is_revoked=False
            ).filter(
                Q(token_hash=input_hash) | Q(verification_code_hash=code_hash)
            ).first()

            if not token_obj:
                booking.record_status_change(
                    booking.status,
                    actor_id=profile.id,
                    note=f"Failed {action_type} scan: Invalid or unrecognized QR token"
                )
                booking.save()
                return Response(
                    {'error': 'Invalid or unrecognized QR token / verification code.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 3. Check if already consumed (replay prevention)
            if token_obj.is_used:
                booking.record_status_change(
                    booking.status,
                    actor_id=profile.id,
                    note=f"Failed {action_type} scan: Replay attempt with already consumed token"
                )
                booking.save()
                return Response(
                    {'error': 'This QR code has already been used. Replay scans are rejected.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 4. Check expiration
            if timezone.now() > token_obj.expires_at:
                booking.record_status_change(
                    booking.status,
                    actor_id=profile.id,
                    note=f"Failed {action_type} scan: Expired token"
                )
                booking.save()
                return Response(
                    {'error': 'This QR code has expired. Please ask for a newly generated QR code.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 5. Consume token
            now = timezone.now()
            token_obj.is_used = True
            token_obj.used_at = now
            token_obj.used_by = profile
            token_obj.save(update_fields=['is_used', 'used_at', 'used_by'])

            # 6. Transition booking state
            if action_type == 'pickup':
                booking.pickup_confirmed_at = now
                if booking.booking_type == 'buy':
                    booking.record_status_change(
                        'completed',
                        actor_id=profile.id,
                        note='Purchase item handover confirmed via QR verification'
                    )
                    listing.status = 'rented'
                    listing.is_available = False
                    listing.save(update_fields=['status', 'is_available', 'updated_at'])
                else:
                    booking.record_status_change(
                        'active',
                        actor_id=profile.id,
                        note='Rental item pickup confirmed via QR verification'
                    )
                    listing.status = 'rented'
                    listing.is_available = False
                    listing.save(update_fields=['status', 'is_available', 'updated_at'])

            elif action_type == 'return':
                booking.return_confirmed_at = now
                booking.record_status_change(
                    'returned',
                    actor_id=profile.id,
                    note='Rental item return confirmed via QR verification'
                )

                # Dynamic rent and actual duration calculation (Section 3)
                from .duration_rent_service import calculate_actual_rental_terms
                duration_terms = calculate_actual_rental_terms(booking, custom_return_time=now)
                booking.actual_rent_calculated = Decimal(duration_terms['final_calculated_rent'])
                booking.actual_duration_display = duration_terms['actual_duration_display']

                # Lender Re-listing Choice (Section 9): Keep listing unavailable until lender explicitly chooses
                listing.status = 'unavailable'
                listing.is_available = False
                listing.save(update_fields=['status', 'is_available', 'updated_at'])

                booking.relist_prompted = True
                booking.settlement_status = 'settlement_proposed'

            booking.save()

            # Dynamic trust score update after verified return
            if action_type == 'return':
                from .trust_score_service import calculate_and_update_trust_score
                calculate_and_update_trust_score(booking.borrower)
                calculate_and_update_trust_score(booking.lender)

            from .notification_service import notify_handover_verified
            notify_handover_verified(booking, action_type=action_type, verified_by=profile)

            return Response({
                'message': f"Item {action_type} verified and confirmed successfully!",
                'booking': BookingSerializer(booking).data,
            })


# ========================================================
# WANTED-ITEM REQUEST VIEWS (Stage 6)
# ========================================================

class WantedItemRequestListView(APIView):
    """
    List open campus wanted-item requests or submit a new wanted request.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get(self, request):
        from .models import WantedItemRequest
        from .serializers import WantedItemRequestSerializer

        queryset = WantedItemRequest.objects.filter(
            status='open'
        ).select_related(
            'requester', 'college', 'category', 'requester__college'
        ).prefetch_related('responses')

        # Filters
        search_query = request.query_params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(title__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(notes__icontains=search_query)
            )

        category_slug = request.query_params.get('category', '').strip()
        if category_slug and category_slug != 'all':
            queryset = queryset.filter(category__slug=category_slug)

        college_id = request.query_params.get('college_id', '').strip()
        college_ids_param = request.query_params.get('college_ids', '').strip()
        if college_ids_param:
            try:
                cids = [int(c.strip()) for c in college_ids_param.split(',') if c.strip().isdigit()]
                if cids:
                    queryset = queryset.filter(college_id__in=cids)
            except ValueError:
                pass
        elif college_id and college_id.isdigit():
            queryset = queryset.filter(college_id=int(college_id))

        request_type = request.query_params.get('request_type', '').strip().lower()
        if request_type and request_type != 'all':
            queryset = queryset.filter(request_type=request_type)

        serializer = WantedItemRequestSerializer(queryset, many=True, context={'request': request})
        return Response({
            'count': queryset.count(),
            'requests': serializer.data,
        })

    def post(self, request):
        from .serializers import WantedItemRequestSerializer, WantedItemRequestWriteSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'A student profile is required.'}, status=status.HTTP_403_FORBIDDEN)

        if not profile.is_email_verified:
            return Response(
                {'error': 'You must verify your college email address before posting requests.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = WantedItemRequestWriteSerializer(data=request.data)
        if serializer.is_valid():
            college = serializer.validated_data.get('college') or profile.college
            item_request = serializer.save(
                requester=profile,
                college=college,
                status='open'
            )
            return Response(
                WantedItemRequestSerializer(item_request, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WantedItemRequestDetailView(APIView):
    """
    Retrieve, edit, or close a wanted-item request.
    """
    def get_permissions(self):
        if self.request.method in ['PATCH', 'DELETE']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get(self, request, pk):
        from .models import WantedItemRequest
        from .serializers import WantedItemRequestSerializer

        try:
            item_request = WantedItemRequest.objects.select_related(
                'requester', 'college', 'category', 'requester__college'
            ).prefetch_related('responses').get(pk=pk)
        except WantedItemRequest.DoesNotExist:
            return Response({'error': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = WantedItemRequestSerializer(item_request, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, pk):
        from .models import WantedItemRequest
        from .serializers import WantedItemRequestSerializer, WantedItemRequestWriteSerializer

        profile = getattr(request.user, 'profile', None)
        try:
            item_request = WantedItemRequest.objects.get(pk=pk)
        except WantedItemRequest.DoesNotExist:
            return Response({'error': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not profile or item_request.requester_id != profile.id:
            return Response({'error': 'Only the requester can modify this request.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = WantedItemRequestWriteSerializer(item_request, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(WantedItemRequestSerializer(updated, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        from .models import WantedItemRequest

        profile = getattr(request.user, 'profile', None)
        try:
            item_request = WantedItemRequest.objects.get(pk=pk)
        except WantedItemRequest.DoesNotExist:
            return Response({'error': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not profile or item_request.requester_id != profile.id:
            return Response({'error': 'Only the requester can delete this request.'}, status=status.HTTP_403_FORBIDDEN)

        item_request.status = 'cancelled'
        item_request.save(update_fields=['status', 'updated_at'])
        return Response({'message': 'Request marked cancelled.'})


class WantedItemResponseView(APIView):
    """
    Respond to a student's wanted item request offering an item.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .models import WantedItemRequest, WantedItemResponse, Listing
        from .serializers import WantedItemResponseSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            item_request = WantedItemRequest.objects.get(pk=pk, status='open')
        except WantedItemRequest.DoesNotExist:
            return Response({'error': 'Open request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if item_request.requester_id == profile.id:
            return Response({'error': 'You cannot respond to your own wanted request.'}, status=status.HTTP_400_BAD_REQUEST)

        message = request.data.get('message', '').strip()
        if not message:
            return Response({'errors': {'message': 'Please provide a message explaining what you can offer.'}}, status=status.HTTP_400_BAD_REQUEST)

        offered_price = request.data.get('offered_price')
        parsed_price = None
        if offered_price is not None and str(offered_price).strip() != '':
            try:
                parsed_price = Decimal(str(offered_price).strip())
                if parsed_price < Decimal('0.00'):
                    return Response({'errors': {'offered_price': 'Offered price cannot be negative.'}}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                return Response({'errors': {'offered_price': 'Invalid offered price format.'}}, status=status.HTTP_400_BAD_REQUEST)

        listing_id = request.data.get('listing_id')

        listing = None
        if listing_id:
            try:
                listing = Listing.objects.get(pk=listing_id, lender=profile, is_visible=True)
            except Listing.DoesNotExist:
                listing = None

        response_obj = WantedItemResponse.objects.create(
            request=item_request,
            responder=profile,
            listing=listing,
            message=message,
            offered_price=parsed_price,
            status='pending'
        )

        from .notification_service import notify_wanted_response
        notify_wanted_response(response_obj)

        return Response(
            WantedItemResponseSerializer(response_obj).data,
            status=status.HTTP_201_CREATED
        )


class WantedItemResponseActionView(APIView):
    """
    Requester accepts/marks interest or declines a response to their request.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .models import WantedItemResponse
        from .serializers import WantedItemResponseSerializer

        profile = getattr(request.user, 'profile', None)
        try:
            response_obj = WantedItemResponse.objects.select_related('request').get(pk=pk)
        except WantedItemResponse.DoesNotExist:
            return Response({'error': 'Response not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not profile or response_obj.request.requester_id != profile.id:
            return Response({'error': 'Only the requester can take action on this response.'}, status=status.HTTP_403_FORBIDDEN)

        action = request.data.get('action', '').strip().lower()
        if action not in ['interested', 'declined']:
            return Response({'error': "Action must be 'interested' or 'declined'."}, status=status.HTTP_400_BAD_REQUEST)

        response_obj.status = action
        response_obj.save(update_fields=['status'])

        from .notification_service import notify_wanted_response_status
        notify_wanted_response_status(response_obj, new_status=action, actor=profile)

        return Response({
            'message': f"Response status updated to {action}.",
            'response': WantedItemResponseSerializer(response_obj).data
        })


# ========================================================
# FINANCIAL RECORDS & DIRECT PAYMENT TRACKING (Stage 8)
# CampusShare never collects, holds, or moves money.
# All payments and refunds occur directly between students.
# ========================================================

class BookingFinancialsView(APIView):
    """
    Retrieve comprehensive financial records, payment declarations,
    adjustments, and refund status for an authorized booking.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from .models import Booking
        from .serializers import (
            PaymentRecordSerializer,
            SettlementAdjustmentSerializer,
            DepositRefundSerializer,
        )
        from .financial_logic import get_booking_financial_summary

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related(
                'listing', 'listing__college', 'borrower', 'lender'
            ).get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id not in [booking.borrower_id, booking.lender_id]:
            return Response(
                {'error': 'You do not have permission to view financial records for this booking.'},
                status=status.HTTP_403_FORBIDDEN
            )

        summary = get_booking_financial_summary(booking)
        payments = booking.payments.select_related(
            'payer', 'recipient', 'confirmed_by', 'disputed_by'
        ).order_by('-created_at')
        adjustments = booking.adjustments.select_related(
            'proposed_by', 'resolved_by'
        ).order_by('-created_at')
        deposit_refund = getattr(booking, 'deposit_refund', None)

        return Response({
            'booking_id': booking.id,
            'is_lender': profile.id == booking.lender_id,
            'is_borrower': profile.id == booking.borrower_id,
            'summary': summary,
            'payments': PaymentRecordSerializer(payments, many=True).data,
            'adjustments': SettlementAdjustmentSerializer(adjustments, many=True).data,
            'deposit_refund': DepositRefundSerializer(deposit_refund).data if deposit_refund else None,
        })


class PaymentDeclareView(APIView):
    """
    Borrower (or payer) declares a direct payment (rent, deposit, or agreed adjustment).
    This records the declaration; the recipient must confirm receipt.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.db import transaction
        from .models import Booking, PaymentRecord
        from .serializers import PaymentDeclareSerializer, PaymentRecordSerializer
        from .financial_logic import get_booking_financial_summary

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PaymentDeclareSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

            if profile.id not in [booking.borrower_id, booking.lender_id]:
                return Response(
                    {'error': 'You are not a participant in this transaction.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if booking.status in ['declined', 'cancelled']:
                return Response(
                    {'error': f'Cannot declare payment for a {booking.status} booking.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            purpose = serializer.validated_data['purpose']
            amount = serializer.validated_data['amount']
            payment_method = serializer.validated_data['payment_method']
            transaction_ref = serializer.validated_data.get('transaction_reference', '').strip()
            evidence_url = serializer.validated_data.get('evidence_url', '').strip()
            payer_notes = serializer.validated_data.get('payer_notes', '').strip()
            confirm_as_recipient = serializer.validated_data.get('confirm_as_recipient', False)

            if purpose == 'deposit':
                existing_confirmed = booking.payments.filter(purpose='deposit', status='confirmed').first()
                if existing_confirmed:
                    return Response({
                        'message': 'Advance payment is already confirmed for this booking.',
                        'payment': PaymentRecordSerializer(existing_confirmed).data,
                        'summary': get_booking_financial_summary(booking),
                    }, status=status.HTTP_200_OK)

                existing_declared = booking.payments.filter(purpose='deposit', status='declared').first()
                if existing_declared and confirm_as_recipient and profile.id == booking.lender_id:
                    from django.utils import timezone
                    existing_declared.status = 'confirmed'
                    existing_declared.confirmed_at = timezone.now()
                    existing_declared.confirmed_by = profile
                    existing_declared.payment_method = payment_method
                    existing_declared.amount = amount
                    existing_declared.save(update_fields=['status', 'confirmed_at', 'confirmed_by', 'payment_method', 'amount', 'updated_at'])
                    booking.record_status_change(
                        booking.status,
                        actor_id=profile.id,
                        note=f"Lender confirmed direct receipt of Rs. {amount} (deposit) from borrower via {payment_method}"
                    )
                    booking.save(update_fields=['status_history', 'updated_at'])
                    from .notification_service import notify_payment_confirmed
                    notify_payment_confirmed(existing_declared)
                    return Response({
                        'message': 'Payment confirmed directly by recipient.',
                        'payment': PaymentRecordSerializer(existing_declared).data,
                        'summary': get_booking_financial_summary(booking),
                    }, status=status.HTTP_200_OK)
            if confirm_as_recipient and profile.id == booking.lender_id:
                from django.utils import timezone
                payer = booking.borrower
                recipient = profile
                status_val = 'confirmed'
                confirmed_at_val = timezone.now()
                confirmed_by_val = profile
                note_text = f"Lender confirmed direct receipt of Rs. {amount} ({purpose}) from borrower via {payment_method}"
            else:
                payer = profile
                recipient = booking.lender if profile.id == booking.borrower_id else booking.borrower
                status_val = 'declared'
                confirmed_at_val = None
                confirmed_by_val = None
                note_text = f"Payment declaration recorded: Rs. {amount} for {purpose} via {payment_method}"

            payment = PaymentRecord.objects.create(
                booking=booking,
                payer=payer,
                recipient=recipient,
                purpose=purpose,
                amount=amount,
                currency=booking.currency or 'INR',
                payment_method=payment_method,
                status=status_val,
                confirmed_at=confirmed_at_val,
                confirmed_by=confirmed_by_val,
                transaction_reference=transaction_ref,
                evidence_url=evidence_url,
                payer_notes=payer_notes,
            )

            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=note_text
            )
            booking.save(update_fields=['status_history', 'updated_at'])

        if status_val == 'confirmed':
            from .notification_service import notify_payment_confirmed
            notify_payment_confirmed(payment)
        else:
            from .notification_service import notify_payment_declared
            notify_payment_declared(payment)

        return Response({
            'message': 'Payment declaration submitted. Awaiting recipient confirmation.',
            'payment': PaymentRecordSerializer(payment).data,
            'summary': get_booking_financial_summary(booking),
        }, status=status.HTTP_201_CREATED)


class PaymentConfirmView(APIView):
    """
    Recipient confirms that they received the declared payment.
    Enforces authorization: only the designated recipient can confirm.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.utils import timezone
        from django.db import transaction
        from .models import PaymentRecord, Booking
        from .serializers import PaymentRecordSerializer
        from .financial_logic import get_booking_financial_summary

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            try:
                payment = PaymentRecord.objects.select_for_update().get(pk=pk)
            except PaymentRecord.DoesNotExist:
                return Response({'error': 'Payment record not found.'}, status=status.HTTP_404_NOT_FOUND)

            if payment.recipient_id != profile.id:
                return Response(
                    {'error': 'Only the designated recipient can confirm receipt of this payment.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if payment.status == 'confirmed':
                return Response({'error': 'This payment has already been confirmed.'}, status=status.HTTP_400_BAD_REQUEST)

            if payment.status in ['cancelled']:
                return Response({'error': 'Cannot confirm a cancelled payment.'}, status=status.HTTP_400_BAD_REQUEST)

            now = timezone.now()
            payment.status = 'confirmed'
            payment.confirmed_at = now
            payment.confirmed_by = profile
            payment.save(update_fields=['status', 'confirmed_at', 'confirmed_by', 'updated_at'])

            booking = Booking.objects.select_for_update().get(pk=payment.booking_id)

            if payment.purpose == 'deposit':
                booking.payments.filter(purpose='deposit', status='declared').exclude(pk=payment.pk).update(
                    status='cancelled',
                    payer_notes='Automatically superseded by confirmed advance payment.'
                )
            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Recipient confirmed receipt of Rs. {payment.amount} ({payment.purpose})"
            )
            from .financial_logic import check_order_closure_eligibility
            eligible, _ = check_order_closure_eligibility(booking)
            if eligible and booking.status != 'completed':
                booking.record_status_change('completed', actor_id=profile.id, note="Order automatically completed: Required payment confirmed and all obligations settled.")
                booking.relist_prompted = True
                booking.save(update_fields=['status', 'status_history', 'relist_prompted', 'updated_at'])
            else:
                booking.save(update_fields=['status_history', 'updated_at'])

        from .notification_service import notify_payment_confirmed
        notify_payment_confirmed(payment)

        return Response({
            'message': 'Payment receipt confirmed successfully.',
            'payment': PaymentRecordSerializer(payment).data,
            'summary': get_booking_financial_summary(booking),
        })


class PaymentDisputeView(APIView):
    """
    Recipient disputes a declared payment.
    The disputed status is recorded and visible to both parties.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.utils import timezone
        from django.db import transaction
        from .models import PaymentRecord, Booking
        from .serializers import PaymentDisputeSerializer, PaymentRecordSerializer
        from .financial_logic import get_booking_financial_summary

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PaymentDisputeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        dispute_reason = serializer.validated_data['dispute_reason'].strip()

        with transaction.atomic():
            try:
                payment = PaymentRecord.objects.select_for_update().get(pk=pk)
            except PaymentRecord.DoesNotExist:
                return Response({'error': 'Payment record not found.'}, status=status.HTTP_404_NOT_FOUND)

            if payment.recipient_id != profile.id:
                return Response(
                    {'error': 'Only the designated recipient can dispute this payment.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if payment.status == 'confirmed':
                return Response({'error': 'Cannot dispute a payment that was already confirmed.'}, status=status.HTTP_400_BAD_REQUEST)

            now = timezone.now()
            payment.status = 'disputed'
            payment.disputed_at = now
            payment.disputed_by = profile
            payment.dispute_reason = dispute_reason
            payment.save(update_fields=['status', 'disputed_at', 'disputed_by', 'dispute_reason', 'updated_at'])

            booking = Booking.objects.select_for_update().get(pk=payment.booking_id)
            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Payment disputed for Rs. {payment.amount} ({payment.purpose}): {dispute_reason}"
            )
            booking.save(update_fields=['status_history', 'updated_at'])

        from .notification_service import notify_payment_disputed
        notify_payment_disputed(payment)

        return Response({
            'message': 'Payment discrepancy reported.',
            'payment': PaymentRecordSerializer(payment).data,
            'summary': get_booking_financial_summary(booking),
        })


class AdjustmentProposeView(APIView):
    """
    Propose an adjustment for late return, damage, or cleaning.
    Only authorized participants (usually lender) can propose.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.db import transaction
        from .models import Booking, SettlementAdjustment
        from .serializers import AdjustmentProposeSerializer, SettlementAdjustmentSerializer
        from .financial_logic import get_booking_financial_summary

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdjustmentProposeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

            if profile.id not in [booking.borrower_id, booking.lender_id]:
                return Response(
                    {'error': 'You are not a participant in this booking.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if booking.status not in ['active', 'returned', 'completed']:
                return Response(
                    {'error': f'Adjustments can only be proposed on active, returned, or completed bookings (current: {booking.status}).'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            adjustment = SettlementAdjustment.objects.create(
                booking=booking,
                adjustment_type=serializer.validated_data['adjustment_type'],
                amount=serializer.validated_data['amount'],
                reason=serializer.validated_data['reason'],
                description=serializer.validated_data.get('description', ''),
                proposed_by=profile,
                evidence_url=serializer.validated_data.get('evidence_url', ''),
                status='proposed',
            )

            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Adjustment proposed: Rs. {adjustment.amount} ({adjustment.adjustment_type}) - {adjustment.reason}"
            )
            booking.save(update_fields=['status_history', 'updated_at'])

        from .notification_service import notify_adjustment_proposed
        notify_adjustment_proposed(adjustment)

        return Response({
            'message': 'Adjustment proposal submitted. Awaiting review by the other party.',
            'adjustment': SettlementAdjustmentSerializer(adjustment).data,
            'summary': get_booking_financial_summary(booking),
        }, status=status.HTTP_201_CREATED)


class AdjustmentRespondView(APIView):
    """
    Accept or dispute a proposed adjustment.
    The proposing party cannot respond to their own adjustment proposal.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.utils import timezone
        from django.db import transaction
        from .models import SettlementAdjustment, Booking
        from .serializers import AdjustmentRespondSerializer, SettlementAdjustmentSerializer
        from .financial_logic import get_booking_financial_summary

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdjustmentRespondSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        response_note = serializer.validated_data.get('response_note', '').strip()

        with transaction.atomic():
            try:
                adj = SettlementAdjustment.objects.select_for_update().get(pk=pk)
            except SettlementAdjustment.DoesNotExist:
                return Response({'error': 'Adjustment not found.'}, status=status.HTTP_404_NOT_FOUND)

            booking = Booking.objects.select_for_update().get(pk=adj.booking_id)

            if profile.id not in [booking.borrower_id, booking.lender_id]:
                return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

            if adj.proposed_by_id == profile.id:
                return Response({'error': 'You cannot accept or dispute your own adjustment proposal.'}, status=status.HTTP_400_BAD_REQUEST)

            if adj.status != 'proposed':
                return Response({'error': f'This adjustment has already been {adj.status}.'}, status=status.HTTP_400_BAD_REQUEST)

            now = timezone.now()
            adj.status = 'accepted' if action == 'accept' else 'disputed'
            adj.resolved_at = now
            adj.resolved_by = profile
            adj.response_note = response_note
            adj.save(update_fields=['status', 'resolved_at', 'resolved_by', 'response_note', 'updated_at'])

            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Adjustment {action}ed: Rs. {adj.amount} ({adj.adjustment_type})"
            )
            booking.save(update_fields=['status_history', 'updated_at'])

        from .notification_service import notify_adjustment_resolved
        notify_adjustment_resolved(adj, resolution=action, actor=profile)

        return Response({
            'message': f"Adjustment successfully {action}ed.",
            'adjustment': SettlementAdjustmentSerializer(adj).data,
            'summary': get_booking_financial_summary(booking),
        })


class DepositRefundDeclareView(APIView):
    """
    Lender declares that they have made the direct deposit refund to the borrower.
    Only lender can declare deposit refund, and only after item return is confirmed.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from decimal import Decimal
        from django.utils import timezone
        from django.db import transaction
        from .models import Booking, DepositRefund
        from .serializers import RefundDeclareSerializer, DepositRefundSerializer
        from .financial_logic import get_booking_financial_summary

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RefundDeclareSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

            if booking.lender_id != profile.id:
                return Response({'error': 'Only the lender can declare a deposit refund.'}, status=status.HTTP_403_FORBIDDEN)

            if booking.status not in ['returned', 'completed']:
                return Response(
                    {'error': f'Deposit refund can only be declared after the item has been returned (current: {booking.status}).'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            deposit_amount = booking.snapshot_deposit_amount or Decimal('0.00')
            if deposit_amount <= Decimal('0.00'):
                return Response({'error': 'This booking has no refundable security deposit.'}, status=status.HTTP_400_BAD_REQUEST)

            # Calculate approved deductions
            approved_deductions = Decimal('0.00')
            for a in booking.adjustments.filter(status='accepted'):
                approved_deductions += (a.amount or Decimal('0.00'))

            net_refund = max(deposit_amount - approved_deductions, Decimal('0.00'))
            now = timezone.now()

            refund, created = DepositRefund.objects.get_or_create(
                booking=booking,
                defaults={
                    'original_deposit': deposit_amount,
                    'approved_deductions': approved_deductions,
                    'net_refund_amount': net_refund,
                    'refund_method': serializer.validated_data['refund_method'],
                    'transaction_reference': serializer.validated_data.get('transaction_reference', ''),
                    'evidence_url': serializer.validated_data.get('evidence_url', ''),
                    'notes': serializer.validated_data.get('notes', ''),
                    'status': 'declared',
                    'declared_at': now,
                    'declared_by': profile,
                }
            )

            if not created:
                refund.original_deposit = deposit_amount
                refund.approved_deductions = approved_deductions
                refund.net_refund_amount = net_refund
                refund.refund_method = serializer.validated_data['refund_method']
                refund.transaction_reference = serializer.validated_data.get('transaction_reference', '')
                refund.evidence_url = serializer.validated_data.get('evidence_url', '')
                refund.notes = serializer.validated_data.get('notes', '')
                refund.status = 'declared'
                refund.declared_at = now
                refund.declared_by = profile
                refund.save()

            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Lender declared deposit refund: Net Rs. {net_refund} via {refund.refund_method}"
            )
            booking.save(update_fields=['status_history', 'updated_at'])

        from .notification_service import notify_refund_declared
        notify_refund_declared(refund)

        return Response({
            'message': 'Deposit refund declaration recorded. Awaiting borrower confirmation.',
            'deposit_refund': DepositRefundSerializer(refund).data,
            'summary': get_booking_financial_summary(booking),
        })


class DepositRefundConfirmView(APIView):
    """
    Borrower confirms receipt of deposit refund, or disputes the refund.
    Only borrower can confirm or dispute refund receipt.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.utils import timezone
        from django.db import transaction
        from .models import Booking, DepositRefund
        from .serializers import DepositRefundSerializer
        from .financial_logic import get_booking_financial_summary

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action', '').strip().lower()
        dispute_reason = request.data.get('dispute_reason', '').strip()

        if action not in ['confirm', 'dispute']:
            return Response({'error': "Action must be 'confirm' or 'dispute'."}, status=status.HTTP_400_BAD_REQUEST)

        if action == 'dispute' and len(dispute_reason) < 3:
            return Response({'error': 'Please provide a clear reason for disputing this refund.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

            if booking.borrower_id != profile.id:
                return Response({'error': 'Only the borrower can confirm or dispute the deposit refund.'}, status=status.HTTP_403_FORBIDDEN)

            try:
                refund = DepositRefund.objects.select_for_update().get(booking=booking)
            except DepositRefund.DoesNotExist:
                return Response({'error': 'No refund declaration exists for this booking.'}, status=status.HTTP_404_NOT_FOUND)

            now = timezone.now()
            if action == 'confirm':
                refund.status = 'confirmed'
                refund.confirmed_at = now
                refund.confirmed_by = profile
                refund.save(update_fields=['status', 'confirmed_at', 'confirmed_by', 'updated_at'])

                booking.record_status_change(
                    booking.status,
                    actor_id=profile.id,
                    note=f"Borrower confirmed receipt of deposit refund (Rs. {refund.net_refund_amount})"
                )
            else:
                refund.status = 'disputed'
                refund.disputed_at = now
                refund.disputed_by = profile
                refund.dispute_reason = dispute_reason
                refund.save(update_fields=['status', 'disputed_at', 'disputed_by', 'dispute_reason', 'updated_at'])

            if action == 'confirm':
                from .financial_logic import check_order_closure_eligibility
                eligible, _ = check_order_closure_eligibility(booking)
                if eligible and booking.status != 'completed':
                    booking.record_status_change('completed', actor_id=profile.id, note="Order automatically completed: Deposit refund confirmed and all obligations settled.")
                    booking.relist_prompted = True
                    booking.save(update_fields=['status', 'status_history', 'relist_prompted', 'updated_at'])
                else:
                    booking.save(update_fields=['status_history', 'updated_at'])
            else:
                booking.save(update_fields=['status_history', 'updated_at'])

        if action == 'confirm':
            from .notification_service import notify_refund_confirmed
            notify_refund_confirmed(refund)

        return Response({
            'message': f"Deposit refund {action}ed successfully.",
            'deposit_refund': DepositRefundSerializer(refund).data,
            'summary': get_booking_financial_summary(booking),
        })


class BookingSettlementBillView(APIView):
    """
    Generate the official platform-produced settlement bill and itemized transaction summary.
    Includes itemized breakdown, legal disclaimer, and audit timestamps.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from django.utils import timezone
        from .models import Booking
        from .serializers import (
            BookingSerializer,
            PaymentRecordSerializer,
            SettlementAdjustmentSerializer,
            DepositRefundSerializer,
        )
        from .financial_logic import get_booking_financial_summary

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related(
                'listing', 'listing__college', 'borrower', 'borrower__college', 'lender', 'lender__college'
            ).get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id not in [booking.borrower_id, booking.lender_id]:
            return Response({'error': 'Unauthorized to view this settlement bill.'}, status=status.HTTP_403_FORBIDDEN)

        summary = get_booking_financial_summary(booking)
        payments = booking.payments.select_related('payer', 'recipient', 'confirmed_by').order_by('created_at')
        adjustments = booking.adjustments.select_related('proposed_by', 'resolved_by').order_by('created_at')
        deposit_refund = getattr(booking, 'deposit_refund', None)

        return Response({
            'bill_number': summary['invoice_number'],
            'generated_at': timezone.now().isoformat(),
            'booking': BookingSerializer(booking).data,
            'financial_summary': summary,
            'payments': PaymentRecordSerializer(payments, many=True).data,
            'adjustments': SettlementAdjustmentSerializer(adjustments, many=True).data,
            'deposit_refund': DepositRefundSerializer(deposit_refund).data if deposit_refund else None,
            'disclaimer': summary['disclaimer'],
        })


class PaymentEvidenceUploadView(APIView):
    """
    Upload supporting payment proof or settlement evidence (receipt screenshot, UPI passbook note).
    Validates file format (JPEG, PNG, WebP, PDF) and max size (5MB).
    Explicitly marked as user-submitted, unverified evidence.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        proof = request.FILES.get('evidence') or request.FILES.get('file') or request.FILES.get('photo')
        if not proof:
            return Response(
                {'error': 'No file was provided in the upload request.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        content_type = proof.content_type or 'image/jpeg'
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        if content_type not in allowed_types:
            return Response(
                {'error': 'Allowed evidence formats are JPEG, PNG, WebP, and PDF.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if proof.size > 5 * 1024 * 1024:
            return Response(
                {'error': 'Maximum evidence file size is 5MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file_bytes = proof.read()
        public_url, err = ListingStorageService.upload_listing_photo(
            user_id=request.user.id,
            file_bytes=file_bytes,
            content_type=content_type,
            original_filename=proof.name,
        )

        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': 'Evidence uploaded successfully. Recorded as user-submitted, unverified evidence.',
            'evidence_url': public_url,
            'filename': proof.name,
            'is_verified': False,
        }, status=status.HTTP_201_CREATED)


# ========================================================
# STAGE 9: NOTIFICATIONS & MESSAGING VIEWS
# ========================================================

class NotificationListView(APIView):
    """
    List user notifications with unread filtering, unread badge count, and pagination.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import Notification
        from .serializers import NotificationSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        queryset = Notification.objects.filter(recipient=profile).select_related(
            'actor', 'actor__college', 'actor__user', 'listing', 'booking', 'wanted_request'
        )

        status_param = request.query_params.get('status', 'all').strip().lower()
        if status_param == 'unread':
            queryset = queryset.filter(is_read=False)

        unread_count = Notification.objects.filter(recipient=profile, is_read=False).count()
        total_count = queryset.count()

        try:
            page = max(int(request.query_params.get('page', 1)), 1)
        except ValueError:
            page = 1

        try:
            page_size = min(max(int(request.query_params.get('page_size', 20)), 1), 100)
        except ValueError:
            page_size = 20

        offset = (page - 1) * page_size
        notifications_page = queryset[offset:offset + page_size]

        serializer = NotificationSerializer(notifications_page, many=True, context={'request': request})
        return Response({
            'count': total_count,
            'unread_count': unread_count,
            'page': page,
            'page_size': page_size,
            'notifications': serializer.data,
        })


class NotificationMarkReadView(APIView):
    """
    Mark a single notification as read.
    Enforces authorization: only the recipient can mark their notification as read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .models import Notification
        from .serializers import NotificationSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            notification = Notification.objects.get(pk=pk, recipient=profile)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)

        notification.mark_as_read()
        unread_count = Notification.objects.filter(recipient=profile, is_read=False).count()

        return Response({
            'message': 'Notification marked as read.',
            'notification': NotificationSerializer(notification, context={'request': request}).data,
            'unread_count': unread_count,
        })


class NotificationMarkAllReadView(APIView):
    """
    Mark all unread notifications for the authenticated student as read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.utils import timezone
        from .models import Notification

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        updated_count = Notification.objects.filter(
            recipient=profile,
            is_read=False
        ).update(is_read=True, read_at=timezone.now())

        return Response({
            'message': f'Marked {updated_count} notification(s) as read.',
            'unread_count': 0,
        })


class UnreadCountsView(APIView):
    """
    Lightweight summary endpoint for polling unread badges (notifications + messages).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import Notification, Message

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        notifications_unread = Notification.objects.filter(recipient=profile, is_read=False).count()
        messages_unread = Message.objects.filter(
            is_read=False
        ).filter(
            Q(conversation__participant_1=profile) | Q(conversation__participant_2=profile)
        ).exclude(sender=profile).count()

        return Response({
            'notifications_unread': notifications_unread,
            'messages_unread': messages_unread,
            'total_unread': notifications_unread + messages_unread,
        })


class ConversationListView(APIView):
    """
    List user conversations or start a new context-bound conversation thread.
    Prevents unsolicited messaging by enforcing connection to an existing listing, booking, or wanted request.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import Conversation
        from .serializers import ConversationSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        queryset = Conversation.objects.filter(
            Q(participant_1=profile) | Q(participant_2=profile)
        ).select_related(
            'participant_1', 'participant_1__college', 'participant_1__user',
            'participant_2', 'participant_2__college', 'participant_2__user',
            'listing', 'booking', 'wanted_request'
        ).prefetch_related('messages').order_by('-last_message_at')

        serializer = ConversationSerializer(queryset, many=True, context={'request': request})
        return Response({
            'count': queryset.count(),
            'conversations': serializer.data,
        })

    def post(self, request):
        from django.utils import timezone
        from django.db import transaction
        from .models import Conversation, Message, Listing, Booking, WantedItemRequest
        from .serializers import ConversationStartSerializer, ConversationSerializer
        from .notification_service import notify_new_message

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ConversationStartSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        listing_id = serializer.validated_data.get('listing_id')
        booking_id = serializer.validated_data.get('booking_id')
        wanted_request_id = serializer.validated_data.get('wanted_request_id')
        initial_message = serializer.validated_data.get('initial_message', '').strip()

        target_listing = None
        target_booking = None
        target_wanted = None
        other_participant = None
        subject = ''

        if booking_id:
            try:
                target_booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=booking_id)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

            if profile.id not in [target_booking.borrower_id, target_booking.lender_id]:
                return Response({'error': 'You are not a participant in this booking.'}, status=status.HTTP_403_FORBIDDEN)

            other_participant = target_booking.lender if profile.id == target_booking.borrower_id else target_booking.borrower
            target_listing = target_booking.listing
            subject = f"Booking #{target_booking.id}: {target_booking.listing.title}"

        elif listing_id:
            try:
                target_listing = Listing.objects.select_related('lender').get(pk=listing_id)
            except Listing.DoesNotExist:
                return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

            if target_listing.lender_id == profile.id:
                return Response({'error': 'You cannot initiate a conversation with yourself about your own listing.'}, status=status.HTTP_400_BAD_REQUEST)

            other_participant = target_listing.lender
            subject = f"Listing: {target_listing.title}"

        elif wanted_request_id:
            try:
                target_wanted = WantedItemRequest.objects.select_related('requester').get(pk=wanted_request_id)
            except WantedItemRequest.DoesNotExist:
                return Response({'error': 'Wanted request not found.'}, status=status.HTTP_404_NOT_FOUND)

            if target_wanted.requester_id == profile.id:
                return Response({'error': 'You cannot initiate a conversation with yourself about your own wanted request.'}, status=status.HTTP_400_BAD_REQUEST)

            other_participant = target_wanted.requester
            subject = f"Wanted: {target_wanted.title}"

        else:
            return Response(
                {'error': 'A valid listing, booking, or wanted-item request reference is required to initiate a conversation.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            conv = Conversation.objects.filter(
                (Q(participant_1=profile, participant_2=other_participant) |
                 Q(participant_1=other_participant, participant_2=profile)),
                listing=target_listing,
                booking=target_booking,
                wanted_request=target_wanted
            ).first()

            created = False
            if not conv:
                conv = Conversation.objects.create(
                    participant_1=profile,
                    participant_2=other_participant,
                    listing=target_listing,
                    booking=target_booking,
                    wanted_request=target_wanted,
                    subject=subject,
                    last_message_at=timezone.now()
                )
                created = True

            if initial_message:
                msg = Message.objects.create(
                    conversation=conv,
                    sender=profile,
                    content=initial_message
                )
                conv.last_message_at = timezone.now()
                conv.save(update_fields=['last_message_at', 'updated_at'])
                notify_new_message(msg)

        return Response(
            ConversationSerializer(conv, context={'request': request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class ConversationDetailView(APIView):
    """
    Retrieve single conversation metadata.
    Enforces authorization: only conversation participants can view.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from .models import Conversation
        from .serializers import ConversationSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            conv = Conversation.objects.select_related(
                'participant_1', 'participant_1__college', 'participant_2', 'participant_2__college',
                'listing', 'booking', 'wanted_request'
            ).get(pk=pk)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not conv.is_participant(profile):
            return Response({'error': 'You do not have permission to view this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(ConversationSerializer(conv, context={'request': request}).data)


class ConversationMessagesView(APIView):
    """
    List messages in a conversation (and auto-mark received ones as read),
    or send a new message.
    Enforces authorization: only participants can read and write.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'messaging'

    def get(self, request, pk):
        from django.utils import timezone
        from .models import Conversation
        from .serializers import MessageSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            conv = Conversation.objects.get(pk=pk)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not conv.is_participant(profile):
            return Response({'error': 'You are not a participant in this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        # Auto-mark unread messages sent by the counterparty as read
        conv.messages.filter(is_read=False).exclude(sender=profile).update(
            is_read=True,
            read_at=timezone.now()
        )

        queryset = conv.messages.select_related('sender', 'sender__college', 'sender__user').order_by('created_at')

        try:
            page = max(int(request.query_params.get('page', 1)), 1)
        except ValueError:
            page = 1

        try:
            page_size = min(max(int(request.query_params.get('page_size', 50)), 1), 100)
        except ValueError:
            page_size = 50

        total_count = queryset.count()
        offset = (page - 1) * page_size
        messages_page = queryset[offset:offset + page_size]

        serializer = MessageSerializer(messages_page, many=True, context={'request': request})
        return Response({
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'conversation_id': conv.id,
            'messages': serializer.data,
        })

    def post(self, request, pk):
        from django.utils import timezone
        from django.db import transaction
        from .models import Conversation, Message
        from .serializers import MessageCreateSerializer, MessageSerializer
        from .notification_service import notify_new_message

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            conv = Conversation.objects.select_related('participant_1', 'participant_2').get(pk=pk)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not conv.is_participant(profile):
            return Response({'error': 'You are not a participant in this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = MessageCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        content = serializer.validated_data['content'].strip()

        with transaction.atomic():
            msg = Message.objects.create(
                conversation=conv,
                sender=profile,
                content=content
            )
            conv.last_message_at = timezone.now()
            conv.save(update_fields=['last_message_at', 'updated_at'])

        notify_new_message(msg)

        notify_new_message(msg)

        return Response(
            MessageSerializer(msg, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


# ========================================================
# ADVANCE PAYMENT NEGOTIATION VIEWS (Section 2)
# ========================================================

class BookingProposeAdvanceView(APIView):
    """
    Allow borrower or lender to propose a revised advance amount before pickup.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .serializers import AdvanceProposalSerializer, BookingSerializer
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id not in [booking.borrower_id, booking.lender_id]:
            return Response({'error': 'Unauthorized: Only booking participants can negotiate advance amount.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status not in ['pending', 'accepted']:
            return Response({'error': f'Cannot negotiate advance: Booking is already {booking.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AdvanceProposalSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        proposed_amt = serializer.validated_data['proposed_amount']
        reason = serializer.validated_data.get('reason', '').strip()

        booking.agreed_advance_amount = proposed_amt
        booking.advance_negotiation_status = 'proposed'
        booking.advance_proposal_notes = f"Proposed by {profile.full_name}: Rs. {proposed_amt}. Reason: {reason}"
        booking.record_status_change(
            booking.status,
            actor_id=profile.id,
            note=f"Proposed revised advance of Rs. {proposed_amt}. {reason}"
        )
        booking.save()

        # Notify counterparty
        recipient = booking.lender if profile.id == booking.borrower_id else booking.borrower
        from .models import Notification
        Notification.objects.create(
            recipient=recipient,
            actor=profile,
            notification_type='advance_proposed',
            title='Advance Payment Revision Proposed',
            message=f"{profile.full_name} proposed a revised advance of Rs. {proposed_amt} for '{booking.listing.title}'.",
            booking=booking,
            target_modal='financials',
            target_id=str(booking.id)
        )

        return Response({
            'message': f"Revised advance proposal of Rs. {proposed_amt} submitted successfully.",
            'booking': BookingSerializer(booking).data,
        })


class BookingRespondAdvanceView(APIView):
    """
    Accept or reject a proposed advance revision.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .serializers import AdvanceRespondSerializer, BookingSerializer
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id not in [booking.borrower_id, booking.lender_id]:
            return Response({'error': 'Unauthorized: Only booking participants can respond.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.advance_negotiation_status != 'proposed':
            return Response({'error': 'No pending advance proposal to respond to.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AdvanceRespondSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        response_note = serializer.validated_data.get('response_note', '').strip()

        recipient = booking.lender if profile.id == booking.borrower_id else booking.borrower
        from .models import Notification

        if action == 'accept':
            booking.advance_negotiation_status = 'agreed'
            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Accepted revised advance amount of Rs. {booking.agreed_advance_amount}. {response_note}"
            )
            booking.save()

            Notification.objects.create(
                recipient=recipient,
                actor=profile,
                notification_type='advance_confirmed',
                title='Advance Revision Accepted',
                message=f"{profile.full_name} accepted the revised advance of Rs. {booking.agreed_advance_amount} for '{booking.listing.title}'.",
                booking=booking,
                target_modal='financials',
                target_id=str(booking.id)
            )
            msg = f"Agreed to revised advance amount of Rs. {booking.agreed_advance_amount}."
        else:
            booking.advance_negotiation_status = 'rejected'
            booking.agreed_advance_amount = booking.snapshot_deposit_amount
            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Rejected revised advance proposal. Reverted to Rs. {booking.snapshot_deposit_amount}. {response_note}"
            )
            booking.save()

            Notification.objects.create(
                recipient=recipient,
                actor=profile,
                notification_type='advance_rejected',
                title='Advance Revision Rejected',
                message=f"{profile.full_name} declined the advance revision. Original term of Rs. {booking.snapshot_deposit_amount} stands.",
                booking=booking,
                target_modal='financials',
                target_id=str(booking.id)
            )
            msg = f"Rejected revised advance proposal. Reverted to original Rs. {booking.snapshot_deposit_amount}."

        return Response({
            'message': msg,
            'booking': BookingSerializer(booking).data,
        })


# ========================================================
# MUTUAL TERMS ADJUSTMENT VIEWS (Section 1)
# ========================================================

class BookingProposeTermsView(APIView):
    """
    After booking acceptance, allows the lender to review rental amounts before handover.
    The lender can either confirm the existing terms (adjust=False) or propose adjusted
    rental amounts, unit, and deposit (adjust=True).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .serializers import TermsProposeSerializer, BookingSerializer
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id != booking.lender_id:
            return Response({'error': 'Unauthorized: Only the lender can propose terms adjustments.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status != 'accepted':
            return Response({'error': f'Terms adjustment is only available for accepted bookings (current status: {booking.status}).'}, status=status.HTTP_400_BAD_REQUEST)

        if booking.pickup_confirmed_at is not None:
            return Response({'error': 'Cannot modify terms after item pickup has already been verified.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TermsProposeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        adjust = serializer.validated_data.get('adjust', False)
        note = serializer.validated_data.get('note', '').strip()

        from .models import Notification
        from django.utils import timezone

        if not adjust:
            # Lender retains existing terms
            booking.terms_agreed_by_lender = True
            booking.proposed_rent_rate = None
            booking.proposed_pricing_unit = None
            booking.proposed_deposit_amount = None
            booking.proposed_terms_note = note

            if booking.terms_agreed_by_borrower:
                booking.terms_status = 'agreed'
                booking.terms_agreed_at = timezone.now()
                msg = "Confirmed existing rental terms. Both parties are now in agreement!"
            else:
                booking.terms_status = 'pending_review'
                msg = "Confirmed existing rental terms. Awaiting borrower's confirmation."

            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Lender confirmed existing rental terms (Rs. {booking.snapshot_price}/{booking.snapshot_pricing_unit}, deposit Rs. {booking.snapshot_deposit_amount})."
            )
            booking.save()

            Notification.objects.create(
                recipient=booking.borrower,
                actor=profile,
                notification_type='terms_review_requested',
                title='Rental Terms Ready for Review',
                message=f"Lender confirmed the rental terms for '{booking.listing.title}'. Please review and accept them before pickup.",
                booking=booking,
                target_modal='my_bookings',
                target_id=str(booking.id)
            )
        else:
            # Lender proposes adjusted amounts
            proposed_rent = serializer.validated_data.get('proposed_rent_rate')
            proposed_unit = serializer.validated_data.get('proposed_pricing_unit') or booking.snapshot_pricing_unit
            proposed_deposit = serializer.validated_data.get('proposed_deposit_amount')

            if proposed_rent is None:
                proposed_rent = booking.snapshot_price
            if proposed_deposit is None:
                proposed_deposit = booking.snapshot_deposit_amount

            booking.proposed_rent_rate = proposed_rent
            booking.proposed_pricing_unit = proposed_unit
            booking.proposed_deposit_amount = proposed_deposit
            booking.proposed_terms_note = note
            booking.terms_status = 'adjustment_proposed'
            booking.terms_agreed_by_lender = True
            booking.terms_agreed_by_borrower = False
            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Lender proposed revised terms: Rs. {proposed_rent}/{proposed_unit}, deposit Rs. {proposed_deposit}. Note: {note}"
            )
            booking.save()

            Notification.objects.create(
                recipient=booking.borrower,
                actor=profile,
                notification_type='terms_adjusted',
                title='Revised Rental Terms Proposed',
                message=f"Lender proposed revised terms for '{booking.listing.title}': Rs. {proposed_rent}/{proposed_unit}, deposit Rs. {proposed_deposit}. Please review and accept.",
                booking=booking,
                target_modal='my_bookings',
                target_id=str(booking.id)
            )
            msg = f"Revised terms proposed (Rs. {proposed_rent}/{proposed_unit}, deposit Rs. {proposed_deposit}). Sent to borrower for approval."

        return Response({
            'message': msg,
            'booking': BookingSerializer(booking).data
        })


class BookingRespondTermsView(APIView):
    """
    Borrower accepts or rejects the proposed rental terms before pickup.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .serializers import TermsRespondSerializer, BookingSerializer
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id != booking.borrower_id:
            return Response({'error': 'Unauthorized: Only the borrower can respond to rental terms.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status != 'accepted':
            return Response({'error': f'Terms response is only available for accepted bookings (current status: {booking.status}).'}, status=status.HTTP_400_BAD_REQUEST)

        if booking.pickup_confirmed_at is not None:
            return Response({'error': 'Cannot modify terms after item pickup has already been verified.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TermsRespondSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        note = serializer.validated_data.get('note', '').strip()

        from .models import Notification
        from django.utils import timezone

        if action == 'accept':
            if booking.terms_status == 'adjustment_proposed' and booking.proposed_rent_rate is not None:
                booking.snapshot_price = booking.proposed_rent_rate
                booking.snapshot_pricing_unit = booking.proposed_pricing_unit or booking.snapshot_pricing_unit
                booking.snapshot_deposit_amount = booking.proposed_deposit_amount if booking.proposed_deposit_amount is not None else booking.snapshot_deposit_amount
                booking.agreed_advance_amount = booking.snapshot_deposit_amount

                # Recalculate rent snapshot
                unit = booking.snapshot_pricing_unit
                days = booking.duration_days or 1
                if unit == 'hour':
                    booking.calculated_total_rent = booking.snapshot_price * Decimal(str(max(1, days * 24 if days > 1 else 1)))
                elif unit == 'day':
                    booking.calculated_total_rent = booking.snapshot_price * Decimal(str(days))
                elif unit == 'week':
                    import math
                    weeks = max(math.ceil(days / 7), 1)
                    booking.calculated_total_rent = booking.snapshot_price * Decimal(str(weeks))
                elif unit == 'month':
                    import math
                    months = max(math.ceil(days / 30), 1)
                    booking.calculated_total_rent = booking.snapshot_price * Decimal(str(months))
                elif unit == 'semester':
                    import math
                    semesters = max(math.ceil(days / 120), 1)
                    booking.calculated_total_rent = booking.snapshot_price * Decimal(str(semesters))
                else:
                    booking.calculated_total_rent = booking.snapshot_price

                booking.total_due_upfront = booking.calculated_total_rent + booking.snapshot_deposit_amount

            booking.terms_status = 'agreed'
            booking.terms_agreed_by_borrower = True
            booking.terms_agreed_by_lender = True
            booking.terms_agreed_at = timezone.now()
            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Borrower accepted agreed rental terms. Snapshots frozen at Rs. {booking.snapshot_price}/{booking.snapshot_pricing_unit}, deposit Rs. {booking.snapshot_deposit_amount}."
            )
            booking.save()

            Notification.objects.create(
                recipient=booking.lender,
                actor=profile,
                notification_type='terms_agreed',
                title='Rental Terms Agreed!',
                message=f"Borrower accepted rental terms for '{booking.listing.title}'. Handover QR can now be presented!",
                booking=booking,
                target_modal='incoming_bookings',
                target_id=str(booking.id)
            )
            msg = "Rental terms accepted! You and the lender are now ready for item handover."
        else:
            booking.terms_status = 'rejected'
            booking.terms_agreed_by_borrower = False
            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Borrower declined / requested changes to proposed terms. Note: {note}"
            )
            booking.save()

            Notification.objects.create(
                recipient=booking.lender,
                actor=profile,
                notification_type='terms_rejected',
                title='Rental Terms Declined / Change Requested',
                message=f"Borrower declined or requested changes for '{booking.listing.title}'. Note: {note}",
                booking=booking,
                target_modal='incoming_bookings',
                target_id=str(booking.id)
            )
            msg = "Terms proposal declined. The booking remains pending mutual agreement."

        return Response({
            'message': msg,
            'booking': BookingSerializer(booking).data
        })


# ========================================================
# RENT ADJUSTMENT VIEWS (Section 4)
# ========================================================

class BookingProposeRentAdjustmentView(APIView):
    """
    Allow lender to propose an adjustment to the final calculated rent after return.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .serializers import RentAdjustmentProposeSerializer, BookingSerializer
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id != booking.lender_id:
            return Response({'error': 'Unauthorized: Only the lender can propose a rent adjustment.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status not in ['returned', 'completed']:
            return Response({'error': 'Rent adjustment can only be proposed after item return is verified.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RentAdjustmentProposeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        proposed_rent = serializer.validated_data['proposed_rent']
        reason = serializer.validated_data['reason'].strip()

        booking.lender_proposed_rent = proposed_rent
        booking.rent_adjustment_status = 'proposed'
        booking.rent_adjustment_reason = reason
        booking.record_status_change(
            booking.status,
            actor_id=profile.id,
            note=f"Lender proposed final rent adjustment to Rs. {proposed_rent}: {reason}"
        )
        booking.save()

        # Notify borrower
        from .models import Notification
        Notification.objects.create(
            recipient=booking.borrower,
            actor=profile,
            notification_type='rent_adj_proposed',
            title='Rent Adjustment Proposed',
            message=f"Lender proposed final rent of Rs. {proposed_rent} for '{booking.listing.title}'. Reason: {reason}",
            booking=booking,
            target_modal='financials',
            target_id=str(booking.id)
        )

        calculated_baseline = booking.actual_rent_calculated if booking.actual_rent_calculated is not None else (booking.calculated_total_rent or Decimal('0.00'))
        difference = proposed_rent - calculated_baseline

        return Response({
            'message': f"Proposed final rent adjustment of Rs. {proposed_rent} submitted for borrower approval.",
            'booking': BookingSerializer(booking).data,
            'adjustment': {
                'proposed_rent': str(booking.lender_proposed_rent),
                'system_calculated_rent': str(calculated_baseline),
                'difference': str(difference),
                'reason': booking.rent_adjustment_reason,
                'status': booking.rent_adjustment_status,
            }
        })


class BookingRespondRentAdjustmentView(APIView):
    """
    Borrower accepts or rejects lender's proposed rent adjustment.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .serializers import RentAdjustmentRespondSerializer, BookingSerializer
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id != booking.borrower_id:
            return Response({'error': 'Unauthorized: Only the borrower can respond to rent adjustments.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.rent_adjustment_status != 'proposed':
            return Response({'error': 'No pending rent adjustment proposal to respond to.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RentAdjustmentRespondSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        reason = serializer.validated_data.get('reason', '').strip()

        if action == 'accept':
            booking.rent_adjustment_status = 'accepted'
            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Borrower accepted rent adjustment to Rs. {booking.lender_proposed_rent}."
            )
            msg = f"Accepted rent adjustment to Rs. {booking.lender_proposed_rent}."
        else:
            booking.rent_adjustment_status = 'rejected'
            booking.rent_adjustment_rejected_reason = reason
            booking.record_status_change(
                booking.status,
                actor_id=profile.id,
                note=f"Borrower rejected rent adjustment. Reason: {reason}"
            )
            msg = "Rejected rent adjustment proposal. Original system calculation retained."

        booking.save()

        from .models import Notification
        Notification.objects.create(
            recipient=booking.lender,
            actor=profile,
            notification_type='rent_adj_resolved',
            title=f"Rent Adjustment {action.capitalize()}ed",
            message=f"Borrower {action}ed your proposed rent adjustment for '{booking.listing.title}'.",
            booking=booking,
            target_modal='financials',
            target_id=str(booking.id)
        )

        return Response({
            'message': msg,
            'booking': BookingSerializer(booking).data,
        })


# ========================================================
# LATE FEE ESTIMATE VIEW (Section 5)
# ========================================================

class BookingLateFeeEstimateView(APIView):
    """
    Get transparent late fee calculation and policy description for a booking.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id not in [booking.borrower_id, booking.lender_id]:
            return Response({'error': 'Unauthorized to view late fee calculations for this booking.'}, status=status.HTTP_403_FORBIDDEN)

        from .duration_rent_service import calculate_late_penalty_estimate
        estimate = calculate_late_penalty_estimate(booking)
        return Response(estimate)


# ========================================================
# MUTUAL SETTLEMENT AGREEMENT VIEW (Section 6)
# ========================================================

class BookingAgreeSettlementView(APIView):
    """
    Allows borrower or lender to sign off on the itemized settlement bill.
    Distinguishes bill agreement from direct money transfer confirmation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .financial_logic import get_booking_financial_summary
        from .serializers import BookingSerializer
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id not in [booking.borrower_id, booking.lender_id]:
            return Response({'error': 'Unauthorized: Only participants can sign off on settlement.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status not in ['returned', 'completed']:
            return Response({'error': 'Settlement can only be agreed after item return is verified.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone
        now = timezone.now()
        if profile.id == booking.borrower_id:
            booking.settlement_agreed_by_borrower = True
            booking.record_status_change(booking.status, actor_id=profile.id, note="Borrower agreed to final settlement terms.")
            counterparty = booking.lender
        else:
            booking.settlement_agreed_by_lender = True
            booking.record_status_change(booking.status, actor_id=profile.id, note="Lender agreed to final settlement terms.")
            counterparty = booking.borrower

        if booking.settlement_agreed_by_borrower and booking.settlement_agreed_by_lender:
            booking.settlement_agreed_at = now
            booking.record_status_change(booking.status, actor_id=profile.id, note="Mutual settlement agreement reached by both parties.")
            from .financial_logic import check_order_closure_eligibility
            eligible, _ = check_order_closure_eligibility(booking)
            if eligible and booking.status != 'completed':
                booking.record_status_change('completed', actor_id=profile.id, note="Order automatically completed: Final bill agreed and all settlement conditions met.")
                booking.relist_prompted = True

        booking.save()

        # Send notification to counterparty
        from .models import Notification
        Notification.objects.create(
            recipient=counterparty,
            actor=profile,
            notification_type='settlement_agreed',
            title='Settlement Terms Agreed',
            message=f"{profile.full_name} has signed off on the settlement terms for '{booking.listing.title}'.",
            booking=booking,
            target_modal='financials',
            target_id=str(booking.id)
        )

        is_mutually_agreed = bool(booking.settlement_agreed_by_borrower and booking.settlement_agreed_by_lender)
        return Response({
            'message': 'You have successfully signed off on the settlement terms.',
            'financial_summary': get_booking_financial_summary(booking),
            'booking': BookingSerializer(booking).data,
            'is_mutually_agreed': is_mutually_agreed,
        })


# ========================================================
# LENDER RE-LISTING CHOICE VIEW (Section 9)
# ========================================================

class BookingRelistChoiceView(APIView):
    """
    Provides the lender with exactly three explicit choices after verified physical return:
    1. 'relist' - Reactivate existing listing if no conflicts.
    2. 'edit' - Keep listing unlisted until lender saves edits.
    3. 'archive' - Keep listing permanently archived/unlisted.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .serializers import RelistChoiceSerializer, BookingSerializer, ListingSerializer

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id != booking.lender_id:
            return Response({'error': 'Unauthorized: Only the item lender can decide re-listing.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status not in ['returned', 'completed']:
            return Response({'error': 'Re-listing choice is only available after physical return is verified.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RelistChoiceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        choice = serializer.validated_data['choice']
        listing = booking.listing

        if choice == 'relist':
            # Check if there are other conflicting accepted or active bookings for this item
            conflicting_booking = Booking.objects.filter(
                listing=listing,
                status__in=['accepted', 'active']
            ).exclude(id=booking.id).first()
            if conflicting_booking:
                return Response(
                    {'error': f"Cannot relist immediately: Another reservation ({conflicting_booking.status}) exists for this item."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            listing.is_available = True
            listing.status = 'active'
            listing.save(update_fields=['is_available', 'status', 'updated_at'])
            booking.relist_choice = 'relist'
            booking.relist_prompted = False
            msg = "Listing has been successfully reactivated and is now visible to campus students."

        elif choice == 'edit':
            booking.relist_choice = 'edit'
            booking.relist_prompted = False
            msg = "Listing retained for editing. It will remain unavailable until you save your changes."

        else:  # 'archive'
            listing.is_available = False
            listing.status = 'archived'
            listing.save(update_fields=['is_available', 'status', 'updated_at'])
            booking.relist_choice = 'archive'
            booking.relist_prompted = False
            msg = "Listing has been archived and will not be relisted."

        booking.save(update_fields=['relist_choice', 'relist_prompted', 'updated_at'])

        return Response({
            'message': msg,
            'relist_choice': choice,
            'listing': ListingSerializer(listing).data,
            'booking': BookingSerializer(booking).data,
        })


# ========================================================
# RATINGS & REVIEWS VIEWS (Section 10)
# ========================================================

class BookingSubmitReviewView(APIView):
    """
    Allows eligible borrower to submit separate Product (1-5★) and Lender (1-5★) reviews
    after verified physical return. Strictly 1 per type per booking.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from .models import Review
        from .serializers import ReviewCreateSerializer, ReviewSerializer
        from .trust_score_service import calculate_and_update_trust_score

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related('borrower', 'lender', 'listing').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id != booking.borrower_id:
            return Response({'error': 'Unauthorized: Only the assigned borrower can submit reviews for this booking.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status not in ['returned', 'completed'] or not booking.return_confirmed_at:
            return Response({'error': 'Reviews can only be submitted after verified item return.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ReviewCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        review_type = serializer.validated_data['review_type']
        rating = serializer.validated_data['rating']
        comment = serializer.validated_data.get('comment', '').strip()

        # Check for duplicate submission
        if Review.objects.filter(booking=booking, review_type=review_type).exists():
            return Response(
                {'error': f"You have already submitted a {review_type} review for this booking."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if review_type == 'product':
            review = Review.objects.create(
                booking=booking,
                reviewer=profile,
                review_type='product',
                target_listing=booking.listing,
                rating=rating,
                comment=comment,
            )
            # Recalculate listing stats
            all_reviews = Review.objects.filter(target_listing=booking.listing, review_type='product')
            count = all_reviews.count()
            avg = sum(r.rating for r in all_reviews) / count
            booking.listing.average_rating = Decimal(str(round(avg, 2)))
            booking.listing.review_count = count
            booking.listing.save(update_fields=['average_rating', 'review_count', 'updated_at'])

        else:  # 'lender'
            review = Review.objects.create(
                booking=booking,
                reviewer=profile,
                review_type='lender',
                target_lender=booking.lender,
                rating=rating,
                comment=comment,
            )
            # Recalculate lender trust score & review stats
            calculate_and_update_trust_score(booking.lender)

        return Response({
            'message': f"Thank you! Your {review_type} review has been submitted successfully.",
            'review': ReviewSerializer(review).data,
        }, status=status.HTTP_201_CREATED)


class ListingReviewsListView(APIView):
    """
    Public listing of verified reviews for a specific item.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        from .models import Review
        from .serializers import ReviewSerializer
        try:
            listing = Listing.objects.get(pk=pk)
        except Listing.DoesNotExist:
            return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

        reviews = Review.objects.filter(target_listing=listing, review_type='product', is_moderated=False).select_related('reviewer', 'reviewer__college', 'reviewer__user').order_by('-created_at')
        count = reviews.count()
        avg = float(listing.average_rating) if count > 0 else 0.0

        return Response({
            'listing_id': listing.id,
            'count': count,
            'average_rating': avg,
            'reviews': ReviewSerializer(reviews, many=True).data,
        })


class ProfileReviewsListView(APIView):
    """
    Public listing of reviews received by a lender.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        from .models import Review
        from .serializers import ReviewSerializer
        try:
            profile = StudentProfile.objects.get(pk=pk)
        except StudentProfile.DoesNotExist:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        reviews = Review.objects.filter(target_lender=profile, review_type='lender', is_moderated=False).select_related('reviewer', 'reviewer__college', 'reviewer__user').order_by('-created_at')
        count = reviews.count()
        avg = float(profile.lender_average_rating) if count > 0 else 0.0

        return Response({
            'profile_id': profile.id,
            'lender_name': profile.full_name,
            'count': count,
            'average_rating': avg,
            'reviews': ReviewSerializer(reviews, many=True).data,
        })


# ========================================================
# DYNAMIC & EXPLAINABLE TRUST SCORE VIEW (Section 11)
# ========================================================

class ProfileTrustScoreView(APIView):
    """
    Authoritative, explainable trust score breakdown based on verified history.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        from .trust_score_service import calculate_and_update_trust_score
        try:
            profile = StudentProfile.objects.get(pk=pk)
        except StudentProfile.DoesNotExist:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        breakdown = calculate_and_update_trust_score(profile)
        return Response(breakdown)




