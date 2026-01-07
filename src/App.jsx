import { useState, useEffect, useRef } from 'react'

function App() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedImageIds, setSelectedImageIds] = useState([])
  const [viewMode, setViewMode] = useState('grid')
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [toast, setToast] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmModal, setConfirmModal] = useState(null)
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchMode, setSearchMode] = useState('simple') // 'simple' or 'smart'

  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)
  const uploadFilesRef = useRef(null)
  const setDragActiveRef = useRef(null)

  useEffect(() => {
    loadImages()
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark-mode')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark-mode')
    }
  }, [darkMode])

  useEffect(() => {
    uploadFilesRef.current = uploadFiles
    setDragActiveRef.current = setDragActive
  })

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && confirmModal) {
        confirmModal.onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [confirmModal])

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (setDragActiveRef.current) {
        setDragActiveRef.current(true)
      }
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDragLeave = (e) => {
      if (!e.relatedTarget || e.relatedTarget === document.body) {
        if (setDragActiveRef.current) {
          setDragActiveRef.current(false)
        }
      }
    }

    const handleDropGlobal = async (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (setDragActiveRef.current) {
          setDragActiveRef.current(false)
        }
        if (uploadFilesRef.current) {
          await uploadFilesRef.current(e.dataTransfer.files)
        }
      } else {
        if (setDragActiveRef.current) {
          setDragActiveRef.current(false)
        }
      }
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDropGlobal)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDropGlobal)
    }
  }, [])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadImages = async () => {
    try {
      const response = await fetch('/api/images')
      const data = await response.json()
      if (data.success) {
        setImages(data.images)
      }
    } catch (error) {
      console.error('Error loading images:', error)
      showToast('Error loading images', 'error')
    }
  }

  const uploadFiles = async (files) => {
    const allowedTypes = ['image/', 'application/pdf']
    const validFiles = Array.from(files).filter(file =>
      allowedTypes.some(type => file.type.startsWith(type))
    )

    if (validFiles.length === 0) {
      showToast('Por favor, selecione apenas imagens ou PDFs', 'error')
      return
    }

    setLoading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      validFiles.forEach(file => {
        formData.append('images', file)
      })

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await response.json()

      if (data.success) {
        setImages(prev => [...data.images, ...prev])
        showToast(`${data.images.length} arquivo(s) enviado(s) com sucesso!`, 'success')
      } else {
        showToast('Upload error: ' + data.error, 'error')
      }
    } catch (error) {
      console.error('Upload error:', error)
      showToast('Error uploading images', 'error')
    } finally {
      setLoading(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }

  const handleFileChange = async (e) => {
    await uploadFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files)
    }
  }

  const removeImage = async (id, e) => {
    e.stopPropagation()

    setConfirmModal({
      message: 'Are you sure you want to delete this image?',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/images/${id}`, {
            method: 'DELETE'
          })

          const data = await response.json()

          if (data.success) {
            setImages(prev => prev.filter(img => img.id !== id))
            showToast('Image deleted successfully', 'success')
            if (selectedImage?.id === id) {
              setSelectedImage(null)
            }
            setSelectedImageIds(prev => prev.filter(imgId => imgId !== id))
          } else {
            showToast('Error deleting image: ' + data.error, 'error')
          }
        } catch (error) {
          console.error('Error deleting:', error)
          showToast('Error deleting image', 'error')
        }
        setConfirmModal(null)
      },
      onCancel: () => {
        setConfirmModal(null)
      }
    })
  }

  const startRename = (image, e) => {
    e.stopPropagation()
    setRenamingId(image.id)
    const nameWithoutExt = image.originalname.replace(/\.[^/.]+$/, '')
    setRenameValue(nameWithoutExt)
  }

  const saveRename = async (id) => {
    try {
      const response = await fetch(`/api/images/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: renameValue })
      })

      const data = await response.json()

      if (data.success) {
        setImages(prev => prev.map(img =>
          img.id === id ? { ...img, originalname: data.originalname } : img
        ))
        showToast('Image renamed successfully', 'success')
        setRenamingId(null)
        setRenameValue('')
      } else {
        showToast('Error renaming: ' + data.error, 'error')
      }
    } catch (error) {
      console.error('Error renaming:', error)
      showToast('Error renaming image', 'error')
    }
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const toggleImageSelection = (imageId, e) => {
    e.stopPropagation()
    setSelectedImageIds(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId)
      } else {
        return [...prev, imageId]
      }
    })
  }

  const selectAllVisible = () => {
    const visibleIds = filteredImages.map(img => img.id)
    setSelectedImageIds(visibleIds)
    showToast(`${visibleIds.length} arquivo(s) selecionado(s)`, 'success')
  }

  const deselectAll = () => {
    setSelectedImageIds([])
    showToast('Seleção removida', 'success')
  }

  const deleteSelectedImages = () => {
    if (selectedImageIds.length === 0) return

    const idsToDelete = [...selectedImageIds] // Capturar valor antes do async

    setConfirmModal({
      message: `Tem certeza que deseja deletar ${idsToDelete.length} arquivo(s)? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          const deletePromises = idsToDelete.map(id =>
            fetch(`/api/images/${id}`, { method: 'DELETE' })
          )

          const results = await Promise.all(deletePromises)
          const failed = results.filter(r => !r.ok)

          if (failed.length === 0) {
            setImages(prev => prev.filter(img => !idsToDelete.includes(img.id)))
            if (selectedImage && idsToDelete.includes(selectedImage.id)) {
              setSelectedImage(null)
            }
            setSelectedImageIds([])
            showToast(`${idsToDelete.length} arquivo(s) deletado(s) com sucesso!`, 'success')
          } else {
            showToast(`Erro ao deletar ${failed.length} arquivo(s)`, 'error')
          }
        } catch (error) {
          console.error('Erro ao deletar:', error)
          showToast('Erro ao deletar arquivos', 'error')
        }
        setConfirmModal(null)
      },
      onCancel: () => {
        setConfirmModal(null)
      }
    })
  }

  const handleImageDoubleClick = (image) => {
    setSelectedImage(image)
  }

  const downloadSelectedImages = async () => {
    if (selectedImageIds.length === 0) return

    try {
      for (const imageId of selectedImageIds) {
        const image = images.find(img => img.id === imageId)
        if (image) {
          const response = await fetch(image.url)
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = image.originalname
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      }
      showToast(`${selectedImageIds.length} image(s) downloaded successfully!`, 'success')
      setSelectedImageIds([])
    } catch (error) {
      console.error('Error downloading images:', error)
      showToast('Error downloading images', 'error')
    }
  }

  const performSmartSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })

      const data = await response.json()
      if (data.success) {
        setSearchResults(data)
      } else {
        showToast('Erro na busca: ' + data.error, 'error')
      }
    } catch (error) {
      console.error('Erro na busca:', error)
      showToast('Erro ao realizar busca', 'error')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    // Limpar resultados de busca inteligente quando o usuário digita
    if (searchResults) {
      setSearchResults(null)
    }
  }

  const handleSmartSearchClick = () => {
    if (searchTerm.trim()) {
      performSmartSearch(searchTerm)
    } else {
      showToast('Digite algo para buscar', 'error')
    }
  }

  const filteredImages = searchResults
    ? (searchResults.searchResults || searchResults.documents || [])
    : images.filter(img => {
      if (!searchTerm.trim()) return true

      const searchLower = searchTerm.toLowerCase()
      const searchTerms = searchLower.split(/\s+/).filter(t => t.length > 0)

      // Buscar no nome do arquivo
      const nameMatch = img.originalname.toLowerCase().includes(searchLower)

      // Processar keywords (pode ser array ou string separada por vírgula)
      let keywordsArray = []
      if (Array.isArray(img.ai_keywords)) {
        keywordsArray = img.ai_keywords
      } else if (typeof img.ai_keywords === 'string' && img.ai_keywords.trim()) {
        keywordsArray = img.ai_keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
      }

      // Buscar nas keywords
      const keywordsMatch = keywordsArray.some(k =>
        k.toLowerCase().includes(searchLower) ||
        searchTerms.some(st => k.toLowerCase().includes(st))
      )

      // Buscar no tipo de documento
      const typeMatch = img.ai_document_type && (
        img.ai_document_type.toLowerCase().includes(searchLower) ||
        searchTerms.some(st => img.ai_document_type.toLowerCase().includes(st))
      )

      // Buscar na descrição
      const descriptionMatch = img.ai_description && (
        img.ai_description.toLowerCase().includes(searchLower) ||
        searchTerms.some(st => img.ai_description.toLowerCase().includes(st))
      )

      return nameMatch || keywordsMatch || typeMatch || descriptionMatch
    })

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground">Gallery</h1>
          <div className="flex gap-2 items-center">
            <button
              className="w-8 h-8 p-0 rounded-md bg-transparent border-none cursor-pointer flex items-center justify-center text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle theme"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <div className="flex gap-1 bg-muted p-1 rounded-md">
              <button
                className={`w-8 h-8 p-0 rounded-md border-none cursor-pointer flex items-center justify-center transition-all ${viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                title="Grid view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={viewMode === 'grid' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <button
                className={`w-8 h-8 p-0 rounded-md border-none cursor-pointer flex items-center justify-center transition-all ${viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                title="List view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={viewMode === 'list' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading && (
        <div className="fixed top-0 left-0 right-0 w-full h-1 bg-muted rounded-none overflow-hidden z-[101]">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      <div
        className={`fixed inset-0 z-[100] border-none bg-transparent pointer-events-none transition-all flex items-center justify-center ${dragActive ? 'bg-accent/10 pointer-events-auto border-[3px] border-dashed border-primary backdrop-blur-sm' : ''}`}
        ref={dropZoneRef}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      />

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-4 items-center mb-6">
          <div className="flex-1 flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por nome... ou use busca inteligente"
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full px-3 py-2 pr-10 border border-input rounded-lg bg-background text-foreground text-sm transition-all focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              <button
                onClick={handleSmartSearchClick}
                disabled={isSearching || !searchTerm.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md cursor-pointer transition-all border-none inline-flex items-center justify-center bg-transparent text-muted-foreground hover:text-primary hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                title="Busca inteligente com IA"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                )}
              </button>
            </div>
            {searchTerm && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {filteredImages.length} {searchResults ? 'encontrado(s)' : `de ${images.length}`}
              </span>
            )}
          </div>
          {filteredImages.length > 0 && (
            <div className="flex gap-2 items-center">
              {selectedImageIds.length === 0 ? (
                <button
                  onClick={selectAllVisible}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border border-border inline-flex items-center justify-center bg-background text-foreground hover:bg-accent gap-2"
                  title="Selecionar todos os arquivos visíveis"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                  Selecionar Todos
                </button>
              ) : (
                <>
                  <button
                    onClick={deselectAll}
                    className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border border-border inline-flex items-center justify-center bg-background text-foreground hover:bg-accent gap-2"
                    title="Remover seleção"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Desmarcar ({selectedImageIds.length})
                  </button>
                  <button
                    onClick={deleteSelectedImages}
                    className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border-none inline-flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                    title="Deletar arquivos selecionados"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                    Deletar ({selectedImageIds.length})
                  </button>
                  <button
                    onClick={downloadSelectedImages}
                    className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border-none inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download ({selectedImageIds.length})
                  </button>
                </>
              )}
            </div>
          )}
          <label htmlFor="file-input" className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border-none inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? 'Uploading...' : 'Upload'}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="file-input"
            multiple
            accept="image/*,.pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {searchResults && (searchResults.topic || searchResults.interpretation) && (
          <div className="mb-4 p-4 bg-card border border-border rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-primary">
                  {searchResults.topic || searchResults.interpretation}
                </p>
                {searchResults.documents && searchResults.documents.length > 0 && (
                  <ul className="list-none space-y-1.5">
                    {searchResults.documents.map((doc, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-primary/90">
                        <span className="mt-0.5 shrink-0">
                          {doc.hasDocument ? (
                            <span className="text-green-600 dark:text-green-400">✓</span>
                          ) : (
                            <span className="text-gray-400">○</span>
                          )}
                        </span>
                        <span className="flex-1">
                          <span className={doc.hasDocument ? 'text-primary' : 'text-primary/70'}>
                            {doc.name}
                          </span>
                          {!doc.hasDocument && doc.howToGet && (
                            <span className="text-primary/60 ml-1">
                              ({doc.howToGet})
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {(!searchResults.documents || searchResults.documents.length === 0) && searchResults.missingDocuments && searchResults.missingDocuments.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Documentos que faltam:</p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                      {searchResults.missingDocuments.map((doc, idx) => (
                        <li key={idx}>{doc}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(!searchResults.documents || searchResults.documents.length === 0) && searchResults.suggestions && searchResults.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-primary mb-1">Sugestões:</p>
                    <ul className="list-disc list-inside text-xs text-primary/80 space-y-1">
                      {searchResults.suggestions.map((suggestion, idx) => (
                        <li key={idx}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setSearchResults(null)
                  setSearchTerm('')
                }}
                className="w-6 h-6 p-0 rounded-md bg-transparent border-none cursor-pointer flex items-center justify-center text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {filteredImages.length > 0 ? (
          <div className={`${viewMode === 'grid' ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]' : 'flex flex-col gap-2'}`}>
            {filteredImages.map(image => {
              const isSelected = selectedImageIds.includes(image.id)
              return (
                <div
                  key={image.id}
                  className={`group relative border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${isSelected ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500 shadow-md' : 'bg-card border-border hover:border-muted-foreground/50'} ${viewMode === 'list' ? 'flex flex-row items-center p-2 gap-3' : ''}`}
                  onClick={(e) => toggleImageSelection(image.id, e)}
                  onDoubleClick={() => handleImageDoubleClick(image)}
                >
                  <div className={`relative overflow-hidden bg-muted ${viewMode === 'list' ? 'w-20 h-[60px] flex-shrink-0 rounded-md' : 'w-full aspect-square'}`}>
                    {image.mimetype === 'application/pdf' ? (
                      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
                        <div className="text-center p-4">
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-red-600 dark:text-red-400">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                          <p className="text-xs font-medium text-red-600 dark:text-red-400">PDF</p>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={image.url}
                        alt={image.originalname}
                        loading="lazy"
                        className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-105' : 'group-hover:scale-110'}`}
                      />
                    )}

                    {/* Selection Overlay (Google Photos Style) */}
                    <div className={`absolute inset-0 transition-all duration-200 ${isSelected ? 'bg-blue-500/20 opacity-100' : 'opacity-0 group-hover:opacity-100 bg-black/10'}`}>
                      {/* Circular checkbox in the top left corner */}
                      <div className="absolute top-2 left-2 transition-all duration-300">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg border-2 border-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-white bg-black/20 backdrop-blur-sm"></div>
                        )}
                      </div>
                    </div>

                    {/* Delete Icon (visible on hover) */}
                    {viewMode === 'grid' && (
                      <svg
                        onClick={(e) => removeImage(image.id, e)}
                        className="absolute top-2 right-2 z-30 cursor-pointer text-white drop-shadow-lg hover:text-destructive transition-all opacity-0 group-hover:opacity-100 filter hover:drop-shadow-2xl pointer-events-auto"
                        title="Delete image"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    )}
                  </div>
                  <div className={`${viewMode === 'list' ? 'flex-1 p-0 min-w-0 flex flex-col gap-1' : `p-3 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent transition-transform duration-300 ease-in-out ${renamingId === image.id ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'}`}`}>
                    {renamingId === image.id ? (
                      <div className="flex gap-1 items-center flex-wrap">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(image.id)
                            if (e.key === 'Escape') cancelRename()
                          }}
                          className={`border border-input rounded-lg bg-background text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 ${viewMode === 'list' ? 'px-2 py-1 text-[0.6875rem]' : 'px-2 py-1.5 text-xs'}`}
                          autoFocus
                        />
                        <button
                          onClick={() => saveRename(image.id)}
                          className="w-8 h-8 p-0 rounded-md bg-transparent border-none cursor-pointer flex items-center justify-center text-primary transition-all hover:bg-accent hover:text-accent-foreground"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelRename}
                          className="w-8 h-8 p-0 rounded-md bg-transparent border-none cursor-pointer flex items-center justify-center text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={`flex items-center justify-between gap-2 w-full`}>
                          <p
                            className={`font-medium overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer transition-colors hover:text-primary ${viewMode === 'list' ? 'flex-1 min-w-0 text-xs mb-0' : 'text-sm mb-0 text-white'}`}
                            title={image.originalname}
                            onClick={(e) => {
                              e.stopPropagation()
                              startRename(image, e)
                            }}
                          >
                            {viewMode === 'list'
                              ? image.originalname
                              : image.originalname.length > 25
                                ? image.originalname.substring(0, 25) + '...'
                                : image.originalname}
                          </p>
                          {viewMode === 'list' && (
                            <button
                              onClick={(e) => removeImage(image.id, e)}
                              className="w-8 h-8 p-0 rounded-md bg-transparent border-none cursor-pointer flex items-center justify-center text-destructive transition-all hover:bg-destructive/10 flex-shrink-0 opacity-70 hover:opacity-100"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        {viewMode === 'list' && (
                          <div className="flex gap-1.5 text-[0.6875rem] text-muted-foreground flex-wrap">
                            <span>{formatFileSize(image.size)}</span>
                            <span>•</span>
                            <span>{formatDate(image.created_at)}</span>
                            {image.ai_document_type && image.ai_document_type !== 'imagem geral' && (
                              <>
                                <span>•</span>
                                <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[0.625rem] font-medium">
                                  {image.ai_document_type}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        {viewMode === 'grid' && image.ai_document_type && image.ai_document_type !== 'imagem geral' && (
                          <div className="mt-1">
                            <span className="px-1.5 py-0.5 rounded bg-primary/20 text-white text-[0.625rem] font-medium">
                              {image.ai_document_type}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16 px-8 text-muted-foreground">
            {loading ? (
              <>
                <div className="w-full max-w-md h-72 mx-auto mb-4 bg-muted rounded-lg animate-pulse"></div>
                <p>Loading...</p>
              </>
            ) : searchTerm ? (
              <>
                <p>Nenhum documento encontrado para "{searchTerm}"</p>
                {searchResults && searchResults.missingDocuments && searchResults.missingDocuments.length > 0 && (
                  <div className="mt-4 p-4 bg-card border border-border rounded-lg max-w-md mx-auto text-left">
                    <p className="text-sm font-medium mb-2">Documentos que você pode precisar:</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {searchResults.missingDocuments.map((doc, idx) => (
                        <li key={idx}>{doc}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <p>No images saved yet</p>
                <p className="text-sm mt-2">Upload images to get started</p>
              </>
            )}
          </div>
        )}
      </main>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-foreground/80 flex items-center justify-center z-[1000] p-8 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-[90vw] max-h-[90vh] relative bg-card rounded-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute top-4 right-4 z-[1001] w-8 h-8 p-0 rounded-md bg-foreground/80 text-background flex items-center justify-center transition-all hover:bg-foreground/90"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
            {selectedImage.mimetype === 'application/pdf' ? (
              <iframe
                src={selectedImage.url}
                className="w-full h-[70vh] border-none"
                title={selectedImage.originalname}
              />
            ) : (
              <img
                src={selectedImage.url}
                alt={selectedImage.originalname}
                className="w-full h-auto max-h-[70vh] object-contain block"
              />
            )}
            <div className="p-4">
              <h3 className="text-base font-semibold mb-2">{selectedImage.originalname}</h3>
              <div className="flex gap-4 flex-wrap text-sm text-muted-foreground">
                <span>Size: {formatFileSize(selectedImage.size)}</span>
                <span>Type: {selectedImage.mimetype}</span>
                <span>Date: {formatDate(selectedImage.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 left-4 md:left-auto px-4 py-3 rounded-lg bg-card border border-border shadow-lg z-[2000] text-sm animate-[slideUp_0.2s] ${toast.type === 'success' ? 'border-primary' : 'border-destructive'}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {confirmModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000] backdrop-blur-sm"
          onClick={confirmModal.onCancel}
        >
          <div
            className="bg-card rounded-xl p-6 max-w-md w-[90%] mx-4 shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-3 text-foreground">Confirm action</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border border-border inline-flex items-center justify-center bg-background text-foreground hover:bg-accent"
                onClick={confirmModal.onCancel}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border-none inline-flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                onClick={confirmModal.onConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
