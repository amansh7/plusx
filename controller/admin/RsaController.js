import generateUniqueId from 'generate-unique-id';
import db, { startTransaction, commitTransaction, rollbackTransaction } from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord, } from '../../dbUtils.js';
import validateFields from "../../validation.js";
import { asyncHandler, deleteFile } from '../../utils.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from "bcryptjs";
import moment from 'moment';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rsaList = asyncHandler(async (req, resp) => {
    const{ rsa_id, rsa_name, rsa_email, rsa_mobile, page = 1, list, service_type, start_date, end_date, search_text = ''} = req.body;

    const searchField = [];
    const searchText = [];
    const whereFields = []
    const whereValues = []
    const whereOperators = []

    if (start_date && end_date) {
        const start = moment(start_date, "YYYY-MM-DD").startOf('day').format("YYYY-MM-DD HH:mm:ss");
        const end = moment(end_date, "YYYY-MM-DD").endOf('day').format("YYYY-MM-DD HH:mm:ss");

        whereFields.push('created_at', 'created_at');
        whereValues.push(start, end);
        whereOperators.push('>=', '<=');
    }

    const result = await getPaginatedData({
        tableName: 'rsa',
        columns: 'id, rsa_id, rsa_name, email, country_code, mobile, profile_img, status, booking_type',
        // searchFields: searchField,
        // searchTexts: searchText,
        liveSearchFields: ['rsa_id', 'rsa_name', 'email', 'booking_type',],
        liveSearchTexts: [search_text, search_text, search_text, search_text,],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no: page,
        limit: 10,
        whereField: whereFields,
        whereValue: whereValues,
        whereOperator: whereOperators
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Emergency Team List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });

});


export const rsaData = asyncHandler(async (req, resp) => {
    const { rsa_id } = req.body; 
    const rsaData = await queryDB(`SELECT * FROM rsa WHERE rsa_id = ? LIMIT 1`, [rsa_id]);
    const bookingType = ['Charger Installation', 'EV Pre-Sale', 'Portable Charger', 'Roadside Assistance', 'Valet Charging'];
    const bookingHistory = [];

    if (rsaData) {
        const bookingTypeValue = rsaData.booking_type;

        if (bookingTypeValue === 'Valet Charging') {
            let chargingServiceData = await queryDB(`SELECT *  FROM charging_service WHERE rsa_id = ?`, [rsa_id]);
          
            chargingServiceData = Array.isArray(chargingServiceData) ? chargingServiceData : (chargingServiceData ? [chargingServiceData] : []);
            bookingHistory.push(...chargingServiceData);
        } else if (bookingTypeValue === 'Portable Charger') {
            let portableChargerData = await queryDB(` SELECT * FROM portable_charger_booking  WHERE rsa_id = ?`, [rsa_id]);
            
            portableChargerData = Array.isArray(portableChargerData) ? portableChargerData : (portableChargerData ? [portableChargerData] : []);
            bookingHistory.push(...portableChargerData);
        }
        // else if (bookingTypeValue === 'Charger Installation') {
        //     const chargerInstallationData = await queryDB(`SELECT * FROM charging_installation_service WHERE rsa_id = ?`, [rsa_id]);
        //     bookingHistory.push(...chargerInstallationData); 
        // } else if (bookingTypeValue === 'EV Pre-Sale') {
        //     const chargerInstallationData = await queryDB(`SELECT * FROM charging_installation_service WHERE rsa_id = ?`, [rsa_id]);
        //     bookingHistory.push(...chargerInstallationData); 
        // } 
    }

    return resp.json({
        status: 0,
        code: 200,
        message: "RSA data fetched successfully",
        rsaData,
        bookingType,
        bookingHistory ,
        base_url: `${req.protocol}://${req.get('host')}/uploads/rsa_images/`
    });
});


