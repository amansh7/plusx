import db from "../../config/db.js";
import validateFields from "../../validation.js";
import { insertRecord, queryDB, getPaginatedData } from '../../dbUtils.js';
import transporter from "../../mailer.js";

export const addRoadAssistance = async (req, resp) => {
    const {
        rider_id, name, country_code, contact_no, types_of_issue, pickup_address, drop_address, price, pickup_latitude, pickup_longitude, drop_latitude, drop_longitude, order_status=''
    } = req.body;

    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"], name: ["required"], country_code: ["required"], contact_no: ["required"], types_of_issue: ["required"], pickup_address: ["required"], 
        drop_address: ["required"], price: ["required"], pickup_latitude: ["required"], pickup_longitude: ["required"], drop_latitude: ["required"], drop_longitude: ["required"]
    });
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const rider = await queryDB(`SELECT fcm_token, rider_name, rider_email, (SELECT MAX(id) FROM road_assistance) AS last_index FROM riders WHERE rider_id = ? LIMIT 1`, [rider_id]);

    const start = (!rider.last_index) ? 0 : rider.last_index; 
    const nextId = start + 1;
    const requestId = 'RAO' + String(nextId).padStart(4, '0');

    const insert = await insertRecord('road_assistance', [
        'request_id', 'rider_id', 'name', 'country_code', 'contact_no', 'types_of_issue', 'pickup_address', 'drop_address', 'price', 'order_status', 'pickup_latitude', 'pickup_longitude', 'drop_latitude', 'drop_longitude'
    ], [
        requestId, rider_id, name, country_code, contact_no, types_of_issue, pickup_address, drop_address, price, order_status, pickup_latitude, pickup_longitude, drop_latitude, drop_longitude
    ]);

    if(insert.affectedRows > 0){
        insertRecord('order_history', ['order_id', 'order_status', 'rider_id'], [requestId, 'BD', rider_id]);
        
        const href = 'road_assistance/' + requestId;
        const heading = 'Roadside Assistance Created';
        const desc = `One Roadside Assistance request has been placed by you with request id: ${requestId} It is also requested that you must reach on the location.`;

        // createNotification(heading, desc, 'Roadside Assistance', 'Rider', 'Admin','', rider_id, href);
        // pushNotification(rider.fcm_token, heading, desc, 'RDRFCM', href);

        const now = new Date();
        const formattedDateTime = now.toISOString().replace('T', ' ').substring(0, 19);

        await transporter.sendMail({
            from: `"Easylease Admin" <admin@easylease.com>`,
            to: rider.rider_email,
            subject: 'Your Roadside Assistance Booking Confirmation - PlusX Electric App',
            html: `<html>
                <body>
                    <h4>Dear ${rider.rider_name},</h4>
                    <p>Thank you for using the PlusX Electric App for your roadside assistance needs. We have successfully received your booking request. Below are the details of your roadside assistance booking:</p> 
                    <p>Booking Reference: ${requestId}</p>
                    <p>Date & Time of Request: ${formattedDateTime}</p> 
                    <p>Location: ${pickup_address}</p>                         
                    <p>Type of Assistance Required: ${types_of_issue}</p> 
                
                    <p> Regards,<br/> PlusX Electric App </p>
                </body>
            </html>`,
        });

        await transporter.sendMail({
            from: `"Easylease Admin" <admin@easylease.com>`,
            to: 'admin@plusxelectric.com',
            subject: 'Your Roadside Assistance Booking Confirmation - PlusX Electric App',
            html: `<html>
                <body>
                    <h4>Dear Admin,</h4>
                    <p>We have received a new booking for our Road Side Assistance. Below are the details:</p> 
                    <p>Customer Name  : ${rider.rider_name}</p>
                    <p>Pickup Address : ${pickup_address}</p>
                    <p>Drop Address   : ${drop_address}</p> 
                    <p>Booking Time   : ${formattedDateTime}</p>                         
                    <p> Best regards,<br/> PlusX Electric App </p>
                </body>
            </html>`,
        });

        return resp.json({
            status: 1, 
            code: 200, 
            message: ['You have successfully placed roadside assistance request. You will be notified soon'],
            request_id: requestId,
            rsa_id: ''
        });       
    }else{
        return resp.json({status:0, code:200, message: ['Oops! There is something went wrong! Please Try Again.']});
    }

};

export const roadAssistanceList = async (req, resp) => {
    const {rider_id, page_no, sort_by } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], page_no: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const sortOrder = sort_by === 'd' ? 'DESC' : 'ASC';

    const result = await getPaginatedData({
        tableName: 'road_assistance',
        columns: 'request_id, name, country_code, contact_no, types_of_issue, pickup_address, drop_address, price, order_status, created_at',
        sortColumn: 'id',
        sortOrder,
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Road Assistance List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });

};

export const roadAssistanceDetail = async (req, resp) => {
    const {rider_id, order_id } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], order_id: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [roadAssistance] = await db.execute(`SELECT request_id, name, country_code, contact_no, types_of_issue, pickup_address, drop_address, price, order_status, created_at
        FROM road_assistance WHERE rider_id = ? AND request_id = ? LIMIT 1
    `, [rider_id, order_id]);

    const [history] = await db.execute(`SELECT order_status, cancel_by, cancel_reason as reason, rsa_id, created_at, (select rsa.rsa_name from rsa where rsa.rsa_id = order_history.rsa_id) as rsa_name
        FROM order_history 
        WHERE order_id = ?
        ORDER BY id DESC
    `,[order_id]);

    roadAssistance.invoice_url = '';
    if (roadAssistance[0].order_status == 'VD') {
        const invoice_id = roadAssistance[0].request_id.replace('RAO', 'INVR');
        roadAssistance[0].invoice_url = `${req.protocol}://${req.get('host')}/uploads/road-side-invoice/${invoice_id}-invoice.pdf`;
    }

    return resp.json({
        message: ["Road Assistance Details fetched successfully!"],
        order_data: roadAssistance,
        order_history: history,
        status: 1,
        code: 200,
    });
};