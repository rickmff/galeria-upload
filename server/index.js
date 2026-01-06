import express from 'express'
import multer from 'multer'
import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

const db = new sqlite3.Database('./database.db')

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    originalname TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)
})

const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
})

app.use(express.json())
app.use('/uploads', express.static(uploadsDir))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

const dbAll = promisify(db.all.bind(db))
const dbGet = promisify(db.get.bind(db))

const dbInsert = (query, params) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err)
      else resolve({ lastID: this.lastID })
    })
  })
}

const dbUpdate = (query, params) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err)
      else resolve({ changes: this.changes })
    })
  })
}

const generateAIName = (originalName, mimetype) => {
  const ext = path.extname(originalName).toLowerCase()
  const baseName = path.basename(originalName, ext).toLowerCase()

  const keywords = {
    'image/jpeg': ['foto', 'imagem', 'photo'],
    'image/png': ['imagem', 'grafico', 'image'],
    'image/gif': ['animacao', 'gif', 'animation'],
    'image/webp': ['imagem', 'webp', 'image']
  }

  const typeKeyword = keywords[mimetype] || ['imagem', 'image']
  const randomKeyword = typeKeyword[Math.floor(Math.random() * typeKeyword.length)]

  const date = new Date().toISOString().split('T')[0]
  const time = Date.now().toString().slice(-6)

  const aiName = `${randomKeyword}-${date}-${time}${ext}`
  return aiName
}

app.post('/api/upload', upload.array('images'), async (req, res) => {
  try {
    const files = req.files
    const uploadedImages = []

    for (const file of files) {
      const aiName = generateAIName(file.originalname, file.mimetype)

      const result = await dbInsert(
        'INSERT INTO images (filename, originalname, mimetype, size) VALUES (?, ?, ?, ?)',
        [file.filename, aiName, file.mimetype, file.size]
      )

      uploadedImages.push({
        id: result.lastID,
        filename: file.filename,
        originalname: aiName,
        url: `/uploads/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size
      })
    }

    res.json({ success: true, images: uploadedImages })
  } catch (error) {
    console.error('Erro no upload:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/images', async (req, res) => {
  try {
    const images = await dbAll('SELECT * FROM images ORDER BY created_at DESC')
    const imagesWithUrl = images.map(img => ({
      ...img,
      url: `/uploads/${img.filename}`
    }))
    res.json({ success: true, images: imagesWithUrl })
  } catch (error) {
    console.error('Erro ao listar imagens:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.put('/api/images/:id/rename', async (req, res) => {
  try {
    const id = req.params.id
    const { newName } = req.body

    if (!newName || newName.trim() === '') {
      return res.status(400).json({ success: false, error: 'Nome inválido' })
    }

    const image = await dbGet('SELECT * FROM images WHERE id = ?', [id])
    if (!image) {
      return res.status(404).json({ success: false, error: 'Imagem não encontrada' })
    }

    const ext = path.extname(image.originalname)
    const finalName = newName.endsWith(ext) ? newName : newName + ext

    await dbUpdate(
      'UPDATE images SET originalname = ? WHERE id = ?',
      [finalName, id]
    )

    res.json({ success: true, originalname: finalName })
  } catch (error) {
    console.error('Erro ao renomear:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.delete('/api/images/:id', async (req, res) => {
  try {
    const id = req.params.id
    const image = await dbGet('SELECT * FROM images WHERE id = ?', [id])

    if (!image) {
      return res.status(404).json({ success: false, error: 'Imagem não encontrada' })
    }

    const filePath = path.join(uploadsDir, image.filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    await new Promise((resolve, reject) => {
      db.run('DELETE FROM images WHERE id = ?', [id], (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar imagem:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/db', async (req, res) => {
  try {
    const images = await dbAll('SELECT * FROM images ORDER BY created_at DESC')
    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Visualizar Banco de Dados</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          background: #f5f5f5;
        }
        h1 {
          color: #333;
          text-align: center;
        }
        .info {
          background: white;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background: #4CAF50;
          color: white;
          font-weight: bold;
        }
        tr:hover {
          background: #f9f9f9;
        }
        .image-preview {
          width: 80px;
          height: 80px;
          object-fit: cover;
          border-radius: 4px;
        }
        .size {
          color: #666;
        }
        .empty {
          text-align: center;
          padding: 40px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <h1>📊 Visualização do Banco de Dados</h1>
      <div class="info">
        <strong>Total de imagens:</strong> ${images.length}
      </div>
      ${images.length === 0 ?
        '<div class="empty">Nenhuma imagem no banco de dados</div>' :
        `<table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Preview</th>
              <th>Nome Original</th>
              <th>Nome do Arquivo</th>
              <th>Tipo</th>
              <th>Tamanho</th>
              <th>Data de Criação</th>
            </tr>
          </thead>
          <tbody>
            ${images.map(img => `
              <tr>
                <td>${img.id}</td>
                <td><img src="/uploads/${img.filename}" alt="Preview" class="image-preview" onerror="this.style.display='none'"></td>
                <td>${img.originalname}</td>
                <td>${img.filename}</td>
                <td>${img.mimetype}</td>
                <td class="size">${(img.size / 1024).toFixed(2)} KB</td>
                <td>${new Date(img.created_at).toLocaleString('pt-BR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`
      }
    </body>
    </html>
    `
    res.send(html)
  } catch (error) {
    console.error('Erro ao visualizar banco:', error)
    res.status(500).send(`<h1>Erro</h1><p>${error.message}</p>`)
  }
})

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
  console.log(`Visualizar banco de dados: http://localhost:${PORT}/db`)
})
