import { createContext } from "react";

const ProfileFormContext = createContext(null);

export function ProfileFormProvider({ state, dispatch, onSubmit, children }) {
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;

    let finalValue = value;
    if (type === "number") {
      finalValue = value ? Number(value) : "";
    }

    dispatch({
      type: "UPDATE_FORM_DATA",
      payload: { [name]: finalValue },
    });
  };

  const handleArrayChange = (name, values) => {
    dispatch({
      type: "UPDATE_FORM_DATA",
      payload: { [name]: values },
    });
  };

  const handleCsvChange = (name, value) => {
    const values = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    handleArrayChange(name, values);
  };

  const handleLocationCoordinateChange = (index, value) => {
    const current = state.formData.location?.coordinates || ["", ""];
    const next = [...current];
    next[index] = value === "" ? "" : Number(value);

    dispatch({
      type: "UPDATE_FORM_DATA",
      payload: {
        location: {
          type: "Point",
          coordinates: next,
        },
      },
    });
  };

  const handleSubmit = async (e) => {
    if (!onSubmit) return;

    await onSubmit(e);
  };

  return (
    <ProfileFormContext.Provider
      value={{
        state,
        dispatch,
        handleInputChange,
        handleArrayChange,
        handleCsvChange,
        handleLocationCoordinateChange,
        handleSubmit,
      }}
    >
      {children}
    </ProfileFormContext.Provider>
  );
}

export { ProfileFormContext };
