import db from "../../config/db.js";
import generateUniqueId from 'generate-unique-id';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import { formatDateInQuery, formatDateTimeInQuery } from '../../utils.js';
import validateFields from "../../validation.js";
import moment from 'moment';

// EV Insurance
export const evInsuranceList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'ev_insurance',
        columns: `insurance_id, owner_name, country, country_code, mobile_no, car_brand, car_images, registration_place, vehicle`,
        searchFields: ['mobile_no', 'vehicle'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["EV Insurance List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });   
};

export const evInsuranceDetail = async (req, resp) => {
    const { insurance_id } = req.body;
    const { isValid, errors } = validateFields(req.body, {insurance_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const data = await queryDB(`SELECT *, ${formatDateTimeInQuery(['created_at', 'updated_at', 'insurance_expiry'])}, ${formatDateInQuery(['date_of_birth'])} FROM ev_insurance WHERE insurance_id = ? LIMIT 1`, [insurance_id]);
    
    return resp.json({
        status: 1,
        code: 200,
        message: ["EV Insurance Detail fetched successfully!"],
        data: data,
        base_url: `${req.protocol}://${req.get('host')}/uploads/insurance-images/`,
    });
};

// EV Pre-Sale Testing Booking
export const evPreSaleList = async (req, resp) => {
    const { search, page_no } = req.body;

    const result = await getPaginatedData({
        tableName: 'ev_pre_sale_testing',
        columns: `booking_id, owner_name, country_code, mobile_no, ${formatDateTimeInQuery(['created_at'])},
            (SELECT CONCAT(vehicle_model, "-", vehicle_make) FROM riders_vehicles AS rv WHERE rv.vehicle_id = ev_pre_sale_testing.vehicle) AS vehicle_data
        `,
        searchFields: ['mobile_no', 'vehicle'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
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

export const evPreSaleDetail = async (req, resp) => {
    const { booking_id } = req.body;
    const { isValid, errors } = validateFields(req.body, {booking_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const data = await queryDB(`
        SELECT 
            ev_pre_sale_testing.*, 
            (SELECT CONCAT(rv.vehicle_model, "-", rv.vehicle_make) FROM riders_vehicles AS rv WHERE rv.vehicle_id = ev_pre_sale_testing.vehicle) AS vehicle_data,
            ${formatDateTimeInQuery(['created_at', 'updated_at'])},
            ${formatDateInQuery(['date_of_birth', 'slot_date'])} 
        FROM ev_pre_sale_testing 
        WHERE booking_id = ? 
        LIMIT 1
    `, [booking_id]);
    
    return resp.json({
        status: 1,
        code: 200,
        message: ["EV Insurance Detail fetched successfully!"],
        data: data,
        base_url: `${req.protocol}://${req.get('host')}/uploads/insurance-images/`,
    });
};


// Time Slot 
export const evPreSaleTimeSlot = async (req, resp) => {
    const { page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'ev_pre_sale_testing_slot',
        columns: `slot_id, slot_name, start_time, end_time, booking_limit, status`,
        sortColumn: 'id',
        sortOrder: 'ASC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["EV Time Slot List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    }); 
};

export const evPreSaleTimeSlotAdd = async (req, resp) => {
    const { slot_name, start_time, end_time, booking_limit }  = req.body;
    const { isValid, errors } = validateFields(req.body, { slot_name: ["required"], start_time: ["required"], end_time: ["required"], booking_limit: ["required"]  });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const start = moment(start_time, 'HH:mm:ss');
    const end = moment(end_time, 'HH:mm:ss');

    if (end.isSameOrBefore(start)) return resp.status(422).json({ message: "End Time should be greater than Start Time!", status: 0 });
    
    const insert = await insertRecord('ev_pre_sale_testing_slot', [
        'slot_id', 'slot_name', 'start_time', 'end_time', 'booking_limit', 'status', 
    ], [
        `PST${generateUniqueId({ length:12 })}`, slot_name, start, end, booking_limit, 1
    ]);

    return resp.json({
        status: insert.affectedRows > 0 ? 1 : 0,
        status: insert.affectedRows > 0 ? 200 : 422,
        message: insert.affectedRows > 0 ? "Time Slot Added Successfully" : "Failed to add time slot.",
    });
};

export const evPreSaleTimeSlotEdit = async (req, resp) => {
    const { slot_id, slot_name, start_time, end_time, booking_limit, status='' }  = req.body;
    const { isValid, errors } = validateFields(req.body, { slot_id: ["required"], slot_name: ["required"], start_time: ["required"], end_time: ["required"], booking_limit: ["required"]  });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const start = moment(start_time, 'HH:mm:ss');
    const end = moment(end_time, 'HH:mm:ss');

    if (end.isSameOrBefore(start)) return resp.status(422).json({ message: "End Time should be greater than Start Time!", status: 0 });
    
    const updates = {slot_name, start_time: start, end_time: end, booking_limit, status: status ? 1 : 0};
    const update = await updateRecord('ev_pre_sale_testing_slot', updates, ['slot_id'], [slot_id]);

    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0,
        status: update.affectedRows > 0 ? 200 : 422,
        message: update.affectedRows > 0 ? "Time Slot Updated Successfully" : "Failed to update time slot.",
    }); 
};

export const evPreSaleTimeSlotDelete = async (req, resp) => {
    const { slot_id }  = req.body;
    if (!slot_id) return resp.json({ status: 0, code: 422, message: "Slot Id is required." });

    const del = await db.execute('DELETE FROM ev_pre_sale_testing_slot WHERE slot_id = ?', [slot_id]);

    return resp.json({
        status: del.affectedRows > 0 ? 1 : 0,
        status: del.affectedRows > 0 ? 200 : 422,
        message: del.affectedRows > 0 ? "Time Slot Deleted Successfully" : "Failed to delete time slot.",
    }); 
};

