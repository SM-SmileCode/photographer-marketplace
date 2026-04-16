import React, {
  useEffect,
  useReducer,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import Cropper from "react-easy-crop";
import cropImageToPassportSize, {
  PASSPORT_ASPECT_RATIO,
} from "../utils/imageCropper";
import { useProfileTranslation } from "../i18n/useProfileTranslation";

const initialState = {
  sourceUrl: "",
  sourceName: "",
  crop: { x: 0, y: 0 },
  zoom: 1,
  croppedPixels: null,
  previewUrl: "",
  pendingFile: null,
  processing: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_SOURCE":
      return {
        ...initialState,
        sourceUrl: action.payload.url,
        sourceName: action.payload.name,
      };
    case "SET_CROP":
      return { ...state, crop: action.payload };
    case "SET_ZOOM":
      return { ...state, zoom: action.payload };
    case "SET_CROPPED_PIXELS":
      return { ...state, croppedPixels: action.payload };
    case "SET_PROCESSING":
      return { ...state, processing: action.payload };
    case "SET_PENDING":
      return {
        ...state,
        sourceUrl: "",
        sourceName: "",
        crop: { x: 0, y: 0 },
        zoom: 1,
        croppedPixels: null,
        pendingFile: action.payload.file,
        previewUrl: action.payload.previewUrl,
      };
    case "CLEAR_SOURCE":
      return {
        ...state,
        sourceUrl: "",
        sourceName: "",
        crop: { x: 0, y: 0 },
        zoom: 1,
        croppedPixels: null,
      };
    case "CLEAR_PENDING":
      return { ...state, pendingFile: null, previewUrl: "" };
    default:
      return state;
  }
}

const ProfileImageUploader = forwardRef(function ProfileImageUploader(
  { onConfirmUpload, disabled, uploading, onError, popup = false },
  ref,
) {
  const { t } = useProfileTranslation();
  const [state, dispatch] = useReducer(reducer, initialState);
  const fileInputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    openPicker: () => fileInputRef.current?.click(),
  }));
  useEffect(() => {
    return () => {
      if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
    };
  }, [state.sourceUrl]);

  useEffect(() => {
    return () => {
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    };
  }, [state.previewUrl]);

  const handleSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (!file.type?.startsWith("image/")) {
      onError?.("Please select a valid file");
      return;
    }

    dispatch({
      type: "SET_SOURCE",
      payload: { url: URL.createObjectURL(file), name: file.name },
    });
  };

  const handleApplyCrop = async () => {
    if (!state.sourceUrl || !state.croppedPixels) return;

    dispatch({ type: "SET_PROCESSING", payload: true });

    try {
      const croppedFile = await cropImageToPassportSize(
        state.sourceUrl,
        state.croppedPixels,
        state.sourceName,
      );

      const previewUrl = URL.createObjectURL(croppedFile);

      dispatch({
        type: "SET_PENDING",
        payload: { file: croppedFile, previewUrl },
      });
    } catch (error) {
      onError?.(error.message || "Failed to crop selected image");
    } finally {
      dispatch({ type: "SET_PROCESSING", payload: false });
    }
  };

  const handleConfirmUpload = async () => {
    if (!state.pendingFile) return;

    try {
      await onConfirmUpload(state.pendingFile);
      dispatch({ type: "CLEAR_PENDING" });
    } catch (error) {
      onError?.(error.message || "Upload Failed");
    }
  };

  const renderPopupPanel = (content, maxWidthClass = "max-w-2xl") => (
    <div
      className={
        popup
          ? "fixed inset-0 z-[1000] flex items-start justify-center bg-black/55 p-4 pt-24"
          : "mt-3"
      }
    >
      <div
        className={`${popup ? `w-full ${maxWidthClass}` : ""} rounded-xl border border-[var(--line)] bg-white p-3`}
      >
        {content}
      </div>
    </div>
  );
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        disabled={disabled || uploading || state.processing}
        onChange={handleSelect}
        className="hidden"
      />

      {state.sourceUrl &&
        renderPopupPanel(
          <>
            <div className="relative h-72 overflow-hidden rounded-lg bg-black">
              <Cropper
                image={state.sourceUrl}
                crop={state.crop}
                zoom={state.zoom}
                aspect={PASSPORT_ASPECT_RATIO}
                minZoom={1}
                maxZoom={3}
                showGrid={false}
                onCropChange={(next) =>
                  dispatch({ type: "SET_CROP", payload: next })
                }
                onZoomChange={(next) =>
                  dispatch({ type: "SET_ZOOM", payload: next })
                }
                onCropComplete={(_, pixels) =>
                  dispatch({ type: "SET_CROPPED_PIXELS", payload: pixels })
                }
              />
            </div>

            <div className="mt-3">
              <label className="form-label text-[var(--text)]">
                {t("labels.zoom")}
              </label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={state.zoom}
                onChange={(e) =>
                  dispatch({
                    type: "SET_ZOOM",
                    payload: Number(e.target.value),
                  })
                }
                className="w-full accent-[var(--accent)]"
              />
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleApplyCrop}
                disabled={
                  disabled ||
                  uploading ||
                  state.processing ||
                  !state.croppedPixels
                }
                className="form-btn bg-[var(--accent)] text-white "
              >
                {state.processing
                  ? t("buttons.processing")
                  : t("buttons.applyCrop")}
              </button>

              <button
                type="button"
                onClick={() => dispatch({ type: "CLEAR_SOURCE" })}
                disabled={state.processing}
                className="form-btn border border-[var(--line)] text-[var(--text)]"
              >
                {t("buttons.cancel")}
              </button>
            </div>
          </>,
        )}

      {state.previewUrl &&
        renderPopupPanel(
          <>
            <div className="mx-auto max-w-[220px] overflow-hidden rounded-lg border border-[var(--line)]">
              <div className="aspect-[35/45]">
                <img
                  src={state.previewUrl}
                  alt="Cropped Preview"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={handleConfirmUpload}
                disabled={disabled || uploading || state.processing}
                className="form-btn bg-[var(--accent)] text-white"
              >
                {uploading
                  ? t("buttons.uploading")
                  : t("buttons.confirmUpload")}
              </button>

              <button
                type="button"
                onClick={() => dispatch({ type: "CLEAR_PENDING" })}
                className="form-btn border border-[var(--line)] text-[var(--text)]"
              >
                {t("buttons.remove")}
              </button>
            </div>
          </>,
        )}
    </>
  );
});

export default ProfileImageUploader;
