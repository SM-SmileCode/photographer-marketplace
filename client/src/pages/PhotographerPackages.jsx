import { useReducer } from "react";
import { pageThemeVars } from "../styles/themeVars";
import { useListData } from "../hooks/useListData";
import {
  createPackage,
  deletePackage,
  fetchMyPackages,
  updatePackage,
} from "../services/packageService";
import { usePackagesTranslation } from "../i18n/usePackagesTranslation";

const INCLUDES_OPTIONS = [
  "candid photos",
  "traditional photos",
  "highlight video",
  "album",
  "drone shots",
  "reels",
  "same day edit",
  "raw files",
];

function emptyForm() {
  return {
    name: "",
    description: "",
    basePrice: "",
    currency: "INR",
    hoursIncluded: "",
    photosIncluded: "",
    deliveryDays: "",
    includes: [],
    addOns: [],
    extraHourPrice: "",
    travelCostPerKm: "",
    isActive: true,
  };
}

function emptyAddOn() {
  return { name: "", price: "" };
}

function packageToForm(pkg) {
  return {
    name: pkg.name ?? "",
    description: pkg.description ?? "",
    basePrice: pkg.basePrice ?? "",
    currency: pkg.currency ?? "INR",
    hoursIncluded: pkg.hoursIncluded ?? "",
    photosIncluded: pkg.photosIncluded ?? "",
    deliveryDays: pkg.deliveryDays ?? "",
    includes: pkg.includes ?? [],
    addOns: (pkg.addOns ?? []).map((a) => ({ name: a.name, price: a.price })),
    extraHourPrice: pkg.extraHourPrice ?? "",
    travelCostPerKm: pkg.travelCostPerKm ?? "",
    isActive: pkg.isActive ?? true,
  };
}

function formToPayload(form) {
  const normalizedAddOns = form.addOns
    .map((addOn) => ({
      name: String(addOn?.name || "").trim(),
      price: Number(addOn?.price),
    }))
    .filter((addOn) => addOn.name)
    .map((addOn) => ({
      name: addOn.name,
      price: Number.isFinite(addOn.price) && addOn.price >= 0 ? addOn.price : 0,
    }));

  return {
    name: form.name.trim(),
    description: form.description.trim(),
    basePrice: Number(form.basePrice),
    currency: form.currency.trim().toUpperCase(),
    hoursIncluded: Number(form.hoursIncluded),
    photosIncluded:
      form.photosIncluded !== "" ? Number(form.photosIncluded) : null,
    deliveryDays: Number(form.deliveryDays),
    includes: form.includes,
    addOns: normalizedAddOns,
    extraHourPrice:
      form.extraHourPrice !== "" ? Number(form.extraHourPrice) : null,
    travelCostPerKm:
      form.travelCostPerKm !== "" ? Number(form.travelCostPerKm) : null,
    isActive: form.isActive,
  };
}

const initialState = {
  form: emptyForm(),
  editingId: null,
  submitting: false,
  deletingId: null,
  error: "",
  ok: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FORM_FIELD":
      return {
        ...state,
        form: { ...state.form, [action.payload.name]: action.payload.value },
      };
    case "SET_INCLUDES":
      return { ...state, form: { ...state.form, includes: action.payload } };
    case "SET_ADDONS":
      return { ...state, form: { ...state.form, addOns: action.payload } };
    case "EDIT":
      return {
        ...state,
        editingId: action.payload._id,
        form: packageToForm(action.payload),
        error: "",
        ok: "",
      };
    case "RESET":
      return {
        ...state,
        editingId: null,
        form: emptyForm(),
        error: "",
        ok: "",
      };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: "", ok: "" };
    case "SUBMIT_END":
      return { ...state, submitting: false };
    case "DELETE_START":
      return { ...state, deletingId: action.payload, error: "" };
    case "DELETE_END":
      return { ...state, deletingId: null };
    case "SET_ERROR":
      return { ...state, error: action.payload, ok: "" };
    case "SET_OK":
      return { ...state, ok: action.payload, error: "" };
    default:
      return state;
  }
}

