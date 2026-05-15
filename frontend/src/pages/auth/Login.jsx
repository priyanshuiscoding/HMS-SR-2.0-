import { useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { AuthLayout } from "../../components/layout/AuthLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { loginRequest } from "../../services/api.js";

export function LoginPage() {
  const { login } = useAuth();
  const [formState, setFormState] = useState({
    email: "admin@sraiims.in",
    password: "Admin@123"
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    setFormState((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = await loginRequest(formState);
      login(payload);
    } catch (apiError) {
      setError(apiError.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="eyebrow">Secure Access</div>
        <h2 className="page-title">Sign in to the SR-AIIMS control center.</h2>
        <p className="page-copy">
          This foundation phase includes the initial authentication flow and the role-aware dashboard shell.
        </p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formState.email}
              onChange={handleChange}
              placeholder="admin@sraiims.in"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formState.password}
              onChange={handleChange}
              placeholder="Enter your password"
            />
          </div>

          {error ? <div className="error-text">{error}</div> : null}

          <Button disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Enter HMS"}
          </Button>
        </form>

      </div>
    </AuthLayout>
  );
}
