import mongoose, { Schema, models } from "mongoose";

const MessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: [
      {
        text: { type: String },
        pageNumber: { type: Number },
      },
    ],
  },
  { _id: false, timestamps: true }
);

const ConversationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    messages: [MessageSchema],
  },
  { timestamps: true }
);

export const Conversation =
  models.Conversation || mongoose.model("Conversation", ConversationSchema);
