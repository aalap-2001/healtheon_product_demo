// Live feedback widget for a static page (GitHub Pages) — comments stored in Firebase Firestore.
// Loaded by index.html via:  <script type="module" src="comments.js"></script>
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCu-GD8mMbiXBO26BolAFD5rFlUE90hoZQ",
  authDomain: "healtheon-feedback.firebaseapp.com",
  projectId: "healtheon-feedback",
  storageBucket: "healtheon-feedback.firebasestorage.app",
  messagingSenderId: "696403293777",
  appId: "1:696403293777:web:05bf02724983915a722a70"
};

const PAGE_ID = "healtheon-demo-voiceover-v2"; // change per page/version so feedback stays separate
const db = getFirestore(initializeApp(firebaseConfig), "healtheondemo");
const col = collection(db, "pages", PAGE_ID, "comments");

// ---------- styles (reuses the page's own colour variables, with fallbacks) ----------
const css = `
#fb-btn{position:fixed;left:18px;bottom:18px;z-index:99999;padding:9px 14px;border-radius:20px;border:1px solid var(--bd,#24435F);
 background:var(--su,#0E2032);color:var(--t1,#E4F0FA);font:600 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px #0006}
#fb-btn b{color:var(--tl,#00B8CA)}
#fb-panel{position:fixed;left:18px;bottom:64px;z-index:99999;width:320px;max-height:70vh;display:none;flex-direction:column;
 background:var(--su,#0E2032);color:var(--t1,#E4F0FA);border:1px solid var(--bd,#24435F);border-radius:10px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px #0008}
#fb-panel.open{display:flex}
#fb-panel header{padding:12px 14px;border-bottom:1px solid var(--bd,#24435F);font-weight:700;display:flex;justify-content:space-between;align-items:center}
#fb-list{overflow:auto;padding:8px 14px;flex:1}
.fb-item{padding:8px 0;border-bottom:1px solid var(--bd,#24435F)}
.fb-item.done{opacity:.45}
.fb-meta{font-size:11px;color:var(--t3,#8AA8C2)}
.fb-where{font-size:11px;color:var(--tl,#00B8CA);cursor:pointer}
.fb-item button{font-size:11px;background:none;border:0;color:var(--t2,#A9C4DA);cursor:pointer;padding:0;margin-top:3px;text-decoration:underline}
#fb-form{padding:12px 14px;border-top:1px solid var(--bd,#24435F);display:grid;gap:7px}
#fb-form input,#fb-form textarea{width:100%;background:var(--gr,#09141E);color:inherit;border:1px solid var(--bd,#24435F);border-radius:6px;padding:7px;font:inherit}
#fb-form textarea{min-height:64px;resize:vertical}
#fb-form .row{display:flex;gap:7px}
#fb-form .row button{flex:1;padding:8px;border-radius:6px;border:1px solid var(--bd,#24435F);background:transparent;color:inherit;font:600 12px system-ui;cursor:pointer}
#fb-form .row button.primary{background:var(--tl,#00B8CA);color:#04121C;border-color:transparent}
#fb-target{font-size:11px;color:var(--am,#EFA030)}
.fb-pin{position:fixed;z-index:99998;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:var(--am,#EFA030);
 color:#000;font:700 11px/22px system-ui;text-align:center;cursor:pointer;box-shadow:0 0 0 3px #0005}
.fb-pin.done{display:none}
body.fb-picking, body.fb-picking *{cursor:crosshair!important}
.fb-flash{outline:2px solid var(--am,#EFA030)!important;outline-offset:2px}
@media (max-width:480px){#fb-panel{left:8px;right:8px;width:auto}}`;
document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);

// ---------- UI ----------
document.body.insertAdjacentHTML("beforeend", `
<button id="fb-btn">Feedback <b id="fb-count">0</b></button>
<div id="fb-panel">
  <header>Feedback <span class="fb-meta">updates live</span></header>
  <div id="fb-list"><p class="fb-meta">No comments yet. Add the first one below.</p></div>
  <div id="fb-form">
    <input id="fb-name" placeholder="Your name">
    <textarea id="fb-text" placeholder="Write your comment"></textarea>
    <div id="fb-target"></div>
    <div class="row"><button id="fb-pick">Point to a spot</button><button id="fb-send" class="primary">Post comment</button></div>
  </div>
</div>`);

