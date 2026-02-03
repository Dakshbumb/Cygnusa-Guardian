import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { api } from '../utils/api';

/**
 * WebcamProctor - Webcam monitoring component for assessment proctoring
 * Captures periodic snapshots and uploads them for review
 */
export function WebcamProctor({ candidateId, onStatusChange, captureInterval = 30000 }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);

    const [status, setStatus] = useState('initializing'); // initializing, active, error, denied
    const [snapshotCount, setSnapshotCount] = useState(0);
    const [lastCapture, setLastCapture] = useState(null);
    const [error, setError] = useState(null);

    // Initialize webcam
    const initWebcam = useCallback(async () => {
        try {
            setStatus('initializing');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: 'user' },
                audio: false
            });

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            setStatus('active');
            onStatusChange?.('active');
        } catch (err) {
            console.error('Webcam access error:', err);
            if (err.name === 'NotAllowedError') {
                setStatus('denied');
                setError('Camera access denied. Please enable camera permissions.');
            } else {
                setStatus('error');
                setError('Failed to access camera.');
            }
            onStatusChange?.('error');
        }
    }, [onStatusChange]);

    // Capture snapshot
    const captureSnapshot = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || status !== 'active') return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        canvas.toBlob(async (blob) => {
            if (!blob) return;

            try {
                // Simple face detection heuristic (placeholder - real implementation would use ML)
                // For now, assume face is detected if video is active
                const faceDetected = true;

                await api.uploadSnapshot(candidateId, blob, faceDetected);
                setSnapshotCount(prev => prev + 1);
                setLastCapture(new Date());
            } catch (err) {
                console.error('Snapshot upload failed:', err);
            }
        }, 'image/jpeg', 0.7);
    }, [candidateId, status]);

    // Start/stop capture interval
    useEffect(() => {
        if (status === 'active' && candidateId) {
            // Capture immediately
            captureSnapshot();

            // Then capture at interval
            intervalRef.current = setInterval(captureSnapshot, captureInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [status, captureInterval, captureSnapshot, candidateId]);

    // Initialize on mount
    useEffect(() => {
        initWebcam();

        return () => {
            // Cleanup
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [initWebcam]);

    // Render status indicator
    const renderStatusBadge = () => {
        switch (status) {
            case 'active':
                return (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-900/30 border border-green-500/30">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-xs text-green-400">Recording</span>
                    </div>
                );
            case 'initializing':
                return (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-900/30 border border-blue-500/30">
                        <Loader size={12} className="animate-spin text-blue-400" />
                        <span className="text-xs text-blue-400">Initializing...</span>
                    </div>
                );
            case 'denied':
            case 'error':
                return (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-900/30 border border-red-500/30">
                        <AlertCircle size={12} className="text-red-400" />
                        <span className="text-xs text-red-400">Camera Error</span>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="relative">
            {/* Video Preview (small) */}
            <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-surface-base border border-surface-overlay shadow-lg">
                {status === 'active' ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        {status === 'initializing' ? (
                            <Loader size={24} className="animate-spin text-neutral-500" />
                        ) : (
                            <CameraOff size={24} className="text-neutral-500" />
                        )}
                    </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-1 right-1">
                    {renderStatusBadge()}
                </div>

                {/* Snapshot Counter */}
                {snapshotCount > 0 && (
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/50 text-xs text-white">
                        {snapshotCount} 📷
                    </div>
                )}
            </div>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Error message */}
            {error && (
                <div className="mt-2 text-xs text-red-400 max-w-32">
                    {error}
                </div>
            )}
        </div>
    );
}

export default WebcamProctor;
