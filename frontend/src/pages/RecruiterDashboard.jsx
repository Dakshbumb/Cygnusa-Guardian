import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, BASE_URL } from '../utils/api';
import { DecisionCard, EvidencePanel } from '../components/DecisionCard';
import { AuditTrail } from '../components/AuditTrail';
import { DecisionTimeline } from '../components/DecisionTimeline';
import { ResumeAuthenticityPanel } from '../components/ResumeAuthenticityPanel';
import { DashboardMain } from './DashboardMain';
import { CandidateDetailTabs } from '../components/dashboard/CandidateDetailTabs';
import { Link } from 'react-router-dom';
import {
    Loader2, ArrowLeft, Download, Share2,
    User, Mail, Briefcase, Calendar,
    Radar, ShieldCheck, Activity, BrainCircuit
} from 'lucide-react';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
} from 'chart.js';
import { Radar as RadarChart } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export function RecruiterDashboard() {
    const { candidateId } = useParams();
    const [candidate, setCandidate] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                if (candidateId) {
                    const [candRes, snapRes] = await Promise.all([
                        api.getCandidate(candidateId),
                        api.getSnapshots(candidateId).catch(() => ({ data: { snapshots: [] } }))
                    ]);
                    setCandidate(candRes.data);
                    setSnapshots(snapRes.data.snapshots || []);
                } else {
                    const response = await api.listCandidates();
                    setCandidates(response.data?.candidates || []);
                }
            } catch (err) {
                console.error('Failed to load data:', err);
                setError(candidateId ? 'Candidate not found or report not yet generated.' : 'Failed to retrieve candidate list.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [candidateId]);

    useEffect(() => {
        if (!candidateId || !candidate || candidate.status !== 'in_progress') return;
        const pollSnapshots = async () => {
            try {
                const snapRes = await api.getSnapshots(candidateId);
                setSnapshots(snapRes.data.snapshots || []);
            } catch (err) { console.error('Failed to poll snapshots:', err); }
        };
        const interval = setInterval(pollSnapshots, 10000);
        return () => clearInterval(interval);
    }, [candidateId, candidate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-2 border-surface-container-high rounded-full"></div>
                        <div className="absolute inset-0 border-2 border-primary rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-primary font-label text-xs uppercase tracking-widest animate-pulse">Retrieving Case File...</p>
                </div>
            </div>
        );
    }

    if (error || (candidateId && !candidate)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-on-surface px-4">
                <div className="text-center max-w-md glass-panel p-8 rounded-2xl border border-tertiary/20">
                    <div className="w-16 h-16 bg-tertiary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-tertiary/20">
                        <User className="w-8 h-8 text-tertiary" />
                    </div>
                    <h2 className="text-xl font-bold text-tertiary mb-2 font-label uppercase tracking-tight">Access Denied / Not Found</h2>
                    <p className="text-on-surface-variant mb-6 text-sm">{error || 'Candidate record not found.'}</p>
                    <Link
                        to="/recruiter/dashboard"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-surface-container text-primary border border-outline-variant/20 rounded-xl font-label uppercase text-[11px] tracking-widest hover:bg-surface-container-high transition-all"
                    >
                        <ArrowLeft size={16} />
                        Back to Command Center
                    </Link>
                </div>
            </div>
        );
    }

    if (!candidateId) {
        return <DashboardMain />;
    }

    const decision = candidate.final_decision;
    const evidence = decision?.evidence_summary;

    if (!decision) {
        return (
            <div className="min-h-screen bg-background text-on-surface flex flex-col">
                {/* Header */}
                <header className="fixed top-0 w-full z-50 bg-[#0A0B0F]/80 backdrop-blur-xl border-b border-outline-variant/10">
                    <div className="flex justify-between items-center px-8 py-4 max-w-[1440px] mx-auto w-full">
                        <Link to="/recruiter/dashboard" className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                            <span className="text-sm font-medium">Back to Dashboard</span>
                        </Link>
                        <div className="text-xl font-bold tracking-tighter text-slate-50 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">shield</span>
                            Cygnusa Guardian
                        </div>
                    </div>
                </header>
                <div className="flex-1 flex items-center justify-center px-4 pt-20">
                    <div className="text-center max-w-md glass-panel p-8 rounded-2xl border border-amber-400/20">
                        <div className="w-16 h-16 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-400/20">
                            <BrainCircuit className="w-8 h-8 text-amber-400" />
                        </div>
                        <h2 className="text-xl font-bold text-amber-400 mb-2 font-label uppercase tracking-tight">Report Pending</h2>
                        <p className="text-on-surface-variant mb-4 text-sm">Assessment not yet completed for this candidate.</p>
                        <div className="bg-surface-container-low rounded-xl p-4 mb-6 border border-outline-variant/10 text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <User size={16} className="text-primary" />
                                <span className="text-white font-medium">{candidate.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                                <Briefcase size={14} />
                                <span>{candidate.job_title}</span>
                            </div>
                            <div className="mt-2 px-2 py-1 rounded bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-label inline-block">
                                Status: {candidate.status?.toUpperCase() || 'PENDING'}
                            </div>
                        </div>
                        <Link
                            to="/recruiter/dashboard"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-surface-container text-primary border border-outline-variant/20 rounded-xl font-label uppercase text-[11px] tracking-widest hover:bg-surface-container-high transition-all"
                        >
                            <ArrowLeft size={16} />
                            Back to Command Center
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const psychScores = evidence?.psychometric?.scores || {};
    const radarData = {
        labels: Object.keys(psychScores).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
        datasets: [{
            label: 'Candidate Score',
            data: Object.values(psychScores),
            backgroundColor: 'rgba(192, 193, 255, 0.12)',
            borderColor: '#c0c1ff',
            borderWidth: 2,
            pointBackgroundColor: '#c0c1ff',
            pointBorderColor: '#0A0B0F',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#c0c1ff',
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    };

    const radarOptions = {
        scales: {
            r: {
                beginAtZero: true,
                max: 10,
                ticks: {
                    stepSize: 2,
                    backdropColor: 'transparent',
                    color: '#908fa0',
                    font: { family: "'Space Grotesk', monospace", size: 10 }
                },
                grid: { color: 'rgba(70, 69, 84, 0.3)' },
                angleLines: { color: 'rgba(70, 69, 84, 0.4)' },
                pointLabels: {
                    font: { family: "'Space Grotesk', monospace", size: 11 },
                    color: '#c7c4d7'
                }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1f1f24',
                titleColor: '#e3e2e8',
                bodyColor: '#e3e2e8',
                borderColor: '#464554',
                borderWidth: 1,
                bodyFont: { family: "'Space Grotesk', monospace" }
            }
        }
    };

    const verdictColor = (() => {
        const v = decision?.verdict?.toUpperCase() || '';
        if (v.includes('NO')) return 'text-tertiary';
        if (v.includes('HIRE')) return 'text-secondary';
        return 'text-amber-400';
    })();

    const verdictBorder = (() => {
        const v = decision?.verdict?.toUpperCase() || '';
        if (v.includes('NO')) return 'border-tertiary/20 bg-tertiary/5';
        if (v.includes('HIRE')) return 'border-secondary/20 bg-secondary/5';
        return 'border-amber-400/20 bg-amber-400/5';
    })();

    return (
        <div className="min-h-screen bg-background text-on-surface font-body">
            {/* Fixed Header */}
            <header className="fixed top-0 w-full z-50 bg-[#0A0B0F]/80 backdrop-blur-xl border-b border-outline-variant/10">
                <div className="flex justify-between items-center px-8 py-4 max-w-[1440px] mx-auto w-full">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/recruiter/dashboard"
                            className="p-2 hover:bg-surface-container-high rounded-lg transition-colors text-on-surface-variant hover:text-white"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
                                <ShieldCheck className="text-primary" size={18} />
                            </div>
                            <div>
                                <h1 className="font-bold text-white text-sm tracking-tight">CANDIDATE_REPORT</h1>
                                <p className="text-[10px] text-primary font-label tracking-wider opacity-80">Ref: {candidateId?.substring(0, 12)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-xl font-bold tracking-tighter text-slate-50 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">shield</span>
                        Cygnusa Guardian
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-3 py-1.5 text-on-surface-variant hover:text-white hover:bg-surface-container-high rounded-lg transition-colors font-label text-[10px] uppercase tracking-wider border border-outline-variant/20">
                            <Share2 size={14} />
                            Share Access
                        </button>
                        <button
                            onClick={() => api.exportReport(candidateId)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary-container text-white rounded-lg transition-all font-label text-[10px] uppercase tracking-wider"
                        >
                            <Download size={14} />
                            Export Case File
                        </button>
                    </div>
                </div>
            </header>

            {/* MetricsTicker strip */}
            <div className="fixed top-[73px] w-full h-8 z-40 bg-surface-container-low border-y border-outline-variant/10 flex items-center overflow-hidden whitespace-nowrap px-6">
                <div className="flex items-center gap-2 text-primary font-label text-[10px] uppercase tracking-widest flex-shrink-0">
                    <span className="material-symbols-outlined text-[14px]">security</span>
                    FORENSIC_REPORT_ACTIVE
                </div>
                <div className="mx-6 h-1 w-1 rounded-full bg-outline-variant flex-shrink-0"></div>
                <div className="font-label text-[10px] uppercase tracking-widest text-slate-500">
                    AES-256 ENCRYPTED • AUDIT TRAIL ACTIVE • EVERY READ IS LOGGED
                </div>
            </div>

            <main className="pt-36 pb-12 px-8 max-w-[1440px] mx-auto">
                {/* Verdict Hero */}
                <div className={`glass-panel rounded-2xl p-8 mb-8 border ${verdictBorder} relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none"></div>
                    <div className="flex items-center justify-between flex-wrap gap-6">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center text-2xl font-bold border-2 border-primary/20 text-primary font-label shadow-lg shadow-primary/10">
                                    {candidate.name?.charAt(0) || 'C'}
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-surface-container-low rounded-full p-1 border border-outline-variant/20">
                                    <Activity size={14} className="text-secondary" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-white tracking-tight mb-2">{candidate.name}</h2>
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-2 text-on-surface-variant">
                                        <Mail size={14} className="text-primary" />
                                        <span className="font-label">{candidate.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-on-surface-variant">
                                        <Briefcase size={14} className="text-primary" />
                                        <span className="font-label">{candidate.job_title}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-on-surface-variant">
                                        <Calendar size={14} className="text-primary" />
                                        <span className="font-label">{new Date(candidate.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className="text-xs font-label text-on-surface-variant uppercase tracking-widest">Final Verdict</span>
                            <span className={`text-3xl font-black font-label tracking-tighter ${verdictColor}`}>
                                {decision?.verdict || 'PENDING'}
                            </span>
                            <span className={`px-4 py-1 rounded text-xs font-bold font-label tracking-wider border ${
                                candidate.status === 'completed'
                                    ? 'bg-secondary/10 text-secondary border-secondary/20'
                                    : 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                            }`}>
                                {candidate.status === 'completed' ? 'EVALUATION_COMPLETE' : candidate.status?.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Decision Timeline */}
                <DecisionTimeline nodes={candidate.decision_nodes} />

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-8">
                        {decision && (
                            <div className="glass-panel rounded-2xl border border-outline-variant/10 overflow-hidden">
                                <DecisionCard
                                    decision={decision}
                                    candidate={candidate}
                                    candidateId={candidateId}
                                    evidence={evidence}
                                />
                            </div>
                        )}
                        {evidence && (
                            <div className="glass-panel rounded-2xl border border-outline-variant/10 overflow-hidden">
                                <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low/50 flex items-center gap-2">
                                    <BrainCircuit size={18} className="text-primary" />
                                    <h3 className="font-bold text-on-surface uppercase tracking-wide text-sm font-label">Cognitive & Technical Analysis</h3>
                                </div>
                                <div className="p-6">
                                    <EvidencePanel evidence={evidence} candidate={candidate} />
                                </div>
                            </div>
                        )}
                        {decision?.audit_trail && (
                            <div className="glass-panel rounded-2xl border border-outline-variant/10 overflow-hidden">
                                <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low/50 flex items-center gap-2">
                                    <Activity size={18} className="text-secondary" />
                                    <h3 className="font-bold text-on-surface uppercase tracking-wide text-sm font-label">System Audit Logs</h3>
                                </div>
                                <AuditTrail auditTrail={decision.audit_trail} />
                            </div>
                        )}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-8">
                        {candidate && (
                            <div className="glass-panel rounded-2xl border border-outline-variant/10 overflow-hidden">
                                <ResumeAuthenticityPanel candidate={candidate} candidateId={candidateId} />
                            </div>
                        )}
                        {snapshots.length > 0 && (
                            <div className="glass-panel rounded-2xl border border-outline-variant/10 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={18} className="text-primary" />
                                        <h3 className="font-bold text-on-surface uppercase tracking-wide text-sm font-label">Surveillance Gallery</h3>
                                    </div>
                                    <span className="text-[10px] font-label text-on-surface-variant">{snapshots.length} Snapshots</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {snapshots.slice(0, 4).map((snap, i) => {
                                        const getImageUrl = (path) => {
                                            if (!path) return '';
                                            if (path.startsWith('http')) return path;
                                            return `${BASE_URL}/${path.startsWith('/') ? path.substring(1) : path}`;
                                        };
                                        return (
                                            <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container-low group">
                                                <img
                                                    src={getImageUrl(snap.snapshot_path)}
                                                    alt={`Snapshot ${i}`}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1.5 flex items-center justify-between">
                                                    <span className="text-[8px] font-label text-slate-300">
                                                        {snap.timestamp ? new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold font-label ${snap.face_detected ? 'bg-secondary/20 text-secondary' : 'bg-tertiary/20 text-tertiary'}`}>
                                                        {snap.face_detected ? 'FACE_MATCH' : 'NO_FACE'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {snapshots.length > 4 && (
                                    <button className="w-full mt-4 py-2 border border-outline-variant/20 rounded-xl text-[10px] font-label text-on-surface-variant hover:text-white hover:bg-surface-container-high transition-all">
                                        VIEW ALL {snapshots.length} EVIDENCE LOGS
                                    </button>
                                )}
                            </div>
                        )}
                        {evidence?.coding?.stress_response && (
                            <div className="glass-panel rounded-2xl border border-outline-variant/10 p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <Activity size={18} className="text-secondary" />
                                    <h3 className="font-bold text-on-surface uppercase tracking-wide text-sm font-label">Behavioral Biometrics</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-label text-on-surface-variant uppercase">Avg Response Depth</span>
                                        <span className={`text-xs font-label font-bold ${evidence.coding.stress_response.pattern === 'rushing' ? 'text-amber-400' : 'text-secondary'}`}>
                                            {evidence.coding.stress_response.avg_time_seconds}s / {evidence.coding.stress_response.pattern?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="w-full bg-surface-container-lowest rounded-full h-1 overflow-hidden">
                                        <div
                                            className={`h-full ${evidence.coding.stress_response.pattern === 'rushing' ? 'bg-amber-400' : 'bg-secondary'}`}
                                            style={{ width: `${Math.min(100, (evidence.coding.stress_response.avg_time_seconds / 600) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-on-surface-variant font-label leading-relaxed mt-2">
                                        {evidence.coding.stress_response.pattern === 'rushing'
                                            ? "SCAN_DETECT: Candidate exhibited high-speed pattern. Possible familiarity or automated assistance."
                                            : "SCAN_DETECT: Normal cognitive response curve detected. Deliberate logic application observed."}
                                    </p>
                                </div>
                            </div>
                        )}
                        {Object.keys(psychScores).length > 0 && (
                            <div className="glass-panel rounded-2xl border border-outline-variant/10 p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <Radar size={18} className="text-secondary" />
                                    <h3 className="font-bold text-on-surface uppercase tracking-wide text-sm font-label">Psychometric Profile</h3>
                                </div>
                                <div className="aspect-square w-full max-w-[280px] mx-auto relative">
                                    <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full"></div>
                                    <RadarChart data={radarData} options={radarOptions} />
                                </div>
                                <div className="mt-6 grid gap-4">
                                    {evidence?.psychometric?.strong_areas?.length > 0 && (
                                        <div className="bg-secondary/5 border border-secondary/10 rounded-xl p-3">
                                            <span className="text-[10px] font-label text-secondary uppercase tracking-widest block mb-2">Detected Strengths</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {evidence.psychometric.strong_areas.map((area, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-secondary/10 text-secondary rounded text-xs font-medium border border-secondary/20">
                                                        {area}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {evidence?.psychometric?.weak_areas?.length > 0 && (
                                        <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-3">
                                            <span className="text-[10px] font-label text-amber-400 uppercase tracking-widest block mb-2">Areas for Development</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {evidence.psychometric.weak_areas.map((area, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-amber-400/10 text-amber-300 rounded text-xs font-medium border border-amber-400/20">
                                                        {area}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Secured Footer */}
                <div className="mt-12 text-center border-t border-outline-variant/10 pt-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-outline-variant/10 text-on-surface-variant text-xs font-label">
                        <ShieldCheck size={12} />
                        <span>SECURE_REPORT_{new Date().getFullYear()} // CYGNUSA_GUARDIAN_FORENSIC_AI</span>
                    </div>
                    <p className="mt-2 text-on-surface-variant/40 text-xs font-label">
                        This report contains confidential assessment data. Access is logged.
                    </p>
                </div>
            </main>
        </div>
    );
}

export default RecruiterDashboard;
