import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Camera,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Building,
  KeyRound,
  LogOut,
  Info,
} from 'lucide-react'
import {
  type College,
  getColleges,
  registerStudent,
  verifyEmail,
  resendVerificationCode,
  loginStudent,
  requestPasswordReset,
  confirmPasswordReset,
  uploadProfilePhoto,
  updateProfile,
} from '../services/api'
import { useAuth } from '../context/AuthContext'

export function AuthModal() {
  const {
    user,
    isModalOpen,
    modalView,
    pendingEmail,
    openAuthModal,
    closeAuthModal,
    loginSuccess,
    logout,
    refreshUser,
  } = useAuth()

  // General form states
  const [colleges, setColleges] = useState<College[]>([])
  const [loadingColleges, setLoadingColleges] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Registration state
  const [regFullName, setRegFullName] = useState('')
  const [regCollegeId, setRegCollegeId] = useState<string>('')
  const [regCustomCollege, setRegCustomCollege] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')

  // Verification state
  const [verifyEmailAddr, setVerifyEmailAddr] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [devOtpNotice, setDevOtpNotice] = useState<string | null>(null)
  const [resendingCode, setResendingCode] = useState(false)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  // Profile photo upload state
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Profile edit state
  const [editMajor, setEditMajor] = useState('')
  const [editGradYear, setEditGradYear] = useState('')
  const [editBio, setEditBio] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Load Colleges registry on mount
  useEffect(() => {
    let ignore = false
    setLoadingColleges(true)
    getColleges()
      .then((data) => {
        if (!ignore) {
          setColleges(data.colleges)
          if (data.colleges.length > 0 && !regCollegeId) {
            setRegCollegeId(String(data.colleges[0].id))
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load colleges:', err)
      })
      .finally(() => {
        if (!ignore) setLoadingColleges(false)
      })

    return () => {
      ignore = true
    }
  }, [regCollegeId])

  // Sync state when modal view changes
  useEffect(() => {
    setErrorBanner(null)
    setSuccessBanner(null)
    if (pendingEmail) {
      setVerifyEmailAddr(pendingEmail)
      setLoginEmail(pendingEmail)
      setForgotEmail(pendingEmail)
    }
    if (user && modalView === 'profile-view') {
      setEditMajor(user.major || '')
      setEditGradYear(user.grad_year ? String(user.grad_year) : '')
      setEditBio(user.bio || '')
    }
  }, [modalView, pendingEmail, user])

  if (!isModalOpen) return null

  // 1. Handle Registration
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setErrorBanner(null)
    setSuccessBanner(null)
    setIsSubmitting(true)

    try {
      const isOther = regCollegeId === 'other'
      const collegeIdNum = isOther ? null : Number(regCollegeId)

      const response = await registerStudent({
        full_name: regFullName,
        email: regEmail,
        college_id: collegeIdNum,
        custom_college_name: isOther ? regCustomCollege : undefined,
        password: regPassword,
        confirm_password: regConfirmPassword,
      })

      setVerifyEmailAddr(response.email)
      if (response.email_delivery?.dev_code) {
        setDevOtpNotice(`Development verification code: ${response.email_delivery.dev_code}`)
      } else {
        setDevOtpNotice(null)
      }

      openAuthModal('verify-email', response.email)
      setSuccessBanner(response.message)
    } catch (err: any) {
      setErrorBanner(err.message || 'Registration failed. Please check your inputs.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. Handle Email Verification
  const handleVerifyEmail = async (e: FormEvent) => {
    e.preventDefault()
    setErrorBanner(null)
    setSuccessBanner(null)
    setIsSubmitting(true)

    try {
      const response = await verifyEmail({
        email: verifyEmailAddr,
        code: verifyCode.trim(),
      })

      loginSuccess(response.user, response.token)
      setSuccessBanner(response.message)

      // Move to optional profile photo setup
      openAuthModal('profile-photo')
    } catch (err: any) {
      setErrorBanner(err.message || 'Invalid or expired verification code.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2b. Resend Verification Code
  const handleResendCode = async () => {
    if (!verifyEmailAddr) return
    setErrorBanner(null)
    setResendingCode(true)
    try {
      const res = await resendVerificationCode(verifyEmailAddr)
      if (res.email_delivery?.dev_code) {
        setDevOtpNotice(`Development verification code: ${res.email_delivery.dev_code}`)
      }
      setSuccessBanner(res.message)
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to resend verification code.')
    } finally {
      setResendingCode(false)
    }
  }

  // 3. Handle Login
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setErrorBanner(null)
    setSuccessBanner(null)
    setIsSubmitting(true)

    try {
      const response = await loginStudent({
        email: loginEmail,
        password: loginPassword,
      })

      loginSuccess(response.user, response.token)

      if (!response.user.is_email_verified) {
        setVerifyEmailAddr(response.user.college_email)
        if (response.email_delivery?.dev_code) {
          setDevOtpNotice(`Development verification code: ${response.email_delivery.dev_code}`)
        }
        openAuthModal('verify-email', response.user.college_email)
        setSuccessBanner(`A verification code was sent to ${response.user.college_email}. Please enter it below.`)
      } else {
        closeAuthModal()
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Invalid email or password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 4. Handle Forgot Password Request
  const handleForgotPasswordRequest = async (e: FormEvent) => {
    e.preventDefault()
    setErrorBanner(null)
    setIsSubmitting(true)

    try {
      const res = await requestPasswordReset(forgotEmail)
      setSuccessBanner(res.message)
      setResetStep('confirm')
      if (res.email_delivery?.dev_code) {
        setDevOtpNotice(`Development reset code: ${res.email_delivery.dev_code}`)
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to send password reset code.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 4b. Handle Password Reset Confirm
  const handlePasswordResetConfirm = async (e: FormEvent) => {
    e.preventDefault()
    setErrorBanner(null)
    setIsSubmitting(true)

    try {
      const res = await confirmPasswordReset({
        email: forgotEmail,
        code: resetCode.trim(),
        new_password: newPassword,
        confirm_password: confirmNewPassword,
      })
      loginSuccess(res.user, res.token)
      closeAuthModal()
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to reset password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 5. Handle Profile Photo Upload & Skip
  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedPhoto(file)
      const previewUrl = URL.createObjectURL(file)
      setPhotoPreview(previewUrl)
    }
  }

  const handleUploadPhoto = async () => {
    if (!selectedPhoto) return
    setErrorBanner(null)
    setUploadingPhoto(true)

    try {
      await uploadProfilePhoto(selectedPhoto)
      await refreshUser()
      closeAuthModal()
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not upload photo to Supabase Storage.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSkipPhoto = () => {
    closeAuthModal()
  }

  // 6. Handle Profile Edit
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setErrorBanner(null)
    setSavingProfile(true)

    try {
      await updateProfile({
        major: editMajor.trim(),
        grad_year: editGradYear ? Number(editGradYear) : null,
        bio: editBio.trim(),
      })
      await refreshUser()
      setSuccessBanner('Profile details updated successfully.')
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-0 sm:my-6 flex flex-col max-h-[94vh] sm:max-h-[92vh]">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Top Header */}
        <div className="p-4 sm:p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1B3B2B] text-white flex items-center justify-center shadow-md shadow-emerald-950/20">
              {modalView === 'login' ? (
                <Lock className="w-5 h-5 text-emerald-300" />
              ) : modalView === 'signup' ? (
                <GraduationCap className="w-5 h-5 text-emerald-300" />
              ) : modalView === 'verify-email' ? (
                <Mail className="w-5 h-5 text-emerald-300" />
              ) : modalView === 'profile-photo' ? (
                <Camera className="w-5 h-5 text-emerald-300" />
              ) : modalView === 'forgot-password' ? (
                <KeyRound className="w-5 h-5 text-emerald-300" />
              ) : (
                <UserIcon className="w-5 h-5 text-emerald-300" />
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                {modalView === 'login' && 'Student Sign In'}
                {modalView === 'signup' && 'Create Student Account'}
                {modalView === 'verify-email' && 'Verify College Email'}
                {modalView === 'profile-photo' && 'Profile Photo'}
                {modalView === 'forgot-password' && 'Reset Password'}
                {modalView === 'profile-view' && 'Student Profile'}
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                {modalView === 'login' && 'Access verified peer sharing & campus exchanges'}
                {modalView === 'signup' && 'Join your verified university community'}
                {modalView === 'verify-email' && 'Confirm email ownership to unlock verified status'}
                {modalView === 'profile-photo' && 'Optional photo setup (or keep neutral avatar)'}
                {modalView === 'forgot-password' && 'Receive a 6-digit OTP code to update your password'}
                {modalView === 'profile-view' && user?.display_college}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAuthModal}
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Alert / Status Banners */}
        <div className="px-6 pt-4 space-y-2">
          {errorBanner && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/90 text-rose-800 text-xs flex items-start space-x-2.5 animate-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{errorBanner}</div>
            </div>
          )}

          {successBanner && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-emerald-900 text-xs flex items-start space-x-2.5 animate-in slide-in-from-top-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{successBanner}</div>
            </div>
          )}

          {devOtpNotice && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-bold block">Development Notice:</span>
                <span className="font-mono font-bold text-amber-950">{devOtpNotice}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* ======================================================== */}
          {/* VIEW 1: LOGIN                                            */}
          {/* ======================================================== */}
          {modalView === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5" htmlFor="login-email">
                  College Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="student@cit.edu.in"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 focus:border-[#1B3B2B] focus:ring-2 focus:ring-[#1B3B2B]/10 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-stone-700" htmlFor="login-password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => openAuthModal('forgot-password', loginEmail)}
                    className="text-xs font-semibold text-[#1B3B2B] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-stone-200 focus:border-[#1B3B2B] focus:ring-2 focus:ring-[#1B3B2B]/10 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md shadow-emerald-950/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to CampusShare</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="pt-3 border-t border-stone-100 text-center">
                <span className="text-xs text-stone-500">Don't have an account yet? </span>
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="text-xs font-bold text-[#1B3B2B] hover:underline cursor-pointer"
                >
                  Register here
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: REGISTRATION                                     */}
          {/* ======================================================== */}
          {modalView === 'signup' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="reg-fullname">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    id="reg-fullname"
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 focus:border-[#1B3B2B] focus:ring-2 focus:ring-[#1B3B2B]/10 text-sm text-stone-900 outline-none transition-all"
                  />
                </div>
              </div>

              {/* College Registry Selection */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="reg-college">
                  University / College
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <select
                    id="reg-college"
                    value={regCollegeId}
                    onChange={(e) => setRegCollegeId(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 rounded-2xl border border-stone-200 focus:border-[#1B3B2B] focus:ring-2 focus:ring-[#1B3B2B]/10 text-sm text-stone-900 bg-white outline-none transition-all cursor-pointer"
                  >
                    {loadingColleges && <option value="">Loading college registry...</option>}
                    {colleges.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name} ({col.domain})
                      </option>
                    ))}
                    <option value="other">Other / Unsupported College</option>
                  </select>
                </div>
                {regCollegeId !== 'other' && colleges.length > 0 && (
                  <p className="mt-1 text-[11px] text-stone-500 flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                    Emails matching this college's domain unlock verified status upon email verification.
                  </p>
                )}
              </div>

              {/* Custom College Name if "Other" is chosen */}
              {regCollegeId === 'other' && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 animate-in fade-in">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                    <Info className="w-4 h-4 text-amber-700" />
                    <span>Independent Student Notice</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Students from colleges not yet in our official verified registry may register as community members. Accounts remain unverified until institutional partnership.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="reg-custom-college">
                      College Name
                    </label>
                    <input
                      id="reg-custom-college"
                      type="text"
                      required
                      value={regCustomCollege}
                      onChange={(e) => setRegCustomCollege(e.target.value)}
                      placeholder="Enter your college or institute name"
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-sm outline-none"
                    />
                  </div>
                </div>
              )}

              {/* College Email Address */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="reg-email">
                  College Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="yourname@cit.edu.in"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 focus:border-[#1B3B2B] focus:ring-2 focus:ring-[#1B3B2B]/10 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-400"
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="reg-password">
                    Password (min 8 chars)
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 focus:border-[#1B3B2B] focus:ring-2 focus:ring-[#1B3B2B]/10 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="reg-confirm-password">
                    Confirm Password
                  </label>
                  <input
                    id="reg-confirm-password"
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 focus:border-[#1B3B2B] focus:ring-2 focus:ring-[#1B3B2B]/10 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md shadow-emerald-950/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      <span>Creating Account & Dispatching Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Email Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="pt-3 border-t border-stone-100 text-center">
                <span className="text-xs text-stone-500">Already registered? </span>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="text-xs font-bold text-[#1B3B2B] hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* VIEW 3: EMAIL VERIFICATION                               */}
          {/* ======================================================== */}
          {modalView === 'verify-email' && (
            <form onSubmit={handleVerifyEmail} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-2 border border-emerald-100">
                  <Mail className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-stone-900">Enter Your 6-Digit Code</h4>
                <p className="text-xs text-stone-600 max-w-sm mx-auto">
                  We dispatched a verification code to{' '}
                  <span className="font-semibold text-stone-900">{verifyEmailAddr || 'your email'}</span>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 text-center mb-2" htmlFor="verify-code">
                  Verification Code (OTP)
                </label>
                <div className="max-w-xs mx-auto">
                  <input
                    id="verify-code"
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 rounded-2xl border-2 border-stone-300 focus:border-[#1B3B2B] focus:ring-4 focus:ring-[#1B3B2B]/10 outline-none transition-all font-bold text-stone-900"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || verifyCode.length !== 6}
                  className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md shadow-emerald-950/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Verify Email</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-2">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendingCode}
                    className="text-stone-600 hover:text-[#1B3B2B] font-semibold underline cursor-pointer disabled:opacity-50"
                  >
                    {resendingCode ? 'Sending fresh code...' : 'Resend code'}
                  </button>

                  <button
                    type="button"
                    onClick={() => openAuthModal('signup')}
                    className="text-stone-500 hover:text-stone-800 cursor-pointer"
                  >
                    Change email address
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* VIEW 4: OPTIONAL PROFILE PHOTO SETUP                     */}
          {/* ======================================================== */}
          {modalView === 'profile-photo' && (
            <div className="space-y-6 text-center">
              <div>
                <h4 className="text-base font-bold text-stone-900">Add a Profile Photo</h4>
                <p className="text-xs text-stone-600 mt-1">
                  Upload an optional photo so peers recognize you during item handoffs. You can skip this step anytime.
                </p>
              </div>

              {/* Avatar Preview */}
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full border-4 border-[#FBF8F3] shadow-lg overflow-hidden bg-stone-100 flex items-center justify-center">
                    <img
                      src={photoPreview || user?.avatar_url || user?.default_avatar_url || 'https://ui-avatars.com/api/?name=CS&background=1B3B2B&color=fff&size=200'}
                      alt="Student Avatar Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 rounded-full bg-[#1B3B2B] text-white shadow-md hover:bg-[#25503B] transition-transform hover:scale-105 cursor-pointer"
                    title="Choose photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />

                <span className="text-xs text-stone-500">
                  {selectedPhoto ? selectedPhoto.name : 'PNG, JPEG, or WebP (max 5MB)'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 text-left text-xs text-stone-600 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <p>
                  Photos are stored in configured Supabase Cloud Storage. If skipped, a neutral avatar with your initials is automatically used.
                </p>
              </div>

              {/* Buttons: Upload or Skip */}
              <div className="space-y-2 pt-2">
                {selectedPhoto ? (
                  <button
                    type="button"
                    onClick={handleUploadPhoto}
                    disabled={uploadingPhoto}
                    className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {uploadingPhoto ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        <span>Uploading to Supabase Storage...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>Save & Complete Setup</span>
                      </>
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleSkipPhoto}
                  className="w-full py-3 rounded-full text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 5: FORGOT PASSWORD                                  */}
          {/* ======================================================== */}
          {modalView === 'forgot-password' && (
            <div>
              {resetStep === 'request' ? (
                <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                  <p className="text-xs text-stone-600">
                    Enter the college email address linked to your CampusShare account. We will send you a 6-digit OTP to reset your password.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5" htmlFor="forgot-email">
                      College Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                      <input
                        id="forgot-email"
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="student@cit.edu.in"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none focus:border-[#1B3B2B]"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                          <span>Dispatching Reset Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Send 6-Digit Reset Code</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => openAuthModal('login')}
                      className="text-xs font-bold text-stone-600 hover:underline cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handlePasswordResetConfirm} className="space-y-4">
                  <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                    Enter the 6-digit code sent to <span className="font-semibold text-stone-900">{forgotEmail}</span> and your new password.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="reset-code">
                      6-Digit Reset Code
                    </label>
                    <input
                      id="reset-code"
                      type="text"
                      required
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full text-center tracking-widest font-mono text-xl py-2 rounded-2xl border border-stone-200 text-stone-900 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="new-password">
                      New Password (min 8 chars)
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="confirm-new-password">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-new-password"
                      type="password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <span>Reset Password & Sign In</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 6: STUDENT PROFILE DETAILS & SETTINGS               */}
          {/* ======================================================== */}
          {modalView === 'profile-view' && user && (
            <div className="space-y-5">
              {/* Profile Card Header */}
              <div className="flex items-center space-x-4 p-4 rounded-3xl bg-[#FBF8F3] border border-stone-200/80">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-200 border-2 border-white shadow-sm flex items-center justify-center">
                    <img
                      src={user.avatar_url || user.default_avatar_url}
                      alt={user.full_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => openAuthModal('profile-photo')}
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#1B3B2B] text-white shadow hover:bg-[#25503B] transition-transform hover:scale-105 cursor-pointer"
                    title="Change Photo"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-stone-900 truncate">{user.full_name}</h4>
                    {user.is_college_verified ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-700" />
                        Verified Student
                      </span>
                    ) : user.is_email_verified ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                        <Mail className="w-3 h-3 mr-1" />
                        Email Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAuthModal('verify-email', user.college_email)}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 cursor-pointer"
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Verify Email Now
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 truncate">{user.college_email}</p>
                  <p className="text-[11px] text-stone-500 font-medium truncate mt-0.5">
                    {user.display_college}
                  </p>
                </div>
              </div>

              {/* Editable Academic & Bio Details */}
              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="edit-major">
                      Major / Department
                    </label>
                    <input
                      id="edit-major"
                      type="text"
                      value={editMajor}
                      onChange={(e) => setEditMajor(e.target.value)}
                      placeholder="e.g. Computer Science & Eng"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="edit-grad-year">
                      Graduation Year
                    </label>
                    <input
                      id="edit-grad-year"
                      type="number"
                      min={2020}
                      max={2035}
                      value={editGradYear}
                      onChange={(e) => setEditGradYear(e.target.value)}
                      placeholder="e.g. 2027"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="edit-bio">
                    Bio / Student Intro
                  </label>
                  <textarea
                    id="edit-bio"
                    rows={2}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell campus peers what items you frequently share, rent, or need..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </button>

                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center px-4 py-2 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
