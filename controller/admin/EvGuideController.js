import db, { startTransaction, commitTransaction, rollbackTransaction } from '../../config/db.js';
import dotenv from 'dotenv';
// import crypto from 'crypto';
import { mergeParam, getOpenAndCloseTimings, convertTo24HourFormat} from '../../utils.js';
import validateFields from "../../validation.js";
dotenv.config();
import generateUniqueId from 'generate-unique-id';

import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';

export const guideList = async (req, resp) => {
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
            message: ["Ev Guide List fetched successfully!"],
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


export const addGuide = async (req, resp) => {
    const{ vehicle_type, vehicle_name, vehicle_model, description, engine, horse_power, max_speed, price, best_feature } = req.body;
    const { isValid, errors } = validateFields(req.body, { 
        vehicle_type : ["required"],
        vehicle_name : ["required"],
        vehicle_model   : ["required"],
        description  : ["required"],
        engine       : ["required"],
        horse_power  : ["required"],
        max_speed   : ["required"],
        price        : ["required"],
        best_feature : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try {
        const uploadedFiles = req.files;
        let cover_image     = '';
        if(req.files && req.files['cover_image']){
            cover_image = uploadedFiles ? uploadedFiles['cover_image'][0].filename : '';
        }
        const gallery_img = uploadedFiles['vehicle_gallery']?.map(file => file.filename) || [];
        const vehicle_id = `VH-${generateUniqueId({length:12})}`;
        const insert = await insertRecord('vehicle', [
            'vehicle_id', 'vehicle_type', 'vehicle_name', 'vehicle_model', 'description', 'engine', 'horse_power', 'max_speed', 'price', 'best_feature', 'status', 'image'
        ], [
            vehicle_id, vehicle_type, vehicle_name, vehicle_model, description, engine, horse_power, max_speed, price, best_feature, 1, cover_image
        ]);
        if(gallery_img.length > 0){
            const values = gallery_img.map(filename => [vehicle_id, filename]);
            const placeholders = values.map(() => '(?, ?)').join(', ');
            await db.execute(`INSERT INTO vehicle_gallery (vehicle_id, image_name) VALUES ${placeholders}`, values.flat());
        }
        return resp.json({
            status  : insert.affectedRows > 0 ? 1 : 0, 
            code    : 200, 
            message : insert.affectedRows > 0 ? "Vehicle added successfully" : "Failed to create, Please Try Again!", 
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const guideDetail = async (req, resp) => {
    try {
        const { vehicle_id } = req.body;

        const { isValid, errors } = validateFields(req.body, { vehicle_id: ["required"] });
        if (!isValid) {
            return resp.json({ status: 0, code: 422, message: errors });
        }
        const [vehicleDetails] = await db.execute(` SELECT * FROM vehicle WHERE vehicle_id = ?`, [vehicle_id] );

        if (!vehicleDetails.length) {
            return resp.status(404).json({
                status: 0,
                code: 404,
                message: 'Station not found.',
            });
        }
        return resp.json({
            status: 1,
            code: 200,
            message: ["Ev Guide Details fetched successfully!"],
            data: vehicleDetails[0],
            base_url: `${req.protocol}://${req.get('host')}/uploads/vehicle-image/`
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
export const editGuide = async (req, resp) => {
    const{ vehicle_id, vehicle_type, vehicle_name, vehicle_model, description, engine, horse_power, max_speed, price, best_feature } = req.body;
    const { isValid, errors } = validateFields(req.body, { 
        vehicle_id : ["required"],
        vehicle_type : ["required"],
        vehicle_name : ["required"],
        vehicle_model   : ["required"],
        description  : ["required"],
        engine       : ["required"],
        horse_power  : ["required"],
        max_speed   : ["required"],
        price        : ["required"],
        best_feature : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try {
        const vehicleData = await queryDB(`SELECT image FROM vehicle WHERE vehicle_id = ?`, [vehicle_id]);
        let cover_image = '';
        if(req.files && req.files['cover_image']){
            const files = req.files;
            cover_image = files ? files['cover_image'][0].filename : '';
        }
        const updates = {vehicle_type, vehicle_name, vehicle_model, description, engine, horse_power, max_speed, price, best_feature, image : cover_image};
        
        const update = await updateRecord('vehicle', updates, ['vehicle_id'], [vehicle_id]);
        const profileImgPath = path.join(__dirname, 'public/uploads/vehicle-image', vehicleData.image);
        if (req.file) {
            fs.unlink(profileImgPath, (err) => {
                if (err) {
                    console.error(`Failed to delete rider old image: ${profileImgPath}`, err);
                }
            });
        }
        return resp.json({
            status  : update.affectedRows > 0 ? 1 : 0, 
            code    : 200, 
            message : update.affectedRows > 0 ? "Vehicle updated successfully!" : "Failed to create, Please Try Again!", 
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const deleteGuide = async (req, resp) => {
    try {
        
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};
