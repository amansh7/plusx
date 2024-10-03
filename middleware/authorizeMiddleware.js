import db from "../config/db.js";

export const authorizeUser = (req, resp, next) => {
  console.log(req.body);
  const userId = req.body.userId;
  const token = req.headers["access_token"];

  if (!token) {
    return resp.status(401).json({ message: 'Access token is missing' });
  }
  
  db.execute("SELECT * from users where id=? AND access_token=?", [userId, token])
    .then(([rows]) => {
      if (rows.length === 0) {
        return resp.status(403).json({ message: "Unauthorized access" });
      }
      next();
    })
    .catch((err) => {
      console.error(err);
      resp.status(500).json({ message: "Database error" });
    });
};
