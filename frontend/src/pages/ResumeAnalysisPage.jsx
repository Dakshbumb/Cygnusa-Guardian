import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { ResumeUploadZone } from '../components/resume/ResumeUploadZone';
import { ExtractionPipeline } from '../components/resume/ExtractionPipeline';
import { RankingCard } from '../components/resume/RankingCard';
import { RoleSelector } from '../components/resume/RoleSelector';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';

export function ResumeAnalysisPage() {
    const navigate = useNavigate();
    const [view, setView] = useState('upload'); // upload, processing, ranking, error
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [file, setFile] = useState(null);
    const [result, setResult] = useState(null);
    const [candidateId, setCandidateId] = useState(null);
    const [error, setError] = useState(null);

    React.useEffect(() => {
        const fetchRoles = async () => {
            try {
                const response = await api.getRoles();
                setRoles(response.data);
            } catch (err) {
                console.error("Failed to fetch roles", err);
            }
        };
        fetchRoles();
    }, []);

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
            targetRole: selectedRole?.title || 'Target Role',
            skills: apiResult.evidence?.skills_extracted || [],
            missing: (apiResult.evidence?.jd_required || []).filter(
                s => !(apiResult.evidence?.skills_extracted || []).includes(s)
            ),
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
                        <div className="space-y-12 animate-fade-in">
                            <RoleSelector
                                roles={roles}
                                selectedRole={selectedRole}
                                onSelect={setSelectedRole}
                            />

                            <div className={`transition-all duration-500 overflow-hidden ${selectedRole ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                                <h3 className="text-sm font-mono font-bold text-neutral-500 uppercase tracking-widest text-center mb-6">
                                    Step 2: Analysis Protocol
                                </h3>
                                <ResumeUploadZone onUploadComplete={handleUpload} />
                            </div>
                        </div>
                    )}

                    {view === 'processing' && (
                        <ExtractionPipeline
                            file={file}
                            selectedRole={selectedRole}
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
