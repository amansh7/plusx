import db from "../../config/db.js";
import validateFields from "../../validation.js";
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import generateUniqueId from 'generate-unique-id';
import transporter from "../../mailer.js";
import moment from "moment";

export const vehicleList = async (req, resp) => {
    const {vehicle_type, page_no, vehicle_name, vehicle_model } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {vehicle_type: ["required"], page_no: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await getPaginatedData({
        tableName: 'vehicle',
        columns: 'vehicle_id, vehicle_name, vehicle_model, horse_power, price, image',
        searchFields: ['vehicle_name', 'vehicle_model'],
        searchTexts: [vehicle_name, vehicle_model],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
        whereField: 'vehicle_type',
        whereValue: vehicle_type
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Vehicle List fetched successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
        base_url: `${req.protocol}://${req.get('host')}/uploads/vehicle-images/`
    });
};

export const vehicleDetail = async (req, resp) => {
    const { vehicle_id } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {vehicle_id: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const vehicleData = await queryDB(`SELECT * FROM vehicle WHERE vehicle_id= ? LIMIT 1`, [1, vehicle_id]);
    const galleryData = await queryDB(`SELECT * FROM vehicle_gallery WHERE vehicle_id = ? ORDER BY id DESC LIMIT 5`, [vehicle_id]);
    const imgName = galleryData.map(row => row.image_name);
    
    return resp.json({
        status: 1,
        code: 200,
        message: ["Charging Station Details fetched successfully!"],
        data: vehicleData,
        gallery_data: imgName,
        base_url: `${req.protocol}://${req.get('host')}/uploads/vehicle-images/`,
    });

};

export const interestedPeople = async (req, resp) => {
    const {rider_id, name, country_code, mobile, address, vehicle, region_specification } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"],
        name: ["required"],
        country_code: ["required"],
        mobile: ["required"],
        address: ["required"],
        vehicle: ["required"],
        region_specification: ["required"],
    });
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const userId = 'PI-' + generateUniqueId({length:13});

    const insert = await insertRecord('interested_people', [
        'user_id', 'rider_id', 'name', 'country_code', 'mobile', 'address', 'vehicle', 'status', 'region_specification'
    ],[
        userId, rider_id, name, country_code, mobile, address, vehicle, 1, region_specification 
    ]);
    
    return resp.json({
        status: insert.affectedRows > 0 ? 1 : 0,
        code: 200,
        message: insert.affectedRows > 0 ? ["Charging Station Details fetched successfully!"] : ["Oops! Something went wrong. Please try again."]
    });
};

// multiple image upload pending
export const sellVehicle = async (req, resp) => {
    const { rider_id, vehicle_id, region, milage, price, interior_color, exterior_color, doors, body_type, owner_type, seat_capacity, engine_capacity, 
        warrenty, description, horse_power, car_images='', car_tyre_image='', other_images=''
    } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"],
        vehicle_id: ["required"],
        region: ["required"],
        milage: ["required"],
        price: ["required"],
        interior_color: ["required"],
        doors: ["required"],
        body_type: ["required"],
        owner_type: ["required"],
        seat_capacity: ["required"],
        engine_capacity: ["required"],
        warrenty: ["required"],
        description: ["required"],
        horse_power: ["required"],
        car_images: ["required"],
        car_tyre_image: ["required"],
    });
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    /* multiple image upload -  car_images | car_tyre_image | other_images */

    const sellId = 'SL-' + generateUniqueId({length:13});

    const insert = await insertRecord('vehicle_sell', [
        'sell_id', 'rider_id', 'vehicle_id', 'region', 'milage', 'price', 'interior_color', 'exterior_color', 'doors', 'body_type', 'owner_type', 'seat_capacity', 
        'engine_capacity', 'warrenty', 'horse_power', 'description', 'car_images', 'car_tyre_image', 'other_images', 'status'
    ], [
        sellId, rider_id, vehicle_id, region, milage, price, interior_color, exterior_color, doors, body_type, owner_type, seat_capacity, engine_capacity,
        warrenty, horse_power, description, car_images, car_tyre_image, other_images, 0
    ]);

    if(insert.affectedRows == 0) return resp.json({status: 0, code: 200, error: true, message: 'Oops! There is something went wrong! Please Try Again'});

    const rider = await queryDB(`SELECT rider_name, rider_email FROM riders WHERE rider_id = ?`, [rider_id]);

    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: rider.rider_email,
        subject: 'Your EV Car Sale Listing Is Now Live on PlusX Electric App!',
        html: `<html>
            <body>
                <h4>Dear ${rider.rider_name},</h4>
                <p>Greetings from the PlusX Electric App.</p><br />
                <p>We are pleased to inform you that your listing for the sale of your EV car on the PlusX Electric App is now live and available for potential buyers to view. </p>
                <p>Thank you for choosing the PlusX Electric App to list your EV for sale. We wish you the best of luck in finding the perfect buyer for your car!</p> <br /> <br /> 
                <p> Best regards,<br/> PlusX Electric App </p>
            </body>
        </html>`,
    });

    return resp.json({
        status: 1, 
        code: 200, 
        error: false,
        message: ["Your Car for Sale Successful Added!"],
    });    

};

