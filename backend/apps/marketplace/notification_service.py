import logging
from datetime import timedelta
from django.utils import timezone
from .models import Notification

logger = logging.getLogger(__name__)


def create_notification(
    recipient,
    notification_type,
    title,
    message,
    actor=None,
    booking=None,
    listing=None,
    wanted_request=None,
    target_modal='',
    target_id='',
):
    """
    Creates a notification for a recipient while preventing self-notifications
    and deduplicating identical events triggered within a short time window.
    """
    if not recipient:
        return None

    # Never notify oneself
    if actor and actor.id == recipient.id:
        return None

    try:
        # Check for duplicate notification within the last 60 seconds (unless new message)
        if notification_type != 'new_message':
            recent_duplicate = Notification.objects.filter(
                recipient=recipient,
                notification_type=notification_type,
                target_modal=target_modal,
                target_id=str(target_id),
                created_at__gte=timezone.now() - timedelta(seconds=60)
            ).first()
            if recent_duplicate:
                return recent_duplicate

        notification = Notification.objects.create(
            recipient=recipient,
            actor=actor,
            notification_type=notification_type,
            title=title.strip()[:200],
            message=message.strip(),
            booking=booking,
            listing=listing,
            wanted_request=wanted_request,
            target_modal=target_modal,
            target_id=str(target_id),
        )
        return notification
    except Exception as e:
        logger.error(f"Failed to create notification for profile {recipient.id}: {e}", exc_info=True)
        return None


def notify_booking_request(booking):
    actor_name = booking.borrower.user.get_full_name() or booking.borrower.user.username
    title = "New Booking Request"
    message = f"{actor_name} requested to {booking.booking_type} '{booking.listing.title}' ({booking.start_date} to {booking.end_date})."
    return create_notification(
        recipient=booking.lender,
        actor=booking.borrower,
        notification_type='booking_request',
        title=title,
        message=message,
        booking=booking,
        listing=booking.listing,
        target_modal='incoming_bookings',
        target_id=str(booking.id),
    )


def notify_booking_accepted(booking):
    actor_name = booking.lender.user.get_full_name() or booking.lender.user.username
    title = "Booking Request Accepted"
    message = f"{actor_name} accepted your booking request for '{booking.listing.title}'."
    return create_notification(
        recipient=booking.borrower,
        actor=booking.lender,
        notification_type='booking_accepted',
        title=title,
        message=message,
        booking=booking,
        listing=booking.listing,
        target_modal='my_bookings',
        target_id=str(booking.id),
    )


def notify_booking_declined(booking, note=''):
    actor_name = booking.lender.user.get_full_name() or booking.lender.user.username
    title = "Booking Request Declined"
    reason = f" Note: {note}" if note else ""
    message = f"{actor_name} declined your booking request for '{booking.listing.title}'.{reason}"
    return create_notification(
        recipient=booking.borrower,
        actor=booking.lender,
        notification_type='booking_declined',
        title=title,
        message=message,
        booking=booking,
        listing=booking.listing,
        target_modal='my_bookings',
        target_id=str(booking.id),
    )


def notify_booking_cancelled(booking, cancelled_by):
    is_borrower = (cancelled_by.id == booking.borrower_id)
    recipient = booking.lender if is_borrower else booking.borrower
    target_modal = 'incoming_bookings' if is_borrower else 'my_bookings'
    actor_name = cancelled_by.user.get_full_name() or cancelled_by.user.username

    title = "Booking Cancelled"
    message = f"{actor_name} cancelled the booking for '{booking.listing.title}'."
    return create_notification(
        recipient=recipient,
        actor=cancelled_by,
        notification_type='booking_cancelled',
        title=title,
        message=message,
        booking=booking,
        listing=booking.listing,
        target_modal=target_modal,
        target_id=str(booking.id),
    )


def notify_handover_verified(booking, action_type, verified_by):
    actor_name = verified_by.user.get_full_name() or verified_by.user.username
    if action_type == 'pickup':
        recipient = booking.borrower if verified_by.id == booking.lender_id else booking.lender
        target_modal = 'incoming_bookings' if recipient.id == booking.lender_id else 'my_bookings'
        title = "Pickup QR Verified"
        message = f"Pickup handover for '{booking.listing.title}' was successfully verified."
        n_type = 'pickup_confirmed'
    else:
        recipient = booking.lender if verified_by.id == booking.borrower_id else booking.borrower
        target_modal = 'financials'
        title = "Return QR Verified"
        message = f"Return handover for '{booking.listing.title}' was verified. Settlement is ready."
        n_type = 'return_confirmed'

    return create_notification(
        recipient=recipient,
        actor=verified_by,
        notification_type=n_type,
        title=title,
        message=message,
        booking=booking,
        listing=booking.listing,
        target_modal=target_modal,
        target_id=str(booking.id),
    )


def notify_payment_declared(payment):
    actor_name = payment.payer.user.get_full_name() or payment.payer.user.username
    title = "Payment Declared"
    # Never expose full sensitive account numbers in notifications
    message = f"{actor_name} declared a payment of Rs. {payment.amount} for {payment.purpose} via {payment.payment_method}."
    return create_notification(
        recipient=payment.recipient,
        actor=payment.payer,
        notification_type='payment_declared',
        title=title,
        message=message,
        booking=payment.booking,
        listing=payment.booking.listing,
        target_modal='financials',
        target_id=str(payment.booking_id),
    )


def notify_payment_confirmed(payment):
    actor_name = payment.recipient.user.get_full_name() or payment.recipient.user.username
    title = "Payment Confirmed"
    message = f"{actor_name} confirmed receipt of your payment of Rs. {payment.amount}."
    return create_notification(
        recipient=payment.payer,
        actor=payment.recipient,
        notification_type='payment_confirmed',
        title=title,
        message=message,
        booking=payment.booking,
        listing=payment.booking.listing,
        target_modal='financials',
        target_id=str(payment.booking_id),
    )


