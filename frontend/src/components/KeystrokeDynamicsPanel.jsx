import { Zap, ShieldAlert, Fingerprint, Activity, MousePointer2 } from 'lucide-react';

/**
 * KeystrokeDynamicsPanel - Displays Biometric DNA (typing rhythm) analysis
 */
export function KeystrokeDynamicsPanel({ candidate }) {
    const evidence = candidate.keystroke_evidence;

    if (!evidence) {
        return (
            <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Fingerprint size={18} className="text-neutral-500" />
                    <h3 className="font-bold text-neutral-400 uppercase tracking-wide text-sm font-mono">
                        Biometric_DNA_Pending
                    </h3>
                </div>
                <p className="text-neutral-500 text-xs font-mono">Establishment phase active. Waiting for 50 keystroke baseline.</p>
            </div>
        );
    }

    const { rhythm_score, is_anomaly, anomaly_reason, baseline_established } = evidence;

    // Determine color based on score
    const getScoreColor = (score) => {
        if (score >= 80) return 'text-success-400';
        if (score >= 60) return 'text-warning-400';
        return 'text-danger-400';
    };

    const getScoreBg = (score) => {
        if (score >= 80) return 'bg-success-400/10 border-success-500/30';
        if (score >= 60) return 'bg-warning-400/10 border-warning-500/30';
        return 'bg-danger-400/10 border-danger-500/30';
    };

    return (
        <div className={`bg-surface-elevated rounded-xl border p-6 transition-all duration-500 ${is_anomaly ? 'border-danger-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'border-surface-overlay'}`}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Fingerprint size={18} className={is_anomaly ? 'text-danger-400' : 'text-primary-400'} />
                    <h3 className="font-bold text-neutral-200 uppercase tracking-wide text-sm font-mono">
                        Biometric_Keystroke_DNA
                    </h3>
                </div>
                <div className={`px-2 py-1 rounded-[4px] border font-mono text-[9px] font-bold uppercase ${baseline_established ? 'bg-success-900/20 text-success-400 border-success-500/30' : 'bg-primary-900/20 text-primary-400 border-primary-500/30 animate-pulse'}`}>
                    {baseline_established ? 'BASELINE_LOCKED' : 'CALIBRATING...'}
                </div>
            </div>

            {/* Rhythm Score Gauge */}
            <div className="flex items-center gap-6 mb-8">
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="40"
                            cy="40"
                            r="36"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="text-surface-base"
                        />
                        <circle
                            cx="40"
                            cy="40"
                            r="36"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeDasharray={226}
                            strokeDashoffset={226 - (226 * rhythm_score) / 100}
                            className={`${getScoreColor(rhythm_score)} transition-all duration-1000 ease-out`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-xl font-bold font-mono ${getScoreColor(rhythm_score)}`}>{rhythm_score}%</span>
                        <span className="text-[7px] text-neutral-500 uppercase font-bold tracking-tighter">Consistency</span>
                    </div>
                </div>

                <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-neutral-500 uppercase">Status</span>
                        <span className={is_anomaly ? 'text-danger-400 font-bold' : 'text-success-400 font-bold'}>
                            {is_anomaly ? 'IDENTITY_RISK_DETECTED' : 'RHYTHM_VERIFIED'}
                        </span>
                    </div>
                    <div className="w-full bg-surface-base h-1 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ${getScoreColor(rhythm_score).replace('text-', 'bg-')}`}
                            style={{ width: `${rhythm_score}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-tight">
                        {baseline_established
                            ? "Current typing rhythm matches the established subject baseline."
                            : "Analyzing millisecond intervals to establish unique typing fingerprint."}
                    </p>
                </div>
            </div>

            {/* Alert Box for Anomaly */}
            {is_anomaly && (
                <div className={`p-4 rounded-lg border ${getScoreBg(rhythm_score)} animate-pulse`}>
                    <div className="flex items-start gap-3">
                        <ShieldAlert className="text-danger-400 shrink-0" size={16} />
                        <div>
                            <p className="text-[11px] font-bold text-danger-400 uppercase tracking-tight mb-1">Critical biometric shift</p>
                            <p className="text-[10px] text-neutral-300 leading-normal">
                                {anomaly_reason || "Significant deviation from baseline detected. Possible session handover or keyboard macro usage."}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!is_anomaly && rhythm_score < 70 && (
                <div className="flex items-center gap-2 p-3 bg-warning-900/10 border border-warning-500/20 rounded-lg">
                    <Zap className="text-warning-400" size={14} />
                    <p className="text-[10px] text-warning-400 font-medium">Unstable typing rhythm. Monitoring for shifts.</p>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-surface-base/50 p-2 rounded border border-surface-overlay/50">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Activity size={10} className="text-primary-500" />
                        <span className="text-[8px] font-mono text-neutral-500 uppercase">Sync_Rate</span>
                    </div>
                    <div className="text-xs font-bold text-neutral-300 font-mono">488ms AVG</div>
                </div>
                <div className="bg-surface-base/50 p-2 rounded border border-surface-overlay/50">
                    <div className="flex items-center gap-1.5 mb-1">
                        <MousePointer2 size={10} className="text-primary-500" />
                        <span className="text-[8px] font-mono text-neutral-500 uppercase">Input_Method</span>
                    </div>
                    <div className="text-xs font-bold text-neutral-300 font-mono text-ellipsis overflow-hidden">MAC_KEYBOARD</div>
                </div>
            </div>
        </div>
    );
}
