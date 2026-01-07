import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'

// Preços do Gemini 2.5 Flash (aproximados em USD por 1M tokens)
// Valores podem variar - ajuste conforme necessário
const PRICING = {
  'gemini-2.5-flash': {
    input: 0.075 / 1000000,  // $0.075 por 1M tokens de input
    output: 0.30 / 1000000   // $0.30 por 1M tokens de output
  },
  'gemini-1.5-flash': {
    input: 0.075 / 1000000,
    output: 0.30 / 1000000
  }
}

// Taxa de câmbio USD para BRL (pode ser atualizada ou obtida via API)
const USD_TO_BRL = 5.0 // Ajuste conforme necessário

/**
 * Calcula o custo de uma chamada à API baseado em tokens
 */
export function calculateCost(model, inputTokens, outputTokens) {
  const pricing = PRICING[model] || PRICING['gemini-2.5-flash']
  const inputCost = inputTokens * pricing.input
  const outputCost = outputTokens * pricing.output
  const totalCostUSD = inputCost + outputCost
  const totalCostBRL = totalCostUSD * USD_TO_BRL

  return {
    inputCost,
    outputCost,
    totalCostUSD,
    totalCostBRL,
    inputTokens,
    outputTokens
  }
}

// A API key será carregada dinamicamente em cada função para garantir que está atualizada

/**
 * Analisa uma imagem usando Gemini Vision e extrai informações estruturadas
 * @param {string} imagePath - Caminho completo para o arquivo de imagem
 * @returns {Promise<{description: string, keywords: string[], documentType: string}>}
 */
