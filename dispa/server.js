// server.js
import express from "express";
import multer from "multer";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import os from "os";
import admin from "firebase-admin";
import cors from "cors";

const PORT = process.env.PORT || 4000;

// --- Firebase Admin init ---
// place ton fichier serviceAccountKey.json dans le dossier backend
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "serviceAccountKey.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "<TON_BUCKET>.appspot.com" // remplacer par ton bucket (ex: mon-projet.appspot.com)
});

const bucket = admin.storage().bucket();
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// multer config (fichiers en mémoire ou disque temporaire)
const upload = multer({ dest: os.tmpdir() });

// util: convertir images (chemins locaux) en un pdf et retourner chemin pdf local
function imagesToPDFLocal(imagePaths, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    imagePaths.forEach((imgPath) => {
      const { width = 595, height = 842 } = {}; // A4 default - pdfkit ajuste
      doc.addPage({ size: "A4" });
      try {
        doc.image(imgPath, { fit: [500, 750], align: "center", valign: "center" });
      } catch (err) {
        console.error("error embedding image", imgPath, err);
      }
    });

    doc.end();
    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
  });
}

// util: upload local file -> Firebase Storage, retourne url publique (signed URL)
async function uploadFileToStorage(localPath, remotePath) {
  await bucket.upload(localPath, {
    destination: remotePath,
    metadata: {
      contentType: "application/pdf"
    }
  });
  // Générer URL signée (par ex. 10 ans)
  const file = bucket.file(remotePath);
  const expiresAt = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000; // 10 ans
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: new Date(expiresAt)
  });
  return url;
}

// --- Endpoint: upload (images ou pdf) ---
// fields: type (exos|sujets|lecons|ecoles|classes|niveaux),
// metadata: JSON string contenant les infos (niveau, matiere, serie, leconId, ecoleId, classeId, typeExo, typeSujet, titre...)
app.post("/api/upload", upload.array("files", 10), async (req, res) => {
  try {
    const itemType = req.body.type; // exos, sujets, lecons, ecoles, classes
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    const files = req.files || [];

    if (!itemType) return res.status(400).json({ error: "type is required" });

    // 1) si fichiers pdf déjà fournis (type application/pdf)
    const pdfFiles = files.filter(f => f.mimetype === "application/pdf");

    // 2) images -> convertir en pdf (si il y a des images)
    const imageFiles = files.filter(f => f.mimetype.startsWith("image/"));

    let pdfLocalPath;
    if (pdfFiles.length === 1 && imageFiles.length === 0) {
      pdfLocalPath = pdfFiles[0].path;
    } else if (imageFiles.length > 0) {
      const imagePaths = imageFiles.map(f => f.path);
      const outName = `out_${Date.now()}.pdf`;
      const outPath = path.join(os.tmpdir(), outName);
      await imagesToPDFLocal(imagePaths, outPath);
      pdfLocalPath = outPath;
    } else {
      return res.status(400).json({ error: "No files provided" });
    }

    // 3) upload pdfLocalPath -> Storage
    const remotePath = `${itemType}/${metadata.niveau || "general"}/${Date.now()}.pdf`;
    const downloadUrl = await uploadFileToStorage(pdfLocalPath, remotePath);

    // 4) insertion Firestore selon itemType
    const createdAt = Date.now();
    let docRef;

    if (["exos", "sujets", "lecons"].includes(itemType)) {
      const collectionRef = db.collection(itemType);
      const docData = {
        ...metadata,
        pdfUrl: downloadUrl,
        storagePath: remotePath,
        createdAt
      };
      docRef = await collectionRef.add(docData);
    } else if (itemType === "ecoles") {
      // ecoles top-level
      const collectionRef = db.collection("ecoles");
      const docData = {
        ...metadata,
        createdAt
      };
      docRef = await collectionRef.add(docData);
    } else if (itemType === "classes") {
      // metadata must contain ecoleId
      if (!metadata.ecoleId) return res.status(400).json({ error: "ecoleId required for classes" });
      const classesRef = db.collection("ecoles").doc(metadata.ecoleId).collection("classes");
      const docData = { ...metadata, createdAt };
      const d = await classesRef.add(docData);
      docRef = d;
    } else {
      return res.status(400).json({ error: "unknown type" });
    }

    // cleanup temporaries (if created)
    // remove uploaded files (multer tmp)
    files.forEach(f => {
      try { fs.unlinkSync(f.path); } catch (e) {}
    });
    // remove pdfLocalPath if created and not original pdfFiles[0]
    if (pdfLocalPath && (!pdfFiles.length || pdfLocalPath !== pdfFiles[0].path)) {
      try { fs.unlinkSync(pdfLocalPath); } catch (e) {}
    }

    return res.json({ ok: true, docId: docRef.id, pdfUrl: downloadUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error", details: err.message });
  }
});

// --- Endpoint: delete item by collection and docId ---
// body: { type: "exos"|"sujets"|"lecons"|"classes"|"ecoles", docId: "...", ecoleId(optional for classes) }
app.delete("/api/delete", async (req, res) => {
  try {
    const { type, docId, ecoleId } = req.body;
    if (!type || !docId) return res.status(400).json({ error: "type and docId required" });

    let docSnap;
    if (type === "classes") {
      if (!ecoleId) return res.status(400).json({ error: "ecoleId required for classes" });
      const docRef = db.collection("ecoles").doc(ecoleId).collection("classes").doc(docId);
      docSnap = await docRef.get();
      if (!docSnap.exists) return res.status(404).json({ error: "not found" });

      const data = docSnap.data();
      // delete storage if storagePath present
      if (data.storagePath) await bucket.file(data.storagePath).delete().catch(() => {});
      await docRef.delete();
    } else {
      const docRef = db.collection(type).doc(docId);
      docSnap = await docRef.get();
      if (!docSnap.exists) return res.status(404).json({ error: "not found" });

      const data = docSnap.data();
      if (data && data.storagePath) await bucket.file(data.storagePath).delete().catch(() => {});
      await docRef.delete();
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error", details: err.message });
  }
});

// --- Endpoint: list items (simple) ---
app.get("/api/list/:type", async (req, res) => {
  try {
    const type = req.params.type;
    if (!type) return res.status(400).json({ error: "type required" });
    if (type === "classes") {
      // requires ?ecoleId=...
      const ecoleId = req.query.ecoleId;
      if (!ecoleId) return res.status(400).json({ error: "ecoleId required for classes" });
      const snap = await db.collection("ecoles").doc(ecoleId).collection("classes").orderBy("createdAt", "desc").get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json(items);
    } else {
      const snap = await db.collection(type).orderBy("createdAt", "desc").get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json(items);
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

