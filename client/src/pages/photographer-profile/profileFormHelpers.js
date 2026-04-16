export function buildProfilePayload(formData) {
  const rawCoords = formData.location?.coordinates;
  const normalizedCoordinates =
    Array.isArray(rawCoords) && rawCoords.length === 2
      ? rawCoords.map((v) =>
          v === "" || v == null || Number.isNaN(Number(v)) ? 0 : Number(v),
        )
      : [0, 0];

  return {
    businessName: formData.businessName,
    city: formData.city,
    state: formData.state,
    startingPrice: Number(formData.startingPrice),
    location: {
      type: "Point",
      coordinates: normalizedCoordinates,
    },
    bio: formData.bio || "",
    address: formData.address || "",
    experienceYears: formData.experienceYears
      ? Number(formData.experienceYears)
      : 0,
    currency: formData.currency || "INR",
    eventTypes: formData.eventTypes || [],
    customEventTypes: formData.customEventTypes || [],
    services: formData.services || [],
    customServices: formData.customServices || [],
    profileImageUrl: formData.profileImageUrl || "",
    coverImageUrl: formData.coverImageUrl || "",
    portfolioImages: formData.portfolioImages || [],
    serviceRadiusKm: formData.serviceRadiusKm
      ? Number(formData.serviceRadiusKm)
      : 0,
    serviceAreas: formData.serviceAreas || [],
    languages: formData.languages || [],
    instagramUrl: formData.instagramUrl || "",
    websiteUrl: formData.websiteUrl || "",
    verificationEvidence: {
      identityDocumentUrl:
        formData.verificationEvidence?.identityDocumentUrl || "",
      selfieWithIdUrl: formData.verificationEvidence?.selfieWithIdUrl || "",
      livenessVideoUrl: formData.verificationEvidence?.livenessVideoUrl || "",
      businessLicenseUrl: formData.verificationEvidence?.businessLicenseUrl || "",
      addressProofUrl: formData.verificationEvidence?.addressProofUrl || "",
      gstNumber: formData.verificationEvidence?.gstNumber || "",
      originalSampleFileUrls: (
        formData.verificationEvidence?.originalSampleFileUrls || []
      )
        .map((item) => String(item || "").trim())
        .filter(Boolean),
      exifEvidenceNote: formData.verificationEvidence?.exifEvidenceNote || "",
      reverseImageCheckNote:
        formData.verificationEvidence?.reverseImageCheckNote || "",
    },
    responseTimeMinutes:
      formData.responseTimeMinutes === "" ||
      formData.responseTimeMinutes == null
        ? null
        : Number(formData.responseTimeMinutes),
    acceptanceRate:
      formData.acceptanceRate === "" || formData.acceptanceRate == null
        ? null
        : Number(formData.acceptanceRate),
  };
}
