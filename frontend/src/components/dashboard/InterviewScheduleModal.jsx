import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Clock, X, Check, User, Mail, Briefcase,
    CalendarCheck, Video, Phone, Users, Bell
} from 'lucide-react';
import { api } from '../../utils/api';

/**
 * InterviewScheduleModal - Modal for scheduling candidate interviews
 * Shows date picker, time slots, and interview type selection
 */
export function InterviewScheduleModal({
    candidate,
    isOpen,
    onClose,
    onSchedule
}) {
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [interviewType, setInterviewType] = useState('video');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Generate next 14 days for date selection
    const availableDates = [];
    for (let i = 1; i <= 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        // Skip weekends
        if (date.getDay() !== 0 && date.getDay() !== 6) {
            availableDates.push({
                value: date.toISOString().split('T')[0],
                label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                dateNum: date.getDate()
            });
        }
    }

    // Available time slots
    const timeSlots = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00', '17:30'
    ];

    // Interview types
    const interviewTypes = [
        { value: 'video', label: 'Video Call', icon: Video },
        { value: 'phone', label: 'Phone Call', icon: Phone },
        { value: 'in-person', label: 'In-Person', icon: Users }
    ];

    const handleSchedule = async () => {
        if (!selectedDate || !selectedTime) return;

        setLoading(true);
        try {
            const interviewData = {
                candidate_id: candidate.id,
                scheduled_date: selectedDate,
                scheduled_time: selectedTime,
                interview_type: interviewType,
                notes: notes,
                round: candidate.outcome === 'HIRE' ? 'final' : 'second'
            };

            await api.scheduleInterview(interviewData);
            setSuccess(true);

            setTimeout(() => {
                onSchedule?.(interviewData);
                onClose();
                setSuccess(false);
                setSelectedDate('');
                setSelectedTime('');
                setNotes('');
            }, 1500);
        } catch (error) {
            console.error('Failed to schedule interview:', error);
            alert('Failed to schedule interview. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Early return if not open or no candidate
    if (!isOpen || !candidate) return null;

    const canSchedule = (candidate.outcome === 'HIRE' || candidate.outcome === 'CONDITIONAL') &&
        (candidate.overall_score || 0) >= 50;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-surface-elevated border border-surface-overlay rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-surface-overlay bg-surface-base/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-900/30 flex items-center justify-center border border-primary-500/30">
                                <CalendarCheck className="w-5 h-5 text-primary-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Schedule Interview</h3>
                                <p className="text-xs text-neutral-500 font-mono">Round 2 • Technical Interview</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-surface-overlay text-neutral-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Candidate Info Card */}
                    <div className="mx-5 mt-5 p-4 bg-surface-base/50 rounded-xl border border-surface-overlay">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-surface-overlay flex items-center justify-center text-primary-400 font-bold text-lg border border-surface-overlay">
                                {candidate.name?.charAt(0) || 'C'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white truncate">{candidate.name}</p>
                                <p className="text-xs text-neutral-500 font-mono truncate flex items-center gap-1">
                                    <Mail size={10} /> {candidate.email}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-primary-400">{candidate.overall_score || 0}%</p>
                                <p className="text-[10px] text-neutral-500 font-mono uppercase">Match Score</p>
                            </div>
                        </div>
                    </div>

                    {/* Eligibility Check */}
                    {!canSchedule && (
                        <div className="mx-5 mt-4 p-3 bg-warning-900/20 border border-warning-500/30 rounded-lg">
                            <p className="text-warning-400 text-sm">
                                ⚠️ Only Selected/Conditional candidates with 50%+ score can be scheduled for Round 2.
                            </p>
                        </div>
                    )}

                    {canSchedule && (
                        <>
                            {/* Date Selection */}
                            <div className="px-5 pt-5">
                                <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-3">
                                    <Calendar size={12} className="inline mr-1" /> Select Date
                                </label>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                    {availableDates.slice(0, 7).map((date) => (
                                        <button
                                            key={date.value}
                                            onClick={() => setSelectedDate(date.value)}
                                            className={`flex-shrink-0 w-16 py-3 rounded-xl border text-center transition-all
                                                ${selectedDate === date.value
                                                    ? 'bg-primary-600 border-primary-500 text-white'
                                                    : 'bg-surface-base border-surface-overlay text-neutral-400 hover:border-primary-500/50'
                                                }`}
                                        >
                                            <p className="text-[10px] font-mono uppercase">{date.day}</p>
                                            <p className="text-lg font-bold">{date.dateNum}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Time Selection */}
                            <div className="px-5 pt-4">
                                <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-3">
                                    <Clock size={12} className="inline mr-1" /> Select Time
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {timeSlots.map((time) => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={`py-2 rounded-lg border text-sm font-mono transition-all
                                                ${selectedTime === time
                                                    ? 'bg-primary-600 border-primary-500 text-white'
                                                    : 'bg-surface-base border-surface-overlay text-neutral-400 hover:border-primary-500/50'
                                                }`}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Interview Type */}
                            <div className="px-5 pt-4">
                                <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-3">
                                    Interview Type
                                </label>
                                <div className="flex gap-2">
                                    {interviewTypes.map(({ value, label, icon: Icon }) => (
                                        <button
                                            key={value}
                                            onClick={() => setInterviewType(value)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition-all
                                                ${interviewType === value
                                                    ? 'bg-primary-600 border-primary-500 text-white'
                                                    : 'bg-surface-base border-surface-overlay text-neutral-400 hover:border-primary-500/50'
                                                }`}
                                        >
                                            <Icon size={14} />
                                            <span>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="px-5 pt-4">
                                <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-2">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any notes for the interview..."
                                    className="w-full p-3 bg-surface-base border border-surface-overlay rounded-lg text-sm text-white placeholder-neutral-600 resize-none focus:outline-none focus:border-primary-500 transition-colors"
                                    rows={2}
                                />
                            </div>
                        </>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between p-5 mt-4 border-t border-surface-overlay bg-surface-base/30">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-neutral-400 hover:text-white text-sm transition-colors"
                        >
                            Cancel
                        </button>

                        {canSchedule && (
                            <button
                                onClick={handleSchedule}
                                disabled={!selectedDate || !selectedTime || loading || success}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                                    ${success
                                        ? 'bg-success-600 text-white'
                                        : (!selectedDate || !selectedTime)
                                            ? 'bg-surface-overlay text-neutral-500 cursor-not-allowed'
                                            : 'bg-primary-600 hover:bg-primary-500 text-white'
                                    }`}
                            >
                                {success ? (
                                    <>
                                        <Check size={16} />
                                        Scheduled!
                                    </>
                                ) : loading ? (
                                    'Scheduling...'
                                ) : (
                                    <>
                                        <Bell size={16} />
                                        Schedule Interview
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default InterviewScheduleModal;
