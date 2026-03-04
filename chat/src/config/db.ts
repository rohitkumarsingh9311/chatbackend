import mongoose from "mongoose";

const connectDb = async () => {
  const url = process.env.MONGO_URI;
  if (!url) {
    throw new Error("MONGO_URI is not define in enviornement variable");
  }
  try {
    await mongoose.connect(url, {
      dbName: "chatappmicroserviceApp",
    });
    console.log("connected to mongoDB");
  } catch (error) {
    console.error("failed to connect to mongo db", error);
    process.exit(1);
  }
};
export default connectDb;
