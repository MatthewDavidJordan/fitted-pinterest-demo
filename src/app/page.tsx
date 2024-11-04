// app/page.tsx
"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);

  const handlePinterestLogin = async () => {
    setIsLoading(true);
    try {
      window.location.href = "/api/auth/pinterest";
    } catch (error) {
      console.error("Failed to initiate Pinterest login:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Welcome to Pinterest Integration App</h1>
      <button
        onClick={handlePinterestLogin}
        disabled={isLoading}
        className={styles.button}
      >
        {isLoading ? (
          <>
            <span className={styles.spinner}>↻</span>
            Connecting...
          </>
        ) : (
          <>
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 19c-.721 0-1.418-.109-2.073-.312.286-.465.713-1.227.87-1.835l.437-1.664c.229.436.895.804 1.604.804 2.111 0 3.633-1.941 3.633-4.354 0-2.312-1.888-4.042-4.316-4.042-3.021 0-4.625 2.027-4.625 4.235 0 1.027.547 2.305 1.422 2.712.132.062.203.034.234-.094l.193-.793c.017-.071.009-.132-.049-.202-.288-.35-.521-.995-.521-1.597 0-1.544 1.169-3.038 3.161-3.038 1.72 0 2.924 1.172 2.924 2.848 0 1.894-.957 3.205-2.201 3.205-.687 0-1.201-.568-1.036-1.265.197-.833.58-1.73.58-2.331 0-.537-.288-.986-.89-.986-.705 0-1.269.73-1.269 1.708 0 .623.211 1.044.211 1.044s-.694 2.936-.821 3.479c-.142.605-.086 1.454-.025 2.008-2.603-1.02-4.448-3.553-4.448-6.518 0-3.866 3.135-7 7-7s7 3.134 7 7-3.135 7-7 7z" />
            </svg>
            Login with Pinterest
          </>
        )}
      </button>
    </div>
  );
}
