import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landingpage from './Pages/Landingpage'
import Dashboard from './Pages/Dashboard'
import Auth from './Pages/Auth'
import { isLoggedIn } from './utils/api'

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/auth" replace />
}
function PublicRoute({ children }) {
  return isLoggedIn() ? <Navigate to="/dashboard" replace /> : children
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