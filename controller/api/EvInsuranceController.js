import db from "../../config/db.js";
import validateFields from "../../validation.js";
import { insertRecord, queryDB, getPaginatedData } from '../../dbUtils.js';
import multer from 'multer';
import moment from "moment";
import transporter from "../../mailer.js";
import generateUniqueId from 'generate-unique-id';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/insurance-images/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

export const upload = multer({ storage });

export const addInsurance = async (req, resp) => {
    const { rider_id, owner_name, date_of_birth, country, country_code, mobile_no, email, vehicle, registration_place, car_brand, insurance_expired, bank_loan,
        insurance_expiry, type_of_insurance, bank_name
    } = req.body

    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"],
        owner_name: ["required"],
        date_of_birth: ["required"],
        country: ["required"],
        country_code: ["required"],
        mobile_no: ["required"],
        email: ["required"],
        vehicle: ["required"],
        registration_place: ["required"],
        car_brand: ["required"],
        insurance_expired: ["required"],
        bank_loan: ["required"],
    });
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if (insurance_expired === 'Yes' && !type_of_insurance) resp.json({ status: 0, code: 422, message: 'Type of insurance is required'});
    if (insurance_expired === 'Yes' && !insurance_expiry) resp.json({ status: 0, code: 422, message: 'Insurance expiry is required'});
    if (bank_loan === 'Yes' && !bank_name) resp.json({ status: 0, code: 422, message: 'Bank name is required'});
    const getImageFilenames = (fileKey) => req.files[fileKey]?.map(file => file.filename).join('*') || '';
    let registration_img = '', licence_img = '', car_images = '', car_type_image = '', scretch_image = '', emirates_id = '';

    if (insurance_expired === 'Yes') {
        registration_img = getImageFilenames('vehicle_registration_img');
        licence_img = getImageFilenames('driving_licence');
        car_images = getImageFilenames('car_images');
        car_type_image = getImageFilenames('car_type_image');
        scretch_image = getImageFilenames('scretch_image');
        emirates_id = getImageFilenames('emirates_id');
    }

    const insuranceId = 'EVI' + generateUniqueId({length:12});
    const formattedInsuranceExpiry = insurance_expiry ? moment(insurance_expiry).format('YYYY-MM-DD') : null;

    const insert = insertRecord('ev_insurance', [
        'insurance_id', 'rider_id', 'owner_name', 'date_of_birth', 'country', 'country_code', 'mobile_no', 'email', 'vehicle', 'registration_place', 'car_brand', 
        'bank_loan', 'bank_name', 'type_of_insurance', 'insurance_expiry', 'insurance_expired', 'vehicle_registration_img', 'driving_licence', 'car_images', 
        'car_type_image', 'scretch_image', 'emirates_id', 
    ], [
        insuranceId, rider_id, owner_name, date_of_birth, country, country_code, mobile_no, email, vehicle, registration_place, car_brand, bank_loan, 
        bank_name, type_of_insurance, insurance_expiry, insurance_expired, registration_img, licence_img, car_images, car_type_image, scretch_image, emirates_id, 
    ]);

    if(insert.affectedRows === 0 ) return resp.json({status:0, code:200, error: true, message: ['Oops! There is something went wrong! Please Try Again']});

    await transporter.sendMail({
        from: `"PlusX Electric App" <media@plusxelectric.com>`,
        to: email,
        subject: `Thank You for Choosing PlusX Electric App for Your EV Insurance Needs!`,
        html: `<html>
            <body>
                <h4>Dear ${owner_name},</h4>
                <p>Thank you for selecting PlusX Electric App for your EV insurance requirements. 
                We have successfully received your details, and our EV insurance executive will be reaching out to you shortly.</p><br/>
                <p>We look forward to assisting you with your EV insurance needs.</p> <br /> <br /> 
                <p> Regards,<br/> PlusX Electric App </p>
            </body>
        </html>`,
    });

    return resp.json({
        status: 1,
        code: 200,
        error: false,
        message: ["Thank you for sharing your details. We will revert shortly."],
    });

};

