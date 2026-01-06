// ============================================================================
// SERVIDOR BACKEND - Express + SQLite + Multer
// ============================================================================

// Importa o framework Express para criar o servidor web
import express from 'express'

// Importa o Multer, middleware para lidar com upload de arquivos multipart/form-data
import multer from 'multer'

// Importa o módulo sqlite3 para trabalhar com banco de dados SQLite
import sqlite3 from 'sqlite3'

// Importa a função promisify do módulo util para converter callbacks em Promises
import { promisify } from 'util'

// Importa o módulo path para manipular caminhos de arquivos e diretórios
import path from 'path'

// Importa fileURLToPath para converter URL de módulo ES6 em caminho de arquivo
import { fileURLToPath } from 'url'

// Importa o módulo fs (file system) para operações com arquivos do sistema
import fs from 'fs'

// Converte a URL do módulo atual (import.meta.url) em um caminho de arquivo absoluto
// Necessário porque em módulos ES6 não temos __filename diretamente
const __filename = fileURLToPath(import.meta.url)

// Obtém o diretório do arquivo atual usando path.dirname
// Isso nos dá o caminho da pasta 'server'
const __dirname = path.dirname(__filename)

// Cria uma instância da aplicação Express
// Esta será nossa aplicação web servidor
const app = express()

// Define a porta onde o servidor vai escutar requisições
const PORT = 3001

// ============================================================================
// CONFIGURAÇÃO DO BANCO DE DADOS SQLite
// ============================================================================

// Cria ou conecta ao banco de dados SQLite no arquivo 'database.db'
// Se o arquivo não existir, será criado automaticamente
const db = new sqlite3.Database('./database.db')

// db.serialize() garante que os comandos SQL sejam executados em sequência
// Isso é importante para criar a tabela antes de fazer outras operações
db.serialize(() => {
  // Executa um comando SQL para criar a tabela 'images' se ela não existir
  // CREATE TABLE IF NOT EXISTS evita erro se a tabela já existir
  db.run(`CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  // ID único que incrementa automaticamente
    filename TEXT NOT NULL,                // Nome do arquivo salvo no servidor
    originalname TEXT NOT NULL,           // Nome original do arquivo enviado
    mimetype TEXT NOT NULL,               // Tipo MIME (ex: image/png, image/jpeg)
    size INTEGER NOT NULL,                // Tamanho do arquivo em bytes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP  // Data/hora de criação automática
  )`)
})

// ============================================================================
// CONFIGURAÇÃO DA PASTA DE UPLOADS
// ============================================================================

// Cria o caminho completo para a pasta 'uploads' dentro da pasta 'server'
// path.join() junta os caminhos de forma correta para qualquer sistema operacional
const uploadsDir = path.join(__dirname, 'uploads')

