// import path from 'path';
import moment from "moment";
import dotenv from 'dotenv';
import 'moment-duration-format';
// import { fileURLToPath } from 'url';
import emailQueue from "../../emailQueue.js";
import validateFields from "../../validation.js";
import { insertRecord, queryDB, getPaginatedData, updateRecord } from '../../dbUtils.js';
import db, { startTransaction, commitTransaction, rollbackTransaction } from "../../config/db.js";
import { createNotification, mergeParam, pushNotification, formatDateTimeInQuery, asyncHandler, formatDateInQuery } from "../../utils.js";
dotenv.config();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

export const getChargingServiceSlotList = asyncHandler(async (req, resp) => {
    const { slot_date } = mergeParam(req);
    if(!slot_date) return resp.json({status:0, code:422, message: ['slot date is required']});
    
    const fSlotDate = moment(slot_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
    let query = `SELECT slot_id, ${formatDateInQuery([('slot_date')])}, start_time, end_time, booking_limit`;
    
    if(fSlotDate >=  moment().format('YYYY-MM-DD')){
        query += `, (SELECT COUNT(id) FROM charging_service AS cs WHERE DATE(cs.slot_date_time) = '${slot_date}' AND TIME(slot_date_time) = pick_drop_slot.start_time AND order_status NOT IN ("WC", "C", "PNR") ) AS slot_booking_count`;
    }
    query += ` FROM pick_drop_slot WHERE status = ? AND slot_date = ? ORDER BY start_time ASC`;

    const [slot] = await db.execute(query, [1, fSlotDate]);

    return resp.json({ 
        message : "Slot List fetch successfully!",  data: slot, status: 1, code: 200,
        alert2  : "The slots for your selected date are fully booked. Please choose another date to book our valet service for your EV."
    });
});

export const requestService = asyncHandler(async (req, resp) => {
    
    const { rider_id, name, country_code, contact_no, pickup_address, pickup_latitude, pickup_longitude, parking_number, parking_floor, vehicle_id, slot_date_time, slot_id, coupan_code = '', price = '', order_status='PNR' } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id         : ["required"],
        name             : ["required"],
        country_code     : ["required"],
        contact_no       : ["required"],
        slot_id          : ["required"],
        pickup_address   : ["required"],
        pickup_latitude  : ["required"],
        pickup_longitude : ["required"],
        vehicle_id       : ["required"],
        parking_number   : ["required"],
        parking_floor    : ["required"],
        slot_date_time   : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const conn = await startTransaction();
    try{
        const fSlotDateTime = moment(slot_date_time, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
        const currDateTime  = moment().utcOffset(4).format('YYYY-MM-DD HH:mm:ss');
        if (fSlotDateTime < currDateTime) return resp.json({status: 0, code: 422, message: ["Invalid slot, Please select another slot"]});
        
        const rider = await queryDB(`SELECT fcm_token, rider_name, rider_email,
            (SELECT MAX(id) FROM charging_service) AS last_index,
            (SELECT booking_limit FROM pick_drop_slot AS pds WHERE pds.slot_id=?) AS booking_limit,
            (select count(id) from charging_service as cs where cs.slot_date_time = ? and order_status NOT IN ("WC", "C", "PNR") ) as slot_booking_count FROM riders WHERE rider_id=? LIMIT 1
        `, [slot_id, slot_date_time, rider_id]);

        if(rider.slot_booking_count >= rider.booking_limit) return resp.json({status: 1, code: 405, message: ["Booking Slot Full!, please select another slot"]});
        
        const nextId       = (!rider.last_index) ? 0 : rider.last_index + 1;
        const requestId    = 'CS' + String(nextId).padStart(4, '0');
        const slotDateTime = moment(slot_date_time).format('YYYY-MM-DD HH:mm:ss');
        // const fslotDateTime = moment(slot_date_time).format('D MMM, YYYY, h:mm A');

        const insert       = await insertRecord('charging_service', [
            'request_id', 'rider_id', 'name', 'country_code', 'contact_no', 'vehicle_id', 'slot', 'slot_date_time', 'pickup_address', 'parking_number', 'parking_floor', 
            'price', 'order_status', 'pickup_latitude', 'pickup_longitude', 
        ],[
            requestId, rider_id, name, country_code, contact_no, vehicle_id, slot_id, slotDateTime, pickup_address, parking_number, parking_floor, price, 
            order_status, pickup_latitude, pickup_longitude
        ], conn);

        if(insert.affectedRows === 0) return resp.json({status:0, code:200, message: ["Oops! Something went wrong. Please try again."]}); 

        // if(coupan_code){
        //     await insertRecord('coupon_usage', ['coupan_code', 'user_id', 'booking_id'], [coupan_code, rider_id, requestId], conn);
        // }
        
        // await insertRecord('charging_service_history', ['service_id', 'rider_id', 'order_status'], [requestId, rider_id, 'CNF'], conn);
    
        // const href = 'charging_service/' + requestId;
        // const heading = 'EV Valet Charging Service Booking!';
        // const desc = `Booking Confirmed! ID: ${requestId}.`;
        // createNotification(heading, desc, 'Charging Service', 'Rider', 'Admin','', rider_id, href);
        // pushNotification(rider.fcm_token, heading, desc, 'RDRFCM', href);
    
        // // const formattedDateTime = moment().format('DD MMM YYYY hh:mm A');
        // const formattedDateTime =  moment().utcOffset('+04:00').format('DD MMM YYYY hh:mm A');

        // const htmlUser = `<html>
        //     <body>
        //         <h4>Dear ${name},</h4>
        //         <p>Thank you for choosing our EV Pickup and Drop Off service. We are pleased to confirm that your booking has been successfully received.</p>
        //         Booking Details:
        //         <br>
        //         <ul>
        //         <li>Booking ID: ${requestId}</li>
        //         <li>Date and Time of Service : ${fslotDateTime}</li>
        //         <li>Address : ${pickup_address}</li>
        //         </ul>
        //         <p>We look forward to serving you and providing a seamless EV experience.</p>   
        //         <p>Best Regards,<br/> PlusX Electric Team </p>
        //     </body>
        // </html>`;
        // emailQueue.addEmail(rider.rider_email, 'PlusX Electric App: Booking Confirmation for Your EV Pickup and Drop Off Service', htmlUser);
        
        // const htmlAdmin = `<html>
        //     <body>
        //         <h4>Dear Admin,</h4>
        //         <p>We have received a new booking for our Valet Charging service via the PlusX app. Below are the details:</p> 
        //         Customer Name  : ${name}<br>
        //         Pickup & Drop Address : ${pickup_address}<br>
        //         Booking Date & Time : ${formattedDateTime}<br>                
        //         <p> Best regards,<br/> PlusX Electric Team </p>
        //     </body>
        // </html>`;
        // emailQueue.addEmail(process.env.MAIL_CS_ADMIN, `Valet Charging Service Booking Received - ${requestId}`, htmlAdmin);
        
        // let responseMsg = 'Booking request submitted! Our team will be in touch with you shortly.';
    
        await commitTransaction(conn);
    
        return resp.json({
            message    : ["Booking Request Received!."],
            status     : 1,
            service_id : requestId,
            code       : 200,
        });
    }catch(err){
        await rollbackTransaction(conn);
        console.error("Transaction failed:", err);
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    } finally {
        if (conn) conn.release();
    }
});

export const listServices = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, bookingStatus } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit = 10;
    const start = (page_no[0] * limit) - limit;

    // const statusCondition = (history && history == 1) ? `order_status IN (?, ?)` : `order_status NOT IN (?, ?)`;
    // const statusParams = ['WC', 'C'];
    let statusCondition = `order_status IN (?)`;
    let statusParams    =  (bookingStatus == 'C' ) ? ['C'] : ['WC'];
    statusParams        =  (bookingStatus == 'S' ) ? ['CNF'] : statusParams;

    const totalQuery = `SELECT COUNT(*) AS total FROM charging_service WHERE rider_id = ? AND ${statusCondition}`;
    const [totalRows] = await db.execute(totalQuery, [rider_id, ...statusParams]);
    const total = totalRows[0].total;
    const totalPage = Math.max(Math.ceil(total / limit), 1);
    
    const formatCols = ['slot_date_time', 'created_at'];
    const servicesQuery = `SELECT request_id, name, country_code, contact_no, slot, ROUND(charging_service.price / 100, 2) AS price, pickup_address, order_status, ${formatDateTimeInQuery(formatCols)} 
    FROM charging_service WHERE rider_id = ? AND ${statusCondition} ORDER BY id DESC LIMIT ${parseInt(start)}, ${parseInt(limit)}
    `;
    const [serviceList] = await db.execute(servicesQuery, [rider_id, ...statusParams]);

    const inProcessQuery = `SELECT request_id, name, country_code, contact_no, slot, ROUND(charging_service.price / 100, 2) AS price, pickup_address, order_status, ${formatDateTimeInQuery(formatCols)} 
    FROM charging_service WHERE rider_id = ? AND ${statusCondition} ORDER BY id DESC LIMIT ${parseInt(start)}, ${parseInt(limit)}
    `;
    const inProcessParams        = ['CNF', 'C', 'WC'];
    const [inProcessBookingList] = await db.execute(inProcessQuery, [rider_id, inProcessParams]);

    return resp.json({
        message    : ["Charging Service List fetch successfully!"],
        data       : serviceList,
        total_page : totalPage,
        inProcessBookingList,
        total,
        status : 1,
        code   : 200,
    });
});

