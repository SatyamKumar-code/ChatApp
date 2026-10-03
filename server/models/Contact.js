import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: false,
            trim: true,
            default: "",
        },
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        contactUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

    }
    , { timestamps: true }
);

contactSchema.index({ owner: 1, phone: 1 }, { unique: true });

const Contact = mongoose.model("Contact", contactSchema);

export default Contact;