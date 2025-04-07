// import path from 'path';
import moment from "moment-timezone";
import dotenv from 'dotenv';
import 'moment-duration-format';
// import { fileURLToPath } from 'url';
import emailQueue from "../../emailQueue.js";
import validateFields from "../../validation.js";
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import db, { startTransaction, commitTransaction, rollbackTransaction } from "../../config/db.js";
import { asyncHandler, createNotification, formatDateInQuery, formatDateTimeInQuery, mergeParam, pushNotification } from "../../utils.js";
dotenv.config();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname  = path.dirname(__filename);

export const chargerList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await getPaginatedData({
        tableName  : 'portable_charger',
        columns    : 'charger_id, charger_name, charger_price, charger_feature, image, charger_type',
        sortColumn : 'id',
        sortOrder  : 'ASC',
        page_no,
        limit      : 10,
        whereField : ['status'],
        whereValue : ['1']
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
    const [[{pod_id}]] = await db.execute(`SELECT pod_id FROM portable_charger_booking where booking_id = ?`, [booking_id]);
    if(!data) return resp.json({status:0, code:422, message:"Invalid id."});

    const [result] = await db.execute(`SELECT 
        pod_id, pod_name, design_model,
        (6367 * ACOS(COS(RADIANS(?)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(latitude)))) AS distance 
        FROM pod_devices
        ORDER BY CAST(SUBSTRING(pod_name, LOCATE(' ', pod_name) + 1) AS UNSIGNED)
    `, [data.lat, data.lon, data.lat]);

    return resp.json({status:1, code:200, message:["POD List fetch successfully!"], active_pod_id: pod_id, data: result });
    // return resp.json({status:1, code:200, message:["POD List fetch successfully!"], data: result });
});

