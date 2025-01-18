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
import other from "./routes/other";
import applications from "./routes/applications";
import analytics from "./routes/analytics";

const app = new Hono().basePath("/api/v1")

app.use("*", cors({
  origin: [process.env.FRONTEND_URL as string, "http://localhost:3000"],
  credentials: true,
}))
app.use(logger())

app.route("/auth", auth)
app.route("/products", products)
app.route("/reviews", reviews)
app.route("/news", news)
app.route("/testimonials", testimonials)
app.route("/subscription", subscription)
app.route("/orders", orders)
app.route("/users", users)
app.route("/other", other)
app.route("/applications", applications)
app.route("/analytics", analytics)

export default {
  port: process.env.PORT,
  fetch: app.fetch,
}