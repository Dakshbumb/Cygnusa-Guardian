/**
 * Device Fingerprinting Utility
 * Captures browser, device, and environment data for security verification.
 * Used to detect session handovers and unauthorized device changes.
 */

/**
 * Generate a unique device fingerprint based on browser/device characteristics
 * @returns {Object} Fingerprint object with all components
 */
export function generateDeviceFingerprint() {
    const fingerprint = {
        // Browser info
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages?.join(',') || navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,

        // Screen characteristics
        screenWidth: screen.width,
        screenHeight: screen.height,
        screenColorDepth: screen.colorDepth,
        screenPixelRatio: window.devicePixelRatio || 1,
        availableWidth: screen.availWidth,
        availableHeight: screen.availHeight,

        // Timezone
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),

        // Hardware hints
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown',
        maxTouchPoints: navigator.maxTouchPoints || 0,

        // WebGL fingerprint (GPU info)
        webglVendor: getWebGLVendor(),
        webglRenderer: getWebGLRenderer(),

        // Canvas fingerprint (simplified)
        canvasHash: getCanvasFingerprint(),

        // Connection info
        connectionType: navigator.connection?.effectiveType || 'unknown',

        // Timestamp
        capturedAt: new Date().toISOString()
    };

    // Generate hash of all components
    fingerprint.hash = generateHash(fingerprint);

    return fingerprint;
}

/**
 * Get WebGL vendor string
 */
function getWebGLVendor() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'unknown';

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return 'unknown';

        return gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
    } catch (e) {
        return 'error';
    }
}

/**
 * Get WebGL renderer string (GPU)
 */
function getWebGLRenderer() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'unknown';

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return 'unknown';

        return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
    } catch (e) {
        return 'error';
    }
}

/**
 * Generate a simple canvas fingerprint
 */
function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');

        // Draw some unique content
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 67, 30);
        ctx.fillStyle = '#069';
        ctx.fillText('Cygnusa 🔐', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Guardian', 4, 17);

        // Get data URL and hash it
        const dataUrl = canvas.toDataURL();
        return simpleHash(dataUrl);
    } catch (e) {
        return 'error';
    }
}

/**
 * Simple string hash function
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
}

/**
 * Generate hash of fingerprint object
 */
function generateHash(fp) {
    const str = JSON.stringify({
        ua: fp.userAgent,
        lang: fp.language,
        screen: `${fp.screenWidth}x${fp.screenHeight}x${fp.screenColorDepth}`,
        tz: fp.timezone,
        hw: fp.hardwareConcurrency,
        webgl: fp.webglRenderer,
        canvas: fp.canvasHash
    });
    return simpleHash(str);
}

/**
 * Compare two fingerprints and return similarity score
 * @param {Object} fp1 - First fingerprint
 * @param {Object} fp2 - Second fingerprint
 * @returns {Object} { score: 0-100, mismatches: string[] }
 */
export function compareFingerprints(fp1, fp2) {
    const checks = [
        { key: 'screenWidth', weight: 5 },
        { key: 'screenHeight', weight: 5 },
        { key: 'timezone', weight: 15 },
        { key: 'hardwareConcurrency', weight: 10 },
        { key: 'webglRenderer', weight: 20 },
        { key: 'platform', weight: 10 },
        { key: 'language', weight: 5 },
        { key: 'canvasHash', weight: 20 },
        { key: 'screenColorDepth', weight: 5 },
        { key: 'maxTouchPoints', weight: 5 }
    ];

    let score = 0;
    const mismatches = [];

    for (const check of checks) {
        if (fp1[check.key] === fp2[check.key]) {
            score += check.weight;
        } else {
            mismatches.push(check.key);
        }
    }

    return { score, mismatches };
}

/**
 * Get IP address (requires backend call)
 */
export async function getIPAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (e) {
        return 'unknown';
    }
}
