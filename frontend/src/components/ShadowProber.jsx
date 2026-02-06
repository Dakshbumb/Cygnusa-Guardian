import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ShieldAlert, Send, BrainCircuit, Sparkles, Terminal } from 'lucide-react';
import { api } from '../utils/api';

/**
 * ShadowProber - The AI "Interviewer" that probes for deep understanding
 * Triggered after a coding question is submitted to verify implementation choices.
 */
export function ShadowProber({ candidateId, questionId, code, onComplete }) {
    const [status, setStatus] = useState('generating'); // generating, active, submitted
    const [probe, setProbe] = useState(null);
    const [answer, setAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Pool of varied fallback probes for when API is unavailable
        const fallbackProbes = [
            { question: "Walk me through your reasoning for choosing this particular algorithm. What alternatives did you consider?", target_concept: "Algorithm Selection" },
            { question: "What is the time and space complexity of your solution? How did you derive that?", target_concept: "Big O Complexity" },
            { question: "How would your solution handle edge cases like empty input or very large datasets?", target_concept: "Edge Case Handling" },
            { question: "If you had to optimize this solution for memory usage, what would you change?", target_concept: "Memory Optimization" },
            { question: "What data structure did you choose here and why was it the best fit for this problem?", target_concept: "Data Structures" },
            { question: "How would you refactor this code to make it more maintainable and testable?", target_concept: "Code Design" },
            { question: "What potential bugs or failure modes could occur in your implementation?", target_concept: "Error Handling" },
            { question: "Explain the core logic of your solution in simple terms, as if teaching a junior developer.", target_concept: "Communication" },
        ];

        const fetchProbe = async () => {
            try {
                const response = await api.generateProbe(candidateId, questionId, code);
                if (response.data.success) {
                    setProbe(response.data.shadow_probe);
                    setStatus('active');
                }
            } catch (err) {
                console.error('Failed to generate shadow probe:', err);
                // Select varied fallback based on questionId hash + random factor
                const hashCode = (str) => str.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
                const index = Math.abs(hashCode(questionId + Date.now().toString().slice(-3))) % fallbackProbes.length;
                setProbe(fallbackProbes[index]);
                setStatus('active');
            }
        };

        fetchProbe();
    }, [candidateId, questionId, code]);


    const handleSubmit = async () => {
        if (!answer.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await api.submitProbe(
                candidateId,
                questionId,
                probe.question,
                answer,
                probe.target_concept
            );
            setStatus('submitted');
            setTimeout(() => {
                onComplete();
            }, 2000);
        } catch (err) {
            console.error('Failed to submit probe response:', err);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-xl w-full bg-surface-base border border-primary-500/30 rounded-2xl shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="bg-primary-900/40 border-b border-primary-500/20 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center border border-primary-500/40">
                            <BrainCircuit className="text-primary-400" size={18} />
                        </div>
                        <div>
                            <h3 className="text-white font-display font-bold text-sm tracking-tight uppercase">SHADOW_DEEP_PROVE</h3>
                            <p className="text-primary-400/60 font-mono text-[10px] uppercase tracking-widest">Environment: Real-time Analysis</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                        <span className="text-primary-400 font-mono text-[10px] font-bold uppercase tracking-tighter">AI_ACTIVE</span>
                    </div>
                </div>

                <div className="p-8">
                    <AnimatePresence mode="wait">
                        {status === 'generating' ? (
                            <motion.div
                                key="generating"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-12 text-center"
                            >
                                <div className="relative mb-8">
                                    <Sparkles className="text-primary-400 animate-pulse" size={48} />
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-[-10px] border-2 border-dashed border-primary-500/20 rounded-full"
                                    />
                                </div>
                                <h4 className="text-xl font-display font-bold text-white mb-2 uppercase italic tracking-tighter text-shadow-glow">Analyzing Implementation...</h4>
                                <p className="text-neutral-500 text-sm font-mono max-w-xs mx-auto">Shadow Engine is identifying specific logic patterns in your code for follow-up verification.</p>
                            </motion.div>
                        ) : status === 'active' ? (
                            <motion.div
                                key="active"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-6"
                            >
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-10 h-10 bg-surface-elevated rounded-xl flex items-center justify-center border border-surface-overlay mt-1">
                                        <MessageSquare className="text-primary-400" size={20} />
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="bg-surface-elevated p-5 rounded-2xl rounded-tl-none border border-surface-overlay relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <BrainCircuit size={40} className="text-primary-500" />
                                            </div>
                                            <p className="text-neutral-200 text-base leading-relaxed font-medium">
                                                {probe?.question}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 pl-2">
                                            <ShieldAlert className="text-warning-500" size={12} />
                                            <span className="text-neutral-500 text-[10px] font-mono uppercase tracking-widest">PROBE_TARGET: {probe?.target_concept}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="relative">
                                        <textarea
                                            value={answer}
                                            onChange={(e) => setAnswer(e.target.value)}
                                            placeholder="Provide a detailed technical explanation..."
                                            className="w-full bg-surface-elevated border border-surface-overlay rounded-xl p-5 text-neutral-200 text-sm min-h-[140px] focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-all resize-none shadow-inner"
                                        />
                                        <div className="absolute bottom-4 right-4 text-[10px] font-mono text-neutral-600">
                                            SECURE_TEXT_STREAM
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSubmit}
                                        disabled={!answer.trim() || isSubmitting}
                                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-mono text-sm font-bold uppercase tracking-widest transition-all ${!answer.trim() || isSubmitting
                                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                                            : 'bg-primary-600 text-white hover:bg-primary-500 shadow-lg shadow-primary-900/50 border border-primary-500 hover:scale-[1.01]'
                                            }`}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>TRANSMITTING...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} />
                                                <span>SUBMIT_VERIFICATION</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="submitted"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center py-12 text-center"
                            >
                                <div className="w-16 h-16 bg-success-500/20 rounded-full flex items-center justify-center border border-success-500/40 mb-6">
                                    <Terminal className="text-success-400" size={32} />
                                </div>
                                <h4 className="text-2xl font-display font-bold text-white mb-2 uppercase tracking-tight">RESPONSE_BUFFERED</h4>
                                <p className="text-neutral-500 text-sm font-mono uppercase tracking-[0.2em] animate-pulse">Proceeding to next assessment node</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
