import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";

export const storeList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'service_shops',
        columns: `shop_id, shop_name, contact_no, cover_image AS shop_image, store_website, 
            (SELECT GROUP_CONCAT(location) FROM store_address AS sa WHERE sa.store_id = service_shops.shop_id ) AS location
        `,
        searchFields: ['shop_name'],
        searchTexts: [search],
        sortColumn: 'created_at',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Shop List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });
};

export const storeData = async (req, resp) => {
    const { shop_id } = req.body;
    const shop = queryDB(`SELECT * FROM service_shops WHERE shop_id = ? LIMIT 1`, [shop_id]); 
    const days = [ 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday' ];
    const location = await db.execute(`SELECT location_name FROM locations WHERE status = 1 ORDER BY location_name ASC`);
    const [services] = await db.execute(`SELECT service_name FROM store_services ORDER BY service_name ASC`);
    const serviceNames = services.map(service => service.service_name);
    const [brands] = await db.execute(`SELECT brand_name FROM store_brands ORDER BY brand_name ASC`);
    const brandNames = brands.map(brand => brand.brand_name);

    const result = {
        status: 1,
        days: days,
        location: location,
        services: serviceNames,
        brands: brandNames,
    }
    if(shop_id){
        result.shop = shop;
    }

    return resp.status(200).json(result);
};

//img upload pending
export const storeAdd = async (req, resp) => {
    const { shop_name, contact_no ,address=[], store_website='', store_email='', always_open='', description='', brands='', services='' } = req.body;
    const { isValid, errors } = validateFields(req.body, {
        shop_name: ["required"], contact_no: ["required"], address: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    if (always_open) {
        const days = data.days.join('_');
        const timeArr = data.days.map(day => {
            const openTime = data[`${day}_open_time`];
            const closeTime = data[`${day}_close_time`];
            if (openTime && closeTime) {
                const formattedOpenTime = new Date(`1970-01-01T${openTime}`).toTimeString().slice(0, 8);
                const formattedCloseTime = new Date(`1970-01-01T${closeTime}`).toTimeString().slice(0, 8);
                return `${formattedOpenTime}-${formattedCloseTime}`;
            } else {
                return 'Closed';
            }
        });
    
        const timing = timeArr.join('_');
    }

    const storeId = `STOR${generateUniqueId({length:12})}`;
    const brandsArr = (brands && brands.trim !== '') ? data.brands.join(",") : '';
    const servicesArr = (services && services.trim !== '') ? data.services.join(",") : '';

    const insert = await insertRecord('service_shops', [
        'shop_id', 'shop_name', 'contact_no', 'store_website', 'store_email', 'cover_image', 'status', 'always_open', 'open_days', 'open_timing', 'description', 'brands', 
        'services', 
    ], [
        storeId, shop_name, contact_no, store_website, store_email, 'img', 1, always_open ? 1 : 0, days, timing, description, brandsArr, servicesArr
    ]);
    
    if(insert.affectedRows == 0) return resp.json({status:0, message: "Something went wrong! Please try again after some time."});

    if(address && address.length > 0){
        const allAddress = data.address.filter(Boolean);
        const values = [];
        const placeholders = [];
        for (let k = 0; k < allAddress.length; k++) {
            if (data.address[k]) {
                values.push(store_id);
                values.push(data.address[k]);
                values.push(data.area_name[k]);
                values.push(data.location[k]);
                values.push(data.latitude[k]);
                values.push(data.longitude[k]);

                placeholders.push('(?, ?, ?, ?, ?, ?)');
            }
        }

        await db.execute(`INSERT INTO store_address (store_id, address, area_name, location, latitude, longitude) VALUES ${placeholders.join(', ')}`, [values]);
    }

    return resp.json({
        status: 1, 
        message: "Store added successfully."
    });
};

export const storeView = async (req, resp) => {
    const { shop_id } = req.body;
    const store = await queryDB(`SELECT * FROM service_shops WHERE shop_id = ? LIMIT 1`, [shop_id]);
    store.schedule = getOpenAndCloseTimings(shop);
    if(!store) return resp.json({status:0, message:"Shop Id is invalid"});

    const [address] = await db.execute(`SELECT address, area_name, location, latitude, longitude FROM StoreAddress WHERE store_id = ?`, [shop_id]);
    const [gallery] = await queryDB(`SELECT * FROM store_gallery WHERE shop_id = ? ORDER BY id DESC`, [shop_id]);
    
    const galleryData = {};
    gallery.forEach(row => {
        galleryData[row.id] = row.image_name;
    });
      
    return resp.json({
        status:1,
        message:"Shop Detail fetch successfully",
        store,
        galleryData,
        address,
    });
};

//img upload | address update
export const storeUpdate = async (req, resp) => {
    const { shop_name, contact_no ,address=[], store_website='', store_email='', always_open='', description='', brands='', services='' } = req.body;
    const { isValid, errors } = validateFields(req.body, {
        shop_name: ["required"], contact_no: ["required"], address: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const shop = queryDB(`SELECT cover_image FROM service_shops WHERE shop_id = ? LIMIT 1`, [shop_id]);
    if(!shop) return resp.json({status:0, message: "Shop Data can not edit, or invalid shop Id"});
    
    let days = ''; let timeArr = ''; let timing = '';
    const brandsArr = (brands && brands.trim !== '') ? data.brands.join(",") : '';
    const servicesArr = (services && services.trim !== '') ? data.services.join(",") : '';

    if (always_open) {
        days = data.days.join('_');
        timeArr = data.days.map(day => {
            const openTime = data[`${day}_open_time`];
            const closeTime = data[`${day}_close_time`];
            if (openTime && closeTime) {
                const formattedOpenTime = new Date(`1970-01-01T${openTime}`).toTimeString().slice(0, 8);
                const formattedCloseTime = new Date(`1970-01-01T${closeTime}`).toTimeString().slice(0, 8);
                return `${formattedOpenTime}-${formattedCloseTime}`;
            } else {
                return 'Closed';
            }
        });
    
        timing = timeArr.join('_');
    }

    const update = await updateRecord('service_shops', [
        'shop_name', 'contact_no', 'store_website', 'store_email', 'status', 'always_open', 'open_days', 'open_timing', 'brands', 'services', 
    ], [
        shop_name, contact_no, store_website, store_email, 1, always_open ? 1 : 0, days, timing, brandsArr, servicesArr
    ]);
    
    if(update.affectedRows == 0) return resp.json({status:0, message: "Failed to update! Please try again after some time."});

    /* if (address && address.length > 0) {
        const allAddress = data.address.filter(Boolean);
        const values = [];
        const updateQueries = [];
    
        for (let k = 0; k < allAddress.length; k++) {
            if (data.address[k]) {
                const id = data.id[k];
                updateQueries.push(`(?, ?, ?, ?, ?, ?)`);
                values.push(data.address[k]);  
                values.push(data.area_name[k]);
                values.push(data.location[k]); 
                values.push(data.latitude[k]); 
                values.push(data.longitude[k]);
                values.push(id);
            }
        }
    
        const sql = `UPDATE store_address SET address = ?, area_name = ?, location = ?, latitude = ?, longitude = ? WHERE id = ?`;
    
        for (let i = 0; i < allAddress.length; i++) {
            if (data.address[i]) {
                await db.execute(sql, values.slice(i * 6, (i + 1) * 6));
            }
        }
    } */

    return resp.json({statsu:1, message: "Store updated successfully"});
};

//img deletion - test
export const storeDelete = async (req, resp) => {
    const {shop_id} = req.body;

    const shop = await queryDB(`SELECT cover_image FROM shops WHERE shop_id = ?`, [shop_id]);
    if (!shop.length) return resp.json({ status: 0, msg: "Shop Data cannot be deleted, or invalid" });

    const galleryData = await queryDB(`SELECT image_name FROM store_gallery WHERE store_id = ?`, [shop_id]);

    if (galleryData.length) {
        for (const img of galleryData) {
            if (img.image_name) {
                const file_path = path.join(__dirname, '../uploads/shop-images', img.image_name);
                fs.unlink(file_path, (err) => {
                    if (err) {
                        console.error(`Failed to delete image ${img.image_name}:`, err);
                    }
                });
            }
        }
        await queryDB(`DELETE FROM store_gallery WHERE store_id = ?`, [shop_id]);
    }
    if (shop.cover_image) {
        const cover_file_path = path.join(__dirname, '../uploads/shop-images', shop.cover_image);
        fs.unlink(cover_file_path, (err) => {
            if (err) {
                console.error(`Failed to delete cover image ${shop.cover_image}:`, err);
            }
        });
    }

    await queryDB(`DELETE FROM store_address WHERE store_id = ?`, [shop_id]);
    await queryDB(`DELETE FROM shops WHERE shop_id = ?`, [shop_id]);

    return resp.json({ status: 1, msg: "Shop deleted successfully!" });
};
