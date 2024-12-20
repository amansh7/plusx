import db from "../config/db.js";
import ExcelJS from 'exceljs';
import moment from "moment";
import { mergeParam } from "../utils.js";

export const donwloadPodBookingList = async (req, resp) => {
    try{
        const { status, start_date, end_date, search_text='' } = mergeParam(req);
        
        let query = `
            SELECT
                booking_id, rider_id, rsa_id, charger_id, vehicle_id, service_name, service_price, service_type, user_name, country_code, contact_no, status, slot_date, slot_time, created_at
            FROM portable_charger_booking
        `; 
        let params = [];

        if (search_text) {
            query += ` WHERE booking_id = ? OR user_name = ? OR service_name = ?`;
            params.push(search_text, search_text, search_text);
        }
        if (start_date && end_date) {
            const start = moment(start_date, "YYYY-MM-DD").startOf('day').format("YYYY-MM-DD HH:mm:ss");
            const end = moment(end_date, "YYYY-MM-DD").endOf('day').format("YYYY-MM-DD HH:mm:ss");
            if (params.length === 0) query += ` WHERE created_at BETWEEN ? AND ?`;
            else query += ` AND created_at BETWEEN ? AND ?`; 
            params.push(start, end);
        }
        if (status) {
            query += ' OR status = ?';
            params.push(status);
        }

        query += ' ORDER BY id DESC ';
        console.log(query, params);
        const [rows] = await db.execute(query, params);

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
