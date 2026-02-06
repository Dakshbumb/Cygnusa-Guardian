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
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading assessment...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-800 font-medium mb-2">Something went wrong</p>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
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

    return (
        <div className="min-h-screen bg-surface-base text-neutral-50 font-sans selection:bg-primary-500 selection:text-white flex flex-col">
            <Header />

            {/* Shadow Deep Probe Overlay */}
            {activeProbe && (
                <ShadowProber
                    candidateId={candidateId}
                    questionId={activeProbe.questionId}
                    code={activeProbe.code}
                    onComplete={() => setActiveProbe(null)}
                />
            )}

            {/* Resume Claim Verification Overlay */}
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

            {/* Assessment Monitoring (only while active) */}
            {currentSection !== 'complete' && assessment && (
                <>
                    {/* Integrity Monitor (fixed) */}
                    <IntegrityMonitor
                        candidateId={candidateId}
                        onViolationUpdate={(count) => setViolationCount(count)}
                    />

                    {/* Webcam Proctoring (fixed position) */}
                    <div className="fixed bottom-4 right-4 z-50">
                        <WebcamProctor
                            candidateId={candidateId}
                            captureInterval={30000}
                            onStatusChange={(status) => console.log('Webcam status:', status)}
                        />
                    </div>
                </>
            )}

            {/* Header */}
            <header className="bg-surface-elevated border-b border-surface-overlay sticky top-0 z-40 backdrop-blur-md bg-surface-elevated/90">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded flex items-center justify-center border border-primary-500/50 shadow-lg shadow-primary-900/50">
                                <span className="text-white font-mono font-bold text-lg">CG</span>
                            </div>
                            <div>
                                <h1 className="font-display font-bold text-lg text-white">Cygnusa Assessment</h1>
                                <div className="flex items-center gap-2 text-xs font-mono text-primary-400">
                                    <span>ID: {assessment?.id?.slice(0, 8) || 'UNK'}</span>
                                    <span>•</span>
                                    <span>SUBJECT: {assessment?.candidate_name?.toUpperCase()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            {/* Enhanced Progress Stepper with Step Numbers and Connecting Lines */}
                            <div className="hidden md:flex items-center bg-surface-base border border-surface-overlay rounded-lg px-2 py-1">
                                {[
                                    // Conditionally include coding step based on role type
                                    ...(requiresCoding ? [{ id: 'coding', icon: Code, label: 'CODING', step: 1 }] : []),
                                    { id: 'mcq', icon: MessageSquare, label: 'SCENARIOS', step: requiresCoding ? 2 : 1 },
                                    { id: 'text', icon: FileText, label: requiresCoding ? 'REASONING' : 'DOMAIN', step: requiresCoding ? 3 : 2 },
                                    { id: 'claims', icon: Check, label: 'VERIFY', step: requiresCoding ? 4 : 3 },
                                    { id: 'psychometric', icon: SlidersHorizontal, label: 'PROFILE', step: requiresCoding ? 5 : 4 },
                                ].map((section, i, arr) => {
                                    const isActive = currentSection === section.id;
                                    const isCompleted = completedSections[section.id];
                                    const sectionOrder = requiresCoding
                                        ? ['coding', 'mcq', 'text', 'claims', 'psychometric']
                                        : ['mcq', 'text', 'claims', 'psychometric'];
                                    const currentSectionIndex = sectionOrder.indexOf(currentSection);
                                    const thisSectionIndex = sectionOrder.indexOf(section.id);
                                    const isPast = thisSectionIndex < currentSectionIndex;

                                    return (
                                        <div key={section.id} className="flex items-center">
                                            {/* Step Circle */}
                                            <div className="flex flex-col items-center gap-0.5">
                                                <div
                                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border-2 transition-all duration-300 ${isCompleted || isPast
                                                        ? 'bg-success-500 border-success-400 text-white shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                                                        : isActive
                                                            ? 'bg-primary-600 border-primary-400 text-white shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-pulse'
                                                            : 'bg-surface-elevated border-surface-overlay text-neutral-500'
                                                        }`}
                                                >
                                                    {isCompleted || isPast ? (
                                                        <Check size={12} className="stroke-[3]" />
                                                    ) : (
                                                        section.step
                                                    )}
                                                </div>
                                                <span className={`text-[8px] font-mono tracking-tight ${isActive ? 'text-primary-400' : isCompleted || isPast ? 'text-success-400' : 'text-neutral-600'
                                                    }`}>
                                                    {section.label}
                                                </span>
                                            </div>

                                            {/* Connecting Line */}
                                            {i < arr.length - 1 && (
                                                <div className={`w-6 h-0.5 mx-1 transition-all duration-500 ${completedSections[section.id] || isPast
                                                    ? 'bg-success-500'
                                                    : 'bg-surface-overlay'
                                                    }`} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>


                            {/* Timer Display */}
                            <div className={`flex items-center gap-3 px-4 py-2 rounded border font-mono font-bold transition-all ${timeLeft < 300
                                ? 'bg-danger-900/20 border-danger-500 text-danger-500 animate-pulse'
                                : 'bg-surface-base border-primary-500/30 text-primary-400'
                                }`}>
                                <Timer size={16} />
                                <span className="text-lg tracking-widest">{formatTime(timeLeft)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-surface-base rounded-full h-1 overflow-hidden border border-surface-overlay/50">
                        <div
                            className="bg-gradient-to-r from-primary-600 to-primary-400 h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
                {/* Coding Section - Only shown for tech roles */}
                {currentSection === 'coding' && requiresCoding && assessment?.coding_questions?.length > 0 && (
                    <div className="h-[calc(100vh-12rem)] flex flex-col animate-fade-in-up">
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-mono text-xs text-secondary-400">
                                QUESTION_INDEX: {currentQuestionIndex + 1}/{assessment.coding_questions.length}
                            </span>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 bg-surface-elevated border border-surface-overlay rounded text-xs font-mono text-neutral-400">python-3.11</span>
                                <span className="px-2 py-1 bg-surface-elevated border border-surface-overlay rounded text-xs font-mono text-neutral-400">sandbox: active</span>
                            </div>
                        </div>

                        <div className="flex-1 border border-surface-overlay rounded-lg overflow-hidden shadow-2xl relative">
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

                            {/* Floating Next Button after submission */}
                            {codeResults[assessment.coding_questions[currentQuestionIndex].id] && !submitting && (
                                <div className="absolute bottom-20 right-8 z-20 animate-bounce-in">
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
                                        className="flex items-center gap-3 px-8 py-3 bg-success-600 hover:bg-success-500 text-white rounded-full font-bold shadow-[0_0_30px_rgba(34,197,94,0.4)] border border-success-400 transition-all hover:scale-110 active:scale-95 group font-mono"
                                    >
                                        <span>PROCEED_TO_{currentQuestionIndex < assessment.coding_questions.length - 1 ? 'NEXT_CHALLENGE' : 'SCENARIOS'}</span>
                                        <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MCQ Section */}
                {currentSection === 'mcq' && assessment?.mcqs && (
                    <div className="max-w-3xl mx-auto animate-fade-in-up pt-12">
                        <div className="mb-6 flex justify-between items-end">
                            <span className="font-mono text-xs text-secondary-400">
                                SCENARIO_INDEX: {currentQuestionIndex + 1}/{assessment.mcqs.length}
                            </span>
                        </div>

                        <div className="bg-surface-elevated rounded-xl border border-surface-overlay overflow-hidden shadow-2xl relative">
                            {/* Decoration line */}
                            <div className="absolute top-0 left-0 w-1 h-full bg-secondary-500" />

                            <div className="px-8 py-6 border-b border-surface-overlay flex justify-between items-center bg-surface-base/30">
                                <span className="px-3 py-1 bg-secondary-500/10 border border-secondary-500/20 text-secondary-400 rounded-full text-xs font-mono tracking-wider">
                                    {assessment.mcqs[currentQuestionIndex].competency.toUpperCase()}
                                </span>
                                <span className="text-neutral-500 text-xs font-mono">SINGLE_CHOICE</span>
                            </div>

                            <div className="p-8">
                                <h3 className="text-xl font-display font-semibold text-white mb-8 leading-relaxed">
                                    {assessment.mcqs[currentQuestionIndex].question}
                                </h3>

                                <div className="space-y-4">
                                    {Object.entries(assessment.mcqs[currentQuestionIndex].options).map(([key, value]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleMCQSubmit(assessment.mcqs[currentQuestionIndex], key)}
                                            disabled={submitting}
                                            className="w-full text-left p-4 border border-surface-overlay bg-surface-base/50 rounded-lg hover:border-primary-500 hover:bg-primary-900/10 transition-all flex items-center gap-4 group disabled:opacity-50"
                                        >
                                            <span className="w-8 h-8 rounded bg-surface-elevated border border-surface-overlay group-hover:bg-primary-500 group-hover:text-white flex items-center justify-center font-mono text-neutral-400 transition-colors">
                                                {key}
                                            </span>
                                            <span className="flex-1 text-neutral-300 group-hover:text-white transition-colors">
                                                {value}
                                            </span>
                                            <ArrowRight size={16} className="text-neutral-600 group-hover:text-primary-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Text/Reasoning Section */}
                {currentSection === 'text' && assessment?.text_questions && (
                    <div className="max-w-3xl mx-auto animate-fade-in-up pt-12">
                        <div className="mb-6">
                            <span className="font-mono text-xs text-secondary-400">
                                REASONING_INDEX: {currentQuestionIndex + 1}/{assessment.text_questions.length}
                            </span>
                        </div>

                        <div className="bg-surface-elevated rounded-xl border border-surface-overlay overflow-hidden shadow-2xl relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary-500" />

                            <div className="px-8 py-6 border-b border-surface-overlay bg-surface-base/30">
                                <div className="flex items-center gap-3 text-primary-400">
                                    <FileText size={18} />
                                    <span className="font-mono text-xs font-bold uppercase tracking-widest">
                                        {assessment.text_questions[currentQuestionIndex].competency} ANALYSIS
                                    </span>
                                </div>
                            </div>

                            <div className="p-8">
                                <h3 className="text-xl font-display font-semibold text-white mb-6">
                                    {assessment.text_questions[currentQuestionIndex].question}
                                </h3>

                                <div className="mb-8 relative">
                                    <textarea
                                        value={textAnswer}
                                        onChange={(e) => setTextAnswer(e.target.value)}
                                        placeholder="Enter your detailed reasoning here..."
                                        className="w-full h-64 p-6 bg-surface-base border border-surface-overlay rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-none font-sans text-neutral-300 leading-relaxed placeholder:text-neutral-700"
                                        disabled={submitting}
                                    />
                                    <div className="absolute bottom-4 right-4 flex gap-4 text-xs font-mono text-neutral-500 bg-surface-base/80 px-2 py-1 rounded border border-surface-overlay">
                                        <span>MIN_WORDS: {assessment.text_questions[currentQuestionIndex].min_words}</span>
                                        <span className={textAnswer.trim().split(/\s+/).length < assessment.text_questions[currentQuestionIndex].min_words ? 'text-warning-500' : 'text-success-400'}>
                                            CURRENT: {textAnswer.trim().split(/\s+/).filter(w => w.length > 0).length}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleTextSubmit(textAnswer)}
                                    disabled={submitting || textAnswer.trim().split(/\s+/).length < 5}
                                    className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-primary-900/20 disabled:opacity-50 flex items-center justify-center gap-3 group"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            <span>Submitting Analysis...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Submit Analysis</span>
                                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Psychometric Section */}
                {currentSection === 'psychometric' && assessment?.psychometric_sliders && (
                    <div className="max-w-3xl mx-auto animate-fade-in-up pt-12">
                        <div className="bg-surface-elevated rounded-xl border border-surface-overlay overflow-hidden shadow-2xl relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-success-500" />

                            <div className="px-8 py-6 border-b border-surface-overlay bg-surface-base/30">
                                <h2 className="text-xl font-display font-semibold text-white">Psychometric Profile</h2>
                                <p className="text-neutral-400 text-sm mt-1 font-mono">
                                    CALIBRATE_SELF_PERCEPTION
                                </p>
                            </div>

                            <div className="p-8 space-y-10">
                                {assessment.psychometric_sliders.map((slider) => (
                                    <div key={slider.id} className="relative">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="font-medium text-neutral-200">
                                                {slider.label}
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${(psychScores[slider.id] ?? 5) <= 3 ? 'bg-danger-900/10 text-danger-400 border-danger-500/20' :
                                                    (psychScores[slider.id] ?? 5) <= 6 ? 'bg-warning-900/10 text-warning-400 border-warning-500/20' :
                                                        'bg-success-900/10 text-success-400 border-success-500/20'
                                                    }`}>
                                                    {getSliderLabel(psychScores[slider.id] ?? 5)}
                                                </span>
                                                <span className="px-3 py-1 bg-surface-base border border-surface-overlay rounded text-primary-400 font-mono font-bold w-12 text-center text-sm shadow-inner group-hover:border-primary-500/50 transition-colors">
                                                    [{psychScores[slider.id] ?? 5}]
                                                </span>
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min={slider.min}
                                            max={slider.max}
                                            value={psychScores[slider.id] ?? 5}
                                            onChange={(e) => setPsychScores(prev => ({
                                                ...prev,
                                                [slider.id]: parseInt(e.target.value)
                                            }))}
                                            className="w-full h-2 bg-surface-base rounded-lg appearance-none cursor-pointer accent-primary-500 hover:accent-primary-400"
                                        />
                                        <div className="flex justify-between text-xs font-mono text-neutral-500 mt-2 uppercase tracking-wider">
                                            <span>Strongly Disagree</span>
                                            <span>Strongly Agree</span>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={handlePsychometricSubmit}
                                    disabled={submitting}
                                    className="w-full py-4 bg-success-600 hover:bg-success-500 text-white rounded-lg font-semibold text-lg shadow-lg shadow-success-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-8 hover:scale-[1.01]"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="animate-spin" size={22} />
                                            <span>Compiling Forensic Report...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Finalize Assessment</span>
                                            <CheckCircle size={22} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Complete Section */}
                {currentSection === 'complete' && (
                    <div className="max-w-2xl mx-auto text-center pt-20 animate-fade-in-up">
                        <div className="bg-surface-elevated rounded-2xl border border-surface-overlay p-12 shadow-2xl">
                            <div className="w-24 h-24 bg-success-900/20 border border-success-500/30 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce-slow">
                                <CheckCircle className="w-12 h-12 text-success-500" />
                            </div>

                            <h2 className="text-3xl font-display font-bold text-white mb-4">
                                Assessment Protocol Complete
                            </h2>

                            <p className="text-neutral-400 mb-10 text-lg leading-relaxed">
                                Evidence has been secured and encrypted. The AI analysis engine is currently processing your submission.
                            </p>

                            <div className="bg-surface-base rounded-xl p-8 mb-10 border border-surface-overlay text-left">
                                <h3 className="font-mono text-sm font-bold text-neutral-300 mb-4 uppercase tracking-wider">Authentication Log</h3>
                                <ul className="space-y-4">
                                    <li className="flex items-center gap-3 text-neutral-400 text-sm font-mono">
                                        <Check className="w-4 h-4 text-success-500" />
                                        <span>Code Sandbox Execution: VERIFIED</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-neutral-400 text-sm font-mono">
                                        {violationCount === 0 ? (
                                            <>
                                                <Check className="w-4 h-4 text-success-500" />
                                                <span>Integrity Monitor Status: CLEAN (SAFE)</span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className={`w-4 h-4 ${violationCount >= 5 ? 'text-danger-500' : 'text-warning-500'}`} />
                                                <span>Integrity Monitor Status: {violationCount} EVENTS LOGGED ({violationCount >= 5 ? '⚠️ HIGH RISK' : 'CAUTION'})</span>
                                            </>
                                        )}
                                    </li>
                                    <li className="flex items-center gap-3 text-neutral-400 text-sm font-mono">
                                        <Check className="w-4 h-4 text-success-500" />
                                        <span>Forensic Report Generation: QUEUED</span>
                                    </li>
                                </ul>
                            </div>

                            <p className="text-xs font-mono text-neutral-600">
                                SESSION_ID: {candidateId} • CONNECTION_TERMINATED
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default CandidateFlow;