export const allSellVehicleList = async (req, resp) => {
    const {rider_id, page_no, search_text, sort_col, sort_by } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], page_no: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await getPaginatedData({
        tableName: 'vehicle_sell AS vs LEFT JOIN riders_vehicles AS rv ON rv.vehicle_id = vs.vehicle_id',
        columns: 'sell_id, region, milage, price, interior_color, doors, body_type, seat_capacity, engine_capacity, car_images, rv.vehicle_model, rv.vehicle_make',
        searchFields: ['rv.vehicle_model', 'rv.vehicle_make'],
        searchTexts: [search_text, search_text],
        sortColumn: sort_col === 'p' ? 'vs.price' : 'vs.id',
        sortOrder: sort_by === 'd' ? 'DESC' : 'ASC',
        page_no,
        limit: 10,
        whereField: 'status',
        whereValue: 1,
        whereOperator: '!='
    });

    return resp.json({
        message: ["Car Sell list fetched successfully!"],
        data: result.data,
        total: result.total,
        total_page: result.totalPage,
        status: 1,
        code: 200,
        image_path: `${req.protocol}://${req.get('host')}/uploads/vehicle-image/`
    });

};

export const sellVehicleList = async (req, resp) => {
    const {rider_id, page_no, search_text, sort_col, sort_by } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], page_no: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await getPaginatedData({
        tableName: 'vehicle_sell AS vs LEFT JOIN riders_vehicles AS rv ON rv.vehicle_id = vs.vehicle_id',
        columns: 'sell_id, region, milage, price, interior_color, doors, body_type, seat_capacity, engine_capacity, car_images, rv.vehicle_model, rv.vehicle_make',
        searchFields: ['rv.vehicle_model', 'rv.vehicle_make'],
        searchTexts: [search_text, search_text],
        sortColumn: sort_col === 'p' ? 'vs.price' : 'vs.id',
        sortOrder: sort_by === 'd' ? 'DESC' : 'ASC',
        page_no,
        limit: 10,
        whereField: ['status', 'vs.rider_id'],
        whereValue: [1, rider_id],
        whereOperator: ['!=', '='],
    });

    return resp.json({
        message: ["Car Sell list fetched successfully!"],
        data: result.data,
        total: result.total,
        total_page: result.totalPage,
        status: 1,
        code: 200,
        image_path: `${req.protocol}://${req.get('host')}/uploads/vehicle-image/`
    });

};

