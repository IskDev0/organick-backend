export interface IUser {
    id: number,
    first_name: string,
    last_name: string,
    password_hash: string,
    email: string,
    phone: string,
    role: string,
    city: string,
    street: string,
    zipcode: string,
    created_at: Date
}