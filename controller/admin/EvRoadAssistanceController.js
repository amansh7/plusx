import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";

export const bookingList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'road_assistance',
        columns: `request_id, rider_id, rsa_id, name, country_code, contact_no, price, order_status, created_at`,
        searchFields: ['name'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Booking List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
};

export const bookingData = async (req, resp) => {
    const { request_id } = req.body;
    const booking = await queryDB(`SELECT * FROM road_assistance WHERE request_id = ?`, [request_id]);

    const result = {
        status: 1,
    }

    if(request_id){
        result.booking = booking;
    }

    return resp.status(200).json(result);
};

export const invoiceList = async (req, resp) => {
    const { page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'road_assistance_invoice',
        // columns: `vehicle_id, vehicle_name, vehicle_model, vehicle_type, horse_power, price`,
        columns: `invoice_id, request_id, rider_id, amount, transaction_id, payment_type,payment_status, invoice_date, receipt_url, created_at, 
                (select concat(name, ",", country_code, "-", contact_no) from road_assistance as cs where cs.request_id = road_assistance_invoice.request_id limit 1)
                AS riderDetails`,
        searchFields: [],
        searchTexts: [],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Invoice List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
};

export const invoiceData = async (req, resp) => {
    const { invoice_id } = req.body;
    const invoice = await queryDB(`
        SELECT rai.*, ra.name, ra.country_code, ra.contact_no
        FROM road_assistance_invoice AS rai
        JOIN road_assistance AS ra ON rai.request_id = ra.request_id
        WHERE rai.invoice_id = ?
    `, [invoice_id]);

    const result = {
        status: 1,
        invoice
    };

    return resp.status(200).json(result);
};


