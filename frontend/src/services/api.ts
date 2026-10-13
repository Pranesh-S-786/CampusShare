export interface HealthResponse {
  status: string
  service: string
  version?: string
  database?: string
  environment?: string
  timestamp?: string
}

export interface College {
  id: number
  name: string
  short_code: string
  domain: string
  city: string
  state: string
}

export interface StudentProfile {
  id: number
  username: string
  full_name: string
  college_email: string
  college: College | null
  custom_college_name: string
  display_college: string
  avatar_url: string | null
  default_avatar_url: string
  is_email_verified: boolean
  is_college_verified: boolean
  verification_status: 'unverified' | 'email_verified' | 'verified_student'
  grad_year?: number | null
  major?: string
  student_id_number?: string
  bio?: string
  trust_score?: number | null
  trust_status?: string
  completed_rentals_count?: number
  lender_average_rating?: string | number | null
  lender_review_count?: number
  created_at: string
  updated_at: string
}

export interface RegisterPayload {
  full_name: string
  email: string
  college_id?: number | null
  custom_college_name?: string
  password: string
  confirm_password: string
}

export interface RegisterResponse {
  message: string
  user_id: number
  email: string
  full_name: string
  is_email_verified: boolean
  is_college_verified: boolean
  verification_token?: string
  email_delivery?: {
    delivered: boolean
    method: string
    message: string
    dev_code?: string
  }
}

export interface VerifyEmailPayload {
  email: string
  code: string
}

export interface AuthResponse {
  message: string
  token: string
  user: StudentProfile
  is_email_verified?: boolean
  is_college_verified?: boolean
  verification_status?: string
  email_delivery?: {
    delivered: boolean
    method: string
    message: string
    dev_code?: string
  }
}

export interface LoginPayload {
  email: string
  password: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  email: string
  code: string
  new_password: string
  confirm_password: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const TOKEN_KEY = 'campusshare_auth_token'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeAuthToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

function getAuthHeaders(isMultipart = false): HeadersInit {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Token ${token}`
  }
  return headers
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let errorMsg = 'An unexpected error occurred.'
    if (data?.errors) {
      if (typeof data.errors === 'string') {
        errorMsg = data.errors
      } else if (typeof data.errors === 'object') {
        const firstKey = Object.keys(data.errors)[0]
        const val = data.errors[firstKey]
        errorMsg = Array.isArray(val) ? val[0] : String(val)
      }
    } else if (data?.detail) {
      errorMsg = data.detail
    } else if (data?.message) {
      errorMsg = data.message
    }
    const err = new Error(errorMsg) as Error & { status: number; data: any }
    err.status = res.status
    err.data = data
    throw err
  }
  return data as T
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health/`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Backend responded with HTTP status ${response.status}`)
  }
  return response.json()
}

export async function getColleges(): Promise<{ colleges: College[]; count: number }> {
  const res = await fetch(`${API_BASE_URL}/auth/colleges/`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  })
  return handleResponse(res)
}

export async function registerStudent(payload: RegisterPayload): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function verifyEmail(payload: VerifyEmailPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/verify-email/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await handleResponse<AuthResponse>(res)
  if (data.token) {
    setAuthToken(data.token)
  }
  return data
}

export async function resendVerificationCode(email: string): Promise<{ message: string; email_delivery?: any }> {
  const res = await fetch(`${API_BASE_URL}/auth/resend-verification/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ email }),
  })
  return handleResponse(res)
}

export async function loginStudent(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await handleResponse<AuthResponse>(res)
  if (data.token && data.user?.is_email_verified) {
    setAuthToken(data.token)
  }
  return data
}

