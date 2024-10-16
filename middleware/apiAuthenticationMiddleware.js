import db from "../config/db.js";

export const apiAuthentication = async (req, resp, next) => {
  const token = req.headers["access_token"];
  const riderId = req.body.rider_id;

  if (!token) {
    return resp.status(401).json({ message: 'Access Token key is missing', code: 400, data: {}, status: 0 });
  }

  if (!riderId || riderId.trim() === '') {
    return resp.status(400).json({ message: 'Rider ID is missing', code: 400, data: {}, status: 0 });
  }

  const [[result]] = await db.execute(`SELECT COUNT(*) AS count FROM riders WHERE access_token = ? AND rider_id = ?`,[token, riderId]);
  
  if (result.count === 0){
    return resp.status(401).json({ message: 'Access Denied. Invalid Access Token key', code: 401, data: {}, status: 0 });
  }

  next();
};
