const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// DATA_DIR env var = persistent volume path on Railway (e.g. /data)
// Falls back to project root locally
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Serve uploads from DATA_DIR (works whether volume is mounted or not)
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Data helpers ──────────────────────────────────────────────

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return { branches: [], donations: [] }; }
}

function writeData(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// ── Seed ──────────────────────────────────────────────────────

const BRANCHES = [
  ['Jakarta Pusat',   'cabang01'], ['Jakarta Selatan', 'cabang02'],
  ['Jakarta Utara',   'cabang03'], ['Jakarta Barat',   'cabang04'],
  ['Jakarta Timur',   'cabang05'], ['Bogor',           'cabang06'],
  ['Depok',           'cabang07'], ['Tangerang',       'cabang08'],
  ['Bekasi',          'cabang09'], ['Bandung',         'cabang10'],
  ['Surabaya',        'cabang11'], ['Medan',           'cabang12'],
  ['Semarang',        'cabang13'], ['Makassar',        'cabang14'],
  ['Palembang',       'cabang15'], ['Yogyakarta',      'cabang16'],
  ['Malang',          'cabang17'], ['Denpasar',        'cabang18'],
  ['Balikpapan',      'cabang19'], ['Banjarmasin',     'cabang20'],
  ['Pontianak',       'cabang21'], ['Samarinda',       'cabang22'],
  ['Manado',          'cabang23'], ['Pekanbaru',       'cabang24'],
  ['Padang',          'cabang25'], ['Batam',           'cabang26'],
  ['Jambi',           'cabang27'], ['Bengkulu',        'cabang28'],
  ['Lampung',         'cabang29'], ['Serang',          'cabang30'],
  ['Karawang',        'cabang31'], ['Cirebon',         'cabang32'],
  ['Solo',            'cabang33'], ['Magelang',        'cabang34'],
  ['Kudus',           'cabang35'], ['Purwokerto',      'cabang36'],
  ['Tasikmalaya',     'cabang37'], ['Sukabumi',        'cabang38'],
  ['Cianjur',         'cabang39'], ['Madiun',          'cabang40'],
  ['Kediri',          'cabang41'], ['Jember',          'cabang42'],
  ['Banyuwangi',      'cabang43'], ['Mataram',         'cabang44'],
  ['Kupang',          'cabang45'], ['Ambon',           'cabang46'],
  ['Jayapura',        'cabang47'], ['Ternate',         'cabang48'],
  ['Gorontalo',       'cabang49'], ['Sorong',          'cabang50'],
  ['Manokwari',       'cabang51'], ['Palu',            'cabang52'],
  ['Kendari',         'cabang53'], ['Mamuju',          'cabang54'],
  ['Tarakan',         'cabang55'], ['Singkawang',      'cabang56'],
  ['Tanjungpinang',   'cabang57'], ['Pangkalpinang',   'cabang58'],
  ['Palangkaraya',    'cabang59'],
];

(function initData() {
  const data = readData();
  const allBranches = BRANCHES.map(([name, username], i) => ({ id: i + 1, name, username, password: 're3pnm2025' }));
  if (data.branches.length === 0) {
    data.branches = allBranches;
    writeData(data);
    console.log('Data awal 59 cabang dibuat.');
  } else if (data.branches.length < BRANCHES.length) {
    const existingIds = new Set(data.branches.map(b => b.id));
    const newBranches = allBranches.filter(b => !existingIds.has(b.id));
    data.branches = [...data.branches, ...newBranches];
    writeData(data);
    console.log(`Ditambahkan ${newBranches.length} cabang baru.`);
  }
})();

// ── Multer (photo upload) ──────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${req.session.branchId}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

// ── Middleware ────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'pnm-re3-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, secure: false, sameSite: 'lax' }
}));

const requireAuth = (req, res, next) => {
  if (!req.session.branchId) return res.status(401).json({ error: 'Sesi habis, silakan login kembali.' });
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Akses ditolak.' });
  next();
};

// ── Routes ────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username dan password harus diisi.' });
  const data = readData();
  const branch = data.branches.find(b => b.username === username.trim() && b.password === password.trim());
  if (!branch) return res.status(401).json({ error: 'Username atau password salah.' });
  req.session.branchId = branch.id;
  req.session.branchName = branch.name;
  res.json({ success: true, branchName: branch.name });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.branchId) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, branchName: req.session.branchName });
});

app.post('/api/donations', requireAuth, upload.single('photo'), (req, res) => {
  const { kg, donation_date } = req.body || {};
  const parsedKg = parseFloat(kg);

  if (isNaN(parsedKg) || parsedKg <= 0) return res.status(400).json({ error: 'Berat harus lebih dari 0 kg.' });
  if (!donation_date) return res.status(400).json({ error: 'Tanggal donasi harus diisi.' });

  const data = readData();
  data.donations.push({
    id: Date.now(),
    branch_id: req.session.branchId,
    kg: parsedKg,
    donation_date,
    photo: req.file ? `/uploads/${req.file.filename}` : null,
    submitted_at: new Date().toISOString()
  });
  writeData(data);
  res.json({ success: true });
});

app.get('/api/donations', requireAuth, (req, res) => {
  const data = readData();
  const donations = data.donations
    .filter(d => d.branch_id === req.session.branchId)
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
    .map(d => ({ ...d, submitted_at: formatWIB(d.submitted_at) }));
  const total = Math.round(donations.reduce((s, d) => s + d.kg, 0) * 100) / 100;
  res.json({ donations, total });
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || 're3admin2025';
  if (!password || password !== ADMIN_PASS) return res.status(401).json({ error: 'Password salah.' });
  req.session.isAdmin = true;
  res.json({ success: true });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/admin/donations', requireAdmin, (req, res) => {
  const data = readData();
  const branchMap = {};
  data.branches.forEach(b => { branchMap[b.id] = b.name; });
  const donations = data.donations
    .map(d => ({ ...d, branch_name: branchMap[d.branch_id] || '—', submitted_at_fmt: formatWIB(d.submitted_at) }))
    .sort((a, b) => b.id - a.id);
  const total = Math.round(donations.reduce((s, d) => s + d.kg, 0) * 100) / 100;
  const branches = data.branches.map(b => ({ id: b.id, name: b.name })).sort((a, b) => a.name.localeCompare(b.name));
  res.json({ donations, total, branches });
});

app.post('/api/admin/reset', (req, res) => {
  const { secret } = req.body || {};
  if (secret !== (process.env.ADMIN_SECRET || 're3admin2025')) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }
  const data = readData();
  const count = data.donations.length;
  data.donations = [];
  writeData(data);
  res.json({ success: true, deleted: count });
});

app.get('/api/health', (req, res) => {
  const data = readData();
  res.json({
    status: 'ok',
    data_dir: DATA_DIR,
    data_file: DATA_FILE,
    persistent: DATA_DIR !== __dirname,
    branches: data.branches.length,
    donations: data.donations.length
  });
});

app.get('/api/leaderboard', (req, res) => {
  const data = readData();
  const totals = data.branches.map(b => ({
    name: b.name,
    total_kg: Math.round(data.donations.filter(d => d.branch_id === b.id).reduce((s, d) => s + d.kg, 0) * 100) / 100
  }));
  totals.sort((a, b) => b.total_kg - a.total_kg || a.name.localeCompare(b.name));
  res.json(totals);
});

function formatWIB(iso) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600000);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

app.listen(PORT, () => {
  console.log(`RE3 server: http://localhost:${PORT}`);
  console.log(`Leaderboard: http://localhost:${PORT}/leaderboard.html`);
});