export const sellVehicleDetail = async (req, resp) => {
    const { rider_id, sell_id } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], sell_id: ["required"]});
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const data = await queryDB(`
        SELECT 
            vehicle_sell.*, 
            (SELECT CONCAT(vehicle_make, "-", vehicle_model, ",", year_manufacture) FROM riders_vehicles AS rv WHERE rv.vehicle_id = vehicle_sell.vehicle_id) AS vehicle_data,
            r.profile_img, 
            r.rider_name, 
            CONCAT(r.country_code, "-", r.rider_mobile) AS rider_mobile, 
            r.fcm_token 
        FROM 
            vehicle_sell 
        LEFT JOIN 
            riders AS r 
        ON 
            r.rider_id = vehicle_sell.rider_id 
        WHERE 
            vehicle_sell.sell_id = ? 
        LIMIT 1
    `,[sell_id]);
    
    return resp.json({
        status: 1,
        code: 200,
        message: ["Charging Station Details fetched successfully!"],
        data: data,
        base_url: `${req.protocol}://${req.get('host')}/uploads/vehicle-images/`,
    });

};

// multiple image upload & old img deletion pending
export const updateSellVehicle = async (req, resp) => {
    const { sell_id, rider_id, vehicle_id, region, milage, price, interior_color, exterior_color, doors, body_type, owner_type, seat_capacity, engine_capacity, 
        warrenty, description, horse_power, car_images='', car_tyre_image='', other_images=''
    } = req.body;
        
    const { isValid, errors } = validateFields(req.body, {
        sell_id: ["required"],
        rider_id: ["required"],
        vehicle_id: ["required"],
        region: ["required"],
        milage: ["required"],
        price: ["required"],
        interior_color: ["required"],
        doors: ["required"],
        body_type: ["required"],
        owner_type: ["required"],
        seat_capacity: ["required"],
        engine_capacity: ["required"],
        warrenty: ["required"],
        description: ["required"],
        horse_power: ["required"],
    });
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const data = await queryDB(`SELECT car_images, car_tyre_image, other_images FROM vehicle_sell WHERE sell_id = ? AND rider_id = ?`, [sell_id, rider_id]);
    car_images = data.car_images; car_tyre_image = data.car_tyre_image; other_images = data.other_images;    
    
    /* multiple image upload (keep old img value) -  car_images | car_tyre_image | other_images */
    
    const updates = { vehicle_id, region, milage, price, interior_color, exterior_color, doors, body_type, owner_type, seat_capacity, engine_capacity, 
        warrenty, description, horse_power, car_images, car_tyre_image, other_images 
    };
    const update = updateRecord('vehicle_sell', updates, ['sell_id', 'rider_id'], [sell_id, rider_id]);

    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0,
        code: 200,
        error: update.affectedRows > 0 ? false: true,
        message: update.affectedRows > 0 ? ["Your Car for  Sale  Successful Updated!"] : ["Oops! Something went wrong. Please try again."]
    });
};

// image deletion pending
export const deleteSellVehicle = async (req, resp) => {
    const {rider_id, sell_id} = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], sell_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors }); 
    const connection = await db.getConnection();

    try{
        await connection.beginTransaction();

        const [del] = await db.execute(`DELETE FROM vehicle_sell WHERE rider_id=?, vehicle_id=?`,[rider_id, sell_id]);

        /* delete images */
        
        return resp.json({
            message: del.affectedRows > 0 ? 'Your Car for Sale deleted successfully!' : 'Oops! Something went wrong. Please try again.',
            status: del.affectedRows > 0 ? 1 : 0
        });

    }catch(err){
        await connection.rollback();
        console.error('Error deleting sell vehicle account:', err.message);
        return resp.json({status: 1, code: 200, error: true, message: ['Something went wrong. Please try again!']});
    }finally{
        connection.release();
    }

};

