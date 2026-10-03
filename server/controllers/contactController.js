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

        // Phone is required, name is optional (will be fetched from registered user or set as phone number)
        if (!phone?.trim()) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Phone number is required",
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

        // Don't allow adding own number
        if (normalizedPhone === req.user.phone) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "You cannot add your own number",
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

        // Check if user is registered on the app
        const registeredUser = await User.findOne({
            phone: normalizedPhone,
        }).select("_id name");

        // If no name provided, use registered user's name or phone number as fallback
        let contactName = name?.trim();
        if (!contactName) {
            contactName = registeredUser
                ? registeredUser.name
                : normalizedPhone;
        }

        const contact = new Contact({
            owner: req.user._id,
            name: contactName,
            phone: normalizedPhone,
            contactUser: registeredUser ? registeredUser._id : null,
        });

        await contact.save();

        // Populate the contactUser field for the response
        await contact.populate("contactUser", "name phone profilePic isOnline lastSeen");

        res.status(201).json({
            success: true,
            error: false,
            message: "Contact added successfully",
            contact: {
                _id: contact._id,
                name: contact.name,
                phone: contact.phone,
                registered: Boolean(contact.contactUser),
                user: contact.contactUser || null,
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
