import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306
});

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to the MySQL database.");
    connection.release();
  } catch (err) {
    console.error("Error connecting to the database:", err);
  }
};

testConnection();

export const startTransaction = async () => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return connection;
};

export const commitTransaction = async (connection) => {
  await connection.commit();
  connection.release();
};

export const rollbackTransaction = async (connection) => {
  await connection.rollback();
  connection.release();
};

export default pool;
