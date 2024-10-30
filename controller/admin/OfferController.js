import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";

export const offerList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'offer',
        columns: `offer_id, offer_name, offer_exp_date, offer_image, status`,
        searchFields: ['offer_name'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Offer List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
};

export const offerData = async (req, resp) => {
    const { offer_id } = req.body;
    const offer = await queryDB(`SELECT * FROM offer WHERE offer_id = ?`, [offer_id]);

    const result = {
        status: 1,
    }
    if(offer_id){
        result.offer = offer;
    }

    return resp.status(200).json(result);
};


