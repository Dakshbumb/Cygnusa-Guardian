import React from 'react';
import { Shield, ChevronRight, Check, AlertTriangle, X } from 'lucide-react';

export function RankingCard({ result, onProceed }) {
    // result = { score: 87, match: 'HIGH', skills: [...], missing: [...], calculation: '...', multiRoleMatches: [...] }

    return (
        <div className="bg-surface-elevated border border-surface-overlay rounded-xl p-8 max-w-2xl mx-auto animate-fade-in-up">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-display font-bold text-white mb-2">Analysis Complete</h2>
                    <p className="text-neutral-400">Candidate ranked against <span className="text-primary-400">{result.targetRole}</span> profile.</p>
                </div>
                <div className="text-right">
                    <div className="text-4xl font-mono font-bold text-primary-400">{result.score}%</div>
                    <div className="text-xs font-mono text-primary-300/60 uppercase tracking-widest mb-1">Match Index</div>
                    {result.calculation && (
                        <div className="text-[10px] font-mono text-neutral-600 bg-surface-base px-1.5 py-0.5 rounded border border-surface-overlay">
                            {result.calculation}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Evidence Panel */}
                <div className="bg-surface-base/50 rounded-lg p-4 border border-surface-overlay">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-300 mb-4 uppercase tracking-wider">
                        <Check className="text-success-400" size={16} />
                        Verified Skills
                    </h3>
                    <ul className="space-y-2">
                        {result.skills.map((skill, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-neutral-400">
                                <span className="w-1.5 h-1.5 bg-success-500 rounded-full" />
                                {skill}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Missing Panel */}
                <div className="bg-surface-base/50 rounded-lg p-4 border border-surface-overlay">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-300 mb-4 uppercase tracking-wider">
                        <AlertTriangle className="text-warning-400" size={16} />
                        Missing / Gap
                    </h3>
                    <ul className="space-y-2">
                        {result.missing.map((item, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-neutral-400">
                                <span className="w-1.5 h-1.5 bg-warning-500 rounded-full" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Cross-Role Matching (P1 Enhancement) */}
            {result.multiRoleMatches?.length > 0 && (
                <div className="mb-8 border-t border-surface-overlay pt-6">
                    <h3 className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-widest mb-4">Cross-Role Intelligence Matching</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {result.multiRoleMatches.map((role, i) => (
                            <div key={i} className="p-3 bg-surface-base/30 border border-surface-overlay rounded-lg flex flex-col gap-1">
                                <span className="text-[10px] font-mono text-neutral-500 uppercase truncate">{role.title}</span>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm font-mono font-bold ${role.match_score >= 70 ? 'text-success-400' : role.match_score >= 40 ? 'text-warning-400' : 'text-danger-400'}`}>
                                        {Math.round(role.match_score)}%
                                    </span>
                                    <span className={`text-[9px] font-mono px-1 rounded ${role.status === 'HIGH_MATCH' ? 'bg-success-900/40 text-success-300' : 'bg-surface-elevated text-neutral-400'}`}>
                                        {role.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-surface-overlay">
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Shield size={16} />
                    <span>ID: REF-{Math.floor(Math.random() * 10000)}</span>
                </div>
                <button
                    onClick={onProceed}
                    className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-primary-500/20"
                >
                    <span>Proceed to Assessment</span>
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
