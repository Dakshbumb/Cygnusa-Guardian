# 🔐 Cygnusa Guardian - Security & Anti-Cheat (15%)

## Overview

Cygnusa Guardian implements a **multi-layered security architecture** that ensures assessment integrity while maintaining a fair testing environment. Our approach combines:

- 🎥 **Real-time Proctoring** - Face detection and identity verification
- 🖥️ **Environment Lockdown** - Fullscreen, blocked shortcuts, tab monitoring
- 🔍 **Behavioral Analysis** - Typing patterns, paste detection, timing analysis
- 🔐 **Device Fingerprinting** - Session continuity verification
- 📊 **Violation Logging** - Complete audit trail of all suspicious activity

---

## 🏛️ Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYER STACK                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 5: BEHAVIORAL ANALYSIS                             │   │
│  │ • Typing burst detection (>40 chars in <300ms)           │   │
│  │ • Time-per-question analysis                             │   │
│  │ • Response pattern anomalies                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 4: IDENTITY VERIFICATION                           │   │
│  │ • Face detection (MediaPipe FaceMesh)                    │   │
│  │ • Baseline face comparison                               │   │
│  │ • Multiple face detection                                │   │
│  │ • Face absence detection                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 3: DEVICE FINGERPRINTING                          │   │
│  │ • Browser/OS signature                                   │   │
│  │ • WebGL GPU fingerprint                                  │   │
│  │ • Canvas fingerprint                                     │   │
│  │ • Screen/timezone characteristics                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 2: ENVIRONMENT LOCKDOWN                           │   │
│  │ • Fullscreen enforcement                                 │   │
│  │ • Copy/paste blocking                                    │   │
│  │ • Context menu blocking                                  │   │
│  │ • Keyboard shortcut interception                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 1: CODE SANDBOX SECURITY                          │   │
│  │ • Banned imports (os, subprocess, socket, etc.)          │   │
│  │ • Execution timeout (10s max)                            │   │
│  │ • Memory limits (128MB max)                              │   │
│  │ • No file system access                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎥 Real-Time Face Proctoring

### Face Detection Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    FACE DETECTION FLOW                          │
│                                                                 │
│  Webcam Feed → Frame Capture → MediaPipe Analysis → Status      │
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │ Camera  │ →  │ Canvas  │ →  │ FaceMesh│ →  │ Compare │      │
│  │ Stream  │    │ Extract │    │ Detect  │    │ Baseline│      │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│                                      │                          │
│                     ┌────────────────┼────────────────┐        │
│                     ▼                ▼                ▼        │
│              ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│              │ NO_FACE  │    │  MATCH   │    │ MULTIPLE │      │
│              │ Violation│    │   OK     │    │ Violation│      │
│              └──────────┘    └──────────┘    └──────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Face Identity Baseline

```javascript
// Capture baseline on first clear detection
const baseline = {
    width: faceBox.width,
    height: faceBox.height,
    aspectRatio: faceBox.width / faceBox.height,
    landmarkDistances: {
        eyeDistance: calculateDistance(leftEye, rightEye),
        noseToMouth: calculateDistance(nose, mouth),
        faceWidth: calculateDistance(leftCheek, rightCheek)
    }
};

// Compare subsequent detections
function isMatchingFace(currentFace) {
    const tolerance = 0.25; // 25% variance allowed
    const aspectDiff = Math.abs(currentFace.aspectRatio - baseline.aspectRatio);
    return aspectDiff < tolerance;
}
```

### Face Status Types

| Status | Meaning | Severity |
|--------|---------|----------|
| `MATCH` | Same person as baseline | ✅ OK |
| `NO_FACE` | No face detected in frame | ⚠️ Medium |
| `MULTIPLE` | More than one face detected | 🔴 High |
| `DIFFERENT_PERSON` | Face doesn't match baseline | 🔴 Critical |
| `SCANNING` | Initial detection in progress | ℹ️ Info |

---

## 🖥️ Environment Lockdown

### Blocked Actions

