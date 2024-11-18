// app/board-analysis/[boardId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./page.module.css";

interface Pin {
  id: string;
  media: {
    images: {
      "150x150": { url: string };
    };
  };
  title?: string;
}

interface AnalysisResult {
  testImage: string;
  matches: Record<string, string>;
}

export default function BoardAnalysisPage({
  params,
}: {
  params: { boardId: string };
}) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchAndAnalyzeBoard() {
      try {
        const boardResponse = await fetch(`/api/user/boards/${params.boardId}`);
        if (!boardResponse.ok) throw new Error("Failed to fetch board");

        const boardData = await boardResponse.json();
        if (!boardData.items || !Array.isArray(boardData.items)) {
          throw new Error("Invalid board data format");
        }

        setPins(boardData.items);

        // Skip analysis if no pins
        if (boardData.items.length === 0) {
          setError("No pins found in this board");
          setLoading(false);
          return;
        }

        const imageFiles = await Promise.all(
          boardData.items.map(async (pin: Pin) => {
            const imageUrl = pin.media.images["150x150"].url;
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            return new File([blob], pin.id, { type: "image/jpeg" });
          })
        );

        const formData = new FormData();
        imageFiles.forEach((file) => formData.append("images", file));

        const analysisResponse = await fetch("/api/analyze-images", {
          method: "POST",
          body: formData,
        });

        if (!analysisResponse.ok) throw new Error("Analysis failed");
        const data = await analysisResponse.json();
        setResults(data.results || []);
      } catch (error) {
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchAndAnalyzeBoard();
  }, [params.boardId]);

  if (loading)
    return <div className={styles.loading}>Analyzing board images...</div>;
  if (error) return <div className={styles.error}>Error: {error}</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Board Analysis Results</h1>

      <div className={styles.resultsGrid}>
        {results.map((result) => (
          <div key={result.testImage} className={styles.resultCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                Analysis for {result.testImage}
              </h2>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.imageSection}>
                <div>
                  <h3 className={styles.sectionTitle}>Source Image</h3>
                  <Image
                    src={
                      pins.find((p) => p.id === result.testImage)?.media.images[
                        "150x150"
                      ].url || ""
                    }
                    alt="Source"
                    width={150}
                    height={150}
                    className={styles.sourceImage}
                  />
                </div>

                <div>
                  <h3 className={styles.sectionTitle}>Similar Images</h3>
                  <div className={styles.matchGrid}>
                    {Object.entries(result.matches).map(([key, matchId]) => (
                      <Image
                        key={key}
                        src={
                          pins.find((p) => p.id === matchId)?.media.images[
                            "150x150"
                          ].url || ""
                        }
                        alt={`Match ${key}`}
                        width={100}
                        height={100}
                        className={styles.matchImage}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
