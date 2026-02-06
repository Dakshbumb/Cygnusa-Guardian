import { useState, useCallback } from 'react';
import { Search, Filter, X, SlidersHorizontal, Calendar, Shield, Target } from 'lucide-react';

/**
 * RosterFilters - Advanced filtering and search for candidate roster
 */
export function RosterFilters({ onFiltersChange, activeFilters = {} }) {
    const [searchTerm, setSearchTerm] = useState(activeFilters.search || '');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [filters, setFilters] = useState({
        status: activeFilters.status || [],
        scoreRange: activeFilters.scoreRange || [0, 100],
        integrityLevel: activeFilters.integrityLevel || [],
        ...activeFilters
    });

    const handleSearchChange = useCallback((value) => {
        setSearchTerm(value);
        onFiltersChange?.({ ...filters, search: value });
    }, [filters, onFiltersChange]);

    const handleFilterChange = useCallback((key, value) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFiltersChange?.({ ...newFilters, search: searchTerm });
    }, [filters, searchTerm, onFiltersChange]);

    const toggleStatusFilter = (status) => {
        const current = filters.status || [];
        const newStatus = current.includes(status)
            ? current.filter(s => s !== status)
            : [...current, status];
        handleFilterChange('status', newStatus);
    };

    const toggleIntegrityFilter = (level) => {
        const current = filters.integrityLevel || [];
        const newLevels = current.includes(level)
            ? current.filter(l => l !== level)
            : [...current, level];
        handleFilterChange('integrityLevel', newLevels);
    };

    const clearAllFilters = () => {
        const cleared = { status: [], scoreRange: [0, 100], integrityLevel: [], search: '' };
        setFilters(cleared);
        setSearchTerm('');
        onFiltersChange?.(cleared);
    };

    const hasActiveFilters = searchTerm ||
        filters.status?.length > 0 ||
        filters.integrityLevel?.length > 0 ||
        (filters.scoreRange && (filters.scoreRange[0] > 0 || filters.scoreRange[1] < 100));

    return (
        <div className="space-y-3">
            {/* Main Search Bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search by name, email, or skills..."
                        className="w-full pl-10 pr-4 py-2.5 bg-surface-elevated border border-surface-overlay 
                                 rounded-lg text-white placeholder-neutral-500 font-mono text-sm
                                 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20
                                 transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => handleSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Toggle Advanced Filters */}
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all
                              ${showAdvanced
                            ? 'bg-primary-900/30 border-primary-500/50 text-primary-400'
                            : 'bg-surface-elevated border-surface-overlay text-neutral-400 hover:text-white'}`}
                >
                    <SlidersHorizontal size={18} />
                    <span className="text-sm font-medium hidden sm:inline">Filters</span>
                    {hasActiveFilters && (
                        <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                    )}
                </button>

                {/* Clear All */}
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-neutral-400 hover:text-white 
                                 text-sm font-medium transition-colors"
                    >
                        <X size={14} />
                        Clear
                    </button>
                )}
            </div>

            {/* Advanced Filters Panel */}
            {showAdvanced && (
                <div className="bg-surface-elevated border border-surface-overlay rounded-lg p-4 space-y-4">
                    {/* Status Filter */}
                    <div>
                        <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2 block">
                            Status
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'HIRE', label: 'Selected', color: 'success' },
                                { id: 'CONDITIONAL', label: 'Conditional', color: 'warning' },
                                { id: 'PENDING', label: 'Pending', color: 'warning' },
                                { id: 'NO_HIRE', label: 'Rejected', color: 'danger' }
                            ].map(({ id, label, color }) => (
                                <button
                                    key={id}
                                    onClick={() => toggleStatusFilter(id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                              ${filters.status?.includes(id)
                                            ? `bg-${color}-900/30 border-${color}-500/50 text-${color}-400`
                                            : 'bg-surface-base border-surface-overlay text-neutral-500 hover:text-white'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Score Range Filter */}
                    <div>
                        <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Target size={14} />
                            Score Range
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={filters.scoreRange?.[0] || 0}
                                onChange={(e) => handleFilterChange('scoreRange', [parseInt(e.target.value), filters.scoreRange?.[1] || 100])}
                                className="flex-1 accent-primary-500"
                            />
                            <span className="text-sm font-mono text-neutral-400 w-20">
                                {filters.scoreRange?.[0] || 0}-{filters.scoreRange?.[1] || 100}%
                            </span>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={filters.scoreRange?.[1] || 100}
                                onChange={(e) => handleFilterChange('scoreRange', [filters.scoreRange?.[0] || 0, parseInt(e.target.value)])}
                                className="flex-1 accent-primary-500"
                            />
                        </div>
                    </div>

                    {/* Integrity Level Filter */}
                    <div>
                        <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Shield size={14} />
                            Integrity Level
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'clean', label: 'Clean', color: 'text-success-400 bg-success-900/20 border-success-500/30' },
                                { id: 'minor', label: 'Minor Issues', color: 'text-warning-400 bg-warning-900/20 border-warning-500/30' },
                                { id: 'major', label: 'Major Issues', color: 'text-danger-400 bg-danger-500/20 border-danger-500/30' }
                            ].map(({ id, label, color }) => (
                                <button
                                    key={id}
                                    onClick={() => toggleIntegrityFilter(id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                              ${filters.integrityLevel?.includes(id)
                                            ? color
                                            : 'bg-surface-base border-surface-overlay text-neutral-500 hover:text-white'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Active Filters Display */}
            {hasActiveFilters && !showAdvanced && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-neutral-500 font-mono uppercase">Active:</span>
                    {searchTerm && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-overlay text-xs text-neutral-300">
                            "{searchTerm}"
                            <button onClick={() => handleSearchChange('')} className="hover:text-white">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {filters.status?.map(s => (
                        <span key={s} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-overlay text-xs text-neutral-300">
                            {s}
                            <button onClick={() => toggleStatusFilter(s)} className="hover:text-white">
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default RosterFilters;
