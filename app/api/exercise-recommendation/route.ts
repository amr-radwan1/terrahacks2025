import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Exercise-specific templates for better pose analysis
const exerciseTemplates = {
  shoulderAbduction: {
    anglePoints: [23, 11, 13], // Hip → Shoulder → Elbow
    targetRanges: { startingPosition: [0, 45], targetRange: [90, 180], optimalPeak: [160, 180] },
    repThresholds: { liftingMin: 90, loweringMax: 60, restMax: 30 }
  },
  shoulderFlexion: {
    anglePoints: [23, 11, 13], // Hip → Shoulder → Elbow (forward raise)
    targetRanges: { startingPosition: [0, 30], targetRange: [90, 180], optimalPeak: [160, 180] },
    repThresholds: { liftingMin: 90, loweringMax: 60, restMax: 30 }
  },
  pendulum: {
    anglePoints: [11, 13, 15], // Shoulder → Elbow → Wrist (arm swing)
    targetRanges: { startingPosition: [160, 180], targetRange: [90, 160], optimalPeak: [90, 120] },
    repThresholds: { liftingMin: 140, loweringMax: 160, restMax: 175 }
  },
  armCurl: {
    anglePoints: [11, 13, 15], // Shoulder → Elbow → Wrist (elbow flexion)
    targetRanges: { startingPosition: [160, 180], targetRange: [30, 90], optimalPeak: [30, 60] },
    repThresholds: { liftingMin: 120, loweringMax: 150, restMax: 170 }
  },
  legRaise: {
    anglePoints: [12, 24, 26], // Shoulder → Hip → Knee (leg lift)
    targetRanges: { startingPosition: [160, 180], targetRange: [90, 160], optimalPeak: [90, 120] },
    repThresholds: { liftingMin: 140, loweringMax: 160, restMax: 175 }
  }
};

// Validation function for exercise data
function validateAndCorrectExercise(exerciseData: any): ExerciseResponse {
  // Detect exercise type from name
  const exerciseName = exerciseData.exerciseName.toLowerCase();
  let template = null;
  
  if (exerciseName.includes('abduction') || exerciseName.includes('side')) {
    template = exerciseTemplates.shoulderAbduction;
  } else if (exerciseName.includes('flexion') || exerciseName.includes('forward')) {
    template = exerciseTemplates.shoulderFlexion;
  } else if (exerciseName.includes('pendulum') || exerciseName.includes('swing')) {
    template = exerciseTemplates.pendulum;
  } else if (exerciseName.includes('curl') || exerciseName.includes('bicep') || exerciseName.includes('biceps')) {
    template = exerciseTemplates.armCurl;
  } else if (exerciseName.includes('leg') && exerciseName.includes('raise')) {
    template = exerciseTemplates.legRaise;
  }
  
  // Apply template corrections if found
  if (template) {
    console.log(`Applying template corrections for exercise type: ${exerciseName}`);
    exerciseData.angleCalculations.primaryAngle.points = template.anglePoints;
    exerciseData.targetRanges = template.targetRanges;
    exerciseData.repThresholds = template.repThresholds;
  }
  
  // Validate rep thresholds are in correct order
  const { liftingMin, loweringMax, restMax } = exerciseData.repThresholds;
  if (liftingMin >= loweringMax || loweringMax >= restMax) {
    console.log('Correcting invalid rep thresholds');
    exerciseData.repThresholds = {
      liftingMin: Math.min(liftingMin, loweringMax, restMax),
      loweringMax: Math.max(Math.min(liftingMin, loweringMax), Math.min(loweringMax, restMax)),
      restMax: Math.max(liftingMin, loweringMax, restMax)
    };
  }
  
  return exerciseData;
}

interface UserProfile {
  height: number; // in cm
  weight: number; // in kg
  age: number;
  gender: 'male' | 'female' | 'other';
  painLocation: string;
  painLevel: number; // 1-10 scale
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  medicalHistory?: string;
  currentLimitations?: string;
}

