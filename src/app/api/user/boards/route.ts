// app/api/user/boards/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface PinterestBoard {
  id: string;
  name: string;
  description: string;
  owner: {
    username: string;
  };
  privacy: string;
  collaborator_count: number;
  follower_count: number;
  pin_count: number;
  created_at: string;
  board_pins_modified_at: string;
  media?: {
    pin_thumbnail_urls?: string[];
    image_cover_url?: string;
  };
}

interface PinterestPin {
  id: string;
  media: {
    media_type: string;
    images: {
      "150x150": {
        url: string;
        width: number;
        height: number;
      };
      "400x300": {
        url: string;
        width: number;
        height: number;
      };
      "600x": {
        url: string;
        width: number;
        height: number;
      };
    };
  };
  title?: string;
  description?: string;
  link?: string;
  created_at: string;
  board_id: string;
}

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("pinterest_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
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

    const boardsWithPins = await Promise.all(
      boardsData.items.map(async (board: PinterestBoard) => {
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
            const pinsData: { items: PinterestPin[] } =
              await pinsResponse.json();
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
