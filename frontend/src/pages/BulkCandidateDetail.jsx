import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, FileText, User, Briefcase, GraduationCap, Clock,
    CheckCircle, XCircle, AlertTriangle, Star, Target, Award,
    TrendingUp, TrendingDown, Minus, RefreshCw, Download, Share2
} from 'lucide-react';
import { api } from '../utils/api';

/**
 * BulkCandidateDetail - Resume-only detailed view for bulk imported candidates
 * Shows skills analysis, experience, education without assessment data
 */
export function BulkCandidateDetail() {
    const { candidateId } = useParams();
    const navigate = useNavigate();
    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadCandidate();
    }, [candidateId]);

    const loadCandidate = async () => {
        try {
            setLoading(true);
            const res = await api.getCandidate(candidateId);
            if (res.data) {
                setCandidate(res.data);
            }
        } catch (err) {
            console.error('Failed to load candidate:', err);
            setError('Failed to load candidate details');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-base flex items-center justify-center">
                <div className="flex items-center gap-3 text-primary-400">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span className="font-mono text-sm">Loading candidate...</span>
                </div>
            </div>
        );
    }

    if (error || !candidate) {
        return (
            <div className="min-h-screen bg-surface-base flex items-center justify-center">
                <div className="text-center">
                    <XCircle className="w-12 h-12 text-danger-400 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-white mb-2">Candidate Not Found</h2>
                    <p className="text-neutral-400 mb-4">{error || 'Unable to load candidate details'}</p>
                    <button
                        onClick={() => navigate('/recruiter/dashboard')}
                        className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const evidence = candidate.resume_evidence || {};
    const matchScore = evidence.match_score || 0;
    const skillsMatched = evidence.skills_extracted || [];
    const skillsRequired = evidence.jd_required || [];
    const missingCritical = evidence.missing_critical || [];
    const experienceYears = evidence.experience_years || 0;
    const education = evidence.education || 'Not specified';
    const reasoning = evidence.reasoning || 'No detailed analysis available.';
    const matchCalculation = evidence.match_calculation || '';

    const getScoreColor = (score) => {
        if (score >= 70) return 'text-success-400';
        if (score >= 50) return 'text-warning-400';
        if (score >= 30) return 'text-orange-400';
        return 'text-danger-400';
    };

    const getScoreBg = (score) => {
        if (score >= 70) return 'from-success-500/20 to-success-600/10 border-success-500/30';
        if (score >= 50) return 'from-warning-500/20 to-warning-600/10 border-warning-500/30';
        if (score >= 30) return 'from-orange-500/20 to-orange-600/10 border-orange-500/30';
        return 'from-danger-500/20 to-danger-600/10 border-danger-500/30';
    };

    const getRankLabel = (score) => {
        if (score >= 70) return { label: 'Top Match', icon: Star, color: 'text-success-400' };
        if (score >= 50) return { label: 'Potential', icon: TrendingUp, color: 'text-warning-400' };
        if (score >= 30) return { label: 'Review Needed', icon: Minus, color: 'text-orange-400' };
        return { label: 'Not Recommended', icon: TrendingDown, color: 'text-danger-400' };
    };

    const rank = getRankLabel(matchScore);
    const RankIcon = rank.icon;

    // Calculate missing skills (required but not found)
    const missingSkills = skillsRequired.filter(s =>
        !skillsMatched.some(m => m.toLowerCase() === s.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-surface-base">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-surface-base/80 backdrop-blur-lg border-b border-surface-overlay">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/recruiter/dashboard')}
                                className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={20} />
                                <span className="text-sm">Back to Dashboard</span>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-primary-900/30 text-primary-400 text-xs font-mono rounded border border-primary-500/30">
                                Resume Analysis
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                {/* Candidate Header Card */}
                <section className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500/30 to-accent-500/20 flex items-center justify-center">
                                <User size={28} className="text-primary-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">{candidate.name}</h1>
                                <p className="text-neutral-400">{candidate.email}</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="flex items-center gap-1 text-sm text-neutral-500">
                                        <Briefcase size={14} />
                                        {candidate.job_title || 'Software Engineer'}
                                    </span>
                                    <span className="flex items-center gap-1 text-sm text-neutral-500">
                                        <Clock size={14} />
                                        {experienceYears}+ years
                                    </span>
                                    <span className="flex items-center gap-1 text-sm text-neutral-500">
                                        <GraduationCap size={14} />
                                        {education}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Score Card */}
                        <div className={`px-6 py-4 rounded-xl bg-gradient-to-br border ${getScoreBg(matchScore)}`}>
                            <div className="text-center">
                                <p className={`text-4xl font-bold ${getScoreColor(matchScore)}`}>
                                    {matchScore.toFixed(0)}%
                                </p>
                                <p className="text-xs text-neutral-400 mt-1">Match Score</p>
                                <div className={`flex items-center justify-center gap-1 mt-2 ${rank.color}`}>
                                    <RankIcon size={14} />
                                    <span className="text-xs font-medium">{rank.label}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Analysis Reasoning */}
                <section className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Target size={20} className="text-primary-400" />
                        AI Analysis Summary
                    </h2>
                    <p className="text-neutral-300 leading-relaxed">{reasoning}</p>
                    {matchCalculation && (
                        <p className="text-sm text-neutral-500 mt-3 font-mono">{matchCalculation}</p>
                    )}
                </section>

                {/* Skills Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Skills Found */}
                    <section className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <CheckCircle size={20} className="text-success-400" />
                            Skills Found
                            <span className="ml-auto text-sm text-neutral-500 font-normal">
                                {skillsMatched.length} skills
                            </span>
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {skillsMatched.length > 0 ? (
                                skillsMatched.map((skill, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1.5 bg-success-900/30 text-success-400 rounded-lg text-sm border border-success-500/20"
                                    >
                                        {skill}
                                    </span>
                                ))
                            ) : (
                                <p className="text-neutral-500 text-sm">No matching skills detected</p>
                            )}
                        </div>
                    </section>

                    {/* Missing Skills */}
                    <section className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <XCircle size={20} className="text-danger-400" />
                            Missing Skills
                            <span className="ml-auto text-sm text-neutral-500 font-normal">
                                {missingSkills.length} missing
                            </span>
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {missingSkills.length > 0 ? (
                                missingSkills.map((skill, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1.5 bg-neutral-800 text-neutral-400 rounded-lg text-sm border border-neutral-700"
                                    >
                                        {skill}
                                    </span>
                                ))
                            ) : (
                                <p className="text-success-400 text-sm">All required skills present!</p>
                            )}
                        </div>
                    </section>
                </div>

                {/* Critical Skills Alert */}
                {missingCritical.length > 0 && (
                    <section className="bg-danger-500/10 rounded-xl border border-danger-500/30 p-6">
                        <h2 className="text-lg font-semibold text-danger-400 mb-4 flex items-center gap-2">
                            <AlertTriangle size={20} />
                            Missing Critical Skills
                        </h2>
                        <p className="text-neutral-300 text-sm mb-4">
                            These skills were marked as must-have for the role but were not found in the resume:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {missingCritical.map((skill, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1.5 bg-danger-500/20 text-danger-400 rounded-lg text-sm border border-danger-500/30 font-medium"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* Required Skills Reference */}
                <section className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Award size={20} className="text-primary-400" />
                        Job Requirements Reference
                    </h2>
                    <p className="text-sm text-neutral-400 mb-4">
                        Skills specified in the job description for matching:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {skillsRequired.length > 0 ? (
                            skillsRequired.map((skill, i) => {
                                const isMatched = skillsMatched.some(m =>
                                    m.toLowerCase() === skill.toLowerCase()
                                );
                                const isCriticalMissing = missingCritical.some(m =>
                                    m.toLowerCase() === skill.toLowerCase()
                                );

                                return (
                                    <span
                                        key={i}
                                        className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-1.5 ${isMatched
                                                ? 'bg-success-900/30 text-success-400 border-success-500/20'
                                                : isCriticalMissing
                                                    ? 'bg-danger-500/20 text-danger-400 border-danger-500/30'
                                                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                            }`}
                                    >
                                        {isMatched ? (
                                            <CheckCircle size={12} />
                                        ) : isCriticalMissing ? (
                                            <AlertTriangle size={12} />
                                        ) : (
                                            <XCircle size={12} />
                                        )}
                                        {skill}
                                    </span>
                                );
                            })
                        ) : (
                            <p className="text-neutral-500 text-sm">No specific skills required</p>
                        )}
                    </div>
                </section>

                {/* Action Buttons */}
                <section className="flex items-center justify-between pt-4">
                    <button
                        onClick={() => navigate('/recruiter/dashboard')}
                        className="flex items-center gap-2 px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Back to Dashboard
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/recruiter/${candidateId}`)}
                            className="flex items-center gap-2 px-4 py-2 bg-surface-overlay text-neutral-300 rounded-lg hover:text-white transition-colors"
                        >
                            <FileText size={18} />
                            Full Profile
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default BulkCandidateDetail;
