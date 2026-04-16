import { cloneElement, isValidElement, useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import Footer from "../_components/Footer";
import { SAFE_API_URL } from "../services/apiClient";

function getRedirectPathByRole(role) {
  if (role === "admin") return "/admin";
  if (role === "photographer") return "/photographer/dashboard";
  if (role === "customer") return "/dashboard";
  return "/login";
}

function RoleGuardLayout({ allowedRole, navbar }) {
  const [guardState, setGuardState] = useState({
    status: "loading",
    redirectTo: "/login",
    user: null,
  });

  useEffect(() => {
    let isMounted = true;

    const validateAccess = async () => {
      try {
        const res = await fetch(`${SAFE_API_URL}/me`, {
          credentials: "include",
        });

        if (!res.ok) {
          if (isMounted) {
            setGuardState({
              status: "redirect",
              redirectTo: "/login",
              user: null,
            });
          }
          return;
        }

        const data = await res.json();
        const userRole = data?.user?.role;

        if (userRole !== allowedRole) {
          if (isMounted) {
            setGuardState({
              status: "redirect",
              redirectTo: getRedirectPathByRole(userRole),
              user: null,
            });
          }
          return;
        }

        if (isMounted) {
          setGuardState({
            status: "authorized",
            redirectTo: "/login",
            user: data.user,
          });
        }
      } catch {
        if (isMounted) {
          setGuardState({
            status: "redirect",
            redirectTo: "/login",
            user: null,
          });
        }
      }
    };

    validateAccess();

    return () => {
      isMounted = false;
    };
  }, [allowedRole]);

  if (guardState.status === "loading") {
    return <div>Loading...</div>;
  }

  if (guardState.status === "redirect") {
    return <Navigate to={guardState.redirectTo} replace />;
  }
  const navbarWithUser = isValidElement(navbar)
    ? cloneElement(navbar, { user: guardState.user })
    : navbar;

  return (
    <>
      {navbarWithUser}
      <main>
        <Outlet context={{ user: guardState.user }} />
      </main>
      <Footer/>
    </>
  );
}

export default RoleGuardLayout;
