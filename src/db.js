import { MongoClient } from "mongodb";

export async function connectDatabase() {
  const readUri = process.env.MONGO_READ_URI;
  const writeUri = process.env.MONGO_WRITE_URI;
  const studentId = process.env.STUDENT_ID;

  if (!readUri || !writeUri || !studentId) {
    throw new Error(
      "Thiếu MONGO_READ_URI, MONGO_WRITE_URI hoặc STUDENT_ID trong .env"
    );
  }

  const readClient = new MongoClient(readUri);
  const writeClient = new MongoClient(writeUri);

  await Promise.all([
    readClient.connect(),
    writeClient.connect(),
  ]);

  const databaseName = `DB_${studentId}`;

  return {
    readBooks: readClient.db(databaseName).collection("books"),
    writeBooks: writeClient.db(databaseName).collection("books"),
  };
}