import { useState } from 'react';
import { ChevronDown, ChevronUp, Code, FileJson, AlertCircle, Terminal, Database } from 'lucide-react';

/**
 * AuditTrail - Full transparency view of AI decision making
 * Shows the exact prompt sent to AI and raw response
 */
export function AuditTrail({ auditTrail }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState('prompt');

    if (!auditTrail) return null;

    const formatJson = (str) => {
        try {
            return JSON.stringify(JSON.parse(str), null, 2);
        } catch {
            return str;
        }
    };

    return (
        <div className="bg-surface-elevated rounded-b-xl overflow-hidden">
            {/* Header - Always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-base/50 transition-colors group border-t border-surface-overlay"
            >
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-surface-base border border-surface-overlay rounded-lg group-hover:border-primary-500/50 transition-colors">
                        <Terminal size={18} className="text-secondary-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-neutral-200 text-sm font-mono tracking-wide uppercase">
                            Decision_Audit_Trail
                        </h3>
                        <p className="text-neutral-500 text-xs font-mono mt-0.5">
                            Full transparency protocols enabled
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-surface-base border border-surface-overlay rounded text-[10px] font-mono text-neutral-400">
                        MODEL: <span className="text-primary-400">{auditTrail.model_used}</span>
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
                </div>
            </button>

            {/* Expandable Content */}
            {isExpanded && (
                <div className="border-t border-surface-overlay bg-surface-base/30 animate-fade-in-down">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-surface-overlay">
                        {[
                            { id: 'prompt', label: 'SYSTEM_PROMPT', icon: FileJson },
                            { id: 'response', label: 'RAW_OUTPUT', icon: Code },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 text-xs font-mono font-bold tracking-wider transition-colors border-r border-surface-overlay ${activeTab === tab.id
                                    ? 'text-primary-400 bg-surface-base border-b-2 border-b-primary-500'
                                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-surface-overlay'
                                    }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {auditTrail.auto_rules_applied && (
                            <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-warning-900/10 border border-warning-500/30 rounded text-warning-400 text-xs font-mono">
                                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong className="block mb-1">AUTO_RULE_TRIGGERED:</strong>
                                    This decision was calculated via deterministic logic gates, bypassing neural inference.
                                </div>
                            </div>
                        )}

                        {activeTab === 'prompt' && (
                            <div>
                                <p className="text-xs font-mono text-neutral-500 mb-2 uppercase tracking-wide">
                                    // INCOMING_PAYLOAD_TO_NEURAL_ENGINE
                                </p>
                                <div className="relative group">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="px-2 py-1 bg-surface-elevated rounded text-[10px] text-neutral-400 border border-surface-overlay">READ_ONLY</div>
                                    </div>
                                    <pre className="bg-surface-base border border-surface-overlay text-neutral-300 p-4 rounded text-xs overflow-x-auto max-h-96 whitespace-pre-wrap font-mono custom-scrollbar selection:bg-primary-900 selection:text-white">
                                        {auditTrail.prompt}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {activeTab === 'response' && (
                            <div>
                                <p className="text-xs font-mono text-neutral-500 mb-2 uppercase tracking-wide">
                                    // RAW_INFERENCE_OUTPUT
                                </p>
                                <pre className="bg-surface-base border border-surface-overlay text-success-400 p-4 rounded text-xs overflow-x-auto max-h-96 font-mono custom-scrollbar">
                                    {formatJson(auditTrail.raw_response)}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 bg-surface-base border-t border-surface-overlay text-[10px] font-mono text-neutral-500 flex items-center justify-between">
                        <span>
                            TIMESTAMP: {new Date().toLocaleString()}
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse" />
                            <Database size={12} />
                            LOG_IMMUTABLE_STORED
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AuditTrail;
