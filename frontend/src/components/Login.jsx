import { useEffect, useState } from "react";
import { authAPI } from "../../services/api.jsx";
import { toast } from "react-toastify";




import "./Login.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [isOrbiting, setIsOrbiting] = useState(false);
  const [isBeaming, setIsBeaming] = useState(false);
  const [stars, setStars] = useState([]);

  // Generate random stars on mount
  useEffect(() => {
    const generateStars = () => {
      const starCount = 150; // Number of stars
      const newStars = [];

      for (let i = 0; i < starCount; i++) {
        const size = Math.random();
        let sizeClass = 'small';
        if (size > 0.7) sizeClass = 'large';
        else if (size > 0.4) sizeClass = 'medium';

        newStars.push({
          id: i,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDuration: `${2 + Math.random() * 4}s`, // 2-6 seconds
          animationDelay: `${Math.random() * 3}s`,
          size: sizeClass,
        });
      }

      setStars(newStars);
    };

    generateStars();
  }, []);

  // Prefill email if remembered
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const startOrbit = () => {
    // once started, keep orbiting
    if (!isOrbiting) setIsOrbiting(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    startOrbit();

    try {
      const response = await authAPI.login(email, password);
      const { accessToken, refreshToken, displayName, role } = response.data;


      localStorage.setItem("token", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("displayName", displayName);
      localStorage.setItem("role", role);


      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      onLogin(response.data);
    } catch (err) {
      if (!err.response) {
        // Network error - backend is offline
        setError("Sistem çevrimdışı. Lütfen daha sonra tekrar deneyin.");
      } else {
        // Server responded with an error
        setError(err.response?.data?.message || "Giriş başarısız");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShowPasswordToggle = () => {
    setShowPassword((prev) => !prev);

    // short beam effect
    setIsBeaming(true);
    setTimeout(() => setIsBeaming(false), 700);
  };

  const handleInputFocus = () => {
    startOrbit();
  };

  return (
    <div style={styles.container}>
      {/* Starfield Background */}
      <div className="stars-container">
        {stars.map((star) => (
          <div
            key={star.id}
            className={`star ${star.size}`}
            style={{
              left: star.left,
              top: star.top,
              animationDuration: star.animationDuration,
              animationDelay: star.animationDelay,
            }}
          />
        ))}
      </div>

      <div style={styles.card}>
        {/* Orbit & satellite */}
        <div className="orbit-wrapper">
          <div className={`orbit-container ${isOrbiting ? "orbit-visible" : ""}`}>
            {/* Dashed elliptical path */}
            <div className="orbit-path" />

            {/* outer div: moves along the orbit */}
            <div className={"satellite" + (isOrbiting ? " satellite-orbiting" : "")}>
              {/* inner div: counter-rotates so it always faces the center */}
              <div
                className={
                  "satellite-icon" + (isBeaming ? " satellite-beaming" : "")
                }
              >
                🛰️
              </div>
            </div>
          </div>
        </div>

        <h1 style={styles.title}>Giriş</h1>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={handleInputFocus}
            required
            style={styles.input}
          />

          <div style={styles.passwordWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={handleInputFocus}
              required
              style={{ ...styles.input, paddingRight: "3rem" }}
            />
            <button
              type="button"
              onClick={handleShowPasswordToggle}
              style={styles.showPasswordBtn}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <div style={styles.rowBetween}>
            <label style={styles.rememberLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={styles.checkbox}
              />
              Beni hatırla
            </label>

            <button
              type="button"
              style={styles.linkButton}
              onClick={() => {
                toast.info("Şifre sıfırlama henüz eklenmedi.");
              }}
            >
              Şifremi unuttum
            </button>
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Giriş yapılıyor..." : "Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "radial-gradient(circle at top, #0f172a 0%, #020617 55%, #000 100%)",
    position: "relative",
    overflow: "hidden",
  },
  card: {
    position: "relative",
    background: "rgba(15, 23, 42, 0.95)",
    padding: "3rem",
    borderRadius: "18px",
    boxShadow: "0 20px 60px rgba(15,23,42,0.8), 0 0 100px rgba(56, 189, 248, 0.1)",
    width: "100%",
    maxWidth: "420px",
    overflow: "visible", // important so orbit is not clipped
    border: "1px solid rgba(148, 163, 184, 0.3)",
    backdropFilter: "blur(14px)",
    zIndex: 10,
  },
  title: {
    textAlign: "center",
    marginBottom: "2rem",
    color: "#e5e7eb",
    fontSize: "1.8rem",
    letterSpacing: "0.06em",
    textShadow: "0 0 20px rgba(56, 189, 248, 0.3)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  input: {
    padding: "0.9rem 1rem",
    borderRadius: "999px",
    border: "1px solid rgba(148, 163, 184, 0.6)",
    fontSize: "0.95rem",
    background: "rgba(15, 23, 42, 0.9)",
    color: "#e5e7eb",
    outline: "none",
    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
  },
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  showPasswordBtn: {
    position: "absolute",
    right: "0.75rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "1.1rem",
    color: "#9ca3af",
    transition: "transform 0.2s ease",
  },
  button: {
    marginTop: "0.5rem",
    padding: "0.9rem",
    background:
      "linear-gradient(135deg, #38bdf8 0%, #6366f1 40%, #f97316 100%)",
    color: "white",
    border: "none",
    borderRadius: "999px",
    fontSize: "1rem",
    cursor: "pointer",
    fontWeight: 600,
    letterSpacing: "0.04em",
    transition: "transform 0.2s ease, box-shadow 0.3s ease",
    boxShadow: "0 4px 20px rgba(56, 189, 248, 0.3)",
  },
  error: {
    padding: "0.8rem",
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: "8px",
    fontSize: "0.9rem",
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.85rem",
    marginTop: "0.25rem",
  },
  rememberLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  checkbox: {
    accentColor: "#38bdf8",
    width: "16px",
    height: "16px",
    cursor: "pointer",
  },
  linkButton: {
    padding: 0,
    border: "none",
    background: "none",
    color: "#38bdf8",
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: "0.8rem",
    transition: "color 0.2s ease",
  },
};