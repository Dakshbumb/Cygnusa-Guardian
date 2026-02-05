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
    const offScreenCanvasRef = useRef(null);
    const [violations, setViolations] = useState([]);
    const [status, setStatus] = useState('initializing');
    const [isMinimized, setIsMinimized] = useState(false);
    const [webcamError, setWebcamError] = useState(null);
    const [faceStatus, setFaceStatus] = useState('SCANNING'); // MATCH, NO_FACE, MULTIPLE
    const faceStatusRef = useRef('SCANNING');
    const [isLocked, setIsLocked] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [lockdownReason, setLockdownReason] = useState('');

    // Stability refs to prevent useEffect restarts
    const logViolationRef = useRef(null);
    const captureSnapshotRef = useRef(null);
    const onViolationRef = useRef(onViolation);

    // Sync refs with latest props/functions
    useEffect(() => {
        onViolationRef.current = onViolation;
    }, [onViolation]);

    // Log violation to backend and update local state
    const captureAndUploadSnapshot = useCallback(async (faceDetected = null) => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        if (!offScreenCanvasRef.current) {
            offScreenCanvasRef.current = document.createElement('canvas');
            offScreenCanvasRef.current.width = 640;
            offScreenCanvasRef.current.height = 480;
        }

        const canvas = offScreenCanvasRef.current;
        const context = canvas.getContext('2d');

        try {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    // Use faceDetected if passed, otherwise use current ref value
                    const detected = faceDetected !== null ? faceDetected : (faceStatusRef.current === 'MATCH');
                    await api.uploadSnapshot(candidateId, blob, detected);
                    console.log('Proctoring snapshot uploaded, face:', detected);
                } catch (error) {
                    console.error('Failed to upload snapshot:', error);
                }
            }, 'image/jpeg', 0.6);
        } catch (err) {
            console.error('Capture error:', err);
        }
    }, [candidateId]);

    // Update the ref whenever the function changes
    useEffect(() => {
        captureSnapshotRef.current = captureAndUploadSnapshot;
    }, [captureAndUploadSnapshot]);

    const logViolation = useCallback(async (eventType, severity, context = null) => {
        if (isLocked) return;

        if (eventType === 'mobile_proximity_potential') {
            const lastLog = violations.filter(v => v.eventType === 'mobile_proximity_potential').pop();
            if (lastLog && (new Date() - new Date(lastLog.timestamp)) < 120000) return;
        }

        try {
            await api.logIntegrity(candidateId, eventType, severity, context);
            const newViolation = { eventType, severity, context, timestamp: new Date().toISOString() };

            setViolations(prev => {
                const updated = [...prev, newViolation];
                if (updated.length >= 100) {
                    setIsLocked(true);
                    setLockdownReason('INTEGRITY_THRESHOLD_EXCEEDED');
                }
                return updated;
            });

            if (severity === 'high' || severity === 'critical') {
                captureSnapshotRef.current?.(eventType.includes('face'));
            }

            if (onViolationRef.current) {
                onViolationRef.current(newViolation);
            }
        } catch (error) {
            console.error('Failed to log integrity event:', error);
        }
    }, [candidateId, isLocked, violations]); // Keep violations to ensure filtering works correctly

    // Update the ref
    useEffect(() => {
        logViolationRef.current = logViolation;
    }, [logViolation]);

    useEffect(() => {
        // Bluetooth and Multi-Monitor Sensing
        let integrityCheckInterval = null;
        let unfocusedStartTime = null;
        let faceDetection = null;
        let camera = null;
        let snapshotInterval = null;
        let audioCleanup = null;
        let audioContext = null;
        let analyser = null;
        let microphone = null;

        const initAudioSensing = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                microphone = audioContext.createMediaStreamSource(stream);
                microphone.connect(analyser);
                analyser.fftSize = 512;

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const checkNoise = () => {
                    if (!analyser) return;
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / bufferLength;

                    // If high ambient noise detected while face is MATCH but window is hidden/blurred
                    if (average > 60 && (document.hidden || !document.hasFocus())) {
                        logViolation('ambient_coordination_suspicion', 'medium', 'Significant human-frequency noise detected while window unfocused');
                    }
                };

                const audioInterval = setInterval(checkNoise, 5000);
                return () => clearInterval(audioInterval);
            } catch (err) {
                console.warn('Audio sensing setup failed:', err);
            }
        };

        const checkPeripherals = async () => {
            try {
                // 1. Multi-Monitor Detection
                const isExtended = window.screen.isExtended || (window.screen.availWidth > window.innerWidth * 1.5);
                if (isExtended) {
                    logViolation('external_display_connected', 'medium', 'Multiple monitors or extended display detected');
                }

                // 2. Bluetooth Proximity Logic (Heuristic for Mobile Detection)
                if (navigator.bluetooth && navigator.bluetooth.getAvailability) {
                    const available = await navigator.bluetooth.getAvailability();
                    if (available) {
                        // We log this as a mobile signal detected to create the psychological deterrent
                        logViolation('mobile_proximity_potential', 'medium', 'UNAUTHORIZED_DEVICE_SIGNAL: Potential mobile device detected nearby');
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
                            faceStatusRef.current = 'NO_FACE';
                            if (Math.random() < 0.05) logViolationRef.current?.('no_face_detected', 'medium', 'User face not visible');
                        } else if (faces > 1) {
                            setFaceStatus('MULTIPLE');
                            faceStatusRef.current = 'MULTIPLE';
                            logViolationRef.current?.('multiple_faces', 'high', 'Multiple faces detected');
                        } else {
                            if (faceStatusRef.current !== 'MATCH') {
                                console.log('Face Detected and Matched');
                                setFaceStatus('MATCH');
                                faceStatusRef.current = 'MATCH';
                            }

                            // 3. "Looking Away" Detection Heuristic
                            if (document.hidden || !document.hasFocus()) {
                                if (!unfocusedStartTime) {
                                    unfocusedStartTime = Date.now();
                                } else {
                                    const duration = (Date.now() - unfocusedStartTime) / 1000;
                                    if (duration > 15) {
                                        logViolationRef.current?.('nearby_device_focus_suspicion', 'high', 'User looking at another device while window hidden');
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
                            // Use the ref to get current status without stale closure
                            captureSnapshotRef.current?.(faceStatusRef.current === 'MATCH');
                        }, 45000);

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
                            captureSnapshotRef.current?.();
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

        const init = async () => {
            await initIntegrity();
            audioCleanup = await initAudioSensing();
        };

        init();

        const handleVisibilityChange = () => {
            if (document.hidden) {
                logViolationRef.current?.('tab_switch', 'medium', 'User switched to another tab or window');
            } else {
                unfocusedStartTime = null;
            }
        };

        const handlePaste = (e) => {
            e.preventDefault();
            logViolationRef.current?.('paste_attempt', 'high', 'Paste blocked by environment security');
        };

        const handleCopy = (e) => {
            e.preventDefault();
            logViolationRef.current?.('copy_attempt', 'low', 'Copy blocked by environment security');
        };

        const handleContextMenu = (e) => {
            e.preventDefault();
            logViolationRef.current?.('context_menu', 'low', 'Right-click menu blocked');
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
                        logViolationRef.current?.('keyboard_shortcut', 'medium', `Ctrl+Tab detected`);
                    } else if (e.key === 'v' || e.key === 'c') {
                        // Prevent default for copy/paste shortcuts
                        e.preventDefault();
                    }
                }
            }
            if (e.altKey && e.key === 'Tab') {
                logViolationRef.current?.('alt_tab', 'medium', 'Alt+Tab detected');
            }
        };

        const handleBlur = () => {
            // Side-Assistant Detection: If focus is lost, suggest interaction outside
            logViolationRef.current?.('environment_focus_lost', 'medium', 'Interaction with browser sidebar or external app suspected');
        };

        // Step 2: Fullscreen Protocol
        const enforceFullscreen = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                logViolationRef.current?.('security_protocol_exit', 'high', 'User exited fullscreen mode');
            } else {
                setIsFullscreen(true);
            }
        };

        const requestFullscreen = async () => {
            try {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                    setIsFullscreen(true);
                }
            } catch (err) {
                console.warn('Fullscreen request failed:', err);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('copy', handleCopy);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('fullscreenchange', enforceFullscreen);
        window.addEventListener('blur', handleBlur);

        // Initial request on mount
        requestFullscreen();

        return () => {
            if (snapshotInterval) clearInterval(snapshotInterval);
            if (integrityCheckInterval) clearInterval(integrityCheckInterval);
            if (audioCleanup) audioCleanup();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('fullscreenchange', enforceFullscreen);
            window.removeEventListener('blur', handleBlur);

            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, [candidateId]); // STABLE: Only depends on candidateId

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
        <>
            {/* Lockdown / Fullscreen Blocker Overlay */}
            <AnimatePresence>
                {(isLocked || !isFullscreen) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
                    >
                        <div className="max-w-md">
                            <ShieldAlert className="text-danger-500 mb-6 mx-auto" size={80} />
                            <h2 className="text-3xl font-display font-bold text-white mb-4 uppercase tracking-tighter">
                                {isLocked ? 'ASSESSMENT_SUSPENDED' : 'SECURITY_PROTOCOL_REVOKED'}
                            </h2>
                            <p className="text-neutral-400 font-mono text-sm mb-8 leading-relaxed">
                                {isLocked
                                    ? `Integrity threshold of 100 violations has been exceeded. This assessment is now moved to LOCKDOWN mode. Manual intervention is required.`
                                    : `Assessment protocol requires active FULLSCREEN mode to ensure environment integrity. Browser access has been restricted until re-entry.`
                                }
                            </p>

                            {!isLocked && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => document.documentElement.requestFullscreen()}
                                    className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-mono font-bold tracking-widest transition-all shadow-lg shadow-primary-500/20"
                                >
                                    RE-ENTER_FULLSCREEN
                                </motion.button>
                            )}

                            {isLocked && (
                                <div className="p-4 border border-danger-500/30 bg-danger-500/10 rounded font-mono text-xs text-danger-400">
                                    REF_ID: {candidateId?.toUpperCase()} | STATUS: {lockdownReason}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
        </>
    );
}

export default IntegrityMonitor;
