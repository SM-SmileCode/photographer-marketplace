import React from "react";
import { Outlet } from "react-router-dom";
import GuestNavbar from "../_components/GuestNavbar";
import Footer from "../_components/Footer";

function GuestLayout() {
  return (
    <>
      <GuestNavbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export default GuestLayout;
