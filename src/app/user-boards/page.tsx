// app/user-boards/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DetailedBoardView from "../../components/DetailedBoardView";
import styles from "./page.module.css";

interface Pin {
  id: string;
  media: {
    media_type: string;
    images: {
      "150x150": {
        url: string;
      };
      "400x300": {
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
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
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

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>Error: {error}</div>;

  if (selectedBoard) {
    return (
      <div className={styles.container}>
        <button
          onClick={() => setSelectedBoard(null)}
          className={styles.backButton}
        >
          ← Back to Boards
        </button>
        <DetailedBoardView board={selectedBoard} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Your Pinterest Boards</h1>
      <div className={styles.boardsGrid}>
        {boards.map((board) => (
          <div
            key={board.id}
            className={styles.boardCard}
            onClick={() => setSelectedBoard(board)}
          >
            <h2 className={styles.boardTitle}>{board.name}</h2>
            <p className={styles.pinCount}>{board.pins?.length || 0} pins</p>
          </div>
        ))}
      </div>
    </div>
  );
}
