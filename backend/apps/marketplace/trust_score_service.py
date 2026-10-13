from decimal import Decimal
from typing import Dict, Any, Optional
from datetime import datetime, time
from django.utils import timezone
from apps.authentication.models import StudentProfile


# Configurable Bounded Weights for Campus Trust Score (0 - 100)
BASE_TRUST_SCORE = 75
WEIGHT_ON_TIME_RETURN = 5         # +5 per verified on-time return
WEIGHT_EARLY_RETURN = 2           # +2 per early return (mild positive)
WEIGHT_LATE_RETURN = -10          # -10 per late return (material penalty)
WEIGHT_CONFIRMED_DAMAGE = -25     # -25 per mutually accepted/confirmed damage incident
WEIGHT_COMPLETED_VOLUME = 2       # +2 volume boost per completed rental (capped at +10)
LENDER_RATING_WEIGHT = 4.0        # (avg_rating - 3.5) * 4.0

MIN_TRUST_SCORE = 0
MAX_TRUST_SCORE = 100


def calculate_and_update_trust_score(profile: StudentProfile) -> Dict[str, Any]:
    """
    Computes an authoritative, explainable trust score for a student profile
    based exclusively on genuine verified rental history and mutually agreed outcomes.
    
    Fairness Guarantees:
    - Unilateral allegations and disputed damage claims NEVER reduce trust.
    - Double counting between late events and penalties is prevented.
    - Fully explainable breakdown with no black-box adjustments.
    """
    from apps.marketplace.models import Booking, Review

    # Completed rentals as borrower
    borrower_completed = Booking.objects.filter(
        borrower=profile,
        status__in=['returned', 'completed'],
        return_confirmed_at__isnull=False
    ).prefetch_related('adjustments')

    # Completed rentals as lender
    lender_completed = Booking.objects.filter(
        lender=profile,
        status__in=['returned', 'completed'],
        return_confirmed_at__isnull=False
    )

    completed_as_borrower_count = borrower_completed.count()
    completed_as_lender_count = lender_completed.count()
    total_completed = completed_as_borrower_count + completed_as_lender_count

    # Initial state: New user with insufficient history
    if total_completed == 0:
        profile.trust_score = None
        profile.trust_status = 'insufficient_history'
        profile.completed_rentals_count = 0
        profile.save(update_fields=['trust_score', 'trust_status', 'completed_rentals_count', 'updated_at'])

        return {
            'profile_id': profile.id,
            'trust_score': None,
            'trust_status': 'insufficient_history',
            'status_label': 'New user — insufficient history',
            'confidence': 'None',
            'completed_rentals_count': 0,
            'on_time_returns_count': 0,
            'early_returns_count': 0,
            'late_returns_count': 0,
            'confirmed_damage_count': 0,
            'disputed_claims_count': 0,
            'lender_rating_average': None,
            'lender_review_count': 0,
            'explanation': (
                "New user with no completed rentals yet. Trust score will automatically "
                "activate once your first rental handover and return are verified."
            ),
            'scoring_rules': {
                'base_score': BASE_TRUST_SCORE,
                'on_time_return_bonus': f"+{WEIGHT_ON_TIME_RETURN}",
                'early_return_bonus': f"+{WEIGHT_EARLY_RETURN}",
                'late_return_penalty': str(WEIGHT_LATE_RETURN),
                'confirmed_damage_penalty': str(WEIGHT_CONFIRMED_DAMAGE),
                'volume_booster': f"+{WEIGHT_COMPLETED_VOLUME} per rental (max +10)",
            }
        }

    on_time_returns = 0
    early_returns = 0
    late_returns = 0
    confirmed_damage_count = 0
    disputed_claims_count = 0

    # Analyze borrower returns
    for booking in borrower_completed:
        # Determine timeliness against scheduled due date + 2 hour grace period
        if booking.end_date and booking.return_confirmed_at and booking.pickup_confirmed_at:
            # End of scheduled return day at 23:59:59 with timezone
            due_end_of_day = timezone.make_aware(
                datetime.combine(booking.end_date, time(23, 59, 59)),
                timezone.get_current_timezone()
            )
            # Add 2 hours grace period
            due_cutoff = due_end_of_day + timezone.timedelta(hours=2)

            return_time = booking.return_confirmed_at
            if return_time > due_cutoff:
                late_returns += 1
            elif (due_end_of_day - return_time).total_seconds() > 86400:
                # Returned more than 1 calendar day before due date
                early_returns += 1
            else:
                on_time_returns += 1
        elif booking.return_confirmed_at:
            on_time_returns += 1

        # Check damage adjustments: only count ACCEPTED damage!
        adjustments = booking.adjustments.all()
        for adj in adjustments:
            if adj.adjustment_type == 'damage':
                if adj.status == 'accepted':
                    confirmed_damage_count += 1
                elif adj.status == 'disputed':
                    disputed_claims_count += 1

    # Lender reviews received
    lender_reviews = Review.objects.filter(target_lender=profile, review_type='lender')
    lender_review_count = lender_reviews.count()
    if lender_review_count > 0:
        total_stars = sum(r.rating for r in lender_reviews)
        lender_avg = round(total_stars / lender_review_count, 2)
        rating_contribution = (float(lender_avg) - 3.5) * LENDER_RATING_WEIGHT
    else:
        lender_avg = None
        rating_contribution = 0.0

    # Calculate bounded score
    volume_bonus = min(10, total_completed * WEIGHT_COMPLETED_VOLUME)
    score_calc = (
        BASE_TRUST_SCORE
        + (on_time_returns * WEIGHT_ON_TIME_RETURN)
        + (early_returns * WEIGHT_EARLY_RETURN)
        + (late_returns * WEIGHT_LATE_RETURN)
        + (confirmed_damage_count * WEIGHT_CONFIRMED_DAMAGE)
        + rating_contribution
        + volume_bonus
    )
    final_score = int(round(max(MIN_TRUST_SCORE, min(MAX_TRUST_SCORE, score_calc))))

    # Confidence and status categorization
    if total_completed < 3:
        confidence = 'Low (1-2 completed rentals)'
    elif total_completed <= 6:
        confidence = 'Medium (3-6 completed rentals)'
    else:
        confidence = 'High (7+ completed rentals)'

    if final_score >= 85:
        trust_status = 'exceptional'
        status_label = 'Exceptional Peer (Verified)'
    elif final_score >= 70:
        trust_status = 'trusted'
        status_label = 'Trusted Campus Member'
    elif final_score >= 50:
        trust_status = 'fair'
        status_label = 'Fair Standing'
    else:
        trust_status = 'needs_improvement'
        status_label = 'Needs Improvement'

    # Save to profile
    profile.trust_score = final_score
    profile.trust_status = trust_status
    profile.completed_rentals_count = total_completed
    profile.lender_average_rating = Decimal(str(lender_avg)) if lender_avg is not None else Decimal('0.00')
    profile.lender_review_count = lender_review_count
    profile.save(update_fields=[
        'trust_score',
        'trust_status',
        'completed_rentals_count',
        'lender_average_rating',
        'lender_review_count',
        'updated_at'
    ])

    explanation_parts = [
        f"Base score: {BASE_TRUST_SCORE}.",
        f"{on_time_returns} on-time return(s) (+{on_time_returns * WEIGHT_ON_TIME_RETURN}).",
    ]
    if early_returns > 0:
        explanation_parts.append(f"{early_returns} early return(s) (+{early_returns * WEIGHT_EARLY_RETURN}).")
    if late_returns > 0:
        explanation_parts.append(f"{late_returns} late return(s) ({late_returns * WEIGHT_LATE_RETURN}).")
    if confirmed_damage_count > 0:
        explanation_parts.append(f"{confirmed_damage_count} confirmed damage incident(s) ({confirmed_damage_count * WEIGHT_CONFIRMED_DAMAGE}).")
    if disputed_claims_count > 0:
        explanation_parts.append(f"Note: {disputed_claims_count} unproven/disputed claim(s) do not affect trust score.")
    if lender_avg is not None:
        explanation_parts.append(f"Lender review rating ({lender_avg}★ from {lender_review_count} review(s)): {rating_contribution:+.1f} pts.")
    explanation_parts.append(f"Completed transactions volume bonus: +{volume_bonus} pts.")

    return {
        'profile_id': profile.id,
        'trust_score': final_score,
        'trust_status': trust_status,
        'status_label': status_label,
        'confidence': confidence,
        'completed_rentals_count': total_completed,
        'on_time_returns_count': on_time_returns,
        'early_returns_count': early_returns,
        'late_returns_count': late_returns,
        'confirmed_damage_count': confirmed_damage_count,
        'disputed_claims_count': disputed_claims_count,
        'lender_rating_average': float(lender_avg) if lender_avg is not None else None,
        'lender_review_count': lender_review_count,
        'explanation': " ".join(explanation_parts),
        'scoring_rules': {
            'base_score': BASE_TRUST_SCORE,
            'on_time_return_bonus': f"+{WEIGHT_ON_TIME_RETURN}",
            'early_return_bonus': f"+{WEIGHT_EARLY_RETURN}",
            'late_return_penalty': str(WEIGHT_LATE_RETURN),
            'confirmed_damage_penalty': str(WEIGHT_CONFIRMED_DAMAGE),
            'volume_booster': f"+{WEIGHT_COMPLETED_VOLUME} per rental (max +10)",
        }
    }
