import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, BASE_URL } from '../utils/api';
import { DecisionCard, EvidencePanel } from '../components/DecisionCard';
import { AuditTrail } from '../components/AuditTrail';
import { DecisionTimeline } from '../components/DecisionTimeline';
import { ResumeAuthenticityPanel } from '../components/ResumeAuthenticityPanel';
import { DashboardMain } from './DashboardMain';
import {
    Chart as ChartJS, RadialLinearScale, PointElement,
    LineElement, Filler, Tooltip, Legend
} from 'chart.js';
import { Radar as RadarChart } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const TABS = ['Evidence Trail', 'XAI Decision Tree', 'Integrity Log'];

export function RecruiterDashboard() {
    const { candidateId } = useParams();
    const [candidate, setCandidate] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

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
                }
            } catch (err) {
                console.error('Failed to load data:', err);
                setError('Candidate not found or report not yet generated.');
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
            } catch {}
        };
        const interval = setInterval(pollSnapshots, 10000);
        return () => clearInterval(interval);
    }, [candidateId, candidate]);

    if (!candidateId) return <DashboardMain />;

    // ── Loading ──
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0d0e12] flex items-center justify-center">
                <div className="flex flex-col items-center gap-5">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-2 border-[#ba9eff]/20 rounded-full animate-ping" />
                        <div className="w-16 h-16 border-2 border-[#ba9eff] border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-[#ba9eff] text-xs font-label uppercase tracking-widest animate-pulse">Retrieving Case File...</p>
                </div>
            </div>
        );
    }

    // ── Error / not found ──
    if (error || !candidate) {
        return (
            <div className="min-h-screen bg-[#0d0e12] flex items-center justify-center px-4">
                <div className="text-center max-w-md bg-[#121318] border border-[#ff6e84]/20 rounded-2xl p-10">
                    <span className="material-symbols-outlined text-5xl text-[#ff6e84] mb-4 block">error</span>
                    <h2 className="text-xl font-bold text-white mb-2">Access Denied / Not Found</h2>
                    <p className="text-[#abaab0] text-sm mb-6">{error || 'Candidate record not found.'}</p>
                    <Link to="/recruiter/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e1f25] text-[#ba9eff] border border-[#47474c]/30 rounded-xl text-xs font-semibold hover:border-[#ba9eff]/50 transition-all">
                        <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // ── No decision yet ──
    if (!candidate.final_decision) {
        return (
            <div className="min-h-screen bg-[#0d0e12] text-[#f2f0f6]">
                <header className="bg-[#0d0e12]/80 border-b border-[#47474c]/20 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
                    <Link to="/recruiter/dashboard" className="flex items-center gap-2 text-[#abaab0] hover:text-white transition-colors text-sm">
                        <span className="material-symbols-outlined text-lg">arrow_back</span> Back
                    </Link>
                    <div className="flex items-center gap-2 font-bold">
                        <span className="material-symbols-outlined text-[#ba9eff]">shield</span>
                        Cygnusa Guardian
                    </div>
                </header>
                <div className="flex items-center justify-center min-h-[80vh]">
                    <div className="text-center bg-[#121318] border border-amber-400/20 rounded-2xl p-10 max-w-md">
                        <span className="material-symbols-outlined text-5xl text-amber-400 mb-4 block">pending</span>
                        <h2 className="text-xl font-bold text-amber-400 mb-2">Assessment Pending</h2>
                        <p className="text-[#abaab0] text-sm mb-4">Assessment not yet completed for <strong className="text-white">{candidate.name}</strong>.</p>
                        <div className="px-3 py-1 rounded bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-bold inline-block mb-6">
                            STATUS: {candidate.status?.toUpperCase() || 'PENDING'}
                        </div>
                        <br />
                        <Link to="/recruiter/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e1f25] text-[#ba9eff] border border-[#47474c]/30 rounded-xl text-xs font-semibold hover:border-[#ba9eff]/50 transition-all">
                            <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const decision = candidate.final_decision;
    const evidence = decision?.evidence_summary;

    // Verdict color
    const v = decision?.verdict?.toUpperCase() || '';
    const isHire = v.includes('HIRE') && !v.includes('NO');
    const isNoHire = v.includes('NO');
    const verdictColor = isHire ? '#4ade80' : isNoHire ? '#ff6e84' : '#fbbf24';
    const verdictBg = isHire ? 'bg-[#4ade80]/10 border-[#4ade80]/30' : isNoHire ? 'bg-[#ff6e84]/10 border-[#ff6e84]/30' : 'bg-amber-400/10 border-amber-400/30';

    // Radar data
    const psychScores = evidence?.psychometric?.scores || {};
    const radarData = {
        labels: Object.keys(psychScores).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
        datasets: [{
            label: 'Candidate',
            data: Object.values(psychScores),
            backgroundColor: 'rgba(186,158,255,0.12)',
            borderColor: '#ba9eff',
            borderWidth: 2,
            pointBackgroundColor: '#ba9eff',
            pointBorderColor: '#0d0e12',
            pointRadius: 4,
        }]
    };
    const radarOptions = {
        scales: { r: { beginAtZero: true, max: 10, ticks: { backdropColor: 'transparent', color: '#75757a', stepSize: 2, font: { size: 10 } }, grid: { color: 'rgba(71,71,76,0.3)' }, angleLines: { color: 'rgba(71,71,76,0.4)' }, pointLabels: { color: '#c7c4d7', font: { size: 11 } } } },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e1f25', titleColor: '#f2f0f6', bodyColor: '#abaab0', borderColor: '#47474c', borderWidth: 1 } }
    };

    // Metric cards
    const metrics = [
        { label: 'Resume Match', value: `${Math.round(evidence?.resume?.score || 0)}%`, icon: 'description', color: '#ba9eff' },
        { label: 'Integrity Score', value: `${Math.max(0, 100 - ((evidence?.integrity?.violation_count || 0) * 10))}%`, icon: 'verified_user', color: '#4ade80' },
        { label: 'Overall Score', value: `${Math.round(decision?.confidence || decision?.score || 0)}%`, icon: 'analytics', color: '#c08cf7' },
        { label: 'Tech Score', value: `${Math.round(evidence?.coding?.weighted_score || evidence?.mcq?.score || 0)}%`, icon: 'code', color: '#fbbf24' },
    ];

    // Evidence trail events
    const trail = [
        { label: 'Candidate Created', time: candidate.created_at, icon: 'person_add', color: '#ba9eff' },
        { label: 'Resume Submitted & Analyzed', time: candidate.created_at, icon: 'description', color: '#c08cf7' },
        { label: 'Assessment Started', time: candidate.created_at, icon: 'play_circle', color: '#4ade80' },
        { label: 'MCQ Completed', time: candidate.created_at, icon: 'quiz', color: '#4ade80' },
        { label: 'Forensic Decision Generated', time: candidate.created_at, icon: 'gavel', color: verdictColor },
    ];

    // XAI factors
    const factors = [
        { label: 'Resume Authenticity', weight: 30, score: Math.round(evidence?.resume?.score || 0) },
        { label: 'Technical Assessment', weight: 40, score: Math.round(evidence?.coding?.weighted_score || evidence?.mcq?.score || 0) },
        { label: 'Integrity Monitor', weight: 30, score: Math.max(0, 100 - ((evidence?.integrity?.violation_count || 0) * 10)) },
    ];

    // Integrity log
    const integrityEvents = evidence?.integrity?.events || [];

    return (
        <div className="min-h-screen bg-[#0d0e12] text-[#f2f0f6] font-body">
            {/* ── FIXED HEADER ── */}
            <header className="fixed top-0 w-full z-50 bg-[#0d0e12]/90 backdrop-blur-xl border-b border-[#47474c]/20">
                <div className="bg-[#121318] border-b border-[#47474c]/20 px-8 py-1.5 flex items-center text-[10px] font-label uppercase tracking-widest text-[#75757a]">
                    <span className="material-symbols-outlined text-xs text-[#4ade80] mr-2">security</span>
                    FORENSIC_REPORT_ACTIVE &nbsp;·&nbsp; AES-256 ENCRYPTED &nbsp;·&nbsp; AUDIT TRAIL ON &nbsp;·&nbsp; EVERY READ LOGGED
                </div>
                <div className="flex items-center justify-between px-8 py-4 max-w-[1440px] mx-auto">
                    <div className="flex items-center gap-4">
                        <Link to="/recruiter/dashboard" className="p-2 hover:bg-[#1e1f25] rounded-lg transition-colors text-[#abaab0] hover:text-white">
                            <span className="material-symbols-outlined text-xl">arrow_back</span>
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-[#ba9eff]/10 border border-[#ba9eff]/20 rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-[#ba9eff] text-lg">shield</span>
                            </div>
                            <div>
                                <h1 className="font-bold text-white text-sm tracking-tight">CANDIDATE_REPORT</h1>
                                <p className="text-[10px] text-[#ba9eff] font-label tracking-wider">Ref: {candidateId?.substring(0, 16)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 font-bold text-base">
                        <span className="material-symbols-outlined text-[#ba9eff]">shield</span>
                        Cygnusa Guardian
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-3 py-1.5 text-[#abaab0] hover:text-white border border-[#47474c]/20 rounded-lg text-xs font-label hover:bg-[#1e1f25] transition-all">
                            <span className="material-symbols-outlined text-sm">share</span> Share
                        </button>
                        <button
                            onClick={() => api.exportReport(candidateId)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#ba9eff]/20 text-[#ba9eff] border border-[#ba9eff]/30 rounded-lg text-xs font-label hover:bg-[#ba9eff]/30 transition-all"
                        >
                            <span className="material-symbols-outlined text-sm">download</span> Export PDF
                        </button>
                    </div>
                </div>
            </header>

            <main className="pt-28 pb-16 px-8 max-w-[1440px] mx-auto">
                {/* ── VERDICT HERO ── */}
                <div className={`rounded-2xl p-8 mb-8 border ${verdictBg} bg-[#121318] relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="flex items-center justify-between flex-wrap gap-6">
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-[#1e1f25] flex items-center justify-center text-2xl font-bold border-2 text-[#ba9eff] border-[#ba9eff]/30 shadow-lg shadow-[#ba9eff]/10">
                                {candidate.name?.charAt(0)?.toUpperCase() || 'C'}
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-white tracking-tight mb-2">{candidate.name}</h2>
                                <div className="flex items-center gap-5 text-sm text-[#abaab0]">
                                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#ba9eff] text-sm">mail</span>{candidate.email}</span>
                                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#ba9eff] text-sm">work</span>{candidate.job_title}</span>
                                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[#ba9eff] text-sm">calendar_today</span>{new Date(candidate.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className="text-xs font-label text-[#abaab0] uppercase tracking-widest">Final Verdict</span>
                            <span className="text-3xl font-black font-label tracking-tighter" style={{ color: verdictColor }}>{decision?.verdict || 'PENDING'}</span>
                            <span className={`px-4 py-1 rounded text-xs font-bold border ${verdictBg}`} style={{ color: verdictColor }}>
                                {candidate.status === 'completed' ? 'EVALUATION_COMPLETE' : candidate.status?.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── METRIC CARDS ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {metrics.map((m, i) => (
                        <div key={i} className="bg-[#121318] rounded-2xl p-6 border border-[#47474c]/20">
                            <span className="material-symbols-outlined text-2xl block mb-3" style={{ color: m.color }}>{m.icon}</span>
                            <p className="text-2xl font-bold mb-1" style={{ color: m.color }}>{m.value}</p>
                            <p className="text-xs text-[#75757a] uppercase tracking-widest font-label">{m.label}</p>
                        </div>
                    ))}
                </div>

                {/* ── TABS + CONTENT GRID ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Tabbed sections */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Tab bar */}
                        <div className="flex bg-[#121318] rounded-xl p-1 gap-1">
                            {TABS.map((tab, i) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(i)}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                                        activeTab === i ? 'bg-[#ba9eff]/20 text-[#ba9eff] border border-[#ba9eff]/30' : 'text-[#75757a] hover:text-[#abaab0]'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab 0: Evidence Trail */}
                        {activeTab === 0 && (
                            <div className="bg-[#121318] rounded-2xl border border-[#47474c]/20 overflow-hidden">
                                <div className="px-6 py-4 border-b border-[#47474c]/20 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[#ba9eff] text-lg">timeline</span>
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-[#abaab0]">Evidence Trail</h3>
                                </div>
                                <div className="p-6 space-y-0">
                                    {trail.map((event, i) => (
                                        <div key={i} className="flex gap-4 pb-6 last:pb-0">
                                            <div className="flex flex-col items-center">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center border" style={{ background: `${event.color}15`, borderColor: `${event.color}40` }}>
                                                    <span className="material-symbols-outlined text-sm" style={{ color: event.color }}>{event.icon}</span>
                                                </div>
                                                {i < trail.length - 1 && <div className="w-px flex-1 bg-[#47474c]/30 mt-1 min-h-[24px]" />}
                                            </div>
                                            <div className="pb-1">
                                                <p className="text-sm font-semibold text-[#f2f0f6]">{event.label}</p>
                                                <p className="text-xs text-[#75757a] font-label mt-0.5">{event.time ? new Date(event.time).toLocaleString() : '—'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Original DecisionCard + EvidencePanel below if available */}
                                {decision && evidence && (
                                    <div className="border-t border-[#47474c]/20 p-6">
                                        <DecisionCard decision={decision} candidate={candidate} candidateId={candidateId} evidence={evidence} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 1: XAI Decision Tree */}
                        {activeTab === 1 && (
                            <div className="bg-[#121318] rounded-2xl border border-[#47474c]/20 overflow-hidden">
                                <div className="px-6 py-4 border-b border-[#47474c]/20 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[#c08cf7] text-lg">account_tree</span>
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-[#abaab0]">XAI Decision Tree</h3>
                                </div>
                                <div className="p-6 space-y-5">
                                    <p className="text-xs text-[#75757a] font-label">Weighted decision factors that determined the final verdict</p>
                                    {factors.map((f, i) => (
                                        <div key={i}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-semibold text-[#f2f0f6]">{f.label}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-label text-[#75757a]">Weight: {f.weight}%</span>
                                                    <span className="text-sm font-bold" style={{ color: f.score >= 70 ? '#4ade80' : f.score >= 40 ? '#fbbf24' : '#ff6e84' }}>{f.score}%</span>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-[#1e1f25] rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${f.score}%`, background: f.score >= 70 ? '#4ade80' : f.score >= 40 ? '#fbbf24' : '#ff6e84' }} />
                                            </div>
                                        </div>
                                    ))}
                                    {decision?.reasoning && (
                                        <div className="mt-6 bg-[#0d0e12] rounded-xl p-5 border border-[#47474c]/20">
                                            <p className="text-xs font-label text-[#abaab0] uppercase tracking-widest mb-3">AI Reasoning</p>
                                            <p className="text-sm text-[#f2f0f6] leading-relaxed">{decision.reasoning}</p>
                                        </div>
                                    )}
                                    {decision?.counterfactual && (
                                        <div className="bg-[#ba9eff]/5 border border-[#ba9eff]/20 rounded-xl p-5">
                                            <p className="text-xs font-label text-[#ba9eff] uppercase tracking-widest mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">swap_horiz</span> Counterfactual
                                            </p>
                                            <p className="text-sm text-[#f2f0f6]">{decision.counterfactual}</p>
                                        </div>
                                    )}
                                </div>
                                {evidence && (
                                    <div className="border-t border-[#47474c]/20 p-6">
                                        <EvidencePanel evidence={evidence} candidate={candidate} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 2: Integrity Log */}
                        {activeTab === 2 && (
                            <div className="bg-[#121318] rounded-2xl border border-[#47474c]/20 overflow-hidden">
                                <div className="px-6 py-4 border-b border-[#47474c]/20 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#4ade80] text-lg">security</span>
                                        <h3 className="font-bold text-sm uppercase tracking-widest text-[#abaab0]">Integrity Log</h3>
                                    </div>
                                    <span className="text-xs font-label text-[#75757a]">{integrityEvents.length} events</span>
                                </div>
                                {integrityEvents.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-[#47474c]/20 bg-[#0d0e12]/40">
                                                    <th className="text-left px-6 py-3 text-[10px] font-label text-[#75757a] uppercase tracking-widest">Timestamp</th>
                                                    <th className="text-left px-6 py-3 text-[10px] font-label text-[#75757a] uppercase tracking-widest">Event Type</th>
                                                    <th className="text-left px-6 py-3 text-[10px] font-label text-[#75757a] uppercase tracking-widest">Severity</th>
                                                    <th className="text-left px-6 py-3 text-[10px] font-label text-[#75757a] uppercase tracking-widest">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {integrityEvents.map((event, i) => {
                                                    const sev = event.severity?.toUpperCase() || 'LOW';
                                                    const sevColor = sev === 'CRITICAL' ? '#ff6e84' : sev === 'HIGH' ? '#ff6e84' : sev === 'MED' || sev === 'MEDIUM' ? '#fbbf24' : '#4ade80';
                                                    return (
                                                        <tr key={i} className="border-b border-[#47474c]/10 hover:bg-[#1e1f25]/40 transition-colors">
                                                            <td className="px-6 py-3 font-mono text-xs text-[#abaab0]">{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '—'}</td>
                                                            <td className="px-6 py-3 text-xs font-label text-[#f2f0f6]">{event.event_type || event.type || 'EVENT'}</td>
                                                            <td className="px-6 py-3">
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ color: sevColor, borderColor: `${sevColor}40`, background: `${sevColor}15` }}>{sev}</span>
                                                            </td>
                                                            <td className="px-6 py-3">
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-[#4ade80]/30 bg-[#4ade80]/10 text-[#4ade80]">LOGGED</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-10 text-center">
                                        <span className="material-symbols-outlined text-4xl text-[#4ade80] block mb-3">verified_user</span>
                                        <p className="text-[#4ade80] font-semibold">No integrity violations detected</p>
                                        <p className="text-xs text-[#75757a] mt-1">Session was clean throughout</p>
                                    </div>
                                )}
                                {decision?.audit_trail && (
                                    <div className="border-t border-[#47474c]/20">
                                        <AuditTrail auditTrail={decision.audit_trail} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Sidebar panels */}
                    <div className="space-y-6">
                        {/* Resume Authenticity */}
                        <div className="bg-[#121318] rounded-2xl border border-[#47474c]/20 overflow-hidden">
                            <ResumeAuthenticityPanel candidate={candidate} candidateId={candidateId} />
                        </div>

                        {/* Psychometric Radar */}
                        {Object.keys(psychScores).length > 0 && (
                            <div className="bg-[#121318] rounded-2xl border border-[#47474c]/20 p-6">
                                <div className="flex items-center gap-2 mb-5">
                                    <span className="material-symbols-outlined text-[#ba9eff] text-lg">psychology</span>
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-[#abaab0]">Psychometric Profile</h3>
                                </div>
                                <div className="aspect-square max-w-[240px] mx-auto relative">
                                    <div className="absolute inset-0 bg-[#ba9eff]/5 blur-2xl rounded-full" />
                                    <RadarChart data={radarData} options={radarOptions} />
                                </div>
                                {evidence?.psychometric?.strong_areas?.length > 0 && (
                                    <div className="mt-4 bg-[#4ade80]/5 border border-[#4ade80]/15 rounded-xl p-3">
                                        <span className="text-[10px] font-label text-[#4ade80] uppercase tracking-widest block mb-2">Strengths</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {evidence.psychometric.strong_areas.map((a, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-[#4ade80]/10 text-[#4ade80] rounded text-xs border border-[#4ade80]/20">{a}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Webcam Gallery */}
                        {snapshots.length > 0 && (
                            <div className="bg-[#121318] rounded-2xl border border-[#47474c]/20 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#ba9eff] text-lg">videocam</span>
                                        <h3 className="font-bold text-sm uppercase tracking-widest text-[#abaab0]">Surveillance</h3>
                                    </div>
                                    <span className="text-[10px] font-label text-[#75757a]">{snapshots.length} frames</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {snapshots.slice(0, 4).map((snap, i) => {
                                        const url = snap.snapshot_path?.startsWith('http') ? snap.snapshot_path : `${BASE_URL}/${snap.snapshot_path?.replace(/^\//, '') || ''}`;
                                        return (
                                            <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-[#47474c]/20 bg-[#1e1f25] group">
                                                <img src={url} alt={`Frame ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1.5 flex items-center justify-between">
                                                    <span className="text-[8px] font-label text-[#abaab0]">{snap.timestamp ? new Date(snap.timestamp).toLocaleTimeString() : ''}</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${snap.face_detected ? 'bg-[#4ade80]/20 text-[#4ade80]' : 'bg-[#ff6e84]/20 text-[#ff6e84]'}`}>
                                                        {snap.face_detected ? 'FACE_OK' : 'NO_FACE'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Behavioral biometrics */}
                        {evidence?.coding?.stress_response && (
                            <div className="bg-[#121318] rounded-2xl border border-[#47474c]/20 p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[#4ade80] text-lg">monitor_heart</span>
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-[#abaab0]">Behavioral Biometrics</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-[#75757a]">Avg Response Depth</span>
                                        <span className={`text-xs font-bold ${evidence.coding.stress_response.pattern === 'rushing' ? 'text-amber-400' : 'text-[#4ade80]'}`}>
                                            {evidence.coding.stress_response.avg_time_seconds}s — {evidence.coding.stress_response.pattern?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-[#1e1f25] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (evidence.coding.stress_response.avg_time_seconds / 600) * 100)}%`, background: evidence.coding.stress_response.pattern === 'rushing' ? '#fbbf24' : '#4ade80' }} />
                                    </div>
                                    <p className="text-[10px] text-[#75757a] font-label leading-relaxed">
                                        {evidence.coding.stress_response.pattern === 'rushing' ? 'SCAN_DETECT: High-speed pattern detected. Possible familiarity or automated assistance.' : 'SCAN_DETECT: Normal cognitive response curve. Deliberate logic application observed.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── FOOTER ── */}
                <div className="mt-12 text-center border-t border-[#47474c]/20 pt-8">
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#121318] border border-[#47474c]/20 text-[#75757a] text-xs font-label">
                        <span className="material-symbols-outlined text-sm">verified_user</span>
                        SECURE_REPORT_{new Date().getFullYear()} // CYGNUSA_GUARDIAN_FORENSIC_AI
                    </div>
                    <p className="mt-2 text-[#47474c] text-xs font-label">This report contains confidential assessment data. Access is logged.</p>
                </div>
            </main>
        </div>
    );
}

export default RecruiterDashboard;
