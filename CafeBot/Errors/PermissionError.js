class PermissionError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PermissionError);
        }
    }
}

module.exports = PermissionError;