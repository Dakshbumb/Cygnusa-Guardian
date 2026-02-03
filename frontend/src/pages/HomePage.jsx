import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import {
    Shield, Users, FileSearch, Code, Brain, Eye,
    ArrowRight, Plus, Loader2, CheckCircle, XCircle,
    AlertTriangle, Sparkles, ChevronRight
} from 'lucide-react';
import { ForensicLoader } from '../components/ForensicLoader';
import { Header } from '../components/Header';

/**
 * HomePage - Landing page and candidate list
 */
export function HomePage() {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);

    useEffect(() => {
        loadCandidates();
    }, []);

    const loadCandidates = async () => {
        try {
            const response = await api.listCandidates();
            setCandidates(response.data.candidates || []);
        } catch (err) {
            console.error('Failed to load candidates:', err);
        } finally {
            setLoading(false);
        }
    };

    const seedDemoData = async () => {
        setSeeding(true);
        try {
            await api.seedDemo();
            await loadCandidates();
        } catch (err) {
            console.error('Failed to seed demo data:', err);
        } finally {
            setSeeding(false);
        }
    };

    const getOutcomeIcon = (decision) => {
        if (!decision) return <AlertTriangle className="text-gray-400" size={18} />;
        switch (decision.outcome) {
            case 'HIRE':
                return <CheckCircle className="text-green-500" size={18} />;
            case 'CONDITIONAL':
                return <AlertTriangle className="text-amber-500" size={18} />;
            default:
                return <XCircle className="text-red-500" size={18} />;
        }
    };

    return (
        <div className="min-h-screen bg-surface-base text-neutral-50 font-sans selection:bg-primary-500 selection:text-white flex flex-col">
            <Header />

            {/* Live Metrics Ticker */}
            <div className="bg-surface-elevated border-b border-surface-overlay overflow-hidden py-2">
                <div className="flex animate-marquee whitespace-nowrap gap-12 text-xs font-mono text-primary-300 opacity-80">
                    {[
                        "SYSTEM: ONLINE",
                        "INTEGRITY: 99.8%",
                        "CANDIDATES_QUEUED: 14",
                        "LAST_DECISION: HIRE (CONFIDENCE 94%)",
                        "ENCRYPTION: AES-256",
                        "AUDIT_LOG: ACTIVE",
                        "AI_MODEL: CYGNUSA-V4",
                        "LATENCY: 42ms"
                    ].map((item, i) => (
                        <span key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                            {item}
                        </span>
                    ))}
                </div>
            </div>

            {/* Hero Section */}
            <header className="relative pt-20 pb-32 overflow-hidden">
                {/* Background Grid */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `linear-gradient(to right, rgba(99, 102, 241, 0.05) 1px, transparent 1px),
                                        linear-gradient(to bottom, rgba(99, 102, 241, 0.05) 1px, transparent 1px)`,
                        backgroundSize: '40px 40px'
                    }} />
                    <div className="absolute inset-0 bg-gradient-to-b from-surface-base via-transparent to-surface-base" />
                </div>

                <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-900/50 border border-primary-700/50 text-primary-300 text-xs font-mono mb-6">
                            <Shield size={12} />
                            <span>FORENSIC HIRING PROTOCOL v2.0</span>
                        </div>

                        <h1 className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-primary-100 to-primary-300 mb-6 leading-tight font-display">
                            Hiring Decisions,<br />
                            <span className="text-white">Mathematically Proven.</span>
                        </h1>

                        <p className="text-xl text-neutral-400 mb-8 max-w-xl leading-relaxed">
                            Stop guessing. Cygnusa Guardian creates a <span className="text-primary-400 font-semibold">glass-box forensic record</span> of every candidate's skills, integrity, and potential.
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => navigate('/resume-analysis')}
                                className="flex items-center gap-3 px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-primary-900/50 border border-primary-500 hover:scale-[1.02] group"
                            >
                                <FileSearch size={20} className="group-hover:animate-pulse" />
                                <span>Evaluate Candidate</span>
                            </button>

                            <button
                                onClick={seedDemoData}
                                disabled={seeding}
                                className="flex items-center gap-3 px-8 py-4 bg-surface-elevated hover:bg-surface-overlay text-white rounded-lg font-semibold transition-all border border-surface-overlay hover:border-primary-500/50 disabled:opacity-50"
                            >
                                {seeding ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>INITIALIZING...</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus size={20} />
                                        <span>Load Demo Data</span>
                                    </>
                                )}
                            </button>

                            {candidates.length > 0 && (
                                <a
                                    href="#candidates"
                                    className="flex items-center gap-3 px-8 py-4 bg-surface-elevated hover:bg-surface-overlay text-white rounded-lg font-semibold transition-all border border-surface-overlay hover:border-primary-500/50"
                                >
                                    <Users size={20} />
                                    <span>View Evidence ({candidates.length})</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Evidence Flow Visualization (Right Side) */}
                    <div className="relative hidden lg:block">
                        <div className="absolute -inset-4 bg-primary-500/10 blur-3xl rounded-full opacity-50" />

                        <div className="relative bg-surface-elevated border border-surface-overlay rounded-xl p-6 shadow-2xl backdrop-blur-sm animate-float">
                            <div className="flex items-center justify-between border-b border-surface-overlay pb-4 mb-4">
                                <span className="text-xs font-mono text-neutral-500">LIVESTREAM_MONITOR_01</span>
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-danger-500" />
                                    <div className="w-2 h-2 rounded-full bg-warning-500" />
                                    <div className="w-2 h-2 rounded-full bg-success-500" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { label: 'RESUME_ANALYSIS', score: 92, color: 'text-success-400', bar: 'bg-success-500' },
                                    { label: 'CODE_QUALITY', score: 87, color: 'text-primary-400', bar: 'bg-primary-500' },
                                    { label: 'INTEGRITY_INDEX', score: 100, color: 'text-success-400', bar: 'bg-success-500' }
                                ].map((metric, i) => (
                                    <div key={i} className="group">
                                        <div className="flex justify-between text-xs font-mono mb-1">
                                            <span className="text-neutral-400">{metric.label}</span>
                                            <span className={metric.color}>{metric.score}%</span>
                                        </div>
                                        <div className="h-1.5 bg-surface-base rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${metric.bar} transition-all duration-1000 ease-out`}
                                                style={{ width: `${metric.score}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-4 border-t border-surface-overlay">
                                <div className="flex items-center gap-3 text-sm text-neutral-300">
                                    <div className="w-8 h-8 rounded bg-primary-900/50 flex items-center justify-center border border-primary-800">
                                        <Sparkles size={14} className="text-primary-400" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-mono text-primary-400">AI_DECISION_ENGINE</div>
                                        <div>Recommended for HIRE</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Badges */}
                        <div className="absolute -right-6 top-10 bg-surface-elevated border border-surface-overlay p-3 rounded-lg shadow-xl animate-pulse-slow">
                            <div className="flex items-center gap-2 text-xs font-mono text-danger-400">
                                <AlertTriangle size={14} />
                                <span>Eye Movement Detected</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Candidates Section */}
            <section id="candidates" className="max-w-7xl mx-auto px-6 pt-16 pb-32">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400 flex items-center gap-3 font-display">
                        <Users className="text-primary-500" />
                        Active Investigations
                    </h2>


                    {loading && (
                        <div className="flex items-center gap-2">
                            <ForensicLoader size={24} text="FETCHING_RECORDS..." />
                        </div>
                    )}
                </div>

                {candidates.length === 0 ? (
                    <div className="bg-surface-elevated border border-dashed border-neutral-700 rounded-xl p-16 text-center">
                        <div className="w-16 h-16 bg-surface-base rounded-full flex items-center justify-center mx-auto mb-6 border border-surface-overlay">
                            <FileSearch className="w-8 h-8 text-neutral-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No Active Records</h3>
                        <p className="text-neutral-500 mb-8 max-w-md mx-auto">
                            The investigation queue is empty. Initialize demo data to see the forensic capabilities in action.
                        </p>
                        <button
                            onClick={seedDemoData}
                            className="text-primary-400 hover:text-primary-300 font-mono text-sm underline underline-offset-4"
                        >
                            [EXECUTE_DEMO_SEED_PROTOCOL]
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <div className="grid grid-cols-12 px-6 py-2 text-xs font-mono text-neutral-500 uppercase tracking-wider">
                            <div className="col-span-5">Subject Identity</div>
                            <div className="col-span-3">Integrity Status</div>
                            <div className="col-span-3">AI Verdict</div>
                            <div className="col-span-1"></div>
                        </div>

                        {candidates.map((candidate) => (
                            <Link
                                key={candidate.id}
                                to={`/recruiter/${candidate.id}`}
                                className="grid grid-cols-12 items-center bg-surface-elevated border border-surface-overlay rounded-lg p-4 hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-900/20 transition-all group"
                            >
                                <div className="col-span-5 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-surface-base rounded border border-surface-overlay flex items-center justify-center text-neutral-300 font-bold font-mono group-hover:bg-primary-900/30 group-hover:text-primary-300 group-hover:border-primary-800 transition-colors">
                                        {candidate.name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <h3 className="text-neutral-100 font-semibold group-hover:text-primary-400 transition-colors cursor-pointer">
                                            {candidate.name}
                                        </h3>
                                        <div className="text-xs text-neutral-500 font-mono">
                                            ID: {candidate.id.slice(0, 8)} • {candidate.job_title}
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <div className={`inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-full text-xs font-medium border ${candidate.status === 'completed'
                                        ? 'bg-success-500/10 text-success-400 border-success-500/20'
                                        : candidate.status === 'in_progress'
                                            ? 'bg-secondary-500/10 text-secondary-400 border-secondary-500/20'
                                            : 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${candidate.status === 'in_progress' ? 'animate-pulse bg-secondary-500' : candidate.status === 'completed' ? 'bg-success-500' : 'bg-neutral-500'}`} />
                                        {candidate.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    {candidate.has_decision && (
                                        <div className="flex items-center gap-2">
                                            {getOutcomeIcon({ outcome: candidate.final_decision?.outcome || 'NO_HIRE' })}
                                            <span className={`text-sm font-medium ${candidate.final_decision?.outcome === 'HIRE' ? 'text-success-400' :
                                                candidate.final_decision?.outcome === 'NO_HIRE' ? 'text-danger-400' :
                                                    'text-secondary-400'
                                                }`}>
                                                {candidate.final_decision?.outcome}
                                                {candidate.final_decision?.confidence && (
                                                    <span className="text-xs text-neutral-500 ml-2 font-mono opacity-70">
                                                        {Math.round(parseFloat(candidate.final_decision.confidence === 'high' ? 0.9 : 0.7) * 100)}%
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-1 text-right">
                                    <ChevronRight className="text-neutral-600 group-hover:text-primary-400 transition-colors ml-auto" size={18} />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* How It Works (Footer area) */}
            <div className="border-t border-surface-overlay bg-surface-base/50">
                <div className="max-w-7xl mx-auto px-6 py-12">
                    <p className="text-center text-xs font-mono text-neutral-600">
                        CYGNUSA GUARDIAN SYSTEM • ENCRYPTED CONNECTION • v2.0.4-stable
                    </p>
                </div>
            </div>
        </div>
    );
}

export default HomePage;
