import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Header } from '../components/Header';
import {
    Users, Activity, AlertTriangle, CheckCircle, XCircle,
    Eye, Clock, Shield, Zap, RefreshCw, Radio, Loader,
    ChevronRight, User, Briefcase
} from 'lucide-react';

/**
 * LiveMonitorPage - Real-time recruiter dashboard
 * Shows active candidates, their progress, and integrity events
 */
export function LiveMonitorPage() {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isPolling, setIsPolling] = useState(true);
    const pollInterval = useRef(null);

    // Fetch dashboard data
    const fetchDashboard = async () => {
        try {
            const response = await api.getLiveDashboard();
            setDashboard(response.data);
            setLastUpdate(new Date());
            setError(null);
        } catch (err) {
            console.error('Failed to fetch dashboard:', err);
            setError('Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    // Initial load and polling setup
    useEffect(() => {
        fetchDashboard();

        if (isPolling) {
            pollInterval.current = setInterval(fetchDashboard, 3000); // Poll every 3 seconds
        }

        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, [isPolling]);

    // Get integrity status color
    const getIntegrityColor = (status) => {
        switch (status) {
            case 'clean': return 'text-green-400 bg-green-900/20 border-green-500/30';
            case 'warning': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
            case 'flagged': return 'text-red-400 bg-red-900/20 border-red-500/30';
            default: return 'text-neutral-400 bg-neutral-900/20 border-neutral-500/30';
        }
    };

    // Get outcome color
    const getOutcomeColor = (outcome) => {
        switch (outcome) {
            case 'HIRE': return 'text-green-400';
            case 'CONDITIONAL': return 'text-yellow-400';
            case 'NO_HIRE': return 'text-red-400';
            default: return 'text-neutral-400';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-base flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader size={48} className="animate-spin text-primary-400" />
                    <p className="text-neutral-400">Loading live dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-base flex flex-col">
            <Header />

            <div className="flex-1 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center">
                            <Radio size={24} className="text-primary-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-neutral-100">Live Monitor</h1>
                            <p className="text-sm text-neutral-500">Real-time candidate tracking</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Polling Status */}
                        <div className="flex items-center gap-2 text-sm">
                            <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-500 animate-pulse' : 'bg-neutral-500'}`}></span>
                            <span className="text-neutral-400">
                                {isPolling ? 'Live' : 'Paused'}
                            </span>
                        </div>

                        {/* Toggle Polling */}
                        <button
                            onClick={() => setIsPolling(!isPolling)}
                            className="px-3 py-1.5 rounded-lg border border-surface-overlay bg-surface-elevated text-neutral-300 hover:bg-surface-overlay transition-all text-sm"
                        >
                            {isPolling ? 'Pause' : 'Resume'}
                        </button>

                        {/* Manual Refresh */}
                        <button
                            onClick={fetchDashboard}
                            className="p-2 rounded-lg border border-surface-overlay bg-surface-elevated text-neutral-300 hover:bg-surface-overlay transition-all"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-surface-elevated border border-surface-overlay rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                                <Users size={20} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-100">
                                    {dashboard?.stats?.total_in_progress || 0}
                                </p>
                                <p className="text-xs text-neutral-500">Active Now</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface-elevated border border-surface-overlay rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                                <CheckCircle size={20} className="text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-100">
                                    {dashboard?.stats?.total_completed || 0}
                                </p>
                                <p className="text-xs text-neutral-500">Completed</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface-elevated border border-surface-overlay rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                                <AlertTriangle size={20} className="text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-100">
                                    {dashboard?.stats?.flagged_count || 0}
                                </p>
                                <p className="text-xs text-neutral-500">Flagged</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface-elevated border border-surface-overlay rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                                <Clock size={20} className="text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm font-mono text-neutral-100">
                                    {lastUpdate?.toLocaleTimeString() || '--:--:--'}
                                </p>
                                <p className="text-xs text-neutral-500">Last Update</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Active Candidates - Takes 2 columns */}
                    <div className="lg:col-span-2 bg-surface-elevated border border-surface-overlay rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-surface-overlay bg-surface-base/50 flex items-center justify-between">
                            <h2 className="font-bold text-neutral-200 flex items-center gap-2">
                                <Activity size={16} className="text-primary-400" />
                                Active Candidates
                            </h2>
                            <span className="text-xs text-neutral-500">
                                {dashboard?.active_count || 0} in progress
                            </span>
                        </div>

                        <div className="divide-y divide-surface-overlay">
                            {dashboard?.active_candidates?.length === 0 ? (
                                <div className="p-12 text-center text-neutral-500">
                                    <Users size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>No active assessments</p>
                                </div>
                            ) : (
                                dashboard?.active_candidates?.map(candidate => (
                                    <div
                                        key={candidate.id}
                                        className="p-4 hover:bg-surface-overlay/50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/recruiter/${candidate.id}`)}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-surface-base flex items-center justify-center">
                                                    <User size={18} className="text-neutral-400" />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-neutral-100">{candidate.name}</h3>
                                                    <p className="text-xs text-neutral-500 flex items-center gap-1">
                                                        <Briefcase size={10} />
                                                        {candidate.job_title}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {/* Integrity Badge */}
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getIntegrityColor(candidate.integrity?.status)}`}>
                                                    {candidate.integrity?.status?.toUpperCase()}
                                                </span>
                                                <ChevronRight size={16} className="text-neutral-500" />
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-surface-base rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary-500 transition-all duration-500"
                                                    style={{ width: `${candidate.progress_percent}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs text-neutral-400 w-12 text-right">
                                                {candidate.progress_percent}%
                                            </span>
                                        </div>

                                        {/* Sections */}
                                        <div className="flex gap-4 mt-2 text-xs text-neutral-500">
                                            <span>Code: {candidate.sections_completed?.coding || 0}</span>
                                            <span>MCQ: {candidate.sections_completed?.mcq || 0}</span>
                                            <span>Text: {candidate.sections_completed?.text || 0}</span>
                                            <span>Psych: {candidate.sections_completed?.psychometric ? '✓' : '-'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Recently Completed - Right column */}
                    <div className="bg-surface-elevated border border-surface-overlay rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-surface-overlay bg-surface-base/50">
                            <h2 className="font-bold text-neutral-200 flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-400" />
                                Recently Completed
                            </h2>
                        </div>

                        <div className="divide-y divide-surface-overlay max-h-96 overflow-y-auto">
                            {dashboard?.recently_completed?.length === 0 ? (
                                <div className="p-8 text-center text-neutral-500">
                                    <p className="text-sm">No completed assessments</p>
                                </div>
                            ) : (
                                dashboard?.recently_completed?.map(candidate => (
                                    <div
                                        key={candidate.id}
                                        className="p-4 hover:bg-surface-overlay/50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/recruiter/${candidate.id}`)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-medium text-neutral-200 text-sm">{candidate.name}</h3>
                                                <p className="text-xs text-neutral-500">{candidate.job_title}</p>
                                            </div>
                                            <span className={`text-sm font-bold ${getOutcomeColor(candidate.outcome)}`}>
                                                {candidate.outcome}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LiveMonitorPage;
