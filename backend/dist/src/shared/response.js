"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.error = error;
const uuid_1 = require("uuid");
function success(res, data, status = 200, pagination) {
    return res.status(status).json({
        data,
        meta: { requestId: (0, uuid_1.v4)(), ...(pagination ? { pagination } : {}) },
    });
}
function error(res, code, message, status, details, requestId) {
    return res.status(status).json({
        error: { code, message, ...(details ? { details } : {}), requestId: requestId || (0, uuid_1.v4)() },
    });
}
