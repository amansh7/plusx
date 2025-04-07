
import moment from "moment";
import dotenv from 'dotenv';
import validateFields from "../../validation.js";
import { queryDB } from '../../dbUtils.js';
import db from "../../config/db.js";
import { asyncHandler, createNotification, mergeParam, pushNotification } from '../../utils.js';
dotenv.config();

/* RSA */
export const getRsaOrderStage = asyncHandler(async (req, resp) => {
    const {rsa_id, order_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rsa_id: ["required"], order_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const orderStatus = ['A','ER','AR','WC','ES'];
        const orderData = ['assigned_data', 'enroute_data', 'arrived_data', 'work_complete_data', 'end_summary_data'];

        const [stData] = await db.execute(`SELECT order_status, cancel_reason AS reason FROM order_history WHERE order_id = ? AND rsa_id = ? AND order_status != 'RA'`, [order_id, rsa_id]);
        if(stData.length === 0) return resp.json({status:0, code:200, message: "Sorry no data found with given order id: " + order_id});

        const [stTime] = await db.execute(`SELECT created_at FROM order_history WHERE order_id = ? AND rsa_id = ? ORDER BY id DESC LIMIT 1`,[order_id, rsa_id]);
        const stDatas = stData.map(item => item.order_status);
        const [order] = await db.execute(`SELECT order_status, created_at FROM road_assistance WHERE request_id = ?`, [order_id]);
        const stReason = stData.map(item => item.reason).filter(Boolean);

        const orderTracking = [];

        for (const value of orderStatus) {
            const [data] = await db.execute(`SELECT remarks, order_status, image FROM order_history WHERE order_id = ? AND rsa_id = ? AND order_status = ?`, 
                [order_id, rsa_id, value]
            );

            if (data.length > 0) {
                const record = data[0];
                if ((value === 'AR' || value === 'WC') && record.image) {
                    const images = record.image.split(',').map(image => {
                        return `${req.protocol}://${req.get('host')}/uploads/order_file/${image.trim()}`;
                    });
                    record.image = images;
                } else {
                    record.image = null;
                }

                orderTracking.push({ [orderData[orderStatus.indexOf(value)]]: record });
            } else {
                orderTracking.push({ [orderData[orderStatus.indexOf(value)]]: { remarks: null, image: null } });
            }
        }

        let executionTime = null; let humanReadableTime = null;
        if (stTime.length > 0 && order.length > 0) {
            executionTime = moment(stTime[0].created_at).diff(moment(order[0].created_at), 'seconds');
            humanReadableTime = moment.duration(executionTime, 'seconds').humanize();
        } else {
            humanReadableTime = 'Execution time not available';
        }

        return resp.json({
            message: ["Request stage fetch successfully."],
            data: orderTracking,
            order_status: order[0].order_status,
            order_status_list: stDatas,
            execution_time: executionTime,
            reason: stReason.length > 0 ? stReason[0] : '',
            status: 1,
            code: 200
        });
    }catch(err){
        return resp.json({message: ['An error occurred while processing your request.'], status: 0, code: 500});  
    }
});

