import db from '../../config/db.js';
import dotenv from 'dotenv';
import moment from 'moment';

// import { mergeParam, formatDateInQuery, createNotification, pushNotification} from '../../utils.js';
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
import generateUniqueId from 'generate-unique-id';
dotenv.config();

// POD Device Start
export const podDeviceList = async (req, resp) => {
    try {
        const {page_no, search_text = '' } = req.body;
        const { isValid, errors } = validateFields(req.body, {page_no: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName        : 'pod_devices',
            columns          : 'device_id, design_model, capacity, inverter, charger, date_of_manufacturing, status, current, voltage',
            sortColumn       : 'created_at',
            sortOrder        : 'DESC',
            page_no,
            limit            : 10,
            liveSearchFields : ['device_id', 'design_model'],
            liveSearchTexts  : [search_text, search_text],
            whereField       : 'status',
            whereValue       : 1
        });

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["POD Device List fetch successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching device list:', error);
        resp.status(500).json({ message: 'Error fetching device lists' });
    }
};

export const podDeviceDetails = async (req, resp) => {
    try {
        const { device_id, } = req.body;

        const { isValid, errors } = validateFields(req.body, {
            device_id: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const [chargerDetails] = await db.execute(`
            SELECT 
                device_id, design_model, capacity, inverter, charger, date_of_manufacturing, status, current, voltage, percentage
            FROM 
                pod_devices 
            WHERE 
                device_id = ?`, 
            [device_id]
        );

        return resp.json({
            status  : 1,
            code    : 200,
            message : ["POD Device Details fetched successfully!"],
            data    : chargerDetails[0],
        });
    } catch (error) {
        console.error('Error fetching device details:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching device details' });
    }
};

export const addPodDevice = async (req, resp) => {
    try {
        const { deviceId, device_model, capacity, charger, inverter, date_of_manufacturing, status = 1 } = req.body;
        // Validation
        const { isValid, errors } = validateFields({ 
            deviceId, device_model, capacity, charger, inverter, date_of_manufacturing
        }, {
            deviceId              : ["required"],
            device_model          : ["required"],
            capacity              : ["required"],
            charger               : ["required"],
            inverter              : ["required"],
            date_of_manufacturing : ["required"]
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });
    
        const [[isExist]] = await db.execute(`
            SELECT COUNT(id) as check_device FROM pod_devices where device_id = ? `, [deviceId]);
        const err = [];
        if( isExist.check_device ) err.push('Device Id is already registered.');
        if(err.length > 0) return resp.json({ status : 0, code : 422, message : err });

        let date_manufacturing = date_of_manufacturing.split("-");
        const dateOfManufacturing = date_manufacturing[2] +'-'+ date_manufacturing[1] +'-'+date_manufacturing[0];
        
        const insert = await insertRecord('pod_devices', [
            'device_id', 'design_model', 'capacity', 'charger', 'inverter', 'date_of_manufacturing', 'status'
        ],[
            deviceId, device_model, capacity, charger, inverter, dateOfManufacturing, status
        ]);
        return resp.json({
            code    : 200,
            message : insert.affectedRows > 0 ? ['POD Device added successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status : insert.affectedRows > 0 ? 1 : 0
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const editPodDevice = async (req, resp) => {
    try {
        const { deviceId, device_model, capacity, charger, inverter, date_of_manufacturing } = req.body;
        const { isValid, errors } = validateFields(req.body, {
            deviceId              : ["required"],
            device_model          : ["required"],
            capacity              : ["required"],
            charger               : ["required"],
            inverter              : ["required"],
            date_of_manufacturing : ["required"]
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });

        let date_manufacturing = date_of_manufacturing.split("-");
        const dateOfManufacturing = date_manufacturing[2] +'-'+ date_manufacturing[1] +'-'+date_manufacturing[0];
        const updates = {
            design_model : device_model,
            capacity,
            charger,
            inverter,
            date_of_manufacturing : dateOfManufacturing,
        };
        
        const update = await updateRecord('pod_devices', updates, ['device_id'], [deviceId]);

        return resp.json({
            status  : update.affectedRows > 0 ? 1 : 0,
            code    : 200,
            message : update.affectedRows > 0 ? ['POD Device updated successfully!'] : ['Oops! Something went wrong. Please try again.'],
        });

    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const deletePodDevice = async (req, resp) => {
    try {
        const { deviceId }        = req.body; 
        const { isValid, errors } = validateFields(req.body, {
            deviceId : ["required"]
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const [del] = await db.execute(`DELETE FROM pod_devices WHERE device_id = ?`, [deviceId]);
        return resp.json({
            code    : 200,
            message : del.affectedRows > 0 ? ['POD Device deleted successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status: del.affectedRows > 0 ? 1 : 0
        });
    } catch (err) {
        console.error('Error deleting portable charger', err);
        return resp.json({ status: 0, message: 'Error deleting portable charger' });
    }
};

export const AllpodDevice = async (req, resp) => {
    try {
        
        const [allDevice] = await db.execute(`
            SELECT device_id as value, design_model as label FROM pod_devices WHERE status = 1` 
        );
        return resp.json({
            status  : 1,
            code    : 200,
            message : ["All POD Device fetch successfully!"],
            data    : allDevice,
        });
    } catch (error) {
        console.error('Error fetching device list:', error);
        resp.status(500).json({ message: 'Error fetching device lists' });
    }
};
// POD Device End

// Brand Start
export const addPodBrand = async (req, resp) => {
    try {
        const { brand_name, device_id, description, start_date, end_date } = req.body;
        const brand_image = req.files && req.files['brand_image'] ? req.files['brand_image'][0].filename : null;

        // Validation
        const { isValid, errors } = validateFields({ 
            brand_name, device_id, description, start_date, end_date, brand_image
        }, {
            brand_name  : ["required"],
            device_id   : ["required"],
            description : ["required"],
            brand_image : ["required"], 
            start_date  : ["required"],
            end_date    : ["required"]
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
        let startt_date = start_date.split("-");
        const startDate = startt_date[2] +'-'+ startt_date[1] +'-'+startt_date[0];

        let endd_date = end_date.split("-");
        const endDate = endd_date[2] +'-'+ endd_date[1] +'-'+endd_date[0];

        const insert = await insertRecord('pod_brand_history', [
            'device_id', 'brand_name', 'description', 'start_date', 'end_date', 'brand_image'
        ],[
            device_id, brand_name, description, startDate, endDate, brand_image
        ]);
        return resp.json({
            code    : 200,
            message : insert.affectedRows > 0 ? ['POD Brand added successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status : insert.affectedRows > 0 ? 1 : 0
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const podBrandList = async (req, resp) => {
    try {
        const { page_no, search_text = '' } = req.body;
        const { isValid, errors } = validateFields(req.body, {page_no: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName        : 'pod_brand_history',
            columns          : 'device_id, brand_name, start_date, end_date, brand_image',
            sortColumn       : 'created_at',
            sortOrder        : 'DESC',
            page_no,
            limit            : 10,
            liveSearchFields : ['device_id', 'brand_name'],
            liveSearchTexts  : [search_text, search_text],
            whereField       : 'status',
            whereValue       : 1
        });

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["POD Brand List fetch successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
            base_url   : `${req.protocol}://${req.get('host')}/uploads/pod-brand-images/`,
        });
    } catch (error) {
        console.error('Error fetching device list:', error);
        resp.status(500).json({ message: 'Error fetching device lists' });
    }
};
export const deviceBrandList = async (req, resp) => {
    try {
        const { deviceId, page_no, search_text = '' } = req.body;
        const { isValid, errors } = validateFields(req.body, {page_no: ["required"], deviceId: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName        : 'pod_brand_history',
            columns          : 'brand_name, start_date, end_date, brand_image, description',
            sortColumn       : 'created_at',
            sortOrder        : 'DESC',
            page_no,
            limit            : 10,
            liveSearchFields : ['device_id', 'brand_name'],
            liveSearchTexts  : [search_text, search_text],
            whereField       : ['device_id'],
            whereValue       : [deviceId]
        });

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["POD Brand List fetch successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
            base_url   : `${req.protocol}://${req.get('host')}/uploads/pod-brand-images/`,
        });
    } catch (error) {
        console.error('Error fetching device brand list:', error);
        resp.status(500).json({ message: 'Error fetching device brand lists' });
    }
};
// Brand End

// POD Area Start
export const podAreaList = async (req, resp) => {
    try {
        const {page_no, search_text = '' } = req.body;
        const { isValid, errors } = validateFields(req.body, {page_no: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName        : 'pod_area_list',
            columns          : 'area_id, area_name, created_at, status',
            sortColumn       : 'created_at',
            sortOrder        : 'DESC',
            page_no,
            limit            : 10,
            liveSearchFields : ['device_id', 'design_model'],
            liveSearchTexts  : [search_text, search_text],
            whereField       : 'status',
            whereValue       : 1
        });

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["POD Area List fetch successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching device list:', error);
        resp.status(500).json({ message: 'Error fetching device lists' });
    }
};
export const addPodArea = async (req, resp) => {
    try {
        const { areaName, latitude, longitude, status = 1 } = req.body;
        
        // Validation
        const { isValid, errors } = validateFields({ 
            areaName, latitude, longitude
        }, {
            areaName  : ["required"],
            latitude  : ["required"],
            longitude : ["required"]
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });
    
        const areaId = `Area${generateUniqueId({ length:6 })}`;
        const insert = await insertRecord('pod_area_list', [
            'area_id', 'area_name', 'latitude', 'longitude', 'status'
        ],[
            areaId, areaName, latitude, longitude, status
        ]);
        return resp.json({
            code    : 200,
            message : insert.affectedRows > 0 ? ['Area added successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status : insert.affectedRows > 0 ? 1 : 0
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};