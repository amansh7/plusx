import db from "../../config/db.js";
import validateFields from "../../validation.js";
import { queryDB, getPaginatedData } from '../../dbUtils.js';

export const clubList = async (req, resp) => {
    const {rider_id, page_no, preference, search_text, age_group, location, category, sort_by } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], page_no: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    let query = `SELECT club_id, club_name, location, no_of_members, cover_img, category, age_group, preference FROM clubs WHERE status = ?`;
    const queryParams = [1];

    if (preference) {
        query += ` AND preference LIKE ?`;
        queryParams.push(`%${preference}%`);
    }
    if (search_text) {
        query += ` AND club_name LIKE ?`;
        queryParams.push(`%${search_text}%`);
    }
    if (location) {
        query += ` AND location = ?`;
        queryParams.push(location);
    }
    if (age_group) {
        const ageArr = age_group.split(',');
        const ageGroupConditions = ageArr.map(age => `FIND_IN_SET(?, age_group)`).join(' OR ');
        query += ` AND (${ageGroupConditions})`;
        queryParams.push(...ageArr);
    }
    if (category) {
        const catArr = category.split(',');
        const categoryConditions = catArr.map(cat => `FIND_IN_SET(?, category)`).join(' OR ');
        query += ` AND (${categoryConditions})`;
        queryParams.push(...catArr);
    }

    const [totalResult] = await db.execute(`SELECT COUNT(*) AS total FROM (${query}) AS total_count`, queryParams);
    const limit = 10;
    const start = (page_no * limit) - limit;
    const total = totalResult[0].total;
    const total_page = Math.ceil(total / limit) || 1;

    query += ` ORDER BY club_name ASC LIMIT ?, ?`;
    queryParams.push(start, limit);

    const [clubData] = await db.execute(query, queryParams);
    return resp.json({
        message: ["Club List fetched successfully!"],
        data: clubData,
        total_page,
        club_cat: ["Women`s Cycling Club", "Junior Cycling Club", "Mountain Cycling Club", "Road Cycling Club", "Emirates Group Staff"],
        age_group: ['17 & Younger', 'Above 18', 'All age group'],
        status: 1,
        code: 200,
        base_url: `${req.protocol}://${req.get('host')}/uploads/club-images/`
    });
};

export const clubDetail = async (req, resp) => {
    const {rider_id, club_id } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], club_id: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const clubData = await queryDB(`SELECT * FROM clubs WHERE club_id= ? LIMIT 1`, [1, club_id]);
    const galleryData = await queryDB(`SELECT * FROM club_gallery WHERE club_id = ? ORDER BY id DESC LIMIT 5`, [club_id]);
    const imgName = galleryData.map(row => row.image_name);
    
    return resp.json({
        status: 1,
        code: 200,
        message: ["Bike Rental Details fetched successfully!"],
        data: clubData,
        gallery_data: imgName,
        base_url: `${req.protocol}://${req.get('host')}/uploads/bike-rental-images/`,
    });

};