import jwt from "jsonwebtoken";
import UserCollection from "../models/UserModel.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await UserCollection.findById(decoded.userId)
      .select(
        "_id name email phone role isBlocked isEmailVerified isPhoneVerified emailVerifiedAt phoneVerifiedAt profileImageUrl",
      )
      .lean();

    if (!user || user.isBlocked) {
      return res.status(401).json({ error: "unauthorized" });
    }

    req.user = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isEmailVerified: Boolean(user.isEmailVerified),
      isPhoneVerified: Boolean(user.isPhoneVerified),
      emailVerifiedAt: user.emailVerifiedAt || null,
      phoneVerifiedAt: user.phoneVerifiedAt || null,
      profileImageUrl: user.profileImageUrl || "",
    };
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}
