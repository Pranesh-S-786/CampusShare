from django.contrib import admin
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


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'icon', 'order', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('order', 'name')


class ListingImageInline(admin.TabularInline):
    model = ListingImage
    extra = 1
    readonly_fields = ('created_at',)


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'lender',
        'college',
        'category',
        'listing_type',
        'price',
        'pricing_unit',
        'deposit_amount',
        'status',
        'is_available',
        'created_at',
    )
    list_filter = ('listing_type', 'status', 'is_available', 'category', 'college')
    search_fields = ('title', 'description', 'lender__full_name', 'lender__college_email')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [ListingImageInline]


class HandoverTokenInline(admin.TabularInline):
    model = HandoverToken
    extra = 0
    readonly_fields = ('action_type', 'presenter', 'authorized_scanner', 'is_used', 'used_at', 'is_revoked', 'expires_at', 'created_at')
    can_delete = False


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'listing',
        'borrower',
        'lender',
        'booking_type',
        'status',
        'start_date',
        'end_date',
        'calculated_total_rent',
        'snapshot_deposit_amount',
        'created_at',
    )
    list_filter = ('status', 'booking_type', 'start_date')
    search_fields = (
        'id',
        'listing__title',
        'borrower__full_name',
        'borrower__college_email',
        'lender__full_name',
        'lender__college_email',
    )
    readonly_fields = ('created_at', 'updated_at', 'pickup_confirmed_at', 'return_confirmed_at', 'status_history')
    inlines = [HandoverTokenInline]


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'booking',
        'payer',
        'recipient',
        'purpose',
        'amount',
        'payment_method',
        'status',
        'declared_at',
        'confirmed_at',
    )
    list_filter = ('purpose', 'status', 'payment_method')
    search_fields = (
        'id',
        'booking__id',
        'payer__full_name',
        'recipient__full_name',
        'transaction_reference',
    )
    readonly_fields = ('declared_at', 'confirmed_at', 'disputed_at', 'created_at', 'updated_at')


@admin.register(SettlementAdjustment)
class SettlementAdjustmentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'booking',
        'proposed_by',
        'adjustment_type',
        'amount',
        'status',
        'reason',
        'resolved_at',
    )
    list_filter = ('adjustment_type', 'status')
    search_fields = ('booking__id', 'proposed_by__full_name', 'reason')
    readonly_fields = ('resolved_at', 'created_at', 'updated_at')


@admin.register(DepositRefund)
class DepositRefundAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'booking',
        'declared_by',
        'original_deposit',
        'approved_deductions',
        'net_refund_amount',
        'refund_method',
        'status',
        'declared_at',
        'confirmed_at',
    )
    list_filter = ('status', 'refund_method')
    search_fields = ('booking__id', 'declared_by__full_name', 'transaction_reference')
    readonly_fields = ('declared_at', 'confirmed_at', 'disputed_at', 'created_at', 'updated_at')


class WantedItemResponseInline(admin.TabularInline):
    model = WantedItemResponse
    extra = 0
    readonly_fields = ('responder', 'listing', 'offered_price', 'status', 'created_at')


@admin.register(WantedItemRequest)
class WantedItemRequestAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'title',
        'requester',
        'college',
        'category',
        'budget',
        'status',
        'created_at',
    )
    list_filter = ('status', 'category', 'college')
    search_fields = ('title', 'description', 'requester__full_name')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [WantedItemResponseInline]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'recipient',
        'actor',
        'notification_type',
        'title',
        'is_read',
        'created_at',
    )
    list_filter = ('notification_type', 'is_read')
    search_fields = ('recipient__full_name', 'actor__full_name', 'title', 'message')
    readonly_fields = ('created_at', 'read_at')


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('sender', 'content', 'is_read', 'read_at', 'created_at')
    can_delete = False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'participant_1',
        'participant_2',
        'listing',
        'booking',
        'wanted_request',
        'last_message_at',
        'created_at',
    )
    search_fields = (
        'id',
        'participant_1__full_name',
        'participant_2__full_name',
        'subject',
    )
    readonly_fields = ('created_at', 'updated_at', 'last_message_at')
    inlines = [MessageInline]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'booking',
        'reviewer',
        'review_type',
        'target_listing',
        'target_lender',
        'rating',
        'is_moderated',
        'created_at',
    )
    list_filter = ('review_type', 'rating', 'is_moderated')
    search_fields = (
        'reviewer__full_name',
        'reviewer__college_email',
        'comment',
        'target_listing__title',
    )
    readonly_fields = ('created_at', 'updated_at')

