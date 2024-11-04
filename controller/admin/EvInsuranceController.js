import { getPaginatedData, queryDB } from '../../dbUtils.js';
import { formatDateInQuery, formatDateTimeInQuery } from '../../utils.js';
import validateFields from "../../validation.js";

export const evInsuranceList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'ev_insurance',
        columns: `insurance_id, owner_name, country, country_code, mobile_no, car_brand, car_images, registration_place, vehicle`,
        searchFields: ['mobile_no', 'vehicle'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["EV Insurance List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });   
};

export const evInsuranceDetail = async (req, resp) => {
    const { insurance_id } = req.body;
    const { isValid, errors } = validateFields(req.body, {insurance_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const data = await queryDB(`SELECT *, ${formatDateTimeInQuery(['created_at', 'updated_at', 'insurance_expiry'])}, ${formatDateInQuery(['date_of_birth'])} FROM ev_insurance WHERE insurance_id = ? LIMIT 1`, [insurance_id]);
    
    return resp.json({
        status: 1,
        code: 200,
        message: ["EV Insurance Detail fetched successfully!"],
        data: data,
        base_url: `${req.protocol}://${req.get('host')}/uploads/insurance-images/`,
    });
};
