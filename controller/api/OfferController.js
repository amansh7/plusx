import db from "../../config/db.js";
import validateFields from "../../validation.js";
import { queryDB, getPaginatedData } from '../../dbUtils.js';
import moment from "moment";

export const offerList = async (req, resp) => {
    const {rider_id, page_no } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], page_no: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await getPaginatedData({
        tableName: 'offer',
        columns: 'id, offer_id, offer_name, offer_exp_date, offer_image, offer_url',
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
        whereField: 'offer_exp_date',
        whereValue: moment().format('YYYY-MM-DD'),
        whereOperator: '>='
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Offer List fetched successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
        base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
    });
};

export const offerDetail = async (req, resp) => {
    const {rider_id, offer_id } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], offer_id: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const offer = await queryDB(`SELECT * FROM offer WHERE offer_id= ? LIMIT 1`, [offer_id]);
    
    return resp.json({
        status: 1,
        code: 200,
        message: ["Offer Details fetched successfully!"],
        data: offer,
        base_url: `${req.protocol}://${req.get('host')}/uploads/offer/`,
    });
};