export const getServiceOrderDetail = asyncHandler(async (req, resp) => {
    const {rider_id, service_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], service_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const formatCols = ['created_at', 'updated_at']; // 'slot_date_time', 
    
    const order = await queryDB(`
        SELECT 
            charging_service.*, 
            ROUND(charging_service.price / 100, 2) AS price, 
            (select concat(vehicle_make, "-", vehicle_model) from riders_vehicles as rv where rv.vehicle_id = charging_service.vehicle_id limit 1) as vehicle_data, 
            ${formatDateTimeInQuery(formatCols)} 
        FROM charging_service 
        WHERE request_id = ? 
        LIMIT 1
    `, [service_id]);
    // formatCols.shift();
    const [history] = await db.execute(`SELECT *, ${formatDateTimeInQuery(formatCols)} FROM charging_service_history WHERE service_id = ?`, [service_id]);

    if(order){
        order.invoice_url = '';
        order.slot = 'Schedule';
        if (order.order_status == 'WC') {
            const invoiceId = order.request_id.replace('CS', 'INVCS');
            order.invoice_url = `${req.protocol}://${req.get('host')}/public/pick-drop-invoice/${invoiceId}-invoice.pdf`;
        }
    }
    order.slot_date_time = moment(order.slot_date_time ).format('YYYY-MM-DD HH:mm:ss');
    return resp.json({
        message: ["Service Order Details fetched successfully!"],
        order_data: order,
        order_history: history,
        status: 1,
        code: 200,
    });
});