export async function logoutStudent(): Promise<{ message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/logout/`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    removeAuthToken()
    return handleResponse(res)
  } catch (_err) {
    removeAuthToken()
    return { message: 'Logged out locally.' }
  }
}

export async function getCurrentStudent(): Promise<{ user: StudentProfile }> {
  const res = await fetch(`${API_BASE_URL}/auth/me/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function updateProfile(data: Partial<StudentProfile>): Promise<{ message: string; user: StudentProfile }> {
  const res = await fetch(`${API_BASE_URL}/auth/me/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function requestPasswordReset(email: string): Promise<{ message: string; email_delivery?: any }> {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ email }),
  })
  return handleResponse(res)
}

export async function confirmPasswordReset(payload: ResetPasswordPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/reset-password/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await handleResponse<AuthResponse>(res)
  if (data.token) {
    setAuthToken(data.token)
  }
  return data
}

export async function uploadProfilePhoto(file: File): Promise<{ message: string; avatar_url: string; user: StudentProfile }> {
  const formData = new FormData()
  formData.append('photo', file)

  const res = await fetch(`${API_BASE_URL}/auth/profile/photo/`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: formData,
  })
  return handleResponse(res)
}

// ========================================================
// MARKETPLACE APIS (Stage 4)
// ========================================================

export interface MarketplaceCategory {
  id: number
  name: string
  slug: string
  icon: string
  description: string
  order: number
}

export interface MarketplaceLender {
  id: number
  full_name: string
  username: string
  avatar_url: string | null
  default_avatar_url: string
  college_name: string
  college_short_code: string
  grad_year: number | null
  major?: string
  is_college_verified: boolean
  verification_status: 'unverified' | 'email_verified' | 'verified_student'
  trust_score?: number | null
  trust_status?: string
  completed_rentals_count?: number
  lender_average_rating?: string | number | null
  lender_review_count?: number
}

export interface ListingCollege {
  id: number
  name: string
  short_code: string
  city: string
  state: string
}

export interface ListingImageItem {
  id: number
  image_url: string
  is_primary: boolean
  order: number
}

export interface MarketplaceListing {
  id: number
  title: string
  description: string
  category: MarketplaceCategory
  subcategory: string
  listing_type: 'lend' | 'rent' | 'sell'
  listing_type_display?: string
  condition: 'brand_new' | 'like_new' | 'good' | 'fair'
  condition_display: string
  price: string | number
  deposit_amount: string | number
  pricing_unit: 'day' | 'week' | 'month' | 'semester' | 'item'
  pickup_location?: string
  image_url: string
  images: ListingImageItem[]
  is_available: boolean
  status: 'active' | 'unavailable' | 'rented' | 'paused' | 'archived'
  availability_status?: 'available' | 'currently_booked' | 'return_overdue' | 'unavailable'
  availability_label?: string
  booked_until?: string | null
  average_rating?: string | number | null
  review_count?: number
  college: ListingCollege | null
  lender: MarketplaceLender
  created_at: string
  updated_at: string
}

export interface ListingFilterParams {
  search?: string
  category?: string
  college_ids?: number[]
  college_id?: number
  listing_type?: string
  is_available?: boolean
}

export async function getMarketplaceCategories(): Promise<{ count: number; categories: MarketplaceCategory[] }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/categories/`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })
  return handleResponse(res)
}

