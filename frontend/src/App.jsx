import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { call, MEDIA } from "./api";

const CATS = { phone: "Phone", electronics: "Electronics", wallet: "Wallet", bag: "Bag / Luggage", keys: "Keys",
  documents: "Documents / ID", clothing: "Clothing", jewellery: "Jewellery", pet: "Pet", vehicle: "Vehicle", other: "Other" };
const imgUrl = (u) => (/^https?:\/\//.test(u) && !u.startsWith(MEDIA) ? u : MEDIA + new URL(u, MEDIA).pathname);
const ago = (d) => { const days = Math.floor((Date.now() - new Date(d)) / 864e5); return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`; };

const HOME = [8.1767, 77.2530];
const pin = (type) => L.divIcon({ className: "", html: `<span class="pin ${type}"></span>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const tiles = (m) => L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(m);

function MapPicker({ pos, onPick }) {
  const el = useRef(null), map = useRef(null), mark = useRef(null);
  const place = (ll, fly) => {
    if (mark.current) mark.current.setLatLng(ll); else mark.current = L.marker(ll, { icon: pin("pick") }).addTo(map.current);
    if (fly) map.current.setView(ll, 16);
    onPick(ll);
  };
  useEffect(() => {
    map.current = L.map(el.current).setView(pos || HOME, pos ? 16 : 13);
    tiles(map.current);
    if (pos) mark.current = L.marker(pos, { icon: pin("pick") }).addTo(map.current);
    map.current.on("click", (e) => place([e.latlng.lat, e.latlng.lng]));
    setTimeout(() => map.current && map.current.invalidateSize(), 150);
    return () => map.current.remove();
  }, []);
  const locate = () => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => place([p.coords.latitude, p.coords.longitude], true), () => alert("Could not get your location. Allow location access in your browser.")) : alert("Location is not supported in this browser.");
  return (
    <div className="picker">
      <div ref={el} className="map" />
      <div className="row"><button type="button" className="btn ghost sm" onClick={locate}>Use my current location</button></div>
      <p className="muted">Tap the map to mark the exact spot. This is optional.</p>
    </div>
  );
}

function MapView({ items, onOpen, height }) {
  const el = useRef(null), map = useRef(null), layer = useRef(null);
  useEffect(() => {
    map.current = L.map(el.current).setView(HOME, 12);
    tiles(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    setTimeout(() => map.current && map.current.invalidateSize(), 150);
    return () => map.current.remove();
  }, []);
  useEffect(() => {
    layer.current.clearLayers();
    const pts = [];
    items.filter((i) => i.latitude != null && i.longitude != null).forEach((i) => {
      const ll = [i.latitude, i.longitude];
      pts.push(ll);
      L.marker(ll, { icon: pin(i.status === "resolved" ? "done" : i.type) }).addTo(layer.current).bindTooltip(i.title).on("click", () => onOpen(i));
    });
    if (pts.length) map.current.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
  }, [items]);
  return <div ref={el} className={`map ${height || ""}`} />;
}

function Card({ item, onOpen }) {
  return (
    <article className="card" onClick={() => onOpen(item)}>
      <div className="thumb">
        {item.image ? <img src={imgUrl(item.image)} alt="" /> : <span>{CATS[item.category]}</span>}
        <b className={`badge ${item.status === "resolved" ? "done" : item.type}`}>{item.status === "resolved" ? "Returned" : item.type === "lost" ? "Lost" : "Found"}</b>
        {item.reward && <b className="badge reward">Reward</b>}
      </div>
      <div className="card-body">
        <h3>{item.title}</h3>
        <p className="muted">{item.location}</p>
        <div className="chips"><span>{CATS[item.category]}</span>{item.color && <span>{item.color}</span>}<span>{ago(item.date)}</span></div>
        {item.claims_count > 0 && item.is_mine && <p className="alert">{item.claims_count} new claim{item.claims_count > 1 ? "s" : ""}</p>}
      </div>
    </article>
  );
}

function Auth({ onDone, onClose }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ username: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const d = await call(mode === "login" ? "/login/" : "/register/", { method: "POST", body: f });
      localStorage.setItem("token", d.token); localStorage.setItem("username", d.username); onDone();
    } catch (x) { setErr(x.message); }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <form className="panel" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <input placeholder="Username" value={f.username} onChange={set("username")} required />
        {mode === "register" && <input type="email" placeholder="Email" value={f.email} onChange={set("email")} />}
        <input type="password" placeholder="Password (6+ characters)" value={f.password} onChange={set("password")} required />
        {err && <p className="err">{err}</p>}
        <button className="btn">{mode === "login" ? "Log in" : "Create account"}</button>
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}

function PostForm({ onDone, onClose }) {
  const [f, setF] = useState({ type: "lost", title: "", description: "", category: "other", color: "", brand: "", location: "", date: new Date().toISOString().slice(0, 10), contact_phone: "", reward: "", latitude: "", longitude: "" });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => v !== "" && v !== null && form.append(k, v));
    if (file) form.append("image", file);
    try { await call("/items/", { method: "POST", form }); onDone("Your item is posted."); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <form className="panel wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Post an item</h2>
        <div className="seg">{["lost", "found"].map((t) => (
          <button type="button" key={t} className={f.type === t ? "on" : ""} onClick={() => setF({ ...f, type: t })}>{t === "lost" ? "I lost something" : "I found something"}</button>))}</div>
        <label>Item name<input placeholder="e.g. Black Samsung phone" value={f.title} onChange={set("title")} required /></label>
        <div className="row">
          <label>Category<select value={f.category} onChange={set("category")}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Date<input type="date" value={f.date} onChange={set("date")} required /></label>
        </div>
        <div className="row">
          <label>Colour<input placeholder="e.g. Black" value={f.color} onChange={set("color")} /></label>
          <label>Brand<input placeholder="e.g. Samsung" value={f.brand} onChange={set("brand")} /></label>
        </div>
        <label>Place<input placeholder="e.g. Colachel bus stand" value={f.location} onChange={set("location")} required /></label>
        <MapPicker pos={null} onPick={(ll) => setF((s) => ({ ...s, latitude: ll[0].toFixed(6), longitude: ll[1].toFixed(6) }))} />
        <label>Details<textarea placeholder={f.type === "found" ? "Describe it, but keep one detail private to verify the real owner" : "Marks, scratches, contents, anything that proves it is yours"} value={f.description} onChange={set("description")} /></label>
        <div className="row">
          <label>Phone<input value={f.contact_phone} onChange={set("contact_phone")} /></label>
          {f.type === "lost" && <label>Reward (optional)<input placeholder="e.g. ₹500" value={f.reward} onChange={set("reward")} /></label>}
        </div>
        <label>Photo<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn">Post item</button>
      </form>
    </div>
  );
}

