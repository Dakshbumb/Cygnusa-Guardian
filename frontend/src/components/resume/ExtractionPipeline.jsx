import React, { useEffect, useState } from 'react';
import { Scan, Database, Brain, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../utils/api';

export function ExtractionPipeline({ file, selectedRole, onComplete, onError }) {
    const [step, setStep] = useState(0);
    const [logs, setLogs] = useState([]);
    const [failed, setFailed] = useState(false);

    const steps = [
        { label: 'VALIDATION_LAYER', icon: Scan, duration: 800 },
        { label: 'TEXT_EXTRACTION', icon: Database, duration: 1200 },
        { label: 'SKILL_MATCHING', icon: Brain, duration: 1000 },
        { label: 'RANKING_COMPLETE', icon: CheckCircle2, duration: 500 }
    ];

    useEffect(() => {
        let currentStep = 0;
        let analysisResult = null;

        const runStep = async () => {
            if (currentStep >= steps.length) {
                if (analysisResult) {
                    onComplete(analysisResult);
                }
                return;
            }

            setStep(currentStep);

            const newLog = `[${new Date().toLocaleTimeString()}] EXECUTING ${steps[currentStep].label}...`;
            setLogs(prev => [...prev.slice(-4), newLog]);

            // On step 2 (TEXT_EXTRACTION), make the real API call
            if (currentStep === 1 && file) {
                try {
                    const jdSkills = selectedRole?.required_skills?.join(',') || 'python,javascript,react';
                    const criticalSkills = selectedRole?.critical_skills?.join(',') || '';
                    const response = await api.analyzeResume(
                        file,
                        jdSkills,
                        'Candidate',
                        'candidate@example.com',
                        selectedRole?.title || 'Software Engineer'
                    );
                    analysisResult = response.data;
                    setLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] ANALYSIS COMPLETE: Candidate ${analysisResult.candidate_id}`]);
                } catch (err) {
                    setFailed(true);
                    // Better error message extraction
                    let errorMsg = 'Analysis failed';
                    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                        errorMsg = 'Request timeout - analysis may still be running';
                    } else if (err.response?.data?.detail?.message) {
                        errorMsg = err.response.data.detail.message;
                    } else if (err.response?.data?.detail) {
                        errorMsg = typeof err.response.data.detail === 'string'
                            ? err.response.data.detail
                            : JSON.stringify(err.response.data.detail);
                    } else if (err.message) {
                        errorMsg = err.message;
                    }
                    console.error('Resume analysis failed:', err.response?.data || err);
                    setLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] ERROR: ${errorMsg}`]);
                    if (onError) onError(err);
                    return;
                }
            }

            setTimeout(() => {
                currentStep++;
                runStep();
            }, steps[currentStep].duration);
        };

        runStep();
    }, []);

    return (
        <div className="bg-surface-elevated border border-surface-overlay rounded-xl p-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8 border-b border-surface-overlay pb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${failed ? 'bg-error-500' : 'bg-success-500'}`} />
                    <span className={`font-mono text-sm ${failed ? 'text-error-400' : 'text-success-400'}`}>
                        {failed ? 'PIPELINE_FAILED' : 'PROCESSING_PIPELINE_ACTIVE'}
                    </span>
                </div>
                <span className="font-mono text-neutral-500 text-xs">{file?.name?.toUpperCase()}</span>
            </div>

            <div className="flex justify-between relative mb-12">
                {/* Progress Line */}
                <div className="absolute top-6 left-0 w-full h-0.5 bg-surface-base -z-10" />
                <div
                    className={`absolute top-6 left-0 h-0.5 transition-all duration-500 -z-10 ${failed ? 'bg-error-500' : 'bg-primary-500'}`}
                    style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((s, i) => {
                    const isActive = i === step;
                    const isCompleted = i < step;
                    const Icon = failed && i === step ? XCircle : s.icon;

                    return (
                        <div key={i} className="flex flex-col items-center gap-3">
                            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${failed && i === step ? 'border-error-500 bg-surface-base text-error-400' :
                                isActive ? 'border-primary-500 bg-surface-base text-primary-400 scale-110 shadow-[0_0_20px_rgba(99,102,241,0.3)]' :
                                    isCompleted ? 'border-success-500 bg-surface-base text-success-400' :
                                        'border-neutral-700 bg-surface-elevated text-neutral-600'
                                }`}>
                                <Icon size={20} />
                            </div>
                            <span className={`text-xs font-mono transition-colors ${failed && i === step ? 'text-error-400 font-bold' :
                                isActive ? 'text-primary-400 font-bold' :
                                    isCompleted ? 'text-success-400' :
                                        'text-neutral-600'
                                }`}>
                                {s.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Terminal Output */}
            <div className="bg-surface-base rounded-lg p-4 font-mono text-xs h-32 overflow-hidden border border-surface-overlay">
                {logs.map((log, i) => (
                    <div key={i} className={`mb-1 animate-slide-in ${failed && i === logs.length - 1 ? 'text-error-400' : 'text-secondary-400'}`}>
                        <span className="text-neutral-600 mr-2">$</span>
                        {log}
                    </div>
                ))}
                {!failed && <div className="animate-pulse text-primary-500">_</div>}
            </div>
        </div>
    );
}
