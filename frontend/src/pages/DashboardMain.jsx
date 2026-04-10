import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export function DashboardMain() {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('All Candidates');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.listCandidates().catch(() => ({ data: { candidates: [] } })),
            api.getDashboardAnalytics().catch(() => null),
        ]).then(([candsRes, statsRes]) => {
            // Backend returns { total, candidates: [...] }
            const candList = candsRes?.data?.candidates ?? candsRes?.data ?? [];
            setCandidates(Array.isArray(candList) ? candList : []);
            // Backend returns { success, metrics: { total_candidates, selected, rejected, ... } }
            setAnalytics(statsRes?.data ?? null);
            setLoading(false);
        });
    }, []);

    const handleLogout = () => {
        api.logout();
    };

    const filteredCandidates = candidates.filter(c => {
        const matchesSearch = !searchQuery ||
            c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase());
        // Backend uses 'outcome' field (HIRE / NO_HIRE / PENDING)
        const matchesStatus = statusFilter === 'all' ||
            c.outcome?.toLowerCase().replace('_', '') === statusFilter.toLowerCase().replace('_', '');
        return matchesSearch && matchesStatus;
    });

    // Analytics shape: { metrics: { total_candidates, selected: {count}, rejected: {count}, avg_score } }
    const metrics = analytics?.metrics ?? {};
    const total = metrics.total_candidates ?? candidates.length;
    const hired = metrics.selected?.count ?? candidates.filter(c => c.outcome === 'HIRE').length;
    const rejected = metrics.rejected?.count ?? candidates.filter(c => c.outcome === 'NO_HIRE').length;
    const avgScore = metrics.avg_score ?? (candidates.length > 0
        ? Math.round(candidates.reduce((a, c) => a + (c.overall_score || 0), 0) / candidates.length)
        : 0);
    const hireRate = total > 0 ? Math.round((hired / total) * 100) : 0;
    const rejectRate = total > 0 ? Math.round((rejected / total) * 100) : 0;

    const getVerdictChip = (outcome) => {
        if (!outcome || outcome === 'PENDING') return <span className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-amber-400/10 text-amber-400 border border-amber-400/20">PENDING</span>;
        const v = outcome.toUpperCase();
        if (v === 'NO_HIRE') return <span className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-tertiary/10 text-tertiary border border-tertiary/20">NO_HIRE</span>;
        if (v === 'CONDITIONAL') return <span className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">CONDITIONAL</span>;
        if (v === 'HIRE') return <span className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-secondary/10 text-secondary border border-secondary/20">HIRE</span>;
        return <span className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-surface-container-high text-slate-400">{outcome}</span>;
    };

    const getIntegrityChip = (score) => {
        if (score >= 80) return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-tight bg-secondary/10 text-secondary border border-secondary/20">HIGH</span>;
        if (score >= 50) return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-tight bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">MEDIUM</span>;
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-tight bg-tertiary/10 text-tertiary border border-tertiary/20">LOW</span>;
    };



    return (
        <div className="bg-background text-on-background font-body min-h-screen">
            {/* TopNavBar */}
            <header className="fixed top-0 w-full z-50 bg-[#0A0B0F]/70 backdrop-blur-xl shadow-2xl shadow-black/50">
                <div className="flex justify-between items-center px-8 py-4 max-w-[1440px] mx-auto w-full">
                    <div className="text-xl font-bold tracking-tighter text-slate-50 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">shield</span>
                        Cygnusa Guardian
                    </div>
                    <nav className="hidden md:flex items-center gap-8 text-sm tracking-tight">
                        <a className="text-slate-400 hover:text-slate-100 transition-colors duration-300" href="#">Platform</a>
                        <a className="text-slate-400 hover:text-slate-100 transition-colors duration-300" href="#">Intelligence</a>
                        <a className="text-slate-400 hover:text-slate-100 transition-colors duration-300" href="#">Network</a>
                        <a className="text-slate-400 hover:text-slate-100 transition-colors duration-300" href="#">About</a>
                    </nav>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-400 font-label hidden md:block">
                            Welcome, <span className="text-primary font-medium">{localStorage.getItem('name') || 'Recruiter'}</span>
                        </span>
                        <button
                            onClick={handleLogout}
                            className="bg-white/5 hover:bg-white/10 text-slate-100 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
                        >
                            Logout
                        </button>
                        <button className="bg-primary-container text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95">
                            Bulk Import
                        </button>
                    </div>
                </div>
            </header>

            {/* MetricsTicker */}
            <div className="fixed top-[72px] w-full h-8 z-40 bg-[#1a1b20] border-y border-[#464554]/20 flex items-center overflow-hidden whitespace-nowrap px-4">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-secondary flex-shrink-0">
                    <span className="material-symbols-outlined text-[14px]">analytics</span>
                    RECRUITER_DASHBOARD_ACTIVE
                </div>
                <div className="mx-8 h-1 w-1 rounded-full bg-outline-variant flex-shrink-0"></div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500 flex-shrink-0">SYSTEM_STATUS: NOMINAL</div>
                <div className="mx-8 h-1 w-1 rounded-full bg-outline-variant flex-shrink-0"></div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">LIVE_INTELLIGENCE_STREAMING...</div>
            </div>

            <main className="pt-32 pb-12 px-8 max-w-[1440px] mx-auto space-y-8 relative">
                <div className="fixed top-1/4 right-0 w-[500px] h-[500px] bg-primary opacity-[0.03] blur-[120px] pointer-events-none -z-10"></div>

                {/* Dashboard Header */}
                <section className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight text-white font-headline">Command Center</h1>
                            <p className="text-slate-400 mt-1">Forensic candidate analysis and recruitment intelligence</p>
                        </div>
                        <div className="flex gap-2 p-1 bg-surface-container-low rounded-xl">
                            <button className="px-4 py-2 text-sm font-medium bg-primary-container text-white rounded-lg">Overview</button>
                            <button className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Reports</button>
                            <button className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Settings</button>
                        </div>
                    </div>
                    {/* Job Role Tabs */}
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 border-b border-outline-variant/10">
                        {tabs.map(t => (
                            <button
                                key={t}
                                onClick={() => setActiveTab(t)}
                                className={`whitespace-nowrap px-4 py-2 text-sm transition-colors ${
                                    activeTab === t
                                        ? 'font-semibold text-primary border-b-2 border-primary'
                                        : 'font-medium text-slate-400 hover:text-white'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Analytics Cards */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:bg-surface-container-high transition-all duration-300">
                        <div className="glow-overlay absolute inset-0"></div>
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase font-label">Total Candidates</span>
                            <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">groups</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold font-label text-white">{total}</span>
                            <span className="text-[10px] text-slate-500 font-label">active pipeline</span>
                        </div>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:bg-surface-container-high transition-all duration-300 border-t border-secondary/10">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase font-label">Selected</span>
                            <span className="material-symbols-outlined text-secondary">check_circle</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold font-label text-white">{hired}</span>
                            <span className="text-sm font-bold text-secondary font-label">{hireRate}%</span>
                        </div>
                        <div className="w-full bg-surface-container-lowest h-1.5 mt-4 rounded-full overflow-hidden">
                            <div className="bg-secondary h-full transition-all duration-700" style={{ width: `${hireRate}%` }}></div>
                        </div>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:bg-surface-container-high transition-all duration-300 border-t border-tertiary/10">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase font-label">Rejected</span>
                            <span className="material-symbols-outlined text-tertiary">cancel</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold font-label text-white">{rejected}</span>
                            <span className="text-sm font-bold text-tertiary font-label">{rejectRate}%</span>
                        </div>
                        <div className="w-full bg-surface-container-lowest h-1.5 mt-4 rounded-full overflow-hidden">
                            <div className="bg-tertiary h-full transition-all duration-700" style={{ width: `${rejectRate}%` }}></div>
                        </div>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:bg-surface-container-high transition-all duration-300 border-t border-primary/20">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-slate-400 text-xs font-bold tracking-widest uppercase font-label">Avg Resume Score</span>
                            <span className="material-symbols-outlined text-primary">psychology</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold font-label text-white">{avgScore}%</span>
                            <span className="text-[10px] text-primary/80 font-label">TOP 10%</span>
                        </div>
                        <div className="mt-4 flex gap-1">
                            {[1,2,3,4].map(i => (
                                <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= Math.round(avgScore / 25) ? 'bg-primary' : 'bg-surface-container-lowest'}`}></div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Charts Row */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Donut */}
                    <div className="lg:col-span-1 glass-panel p-6 rounded-2xl space-y-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 font-label flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                            Decision Distribution
                        </h3>
                        <div className="relative w-48 h-48 mx-auto">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#1f1f24" strokeWidth="3"></circle>
                                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#4edea3" strokeDasharray={`${hireRate}, 100`} strokeWidth="3"></circle>
                                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#ffb2b7" strokeDasharray={`${rejectRate}, 100`} strokeDashoffset={`-${hireRate}`} strokeWidth="3"></circle>
                                <circle cx="18" cy="18" fill="transparent" r="15.9" stroke="#ffca28" strokeDasharray={`${100 - hireRate - rejectRate}, 100`} strokeDashoffset={`-${hireRate + rejectRate}`} strokeWidth="3"></circle>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold font-label">{total}</span>
                                <span className="text-[10px] text-slate-500 uppercase">Total</span>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2 text-slate-300"><span className="w-2 h-2 rounded-full bg-secondary"></span> Selected</div>
                                <span className="font-label text-secondary">{hireRate}%</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2 text-slate-300"><span className="w-2 h-2 rounded-full bg-tertiary"></span> Rejected</div>
                                <span className="font-label text-tertiary">{rejectRate}%</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2 text-slate-300"><span className="w-2 h-2 rounded-full bg-[#ffca28]"></span> Pending</div>
                                <span className="font-label text-[#ffca28]">{100 - hireRate - rejectRate}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 font-label">Candidates by Role</h3>
                            <div className="flex items-center gap-4 text-[10px] font-label uppercase">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-primary-container rounded-sm"></span> Selected</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-outline-variant rounded-sm"></span> Pending</span>
                            </div>
                        </div>
                        <div className="h-64 flex items-end gap-10 px-4">
                            {[
                                { label: 'Frontend', sel: 60, pend: 20 },
                                { label: 'Backend', sel: 45, pend: 40 },
                                { label: 'Data Sci', sel: 30, pend: 15 },
                                { label: 'DevOps', sel: 10, pend: 30 },
                            ].map(bar => (
                                <div key={bar.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                                    <div className="w-full flex flex-col items-center justify-end h-full">
                                        <div className="w-full bg-outline-variant/30 rounded-t-sm group-hover:bg-outline-variant/50 transition-colors" style={{ height: `${bar.pend}%` }}></div>
                                        <div className="w-full bg-primary-container rounded-sm shadow-lg shadow-primary/20" style={{ height: `${bar.sel}%` }}></div>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-label">{bar.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Filter Bar */}
                <section className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 relative w-full">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-surface-container-low border-none rounded-lg pl-10 text-sm focus:ring-1 focus:ring-primary/40 placeholder:text-slate-600 py-2"
                            placeholder="Search forensic records..."
                            type="text"
                        />
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-surface-container-low border-none rounded-lg text-sm text-slate-300 focus:ring-1 focus:ring-primary/40 min-w-[140px] py-2 px-3"
                        >
                            <option value="all">All Status</option>
                            <option value="auto_hire">Hired</option>
                            <option value="conditional">Conditional</option>
                            <option value="no_hire">Rejected</option>
                        </select>
                        <button className="bg-surface-container-high p-2 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">filter_list</span>
                        </button>
                    </div>
                </section>

                {/* Candidate Table */}
                <section className="overflow-hidden glass-panel rounded-2xl border-t border-outline-variant/10">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-surface-container-low/50 border-b border-outline-variant/10">
                                    <th className="p-4 text-[10px] uppercase tracking-widest text-slate-500 font-label">Candidate</th>
                                    <th className="p-4 text-[10px] uppercase tracking-widest text-slate-500 font-label">Role</th>
                                    <th className="p-4 text-[10px] uppercase tracking-widest text-slate-500 font-label">Resume Score</th>
                                    <th className="p-4 text-[10px] uppercase tracking-widest text-slate-500 font-label">Integrity</th>
                                    <th className="p-4 text-[10px] uppercase tracking-widest text-slate-500 font-label">Verdict</th>
                                    <th className="p-4 text-[10px] uppercase tracking-widest text-slate-500 font-label">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/5">
                                {loading ? (
                                    <tr><td colSpan="6" className="p-8 text-center text-slate-500 font-label text-xs uppercase tracking-widest">Loading forensic records...</td></tr>
                                ) : filteredCandidates.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-16 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <span className="material-symbols-outlined text-5xl text-slate-600">manage_search</span>
                                                <p className="text-slate-400 font-label text-xs uppercase tracking-widest">No candidates found</p>
                                                <p className="text-slate-500 text-xs">Upload resumes or create assessments to get started</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredCandidates.map((c) => (
                                    <tr key={c.id} className="hover:bg-primary/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center border border-outline-variant/20">
                                                    <span className="text-primary font-bold font-label text-sm">{c.name?.charAt(0) || '?'}</span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-white">{c.name}</div>
                                                    <div className="text-[10px] text-slate-500 font-label">ID: {c.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {/* job_title from the backend summary */}
                                        <td className="p-4 text-sm text-slate-300">{c.job_title || '—'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold font-label text-primary">{Math.round(c.overall_score || 0)}%</span>
                                                <div className="w-20 bg-surface-container-lowest h-1 rounded-full">
                                                    <div className="bg-primary h-full rounded-full" style={{ width: `${c.overall_score || 0}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">{getIntegrityChip(c.integrity_score ?? 75)}</td>
                                        {/* outcome from backend (HIRE / NO_HIRE / PENDING / CONDITIONAL) */}
                                        <td className="p-4">{getVerdictChip(c.outcome)}</td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => navigate(`/recruiter/${c.id}`)}
                                                className="text-primary hover:bg-primary/10 px-3 py-1 rounded text-xs font-semibold transition-colors"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 flex justify-between items-center bg-surface-container-low/30 text-[10px] uppercase font-bold tracking-widest text-slate-500 font-label">
                        <div>Showing {displayCandidates.length} of {total} candidates</div>
                        <div className="flex gap-2">
                            <button className="p-2 hover:bg-surface-container-high rounded transition-colors opacity-30" disabled>
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <button className="p-2 hover:bg-surface-container-high rounded transition-colors">
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="w-full py-12 border-t border-[#464554]/10 bg-[#0A0B0F]">
                <div className="flex flex-col md:flex-row justify-between items-center px-12 max-w-[1440px] mx-auto w-full gap-8">
                    <div className="flex flex-col items-center md:items-start gap-4">
                        <div className="font-black text-slate-300 text-lg uppercase tracking-tighter">CYGNUSA GUARDIAN</div>
                        <p className="text-xs text-slate-500">© 2024 CYGNUSA GUARDIAN. POWERED BY EXPLAINABLE AI.</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-500">
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
