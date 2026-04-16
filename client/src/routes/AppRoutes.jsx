import { BrowserRouter, Routes, Route } from "react-router-dom";

import GuestLayout from "../layouts/GuestLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import PhotographerLayout from "../layouts/PhotographerLayout";
import AdminLayout from "../layouts/AdminLayout";

import Home from "../pages/Home";
import Login from "../pages/Login";
import SignUp from "../pages/SignUp";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import Dashboard from "../pages/Dashboard";
import PhotographerDashboard from "../pages/PhotographerDashboard";
import AdminDashboard from "../pages/AdminDashboard";
import AdminReviewModeration from "../pages/AdminReviewModeration";
import AdminPhotographerRequests from "../pages/AdminPhotographerRequests";
import AdminUsers from "../pages/AdminUsers";
import AdminBookings from "../pages/AdminBookings";
import AdminReports from "../pages/AdminReports";
import AdminAnalytics from "../pages/AdminAnalytics";
import AdminPayouts from "../pages/AdminPayouts";
import About from "../pages/About";
import HowItWorks from "../pages/HowItWorks";
import PhotographerProfile from "../pages/PhotographerProfile";
import PhotographerAvailability from "../pages/PhotographerAvailability";
import Explore from "../pages/Explore";
import PhotographerPublicProfile from "../pages/PhotographerPublicProfile";
import Bookings from "../pages/Bookings";
import PhotographerBookingRequests from "../pages/PhotographerBookingRequests";
import PhotographerPackages from "../pages/PhotographerPackages";
import PhotographerDeliveryTracking from "../pages/PhotographerDeliveryTracking";
import CustomerDeliveryTracking from "../pages/CustomerDeliveryTracking";
import Notifications from "../pages/Notifications";
import PhotographerEarnings from "../pages/PhotographerEarnings";
import Wishlist from "../pages/Wishlist";
import CustomerProfile from "../pages/CustomerProfile";
import Chat from "../pages/Chat";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Customer */}
        <Route element={<CustomerLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customer/explore" element={<Explore />} />
          <Route path="/customer/photographers/:slug" element={<PhotographerPublicProfile />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/deliveries" element={<CustomerDeliveryTracking />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/profile" element={<CustomerProfile />} />
          <Route path="/messages" element={<Chat />} />
        </Route>

        {/* Guest */}
        <Route element={<GuestLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/photographers/:slug" element={<PhotographerPublicProfile />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Photographer */}
        <Route element={<PhotographerLayout />}>
          <Route path="/photographer/dashboard" element={<PhotographerDashboard />} />
          <Route path="/photographer/profile" element={<PhotographerProfile />} />
          <Route path="/photographer/packages" element={<PhotographerPackages />} />
          <Route path="/photographer/availability" element={<PhotographerAvailability />} />
          <Route path="/photographer/booking-requests" element={<PhotographerBookingRequests />} />
          <Route path="/photographer/delivery-tracking" element={<PhotographerDeliveryTracking />} />
          <Route path="/photographer/notifications" element={<Notifications />} />
          <Route path="/photographer/earnings" element={<PhotographerEarnings />} />
          <Route path="/photographer/messages" element={<Chat />} />
        </Route>

        {/* Admin */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/reviews" element={<AdminReviewModeration />} />
          <Route path="/admin/notifications" element={<Notifications />} />
          <Route path="/admin/photographer-requests" element={<AdminPhotographerRequests />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/payouts" element={<AdminPayouts />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
