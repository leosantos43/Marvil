import { Navigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"

export default function ProtectedRoute({ children, adminOnly = false }: any) {
  const { session, profile, loading } = useAuthStore()

  if (loading) {
    return <div className="p-6 text-white">Carregando...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && profile?.role !== "admin") {
    return (
      <div className="p-6 text-white">
        Você não tem permissão para acessar esta página.
      </div>
    )
  }

  return children
}
