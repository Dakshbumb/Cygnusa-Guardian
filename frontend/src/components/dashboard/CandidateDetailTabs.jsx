import { useState } from 'react';
import {
    GitBranch, FileText, Code, Shield, Brain, MessageSquare,
    ChevronRight, Send, Loader2
} from 'lucide-react';
import { DecisionTimeline } from '../DecisionTimeline';
import { AuditTrail } from '../AuditTrail';
import { EvidencePanel } from '../DecisionCard';
import { api } from '../../utils/api';

/**
 * Tab Button Component
 */
function TabButton({ id, label, icon: Icon, isActive, onClick, badge }) {
    return (
        <button
            onClick={() => onClick(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap
                       transition-all duration-200 border
                       ${isActive
                    ? 'bg-primary-600 text-white border-primary-500 shadow-lg shadow-primary-900/30'
                    : 'bg-surface-elevated text-neutral-400 border-surface-overlay hover:border-primary-500/30 hover:text-white'
                }`}
        >
            <Icon size={16} />
            <span>{label}</span>
            {badge && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono
                                ${isActive ? 'bg-white/20' : 'bg-surface-overlay'}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

/**
 * Resume Analysis Tab Content
 */
function ResumeAnalysisTab({ candidate }) {
    const evidence = candidate?.resume_evidence;

    if (!evidence) {
        return (
            <div className="text-center py-12 text-neutral-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="font-mono text-sm">No resume analysis available</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Match Score */}
            <div className="bg-surface-base rounded-xl border border-surface-overlay p-6">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-mono text-neutral-400 uppercase text-xs tracking-widest">Match Score</h4>
                    <span className={`text-3xl font-bold ${evidence.match_score >= 70 ? 'text-success-400' :
                        evidence.match_score >= 50 ? 'text-warning-400' : 'text-danger-400'
                        }`}>
                        {evidence.match_score?.toFixed(1) || 0}%
                    </span>
                </div>
                <div className="w-full bg-surface-overlay rounded-full h-2">
                    <div
                        className={`h-full rounded-full transition-all ${evidence.match_score >= 70 ? 'bg-success-500' :
                            evidence.match_score >= 50 ? 'bg-warning-500' : 'bg-danger-500'
                            }`}
                        style={{ width: `${evidence.match_score || 0}%` }}
                    />
                </div>
                {evidence.reasoning && (
                    <p className="mt-4 text-sm text-neutral-400">{evidence.reasoning}</p>
                )}
            </div>

            {/* Skills Extracted */}
            <div className="bg-surface-base rounded-xl border border-surface-overlay p-6">
                <h4 className="font-mono text-neutral-400 uppercase text-xs tracking-widest mb-4">Skills Detected</h4>
                <div className="flex flex-wrap gap-2">
                    {evidence.skills_extracted?.map((skill, i) => (
                        <span
                            key={i}
                            className="px-3 py-1.5 rounded-full bg-primary-900/30 text-primary-400 text-sm font-medium border border-primary-500/30"
                        >
                            {skill}
                        </span>
                    ))}
                </div>
            </div>

            {/* Missing Critical Skills */}
            {evidence.missing_critical?.length > 0 && (
                <div className="bg-danger-500/10 rounded-xl border border-danger-500/30 p-6">
                    <h4 className="font-mono text-danger-400 uppercase text-xs tracking-widest mb-4">Missing Critical Skills</h4>
                    <div className="flex flex-wrap gap-2">
                        {evidence.missing_critical.map((skill, i) => (
                            <span
                                key={i}
                                className="px-3 py-1.5 rounded-full bg-danger-500/20 text-danger-400 text-sm font-medium border border-danger-500/30"
                            >
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Experience & Education */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-base rounded-xl border border-surface-overlay p-4">
                    <h4 className="font-mono text-neutral-500 uppercase text-xs tracking-widest mb-2">Experience</h4>
                    <p className="text-xl font-bold text-white">
                        {evidence.experience_years ? `${evidence.experience_years} years` : 'Not specified'}
                    </p>
                </div>
                <div className="bg-surface-base rounded-xl border border-surface-overlay p-4">
                    <h4 className="font-mono text-neutral-500 uppercase text-xs tracking-widest mb-2">Education</h4>
                    <p className="text-sm text-white">
                        {evidence.education || 'Not specified'}
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Code Performance Tab Content
 */
function CodePerformanceTab({ candidate }) {
    const codeEvidence = candidate?.code_evidence || [];

    if (codeEvidence.length === 0) {
        return (
            <div className="text-center py-12 text-neutral-500">
                <Code className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="font-mono text-sm">No code submissions available</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {codeEvidence.map((code, index) => (
                <div key={index} className="bg-surface-base rounded-xl border border-surface-overlay p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-white">{code.question_title}</h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${code.pass_rate >= 80 ? 'bg-success-900/30 text-success-400' :
                            code.pass_rate >= 50 ? 'bg-warning-900/30 text-warning-400' : 'bg-danger-500/20 text-danger-400'
                            }`}>
                            {code.pass_rate?.toFixed(0) || 0}% Pass Rate
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-surface-elevated rounded-lg">
                            <p className="text-lg font-bold text-white">{code.total_tests}</p>
                            <p className="text-[10px] font-mono text-neutral-500 uppercase">Total Tests</p>
                        </div>
                        <div className="text-center p-3 bg-surface-elevated rounded-lg">
                            <p className="text-lg font-bold text-white">{code.avg_time_ms?.toFixed(0) || 0}ms</p>
                            <p className="text-[10px] font-mono text-neutral-500 uppercase">Avg Time</p>
                        </div>
                        <div className="text-center p-3 bg-surface-elevated rounded-lg">
                            <p className="text-lg font-bold text-white">{code.duration_seconds || '--'}s</p>
                            <p className="text-[10px] font-mono text-neutral-500 uppercase">Duration</p>
                        </div>
                    </div>

                    {/* Test Cases */}
                    <div className="space-y-2">
                        {code.test_cases?.slice(0, 3).map((tc, i) => (
                            <div key={i} className={`flex items-center gap-3 p-2 rounded ${tc.passed ? 'bg-success-900/10' : 'bg-danger-500/10'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${tc.passed ? 'bg-success-500' : 'bg-danger-500'}`} />
                                <code className="text-xs font-mono text-neutral-400 flex-1 truncate">
                                    Input: {tc.input}
                                </code>
                                <span className="text-xs font-mono text-neutral-500">{tc.time_ms?.toFixed(1)}ms</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Integrity Report Tab Content
 */
function IntegrityReportTab({ candidate, snapshots }) {
    const integrity = candidate?.integrity_evidence;

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className={`rounded-xl border p-6 ${integrity?.total_violations > 5 ? 'bg-danger-500/10 border-danger-500/30' :
                integrity?.total_violations > 0 ? 'bg-warning-900/10 border-warning-500/30' :
                    'bg-success-900/10 border-success-500/30'
                }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-mono uppercase text-xs tracking-widest mb-1 text-neutral-400">Integrity Rating</h4>
                        <p className={`text-2xl font-bold ${integrity?.trustworthiness_rating === 'High' ? 'text-success-400' :
                            integrity?.trustworthiness_rating === 'Medium' ? 'text-warning-400' : 'text-danger-400'
                            }`}>
                            {integrity?.trustworthiness_rating || 'High'}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-white">{integrity?.total_violations || 0}</p>
                        <p className="text-xs font-mono text-neutral-500 uppercase">Violations</p>
                    </div>
                </div>
            </div>

            {/* Violation Events */}
            {integrity?.events?.length > 0 && (
                <div className="bg-surface-base rounded-xl border border-surface-overlay p-6">
                    <h4 className="font-mono text-neutral-400 uppercase text-xs tracking-widest mb-4">Event Log</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {integrity.events.map((event, i) => (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${event.severity === 'critical' ? 'bg-danger-500/10' :
                                event.severity === 'high' ? 'bg-warning-900/20' : 'bg-surface-elevated'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${event.severity === 'critical' ? 'bg-danger-500' :
                                    event.severity === 'high' ? 'bg-warning-500' : 'bg-neutral-500'
                                    }`} />
                                <span className="text-sm text-neutral-300 flex-1">{event.event_type}</span>
                                <span className="text-xs font-mono text-neutral-500">{event.timestamp}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Snapshots Grid */}
            {snapshots?.length > 0 && (
                <div className="bg-surface-base rounded-xl border border-surface-overlay p-6">
                    <h4 className="font-mono text-neutral-400 uppercase text-xs tracking-widest mb-4">
                        Webcam Snapshots ({snapshots.length})
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                        {snapshots.slice(0, 8).map((snap, i) => (
                            <div key={i} className="aspect-video rounded-lg overflow-hidden bg-surface-elevated border border-surface-overlay">
                                <img
                                    src={snap.snapshot_path}
                                    alt={`Snapshot ${i}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Notes Tab Content
 */
function NotesTab({ candidate, candidateId }) {
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [noteAdded, setNoteAdded] = useState(false);

    const handleSubmitNote = async () => {
        if (!note.trim() || !candidateId) return;

        setIsSubmitting(true);
        try {
            await api.addRecruiterNote(candidateId, note);
            setNote('');
            setNoteAdded(true);
            setTimeout(() => setNoteAdded(false), 3000);
        } catch (err) {
            console.error('Failed to add note:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter decision nodes for notes
    const notes = candidate?.decision_nodes?.filter(n => n.node_type === 'NOTE') || [];

    return (
        <div className="space-y-6">
            {/* Add Note Form */}
            <div className="bg-surface-base rounded-xl border border-surface-overlay p-6">
                <h4 className="font-mono text-neutral-400 uppercase text-xs tracking-widest mb-4">Add Note</h4>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter your notes about this candidate..."
                    className="w-full h-32 px-4 py-3 bg-surface-elevated border border-surface-overlay rounded-lg
                             text-white placeholder-neutral-500 resize-none
                             focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                />
                <div className="flex items-center justify-between mt-3">
                    {noteAdded && (
                        <span className="text-success-400 text-sm">Note added successfully!</span>
                    )}
                    <button
                        onClick={handleSubmitNote}
                        disabled={!note.trim() || isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 
                                 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                 ml-auto"
                    >
                        {isSubmitting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Send size={16} />
                        )}
                        Save Note
                    </button>
                </div>
            </div>

            {/* Previous Notes */}
            {notes.length > 0 && (
                <div className="bg-surface-base rounded-xl border border-surface-overlay p-6">
                    <h4 className="font-mono text-neutral-400 uppercase text-xs tracking-widest mb-4">Previous Notes</h4>
                    <div className="space-y-3">
                        {notes.map((n, i) => (
                            <div key={i} className="p-4 bg-surface-elevated rounded-lg border border-surface-overlay">
                                <p className="text-neutral-300">{n.description}</p>
                                <p className="text-xs font-mono text-neutral-500 mt-2">{n.timestamp}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * CandidateDetailTabs - Tabbed view for individual candidate details
 */
export function CandidateDetailTabs({ candidate, candidateId, snapshots = [] }) {
    const [activeTab, setActiveTab] = useState('timeline');

    const tabs = [
        { id: 'timeline', label: 'Decision Timeline', icon: GitBranch },
        { id: 'resume', label: 'Resume Analysis', icon: FileText },
        { id: 'code', label: 'Code Performance', icon: Code, badge: candidate?.code_evidence?.length },
        { id: 'integrity', label: 'Integrity Report', icon: Shield },
        { id: 'audit', label: 'AI Audit Trail', icon: Brain },
        { id: 'notes', label: 'Notes & Comments', icon: MessageSquare }
    ];

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {tabs.map(tab => (
                    <TabButton
                        key={tab.id}
                        {...tab}
                        isActive={activeTab === tab.id}
                        onClick={setActiveTab}
                    />
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
                {activeTab === 'timeline' && (
                    <DecisionTimeline nodes={candidate?.decision_nodes} />
                )}
                {activeTab === 'resume' && (
                    <ResumeAnalysisTab candidate={candidate} />
                )}
                {activeTab === 'code' && (
                    <CodePerformanceTab candidate={candidate} />
                )}
                {activeTab === 'integrity' && (
                    <IntegrityReportTab candidate={candidate} snapshots={snapshots} />
                )}
                {activeTab === 'audit' && candidate?.final_decision?.audit_trail && (
                    <AuditTrail auditTrail={candidate.final_decision.audit_trail} />
                )}
                {activeTab === 'notes' && (
                    <NotesTab candidate={candidate} candidateId={candidateId} />
                )}
            </div>
        </div>
    );
}

export default CandidateDetailTabs;
