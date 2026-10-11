import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const app = express();
app.use(cors());
app.use(express.json());
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));
const upload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, cb) => cb(null, uploadsDir), filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname).slice(0,10)}`) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/"))
});

let tables = [
  { id: "table-1", number: "1", label: "Table 1", createdAt: new Date().toISOString() },
  { id: "table-2", number: "2", label: "Table 2", createdAt: new Date().toISOString() },
  { id: "table-3", number: "3", label: "Table 3", createdAt: new Date().toISOString() }
];
let orders = [];
let menu = [
  { id: "m1", name: "Paneer Tikka", category: "Starters", price: 220, imageUrl: "" },
  { id: "m2", name: "Veg Hakka Noodles", category: "Main course", price: 180, imageUrl: "" },
  { id: "m3", name: "Paneer Butter Masala", category: "Main course", price: 260, imageUrl: "" },
  { id: "m4", name: "Butter Naan", category: "Breads", price: 45, imageUrl: "" },
  { id: "m5", name: "Jeera Rice", category: "Rice", price: 140, imageUrl: "" },
  { id: "m6", name: "Masala Chaas", category: "Drinks", price: 50, imageUrl: "" }
];

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/menu", (_req, res) => res.json(menu));
app.post("/api/menu", upload.single("photo"), (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const category = String(req.body?.category ?? "Other").trim() || "Other";
  const price = Number(req.body?.price);
  if (!name || name.length > 100 || !Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Enter a dish name and valid price." });
  const item = { id: randomUUID(), name, category, price, imageUrl: req.file ? `/uploads/${req.file.filename}` : String(req.body?.imageUrl ?? "").trim() };
  menu.push(item);
  res.status(201).json(item);
});
app.patch("/api/menu/:id", upload.single("photo"), (req, res) => {
  const item = menu.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Menu item not found." });
  const name = String(req.body?.name ?? item.name).trim();
  const price = Number(req.body?.price ?? item.price);
  if (!name || !Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Enter a valid dish name and price." });
  item.name = name; item.category = String(req.body?.category ?? item.category).trim() || "Other"; item.price = price;
  if (req.file) item.imageUrl = `/uploads/${req.file.filename}`;
  else if (req.body?.imageUrl !== undefined) item.imageUrl = String(req.body.imageUrl).trim();
  res.json(item);
});
app.delete("/api/menu/:id", (req, res) => { menu = menu.filter(m => m.id !== req.params.id); res.json({ ok: true }); });
app.get("/api/tables", (_req, res) => res.json(tables));
app.post("/api/tables", (req, res) => {
  const number = String(req.body?.number ?? "").trim();
  if (!number || number.length > 12) return res.status(400).json({ error: "Enter a valid table number." });
  if (tables.some(t => t.number.toLowerCase() === number.toLowerCase())) {
    return res.status(409).json({ error: "That table number already exists." });
  }
  const table = { id: randomUUID(), number, label: `Table ${number}`, createdAt: new Date().toISOString() };
  tables.push(table);
  res.status(201).json(table);
});
app.get("/api/orders", (_req, res) => res.json([...orders].sort((a,b) => b.createdAt.localeCompare(a.createdAt))));
app.post("/api/orders", (req, res) => {
  const tableNumber = String(req.body?.tableNumber ?? "").trim();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!tables.some(t => t.number === tableNumber)) return res.status(400).json({ error: "Invalid table QR. Ask staff for help." });
  if (!items.length) return res.status(400).json({ error: "Add at least one item." });
  const normalized = [];
  for (const item of items) {
    const product = menu.find(m => m.id === item.id);
    const qty = Math.floor(Number(item.qty));
    if (product && qty > 0 && qty <= 50) normalized.push({ id: product.id, name: product.name, price: product.price, qty });
  }
  if (!normalized.length) return res.status(400).json({ error: "No valid order items." });
  const order = {
    id: randomUUID(), orderNo: String(Date.now()).slice(-6), tableNumber,
    items: normalized, total: normalized.reduce((sum, i) => sum + i.price * i.qty, 0),
    status: "New", paymentStatus: "Unpaid", createdAt: new Date().toISOString()
  };
  orders.push(order);
  res.status(201).json(order);
});
app.patch("/api/orders/:id", (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found. ok" });
  const { status, paymentStatus } = req.body ?? {};
  if (status && ["New", "Preparing", "Ready", "Served"].includes(status)) order.status = status;
  if (paymentStatus && ["Unpaid", "Paid"].includes(paymentStatus)) order.paymentStatus = paymentStatus;
  res.json(order);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`QR Hotel API running at http://localhost:${PORT}`));