const $ = id => document.getElementById(id);
const nameBox = $("fb-name");
nameBox.value = (() => { try { return localStorage.getItem("fb-name") || ""; } catch { return ""; } })();
$("fb-btn").onclick = () => $("fb-panel").classList.toggle("open");

let target = null; // {x, y, label}
const describe = el => (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 60);

$("fb-pick").onclick = () => {
  document.body.classList.add("fb-picking");
  $("fb-target").textContent = "Click anywhere on the page…";
  const pick = e => {
    if (e.target.closest("#fb-panel,#fb-btn")) return;
    e.preventDefault(); e.stopPropagation();
    document.body.classList.remove("fb-picking");
    document.removeEventListener("click", pick, true);
    target = { x: e.clientX / innerWidth, y: e.clientY / innerHeight, label: describe(e.target) };
    $("fb-target").textContent = `Pointing at: "${target.label}"`;
  };
  document.addEventListener("click", pick, true);
};

$("fb-send").onclick = async () => {
  const text = $("fb-text").value.trim(), name = nameBox.value.trim() || "Anonymous";
  if (!text) { $("fb-text").focus(); return; }
  try { localStorage.setItem("fb-name", name); } catch {}
  $("fb-send").disabled = true;
  try {
    await addDoc(col, { name, text, target, resolved: false, createdAt: serverTimestamp() });
    $("fb-text").value = ""; target = null; $("fb-target").textContent = "";
  } catch (err) { alert("Comment not posted: " + err.message); }
  $("fb-send").disabled = false;
};

// ---------- live sync ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
onSnapshot(query(col, orderBy("createdAt")), snap => {
  document.querySelectorAll(".fb-pin").forEach(p => p.remove());
  const items = [];
  let n = 0, open = 0;
  snap.forEach(d => {
    const c = d.data(); n++; if (!c.resolved) open++;
    const when = c.createdAt ? c.createdAt.toDate().toLocaleString() : "just now";
    items.push(`<div class="fb-item ${c.resolved ? "done" : ""}">
      <div class="fb-meta">#${n} · ${esc(c.name)} · ${when}</div>
      <div>${esc(c.text)}</div>
      ${c.target ? `<div class="fb-where" data-pin="${d.id}">On: "${esc(c.target.label)}"</div>` : ""}
      <button data-id="${d.id}" data-res="${c.resolved}">${c.resolved ? "Reopen" : "Mark resolved"}</button></div>`);
    if (c.target) {
      const pin = document.createElement("div");
      pin.className = "fb-pin" + (c.resolved ? " done" : "");
      pin.id = "pin-" + d.id; pin.textContent = n; pin.title = c.text;
      pin.style.left = c.target.x * 100 + "vw"; pin.style.top = c.target.y * 100 + "vh";
      pin.onclick = () => $("fb-panel").classList.add("open");
      document.body.appendChild(pin);
    }
  });
  $("fb-list").innerHTML = items.length ? items.reverse().join("") : `<p class="fb-meta">No comments yet. Add the first one below.</p>`;
  $("fb-count").textContent = open;
  $("fb-list").querySelectorAll("button[data-id]").forEach(b =>
    b.onclick = () => updateDoc(doc(col, b.dataset.id), { resolved: b.dataset.res !== "true" }));
  $("fb-list").querySelectorAll("[data-pin]").forEach(w => w.onclick = () => {
    const p = $("pin-" + w.dataset.pin); if (!p) return;
    p.classList.add("fb-flash"); setTimeout(() => p.classList.remove("fb-flash"), 1500);
  });
}, err => { $("fb-list").innerHTML = `<p class="fb-meta">Couldn't load comments: ${esc(err.message)}. Check the Firebase config and Firestore rules.</p>`; });
