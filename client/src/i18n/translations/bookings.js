// === Bookings Feature Translations ===
// Used by: Bookings.jsx, PhotographerBookingRequests.jsx

export const bookingsTranslations = {
  en: {
    labels: {
      // === Bookings.jsx form labels ===
      photographerId: "Photographer ID",
      eventType: "Event Type",
      eventDate: "Event Date",
      startTime: "Start Time",
      endTime: "End Time",
      address: "Address",
      city: "City",
      state: "State",
      pincode: "Pincode",
      deliveryNote: "Delivery note (optional)",
      customerNote: "Customer Note",
      photographer: "Photographer Name",
      customer: "Customer",
      email: "Email",
      phone: "Phone",
      location: "Location",
    },
    photographerDetails: {
      selectedPhotographer: "Selected Photographer",
      loadingPhotographer: "Loading photographer...",
      failedToLoad: "Failed to load photographer.",
      photographerFallback: "Photographer",
      locationNotSet: "Location not set",
      services: "Services",
      languages: "Languages",
      noReviews: "No Reviews",
      verified: "Verified",
      notVerified: "Not Verified",
    },
    buttons: {
      // === Bookings.jsx buttons ===
      submitting: "Submitting...",
      sendBookingRequest: "Send Booking Request",
      sendInstantBooking: "Quick Book Now",
      updating: "Updating...",
      accept: "Accept",
      reject: "Reject",
      cancel: "Cancel",
      complete: "Mark as Completed",
    },
    bookings: {
      // === Bookings.jsx - Section titles ===
      createBooking: "Create Booking",
      myBookings: "My Bookings",

      // === Bookings.jsx - Status filter options ===
      all: "All",
      pending: "Pending",
      accepted: "Accepted",
      rejected: "Rejected",
      cancelled: "Cancelled",
      completed: "Completed",
      expired: "Expired",

      // === Bookings.jsx - Empty states ===
      noBookingYet: "No Booking yet.",
      loadingBookings: "Loading...",
      loadingSlots: "Loading available slots...",
      requiredSuffix: "is required.",
      photographerIdRequired: "Photographer profile ID is required.",
      invalidDateTime: "Invalid date/time values.",
      startTimeFuture: "Booking start time must be in the future.",
      endTimeAfterStart: "End time must be greater than start time.",
      bookingRequestSent: "Booking request sent successfully.",
      instantBookingConfirmed: "Quick booking confirmed instantly!",
      failedCreateBooking: "Failed to create booking.",
      bookingFlowLabel: "Booking Type",
      normalBooking: "Normal Booking",
      quickBooking: "Quick Booking",
      quickBookingDisabled:
        "Quick booking is available only when the photographer enables instant booking.",
      bookingFlowFilterLabel: "Booking Type",
      noBookingInSelectedMode: "No bookings found for selected booking type.",
      instantBookingMode: "Instant Booking",
      normalBookingMode: "Request Booking",
      instantBadge: "Quick",
      normalBadge: "Request",
      instantModeDesc:
        "Slots from photographers with instant booking enabled are confirmed immediately.",
      normalModeDesc:
        "Send a booking request and the photographer reviews it manually.",
      allModes: "All Bookings",
      instantOnly: "Quick Only",
      normalOnly: "Request Only",
      cancellationReasonPrompt: "Cancellation reason (optional):",
      failedCancelBooking: "Failed to cancel booking.",
      failedLoadSlots: "Failed to load available slots.",
      selectedSlotRequired: "Please select an available slot first.",
      choosePhotographerFirst: "Select a valid photographer to see slots.",
      chooseDateForSlots: "Choose an event date to see available slots.",
      selectAvailableSlot: "Pick a slot from the generated availability below.",
      availableSlots: "Available Slots",
      useRecommendedDuration: "Use recommended duration",
      oneHour: "1 hour",
      twoHours: "2 hours",
      threeHours: "3 hours",
      fourHours: "4 hours",
      fiveHours: "5 hours",
      sixHours: "6 hours",
      sevenHours: "7 hours",
      eightHours: "8 hours",
      noAvailableSlots: "No slots are available for the selected date.",
      noEventTypesAvailable: "No event types available",
      slotDurationPrefix: "Slot duration:",
      minutesSuffix: "minutes",
      selectedSlotSummary: "Selected slot:",
      selectPackage: "Select a package to continue",
      packageAndPricing: "Package & Final Amount",
      packageRequired: "Please select a package before sending the booking.",
      noPackagesConfigured:
        "This photographer has not published active packages yet. You can still send a request.",
      selectedPackageLabel: "Selected package",
      selectAddOns: "Select add-ons",
      additionalAmount: "Other amount",
      additionalAmountHelp:
        "Add any extra agreed amount (travel, extra edits, or custom requests).",
      invalidAdditionalAmount: "Additional amount cannot be negative.",
      basePriceLine: "Base price",
      addOnsLine: "Add-ons",
      additionalAmountLine: "Other amount",
      finalAmountLine: "Final amount",

      // === Bookings.jsx - Booking details ===
      bookingStatus: "Status",
      photographerUnavailable: "Photographer details unavailable.",
      locationUnavailable: "Location not provided.",
      responseNote: "Response Note",
      rejectionReason: "Rejection Reason",
      cancellationReason: "Cancellation Reason",
      instantAutoAccepted: "Auto-accepted via quick booking",
    },
    photographerRequests: {
      // === PhotographerBookingRequests.jsx - Section title ===
      bookingRequests: "Booking Requests",

      // === PhotographerBookingRequests.jsx - Tab labels ===
      pendingTab: "Pending",
      historyTab: "History",

      // === PhotographerBookingRequests.jsx - Empty states ===
      noPendingRequests: "No pending requests.",
      noBookingHistory: "No booking history yet.",
      loadingRequests: "Loading requests...",

      // === PhotographerBookingRequests.jsx - handleComplete ===
      confirmMessage: "Mark this booking as completed?",
      failedMessage: "Failed to mark booking as completed.",
      completeAvailableAfter: "Available after",
      completeDateUnavailable: "end time not available",

      // === PhotographerBookingRequests.jsx - Status badges ===
      statusAccepted: "accepted",
      statusPending: "pending",
      statusRejected: "rejected",

      // === PhotographerBookingRequests.jsx - Prompts ===
      addConfirmationNote: "Add confirmation note (optional)",
      addRejectionReason: "Add rejection reason (optional)",

      // === PhotographerBookingRequests.jsx - Note label ===
      noteLabel: "Note :",
      customerUnavailable: "Customer details unavailable.",
      locationUnavailable: "Location not provided.",
      failedUpdateRequest: "Failed to update booking request.",
    },
  },
};
