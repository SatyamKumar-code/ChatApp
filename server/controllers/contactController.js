import Contact from "../models/Contact.js";
import User from "../models/User.js";
import { isUserOnline } from "../socket/socketServer.js";

const getContacts = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const currentUser = await User.findById(currentUserId).select("blockedUsers");
        const myBlocked = (currentUser?.blockedUsers || []).map((id) => (id?._id || id).toString());

        const contacts = await Contact.find({
            owner: currentUserId,
        })
            .populate("contactUser", "name phone profilePicture isOnline lastSeen blockedUsers")
            .sort({ name: 1 });

        const result = contacts.map((contact) => {
            const cUser = contact.contactUser;
            let formattedUser = null;

            if (cUser) {
                const isBlockedByOther = Boolean(
                    cUser.blockedUsers &&
                    cUser.blockedUsers.some(
                        (bId) => (bId?._id || bId).toString() === currentUserId.toString()
                    )
                );
                const isBlockedByMe = myBlocked.includes(cUser._id.toString());
                const activeOnline = !isBlockedByOther && isUserOnline(cUser._id);

                formattedUser = {
                    _id: cUser._id,
                    name: cUser.name,
                    phone: cUser.phone,
                    profilePicture: isBlockedByOther ? "" : (cUser.profilePicture || ""),
                    isOnline: Boolean(activeOnline),
                    lastSeen: isBlockedByOther ? null : cUser.lastSeen,
                    isBlockedByOther,
                    isBlocked: isBlockedByMe,
                };
            }

            return {
                _id: contact._id,
                name: contact.name,
                phone: contact.phone,
                registered: Boolean(cUser),
                user: formattedUser,
            };
        });

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
    }
};

const addContact = async (req, res) => {
    try {
        const { name, phone } = req.body;
        const currentUserId = req.user._id;

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
            owner: currentUserId,
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
            owner: currentUserId,
            name: contactName,
            phone: normalizedPhone,
            contactUser: registeredUser ? registeredUser._id : null,
        });

        await contact.save();

        // Populate the contactUser field for the response
        await contact.populate("contactUser", "name phone profilePicture isOnline lastSeen blockedUsers");

        const cUser = contact.contactUser;
        let formattedUser = null;
        if (cUser) {
            const isBlockedByOther = Boolean(
                cUser.blockedUsers &&
                cUser.blockedUsers.some(
                    (bId) => (bId?._id || bId).toString() === currentUserId.toString()
                )
            );

            const activeOnline = !isBlockedByOther && isUserOnline(cUser._id);
            formattedUser = {
                _id: cUser._id,
                name: cUser.name,
                phone: cUser.phone,
                profilePicture: isBlockedByOther ? "" : (cUser.profilePicture || ""),
                isOnline: Boolean(activeOnline),
                lastSeen: isBlockedByOther ? null : cUser.lastSeen,
                isBlockedByOther,
            };
        }

        res.status(201).json({
            success: true,
            error: false,
            message: "Contact added successfully",
            contact: {
                _id: contact._id,
                name: contact.name,
                phone: contact.phone,
                registered: Boolean(contact.contactUser),
                user: formattedUser,
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
