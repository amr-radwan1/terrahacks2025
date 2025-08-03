// app/api/youtube-search/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    // Option 1: Use YouTube Data API (requires API key)
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (YOUTUBE_API_KEY) {
      const youtubeResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}&maxResults=1&order=relevance&videoDefinition=high&videoDuration=medium`
      );
      
      if (youtubeResponse.ok) {
        const data = await youtubeResponse.json();
        if (data.items && data.items.length > 0) {
          return NextResponse.json({ 
            videoId: data.items[0].id.videoId,
            title: data.items[0].snippet.title,
            description: data.items[0].snippet.description
          });
        }
      }
    }

    // Option 2: Fallback to curated exercise videos based on keywords
    const exerciseVideos: { [key: string]: string } = {
      // Shoulder exercises
      'shoulder abduction': 'x5F5kW8qj3U', // Physical therapy shoulder abduction
      'shoulder flexion': 'mGj8HQ0_HYc', // Shoulder flexion exercise
      'lateral raise': 'x5F5kW8qj3U', // Lateral raises
      'side raise': 'x5F5kW8qj3U', // Side raises
      'forward raise': 'mGj8HQ0_HYc', // Forward arm raises
      
      // Arm exercises
      'bicep curl': 'ykJG6cHPB_M', // Proper bicep curl form
      'biceps curl': 'ykJG6cHPB_M', // Biceps curl variation
      'arm curl': 'ykJG6cHPB_M', // Generic arm curl
      'hammer curl': 'zC3nLlEvin4', // Hammer curls
      
      // Pendulum exercises
      'pendulum': 'FhCCl0qsB4E', // Pendulum exercise for shoulder
      'pendulum swing': 'FhCCl0qsB4E', // Pendulum swings
      'shoulder pendulum': 'FhCCl0qsB4E', // Shoulder pendulum
      
      // Leg exercises
      'leg raise': 'JeWkFhVKSx4', // Leg raise exercise
      'hip flexion': 'JeWkFhVKSx4', // Hip flexion exercise
      'straight leg raise': 'JeWkFhVKSx4', // Straight leg raises
      'knee extension': 'yK3QBUaFdTQ', // Seated knee extension
      'squat': '6A2V9Bu80J4', // Proper squat form
      'wall squat': 'y0wWKOhQwQo', // Wall squat exercise
      
      // Back exercises
      'back extension': 'ph3pddpKzzw', // Back extension exercise
      'spinal extension': 'ph3pddpKzzw', // Spinal extension
      
      // Neck exercises
      'neck flexion': 'L_xrDAtykMM', // Neck flexion exercise
      'neck extension': 'L_xrDAtykMM', // Neck extension
      
      // Default
      'default': 'x5F5kW8qj3U' // Default shoulder exercise
    };

    // Find matching video based on query keywords
    const lowerQuery = query.toLowerCase();
    let matchedVideoId = exerciseVideos['default'];
    
    // Check for exact matches first
    for (const [keyword, videoId] of Object.entries(exerciseVideos)) {
      if (lowerQuery.includes(keyword)) {
        matchedVideoId = videoId;
        break;
      }
    }
    
    // If no exact match, try partial matches
    if (matchedVideoId === exerciseVideos['default']) {
      const keywords = ['shoulder', 'bicep', 'leg', 'arm', 'pendulum', 'curl', 'raise', 'squat'];
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          const possibleKeys = Object.keys(exerciseVideos).filter(k => k.includes(keyword));
          if (possibleKeys.length > 0) {
            matchedVideoId = exerciseVideos[possibleKeys[0]];
            break;
          }
        }
      }
    }

    return NextResponse.json({ 
      videoId: matchedVideoId,
      title: `${query} - Exercise Demonstration`,
      description: 'Proper form demonstration for physiotherapy exercise'
    });

  } catch (error) {
    console.error('Error in YouTube search:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search for video',
        videoId: 'x5F5kW8qj3U' // Fallback video
      },
      { status: 500 }
    );
  }
}