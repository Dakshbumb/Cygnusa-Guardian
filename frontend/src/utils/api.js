import axios from 'axios';

const rawApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const cleanBase = rawApiBase.replace(/\/$/, '').replace(/\/api$/, '');
const API_BASE = `${cleanBase}/api`;
export const BASE_URL = cleanBase;

console.log('🌐 Cygnusa Guardian API Initialized:', { API_BASE, BASE_URL, MODE: import.meta.env.MODE });

// Create axios instance with defaults
const http = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json'
    }
});

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
            headers: { 'Content-Type': 'multipart/form-data' }
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

    // ==================== Dashboard ====================
    getLiveDashboard: () => http.get('/dashboard/live')
};

export default api;
