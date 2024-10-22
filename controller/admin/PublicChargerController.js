import db from '../../config/db.js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { mergeParam, getOpenAndCloseTimings, convertTo24HourFormat} from '../../utils.js';
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
dotenv.config();


export const stationList = async (req, resp) => {
    try {
        const { page_no, search_text, sort_by = 'd' } = req.body; 

        const { isValid, errors } = validateFields(req.body, { page_no: ["required"] });
        if (!isValid) {
            return resp.json({ status: 0, code: 422, message: errors });
        }

        // let whereClause = '';
        // let whereParams = [];
        // if (search_text.trim() !== '') {
        //     whereClause = 'station_name LIKE ?';
        //     whereParams.push(`%${station_name}%`);
        // }
        const result = await getPaginatedData({
            tableName: 'public_charging_station_list',
            columns: `station_id, station_name, address, status, station_image, latitude, longitude, 
                      description, charging_for, charger_type, charging_point, price, status, always_open, 
                      REPLACE(open_days, "_", ", ") AS open_days, 
                      REPLACE(open_timing, "_", ", ") AS open_timing`,
            sortColumn: 'station_name',
            sortOrder: sort_by === 'd' ? 'DESC' : 'ASC',
            page_no,
            limit: 10,
            searchFields: ['station_name'],
            searchTexts: [search_text],
        });

        return resp.json({
            status: 1,
            code: 200,
            message: ["Charging Station List fetched successfully!"],
            data: result.data,
            total_page: result.totalPage,
            total: result.total,
            base_url: `${req.protocol}://${req.get('host')}/uploads/charging-station-images/`
        });

    } catch (error) {
        console.error('Error fetching station list:', error);
        return resp.status(500).json({
            status: 0,
            code: 500,
            message: 'Error fetching station list'
        });
    }
};

export const stationDetail = async (req, resp) => {
    try {
        const { station_id } = req.body;

        const { isValid, errors } = validateFields(req.body, { station_id: ["required"] });
        if (!isValid) {
            return resp.json({ status: 0, code: 422, message: errors });
        }

        const [stationDetails] = await db.execute(`
            SELECT station_id, station_name, address, status, station_image, latitude, longitude, 
                   description, charging_for, charger_type, charging_point, price, always_open, 
                   REPLACE(open_days, "_", ", ") AS open_days, 
                   REPLACE(open_timing, "_", ", ") AS open_timing 
            FROM public_charging_station_list 
            WHERE station_id = ?`, 
            [station_id]
        );

        if (!stationDetails.length) {
            return resp.status(404).json({
                status: 0,
                code: 404,
                message: 'Station not found.',
            });
        }

        return resp.json({
            status: 1,
            code: 200,
            message: ["Charging Station Details fetched successfully!"],
            data: stationDetails[0],
            base_url: `${req.protocol}://${req.get('host')}/uploads/charging-station-images/`
        });

    } catch (error) {
        console.error('Error fetching station details:', error);
        return resp.status(500).json({
            status: 0,
            code: 500,
            message: 'Error fetching station details'
        });
    }
};

export const addPublicCharger = async (req, resp) => {
    try {
        
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const editPublicCharger = async (req, resp) => {
    try {
        
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};