import db from '../../config/db.js';
import dotenv from 'dotenv';
import moment from 'moment';
import path from 'path';
import fs from 'fs';
import { getOpenAndCloseTimings, formatOpenAndCloseTimings, deleteFile, asyncHandler} from '../../utils.js';
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
import generateUniqueId from 'generate-unique-id';
dotenv.config();
const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const stationList = asyncHandler(async (req, resp) => {
    try {
        const { page_no, search, sort_by = 'd', start_date, end_date, search_text=''} = req.body; 
        const { isValid, errors } = validateFields(req.body, { page_no: ["required"] });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        // const result = await getPaginatedData({
        //     tableName: 'public_charging_station_list',
        //     columns: `station_id, station_name, charging_for, charger_type, station_image, price, address`,
        //     sortColumn:'id',
        //     sortOrder: 'DESC',
        //     page_no,
        //     limit: 10,
        //     searchFields: ['station_name'],
        //     searchTexts: [search],
        // });
        const params = {
            tableName: 'public_charging_station_list',
            columns: `station_id, station_name, charging_for, charger_type, station_image, price, address`,
            sortColumn:'id',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            // searchFields: ['station_name'],
            // searchTexts: [search],
            liveSearchFields: ['station_name', 'charger_type'],
            liveSearchTexts: [search_text, search_text],
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
});

export const stationData = asyncHandler(async (req, resp) => {
    const { station_id } = req.body;
    const chargingFor = ['All EV`s', 'Tesla', 'BYD', 'Polestar', 'GMC', 'Porsche', 'Volvo', 'Audi', 'Chevrolet', 'BMW', 'Mercedes', 'Zeekr', 'Volkswagen', 'HiPhi', 'Kia', 'Hyundai', 'Lotus', 'Ford', 'Rabdan'];
    const chargerType = ['Level 2', 'Fast Charger', 'Super Charger'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday' ];
    
    const result = {
        chargingFor,
        chargerType,
        days
    };

    if(station_id){
        const stationData = await queryDB(`SELECT * FROM public_charging_station_list WHERE station_id = ?`, [station_id]); 
        result.stationData = stationData; 
    }

    return resp.json({status: 1, code: 200, data: result});
});

export const stationDetail = asyncHandler(async (req, resp) => {
    const { station_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { station_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    let gallery = [];
    const station = await queryDB(`SELECT * FROM public_charging_station_list WHERE station_id = ?`, [station_id]); 
    if (!station) return resp.status(404).json({status: 0, code: 404, message: 'Station not found.'});
    
    station.schedule = getOpenAndCloseTimings(station);
    // const [gallery] = await db.execute(`SELECT image_name FROM public_charging_station_gallery WHERE station_id = ?`, [station_id]);
    // const galleryData = {};

    // gallery.forEach(row => {
    //     galleryData[row.id] = row.image_name;
    // });

    [gallery] = await db.execute(`SELECT image_name FROM public_charging_station_gallery WHERE station_id = ? ORDER BY id DESC LIMIT 5`, [station_id]);
    const imgName = gallery.map(row => row.image_name);
    const chargingFor = ['All EV`s', 'Tesla', 'BYD', 'Polestar', 'GMC', 'Porsche', 'Volvo', 'Audi', 'Chevrolet', 'BMW', 'Mercedes', 'Zeekr', 'Volkswagen', 'HiPhi', 'Kia', 'Hyundai', 'Lotus', 'Ford', 'Rabdan'];
    const chargerType = ['Level 2', 'Fast Charger', 'Super Charger'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday' ];
    
    const result = {
        chargingFor,
        chargerType,
        days
    };

    if(station_id){
        const stationData = await queryDB(`SELECT * FROM public_charging_station_list WHERE station_id = ?`, [station_id]); 
        result.stationData = stationData; 
    }

    return resp.json({
        status: 1,
        code: 200,
        message: ["Charging Station Details fetched successfully!"],
        data: station,
        // gallery_data: galleryData,
        gallery_data: imgName,
        result,
        base_url: `${req.protocol}://${req.get('host')}/uploads/charging-station-images/`
    });
});

export const addPublicCharger = asyncHandler(async (req, resp) => {
    try {
        
        
        const uploadedFiles = req.files;
        let stationImg      = '';
        const data          = req.body;

        if(req.files && req.files['cover_image']){
            stationImg = uploadedFiles ? uploadedFiles['cover_image'][0].filename : '';
        }
        const shop_gallery = uploadedFiles['shop_gallery']?.map(file => file.filename) || [];

        const { station_name, charging_for, charger_type, charging_point, description, address, latitude, longitude, always_open=0, days='', price='' } = req.body;
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

        const { fDays, fTiming } = formatOpenAndCloseTimings(always_open, data);

        const stationId = `TRQ${generateUniqueId({ length:6 })}`;  //charging_for
        // console.log(charging_for)
        const insert = await insertRecord('public_charging_station_list', [
            'station_id', 'station_name', 'price', 'description', 'charging_for', 'charger_type', 'charging_point', 'address', 'latitude', 'longitude', 'station_image', 'status', 
            'always_open', 'open_days', 'open_timing', 
        ], [
            stationId, station_name, price, description, charging_for, charger_type, charging_point, address, latitude, longitude, stationImg, 1, 
            always_open, fDays, fTiming
        ]);

        if(insert.affectedRows == 0) return resp.json({status:0, message: "Failed to add public charger! Please try again after some time."});

        if(shop_gallery.length > 0){
            const values = shop_gallery.map(filename => [stationId, filename]);
            const placeholders = values.map(() => '(?, ?)').join(', ');
            await db.execute(`INSERT INTO public_charging_station_gallery (station_id, image_name) VALUES ${placeholders}`, values.flat());
        }

        return resp.json({ status  : 1, message : "Public Charger added successfully." });

    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
});

export const editPublicCharger = asyncHandler(async (req, resp) => {
    try {
        console.log(req.body);
        const uploadedFiles = req.files;
        
        const data = req.body;
        
        const shop_gallery = uploadedFiles['shop_gallery']?.map(file => file.filename) || [];
        const { station_id, station_name, charging_for, charger_type, charging_point, description, address, latitude, longitude, always_open=0, days='', price='', status } = req.body;
        const { isValid, errors } = validateFields(req.body, { 
            station_id: ["required"], 
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

        const charger = await queryDB(`SELECT station_image FROM public_charging_station_list WHERE station_id = ?`, [station_id]);
        if(!charger) return resp.json({status:0, message: "Public Charger Data can not edit, or invalid station Id"});
        const [gallery] = await db.execute(`SELECT image_name FROM public_charging_station_gallery WHERE station_id = ?`, [station_id]);
        const galleryData = gallery.map(img => img.image_name);

        const { fDays, fTiming } = formatOpenAndCloseTimings(always_open, data);
        
        // let stationImg = req.files?.['cover_image']?.[0]?.filename || '';
        // let shop_gallery = req.files?.['shop_gallery']?.map(file => file.filename) || [];

        let stationImg = charger.station_image;
        if(req.files && req.files['cover_image']){
            stationImg = uploadedFiles ? uploadedFiles['cover_image'][0].filename : stationImg;
        }
        const updates = {
            station_name,
            price,
            description,
            charging_for: charging_for,
            charger_type,
            charging_point,
            address,
            latitude,
            longitude,
            status: status ? 1 : 0,
            always_open: always_open, 
            open_days: fDays, 
            open_timing: fTiming, 
            station_image: stationImg
        };
        
        if (req.files['cover_image']) deleteFile('charging-station-images', charger.station_image);
        if (req.files['shop_gallery'] && galleryData.length > 0) {
            galleryData.forEach(img => img && deleteFile('charging-station-images', img));
        }

        if(shop_gallery.length > 0){
            const values = shop_gallery.map(filename => [station_id, filename]);
            const placeholders = values.map(() => '(?, ?)').join(', ');
            await db.execute(`INSERT INTO public_charging_station_gallery (station_id, image_name) VALUES ${placeholders}`, values.flat());
        }

        const update = await updateRecord('public_charging_station_list', updates, ['station_id'], [station_id]);
        if(update.affectedRows == 0) return resp.json({status:0, message: "Failed to update! Please try again after some time."});

        return resp.json({ status  : 1, message : "Public Charger updated successfully." });

    }  catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
});

export const deletePublicCharger = asyncHandler(async (req, resp) => {
    const {station_id} = req.body;

    const charger = await queryDB(`SELECT station_image FROM public_charging_station_list WHERE station_id = ?`, [station_id]);
    if(!charger) return resp.json({status:0, message: "Public Charger Data can not edit, or invalid station Id"});
    const galleryData = await queryDB(`SELECT image_name FROM public_charging_station_gallery WHERE station_id = ?`, [station_id]);

    if (galleryData.length) {
        for (const img of galleryData) {
            if (img.image_name) {
                const file_path = path.join(__dirname, '../uploads/charging-station-images', img.image_name);
                fs.unlink(file_path, (err) => {
                    if (err) {
                        console.error(`Failed to delete image ${img.image_name}:`, err);
                    }
                });
            }
        }
    }
    if (charger.station_image) {
        const cover_file_path = path.join(__dirname, '../uploads/charging-station-images', charger.station_image);
        fs.unlink(cover_file_path, (err) => {
            if (err) {
                console.error(`Failed to delete cover image ${charger.station_image}:`, err);
            }
        });
    }

    await queryDB(`DELETE FROM public_charging_station_gallery WHERE station_id = ?`, [station_id]);
    await queryDB(`DELETE FROM public_charging_station_list WHERE station_id = ?`, [station_id]);

    return resp.json({ status: 1, msg: "Shop deleted successfully!" });
});

export const deletePublicChargerGallery = asyncHandler(async (req, resp) => {
    const { gallery_id } = req.body;
    if(!gallery_id) return resp.json({status:0, message: "Gallery Id is required"});

    const galleryData = await queryDB(`SELECT image_name FROM public_charging_station_gallery WHERE id = ? LIMIT 1`, [gallery_id]);
    
    if(galleryData){
        deleteFile('bike-rental-images', galleryData.image_name);
        await db.execute('DELETE FROM public_charging_station_gallery WHERE id = ?', [gallery_id]);
    }

    return resp.json({status: 1, message: "Gallery Img deleted successfully"});
});