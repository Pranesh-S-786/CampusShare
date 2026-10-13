import math
from datetime import date
from decimal import Decimal
from typing import Optional, Dict, Any, Tuple
from django.db.models import Q
from .models import Listing, Booking


def calculate_booking_quote(
    listing: Listing,
    start_date: date,
    end_date: Optional[date] = None
) -> Dict[str, Any]:
    """
    Calculates estimated duration, rental cost, deposit, and total amount due upfront.
    """
    listing_type = listing.listing_type

    if listing_type == 'sell':
        duration_days = 1
        unit_price = listing.price
        pricing_unit = 'item'
        deposit = Decimal('0.00')
        total_rent = listing.price
        total_due_upfront = listing.price
    elif listing_type == 'lend':
        if end_date and end_date >= start_date:
            duration_days = max((end_date - start_date).days + 1, 1)
        else:
            duration_days = 1
        unit_price = Decimal('0.00')
        pricing_unit = listing.pricing_unit or 'day'
        deposit = listing.deposit_amount or Decimal('0.00')
        total_rent = Decimal('0.00')
        total_due_upfront = deposit
    else:  # 'rent'
        if end_date and end_date >= start_date:
            duration_days = max((end_date - start_date).days + 1, 1)
        else:
            duration_days = 1

        unit_price = listing.price
        pricing_unit = listing.pricing_unit or 'day'
        deposit = listing.deposit_amount or Decimal('0.00')

        if pricing_unit == 'day':
            total_rent = unit_price * Decimal(duration_days)
        elif pricing_unit == 'week':
            weeks = max(math.ceil(duration_days / 7), 1)
            total_rent = unit_price * Decimal(weeks)
        elif pricing_unit == 'month':
            months = max(math.ceil(duration_days / 30), 1)
            total_rent = unit_price * Decimal(months)
        elif pricing_unit == 'semester':
            semesters = max(math.ceil(duration_days / 120), 1)
            total_rent = unit_price * Decimal(semesters)
        else:
            total_rent = unit_price

        total_due_upfront = total_rent + deposit

    return {
        'duration_days': duration_days,
        'unit_price': unit_price,
        'pricing_unit': pricing_unit,
        'deposit_amount': deposit,
        'total_rent': total_rent,
        'total_due_upfront': total_due_upfront,
    }


def check_booking_conflict(
    listing: Listing,
    start_date: date,
    end_date: Optional[date] = None,
    exclude_booking_id: Optional[int] = None
) -> Optional[str]:
    """
    Checks if the proposed dates conflict with existing confirmed bookings or listing status.
    Returns an error message string if there is a conflict, or None if valid.
    """
    if not listing.is_available or listing.status in ['paused', 'archived', 'unavailable']:
        return "This item is currently marked unavailable by the owner."

    effective_end_date = end_date or start_date

    if listing.listing_type == 'sell':
        # If sold or has an accepted/active/completed purchase booking
        confirmed_sale = Booking.objects.filter(
            listing=listing,
            status__in=['accepted', 'active', 'completed']
        )
        if exclude_booking_id:
            confirmed_sale = confirmed_sale.exclude(id=exclude_booking_id)

        if confirmed_sale.exists():
            return "This item already has an accepted or completed purchase request."
        return None

    # For rent and lend listings: check overlapping accepted or active bookings
    overlapping = Booking.objects.filter(
        listing=listing,
        status__in=['accepted', 'active'],
        start_date__lte=effective_end_date,
        end_date__gte=start_date
    )

    if exclude_booking_id:
        overlapping = overlapping.exclude(id=exclude_booking_id)

    conflict = overlapping.first()
    if conflict:
        return (
            f"This item already has a confirmed or active booking from "
            f"{conflict.start_date.strftime('%b %d, %Y')} to "
            f"{conflict.end_date.strftime('%b %d, %Y')}."
        )

    return None
