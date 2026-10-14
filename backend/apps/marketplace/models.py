from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from apps.authentication.models import StudentProfile, College


class Category(models.Model):
    """
    Standard categorization for items in the campus marketplace.
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Lucide icon identifier")
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


class Listing(models.Model):
    """
    Represents an item shared, rented, or lent by a student on campus.
    """
    LISTING_TYPE_CHOICES = [
        ('lend', 'Lend (Free)'),
        ('rent', 'Rent'),
        ('sell', 'Sell'),
    ]

    CONDITION_CHOICES = [
        ('brand_new', 'Brand New'),
        ('like_new', 'Like New'),
        ('good', 'Good'),
        ('fair', 'Fair'),
    ]

    PRICING_UNIT_CHOICES = [
        ('hour', 'hour'),
        ('day', 'day'),
        ('week', 'week'),
        ('month', 'month'),
        ('semester', 'semester'),
        ('item', 'item'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('unavailable', 'Unavailable'),
        ('rented', 'Rented'),
        ('paused', 'Paused'),
        ('archived', 'Archived'),
    ]

    lender = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='listings'
    )
    college = models.ForeignKey(
        College,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='listings',
        help_text="The campus where the item is physically available"
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='listings'
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    subcategory = models.CharField(max_length=100, blank=True, help_text="e.g. Laptops, Textbooks, Cameras")
    listing_type = models.CharField(max_length=10, choices=LISTING_TYPE_CHOICES, default='rent')
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='good')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Refundable deposit amount in Rs.  for rental listings")
    pricing_unit = models.CharField(max_length=20, choices=PRICING_UNIT_CHOICES, default='day')
    pickup_location = models.CharField(max_length=255, blank=True, help_text="Specific campus pickup point, e.g. Library 2nd Floor")
    image_url = models.URLField(max_length=1024, blank=True)
    is_available = models.BooleanField(default=True)
    is_visible = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    # Borrower Reviews & Ratings Summary
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.00'))
    review_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_available', 'is_visible', 'status']),
            models.Index(fields=['college', 'category']),
            models.Index(fields=['listing_type']),
        ]

    def save(self, *args, **kwargs):
        # Default college to lender's college if not explicitly set
        if not self.college_id and self.lender and self.lender.college:
            self.college = self.lender.college
        # Consistency adjustments based on listing_type
        if self.listing_type == 'lend':
            self.price = Decimal('0.00')
        elif self.listing_type == 'sell':
            self.deposit_amount = Decimal('0.00')
            self.pricing_unit = 'item'
        super().save(*args, **kwargs)

    def __str__(self):
        if self.listing_type == 'lend':
            return f"{self.title} (Lend/Free)"
        elif self.listing_type == 'sell':
            return f"{self.title} (Rs. {self.price} Sale)"
        return f"{self.title} (Rs. {self.price}/{self.pricing_unit})"


class ListingImage(models.Model):
    """
    Multiple photos uploaded for a marketplace listing.
    """
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='images'
    )
    image_url = models.URLField(max_length=1024)
    is_primary = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"Image for {self.listing.title} ({'Primary' if self.is_primary else 'Photo'})"


class Booking(models.Model):
    """
    Represents a booking or purchase-intent request between a borrower and a lender.
    Stores complete snapshot of financial terms at the time of agreement.
    """
    BOOKING_TYPE_CHOICES = [
        ('lend', 'Lend (Free)'),
        ('rent', 'Rent'),
        ('buy', 'Buy/Purchase'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('accepted', 'Accepted / Confirmed'),
        ('active', 'Active / In Progress'),
        ('returned', 'Returned'),
        ('completed', 'Completed'),
        ('declined', 'Declined'),
        ('cancelled', 'Cancelled'),
    ]

    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='bookings'
    )
    borrower = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='bookings'
    )
    lender = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='received_bookings'
    )
    booking_type = models.CharField(max_length=10, choices=BOOKING_TYPE_CHOICES, default='rent')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    start_date = models.DateField(help_text="Requested start date for rental/lending or planned pickup date for purchase")
    end_date = models.DateField(null=True, blank=True, help_text="Requested end date for rental/lending")
    duration_days = models.PositiveIntegerField(default=1)

    # Immutable transaction snapshots
    currency = models.CharField(max_length=5, default='INR')
    snapshot_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    snapshot_pricing_unit = models.CharField(max_length=20, default='day')
    snapshot_deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    calculated_total_rent = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_due_upfront = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # Handover timestamps
    pickup_confirmed_at = models.DateTimeField(null=True, blank=True)
    return_confirmed_at = models.DateTimeField(null=True, blank=True)

    # Mutual Rental Terms Agreement (Section 1: Post-Acceptance, Pre-Handover)
    terms_status = models.CharField(
        max_length=25,
        default='agreed',
        choices=[
            ('pending_review', 'Pending Review'),
            ('adjustment_proposed', 'Adjustment Proposed by Lender'),
            ('agreed', 'Terms Agreed by Both Parties'),
            ('rejected', 'Terms Rejected / Pending Revision'),
        ],
        help_text="Mutual agreement state for rental rate, unit, and advance terms before pickup"
    )
    terms_agreed_by_lender = models.BooleanField(default=True)
    terms_agreed_by_borrower = models.BooleanField(default=True)
    terms_agreed_at = models.DateTimeField(null=True, blank=True)
    proposed_rent_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Lender-proposed revised rental rate before pickup"
    )
    proposed_pricing_unit = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text="Lender-proposed revised pricing unit before pickup"
    )
    proposed_deposit_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Lender-proposed revised advance/deposit amount before pickup"
    )
    proposed_terms_note = models.TextField(blank=True, help_text="Notes/reason for proposed pre-handover terms adjustment")

    # Mutual Advance Payment Negotiation & Confirmation (Section 2)
    agreed_advance_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Mutually agreed advance/deposit amount (defaults to snapshot_deposit_amount)"
    )
    advance_negotiation_status = models.CharField(
        max_length=20,
        default='agreed',
        choices=[
            ('agreed', 'Agreed'),
            ('proposed', 'Proposed / In Negotiation'),
            ('rejected', 'Rejected'),
        ]
    )
    advance_proposal_notes = models.TextField(blank=True)

    # Actual Verified Duration & Dynamic Rent Calculation (Section 3)
    actual_rent_calculated = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Authoritative system-calculated rent based on verified pickup and return timestamps"
    )
    actual_duration_display = models.CharField(
        max_length=100,
        blank=True,
        help_text="Human-readable actual duration e.g. '2 days (48 hrs)'"
    )

    # Lender-Proposed Rent Adjustments (Section 4)
    lender_proposed_rent = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Lender-proposed final rent after actual calculation"
    )
    rent_adjustment_status = models.CharField(
        max_length=20,
        default='none',
        choices=[
            ('none', 'No Adjustment'),
            ('proposed', 'Proposed by Lender'),
            ('accepted', 'Accepted by Borrower'),
            ('rejected', 'Rejected by Borrower'),
        ]
    )
    rent_adjustment_reason = models.CharField(max_length=255, blank=True)
    rent_adjustment_rejected_reason = models.CharField(max_length=255, blank=True)

    # Mutual Final Settlement Agreement (Section 6)
    settlement_agreed_by_borrower = models.BooleanField(default=False)
    settlement_agreed_by_lender = models.BooleanField(default=False)
    settlement_status = models.CharField(
        max_length=35,
        default='pending',
        choices=[
            ('pending', 'Pending Return'),
            ('settlement_proposed', 'Settlement Proposed'),
            ('awaiting_borrower', 'Awaiting Borrower Agreement'),
            ('awaiting_lender', 'Awaiting Lender Agreement'),
            ('disputed', 'Disputed'),
            ('agreed_payment_pending', 'Agreed (Direct Payment/Refund Pending)'),
            ('payment_declared', 'Payment/Refund Declared'),
            ('settled', 'Settled & Completed'),
        ]
    )
    settlement_agreed_at = models.DateTimeField(null=True, blank=True)

    # Lender Re-listing Choice After Return (Section 9)
    relist_prompted = models.BooleanField(default=False)
    relist_choice = models.CharField(
        max_length=20,
        default='none',
        choices=[
            ('none', 'Not Decided'),
            ('relist', 'Relisted'),
            ('edit', 'Relisted After Editing'),
            ('archive', 'Archived / Unlisted'),
        ]
    )

    # Communication
    borrower_message = models.TextField(blank=True)
    owner_response_note = models.TextField(blank=True)

    # History audit trail
    status_history = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['listing', 'status']),
            models.Index(fields=['borrower', 'status']),
            models.Index(fields=['lender', 'status']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def record_status_change(self, new_status, actor_id=None, note=''):
        from django.utils import timezone
        self.status = new_status
        history_entry = {
            'status': new_status,
            'timestamp': timezone.now().isoformat(),
            'actor_id': actor_id,
            'note': note,
        }
        if not isinstance(self.status_history, list):
            self.status_history = []
        self.status_history.append(history_entry)

    def __str__(self):
        return f"Booking #{self.id}: {self.listing.title} ({self.borrower.user.username} -> {self.status})"


class HandoverToken(models.Model):
    """
    Cryptographically secure, single-use, short-lived tokens for QR item handover and return verification.
    Stores only SHA-256 hashes of the raw QR token and manual verification code.
    """
    ACTION_TYPE_CHOICES = [
        ('pickup', 'Pickup Confirmation'),
        ('return', 'Return Confirmation'),
    ]

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='handover_tokens'
    )
    action_type = models.CharField(max_length=20, choices=ACTION_TYPE_CHOICES)
    presenter = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='presented_handover_tokens',
        help_text="Student who generates and presents the QR code (Lender for pickup, Borrower for return)"
    )
    authorized_scanner = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='authorized_handover_tokens',
        help_text="Student authorized to scan and confirm (Borrower for pickup, Lender for return)"
    )
    token_hash = models.CharField(max_length=64, db_index=True)
    verification_code_hash = models.CharField(max_length=64, db_index=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.ForeignKey(
        StudentProfile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='consumed_handover_tokens'
    )
    is_revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['booking', 'action_type', 'is_used', 'is_revoked']),
            models.Index(fields=['token_hash']),
            models.Index(fields=['verification_code_hash']),
        ]

    def __str__(self):
        return f"HandoverToken #{self.id} for Booking #{self.booking_id} ({self.action_type}) - {'USED' if self.is_used else 'ACTIVE'}"


# ========================================================
# FINANCIAL RECORDS & DIRECT PAYMENT TRACKING (Stage 8)
# CampusShare never collects, holds, or moves money.
# All payments and refunds occur directly between students.
# ========================================================

class PaymentRecord(models.Model):
    """
    Direct payment declaration between borrower and lender (e.g. UPI, cash, bank transfer).
    Tracks rent, refundable security deposits, and agreed additional charges.
    """
    PURPOSE_CHOICES = [
        ('rent', 'Rental Charge'),
        ('deposit', 'Refundable Security Deposit'),
        ('adjustment', 'Additional Charge / Late Fee / Damage'),
        ('other', 'Other Agreed Payment'),
    ]

    METHOD_CHOICES = [
        ('upi', 'UPI (Google Pay / PhonePe / Paytm / BHIM)'),
        ('bank_transfer', 'Direct Bank Transfer (IMPS / NEFT)'),
        ('cash', 'Cash (Direct Handover)'),
        ('other', 'Other Mutually Agreed Method'),
    ]

    STATUS_CHOICES = [
        ('declared', 'Declared Paid (Awaiting Recipient Confirmation)'),
        ('confirmed', 'Confirmed Received by Recipient'),
        ('disputed', 'Disputed by Recipient'),
        ('cancelled', 'Cancelled / Superseded'),
    ]

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    payer = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='payments_made'
    )
    recipient = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='payments_received'
    )
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=5, default='INR')
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='upi')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='declared')

    transaction_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Optional UPI UTR, bank transfer reference, or cash handover note"
    )
    evidence_url = models.URLField(
        max_length=1024,
        blank=True,
        help_text="Optional user-submitted payment screenshot/receipt (recorded as unverified evidence)"
    )
    payer_notes = models.TextField(blank=True, help_text="Notes from payer when declaring payment")

    declared_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        StudentProfile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='confirmed_payments'
    )
    disputed_at = models.DateTimeField(null=True, blank=True)
    disputed_by = models.ForeignKey(
        StudentProfile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='disputed_payments'
    )
    dispute_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['booking', 'status']),
            models.Index(fields=['booking', 'purpose']),
            models.Index(fields=['payer', 'status']),
            models.Index(fields=['recipient', 'status']),
        ]

    def __str__(self):
        return f"Payment #{self.id}: Rs. {self.amount} ({self.purpose}) for Booking #{self.booking_id} [{self.status}]"


class SettlementAdjustment(models.Model):
    """
    Transparent adjustments for late returns, item damage, cleaning fees, or rental extensions.
    Proposed by one party (usually lender) and must be accepted or disputed by the other party.
    Disputed adjustments are preserved and never silently deducted or finalized.
    """
    ADJUSTMENT_TYPE_CHOICES = [
        ('late_fee', 'Late Return Fee'),
        ('damage', 'Item Damage Claim'),
        ('cleaning', 'Cleaning / Maintenance'),
        ('extension_fee', 'Rental Period Extension'),
        ('other', 'Other Mutually Agreed Adjustment'),
    ]

    STATUS_CHOICES = [
        ('proposed', 'Proposed / Under Review'),
        ('accepted', 'Accepted by Borrower'),
        ('disputed', 'Disputed by Borrower'),
        ('cancelled', 'Cancelled by Proposer'),
    ]

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='adjustments'
    )
    adjustment_type = models.CharField(max_length=20, choices=ADJUSTMENT_TYPE_CHOICES, default='other')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    proposed_by = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='proposed_adjustments'
    )
    evidence_url = models.URLField(max_length=1024, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='proposed')

    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        StudentProfile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='resolved_adjustments'
    )
    response_note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['booking', 'status']),
        ]

    def __str__(self):
        return f"Adjustment #{self.id}: Rs. {self.amount} ({self.adjustment_type}) for Booking #{self.booking_id} [{self.status}]"


class DepositRefund(models.Model):
    """
    Tracks the refundable deposit reconciliation and direct refund declaration after item return.
    Lender makes direct refund transfer outside platform; CampusShare records declarations & borrower confirmations.
    """
    METHOD_CHOICES = [
        ('upi', 'UPI (Google Pay / PhonePe / Paytm / BHIM)'),
        ('bank_transfer', 'Direct Bank Transfer (IMPS / NEFT)'),
        ('cash', 'Cash (Direct Handover)'),
        ('other', 'Other Mutually Agreed Method'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Refund Settlement'),
        ('declared', 'Refund Declared by Lender (Awaiting Borrower Confirmation)'),
        ('confirmed', 'Refund Receipt Confirmed by Borrower'),
        ('disputed', 'Refund Disputed by Borrower'),
    ]

    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name='deposit_refund'
    )
    original_deposit = models.DecimalField(max_digits=10, decimal_places=2)
    approved_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    net_refund_amount = models.DecimalField(max_digits=10, decimal_places=2)

    refund_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='upi')
    transaction_reference = models.CharField(max_length=100, blank=True)
    evidence_url = models.URLField(max_length=1024, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    declared_at = models.DateTimeField(null=True, blank=True)
    declared_by = models.ForeignKey(
        StudentProfile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='declared_refunds'
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        StudentProfile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='confirmed_refunds'
    )
    disputed_at = models.DateTimeField(null=True, blank=True)
    disputed_by = models.ForeignKey(
        StudentProfile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='disputed_refunds'
    )
    dispute_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"DepositRefund for Booking #{self.booking_id}: Net Rs. {self.net_refund_amount} [{self.status}]"


class WantedItemRequest(models.Model):
    """
    Public wanted-item request for equipment, books, or gear not currently listed on campus.
    """
    REQUEST_TYPE_CHOICES = [
        ('rent', 'Rent'),
        ('borrow', 'Borrow / Lend'),
        ('buy', 'Buy'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('fulfilled', 'Fulfilled'),
        ('cancelled', 'Cancelled'),
    ]

    requester = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='wanted_requests'
    )
    college = models.ForeignKey(
        College,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wanted_requests'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='wanted_requests'
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    request_type = models.CharField(max_length=10, choices=REQUEST_TYPE_CHOICES, default='rent')
    budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    preferred_terms = models.CharField(max_length=100, blank=True, help_text="e.g. 3 days, for semester, under 100/day")
    needed_by_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    notes = models.TextField(blank=True, help_text="Campus pickup preferences or contact notes")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['college', 'status']),
            models.Index(fields=['category', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def save(self, *args, **kwargs):
        if not self.college_id and self.requester and self.requester.college:
            self.college = self.requester.college
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Wanted: {self.title} by {self.requester.user.username}"


class WantedItemResponse(models.Model):
    """
    Responses from other students offering to provide an item requested on the wanted board.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('interested', 'Interested'),
        ('declined', 'Declined'),
    ]

    request = models.ForeignKey(
        WantedItemRequest,
        on_delete=models.CASCADE,
        related_name='responses'
    )
    responder = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='wanted_responses'
    )
    listing = models.ForeignKey(
        Listing,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wanted_responses',
        help_text="Optional existing listing associated with this offer"
    )
    message = models.TextField()
    offered_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['request', 'status']),
        ]

    def __str__(self):
        return f"Response to '{self.request.title}' from {self.responder.user.username}"


