import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
import moment from 'moment';

const validations = async (coupan_code, resp, coupon_id=null) => {
    if (typeof coupan_code !== 'string') {
        return resp.json({ status: 0, code: 422, message: "Coupan code must be a string." });
    }

    if (coupan_code.length > 25) {
        return resp.json({ status: 0, code: 422, message: "The coupan code may not be greater than 25 characters." });
    }

    let query = `SELECT COUNT(*) AS count FROM coupon WHERE coupan_code = ?`;
    const params = [coupan_code];

    if (coupon_id) {
        query += ` AND id != ?`;
        params.push(coupon_id);
    }
    const result = await queryDB(query, params);
    console.log(query, params, result);

    if (result.count > 0) {
        return resp.json({ status: 0, code: 422, message: "Coupan code must be unique." });
    }

    return null;
};

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
        message: "Coupon List fetch successfully!",
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
};

export const couponDetail = async (req, resp) => {
    const { coupon_id } = req.body;
    if (!coupon_id) return resp.json({ status: 0, code: 422, message: "Coupon Id is required" });
    
    const coupon = await queryDB(`SELECT * FROM coupon WHERE id = ?`, [coupon_id]);
    
    return resp.status(200).json({status: 1, data: coupon, message: "Coupon Data fetch successfully!"});
};

export const couponData = async (req, resp) => {
    const bookingType = [
        'Charger Installation', 'EV Pre-Sale', 'POD-On Demand Service', 'POD-Get Monthly Subscription',
        'Roadside Assistance', 'Valet Charging',   
    ];
    return resp.json({status: 1, message: "Coupon data fetch successfully!"}, bookingType );
};

export const couponAdd = async (req, resp) => {
    const { coupan_name, coupan_code, coupan_percentage, expiry_date, user_per_user, service_type } = req.body;
    const { isValid, errors } = validateFields(req.body, { coupan_name: ["required"], coupan_code: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const validationErr = await validations(coupan_code, resp);
    if (validationErr) return validationErr;

    const insert = await insertRecord('coupon', [
        'coupan_name', 'coupan_code', 'coupan_percentage', 'end_date', 'user_per_user', 'booking_for', 'status'
    ], [
        coupan_name, coupan_code, coupan_percentage, moment(expiry_date, "YYYY-MM-DD").format("YYYY-MM-DD"), user_per_user, service_type, 1
    ]);

    return resp.json({
        status: insert.affectedRows > 0 ? 1 : 0,
        message: insert.affectedRows > 0 ? "Coupon added successfully" : "Failed to insert, Please try again.",
    });
    
};

export const couponEdit = async (req, resp) => {
    const { coupan_name, coupan_code, coupan_percentage, expiry_date, user_per_user, service_type, status='' } = req.body;
    const { isValid, errors } = validateFields(req.body, { coupan_name: ["required"], coupan_code: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const {coupon_id} = await queryDB(`SELECT id AS coupon_id FROM coupon WHERE coupan_code = ? `, [coupan_code]);
    const validationErr = await validations(coupan_code, resp, coupon_id);
    if (validationErr) return validationErr;

    const fExpiryDate = moment(expiry_date, "YYYY-MM-DD").format("YYYY-MM-DD");
    const updates = {coupan_name, coupan_percentage, end_date: fExpiryDate, user_per_user, booking_for: service_type, status: status ? 1 : 0 };
    
    const update = await updateRecord('coupon', updates, ['coupan_code'], [coupan_code]);
    
    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0,
        message: update.affectedRows > 0 ? "Coupon updated successfully" : "Failed to update, Please try again.",
    });

};

export const couponDelete = async (req, resp) => {
    const { coupan_code } = req.body;
    if (!coupan_code) return resp.json({ status: 0, code: 422, message: "Coupan Code is required" });
    
    const del = await db.execute(`DELETE FROM coupon WHERE coupan_code = ?`, [coupan_code]);

    return resp.json({ 
        status: del.affectedRows > 0 ? 1 : 0, 
        code: 200, 
        message: del.affectedRows > 0 ? "Coupon deleted successfully!" : "Coupon can not delete, or invalid" 
    });
};

