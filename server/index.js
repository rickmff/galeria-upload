import express from 'express'
import multer from 'multer'
import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import dotenv from 'dotenv'
import { analyzeImage, interpretSearch, calculateCost } from './gemini.js'

// Carregar .env - tenta do diretório raiz primeiro
const envPath = path.join(process.cwd(), '.env')
dotenv.config({ path: envPath })

// Verificar se a API key está configurada
const apiKey = (process.env.GEMINI_API_KEY_AI || '').trim()
if (!apiKey) {
  console.warn('⚠️  GEMINI_API_KEY_AI não encontrada no .env')
  console.warn(`   Procurando em: ${envPath}`)
  console.warn('   Crie um arquivo .env na raiz do projeto com: GEMINI_API_KEY_AI=sua_chave_aqui')
  console.warn('   Obtenha sua chave gratuita em: https://aistudio.google.com/apikey')
} else {
  console.log(`✅ GEMINI_API_KEY_AI configurada (${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)})`)
  console.log(`   Análise inteligente ativada`)

  // Validar formato básico
  if (apiKey.length < 20) {
    console.error(`❌ AVISO: API Key parece muito curta (${apiKey.length} caracteres). Verifique se está correta.`)
  }
}

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ai_description TEXT,
    ai_keywords TEXT,
    ai_document_type TEXT,
    ai_country TEXT,
    ai_typical_use TEXT
  )`)

  // Adicionar colunas novas se não existirem (migração para bancos existentes)
  db.run(`ALTER TABLE images ADD COLUMN ai_description TEXT`, () => { })
  db.run(`ALTER TABLE images ADD COLUMN ai_keywords TEXT`, () => { })
  db.run(`ALTER TABLE images ADD COLUMN ai_document_type TEXT`, () => { })
  db.run(`ALTER TABLE images ADD COLUMN ai_country TEXT`, () => { })
  db.run(`ALTER TABLE images ADD COLUMN ai_typical_use TEXT`, () => { })

  // Tabela para rastreamento de custos da API
  db.run(`CREATE TABLE IF NOT EXISTS api_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    operation_id INTEGER,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    cost_brl REAL DEFAULT 0,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT
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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB para suportar PDFs maiores
  fileFilter: (req, file, cb) => {
    // Aceitar imagens e PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Apenas imagens e PDFs são permitidos'), false)
    }
  }
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
      const filePath = path.join(uploadsDir, file.filename)

      // Analisar imagem/PDF com Gemini para gerar keywords ANTES de salvar
      // Se falhar, rejeitar o upload completamente
      console.log(`\n📤 Iniciando upload: ${file.originalname}`)
      console.log(`   Tipo: ${file.mimetype}`)
      console.log(`   Caminho: ${filePath}`)

      let aiAnalysis = null

      let costInfo = null

      try {
        console.log(`🤖 Analisando ${file.mimetype === 'application/pdf' ? 'PDF' : 'imagem'} com IA...`)
        aiAnalysis = await analyzeImage(filePath)

        // Obter informações de custo se disponíveis
        if (global.lastApiCost) {
          costInfo = global.lastApiCost
          global.lastApiCost = null // Limpar após usar
        }

        // Validar se a análise retornou keywords válidas (pelo menos 20)
        const keywords = Array.isArray(aiAnalysis.keywords) ? aiAnalysis.keywords : []
        const hasValidKeywords = keywords.length >= 20 && keywords.some(k => k && k.trim().length > 0)

        if (!hasValidKeywords) {
          throw new Error(`Análise da IA não retornou keywords suficientes. Recebidas: ${keywords.length}, esperado: pelo menos 20`)
        }

        console.log(`✅ Análise concluída:`)
        console.log(`   Tipo de documento: ${aiAnalysis.documentType}`)
        console.log(`   Keywords (${keywords.length}):`, keywords)
        console.log(`   Descrição: ${aiAnalysis.description?.substring(0, 100)}...`)
        console.log(`   País: ${aiAnalysis.country || 'N/A'}`)

      } catch (aiError) {
        console.error(`❌ Erro na análise AI:`, aiError.message)
        console.error(`   Stack:`, aiError.stack)

        // Deletar arquivo do disco se foi salvo
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath)
            console.log(`   Arquivo removido do disco`)
          } catch (unlinkError) {
            console.error(`   Erro ao remover arquivo:`, unlinkError.message)
          }
        }

        // Rejeitar upload - retornar erro para o frontend
        return res.status(400).json({
          success: false,
          error: `Falha na análise por IA: ${aiError.message}. O arquivo não foi salvo. Certifique-se de que a GEMINI_API_KEY_AI está configurada corretamente.`
        })
      }

      const keywordsString = Array.isArray(aiAnalysis.keywords)
        ? aiAnalysis.keywords.join(', ')
        : (aiAnalysis.keywords || '')

      console.log(`💾 Salvando no banco:`)
      console.log(`   Keywords: "${keywordsString}"`)
      console.log(`   Tipo: ${aiAnalysis.documentType}`)

      const result = await dbInsert(
        `INSERT INTO images (filename, originalname, mimetype, size, ai_description, ai_keywords, ai_document_type, ai_country, ai_typical_use)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          file.filename,
          aiName,
          file.mimetype,
          file.size,
          aiAnalysis.description || '',
          keywordsString,
          aiAnalysis.documentType || 'imagem geral',
          aiAnalysis.country || null,
          aiAnalysis.typicalUse || ''
        ]
      )

      // Salvar custo da análise no banco
      if (costInfo) {
        await dbInsert(
          `INSERT INTO api_costs (operation_type, operation_id, input_tokens, output_tokens, cost_usd, cost_brl, model, details)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'image_analysis',
            result.lastID,
            costInfo.inputTokens,
            costInfo.outputTokens,
            costInfo.costUSD,
            costInfo.costBRL,
            costInfo.model,
            costInfo.details
          ]
        )
        console.log(`   💾 Custo salvo no banco de dados`)
      }

      console.log(`✅ Arquivo salvo com ID: ${result.lastID}`)
      console.log(`   Verificando dados salvos...`)

      // Verificar se foi salvo corretamente
      const dbGet = promisify(db.get.bind(db))
      const saved = await dbGet('SELECT ai_keywords, ai_document_type FROM images WHERE id = ?', [result.lastID])
      console.log(`   Dados no banco - Keywords: "${saved?.ai_keywords || 'NULL'}", Tipo: ${saved?.ai_document_type || 'NULL'}`)
      console.log(`\n`)

      uploadedImages.push({
        id: result.lastID,
        filename: file.filename,
        originalname: aiName,
        url: `/uploads/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size,
        ai_description: aiAnalysis.description,
        ai_keywords: keywordsString,
        ai_document_type: aiAnalysis.documentType,
        ai_country: aiAnalysis.country,
        ai_typical_use: aiAnalysis.typicalUse
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
      url: `/uploads/${img.filename}`,
      ai_keywords: img.ai_keywords ? img.ai_keywords.split(', ') : []
    }))
    res.json({ success: true, images: imagesWithUrl })
  } catch (error) {
    console.error('Erro ao listar imagens:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body

    if (!query || query.trim() === '') {
      return res.status(400).json({ success: false, error: 'Query vazia' })
    }

    // Buscar todos os documentos disponíveis
    const allDocuments = await dbAll('SELECT * FROM images ORDER BY created_at DESC')

    // Interpretar busca com Gemini
    let searchCostInfo = null
    const interpretation = await interpretSearch(query, allDocuments)

    // Obter informações de custo se disponíveis
    if (global.lastSearchCost) {
      searchCostInfo = global.lastSearchCost
      global.lastSearchCost = null // Limpar após usar
    }

    // Buscar documentos que correspondem aos termos
    let matchingDocuments = []

    if (interpretation.matchingDocIds && interpretation.matchingDocIds.length > 0) {
      // Usar IDs sugeridos pelo Gemini
      const placeholders = interpretation.matchingDocIds.map(() => '?').join(',')
      matchingDocuments = await dbAll(
        `SELECT * FROM images WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
        interpretation.matchingDocIds
      )
    } else {
      // Busca por keywords e descrição usando LIKE
      const searchTerms = interpretation.searchTerms || [query]
      const conditions = []
      const params = []

      for (const term of searchTerms) {
        conditions.push('(ai_keywords LIKE ? OR ai_description LIKE ? OR ai_document_type LIKE ? OR originalname LIKE ?)')
        const likeTerm = `%${term}%`
        params.push(likeTerm, likeTerm, likeTerm, likeTerm)
      }

      if (conditions.length > 0) {
        const whereClause = conditions.join(' OR ')
        matchingDocuments = await dbAll(
          `SELECT * FROM images WHERE ${whereClause} ORDER BY created_at DESC`,
          params
        )
      }
    }

    const documentsWithUrl = matchingDocuments.map(img => ({
      ...img,
      url: `/uploads/${img.filename}`,
      ai_keywords: img.ai_keywords ? img.ai_keywords.split(', ') : []
    }))

    // Salvar custo da busca no banco
    if (searchCostInfo) {
      await dbInsert(
        `INSERT INTO api_costs (operation_type, operation_id, input_tokens, output_tokens, cost_usd, cost_brl, model, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'search',
          null,
          searchCostInfo.inputTokens,
          searchCostInfo.outputTokens,
          searchCostInfo.costUSD,
          searchCostInfo.costBRL,
          searchCostInfo.model,
          searchCostInfo.details
        ]
      )
      console.log(`   💾 Custo da busca salvo no banco de dados`)
    }

    // Se não encontrou documentos, ainda retornar a lista de documentos necessários
    if (documentsWithUrl.length === 0) {
      // Marcar todos os documentos como não possuídos se não encontrou nenhum
      const documentsWithStatus = (interpretation.documents || []).map(doc => ({
        ...doc,
        hasDocument: false
      }))

      res.json({
        success: true,
        query: query,
        topic: interpretation.topic || 'Documentos necessários',
        documents: documentsWithStatus,
        matchingDocIds: [],
        searchResults: []
      })
    } else {
      // Marcar documentos que o usuário já tem baseado nos IDs encontrados
      const foundDocIds = new Set(documentsWithUrl.map(doc => doc.id))
      const documentsWithStatus = (interpretation.documents || []).map(doc => {
        // Se o documento tem um ID e está na lista de encontrados, marcar como tendo
        const hasDocument = doc.id ? foundDocIds.has(doc.id) : false
        return {
          ...doc,
          hasDocument
        }
      })

      res.json({
        success: true,
        query: query,
        topic: interpretation.topic || 'Busca realizada',
        documents: documentsWithStatus,
        matchingDocIds: interpretation.matchingDocIds || [],
        searchResults: documentsWithUrl
      })
    }
  } catch (error) {
    console.error('Erro na busca:', error)
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

// Endpoint para visualizar custos da API
app.get('/api/costs', async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    let query = 'SELECT * FROM api_costs'
    const params = []

    if (startDate || endDate) {
      query += ' WHERE'
      if (startDate) {
        query += ' created_at >= ?'
        params.push(startDate)
      }
      if (startDate && endDate) {
        query += ' AND'
      }
      if (endDate) {
        query += ' created_at <= ?'
        params.push(endDate)
      }
    }

    query += ' ORDER BY created_at DESC'

    const costs = await dbAll(query, params)

    // Calcular totais
    const totals = costs.reduce((acc, cost) => {
      acc.totalUSD += cost.cost_usd || 0
      acc.totalBRL += cost.cost_brl || 0
      acc.totalInputTokens += cost.input_tokens || 0
      acc.totalOutputTokens += cost.output_tokens || 0
      return acc
    }, { totalUSD: 0, totalBRL: 0, totalInputTokens: 0, totalOutputTokens: 0 })

    res.json({
      success: true,
      costs,
      totals,
      count: costs.length
    })
  } catch (error) {
    console.error('Erro ao buscar custos:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
  console.log(`Visualizar banco de dados: http://localhost:${PORT}/db`)
  console.log(`Visualizar custos da API: http://localhost:${PORT}/api/costs`)
})