class Notification(models.Model):
    """
    User notifications triggered by system events, bookings, financial actions, and messages.
    """
    NOTIFICATION_TYPES = [
        ('booking_request', 'New Booking Request'),
        ('booking_accepted', 'Booking Accepted'),
        ('booking_declined', 'Booking Declined'),
        ('booking_cancelled', 'Booking Cancelled'),
        ('pickup_confirmed', 'Pickup Confirmed'),
        ('return_confirmed', 'Return Confirmed'),
        ('payment_declared', 'Payment Declared'),
        ('payment_confirmed', 'Payment Confirmed'),
        ('payment_disputed', 'Payment Disputed'),
        ('adjustment_proposed', 'Adjustment Proposed'),
        ('adjustment_resolved', 'Adjustment Resolved'),
        ('refund_declared', 'Deposit Refund Declared'),
        ('refund_confirmed', 'Deposit Refund Confirmed'),
        ('advance_declared', 'Advance Payment Declared'),
        ('advance_confirmed', 'Advance Payment Confirmed'),
        ('advance_rejected', 'Advance Payment Rejected'),
        ('advance_proposed', 'Advance Revision Proposed'),
        ('rent_adj_proposed', 'Rent Adjustment Proposed'),
        ('rent_adj_resolved', 'Rent Adjustment Resolved'),
        ('settlement_proposed', 'Settlement Proposed'),
        ('settlement_agreed', 'Settlement Agreed'),
        ('relist_prompt', 'Relist Product Option'),
        ('review_requested', 'Review Requested'),
        ('return_overdue', 'Rental Return Overdue'),
        ('wanted_response', 'Wanted Item Response'),
        ('wanted_response_status', 'Wanted Response Status'),
        ('new_message', 'New Message'),
        ('deadline_reminder', 'Deadline Reminder'),
        ('system', 'System Notice'),
    ]

    recipient = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    actor = models.ForeignKey(
        StudentProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='triggered_notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)

    # Associated entities for contextual navigation
    booking = models.ForeignKey(
        'Booking',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    listing = models.ForeignKey(
        'Listing',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    wanted_request = models.ForeignKey(
        'WantedItemRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )

    # Navigation target for frontend router/modal dispatch
    target_modal = models.CharField(max_length=50, blank=True, default='')
    target_id = models.CharField(max_length=100, blank=True, default='')

    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', '-created_at']),
        ]

    def __str__(self):
        return f"Notification to {self.recipient.user.username}: {self.title}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])


class Conversation(models.Model):
    """
    Context-bound direct conversation thread between two campus members.
    Enforces attachment to a listing, booking, or wanted request to prevent spam/unauthorized outreach.
    """
    participant_1 = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='conversations_as_p1'
    )
    participant_2 = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='conversations_as_p2'
    )
    listing = models.ForeignKey(
        'Listing',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversations'
    )
    booking = models.ForeignKey(
        'Booking',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversations'
    )
    wanted_request = models.ForeignKey(
        'WantedItemRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversations'
    )
    subject = models.CharField(max_length=200, blank=True)
    last_message_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['participant_1', '-last_message_at']),
            models.Index(fields=['participant_2', '-last_message_at']),
        ]

    def __str__(self):
        return f"Conversation between {self.participant_1.user.username} and {self.participant_2.user.username}"

    def is_participant(self, profile):
        if not profile:
            return False
        return self.participant_1_id == profile.id or self.participant_2_id == profile.id

    def get_other_participant(self, profile):
        if self.participant_1_id == profile.id:
            return self.participant_2
        return self.participant_1


