import db from "../../config/db.js";
import validateFields from "../../validation.js";
import { insertRecord, queryDB, getPaginatedData } from '../../dbUtils.js';
import { createNotification, mergeParam, pushNotification } from "../../utils.js";
import emailQueue from "../../emailQueue.js";

export const serviceRequest = async (req, resp) => {
    const {
        rider_id, name, email, country_code, contact_no, service_type, address, latitude, longitude, charger_for, no_of_charger, description,
        company_name='', resident_type='', vehicle_model='', region_specification=''
    } = req.body;

    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"], name: ["required"], email: ["required"], country_code: ["required"], contact_no: ["required"], service_type: ["required"], address: ["required"], 
        latitude: ["required"], longitude: ["required"], charger_for: ["required"], no_of_charger: ["required"], description: ["required"],
    });
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const rider = await queryDB(`SELECT fcm_token, (SELECT MAX(id) FROM charging_installation_service) AS last_index FROM riders WHERE rider_id = ? LIMIT 1`, [rider_id]);

    const start = (!rider.last_index) ? 0 : rider.last_index; 
    const nextId = start + 1;
    const requestId = 'CIS' + String(nextId).padStart(4, '0');

    const insert = await insertRecord('charging_installation_service', [
        'request_id', 'rider_id', 'name', 'email', 'country_code', 'contact_no', 'service_type', 'company_name', 'resident_type', 'address', 'latitude', 'longitude', 
        'charger_for', 'vehicle_model', 'no_of_charger', 'description', 'order_status', 'region_specification'
    ], [
        requestId, rider_id, name, email, country_code, contact_no, service_type, company_name, resident_type, address, latitude, longitude, 
        charger_for, vehicle_model, no_of_charger, description, '', region_specification
    ]);
    
    if(insert.affectedRows > 0){
        await insertRecord('charging_installation_service_history', ['service_id', 'rider_id', 'vehicle_model', 'order_status'], [requestId, rider_id, vehicle_model, 'P']);
        
        const href = 'charging_installation_service/' + requestId;
        const heading = 'Order Created!';
        const desc = `Your request for charging installation service at home order no. ${requestId} has been placed.`;
        createNotification(heading, desc, 'Charging Installation Service', 'Rider', 'Admin','', rider_id, href);
        pushNotification(rider.fcm_token, heading, desc, 'RDRFCM', href);

        const now = new Date();
        const formattedDateTime = now.toISOString().replace('T', ' ').substring(0, 19);
        const htmlUser = `<html>
            <body>
                <h4>Dear ${name},</h4>
                <p>Thank you for using the PlusX Electric App for Charging Installation service. We have successfully received your booking request. Below are the details of your roadside assistance booking:</p> <br/>
                <p>Booking Reference: ${requestId}</p>
                <p>Date & Time of Request: ${formattedDateTime}</p> 
                <p>Address: ${address}</p>                         
                <p>Service Type: ${service_type}</p> <br/>
                <p> Regards,<br/> PlusX Electric App </p>
            </body>
        </html>`;
        const htmlAdmin = `<html>
            <body>
                <h4>Dear Admin,</h4>
                <p>We have received a new booking for our Charging Installation service. Below are the details:</p> <br/>
                <p>Customer Name  : ${name}</p>
                <p>Address : ${address}</p>
                <p>Booking Time   : ${formattedDateTime}</p> <br/>                        
                <p> Best regards,<br/> PlusX Electric App </p>
            </body>
        </html>`;

        emailQueue.addEmail(email, 'Your Charging Installation Booking Confirmation - PlusX Electric App', htmlUser);
        emailQueue.addEmail('admin@plusxelectric.com', `Charging Installation Booking - ${requestId}`, htmlAdmin);

        return resp.json({
            status: 1, 
            code: 200, 
            message: ['Your request has been received. You will hear from us shortly.'],
            service_id: requestId,
            rsa_id: ''
        });       
    }else{
        return resp.json({status:0, code:200, message: ['Oops! There is something went wrong! Please Try Again']});
    }

};

export const requestList = async (req, resp) => {
    const {rider_id, page_no, sort_by } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const sortOrder = sort_by === 'd' ? 'DESC' : 'ASC';

    const result = await getPaginatedData({
        tableName: 'charging_installation_service',
        columns: 'request_id, name, email, country_code, contact_no, service_type, company_name, address, charger_for, vehicle_model, latitude, longitude, order_status, created_at',
        sortColumn: 'id',
        sortOrder,
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Charging Installation Service List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });

};

export const requestDetails = async (req, resp) => { 
    const {rider_id, request_id } = mergeParam(req);     
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], request_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [orderData] = await db.execute(`SELECT * FROM charging_installation_service WHERE request_id = ? LIMIT 1`, [request_id]);

    orderData[0].invoice_url = '';
    if (orderData[0].order_status == 'ES') {
        const invoice_id = orderData[0].request_id.replace('CS', 'INVCS');
        orderData[0].invoice_url = `${req.protocol}://${req.get('host')}/public/charger-installation-invoice/${invoice_id}-invoice.pdf`;
    }

    const [history] = await db.execute(`SELECT * FROM charging_installation_service_history WHERE service_id = ?`, [request_id]);

    return resp.json({
        message: ["Charging Installation Service fetched successfully!"],
        service_data: orderData[0],
        order_history: history,
        status: 1,
        code: 200,
    });
};