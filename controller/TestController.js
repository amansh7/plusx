
import path from 'path';
import { fileURLToPath } from 'url';
import transporter from '../mailer.js';
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const bulkEmailSend = async (req, resp) => {
    const htmlFilePath = path.join(__dirname, "PlusXEmailer.html");
    const emailHtml = fs.readFileSync(htmlFilePath, "utf8");
    try { 
        await transporter.sendMail({
            from    : `"Shunya Ekai" <ravimishra2042@gmail.com>`,
            to      : 'ravi@shunyaekai.tech',
            subject : 'Test mail - PlusX Electric App',
            html    : emailHtml,
        });
        return resp.json({
            message  : "Mail send successfully",
        });

    } catch(err) {
        console.log('Error in sending mail', err);
        return resp.json({
            message  : err,
        });
        
    }
};