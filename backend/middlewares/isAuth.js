import jwt from "jsonwebtoken";

const isAuth = async (req, res, next) => {
    try {
        // token from cookie OR header
        const token =
            req.cookies?.token ||
            req.headers?.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                message: "unauthorized: token missing"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.userId = decoded.userId;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "unauthorized: invalid token",
            error: error.message
        });
    }
};

export default isAuth;