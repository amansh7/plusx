import db from "../config/db.js";
import ExcelJS from 'exceljs';
import moment from "moment";
import { formatDateInQuery, mergeParam } from "../utils.js";

export const donwloadPodBookingList = async (req, resp) => {
    try{
        const { status, start_date, end_date, search_text='', scheduled_start_date, scheduled_end_date } = mergeParam(req);
        
        let query = `
            SELECT
                ${formatDateInQuery(['created_at'])},
                booking_id,
                service_type,
                service_price,
                CONCAT(slot_date,' ',slot_time) AS schedule_date_time,
                user_name,
                (select rider_email from riders AS r where r.rider_id = portable_charger_booking.rider_id) AS email,
                CONCAT(country_code,'-',contact_no) AS mobile,
                address,
                (select rsa_name from rsa where rsa.rsa_id = portable_charger_booking.rsa_id) AS rsa_name,
                (select concat(country_code,'-',mobile) from rsa where rsa.rsa_id = portable_charger_booking.rsa_id) AS rsa_phone,
                CASE
                    WHEN status = 'CNF' THEN 'Booking Confirmed'
                    WHEN status = 'A'   THEN 'Assigned'
                    WHEN status = 'RL'  THEN 'POD Reached at Location'
                    WHEN status = 'CS'  THEN 'Charging Started'
                    WHEN status = 'CC'  THEN 'Charging Completed'
                    WHEN status = 'PU'  THEN 'Picked Up'
                    WHEN status = 'C'   THEN 'Cancel'
                    WHEN status = 'ER'  THEN 'Enroute'
                END AS status
            FROM
                portable_charger_booking  

        `; 
        let params = [];

        if (search_text) {
            query += ` WHERE booking_id = ? OR user_name = ? OR service_name = ?`;
            params.push(search_text, search_text, search_text);
        }
        if (start_date && end_date) {
            const start = moment(start_date, "YYYY-MM-DD").startOf('day').format("YYYY-MM-DD HH:mm:ss");
            const end   = moment(end_date, "YYYY-MM-DD").endOf('day').format("YYYY-MM-DD HH:mm:ss");
            if (params.length === 0) query += ` WHERE created_at BETWEEN ? AND ?`;
            else query += ` AND created_at BETWEEN ? AND ?`; 
            params.push(start, end);
        }
        if (scheduled_start_date && scheduled_end_date) {
            const schStart = moment(scheduled_start_date, "YYYY-MM-DD").format("YYYY-MM-DD");
            const schEnd   = moment(scheduled_end_date, "YYYY-MM-DD").format("YYYY-MM-DD");
            if (params.length === 0) query += ` WHERE slot_date BETWEEN ? AND ?`;
            else query += ` AND slot_date BETWEEN ? AND ?`; 
            params.push(schStart, schEnd);
        }
        if (status) {
            if (params.length === 0) query += ` WHERE status = ?`;
            else query += ` OR status = ?`; 
            params.push(status);
        }
        
        query += ' ORDER BY id DESC ';
        
        const [rows] = await db.execute(query, params);
        // return resp.json(rows);
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet 1');
    
        worksheet.columns = [
            { header: 'Booking Date',           key: 'created_at'         },
            { header: 'Booking Id',             key: 'booking_id'         },
            { header: 'Service Type',           key: 'service_type'       },
            { header: 'Service Price',          key: 'service_price'      },
            { header: 'Schedule Date',          key: 'schedule_date_time' },
            { header: 'Customer Name',          key: 'user_name'          },
            { header: 'Customer Email',         key: 'email'              },
            { header: 'Customer Contact No',    key: 'mobile'             },
            { header: 'Address',                key: 'address'            },
            { header: 'Driver Name',            key: 'rsa_name'           },
            { header: 'Driver Contact No',      key: 'rsa_phone'          },
            { header: 'Status',                 key: 'status'             },
        ];
    
        rows.forEach((item) => {
            worksheet.addRow(item);
        });
        resp.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        resp.setHeader('Content-Disposition', 'attachment; filename=Portable-Charger-Booking-List.xlsx');
      
        await workbook.xlsx.write(resp);
        resp.end();

    }catch(err){
        console.log('err exporting : ', err);
        return resp.status(500).json({ status: 0, message: 'Error exporting charger booking lists' });
    }
    
}; 