/* Invoice */
export const getInvoiceList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, orderStatus } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    let whereField = ['rider_id'];
    let whereValue = [rider_id];

    if(orderStatus){
        whereField.push('payment_status');
        whereValue.push(orderStatus);
    }

    const result = await getPaginatedData({
        tableName: 'charging_service_invoice',
        columns: `invoice_id, amount, payment_status, invoice_date, currency, 
            (select concat(name, ",", country_code, "-", contact_no) from charging_service as cs where cs.request_id = charging_service_invoice.request_id limit 1)
            AS riderDetails`,
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
        whereField,
        whereValue
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Pick & Drop Invoice List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
        base_url: `${req.protocol}://${req.get('host')}/uploads/pick-drop-invoice/`,
    });
});
export const getInvoiceDetail = asyncHandler(async (req, resp) => {
    const {rider_id, invoice_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], invoice_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoice = await queryDB(`SELECT 
        invoice_id, amount as price, payment_status, invoice_date, currency, payment_type, cs.name, cs.country_code, cs.contact_no, cs.pickup_address, cs.vehicle_id, 
        cs.request_id, cs.slot_date_time, (select concat(vehicle_make, "-", vehicle_model) from riders_vehicles as rv where rv.vehicle_id = cs.vehicle_id limit 1) as vehicle_data
        FROM 
            charging_service_invoice AS csi
        LEFT JOIN
            charging_service AS cs ON cs.request_id = csi.request_id
        WHERE 
            csi.invoice_id = ?
    `, [invoice_id]);

    invoice.invoice_url = `${req.protocol}://${req.get('host')}/public/pick-drop-invoice/${invoice_id}-invoice.pdf`;

    return resp.json({
        message: ["Pick & Drop Invoice Details fetch successfully!"],
        data: invoice,
        status: 1,
        code: 200,
    });
});

