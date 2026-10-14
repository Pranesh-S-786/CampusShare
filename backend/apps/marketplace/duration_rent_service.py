import math
from datetime import datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional
from django.utils import timezone


def calculate_actual_rental_terms(
    booking,
    custom_return_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Computes authoritative actual rental duration and dynamic final rent
    from server-verified pickup and return timestamps.
    
    Billing & Rounding Policy:
    - Rate is locked from booking snapshot terms (snapshot_price & snapshot_pricing_unit).
    - Partial billing units:
      * 'hour': rounded up to the nearest whole hour (minimum 1 hour).
      * 'day': rounded up to the nearest whole day (minimum 1 day).
      * 'week': rounded up to the nearest whole week (minimum 1 week).
      * 'month': rounded up to the nearest whole month (minimum 1 month).
      * 'semester': rounded up to the nearest whole semester (minimum 1 semester).
      * 'item': 1 fixed unit.
    - Early Returns: rent recalculates based on actual elapsed units at agreed rate.
      CampusShare does NOT apply automatic early-return penalties.
    - All calculations use Python Decimal with ROUND_HALF_UP to 2 decimal places.
    """
    unit = (booking.snapshot_pricing_unit or 'day').lower()
    unit_price = booking.snapshot_price or Decimal('0.00')
    original_rent_estimate = booking.calculated_total_rent or Decimal('0.00')
    planned_units = booking.duration_days or 1

    pickup_time = booking.pickup_confirmed_at
    return_time = custom_return_time or booking.return_confirmed_at

    # If item not yet picked up or returned, return estimated snapshot
    if not pickup_time:
        return {
            'is_returned': False,
            'planned_units': planned_units,
            'planned_duration_display': f"{planned_units} {unit}(s)",
            'actual_units': planned_units,
            'actual_duration_display': f"{planned_units} {unit}(s) (Planned)",
            'original_rent_estimate': str(original_rent_estimate),
            'final_calculated_rent': str(original_rent_estimate),
            'is_early_return': False,
            'is_late_return': False,
            'billing_policy': f"Partial {unit}s are rounded up to the nearest whole {unit}. Minimum charge: 1 {unit}.",
        }

    effective_return = return_time or timezone.now()
    duration_delta = effective_return - pickup_time
    total_seconds = max(duration_delta.total_seconds(), 60.0)  # Minimum 1 minute

    # 15-minute (900s) grace buffer on transition boundaries for fair student billing
    GRACE_BUFFER = 900.0
    buffered_seconds = max(60.0, total_seconds - GRACE_BUFFER) if total_seconds > 1800.0 else total_seconds

    # Calculate actual billing units
    if unit == 'hour':
        actual_units = max(1, math.ceil(buffered_seconds / 3600))
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        duration_display = f"{hours}h {minutes}m ({actual_units} billed hour{'s' if actual_units > 1 else ''})"
    elif unit == 'day':
        actual_units = max(1, math.ceil(buffered_seconds / 86400))
        days = int(total_seconds // 86400)
        hours = int((total_seconds % 86400) // 3600)
        duration_display = f"{days}d {hours}h ({actual_units} billed day{'s' if actual_units > 1 else ''})"
    elif unit == 'week':
        days = max(1, math.ceil(buffered_seconds / 86400))
        actual_units = max(1, math.ceil(days / 7))
        duration_display = f"{days} days ({actual_units} billed week{'s' if actual_units > 1 else ''})"
    elif unit == 'month':
        days = max(1, math.ceil(buffered_seconds / 86400))
        actual_units = max(1, math.ceil(days / 30))
        duration_display = f"{days} days ({actual_units} billed month{'s' if actual_units > 1 else ''})"
    elif unit == 'semester':
        days = max(1, math.ceil(buffered_seconds / 86400))
        actual_units = max(1, math.ceil(days / 120))
        duration_display = f"{days} days ({actual_units} billed semester{'s' if actual_units > 1 else ''})"
    else:  # 'item' / sell
        actual_units = 1
        duration_display = "1 item"

    if booking.booking_type == 'buy' or booking.booking_type == 'lend':
        final_calculated_rent = original_rent_estimate
    else:
        raw_rent = unit_price * Decimal(str(actual_units))
        final_calculated_rent = raw_rent.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    is_early_return = actual_units < planned_units
    
    # Check late status against scheduled end date + 2-hour grace period
    is_late = False
    late_hours = 0
    if booking.end_date:
        due_datetime = timezone.make_aware(
            datetime.combine(booking.end_date, time(23, 59, 59)),
            timezone.get_current_timezone()
        )
        grace_cutoff = due_datetime + timezone.timedelta(hours=2)
        if effective_return > grace_cutoff:
            is_late = True
            late_seconds = (effective_return - due_datetime).total_seconds()
            late_hours = max(1, math.ceil(late_seconds / 3600))

    return {
        'is_returned': booking.return_confirmed_at is not None,
        'planned_units': planned_units,
        'planned_duration_display': f"{planned_units} {unit}(s)",
        'actual_units': actual_units,
        'actual_duration_display': duration_display,
        'original_rent_estimate': str(original_rent_estimate),
        'final_calculated_rent': str(final_calculated_rent),
        'is_early_return': is_early_return,
        'is_late_return': is_late,
        'late_hours': late_hours,
        'pickup_confirmed_at': pickup_time.isoformat(),
        'return_confirmed_at': effective_return.isoformat() if return_time else None,
        'billing_policy': (
            f"Partial {unit}s are rounded up to the nearest whole {unit}. "
            f"Agreed rate: Rs. {unit_price}/{unit}. Minimum charge: 1 {unit}."
        ),
    }


def calculate_late_penalty_estimate(booking) -> Dict[str, Any]:
    """
    Computes transparent late return calculations according to platform policy:
    - 2-hour grace period after scheduled due date (23:59:59 end-of-day).
    - Beyond grace period: late fee is calculated pro-rata per overtime hour:
      hourly overtime rate = (snapshot_price / 24) [or snapshot_price for hourly units].
    - Both parties must agree before any proposed penalty becomes binding.
    """
    if not booking.end_date:
        return {
            'is_late': False,
            'late_hours': 0,
            'suggested_late_fee': '0.00',
            'policy_description': "No scheduled end date specified.",
        }

    return_time = booking.return_confirmed_at or timezone.now()
    due_datetime = timezone.make_aware(
        datetime.combine(booking.end_date, time(23, 59, 59)),
        timezone.get_current_timezone()
    )
    grace_cutoff = due_datetime + timezone.timedelta(hours=2)

    if return_time <= grace_cutoff:
        return {
            'is_late': False,
            'late_hours': 0,
            'grace_period_hours': 2,
            'suggested_late_fee': '0.00',
            'policy_description': "Returned within agreed rental period or 2-hour grace window. No late fee applies.",
        }

    late_seconds = (return_time - due_datetime).total_seconds()
    late_hours = max(1, math.ceil(late_seconds / 3600))
    late_days = math.ceil(late_hours / 24)

    unit = (booking.snapshot_pricing_unit or 'day').lower()
    unit_price = booking.snapshot_price or Decimal('0.00')

    if unit == 'hour':
        hourly_rate = unit_price
    else:
        # Daily or longer: hourly pro-rata rate is unit_price / 24 (minimum Rs. 10/hr)
        hourly_rate = max(unit_price / Decimal('24.0'), Decimal('10.00'))

    suggested_fee = (hourly_rate * Decimal(str(late_hours))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    policy_desc = (
        f"Item returned {late_hours} hour(s) past agreed due timestamp (including 2h grace window). "
        f"Suggested late fee calculated at Rs. {hourly_rate.quantize(Decimal('0.01'))}/hour based on disclosed policy."
    )

    return {
        'is_late': True,
        'late_hours': late_hours,
        'late_days': late_days,
        'grace_period_hours': 2,
        'suggested_late_fee': str(suggested_fee),
        'policy_description': policy_desc,
    }