export async function getMarketplaceListings(filters?: ListingFilterParams): Promise<{ count: number; listings: MarketplaceListing[] }> {
  const queryParams = new URLSearchParams()
  if (filters?.search) {
    queryParams.set('search', filters.search)
  }
  if (filters?.category && filters.category !== 'all') {
    queryParams.set('category', filters.category)
  }
  if (filters?.college_ids && filters.college_ids.length > 0) {
    queryParams.set('college_ids', filters.college_ids.join(','))
  } else if (filters?.college_id) {
    queryParams.set('college_id', String(filters.college_id))
  }
  if (filters?.listing_type && filters.listing_type !== 'all') {
    queryParams.set('listing_type', filters.listing_type)
  }
  if (filters?.is_available !== undefined) {
    queryParams.set('is_available', String(filters.is_available))
  }

  const queryString = queryParams.toString()
  const url = `${API_BASE_URL}/marketplace/listings/${queryString ? `?${queryString}` : ''}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })
  return handleResponse(res)
}

export async function getMarketplaceListingDetail(id: number): Promise<MarketplaceListing> {
  const res = await fetch(`${API_BASE_URL}/marketplace/listings/${id}/`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })
  return handleResponse(res)
}

export interface ListingPayload {
  title: string
  description?: string
  category_id: number
  subcategory?: string
  listing_type?: 'lend' | 'rent' | 'sell'
  condition?: string
  price?: number | string
  deposit_amount?: number | string
  pricing_unit?: string
  pickup_location?: string
  image_url?: string
  images?: string[]
  college_id?: number | null
  is_available?: boolean
  status?: 'active' | 'unavailable' | 'rented' | 'paused' | 'archived'
}


export async function createMarketplaceListing(payload: ListingPayload): Promise<MarketplaceListing> {
  const res = await fetch(`${API_BASE_URL}/marketplace/listings/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function updateMarketplaceListing(id: number, payload: Partial<ListingPayload>): Promise<MarketplaceListing> {
  const res = await fetch(`${API_BASE_URL}/marketplace/listings/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function archiveMarketplaceListing(id: number): Promise<{ message: string; listing: MarketplaceListing }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/listings/${id}/archive/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function getMyListings(statusFilter?: string): Promise<{ count: number; listings: MarketplaceListing[] }> {
  const url = statusFilter && statusFilter !== 'all'
    ? `${API_BASE_URL}/marketplace/my-listings/?status=${encodeURIComponent(statusFilter)}`
    : `${API_BASE_URL}/marketplace/my-listings/`
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function uploadListingPhoto(file: File): Promise<{
  message: string
  image_url: string
  filename?: string
  storage_configured?: boolean
}> {
  const formData = new FormData()
  formData.append('image', file)

  const res = await fetch(`${API_BASE_URL}/marketplace/upload-image/`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: formData,
  })
  return handleResponse(res)
}

// ----------------------------------------------------------------------
// Stage 6: Bookings & Wanted Requests
// ----------------------------------------------------------------------

export interface BookingListingSummary {
  id: number
  title: string
  category_name: string
  listing_type: 'lend' | 'rent' | 'sell'
  price: string
  pricing_unit: string
  deposit_amount: string
  pickup_location?: string
  image_url?: string
}

export interface BookingUserSummary {
  id: number
  username: string
  full_name: string
  college_name: string
  avatar_url?: string | null
  is_verified: boolean
  is_college_verified?: boolean
  trust_score?: number | null
  trust_status?: string
  grad_year?: number | null
  major?: string
  college_email?: string
}

export interface BookingStatusHistoryItem {
  status: string
  timestamp: string
  changed_by: string
  note?: string
}

export interface Booking {
  id: number
  listing: BookingListingSummary
  borrower: BookingUserSummary
  lender: BookingUserSummary
  status: 'pending' | 'accepted' | 'active' | 'returned' | 'completed' | 'declined' | 'cancelled'
  start_date: string
  end_date: string
  duration_days: number
  snapshot_listing_type: 'lend' | 'rent' | 'sell'
  snapshot_unit_price: string
  snapshot_pricing_unit: string
  snapshot_deposit_amount: string
  calculated_total_rent: string
  total_due_upfront: string
  pickup_confirmed_at?: string | null
  return_confirmed_at?: string | null
  agreed_advance_amount?: string | number | null
  advance_negotiation_status?: 'agreed' | 'proposed' | 'rejected'
  advance_proposal_notes?: string
  actual_rent_calculated?: string | number | null
  actual_duration_display?: string
  lender_proposed_rent?: string | number | null
  rent_adjustment_status?: 'none' | 'proposed' | 'accepted' | 'rejected'
  rent_adjustment_reason?: string
  settlement_agreed_by_borrower?: boolean
  settlement_agreed_by_lender?: boolean
  settlement_status?: string
  relist_prompted?: boolean
  relist_choice?: 'relist' | 'edit' | 'archive' | null
  borrower_message: string
  owner_response_note: string
  status_history: BookingStatusHistoryItem[]
  currency?: string
  financial_summary?: FinancialSummary
  created_at: string
  updated_at: string
}

export interface BookingQuote {
  listing_id: number
  start_date: string
  end_date: string
  quote: {
    listing_type: 'lend' | 'rent' | 'sell'
    unit_price: string
    pricing_unit: string
    duration_units: number
    duration_days: number
    total_rent: string
    deposit_amount: string
    total_due_upfront: string
  }
  has_conflict: boolean
  conflicts_count: number
}

export interface BookingCreatePayload {
  listing_id: number
  start_date: string
  end_date: string
  borrower_message?: string
}

export async function getBookingQuote(
  listingId: number,
  startDate: string,
  endDate: string
): Promise<BookingQuote> {
  const params = new URLSearchParams({
    listing_id: String(listingId),
    start_date: startDate,
    end_date: endDate,
  })
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/quote/?${params.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function createBooking(payload: BookingCreatePayload): Promise<Booking> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function getMyBookings(
  statusFilter?: string
): Promise<{ count: number; bookings: Booking[] }> {
  const url = statusFilter && statusFilter !== 'all'
    ? `${API_BASE_URL}/marketplace/my-bookings/?status=${encodeURIComponent(statusFilter)}`
    : `${API_BASE_URL}/marketplace/my-bookings/`
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function getIncomingBookings(
  statusFilter?: string
): Promise<{ count: number; bookings: Booking[] }> {
  const url = statusFilter && statusFilter !== 'all'
    ? `${API_BASE_URL}/marketplace/incoming-bookings/?status=${encodeURIComponent(statusFilter)}`
    : `${API_BASE_URL}/marketplace/incoming-bookings/`
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function getBookingDetail(id: number): Promise<Booking> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${id}/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function actionBooking(
  bookingId: number,
  payload: {
    action: 'accept' | 'decline' | 'complete'
    note?: string
    start_date?: string
    end_date?: string
  }
): Promise<{ message: string; booking: Booking }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/action/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function cancelBooking(
  bookingId: number,
  note?: string
): Promise<{ message: string; booking: Booking }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/cancel/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ note: note || '' }),
  })
  return handleResponse(res)
}

// Stage 7: QR Handover and Return Verification
export interface HandoverQRData {
  booking_id: number
  action_type: 'pickup' | 'return'
  raw_token: string
  verification_code: string
  expires_at: string
  qr_payload: string
}

export async function generateHandoverQR(
  bookingId: number,
  actionType: 'pickup' | 'return'
): Promise<HandoverQRData> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/generate-qr/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action_type: actionType }),
  })
  return handleResponse(res)
}

export async function verifyHandover(
  bookingId: number,
  payload: {
    action_type: 'pickup' | 'return'
    token: string
  }
): Promise<{ message: string; booking: Booking }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/verify-handover/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

// Wanted Item Requests
export interface WantedItemResponse {
  id: number
  request_id: number
  responder: BookingUserSummary
  message: string
  offered_price: string
  offered_listing?: BookingListingSummary | null
  status: 'pending' | 'interested' | 'declined'
  created_at: string
}

export interface WantedItemRequest {
  id: number
  requester: BookingUserSummary
  title: string
  description: string
  category: { id: number; name: string; slug: string }
  request_type: 'rent' | 'borrow' | 'buy'
  budget: string
  preferred_terms: string
  needed_date: string | null
  college: College | null
  notes: string
  status: 'open' | 'fulfilled' | 'closed'
  responses_count: number
  responses?: WantedItemResponse[]
  created_at: string
  updated_at: string
}

export interface WantedRequestPayload {
  title: string
  description?: string
  category_id: number
  request_type?: 'rent' | 'borrow' | 'buy'
  budget?: string
  preferred_terms?: string
  needed_date?: string
  college_id?: number | null
  notes?: string
}

export async function getWantedRequests(filters?: {
  category?: string
  college_id?: number
  status?: string
  mine?: boolean
}): Promise<{ count: number; requests: WantedItemRequest[] }> {
  const params = new URLSearchParams()
  if (filters?.category && filters.category !== 'all') {
    params.set('category', filters.category)
  }
  if (filters?.college_id) {
    params.set('college_id', String(filters.college_id))
  }
  if (filters?.status && filters.status !== 'all') {
    params.set('status', filters.status)
  }
  if (filters?.mine) {
    params.set('mine', 'true')
  }

  const queryString = params.toString()
  const url = `${API_BASE_URL}/marketplace/wanted-requests/${queryString ? `?${queryString}` : ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function getWantedRequestDetail(id: number): Promise<WantedItemRequest> {
  const res = await fetch(`${API_BASE_URL}/marketplace/wanted-requests/${id}/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function createWantedRequest(
  payload: WantedRequestPayload
): Promise<WantedItemRequest> {
  const res = await fetch(`${API_BASE_URL}/marketplace/wanted-requests/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function respondToWantedRequest(
  requestId: number,
  payload: {
    message: string
    offered_price?: string
    offered_listing_id?: number | null
  }
): Promise<WantedItemResponse> {
  const res = await fetch(`${API_BASE_URL}/marketplace/wanted-requests/${requestId}/respond/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function actionWantedResponse(
  responseId: number,
  action: 'interested' | 'declined'
): Promise<{ message: string; response: WantedItemResponse }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/wanted-responses/${responseId}/action/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action }),
  })
  return handleResponse(res)
}

// ========================================================
// Stage 8: Financial Management & Direct Payment Tracking
// ========================================================

export interface FinancialSummary {
  invoice_number: string
  booking_id: number
  currency: string
  booking_type: string
  listing_title: string
  start_date: string
  end_date: string
  duration_days: number
  rental_rate: string
  pricing_unit: string
  agreed_base_rent: string
  agreed_deposit: string
  total_due_upfront: string
  rent_declared: string
  rent_confirmed: string
  rent_disputed: string
  rent_outstanding: string
  is_rent_settled: boolean
  deposit_declared: string
  deposit_confirmed: string
  deposit_disputed: string
  deposit_outstanding: string
  is_deposit_confirmed: boolean
  total_declared_paid: string
  total_confirmed_received: string
  total_disputed: string
  total_outstanding_upfront: string
  approved_deductions: string
  proposed_adjustments: string
  disputed_adjustments: string
  has_disputed_adjustments: boolean
  net_refundable_deposit: string
  refund_status: string
  refund_declared_amount: string
  refund_confirmed_amount: string
  settlement_status: string
  settlement_status_display?: string
  borrower_agreed_settlement?: boolean
  lender_agreed_settlement?: boolean
  actual_return_time?: string | null
  has_disputes: boolean
  // Enhanced Dynamic Itemized Bill Fields (Sections 3, 4, 5, 6, 7)
  actual_duration_display?: string
  original_rent_estimate?: string
  system_calculated_rent?: string
  rent_adjustment_status?: string
  lender_proposed_rent?: string | null
  rent_adjustment_reason?: string
  final_agreed_rent?: string
  rent_status_label?: string
  agreed_advance_deposit?: string
  advance_negotiation_status?: string
  advance_declared_paid?: string
  advance_confirmed_received?: string
  advance_disputed?: string
  accepted_late_fees?: string
  accepted_damage_fees?: string
  other_accepted_adjustments?: string
  total_accepted_penalties?: string
  total_obligations?: string
  net_lender_owes_borrower?: string
  net_borrower_owes_lender?: string
  settlement_agreed_by_borrower?: boolean
  settlement_agreed_by_lender?: boolean
  is_mutually_agreed?: boolean
  adjustment_items?: Array<{
    id: number
    type: string
    type_display: string
    amount: string
    reason: string
    description?: string
    evidence_url?: string
    status: string
    proposed_by_name: string
    response_note?: string
  }>
  disclaimer: string
}

export interface PaymentRecordItem {
  id: number
  booking_id: number
  payer: BookingUserSummary
  recipient: BookingUserSummary
  purpose: 'rent' | 'deposit' | 'adjustment' | 'other'
  purpose_display: string
  amount: string
  currency: string
  payment_method: 'upi' | 'bank_transfer' | 'cash' | 'other'
  payment_method_display: string
  status: 'declared' | 'confirmed' | 'disputed' | 'cancelled'
  status_display: string
  transaction_reference?: string
  evidence_url?: string
  payer_notes?: string
  declared_at: string
  confirmed_at?: string | null
  confirmed_by_name?: string | null
  disputed_at?: string | null
  disputed_by_name?: string | null
  dispute_reason?: string
  created_at: string
}

export interface SettlementAdjustmentItem {
  id: number
  booking_id: number
  adjustment_type: 'late_fee' | 'damage' | 'cleaning' | 'extension_fee' | 'other'
  adjustment_type_display: string
  amount: string
  reason: string
  description?: string
  proposed_by: BookingUserSummary
  evidence_url?: string
  status: 'proposed' | 'accepted' | 'disputed' | 'cancelled'
  status_display: string
  resolved_at?: string | null
  resolved_by_name?: string | null
  response_note?: string
  created_at: string
}

export interface DepositRefundItem {
  id: number
  booking_id: number
  original_deposit: string
  approved_deductions: string
  net_refund_amount: string
  refund_method: 'upi' | 'bank_transfer' | 'cash' | 'other'
  refund_method_display: string
  transaction_reference?: string
  evidence_url?: string
  notes?: string
  status: 'pending' | 'declared' | 'confirmed' | 'disputed'
  status_display: string
  declared_at?: string | null
  declared_by_name?: string | null
  confirmed_at?: string | null
  confirmed_by_name?: string | null
  disputed_at?: string | null
  disputed_by_name?: string | null
  dispute_reason?: string
  created_at: string
}

export interface BookingFinancialsResponse {
  booking_id: number
  booking?: Booking | null
  is_lender: boolean
  is_borrower: boolean
  summary: FinancialSummary
  payments: PaymentRecordItem[]
  adjustments: SettlementAdjustmentItem[]
  deposit_refund: DepositRefundItem | null
}

export interface BookingSettlementBillResponse {
  bill_number: string
  generated_at: string
  booking: Booking
  financial_summary: FinancialSummary
  payments: PaymentRecordItem[]
  adjustments: SettlementAdjustmentItem[]
  deposit_refund: DepositRefundItem | null
  disclaimer: string
}

export async function getBookingFinancials(
  bookingId: number
): Promise<BookingFinancialsResponse> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/financials/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function declarePayment(
  bookingId: number,
  payload: {
    purpose: 'rent' | 'deposit' | 'adjustment' | 'other'
    amount: string | number
    payment_method: 'upi' | 'bank_transfer' | 'cash' | 'other'
    transaction_reference?: string
    evidence_url?: string
    payer_notes?: string
  }
): Promise<{ message: string; payment: PaymentRecordItem; summary: FinancialSummary }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/payments/declare/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function confirmPayment(
  paymentId: number
): Promise<{ message: string; payment: PaymentRecordItem; summary: FinancialSummary }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/payments/${paymentId}/confirm/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function disputePayment(
  paymentId: number,
  disputeReason: string
): Promise<{ message: string; payment: PaymentRecordItem; summary: FinancialSummary }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/payments/${paymentId}/dispute/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ dispute_reason: disputeReason }),
  })
  return handleResponse(res)
}

export async function proposeAdjustment(
  bookingId: number,
  payload: {
    adjustment_type: 'late_fee' | 'damage' | 'cleaning' | 'extension_fee' | 'other'
    amount: string | number
    reason: string
    description?: string
    evidence_url?: string
  }
): Promise<{ message: string; adjustment: SettlementAdjustmentItem; summary: FinancialSummary }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/adjustments/propose/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function respondAdjustment(
  adjustmentId: number,
  payload: {
    action: 'accept' | 'dispute'
    response_note?: string
  }
): Promise<{ message: string; adjustment: SettlementAdjustmentItem; summary: FinancialSummary }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/adjustments/${adjustmentId}/respond/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function declareDepositRefund(
  bookingId: number,
  payload: {
    refund_method: 'upi' | 'bank_transfer' | 'cash' | 'other'
    transaction_reference?: string
    evidence_url?: string
    notes?: string
  }
): Promise<{ message: string; deposit_refund: DepositRefundItem; summary: FinancialSummary }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/refund/declare/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function confirmDepositRefund(
  bookingId: number,
  payload: {
    action: 'confirm' | 'dispute'
    dispute_reason?: string
  }
): Promise<{ message: string; deposit_refund: DepositRefundItem; summary: FinancialSummary }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/refund/confirm/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function getBookingSettlementBill(
  bookingId: number
): Promise<BookingSettlementBillResponse> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/settlement-bill/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function uploadPaymentEvidence(
  file: File
): Promise<{ message: string; evidence_url: string; filename: string; is_verified: boolean }> {
  const formData = new FormData()
  formData.append('evidence', file)
  const res = await fetch(`${API_BASE_URL}/marketplace/upload-payment-evidence/`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: formData,
  })
  return handleResponse(res)
}

// ========================================================
// STAGE 9: NOTIFICATIONS & USER MESSAGING APIS
// ========================================================

export interface NotificationItem {
  id: number
  actor: MarketplaceLender | null
  title: string
  message: string
  notification_type: string
  notification_type_display: string
  listing_title: string | null
  booking_id: number | null
  wanted_request_title: string | null
  target_modal: string
  target_id: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationsResponse {
  count: number
  unread_count: number
  page: number
  page_size: number
  notifications: NotificationItem[]
}

export interface ConversationItem {
  id: number
  subject: string
  other_participant: MarketplaceLender
  latest_message: {
    id: number
    sender_name: string
    content: string
    created_at: string
    is_read: boolean
  } | null
  unread_count: number
  context_type: 'booking' | 'listing' | 'wanted_request' | 'general'
  context_title: string
  listing_id: number | null
  booking_id: number | null
  wanted_request_id: number | null
  last_message_at: string
  created_at: string
  updated_at: string
}

export interface MessageItem {
  id: number
  conversation_id: number
  sender: MarketplaceLender
  content: string
  is_mine: boolean
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface UnreadCountsResponse {
  notifications_unread: number
  messages_unread: number
  total_unread: number
}

export async function getNotifications(
  status: 'all' | 'unread' = 'all',
  page = 1,
  pageSize = 20
): Promise<NotificationsResponse> {
  const res = await fetch(`${API_BASE_URL}/marketplace/notifications/?status=${status}&page=${page}&page_size=${pageSize}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function markNotificationRead(
  id: number
): Promise<{ message: string; notification: NotificationItem; unread_count: number }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/notifications/${id}/read/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function markAllNotificationsRead(): Promise<{ message: string; unread_count: number }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/notifications/read-all/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function getUnreadCounts(): Promise<UnreadCountsResponse> {
  const res = await fetch(`${API_BASE_URL}/marketplace/unread-counts/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function getConversations(): Promise<{ count: number; conversations: ConversationItem[] }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/conversations/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function startConversation(payload: {
  listing_id?: number
  booking_id?: number
  wanted_request_id?: number
  initial_message?: string
}): Promise<ConversationItem> {
  const res = await fetch(`${API_BASE_URL}/marketplace/conversations/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function getConversation(id: number): Promise<ConversationItem> {
  const res = await fetch(`${API_BASE_URL}/marketplace/conversations/${id}/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function getConversationMessages(
  conversationId: number,
  page = 1,
  pageSize = 50
): Promise<{ count: number; page: number; page_size: number; conversation_id: number; messages: MessageItem[] }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/conversations/${conversationId}/messages/?page=${page}&page_size=${pageSize}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function sendConversationMessage(
  conversationId: number,
  content: string
): Promise<MessageItem> {
  const res = await fetch(`${API_BASE_URL}/marketplace/conversations/${conversationId}/messages/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content }),
  })
  return handleResponse(res)
}

// ========================================================
// COMPLETE LIFECYCLE, SETTLEMENT, REVIEWS & TRUST ENHANCEMENTS
// ========================================================

export interface ReviewItem {
  id: number
  booking_id: number
  reviewer_name: string
  review_type: 'product' | 'lender'
  rating: number
  comment: string
  target_listing_id?: number | null
  target_lender_id?: number | null
  created_at: string
}

export interface TrustScoreExplanation {
  profile_id: number
  trust_score: number | null
  trust_status: string
  status_label: string
  confidence: string
  completed_rentals_count: number
  on_time_returns_count: number
  early_returns_count: number
  late_returns_count: number
  confirmed_damage_count: number
  disputed_claims_count: number
  lender_rating_average: number | null
  lender_review_count: number
  explanation: string
  scoring_rules: {
    base_score: number
    on_time_return_bonus: string
    early_return_bonus: string
    late_return_penalty: string
    confirmed_damage_penalty: string
    volume_booster: string
  }
}

export interface ReviewItem {
  id: number
  booking_id: number
  reviewer: BookingUserSummary
  reviewee?: BookingUserSummary | null
  listing_id?: number | null
  listing_title?: string | null
  review_type: 'product' | 'lender'
  review_type_display?: string
  rating: number
  comment: string
  created_at: string
}

export type Review = ReviewItem

export interface LateFeeEstimate {
  booking_id: number
  end_date: string
  grace_cutoff: string
  is_late: boolean
  is_overdue?: boolean
  late_hours: number
  hours_late?: number
  suggested_late_fee: string
  pricing_unit: string
  policy_description: string
  message?: string
}

// Advance Negotiation (Section 2)
export async function proposeAdvancePayment(
  bookingId: number,
  payload: { proposed_amount: string | number; notes?: string }
): Promise<{ message: string; booking: Booking }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/propose-advance/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function respondAdvancePayment(
  bookingId: number,
  payload: { action: 'accept' | 'reject'; notes?: string }
): Promise<{ message: string; booking: Booking }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/respond-advance/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

// Rent Adjustment (Section 4)
export async function proposeRentAdjustment(
  bookingId: number,
  payload: { proposed_rent: string | number; reason: string }
): Promise<{ message: string; booking: Booking; adjustment: any }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/propose-rent-adjustment/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function respondRentAdjustment(
  bookingId: number,
  payload: { action: 'accept' | 'reject'; reason?: string }
): Promise<{ message: string; booking: Booking }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/respond-rent-adjustment/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

// Late Fee Estimate (Section 5)
export async function getLateFeeEstimate(bookingId: number): Promise<LateFeeEstimate> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/late-fee-estimate/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

// Mutual Settlement (Section 6)
export async function agreeToSettlement(bookingId: number): Promise<{
  message: string
  financial_summary: FinancialSummary
  booking: Booking
  is_mutually_agreed: boolean
}> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/agree-settlement/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

// Re-listing Choice (Section 9)
export async function submitRelistChoice(
  bookingId: number,
  payload: { choice: 'relist' | 'edit' | 'archive' }
): Promise<{ message: string; relist_choice: string; listing: MarketplaceListing; booking: Booking }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/relist-choice/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

// Reviews & Ratings (Section 10)
export async function submitBookingReview(
  bookingId: number,
  payload: { review_type: 'product' | 'lender'; rating: number; comment?: string }
): Promise<{ message: string; review: ReviewItem }> {
  const res = await fetch(`${API_BASE_URL}/marketplace/bookings/${bookingId}/reviews/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function getListingReviews(listingId: number): Promise<{
  count: number
  average_rating: number
  reviews: ReviewItem[]
}> {
  const res = await fetch(`${API_BASE_URL}/marketplace/listings/${listingId}/reviews/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

export async function getProfileReviews(
  profileId: number,
  type?: 'product' | 'lender'
): Promise<{ count: number; reviews: ReviewItem[] }> {
  const query = type ? `?type=${type}` : ''
  const res = await fetch(`${API_BASE_URL}/marketplace/profiles/${profileId}/reviews/${query}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}

// Explainable Trust Score (Section 11)
export async function getProfileTrustScore(profileId: number): Promise<TrustScoreExplanation> {
  const res = await fetch(`${API_BASE_URL}/marketplace/profiles/${profileId}/trust-score/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  return handleResponse(res)
}




