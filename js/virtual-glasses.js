/**
 * Virtual Glasses Try-On Application
 * Main application class that handles face detection and glasses overlay
 */

class VirtualGlassesTryOn {
    constructor() {
        this.webcamUI = new WebcamUILib();
        this.model = null;
        this.animationId = null;
        this.currentGlassesStyle = 'glasses-04';
        this.currentGlassesImage = '3dmodel/glasses-04/glasses_04.png';
        this.glassesImg = null;
        this.isModelLoaded = false;
        
        // Position smoothing for stable glasses overlay
        this.lastGlassesPosition = { x: 0, y: 0, width: 0, height: 0, angle: 0 };
        this.smoothingFactor = 0.7; // Higher = more smoothing, less jitter
        
        // Face detection settings
        this.faceDetectionConfig = {
            maxFaces: 1,  // Focus on one face for better accuracy
            refineLandmarks: true,
            minDetectionConfidence: 0.7, // Higher confidence for better accuracy
            minTrackingConfidence: 0.5
        };
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.setupEventListeners();
        this.setupWebcamCallbacks();
        this.preloadGlassesImages();
        this.updateStatus('Ready - Click Start Camera');
        
        // Check if required libraries are loaded
        setTimeout(() => {
            if (typeof tf === 'undefined' || typeof faceLandmarksDetection === 'undefined') {
                this.showError('Required AI libraries failed to load. Please refresh the page.');
            }
        }, 2000);
    }

    /**
     * Setup event listeners for UI elements
     */
    setupEventListeners() {
        // Camera controls
        const startBtn = document.getElementById('startCamera');
        const stopBtn = document.getElementById('stopCamera');
        const captureBtn = document.getElementById('capturePhoto');
        
        if (startBtn) startBtn.addEventListener('click', () => this.startCamera());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopCamera());
        if (captureBtn) captureBtn.addEventListener('click', () => this.capturePhoto());

