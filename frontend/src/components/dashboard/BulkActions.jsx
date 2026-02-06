import { useState } from 'react';
import {
    CheckSquare, XSquare, Clock, Download, Mail,
    ChevronDown, Loader2, AlertCircle
} from 'lucide-react';
import { api } from '../../utils/api';

/**
 * BulkActions - Toolbar for multi-select operations
 */
export function BulkActions({
    selectedIds = [],
    onActionComplete,
    onClearSelection
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [error, setError] = useState(null);

    const handleBulkAction = async (action) => {
        if (selectedIds.length === 0) return;

        setIsLoading(true);
        setError(null);
        setShowDropdown(false);

        try {
            const result = await api.bulkUpdateCandidates(selectedIds, action);
            if (result.data.success) {
                onActionComplete?.({
                    action,
                    updatedCount: result.data.updated_count,
                    failed: result.data.failed
                });
                onClearSelection?.();
            }
        } catch (err) {
            console.error('Bulk action failed:', err);
            setError(err.response?.data?.detail || 'Action failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = () => {
        // Trigger export for selected candidates
        selectedIds.forEach(id => {
            api.exportReport(id);
        });
        setShowDropdown(false);
    };

    if (selectedIds.length === 0) {
        return null;
    }

    return (
        <div className="bg-surface-elevated border border-primary-500/30 rounded-lg p-3 flex items-center justify-between gap-4 animate-fade-in-down">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-primary-400">
                    <CheckSquare size={18} />
                    <span className="font-mono text-sm">
                        {selectedIds.length} candidate{selectedIds.length > 1 ? 's' : ''} selected
                    </span>
                </div>

                <button
                    onClick={onClearSelection}
                    className="text-xs text-neutral-500 hover:text-white transition-colors"
                >
                    Clear selection
                </button>
            </div>

            <div className="flex items-center gap-2">
                {error && (
                    <div className="flex items-center gap-1.5 text-danger-400 text-xs">
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}

                {/* Quick Actions */}
                <button
                    onClick={() => handleBulkAction('select')}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-success-900/30 text-success-400 
                             border border-success-500/30 hover:bg-success-900/50 transition-all text-xs font-medium
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
                    Select All
                </button>

                <button
                    onClick={() => handleBulkAction('reject')}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-danger-500/20 text-danger-400 
                             border border-danger-500/30 hover:bg-danger-500/30 transition-all text-xs font-medium
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <XSquare size={14} />}
                    Reject All
                </button>

                <button
                    onClick={() => handleBulkAction('pending')}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-warning-900/30 text-warning-400 
                             border border-warning-500/30 hover:bg-warning-900/50 transition-all text-xs font-medium
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                    Mark Pending
                </button>

                {/* More Actions Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-overlay text-neutral-400 
                                 hover:text-white transition-all text-xs font-medium border border-surface-overlay"
                    >
                        More
                        <ChevronDown size={14} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showDropdown && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowDropdown(false)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-surface-elevated border border-surface-overlay 
                                          rounded-lg shadow-xl z-20 overflow-hidden">
                                <button
                                    onClick={handleExport}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-300 
                                             hover:bg-surface-overlay hover:text-white transition-colors"
                                >
                                    <Download size={16} />
                                    Export Reports
                                </button>
                                <button
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-300 
                                             hover:bg-surface-overlay hover:text-white transition-colors"
                                >
                                    <Mail size={16} />
                                    Send Bulk Email
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BulkActions;
