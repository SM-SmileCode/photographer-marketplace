import { useEffect, useRef, useCallback, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  confirmContactVerification,
  fetchCurrentUser,
  requestContactVerification,
  updateMyEmail,
  updateMyPhone,
  updateMyProfile,
  uploadUserImage,
  updateMyProfileImage,
} from "../services/userService";
import ProfileImageUploader from "../_components/ProfileImageUploader";
import FirebasePhoneOtp from "../_components/FirebasePhoneOtp";
import PushNotificationToggle from "../_components/PushNotificationToggle";
import { pageThemeVars } from "../styles/themeVars";
import { Camera } from "lucide-react";

const makeVerificationState = () => ({
  requestId: "",
  code: "",
  token: "",
  verified: false,
  busy: false,
  message: "",
  devCode: "",
});

function CustomerProfile() {
  const { user } = useOutletContext() || {};
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneMessage, setPhoneMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [emailVerification, setEmailVerification] = useState(makeVerificationState());
  const [phoneVerification, setPhoneVerification] = useState(makeVerificationState());

  const profileUploaderRef = useRef(null);

  const handleProfileImageClick = useCallback(() => {
    profileUploaderRef.current?.openPicker();
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const response = await fetchCurrentUser();
        if (!isMounted) return;
        setName(response?.user?.name || user?.name || "");
        setPhone(response?.user?.phone || user?.phone || "");
        setEmail(response?.user?.email || user?.email || "");
        setProfileImageUrl(response?.user?.profileImageUrl || "");
      } catch {
        if (!isMounted) return;
        setName(user?.name || "");
        setPhone(user?.phone || "");
        setEmail(user?.email || "");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [user?.email, user?.name, user?.phone]);

  const handleConfirmImageUpload = async (file) => {
    setUploadingImage(true);
    setImageError("");
    try {
      const data = await uploadUserImage(file);
      const url = data?.imageUrl;
      if (!url) throw new Error("Upload succeeded but image URL was not returned.");
      await updateMyProfileImage(url);
      setProfileImageUrl(url);
    } catch (error) {
      setImageError(error?.message || "Failed to upload profile image.");
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRequestVerification = async (channel) => {
    const isEmail = channel === "email";
    const value = isEmail ? email : phone;
    const purpose = isEmail ? "update_email" : "update_phone";

    if (!String(value || "").trim()) {
      if (isEmail) setEmailError("Please enter your email first.");
      else setPhoneError("Please enter your phone first.");
      return;
    }

    if (isEmail) {
      setEmailError("");
      setEmailMessage("");
      setEmailVerification((prev) => ({ ...prev, busy: true, message: "" }));
    } else {
      setPhoneError("");
      setPhoneMessage("");
      setPhoneVerification((prev) => ({ ...prev, busy: true, message: "" }));
    }

    try {
      const response = await requestContactVerification({ channel, value, purpose, authRequired: true });
      const next = {
        requestId: response?.verificationRequestId || "",
        code: "",
        token: "",
        verified: false,
        busy: false,
        message: "Verification code sent.",
        devCode: response?.devCode || "",
      };
      if (isEmail) setEmailVerification(next);
      else setPhoneVerification(next);
    } catch (error) {
      if (isEmail) {
        setEmailError(error?.message || "Failed to send verification code.");
        setEmailVerification((prev) => ({ ...prev, busy: false }));
      } else {
        setPhoneError(error?.message || "Failed to send verification code.");
        setPhoneVerification((prev) => ({ ...prev, busy: false }));
      }
    }
  };

  const handleConfirmVerification = async (channel) => {
    const isEmail = channel === "email";
    const state = isEmail ? emailVerification : phoneVerification;

    if (!state.requestId) {
      if (isEmail) setEmailError("Please request verification code first.");
      else setPhoneError("Please request verification code first.");
      return;
    }
    if (!state.code || state.code.length !== 6) {
      if (isEmail) setEmailError("Enter the 6-digit verification code.");
      else setPhoneError("Enter the 6-digit verification code.");
      return;
    }

    if (isEmail) {
      setEmailError("");
      setEmailVerification((prev) => ({ ...prev, busy: true, message: "" }));
    } else {
      setPhoneError("");
      setPhoneVerification((prev) => ({ ...prev, busy: true, message: "" }));
    }

    try {
      const response = await confirmContactVerification({
        verificationRequestId: state.requestId,
        code: state.code,
      });
      const next = { ...state, token: response?.verificationToken || "", verified: true, busy: false, message: "Verified successfully." };
      if (isEmail) setEmailVerification(next);
      else setPhoneVerification(next);
    } catch (error) {
      if (isEmail) {
        setEmailError(error?.message || "Invalid verification code.");
        setEmailVerification((prev) => ({ ...prev, busy: false }));
      } else {
        setPhoneError(error?.message || "Invalid verification code.");
        setPhoneVerification((prev) => ({ ...prev, busy: false }));
      }
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const response = await updateMyProfile({ name });
      setName(response?.user?.name || name);
      setProfileMessage("Profile updated successfully.");
    } catch (submitError) {
      setProfileError(submitError?.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    setEmailError("");
    setEmailMessage("");
    try {
      if (!emailVerification.verified || !emailVerification.token) {
        throw new Error("Please verify your email before update.");
      }
      const response = await updateMyEmail(email, emailVerification.token);
      setEmail(response?.user?.email || email);
      setEmailMessage("Email updated successfully.");
      setEmailVerification(makeVerificationState());
    } catch (submitError) {
      setEmailError(submitError?.message || "Failed to update email.");
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setSavingPhone(true);
    setPhoneError("");
    setPhoneMessage("");
    try {
      if (!phoneVerification.verified || !phoneVerification.token) {
        throw new Error("Please verify your phone before update.");
      }
      const response = await updateMyPhone(phone, phoneVerification.token);
      setPhone(response?.user?.phone || phone);
      setPhoneMessage("Phone updated successfully.");
      setPhoneVerification(makeVerificationState());
    } catch (submitError) {
      setPhoneError(submitError?.message || "Failed to update phone.");
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6 lg:px-8"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="card-hero sm:p-8">
          <p className="label-uppercase-lg">Customer Profile</p>
          <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl sm:text-4xl">
            Account Settings
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Contact updates require OTP verification for account trust.
          </p>
        </section>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading profile...</p>
        ) : null}

        <section className="card-surface">
          <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
            Profile Picture
          </h2>
          <div className="mt-4 flex items-center gap-5">
            <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full border-2 border-[var(--line)] bg-[#F8F6F1]">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
                  No Photo
                </div>
              )}
              <button
                type="button"
                onClick={handleProfileImageClick}
                disabled={uploadingImage}
                className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                <Camera size={14} strokeWidth={2.2} />
              </button>
            </div>
            <div>
              <p className="text-sm text-[var(--muted)]">
                {uploadingImage ? "Uploading..." : "Click the camera icon to update your profile picture."}
              </p>
              {imageError ? (
                <p className="mt-1 text-sm text-red-600">{imageError}</p>
              ) : null}
            </div>
          </div>
          <ProfileImageUploader
            popup
            ref={profileUploaderRef}
            disabled={uploadingImage}
            uploading={uploadingImage}
            onConfirmUpload={handleConfirmImageUpload}
            onError={(msg) => setImageError(msg)}
          />
        </section>

        <section className="card-surface">
          <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
            Notifications
          </h2>
          <div className="mt-4">
            <PushNotificationToggle />
          </div>
        </section>

        <section className="card-surface">
          <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
            Basic Details
          </h2>
          <form onSubmit={handleProfileSubmit} className="mt-4 grid gap-3">
            <div>
              <label className="form-label text-[var(--text)]">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input border-[var(--line)]"
                required
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {savingProfile ? "Saving..." : "Save Name"}
              </button>
            </div>
          </form>
          {profileMessage ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {profileMessage}
            </p>
          ) : null}
          {profileError ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {profileError}
            </p>
          ) : null}
        </section>

        <section className="card-surface">
          <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
            Verified Contact Updates
          </h2>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <form onSubmit={handleEmailSubmit} className="card-white">
              <p className="text-sm font-semibold text-[var(--text)]">Email</p>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailVerification(makeVerificationState());
                }}
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                required
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleRequestVerification("email")}
                  disabled={emailVerification.busy}
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF] disabled:opacity-60"
                >
                  Send Code
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={emailVerification.code}
                  onChange={(e) =>
                    setEmailVerification((prev) => ({
                      ...prev,
                      code: e.target.value.replace(/\D/g, ""),
                      verified: false,
                      token: "",
                    }))
                  }
                  placeholder="6-digit code"
                  className="w-32 rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleConfirmVerification("email")}
                  disabled={emailVerification.busy}
                  className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  Verify
                </button>
              </div>
              {emailVerification.message ? (
                <p className="mt-2 text-xs text-emerald-700">{emailVerification.message}</p>
              ) : null}
              {emailVerification.devCode ? (
                <p className="mt-1 text-xs text-[var(--muted)]">Dev code: {emailVerification.devCode}</p>
              ) : null}
              {emailError ? (
                <p className="mt-2 text-sm text-red-600">{emailError}</p>
              ) : null}
              {emailMessage ? (
                <p className="mt-2 text-sm text-emerald-700">{emailMessage}</p>
              ) : null}
              <button
                type="submit"
                disabled={savingEmail}
                className="mt-3 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {savingEmail ? "Updating..." : "Update Email"}
              </button>
            </form>

            <form onSubmit={handlePhoneSubmit} className="card-white">
              <p className="text-sm font-semibold text-[var(--text)]">Phone</p>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneVerification(makeVerificationState());
                }}
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                required
              />
              <FirebasePhoneOtp
                phone={phone}
                purpose="update_phone"
                userId={user?._id || user?.userId}
                onVerified={(token) =>
                  setPhoneVerification((prev) => ({ ...prev, token, verified: true, message: "Phone verified." }))
                }
                onError={(msg) => setPhoneError(msg)}
                disabled={savingPhone}
                hideButton
              />
              {phoneError ? (
                <p className="mt-2 text-sm text-red-600">{phoneError}</p>
              ) : null}
              {phoneMessage ? (
                <p className="mt-2 text-sm text-emerald-700">{phoneMessage}</p>
              ) : null}
              <button
                type="submit"
                disabled={savingPhone}
                className="mt-3 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {savingPhone ? "Updating..." : "Update Phone"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CustomerProfile;
