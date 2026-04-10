import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';

export function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialRole = searchParams.get('role') === 'candidate' ? 'candidate' : 'recruiter';
    const [role, setRole] = useState(initialRole);
    const [tab, setTab] = useState('signin');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (tab === 'signin') {
                // Pass role so backend can validate role match (required field)
                const result = await api.login(email, password, role);
                const { token, role: userRole, user_id, name: userName } = result.data;
                // Persist session
                localStorage.setItem('token', token);
                localStorage.setItem('role', userRole);
                localStorage.setItem('user_id', user_id);
                localStorage.setItem('name', userName);
                if (userRole === 'recruiter') {
                    navigate('/recruiter/dashboard');
                } else {
                    navigate('/resume-analysis');
                }
            } else {
                // Register: api.register(name, email, password, role)
                await api.register(name || email.split('@')[0], email, password, role);
                setTab('signin');
                setName('');
                setError('Account created! Please sign in.');
            }
        } catch (err) {
            const detail = err.response?.data?.detail || err.message || 'Authentication failed. Please try again.';
            setError(detail);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface-dim text-on-surface font-body min-h-screen flex overflow-hidden">
            {/* LEFT PANEL (40%) */}
            <aside className="hidden lg:flex w-[40%] flex-col justify-center items-center p-16 relative overflow-hidden bg-surface-container-lowest">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-32 h-32 rounded-full bg-surface-container flex items-center justify-center glow-halo mb-12 border border-outline-variant/20">
                        <span className="material-symbols-outlined text-primary text-6xl">shield</span>
                    </div>
                    <h1 className="text-4xl font-headline font-bold text-white tracking-tight leading-tight mb-4">
                        Every hiring decision<br/>deserves an explanation.
                    </h1>
                    <p className="text-primary font-label uppercase tracking-widest text-sm opacity-80 mb-12">
                        Glass-Box Hiring Intelligence
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="text-on-surface-variant text-xs font-label uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Back to Home
                    </button>
                </div>
            </aside>

            {/* RIGHT PANEL (60%) */}
            <main className="w-full lg:w-[60%] bg-surface flex flex-col items-center justify-center p-8 lg:p-24 overflow-y-auto">
                <div className="w-full max-w-md flex flex-col">
                    {/* Header */}
                    <div className="flex flex-col items-center mb-12">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="material-symbols-outlined text-primary text-3xl">security</span>
                            <span className="text-white font-headline font-bold text-2xl tracking-tighter">Cygnusa Guardian</span>
                        </div>
                        {/* Tab Switcher */}
                        <div className="inline-flex p-1 bg-surface-container-low rounded-xl border border-outline-variant/10">
                            <button
                                onClick={() => setTab('signin')}
                                className={`px-8 py-2.5 rounded-lg font-headline font-semibold text-sm transition-all duration-300 ${
                                    tab === 'signin'
                                        ? 'bg-primary-container text-on-primary-container'
                                        : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => setTab('register')}
                                className={`px-8 py-2.5 rounded-lg font-headline font-medium text-sm transition-colors ${
                                    tab === 'register'
                                        ? 'bg-primary-container text-on-primary-container'
                                        : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                Create Account
                            </button>
                        </div>
                    </div>

                    {/* Error/Info */}
                    {error && (
                        <div className={`mb-6 p-3 rounded-lg text-sm font-label text-center ${
                            error.includes('created') ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                        }`}>
                            {error}
                        </div>
                    )}

                    {/* Auth Form */}
                    <form className="space-y-8" onSubmit={handleSubmit}>
                        {/* Role Selector */}
                        <div className="space-y-4">
                            <label className="text-xs font-label uppercase tracking-widest text-on-surface-variant">I am a...</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    onClick={() => setRole('candidate')}
                                    className={`p-4 rounded-xl border flex flex-col items-center gap-3 cursor-pointer transition-colors group ${
                                        role === 'candidate'
                                            ? 'bg-surface-container border-2 border-primary/40 ring-1 ring-primary/20'
                                            : 'bg-surface-container-low border-outline-variant/20 hover:bg-surface-container'
                                    }`}
                                >
                                    <span className={`material-symbols-outlined transition-colors ${role === 'candidate' ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`}>person</span>
                                    <span className={`text-sm font-medium ${role === 'candidate' ? 'text-white font-bold' : 'text-on-surface-variant'}`}>Candidate</span>
                                </div>
                                <div
                                    onClick={() => setRole('recruiter')}
                                    className={`p-4 rounded-xl border flex flex-col items-center gap-3 cursor-pointer relative overflow-hidden transition-colors ${
                                        role === 'recruiter'
                                            ? 'bg-surface-container border-2 border-primary/40 ring-1 ring-primary/20'
                                            : 'bg-surface-container-low border-outline-variant/20 hover:bg-surface-container'
                                    }`}
                                >
                                    {role === 'recruiter' && <div className="absolute inset-0 bg-primary/5"></div>}
                                    <span className={`material-symbols-outlined ${role === 'recruiter' ? 'text-primary' : 'text-on-surface-variant'}`}>work</span>
                                    <span className={`text-sm font-medium ${role === 'recruiter' ? 'text-white font-bold' : 'text-on-surface-variant'}`}>Recruiter</span>
                                </div>
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="space-y-5">
                            {/* Name field – only for registration */}
                            {tab === 'register' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-label uppercase tracking-widest text-on-surface-variant px-1" htmlFor="name">Full Name</label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Your full name"
                                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-4 text-white placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary/50 transition-all font-body"
                                        required
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-xs font-label uppercase tracking-widest text-on-surface-variant px-1" htmlFor="email">Email Address</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-4 text-white placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary/50 transition-all font-body"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between px-1">
                                    <label className="text-xs font-label uppercase tracking-widest text-on-surface-variant" htmlFor="password">Password</label>
                                    <a className="text-[10px] uppercase font-label text-primary hover:underline transition-all" href="#">Forgot?</a>
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-4 text-white placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary/50 transition-all font-body pr-12"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="pt-4 space-y-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary-container text-on-primary-container py-4 rounded-xl font-headline font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60"
                            >
                                <span>{loading ? 'Authenticating...' : tab === 'signin' ? 'Sign In' : 'Create Account'}</span>
                                <span className="material-symbols-outlined text-lg">{tab === 'signin' ? 'login' : 'person_add'}</span>
                            </button>
                            {tab === 'signin' && (
                                <button
                                    type="button"
                                    onClick={() => setTab('register')}
                                    className="w-full border border-outline-variant/30 text-on-surface py-4 rounded-xl font-headline font-medium hover:bg-surface-container-low transition-colors"
                                >
                                    Create Account
                                </button>
                            )}
                        </div>
                    </form>

                    {/* Footer Meta */}
                    <div className="mt-12 text-center">
                        <p className="text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant/50 flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[12px]">verified_user</span>
                            Secured with AES-256 encryption. Every session is audited.
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="fixed bottom-0 w-full flex justify-between items-center px-8 py-6 pointer-events-none bg-transparent">
                <div className="font-label text-[10px] uppercase tracking-widest text-white/30">
                    © 2025 Cygnusa Guardian. Encrypted Forensic Environment.
                </div>
                <div className="hidden md:flex gap-6 pointer-events-auto">
                    <a className="font-label text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors duration-300" href="#">Privacy Protocol</a>
                    <a className="font-label text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors duration-300" href="#">Security Audit</a>
                    <a className="font-label text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors duration-300" href="#">Terms of Service</a>
                </div>
            </footer>
        </div>
    );
}
