import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";

export const vehicleList = async (req, resp) => {
    const { vehicle_name, vehicle_type, vehicle_model, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'vehicle',
        columns: `vehicle_id, vehicle_name, vehicle_model, vehicle_type, horse_power, price`,
        searchFields: ['vehicle_name', 'vehicle_type', 'vehicle_model'],
        searchTexts: [vehicle_name, vehicle_type, vehicle_model],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Vehicle List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
};

export const vehicleData = async (req, resp) => {
    const { vehicle_id } = req.body;
    const vehicle = await queryDB(`SELECT * FROM vehicle WHERE vehicle_id = ?`, [vehicle_id]);
    const [gallery] = await db.execute(`SELECT image_name FROM vehicle_gallery WHERE vehicle_id = ? ORDER BY id DESC`, [vehicle_id]);
    const galleryData = gallery.map(image => image.image_name);

    const result = {
        status: 1,
        
    }
    if(vehicle_id){
        result.vehicle = vehicle;
        result.galleryData = galleryData;
    }

    return resp.status(200).json(result);
};


