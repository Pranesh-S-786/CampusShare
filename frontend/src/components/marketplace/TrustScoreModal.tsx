import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Star,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react'
import {
  type TrustScoreExplanation,
  getProfileTrustScore,
} from '../../services/api'

interface TrustScoreModalProps {
  profileId: number | null
  userName?: string
  isOpen: boolean
  onClose: () => void
}

export function TrustScoreModal({
  profileId,
  userName,
  isOpen,
  onClose,
}: TrustScoreModalProps) {
  const [data, setData] = useState<TrustScoreExplanation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadScore = useCallback(async () => {
    if (!profileId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await getProfileTrustScore(profileId)
      setData(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve trust score details.')
    } finally {
      setIsLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    if (isOpen && profileId) {
      loadScore()
    }
  }, [isOpen, profileId, loadScore])

  if (!isOpen) return null

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-stone-500 bg-stone-100 border-stone-200'
    if (score >= 85) return 'text-emerald-900 bg-emerald-50 border-emerald-300'
    if (score >= 70) return 'text-teal-900 bg-teal-50 border-teal-300'
    if (score >= 50) return 'text-amber-900 bg-amber-50 border-amber-300'
    return 'text-rose-900 bg-rose-50 border-rose-300'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-[#FBF8F3] border border-stone-200 shadow-2xl overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/80 bg-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#1B3B2B] flex items-center justify-center border border-emerald-100">
              <ShieldCheck className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Campus Trust Score
              </h3>
              <p className="text-xs text-stone-500 font-mono truncate max-w-[260px]">
                {userName || 'Campus Peer'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-7 h-7 text-[#1B3B2B] animate-spin" />
              <p className="text-xs font-medium text-stone-500">Calculating trust metrics...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <p>{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* Score Display Card */}
              <div className={`p-5 rounded-3xl border text-center space-y-2 ${getScoreColor(data.trust_score)}`}>
                <div className="inline-flex items-center justify-center space-x-2">
                  <Shield className="w-6 h-6 text-emerald-800" />
                  <span className="text-3xl sm:text-4xl font-black">
                    {data.trust_score !== null ? `${data.trust_score} / 100` : 'New User'}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-stone-900">
                  {data.status_label}
                </h4>
                <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                  {data.explanation}
                </p>
                <div className="pt-1 flex items-center justify-center space-x-2 text-[11px] font-mono text-stone-500">
                  <span>Confidence: <strong>{data.confidence}</strong></span>
                  <span>•</span>
                  <span>Completed: <strong>{data.completed_rentals_count}</strong></span>
                </div>
              </div>

              {/* Factors Breakdown Table */}
              <div className="p-4 rounded-2xl bg-white border border-stone-200/90 space-y-3">
                <h5 className="font-bold text-xs uppercase tracking-wider text-stone-700 font-mono">
                  Contributing Factors Breakdown
                </h5>

                <div className="divide-y divide-stone-100 text-xs">
                  <div className="py-2 flex items-center justify-between">
                    <span className="flex items-center space-x-2 text-stone-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>On-Time Returns</span>
                    </span>
                    <span className="font-bold text-stone-900">
                      {data.on_time_returns_count} ({data.scoring_rules.on_time_return_bonus} pts each)
                    </span>
                  </div>

                  {data.early_returns_count > 0 && (
                    <div className="py-2 flex items-center justify-between">
                      <span className="flex items-center space-x-2 text-stone-700">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        <span>Early Returns</span>
                      </span>
                      <span className="font-bold text-stone-900">
                        {data.early_returns_count} ({data.scoring_rules.early_return_bonus} pts each)
                      </span>
                    </div>
                  )}

                  {data.late_returns_count > 0 && (
                    <div className="py-2 flex items-center justify-between text-amber-900">
                      <span className="flex items-center space-x-2">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Late Returns</span>
                      </span>
                      <span className="font-bold">
                        {data.late_returns_count} ({data.scoring_rules.late_return_penalty} pts each)
                      </span>
                    </div>
                  )}

                  {data.confirmed_damage_count > 0 && (
                    <div className="py-2 flex items-center justify-between text-rose-900">
                      <span className="flex items-center space-x-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Confirmed Damage Incidents</span>
                      </span>
                      <span className="font-bold">
                        {data.confirmed_damage_count} ({data.scoring_rules.confirmed_damage_penalty} pts each)
                      </span>
                    </div>
                  )}

                  {data.lender_rating_average !== null && (
                    <div className="py-2 flex items-center justify-between">
                      <span className="flex items-center space-x-2 text-stone-700">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        <span>Lender Review Average</span>
                      </span>
                      <span className="font-bold text-stone-900">
                        {data.lender_rating_average}★ ({data.lender_review_count} review{data.lender_review_count === 1 ? '' : 's'})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fairness & Dispute Guarantee Note (Section 11) */}
              <div className="p-3.5 rounded-2xl bg-stone-100 border border-stone-200 text-xs text-stone-700 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-stone-900">
                  <Info className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Fairness & Dispute Protection</span>
                </div>
                <p className="text-[11px] leading-relaxed text-stone-600">
                  A damage allegation alone never reduces trust. Disputed claims are never counted as misconduct. Only mutually accepted damage adjustments or authorized dispute determinations count toward penalties.
                </p>
                {data.disputed_claims_count > 0 && (
                  <p className="text-[11px] font-semibold text-stone-800 pt-1">
                    🛡️ {data.disputed_claims_count} unproven or disputed claim(s) currently carry zero trust score penalty.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