export const rsaAdd = asyncHandler(async (req, resp) => {
    const{ rsa_name, rsa_email, mobile, service_type, password, confirm_password } = req.body;
    const { isValid, errors } = validateFields(req.body, { 
        rsa_name: ["required"],
        rsa_email: ["required"],
        mobile: ["required"],
        service_type: ["required"],
        password: ["required"],
        confirm_password: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(password.length < 6) return resp.json({status:1, code: 422, message:["Password must be 6 digit"]});
    if(password != confirm_password) return resp.json({ status: 0, code: 422, message: ['Password and confirm password not matched!'] });

    let profile_image = req.files['profile_image'] ? req.files['profile_image'][0].filename  : '';

    const insert = await insertRecord('rsa', [
        'rsa_id', 'rsa_name', 'email', 'country_code', 'mobile', 'booking_type', 'password', 'status', 'running_order', 'profile_img'
    ], [
        `RSA-${generateUniqueId({length:8})}`, rsa_name, rsa_email, '+971', mobile, service_type, password, 0, 0, profile_image
    ]);
    
    return resp.json({
        status: insert.affectedRows > 0 ? 1 : 0, 
        code: 200, 
        message: insert.affectedRows > 0 ? "RSA created successfully" : "Failed to create, Please Try Again!", 
    });
});

export const rsaUpdate = asyncHandler(async (req, resp) => {
    const{ rsa_id, rsa_name, rsa_email, mobile, service_type, password, confirm_password } = req.body;
    const { isValid, errors } = validateFields(req.body, { 
        rsa_id: ["required"],
        rsa_name: ["required"],
        rsa_email: ["required"],
        mobile: ["required"],
        service_type: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(password && password?.length < 6) return resp.json({status:1, code: 422, message:["Password must be 6 digit"]});
    
    const emailCheck = await queryDB(`SELECT rsa_id FROM rsa WHERE email = ? AND rsa_id != ? UNION SELECT rider_id FROM riders WHERE rider_email = ?`,[rsa_email, rsa_id, rsa_email]);
    const mobileCheck = await queryDB(`SELECT rsa_id FROM rsa WHERE mobile = ? AND rsa_id != ? UNION SELECT rider_id FROM riders WHERE rider_mobile = ?`, [mobile, rsa_id, mobile]);
    if (emailCheck?.length > 0) return resp.json({status:1, code: 200, message:["Email already exists"]});
    if (mobileCheck?.length > 0) return resp.json({status:1, code: 200, message:["Mobile number already exists"]});
    
    const rsaData = await queryDB(`SELECT profile_img FROM rsa WHERE rsa_id = ?`, [rsa_id]);
    const profile_image = req.files['profile_image'] ? files['profile_image'][0].filename : rsaData.profile_img;
    const updates = {rsa_name, email: rsa_email, mobile, booking_type: service_type, profile_img: profile_image};

    if(password) updates.password = await bcrypt.hash(password, 10);

    const update = await updateRecord('rsa', updates, ['rsa_id'], [rsa_id]);

    if(rsaData.profile_img) deleteFile('rsa_images', rsaData.profile_img);

    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0, 
        code: 200, 
        message: update.affectedRows > 0 ? "RSA updated successfully" : "Failed to update, Please Try Again!", 
    });
});

export const rsaDelete = asyncHandler(async (req, resp) => {
    const { rsa_id } = req.body;    
    const rsaData = await queryDB(`SELECT profile_img FROM rsa WHERE rsa_id = ? LIMIT 1`, [rsa_id]);
    if(!rsaData) return resp.json({status:0, message: "RSA Data can not delete, or invalid "});
    const conn = await startTransaction();
    
    try{
        await conn.execute(`DELETE FROM rsa WHERE rsa_id = ?`, [rsa_id]);
        await conn.execute(`DELETE FROM notifications WHERE receive_id = ?`, [rsa_id]);
        await conn.execute(`DELETE FROM road_assistance WHERE rsa_id = ?`, [rsa_id]);
        await conn.execute(`DELETE FROM order_assign WHERE rsa_id = ?`, [rsa_id]);

        const profileImgPath = path.join(__dirname, 'public/uploads/rsa_images', rsaData.profile_img);
        if (rsaData.profile_img) deleteFile('rsa_images', rsaData.profile_img);

        await commitTransaction(conn);
        return resp.json({ status: 1, code: 200, error: false, message: ['Driver account deleted successfully!'] });
    } catch(err){
        await rollbackTransaction(conn);
        console.error("Transaction failed:", err);
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }finally{
        if (conn) conn.release();
    }

});

export const rsaStatusChange = asyncHandler(async (req, resp) => {
    const{ id, status } = req.body;

    if(status == 4){
        const orderCheck = queryDB(`SELECT COUNT(*) AS check_order FROM order_assign WHERE rsa_id = ? AND order_status IN ('AR', 'EN')`, [id]);
        if (orderCheck.check_order > 0) return resp.status(422).json({status: 0, msg: "You cannot deactivate this RSA because an order is currently active."});    
    }

    const update = await updateRecord('rsa', {status, access_token:''}, ['id'], [id]);
    
    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0, 
        code: 200, 
        message: update.affectedRows > 0 ? "RSA status changed successfully." : "Failed to update, Please Try Again!", 
    });
});
