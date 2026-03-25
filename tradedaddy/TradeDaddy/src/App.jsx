import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landingpage from './Pages/Landingpage'
import Dashboard from './Pages/Dashboard'
import Auth from './Pages/Auth'
import { auth } from './utils/api'

/* Redirect to /auth if not logged in */
function PrivateRoute({ children }) {
  return auth.isLoggedIn() ? children : <Navigate to="/auth" replace />
}

/* Redirect to /dashboard if already logged in */
function PublicRoute({ children }) {
  return auth.isLoggedIn() ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Landingpage />} />
        <Route path="/auth"      element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}