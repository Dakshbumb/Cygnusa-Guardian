import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Upload, FileText, X, AlertCircle, CheckCircle, Loader2,
    ChevronDown, Target, Briefcase, Plus, Search
} from 'lucide-react';
import { api } from '../../utils/api';

// Predefined roles with their required skills
const PREDEFINED_ROLES = [
    { id: 'ai_ml_engineer', title: 'AI/ML Engineer', skills: ['python', 'pytorch', 'tensorflow', 'nlp', 'transformers', 'scikit-learn', 'sql'], critical: ['python', 'pytorch'] },
    { id: 'frontend_architect', title: 'Frontend Architect', skills: ['javascript', 'typescript', 'react', 'nextjs', 'tailwind', 'zustand', 'testing-library'], critical: ['javascript', 'react'] },
    { id: 'backend_developer', title: 'Backend Developer', skills: ['python', 'fastapi', 'postgresql', 'redis', 'docker', 'microservices', 'grpc'], critical: ['python', 'fastapi'] },
    { id: 'devops_engineer', title: 'DevOps Engineer', skills: ['aws', 'kubernetes', 'terraform', 'docker', 'jenkins', 'bash', 'prometheus'], critical: ['kubernetes', 'terraform'] },
    { id: 'data_scientist', title: 'Data Scientist', skills: ['python', 'pandas', 'numpy', 'matplotlib', 'statistics', 'tableau', 'bigquery'], critical: ['python', 'statistics'] },
    { id: 'data_engineer', title: 'Data Engineer', skills: ['spark', 'hadoop', 'airflow', 'kafka', 'etl', 'snowflake', 'dbt'], critical: ['spark', 'etl'] },
    { id: 'fullstack_product_engineer', title: 'Fullstack Engineer', skills: ['typescript', 'node', 'react', 'graphql', 'mongodb', 'stripe api', 'firebase'], critical: ['typescript', 'node', 'react'] },
    { id: 'investment_banker', title: 'Investment Banker', skills: ['financial modeling', 'valuation', 'm&a', 'excel', 'bloomberg terminal', 'dcf', 'lbo'], critical: ['financial modeling', 'valuation'] },
    { id: 'financial_analyst', title: 'Financial Analyst', skills: ['budgeting', 'forecasting', 'variance analysis', 'p&l management', 'sap', 'excel vba'], critical: ['budgeting', 'forecasting'] },
    { id: 'cybersecurity_analyst', title: 'Cybersecurity Analyst', skills: ['penetration testing', 'siem', 'network security', 'firewall', 'ids/ips', 'kali linux'], critical: ['penetration testing', 'network security'] },
];

/**
 * BulkResumeUpload - Multi-file resume upload with role selection and skill merging
 */
