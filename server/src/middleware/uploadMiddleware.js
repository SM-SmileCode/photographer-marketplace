import multer from "multer";

const storage = multer.memoryStorage();

const mediaFileFilter = (req, file, cb) => {
  const ok =
    file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");

  if (ok) cb(null, true);
  else cb(new Error("Only image/video files are allowed"));
};

const upload = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

export default upload;