export const getPcSlotList = asyncHandler(async (req, resp) => {
    const { slot_date, rider_id } = mergeParam(req);
    if(!slot_date) return resp.json({status:0, code:422, message: ['slot date is required']});
    
    const fSlotDate = moment(slot_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
    
    let query = `SELECT slot_id, ${formatDateInQuery([('slot_date')])}, start_time, end_time, booking_limit`;
    
    if(fSlotDate >=  moment().format('YYYY-MM-DD')){
        query += `, (SELECT COUNT(id) FROM portable_charger_booking AS pod WHERE pod.slot_time = portable_charger_slot.start_time AND pod.slot_date = '${slot_date}' AND status NOT IN ("PU", "C", "RO", "PNR")) AS slot_booking_count`;
    }
    query += ` FROM portable_charger_slot WHERE status = ? AND slot_date = ? ORDER BY start_time ASC`;
    // console.log(query)
    const [slot] = await db.execute(query, [1, fSlotDate]);
    
    // const {is_booking} = await queryDB(`SELECT EXISTS (SELECT 1 FROM portable_charger_booking WHERE slot_date=? AND status NOT IN ("C") AND rider_id=? ) AS is_booking`, [fSlotDate, rider_id]);

    if(moment(fSlotDate).day() === 0) { 
        slot.forEach((val) => {
            val.booking_limit      = 0;
            val.slot_booking_count = 0;
        })
    }
    // let timeZone = moment().tz("Asia/Dubai");
    // let prevDay  = timeZone.subtract(28, 'hours').format('YYYY-MM-DD HH:mm:ss');

    // const {last_cancel_booking} = await queryDB(`SELECT EXISTS (SELECT 1 FROM portable_charger_booking WHERE rider_id = ? AND status = 'C' and created_at >= ? ) AS last_cancel_booking`, [rider_id, prevDay]);
    
    return resp.json({ 
        message    : "Slot List fetch successfully!",  
        data       : slot, 
        is_booking : 0, 
        status     : 1, 
        code       : 200, 
        alert2     : "The slots for the selected date are fully booked. Please select another date to book the POD for your EV.",
        alert         : "",
        booking_price : 1
        // alert: "To ensure a smooth experience and efficient service, users can make only one booking per day. This helps maintain availability for all. Thank you for your understanding.",
    });
});

export const chargerBooking = asyncHandler(async (req, resp) => {
    
    const { rider_id, user_name, country_code, contact_no, address, latitude, longitude, parking_number,
        parking_floor, vehicle_id, slot_date, slot_time, slot_id, service_name, service_type, service_feature, service_price = ''
    } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id        : ["required"],
        user_name       : ["required"],
        country_code    : ["required"],
        contact_no      : ["required"],
        address         : ["required"],
        latitude        : ["required"],
        longitude       : ["required"],
        parking_number  : ["required"],
        parking_floor   : ["required"],
        vehicle_id      : ["required"],
        slot_date       : ["required"],
        slot_time       : ["required"],
        slot_id         : ["required"],
        service_name    : ["required"],
        service_type    : ["required"],
        service_feature : ["required"],
    });   
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const conn = await startTransaction();
    try{
        const fSlotDateTime = moment(slot_date + ' ' + slot_time, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')
        const currDateTime = moment().utcOffset(4).format('YYYY-MM-DD HH:mm:ss');
        if (fSlotDateTime < currDateTime) return resp.json({status: 0, code: 422, message: ["Invalid slot, Please select another slot"]});

        const fSlotDate = moment(slot_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        const currDate  = moment().format('YYYY-MM-DD');
        let timeZone    = moment().tz("Asia/Dubai");
        let prevDay     = timeZone.subtract(28, 'hours').format('YYYY-MM-DD HH:mm:ss');
        // fcm_token, rider_name, rider_email, country_code, rider_mobile, 
        const rider = await queryDB(` SELECT  
            (SELECT MAX(id) FROM portable_charger_booking) AS last_index,
            (SELECT booking_limit FROM portable_charger_slot AS pcs WHERE pcs.slot_date = ? and pcs.start_time = ?) AS booking_limit,
            (SELECT COUNT(id) FROM portable_charger_booking as pod where pod.slot_time=? and pod.slot_date=? and status NOT IN ("PU", "C", "RO", "PNR") ) as slot_booking_count,
            (SELECT address_alert FROM portable_charger_booking as pod1 where pod1.rider_id=? and pod1.address=? order by id desc limit 1 ) as alert_add,
            (SELECT COUNT(id) FROM portable_charger_booking as pod2 WHERE pod2.rider_id = ? AND pod2.status = 'C' and pod2.created_at >= ? ) AS last_cancel_booking
        FROM riders AS r 
        WHERE r.rider_id = ? `, 
        [
            fSlotDate, slot_time, 
            slot_time, fSlotDate, 
            rider_id, address,
            rider_id, prevDay,
            rider_id
        ], conn); 
        const { last_index, booking_limit, slot_booking_count, alert_add, last_cancel_booking } = rider; 
    
        if ( slot_booking_count >= booking_limit ) return resp.json({ message : ["Booking Slot Full!, please select another slot"], status: 0, code: 405, error: true });
    
        if (service_type.toLowerCase() === "get monthly subscription") {
            const [subsCountRows] = await db.execute(`SELECT COUNT(*) AS count FROM portable_charger_subscription WHERE rider_id = ? AND (total_booking >= 10 OR expiry_date < ?)`, 
                [rider_id, currDate]
            );
            const subsCount = subsCountRows[0].count;
            if (subsCount > 0) { 
                return resp.json({ message: ["Subscription limit exceeded or expired!"], status: 0, code: 405, error: true });
            }
        }
        const start     = (!last_index) ? 0 : last_index; 
        const nextId    = start + 1;
        const bookingId = 'PCB' + String(nextId).padStart(4, '0');
        let servicePrice = last_cancel_booking ? 0 : service_price ;

        const insert = await insertRecord('portable_charger_booking', [
            'booking_id', 'rider_id', 'vehicle_id', 'service_name', 'service_price', 'service_type', 'service_feature', 'user_name', 'country_code', 
            'contact_no', 'slot', 'slot_date', 'slot_time', 'address', 'latitude', 'longitude', 'status', 'address_alert', 'parking_number', 'parking_floor'
        ], [
            bookingId, rider_id, vehicle_id, service_name, servicePrice, service_type, service_feature, user_name, country_code, contact_no,
            slot_id, fSlotDate, slot_time, address, latitude, longitude, 'PNR', alert_add, parking_number,
            parking_floor
        ], conn);
    
        if(insert.affectedRows == 0) return resp.json({status:0, code:200, message: ["Oops! Something went wrong. Please try again."]});
    
        await commitTransaction(conn);
        return resp.json({
            status        : 1, 
            code          : 200,
            booking_id    : bookingId,
            service_price : servicePrice,
            message       : ["Booking Request Received!."] 
        });

    } catch(err) {
        await rollbackTransaction(conn);
        console.error("Transaction failed:", err);
        return resp.status(500).json({
            status: 0, 
            code: 500, 
            message: [ "Oops! There is something went wrong! Please Try Again"] 
        });
    } finally {
        if (conn) conn.release();
    }
});

export const chargerBookingList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, bookingStatus } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id      : ["required"], 
        page_no       : ["required"],
        bookingStatus : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit           = 10;
    const start           = ( page_no * limit ) - limit;

    let statusCondition = `status IN (?)`;
    let statusParams    =  (bookingStatus == 'C' ) ? ['C'] : ['RO'];
    statusParams        =  (bookingStatus == 'S' ) ? ['CNF'] : statusParams;

    // const statusCondition = (history && history == 1) ? `status IN (?, ?, ?)` : `status NOT IN (?, ?, ?)`;
    // const statusParams    = ['PU', 'C', 'RO'];

    const totalQuery = `SELECT COUNT(*) AS total FROM portable_charger_booking WHERE rider_id = ? AND ${statusCondition}`;
    const [totalRows] = await db.execute(totalQuery, [rider_id, ...statusParams]);
    const total       = totalRows[0].total;
    const totalPage   = Math.max(Math.ceil(total / limit), 1);

    const bookingsQuery = `SELECT booking_id, service_name, ROUND(portable_charger_booking.service_price/100, 2) AS service_price, service_type, user_name, country_code, contact_no, slot_time, status, 
        ${formatDateTimeInQuery(['created_at'])}, ${formatDateInQuery(['slot_date'])}
        FROM portable_charger_booking WHERE rider_id = ? AND ${statusCondition} ORDER BY id DESC LIMIT ${parseInt(start)}, ${parseInt(limit)}
    `;
    const [bookingList] = await db.execute(bookingsQuery, [rider_id, ...statusParams]);

    const inProcessQuery = `SELECT booking_id, service_name, ROUND(portable_charger_booking.service_price/100, 2) AS service_price, service_type, user_name, country_code, contact_no, slot_time, status, 
        ${formatDateTimeInQuery(['created_at'])}, ${formatDateInQuery(['slot_date'])}
        FROM portable_charger_booking WHERE rider_id = ? AND status NOT IN (?, ?, ?) ORDER BY id DESC LIMIT ${parseInt(start)}, ${parseInt(limit)}
    `;
    const inProcessParams    = ['CNF', 'C', 'RO'];
    const [inProcessBookingList] = await db.execute(inProcessQuery, [rider_id, ...inProcessParams]);

    return resp.json({
        message    : ["Portable Charger Booking List fetched successfully!"],
        data       : bookingList,
        total_page : totalPage,
        inProcessBookingList,
        status     : 1,
        code       : 200,
        base_url   : `${req.protocol}://${req.get('host')}/uploads/portable-charger/`,
    });
});

