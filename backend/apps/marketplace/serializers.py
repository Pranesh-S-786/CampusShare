from decimal import Decimal
from rest_framework import serializers
from apps.authentication.models import StudentProfile, College
from .models import (
    Category,
    Listing,
    ListingImage,
    Booking,
    HandoverToken,
    PaymentRecord,
    SettlementAdjustment,
    DepositRefund,
    WantedItemRequest,
    WantedItemResponse,
    Notification,
    Conversation,
    Message,
    Review,
)



class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon', 'description', 'order']


class LenderSummarySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    college_name = serializers.CharField(source='display_college', read_only=True)
    college_short_code = serializers.SerializerMethodField()
    trust_score = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(source='is_college_verified', read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            'id',
            'full_name',
            'username',
            'avatar_url',
            'default_avatar_url',
            'college_name',
            'college_short_code',
            'grad_year',
            'major',
            'is_college_verified',
            'is_verified',
            'verification_status',
            'trust_score',
            'trust_status',
            'completed_rentals_count',
            'lender_average_rating',
            'lender_review_count',
        ]

    def get_college_short_code(self, obj):
        return obj.college.short_code if obj.college else ''

    def get_trust_score(self, obj):
        return obj.trust_score if obj.trust_score is not None else 75


class ListingCollegeSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = College
        fields = ['id', 'name', 'short_code', 'city', 'state']


class ListingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingImage
        fields = ['id', 'image_url', 'is_primary', 'order', 'created_at']


class ListingSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    college = ListingCollegeSummarySerializer(read_only=True)
    lender = LenderSummarySerializer(read_only=True)
    images = ListingImageSerializer(many=True, read_only=True)
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    listing_type_display = serializers.CharField(source='get_listing_type_display', read_only=True)
    availability_status = serializers.SerializerMethodField()
    availability_label = serializers.SerializerMethodField()
    booked_until = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = [
            'id',
            'title',
            'description',
            'category',
            'subcategory',
            'listing_type',
            'listing_type_display',
            'condition',
            'condition_display',
            'price',
            'deposit_amount',
            'pricing_unit',
            'pickup_location',
            'image_url',
            'images',
            'is_available',
            'status',
            'availability_status',
            'availability_label',
            'booked_until',
            'average_rating',
            'review_count',
            'college',
            'lender',
            'created_at',
            'updated_at',
        ]

    def _get_avail_info(self, obj):
        if not hasattr(obj, '_cached_avail_info'):
            from .booking_logic import get_listing_availability_info
            obj._cached_avail_info = get_listing_availability_info(obj)
        return obj._cached_avail_info

    def get_availability_status(self, obj):
        return self._get_avail_info(obj)['availability_status']

    def get_availability_label(self, obj):
        return self._get_avail_info(obj)['status_label']

    def get_booked_until(self, obj):
        return self._get_avail_info(obj)['booked_until']



class ListingWriteSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category',
        write_only=True
    )
    college_id = serializers.PrimaryKeyRelatedField(
        queryset=College.objects.filter(is_active=True),
        source='college',
        write_only=True,
        required=False,
        allow_null=True
    )
    images = serializers.ListField(
        child=serializers.CharField(max_length=1024),
        required=False,
        write_only=True,
        help_text="List of uploaded image URLs"
    )

    class Meta:
        model = Listing
        fields = [
            'id',
            'title',
            'description',
            'category_id',
            'subcategory',
            'listing_type',
            'condition',
            'price',
            'deposit_amount',
            'pricing_unit',
            'pickup_location',
            'image_url',
            'images',
            'college_id',
            'is_available',
            'status',
        ]
        extra_kwargs = {
            'price': {'required': False, 'default': Decimal('0.00')},
            'deposit_amount': {'required': False, 'default': Decimal('0.00')},
            'status': {'required': False},
            'is_available': {'required': False},
        }

    def validate(self, attrs):
        listing_type = attrs.get('listing_type', getattr(self.instance, 'listing_type', 'rent'))
        price = attrs.get('price', getattr(self.instance, 'price', Decimal('0.00')))
        deposit_amount = attrs.get('deposit_amount', getattr(self.instance, 'deposit_amount', Decimal('0.00')))
        pricing_unit = attrs.get('pricing_unit', getattr(self.instance, 'pricing_unit', 'day'))

        # Ensure values are Decimal
        if not isinstance(price, Decimal):
            price = Decimal(str(price or 0))
        if not isinstance(deposit_amount, Decimal):
            deposit_amount = Decimal(str(deposit_amount or 0))

        if deposit_amount < Decimal('0.00'):
            raise serializers.ValidationError({'deposit_amount': 'Refundable deposit cannot be negative.'})

        if listing_type == 'lend':
            attrs['price'] = Decimal('0.00')
        elif listing_type == 'rent':
            if price <= Decimal('0.00'):
                raise serializers.ValidationError({'price': 'Rental listings require a price per period greater than 0.'})
            if pricing_unit not in ['hour', 'day', 'week', 'month', 'semester']:
                attrs['pricing_unit'] = 'day'
        elif listing_type == 'sell':
            if price <= Decimal('0.00'):
                raise serializers.ValidationError({'price': 'Items being sold require a positive sale price.'})
            attrs['pricing_unit'] = 'item'
            attrs['deposit_amount'] = Decimal('0.00')
        else:
            raise serializers.ValidationError({'listing_type': f"Invalid listing type '{listing_type}'."})

        return attrs

    def create(self, validated_data):
        images_data = validated_data.pop('images', [])
        image_url = validated_data.get('image_url', '').strip()

        # If primary image_url wasn't provided, use first image from images list
        if not image_url and images_data:
            image_url = images_data[0]
            validated_data['image_url'] = image_url

        listing = super().create(validated_data)

        # Create ListingImage records
        for idx, img_url in enumerate(images_data):
            img_url = img_url.strip()
            if img_url:
                ListingImage.objects.create(
                    listing=listing,
                    image_url=img_url,
                    is_primary=(idx == 0),
                    order=idx
                )
        # If single image_url was given but not in images_data, create image entry
        if image_url and not images_data:
            ListingImage.objects.get_or_create(
                listing=listing,
                image_url=image_url,
                defaults={'is_primary': True, 'order': 0}
            )

        return listing

    def update(self, instance, validated_data):
        has_new_images = 'images' in validated_data
        images_data = validated_data.pop('images', [])

        listing = super().update(instance, validated_data)

        if has_new_images:
            # Re-sync images
            listing.images.all().delete()
            for idx, img_url in enumerate(images_data):
                img_url = img_url.strip()
                if img_url:
                    ListingImage.objects.create(
                        listing=listing,
                        image_url=img_url,
                        is_primary=(idx == 0),
                        order=idx
                    )
            if images_data and not listing.image_url:
                listing.image_url = images_data[0]
                listing.save(update_fields=['image_url'])

        return listing


# Backward compatibility alias
ListingCreateSerializer = ListingWriteSerializer


# ========================================================
# BOOKING SERIALIZERS (Stage 6)
# ========================================================

