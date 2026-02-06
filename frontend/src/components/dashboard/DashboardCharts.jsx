import { useMemo } from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    ArcElement,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const chartColors = {
    selected: '#22C55E',
    rejected: '#EF4444',
    pending: '#F59E0B',
    primary: '#6366F1',
    secondary: '#8B5CF6'
};

/**
 * StatusPieChart - Distribution of candidate statuses
 */
export function StatusPieChart({ data }) {
    const chartData = useMemo(() => ({
        labels: data?.map(d => d.label) || ['Selected', 'Rejected', 'Pending'],
        datasets: [{
            data: data?.map(d => d.value) || [0, 0, 0],
            backgroundColor: data?.map(d => d.color) || [chartColors.selected, chartColors.rejected, chartColors.pending],
            borderColor: '#0F172A',
            borderWidth: 3,
            hoverOffset: 8
        }]
    }), [data]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#94A3B8',
                    font: { family: "'JetBrains Mono', monospace", size: 11 },
                    padding: 16,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: '#1E293B',
                titleColor: '#F1F5F9',
                bodyColor: '#CBD5E1',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                bodyFont: { family: "'JetBrains Mono', monospace" },
                callbacks: {
                    label: (ctx) => {
                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                        return `${ctx.label}: ${ctx.raw} (${pct}%)`;
                    }
                }
            }
        }
    };

    return (
        <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
            <h3 className="text-sm font-mono text-neutral-400 uppercase tracking-widest mb-4">
                Status Distribution
            </h3>
            <div className="h-64">
                <Pie data={chartData} options={options} />
            </div>
        </div>
    );
}

/**
 * RoleBarChart - Performance comparison across job roles
 */
export function RoleBarChart({ data }) {
    const chartData = useMemo(() => ({
        labels: data?.map(d => d.role) || [],
        datasets: [
            {
                label: 'Selected',
                data: data?.map(d => d.selected) || [],
                backgroundColor: chartColors.selected,
                borderRadius: 4,
                barThickness: 20
            },
            {
                label: 'Pending',
                data: data?.map(d => d.pending) || [],
                backgroundColor: chartColors.pending,
                borderRadius: 4,
                barThickness: 20
            },
            {
                label: 'Rejected',
                data: data?.map(d => d.rejected) || [],
                backgroundColor: chartColors.rejected,
                borderRadius: 4,
                barThickness: 20
            }
        ]
    }), [data]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
            x: {
                stacked: true,
                grid: { color: 'rgba(148, 163, 184, 0.1)' },
                ticks: { color: '#64748B', font: { family: "'JetBrains Mono', monospace", size: 10 } }
            },
            y: {
                stacked: true,
                grid: { display: false },
                ticks: { color: '#94A3B8', font: { family: "'Inter', sans-serif", size: 12 } }
            }
        },
        plugins: {
            legend: {
                position: 'top',
                align: 'end',
                labels: {
                    color: '#94A3B8',
                    font: { family: "'JetBrains Mono', monospace", size: 10 },
                    boxWidth: 12,
                    padding: 16,
                    usePointStyle: true
                }
            },
            tooltip: {
                backgroundColor: '#1E293B',
                titleColor: '#F1F5F9',
                bodyColor: '#CBD5E1',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                bodyFont: { family: "'JetBrains Mono', monospace" }
            }
        }
    };

    return (
        <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
            <h3 className="text-sm font-mono text-neutral-400 uppercase tracking-widest mb-4">
                Performance by Role
            </h3>
            <div className="h-64">
                <Bar data={chartData} options={options} />
            </div>
        </div>
    );
}

/**
 * CandidateFlowChart - Time-series of candidate intake
 */
export function CandidateFlowChart({ data }) {
    // Generate sample data if not provided
    const chartData = useMemo(() => {
        const labels = data?.labels || ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        const values = data?.values || [0, 0, 0, 0];

        return {
            labels,
            datasets: [{
                label: 'New Candidates',
                data: values,
                borderColor: chartColors.primary,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: chartColors.primary,
                pointBorderColor: '#0F172A',
                pointBorderWidth: 2
            }]
        };
    }, [data]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#64748B', font: { family: "'JetBrains Mono', monospace", size: 10 } }
            },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(148, 163, 184, 0.1)' },
                ticks: { color: '#64748B', font: { family: "'JetBrains Mono', monospace", size: 10 } }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1E293B',
                titleColor: '#F1F5F9',
                bodyColor: '#CBD5E1',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                bodyFont: { family: "'JetBrains Mono', monospace" }
            }
        }
    };

    return (
        <div className="bg-surface-elevated rounded-xl border border-surface-overlay p-6">
            <h3 className="text-sm font-mono text-neutral-400 uppercase tracking-widest mb-4">
                Candidate Flow
            </h3>
            <div className="h-48">
                <Line data={chartData} options={options} />
            </div>
        </div>
    );
}

export default { StatusPieChart, RoleBarChart, CandidateFlowChart };
