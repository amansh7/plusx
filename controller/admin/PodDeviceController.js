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
            columns          : 'pod_id, pod_name, device_id, design_model, capacity, inverter, charger, date_of_manufacturing, status, current, voltage',
            sortColumn       : 'created_at',
            sortOrder        : 'DESC',
            page_no,
            limit            : 10,
            liveSearchFields : ['pod_id', 'pod_name'],
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
        const { pod_id, } = req.body;

        const { isValid, errors } = validateFields(req.body, {
            pod_id: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const [chargerDetails] = await db.execute(`
            SELECT 
                pod_id, pod_name, device_id, design_model, capacity, inverter, charger, date_of_manufacturing, status, current, voltage, percentage, temp1, temp2, temp3
            FROM 
                pod_devices 
            WHERE 
                pod_id = ?`, 
            [pod_id]
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
        const { podId, podName, deviceId, device_model, capacity, charger, inverter, date_of_manufacturing, status = 1 } = req.body;
        // Validation
        const { isValid, errors } = validateFields({ 
            podId, podName, deviceId, device_model, capacity, charger, inverter, date_of_manufacturing
        }, {
            podId                 : ["required"],
            podName               : ["required"],
            deviceId              : ["required"],
            device_model          : ["required"],
            capacity              : ["required"],
            charger               : ["required"],
            inverter              : ["required"],
            date_of_manufacturing : ["required"]
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });
    
        const [[isExist]] = await db.execute(`
            SELECT 
                (SELECT COUNT(id) FROM pod_devices where device_id = ? ) AS check_device,
                (SELECT COUNT(id) FROM pod_devices where pod_id = ? ) AS check_pod
            FROM 
                users
            LIMIT 1
        `, [deviceId, podId]);

        const err = [];
        if( isExist.check_device ) err.push('Device Id is already registered.');
        if( isExist.check_pod ) err.push('POD Id is already registered.');
        if(err.length > 0) return resp.json({ status : 0, code : 422, message : err });

        let date_manufacturing    = date_of_manufacturing.split("-");
        const dateOfManufacturing = date_manufacturing[2] +'-'+ date_manufacturing[1] +'-'+date_manufacturing[0];
        
        const insert = await insertRecord('pod_devices', [
            'pod_id', 'pod_name', 'device_id', 'design_model', 'capacity', 'charger', 'inverter', 'date_of_manufacturing', 'status'
        ],[
            podId, podName, deviceId, device_model, capacity, charger, inverter, dateOfManufacturing, status
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
        const { podId, podName, deviceId, device_model, capacity, charger, inverter, date_of_manufacturing } = req.body;
       
        const { isValid, errors } = validateFields({ 
            podId, podName, deviceId, device_model, capacity, charger, inverter, date_of_manufacturing
        }, {
            podId                 : ["required"],
            podName               : ["required"],
            deviceId              : ["required"],
            device_model          : ["required"],
            capacity              : ["required"],
            charger               : ["required"],
            inverter              : ["required"],
            date_of_manufacturing : ["required"]
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });
        const [[isExist]] = await db.execute(`
            SELECT 
                (SELECT COUNT(id) FROM pod_devices where device_id = ? and pod_id != ? ) AS check_device,
                (SELECT COUNT(id) FROM pod_devices as pd1 where pd1.pod_id = ? and pd1.id != pd.id) AS check_pod
            FROM 
                pod_devices as pd
            WHERE 
                pd.pod_id = ? 
            LIMIT 1
        `, [deviceId, podId, podId, , podId]);

        const err = [];
        if( isExist.length == 0 ) return resp.json({ status : 0, code : 422, message : 'POD Id is not registered.'});
        if( isExist.check_device ) return resp.json({ status : 0, code : 422, message : 'Device Id is already registered.'});
        if( isExist.check_pod ) return resp.json({ status : 0, code : 422, message : 'POD Id is already registered.'});

        let date_manufacturing = date_of_manufacturing.split("-");
        const dateOfManufacturing = date_manufacturing[2] +'-'+ date_manufacturing[1] +'-'+date_manufacturing[0];

        const updates = { 
            device_id    : deviceId,
            pod_name     : podName,
            design_model : device_model,
            capacity,
            charger,
            inverter,
            date_of_manufacturing : dateOfManufacturing,
        };
        const update = await updateRecord('pod_devices', updates, ['pod_id'], [podId]);
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
            SELECT pod_id as value, pod_name as label FROM pod_devices WHERE status = 1` 
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
        const { podId, page_no, search_text = '' } = req.body;
        const { isValid, errors } = validateFields(req.body, {page_no: ["required"], podId: ["required"]});
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
            whereValue       : [podId]
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
            liveSearchFields : ['area_id', 'area_name'],
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
    
        const areaId = `Area-${generateUniqueId({ length:6 })}`;
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
export const podAreaDetails = async (req, resp) => {
    try {
        const { area_id, } = req.body;

        const { isValid, errors } = validateFields(req.body, {
            area_id: ["required"]
        });

        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
        
        const [areaDetails] = await db.execute(`
            SELECT 
                area_id, area_name, latitude, longitude, status 
            FROM 
                pod_area_list 
            WHERE 
                area_id = ?`, 
            [area_id]
        );
        // console.log(areaDetails[0])
        return resp.json({
            status  : 1,
            code    : 200,
            message : ["POD Area Details fetched successfully!"],
            data    : areaDetails[0],
        });
    } catch (error) {
        console.error('Error fetching device details:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching device details' });
    }
};
export const editPodArea = async (req, resp) => {
    try {
        const { areaId, areaName, latitude, longitude, status } = req.body;
       
        const { isValid, errors } = validateFields({ 
            areaId, areaName, latitude, longitude
        }, {
            areaId    : ["required"],
            areaName  : ["required"],
            latitude  : ["required"],
            longitude : ["required"]
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });
        const [[isExist]] = await db.execute(`
            SELECT 
                COUNT(id)
            FROM 
                pod_area_list 
            WHERE 
                area_id = ? 
            LIMIT 1
        `, [areaId]);

        if( isExist.length == 0 ) return resp.json({ status : 0, code : 422, message : 'Area Id is not valid.'});

        const updates = { 
            area_name : areaName,
            latitude  : latitude,
            longitude : longitude,
            status,
        };
        const update = await updateRecord('pod_area_list', updates, ['area_id'], [areaId]);
        return resp.json({
            status  : update.affectedRows > 0 ? 1 : 0,
            code    : 200,
            message : update.affectedRows > 0 ? ['POD Area updated successfully!'] : ['Oops! Something went wrong. Please try again.'],
        });

    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const AllpodArea = async (req, resp) => {
    try {
        
        const [allDevice] = await db.execute(`
            SELECT area_id, area_name, latitude, longitude FROM pod_area_list WHERE status = 1` 
        );
        return resp.json({
            status  : 1,
            code    : 200,
            message : ["All POD Area fetch successfully!"],
            data    : allDevice,
        });
    } catch (error) {
        console.error('Error fetching device list:', error);
        resp.status(500).json({ message: 'Error fetching device lists' });
    }
};

export const assignPodDeviceArea = async (req, resp) => {
    try {
        const { podId, selectedArea } = req.body;
        // Validation
        const { isValid, errors } = validateFields({ 
            podId, selectedArea
        }, {
            podId        : ["required"],
            selectedArea : ["required"]
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });
    
        const [[isExist]] = await db.execute(`
            SELECT 
                (SELECT COUNT(id) FROM pod_devices where pod_id = ? ) AS check_device,
                (SELECT COUNT(id) FROM pod_area_list where area_id = ? ) AS check_area
            FROM 
                users
            LIMIT 1
        `, [podId, selectedArea]);

        const err = [];
        if( isExist.check_device == 0 ) err.push('POD Id is not registered.');
        if( isExist.check_area == 0 ) err.push('Area Id is not registered.');
        if(err.length > 0) return resp.json({ status : 0, code : 422, message : err });

        
        const insert = await insertRecord('pod_assign_area', [
            'area_id', 'device_id'
        ],[
            selectedArea, podId
        ]);
        return resp.json({
            code    : 200,
            message : insert.affectedRows > 0 ? ['POD Area Assign successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status : insert.affectedRows > 0 ? 1 : 0
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};
export const podAreaAssignList = async (req, resp) => {
    try {
        const { podId, page_no, search_text = '' } = req.body;
        const { isValid, errors } = validateFields(req.body, {podId: ["required"], page_no: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName        : 'pod_assign_area as paa',
            columns          : 'paa.area_id, paa.created_at, (select area_name from pod_area_list as ar where ar.area_id = paa.area_id) as area_name',
            sortColumn       : 'paa.created_at',
            sortOrder        : 'DESC',
            page_no,
            limit            : 10,
            liveSearchFields : ['area_name' ],
            liveSearchTexts  : [search_text, search_text],
            whereField       : ['paa.device_id'],
            whereValue       : [podId]
        });

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["POD Assign Area List fetch successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching device list:', error);
        resp.status(500).json({ message: 'Error fetching device lists' });
    }
};