import db from "../../config/db.js";
import validateFields from "../../validation.js";
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import transporter from "../../mailer.js";
import moment from "moment";
import 'moment-duration-format';
import { mergeParam } from '../../utils.js';

export const chargerList = async (req, resp) => {
    const {rider_id, page_no } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await getPaginatedData({
        tableName: 'portable_charger',
        columns: 'charger_id, charger_name, charger_price, charger_feature, image, charger_type',
        sortColumn: 'id',
        sortOrder: 'ASC',
        page_no,
        limit: 10,
        whereField: 'status',
        whereValue: 1
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
        base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
    });
}

export const chargerBooking = async (req, resp) => {
    const { 
        rider_id, charger_id, vehicle_id, service_name, service_type, service_feature, user_name, country_code, contact_no, address, latitude, longitude, 
        slot_date, slot_time, slot_id, service_price='', coupan_code, user_id
    } = mergeparam(req);

    const { isValid, errors } = validateFields(mergeparam(req), {
        rider_id: ["required"],
        charger_id: ["required"],
        vehicle_id: ["required"],
        service_name: ["required"],
        service_type: ["required"],
        service_feature: ["required"],
        user_name: ["required"],
        country_code: ["required"],
        contact_no: ["required"],
        address: ["required"],
        latitude: ["required"],
        longitude: ["required"],
        slot_date: ["required"],
        slot_time: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const rider = await queryDB(`
        SELECT 
            fcm_token, rider_name, rider_email,
            (SELECT MAX(id) FROM portable_charger_booking) AS last_index,
            (SELECT COUNT(id) FROM portable_charger AS pc WHERE pc.charger_id = ?) AS charg_count,
            (SELECT booking_limit FROM portable_charger_slot AS pcs WHERE pcs.slot_id = ?) AS booking_limit
        FROM riders AS r
        WHERE r.rider_id = ?
    `, [charger_id, slot_id, rider_id]);

    const { charg_count, booking_limit } = rider;

    if (charg_count === 0) return resp.json({ message: "Charger id invalid!", status: 0, code: 405, error: true });
    if (booking_limit === 0) return resp.json({ message: "Booking Slot Full!, please select another slot", status: 0, code: 405, error: true });

    if (service_type.toLowerCase() === "get monthly subscription") {
        const [subsCountRows] = await db.execute(`SELECT COUNT(*) AS count FROM portable_charger_subscription WHERE rider_id = ? AND (total_booking >= 10 OR expiry_date < ?)`, 
            [rider_id, moment().format('YYYY-MM-DD')]
        );

        const subsCount = subsCountRows[0].count;

        if (subsCount > 0) { 
            return resp.json({ message: "Subscription limit exceeded or expired!", status: 0, code: 405, error: true });
        }
    }

    const start = (!rider.last_index) ? 0 : rider.last_index; 
    const nextId = start + 1;
    const bookingId = 'PCD' + String(nextId).padStart(4, '0');
    
    const insert = await insertRecord('portable_charger_booking', [
        'booking_id', 'rider_id', 'charger_id', 'vehicle_id', 'service_name', 'service_price', 'service_type', 'service_feature', 'user_name', 'country_code', 
        'contact_no', 'slot', 'slot_date', 'slot_time', 'address', 'latitude', 'longitude', 'status'
    ], [
        bookingId, rider_id, charger_id, vehicle_id, service_name, service_price, service_type, service_feature, user_name, country_code, contact_no,
        slot_id, slot_date, slot_time, address, latitude, longitude, 'CNF'
    ]);

    if(insert.affectedRows = 0) return resp.json({status:0, code:200, message: ["Oops! Something went wrong. Please try again."]});

    if(coupan_code){
        await insertRecord('coupon_usage', ['coupan_code', 'user_id', 'booking_id'], [coupan_code, user_id, bookingId]);
    }

    await db.execute('UPDATE portable_charger_slot SET booking_limit = booking_limit - 1 WHERE slot_id = ?', [slot_id]);
    
    if (service_type.toLowerCase() === "get monthly subscription") {
        await db.execute('UPDATE portable_charger_subscriptions SET total_booking = total_booking + 1 WHERE rider_id = ?', [rider_id]);
    }

    await insertRecord('portable_charger_history', ['booking_id', 'rider_id', 'order_status'], [bookingId, rider_id, 'CNF']);
    
    // const href = 'portable_charger_booking/' + bookingId;
    // const heading = 'Portable Charging Booking!';
    // const desc = `Your request for portable charging at home booking id: ${bookingId} has been placed.`;
    // createNotification(heading, desc, 'Portable Charging Booking', 'Rider', 'Admin','', rider_id, href);
    // pushNotification(rider.fcm_token, heading, desc, 'RDRFCM', href);

    const formattedDateTime = moment().format('DD MMM YYYY hh:mm A');
    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: rider.rider_email,
        subject: 'Your Portable Charger Booking Confirmation - PlusX Electric App',
        html: `<html>
            <body>
                <h4>Dear ${rider.rider_name},</h4>
                <p>Thank you for using the PlusX Electric App for Portable Charger Booking. We have successfully received your booking request. Below are the details of your roadside assistance booking:</p><br/>
                <p>Booking Reference: ${bookingId}</p>
                <p>Date & Time of Request: ${formattedDateTime}</p> 
                <p>Address: ${address}</p>                         
                <p>Service Type: ${service_type}</p><br/>
                <p> Regards,<br/> PlusX Electric App </p>
            </body>
        </html>`,
    });

    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: 'podbookings@plusxelectric.com',
        subject: `Portable Charger Booking - ${bookingId}`,
        html: `<html>
            <body>
                <h4>Dear Admin,</h4>
                <p>We have received a new booking for our Charging Installation service. Below are the details:</p> <br/>
                <p>Customer Name  : ${rider.rider_name}</p>
                <p>Address : ${address}</p>
                <p>Booking Time : ${formattedDateTime}</p> <br/>                        
                <p> Best regards,<br/> PlusX Electric App </p>
            </body>
        </html>`,
    });

    const rsa = await queryDB(`SELECT fcm_token, rsa_id FROM rsa WHERE status = ?, booking_type = ?`, [2, 'Portable Charger']);
    let respMsg = "Booking Request Submitted! Our team will be in touch with you shortly."; 

    if(rsa){
        const slotDateTime = moment(slot_date).format('YYYY-MM-DD') + ' ' + moment(slot_time, 'HH:mm:ss').format('HH:mm:ss');
        
        await insertRecord('portable_charger_booking_assign', 
            ['order_id', 'rsa_id', 'rider_id', 'slot_date_time', 'status'], [bookingId, rsa.rsa_id, rider.rider_id, slotDateTime, 0]
        );

        await updateRecord('portable_charger_booking', {rsa_id: rsa.rsa_id}, 'booking_id', bookingId);

        // const heading1 = 'Portable Charger!';
        // const desc1 = `A Booking of the Portable Charger service has been assigned to you with booking id : ${bookingId}`;
        // createNotification(heading, desc, 'Portable Charger', 'RSA', 'Rider', rider.rider_id, rsa.rsa_id, href);
        // pushNotification(rsa.fcm_token, heading, desc, 'RSAFCM', href);

        respMsg = "You have successfully placed Portable Charger booking. You will be notified soon."
    }

    return resp.json({
        status:1, 
        code: 200,
        booking_id: bookingId,
        message: respMsg 
    });
};

