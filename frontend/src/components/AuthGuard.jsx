import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true })
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="loading-page">
        <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <span>Loading…</span>
      </div>
    )
  }

  if (!user) return null

  return children
}
