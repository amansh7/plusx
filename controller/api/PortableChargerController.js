import path from 'path';
import moment from "moment";
import 'moment-duration-format';
import { fileURLToPath } from 'url';
import emailQueue from "../../emailQueue.js";
import validateFields from "../../validation.js";
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import db, { startTransaction, commitTransaction, rollbackTransaction } from "../../config/db.js";
import { asyncHandler, createNotification, formatDateInQuery, formatDateTimeInQuery, formatNumber, generatePdf, mergeParam, numberToWords, pushNotification } from "../../utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const chargerList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await getPaginatedData({
        tableName: 'portable_charger',
        columns: 'charger_id, charger_name, charger_price, charger_feature, image, charger_type',
        sortColumn: 'id',
        sortOrder: 'ASC',
        page_no,
        limit: 10,
        whereField: ['status'],
        whereValue: ['1']
    });

    const [slotData] = await db.execute(`SELECT slot_id, start_time, end_time, booking_limit FROM portable_charger_slot WHERE status = ?`, [1]);

    return resp.json({
        status: 1,
        code: 200,
        message: ["Portable Charger List fetch successfully!"],
        data: result.data,
        slot_data: slotData,
        total_page: result.totalPage,
        total: result.total,
        base_url: `${req.protocol}://${req.get('host')}/uploads/portable-charger/`,
    });
});

