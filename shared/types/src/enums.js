"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemStatusLevel = exports.BackendType = void 0;
var BackendType;
(function (BackendType) {
    BackendType["Go"] = "go";
    BackendType["Rust"] = "rust";
    BackendType["TypeScript"] = "typescript";
})(BackendType || (exports.BackendType = BackendType = {}));
var SystemStatusLevel;
(function (SystemStatusLevel) {
    SystemStatusLevel["Online"] = "online";
    SystemStatusLevel["Degraded"] = "degraded";
    SystemStatusLevel["Offline"] = "offline";
})(SystemStatusLevel || (exports.SystemStatusLevel = SystemStatusLevel = {}));