export const chargerBookingDetail = asyncHandler(async (req, resp) => {
    const {rider_id, booking_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], booking_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    // 
    const booking = await queryDB(`SELECT portable_charger_booking.*, ROUND(portable_charger_booking.service_price / 100, 2) AS service_price, (select concat(vehicle_make, ", ", vehicle_model, ", ", vehicle_specification, ", ", emirates, "-", vehicle_code, "-", vehicle_number) from riders_vehicles as rv where rv.vehicle_id = portable_charger_booking.vehicle_id limit 1) as vehicle_data, ${formatDateTimeInQuery(['created_at', 'updated_at'])}, ${formatDateInQuery(['slot_date'])} FROM portable_charger_booking WHERE rider_id = ? AND booking_id = ? LIMIT 1`, [rider_id, booking_id]);

    if (booking && ( booking.status == 'PU' || booking.status == 'RO' ) ) {
        const invoice_id = booking.booking_id.replace('PCB', 'INVPC');
        booking.invoice_url = `${req.protocol}://${req.get('host')}/public/portable-charger-invoice/${invoice_id}-invoice.pdf`;
    }
    // const [history] = await db.execute(`SELECT * FROM portable_charger_history WHERE booking_id = ?`, [booking_id]);
    const [history] = await db.execute(`
        SELECT 
            order_status, cancel_by, cancel_reason as reason, rsa_id, ${formatDateTimeInQuery(['created_at'])}, image, remarks,   
            (select rsa.rsa_name from rsa where rsa.rsa_id = portable_charger_history.rsa_id) as rsa_name
        FROM 
            portable_charger_history 
        WHERE 
            booking_id = ?`, 
        [booking_id]
    );
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
        tableName : 'portable_charger_invoice',
        columns   : `invoice_id, amount, payment_status, invoice_date, currency, 
            (select concat(name, ",", country_code, "-", contact_no) from portable_charger_booking as pcb where pcb.booking_id = portable_charger_invoice.request_id limit 1)
            AS riderDetails`,
        sortColumn : 'id',
        sortOrder  : 'DESC',
        page_no,
        limit   : 10,
        whereField,
        whereValue
    });

    return resp.json({
        status     : 1,
        code       : 200,
        message    : ["Pick & Drop Invoice List fetch successfully!"],
        data       : result.data,
        total_page : result.totalPage,
        total      : result.total,
        base_url   : `${req.protocol}://${req.get('host')}/uploads/offer/`,
    });
});
export const invoiceDetails = asyncHandler(async (req, resp) => {
    const {rider_id, invoice_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], invoice_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoice = await queryDB(`SELECT 
        invoice_id, amount as price, payment_status, invoice_date, currency, payment_type, pcb.user_name, pcb.country_code, pcb.contact_no, pcb.address, pcb.booking_id, 
        cs.slot_date, pcb.slot_time, (select rider_email from riders as rd where rd.rider_id = portable_charger_invoice.rider_id limit 1) as rider_email'
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
        message : ["Pick & Drop Invoice Details fetch successfully!"],
        data    : invoice,
        status  : 1,
        code    : 200,
    });
});

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

    const fSlotDateTime = moment(`${checkOrder.slot_date} ${checkOrder.slot_time}`);
    const twoHoursBefore = moment(fSlotDateTime).subtract(2, 'hours');
    
    if (moment().isAfter(twoHoursBefore)) {
        return resp.json({
            status  : 0,
            code    : 404,
            message : ['Too late to proceed. You need to make the request at least 2 hours before the slot time.']
        });
    }
    const insert = await db.execute(
        'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, cancel_by, cancel_reason) VALUES (?, ?, "C", ?, "User", ?)',
        [booking_id, rider_id, checkOrder.rsa_id, reason]
    );
    if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

    await updateRecord('portable_charger_booking', {status : 'C'}, ['booking_id'], [booking_id]);

    const href    = `portable_charger_booking/${booking_id}`;
    const title   = 'Portable Charger Cancel!';
    const message = `Portable Charger: Booking ID ${booking_id} - ${checkOrder.rider_name} cancelled the booking.`;
    await createNotification(title, message, 'Portable Charging', 'Admin', 'Rider',  rider_id, '', href);

    if(checkOrder.rsa_id) {
        await db.execute(`DELETE FROM portable_charger_booking_assign WHERE order_id=? AND rider_id=?`, [booking_id, rider_id]);
        // await db.execute('UPDATE rsa SET running_order = running_order - 1 WHERE rsa_id = ?', [checkOrder.rsa_id]);
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
    emailQueue.addEmail(process.env.MAIL_POD_ADMIN, `Portable Charger Service Booking Cancellation ( :Booking ID : ${booking_id} )`, adminHtml); 

    return resp.json({ message: ['Booking has been cancelled successfully!'], status: 1, code: 200 });
});
