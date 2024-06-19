import { NextResponse } from "next/server";

// Centralized error handling
export const handleApiError = (especify: string, error: any) =>
  new NextResponse("Error: " + error, { status: 500 });
