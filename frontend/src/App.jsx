import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { HomePage } from './pages/HomePage';
import { CandidateFlow } from './pages/CandidateFlow';
import { RecruiterDashboard } from './pages/RecruiterDashboard';
import { ResumeAnalysisPage } from './pages/ResumeAnalysisPage';
import SharedReportPage from './pages/SharedReportPage';
import { LiveMonitorPage } from './pages/LiveMonitorPage';
import { LoginPage } from './pages/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageTransition } from './components/PageTransition';


function App() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                {/* Login Page (Public) */}
                <Route path="/login" element={
                    <PageTransition>
                        <LoginPage />
                    </PageTransition>
                } />

                {/* Home / Landing (Public) */}
                <Route path="/" element={
                    <PageTransition>
                        <HomePage />
                    </PageTransition>
                } />

                {/* Resume Gatekeeper Flow (Any logged-in user) */}
                <Route path="/resume-analysis" element={
                    <ProtectedRoute>
                        <PageTransition>
                            <ResumeAnalysisPage />
                        </PageTransition>
                    </ProtectedRoute>
                } />

                {/* Candidate Assessment Flow (Public - magic link access) */}
                <Route path="/candidate/:candidateId" element={
                    <PageTransition>
                        <CandidateFlow />
                    </PageTransition>
                } />

                {/* Recruiter Dashboard (Recruiter Only) */}
                <Route path="/recruiter/:candidateId" element={
                    <ProtectedRoute requiredRole="recruiter">
                        <PageTransition>
                            <RecruiterDashboard />
                        </PageTransition>
                    </ProtectedRoute>
                } />

                {/* Recruiter Dashboard - Main (Recruiter Only) */}
                <Route path="/recruiter/dashboard" element={
                    <ProtectedRoute requiredRole="recruiter">
                        <PageTransition>
                            <RecruiterDashboard />
                        </PageTransition>
                    </ProtectedRoute>
                } />

                {/* Live Monitor Dashboard (Recruiter Only) */}
                <Route path="/monitor" element={
                    <ProtectedRoute requiredRole="recruiter">
                        <PageTransition>
                            <LiveMonitorPage />
                        </PageTransition>
                    </ProtectedRoute>
                } />

                {/* Shared Report (Public - no auth needed) */}
                <Route path="/shared/:shareToken" element={
                    <PageTransition>
                        <SharedReportPage />
                    </PageTransition>
                } />

                {/* Fallback - redirect to home */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AnimatePresence>
    );
}

export default App;
