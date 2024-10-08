import db from "../../config/db.js";
import validateFields from "../../validation.js";
import { queryDB, getPaginatedData } from '../../dbUtils.js';

export const carList = async (req, resp) => {
    const {rider_id, page_no, search_text, sort_by } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], page_no: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const sortOrder = sort_by === 'd' ? 'DESC' : 'ASC';

    const result = await getPaginatedData({
        tableName: 'electric_car_rental',
        columns: 'rental_id, car_name, available_on, car_type, image, price, contract',
        searchField: 'car_name',
        searchText: search_text,
        sortColumn: 'id',
        sortOrder,
        page_no,
        limit: 10,
        whereField: 'status',
        whereValue: 1
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Car Rental List fetched successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
        base_url: `${req.protocol}://${req.get('host')}/uploads/car-rental-images/`,
    });
};

export const carDetail = async (req, resp) => {
    const {rider_id, rental_id } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], rental_id: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const rentalData = await queryDB(`SELECT * FROM electric_car_rental WHERE status = ? AND rental_id= ? LIMIT 1`, [1, rental_id]);
    const galleryData = await queryDB(`SELECT * FROM electric_car_rental_gallery WHERE rental_id = ? ORDER BY id DESC LIMIT 5`, [rental_id]);
    const imgName = galleryData.map(row => row.image_name);
    
    return resp.json({
        status: 1,
        code: 200,
        message: ["Car Rental Details fetched successfully!"],
        data: rentalData,
        gallery_data: imgName,
        base_url: `${req.protocol}://${req.get('host')}/uploads/car-rental-images/`,
    });

};