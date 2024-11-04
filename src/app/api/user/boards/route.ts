// app/api/user/boards/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("pinterest_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // First fetch boards
    const boardsResponse = await fetch(
      "https://api.pinterest.com/v5/boards?page_size=25&include_empty=true",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!boardsResponse.ok) {
      const error = await boardsResponse.json();
      console.error("Pinterest API error:", error);
      return NextResponse.json(
        { error: "Failed to fetch boards" },
        { status: boardsResponse.status }
      );
    }

    const boardsData = await boardsResponse.json();
    console.log("Boards data:", boardsData);

    // Then fetch pins for each board
    const boardsWithPins = await Promise.all(
      boardsData.items.map(async (board: any) => {
        try {
          console.log(`Fetching pins for board: ${board.id}`);
          const pinsResponse = await fetch(
            `https://api.pinterest.com/v5/boards/${board.id}/pins?page_size=10`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
              },
            }
          );

          if (pinsResponse.ok) {
            const pinsData = await pinsResponse.json();
            console.log(`Pins data for board ${board.id}:`, pinsData);
            console.log("Sample pin data structure:", pinsData.items[0]);
            return {
              ...board,
              pins: pinsData.items || [],
            };
          }
          console.error(
            `Failed to fetch pins for board ${board.id}:`,
            await pinsResponse.json()
          );
          return {
            ...board,
            pins: [],
          };
        } catch (error) {
          console.error(`Error fetching pins for board ${board.id}:`, error);
          return {
            ...board,
            pins: [],
          };
        }
      })
    );

    console.log("Final boards with pins:", boardsWithPins);
    return NextResponse.json({ items: boardsWithPins });
  } catch (error) {
    console.error("Error fetching boards:", error);
    return NextResponse.json(
      { error: "Failed to fetch boards" },
      { status: 500 }
    );
  }
}
