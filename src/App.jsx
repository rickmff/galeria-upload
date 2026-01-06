// ============================================================================
// COMPONENTE PRINCIPAL DA APLICAÇÃO - React
// ============================================================================

// Importa hooks do React: useState para gerenciar estado e useEffect para efeitos colaterais
// useState: permite criar variáveis de estado que quando mudam, re-renderizam o componente
// useEffect: permite executar código quando o componente é montado ou quando dependências mudam
import { useState, useEffect } from 'react'

// Importa o arquivo CSS específico deste componente
// O Vite processa este import e injeta os estilos na página
import './App.css'

// Declara o componente funcional App
// Em React, componentes são funções que retornam JSX (JavaScript XML)
function App() {
  // ============================================================================
  // ESTADO DO COMPONENTE (State)
  // ============================================================================

  // useState retorna um array com 2 elementos: [valor, funçãoParaAtualizar]
  // images: array que armazena todas as imagens carregadas do servidor
  // setImages: função para atualizar o array de imagens
  // [] é o valor inicial (array vazio)
  const [images, setImages] = useState([])

  // loading: boolean que indica se está fazendo upload de imagens
  // setLoading: função para atualizar o estado de loading
  // false é o valor inicial (não está carregando)
  const [loading, setLoading] = useState(false)

  // ============================================================================
  // EFEITO COLATERAL - Carregar imagens ao montar componente
  // ============================================================================

  // useEffect executa código após o componente ser renderizado
  // Primeiro parâmetro: função a ser executada
  // Segundo parâmetro: array de dependências (quando mudar, executa novamente)
  // [] vazio significa: execute apenas uma vez quando o componente é montado
  useEffect(() => {
    // Chama a função para carregar imagens do servidor
    loadImages()
  }, [])  // Array vazio = executa apenas na montagem inicial

  // ============================================================================
  // FUNÇÃO: Carregar imagens do servidor
  // ============================================================================

  // Função assíncrona (async) permite usar await para esperar Promises
  const loadImages = async () => {
    try {
      // fetch() faz uma requisição HTTP GET para a API
      // '/api/images' é relativo ao servidor (proxy do Vite redireciona para localhost:3001)
      const response = await fetch('/api/images')

      // response.json() converte a resposta HTTP em objeto JavaScript
      // await espera a conversão ser concluída
      const data = await response.json()

      // Verifica se a resposta indica sucesso
      if (data.success) {
        // Atualiza o estado 'images' com as imagens recebidas do servidor
        // setImages() causa re-renderização do componente
        setImages(data.images)
      }
    } catch (error) {
      // Se houver erro na requisição (rede, servidor offline, etc)
      // Loga o erro no console do navegador (F12 > Console)
      console.error('Erro ao carregar imagens:', error)
    }
  }

  // ============================================================================
  // FUNÇÃO: Manipular seleção de arquivos (Upload)
  // ============================================================================

  // Função assíncrona que é chamada quando o usuário seleciona arquivos
  // e: evento do input file, contém informações sobre os arquivos selecionados
  const handleFileChange = async (e) => {
    // e.target.files é um FileList (similar a array, mas não é array)
    // Array.from() converte FileList em array JavaScript real
    const files = Array.from(e.target.files)

    // filter() cria novo array apenas com arquivos que passam no teste
    // file.type.startsWith('image/') verifica se o tipo MIME começa com 'image/'
    // Isso garante que apenas imagens sejam aceitas
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    // Se não houver imagens válidas, encerra a função (return)
    if (imageFiles.length === 0) return

    // Atualiza estado para mostrar que está fazendo upload
    // Isso ativa o feedback visual (botão fica desabilitado, mostra "Enviando...")
    setLoading(true)

    try {
      // FormData é uma API do navegador para criar dados multipart/form-data
      // Necessário para enviar arquivos via HTTP POST
      const formData = new FormData()

      // forEach() itera sobre cada arquivo
      imageFiles.forEach(file => {
        // append() adiciona arquivo ao FormData
        // 'images' é o nome do campo que o servidor espera (deve corresponder ao multer)
        // file é o objeto File do arquivo selecionado
        formData.append('images', file)
      })

      // Faz requisição POST para fazer upload
      const response = await fetch('/api/upload', {
        method: 'POST',        // Método HTTP POST
        body: formData         // FormData como corpo da requisição
        // Não precisa definir Content-Type, o navegador faz automaticamente para FormData
      })

      // Converte resposta em JSON
      const data = await response.json()

      // Verifica se o upload foi bem-sucedido
      if (data.success) {
        // Adiciona novas imagens ao início do array existente
        // setImages() recebe uma função que recebe o estado anterior (prev)
        // [...data.images, ...prev] usa spread operator para:
        // - Primeiro colocar as novas imagens (data.images)
        // - Depois as imagens antigas (prev)
        // Isso faz as novas imagens aparecerem primeiro na galeria
        setImages(prev => [...data.images, ...prev])
      } else {
        // Se houver erro no servidor, mostra alerta ao usuário
        alert('Erro ao fazer upload: ' + data.error)
      }
    } catch (error) {
      // Se houver erro de rede ou outro erro, loga e mostra alerta
      console.error('Erro no upload:', error)
      alert('Erro ao fazer upload das imagens')
    } finally {
      // finally sempre executa, independente de sucesso ou erro
      // Desativa o estado de loading
      setLoading(false)
      // Limpa o valor do input file
      // Isso permite selecionar o mesmo arquivo novamente se necessário
      e.target.value = ''
    }
  }

  // ============================================================================
  // FUNÇÃO: Remover imagem
  // ============================================================================

  // Função assíncrona para deletar uma imagem
  // id: ID da imagem a ser deletada (vem do banco de dados)
  const removeImage = async (id) => {
    try {
      // Faz requisição DELETE para a API
      // Template literal (backticks) permite interpolação: `/api/images/${id}`
      // Se id = 1, a URL será '/api/images/1'
      const response = await fetch(`/api/images/${id}`, {
        method: 'DELETE'  // Método HTTP DELETE
      })

      // Converte resposta em JSON
      const data = await response.json()

      // Se deletou com sucesso
      if (data.success) {
        // Atualiza o estado removendo a imagem deletada
        // filter() cria novo array apenas com imagens que passam no teste
        // img.id !== id mantém apenas imagens cujo ID é diferente do deletado
        setImages(prev => prev.filter(img => img.id !== id))
      } else {
        // Se houver erro, mostra alerta
        alert('Erro ao deletar imagem: ' + data.error)
      }
    } catch (error) {
      // Se houver erro de rede, loga e mostra alerta
      console.error('Erro ao deletar:', error)
      alert('Erro ao deletar imagem')
    }
  }

  // ============================================================================
  // RENDERIZAÇÃO DO COMPONENTE (JSX)
  // ============================================================================

  // return retorna o JSX que será renderizado na tela
  // JSX parece HTML, mas é JavaScript (por isso className ao invés de class)
  return (
    // div principal com classe CSS 'app'
    <div className="app">
      {/* Título da página */}
      <h1>Galeria de Upload</h1>

      {/* Área de upload */}
      <div className="upload-area">
        {/* Input file escondido (display: none) */}
        {/* Usamos label para criar botão customizado */}
        <input
          type="file"           // Tipo de input para seleção de arquivos
          id="file-input"       // ID para associar com o label
          multiple              // Permite selecionar múltiplos arquivos
          accept="image/*"      // Aceita apenas arquivos de imagem (filtro no navegador)
          onChange={handleFileChange}  // Função chamada quando arquivos são selecionados
          style={{ display: 'none' }} // Esconde o input (usamos label customizado)
        />
        {/* Label que funciona como botão customizado */}
        {/* htmlFor conecta ao input com id="file-input" */}
        {/* Quando clicado, abre o seletor de arquivos */}
        <label
          htmlFor="file-input"
          className="upload-button"
          // Opacidade muda baseado no estado loading (feedback visual)
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {/* Texto do botão muda baseado no estado loading */}
          {/* Operador ternário: se loading é true, mostra "Enviando...", senão "Upload de Imagens" */}
          {loading ? 'Enviando...' : 'Upload de Imagens'}
        </label>
      </div>

      {/* Mensagem de loading - só aparece se loading for true */}
      {/* && é operador lógico: se loading é true, renderiza o <p> */}
      {loading && (
        <p style={{ textAlign: 'center', color: '#666' }}>Enviando imagens...</p>
      )}

      {/* Galeria de imagens */}
      <div className="gallery">
        {/* map() itera sobre cada imagem e cria um elemento para cada uma */}
        {/* images.map() retorna um array de elementos JSX */}
        {images.map(image => (
          // key é obrigatório em listas React (ajuda React a identificar cada item)
          // image.id é único, então é perfeito para key
          <div key={image.id} className="image-item">
            {/* Tag img mostra a imagem */}
            {/* src usa a URL da imagem (vem do servidor) */}
            {/* alt é texto alternativo para acessibilidade */}
            <img src={image.url} alt={image.originalname} />
            {/* Botão para deletar imagem */}
            {/* onClick chama removeImage com o ID da imagem quando clicado */}
            <button
              onClick={() => removeImage(image.id)}
              className="remove-btn"
            >
              ✕  {/* Símbolo X para deletar */}
            </button>
          </div>
        ))}
      </div>

      {/* Mensagem quando não há imagens */}
      {/* Só mostra se não há imagens E não está carregando */}
      {/* && é operador lógico AND */}
      {images.length === 0 && !loading && (
        <p className="empty-message">Nenhuma imagem salva</p>
      )}
    </div>
  )
}

// Exporta o componente App como padrão
// Permite importar em outros arquivos: import App from './App'
export default App