function Detail({ item, authed, onClose, onChanged, onNeedLogin }) {
  const [matches, setMatches] = useState([]);
  const [claims, setClaims] = useState([]);
  const [msg, setMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = `${item.type === "lost" ? "LOST" : "FOUND"}: ${item.title} at ${item.location}`;
    if (navigator.share) navigator.share({ title: item.title, text, url: location.href }).catch(() => {});
    else { try { await navigator.clipboard.writeText(`${text} ${location.href}`); setCopied(true); } catch {} }
  };
  const [err, setErr] = useState("");
  useEffect(() => {
    call(`/items/${item.id}/matches/`).then(setMatches).catch(() => {});
    if (item.is_mine) call(`/items/${item.id}/claims/`).then(setClaims).catch(() => {});
  }, [item.id]);
  const act = async (fn, text) => { try { await fn(); onChanged(text); } catch (x) { setErr(x.message); } };
  const sendClaim = (e) => { e.preventDefault(); act(() => call(`/items/${item.id}/claims/`, { method: "POST", body: { message: msg, phone } }), "Claim sent. The owner will review it."); };
  const decide = (id, status) => act(() => call(`/claims/${id}/decide/`, { method: "POST", body: { status } }), status === "accepted" ? "Claim accepted. Item marked as returned." : "Claim rejected.");
  const rows = [["Category", CATS[item.category]], ["Colour", item.color], ["Brand", item.brand], ["Place", item.location], ["Date", item.date], ["Reward", item.reward], ["Posted by", item.owner_name], ["Views", item.views]].filter(([, v]) => v);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel wide" onClick={(e) => e.stopPropagation()}>
        <div className="head"><b className={`badge ${item.status === "resolved" ? "done" : item.type}`}>{item.status === "resolved" ? "Returned" : item.type === "lost" ? "Lost" : "Found"}</b><button className="link" onClick={onClose}>Close</button></div>
        <h2>{item.title}</h2>
        {item.image && <img className="hero-img" src={imgUrl(item.image)} alt={item.title} />}
        <p>{item.description || "No description added."}</p>
        <dl className="facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {item.latitude != null && (<><MapView items={[item]} onOpen={() => {}} height="small" /><a className="link" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}>Open in Google Maps</a></>)}
        <button className="btn ghost" onClick={share}>{copied ? "Link copied" : "Share this post"}</button>
        {!authed && <button className="btn" onClick={onNeedLogin}>Log in to contact</button>}
        {authed && item.contact_phone && <a className="btn alt" href={`tel:${item.contact_phone}`}>Call {item.contact_phone}</a>}
        {authed && !item.is_mine && item.status === "open" && (
          <form className="claim" onSubmit={sendClaim}>
            <h3>{item.type === "found" ? "This is mine" : "I found this"}</h3>
            <textarea required placeholder={item.type === "found" ? "Describe something only the owner would know" : "Tell the owner where and when you found it"} value={msg} onChange={(e) => setMsg(e.target.value)} />
            <input placeholder="Your phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="btn">Send claim</button>
          </form>)}
        {err && <p className="err">{err}</p>}
        {item.is_mine && (<>
          <h3>Claims ({claims.length})</h3>
          {claims.length === 0 && <p className="muted">No claims yet.</p>}
          {claims.map((c) => (
            <div className="claim-row" key={c.id}>
              <b>{c.user_name}</b> <span className={`pill ${c.status}`}>{c.status}</span>
              <p>{c.message}</p>{c.phone && <p className="muted">Phone: {c.phone}</p>}
              {c.status === "pending" && <div className="row"><button className="btn sm" onClick={() => decide(c.id, "accepted")}>Accept</button><button className="btn sm ghost" onClick={() => decide(c.id, "rejected")}>Reject</button></div>}
            </div>))}
          <div className="row">
            {item.status === "open" && <button className="btn alt" onClick={() => act(() => call(`/items/${item.id}/resolve/`, { method: "POST" }), "Marked as returned.")}>Mark as returned</button>}
            <button className="btn ghost" onClick={() => confirm("Delete this post?") && act(() => call(`/items/${item.id}/`, { method: "DELETE" }), "Post deleted.")}>Delete</button>
          </div></>)}
        {matches.length > 0 && (<><h3>Possible matches</h3><div className="grid small">{matches.map((m) => <Card key={m.id} item={m} onOpen={() => {}} />)}</div></>)}
      </div>
    </div>
  );
}

