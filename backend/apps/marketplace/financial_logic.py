from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Tuple
from django.utils import timezone
from .models import Booking, PaymentRecord, SettlementAdjustment, DepositRefund


DISCLAIMER_TEXT = (
    "CampusShare-generated transaction record. Payments and refunds are handled directly between the "
    "parties. This document records the terms and confirmations stored on CampusShare and is not "
    "independent proof of bank settlement."
)


def check_payment_prerequisites_for_pickup(booking: Booking) -> Tuple[bool, str]:
    """
    Enforces Section 1 & 2 of CampusShare specification:
    - Pre-handover rental agreement terms must be reviewed and agreed before pickup QR can be presented.
    - Active disputes on payments or adjustments block pickup until resolved.
    - If revised advance negotiation is pending, pickup is blocked until resolved.
    - Supports in-person cash/UPI payment during campus handover without blocking QR presentation.
    """
    # 0. Check pre-handover mutual terms agreement (Section 1)
    if getattr(booking, 'terms_status', 'agreed') not in ['agreed']:
        return False, (
            "Cannot generate pickup QR: Rental terms must be reviewed and agreed by both parties before item handover."
        )

    # 1. Check for active payment disputes
    if booking.payments.filter(status='disputed').exists():
        return False, (
            "Cannot proceed with pickup: There is a disputed payment declaration for this booking. "
            "The lender and borrower must resolve payment discrepancies before handover."
        )

    # 2. Check for active adjustment disputes
    if booking.adjustments.filter(status='disputed').exists():
        return False, (
            "Cannot proceed with pickup: There is an active disputed adjustment on this booking."
        )

    # 3. Check for pending advance negotiation
    if getattr(booking, 'advance_negotiation_status', 'agreed') == 'proposed':
        return False, (
            "Cannot proceed with pickup: A revised advance payment proposal is currently under negotiation. "
            "Both borrower and lender must agree to the revised amount before item handover."
        )

    return True, ""


def check_order_closure_eligibility(booking: Booking) -> Tuple[bool, str]:
    """
    Validates order closure conditions (Section 4):
    1. The return QR has been successfully verified (return_confirmed_at is set).
    2. Both parties have approved the same final bill (settlement_agreed_by_borrower and settlement_agreed_by_lender).
    3. No unresolved mandatory settlement disputes remain.
    4. All required direct-payment and refund confirmations have been completed:
       - If net_borrower_owes_lender > 0: confirmed payments must cover obligations.
       - If net_lender_owes_borrower > 0: confirmed refund must cover refund amount.
    """
    if not booking.return_confirmed_at:
        return False, "Cannot close order: Return QR handover has not yet been verified."

    borrower_agreed = getattr(booking, 'settlement_agreed_by_borrower', False)
    lender_agreed = getattr(booking, 'settlement_agreed_by_lender', False)
    if not (borrower_agreed and lender_agreed):
        return False, "Cannot close order: Both parties must approve the same final bill."

    if booking.payments.filter(status='disputed').exists():
        return False, "Cannot close order: There is an active disputed payment declaration."

    if booking.adjustments.filter(status='disputed').exists():
        return False, "Cannot close order: There is an active disputed adjustment."

    fin = get_booking_financial_summary(booking)

    net_borrower = Decimal(fin['net_borrower_owes_lender'])
    net_lender = Decimal(fin['net_lender_owes_borrower'])

    if net_borrower > Decimal('0.00'):
        confirmed_rev = Decimal(fin['total_confirmed_received'])
        total_ob = Decimal(fin['total_obligations'])
        if confirmed_rev < total_ob:
            outstanding = total_ob - confirmed_rev
            return False, f"Awaiting payment confirmation: ₹{outstanding:.2f} remains outstanding to be confirmed by lender."

    if net_lender > Decimal('0.00'):
        refund_obj = getattr(booking, 'deposit_refund', None)
        if not refund_obj or refund_obj.status != 'confirmed':
            outstanding = net_lender - Decimal(fin['refund_confirmed_amount'])
            return False, f"Awaiting refund confirmation: ₹{outstanding:.2f} refund remains to be confirmed by borrower."

    return True, ""


