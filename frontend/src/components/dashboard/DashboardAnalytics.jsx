import { useState, useMemo } from 'react';
import {
    Users, UserCheck, UserX, Clock, TrendingUp, TrendingDown,
    AlertTriangle, BarChart3, Target, Activity
} from 'lucide-react';

/**
 * MetricCard - Individual stat card with trend indicator
 */
function MetricCard({ title, value, percentage, trend, color, icon: Icon, onClick }) {
    const colorClasses = {
        green: 'bg-success-900/20 border-success-500/30 text-success-400',
        red: 'bg-danger-500/20 border-danger-500/30 text-danger-400',
        yellow: 'bg-warning-500/20 border-warning-500/30 text-warning-400',
        blue: 'bg-primary-900/20 border-primary-500/30 text-primary-400',
        neutral: 'bg-surface-elevated border-surface-overlay text-neutral-300'
    };

    return (
        <div
            onClick={onClick}
            className={`p-6 rounded-xl border ${colorClasses[color]} cursor-pointer 
                       hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden`}
        >
            {/* Background glow */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity 
                            bg-gradient-to-br ${color === 'green' ? 'from-success-500' :
                    color === 'red' ? 'from-danger-500' :
                        color === 'yellow' ? 'from-warning-500' : 'from-primary-500'} to-transparent`} />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-lg ${color === 'neutral' ? 'bg-surface-overlay' : 'bg-black/20'}`}>
                        <Icon size={20} />
                    </div>
                    {trend !== undefined && (
                        <div className={`flex items-center gap-1 text-xs font-mono ${trend > 0 ? 'text-success-400' : trend < 0 ? 'text-danger-400' : 'text-neutral-500'
                            }`}>
                            {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : null}
                            <span>{trend > 0 ? '+' : ''}{trend}%</span>
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    <p className="text-3xl font-bold tracking-tight">{value}</p>
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">{title}</p>
                        {percentage !== undefined && (
                            <span className="text-xs font-mono opacity-70">{percentage}%</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * DashboardAnalytics - Main analytics metrics grid
 */
export function DashboardAnalytics({ metrics, onMetricClick }) {
    if (!metrics) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-surface-elevated rounded-xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Primary Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Candidates"
                    value={metrics.total_candidates}
                    icon={Users}
                    color="blue"
                    onClick={() => onMetricClick?.('all')}
                />
                <MetricCard
                    title="Selected"
                    value={metrics.selected?.count || 0}
                    percentage={metrics.selected?.percentage}
                    icon={UserCheck}
                    color="green"
                    onClick={() => onMetricClick?.('selected')}
                />
                <MetricCard
                    title="Rejected"
                    value={metrics.rejected?.count || 0}
                    percentage={metrics.rejected?.percentage}
                    icon={UserX}
                    color="red"
                    onClick={() => onMetricClick?.('rejected')}
                />
                <MetricCard
                    title="Pending Review"
                    value={metrics.pending?.count || 0}
                    percentage={metrics.pending?.percentage}
                    icon={Clock}
                    color="yellow"
                    onClick={() => onMetricClick?.('pending')}
                />
            </div>

            {/* Secondary Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                    title="Avg. Score"
                    value={`${metrics.avg_score || 0}%`}
                    icon={Target}
                    color="neutral"
                />
                <MetricCard
                    title="Completion Rate"
                    value={`${metrics.completion_rate || 0}%`}
                    icon={Activity}
                    color="neutral"
                />
                <MetricCard
                    title="Integrity Flags"
                    value={metrics.integrity_violations || 0}
                    icon={AlertTriangle}
                    color={metrics.integrity_violations > 10 ? 'red' : metrics.integrity_violations > 0 ? 'yellow' : 'neutral'}
                />
            </div>
        </div>
    );
}

export default DashboardAnalytics;
