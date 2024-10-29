import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const handleFileUpload = (dirName, fileFields, requiredFields = [], maxFiles = 10, allowedFileTypes = ['png', 'jpeg', 'jpg']) => {
    // const destinationPath = path.join('uploads', dirName);
    // let errorMsg = {};

    // if (!fs.existsSync(destinationPath)) {
    //     fs.mkdirSync(destinationPath, { recursive: true });
    // }

    // const storage = multer.diskStorage({
    //     destination: (req, file, cb) => {
    //         cb(null, destinationPath);
    //     },
    //     filename: (req, file, cb) => {
    //         const uniqueSuffix = Date.now();
    //         const filename = `${uniqueSuffix}-${file.originalname}`;
    //         cb(null, filename);
    //     }
    // });

    // const fileFilter = (req, file, cb) => {
    //     const fileExtension = path.extname(file.originalname).slice(1).toLowerCase();
    //     if (!allowedFileTypes.includes(fileExtension)) {
    //         errorMsg[file.fieldname] = `Invalid File Type! Only ${allowedFileTypes.join(', ')} file types are allowed.`;
    //         return cb(null, false); // Reject file
    //     }
    //     cb(null, true); // Accept file
    // };

    // const upload = multer({ 
    //     storage: storage,
    //     limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    //     fileFilter: fileFilter
    // });

    // return (req, res, next) => {
    //     const multerFields = fileFields.map(field => ({
    //         name: field,
    //         maxCount: maxFiles
    //     }));

    //     const uploadMethod = upload.fields(multerFields);
        
    //     uploadMethod(req, res, (err) => {
    //         if (err) {
    //             if (err instanceof multer.MulterError) {
    //                 if (err.code === 'LIMIT_FILE_SIZE') {
    //                     errorMsg['limit'] = 'File size should not exceed 10 MB.';
    //                 } else {
    //                     errorMsg['multer'] = err.message;
    //                 }
    //             } else {
    //                 errorMsg['unknown'] = 'An unknown error occurred: ' + err.message;
    //             }
    //             return res.status(422).json({ status: 0, code: 422, message: errorMsg });
    //         }

    //         // requiredFields.forEach(field => {
    //         //     // console.log(`Checking required field: ${field}`, req.files[field], 'CCONDITION: ', !req.files[field] || req.files[field].length === 0);
    //         //     if (!req.files[field] || req.files[field].length === 0) {
    //         //         errorMsg[field] = `${field} is required.`;
    //         //     }
    //         // });

    //         if (Object.keys(errorMsg).length > 0) {
    //             return res.status(422).json({ status: 0, code: 422, message: errorMsg });
    //         }

    //         req.uploadedFiles = req.files || [];
    //         next();
    //     });
    // };



    const destinationPath = path.join('uploads', dirName);
    let errorMsg = {};

    // Ensure the destination directory exists
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
    }

    // Configure multer storage settings
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

    // File filter to check file extension
    const fileFilter = (req, file, cb) => {
        const fileExtension = path.extname(file.originalname).slice(1).toLowerCase();
        if (!allowedFileTypes.includes(fileExtension)) {
            // Reject file and pass an error to the callback
            return cb(new Error(`Invalid File Type! Only ${allowedFileTypes.join(', ')} file types are allowed.`), false);
        }
        cb(null, true); // Accept file if the type is valid
    };

    // Initialize multer upload with file filter, storage, and size limit
    const upload = multer({ 
        storage: storage,
        limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB file size limit
        fileFilter: fileFilter
    });

    // Middleware function to handle file upload
    return (req, res, next) => {
        const multerFields = fileFields.map(field => ({
            name: field,
            maxCount: maxFiles
        }));

        const uploadMethod = upload.fields(multerFields);

        // Execute the upload
        uploadMethod(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    // Handle multer-specific errors
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        errorMsg['limit'] = 'File size should not exceed 10 MB.';
                    } else {
                        errorMsg['multer'] = err.message;
                    }
                } else {
                    // Handle custom errors from fileFilter
                    errorMsg[err.field || 'unknown'] = err.message || 'An unknown error occurred.';
                }
                return res.status(422).json({ status: 0, code: 422, message: errorMsg });
            }

            // Check if required fields are provided in the request
            // requiredFields.forEach(field => {
            //     if (!req.files[field] || req.files[field].length === 0) {
            //         errorMsg[field] = `${field} is required.`;
            //     }
            // });

            if (Object.keys(errorMsg).length > 0) {
                return res.status(422).json({ status: 0, code: 422, message: errorMsg });
            }

            req.uploadedFiles = req.files || [];
            next();
        });
    };
};
