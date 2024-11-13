import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
import { asyncHandler } from '../../utils.js';


export const interestList = asyncHandler(async (req, resp) => {
    const {page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'interested_people',
        columns: `user_id, rider_id, name, country_code, mobile, address, vehicle, region_specification`,
        searchFields: [],
        searchTexts: [],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Interest List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
});




