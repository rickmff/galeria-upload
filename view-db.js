import sqlite3 from 'sqlite3'
import { promisify } from 'util'

const db = new sqlite3.Database('./database.db')
const dbAll = promisify(db.all.bind(db))

async function viewDatabase() {
  try {
    console.log('\n📊 Visualizando Banco de Dados\n')
    console.log('=' .repeat(80))

    const images = await dbAll('SELECT * FROM images ORDER BY created_at DESC')

    if (images.length === 0) {
      console.log('Nenhuma imagem encontrada no banco de dados.\n')
      db.close()
      return
    }

    console.log(`Total de imagens: ${images.length}\n`)
    console.log('=' .repeat(80))

    images.forEach((img, index) => {
      const sizeKB = (img.size / 1024).toFixed(2)
      const date = new Date(img.created_at).toLocaleString('pt-BR')

      console.log(`\n[${index + 1}] ID: ${img.id}`)
      console.log(`    Nome Original: ${img.originalname}`)
      console.log(`    Arquivo: ${img.filename}`)
      console.log(`    Tipo: ${img.mimetype}`)
      console.log(`    Tamanho: ${sizeKB} KB`)
      console.log(`    Criado em: ${date}`)
      console.log(`    URL: http://localhost:3001/uploads/${img.filename}`)
    })

    console.log('\n' + '='.repeat(80))
    console.log(`\nTotal: ${images.length} imagem(ns)\n`)

  } catch (error) {
    console.error('Erro ao visualizar banco:', error)
  } finally {
    db.close()
  }
}

viewDatabase()

