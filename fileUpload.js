import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const handleFileUpload = (dirName, fileField, maxFiles = 10, isMultiple = true, allowedFileTypes = ['png', 'jpeg', 'jpg']) => {
    const destinationPath = path.join('uploads', dirName);
    let errorMsg = [];

    // Ensure the destination path exists
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
    }

    // Configure multer storage
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
    
    // File filter for validation
    const fileFilter = (req, file, cb) => {
        const fileExtension = path.extname(file.originalname).slice(1).toLowerCase();
        if (!allowedFileTypes.includes(fileExtension)) {
            errorMsg.push(`Invalid File Type! Only ${allowedFileTypes.join(', ')} file types are allowed.`);
            // return cb(null, false);
        }
        cb(null, true);
    };

    // Initialize multer with storage and limits
    const upload = multer({ 
        storage: storage,
        limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
        fileFilter: fileFilter
    });

    return (req, res) => {
        return new Promise((resolve, reject) => {
            const uploadMethod = isMultiple ? upload.array(fileField, maxFiles) : upload.single(fileField);

            uploadMethod(req, res, (err) => {
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        errorMsg.push(`File size should not exceed 10 MB.`);
                    }
                } 
                if (errorMsg.length > 0) {
                    return reject(new Error(JSON.stringify({ status: 0, code: 422, message: errorMsg })));
                }
                if (err) {
                    return reject(new Error(JSON.stringify({ status: 0, code: 500, message: 'An unknown error occurred.' })));
                }             

                // If everything is successful, resolve with the files
                resolve(req.files || [req.file]);
            });
        });
    };
};
