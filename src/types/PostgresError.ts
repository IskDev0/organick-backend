export default interface PostgresError {
    name: string;
    severity: string;
    code: string;
    detail?: string;
    hint?: string;
    position?: string;
    internalQuery?: string;
    where?: string;
    schema?: string;
    table?: string;
    column?: string;
    dataType?: string;
    constraint?: string;
    file?: string;
    line?: string;
    routine?: string;
}