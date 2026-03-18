import User from "../models/user.model.js";

// GET CURRENT USER
export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: "unauthorized" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "user not found" });
        }

        return res.status(200).json(user);

    } catch (error) {
        return res.status(500).json({
            message: `get current user error ${error.message}`
        });
    }
};

// UPDATE USER LOCATION
export const updateUserLocation = async (req, res) => {
    try {
        const { lat, lon } = req.body;

        if (!req.userId) {
            return res.status(401).json({ message: "unauthorized" });
        }

        if (
            lat === undefined ||
            lon === undefined ||
            isNaN(lat) ||
            isNaN(lon)
        ) {
            return res.status(400).json({ message: "valid lat and lon required" });
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            {
                location: {
                    type: "Point",
                    coordinates: [Number(lon), Number(lat)]
                }
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: "user not found" });
        }

        return res.status(200).json({
            message: "location updated",
            location: user.location
        });

    } catch (error) {
        return res.status(500).json({
            message: `update location user error ${error.message}`
        });
    }
};