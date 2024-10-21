import db from '../../config/db.js';
import dotenv from 'dotenv';
import { mergeParam, getOpenAndCloseTimings} from '../../utils.js';
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

        // Validation
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

        // Prepare fields to update
        const updates = {
            charger_name, 
            charger_price, 
            charger_feature, 
            charger_type,
            status
        };

        // Only include charger_image if it's provided
        if (charger_image) {
            updates.image = charger_image;
        }

        // Update the charger details in the database
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
            columns: 'booking_id, rider_id, rsa_id, charger_id, vehicle_id, service_name, service_price, service_type, user_name, contact_no, slot_date, slot_time, created_at',
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
            message: ["Portable Charger List fetched successfully!"],
            data: result.data,
            // slot_data: slotData,
            total_page: result.totalPage,
            total: result.total,
            base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
        });
    } catch (error) {
        console.error('Error fetching charger list:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching charger lists' });
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