class BookingListingSummarySerializer(serializers.ModelSerializer):
    college = ListingCollegeSummarySerializer(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    listing_type_display = serializers.CharField(source='get_listing_type_display', read_only=True)

    class Meta:
        model = Listing
        fields = [
            'id',
            'title',
            'image_url',
            'listing_type',
            'listing_type_display',
            'condition',
            'condition_display',
            'category_name',
            'price',
            'pricing_unit',
            'deposit_amount',
            'pickup_location',
            'college',
        ]


class BookingSerializer(serializers.ModelSerializer):
    listing = BookingListingSummarySerializer(read_only=True)
    borrower = LenderSummarySerializer(read_only=True)
    lender = LenderSummarySerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    booking_type_display = serializers.CharField(source='get_booking_type_display', read_only=True)
    financial_summary = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id',
            'listing',
            'borrower',
            'lender',
            'booking_type',
            'booking_type_display',
            'status',
            'status_display',
            'start_date',
            'end_date',
            'duration_days',
            'currency',
            'snapshot_price',
            'snapshot_pricing_unit',
            'snapshot_deposit_amount',
            'agreed_advance_amount',
            'advance_negotiation_status',
            'advance_proposal_notes',
            'terms_status',
            'terms_agreed_by_lender',
            'terms_agreed_by_borrower',
            'terms_agreed_at',
            'proposed_rent_rate',
            'proposed_pricing_unit',
            'proposed_deposit_amount',
            'proposed_terms_note',
            'calculated_total_rent',
            'actual_rent_calculated',
            'actual_duration_display',
            'lender_proposed_rent',
            'rent_adjustment_status',
            'rent_adjustment_reason',
            'rent_adjustment_rejected_reason',
            'total_due_upfront',
            'borrower_message',
            'owner_response_note',
            'pickup_confirmed_at',
            'return_confirmed_at',
            'settlement_agreed_by_borrower',
            'settlement_agreed_by_lender',
            'settlement_status',
            'settlement_agreed_at',
            'relist_prompted',
            'relist_choice',
            'status_history',
            'financial_summary',
            'created_at',
            'updated_at',
        ]

    def get_financial_summary(self, obj):
        from .financial_logic import get_booking_financial_summary
        return get_booking_financial_summary(obj)


# ========================================================
# MUTUAL TERMS ADJUSTMENT SERIALIZERS (Section 1)
# ========================================================

class TermsProposeSerializer(serializers.Serializer):
    adjust = serializers.BooleanField(default=False)
    proposed_rent_rate = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.00'), required=False, allow_null=True)
    proposed_pricing_unit = serializers.ChoiceField(choices=Listing.PRICING_UNIT_CHOICES, required=False, allow_null=True)
    proposed_deposit_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.00'), required=False, allow_null=True)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')


class TermsRespondSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['accept', 'reject'])
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')


# ========================================================
# ADVANCE PAYMENT NEGOTIATION SERIALIZERS (Section 2)
# ========================================================

class AdvanceProposalSerializer(serializers.Serializer):
    proposed_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.00'))
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')


class AdvanceRespondSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['accept', 'reject'])
    response_note = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')


# ========================================================
# RENT ADJUSTMENT SERIALIZERS (Section 4)
# ========================================================

class RentAdjustmentProposeSerializer(serializers.Serializer):
    proposed_rent = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.00'))
    reason = serializers.CharField(max_length=255)


class RentAdjustmentRespondSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['accept', 'reject'])
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')


# ========================================================
# LENDER RE-LISTING CHOICE SERIALIZER (Section 9)
# ========================================================

class RelistChoiceSerializer(serializers.Serializer):
    choice = serializers.ChoiceField(choices=['relist', 'edit', 'archive'])


# ========================================================
# RATINGS & REVIEWS SERIALIZERS (Section 10)
# ========================================================

class ReviewSerializer(serializers.ModelSerializer):
    reviewer = LenderSummarySerializer(read_only=True)

    class Meta:
        model = Review
        fields = [
            'id',
            'booking',
            'reviewer',
            'review_type',
            'target_listing',
            'target_lender',
            'rating',
            'comment',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'booking', 'reviewer', 'created_at', 'updated_at']


class ReviewCreateSerializer(serializers.Serializer):
    review_type = serializers.ChoiceField(choices=['product', 'lender'])
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')
    review_text = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if not attrs.get('comment') and attrs.get('review_text'):
            attrs['comment'] = attrs['review_text']
        return attrs



class HandoverQRGenerateSerializer(serializers.Serializer):
    action_type = serializers.ChoiceField(choices=['pickup', 'return'])


class HandoverQRVerifySerializer(serializers.Serializer):
    action_type = serializers.ChoiceField(choices=['pickup', 'return'])
    token = serializers.CharField(max_length=255, trim_whitespace=True)


class HandoverTokenResponseSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField()
    action_type = serializers.CharField()
    raw_token = serializers.CharField()
    verification_code = serializers.CharField()
    expires_at = serializers.DateTimeField()
    qr_payload = serializers.CharField()


