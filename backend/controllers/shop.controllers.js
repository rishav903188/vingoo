import Shop from "../models/shop.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";

// CREATE / EDIT SHOP
export const createEditShop = async (req, res) => {
    try {
        const { name, city, state, address } = req.body;

        if (!req.userId) {
            return res.status(401).json({ message: "unauthorized" });
        }

        let image;

        if (req.file) {
            try {
                image = await uploadOnCloudinary(req.file.path);
            } catch (err) {
                return res.status(500).json({ message: "image upload failed" });
            }
        }

        let shop = await Shop.findOne({ owner: req.userId });

        if (!shop) {
            // CREATE
            shop = await Shop.create({
                name,
                city,
                state,
                address,
                image,
                owner: req.userId
            });
        } else {
            // UPDATE (image overwrite safe)
            const updateData = {
                name,
                city,
                state,
                address,
                owner: req.userId
            };

            if (image) {
                updateData.image = image;
            }

            shop = await Shop.findByIdAndUpdate(shop._id, updateData, {
                new: true
            });
        }

        await shop.populate("owner items");

        return res.status(200).json(shop);

    } catch (error) {
        return res.status(500).json({
            message: `create shop error ${error.message}`
        });
    }
};

// GET MY SHOP
export const getMyShop = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "unauthorized" });
        }

        const shop = await Shop.findOne({ owner: req.userId })
            .populate("owner")
            .populate({
                path: "items",
                options: { sort: { updatedAt: -1 } }
            });

        if (!shop) {
            return res.status(404).json({ message: "shop not found" });
        }

        return res.status(200).json(shop);

    } catch (error) {
        return res.status(500).json({
            message: `get my shop error ${error.message}`
        });
    }
};

// GET SHOP BY CITY
export const getShopByCity = async (req, res) => {
    try {
        const { city } = req.params;

        if (!city) {
            return res.status(400).json({ message: "city is required" });
        }

        const shops = await Shop.find({
            city: { $regex: new RegExp(`^${city}$`, "i") }
        }).populate("items");

        if (!shops || shops.length === 0) {
            return res.status(404).json({ message: "shops not found" });
        }

        return res.status(200).json(shops);

    } catch (error) {
        return res.status(500).json({
            message: `get shop by city error ${error.message}`
        });
    }
};