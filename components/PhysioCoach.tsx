"use client";
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import UserProfileForm from './UserProfileForm';

// Declare MediaPipe global types
declare global {
  interface Window {
    Pose: any;
    Camera: any;
  }
}

interface ExerciseData {
  exerciseName: string;
  description: string;
  steps: string[];
  targetKeypoints: number[];
  angleCalculations: {
    primaryAngle: {
      points: [number, number, number];
      name: string;
    };
    secondaryAngles?: {
      points: [number, number, number];
      name: string;
    }[];
  };
  targetRanges: {
    startingPosition: [number, number];
    targetRange: [number, number];
    optimalPeak: [number, number];
  };
  formChecks: {
    condition: string;
    errorMessage: string;
    keypoints: number[];
  }[];
  repThresholds: {
    liftingMin: number;
    loweringMax: number;
    restMax: number;
  };
}

// YouTube Demo Component
function YouTubeDemo({ exerciseName, isVisible }: { exerciseName: string; isVisible: boolean }) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    
    const searchYouTube = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Create search query for physiotherapy exercise
        const searchQuery = `${exerciseName} physiotherapy exercise demonstration proper form`;
        
        // Use YouTube search API alternative (you could also use YouTube Data API)
        const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(searchQuery)}`);
        
        if (!response.ok) {
          // Fallback: Use predefined video IDs for common exercises
          const fallbackVideos: { [key: string]: string } = {
            'shoulder abduction': 'x5F5kW8qj3U', // Physical therapy shoulder abduction
            'shoulder flexion': 'mGj8HQ0_HYc', // Shoulder flexion exercise
            'bicep curl': 'ykJG6cHPB_M', // Proper bicep curl form
            'arm curl': 'ykJG6cHPB_M', // Same as bicep curl
            'pendulum': 'FhCCl0qsB4E', // Pendulum exercise for shoulder
            'leg raise': 'JeWkFhVKSx4', // Leg raise exercise
            'default': 'x5F5kW8qj3U' // Default shoulder exercise
          };
          
          const key = Object.keys(fallbackVideos).find(k => 
            exerciseName.toLowerCase().includes(k)
          ) || 'default';
          
          setVideoId(fallbackVideos[key]);
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        if (data.videoId) {
          setVideoId(data.videoId);
        } else {
          throw new Error('No video found');
        }
      } catch (err) {
        console.error('Error fetching YouTube video:', err);
        setError('Could not load demonstration video');
        // Use fallback
        setVideoId('x5F5kW8qj3U'); // Default shoulder exercise video
      }
      
      setLoading(false);
    };

    searchYouTube();
  }, [exerciseName, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">
        Exercise Demonstration
      </h3>
      
      {loading && (
        <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading demonstration...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {videoId && !loading && (
        <div className="relative">
          <div style={{ paddingBottom: '56.25%', position: 'relative', height: 0 }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?start=10&rel=0&modestbranding=1`}
              title={`${exerciseName} demonstration`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '8px'
              }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 text-center">
            Watch this demonstration to understand proper form
          </p>
        </div>
      )}
    </div>
  );
}

