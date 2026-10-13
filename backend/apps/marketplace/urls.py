from django.urls import path
from .views import (
    CategoryListView,
    ListingListView,
    ListingDetailView,
    ListingArchiveView,
    MyListingsView,
    ListingImageUploadView,
    BookingQuoteView,
    BookingCreateView,
    MyBookingsView,
    IncomingBookingsView,
    BookingDetailView,
    BookingActionView,
    BookingCancelView,
    BookingGenerateQRView,
    BookingVerifyHandoverView,
    WantedItemRequestListView,
    WantedItemRequestDetailView,
    WantedItemResponseView,
    WantedItemResponseActionView,
    # Stage 8
    BookingFinancialsView,
    PaymentDeclareView,
    PaymentConfirmView,
    PaymentDisputeView,
    AdjustmentProposeView,
    AdjustmentRespondView,
    DepositRefundDeclareView,
    DepositRefundConfirmView,
    BookingSettlementBillView,
    PaymentEvidenceUploadView,
    # Stage 9
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    UnreadCountsView,
    ConversationListView,
    ConversationDetailView,
    ConversationMessagesView,
)

urlpatterns = [
    # Listings & Categories
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('listings/', ListingListView.as_view(), name='listing-list'),
    path('listings/<int:pk>/', ListingDetailView.as_view(), name='listing-detail'),
    path('listings/<int:pk>/archive/', ListingArchiveView.as_view(), name='listing-archive'),
    path('my-listings/', MyListingsView.as_view(), name='my-listings'),
    path('upload-image/', ListingImageUploadView.as_view(), name='upload-listing-image'),

    # Bookings & Terms
    path('bookings/quote/', BookingQuoteView.as_view(), name='booking-quote'),
    path('bookings/', BookingCreateView.as_view(), name='booking-create'),
    path('my-bookings/', MyBookingsView.as_view(), name='my-bookings'),
    path('incoming-bookings/', IncomingBookingsView.as_view(), name='incoming-bookings'),
    path('bookings/<int:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('bookings/<int:pk>/action/', BookingActionView.as_view(), name='booking-action'),
    path('bookings/<int:pk>/cancel/', BookingCancelView.as_view(), name='booking-cancel'),

    # Stage 7: QR Handover and Return Verification
    path('bookings/<int:pk>/generate-qr/', BookingGenerateQRView.as_view(), name='booking-generate-qr'),
    path('bookings/<int:pk>/verify-handover/', BookingVerifyHandoverView.as_view(), name='booking-verify-handover'),

    # Stage 8: Financial Records, Billing & Direct Payment Tracking
    path('bookings/<int:pk>/financials/', BookingFinancialsView.as_view(), name='booking-financials'),
    path('bookings/<int:pk>/payments/declare/', PaymentDeclareView.as_view(), name='payment-declare'),
    path('payments/<int:pk>/confirm/', PaymentConfirmView.as_view(), name='payment-confirm'),
    path('payments/<int:pk>/dispute/', PaymentDisputeView.as_view(), name='payment-dispute'),
    path('bookings/<int:pk>/adjustments/propose/', AdjustmentProposeView.as_view(), name='adjustment-propose'),
    path('adjustments/<int:pk>/respond/', AdjustmentRespondView.as_view(), name='adjustment-respond'),
    path('bookings/<int:pk>/refund/declare/', DepositRefundDeclareView.as_view(), name='refund-declare'),
    path('bookings/<int:pk>/refund/confirm/', DepositRefundConfirmView.as_view(), name='refund-confirm'),
    path('bookings/<int:pk>/settlement-bill/', BookingSettlementBillView.as_view(), name='booking-settlement-bill'),
    path('upload-payment-evidence/', PaymentEvidenceUploadView.as_view(), name='upload-payment-evidence'),

    # Wanted Item Requests
    path('wanted-requests/', WantedItemRequestListView.as_view(), name='wanted-request-list'),
    path('wanted-requests/<int:pk>/', WantedItemRequestDetailView.as_view(), name='wanted-request-detail'),
    path('wanted-requests/<int:pk>/respond/', WantedItemResponseView.as_view(), name='wanted-request-respond'),
    path('wanted-responses/<int:pk>/action/', WantedItemResponseActionView.as_view(), name='wanted-response-action'),

    # Stage 9: Notifications & User-to-User Messaging
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('notifications/read-all/', NotificationMarkAllReadView.as_view(), name='notification-mark-all-read'),
    path('unread-counts/', UnreadCountsView.as_view(), name='unread-counts'),
    path('conversations/', ConversationListView.as_view(), name='conversation-list'),
    path('conversations/<int:pk>/', ConversationDetailView.as_view(), name='conversation-detail'),
    path('conversations/<int:pk>/messages/', ConversationMessagesView.as_view(), name='conversation-messages'),
]

