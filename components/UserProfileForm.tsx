"use client";
import { useState } from 'react';

interface UserProfile {
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  painLocation: string;
  painLevel: number;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  medicalHistory?: string;
  currentLimitations?: string;
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

interface UserProfileFormProps {
  onExerciseGenerated: (exerciseData: ExerciseData) => void;
  onClose: () => void;
}

export default function UserProfileForm({ onExerciseGenerated, onClose }: UserProfileFormProps) {
  const [profile, setProfile] = useState<UserProfile>({
    height: 170,
    weight: 70,
    age: 20,
    gender: 'male',
    painLocation: '',
    painLevel: 5,
    fitnessLevel: 'beginner',
    medicalHistory: '',
    currentLimitations: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/exercise-recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      });

      const result = await response.json();

      if (result.success) {
        onExerciseGenerated(result.data);
        onClose();
      } else {
        setError(result.error || 'Failed to generate exercise recommendation');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Personal Health Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Demographics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={profile.height}
                  onChange={(e) => handleInputChange('height', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={profile.weight}
                  onChange={(e) => handleInputChange('weight', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  value={profile.age}
                  onChange={(e) => handleInputChange('age', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                value={profile.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Pain Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Where do you feel pain or discomfort?
              </label>
              <input
                type="text"
                value={profile.painLocation}
                onChange={(e) => handleInputChange('painLocation', e.target.value)}
                placeholder="e.g., shoulder, lower back, knee, neck"
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Pain Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pain Level (1-10, where 10 is severe)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={profile.painLevel}
                onChange={(e) => handleInputChange('painLevel', parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 (Mild)</span>
                <span className="font-medium">{profile.painLevel}</span>
                <span>10 (Severe)</span>
              </div>
            </div>

            {/* Fitness Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fitness Level
              </label>
              <select
                value={profile.fitnessLevel}
                onChange={(e) => handleInputChange('fitnessLevel', e.target.value)}
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Medical History */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical History (Optional)
              </label>
              <textarea
                value={profile.medicalHistory}
                onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
                placeholder="Any relevant medical conditions, surgeries, or injuries"
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              />
            </div>

            {/* Current Limitations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Limitations (Optional)
              </label>
              <textarea
                value={profile.currentLimitations}
                onChange={(e) => handleInputChange('currentLimitations', e.target.value)}
                placeholder="Any movements you cannot perform or restrictions"
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating Exercise...
                  </div>
                ) : (
                  'Get Personalized Exercise'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
