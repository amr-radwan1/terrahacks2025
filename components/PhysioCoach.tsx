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

export default function PhysiotherapyCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [feedback, setFeedback] = useState('Loading MediaPipe...');
  const [exerciseState, setExerciseState] = useState('ready'); // ready, lifting, lowering, rest
  const [repCount, setRepCount] = useState(0);
  const [armAngle, setArmAngle] = useState(0);
  const [isCorrectForm, setIsCorrectForm] = useState<boolean | null>(null);
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState({ camera: false, pose: false });
  
  // New state for dynamic exercise system
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<ExerciseData | null>(null);
  const [isExerciseActive, setIsExerciseActive] = useState(false);

  // Set MediaPipe as loaded when both scripts are loaded
  useEffect(() => {
    if (scriptsLoaded.camera && scriptsLoaded.pose && window.Camera && window.Pose) {
      setIsMediaPipeLoaded(true);
    }
  }, [scriptsLoaded]);

  // Handler for exercise generation
  const handleExerciseGenerated = (exerciseData: ExerciseData) => {
    setCurrentExercise(exerciseData);
    setIsExerciseActive(true);
    setRepCount(0); // Reset rep count for new exercise
    setFeedback(`Exercise loaded: ${exerciseData.exerciseName}. Position yourself in front of the camera.`);
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
      optimalPeak: [170, 180]
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
      liftingMin: 120,
      loweringMax: 90,
      restMax: 45
    }
  };

  useEffect(() => {
    if (!isMediaPipeLoaded) return;

    let pose: any = null;
    let camera: any = null;

    const initializeMediaPipe = async () => {
      try {
        // Access MediaPipe from global window object
        const { Pose } = window;
        const { Camera } = window;

        if (!Pose || !Camera) {
          setFeedback('MediaPipe not loaded properly. Please refresh the page.');
          return;
        }

        // Initialize MediaPipe Pose
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

        // Initialize camera
        if (videoRef.current) {
          camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current) {
                await pose.send({ image: videoRef.current });
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
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw video frame
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawPose(ctx, results.poseLandmarks);
        analyzeShoulderAbduction(results.poseLandmarks);
      }
    };

    const drawPose = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Complete MediaPipe pose connections for full skeleton
      const connections = [
        // Face connections
        // [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
        // [9, 10],
        
        // Torso connections
        [11, 12], // shoulders
        [11, 23], // left shoulder to left hip
        [12, 24], // right shoulder to right hip
        [23, 24], // hips
        
        // Left arm connections
        [11, 13], // left shoulder to left elbow
        [13, 15], // left elbow to left wrist
        [15, 17], // left wrist to left pinky
        [15, 19], // left wrist to left index
        [15, 21], // left wrist to left thumb
        [17, 19], // left pinky to left index
        
        // Right arm connections
        [12, 14], // right shoulder to right elbow
        [14, 16], // right elbow to right wrist
        [16, 18], // right wrist to right pinky
        [16, 20], // right wrist to right index
        [16, 22], // right wrist to right thumb
        [18, 20], // right pinky to right index
        
        // Left leg connections
        [23, 25], // left hip to left knee
        [25, 27], // left knee to left ankle
        [27, 29], // left ankle to left heel
        [27, 31], // left ankle to left foot index
        [29, 31], // left heel to left foot index
        
        // Right leg connections
        [24, 26], // right hip to right knee
        [26, 28], // right knee to right ankle
        [28, 30], // right ankle to right heel
        [28, 32], // right ankle to right foot index
        [30, 32], // right heel to right foot index
      ];

      // Draw connections with different colors for different body parts
      connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        if (startPoint && endPoint && startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
          // Set different colors for different body parts
          if (start <= 10 || end <= 10) {
            ctx.strokeStyle = '#FFD700'; // Gold for face
          } else if ((start >= 11 && start <= 16) || (end >= 11 && end <= 16)) {
            ctx.strokeStyle = '#00FF00'; // Green for arms
          } else if ((start >= 17 && start <= 22) || (end >= 17 && end <= 22)) {
            ctx.strokeStyle = '#FF6B6B'; // Red for hands
          } else if ((start >= 23 && start <= 28) || (end >= 23 && end <= 28)) {
            ctx.strokeStyle = '#4ECDC4'; // Teal for legs
          } else {
            ctx.strokeStyle = '#9B59B6'; // Purple for feet
          }
          
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw landmark points (excluding face landmarks 0-10)
      landmarks.forEach((point, index) => {
        if (point && point.visibility > 0.5 && index > 10) { // Skip face landmarks (0-10)
          // Set different colors for different landmark groups
          if (index >= 11 && index <= 16) {
            ctx.fillStyle = '#00FF00'; // Green for major joints (shoulders, elbows, wrists)
          } else if (index >= 17 && index <= 22) {
            ctx.fillStyle = '#FF6B6B'; // Red for hand landmarks
          } else if (index >= 23 && index <= 28) {
            ctx.fillStyle = '#4ECDC4'; // Teal for major leg joints
          } else {
            ctx.fillStyle = '#9B59B6'; // Purple for foot landmarks
          }
          
          ctx.beginPath();
          ctx.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            index >= 11 && index <= 16 || index >= 23 && index <= 28 ? 6 : 3, // Larger circles for major joints
            0,
            2 * Math.PI
          );
          ctx.fill();
          
          // Add landmark numbers for debugging (optional)
          // if (index >= 11 && index <= 16) { // Only show numbers for key points
          //   ctx.fillStyle = '#FFFFFF';
          //   ctx.font = '12px Arial';
          //   ctx.textAlign = 'center';
          //   ctx.fillText(
          //     index.toString(),
          //     point.x * canvas.width,
          //     point.y * canvas.height - 10
          //   );
          // }
        }
      });
    };

    const analyzeShoulderAbduction = (landmarks: any[]) => {
      const exercise = currentExercise || defaultExercise;
      
      // Get landmarks based on exercise configuration
      const primaryAngle = exercise.angleCalculations.primaryAngle;
      const point1 = landmarks[primaryAngle.points[0]];
      const vertex = landmarks[primaryAngle.points[1]];
      const point2 = landmarks[primaryAngle.points[2]];

      if (point1 && vertex && point2) {
        // Calculate primary angle
        const angle = calculateAngle(point1, vertex, point2);
        setArmAngle(Math.round(angle));

        // Analyze exercise form using dynamic configuration
        analyzeExerciseForm(angle, landmarks, exercise);
      }
    };

    let lastState = 'ready';
    let repCounter = 0;

    const analyzeExerciseForm = (angle: number, landmarks: any[], exercise: ExerciseData) => {
      // Determine exercise phase based on dynamic thresholds
      let currentState = 'ready';
      let feedbackText = '';
      let formCorrect = null;

      const { liftingMin, loweringMax, restMax } = exercise.repThresholds;
      const { startingPosition, targetRange, optimalPeak } = exercise.targetRanges;

      if (angle > liftingMin + 30) {
        currentState = 'lifting';
        if (angle >= optimalPeak[0]) {
          feedbackText = '✅ Excellent! Full range of motion achieved';
          formCorrect = true;
        } else {
          feedbackText = '⚠️ Good! Try to lift a bit higher for full range';
          formCorrect = true;
        }
      } else if (angle > liftingMin) {
        currentState = 'lifting';
        feedbackText = '📈 Keep lifting! Raise your arm higher';
        formCorrect = true;
      } else if (angle > loweringMax && lastState === 'lifting') {
        currentState = 'lowering';
        feedbackText = '📉 Good control! Lower slowly and steadily';
        formCorrect = true;
      } else if (angle <= loweringMax && angle > restMax) {
        if (lastState === 'lowering') {
          currentState = 'lowering';
          feedbackText = '👍 Nearly complete! Continue lowering slowly';
          formCorrect = true;
        } else {
          currentState = 'lifting';
          feedbackText = '📈 Start lifting! Begin the exercise movement';
          formCorrect = true;
        }
      } else if (angle <= restMax) {
        currentState = 'ready';
        if (lastState === 'lowering') {
          repCounter++;
          setRepCount(repCounter);
          feedbackText = `🎉 Rep ${repCounter} completed! Rest and repeat`;
        } else {
          feedbackText = `🏁 Ready to start! Begin ${exercise.exerciseName.toLowerCase()}`;
        }
        formCorrect = true;
      }

      // Check for form errors using dynamic form checks
      exercise.formChecks.forEach(check => {
        const keypoints = check.keypoints.map(idx => landmarks[idx]).filter(Boolean);
        if (keypoints.length >= 2) {
          // Simple form check based on keypoint positions
          if (check.condition.includes('wrist higher than shoulder') && currentState === 'lifting') {
            const shoulder = landmarks[11] || landmarks[12];
            const wrist = landmarks[15] || landmarks[16];
            if (shoulder && wrist && wrist.y < shoulder.y - 0.1) {
              feedbackText = `⚠️ ${check.errorMessage}`;
              formCorrect = false;
            }
          } else if (check.condition.includes('elbow below shoulder') && currentState === 'lifting') {
            const shoulder = landmarks[11] || landmarks[12];
            const elbow = landmarks[13] || landmarks[14];
            if (shoulder && elbow && elbow.y > shoulder.y + 0.05) {
              feedbackText = `⚠️ ${check.errorMessage}`;
              formCorrect = false;
            }
          }
        }
      });

      // Update state only if it changed
      if (currentState !== lastState) {
        setExerciseState(currentState);
        lastState = currentState;
      }

      setFeedback(feedbackText);
      setIsCorrectForm(formCorrect);
    };

    initializeMediaPipe();

    return () => {
      if (camera) {
        camera.stop();
      }
      if (pose) {
        pose.close();
      }
    };
  }, [isMediaPipeLoaded]);

  return (
    <>
      {/* Load MediaPipe scripts */}
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

      {/* User Profile Form Modal */}
      {showProfileForm && (
        <UserProfileForm
          onExerciseGenerated={handleExerciseGenerated}
          onClose={() => setShowProfileForm(false)}
        />
      )}
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              AI Physiotherapy Coach
            </h1>
            <p className="text-gray-600">
              {currentExercise ? currentExercise.exerciseName : 'Shoulder Abduction Exercise'} - Real-time Form Analysis
            </p>
            
            {/* Control Buttons */}
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
                    setFeedback('Position yourself in front of the camera');
                  }}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Use Default Exercise
                </button>
              )}
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed */}
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
                
                {/* Overlay with angle indicator */}
                <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded">
                  {currentExercise ? currentExercise.angleCalculations.primaryAngle.name : 'Arm Angle'}: {armAngle}°
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Panel */}
          <div className="space-y-4">
            {/* Current Feedback */}
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

            {/* Exercise Stats */}
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
                    exerciseState === 'lifting' ? 'bg-green-100 text-green-800' :
                    exerciseState === 'lowering' ? 'bg-yellow-100 text-yellow-800' :
                    exerciseState === 'rest' ? 'bg-purple-100 text-purple-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {exerciseState.charAt(0).toUpperCase() + exerciseState.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Exercise Instructions */}
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

            {/* Target Ranges */}
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

        {/* Footer with tips */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-4">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">
              <strong>Pro Tips:</strong> Keep your core engaged, avoid shrugging your shoulders, 
              and maintain a slow, controlled movement throughout the exercise.
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