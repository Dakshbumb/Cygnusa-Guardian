import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const STEPS = ['Resume', 'Analysis', 'Assessment', 'Complete'];

export function ResumeAnalysisPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [step, setStep] = useState(0); // 0=upload, 1=processing, 2=results, 3=error
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [jobTitle, setJobTitle] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [result, setResult] = useState(null);
    const [candidateId, setCandidateId] = useState(null);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [stages, setStages] = useState([
        { label: 'Parsing document structure', done: false, active: false },
        { label: 'Extracting skill claims', done: false, active: false },
        { label: 'Running forensic analysis', done: false, active: false },
        { label: 'Generating candidate profile', done: false, active: false },
    ]);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) selectFile(dropped);
    };

    const selectFile = (f) => {
        const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.includes(f.type)) {
            setError('Only PDF and DOCX files are supported.');
            return;
        }
        setFile(f);
        setError(null);
    };

    const handleSubmit = async () => {
        if (!file) { setError('Please select a resume file.'); return; }
        if (!jobTitle.trim()) { setError('Job title is required.'); return; }

        setStep(1);
        // Animate stages
        for (let i = 0; i < stages.length; i++) {
            await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
            setStages(prev => prev.map((s, idx) => idx === i ? { ...s, active: true } : s));
            await new Promise(r => setTimeout(r, 600));
            setStages(prev => prev.map((s, idx) => idx === i ? { ...s, done: true, active: false } : s));
            setUploadProgress(Math.round(((i + 1) / stages.length) * 100));
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('job_title', jobTitle);
            if (jobDescription) formData.append('job_description', jobDescription);

            const res = await api.uploadResume(formData);
            setCandidateId(res.data.candidate_id);
            setResult(res.data);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
            setStep(3);
        }
    };

    const handleProceed = () => {
        if (candidateId) navigate(`/candidate/${candidateId}`);
    };

    const handleRetry = () => {
        setFile(null);
        setResult(null);
        setCandidateId(null);
        setError(null);
        setUploadProgress(0);
        setStages(stages.map(s => ({ ...s, done: false, active: false })));
        setStep(0);
    };

    return (
        <div className="bg-[#0d0e12] text-[#f2f0f6] min-h-screen font-body">
            {/* Navbar */}
            <header className="fixed top-0 w-full z-50 bg-[#0d0e12]/80 backdrop-blur-xl border-b border-[#47474c]/20">
                <div className="flex items-center justify-between px-8 py-4 max-w-6xl mx-auto">
                    <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
                        <span className="material-symbols-outlined text-[#ba9eff]">shield</span>
                        Cygnusa Guardian
                    </div>
                    {/* Step Progress */}
                    <div className="flex items-center gap-0">
                        {STEPS.map((s, i) => (
                            <div key={s} className="flex items-center">
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                                    i === Math.min(step, 3) ? 'bg-[#ba9eff]/20 text-[#ba9eff] border border-[#ba9eff]/30'
                                    : i < step ? 'text-[#4ade80]'
                                    : 'text-[#75757a]'
                                }`}>
                                    {i < step ? (
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                    ) : (
                                        <span className={`w-4 h-4 rounded-full border text-[10px] flex items-center justify-center ${
                                            i === Math.min(step, 3) ? 'border-[#ba9eff] text-[#ba9eff]' : 'border-[#47474c] text-[#75757a]'
                                        }`}>{i + 1}</span>
                                    )}
                                    {s}
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className={`w-8 h-px mx-1 ${i < step ? 'bg-[#4ade80]' : 'bg-[#47474c]/40'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                    <button onClick={() => navigate('/')} className="text-[#abaab0] hover:text-white text-xs flex items-center gap-1 transition-colors">
                        <span className="material-symbols-outlined text-sm">arrow_back</span> Home
                    </button>
                </div>
            </header>

            <main className="pt-24 pb-20 px-6 max-w-3xl mx-auto">
                {/* STEP 0: Upload */}
                {step === 0 && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="text-center mb-10">
                            <h1 className="text-3xl font-bold tracking-tight mb-2">Resume Forensic Analysis</h1>
                            <p className="text-[#abaab0]">Upload your resume for AI-powered skill verification and assessment routing</p>
                        </div>

                        {/* Drop Zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                                isDragging ? 'border-[#ba9eff] bg-[#ba9eff]/10' :
                                file ? 'border-[#4ade80]/60 bg-[#4ade80]/5' :
                                'border-[#47474c]/60 bg-[#121318] hover:border-[#ba9eff]/50 hover:bg-[#ba9eff]/5'
                            }`}
                        >
                            <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => e.target.files[0] && selectFile(e.target.files[0])} />
                            {file ? (
                                <>
                                    <span className="material-symbols-outlined text-5xl text-[#4ade80] mb-4">description</span>
                                    <p className="font-semibold text-[#4ade80]">{file.name}</p>
                                    <p className="text-xs text-[#abaab0] mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-5xl text-[#ba9eff]/60 mb-4">cloud_upload</span>
                                    <p className="text-lg font-semibold text-[#f2f0f6] mb-1">Drop your resume here</p>
                                    <p className="text-sm text-[#abaab0]">or <span className="text-[#ba9eff] underline">browse files</span></p>
                                    <div className="flex gap-2 mt-4">
                                        {['PDF', 'DOCX'].map(fmt => (
                                            <span key={fmt} className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border border-[#47474c]/50 text-[#abaab0]">{fmt}</span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Role Details */}
                        <div className="bg-[#121318] rounded-2xl p-8 space-y-5">
                            <h2 className="font-bold text-base tracking-tight mb-1">Tell us about this role</h2>
                            <div>
                                <label className="text-xs uppercase tracking-widest text-[#abaab0] font-semibold block mb-2">Job Title *</label>
                                <input
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                    placeholder="e.g. Senior Software Engineer"
                                    className="w-full bg-[#1e1f25] border-b border-[#47474c]/50 focus:border-[#ba9eff] text-white px-4 py-3 rounded-t-lg outline-none text-sm transition-colors placeholder:text-[#47474c]"
                                />
                            </div>
                            <div>
                                <label className="text-xs uppercase tracking-widest text-[#abaab0] font-semibold block mb-2">Job Description <span className="text-[#47474c] normal-case">(optional)</span></label>
                                <textarea
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    placeholder="Paste the job description to improve skill matching accuracy..."
                                    rows={4}
                                    className="w-full bg-[#1e1f25] border-b border-[#47474c]/50 focus:border-[#ba9eff] text-white px-4 py-3 rounded-t-lg outline-none text-sm resize-none transition-colors placeholder:text-[#47474c]"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 bg-[#ff6e84]/10 border border-[#ff6e84]/30 rounded-xl px-5 py-4 text-[#ff6e84] text-sm">
                                <span className="material-symbols-outlined text-lg">error</span> {error}
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            className="w-full py-4 rounded-xl font-bold text-sm bg-gradient-to-r from-[#ba9eff] to-[#8455ef] text-[#39008c] hover:brightness-110 active:scale-[0.99] transition-all"
                        >
                            Submit Resume for Analysis
                        </button>
                    </div>
                )}

                {/* STEP 1: Processing */}
                {step === 1 && (
                    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 animate-fade-in">
                        <div className="relative w-24 h-24">
                            <div className="absolute inset-0 rounded-full border-2 border-[#ba9eff]/20 animate-ping"></div>
                            <div className="w-24 h-24 rounded-full bg-[#ba9eff]/10 border border-[#ba9eff]/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-[#ba9eff] animate-pulse">psychology</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-2">Analyzing Resume</h2>
                            <p className="text-[#abaab0] text-sm">Running forensic extraction pipeline</p>
                        </div>
                        <div className="w-full max-w-md space-y-3">
                            {stages.map((s, i) => (
                                <div key={i} className={`flex items-center gap-4 p-4 rounded-xl transition-all ${s.active ? 'bg-[#ba9eff]/10 border border-[#ba9eff]/30' : s.done ? 'bg-[#4ade80]/5' : 'bg-[#121318]'}`}>
                                    {s.done ? (
                                        <span className="material-symbols-outlined text-[#4ade80] text-xl">check_circle</span>
                                    ) : s.active ? (
                                        <div className="w-5 h-5 border-2 border-[#ba9eff] border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border border-[#47474c]" />
                                    )}
                                    <span className={`text-sm ${s.done ? 'text-[#4ade80]' : s.active ? 'text-[#ba9eff]' : 'text-[#75757a]'}`}>{s.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="w-full max-w-md">
                            <div className="h-1 bg-[#1e1f25] rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#ba9eff] to-[#8455ef] transition-all duration-500 rounded-full" style={{ width: `${uploadProgress}%` }} />
                            </div>
                            <p className="text-right text-xs text-[#75757a] mt-1">{uploadProgress}%</p>
                        </div>
                    </div>
                )}

                {/* STEP 2: Results */}
                {step === 2 && result && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 rounded-full bg-[#4ade80]/10 border border-[#4ade80]/30 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-4xl text-[#4ade80]">verified</span>
                            </div>
                            <h2 className="text-2xl font-bold">Analysis Complete</h2>
                            <p className="text-[#abaab0] text-sm mt-1">Forensic profile generated successfully</p>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Resume Score', value: `${Math.round(result.evidence?.score || result.score || 0)}%`, icon: 'description', color: 'text-[#ba9eff]' },
                                { label: 'Match Rank', value: result.rank || result.match || '—', icon: 'leaderboard', color: 'text-[#4ade80]' },
                                { label: 'Skills Found', value: result.evidence?.skills_extracted?.length || 0, icon: 'psychology', color: 'text-[#c08cf7]' },
                            ].map((m, i) => (
                                <div key={i} className="bg-[#121318] rounded-2xl p-6 text-center">
                                    <span className={`material-symbols-outlined text-3xl ${m.color} block mb-2`}>{m.icon}</span>
                                    <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                                    <p className="text-xs text-[#abaab0] mt-1 uppercase tracking-widest">{m.label}</p>
                                </div>
                            ))}
                        </div>

                        {result.evidence?.skills_extracted?.length > 0 && (
                            <div className="bg-[#121318] rounded-2xl p-6">
                                <h3 className="font-bold text-sm uppercase tracking-widest text-[#abaab0] mb-4">Verified Skills</h3>
                                <div className="flex flex-wrap gap-2">
                                    {result.evidence.skills_extracted.map((s, i) => (
                                        <span key={i} className="px-3 py-1 rounded-full bg-[#ba9eff]/10 border border-[#ba9eff]/20 text-[#ba9eff] text-xs font-semibold">{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {result.justification && (
                            <div className="bg-[#121318] rounded-2xl p-6">
                                <h3 className="font-bold text-sm uppercase tracking-widest text-[#abaab0] mb-3">AI Analysis</h3>
                                <p className="text-sm text-[#f2f0f6] leading-relaxed">{result.justification}</p>
                            </div>
                        )}

                        <button onClick={handleProceed} className="w-full py-4 rounded-xl font-bold text-sm bg-gradient-to-r from-[#ba9eff] to-[#8455ef] text-[#39008c] hover:brightness-110 active:scale-[0.99] transition-all">
                            Proceed to Assessment
                            <span className="material-symbols-outlined text-sm ml-2 align-[-3px]">arrow_forward</span>
                        </button>
                    </div>
                )}

                {/* STEP 3: Error */}
                {step === 3 && (
                    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 animate-fade-in">
                        <div className="w-20 h-20 rounded-full bg-[#ff6e84]/10 border border-[#ff6e84]/30 flex items-center justify-center">
                            <span className="material-symbols-outlined text-4xl text-[#ff6e84]">error</span>
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-2">Analysis Failed</h2>
                            <p className="text-[#abaab0] text-sm max-w-sm">{error}</p>
                        </div>
                        <button onClick={handleRetry} className="px-8 py-3 rounded-xl font-bold text-sm bg-[#1e1f25] border border-[#47474c]/50 hover:border-[#ba9eff]/50 text-white transition-all">
                            Try Again
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