interface ExerciseResponse {
  exerciseName: string;
  description: string;
  steps: string[];
  targetKeypoints: number[];
  angleCalculations: {
    primaryAngle: {
      points: [number, number, number]; // [point1, vertex, point2]
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

export async function POST(request: NextRequest) {
  try {
    const userProfile: UserProfile = await request.json();

    const prompt = `
You are an expert physiotherapist AI. Based on the user profile provided, recommend a SIMPLE and STRAIGHTFORWARD physiotherapy exercise with BRIEF instructions.

IMPORTANT: Keep instructions simple, clear, and not complex. Use 3-5 short steps maximum.

Don't suggest anything that requires depth such as arm swings forward and backward, because only x and y values are available. Something like
bicep curl is fine.

CRITICAL - ANGLE CALCULATION SYSTEM:
Our pose analysis system calculates angles using 3 points: Point1 → Vertex → Point2
The angle is measured at the VERTEX (middle point) between the two lines formed.

HOW ANGLES ARE CALCULATED:
- We use the formula: angle = arctan2(Point2.y - Vertex.y, Point2.x - Vertex.x) - arctan2(Point1.y - Vertex.y, Point1.x - Vertex.x)
- Result is converted to degrees (0-180°)
- For arm exercises, we automatically detect which arm is being used (left/right)

EXERCISE TYPE → ANGLE POINTS MAPPING:
1. ARM LIFTING (shoulder abduction/flexion): 
   - Points: [hip, shoulder, elbow] → [23, 11, 13] (left) or [24, 12, 14] (right)
   - Measures: Hip-to-shoulder-to-elbow angle
   - 0° = arm down, 90° = arm horizontal, 180° = arm up

2. ARM SWINGING (pendulum exercises):
   - Points: [shoulder, elbow, wrist] → [11, 13, 15] (left) or [12, 14, 16] (right)
   - Measures: Shoulder-to-elbow-to-wrist angle
   - 180° = straight arm, 90° = bent arm

3. LEG EXERCISES:
   - Points: [hip, knee, ankle] → [23, 25, 27] (left) or [24, 26, 28] (right)
   - Measures: Hip-to-knee-to-ankle angle

ANGLE RANGES LOGIC:
- startingPosition: The angle range when at rest/neutral position
- targetRange: The full range of motion during exercise
- optimalPeak: The ideal angle range for best exercise execution
- repThresholds: Motion phase detection thresholds
  * liftingMin: Minimum angle to detect lifting phase
  * loweringMax: Maximum angle to detect lowering phase  
  * restMax: Maximum angle considered at rest

User Profile:
- Height: ${userProfile.height}cm
- Weight: ${userProfile.weight}kg  
- Age: ${userProfile.age}
- Gender: ${userProfile.gender}
- Pain Location: ${userProfile.painLocation}
- Pain Level (1-10): ${userProfile.painLevel}
- Fitness Level: ${userProfile.fitnessLevel}
- Medical History: ${userProfile.medicalHistory || 'None provided'}
- Current Limitations: ${userProfile.currentLimitations || 'None provided'}

Please provide a response in the following EXACT JSON format (respond ONLY with valid JSON, no markdown formatting, no additional text or explanations):

{
  "exerciseName": "Simple Exercise Name",
  "description": "Brief one-sentence description of why this exercise helps",
  "steps": [
    "Step 1: Short, clear instruction",
    "Step 2: Short, clear instruction", 
    "Step 3: Short, clear instruction"
  ],
  "targetKeypoints": [11, 13, 15, 23],
  "angleCalculations": {
    "primaryAngle": {
      "points": [23, 11, 13],
      "name": "Primary Movement Angle"
    }
  },
  "targetRanges": {
    "startingPosition": [0, 45],
    "targetRange": [90, 180],
    "optimalPeak": [160, 180]
  },
  "formChecks": [
    {
      "condition": "simple form error description",
      "errorMessage": "Brief correction message",
      "keypoints": [11, 15]
    }
  ],
  "repThresholds": {
    "liftingMin": 90,
    "loweringMax": 60,
    "restMax": 30
  }
}

EXAMPLES OF CORRECT ANGLE CALCULATIONS:

1. SHOULDER ABDUCTION (lifting arm to the side):
   - points=[23, 11, 13] (Hip → Left Shoulder → Left Elbow)
   - startingPosition=[0,45] (arm down/resting)
   - targetRange=[90,180] (arm horizontal to up)
   - optimalPeak=[160,180] (nearly straight up)
   - repThresholds: liftingMin=90, loweringMax=60, restMax=30

2. PENDULUM SWING (gentle arm swing):
   - points=[11, 13, 15] (Shoulder → Elbow → Wrist)  
   - startingPosition=[160,180] (straight hanging arm)
   - targetRange=[90,160] (swinging range)
   - optimalPeak=[90,120] (max swing angle)
   - repThresholds: liftingMin=140, loweringMax=160, restMax=175

3. FORWARD ARM RAISE (shoulder flexion):
   - points=[23, 11, 13] (Hip → Shoulder → Elbow)
   - startingPosition=[0,30] (arm at side)
   - targetRange=[90,180] (horizontal to up)
   - optimalPeak=[160,180] (nearly overhead)
   - repThresholds: liftingMin=90, loweringMax=60, rest=30

DETECTION SYSTEM: Our system automatically detects which arm (left/right) is being used based on movement and adjusts the landmark indices accordingly.

MediaPipe Pose Landmark Reference:
0-10: Face landmarks
11: Left shoulder, 12: Right shoulder
13: Left elbow, 14: Right elbow  
15: Left wrist, 16: Right wrist
17-22: Hand landmarks
23: Left hip, 24: Right hip
25: Left knee, 26: Right knee
27: Left ankle, 28: Right ankle
29-32: Foot landmarks

Consider the user's pain location and limitations when selecting keypoints and angle calculations. Focus on therapeutic exercises that address their specific condition while being safe for their fitness level.
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Raw Gemini response:', text); // Debug logging

    // Clean and parse the JSON response
    let exerciseData: ExerciseResponse;
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const rawData = JSON.parse(cleanText);
      
      // Normalize the data structure
      let normalizedData = {
        exerciseName: rawData.exerciseName,
        description: rawData.description,
        steps: rawData.steps,
        targetKeypoints: rawData.targetKeypoints,
        angleCalculations: rawData.angleCalculations,
        targetRanges: rawData.targetRanges.startingPosition ? rawData.targetRanges : {
          startingPosition: [0, 45],
          targetRange: [90, 180],
          optimalPeak: [170, 180]
        },
        formChecks: rawData.formChecks,
        repThresholds: rawData.repThresholds
      };
      
      // Apply validation and corrections
      exerciseData = validateAndCorrectExercise(normalizedData);
      
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      console.error('Parse error:', parseError);
      throw new Error('Invalid response format from AI');
    }

    return NextResponse.json({
      success: true,
      data: exerciseData
    });

  } catch (error) {
    console.error('Error in exercise recommendation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate exercise recommendation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
