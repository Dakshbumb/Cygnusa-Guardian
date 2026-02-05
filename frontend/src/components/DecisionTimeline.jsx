import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, FileText, Code, ShieldAlert,
    Brain, CheckCircle2, AlertCircle, ChevronDown,
    ChevronUp, Terminal, Clock
} from 'lucide-react';

/**
 * DecisionTimeline - A forensic scrubber showing the ranking evolution
 */
export function DecisionTimeline({ nodes = [] }) {
    const [selectedNode, setSelectedNode] = useState(null);

    if (!nodes || nodes.length === 0) return null;

    const nodeIcons = {
        RESUME: FileText,
        CODE: Code,
        INTEGRITY: ShieldAlert,
        MCQ: Brain,
        TEXT: Terminal,
        FINAL: CheckCircle2,
    };

    const impactColors = {
        positive: "text-success-400 border-success-500/50 bg-success-500/10",
        neutral: "text-primary-400 border-primary-500/50 bg-primary-500/10",
        negative: "text-danger-400 border-danger-500/50 bg-danger-500/10",
    };

    const sortedNodes = [...nodes].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return (
        <div className="bg-surface-elevated rounded-xl border border-surface-overlay overflow-hidden shadow-2xl mb-8">
            <div className="px-6 py-4 border-b border-surface-overlay bg-surface-base/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Activity className="text-secondary-400" size={18} />
                    <h3 className="font-bold text-neutral-200 uppercase tracking-widest text-sm font-mono">
                        Decision_Pivot_Timeline
                    </h3>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 uppercase">
                        <span className="w-2 h-2 rounded-full bg-success-500" /> Positive
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 uppercase">
                        <span className="w-2 h-2 rounded-full bg-primary-500" /> Neutral
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 uppercase">
                        <span className="w-2 h-2 rounded-full bg-danger-500" /> Negative
                    </div>
                </div>
            </div>

            <div className="p-8">
                {/* Scrollable Timeline Scrubber */}
                <div className="relative overflow-x-auto custom-scrollbar pb-6 flex items-center min-h-[140px]">
                    {/* Connecting Line */}
                    <div className="absolute top-[48px] left-0 right-0 h-0.5 bg-surface-overlay" />

                    <div className="flex gap-16 min-w-max px-8">
                        {sortedNodes.map((node, index) => {
                            const Icon = nodeIcons[node.node_type] || Activity;
                            const isSelected = selectedNode?.timestamp === node.timestamp;
                            const colorClass = impactColors[node.impact] || impactColors.neutral;

                            return (
                                <div key={index} className="relative flex flex-col items-center">
                                    {/* node circle */}
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setSelectedNode(isSelected ? null : node)}
                                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center z-10 transition-all ${isSelected ? 'ring-4 ring-primary-500/20 scale-110 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : ''
                                            } ${colorClass}`}
                                    >
                                        <Icon size={20} />
                                    </motion.button>

                                    {/* Node Label */}
                                    <div className="mt-4 text-center">
                                        <p className={`text-[10px] font-mono font-bold uppercase tracking-tighter ${isSelected ? 'text-white' : 'text-neutral-500'}`}>
                                            {node.node_type}
                                        </p>
                                        <p className="text-[9px] font-mono text-neutral-600 mt-0.5">
                                            {new Date(node.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>

                                    {/* Predicted Score Tooltip (Mini) */}
                                    {node.predicted_rank !== undefined && (
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-surface-base border border-surface-overlay rounded text-[9px] font-mono text-primary-400 font-bold whitespace-nowrap">
                                            RANK: {node.predicted_rank}%
                                        </div>
                                    )}

                                    {/* Selection Glow */}
                                    {isSelected && (
                                        <motion.div
                                            layoutId="node-glow"
                                            className="absolute -inset-2 bg-primary-500/5 rounded-2xl -z-0"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Detail Panel */}
                <AnimatePresence mode="wait">
                    {selectedNode ? (
                        <motion.div
                            key={selectedNode.timestamp}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-8 bg-surface-base border border-surface-overlay rounded-xl p-6 relative"
                        >
                            <div className="absolute top-4 right-6 flex items-center gap-2 text-[10px] font-mono text-neutral-600">
                                <Clock size={12} />
                                {new Date(selectedNode.timestamp).toLocaleString()}
                            </div>

                            <div className="flex gap-6">
                                <div className={`w-1.5 rounded-full ${selectedNode.impact === 'positive' ? 'bg-success-500' :
                                    selectedNode.impact === 'negative' ? 'bg-danger-500' : 'bg-primary-500'
                                    }`} />

                                <div className="space-y-4 flex-1">
                                    <h4 className="text-lg font-bold text-white flex items-center gap-3">
                                        {selectedNode.title}
                                        {selectedNode.predicted_rank !== undefined && (
                                            <span className="text-xs px-2 py-0.5 bg-primary-900/20 text-primary-400 border border-primary-500/30 rounded font-mono">
                                                +{selectedNode.predicted_rank}%
                                            </span>
                                        )}
                                    </h4>

                                    <p className="text-neutral-400 text-sm leading-relaxed max-w-2xl font-sans">
                                        {selectedNode.description}
                                    </p>

                                    <div className="flex items-center gap-8 pt-2">
                                        <div className="flex items-center gap-2">
                                            <Terminal size={14} className="text-secondary-400" />
                                            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Pivot_Evidence_ID:</span>
                                            <span className="text-[10px] font-mono text-secondary-300">{selectedNode.evidence_id || 'SYSTEM_AUTO'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Activity size={14} className="text-primary-400" />
                                            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Impact_Weight:</span>
                                            <span className={`text-[10px] font-mono font-bold uppercase ${selectedNode.impact === 'positive' ? 'text-success-400' :
                                                selectedNode.impact === 'negative' ? 'text-danger-400' : 'text-primary-400'
                                                }`}>{selectedNode.impact}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="mt-8 border border-dashed border-surface-overlay rounded-xl p-12 text-center opacity-40">
                            <Activity className="w-8 h-8 mx-auto mb-3 text-neutral-600" />
                            <p className="text-xs font-mono uppercase tracking-[0.2em]">Select a node to view forensic pivot data</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
