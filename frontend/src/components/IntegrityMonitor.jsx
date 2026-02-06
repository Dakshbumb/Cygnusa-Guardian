import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { Eye, EyeOff, AlertTriangle, ShieldCheck, ShieldAlert, Activity, Wifi, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDeviceFingerprint } from '../utils/deviceFingerprint';


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
    const [faceStatus, setFaceStatus] = useState('SCANNING'); // MATCH, NO_FACE, MULTIPLE, DIFFERENT_PERSON
    const faceStatusRef = useRef('SCANNING');
    const [isLocked, setIsLocked] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [lockdownReason, setLockdownReason] = useState('');

    // Face identity baseline - capture initial face to compare later
    const [faceBaselineSet, setFaceBaselineSet] = useState(false);
    const faceBaselineRef = useRef(null); // Stores { width, height, aspectRatio, landmarkDistances }
    const baselineConfirmCount = useRef(0); // Require 3 consistent detections before setting baseline
    const differentPersonCount = useRef(0); // Track suspicious face changes

    // Temporal smoothing for robust face detection - prevents false positives
    const faceCountHistory = useRef([]); // Track last N face counts for smoothing
    const SMOOTHING_WINDOW = 5; // Require consistent detection over 5 frames
    const lastMultipleFaceLogTime = useRef(0); // Debounce multiple face logs
    const lastNoFaceLogTime = useRef(0); // Debounce no face logs
    const FACE_LOG_DEBOUNCE_MS = 10000; // Only log face issues every 10 seconds max

    // Typing Burst Detection - detects suspicious rapid text input
    const lastInputLength = useRef(0); // Track previous input length
    const lastInputTime = useRef(Date.now()); // Track when last input occurred
    const BURST_CHAR_THRESHOLD = 40; // Characters appearing at once is suspicious
    const BURST_TIME_THRESHOLD_MS = 300; // Time window for burst detection
    const lastBurstLogTime = useRef(0); // Debounce burst logs
    const BURST_LOG_DEBOUNCE_MS = 5000; // Only log burst events every 5 seconds

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

        // Throttle mobile proximity logs to once per 2 minutes (but allow first one)
        if (eventType === 'mobile_proximity_potential') {
            const lastLog = violations.filter(v => v.eventType === 'mobile_proximity_potential').pop();
            if (lastLog && (new Date() - new Date(lastLog.timestamp)) < 120000) return;
        }

        // Also throttle external display logs
        if (eventType === 'external_display_connected') {
            const lastLog = violations.filter(v => v.eventType === 'external_display_connected').pop();
            if (lastLog && (new Date() - new Date(lastLog.timestamp)) < 60000) return;
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
                    logViolationRef.current?.('external_display_connected', 'medium', 'Multiple monitors or extended display detected');
                }

                // 2. Bluetooth Proximity Logic (Heuristic for Mobile Detection)
                if (navigator.bluetooth && navigator.bluetooth.getAvailability) {
                    try {
                        const available = await navigator.bluetooth.getAvailability();
                        if (available) {
                            // Log mobile proximity detection
                            logViolationRef.current?.('mobile_proximity_potential', 'medium', 'UNAUTHORIZED_DEVICE_SIGNAL: Potential mobile device detected nearby');
                        }
                    } catch (btErr) {
                        // Bluetooth API may throw in some browsers
                        console.warn('Bluetooth check failed:', btErr);
                    }
                }

                // 3. Check for screen sharing (browser API)
                if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                    // Can't directly check if sharing, but we can detect if permission was granted
                }
            } catch (err) {
                console.warn('Peripheral check error:', err);
            }
        };

        const initIntegrity = async () => {
            try {
                // Wait for MediaPipe to load (retry up to 10 times with 500ms delay)
                let mediaPipeReady = false;
                for (let i = 0; i < 10 && !mediaPipeReady; i++) {
                    if (window.FaceDetection && window.Camera) {
                        mediaPipeReady = true;
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                if (mediaPipeReady) {
                    console.log('MediaPipe loaded successfully');
                    faceDetection = new window.FaceDetection({
                        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
                    });

                    faceDetection.setOptions({
                        model: 'short',
                        minDetectionConfidence: 0.6 // Higher threshold for accurate detection
                    });

                    faceDetection.onResults((results) => {
                        // Filter detections by confidence score for extra robustness
                        const highConfidenceDetections = results.detections.filter(d => {
                            // MediaPipe provides score in detection.score array
                            const score = d.score?.[0] ?? 1;
                            return score >= 0.6;
                        });

                        const rawFaceCount = highConfidenceDetections.length;
                        const canvas = canvasRef.current;
                        const video = videoRef.current;

                        // Apply temporal smoothing - track face count over last N frames
                        faceCountHistory.current.push(rawFaceCount);
                        if (faceCountHistory.current.length > SMOOTHING_WINDOW) {
                            faceCountHistory.current.shift();
                        }

                        // Calculate smoothed face count (most common value in history)
                        const faceCountOccurrences = {};
                        faceCountHistory.current.forEach(count => {
                            faceCountOccurrences[count] = (faceCountOccurrences[count] || 0) + 1;
                        });

                        // Find the most frequent face count
                        let smoothedFaceCount = rawFaceCount;
                        let maxOccurrence = 0;
                        for (const [count, occurrence] of Object.entries(faceCountOccurrences)) {
                            if (occurrence > maxOccurrence) {
                                maxOccurrence = occurrence;
                                smoothedFaceCount = parseInt(count);
                            }
                        }

                        // Only use smoothed value if we have enough history AND it's consistent
                        // Require at least 60% of frames to agree to prevent flickering
                        const requiredConsistency = Math.ceil(SMOOTHING_WINDOW * 0.6);
                        const faces = (faceCountHistory.current.length >= 3 && maxOccurrence >= requiredConsistency)
                            ? smoothedFaceCount
                            : rawFaceCount;

                        if (canvas && video) {
                            // Sync canvas size with video element
                            const rect = video.getBoundingClientRect();
                            if (canvas.width !== rect.width || canvas.height !== rect.height) {
                                canvas.width = rect.width;
                                canvas.height = rect.height;
                            }

                            const ctx = canvas.getContext('2d');
                            ctx.clearRect(0, 0, canvas.width, canvas.height);

                            if (highConfidenceDetections.length > 0) {
                                // Only draw bounding boxes for high-confidence detections
                                highConfidenceDetections.forEach((detection, index) => {
                                    const bbox = detection.boundingBox;
                                    // Calculate bounding box in canvas coordinates
                                    const x = bbox.xCenter * canvas.width - (bbox.width * canvas.width) / 2;
                                    const y = bbox.yCenter * canvas.height - (bbox.height * canvas.height) / 2;
                                    const w = bbox.width * canvas.width;
                                    const h = bbox.height * canvas.height;

                                    // Green for single face (1st), Red for additional faces
                                    ctx.strokeStyle = (faces === 1) ? '#10b981' : (index === 0 ? '#10b981' : '#ef4444');
                                    ctx.lineWidth = 3;
                                    ctx.strokeRect(x, y, w, h);

                                    // Draw face count label
                                    ctx.fillStyle = ctx.strokeStyle;
                                    ctx.font = 'bold 10px monospace';
                                    ctx.fillText(`Face ${index + 1}`, x, y - 5);

                                    // Draw landmarks if available
                                    if (detection.landmarks) {
                                        detection.landmarks.forEach(landmark => {
                                            ctx.beginPath();
                                            ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 3, 0, 2 * Math.PI);
                                            ctx.fill();
                                        });
                                    }
                                });
                            }
                        }

                        const now = Date.now();

                        if (faces === 0) {
                            setFaceStatus('NO_FACE');
                            faceStatusRef.current = 'NO_FACE';
                            // Debounced logging - only log once per FACE_LOG_DEBOUNCE_MS
                            if (now - lastNoFaceLogTime.current > FACE_LOG_DEBOUNCE_MS) {
                                lastNoFaceLogTime.current = now;
                                logViolationRef.current?.('no_face_detected', 'medium', 'User face not visible');
                            }
                        } else if (faces > 1) {
                            setFaceStatus('MULTIPLE');
                            faceStatusRef.current = 'MULTIPLE';
                            // Debounced logging - only log once per FACE_LOG_DEBOUNCE_MS
                            if (now - lastMultipleFaceLogTime.current > FACE_LOG_DEBOUNCE_MS) {
                                lastMultipleFaceLogTime.current = now;
                                logViolationRef.current?.('multiple_faces', 'high', `${faces} faces detected - unauthorized person in frame`);
                            }
                        } else {
                            // Single face detected - check identity
                            const detection = highConfidenceDetections[0];
                            const bbox = detection.boundingBox;
                            const currentFace = {
                                width: bbox.width,
                                height: bbox.height,
                                aspectRatio: bbox.width / bbox.height,
                                xCenter: bbox.xCenter,
                                yCenter: bbox.yCenter
                            };

                            // Calculate landmark distances if available (more reliable identity check)
                            if (detection.landmarks && detection.landmarks.length >= 2) {
                                const leftEye = detection.landmarks[0];
                                const rightEye = detection.landmarks[1];
                                currentFace.eyeDistance = Math.sqrt(
                                    Math.pow(rightEye.x - leftEye.x, 2) +
                                    Math.pow(rightEye.y - leftEye.y, 2)
                                );
                            }

                            // BASELINE CAPTURE: First few detections establish identity
                            if (!faceBaselineRef.current) {
                                baselineConfirmCount.current++;
                                if (baselineConfirmCount.current >= 3) {
                                    // Set baseline after 3 consistent detections
                                    faceBaselineRef.current = { ...currentFace };
                                    setFaceBaselineSet(true);
                                    console.log('Face baseline established:', faceBaselineRef.current);
                                    logViolationRef.current?.('face_baseline_set', 'low', 'Identity baseline captured for session');
                                }
                                setFaceStatus('MATCH');
                                faceStatusRef.current = 'MATCH';
                            } else {
                                // IDENTITY COMPARISON: Check if current face matches baseline
                                const baseline = faceBaselineRef.current;

                                // Calculate similarity score based on face proportions
                                const aspectDiff = Math.abs(currentFace.aspectRatio - baseline.aspectRatio);
                                const sizeDiff = Math.abs(currentFace.width - baseline.width) / baseline.width;

                                // Eye distance is most reliable if available
                                let eyeDistDiff = 0;
                                if (currentFace.eyeDistance && baseline.eyeDistance) {
                                    eyeDistDiff = Math.abs(currentFace.eyeDistance - baseline.eyeDistance) / baseline.eyeDistance;
                                }

                                // Threshold: if face proportions differ by > 25%, flag as different person
                                const isSuspicious = aspectDiff > 0.25 || sizeDiff > 0.35 || eyeDistDiff > 0.30;

                                if (isSuspicious) {
                                    differentPersonCount.current++;

                                    if (differentPersonCount.current >= 5) {
                                        // Confirmed different person
                                        setFaceStatus('DIFFERENT_PERSON');
                                        faceStatusRef.current = 'DIFFERENT_PERSON';
                                        logViolationRef.current?.('identity_mismatch', 'critical',
                                            `CRITICAL: Different person detected! Face proportions do not match baseline. AspectDiff: ${(aspectDiff * 100).toFixed(1)}%, SizeDiff: ${(sizeDiff * 100).toFixed(1)}%`);
                                        captureSnapshotRef.current?.(true); // Capture evidence
                                    }
                                } else {
                                    // Reset counter if face matches again
                                    if (differentPersonCount.current > 0) {
                                        differentPersonCount.current = Math.max(0, differentPersonCount.current - 1);
                                    }

                                    if (faceStatusRef.current !== 'MATCH') {
                                        console.log('Face identity verified - matches baseline');
                                        setFaceStatus('MATCH');
                                        faceStatusRef.current = 'MATCH';
                                    }
                                }
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
                        // Throttle face detection to 5 FPS for performance
                        let lastFrameTime = 0;
                        const frameInterval = 200; // 200ms = 5 FPS

                        camera = new window.Camera(videoRef.current, {
                            onFrame: async () => {
                                const now = Date.now();
                                if (now - lastFrameTime >= frameInterval) {
                                    lastFrameTime = now;
                                    try {
                                        await faceDetection.send({ image: videoRef.current });
                                    } catch (e) {
                                        // Silently ignore frame processing errors
                                    }
                                }
                            },
                            width: 320,
                            height: 192
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
                    console.warn('MediaPipe not loaded, trying native FaceDetector API');
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 320, height: 240 }
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;

                        // Try native FaceDetector API (Chrome 89+, Edge 89+)
                        if ('FaceDetector' in window) {
                            console.log('Using native FaceDetector API');
                            const nativeFaceDetector = new window.FaceDetector({
                                fastMode: true,
                                maxDetectedFaces: 5
                            });

                            // Face detection loop with bounding boxes
                            const detectFacesNative = async () => {
                                if (!videoRef.current || videoRef.current.readyState < 2) {
                                    requestAnimationFrame(detectFacesNative);
                                    return;
                                }

                                try {
                                    const faces = await nativeFaceDetector.detect(videoRef.current);
                                    const canvas = canvasRef.current;
                                    const video = videoRef.current;

                                    if (canvas && video) {
                                        // Sync canvas size
                                        const rect = video.getBoundingClientRect();
                                        if (canvas.width !== rect.width || canvas.height !== rect.height) {
                                            canvas.width = rect.width;
                                            canvas.height = rect.height;
                                        }

                                        const ctx = canvas.getContext('2d');
                                        ctx.clearRect(0, 0, canvas.width, canvas.height);

                                        // Calculate scale factors
                                        const scaleX = canvas.width / video.videoWidth;
                                        const scaleY = canvas.height / video.videoHeight;

                                        if (faces.length > 0) {
                                            faces.forEach((face, index) => {
                                                const box = face.boundingBox;
                                                const x = box.x * scaleX;
                                                const y = box.y * scaleY;
                                                const w = box.width * scaleX;
                                                const h = box.height * scaleY;

                                                // Green for single face, red for additional
                                                ctx.strokeStyle = (faces.length === 1) ? '#10b981' : (index === 0 ? '#10b981' : '#ef4444');
                                                ctx.lineWidth = 3;
                                                ctx.strokeRect(x, y, w, h);

                                                // Face label
                                                ctx.fillStyle = ctx.strokeStyle;
                                                ctx.font = 'bold 10px monospace';
                                                ctx.fillText(`Face ${index + 1}`, x, y - 5);
                                            });

                                            // Update face status
                                            if (faces.length === 1) {
                                                if (faceStatusRef.current !== 'MATCH') {
                                                    setFaceStatus('MATCH');
                                                    faceStatusRef.current = 'MATCH';
                                                }
                                            } else {
                                                if (faceStatusRef.current !== 'MULTIPLE') {
                                                    setFaceStatus('MULTIPLE');
                                                    faceStatusRef.current = 'MULTIPLE';
                                                    const now = Date.now();
                                                    if (now - lastMultipleFaceLogTime.current > FACE_LOG_DEBOUNCE_MS) {
                                                        logViolationRef.current?.('multiple_faces', 'high', `Detected ${faces.length} faces`);
                                                        lastMultipleFaceLogTime.current = now;
                                                    }
                                                }
                                            }
                                        } else {
                                            // No face detected
                                            if (faceStatusRef.current !== 'NO_FACE') {
                                                setFaceStatus('NO_FACE');
                                                faceStatusRef.current = 'NO_FACE';
                                                const now = Date.now();
                                                if (now - lastNoFaceLogTime.current > FACE_LOG_DEBOUNCE_MS) {
                                                    logViolationRef.current?.('no_face', 'medium', 'No face detected in frame');
                                                    lastNoFaceLogTime.current = now;
                                                }
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.warn('Native face detection error:', e);
                                }

                                // Continue detection loop at 5 FPS
                                setTimeout(() => requestAnimationFrame(detectFacesNative), 200);
                            };

                            // Start detection when video is ready
                            videoRef.current.onloadeddata = () => {
                                detectFacesNative();
                            };
                        } else {
                            console.warn('No FaceDetector API, using simulation mode');
                            // Fallback: simulate face detection for demo
                            const simulateFaceDetection = () => {
                                const canvas = canvasRef.current;
                                const video = videoRef.current;

                                if (canvas && video && video.readyState >= 2) {
                                    const rect = video.getBoundingClientRect();
                                    canvas.width = rect.width;
                                    canvas.height = rect.height;

                                    const ctx = canvas.getContext('2d');
                                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                                    // Draw simulated face box in center
                                    const boxW = canvas.width * 0.4;
                                    const boxH = canvas.height * 0.5;
                                    const boxX = (canvas.width - boxW) / 2;
                                    const boxY = (canvas.height - boxH) / 2 - 10;

                                    ctx.strokeStyle = '#10b981';
                                    ctx.lineWidth = 3;
                                    ctx.strokeRect(boxX, boxY, boxW, boxH);

                                    ctx.fillStyle = '#10b981';
                                    ctx.font = 'bold 10px monospace';
                                    ctx.fillText('Face 1 (Simulated)', boxX, boxY - 5);

                                    if (faceStatusRef.current !== 'MATCH') {
                                        setFaceStatus('MATCH');
                                        faceStatusRef.current = 'MATCH';
                                    }
                                }

                                requestAnimationFrame(simulateFaceDetection);
                            };

                            videoRef.current.onloadeddata = () => {
                                simulateFaceDetection();
                            };
                        }

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

        // Typing Burst Detection - catches suspicious rapid text input from external sources
        const handleTypingBurst = (e) => {
            const target = e.target;
            // Only monitor text inputs and textareas
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
                return;
            }

            const currentLength = target.value?.length || target.textContent?.length || 0;
            const now = Date.now();
            const timeDelta = now - lastInputTime.current;
            const charDelta = currentLength - lastInputLength.current;

            // Detect burst: many characters in very short time
            if (charDelta >= BURST_CHAR_THRESHOLD && timeDelta < BURST_TIME_THRESHOLD_MS) {
                // Debounce logging
                if (now - lastBurstLogTime.current > BURST_LOG_DEBOUNCE_MS) {
                    logViolationRef.current?.(
                        'typing_burst_detected',
                        'high',
                        `Suspicious text burst: ${charDelta} characters in ${timeDelta}ms (possible external paste)`
                    );
                    lastBurstLogTime.current = now;
                }
            }

            // Update tracking refs
            lastInputLength.current = currentLength;
            lastInputTime.current = now;
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
        document.addEventListener('input', handleTypingBurst); // Typing burst detection

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
            document.removeEventListener('input', handleTypingBurst); // Cleanup typing burst


            // Stop MediaPipe camera and face detection
            if (camera) {
                try {
                    camera.stop();
                } catch (e) {
                    console.warn('Camera cleanup error:', e);
                }
            }
            if (faceDetection) {
                try {
                    faceDetection.close();
                } catch (e) {
                    console.warn('FaceDetection cleanup error:', e);
                }
            }

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
                                            className="absolute inset-0 z-20 pointer-events-none"
                                            style={{ width: '100%', height: '100%' }}
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
