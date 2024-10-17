import db, { startTransaction, commitTransaction, rollbackTransaction } from "../../config/db.js";
import { insertRecord, queryDB, getPaginatedData, updateRecord } from '../../dbUtils.js';
import validateFields from "../../validation.js";
import generateUniqueId from 'generate-unique-id';
import moment from "moment";
import fs from 'fs';
import path from "path";

export const addDiscussionBoard = async (req, resp) => {
    try{
        const files = req.files;
        const image = files.image.map(file => file.filename).join('*') || '';
        const {rider_id, blog_title, description = '', hyper_link = '', board_type = '', poll_options, expiry_days } = req.body;
        const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], blog_title: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const boardId = `DCB${generateUniqueId({length:12})}`;

        const insert = await insertRecord('discussion_board', [
            'board_id', 'rider_id', 'blog_title', 'description', 'image', 'hyper_link', 'board_type'
        ], [
            boardId, rider_id, blog_title, description, image, hyper_link, board_type
        ]);
    
        if(insert.affectedRows === 0) return resp.json({ status: 0, code: 422, message: ["Oops! There something went wrong! Please Try Again."] });
    
        if (Array.isArray(poll_options) && poll_options.length > 1){
            await insertRecord('board_poll', [
                'poll_id', 'board_id', 'rider_id', 'expiry_date', 'option_one', 'option_two', 'option_three', 'option_four'
            ], [
                `POL${generateUniqueId({length:12})}`, boardId, rider_id, moment().add(expiry_days, 'days').format('YYYY-MM-DD HH:mm:ss'), poll_options[0] || '', 
                poll_options[1] || '', poll_options[2] || '', poll_options[3] || ''
            ]);
        }
    
        return resp.json({ status: 1, code: 200, message: ["Post Successfully Added!"] });
    }catch(err){
        const error = JSON.parse(err.message);
        if (error.code === 422){
            return resp.status(422).json({status: 0, code: 422, message: error.message });
        }
        return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }
};

