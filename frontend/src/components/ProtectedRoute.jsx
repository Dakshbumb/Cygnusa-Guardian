import { Navigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft, Lock, Shield, Eye, UserX } from 'lucide-react';

/**
 * ProtectedRoute - Guards routes based on authentication and role
 * If user is not authenticated, redirects to login
 * If user doesn't have required role, shows access denied
 */
export function ProtectedRoute({ children, requiredRole }) {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');

    // Not authenticated - redirect to login
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Check role if required
    if (requiredRole && userRole !== requiredRole) {
        // Allow admin to access recruiter routes
        if (requiredRole === 'recruiter' && userRole === 'admin') {
            return children;
        }

        // Show access denied page
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-950 via-surface-base to-orange-950 flex items-center justify-center p-4">
                <div className="bg-surface-elevated rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-red-500/20">
                    {/* Icon */}
                    <div className="w-24 h-24 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                        <ShieldOff size={48} className="text-red-400" />
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-display font-bold text-white mb-3">
                        Access Denied
                    </h1>

                    {/* Description */}
                    <p className="text-neutral-400 mb-6">
                        This page requires <span className="text-red-400 font-semibold">{requiredRole}</span> role.
                        <br />
                        You are logged in as <span className="text-blue-400 font-semibold">{userRole}</span>.
                    </p>

                    {/* Why this matters box */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-6 text-left">
                        <p className="font-semibold text-blue-300 mb-3 flex items-center gap-2">
                            <Shield size={16} />
                            Why this matters:
                        </p>
                        <ul className="text-blue-200/80 space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                                <Lock size={12} className="text-blue-400" />
                                Prevents unauthorized data access
                            </li>
                            <li className="flex items-center gap-2">
                                <UserX size={12} className="text-blue-400" />
                                Enforces role boundaries
                            </li>
                            <li className="flex items-center gap-2">
                                <Eye size={12} className="text-blue-400" />
                                Protects candidate privacy
                            </li>
                        </ul>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={() => window.location.href = '/login'}
                        className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-semibold hover:from-primary-500 hover:to-primary-400 transition-all flex items-center justify-center gap-2 w-full"
                    >
                        <ArrowLeft size={18} />
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    // Authorized - render children
    return children;
}

export default ProtectedRoute;