export const orderAction = asyncHandler(async (req, resp) => {
    const {order_status, order_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {order_status: ["required"], order_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    switch (order_status) {
        case 'A': return await acceptOrder(req, resp);
        case 'AR': return await arrivedOrder(req, resp);
        case 'WC': return await workComplete(req, resp);
        case 'ES': return await esOrder(req, resp);
        default: return resp.json({status: 0, code: 200, message: ['Invalid booking status.']});
    }
});

// rsa booking/order action helper
const acceptOrder = async (req, resp) => {
    const { order_id, rsa_id, latitude, longitude } = req.body;
    const { isValid, errors } = validateFields(req.body, {rsa_id: ["required"], order_id: ["required"], latitude: ["required"], longitude: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token
        FROM 
            order_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[order_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no order found with this order id ${order_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        `SELECT COUNT(*) as count FROM order_history WHERE rsa_id = ? AND order_status = "RA" AND order_id = ?`,[rsa_id, order_id]
    );

    if (ordHistoryCount.count === 0) {
        await updateRecord('road_assistance', {order_status: 'RA', rsa_id}, 'request_id', order_id);

        const href = `road_assistance/${order_id}`;
        const title = 'Request Accepted';
        const message = `RSA Team has accepted your booking with booking id : ${order_id} and he is enroute now`;
        await createNotification(title, message, 'Roadside Assistance', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        const insert = await db.execute(
            `INSERT INTO order_history (order_id, rider_id, order_status, rsa_id, latitude, longitude) VALUES (?, ?, "RA", ?, ?, ?)`,
            [order_id, checkOrder.rider_id, rsa_id, latitude, longitude]
        );

        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await db.execute('UPDATE rsa SET running_order = 1 WHERE rsa_id = ?', [rsa_id]);
        await db.execute('UPDATE order_assign SET status = 1 WHERE order_id = ? AND rsa_id = ?', [order_id, rsa_id]);

        return resp.json({ message: ['Request accepted successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};

const arrivedOrder = async (req, resp) => {
    const { order_id, rsa_id, lat, long, remarks } = req.body;
    const { isValid, errors } = validateFields(req.body, {rsa_id: ["required"], order_id: ["required"], lat: ["required"], long: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token
        FROM 
            order_assign
        WHERE 
            order_id = ? AND rsa_id = ?
        LIMIT 1
    `,[order_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no order found with this order id ${order_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        `SELECT COUNT(*) as count FROM order_history WHERE rsa_id = ? AND order_status = "AR" AND order_id = ?`,[rsa_id, order_id]
    );

    if (ordHistoryCount.count === 0) {
        /* upload file */
        const image = (uploadedFiles != null) ? uploadedFiles.join(',') : '';
        const insert = await db.execute(
            `INSERT INTO order_history (order_id, rider_id, order_status, rsa_id, remarks, latitude, longitude, image) VALUES (?, ?, "AR", ?, ?, ?, ?, ?)`,
            [order_id, checkOrder.rider_id, rsa_id, remarks, lat, long, image]
        );

        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('road_assistance', {order_status: 'AR', rsa_id}, 'request_id', order_id);

        const href = `road_assistance/${order_id}`;
        const title = 'RSA Team Accepted';
        const message = `RSA Team is arrived at your location`;
        await createNotification(title, message, 'Roadside Assistance', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Arrived successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};

const workComplete = async (req, resp) => {
    const { order_id, rsa_id, remarks } = req.body;
    const { isValid, errors } = validateFields(req.body, {order_id: ["required"], rsa_id: ["required"], remarks: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token
        FROM 
            charging_service_assign
        WHERE 
            order_id = ? AND rsa_id = ?
        LIMIT 1
    `,[rsa_id, order_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no order found with this order id ${order_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        'SELECT COUNT(*) as count FROM order_history WHERE rsa_id = ? AND order_status = "WC" AND service_id = ?',[rsa_id, order_id]
    );

    if (ordHistoryCount.count === 0) {
        /* handle file upload */
        const insert = await db.execute(
            'INSERT INTO order_history (order_id, rider_id, order_status, remarks, rsa_id, image) VALUES (?, ?, "WC", ?, ?, ?)',
            [order_id, checkOrder.rider_id, remarks, rsa_id, '']
        );

        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('road_assistance', {order_status: 'WC', rsa_id}, 'request_id', order_id);

        const href = `road_assistance/${order_id}`;
        const title = 'Work Completed';
        const message = `RSA Team has successfully completed the work which was required to do with your order id: ${order_id}`;
        await createNotification(title, message, 'Roadside Assistance', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, title, message, 'RDRFCM', href);

        return resp.json({ message: ['Work completed! successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};

const esOrder = async (req, resp) => {
    const { order_id, rsa_id } = req.body;
    const { isValid, errors } = validateFields(req.body, {rsa_id: ["required"], order_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const checkOrder = await queryDB(`
        SELECT rider_id, 
            (SELECT fcm_token FROM riders WHERE rider_id = charging_service_assign.rider_id) AS fcm_token
        FROM 
            order_assign
        WHERE 
            order_id = ? AND rsa_id = ? AND status = 0
        LIMIT 1
    `,[order_id, rsa_id]);

    if (!checkOrder) {
        return resp.json({ message: [`Sorry no order found with this order id ${order_id}`], status: 0, code: 404 });
    }

    const ordHistoryCount = await queryDB(
        `SELECT COUNT(*) as count FROM order_history WHERE rsa_id = ? AND order_status = "ES" AND order_id = ?`,[rsa_id, order_id]
    );

    if (ordHistoryCount.count === 0) {
        const insert = await db.execute(
            `INSERT INTO order_history (order_id, rider_id, order_status, rsa_id) VALUES (?, ?, "ES", ?)`,
            [order_id, checkOrder.rider_id, rsa_ide]
        );

        if(insert.affectedRows == 0) return resp.json({ message: ['Oops! Something went wrong! Please Try Again'], status: 0, code: 200 });

        await updateRecord('road_assistance', {order_status: 'ES', rsa_id}, 'request_id', order_id);
        await db.execute('DELETE FROM order_assign WHERE order_id = ? AND rsa_id = ?', [order_id, rsa_id]);
        await db.execute('UPDATE rsa SET running_order = 0 WHERE rsa_id = ?', [rsa_id]);

        const href = `road_assistance/${order_id}`;
        const title = 'Request Completed';
        const message = `RSA Team has successfully finished/completed your order with order id : ${order_id}`;
        await createNotification(title, message, 'Roadside Assistance', 'Rider', 'RSA', rsa_id, checkOrder.rider_id, href);
        await pushNotification(checkOrder.fcm_token, 'Order Completed', message, 'RDRFCM', href);

        return resp.json({ message: ['Order completed successfully!'], status: 1, code: 200 });
    } else {
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200 });
    }
};