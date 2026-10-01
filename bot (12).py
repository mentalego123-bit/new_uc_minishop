# -*- coding: utf-8 -*-
"""
STARS / PREMIUM + KONKURS + REFERAL + REAL API (reseller) + ADMIN PANEL
Yetkazib berish: CoinDrop API (https://coindrop.uz/api/v1)

O'rnatish:
    pip install "aiogram>=3.13" aiohttp aiosqlite

Sozlash: yonidagi  .env  faylga yozing (namuna: .env.example) yoki muhit o'zgaruvchilari orqali:
    BOT_TOKEN, ADMIN_IDS, COINDROP_API_KEY, CARD_INFO, MINI_APP_URL, DOCS_URL, API_PUBLIC_URL, API_PORT

Ishga tushirish:
    python bot.py
"""
import asyncio, hashlib, json, logging, os, random, re, secrets, sys, time
from collections import defaultdict, deque
from datetime import datetime, timedelta

import aiohttp
import aiosqlite
from aiohttp import web
from aiogram import Bot, Dispatcher, F, Router, BaseMiddleware
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramRetryAfter
from aiogram.filters import Command, CommandStart, CommandObject, Filter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (BufferedInputFile, CallbackQuery, ChatJoinRequest, InlineKeyboardButton as IB,
                           InlineKeyboardMarkup as IM, KeyboardButton, Message, ReplyKeyboardMarkup, WebAppInfo)


# ============================ SOZLAMALAR ============================
def _load_env(path=".env"):
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass

_load_env()

BOT_TOKEN = os.getenv("BOT_TOKEN", "8834952975:AAEWLEzLgDFYn__KEZErUNIC3pt50kghHeM")
SUPER_ADMINS = {int(x) for x in os.getenv("ADMIN_IDS", "8975997131").replace(" ", "").split(",") if x.isdigit()}
CD_KEY = os.getenv("COINDROP_API_KEY", "cd_46849378a22a5d7fa0c6d7e38e6da5df6ec852f288342ded")
CD_URL = os.getenv("COINDROP_URL", "https://coindrop.uz/api/v1")
CARD_INFO = os.getenv("CARD_INFO", "Karta raqami: 9860 1201 4332 6722")
MINI_APP_URL = os.getenv("MINI_APP_URL", "")            # admin paneldan ham o'zgartiriladi
DOCS_URL = os.getenv("DOCS_URL", "https://mentalego123-bit.github.io/docs/")   # API hujjati (Mini App), admin paneldan ham o'zgaradi
ADMIN_CONTACT = os.getenv("ADMIN_CONTACT", "@stars_oberin")
DB_FILE = os.getenv("DB_FILE", "bot.db")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8080"))
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "")         # masalan https://api.sizning-domen.uz
API_RATE_LIMIT = int(os.getenv("API_RATE_LIMIT", "30"))   # bir kalit uchun daqiqasiga so'rov

# CoinDrop Premium product_id lari. Admin paneldan ham o'zgartiriladi (Sozlamalar -> Premium product ID)
PREMIUM_DEFAULT_PID = {1: "prem_1m", 3: "prem_3m", 6: "prem_6m", 12: "prem_12m"}
PREMIUM_LABEL = {1: "1 oylik", 3: "3 oylik", 6: "6 oylik", 12: "1 yillik"}

# Bot (chakana) narxlari — boshlang'ich qiymatlar, keyin admin paneldan o'zgaradi
STARS = {50: 11000, 100: 20900, 150: 30900, 250: 52800, 350: 72700, 500: 102600,
         750: 152400, 1000: 202200, 2500: 501000, 5000: 999000}
PREM = {1: 49000, 3: 163000, 6: 215000, 12: 399999}
UC = {60: 13800, 325: 61500, 660: 123000, 1800: 302500, 3850: 597700, 8100: 1176400}   # PUBG UC (admin paneldan o'zgaradi)
UC_GAME_KEY = os.getenv("UC_GAME_KEY", "pubg-mobile")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("bot")
bot: Bot = None
SESSION: aiohttp.ClientSession = None
DB: aiosqlite.Connection = None
BOT_USERNAME = ""

SCHEMA = """
CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, username TEXT, balance INTEGER DEFAULT 0,
  stars_bal INTEGER DEFAULT 0, blocked INTEGER DEFAULT 0, joined TEXT, ref_by INTEGER);
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY, perms TEXT, added_by INTEGER, added TEXT);
CREATE TABLE IF NOT EXISTS channels(id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, username TEXT,
  title TEXT, kind TEXT, link TEXT);
CREATE TABLE IF NOT EXISTS join_reqs(chat_id INTEGER, user_id INTEGER, PRIMARY KEY(chat_id,user_id));
CREATE TABLE IF NOT EXISTS topups(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount INTEGER,
  file_id TEXT, status TEXT DEFAULT 'pending', created TEXT);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, kind TEXT, detail TEXT,
  player TEXT, price INTEGER, status TEXT, note TEXT, created TEXT, src TEXT DEFAULT 'bot', key_id INTEGER, ext_ref TEXT);
CREATE TABLE IF NOT EXISTS referrals(inviter INTEGER, invited INTEGER UNIQUE, season INTEGER, created TEXT);
CREATE TABLE IF NOT EXISTS ref_archive(season INTEGER, user_id INTEGER, cnt INTEGER, archived TEXT);
CREATE TABLE IF NOT EXISTS contests(id INTEGER PRIMARY KEY AUTOINCREMENT, owner INTEGER, src_chat INTEGER, src_msg INTEGER,
  btn_text TEXT, btn_style TEXT, btn_pos TEXT, target_chat INTEGER, target_title TEXT, sponsors TEXT,
  winners INTEGER, mode TEXT, status TEXT DEFAULT 'active', msg_id INTEGER, created TEXT, ends TEXT, seed TEXT, result TEXT);
CREATE TABLE IF NOT EXISTS cparts(cid INTEGER, uid INTEGER, joined TEXT, PRIMARY KEY(cid,uid));
CREATE TABLE IF NOT EXISTS cinv(cid INTEGER, inviter INTEGER, invited INTEGER, ok INTEGER DEFAULT 1, PRIMARY KEY(cid,invited));
CREATE TABLE IF NOT EXISTS api_keys(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, key_hash TEXT UNIQUE,
  key_prefix TEXT, status TEXT DEFAULT 'active', pct INTEGER DEFAULT 0, created TEXT, last_used TEXT, calls INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS api_requests(user_id INTEGER PRIMARY KEY, status TEXT, created TEXT);
"""


# ============================ DB YORDAMCHILARI ============================
async def q(sql, args=(), one=False):
    cur = await DB.execute(sql, args)
    r = await cur.fetchone() if one else await cur.fetchall()
    await DB.commit()
    return r

async def ex(sql, args=()):
    cur = await DB.execute(sql, args)
    await DB.commit()
    return cur.rowcount

async def ins(sql, args=()):
    cur = await DB.execute(sql, args)
    await DB.commit()
    return cur.lastrowid

async def kv_get(k, default=None):
    r = await q("SELECT v FROM kv WHERE k=?", (k,), one=True)
    return r["v"] if r else default

