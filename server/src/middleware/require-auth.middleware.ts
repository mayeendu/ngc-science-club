
import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { fromNodeHeaders } from "better-auth/node";
import type { createAuth } from "../lib/auth.js";

type Auth = ReturnType<typeof createAuth>;

export function requireAuth(auth: Auth) {
    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const session = await auth.api.getSession({
                headers: fromNodeHeaders(req.headers),
            });

            if (!session) {
                res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
                return;
            }

            res.locals.user = session.user;
            res.locals.session = session.session;

            next();
        } catch (error) {
            next(error);
        }
    };
}
