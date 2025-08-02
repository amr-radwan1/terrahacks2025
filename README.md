# AI Physiotherapy Coach

An intelligent physiotherapy application that uses MediaPipe pose detection and Google's Gemini AI to provide personalized exercise recommendations and real-time form analysis.

## Features

- **Personalized Exercise Recommendations**: Uses Gemini AI to generate custom exercises based on user demographics, pain location, and fitness level
- **Real-time Pose Analysis**: MediaPipe integration for accurate pose detection and movement tracking
- **Dynamic Form Feedback**: AI-powered form correction with visual and text feedback
- **Complete Skeleton Visualization**: Full body pose overlay with color-coded body parts
- **Adaptive Exercise Parameters**: Dynamic angle calculations and rep counting based on exercise type

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
1. Copy `.env.example` to `.env.local`
2. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Add your API key to `.env.local`:
```
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Run the Development Server
```bash
npm run dev
```

### 4. Access the Application
Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. **Start with Default Exercise**: The app loads with a default shoulder abduction exercise
2. **Get Personalized Exercise**: Click "Get Personalized Exercise" to fill out your health profile
3. **Fill Profile Form**: Enter your height, weight, age, pain location, and other relevant information
4. **Receive AI Recommendation**: Gemini AI will analyze your profile and recommend a suitable exercise
5. **Perform Exercise**: Follow the on-screen instructions and real-time feedback
6. **Monitor Progress**: Track your repetitions and form corrections

## Technical Architecture

### Frontend Components
- `PhysioCoach.tsx`: Main application component with MediaPipe integration
- `UserProfileForm.tsx`: User health profile collection form

### API Endpoints
- `/api/exercise-recommendation`: Processes user profile and returns personalized exercise data

### AI Integration
- **MediaPipe Pose**: Real-time pose detection and landmark tracking
- **Google Gemini**: Intelligent exercise recommendation and parameter generation

### Dynamic Exercise System
The application dynamically adjusts:
- Target angle ranges based on exercise type
- Form checking criteria and keypoints
- Exercise instructions and descriptions
- Rep counting thresholds

## MediaPipe Landmarks Reference

The application uses MediaPipe's 33 pose landmarks:
- **0-10**: Face landmarks (hidden by default)
- **11-16**: Upper body (shoulders, elbows, wrists)
- **17-22**: Hand landmarks  
- **23-28**: Lower body (hips, knees, ankles)
- **29-32**: Foot landmarks

## Color Coding
- **Green**: Arms (shoulders, elbows, wrists)
- **Red**: Hand details
- **Teal**: Legs (hips, knees, ankles)  
- **Purple**: Feet

## Development

### Project Structure
```
├── app/
│   ├── api/exercise-recommendation/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── PhysioCoach.tsx
│   └── UserProfileForm.tsx
└── public/
```

### Adding New Exercises
To add support for new exercises, update the Gemini prompt in `/api/exercise-recommendation/route.ts` to include exercise-specific parameters and form checks.

## Disclaimer
This application is for demonstration and educational purposes only. Always consult with a licensed physiotherapist or healthcare provider before starting any exercise program.
