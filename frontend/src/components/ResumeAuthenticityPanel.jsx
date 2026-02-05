import { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ResumeAuthenticityPanel - Displays resume claim verification status
 * Part of the Claim Probing Engine for detecting resume fraud
 */
export function ResumeAuthenticityPanel({ candidate, candidateId }) {
    const [expanded, setExpanded] = useState(false);
    const [authenticityData, setAuthenticityData] = useState(null);

    // Calculate authenticity data from candidate evidence
    useEffect(() => {
        if (!candidate?.resume_evidence?.suspicious_claims) {
            setAuthenticityData(null);
            return;
        }

        const claims = candidate.resume_evidence.suspicious_claims;
        const verified = claims.filter(c => c.verified === true).length;
        const failed = claims.filter(c => c.verified === false).length;
        const pending = claims.filter(c => c.verified === null || c.verified === undefined).length;

        // Calculate score
        const baseScore = 70;
        const verifiedBonus = claims.length > 0 ? (verified / claims.length) * 30 : 30;
        const failedPenalty = claims.length > 0 ? (failed / claims.length) * 40 : 0;
        const overallScore = Math.max(0, Math.min(100, Math.round(baseScore + verifiedBonus - failedPenalty)));

        // Identify red flags
        const redFlags = claims
            .filter(c => c.verified === false && c.confidence_flag === 'high')
            .map(c => c.claim_text);

        setAuthenticityData({
            overallScore,
            claimsDetected: claims.length,
            claimsVerified: verified,
            claimsFailed: failed,
            claimsPending: pending,
            redFlags,
            claims
        });
    }, [candidate]);

    if (!authenticityData || authenticityData.claimsDetected === 0) {
        return (
            <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Shield size={20} className="text-success-400" />
                    <h3 className="font-bold text-neutral-200 uppercase tracking-wide text-sm font-mono">
                        Resume_Authenticity
                    </h3>
                </div>
                <div className="text-center py-6 text-neutral-500 font-mono text-xs">
                    No verifiable claims detected in resume
                </div>
            </div>
        );
    }

    const scoreColor = authenticityData.overallScore >= 70 ? 'success' :
        authenticityData.overallScore >= 50 ? 'warning' : 'danger';

    const getStatusIcon = (claim) => {
        if (claim.verified === true) return <CheckCircle size={14} className="text-success-400" />;
        if (claim.verified === false) return <XCircle size={14} className="text-danger-400" />;
        return <Clock size={14} className="text-neutral-500" />;
    };

    const getStatusLabel = (claim) => {
        if (claim.verified === true) return 'Verified';
        if (claim.verified === false) return 'Failed';
        return 'Pending';
    };

    return (
        <div className="bg-surface-elevated rounded-xl border border-surface-overlay overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-surface-overlay bg-surface-base/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield size={18} className={`text-${scoreColor}-400`} />
                    <h3 className="font-bold text-neutral-200 uppercase tracking-wide text-sm font-mono">
                        Resume_Authenticity
                    </h3>
                </div>
                <div className={`px-3 py-1 rounded-lg bg-${scoreColor}-900/20 border border-${scoreColor}-500/30`}>
                    <span className={`font-mono font-bold text-${scoreColor}-400 text-lg`}>
                        {authenticityData.overallScore}%
                    </span>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="p-6">
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-neutral-200 font-mono">
                            {authenticityData.claimsDetected}
                        </div>
                        <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">
                            Claims
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-success-400 font-mono">
                            {authenticityData.claimsVerified}
                        </div>
                        <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">
                            Verified
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-danger-400 font-mono">
                            {authenticityData.claimsFailed}
                        </div>
                        <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">
                            Failed
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-neutral-500 font-mono">
                            {authenticityData.claimsPending}
                        </div>
                        <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">
                            Pending
                        </div>
                    </div>
                </div>

                {/* Red Flags */}
                {authenticityData.redFlags.length > 0 && (
                    <div className="mb-6 p-3 bg-danger-900/10 border border-danger-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={14} className="text-danger-400" />
                            <span className="text-xs font-mono text-danger-400 uppercase tracking-widest">
                                Red Flags Detected
                            </span>
                        </div>
                        <ul className="space-y-1">
                            {authenticityData.redFlags.map((flag, i) => (
                                <li key={i} className="text-xs text-danger-300 font-mono pl-4">
                                    • {flag.substring(0, 60)}...
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Expand/Collapse Claims */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-surface-base border border-surface-overlay rounded-lg hover:bg-surface-overlay transition-colors"
                >
                    <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
                        View All Claims ({authenticityData.claimsDetected})
                    </span>
                    {expanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
                </button>

                {/* Claims Table */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-4 border border-surface-overlay rounded-lg overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-surface-base border-b border-surface-overlay">
                                            <th className="px-4 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                                Claim
                                            </th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                                Risk
                                            </th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-overlay">
                                        {authenticityData.claims.map((claim, i) => (
                                            <tr key={i} className="hover:bg-surface-base/50 transition-colors">
                                                <td className="px-4 py-3 text-xs text-neutral-300 max-w-[200px] truncate">
                                                    {claim.claim_text}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[10px] font-mono text-neutral-400 uppercase">
                                                        {claim.claim_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${claim.confidence_flag === 'high' ? 'bg-danger-900/30 text-danger-400 border border-danger-500/30' :
                                                        claim.confidence_flag === 'medium' ? 'bg-warning-900/30 text-warning-400 border border-warning-500/30' :
                                                            'bg-neutral-900/30 text-neutral-400 border border-neutral-500/30'
                                                        }`}>
                                                        {claim.confidence_flag}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {getStatusIcon(claim)}
                                                        <span className={`text-[10px] font-mono ${claim.verified === true ? 'text-success-400' :
                                                            claim.verified === false ? 'text-danger-400' : 'text-neutral-500'
                                                            }`}>
                                                            {getStatusLabel(claim)}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default ResumeAuthenticityPanel;
