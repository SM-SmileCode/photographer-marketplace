import { Readable } from "stream";
import cloudinary from "../config/cloudinary.js";

export function uploadImageBuffer(buffer, folder = "shotsphere/photographers") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
    Readable.from(buffer).pipe(stream);
  });
}
