import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const handleFileUpload = (dirName, fileField, maxFiles = 10, isMultiple = true) => {
    const destinationPath = path.join('uploads', dirName);

    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, destinationPath);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now();
            const filename = `${uniqueSuffix}-${file.originalname}`;
            cb(null, filename);
        }
    });

    const upload = multer({ 
        storage: storage,
        limits: { fileSize: 10 * 1024 * 1024 }
    });

    return (req, res) => {
        return new Promise((resolve, reject) => {
            const uploadMethod = isMultiple ? upload.array(fileField, maxFiles) : upload.single(fileField);

            uploadMethod(req, res, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(req.files || [req.file]);
                }
            });
        });
    };
};
