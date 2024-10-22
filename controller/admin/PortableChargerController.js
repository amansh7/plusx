import db from '../../config/db.js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { mergeParam, getOpenAndCloseTimings, convertTo24HourFormat} from '../../utils.js';
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
dotenv.config();


export const chargerList = async (req, resp) => {
    try {
        const {rider_id, page_no } = req.body;
    const { isValid, errors } = validateFields(req.body, {page_no: ["required"]});
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
    } catch (error) {
        console.error('Error fetching charger list:', error);
        resp.status(500).json({ message: 'Error fetching charger lists' });
    }
};

export const addCharger = async (req, resp) => {
    try {
        const { charger_name, charger_price, charger_feature, charger_type, status = 1 } = req.body;
        const charger_image = req.files && req.files['charger_image'] ? req.files['charger_image'][0].filename : null;

        // Validation
        const { isValid, errors } = validateFields({ 
            charger_name, charger_price, charger_feature, charger_image, charger_type
        }, {
            charger_name: ["required"],
            charger_price: ["required"],
            charger_feature: ["required"],
            charger_image: ["required"], 
            charger_type: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
        const last = await queryDB(`SELECT id FROM portable_charger ORDER BY id DESC LIMIT 1`);
        const start = last ? last.id : 0;
        const nextId = start + 1;
        const chargerId = 'PCGR' + String(nextId).padStart(4, '0');
    console.log(req.body, status, chargerId, charger_image);
    
        const insert = await insertRecord('portable_charger', [
            'charger_id', 'charger_name', 'charger_price', 'charger_feature', 'image', 'charger_type', 'status'
        ],[
            chargerId, charger_name, charger_price, charger_feature, charger_image, charger_type, status
        ]);
    
        return resp.json({
            message: insert.affectedRows > 0 ? ['Charger added successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status: insert.affectedRows > 0 ? 1 : 0
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const editCharger = async (req, resp) => {
    try {
        const { charger_id, charger_name, charger_price, charger_feature, charger_type, status } = req.body;
        const charger_image = req.files && req.files['charger_image'] ? req.files['charger_image'][0].filename : null;

        const { isValid, errors } = validateFields({ 
            charger_id, charger_name, charger_price, charger_feature, charger_type, status, charger_image
        }, {
            charger_id: ["required"],
            charger_name: ["required"],
            charger_price: ["required"],
            charger_feature: ["required"],
            charger_type: ["required"], 
            charger_image: ["required"], 
            status : ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const updates = {
            charger_name, 
            charger_price, 
            charger_feature, 
            charger_type,
            status
        };

        if (charger_image) {
            updates.image = charger_image;
        }

        const update = await updateRecord('portable_charger', updates, ['charger_id'], [charger_id]);

        return resp.json({
            status: update.affectedRows > 0 ? 1 : 0,
            code: 200,
            message: update.affectedRows > 0 ? ['Charger updated successfully!'] : ['Oops! Something went wrong. Please try again.'],
        });

    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const deleteCharger = async (req, resp) => {
    try {
        const { charger_id } = req.body; 

        const { isValid, errors } = validateFields(req.body, {
            charger_id: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const [del] = await db.execute(`DELETE FROM portable_charger WHERE charger_id = ?`, [charger_id]);

        return resp.json({
            message: del.affectedRows > 0 ? ['Charger deleted successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status: del.affectedRows > 0 ? 1 : 0
        });
    } catch (err) {
        console.error('Error deleting portable charger', err);
        return resp.json({ status: 0, message: 'Error deleting portable charger' });
    }
};

export const chargerBookingList = async (req, resp) => {
    try {
        const { page_no, booking_id, name, contact, status } = req.body;

        const { isValid, errors } = validateFields(req.body, {
            page_no: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName: 'portable_charger_booking',
            columns: 'booking_id, rider_id, rsa_id, charger_id, vehicle_id, service_name, service_price, service_type, user_name, contact_no, status, slot_date, slot_time, created_at',
            sortColumn: 'created_at',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            searchFields: ['booking_id', 'user_name', 'contact_no', 'status'],
            searchTexts: [booking_id, name, contact, status],
        });

        // const [slotData] = await db.execute(`SELECT slot_id, start_time, end_time, booking_limit FROM portable_charger_slot WHERE status = ?`, [1]);

        return resp.json({
            status: 1,
            code: 200,
            message: ["Portable Charger Booking List fetched successfully!"],
            data: result.data,
            // slot_data: slotData,
            total_page: result.totalPage,
            total: result.total,
            base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
        });
    } catch (error) {
        console.error('Error fetching charger booking list:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching charger booking lists' });
    }
};

export const chargerBookingDetails = async (req, resp) => {
    try {
        const { booking_id } = req.body;

        if (!booking_id) {
            return resp.status(400).json({
                status: 0,
                code: 400,
                message: 'Booking ID is required.',
            });
        }

        const result = await db.execute(`
            SELECT 
                booking_id, rider_id, rsa_id, charger_id, vehicle_id, 
                service_name, service_price, service_type, user_name, 
                contact_no, slot_date, slot_time 
            FROM 
                portable_charger_booking 
            WHERE 
                booking_id = ?`, 
            [booking_id]
        );

        if (result.length === 0) {
            return resp.status(404).json({
                status: 0,
                code: 404,
                message: 'Booking not found.',
            });
        }

        return resp.json({
            status: 1,
            code: 200,
            message: ["Booking details fetched successfully!"],
            data: result[0], 
        });
    } catch (error) {
        console.error('Error fetching booking details:', error);
        return resp.status(500).json({ 
            status: 0, 
            code: 500, 
            message: 'Error fetching booking details' 
        });
    }
};

/* Invoice */
export const invoiceList = async (req, resp) => {
    try {
        const { page_no } = req.body;

        const { isValid, errors } = validateFields(req.body, {
            page_no: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName: 'portable_charger_invoice',
            columns: `invoice_id, amount, payment_status, invoice_date, currency, 
                (select concat(user_name, ",", country_code, "-", contact_no) from portable_charger_booking as pcb where pcb.booking_id = portable_charger_invoice.request_id limit 1)
                AS riderDetails`,
            sortColumn: 'id',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            // whereField,
            // whereValue
        });

        // const [slotData] = await db.execute(`SELECT slot_id, start_time, end_time, booking_limit FROM portable_charger_slot WHERE status = ?`, [1]);

        return resp.json({
            status: 1,
            code: 200,
            message: ["Portable Charger Invoice List fetched successfully!"],
            data: result.data,
            total_page: result.totalPage,
            total: result.total,
            base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
        });
    } catch (error) {
        console.error('Error fetching invoice list:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching invoice lists' });
    }
};

export const invoiceDetails = async (req, resp) => {
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
            pcb.user_name, 
            pcb.country_code, 
            pcb.contact_no, 
            pcb.address, 
            pcb.booking_id, 
            cs.start_time, 
            pcb.slot_time, 
            pcb.slot_date, 
            (SELECT rider_email FROM riders AS rd WHERE rd.rider_id = pci.rider_id) AS rider_email
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
        message: ["Portable Charger Invoice Details fetched successfully!"],
        data: invoice,
        status: 1,
        code: 200,
    });
};
/* Invoice */

/* Slot */
export const slotList = async (req, resp) => {
    try {
        const { page_no } = req.body;

        const { isValid, errors } = validateFields(req.body, {
            page_no: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName: 'portable_charger_slot',
            columns: 'slot_id, start_time, end_time, booking_limit, status, created_at',
            sortColumn: 'created_at',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            whereField: 'status',
            whereValue: 1
        });

        // const [slotData] = await db.execute(`SELECT slot_id, start_time, end_time, booking_limit FROM portable_charger_slot WHERE status = ?`, [1]);

        return resp.json({
            status: 1,
            code: 200,
            message: ["Portable Charger Slot List fetched successfully!"],
            data: result.data,
            total_page: result.totalPage,
            total: result.total,
            // base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
        });
    } catch (error) {
        console.error('Error fetching slot list:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching charger lists' });
    }
};

export const addSlot = async (req, resp) => {
    try {
        const { start_time, end_time, booking_limit, status = 1 } = req.body;

        // Validation
        const { isValid, errors } = validateFields({ 
            start_time, end_time, booking_limit
        }, {
            start_time: ["required"],
            end_time: ["required"],
            booking_limit: ["required"],
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
        const startTime24 = convertTo24HourFormat(start_time);
        const endTime24 = convertTo24HourFormat(end_time);

        const generateSlotId = () => {
            const prefix = 'PTS'; 
            const uniqueString = crypto.randomBytes(6).toString('hex').slice(0, 12);
            return `${prefix}${uniqueString}`; 
        };
        

    const slot_id = generateSlotId();
    console.log(slot_id, status, startTime24, endTime24, req.body);
    
    
        const insert = await insertRecord('portable_charger_slot', [
            'slot_id', 'start_time', 'end_time', 'booking_limit', 'status'
        ],[
            slot_id, startTime24, endTime24, booking_limit, status
        ]);
    
        return resp.json({
            message: insert.affectedRows > 0 ? ['Slot added successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status: insert.affectedRows > 0 ? 1 : 0
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const editSlot = async (req, resp) => {
    try {
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
    
        const update = await updateRecord('portable_charger_slot', updates, ['slot_id'], [slot_id]);

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

export const deleteSlot = async (req, resp) => {
    try {
        const { slot_id } = req.body; 

        const { isValid, errors } = validateFields(req.body, {
            slot_id: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const [del] = await db.execute(`DELETE FROM portable_charger_slot WHERE slot_id = ?`, [slot_id]);

        return resp.json({
            message: del.affectedRows > 0 ? ['Time Slot deleted successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status: del.affectedRows > 0 ? 1 : 0
        });
    } catch (err) {
        console.error('Error deleting time slot', err);
        return resp.json({ status: 0, message: 'Error deleting time slot' });
    }
}
/* Slot */




