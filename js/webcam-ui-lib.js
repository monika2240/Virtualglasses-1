/**
 * Webcam UI Library
 * Handles camera initialization, video streaming, and UI interactions
 */

class WebcamUILib {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.stream = null;
        this.isRunning = false;
        
        this.constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        };
        
        this.callbacks = {
            onStart: null,
            onStop: null,
            onError: null
        };
    }

    /**
     * Initialize camera stream
     */
    async startCamera() {
        try {
            this.updateStatus('Starting camera...');
            this.showLoading();

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
            this.video.srcObject = this.stream;
            
            // Wait for video to be ready
            await new Promise(resolve => {
                this.video.onloadedmetadata = resolve;
            });

            // Set canvas size to match video
            if (this.canvas) {
                this.canvas.width = this.video.videoWidth || 640;
                this.canvas.height = this.video.videoHeight || 480;
            }

            this.isRunning = true;
            this.updateUI(true);
            this.hideLoading();
            
            if (this.callbacks.onStart) {
                this.callbacks.onStart();
            }

            this.updateStatus('Camera active');
            return true;

        } catch (error) {
            this.hideLoading();
            const errorMsg = this.getCameraErrorMessage(error);
            this.showError(errorMsg);
            this.updateStatus('Camera failed');
            
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            
            return false;
        }
    }

    /**
     * Stop camera stream and cleanup
     */
    stopCamera() {
        this.isRunning = false;

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.video) {
            this.video.srcObject = null;
        }

        if (this.canvas && this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.updateUI(false);
        
        if (this.callbacks.onStop) {
            this.callbacks.onStop();
        }

        this.updateStatus('Camera stopped');
    }

    /**
     * Update UI elements based on camera state
     */
    updateUI(isActive) {
        const placeholder = document.getElementById('placeholder');
        const startBtn = document.getElementById('startCamera');
        const stopBtn = document.getElementById('stopCamera');
        const captureBtn = document.getElementById('capturePhoto');
        const faceInfo = document.getElementById('faceInfo');

        if (isActive) {
            if (placeholder) placeholder.style.display = 'none';
            if (this.video) this.video.style.display = 'block';
            if (this.canvas) this.canvas.style.display = 'block';
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'inline-block';
            if (captureBtn) captureBtn.style.display = 'inline-block';
            if (faceInfo) faceInfo.style.display = 'block';
        } else {
            if (placeholder) placeholder.style.display = 'block';
            if (this.video) this.video.style.display = 'none';
            if (this.canvas) this.canvas.style.display = 'none';
            if (startBtn) startBtn.style.display = 'inline-block';
            if (stopBtn) stopBtn.style.display = 'none';
            if (captureBtn) captureBtn.style.display = 'none';
            if (faceInfo) faceInfo.style.display = 'none';
        }
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'block';
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    /**
     * Display error message
     */
    showError(message) {
        const errorDiv = document.getElementById('errorDiv');
        const errorText = document.getElementById('errorText');
        
        if (errorText) errorText.textContent = message;
        if (errorDiv) errorDiv.classList.add('show');
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorDiv = document.getElementById('errorDiv');
        if (errorDiv) errorDiv.classList.remove('show');
    }

    /**
     * Update status display
     */
    updateStatus(message) {
        const status = document.getElementById('status');
        if (status) {
            status.textContent = message;
        }
        console.log('[WebcamUI]', message);
    }

    /**
     * Capture photo from video stream
     */
    capturePhoto(filename = null) {
        if (!this.video || !this.canvas || !this.ctx) {
            this.showError('Camera not ready for photo capture');
            return null;
        }

        // Create temporary canvas for full image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw mirrored video
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(this.video, -tempCanvas.width, 0);
        tempCtx.restore();

        // Draw overlay from main canvas
        tempCtx.drawImage(this.canvas, 0, 0);

        // Generate download
        const link = document.createElement('a');
        link.download = filename || `virtual-glasses-${Date.now()}.png`;
        link.href = tempCanvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.updateStatus('Photo captured and downloaded!');
        return tempCanvas.toDataURL('image/png');
    }

    /**
     * Get user-friendly error message for camera errors
     */
    getCameraErrorMessage(error) {
        const errorMessages = {
            'NotAllowedError': 'Camera access denied. Please allow camera permission and refresh the page.',
            'NotFoundError': 'No camera found. Please connect a camera and refresh the page.',
            'NotReadableError': 'Camera is busy or not accessible. Please close other applications using the camera.',
            'OverconstrainedError': 'Camera constraints not supported. Please try with a different camera.',
            'SecurityError': 'Camera access blocked due to security restrictions.',
            'AbortError': 'Camera access was aborted.',
            'TypeError': 'Camera not supported in this browser.'
        };

        return errorMessages[error.name] || `Camera error: ${error.message}`;
    }

    /**
     * Check if camera is supported
     */
    static isCameraSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Set callback functions
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Get current video element
     */
    getVideoElement() {
        return this.video;
    }

    /**
     * Get current canvas element
     */
    getCanvasElement() {
        return this.canvas;
    }

    /**
     * Get canvas context
     */
    getCanvasContext() {
        return this.ctx;
    }

    /**
     * Check if camera is running
     */
    isActive() {
        return this.isRunning;
    }

    /**
     * Update face detection count display
     */
    updateFaceCount(count) {
        const faceInfo = document.getElementById('faceCount');
        if (!faceInfo) return;

        if (count === 0) {
            faceInfo.textContent = 'No faces detected - look at the camera';
            faceInfo.style.color = '#856404';
        } else if (count === 1) {
            faceInfo.textContent = '✅ Face detected - glasses applied!';
            faceInfo.style.color = '#155724';
        } else {
            faceInfo.textContent = `✅ ${count} faces detected`;
            faceInfo.style.color = '#155724';
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopCamera();
    }
}

// Export for global use
window.WebcamUILib = WebcamUILib;