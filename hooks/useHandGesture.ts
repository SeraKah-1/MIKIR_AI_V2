
import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../contexts/CameraContext';

interface GestureState {
  isLoaded: boolean;
  error: string | null;
  detectedGesture: string | null;
  dwellProgress: number;
}

export const useHandGesture = (
  onTrigger: (gesture: string) => void,
  isPaused: boolean
) => {
  const { videoRef, isCameraReady, stream } = useCamera();
  const onTriggerRef = useRef(onTrigger);
  
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  const [state, setState] = useState<GestureState>({
    isLoaded: false,
    error: null,
    detectedGesture: null,
    dwellProgress: 0,
  });
  
  const [isHandDetected, setIsHandDetected] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef<number>(0);
  const lastGestureRef = useRef<string | null>(null);
  const gestureStartTimeRef = useRef<number>(0);
  const hasTriggeredRef = useRef<boolean>(false);
  const lastVideoTimeRef = useRef<number>(-1);
  const isProcessingRef = useRef<boolean>(false);

  // --- 1. LOAD MEDIAPIPE VIA WORKER ---
  useEffect(() => {
    let active = true;
    let loadTimeout: NodeJS.Timeout;
    
    const initWorker = () => {
      try {
        loadTimeout = setTimeout(() => {
            if (active) setState(prev => ({ ...prev, error: "Koneksi lambat. Gagal memuat AI." }));
        }, 15000);

        const worker = new Worker(new URL('../workers/vision.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (e) => {
          if (!active) return;
          
          if (e.data.type === 'INIT_SUCCESS') {
            clearTimeout(loadTimeout);
            setState(prev => ({ ...prev, isLoaded: true }));
          } else if (e.data.type === 'INIT_ERROR') {
            clearTimeout(loadTimeout);
            setState(prev => ({ ...prev, error: "Gagal memuat AI Kamera. Cek koneksi internet." }));
          } else if (e.data.type === 'DETECT_RESULT') {
            isProcessingRef.current = false;
            handleDetectionResult(e.data.landmarks, e.data.gesture);
          }
        };

        worker.postMessage({ type: 'INIT' });
        
      } catch (err: any) {
        console.error("Worker Load Error:", err);
        clearTimeout(loadTimeout);
        if (active) setState(prev => ({ ...prev, error: "Gagal memuat AI Kamera." }));
      }
    };

    initWorker();

    return () => {
      active = false;
      clearTimeout(loadTimeout);
      if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Start prediction loop when camera is ready
  useEffect(() => {
    if (isCameraReady && workerRef.current && state.isLoaded && !state.error) {
        requestRef.current = requestAnimationFrame(predictWebcam);
    }
    return () => {
        cancelAnimationFrame(requestRef.current);
    };
  }, [isCameraReady, state.isLoaded, state.error]);

  // --- 3. DETECTION LOOP (THROTTLED) ---
  const predictWebcam = async () => {
    if (!workerRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }
    
    if (video.currentTime !== lastVideoTimeRef.current && !isProcessingRef.current) {
        const timeDiff = (video.currentTime - lastVideoTimeRef.current) * 1000;
        if (timeDiff < 100) {
             requestRef.current = requestAnimationFrame(predictWebcam);
             return;
        }
        lastVideoTimeRef.current = video.currentTime;
        
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            try {
              const bitmap = await createImageBitmap(video);
              isProcessingRef.current = true;
              workerRef.current.postMessage({ 
                type: 'DETECT', 
                frame: bitmap,
                timestamp: performance.now()
              }, [bitmap]);
            } catch (e) {
              // Ignore createImageBitmap errors
            }
        }
    }
    
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const handleDetectionResult = (landmarks: any[] | null, gesture: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !videoRef.current) return;
    
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const roiW = canvas.width * 0.6;
    const roiH = canvas.height * 0.7;
    const roiX = (canvas.width - roiW) / 2;
    const roiY = (canvas.height - roiH) / 2;

    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (landmarks && landmarks.length > 0) {
          setIsHandDetected(true);
          
          const wrist = landmarks[0];
          const middleMCP = landmarks[9];
          const handCenterX = (wrist.x + middleMCP.x) / 2;
          const handCenterY = (wrist.y + middleMCP.y) / 2;

          const inROI = (handCenterX * canvas.width > roiX) && 
                        (handCenterX * canvas.width < roiX + roiW) &&
                        (handCenterY * canvas.height > roiY) &&
                        (handCenterY * canvas.height < roiY + roiH);

          drawHand(ctx, landmarks, inROI ? '#00ffcc' : '#f43f5e');

          ctx.strokeStyle = inROI ? 'rgba(0, 255, 204, 0.5)' : 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 10]);
          ctx.strokeRect(roiX, roiY, roiW, roiH);
          ctx.setLineDash([]);

          if (inROI && !isPaused) {
            handleDwellTime(gesture);
          } else {
            resetDwell();
          }
      } else {
          setIsHandDetected(false);
          resetDwell();
      }
    }
  };

  // --- 5. DWELL TIME LOGIC ---
  const handleDwellTime = (gesture: string | null) => {
     const now = performance.now();
     const DWELL_DURATION = 1200;
     
     if (gesture && gesture === lastGestureRef.current) {
        const duration = now - gestureStartTimeRef.current;
        const progress = Math.min(100, (duration / DWELL_DURATION) * 100); 
        
        setState(prev => ({ ...prev, detectedGesture: gesture, dwellProgress: progress }));

        if (duration > DWELL_DURATION && !hasTriggeredRef.current) {
           onTriggerRef.current(gesture);
           hasTriggeredRef.current = true;
           if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50, 50]);
        }
     } else {
        lastGestureRef.current = gesture;
        gestureStartTimeRef.current = now;
        hasTriggeredRef.current = false;
        setState(prev => ({ 
            ...prev, 
            detectedGesture: gesture, 
            dwellProgress: 0 
        }));
     }
  };

  const resetDwell = () => {
     lastGestureRef.current = null;
     gestureStartTimeRef.current = 0;
     setState(prev => ({ ...prev, detectedGesture: null, dwellProgress: 0 }));
  };

  const drawHand = (ctx: CanvasRenderingContext2D, landmarks: any[], color: string) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();

      const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [5, 6], [6, 7], [7, 8],
          [0, 9], [9, 10], [10, 11], [11, 12],
          [0, 13], [13, 14], [14, 15], [15, 16],
          [0, 17], [17, 18], [18, 19], [19, 20]
      ];

      for (const [start, end] of connections) {
          const p1 = landmarks[start];
          const p2 = landmarks[end];
          ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
          ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
      }
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      for (const landmark of landmarks) {
          ctx.beginPath();
          ctx.arc(landmark.x * ctx.canvas.width, landmark.y * ctx.canvas.height, 2, 0, 2 * Math.PI);
          ctx.fill();
      }
      
      ctx.shadowBlur = 0;
  };

  return { canvasRef, isHandDetected, stream, ...state };
};