def notify_payment_disputed(payment):
    actor_name = payment.recipient.user.get_full_name() or payment.recipient.user.username
    title = "Payment Disputed"
    message = f"{actor_name} flagged an issue with your payment declaration of Rs. {payment.amount}."
    return create_notification(
        recipient=payment.payer,
        actor=payment.recipient,
        notification_type='payment_disputed',
        title=title,
        message=message,
        booking=payment.booking,
        listing=payment.booking.listing,
        target_modal='financials',
        target_id=str(payment.booking_id),
    )


def notify_adjustment_proposed(adjustment):
    actor_name = adjustment.proposed_by.user.get_full_name() or adjustment.proposed_by.user.username
    recipient = adjustment.booking.borrower if adjustment.proposed_by_id == adjustment.booking.lender_id else adjustment.booking.lender
    title = "Financial Adjustment Proposed"
    message = f"{actor_name} proposed a {adjustment.adjustment_type} adjustment of Rs. {adjustment.amount}."
    return create_notification(
        recipient=recipient,
        actor=adjustment.proposed_by,
        notification_type='adjustment_proposed',
        title=title,
        message=message,
        booking=adjustment.booking,
        listing=adjustment.booking.listing,
        target_modal='financials',
        target_id=str(adjustment.booking_id),
    )


def notify_adjustment_resolved(adjustment, resolution, actor):
    title = f"Adjustment {resolution.title()}"
    message = f"Your proposed adjustment of Rs. {adjustment.amount} was {resolution}."
    return create_notification(
        recipient=adjustment.proposed_by,
        actor=actor,
        notification_type='adjustment_resolved',
        title=title,
        message=message,
        booking=adjustment.booking,
        listing=adjustment.booking.listing,
        target_modal='financials',
        target_id=str(adjustment.booking_id),
    )


def notify_refund_declared(refund):
    lender = refund.booking.lender
    borrower = refund.booking.borrower
    actor_name = lender.user.get_full_name() or lender.user.username
    title = "Deposit Refund Declared"
    message = f"{actor_name} declared a deposit refund of Rs. {refund.net_refund_amount} via {refund.refund_method}."
    return create_notification(
        recipient=borrower,
        actor=lender,
        notification_type='refund_declared',
        title=title,
        message=message,
        booking=refund.booking,
        listing=refund.booking.listing,
        target_modal='financials',
        target_id=str(refund.booking_id),
    )


def notify_refund_confirmed(refund):
    lender = refund.booking.lender
    borrower = refund.booking.borrower
    actor_name = borrower.user.get_full_name() or borrower.user.username
    title = "Deposit Refund Confirmed"
    message = f"{actor_name} confirmed receipt of the Rs. {refund.net_refund_amount} deposit refund."
    return create_notification(
        recipient=lender,
        actor=borrower,
        notification_type='refund_confirmed',
        title=title,
        message=message,
        booking=refund.booking,
        listing=refund.booking.listing,
        target_modal='financials',
        target_id=str(refund.booking_id),
    )


def notify_wanted_response(wanted_response):
    actor_name = wanted_response.responder.user.get_full_name() or wanted_response.responder.user.username
    title = "Response on Wanted Item"
    message = f"{actor_name} responded to your request for '{wanted_response.request.title}'."
    return create_notification(
        recipient=wanted_response.request.requester,
        actor=wanted_response.responder,
        notification_type='wanted_response',
        title=title,
        message=message,
        wanted_request=wanted_response.request,
        target_modal='wanted',
        target_id=str(wanted_response.request_id),
    )


def notify_wanted_response_status(wanted_response, new_status, actor):
    title = "Wanted Response Updated"
    message = f"Your offer for '{wanted_response.request.title}' was marked as {new_status}."
    return create_notification(
        recipient=wanted_response.responder,
        actor=actor,
        notification_type='wanted_response_status',
        title=title,
        message=message,
        wanted_request=wanted_response.request,
        target_modal='wanted',
        target_id=str(wanted_response.request_id),
    )


def notify_new_message(message_obj):
    recipient = message_obj.conversation.get_other_participant(message_obj.sender)
    actor_name = message_obj.sender.user.get_full_name() or message_obj.sender.user.username
    title = f"New Message from {actor_name}"
    # Truncate preview and avoid exposing any raw html
    preview = message_obj.content[:80].strip()
    if len(message_obj.content) > 80:
        preview += "..."
    return create_notification(
        recipient=recipient,
        actor=message_obj.sender,
        notification_type='new_message',
        title=title,
        message=preview,
        booking=message_obj.conversation.booking,
        listing=message_obj.conversation.listing,
        wanted_request=message_obj.conversation.wanted_request,
        target_modal='messages',
        target_id=str(message_obj.conversation_id),
    )


def notify_relist_prompt(booking):
    return create_notification(
        recipient=booking.lender,
        actor=booking.borrower,
        notification_type='relist_prompt',
        title='Re-listing Option Available',
        message=f"'{booking.listing.title}' has been returned. Would you like to list this product again?",
        booking=booking,
        listing=booking.listing,
        target_modal='my_listings',
        target_id=str(booking.listing_id),
    )


def notify_review_requested(booking):
    return create_notification(
        recipient=booking.borrower,
        actor=booking.lender,
        notification_type='review_requested',
        title='Review Your Experience',
        message=f"Your rental of '{booking.listing.title}' is complete! Please rate the product and your peer lender.",
        booking=booking,
        listing=booking.listing,
        target_modal='financials',
        target_id=str(booking.id),
    )