export const getActivePodList = asyncHandler(async (req, resp) => {
    const { booking_id, booking_type } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { booking_id: ["required"], booking_type: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if (!['PCB', 'CS'].includes(booking_type)) return resp.json({status:0, code:422, message:"Booking type should be PCB or CS"});

    let query;
    if(booking_type === 'PCB'){
        query = `SELECT latitude AS lat, longitude AS lon FROM portable_charger_booking WHERE booking_id = ?`;
    }else if(booking_type === 'CS'){
        query = `SELECT pickup_latitude AS lat, pickup_longitude AS lon FROM charging_service WHERE request_id = ?`;
    }

    const data = await queryDB(query, [booking_id]);
    if(!data) return resp.json({status:0, code:422, message:"Invalid id."});

    const [result] = await db.execute(`SELECT 
        pod_id, pod_name, design_model,
        (6367 * ACOS(COS(RADIANS(?)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(latitude)))) AS distance 
        FROM pod_devices
        ORDER BY distance
    `, [data.lat, data.lon, data.lat]);

    return resp.json({status:1, code:200, message:["POD List fetch successfully!"], data: result });
});

export const getPcSlotList = asyncHandler(async (req, resp) => {
    const { slot_date, rider_id } = mergeParam(req);
    if(!slot_date) return resp.json({status:0, code:422, message: 'slot date is required'});
    
    const fSlotDate = moment(slot_date, 'YYYY-MM-DD').format('YYYY-MM-DD');

    let query = `SELECT slot_id, ${formatDateInQuery([('slot_date')])}, start_time, end_time, booking_limit`;
    
    if(fSlotDate >=  moment().format('YYYY-MM-DD')){
        query += `,(SELECT COUNT(id) FROM portable_charger_booking AS pod WHERE pod.slot=portable_charger_slot.slot_id AND pod.slot_date='${slot_date}' AND status NOT IN ("PU", "C")) AS slot_booking_count`;
    }
    
    query += ` FROM portable_charger_slot WHERE status = ? AND slot_date = ? ORDER BY start_time ASC`;
    // console.log(query)
    const [slot] = await db.execute(query, [1, fSlotDate]);
    const {is_booking} = await queryDB(`SELECT EXISTS (SELECT 1 FROM portable_charger_booking WHERE slot_date=? AND status NOT IN ("C") AND rider_id=? ) AS is_booking`, [fSlotDate, rider_id]);

    if(moment(fSlotDate).day() === 0){
        slot.forEach((val) => {
            val.booking_limit = 0;
            val.slot_booking_count = 0;
        })
    }

    return resp.json({ 
        message: "Slot List fetch successfully!",  
        data: slot, 
        is_booking, 
        status: 1, 
        code: 200, 
        alert: "To ensure a smooth experience and efficient service, users can make only one booking per day. This helps maintain availability for all. Thank you for your understanding." 
    });
});

export const chargerBooking = asyncHandler(async (req, resp) => {
    const { 
        rider_id, charger_id, vehicle_id, service_name, service_type, service_feature, user_name, country_code, contact_no, address, latitude, longitude, 
        slot_date, slot_time, slot_id, service_price='', coupan_code, user_id
    } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id        : ["required"],
        charger_id      : ["required"],
        vehicle_id      : ["required"],
        service_name    : ["required"],
        service_type    : ["required"],
        service_feature : ["required"],
        user_name       : ["required"],
        country_code    : ["required"],
        contact_no      : ["required"],
        address         : ["required"],
        latitude        : ["required"],
        longitude       : ["required"],
        slot_date       : ["required"],
        slot_time       : ["required"],
    });   
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const conn = await startTransaction();
    try{
        const fSlotDate  = moment(slot_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        const currDate = moment().format('YYYY-MM-DD');

        const rider = await queryDB(` SELECT fcm_token, rider_name, rider_email,
                (SELECT MAX(id) FROM portable_charger_booking) AS last_index,
                (SELECT COUNT(id) FROM portable_charger AS pc WHERE pc.charger_id = ?) AS charg_count,
                (SELECT booking_limit FROM portable_charger_slot AS pcs WHERE pcs.slot_id = ?) AS booking_limit,
                (SELECT COUNT(id) FROM portable_charger_booking as pod where pod.slot=? and pod.slot_date=? and status NOT IN ("PU", "C") ) as slot_booking_count,
                (SELECT COUNT(id) FROM portable_charger_booking as pod where pod.slot_date=? AND status NOT IN ("C") AND rider_id=?) as today_count
            FROM riders AS r
            WHERE r.rider_id = ?
        `, [charger_id, slot_id, slot_id, fSlotDate, fSlotDate, rider_id, rider_id], conn);
    
        const { charg_count, booking_limit, slot_booking_count, today_count } = rider;
    
        if (charg_count === 0) return resp.json({ message: "Charger Id invalid!", status: 0, code: 405, error: true });
        if ( today_count > 0 ) return resp.json({ message: "Note: Only one EV charging booking is allowed per day. Plan your charging accordingly!", status: 0, code: 405, error: true });
        if ( slot_booking_count >= booking_limit ) return resp.json({ message: "Booking Slot Full!, please select another slot", status: 0, code: 405, error: true });
    
        if (service_type.toLowerCase() === "get monthly subscription") {
            const [subsCountRows] = await db.execute(`SELECT COUNT(*) AS count FROM portable_charger_subscription WHERE rider_id = ? AND (total_booking >= 10 OR expiry_date < ?)`, 
                [rider_id, currDate]
            );
            const subsCount = subsCountRows[0].count;
            if (subsCount > 0) { 
                return resp.json({ message: "Subscription limit exceeded or expired!", status: 0, code: 405, error: true });
            }
        }
        const start     = (!rider.last_index) ? 0 : rider.last_index; 
        const nextId    = start + 1;
        const bookingId = 'PCB' + String(nextId).padStart(4, '0');
        const vechile = await queryDB(`SELECT CONCAT(vehicle_make, "-", vehicle_model) AS vehicle_data FROM riders_vehicles WHERE vehicle_id = ?`, [vehicle_id]);
        
        const insert = await insertRecord('portable_charger_booking', [
            'booking_id', 'rider_id', 'charger_id', 'vehicle_id', 'service_name', 'service_price', 'service_type', 'service_feature', 'user_name', 'country_code', 
            'contact_no', 'slot', 'slot_date', 'slot_time', 'address', 'latitude', 'longitude', 'status'
        ], [
            bookingId, rider_id, charger_id, vehicle_id, service_name, service_price, service_type, service_feature, user_name, country_code, contact_no,
            slot_id, fSlotDate, slot_time, address, latitude, longitude, 'CNF'
        ], conn);
    
        if(insert.affectedRows == 0) return resp.json({status:0, code:200, message: ["Oops! Something went wrong. Please try again."]});
    
        if(coupan_code){
            await insertRecord('coupon_usage', ['coupan_code', 'user_id', 'booking_id'], [coupan_code, user_id, bookingId], conn);
        }
        // await conn.execute('UPDATE portable_charger_slot SET booking_limit = booking_limit - 1 WHERE slot_id = ?', [slot_id]);
        
        if (service_type.toLowerCase() === "get monthly subscription") {
            await conn.execute('UPDATE portable_charger_subscriptions SET total_booking = total_booking + 1 WHERE rider_id = ?', [rider_id]);
        }
    
        await insertRecord('portable_charger_history', ['booking_id', 'rider_id', 'order_status'], [bookingId, rider_id, 'CNF'], conn);
        
        const href = 'portable_charger_booking/' + bookingId;
        const heading = 'Portable Charging Booking!';
        const desc = `Booking Confirmed! ID: ${bookingId}.`;
        createNotification(heading, desc, 'Portable Charging Booking', 'Rider', 'Admin','', rider_id, href);
        pushNotification(rider.fcm_token, heading, desc, 'RDRFCM', href);
    
        const formattedDateTime = moment().format('DD MMM YYYY hh:mm A');
        const htmlUser = `<html>
            <body>
                <h4>Dear ${user_name},</h4>
                <p>Thank you for choosing our portable charger service for your EV. We are pleased to confirm that your booking has been successfully received.</p> 
                <p>Booking Details:</p>
                Booking ID: ${bookingId}<br>
                Date and Time of Service: ${moment(slot_date, 'YYYY MM DD').format('D MMM, YYYY,')} ${moment(slot_time, 'HH:mm').format('h:mm A')}<br>
                <p>We look forward to serving you and providing a seamless EV charging experience.</p>                  
                <p> Best regards,<br/>PlusX Electric Team </p>
            </body>
        </html>`;
        emailQueue.addEmail(rider.rider_email, 'PlusX Electric App: Booking Confirmation for Your Portable EV Charger', htmlUser);
        
        const htmlAdmin = `<html>
            <body>
                <h4>Dear Admin,</h4>
                <p>We have received a new booking for our Portable Charger service. Below are the details:</p> 
                Customer Name  : ${rider.rider_name}<br>
                Address : ${address}<br>
                Booking Time : ${formattedDateTime}<br>                    
                Vechile Details : ${vechile.vehicle_data}<br>                      
                <p> Best regards,<br/>PlusX Electric Team </p>
            </body>
        </html>`;
        emailQueue.addEmail('podbookings@plusxelectric.com', `Portable Charger Booking - ${bookingId}`, htmlAdmin);
       
        const rsa = await queryDB(`SELECT fcm_token, rsa_id FROM rsa WHERE status = ? AND booking_type = ?`, [2, 'Portable Charger']);
        let respMsg = "Booking Request Received! Thank you for booking our portable charger service for your EV. Our team will arrive at the scheduled time."; 
        
        if(rsa){
            const slotDateTime = moment(`${slot_date} ${slot_time}`, 'DD-MM-YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');

            await insertRecord('portable_charger_booking_assign', 
                ['order_id', 'rsa_id', 'rider_id', 'slot_date_time', 'status'], [bookingId, rsa.rsa_id, rider_id, slotDateTime, 0], conn
            );
            await updateRecord('portable_charger_booking', {rsa_id: rsa.rsa_id}, ['booking_id'], [bookingId], conn);
    
            const heading1 = 'Portable Charger!';
            const desc1 = `A Booking of the Portable Charger service has been assigned to you with booking id : ${bookingId}`;
            createNotification(heading, desc, 'Portable Charger', 'RSA', 'Rider', rider_id, rsa.rsa_id, href);
            pushNotification(rsa.fcm_token, heading1, desc1, 'RSAFCM', href);
        }

        await commitTransaction(conn);
        
        return resp.json({
            status:1, 
            code: 200,
            booking_id: bookingId,
            message: [respMsg] 
        });

    }catch(err){
        await rollbackTransaction(conn);
        console.error("Transaction failed:", err);
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }finally{
        if (conn) conn.release();
    }
});

