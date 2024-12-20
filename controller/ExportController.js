import db from "../config/db.js";
import ExcelJS from 'exceljs';
import moment from "moment";
import { mergeParam } from "../utils.js";

export const donwloadPodBookingList = async (req, resp) => {
    try{
        const { status, start_date, end_date, search_text='' } = mergeParam(req);
        
        let query = `
            SELECT
                booking_id, rider_id, rsa_id, charger_id, vehicle_id, service_name, service_price, service_type, user_name, country_code, contact_no, 
                slot_date, slot_time, created_at,
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
            FROM portable_charger_booking
        `; 
        let params = [];
        let conditions = [];

        if (search_text) {
            conditions.push(`(booking_id LIKE ? OR user_name LIKE ? OR service_name LIKE ?)`);
            const searchPattern = `%${search_text}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        if (start_date && end_date) {
            const start = moment(start_date, "YYYY-MM-DD").startOf('day').format("YYYY-MM-DD HH:mm:ss");
            const end = moment(end_date, "YYYY-MM-DD").endOf('day').format("YYYY-MM-DD HH:mm:ss");
            conditions.push(`created_at BETWEEN ? AND ?`);
            params.push(start, end);
        }
        if (status) {
            conditions.push(`status = ?`);
            params.push(status);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' OR ')}`;
        }

        query += ' ORDER BY id DESC ';
        // console.log(query, params);
        const [rows] = await db.execute(query, params);
        // return resp.json(rows);
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet 1');
    
        worksheet.columns = [
            { header: 'Booking Id',     key: 'booking_id'    },
            { header: 'Rider Id',       key: 'rider_id'      },
            { header: 'Rsa Id',         key: 'rsa_id'        },
            { header: 'Charger Id',     key: 'charger_id'    },
            { header: 'Vehicle Id',     key: 'vehicle_id'    },
            { header: 'Service Name',   key: 'service_name'  },
            { header: 'Service Price',  key: 'service_price' },
            { header: 'Service Type',   key: 'service_type'  },
            { header: 'User Name',      key: 'user_name'     },
            { header: 'Country Code',   key: 'country_code'  },
            { header: 'Contact No',     key: 'contact_no'    },
            { header: 'Status',         key: 'status'        },
            { header: 'Slot Date',      key: 'slot_date'     },
            { header: 'Slot Time',      key: 'slot_time'     }
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