export default function PhysiotherapyCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const repCounterRef = useRef(0);
  const lastStateRef = useRef('ready');
  const hasReachedPeakRef = useRef(false);
  const lastRepTimeRef = useRef(0);
  
  const [feedback, setFeedback] = useState('Loading MediaPipe...');
  const [exerciseState, setExerciseState] = useState('ready');
  const [repCount, setRepCount] = useState(0);
  const [armAngle, setArmAngle] = useState(0);
  const [isCorrectForm, setIsCorrectForm] = useState<boolean | null>(null);
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState({ camera: false, pose: false });
  
  // New state for dynamic exercise system
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<ExerciseData | null>(null);
  const [isExerciseActive, setIsExerciseActive] = useState(false);
  const [detectedArm, setDetectedArm] = useState<'left' | 'right'>('left');
  const [exerciseStarted, setExerciseStarted] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  // Set MediaPipe as loaded when both scripts are loaded
  useEffect(() => {
    if (scriptsLoaded.camera && scriptsLoaded.pose && window.Camera && window.Pose) {
      setIsMediaPipeLoaded(true);
    }
  }, [scriptsLoaded]);

  // Global error handler to suppress MediaPipe cleanup errors
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('SolutionWasm') || 
          message.includes('deleted object') || 
          message.includes('pointer') ||
          message.includes('MediaPipe')) {
        // Suppress MediaPipe cleanup errors
        return;
      }
      originalError.apply(console, args);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || event.reason;
      if (typeof message === 'string' && 
          (message.includes('SolutionWasm') || 
           message.includes('deleted object') || 
           message.includes('pointer'))) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      console.error = originalError;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Handler for exercise generation
  const handleExerciseGenerated = (exerciseData: ExerciseData) => {
    setCurrentExercise(exerciseData);
    setIsExerciseActive(true);
    setRepCount(0);
    repCounterRef.current = 0;
    hasReachedPeakRef.current = false;
    lastStateRef.current = 'ready';
    setExerciseStarted(false);
    setFeedback(`Exercise loaded: ${exerciseData.exerciseName}. Click "Start Exercise" to begin.`);
  };

  // Default exercise data (fallback)
  const defaultExercise: ExerciseData = {
    exerciseName: "Shoulder Abduction",
    description: "Basic shoulder abduction exercise for shoulder mobility",
    steps: [
      "Stand facing the camera",
      "Keep your arm straight", 
      "Slowly lift your arm to the side",
      "Raise until horizontal (90°)",
      "Lower slowly and controlled",
      "Repeat for desired reps"
    ],
    targetKeypoints: [11, 13, 15, 23],
    angleCalculations: {
      primaryAngle: {
        points: [23, 11, 13],
        name: "Shoulder Abduction Angle"
      }
    },
    targetRanges: {
      startingPosition: [0, 45],
      targetRange: [90, 180], 
      optimalPeak: [90, 120]
    },
    formChecks: [
      {
        condition: "wrist higher than shoulder",
        errorMessage: "Keep your arm horizontal, don't lift too high",
        keypoints: [11, 15]
      },
      {
        condition: "elbow below shoulder",
        errorMessage: "Keep your elbow level with your shoulder", 
        keypoints: [11, 13]
      }
    ],
    repThresholds: {
      liftingMin: 60,
      loweringMax: 75,
      restMax: 45
    }
  };

  // Reset rep counter when starting exercise
  const handleStartExercise = () => {
    setExerciseStarted(!exerciseStarted);
    if (!exerciseStarted) {
      setRepCount(0);
      repCounterRef.current = 0;
      hasReachedPeakRef.current = false;
      lastRepTimeRef.current = 0;
      lastStateRef.current = 'ready';
      setFeedback('Exercise started! Begin your movements');
    } else {
      setFeedback('Exercise stopped');
    }
  };

  const getExerciseBodyPart = (exercise: ExerciseData): 'arms' | 'legs' => {
    const keypoints = exercise.targetKeypoints;
    const hasArmKeypoints = keypoints.some(k => k >= 11 && k <= 22);
    const hasLegKeypoints = keypoints.some(k => k >= 23 && k <= 32);
    
    return hasLegKeypoints ? 'legs' : 'arms';
  };

  useEffect(() => {
    if (!isMediaPipeLoaded) return;

    let pose: any = null;
    let camera: any = null;

    const initializeMediaPipe = async () => {
      try {
        const { Pose } = window;
        const { Camera } = window;

        if (!Pose || !Camera) {
          setFeedback('MediaPipe not loaded properly. Please refresh the page.');
          return;
        }

        pose = new Pose({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          }
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        pose.onResults(onResults);

        if (videoRef.current) {
          camera = new Camera(videoRef.current, {
            onFrame: async () => {
              try {
                if (videoRef.current) {
                  await pose.send({ image: videoRef.current });
                }
              } catch (error) {
                // Suppress MediaPipe frame processing errors
                if (error instanceof Error && 
                    (error.message.includes('SolutionWasm') || 
                     error.message.includes('deleted object') ||
                     error.message.includes('pointer'))) {
                  // Silently ignore these errors
                  return;
                }
                console.warn('Frame processing warning:', error);
              }
            },
            width: 640,
            height: 480
          });
          await camera.start();
          setFeedback('Position yourself in front of the camera');
        }
      } catch (error) {
        console.error('Error initializing MediaPipe:', error);
        setFeedback('Error starting camera. Please check permissions.');
      }
    };

    const calculateAngle = (a: any, b: any, c: any) => {
      const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs(radians * 180.0 / Math.PI);
      if (angle > 180.0) {
        angle = 360 - angle;
      }
      return angle;
    };

    const onResults = (results: any) => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        if (results.poseLandmarks) {
          drawPose(ctx, results.poseLandmarks);
          
          const exercise = currentExercise || defaultExercise;
          const bodyPart = getExerciseBodyPart(exercise);
          
          if (bodyPart === 'legs') {
            analyzeLegExercise(results.poseLandmarks);
          } else {
            analyzeArmExercise(results.poseLandmarks);
          }
        }
      } catch (error) {
        // Suppress MediaPipe cleanup errors that don't affect functionality
        if (error instanceof Error && 
            (error.message.includes('SolutionWasm') || 
             error.message.includes('deleted object') ||
             error.message.includes('pointer'))) {
          // Silently ignore these cleanup errors
          return;
        }
        console.warn('Non-critical MediaPipe error:', error);
      }
    };

    const drawPose = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const connections = [
        [11, 12], [11, 23], [12, 24], [23, 24],
        [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
        [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
        [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
        [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
      ];

      connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        if (startPoint && endPoint && startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
          if (start <= 10 || end <= 10) {
            ctx.strokeStyle = '#FFD700';
          } else if ((start >= 11 && start <= 16) || (end >= 11 && end <= 16)) {
            ctx.strokeStyle = '#00FF00';
          } else if ((start >= 17 && start <= 22) || (end >= 17 && end <= 22)) {
            ctx.strokeStyle = '#FF6B6B';
          } else if ((start >= 23 && start <= 28) || (end >= 23 && end <= 28)) {
            ctx.strokeStyle = '#4ECDC4';
          } else {
            ctx.strokeStyle = '#9B59B6';
          }
          
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }
      });

      landmarks.forEach((point, index) => {
        if (point && point.visibility > 0.5 && index > 10) {
          if (index >= 11 && index <= 16) {
            ctx.fillStyle = '#00FF00';
          } else if (index >= 17 && index <= 22) {
            ctx.fillStyle = '#FF6B6B';
          } else if (index >= 23 && index <= 28) {
            ctx.fillStyle = '#4ECDC4';
          } else {
            ctx.fillStyle = '#9B59B6';
          }
          
          ctx.beginPath();
          ctx.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            index >= 11 && index <= 16 || index >= 23 && index <= 28 ? 6 : 3,
            0,
            2 * Math.PI
          );
          ctx.fill();
        }
      });
    };

    const analyzeLegExercise = (landmarks: any[]) => {
      const exercise = currentExercise || defaultExercise;
      const detectedLegLocal = detectActiveLeg(landmarks);
      const primaryAngle = exercise.angleCalculations.primaryAngle;
      let adjustedPoints = [...primaryAngle.points];
      
      if (detectedLegLocal === 'right') {
        adjustedPoints = adjustedPoints.map(point => {
          if (point === 23) return 24;
          if (point === 25) return 26;
          if (point === 27) return 28;
          if (point === 11) return 12;
          return point;
        });
      }
      
      const point1 = landmarks[adjustedPoints[0]];
      const vertex = landmarks[adjustedPoints[1]];
      const point2 = landmarks[adjustedPoints[2]];

      if (point1 && vertex && point2) {
        if (detectedLegLocal !== detectedArm) {
          setDetectedArm(detectedLegLocal);
          console.log(`Leg detection updated: now tracking ${detectedLegLocal} leg`);
        }

        const angle = calculateAngle(point1, vertex, point2);
        setArmAngle(Math.round(angle));
        analyzeExerciseForm(angle, landmarks, exercise, detectedLegLocal);
      }
    };

    const detectActiveLeg = (landmarks: any[]): 'left' | 'right' => {
      const leftHip = landmarks[23];
      const leftKnee = landmarks[25];
      const leftAnkle = landmarks[27];
      const rightHip = landmarks[24];
      const rightKnee = landmarks[26];
      const rightAnkle = landmarks[28];
      
      if (!leftHip || !leftKnee || !leftAnkle || !rightHip || !rightKnee || !rightAnkle) {
        return detectedArm as 'left' | 'right';
      }
      
      const leftHipAngle = calculateAngle(landmarks[11], leftHip, leftKnee);
      const rightHipAngle = calculateAngle(landmarks[12], rightHip, rightKnee);
      
      const leftElevation = leftHip.y - leftAnkle.y;
      const rightElevation = rightHip.y - rightAnkle.y;
      
      const leftExtension = Math.abs(leftKnee.x - leftHip.x) + Math.abs(leftAnkle.x - leftKnee.x);
      const rightExtension = Math.abs(rightKnee.x - rightHip.x) + Math.abs(rightAnkle.x - rightKnee.x);
      
      const leftScore = leftElevation * 2 + leftExtension + Math.abs(leftHipAngle - 180);
      const rightScore = rightElevation * 2 + rightExtension + Math.abs(rightHipAngle - 180);
      
      const threshold = 0.3;
      if (rightScore > leftScore * (1 + threshold)) {
        return 'right';
      } else if (leftScore > rightScore * (1 + threshold)) {
        return 'left';
      }
      
      return detectedArm as 'left' | 'right';
    };
  
    const analyzeArmExercise = (landmarks: any[]) => {
      const exercise = currentExercise || defaultExercise;
      const detectedArmLocal = detectActiveArm(landmarks);
      const primaryAngle = exercise.angleCalculations.primaryAngle;
      let adjustedPoints = [...primaryAngle.points];
      
      if (detectedArmLocal === 'right') {
        adjustedPoints = adjustedPoints.map(point => {
          if (point === 11) return 12;
          if (point === 13) return 14;
          if (point === 15) return 16;
          if (point === 23) return 24;
          if (point === 25) return 26;
          return point;
        });
      }
      
      const point1 = landmarks[adjustedPoints[0]];
      const vertex = landmarks[adjustedPoints[1]];
      const point2 = landmarks[adjustedPoints[2]];

      if (point1 && vertex && point2) {
        if (detectedArmLocal !== detectedArm) {
          setDetectedArm(detectedArmLocal);
          console.log(`Arm detection updated: now tracking ${detectedArmLocal} arm`);
        }

        const angle = calculateAngle(point1, vertex, point2);
        setArmAngle(Math.round(angle));
        analyzeExerciseForm(angle, landmarks, exercise, detectedArmLocal);
      }
    };

    // FIXED: More aggressive arm detection
    const detectActiveArm = (landmarks: any[]): 'left' | 'right' => {
      const leftShoulder = landmarks[11];
      const leftElbow = landmarks[13];
      const leftWrist = landmarks[15];
      const rightShoulder = landmarks[12];
      const rightElbow = landmarks[14];
      const rightWrist = landmarks[16];
      
      if (!leftShoulder || !leftElbow || !leftWrist || !rightShoulder || !rightElbow || !rightWrist) {
        return detectedArm;
      }
      
      // Calculate more sensitive metrics
      const leftShoulderAngle = calculateAngle(landmarks[23] || landmarks[11], leftShoulder, leftElbow);
      const rightShoulderAngle = calculateAngle(landmarks[24] || landmarks[12], rightShoulder, rightElbow);
      
      // Distance from starting position (arm down)
      const leftArmHeight = leftShoulder.y - leftWrist.y;
      const rightArmHeight = rightShoulder.y - rightWrist.y;
      
      // Arm extension (how far from body)
      const leftArmExtension = Math.abs(leftWrist.x - leftShoulder.x);
      const rightArmExtension = Math.abs(rightWrist.x - rightShoulder.x);
      
      // Movement score - higher means more active
      const leftMovementScore = leftArmHeight * 3 + leftArmExtension * 2 + Math.abs(leftShoulderAngle - 20);
      const rightMovementScore = rightArmHeight * 3 + rightArmExtension * 2 + Math.abs(rightShoulderAngle - 20);
      
      console.log(`Arm scores - Left: ${leftMovementScore.toFixed(2)}, Right: ${rightMovementScore.toFixed(2)}`);
      
      // Much lower threshold for switching - switch if difference is more than 15%
      const switchThreshold = 0.15;
      const scoreDifference = Math.abs(leftMovementScore - rightMovementScore);
      const averageScore = (leftMovementScore + rightMovementScore) / 2;
      
      if (scoreDifference > averageScore * switchThreshold) {
        return rightMovementScore > leftMovementScore ? 'right' : 'left';
      }
      
      // If scores are close, stick with current detection
      return detectedArm;
    };

    const analyzeExerciseForm = (angle: number, landmarks: any[], exercise: ExerciseData, detectedArm: 'left' | 'right' = 'left') => {
      if (!exerciseStarted) {
        setFeedback('Click "Start Exercise" to begin tracking your movements');
        setIsCorrectForm(null);
        return;
      }
      
      let currentState = 'ready';
      let feedbackText = '';
      let formCorrect = null;

      const { liftingMin, loweringMax, restMax } = exercise.repThresholds;
      const { startingPosition, targetRange, optimalPeak } = exercise.targetRanges;
      
      const isLiftingExercise = exercise.exerciseName.toLowerCase().includes('abduction') || 
                               exercise.exerciseName.toLowerCase().includes('flexion') ||
                               exercise.exerciseName.toLowerCase().includes('raise') ||
                               exercise.exerciseName.toLowerCase().includes('extension');
      
      const isCurlingExercise = exercise.exerciseName.toLowerCase().includes('curl') ||
                                exercise.exerciseName.toLowerCase().includes('bicep');
      
      const isLegExercise = exercise.exerciseName.toLowerCase().includes('squat') ||
                           exercise.exerciseName.toLowerCase().includes('lunge') ||
                           exercise.exerciseName.toLowerCase().includes('hip') ||
                           exercise.exerciseName.toLowerCase().includes('leg');
      
      let actionVerb, actionVerbGerund, bodyPart;
      
      if (isLegExercise) {
        actionVerb = exercise.exerciseName.toLowerCase().includes('squat') ? 'squat' : 
                    exercise.exerciseName.toLowerCase().includes('lunge') ? 'lunge' : 'lift';
        actionVerbGerund = exercise.exerciseName.toLowerCase().includes('squat') ? 'squatting' : 
                          exercise.exerciseName.toLowerCase().includes('lunge') ? 'lunging' : 'lifting';
        bodyPart = 'leg';
      } else if (isCurlingExercise) {
        actionVerb = 'curl';
        actionVerbGerund = 'curling';
        bodyPart = 'forearm';
      } else {
        actionVerb = 'lift';
        actionVerbGerund = 'lifting';
        bodyPart = 'arm';
      }
      
      const currentTime = Date.now();
      let isInOptimalPeak = false;
      
      if (isLegExercise) {
        if (exercise.exerciseName.toLowerCase().includes('squat')) {
          isInOptimalPeak = angle >= optimalPeak[0] && angle <= optimalPeak[1];
        } else {
          isInOptimalPeak = angle >= optimalPeak[0] && angle <= optimalPeak[1];
        }
      } else {
        isInOptimalPeak = (isLiftingExercise && angle >= optimalPeak[0] && angle <= optimalPeak[1]) ||
                         (isCurlingExercise && angle >= optimalPeak[0] && angle <= optimalPeak[1]);
      }
      
      if (isInOptimalPeak && !hasReachedPeakRef.current && currentTime - lastRepTimeRef.current > 1000) {
        hasReachedPeakRef.current = true;
        lastRepTimeRef.current = currentTime;
        repCounterRef.current += 1;
        setRepCount(repCounterRef.current);
        console.log(`Rep counted! Total: ${repCounterRef.current}`);
      }
      
      let isInStartingPosition = false;
      
      if (isLegExercise) {
        isInStartingPosition = angle <= startingPosition[1] || angle >= startingPosition[0];
      } else {
        isInStartingPosition = (isLiftingExercise && angle <= startingPosition[1]) ||
                              (isCurlingExercise && angle >= startingPosition[0]);
      }
      
      if (isInStartingPosition && hasReachedPeakRef.current) {
        hasReachedPeakRef.current = false;
      }

      if (isInOptimalPeak) {
        feedbackText = `✅ Excellent! Rep ${repCounterRef.current} completed - Full range achieved`;
        formCorrect = true;
        currentState = actionVerbGerund;
      } else if (isLegExercise) {
        if (exercise.exerciseName.toLowerCase().includes('squat') && angle < optimalPeak[0]) {
          feedbackText = `📈 Go deeper! Squat down more to reach full range`;
          formCorrect = true;
          currentState = actionVerbGerund;
        } else if (angle > liftingMin) {
          feedbackText = `📈 Keep going! ${actionVerbGerund === 'squatting' ? 'Go deeper' : 'Continue movement'}`;
          formCorrect = true;
          currentState = actionVerbGerund;
        } else {
          feedbackText = `🏁 Ready position. Begin ${exercise.exerciseName.toLowerCase()}`;
          formCorrect = true;
          currentState = 'ready';
        }
      } else if ((isLiftingExercise && angle > liftingMin) || (isCurlingExercise && angle < liftingMin)) {
        feedbackText = `📈 Keep going! ${isLiftingExercise ? 'Raise' : 'Curl'} your ${bodyPart} ${isLiftingExercise ? 'higher' : 'more'}`;
        formCorrect = true;
        currentState = actionVerbGerund;
      } else if (isInStartingPosition) {
        feedbackText = `🏁 Ready position. Begin ${exercise.exerciseName.toLowerCase()}`;
        formCorrect = true;
        currentState = 'ready';
      } else {
        feedbackText = '📈 Start your movement';
        formCorrect = true;
        currentState = 'ready';
      }

      // Form checks with adjusted landmarks
      exercise.formChecks.forEach(check => {
        const adjustedKeypoints = check.keypoints.map(idx => {
          if (detectedArm === 'right') {
            if (idx === 11) return 12;
            if (idx === 13) return 14;
            if (idx === 15) return 16;
            if (idx === 23) return 24;
            if (idx === 25) return 26;
            if (idx === 27) return 28;
          }
          return idx;
        });
        
        const keypoints = adjustedKeypoints.map(idx => landmarks[idx]).filter(Boolean);
        if (keypoints.length >= 2) {
          if (check.condition.includes('wrist higher than shoulder') && currentState === actionVerbGerund) {
            const shoulder = landmarks[detectedArm === 'left' ? 11 : 12];
            const wrist = landmarks[detectedArm === 'left' ? 15 : 16];
            if (shoulder && wrist && wrist.y < shoulder.y - 0.1) {
              feedbackText = `⚠️ ${check.errorMessage}`;
              formCorrect = false;
            }
          } else if (check.condition.includes('elbow below shoulder') && currentState === actionVerbGerund) {
            const shoulder = landmarks[detectedArm === 'left' ? 11 : 12];
            const elbow = landmarks[detectedArm === 'left' ? 13 : 14];
            if (shoulder && elbow && elbow.y > shoulder.y + 0.05) {
              feedbackText = `⚠️ ${check.errorMessage}`;
              formCorrect = false;
            }
          }
          else if (check.condition.includes('knee alignment') && currentState === actionVerbGerund) {
            const hip = landmarks[detectedArm === 'left' ? 23 : 24];
            const knee = landmarks[detectedArm === 'left' ? 25 : 26];
            const ankle = landmarks[detectedArm === 'left' ? 27 : 28];
            if (hip && knee && ankle) {
              const kneeAnkleDistance = Math.abs(knee.x - ankle.x);
              if (kneeAnkleDistance > 0.1) {
                feedbackText = `⚠️ ${check.errorMessage}`;
                formCorrect = false;
              }
            }
          }
          else if (check.condition.includes('back straight') && currentState === actionVerbGerund) {
            const shoulder = landmarks[detectedArm === 'left' ? 11 : 12];
            const hip = landmarks[detectedArm === 'left' ? 23 : 24];
            if (shoulder && hip) {
              const torsoAngle = Math.abs(shoulder.x - hip.x);
              if (torsoAngle > 0.15) {
                feedbackText = `⚠️ ${check.errorMessage}`;
                formCorrect = false;
              }
            }
          }
          else if (check.condition.includes('Elbow moving off thigh') && currentState === actionVerbGerund) {
            feedbackText = `⚠️ ${check.errorMessage}`;
            formCorrect = false;
          }
        }
      });

      if (currentState !== lastStateRef.current) {
        setExerciseState(currentState);
        lastStateRef.current = currentState;
      }

      setFeedback(feedbackText);
      setIsCorrectForm(formCorrect);
    };

    initializeMediaPipe();

    return () => {
      try {
        if (camera) {
          camera.stop();
        }
      } catch (error) {
        // Suppress camera cleanup errors
        if (error instanceof Error && 
            (error.message.includes('SolutionWasm') || 
             error.message.includes('deleted object') ||
             error.message.includes('pointer'))) {
          // Silently ignore cleanup errors
        } else {
          console.warn('Camera cleanup warning:', error);
        }
      }
      
      try {
        if (pose) {
          pose.close();
        }
      } catch (error) {
        // Suppress pose cleanup errors  
        if (error instanceof Error && 
            (error.message.includes('SolutionWasm') || 
             error.message.includes('deleted object') ||
             error.message.includes('pointer'))) {
          // Silently ignore cleanup errors
        } else {
          console.warn('Pose cleanup warning:', error);
        }
      }
    };
  }, [isMediaPipeLoaded, currentExercise, exerciseStarted]);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
        onLoad={() => {
          setScriptsLoaded(prev => ({ ...prev, camera: true }));
        }}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"
        onLoad={() => {
          setScriptsLoaded(prev => ({ ...prev, pose: true }));
        }}
      />

      {showProfileForm && (
        <UserProfileForm
          onExerciseGenerated={handleExerciseGenerated}
          onClose={() => setShowProfileForm(false)}
        />
      )}
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              AI Physiotherapy Coach
            </h1>
            <p className="text-gray-600">
              {currentExercise ? currentExercise.exerciseName : 'Shoulder Abduction Exercise'} - Real-time Form Analysis
            </p>
            
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => setShowProfileForm(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Personalized Exercise
              </button>
              {currentExercise && (
                <button
                  onClick={() => {
                    setCurrentExercise(null);
                    setRepCount(0);
                    repCounterRef.current = 0;
                    hasReachedPeakRef.current = false;
                    lastStateRef.current = 'ready';
                    setExerciseStarted(false);
                    setFeedback('Position yourself in front of the camera');
                  }}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Use Default Exercise
                </button>
              )}
              <button
                onClick={handleStartExercise}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  exerciseStarted 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {exerciseStarted ? 'Stop Exercise' : 'Start Exercise'}
              </button>
              <button
                onClick={() => setShowDemo(!showDemo)}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {showDemo ? 'Hide Demo' : 'Show Demo'}
              </button>
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="hidden"
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="w-full h-auto"
                />
                
                <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded">
                  {(() => {
                    const exercise = currentExercise || defaultExercise;
                    const bodyPart = getExerciseBodyPart(exercise);
                    const angleName = exercise.angleCalculations.primaryAngle.name;
                    return `${angleName}: ${armAngle}°`;
                  })()}
                </div>
                
                <div className="absolute top-4 right-4 bg-blue-600 bg-opacity-90 text-white px-4 py-2 rounded">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{repCount}</div>
                    <div className="text-xs">REPS</div>
                  </div>
                </div>

                {/* Active limb indicator */}
                <div className="absolute bottom-4 left-4 bg-green-600 bg-opacity-90 text-white px-3 py-1 rounded">
                  <div className="text-sm font-medium">
                    Tracking: {detectedArm.charAt(0).toUpperCase() + detectedArm.slice(1)} {getExerciseBodyPart(currentExercise || defaultExercise) === 'legs' ? 'Leg' : 'Arm'}
                  </div>
                </div>
              </div>
            </div>

            {/* YouTube Demo */}
            {showDemo && (
              <div className="mt-6">
                <YouTubeDemo 
                  exerciseName={currentExercise?.exerciseName || defaultExercise.exerciseName}
                  isVisible={showDemo}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                Real-time Feedback
              </h3>
              <div className={`p-4 rounded-lg ${
                isCorrectForm === true ? 'bg-green-50 border border-green-200' :
                isCorrectForm === false ? 'bg-red-50 border border-red-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                <p className="text-sm font-medium text-gray-800">
                  {feedback}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                Exercise Progress
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Repetitions:</span>
                  <span className="text-2xl font-bold text-blue-600">{repCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Current Phase:</span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    exerciseState === 'lifting' || exerciseState === 'curling' ? 'bg-green-100 text-green-800' :
                    exerciseState === 'lowering' ? 'bg-yellow-100 text-yellow-800' :
                    exerciseState === 'rest' ? 'bg-purple-100 text-purple-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {exerciseState.charAt(0).toUpperCase() + exerciseState.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Limb:</span>
                  <span className="text-sm font-medium text-gray-800 capitalize">
                    {(() => {
                      const exercise = currentExercise || defaultExercise;
                      const bodyPart = getExerciseBodyPart(exercise);
                      return `${detectedArm} ${bodyPart === 'legs' ? 'leg' : 'arm'}`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                Instructions
              </h3>
              {currentExercise && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">
                    {currentExercise.description}
                  </p>
                </div>
              )}
              <div className="space-y-2 text-sm text-gray-600">
                {(currentExercise?.steps || defaultExercise.steps).map((step, index) => (
                  <p key={index}>{index + 1}. {step}</p>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                Target Ranges
              </h3>
              <div className="space-y-2 text-sm">
                {(() => {
                  const ranges = currentExercise?.targetRanges || defaultExercise.targetRanges;
                  return (
                    <>
                      <div className="flex justify-between">
                        <span>Starting Position:</span>
                        <span className="text-blue-600">{ranges.startingPosition[0]}-{ranges.startingPosition[1]}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Target Range:</span>
                        <span className="text-green-600">{ranges.targetRange[0]}-{ranges.targetRange[1]}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Optimal Peak:</span>
                        <span className="text-purple-600">{ranges.optimalPeak[0]}-{ranges.optimalPeak[1]}°</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-lg p-4">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">
              <strong>Pro Tips:</strong> Keep your core engaged, avoid shrugging your shoulders, 
              and maintain a slow, controlled movement throughout the exercise. Reach the optimal peak angle to count a rep!
            </p>
            <p className="text-xs text-gray-500">
              Note: This is for demonstration purposes only. Consult a licensed physiotherapist for proper exercise guidance.
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}