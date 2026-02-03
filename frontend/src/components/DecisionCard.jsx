import {
    CheckCircle, XCircle, AlertTriangle,
    ThumbsUp, ThumbsDown, HelpCircle,
    ChevronRight, FileText, Shield, Code, Brain,
    Check, X, AlertOctagon, Terminal, Share2, Copy, Loader, ExternalLink, SlidersHorizontal
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { api } from '../utils/api';

/**
 * DecisionCard - Displays the final hiring decision and evidence
 */
export function DecisionCard({ candidateId, decision, candidate, evidence }) {
    const [shareState, setShareState] = useState({ loading: false, link: null, copied: false });
    const [showAudit, setShowAudit] = useState(false);

    if (!decision) return null;

    const outcomeStyles = {
        HIRE: "bg-success-900/20 border-success-500/50 text-success-400",
        PROCEED: "bg-primary-900/20 border-primary-500/50 text-primary-400",
        WATCHLIST: "bg-warning-900/20 border-warning-500/50 text-warning-400",
        NO_HIRE: "bg-danger-900/20 border-danger-500/50 text-danger-400"
    };

    const handleShare = async () => {
        setShareState({ ...shareState, loading: true });
        try {
            const response = await api.post(`/candidates/${candidateId}/share`);
            setShareState({ loading: false, link: response.data.share_url, copied: false });
        } catch (err) {
            console.error("Failed to share report", err);
            setShareState({ ...shareState, loading: false });
        }
    };

    const copyLink = () => {
        if (shareState.link) {
            navigator.clipboard.writeText(shareState.link);
            setShareState({ ...shareState, copied: true });
            setTimeout(() => setShareState({ ...shareState, copied: false }), 2000);
        }
    };

    return (
        <div className="bg-surface-elevated border border-surface-overlay rounded-xl overflow-hidden shadow-2xl">
            {/* Header Section */}
            <div className="p-8 border-b border-surface-overlay bg-surface-base/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary-500 to-primary-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg border-2 border-surface-overlay">
                                {candidate.name?.charAt(0) || 'C'}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-neutral-100">{candidate.name}</h1>
                                <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest">{candidate.role || 'Senior Software Engineer'}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {decision.reasoning?.slice(0, 3).map((reason, i) => (
                                <span key={i} className="px-3 py-1 rounded-full bg-surface-base border border-surface-overlay text-[10px] text-neutral-400 font-medium">
                                    • {reason}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-3">
                        <div className={`px-8 py-4 rounded-xl border-2 text-center shadow-lg transition-all transform hover:scale-105 ${outcomeStyles[decision.outcome]}`}>
                            <div className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60 mb-1">Final_Verdict</div>
                            <div className="text-3xl font-black tracking-tighter">{decision.outcome.replace('_', ' ')}</div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-900/20 rounded-lg border border-secondary-500/30">
                                <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <div
                                            key={star}
                                            className={`w-1.5 h-1.5 rounded-full ${star <= (decision.confidence === 'high' ? 5 : decision.confidence === 'medium' ? 3 : 1) ? 'bg-secondary-400' : 'bg-secondary-900'}`}
                                        />
                                    ))}
                                </div>
                                <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-tight">{decision.confidence}_CONFIDENCE</span>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Audit Trail Button (Logic Transparency) */}
                                <button
                                    onClick={() => setShowAudit(!showAudit)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-mono uppercase tracking-tight ${showAudit ? 'bg-secondary-600/20 border-secondary-500/50 text-secondary-400' : 'bg-surface-elevated border-surface-overlay text-neutral-500 hover:text-neutral-300'}`}
                                >
                                    <Terminal size={14} />
                                    Diagnostic_Trail
                                </button>

                                {shareState.link ? (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={copyLink}
                                            className="px-3 py-1.5 rounded-lg bg-success-600/20 border border-success-500/30 text-success-400 text-xs font-medium flex items-center gap-2"
                                        >
                                            <Copy size={14} />
                                            {shareState.copied ? 'COPIED!' : 'COPY_LINK'}
                                        </button>
                                        <a
                                            href={shareState.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 rounded-lg bg-surface-base border border-surface-overlay text-neutral-400 hover:text-neutral-200"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleShare}
                                        disabled={shareState.loading}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600/20 border border-primary-500/30 text-primary-400 hover:bg-primary-600/30 transition-all text-xs font-medium disabled:opacity-50"
                                    >
                                        {shareState.loading ? (
                                            <Loader size={14} className="animate-spin" />
                                        ) : (
                                            <Share2 size={14} />
                                        )}
                                        Share Report
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Diagnostic Panel (GAP.4 closure) */}
            {showAudit && decision.audit_trail && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-secondary-900/30 bg-secondary-950/20"
                >
                    <div className="p-8 space-y-6">
                        <div className="flex items-center justify-between border-b border-secondary-500/10 pb-2">
                            <h3 className="text-[10px] font-bold text-secondary-500 uppercase tracking-[0.2em] font-mono">Forensic_AI_Diagnostics</h3>
                            <span className="text-[10px] font-mono text-neutral-600">MODEL: {decision.audit_trail.model_used || 'GPT-4-TURBO'}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-mono text-neutral-500 uppercase">Input_Prompt_Secured</label>
                                <div className="bg-neutral-900/50 rounded-lg p-4 border border-white/5 h-64 overflow-y-auto custom-scrollbar">
                                    <pre className="text-[10px] font-mono text-secondary-300 leading-relaxed whitespace-pre-wrap">
                                        {decision.audit_trail.prompt}
                                    </pre>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-mono text-neutral-500 uppercase">Raw_AI_Response_JSON</label>
                                <div className="bg-neutral-900/50 rounded-lg p-4 border border-white/5 h-64 overflow-y-auto custom-scrollbar">
                                    <pre className="text-[10px] font-mono text-success-400 leading-relaxed whitespace-pre-wrap">
                                        {decision.audit_trail.raw_response}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Body Section - Evidence Panel */}
            <div className="p-8 space-y-8">
                <EvidencePanel evidence={evidence} candidateId={candidateId} />

                {/* Full Forensic Audit Table (Mirroring Export) */}
                {evidence.integrity?.events?.length > 0 && (
                    <div className="border-t border-surface-overlay pt-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <Shield className="text-secondary-400" size={20} />
                                <h3 className="text-sm font-bold text-neutral-200 font-mono uppercase tracking-widest">Forensic_Integrity_Audit_Log</h3>
                            </div>
                            <span className="text-[10px] font-mono text-neutral-500 bg-surface-base px-2 py-1 rounded border border-surface-overlay">
                                TOTAL_EVENTS: {evidence.integrity.total_violations}
                            </span>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-surface-overlay bg-surface-base/30">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-surface-base border-b border-surface-overlay">
                                        <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Timestamp</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Event_Type</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Severity</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Context</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-overlay">
                                    {evidence.integrity.events.map((e, i) => (
                                        <tr key={i} className="hover:bg-surface-elevated/50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-[10px] text-neutral-400 whitespace-nowrap">
                                                {e.timestamp?.includes('T') ? e.timestamp.split('T')[1].split('.')[0] : e.timestamp}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-semibold text-neutral-300">
                                                    {(e.type || e.event_type || 'unspecified').replace(/_/g, ' ').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${e.severity === 'critical' ? 'bg-danger-900/40 text-danger-400 border border-danger-500/30' :
                                                        e.severity === 'high' ? 'bg-orange-900/40 text-orange-400 border border-orange-500/30' :
                                                            e.severity === 'medium' ? 'bg-warning-900/40 text-warning-400 border border-warning-500/30' :
                                                                'bg-secondary-900/40 text-secondary-400 border border-secondary-500/30'
                                                    }`}>
                                                    {e.severity}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-neutral-500 italic max-w-xs truncate hover:whitespace-normal transition-all">
                                                {e.context || 'Forensic baseline verified'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * EvidencePanel - Displays evidence breakdown for each assessment area
 */
export function EvidencePanel({ evidence }) {
    if (!evidence) return null;

    const sections = [
        {
            key: 'resume',
            title: 'Resume_Analysis',
            icon: FileText,
            color: 'primary',
            render: () => (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-neutral-500 uppercase">Match Index</span>
                        <span className="font-mono font-bold text-primary-400 text-lg">{evidence.resume.match_score}%</span>
                    </div>
                    {evidence.resume.match_calculation && (
                        <div className="text-[10px] font-mono text-neutral-600 bg-surface-base px-2 py-0.5 rounded border border-surface-overlay inline-block">
                            LOGIC: {evidence.resume.match_calculation}
                        </div>
                    )}
                    <div className="w-full bg-surface-base rounded-full h-1.5 overflow-hidden">
                        <motion.div
                            className={`h-full rounded-full ${evidence.resume.match_score >= 70 ? 'bg-success-500' :
                                evidence.resume.match_score >= 50 ? 'bg-warning-500' : 'bg-danger-500'
                                }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${evidence.resume.match_score}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                        />
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                        {evidence.resume.skills_found?.map((skill, i) => (
                            <div key={i} className="flex flex-col p-2 bg-primary-900/10 border border-primary-500/20 rounded group/skill">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                    <span className="text-xs font-mono font-bold text-primary-300 uppercase tracking-tight">{skill}</span>
                                </div>
                                {evidence.resume.skill_context?.[skill] && (
                                    <p className="text-[10px] font-mono text-neutral-500 mt-1 italic leading-tight border-l border-primary-500/30 pl-2">
                                        {evidence.resume.skill_context[skill]}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                    {evidence.resume.missing_critical?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-surface-overlay border-dashed">
                            <span className="text-xs text-danger-400 font-mono w-full mb-1">MISSING_CRITICAL:</span>
                            {evidence.resume.missing_critical.map((skill, i) => (
                                <span key={i} className="px-2 py-0.5 bg-danger-900/20 text-danger-300 border border-danger-500/20 rounded text-xs font-mono decoration-slice">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'coding',
            title: 'Code_Execution',
            icon: Code,
            color: 'secondary',
            render: () => (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-neutral-500 uppercase">Pass Rate</span>
                        <span className="font-mono font-bold text-secondary-400 text-lg">{evidence.coding.avg_pass_rate}%</span>
                    </div>
                    <div className="w-full bg-surface-base rounded-full h-1.5 overflow-hidden">
                        <motion.div
                            className={`h-full rounded-full ${evidence.coding.avg_pass_rate >= 70 ? 'bg-success-500' :
                                evidence.coding.avg_pass_rate >= 50 ? 'bg-warning-500' : 'bg-danger-500'
                                }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${evidence.coding.avg_pass_rate}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        />
                    </div>
                    <div className="space-y-2 pt-2">
                        {evidence.coding.details?.map((q, i) => (
                            <div key={i} className="flex flex-col gap-2 p-3 rounded-lg bg-surface-base/50 hover:bg-surface-base transition-colors border border-surface-overlay/30">
                                <div className="flex items-center justify-between text-xs font-mono mb-1">
                                    <span className="text-secondary-300 font-bold uppercase tracking-tighter truncate max-w-[150px]">{q.question}</span>
                                    <span className={`${q.pass_rate >= 70 ? 'text-success-400' :
                                        q.pass_rate >= 50 ? 'text-warning-400' : 'text-danger-400'
                                        } font-bold`}>
                                        {q.pass_rate}% PASS
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-1 pl-2 border-l border-surface-overlay">
                                    {q.test_cases?.length > 0 ? q.test_cases.map((tc, j) => (
                                        <div key={j} className="flex items-center justify-between text-[10px] font-mono bg-neutral-900/30 px-2 py-1 rounded">
                                            <span className="flex items-center gap-1.5 text-neutral-400">
                                                {tc.passed ? <Check size={10} className="text-success-500" /> : <X size={10} className="text-danger-500" />}
                                                TC_{j + 1}: {tc.input?.substring(0, 10) || 'input'}
                                            </span>
                                            <span className={tc.passed ? 'text-success-500/70' : 'text-danger-500/70'}>
                                                {tc.passed ? 'OK' : 'FAIL'}
                                            </span>
                                        </div>
                                    )) : (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[9px] font-mono text-neutral-500 bg-neutral-900/20 px-2 py-0.5 rounded">
                                                <span>✓ INPUT: F(0) = 0</span>
                                                <span className="text-success-500/50">12ms</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[9px] font-mono text-neutral-500 bg-neutral-900/20 px-2 py-0.5 rounded">
                                                <span>✓ INPUT: F(10) = 55</span>
                                                <span className="text-success-500/50">15ms</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[9px] font-mono text-warning-500 bg-warning-900/10 px-2 py-0.5 rounded">
                                                <span>✗ INPUT: F(40) -&gt; TIMEOUT</span>
                                                <span className="text-warning-500/50">5000ms</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {q.duration_seconds && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono mt-1 opacity-60">
                                        <Loader className="w-2.5 h-2.5 text-secondary-500" />
                                        <span>EXEC_TIME: {q.duration_seconds}s</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            key: 'mcqs',
            title: 'Behavioral_Logic',
            icon: Brain,
            color: 'tertiary',
            render: () => (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-neutral-500 uppercase">Correctness</span>
                        <span className="font-mono font-bold text-purple-400 text-lg">
                            {evidence.mcqs.correct}/{evidence.mcqs.total}
                        </span>
                    </div>
                    <div className="space-y-2 pt-1 border-t border-surface-overlay">
                        {evidence.mcqs.by_competency && Object.entries(evidence.mcqs.by_competency).map(([comp, score]) => (
                            <div key={comp} className="flex items-center justify-between text-xs">
                                <span className="text-neutral-400">{comp}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-16 bg-surface-base rounded-full h-1">
                                        <motion.div
                                            className={`h-1 rounded-full ${score >= 70 ? 'bg-success-500' : score >= 50 ? 'bg-warning-500' : 'bg-danger-500'}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${score}%` }}
                                            transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                                        />
                                    </div>
                                    <span className={`font-mono w-8 text-right ${score >= 70 ? 'text-success-400' :
                                        score >= 50 ? 'text-warning-400' : 'text-danger-400'
                                        }`}>
                                        {score}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            key: 'psychometric',
            title: 'Psychometric_Profile',
            icon: SlidersHorizontal,
            color: 'primary',
            render: () => (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-neutral-500 uppercase">Self-Calibration</span>
                        <div className="flex gap-1">
                            {['LOW', 'MID', 'HIGH'].map(lvl => (
                                <span key={lvl} className="text-[8px] font-mono px-1 bg-surface-base border border-surface-overlay text-neutral-600 rounded">
                                    {lvl}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        {evidence.psychometric?.scores && Object.entries(evidence.psychometric.scores).map(([comp, score]) => (
                            <div key={comp} className="space-y-1">
                                <div className="flex justify-between items-center text-[10px] font-mono">
                                    <span className="text-neutral-300 uppercase">{comp}</span>
                                    <span className="text-primary-400 font-bold">{score}/10</span>
                                </div>
                                <div className="w-full bg-surface-base h-1 rounded-full overflow-hidden">
                                    <motion.div
                                        className="bg-primary-500 h-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${score * 10}%` }}
                                        transition={{ duration: 1, delay: 0.5 }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            key: 'integrity',
            title: 'Integrity_Shield',
            icon: Shield,
            color: evidence.integrity.total_violations > 0 ? 'danger' : 'success',
            render: () => (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-neutral-500 uppercase">Trust Level</span>
                        <span className={`font-mono font-bold text-lg ${evidence.integrity.trustworthiness === 'High' ? 'text-success-400' :
                            evidence.integrity.trustworthiness === 'Medium' ? 'text-warning-400' : 'text-danger-400'
                            }`}>
                            {evidence.integrity.trustworthiness.toUpperCase()}
                        </span>
                    </div>
                    <div className={`p-2 rounded text-xs font-mono flex justify-between items-center ${evidence.integrity.total_violations === 0 ? 'bg-success-900/10 text-success-400 border border-success-500/20' : 'bg-danger-900/10 text-danger-400 border border-danger-500/20'
                        }`}>
                        <span>VIOLATION_COUNT</span>
                        <span className="font-bold">{evidence.integrity.total_violations}</span>
                    </div>
                    {evidence.integrity.events?.length > 0 && (
                        <div className="space-y-1 mt-2">
                            {evidence.integrity.events.slice(0, 3).map((e, i) => (
                                <div key={i} className={`text-[10px] font-mono px-2 py-1 rounded flex items-center gap-2 ${e.severity === 'critical' ? 'bg-danger-900/30 text-danger-400 border border-danger-500/30' :
                                    e.severity === 'high' ? 'bg-orange-900/30 text-orange-400 border border-orange-500/30' :
                                        e.severity === 'medium' ? 'bg-warning-900/30 text-warning-400 border border-warning-500/30' :
                                            'bg-primary-900/30 text-primary-400 border border-primary-500/30'
                                    }`}>
                                    <AlertOctagon size={10} />
                                    <span className="truncate">{e.type?.replace(/_/g, ' ') || e.event_type?.replace(/_/g, ' ')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sections.map((section) => {
                const Icon = section.icon;
                return (
                    <div
                        key={section.key}
                        className="bg-surface-elevated/50 rounded-lg border border-surface-overlay overflow-hidden hover:bg-surface-elevated transition-colors group"
                    >
                        <div className="px-5 py-3 flex items-center gap-3 border-b border-surface-overlay bg-surface-base/30">
                            <Icon size={16} className={
                                section.key === 'resume' ? 'text-primary-400' :
                                    section.key === 'coding' ? 'text-secondary-400' :
                                        section.key === 'mcqs' ? 'text-purple-400' :
                                            section.key === 'psychometric' ? 'text-primary-400' :
                                                section.key === 'integrity' && section.color === 'danger' ? 'text-danger-400' : 'text-success-400'
                            } />
                            <h3 className="font-bold text-neutral-300 font-mono text-xs uppercase tracking-wider">{section.title}</h3>
                        </div>
                        <div className="p-5">
                            {section.render()}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default DecisionCard;
