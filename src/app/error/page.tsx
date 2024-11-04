// app/error/page.tsx
import Link from "next/link";

export default function ErrorPage() {
  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h1>fuck.</h1>
      <p>
        We encountered an error during the authentication process. Please try
        again later.
      </p>
      <Link href="/" style={{ textDecoration: "underline", color: "blue" }}>
        Go back to Home
      </Link>
    </div>
  );
}
