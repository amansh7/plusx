import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const authenticateRsaUser = (req, resp, next) => {
  const riderId = req.body.userId;
  const token = req.headers["access_token"];

  if (!token) {
    return resp.status(401).json({ message: 'Access token is missing', code: 400, data: [{}], status:0 });
  }
  
  db.execute("SELECT * from rsa where rsa_id=? AND access_token=?", [riderId, token])
    .then(([rows]) => {
      if (rows.length === 0) {
        return resp.status(401).json({ message: 'Access Denied. Invalid Access Token key', code: 400, data: [{}], status:0 });
      }
      next();
    })
    .catch((err) => {
      console.error(err);
      resp.status(500).json({ message: "Database error" });
    });
};