def get_booking_financial_summary(booking: Booking) -> Dict[str, Any]:
    """
    Generates the authoritative, decimal-precise 17-item dynamic itemized bill
    and settlement record specified in Sections 6 & 7 of the CampusShare specification.
    """
    currency = booking.currency or 'INR'
    original_rent_estimate = booking.calculated_total_rent or Decimal('0.00')

    # 1. Authoritative Agreed Advance / Deposit
    agreed_deposit = booking.agreed_advance_amount if booking.agreed_advance_amount is not None else (
        booking.snapshot_deposit_amount or Decimal('0.00')
    )

    # 2. Authoritative Final Rent Determination (Section 3 & 4)
    if getattr(booking, 'rent_adjustment_status', 'none') == 'accepted' and booking.lender_proposed_rent is not None:
        final_rent = booking.lender_proposed_rent
        rent_status_label = 'mutually_adjusted'
    elif booking.actual_rent_calculated is not None:
        final_rent = booking.actual_rent_calculated
        rent_status_label = 'system_calculated'
    else:
        final_rent = original_rent_estimate
        rent_status_label = 'original_estimate'

    total_upfront = final_rent + agreed_deposit

    # 3. Payments breakdown
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
    total_disputed_payments = rent_disputed + deposit_disputed + other_disputed

    # 4. Penalties & Adjustments Breakdown (Sections 4 & 5)
    adjustments = booking.adjustments.all()
    accepted_late_fees = Decimal('0.00')
    accepted_damage_fees = Decimal('0.00')
    other_accepted_adjustments = Decimal('0.00')

    proposed_adjustments_total = Decimal('0.00')
    disputed_adjustments_total = Decimal('0.00')

    adjustment_items = []
    for adj in adjustments:
        amt = adj.amount or Decimal('0.00')
        if adj.status == 'accepted':
            if adj.adjustment_type == 'late_fee':
                accepted_late_fees += amt
            elif adj.adjustment_type == 'damage':
                accepted_damage_fees += amt
            else:
                other_accepted_adjustments += amt
        elif adj.status == 'proposed':
            proposed_adjustments_total += amt
        elif adj.status == 'disputed':
            disputed_adjustments_total += amt

        adjustment_items.append({
            'id': adj.id,
            'type': adj.adjustment_type,
            'type_display': adj.get_adjustment_type_display(),
            'amount': str(amt),
            'reason': adj.reason,
            'description': adj.description,
            'evidence_url': adj.evidence_url,
            'status': adj.status,
            'proposed_by_name': adj.proposed_by.full_name,
            'response_note': adj.response_note,
        })

    total_accepted_penalties = accepted_late_fees + accepted_damage_fees + other_accepted_adjustments

    # 5. Authoritative Final Net Settlement Reconciliation (Section 6)
    # Total financial obligations of the borrower for this rental
    total_obligations = final_rent + total_accepted_penalties

    # Total confirmed money transferred by borrower to lender
    total_confirmed_from_borrower = total_confirmed_received

    # Calculate net balance
    if total_confirmed_from_borrower > total_obligations:
        net_lender_owes_borrower = total_confirmed_from_borrower - total_obligations
        net_borrower_owes_lender = Decimal('0.00')
    elif total_obligations > total_confirmed_from_borrower:
        net_borrower_owes_lender = total_obligations - total_confirmed_from_borrower
        net_lender_owes_borrower = Decimal('0.00')
    else:
        net_lender_owes_borrower = Decimal('0.00')
        net_borrower_owes_lender = Decimal('0.00')

    # 6. Refund Tracking (DepositRefund model)
    refund_obj = getattr(booking, 'deposit_refund', None)
    refund_status = 'not_applicable'
    refund_declared_amount = Decimal('0.00')
    refund_confirmed_amount = Decimal('0.00')

    if net_lender_owes_borrower > Decimal('0.00') or (agreed_deposit > Decimal('0.00') and booking.status in ['returned', 'completed']):
        if refund_obj:
            refund_status = refund_obj.status
            if refund_obj.status in ['declared', 'confirmed']:
                refund_declared_amount = refund_obj.net_refund_amount
            if refund_obj.status == 'confirmed':
                refund_confirmed_amount = refund_obj.net_refund_amount
        else:
            refund_status = 'pending_declaration'

    # 7. Settlement Sign-Off & State Machine (Section 6)
    has_disputes = (
        (total_disputed_payments > Decimal('0.00')) or
        (disputed_adjustments_total > Decimal('0.00')) or
        (refund_obj and refund_obj.status == 'disputed')
    )

    borrower_agreed = getattr(booking, 'settlement_agreed_by_borrower', False)
    lender_agreed = getattr(booking, 'settlement_agreed_by_lender', False)
    is_mutually_agreed = borrower_agreed and lender_agreed

    if has_disputes:
        settlement_status = 'disputed'
    elif booking.status in ['completed']:
        if net_lender_owes_borrower > Decimal('0.00'):
            if refund_obj and refund_obj.status == 'confirmed':
                settlement_status = 'settled'
            else:
                settlement_status = 'agreed_payment_pending'
        elif net_borrower_owes_lender > Decimal('0.00'):
            balance_confirmed = (total_confirmed_from_borrower >= total_obligations)
            settlement_status = 'settled' if balance_confirmed else 'agreed_payment_pending'
        else:
            settlement_status = 'settled'
    elif booking.status == 'returned':
        if not is_mutually_agreed:
            if borrower_agreed and not lender_agreed:
                settlement_status = 'awaiting_lender_confirmation'
            elif lender_agreed and not borrower_agreed:
                settlement_status = 'awaiting_borrower_confirmation'
            else:
                settlement_status = 'settlement_proposed'
        else:
            # Both parties agree to the bill terms!
            # Check if money transfer is still pending
            if net_lender_owes_borrower > Decimal('0.00'):
                if refund_obj and refund_obj.status == 'confirmed':
                    settlement_status = 'settled'
                elif refund_obj and refund_obj.status == 'declared':
                    settlement_status = 'payment_declared'
                else:
                    settlement_status = 'agreed_payment_pending'
            elif net_borrower_owes_lender > Decimal('0.00'):
                settlement_status = 'agreed_payment_pending'
            else:
                settlement_status = 'settled'
    elif booking.status == 'active':
        settlement_status = 'active_rental'
    elif booking.status == 'accepted':
        settlement_status = 'pre_pickup'
    else:
        settlement_status = booking.status

    invoice_number = f"CS-BILL-{booking.id}-{booking.created_at.year}"

    # Build history of revisions and status changes
    bill_history = list(booking.status_history or [])

    net_refundable_deposit = max(Decimal('0.00'), agreed_deposit - total_accepted_penalties)

    return {
        # 1. Booking reference and product details
        'invoice_number': invoice_number,
        'booking_id': booking.id,
        'listing_id': booking.listing_id,
        'listing_title': booking.listing.title,
        'currency': currency,
        'booking_type': booking.booking_type,
        'borrower_name': booking.borrower.full_name,
        'borrower_email': booking.borrower.college_email,
        'lender_name': booking.lender.full_name,
        'lender_email': booking.lender.college_email,

        # 2. Agreed rental rate and billing unit
        'agreed_rental_rate': str(booking.snapshot_price),
        'pricing_unit': booking.snapshot_pricing_unit,

        # 3. Planned rental start and end
        'planned_start_date': booking.start_date.isoformat(),
        'planned_end_date': booking.end_date.isoformat() if booking.end_date else booking.start_date.isoformat(),
        'planned_duration_days': booking.duration_days,

        # 4. Verified pickup and actual return timestamps
        'pickup_confirmed_at': booking.pickup_confirmed_at.isoformat() if booking.pickup_confirmed_at else None,
        'return_confirmed_at': booking.return_confirmed_at.isoformat() if booking.return_confirmed_at else None,

        # 5. Actual rental duration
        'actual_duration_display': getattr(booking, 'actual_duration_display', '') or f"{booking.duration_days} day(s)",

        # 6. Original rent estimate
        'original_rent_estimate': str(original_rent_estimate),

        # 7. System-calculated final rent
        'system_calculated_rent': str(booking.actual_rent_calculated if booking.actual_rent_calculated is not None else original_rent_estimate),

        # 8. Accepted rent adjustment and reason
        'rent_adjustment_status': getattr(booking, 'rent_adjustment_status', 'none'),
        'lender_proposed_rent': str(booking.lender_proposed_rent) if booking.lender_proposed_rent is not None else None,
        'rent_adjustment_reason': getattr(booking, 'rent_adjustment_reason', ''),
        'final_agreed_rent': str(final_rent),
        'rent_status_label': rent_status_label,

        # 9. Advance/deposit agreed, declared paid, and receipt-confirmed
        'agreed_advance_deposit': str(agreed_deposit),
        'advance_negotiation_status': getattr(booking, 'advance_negotiation_status', 'agreed'),
        'advance_declared_paid': str(deposit_declared),
        'advance_confirmed_received': str(deposit_confirmed),
        'advance_disputed': str(deposit_disputed),
        'is_advance_confirmed': (deposit_confirmed >= agreed_deposit) if agreed_deposit > Decimal('0.00') else True,

        # 10. Late penalty, calculation, and acceptance status
        'accepted_late_fees': str(accepted_late_fees),

        # 11. Damage penalty, reason, evidence reference, and acceptance status
        'accepted_damage_fees': str(accepted_damage_fees),

        # 12. Other supported adjustments
        'other_accepted_adjustments': str(other_accepted_adjustments),
        'total_accepted_penalties': str(total_accepted_penalties),
        'adjustment_items': adjustment_items,
        'proposed_adjustments_total': str(proposed_adjustments_total),
        'disputed_adjustments_total': str(disputed_adjustments_total),

        # 13. Final net amount owed by each party
        'total_obligations': str(total_obligations),
        'total_confirmed_received': str(total_confirmed_received),
        'net_lender_owes_borrower': str(net_lender_owes_borrower),
        'net_borrower_owes_lender': str(net_borrower_owes_lender),

        # 14. Deposit/advance refund amount and status
        'net_refundable_deposit': str(net_refundable_deposit),
        'refund_status': refund_status,
        'refund_declared_amount': str(refund_declared_amount),
        'refund_confirmed_amount': str(refund_confirmed_amount),

        # 15. Settlement agreement status
        'settlement_agreed_by_borrower': borrower_agreed,
        'settlement_agreed_by_lender': lender_agreed,
        'is_mutually_agreed': is_mutually_agreed,
        'settlement_status': settlement_status,

        # 16. Individual payment/refund confirmation statuses
        'rent_confirmed': str(rent_confirmed),
        'deposit_confirmed': str(deposit_confirmed),
        'total_declared_paid': str(total_declared_paid),
        'total_disputed': str(total_disputed_payments),
        'has_disputes': has_disputes,

        # 17. Bill revision history and relevant timestamps
        'bill_history': bill_history,
        'created_at': booking.created_at.isoformat(),
        'updated_at': booking.updated_at.isoformat(),

        # Backward-compatible fields
        'agreed_base_rent': str(original_rent_estimate),
        'agreed_deposit': str(agreed_deposit),
        'total_due_upfront': str(total_upfront),
        'rent_declared': str(rent_declared),
        'rent_disputed': str(rent_disputed),
        'rent_outstanding': str(max(final_rent - rent_confirmed, Decimal('0.00'))),
        'is_rent_settled': (rent_confirmed >= final_rent),
        'deposit_declared': str(deposit_declared),
        'deposit_disputed': str(deposit_disputed),
        'deposit_outstanding': str(max(agreed_deposit - deposit_confirmed, Decimal('0.00'))),
        'approved_deductions': str(total_accepted_penalties),
        'proposed_adjustments': str(proposed_adjustments_total),
        'disputed_adjustments': str(disputed_adjustments_total),
        'has_disputed_adjustments': (disputed_adjustments_total > Decimal('0.00')),
        'other_declared': str(other_declared),
        'other_confirmed': str(other_confirmed),
        'other_disputed': str(other_disputed),

        # Disclaimer
        'disclaimer': DISCLAIMER_TEXT,
    }
