import logger from "../logger.js";

export const errorHandler = (err, req, res, next) => {
    // logger.error(`Error: ${err}`);
    // console.error(err);

    let arrE = err.stack.split(",")
    logger.error(` ${req.originalUrl} - ${err} at (${arrE[0].split("at")[1]})`);

    const statusCode = err.statusCode || 500;
    const message    = "Oops! There is something went wrong! Please Try Again.";

    res.status(statusCode).json({
        status  : 0,
        code    : statusCode,
        message : message
    });
};