class Message(models.Model):
    """
    Direct user-to-user text message within an authorized conversation.
    """
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    content = models.TextField(max_length=2000)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['conversation', 'is_read']),
        ]

    def __str__(self):
        return f"Message from {self.sender.user.username} at {self.created_at}"


# ========================================================
# BORROWER RATINGS & REVIEWS (Section 10)
# Verified 1-5 star reviews for listings and lenders.
# Enforces strictly 1 product review and 1 lender review per eligible returned rental.
# ========================================================

class Review(models.Model):
    """
    Genuine borrower ratings and reviews for listings and peer lenders.
    Only submitted after verified item return.
    """
    REVIEW_TYPE_CHOICES = [
        ('product', 'Product / Item Review'),
        ('lender', 'Lender / Peer Review'),
    ]

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='reviews'
    )
    reviewer = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='reviews_written'
    )
    review_type = models.CharField(max_length=10, choices=REVIEW_TYPE_CHOICES)
    target_listing = models.ForeignKey(
        Listing,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='product_reviews'
    )
    target_lender = models.ForeignKey(
        StudentProfile,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='lender_reviews_received'
    )

    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="1 to 5 star rating"
    )
    comment = models.TextField(max_length=1000, blank=True)
    is_moderated = models.BooleanField(default=False)
    moderation_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'review_type'],
                name='unique_review_per_booking_and_type'
            )
        ]
        indexes = [
            models.Index(fields=['target_listing', '-created_at']),
            models.Index(fields=['target_lender', '-created_at']),
        ]

    def __str__(self):
        target = self.target_listing.title if self.review_type == 'product' and self.target_listing else (
            self.target_lender.user.username if self.target_lender else 'Unknown'
        )
        return f"{self.get_review_type_display()} ({self.rating}★) by {self.reviewer.user.username} for {target}"




