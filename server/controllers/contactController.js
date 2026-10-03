import Contact from "../models/Contact.js";
import User from "../models/User.js";

const getContacts = async (req, res) => {
    try {
        const contacts = await Contact.find({
            owner: req.user._id
        })
            .populate("contactUser", "name phone profilePic isOnline lastSeen")
            .sort({ name: 1 });

        const result = contacts.map((contact) => ({
            _id: contact._id,
            name: contact.name,
            phone: contact.phone,
            registered: Boolean(contact.contactUser),
            user: contact.contactUser || null,
        }));

        res.json({
            success: true,
            error: false,
            contacts: result,
        });
    } catch (error) {
        console.error("Error fetching contacts:", error);
        res.status(500).json({
            success: false,
            error: true,
            message: "Server error while fetching contacts",
        });
    };
}

const addContact = async (req, res) => {
    try {
        const { name, phone } = req.body;

        if (!name?.trim() || !phone?.trim()) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Name and phone are required",
            });
        }

        // Example: Indian Mobile numbers
        const normalizedPhone = phone.replace(/\D/g, ''); // Remove non-digit characters

        if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Invalid phone number format",
            });
        }

        const existing = await Contact.findOne({
            owner: req.user._id,
            phone: normalizedPhone,
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                error: true,
                message: "Contact with this phone number already exists",
            });
        }

        const registeredUser = await User.findOne({
            phone: normalizedPhone,
        }).select("_id");

        const contact = new Contact({
            owner: req.user._id,
            name: name.trim(),
            phone: normalizedPhone,
            contactUser: registeredUser ? registeredUser._id : null,
        });

        res.status(201).json({
            success: true,
            error: false,
            message: "Contact added successfully",
            contact: {
                _id: contact._id,
                name: contact.name,
                phone: contact.phone,
                registered: Boolean(contact.contactUser),
                user: contact.contactUser?._id || null,
            },
        });
    } catch (error) {

        console.error("Error adding contact:", error.message);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: true,
                message: "Contact with this phone number already exists",
            });
        }

        res.status(500).json({
            success: false,
            error: true,
            message: "Server error while adding contact",
        });
    }

};

export { getContacts, addContact };
