import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    User, Mail, Briefcase, Calendar, Shield, Target,
    ChevronRight, CheckCircle2, XCircle, Clock, AlertTriangle,
    MoreVertical, Eye, Download, CalendarPlus
} from 'lucide-react';
import { InterviewScheduleModal } from './InterviewScheduleModal';

/**
 * StatusBadge - Color-coded candidate status badge
 */
function StatusBadge({ outcome }) {
    const config = {
        HIRE: { label: 'Selected', color: 'bg-success-900/30 text-success-400 border-success-500/30', icon: CheckCircle2 },
        NO_HIRE: { label: 'Rejected', color: 'bg-danger-500/30 text-danger-400 border-danger-500/30', icon: XCircle },
        CONDITIONAL: { label: 'Conditional', color: 'bg-warning-500/30 text-warning-400 border-warning-500/30', icon: Clock },
        PENDING: { label: 'Pending', color: 'bg-warning-500/30 text-warning-400 border-warning-500/30', icon: Clock }
    };

    const { label, color, icon: Icon } = config[outcome] || config.PENDING;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${color}`}>
            <Icon size={12} />
            {label}
        </span>
    );
}

/**
 * IntegrityBadge - Shows integrity score with severity indicator
 */
function IntegrityBadge({ score, level }) {
    const config = {
        clean: { color: 'text-success-400', bg: 'bg-success-900/20' },
        minor: { color: 'text-warning-400', bg: 'bg-warning-900/20' },
        major: { color: 'text-danger-400', bg: 'bg-danger-500/20' }
    };

    const { color, bg } = config[level] || config.clean;

    return (
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${bg}`}>
            <Shield size={12} className={color} />
            <span className={`text-xs font-mono ${color}`}>{score}%</span>
        </div>
    );
}

/**
 * CandidateRow - Single row in the roster table
 */
function CandidateRow({ candidate, isSelected, onSelect, onView, onSchedule }) {
    const [showActions, setShowActions] = useState(false);

    // Check if candidate can be scheduled (Selected/Conditional with 50%+ score)
    const canSchedule = (candidate.outcome === 'HIRE' || candidate.outcome === 'CONDITIONAL') &&
        (candidate.overall_score || 0) >= 50;

    return (
        <div
            className={`group flex items-center gap-4 p-4 border-b border-surface-overlay 
                       hover:bg-surface-overlay/50 transition-colors cursor-pointer
                       ${isSelected ? 'bg-primary-900/20 border-l-2 border-l-primary-500' : ''}`}
            onClick={() => onView?.(candidate.id)}
        >
            {/* Checkbox for bulk select */}
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelect?.(candidate.id, e.target.checked)}
                    className="w-4 h-4 rounded border-surface-overlay bg-surface-base text-primary-500 
                              focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
                />
            </div>

            {/* Avatar */}
            <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-surface-overlay flex items-center justify-center
                               text-primary-400 font-bold text-sm border border-surface-overlay
                               group-hover:border-primary-500/30 transition-colors">
                    {candidate.name?.charAt(0) || 'C'}
                </div>
            </div>

            {/* Name & Email */}
            <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate group-hover:text-primary-400 transition-colors">
                    {candidate.name}
                </p>
                <p className="text-xs text-neutral-500 font-mono truncate">{candidate.email}</p>
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0">
                <StatusBadge outcome={candidate.outcome} />
            </div>

            {/* Score */}
            <div className="flex-shrink-0 w-16 text-center">
                <p className="text-sm font-bold text-white">{candidate.overall_score || 0}%</p>
                <p className="text-[10px] font-mono text-neutral-500 uppercase">Score</p>
            </div>

            {/* Integrity */}
            <div className="flex-shrink-0">
                <IntegrityBadge score={candidate.integrity_score} level={candidate.integrity_level} />
            </div>

            {/* Date */}
            <div className="flex-shrink-0 w-24 hidden lg:block">
                <p className="text-xs text-neutral-400 font-mono">
                    {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : '--'}
                </p>
            </div>

            {/* Quick Actions */}
            <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}>
                <Link
                    to={`/recruiter/${candidate.id}`}
                    className="p-1.5 rounded hover:bg-surface-overlay text-neutral-400 hover:text-primary-400 transition-colors"
                    title="View Profile"
                >
                    <Eye size={16} />
                </Link>
                <button
                    className="p-1.5 rounded hover:bg-surface-overlay text-neutral-400 hover:text-white transition-colors"
                    title="Download Report"
                >
                    <Download size={16} />
                </button>
                <button
                    onClick={() => onSchedule?.(candidate)}
                    className={`p-1.5 rounded hover:bg-surface-overlay transition-colors
                        ${canSchedule
                            ? 'text-primary-400 hover:text-primary-300'
                            : 'text-neutral-600 cursor-not-allowed'}`}
                    title={canSchedule ? "Schedule Interview" : "Not eligible for scheduling (needs 50%+ score and Selected/Conditional status)"}
                    disabled={!canSchedule}
                >
                    <CalendarPlus size={16} />
                </button>
            </div>

            {/* Chevron */}
            <ChevronRight size={16} className="text-neutral-600 group-hover:text-primary-400 transition-colors flex-shrink-0" />
        </div>
    );
}

