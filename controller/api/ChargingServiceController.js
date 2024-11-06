import db, { startTransaction, commitTransaction, rollbackTransaction } from "../../config/db.js";
import validateFields from "../../validation.js";
import { insertRecord, queryDB, getPaginatedData, updateRecord } from '../../dbUtils.js';
import moment from "moment";
import 'moment-duration-format';
import { createNotification, mergeParam, pushNotification, formatDateTimeInQuery, asyncHandler } from "../../utils.js";
import emailQueue from "../../emailQueue.js";

export const getChargingServiceSlotList = asyncHandler(async (req, resp) => {
    const [slot] = await db.execute(`SELECT *, ${formatDateTimeInQuery(['created_at', 'updated_at'])}  FROM pick_drop_slot WHERE status = ?`, [1]);
    return resp.json({
        message: [ "Slot List fetch successfully!" ], 
        data: slot,
        status: 1,
        code: 200
    });
});

export const requestService = asyncHandler(async (req, resp) => {
    const { rider_id, name, country_code, contact_no, slot_id, pickup_address, pickup_latitude, pickup_longitude,vehicle_id, parking_number, parking_floor, 
        slot_date_time, coupan_code, price = '', order_status = 'CNF'
    } = mergeParam(req);
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
        const rider = await queryDB(`SELECT fcm_token, rider_name, rider_email,
            (SELECT MAX(id) FROM charging_service) AS last_index,
            (SELECT booking_limit FROM pick_drop_slot AS pds WHERE pds.slot_id=?) AS booking_limit,
            (select count(id) from charging_service as cs where cs.slot_date_time = ? and order_status NOT IN ("WC", "C") ) as slot_booking_count FROM riders WHERE rider_id=? LIMIT 1
        `, [slot_id, slot_date_time, rider_id]);

        if(rider.slot_booking_count >= rider.booking_limit) return resp.json({status: 1, code: 405, message: ["Booking Slot Full!, please select another slot"]});
        
        const nextId       = (!rider.last_index) ? 0 : rider.last_index + 1;
        const requestId    = 'CS' + String(nextId).padStart(4, '0');
        const slotDateTime = moment(slot_date_time).format('YYYY-MM-DD HH:mm:ss');
        const insert       = await insertRecord('charging_service', [
            'request_id', 'rider_id', 'name', 'country_code', 'contact_no', 'vehicle_id', 'slot', 'slot_date_time', 'pickup_address', 'parking_number', 'parking_floor', 
            'price', 'order_status', 'pickup_latitude', 'pickup_longitude', 
        ],[
            requestId, rider_id, name, country_code, contact_no, vehicle_id, slot_id, slotDateTime, pickup_address, parking_number, parking_floor, price, 
            order_status, pickup_latitude, pickup_longitude
        ], conn);

        if(insert.affectedRows === 0) return resp.json({status:0, code:200, message: ["Oops! Something went wrong. Please try again."]}); 

        if(coupan_code){
            await insertRecord('coupon_usage', ['coupan_code', 'user_id', 'booking_id'], [coupan_code, rider_id, requestId], conn);
        }
        // await conn.execute(`UPDATE pick_drop_slot SET booking_limit = booking_limit - 1 WHERE slot_id = ?`, [slot_id]);
        await insertRecord('charging_service_history', ['service_id', 'rider_id', 'order_status'], [requestId, rider_id, 'CNF'], conn);
    
        const href = 'charging_service/' + requestId;
        const heading = 'Valet charging service created!';
        const desc = `Your booking the Valet Charging service booking id: ${requestId} has been placed.`;
        createNotification(heading, desc, 'Charging Service', 'Rider', 'Admin','', rider_id, href);
        pushNotification(rider.fcm_token, heading, desc, 'RDRFCM', href);
    
        const formattedDateTime = moment().format('DD MMM YYYY hh:mm A');
        /* 
        const htmlUser = `<html>
            <body>
                <h4>Dear ${name},</h4>
                <p>Thank you for booking our Valet Charging Service for your EV. We have successfully received your booking request. Below are the details of your booking. Additionally, please find the attached invoice for your reference.</p> 
                <p> Regards,<br/> PlusX Electric App Team </p>
            </body>
        </html>`;
        emailQueue.addEmail(rider.rider_email, 'Your Valet Charge Booking Confirmation', htmlUser); */
        
        const htmlAdmin = `<html>
            <body>
                <h4>Dear Admin,</h4>
                <p>We have received a new booking for our Valet Charging service via the PlusX app. Below are the details:</p> 
                <p>Customer Name  : ${name}</p>
                <p>Pickup & Drop Address : ${pickup_address}</p>
                <p>Booking Date & Time : ${formattedDateTime}</p> <br/>                        
                <p> Best regards,<br/> PlusX Electric App </p>
            </body>
        </html>`;
        emailQueue.addEmail('valetbookings@plusxelectric.com', `Valet Charging Service Booking Received - ${requestId}`, htmlAdmin);
        
        const rsa = await queryDB(`SELECT rsa_id, fcm_token FROM rsa WHERE status = ? AND booking_type = ? LIMIT 1`, [2, 'Valet Charging']);
        let responseMsg = 'Booking Request Submitted! Our team will be in touch with you shortly.';
    
        if(rsa){
            await insertRecord('charging_service_assign', ['order_id', 'rsa_id', 'rider_id', 'slot_date_time', 'status'], [requestId, rsa.rsa_id, rider_id, slotDateTime, '0']);
            await conn.execute(`UPDATE charging_service SET rsa_id = ? WHERE request_id = ?`, [rsa.rsa_id, requestId]);
    
            const heading1 = 'Valet Charging Service';
            const desc1 = `A Booking of the Valet Charging service has been assigned to you with booking id : ${requestId}`;
            createNotification(heading1, desc1, 'Charging Service', 'Rider', 'Admin','', rider_id, href);
            pushNotification(rsa.fcm_token, heading1, desc1, 'RSAFCM', href);
        }

        await commitTransaction(conn);
    
        return resp.json({
            message: [responseMsg],
            status: 1,
            service_id: requestId,
            code: 200,
        });
    }catch(err){
        await rollbackTransaction(conn);
        console.error("Transaction failed:", err);
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }finally{
        if (conn) conn.release();
    }
});