export const insuranceList = async (req, resp) => {
    const {rider_id, page_no, mobile_no, vehicle } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    let whereField = ['rider_id'];
    let whereValue = [rider_id];

    if(mobile_no){
        whereField.push('mobile_no');
        whereValue.push(`%${mobile_no}%`);
    }
    if(vehicle){
        whereField.push('vehicle');
        whereValue.push(`%${vehicle}%`);
    }

    const result = await getPaginatedData({
        tableName: 'ev_insurance',
        columns: `insurance_id, owner_name, date_of_birth, country, country_code, mobile_no, vehicle, car_brand, emirates_id, created_at,
            (select concat(vehicle_model, "-", vehicle_make) from riders_vehicles as rv where rv.vehicle_id = ev_insurance.vehicle) 
            AS vehicle_data`,
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
        whereField,
        whereValue,
        whereOperator: ['=', 'LIKE', 'LIKE'],
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Insurance list fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
        base_url: `${req.protocol}://${req.get('host')}/uploads/pick-drop-invoice/`,
    });
};

export const insuranceDetails = async (req, resp) => {
    const {rider_id, insurance_id } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], insurance_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const insurance = await queryDB(`
        SELECT 
            ev_insurance.*,
            (select concat(vehicle_model, "-", vehicle_make) from riders_vehicles as rv where rv.vehicle_id = ev_insurance.vehicle) as vehicle_data
        FROM 
            ev_insurance
        WHERE
            rider_id = ? AND insurance_id = ?
        LIMIT 1
    `, [rider_id, insurance_id]);

    return resp.json({
        message: [ "Insurance details fetch successfully!" ],
        insurance_data: insurance,
        status: 1, 
        code: 200, 
    });
};

export const evPreSaleBooking = async (req, resp) => {
    const {rider_id, owner_name, country, country_code, mobile_no, email, vehicle, pickup_address, reason_of_testing, pickup_latitude, pickup_longitude, 
        slot_date, slot_time_id 
    } = req.body;

    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"],
        owner_name: ["required"],
        country: ["required"],
        country_code: ["required"],
        mobile_no: ["required"],
        email: ["required"],
        vehicle: ["required"],
        pickup_address: ["required"],
        reason_of_testing: ["required"],
        pickup_latitude: ["required"],
        pickup_longitude: ["required"],
        slot_date: ["required"],
        slot_time_id: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const bookingId = 'EPTS' + generateUniqueId({length:11});

    const insert = insertRecord('ev_pre_sale_testing', [
        "booking_id", "rider_id", "owner_name", "country", "country_code", "mobile_no", "email", "vehicle", "pickup_address", "reason_of_testing", "pickup_latitude", 
        "pickup_longitude", "slot_date", "slot_time_id" 
    ],[
        bookingId, rider_id, owner_name, country, country_code, mobile_no, email, vehicle, pickup_address, reason_of_testing, pickup_latitude, pickup_longitude, 
        moment(slot_date).format('YYYY-MM-DD'), slot_time_id 
    ])

    if(insert.affectedRows === 0) return resp.json({status:0, code:200, error: true, message: ["Oops! Something went wrong. Please try again."]});

    const rider = await queryDB(`SELECT fcm_token, rider_name, rider_email FROM riders WHERE rider_id = ?`, [rider_id]);

    // const href = 'pre_sale_testing/' + bookingId;
    // const heading = 'EV-pre Sale booked!';
    // const desc = `Your request for EV-pre sale testing booking_id: ${bookingId} has been placed.`;
    // createNotification(heading, desc, 'EV-pre Sale', 'Rider', 'Admin','', rider_id, href);
    // pushNotification(rider.fcm_token, heading, desc, 'RDRFCM', href);

    const formattedDateTime = moment().format('DD MMM YYYY hh:mm A');

    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: rider.rider_email,
        subject: 'Your EV-pre Sale Booking Confirmation - PlusX Electric App',
        html: `<html>
            <body>
                <h4>Dear ${rider.rider_name},</h4>
                <p>Thank you for using the PlusX Electric App for your Valet Charging service. We have successfully received your booking request. 
                Below are the details of your roadside assistance booking:</p> <br />
                <p>Booking Reference: ${bookingId}</p>
                <p>Date & Time of Request: ${formattedDateTime}</p> 
                <p>Pick Up Address: ${pickup_address}</p>                         
                <p>Reason: ${reason_of_testing}</p><br/><br/>  
                <p> Regards,<br/> The Friendly PlusX Electric Team </p>
            </body>
        </html>`,
    });

    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: 'admin@plusxelectric.com',
        subject: `EV-pre Sale Booking - ${bookingId}`,
        html: `<html>
            <body>
                <h4>Dear Admin,</h4>
                <p>We have received a new booking for our Valet Charging service. Below are the details:</p> 
                <p>Customer Name : ${rider.rider_name}</p>
                <p>Pickup & Drop Address : ${pickup_address}</p>
                <p>Booking Date & Time : ${formattedDateTime}</p> <br/>                        
                <p> Best regards,<br/> PlusX Electric App </p>
            </body>
        </html>`,
    });

    return resp.json({
        status: 1,
        code: 200,
        error: false,
        message: ["Thanks for booking EV presale testing! We`ll be in touch shortly. We appreciate your trust in PlusX electric"],
        request_id: bookingId,
    });
};

