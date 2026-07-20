const ApiError = require("../utils/ApiError");
const { sendError } = require("../utils/response");

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode ? error.statusCode : 500;
    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, false, err.stack);
  }

  const { statusCode, message } = error;

  if (process.env.NODE_ENV === "development") {
    console.error(`[ERROR] ${statusCode} - ${message}`);
    console.error(error.stack);
  }

  sendError(res, statusCode, message, process.env.NODE_ENV === "development" ? { stack: error.stack } : null);
};

module.exports = errorHandler;
