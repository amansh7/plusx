import db from '../../config/db.js';
import dotenv from 'dotenv';
import { mergeParam, getOpenAndCloseTimings} from '../../utils.js';
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







