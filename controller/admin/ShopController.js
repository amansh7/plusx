import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
import { formatOpenAndCloseTimings } from '../../utils.js';

export const storeList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'service_shops',
        columns: `shop_id, shop_name, contact_no, cover_image AS shop_image, store_website, 
            (SELECT GROUP_CONCAT(location) FROM store_address AS sa WHERE sa.store_id = service_shops.shop_id ) AS location
        `,
        searchFields: ['shop_name'],
        searchTexts: [search],
        sortColumn: 'id',
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

export const storeAdd = async (req, resp) => {
    try{    
        const { shop_name, contact_no ,address='', store_website='', store_email='', always_open='', description='', brands='', services='', days='' } = req.body;
        const { isValid, errors } = validateFields(req.body, { shop_name: ["required"], contact_no: ["required"], address: ["required"], });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const coverImg = req.files?.['cover_image']?.[0]?.filename || '';
        const shopGallery = req.files?.['shop_gallery']?.map(file => file.filename) || [];
    
        const { fDays, fTiming } = formatOpenAndCloseTimings(always_open, data);
        const storeId     = `STOR${generateUniqueId({length:12})}`;
        const brandsArr   = (brands && brands.trim !== '') ? brands.join(",") : '';
        const servicesArr = (services && services.trim !== '') ? services.join(",") : '';
    
        const insert = await insertRecord('service_shops', [
            'shop_id', 'shop_name', 'contact_no', 'store_website', 'store_email', 'cover_image', 'status', 'always_open', 'open_days', 'open_timing', 'description', 'brands', 'services', 
        ], [
            storeId, shop_name, contact_no, store_website, store_email, coverImg, 1, always_open ? 1 : 0, fDays, fTiming, description, brandsArr, servicesArr
        ]);

        if(insert.affectedRows == 0) return resp.json({status:0, message: "Something went wrong! Please try again after some time."});
    
        if(shopGallery.length > 0){
            const values = shopGallery.map(filename => [storeId, filename]);
            const placeholders = values.map(() => '(?, ?)').join(', ');
            await db.execute(`INSERT INTO store_gallery (store_id, image_name) VALUES ${placeholders}`, values.flat());
        }
        /* if(address && address.length > 0){
            const allAddress = data.address.filter(Boolean);
            const values = [];
            const placeholders = [];
            for (let k = 0; k < allAddress.length; k++) {
                if (data.address[k]) {
                    values.push(storeId);
                    values.push(data.address[k]);
                    values.push(data.area_name[k]);
                    values.push(data.location[k]);
                    values.push(data.latitude[k]);
                    values.push(data.longitude[k]);
    
                    placeholders.push('(?, ?, ?, ?, ?, ?)');
                }
            }
            await db.execute(`INSERT INTO store_address (store_id, address, area_name, location, latitude, longitude) VALUES ${placeholders.join(', ')}`, [values]);
        } */
        return resp.json({status: 1, message: "Store added successfully."});
    } catch(err) {
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }
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

export const storeUpdate = async (req, resp) => {
    try{
        const { shop_name, contact_no , address='', store_website='', store_email='', always_open='', description='', brands='', services='', days='', shop_id } = req.body;
        const { isValid, errors } = validateFields(req.body, {
            shop_name: ["required"], contact_no: ["required"], shop_id: ["required"], 
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const shop = queryDB(`SELECT cover_image FROM service_shops WHERE shop_id = ? LIMIT 1`, [shop_id]);
        if(!shop) return resp.json({status:0, message: "Shop Data can not edit, or invalid shop Id"});
        const [gallery] = await db.execute(`SELECT image_name FROM store_gallery WHERE store_id = ?`, [shop_id]);
        const galleryData = gallery.map(img => img.image_name);

        const brandsArr = (brands && brands.trim !== '') ? data.brands.join(",") : '';
        const servicesArr = (services && services.trim !== '') ? data.services.join(",") : '';
        const { fDays, fTiming } = formatOpenAndCloseTimings(always_open, data);

        const updates = {
            shop_name, 
            contact_no, 
            store_website, 
            store_email, 
            status:1, 
            always_open: always_open ? 1 : 0, 
            open_days: fDays, 
            open_timing: fTiming, 
            brands: brandsArr,
            services: servicesArr,
        };

        const coverImg = req.files?.['cover_image']?.[0]?.filename || '';
        const shopGallery = req.files?.['shop_gallery']?.map(file => file.filename) || [];

        if (coverImg) updates.cover_image = coverImg;

        const update = await updateRecord('service_shops', updates, ['shop_id'], [shop_id]);
        
        if(update.affectedRows == 0) return resp.json({status:0, message: "Failed to update! Please try again after some time."});

        if(shopGallery.length > 0){
            const values = shopGallery.map(filename => [storeId, filename]);
            const placeholders = values.map(() => '(?, ?)').join(', ');
            await db.execute(`INSERT INTO store_gallery (store_id, image_name) VALUES ${placeholders}`, values.flat());
        }

        if (shop.cover_image) deleteFile('shop-images', shop.cover_image);
        if (req.files['shop_gallery'] && galleryData.length > 0) {
            galleryData.forEach(img => img && deleteFile('shop-images', img));
        }

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
    }catch(err){

    }
};

export const storeDelete = async (req, resp) => {
    const {shop_id} = req.body;

    const shop = await queryDB(`SELECT cover_image FROM shops WHERE shop_id = ?`, [shop_id]);
    if (!shop) return resp.json({ status: 0, msg: "Shop Data cannot be deleted, or invalid" });
    const [gallery] = await db.execute(`SELECT image_name FROM store_gallery WHERE store_id = ?`, [shop_id]);
    const galleryData = gallery.map(img => img.image_name);

    if (shop.cover_image) {
        deleteFile('shop-images', shop.cover_image);
    }
    if (galleryData.length > 0) {
        galleryData.forEach(img => img && deleteFile('shop-images', img));
    }
    
    await queryDB(`DELETE FROM store_gallery WHERE store_id = ?`, [shop_id]);
    await queryDB(`DELETE FROM store_address WHERE store_id = ?`, [shop_id]);
    await queryDB(`DELETE FROM shops WHERE shop_id = ?`, [shop_id]);

    return resp.json({ status: 1, msg: "Shop deleted successfully!" });
};

/* Shop Service */
export const serviceList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'store_services',
        columns: `service_id, service_name, created_at`,
        searchFields: ['service_name'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Shop Service List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });
};
export const serviceCreate = async (req, resp) => {
    const { service_name } = req.body;
    const { isValid, errors } = validateFields(req.body, { service_name: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(service_name.length > 250) return resp.json({ status: 0, code: 422, message: "Max 250 character allowed." });

    const insert = await insertRecord('store_services', ['service_id', 'service_name'], [`STRC${generateUniqueId({length:12})}`, service_name]);

    return resp.json({
        status: insert.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: insert.affectedRows > 0 ? "Store Service Added successfully." : "Failed to insert, Please Try Again." ,
    });

};
export const serviceUpdate = async (req, resp) => {
    const { service_name, service_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { service_name: ["required"], service_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(service_name.length > 250) return resp.json({ status: 0, code: 422, message: "Max 250 character allowed." });

    const update = await updateRecord('store_services', {service_name}, ['service_id'], [service_id]);

    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: update.affectedRows > 0 ? "Store Service Updated successfully." : "Failed to update, Please Try Again." ,
    });
};
export const serviceDelete = async (req, resp) => {
    const { service_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { service_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [del] = await db.execute(`DELETE FROM store_services WHERE service_id = ?`, [service_id]);

    return resp.json({
        status: del.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: del.affectedRows > 0 ? "Store Service Deleted successfully." : "Failed to delete, Please Try Again." ,
    });
};

/* Shop Brand */
export const brandList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'store_brands',
        columns: `brand_id, brand_name`,
        searchFields: ['brand_name'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Shop Brand List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });
};
export const brandCreate = async (req, resp) => {
    const { brand_name } = req.body;
    const { isValid, errors } = validateFields(req.body, { brand_name: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(brand_name.length > 250) return resp.json({ status: 0, code: 422, message: "Max 250 character allowed." });

    const insert = await insertRecord('store_brands', ['brand_id', 'brand_name'], [`STB${generateUniqueId({length:12})}`, brand_name]);

    return resp.json({
        status: insert.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: insert.affectedRows > 0 ? "Store Brand Added successfully." : "Failed to insert, Please Try Again." ,
    });

};
export const brandUpdate = async (req, resp) => {
    const { brand_name, brand_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { brand_name: ["required"], brand_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(brand_name.length > 250) return resp.json({ status: 0, code: 422, message: "Max 250 character allowed." });

    const update = await updateRecord('store_brands', {brand_name}, ['brand_id'], [brand_id]);

    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: update.affectedRows > 0 ? "Store Brand Updated successfully." : "Failed to update, Please Try Again." ,
    });
};
export const brandDelete = async (req, resp) => {
    const { brand_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { brand_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [del] = await db.execute(`DELETE FROM store_brands WHERE brand_id = ?`, [brand_id]);

    return resp.json({
        status: del.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: del.affectedRows > 0 ? "Store Brand Deleted successfully." : "Failed to delete, Please Try Again." ,
    });
};