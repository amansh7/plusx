import db from "./config/db.js";

/**
 * Inserts a new record into the specified table.
 *
 * @param {string} table - The name of the table to insert into.
 * @param {Array<string>} columns - An array of column names.
 * @param {Array<any>} values - An array of values corresponding to the columns.
 * @returns {Promise<Object>} - The result of the insert operation.
 */
export const insertRecord = async (table, columns, values) => {
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(
    ", "
  )}) VALUES (${placeholders})`;

  try {
    const [result] = await db.execute(sql, values);
    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
      data: Object.fromEntries(
        columns.map((col, index) => [col, values[index]])
      ),
    };
  } catch (error) {
    throw new Error(`Insert operation failed: ${error.message}`);
  }
};

/**
 * Updates an existing record in the specified table.
 *
 * @param {string} table - The name of the table to update.
 * @param {Object} updates - An object where keys are column names and values are the new values.
 * @param {string} whereColumn - The column to filter the rows to update.
 * @param {any} whereValue - The value of the column to filter the rows to update.
 * @returns {Promise<Object>} - The result of the update operation.
 */
export const updateRecord = async (table, updates, whereColumn, whereValue) => {
  const setClause = Object.keys(updates).map((col) => `${col} = ?`).join(", ");
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereColumn} = ?`;
  try {
    const [result] = await db.execute(sql, [
      ...Object.values(updates),
      whereValue,
    ]);
    return {
      affectedRows: result.affectedRows,
      info: result.info,
      changedRows: result.changedRows,
      data: Object.fromEntries(Object.entries(updates)),
    };
  } catch (error) {
    throw new Error(`Update operation failed: ${error.message}`);
  }
};

/**
 * Updates an existing record in the specified table.
 * @param {string} query - An query to get result.
 * @param {Array<any>} values - An array of values corresponding to the columns.
 * @returns {Promise<Object>} - The result of the update operation.
 */
export const queryDB = async (query, params) => {
  const [[results]] = await db.execute(query, params);
  return results;
};
