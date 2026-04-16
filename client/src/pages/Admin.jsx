import { useEffect } from "react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { SAFE_API_URL } from "../services/apiClient";

function Admin() {
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch(`${SAFE_API_URL}/me`, {
          credentials: "include",
        });
        if (!res.ok) {
          setAuthState("unauthenticated");
          return;
        }
        const data = await res.json();
        if (data.user.role !== "admin") {
          setAuthState("forbidden");
          return;
        }
        setUser(data.user);
        setAuthState("authorized");
      } catch {
        setAuthState("unauthenticated");
      }
    };
    loadUser();
  }, []);

  const loggedout = async () => {
    await fetch(`${SAFE_API_URL}/logout`, {
      method: "post",
      credentials: "include",
    });
    navigate("/login");
  };

  if (authState === "loading") return <div>Loading...</div>;
  if (authState === "unauthenticated") return <Navigate to="/login" replace />;
  if (authState === "forbidden") return <Navigate to="/dashboard" replace />;
  return (
    <div>
      Hello Admin {user?.name}
      <button onClick={loggedout}>Logout</button>
    </div>
  );
}

export default Admin;
