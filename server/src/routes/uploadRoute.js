import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import { uploadImageBuffer } from "../utils/uploadImageBuffer.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

router.post(
  "/photographer/upload",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.user || req.user.role !== "photographer") {
        return res.status(403).json({ error: "forbidden" });
      }

      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const result = await uploadImageBuffer(req.file.buffer);
      const mediaType = result.resource_type === "video" ? "video" : "image";

      const thumbnailUrl =
        mediaType === "video"
          ? cloudinary.url(result.public_id, {
              resource_type: "video",
              secure: true,
              format: "jpg",
              transformation: [
                {
                  width: 960,
                  crop: "limit",
                  quality: "auto",
                  start_offset: "1",
                },
              ],
            })
          : result.secure_url;

      return res.status(200).json({
        success: true,
        mediaType,
        mediaUrl: result.secure_url,
        imageUrl: result.secure_url,
        thumbnailUrl,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
      });
    } catch (error) {
      return res.status(500).json({ error: "Media upload failed" });
    }
  },
);

router.post(
  "/user/upload",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const result = await uploadImageBuffer(req.file.buffer, "shotsphere/users");

      return res.status(200).json({
        success: true,
        imageUrl: result.secure_url,
      });
    } catch (error) {
      return res.status(500).json({ error: "Image upload failed" });
    }
  },
);

export default router;
