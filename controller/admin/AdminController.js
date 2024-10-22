import db from '../../config/db.js';
import dotenv from 'dotenv';
import { mergeParam, getOpenAndCloseTimings} from '../../utils.js';
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
dotenv.config();


export const getDashboardData = async (req, resp) => {
    try {
        const [counts] = await db.execute(`
            SELECT 
                (SELECT COUNT(*) FROM riders WHERE DATE(created_at) = CURDATE()) AS total_rider,
                (SELECT COUNT(*) FROM rsa) AS total_rsa,
                (SELECT COUNT(*) FROM portable_charger_booking WHERE DATE(created_at) = CURDATE()) AS total_charger_booking,
                (SELECT COUNT(*) FROM charging_service WHERE DATE(created_at) = CURDATE()) AS total_charging_service,
                (SELECT COUNT(*) FROM road_assistance WHERE DATE(created_at) = CURDATE()) AS total_road_assistance,
                (SELECT COUNT(*) FROM charging_installation_service WHERE DATE(created_at) = CURDATE()) AS total_installation,
                (SELECT COUNT(*) FROM ev_pre_sale_testing WHERE DATE(created_at) = CURDATE()) AS total_pre_sale_testing,
                (SELECT COUNT(*) FROM vehicle_sell WHERE DATE(created_at) = CURDATE()) AS total_vehicle_sell,
                (SELECT COUNT(*) FROM public_charging_station_list) AS total_station,
                (SELECT COUNT(*) FROM electric_bike_rental) AS total_bike_rental,
                (SELECT COUNT(*) FROM electric_car_rental) AS total_car_rental,
                (SELECT COUNT(*) FROM clubs) AS total_clubs,
                (SELECT COUNT(*) FROM vehicle) AS total_vehicle,
                (SELECT COUNT(*) FROM discussion_board) AS total_disscussion,
                (SELECT COUNT(*) FROM ev_insurance) AS total_insurance,
                (SELECT COUNT(*) FROM service_shops) AS total_service_shops,
                (SELECT COUNT(*) FROM offer WHERE offer_exp_date >= CURDATE()) AS total_offer,
                (SELECT COUNT(*) FROM interested_people) AS total_pod
        `);

        const count_arr = [ 
            { module: 'App Sign Up', count: counts[0].total_rider },
            { module: 'POD Bookings', count: counts[0].total_charger_booking },
            { module: 'Pickup & Dropoff Bookings', count: counts[0].total_charging_service },
            { module: 'Charger Installation Bookings', count: counts[0].total_installation },
            { module: 'EV Road Assistance', count: counts[0].total_road_assistance },
            { module: 'Pre-Sale Testing Bookings', count: counts[0].total_pre_sale_testing },
            { module: 'EV Buy & Sell', count: counts[0].total_vehicle_sell },
            { module: 'No. of Regs. Drivers', count: counts[0].total_rsa },
            { module: 'Total Public Chargers', count: counts[0].total_station }, 
            { module: 'Total Electric Bikes Leasing', count: counts[0].total_bike_rental }, 
            { module: 'Total Electric Cars Leasing', count: counts[0].total_car_rental },
            { module: 'Total EV Guide', count: counts[0].total_vehicle }, 
            { module: 'Total EV Rider Clubs', count: counts[0].total_clubs },
            { module: 'Total EV Discussion Board', count: counts[0].total_disscussion },
            { module: 'Total EV Insurance', count: counts[0].total_insurance }, 
            { module: 'Total EV Specialized Shop', count: counts[0].total_service_shops },
            { module: 'Total Active Offer', count: counts[0].total_offer },  
            { module: 'Total Register your Interest', count: counts[0].total_pod }
        ];

        resp.status(200).json(count_arr);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        resp.status(500).json({ message: 'Error fetching dashboard data' });
    }
};

