import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {
  connectTimeoutMS: 10000, // 10 seconds timeout
};

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
  console.warn("Please add your MONGODB_URI to .env.local or environment variables.");
} else {
  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect().catch(err => {
        console.error("Failed to connect to MongoDB in development:", err);
        return null;
      });
    }
    clientPromise = global._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options);
    clientPromise = client.connect().catch(err => {
      console.error("Failed to connect to MongoDB in production:", err);
      return null;
    });
  }
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;
