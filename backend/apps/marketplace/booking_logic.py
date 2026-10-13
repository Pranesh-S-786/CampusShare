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

    # For rent and lend listings:
    # 1. Check if there is an active unreturned rental (cannot book regardless of planned end date)
    active_unreturned = Booking.objects.filter(
        listing=listing,
        status='active',
        return_confirmed_at__isnull=True
    )
    if exclude_booking_id:
        active_unreturned = active_unreturned.exclude(id=exclude_booking_id)

    if active_unreturned.exists():
        active_b = active_unreturned.first()
        today = date.today()
        if active_b.end_date and today > active_b.end_date:
            return (
                "This item is currently out on rental and overdue for return. "
                "New bookings are locked until the item's return is physically verified."
            )
        return (
            f"This item already has a confirmed or active booking in progress with another borrower until "
            f"{active_b.end_date.strftime('%b %d, %Y') if active_b.end_date else 'return verification'}."
        )

    # 2. Check overlapping accepted or future active bookings
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


def get_listing_availability_info(listing: Listing) -> Dict[str, Any]:
    """
    Computes real-time availability status for a listing:
    - 'available'
    - 'currently_booked'
    - 'return_overdue'
    - 'unavailable'
    Enforces that unreturned items remain unavailable even after scheduled end date has passed.
    """
    if not listing.is_available or listing.status in ['paused', 'archived', 'unavailable', 'rented']:
        # Check if overdue active rental
        today = date.today()
        active_rental = listing.bookings.filter(
            status='active',
            return_confirmed_at__isnull=True
        ).first()

        if active_rental:
            if active_rental.end_date and today > active_rental.end_date:
                return {
                    'availability_status': 'return_overdue',
                    'status_label': 'Return overdue',
                    'booked_until': active_rental.end_date.isoformat() if active_rental.end_date else None,
                    'active_booking_id': active_rental.id,
                }
            return {
                'availability_status': 'currently_booked',
                'status_label': f"Booked until {active_rental.end_date.strftime('%b %d') if active_rental.end_date else 'return'}",
                'booked_until': active_rental.end_date.isoformat() if active_rental.end_date else None,
                'active_booking_id': active_rental.id,
            }

        # Check if accepted upcoming rental starting now
        current_accepted = listing.bookings.filter(
            status='accepted',
            start_date__lte=today,
            end_date__gte=today
        ).first()

        if current_accepted:
            return {
                'availability_status': 'currently_booked',
                'status_label': f"Booked until {current_accepted.end_date.strftime('%b %d') if current_accepted.end_date else 'return'}",
                'booked_until': current_accepted.end_date.isoformat() if current_accepted.end_date else None,
                'active_booking_id': current_accepted.id,
            }

        return {
            'availability_status': 'unavailable',
            'status_label': 'Not available',
            'booked_until': None,
            'active_booking_id': None,
        }

    # Item is marked available, but check if there are active unreturned bookings
    active_rental = listing.bookings.filter(
        status='active',
        return_confirmed_at__isnull=True
    ).first()

    if active_rental:
        today = date.today()
        if active_rental.end_date and today > active_rental.end_date:
            return {
                'availability_status': 'return_overdue',
                'status_label': 'Return overdue',
                'booked_until': active_rental.end_date.isoformat() if active_rental.end_date else None,
                'active_booking_id': active_rental.id,
            }
        return {
            'availability_status': 'currently_booked',
            'status_label': f"Booked until {active_rental.end_date.strftime('%b %d') if active_rental.end_date else 'return'}",
            'booked_until': active_rental.end_date.isoformat() if active_rental.end_date else None,
            'active_booking_id': active_rental.id,
        }

    return {
        'availability_status': 'available',
        'status_label': 'Available',
        'booked_until': None,
        'active_booking_id': None,
    }