/* User Booking Cancel */
export const cancelValetBooking = asyncHandler(async (req, resp) => {
    const { rider_id, booking_id, reason='' } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], booking_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const checkOrder = await queryDB(`
        SELECT 
            name, rsa_id, DATE_FORMAT(slot_date_time, '%Y-%m-%d %H:%i:%s') AS slot_date_time,
            CONCAT( country_code, "-", contact_no) as contact_no, 
            (SELECT rd.rider_email FROM riders AS rd WHERE rd.rider_id = cs.rider_id) AS rider_email,
            (SELECT rd.rider_name FROM riders AS rd WHERE rd.rider_id = cs.rider_id) AS rider_name,
            (SELECT fcm_token FROM riders WHERE rider_id = cs.rider_id) AS fcm_token,
            (select fcm_token from rsa where rsa.rsa_id = cs.rsa_id ) as rsa_fcm_token
        FROM 
            charging_service AS cs
        WHERE 
            request_id = ? AND rider_id = ? AND order_status IN ('CNF','A','ER') 
        LIMIT 1
    `,[booking_id, rider_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }
    
    const insert = await db.execute(
        'INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, cancel_by, cancel_reason) VALUES (?, ?, "C", ?, "User", ?)',
        [booking_id, rider_id, checkOrder.rsa_id, reason]
    );
    if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

    await updateRecord('charging_service', {order_status: 'C'}, ['request_id'], [booking_id]);
    
    const href    = `charging_service/${booking_id}`;
    const title   = 'Valet Service Cancel!';
    const message = `Pickup and Drop Off EV Charging : Booking ID ${booking_id} - ${checkOrder.rider_name} cancelled the booking.`;
    await createNotification(title, message, 'Charging Service', 'Admin', 'Rider', rider_id, '', href);


    if( checkOrder.rsa_id) {
        await db.execute(`DELETE FROM charging_service_assign WHERE rider_id=? AND order_id = ?`, [rider_id, booking_id]);
        await db.execute('UPDATE rsa SET running_order = running_order - 1 WHERE rsa_id = ?', [checkOrder.rsa_id]);
    }

    const html = `<html>
        <body>
            <h4>Dear ${checkOrder.rider_name},</h4>
            <p>We would like to inform you that your booking for the EV Pickup and Drop Off charging service has been successfully cancelled. Below are the details of your cancelled booking:</p>
            Booking ID    : ${booking_id}<br>
            Date and Time : ${moment(checkOrder.slot_date_time, 'YYYY-MM-DD HH:mm:ss').format('D MMM, YYYY, h:mm A')}
            <p>If this cancellation was made in error or if you wish to reschedule, please feel free to reach out to us. We're happy to assist you.</p>
            <p>Thank you for using PlusX Electric. We hope to serve you again soon.</p>
            <p>Best regards,<br/>PlusX Electric Team </p>
        </body>
    </html>`;
    emailQueue.addEmail(checkOrder.rider_email, `PlusX Electric App: Booking Cancellation`, html);

    const adminHtml = `<html>
        <body>
            <h4>Dear Admin,</h4>
            <p>This is to notify you that a customer has canceled their PlusX Electric Pickup and Drop-Off EV Charging Service booking. Please find the details below:</p>
            <p>Booking Details:</p>
            Name         : ${checkOrder.name}<br>
            Contact      : ${checkOrder.contact_no}<br>
            Booking ID   : ${booking_id}<br>
            Booking Date : ${checkOrder.slot_date_time}<br> 
            Reason       : ${checkOrder.cancel_reason}<br>
            <p>Thank you,<br/>PlusX Electric Team </p>
        </body>
    </html>`;
    emailQueue.addEmail(process.env.MAIL_CS_ADMIN, `Pickup & Drop-Off Charging Service : Booking Cancellation `, adminHtml);

    return resp.json({ message: ['Booking has been cancelled successfully!'], status: 1, code: 200 });
});


