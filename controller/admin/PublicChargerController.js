import db from '../../config/db.js';
import dotenv from 'dotenv';
import { mergeParam, getOpenAndCloseTimings, convertTo24HourFormat} from '../../utils.js';
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
import generateUniqueId from 'generate-unique-id';
dotenv.config();


export const stationList = async (req, resp) => {
    try {
        const { page_no, search, sort_by = 'd' } = req.body; 
        const { isValid, errors } = validateFields(req.body, { page_no: ["required"] });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName: 'public_charging_station_list',
            columns: `station_id, station_name, charging_for, charger_type, station_image, price, address`,
            sortColumn:'id',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            searchFields: ['station_name'],
            searchTexts: [search],
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

export const stationData = async (req, resp) => {
    const chargingFor = ['All EV`s', 'Tesla', 'BYD', 'Polestar', 'GMC', 'Porsche', 'Volvo', 'Audi', 'Chevrolet', 'BMW', 'Mercedes', 'Zeekr', 'Volkswagen', 'HiPhi', 'Kia', 'Hyundai', 'Lotus', 'Ford', 'Rabdan'];
    const chargerType = ['Level 2', 'Fast Charger', 'Super Charger'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday' ];

    const result = {
        chargingFor,
        chargerType,
        days
    };

    return resp.json({status: 1, code: 200, data: result});
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
                   description, charging_for, charger_type, charging_point, price, always_open, created_at, 
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
        const uploadedFiles = req.files;
        let station_image     = '';
        let timing          = '';
        const data          = req.body;

        if(req.files && req.files['cover_image']){
            station_image = uploadedFiles ? uploadedFiles['cover_image'][0].filename : '';
        }
        const shop_gallery = uploadedFiles['shop_gallery']?.map(file => file.filename) || [];

        const { station_name, charging_for, charger_type, charging_point, description, address, latitude, longitude, always_open=0, days=[], price='' } = req.body;
        const { isValid, errors } = validateFields(req.body, { 
            station_name: ["required"], 
            charging_for: ["required"], 
            charger_type: ["required"], 
            charging_point: ["required"], 
            description: ["required"], 
            address: ["required"], 
            latitude: ["required"], 
            longitude: ["required"], 
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        if (always_open) {
            const days          = data.days.join('_');
            const timeArr       = data.days.map(day => {
                const openTime  = data[`${day}_open_time`];
                const closeTime = data[`${day}_close_time`];
                if (openTime && closeTime) {
                    const formattedOpenTime = new Date(`1970-01-01T${openTime}`).toTimeString().slice(0, 8);
                    const formattedCloseTime = new Date(`1970-01-01T${closeTime}`).toTimeString().slice(0, 8);
                    return `${formattedOpenTime}-${formattedCloseTime}`;
                } else {
                    return 'Closed';
                }
            });
            timing = timeArr.join('_');
        }

        const stationId = `TRQ${generateUniqueId({ length:12 })}`;

        const insert = await insertRecord('public_charging_station_list', [
            'station_id', 'station_name', 'price', 'description', 'charging_for', 'charger_type', 'charging_point', 'address', 'latitude', 'longitude', 'station_image', 'status', 
            'always_open', 'open_days', 'open_timing', 
        ], [
            stationId, station_name, price, description, charging_for, charger_type, charging_point, address, latitude, longitude, station_image, 1, always_open ? 1 : 0, days, timing
        ]);

        if(insert.affectedRows == 0) return resp.json({status:0, message: "Failed to add public charger! Please try again after some time."});

        if(shop_gallery.length > 0){
            const values = shop_gallery.map(filename => [storeId, filename]);
            const placeholders = values.map(() => '(?, ?)').join(', ');
            await db.execute(`INSERT INTO store_gallery (store_id, image_name) VALUES ${placeholders}`, values.flat());
        }

        return resp.json({ status  : 1, message : "Public Charger added successfully." });

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