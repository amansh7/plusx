import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";

export const couponList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'coupon',
        columns: `id, coupan_name, coupan_code, user_per_user, coupan_percentage, end_date, status, booking_for`,
        searchFields: ['coupan_name'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Coupon List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
};

export const couponData = async (req, resp) => {
    const { coupon_id } = req.body;
    const coupon = await queryDB(`SELECT * FROM coupon WHERE id = ?`, [coupon_id]);

    const result = {
        status: 1,
    }
    if(coupon_id){
        result.coupon = coupon;
    }

    return resp.status(200).json(result);
};