export const riderList = async (req, resp) => {
    let { pageNo, sortBy, riderName, riderEmail, riderMobile, addedFrom } = req.body;

    pageNo = parseInt(pageNo, 10);
    if (isNaN(pageNo) || pageNo < 1) {
        pageNo = 1;
    }

    const sortOrder = sortBy === 'd' ? 'DESC' : 'ASC';

    try {
        const result = await getPaginatedData({
            tableName: 'riders',
            columns: 'rider_id, rider_name, rider_email, country_code, rider_mobile, emirates, profile_img, vehicle_type, status, created_at, updated_at',
            sortColumn: 'created_at', 
            sortOrder,
            page_no : pageNo,
            limit: 10,
            searchFields: ['rider_name', 'rider_email', 'rider_mobile', 'added_from'],
            searchTexts: [riderName, riderEmail, riderMobile, addedFrom],
        });

        return resp.json({
            status: 1,
            code: 200,
            message: ["Rider list fetched successfully!"],
            data: result.data,
            total_page: result.totalPage,
            total: result.total,
        });
    } catch (error) {
        console.error('Error fetching rider list:', error);
        return resp.status(500).json({
            status: 0,
            code: 500,
            message: 'Error fetching rider list',
        });
    }
};

export const riderDetails = async (req, resp) => {
    const { riderId } = req.body; 

    if (!riderId) {
        return resp.status(400).json({
            status: 0,
            code: 400,
            message: 'Rider ID is required'
        });
    }

    try {
        const [rows] = await db.execute(
            `SELECT r.*, 
                    ra.*, 
                    rv.*
             FROM riders r
             LEFT JOIN rider_address ra ON r.rider_id = ra.rider_id
             LEFT JOIN riders_vehicles rv ON r.rider_id = rv.rider_id
             WHERE r.rider_id = ?`, 
            [riderId]
        );

        if (rows.length === 0) {
            return resp.status(404).json({
                status: 0,
                code: 404,
                message: 'Rider not found'
            });
        }

        return resp.json({
            status: 1,
            code: 200,
            data: rows 
        });
    } catch (error) {
        console.error('Error fetching rider details:', error);
        return resp.status(500).json({
            status: 0,
            code: 500,
            message: 'Error fetching rider details',
        });
    }
};

export const deleteRider = async (req, resp) => {
    const riderId = req.body 
    if (!riderId) return resp.json({ status: 0, code: 422, message: "Rider ID is required" });

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        
        // Fetch the rider's profile image
        // const [rider] = await connection.execute('SELECT profile_img FROM riders WHERE rider_id = ?', [riderId]);
        // if (rider.length === 0) return resp.json({ status: 0, message: 'Rider not found.' });

        // const oldImagePath = path.join('uploads', 'rider_profile', rider[0].profile_img || '');
        
        // // Delete the rider's old profile image
        // fs.unlink(oldImagePath, (err) => {
        //     if (err) {
        //         console.error(`Failed to delete rider old image: ${oldImagePath}`, err);
        //     }
        // });

        // Array of delete queries
        const deleteQueries = [
            'DELETE FROM notifications                         WHERE receive_id = ?',
            'DELETE FROM road_assistance                       WHERE rider_id   = ?',
            'DELETE FROM order_assign                          WHERE rider_id   = ?',
            'DELETE FROM order_history                         WHERE rider_id   = ?',
            'DELETE FROM charging_installation_service         WHERE rider_id   = ?',
            'DELETE FROM charging_installation_service_history WHERE rider_id   = ?',
            'DELETE FROM charging_service                      WHERE rider_id   = ?',
            'DELETE FROM charging_service_history              WHERE rider_id   = ?',
            'DELETE FROM portable_charger_booking              WHERE rider_id   = ?',
            'DELETE FROM portable_charger_history              WHERE rider_id   = ?',
            'DELETE FROM discussion_board                      WHERE rider_id   = ?',
            'DELETE FROM board_comment                         WHERE rider_id   = ?',
            'DELETE FROM board_comment_reply                   WHERE rider_id   = ?',
            'DELETE FROM board_likes                           WHERE rider_id   = ?',
            'DELETE FROM board_poll                            WHERE rider_id   = ?',
            'DELETE FROM board_poll_vote                       WHERE rider_id   = ?',
            'DELETE FROM board_share                           WHERE sender_id  = ?',
            'DELETE FROM board_views                           WHERE rider_id   = ?',
            'DELETE FROM riders                                WHERE rider_id   = ?'
        ];

        // Execute each delete query
        for (const query of deleteQueries) {
            await connection.execute(query, [riderId]);
        }

        await connection.commit();

        return resp.json({ status: 1, code: 200, error: false, message: ['Rider account deleted successfully!'] });
    } catch (err) {
        await connection.rollback();
        console.error('Error deleting rider account:', err.message);
        return resp.json({ status: 1, code: 500, error: true, message: ['Something went wrong. Please try again!'] });
    } finally {
        connection.release();
    }
};
















