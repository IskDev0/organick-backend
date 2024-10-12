import PostgresError from "../types/PostgresError";
import type {StatusCode} from "hono/dist/types/utils/http-status";

//TODO: Add more error messages
const errorMessages:Record<string | number, string> = {
    '23505': 'Ошибка: запись с указанным email уже существует.',
};

export default function handleSQLError(error:PostgresError) {
    const message = errorMessages[error.code] || error;

    const status = (() => {
        switch (error.code) {
            case '23505':
            case '23503':
                return 400;
            case '22P02':
                return 422;
            default:
                return 500;
        }
    })();

    return {
        status: status as StatusCode,
        message,
    };
}

