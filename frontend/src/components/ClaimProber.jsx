import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSearch, Send, Shield, CheckCircle, AlertTriangle, ChevronRight, Sparkles } from 'lucide-react';
import { api } from '../utils/api';

/**
 * ClaimProber - Verifies resume claims during assessment
 * Presents AI-generated probing questions for each suspicious claim detected.
 */
export function ClaimProber({ candidateId, onComplete }) {
    const [status, setStatus] = useState('loading'); // loading, active, complete
    const [claims, setClaims] = useState([]);
    const [currentClaimIndex, setCurrentClaimIndex] = useState(0);
    const [answer, setAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [responses, setResponses] = useState([]);

    // Fetch claims on mount
    useEffect(() => {
        const fetchClaims = async () => {
            try {
                const response = await api.getClaimProbes(candidateId);
                if (response.data.success && response.data.claims.length > 0) {
                    // Only show high/medium priority claims
                    const priorityClaims = response.data.claims.filter(
                        c => c.confidence_flag === 'high' || c.confidence_flag === 'medium'
                    ).slice(0, 3); // Max 3 probes to avoid fatigue

                    if (priorityClaims.length > 0) {
                        setClaims(priorityClaims);
                        setStatus('active');
                    } else {
                        // No claims to verify, skip this step
                        onComplete();
                    }
                } else {
                    onComplete();
                }
            } catch (err) {
                console.error('Failed to fetch claims:', err);
                onComplete(); // Skip on error
            }
        };

        fetchClaims();
    }, [candidateId, onComplete]);

    const currentClaim = claims[currentClaimIndex];

    const handleSubmit = async () => {
        if (!answer.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const result = await api.submitClaimProbe(
                candidateId,
                currentClaim.claim_id,
                currentClaim.claim_text,
                currentClaim.verification_prompt,
                answer,
                currentClaim.claim_type
            );

            setResponses(prev => [...prev, {
                claim_id: currentClaim.claim_id,
                verified: result.data.verified,
                quality: result.data.response_quality
            }]);

            // Move to next claim or complete
            if (currentClaimIndex < claims.length - 1) {
                setCurrentClaimIndex(prev => prev + 1);
                setAnswer('');
            } else {
                setStatus('complete');
                setTimeout(() => {
                    onComplete();
                }, 2500);
            }
        } catch (err) {
            console.error('Failed to submit claim probe:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Skip button for optional claims
    const handleSkip = () => {
        if (currentClaimIndex < claims.length - 1) {
            setCurrentClaimIndex(prev => prev + 1);
            setAnswer('');
        } else {
            setStatus('complete');
            setTimeout(() => {
                onComplete();
            }, 1500);
        }
    };

    if (status === 'loading') {
        return (
            <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-xl w-full bg-surface-base border border-secondary-500/30 rounded-2xl p-12 text-center"
                >
                    <Sparkles className="text-secondary-400 animate-pulse mx-auto mb-6" size={48} />
                    <h3 className="text-white font-display font-bold uppercase tracking-wider mb-2">
                        Analyzing Resume Claims
                    </h3>
                    <p className="text-neutral-400 font-mono text-xs">
                        Preparing verification questions...
                    </p>
                </motion.div>
            </div>
        );
    }

    if (status === 'complete') {
        const verifiedCount = responses.filter(r => r.verified).length;
        return (
            <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-xl w-full bg-surface-base border border-success-500/30 rounded-2xl p-12 text-center"
                >
                    <CheckCircle className="text-success-400 mx-auto mb-6" size={56} />
                    <h3 className="text-white font-display font-bold text-xl uppercase tracking-wide mb-2">
                        Claims Verified
                    </h3>
                    <p className="text-neutral-400 font-mono text-sm mb-4">
                        {verifiedCount} of {claims.length} claims successfully verified
                    </p>
                    <div className="flex justify-center gap-2">
                        {responses.map((r, i) => (
                            <div
                                key={i}
                                className={`w-3 h-3 rounded-full ${r.verified ? 'bg-success-500' : 'bg-warning-500'}`}
                            />
                        ))}
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-2xl w-full bg-surface-base border border-secondary-500/30 rounded-2xl shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="bg-secondary-900/40 border-b border-secondary-500/20 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-secondary-500/20 rounded-full flex items-center justify-center border border-secondary-500/40">
                            <FileSearch className="text-secondary-400" size={18} />
                        </div>
                        <div>
                            <h3 className="text-white font-display font-bold text-sm tracking-tight uppercase">
                                Resume_Claim_Verification
                            </h3>
                            <p className="text-secondary-400/60 font-mono text-[10px] uppercase tracking-widest">
                                Claim {currentClaimIndex + 1} of {claims.length}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Shield className="text-secondary-400" size={14} />
                        <span className="text-secondary-400 font-mono text-[10px] font-bold uppercase">
                            Authenticity Check
                        </span>
                    </div>
                </div>

                <div className="p-8">
                    {/* Claim being verified */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle size={14} className="text-warning-400" />
                            <span className="text-[10px] font-mono text-warning-400 uppercase tracking-widest">
                                Claim from your resume
                            </span>
                        </div>
                        <div className="bg-warning-900/10 border border-warning-500/20 rounded-lg p-4">
                            <p className="text-neutral-200 font-mono text-sm">
                                "{currentClaim.claim_text}"
                            </p>
                            <p className="text-neutral-500 text-xs mt-2">
                                {currentClaim.context}
                            </p>
                        </div>
                    </div>

                    {/* Verification question */}
                    <div className="mb-6">
                        <h4 className="text-neutral-200 font-medium mb-3 text-sm">
                            {currentClaim.verification_prompt}
                        </h4>
                    </div>

                    {/* Answer input */}
                    <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Provide a detailed response to demonstrate your experience..."
                        className="w-full h-32 bg-surface-overlay border border-surface-overlay rounded-xl p-4 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-secondary-500/50 resize-none font-mono text-sm transition-all"
                        disabled={isSubmitting}
                    />

                    {/* Word count indicator */}
                    <div className="flex items-center justify-between mt-2 mb-6">
                        <span className={`text-[10px] font-mono ${answer.split(' ').filter(w => w).length >= 20 ? 'text-success-400' : 'text-neutral-500'}`}>
                            {answer.split(' ').filter(w => w).length} words
                            {answer.split(' ').filter(w => w).length < 20 && ' (aim for 20+)'}
                        </span>
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${currentClaim.confidence_flag === 'high' ? 'bg-danger-900/30 text-danger-400' : 'bg-warning-900/30 text-warning-400'}`}>
                            {currentClaim.confidence_flag} priority
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handleSkip}
                            className="text-neutral-500 hover:text-neutral-300 font-mono text-xs uppercase tracking-wider transition-colors"
                        >
                            Skip this claim
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!answer.trim() || isSubmitting}
                            className="flex items-center gap-2 px-6 py-3 bg-secondary-600 hover:bg-secondary-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                        >
                            {isSubmitting ? (
                                <span className="animate-pulse">Submitting...</span>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Submit Response
                                    <ChevronRight size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Progress dots */}
                <div className="bg-surface-overlay border-t border-surface-overlay px-6 py-3 flex items-center justify-center gap-2">
                    {claims.map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-all ${i < currentClaimIndex ? 'bg-success-500' :
                                    i === currentClaimIndex ? 'bg-secondary-500 scale-125' :
                                        'bg-neutral-600'
                                }`}
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
}

export default ClaimProber;
