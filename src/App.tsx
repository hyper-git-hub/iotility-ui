import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import FleetDashboard from './pages/fleetpoint/FleetDashboard'
import LiveTracking from './pages/fleetpoint/LiveTracking'
import FleetsPage from './pages/fleetpoint/fleet/FleetsPage'
import VehiclesPage from './pages/fleetpoint/fleet/VehiclesPage'
import DriversPage from './pages/fleetpoint/fleet/DriversPage'
import DevicesPage from './pages/fleetpoint/fleet/DevicesPage'
import DriverProfilePage from './pages/fleetpoint/fleet/DriverProfilePage'
import PlaceholderPage from './pages/fleetpoint/PlaceholderPage'
import POIPage from './pages/fleetpoint/fleet/POIPage'
import JobsPage from './pages/fleetpoint/operations/JobsPage'
import RoutesPage from './pages/fleetpoint/operations/RoutesPage'
import MaintenancePage from './pages/fleetpoint/operations/MaintenancePage'
import DashCamPage from './pages/fleetpoint/operations/DashCamPage'
import ViolationsPage from './pages/fleetpoint/operations/ViolationsPage'
import GeozonePage from './pages/fleetpoint/operations/GeozonePage'
import DocumentsPage from './pages/fleetpoint/insights/DocumentsPage'
import TripReplayPage from './pages/fleetpoint/operations/TripReplayPage'
import ReportsPage from './pages/fleetpoint/insights/ReportsPage'
import SettingsPage from './pages/fleetpoint/SettingsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/fleetpoint" element={<FleetDashboard />} />
        <Route path="/fleetpoint/live-tracking" element={<LiveTracking />} />
        <Route path="/fleetpoint/fleets" element={<FleetsPage />} />
        <Route path="/fleetpoint/vehicles" element={<VehiclesPage />} />
        <Route path="/fleetpoint/drivers" element={<DriversPage />} />
        <Route path="/fleetpoint/drivers/:id" element={<DriverProfilePage />} />
        <Route path="/fleetpoint/devices" element={<DevicesPage />} />
        <Route path="/fleetpoint/poi" element={<POIPage />} />
        <Route path="/fleetpoint/jobs" element={<JobsPage />} />
        <Route path="/fleetpoint/trip-replay" element={<TripReplayPage />} />
        <Route path="/fleetpoint/routes" element={<RoutesPage />} />
        <Route path="/fleetpoint/dashcam" element={<DashCamPage />} />
        <Route path="/fleetpoint/maintenance" element={<MaintenancePage />} />
        <Route path="/fleetpoint/violations" element={<ViolationsPage />} />
        <Route path="/fleetpoint/geozones" element={<GeozonePage />} />
        <Route path="/fleetpoint/reports" element={<ReportsPage />} />
        <Route path="/fleetpoint/documents" element={<DocumentsPage />} />
        <Route path="/fleetpoint/users" element={<PlaceholderPage />} />
        <Route path="/fleetpoint/settings" element={<SettingsPage />} />
        <Route path="/fleetpoint/*" element={<FleetDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
