import mongoose, { Schema, models } from "mongoose";

const ChunkSchema = new Schema(
  {
    text: { type: String, required: true },
    pageNumber: { type: Number },
    embedding: { type: [Number], required: true },
  },
  { _id: false }
);

const DocumentSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number },
    pageCount: { type: Number },
    status: {
      type: String,
      enum: ["processing", "ready", "error"],
      default: "processing",
    },
    chunks: [ChunkSchema],
  },
  { timestamps: true }
);

export const Document =
  models.Document || mongoose.model("Document", DocumentSchema);