class BookingCreateSerializer(serializers.Serializer):
    listing_id = serializers.PrimaryKeyRelatedField(
        queryset=Listing.objects.filter(is_visible=True),
        source='listing'
    )
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    borrower_message = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        from datetime import date
        from .booking_logic import check_booking_conflict

        request = self.context.get('request')
        borrower = getattr(request.user, 'profile', None) if request and request.user.is_authenticated else None
        listing = attrs['listing']
        start_date = attrs['start_date']
        end_date = attrs.get('end_date')

        if borrower and listing.lender_id == borrower.id:
            raise serializers.ValidationError({'listing_id': 'You cannot request or book your own listing.'})

        today = date.today()
        if start_date < today:
            raise serializers.ValidationError({'start_date': 'Requested start date cannot be in the past.'})

        if listing.listing_type != 'sell':
            if not end_date:
                raise serializers.ValidationError({'end_date': 'End date is required for rental or lending.'})
            if end_date < start_date:
                raise serializers.ValidationError({'end_date': 'End date must be on or after start date.'})
        else:
            attrs['end_date'] = start_date

        conflict_err = check_booking_conflict(listing, start_date, attrs.get('end_date'))
        if conflict_err:
            raise serializers.ValidationError({'non_field_errors': conflict_err})

        return attrs

    def create(self, validated_data):
        from django.db import transaction
        from .booking_logic import calculate_booking_quote, check_booking_conflict

        request = self.context.get('request')
        borrower = request.user.profile
        listing_obj = validated_data['listing']
        start_date = validated_data['start_date']
        end_date = validated_data.get('end_date')
        message = validated_data.get('borrower_message', '').strip()

        with transaction.atomic():
            listing = Listing.objects.select_for_update().get(pk=listing_obj.id)
            conflict_err = check_booking_conflict(listing, start_date, end_date)
            if conflict_err:
                raise serializers.ValidationError({'non_field_errors': conflict_err})

            quote = calculate_booking_quote(listing, start_date, end_date)
            booking_type = 'buy' if listing.listing_type == 'sell' else listing.listing_type

            booking = Booking.objects.create(
                listing=listing,
                borrower=borrower,
                lender=listing.lender,
                booking_type=booking_type,
                status='pending',
                start_date=start_date,
                end_date=end_date,
                duration_days=quote['duration_days'],
                snapshot_price=quote['unit_price'],
                snapshot_pricing_unit=quote['pricing_unit'],
                snapshot_deposit_amount=quote['deposit_amount'],
                calculated_total_rent=quote['total_rent'],
                total_due_upfront=quote['total_due_upfront'],
                borrower_message=message,
            )
            booking.record_status_change('pending', actor_id=borrower.id, note='Booking request submitted')
            booking.save(update_fields=['status_history'])
            return booking


# ========================================================
# WANTED-ITEM REQUEST SERIALIZERS (Stage 6)
# ========================================================

class WantedItemResponseSerializer(serializers.ModelSerializer):
    responder = LenderSummarySerializer(read_only=True)
    listing = BookingListingSummarySerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = WantedItemResponse
        fields = [
            'id',
            'request_id',
            'responder',
            'listing',
            'message',
            'offered_price',
            'status',
            'status_display',
            'created_at',
        ]


class WantedItemRequestSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    college = ListingCollegeSummarySerializer(read_only=True)
    requester = LenderSummarySerializer(read_only=True)
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    responses_count = serializers.IntegerField(source='responses.count', read_only=True)
    responses = serializers.SerializerMethodField()

    class Meta:
        model = WantedItemRequest
        fields = [
            'id',
            'title',
            'description',
            'request_type',
            'request_type_display',
            'category',
            'college',
            'requester',
            'budget',
            'preferred_terms',
            'needed_by_date',
            'status',
            'notes',
            'responses_count',
            'responses',
            'created_at',
            'updated_at',
        ]

    def get_responses(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return []
        profile = getattr(request.user, 'profile', None)
        # Responses visible to request owner, or responder's own response
        if profile and obj.requester_id == profile.id:
            return WantedItemResponseSerializer(obj.responses.all(), many=True).data
        elif profile:
            user_responses = obj.responses.filter(responder=profile)
            return WantedItemResponseSerializer(user_responses, many=True).data
        return []


class WantedItemRequestWriteSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category',
        write_only=True
    )
    college_id = serializers.PrimaryKeyRelatedField(
        queryset=College.objects.filter(is_active=True),
        source='college',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = WantedItemRequest
        fields = [
            'id',
            'title',
            'description',
            'category_id',
            'request_type',
            'budget',
            'preferred_terms',
            'needed_by_date',
            'notes',
            'college_id',
            'status',
        ]
        extra_kwargs = {
            'budget': {'required': False, 'allow_null': True},
            'status': {'required': False},
        }

    def validate_budget(self, value):
        if value is not None and value < Decimal('0.00'):
            raise serializers.ValidationError('Budget cannot be negative.')
        return value


# ========================================================
# FINANCIAL & PAYMENT TRACKING SERIALIZERS (Stage 8)
# ========================================================

class PaymentRecordSerializer(serializers.ModelSerializer):
    payer = LenderSummarySerializer(read_only=True)
    recipient = LenderSummarySerializer(read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.full_name', read_only=True)
    disputed_by_name = serializers.CharField(source='disputed_by.full_name', read_only=True)
    purpose_display = serializers.CharField(source='get_purpose_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PaymentRecord
        fields = [
            'id',
            'booking_id',
            'payer',
            'recipient',
            'purpose',
            'purpose_display',
            'amount',
            'currency',
            'payment_method',
            'payment_method_display',
            'status',
            'status_display',
            'transaction_reference',
            'evidence_url',
            'payer_notes',
            'declared_at',
            'confirmed_at',
            'confirmed_by_name',
            'disputed_at',
            'disputed_by_name',
            'dispute_reason',
            'created_at',
        ]


class PaymentDeclareSerializer(serializers.Serializer):
    purpose = serializers.ChoiceField(choices=['rent', 'deposit', 'adjustment', 'other'])
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    payment_method = serializers.ChoiceField(choices=['upi', 'bank_transfer', 'cash', 'other'], default='upi')
    transaction_reference = serializers.CharField(required=False, allow_blank=True, max_length=100)
    evidence_url = serializers.URLField(required=False, allow_blank=True, max_length=1024)
    payer_notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class PaymentDisputeSerializer(serializers.Serializer):
    dispute_reason = serializers.CharField(min_length=3, max_length=1000)


class SettlementAdjustmentSerializer(serializers.ModelSerializer):
    proposed_by = LenderSummarySerializer(read_only=True)
    adjustment_type_display = serializers.CharField(source='get_adjustment_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.full_name', read_only=True)

    class Meta:
        model = SettlementAdjustment
        fields = [
            'id',
            'booking_id',
            'adjustment_type',
            'adjustment_type_display',
            'amount',
            'reason',
            'description',
            'proposed_by',
            'evidence_url',
            'status',
            'status_display',
            'resolved_at',
            'resolved_by_name',
            'response_note',
            'created_at',
        ]


class AdjustmentProposeSerializer(serializers.Serializer):
    adjustment_type = serializers.ChoiceField(choices=['late_fee', 'damage', 'cleaning', 'extension_fee', 'other'])
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    reason = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    evidence_url = serializers.URLField(required=False, allow_blank=True, max_length=1024)


class AdjustmentRespondSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['accept', 'dispute'])
    response_note = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class DepositRefundSerializer(serializers.ModelSerializer):
    refund_method_display = serializers.CharField(source='get_refund_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    declared_by_name = serializers.CharField(source='declared_by.full_name', read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.full_name', read_only=True)
    disputed_by_name = serializers.CharField(source='disputed_by.full_name', read_only=True)

    class Meta:
        model = DepositRefund
        fields = [
            'id',
            'booking_id',
            'original_deposit',
            'approved_deductions',
            'net_refund_amount',
            'refund_method',
            'refund_method_display',
            'transaction_reference',
            'evidence_url',
            'notes',
            'status',
            'status_display',
            'declared_at',
            'declared_by_name',
            'confirmed_at',
            'confirmed_by_name',
            'disputed_at',
            'disputed_by_name',
            'dispute_reason',
            'created_at',
        ]


class RefundDeclareSerializer(serializers.Serializer):
    refund_method = serializers.ChoiceField(choices=['upi', 'bank_transfer', 'cash', 'other'], default='upi')
    transaction_reference = serializers.CharField(required=False, allow_blank=True, max_length=100)
    evidence_url = serializers.URLField(required=False, allow_blank=True, max_length=1024)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class RefundDisputeSerializer(serializers.Serializer):
    dispute_reason = serializers.CharField(min_length=3, max_length=1000)


# ========================================================
# STAGE 9: NOTIFICATIONS & MESSAGING SERIALIZERS
# ========================================================

class NotificationSerializer(serializers.ModelSerializer):
    actor = LenderSummarySerializer(read_only=True)
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    listing_title = serializers.CharField(source='listing.title', read_only=True, default=None)
    booking_id = serializers.IntegerField(source='booking.id', read_only=True, default=None)
    wanted_request_title = serializers.CharField(source='wanted_request.title', read_only=True, default=None)

    class Meta:
        model = Notification
        fields = [
            'id',
            'actor',
            'title',
            'message',
            'notification_type',
            'notification_type_display',
            'listing_title',
            'booking_id',
            'wanted_request_title',
            'target_modal',
            'target_id',
            'is_read',
            'read_at',
            'created_at',
        ]
        read_only_fields = fields


class MessageSerializer(serializers.ModelSerializer):
    sender = LenderSummarySerializer(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id',
            'conversation_id',
            'sender',
            'content',
            'is_mine',
            'is_read',
            'read_at',
            'created_at',
        ]
        read_only_fields = ['id', 'conversation_id', 'sender', 'is_mine', 'is_read', 'read_at', 'created_at']

    def get_is_mine(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        profile = getattr(request.user, 'profile', None)
        return bool(profile and obj.sender_id == profile.id)


class MessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1, max_length=2000, trim_whitespace=True)


class ConversationSerializer(serializers.ModelSerializer):
    other_participant = serializers.SerializerMethodField()
    latest_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    context_type = serializers.SerializerMethodField()
    context_title = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'subject',
            'other_participant',
            'latest_message',
            'unread_count',
            'context_type',
            'context_title',
            'listing_id',
            'booking_id',
            'wanted_request_id',
            'last_message_at',
            'created_at',
            'updated_at',
        ]

    def get_other_participant(self, obj):
        request = self.context.get('request')
        profile = getattr(request.user, 'profile', None) if request and request.user.is_authenticated else None
        if not profile:
            return LenderSummarySerializer(obj.participant_2).data
        other = obj.get_other_participant(profile)
        return LenderSummarySerializer(other).data

    def get_latest_message(self, obj):
        latest = obj.messages.order_by('-created_at').first()
        if not latest:
            return None
        return {
            'id': latest.id,
            'sender_name': latest.sender.full_name or latest.sender.user.username,
            'content': latest.content,
            'created_at': latest.created_at,
            'is_read': latest.is_read,
        }

    def get_unread_count(self, obj):
        request = self.context.get('request')
        profile = getattr(request.user, 'profile', None) if request and request.user.is_authenticated else None
        if not profile:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=profile).count()

    def get_context_type(self, obj):
        if obj.booking_id:
            return 'booking'
        if obj.listing_id:
            return 'listing'
        if obj.wanted_request_id:
            return 'wanted_request'
        return 'general'

    def get_context_title(self, obj):
        if obj.listing:
            return obj.listing.title
        if obj.booking and obj.booking.listing:
            return obj.booking.listing.title
        if obj.wanted_request:
            return obj.wanted_request.title
        return obj.subject or "Direct Conversation"


class ConversationStartSerializer(serializers.Serializer):
    listing_id = serializers.IntegerField(required=False, allow_null=True)
    booking_id = serializers.IntegerField(required=False, allow_null=True)
    wanted_request_id = serializers.IntegerField(required=False, allow_null=True)
    initial_message = serializers.CharField(required=False, allow_blank=True, max_length=2000)