        // Glasses selection
        document.querySelectorAll('.glasses-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectGlasses(e.currentTarget));
        });

        // Error handling
        const closeErrorBtn = document.getElementById('closeError');
        if (closeErrorBtn) {
            closeErrorBtn.addEventListener('click', () => this.webcamUI.hideError());
        }

        // Handle page unload
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    /**
     * Setup webcam UI callbacks
     */
    setupWebcamCallbacks() {
        this.webcamUI.setCallbacks({
            onStart: () => this.onCameraStart(),
            onStop: () => this.onCameraStop(),
            onError: (error) => this.onCameraError(error)
        });
    }

    /**
     * Preload all glasses images
     */
    preloadGlassesImages() {
        const glassesOptions = document.querySelectorAll('.glasses-option');
        
        glassesOptions.forEach(option => {
            const imgSrc = option.dataset.image;
            if (imgSrc) {
                const img = new Image();
                img.src = imgSrc;
                // Handle broken image links
                img.onerror = () => {
                    console.warn(`Failed to load glasses image: ${imgSrc}`);
                    option.style.opacity = '0.5';
                    option.title = 'Image not available';
                };
            }
        });

        // Load initial glasses image
        this.loadGlassesImage(this.currentGlassesImage);
    }

    /**
     * Load specific glasses image
     */
    loadGlassesImage(imageSrc) {
        this.glassesImg = new Image();
        this.glassesImg.onload = () => {
            this.updateStatus(`Loaded glasses: ${this.currentGlassesStyle}`);
        };
        this.glassesImg.onerror = () => {
            console.error(`Failed to load glasses image: ${imageSrc}`);
            this.showError(`Failed to load glasses image: ${imageSrc}`);
        };
        this.glassesImg.src = imageSrc;
    }

    /**
     * Start camera and face detection
     */
    async startCamera() {
        const success = await this.webcamUI.startCamera();
        if (success) {
            await this.loadFaceDetectionModel();
            this.startFaceDetection();
        }
    }

    /**
     * Stop camera and face detection
     */
    stopCamera() {
        this.stopFaceDetection();
        this.webcamUI.stopCamera();
    }

    /**
     * Capture photo with glasses overlay
     */
    capturePhoto() {
        const filename = `virtual-glasses-${this.currentGlassesStyle}-${Date.now()}.png`;
        this.webcamUI.capturePhoto(filename);
    }

    /**
     * Load TensorFlow face detection model
     */
    async loadFaceDetectionModel() {
        if (this.model || this.isModelLoaded) return;

        try {
            this.updateStatus('Loading AI model...');
            this.webcamUI.showLoading();

            this.model = await faceLandmarksDetection.load(
                faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
                this.faceDetectionConfig
            );
            
            this.isModelLoaded = true;
            this.webcamUI.hideLoading();
            this.updateStatus('AI model loaded successfully');

        } catch (error) {
            this.webcamUI.hideLoading();
            this.showError(`AI model loading failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Start face detection loop
     */
    startFaceDetection() {
        if (!this.webcamUI.isActive() || !this.model) return;
        
        this.detectFaces();
        this.updateStatus('Face detection running');
    }

    /**
     * Stop face detection loop
     */
    stopFaceDetection() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Main face detection and glasses rendering loop
     */
    async detectFaces() {
        if (!this.webcamUI.isActive() || !this.model) return;

        try {
            const video = this.webcamUI.getVideoElement();
            const canvas = this.webcamUI.getCanvasElement();
            const ctx = this.webcamUI.getCanvasContext();

            if (!video || !canvas || !ctx) return;

            // Detect faces
            const faces = await this.model.estimateFaces({
                input: video,
                returnTensors: false,
                flipHorizontal: false,
                predictIrises: true
            });

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw glasses on each detected face
            faces.forEach(face => {
                if (face.scaledMesh && face.scaledMesh.length > 168) {
                    this.drawGlassesOnFace(ctx, face.scaledMesh);
                }
            });

            // Update face count display
            this.webcamUI.updateFaceCount(faces.length);

        } catch (error) {
            console.warn('Face detection error:', error);
        }

        // Continue detection loop
        if (this.webcamUI.isActive()) {
            this.animationId = requestAnimationFrame(() => this.detectFaces());
        }
    }

    /**
     * Draw glasses on detected face using landmarks
     */
    drawGlassesOnFace(ctx, landmarks) {
        if (!this.glassesImg || !this.glassesImg.complete) return;

        // More reliable landmark indices for MediaPipe Face Mesh
        const leftEyeInner = landmarks[133];   // Left eye inner corner
        const rightEyeInner = landmarks[362];  // Right eye inner corner
        const leftEyeOuter = landmarks[33];    // Left eye outer corner  
        const rightEyeOuter = landmarks[263];  // Right eye outer corner
        const leftEyeTop = landmarks[159];     // Left eye top
        const rightEyeTop = landmarks[386];    // Right eye top
        const noseTip = landmarks[1];          // Nose tip
        const noseBridge = landmarks[168];     // Nose bridge

        if (!leftEyeInner || !rightEyeInner || !leftEyeOuter || !rightEyeOuter) {
            console.warn('Essential eye landmarks not detected');
            return;
        }

        // Calculate more accurate eye centers
        const leftEyeCenter = [
            (leftEyeInner[0] + leftEyeOuter[0]) / 2,
            (leftEyeInner[1] + leftEyeOuter[1] + leftEyeTop[1]) / 3  // Include top for better Y position
        ];
        const rightEyeCenter = [
            (rightEyeInner[0] + rightEyeOuter[0]) / 2,
            (rightEyeInner[1] + rightEyeOuter[1] + rightEyeTop[1]) / 3
        ];

        // Calculate the center point between eyes
        const eyesCenterX = (leftEyeCenter[0] + rightEyeCenter[0]) / 2;
        const eyesCenterY = (leftEyeCenter[1] + rightEyeCenter[1]) / 2;

        // Position glasses at eye level (not above)
        const glassesX = eyesCenterX;
        const glassesY = eyesCenterY - 5; // Only slight adjustment upward

        // Calculate inter-pupillary distance for proper scaling
        const eyeDistance = Math.sqrt(
            Math.pow(rightEyeCenter[0] - leftEyeCenter[0], 2) + 
            Math.pow(rightEyeCenter[1] - leftEyeCenter[1], 2)
        );

        // Calculate face tilt angle but limit it severely
        let faceAngle = Math.atan2(
            rightEyeCenter[1] - leftEyeCenter[1], 
            rightEyeCenter[0] - leftEyeCenter[0]
        );
        
        // Severely limit rotation - keep glasses nearly horizontal
        faceAngle = Math.max(-0.1, Math.min(0.1, faceAngle)); // Max 5.7 degrees

        // Improved scaling - glasses should span across both eyes
        const glassesScale = eyeDistance / 80; // Adjusted scale factor
        let finalWidth = this.glassesImg.width * glassesScale;
        let finalHeight = this.glassesImg.height * glassesScale;

        // Ensure glasses are wide enough to cover both eyes
        const minWidth = eyeDistance * 1.8; // At least 1.8x the eye distance
        const maxWidth = eyeDistance * 2.5; // Maximum reasonable width
        
        finalWidth = Math.max(minWidth, Math.min(maxWidth, finalWidth));
        finalHeight = finalWidth * (this.glassesImg.height / this.glassesImg.width);

        // Apply position smoothing but with adjusted parameters
        if (this.lastGlassesPosition.x === 0) {
            // First frame - initialize without smoothing
            this.lastGlassesPosition = {
                x: glassesX,
                y: glassesY,
                width: finalWidth,
                height: finalHeight,
                angle: faceAngle
            };
        }

        const smoothingFactor = 0.6; // Reduced for more responsiveness
        const smoothedX = this.lastGlassesPosition.x * smoothingFactor + glassesX * (1 - smoothingFactor);
        const smoothedY = this.lastGlassesPosition.y * smoothingFactor + glassesY * (1 - smoothingFactor);
        const smoothedWidth = this.lastGlassesPosition.width * smoothingFactor + finalWidth * (1 - smoothingFactor);
        const smoothedHeight = this.lastGlassesPosition.height * smoothingFactor + finalHeight * (1 - smoothingFactor);
        const smoothedAngle = this.lastGlassesPosition.angle * smoothingFactor + faceAngle * (1 - smoothingFactor);

        // Update last position
        this.lastGlassesPosition = {
            x: smoothedX,
            y: smoothedY,
            width: smoothedWidth,
            height: smoothedHeight,
            angle: smoothedAngle
        };

        // Draw glasses
        ctx.save();
        
        // Better blending
        ctx.globalAlpha = 0.9;
        ctx.globalCompositeOperation = 'source-over';
        
        // Transform and draw
        ctx.translate(smoothedX, smoothedY);
        ctx.rotate(smoothedAngle);
        
        // Draw centered on the face
        ctx.drawImage(
            this.glassesImg,
            -smoothedWidth / 2,
            -smoothedHeight / 2,
            smoothedWidth,
            smoothedHeight
        );
        
        // Optional: Draw debug points to verify positioning
        if (false) { // Set to true for debugging
            ctx.restore();
            ctx.save();
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(leftEyeCenter[0], leftEyeCenter[1], 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(rightEyeCenter[0], rightEyeCenter[1], 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.arc(glassesX, glassesY, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        ctx.restore();
    }

    /**
     * Select glasses style
     */
    selectGlasses(element) {
        // Update UI
        document.querySelector('.glasses-option.active')?.classList.remove('active');
        element.classList.add('active');
        
        // Update current style and image
        this.currentGlassesStyle = element.dataset.style;
        this.currentGlassesImage = element.dataset.image;
        
        // Load new glasses image
        this.loadGlassesImage(this.currentGlassesImage);
        
        this.updateStatus(`Selected: ${element.querySelector('.label').textContent} glasses`);
    }

    /**
     * Camera start callback
     */
    onCameraStart() {
        this.updateStatus('Camera started successfully');
    }

    /**
     * Camera stop callback
     */
    onCameraStop() {
        this.stopFaceDetection();
        this.updateStatus('Camera stopped');
    }

    /**
     * Camera error callback
     */
    onCameraError(error) {
        this.stopFaceDetection();
        console.error('Camera error:', error);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.webcamUI.showError(message);
    }

    /**
     * Update status display
     */
    updateStatus(message) {
        this.webcamUI.updateStatus(message);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopFaceDetection();
        this.webcamUI.cleanup();
        
        if (this.model) {
            // TensorFlow.js models don't need explicit disposal for face landmarks
            this.model = null;
        }
        
        this.isModelLoaded = false;
    }

    /**
     * Get current glasses information
     */
    getCurrentGlasses() {
        return {
            style: this.currentGlassesStyle,
            image: this.currentGlassesImage
        };
    }

    /**
     * Check if face detection is running
     */
    isFaceDetectionActive() {
        return this.animationId !== null && this.webcamUI.isActive();
    }

    /**
     * Update face detection configuration
     */
    updateFaceDetectionConfig(config) {
        this.faceDetectionConfig = { ...this.faceDetectionConfig, ...config };
        
        // Reload model with new config if needed
        if (this.isModelLoaded) {
            this.isModelLoaded = false;
            this.model = null;
            if (this.webcamUI.isActive()) {
                this.loadFaceDetectionModel().then(() => {
                    this.startFaceDetection();
                });
            }
        }
    }

    /**
     * Get face detection statistics
     */
    getFaceDetectionStats() {
        return {
            isModelLoaded: this.isModelLoaded,
            isDetectionRunning: this.isFaceDetectionActive(),
            currentConfig: this.faceDetectionConfig
        };
    }
}

// Initialize the application when DOM is ready
let virtualGlassesApp;

document.addEventListener('DOMContentLoaded', () => {
    // Check for required dependencies
    if (!WebcamUILib) {
        console.error('WebcamUILib not found. Please include webcam-ui-lib.js');
        return;
    }

    if (typeof tf === 'undefined') {
        console.error('TensorFlow.js not found. Please include TensorFlow.js');
        return;
    }

    if (typeof faceLandmarksDetection === 'undefined') {
        console.error('Face Landmarks Detection not found. Please include face-landmarks-detection.js');
        return;
    }

    // Initialize the application
    try {
        virtualGlassesApp = new VirtualGlassesTryOn();
        console.log('Virtual Glasses Try-On application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Virtual Glasses Try-On:', error);
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (virtualGlassesApp) {
        if (document.hidden) {
            // Pause face detection when page is hidden
            virtualGlassesApp.stopFaceDetection();
        } else if (virtualGlassesApp.webcamUI.isActive()) {
            // Resume face detection when page is visible again
            setTimeout(() => {
                virtualGlassesApp.startFaceDetection();
            }, 100);
        }
    }
});

// Export for global access
window.VirtualGlassesTryOn = VirtualGlassesTryOn;