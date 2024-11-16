import {Hono} from 'hono'
import {cors} from 'hono/cors'
import { logger } from "hono/logger";
import auth from './routes/auth'
import products from "./routes/products";
import reviews from "./routes/reviews";
import news from "./routes/news";
import testimonials from "./routes/testimonials";
import subscription from "./routes/subscription";
import orders from "./routes/orders";
import users from "./routes/users";

const app = new Hono().basePath("/api/v1")

app.use("*", cors({
  origin: [process.env.FRONTEND_URL as string, "http://localhost:3000"],
  credentials: true,
}))
app.use(logger())

//TODO: Extract sql queries to db folder

app.route("/auth", auth)
app.route("/products", products)
app.route("/reviews", reviews)
app.route("/news", news)
app.route("/testimonials", testimonials)
app.route("/subscription", subscription)
app.route("/orders", orders)
app.route("/users", users)

export default {
  port: process.env.PORT,
  fetch: app.fetch,
}