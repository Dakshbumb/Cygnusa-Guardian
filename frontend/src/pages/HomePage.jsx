import { useNavigate } from 'react-router-dom';

export function HomePage() {
    const navigate = useNavigate();

    return (
        <div className="bg-surface-dim text-on-surface font-body min-h-screen">
            {/* TopNavBar */}
            <nav className="fixed top-0 w-full z-50 bg-[#0A0B0F]/70 backdrop-blur-xl shadow-2xl shadow-black/50 border-b border-outline-variant/10">
                <div className="flex justify-between items-center px-8 py-4 max-w-[1440px] mx-auto w-full">
                    <div className="text-xl font-bold tracking-tighter text-slate-50 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">shield</span>
                        Cygnusa Guardian
                    </div>
                    <div className="hidden md:flex gap-8 text-sm tracking-tight">
                        <a className="text-primary font-semibold border-b border-primary transition-colors duration-300" href="#platform">Platform</a>
                        <a className="text-slate-400 hover:text-slate-100 transition-colors duration-300" href="#features">Features</a>
                        <a className="text-slate-400 hover:text-slate-100 transition-colors duration-300" href="#how-it-works">How It Works</a>
                        <a className="text-slate-400 hover:text-slate-100 transition-colors duration-300" href="#security">Security</a>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/login?role=candidate')}
                            className="text-slate-400 hover:text-slate-100 text-sm active:scale-95 transition-all"
                        >
                            Candidate Portal
                        </button>
                        <button
                            onClick={() => navigate('/login?role=recruiter')}
                            className="bg-primary-container text-on-primary-container px-4 py-2 font-semibold text-sm active:scale-95 transition-all rounded-lg"
                        >
                            Recruiter Portal
                        </button>
                    </div>
                </div>
            </nav>

            <main className="pt-20 pb-24">
                {/* Hero Section */}
                <section id="platform" className="relative max-w-7xl mx-auto px-6 py-28 text-center overflow-hidden">
                    <div className="absolute inset-0 hero-glow -z-10"></div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/30 mb-8">
                        <span className="material-symbols-outlined text-primary text-sm">shield</span>
                        <span className="font-label text-[10px] tracking-[0.2em] uppercase text-primary">FORENSIC HIRING PROTOCOL v2.0</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-[1.1]">
                        Hiring Decisions,<br/>
                        <span className="bg-gradient-to-r from-primary via-primary-container to-secondary bg-clip-text text-transparent">
                            Mathematically Proven.
                        </span>
                    </h1>
                    <p className="max-w-2xl mx-auto text-on-surface-variant text-lg md:text-xl mb-12">
                        Cygnusa Guardian creates a glass-box forensic record of every candidate's skills, integrity, and cognitive architecture. No black boxes. No guesswork.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
                        <button
                            onClick={() => navigate('/login?role=recruiter')}
                            className="bg-primary-container text-on-primary-container px-8 py-4 font-bold text-base hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20 rounded-xl"
                        >
                            Start Hiring with Guardian
                        </button>
                        <button
                            onClick={() => navigate('/login?role=candidate')}
                            className="text-primary border border-outline-variant/30 px-8 py-4 font-bold text-base hover:bg-white/5 active:scale-95 transition-all rounded-xl"
                        >
                            Take an Assessment
                        </button>
                    </div>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                        <div className="flex items-center gap-2 text-slate-500 font-label text-[10px] tracking-widest uppercase">
                            <span className="material-symbols-outlined text-secondary">lock</span>
                            AES-256 Encrypted
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 font-label text-[10px] tracking-widest uppercase">
                            <span className="material-symbols-outlined text-secondary">psychology</span>
                            XAI Decision Engine
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 font-label text-[10px] tracking-widest uppercase">
                            <span className="material-symbols-outlined text-secondary">videocam</span>
                            Real-time Proctoring
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section id="features" className="max-w-7xl mx-auto px-6 py-20">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The Forensic Hiring Stack</h2>
                        <p className="text-on-surface-variant max-w-xl mx-auto">Every layer of the assessment is explainable, auditable, and defensible.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-panel p-8 border border-outline-variant/10 group hover:border-primary/30 transition-all duration-500 rounded-2xl">
                            <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                                <span className="material-symbols-outlined text-primary">description</span>
                            </div>
                            <h3 className="text-xl font-bold mb-3">Resume Forensics</h3>
                            <p className="text-on-surface-variant text-sm leading-relaxed">
                                AI-powered claim probing that cross-references resume statements with behavioral evidence. Detects credential inflation and skill misrepresentation.
                            </p>
                        </div>
                        <div className="glass-panel p-8 border border-outline-variant/10 group hover:border-primary/30 transition-all duration-500 rounded-2xl">
                            <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                                <span className="material-symbols-outlined text-primary">code</span>
                            </div>
                            <h3 className="text-xl font-bold mb-3">Live Code Execution</h3>
                            <p className="text-on-surface-variant text-sm leading-relaxed">
                                Sandboxed code assessment with real test-case execution, keystroke biometrics, and anti-cheat monitoring. Every submission is forensically timestamped.
                            </p>
                        </div>
                        <div className="glass-panel p-8 border border-outline-variant/10 group hover:border-primary/30 transition-all duration-500 rounded-2xl">
                            <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                                <span className="material-symbols-outlined text-primary">account_tree</span>
                            </div>
                            <h3 className="text-xl font-bold mb-3">XAI Verdicts</h3>
                            <p className="text-on-surface-variant text-sm leading-relaxed">
                                Every hiring verdict comes with a full decision tree, evidentiary mapping, and counterfactual analysis. Know exactly why each decision was made.
                            </p>
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-20">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">How It Works</h2>
                        <p className="text-on-surface-variant max-w-xl mx-auto">Two portals. One forensic-grade process.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Recruiter Flow */}
                        <div className="glass-panel p-10 border border-outline-variant/10 rounded-2xl relative overflow-hidden group hover:border-primary/20 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-[60px] pointer-events-none"></div>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                    <span className="material-symbols-outlined text-primary">work</span>
                                </div>
                                <h3 className="text-lg font-bold">For Recruiters</h3>
                            </div>
                            <div className="space-y-5">
                                {[
                                    { icon: 'upload_file', title: 'Upload Resumes', desc: 'Bulk or single resume analysis with AI-powered claim probing' },
                                    { icon: 'assessment', title: 'Launch Assessments', desc: 'Multi-stage evaluation: coding, MCQ, reasoning, psychometric' },
                                    { icon: 'monitoring', title: 'Live Proctoring', desc: 'Real-time integrity monitoring with webcam and behavioral signals' },
                                    { icon: 'fact_check', title: 'XAI Reports', desc: 'Glass-box verdict with full forensic audit trail and counterfactuals' },
                                ].map((step, i) => (
                                    <div key={i} className="flex items-start gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/20 mt-0.5">
                                            <span className="material-symbols-outlined text-primary text-sm">{step.icon}</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-white">{step.title}</p>
                                            <p className="text-on-surface-variant text-xs mt-0.5">{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => navigate('/login?role=recruiter')}
                                className="mt-8 w-full bg-primary-container text-on-primary-container py-3 rounded-xl font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all"
                            >
                                Access Recruiter Dashboard
                            </button>
                        </div>

                        {/* Candidate Flow */}
                        <div className="glass-panel p-10 border border-outline-variant/10 rounded-2xl relative overflow-hidden group hover:border-secondary/20 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/5 rounded-full blur-[60px] pointer-events-none"></div>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center border border-secondary/20">
                                    <span className="material-symbols-outlined text-secondary">person</span>
                                </div>
                                <h3 className="text-lg font-bold">For Candidates</h3>
                            </div>
                            <div className="space-y-5">
                                {[
                                    { icon: 'login', title: 'Sign In', desc: 'Create your account and verify your identity securely' },
                                    { icon: 'description', title: 'Submit Resume', desc: 'Upload and let our AI validate your professional claims' },
                                    { icon: 'terminal', title: 'Complete Assessment', desc: 'Coding challenges, MCQ, reasoning, and psychometric evaluation' },
                                    { icon: 'shield', title: 'Transparent Results', desc: 'See exactly how your performance was evaluated — no hidden criteria' },
                                ].map((step, i) => (
                                    <div key={i} className="flex items-start gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/20 mt-0.5">
                                            <span className="material-symbols-outlined text-secondary text-sm">{step.icon}</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-white">{step.title}</p>
                                            <p className="text-on-surface-variant text-xs mt-0.5">{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => navigate('/login?role=candidate')}
                                className="mt-8 w-full border border-secondary/30 text-secondary py-3 rounded-xl font-bold text-sm hover:bg-secondary/5 active:scale-[0.98] transition-all"
                            >
                                Start Assessment
                            </button>
                        </div>
                    </div>
                </section>

                {/* Security Section */}
                <section id="security" className="max-w-7xl mx-auto px-6 py-20">
                    <div className="glass-panel p-12 md:p-16 border border-outline-variant/10 rounded-2xl text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none"></div>
                        <span className="material-symbols-outlined text-5xl text-primary mb-6 block">verified_user</span>
                        <h2 className="text-3xl font-bold tracking-tight mb-4">Enterprise-Grade Security</h2>
                        <p className="text-on-surface-variant max-w-2xl mx-auto mb-10">
                            Every assessment session runs in an encrypted, audited forensic environment. Data is never shared, always encrypted at rest and in transit, and every decision is fully traceable.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
                            {[
                                { icon: 'lock', label: 'AES-256 Encryption' },
                                { icon: 'fingerprint', label: 'Keystroke DNA' },
                                { icon: 'visibility', label: 'Full Audit Trail' },
                                { icon: 'gavel', label: 'GDPR Compliant' },
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 p-4">
                                    <span className="material-symbols-outlined text-secondary text-2xl">{item.icon}</span>
                                    <span className="text-[10px] font-label uppercase tracking-widest text-slate-400">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-[#0A0B0F] border-t border-[#464554]/10 w-full py-12">
                <div className="flex flex-col md:flex-row justify-between items-center px-12 max-w-[1440px] mx-auto w-full gap-8">
                    <div className="flex flex-col gap-2 text-center md:text-left">
                        <span className="font-black text-slate-300 tracking-tighter text-lg">CYGNUSA GUARDIAN</span>
                        <span className="text-xs text-slate-500">© 2025 Cygnusa Guardian. Forensic Intelligence Secured.</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-8 text-xs text-slate-500">
                        <a className="hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Privacy Policy</a>
                        <a className="hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Terms of Service</a>
                        <a className="hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Security Disclosure</a>
                        <a className="hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Contact Support</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