function PhotographerPackages() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { t } = usePackagesTranslation();

  const {
    items: packages,
    loading,
    error: listError,
    reload,
  } = useListData(
    () => fetchMyPackages().then((d) => ({ items: d.packages ?? [] })),
    [],
  );

  const handleField = (e) => {
    const { name, value, type, checked } = e.target;
    dispatch({
      type: "SET_FORM_FIELD",
      payload: { name, value: type === "checkbox" ? checked : value },
    });
  };

  const toggleInclude = (item) => {
    const current = state.form.includes;
    dispatch({
      type: "SET_INCLUDES",
      payload: current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item],
    });
  };

  const handleAddOnChange = (index, field, value) => {
    const updated = state.form.addOns.map((a, i) =>
      i === index ? { ...a, [field]: value } : a,
    );
    dispatch({
      type: "SET_ADDONS",
      payload: updated,
    });
  };

  const addAddOn = () => {
    dispatch({
      type: "SET_ADDONS",
      payload: [...state.form.addOns, emptyAddOn()],
    });
  };

  const removeAddOn = (index) => {
    dispatch({
      type: "SET_ADDONS",
      payload: state.form.addOns.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch({
      type: "SUBMIT_START",
    });
    try {
      const payload = formToPayload(state.form);

      if (state.editingId) {
        await updatePackage(state.editingId, payload);
        dispatch({
          type: "SET_OK",
          payload: t("packages.packageUpdated"),
        });
      } else {
        await createPackage(payload);
        dispatch({
          type: "SET_OK",
          payload: t("packages.packageCreated"),
        });
      }

      dispatch({ type: "RESET" });
      await reload();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error.message || t("packages.failedSave"),
      });
    } finally {
      dispatch({
        type: "SUBMIT_END",
      });
    }
  };

  const handleDelete = async (packageId) => {
    if (!window.confirm(t("packages.confirmDelete"))) return;
    dispatch({
      type: "DELETE_START",
      payload: packageId,
    });

    try {
      await deletePackage(packageId);
      await reload();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error.message || t("packages.failedDelete"),
      });
    } finally {
      dispatch({
        type: "DELETE_END",
      });
    }
  };
  return (
    <div
      className="mx-auto max-w-4xl space-y-6 px-4 py-8"
      style={pageThemeVars}
    >
      <section>
        <h1 className="text-xl font-semibold text-[var(--text)]">
          {state.editingId ? t("packages.editTitle") : t("packages.createTitle")}
        </h1>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="name"
              value={state.form.name}
              onChange={handleField}
              placeholder={t("packageLabels.name")}
              required
              maxLength={100}
              className="form-input border-[var(--line)]"
            />
            <input
              name="currency"
              value={state.form.currency}
              onChange={handleField}
              placeholder={t("packageLabels.currency")}
              maxLength={3}
              className="form-input border-[var(--line)]"
            />
            <input
              type="number"
              name="basePrice"
              value={state.form.basePrice}
              onChange={handleField}
              placeholder={t("packageLabels.basePrice")}
              required
              min={0}
              className="form-input border-[var(--line)]"
            />
            <input
              type="number"
              name="hoursIncluded"
              value={state.form.hoursIncluded}
              onChange={handleField}
              placeholder={t("packageLabels.hoursIncluded")}
              required
              min={0.5}
              step={0.5}
              className="form-input border-[var(--line)]"
            />
            <input
              type="number"
              name="photosIncluded"
              value={state.form.photosIncluded}
              onChange={handleField}
              placeholder={t("packageLabels.photosIncluded")}
              min={0}
              className="form-input border-[var(--line)]"
            />
            <input
              type="number"
              name="deliveryDays"
              value={state.form.deliveryDays}
              onChange={handleField}
              placeholder={t("packageLabels.deliveryDays")}
              required
              min={1}
              className="form-input border-[var(--line)]"
            />
            <input
              type="number"
              name="extraHourPrice"
              value={state.form.extraHourPrice}
              onChange={handleField}
              placeholder={t("packageLabels.extraHourPrice")}
              min={0}
              className="form-input border-[var(--line)]"
            />
            <input
              type="number"
              name="travelCostPerKm"
              value={state.form.travelCostPerKm}
              onChange={handleField}
              placeholder={t("packageLabels.travelCostPerKm")}
              min={0}
              className="form-input border-[var(--line)]"
            />
          </div>
          <textarea
            name="description"
            value={state.form.description}
            onChange={handleField}
            placeholder={t("packageLabels.description")}
            rows={3}
            maxLength={1000}
            className="form-input border-[var(--line)] w-full"
          />

          <div>
            <p className="label-uppercase mb-2">
              {t("packages.whatsIncluded")}
            </p>
            <div className="flex flex-wrap gap-2">
              {INCLUDES_OPTIONS.map((item) => (
                <label
                  key={item}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm text-[var(--text)]"
                >
                  <input
                    type="checkbox"
                    checked={state.form.includes.includes(item)}
                    onChange={() => toggleInclude(item)}
                  />
                  <span className="capitalize">{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="label-uppercase mb-2">{t("packages.addOns")}</p>
            <div className="space-y-2">
              {state.form.addOns.map((addOn, index) => (
                <div
                  key={index}
                  className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
                >
                  <input
                    name={`addOnName-${index}`}
                    value={addOn.name}
                    onChange={(e) =>
                      handleAddOnChange(index, "name", e.target.value)
                    }
                    placeholder={t("packageLabels.addOnName")}
                    maxLength={100}
                    className="form-input border-[var(--line)]"
                  />
                  <input
                    type="number"
                    name={`addOnPrice-${index}`}
                    value={addOn.price}
                    onChange={(e) =>
                      handleAddOnChange(index, "price", e.target.value)
                    }
                    placeholder={t("packageLabels.addOnPrice")}
                    min={0}
                    step={1}
                    className="form-input border-[var(--line)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeAddOn(index)}
                    className="btn-secondary"
                  >
                    {t("packageButtons.remove")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAddOn}
                className="btn-secondary"
              >
                {t("packageButtons.addAddOn")}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]">
            <input
              type="checkbox"
              name="isActive"
              checked={state.form.isActive}
              onChange={handleField}
            />
            {t("packages.activeLabel")}
          </label>

          {state.error && (
            <p className="text-sm text-red-600 ">{state.error}</p>
          )}
          {state.ok && <p className="text-sm text-emerald-700 ">{state.ok}</p>}

          <div className="flex flex-wrap justify-end gap-3">
            {state.editingId && (
              <button
                type="button"
                onClick={() => dispatch({ type: "RESET" })}
                className="btn-secondary"
              >
                {t("packageButtons.cancel")}
              </button>
            )}
            <button
              type="submit"
              disabled={state.submitting}
              className="btn-primary disabled:opacity-70"
            >
              {state.submitting
                ? t("packageButtons.save")
                : state.editingId
                  ? t("packageButtons.update")
                  : t("packageButtons.create")}
            </button>
          </div>
        </form>
      </section>

      <section className="card-surface">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">
          Your Packages
        </h2>

        {loading && (
          <p className="text-sm text-[var(--muted)]">{t("packages.loading")}</p>
        )}
        {listError && <p className="text-sm text-red-600">{listError}</p>}
        {!loading && !packages.length && (
          <p className="text-sm text-[var(--muted)] ">
            {t("packages.noPackages")}
          </p>
        )}

        <div className="space-y-3">
          {packages.map((pkg) => (
            <article key={pkg._id} className="card-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text)]">{pkg.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {pkg.currency} {Number(pkg.basePrice || 0).toLocaleString("en-IN")} .{" "}
                    {pkg.hoursIncluded}h .{pkg.deliveryDays} day
                    {pkg.deliveryDays !== 1 ? "s" : ""}{" "}
                    {t("packages.deliverySuffix")}
                  </p>
                  {pkg.description && (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {pkg.description}
                    </p>
                  )}
                  {pkg.includes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {pkg.includes.map((item) => (
                        <span
                          key={item}
                          className="badge-tag text-xs capitalize"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  {pkg.addOns.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Add-ons:
                      {pkg.addOns
                        .map((a) => `${a.name} (+${pkg.currency} ${a.price})`)
                        .join(", ")}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`badge-status text-xs ${
                      pkg.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {pkg.isActive
                      ? t("packageStatus.active")
                      : t("packageStatus.inactive")}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "EDIT", payload: pkg })}
                    className="btn-secondary"
                  >
                    {t("packageButtons.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pkg._id)}
                    disabled={state.deletingId === pkg._id}
                    className="btn-secondary disabled:opacity-60"
                  >
                    {state.deletingId === pkg._id
                      ? t("packageButtons.deleting")
                      : t("packageButtons.delete")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default PhotographerPackages;