export const chargerBookingList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, history } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit           = 10;
    const start           = ( page_no * limit ) - limit;
    const statusCondition = (history && history == 1) ? `status IN (?, ?)` : `status NOT IN (?, ?)`;
    const statusParams    = ['PU', 'C'];

    const totalQuery = `SELECT COUNT(*) AS total FROM portable_charger_booking WHERE rider_id = ? AND ${statusCondition}`;
    const [totalRows] = await db.execute(totalQuery, [rider_id, ...statusParams]);
    const total = totalRows[0].total;
    const totalPage = Math.max(Math.ceil(total / limit), 1);

    const bookingsQuery = `SELECT booking_id, service_name, ROUND(portable_charger_booking.service_price/100, 2) AS service_price, service_type, user_name, country_code, contact_no, slot_time, status, 
        ${formatDateTimeInQuery(['created_at'])}, ${formatDateInQuery(['slot_date'])}
        FROM portable_charger_booking WHERE rider_id = ? AND ${statusCondition} ORDER BY id DESC LIMIT ${parseInt(start)}, ${parseInt(limit)}
    `;
    console.log(bookingsQuery);
    const [bookingList] = await db.execute(bookingsQuery, [rider_id, ...statusParams]);

    return resp.json({
        message: ["Portable Charger Booking List fetched successfully!"],
        data: bookingList,
        total_page: totalPage,
        status: 1,
        code: 200,
        base_url: `${req.protocol}://${req.get('host')}/uploads/portable-charger/`,
    });
});