export async function analyzeImage(imagePath) {
  try {
    // Carregar API key diretamente do ambiente e limpar
    const apiKey = (process.env.GEMINI_API_KEY_AI || '').trim()

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY_AI não configurada. Configure a API key do Gemini para fazer upload de arquivos.')
    }

    // Validar formato básico da API key
    if (apiKey.length < 20) {
      throw new Error(`API Key parece inválida (muito curta: ${apiKey.length} caracteres). Verifique se a chave está correta.`)
    }

    console.log(`   🔑 API Key encontrada (${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}), iniciando análise com Gemini...`)

    // Criar nova instância com a API key para garantir que está correta
    const genAIInstance = new GoogleGenerativeAI(apiKey)
    const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })

    console.log(`   📖 Lendo arquivo: ${imagePath}`)
    const imageBuffer = fs.readFileSync(imagePath)
    const base64Image = imageBuffer.toString('base64')
    const ext = path.extname(imagePath).toLowerCase()
    const mimeType = getMimeType(ext)
    console.log(`   📄 Tipo MIME: ${mimeType}, Tamanho: ${(imageBuffer.length / 1024).toFixed(2)} KB`)

    const prompt = `Analise este documento (imagem ou PDF) e extraia informações detalhadas.

IMPORTANTE: Responda APENAS em formato JSON válido, sem markdown, sem explicações.

Se for um documento, identifique PRECISAMENTE o tipo:
- Passaporte (se for passaporte, SEMPRE use "passaporte" como documentType e inclua "passaporte" nas keywords)
- Carteira de identidade / RG
- Comprovante de residência / morada
- Contrato
- Certidão
- Diploma
- Carteira de trabalho
- NIF
- Título de residência
- Autorização de residência (AR)
- Extrato bancário
- Recibos
- etc.

Para keywords, gere PELO MENOS 20 palavras-chave relevantes incluindo:
- O nome completo do documento em português (ex: "Passaporte", "Título de Residência", "Formulário de Pedido de Renovação")
- Sinônimos e variações do tipo de documento
- Palavras relacionadas ao uso do documento e processo (ex: "renovação", "autorização", "residência", "imigração")
- Contexto de uso (ex: "viagem", "trabalho", "estudo", "residência em Portugal")
- País se identificável (ex: "Portugal", "Brasil")
- Instituição emissora se visível (ex: "AIMA", "SEF", "Segurança Social", "Autoridade Tributária")
- Características visíveis (ex: "foto", "assinatura", "carimbo", "selo", "válido")
- Formato (ex: "digital", "escaneado", "original", "online")
- Validade se visível (ex: "válido", "expirado", "dentro do prazo")
- Termos relacionados ao processo (ex: "renovação de autorização", "pedido de residência", "certidão de não dívida")
- Outras palavras relevantes do conteúdo e processo relacionado

IMPORTANTE:
- As keywords devem ser descritivas e incluir termos que ajudem na busca, como nomes de órgãos, processos e documentos relacionados
- NÃO inclua instruções de "como obter" nas keywords - apenas descrições do documento e termos relacionados
- Use termos completos e descritivos que facilitem o match com buscas por IA

Se NÃO for um documento, gere pelo menos 20 keywords descrevendo:
- O que aparece na imagem
- Cores, objetos, pessoas, lugares
- Contexto e situação
- Estilo e tipo de imagem

Formato de resposta obrigatório:
{
  "isDocument": true/false,
  "documentType": "tipo do documento em português (ex: 'passaporte', 'carteira de identidade') ou 'imagem geral'",
  "description": "descrição detalhada do conteúdo sem dados pessoais sensíveis",
  "keywords": ["keyword1", "keyword2", "keyword3", ...], // MÍNIMO 20 keywords
  "country": "país do documento ou null",
  "typicalUse": "para que este documento é tipicamente usado"
}

CRÍTICO: Retorne SEMPRE pelo menos 20 keywords no array. Seja criativo e detalhado.`

    const aiResult = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image
        }
      }
    ])

    // Obter informações de uso (tokens)
    const usageMetadata = aiResult.response.usageMetadata
    const inputTokens = usageMetadata?.promptTokenCount || 0
    const outputTokens = usageMetadata?.candidatesTokenCount || 0
    const totalTokens = usageMetadata?.totalTokenCount || (inputTokens + outputTokens)

    // Calcular custo
    const costInfo = calculateCost('gemini-2.5-flash', inputTokens, outputTokens)

    console.log(`   💰 Custo da análise:`)
    console.log(`      Tokens entrada: ${inputTokens.toLocaleString()}`)
    console.log(`      Tokens saída: ${outputTokens.toLocaleString()}`)
    console.log(`      Total tokens: ${totalTokens.toLocaleString()}`)
    console.log(`      Custo: $${costInfo.totalCostUSD.toFixed(6)} USD (R$ ${costInfo.totalCostBRL.toFixed(4)})`)

    // Armazenar custo para salvar no banco depois
    if (typeof global !== 'undefined') {
      global.lastApiCost = {
        operationType: 'image_analysis',
        inputTokens,
        outputTokens,
        costUSD: costInfo.totalCostUSD,
        costBRL: costInfo.totalCostBRL,
        model: 'gemini-2.5-flash',
        details: JSON.stringify({ imagePath, mimeType })
      }
    }

    const response = aiResult.response.text()

    // Limpar resposta e fazer parse do JSON
    let cleanResponse = response.trim()
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.slice(7)
    }
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.slice(3)
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.slice(0, -3)
    }
    cleanResponse = cleanResponse.trim()

    console.log(`   📝 Resposta da IA recebida, fazendo parse do JSON...`)
    const parsed = JSON.parse(cleanResponse)

    // Garantir que keywords seja sempre um array
    let keywords = []
    if (Array.isArray(parsed.keywords)) {
      keywords = parsed.keywords
    } else if (parsed.keywords) {
      keywords = [parsed.keywords]
    }

    // Se não houver keywords mas houver documentType, adicionar o tipo como keyword
    if (keywords.length === 0 && parsed.documentType && parsed.documentType !== 'imagem geral') {
      keywords = [parsed.documentType.toLowerCase()]
    }

    // Garantir pelo menos 20 keywords - expandir se necessário
    if (keywords.length < 20) {
      console.log(`   ⚠️  Apenas ${keywords.length} keywords recebidas, expandindo para pelo menos 20...`)

      // Adicionar variações e termos relacionados
      const docType = parsed.documentType?.toLowerCase() || 'imagem geral'
      const additionalKeywords = []

      // Adicionar variações do tipo de documento com termos mais descritivos
      if (docType.includes('passaporte')) {
        additionalKeywords.push('Passaporte', 'Documento de Viagem', 'Identificação Internacional', 'Viagem Internacional', 'Fronteira', 'Imigração', 'Nacionalidade', 'Visto', 'Entrada no País', 'Saída do País', 'Aeroporto', 'Consulado')
      } else if (docType.includes('identidade') || docType.includes('rg')) {
        additionalKeywords.push('Carteira de Identidade', 'RG', 'Registro Geral', 'Documento de Identidade', 'CPF', 'Brasileiro', 'Cidadão', 'Nacional', 'Identificação Pessoal')
      } else if (docType.includes('comprovante')) {
        additionalKeywords.push('Comprovante', 'Comprovação', 'Evidência', 'Prova Documental', 'Documento Comprobatório', 'Atestado', 'Declaração')
      } else if (docType.includes('residência') || docType.includes('morada') || docType.includes('alojamento')) {
        additionalKeywords.push('Autorização de Residência', 'Título de Residência', 'Renovação de Residência', 'Morada', 'Endereço', 'Domicílio', 'Habitação', 'Portugal', 'AIMA', 'SEF', 'Imigração')
      } else if (docType.includes('nif') || docType.includes('fiscal')) {
        additionalKeywords.push('NIF', 'Número de Identificação Fiscal', 'Autoridade Tributária', 'Portal das Finanças', 'Certidão de Não Dívida', 'AT')
      } else if (docType.includes('segurança social') || docType.includes('seguranca')) {
        additionalKeywords.push('Segurança Social', 'Segurança Social Direta', 'Certidão de Não Dívida', 'Portal da Segurança Social', 'Balcão de Atendimento')
      } else if (docType.includes('formulário') || docType.includes('formulario')) {
        additionalKeywords.push('Formulário', 'Formulário Online', 'Portal Online', 'Submissão Online', 'Preenchimento', 'Submeter')
      } else if (docType.includes('meios') || docType.includes('subsistência') || docType.includes('subsistencia')) {
        additionalKeywords.push('Comprovativo de Meios de Subsistência', 'Declarações Bancárias', 'Recibos de Vencimento', 'Contrato de Trabalho', 'Meios Financeiros')
      } else if (docType.includes('matrícula') || docType.includes('matricula') || docType.includes('estudante')) {
        additionalKeywords.push('Comprovativo de Matrícula', 'Estudante', 'Instituição de Ensino', 'Frequência Escolar', 'Matrícula Escolar')
      }

      // Adicionar termos genéricos mais descritivos se ainda não tiver 20
      const genericTerms = ['Documento Oficial', 'Arquivo Digital', 'Documento Escaneado', 'Documento Original', 'Documento Válido', 'Assinado', 'Carimbado', 'Selado', 'Foto Tipo Passe', 'Fotografia', 'Formulário Preenchido', 'Certificado', 'Registro Oficial', 'Documento Português', 'Processo Burocrático']

      for (const term of [...additionalKeywords, ...genericTerms]) {
        if (keywords.length >= 20) break
        if (!keywords.some(k => k.toLowerCase().includes(term.toLowerCase()))) {
          keywords.push(term)
        }
      }

      console.log(`   ✅ Expandido para ${keywords.length} keywords`)
    }

    const result = {
      description: parsed.description || '',
      keywords: keywords.slice(0, 30), // Limitar a 30 para não exagerar
      documentType: parsed.documentType || 'imagem geral',
      isDocument: parsed.isDocument || false,
      country: parsed.country || null,
      typicalUse: parsed.typicalUse || ''
    }

    console.log(`   ✅ Parse concluído - ${result.keywords.length} keywords extraídas`)
    return result
  } catch (error) {
    console.error(`   ❌ Erro ao analisar imagem com Gemini:`, error.message)
    if (error.message.includes('JSON')) {
      console.error(`   ⚠️  Erro de parse JSON - resposta pode estar malformada`)
    }
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      throw new Error('API Key inválida ou sem permissões. Verifique sua GEMINI_API_KEY_AI no Google AI Studio.')
    }
    console.error(`   Stack:`, error.stack)
    // Re-throw o erro para que o upload seja bloqueado
    throw error
  }
}

