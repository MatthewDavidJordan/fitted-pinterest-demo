// app/user-boards/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./page.module.css";

interface Pin {
  id: string;
  media: {
    media_type: string;
    images: {
      "150x150": {
        url: string;
      };
    };
  };
  title?: string;
}

interface Board {
  id: string;
  name: string;
  description?: string;
  privacy?: string;
  owner?: {
    username?: string;
  };
  pins?: Pin[];
}

export default function UserBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const response = await fetch("/api/user/boards");
        if (!response.ok) {
          if (response.status === 401) {
            router.push("/");
            return;
          }
          throw new Error("Failed to fetch boards");
        }
        const data = await response.json();
        setBoards(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchBoards();
  }, [router]);

  const getPinImageUrl = (pin: Pin) => {
    return pin.media?.images?.["150x150"]?.url;
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>Error: {error}</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Your Pinterest Boards</h1>
      <div className={styles.boards}>
        {boards.map((board) => (
          <div key={board.id} className={styles.board}>
            <h2>{board.name}</h2>
            <div className={styles.pins}>
              {board.pins?.map((pin) => {
                const imageUrl = getPinImageUrl(pin);
                return imageUrl ? (
                  <div key={pin.id} className={styles.pin}>
                    <Image
                      src={imageUrl}
                      alt={pin.title || "Pinterest Pin"}
                      width={100}
                      height={100}
                    />
                  </div>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
