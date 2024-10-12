import {Hono} from 'hono'
import {cors} from 'hono/cors'
import auth from './routes/auth'
import products from "./routes/products";
import reviews from "./routes/reviews";
import news from "./routes/news";

const app = new Hono().basePath("/api/v1")

app.use("*", cors({
  origin: [process.env.FRONTEND_URL as string, "http://localhost:3000"],
  credentials: true,
}))

//TODO: Extract sql queries to db folder

app.route("/auth", auth)
app.route("/products", products)
app.route("/reviews", reviews)
app.route("/news", news)

export default {
  port: process.env.PORT,
  fetch: app.fetch,
}