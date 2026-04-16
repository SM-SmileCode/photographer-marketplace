import { useState } from "react";
import useProfileForm from "../../context/useProfileForm";
import { useProfileTranslation } from "../../i18n/useProfileTranslation";

function ProfileEditForm() {
  const { t } = useProfileTranslation();
  const {
    state,
    dispatch,
    handleInputChange,
    handleArrayChange,
    handleSubmit,
  } = useProfileForm();
  const [languagesInputDraft, setLanguagesInputDraft] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [geoLabel, setGeoLabel] = useState("");
  const verificationEvidence = state.formData.verificationEvidence || {};

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError("");
    setGeoLabel("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        dispatch({
          type: "UPDATE_FORM_DATA",
          payload: {
            location: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
          },
        });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          );
          const data = await res.json();
          const addr = data?.address || {};
          const label = [
            addr.suburb || addr.neighbourhood || addr.village,
            addr.city || addr.town || addr.county,
            addr.state,
          ]
            .filter(Boolean)
            .join(", ");
          setGeoLabel(label || "Location detected");
        } catch {
          setGeoLabel("Location detected");
        }
        setGeoLoading(false);
      },
      () => {
        setGeoError(
          "Unable to retrieve location. Please allow location access.",
        );
        setGeoLoading(false);
      },
    );
  };

  const handleVerificationEvidenceChange = (field, value) => {
    dispatch({
      type: "UPDATE_FORM_DATA",
      payload: {
        verificationEvidence: {
          ...verificationEvidence,
          [field]: value,
        },
      },
    });
  };

  const handleOriginalSampleFilesChange = (value) => {
    const originalSampleFileUrls = String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    handleVerificationEvidenceChange(
      "originalSampleFileUrls",
      originalSampleFileUrls,
    );
  };

  const parseLanguageInput = (value) => {
    const seen = new Set();
    return String(value || "")
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter((item) => {
        if (!item) return false;
        const normalized = item.toLowerCase();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
  };

  const commitLanguagesInput = (value) => {
    const items = parseLanguageInput(value);
    handleArrayChange("languages", items);
  };
  const languagesInputValue =
    languagesInputDraft !== null
      ? languagesInputDraft
      : (state.formData.languages || []).join(", ");

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_EDITING", payload: false })}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[#F2EEDF]"
        >
          ← Back to Profile
        </button>
      </div>
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-8"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Required Fields */}
            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.businessName")}
              </label>
              <input
                type="text"
                name="businessName"
                value={state.formData.businessName || ""}
                onChange={handleInputChange}
                required
                maxLength="120"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.startingPrice")}
              </label>
              <input
                type="number"
                name="startingPrice"
                value={state.formData.startingPrice ?? ""}
                onChange={handleInputChange}
                required
                min="0"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.city")}
              </label>
              <input
                type="text"
                name="city"
                value={state.formData.city || ""}
                onChange={handleInputChange}
                required
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.state")}
              </label>
              <input
                type="text"
                name="state"
                value={state.formData.state || ""}
                onChange={handleInputChange}
                required
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.bio")}
              </label>
              <textarea
                name="bio"
                value={state.formData.bio || ""}
                onChange={handleInputChange}
                rows="4"
                maxLength="2000"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.address")}
              </label>
              <input
                type="text"
                name="address"
                value={state.formData.address || ""}
                onChange={handleInputChange}
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="form-label text-[var(--text)]">Location</label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={geoLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {geoLoading ? "Detecting..." : "📍 Use My Current Location"}
                </button>
                {!geoError && geoLabel ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text)]">
                    📍 {geoLabel}
                  </span>
                ) : null}
                {geoError ? (
                  <p className="text-xs text-red-600">{geoError}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.experience")}
              </label>
              <input
                type="number"
                name="experienceYears"
                value={state.formData.experienceYears ?? ""}
                onChange={handleInputChange}
                min="0"
                max="80"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.currency")}
              </label>
              <input
                type="text"
                name="currency"
                value={state.formData.currency || ""}
                onChange={handleInputChange}
                maxLength="3"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.language")}
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={languagesInputValue}
                  onFocus={() => {
                    if (languagesInputDraft === null) {
                      setLanguagesInputDraft(
                        (state.formData.languages || []).join(", "),
                      );
                    }
                  }}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLanguagesInputDraft(value);
                    commitLanguagesInput(value);
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    commitLanguagesInput(value);
                    setLanguagesInputDraft(null);
                  }}
                  placeholder="English, Spanish, French"
                  className="form-input border-[var(--line)] text-[var(--text)]"
                />
                <p className="text-xs text-[var(--muted)]">
                  Use comma (,) or semicolon (;) to separate languages
                </p>
                {state.formData.languages &&
                  state.formData.languages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {state.formData.languages.map((lang, index) => (
                        <span
                          key={`${lang}-${index}`}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium text-[var(--accent)]"
                        >
                          {lang}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = state.formData.languages.filter(
                                (l) => l !== lang,
                              );
                              handleArrayChange("languages", updated);
                            }}
                            className="ml-1 hover:opacity-70"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.serviceRadius")}
              </label>
              <input
                type="number"
                name="serviceRadiusKm"
                value={state.formData.serviceRadiusKm ?? ""}
                onChange={handleInputChange}
                min="0"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.responseTime")}
              </label>
              <input
                type="number"
                name="responseTimeMinutes"
                value={state.formData.responseTimeMinutes ?? ""}
                onChange={handleInputChange}
                min="0"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.acceptanceRate")}
              </label>
              <input
                type="number"
                name="acceptanceRate"
                value={state.formData.acceptanceRate ?? ""}
                onChange={handleInputChange}
                min="0"
                max="100"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.serviceAreas")}
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={(state.formData.serviceAreas || []).join("; ")}
                  onInput={(e) => {
                    const value = e.target.value;
                    const items = value
                      .split(/[;]/)
                      .map((item) => item.trim())
                      .filter(Boolean);
                    handleArrayChange("serviceAreas", items);
                  }}
                  onChange={(e) => {
                    const value = e.target.value;
                    const items = value
                      .split(/[;]/)
                      .map((item) => item.trim())
                      .filter(Boolean);
                    handleArrayChange("serviceAreas", items);
                  }}
                  placeholder="Downtown; Suburbs; Waterfront"
                  className="form-input border-[var(--line)] text-[var(--text)]"
                />
                <p className="text-xs text-[var(--muted)]">
                  Use semicolon (;) to separate areas
                </p>
                {state.formData.serviceAreas &&
                  state.formData.serviceAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {state.formData.serviceAreas.map((area, index) => (
                        <span
                          key={`${area}-${index}`}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium text-[var(--accent)]"
                        >
                          {area}
                          <button
                            type="button"
                            onClick={() => {
                              const updated =
                                state.formData.serviceAreas.filter(
                                  (a) => a !== area,
                                );
                              handleArrayChange("serviceAreas", updated);
                            }}
                            className="ml-1 hover:opacity-70"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.instagramUrl")}
              </label>
              <input
                type="url"
                name="instagramUrl"
                value={state.formData.instagramUrl || ""}
                onChange={handleInputChange}
                placeholder="https://instagram.com/yourhandle"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="form-label text-[var(--text)]">
                {t("labels.websiteUrl")}
              </label>
              <input
                type="url"
                name="websiteUrl"
                value={state.formData.websiteUrl || ""}
                onChange={handleInputChange}
                placeholder="https://yourwebsite.com"
                className="form-input border-[var(--line)] text-[var(--text)]"
              />
            </div>

            {state.config?.options?.eventTypes && (
              <div>
                <label className="form-label text-[var(--text)]">
                  {t("labels.eventTypes")}
                </label>
                <div className="form-config">
                  {state.config.options.eventTypes.map((type) => (
                    <label
                      key={type}
                      className="form-config-label border-[var(--line)] text-[var(--text)]"
                    >
                      <input
                        type="checkbox"
                        checked={
                          state.formData.eventTypes?.includes(type) || false
                        }
                        onChange={(e) => {
                          const current = state.formData.eventTypes || [];
                          const updated = e.target.checked
                            ? [...current, type]
                            : current.filter((t) => t !== type);
                          handleArrayChange("eventTypes", updated);
                        }}
                      />
                      <span className="capitalize">{type}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="form-label text-[var(--text)]">
                    {t("labels.customEventTypes")}
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={(state.formData.customEventTypes || []).join("; ")}
                      onInput={(e) => {
                        const value = e.target.value;
                        const items = value
                          .split(/[;]/)
                          .map((item) => item.trim())
                          .filter(Boolean);
                        handleArrayChange("customEventTypes", items);
                      }}
                      onChange={(e) => {
                        const value = e.target.value;
                        const items = value
                          .split(/[;]/)
                          .map((item) => item.trim())
                          .filter(Boolean);
                        handleArrayChange("customEventTypes", items);
                      }}
                      placeholder="Fashion Show; Product Launch"
                      className="form-input border-[var(--line)] text-[var(--text)]"
                    />
                    <p className="text-xs text-[var(--muted)]">
                      Use semicolon (;) to separate event types
                    </p>
                    {state.formData.customEventTypes &&
                      state.formData.customEventTypes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {state.formData.customEventTypes.map(
                            (type, index) => (
                              <span
                                key={`${type}-${index}`}
                                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700"
                              >
                                {type}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated =
                                      state.formData.customEventTypes.filter(
                                        (t) => t !== type,
                                      );
                                    handleArrayChange(
                                      "customEventTypes",
                                      updated,
                                    );
                                  }}
                                  className="ml-1 hover:opacity-70"
                                >
                                  &times;
                                </button>
                              </span>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}

            {state.config?.options?.services && (
              <div>
                <label className="form-label text-[var(--text)]">
                  {t("labels.services")}
                </label>

                <div className="form-config">
                  {state.config.options.services.map((service) => (
                    <label
                      key={service}
                      className="form-config-label border-[var(--line)] text-[var(--text)]"
                    >
                      <input
                        type="checkbox"
                        checked={
                          state.formData.services?.includes(service) || false
                        }
                        onChange={(e) => {
                          const current = state.formData.services || [];
                          const updated = e.target.checked
                            ? [...current, service]
                            : current.filter((s) => s !== service);
                          handleArrayChange("services", updated);
                        }}
                      />
                      <span className="capitalize">{service}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="form-label text-[var(--text)]">
                    {t("labels.customServices")}
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={(state.formData.customServices || []).join("; ")}
                      onInput={(e) => {
                        const value = e.target.value;
                        const items = value
                          .split(/[;]/)
                          .map((item) => item.trim())
                          .filter(Boolean);
                        handleArrayChange("customServices", items);
                      }}
                      onChange={(e) => {
                        const value = e.target.value;
                        const items = value
                          .split(/[;]/)
                          .map((item) => item.trim())
                          .filter(Boolean);
                        handleArrayChange("customServices", items);
                      }}
                      placeholder="360 Video; Drone Shots"
                      className="form-input border-[var(--line)] text-[var(--text)]"
                    />
                    <p className="text-xs text-[var(--muted)]">
                      Use semicolon (;) to separate services
                    </p>
                    {state.formData.customServices &&
                      state.formData.customServices.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {state.formData.customServices.map(
                            (service, index) => (
                              <span
                                key={`${service}-${index}`}
                                className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700"
                              >
                                {service}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated =
                                      state.formData.customServices.filter(
                                        (s) => s !== service,
                                      );
                                    handleArrayChange(
                                      "customServices",
                                      updated,
                                    );
                                  }}
                                  className="ml-1 hover:opacity-70"
                                >
                                  &times;
                                </button>
                              </span>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}

            <div className="col-span-full rounded-xl border border-[var(--line)] bg-white p-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Verification Evidence
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Upload evidence links used in photographer trust verification.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-[var(--text)]">
                    Government ID URL
                  </label>
                  <input
                    type="url"
                    value={verificationEvidence.identityDocumentUrl || ""}
                    onChange={(e) =>
                      handleVerificationEvidenceChange(
                        "identityDocumentUrl",
                        e.target.value,
                      )
                    }
                    placeholder="https://..."
                    className="form-input border-[var(--line)] text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="form-label text-[var(--text)]">
                    Selfie with ID URL
                  </label>
                  <input
                    type="url"
                    value={verificationEvidence.selfieWithIdUrl || ""}
                    onChange={(e) =>
                      handleVerificationEvidenceChange(
                        "selfieWithIdUrl",
                        e.target.value,
                      )
                    }
                    placeholder="https://..."
                    className="form-input border-[var(--line)] text-[var(--text)]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label text-[var(--text)]">
                    Original Sample File URLs (comma separated)
                  </label>
                  <input
                    type="text"
                    value={(
                      verificationEvidence.originalSampleFileUrls || []
                    ).join(", ")}
                    onChange={(e) =>
                      handleOriginalSampleFilesChange(e.target.value)
                    }
                    placeholder="https://sample-raw-1.jpg, https://sample-raw-2.cr2"
                    className="form-input border-[var(--line)] text-[var(--text)]"
                  />
                </div>
              </div>
            </div>

            <div className="col-span-full mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="submit"
                disabled={state.submitting}
                className="form-btn bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {state.submitting
                  ? t("buttons.saving")
                  : t("buttons.saveProfile")}
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "SET_EDITING", payload: false })
                }
                className="form-btn border border-[var(--line)] text-[var(--text)]"
              >
                {t("buttons.cancel")}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

export default ProfileEditForm;
