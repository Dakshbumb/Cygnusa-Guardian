import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { IntegrityMonitor } from '../components/IntegrityMonitor';
import { WebcamProctor } from '../components/WebcamProctor';
import { Header } from '../components/Header';
import { CodeEditor } from '../components/CodeEditor';
import {
    ArrowRight, Check, Code,
    MessageSquare, SlidersHorizontal, Loader2,
    CheckCircle, AlertCircle, Timer, FileText,
    ChevronRight
} from 'lucide-react';
import { ShadowProber } from '../components/ShadowProber';
import { ClaimProber } from '../components/ClaimProber';

/**
 * CandidateFlow - Main assessment page for candidates
 * Multi-step flow: Coding → MCQs → Psychometric → Complete
 */
export function CandidateFlow() {
    const { candidateId } = useParams();

    const [assessment, setAssessment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Track current step - will be adjusted based on requires_coding
    const [currentSection, setCurrentSection] = useState(null); // null until loaded, then coding/mcq/text/psychometric/complete
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    // Timer state
    const [timeLeft, setTimeLeft] = useState(45 * 60); // Default 45 mins
    const [timerActive, setTimerActive] = useState(false);

    // Stress-response timing: track when each question started
    const [questionStartTime, setQuestionStartTime] = useState(null);

    // Track results
    const [codeResults, setCodeResults] = useState({});
    const [textResults, setTextResults] = useState({});
    const [psychScores, setPsychScores] = useState({});
    const [textAnswer, setTextAnswer] = useState(''); // Current text answer input
    const [violationCount, setViolationCount] = useState(0);
    const [activeProbe, setActiveProbe] = useState(null); // { questionId, code }

    const [completedSections, setCompletedSections] = useState({
        coding: false,
        text: false,
        mcq: false,
        claims: false,
        psychometric: false
    });

    // Claim verification state
    const [showClaimProber, setShowClaimProber] = useState(false);

    // Load assessment on mount
    useEffect(() => {
        const loadAssessment = async () => {
            try {
                setLoading(true);
                const response = await api.startAssessment(candidateId);
                setAssessment(response.data);

                // Set timer from config
                if (response.data.config?.total_time_minutes) {
                    setTimeLeft(response.data.config.total_time_minutes * 60);
                }
                setTimerActive(true);

                // Initialize psych scores with defaults
                const defaultScores = {};
                response.data.psychometric_sliders?.forEach(s => {
                    defaultScores[s.id] = 5;
                });
                setPsychScores(defaultScores);

                // Set initial section based on role type
                // Non-tech roles skip coding and go directly to MCQ
                const requiresCoding = response.data.requires_coding !== false;
                setCurrentSection(requiresCoding ? 'coding' : 'mcq');

                // Mark coding as completed for non-tech roles
                if (!requiresCoding) {
                    setCompletedSections(prev => ({ ...prev, coding: true }));
                }
            } catch (err) {
                console.error('Failed to load assessment:', err);
                setError('Failed to load assessment. Please refresh the page.');
            } finally {
                setLoading(false);
            }
        };

        loadAssessment();
    }, [candidateId]);

    // Reset input when question changes
    useEffect(() => {
        setTextAnswer('');
        // Track when new question is shown (stress-response timing)
        setQuestionStartTime(new Date().toISOString());
    }, [currentQuestionIndex, currentSection]);

    // Timer countdown
    useEffect(() => {
        let interval;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        setTimerActive(false);
                        // Auto-submit or handle timeout here
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerActive, timeLeft]);

    // Format time helper
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Helper to get descriptive labels for psychometric sliders (0-10 scale)
    const getSliderLabel = (value) => {
        if (value <= 1) return "STRONGLY_DISAGREE";
        if (value <= 3) return "DISAGREE";
        if (value <= 6) return "NEUTRAL";
        if (value <= 8) return "AGREE";
        return "STRONGLY_AGREE";
    };

    // Handle code submission
    const handleCodeSubmit = async (code, language = 'python') => {
        const question = assessment.coding_questions[currentQuestionIndex];
        setSubmitting(true);

        // Calculate timing for stress-response correlation
        const timeSubmitted = new Date().toISOString();
        const durationSeconds = questionStartTime
            ? Math.round((new Date(timeSubmitted) - new Date(questionStartTime)) / 1000)
            : null;

        try {
            const response = await api.submitCode(candidateId, question.id, code, language, {
                timeStarted: questionStartTime,
                timeSubmitted: timeSubmitted,
                durationSeconds: durationSeconds
            });
            setCodeResults(prev => ({
                ...prev,
                [question.id]: response.data.evidence
            }));

            // NOTE: We don't auto-advance anymore. 
            // The user must see the results and click 'Next'
        } catch (err) {
            console.error('Code submission failed:', err);
            setError('Failed to submit code. Please try again.');
        } finally {
            setSubmitting(false);
            // Trigger Shadow Probe after submission
            setActiveProbe({
                questionId: question.id,
                code: code
            });
        }
    };

    // Handle MCQ submission
    const handleMCQSubmit = async (question, selectedOption) => {
        setSubmitting(true);

        // Calculate timing for stress-response correlation
        const timeSubmitted = new Date().toISOString();
        const durationSeconds = questionStartTime
            ? Math.round((new Date(timeSubmitted) - new Date(questionStartTime)) / 1000)
            : null;

        try {
            await api.submitMCQ(
                candidateId,
                question.id,
                question.question,
                selectedOption,
                question.correct,
                question.competency,
                {
                    timeStarted: questionStartTime,
                    timeSubmitted: timeSubmitted,
                    durationSeconds: durationSeconds
                }
            );

            // Move to next question or section
            if (currentQuestionIndex < assessment.mcqs.length - 1) {
                setCurrentQuestionIndex(prev => prev + 1);
            } else {
                setCompletedSections(prev => ({ ...prev, mcq: true }));
                setCurrentSection('text'); // Go to text section next
                setCurrentQuestionIndex(0);
            }
        } catch (err) {
            console.error('MCQ submission failed:', err);
            setError('Failed to submit answer. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle text submission
    const handleTextSubmit = async (answer) => {
        const question = assessment.text_questions[currentQuestionIndex];
        setSubmitting(true);

        try {
            await api.submitText(
                candidateId,
                question.id,
                question.question,
                answer,
                question.competency
            );

            setTextResults(prev => ({
                ...prev,
                [question.id]: true
            }));

            // Move to next question or section
            if (currentQuestionIndex < assessment.text_questions.length - 1) {
                setCurrentQuestionIndex(prev => prev + 1);
            } else {
                setCompletedSections(prev => ({ ...prev, text: true }));
                // Trigger claim verification before psychometric
                setShowClaimProber(true);
            }
        } catch (err) {
            console.error('Text submission failed:', err);
            setError('Failed to submit answer. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle psychometric submission
    const handlePsychometricSubmit = async () => {
        setSubmitting(true);
        setError(null); // Clear previous errors

        try {
            console.log('[SUBMISSION] Starting psychometric submission for:', candidateId);
            await api.submitPsychometric(candidateId, psychScores);
            console.log('[SUBMISSION] Psychometric scores submitted successfully');
            setCompletedSections(prev => ({ ...prev, psychometric: true }));

            // Generate final report
            console.log('[SUBMISSION] Generating final report...');
            await api.generateReport(candidateId);
            console.log('[SUBMISSION] Report generated successfully');
            setCurrentSection('complete');
        } catch (err) {
            console.error('[SUBMISSION ERROR] Full error object:', err);
            console.error('[SUBMISSION ERROR] Response data:', err.response?.data);
            console.error('[SUBMISSION ERROR] Status:', err.response?.status);
            console.error('[SUBMISSION ERROR] Message:', err.message);

            // Extract the most useful error message
            const errorDetail = err.response?.data?.detail ||
                err.response?.data?.message ||
                err.message ||
                'Unknown error occurred';

            setError(`Failed to submit assessment: ${errorDetail}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-2 border-surface-container-high rounded-full"></div>
                        <div className="absolute inset-0 border-2 border-primary rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-primary font-label text-xs uppercase tracking-widest animate-pulse">Loading Assessment Protocol...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">
                <div className="text-center max-w-md glass-panel p-8 rounded-2xl border border-tertiary/20">
                    <AlertCircle className="w-12 h-12 text-tertiary mx-auto mb-4" />
                    <p className="text-white font-bold mb-2">Something went wrong</p>
                    <p className="text-on-surface-variant mb-4 text-sm">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-primary-container text-white rounded-xl font-label uppercase text-xs tracking-widest hover:brightness-110 active:scale-95 transition-all"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Check if role requires coding
    const requiresCoding = assessment?.requires_coding !== false;

    // Calculate progress - adjust for non-coding roles
    const codingQuestionCount = requiresCoding ? (assessment?.coding_questions?.length || 0) : 0;
    const totalSteps =
        codingQuestionCount +
        (assessment?.mcqs?.length || 0) +
        (assessment?.text_questions?.length || 0) + 1; // +1 for psychometric

    let completedSteps = 0;
    if (currentSection === 'mcq') {
        completedSteps = codingQuestionCount + currentQuestionIndex;
    } else if (currentSection === 'text') {
        completedSteps = codingQuestionCount + (assessment?.mcqs?.length || 0) + currentQuestionIndex;
    } else if (currentSection === 'psychometric') {
        completedSteps = codingQuestionCount + (assessment?.mcqs?.length || 0) + (assessment?.text_questions?.length || 0);
    } else if (currentSection === 'complete') {
        completedSteps = totalSteps;
    } else if (currentSection === 'coding') {
        completedSteps = currentQuestionIndex;
    }

    const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    // Section order
    const sectionOrder = requiresCoding
        ? ['coding', 'mcq', 'text', 'claims', 'psychometric']
        : ['mcq', 'text', 'claims', 'psychometric'];
    const sidebarSections = [
        ...(requiresCoding ? [{ id: 'coding', icon: 'terminal', label: 'Coding Challenge' }] : []),
        { id: 'mcq', icon: 'quiz', label: 'Technical MCQ' },
        { id: 'text', icon: 'edit_note', label: 'Reasoning Test' },
        { id: 'claims', icon: 'fact_check', label: 'Claim Verify' },
        { id: 'psychometric', icon: 'psychology', label: 'Psychometric' },
    ];

    return (
        <div className="min-h-screen bg-[#0d0e12] text-[#f2f0f6] font-body flex flex-col">

            {/* Overlays — keep existing */}
            {activeProbe && (
                <ShadowProber
                    candidateId={candidateId}
                    questionId={activeProbe.questionId}
                    code={activeProbe.code}
                    onComplete={() => setActiveProbe(null)}
                />
            )}
            {showClaimProber && (
                <ClaimProber
                    candidateId={candidateId}
                    onComplete={() => {
                        setShowClaimProber(false);
                        setCompletedSections(prev => ({ ...prev, claims: true }));
                        setCurrentSection('psychometric');
                    }}
                />
            )}
            {currentSection !== 'complete' && assessment && localStorage.getItem('role') !== 'recruiter' && (
                <>
                    <IntegrityMonitor candidateId={candidateId} onViolationUpdate={(count) => setViolationCount(count)} />
                    <div className="fixed bottom-4 right-4 z-50">
                        <WebcamProctor candidateId={candidateId} captureInterval={30000} onStatusChange={(s) => console.log('Webcam:', s)} />
                    </div>
                </>
            )}

            {/* ── TOP NAVBAR ── */}
            <header className="bg-[#0d0e12]/90 border-b border-[#47474c]/20 sticky top-0 z-40 backdrop-blur-xl">
                {/* Anti-cheat status bar */}
                <div className="bg-[#121318] border-b border-[#47474c]/20 px-8 py-1.5 flex items-center gap-6 text-[10px] font-label uppercase tracking-widest">
                    <div className="flex items-center gap-1.5 text-[#4ade80]"><span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>Webcam Active</div>
                    <div className="flex items-center gap-1.5 text-[#4ade80]"><span className="material-symbols-outlined text-xs">shield</span>Tab Switches: {violationCount}</div>
                    <div className="flex items-center gap-1.5 text-[#4ade80]"><span className="material-symbols-outlined text-xs">block</span>Copy-Paste: BLOCKED</div>
                    <div className="flex items-center gap-1.5 text-[#4ade80]"><span className="material-symbols-outlined text-xs">verified_user</span>Integrity: NOMINAL</div>
                    <div className="ml-auto text-[#75757a] font-mono text-[9px]">SESSION: {candidateId?.slice(0, 16)}...</div>
                </div>
                <div className="max-w-[1440px] mx-auto px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#ba9eff]">shield</span>
                        <span className="font-bold tracking-tight">Cygnusa Guardian</span>
                        <span className="text-[#47474c] text-sm">|</span>
                        <span className="text-xs text-[#abaab0] font-label">{assessment?.candidate_name}</span>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-label font-bold text-lg tracking-widest transition-all ${
                        timeLeft < 300 ? 'bg-[#ff6e84]/10 border-[#ff6e84]/30 text-[#ff6e84] animate-pulse' : 'bg-[#121318] border-[#47474c]/30 text-[#ba9eff]'
                    }`}>
                        <span className="material-symbols-outlined text-sm">timer</span>
                        {formatTime(timeLeft)}
                    </div>
                </div>
                {/* Progress bar */}
                <div className="h-0.5 bg-[#121318]">
                    <div className="h-full bg-gradient-to-r from-[#ba9eff] to-[#8455ef] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>

            </header>

            {/* ── MAIN LAYOUT — sidebar + content ── */}
            <div className="flex flex-1">
                {/* Sidebar */}
                {currentSection !== 'complete' && (
                    <aside className="w-56 flex-shrink-0 bg-[#121318] border-r border-[#47474c]/20 p-5 hidden lg:flex flex-col gap-2 pt-8">
                        {sidebarSections.map((sec) => {
                            const idx = sectionOrder.indexOf(sec.id);
                            const curIdx = sectionOrder.indexOf(currentSection);
                            const isActive = currentSection === sec.id;
                            const isDone = completedSections[sec.id] || idx < curIdx;
                            return (
                                <div key={sec.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                    isActive ? 'bg-[#ba9eff]/15 border border-[#ba9eff]/30' :
                                    isDone ? 'opacity-60' : 'opacity-30'
                                }`}>
                                    <span className={`material-symbols-outlined text-xl ${
                                        isActive ? 'text-[#ba9eff]' : isDone ? 'text-[#4ade80]' : 'text-[#75757a]'
                                    }`}>{isDone && !isActive ? 'check_circle' : sec.icon}</span>
                                    <div>
                                        <p className={`text-xs font-semibold ${
                                            isActive ? 'text-[#ba9eff]' : isDone ? 'text-[#4ade80]' : 'text-[#75757a]'
                                        }`}>{sec.label}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </aside>
                )}

            {/* Main Content */}
            <main className="flex-1 px-6 py-8 overflow-auto">
                {/* ── CODING ── */}
                {currentSection === 'coding' && requiresCoding && assessment?.coding_questions?.length > 0 && (
                    <div className="h-[calc(100vh-11rem)] flex flex-col animate-fade-in-up">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-label text-[#abaab0] uppercase tracking-widest">Challenge {currentQuestionIndex + 1} of {assessment.coding_questions.length}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-[#ba9eff]/30 text-[#ba9eff] bg-[#ba9eff]/10">MEDIUM</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 bg-[#1e1f25] border border-[#47474c]/30 rounded text-[10px] font-label text-[#abaab0]">python-3.11</span>
                                <span className="px-2 py-1 bg-[#4ade80]/10 border border-[#4ade80]/20 rounded text-[10px] font-label text-[#4ade80]">Sandbox: ACTIVE</span>
                            </div>
                        </div>
                        <div className="flex-1 border border-[#47474c]/20 rounded-xl overflow-hidden shadow-2xl relative bg-[#0d1117]">
                            <CodeEditor
                                questionId={assessment.coding_questions[currentQuestionIndex].id}
                                title={assessment.coding_questions[currentQuestionIndex].title}
                                description={assessment.coding_questions[currentQuestionIndex].description}
                                template={assessment.coding_questions[currentQuestionIndex].template}
                                language="python"
                                onSubmit={handleCodeSubmit}
                                isLoading={submitting}
                                results={codeResults[assessment.coding_questions[currentQuestionIndex].id]}
                            />
                            {codeResults[assessment.coding_questions[currentQuestionIndex].id] && !submitting && (
                                <div className="absolute bottom-6 right-6 z-20">
                                    <button
                                        onClick={() => {
                                            if (currentQuestionIndex < assessment.coding_questions.length - 1) {
                                                setCurrentQuestionIndex(prev => prev + 1);
                                            } else {
                                                setCompletedSections(prev => ({ ...prev, coding: true }));
                                                setCurrentSection('mcq');
                                                setCurrentQuestionIndex(0);
                                            }
                                        }}
                                        className="flex items-center gap-2 px-6 py-3 bg-[#4ade80] text-[#000] rounded-xl font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#4ade80]/30"
                                    >
                                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                        {currentQuestionIndex < assessment.coding_questions.length - 1 ? 'Next Challenge' : 'Proceed to MCQ'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── MCQ ── */}
                {currentSection === 'mcq' && assessment?.mcqs && (
                    <div className="max-w-2xl mx-auto animate-fade-in-up">
                        {/* Question header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-[#abaab0] text-xs font-label uppercase tracking-widest">Q{currentQuestionIndex + 1} of {assessment.mcqs.length}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-[#ff97b5]/30 text-[#ff97b5] bg-[#ff97b5]/10">TECHNICAL MCQ</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-[#ba9eff]/20 text-[#ba9eff] bg-[#ba9eff]/5">{assessment.mcqs[currentQuestionIndex].competency?.toUpperCase()}</span>
                            </div>
                        </div>

                        {/* Question card */}
                        <div className="bg-[#121318] rounded-2xl overflow-hidden border-l-4 border-[#ba9eff] mb-6">
                            <div className="p-8">
                                <h3 className="text-xl font-semibold text-white leading-relaxed mb-8">
                                    {assessment.mcqs[currentQuestionIndex].question}
                                </h3>
                                <div className="space-y-3">
                                    {Object.entries(assessment.mcqs[currentQuestionIndex].options).map(([key, value]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleMCQSubmit(assessment.mcqs[currentQuestionIndex], key)}
                                            disabled={submitting}
                                            className="w-full text-left p-4 rounded-xl bg-[#1e1f25] border border-[#47474c]/30 hover:border-[#ba9eff]/50 hover:bg-[#ba9eff]/10 transition-all flex items-center gap-4 group disabled:opacity-50"
                                        >
                                            <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-[#24252b] border border-[#47474c]/50 group-hover:bg-[#ba9eff]/20 group-hover:border-[#ba9eff]/50 flex items-center justify-center font-mono font-bold text-sm text-[#abaab0] group-hover:text-[#ba9eff] transition-all">{key}</span>
                                            <span className="flex-1 text-[#abaab0] group-hover:text-white text-sm transition-colors">{value}</span>
                                            {submitting && <div className="w-4 h-4 border-2 border-[#ba9eff] border-t-transparent rounded-full animate-spin" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Mini grid */}
                        <div className="flex flex-wrap gap-1.5">
                            {assessment.mcqs.map((_, i) => (
                                <div key={i} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
                                    i < currentQuestionIndex ? 'bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/30' :
                                    i === currentQuestionIndex ? 'bg-[#ba9eff]/20 text-[#ba9eff] border border-[#ba9eff]/50' :
                                    'bg-[#1e1f25] text-[#75757a] border border-[#47474c]/20'
                                }`}>{i + 1}</div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── TEXT/REASONING ── */}
                {currentSection === 'text' && assessment?.text_questions && (
                    <div className="max-w-2xl mx-auto animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-[#abaab0] text-xs font-label uppercase tracking-widest">Reasoning Q{currentQuestionIndex + 1} of {assessment.text_questions.length}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-[#c08cf7]/30 text-[#c08cf7] bg-[#c08cf7]/10">{assessment.text_questions[currentQuestionIndex].competency?.toUpperCase()}</span>
                        </div>
                        <div className="bg-[#121318] rounded-2xl overflow-hidden border-l-4 border-[#c08cf7] mb-4">
                            <div className="p-8">
                                <h3 className="text-xl font-semibold text-white mb-6 leading-relaxed">
                                    {assessment.text_questions[currentQuestionIndex].question}
                                </h3>
                                <div className="relative mb-6">
                                    <textarea
                                        value={textAnswer}
                                        onChange={(e) => setTextAnswer(e.target.value)}
                                        placeholder="Enter your detailed reasoning here..."
                                        rows={8}
                                        className="w-full bg-[#0d0e12] border border-[#47474c]/40 focus:border-[#ba9eff] rounded-xl p-5 text-sm text-[#f2f0f6] placeholder:text-[#47474c] resize-none outline-none transition-colors leading-relaxed"
                                        disabled={submitting}
                                    />
                                    <div className="absolute bottom-3 right-3 flex gap-3 text-[10px] font-label text-[#75757a]">
                                        <span>MIN: {assessment.text_questions[currentQuestionIndex].min_words} words</span>
                                        <span className={textAnswer.trim().split(/\s+/).filter(w=>w.length>0).length >= assessment.text_questions[currentQuestionIndex].min_words ? 'text-[#4ade80]' : 'text-[#ff97b5]'}>
                                            NOW: {textAnswer.trim().split(/\s+/).filter(w=>w.length>0).length}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleTextSubmit(textAnswer)}
                                    disabled={submitting || textAnswer.trim().split(/\s+/).filter(w=>w.length>0).length < 5}
                                    className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#ba9eff] to-[#8455ef] text-[#39008c] hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? <><div className="w-4 h-4 border-2 border-[#39008c] border-t-transparent rounded-full animate-spin" />Submitting...</> : 'Submit Analysis'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PSYCHOMETRIC ── */}
                {currentSection === 'psychometric' && assessment?.psychometric_sliders && (
                    <div className="max-w-2xl mx-auto animate-fade-in-up">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold">Psychometric Profile</h2>
                            <p className="text-[#abaab0] text-sm">Rate each statement honestly — this calibrates your cognitive architecture</p>
                        </div>
                        <div className="bg-[#121318] rounded-2xl p-8 space-y-8 border-l-4 border-[#4ade80]">
                            {assessment.psychometric_sliders.map((slider) => {
                                const val = psychScores[slider.id] ?? 5;
                                return (
                                    <div key={slider.id}>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="font-medium text-sm text-[#f2f0f6]">{slider.label}</label>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                                val <= 3 ? 'bg-[#ff6e84]/10 text-[#ff6e84] border-[#ff6e84]/30' :
                                                val <= 6 ? 'bg-amber-400/10 text-amber-400 border-amber-400/30' :
                                                'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/30'
                                            }`}>{getSliderLabel(val)} [{val}]</span>
                                        </div>
                                        <input type="range" min={slider.min} max={slider.max} value={val}
                                            onChange={(e) => setPsychScores(prev => ({ ...prev, [slider.id]: parseInt(e.target.value) }))}
                                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#ba9eff] bg-[#24252b]"
                                        />
                                        <div className="flex justify-between text-[10px] font-label text-[#75757a] mt-1">
                                            <span>Strongly Disagree</span><span>Strongly Agree</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <button
                                onClick={handlePsychometricSubmit}
                                disabled={submitting}
                                className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#4ade80] to-[#22c55e] text-[#000] hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                {submitting ? <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />Compiling Report...</> : <><span className="material-symbols-outlined text-sm">check_circle</span>Finalize Assessment</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── COMPLETE ── */}
                {currentSection === 'complete' && (
                    <div className="max-w-xl mx-auto text-center pt-16">
                        <div className="w-24 h-24 bg-[#4ade80]/10 border-2 border-[#4ade80]/30 rounded-full flex items-center justify-center mx-auto mb-8">
                            <span className="material-symbols-outlined text-5xl text-[#4ade80]">verified</span>
                        </div>
                        <h2 className="text-3xl font-bold mb-3 tracking-tight">Assessment Complete</h2>
                        <p className="text-[#abaab0] text-base mb-10">Evidence secured and encrypted. The AI is processing your forensic report.</p>
                        <div className="bg-[#121318] rounded-2xl p-8 text-left border border-[#47474c]/20 mb-8">
                            <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#abaab0] mb-5">Authentication Log</h3>
                            <div className="space-y-4">
                                {[
                                    { label: 'Code Sandbox Execution', status: 'VERIFIED', ok: true },
                                    { label: `Integrity Events`, status: violationCount === 0 ? 'CLEAN' : `${violationCount} EVENTS — ${violationCount >= 5 ? 'HIGH RISK' : 'CAUTION'}`, ok: violationCount === 0 },
                                    { label: 'Forensic Report Generation', status: 'QUEUED', ok: true },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className={`material-symbols-outlined text-sm ${item.ok ? 'text-[#4ade80]' : 'text-amber-400'}`}>
                                            {item.ok ? 'check_circle' : 'warning'}
                                        </span>
                                        <span className="text-sm text-[#abaab0]">{item.label}:</span>
                                        <span className={`text-sm font-bold ${item.ok ? 'text-[#4ade80]' : 'text-amber-400'}`}>{item.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <p className="text-[10px] font-label text-[#47474c] uppercase tracking-widest">SESSION: {candidateId} · TERMINATED</p>
                    </div>
                )}
            </main>
            </div>
        </div>
    );
}

export default CandidateFlow;