export const chargerBookingList = async (req, resp) => {
    const {rider_id, page_no, history } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit = 10;
    const start = parseInt((page_no * limit) - limit, 10);
    const statusCondition = (history && history == 1) ? ['PU', 'C'] : ['PU', 'C'];

    const totalQuery = `SELECT COUNT(*) AS total FROM portable_charger_booking WHERE rider_id = ? AND status NOT IN (?, ?)`;

    const [totalRows] = await db.execute(totalQuery, [rider_id, ...statusCondition]);
    const total = totalRows[0].total;
    const totalPage = Math.max(Math.ceil(total / limit), 1);

    const bookingsQuery = `SELECT booking_id, service_name, service_price, service_type, user_name, country_code, contact_no, slot_date, slot_time, status, created_at 
        FROM portable_charger_booking WHERE rider_id = ? AND status NOT IN (?, ?) ORDER BY id DESC LIMIT ${start}, ${parseInt(limit, 10)}
    `;

    const [bookingList] = await db.execute(bookingsQuery, [rider_id, ...statusCondition]);

    return resp.json({
        message: ["Portable Charger Booking List fetched successfully!"],
        data: bookingList,
        total_page: totalPage,
        status: 1,
        code: 200,
        base_url: `${req.protocol}://${req.get('host')}/uploads/portable-charger/`,
    });
};

