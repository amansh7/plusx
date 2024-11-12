import db, { startTransaction, commitTransaction, rollbackTransaction } from '../../config/db.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { mergeParam, getOpenAndCloseTimings, convertTo24HourFormat} from '../../utils.js';
import validateFields from "../../validation.js";
dotenv.config();
import generateUniqueId from 'generate-unique-id';
import moment from 'moment';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const guideList = async (req, resp) => {
    try {
        const { page_no, search_text, start_date, end_date, sort_by = 'd' } = req.body; 

        const whereFields = []
        const whereValues = []
        const whereOperators = []
        const { isValid, errors } = validateFields(req.body, { page_no: ["required"] });
        if (!isValid) {
            return resp.json({ status: 0, code: 422, message: errors });
        }

        if (start_date && end_date) {
            const start = moment(start_date, "YYYY-MM-DD").format("YYYY-MM-DD");
            const end = moment(end_date, "YYYY-MM-DD").format("YYYY-MM-DD");
    
            whereFields.push('created_at', 'created_at');
            whereValues.push(start, end);
            whereOperators.push('>=', '<=');
        }

        // let whereClause = '';
        // let whereParams = [];
        // if (search_text.trim() !== '') {
        //     whereClause = 'station_name LIKE ?';
        //     whereParams.push(`%${station_name}%`);
        // }
        const result = await getPaginatedData({
            tableName: 'vehicle',
            columns: `vehicle_id, vehicle_type, vehicle_name, vehicle_model, horse_power, price, image`,
            sortColumn: 'id',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            liveSearchFields: ['vehicle_id', 'vehicle_type', 'vehicle_name', 'vehicle_model'],
            liveSearchTexts: [search_text, search_text, search_text, search_text],
            whereField: whereFields,
            whereValue: whereValues,
            whereOperator: whereOperators
        });

        return resp.json({
            status: 1,
            code: 200,
            message: ["Ev Guide List fetched successfully!"],
            data: result.data,
            total_page: result.totalPage,
            total: result.total,
            base_url: `${req.protocol}://${req.get('host')}/uploads/vehicle-image/`
        });

    } catch (error) {
        console.error('Error fetching vehicle list:', error);
        return resp.status(500).json({
            status: 0,
            code: 500,
            message: 'Error fetching vehicle list'
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
        const vehicle_id = `VH-${generateUniqueId({length:6})}`;
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
                message: 'Vehicle not found.',
            });
        }
        const [galleryImages] = await db.execute(
            `SELECT image_name FROM vehicle_gallery WHERE vehicle_id = ?`,
            [vehicle_id]
        );
        const imgName = galleryImages?.map(row => row.image_name);
        return resp.json({
            status: 1,
            code: 200,
            message: ["Ev Guide Details fetched successfully!"],
            data: vehicleDetails[0],
            gallery_data: imgName,
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
    const{ vehicle_id, vehicle_type, vehicle_name, vehicle_model, description, engine, horse_power, max_speed, price, best_feature, status } = req.body;
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
        const updates = {vehicle_type, vehicle_name, vehicle_model, description, engine, horse_power, max_speed, price, status, best_feature, image : cover_image};
        
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
