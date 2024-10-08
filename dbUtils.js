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
  
  const whereClause = whereColumns.map(col => `${col} = ?`).join(" AND ");
  
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
 * Executes a SQL query on the specified database and returns the result.
 * 
 * @param {string} query - The SQL query to be executed. This should be a valid SQL statement.
 * @param {Array<any>} params - An array of values corresponding to placeholders in the query.
 * @returns {Promise<Object>} - The result of the operation.
 */
export const queryDB = async (query, params) => {
  const [[results]] = await db.execute(query, params);
  return results;
};

/**
 * Fetches paginated data from the specified table with optional search and sorting.
 *
 * @param {Object} params - Parameters for the query.
 * @param {string} params.tableName - The name of the table from which to fetch data.
 * @param {string} [params.columns='*'] - The columns to be selected, defaults to '*'.
 * @param {string} [params.searchField=''] - The column to apply the search filter on, if any.
 * @param {string} [params.searchText=''] - The search text to filter the records by, defaults to an empty string.
 * @param {string} [params.sortColumn='id'] - The column to sort the data by, defaults to 'id'.
 * @param {string} [params.sortOrder='ASC'] - The sort order ('ASC' or 'DESC'), defaults to 'ASC'.
 * @param {number} [params.page_no=1] - The page number for pagination, defaults to 1.
 * @param {number} [params.limit=10] - The number of records to fetch per page, defaults to 10.
 * @param {string} [params.whereField='status'] - The column to filter records by status, defaults to 'status'.
 * @param {any} [params.whereValue=1] - The value to filter the status column by, defaults to 1.
 * @returns {Promise<Object>} - An object containing paginated data, total records, and total pages.
 * 
 **/
export const getPaginatedData = async ({
  tableName,
  columns = '*',
  searchField = '',
  searchText = '',
  sortColumn = 'id',
  sortOrder = 'ASC',
  page_no = 1,
  limit = 10,
  whereField = '',
  whereValue = ''
}) => {
  const start = (page_no * limit) - limit;

  const searchCondition = searchText ? ` AND ${searchField} LIKE ?` : '';
  const searchValue = searchText ? `%${searchText.trim()}%` : null;

  let whereCondition = '';
  const queryParams = [];
  
  if (whereField && whereValue) {
    whereCondition = ` WHERE ${whereField} = ?`;
    queryParams.push(whereValue);
  }

  let query = `SELECT SQL_CALC_FOUND_ROWS ${columns} FROM ${tableName}${whereCondition} ${searchCondition} ORDER BY ${sortColumn} ${sortOrder} LIMIT ?, ?`;

  if (searchValue) {
    queryParams.push(searchValue);
  }

  queryParams.push(start, limit);

  const [rows] = await db.execute(query, queryParams);

  const [[{ total }]] = await db.query('SELECT FOUND_ROWS() AS total');
  const totalPage = Math.max(Math.ceil(total / limit), 1);

  return {
    data: rows,
    total,
    totalPage
  };
};
