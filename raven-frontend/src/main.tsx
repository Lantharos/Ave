import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import Home from './pages/home/Home.tsx'
import Login from './pages/login/Login.tsx'
import Registration from './pages/registration/Registration.tsx'
import './styles.css'
import {MekProvider} from "./util/MekContext.tsx";
import Dashboard from "./pages/dashboard/Dashboard.tsx";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <MekProvider>
          <Router>
              <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Registration />} />
                  <Route path="/dashboard" element={<Dashboard />} />
              </Routes>
          </Router>
      </MekProvider>
  </StrictMode>,
)

export const Endpoint = "http://localhost:3000"