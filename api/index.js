const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

app.use(cors());
app.use(express.json());

// Inisialisasi Firebase Admin SDK dari variabel lingkungan FIREBASE_SERVICE_ACCOUNT
if (!admin.apps.length) {
  try {
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountRaw) {
      console.warn("Peringatan: Variable FIREBASE_SERVICE_ACCOUNT belum dikonfigurasi.");
    } else {
      const serviceAccount = JSON.parse(serviceAccountRaw);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
  } catch (err) {
    console.error("Gagal menginisialisasi Firebase Admin:", err.message);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

// Helper check koneksi DB
const checkDb = (req, res, next) => {
  if (!db) {
    return res.status(500).json({ 
      error: "Firebase belum terkonfigurasi. Pastikan FIREBASE_SERVICE_ACCOUNT sudah diset di Vercel." 
    });
  }
  next();
};

// Endpoint: Ambil daftar produk/menu
app.get('/api/products', checkDb, async (req, res) => {
  try {
    const snapshot = await db.collection('products').get();
    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Tambah pesanan baru (Transactions)
app.post('/api/orders', checkDb, async (req, res) => {
  try {
    const { orderType, tableNo, customerName, items, subtotal, tax, total, paymentMethod } = req.body;
    
    const orderData = {
      orderType: orderType || 'Dine-In',
      tableNo: tableNo || '-',
      customerName: customerName || 'Guest',
      items: items || [],
      subtotal: subtotal || 0,
      tax: tax || 0,
      total: total || 0,
      paymentMethod: paymentMethod || 'Cash',
      status: 'Completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('orders').add(orderData);
    res.status(201).json({ id: docRef.id, message: "Pesanan berhasil dibuat", data: orderData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Ambil riwayat pesanan
app.get('/api/orders', checkDb, async (req, res) => {
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').limit(20).get();
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root API Health Check
app.get('/api', (req, res) => {
  res.json({ status: "API Cafe EPOS Running", timestamp: new Date() });
});

// Export untuk Serverless Vercel & Standalone execution
module.exports = app;

if (process.env.NODE_ENV !== 'production' && require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
}