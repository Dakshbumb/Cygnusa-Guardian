import axios from 'axios';

let rawApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Security & Robustness: Ensure protocol is present
if (rawApiBase && !rawApiBase.startsWith('http')) {
    rawApiBase = `https://${rawApiBase}`;
}

const cleanBase = rawApiBase.replace(/\/$/, '').replace(/\/api$/, '');
const API_BASE = `${cleanBase}/api`;
export const BASE_URL = cleanBase;

// Alert the developer if using internal Railway URL by mistake
if (cleanBase.includes('railway.internal')) {
    console.error('❌ CRITICAL CONFIG ERROR: You are using a PRIVATE Railway internal URL. This will NOT work in the browser. Please use the public .railway.app domain in your Vercel environment variables.');
}

console.log(`%c 🌐 Cygnusa Guardian API Initialized `, 'background: #2563eb; color: white; font-weight: bold; border-radius: 4px; padding: 2px 4px;');
console.log(`📍 API_BASE: ${API_BASE}`);
console.log(`📍 BASE_URL: ${BASE_URL}`);
console.log(`📍 ENV_MODE: ${import.meta.env.MODE}`);

// Create axios instance with optimized defaults
const http = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 30000, // 30 second timeout
});

// Simple in-memory cache for GET requests
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds default TTL

const getCacheKey = (url, params) => {
    return `${url}:${JSON.stringify(params || {})}`;
};

const getFromCache = (key) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
    }
    cache.delete(key);
    return null;
};

const setCache = (key, data, ttl = CACHE_TTL) => {
    cache.set(key, { data, timestamp: Date.now(), ttl });
};

// Clear cache for a specific pattern
const clearCache = (pattern) => {
    for (const key of cache.keys()) {
        if (key.includes(pattern)) {
            cache.delete(key);
        }
    }
};

// Cached GET request helper
const cachedGet = async (url, options = {}) => {
    const { ttl = CACHE_TTL, skipCache = false, params } = options;
    const cacheKey = getCacheKey(url, params);

    if (!skipCache) {
        const cached = getFromCache(cacheKey);
        if (cached) {
            return { data: cached, fromCache: true };
        }
    }

    const response = await http.get(url, { params });
    setCache(cacheKey, response.data, ttl);
    return response;
};

// Request interceptor - add auth header to all requests
http.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - auto-redirect on 401
http.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user_id');
            localStorage.removeItem('role');
            localStorage.removeItem('name');

            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Helper to create FormData
const createFormData = (data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            fd.append(key, value);
        }
    });
    return fd;
};

