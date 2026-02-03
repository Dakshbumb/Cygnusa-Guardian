import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import {
    CheckCircle, XCircle, AlertTriangle,
    Clock, User, Briefcase, Shield,
    Loader
} from 'lucide-react';

/**
 * SharedReportPage - Public view for shared candidate reports
 */
export default function SharedReportPage() {
    const { shareToken } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const response = await api.getSharedReport(shareToken);
                setReport(response.data);
            } catch (err) {
                console.error('Failed to load shared report:', err);
                if (err.response?.status === 410) {
                    setError('This share link has expired.');
                } else if (err.response?.status === 404) {
                    setError('Invalid or expired share link.');
                } else {
                    setError('Failed to load report. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        };

        if (shareToken) {
            fetchReport();
        }
    }, [shareToken]);

    const getOutcomeConfig = (outcome) => {
        switch (outcome) {
            case 'HIRE':
                return {
                    icon: CheckCircle,
                    bgClass: 'bg-green-900/20',
                    borderClass: 'border-green-500',
                    textClass: 'text-green-400',
                    label: 'RECOMMENDED FOR HIRE'
                };
            case 'CONDITIONAL':
                return {
                    icon: AlertTriangle,
                    bgClass: 'bg-yellow-900/20',
                    borderClass: 'border-yellow-500',
                    textClass: 'text-yellow-400',
                    label: 'CONDITIONAL REVIEW'
                };
            default:
                return {
                    icon: XCircle,
                    bgClass: 'bg-red-900/20',
                    borderClass: 'border-red-500',
                    textClass: 'text-red-400',
                    label: 'NOT RECOMMENDED'
                };
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-base flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader size={48} className="animate-spin text-primary-400" />
                    <p className="text-neutral-400">Loading shared report...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-surface-base flex items-center justify-center">
                <div className="text-center p-8 bg-surface-elevated rounded-xl border border-danger-500/30">
                    <XCircle size={48} className="text-danger-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-neutral-100 mb-2">Unable to Load Report</h2>
                    <p className="text-neutral-400">{error}</p>
                </div>
            </div>
        );
    }

    if (!report) return null;

    const config = getOutcomeConfig(report.decision.outcome);
    const Icon = config.icon;

    return (
        <div className="min-h-screen bg-surface-base py-12 px-4">
            {/* Header */}
            <div className="max-w-4xl mx-auto mb-8">
                <div className="flex items-center gap-3 mb-6">
                    <Shield size={32} className="text-primary-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-100">Cygnusa Guardian</h1>
                        <p className="text-sm text-neutral-500">Candidate Assessment Report</p>
                    </div>
                </div>
            </div>

            {/* Main Report Card */}
            <div className="max-w-4xl mx-auto">
                <div className={`rounded-xl border-2 ${config.borderClass} bg-surface-elevated overflow-hidden`}>
                    {/* Candidate Info */}
                    <div className="px-8 py-6 border-b border-surface-overlay">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-surface-base flex items-center justify-center">
                                <User size={32} className="text-neutral-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-neutral-100">{report.candidate.name}</h2>
                                <div className="flex items-center gap-4 mt-1 text-sm text-neutral-400">
                                    <span className="flex items-center gap-1">
                                        <Briefcase size={14} />
                                        {report.candidate.job_title}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} />
                                        {new Date(report.candidate.completed_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Decision */}
                    <div className={`px-8 py-8 ${config.bgClass}`}>
                        <div className="flex items-center gap-4 mb-6">
                            <Icon size={48} className={config.textClass} />
                            <div>
                                <div className={`text-sm font-mono tracking-wider ${config.textClass} mb-1`}>
                                    FINAL_DECISION
                                </div>
                                <div className={`text-3xl font-bold ${config.textClass}`}>
                                    {config.label}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-neutral-400 text-sm">Confidence:</span>
                            <span className={`text-sm font-bold uppercase ${config.textClass}`}>
                                {report.decision.confidence}
                            </span>
                        </div>

                        <div className="text-neutral-300">
                            <strong className="text-neutral-100">Role Fit:</strong> {report.decision.role_fit}
                        </div>
                    </div>

                    {/* Reasoning */}
                    <div className="px-8 py-6 border-t border-surface-overlay">
                        <h3 className="text-lg font-bold text-neutral-100 mb-4">Decision Reasoning</h3>
                        <ul className="space-y-2">
                            {report.decision.reasoning.map((reason, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-neutral-300">
                                    <CheckCircle size={16} className="text-primary-400 mt-0.5 flex-shrink-0" />
                                    {reason}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Next Steps */}
                    <div className="px-8 py-6 border-t border-surface-overlay bg-surface-base">
                        <h3 className="text-lg font-bold text-neutral-100 mb-2">Recommended Next Steps</h3>
                        <p className="text-neutral-300">{report.decision.next_steps}</p>
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-4 border-t border-surface-overlay bg-surface-base/50 flex items-center justify-between text-xs text-neutral-500">
                        <span>Shared via Cygnusa Guardian</span>
                        <span>Expires: {new Date(report.expires_at).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
