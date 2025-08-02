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

CRITICAL - ANGLE CALCULATION GUIDELINES:
- For ARM LIFTING exercises (shoulder abduction/flexion): Use [hip, shoulder, elbow] like [23, 11, 13]
- For ARM SWINGING exercises (pendulum): Use [shoulder, elbow, wrist] like [11, 13, 15] 
- For LEG exercises: Use [hip, knee, ankle] like [23, 25, 27]
- For SPINE exercises: Use [shoulder, hip, knee] like [11, 23, 25]

ANGLE RANGES LOGIC:
- Starting position = resting/neutral position angle
- Target range = active movement range
- Optimal peak = best performance range
- Rep thresholds: liftingMin < loweringMax < restMax (in ascending order)

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
- Shoulder Abduction (arm to side): points=[23, 11, 13], ranges: start=[0,45], target=[90,180], thresholds: lifting=90, lowering=60, rest=30
- Pendulum Swing: points=[11, 13, 15], ranges: start=[160,180], target=[90,160], thresholds: lifting=140, lowering=160, rest=175
- Arm Forward Raise: points=[23, 11, 13], ranges: start=[0,30], target=[90,180], thresholds: lifting=90, lowering=60, rest=30

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
