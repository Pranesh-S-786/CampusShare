import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Bell,
  BellOff,
  CheckCheck,
  Calendar,
  QrCode,
  IndianRupee,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react'
import {
  type NotificationItem,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getAuthToken,
} from '../../services/api'

interface NotificationsModalProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (modal: string, targetId?: string) => void
  onUnreadCountChange?: (count: number) => void
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onUnreadCountChange,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [markingAll, setMarkingAll] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)

  const fetchNotifications = useCallback(async (resetPage = false) => {
    const token = getAuthToken()
    if (!token) {
      setNotifications([])
      setUnreadCount(0)
      setError('Your session has expired or you are not signed in.')
      setLoading(false)
      setLoadingMore(false)
      return
    }

    try {
      const targetPage = resetPage ? 1 : page
      if (resetPage) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }

      const res = await getNotifications(filter, targetPage, 20)
      if (resetPage) {
        setNotifications(res.notifications || [])
      } else {
        setNotifications(prev => [...prev, ...(res.notifications || [])])
      }
      setUnreadCount(res.unread_count || 0)
      setHasMore(targetPage * 20 < res.count)
      if (onUnreadCountChange) {
        onUnreadCountChange(res.unread_count || 0)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, page, onUnreadCountChange])

  useEffect(() => {
    if (isOpen) {
      setPage(1)
      fetchNotifications(true)
    }
  }, [isOpen, filter])

  const handleMarkAsRead = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        const res = await markNotificationRead(item.id)
        setNotifications(prev =>
          prev.map(n => (n.id === item.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
        )
        setUnreadCount(res.unread_count)
        if (onUnreadCountChange) {
          onUnreadCountChange(res.unread_count)
        }
      } catch (_e) {
        // Optimistically still proceed
      }
    }

    if (item.target_modal) {
      onClose()
      onNavigate(item.target_modal, item.target_id)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true)
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
      if (onUnreadCountChange) {
        onUnreadCountChange(0)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to mark all as read.')
    } finally {
      setMarkingAll(false)
    }
  }

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking_request':
      case 'booking_accepted':
      case 'booking_declined':
      case 'booking_cancelled':
        return <Calendar className="w-5 h-5 text-emerald-700" />
      case 'pickup_confirmed':
      case 'return_confirmed':
        return <QrCode className="w-5 h-5 text-teal-700" />
      case 'payment_declared':
      case 'payment_confirmed':
      case 'refund_declared':
      case 'refund_confirmed':
        return <IndianRupee className="w-5 h-5 text-emerald-800" />
      case 'payment_disputed':
      case 'adjustment_proposed':
      case 'adjustment_resolved':
        return <ShieldAlert className="w-5 h-5 text-amber-700" />
      case 'new_message':
        return <MessageSquare className="w-5 h-5 text-emerald-600" />
      default:
        return <Sparkles className="w-5 h-5 text-emerald-600" />
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-[#FBF8F3] border border-emerald-950/10 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[88vh] overflow-hidden transition-all transform animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-5 bg-[#F6F1E8] border-b border-emerald-950/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative p-2 sm:p-2.5 rounded-xl bg-emerald-900 text-white shadow-sm shrink-0">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-[#1B3B2B] tracking-tight truncate">Notifications</h2>
              <p className="text-[11px] sm:text-xs text-[#1B3B2B]/60 truncate">Activity and updates for your campus rentals & requests</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#1B3B2B]/60 hover:text-[#1B3B2B] hover:bg-emerald-900/5 rounded-full transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar & Actions */}
        <div className="px-6 py-3 bg-white/60 border-b border-emerald-950/5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-emerald-950/5 rounded-xl">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filter === 'all'
                  ? 'bg-white text-emerald-950 shadow-sm'
                  : 'text-[#1B3B2B]/70 hover:text-[#1B3B2B]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                filter === 'unread'
                  ? 'bg-white text-emerald-950 shadow-sm'
                  : 'text-[#1B3B2B]/70 hover:text-[#1B3B2B]'
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || markingAll}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all read</span>
            </button>
          </div>
        </div>

        {/* Notifications List Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-emerald-950/5 p-2">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#1B3B2B]/60">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-800 mb-3" />
              <p className="text-sm font-medium">Checking notifications...</p>
            </div>
          ) : error ? (
            <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
              <p className="text-sm text-red-700 font-medium">
                {error.toLowerCase().includes('token') || error.toLowerCase().includes('sign in') || error.toLowerCase().includes('unauthorized') || error.toLowerCase().includes('credentials')
                  ? 'Your session has expired or you are not signed in.'
                  : error}
              </p>
              {error.toLowerCase().includes('token') || error.toLowerCase().includes('sign in') || error.toLowerCase().includes('unauthorized') || error.toLowerCase().includes('credentials') ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onNavigate('login')
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-[#1B3B2B] text-white rounded-lg hover:bg-[#26533d] transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fetchNotifications(true)}
                  className="px-4 py-2 text-xs font-semibold bg-white border border-red-300 text-red-800 rounded-lg hover:bg-red-100/50 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-900/5 flex items-center justify-center text-emerald-900/40 mb-3">
                <BellOff className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-[#1B3B2B] mb-1">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-xs text-[#1B3B2B]/60 max-w-sm px-4">
                {filter === 'unread'
                  ? 'You are all caught up! Switch to "All" to view past notifications.'
                  : "We'll notify you here whenever someone requests your item, sends a message, or records payment declarations."}
              </p>
            </div>
          ) : (
            notifications.map(item => (
              <div
                key={item.id}
                onClick={() => handleMarkAsRead(item)}
                className={`p-4 rounded-xl transition-all cursor-pointer flex items-start gap-3.5 group relative ${
                  item.is_read
                    ? 'hover:bg-white/70 opacity-80 hover:opacity-100'
                    : 'bg-emerald-50/70 border border-emerald-900/10 hover:bg-emerald-50'
                }`}
              >
                {/* Icon avatar */}
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-emerald-950/10 flex items-center justify-center shadow-xs">
                    {getNotificationIcon(item.notification_type)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h4
                      className={`text-sm tracking-tight truncate ${
                        item.is_read ? 'font-medium text-[#1B3B2B]' : 'font-bold text-[#1B3B2B]'
                      }`}
                    >
                      {item.title}
                    </h4>
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0 animate-pulse" />
                    )}
                  </div>

                  <p className="text-xs text-[#1B3B2B]/80 line-clamp-2 leading-relaxed mb-1.5">
                    {item.message}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-[#1B3B2B]/50">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(item.created_at)}
                    </span>
                    {item.listing_title && (
                      <span className="truncate max-w-[200px] text-emerald-900/70 font-medium">
                        • {item.listing_title}
                      </span>
                    )}
                  </div>
                </div>

                {/* Navigation Indicator */}
                {item.target_modal && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center pr-1 text-emerald-800">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {hasMore && !loading && (
            <div className="p-3 text-center">
              <button
                onClick={() => {
                  setPage(p => p + 1)
                  fetchNotifications(false)
                }}
                disabled={loadingMore}
                className="px-4 py-2 text-xs font-semibold text-emerald-900 bg-white border border-emerald-950/10 rounded-xl hover:bg-emerald-50 transition-colors"
              >
                {loadingMore ? 'Loading older...' : 'Load more notifications'}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#F6F1E8] border-t border-emerald-950/10 flex items-center justify-between text-xs text-[#1B3B2B]/60">
          <span>Click any notification to navigate directly to its details</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-[#1B3B2B] hover:text-emerald-950 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
export default NotificationsModal
