"use client";
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

// Declare MediaPipe global types
declare global {
  interface Window {
    Pose: any;
    Camera: any;
  }
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

  // Set MediaPipe as loaded when both scripts are loaded
  useEffect(() => {
    if (scriptsLoaded.camera && scriptsLoaded.pose && window.Camera && window.Pose) {
      setIsMediaPipeLoaded(true);
    }
  }, [scriptsLoaded]);

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
          locateFile: (file) => {
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

    const calculateAngle = (a, b, c) => {
      const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs(radians * 180.0 / Math.PI);
      if (angle > 180.0) {
        angle = 360 - angle;
      }
      return angle;
    };

    const onResults = (results) => {
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
      
      // Draw pose connections
      const connections = [
        [11, 12], // shoulders
        [11, 13], // left shoulder to elbow
        [13, 15], // left elbow to wrist
        [12, 14], // right shoulder to elbow
        [14, 16], // right elbow to wrist
        [11, 23], // left shoulder to hip
        [12, 24], // right shoulder to hip
      ];

      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      
      connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        if (startPoint && endPoint) {
          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw key points
      const keyPoints = [11, 12, 13, 14, 15, 16]; // shoulders, elbows, wrists
      ctx.fillStyle = '#ff0000';
      
      keyPoints.forEach(pointIndex => {
        const point = landmarks[pointIndex];
        if (point) {
          ctx.beginPath();
          ctx.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            5,
            0,
            2 * Math.PI
          );
          ctx.fill();
        }
      });
    };

    const analyzeShoulderAbduction = (landmarks: any[]) => {
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftElbow = landmarks[13];
      const rightElbow = landmarks[14];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];

      if (leftShoulder && leftElbow && leftWrist && leftHip) {
        // Calculate left arm angle (shoulder abduction)
        const angle = calculateAngle(leftHip, leftShoulder, leftElbow);
        setArmAngle(Math.round(angle));

        // Analyze exercise form and provide feedback
        analyzeExerciseForm(angle, leftShoulder, leftElbow, leftWrist, leftHip);
      }
    };

    let lastState = 'ready';
    let repCounter = 0;

    const analyzeExerciseForm = (angle: number, shoulder: any, elbow: any, wrist: any, hip: any) => {
      // Determine exercise phase based on arm angle
      let currentState = 'ready';
      let feedbackText = '';
      let formCorrect = null;

      if (angle > 150) {
        currentState = 'lifting';
        if (angle >= 170) {
          feedbackText = '✅ Excellent! Full range of motion achieved';
          formCorrect = true;
        } else {
          feedbackText = '⚠️ Good! Try to lift a bit higher for full range';
          formCorrect = true;
        }
      } else if (angle > 120) {
        currentState = 'lifting';
        feedbackText = '📈 Keep lifting! Raise your arm higher';
        formCorrect = true;
      } else if (angle > 90 && lastState === 'lifting') {
        currentState = 'lowering';
        feedbackText = '📉 Good control! Lower slowly and steadily';
        formCorrect = true;
      } else if (angle <= 90 && angle > 45) {
        if (lastState === 'lowering') {
          currentState = 'lowering';
          feedbackText = '👍 Nearly complete! Continue lowering slowly';
          formCorrect = true;
        } else {
          currentState = 'lifting';
          feedbackText = '📈 Start lifting! Raise your arm to the side';
          formCorrect = true;
        }
      } else if (angle <= 45) {
        currentState = 'ready';
        if (lastState === 'lowering') {
          repCounter++;
          setRepCount(repCounter);
          feedbackText = `🎉 Rep ${repCounter} completed! Rest and repeat`;
        } else {
          feedbackText = '🏁 Ready to start! Lift your arm out to the side';
        }
        formCorrect = true;
      }

      // Check for common form errors
      const elbowY = elbow.y;
      const wristY = wrist.y;
      const shoulderY = shoulder.y;

      if (currentState === 'lifting' && wristY < shoulderY - 0.1) {
        feedbackText = '⚠️ Keep your arm horizontal, don\'t lift too high';
        formCorrect = false;
      } else if (currentState === 'lifting' && elbowY > shoulderY + 0.05) {
        feedbackText = '⚠️ Keep your elbow level with your shoulder';
        formCorrect = false;
      }

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
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              AI Physiotherapy Coach
            </h1>
            <p className="text-gray-600">
              Shoulder Abduction Exercise - Real-time Form Analysis
            </p>
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
                  Arm Angle: {armAngle}°
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
              <div className="space-y-2 text-sm text-gray-600">
                <p>1. Stand facing the camera</p>
                <p>2. Keep your arm straight</p>
                <p>3. Slowly lift your arm to the side</p>
                <p>4. Raise until horizontal (90°)</p>
                <p>5. Lower slowly and controlled</p>
                <p>6. Repeat for desired reps</p>
              </div>
            </div>

            {/* Target Ranges */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                Target Ranges
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Starting Position:</span>
                  <span className="text-blue-600">0-45°</span>
                </div>
                <div className="flex justify-between">
                  <span>Target Range:</span>
                  <span className="text-green-600">90-180°</span>
                </div>
                <div className="flex justify-between">
                  <span>Optimal Peak:</span>
                  <span className="text-purple-600">170-180°</span>
                </div>
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