export const chargerBookingDetail = asyncHandler(async (req, resp) => {
    const {rider_id, booking_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], booking_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const booking = await queryDB(`SELECT portable_charger_booking.*, (select concat(vehicle_make, "-", vehicle_model) from riders_vehicles as rv where rv.vehicle_id = portable_charger_booking.vehicle_id) as vehicle_data, ${formatDateTimeInQuery(['created_at', 'updated_at'])}, ${formatDateInQuery(['slot_date'])} FROM portable_charger_booking WHERE rider_id = ? AND booking_id = ? LIMIT 1`, [rider_id, booking_id]);

    if (booking && booking.status == 'PU') {
        const invoice_id = booking.booking_id.replace('PCB', 'INVPC');
        booking.invoice_url = `${req.protocol}://${req.get('host')}/public/portable-charger-invoice/${invoice_id}-invoice.pdf`;
    }
    const [history] = await db.execute(`SELECT *, ROUND(portable_charger_booking.service_price / 100, 2) AS service_price FROM portable_charger_booking WHERE booking_id = ?`, [booking_id]);
    return resp.json({
        message         : ["Charging Installation Service fetched successfully!"],
        data            : booking,
        service_history : history,
        status          : 1,
        code            : 200,
    });
});

export const getPcSubscriptionList = asyncHandler(async (req, resp) => {
    const { rider_id } = mergeParam(req);
    if(!rider_id) return resp.json({status: 0, code: 200, error: true, message: ["Rider Id is required"]});

    const data = await queryDB(`
        SELECT subscription_id, amount, expiry_date, booking_limit, total_booking, payment_date 
        FROM portable_charger_subscriptions WHERE rider_id = ? ORDER BY id DESC
    `, [rider_id]);

    if(data?.amount){
        data.amount /= 100; 
    }
    const sPrice = (data && data.expiry_date > moment().format("YYYY-MM-DD") && data.total_booking >= 10) ? 75 : 750;

    return resp.json({
        message: [ "Subscription Details fetch successfully!" ],
        data: data,
        status: 1,
        subscription_price: sPrice,
        code: 200,
        subscription_img: `${req.protocol}://${req.get('host')}/public/pod-no-subscription.jpeg`,
    });
});


/* Invoice */
export const invoiceList = asyncHandler(async (req, resp) => {
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
        tableName: 'portable_charger_invoice',
        columns: `invoice_id, amount, payment_status, invoice_date, currency, 
            (select concat(name, ",", country_code, "-", contact_no) from portable_charger_booking as pcb where pcb.booking_id = portable_charger_invoice.request_id limit 1)
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
        base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
    });
});
export const invoiceDetails = asyncHandler(async (req, resp) => {
    const {rider_id, invoice_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], invoice_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoice = await queryDB(`SELECT 
        invoice_id, amount as price, payment_status, invoice_date, currency, payment_type, pcb.user_name, pcb.country_code, pcb.contact_no, pcb.address, pcb.booking_id, 
        cs.slot_date, pcb.slot_time, (select rider_email from riders as rd where rd.rider_id = portable_charger_invoice.rider_id ) as rider_email'
        FROM 
            portable_charger_invoice AS pci
        LEFT JOIN
            portable_charger_booking AS pcb ON pcb.booking_id = pci.request_id
        LEFT JOIN 
            portable_charger_slot AS cs ON cs.slot_id = pcb.slot
        WHERE 
            pci.invoice_id = ?
    `, [invoice_id]);

    invoice.invoice_url = `${req.protocol}://${req.get('host')}/uploads/portable-charger-invoice/${invoice_id}-invoice.pdf`;

    return resp.json({
        message: ["Pick & Drop Invoice Details fetch successfully!"],
        data: invoice,
        status: 1,
        code: 200,
    });
});