export const chargerBookingDetail = async (req, resp) => {
    const {rider_id, booking_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], booking_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const booking = await queryDB(`SELECT * FROM portable_charger_booking WHERE rider_id = ? AND booking_id = ? LIMIT 1`, [rider_id, booking_id]);

    booking.invoice_url = '';
    if (booking.order_status == 'ES') {
        const invoice_id = booking.request_id.replace('CS', 'INVCS');
        booking.invoice_url = `${req.protocol}://${req.get('host')}/uploads/portable-charger-invoice/${invoice_id}-invoice.pdf`;
    }

    const [history] = await db.execute(`SELECT * FROM portable_charger_booking WHERE booking_id = ?`, [booking_id]);

    return resp.json({
        message: ["Charging Installation Service fetched successfully!"],
        service_data: booking,
        service_history: history,
        status: 1,
        code: 200,
    });
};

/* Invoice */
export const invoiceList = async (req, resp) => {
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
};

export const invoiceDetails = async (req, resp) => {
    const {rider_id, invoice_id } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], invoice_id: ["required"]});
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
};

/* RSA */
export const rsaBookingStage = async (req, resp) => {
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
    
};

export const bookingAction = async (req, resp) => {
    const {rsa_id, booking_id, reason, latitude, longitude, booking_status } = req.body;
    const { isValid, errors } = validateFields(req.body, {rsa_id: ["required"], booking_id: ["required"], reason: ["required"], latitude: ["required"], longitude: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    switch (booking_status) {
        case 'A': return await acceptBooking(req, resp);
        case 'RL': return await reachedLocation(req, resp);
        case 'CS': return await chargingStart(req, resp);
        case 'CC': return await chargingComplete(req, resp);
        case 'DO': return await vehicleDrop(req, resp);
        case 'PU': return await chargerPickedUp(req, resp);
        default: return resp.json({status: 0, code: 200, message: ['Invalid booking status.']});
    }
};

export const rejectBooking = async (req, resp) => {
    const {rsa_id, booking_id, reason } = req.body;
    const { isValid, errors } = validateFields(req.body, {rsa_id: ["required"], booking_id: ["required"], reason: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[rsa_id, booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const insert = await db.execute(
        'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "C", ?, ?, ?)',
        [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
    );

    if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

    await db.execute(
        'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "C", ?, ?, ?)',
        [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
    );
    await insertRecord('portable_charger_booking_rejected', [booking_id, rsa_id, rider_id, reason],[booking_id, rsa_id, checkOrder.rider_id, reason]);
    await db.execute(`DELETE FROM portable_charger_booking_assign WHERE order_id=? AND rsa_id=?`, [booking_id, rsa_id]);

    // const href = `portable_charger_booking/${booking_id}`;
    // const title = 'Booking Rejected';
    // const message = `Driver has rejected the portable charger booking with booking id: ${booking_id}`;
    // await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
    // await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: 'podbookings@plusxelectric.com',
        subject: `POD Service Booking rejected - ${booking_id}`,
        html: `<html>
            <body>
                <h4>Dear ${rider.rider_name},</h4>
                <p>Driver has rejected the portable charger booking. please assign one Driver on this booking</p> <br />
                <p>Booking ID: ${booking_id}</p>
                <p> Regards,<br/> PlusX Electric App </p>
            </body>
        </html>`,
    });

    return resp.json({ message: ['Booking has been rejected successfully!'], status: 1, code: 200 });
};


// booking action helper
const acceptBooking = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

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
        await updateRecord('portable_charger_booking', {status: 'A', rsa_id}, 'booking_id', booking_id);

        // const href = `portable_charger_booking/${booking_id}`;
        // const title = 'POD Booking Accepted';
        // const message = `Driver has accepted your POD booking service with booking id: ${booking_id} and he is enroute now`;
        // await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        // await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        const insert = await db.execute(
            'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "A", ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await db.execute('UPDATE rsa SET running_order = running_order + 1 WHERE rsa_id = ?', [rsa_id]);
        await db.execute('UPDATE portable_charger_booking_assign SET status = 1 WHERE order_id = ? AND rsa_id = ?', [booking_id, rsa_id]);

        return resp.json({ message: ['POD Booking accepted successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};

const reachedLocation = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[rsa_id, booking_id, rsa_id]);

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

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('portable_charger_booking', {status: 'RL', rsa_id}, 'booking_id', booking_id);

        // const href = `portable_charger_booking/${booking_id}`;
        // const title = 'POD Reached at Location';
        // const message = `Portable Charger Reached at Location Successfully!`;
        // await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        // await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['POD Reached at Location Successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};

const chargingStart = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[rsa_id, booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM portable_charger_history WHERE rsa_id = ? AND order_status = "CS" AND booking_id = ?',[rsa_id, booking_id]
    );

    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "CS", ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('portable_charger_booking', {status: 'CS', rsa_id}, 'booking_id', booking_id);

        // const href = `portable_charger_booking/${booking_id}`;
        // const title = 'Charging Start';
        // const message = `Your Vehicle Charging Start Successfully!`;
        // await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        // await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Vehicle Charging Start successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};

const chargingComplete = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[rsa_id, booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM portable_charger_history WHERE rsa_id = ? AND order_status = "CC" AND booking_id = ?',[rsa_id, booking_id]
    );

    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "CC", ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('portable_charger_booking', {status: 'CC', rsa_id}, 'booking_id', booking_id);

        // const href = `portable_charger_booking/${booking_id}`;
        // const title = 'Charging Completed!';
        // const message = `Your Vehicle Charging Start Completed!`;
        // await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        // await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Vehicle Charging Completed successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};

const chargerPickedUp = async (req, resp) => {
    const { booking_id, rsa_id, latitude, longitude } = req.body;

    if (!req.file) return resp.status(405).json({ message: "Vehicle Image is required", status: 0, code: 405, error: true });

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = portable_charger_booking_assign.rider_id) AS fcm_token,
            (select slot from portable_charger_booking as pb where pb.booking_id = portable_charger_booking_assign.order_id ) as slot_id
        FROM 
            portable_charger_booking_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[rsa_id, booking_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM portable_charger_history WHERE rsa_id = ? AND order_status = "PU" AND booking_id = ?',[rsa_id, booking_id]
    );

    if (ordHistoryCount.count === 0) {
        /* handle file upload */

        const insert = await db.execute(
            'INSERT INTO portable_charger_history (booking_id, rider_id, order_status, rsa_id, latitude, longitude, image) VALUES (?, ?, "PU", ?, ?, ?, ?)',
            [booking_id, checkOrder.rider_id, rsa_id, latitude, longitude, '']
        );

        if(insert.affectedRows = 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('portable_charger_booking', {status: 'PU', rsa_id}, 'booking_id', booking_id);
        await db.execute(`DELETE FROM portable_charger_booking_assign WHERE rsa_id=?`, [rsa_id]);
        await db.execute('UPDATE rsa SET running_order = running_order - 1 WHERE rsa_id = ?', [rsa_id]);
        await db.execute('UPDATE portable_charger_slot SET booking_limit = booking_limit - 1 WHERE slot_id = ?', [checkOrder.slot_id]);
        // const href = `portable_charger_booking/${booking_id}`;
        // const title = 'POD Picked Up';
        // const message = `Portable Charger picked-up successfully! with booking id : ${booking_id}`;
        // await createNotification(title, message, 'Portable Charging', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        // await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Portable Charger picked-up successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};