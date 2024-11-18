import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { boardId: string } }
) {
  console.log("Request received:", {
    url: request.url,
    params,
    method: request.method,
    headers: Object.fromEntries(request.headers),
  });

  const boardId = await params.boardId;

  if (!boardId) {
    console.error("Missing boardId parameter");
    return NextResponse.json(
      { error: "Board ID is required" },
      { status: 400 }
    );
  }

  console.log("Board ID:", boardId);

  const cookieStore = await cookies();
  const accessToken = (await cookieStore.get("pinterest_token"))?.value;

  console.log("Cookie store accessed:", {
    hasAccessToken: !!accessToken,
    cookieNames: [...(await cookieStore.getAll()).map((c) => c.name)],
  });

  if (!accessToken) {
    console.error("No access token found in cookies");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const pinterestUrl = `https://api.pinterest.com/v5/boards/${boardId}/pins?page_size=25`;
    console.log("Fetching from Pinterest API:", pinterestUrl);

    const response = await fetch(pinterestUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    console.log("Pinterest API response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Pinterest API error:", errorData);
      return NextResponse.json(
        { error: errorData.message || "Failed to fetch board pins" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Pinterest API success:", {
      itemCount: data.items?.length,
      hasBookmark: !!data.bookmark,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch board";
    console.error("Caught error:", {
      type: error instanceof Error ? error.constructor.name : typeof error,
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
