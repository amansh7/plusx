import generateUniqueId from 'generate-unique-id';
import db, { startTransaction, commitTransaction, rollbackTransaction } from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";

export const rsaList = async (req, resp) => {
    const{ rsa_id, rsa_name, rsa_email, rsa_mobile, page = 1, list  } = req.body;

    const searchField = [];
    const searchText = [];
    
    if (rsa_id) {
        searchField.push('rsa_id');
        searchText.push(rsa_id);
    }
    if (rsa_name) {
        searchField.push('rsa_name');
        searchText.push(rsa_name);
    }
    if (rsa_email) {
        searchField.push('rsa_email');
        searchText.push(rsa_email);
    }
    if (rsa_mobile) {
        searchField.push('rsa_mobile');
        searchText.push(rsa_mobile);
    }

    const result = await getPaginatedData({
        tableName: 'rsa',
        columns: 'id, rsa_id, rsa_name, email, country_code, mobile, profile_img, status, booking_type',
        searchFields: searchField,
        searchTexts: searchText,
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no: page,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Emergency Team List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });

};

export const rsaData = async (req, resp) => {
    const{ rsa_id } = req.body; 
    const rsaData = queryDB(`SELECT * FROM rsa LIMIT 1`);
    const bookingType = ['Charger Installation', 'EV Pre-Sale', 'Portable Charger', 'Roadside Assistance', 'Valet Charging', ];

    return resp.json({
        status: 0,
        code: 200,
        message: "Rsa data fetch successfully",
        rsaData,
        bookingType
    });
    
};

export const rsaAdd = async (req, resp) => {
    const{ rsa_id, rsa_name, email, mobile, service_type, password, confirm_password } = req.body;
    const { isValid, errors } = validateFields(req.body, { 
        rsa_id: ["required"],
        rsa_name: ["required"],
        email: ["required"],
        mobile: ["required"],
        service_type: ["required"],
        password: ["required"],
        confirm_password: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(password.length <= 6) return resp.json({status:1, code: 200, message:["Password must be 6 digit"]});
    if(password != confirm_password) return resp.json({ status: 0, code: 422, message: ['Password and confirm password not matched!'] });

    try{
        let profile_image = '';
        if(req.files && req.files['profile_image']){
            const files = req.files;
            profile_image = files ? files['profile_image'][0].filename : '';
        }
    
        const insert = await insertRecord('rsa', [
            'rsa_id', 'rsa_name', 'email', 'country_code', 'mobile', 'booking_type', 'password', 'status', 'running_order', 'profile_img'
        ], [
            `RSA-${generateUniqueId({length:12})}`, rsa_name, email, '+971', mobile, service_type, 0, 0, profile_image
        ]);
    
        return resp.json({
            status: insert.affectedRows > 0 ? 1 : 0, 
            code: 200, 
            message: insert.affectedRows > 0 ? "RSA created successfully" : "Failed to create, Please Try Again!", 
        });
    }catch(err){
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }
};

export const rsaUpdate = async (req, resp) => {
    const{ rsa_id, rsa_name, email, mobile, service_type, password, confirm_password } = req.body;
    const { isValid, errors } = validateFields(req.body, { 
        rsa_id: ["required"],
        rsa_name: ["required"],
        email: ["required"],
        mobile: ["required"],
        service_type: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(password.length <= 6) return resp.json({status:1, code: 200, message:["Password must be 6 digit"]});
    
    const emailCheck = await queryDB(`SELECT rsa_id FROM rsa WHERE email = ? AND rsa_id != ? UNION SELECT rider_id FROM riders WHERE rider_email = ?`,[email, rsa_id, email]);
    const mobileCheck = await queryDB(`SELECT rsa_id FROM rsa WHERE mobile = ? AND rsa_id != ? UNION SELECT rider_id FROM riders WHERE rider_mobile = ?`, [mobile, rsa_id, mobile]);
    if (emailCheck.length > 0) return resp.json({status:1, code: 200, message:["Email already exists"]});
    if (mobileCheck.length > 0) return resp.json({status:1, code: 200, message:["Mobile number already exists"]});
    
    try{
        const rsaData = await queryDB(`SELECT profile_img FROM rsa LIMIT 1 WHERE rsa_id = ?`, [rsa_id]);
    
        let profile_image = '';
        if(req.files && req.files['profile_image']){
            const files = req.files;
            profile_image = files ? files['profile_image'][0].filename : '';
        }
    
        const updates = {rsa_name, email, mobile, booking_type: service_type, profile_img: profile_image};
        if(password){
            const hashedPswd = await bcrypt.hash(password, 10);
            updates.password = hashedPswd;
        } 
        const update = await updateRecord('rsa', updates, ['rsa_id'], [rsa_id]);
        const profileImgPath = path.join(__dirname, 'public/uploads/rsa_images', rsaData.profile_img);
        if (req.file) {
            fs.unlink(profileImgPath, (err) => {
                if (err) {
                    console.error(`Failed to delete rider old image: ${profileImgPath}`, err);
                }
            });
        }
        return resp.json({
            status: update.affectedRows > 0 ? 1 : 0, 
            code: 200, 
            message: update.affectedRows > 0 ? "RSA updated successfully" : "Failed to update, Please Try Again!", 
        });

    }catch(err){
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }
};

export const rsaDelete = async (req, resp) => {
    const { rsa_id } = req.body;    
    const rsaData = await queryDB(`SELECT profile_img FROM rsa WHERE rsa_id LIMIT 1`, [rsa_id]);
    if(!rsaData) return resp.json({status:0, message: "RSA Data can not delete, or invalid "});
    const conn = await startTransaction();
    
    try{
        await conn.execute(`DELETE FROM rsa WHERE rsa_id = ?`, [rsa_id]);
        await conn.execute(`DELETE FROM notifications WHERE receive_id = ?`, [rsa_id]);
        await conn.execute(`DELETE FROM road_assistance WHERE rsa_id = ?`, [rsa_id]);
        await conn.execute(`DELETE FROM order_assign WHERE rsa_id = ?`, [rsa_id]);

        const profileImgPath = path.join(__dirname, 'public/uploads/rsa_images', rsaData.profile_img);
        if (rsaData.profile_img) {
            fs.unlink(profileImgPath, (err) => {
                if (err) {
                    console.error(`Failed to delete rider old image: ${profileImgPath}`, err);
                }
            });
        }

        await commitTransaction(conn);
    } catch(err){
        await rollbackTransaction(conn);
        console.error("Transaction failed:", err);
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }finally{
        if (conn) conn.release();
    }

};

export const rsaStatusChange = async (req, resp) => {
    try{
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
    }catch(err){
        return resp.status(500).json({status:0, message: "Oops! Something went wrong! Please Try Again."});
    }
};