export default function App() {
  const empty = { type: "", category: "", q: "", status: "open", sort: "newest", color: "", date_from: "", has_reward: "", lat: "", lng: "", radius: "5" };
  const [items, setItems] = useState([]);
  const [f, setF] = useState(empty);
  const [stats, setStats] = useState({ lost: 0, found: 0, returned: 0 });
  const [mine, setMine] = useState(false);
  const [authed, setAuthed] = useState(!!localStorage.getItem("token"));
  const [modal, setModal] = useState(null);
  const [open, setOpen] = useState(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [menu, setMenu] = useState(false);
  const nearMe = () => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => { setMine(false); setF((s) => ({ ...s, lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) })); }, () => setToast("Allow location access in your browser to use Near me.")) : setToast("Location is not supported in this browser.");

  const load = async () => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    try { setItems(await call(mine ? "/my-items/" : `/items/?${qs}`)); setStats(await call("/stats/")); } catch { setItems([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [f, mine, authed]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); } }, [toast]);
  const set = (k, v) => { setMine(false); setF({ ...f, [k]: v }); };
  const done = (text) => { setModal(null); setOpen(null); if (text) setToast(text); load(); };
  const logout = () => { localStorage.clear(); setAuthed(false); setMine(false); };

  return (
    <>
      <header className="nav">
        <div className="wrap navin">
          <a className="brand" href="/">Found<span>It</span></a>
          <button className="burger" aria-label="Menu" onClick={() => setMenu(!menu)}>☰</button>
          <nav className={menu ? "open" : ""} onClick={() => setMenu(false)}>
            <button className={`tab ${!mine ? "on" : ""}`} onClick={() => setMine(false)}>Browse</button>
            {authed && <button className={`tab ${mine ? "on" : ""}`} onClick={() => setMine(true)}>My dashboard</button>}
            {authed ? <button className="tab" onClick={logout}>Log out ({localStorage.getItem("username")})</button> : <button className="tab" onClick={() => setModal("auth")}>Log in</button>}
            <button className="btn" onClick={() => setModal(authed ? "post" : "auth")}>Post an item</button>
          </nav>
        </div>
      </header>
      <section className="hero">
        <div className="wrap">
          <h1>Reunite people with what they lost.</h1>
          <p>Report a lost or found item in your town. Owners and finders are matched and verified before anything is handed over.</p>
          <div className="search"><input placeholder="Search by item, brand, place or details" value={f.q} onChange={(e) => set("q", e.target.value)} /></div>
          <div className="stats">
            <div><b>{stats.lost}</b> items still lost</div><div><b>{stats.found}</b> items waiting to be claimed</div><div><b>{stats.returned}</b> reunited with owners</div>
          </div>
        </div>
      </section>
      <div className="wrap layout">
        <aside className={`filters ${showFilters ? "show" : ""}`}>
          <h3>Filters</h3>
          <label>Type<div className="seg"><button className={!f.type ? "on" : ""} onClick={() => set("type", "")}>All</button><button className={f.type === "lost" ? "on" : ""} onClick={() => set("type", "lost")}>Lost</button><button className={f.type === "found" ? "on" : ""} onClick={() => set("type", "found")}>Found</button></div></label>
          <label>Category<select value={f.category} onChange={(e) => set("category", e.target.value)}><option value="">All categories</option>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Status<select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="open">Still open</option><option value="resolved">Returned</option><option value="">Any</option></select></label>
          <label>Colour<input placeholder="e.g. Blue" value={f.color} onChange={(e) => set("color", e.target.value)} /></label>
          <div className="near">
            <label>Near me<select value={f.radius} onChange={(e) => set("radius", e.target.value)}>{[2, 5, 10, 25, 50].map((r) => <option key={r} value={r}>Within {r} km</option>)}</select></label>
            {f.lat ? <button className="link" onClick={() => setF({ ...f, lat: "", lng: "" })}>Turn off near me</button> : <button className="btn ghost sm" onClick={nearMe}>Use my location</button>}
          </div>
          <label>Since date<input type="date" value={f.date_from} onChange={(e) => set("date_from", e.target.value)} /></label>
          <label>Sort by<select value={f.sort} onChange={(e) => set("sort", e.target.value)}><option value="newest">Newest posts</option><option value="oldest">Oldest posts</option><option value="date">Date lost / found</option></select></label>
          <label className="check"><input type="checkbox" checked={!!f.has_reward} onChange={(e) => set("has_reward", e.target.checked ? "1" : "")} /> Reward offered</label>
          <button className="link" onClick={() => { setMine(false); setF(empty); }}>Clear filters</button>
        </aside>
        <main>
          <div className="listhead">
            <div><h2>{mine ? "My posts" : "Latest reports"}</h2><span className="muted">{items.length} result{items.length !== 1 ? "s" : ""}{f.lat ? ` within ${f.radius} km of you` : ""}</span></div>
            <div className="tools">
              <button className="btn ghost sm filter-btn" onClick={() => setShowFilters(!showFilters)}>{showFilters ? "Hide filters" : "Filters"}</button>
              <div className="seg view"><button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List</button><button className={view === "map" ? "on" : ""} onClick={() => setView("map")}>Map</button></div>
            </div>
          </div>
          {loading ? <p className="muted">Loading…</p> : items.length === 0 ? <div className="empty"><h3>No items match</h3><p>Try clearing some filters, or post the item yourself.</p></div> :
            view === "map" ? <><MapView items={items} onOpen={setOpen} height="tall" /><p className="muted">Only posts with a pinned location appear on the map.</p></> : <div className="grid">{items.map((i) => <Card key={i.id} item={i} onOpen={setOpen} />)}</div>}
        </main>
      </div>
      <footer className="foot"><div className="wrap">FoundIt · A community lost and found for your town. Never pay money to get an item back, and meet in public places.</div></footer>
      <button className="fab" onClick={() => setModal(authed ? "post" : "auth")}>+ Post an item</button>
      {toast && <div className="toast" role="status">{toast}</div>}
      {modal === "auth" && <Auth onClose={() => setModal(null)} onDone={() => { setAuthed(true); setModal(null); }} />}
      {modal === "post" && <PostForm onClose={() => setModal(null)} onDone={done} />}
      {open && <Detail item={open} authed={authed} onClose={() => setOpen(null)} onChanged={done} onNeedLogin={() => { setOpen(null); setModal("auth"); }} />}
    </>
  );
}
