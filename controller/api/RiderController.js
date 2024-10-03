import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../../config/db.js";
import dotenv from "dotenv";
import crypto from 'crypto';
import multer from "multer";
import path from "path";
import validateFields from "../../validation.js";
import { generateRandomPassword, checkNumber, generateOTP, storeOTP, getOTP, sendOtp } from '../../utils.js';
import { insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import generateUniqueId from 'generate-unique-id';
import nodemailer from 'nodemailer';
dotenv.config();

var transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD
    }
});

/* Rider Auth */
export const login = async (req, resp) => {
    const { mobile, password ,fcm_token , country_code } = req.body;

    const { isValid, errors } = validateFields(req.body, {
        mobile: ["required"], password: ["required"], fcm_token: ["required"], country_code: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [[rider]] = await db.execute(
        `SELECT rider_id, rider_name, rider_email, profile_img, country_code, country, emirates, status, password, rider_mobile FROM riders WHERE rider_mobile = ? AND country_code = ? LIMIT 1`,
        [mobile, country_code]
    );

    if(!rider) return resp.json({ status: 0, code: 422, message: "Mobile number is not matching with our records" });

    const isMatch = await bcrypt.compare(password, rider.password);
    if (!isMatch) return resp.json({ status:0, code:405, error:true, message: "Password is incorrect" });
    if (rider.status == 2) return resp.json({ status:0, code:405, error:true, message: "You can not login as your status is inactive. Kindly contact to customer care" });
    
    const token = crypto.randomBytes(12).toString('hex');
    const [update] = await db.execute(`UPDATE riders SET access_token = ?, status = ?, fcm_token = ? WHERE rider_mobile = ?`, [token, 1, fcm_token, mobile]);
    if(update.affectedRows > 0){
        const result = {
            image_url: `${req.protocol}://${req.get('host')}/uploads/rider_profile/`,
            rider_id: rider.rider_id,
            rider_name: rider.rider_name,
            rider_email: rider.rider_email,
            profile_img: rider.profile_img,
            country_code: rider.country_code,
            rider_mobile: rider.rider_mobile,
            country: rider.country,
            emirates: rider.emirates,
            access_token: token
        };
    
        return resp.json({status:1, code:200, message: "Login successfully", result: result});
    }else{
        return resp.json({status:0, code:405, message: "Oops! There is something went wrong! Please Try Again", error: true});
    }
};

export const register = async (req, resp) => {
    const { password, fcm_token, country_code, rider_name, rider_email, rider_mobile, country, emirates, vehicle_type, date_of_birth, 
        area, added_from ,vehicle_make='', vehicle_model='', year_manufacture='', vehicle_code='', vehicle_number='', owner_type='', leased_from='', specification='' 
    } = req.body;
    
    let validationRules = {
        password: ["required", "password"], 
        fcm_token: ["required"], 
        country_code: ["required"],
        rider_name: ["required"],
        rider_email: ["required", "email"],
        rider_mobile: ["required"],
        country: ["required"],
        emirates: ["required"],
        date_of_birth: ["required"], 
        vehicle_type: ["required"],
    };
    if (vehicle_type && vehicle_type != "None") {
        validationRules = {
            ...validationRules,
            vehicle_make: ["required"],
            vehicle_model: ["required"],
            year_manufacture: ["required"],
            owner_type: ["required"],
        };
    }

    const { isValid, errors } = validateFields(req.body, validationRules);
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const res = checkNumber(country_code, rider_mobile);
    if(res.status == 0) return resp.json({ status:0, code:422, message: res.msg });

    const mobile = country_code + '' + rider_mobile;
    const [[isExist]] = await db.execute(`
        SELECT 
            (SELECT COUNT(*) FROM riders AS r WHERE r.rider_mobile = ?) AS check_mob,
            (SELECT COUNT(*) FROM riders AS r WHERE r.rider_email = ?) AS check_email,
            (SELECT COUNT(*) FROM rsa WHERE rsa.mobile = ?) AS rsa_mob
        FROM 
            rider_rsa_otp
        WHERE 
            rider_mobile = ?
        LIMIT 1
    `, [rider_mobile, rider_email, rider_mobile, mobile]);
    
    const err = [];
    if(Array.isArray(isExist) && isExist.check_mob >0) err.push('Email alreday exits.');
    if(Array.isArray(isExist) && isExist.check_mob >0) err.push('Mobile number is already registered.');
    if(err.length > 0) return resp.json({ status:0, code:422, message: err });
    
    const hashedPswd = await bcrypt.hash(password, 10);
    const accessToken = crypto.randomBytes(12).toString('hex');
    const rider = await insertRecord('riders', [
        'rider_name', 'rider_mobile', 'rider_email', 'password', 'country_code', 'country', 'emirates', 'area', 'vehicle_type', 'access_token', 'status', 'date_of_birth', 'added_from' 
    ],[
        rider_name, rider_mobile, rider_email, hashedPswd, country_code, country, emirates, area || '', vehicle_type, accessToken, 0, new Date(date_of_birth).toISOString().split('T')[0], added_from || 'Android'
    ]);
    
    if(!rider) return resp.json({status:0, code:405, message: "Oops! There is something went wrong! Please Try Again", error: true});

    const riderId = 'ER' + String(rider.insertId).padStart(4, '0');
    await db.execute('UPDATE riders SET rider_id = ? WHERE id = ?', [riderId, rider.insertId]);
    const vehicle = await insertRecord('riders_vehicles', [
        'vehicle_id', 'rider_id', 'vehicle_type', 'vehicle_make', 'vehicle_model', 'year_manufacture', 'vehicle_code', 'vehicle_number', 'owner_type', 'leased_from', 'vehicle_specification' 
    ],[
        'RDV' + generateUniqueId({length:13}), riderId, vehicle_type, vehicle_make, vehicle_model, year_manufacture, vehicle_code, vehicle_number, owner_type, leased_from, specification,
    ]);

    if(vehicle.affectedRows == 0) return resp.json({status:0, code:405, message: "Oops! There is something went wrong! Please Try Again", error: true}); 
    const result = {
        image_url: `${req.protocol}://${req.get('host')}/uploads/rider_profile/`,
        rider_id: riderId,
        rider_name: rider_name,
        rider_email: rider_email,
        profile_img: null,
        country_code: country_code,
        rider_mobile: rider_mobile,
        country: country,
        emirates: emirates,
        access_token: accessToken,
    };
    return resp.json({status:1, code:200, message: "Rider registered successfully", result: result});
};

export const forgotPassword = async (req, resp) => {
    const { email } = req.body;
    if (!email) return resp.status(400).json({ status: 0, code: 405, error: true, message: 'Email is required' });
    const [[rider]] = await db.execute('SELECT rider_name FROM riders WHERE rider_email=?', [email]);
    
    if(!rider){
        return resp.json({status: 0, code: 400, message: 'Oops! Invalid Email Address'});
    }
    const hashedPswd = await bcrypt.hash(generateRandomPassword(6), 10);
    await db.execute('UPDATE riders SET password=? WHERE rider_email=?', [hashedPswd, email])

    try {
        await transporter.sendMail({
          from: `"Easylease Admin" <admin@easylease.com>`,
          to: email,
          subject: 'Forgot Password Request - PlusX Electric App',
          html: `
            <html>
              <body>
                <h4>Dear ${rider.rider_name},</h4>
                <p>We have generated a new password for you <b>'${password}'</b> Please use this temporary password to log in to your account.</p> 
                <p>Once logged in, we highly recommend that you change your password to something more memorable. You can do this by following these simple steps: </p>
                <p>Log in to your account using the provided temporary password.</p>
                <p>Navigate to the "Profile" section.</p> 
                <p>Look for the "Reset Password" option within the profile settings.</p>                         
                <p>Enter your new password and confirm it.</p> 
                <p>Save the changes.</p> 
                <p>Regards,<br/> PlusX Electric App </p>
              </body>
            </html>
          `,
        });
    
        resp.status(200).json({ message: "An email has been sent to your entered registered email address. Please check that!" });
    } catch (error) {
        resp.status(500).json({ message: "Failed to send email." });
    }
};

export const createOTP = async (req, resp) => {
    const { mobile, user_type, country_code } = req.body;

    const { isValid, errors } = validateFields(req.body, {
        mobile: ["required"], user_type: ["required"], country_code: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const res = checkNumber(country_code, mobile);
    if(res.status == 0) return resp.json({ status:0, code:422, message: res.msg });
    
    let checkCountQuery;
    if(user_type === 'RSA'){
        checkCountQuery = 'SELECT COUNT(id) AS count FROM rsa WHERE mobile = ?';
    }else{
        checkCountQuery = 'SELECT COUNT(id) AS count FROM riders WHERE rider_mobile = ? AND country_code = ?';
    }
    
    const [rows] = await db.execute(checkCountQuery, user_type === 'RSA' ? [mobile] : [mobile, country_code]);
    const checkCount = rows[0].count;
    
    if (checkCount > 0) return resp.json({ status: 0, code: 422, message: ['The provided mobile number is already registered. Please log in to continue.'] });
    
    const fullMobile = `${country_code}${mobile}`;
    let otp = generateOTP(4);
    storeOTP(fullMobile, otp);

    sendOtp(
        fullMobile,
        `Your One-Time Password (OTP) for sign-up is: ${otp}. Do not share this OTP with anyone. Thank you for choosing PlusX Electric App!`
    );
    return resp.json({ status: 1, code: 200, data: otp, message: ['OTP sent successfully!'] });
    /* .then(result => {
        if (result.status === 0) return resp.json(result);
        return resp.json({ status: 1, code: 200, data: otp, message: ['OTP sent successfully!'] });
    })
    .catch(err => {
        console.error('Error in otpController:', err.message);
        return resp.json({ status: 'error', msg: 'Failed to send OTP' });
    }); */
};

export const verifyOTP = async (req, resp) => {
    const { mobile, user_type, country_code, otp, fcm_token } = req.body;

    const { isValid, errors } = validateFields(req.body, {
        mobile: ["required"], user_type: ["required"], country_code: ["required"], otp: ["required"], fcm_token: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const fullMobile = `${country_code}${mobile}`;
    const cachedOtp = getOTP(fullMobile);

    if (!cachedOtp || cachedOtp !== otp) return resp.json({ status: 0, code: 422, message: ["OTP invalid!"] });
    
    return resp.json({status: 1, code: 200, message: ['OTP verified succeessfully!'], is_login: 0});
};

export const logout = async (req, resp) => {
    const riderId = req.body.rider_id;
    if (!riderId) return resp.json({ status: 0, code: 422, message: "Rider Id is required" });
    
    const rider = queryDB(`SELECT EXISTS (SELECT 1 FROM riders WHERE rider_id = ?) AS rider_exists`, [riderId]);
    if(!rider) return resp.json({status:0, code:400, message: 'Rider ID Invalid!'});

    const update = await updateRecord('riders', {status:0, access_token: ""}, 'rider_id', riderId);
    
    if(update.affectedRows > 0){
        return resp.json({status: 0, code: 200, message: 'Logged out sucessfully'});
    }else{
        return resp.json({status: 0, code: 405, message: 'Oops! There is something went wrong! Please Try Again'});
    }

};

/* Rider Info */
export const home = async (req, resp) => {
    const riderId = req.body.rider_id;
    if (!riderId) return resp.json({ status: 0, code: 422, message: "Rider Id is required" });
    
    const riderQuery = `SELECT rider_id, rider_name, 
        (SELECT COUNT(*) FROM notifications AS n WHERE n.panel_to = 'Rider' AND n.receive_id = rider_id AND status = '0') AS notification_count
        FROM riders WHERE rider_id = ?
    `;
    const riderData = await queryDB(riderQuery, [riderId]);

    if (!riderData) {
        return resp.status(404).json({ message: "Rider not found", status: 0 });
    }

    const result = {
        rider_id: riderData.rider_id,
        rider_name: riderData.rider_name,
        notification_count: riderData.notification_count
    };
    
    const orderData = await queryDB(
        `SELECT request_id, (SELECT CONCAT(rsa_name, ',', country_code, ' ', mobile) FROM rsa WHERE rsa_id = road_assistance.rsa_id) AS rsaDetails, created_at 
        FROM road_assistance WHERE rider_id = ? AND order_status NOT IN ('C', 'WC', 'ES') ORDER BY id DESC LIMIT 1
    `, [riderId]);
    
    if (orderData) orderData.eta_time = '12 Min.';
    
    const pickDropData = await queryDB(
        `SELECT request_id, (SELECT CONCAT(rsa_name, ',', country_code, ' ', mobile) FROM rsa WHERE rsa_id = charging_service.rsa_id) AS rsaDetails, created_at 
        FROM charging_service WHERE rider_id = ? AND created_at >= NOW() - INTERVAL 30 MINUTE AND order_status NOT IN ('WC', 'C') ORDER BY id DESC LIMIT 1
    `, [riderId]);
    
    if (pickDropData) pickDropData.eta_time = '11 Min.';
    
    const podBookingData = await queryDB(
        `SELECT booking_id AS request_id, (SELECT CONCAT(rsa_name, ',', country_code, ' ', mobile) FROM rsa WHERE rsa_id = portable_charger_booking.rsa_id) AS rsaDetails, created_at 
        FROM portable_charger_booking WHERE rider_id = ? AND created_at >= NOW() - INTERVAL 30 MINUTE AND status NOT IN ('WC', 'C') ORDER BY id DESC LIMIT 1
    `, [riderId]);

    if (podBookingData) podBookingData.eta_time = '11 Min.';
    
    return resp.json({
        message: ["Rider Home Data fetched successfully!"],
        rider_data: result,
        order_data: orderData || null,
        pick_drop_order: pickDropData || null,
        pod_booking: podBookingData || null,
        roadside_assistance_price: 15,
        portable_price: 15,
        pick_drop_price: 15,
        status: 1,
        code: 200
    });
};

export const getRiderData = async(req, resp) => {
    const riderId = req.body.rider_id;
    if (!riderId) return resp.json({ status: 0, code: 422, message: "Rider Id is required" });

    const rider = await queryDB(`SELECT * FROM riders WHERE rider_id=?`, [riderId]);
    rider.image_url = `${req.protocol}://${req.get('host')}/uploads/rider_profile/`;

    return resp.json({status: 1, code: 200, message: 'Rider Data fetch successfully!', data: rider, roadside_assitance_price: 15, portable_price: 15, pick_drop_price: 15});
};

//image upload pending
export const updateProfile = async (req, resp) => {
    console.log(req.body);
    const { rider_id, rider_name ,rider_email , country, date_of_birth, emirates, profile_image='', leased_from=''} = req.body;
    const riderId = rider_id;

    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"], rider_name: ["required"], rider_email: ["required"], country: ["required"], date_of_birth: ["required"], emirates: ["required"], 
        profile_image: ["file", ['jpeg', 'jpg']]
    });
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    try{
        const rider = await queryDB(`SELECT profile_img, leased_from FROM riders WHERE rider_id=?`, [riderId]);
        const profileImg = req.file ? req.file.filename : rider.profile_img;
        const updates = {rider_name, rider_email, country, emirates, leased_from, profile_img: profile_image, date_of_birth};
        const update = await updateRecord('riders', updates, 'rider_id', riderId);
        
        return resp.json(update);
    }catch(err){
        return resp.json({ status: 0, code: 200, message: 'Oops! There is something went wrong! Please Try Again' });
    }

};

//image deletion pending
export const deleteImg = async (req, resp) => {
    const riderId = req.body.rider_id;
    if (!riderId) return resp.json({ status: 0, code: 422, message: "Rider Id is required" });
    
    const rider = queryDB(`SELECT profile_img FROM riders WHERE rider_id = ?`, [riderId]);
    if(!rider) return resp.json({status:0, code:400, message: 'Rider ID Invalid!'});
    
    const update = await updateRecord('riders', {profile_img: ''}, 'rider_id', riderId);
    if(update.affectedRows > 0){
        return resp.json({ status: 1, code: 200, message: "Rider profile image deleted successfuly" });
    }else{
        return resp.json({ status: 0, code: 200, message: "Oops! There is something went wrong! Please Try Again" });
    }
};

export const updatePassword = async (req, resp) => {
    const { rider_id, old_password, new_password, confirm_password} = req.body;

    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"], old_password: ["required"], new_password: ["required"], confirm_password: ["required"]
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    if(new_password != confirm_password) return resp.json({ status: 0, code: 422, message: 'New password and confirm password not matched!' });
    
    const rider = queryDB(`SELECT password FROM riders WHERE rider_id=?`, [rider_id]);
    
    const isMatch = await bcrypt.compare(old_password, rider.password);  
    if (!isMatch) return resp.status(401).json({ message: "Please enter currect password." });

    const hashedPswd = await bcrypt.hash(new_password, 10);
    const update = updateRecord('riders', {password: hashedPswd}, 'rider_id', rider_id);

    if(update.affectedRows > 0 ) return resp.json({status: 1, code: 200, message: 'Password changed successfully'});
};

export const locationList = async (req, resp) => {
    const list = queryDB(`SELECT location_id, location_name, latitude, longitude FROM locations ORDER BY location_name ASC`);
    return resp.json({status: 1, code: 200, message: '', result: list})
};
