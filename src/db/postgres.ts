import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
    host: process.env.POSTGRESQL_HOST,
    user: process.env.POSTGRESQL_USERNAME,
    port: +!process.env.POSTGRESQL_PORT,
    password: process.env.POSTGRESQL_PASSWORD,
    database: process.env.POSTGRESQL_DATABASE,
})

export default pool