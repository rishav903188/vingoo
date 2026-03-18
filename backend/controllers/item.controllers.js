import Item from "../models/item.model.js";
import Shop from "../models/shop.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";

// ADD ITEM
export const addItem = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "unauthorized" });
        }

        const { name, category, foodType, price } = req.body;

        let image;
        if (req.file) {
            try {
                image = await uploadOnCloudinary(req.file.path);
            } catch {
                return res.status(500).json({ message: "image upload failed" });
            }
        }

        const shop = await Shop.findOne({ owner: req.userId });

        if (!shop) {
            return res.status(404).json({ message: "shop not found" });
        }

        const item = await Item.create({
            name,
            category,
            foodType,
            price,
            image,
            shop: shop._id
        });

        shop.items.push(item._id);
        await shop.save();

        await shop.populate({
            path: "items",
            options: { sort: { updatedAt: -1 } }
        });

        return res.status(201).json(shop);

    } catch (error) {
        return res.status(500).json({
            message: `add item error ${error.message}`
        });
    }
};

// EDIT ITEM
export const editItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { name, category, foodType, price } = req.body;

        let updateData = { name, category, foodType, price };

        if (req.file) {
            try {
                const image = await uploadOnCloudinary(req.file.path);
                updateData.image = image;
            } catch {
                return res.status(500).json({ message: "image upload failed" });
            }
        }

        const item = await Item.findByIdAndUpdate(itemId, updateData, { new: true });

        if (!item) {
            return res.status(404).json({ message: "item not found" });
        }

        const shop = await Shop.findOne({ owner: req.userId }).populate({
            path: "items",
            options: { sort: { updatedAt: -1 } }
        });

        return res.status(200).json(shop);

    } catch (error) {
        return res.status(500).json({
            message: `edit item error ${error.message}`
        });
    }
};

// GET ITEM BY ID
export const getItemById = async (req, res) => {
    try {
        const { itemId } = req.params;

        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).json({ message: "item not found" });
        }

        return res.status(200).json(item);

    } catch (error) {
        return res.status(500).json({
            message: `get item error ${error.message}`
        });
    }
};

// DELETE ITEM
export const deleteItem = async (req, res) => {
    try {
        const { itemId } = req.params;

        const item = await Item.findByIdAndDelete(itemId);

        if (!item) {
            return res.status(404).json({ message: "item not found" });
        }

        const shop = await Shop.findOneAndUpdate(
            { owner: req.userId },
            { $pull: { items: item._id } },
            { new: true }
        ).populate("items");

        if (!shop) {
            return res.status(404).json({ message: "shop not found" });
        }

        return res.status(200).json(shop);

    } catch (error) {
        return res.status(500).json({
            message: `delete item error ${error.message}`
        });
    }
};

// GET ITEMS BY CITY
export const getItemByCity = async (req, res) => {
    try {
        const { city } = req.params;

        if (!city) {
            return res.status(400).json({ message: "city is required" });
        }

        const shops = await Shop.find({
            city: { $regex: new RegExp(`^${city}$`, "i") }
        });

        if (!shops || shops.length === 0) {
            return res.status(404).json({ message: "shops not found" });
        }

        const shopIds = shops.map(s => s._id);

        const items = await Item.find({
            shop: { $in: shopIds }
        });

        return res.status(200).json(items);

    } catch (error) {
        return res.status(500).json({
            message: `get item by city error ${error.message}`
        });
    }
};

// GET ITEMS BY SHOP
export const getItemsByShop = async (req, res) => {
    try {
        const { shopId } = req.params;

        const shop = await Shop.findById(shopId).populate("items");

        if (!shop) {
            return res.status(404).json({ message: "shop not found" });
        }

        return res.status(200).json({
            shop,
            items: shop.items
        });

    } catch (error) {
        return res.status(500).json({
            message: `get item by shop error ${error.message}`
        });
    }
};

// SEARCH ITEMS
export const searchItems = async (req, res) => {
    try {
        const { query, city } = req.query;
        console.log(`[DEBUG] Backend search requested - Query: "${query}", City: "${city}"`);

        if (!query) {
            console.log(`[DEBUG] Missing search query parameter, sending 400`);
            return res.status(400).json({
                message: "query text is required"
            });
        }

        let shopFilter = {};
        if (city && city !== "undefined" && city !== "null") {
            shopFilter.city = { $regex: new RegExp(`^${city}$`, "i") };
        }

        const shops = await Shop.find(shopFilter);

        if (!shops || shops.length === 0) {
            console.log(`[DEBUG] No shops found matching filters, returning empty array`);
            return res.status(200).json([]);
        }

        const shopIds = shops.map(s => s._id);

        const items = await Item.find({
            shop: { $in: shopIds },
            $or: [
                { name: { $regex: query, $options: "i" } },
                { category: { $regex: query, $options: "i" } }
            ]
        }).populate("shop", "name image");

        console.log(`[DEBUG] Backend search returning ${items.length} items for query "${query}"`);
        return res.status(200).json(items);

    } catch (error) {
        console.log(`[DEBUG] Search crash:`, error);
        return res.status(500).json({
            message: `search item error ${error.message}`
        });
    }
};

// RATING
export const rating = async (req, res) => {
    try {
        const { itemId, rating } = req.body;

        if (!itemId || !rating) {
            return res.status(400).json({
                message: "itemId and rating is required"
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                message: "rating must be between 1 to 5"
            });
        }

        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).json({ message: "item not found" });
        }

        const newCount = item.rating.count + 1;
        const newAverage =
            (item.rating.average * item.rating.count + rating) / newCount;

        item.rating.count = newCount;
        item.rating.average = newAverage;

        await item.save();

        return res.status(200).json({
            rating: item.rating
        });

    } catch (error) {
        return res.status(500).json({
            message: `rating error ${error.message}`
        });
    }
};