export const listServices = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, history } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit = 10;
    const start = (page_no[0] * limit) - limit;
    const statusCondition = (history && history == 1) ? `order_status IN (?, ?)` : `order_status NOT IN (?, ?)`;
    const statusParams = ['WC', 'C'];

    const totalQuery = `SELECT COUNT(*) AS total FROM charging_service WHERE rider_id = ? AND ${statusCondition}`;
    const [totalRows] = await db.execute(totalQuery, [rider_id, ...statusParams]);
    const total = totalRows[0].total;
    const totalPage = Math.max(Math.ceil(total / limit), 1);
    
    const formatCols = ['slot_date_time', 'created_at'];
    const servicesQuery = `SELECT request_id, name, country_code, contact_no, slot, price, pickup_address, order_status, ${formatDateTimeInQuery(formatCols)} 
    FROM charging_service WHERE rider_id = ? AND ${statusCondition} ORDER BY id DESC LIMIT ${parseInt(start)}, ${parseInt(limit)}
    `;
    
    const [serviceList] = await db.execute(servicesQuery, [rider_id, ...statusParams]);

    return resp.json({
        message: ["Charging Service List fetch successfully!"],
        data: serviceList,
        total_page: totalPage,
        total,
        status: 1,
        code: 200,
    });
});

export const getServiceOrderDetail = asyncHandler(async (req, resp) => {
    const {rider_id, service_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], service_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const formatCols = ['slot_date_time', 'created_at', 'updated_at'];
    
    const order = await queryDB(`SELECT charging_service.*, (select concat(vehicle_make, "-", vehicle_model) from riders_vehicles as rv where rv.vehicle_id = charging_service.vehicle_id) as vehicle_data, ${formatDateTimeInQuery(formatCols)} FROM charging_service WHERE request_id = ? LIMIT 1`, [service_id]);
    formatCols.shift();
    const [history] = await db.execute(`SELECT *, ${formatDateTimeInQuery(formatCols)} FROM charging_service_history WHERE service_id = ?`, [service_id]);

    // order.invoice_url = '';
    order.slot = 'Schedule';
    if (order.order_status == 'WC') {
        const invoiceId = order.request_id.replace('CS', 'INVCS');
        order.invoice_url = `${req.protocol}://${req.get('host')}/public/pick-drop-invoice/${invoiceId}-invoice.pdf`;
    }

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
    const {rider_id, page_no, orderStatus } = mergeparam(req);
    const { isValid, errors } = validateFields(mergeparam(req), {rider_id: ["required"], page_no: ["required"]});
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
    const {rider_id, invoice_id } = mergeparam(req);
    const { isValid, errors } = validateFields(mergeparam(req), {rider_id: ["required"], invoice_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoice = await queryDB(`SELECT 
        invoice_id, amount as price, payment_status, invoice_date, currency, payment_type, cs.name, cs.country_code, cs.contact_no, cs.pickup_address, cs.vehicle_id, 
        cs.request_id, cs.slot_date_time, (select concat(vehicle_make, "-", vehicle_model) from riders_vehicles as rv where rv.vehicle_id = cs.vehicle_id) as vehicle_data
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

/* RSA */
export const getRsaBookingStage = asyncHandler(async (req, resp) => {
    const {rsa_id, booking_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rsa_id: ["required"], booking_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const booking = await queryDB(`SELECT order_status, created_at, updated_at FROM charging_service WHERE request_id=?`, [booking_id]);
    if(!booking) return resp.json({status:0, code:200, message: "Sorry no data found with given order id: " + booking_id}); 

    const orderStatus = ['CNF','A', 'VP', 'RS','CC','DO','WC', 'C']; //order_status 
    const placeholders = orderStatus.map(() => '?').join(', ');

    const [bookingTracking] = await db.execute(`SELECT order_status, remarks, image, cancel_reason, cancel_by, longitude, latitude FROM charging_service_history 
        WHERE service_id = ? AND rsa_id = ? AND order_status IN (${placeholders})
    `, [booking_id, rsa_id, ...orderStatus]);

    const seconds = Math.floor((booking.updated_at - booking.created_at) / 1000);
    const humanReadableDuration = moment.duration(seconds, 'seconds').format('h [hours], m [minutes]');
    
    return resp.json({
        status          : 1,
        code            : 200,
        message         : ["Booking stage fetch successfully."],
        booking_status  : booking.order_status,
        execution_time  : humanReadableDuration,
        booking_history : bookingTracking,
        image_path      : `${req.protocol}://${req.get('host')}/uploads/pick-drop-images/`
    });
});

export const handleBookingAction = asyncHandler(async (req, resp) => {
    const {rsa_id, booking_id, reason, latitude, longitude, booking_status } = req.body;

    let validationRules = {
        rsa_id         : ["required"], 
        booking_id     : ["required"], 
        latitude       : ["required"], 
        longitude      : ["required"], 
        booking_status : ["required"],
    };
    if (booking_status == "C") {
        validationRules = {
            ...validationRules,
            reason  : ["required"], 
        };
    }
    // const { isValid, errors } = validateFields(mergeParam(req), validationRules);
    const { isValid, errors } = validateFields(req.body, validationRules);
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    switch (booking_status) {
        case 'A': return await acceptBooking(req, resp);
        case 'ER': return await driverEnroute(req, resp);
        case 'VP': return await vehiclePickUp(req, resp);
        case 'RS': return await reachedLocation(req, resp);
        case 'CC': return await chargingComplete(req, resp);
        case 'DO': return await vehicleDrop(req, resp);
        case 'WC': return await workComplete(req, resp);
        default: return resp.json({status: 0, code: 200, message: ['Invalid booking status.']});
    }
});

export const handleRejectBooking = asyncHandler(async (req, resp) => {
    const {rsa_id, booking_id, reason, latitude='', longitude='' } = req.body;
    const { isValid, errors } = validateFields(req.body, {rsa_id: ["required"], booking_id: ["required"], reason: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token
        FROM 
            charging_service_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const insert = await db.execute(
        'INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "C", ?, ?, ?)',
        [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
    );

    if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

    await insertRecord('charging_service_rejected', ['booking_id', 'rsa_id', 'rider_id', 'reason'],[booking_id, rsa_id, checkOrder.rider_id, reason]);
    await db.execute(`DELETE FROM charging_service_assign WHERE order_id=? AND rsa_id=?`, [booking_id, rsa_id]);

    const href = `charging_service/${booking_id}`;
    const title = 'Booking Rejected';
    const message = `Driver has rejected the valet service booking with booking id: ${booking_id}`;
    await createNotification(title, message, 'Charging Service', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
    await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

    const html = `<html>
        <body>
            <h4>Dear Admin,</h4>
            <p>Driver has rejected the valet service booking. please assign one Driver on this booking</p> <br />
            <p>Booking ID: ${booking_id}</p>
            <p> Regards,<br/> PlusX Electric App </p>
        </body>
    </html>`;
    emailQueue.addEmail('valetbookings@plusxelectric.com', `Valet Charging Service Booking rejected - ${booking_id}`, html);

    return resp.json({ message: ['Booking has been rejected successfully!'], status: 1, code: 200 });
});

// cs booking action helper
const acceptBooking = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude, booking_status } = req.body;

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token,
            (SELECT COUNT(id) FROM charging_service_assign WHERE rsa_id = ? AND status = 1) AS count
        FROM 
            charging_service_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[rsa_id, booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }
    if (checkOrder.count > 0) {
        return resp.json({ message: ['You have already one booking, please complete that first!'], status: 0, code: 404 });
    }
    const ordHistoryCount = await queryDB(
        `SELECT COUNT(*) as count FROM charging_service_history WHERE rsa_id = ? AND order_status = "A" AND service_id = ?`,[rsa_id, booking_id]
    );
    if (ordHistoryCount.count === 0) {
        await updateRecord('charging_service', {order_status: 'A', rsa_id}, ['request_id'], [booking_id]);

        const href = `charging_service/${booking_id}`;
        const title = 'Booking Accepted';
        const message = `Driver has accepted your booking with booking id: ${booking_id} and he is enroute now`;
        await createNotification(title, message, 'Charging Service', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        const insert = await db.execute(
            `INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "A", ?, ?, ?)`,
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await db.execute('UPDATE rsa SET running_order = running_order + 1 WHERE rsa_id = ?', [rsa_id]);
        await db.execute('UPDATE charging_service_assign SET status = 1 WHERE order_id = ? AND rsa_id = ?', [booking_id, rsa_id]);

        return resp.json({ message: ['POD Booking accepted successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const driverEnroute = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;
    
    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token 
        FROM 
            charging_service_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);
  
    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }
    const ordHistoryCount = await queryDB(
        `SELECT COUNT(*) as count FROM charging_service_history WHERE rsa_id = ? AND order_status = "ER" AND service_id = ?`,[rsa_id, booking_id]
    );
    if (ordHistoryCount.count === 0) {
        await updateRecord('charging_service', {order_status: 'ER'}, ['request_id'], [booking_id]);

        const href    = `charging_service/${booking_id}`;
        const title   = 'PlusX team is on the way!';
        const message = `PlusX team is on the way! Please have your EV ready for charging.`;
        await createNotification(title, message, 'Charging Service', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        const insert = await db.execute(
            `INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "ER", ?, ?, ?)`,
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );
        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        return resp.json({ message: ['Booking Status changed successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const vehiclePickUp = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token
        FROM 
            charging_service_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[ booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM charging_service_history WHERE rsa_id = ? AND order_status = "VP" AND service_id = ?',[rsa_id, booking_id]
    );

    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            'INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, latitude, longitude, image) VALUES (?, ?, "VP", ?, ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude, '']
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('charging_service', {order_status: 'VP', rsa_id}, ['request_id'], [booking_id]);

        const href = `charging_service/${booking_id}`;
        const title = 'Vehicle Pickup';
        const message = `Your vehicle picked-up for charging`;
        await createNotification(title, message, 'Charging Service', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Vehicle picked-up successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const reachedLocation = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token
        FROM 
            charging_service_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM charging_service_history WHERE rsa_id = ? AND order_status = "RS" AND service_id = ?',[rsa_id, booking_id]
    );

    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            'INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "RS", ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('charging_service', {order_status: 'RS', rsa_id}, ['request_id'], [booking_id]);

        const href = `charging_service/${booking_id}`;
        const title = 'Reached Charging Spot';
        const message = `Your vehicle reached at charging spot`;
        await createNotification(title, message, 'Charging Service', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Vehicle reached at charging spot successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const chargingComplete = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token
        FROM 
            charging_service_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM charging_service_history WHERE rsa_id = ? AND order_status = "CC" AND service_id = ?',[rsa_id, booking_id]
    );

    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            'INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "CC", ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('charging_service', {order_status: 'CC', rsa_id}, ['request_id'], [booking_id]);

        const href = `charging_service/${booking_id}`;
        const title = 'Charging Completed!';
        const message = `Your Vehicle Charging Completed!`;
        await createNotification(title, message, 'Charging Service', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Vehicle charging completed! successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const vehicleDrop = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token
        FROM 
            charging_service_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM charging_service_history WHERE rsa_id = ? AND order_status = "DO" AND service_id = ?',[rsa_id, booking_id]
    );

    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            'INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, latitude, longitude, image) VALUES (?, ?, "DO", ?, ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude, '']
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('charging_service', {order_status: 'DO', rsa_id}, ['request_id'], [booking_id]);

        const href = `charging_service/${booking_id}`;
        const title = 'Vehicle Drop Off';
        const message = 'Your vehicle drop-off completed!';
        await createNotification(title, message, 'Charging Service', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Vehicle drop-off successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const workComplete = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

    if (!req.files.image) return resp.status(405).json({ message: "Vehicle Image is required", status: 0, code: 405, error: true });
    const imgName = req.files.image[0].filename; 
    
    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token,
            (select slot from charging_service as cs where cs.request_id = charging_service_assign.order_id ) as slot_id
        FROM 
            charging_service_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }
    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM charging_service_history WHERE rsa_id = ? AND order_status = "WC" AND service_id = ?',[rsa_id, booking_id]
    );

    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            'INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, latitude, longitude, image) VALUES (?, ?, "WC", ?, ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude, imgName]
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('charging_service', {order_status: 'WC', rsa_id}, ['request_id'], [booking_id]);
        await db.execute(`DELETE FROM charging_service_assign WHERE rsa_id=? AND order_id = ?`, [rsa_id, booking_id]);
        await db.execute('UPDATE rsa SET running_order = running_order - 1 WHERE rsa_id = ?', [rsa_id]);
        // await db.execute('UPDATE pick_drop_slot SET booking_limit = booking_limit + 1 WHERE slot_id = ?', [checkOrder.slot_id]);

        const href    = `charging_service/${booking_id}`;
        const title   = 'Work Complete';
        const message = `Driver has successfully completed your charging service booking with booking id : ${booking_id}`;
        await createNotification(title, message, 'Charging Service', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Work completed! successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};

export const cancelValetBooking = asyncHandler(async (req, resp) => {
    const { rider_id, booking_id, reason } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], booking_id: ["required"], reason: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const checkOrder = await queryDB(`
        SELECT 
            name, rsa_id, slot_date_time,
            (select cancel_reason from charging_service_history as csh where csh.service_id = charging_service.request_id ) as cancel_reason, 
            concat( country_code, "-", contact_no) as contact_no, 
            (SELECT rd.rider_email FROM riders AS rd WHERE rd.rider_id = charging_service.rider_id) AS rider_email,
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service.rider_id) AS fcm_token,
            (select fcm_token from rsa where rsa.rsa_id = charging_service.rsa_id ) as rsa_fcm_token
        FROM 
            charging_service
        WHERE 
            request_id = ? AND rider_id = ? AND order_status IN ('CNF','A','ER') 
        LIMIT 1
    `,[booking_id, rider_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }
    /* handle file upload */
    const insert = await db.execute(
        'INSERT INTO charging_service_history (service_id, rider_id, order_status, rsa_id, cancel_by, cancel_reason) VALUES (?, ?, "C", ?, "User", ?)',
        [booking_id, rider_id, checkOrder.rsa_id, reason]
    );
    if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

    await updateRecord('charging_service', {order_status: 'C'}, ['request_id'], [booking_id]);
    const href    = `charging_service/${booking_id}`;
    const title   = 'Valet Service Cancel!';
    const message = `You have canceled the Valet Service booking with booking id : ${booking_id}`;
    await createNotification(title, message, 'Charging Service', 'Rider', 'Rider', rider_id, rider_id, href);
    await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

    if( checkOrder.rsa_id) {
        await db.execute(`DELETE FROM charging_service_assign WHERE rider_id=? AND order_id = ?`, [rider_id, booking_id]);
        await db.execute('UPDATE rsa SET running_order = running_order - 1 WHERE rsa_id = ?', [checkOrder.rsa_id]);

        const message1 = `A Booking of the Valet Service booking has been cancelled by user with booking id : ${booking_id}`;
        await createNotification(title, message1, 'Charging Service', 'RSA', 'Rider', rider_id, checkOrder.rsa_id,  href);
        await pushNotification(checkOrder.rsa_fcm_token, title, message1, 'RSAFCM', href);
    }
    const slot_date_time = moment(checkOrder.slot_date_time).format('YYYY-MM-DD');
    const html = `<html>
        <body>
            <h4>Dear ${checkOrder.user_name},</h4>
            <p>We've received your cancellation request for the PlusX Electric Pickup and Drop-Off EV Charging Service. Your booking has been successfully canceled. If you need assistance with rescheduling or have any questions, please feel free to reach out to us.</p> <br />

            <p>Booking Details:</p><br />

            <p>Booking ID    : ${booking_id}</p>
            <p>Booking Date : ${slot_date_time}</p>
            
            <p>Thank you for choosing PlusX Electric, and we hope to serve you in the future!</p><br />

            <p>Warm regards,<br/> The PlusX Electric Team </p>
        </body>
    </html>`;

    emailQueue.addEmail(checkOrder.rider_email, `Booking Cancellation Confirmation - PlusX Electric Pickup & Drop-Off Charging Service`, html);

    const adminHtml = `<html>
        <body>
            <h4>Dear Admin,</h4>
            <p>This is to notify you that a customer has canceled their PlusX Electric Pickup and Drop-Off EV Charging Service booking. Please find the details below:</p> <br />

            <p>Booking Details:</p><br />

            <p>Name         : ${checkOrder.name}</p>
            <p>Contact      : ${checkOrder.contact_no}</p>
            <p>Booking ID   : ${booking_id}</p>
            <p>Booking Date : ${checkOrder.slot_date_time}</p> 
            <p>Reason       : ${checkOrder.cancel_reason}</p> <br />

            <p>Thank you,<br/> The PlusX Electric Team </p>
        </body>
    </html>`;
    emailQueue.addEmail('valetbookings@plusxelectric.com', `Pickup & Drop-Off Charging Service : Booking Cancellation `, adminHtml);

    return resp.json({ message: ['Booking has been cancelled successfully!'], status: 1, code: 200 });
});
