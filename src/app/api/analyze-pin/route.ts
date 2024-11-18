// app/api/analyze-pin/route.ts
import { NextResponse } from "next/server";

interface AnalysisResponse {
  matches: {
    [key: string]: string; // URLs to the matching images
  };
}

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    const response = await fetch("http://localhost:8000/process-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to analyze image");
    }

    const data: AnalysisResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error analyzing pin:", error);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}
