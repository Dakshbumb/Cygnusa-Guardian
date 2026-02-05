import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { Eye, EyeOff, AlertTriangle, ShieldCheck, ShieldAlert, Activity, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * IntegrityMonitor - Real-time proctoring component
 * Monitors: webcam, tab switches, copy/paste, keyboard shortcuts
 * All violations are logged to backend for audit trail
 */
export function IntegrityMonitor({ candidateId, onViolation }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [violations, setViolations] = useState([]);
    const [status, setStatus] = useState('initializing');
    const [isMinimized, setIsMinimized] = useState(false);
    const [webcamError, setWebcamError] = useState(null);
    const [faceStatus, setFaceStatus] = useState('SCANNING'); // MATCH, NO_FACE, MULTIPLE

    // Log violation to backend and update local state
    const captureAndUploadSnapshot = useCallback(async (faceDetected = null) => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        canvas.toBlob(async (blob) => {
            if (!blob) return;
            try {
                await api.uploadSnapshot(candidateId, blob, faceDetected);
                console.log('Proctoring snapshot uploaded');
            } catch (error) {
                console.error('Failed to upload snapshot:', error);
            }
        }, 'image/jpeg', 0.7);
    }, [candidateId]);

    const logViolation = useCallback(async (eventType, severity, context = null) => {
        try {
            await api.logIntegrity(candidateId, eventType, severity, context);
            const newViolation = { eventType, severity, context, timestamp: new Date().toISOString() };
            setViolations(prev => [...prev, newViolation]);

            // Capture snapshot immediately on high-severity violations
            if (severity === 'high' || severity === 'critical') {
                captureAndUploadSnapshot(eventType.includes('face'));
            }

            if (onViolation) {
                onViolation(newViolation);
            }
        } catch (error) {
            console.error('Failed to log integrity event:', error);
        }
    }, [candidateId, onViolation, captureAndUploadSnapshot]);

    useEffect(() => {
        // Bluetooth and Multi-Monitor Sensing
        let integrityCheckInterval = null;
        let unfocusedStartTime = null;
        let faceDetection = null;
        let camera = null;
        let snapshotInterval = null;

        const checkPeripherals = async () => {
            try {
                // 1. Multi-Monitor Detection
                const isExtended = window.screen.isExtended || (window.screen.availWidth > window.innerWidth * 1.5);
                if (isExtended) {
                    logViolation('external_display_connected', 'medium', 'Multiple monitors or extended display detected');
                }

                // 2. Bluetooth Proximity Logic (Heuristic)
                if (navigator.bluetooth && navigator.bluetooth.getAvailability) {
                    const available = await navigator.bluetooth.getAvailability();
                    if (available) {
                        console.log('Bluetooth signals detected in proximity');
                    }
                }
            } catch (err) {
                console.warn('Peripheral check error:', err);
            }
        };

        const initIntegrity = async () => {
            try {
                if (window.FaceDetection && window.Camera) {
                    faceDetection = new window.FaceDetection({
                        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
                    });

                    faceDetection.setOptions({
                        model: 'short',
                        minDetectionConfidence: 0.5
                    });

                    faceDetection.onResults((results) => {
                        const faces = results.detections.length;
                        const canvas = canvasRef.current;
                        if (canvas) {
                            const ctx = canvas.getContext('2d');
                            ctx.clearRect(0, 0, canvas.width, canvas.height);

                            if (results.detections.length > 0) {
                                results.detections.forEach(detection => {
                                    const bbox = detection.boundingBox;
                                    const x = bbox.xCenter * canvas.width - (bbox.width * canvas.width) / 2;
                                    const y = bbox.yCenter * canvas.height - (bbox.height * canvas.height) / 2;
                                    const w = bbox.width * canvas.width;
                                    const h = bbox.height * canvas.height;

                                    ctx.strokeStyle = faces === 1 ? '#10b981' : '#ef4444';
                                    ctx.lineWidth = 3;
                                    ctx.strokeRect(x, y, w, h);

                                    ctx.fillStyle = ctx.strokeStyle;
                                    detection.landmarks.forEach(landmark => {
                                        ctx.beginPath();
                                        ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 2, 0, 2 * Math.PI);
                                        ctx.fill();
                                    });
                                });
                            }
                        }

                        if (faces === 0) {
                            setFaceStatus('NO_FACE');
                            if (Math.random() < 0.05) logViolation('no_face_detected', 'medium', 'User face not visible');
                        } else if (faces > 1) {
                            setFaceStatus('MULTIPLE');
                            logViolation('multiple_faces', 'high', 'Multiple faces detected');
                        } else {
                            setFaceStatus('MATCH');

                            // 3. "Looking Away" Detection Heuristic
                            if (document.hidden || !document.hasFocus()) {
                                if (!unfocusedStartTime) {
                                    unfocusedStartTime = Date.now();
                                } else {
                                    const duration = (Date.now() - unfocusedStartTime) / 1000;
                                    if (duration > 15) {
                                        logViolation('nearby_device_focus_suspicion', 'high', 'User looking at another device while window hidden');
                                        unfocusedStartTime = null;
                                    }
                                }
                            } else {
                                unfocusedStartTime = null;
                            }
                        }
                    });

                    if (videoRef.current) {
                        camera = new window.Camera(videoRef.current, {
                            onFrame: async () => {
                                await faceDetection.send({ image: videoRef.current });
                            },
                            width: 320,
                            height: 240
                        });
                        await camera.start();
                        setStatus('monitoring');

                        snapshotInterval = setInterval(() => {
                            captureAndUploadSnapshot();
                        }, 30000);

                        integrityCheckInterval = setInterval(checkPeripherals, 60000);
                        checkPeripherals();
                    }
                } else {
                    console.warn('MediaPipe not loaded, falling back to basic webcam');
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 320, height: 240 }
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        setStatus('monitoring');

                        snapshotInterval = setInterval(() => {
                            captureAndUploadSnapshot();
                        }, 30000);

                        integrityCheckInterval = setInterval(checkPeripherals, 60000);
                        checkPeripherals();
                    }
                }
            } catch (err) {
                console.error('Integrity init error:', err);
                setWebcamError(err.message);
                setStatus('webcam_error');
                logViolation('webcam_denied', 'high', 'User denied webcam access');
            }
        };

        initIntegrity();

        const handleVisibilityChange = () => {
            if (document.hidden) {
                logViolation('tab_switch', 'medium', 'User switched to another tab or window');
            } else {
                unfocusedStartTime = null;
            }
        };

        const handlePaste = (e) => {
            const pastedText = e.clipboardData?.getData('text') || '';
            logViolation('paste_detected', 'high', `Pasted ${pastedText.length} characters`);
        };

        const handleCopy = () => {
            logViolation('copy_detected', 'low', 'User copied content');
        };

        const handleContextMenu = (e) => {
            logViolation('context_menu', 'low', 'Right-click menu opened');
        };

        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                const shortcuts = {
                    'c': 'copy',
                    'v': 'paste',
                    'x': 'cut',
                    'a': 'select_all',
                    'f': 'find',
                    'Tab': 'tab_switch'
                };
                if (shortcuts[e.key]) {
                    if (e.key === 'Tab') {
                        logViolation('keyboard_shortcut', 'medium', `Ctrl+Tab detected`);
                    }
                }
            }
            if (e.altKey && e.key === 'Tab') {
                logViolation('alt_tab', 'medium', 'Alt+Tab detected');
            }
        };

        const handleBlur = () => {
            logViolation('window_blur', 'low', 'Window lost focus');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('copy', handleCopy);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleBlur);

        return () => {
            if (snapshotInterval) clearInterval(snapshotInterval);
            if (integrityCheckInterval) clearInterval(integrityCheckInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleBlur);

            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, [candidateId, logViolation, captureAndUploadSnapshot]);

    // Severity color mapping
    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return 'text-danger-500 border-danger-500/50 bg-danger-900/20';
            case 'high': return 'text-orange-500 border-orange-500/50 bg-orange-900/20';
            case 'medium': return 'text-warning-500 border-warning-500/50 bg-warning-900/20';
            default: return 'text-primary-400 border-primary-500/50 bg-primary-900/20';
        }
    };

    return (
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${isMinimized ? 'w-auto' : 'w-80'
            }`}>
            <div className={`backdrop-blur-md border rounded-lg overflow-hidden shadow-2xl transition-all ${status === 'webcam_error' ? 'bg-danger-900/10 border-danger-500/50' :
                'bg-surface-elevated/80 border-surface-overlay'
                }`}>
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-2 bg-surface-base/90 border-b border-surface-overlay cursor-pointer hover:bg-surface-elevated transition-colors"
                    onClick={() => setIsMinimized(!isMinimized)}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${status === 'monitoring' ? 'bg-success-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                            status === 'webcam_error' ? 'bg-danger-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                                'bg-warning-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'
                            }`} />
                        {!isMinimized && (
                            <div className="flex flex-col">
                                <span className="text-xs font-mono font-bold text-neutral-200 tracking-wider">
                                    INTEGRITY_SHIELD
                                </span>
                                <span className="text-[10px] font-mono text-neutral-500">
                                    {status === 'monitoring' ? 'LIVE_MONITORING' : 'SYSTEM_OFFLINE'}
                                </span>
                            </div>
                        )}
                    </div>
                    {isMinimized ? (
                        <ShieldCheck size={16} className="text-neutral-400" />
                    ) : (
                        <Activity size={16} className="text-secondary-400" />
                    )}
                </div>

                {!isMinimized && (
                    <>
                        {/* Webcam Feed */}
                        <div className="p-1 relative">
                            {webcamError ? (
                                <div className="w-full h-48 bg-surface-base rounded flex flex-col items-center justify-center border border-dashed border-danger-500/30">
                                    <ShieldAlert className="text-danger-500 mb-2" size={32} />
                                    <p className="text-xs font-mono text-danger-400">CAMERA_ACCESS_DENIED</p>
                                </div>
                            ) : (
                                <div className="relative rounded overflow-hidden">
                                    {/* Face Status HUD Overlay */}
                                    <div className="absolute top-2 left-2 z-10 flex gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold backdrop-blur-sm border ${faceStatus === 'MATCH' ? 'bg-success-900/30 text-success-400 border-success-500/30' :
                                            'bg-danger-900/30 text-danger-400 border-danger-500/30'
                                            }`}>
                                            FACE: {faceStatus}
                                        </span>
                                    </div>

                                    {/* Reticle Overlay */}
                                    <div className="absolute inset-0 pointer-events-none z-10">
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary-500/50 rounded-tl-lg" />
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary-500/50 rounded-tr-lg" />
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary-500/50 rounded-bl-lg" />
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary-500/50 rounded-br-lg" />

                                        {/* Scanning Line */}
                                        <motion.div
                                            className="absolute left-0 right-0 h-0.5 bg-primary-500/30 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                                            animate={{ top: ['0%', '100%', '0%'] }}
                                            transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                                        />

                                        {/* Center Crosshair */}
                                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                                            <motion.div
                                                className="w-16 h-16 border border-white/10 rounded-full"
                                                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5], rotate: 360 }}
                                                transition={{ duration: 4, ease: "linear", repeat: Infinity }}
                                            >
                                                <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-primary-500/50 -translate-x-1/2"></div>
                                                <div className="absolute bottom-0 left-1/2 w-0.5 h-2 bg-primary-500/50 -translate-x-1/2"></div>
                                                <div className="absolute left-0 top-1/2 h-0.5 w-2 bg-primary-500/50 -translate-y-1/2"></div>
                                                <div className="absolute right-0 top-1/2 h-0.5 w-2 bg-primary-500/50 -translate-y-1/2"></div>
                                            </motion.div>
                                            <div className="absolute w-1 h-1 bg-white/50 rounded-full" />
                                        </div>
                                    </div>

                                    <canvas
                                        ref={canvasRef}
                                        className="absolute inset-0 z-20 w-full h-48 pointer-events-none"
                                        width={320}
                                        height={240}
                                    />

                                    <video
                                        ref={videoRef}
                                        className="w-full h-48 bg-black object-cover filter contrast-125 grayscale-[30%]"
                                        autoPlay
                                        playsInline
                                        muted
                                    />
                                </div>
                            )}
                        </div>

                        {/* Violations Summary */}
                        <div className="px-4 py-3 bg-surface-base/50 border-t border-surface-overlay">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-mono text-neutral-500 uppercase">
                                    Event_Log
                                </span>
                                <div className="flex items-center gap-2">
                                    <Wifi size={10} className="text-secondary-400 animate-pulse" />
                                    <span className="text-[10px] font-mono text-secondary-400">SYNCED</span>
                                </div>
                            </div>
                            {/* Recent violations */}
                            <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar relative">
                                <AnimatePresence initial={false}>
                                    {violations.length === 0 ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex items-center gap-2 text-success-400/60 text-xs py-2 justify-center font-mono border border-dashed border-success-500/20 rounded"
                                        >
                                            <ShieldCheck size={14} />
                                            <span>SYSTEM_STATUS: CLEAN</span>
                                        </motion.div>
                                    ) : (
                                        <>
                                            <div className="mb-3 space-y-1">
                                                <div className={`flex items-center justify-between px-2 py-1.5 rounded font-mono text-[10px] font-bold border ${violations.length > 20 ? 'bg-danger-900/40 text-danger-400 border-danger-500/40' : 'bg-warning-900/40 text-warning-400 border-warning-500/40'
                                                    }`}>
                                                    <span className="flex items-center gap-1.5">
                                                        <AlertTriangle size={12} />
                                                        {violations.length > 20 ? 'HIGH_RISK_DETECTED' : 'CAUTION_DETECTIONS'}
                                                    </span>
                                                    <span>({violations.length}/100_LIMIT)</span>
                                                </div>
                                                <div className="text-[9px] font-mono text-neutral-500 text-center uppercase tracking-tighter opacity-70">
                                                    Auto-Reject Threshold: 100 Violations
                                                </div>
                                            </div>
                                            {violations.slice(-3).reverse().map((v, i) => (
                                                <motion.div
                                                    key={v.timestamp || i}
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    className={`text-[10px] font-mono mb-1 px-2 py-1.5 rounded border flex items-center gap-2 ${getSeverityColor(v.severity)}`}
                                                >
                                                    <AlertTriangle size={10} />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{v.eventType.toUpperCase()}</span>
                                                        <span className="opacity-70 text-[9px] truncate w-40">{v.context}</span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default IntegrityMonitor;
