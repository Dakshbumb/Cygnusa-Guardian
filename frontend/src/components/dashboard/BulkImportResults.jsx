import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Trophy, Star, AlertTriangle, CheckCircle, XCircle, ChevronDown,
    ChevronUp, User, Briefcase, GraduationCap, Clock, ArrowRight,
    Plus, Eye, X, FileText, Target
} from 'lucide-react';

/**
 * BulkImportResults - Display ranked candidates from bulk import
 * Shows scores, explanations, and quick actions
 */
export function BulkImportResults({ data, onClose, onAddToPipeline }) {
    const navigate = useNavigate();
    const [expandedId, setExpandedId] = useState(null);
    const [filter, setFilter] = useState('all'); // all, success, failed

    const { results = [], processed = 0, failed = 0, job_title, required_skills = [] } = data || {};

    const filteredResults = results.filter(r => {
        if (filter === 'success') return r.status === 'success';
        if (filter === 'failed') return r.status !== 'success';
        return true;
    });

    const getRankBadge = (rank, score) => {
        if (rank === 'HIGH_MATCH' || rank === 'MATCH' || score >= 70) {
            return (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-success-900/30 text-success-400 text-xs font-medium">
                    <Trophy size={12} /> Top Match
                </span>
            );
        }
        if (rank === 'POTENTIAL' || (score >= 50 && score < 70)) {
            return (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning-900/30 text-warning-400 text-xs font-medium">
                    <Star size={12} /> Potential
                </span>
            );
        }
        if (rank === 'REJECT' || score < 30) {
            return (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-danger-500/20 text-danger-400 text-xs font-medium">
                    <XCircle size={12} /> Reject
                </span>
            );
        }
        return (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-800 text-neutral-400 text-xs font-medium">
                <AlertTriangle size={12} /> Review
            </span>
        );
    };

    const getScoreColor = (score) => {
        if (score >= 70) return 'text-success-400';
        if (score >= 50) return 'text-warning-400';
        if (score >= 30) return 'text-orange-400';
        return 'text-danger-400';
    };

    const getScoreBgGradient = (score) => {
        if (score >= 70) return 'from-success-500 to-success-600';
        if (score >= 50) return 'from-warning-500 to-warning-600';
        if (score >= 30) return 'from-orange-500 to-orange-600';
        return 'from-danger-500 to-danger-600';
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-base border border-surface-overlay rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-surface-overlay">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-success-500/30 to-primary-500/30 flex items-center justify-center">
                                <Trophy className="text-primary-400" size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Import Results</h2>
                                <p className="text-sm text-neutral-400">
                                    {processed} analyzed • {failed > 0 && <span className="text-danger-400">{failed} failed</span>}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-neutral-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Summary Stats */}
                    <div className="mt-4 grid grid-cols-4 gap-3">
                        <div className="bg-surface-elevated rounded-lg px-3 py-2 border border-surface-overlay">
                            <p className="text-2xl font-bold text-white">{processed}</p>
                            <p className="text-xs text-neutral-500">Processed</p>
                        </div>
                        <div className="bg-surface-elevated rounded-lg px-3 py-2 border border-success-500/30">
                            <p className="text-2xl font-bold text-success-400">
                                {results.filter(r => r.score >= 70).length}
                            </p>
                            <p className="text-xs text-neutral-500">Top Matches</p>
                        </div>
                        <div className="bg-surface-elevated rounded-lg px-3 py-2 border border-warning-500/30">
                            <p className="text-2xl font-bold text-warning-400">
                                {results.filter(r => r.score >= 50 && r.score < 70).length}
                            </p>
                            <p className="text-xs text-neutral-500">Potential</p>
                        </div>
                        <div className="bg-surface-elevated rounded-lg px-3 py-2 border border-danger-500/30">
                            <p className="text-2xl font-bold text-danger-400">
                                {results.filter(r => r.score < 50 || r.status !== 'success').length}
                            </p>
                            <p className="text-xs text-neutral-500">Low/Failed</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="mt-4 flex items-center gap-2">
                        {['all', 'success', 'failed'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f
                                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                                    : 'bg-surface-elevated text-neutral-400 border border-surface-overlay hover:text-white'
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}

                        <div className="flex-1 flex items-center justify-end gap-2 text-xs text-neutral-500">
                            <Briefcase size={14} />
                            <span>{job_title}</span>
                            <span className="text-neutral-600">•</span>
                            <Target size={14} />
                            <span>{required_skills.length} skills</span>
                        </div>
                    </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredResults.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500">
                            No results to display
                        </div>
                    ) : (
                        filteredResults.map((result, index) => (
                            <div
                                key={result.candidate_id || index}
                                className={`bg-surface-elevated rounded-lg border transition-all ${result.status === 'success'
                                    ? 'border-surface-overlay hover:border-primary-500/30'
                                    : 'border-danger-500/30'
                                    }`}
                            >
                                {/* Main Row */}
                                <div
                                    className="flex items-center gap-4 px-4 py-3 cursor-pointer"
                                    onClick={() => setExpandedId(expandedId === result.candidate_id ? null : result.candidate_id)}
                                >
                                    {/* Position Badge */}
                                    {result.status === 'success' && (
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${result.position <= 3
                                            ? 'bg-gradient-to-br from-yellow-500/30 to-amber-500/30 text-yellow-400'
                                            : 'bg-surface-overlay text-neutral-400'
                                            }`}>
                                            {result.position || index + 1}
                                        </div>
                                    )}

                                    {result.status !== 'success' && (
                                        <div className="w-8 h-8 rounded-full bg-danger-500/20 flex items-center justify-center">
                                            <XCircle size={16} className="text-danger-400" />
                                        </div>
                                    )}

                                    {/* Candidate Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-white truncate">
                                                {result.name || result.filename}
                                            </p>
                                            {result.status === 'success' && getRankBadge(result.rank, result.score)}
                                        </div>
                                        <p className="text-xs text-neutral-500 truncate">
                                            {result.status === 'success'
                                                ? `${result.skills_matched?.length || 0} skills • ${result.experience_years || 0}+ years`
                                                : result.error || 'Processing failed'
                                            }
                                        </p>
                                    </div>

                                    {/* Score */}
                                    {result.status === 'success' && (
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className={`text-2xl font-bold ${getScoreColor(result.score)}`}>
                                                    {result.score?.toFixed(0)}%
                                                </p>
                                                <p className="text-xs text-neutral-500">Match</p>
                                            </div>

                                            {/* Mini progress bar */}
                                            <div className="w-16 h-2 bg-surface-base rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full bg-gradient-to-r ${getScoreBgGradient(result.score)}`}
                                                    style={{ width: `${result.score}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Expand Icon */}
                                    {result.status === 'success' && (
                                        <div className="text-neutral-500">
                                            {expandedId === result.candidate_id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    )}
                                </div>

                                {/* Expanded Details */}
                                {expandedId === result.candidate_id && result.status === 'success' && (
                                    <div className="px-4 pb-4 border-t border-surface-overlay mt-2 pt-4 space-y-4 animate-fade-in-down">
                                        {/* Reasoning */}
                                        <div>
                                            <p className="text-xs text-neutral-400 mb-1 uppercase tracking-wide">Analysis</p>
                                            <p className="text-sm text-neutral-300 leading-relaxed">
                                                {result.reasoning || result.justification || 'No detailed analysis available.'}
                                            </p>
                                        </div>

                                        {/* Skills Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Matched Skills */}
                                            <div>
                                                <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1">
                                                    <CheckCircle size={12} className="text-success-400" />
                                                    Skills Matched
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(result.skills_matched || []).map((skill, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-success-900/30 text-success-400 rounded text-xs">
                                                            {skill}
                                                        </span>
                                                    ))}
                                                    {(!result.skills_matched || result.skills_matched.length === 0) && (
                                                        <span className="text-xs text-neutral-500">None detected</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Missing Critical */}
                                            <div>
                                                <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1">
                                                    <AlertTriangle size={12} className="text-warning-400" />
                                                    Missing Critical
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(result.missing_critical || []).map((skill, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-danger-500/20 text-danger-400 rounded text-xs">
                                                            {skill}
                                                        </span>
                                                    ))}
                                                    {(!result.missing_critical || result.missing_critical.length === 0) && (
                                                        <span className="text-xs text-success-400">All critical skills present</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Meta Info */}
                                        <div className="flex items-center gap-4 text-xs text-neutral-500">
                                            {result.experience_years && (
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {result.experience_years}+ years exp
                                                </span>
                                            )}
                                            {result.education && (
                                                <span className="flex items-center gap-1">
                                                    <GraduationCap size={12} />
                                                    {result.education}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <FileText size={12} />
                                                {result.filename}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 pt-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddToPipeline?.(result.candidate_id);
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 transition-colors"
                                            >
                                                <Plus size={14} />
                                                Add to Pipeline
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/recruiter/bulk/${result.candidate_id}`);
                                                    onClose?.();
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-overlay text-neutral-300 text-xs font-medium hover:text-white transition-colors"
                                            >
                                                <Eye size={14} />
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-surface-overlay flex items-center justify-between">
                    <p className="text-sm text-neutral-500">
                        Showing {filteredResults.length} of {results.length} candidates
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                // Add all top matches to pipeline
                                const topMatches = results.filter(r => r.status === 'success' && r.score >= 70);
                                topMatches.forEach(r => onAddToPipeline?.(r.candidate_id));
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success-900/30 text-success-400 text-sm font-medium border border-success-500/30 hover:bg-success-900/50 transition-colors"
                        >
                            <Plus size={16} />
                            Add All Top Matches
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BulkImportResults;
