import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const authenticateUser = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: "Invalid Authorization key" });

  if (token !== process.env.CUSTOM_TOKEN) {
    return res.status(401).json({ message: "Unauthorized. Invalid token." });
  }
  next();

  // jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
  //   if (err) {
  //     console.error("Token verification error:", err.message);
  //     return res.status(403).json({ message: 'Invalid token', error: err.message });
  //   }
  //   req.user = user;
  //   next();
  // });
};