```javascript
// Fullscreen enforcement
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        logViolation('security_protocol_exit', 'high', 'User exited fullscreen mode');
    }
});

// Copy/paste blocking
document.addEventListener('paste', (e) => {
    e.preventDefault();
    logViolation('paste_attempt', 'high', 'Paste blocked by environment security');
});

document.addEventListener('copy', (e) => {
    e.preventDefault();
    logViolation('copy_attempt', 'low', 'Copy blocked by environment security');
});

// Context menu blocking
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    logViolation('context_menu', 'low', 'Right-click menu blocked');
});

// Keyboard shortcut interception
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && ['c', 'v', 'x', 'a', 'f'].includes(e.key)) {
        e.preventDefault();
        logViolation('keyboard_shortcut', 'medium', `Ctrl+${e.key} detected`);
    }
    if (e.altKey && e.key === 'Tab') {
        logViolation('keyboard_shortcut', 'high', 'Alt+Tab detected');
    }
});
```

### Tab/Focus Monitoring

```javascript
// Visibility change detection
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        logViolation('tab_switch', 'medium', 'User switched to another tab');
    }
});

// Window blur detection
window.addEventListener('blur', () => {
    if (Date.now() - unfocusedStartTime > 3000) { // 3+ seconds
        logViolation('window_unfocused', 'medium', 'Extended focus loss detected');
    }
});
```

---

## ⌨️ Typing Burst Detection

### External Paste Detection

```javascript
// Detection parameters
const BURST_CHAR_THRESHOLD = 40;      // Characters
const BURST_TIME_THRESHOLD_MS = 300;  // Milliseconds
const BURST_LOG_DEBOUNCE_MS = 5000;   // Debounce logging

function handleTypingBurst(e) {
    const target = e.target;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
    
    const currentLength = target.value.length;
    const now = Date.now();
    const charDelta = currentLength - lastInputLength.current;
    const timeDelta = now - lastInputTime.current;
    
    // Detect suspiciously fast input
    if (charDelta >= BURST_CHAR_THRESHOLD && 
        timeDelta < BURST_TIME_THRESHOLD_MS &&
        now - lastBurstLogTime.current > BURST_LOG_DEBOUNCE_MS) {
        
        logViolation(
            'typing_burst_detected',
            'high',
            `Suspicious text burst: ${charDelta} characters in ${timeDelta}ms`
        );
    }
}
```

---

## 🔐 Device Fingerprinting

### Fingerprint Components

```javascript
const fingerprint = {
    // Browser identification
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    
    // Screen characteristics
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenColorDepth: screen.colorDepth,
    devicePixelRatio: window.devicePixelRatio,
    
    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    
    // Hardware hints
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints,
    
    // WebGL GPU fingerprint
    webglVendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
    webglRenderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
    
    // Canvas fingerprint (rendering differences)
    canvasHash: generateCanvasHash(),
    
    // Combined hash
    hash: generateCombinedHash()
};
```

### Session Continuity Verification

```javascript
function compareFingerprints(fp1, fp2) {
    const checks = [
        { key: 'screenWidth', weight: 5 },
        { key: 'timezone', weight: 15 },
        { key: 'webglRenderer', weight: 20 },
        { key: 'canvasHash', weight: 20 },
        { key: 'hardwareConcurrency', weight: 10 },
        { key: 'platform', weight: 10 }
    ];
    
    let score = 0;
    for (const check of checks) {
        if (fp1[check.key] === fp2[check.key]) {
            score += check.weight;
        }
    }
    
    return {
        score,               // 0-100
        isMatch: score >= 70 // 70%+ = same device
    };
}
```

---

## 🧪 Code Sandbox Security

### Banned Imports

```python
BANNED_IMPORTS = [
    'os', 'subprocess', 'sys', 'socket', 
    'requests', 'urllib', 'http', 'ftplib',
    'pickle', 'marshal', 'shutil', 'tempfile',
    'ctypes', 'multiprocessing', 'threading',
    '__builtins__', 'eval', 'exec', 'compile',
    'importlib', '__import__'
]
```

### Execution Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Timeout | 10 seconds | Prevent infinite loops |
| Memory | 128 MB | Prevent memory exhaustion |
| Output | 10,000 chars | Prevent output flooding |
| File access | None | Prevent file system access |

