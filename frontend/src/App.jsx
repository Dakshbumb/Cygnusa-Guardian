import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Suspense, lazy } from 'react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageTransition } from './components/PageTransition';
import { Loader2 } from 'lucide-react';

// Lazy load pages for code splitting - faster initial load
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const CandidateFlow = lazy(() => import('./pages/CandidateFlow').then(m => ({ default: m.CandidateFlow })));
const RecruiterDashboard = lazy(() => import('./pages/RecruiterDashboard').then(m => ({ default: m.RecruiterDashboard })));
const ResumeAnalysisPage = lazy(() => import('./pages/ResumeAnalysisPage').then(m => ({ default: m.ResumeAnalysisPage })));
const SharedReportPage = lazy(() => import('./pages/SharedReportPage'));
const LiveMonitorPage = lazy(() => import('./pages/LiveMonitorPage').then(m => ({ default: m.LiveMonitorPage })));
const DashboardMain = lazy(() => import('./pages/DashboardMain').then(m => ({ default: m.DashboardMain })));
const BulkCandidateDetail = lazy(() => import('./pages/BulkCandidateDetail').then(m => ({ default: m.BulkCandidateDetail })));

// Fast loading spinner component
function PageLoader() {
    return (
        <div className="min-h-screen bg-surface-base flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                <span className="text-neutral-400 text-sm font-mono">Loading...</span>
            </div>
        </div>
    );
}

function App() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Suspense fallback={<PageLoader />}>
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

                    {/* Recruiter Dashboard - Main Landing (MUST come before :candidateId route) */}
                    <Route path="/recruiter/dashboard" element={
                        <ProtectedRoute requiredRole="recruiter">
                            <PageTransition>
                                <DashboardMain />
                            </PageTransition>
                        </ProtectedRoute>
                    } />

                    {/* Bulk Imported Candidate - Resume Only View */}
                    <Route path="/recruiter/bulk/:candidateId" element={
                        <ProtectedRoute requiredRole="recruiter">
                            <PageTransition>
                                <BulkCandidateDetail />
                            </PageTransition>
                        </ProtectedRoute>
                    } />

                    {/* Recruiter Dashboard - Individual Candidate View */}
                    <Route path="/recruiter/:candidateId" element={
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
            </Suspense>
        </AnimatePresence>
    );
}

export default App;
