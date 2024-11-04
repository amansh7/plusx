import generateUniqueId from 'generate-unique-id';
import db from '../../config/db.js';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";

export const clubList = async (req, resp) => {
    const { search, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'clubs',
        columns: `club_id, club_name, location, no_of_members, cover_img`,
        searchFields: ['club_name'],
        searchTexts: [search],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Club List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });    
};

export const clubData = async (req, resp) => {
    const { club_id } = req.body;
    const club = await queryDB(`SELECT * FROM clubs WHERE club_id = ?`, [club_id]);
    const [gallery] = await db.execute(`SELECT image_name FROM club_gallery WHERE club_id = ? ORDER BY id DESC`, [club_id]);
    const galleryData = gallery.map(image => image.image_name);
    const location = await db.execute(`SELECT location_name FROM locations WHERE status = 1 ORDER BY location_name ASC`);
    const clubCategory = ['Women`s Cycling Club', 'Junior Cycling Club', 'Mountain Cycling Club', 'Road Cycling Club', 'Emirates Group Staff'];
    const ageGroup = ['17 & Younger', 'Above 18', 'All age group'];

    const result = {
        status: 1,
        location,
        ageGroup,
        clubCategory,
    }
    if(club_id){
        result.club = club;
        result.galleryData = galleryData;
    }

    return resp.status(200).json(result);
};

export const clubCreate = async (req, resp) => {
    try{
        const uploadedFiles = req.files;
        let cover_image = '';
        if(req.files && req.files['cover_image']){
            cover_image = uploadedFiles ? uploadedFiles['cover_image'][0].filename : '';
        }
        const club_gallery = uploadedFiles['club_gallery']?.map(file => file.filename) || [];

        const { club_name, location, description, club_url, category, age_group, no_of_members='', url_link='', preference='' } = req.body;
        const { isValid, errors } = validateFields(req.body, {
            club_name: ["required"],
            location: ["required"],
            description: ["required"],
            club_url: ["required"],
            category: ["required"],
            age_group: ["required"],

        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const clubId = `CLB${generateUniqueId({length:12})}`;

        const insert = await insertRecord('clubs', [
            'club_id', 'club_name', 'location', 'no_of_members', 'description', 'url_link', 'cover_img', 'category', 'age_group', 'preference', 'status'
        ], [
            clubId, club_name, location, no_of_members, description, url_link, cover_image, category, age_group, preference, 1
        ]);

        if(insert.affectedRows == 0) return resp.json({status:0, message: "Something went wrong! Please try again after some time."});

        if(club_gallery.length > 0){
            const values = club_gallery.map(filename => [clubId, filename]);
            const placeholders = values.map(() => '(?, ?)').join(', ');
            await db.execute(`INSERT INTO club_gallery (club_id, image_name) VALUES ${placeholders}`, values.flat());
        }

        return resp.json({status: 1, message: "Club added successfully."});

    }catch(err){
        // console.log(err);
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }
};

export const clubUpdate = async (req, resp) => {
    const uploadedFiles = req.files;
    let cover_image = '';
    if(req.files && req.files['cover_image']){
        cover_image = uploadedFiles ? uploadedFiles['cover_image'][0].filename : '';
    }
    const club_gallery = uploadedFiles['club_gallery']?.map(file => file.filename) || [];
        
    const { club_id, club_name, location, description, club_url, category, age_group, no_of_members='', url_link='', preference='', status='' } = req.body;
    const { isValid, errors } = validateFields(req.body, {
        club_name: ["required"],
        location: ["required"],
        description: ["required"],
        club_url: ["required"],
        category: ["required"],
        age_group: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const club = await queryDB(`SELECT cover_img FROM clubs WHERE club_id = ?`, [club_id]);
    if(!shop) return resp.json({status:0, message: "Club Data can not edit, or invalid club Id"});
    const galleryData = await queryDB(`SELECT image_name FROM club_gallery WHERE club_id = ?`, [club_id]);

    const updates = {
        club_name, 
        location, 
        no_of_members,
        description, 
        url_link, 
        category, 
        age_group, 
        preference,
        status: status ? 1 : 0
    };
    const update = await updateRecord('service_shops', updates, ['club_id'], [club_id]);
    
    if(update.affectedRows == 0) return resp.json({status:0, message: "Failed to update! Please try again after some time."});

    if(club_gallery.length > 0){
        const values = club_gallery.map(filename => [clubId, filename]);
        const placeholders = values.map(() => '(?, ?)').join(', ');
        await db.execute(`INSERT INTO club_gallery (club_id, image_name) VALUES ${placeholders}`, values.flat());
    }
    
    if (galleryData) {
        for (const img of galleryData) {
            if (img.image_name) {
                const file_path = path.join(__dirname, '../uploads/club-images', img.image_name);
                fs.unlink(file_path, (err) => {
                    if (err) {
                        console.error(`Failed to delete image ${img.image_name}:`, err);
                    }
                });
            }
        }
    }
    if (club.cover_image) {
        const cover_file_path = path.join(__dirname, '../uploads/club-images', club.cover_image);
        fs.unlink(cover_file_path, (err) => {
            if (err) {
                console.error(`Failed to delete cover image ${club.cover_image}:`, err);
            }
        });
    }

    return resp.json({statsu:1, message: "Club updated successfully"});
};

export const clubDelete = async (req, resp) => {
    const {club_id} = req.body;

    const club = await queryDB(`SELECT cover_image FROM clubs WHERE club_id = ?`, [club_id]);
    if (!club) return resp.json({ status: 0, msg: "Club Data cannot be deleted, or invalid" });

    const galleryData = await queryDB(`SELECT image_name FROM club_gallery WHERE club_id = ?`, [club_id]);

    if (galleryData) {
        for (const img of galleryData) {
            if (img.image_name) {
                const file_path = path.join(__dirname, '../uploads/club-images', img.image_name);
                fs.unlink(file_path, (err) => {
                    if (err) {
                        console.error(`Failed to delete image ${img.image_name}:`, err);
                    }
                });
            }
        }
        await queryDB(`DELETE FROM club_gallery WHERE club_id = ?`, [club_id]);
    }
    if (club.cover_image) {
        const cover_file_path = path.join(__dirname, '../uploads/club-images', club.cover_image);
        fs.unlink(cover_file_path, (err) => {
            if (err) {
                console.error(`Failed to delete cover image ${club.cover_image}:`, err);
            }
        });
    }

    await queryDB(`DELETE FROM clubs WHERE club_id = ?`, [club_id]);

    return resp.json({ status: 1, msg: "Club deleted successfully!" });
};

export const clubDeleteImg = async (req, resp) => {
    const { gallery_id } = req.body;

    const galleryData = await queryDB(`SELECT image_name FROM club_gallery WHERE id = ? LIMIT 1`, [gallery_id]);
    if (!galleryData) return resp.json({ status: 0, msg: "Gallery id not valid!" });

    if (galleryData) {
        for (const img of galleryData) {
            if (img.image_name) {
                const file_path = path.join(__dirname, '../uploads/club-images', img.image_name);
                fs.unlink(file_path, (err) => {
                    if (err) {
                        console.error(`Failed to delete image ${img.image_name}:`, err);
                    }
                });
            }
        }
        await queryDB(`DELETE FROM club_gallery WHERE club_id = ?`, [club_id]);
    }

    return resp.json({ status: 1, msg: "Club Image deleted successfully!" });
};