async def kv_set(k, v):
    await ex("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, str(v)))

async def add_col(table, col, decl):
    cols = [r["name"] for r in await q(f"PRAGMA table_info({table})")]
    if col not in cols:
        await ex(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")

async def db_init():
    global DB
    DB = await aiosqlite.connect(DB_FILE)
    DB.row_factory = aiosqlite.Row
    await DB.execute("PRAGMA journal_mode=WAL")
    await DB.executescript(SCHEMA)
    await DB.commit()
    # eski bazalarni yangilash (migratsiya)
    for t, c, d in [("orders", "src", "TEXT DEFAULT 'bot'"), ("orders", "key_id", "INTEGER"), ("orders", "ext_ref", "TEXT"),
                    ("contests", "ends", "TEXT"), ("contests", "seed", "TEXT"), ("contests", "result", "TEXT"),
                    ("cinv", "ok", "INTEGER DEFAULT 1")]:
        await add_col(t, c, d)
    await ex("CREATE UNIQUE INDEX IF NOT EXISTS ux_ord_ext ON orders(key_id, ext_ref) WHERE ext_ref IS NOT NULL")
    defaults = {"season": 1, "st_rate": 200, "shop_on": 1, "api_on": 1, "api_public": 0, "topup_min": 1000, "api_st_rate": 190}
    for k, v in STARS.items(): defaults[f"st:{k}"] = v
    for k, v in UC.items(): defaults[f"uc:{k}"] = v
    for k, v in PREM.items():
        defaults[f"pr:{k}"] = v
        defaults[f"api_pr:{k}"] = int(round(v * 0.95, -2))
    for k, v in defaults.items():
        await ex("INSERT OR IGNORE INTO kv(k,v) VALUES(?,?)", (k, str(v)))


# ============================ UMUMIY YORDAMCHILAR ============================
def fmt(n): return f"{int(n):,}".replace(",", " ")
def esc(s): return (str(s or "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
def now(): return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
def sha(s): return hashlib.sha256(s.encode()).hexdigest()

def kb(*rows):
    """rows: [(text, data[, style])] -> InlineKeyboardMarkup. data http/tg -> url, "web:https://..." -> Mini App. style: primary|success|danger"""
    out = []
    for row in rows:
        r = []
        for b in row:
            kw = {"style": b[2]} if len(b) > 2 and b[2] else {}
            if b[1].startswith("web:"):
                r.append(IB(text=b[0], web_app=WebAppInfo(url=b[1][4:]), **kw))
            elif b[1].startswith(("http://", "https://", "tg://")):
                r.append(IB(text=b[0], url=b[1], **kw))
            else:
                r.append(IB(text=b[0], callback_data=b[1], **kw))
        out.append(r)
    return IM(inline_keyboard=out)

MAIN_KB = ReplyKeyboardMarkup(resize_keyboard=True, keyboard=[
    [KeyboardButton(text="⭐ Stars olish"), KeyboardButton(text="💎 Premium olish")],
    [KeyboardButton(text="🎮 Donat / UC olish"), KeyboardButton(text="🎁 Konkurslar")],
    [KeyboardButton(text="💰 Hisobim (Balans)"), KeyboardButton(text="📥 Pul kiritish")],
    [KeyboardButton(text="👥 Referal"), KeyboardButton(text="👤 Kabinet")],
    [KeyboardButton(text="🤝 Hamkorlik (API)"), KeyboardButton(text="ℹ️ Yordam")],
])

async def get_user(uid):
    return await q("SELECT * FROM users WHERE id=?", (uid,), one=True)

def uname(u):
    if not u: return "?"
    return f"@{u['username']}" if u["username"] else esc(u["name"] or u["id"])

def mention(u, uid=None):
    """Username bo'lsa @username, bo'lmasa bosiladigan ism."""
    if u and u["username"]: return "@" + u["username"]
    i = u["id"] if u else uid
    return f'<a href="tg://user?id={i}">{esc((u["name"] if u else None) or i)}</a>'

def tme(username): return f"https://t.me/{str(username).lstrip('@')}"


# ============================ ADMINLAR VA RUXSATLAR ============================
PERMS = {
    "ch": "📢 Kanallar (majburiy obuna)", "tp": "💳 Balans so'rovlari", "us": "👤 Foydalanuvchilar",
    "od": "🧾 Buyurtmalar", "pr": "⚙️ Narxlar (bot)", "api": "🔌 API boshqaruvi", "st": "📊 Statistika",
    "rf": "🔄 Referal tizimi", "ct": "🎁 Konkurslar", "bc": "📣 Xabar yuborish", "se": "🛠 Sozlamalar",
}
ADMINS: dict = {}   # {user_id: set(perms)} — bazadan yuklanadi

async def load_admins():
    ADMINS.clear()
    for r in await q("SELECT * FROM admins"):
        try: ADMINS[r["id"]] = set(json.loads(r["perms"] or "[]"))
        except Exception: ADMINS[r["id"]] = set()

def is_super(uid): return uid in SUPER_ADMINS
def is_admin(uid): return uid in SUPER_ADMINS or uid in ADMINS
def has_perm(uid, p): return uid in SUPER_ADMINS or p in ADMINS.get(uid, ())   # "adm" — faqat asosiy adminlar uchun
def staff_with(p): return [u for u in (SUPER_ADMINS | set(ADMINS)) if has_perm(u, p)]

async def notify_staff(perm, text, markup=None):
    for a in staff_with(perm):
        try: await bot.send_message(a, text, reply_markup=markup)
        except Exception: pass


# ============================ OBUNA (MAJBURIY KANALLAR) ============================
async def is_member(chat_id, uid):
    try:
        m = await bot.get_chat_member(chat_id, uid)
        if m.status in ("member", "administrator", "creator"): return True
        if m.status == "restricted" and getattr(m, "is_member", False): return True
    except Exception:
        pass
    return bool(await q("SELECT 1 FROM join_reqs WHERE chat_id=? AND user_id=?", (chat_id, uid), one=True))

async def unsubscribed(uid):
    res = []
    for ch in await q("SELECT * FROM channels"):
        if not await is_member(ch["chat_id"], uid): res.append(ch)
    return res

def norm_ch(ch):
    link = ch["link"] or (tme(ch["username"]) if ch["username"] else None)
    return {"chat_id": ch["chat_id"], "title": ch["title"] or ch["username"] or "Kanal", "link": link}

async def missing_channels(uid, cid=None):
    """Bot umumiy kanallari + (konkurs bo'lsa) homiy kanallar ichidan a'zo bo'linmaganlari."""
    miss = [norm_ch(c) for c in await unsubscribed(uid)]
    if cid:
        c = await q("SELECT sponsors FROM contests WHERE id=?", (cid,), one=True)
        if c:
            for s in json.loads(c["sponsors"] or "[]"):
                if not await is_member(s["id"], uid):
                    miss.append({"chat_id": s["id"], "title": s.get("title") or "Homiy kanal",
                                 "link": s.get("link") or (tme(s["username"]) if s.get("username") else None)})
    seen, out = set(), []
    for m in miss:
        if m["chat_id"] not in seen: seen.add(m["chat_id"]); out.append(m)
    return out

def gate_kb(chs, cid=None):
    rows = [[(f"📢 {c['title']}", c["link"])] for c in chs if c["link"]]
    rows.append([("✅ Tekshirish", f"chk:{cid}" if cid else "chk")])
    return kb(*rows)

async def send_gate(target, chs, cid=None):
    text = ("❗ Davom etish uchun quyidagi kanallarga a'zo bo'ling, so'ng «✅ Tekshirish» tugmasini bosing:")
    if isinstance(target, CallbackQuery): await target.message.answer(text, reply_markup=gate_kb(chs, cid))
    else: await target.answer(text, reply_markup=gate_kb(chs, cid))


# ============================ NARXLAR / CHEGIRMA (BOT) ============================
async def get_disc():
    raw = await kv_get("disc")
    if not raw: return None
    try: return json.loads(raw)
    except Exception: return None

async def discount_pct(uid):
    d = await get_disc()
    if not d: return 0
    if d.get("until") and datetime.now() > datetime.fromisoformat(d["until"]): return 0
    if d.get("chat_id") and not await is_member(d["chat_id"], uid): return 0
    return int(d["pct"])

async def base_price(kind, key):
    if kind == "st": return int(await kv_get(f"st:{key}"))
    if kind == "stc": return round(int(await kv_get("st_rate")) * int(key))
    if kind == "pr": return int(await kv_get(f"pr:{key}"))
    if kind == "uc": return int(await kv_get(f"uc:{key}"))

async def final_price(kind, key, uid):
    """Faqat BOT uchun. Chegirma API narxiga ta'sir qilmaydi."""
    base = await base_price(kind, key)
    pct = await discount_pct(uid)
    return round(base * (100 - pct) / 100), pct

# ---- API narxlari (bot narxi va chegirmalardan MUSTAQIL) ----
async def api_price(kind, key, pct=0):
    if kind in ("st", "stc"): base = int(await kv_get("api_st_rate")) * int(key)
    else: base = int(await kv_get(f"api_pr:{key}"))
    return max(1, round(base * (100 + int(pct)) / 100))


# ============================ COINDROP API ============================
async def cd(method, path, **kw):
    if not CD_KEY: return 0, {"detail": "COINDROP_API_KEY o'rnatilmagan"}
    try:
        async with SESSION.request(method, CD_URL + path, headers={"X-API-Key": CD_KEY},
                                   timeout=aiohttp.ClientTimeout(total=90), **kw) as r:
            try: data = await r.json()
            except Exception: data = {"detail": await r.text()}
            return r.status, data
    except Exception as e:
        return 0, {"detail": f"Tarmoq xatosi: {e}"}

_prod_cache = {}
async def find_product(game_key, number):
    """CoinDrop mahsulotlari ichidan nomida shu son bor bo'lganini topadi (masalan 60 UC)."""
    if game_key not in _prod_cache:
        st, data = await cd("GET", f"/games/{game_key}/products")
        items = data if isinstance(data, list) else (data.get("products") or data.get("data") or []) if isinstance(data, dict) else []
        if st == 200 and items: _prod_cache[game_key] = items
    for p in _prod_cache.get(game_key, []):
        m = re.search(r"\d+", str(p.get("name") or p.get("title") or ""))
        if m and int(m.group()) == number:
            return str(p.get("id") or p.get("product_id"))
    return None

async def premium_pid(months):
    return await kv_get(f"pid:{months}", PREMIUM_DEFAULT_PID[int(months)])

async def cd_deliver(kind, key, player, ref):
    """CoinDrop orqali haqiqatda yetkazadi. Qaytaradi: ('ok'|'fail'|'review', data)
       ok — bajarildi; fail — aniq rad etildi (pul qaytariladi); review — natija noaniq (tarmoq/5xx), admin tekshiradi."""
    player = player.lstrip("@")
    if kind in ("st", "stc"):
        payload = {"game_key": "telegram-stars", "amount": int(key), "player_id": player, "external_ref": ref}
    elif kind == "uc":
        pid = await find_product(UC_GAME_KEY, int(key))
        if not pid: return "fail", {"detail": f"CoinDrop'da {key} UC mahsuloti topilmadi"}
        payload = {"game_key": UC_GAME_KEY, "product_id": pid, "player_id": player, "external_ref": ref}
    else:
        payload = {"game_key": "telegram-premium", "product_id": await premium_pid(key), "player_id": player, "external_ref": ref}
    st, data = await cd("POST", "/orders", json=payload)
    if st == 200 and isinstance(data, dict) and data.get("success"): return "ok", data
    if st == 0 or st == 409 or st >= 500: return "review", data
    return "fail", data

async def create_order(uid, kind, key, player, label, price, src="bot", key_id=None, ext_ref=None):
    """Umumiy buyurtma mexanizmi (bot ham, API ham shu orqali ishlaydi).
       Qaytaradi: {"state": closed|duplicate|nofunds|delivered|failed|review, "oid", "price", "data"}"""
    if await kv_get("shop_on", "1") != "1": return {"state": "closed"}
    if not CD_KEY: return {"state": "closed"}
    try:
        oid = await ins("INSERT INTO orders(user_id,kind,detail,player,price,status,created,src,key_id,ext_ref) VALUES(?,?,?,?,?,?,?,?,?,?)",
                        (uid, kind, label, player.lstrip("@"), price, "processing", now(), src, key_id, ext_ref))
    except aiosqlite.IntegrityError:
        return {"state": "duplicate"}
    if not await ex("UPDATE users SET balance=balance-? WHERE id=? AND balance>=?", (price, uid, price)):
        await ex("DELETE FROM orders WHERE id=?", (oid,))
        return {"state": "nofunds"}
    st, data = await cd_deliver(kind, key, player, f"o{oid}_u{uid}")
    note = json.dumps(data, ensure_ascii=False)[:500]
    if st == "ok":
        await ex("UPDATE orders SET status='delivered',note=? WHERE id=?", (note, oid))
        return {"state": "delivered", "oid": oid, "price": price, "data": data}
    if st == "fail":
        await ex("UPDATE users SET balance=balance+? WHERE id=?", (price, uid))
        await ex("UPDATE orders SET status='failed',note=? WHERE id=?", (note, oid))
        low = any(w in note.lower() for w in ("balance", "insufficient", "funds", "mablag"))
        hint = "\n💡 <b>CoinDrop hisobida pul yetarli emas bo'lishi mumkin — hisobni to'ldiring.</b>" if low else ""
        await notify_staff("od", f"⚠️ Buyurtma #{oid} bajarilmadi ({src}, user <code>{uid}</code>). Mablag' qaytarildi.{hint}\n"
                                 f"<code>{esc(note[:300])}</code>")
        return {"state": "failed", "oid": oid, "price": price, "data": data}
    await ex("UPDATE orders SET status='review',note=? WHERE id=?", (note, oid))
    await notify_staff("od", f"❓ Buyurtma #{oid} natijasi noaniq ({src}, user <code>{uid}</code>, {esc(label)} → {esc(player)}).\n"
                             f"CoinDrop kabinetida tekshiring va hal qiling:\n<code>{esc(note[:300])}</code>",
                       kb([("✅ Yetkazilgan", f"ordok:{oid}"), ("↩️ Pulni qaytarish", f"ordrf:{oid}")]))
    return {"state": "review", "oid": oid, "price": price, "data": data}


# ============================ MIDDLEWARE ============================
class Gate(BaseMiddleware):
    async def __call__(self, handler, event, data):
        user = data.get("event_from_user")
        if not user or is_admin(user.id): return await handler(event, data)
        if isinstance(event, Message) and event.chat.type != "private": return await handler(event, data)
        row = await get_user(user.id)
        if row and row["blocked"]:
            if isinstance(event, CallbackQuery): await event.answer("🚫 Siz bloklangansiz", show_alert=True)
            else: await event.answer("🚫 Siz botdan bloklangansiz.")
            return
        if isinstance(event, CallbackQuery) and event.data and event.data.startswith(("join:", "ctop:", "chk")):
            return await handler(event, data)
        if isinstance(event, Message) and event.text and event.text.startswith("/start"):
            return await handler(event, data)
        chs = await unsubscribed(user.id)
        if chs: return await send_gate(event, [norm_ch(c) for c in chs])
        return await handler(event, data)

class IsStaff(Filter):
    async def __call__(self, event) -> bool:
        u = getattr(event, "from_user", None)
        return bool(u and is_admin(u.id))

PERM_PREFIX = [
    (("a:ch", "cha:", "chd:"), "ch"),
    (("a:tp", "tp_"), "tp"),
    (("a:us", "ub:", "uq:"), "us"),
    (("a:od", "ordok:", "ordrf:"), "od"),
    (("a:pr", "pl:", "pe:", "disc:"), "pr"),
    (("a:api", "ap:", "ape:", "apb:", "apk:", "apx:", "app:", "apr_"), "api"),
    (("a:st",), "st"),
    (("a:rf", "at:", "arr", "arl", "ar:"), "rf"),
    (("a:ct",), "ct"),
    (("a:bc",), "bc"),
    (("a:se", "se:"), "se"),
    (("a:ad", "ad:"), "adm"),
]
def perm_for(data):
    for prefs, p in PERM_PREFIX:
        if data.startswith(prefs): return p

class PermMW(BaseMiddleware):
    """Admin tugmalari uchun ruxsatni tekshiradi (faqat mos handler topilganda ishlaydi)."""
    async def __call__(self, handler, event, data):
        if isinstance(event, CallbackQuery) and event.data:
            need = perm_for(event.data)
            if need and not has_perm(event.from_user.id, need):
                return await event.answer("⛔ Sizda bu bo'lim uchun ruxsat yo'q", show_alert=True)
        return await handler(event, data)


# ============================ HOLATLAR ============================
class OrderS(StatesGroup):
    amount = State(); player = State(); confirm = State()

class TopupS(StatesGroup):
    rules = State(); amount = State(); check = State()

class CC(StatesGroup):
    post = State(); btn = State(); pos = State(); target = State(); sponsors = State(); winners = State()
    mode = State(); ends = State(); confirm = State()

class AdminS(StatesGroup):
    wait = State()


user_r = Router()
adm_r = Router()
misc_r = Router()
user_r.message.filter(F.chat.type == "private")
adm_r.message.filter(IsStaff())
adm_r.callback_query.filter(IsStaff())
adm_r.callback_query.middleware(PermMW())


# ============================ /start, REFERAL ============================
async def register(m: Message, ref=None):
    u = m.from_user
    if await get_user(u.id):
        await ex("UPDATE users SET name=?, username=? WHERE id=?", (u.full_name, u.username, u.id))
        return False
    await ex("INSERT INTO users(id,name,username,joined,ref_by) VALUES(?,?,?,?,?)",
             (u.id, u.full_name, u.username, now(), ref))
    if ref and ref != u.id and await get_user(ref):
        await ex("INSERT OR IGNORE INTO referrals(inviter,invited,season,created) VALUES(?,?,?,?)",
                 (ref, u.id, int(await kv_get("season")), now()))
        try: await bot.send_message(ref, f"🎉 Sizning havolangiz orqali yangi foydalanuvchi qo'shildi: {esc(u.full_name)}")
        except Exception: pass
    return True

WELCOME = ("🎯 Ushbu bot orqali siz ikki xil qulay imkoniyatdan foydalanishingiz mumkin:\n\n"
           "🎁 <b>Konkurs va Randomayzerlar</b> – kanallarda o'tkaziladigan yutuqli o'yinlarda qatnashing va g'olib bo'ling!\n"
           "⭐ <b>Stars va Premium</b> – Telegram yulduzlari va Premium obunasini tez, xavfsiz va qulay narxlarda xarid qiling.\n\n"
           "Kerakli bo'limni tanlang: 👇")

# ---- Saytdan kelgan "Stars olish" havolasi: t.me/<bot>?start=buy_st_50 ----
PENDING_BUY = {}   # obuna bo'lmagan foydalanuvchi uchun: tanlov kanalga a'zo bo'lgach davom etadi

def parse_buy(payload):
    """buy_st_50 / buy_pr_3 / buy_uc_60  ->  ("st", 50) ; noto'g'ri bo'lsa None"""
    m_ = re.fullmatch(r"buy_(st|pr|uc)_(\d{1,5})", payload or "")
    if not m_: return None
    kind, key = m_.group(1), int(m_.group(2))
    ok = (kind == "st" and key in STARS) or (kind == "pr" and key in PREM) or (kind == "uc" and key in UC)
    return (kind, key) if ok else None

async def start_buy(target: Message, uid, buy, state: FSMContext):
    """Mahsulot bo'limini avtomat tanlaydi va to'g'ridan-to'g'ri qabul qiluvchi so'rashga o'tadi."""
    kind, key = buy
    label = {"st": f"{key} Stars", "pr": f"Premium {PREMIUM_LABEL.get(key, key)}", "uc": f"{key} UC"}[kind]
    try: price, pct = await final_price(kind, key, uid)
    except Exception: price, pct = None, 0
    await state.clear()
    await state.update_data(kind=kind, key=key, label=label)
    await state.set_state(OrderS.player)
    info = f"✅ Tanlandi: <b>{esc(label)}</b>"
    if price: info += f" — <b>{fmt(price)} so'm</b>" + (f" (−{pct}%)" if pct else "")
    ask = {"st": "👤 Stars qabul qiluvchi Telegram <b>@username</b> ni yuboring:",
           "pr": "👤 Premium beriladigan Telegram <b>@username</b> ni yuboring:",
           "uc": "🆔 PUBG Mobile <b>UID</b> raqamingizni yuboring:"}[kind]
    await target.answer(info + "\n\n" + ask, reply_markup=kb([("❌ Bekor qilish", "cancel")]))

@user_r.message(CommandStart())
async def cmd_start(m: Message, command: CommandObject, state: FSMContext):
    await state.clear()
    payload = command.args or ""
    ref = join_cid = inviter = None
    if payload.startswith("r") and payload[1:].isdigit():
        ref = int(payload[1:])
    elif payload.startswith("c") and "_" in payload:
        a, b = payload[1:].split("_", 1)
        if a.isdigit() and b.isdigit(): join_cid, inviter = int(a), int(b)
    elif payload.startswith("join_") and payload[5:].isdigit():
        join_cid = int(payload[5:])
    buy = parse_buy(payload)
    is_new = await register(m, ref)
    if join_cid:
        # konkurs ishtirokchisi taklif qilgan yangi foydalanuvchi — hozircha "kutilmoqda" (ok=0), o'zi qatnashgach hisoblanadi
        if inviter and is_new and inviter != m.from_user.id:
            if await q("SELECT 1 FROM cparts WHERE cid=? AND uid=?", (join_cid, inviter), one=True):
                await ex("INSERT OR IGNORE INTO cinv(cid,inviter,invited,ok) VALUES(?,?,?,0)", (join_cid, inviter, m.from_user.id))
        return await join_flow(m, m.from_user.id, join_cid)
    chs = await unsubscribed(m.from_user.id) if not is_admin(m.from_user.id) else []
    if buy and chs: PENDING_BUY[m.from_user.id] = buy
    if chs: return await send_gate(m, [norm_ch(c) for c in chs])
    if buy:
        await m.answer("👋 Assalomu alaykum, " + esc(m.from_user.full_name) + "!", reply_markup=MAIN_KB)
        return await start_buy(m, m.from_user.id, buy, state)
    await m.answer(f"👋 Assalomu alaykum, {esc(m.from_user.full_name)}!\n\n" + WELCOME, reply_markup=MAIN_KB)

@user_r.callback_query(F.data.startswith("chk"))
async def chk(c: CallbackQuery, state: FSMContext):
    cid = int(c.data[4:]) if c.data.startswith("chk:") and c.data[4:].isdigit() else None
    if await missing_channels(c.from_user.id, cid):
        return await c.answer("❌ Hali hamma kanalga a'zo emassiz!", show_alert=True)
    try: await c.message.delete()
    except Exception: pass
    if cid: return await join_flow(c.message, c.from_user.id, cid)
    buy = PENDING_BUY.pop(c.from_user.id, None)
    if buy:
        await c.message.answer("✅ Rahmat! Obuna tasdiqlandi.", reply_markup=MAIN_KB)
        return await start_buy(c.message, c.from_user.id, buy, state)
    await c.message.answer("✅ Rahmat! Endi botdan foydalanishingiz mumkin.\n\n" + WELCOME, reply_markup=MAIN_KB)

@user_r.callback_query(F.data == "cancel")
async def cancel(c: CallbackQuery, state: FSMContext):
    await state.clear()
    try: await c.message.edit_text("❌ Bekor qilindi.")
    except Exception: await c.message.answer("❌ Bekor qilindi.")
    await c.answer()

@user_r.callback_query(F.data == "home")
async def home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    try: await c.message.delete()
    except Exception: pass
    await c.message.answer("🏠 Asosiy menyu", reply_markup=MAIN_KB)


# ============================ STARS ============================
@user_r.message(F.text == "⭐ Stars olish")
async def stars_menu(m: Message, state: FSMContext):
    await state.clear()
    pct = await discount_pct(m.from_user.id)
    rows = []
    for k in STARS:
        p, _ = await final_price("st", k, m.from_user.id)
        rows.append([(f"⭐ {k} Stars — {fmt(p)} so'm", f"st:{k}")])
    rows.append([("✏️ Boshqa miqdor", "st:c")]); rows.append([("🔙 Ortga", "home")])
    extra = f"\n🔥 <b>Sizga {pct}% chegirma amal qilmoqda!</b>" if pct else ""
    await m.answer("⭐ <b>Telegram Stars (Yulduzlar) sotib olish</b>\n\nHamyonbop narxlarda Telegram yulduzlarini "
                   f"xarid qiling! Kerakli miqdorni tanlang: 👇{extra}", reply_markup=kb(*rows))

@user_r.callback_query(F.data.startswith("st:"))
async def stars_pick(c: CallbackQuery, state: FSMContext):
    v = c.data[3:]
    if v == "c":
        await state.set_state(OrderS.amount)
        await c.message.answer("✏️ Necha Stars kerak? (50 dan 10000 gacha son yuboring)")
        return await c.answer()
    await state.update_data(kind="st", key=int(v), label=f"{v} Stars")
    await state.set_state(OrderS.player)
    await c.message.answer("👤 Stars qabul qiluvchi Telegram <b>@username</b> ni yuboring:")
    await c.answer()

@user_r.message(OrderS.amount)
async def stars_amount(m: Message, state: FSMContext):
    if not (m.text or "").isdigit() or not 50 <= int(m.text) <= 10000:
        return await m.answer("❗ 50 dan 10000 gacha butun son yuboring.")
    n = int(m.text)
    await state.update_data(kind="stc", key=n, label=f"{n} Stars")
    await state.set_state(OrderS.player)
    await m.answer("👤 Stars qabul qiluvchi Telegram <b>@username</b> ni yuboring:")


# ============================ PREMIUM ============================
@user_r.message(F.text == "💎 Premium olish")
async def prem_menu(m: Message, state: FSMContext):
    await state.clear()
    rows = []
    for k in PREM:
        p, _ = await final_price("pr", k, m.from_user.id)
        rows.append([(f"🚀 {PREMIUM_LABEL[k]} — {fmt(p)} so'm", f"pr:{k}")])
    rows.append([("🔙 Ortga", "home")])
    await m.answer("💎 <b>Telegram Premium obunasini xarid qilish</b>\n\nRasmiy Telegram Premium obunasini hamyonbop "
                   "narxlarda xarid qiling! Kerakli muddatni tanlang: 👇", reply_markup=kb(*rows))

@user_r.callback_query(F.data.startswith("pr:"))
async def prem_pick(c: CallbackQuery, state: FSMContext):
    k = int(c.data[3:])
    await state.update_data(kind="pr", key=k, label=f"Premium {PREMIUM_LABEL[k]}")
    await state.set_state(OrderS.player)
    await c.message.answer("👤 Premium beriladigan Telegram <b>@username</b> ni yuboring:")
    await c.answer()


# ============================ PUBG UC (bot orqali + Mini App) ============================
@user_r.message(F.text == "🎮 Donat / UC olish")
async def uc_menu(m: Message, state: FSMContext):
    await state.clear()
    url = (await kv_get("mini_url", MINI_APP_URL)) or ""
    pct = await discount_pct(m.from_user.id)
    rows = []
    for k in UC:
        p, _ = await final_price("uc", k, m.from_user.id)
        rows.append([(f"🎯 {k} UC — {fmt(p)} so'm", f"uc:{k}")])
    if url:
        is_web = url.startswith("https://") and "t.me/" not in url
        rows.append([("📱 Mini App orqali olish", ("web:" + url) if is_web else url)])
    rows.append([("🔙 Ortga", "home")])
    extra = f"\n🔥 <b>Sizga {pct}% chegirma amal qilmoqda!</b>" if pct else ""
    await m.answer("🎮 <b>PUBG Mobile UC (Donat)</b>\n\nUC paketini shu yerdan tanlang (balansdan yechiladi) yoki "
                   f"<b>Mini App</b> orqali oling 👇{extra}", reply_markup=kb(*rows))

@user_r.callback_query(F.data.startswith("uc:"))
async def uc_pick(c: CallbackQuery, state: FSMContext):
    k = int(c.data[3:])
    await state.update_data(kind="uc", key=k, label=f"{k} UC")
    await state.set_state(OrderS.player)
    await c.message.answer("🆔 PUBG Mobile <b>UID</b> raqamingizni yuboring:")
    await c.answer()


# ============================ BUYURTMA TASDIQI ============================
@user_r.message(OrderS.player)
async def order_player(m: Message, state: FSMContext):
    d = await state.get_data()
    t = (m.text or "").strip()
    if d["kind"] == "uc":
        if not t.isdigit() or not 6 <= len(t) <= 14: return await m.answer("❗ UID faqat raqamlardan iborat bo'lishi kerak.")
    elif not re.fullmatch(r"@?[A-Za-z0-9_]{4,32}", t):
        return await m.answer("❗ To'g'ri @username yuboring.")
    price, pct = await final_price(d["kind"], d["key"], m.from_user.id)
    u = await get_user(m.from_user.id)
    await state.update_data(player=t, price=price)
    await state.set_state(OrderS.confirm)
    warn = "\n\n⚠️ Username/UID noto'g'ri bo'lsa, xizmat qaytarilmaydi!"
    disc = f" (−{pct}%)" if pct else ""
    await m.answer(f"🧾 <b>Buyurtma</b>\n📦 {esc(d['label'])}\n👤 <code>{esc(t)}</code>\n💵 Narx: <b>{fmt(price)} so'm</b>{disc}\n"
                   f"💰 Balansingiz: {fmt(u['balance'])} so'm{warn}",
                   reply_markup=kb([("✅ Tasdiqlash", "oc:y"), ("❌ Bekor", "oc:n")]))

@user_r.callback_query(OrderS.confirm, F.data.startswith("oc:"))
async def order_confirm(c: CallbackQuery, state: FSMContext):
    d = await state.get_data()
    await state.clear()
    if c.data == "oc:n": return await c.message.edit_text("❌ Bekor qilindi.")
    await c.message.edit_text("⏳ Buyurtma bajarilmoqda...")
    r = await create_order(c.from_user.id, d["kind"], d["key"], d["player"], d["label"], d["price"], src="bot")
    s = r["state"]
    if s == "delivered":
        txt = (f"✅ Buyurtma #{r['oid']} muvaffaqiyatli bajarildi! 🎉\n📦 {esc(d['label'])} → 👤 <code>{esc(d['player'].lstrip('@'))}</code>\n"
               f"💵 Narx: {fmt(r['price'])} so'm\n\n🙏 Xaridingiz uchun rahmat!")
    elif s == "nofunds":
        return await c.message.edit_text("❌ Balansingizda mablag' yetarli emas.", reply_markup=kb([("📥 Pul kiritish", "topup")]))
    elif s == "failed":
        txt = "❌ Buyurtma bajarilmadi, mablag' balansingizga qaytarildi. Keyinroq urinib ko'ring."
    elif s == "review":
        txt = (f"⏳ Buyurtma #{r['oid']} tekshirilmoqda. Natija aniqlangach sizga xabar beramiz "
               f"(yetkazilmasa pul qaytariladi). Savol bo'lsa: {esc(ADMIN_CONTACT)}")
    else:
        txt = "🛠 Xizmat vaqtincha to'xtatilgan. Keyinroq urinib ko'ring."
    await c.message.edit_text(txt)


# ============================ BALANS, KABINET ============================
async def cabinet_text(uid):
    u = await get_user(uid)
    n = (await q("SELECT COUNT(*) c FROM orders WHERE user_id=? AND status='delivered'", (uid,), one=True))["c"]
    return ("👤 <b>Shaxsiy Kabinet & Profil</b>\n━━━━━━━━━━━━━━━━━━━\n"
            f"🆔 ID: <code>{uid}</code>\n👤 {uname(u)}\n━━━━━━━━━━━━━━━━━━━\n"
            f"💰 Asosiy balans: <b>{fmt(u['balance'])} so'm</b>\n"
            f"🛒 Jami xaridlar: {n} ta\n📅 Ro'yxatdan o'tgan: {u['joined'][:10]}\n━━━━━━━━━━━━━━━━━━━\nAmalni tanlang: 👇")

CAB_KB = kb([("📥 Hisobni to'ldirish", "topup")], [("📜 Xaridlar tarixi", "hist")],
            [("🤝 Hamkorlik (API)", "api")], [("🔙 Asosiy menyu", "home")])

@user_r.message(F.text.in_({"👤 Kabinet", "💰 Hisobim (Balans)"}))
async def cabinet(m: Message, state: FSMContext):
    await state.clear()
    await m.answer(await cabinet_text(m.from_user.id), reply_markup=CAB_KB)

@user_r.callback_query(F.data == "hist")
async def history(c: CallbackQuery):
    rows = await q("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 10", (c.from_user.id,))
    icons = {"delivered": "✅", "failed": "❌", "processing": "⏳", "review": "⏳", "refunded": "↩️"}
    t = "\n".join(f"{icons.get(r['status'], '•')} #{r['id']} {esc(r['detail'])} — {fmt(r['price'])} so'm ({r['created'][:10]})" for r in rows)
    await c.message.answer("📜 <b>So'nggi buyurtmalar</b>\n\n" + (t or "Hozircha yo'q."))
    await c.answer()


# ============================ PUL KIRITISH (qoidalar -> summa -> chek) ============================
async def topup_rules_text():
    custom = await kv_get("topup_rules")
    if custom: return custom
    mn = int(await kv_get("topup_min", 1000))
    return ("📥 <b>Hisobni to'ldirish — TO'LIQ QOIDALAR</b>\n\n"
            "Iltimos, davom etishdan oldin diqqat bilan o'qing:\n\n"
            "<b>1️⃣ Qanday ishlaydi?</b>\n"
            "• Kiritmoqchi bo'lgan summani yozasiz.\n"
            "• Bot sizga karta raqamini beradi va siz <b>aynan shu summani</b> o'tkazasiz.\n"
            "• To'lov <b>chekini (skrinshot)</b> botga yuborasiz.\n"
            "• Admin chekni tekshiradi va tasdiqlagach mablag' balansingizga tushadi, sizga xabar keladi.\n\n"
            f"<b>2️⃣ Minimal summa:</b> {fmt(mn)} so'm.\n\n"
            "<b>3️⃣ Chek talablari:</b>\n"
            "• Chekda summa, sana/vaqt va qabul qiluvchi karta aniq ko'rinishi kerak.\n"
            "• Tahrirlangan, soxta yoki boshqa odamning cheki yuborilsa — hisobingiz <b>doimiy bloklanadi</b>.\n"
            "• Bitta chek faqat bir marta ishlatiladi.\n\n"
            "<b>4️⃣ Summa:</b> Boshqa summa o'tkazilsa, balans haqiqatda tushgan summaga to'ldiriladi.\n\n"
            "<b>5️⃣ Qaytarish:</b> Balansga kiritilgan mablag' naqd qaytarilmaydi — faqat bot xizmatlariga sarflanadi.\n\n"
            f"<b>6️⃣ Muammo bo'lsa:</b> chekni saqlab qo'ying va {esc(ADMIN_CONTACT)} ga murojaat qiling.\n\n"
            "Qoidalar bilan rozi bo'lsangiz, «Tushundim» tugmasini bosing 👇")

async def show_topup_rules(target, state: FSMContext):
    await state.clear()
    await state.set_state(TopupS.rules)
    await target.answer(await topup_rules_text(),
                        reply_markup=kb([("✅ Tushundim, davom etish", "tpr:go")], [("❌ Bekor qilish", "cancel")]))

@user_r.message(F.text == "📥 Pul kiritish")
async def topup_msg(m: Message, state: FSMContext):
    await show_topup_rules(m, state)

@user_r.callback_query(F.data == "topup")
async def topup_cb(c: CallbackQuery, state: FSMContext):
    await show_topup_rules(c.message, state); await c.answer()

@user_r.callback_query(TopupS.rules, F.data == "tpr:go")
async def topup_go(c: CallbackQuery, state: FSMContext):
    mn = int(await kv_get("topup_min", 1000))
    await state.set_state(TopupS.amount)
    await c.message.answer(f"💵 Necha so'm kiritmoqchisiz? Summani raqamda yuboring (kamida {fmt(mn)}, masalan: 50000).",
                           reply_markup=kb([("❌ Bekor qilish", "cancel")]))
    await c.answer()

@user_r.message(TopupS.amount)
async def topup_amount(m: Message, state: FSMContext):
    mn = int(await kv_get("topup_min", 1000))
    t = (m.text or "").replace(" ", "")
    if not t.isdigit() or not mn <= int(t) <= 50_000_000:
        return await m.answer(f"❗ Summa {fmt(mn)} dan 50 000 000 gacha bo'lishi kerak. Raqam yuboring.")
    pend = (await q("SELECT COUNT(*) c FROM topups WHERE user_id=? AND status='pending'", (m.from_user.id,), one=True))["c"]
    if pend >= 3:
        await state.clear()
        return await m.answer("⏳ Sizda 3 ta tekshirilmagan so'rov bor. Avval ular ko'rib chiqilishini kuting.")
    card = await kv_get("card", CARD_INFO)
    await state.update_data(amount=int(t))
    await state.set_state(TopupS.check)
    await m.answer(f"💳 <b>{fmt(t)} so'm</b> o'tkazing:\n\n<code>{esc(card)}</code>\n\n"
                   "So'ng <b>to'lov chekini (rasm/skrinshot)</b> shu yerga yuboring 👇",
                   reply_markup=kb([("❌ Bekor qilish", "cancel")]))

@user_r.message(TopupS.check, F.photo | F.document)
async def topup_check(m: Message, state: FSMContext):
    d = await state.get_data()
    await state.clear()
    fid = m.photo[-1].file_id if m.photo else m.document.file_id
    tid = await ins("INSERT INTO topups(user_id,amount,file_id,created) VALUES(?,?,?,?)", (m.from_user.id, d["amount"], fid, now()))
    await m.answer("✅ Chek qabul qilindi. Admin tekshirgach, balansingizga tushadi.", reply_markup=MAIN_KB)
    t = await q("SELECT * FROM topups WHERE id=?", (tid,), one=True)
    for a in staff_with("tp"):
        try: await send_topup(a, t)
        except Exception: pass

@user_r.message(TopupS.check)
async def topup_check_wrong(m: Message):
    await m.answer("📎 Iltimos, to'lov chekini <b>rasm yoki fayl</b> ko'rinishida yuboring.")

async def send_topup(chat, t):
    u = await get_user(t["user_id"])
    cap = f"💳 <b>So'rov #{t['id']}</b>\n👤 {uname(u)} (<code>{u['id']}</code>)\n💵 {fmt(t['amount'])} so'm"
    k = kb([("✅ Tasdiqlash", f"tp_ok:{t['id']}"), ("❌ Rad etish", f"tp_no:{t['id']}")],
           [("✏️ Boshqa summa bilan tasdiqlash", f"tp_ed:{t['id']}")])
    try: await bot.send_photo(chat, t["file_id"], caption=cap, reply_markup=k)
    except Exception: await bot.send_document(chat, t["file_id"], caption=cap, reply_markup=k)


# ============================ HAMKORLIK (API) — FOYDALANUVCHI TOMONI ============================
async def docs_url():
    return (await kv_get("docs_url", DOCS_URL)) or DOCS_URL

async def docs_btn():
    """API hujjatini Telegram Mini App sifatida ochuvchi tugma."""
    return ("📖 API hujjat (Mini App)", "web:" + await docs_url())

async def api_base_url():
    return ((await kv_get("api_url")) or API_PUBLIC_URL or "https://SIZNING-DOMEN").rstrip("/")

async def active_key(uid):
    return await q("SELECT * FROM api_keys WHERE user_id=? AND status='active'", (uid,), one=True)

async def can_get_key(uid):
    if await kv_get("api_public", "0") == "1": return True
    r = await q("SELECT status FROM api_requests WHERE user_id=?", (uid,), one=True)
    return bool(r and r["status"] == "ok")

async def issue_key(uid):
    old = await active_key(uid)
    pct = old["pct"] if old else 0
    await ex("UPDATE api_keys SET status='revoked' WHERE user_id=? AND status='active'", (uid,))
    raw = "sk_" + secrets.token_urlsafe(32)
    await ins("INSERT INTO api_keys(user_id,key_hash,key_prefix,pct,created) VALUES(?,?,?,?,?)", (uid, sha(raw), raw[:10], pct, now()))
    return raw

async def api_home(uid):
    k = await active_key(uid)
    req = await q("SELECT status FROM api_requests WHERE user_id=?", (uid,), one=True)
    on = await kv_get("api_on", "1") == "1"
    text = ("🤝 <b>API va Reseller (Dilerlik) markazi</b>\n\n"
            "O'z botingiz yoki saytingizda mijozlarga <b>Telegram Stars</b> va <b>Premium</b> soting — "
            "buyurtma API orqali avtomatik bajariladi, pul botdagi balansingizdan yechiladi.\n\n"
            "💲 API narxlari botdagi narxlardan alohida (odatda arzonroq) va chegirmalarga bog'liq emas.\n"
            "💳 To'lov: botdagi balansingiz (Pul kiritish orqali to'ldiriladi).\n"
            "📱 To'liq hujjat — <b>Mini App</b> ko'rinishida, pastdagi tugmada.\n\n")
    rows = []
    if not on:
        text += "🛠 API hozircha vaqtincha o'chirilgan."
    elif k:
        text += (f"🔑 Faol kalit: <code>{esc(k['key_prefix'])}…</code>\n📈 So'rovlar: {k['calls']} ta\n"
                 f"💵 Balans: {fmt((await get_user(uid))['balance'])} so'm")
        rows += [[("🔑 Yangi kalit yaratish", "api:new")], [("📖 Hujjat", "api:doc"), ("💲 API narxlari", "api:pr")]]
    elif await can_get_key(uid):
        text += "✅ Sizga API ruxsat berilgan."
        rows.append([("🔑 API kalit olish", "api:new")])
    elif req and req["status"] == "pending":
        text += "⏳ So'rovingiz admin tomonidan ko'rib chiqilmoqda."
    elif req and req["status"] == "no":
        text += f"❌ So'rovingiz rad etilgan. Savol bo'lsa: {esc(ADMIN_CONTACT)}"
    else:
        text += "API olish uchun so'rov yuboring — admin ko'rib chiqadi."
        rows.append([("📨 So'rov yuborish", "api:req")])
    rows.append([await docs_btn()])
    rows.append([("📞 Admin bilan bog'lanish", tme(ADMIN_CONTACT))])
    rows.append([("🔙 Asosiy menyu", "home")])
    return text, kb(*rows)

@user_r.message(F.text == "🤝 Hamkorlik (API)")
async def api_msg(m: Message, state: FSMContext):
    await state.clear()
    t, k = await api_home(m.from_user.id)
    await m.answer(t, reply_markup=k)

@user_r.callback_query(F.data == "api")
async def api_cb(c: CallbackQuery):
    t, k = await api_home(c.from_user.id)
    await c.message.answer(t, reply_markup=k); await c.answer()

@user_r.callback_query(F.data == "api:req")
async def api_req(c: CallbackQuery):
    uid = c.from_user.id
    if await q("SELECT 1 FROM api_requests WHERE user_id=?", (uid,), one=True):
        return await c.answer("So'rov allaqachon yuborilgan", show_alert=True)
    await ex("INSERT INTO api_requests(user_id,status,created) VALUES(?,?,?)", (uid, "pending", now()))
    u = await get_user(uid)
    await notify_staff("api", f"📨 <b>API so'rovi</b>\n👤 {uname(u)} (<code>{uid}</code>)\n💰 Balans: {fmt(u['balance'])} so'm",
                       kb([("✅ Ruxsat berish", f"apr_ok:{uid}"), ("❌ Rad etish", f"apr_no:{uid}")]))
    await c.message.answer("✅ So'rov yuborildi. Admin javobini kuting.")
    await c.answer()

@user_r.callback_query(F.data == "api:new")
async def api_new(c: CallbackQuery):
    uid = c.from_user.id
    if await kv_get("api_on", "1") != "1": return await c.answer("API vaqtincha o'chirilgan", show_alert=True)
    if not (await active_key(uid) or await can_get_key(uid)):
        return await c.answer("Sizga hali ruxsat berilmagan", show_alert=True)
    raw = await issue_key(uid)
    await c.message.answer("🔑 <b>Sizning API kalitingiz</b> (faqat hozir ko'rsatiladi, saqlab oling!):\n\n"
                           f"<code>{raw}</code>\n\n⚠️ Kalitni hech kimga bermang. Yangi kalit yaratilsa, eskisi o'chadi.\n"
                           "📖 Hujjat: pastdagi tugma orqali ochasiz 👇", reply_markup=kb([await docs_btn()], [("📖 Hujjat (chatda)", "api:doc")]))
    await c.answer()

@user_r.callback_query(F.data == "api:pr")
async def api_prices_user(c: CallbackQuery):
    k = await active_key(c.from_user.id)
    pct = k["pct"] if k else 0
    lines = [f"⭐ Stars: <b>{fmt(await api_price('st', 1, pct))} so'm</b> / 1 Stars (50 – 10000)", "", "💎 Premium:"]
    for m_ in PREM: lines.append(f"• {PREMIUM_LABEL[m_]}: <b>{fmt(await api_price('pr', m_, pct))} so'm</b>")
    await c.message.answer("💲 <b>API narxlari</b>\n\n" + "\n".join(lines)); await c.answer()

@user_r.callback_query(F.data == "api:doc")
async def api_doc(c: CallbackQuery):
    u = esc(await api_base_url())
    curl_stars = (f"curl -X POST {u}/api/v1/orders \\\n"
                  ' -H "X-API-Key: sk_..." \\\n'
                  ' -H "Content-Type: application/json" \\\n'
                  ' -d \'{"type":"stars","username":"durov","amount":100,"external_ref":"ord-1"}\'')
    text = ("📖 <b>API hujjati</b> 🚀\n\n"
            f"🌐 Base URL: <code>{u}/api/v1</code>\n"
            "🔐 Sarlavha: <code>X-API-Key: sk_...</code>\n"
            f"⏱ Limit: daqiqasiga {API_RATE_LIMIT} ta so'rov\n\n"
            "🧭 <b>Endpointlar</b>\n"
            "👤 <b>GET /me</b> — balans va ma'lumot\n"
            "💲 <b>GET /prices</b> — sizning narxlaringiz\n"
            "🛒 <b>POST /orders</b> — buyurtma berish\n"
            "🔍 <b>GET /orders/{id}</b> — buyurtma holati\n"
            "🧾 <b>GET /orders</b> — so'nggi buyurtmalar\n\n"
            "⭐ <b>Stars buyurtma:</b>\n"
            f"<pre>{curl_stars}</pre>\n"
            "💎 <b>Premium buyurtma:</b>\n"
            '<pre>{"type":"premium","username":"durov","months":3,"external_ref":"ord-2"}</pre>\n'
            "📨 <b>Javob:</b>\n"
            '<pre>{"success":true,"order":{"id":15,"status":"completed","price":19000},"balance":81000}</pre>\n'
            "📌 <b>Holatlar:</b> ✅ completed | ⏳ pending | ❌ failed | ↩️ refunded\n"
            "🚨 <b>Xatolar:</b> 401 kalit noto'g'ri, 402 balans yetmaydi, 400 noto'g'ri ma'lumot, "
            "429 limit, 502 bajarilmadi (pul qaytarildi).\n\n"
            "💡 <code>external_ref</code> — o'z buyurtma raqamingiz: bir xil ref bilan qayta yuborsangiz, ikki marta yechilmaydi.\n\n"
            "📱 To'liq va qulay hujjat — pastdagi <b>Mini App</b> tugmasida 👇")
    await c.message.answer(text, reply_markup=kb([await docs_btn()], [("🔙 Ortga", "api")]))
    await c.answer()


# ============================ YORDAM ============================
@user_r.message(F.text == "ℹ️ Yordam")
async def help_msg(m: Message):
    await m.answer(
        "ℹ️ <b>Yordam va bot qoidalari</b> 📚\n\n"
        "📦 <b>1. Buyurtmalar:</b> Stars/Premium odatda 1 soniyadan 5 daqiqagacha bajariladi ⚡️\n\n"
        "⚠️ <b>2. Username xatoligi:</b> Noto'g'ri kiritilgan username uchun yuborilgan xizmat qaytarilmaydi!\n\n"
        "💳 <b>3. Balans:</b> Kiritilgan mablag' qaytarilmaydi (faqat xizmatlarga sarflanadi). Chekda xatolik bo'lsa, "
        f"{esc(ADMIN_CONTACT)} ga murojaat qiling 🙏\n\n"
        "🤝 <b>4. API:</b> Qoidabuzarlik (spam, firibgarlik) bo'lsa, API kalit ogohlantirishsiz bloklanadi 🚫\n\n"
        "📖 <b>5. API hujjat:</b> pastdagi Mini App tugmasi orqali oching.\n\n"
        "📞 Texnik yordam: 24/7 🕐",
        reply_markup=kb([await docs_btn()], [("📞 Admin bilan bog'lanish", tme(ADMIN_CONTACT))]))


# ============================ REFERAL ============================
async def season_top(season, offset, limit):
    return await q("SELECT inviter, COUNT(*) c FROM referrals WHERE season=? GROUP BY inviter ORDER BY c DESC, MIN(created) LIMIT ? OFFSET ?",
                   (season, limit, offset))

async def render_top(rows, offset):
    lines = []
    for i, r in enumerate(rows, offset + 1):
        u = await get_user(r["inviter"])
        medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(i, f"{i}.")
        lines.append(f"{medal} {uname(u) if u else r['inviter']} — <b>{r['c']}</b> ta")
    return "\n".join(lines) or "Hozircha ma'lumot yo'q."

@user_r.message(F.text == "👥 Referal")
async def ref_menu(m: Message):
    season = int(await kv_get("season"))
    mine = (await q("SELECT COUNT(*) c FROM referrals WHERE inviter=? AND season=?", (m.from_user.id, season), one=True))["c"]
    await m.answer(f"👥 <b>Referal tizimi</b> (mavsum #{season})\n\n🔗 Sizning havolangiz:\n"
                   f"<code>https://t.me/{BOT_USERNAME}?start=r{m.from_user.id}</code>\n\n"
                   f"Siz taklif qilganlar: <b>{mine}</b> ta",
                   reply_markup=kb([("🏆 Top 20", "rtop:0")], [("🔙 Asosiy menyu", "home")]))

@user_r.callback_query(F.data.startswith("rtop:"))
async def ref_top(c: CallbackQuery):
    page = int(c.data[5:])
    rows = await season_top(int(await kv_get("season")), page * 10, 10)
    nav = []
    if page > 0: nav.append(("⬅️ Oldingi sahifa", f"rtop:{page-1}"))
    if page < 1: nav.append(("➡️ Keyingi sahifa", f"rtop:{page+1}"))
    await c.message.edit_text("🏆 <b>Top 20 — eng ko'p taklif qilganlar</b>\n\n" + await render_top(rows, page * 10),
                              reply_markup=kb(nav, [("🔙 Ortga", "home")]))
    await c.answer()


# ============================ KONKURSLAR: YARATISH ============================
@user_r.message(F.text == "🎁 Konkurslar")
async def contests_menu(m: Message, state: FSMContext):
    await state.clear()
    await m.answer("🎁 <b>Konkurslar</b>", reply_markup=kb([("Konkurs yaratish 🎲", "cc:new"), ("Mening konkurslarim 🗃", "cc:my")],
                                                          [("🔙 Asosiy menyu", "home")]))

@user_r.callback_query(F.data == "cc:new")
async def cc_new(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await state.set_state(CC.post)
    await c.message.answer("<b><i>Konkurs yaratish</i></b>\n\n📨 Konkurs uchun postni yuboring. Post matnli, rasmli, videoli yoki GIF "
                           "bo'lishi mumkin. Telegram Premium orqali yasalgan Rich-formatlangan postlar ham qabul qilinadi.",
                           reply_markup=kb([("❌ Bekor qilish", "cancel")]))
    await c.answer()

@user_r.message(CC.post)
async def cc_post(m: Message, state: FSMContext):
    await state.update_data(src_chat=m.chat.id, src_msg=m.message_id, style=None)
    await state.set_state(CC.btn)
    await m.answer("✅ <b>Post qabul qilindi!</b>\n\n🎨 Ishtirok tugmasi rangini tanlang:",
                   reply_markup=kb([("✅", "cb:none"), ("🔵", "cb:primary", "primary"),
                                    ("🔴", "cb:danger", "danger"), ("🟢", "cb:success", "success")]))
    await m.answer("⌨️ Tugma matnini yuboring yoki variantlardan birini tanlang.\n"
                   "❕ Matn boshiga premium emoji qo'shishingiz mumkin.\n📍 Tugma joyi (post ostida / eng pastda) oxirida tanlanadi.",
                   reply_markup=kb([("Ishtirok etaman!", "bt:Ishtirok etaman!")], [("Qatnashish", "bt:Qatnashish")],
                                   [("Ishtirok etish 🚀", "bt:Ishtirok etish 🚀")]))

@user_r.callback_query(CC.btn, F.data.startswith("cb:"))
async def cc_color(c: CallbackQuery, state: FSMContext):
    v = c.data[3:]
    await state.update_data(style=None if v == "none" else v)
    await c.answer("Rang tanlandi ✔️")

async def cc_ask_pos(target: Message, state: FSMContext, text):
    await state.update_data(btn_text=text)
    await state.set_state(CC.pos)
    await target.answer("📍 Tugma qayerda bo'lsin?",
                        reply_markup=kb([("Post ostida (klassik)", "cp:under")], [("Post pastida (alohida xabar)", "cp:below")]))

@user_r.callback_query(CC.btn, F.data.startswith("bt:"))
async def cc_btn_preset(c: CallbackQuery, state: FSMContext):
    await cc_ask_pos(c.message, state, c.data[3:]); await c.answer()

@user_r.message(CC.btn, F.text)
async def cc_btn_text(m: Message, state: FSMContext):
    await cc_ask_pos(m, state, m.text[:60])

@user_r.callback_query(CC.pos, F.data.startswith("cp:"))
async def cc_pos(c: CallbackQuery, state: FSMContext):
    await state.update_data(pos=c.data[3:])
    await state.set_state(CC.target)
    await c.message.answer("📢 Konkurs e'lon qilinadigan <b>kanal</b> @username yoki ID (-100...) sini yuboring.\n"
                           "Bot o'sha kanalda <b>admin</b> bo'lishi shart, siz ham kanal admini bo'lishingiz kerak.")
    await c.answer()

def norm_chat_ref(t):
    t = t.strip()
    if re.fullmatch(r"-?\d+", t): return int(t)
    return t if t.startswith("@") else "@" + t

async def chat_link(chat):
    if chat.username: return tme(chat.username)
    try: return (await bot.create_chat_invite_link(chat.id)).invite_link
    except Exception: return None

@user_r.message(CC.target)
async def cc_target(m: Message, state: FSMContext):
    try:
        chat = await bot.get_chat(norm_chat_ref(m.text or ""))
        me = await bot.get_chat_member(chat.id, bot.id)
        if me.status != "administrator": raise ValueError("bot admin emas")
        if not is_admin(m.from_user.id):
            um = await bot.get_chat_member(chat.id, m.from_user.id)
            if um.status not in ("administrator", "creator"): raise ValueError("siz admin emassiz")
        link = await chat_link(chat)
    except Exception as e:
        return await m.answer(f"❌ Kanal topilmadi yoki ruxsat yo'q ({esc(e)}). Bot va siz kanal admini ekanligini tekshiring.")
    await state.update_data(target=chat.id, target_title=chat.title, target_link=link, target_user=chat.username)
    await state.set_state(CC.sponsors)
    await m.answer(f"✅ Kanal: <b>{esc(chat.title)}</b>\n\n📢 Endi majburiy obuna bo'lish kerak bo'lgan <b>homiy kanallar</b> "
                   "usernamesini yuboring (bir nechta bo'lsa bo'sh joy bilan). Bot ularda ham <b>admin</b> bo'lishi shart. "
                   "Homiy kerak bo'lmasa <code>-</code> yuboring.\n(Konkurs kanalining o'ziga obuna avtomatik talab qilinadi.)")

@user_r.message(CC.sponsors)
async def cc_sponsors(m: Message, state: FSMContext):
    d = await state.get_data()
    sp = []
    if (m.text or "").strip() != "-":
        for t in (m.text or "").split():
            try:
                chat = await bot.get_chat(norm_chat_ref(t))
                me = await bot.get_chat_member(chat.id, bot.id)
                if me.status != "administrator": raise ValueError("bot admin emas")
                sp.append({"id": chat.id, "username": chat.username, "title": chat.title, "link": await chat_link(chat)})
            except Exception as e:
                return await m.answer(f"❌ {esc(t)}: {esc(e)}. Bot u yerda admin bo'lishi shart. Qayta yuboring.")
    if d["target"] not in [s["id"] for s in sp]:
        sp.insert(0, {"id": d["target"], "username": d.get("target_user"), "title": d["target_title"], "link": d.get("target_link")})
    await state.update_data(sponsors=sp)
    await state.set_state(CC.winners)
    await m.answer("🏆 G'oliblar sonini yuboring (masalan: 3):")

@user_r.message(CC.winners)
async def cc_winners(m: Message, state: FSMContext):
    if not (m.text or "").isdigit() or not 1 <= int(m.text) <= 100: return await m.answer("❗ 1 dan 100 gacha son yuboring.")
    await state.update_data(winners=int(m.text))
    await state.set_state(CC.mode)
    await m.answer("🎲 Konkurs turini tanlang:",
                   reply_markup=kb([("🎲 Oddiy (tasodifiy g'olib)", "cm:random")], [("👥 Referalli (eng ko'p taklif qilgan yutadi)", "cm:ref")]))

@user_r.callback_query(CC.mode, F.data.startswith("cm:"))
async def cc_mode(c: CallbackQuery, state: FSMContext):
    await state.update_data(mode=c.data[3:])
    await state.set_state(CC.ends)
    await c.message.answer("⏰ Konkurs qancha vaqtdan so'ng <b>avtomatik yakunlansin</b>?\n\n"
                           "🕐 Soat: <code>24</code> yoki <code>12h</code>\n📆 Kun: <code>3d</code> (ko'pi bilan 30 kun)\n"
                           "✍️ O'zim qo'lda yakunlayman: <code>-</code>")
    await c.answer()

def parse_ends(t):
    """(datetime|None, to'g'rimi)"""
    t = t.strip().lower()
    if t in ("-", "0"): return None, True
    m_ = re.fullmatch(r"(\d{1,3})\s*([hd]?)", t)
    if not m_: return None, False
    n, u = int(m_.group(1)), m_.group(2) or "h"
    delta = timedelta(days=n) if u == "d" else timedelta(hours=n)
    if delta <= timedelta(0) or delta > timedelta(days=30): return None, False
    return datetime.now() + delta, True

@user_r.message(CC.ends)
async def cc_ends(m: Message, state: FSMContext):
    dt, ok = parse_ends(m.text or "")
    if not ok: return await m.answer("❗ Format noto'g'ri. Masalan: <code>24</code>, <code>3d</code> yoki <code>-</code>")
    await state.update_data(ends=dt.strftime("%Y-%m-%d %H:%M:%S") if dt else None)
    d = await state.get_data()
    await state.set_state(CC.confirm)
    sp = ", ".join(esc(s["title"] or s["username"]) for s in d["sponsors"])
    await m.answer(f"📋 <b>Konkurs tayyor</b>\n\n📢 Kanal: {esc(d['target_title'])}\n🔘 Tugma: {esc(d['btn_text'])}\n"
                   f"📌 Majburiy obuna: {sp}\n🏆 G'oliblar: {d['winners']}\n"
                   f"🎲 Tur: {'Referalli' if d['mode'] == 'ref' else 'Oddiy (adolatli, tekshiriladigan)'}\n"
                   f"⏰ Tugash: {d['ends'] or 'qo`lda'}\n\nHammasi tayyor bo'lsa, ishga tushiring:",
                   reply_markup=kb([("✅ Konkursni ishga tushirish", "cc:go")], [("❌ Bekor qilish", "cancel")]))

def contest_kb(c):
    """«Qatnashish» bosilganda foydalanuvchi botga o'tadi va /start avtomatik bosiladi."""
    rows = [[(c["btn_text"], f"https://t.me/{BOT_USERNAME}?start=join_{c['id']}", c["btn_style"])]]
    if c["mode"] == "ref": rows.append([("🏆 Top 20", f"ctop:{c['id']}")])
    return kb(*rows)

@user_r.callback_query(CC.confirm, F.data == "cc:go")
async def cc_go(c: CallbackQuery, state: FSMContext):
    d = await state.get_data()
    await state.clear()
    cid = await ins("INSERT INTO contests(owner,src_chat,src_msg,btn_text,btn_style,btn_pos,target_chat,target_title,sponsors,winners,mode,created,ends) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (c.from_user.id, d["src_chat"], d["src_msg"], d["btn_text"], d["style"], d["pos"], d["target"],
                     d["target_title"], json.dumps(d["sponsors"]), d["winners"], d["mode"], now(), d.get("ends")))
    row = await q("SELECT * FROM contests WHERE id=?", (cid,), one=True)
    try:
        if d["pos"] == "under":
            msg = await bot.copy_message(d["target"], d["src_chat"], d["src_msg"], reply_markup=contest_kb(row))
        else:
            msg = await bot.copy_message(d["target"], d["src_chat"], d["src_msg"])
            await bot.send_message(d["target"], "👇 Ishtirok etish uchun tugmani bosing", reply_markup=contest_kb(row))
        await ex("UPDATE contests SET msg_id=? WHERE id=?", (msg.message_id, cid))
    except Exception as e:
        await ex("UPDATE contests SET status='error' WHERE id=?", (cid,))
        return await c.message.answer(f"❌ Kanalga yuborib bo'lmadi: {esc(e)}")
    await c.message.answer(f"🚀 Konkurs #{cid} ishga tushdi!")
    await c.answer()


# ============================ KONKURS: ISHTIROK ============================
async def do_join(uid, c):
    """Ishtirokchini yozadi. Qaytaradi: (matn, markup)."""
    cid = c["id"]
    already = await q("SELECT 1 FROM cparts WHERE cid=? AND uid=?", (cid, uid), one=True)
    if not already:
        await ex("INSERT OR IGNORE INTO cparts(cid,uid,joined) VALUES(?,?,?)", (cid, uid, now()))
        inv = await q("SELECT inviter FROM cinv WHERE cid=? AND invited=?", (cid, uid), one=True)
        if inv:
            await ex("UPDATE cinv SET ok=1 WHERE cid=? AND invited=?", (cid, uid))
            cnt = (await q("SELECT COUNT(*) c FROM cinv WHERE cid=? AND inviter=? AND ok=1", (cid, inv["inviter"]), one=True))["c"]
            try: await bot.send_message(inv["inviter"], f"🎉 Do'stingiz konkursga qo'shildi! Sizning takliflaringiz: <b>{cnt}</b> ta")
            except Exception: pass
    total = (await q("SELECT COUNT(*) c FROM cparts WHERE cid=?", (cid,), one=True))["c"]
    num = (await q("SELECT COUNT(*) c FROM cparts WHERE cid=? AND rowid<=(SELECT rowid FROM cparts WHERE cid=? AND uid=?)",
                   (cid, cid, uid), one=True))["c"]
    head = "ℹ️ Siz allaqachon ishtirokchisiz!" if already else "✅ <b>Siz konkursda qatnashyapsiz!</b>"
    text = (f"{head}\n\n🎁 Konkurs: <b>{esc(c['target_title'])}</b>\n🎟 Sizning raqamingiz: <b>№{num}</b>\n"
            f"👥 Hozirgi ishtirokchilar: <b>{total}</b>\n🏆 G'oliblar soni: <b>{c['winners']}</b>\n")
    markup = None
    if c["mode"] == "ref":
        text += ("\n👥 Bu <b>referalli</b> konkurs: eng ko'p do'st taklif qilgan yutadi.\n🔗 Sizning havolangiz:\n"
                 f"<code>https://t.me/{BOT_USERNAME}?start=c{cid}_{uid}</code>")
        markup = kb([("🏆 Top 20", f"ctop:{cid}")])
    else:
        text += "\n🍀 Omad tilaymiz! G'oliblar tekshiriladigan adolatli usulda e'lon qilinadi."
    return text, markup

async def join_flow(target: Message, uid, cid):
    c = await q("SELECT * FROM contests WHERE id=?", (cid,), one=True)
    if not c:
        return await target.answer("❌ Konkurs topilmadi.", reply_markup=MAIN_KB)
    if c["status"] != "active":
        return await target.answer("🏁 Bu konkurs allaqachon yakunlangan.", reply_markup=MAIN_KB)
    miss = await missing_channels(uid, cid)
    if miss: return await send_gate(target, miss, cid)
    text, markup = await do_join(uid, c)
    await target.answer(text, reply_markup=markup)
    await target.answer("👇 Asosiy menyu", reply_markup=MAIN_KB)

@user_r.callback_query(F.data.startswith("join:"))
async def join_cb(c: CallbackQuery):
    """Eski postlardagi tugmalar uchun: botga yo'naltiradi."""
    await c.answer(url=f"https://t.me/{BOT_USERNAME}?start=join_{int(c.data[5:])}")

@user_r.callback_query(F.data.startswith("ctop:"))
async def ctop_cb(c: CallbackQuery):
    cid = int(c.data[5:])
    rows = await q("SELECT inviter, COUNT(*) c FROM cinv WHERE cid=? AND ok=1 GROUP BY inviter ORDER BY c DESC LIMIT 20", (cid,))
    lines = []
    for i, r in enumerate(rows, 1):
        u = await get_user(r["inviter"])
        lines.append(f"{i}. {(('@' + u['username']) if u and u['username'] else (u['name'] if u else r['inviter']))} — {r['c']}")
    await c.answer(("🏆 TOP 20\n" + "\n".join(lines))[:190] if lines else "Hozircha yo'q", show_alert=True)


# ============================ KONKURSLARIM ============================
@user_r.callback_query(F.data == "cc:my")
async def cc_my(c: CallbackQuery):
    rows = await q("SELECT * FROM contests WHERE owner=? ORDER BY id DESC LIMIT 20", (c.from_user.id,))
    if not rows: return await c.answer("Sizda konkurs yo'q", show_alert=True)
    btns = [[(f"{'🟢' if r['status'] == 'active' else '🔴'} #{r['id']} — {r['target_title']}", f"cv:{r['id']}")] for r in rows]
    await c.message.answer("🗃 <b>Mening konkurslarim</b>", reply_markup=kb(*btns))
    await c.answer()

def can_manage(uid, c): return c["owner"] == uid or has_perm(uid, "ct")

@user_r.callback_query(F.data.startswith("cv:"))
async def cc_view(c: CallbackQuery):
    cid = int(c.data[3:])
    r = await q("SELECT * FROM contests WHERE id=?", (cid,), one=True)
    if not r or not can_manage(c.from_user.id, r): return await c.answer("Topilmadi")
    n = (await q("SELECT COUNT(*) c FROM cparts WHERE cid=?", (cid,), one=True))["c"]
    rows = [[("📄 Ishtirokchilar ro'yxati (.txt)", f"cl:{cid}")]]
    if r["status"] == "active": rows.insert(0, [("🏁 Yakunlash va g'olib tanlash", f"cf:{cid}")])
    extra = f"\n🔐 Seed: <code>{r['seed']}</code>" if r["seed"] else ""
    await c.message.answer(f"🎁 Konkurs #{cid}\n📢 {esc(r['target_title'])}\n👥 Ishtirokchilar: {n}\n🏆 G'oliblar: {r['winners']}\n"
                           f"⏰ Tugash: {r['ends'] or 'qo`lda'}\n📌 Holat: {r['status']}{extra}", reply_markup=kb(*rows))
    await c.answer()

@user_r.callback_query(F.data.startswith("cl:"))
async def cc_list(c: CallbackQuery):
    cid = int(c.data[3:])
    r = await q("SELECT * FROM contests WHERE id=?", (cid,), one=True)
    if not r or not can_manage(c.from_user.id, r): return await c.answer("Topilmadi")
    rows = await q("SELECT p.uid, p.joined, u.username, u.name FROM cparts p LEFT JOIN users u ON u.id=p.uid WHERE p.cid=? ORDER BY p.joined, p.rowid", (cid,))
    txt = "\n".join(f"{i}. {x['uid']} | {('@' + x['username']) if x['username'] else '-'} | {x['name'] or '-'} | {x['joined']}"
                    for i, x in enumerate(rows, 1)) or "Ro'yxat bo'sh"
    await c.message.answer_document(BufferedInputFile(txt.encode("utf-8"), filename=f"konkurs_{cid}_ishtirokchilar.txt"))
    await c.answer()


# ============================ G'OLIB ANIQLASH (animatsiya + tekshiriladigan usul) ============================
def draw(seed, parts, n):
    """Seed asosida deterministik tanlash: har bir g'olib = SHA-256(seed:tartib:qolgan) mod qolgan. Hamma tekshira oladi."""
    pool, res = list(parts), []
    for i in range(n):
        h = int(hashlib.sha256(f"{seed}:{i}:{len(pool)}".encode()).hexdigest(), 16)
        res.append(pool.pop(h % len(pool)))
    return res

def mask(u, uid):
    name = ("@" + u["username"]) if u and u["username"] else ((u["name"] if u else None) or f"ID{uid}")
    name = re.sub(r"\s+", " ", str(name)).strip() or f"ID{uid}"
    return name[0] + "***" if len(name) <= 3 else f"{name[:2]}***{name[-1]}"

async def safe_edit(chat_id, msg_id, text):
    for _ in range(2):
        try:
            await bot.edit_message_text(text, chat_id=chat_id, message_id=msg_id)
            return True
        except TelegramRetryAfter as e:
            await asyncio.sleep(min(e.retry_after, 6))
        except Exception:
            return False
    return False

MEDALS = {1: "🥇", 2: "🥈", 3: "🥉"}

async def announce(c, parts, winners, seed, commit, plist):
    chat, total, is_ref = c["target_chat"], len(parts), c["mode"] == "ref"
    users = {w: await get_user(w) for w in winners}
    pool = [mask(await get_user(u), u) for u in random.sample(parts, min(total, 25))]
    head = f"🎰 <b>G'OLIBLAR ANIQLANMOQDA</b>\n\n👥 Ishtirokchilar: <b>{total}</b>\n🏆 G'oliblar soni: <b>{len(winners)}</b>\n"
    if not is_ref: head += f"🔐 Commit (SHA-256): <code>{commit}</code>\n"
    m = await bot.send_message(chat, head + "\n🎲 Barabanlar aylanmoqda...")
    sym = ["🎲", "🍀", "⭐", "💎", "🔥", "🎯", "🎰"]
    for i, dl in enumerate([0.9, 0.9, 1.0, 1.2, 1.5, 1.8, 2.2, 2.6]):
        await safe_edit(chat, m.message_id, head + f"\n{sym[i % 7]} ┃ <b>{esc(random.choice(pool))}</b> ┃ {sym[(i + 3) % 7]}")
        await asyncio.sleep(dl)
    lines = [f"{MEDALS.get(i, str(i) + '.')} {mention(users[w], w)}" for i, w in enumerate(winners, 1)]
    title = head.replace("ANIQLANMOQDA", "ANIQLANDI")
    for i in range(1, min(len(lines), 5) + 1):   # g'oliblar birma-bir ochiladi
        await safe_edit(chat, m.message_id, title + "\n" + "\n".join(lines[:i]) + ("\n\n🥁 ..." if i < len(lines) else ""))
        await asyncio.sleep(1.4)
    shown, rest = lines[:50], lines[50:]
    proof = ("" if is_ref else
             "\n\n🔐 <b>Adolat kafolati</b>\nG'olib = SHA-256(seed:tartib:qolgan) bo'yicha tanlangan. Commit yuqorida e'lon qilingan edi.\n"
             f"Seed: <code>{seed}</code>\nRo'yxat hash: <code>{plist}</code>")
    final = (f"🏁 <b>KONKURS YAKUNLANDI!</b>\n\n👥 Jami ishtirokchilar: <b>{total}</b>\n\n🏆 <b>G'oliblar:</b>\n" + "\n".join(shown) +
             ("\n\n🎉 Tabriklaymiz!" if not is_ref else "\n\n🎉 Tabriklaymiz! (Eng ko'p taklif qilganlar)") + proof)
    if not await safe_edit(chat, m.message_id, final):
        await bot.send_message(chat, final)
    for i in range(0, len(rest), 50):
        await bot.send_message(chat, "\n".join(rest[i:i + 50]))

async def finish_contest(cid):
    """Konkursni yakunlaydi (tugma yoki taymer). Qaytaradi: (ok, matn)"""
    if not await ex("UPDATE contests SET status='finishing' WHERE id=? AND status='active'", (cid,)):
        return False, "Konkurs faol emas."
    announced = False
    try:
        c = await q("SELECT * FROM contests WHERE id=?", (cid,), one=True)
        parts = [r["uid"] for r in await q("SELECT uid FROM cparts WHERE cid=? ORDER BY joined, rowid", (cid,))]
        if not parts:
            await ex("UPDATE contests SET status='finished' WHERE id=?", (cid,))
            try: await bot.send_message(c["target_chat"], "🏁 Konkurs yakunlandi, ammo ishtirokchilar bo'lmadi.")
            except Exception: pass
            return True, "Ishtirokchi bo'lmadi."
        n = min(c["winners"], len(parts))
        seed = secrets.token_hex(16); commit = sha(seed); plist = sha(",".join(map(str, parts)))
        if c["mode"] == "ref":
            rows = await q("SELECT p.uid FROM cparts p LEFT JOIN (SELECT inviter, COUNT(*) c FROM cinv WHERE cid=? AND ok=1 GROUP BY inviter) i "
                           "ON i.inviter=p.uid WHERE p.cid=? ORDER BY COALESCE(i.c,0) DESC, p.joined LIMIT ?", (cid, cid, n))
            winners = [x["uid"] for x in rows]
        else:
            winners = draw(seed, parts, n)
        try:
            await announce(c, parts, winners, seed, commit, plist)
            announced = True
        except Exception as e:
            log.exception("announce")
            await bot.send_message(c["owner"], f"⚠️ Kanalga e'lon qilib bo'lmadi: {esc(e)}. G'oliblar quyida.")
        await ex("UPDATE contests SET status='finished', seed=?, result=? WHERE id=?",
                 (seed, json.dumps({"winners": winners, "plist": plist, "total": len(parts)}), cid))
        names = []
        for i, w in enumerate(winners, 1):
            names.append(f"{i}. {mention(await get_user(w), w)}")
            try: await bot.send_message(w, f"🎉 Tabriklaymiz! Siz «{esc(c['target_title'])}» konkursida g'olib bo'ldingiz!")
            except Exception: pass
        return True, ("✅ Konkurs yakunlandi, g'oliblar" + (" e'lon qilindi:\n" if announced else ":\n") + "\n".join(names))
    except Exception as e:
        log.exception("finish_contest")
        if not announced: await ex("UPDATE contests SET status='active' WHERE id=? AND status='finishing'", (cid,))
        return False, f"Xatolik: {esc(e)}"

@user_r.callback_query(F.data.startswith("cf:"))
async def cc_finish(c: CallbackQuery):
    cid = int(c.data[3:])
    r = await q("SELECT * FROM contests WHERE id=?", (cid,), one=True)
    if not r or r["status"] != "active" or not can_manage(c.from_user.id, r):
        return await c.answer("Mumkin emas", show_alert=True)
    await c.answer("⏳ G'oliblar aniqlanmoqda...")
    ok, txt = await finish_contest(cid)
    await c.message.answer(txt)

async def contest_watcher():
    """Belgilangan vaqtda konkurslarni avtomatik yakunlaydi."""
    while True:
        try:
            for r in await q("SELECT id, owner FROM contests WHERE status='active' AND ends IS NOT NULL AND ends<=?", (now(),)):
                ok, txt = await finish_contest(r["id"])
                try: await bot.send_message(r["owner"], f"⏰ Konkurs #{r['id']} vaqti tugadi.\n{txt}")
                except Exception: pass
        except Exception:
            log.exception("contest_watcher")
        await asyncio.sleep(20)


# ============================ YOPIQ KANAL ZAYAVKALARI ============================
@misc_r.chat_join_request()
async def on_join_request(r: ChatJoinRequest):
    if await q("SELECT 1 FROM channels WHERE chat_id=? AND kind='private'", (r.chat.id,), one=True):
        await ex("INSERT OR IGNORE INTO join_reqs(chat_id,user_id) VALUES(?,?)", (r.chat.id, r.from_user.id))
        try: await r.approve()
        except Exception: pass


# ============================ ADMIN PANEL: UMUMIY ============================
async def ack(c, *a, **kw):
    try: await c.answer(*a, **kw)
    except Exception: pass

async def show(c, text, markup=None):
    try: await c.message.edit_text(text, reply_markup=markup)
    except Exception: await c.message.answer(text, reply_markup=markup)

def admin_kb(uid):
    items = [("ch", "📢 Kanallar", "a:ch"), ("tp", "💳 Balans so'rovlari", "a:tp"), ("us", "👤 Foydalanuvchilar", "a:us"),
             ("od", "🧾 Buyurtmalar", "a:od"), ("pr", "⚙️ Narxlar (bot)", "a:pr"), ("api", "🔌 API boshqaruvi", "a:api"),
             ("st", "📊 Statistika", "a:st"), ("rf", "🔄 Referal tizimi", "a:rf"), ("ct", "🎁 Konkurslar", "a:ct"),
             ("bc", "📣 Xabar yuborish", "a:bc"), ("se", "🛠 Sozlamalar", "a:se"), ("adm", "👮 Adminlar", "a:ad")]
    rows, row = [], []
    for p, t, d in items:
        if has_perm(uid, p):
            row.append((t, d))
            if len(row) == 2: rows.append(row); row = []
    if row: rows.append(row)
    return kb(*rows)

@adm_r.message(Command("admin"))
async def admin_cmd(m: Message, state: FSMContext):
    await state.clear()
    extra = "" if admin_kb(m.from_user.id).inline_keyboard else "\n\nSizga hali hech qanday bo'lim uchun ruxsat berilmagan."
    await m.answer("🎛 <b>Admin panel</b>" + extra, reply_markup=admin_kb(m.from_user.id))

@adm_r.callback_query(F.data == "a:home")
async def a_home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await show(c, "🎛 <b>Admin panel</b>", admin_kb(c.from_user.id)); await ack(c)

async def wait(c, state, text, **data):
    await state.set_state(AdminS.wait)
    await state.update_data(**data)
    await c.message.answer(text, reply_markup=kb([("❌ Bekor qilish", "cancel")]))
    await ack(c)

def onoff(v): return "✅ yoqilgan" if str(v) == "1" else "⛔ o'chirilgan"


# ---- 1. Kanallar
@adm_r.callback_query(F.data == "a:ch")
async def a_ch(c: CallbackQuery):
    chs = await q("SELECT * FROM channels")
    rows = [[(f"🗑 {ch['title'] or ch['username']} ({'yopiq' if ch['kind'] == 'private' else 'ochiq'})", f"chd:{ch['id']}")] for ch in chs]
    rows += [[("➕ Ochiq kanal", "cha:pub"), ("➕ Yopiq (zayavkali)", "cha:priv")], [("🔙", "a:home")]]
    await show(c, "📢 <b>Majburiy obuna kanallari</b>\nO'chirish uchun kanalni bosing.", kb(*rows)); await ack(c)

@adm_r.callback_query(F.data.startswith("cha:"))
async def a_cha(c: CallbackQuery, state: FSMContext):
    if c.data == "cha:pub":
        await wait(c, state, "Kanal @username sini yuboring (bot kanalda admin bo'lsin):", act="add_pub")
    else:
        await wait(c, state, "Yopiq kanal ID sini (-100...) yuboring. Bot kanalda admin bo'lib, «Havola yaratish» huquqiga ega bo'lsin. "
                             "Bot zayavkali havola yaratadi va so'rovlarni avtomatik qabul qiladi.", act="add_priv")

@adm_r.callback_query(F.data.startswith("chd:"))
async def a_chd(c: CallbackQuery):
    await ex("DELETE FROM channels WHERE id=?", (int(c.data[4:]),))
    await ack(c, "O'chirildi")
    await a_ch(c)


# ---- 2. Balans so'rovlari
@adm_r.callback_query(F.data == "a:tp")
async def a_tp(c: CallbackQuery):
    rows = await q("SELECT * FROM topups WHERE status='pending' ORDER BY id LIMIT 15")
    if not rows: return await c.answer("Kutilayotgan so'rov yo'q", show_alert=True)
    for t in rows: await send_topup(c.from_user.id, t)
    await ack(c)

async def credit_topup(t, amount, by):
    await ex("UPDATE users SET balance=balance+? WHERE id=?", (amount, t["user_id"]))
    try: await bot.send_message(t["user_id"], f"✅ Balansingiz {fmt(amount)} so'mga to'ldirildi!")
    except Exception: pass

async def mark_caption(c, text):
    try: await c.message.edit_caption(caption=(c.message.caption or "") + f"\n\n{text}")
    except Exception: pass

@adm_r.callback_query(F.data.startswith(("tp_ok:", "tp_no:")))
async def a_tp_act(c: CallbackQuery):
    act, tid = c.data.split(":"); tid = int(tid)
    new = "ok" if act == "tp_ok" else "no"
    if not await ex("UPDATE topups SET status=? WHERE id=? AND status='pending'", (new, tid)):
        return await c.answer("Allaqachon ko'rilgan", show_alert=True)
    t = await q("SELECT * FROM topups WHERE id=?", (tid,), one=True)
    if new == "ok": await credit_topup(t, t["amount"], c.from_user.id)
    else:
        try: await bot.send_message(t["user_id"], "❌ To'lov so'rovingiz rad etildi. Savol bo'lsa adminga murojaat qiling.")
        except Exception: pass
    await mark_caption(c, f"{'✅ Tasdiqlandi' if new == 'ok' else '❌ Rad etildi'} — {esc(c.from_user.full_name)}")
    await ack(c)

@adm_r.callback_query(F.data.startswith("tp_ed:"))
async def a_tp_ed(c: CallbackQuery, state: FSMContext):
    await wait(c, state, "Haqiqatda tushgan summani yuboring (so'm):", act="tp_amt", tid=int(c.data.split(":")[1]))


# ---- 3. Foydalanuvchilar
@adm_r.callback_query(F.data == "a:us")
async def a_us(c: CallbackQuery, state: FSMContext):
    await wait(c, state, "Foydalanuvchi ID yoki @username ni yuboring:", act="find_user")

async def user_card(uid, viewer):
    u = await get_user(uid)
    if not u: return None, None
    n = (await q("SELECT COUNT(*) c FROM orders WHERE user_id=? AND status='delivered'", (uid,), one=True))["c"]
    k = await active_key(uid)
    t = (f"👤 {uname(u)} | <code>{u['id']}</code>\n💰 Balans: {fmt(u['balance'])} so'm\n🛒 Xaridlar: {n} ta\n"
         f"📅 {u['joined'][:10]}\n🚫 Bloklangan: {'ha' if u['blocked'] else 'yo`q'}\n🔌 API kalit: {('faol (' + k['key_prefix'] + '…)') if k else 'yo`q'}")
    rows = [[("✅ Blokdan chiqarish" if u["blocked"] else "🚫 Bloklash", f"ub:{uid}")],
            [("➕ Balans qo'shish", f"uq:+:{uid}"), ("➖ Balans ayirish", f"uq:-:{uid}")]]
    if has_perm(viewer, "api"): rows.append([("🔌 API ruxsat berish", f"apr_ok:{uid}")])
    return t, kb(*rows)

@adm_r.callback_query(F.data.startswith("ub:"))
async def a_ub(c: CallbackQuery):
    uid = int(c.data[3:])
    if is_admin(uid): return await c.answer("Adminni bloklab bo'lmaydi", show_alert=True)
    await ex("UPDATE users SET blocked=1-blocked WHERE id=?", (uid,))
    t, k = await user_card(uid, c.from_user.id)
    await show(c, t, k); await ack(c, "Bajarildi")

@adm_r.callback_query(F.data.startswith("uq:"))
async def a_uq(c: CallbackQuery, state: FSMContext):
    _, sign, uid = c.data.split(":")
    await wait(c, state, f"Summani yuboring ({'qo`shish' if sign == '+' else 'ayirish'}):", act="bal", sign=sign, uid=int(uid))


# ---- 4. Buyurtmalar
@adm_r.callback_query(F.data == "a:od")
async def a_od(c: CallbackQuery):
    rev = await q("SELECT * FROM orders WHERE status='review' ORDER BY id LIMIT 10")
    last = await q("SELECT * FROM orders ORDER BY id DESC LIMIT 10")
    ic = {"delivered": "✅", "failed": "❌", "processing": "⏳", "review": "❓", "refunded": "↩️"}
    lines = [f"{ic.get(o['status'], '•')} #{o['id']} [{o['src']}] {esc(o['detail'])} → {esc(o['player'])} — {fmt(o['price'])}" for o in last]
    await show(c, f"🧾 <b>Buyurtmalar</b>\n❓ Tekshirilishi kerak: <b>{len(rev)}</b> ta\n\n<b>So'nggi 10 ta:</b>\n" + ("\n".join(lines) or "yo'q"),
               kb([("🔙", "a:home")]))
    for o in rev:
        await c.message.answer(f"❓ <b>#{o['id']}</b> [{o['src']}] user <code>{o['user_id']}</code>\n{esc(o['detail'])} → {esc(o['player'])}\n"
                               f"💵 {fmt(o['price'])} so'm\n<code>{esc((o['note'] or '')[:250])}</code>",
                               reply_markup=kb([("✅ Yetkazilgan", f"ordok:{o['id']}"), ("↩️ Pulni qaytarish", f"ordrf:{o['id']}")]))
    await ack(c)

@adm_r.callback_query(F.data.startswith(("ordok:", "ordrf:")))
async def a_ord_act(c: CallbackQuery):
    act, oid = c.data.split(":"); oid = int(oid)
    new = "delivered" if act == "ordok" else "refunded"
    if not await ex("UPDATE orders SET status=? WHERE id=? AND status='review'", (new, oid)):
        return await c.answer("Allaqachon hal qilingan", show_alert=True)
    o = await q("SELECT * FROM orders WHERE id=?", (oid,), one=True)
    if new == "refunded": await ex("UPDATE users SET balance=balance+? WHERE id=?", (o["price"], o["user_id"]))
    if o["src"] == "bot":
        msg = (f"✅ Buyurtma #{oid} bajarildi: {esc(o['detail'])} → {esc(o['player'])}" if new == "delivered"
               else f"↩️ Buyurtma #{oid} bajarilmadi, {fmt(o['price'])} so'm balansingizga qaytarildi.")
        try: await bot.send_message(o["user_id"], msg)
        except Exception: pass
    try: await c.message.edit_text((c.message.html_text or "") + f"\n\n{'✅ Yetkazilgan' if new == 'delivered' else '↩️ Qaytarildi'} — {esc(c.from_user.full_name)}")
    except Exception: pass
    await ack(c, "Bajarildi")


# ---- 5. Narxlar (bot)
@adm_r.callback_query(F.data == "a:pr")
async def a_pr(c: CallbackQuery):
    d = await get_disc()
    dt = f"{d['pct']}% (gacha: {d['until'][:16] if d.get('until') else '—'}, kanal: {d.get('chat') or '—'})" if d else "yo'q"
    await show(c, f"⚙️ <b>Narxlarni boshqarish (bot)</b>\n🔥 Chegirma: {dt}\n\nℹ️ Bu narxlar va chegirma <b>API narxiga ta'sir qilmaydi</b> "
                  "(API narxi «🔌 API boshqaruvi» bo'limida).",
               kb([("⭐ Stars narxlari", "pl:st")], [("💎 Premium narxlari", "pl:pr")], [("🎮 UC narxlari", "pl:uc")],
                  [("💲 1 Stars narxi (boshqa miqdor)", "pe:st_rate")],
                  [("🔥 Chegirma e'lon qilish", "disc:set"), ("🧹 Chegirmani o'chirish", "disc:off")], [("🔙", "a:home")]))
    await ack(c)

@adm_r.callback_query(F.data.startswith("pl:"))
async def a_pl(c: CallbackQuery):
    kind = c.data[3:]
    src = {"st": STARS, "pr": PREM, "uc": UC}[kind]
    rows = [[(f"{k} {'Stars' if kind == 'st' else 'oy' if kind == 'pr' else 'UC'}: {fmt(await kv_get(f'{kind}:{k}'))} so'm", f"pe:{kind}:{k}")] for k in src]
    rows.append([("🔙", "a:pr")])
    await show(c, "Tahrirlash uchun tanlang:", kb(*rows)); await ack(c)

@adm_r.callback_query(F.data.startswith("pe:"))
async def a_pe(c: CallbackQuery, state: FSMContext):
    key = c.data[3:]
    await wait(c, state, f"<code>{key}</code> uchun yangi qiymat (so'm) yuboring:", act="price", key=key)

@adm_r.callback_query(F.data.startswith("disc:"))
async def a_disc(c: CallbackQuery, state: FSMContext):
    if c.data == "disc:off":
        await ex("DELETE FROM kv WHERE k='disc'"); return await c.answer("Chegirma o'chirildi", show_alert=True)
    await wait(c, state, "Format: <code>foiz [kun] [@kanal]</code>\nMasalan:\n<code>15</code> — hammaga 15%\n"
                         "<code>20 7</code> — 7 kun 20%\n<code>10 30 @kanal</code> — faqat shu kanal a'zolariga 30 kun 10%", act="disc")


# ---- 6. API boshqaruvi
async def api_menu_text():
    keys = (await q("SELECT COUNT(*) c FROM api_keys WHERE status='active'", one=True))["c"]
    reqs = (await q("SELECT COUNT(*) c FROM api_requests WHERE status='pending'", one=True))["c"]
    o = await q("SELECT COUNT(*) n, COALESCE(SUM(price),0) s FROM orders WHERE src='api' AND status='delivered'", one=True)
    return (f"🔌 <b>API boshqaruvi</b>\n\nHolat: {onoff(await kv_get('api_on', '1'))}\n"
            f"Kalit berish: {'hamma uchun ochiq' if await kv_get('api_public', '0') == '1' else 'faqat tasdiq bilan'}\n"
            f"URL: <code>{esc(await api_base_url())}</code>\n\n🔑 Faol kalitlar: {keys}\n📨 Kutilayotgan so'rovlar: {reqs}\n"
            f"🛒 API buyurtmalar: {o['n']} ta / {fmt(o['s'])} so'm"), reqs

@adm_r.callback_query(F.data == "a:api")
async def a_api(c: CallbackQuery):
    text, reqs = await api_menu_text()
    await show(c, text, kb([("💲 API narxlari", "ap:pr")], [("🔑 Kalitlar", "ap:keys:0"), (f"📨 So'rovlar ({reqs})", "ap:reqs")],
                           [("🔛 Yoqish/o'chirish", "ap:on"), ("🌐 Ochiq/tasdiq bilan", "ap:pub")],
                           [("🔗 API URL", "ap:url")], [("🔙", "a:home")]))
    await ack(c)

@adm_r.callback_query(F.data.in_({"ap:on", "ap:pub"}))
async def a_api_toggle(c: CallbackQuery):
    key = "api_on" if c.data == "ap:on" else "api_public"
    await kv_set(key, "0" if await kv_get(key, "0") == "1" else "1")
    await ack(c, "Bajarildi")
    await a_api(c)

@adm_r.callback_query(F.data == "ap:url")
async def a_api_url(c: CallbackQuery, state: FSMContext):
    await wait(c, state, "API'ning ochiq manzilini yuboring (masalan <code>https://api.sizning-domen.uz</code>).\n"
                         "Server bu portda ishlaydi: " + f"<code>{API_PORT}</code> — uni domen/nginx orqali tashqariga oching.", act="api_url")

async def api_prices_view():
    rate = await kv_get("api_st_rate")
    lines = [f"⭐ 1 Stars: <b>{fmt(rate)}</b> so'm  (bot: {fmt(await kv_get('st_rate'))})", "", "💎 Premium:"]
    for m_ in PREM: lines.append(f"• {PREMIUM_LABEL[m_]}: <b>{fmt(await kv_get(f'api_pr:{m_}'))}</b> so'm  (bot: {fmt(await kv_get(f'pr:{m_}'))})")
    return "\n".join(lines)

@adm_r.callback_query(F.data == "ap:pr")
async def a_api_pr(c: CallbackQuery):
    rows = [[("⭐ 1 Stars narxi", "ape:rate")]] + [[(f"💎 {PREMIUM_LABEL[m_]}", f"ape:pr:{m_}")] for m_ in PREM]
    rows += [[("📉 −10%", "apb:-10"), ("📉 −5%", "apb:-5"), ("📈 +5%", "apb:5"), ("📈 +10%", "apb:10")],
             [("✏️ Barchasiga boshqa %", "apb:c")], [("🔙", "a:api")]]
    await show(c, "💲 <b>API narxlari</b> (chegirmalardan mustaqil)\n\n" + await api_prices_view() +
               "\n\nBir tugma bilan hammasini arzonlatish/qimmatlashtirish mumkin. Alohida foydalanuvchiga maxsus foiz «🔑 Kalitlar» bo'limida.", kb(*rows))
    await ack(c)

@adm_r.callback_query(F.data.startswith("ape:"))
async def a_api_edit(c: CallbackQuery, state: FSMContext):
    key = "api_st_rate" if c.data == "ape:rate" else "api_pr:" + c.data.split(":")[2]
    await wait(c, state, f"<code>{key}</code> uchun yangi qiymat (so'm) yuboring:", act="api_price", key=key)

async def api_bulk(pct):
    f = (100 + pct) / 100
    await kv_set("api_st_rate", max(1, round(int(await kv_get("api_st_rate")) * f)))
    for m_ in PREM:
        await kv_set(f"api_pr:{m_}", max(100, round(int(await kv_get(f"api_pr:{m_}")) * f / 100) * 100))

@adm_r.callback_query(F.data.startswith("apb:"))
async def a_api_bulk(c: CallbackQuery, state: FSMContext):
    v = c.data[4:]
    if v == "c":
        return await wait(c, state, "Foizni yuboring (masalan <code>-7</code> — 7% arzon, <code>12</code> — 12% qimmat):", act="api_pct_all")
    await api_bulk(int(v)); await ack(c, f"API narxlari {v}% o'zgardi", show_alert=True)
    await a_api_pr(c)

async def keys_view(c, page):
    rows = await q("SELECT k.*, u.username, u.name FROM api_keys k LEFT JOIN users u ON u.id=k.user_id WHERE k.status='active' "
                   "ORDER BY k.id DESC LIMIT 11 OFFSET ?", (page * 10,))
    btns = [[(f"{('@' + r['username']) if r['username'] else (r['name'] or r['user_id'])} • {r['calls']} ta • {r['pct']:+d}%", f"apk:{r['id']}")] for r in rows[:10]]
    nav = ([("⬅️", f"ap:keys:{page - 1}")] if page else []) + ([("➡️", f"ap:keys:{page + 1}")] if len(rows) > 10 else [])
    if nav: btns.append(nav)
    btns.append([("🔙", "a:api")])
    await show(c, "🔑 <b>Faol API kalitlar</b>\n(nom • so'rovlar • shaxsiy narx o'zgarishi)", kb(*btns))

@adm_r.callback_query(F.data.startswith("ap:keys:"))
async def a_api_keys(c: CallbackQuery):
    await keys_view(c, int(c.data.split(":")[2])); await ack(c)

@adm_r.callback_query(F.data.startswith("apk:"))
async def a_api_key(c: CallbackQuery):
    kid = int(c.data[4:])
    k = await q("SELECT k.*, u.username, u.name, u.balance FROM api_keys k LEFT JOIN users u ON u.id=k.user_id WHERE k.id=?", (kid,), one=True)
    if not k: return await c.answer("Topilmadi", show_alert=True)
    who = ("@" + k["username"]) if k["username"] else esc(k["name"] or k["user_id"])
    await show(c, f"🔑 <b>Kalit #{kid}</b>\n👤 {who} (<code>{k['user_id']}</code>)\nBoshlanishi: <code>{esc(k['key_prefix'])}…</code>\n"
                  f"Holat: {k['status']}\n📈 So'rovlar: {k['calls']}\n🕒 Oxirgi: {k['last_used'] or '—'}\n📅 Yaratilgan: {k['created']}\n"
                  f"💰 Balans: {fmt(k['balance'] or 0)} so'm\n💲 Shaxsiy narx o'zgarishi: <b>{k['pct']:+d}%</b> (− arzon, + qimmat)",
               kb([("💲 Shaxsiy % o'zgartirish", f"app:{kid}")], [("🗑 Kalitni bekor qilish", f"apx:{kid}")], [("🔙", "ap:keys:0")]))
    await ack(c)

@adm_r.callback_query(F.data.startswith("apx:"))
async def a_api_revoke(c: CallbackQuery):
    kid = int(c.data[4:])
    k = await q("SELECT user_id FROM api_keys WHERE id=?", (kid,), one=True)
    await ex("UPDATE api_keys SET status='revoked' WHERE id=?", (kid,))
    if k:
        try: await bot.send_message(k["user_id"], "🔒 Sizning API kalitingiz bekor qilindi. Savol bo'lsa adminga murojaat qiling.")
        except Exception: pass
    await ack(c, "Bekor qilindi", show_alert=True)
    await keys_view(c, 0)

@adm_r.callback_query(F.data.startswith("app:"))
async def a_api_kpct(c: CallbackQuery, state: FSMContext):
    await wait(c, state, "Shu foydalanuvchi uchun API narx o'zgarishini foizda yuboring (masalan <code>-5</code> — 5% arzon, "
                         "<code>0</code> — standart):", act="api_key_pct", kid=int(c.data[4:]))

@adm_r.callback_query(F.data == "ap:reqs")
async def a_api_reqs(c: CallbackQuery):
    rows = await q("SELECT * FROM api_requests WHERE status='pending' ORDER BY created LIMIT 15")
    if not rows: return await c.answer("Kutilayotgan so'rov yo'q", show_alert=True)
    for r in rows:
        u = await get_user(r["user_id"])
        await c.message.answer(f"📨 <b>API so'rovi</b>\n👤 {uname(u)} (<code>{r['user_id']}</code>)\n💰 {fmt(u['balance']) if u else 0} so'm",
                               reply_markup=kb([("✅ Ruxsat", f"apr_ok:{r['user_id']}"), ("❌ Rad", f"apr_no:{r['user_id']}")]))
    await ack(c)

@adm_r.callback_query(F.data.startswith(("apr_ok:", "apr_no:")))
async def a_api_req_act(c: CallbackQuery):
    act, uid = c.data.split(":"); uid = int(uid)
    st = "ok" if act == "apr_ok" else "no"
    await ex("INSERT INTO api_requests(user_id,status,created) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status",
             (uid, st, now()))
    try:
        await bot.send_message(uid, "✅ Sizga API ruxsat berildi! «🤝 Hamkorlik (API)» bo'limida kalit oling." if st == "ok"
                               else "❌ API so'rovingiz rad etildi.")
    except Exception: pass
    try: await c.message.edit_text((c.message.html_text or "") + f"\n\n{'✅ Ruxsat berildi' if st == 'ok' else '❌ Rad etildi'}")
    except Exception: pass
    await ack(c, "Bajarildi")


# ---- 7. Statistika
@adm_r.callback_query(F.data == "a:st")
async def a_st(c: CallbackQuery):
    one = lambda s, a=(): q(s, a, one=True)
    tot = (await one("SELECT COUNT(*) c FROM users"))["c"]
    today = (await one("SELECT COUNT(*) c FROM users WHERE date(joined)=date('now','localtime')"))["c"]
    yest = (await one("SELECT COUNT(*) c FROM users WHERE date(joined)=date('now','localtime','-1 day')"))["c"]
    blk = (await one("SELECT COUNT(*) c FROM users WHERE blocked=1"))["c"]
    bal = (await one("SELECT COALESCE(SUM(balance),0) s FROM users"))["s"]

    async def agg(src):
        r = {x["kind"]: x for x in await q("SELECT CASE WHEN kind='stc' THEN 'st' ELSE kind END kind, COUNT(*) n, COALESCE(SUM(price),0) s "
                                           "FROM orders WHERE status='delivered' AND src=? GROUP BY 1", (src,))}
        g = lambda k, f: r[k][f] if k in r else 0
        return g("st", "n"), g("st", "s"), g("pr", "n"), g("pr", "s"), g("uc", "n"), g("uc", "s")
    b = await agg("bot"); a = await agg("api")
    ac = (await one("SELECT COUNT(*) c FROM contests WHERE status='active'"))["c"]
    pt = (await one("SELECT COUNT(*) c FROM cparts"))["c"]
    tp = (await one("SELECT COUNT(*) c FROM topups WHERE status='pending'"))["c"]
    rv = (await one("SELECT COUNT(*) c FROM orders WHERE status='review'"))["c"]
    _, cdb = await cd("GET", "/balance")
    await show(c,
        f"📊 <b>Statistika</b>\n\n👥 Foydalanuvchilar: {tot} (bugun +{today}, kecha +{yest})\n🚫 Bloklangan: {blk}\n"
        f"💰 Foydalanuvchilar balansi jami: {fmt(bal)} so'm\n\n"
        f"<b>🤖 Bot orqali:</b>\n⭐ Stars: {b[0]} ta / {fmt(b[1])} so'm\n💎 Premium: {b[2]} ta / {fmt(b[3])} so'm\n🎮 UC: {b[4]} ta / {fmt(b[5])} so'm\n\n"
        f"<b>🔌 API orqali:</b>\n⭐ Stars: {a[0]} ta / {fmt(a[1])} so'm\n💎 Premium: {a[2]} ta / {fmt(a[3])} so'm\n\n"
        f"⏳ Kutilayotgan to'lovlar: {tp}\n❓ Tekshiriladigan buyurtmalar: {rv}\n"
        f"🎁 Faol konkurslar: {ac}, jami ishtirokchilar: {pt}\n\n"
        f"🏦 CoinDrop balans: <code>{esc(json.dumps(cdb, ensure_ascii=False)[:200])}</code>", kb([("🔙", "a:home")]))
    await ack(c)


# ---- 8. Referal
@adm_r.callback_query(F.data == "a:rf")
async def a_rf(c: CallbackQuery):
    s = await kv_get("season")
    await show(c, f"🔄 <b>Referal tizimi</b> — joriy mavsum #{s}",
               kb([("🏆 Top ro'yxat", "at:0")], [("📦 Arxiv (oldingi mavsumlar)", "arl")],
                  [("♻️ Noldan boshlash (arxivlash)", "arr")], [("🔙", "a:home")]))
    await ack(c)

@adm_r.callback_query(F.data.startswith("at:"))
async def a_top(c: CallbackQuery):
    page = int(c.data[3:])
    rows = await season_top(int(await kv_get("season")), page * 10, 11)
    nav = ([("⬅️ Oldingi sahifa", f"at:{page - 1}")] if page else []) + ([("➡️ Keyingi sahifa", f"at:{page + 1}")] if len(rows) > 10 else [])
    await show(c, "🏆 <b>Top referrallar</b>\n\n" + await render_top(rows[:10], page * 10), kb(nav, [("🔙", "a:rf")]) if nav else kb([("🔙", "a:rf")]))
    await ack(c)

@adm_r.callback_query(F.data == "arr")
async def a_arr(c: CallbackQuery):
    await show(c, "⚠️ Barcha referal hisoblari 0 ga tushiriladi, natijalar arxivga saqlanadi. Davom etamizmi?",
               kb([("✅ Ha", "arr:y"), ("❌ Yo'q", "a:rf")])); await ack(c)

@adm_r.callback_query(F.data == "arr:y")
async def a_arr_y(c: CallbackQuery):
    s = int(await kv_get("season"))
    for r in await season_top(s, 0, 100000):
        await ex("INSERT INTO ref_archive(season,user_id,cnt,archived) VALUES(?,?,?,?)", (s, r["inviter"], r["c"], now()))
    await kv_set("season", s + 1)
    await show(c, f"✅ Yangilandi. Yangi mavsum: #{s + 1}. Eski natijalar arxivda.", kb([("🔙", "a:rf")])); await ack(c)

@adm_r.callback_query(F.data == "arl")
async def a_arl(c: CallbackQuery):
    seasons = await q("SELECT DISTINCT season FROM ref_archive ORDER BY season DESC LIMIT 20")
    if not seasons: return await c.answer("Arxiv bo'sh", show_alert=True)
    await show(c, "📦 Mavsumni tanlang:", kb(*[[(f"Mavsum #{s['season']}", f"ar:{s['season']}:0")] for s in seasons], [("🔙", "a:rf")])); await ack(c)

@adm_r.callback_query(F.data.startswith("ar:"))
async def a_ar(c: CallbackQuery):
    _, s, page = c.data.split(":"); s, page = int(s), int(page)
    rows = await q("SELECT user_id inviter, cnt c FROM ref_archive WHERE season=? ORDER BY cnt DESC LIMIT 11 OFFSET ?", (s, page * 10))
    nav = ([("⬅️ Oldingi sahifa", f"ar:{s}:{page - 1}")] if page else []) + ([("➡️ Keyingi sahifa", f"ar:{s}:{page + 1}")] if len(rows) > 10 else [])
    await show(c, f"📦 <b>Mavsum #{s} g'oliblari</b>\n\n" + await render_top(rows[:10], page * 10),
               kb(nav, [("🔙", "arl")]) if nav else kb([("🔙", "arl")])); await ack(c)


# ---- 9. Konkurslar (admin: hammasi)
@adm_r.callback_query(F.data == "a:ct")
async def a_ct(c: CallbackQuery):
    rows = await q("SELECT * FROM contests ORDER BY id DESC LIMIT 15")
    btns = [[(f"{'🟢' if r['status'] == 'active' else '🔴'} #{r['id']} — {r['target_title']}", f"cv:{r['id']}")] for r in rows]
    await show(c, "🎁 <b>Konkurslar</b>", kb([("🎲 Konkurs yaratish", "cc:new")], *btns, [("🔙", "a:home")])); await ack(c)


# ---- 10. Xabar yuborish
@adm_r.callback_query(F.data == "a:bc")
async def a_bc(c: CallbackQuery, state: FSMContext):
    await wait(c, state, "Barcha foydalanuvchilarga yuboriladigan xabarni yuboring (matn/rasm/video):", act="bc")


# ---- 11. Sozlamalar
async def se_text():
    return ("🛠 <b>Sozlamalar</b>\n\n"
            f"🛒 Do'kon (Stars/Premium sotuvi): {onoff(await kv_get('shop_on', '1'))}\n"
            f"💳 Karta: <code>{esc(await kv_get('card', CARD_INFO))}</code>\n"
            f"🎮 Mini App havolasi: {esc((await kv_get('mini_url', MINI_APP_URL)) or 'sozlanmagan')}\n"
            f"📖 API hujjat (Mini App): {esc(await docs_url())}\n"
            f"💵 Minimal to'lov: {fmt(await kv_get('topup_min', 1000))} so'm\n"
            f"📜 To'lov qoidalari: {'maxsus' if await kv_get('topup_rules') else 'standart'}\n"
            f"🆔 CoinDrop kaliti: {'✅ o`rnatilgan' if CD_KEY else '❌ yo`q (.env)'}")

@adm_r.callback_query(F.data == "a:se")
async def a_se(c: CallbackQuery):
    await show(c, await se_text(),
               kb([("🛒 Do'kon yoqish/o'chirish", "se:shop")], [("💳 Karta", "se:card"), ("🎮 Mini App link", "se:mini")], [("📖 API hujjat link", "se:docs")],
                  [("💵 Minimal to'lov", "se:min"), ("📜 To'lov qoidalari", "se:rules")],
                  [("🆔 Premium product ID", "se:pid")], [("🔎 CoinDrop tekshirish", "se:cd")], [("🔙", "a:home")]))
    await ack(c)

@adm_r.callback_query(F.data.startswith("se:"))
async def a_se_act(c: CallbackQuery, state: FSMContext):
    act = c.data[3:]
    if act == "shop":
        await kv_set("shop_on", "0" if await kv_get("shop_on", "1") == "1" else "1")
        await ack(c, "Bajarildi"); return await a_se(c)
    if act == "card": return await wait(c, state, "Yangi karta ma'lumotini yuboring (raqam va ism):", act="set_card")
    if act == "mini":
        return await wait(c, state, "Mini App havolasini yuboring (<code>https://...</code> yoki <code>https://t.me/bot/app</code>).\n"
                                    "O'chirish uchun <code>-</code> yuboring:", act="set_mini")
    if act == "docs":
        return await wait(c, state, "📖 API hujjat havolasini yuboring (<code>https://...</code>, Mini App sifatida ochiladi).\n"
                                    "Standartga qaytish uchun <code>-</code> yuboring:", act="set_docs")
    if act == "min": return await wait(c, state, "Minimal to'lov summasini yuboring (so'm):", act="set_min")
    if act == "rules":
        return await wait(c, state, "To'lov qoidalari matnini yuboring (<b>, <i>, <code> teglari ishlaydi).\n"
                                    "Standart qoidalarga qaytish uchun <code>-</code> yuboring:", act="set_rules")
    if act == "pid":
        rows = [[(f"{PREMIUM_LABEL[m_]}: {await premium_pid(m_)}", f"se:pid:{m_}")] for m_ in PREM] + [[("🔙", "a:se")]]
        await show(c, "🆔 <b>CoinDrop Premium product ID</b>\nTanlang va yangi ID yuboring (CoinDrop hujjati / «CoinDrop tekshirish» dan oling):", kb(*rows))
        return await ack(c)
    if act.startswith("pid:"):
        m_ = int(act.split(":")[1])
        return await wait(c, state, f"{PREMIUM_LABEL[m_]} uchun yangi product_id yuboring:", act="set_pid", months=m_)
    if act == "cd":
        await ack(c, "Tekshirilmoqda...")
        st, bal = await cd("GET", "/balance")
        st2, prods = await cd("GET", "/games/telegram-premium/products")
        await c.message.answer(f"🔎 <b>CoinDrop</b>\n\nBalans (HTTP {st}):\n<pre>{esc(json.dumps(bal, ensure_ascii=False)[:500])}</pre>\n"
                               f"Premium mahsulotlar (HTTP {st2}):\n<pre>{esc(json.dumps(prods, ensure_ascii=False)[:1500])}</pre>")


# ---- 12. Adminlar (faqat asosiy adminlar)
def perm_kb(uid):
    perms = ADMINS.get(uid, set())
    rows = [[(f"{'✅' if p in perms else '⬜️'} {t}", f"ad:t:{uid}:{p}")] for p, t in PERMS.items()]
    rows += [[("✅ Hammasi", f"ad:all:{uid}"), ("🚫 Hech biri", f"ad:none:{uid}")],
             [("🗑 Adminlikdan olish", f"ad:del:{uid}")], [("🔙", "a:ad")]]
    return kb(*rows)

@adm_r.callback_query(F.data == "a:ad")
async def a_ad(c: CallbackQuery):
    rows = []
    for uid, perms in ADMINS.items():
        u = await get_user(uid)
        rows.append([(f"👮 {('@' + u['username']) if u and u['username'] else (u['name'] if u else uid)} • {len(perms)} ruxsat", f"ad:v:{uid}")])
    rows += [[("➕ Admin qo'shish", "ad:add")], [("🔙", "a:home")]]
    await show(c, "👮 <b>Adminlar</b>\n\nAsosiy adminlar (.env dagi ADMIN_IDS): " + (", ".join(f"<code>{x}</code>" for x in SUPER_ADMINS) or "—") +
               "\nAsosiy adminlarda barcha ruxsat bor. Qo'shimcha adminlarga faqat siz belgilagan bo'limlar ochiladi.", kb(*rows))
    await ack(c)

@adm_r.callback_query(F.data.startswith("ad:"))
async def a_ad_act(c: CallbackQuery, state: FSMContext):
    p = c.data.split(":")
    if p[1] == "add":
        return await wait(c, state, "Yangi adminning Telegram ID raqamini yuboring (u botga /start bosgan bo'lishi kerak):", act="add_admin")
    uid = int(p[2])
    if p[1] == "v":
        u = await get_user(uid)
        await show(c, f"👮 Admin: {uname(u) if u else uid} (<code>{uid}</code>)\nRuxsat beriladigan bo'limlarni belgilang:", perm_kb(uid))
        return await ack(c)
    if uid not in ADMINS: return await c.answer("Admin topilmadi", show_alert=True)
    perms = set(ADMINS[uid])
    if p[1] == "t": perms ^= {p[3]}
    elif p[1] == "all": perms = set(PERMS)
    elif p[1] == "none": perms = set()
    elif p[1] == "del":
        await ex("DELETE FROM admins WHERE id=?", (uid,)); await load_admins()
        try: await bot.send_message(uid, "ℹ️ Sizning adminlik huquqingiz olib tashlandi.")
        except Exception: pass
        await ack(c, "Olib tashlandi"); return await a_ad(c)
    await ex("UPDATE admins SET perms=? WHERE id=?", (json.dumps(sorted(perms)), uid)); await load_admins()
    try: await c.message.edit_reply_markup(reply_markup=perm_kb(uid))
    except Exception: pass
    await ack(c)


# ============================ ADMIN KIRITISH HANDLERI ============================
ACT_PERM = {"add_pub": "ch", "add_priv": "ch", "find_user": "us", "bal": "us", "price": "pr", "disc": "pr", "bc": "bc",
            "tp_amt": "tp", "api_price": "api", "api_pct_all": "api", "api_key_pct": "api", "api_url": "api",
            "set_card": "se", "set_mini": "se", "set_docs": "se", "set_rules": "se", "set_min": "se", "set_pid": "se", "add_admin": "adm"}

@adm_r.message(AdminS.wait)
async def admin_input(m: Message, state: FSMContext):
    d = await state.get_data()
    act = d.get("act")
    if not has_perm(m.from_user.id, ACT_PERM.get(act, "adm")):
        await state.clear(); return await m.answer("⛔ Ruxsat yo'q.")
    t = (m.text or "").strip()
    if act == "add_pub":
        try:
            chat = await bot.get_chat(norm_chat_ref(t))
            await ex("INSERT INTO channels(chat_id,username,title,kind,link) VALUES(?,?,?,?,?)",
                     (chat.id, chat.username, chat.title, "public", tme(chat.username) if chat.username else None))
            await m.answer(f"✅ Qo'shildi: {esc(chat.title)}")
        except Exception as e: return await m.answer(f"❌ Xato: {esc(e)}")
    elif act == "add_priv":
        try:
            chat = await bot.get_chat(int(t))
            link = await bot.create_chat_invite_link(chat.id, creates_join_request=True, name="bot")
            await ex("INSERT INTO channels(chat_id,username,title,kind,link) VALUES(?,?,?,?,?)",
                     (chat.id, chat.username, chat.title, "private", link.invite_link))
            await m.answer(f"✅ Yopiq kanal qo'shildi: {esc(chat.title)}\n{link.invite_link}")
        except Exception as e: return await m.answer(f"❌ Xato: {esc(e)}")
    elif act == "find_user":
        if t.isdigit(): uid = int(t)
        else:
            r = await q("SELECT id FROM users WHERE lower(username)=?", (t.lstrip("@").lower(),), one=True)
            uid = r["id"] if r else None
        card, k = await user_card(uid, m.from_user.id) if uid else (None, None)
        if not card: return await m.answer("❌ Topilmadi. Qayta yuboring.")
        await m.answer(card, reply_markup=k)
    elif act == "bal":
        if not t.isdigit(): return await m.answer("❗ Raqam yuboring.")
        n = int(t) if d["sign"] == "+" else -int(t)
        await ex("UPDATE users SET balance=MAX(0,balance+?) WHERE id=?", (n, d["uid"]))
        try: await bot.send_message(d["uid"], f"💰 Balansingiz o'zgartirildi: {'+' if n > 0 else ''}{fmt(n)} so'm")
        except Exception: pass
        await m.answer("✅ Bajarildi.")
    elif act == "tp_amt":
        if not t.isdigit() or int(t) <= 0: return await m.answer("❗ Musbat raqam yuboring.")
        if not await ex("UPDATE topups SET status='ok', amount=? WHERE id=? AND status='pending'", (int(t), d["tid"])):
            await state.clear(); return await m.answer("Bu so'rov allaqachon ko'rilgan.")
        tp = await q("SELECT * FROM topups WHERE id=?", (d["tid"],), one=True)
        await credit_topup(tp, int(t), m.from_user.id)
        await m.answer(f"✅ So'rov #{d['tid']} tasdiqlandi: {fmt(t)} so'm.")
    elif act == "price":
        key = d["key"]
        if not t.isdigit() or int(t) <= 0 or not (key == "st_rate" or key.startswith(("st:", "pr:", "uc:"))): return await m.answer("❗ Musbat raqam yuboring.")
        await kv_set(key, int(t)); await m.answer("✅ Narx yangilandi.")
    elif act == "disc":
        p = t.split()
        if not p or not p[0].isdigit() or not 1 <= int(p[0]) <= 90: return await m.answer("❗ Format noto'g'ri (foiz 1–90).")
        disc = {"pct": int(p[0])}
        if len(p) > 1 and p[1].isdigit(): disc["until"] = (datetime.now() + timedelta(days=int(p[1]))).isoformat()
        for x in p[1:]:
            if x.startswith("@"):
                try: ch = await bot.get_chat(x); disc["chat_id"] = ch.id; disc["chat"] = x
                except Exception: return await m.answer("❌ Kanal topilmadi.")
        await kv_set("disc", json.dumps(disc)); await m.answer("🔥 Chegirma e'lon qilindi!")
    elif act == "api_price":
        key = d["key"]
        if not t.isdigit() or int(t) <= 0 or not (key == "api_st_rate" or key.startswith("api_pr:")): return await m.answer("❗ Musbat raqam yuboring.")
        await kv_set(key, int(t)); await m.answer("✅ API narxi yangilandi.")
    elif act == "api_pct_all":
        if not re.fullmatch(r"-?\d{1,3}", t) or not -90 <= int(t) <= 300: return await m.answer("❗ Masalan: -7 yoki 12")
        await api_bulk(int(t)); await m.answer(f"✅ Barcha API narxlari {int(t):+d}% ga o'zgardi.\n\n" + await api_prices_view())
    elif act == "api_key_pct":
        if not re.fullmatch(r"-?\d{1,3}", t) or not -90 <= int(t) <= 300: return await m.answer("❗ Masalan: -5 yoki 0")
        await ex("UPDATE api_keys SET pct=? WHERE id=?", (int(t), d["kid"])); await m.answer(f"✅ Shaxsiy narx o'zgarishi: {int(t):+d}%")
    elif act == "api_url":
        if not t.startswith(("http://", "https://")): return await m.answer("❗ http:// yoki https:// bilan boshlang.")
        await kv_set("api_url", t.rstrip("/")); await m.answer("✅ Saqlandi.")
    elif act == "set_card":
        if not t: return await m.answer("❗ Matn yuboring.")
        await kv_set("card", t); await m.answer("✅ Karta ma'lumoti yangilandi.")
    elif act == "set_mini":
        if t != "-" and not t.startswith(("http://", "https://", "tg://")): return await m.answer("❗ https:// bilan boshlanuvchi havola yuboring yoki - yuboring.")
        await kv_set("mini_url", "" if t == "-" else t); await m.answer("✅ Mini App havolasi yangilandi." if t != "-" else "✅ Havola o'chirildi.")
    elif act == "set_docs":
        if t != "-" and not t.startswith("https://"): return await m.answer("❗ Mini App uchun https:// bilan boshlanuvchi havola kerak (yoki - yuboring).")
        await kv_set("docs_url", "" if t == "-" else t); await m.answer("✅ API hujjat havolasi yangilandi." if t != "-" else "✅ Standart havolaga qaytdi.")
    elif act == "set_rules":
        if t == "-": await ex("DELETE FROM kv WHERE k='topup_rules'"); await m.answer("✅ Standart qoidalarga qaytdi.")
        else:
            await kv_set("topup_rules", m.html_text); await m.answer("✅ Qoidalar saqlandi. Ko'rinishi:")
            await m.answer(m.html_text)
    elif act == "set_min":
        if not t.isdigit() or int(t) < 1: return await m.answer("❗ Raqam yuboring.")
        await kv_set("topup_min", int(t)); await m.answer("✅ Saqlandi.")
    elif act == "set_pid":
        if not t or len(t) > 64: return await m.answer("❗ To'g'ri product_id yuboring.")
        await kv_set(f"pid:{d['months']}", t); await m.answer("✅ Saqlandi.")
    elif act == "add_admin":
        if not t.isdigit(): return await m.answer("❗ Faqat raqamli ID yuboring.")
        uid = int(t)
        if is_super(uid): await state.clear(); return await m.answer("Bu foydalanuvchi asosiy admin.")
        await ex("INSERT OR IGNORE INTO admins(id,perms,added_by,added) VALUES(?,?,?,?)", (uid, "[]", m.from_user.id, now()))
        await load_admins()
        await m.answer("✅ Admin qo'shildi. Endi u kira oladigan bo'limlarni belgilang:", reply_markup=perm_kb(uid))
        try: await bot.send_message(uid, "👮 Siz botga admin etib tayinlandingiz. /admin buyrug'ini yuboring (bo'limlar tez orada belgilanadi).")
        except Exception: pass
    elif act == "bc":
        users = await q("SELECT id FROM users WHERE blocked=0")
        await m.answer(f"📣 Yuborilmoqda: {len(users)} ta...")
        ok = 0
        for u in users:
            try: await m.copy_to(u["id"]); ok += 1
            except TelegramRetryAfter as e:
                await asyncio.sleep(min(e.retry_after, 30))
                try: await m.copy_to(u["id"]); ok += 1
                except Exception: pass
            except Exception: pass
            await asyncio.sleep(0.05)
        await m.answer(f"✅ Yuborildi: {ok}/{len(users)}")
    await state.clear()


# ============================ REAL API (aiohttp server) ============================
class ApiErr(Exception):
    def __init__(self, status, code, msg):
        self.status, self.code, self.msg = status, code, msg

def jr(data, status=200):
    return web.json_response(data, status=status, dumps=lambda o: json.dumps(o, ensure_ascii=False))

@web.middleware
async def api_mw(request, handler):
    try:
        return await handler(request)
    except ApiErr as e:
        return jr({"success": False, "error": e.code, "message": e.msg}, e.status)
    except web.HTTPException as e:
        return jr({"success": False, "error": "http_error", "message": e.reason}, e.status)
    except Exception:
        log.exception("api xatosi")
        return jr({"success": False, "error": "server_error", "message": "Ichki xatolik"}, 500)

_rl = defaultdict(deque)
def rate_ok(kid):
    t = time.time(); dq = _rl[kid]
    while dq and dq[0] < t - 60: dq.popleft()
    if len(dq) >= API_RATE_LIMIT: return False
    dq.append(t); return True

async def api_auth(request):
    if await kv_get("api_on", "1") != "1": raise ApiErr(503, "api_disabled", "API vaqtincha o'chirilgan")
    key = request.headers.get("X-API-Key", "").strip()
    if not key: raise ApiErr(401, "missing_key", "X-API-Key sarlavhasi kerak")
    k = await q("SELECT k.*, u.blocked FROM api_keys k JOIN users u ON u.id=k.user_id WHERE k.key_hash=? AND k.status='active'",
                (sha(key),), one=True)
    if not k: raise ApiErr(401, "invalid_key", "API kalit noto'g'ri yoki bekor qilingan")
    if k["blocked"]: raise ApiErr(403, "blocked", "Hisob bloklangan")
    if not rate_ok(k["id"]): raise ApiErr(429, "rate_limited", f"Limit: daqiqasiga {API_RATE_LIMIT} ta so'rov")
    await ex("UPDATE api_keys SET calls=calls+1,last_used=? WHERE id=?", (now(), k["id"]))
    return k

ST_MAP = {"delivered": "completed", "review": "pending", "processing": "pending", "failed": "failed", "refunded": "refunded"}

def order_json(o):
    return {"id": o["id"], "type": "premium" if o["kind"] == "pr" else "stars", "item": o["detail"], "username": o["player"],
            "price": o["price"], "status": ST_MAP.get(o["status"], o["status"]), "external_ref": o["ext_ref"], "created": o["created"]}

async def balance_of(uid): return (await get_user(uid))["balance"]

async def h_health(request):
    return jr({"success": True, "status": "ok", "time": now()})

async def h_me(request):
    k = await api_auth(request)
    return jr({"success": True, "user_id": k["user_id"], "balance": await balance_of(k["user_id"]),
               "price_adjustment_pct": k["pct"], "currency": "UZS"})

async def h_prices(request):
    k = await api_auth(request)
    return jr({"success": True, "currency": "UZS",
               "stars": {"price_per_star": await api_price("st", 1, k["pct"]), "min": 50, "max": 10000},
               "premium": {str(m_): await api_price("pr", m_, k["pct"]) for m_ in PREM}})

async def h_order_create(request):
    k = await api_auth(request)
    try: body = await request.json()
    except Exception: raise ApiErr(400, "bad_json", "JSON noto'g'ri")
    if not isinstance(body, dict): raise ApiErr(400, "bad_json", "JSON obyekt bo'lishi kerak")
    typ = str(body.get("type", "")).lower()
    username = str(body.get("username", "")).strip().lstrip("@")
    if not re.fullmatch(r"[A-Za-z0-9_]{4,32}", username): raise ApiErr(400, "bad_username", "username noto'g'ri")
    ext = body.get("external_ref")
    ext = str(ext)[:64] if ext not in (None, "") else None
    if typ == "stars":
        amount = body.get("amount")
        if isinstance(amount, bool) or not isinstance(amount, int) or not 50 <= amount <= 10000:
            raise ApiErr(400, "bad_amount", "amount 50 dan 10000 gacha butun son bo'lishi kerak")
        kind, key, label = "stc", amount, f"{amount} Stars"
        price = await api_price("st", amount, k["pct"])
    elif typ == "premium":
        months = body.get("months")
        if isinstance(months, bool) or not isinstance(months, int) or months not in PREM:
            raise ApiErr(400, "bad_months", f"months qiymatlari: {', '.join(map(str, PREM))}")
        kind, key, label = "pr", months, f"Premium {PREMIUM_LABEL[months]}"
        price = await api_price("pr", months, k["pct"])
    else:
        raise ApiErr(400, "bad_type", "type: stars yoki premium")
    if ext:   # idempotentlik: bir xil external_ref ikkinchi marta yechilmaydi
        dup = await q("SELECT * FROM orders WHERE key_id=? AND ext_ref=?", (k["id"], ext), one=True)
        if dup: return jr({"success": True, "duplicate": True, "order": order_json(dup), "balance": await balance_of(k["user_id"])})
    r = await create_order(k["user_id"], kind, key, username, label, price, src="api", key_id=k["id"], ext_ref=ext)
    s = r["state"]
    if s == "duplicate":
        dup = await q("SELECT * FROM orders WHERE key_id=? AND ext_ref=?", (k["id"], ext), one=True)
        return jr({"success": True, "duplicate": True, "order": order_json(dup), "balance": await balance_of(k["user_id"])})
    if s == "closed": raise ApiErr(503, "shop_closed", "Xizmat vaqtincha to'xtatilgan")
    if s == "nofunds":
        raise ApiErr(402, "insufficient_balance", f"Balans yetarli emas. Narx: {price}, balans: {await balance_of(k['user_id'])}")
    o = await q("SELECT * FROM orders WHERE id=?", (r["oid"],), one=True)
    bal = await balance_of(k["user_id"])
    if s == "delivered": return jr({"success": True, "order": order_json(o), "balance": bal})
    if s == "review": return jr({"success": True, "order": order_json(o), "balance": bal,
                                 "message": "Natija tekshirilmoqda. GET /orders/{id} orqali holatni kuzating."}, 202)
    return jr({"success": False, "error": "order_failed", "message": "Buyurtma bajarilmadi, mablag' qaytarildi",
               "order": order_json(o), "balance": bal}, 502)

async def h_order_get(request):
    k = await api_auth(request)
    oid = request.match_info["id"]
    if not oid.isdigit(): raise ApiErr(400, "bad_id", "id raqam bo'lishi kerak")
    o = await q("SELECT * FROM orders WHERE id=? AND key_id=?", (int(oid), k["id"]), one=True)
    if not o: raise ApiErr(404, "not_found", "Buyurtma topilmadi")
    return jr({"success": True, "order": order_json(o)})

async def h_orders_list(request):
    k = await api_auth(request)
    try: limit = max(1, min(int(request.query.get("limit", 20)), 100))
    except ValueError: limit = 20
    rows = await q("SELECT * FROM orders WHERE key_id=? ORDER BY id DESC LIMIT ?", (k["id"], limit))
    return jr({"success": True, "orders": [order_json(o) for o in rows]})

async def start_api():
    app = web.Application(middlewares=[api_mw], client_max_size=64 * 1024)
    app.router.add_get("/", h_health)
    app.router.add_get("/api/v1/health", h_health)
    app.router.add_get("/api/v1/me", h_me)
    app.router.add_get("/api/v1/prices", h_prices)
    app.router.add_post("/api/v1/orders", h_order_create)
    app.router.add_get("/api/v1/orders", h_orders_list)
    app.router.add_get("/api/v1/orders/{id}", h_order_get)
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()
    try:
        await web.TCPSite(runner, API_HOST, API_PORT).start()
        log.info("API server ishga tushdi: %s:%s", API_HOST, API_PORT)
    except OSError as e:
        log.error("API server ishga tushmadi (%s). Bot API'siz davom etadi.", e)
    return runner


# ============================ ISHGA TUSHIRISH ============================
async def main():
    global bot, SESSION, BOT_USERNAME
    if not BOT_TOKEN or not SUPER_ADMINS:
        print("❌ .env faylda BOT_TOKEN va ADMIN_IDS ni to'ldiring (namuna: .env.example).")
        return
    if not CD_KEY:
        log.warning("COINDROP_API_KEY yo'q — Stars/Premium sotuvi ishlamaydi (buyurtmalar rad etiladi).")
    await db_init()
    await load_admins()
    SESSION = aiohttp.ClientSession()
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    BOT_USERNAME = (await bot.get_me()).username
    dp = Dispatcher(storage=MemoryStorage())
    dp.message.outer_middleware(Gate())
    dp.callback_query.outer_middleware(Gate())
    dp.include_router(misc_r)
    dp.include_router(adm_r)
    dp.include_router(user_r)
    runner = await start_api()
    watcher = asyncio.create_task(contest_watcher())
    log.info("Bot ishga tushdi: @%s", BOT_USERNAME)
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        watcher.cancel()
        await runner.cleanup()
        await SESSION.close(); await DB.close(); await bot.session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        pass
