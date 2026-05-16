import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.MONGODB_DB || "pq_jwttest";

let client;
let db;

export async function connectDb() {
  if (db) return db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);

  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("items").createIndex({ userId: 1, createdAt: -1 });

  return db;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}

function users() {
  return db.collection("users");
}

function items() {
  return db.collection("items");
}

function toPublicUser(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    username: doc.username,
    created_at: doc.createdAt.toISOString(),
  };
}

function toPublicItem(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body ?? "",
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString(),
  };
}

function parseObjectId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export async function findUserByUsername(username) {
  return users().findOne({ username });
}

export async function findUserById(id) {
  const oid = parseObjectId(id);
  if (!oid) return null;
  const doc = await users().findOne(
    { _id: oid },
    { projection: { passwordHash: 0 } },
  );
  return toPublicUser(doc);
}

export async function createUser(username, passwordHash) {
  const now = new Date();
  const { insertedId } = await users().insertOne({
    username,
    passwordHash,
    createdAt: now,
  });
  return findUserById(insertedId.toString());
}

export async function listItems(userId) {
  const docs = await items()
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toPublicItem);
}

export async function getItem(id, userId) {
  const oid = parseObjectId(id);
  if (!oid) return null;
  const doc = await items().findOne({ _id: oid, userId });
  return toPublicItem(doc);
}

export async function createItem(userId, title, body) {
  const now = new Date();
  const { insertedId } = await items().insertOne({
    userId,
    title,
    body: body ?? "",
    createdAt: now,
    updatedAt: now,
  });
  return getItem(insertedId.toString(), userId);
}

export async function updateItem(id, userId, title, body) {
  const oid = parseObjectId(id);
  if (!oid) return null;

  const now = new Date();
  const result = await items().findOneAndUpdate(
    { _id: oid, userId },
    { $set: { title, body: body ?? "", updatedAt: now } },
    { returnDocument: "after" },
  );

  return toPublicItem(result);
}

export async function deleteItem(id, userId) {
  const oid = parseObjectId(id);
  if (!oid) return false;
  const result = await items().deleteOne({ _id: oid, userId });
  return result.deletedCount > 0;
}
