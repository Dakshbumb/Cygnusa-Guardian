import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { ResumeUploadZone } from '../components/resume/ResumeUploadZone';
import { ExtractionPipeline } from '../components/resume/ExtractionPipeline';
import { RankingCard } from '../components/resume/RankingCard';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export function ResumeAnalysisPage() {
    const navigate = useNavigate();
    const [view, setView] = useState('upload'); // upload, processing, ranking, error
    const [file, setFile] = useState(null);
    const [result, setResult] = useState(null);
    const [candidateId, setCandidateId] = useState(null);
    const [error, setError] = useState(null);

    const handleUpload = (file) => {
        setFile(file);
        setError(null);
        setView('processing');
    };

    const handleProcessingComplete = (apiResult) => {
        // Real data from /api/resume/analyze
        setCandidateId(apiResult.candidate_id);
        setResult({
            score: Math.round(apiResult.evidence?.score || 0),
            match: apiResult.rank,
            skills: apiResult.evidence?.skills_found || [],
            missing: apiResult.evidence?.missing_critical || [],
            reasoning: apiResult.evidence?.reasoning,
            justification: apiResult.justification,
            calculation: apiResult.evidence?.match_calculation,
            multiRoleMatches: apiResult.multi_role_matches || []
        });
        setView('ranking');
    };

    const handleProcessingError = (err) => {
        setError(err.response?.data?.detail?.message || 'Failed to analyze resume');
        setView('error');
    };

    const handleProceed = () => {
        // Navigate directly to the candidate assessment page
        if (candidateId) {
            navigate(`/candidate/${candidateId}`);
        } else {
            // Fallback to dashboard
            navigate('/');
        }
    };

    const handleRetry = () => {
        setFile(null);
        setResult(null);
        setCandidateId(null);
        setError(null);
        setView('upload');
    };

    return (
        <div className="min-h-screen bg-surface-base flex flex-col">
            <Header />
            <div className="flex-1 px-6 pb-20 pt-8">
                <div className="max-w-4xl mx-auto">
                    {/* Back Navigation */}
                    <button
                        onClick={() => navigate('/')}
                        className="mb-12 flex items-center gap-2 text-neutral-500 hover:text-white transition-colors font-mono text-xs uppercase tracking-widest group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span>[ Back to Command ]</span>
                    </button>

                    <div className="text-center mb-12">
                        <h1 className="text-3xl font-display font-bold text-white mb-2">Resume Intelligence Gatekeeper</h1>
                        <p className="text-neutral-400">Forensic analysis and skill verification protocol</p>
                    </div>

                    {view === 'upload' && (
                        <ResumeUploadZone onUploadComplete={handleUpload} />
                    )}

                    {view === 'processing' && (
                        <ExtractionPipeline
                            file={file}
                            onComplete={handleProcessingComplete}
                            onError={handleProcessingError}
                        />
                    )}

                    {view === 'ranking' && result && (
                        <RankingCard result={result} onProceed={handleProceed} />
                    )}

                    {view === 'error' && (
                        <div className="bg-surface-elevated border-2 border-error-500/30 rounded-xl p-12 text-center max-w-2xl mx-auto">
                            <div className="w-16 h-16 rounded-2xl bg-error-500/10 border border-error-500/30 flex items-center justify-center mb-6 mx-auto">
                                <AlertTriangle className="text-error-500" size={32} />
                            </div>
                            <h3 className="text-xl font-display font-semibold text-white mb-2">Analysis Failed</h3>
                            <p className="text-neutral-400 mb-8">{error}</p>
                            <button
                                onClick={handleRetry}
                                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
