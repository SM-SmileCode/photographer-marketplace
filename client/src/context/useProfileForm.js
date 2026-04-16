import { useContext } from "react";
import { ProfileFormContext } from "./ProfileFormContext";

function useProfileForm() {
  const ctx = useContext(ProfileFormContext);
  if (!ctx) {
    throw new Error("useProfileForm must be used inside ProfileFormProvider");
  }
  return ctx;
}

export default useProfileForm;
