import Editor from '@monaco-editor/react';
import { useState } from 'react';
import { Play, RotateCcw, Check, X, Clock, AlertCircle, Terminal, Code } from 'lucide-react';

/**
 * CodeEditor - Monaco-based code editor with test results display
 */
export function CodeEditor({
    questionId,
    title,
    description,
    template,
    language: initialLanguage = 'python',
    onSubmit,
    isLoading = false,
    results = null
}) {
    const [code, setCode] = useState(template);
    const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);

    const languages = [
        { id: 'python', label: 'Python 3', icon: '🐍' },
        { id: 'java', label: 'Java 17', icon: '☕' },
        { id: 'cpp', label: 'C++', icon: '⚙️' }
    ];

    const handleReset = () => {
        setCode(template);
    };

    return (
        <div className="bg-surface-elevated rounded-lg shadow-2xl border border-surface-overlay overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-3 border-b border-surface-overlay bg-surface-base flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Code size={18} className="text-primary-400" />
                        <h3 className="font-mono font-semibold text-neutral-200">{title}</h3>
                    </div>

                    <div className="flex items-center bg-surface-elevated border border-surface-overlay rounded-lg p-0.5">
                        {languages.map((lang) => (
                            <button
                                key={lang.id}
                                onClick={() => setCurrentLanguage(lang.id)}
                                className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-mono transition-all ${currentLanguage === lang.id
                                    ? 'bg-primary-900/50 text-primary-300 border border-primary-500/30'
                                    : 'text-neutral-500 hover:text-neutral-300'
                                    }`}
                            >
                                <span>{lang.icon}</span>
                                <span className="uppercase tracking-tight">{lang.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-xs font-mono text-neutral-500 uppercase tracking-widest hidden md:block">
                    SECURE_EXECUTION_ENVIRONMENT
                </div>
            </div>

            {/* Description Panel */}
            <div className="px-6 py-4 bg-surface-elevated border-b border-surface-overlay">
                <p className="text-neutral-400 text-sm leading-relaxed font-sans">{description}</p>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-[400px] border-b border-surface-overlay relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary-500/20 z-10 pointer-events-none" />
                <Editor
                    height="100%"
                    language={currentLanguage === 'cpp' ? 'cpp' : currentLanguage}
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: 'on',
                        padding: { top: 16 },
                        renderLineHighlight: 'all',
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        smoothScrolling: true
                    }}
                />
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-surface-base flex items-center justify-between border-t border-surface-overlay">
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 text-neutral-500 hover:text-white hover:bg-surface-overlay rounded-lg transition-colors font-mono text-xs uppercase tracking-wider"
                >
                    <RotateCcw size={14} />
                    <span>RESET_BUFFER</span>
                </button>

                <button
                    onClick={() => onSubmit(code, currentLanguage)}
                    disabled={isLoading}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-mono text-sm font-bold transition-all ${isLoading
                        ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                        : 'bg-primary-600 text-white hover:bg-primary-500 shadow-lg shadow-primary-900/50 border border-primary-500 hover:scale-[1.02]'
                        }`}
                >
                    {isLoading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-primary-300 border-t-transparent rounded-full animate-spin" />
                            <span>EXECUTING...</span>
                        </>
                    ) : (
                        <>
                            <Play size={16} className="fill-current" />
                            <span>RUN_AND_VERIFY</span>
                        </>
                    )}
                </button>
            </div>

            {/* Test Results */}
            {results && (
                <div className="border-t-2 border-surface-overlay bg-[#0a0a0b] animate-slide-in font-mono shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.8)]">
                    {/* Terminal Header */}
                    <div className="px-6 py-2 bg-neutral-900 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Terminal size={14} className="text-primary-400" />
                            <span className="text-[10px] font-bold text-neutral-400 tracking-[0.2em]">┌─ TEST RESULTS ────────────────────┐</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px]">
                            <span className="text-neutral-500">SESSION: {results.question_id.slice(0, 4)}</span>
                            <span className="text-neutral-500">LATENCY: {results.avg_time_ms.toFixed(1)}ms</span>
                        </div>
                    </div>

                    <div className="px-6 py-4 space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
                        {results.test_cases.map((tc, i) => (
                            <div key={i} className="group">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-3">
                                        <span className={tc.passed ? 'text-success-400' : 'text-danger-400'}>
                                            {tc.passed ? '✓' : '✗'}
                                        </span>
                                        <span className="text-neutral-300">
                                            Test {i + 1}: <span className="text-neutral-500 italic">INPUT:</span> <span className="text-primary-300">{typeof tc.input === 'object' ? JSON.stringify(tc.input) : tc.input}</span>
                                        </span>
                                    </div>
                                    <span className="text-neutral-600 text-xs">[{tc.time_ms}ms]</span>
                                </div>

                                {!tc.passed && (
                                    <div className="mt-2 ml-6 pl-4 border-l border-danger-500/30 space-y-1 text-xs">
                                        <div className="flex gap-2">
                                            <span className="text-neutral-500 w-16">Expected:</span>
                                            <span className="text-success-400">{tc.expected}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-neutral-500 w-16">Actual:</span>
                                            <span className="text-danger-400">{tc.actual}</span>
                                        </div>
                                        {tc.error && (
                                            <div className="text-neutral-500 italic mt-1 font-sans opacity-70">
                                                // {tc.error}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Terminal Footer */}
                    <div className="px-6 py-3 bg-neutral-900/50 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider ${results.pass_rate >= 80 ? 'bg-success-500/10 text-success-400 border border-success-500/20' :
                                results.pass_rate >= 50 ? 'bg-warning-500/10 text-warning-400 border border-warning-500/20' :
                                    'bg-danger-500/10 text-danger-400 border border-danger-500/20'
                                }`}>
                                PASS RATE: {results.pass_rate}% ({results.test_cases.filter(t => t.passed).length}/{results.test_cases.length})
                            </div>
                        </div>
                        <span className="text-[10px] text-neutral-600 tracking-[0.2em]">└───────────────────────────────────┘</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CodeEditor;