/**
 * Interpreta uma busca em linguagem natural e retorna query estruturada
 * @param {string} userQuery - Busca do usuário em linguagem natural
 * @param {Array} availableDocuments - Lista de documentos disponíveis no banco
 * @returns {Promise<{searchTerms: string[], interpretation: string, suggestions: string[]}>}
 */
export async function interpretSearch(userQuery, availableDocuments) {
  try {
    const apiKey = (process.env.GEMINI_API_KEY_AI || '').trim()
    if (!apiKey) {
      return getBasicSearchInterpretation(userQuery)
    }

    const genAIInstance = new GoogleGenerativeAI(apiKey)
    const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const docSummary = availableDocuments.map(d => ({
      id: d.id,
      type: d.ai_document_type,
      keywords: d.ai_keywords,
      description: d.ai_description
    }))

    const prompt = `Você é um assistente de busca para uma galeria de imagens e documentos.

O usuário está buscando: "${userQuery}"

Documentos disponíveis no sistema:
${JSON.stringify(docSummary, null, 2)}

Analise a busca e responda em JSON:
{
  "topic": "tema principal da busca (ex: 'Renovação de Autorização de Residência', 'Rendimento das Pessoas Singulares (IRS)', etc.)",
  "searchTerms": ["termos", "para", "buscar", "no", "banco"],
  "matchingDocIds": [ids dos documentos que correspondem à busca - pode estar vazio se não encontrar],
  "documents": [
    {
      "id": id do documento se existir no sistema (pode ser null),
      "name": "nome do documento",
      "hasDocument": true/false,
      "howToGet": "instruções curtas de como conseguir este documento (obrigatório se hasDocument for false)"
    }
  ]
}

CRÍTICO: Você DEVE sempre retornar uma lista completa de documentos necessários para o tema, mesmo que o usuário não tenha nenhum documento no sistema. Se matchingDocIds estiver vazio, todos os documentos devem ter hasDocument: false e howToGet preenchido.

IMPORTANTE:
- O campo "topic" deve ser apenas o tema/título, sem prefixos como "O usuário está procurando"
- O campo "documents" deve listar TODOS os documentos relevantes para o tema, mesmo que o usuário não tenha nenhum
- Para documentos que o usuário JÁ TEM (presentes em matchingDocIds), marque hasDocument: true
- Para documentos que FALTAM, marque hasDocument: false e forneça instruções em "howToGet"
- SEMPRE retorne uma lista completa de documentos necessários para o tema, mesmo que matchingDocIds esteja vazio
- Se não encontrar documentos correspondentes, ainda assim liste TODOS os documentos necessários com hasDocument: false
- Seja direto e objetivo no topic
- Não mencione processos burocráticos a menos que seja relevante

Responda APENAS o JSON, sem markdown.`

    const result = await model.generateContent(prompt)

    // Obter informações de uso (tokens)
    const usageMetadata = result.response.usageMetadata
    const inputTokens = usageMetadata?.promptTokenCount || 0
    const outputTokens = usageMetadata?.candidatesTokenCount || 0
    const totalTokens = usageMetadata?.totalTokenCount || (inputTokens + outputTokens)

    // Calcular custo
    const costInfo = calculateCost('gemini-2.5-flash', inputTokens, outputTokens)

    console.log(`   💰 Custo da busca:`)
    console.log(`      Tokens entrada: ${inputTokens.toLocaleString()}`)
    console.log(`      Tokens saída: ${outputTokens.toLocaleString()}`)
    console.log(`      Total tokens: ${totalTokens.toLocaleString()}`)
    console.log(`      Custo: $${costInfo.totalCostUSD.toFixed(6)} USD (R$ ${costInfo.totalCostBRL.toFixed(4)})`)

    // Armazenar custo para salvar no banco depois
    if (typeof global !== 'undefined') {
      global.lastSearchCost = {
        operationType: 'search',
        inputTokens,
        outputTokens,
        costUSD: costInfo.totalCostUSD,
        costBRL: costInfo.totalCostBRL,
        model: 'gemini-2.5-flash',
        details: JSON.stringify({ query: userQuery, documentsCount: availableDocuments.length })
      }
    }

    const response = result.response.text()

    let cleanResponse = response.trim()
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.slice(7)
    }
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.slice(3)
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.slice(0, -3)
    }
    cleanResponse = cleanResponse.trim()

    const parsed = JSON.parse(cleanResponse)

    return {
      topic: parsed.topic || parsed.interpretation || userQuery,
      searchTerms: parsed.searchTerms || [userQuery],
      matchingDocIds: parsed.matchingDocIds || [],
      documents: parsed.documents || []
    }
  } catch (error) {
    console.error('Erro ao interpretar busca:', error.message)
    return getBasicSearchInterpretation(userQuery)
  }
}

function getBasicAnalysis(imagePath) {
  const filename = path.basename(imagePath)
  const baseName = filename.split('.')[0]
  console.log(`⚠️  Usando análise básica para: ${filename} (API key não configurada)`)
  // Retornar keywords vazias para forçar erro se API key não estiver configurada
  throw new Error('GEMINI_API_KEY_AI não configurada. Configure a API key do Gemini para fazer upload de arquivos.')
}

function getBasicSearchInterpretation(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  return {
    interpretation: query,
    searchTerms: terms,
    matchingDocIds: [],
    missingDocuments: [],
    suggestions: ['Configure a API key do Gemini para buscas mais inteligentes']
  }
}

function getMimeType(ext) {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf'
  }
  return mimeTypes[ext] || 'image/jpeg'
}

