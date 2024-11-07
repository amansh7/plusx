import db, { startTransaction, commitTransaction, rollbackTransaction } from '../../config/db.js';
import dotenv from 'dotenv';
import moment from 'moment';
import crypto from 'crypto';
import { mergeParam, getOpenAndCloseTimings, convertTo24HourFormat, formatDateTimeInQuery, createNotification, pushNotification} from '../../utils.js';
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
import generateUniqueId from 'generate-unique-id';
dotenv.config();

export const bookingList = async (req, resp) => {
    try {
        const { page_no, request_id, name, contact_no, order_status, start_date, end_date  } = req.body;
        const { isValid, errors } = validateFields(req.body, {page_no: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        // const result = await getPaginatedData({
        //     tableName: 'charging_service',
        //     columns: 'request_id, rider_id, rsa_id, name, country_code, contact_no, order_status, price, created_at',
        //     sortColumn: 'id',
        //     sortOrder: 'DESC',
        //     page_no,
        //     limit: 10,
        //     searchFields: ['request_id', 'name', 'contact_no', 'order_status'],
        //     searchTexts: [request_id, name, contact_no, order_status],
        // });

        const params = {
            tableName: 'charging_service',
            columns: 'request_id, rider_id, rsa_id, name, country_code, contact_no, order_status, price, created_at',
            sortColumn: 'created_at',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            searchFields: ['request_id', 'name', 'contact_no', 'order_status'],
            searchTexts: [request_id, name, contact_no, order_status],
        };

        if (start_date && end_date) {
            const start = moment(start_date, "YYYY-MM-DD").format("YYYY-MM-DD");
            const end = moment(end_date, "YYYY-MM-DD").format("YYYY-MM-DD");

            params.whereField = ['created_at', 'created_at'];
            params.whereValue = [start, end];
            params.whereOperator = ['>=', '<='];
        }

        const result = await getPaginatedData(params);

        return resp.json({
            status: 1,
            code: 200,
            message: ["Pick & Drop  Booking List fetch successfully!"],
            data: result.data,
            // slot_data: slotData,
            total_page: result.totalPage,
            total: result.total,
            // base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
        });
    } catch (error) {
        console.error('Error fetching p & d booking list:', error);
        resp.status(500).json({ message: 'Error fetching p & d booking list' });
    }
};

export const bookingDetails = async (req, resp) => {
    try {
        const { request_id } = req.body;

        if (!request_id) {
            return resp.status(400).json({
                status  : 0,
                code    : 400,
                message : 'Booking ID is required.',
            });
        }
        const result = await db.execute(`SELECT 
                cs.request_id, cs.name, cs.country_code, cs.contact_no, cs.order_status, cs.pickup_address, cs.price, 
                cs.parking_number, cs.parking_floor,
                (select concat(rsa_name, ",", country_code, "-", mobile) from rsa where rsa.rsa_id = cs.rsa_id) as rsa_data,
                (select concat(vehicle_make, "-", vehicle_model) from riders_vehicles as rv where rv.vehicle_id = cs.vehicle_id) as vehicle_data,
                ${formatDateTimeInQuery(['cs.slot_date_time', 'cs.created_at'])}
            FROM 
                charging_service cs
            WHERE 
                cs.request_id = ?`, 
            [request_id]
        );
        if (result.length === 0) {
            return resp.status(404).json({
                status  : 0,
                code    : 404,
                message : 'Booking not found.',
            });
        }
        const [history] = await db.execute(`SELECT order_status, cancel_by, cancel_reason as reason, created_at, image, (select rsa.rsa_name from rsa where rsa.rsa_id = charging_service_history.rsa_id) as rsa_name FROM charging_service_history WHERE service_id = ?`, [request_id]);

        return resp.json({
            status  : 1,
            code    : 200,
            message : ["Pick and Drop booking details fetched successfully!"],
            data    : result[0], 
            history,
            imageUrl : `${req.protocol}://${req.get('host')}/uploads/pick-drop-images/`,
        });
    } catch (error) {
        // console.error('Error fetching booking details:', error);
        return resp.status(500).json({ 
            status  : 0, 
            code    : 500, 
            message : 'Error fetching booking details' 
        });
    }
};

/* Invoice */
export const pdInvoiceList = async (req, resp) => {
    try {
        const { page_no } = req.body;

        const { isValid, errors } = validateFields(req.body, {
            page_no: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName: 'charging_service_invoice',
            columns: `invoice_id, amount, payment_status, invoice_date, currency, receipt_url,created_at,
                (select concat(name, ",", country_code, "-", contact_no) from charging_service as cs where cs.request_id = charging_service_invoice.request_id limit 1)
                AS riderDetails`,
            sortColumn: 'created_at',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            // whereField,
            // whereValue
        });

        return resp.json({
            status: 1,
            code: 200,
            message: ["Portable Charger Invoice List fetched successfully!"],
            data: result.data,
            total_page: result.totalPage,
            total: result.total,
            // base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
        });
    } catch (error) {
        console.error('Error fetching invoice list:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching invoice lists' });
    }
};

export const pdInvoiceDetails = async (req, resp) => {
    const { invoice_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { invoice_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoice = await queryDB(`
        SELECT 
            invoice_id, 
            amount AS price, 
            payment_status, 
            invoice_date, 
            currency, 
            payment_type, 
            cs.name, 
            cs.country_code, 
            cs.contact_no, 
            cs.request_id, 
            cs.slot_date_time, 
            cs.slot, 
            cs.parking_number, 
            cs.parking_floor, 
            cs.pickup_latitude, 
            cs.pickup_longitude,
            cs.created_at,
            (SELECT rider_email FROM riders AS rd WHERE rd.rider_id = csi.rider_id) AS rider_email
        FROM 
            charging_service_invoice AS csi
        LEFT JOIN
            charging_service AS cs ON cs.request_id = csi.request_id
        
        WHERE 
            csi.invoice_id = ?
    `, [invoice_id]);

    // invoice.invoice_url = `${req.protocol}://${req.get('host')}/uploads/portable-charger-invoice/${invoice_id}-invoice.pdf`;

    return resp.json({
        message: ["Pick & Drop Invoice Details fetched successfully!"],
        data: invoice,
        base_url: `${req.protocol}://${req.get('host')}/uploads/pick-drop-invoice/`,
        status: 1,
        code: 200,
    });
};
/* Invoice */

/* Slot */
export const pdSlotList = async (req, resp) => {
    try {
        const { page_no } = req.body;

        const { isValid, errors } = validateFields(req.body, {
            page_no: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName: 'pick_drop_slot',
            columns: 'slot_id, start_time, end_time, booking_limit, status, created_at',
            sortColumn: 'created_at',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            whereField: 'status',
            whereValue: 1
        });

        // const [slotData] = await db.execute(`SELECT slot_id, start_time, end_time, booking_limit FROM portable_charger_slot WHERE status = ?`, [1]);
        const formattedData = result.data.map((item) => ({
            slot_id: item.slot_id,
            booking_limit: item.booking_limit,
            status: item.status,
            created_at: item.created_at,
             timing: `${item.start_time} - ${item.end_time}`
        }));
        return resp.json({
            status: 1,
            code: 200,
            message: ["Pick & Drop Slot List fetched successfully!"],
            // data: result.data,
            data : formattedData,
            total_page: result.totalPage,
            total: result.total,
            // base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
        });
    } catch (error) {
        console.error('Error fetching slot list:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching charger lists' });
    }
};

export const pdSlotDetails = async (req, resp) => {
    try {
        const { slot_id, } = req.body;

        const { isValid, errors } = validateFields(req.body, {
            slot_id: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const [slotDetails] = await db.execute(`
            SELECT 
                slot_id, start_time, end_time, booking_limit, status, ${formatDateInQuery(['slot_date'])}
            FROM 
                pick_drop_slot 
            WHERE 
                slot_id = ?`, 
            [slot_id]
        );

        return resp.json({
            status: 1,
            code: 200,
            message: ["Portable And Drop Slot Details fetched successfully!"],
            data: slotDetails[0],
            
        });
    } catch (error) {
        console.error('Error fetching slot list:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching charger lists' });
    }
};

export const pdAddSlot = async (req, resp) => {
    try {
        const { slot_date, start_time, end_time, booking_limit, status = 1 } = req.body;
        const { isValid, errors } = validateFields(req.body, { slot_date: ["required"], start_time: ["required"], end_time: ["required"], booking_limit: ["required"], });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        if (!Array.isArray(slot_date) || !Array.isArray(start_time) || !Array.isArray(end_time) || !Array.isArray(booking_limit)) {
            return resp.json({ status: 0, code: 422, message: 'Input data must be in array format.' });
        }
        if (slot_date.length !== start_time.length || start_time.length !== end_time.length || end_time.length !== booking_limit.length) {
            return resp.json({ status: 0, code: 422, message: 'All input arrays must have the same length.' });
        }

        const values = []; const placeholders = [];

        for (let i = 0; i < slot_date.length; i++) {
            const slotId = `PDS${generateUniqueId({ length:6 })}`;
            const fSlotDate = moment(slot_date[i], "DD-MM-YYYY").format("YYYY-MM-DD");
            values.push(slotId, fSlotDate, convertTo24HourFormat(start_time[i]), convertTo24HourFormat(end_time[i]), booking_limit[i], status);
            placeholders.push('(?, ?, ?, ?, ?, ?)');
        }

        const query = `INSERT INTO pick_drop_slot (slot_id, slot_date, start_time, end_time, booking_limit, status) VALUES ${placeholders.join(', ')}`;
        const [insert] = await db.execute(query, values);
    
        return resp.json({
            code: 200,
            message: insert.affectedRows > 0 ? ['Slot added successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status: insert.affectedRows > 0 ? 1 : 0
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const pdEditSlot = async (req, resp) => {
    try {
        // console.log(req.body);
        
        const { slot_id, start_time, end_time, booking_limit, status } = req.body;

        const { isValid, errors } = validateFields({ 
            slot_id, start_time, end_time, booking_limit, status
        }, {
            slot_id : ["required"],
            start_time: ["required"],
            end_time: ["required"],
            booking_limit: ["required"],
            status: ["required"],
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
        const startTime24 = convertTo24HourFormat(start_time);
        const endTime24 = convertTo24HourFormat(end_time);

        const updates = {
            start_time : startTime24, 
            end_time : endTime24, 
            booking_limit, 
            status,
        };
    
        const update = await updateRecord('pick_drop_slot', updates, ['slot_id'], [slot_id]);
        // console.log("update", update);
        return resp.json({
            status: update.affectedRows > 0 ? 1 : 0,
            code: 200,
            message: update.affectedRows > 0 ? ['Slot updated successfully!'] : ['Oops! Something went wrong. Please try again.'],
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const pdDeleteSlot = async (req, resp) => {
    try {
        const { slot_id } = req.body; 

        const { isValid, errors } = validateFields(req.body, {
            slot_id: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const [del] = await db.execute(`DELETE FROM pick_drop_slot WHERE slot_id = ?`, [slot_id]);

        return resp.json({
            code: 200,
            message: del.affectedRows > 0 ? ['Time Slot deleted successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status: del.affectedRows > 0 ? 1 : 0
        });
    } catch (err) {
        console.error('Error deleting time slot', err);
        return resp.json({ status: 0, message: 'Error deleting time slot' });
    }
}
/* Slot */

// Assign Booking
export const PodAssignBooking = async (req, resp) => {
    const {  rsa_id, booking_id  } = mergeParam(req);
    const { isValid, errors }      = validateFields(mergeParam(req), {
        rsa_id     : ["required"],
        booking_id : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    const conn = await startTransaction();
    
    try{
        const booking_data = await queryDB( `SELECT rider_id, rsa_id, (select fcm_token from riders as r where r.rider_id = charging_service.rider_id ) as fcm_token FROM charging_service WHERE request_id = ?
        `, [booking_id ] );
    
        if (!booking_data) {
            return resp.json({ message: [`Sorry no booking found with this booking id ${booking_id}`], status: 0, code: 404 });
        }
        if(rsa_id == booking_data.rsa_id) {
            return resp.json({ message: [`This driver already assin on this booking!, please select another driver`], status: 0, code: 404 });
        }
        if( booking_data.rsa_id) {
            await updateRecord('charging_service_assign', {rsa_id: rsa_id, status: 0}, ['order_id'], [booking_id], conn);

        } else {
            await insertRecord('charging_service_assign', 
                [ 'order_id', 'rsa_id', 'rider_id', 'status' ], 
                [ order_id, booking_data.rider_id, rsa_id ], 
            conn);
        }
        await updateRecord('charging_service', {rsa_id: rsa_id}, ['request_id'], [booking_id], conn);
        
        const href    = 'charging_service/' + booking_id;
        const heading = 'Booking Assigned!';
        const desc    = `Your Valet Service Booking has been assigned to Driver by PlusX admin with booking id : ${booking_id}`;
        createNotification(heading, desc, 'Valet Charging Service', 'Rider', 'Admin','', booking_data.rider_id, href);
        pushNotification(booking_data.fcm_token, heading, desc, 'RDRFCM', href);
    
        const rsa = await queryDB(`SELECT fcm_token FROM rsa WHERE rsa_id = ?`, [rsa_id]);
        if(rsa) { 
            
            const heading1 = 'Valet Charging service';
            const desc1    = `A Booking of the Valet Charging service has been assigned to you with booking id : ${booking_id}`;
            createNotification(heading1, desc1, 'Valet Charging Service', 'RSA', 'Rider', booking_data.rider_id, rsa_id, href);
            pushNotification(rsa.fcm_token, heading1, desc1, 'RSAFCM', href);
        }
        await commitTransaction(conn);
        
        return resp.json({
            status  : 1, 
            code    : 200,
            message : "You have successfully assigned Charging service booking." 
        });

    } catch(err){
        await rollbackTransaction(conn);
        console.error("Transaction failed:", err);
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }finally{
        if (conn) conn.release();
    }
};

