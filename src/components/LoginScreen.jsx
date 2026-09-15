import { useState } from "react";

export default function LoginScreen({ onLogin }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password })
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { error: `Server returned ${res.status} instead of JSON. Redeploy the latest Vercel version.` };
      if (!res.ok) throw new Error(data.error || "Login failed.");
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">ZEHRIN</div>
        <p>Boss access only</p>
        <input value={id} onChange={(event) => setId(event.target.value)} placeholder="Boss ID" autoComplete="username" required />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete="current-password" required />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "Checking..." : "Enter ZEHRIN"}</button>
      </form>
    </main>
  );
}