// Verifica se a pasta 'uploads' existe no sistema de arquivos
if (!fs.existsSync(uploadsDir)) {
  // Se não existir, cria a pasta e todas as pastas pai necessárias
  // recursive: true cria toda a hierarquia de pastas se necessário
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// ============================================================================
// CONFIGURAÇÃO DO MULTER (Upload de Arquivos)
// ============================================================================

// Configura o armazenamento em disco usando multer.diskStorage()
// Isso permite controlar onde e como os arquivos são salvos
const storage = multer.diskStorage({
  // Função que define onde o arquivo será salvo
  destination: (req, file, cb) => {
    // cb é o callback: primeiro parâmetro é erro (null = sem erro), segundo é o destino
    cb(null, uploadsDir)  // Salva na pasta uploads que criamos
  },
  // Função que define o nome do arquivo salvo
  filename: (req, file, cb) => {
    // Cria um sufixo único usando timestamp + número aleatório
    // Isso evita conflitos de nomes quando múltiplos arquivos são enviados
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    // Mantém a extensão original do arquivo usando path.extname()
    // Exemplo: foto.png -> 1767731482200-549163932.png
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

// Cria uma instância do multer com as configurações de storage
const upload = multer({
  storage: storage,                              // Usa o storage configurado acima
  limits: { fileSize: 10 * 1024 * 1024 }        // Limite de 10MB por arquivo
  // 10 * 1024 = 10KB, * 1024 = 10MB (em bytes)
})

// ============================================================================
// MIDDLEWARES DO EXPRESS
// ============================================================================

// Middleware para parsear JSON no corpo das requisições
// Permite que o Express entenda dados JSON enviados no body
app.use(express.json())

// Middleware para servir arquivos estáticos
// Quando alguém acessar /uploads/nome-arquivo.png, serve o arquivo da pasta uploads
// Isso permite que as imagens sejam acessíveis via URL
app.use('/uploads', express.static(uploadsDir))

// Middleware personalizado para configurar CORS (Cross-Origin Resource Sharing)
// Permite que o frontend (rodando em outra porta) faça requisições para este servidor
app.use((req, res, next) => {
  // Permite requisições de qualquer origem (*)
  // Em produção, substitua por domínio específico por segurança
  res.header('Access-Control-Allow-Origin', '*')
  // Define quais métodos HTTP são permitidos
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE')
  // Define quais cabeçalhos podem ser enviados
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  // Chama next() para continuar para o próximo middleware/rota
  next()
})

// ============================================================================
// FUNÇÕES HELPER PARA O BANCO DE DADOS
// ============================================================================

// Converte métodos do sqlite3 que usam callbacks para Promises
// Isso permite usar async/await ao invés de callbacks aninhados

// promisify() converte uma função que usa callback em uma Promise
// db.all() retorna todas as linhas de uma query
const dbAll = promisify(db.all.bind(db))

// db.get() retorna apenas a primeira linha de uma query
const dbGet = promisify(db.get.bind(db))

// Função helper personalizada para inserir dados e retornar o ID gerado
// db.run() não pode ser promisificado diretamente porque precisa acessar this.lastID
const dbInsert = (query, params) => {
  // Retorna uma Promise manualmente
  return new Promise((resolve, reject) => {
    // Executa a query SQL
    db.run(query, params, function (err) {
      // function() ao invés de arrow function para ter acesso ao 'this'
      if (err) reject(err)  // Se houver erro, rejeita a Promise
      else resolve({ lastID: this.lastID })  // Retorna o ID do último registro inserido
    })
  })
}

// ============================================================================
// ROTAS DA API
// ============================================================================

// ----------------------------------------------------------------------------
// POST /api/upload - Endpoint para fazer upload de imagens
// ----------------------------------------------------------------------------
// upload.array('images') processa múltiplos arquivos do campo 'images'
// Os arquivos ficam disponíveis em req.files
app.post('/api/upload', upload.array('images'), async (req, res) => {
  try {
    // req.files contém um array com todos os arquivos enviados
    const files = req.files

    // Array para armazenar informações das imagens que foram salvas
    const uploadedImages = []

    // Loop através de cada arquivo enviado
    for (const file of files) {
      // Insere os dados da imagem no banco de dados
      // await espera a Promise ser resolvida antes de continuar
      const result = await dbInsert(
        // Query SQL com placeholders (?) para prevenir SQL injection
        'INSERT INTO images (filename, originalname, mimetype, size) VALUES (?, ?, ?, ?)',
        // Array com os valores que substituem os placeholders na ordem
        [file.filename, file.originalname, file.mimetype, file.size]
      )

      // Adiciona as informações da imagem ao array de resposta
      uploadedImages.push({
        id: result.lastID,                    // ID gerado pelo banco de dados
        filename: file.filename,              // Nome do arquivo salvo
        originalname: file.originalname,      // Nome original
        url: `/uploads/${file.filename}`,      // URL para acessar a imagem
        mimetype: file.mimetype,              // Tipo MIME
        size: file.size                       // Tamanho em bytes
      })
    }

    // Retorna resposta JSON de sucesso com array de imagens
    res.json({ success: true, images: uploadedImages })
  } catch (error) {
    // Se houver qualquer erro, loga no console do servidor
    console.error('Erro no upload:', error)
    // Retorna resposta de erro HTTP 500 (Internal Server Error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ----------------------------------------------------------------------------
// GET /api/images - Endpoint para listar todas as imagens
// ----------------------------------------------------------------------------
app.get('/api/images', async (req, res) => {
  try {
    // Busca todas as imagens do banco, ordenadas por data de criação (mais recentes primeiro)
    // await espera a query ser concluída
    const images = await dbAll('SELECT * FROM images ORDER BY created_at DESC')

    // Adiciona a propriedade 'url' a cada imagem usando map()
    // map() cria um novo array transformando cada elemento
    const imagesWithUrl = images.map(img => ({
      ...img,  // Spread operator: copia todas as propriedades do objeto original
      url: `/uploads/${img.filename}`  // Adiciona a URL para acessar a imagem
    }))

    // Retorna resposta JSON com sucesso e array de imagens
    res.json({ success: true, images: imagesWithUrl })
  } catch (error) {
    // Loga erro no console
    console.error('Erro ao listar imagens:', error)
    // Retorna erro HTTP 500
    res.status(500).json({ success: false, error: error.message })
  }
})

// ----------------------------------------------------------------------------
// DELETE /api/images/:id - Endpoint para deletar uma imagem
// ----------------------------------------------------------------------------
// :id é um parâmetro de rota, acessível via req.params.id
app.delete('/api/images/:id', async (req, res) => {
  try {
    // Extrai o ID da URL (ex: /api/images/1 -> id = "1")
    const id = req.params.id

    // Busca a imagem no banco de dados pelo ID
    const image = await dbGet('SELECT * FROM images WHERE id = ?', [id])

    // Se a imagem não foi encontrada (image é null/undefined)
    if (!image) {
      // Retorna erro HTTP 404 (Not Found) e encerra a função
      return res.status(404).json({ success: false, error: 'Imagem não encontrada' })
    }

    // Cria o caminho completo do arquivo no sistema de arquivos
    const filePath = path.join(uploadsDir, image.filename)

    // Verifica se o arquivo existe antes de tentar deletar
    if (fs.existsSync(filePath)) {
      // Deleta o arquivo do sistema de arquivos
      // unlinkSync() é síncrono (bloqueia até completar)
      fs.unlinkSync(filePath)
    }

    // Deleta o registro do banco de dados
    // Criamos uma Promise manualmente porque db.run() precisa de tratamento especial
    await new Promise((resolve, reject) => {
      // Executa query DELETE
      db.run('DELETE FROM images WHERE id = ?', [id], (err) => {
        if (err) reject(err)  // Se erro, rejeita
        else resolve()         // Se sucesso, resolve
      })
    })

    // Retorna resposta de sucesso
    res.json({ success: true })
  } catch (error) {
    // Loga erro
    console.error('Erro ao deletar imagem:', error)
    // Retorna erro HTTP 500
    res.status(500).json({ success: false, error: error.message })
  }
})

// ----------------------------------------------------------------------------
// GET /db - Endpoint para visualizar banco de dados em HTML
// ----------------------------------------------------------------------------
app.get('/db', async (req, res) => {
  try {
    // Busca todas as imagens do banco
    const images = await dbAll('SELECT * FROM images ORDER BY created_at DESC')

    // Cria uma string HTML completa usando template literals (backticks)
    // Template literals permitem interpolação de variáveis com ${}
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
        // Operador ternário: se não há imagens, mostra mensagem vazia
        '<div class="empty">Nenhuma imagem no banco de dados</div>' :
        // Se há imagens, cria a tabela HTML
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
              // map() cria uma string HTML para cada imagem
              <tr>
                <td>${img.id}</td>
                // Mostra preview da imagem (80x80px)
                // onerror esconde a imagem se não carregar
                <td><img src="/uploads/${img.filename}" alt="Preview" class="image-preview" onerror="this.style.display='none'"></td>
                <td>${img.originalname}</td>
                <td>${img.filename}</td>
                <td>${img.mimetype}</td>
                // Converte bytes para KB e formata com 2 casas decimais
                <td class="size">${(img.size / 1024).toFixed(2)} KB</td>
                // Formata data para formato brasileiro
                <td>${new Date(img.created_at).toLocaleString('pt-BR')}</td>
              </tr>
            `).join('')}
            // join('') junta todas as strings do array em uma única string
          </tbody>
        </table>`
      }
    </body>
    </html>
    `

    // Envia o HTML como resposta
    res.send(html)
  } catch (error) {
    // Se houver erro, loga e envia HTML de erro
    console.error('Erro ao visualizar banco:', error)
    res.status(500).send(`<h1>Erro</h1><p>${error.message}</p>`)
  }
})

// ============================================================================
// INICIAR O SERVIDOR
// ============================================================================

// Inicia o servidor Express na porta definida
// app.listen() fica "escutando" requisições HTTP na porta especificada
app.listen(PORT, () => {
  // Callback executado quando o servidor inicia com sucesso
  console.log(`Servidor rodando em http://localhost:${PORT}`)
  console.log(`Visualizar banco de dados: http://localhost:${PORT}/db`)
})
