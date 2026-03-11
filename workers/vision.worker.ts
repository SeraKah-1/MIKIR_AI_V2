let landmarker: any = null;

self.onmessage = async (e: MessageEvent) => {
  if (e.data.type === 'INIT') {
    try {
      // @ts-ignore
      const { FilesetResolver, HandLandmarker } = await import("https://esm.sh/@mediapipe/tasks-vision@0.10.17");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
      );

      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "IMAGE",
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6
      });

      self.postMessage({ type: 'INIT_SUCCESS' });
    } catch (err: any) {
      self.postMessage({ type: 'INIT_ERROR', error: err.message });
    }
  } else if (e.data.type === 'DETECT') {
    if (!landmarker) return;
    
    const { frame, timestamp } = e.data;
    
    try {
      const results = landmarker.detect(frame);
      
      let gesture = null;
      let landmarks = null;
      
      if (results.landmarks && results.landmarks.length > 0) {
        landmarks = results.landmarks[0];
        gesture = recognizeGesture(landmarks);
      }
      
      self.postMessage({ 
        type: 'DETECT_RESULT', 
        landmarks,
        gesture,
        timestamp
      });
    } catch (err: any) {
      // Ignore detection errors
    } finally {
      if (frame && frame.close) {
        frame.close();
      }
    }
  }
};

const recognizeGesture = (landmarks: any[]) => {
  const dist = (p1: any, p2: any) => {
      return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  };

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const indexPIP = landmarks[6];
  const middleTip = landmarks[12];
  const middlePIP = landmarks[10];
  const ringTip = landmarks[16];
  const ringPIP = landmarks[14];
  const pinkyTip = landmarks[20];
  const pinkyPIP = landmarks[18];

  const middleMCP = landmarks[9];
  const handScale = dist(wrist, middleMCP);

  const isExtended = (tip: any, pip: any) => {
      return dist(tip, wrist) > dist(pip, wrist) + (handScale * 0.1);
  };

  const indexExt = isExtended(indexTip, indexPIP);
  const middleExt = isExtended(middleTip, middlePIP);
  const ringExt = isExtended(ringTip, ringPIP);
  const pinkyExt = isExtended(pinkyTip, pinkyPIP);

  const indexMCP = landmarks[5];
  const thumbExtended = dist(thumbTip, indexMCP) > handScale * 0.5;

  const fingersCount = (indexExt ? 1 : 0) + (middleExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0);

  if (fingersCount === 0 && thumbExtended) {
      return "NEXT";
  }
  if (fingersCount === 4 && thumbExtended) {
      return "BACK";
  }
  if (fingersCount === 1 && indexExt) {
      return "1";
  }
  if (fingersCount === 2 && indexExt && middleExt) {
      return "2";
  }
  if (fingersCount === 3 && indexExt && middleExt && ringExt) {
      return "3";
  }
  if (fingersCount === 4 && !thumbExtended) {
      return "4";
  }
  return null;
};