/**
 * CandidateRoster - Main roster table with smart sorting
 */
export function CandidateRoster({
    candidates,
    selectedIds = [],
    onSelectChange,
    onCandidateClick,
    loading = false
}) {
    const [scheduleCandidate, setScheduleCandidate] = useState(null);

    // Handle select all
    const handleSelectAll = useCallback((checked) => {
        if (checked) {
            onSelectChange?.(candidates.map(c => c.id));
        } else {
            onSelectChange?.([]);
        }
    }, [candidates, onSelectChange]);

    // Handle individual selection
    const handleSelect = useCallback((id, checked) => {
        if (checked) {
            onSelectChange?.([...selectedIds, id]);
        } else {
            onSelectChange?.(selectedIds.filter(sid => sid !== id));
        }
    }, [selectedIds, onSelectChange]);

    // Handle schedule interview
    const handleSchedule = useCallback((candidate) => {
        setScheduleCandidate(candidate);
    }, []);

    const handleScheduleComplete = useCallback((scheduleData) => {
        console.log('Interview scheduled:', scheduleData);
        setScheduleCandidate(null);
    }, []);

    if (loading) {
        return (
            <div className="bg-surface-elevated rounded-xl border border-surface-overlay overflow-hidden">
                <div className="animate-pulse">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 border-b border-surface-overlay">
                            <div className="w-4 h-4 bg-surface-overlay rounded" />
                            <div className="w-10 h-10 bg-surface-overlay rounded-full" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-surface-overlay rounded w-1/3" />
                                <div className="h-3 bg-surface-overlay rounded w-1/4" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!candidates || candidates.length === 0) {
        return (
            <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-12 text-center">
                <User className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                <p className="text-neutral-500 font-mono text-sm uppercase tracking-widest">
                    No candidates found
                </p>
                <p className="text-neutral-600 text-xs mt-2">
                    Candidates will appear here once they complete assessments
                </p>
            </div>
        );
    }

    const allSelected = selectedIds.length === candidates.length;
    const someSelected = selectedIds.length > 0 && selectedIds.length < candidates.length;

    return (
        <>
            <div className="bg-surface-elevated rounded-xl border border-surface-overlay overflow-hidden">
                {/* Header Row */}
                <div className="flex items-center gap-4 px-4 py-3 bg-surface-base/50 border-b border-surface-overlay text-xs font-mono text-neutral-500 uppercase tracking-wider">
                    <div className="flex-shrink-0 w-4">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => el && (el.indeterminate = someSelected)}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="w-4 h-4 rounded border-surface-overlay bg-surface-base text-primary-500 
                                      focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
                        />
                    </div>
                    <div className="flex-shrink-0 w-10" /> {/* Avatar space */}
                    <div className="flex-1">Candidate</div>
                    <div className="flex-shrink-0 w-24">Status</div>
                    <div className="flex-shrink-0 w-16 text-center">Score</div>
                    <div className="flex-shrink-0 w-20">Integrity</div>
                    <div className="flex-shrink-0 w-24 hidden lg:block">Date</div>
                    <div className="flex-shrink-0 w-28">Actions</div>
                    <div className="flex-shrink-0 w-4" /> {/* Chevron space */}
                </div>

                {/* Candidate Rows */}
                <div className="max-h-[60vh] overflow-y-auto">
                    {candidates.map((candidate) => (
                        <CandidateRow
                            key={candidate.id}
                            candidate={candidate}
                            isSelected={selectedIds.includes(candidate.id)}
                            onSelect={handleSelect}
                            onView={onCandidateClick}
                            onSchedule={handleSchedule}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-surface-base/50 border-t border-surface-overlay flex items-center justify-between">
                    <p className="text-xs text-neutral-500 font-mono">
                        Showing {candidates.length} candidates
                        {selectedIds.length > 0 && (
                            <span className="text-primary-400 ml-2">
                                ({selectedIds.length} selected)
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Interview Schedule Modal */}
            <InterviewScheduleModal
                candidate={scheduleCandidate}
                isOpen={!!scheduleCandidate}
                onClose={() => setScheduleCandidate(null)}
                onSchedule={handleScheduleComplete}
            />
        </>
    );
}

export default CandidateRoster;