export const api = {
    // ==================== Authentication ====================
    login: (email, role) => http.post('/auth/login', { email, role }),
    getMe: () => http.get('/auth/me'),
    health: () => http.get('/health'),

    // ==================== Candidates ====================
    createCandidate: async (name, email, jobTitle) => {
        const fd = createFormData({ name, email, job_title: jobTitle });
        return http.post('/candidates', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    getCandidate: (candidateId) => http.get(`/candidates/${candidateId}`),
    listCandidates: (status = null) =>
        http.get('/candidates', { params: status ? { status } : {} }),
    deleteCandidate: (candidateId) => http.delete(`/candidates/${candidateId}`),

    // ==================== Resume ====================
    getRoles: () => http.get('/roles'),
    validateResume: async (file) => {
        const fd = createFormData({ file });
        return http.post('/resume/validate', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    analyzeResume: async (file, jdSkills = 'python,javascript,react', name = 'Candidate', email = 'candidate@example.com', jobTitle = 'Software Engineer') => {
        const fd = createFormData({
            file,
            jd_skills: jdSkills,
            candidate_name: name,
            candidate_email: email,
            job_title: jobTitle
        });
        return http.post('/resume/analyze', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000 // 60 second timeout for AI-powered analysis
        });
    },
    uploadResume: async (candidateId, file, jdSkills, criticalSkills = "") => {
        const fd = createFormData({
            candidate_id: candidateId,
            file: file,
            jd_skills: jdSkills,
            critical_skills: criticalSkills
        });
        return http.post('/resume/upload', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    // ==================== Assessment ====================
    startAssessment: async (candidateId) => {
        const fd = createFormData({ candidate_id: candidateId });
        return http.post('/assessment/start', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    submitCode: async (candidateId, questionId, code, language = 'python', timing = {}) => {
        const fd = createFormData({
            candidate_id: candidateId,
            question_id: questionId,
            code: code,
            language: language,
            time_started: timing.timeStarted || null,
            time_submitted: timing.timeSubmitted || null,
            duration_seconds: timing.durationSeconds || null
        });
        return http.post('/assessment/submit-code', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    submitMCQ: async (candidateId, questionId, questionText, selected, correct, competency, timing = {}) => {
        const fd = createFormData({
            candidate_id: candidateId,
            question_id: questionId,
            question_text: questionText,
            selected_option: selected,
            correct_option: correct,
            competency: competency,
            time_started: timing.timeStarted || null,
            time_submitted: timing.timeSubmitted || null,
            duration_seconds: timing.durationSeconds || null
        });
        return http.post('/assessment/submit-mcq', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    submitText: async (candidateId, questionId, questionText, answerText, competency, timeTaken = 0) => {
        const fd = createFormData({
            candidate_id: candidateId,
            question_id: questionId,
            question_text: questionText,
            answer_text: answerText,
            competency: competency,
            time_taken_seconds: timeTaken
        });
        return http.post('/assessment/submit-text', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    submitPsychometric: async (candidateId, scores) => {
        const fd = createFormData({
            candidate_id: candidateId,
            resilience: scores.resilience || 5,
            leadership: scores.leadership || 5,
            learning: scores.learning || 5,
            teamwork: scores.teamwork || 5,
            pressure: scores.pressure || 5
        });
        return http.post('/assessment/submit-psychometric', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    generateProbe: async (candidateId, questionId, code) => {
        const fd = createFormData({ candidate_id: candidateId, question_id: questionId, code });
        return http.post('/assessment/probe', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    submitProbe: async (candidateId, questionId, probeQuestion, answer, targetConcept) => {
        const fd = createFormData({
            candidate_id: candidateId,
            question_id: questionId,
            probe_question: probeQuestion,
            answer: answer,
            target_concept: targetConcept
        });
        return http.post('/assessment/submit-probe', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    // ==================== Claim Probing Engine ====================
    getClaimProbes: (candidateId) => http.get(`/assessment/claim-probes/${candidateId}`),
    submitClaimProbe: async (candidateId, claimId, claimText, probeQuestion, answer, claimType = 'general') => {
        const fd = createFormData({
            candidate_id: candidateId,
            claim_id: claimId,
            claim_text: claimText,
            probe_question: probeQuestion,
            answer: answer,
            claim_type: claimType
        });
        return http.post('/assessment/submit-claim-probe', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    submitKeystrokeData: async (candidateId, intervals) => {
        const fd = createFormData({
            candidate_id: candidateId,
            intervals_json: JSON.stringify(intervals)
        });
        return http.post('/assessment/keystroke-data', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    getAuthenticityScore: (candidateId) => http.get(`/assessment/authenticity-score/${candidateId}`),

    // ==================== Integrity ====================
    logIntegrity: async (candidateId, eventType, severity, context = null) => {
        const fd = createFormData({
            candidate_id: candidateId,
            event_type: eventType,
            severity: severity,
            context: context
        });
        return http.post('/integrity/log', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    uploadSnapshot: async (candidateId, imageBlob, faceDetected = null) => {
        const fd = createFormData({
            candidate_id: candidateId,
            snapshot: imageBlob,
            face_detected: faceDetected
        });
        return http.post('/assessment/upload-snapshot', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    getIntegrity: (candidateId) => http.get(`/integrity/${candidateId}`),
    getSnapshots: (candidateId) => http.get(`/assessment/snapshots/${candidateId}`),

    // ==================== Report & Sharing ====================
    generateReport: (candidateId) => http.post(`/assessment/generate-report/${candidateId}`),
    exportReport: (candidateId) => {
        window.open(`${API_BASE}/report/export/${candidateId}`, '_blank');
    },
    createShareLink: async (candidateId, expiresHours = 72) => {
        return http.post(`/report/share/${candidateId}?expires_hours=${expiresHours}`);
    },
    getSharedReport: async (shareToken) => {
        return http.get(`/report/shared/${shareToken}`);
    },
    revokeShareLink: async (shareToken) => {
        return http.delete(`/report/share/${shareToken}`);
    },

    // ==================== Demo ====================
    seedDemo: () => http.post('/demo/seed'),

    // ==================== Dashboard Analytics ====================
    getDashboardAnalytics: () => http.get('/dashboard/analytics'),
    getCandidatesByRole: (role = null) =>
        http.get('/dashboard/candidates-by-role', { params: role ? { role } : {} }),
    bulkUpdateCandidates: async (candidateIds, action, notes = '') => {
        return http.patch('/candidates/bulk-update', {
            candidate_ids: candidateIds,
            action: action,
            notes: notes
        });
    },
    addRecruiterNote: async (candidateId, note) => {
        return http.post(`/candidates/${candidateId}/notes`, { note });
    },

    // ==================== Interview Scheduling ====================
    scheduleInterview: async (data) => {
        return http.post('/interviews/schedule', data);
    },
    getInterviewSchedule: (candidateId) => http.get(`/interviews/${candidateId}`),
    getUpcomingInterviews: () => http.get('/interviews/upcoming'),

    // ==================== Dashboard ====================
    getLiveDashboard: () => http.get('/dashboard/live'),

    // ==================== Bulk Resume Import ====================
    bulkAnalyzeResumes: async (files, jobTitle = 'Software Engineer', jdSkills = 'python,javascript,react', criticalSkills = '', onProgress = null) => {
        const fd = new FormData();
        fd.append('job_title', jobTitle);
        fd.append('jd_skills', jdSkills);
        fd.append('critical_skills', criticalSkills);

        // Append all files
        for (const file of files) {
            fd.append('files', file);
        }

        return http.post('/resume/bulk-analyze', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000, // 2 minute timeout for bulk processing
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                    onProgress(percentComplete);
                }
            }
        });
    }
};

export default api;
