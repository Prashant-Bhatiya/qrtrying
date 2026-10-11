import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import { LayoutDashboard, QrCode, ChefHat, ConciergeBell, ReceiptText, Plus, Download, RefreshCw, Check, Clock3, Utensils, IndianRupee, ClipboardList, CircleCheck, Menu as MenuIcon, ImagePlus, Trash2, Pencil, X } from "lucide-react";
import "./styles.css";

const API = `${location.protocol}//${location.hostname}:4000/api`;
const imageFor = item => item.imageUrl ? (item.imageUrl.startsWith("http") ? item.imageUrl : `${API.replace(/\/api$/, "")}${item.imageUrl}`) : `https://loremflickr.com/640/480/food,${encodeURIComponent(item.name.replace(/\s+/g, ","))}`;
const money = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const dateTime = s => new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function App() {
  const [page, setPage] = useState(new URLSearchParams(location.search).get("table") ? "customer" : "overview");
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [tableInput, setTableInput] = useState("");
  const [dishName, setDishName] = useState("");
  const [dishCategory, setDishCategory] = useState("Main course");
  const [dishPrice, setDishPrice] = useState("");
  const [dishPhoto, setDishPhoto] = useState(null);
  const [editingDish, setEditingDish] = useState(null);
  const [qrImages, setQrImages] = useState({});
  const [cart, setCart] = useState({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const tableFromUrl = new URLSearchParams(location.search).get("table") || "";

  const load = useCallback(async () => {
    try {
      const [t, o, m] = await Promise.all([
        fetch(`${API}/tables`).then(r => r.json()),
        fetch(`${API}/orders`).then(r => r.json()),
        fetch(`${API}/menu`).then(r => r.json())
      ]);
      setTables(t); setOrders(o); setMenu(m);
    } catch { setNotice("Backend not connected. Run npm run dev from the project root."); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, [load]);
  useEffect(() => {
    let active = true;
    Promise.all(tables.map(async t => [t.id, await QRCode.toDataURL(`${location.origin}/?table=${encodeURIComponent(t.number)}`, { width: 220, margin: 2 })]))
      .then(entries => { if (active) setQrImages(Object.fromEntries(entries)); }).catch(() => {});
    return () => { active = false; };
  }, [tables]);

  const createTable = async e => {
    e.preventDefault(); setNotice("");
    try {
      const r = await fetch(`${API}/tables`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number: tableInput }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not create table");
      setTableInput(""); setNotice(`QR created for Table ${data.number}`); load();
    } catch (err) { setNotice(err.message); }
  };
  const saveDish = async e => {
    e.preventDefault(); setNotice("");
    const body = new FormData(); body.append("name", dishName); body.append("category", dishCategory); body.append("price", dishPrice);
    if (dishPhoto) body.append("photo", dishPhoto);
    try {
      const r = await fetch(`${API}/menu${editingDish ? `/${editingDish.id}` : ""}`, { method: editingDish ? "PATCH" : "POST", body });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not save dish");
      setDishName(""); setDishCategory("Main course"); setDishPrice(""); setDishPhoto(null); setEditingDish(null); setNotice(`Saved ${data.name} to the menu.`); await load();
    } catch (err) { setNotice(`${err.message}. Check that the backend is running.`); }
  };
  const editDish = item => { setEditingDish(item); setDishName(item.name); setDishCategory(item.category); setDishPrice(String(item.price)); setDishPhoto(null); window.scrollTo({top:0,behavior:"smooth"}); };
  const deleteDish = async item => { if (!confirm(`Delete ${item.name} from the menu?`)) return; try { const r=await fetch(`${API}/menu/${item.id}`,{method:"DELETE"}); if(!r.ok) throw new Error("Delete failed"); setNotice(`${item.name} deleted.`); await load(); } catch(e) { setNotice(e.message); } };
  const updateOrder = async (id, patch) => {
    try {
      const r = await fetch(`${API}/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error("Update failed");
      await load();
    } catch (e) { setNotice(e.message); }
  };
  const add = id => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const changeQty = (id, delta) => setCart(c => { const n = (c[id] || 0) + delta; const next = { ...c }; if (n <= 0) delete next[id]; else next[id] = n; return next; });
  const cartItems = useMemo(() => menu.filter(m => cart[m.id]).map(m => ({ ...m, qty: cart[m.id] })), [menu, cart]);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const placeOrder = async () => {
    if (!tableFromUrl) { setNotice("Open this page from a table QR code."); return; }
    setBusy(true); setNotice("");
    try {
      const r = await fetch(`${API}/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableNumber: tableFromUrl, items: cartItems.map(i => ({ id: i.id, qty: i.qty })) }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Order failed");
      setCart({}); setNotice(`Order #${data.orderNo} sent successfully! Staff have been notified.`); await load();
    } catch (e) { setNotice(e.message); } finally { setBusy(false); }
  };

  const nav = [
    ["overview", "Overview", LayoutDashboard], ["menu", "Menu Items", Utensils], ["qrs", "QR Tables", QrCode],
    ["kitchen", "Kitchen Orders", ChefHat], ["waiter", "Head Waiter", ConciergeBell], ["billing", "Billing Counter", ReceiptText]
  ];
  const visibleOrders = page === "kitchen" ? orders.filter(o => ["New", "Preparing", "Ready"].includes(o.status)) :
    page === "waiter" ? orders.filter(o => o.status === "Ready" || o.status === "Served") :
    page === "billing" ? orders : orders;
  const activeOrders = orders.filter(o => o.paymentStatus !== "Paid");
  const totalSales = orders.filter(o => o.paymentStatus === "Paid").reduce((s, o) => s + o.total, 0);

  if (page === "customer") return <div className="customer-shell">
    <header className="customer-head"><div className="brand-mark"><Utensils size={21}/></div><div><b>TableFlow</b><span>Freshly prepared for you</span></div><span className="table-chip">Table {tableFromUrl || "—"}</span></header>
    <section className="customer-hero"><span className="eyebrow">WELCOME TO OUR RESTAURANT</span><h1>Good food.<br/><em>Great moments.</em></h1><p>Explore our menu and order directly to your table.</p></section>
    {notice && <div className="notice customer-notice">{notice}</div>}
    <div className="customer-content"><div><div className="section-heading"><div><span className="eyebrow">MADE WITH CARE</span><h2>Our Menu</h2></div><span className="muted">{menu.length} items</span></div>
      <div className="menu-grid">{menu.map(item => <article className="menu-item" key={item.id}><div className="food-placeholder">{<img src={imageFor(item)} alt={item.name} onError={e=>{e.currentTarget.style.display="none";}}/>}</div><div className="menu-item-info"><span className="category">{item.category}</span><b>{item.name}</b><strong>{money(item.price)}</strong><button className="add-btn" onClick={() => add(item.id)}>{cart[item.id] ? <><span className="qty-inline"><span onClick={e => {e.stopPropagation();changeQty(item.id,-1)}}>−</span>{cart[item.id]}<span onClick={e => {e.stopPropagation();changeQty(item.id,1)}}>+</span></span></> : <><Plus size={15}/> Add</>}</button></div></article>)}</div>
    </div><aside className="cart-panel"><div className="cart-title"><ClipboardList size={19}/><h3>Your order</h3><span className="count">{cartItems.reduce((s,i)=>s+i.qty,0)}</span></div>
      {cartItems.length ? <>{cartItems.map(i=><div className="cart-row" key={i.id}><div><b>{i.name}</b><span>{money(i.price)} each</span></div><div className="qty-control"><button onClick={()=>changeQty(i.id,-1)}>−</button><b>{i.qty}</b><button onClick={()=>changeQty(i.id,1)}>+</button></div><strong>{money(i.price*i.qty)}</strong></div>)}<div className="cart-total"><span>Total</span><b>{money(cartTotal)}</b></div><button className="primary wide" disabled={busy} onClick={placeOrder}>{busy ? "Sending order…" : "Place order"} <span>→</span></button><p className="tiny-note">Your order will be sent to our kitchen.</p></> : <div className="empty-cart"><ClipboardList size={28}/><b>Your cart is empty</b><span>Add dishes from the menu to get started.</span></div>}
    </aside></div><footer className="customer-footer">Thank you for dining with us · TableFlow</footer>
  </div>;

  const renderOrder = order => <article className="order-card" key={order.id}>
    <div className="order-top"><div><span className="order-number">#{order.orderNo}</span><span className="table-label">Table {order.tableNumber}</span></div><span className={`status status-${order.status.toLowerCase()}`}>{order.status}</span></div>
    <div className="order-meta"><Clock3 size={14}/>{dateTime(order.createdAt)} <span>·</span> {order.items.reduce((s,i)=>s+i.qty,0)} items</div>
    <div className="order-items">{order.items.map((i,idx)=><div key={idx}><span><b>{i.qty}×</b> {i.name}</span><span>{money(i.price*i.qty)}</span></div>)}</div>
    <div className="order-total"><span>Order total</span><b>{money(order.total)}</b></div>
    <div className="order-actions">
      {page === "kitchen" && <>{order.status === "New" && <button className="primary" onClick={()=>updateOrder(order.id,{status:"Preparing"})}>Start preparing</button>}{order.status === "Preparing" && <button className="primary" onClick={()=>updateOrder(order.id,{status:"Ready"})}><Check size={15}/> Mark ready</button>}{order.status === "Ready" && <span className="muted action-note">Waiting for service</span>}</>}
      {page === "waiter" && order.status === "Ready" && <button className="primary" onClick={()=>updateOrder(order.id,{status:"Served"})}><Check size={15}/> Mark served</button>}
      {page === "waiter" && order.status === "Served" && <span className="paid-label"><CircleCheck size={15}/> Served</span>}
      {page === "billing" && <><span className={`payment-label ${order.paymentStatus==="Paid"?"paid-label":""}`}>{order.paymentStatus==="Paid"?"Paid":"Payment due"}</span>{order.paymentStatus==="Unpaid" && <button className="primary" onClick={()=>updateOrder(order.id,{paymentStatus:"Paid"})}>Mark paid</button>}</>}
    </div>
  </article>;

  return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><div className="brand-mark"><Utensils size={20}/></div><div><b>TableFlow</b><span>RESTAURANT OS</span></div></div><div className="nav-caption">WORKSPACE</div><nav>{nav.map(([id,label,Icon])=><button key={id} className={`nav-link ${page===id?"selected":""}`} onClick={()=>setPage(id)}><Icon size={18}/><span>{label}</span>{id==="kitchen"&&orders.some(o=>o.status==="New")&&<i/>}</button>)}</nav><div className="sidebar-bottom"><div className="online-dot"/><div><b>Demo environment</b><span>Local API connected</span></div></div></aside>
  <main className="main-area"><header className="topbar"><div className="mobile-brand"><MenuIcon size={20}/> TableFlow</div><div className="breadcrumb">Workspace <span>/</span> <b>{nav.find(n=>n[0]===page)?.[1] || "Customer Menu"}</b></div><div className="top-actions"><span className="live-dot"/> Live updates <button className="icon-button" title="Refresh" onClick={load}><RefreshCw size={17}/></button></div></header>
  <div className="page-content"><div className="page-title-row"><div><span className="eyebrow">RESTAURANT MANAGEMENT</span><h1>{nav.find(n=>n[0]===page)?.[1]}</h1><p>{({overview:"A real-time snapshot of your restaurant.",menu:"Add dishes, set prices, and optionally upload photos.",qrs:"Create table QR codes for contactless ordering.",kitchen:"Incoming orders and preparation status.",waiter:"Track ready orders and coordinate table service.",billing:"Review table bills and collect payments."})[page]}</p></div>{page==="qrs"&&<button className="primary" onClick={()=>document.getElementById("table-number")?.focus()}><Plus size={16}/> New table QR</button>}</div>
  {notice&&<div className="notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  {page==="menu"&&<><section className="panel dish-form-panel"><div className="panel-heading"><div><h3>{editingDish?"Edit menu item":"Add a menu item"}</h3><p>Photo is optional. If omitted, a food image is selected automatically using the dish name.</p></div></div><form className="dish-form" onSubmit={saveDish}><label>Dish name<input value={dishName} onChange={e=>setDishName(e.target.value)} placeholder="e.g. Paneer Tikka" required maxLength={100}/></label><label>Category<select value={dishCategory} onChange={e=>setDishCategory(e.target.value)}><option>Starters</option><option>Main course</option><option>Breads</option><option>Rice</option><option>Desserts</option><option>Drinks</option><option>Other</option></select></label><label>Price (₹)<input type="number" min="0" step="0.5" value={dishPrice} onChange={e=>setDishPrice(e.target.value)} placeholder="220" required/></label><label className="photo-upload"><ImagePlus size={18}/><span>{dishPhoto?dishPhoto.name:"Upload dish photo (optional)"}<small>JPG, PNG or WEBP · max 5 MB</small></span><input type="file" accept="image/*" onChange={e=>setDishPhoto(e.target.files?.[0]||null)}/></label><div className="dish-form-actions"><button className="primary" type="submit"><Plus size={15}/>{editingDish?"Save changes":"Add item"}</button>{editingDish&&<button type="button" className="secondary" onClick={()=>{setEditingDish(null);setDishName("");setDishPrice("");setDishPhoto(null);}}>Cancel</button>}</div></form></section><div className="section-heading table-heading"><div><h2>Customer menu</h2><p>{menu.length} items · changes appear on customer menus after refresh</p></div></div><div className="admin-menu-grid">{menu.map(item=><article className="admin-menu-card" key={item.id}><img src={imageFor(item)} alt={item.name} onError={e=>{e.currentTarget.src="https://loremflickr.com/640/480/restaurant,food";}}/><div className="admin-menu-info"><span className="category">{item.category}</span><b>{item.name}</b><strong>{money(item.price)}</strong><div><button className="secondary" onClick={()=>editDish(item)}><Pencil size={13}/> Edit</button><button className="danger-btn" onClick={()=>deleteDish(item)}><Trash2 size={13}/> Delete</button></div></div></article>)}</div></>}
  {page==="overview"&&<><div className="stats-grid"><div className="stat-card"><div className="stat-icon purple"><ClipboardList size={19}/></div><span>Total orders</span><strong>{orders.length}</strong><small>All orders received</small></div><div className="stat-card"><div className="stat-icon orange"><Clock3 size={19}/></div><span>Active orders</span><strong>{activeOrders.length}</strong><small>Awaiting payment</small></div><div className="stat-card"><div className="stat-icon green"><IndianRupee size={19}/></div><span>Collected sales</span><strong>{money(totalSales)}</strong><small>Marked as paid</small></div><div className="stat-card"><div className="stat-icon blue"><QrCode size={19}/></div><span>Table QR codes</span><strong>{tables.length}</strong><small>Ready to use</small></div></div>
    <div className="overview-grid"><section className="panel"><div className="panel-heading"><div><h3>Recent orders</h3><p>Latest customer activity</p></div><button className="text-btn" onClick={()=>setPage("kitchen")}>View kitchen →</button></div>{orders.length?orders.slice(0,5).map(o=><div className="recent-row" key={o.id}><div className="recent-icon"><Utensils size={16}/></div><div className="recent-main"><b>Order #{o.orderNo}</b><span>Table {o.tableNumber} · {o.items.length} dishes</span></div><div className="recent-right"><b>{money(o.total)}</b><span className={`status status-${o.status.toLowerCase()}`}>{o.status}</span></div></div>):<div className="empty-state"><ClipboardList size={27}/><b>No orders yet</b><span>Orders placed by customers will appear here.</span></div>}</section>
    <section className="panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common tasks</p></div></div><button className="quick-action" onClick={()=>setPage("qrs")}><div className="quick-icon purple"><QrCode size={19}/></div><div><b>Create table QR</b><span>Set up a new dining table</span></div><span>→</span></button><button className="quick-action" onClick={()=>setPage("kitchen")}><div className="quick-icon orange"><ChefHat size={19}/></div><div><b>Kitchen dashboard</b><span>Manage food preparation</span></div><span>→</span></button><button className="quick-action" onClick={()=>setPage("billing")}><div className="quick-icon green"><ReceiptText size={19}/></div><div><b>Billing counter</b><span>Review unpaid orders</span></div><span>→</span></button><div className="service-note"><div className="online-dot"/><div><b>Services running</b><span>Updates every 3 seconds</span></div></div></section></div></>}
  {page==="qrs"&&<><section className="panel create-panel"><div className="create-copy"><div className="stat-icon purple"><QrCode size={20}/></div><div><h3>Create a table QR code</h3><p>Each QR opens the customer menu with its table number pre-filled.</p></div></div><form className="create-form" onSubmit={createTable}><label htmlFor="table-number">Table number / name</label><div><input id="table-number" value={tableInput} onChange={e=>setTableInput(e.target.value)} placeholder="e.g. 04 or VIP-1" required/><button className="primary" type="submit"><Plus size={16}/> Create QR</button></div></form></section>
  <div className="section-heading table-heading"><div><h2>Dining tables</h2><p>{tables.length} QR codes generated</p></div></div><div className="qr-grid">{tables.map(t=><article className="qr-card" key={t.id}><div className="qr-card-top"><span className="table-icon"><Utensils size={18}/></span><span className="active-tag">Active</span></div><h3>Table {t.number}</h3><p>Customer ordering QR</p>{qrImages[t.id]?<img className="qr-image" src={qrImages[t.id]} alt={`QR code for table ${t.number}`}/>:<div className="qr-skeleton"/>}<div className="qr-url">Menu link · ?table={t.number}</div><button className="download-btn" disabled={!qrImages[t.id]} onClick={()=>{const a=document.createElement("a");a.href=qrImages[t.id];a.download=`table-${t.number}-qr.png`;a.click();}}><Download size={15}/> Download QR PNG</button></article>)}</div></>}
  {["kitchen","waiter","billing"].includes(page)&&<><div className="order-toolbar"><div className="filter-pill"><span className="live-dot"/>{page==="kitchen"?"Kitchen queue":page==="waiter"?"Service queue":"All bills"} <b>{visibleOrders.length}</b></div><button className="secondary" onClick={load}><RefreshCw size={15}/> Refresh</button></div>{visibleOrders.length?<div className="orders-grid">{visibleOrders.map(renderOrder)}</div>:<div className="panel empty-state large-empty"><div className="empty-art">{page==="kitchen"?<ChefHat size={30}/>:page==="waiter"?<ConciergeBell size={30}/>:<ReceiptText size={30}/>}</div><h3>{page==="kitchen"?"Kitchen is all caught up":page==="waiter"?"No orders waiting for service":"No bills to show yet"}</h3><p>{page==="kitchen"?"New QR orders will appear here automatically.":page==="waiter"?"Orders marked Ready by the kitchen appear here.":"Customer orders and table totals will appear here."}</p></div>}</>}
  <footer className="app-footer">TableFlow Demo <span>•</span> Temporary local build <span>•</span> Not for production use</footer></div></main></div>;
}
createRoot(document.getElementById("root")).render(<App/>);
