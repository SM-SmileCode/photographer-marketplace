import { useEffect, useReducer, useRef, useCallback, useState } from "react";

import {
  createMyPhotographerProfile,
  getMyPhotographerProfile,
  getPhotographerProfileFormConfig,
  updateMyPhotographerProfile,
  uploadPhotographerImage,
} from "../services/photographerProfileService";
import ProfileEditForm from "./photographer-profile/ProfileEditForm";
import { ProfileFormProvider } from "../context/ProfileFormContext";
import ProfileView from "./photographer-profile/ProfileView";
import { buildProfilePayload } from "./photographer-profile/profileFormHelpers";
import { useOutletContext } from "react-router-dom";
import ProfileImageUploader from "../_components/ProfileImageUploader";
import FirebasePhoneOtp from "../_components/FirebasePhoneOtp";
import { pageThemeVars } from "../styles/themeVars";
import {
  confirmContactVerification,
  requestContactVerification,
  updateMyEmail,
  updateMyPhone,
} from "../services/userService";

const initialState = {
  profile: null,
  config: null,
  loading: true,
  error: null,
  isEditing: false,
  formData: {},
  uploadingField: null,
  submitting: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_PROFILE":
      return { ...state, profile: action.payload, loading: false };
    case "SET_CONFIG":
      return { ...state, config: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_EDITING":
      return {
        ...state,
        isEditing: action.payload,
        formData: action.payload && state.profile ? { ...state.profile } : {},
      };
    case "SET_UPLOADING_FIELD":
      return { ...state, uploadingField: action.payload };
    case "UPDATE_FORM_DATA":
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.payload };
    case "RESET_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

const makeEmailVerificationState = () => ({
  requestId: "",
  code: "",
  token: "",
  verified: false,
  busy: false,
  message: "",
  devCode: "",
});

function PhotographerProfile() {
  const { user } = useOutletContext() || {};
  const [state, dispatch] = useReducer(reducer, initialState);
  const [emailDraft, setEmailDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneMessage, setPhoneMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [emailVerification, setEmailVerification] = useState(makeEmailVerificationState());
  const [phoneVerification, setPhoneVerification] = useState({ token: "", verified: false });

  const profileUploaderRef = useRef(null);
  const coverInputRef = useRef(null);
  const portfolioInputRef = useRef(null);

  const handleProfileImageClick = useCallback(() => {
    profileUploaderRef.current?.openPicker();
  }, []);

  const handleCoverImageClick = useCallback(() => {
    coverInputRef.current?.click();
  }, []);

  const handleAddGalleryClick = useCallback(() => {
    portfolioInputRef.current?.click();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileRes, configRes] = await Promise.all([
          getMyPhotographerProfile(),
          getPhotographerProfileFormConfig(),
        ]);
        dispatch({ type: "SET_CONFIG", payload: configRes });
        dispatch({ type: "SET_PROFILE", payload: profileRes.profile || null });
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: error.message });
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    setEmailDraft(user?.email || "");
    setPhoneDraft(user?.phone || "");
    setEmailVerification(makeEmailVerificationState());
    setPhoneVerification({ token: "", verified: false });
  }, [user?.email, user?.phone]);

  const handleImageUpload = async (
    fieldName,
    fileOrFiles,
    { mode = "draft", propagateError = false } = {},
  ) => {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    const validFiles = files.filter(Boolean);
    if (!validFiles.length) return;

    dispatch({ type: "SET_UPLOADING_FIELD", payload: fieldName });

    try {
      const uploadedMedia = [];

      for (const file of validFiles) {
        const isImage = file.type?.startsWith("image/");
        const isVideo = file.type?.startsWith("video/");

        if (fieldName === "portfolioImages") {
          if (!isImage && !isVideo) throw new Error("Please select a valid image/video file.");
        } else if (!isImage) {
          throw new Error("Please select a valid image file.");
        }

        const data = await uploadPhotographerImage(file);
        const mediaUrl = data?.mediaUrl || data?.imageUrl;
        if (!mediaUrl) throw new Error("Upload succeeded but media URL was not returned");

        uploadedMedia.push({
          url: mediaUrl,
          title: "",
          mediaType: data?.mediaType || (isVideo ? "video" : "image"),
          thumbnailUrl: data?.thumbnailUrl || "",
        });
      }

      if (mode === "live") {
        const patch =
          fieldName === "portfolioImages"
            ? { portfolioImages: [...(state.profile?.portfolioImages || []), ...uploadedMedia] }
            : { [fieldName]: uploadedMedia[0].url };
        const result = await updateMyPhotographerProfile(patch);
        dispatch({ type: "SET_PROFILE", payload: result.profile });
        return;
      }

      dispatch({
        type: "UPDATE_FORM_DATA",
        payload:
          fieldName === "portfolioImages"
            ? { portfolioImages: [...(state.formData.portfolioImages || []), ...uploadedMedia] }
            : { [fieldName]: uploadedMedia[0].url },
      });
    } catch (error) {
      const message = error?.message || "Image upload failed";
      dispatch({ type: "SET_ERROR", payload: message });
      if (propagateError) throw error instanceof Error ? error : new Error(message);
    } finally {
      dispatch({ type: "SET_UPLOADING_FIELD", payload: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch({ type: "SET_SUBMITTING", payload: true });
    try {
      const payload = buildProfilePayload(state.formData);
      const result = state.profile
        ? await updateMyPhotographerProfile(payload)
        : await createMyPhotographerProfile(payload);
      dispatch({ type: "SET_PROFILE", payload: result.profile });
      dispatch({ type: "SET_EDITING", payload: false });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
    } finally {
      dispatch({ type: "SET_SUBMITTING", payload: false });
    }
  };

  const handleRequestEmailVerification = async () => {
    if (!emailDraft.trim()) { setEmailError("Please enter your email first."); return; }
    setEmailError(""); setEmailMessage("");
    setEmailVerification((prev) => ({ ...prev, busy: true, message: "" }));
    try {
      const result = await requestContactVerification({ channel: "email", value: emailDraft, purpose: "update_email", authRequired: true });
      setEmailVerification({
        requestId: result?.verificationRequestId || "",
        code: "", token: "", verified: false, busy: false,
        message: "Verification code sent.", devCode: result?.devCode || "",
      });
    } catch (error) {
      setEmailError(error?.message || "Failed to send verification code.");
      setEmailVerification((prev) => ({ ...prev, busy: false }));
    }
  };

  const handleConfirmEmailVerification = async () => {
    if (!emailVerification.requestId) { setEmailError("Please request verification code first."); return; }
    if (!emailVerification.code || emailVerification.code.length !== 6) { setEmailError("Enter the 6-digit verification code."); return; }
    setEmailError("");
    setEmailVerification((prev) => ({ ...prev, busy: true, message: "" }));
    try {
      const result = await confirmContactVerification({ verificationRequestId: emailVerification.requestId, code: emailVerification.code });
      setEmailVerification((prev) => ({ ...prev, token: result?.verificationToken || "", verified: true, busy: false, message: "Contact verified successfully." }));
    } catch (error) {
      setEmailError(error?.message || "Invalid verification code.");
      setEmailVerification((prev) => ({ ...prev, busy: false }));
    }
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailMessage(""); setEmailError(""); setEmailSaving(true);
    if (!emailVerification.verified || !emailVerification.token) {
      setEmailError("Please verify the new email before updating.");
      setEmailSaving(false); return;
    }
    try {
      const result = await updateMyEmail(emailDraft, emailVerification.token);
      setEmailDraft(result?.user?.email || emailDraft);
      setEmailMessage("Account email updated successfully.");
      setEmailVerification(makeEmailVerificationState());
    } catch (error) {
      setEmailError(error?.message || "Failed to update email.");
    } finally {
      setEmailSaving(false);
    }
  };

  const handleUpdatePhone = async (e) => {
    e.preventDefault();
    setPhoneMessage(""); setPhoneError(""); setPhoneSaving(true);
    if (!phoneVerification.verified || !phoneVerification.token) {
      setPhoneError("Please verify the new phone before updating.");
      setPhoneSaving(false); return;
    }
    try {
      const result = await updateMyPhone(phoneDraft, phoneVerification.token);
      setPhoneDraft(result?.user?.phone || phoneDraft);
      setPhoneMessage("Account phone updated successfully.");
      setPhoneVerification({ token: "", verified: false });
    } catch (error) {
      setPhoneError(error?.message || "Failed to update phone.");
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleCoverSelectFromView = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    handleImageUpload("coverImageUrl", file, { mode: "live" });
  };

  const handlePortfolioFiles = useCallback(
    (files) => {
      if (!files.length) return;
      handleImageUpload("portfolioImages", files, { mode: "live" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.profile, dispatch],
  );

  const handlePortfolioSelectFromView = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    handlePortfolioFiles(files);
  };

  if (state.loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F5F3EA]">
        <p className="text-[#6B7280]">Loading profile ...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 sm:px-6 lg:px-8"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-[Georgia, Times, 'Times_New_Roman', serif] text-3xl text-[var(--text)]">
              <span className="capitalize">{user?.name || "Photographer"}</span>'s Profile
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {emailDraft || user?.email || "No email available"}
            </p>
          </div>
          {state.profile && !state.isEditing && (
            <button
              type="button"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              onClick={() => dispatch({ type: "SET_EDITING", payload: true })}
            >
              Edit Profile
            </button>
          )}
        </div>

        {state.error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{state.error}</span>
            <button type="button" className="text-sm font-semibold underline" onClick={() => dispatch({ type: "RESET_ERROR" })}>
              Dismiss
            </button>
          </div>
        )}

        {!state.profile && !state.isEditing ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
            <p className="mb-4 text-[var(--muted)]">
              Welcome, <span className="capitalize">{user?.name || "Photographer"}</span>! Create your photographer profile to start receiving bookings.
            </p>
            <button type="button" className="rounded-full bg-[var(--accent)] px-6 py-2 font-semibold text-white hover:bg-[var(--accent-hover)]"
              onClick={() => dispatch({ type: "SET_EDITING", payload: true })}>
              Create Profile
            </button>
          </div>
        ) : state.isEditing ? (
          <ProfileFormProvider state={state} dispatch={dispatch} onSubmit={handleSubmit}>
            <ProfileEditForm />
          </ProfileFormProvider>
        ) : (
          <>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelectFromView} />
            <input ref={portfolioInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handlePortfolioSelectFromView} />
            <ProfileView
              profile={state.profile}
              onProfileImageClick={handleProfileImageClick}
              isProfileImageUploading={state.uploadingField === "profileImageUrl"}
              onCoverImageClick={handleCoverImageClick}
              isCoverImageUploading={state.uploadingField === "coverImageUrl"}
              onAddGalleryClick={handleAddGalleryClick}
              onPortfolioFiles={handlePortfolioFiles}
              isPortfolioUploading={state.uploadingField === "portfolioImages"}
              onPortfolioUpdate={(updatedProfile) =>
                dispatch({ type: "SET_PROFILE", payload: updatedProfile })
              }
            />
            <ProfileImageUploader
              popup
              ref={profileUploaderRef}
              disabled={state.submitting || state.uploadingField === "profileImageUrl"}
              uploading={state.uploadingField === "profileImageUrl"}
              onConfirmUpload={(file) =>
                handleImageUpload("profileImageUrl", file, { mode: "live", propagateError: true })
              }
              onError={(message) => dispatch({ type: "SET_ERROR", payload: message })}
            />

            <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <h2 className="text-base font-semibold text-[var(--text)]">Verified Contact Updates</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                For trust and fraud prevention, email and phone changes require OTP verification before save.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <form onSubmit={handleUpdateEmail} className="rounded-xl border border-[var(--line)] bg-white p-3">
                  <p className="text-sm font-semibold text-[var(--text)]">Email</p>
                  <input type="email" value={emailDraft}
                    onChange={(e) => { setEmailDraft(e.target.value); setEmailVerification(makeEmailVerificationState()); }}
                    className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
                    required />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={handleRequestEmailVerification} disabled={emailVerification.busy}
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF] disabled:opacity-60">Send Code</button>
                    <input type="text" inputMode="numeric" maxLength={6} value={emailVerification.code}
                      onChange={(e) => setEmailVerification((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, ""), token: "", verified: false }))}
                      placeholder="6-digit code" className="w-32 rounded-lg border border-[var(--line)] px-2 py-1 text-xs" />
                    <button type="button" onClick={handleConfirmEmailVerification} disabled={emailVerification.busy}
                      className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60">Verify</button>
                  </div>
                  {emailVerification.message ? <p className="mt-2 text-xs text-emerald-700">{emailVerification.message}</p> : null}
                  {emailVerification.devCode ? <p className="mt-1 text-xs text-[var(--muted)]">Dev code: {emailVerification.devCode}</p> : null}
                  {emailMessage ? <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{emailMessage}</p> : null}
                  {emailError ? <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{emailError}</p> : null}
                  <button type="submit" disabled={emailSaving}
                    className="mt-3 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">
                    {emailSaving ? "Saving..." : "Update Email"}
                  </button>
                </form>

                <form onSubmit={handleUpdatePhone} className="rounded-xl border border-[var(--line)] bg-white p-3">
                  <p className="text-sm font-semibold text-[var(--text)]">Phone</p>
                  <input type="tel" value={phoneDraft}
                    onChange={(e) => { setPhoneDraft(e.target.value); setPhoneVerification({ token: "", verified: false }); }}
                    className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
                    required />
                  <FirebasePhoneOtp phone={phoneDraft} purpose="update_phone" userId={user?.userId}
                    onVerified={(token) => setPhoneVerification({ token, verified: true })}
                    onError={(msg) => setPhoneError(msg)} disabled={phoneSaving} hideButton />
                  {phoneMessage ? <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{phoneMessage}</p> : null}
                  {phoneError ? <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{phoneError}</p> : null}
                  <button type="submit" disabled={phoneSaving}
                    className="mt-3 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">
                    {phoneSaving ? "Saving..." : "Update Phone"}
                  </button>
                </form>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default PhotographerProfile;
