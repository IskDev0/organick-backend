import {Hono} from 'hono'
import {cors} from 'hono/cors'
import auth from './routes/auth'

const app = new Hono().basePath("/api/v1")

app.use("*", cors({
  origin: [process.env.PORT as string, "http://localhost:3000"],
  credentials: true,
}))

app.route("/auth", auth)

export default {
  port: process.env.PORT,
  fetch: app.fetch,
}