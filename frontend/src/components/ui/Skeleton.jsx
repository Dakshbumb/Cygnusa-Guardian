import React from 'react';

/**
 * Skeleton Loader Components
 * Skeleton loaders provide a better UX than spinners by showing content-shaped placeholders.
 */

/**
 * Base skeleton with shimmer animation
 */
export function Skeleton({ className = '', variant = 'rectangle', width, height }) {
    const baseClasses = 'animate-pulse bg-surface-overlay rounded';

    const variantClasses = {
        rectangle: 'rounded',
        circle: 'rounded-full',
        text: 'rounded h-4',
        title: 'rounded h-6',
    };

    const style = {
        width: width || '100%',
        height: height || (variant === 'text' ? '16px' : variant === 'title' ? '24px' : '100%'),
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant] || ''} ${className}`}
            style={style}
        />
    );
}

/**
 * Card skeleton for dashboard candidate cards
 */
export function CardSkeleton() {
    return (
        <div className="bg-surface-elevated border border-surface-overlay rounded-xl p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Skeleton variant="circle" width={48} height={48} />
                <div className="flex-1 space-y-2">
                    <Skeleton variant="title" width="60%" />
                    <Skeleton variant="text" width="40%" />
                </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="70%" />
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-2">
                <Skeleton width={80} height={32} />
                <Skeleton width={80} height={32} />
            </div>
        </div>
    );
}

/**
 * Table row skeleton for lists
 */
export function TableRowSkeleton({ columns = 5 }) {
    return (
        <tr className="border-b border-surface-overlay">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="px-4 py-4">
                    <Skeleton variant="text" width={`${60 + Math.random() * 30}%`} />
                </td>
            ))}
        </tr>
    );
}

/**
 * Dashboard stats skeleton
 */
export function StatsSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-surface-elevated border border-surface-overlay rounded-lg p-4 space-y-3">
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="title" width="40%" height={32} />
                    <Skeleton variant="text" width="80%" />
                </div>
            ))}
        </div>
    );
}

/**
 * Candidate roster skeleton (list of cards)
 */
export function CandidateRosterSkeleton({ count = 3 }) {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
}

/**
 * Decision card skeleton
 */
export function DecisionCardSkeleton() {
    return (
        <div className="bg-surface-elevated border border-surface-overlay rounded-2xl p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton variant="circle" width={64} height={64} />
                    <div className="space-y-2">
                        <Skeleton variant="title" width={200} />
                        <Skeleton variant="text" width={120} />
                    </div>
                </div>
                <Skeleton width={120} height={48} className="rounded-xl" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="text-center space-y-2">
                        <Skeleton variant="circle" width={48} height={48} className="mx-auto" />
                        <Skeleton variant="text" width="60%" className="mx-auto" />
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="space-y-3">
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="85%" />
                <Skeleton variant="text" width="75%" />
            </div>
        </div>
    );
}

/**
 * Code editor skeleton
 */
export function CodeEditorSkeleton() {
    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-4 border-b border-surface-overlay">
                <Skeleton width={100} height={32} />
                <Skeleton width={80} height={32} />
                <div className="flex-1" />
                <Skeleton width={100} height={36} />
            </div>

            {/* Editor area */}
            <div className="flex-1 p-4 space-y-2">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                        <Skeleton width={24} height={16} />
                        <Skeleton variant="text" width={`${30 + Math.random() * 60}%`} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Assessment loading skeleton (full page)
 */
export function AssessmentSkeleton() {
    return (
        <div className="min-h-screen bg-surface-base p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton variant="rectangle" width={48} height={48} className="rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton variant="title" width={200} />
                        <Skeleton variant="text" width={150} />
                    </div>
                </div>
                <Skeleton width={120} height={40} className="rounded-lg" />
            </div>

            {/* Progress */}
            <Skeleton width="100%" height={4} className="rounded-full" />

            {/* Content */}
            <div className="grid grid-cols-12 gap-8">
                {/* Problem panel */}
                <div className="col-span-4 space-y-4">
                    <Skeleton variant="title" width="80%" />
                    <Skeleton variant="text" />
                    <Skeleton variant="text" width="90%" />
                    <Skeleton variant="text" width="70%" />
                    <Skeleton variant="text" width="85%" />
                </div>

                {/* Editor panel */}
                <div className="col-span-8 border border-surface-overlay rounded-xl overflow-hidden">
                    <CodeEditorSkeleton />
                </div>
            </div>
        </div>
    );
}

export default {
    Skeleton,
    CardSkeleton,
    TableRowSkeleton,
    StatsSkeleton,
    CandidateRosterSkeleton,
    DecisionCardSkeleton,
    CodeEditorSkeleton,
    AssessmentSkeleton
};
