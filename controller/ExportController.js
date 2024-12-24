import db from "../config/db.js";
import ExcelJS from 'exceljs';
import moment from "moment";
import { formatDateInQuery, mergeParam } from "../utils.js";

export const donwloadPodBookingList = async (req, resp) => {
    try{
        const { status, start_date, end_date, search_text='', scheduled_start_date, scheduled_end_date } = mergeParam(req);
        
        let query = `
            SELECT
                booking_id, 
                rider_id, 
                rsa_id, 
                charger_id, 
                vehicle_id, 
                service_name, 
                service_price, 
                service_type, 
                user_name, 
                country_code, 
                contact_no, 
                CASE 
                    WHEN status = 'CNF' THEN 'Booking Confirmed'
                    WHEN status = 'A'   THEN 'Assigned'
                    WHEN status = 'RL'  THEN 'POD Reached at Location'
                    WHEN status = 'CS'  THEN 'Charging Started'
                    WHEN status = 'CC'  THEN 'Charging Completed'
                    WHEN status = 'PU'  THEN 'Picked Up'
                    WHEN status = 'C'   THEN 'Cancel'
                    WHEN status = 'ER'  THEN 'Enroute'
                END AS status,
                ${formatDateInQuery(['slot_date', 'created_at'])}, 
                slot_time                
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
            query += ' OR status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY id DESC ';
        
        const [rows] = await db.execute(query, params);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet 1');
    
        worksheet.columns = [
            { header: 'Booking Id',     key: 'booking_id'    },
            { header: 'User Id',        key: 'rider_id'      },
            { header: 'Driver Id',      key: 'rsa_id'        },
            { header: 'Charger Id',     key: 'charger_id'    },
            { header: 'Vehicle Id',     key: 'vehicle_id'    },
            { header: 'Service Name',   key: 'service_name'  },
            { header: 'Service Price',  key: 'service_price' },
            { header: 'Service Type',   key: 'service_type'  },
            { header: 'User Name',      key: 'user_name'     },
            { header: 'Country Code',   key: 'country_code'  },
            { header: 'Contact No',     key: 'contact_no'    },
            { header: 'Status',         key: 'status'        },
            { header: 'Schedule Date',  key: 'slot_date'     },
            { header: 'Slot Time',      key: 'slot_time'     },
            { header: 'Booking Date',   key: 'created_at'    },
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