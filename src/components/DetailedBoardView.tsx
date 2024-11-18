import React, { useState } from "react";
import Image from "next/image";
import styles from "./DetailedBoardView.module.css";

interface Pin {
  id: string;
  media: {
    media_type: string;
    images: {
      "150x150": {
        url: string;
      };
      "400x300"?: {
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
  pins?: Pin[];
}

interface Analysis {
  matches: {
    match1: string;
    match2: string;
    match3: string;
    match4: string;
    match5: string;
  };
}

const DetailedBoardView = ({ board }: { board: Board }) => {
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePinClick = (pin: Pin) => {
    setSelectedPin(pin);
    setAnalysis(null);
    setError(null);
  };

  const handleAnalyzeClick = async () => {
    if (!selectedPin) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl:
            selectedPin.media.images["400x300"]?.url ||
            selectedPin.media.images["150x150"].url,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze image");
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPinImageUrl = (pin: Pin) => {
    return pin.media.images["150x150"].url;
  };

  return (
    <div className={styles.boardCard}>
      <div className={styles.boardHeader}>
        <h2 className={styles.boardTitle}>{board.name}</h2>
        {board.description && (
          <p className={styles.boardDescription}>{board.description}</p>
        )}
      </div>

      <div className={styles.pinsGrid}>
        {board.pins?.map((pin) => (
          <div
            key={pin.id}
            className={`${styles.pinItem} ${
              selectedPin?.id === pin.id ? styles.selectedPin : ""
            }`}
            onClick={() => handlePinClick(pin)}
          >
            <Image
              src={getPinImageUrl(pin)}
              alt={pin.title || "Pinterest Pin"}
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
        ))}
      </div>

      {selectedPin && (
        <div className={styles.modal} onClick={() => setSelectedPin(null)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.closeButton}
              onClick={() => setSelectedPin(null)}
            >
              ×
            </button>

            <Image
              src={getPinImageUrl(selectedPin)}
              alt={selectedPin.title || "Selected Pin"}
              width={400}
              height={400}
              className={styles.selectedPinImage}
            />

            <button
              className={styles.analyzeButton}
              onClick={handleAnalyzeClick}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <span className={styles.loadingSpinner}>↻</span>
                  Analyzing...
                </>
              ) : (
                "Analyze Image"
              )}
            </button>

            {error && <p className={styles.error}>{error}</p>}

            {analysis && (
              <div className={styles.results}>
                <h3>Similar Images:</h3>
                <ul className={styles.resultsList}>
                  {Object.entries(analysis.matches).map(([key, value]) => (
                    <li key={key}>{value}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedBoardView;
