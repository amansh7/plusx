import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";

export const carsList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'electric_car_rental',
        columns: `rental_id, car_name, available_on, car_type, price, contract`,
        searchFields: ['car_name'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Car List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
};

export const carData = async (req, resp) => {
    const { rental_id } = req.body;
    const car = await queryDB(`SELECT * FROM electric_car_rental WHERE rental_id = ?`, [rental_id]);
    const [gallery] = await db.execute(`SELECT image_name FROM electric_car_rental_gallery WHERE rental_id = ? ORDER BY id DESC`, [rental_id]);
    const galleryData = gallery.map(image => image.image_name);

    const result = {
        status: 1,
        
    }
    if(rental_id){
        result.car = car;
        result.galleryData = galleryData;
    }

    return resp.status(200).json(result);
};


