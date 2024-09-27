import {Context, Hono} from "hono";
import pool from "../db/postgres";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";
import {sign, verify} from "hono/jwt";
import {getCookie, setCookie} from "hono/cookie";
import {IUser} from "../types/IUser";
import {JWTPayload} from "hono/dist/types/utils/jwt/types";
import generateTokens from "../utils/auth/generateTokens";


const app = new Hono()

app.post("/register", async (c: Context) => {
    const userBody = await c.req.json();

    if (!userBody) {
        return c.json({message: "Username or password not provided"}, 400);
    }

    const hashedPassword: string = await Bun.password.hash(userBody.password);

    try {
        await pool.query("INSERT INTO users (first_name, last_name, password_hash, email, phone, role) VALUES ($1, $2, $3, $4, $5, $6)", [
            userBody.first_name,
            userBody.last_name,
            hashedPassword,
            userBody.email,
            userBody.phone,
            "customer"
        ])
    } catch (error: any | PostgresError) {
        const {status, message} = handleSQLError(error as PostgresError);
        return c.json({message}, status);
    }

    return c.json({message: "User created successfully"});
})

app.post("/login", async (c: Context) => {
    const userBody = await c.req.json();

    if (!userBody.email || !userBody.password) {
        return c.json({message: "Email or password not provided"}, 400);
    }

    try {
        const result = await pool.query<IUser>("SELECT * FROM users WHERE email = $1", [userBody.email]);
        const user = result.rows[0]
        if (!user) {
            return c.json({message: "User not found"}, 404);
        }

        const isValidPassword: boolean = await Bun.password.verify(userBody.password, user.password_hash as string);
        if (!isValidPassword) {
            return c.json({message: "Invalid password"}, 401);
        }

        const payload = {
            id: user.id,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 // 1 hour
        };
        const accessToken: string = await sign(payload, process.env.ACCESS_SECRET as string);
        const refreshToken: string = await sign({
            id: user.id,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
        }, process.env.REFRESH_SECRET as string);

        setCookie(c, 'accessToken', accessToken, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 // 1 hour
        });

        setCookie(c, 'refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 // 24 hours
        });

        return c.json({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            role: user.role,
        });
    } catch (error) {
        return c.json({message: (error as Error).message});
    }
})

app.post("/refresh", async (c: Context) => {
    const refreshToken = getCookie(c, "refreshToken");
    if (!refreshToken) {
        return c.json({message: "Refresh token not found"}, 400);
    }

    try {
        const payload: JWTPayload = await verify(refreshToken, process.env.REFRESH_SECRET as string);
        const tokens = await generateTokens(payload.id as string);

        setCookie(c, 'accessToken', tokens.accessToken, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60
        });

        setCookie(c, 'refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7
        });

        return c.json({message: "Tokens refreshed successfully"});
    } catch (error) {
        return c.json({message: "Invalid refresh token"}, 401);
    }
})

app.post("/logout", (c: Context) => {
    setCookie(c, "accessToken", "", {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: "strict",
        maxAge: 0
    });

    setCookie(c, "refreshToken", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 0
    });

    return c.json({message: "Logout successful"});
})

export default app