export const evPreSaleList = async (req, resp) => {
    const {rider_id, page_no, mobile_no, vehicle } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    let whereField = ['rider_id'];
    let whereValue = [rider_id];

    if(mobile_no){
        whereField.push('mobile_no');
        whereValue.push(`%${mobile_no}%`);
    }
    if(vehicle){
        whereField.push('vehicle');
        whereValue.push(`%${vehicle}%`);
    }

    const result = await getPaginatedData({
        tableName: 'ev_pre_sale_testing',
        columns: `booking_id, owner_name, date_of_birth, country, country_code, mobile_no, vehicle, slot_date, created_at,
            (select concat(vehicle_model, "-", vehicle_make) from riders_vehicles as rv where rv.vehicle_id = ev_pre_sale_testing.vehicle) AS vehicle_data,
            (select concat(start_time, "-", end_time) from ev_pre_sale_testing_slot as slt where slt.slot_id = ev_pre_sale_testing.slot_time_id) AS slot_time
            `,
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
        whereField,
        whereValue,
        whereOperator: ['=', 'LIKE', 'LIKE'],
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Ev pre sale booking list fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });
};

export const evPreSaleDetails = async (req, resp) => {
    const {rider_id, booking_id } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], booking_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const sale = await queryDB(`
        SELECT 
            ev_pre_sale_testing.*,
            (select concat(vehicle_model, "-", vehicle_make) from riders_vehicles as rv where rv.vehicle_id = ev_pre_sale_testing.vehicle) as vehicle_data,
            (select concat(start_time, "-", end_time) from ev_pre_sale_testing_slot as slt where slt.slot_id = ev_pre_sale_testing.slot_time_id) AS slot_time
        FROM 
            ev_pre_sale_testing
        WHERE
            rider_id = ? AND booking_id = ?
        LIMIT 1
    `, [rider_id, booking_id]);

    return resp.json({
        message: [ "Ev pre sale booking details fetch successfully!" ],
        insurance_data: sale,
        status: 1, 
        code: 200, 
    });
};

export const preSaleSlotList = async (req, resp) => {
    const [slot] = await db.execute(`SELECT slot_id, slot_name, start_time, end_time, booking_limit FROM ev_pre_sale_testing_slot WHERE status = ? ORDER BY id ASC`, [1]);

    let result = {};
    
    slot.forEach((element) => {
        if (!result[element.slot_name]) result[element.slot_name] = [];

        result[element.slot_name].push({
            slot_id: element.slot_id,
            slot_name: element.slot_name,
            slot_time: `${moment(element.start_time, 'HH:mm:ss').format('hh:mm A')} - ${moment(element.end_time, 'HH:mm:ss').format('hh:mm A')}`,
            booking_limit: element.booking_limit,
            total_booking: 0,
            start_time: moment(element.start_time, 'HH:mm:ss').format('HH:mm:ss'),
            end_time: moment(element.end_time, 'HH:mm:ss').format('HH:mm:ss')
        });
    });

    return resp.json({
        message: ["Slot List fetched successfully!"],
        data: result,
        status: 1,
        code: 200
    });
};
