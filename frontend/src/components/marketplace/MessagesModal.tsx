import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Send,
  MessageSquare,
  Search,
  Check,
  CheckCheck,
  ArrowLeft,
  ShoppingBag,
  Calendar,
  Sparkles,
  HelpCircle,
  RefreshCw,
  BadgeCheck,
} from 'lucide-react'
import {
  type ConversationItem,
  type MessageItem,
  getConversations,
  getConversationMessages,
  sendConversationMessage,
} from '../../services/api'

interface MessagesModalProps {
  isOpen: boolean
  onClose: () => void
  activeConversationId?: number | null
  onUnreadChange?: () => void
  onNavigateContext?: (type: 'listing' | 'booking' | 'wanted', id: number) => void
}

export const MessagesModal: React.FC<MessagesModalProps> = ({
  isOpen,
  onClose,
  activeConversationId,
  onUnreadChange,
  onNavigateContext,
}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [newMessage, setNewMessage] = useState<string>('')
  const [loadingConvs, setLoadingConvs] = useState<boolean>(true)
  const [loadingMsgs, setLoadingMsgs] = useState<boolean>(false)
  const [sending, setSending] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollTimerRef = useRef<any>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Load conversation list
  const fetchConversations = useCallback(async (selectId?: number | null) => {
    try {
      setLoadingConvs(true)
      const res = await getConversations()
      const convList = res.conversations || []
      setConversations(convList)

      if (selectId) {
        const found = convList.find(c => c.id === selectId)
        if (found) setSelectedConv(found)
      } else if (!selectedConv && convList.length > 0) {
        // default select first on desktop
        if (window.innerWidth >= 768) {
          setSelectedConv(convList[0])
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load conversations.')
    } finally {
      setLoadingConvs(false)
    }
  }, [selectedConv])

  // Load messages for selected conversation
  const fetchMessages = useCallback(async (convId: number, silent = false) => {
    try {
      if (!silent) setLoadingMsgs(true)
      const res = await getConversationMessages(convId)
      setMessages(res.messages || [])
      if (!silent) {
        setTimeout(() => scrollToBottom('auto'), 50)
      }
      if (onUnreadChange) {
        onUnreadChange()
      }
    } catch (err: any) {
      if (!silent) setError(err?.message || 'Failed to load messages.')
    } finally {
      if (!silent) setLoadingMsgs(false)
    }
  }, [onUnreadChange])

  // Initial modal open
  useEffect(() => {
    if (isOpen) {
      fetchConversations(activeConversationId)
    } else {
      setSelectedConv(null)
      setMessages([])
      setNewMessage('')
    }
  }, [isOpen, activeConversationId])

  // When selected conversation changes
  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.id)
    }
  }, [selectedConv?.id])

  // Lightweight polling while active thread is open (every 4 seconds)
  useEffect(() => {
    if (!isOpen || !selectedConv) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      return
    }

    pollTimerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages(selectedConv.id, true)
      }
    }, 4000)

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [isOpen, selectedConv?.id, fetchMessages])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedConv || !newMessage.trim() || sending) return

    const trimmed = newMessage.trim()
    setSending(true)
    setSendError(null)

    try {
      const sentItem = await sendConversationMessage(selectedConv.id, trimmed)
      setMessages(prev => [...prev, sentItem])
      setNewMessage('')
      setTimeout(() => scrollToBottom('smooth'), 50)

      // Update snippet in conversation list
      setConversations(prev =>
        prev.map(c =>
          c.id === selectedConv.id
            ? {
                ...c,
                last_message_at: new Date().toISOString(),
                latest_message: {
                  id: sentItem.id,
                  sender_name: 'You',
                  content: sentItem.content,
                  created_at: sentItem.created_at,
                  is_read: false,
                },
              }
            : c
        )
      )

      if (onUnreadChange) {
        onUnreadChange()
      }
    } catch (err: any) {
      setSendError(err?.message || 'Failed to deliver message.')
    } finally {
      setSending(false)
    }
  }

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffHours < 1) return 'Just now'
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  const filteredConversations = conversations.filter(c => {
    const q = searchQuery.toLowerCase()
    const nameMatch = c.other_participant?.full_name?.toLowerCase().includes(q)
    const usernameMatch = c.other_participant?.username?.toLowerCase().includes(q)
    const contextMatch = c.context_title?.toLowerCase().includes(q)
    const snippetMatch = c.latest_message?.content?.toLowerCase().includes(q)
    return nameMatch || usernameMatch || contextMatch || snippetMatch
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-4xl bg-[#FBF8F3] border border-emerald-950/10 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col h-[94vh] sm:h-[90vh] max-h-[800px] overflow-hidden transition-all transform animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Main Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#F6F1E8] border-b border-emerald-950/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-900 text-white shadow-sm">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-bold text-[#1B3B2B] tracking-tight">Messages</h2>
              <p className="text-[11px] sm:text-xs text-[#1B3B2B]/60">Secure direct campus conversations</p>
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

        {/* Content Body: Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Conversation list */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r border-emerald-950/10 flex flex-col bg-white/40 ${
              selectedConv ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Search filter */}
            <div className="p-3 border-b border-emerald-950/5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#1B3B2B]/40" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-emerald-950/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            {/* Conversation Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-emerald-950/5">
              {error ? (
                <div className="p-4 m-3 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-xs text-red-700 font-medium mb-2">{error}</p>
                  <button
                    onClick={() => fetchConversations()}
                    className="px-3 py-1 text-[11px] font-semibold bg-white border border-red-300 text-red-800 rounded-lg hover:bg-red-100"
                  >
                    Retry
                  </button>
                </div>
              ) : loadingConvs ? (
                <div className="py-12 flex flex-col items-center justify-center text-[#1B3B2B]/60">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-800 mb-2" />
                  <p className="text-xs font-medium">Loading conversations...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="py-12 px-6 text-center text-[#1B3B2B]/60">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold text-[#1B3B2B]">No conversations found</p>
                  <p className="text-[11px] mt-1 text-[#1B3B2B]/50">
                    Reach out to lenders or requesters directly from listings and wanted boards.
                  </p>
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isSelected = selectedConv?.id === conv.id
                  const other = conv.other_participant
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConv(conv)}
                      className={`w-full text-left p-3.5 transition-all flex items-start gap-3 hover:bg-emerald-900/5 ${
                        isSelected ? 'bg-emerald-50/80 border-r-2 border-emerald-800' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {other?.avatar_url ? (
                          <img
                            src={other.avatar_url}
                            alt={other.full_name}
                            className="w-10 h-10 rounded-full object-cover border border-emerald-950/10"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-900/10 text-emerald-900 font-bold flex items-center justify-center text-sm border border-emerald-950/10">
                            {(other?.full_name || other?.username || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>

                      {/* Info & Snippet */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="text-xs font-bold text-[#1B3B2B] truncate flex items-center gap-1">
                            <span>{other?.full_name || other?.username}</span>
                            {other?.is_college_verified ? (
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                            ) : (
                              <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Unverified
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-[#1B3B2B]/40 whitespace-nowrap ml-2">
                            {formatRelativeTime(conv.last_message_at)}
                          </span>
                        </div>

                        {/* Context Tag */}
                        <div className="flex items-center gap-1 text-[10px] text-emerald-900/70 font-semibold truncate mb-1">
                          {conv.context_type === 'booking' ? (
                            <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
                          ) : conv.context_type === 'wanted_request' ? (
                            <HelpCircle className="w-2.5 h-2.5 flex-shrink-0" />
                          ) : (
                            <ShoppingBag className="w-2.5 h-2.5 flex-shrink-0" />
                          )}
                          <span className="truncate">{conv.context_title}</span>
                        </div>

                        {/* Latest Snippet */}
                        <p
                          className={`text-xs truncate ${
                            conv.unread_count > 0
                              ? 'font-bold text-[#1B3B2B]'
                              : 'text-[#1B3B2B]/60'
                          }`}
                        >
                          {conv.latest_message
                            ? `${conv.latest_message.sender_name === 'You' ? 'You: ' : ''}${conv.latest_message.content}`
                            : 'No messages yet.'}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Active chat thread */}
          <div
            className={`flex-1 flex flex-col bg-[#FBF8F3] ${
              !selectedConv ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selectedConv ? (
              <>
                {/* Active chat header */}
                <div className="px-4 py-3 bg-[#F6F1E8] border-b border-emerald-950/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConv(null)}
                      className="md:hidden p-1.5 -ml-1 text-[#1B3B2B]/70 hover:text-[#1B3B2B] rounded-lg"
                      title="Back to conversation list"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="relative">
                      {selectedConv.other_participant?.avatar_url ? (
                        <img
                          src={selectedConv.other_participant.avatar_url}
                          alt={selectedConv.other_participant.full_name}
                          className="w-9 h-9 rounded-full object-cover border border-emerald-950/10"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-emerald-900/10 text-emerald-900 font-bold flex items-center justify-center text-xs">
                          {(selectedConv.other_participant?.full_name || 'U')[0].toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-bold text-[#1B3B2B]">
                          {selectedConv.other_participant?.full_name || selectedConv.other_participant?.username}
                        </h3>
                        {selectedConv.other_participant?.is_college_verified ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Verified
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Unverified
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                          🛡️ {selectedConv.other_participant?.trust_score ?? 75} Trust
                        </span>
                        {selectedConv.other_participant?.college_short_code && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-900/10 text-emerald-900">
                            {selectedConv.other_participant.college_short_code}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#1B3B2B]/60 truncate max-w-xs md:max-w-md">
                        Regarding: <span className="font-semibold text-emerald-950">{selectedConv.context_title}</span>
                      </p>
                    </div>
                  </div>

                  {/* Context quick action */}
                  {onNavigateContext && (
                    <div>
                      {selectedConv.listing_id && (
                        <button
                          onClick={() => onNavigateContext('listing', selectedConv.listing_id!)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-white border border-emerald-950/10 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          View Item
                        </button>
                      )}
                      {selectedConv.booking_id && (
                        <button
                          onClick={() => onNavigateContext('booking', selectedConv.booking_id!)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-white border border-emerald-950/10 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          View Booking
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Message bubbles stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="py-20 flex flex-col items-center justify-center text-[#1B3B2B]/60">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-800 mb-2" />
                      <p className="text-xs">Loading conversation history...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-20 text-center text-[#1B3B2B]/50">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-800" />
                      <p className="text-xs font-semibold">Start the conversation</p>
                      <p className="text-[11px] mt-0.5">Send a message to coordinate terms, pickup details, or ask questions.</p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.is_mine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed break-words whitespace-pre-wrap ${
                            msg.is_mine
                              ? 'bg-emerald-900 text-white rounded-br-xs'
                              : 'bg-white text-[#1B3B2B] border border-emerald-950/10 rounded-bl-xs'
                          }`}
                        >
                          {msg.content}
                        </div>

                        <div className="flex items-center gap-1 mt-1 text-[10px] text-[#1B3B2B]/40 px-1">
                          <span>{formatMessageTime(msg.created_at)}</span>
                          {msg.is_mine && (
                            <span title={msg.is_read ? 'Read' : 'Sent'}>
                              {msg.is_read ? (
                                <CheckCheck className="w-3 h-3 text-emerald-700" />
                              ) : (
                                <Check className="w-3 h-3 text-[#1B3B2B]/40" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input bar */}
                <div className="p-3 bg-white border-t border-emerald-950/10">
                  {sendError && (
                    <div className="mb-2 px-3 py-1.5 text-[11px] bg-red-50 text-red-700 rounded-lg border border-red-200">
                      {sendError}
                    </div>
                  )}

                  <form onSubmit={handleSend} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        rows={1}
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                          }
                        }}
                        maxLength={2000}
                        placeholder="Type a message... (Press Enter to send)"
                        className="w-full resize-none px-3.5 py-2.5 text-xs bg-[#FBF8F3] border border-emerald-950/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 text-[#1B3B2B]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className="p-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                      title="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <div className="flex justify-between items-center text-[10px] text-[#1B3B2B]/40 mt-1 px-1">
                    <span>Direct student message • No sensitive credentials</span>
                    <span>{newMessage.length} / 2000</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#1B3B2B]/50">
                <div className="w-16 h-16 rounded-full bg-emerald-900/5 flex items-center justify-center text-emerald-900/40 mb-3">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-[#1B3B2B]">Select a conversation</h3>
                <p className="text-xs text-[#1B3B2B]/60 max-w-sm mt-1">
                  Choose a chat thread from the left or initiate a message directly from an item listing or wanted request.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
export default MessagesModal