export function BulkResumeUpload({ onComplete, onCancel }) {
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);

    // Role and skills configuration
    const [selectedRole, setSelectedRole] = useState(null);
    const [customSkills, setCustomSkills] = useState([]);
    const [newSkill, setNewSkill] = useState('');
    const [customCritical, setCustomCritical] = useState([]);
    const [showRoleSelector, setShowRoleSelector] = useState(false);
    const [roleSearch, setRoleSearch] = useState('');

    const fileInputRef = useRef(null);
    const MAX_FILES = 20;
    const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    // Get merged skills
    const domainSkills = selectedRole?.skills || [];
    const domainCritical = selectedRole?.critical || [];
    const allSkills = [...new Set([...domainSkills, ...customSkills])];
    const allCritical = [...new Set([...domainCritical, ...customCritical])];

    // Filter roles by search
    const filteredRoles = PREDEFINED_ROLES.filter(role =>
        role.title.toLowerCase().includes(roleSearch.toLowerCase())
    );

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const validateFiles = (fileList) => {
        const validFiles = [];
        const errors = [];

        for (const file of fileList) {
            if (!ACCEPTED_TYPES.includes(file.type)) {
                errors.push(`${file.name}: Not a PDF or DOCX file`);
                continue;
            }
            if (file.size > 5 * 1024 * 1024) {
                errors.push(`${file.name}: File too large (max 5MB)`);
                continue;
            }
            if (file.size < 10 * 1024) {
                errors.push(`${file.name}: File too small (min 10KB)`);
                continue;
            }
            validFiles.push(file);
        }

        return { validFiles, errors };
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        const { validFiles, errors } = validateFiles(droppedFiles);

        if (errors.length > 0) {
            setError(errors.join(', '));
        } else {
            setError(null);
        }

        const newFiles = [...files, ...validFiles].slice(0, MAX_FILES);
        setFiles(newFiles);
    }, [files]);

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const { validFiles, errors } = validateFiles(selectedFiles);

        if (errors.length > 0) {
            setError(errors.join(', '));
        } else {
            setError(null);
        }

        const newFiles = [...files, ...validFiles].slice(0, MAX_FILES);
        setFiles(newFiles);
    };

    const removeFile = (index) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const addCustomSkill = () => {
        const skill = newSkill.trim().toLowerCase();
        if (skill && !allSkills.includes(skill)) {
            setCustomSkills([...customSkills, skill]);
            setNewSkill('');
        }
    };

    const removeCustomSkill = (skill) => {
        setCustomSkills(customSkills.filter(s => s !== skill));
        setCustomCritical(customCritical.filter(s => s !== skill));
    };

    const toggleCritical = (skill) => {
        if (customCritical.includes(skill)) {
            setCustomCritical(customCritical.filter(s => s !== skill));
        } else {
            setCustomCritical([...customCritical, skill]);
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            setError('Please add at least one resume file');
            return;
        }

        if (allSkills.length === 0) {
            setError('Please select a role or add custom skills');
            return;
        }

        setIsUploading(true);
        setError(null);
        setUploadProgress(0);

        try {
            const response = await api.bulkAnalyzeResumes(
                files,
                selectedRole?.title || 'Custom Role',
                allSkills.join(','),
                allCritical.join(','),
                (progress) => setUploadProgress(progress)
            );

            if (response.data.success) {
                onComplete?.(response.data);
            } else {
                setError('Upload failed. Please try again.');
            }
        } catch (err) {
            console.error('Bulk upload failed:', err);
            setError(err.response?.data?.detail || 'Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-base border border-surface-overlay rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-surface-overlay flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                            <Upload className="text-primary-400" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Bulk Resume Import</h2>
                            <p className="text-sm text-neutral-400">Upload up to 20 resumes for analysis</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-neutral-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Role Selector */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-neutral-300">Target Role</label>

                        <button
                            onClick={() => setShowRoleSelector(!showRoleSelector)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-surface-elevated rounded-lg border border-surface-overlay hover:border-primary-500/30 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Briefcase size={18} className="text-primary-400" />
                                {selectedRole ? (
                                    <div className="text-left">
                                        <span className="text-neutral-200">{selectedRole.title}</span>
                                        <span className="ml-2 text-xs text-neutral-500">
                                            {selectedRole.skills.length} domain skills
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-neutral-500">Select a role...</span>
                                )}
                            </div>
                            <ChevronDown size={16} className={`text-neutral-500 transition-transform ${showRoleSelector ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Role Dropdown */}
                        {showRoleSelector && (
                            <div className="bg-surface-elevated rounded-lg border border-surface-overlay overflow-hidden animate-fade-in-down">
                                <div className="p-2 border-b border-surface-overlay">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                                        <input
                                            type="text"
                                            value={roleSearch}
                                            onChange={(e) => setRoleSearch(e.target.value)}
                                            placeholder="Search roles..."
                                            className="w-full pl-8 pr-3 py-2 bg-surface-base border border-surface-overlay rounded text-sm text-white placeholder-neutral-500 focus:border-primary-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {filteredRoles.map(role => (
                                        <button
                                            key={role.id}
                                            onClick={() => {
                                                setSelectedRole(role);
                                                setShowRoleSelector(false);
                                                setRoleSearch('');
                                            }}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-overlay transition-colors ${selectedRole?.id === role.id ? 'bg-primary-500/10 text-primary-400' : 'text-neutral-300'
                                                }`}
                                        >
                                            <span>{role.title}</span>
                                            <span className="text-xs text-neutral-500">{role.skills.length} skills</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Skills Display */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-neutral-300">Required Skills</label>
                            <span className="text-xs text-neutral-500">
                                {domainSkills.length > 0 && (
                                    <span className="text-primary-400">{domainSkills.length} domain</span>
                                )}
                                {domainSkills.length > 0 && customSkills.length > 0 && ' + '}
                                {customSkills.length > 0 && (
                                    <span className="text-accent-400">{customSkills.length} custom</span>
                                )}
                            </span>
                        </div>

                        {/* Combined Skills Display */}
                        <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-surface-elevated rounded-lg border border-surface-overlay">
                            {/* Domain Skills */}
                            {domainSkills.map((skill, i) => (
                                <span
                                    key={`domain-${i}`}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${domainCritical.includes(skill)
                                            ? 'bg-warning-900/30 text-warning-400 border-warning-500/30'
                                            : 'bg-primary-900/30 text-primary-400 border-primary-500/30'
                                        }`}
                                >
                                    {skill}
                                    {domainCritical.includes(skill) && ' ★'}
                                </span>
                            ))}

                            {/* Custom Skills */}
                            {customSkills.map((skill, i) => (
                                <span
                                    key={`custom-${i}`}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${customCritical.includes(skill)
                                            ? 'bg-warning-900/30 text-warning-400 border-warning-500/30'
                                            : 'bg-accent-900/30 text-accent-400 border-accent-500/30'
                                        }`}
                                >
                                    {skill}
                                    {customCritical.includes(skill) && ' ★'}
                                    <button
                                        onClick={() => removeCustomSkill(skill)}
                                        className="hover:text-danger-400"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}

                            {allSkills.length === 0 && (
                                <span className="text-neutral-500 text-xs">No skills selected</span>
                            )}
                        </div>

                        {/* Add Custom Skill */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newSkill}
                                onChange={(e) => setNewSkill(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addCustomSkill()}
                                placeholder="Add custom skill..."
                                className="flex-1 px-3 py-2 bg-surface-base border border-surface-overlay rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                            />
                            <button
                                onClick={addCustomSkill}
                                disabled={!newSkill.trim()}
                                className="px-3 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-neutral-500">
                            ★ = Critical (must-have). Click on custom skills to toggle as critical.
                        </p>
                    </div>

                    {/* Drop Zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                            ${isDragging
                                ? 'border-primary-500 bg-primary-500/10'
                                : 'border-surface-overlay hover:border-primary-500/50 hover:bg-surface-elevated'
                            }
                        `}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.docx"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        <div className="flex flex-col items-center gap-2">
                            <Upload size={24} className={isDragging ? 'text-primary-400' : 'text-neutral-400'} />
                            <p className="text-neutral-300 text-sm">
                                {isDragging ? 'Drop files here' : 'Drag & drop resumes or click to browse'}
                            </p>
                            <p className="text-xs text-neutral-500">PDF, DOCX • Max 20 files</p>
                        </div>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-neutral-400">{files.length} file{files.length > 1 ? 's' : ''}</span>
                                <button
                                    onClick={() => setFiles([])}
                                    className="text-danger-400 hover:text-danger-300 transition-colors text-xs"
                                >
                                    Clear all
                                </button>
                            </div>

                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {files.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between px-3 py-2 bg-surface-elevated rounded-lg border border-surface-overlay"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={14} className="text-primary-400 flex-shrink-0" />
                                            <span className="text-xs text-neutral-300 truncate">{file.name}</span>
                                        </div>
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="text-neutral-500 hover:text-danger-400 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 px-4 py-3 bg-danger-500/10 border border-danger-500/30 rounded-lg">
                            <AlertCircle size={16} className="text-danger-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-danger-300">{error}</p>
                        </div>
                    )}

                    {/* Progress */}
                    {isUploading && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-neutral-400">Analyzing resumes...</span>
                                <span className="text-primary-400 font-mono">{uploadProgress}%</span>
                            </div>
                            <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-surface-overlay flex items-center justify-between">
                    <div className="text-sm text-neutral-500">
                        <Target size={14} className="inline mr-1" />
                        {allSkills.length} skills total
                        {allCritical.length > 0 && ` • ${allCritical.length} critical`}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onCancel}
                            disabled={isUploading}
                            className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={files.length === 0 || allSkills.length === 0 || isUploading}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-500 text-white font-medium
                                     hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    Analyze {files.length || ''} Resume{files.length !== 1 ? 's' : ''}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BulkResumeUpload;