/* RSA - Booking Action */
export const rsaBookingStage = asyncHandler(async (req, resp) => {
    const {rsa_id, booking_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rsa_id: ["required"], booking_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const booking = await queryDB(`SELECT status, created_at, updated_at FROM portable_charger_booking WHERE booking_id=?`, [booking_id]);
    if(!booking) return resp.json({status:0, code:200, message: "Sorry no data found with given order id: " + booking_id});

    const orderStatus = ['CNF','A','RL','CS','CC','PU','C'];
    const placeholders = orderStatus.map(() => '?').join(', ');

    const [bookingTracking] = await db.execute(`SELECT order_status, remarks, image, cancel_reason, cancel_by, longitude, latitude FROM portable_charger_history 
        WHERE booking_id = ? AND rsa_id = ? AND order_status IN (${placeholders})
    `, [booking_id, rsa_id, ...orderStatus]);

    const seconds = Math.floor((booking.updated_at - booking.created_at) / 1000);
    const humanReadableDuration = moment.duration(seconds, 'seconds').format('h [hours], m [minutes]');
    
    return resp.json({
        status: 1,
        code: 200,
        message: ["Booking stage fetch successfully."],
        booking_status: booking.status,
        execution_time: humanReadableDuration,
        booking_history: bookingTracking,
        image_path: `${req.protocol}://${req.get('host')}/uploads/portable-charger/`
    });
    
});

export const bookingAction = asyncHandler(async (req, resp) => {  
    const {rsa_id, booking_id, reason, latitude, longitude, booking_status, pod_id } = req.body;
    let validationRules = {
        rsa_id         : ["required"], 
        booking_id     : ["required"], 
        latitude       : ["required"], 
        longitude      : ["required"], 
        booking_status : ["required"],
    };

    if (booking_status == "C")  validationRules = { ...validationRules, reason  : ["required"] };
    // if (booking_status == "CS") validationRules = { ...validationRules, pod_id  : ["required"] };

    const { isValid, errors } = validateFields(req.body, validationRules);
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    switch (booking_status) {
        case 'A': return await acceptBooking(req, resp);
        case 'ER': return await driverEnroute(req, resp);
        case 'RL': return await reachedLocation(req, resp);
        case 'CS': return await chargingStart(req, resp);
        case 'CC': return await chargingComplete(req, resp);
        case 'DO': return await vehicleDrop(req, resp);
        case 'PU': return await chargerPickedUp(req, resp);
        default: return resp.json({status: 0, code: 200, message: ['Invalid booking status.']});
    }
});

export const rejectBooking = asyncHandler(async (req, resp) => {
    const {rsa_id, booking_id, reason } = mergeParam(req); // latitude, longitude,
    const { isValid, errors } = validateFields(mergeParam(req), {rsa_id: ["required"], booking_id: ["required"], reason: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const insert = await db.execute(
        'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id) VALUES (?, ?, "C", ?)',
        [booking_id, checkOrder.rider_id, rsa_id ]
    );
    if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

    await insertRecord('portable_charger_booking_rejected', ['booking_id', 'rsa_id', 'rider_id', 'reason'],[booking_id, rsa_id, checkOrder.rider_id, reason]);
    await db.execute(`DELETE FROM portable_charger_booking_assign WHERE order_id=? AND rsa_id=?`, [booking_id, rsa_id]);

    const href    = `portable_charger_booking/${booking_id}`;
    const title   = 'Booking Rejected';
    const message = `Driver has rejected the portable charger booking with booking id: ${booking_id}`;
    await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);

    const html = `<html>
        <body>
            <h4>Dear Admin,</h4>
            <p>Driver has rejected the portable charger booking. please assign one Driver on this booking</p> <br />
            <p>Booking ID: ${booking_id}</p>
            <p>Best Regards,<br/> The PlusX Electric Team </p>
        </body>
    </html>`;
    emailQueue.addEmail('podbookings@plusxelectric.com', `POD Service Booking rejected - ${booking_id}`, html);

    return resp.json({ message: ['Booking has been rejected successfully!'], status: 1, code: 200 });
});

/* POD booking action helper */
const acceptBooking = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = mergeParam(req);

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token,
            (SELECT COUNT(id) FROM portable_charger_booking_assign WHERE rsa_id = ? AND status = 1) AS pod_count
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[rsa_id, booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    if (checkOrder.pod_count > 0) {
        return resp.json({ message: ['You have already one booking, please complete that first!'], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM portable_charger_history WHERE rsa_id = ? AND order_status = "A" AND booking_id = ?',[rsa_id, booking_id]
    );

    if (ordHistoryCount.count === 0) {
        await updateRecord('portable_charger_booking', {status: 'A', rsa_id}, ['booking_id'], [booking_id]);

        const href = `portable_charger_booking/${booking_id}`;
        const title = 'POD Booking Accepted';
        const message = `Booking Accepted! ID: ${booking_id}.`;
        await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        const insert = await insertRecord('portable_charger_history', [
            'booking_id', 'rider_id', 'order_status', 'rsa_id', 'latitude', 'longitude'
        ],[
            booking_id, checkOrder.rider_id, "A", rsa_id, latitude, longitude
        ]);

        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await db.execute('UPDATE rsa SET running_order = running_order + 1 WHERE rsa_id = ?', [rsa_id]);
        await db.execute('UPDATE portable_charger_booking_assign SET status = 1 WHERE order_id = ? AND rsa_id = ?', [booking_id, rsa_id]);

        return resp.json({ message: ['POD Booking accepted successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const driverEnroute = async (req, resp) => {
    
    const { booking_id, rsa_id, latitude, longitude } = mergeParam(req);

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM portable_charger_history WHERE rsa_id = ? AND order_status = "ER" AND booking_id = ?',[rsa_id, booking_id]
    );
    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "ER", ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );
        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('portable_charger_booking', {status: 'ER'}, ['booking_id' ], [booking_id ]);

        const href    = `portable_charger_booking/${booking_id}`;
        const title   = 'PlusX Electric team is on the way!';
        const message = ` Please have your EV ready for charging.`;
        await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Booking Status changed successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const reachedLocation = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = mergeParam(req);

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }
    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM portable_charger_history WHERE rsa_id = ? AND order_status = "RL" AND booking_id = ?',[rsa_id, booking_id]
    );
    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "RL", ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );

        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('portable_charger_booking', {status: 'RL', rsa_id}, ['booking_id'], [booking_id] );

        const href    = `portable_charger_booking/${booking_id}`;
        const title   = 'POD Reached at Location';
        const message = `The POD has arrived. Please unlock your EV.`;
        await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['POD Reached at Location Successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const chargingStart = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude, pod_id='' } = mergeParam(req);
    
    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM portable_charger_history WHERE rsa_id = ? AND order_status = "CS" AND booking_id = ?',[rsa_id, booking_id]
    );
    
    if (ordHistoryCount.count === 0) {
        const podBatteryData = await getPodBatteryData(pod_id);
        const podData        = podBatteryData.data.length > 0 ? JSON.stringify(podBatteryData.data) : null;
        const sumOfLevel     = podBatteryData.sum ?  podBatteryData.sum : '';
        
        const insert = await db.execute(
            'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude, pod_data) VALUES (?, ?, "CS", ?, ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude, podData]
        );
        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('portable_charger_booking', {status: 'CS', rsa_id, pod_id, start_charging_level: sumOfLevel}, ['booking_id'], [booking_id] );
        await updateRecord('pod_devices', { charging_status : 1, latitude, longitude}, ['pod_id'], [pod_id] );

        const href    = `portable_charger_booking/${booking_id}`;
        const title   = 'EV Charging Start';
        const message = `POD has started charging your EV!`;
        await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Vehicle Charging Start successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const chargingComplete = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude, pod_id } = mergeParam(req);
    // 
    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token,
            (SELECT pod_id FROM portable_charger_booking as pcb WHERE pcb.booking_id = portable_charger_booking_assign.order_id) AS pod_id
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }
    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM portable_charger_history WHERE rsa_id = ? AND order_status = "CC" AND booking_id = ?',[rsa_id, booking_id]
    );
    if (ordHistoryCount.count === 0) {

        const podBatteryData = await getPodBatteryData(checkOrder.pod_id);  //POD ID nikalana hoga 
        const podData        = podBatteryData.data ? JSON.stringify(podBatteryData.data) : [];
        const sumOfLevel     = podBatteryData.sum ? podBatteryData.sum : 0;

        const insert = await db.execute(
            'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude, pod_data) VALUES (?, ?, "CC", ?, ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude, podData]
        );
        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('portable_charger_booking', {status: 'CC', rsa_id, end_charging_level:sumOfLevel }, ['booking_id'], [booking_id] );
        await updateRecord('pod_devices', { charging_status : 0 }, ['pod_id'], [checkOrder.pod_id] );

        const href    = `portable_charger_booking/${booking_id}`;
        const title   = 'Charging Completed!';
        const message = `Charging complete, please lock your EV.`;
        await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Vehicle Charging Completed successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};
const chargerPickedUp = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = mergeParam(req);
    let imgName = '';
    if (!req.files || !req.files['image']) return resp.status(405).json({ message: "Vehicle Image is required", status: 0, code: 405, error: true });
    if(req.files && req.files['image']) imgName = req.files['image'] ? req.files['image'][0].filename : ''; 
    const invoiceId = booking_id.replace('PCB', 'INVPC');

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token,
            (select CONCAT(slot, "/" ,pod_id) from portable_charger_booking as pb where pb.booking_id = portable_charger_booking_assign.order_id ) as slot_pod
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 1
        LIMIT 1
    `,[booking_id, rsa_id]);

    const [slot, pod_id] = checkOrder.slot_pod.split('/');

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }
    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM portable_charger_history WHERE rsa_id = ? AND order_status = "PU" AND booking_id = ?',[rsa_id, booking_id]
    );
    const conn = await startTransaction();
    if (ordHistoryCount.count === 0) {
        const insert = await conn.execute(
            'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude, image) VALUES (?, ?, "PU", ?, ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude, imgName]
        );
        
        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('portable_charger_booking', {status: 'PU', rsa_id}, ['booking_id'], [booking_id], conn );
        await conn.execute(`DELETE FROM portable_charger_booking_assign WHERE rsa_id = ? and order_id = ?`, [rsa_id, booking_id]);
        await conn.execute('UPDATE rsa SET running_order = running_order - 1 WHERE rsa_id = ?', [rsa_id]);
        await updateRecord('pod_devices', { latitude, longitude}, ['pod_id'], [pod_id] );
        // await conn.execute('UPDATE portable_charger_slot SET booking_limit = booking_limit - 1 WHERE slot_id = ?', [checkOrder.slot]);

        const data = await queryDB(`
            SELECT 
                pci.invoice_id, pci.amount, pci.invoice_date, pcb.booking_id, pcb.start_charging_level, pcb.end_charging_level,
                CASE WHEN pci.currency IS NOT NULL THEN pci.currency ELSE 'AED' END AS currency,
                (SELECT rd.rider_email FROM riders AS rd WHERE rd.rider_id = pci.rider_id) AS rider_email,
                (SELECT rd.rider_name FROM riders AS rd WHERE rd.rider_id = pci.rider_id) AS rider_name
            FROM 
                portable_charger_invoice AS pci
            LEFT JOIN
                portable_charger_booking AS pcb ON pcb.booking_id = pci.request_id
            WHERE 
                pci.invoice_id = ?
            LIMIT 1
        `, [invoiceId]);

        const chargingLevels = ['start_charging_level', 'end_charging_level'].map(key => 
            data[key] ? data[key].split(',').map(Number) : []
        );
        const chargingLevelSum = chargingLevels[0].reduce((sum, startLevel, index) => sum + (startLevel - chargingLevels[1][index]), 0);
        
        data.kw           = chargingLevelSum * 0.25;
        data.currency     = data.currency.toUpperCase();
        data.kw_dewa_amt  = data.kw * 0.44;
        data.kw_cpo_amt   = data.kw * 0.26;
        data.delv_charge  = 0; // 30 when start accepting payment
        data.t_vat_amt    = Math.floor(((data.kw_dewa_amt / 100 * 5) + (data.kw_cpo_amt / 100 * 5) + (data.delv_charge / 100 * 5)) * 100) / 100;
        data.total_amt    = data.kw_dewa_amt + data.kw_cpo_amt + data.delv_charge + data.t_vat_amt;
        data.invoice_date = data.invoice_date ? moment(data.invoice_date).format('MMM D, YYYY') : '';
        
        const invoiceData = { data, numberToWords, formatNumber  };
        const templatePath = path.join(__dirname, '../../views/mail/portable-charger-invoice.ejs');
        const filename = `${invoiceId}-invoice.pdf`;
        const savePdfDir = 'portable-charger-invoice';
        
        const pdf = await generatePdf(templatePath, invoiceData, filename, savePdfDir, req);

        if(!pdf || !pdf.success){
            await rollbackTransaction(conn);
            return resp.json({ message: ['Failed to generate invoice. Please Try Again!'], status: 0, code: 200 });
        }
        if(pdf.success){
            const html = `<html>
                <body>
                    <h4>Dear ${data.rider_name}</h4>
                    <p>We hope you are doing well!</p>
                    <p>Thank you for choosing our Portable EV Charger service for your EV. We are pleased to inform you that your booking has been successfully completed, and the details of your invoice are attached.</p>
                    <p>We appreciate your trust in PlusX Electric and look forward to serving you again.</p>
                    <p> Regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            const attachment = {
                filename: `${invoiceId}-invoice.pdf`, path: pdf.pdfPath, contentType: 'application/pdf'
            };
        
            emailQueue.addEmail(data.rider_email, 'PlusX Electric: Invoice for Your Portable EV Charger Service', html, attachment);
        }
        await commitTransaction(conn);
        return resp.json({ message: ['Portable Charger picked-up successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};

/* User Cancel Booking */
export const userCancelPCBooking = asyncHandler(async (req, resp) => {
    const { rider_id, booking_id, reason='' } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], booking_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const checkOrder = await queryDB(`
        SELECT 
            rsa_id, address, slot_time, user_name, 
            DATE_FORMAT(slot_date, '%Y-%m-%d') AS slot_date,
            concat( country_code, "-", contact_no) as contact_no, 
            (SELECT rd.rider_email FROM riders AS rd WHERE rd.rider_id = pcb.rider_id) AS rider_email,
            (SELECT rd.rider_name FROM riders AS rd WHERE rd.rider_id = pcb.rider_id) AS rider_name,
            (select fcm_token from riders as r where r.rider_id = pcb.rider_id ) as fcm_token, 
            (select fcm_token from rsa where rsa.rsa_id = pcb.rsa_id ) as rsa_fcm_token
        FROM 
            portable_charger_booking AS pcb
        WHERE 
            booking_id = ? AND rider_id = ? AND status IN ('CNF','A','ER') 
        LIMIT 1
    `,[booking_id, rider_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }
    const insert = await db.execute(
        'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, cancel_by, cancel_reason) VALUES (?, ?, "C", ?, "User", ?)',
        [booking_id, rider_id, checkOrder.rsa_id, reason]
    );
    if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

    await updateRecord('portable_charger_booking', {status : 'C'}, ['booking_id'], [booking_id]);

    const href    = `portable_charger_booking/${booking_id}`;
    const title   = 'Portable Charger Cancel!';
    const message = `YPortable Charger: Booking ID ${booking_id} - ${checkOrder.rider_name} cancelled the booking.`;
    await createNotification(title, message, 'Portable Charging', 'Admin', 'Rider',  rider_id, '', href);

    if(checkOrder.rsa_id) {
        await db.execute(`DELETE FROM portable_charger_booking_assign WHERE order_id=? AND rider_id=?`, [booking_id, rider_id]);
        await db.execute('UPDATE rsa SET running_order = running_order - 1 WHERE rsa_id = ?', [checkOrder.rsa_id]);
    }

    const html = `<html>
        <body>
            <h4>Dear ${checkOrder.user_name},</h4>
            <p>We would like to inform you that your booking for the portable charger has been successfully cancelled. Below are the details of your cancelled booking:</p>
            Booking ID    : ${booking_id}<br>
            Date and Time : ${moment(checkOrder.slot_date, 'YYYY MM DD').format('D MMM, YYYY,')} ${moment(checkOrder.slot_time, 'HH:mm').format('h:mm A')}
            <p>If this cancellation was made in error or if you wish to reschedule, please feel free to reach out to us. We're happy to assist you.</p>
            <p>Thank you for using PlusX Electric. We hope to serve you again soon.</p>
            <p>Best regards,<br/>PlusX Electric Team </p>
        </body>
    </html>`;
    emailQueue.addEmail(checkOrder.rider_email, `PlusX Electric App: Booking Cancellation`, html);

    const adminHtml = `<html>
        <body>
            <h4>Dear Admin,</h4>
            <p>This is to inform you that a user has cancelled their booking for the Portable EV Charging Service. Please see the details below for record-keeping and any necessary follow-up.</p>
            <p>Booking Details:</p>
            User Name    : ${checkOrder.user_name}</br>
            User Contact    : ${checkOrder.contact_no}</br>
            Booking ID    : ${booking_id}</br>
            Scheduled Date and Time : ${checkOrder.slot_date} - ${checkOrder.slot_time}</br> 
            Location      : ${checkOrder.address}</br>
            <p>Thank you for your attention to this update.</p>
            <p>Best regards,<br/>PlusX Electric Team </p>
        </body>
    </html>`;
    emailQueue.addEmail('podbookings@plusxelectric.com', `Portable Charger Service Booking Cancellation ( :Booking ID : ${booking_id} )`, adminHtml);

    return resp.json({ message: ['Booking has been cancelled successfully!'], status: 1, code: 200 });
});

/* Save POD Charging History */
export const storePodChargerHistory = asyncHandler(async (req, resp) => {
    const { rsa_id, pod_id, charging_status, latitude, longitude } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rsa_id: ["required"], pod_id: ["required"], charging_status: ["required"], latitude: ["required"], longitude: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if (!['CS', 'CE'].includes(charging_status)) return resp.json({status:0, code:422, message:"Status should be CS or CE"});

    const podBatteryData = await getPodBatteryData(pod_id);
    const podData        = podBatteryData.data.length > 0 ? JSON.stringify(podBatteryData.data) : null;
    const sumOfLevel     = podBatteryData.sum ?  podBatteryData.sum : '';
    const status         = charging_status === 'CS' ? 1 : 2;
    let   isStored       = 0;
    
    if(charging_status === 'CS'){
        const insert = await insertRecord('pod_charge_history', 
            ['pod_id', 'start_charging_level', 'pod_data_start', 'status', 'longitude', 'latitude'],
            [pod_id, sumOfLevel, podData, status, latitude, longitude]
        );
        isStored = insert.affectedRows > 0 ? 1 : 0;
    }
    if(charging_status === 'CE'){
        const update = await updateRecord('pod_charge_history', {end_charging_level: sumOfLevel, pod_data_end: podData, status, latitude, longitude}, ['pod_id'], [pod_id]);
        isStored = update.affectedRows > 0 ? 1 : 0;
    }

    return resp.json({
        status: isStored ? 1 : 0,
        message: isStored ? 'POD charger history saved successfully' : 'Failed to store, Please Try Again.'
    });

});

const getPodBatteryData = async (pod_id) => {
    try {
        // const { pod_id, } = req.body;
        // const { isValid, errors } = validateFields(req.body, {
        //     pod_id : ["required"]
        // });
        // if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const [chargerDetails] = await db.execute(`
            SELECT 
                battery_id, capacity, rssi, cells, temp1, temp2, temp3, current, voltage, percentage, charge_cycle, latitude, longitude, cells 
            FROM 
                pod_device_battery 
            WHERE 
                pod_id = ?`, 
            [pod_id]
        );
        const sum = chargerDetails.map( obj  => (obj.percentage || 0).toFixed(2) ) ;
        const returnObj = {
            sum  : sum.join(','),
            data : chargerDetails,
        };
        return returnObj;
    } catch (error) {
    
        const returnObj = {
            sum  : '',
            data : [],
        };
        return returnObj ;
    }


}
