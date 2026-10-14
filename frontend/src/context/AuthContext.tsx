import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  type StudentProfile,
  getAuthToken,
  removeAuthToken,
  getCurrentStudent,
  logoutStudent,
} from '../services/api'

export type AuthModalView =
  | 'login'
  | 'signup'
  | 'verify-email'
  | 'profile-photo'
  | 'forgot-password'
  | 'profile-view'

interface AuthContextType {
  user: StudentProfile | null
  token: string | null
  isLoading: boolean
  isModalOpen: boolean
  modalView: AuthModalView
  pendingEmail: string
  openAuthModal: (view: AuthModalView, email?: string) => void
  closeAuthModal: () => void
  setUser: (user: StudentProfile | null) => void
  loginSuccess: (user: StudentProfile, token: string) => void
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StudentProfile | null>(null)
  const [token, setToken] = useState<string | null>(getAuthToken())
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [modalView, setModalView] = useState<AuthModalView>('login')
  const [pendingEmail, setPendingEmail] = useState<string>('')

  const openAuthModal = useCallback((view: AuthModalView, email = '') => {
    setModalView(view)
    if (email) {
      setPendingEmail(email)
    }
    setIsModalOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const refreshUser = useCallback(async () => {
    const existingToken = getAuthToken()
    if (!existingToken) {
      setUser(null)
      setToken(null)
      setIsLoading(false)
      return
    }

    try {
      const data = await getCurrentStudent()
      if (!data.user.is_email_verified) {
        // Enforce OTP verification: do not restore sessions for unverified users
        removeAuthToken()
        setUser(null)
        setToken(null)
      } else {
        setUser(data.user)
        setToken(existingToken)
      }
    } catch (err) {
      console.warn('Failed to restore student session:', err)
      removeAuthToken()
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()

    const handleUnauthorized = () => {
      removeAuthToken()
      setUser(null)
      setToken(null)
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [refreshUser])

  const loginSuccess = useCallback((newUser: StudentProfile, newToken: string) => {
    setUser(newUser)
    setToken(newToken)
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await logoutStudent()
    } finally {
      setUser(null)
      setToken(null)
      setIsLoading(false)
      setIsModalOpen(false)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isModalOpen,
        modalView,
        pendingEmail,
        openAuthModal,
        closeAuthModal,
        setUser,
        loginSuccess,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