export const soldSellVehicle = async (req, resp) => {
    const {rider_id, sell_id} = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], sell_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors }); 

    const sellData = await queryDB('SELECT COUNT(*) as count FROM vehicle_sell WHERE sell_id = ? AND rider_id = ?', [sell_id, rider_id]); 

    if (sellData.count === 0) {
        return resp.json({status: 0, code: 422, error: true, message: ['Car for sale data invalid']});
    }

    const update = await updateRecord('vehicle_sell', {status: 1}, ['sell_id', 'rider_id'], [sell_id, rider_id]);
    
    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0,
        code: 200,
        error: update.affectedRows > 0 ? false : true,
        message: update.affectedRows > 0 ? ['Your Car for Sale Sold Successful!'] : ['Something went wrong, please try again!'],
    });
};

/* Dynamic Data */
export const areaList = async (req, resp) => {
    const { location_id, area_name } = req.body;

    let query = `SELECT id AS loc_id, location_id, area_name FROM locations_area_list WHERE location_id = ? AND status = ?`;
    const queryParams = [location_id, 1];

    if(area_name){
        query += ` AND area_name LIKE ?`;
        queryParams.push(`%${area_name}%`);
    }

    query += ` ORDER BY area_name ASC`;

    const result = await queryDB(query, queryParams);

    return resp.json({
        status: 1, 
        code: 200,
        message: ["Area List fetch successfully!"],
        area_data: result
    });
};

export const reminder_sell_vehicle_list = async (req, resp) => {
    const date = moment().subtract(15, 'days').format('YYYY-MM-DD');

    const [sellData] = await db.execute(`
        SELECT 
            sell_id, 
            (SELECT fcm_token FROM riders AS r WHERE r.rider_id = vehicle_sell.rider_id) AS fcm_token, 
            (SELECT CONCAT(vehicle_make, '-', vehicle_model) FROM riders_vehicles AS rv WHERE rv.vehicle_id = vehicle_sell.vehicle_id) AS vehicle_data
        FROM 
            vehicle_sell 
        WHERE 
            status != 1 AND DATE(created_at) = ?
    
    `, [date]);

    for (const val of sellData) {
        const title = `PlusX Electric App : ${val.vehicle_data}`;
        const msg = 'Has your car been sold?';
        const href = `sell_vehicle/${val.sell_id}`;
        
        // await pushNotification([val.fcm_token], title, msg, 'RDRFCM', href);
    }

    return resp.json({ status: 1, code: 200, message: "Notification Sent!" });
};

export const vehicleModelList = async (req, resp) => {
    const {vehicle_type, make_name} = req.body;
    const { isValid, errors } = validateFields(req.body, {vehicle_type: ["required"], make_name: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    let modelData = [];

    if(vehicle_type === 'Car'){
        const [rows] = await db.execute('SELECT model FROM vehicle_brand_list WHERE status = ? AND make = ?', [1, make_name]);
        modelData = rows.map(row => row.model);
    }else{
        const [rows] = await db.execute('SELECT model FROM vehicle_bike_brand_list WHERE status = ? AND make = ?', [1, make_name]);
        modelData = rows.map(row => row.model);
    }

    if (make_name !== 'Other') modelData.push('Other');

    return resp.json({
        message: ["Model List fetch successfully!"],
        area_data: modelData,
        status: 1,
        code: 200,
    });
};

export const vehicleBrandList = async (req, resp) => {
    const {vehicle_type} = req.body;
    const { isValid, errors } = validateFields(req.body, {vehicle_type: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    let modelData = [];

    if(vehicle_type === 'Car'){
        const [rows] = await db.execute('SELECT model FROM vehicle_brand_list WHERE status = ? GROUP BY make',[1]);
        modelData = rows.map(row => row.model);
    }else{
        const [rows] = await db.execute('SELECT model FROM vehicle_bike_brand_list WHERE status = ? GROUP BY make',[1]);
        modelData = rows.map(row => row.model);
    }

    return resp.json({
        message: ["Make List fetch successfully!"],
        area_data: modelData,
        status: 1,
        code: 200,
    });
};

