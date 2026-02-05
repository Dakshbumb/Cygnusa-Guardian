import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, BASE_URL } from '../utils/api';
import { Header } from '../components/Header';
import { DecisionCard, EvidencePanel } from '../components/DecisionCard';
import { AuditTrail } from '../components/AuditTrail';
import { DecisionTimeline } from '../components/DecisionTimeline';
import { ResumeAuthenticityPanel } from '../components/ResumeAuthenticityPanel';
import { KeystrokeDynamicsPanel } from '../components/KeystrokeDynamicsPanel';
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

// Register Chart.js components
ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

/**
 * RecruiterDashboard - Full candidate report view
 * Shows decision, evidence breakdown, and audit trail
 */
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
                    setCandidates(response.data.candidates || []);
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

    // Polling for real-time snapshots if candidate is in_progress
    useEffect(() => {
        if (!candidateId || !candidate || candidate.status !== 'in_progress') return;

        const pollSnapshots = async () => {
            try {
                const snapRes = await api.getSnapshots(candidateId);
                setSnapshots(snapRes.data.snapshots || []);
            } catch (err) {
                console.error('Failed to poll snapshots:', err);
            }
        };

        const interval = setInterval(pollSnapshots, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [candidateId, candidate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-base text-neutral-50">
                <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 border-4 border-primary-900 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-primary-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-primary-400 font-mono animate-pulse">RETRIEVING_CASE_FILE...</p>
                </div>
            </div>
        );
    }

    if (error || (candidateId && !candidate)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-base text-neutral-50 px-4">
                <div className="text-center max-w-md bg-surface-elevated p-8 rounded-xl border border-danger-900/50 shadow-2xl">
                    <div className="w-16 h-16 bg-danger-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-danger-500/30">
                        <User className="w-8 h-8 text-danger-500" />
                    </div>
                    <h2 className="text-xl font-bold text-danger-400 mb-2 font-mono uppercase tracking-tight">ACCESS_DENIED / NOT_FOUND</h2>
                    <p className="text-neutral-400 mb-6 font-mono text-xs">{error || 'Candidate record not found.'}</p>
                    <Link
                        to="/recruiter/dashboard"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-surface-base text-primary-400 border border-primary-500/30 rounded font-mono uppercase text-[11px] tracking-widest hover:bg-primary-900/20 transition-all"
                    >
                        <ArrowLeft size={16} />
                        BACK_TO_COMMAND_CENTER
                    </Link>
                </div>
            </div>
        );
    }

    // List View Rendering
    if (!candidateId) {
        return (
            <div className="min-h-screen bg-surface-base text-neutral-50 flex flex-col">
                <Header />
                <main className="max-w-7xl mx-auto px-6 py-12 w-full">
                    <div className="mb-10 flex items-end justify-between">
                        <div>
                            <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">Candidate Roster</h1>
                            <p className="text-neutral-400 font-mono text-xs uppercase tracking-widest">
                                {candidates.length} IDENTIFIED_SUBJECTS // SYSTEM_STATUS: READY
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1.5 rounded bg-success-900/20 border border-success-500/30 text-success-400 text-[10px] font-mono animate-pulse uppercase tracking-wider">
                                Surveillance_Active
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {candidates.length === 0 ? (
                            <div className="bg-surface-elevated border border-surface-overlay/50 rounded-xl p-20 text-center">
                                <Activity className="w-12 h-12 text-neutral-600 mx-auto mb-4 opacity-20" />
                                <p className="text-neutral-500 font-mono text-sm uppercase tracking-widest">No candidates recorded in archive</p>
                            </div>
                        ) : (
                            candidates.map((c) => (
                                <Link
                                    key={c.id}
                                    to={`/recruiter/${c.id}`}
                                    className="group bg-surface-elevated hover:bg-surface-overlay border border-surface-overlay hover:border-primary-500/30 p-5 rounded-xl transition-all duration-300 flex items-center justify-between shadow-lg hover:shadow-primary-900/10"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 bg-surface-base rounded-full flex items-center justify-center font-bold text-primary-400 border border-surface-overlay group-hover:border-primary-500/50 transition-colors">
                                            {c.name?.charAt(0) || 'C'}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-primary-400 transition-colors">{c.name}</h3>
                                            <div className="flex items-center gap-4 mt-1">
                                                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{c.job_title}</span>
                                                <span className="text-[10px] font-mono text-neutral-500">•</span>
                                                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Added: {new Date(c.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right hidden sm:block">
                                            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Status</div>
                                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono border ${c.status === 'completed'
                                                ? 'bg-success-900/20 text-success-400 border-success-500/30'
                                                : 'bg-warning-900/20 text-warning-400 border-warning-500/30'
                                                }`}>
                                                {c.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-surface-base border border-surface-overlay group-hover:border-primary-500/30 text-neutral-500 group-hover:text-primary-400 transition-all">
                                            <ShieldCheck size={18} />
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </main>
            </div>
        );
    }

    const decision = candidate.final_decision;
    const evidence = decision?.evidence_summary;

    // Show helpful message for candidates without a generated report
    if (!decision) {
        return (
            <div className="min-h-screen bg-surface-base text-neutral-50 flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="text-center max-w-md bg-surface-elevated p-8 rounded-xl border border-warning-900/50 shadow-2xl">
                        <div className="w-16 h-16 bg-warning-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-warning-500/30">
                            <BrainCircuit className="w-8 h-8 text-warning-500" />
                        </div>
                        <h2 className="text-xl font-bold text-warning-400 mb-2 font-mono uppercase tracking-tight">REPORT_PENDING</h2>
                        <p className="text-neutral-400 mb-4 font-mono text-xs">Assessment not yet completed for this candidate.</p>
                        <div className="bg-surface-base rounded-lg p-4 mb-6 border border-surface-overlay">
                            <div className="flex items-center gap-3 mb-2">
                                <User size={16} className="text-primary-400" />
                                <span className="text-white font-medium">{candidate.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-neutral-400">
                                <Briefcase size={14} />
                                <span>{candidate.job_title}</span>
                            </div>
                            <div className="mt-2 px-2 py-1 rounded bg-warning-900/20 border border-warning-500/30 text-warning-400 text-[10px] font-mono inline-block">
                                STATUS: {candidate.status?.toUpperCase() || 'PENDING'}
                            </div>
                        </div>
                        <Link
                            to="/recruiter/dashboard"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-surface-base text-primary-400 border border-primary-500/30 rounded font-mono uppercase text-[11px] tracking-widest hover:bg-primary-900/20 transition-all"
                        >
                            <ArrowLeft size={16} />
                            BACK_TO_COMMAND_CENTER
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Prepare radar chart data for psychometric scores
    const psychScores = evidence?.psychometric?.scores || {};
    const radarData = {
        labels: Object.keys(psychScores).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
        datasets: [{
            label: 'Candidate Score',
            data: Object.values(psychScores),
            backgroundColor: 'rgba(6, 182, 212, 0.2)', // primary-500 with opacity
            borderColor: '#06b6d4', // primary-500
            borderWidth: 2,
            pointBackgroundColor: '#06b6d4',
            pointBorderColor: '#0f172a',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#06b6d4',
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
                    color: '#64748b', // neutral-500
                    font: { family: "'JetBrains Mono', monospace", size: 10 }
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.1)'
                },
                angleLines: {
                    color: 'rgba(148, 163, 184, 0.2)'
                },
                pointLabels: {
                    font: { family: "'JetBrains Mono', monospace", size: 11 },
                    color: '#94a3b8' // neutral-400
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#e2e8f0',
                bodyColor: '#e2e8f0',
                borderColor: '#334155',
                borderWidth: 1,
                bodyFont: { family: "'JetBrains Mono', monospace" }
            }
        }
    };

    return (
        <div className="min-h-screen bg-surface-base text-neutral-50 font-sans flex flex-col">
            <Header />

            {/* Secondary Header - Report Actions */}
            <header className="bg-surface-elevated/50 border-b border-surface-overlay backdrop-blur-sm sticky top-[73px] z-30">
                <div className="max-w-7xl mx-auto px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                to="/recruiter/dashboard"
                                className="p-2 hover:bg-surface-overlay rounded-lg transition-colors text-neutral-400 hover:text-white"
                                title="Back to Dashboard"
                            >
                                <ArrowLeft size={20} />
                            </Link>

                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-primary-900/20 border border-primary-500/30 rounded-lg flex items-center justify-center relative overflow-hidden group">
                                    <ShieldCheck className="text-primary-500" size={18} />
                                </div>
                                <div>
                                    <h1 className="font-bold text-neutral-100 text-sm tracking-tight leading-none mb-1">
                                        {candidateId ? 'CANDIDATE_REPORT' : 'RECRUITER_INTELLIGENCE_ROSTER'}
                                    </h1>
                                    <p className="text-[10px] text-primary-400 font-mono tracking-wider uppercase opacity-80 leading-none">
                                        {candidateId ? `Ref: ${candidateId.substring(0, 12)}` : 'SECURE_NODE: ACTIVE'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {candidateId && (
                            <div className="flex items-center gap-3">
                                <button className="flex items-center gap-2 px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-surface-overlay rounded-lg transition-colors font-mono text-[10px] uppercase tracking-wider border border-surface-overlay/50">
                                    <Share2 size={14} />
                                    <span>Share_Access</span>
                                </button>
                                <button
                                    onClick={() => api.exportReport(candidateId)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-all shadow-lg shadow-primary-900/30 font-mono text-[10px] uppercase tracking-wider border border-primary-500"
                                >
                                    <Download size={14} />
                                    <span>Export_Case_File</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Candidate Info Bar - "Subject Profile" */}
                <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6 mb-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-primary-900/10 to-transparent pointer-events-none"></div>
                    <div className="flex items-center justify-between flex-wrap gap-6 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <div className="w-20 h-20 bg-surface-base rounded-full flex items-center justify-center text-2xl font-bold border-2 border-primary-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] text-primary-100">
                                    {candidate.name?.charAt(0) || 'C'}
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-surface-base rounded-full p-1 border border-surface-overlay">
                                    <Activity size={16} className="text-success-400" />
                                </div>
                            </div>

                            <div>
                                <h2 className="text-3xl font-bold text-white tracking-tight mb-2">{candidate.name}</h2>
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-2 text-neutral-400">
                                        <Mail size={14} className="text-primary-500" />
                                        <span className="font-mono">{candidate.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-neutral-400">
                                        <Briefcase size={14} className="text-primary-500" />
                                        <span className="font-mono">{candidate.job_title}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-neutral-400">
                                        <Calendar size={14} className="text-primary-500" />
                                        <span className="font-mono">{new Date(candidate.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Assessment Status</span>
                            <span className={`px-4 py-1.5 rounded text-sm font-bold font-mono tracking-wider border ${candidate.status === 'completed'
                                ? 'bg-success-900/20 text-success-400 border-success-500/30'
                                : 'bg-warning-900/20 text-warning-400 border-warning-500/30'
                                }`}>
                                {candidate.status === 'completed' ? 'EVALUATION_COMPLETE' : candidate.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Decision Node Timeline (Forensic Scrubber) */}
                <DecisionTimeline nodes={candidate.decision_nodes} />

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Decision & Evidence */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Decision Card */}
                        {decision && (
                            <div className="transform transition-all duration-300 hover:translate-y-[-2px]">
                                <DecisionCard
                                    decision={decision}
                                    candidate={candidate}
                                    candidateId={candidateId}
                                    evidence={evidence}
                                />
                            </div>
                        )}

                        {/* Evidence Grid */}
                        {evidence && (
                            <div className="bg-surface-elevated rounded-xl border border-surface-overlay overflow-hidden">
                                <div className="px-6 py-4 border-b border-surface-overlay bg-surface-base/50 flex items-center gap-2">
                                    <BrainCircuit size={18} className="text-primary-400" />
                                    <h3 className="font-bold text-neutral-200 uppercase tracking-wide text-sm font-mono">
                                        Cognitive & Technical Analysis
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <EvidencePanel evidence={evidence} candidate={candidate} />
                                </div>
                            </div>
                        )}

                        {/* Audit Trail */}
                        {decision?.audit_trail && (
                            <div className="bg-surface-elevated rounded-xl border border-surface-overlay overflow-hidden">
                                <div className="px-6 py-4 border-b border-surface-overlay bg-surface-base/50 flex items-center gap-2">
                                    <Activity size={18} className="text-secondary-400" />
                                    <h3 className="font-bold text-neutral-200 uppercase tracking-wide text-sm font-mono">
                                        System_Audit_Logs
                                    </h3>
                                </div>
                                <div className="p-0">
                                    <AuditTrail auditTrail={decision.audit_trail} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Authenticity, Psychometrics & sidebar */}
                    <div className="space-y-8">
                        {/* Resume Authenticity Panel */}
                        {candidate && (
                            <ResumeAuthenticityPanel
                                candidate={candidate}
                                candidateId={candidateId}
                            />
                        )}

                        {/* Keystroke DNA Biometrics */}
                        {candidate && (
                            <KeystrokeDynamicsPanel
                                candidate={candidate}
                            />
                        )}

                        {/* Visual Evidence (Strategic Enhancement) */}
                        {snapshots.length > 0 && (
                            <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6 shadow-lg">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={18} className="text-primary-400" />
                                        <h3 className="font-bold text-neutral-200 uppercase tracking-wide text-sm font-mono">
                                            Surveillance_Gallery
                                        </h3>
                                    </div>
                                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{snapshots.length} Snapshots</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {snapshots.slice(0, 4).map((snap, i) => {
                                        const getImageUrl = (path) => {
                                            if (!path) return '';
                                            if (path.startsWith('http')) return path;
                                            return `${BASE_URL}/${path.startsWith('/') ? path.substring(1) : path}`;
                                        };

                                        return (
                                            <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-surface-overlay bg-surface-base group">
                                                <img
                                                    src={getImageUrl(snap.snapshot_path)}
                                                    alt={`Proctoring Snapshot ${i}`}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1.5 flex items-center justify-between">
                                                    <span className="text-[8px] font-mono text-neutral-300">
                                                        {snap.timestamp ? new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded-[2px] text-[7px] font-bold font-mono ${snap.face_detected ? 'bg-success-500/20 text-success-400' : 'bg-danger-500/20 text-danger-400'
                                                        }`}>
                                                        {snap.face_detected ? 'FACE_MATCH' : 'NO_FACE'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {snapshots.length > 4 && (
                                    <button className="w-full mt-4 py-2 border border-surface-overlay rounded-lg text-[10px] font-mono text-neutral-500 hover:text-white hover:bg-surface-overlay transition-all">
                                        VIEW_ALL_EVIDENCE_LOGS
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Behavioral Biometrics / Stress Analytics */}
                        {evidence?.coding?.stress_response && (
                            <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6 shadow-lg">
                                <div className="flex items-center gap-2 mb-6">
                                    <Activity size={18} className="text-secondary-400" />
                                    <h3 className="font-bold text-neutral-200 uppercase tracking-wide text-sm font-mono">
                                        Behavioral_Biometrics
                                    </h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-mono text-neutral-500 uppercase">Avg Response Depth</span>
                                        <span className={`text-xs font-mono font-bold ${evidence.coding.stress_response.pattern === 'rushing' ? 'text-warning-400' : 'text-success-400'
                                            }`}>
                                            {evidence.coding.stress_response.avg_time_seconds}s / {evidence.coding.stress_response.pattern.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="w-full bg-surface-base rounded-full h-1 overflow-hidden">
                                        <div className={`h-full ${evidence.coding.stress_response.pattern === 'rushing' ? 'bg-warning-500' : 'bg-success-500'
                                            }`} style={{ width: `${Math.min(100, (evidence.coding.stress_response.avg_time_seconds / 600) * 100)}%` }}></div>
                                    </div>
                                    <p className="text-[10px] text-neutral-500 font-mono leading-relaxed mt-2">
                                        {evidence.coding.stress_response.pattern === 'rushing'
                                            ? "SCAN_DETECT: Candidate exhibited high-speed pattern. Possible familiarity or automated assistance."
                                            : "SCAN_DETECT: Normal cognitive response curve detected. Deliberate logic application observed."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Psychometric Radar Chart */}
                        {Object.keys(psychScores).length > 0 && (
                            <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6 shadow-lg">
                                <div className="flex items-center gap-2 mb-6">
                                    <Radar size={18} className="text-secondary-400" />
                                    <h3 className="font-bold text-neutral-200 uppercase tracking-wide text-sm font-mono">
                                        Psychometric_Profile
                                    </h3>
                                </div>

                                <div className="aspect-square w-full max-w-[300px] mx-auto relative">
                                    {/* Background glow for chart */}
                                    <div className="absolute inset-0 bg-primary-500/5 blur-2xl rounded-full"></div>
                                    <RadarChart data={radarData} options={radarOptions} />
                                </div>

                                <div className="mt-8 grid gap-4">
                                    {evidence?.psychometric?.strong_areas?.length > 0 && (
                                        <div className="bg-success-900/10 border border-success-500/20 rounded-lg p-3">
                                            <span className="text-[10px] font-mono text-success-400 uppercase tracking-widest block mb-2">Detected Strengths</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {evidence.psychometric.strong_areas.map((area, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-success-500/20 text-success-300 rounded text-xs font-medium border border-success-500/30">
                                                        {area}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {evidence?.psychometric?.weak_areas?.length > 0 && (
                                        <div className="bg-warning-900/10 border border-warning-500/20 rounded-lg p-3">
                                            <span className="text-[10px] font-mono text-warning-400 uppercase tracking-widest block mb-2">Areas for Development</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {evidence.psychometric.weak_areas.map((area, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-warning-500/20 text-warning-300 rounded text-xs font-medium border border-warning-500/30">
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

                {/* Footer */}
                <div className="mt-12 text-center border-t border-surface-overlay pt-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-elevated border border-surface-overlay text-neutral-500 text-xs font-mono">
                        <ShieldCheck size={12} />
                        <span>SECURE_REPORT_{new Date().getFullYear()} // CYGNUSA_GUARDIAN_AGI</span>
                    </div>
                    <p className="mt-2 text-neutral-600 text-xs font-mono">
                        This report contains confidential assessment data. Access is logged.
                    </p>
                </div>
            </main>
        </div >
    );
}

export default RecruiterDashboard;
