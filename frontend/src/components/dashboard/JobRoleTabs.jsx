import { useState, useMemo } from 'react';
import { Briefcase, Users, Clock } from 'lucide-react';

/**
 * JobRoleTabs - Tab navigation for job categories
 * Each tab shows count of pending candidates as a badge
 */
export function JobRoleTabs({ roles, roleSummary, activeRole, onRoleChange }) {
    // Add "All" tab at the beginning
    const allRoles = useMemo(() => ['All', ...(roles || [])], [roles]);

    // Calculate total pending for "All" tab
    const totalPending = useMemo(() => {
        if (!roleSummary) return 0;
        return Object.values(roleSummary).reduce((sum, r) => sum + (r.pending || 0), 0);
    }, [roleSummary]);

    return (
        <div className="relative">
            {/* Scrollable tabs container */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {allRoles.map((role) => {
                    const isActive = (role === 'All' && !activeRole) || role === activeRole;
                    const pendingCount = role === 'All'
                        ? totalPending
                        : roleSummary?.[role]?.pending || 0;
                    const totalCount = role === 'All'
                        ? Object.values(roleSummary || {}).reduce((s, r) => s + (r.total || 0), 0)
                        : roleSummary?.[role]?.total || 0;

                    return (
                        <button
                            key={role}
                            onClick={() => onRoleChange(role === 'All' ? null : role)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap
                                       transition-all duration-200 border
                                       ${isActive
                                    ? 'bg-primary-600 text-white border-primary-500 shadow-lg shadow-primary-900/30'
                                    : 'bg-surface-elevated text-neutral-400 border-surface-overlay hover:border-primary-500/30 hover:text-white'
                                }`}
                        >
                            <Briefcase size={16} className={isActive ? 'text-white' : 'text-primary-400'} />
                            <span>{role}</span>

                            {/* Total count badge */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono
                                            ${isActive ? 'bg-white/20' : 'bg-surface-overlay'}`}>
                                {totalCount}
                            </span>

                            {/* Pending count badge - only show if > 0 */}
                            {pendingCount > 0 && (
                                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono
                                                ${isActive
                                        ? 'bg-warning-500/30 text-warning-300'
                                        : 'bg-warning-900/30 text-warning-400'}`}>
                                    <Clock size={10} />
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Fade gradient for scroll indication */}
            <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-surface-base to-transparent pointer-events-none" />
        </div>
    );
}

/**
 * RoleSummaryCard - Summary stats for the selected role
 */
export function RoleSummaryCard({ role, candidates }) {
    const stats = useMemo(() => {
        if (!candidates || candidates.length === 0) {
            return { selected: 0, rejected: 0, pending: 0, avgScore: 0 };
        }

        const selected = candidates.filter(c => c.outcome === 'HIRE').length;
        const rejected = candidates.filter(c => c.outcome === 'NO_HIRE').length;
        const pending = candidates.filter(c => !c.outcome || c.outcome === 'PENDING' || c.outcome === 'CONDITIONAL').length;
        const avgScore = candidates.reduce((s, c) => s + (c.overall_score || 0), 0) / candidates.length;

        return { selected, rejected, pending, avgScore: avgScore.toFixed(1) };
    }, [candidates]);

    return (
        <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-mono text-neutral-400 uppercase tracking-widest">
                    {role || 'All Roles'} Summary
                </h3>
                <span className="text-xs font-mono text-neutral-500">
                    {candidates?.length || 0} candidates
                </span>
            </div>

            <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-2 rounded-lg bg-success-900/10 border border-success-500/20">
                    <p className="text-lg font-bold text-success-400">{stats.selected}</p>
                    <p className="text-[10px] font-mono text-success-400/70 uppercase">Selected</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-warning-900/10 border border-warning-500/20">
                    <p className="text-lg font-bold text-warning-400">{stats.pending}</p>
                    <p className="text-[10px] font-mono text-warning-400/70 uppercase">Pending</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-danger-500/10 border border-danger-500/20">
                    <p className="text-lg font-bold text-danger-400">{stats.rejected}</p>
                    <p className="text-[10px] font-mono text-danger-400/70 uppercase">Rejected</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-primary-900/10 border border-primary-500/20">
                    <p className="text-lg font-bold text-primary-400">{stats.avgScore}%</p>
                    <p className="text-[10px] font-mono text-primary-400/70 uppercase">Avg Score</p>
                </div>
            </div>
        </div>
    );
}

export default JobRoleTabs;
