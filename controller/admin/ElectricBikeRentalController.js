import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";

export const bikesList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'electric_bike_rental',
        columns: `rental_id, bike_name, available_on, bike_type, price, contract`,
        searchFields: ['bike_name'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Bike List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
};

export const bikeData = async (req, resp) => {
    const { rental_id } = req.body;
    const bike = await queryDB(`SELECT * FROM electric_bike_rental WHERE rental_id = ?`, [rental_id]);
    const [gallery] = await db.execute(`SELECT image_name FROM electric_bike_rental_gallery WHERE rental_id = ? ORDER BY id DESC`, [rental_id]);
    const galleryData = gallery.map(image => image.image_name);

    const result = {
        status: 1,
        
    }
    if(rental_id){
        result.bike = bike;
        result.galleryData = galleryData;
    }

    return resp.status(200).json(result);
};