### Security Check Flow

```python
def _check_security(self, code: str) -> Optional[str]:
    code_lower = code.lower()
    
    for banned in self.BANNED_IMPORTS:
        patterns = [
            f"import {banned}",
            f"from {banned}",
            f"__import__('{banned}'",
        ]
        for pattern in patterns:
            if pattern in code_lower:
                return f"Restricted module detected: {banned}"
    
    dangerous_calls = ['eval(', 'exec(', 'compile(', 'open(']
    for call in dangerous_calls:
        if call in code_lower:
            return f"Restricted function detected: {call}"
    
    return None  # Code is safe
```

---

## 📊 Violation Severity Classification

```
┌─────────────────────────────────────────────────────────────────┐
│                 VIOLATION SEVERITY MATRIX                       │
│                                                                 │
│  CRITICAL (10 points)                                          │
│  ├── Different person detected                                 │
│  ├── Security bypass attempt                                   │
│  └── Multiple critical violations                              │
│                                                                 │
│  HIGH (5 points)                                               │
│  ├── Typing burst detected (>40 chars in <300ms)               │
│  ├── Multiple faces detected                                   │
│  ├── Paste attempt                                             │
│  └── Fullscreen exit                                           │
│                                                                 │
│  MEDIUM (2 points)                                             │
│  ├── Tab switch                                                │
│  ├── Window unfocused (>3s)                                    │
│  ├── Keyboard shortcuts                                        │
│  └── No face detected                                          │
│                                                                 │
│  LOW (1 point)                                                 │
│  ├── Copy attempt                                              │
│  ├── Context menu block                                        │
│  └── Brief focus loss                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Trustworthiness Rating

| Severity Score | Rating | Impact on Decision |
|---------------|--------|-------------------|
| 0-5 | HIGH | No impact |
| 6-10 | MEDIUM | Minor concern noted |
| 11-20 | LOW | Conditional recommendation |
| 21+ | CRITICAL | Auto-reject consideration |

---

## 📝 Violation Logging

### IntegrityEvent Model

```python
class IntegrityEvent(BaseModel):
    timestamp: str
    event_type: str      # tab_switch, paste_detected, no_face, etc.
    severity: str        # low, medium, high, critical
    context: Optional[str] = None
```

### Real-Time Logging to Backend

```javascript
async function logViolation(eventType, severity, context) {
    // Update local state
    setViolations(prev => [...prev, { eventType, severity, context, timestamp: new Date() }]);
    
    // Send to backend
    try {
        await api.logViolation(candidateId, eventType, severity, context);
    } catch (err) {
        console.error('Failed to log violation:', err);
    }
    
    // Notify parent component
    onViolation?.({ eventType, severity, context });
}
```

---

## 🛡️ Shadow Probe Verification

### Purpose

Verify the candidate actually wrote the code by asking targeted follow-up questions:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHADOW PROBE FLOW                            │
│                                                                 │
│  Code Submitted → AI Analyzes → Generates Probe → Candidate     │
│                                  Question         Response      │
│                                                                 │
│  Example:                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ "I noticed you used a hash map on line 12. Why did you   │  │
│  │  choose this over a sorted array for the lookup?"        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  If copied: Candidate struggles to explain                      │
│  If original: Candidate explains confidently                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Evaluation Criteria Alignment (15%)

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| Proctoring | ✅ Face detection + baseline | `IntegrityMonitor.jsx` |
| Tab monitoring | ✅ Visibility + blur events | Event listeners |
| Copy/paste blocking | ✅ Event prevention | `handlePaste()` |
| Code sandbox | ✅ Banned imports + timeout | `code_executor.py` |
| Device fingerprinting | ✅ WebGL + canvas + hardware | `deviceFingerprint.js` |
| Violation logging | ✅ Real-time to backend | `api.logViolation()` |
| Severity classification | ✅ Weighted scoring | IntegrityEvidence |
| Behavioral analysis | ✅ Typing burst detection | `handleTypingBurst()` |
