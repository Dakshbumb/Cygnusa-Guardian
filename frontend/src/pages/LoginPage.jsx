import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Shield, Loader, User, Briefcase, UserCircle, AlertCircle } from 'lucide-react';

/**
 * LoginPage - Role-based authentication with demo mode
 * Users can login as Candidate or Recruiter
 */
export function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('candidate');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Redirect if already logged in and check backend health
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userRole = localStorage.getItem('role');

        if (token && userRole) {
            if (userRole === 'recruiter' || userRole === 'admin') {
                navigate('/recruiter/dashboard');
            } else {
                navigate('/resume-analysis');
            }
        }

        // Proactive health check
        const checkHealth = async () => {
            try {
                await api.health();
                console.log('✅ Backend connectivity verified');
            } catch (err) {
                console.warn('⚠️ Backend unreachable or CORS blocked:', err.message);
                if (import.meta.env.PROD) {
                    setError('The backend server is currently unreachable. Please check the API configuration.');
                }
            }
        };
        checkHealth();
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await api.login(email, role);
            const { token, user_id, name, role: userRole } = response.data;

            // Store auth data
            localStorage.setItem('token', token);
            localStorage.setItem('user_id', user_id);
            localStorage.setItem('role', userRole);
            localStorage.setItem('name', name);

            console.log('Auth data stored:', {
                token: !!localStorage.getItem('token'),
                role: localStorage.getItem('role')
            });

            // Redirect based on role
            if (userRole === 'recruiter' || userRole === 'admin') {
                navigate('/recruiter/dashboard');
            } else {
                // Candidates go to resume analysis to start their assessment
                navigate('/resume-analysis');
            }
        } catch (err) {
            console.error('Login failed:', err);
            const serverError = err.response?.data?.detail || err.response?.data?.error;
            setError(serverError || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = (demoEmail, demoRole) => {
        setEmail(demoEmail);
        setRole(demoRole);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-base via-surface-elevated to-surface-base flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Branding */}
                <div className="text-center mb-8">
                    <div className="w-24 h-24 mx-auto mb-4 relative overflow-hidden rounded-2xl shadow-2xl shadow-primary-900/50 border border-primary-500/30">
                        <img
                            src="/logo.jpg"
                            alt="Cygnusa Guardian Logo"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">
                        Cygnusa Guardian
                    </h1>
                    <p className="text-neutral-400 font-medium tracking-wide">
                        Built for the Future of Hiring
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-surface-elevated border border-surface-overlay rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email Input */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="w-full px-4 py-3 bg-surface-base border border-surface-overlay rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Role Selector */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">
                                I am a...
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRole('candidate')}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${role === 'candidate'
                                        ? 'border-primary-500 bg-primary-900/30 text-primary-400'
                                        : 'border-surface-overlay bg-surface-base text-neutral-400 hover:border-neutral-600'
                                        }`}
                                >
                                    <User size={24} />
                                    <span className="font-medium text-sm">Candidate</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('recruiter')}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${role === 'recruiter'
                                        ? 'border-primary-500 bg-primary-900/30 text-primary-400'
                                        : 'border-surface-overlay bg-surface-base text-neutral-400 hover:border-neutral-600'
                                        }`}
                                >
                                    <Briefcase size={24} />
                                    <span className="font-medium text-sm">Recruiter</span>
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !email}
                            className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-semibold hover:from-primary-500 hover:to-primary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader size={18} className="animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Continue'
                            )}
                        </button>
                    </form>

                    {/* Demo Accounts */}
                    <div className="mt-6 pt-6 border-t border-surface-overlay">
                        <p className="text-xs text-neutral-500 text-center mb-3">
                            Quick Demo Access
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleDemoLogin('candidate@demo.com', 'candidate')}
                                className="px-3 py-2 bg-blue-900/20 border border-blue-500/30 rounded-lg text-blue-400 text-xs hover:bg-blue-900/30 transition-colors"
                            >
                                <UserCircle size={14} className="inline mr-1" />
                                Candidate Demo
                            </button>
                            <button
                                onClick={() => handleDemoLogin('recruiter@demo.com', 'recruiter')}
                                className="px-3 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg text-purple-400 text-xs hover:bg-purple-900/30 transition-colors"
                            >
                                <Briefcase size={14} className="inline mr-1" />
                                Recruiter Demo
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-neutral-600 text-xs mt-6">
                    Every decision is explainable. No black boxes.
                </p>
            </div>
        </div>
    );
}

export default LoginPage;
