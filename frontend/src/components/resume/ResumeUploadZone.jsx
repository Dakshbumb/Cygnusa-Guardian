import React, { useCallback, useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, XCircle, FileWarning, RotateCcw } from 'lucide-react';
import { api } from '../../utils/api';

const ERROR_MESSAGES = {
    invalid_format: {
        title: "Invalid File Format",
        message: "Please upload a resume in PDF or DOCX format.",
        icon: <FileWarning className="text-warning-500" size={32} />,
        suggestion: "Convert your resume to PDF and try again."
    },
    not_a_resume: {
        title: "This Doesn't Look Like a Resume",
        message: "The uploaded file doesn't contain resume content.",
        icon: <XCircle className="text-error-500" size={32} />,
        suggestion: "Make sure the file includes your experience, education, and contact info."
    },
    file_too_small: {
        title: "File Too Small",
        message: "This file appears to be incomplete or empty.",
        icon: <AlertCircle className="text-warning-400" size={32} />,
        suggestion: "Please upload a complete resume (minimum 10KB)."
    },
    file_too_large: {
        title: "File Too Large",
        message: "Resume files should be under 5MB.",
        icon: <AlertCircle className="text-error-400" size={32} />,
        suggestion: "Try compressing your PDF or removing unnecessary images."
    },
    missing_contact: {
        title: "Missing Contact Information",
        message: "We couldn't find an email address or phone number.",
        icon: <AlertCircle className="text-warning-500" size={32} />,
        suggestion: "Add your contact details and try again."
    },
    cover_letter: {
        title: "Cover Letter Detected",
        message: "This appears to be a cover letter, not a resume.",
        icon: <FileText className="text-primary-500" size={32} />,
        suggestion: "Please upload your resume/CV instead."
    }
};

export function ResumeUploadZone({ onUploadComplete }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [isValidating, setIsValidating] = useState(false);
    const fileInputRef = useRef(null);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const triggerFilePicker = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const processFile = async (file) => {
        setError(null);
        setIsValidating(true);

        try {
            // Layer 1-3 validation via backend
            const response = await api.validateResume(file);

            if (response.data.success) {
                onUploadComplete(file);
            }
        } catch (err) {
            const errorType = err.response?.data?.error || 'invalid_format';
            setError(ERROR_MESSAGES[errorType] || {
                title: "Processing Error",
                message: err.response?.data?.message || "An unexpected error occurred while validating your file.",
                icon: <XCircle className="text-error-500" size={32} />,
                suggestion: "Please try again or contact support if the issue persists."
            });
        } finally {
            setIsValidating(false);
        }
    };

    if (error) {
        return (
            <div className="bg-surface-elevated border-2 border-error-500/30 rounded-xl p-12 text-center animate-shake">
                <div className="w-16 h-16 rounded-2xl bg-surface-base border border-surface-overlay flex items-center justify-center mb-6 mx-auto">
                    {error.icon}
                </div>
                <h3 className="text-xl font-display font-semibold text-white mb-2">{error.title}</h3>
                <p className="text-neutral-400 mb-6 max-w-sm mx-auto">{error.message}</p>

                <div className="bg-surface-base/50 p-4 rounded-lg mb-8 border border-surface-overlay inline-block text-left">
                    <p className="text-xs font-mono text-neutral-500 mb-1 uppercase">SUGGESTION</p>
                    <p className="text-sm text-neutral-300">{error.suggestion}</p>
                </div>

                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => setError(null)}
                        className="flex items-center gap-2 px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-semibold transition-all"
                    >
                        <RotateCcw size={16} />
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`relative border-2 border-dashed rounded-xl p-12 transition-all duration-300 ${isDragging
                ? 'border-primary-500 bg-primary-500/10 scale-[1.02]'
                : 'border-neutral-700 hover:border-primary-500/50 hover:bg-surface-elevated'
                } ${(isUploading || isValidating) ? 'pointer-events-none opacity-80' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx"
            />

            <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDragging ? 'bg-primary-500 text-white' : 'bg-surface-elevated border border-surface-overlay text-neutral-400'
                    }`}>
                    {isValidating ? (
                        <Loader2 className="animate-spin text-primary-500" size={32} />
                    ) : (
                        <Upload size={32} />
                    )}
                </div>

                <h3 className="text-xl font-display font-semibold text-neutral-100 mb-2">
                    {isValidating ? 'Checkpoint Analysis Active...' : 'Drop Resume for Evidence Analysis'}
                </h3>
                <p className="text-neutral-500 max-w-sm mx-auto mb-8">
                    {isValidating
                        ? 'Running multi-layer verification protocol (Magic Bytes, Structure, AI Classification)...'
                        : 'Drag and drop your PDF/DOCX here. Our AI will extract skills, experience, and integrity signals immediately.'}
                </p>

                <button
                    onClick={triggerFilePicker}
                    disabled={isValidating}
                    className="px-6 py-2 bg-surface-elevated border border-surface-overlay hover:border-primary-500 text-neutral-300 rounded-lg text-sm font-mono transition-colors disabled:opacity-50"
                >
                    {isValidating ? '[ANALYZING...]' : '[SELECT_FILE_MANUALLY]'}
                </button>
            </div>

            {/* Decoration corners */}
            <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg transition-colors ${isValidating ? 'border-primary-500 animate-pulse' : 'border-primary-500/30'}`} />
            <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg transition-colors ${isValidating ? 'border-primary-500 animate-pulse' : 'border-primary-500/30'}`} />
            <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg transition-colors ${isValidating ? 'border-primary-500 animate-pulse' : 'border-primary-500/30'}`} />
            <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg transition-colors ${isValidating ? 'border-primary-500 animate-pulse' : 'border-primary-500/30'}`} />
        </div>
    );
}
