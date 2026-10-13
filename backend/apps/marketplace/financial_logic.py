from decimal import Decimal
from typing import Dict, Any, List
from django.utils import timezone
from .models import Booking, PaymentRecord, SettlementAdjustment, DepositRefund


def get_booking_financial_summary(booking: Booking) -> Dict[str, Any]:
    """
    Computes a comprehensive, decimal-precise financial summary for a booking.
    Calculates agreed amounts, declared payments, confirmed receipts,
    disputed amounts, approved adjustments/deductions, and net deposit refund.
    """
    currency = booking.currency or 'INR'
    base_rent = booking.calculated_total_rent or Decimal('0.00')
    agreed_deposit = booking.snapshot_deposit_amount or Decimal('0.00')
    total_upfront = booking.total_due_upfront or (base_rent + agreed_deposit)

    # Fetch all payment records for this booking
    payments = booking.payments.all()
    
    rent_declared = Decimal('0.00')
    rent_confirmed = Decimal('0.00')
    rent_disputed = Decimal('0.00')

    deposit_declared = Decimal('0.00')
    deposit_confirmed = Decimal('0.00')
    deposit_disputed = Decimal('0.00')

    other_declared = Decimal('0.00')
    other_confirmed = Decimal('0.00')
    other_disputed = Decimal('0.00')

    for p in payments:
        amt = p.amount or Decimal('0.00')
        if p.purpose == 'rent':
            if p.status in ['declared', 'confirmed']:
                rent_declared += amt
            if p.status == 'confirmed':
                rent_confirmed += amt
            elif p.status == 'disputed':
                rent_disputed += amt
        elif p.purpose == 'deposit':
            if p.status in ['declared', 'confirmed']:
                deposit_declared += amt
            if p.status == 'confirmed':
                deposit_confirmed += amt
            elif p.status == 'disputed':
                deposit_disputed += amt
        else:
            if p.status in ['declared', 'confirmed']:
                other_declared += amt
            if p.status == 'confirmed':
                other_confirmed += amt
            elif p.status == 'disputed':
                other_disputed += amt

    total_declared_paid = rent_declared + deposit_declared + other_declared
    total_confirmed_received = rent_confirmed + deposit_confirmed + other_confirmed
    total_disputed = rent_disputed + deposit_disputed + other_disputed

    # Adjustments (deductions / extra charges)
    adjustments = booking.adjustments.all()
    approved_deductions = Decimal('0.00')
    proposed_adjustments = Decimal('0.00')
    disputed_adjustments = Decimal('0.00')

    for adj in adjustments:
        amt = adj.amount or Decimal('0.00')
        if adj.status == 'accepted':
            approved_deductions += amt
        elif adj.status == 'proposed':
            proposed_adjustments += amt
        elif adj.status == 'disputed':
            disputed_adjustments += amt

    # Net refundable deposit balance
    # Cannot exceed deposit amount and cannot be negative
    if agreed_deposit > Decimal('0.00'):
        net_refundable_deposit = max(agreed_deposit - approved_deductions, Decimal('0.00'))
    else:
        net_refundable_deposit = Decimal('0.00')

    # Deposit refund record
    refund_obj = getattr(booking, 'deposit_refund', None)
    refund_status = 'not_applicable' if agreed_deposit == Decimal('0.00') else 'pending_return'
    refund_declared_amount = Decimal('0.00')
    refund_confirmed_amount = Decimal('0.00')

    if booking.status in ['returned', 'completed'] and agreed_deposit > Decimal('0.00'):
        if refund_obj:
            refund_status = refund_obj.status
            if refund_obj.status in ['declared', 'confirmed']:
                refund_declared_amount = refund_obj.net_refund_amount
            if refund_obj.status == 'confirmed':
                refund_confirmed_amount = refund_obj.net_refund_amount
        else:
            refund_status = 'pending_declaration'

    # Determine overall settlement status
    has_disputes = (total_disputed > 0) or (disputed_adjustments > 0) or (refund_obj and refund_obj.status == 'disputed')
    if has_disputes:
        settlement_status = 'disputed'
    elif booking.status in ['completed']:
        if agreed_deposit > Decimal('0.00'):
            if refund_obj and refund_obj.status == 'confirmed':
                settlement_status = 'settled'
            else:
                settlement_status = 'pending_settlement'
        else:
            settlement_status = 'settled'
    elif booking.status == 'returned':
        if agreed_deposit > Decimal('0.00') and (not refund_obj or refund_obj.status != 'confirmed'):
            settlement_status = 'pending_settlement'
        else:
            settlement_status = 'ready_for_completion'
    elif booking.status == 'active':
        settlement_status = 'active_rental'
    elif booking.status == 'accepted':
        settlement_status = 'pre_pickup'
    else:
        settlement_status = booking.status

    invoice_number = f"CS-BILL-{booking.id}-{booking.created_at.year}"

    disclaimer = (
        "CampusShare-generated transaction record. Payments and refunds are handled directly between "
        "the parties. This document records the terms and confirmations stored on CampusShare and is not "
        "independent proof of bank settlement."
    )

    return {
        'invoice_number': invoice_number,
        'booking_id': booking.id,
        'currency': currency,
        'booking_type': booking.booking_type,
        'listing_title': booking.listing.title,
        'start_date': booking.start_date.isoformat(),
        'end_date': booking.end_date.isoformat() if booking.end_date else booking.start_date.isoformat(),
        'duration_days': booking.duration_days,
        'rental_rate': str(booking.snapshot_price),
        'pricing_unit': booking.snapshot_pricing_unit,
        
        # Agreed terms
        'agreed_base_rent': str(base_rent),
        'agreed_deposit': str(agreed_deposit),
        'total_due_upfront': str(total_upfront),

        # Rent breakdown
        'rent_declared': str(rent_declared),
        'rent_confirmed': str(rent_confirmed),
        'rent_disputed': str(rent_disputed),
        'rent_outstanding': str(max(base_rent - rent_confirmed, Decimal('0.00'))),
        'is_rent_settled': (rent_confirmed >= base_rent),

        # Deposit breakdown
        'deposit_declared': str(deposit_declared),
        'deposit_confirmed': str(deposit_confirmed),
        'deposit_disputed': str(deposit_disputed),
        'deposit_outstanding': str(max(agreed_deposit - deposit_confirmed, Decimal('0.00'))),
        'is_deposit_confirmed': (deposit_confirmed >= agreed_deposit) if agreed_deposit > Decimal('0.00') else True,

        # Overall payment totals
        'total_declared_paid': str(total_declared_paid),
        'total_confirmed_received': str(total_confirmed_received),
        'total_disputed': str(total_disputed),
        'total_outstanding_upfront': str(max(total_upfront - total_confirmed_received, Decimal('0.00'))),

        # Adjustments breakdown
        'approved_deductions': str(approved_deductions),
        'proposed_adjustments': str(proposed_adjustments),
        'disputed_adjustments': str(disputed_adjustments),
        'has_disputed_adjustments': disputed_adjustments > Decimal('0.00'),

        # Net deposit refund calculation
        'net_refundable_deposit': str(net_refundable_deposit),
        'refund_status': refund_status,
        'refund_declared_amount': str(refund_declared_amount),
        'refund_confirmed_amount': str(refund_confirmed_amount),

        # Settlement state
        'settlement_status': settlement_status,
        'has_disputes': has_disputes,
        'disclaimer': disclaimer,
    }


def check_payment_prerequisites_for_pickup(booking: Booking) -> tuple[bool, str]:
    """
    Validates whether the booking satisfies financial prerequisites before pickup.
    - If any payment has a pending dispute, blocks pickup.
    - If rent/deposit is required, checks whether borrower declared payment and warns if unconfirmed.
    Returns (can_proceed: bool, error_or_warning_message: str).
    """
    # Check for active disputed payments
    disputed_payments = booking.payments.filter(status='disputed')
    if disputed_payments.exists():
        return False, (
            "Cannot proceed with pickup: There is a disputed payment declaration for this booking. "
            "The lender and borrower must resolve payment discrepancies before handover."
        )

    # Check for disputed adjustments
    if booking.adjustments.filter(status='disputed').exists():
        return False, (
            "Cannot proceed with pickup: There is an active disputed adjustment on this booking."
        )

    return True, ""
