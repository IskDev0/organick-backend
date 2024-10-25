import {sign} from "hono/jwt";

interface Tokens {
    accessToken: string
    refreshToken: string
}

export default async function generateTokens(id: string, role: string):Promise<Tokens> {
    const accessToken: string = await sign({
        id: id,
        role: role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60
    }, process.env.ACCESS_SECRET as string)
    const refreshToken: string = await sign({
        id: id,
        role: role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
    }, process.env.REFRESH_SECRET as string)
    return {
        accessToken,
        refreshToken
    }
}