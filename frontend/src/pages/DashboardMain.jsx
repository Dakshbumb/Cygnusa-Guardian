import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart3, Users, RefreshCw, Download, LogOut, Settings
} from 'lucide-react';
import { api } from '../utils/api';

// Import dashboard components
import { DashboardAnalytics } from '../components/dashboard/DashboardAnalytics';
import { StatusPieChart, RoleBarChart, CandidateFlowChart } from '../components/dashboard/DashboardCharts';
import { JobRoleTabs, RoleSummaryCard } from '../components/dashboard/JobRoleTabs';
import { CandidateRoster } from '../components/dashboard/CandidateRoster';
import { RosterFilters } from '../components/dashboard/RosterFilters';
import { BulkActions } from '../components/dashboard/BulkActions';

/**
 * DashboardMain - Main recruiter dashboard landing page
 * Shows analytics, role tabs, and candidate roster
 */
export function DashboardMain() {
    const navigate = useNavigate();

    // Data states
    const [analytics, setAnalytics] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [availableRoles, setAvailableRoles] = useState([]);
    const [roleSummary, setRoleSummary] = useState({});

    // UI states
    const [loading, setLoading] = useState(true);
    const [activeRole, setActiveRole] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [filters, setFilters] = useState({});
    const [refreshing, setRefreshing] = useState(false);

    // Fetch dashboard analytics
    const fetchAnalytics = useCallback(async () => {
        try {
            const res = await api.getDashboardAnalytics();
            if (res.data.success) {
                setAnalytics(res.data.metrics);
            }
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        }
    }, []);

    // Fetch candidates by role
    const fetchCandidates = useCallback(async (role = null) => {
        try {
            const res = await api.getCandidatesByRole(role);
            if (res.data.success) {
                setCandidates(res.data.candidates);
                setAvailableRoles(res.data.available_roles || []);
                setRoleSummary(res.data.role_summary || {});
            }
        } catch (err) {
            console.error('Failed to fetch candidates:', err);
        }
    }, []);

    // Initial data load
    useEffect(() => {
        const loadDashboard = async () => {
            setLoading(true);
            await Promise.all([
                fetchAnalytics(),
                fetchCandidates()
            ]);
            setLoading(false);
        };
        loadDashboard();
    }, [fetchAnalytics, fetchCandidates]);

    // Refresh when role changes
    useEffect(() => {
        fetchCandidates(activeRole);
    }, [activeRole, fetchCandidates]);

    // Handle refresh
    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchAnalytics(),
            fetchCandidates(activeRole)
        ]);
        setRefreshing(false);
    };

    // Handle role tab change
    const handleRoleChange = (role) => {
        setActiveRole(role);
        setSelectedIds([]);
    };

    // Handle candidate click
    const handleCandidateClick = (candidateId) => {
        navigate(`/recruiter/${candidateId}`);
    };

    // Handle bulk action complete
    const handleBulkActionComplete = async (result) => {
        console.log('Bulk action completed:', result);
        await handleRefresh();
    };

    // Filter candidates based on active filters
    const filteredCandidates = useMemo(() => {
        if (!candidates) return [];

        return candidates.filter(c => {
            // Search filter
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const matchesSearch =
                    c.name?.toLowerCase().includes(searchLower) ||
                    c.email?.toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }

            // Status filter
            if (filters.status?.length > 0) {
                if (!filters.status.includes(c.outcome)) return false;
            }

            // Integrity level filter
            if (filters.integrityLevel?.length > 0) {
                if (!filters.integrityLevel.includes(c.integrity_level)) return false;
            }

            // Score range filter
            if (filters.scoreRange) {
                const [min, max] = filters.scoreRange;
                if (c.overall_score < min || c.overall_score > max) return false;
            }

            return true;
        });
    }, [candidates, filters]);

    // Handle logout
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-base flex items-center justify-center">
                <div className="flex items-center gap-3 text-primary-400">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span className="font-mono text-sm">Loading dashboard...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-base">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-surface-base/80 backdrop-blur-lg border-b border-surface-overlay">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-6 h-6 text-primary-500" />
                                <h1 className="text-xl font-bold text-white">Recruiter Dashboard</h1>
                            </div>
                            <span className="px-2 py-1 bg-primary-900/30 text-primary-400 text-xs font-mono rounded border border-primary-500/30">
                                Cygnusa Guardian
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-3 py-2 text-neutral-400 hover:text-white transition-colors"
                            >
                                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                                <span className="text-sm hidden sm:inline">Refresh</span>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-3 py-2 text-neutral-400 hover:text-danger-400 transition-colors"
                            >
                                <LogOut size={16} />
                                <span className="text-sm hidden sm:inline">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* Analytics Section */}
                <section>
                    <DashboardAnalytics
                        metrics={analytics}
                        onMetricClick={(filter) => {
                            if (filter === 'selected') setFilters({ status: ['HIRE'] });
                            else if (filter === 'rejected') setFilters({ status: ['NO_HIRE'] });
                            else if (filter === 'pending') setFilters({ status: ['PENDING', 'CONDITIONAL'] });
                            else setFilters({});
                        }}
                    />
                </section>

                {/* Charts Row */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <StatusPieChart data={analytics?.chart_data?.status_pie || [
                        { label: 'Selected', value: analytics?.selected?.count || 0, color: '#22C55E' },
                        { label: 'Rejected', value: analytics?.rejected?.count || 0, color: '#EF4444' },
                        { label: 'Pending', value: analytics?.pending?.count || 0, color: '#F59E0B' }
                    ]} />
                    <div className="lg:col-span-2">
                        <RoleBarChart data={Object.entries(roleSummary).map(([role, stats]) => ({
                            role,
                            selected: stats.total - stats.pending,
                            pending: stats.pending,
                            rejected: 0
                        }))} />
                    </div>
                </section>

                {/* Role Tabs */}
                <section>
                    <JobRoleTabs
                        roles={availableRoles}
                        roleSummary={roleSummary}
                        activeRole={activeRole}
                        onRoleChange={handleRoleChange}
                    />
                </section>

                {/* Role Summary Card */}
                {activeRole && (
                    <RoleSummaryCard role={activeRole} candidates={filteredCandidates} />
                )}

                {/* Bulk Actions Bar */}
                <BulkActions
                    selectedIds={selectedIds}
                    onActionComplete={handleBulkActionComplete}
                    onClearSelection={() => setSelectedIds([])}
                />

                {/* Filters */}
                <section>
                    <RosterFilters
                        activeFilters={filters}
                        onFiltersChange={setFilters}
                    />
                </section>

                {/* Candidate Roster */}
                <section>
                    <CandidateRoster
                        candidates={filteredCandidates}
                        selectedIds={selectedIds}
                        onSelectChange={setSelectedIds}
                        onCandidateClick={handleCandidateClick}
                        loading={refreshing}
                    />
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-surface-overlay py-6 mt-12">
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-neutral-500">
                    <span className="font-mono">Cygnusa Guardian © 2024</span>
                    <span>Powered by Explainable AI</span>
                </div>
            </footer>
        </div>
    );
}

export default DashboardMain;