export const getDiscussionBoardList = async (req, resp) => {
    const {rider_id, page_no, search_text, by_rider } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const [rows] = await db.execute(`SELECT board_id FROM board_not_interested WHERE rider_id = ?`, [rider_id]);
        const ignoreBoardIds = rows.map(row => row.board_id);
    
        let whereField = [];
        let whereValue = [];
        let whereOperator = [];
    
        if(ignoreBoardIds.length > 0){
            whereField.push('db.board_id');
            whereValue.push(ignoreBoardIds);
            whereOperator.push("NOT IN");
        }
        if(by_rider){
            whereField.push('db.rider_id');
            whereValue.push(rider_id);
            whereOperator.push("=");
        }
    
        const result = await getPaginatedData({
            tableName: `discussion_board AS db
                LEFT JOIN board_poll bp1 ON bp1.board_id = db.board_id
                LEFT JOIN riders r ON r.rider_id = db.rider_id
                LEFT JOIN (SELECT board_id, COUNT(id) AS comment_count FROM board_comment GROUP BY board_id) bc ON bc.board_id = db.board_id
                LEFT JOIN (SELECT board_id, COUNT(id) AS view_count FROM board_views GROUP BY board_id) bv ON bv.board_id = db.board_id
                LEFT JOIN (SELECT board_id, COUNT(id) AS likes_count FROM board_likes WHERE status = 1 GROUP BY board_id) bl ON bl.board_id = db.board_id
                LEFT JOIN (SELECT board_id, COUNT(id) AS share_count FROM board_share GROUP BY board_id) bs ON bs.board_id = db.board_id
                LEFT JOIN board_likes bl1 ON bl1.board_id = db.board_id AND bl1.rider_id = '${rider_id}'
                LEFT JOIN board_poll bp ON bp.board_id = db.board_id
                LEFT JOIN (SELECT poll_id, COUNT(*) AS option_one_count FROM board_poll_vote WHERE option = 'option_one' GROUP BY poll_id) bpv1 ON bpv1.poll_id = bp1.poll_id
                LEFT JOIN (SELECT poll_id, COUNT(*) AS option_two_count FROM board_poll_vote WHERE option = 'option_two' GROUP BY poll_id) bpv2 ON bpv2.poll_id = bp1.poll_id
                LEFT JOIN (SELECT poll_id, COUNT(*) AS option_three_count FROM board_poll_vote WHERE option = 'option_three' GROUP BY poll_id) bpv3 ON bpv3.poll_id = bp1.poll_id
                LEFT JOIN (SELECT poll_id, COUNT(*) AS option_four_count FROM board_poll_vote WHERE option = 'option_four' GROUP BY poll_id) bpv4 ON bpv4.poll_id = bp1.poll_id
                LEFT JOIN (SELECT poll_id, option FROM board_poll_vote WHERE rider_id = '${rider_id}') bl2 ON bl2.poll_id = bp1.poll_id
            `,
            columns: `db.board_id, db.rider_id, db.blog_title, db.description, db.image, db.board_type, db.hyper_link, bp1.poll_id, bp1.expiry_date AS poll_expiry,
                r.rider_name, r.profile_img, COALESCE(bc.comment_count, 0) AS comment_count, COALESCE(bv.view_count, 0) AS view_count, COALESCE(bl.likes_count, 0) AS likes_count,
                COALESCE(bs.share_count, 0) AS share_count, bl1.status AS likes_check, bp.option_one, bp.option_two, bp.option_three, bp.option_four,
                COALESCE(bpv1.option_one_count, 0) AS option_one_vote_count, COALESCE(bpv2.option_two_count, 0) AS option_two_vote_count,
                COALESCE(bpv3.option_three_count, 0) AS option_three_vote_count, COALESCE(bpv4.option_four_count, 0) AS option_four_vote_count,  bl2.option AS selected_option
            `,
            searchField: 'db.blog_title',
            searchText: search_text,
            sortColumn: 'db.id',
            sortOrder: 'DESC',
            page_no,
            limit: 10,
            whereField,
            whereValue,
            whereOperator
        });
    
        return resp.json({
            status: 1,
            code: 200,
            message: ["Pick & Drop Invoice List fetch successfully!"],
            data: result.data,
            total_page: result.totalPage,
            total: result.total,
            base_url: `${req.protocol}://${req.get('host')}/uploads/discussion-board-images/`,
            rider_img_url: `${req.protocol}://${req.get('host')}/uploads/rider_profile/`,
        });
    }catch(err){
        console.error('Error getting board list:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const getDiscussionBoardDetail = async (req, resp) => {
    const {rider_id, board_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], board_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const board = await queryDB(`
            SELECT 
                db.board_id, db.rider_id, db.blog_title, db.description, db.image, db.board_type, db.hyper_link, bp1.poll_id, bp1.expiry_date AS poll_expiry,
                r.rider_name, r.profile_img, COALESCE(bc.comment_count, 0) AS comment_count, COALESCE(bv.view_count, 0) AS view_count, COALESCE(bl.likes_count, 0) AS likes_count,
                COALESCE(bs.share_count, 0) AS share_count, bl1.status AS likes_check, bp.option_one, bp.option_two, bp.option_three, bp.option_four,
                COALESCE(bpv1.option_one_count, 0) AS option_one_vote_count, COALESCE(bpv2.option_two_count, 0) AS option_two_vote_count,
                COALESCE(bpv3.option_three_count, 0) AS option_three_vote_count, COALESCE(bpv4.option_four_count, 0) AS option_four_vote_count,  bl2.option AS selected_option
            FROM discussion_board AS db
            LEFT JOIN board_poll bp1 ON bp1.board_id = db.board_id
            LEFT JOIN riders r ON r.rider_id = db.rider_id
            LEFT JOIN (SELECT board_id, COUNT(id) AS comment_count FROM board_comment GROUP BY board_id) bc ON bc.board_id = db.board_id
            LEFT JOIN (SELECT board_id, COUNT(id) AS view_count FROM board_views GROUP BY board_id) bv ON bv.board_id = db.board_id
            LEFT JOIN (SELECT board_id, COUNT(id) AS likes_count FROM board_likes WHERE status = 1 GROUP BY board_id) bl ON bl.board_id = db.board_id
            LEFT JOIN (SELECT board_id, COUNT(id) AS share_count FROM board_share GROUP BY board_id) bs ON bs.board_id = db.board_id
            LEFT JOIN board_likes bl1 ON bl1.board_id = db.board_id AND bl1.rider_id = ?
            LEFT JOIN board_poll bp ON bp.board_id = db.board_id
            LEFT JOIN (SELECT poll_id, COUNT(*) AS option_one_count FROM board_poll_vote WHERE option = 'option_one' GROUP BY poll_id) bpv1 ON bpv1.poll_id = bp1.poll_id
            LEFT JOIN (SELECT poll_id, COUNT(*) AS option_two_count FROM board_poll_vote WHERE option = 'option_two' GROUP BY poll_id) bpv2 ON bpv2.poll_id = bp1.poll_id
            LEFT JOIN (SELECT poll_id, COUNT(*) AS option_three_count FROM board_poll_vote WHERE option = 'option_three' GROUP BY poll_id) bpv3 ON bpv3.poll_id = bp1.poll_id
            LEFT JOIN (SELECT poll_id, COUNT(*) AS option_four_count FROM board_poll_vote WHERE option = 'option_four' GROUP BY poll_id) bpv4 ON bpv4.poll_id = bp1.poll_id
            LEFT JOIN (SELECT poll_id, option FROM board_poll_vote WHERE rider_id = ?) bl2 ON bl2.poll_id = bp1.poll_id
    
            WHERE db.board_id = ? LIMIT 1
        `, [rider_id, rider_id, board_id]);
    
        const [comments] = await db.execute(`
            SELECT 
                bc.comment_id, bc.comment, bc.created_at, bc.rider_id, r.rider_name, r.profile_img,
                (SELECT status FROM comments_likes as cl WHERE cl.comment_id = bc.comment_id and cl.rider_id = ?) AS commentCheck,
                rcr.id AS reply_comment_id, rcr.comment_id AS reply_comment_comment_id, rcr.comment AS reply_comment, rcr.created_at AS reply_comment_created_at, 
                rcr.rider_id AS reply_comment_rider_id, 
                (SELECT r2.rider_name FROM riders AS r2 WHERE r2.rider_id = rcr.rider_id) AS reply_rider_name,
                (SELECT r2.profile_img FROM riders AS r2 WHERE r2.rider_id = rcr.rider_id) AS reply_profile_img,
                (SELECT rcl.status FROM reply_comments_likes AS rcl WHERE rcl.comment_id = rcr.id AND rcl.rider_id = rcr.rider_id) AS reply_commentCheck
            FROM 
                board_comment AS bc
            LEFT JOIN 
                riders AS r ON r.rider_id = bc.rider_id
            LEFT JOIN 
                board_comment_reply AS rcr ON rcr.comment_id = bc.comment_id
            WHERE 
                bc.comment_id = ? 
            ORDER BY bc.id DESC, rcr.id DESC
        `, [rider_id, board_id]);
    
        const [polls] = await db.execute(`
            SELECT 
                bp.poll_id, bp.option_one, bp.option_two, bp.option_three, bp.option_four, bp.expiry_date, r.rider_name, r.profile_img, bpv.id AS vote_id, 
                bpv.option AS voted_option,
                (SELECT r2.rider_name FROM riders AS r2 WHERE r2.rider_id = bpv.rider_id) AS vote_rider_name,
                (SELECT r2.profile_img FROM riders AS r2 WHERE r2.rider_id = bpv.rider_id) AS vote_profile_img
            FROM 
                board_poll AS bp
            LEFT JOIN 
                riders AS r ON r.rider_id = bp.rider_id
            LEFT JOIN 
                board_poll_vote AS bpv ON bpv.poll_id = bp.poll_id
            WHERE 
                bp.board_id = ?
            ORDER BY bp.id DESC, bpv.id DESC
        `,[board_id]);
    
        return resp.json({
            message: ["Discussion Board Details fetched successfully!"],
            data: board,
            comments: comments,
            polls: polls,
            status: 1,
            code: 200,
            base_url: `${req.protocol}://${req.get('host')}/uploads/discussion-board-images/`,
            rider_img_url: `${req.protocol}://${req.get('host')}/uploads/rider_profile/`
        });        
    }catch(err){
        console.error('Error getting board detail:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const addComment = async (req, resp) => {
    const {rider_id, board_id, comment } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], board_id: ["required"], comment: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const board = await queryDB(`
            SELECT 
                db.rider_id, 
                (select fcm_token from riders as r where r.rider_id = db.rider_id ) as fcm_token, 
                (select rider_name from riders as r where r.rider_id = ? ) as rider_name
            FROM 
                discussion_board AS db
            WHERE
                db.board_id = ?
        `, [rider_id, board_id]);
    
        if(!board) return resp.json({status:0, code:422, error: true, message:["Board Id is not matching with our records"]});
        
        const commentId = `DBC${generateUniqueId({length:12})}`
        const insert = await insertRecord('board_comment', ['comment_id', 'board_id', 'rider_id', 'comment'], [commentId, board_id, rider_id, comment]);
    
        if(insert.affectedRows === 0) return resp.json({status:0, code:422, error: true, message:["Failed to add comment. Please Try Again."]});
    
        if(board.fcm_token){
            const href = 'disscussion_board/' + board_id;
            const heading = 'Comment On Discussion Board';
            const desc = `One Comment added on Discussion Board with board id : ${board_id} by rider : ${board.rider_name}`;
            // pushNotification(board.fcm_token, heading, desc, 'RDRFCM', href);
        }
    
        return resp.json({
            staus: 1, 
            code: 200,
            error: false,
            message: ["Discussion Board Comment added successfully!"]
        });        
    }catch(err){
        console.error('Error adding comment:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const replyComment = async (req, resp) => {
    const {rider_id, comment_id, comment } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], comment_id: ["required"], comment: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const commentData = await queryDB(`
            SELECT 
                rider_id, board_id,
                (SELECT concat(rider_name, ",", fcm_token) FROM riders AS r WHERE r.rider_id = bc.rider_id ) as riderDetails
            FROM 
                board_comment AS bc
            WHERE 
                bc.comment_id = ?
        `,[comment_id]);
    
        if(!commentData) return resp.json({status:0, code:422, error: true, message:["Comment Id is invalid!"]});
        
        const insert = await insertRecord('board_comment_reply', ['comment_id', 'rider_id', 'comment'], [comment_id, rider_id, comment]);
        if(insert.affectedRows === 0) return resp.json({status:0, code:422, error: true, message:["Failed to replay on comment. Please Try Again."]});
    
        if(commentData.riderDetails){
            const riderData = commentData.riderDetails.split(",");
            // const href = 'disscussion_board/' + board_id;
            // const heading = 'Reply On Comment';
            // const desc = `One Comment replied on comment by rider :  ${riderData[0]}`;
            // pushNotification(riderData[1], heading, desc, 'RDRFCM', href);
        }
    
        return resp.json({
            staus: 1, 
            code: 200,
            error: false,
            message: ["Board Comment Replied Successfully!"]
        });        
    }catch(err){
        console.error('Error reply comment:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const boardLike = async (req, resp) => {
    const {rider_id, board_id, status } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], board_id: ["required"], status: ["required"]});
    if (![1, 2].includes(status)) return resp.json({status:0, code:422, message:"Status should be 1 or 2"});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const board = await queryDB(`
            SELECT 
                (SELECT fcm_token FROM riders AS r WHERE r.rider_id = db.rider_id) AS fcm_token,
                (SELECT rider_name FROM riders AS r WHERE r.rider_id = ?) AS rider_name
            FROM
               discussion_board AS db
            WHERE 
                board_id = ?
            LIMIT 1
        `, [rider_id, board_id]);
    
        if(!board) return resp.json({status:0, code:422, error: true, message:["Board Id is not matching with our records"]});
        
        const count = await queryDB(`SELECT COUNT(*) AS count FROM board_likes WHERE rider_id = ? AND board_id = ?`, [rider_id, board_id]);
        let insert;
        
        if(count){
            insert = await updateRecord('board_likes', {status}, ['rider_id', 'board_id'], [rider_id, board_id]);
        }else{
            insert = await insertRecord('board_likes', ['rider_id', 'board_id', 'status'], [rider_id, board_id, status]);
        }
    
        if(insert.affectedRows === 0) return resp.json({status:0, code:422, error: true, message:["Failed to like board. Please Try Again."]});
        
        const statusTxt = status == 1 ? 'Like' : 'Un-like';
        const like = await queryDB(`SELECT COUNT(*) AS count FROM board_likes WHERE board_id = ? AND status = ?`, [board_id, 1]);
    
        if(board.fcm_token){
            const href = 'disscussion_board/' + board_id;
            const heading = `${statusTxt} On Board`;
            const desc = `One ${statusTxt} on your board by rider : ${board.rider_name}`;
            // pushNotification(board.fcm_token, heading, desc, 'RDRFCM', href);
        }
    
        return resp.json({
            status:0, 
            code:200,
            error: false,
            message: [`Board ${statusTxt} Successfully`],
            likes: like.count
        });   
    }catch(err){
        console.error('Error like board:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const boardView = async (req, resp) => {
    const {rider_id, board_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], board_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const board = await queryDB(`SELECT EXISTS(SELECT 1 FROM discussion_board WHERE board_id = ?) AS exist`, [board_id]);
        if(board.exists === 0) return resp.json({status:0, code:422, error: true, message:["Board Id is not matching with our records"]});
    
        const insert = await insertRecord('board_views', ['rider_id', 'board_id'], [rider_id, board_id]);
    
        return resp.json({
            status: insert.affectedRows > 0 ? 1 : 0, 
            code: insert.affectedRows > 0 ? 200 : 422,
            error: insert.affectedRows > 0 ? false : true,
            message: insert.affectedRows > 0 ? ["Board Viewd Successfully!"] : ["Failed to view board. Please Try Again."]
        });
    }catch(err){
        console.error('Error viewing board:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const boardShare = async (req, resp) => {
    const {rider_id, board_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], board_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const board = await queryDB(`
            SELECT 
                (SELECT fcm_token FROM riders AS r WHERE r.rider_id = db.rider_id) AS fcm_token,
                (SELECT rider_name FROM riders AS r WHERE r.rider_id = ?) AS rider_name
            FROM
               discussion_board AS db
            WHERE 
                board_id = ?
            LIMIT 1
        `, [rider_id, board_id]);
    
        if(!board) return resp.json({status:0, code:422, error: true, message:["Board Id is not matching with our records"]});
    
        const insert = await insertRecord('board_share', ['sender_id', 'board_id'], [rider_id, board_id]);
        if(insert.affectedRows === 0) return resp.json({status:0, code:422, error: true, message:["Failed to share the board. Please Try Again."]});
    
        if(board.fcm_token){
            const href = 'disscussion_board/' + board_id;
            const heading = 'Board shared by rider';
            const desc = `Your board shared by rider : ${board.rider_name}`;
            // pushNotification(board.fcm_token, heading, desc, 'RDRFCM', href);
        }
    } catch (err) {
        console.error('Error sharing board:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const votePoll = async (req, resp) => {
    const {rider_id, poll_id, option } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], poll_id: ["required"], option: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const poll = await queryDB(`SELECT concat(option_one, ",", option_two, ",", option_three, ",", option_four) as options, expiry_date FROM board_poll WHERE poll_id=?`, [poll_id]);
        if (!poll) return resp.status(422).json({ status: 0, code: 422, message: ["Poll option not available on this poll ID!"] });
        const optionArr = poll.options.split(',');
        if (moment(poll.expiry_date).isBefore()) return resp.status(422).json({ status: 0, code: 422, message: ["Poll option has expired!"] });
        if (option && !optionArr.includes(option)) return resp.status(422).json({ status: 0, code: 422, message: ["Poll option does not exist!"] });
        let query;
        if (option) {
            const poll = await queryDB(`SELECT COUNT(*) AS count FROM board_poll_vote WHERE rider_id=? AND poll_id=?`, [rider_id, poll_id]);
            query = poll.count > 0
            ? updateRecord('board_poll_vote', { option }, ['rider_id', 'poll_id'], [rider_id, poll_id])
            : insertRecord('board_poll_vote', ['rider_id', 'poll_id', 'option'], [rider_id, poll_id, option]);
        } else {
            query = db.execute(`DELETE FROM board_poll_vote WHERE rider_id=? AND poll_id=?`, [rider_id, poll_id]);
        }
        
        const result = await query;
        const message = option 
            ? (result.affectedRows > 0 ? "Board Poll successfully voted!" : "Failed to vote poll. Please try again.")
            : "Board option deleted successfully!";
        
        return resp.status(200).json({
            status: result.affectedRows > 0 ? 1 : 0,
            code: result.affectedRows > 0 ? 200 : 422,
            error: result.affectedRows === 0,
            message: [message]
        });
    }catch(err){
        console.error('Error voting poll:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const reportOnBoard = async (req, resp) => {
    const {rider_id, board_id, reason } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], board_id: ["required"], reason: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const board = await queryDB(`
            SELECT rider_id,
                (SELECT fcm_token FROM riders AS r WHERE r.rider_id = db.rider_id) AS fcm_token,
                (SELECT rider_name FROM riders AS r WHERE r.rider_id = ?) AS rider_name
            FROM
               discussion_board AS db
            WHERE 
                board_id = ?
            LIMIT 1
        `, [rider_id, board_id]);

        if(!board) return resp.json({status:0, code:422, error: true, message:["Board Id is not matching with our records"]});
        if(rider_id == board.rider_id) return resp.json({status:0, code:422, error: true, message:["You can`t Report on your post!"]});
        
        const reportId = `RDB${generateUniqueId({length:12})}`;
        const insert = await insertRecord('board_report', ['report_id', 'board_id', 'rider_id', 'reason'], [reportId, board_id, rider_id, reason]);

        if(insert.affectedRows === 0) return resp.json({status:0, code:422, error: true, message:["Failed to get report. Please Try Again."]});
        
        if(board.fcm_token){
            const href = 'disscussion_board/' + board_id;
            const heading = 'Report On Discussion Board';
            const desc = `One Report added on Discussion Board with board id : ${board_id} by rider : ${board.rider_name}`;
            // pushNotification(board.fcm_token, heading, desc, 'RDRFCM', href);
            // createNotification(heading, desc, 'Discussion Board', 'Admin', 'Rider', rider_id, '',  href);
        }

        return resp.status(200).json({
            status: 1,
            code: 200,
            error: false,
            message: ["Report received.Thanks for helping keep our community safe."]
        });

    }catch(err){
        console.error('Error getting report on board:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const boardNotInterested = async (req, resp) => {
    const {rider_id, board_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], board_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const board = await queryDB(`SELECT rider_id FROM discussion_board WHERE board_id = ?`, [board_id]);

        if(!board) return resp.json({status:0, code:422, error: true, message:["Board Id is not matching with our records"]});
        if(rider_id == board.rider_id) return resp.json({status:0, code:422, error: true, message:["You can`t do this action!"]});
    
        const insert = await insertRecord('board_not_interested', ['rider_id', 'board_id'], [rider_id, board_id]);
    
        return resp.json({
            status: insert.affectedRows > 0 ? 1 : 0, 
            code: insert.affectedRows > 0 ? 200 : 422,
            error: insert.affectedRows > 0 ? false : true,
            message: insert.affectedRows > 0 ? ["You will not see this post again!"] : ["Failed. Please Try Again."]
        });
    }catch(err){
        console.error('Error board not interested:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const boardDelete = async (req, resp) => {
    const {rider_id, board_id } = mergeparam(req);
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], board_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const connection = await startTransaction();
    try{
        const board = await queryDB(`SELECT rider_id, image FROM discussion_board WHERE board_id = ? AND rider_id = ?`, [board_id, rider_id]);
        if(!board) return resp.json({status:0, code:422, error: true, message:["Board Id is not matching with our records"]});
        
        const deleteBoard = await db.execute(`DELETE FROM discussion_board WHERE board_id = ?`, [board_id], connection);
        if (deleteBoard.affectedRows === 0) {
            await rollbackTransaction(connection);
            return resp.json({ status: 0, code: 422, error: true, message: ["Board ID not found!"] });
        }
        await db.execute(`DELETE FROM board_comment WHERE board_id = ?`, [board_id], connection);
        await db.execute(`DELETE FROM board_likes WHERE board_id = ?`, [board_id], connection);
        await db.execute(`DELETE FROM board_poll WHERE board_id = ?`, [board_id], connection);
        await db.execute(`DELETE FROM board_share WHERE board_id = ?`, [board_id], connection);
        await db.execute(`DELETE FROM board_views WHERE board_id = ?`, [board_id], connection);
        const imagePath = board?.image ? `/uploads/discussion-board-images/${board.image}` : null;
        if (imagePath) {
            const filePath = public_path() + imagePath;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        await commitTransaction(connection);
        return resp.json({
            status: 1,
            code: 200,
            error: false,
            message: ["Discussion Board deleted successfully!"]
        });
    }catch(err){
        await rollbackTransaction(connection);
        console.error('Error deleting board:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const editBoard = async (req, resp) => {
    try{
        const files = req.files;
        const newImages = files.image.map(file => file.filename).join('*') || '';
    
        const { rider_id, board_id, blog_title, description='', hyper_link='' } = req.body;
        const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], board_id: ["required"], blog_title: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
        const board = await queryDB(`SELECT rider_id, image FROM discussion_board WHERE board_id = ? AND rider_id = ?`, [board_id, rider_id]);
        if(!board) return resp.json({status:0, code:422, error: true, message:["Board Id is not matching with our records"]});
        
        if (newImages) {
            const imageArray = board.image.split("*");
            for (const img of imageArray) {
                const filePath = path.join('uploads', 'discussion-board-images', img);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                    } catch (error) {
                        console.error(`Failed to delete image: ${filePath}`, error);
                    }
                }
            }
        }

        const updatedImage = newImages ? newImages : board.image;
        const update = await updateRecord('discussion_board', {blog_title, description, image: updatedImage, hyper_link}, ['board_id', 'rider_id'], [board_id, rider_id]);
        if(update.affectedRows === 0) return resp.json({ status: 0, code: 422, message: ["Failed to update baord. Please Try Again."] });

        return resp.json({ 
            status: 1, 
            code: 200, 
            message: ["Board updated successfully!"] 
        });
    }catch(err){
        console.error('Error updating board:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const editPoll = async (req, resp) => {
    const { rider_id, board_id, poll_id, poll_option1='', poll_option2='', poll_option3='', poll_option4='', expiry_days } = req.body;
    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"], 
        board_id: ["required"], 
        poll_id: ["required"],
        poll_option1: ["required"],
        poll_option2: ["required"],
        expiry_days: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const poll = await queryDB(`
            SELECT 
                (SELECT COUNT(id) FROM board_poll_vote AS bv WHERE bv.poll_id = ?) AS vote_count
            FROM board_poll
            WHERE poll_id = ? AND board_id = ? AND rider_id = ?
            LIMIT 1
        `, [poll_id, poll_id, board_id, rider_id]);
        if(!poll) return resp.json({status:0, code:422, error: true, message:["Poll Id is not matching with our records"]});
        if(poll.vote_count > 0) return resp.json({status:0, code:422, error: true, message:["You can not edit this poll, after vote"]});
        
        const updates = {
            option_one: poll_option1,
            option_two: poll_option2,
            option_three: poll_option3,
            option_four: poll_option4,
            expiry_date: moment().add(expiry_days, 'days').format('YYYY-MM-DD HH:mm:ss')
        }
        const update = await updateRecord('board_poll', updates, ['poll_id', 'board_id', 'rider_id'], [poll_id, board_id, rider_id]);
        
        return resp.json({
            status: update.affectedRows > 0 ? 1 : 0, 
            code: update.affectedRows > 0 ? 200 : 422,
            error: update.affectedRows > 0 ? false : true,
            message: update.affectedRows > 0 ? ["Post Edited Successfully!"] : ["Failed to update poll. Please Try Again."]
        });

    }catch(err){
        console.error('Error updating poll:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const deleteComment = async (req, resp) => {
    const {rider_id, comment_id } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], comment_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const comment = await queryDB(`SELECT rider_id, board_id, 
            (SELECT concat(rider_name, ",", fcm_token) FROM riders AS r WHERE r.rider_id = board_comment.rider_id ) AS riderDetails
            FROM board_comment
            WHERE comment_id = ? AND rider_id = ?
        `, [comment_id, rider_id]);
        if(!comment) return resp.json({status:0, code:422, error: true, message:["Comment Id is invalid"]});

        const [del] = await db.execute(`DELETE FROM board_comment WHERE comment_id=?, rider_id`, [comment_id, rider_id]);
        const affectedRows = del.affectedRows;
        if(affectedRows === 0) return resp.json({status:0, code:422, error:true, message:["Failed to delete comment. Please Try Again"]});
        
        await db.execute(`DELETE FROM board_comment_reply WHERE comment_id=?, rider_id`, [comment_id, rider_id]);
        
        if(comment.riderDetails){
            const riderData = comment.riderDetails.split(",");
            // const href = 'disscussion_board/' + board_id;
            // const heading = Comment deleted';
            // const desc = `One Comment deleted by you!`;
            // pushNotification(riderData[1], heading, desc, 'RDRFCM', href);
        }

        return resp.json({
            status: 1,
            code: 200,
            error: false,
            message: ["Board Comment Deleted Successfully!"]
        });

    }catch(err){
        console.error('Error deleting comment:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const deleteReplyComment = async (req, resp) => {
    const {rider_id, reply_id } = req.body;
    const { isValid, errors } = validateFields(req.body, {rider_id: ["required"], reply_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const replyData = await queryDB(`SELECT comment_id FROM board_comment_reply WHERE id = ? AND rider_id = ? LIMIT 1`, [reply_id, rider_id]);
        if(!replyData) return resp.json({status:0, code:422, error: true, message:["Comment Id is invalid"]});

        const comment = await queryDB(`SELECT 
            (SELECT concat(rider_name, ",", fcm_token) FROM riders AS r WHERE r.rider_id = board_comment.rider_id ) AS riderDetails
            FROM board_comment
            WHERE comment_id = ? LIMIT 1
        `, [replyData.comment_id]);
        if(!comment) return resp.json({status:0, code:422, error: true, message:["Parent Comment Id is invalid"]});

        const [del] = await db.execute(`DELETE FROM board_comment_reply WHERE id=? AND rider_id=?`, [reply_id, rider_id]);
        const affectedRows = del.affectedRows;
        if(affectedRows === 0) return resp.json({status:0, code:422, error:true, message:["Failed to delete comment. Please Try Again"]});
                
        if(comment.riderDetails){
            const riderData = comment.riderDetails.split(",");
            // const href = 'disscussion_board/' + board_id;
            // const heading = 'Reply Comment deleted';
            // const desc = `One reply Comment deleted by rider!`;
            // pushNotification(riderData[1], heading, desc, 'RDRFCM', href);
        }

        return resp.json({
            status: affectedRows > 0 ? 1 : 0,
            code: affectedRows > 0 ? 200 : 422,
            error: affectedRows > 0 ? false : true,
            message: affectedRows > 0 ? ["Reply Comment Deleted Successfully!"] : ["Failed to delete reply comment. Please Try Again"]
        });

    }catch(err){
        console.error('Error deleting reply comment:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const commentLike = async (req, resp) => {
    const {rider_id, comment_id, status} = mergeparam(req);
    const { isValid, errors } = validateFields(mergeparam(req), {rider_id: ["required"], comment_id: ["required"], status: ["required"]});
    if (![1, 2].includes(status)) return resp.json({status:0, code:422, message:"Status should be 1 or 2"});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const comment = await queryDB(`
            SELECT 
                rider_id, board_id,
                (SELECT CONCAT(rider_name, ",", fcm_token) FROM riders AS r WHERE r.rider_id = board_comment.rider_id ) AS riderDetails,
                (SELECT COUNT(id) FROM comments_likes AS cl WHERE cl.comment_id=? AND cl.rider_id=?) AS likeCount
            FROM
               board_comment
            WHERE 
                comment_id = ?
            LIMIT 1
        `, [comment_id, rider_id, comment_id]);
    
        if(!comment) return resp.json({status:0, code:422, error: true, message:["Comment Id is invalid"]});
        
        let result;
        
        if(comment.likeCount){
            result = await updateRecord('comments_likes', {status}, ['rider_id', 'comment_id', 'status'], [rider_id, comment_id, status]);
        }else{
            result = await insertRecord('comments_likes', ['rider_id', 'comment_id', 'status'], [rider_id, comment_id, status]);
        }
    
        if(result.affectedRows === 0) return resp.json({status:0, code:422, error: true, message:["Failed to like comment. Please Try Again."]});
        
        const statusTxt = status == 1 ? 'Like' : 'Un-like';
        const like = await queryDB(`SELECT COUNT(*) AS count FROM comments_likes WHERE comment_id = ? AND status = ?`, [comment_id, 1]);
    
        if(comment.fcm_token){
            const riderData = comment.riderDetails.split(",");
            const href = 'disscussion_board/' + comment.board_id;
            const heading = `${statusTxt} On Comment`;
            const desc = `One ${statusTxt} on your comment by rider : ${riderData[0]}`;
            // pushNotification(riderData[1], heading, desc, 'RDRFCM', href);
        }
    
        return resp.json({
            status: 1,
            code: 200,
            error: false,
            message: [`Comment ${statusTxt} Successfully`],
            likes: like.count
        });   
    }catch(err){
        console.error('Error like comment:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};

export const replyCommentLike = async (req, resp) => {
    const {rider_id, comment_id, status} = mergeparam(req);
    const { isValid, errors } = validateFields(mergeparam(req), {rider_id: ["required"], comment_id: ["required"], status: ["required"]});
    if (![1, 2].includes(status)) return resp.json({status:0, code:422, message:"Status should be 1 or 2"});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const comment = await queryDB(`
            SELECT 
                (SELECT COUNT(id) FROM reply_comments_likes AS cl WHERE cl.comment_id=? AND cl.rider_id=?) AS likeCount
            FROM
               board_comment_reply
            WHERE 
                id = ?
            LIMIT 1
        `, [comment_id, rider_id, comment_id]);
    
        if(!comment) return resp.json({status:0, code:422, error: true, message:["Comment Id is invalid"]});
        
        let result;
        
        if(comment.likeCount){
            result = await updateRecord('reply_comments_likes', {status}, ['rider_id', 'comment_id', 'status'], [rider_id, comment_id, status]);
        }else{
            result = await insertRecord('reply_comments_likes', ['rider_id', 'comment_id', 'status'], [rider_id, comment_id, status]);
        }
    
        if(result.affectedRows === 0) return resp.json({status:0, code:422, error: true, message:["Failed to like reply comment. Please Try Again."]});
        
        const statusTxt = status == 1 ? 'Like' : 'Un-like';
        const like = await queryDB(`SELECT COUNT(*) AS count FROM reply_comments_likes WHERE comment_id = ? AND status = ?`, [comment_id, 1]);
    
        return resp.json({
            status: 1,
            code: 200,
            error: false,
            message: [`Comment ${statusTxt} Successfully`],
            likes: like.count
        });       
    }catch(err){
        console.error('Error like reply comment:', err);
        return resp.json({ status: 0, code: 500, error: true, message: ["An unexpected error occurred. Please try again."] });
    }
};